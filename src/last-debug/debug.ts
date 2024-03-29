import {
    BodyElement, Call, copy, Declaration, Exportable, Expression, Function, Last, LastKind, LiteralI32, PrimitiveKind,
    Module, Parameter, Reference, Return, Primitive
} from '../last'
import { childrenOf, Separator, updateFromChildren } from './children'

export function transform(module: Module): Module {
    let counter = 0
    const imports = module.imports.slice(0)
    imports.push({
        kind: LastKind.Import,
        imports: [
            {
                kind: LastKind.ImportFunction,
                module: ref('debug-host'),
                name: ref('statement'),
                as: ref('$$stmt'),
                parameters: [ p('location', PrimitiveKind.I32)],
                result: prim(PrimitiveKind.Void)
            },
            {
                kind: LastKind.ImportFunction,
                module: ref('debug-host'),
                name: ref('functionStart'),
                as: ref('$$start'),
                parameters: [ p('location', PrimitiveKind.I32) ],
                result: prim(PrimitiveKind.Void)
            },
            {
                kind: LastKind.ImportFunction,
                module: ref('debug-host'),
                name: ref('functionEnd'),
                as: ref('$$end'),
                parameters: [ p('location', PrimitiveKind.I32) ],
                result: prim(PrimitiveKind.Void)
            }
        ]
    })

    const declarations = txDeclarations(module.declarations)

    return copy(module, { imports, declarations })

    function ref(name: string): Reference {
        return { kind: LastKind.Reference, name }
    }

    function prim(primitive: PrimitiveKind): Primitive {
        return { kind: LastKind.Primitive, primitive }
    }

    function p(name: string, type: string | PrimitiveKind ): Parameter {
        return {
            kind: LastKind.Parameter,
            name: ref(name),
            type: typeof type == "string" ? ref(type) : prim(type)
        }
    }

    function i(value: number): LiteralI32 {
        return {
            kind: LastKind.Literal,
            primitiveKind: PrimitiveKind.I32,
            value
        }
    }

    function unique(prefix: string = "tmp") {
        return `${prefix}-${counter++}`
    }

    function call(name: '$$stmt' | '$$start' | '$$end', location: number): Call {
        return {
            kind: LastKind.Call,
            target: ref(name),
            arguments: [ i(location) ]
        }
    }

    function txDeclarations(declarations: Declaration[]): Declaration[] {
        return declarations.map(txDeclaration)
    }

    function txDeclaration(declaration: Declaration): Declaration {
        switch (declaration.kind) {
            case LastKind.Let:
            case LastKind.Type:
            case LastKind.Var:
            case LastKind.ExportedMemory:
                    return declaration
            case LastKind.Global:
            case LastKind.Function:
                return txExportable(declaration)
            case LastKind.Exported:
                return copy(declaration, { target: txExportable(declaration.target) })
        }
    }

    function txExportable(exportable: Exportable): Exportable {
        switch (exportable.kind) {
            case LastKind.Global:
                return exportable
            case LastKind.Function:
                return txFunction(exportable)
        }
    }

    function txFunction(func: Function): Function {
        const endLocation = func.start
        const body = txBodyElements(func.body, undefined, endLocation)
        if (endLocation) {
            const l = body.length
            if (l > 0) {
                const last = body[l - 1]
                if (isExpression(last) && !isSimple(last)) {
                    const tmp = unique('tmp')
                    body.pop()
                    body.push(
                        {
                            kind: LastKind.Var,
                            name: ref(tmp),
                            value: last
                        },
                        call('$$end', endLocation),
                        ref(tmp)
                    )
                } else {
                    body.pop()
                    body.push(call('$$end', endLocation))
                    body.push(last)
                }
            } else {
                body.push(call('$$end', endLocation))
            }
            body.unshift(call('$$start', endLocation))
        }
        return copy(func, { body })
    }

    function txBodyElements(elements: BodyElement[], outerBlock: string | undefined, endLocation: number | undefined): BodyElement[] {
        const result: BodyElement[] = []
        elements.forEach(element => {
            if (element.start) result.push(call('$$stmt', element.start))
            const txElement = txBodyElement(element, outerBlock, endLocation)
            if (Array.isArray(txElement)) {
                result.push(...txElement)
            } else {
                result.push(txElement)
            }
        })
        return result
    }

    function txBodyElement(element: BodyElement, outerBlock: string | undefined, endLocation: number | undefined): BodyElement | BodyElement[] {
        switch (element.kind) {
            case LastKind.Block:
            case LastKind.Loop: {
                const name = element.name ?? ref(unique('block'))
                const body = txBodyElements(element.body, name.name, endLocation)
                return copy(element, { name, body })
            }
            case LastKind.IfThenElse: {
                const condition = txExpression(element.condition, outerBlock, endLocation)
                const then = txBodyElements(element.then, outerBlock, endLocation)
                const else_ = txBodyElements(element.else, outerBlock, endLocation)
                return copy(element, { condition, then, else: else_ })
            }
            case LastKind.Let:
            case LastKind.Type:
            case LastKind.BranchIndexed:
            case LastKind.Var:
                return element
            case LastKind.Assign: {
                const target = txExpression(element.target, outerBlock, endLocation)
                const value = txExpression(element.value, outerBlock, endLocation)
                if (target !== element.target || value !== element.value) {
                    element = copy(element, { target, value })
                }
                return element
            }
            case LastKind.Branch:
                if (element.target || !outerBlock) {
                    return element
                } else {
                    return copy(element, { target: ref(outerBlock) })
                }
            case LastKind.Return:
                if (endLocation && element.start) {
                    if (element.value && !isSimple(element.value)) {
                        const tmp = unique('tmp')
                        return [
                            call('$$stmt', element.start),
                            {
                                kind: LastKind.Var,
                                name: ref(tmp),
                                value: element.value
                            },
                            call('$$end', endLocation),
                            {
                                kind: LastKind.Return,
                                value: ref(tmp)
                            }
                        ]
                    } else {
                        return [
                            call('$$stmt', element.start),
                            call('$$end', endLocation),
                            element
                        ]
                    }
                }
                return element
            default: {
                return txExpression(element, outerBlock, endLocation)
            }
        }
    }

    function txExpression(node: Expression, outerBlock: string | undefined, endLocation: number | undefined): Expression {
        const updatedChildren: (Last | Separator)[] = []
        for (const child of childrenOf(node)) {
            if (child instanceof Separator) {
                updatedChildren.push(child)
            } else {
                switch (child.kind) {
                    case LastKind.Block:
                    case LastKind.IfThenElse:
                    case LastKind.Loop:
                        const elements = txBodyElement(child, outerBlock, endLocation)
                        if (Array.isArray(elements)) {
                            updatedChildren.push(...elements)
                        } else {
                            updatedChildren.push(elements)
                        }
                        break
                    default:
                        updatedChildren.push(child)
                }
            }
        }
        return updateFromChildren(node, updatedChildren) as Expression
    }

}
function isSimple(node: Expression): boolean {
    switch (node.kind) {
        case LastKind.Add:
        case LastKind.Subtract:
        case LastKind.Divide:
        case LastKind.Multiply:
        case LastKind.Remainder:
        case LastKind.NotEqual:
        case LastKind.Equal:
        case LastKind.GreaterThan:
        case LastKind.GreaterThanEqual:
        case LastKind.LessThan:
        case LastKind.LessThanEqual:
        case LastKind.Or:
        case LastKind.And:
        case LastKind.BitAnd:
        case LastKind.BitOr:
        case LastKind.BitRotl:
        case LastKind.BitRotr:
        case LastKind.BitShl:
        case LastKind.BitShr:
        case LastKind.BitXor:
            return isSimple(node.left) && isSimple(node.right)
        case LastKind.Negate:
        case LastKind.Not:
        case LastKind.AddressOf:
        case LastKind.BitNot:
            return isSimple(node.target)
        case LastKind.SizeOf:
        case LastKind.Literal:
        case LastKind.Reference:
            return true
    }
    return false
}

function isExpression(node: BodyElement): node is Expression {
    switch (node.kind) {
        case LastKind.Let:
        case LastKind.Var:
        case LastKind.Let:
        case LastKind.Type:
        case LastKind.Loop:
        case LastKind.Branch:
        case LastKind.BranchIndexed:
        case LastKind.Return:
        case LastKind.Assign:
            return false
    }
    return true
}

