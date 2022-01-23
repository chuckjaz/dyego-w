import {
    BodyElement, Declaration, Diagnostic, Exportable, Expression, Field, Import, ImportItem, Last, LastKind,
    LiteralBigInt, LiteralKind, LiteralNumeric, Locatable, Module, nameOfLastKind, Parameter, Reference,
    StructFieldLiteral, TypeExpression
} from "../last";

export function validate(module: Module): Diagnostic[] {
    const diagnostics: Diagnostic[] = []
    try {
        validateModule(module)
    } catch (e: any) {
        report(e.location ?? module, e.message)
    }
    return diagnostics

    function validateModule(module: Module) {
        requiredKind(module, LastKind.Module)
        requiredMembers(module, 'imports', 'declarations')
        validateArray(module, 'imports', module.imports, validateImport)
        validateArray(module, 'declarations', module.declarations, validateDeclaration)
    }

    function validateImport(importNode: Import) {
        requiredKind(importNode, LastKind.Import)
        requiredMembers(importNode, 'imports')
        validateArray(importNode, 'imports', importNode.imports, validateImportItem)
    }

    function validateImportItem(importItem: ImportItem) {
        requiredMembers(importItem, 'module', 'name')
        validateReference(importItem.module)
        validateReference(importItem.name)
        if (importItem.as !== undefined) validateReference(importItem.as)
        switch (importItem.kind) {
            case LastKind.ImportFunction:
                requiredMembers(importItem, 'parameters', 'result')
                validateArray(importItem, 'parameters', importItem.parameters, validateParameter)
                validateTypeExpression(importItem.result)
                break
            case LastKind.ImportVariable:
                requiredMembers(importItem, 'type')
                validateTypeExpression(importItem.type)
                break
            default:
                fatal(importItem, "Expected and ImportItem")
        }
    }

    function validateReference(reference: Reference) {
        requiredKind(reference, LastKind.Reference)
        requiredMembers(reference, 'name')
        required(reference, typeof reference.name === "string", "Expecgted name to be a string")
    }

    function validateTypeExpression(type: TypeExpression) {
        switch (type.kind) {
            case LastKind.Reference:
                validateReference(type)
                break
            case LastKind.TypeSelect:
                requiredMembers(type, 'target', 'name')
                validateTypeExpression(type.target)
                validateReference(type.name)
                break
            case LastKind.StructTypeLiteral:
                requiredMembers(type, 'fields')
                validateArray(type, 'fields', type.fields, validateStructFieldLiteral)
                break
            case LastKind.ArrayConstructor:
                requiredMembers(type, 'element')
                if (type.size !== undefined) {
                    required(type, typeof type.size === "number", "Expected size to be a number")
                }
                break
            case LastKind.PointerConstructor:
                requiredMembers(type, 'target')
                validateTypeExpression(type.target)
                break
            default:
                fatal(type, "Expected a TypeExpression")
        }
    }

    function validateStructFieldLiteral(field: StructFieldLiteral) {
        requiredKind(field, LastKind.StructFieldLiteral)
        requiredMembers(field, 'name', 'type')
        validateReference(field.name)
        validateTypeExpression(field.type)
    }

    function validateParameter(parameter: Parameter) {
        requiredKind(parameter, LastKind.Parameter)
        requiredMembers(parameter, 'name', 'type')
        validateReference(parameter.name)
        validateTypeExpression(parameter.type)
    }

    function validateDeclaration(declaration: Declaration) {
        switch (declaration.kind) {
            case LastKind.Let:
                requiredMembers(declaration, 'name', 'type', 'value')
                validateReference(declaration.name)
                validateTypeExpression(declaration.type)
                validateExpression(declaration.value)
                break
            case LastKind.Var:
                requiredMembers(declaration, 'name', 'type')
                validateReference(declaration.name)
                validateTypeExpression(declaration.type)
                if (declaration.value) {
                    validateExpression(declaration.value)
                }
                break
            case LastKind.Type:
                requiredMembers(declaration, 'name', 'type')
                validateReference(declaration.name)
                validateTypeExpression(declaration.type)
                break
            case LastKind.Function:
            case LastKind.Global:
                validateExportable(declaration)
                break
            case LastKind.Exported:
                requiredMembers(declaration, 'target')
                validateExportable(declaration.target)
                break
            default:
                fatal(declaration, "Expected a Declration")
        }
    }

    function validateExportable(node: Exportable) {
        switch (node.kind) {
            case LastKind.Global:
                requiredMembers(node, 'name', 'type', 'value')
                validateReference(node.name)
                validateTypeExpression(node.type)
                validateExpression(node.value)
                break
            case LastKind.Function:
                requiredMembers(node, 'name', 'parameters', 'result', 'body')
                validateReference(node.name)
                validateArray(node, 'parameters', node.parameters, validateParameter)
                validateTypeExpression(node.result)
                validateArray(node, 'body', node.body, validateBodyElement)
                break
            default:
                fatal(node, "Expected an Exportable")
        }
    }

    function validateExpression(node: Expression) {
        switch (node.kind) {
            case LastKind.Add:
            case LastKind.Subtract:
            case LastKind.Multiply:
            case LastKind.Divide:
            case LastKind.Remainder:
            case LastKind.Equal:
            case LastKind.NotEqual:
            case LastKind.GreaterThan:
            case LastKind.GreaterThanEqual:
            case LastKind.LessThan:
            case LastKind.LessThanEqual:
            case LastKind.And:
            case LastKind.Or: {
                requiredMembers(node, 'left', 'right')
                validateExpression(node.left)
                validateExpression(node.right)
                break
            }
            case LastKind.Negate:
            case LastKind.Not:
            case LastKind.AddressOf:
            case LastKind.Dereference: {
                requiredMembers(node, 'target')
                validateExpression(node.target)
                break
            }
            case LastKind.As: {
                requiredMembers(node, 'left', 'right')
                validateExpression(node.left)
                validateTypeExpression(node.right)
                break
            }
            case LastKind.SizeOf: {
                requiredMembers(node, 'target')
                validateTypeExpression(node.target)
                break
            }
            case LastKind.Literal: {
                requiredMembers(node, 'literalKind', 'value')
                switch (node.literalKind) {
                    case LiteralKind.Int8:
                        validateNumericRange(node, -128, 127)
                        break
                    case LiteralKind.UInt8:
                        validateNumericRange(node, 0, 255)
                        break
                    case LiteralKind.Int16:
                        validateNumericRange(node, -32768, 32767)
                        break
                    case LiteralKind.UInt16:
                        validateNumericRange(node, 0, 65535)
                        break
                    case LiteralKind.Int32:
                        validateNumericRange(node, -2147483648, 2147483647)
                        break
                    case LiteralKind.UInt32:
                        validateNumericRange(node, 0, (1 >> 32) - 1)
                        break
                    case LiteralKind.Int64:
                        validateBigIntRange(node, -(1n << 63n), (1n << 63n) - 1n)
                        break
                    case LiteralKind.UInt64:
                        validateBigIntRange(node, 0n, (1n << 64n) - 1n)
                        break
                    case LiteralKind.Boolean:
                        required(node, typeof node.value === "boolean", "Expected value to be a boolena")
                        break
                    case LiteralKind.Null:
                        required(node, node.value === null, "Expected value to be null")
                        break
                    case LiteralKind.Float32:
                    case LiteralKind.Float64:
                        required(node, typeof node.value === "number", "Expected value to be a number")
                        break
                    default:
                        fatal(node, "Unknown literalKind")
                }
                break
            }
        case LastKind.StructLiteral:
            requiredMembers(node, 'fields')
            validateArray(node, 'fields', node.fields, validateField)
            break
        case LastKind.ArrayLiteral:
            requiredMembers(node, 'values')
            validateArray(node, 'values', node.values, validateExpression)
            break
        case LastKind.Reference:
            validateReference(node)
            break
        case LastKind.Select:
            requiredMembers(node, 'target', 'name')
            validateExpression(node.target)
            validateReference(node.name)
            break
        case LastKind.Index:
            requiredMembers(node, 'target', 'index')
            validateExpression(node.target)
            validateExpression(node.index)
            break
        case LastKind.Call:
            requiredMembers(node, 'target', 'arguments')
            validateExpression(node.target)
            validateArray(node, 'arguments', node.arguments, validateExpression)
            break
        case LastKind.Block:
        case LastKind.IfThenElse:
            validateBodyElement(node)
            break
        default:
            fatal(node, "Expected an Expression")
        }
    }

    function validateNumericRange(node: Last & LiteralNumeric, min: number, max: number) {
        const value = node.value
        required(node, typeof value === "number", "Expected value to be a number")
        required(node, min <= value && value <= max, "Litearal out of range")
    }

    function validateBigIntRange(node: Last & LiteralBigInt, min: bigint, max: bigint) {
        const value = node.value
        required(node, typeof value === "bigint", "Expected value to be a bigint")
        required(node, min <= value && value <= max, "Literal out of range")
    }

    function validateField(node: Field) {
        requiredKind(node, LastKind.Field)
        requiredMembers(node, 'name', 'value')
        validateReference(node.name)
        validateExpression(node.value)
    }

    function validateBodyElement(node: BodyElement) {
        switch (node.kind) {
            case LastKind.Let:
            case LastKind.Var:
            case LastKind.Type:
                validateDeclaration(node)
                break
            case LastKind.Loop:
            case LastKind.Block:
                requiredMembers(node, 'body')
                if (node.name !== undefined) validateReference(node.name)
                validateArray(node, 'body', node.body, validateBodyElement)
                break
            case LastKind.IfThenElse:
                requiredMembers(node, 'condition', 'then', 'else')
                validateExpression(node.condition)
                validateArray(node, 'then', node.then, validateBodyElement)
                validateArray(node, 'else', node.else, validateBodyElement)
                break
            case LastKind.Assign:
                requiredMembers(node, 'target', 'value')
                validateExpression(node.target)
                validateExpression(node.value)
                break
            case LastKind.Branch:
                requiredMembers(node)
                if (node.target) validateReference(node.target)
                break
            case LastKind.BranchIndexed:
                requiredMembers(node, 'condition', 'targets', 'else')
                validateExpression(node.condition)
                validateArray(node, 'targets', node.targets, validateReference)
                validateReference(node.else)
                break
            case LastKind.Return:
                requiredMembers(node)
                if (node.value) validateExpression(node.value)
                break
            default:
                validateExpression(node)
                break
        }
    }

    function validateArray<T>(location: Locatable, name: string, items: T[], validator: (item: T) => void) {
        required(location, Array.isArray(items), `Expected ${name} to be an an array`)
        items.forEach(validator)
    }

    function requiredKind(last: Last, kind: LastKind) {
        if (last.kind !== kind) fatal(last, `Expected a node of kind ${nameOfLastKind(kind)}`)
    }

    function requiredMembers(last: Last, ...members: string[]) {
        for (const member of members) {
            if (!(member in last) || (last as any)[member] === undefined) {
                fatal(last, `Expected a member ${member}`)
            }
        }
    }

    function required(location: Locatable, condition: boolean, message: string) {
        if (!condition) fatal(location, message)
    }

    function report(location: Locatable, message: string) {
        diagnostics.push({ location, message })
    }

    function fatal(location: Locatable, message: string): never {
        const e: any = new Error(message)
        e.location = location
        throw e
    }
}