import { BlockExpression, Break, BreakIndexed, childrenOf, ImportFunction, LiteralInt32, LiteralKind,Locatable,NodeKind, Parameter, Scope, StructField, Subtract, SwitchCase, Tree } from "./ast";
import { i32Type, Type, voidType } from "./types";

export function lowerSwitch(program: Tree[], types: Map<Tree, Type>): { program: Tree[], types: Map<Tree, Type> } {
    const lets = new Scope<Tree>()
    const result = program.map(tree => switchLowering(tree, { types, lets }))
    return {
        program: result,
        types: types
    }
}

interface TransformContext {
    types: Map<Tree, Type>
    lets: Scope<Tree>
}

type Transformer = (tree: Tree, context: TransformContext) => Tree

let uniqueCount = 0
function unique(name?: string): string {
    return `${name ?? 'tmp'}$${uniqueCount++}`
}

function switchLowering(tree: Tree, context: TransformContext): Tree {
    function record<T extends Tree>(item: T, type?: Type): T {
        context.types.set(item, type ?? voidType)
        if (item.start === undefined) {
            item.start = tree.start
            item.end = tree.start
        }
        return item
    }

    switch (tree.kind) {
        case NodeKind.Let:
            context.lets.enter(tree.name, tree.value)
            return transformChildren(tree, context, switchLowering)
        case NodeKind.BlockExpression:
        case NodeKind.Loop:
        case NodeKind.Function: {
            const lets = new Scope<Tree>(context.lets)
            return transformChildren(tree, { lets, types: context.types }, switchLowering)
        }
        case NodeKind.Switch: {
            const switchStmt = transformChildren(tree, context, switchLowering)
            const prefix: Tree[] = []
            let target = switchStmt.target
            if (target.kind != NodeKind.Reference) {
                const name = unique("switch")
                target = { kind: NodeKind.Reference, name }
                prefix.push(
                    record({
                        kind: NodeKind.Assign,
                        target,
                        value: switchStmt.target
                    })
                )
            }

            const rootBlock = record<BlockExpression>({
                kind: NodeKind.BlockExpression,
                name: unique("switch"),
                block: prefix
            });
            const outerBreak: Break = { kind: NodeKind.Break, name: rootBlock.name }
            let currentBlock = rootBlock
            function newBlock(body: Tree[]): BlockExpression {
                const block = record<BlockExpression>({
                    kind: NodeKind.BlockExpression,
                    name: unique("case"),
                    block: body
                })
                if (currentBlock === rootBlock) {
                    currentBlock.block.push(block)
                } else {
                    currentBlock.block.unshift(block)
                }
                currentBlock = block
                return block
            }

            const switches: { value: number, label: string }[] = []
            let defaultBlock: BlockExpression | undefined = undefined
            for (const switchCase of tree.cases) {
                const block = newBlock([
                    ...switchCase.body,
                    outerBreak
                ])
                if (switchCase.default) {
                    if (defaultBlock) error(switchCase, "Duplicate default")
                    defaultBlock = block
                }
                const expressions = switchCase.expressions.map(
                    expression => foldNumber(expression, context)
                )
                expressions.forEach(
                    value => switches.push({ value, label: block.name!! })
                )
            }

            switches.sort((a, b) => a.value > b.value ? 1 : a.value == b.value ? 0 : -1)
            let labels: string[] = []
            let first: number | undefined = undefined
            let last: number | undefined = undefined
            const defaultLabel = defaultBlock?.name ?? rootBlock.name!!
            function makeBranch(elseLabel?: string) {
                if (first !== undefined) {
                    const block = newBlock([])
                    const expression = record<Subtract>({
                        kind: NodeKind.Subtract,
                        left: target,
                        right: record<LiteralInt32>({
                            kind: NodeKind.Literal,
                            literalKind: LiteralKind.Int32,
                            value: first
                        }, i32Type)
                    }, i32Type)
                    const indexBranch = record<BreakIndexed>({
                        kind: NodeKind.BreakIndexed,
                        expression,
                        labels,
                        else: elseLabel ?? block.name!!
                    })
                    block.block.push(indexBranch)
                }
            }
            for (let i = 0, len = switches.length; i < len; i++) {
                const s = switches[i]
                const value = s.value
                if (first === undefined) {
                    first = value
                    last = value
                    labels = [s.label]
                } else if (last === undefined) {
                    error(tree, "Internal error")
                } else {
                    if (value - last > 10) {
                        makeBranch()
                        first = value
                        last = value
                    }
                    for (let j = last + 1; j < value; j++) {
                        labels.push(defaultLabel)
                    }
                    labels.push(s.label)
                    last = value
                }
            }
            makeBranch(defaultLabel)
            return rootBlock
        }
        default:
            return transformChildren(tree, context, switchLowering)
    }
}

function transformChildren<T extends Tree>(
    tree: T,
    context: TransformContext,
    tx: Transformer
) {
    const newChildren: Tree[] = []
    let changed = false
    for (const child of childrenOf(tree)) {
        const newChild = tx(child, context)
        newChildren.push(newChild)
        changed = changed || newChild !== child
    }
    if (changed) {
        return updated(tree, newChildren, context)
    }
    return tree
}

function updateContext(oldTree: Tree, newTree: Tree, context: TransformContext) {
    if (oldTree !== newTree) {
        const type = context.types.get(oldTree)
        if (type) context.types.set(newTree, type)
        if (oldTree.start !== undefined && newTree.start === undefined) {
            newTree.start  = oldTree.start
        }
        if (oldTree.end !== undefined && newTree.end === undefined) {
            newTree.end  = oldTree.end
        }
    }
}

function foldNumber(tree: Tree, context: TransformContext): number {
    function fold(tree: Tree): number {
        switch (tree.kind) {
            case NodeKind.Add:  return fold(tree.left) + fold(tree.right)
            case NodeKind.Subtract: return fold(tree.left) + fold(tree.right)
            case NodeKind.Multiply: return fold(tree.left) + fold(tree.right)
            case NodeKind.Divide: {
                const left = fold(tree.left)
                const right = fold(tree.right)
                if (right === 0.0) error(tree, "Divide by zero")
                return left / right;
            }
            case NodeKind.Reference: {
                const value = context.lets.find(tree.name)
                if (!value) error(tree, "Expected a consted expression")
                return fold(value)
            }
            case NodeKind.Literal:
                if (tree.literalKind == LiteralKind.Int32)
                    return tree.value
            default:
                error(tree, "Expected a constant expression")
        }
    }
    return fold(tree)
}

function updated<T extends Tree>(tree: T, newChildren: Tree[], context: TransformContext): T {
    const newTree = copy(tree, newChildren)
    updateContext(tree, newTree, context)
    return newTree
}

function copy<T extends Tree>(tree: T, newChildren: Tree[]): T {
    switch (tree.kind) {
        case NodeKind.Add:
        case NodeKind.Subtract:
        case NodeKind.Multiply:
        case NodeKind.Divide:
        case NodeKind.Compare:
        case NodeKind.And:
        case NodeKind.Or:
        case NodeKind.As:
            return {
                ...tree,
                left: newChildren[0],
                right: newChildren[1]
            }
        case NodeKind.Negate:
        case NodeKind.Not:
        case NodeKind.AddressOf:
        case NodeKind.Dereference:
            return {
                ...tree,
                target: newChildren[0],
            }
        case NodeKind.BlockExpression:
            return {
                ...tree,
                block: newChildren
            }
        case NodeKind.IfThenElse:
            return {
                ...tree,
                condition: newChildren[0],
                then: newChildren[1],
                else: newChildren[2]
            }
        case NodeKind.Loop:
            return {
                ...tree,
                body: newChildren
            }
        case NodeKind.Switch:
            return {
                ...tree,
                target: newChildren[0],
                cases: newChildren.slice(1) as SwitchCase[]
            }
        case NodeKind.SwitchCase: {
            const sep = tree.expressions.length
            return {
                ...tree,
                expressions: newChildren.slice(0, sep),
                body: newChildren.slice(sep)
            }
        }
        case NodeKind.Break:
        case NodeKind.BreakIndexed:
        case NodeKind.Continue:
            return { ...tree }
        case NodeKind.Return:
            return { ...tree, value: newChildren[0] }
        case NodeKind.Literal:
            return { ...tree }
        case NodeKind.StructLit:
            return { ...tree, body: newChildren }
        case NodeKind.ArrayLit:
            return { ...tree, values: newChildren }
        case NodeKind.Field:
            return { ...tree, value: newChildren[0] }
        case NodeKind.Reference:
            return { ...tree }
        case NodeKind.Select:
        case NodeKind.Spread:
            return { ...tree, target: newChildren[0] }
        case NodeKind.Index:
            return { ...tree, target: newChildren[0], index: newChildren[1] }
        case NodeKind.FieldRef:
            return { ...tree, target: newChildren[0] }
        case NodeKind.Assign:
            return { ...tree, target: newChildren[0], value: newChildren[1] }
        case NodeKind.Function: {
            const len = tree.parameters.length
            return {
                ...tree,
                parameters: newChildren.slice(0, len) as Parameter[],
                result: newChildren[len],
                body: newChildren.slice(len + 1)
            }
        }
        case NodeKind.Parameter:
            return { ...tree, type: newChildren[0] }
        case NodeKind.Call:
            return {
                ...tree,
                target: newChildren[0],
                arguments: newChildren.slice(1)
            }
        case NodeKind.Let:
        case NodeKind.Var:
            return {
                ...tree,
                type: tree.type ? newChildren[0] : undefined,
                value: tree.type ? newChildren[1] : newChildren[0]
            }
        case NodeKind.Type:
            return { ...tree, type: newChildren[0] }
        case NodeKind.StructTypeLit:
            return { ...tree, fields: newChildren as StructField[] }
        case NodeKind.StructField:
            return { ...tree, type: newChildren[0] }
        case NodeKind.ArrayCtor:
            return { ...tree, element: newChildren[0] }
        case NodeKind.PointerCtor:
            return { ...tree, target: newChildren[0] }
        case NodeKind.Import:
            return { ...tree, imports: newChildren as ImportFunction[] }
        case NodeKind.ImportFunction: {
            const len = tree.parameters.length
            return {
                ...tree,
                parameters: newChildren.slice(0, len) as Parameter[],
                result: newChildren[len]
            }
        }
    }
}

function error(location: Locatable, message: string): never {
    const e = new Error(message) as any
    e.pposition = location.start
    throw e
}