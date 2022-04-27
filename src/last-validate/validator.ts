import {
    BodyElement, Declaration, Diagnostic, Exportable, Expression, Field, Import, ImportItem, Last, LastKind,
    LiteralBigInt, PrimitiveKind, LiteralNumeric, Locatable, Module, nameOfLastKind, Parameter, Reference,
    FieldLiteral, TypeExpression, Primitive, ArrayLiteral, MemoryMethod
} from "../last";

export function validate(module: Module): Diagnostic[] {
    const diagnostics: Diagnostic[] = []
    const context: (LastKind | { name: string, index: number } | string)[] = []

    function c(kind: LastKind, block: () => void) {
        context.push(kind)
        block()
        context.pop()
    }

    function i(name: string, index: number, block: () => void) {
        context.push({ name, index })
        block()
        context.pop()
    }

    function unref(node: any): string | undefined {
        return node.name?.kind == LastKind.Reference ? node.name.name : undefined
    }

    function n(node: any, block: () => void) {
        const name = unref(node)
        if (name) {
            if (node.kind !== undefined) {
                context.push(`${nameOfLastKind(node.kind)}(${name})`)
            } else {
                context.push(name)
            }
        } else if (node.kind !== undefined) {
            context.push(node.kind)
        } else context.push("???")
        block()
        context.pop()
    }

    function contextToString(): string {
        return context.map(item => {
            if (typeof item === "number") {
                return nameOfLastKind(item)
            } else if (typeof item == "string") {
                return item
            } else {
                return `${item.name}[${item.index}]`
            }
        }).join("/")
    }

    try {
        validateModule(module)
    } catch (e: any) {
        report(e.location ?? module, `${contextToString()}: ${e.message}`)
    }
    return diagnostics

    function validateModule(module: Module) {
        c(LastKind.Module, () => {
            requiredKind(module, LastKind.Module)
            requiredMembers(module, 'imports', 'declarations')
            validateArray(module, 'imports', module.imports, validateImport)
            validateArray(module, 'declarations', module.declarations, validateDeclaration)
        })
    }

    function validateImport(importNode: Import) {
        c(LastKind.Import, () => {
            requiredKind(importNode, LastKind.Import)
            requiredMembers(importNode, 'imports')
            validateArray(importNode, 'imports', importNode.imports, validateImportItem)
        })
    }

    function validateImportItem(importItem: ImportItem) {
        c(importItem.kind, () => {
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
        })
    }

    function validatePrimitive(node: Primitive) {
        c(LastKind.Primitive, () => {
            requiredKind(node, LastKind.Primitive)
            requiredMembers(node, 'primitive')
            validatePrimitiveKind(node, node.primitive)
        })
    }

    function validatePrimitiveKind(location: Locatable, primitive: PrimitiveKind) {
        required(location, primitive >= PrimitiveKind.I8 && primitive <= PrimitiveKind.Null, "Unexpected primitive kind")
    }

    function validateReference(reference: Reference) {
        c(LastKind.Reference, () => {
            requiredKind(reference, LastKind.Reference)
            requiredMembers(reference, 'name')
            required(reference, typeof reference.name === "string", "Expected name to be a string")
        })
    }

    function validateTypeExpression(type: TypeExpression) {
        switch (type.kind) {
            case LastKind.Primitive:
                validatePrimitive(type)
                break
            case LastKind.Reference:
                validateReference(type)
                break
            case LastKind.TypeSelect:
                c(LastKind.TypeSelect, () => {
                    requiredMembers(type, 'target', 'name')
                    validateTypeExpression(type.target)
                    validateReference(type.name)
                })
                break
            case LastKind.StructTypeLiteral:
                c(LastKind.StructTypeLiteral, () => {
                    requiredMembers(type, 'fields')
                    validateArray(type, 'fields', type.fields, validateStructFieldLiteral)
                })
                break
            case LastKind.ArrayConstructor:
                c(LastKind.ArrayConstructor, () => {
                    requiredMembers(type, 'element')
                    if (type.size !== undefined) {
                        required(type, typeof type.size === "number", "Expected size to be a number")
                    }
                })
                break
            case LastKind.PointerConstructor:
                c(LastKind.PointerConstructor, () => {
                    requiredMembers(type, 'target')
                    validateTypeExpression(type.target)
                })
                break
            default:
                fatal(type, "Expected a TypeExpression")
        }
    }

    function validateStructFieldLiteral(field: FieldLiteral) {
        c(LastKind.FieldLiteral, () => {
            requiredKind(field, LastKind.FieldLiteral)
            requiredMembers(field, 'name', 'type')
            validateReference(field.name)
            validateTypeExpression(field.type)
        })
    }

    function validateParameter(parameter: Parameter) {
        c(LastKind.Parameter, () => {
            requiredKind(parameter, LastKind.Parameter)
            requiredMembers(parameter, 'name', 'type')
            validateReference(parameter.name)
            validateTypeExpression(parameter.type)
        })
    }

    function validateDeclaration(declaration: Declaration) {
        switch (declaration.kind) {
            case LastKind.Let:
                n(declaration, () => {
                    requiredMembers(declaration, 'name', 'type', 'value')
                    validateReference(declaration.name)
                    validateTypeExpression(declaration.type)
                    validateExpression(declaration.value)
                })
                break
            case LastKind.Var:
                n(declaration, () => {
                    requiredMembers(declaration, 'name')
                    validateReference(declaration.name)
                    if (declaration.type) {
                        validateTypeExpression(declaration.type)
                    }
                    if (declaration.value) {
                        validateExpression(declaration.value)
                    }
                    if (!declaration.type && !declaration.value) {
                        report(declaration, "A type or value is required")
                    }
                })
                break
            case LastKind.Type:
                c(LastKind.Type, () => {
                    requiredMembers(declaration, 'name', 'type')
                    validateReference(declaration.name)
                    validateTypeExpression(declaration.type)
                })
                break
            case LastKind.Function:
            case LastKind.Global:
                validateExportable(declaration)
                break
            case LastKind.Exported:
                c(LastKind.Exported, () => {
                    requiredMembers(declaration, 'target')
                    validateExportable(declaration.target)
                })
                break
            default:
                fatal(declaration, "Expected a Declration")
        }
    }

    function validateExportable(node: Exportable) {
        switch (node.kind) {
            case LastKind.Global:
                n(node, () => {
                    requiredMembers(node, 'name', 'type', 'value')
                    validateReference(node.name)
                    validateTypeExpression(node.type)
                    validateExpression(node.value)
                })
                break
            case LastKind.Function:
                n(node, () => {
                    requiredMembers(node, 'name', 'parameters', 'result', 'body')
                    validateReference(node.name)
                    validateArray(node, 'parameters', node.parameters, validateParameter)
                    validateTypeExpression(node.result)
                    validateArray(node, 'body', node.body, validateBodyElement)
                })
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
            case LastKind.Or:
            case LastKind.BitAnd:
            case LastKind.BitOr:
            case LastKind.BitRotl:
            case LastKind.BitRotr:
            case LastKind.BitShl:
            case LastKind.BitShr:
            case LastKind.BitXor:
            case LastKind.Minimum:
            case LastKind.Maximum:
            case LastKind.CopySign: {
                c(node.kind, () => {
                    requiredMembers(node, 'left', 'right')
                    validateExpression(node.left)
                    validateExpression(node.right)
                })
                break
            }
            case LastKind.Negate:
            case LastKind.Not:
            case LastKind.AddressOf:
            case LastKind.Dereference:
            case LastKind.CountLeadingZeros:
            case LastKind.CountTrailingZeros:
            case LastKind.CountNonZeros:
            case LastKind.SquareRoot:
            case LastKind.Floor:
            case LastKind.Ceiling:
            case LastKind.Truncate:
            case LastKind.RoundNearest:{
                c(node.kind, () => {
                    requiredMembers(node, 'target')
                    validateExpression(node.target)
                })
                break
            }
            case LastKind.ConvertTo:
            case LastKind.WrapTo:
            case LastKind.ReinterpretAs:
            case LastKind.TruncateTo:
            case LastKind.As: {
                c(node.kind, () => {
                    requiredMembers(node, 'left', 'right')
                    validateExpression(node.left)
                    validateTypeExpression(node.right)
                })
                break
            }
            case LastKind.SizeOf: {
                c(node.kind, () => {
                    requiredMembers(node, 'target')
                    validateTypeExpression(node.target)
                })
                break
            }
            case LastKind.Literal: {
                c(node.kind, () => {
                    requiredMembers(node, 'primitiveKind', 'value')
                    switch (node.primitiveKind) {
                        case PrimitiveKind.I8:
                            validateNumericRange(node, -128, 127)
                            break
                        case PrimitiveKind.U8:
                            validateNumericRange(node, 0, 255)
                            break
                        case PrimitiveKind.I16:
                            validateNumericRange(node, -32768, 32767)
                            break
                        case PrimitiveKind.U16:
                            validateNumericRange(node, 0, 65535)
                            break
                        case PrimitiveKind.I32:
                            validateNumericRange(node, -2147483648, 2147483647)
                            break
                        case PrimitiveKind.U32:
                            validateNumericRange(node, 0, (1 >> 32) - 1)
                            break
                        case PrimitiveKind.I64:
                            validateBigIntRange(node, -(1n << 63n), (1n << 63n) - 1n)
                            break
                        case PrimitiveKind.U64:
                            validateBigIntRange(node, 0n, (1n << 64n) - 1n)
                            break
                        case PrimitiveKind.Bool:
                            required(node, typeof node.value === "boolean", "Expected value to be a boolena")
                            break
                        case PrimitiveKind.Null:
                            required(node, node.value === null, "Expected value to be null")
                            break
                        case PrimitiveKind.F32:
                        case PrimitiveKind.F64:
                            required(node, typeof node.value === "number", "Expected value to be a number")
                            break
                        default:
                            fatal(node, "Unknown primitiveKind")
                    }
                })
                break
            }
        case LastKind.StructLiteral:
            c(node.kind, () => {
                requiredMembers(node, 'fields')
                validateArray(node, 'fields', node.fields, validateField)
            })
            break
        case LastKind.ArrayLiteral:
            c(node.kind, () => {
                requiredMembers(node, 'values')
                validateArrayLiteralValues(node, node)
            })
            break
        case LastKind.Reference:
            validateReference(node)
            break
        case LastKind.Select:
            c(node.kind, () => {
                requiredMembers(node, 'target', 'name')
                validateExpression(node.target)
                validateReference(node.name)
            })
            break
        case LastKind.Index:
            c(node.kind, () => {
                requiredMembers(node, 'target', 'index')
                validateExpression(node.target)
                validateExpression(node.index)
            })
            break
        case LastKind.Call:
            c(node.kind, () => {
                requiredMembers(node, 'target', 'arguments')
                validateExpression(node.target)
                validateArray(node, 'arguments', node.arguments, validateExpression)
            })
            break
        case LastKind.Memory:
            c(node.kind, () => {
                requiredMembers(node, 'method')
                required(node, node.method >= MemoryMethod.Top && node.method <= MemoryMethod.Grow, "Invalid memory method")
                if (node.method == MemoryMethod.Grow) {
                    requiredMembers(node, 'amount')
                    validateExpression(node.amount)
                }
            })
            break
        case LastKind.Block:
        case LastKind.IfThenElse:
            validateBodyElement(node)
            break
        default:
            console.log(node)
            fatal(node, `Expected an Expression, received: ${nodeText(node)}`)
        }
    }

    function nodeText(node: any) {
        if (typeof node.kind === "number") return nameOfLastKind(node.kind)
        if (node.kind === undefined) return "no kind field"
        return `${node.kind}`
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
                c(node.kind, () => {
                    requiredMembers(node, 'body')
                    if (node.name !== undefined) validateReference(node.name)
                    validateArray(node, 'body', node.body, validateBodyElement)
                })
                break
            case LastKind.IfThenElse:
                c(node.kind, () => {
                    requiredMembers(node, 'condition', 'then', 'else')
                    validateExpression(node.condition)
                    validateArray(node, 'then', node.then, validateBodyElement)
                    validateArray(node, 'else', node.else, validateBodyElement)
                })
                break
            case LastKind.Assign:
                c(node.kind, () => {
                    requiredMembers(node, 'target', 'value')
                    validateExpression(node.target)
                    validateExpression(node.value)
                })
                break
            case LastKind.Branch:
                c(node.kind, () => {
                    requiredMembers(node)
                    if (node.target) validateReference(node.target)
                })
                break
            case LastKind.BranchIndexed:
                c(node.kind, () => {
                    requiredMembers(node, 'condition', 'targets', 'else')
                    validateExpression(node.condition)
                    validateArray(node, 'targets', node.targets, validateReference)
                    validateReference(node.else)
                })
                break
            case LastKind.Return:
                c(node.kind, () => {
                    requiredMembers(node)
                    if (node.value) validateExpression(node.value)
                })
                break
            default:
                validateExpression(node)
                break
        }
    }

    function validateArray<T>(location: Locatable, name: string, items: T[], validator: (item: T) => void) {
        required(location, Array.isArray(items), `Expected ${name} to be an array`)
        items.forEach((value, index) => {
            i(name, index, () => {
                validator(value)
            })
        })
    }

    function validateArrayLiteralValues(location: Locatable, last: ArrayLiteral) {
        const values = last.values
        if (values instanceof Uint8Array || values instanceof Uint16Array || values instanceof Uint32Array ||
            values instanceof Int8Array || values instanceof Int16Array || values instanceof Int32Array ||
            values instanceof Float32Array || values instanceof Float64Array) {
                return
            }
        validateArray(location, 'values', values, validateExpression)
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