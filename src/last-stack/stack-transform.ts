import { FileSet } from "../files";
import {
    BodyElement,
    CheckDiagnosticCode, CheckResult, copy, Declaration, Definition, Exportable, Expression, FieldLiteral, Function,
    isBodyElement, isExpression, Last, LastKind, Module, nameOfLastKind, Parameter, PrimitiveKind, Reference, Return, Type, TypeExpression, TypeKind, Var
} from "../last";
import { parse, Scanner } from "../last-parser";
import { lastToText } from "../last-text/text";
import { childrenOf, Separator, updateFromChildren } from "../last-transform";
import { error, required } from "../utils";

interface Context {
    variable: string
    fields: FieldLiteral[]
}

export function transform(module: Module, checkResult: CheckResult, fileSet?: FileSet): Module {
    let counter = 0
    const moveToStack = new Set<Var | Parameter>()
    const definitions: Definition[] = []
    for (const diagnostic of checkResult.diagnostics) {
        switch (diagnostic.code) {
            case CheckDiagnosticCode.NotAnAddress: {
                const node = diagnostic.location as Last
                if ('kind' in node && node.kind == LastKind.Reference) {
                    const target = checkResult.references.get(node)
                    if (target && target.node) {
                        definitions.push(target)
                        const targetNode = target.node
                        switch (targetNode.kind) {
                            case LastKind.Var:
                            case LastKind.Parameter:
                                moveToStack.add(targetNode)
                        }
                    }
                }
                break
            }
            case CheckDiagnosticCode.InvalidGlobalOrLocalType: {
                const node = diagnostic.location as Last
                if ('kind' in node && node.kind == LastKind.Var) {
                    moveToStack.add(node)
                    definitions.push(required(checkResult.definitions.find(def => def.node == node)))
                }
                break
            }
        }
    }

    const rootContext: Context = { variable: '', fields: [] }
    if (moveToStack.size == 0) return module

    const moveReferences = new Set<Reference>()
    for (const definition of definitions) {
        for (const reference of definition.references) {
            moveReferences.add(reference)
        }
    }

    const declarations = txDeclarations(module.declarations, rootContext)
    if (declarations !== module.declarations) {
        const stackHelpers = helpers(fileSet)
        declarations.unshift(...stackHelpers.declarations)
    }
    return copy(module, { declarations })

    function typeOf(node: Last): Type {
        return required(checkResult.types.get(node))
    }

    function txDeclarations(declarations: Declaration[], context: Context): Declaration[] {
        return updateArray(declarations, child => txDeclaration(child, context))
    }

    function txDeclaration(node: Declaration, context: Context): Declaration {
        switch (node.kind) {
            case LastKind.Let:
            case LastKind.Type:
            case LastKind.Var:
                return node
            case LastKind.Exported:
                return update(node, { target: txExportable(node.target, context) } )
            case LastKind.Function:
            case LastKind.Global:
                return txExportable(node, context)
        }
        return node
    }

    function txExportable(node: Exportable, context: Context): Exportable {
        switch (node.kind) {
            case LastKind.Global:
                return node
            case LastKind.Function:
                return txFunction(node, context)
        }
    }


    function txFunction(node: Function, context: Context): Function {
        const functionContext: Context = { variable: unique(), fields: [] }
        for (const parameter of node.parameters) {
            if (moveToStack.has(parameter)) {
                functionContext.fields.push({
                    kind: LastKind.FieldLiteral,
                    name: ref(parameter.name.name),
                    type: parameter.type
                })
            }
        }
        const body = txBodyElements(node.body, functionContext)
        if (functionContext.fields.length > 0) {
            // Allocate a context
            const prefix: BodyElement[] = []
            const type: TypeExpression = {
                kind: LastKind.StructTypeLiteral,
                fields: functionContext.fields
            }
            prefix.push({
                kind: LastKind.Type,
                name: ref("$$stack-context-type"),
                type
            })
            prefix.push({
                kind: LastKind.Var,
                name: ref(functionContext.variable),
                type: {
                    kind: LastKind.PointerConstructor,
                    target: ref("$$stack-context-type")
                },
                value: {
                    kind: LastKind.ReinterpretAs,
                    left: {
                        kind: LastKind.Call,
                        target: ref("$$stack-alloc"),
                        arguments: [
                            {
                                kind: LastKind.SizeOf,
                                target: ref("$$stack-context-type")
                            }
                        ]
                    },
                    right: {
                        kind: LastKind.PointerConstructor,
                        target: ref('$$stack-context-type')
                    }
                }
            })

            // Initialize the parameters that are moved
            for (const parameter of node.parameters) {
                if (moveToStack.has(parameter)) {
                    prefix.push({
                        kind: LastKind.Assign,
                        target: contextRef(functionContext, parameter.name.name),
                        value: ref(parameter.name.name)
                    })
                }
            }
            body.unshift(...prefix)
            if (!lastIsReturn(body)) {
                if (lastIsExpression(body)) {
                    const last = required(body.pop())
                    body.push(releaseContext(functionContext))
                    body.push(last)
                } else {
                    body.push(releaseContext(functionContext))
                }
            }
            return copy(node, { body })
        }
        return node
    }

    function lastIsReturn(body: BodyElement[]): boolean {
        const last = body[body.length - 1]
        if (last) {
            switch (last.kind) {
                case LastKind.Return: return true
                case LastKind.Block: return lastIsReturn(last.body)
            }
        }
        return false
    }

    function lastIsExpression(body: BodyElement[]): boolean {
        const last = body[body.length - 2]
        return last && isExpression(last)
    }

    function txBodyElements(nodes: BodyElement[], context: Context): BodyElement[] {
        return updateArray(nodes, child => txBodyElement(child, context))
    }

    function txBodyElement(node: BodyElement, context: Context): BodyElement | BodyElement[] {
        switch (node.kind) {
            case LastKind.Block:
            case LastKind.Loop: {
                const body = txBodyElements(node.body, context)
                return update(node, { body })
            }
            case LastKind.IfThenElse: {
                const condition = txExpression(node.condition, context)
                const then = txBodyElements(node.then, context)
                const else_ = txBodyElements(node.else, context)
                return update(node, { condition, then, else: else_ })
            }
            case LastKind.Let:
            case LastKind.Type:
            case LastKind.BranchIndexed:
                return node
            case LastKind.Var:
                if (moveToStack.has(node)) {
                    const type = node.type ?? typeToTypeExpression(typeOf(node))
                    context.fields.push({
                        kind: LastKind.FieldLiteral,
                        name: ref(node.name.name),
                        type
                    })
                    if (node.value) {
                        return {
                            kind: LastKind.Assign,
                            target: contextRef(context, node.name.name),
                            value: node.value
                         }
                    }
                    return []
                }
                if (node.value) {
                    const value = txExpression(node.value, context)
                    return update(node, { value })
                }
                return node
            case LastKind.Assign: {
                const target = txExpression(node.target, context)
                const value = txExpression(node.value, context)
                return update(node, { target, value })
            }
            case LastKind.Branch:
                return node
            case LastKind.Return:
                // We can unconditionally release here the context here as if we don't end up
                // having the context we don't end up throwing the transformed tree away and
                // this node is not used.
                const value = node.value && txExpression(node.value, context);
                if (value) {
                    const tmpName = unique()
                    const newValue: Expression = {
                        kind: LastKind.Block,
                        body: [
                            {
                                kind: LastKind.Var,
                                name: ref(tmpName),
                                value
                            },
                            releaseContext(context),
                            ref(tmpName)
                        ]
                    }
                    return update(node, { value: newValue })
                }
                return [
                    releaseContext(context),
                    node
                ]
            default:
                return txExpression(node, context)
        }
    }

    function txExpression(node: Expression, context: Context): Expression {
        if (node.kind == LastKind.Reference) {
            if (moveReferences.has(node)) {
                return contextRef(context, node.name)
            }
        }
        const updatedChildren: (Last | Separator)[] = []
        for (const child of childrenOf(node)) {
            if (child instanceof Separator) {
                updatedChildren.push(child)
            } else {
                if (isBodyElement(child)) {
                    const updatedChild = txBodyElement(child, context)
                    if (Array.isArray(updatedChild)) updatedChildren.push(...updatedChild)
                    else updatedChildren.push(updatedChild)
                } else {
                    updatedChildren.push(child)
                }
            }
        }
        return updateFromChildren(node, updatedChildren) as Expression
    }

    function unique(prefix: string = "$stack") {
        return `${prefix}-${counter++}`
    }

    function ref(name: string): Reference {
        return { kind: LastKind.Reference, name }
    }

    function contextRef(context: Context, name: string): Expression {
        return {
            kind: LastKind.Select,
            target:  {
                kind: LastKind.Dereference,
                target: ref(context.variable)
            },
            name: ref(name)
        }
    }

    function releaseContext(context: Context): BodyElement {
        return {
            kind: LastKind.Call,
            target: ref("$$stack-release"),
            arguments: [
                {
                    kind: LastKind.ReinterpretAs,
                    left: ref(context.variable),
                    right: {
                        kind: LastKind.PointerConstructor,
                        target: {
                            kind: LastKind.Primitive,
                            primitive: PrimitiveKind.Void
                        }
                    }
                },
                {
                    kind: LastKind.SizeOf,
                    target: ref('$$stack-context-type')
                }
            ]
        }
    }
}

function update<T extends Last>(original: T, overrides: Partial<T>): T {
    for (const name in overrides) {
        if (overrides[name] !== original[name]) {
            return copy(original, overrides)
        }
    }
    return original
}

function updateArray<T extends Last>(original: T[], updater: (node: T) => T | T[]): T[] {
    let allEquals = true
    let updated: T[] = []
    original.forEach(child => {
        const updatedChild = updater(child)
        allEquals = allEquals && updatedChild === child
        if (Array.isArray(updatedChild)) updated.push(...updatedChild)
        else updated.push(updatedChild)
    })
    return allEquals ? original : updated
}

function typeToTypeExpression(type: Type): TypeExpression {
    function ref(name: string): Reference {
        return { kind: LastKind.Reference, name }
    }

    switch (type.kind) {
        case TypeKind.I8: return { kind: LastKind.Primitive, primitive: PrimitiveKind.I8 }
        case TypeKind.I16: return { kind: LastKind.Primitive, primitive: PrimitiveKind.I16 }
        case TypeKind.I32: return { kind: LastKind.Primitive, primitive: PrimitiveKind.I32 }
        case TypeKind.I64: return { kind: LastKind.Primitive, primitive: PrimitiveKind.I64 }
        case TypeKind.U8: return { kind: LastKind.Primitive, primitive: PrimitiveKind.U8 }
        case TypeKind.U16: return { kind: LastKind.Primitive, primitive: PrimitiveKind.U16 }
        case TypeKind.U32: return { kind: LastKind.Primitive, primitive: PrimitiveKind.U32 }
        case TypeKind.U64: return { kind: LastKind.Primitive, primitive: PrimitiveKind.U64 }
        case TypeKind.F32: return { kind: LastKind.Primitive, primitive: PrimitiveKind.F32 }
        case TypeKind.F64: return { kind: LastKind.Primitive, primitive: PrimitiveKind.F64 }
        case TypeKind.Boolean: return { kind: LastKind.Primitive, primitive: PrimitiveKind.Bool }
        case TypeKind.Null: return { kind: LastKind.Primitive, primitive: PrimitiveKind.Null }
        case TypeKind.Void: return { kind: LastKind.Primitive, primitive: PrimitiveKind.Void }
        case TypeKind.Array:
            return {
                kind: LastKind.ArrayConstructor,
                element: typeToTypeExpression(type.elements),
                size: type.size
            }
        case TypeKind.Struct:
            if (type.name)
                return ref(type.name)
            else
                return {
                    kind: LastKind.StructTypeLiteral,
                    fields: type.fields.map((name, type) => {
                        return {
                            kind: LastKind.FieldLiteral,
                            name: ref(name),
                            type: typeToTypeExpression(type)
                        }
                    })
                }
        case TypeKind.Union:
            if (type.name)
                return ref(type.name)
            else
                return {
                    kind: LastKind.UnionTypeLiteral,
                    fields: type.fields.map((name, type) => {
                        return {
                            kind: LastKind.FieldLiteral,
                            name: ref(name),
                            type: typeToTypeExpression(type)
                        }
                    })
                }
        case TypeKind.Pointer:
            return { kind: LastKind.PointerConstructor, target: typeToTypeExpression(type.target) }
        case TypeKind.Location:
            return typeToTypeExpression(type.type)
        case TypeKind.Memory:
        case TypeKind.Error:
        case TypeKind.Unknown:
        case TypeKind.Function:
            error("Cannot convert type to type expression")
    }
}

function helpers(fileSet?: FileSet): Module {
    const helpersText = `
    var stack: u8[131072];
    var tos: void^ = &stack[0] reinterpretas void^;

    fun alloc(size: i32): void^ {
        var current = tos;
        tos = &((tos reinterpretas u8[]^)^[size]) reinterpretas void^;
        return current;
    }

    fun release(ptr: void^, size: i32): void {
        tos = &((tos reinterpretas u8[]^)^[-size]) reinterpretas void^;
    }
    `
    .replace(/stack/g, "`$$$$stack`")
    .replace(/tos/g, "`$$$$tos`")
    .replace(/alloc/g, "`$$$$stack-alloc`")
    .replace(/release/g, "`$$$$stack-release`");

    const helperPositions = fileSet?.buildFile("helpers", helpersText.length)
    const scanner = new Scanner(helpersText, helperPositions)
    const helperModule = parse(scanner)
    helperPositions?.build()
    if (Array.isArray(helperModule)) {
        error(`Invalid helpers module: ${helperModule}`)
    }
    return helperModule
}