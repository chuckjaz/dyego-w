import { ArrayLiteral, Assign, Block, Call, ComputedBranch, Definition, Expression, FieldLiteral, For, Function, If, Index, IrKind, IrNode, Module, Reference, Return, Select, Statement, StructLiteral, While } from "./ir"

export function transformer(visitor: <N extends IrNode>(node: N) => N | undefined): (module: Module) => Module {
    const convertReference = (node: Reference) => visitor(node) ?? node
    const convertStatements = arrayConverter(convertStatement)
    const convertArrayLiteral = converter<ArrayLiteral>({ values: arrayConverter(convertExpression) })
    const convertAssign = converter<Assign>({ target: convertExpression, value: convertExpression })
    const convertBlock = converter<Block>({ statements: convertStatements })
    const convertCall = converter<Call>({ target: convertExpression, args: arrayConverter(convertExpression) })
    const convertComputedBranch = converter<ComputedBranch>({ target: convertExpression, branches: arrayConverter(convertMaybeExpression) })
    const convertIf = converter<If>({ condition: convertExpression, then: convertBlock, else: convertBlock })
    const convertIndex = converter<Index>({ target: convertExpression, index: convertExpression })
    const convertSelect = converter<Select>({ target: convertExpression, name: convertReference })
    const convertFieldLiteral = converter<FieldLiteral>( { value: convertExpression })
    const convertStructLiteral = converter<StructLiteral>({ fields: arrayConverter(convertFieldLiteral)} )
    const convertDefinition = converter<Definition>({ name: convertReference })
    const convertFor = converter<For>({ index: convertReference, initialize: convertExpression, advance: convertExpression  })
    const convertReturn = converter<Return>({ value: convertExpression })
    const convertWhile = converter<While>({ condition: convertExpression, body: convertBlock })
    const convertFunction = converter<Function>({
        name: convertReference,
        parameters: arrayConverter(convertReference),
        body: convertBlock
    })
    const convertModule = converter<Module>({
        functions: arrayConverter(convertFunction),
        initialize: convertBlock
    })

    return (module: Module) => convertModule(module)

    function convertExpression(expression: Expression): Expression {
        switch (expression.kind) {
            case IrKind.ArrayLiteral: return convertArrayLiteral(expression)
            case IrKind.Block: return convertBlock(expression)
            case IrKind.Call: return convertCall(expression)
            case IrKind.ComputedBranch: return convertComputedBranch(expression)
            case IrKind.If: return convertIf(expression)
            case IrKind.Index: return convertIndex(expression)
            case IrKind.Select: return convertSelect(expression)
            case IrKind.StructLiteral: return convertStructLiteral(expression)
            case IrKind.Literal:
            case IrKind.Nothing:
            case IrKind.Reference:
                return visitor(expression) ?? expression
        }
    }

    function convertMaybeExpression(expression: Expression | undefined): Expression | undefined {
        return expression ? convertExpression(expression) : undefined
    }

    function convertStatement(statement: Statement): Statement {
        switch (statement.kind) {
            case IrKind.Assign: return convertAssign(statement)
            case IrKind.Break:
            case IrKind.Continue:
                return visitor(statement) ?? statement
            case IrKind.Definition: return convertDefinition(statement)
            case IrKind.For: return convertFor(statement)
            case IrKind.Return: return convertReturn(statement)
            case IrKind.While: return convertWhile(statement)
            default: return convertExpression(statement)
        }
    }

    function converter<N extends IrNode>(mappers: Mapper<N>): (node: N) => N {
        return (node: N) => {
            const mapped: Partial<N> = { }
            let changed = false
            for (const field in mappers) {
                const mapper = mappers[field]
                if (mapper) {
                    const value = node[field]
                    const newValue = mapper(node[field])
                    changed = changed || value !== newValue
                    mapped[field] = newValue
                }
            }
            const newNode = { ...node, ...mapped }
            return changed ? visitor(newNode) ?? newNode : node
        }
    }
}

function arrayConverter<E>(convert: (value: E) => E): (values: E[]) => E[] {
    return nodes => {
        const result: E[] = []
        let changes = false
        for (const node of nodes) {
            const newNode = convert(node)
            result.push(newNode)
            changes = changes || newNode != node
        }
        return changes ? result : nodes
    }
}

type Mapper<Type> = { [Property in keyof Type]?: ((value: Type[Property]) => Type[Property]) }
type Partial<Type> = { [Property in keyof Type]?: Type[Property] }
