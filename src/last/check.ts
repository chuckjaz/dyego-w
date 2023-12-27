import { required, check as chk } from "../utils";
import {
    BranchTarget, Declaration, Last, LastKind, Let, Function, Module, nameOfLastKind, StructTypeLiteral,
    TypeDeclaration as TypeNode, Var, Parameter, Import, Expression, Block, Loop, Reference, IfThenElse, PrimitiveKind,
    StructLiteral, ArrayLiteral, Call, Select, Index, Assign, BodyElement, Global, UnionTypeLiteral, Memory, MemoryMethod, ExportedMemory
} from "./ast";
import { Diagnostic } from "./diagnostic";
import { Locatable } from "./locatable";
import { Scope } from "./scope";
import {
    globals, Type, TypeKind, UnknownType, typeToString, nameOfTypeKind, PointerType, ErrorType, StructType, booleanType,
    ArrayType, FunctionType, voidType, Capabilities, capabilitesOf, i32Type, i8Type, i16Type, i64Type, u8Type, u16Type,
    u32Type, u64Type, f32Type, f64Type, nullType, voidPointerType, UnionType
} from "./types";

const builtins = new Scope<Type>(globals)

interface Scopes {
    scope: Scope<Type>,
    branchTargets: Scope<BranchTarget>
}

export interface CheckResult {
    types: Map<Last, Type>
    exported: Set<string>
    exportedMemoryName: string | undefined
}

export function check(module: Module): CheckResult | Diagnostic[] {
    const diagnostics: Diagnostic[] = []
    const types = new Map<Last, Type>()
    const fixups = new Map<UnknownType, ((final: Type) => void)[]>()
    const scanned = new Set<Type>()
    const moduleScope = new Scope(builtins)
    const errorType: ErrorType = { kind: TypeKind.Error }
    const exported = new Set<string>()
    let exportedMemoryName: string | undefined = undefined

    checkModule(module, {
        scope: moduleScope,
        branchTargets: new Scope()
    })
    return diagnostics.length > 0 ? diagnostics : { types, exported, exportedMemoryName }

    function checkModule(module: Module, scopes: Scopes) {
        enterDeclarations(module.declarations, scopes)
        enterImports(module.imports, scopes)
        checkDeclarations(module.declarations, scopes)
    }

    function enterDeclarations(declarations: Declaration[], scopes: Scopes) {
        const scope = scopes.scope

        // Predeclare any types
        for (const declaration of declarations) {
            switch (declaration.kind) {
                case LastKind.Type:
                    const instance: UnknownType = { kind: TypeKind.Unknown }
                    enter(declaration, declaration.name.name, instance, scope)
                    break
            }
        }

        // Enter types
        for (const declaration of declarations) {
            enterDeclaration(declaration, scopes)
        }
    }

    function enterDeclaration(declaration: Declaration, scopes: Scopes) {
        const scope = scopes.scope
        switch(declaration.kind) {
            case LastKind.Exported:
                exported.add(declaration.target.name.name)
                enterDeclaration(declaration.target, scopes)
                break
            case LastKind.Let: {
                const type = typeExpr(declaration.type, scopes)
                enter(declaration, declaration.name.name, type, scope)
                bind(declaration, type)
                break
            }
            case LastKind.Var: {
                const typeExp = declaration.type
                const initializer = declaration.value
                const rawType = typeExp ?
                    typeExpr(typeExp, scopes) : initializer ?
                        checkExpression(initializer, scopes) : (function() {
                            report(declaration, "A type or an initializer is required'")
                            return errorType
                        })();
                let type = rawType
                if (rawType.kind == TypeKind.Array && rawType.size === undefined) {
                    if (initializer) {
                        const initializerType = unwrap(checkExpression(initializer, scopes))
                        if (equivilent(type, initializerType) && initializerType.kind == TypeKind.Array && initializerType.size) {
                            // Copy the type from the initializer
                            type = { kind: TypeKind.Array, elements: rawType.elements, size: initializerType.size }
                        } else {
                            report(typeExp ?? declaration, "Unspecified array size requires an initializer value to define the size")
                        }
                    } else {
                        report(typeExp ?? declaration, "Unspecified array size requires an initializer value to define the size")
                    }
                }
                const addressable = scope === moduleScope
                if (!addressable) {
                    validateCanBeLocalOrGlobal(typeExp ?? declaration, type)
                }
                enter(declaration, declaration.name.name, { kind: TypeKind.Location, type, addressable }, scope)
                bind(declaration, type)
                break
            }
            case LastKind.Global: {
                const type = typeExpr(declaration.type, scopes)
                validateCanBeLocalOrGlobal(declaration.type, type)
                enter(declaration, declaration.name.name, { kind: TypeKind.Location, type }, scope)
                bind(declaration, type)
                break
            }
            case LastKind.Function: {
                const parameters = funcParameters(declaration.parameters, scopes)
                const result = typeExpr(declaration.result, scopes)
                validateCanBeLocalOrGlobal(declaration.result, result)
                const name = declaration.name.name
                const type: FunctionType = { kind: TypeKind.Function, name, parameters, result }
                enter(declaration, name, type, scope)
                bind(declaration, type)
                break
            }
            case LastKind.Type: {
                const preentered = required(scope.find(declaration.name.name))
                const type = typeExpr(declaration.type, scopes);
                if (type.kind == TypeKind.Struct || type.kind == TypeKind.Union) {
                    type.name = declaration.name.name;
                }
                bind(declaration, type)
                renter(declaration, declaration.name.name, type, scopes.scope)
                if (preentered.kind == TypeKind.Unknown) {
                    fixup(preentered, type)
                }
                break
            }
            case LastKind.ExportedMemory: {
                if (exportedMemoryName) {
                    report(declaration, "Memory exported twice")
                }
                exportedMemoryName = declaration.name.name
                break
            }
        }
    }

    function validateCanBeLocalOrGlobal(location: Locatable, type: Type) {
        switch (type.kind) {
            case TypeKind.Array:
            case TypeKind.Union:
            case TypeKind.Memory:
                report(
                    location,
                    `A value of type ${typeToString(type)} (or struct containing that type) cannot be passed as a ` +
                    `parameter, returned as a result, declared as global, or stored in a local variable`
                );
                break
            case TypeKind.Struct:
                type.fields.forEach((_, t) => validateCanBeLocalOrGlobal(location, t))
                break
        }
    }

    function enterImports(imports: Import[], scopes: Scopes) {
        const scope = scopes.scope
        for (const importStatement of imports) {
            for (const importItem of importStatement.imports) {
                switch (importItem.kind) {
                    case LastKind.ImportFunction: {
                        const parameters = funcParameters(importItem.parameters, scopes)
                        const result = typeExpr(importItem.result, scopes)
                        const type: FunctionType = { kind: TypeKind.Function, parameters, result }
                        enter(importItem, (importItem.as ?? importItem.name).name, type, scope)
                        bind(importItem, type)
                        break
                    }
                    case LastKind.ImportVariable: {
                        const type = typeExpr(importItem.type, scopes)
                        enter(importItem, (importItem.as ?? importItem.name).name, type, scope)
                        bind(importItem, type)
                        break
                    }
                }
            }
        }
    }

    function checkDeclarations(declarations: Declaration[], scopes: Scopes) {
        for (const declaration of declarations) {
            checkDeclaration(declaration, scopes)
        }
    }

    function checkDeclaration(declaration: Declaration, scopes: Scopes): Type {
        const scope = scopes.scope
        declaration = noExport(declaration)
        switch (declaration.kind) {
            case LastKind.Let: {
                const type = required(scope.find(declaration.name.name))
                const valueType = checkExpression(declaration.value, scopes)
                mustMatch(declaration.value, type, valueType)
                return voidType
            }
            case LastKind.Var: {
                const value = declaration.value
                if (value) {
                    const type = required(scope.find(declaration.name.name))
                    const valueType = checkExpression(value, scopes)
                    mustMatch(value, type, valueType)
                }
                return voidType
            }
            case LastKind.Global: {
                const value = declaration.value
                if (value) {
                    const type = required(scope.find(declaration.name.name))
                    const valueType = checkExpression(value, scopes)
                    mustMatch(value, type, valueType)
                }
                return voidType
            }
            case LastKind.Type: return voidType
            case LastKind.Function: {
                const functionType = required(scope.find(declaration.name.name)) as FunctionType
                chk(functionType.kind == TypeKind.Function)
                const resultType = functionType.result
                const bodyScope = new Scope(scope)
                bodyScope.enter("$$result", resultType)
                functionType.parameters.forEach((name, type) => {
                    bodyScope.enter(name, type)
                })
                const body = declaration.body
                const bodyType = checkBody(
                    declaration.body,
                    { scope: bodyScope, branchTargets: scopes.branchTargets }
                )
                if (
                    bodyType.kind == TypeKind.Void && resultType.kind != TypeKind.Void &&
                    resultType.kind != TypeKind.Error
                ) {
                    // Last statement must be a return
                    const last = body[body.length - 1]
                    if (last?.kind !== LastKind.Return) {
                        report(last ?? declaration, "Last statement must be a return or an expresion")
                    }
                } else {
                    if (resultType.kind != TypeKind.Void) {
                        mustMatch(body[body.length - 1], resultType, bodyType)
                    }
                }
                return voidType
            }
            case LastKind.ExportedMemory: {
                // Nothing to check
                return voidType
            }
        }
    }

    function widenType(type: Type): Type {
        switch (type.kind) {
            case TypeKind.Location: return widenType(type.type)
            case TypeKind.I8:
            case TypeKind.I16:
            case TypeKind.I32:
            case TypeKind.U8:
            case TypeKind.U16:
            case TypeKind.U32:
                return i32Type
            case TypeKind.I64:
            case TypeKind.U64:
                return i64Type
            default:
                return type
        }
    }

    function checkExpression(expression: Expression, scopes: Scopes): Type {
        let type: Type
        switch (expression.kind) {
            case LastKind.Reference:
                type = reference(expression, scopes)
                break
            case LastKind.Add:
            case LastKind.Subtract:
                type = pointerBinary(expression, expression.left, expression.right, Capabilities.Numeric, scopes)
                break
            case LastKind.Multiply:
            case LastKind.Divide:
            case LastKind.Remainder:
                type = binary(expression, expression.left, expression.right, Capabilities.Numeric, scopes)
                break
            case LastKind.BitAnd:
            case LastKind.BitOr:
            case LastKind.BitXor:
                type = binary(expression, expression.left, expression.right, Capabilities.Bitwizeable, scopes)
                break
            case LastKind.BitShl:
            case LastKind.BitShr:
                type = binaryWidenRight(
                    expression,
                    expression.left,
                    expression.right,
                    Capabilities.Bitwizeable,
                    scopes
                )
                break
            case LastKind.BitRotr:
            case LastKind.BitRotl:
                type = binaryWidenRight(
                    expression,
                    expression.left,
                    expression.right,
                    Capabilities.Rotatable,
                    scopes
                )
                break
            case LastKind.BitNot:
                type = unary(expression, expression.target, Capabilities.Bitwizeable, scopes)
                break
            case LastKind.CountLeadingZeros:
            case LastKind.CountTrailingZeros:
            case LastKind.CountNonZeros:
                type = unary(expression, expression.target, Capabilities.Bitcountable, scopes)
                break
            case LastKind.AbsoluteValue:
            case LastKind.SquareRoot:
            case LastKind.Floor:
            case LastKind.Ceiling:
            case LastKind.Truncate:
            case LastKind.RoundNearest:
                type = unary(expression, expression.target, Capabilities.Floatable, scopes)
                break
            case LastKind.Minimum:
            case LastKind.Maximum:
            case LastKind.CopySign:
                type = binary(
                    expression,
                    expression.left,
                    expression.right,
                    Capabilities.Floatable,
                    scopes
                )
                break
            case LastKind.Negate:
                type = unary(expression, expression.target, Capabilities.Negatable, scopes)
                break
            case LastKind.Not:
                type = unary(expression, expression.target, Capabilities.Logical, scopes)
                break
            case LastKind.AddressOf:
                type = addressOf(expression, expression.target, scopes)
                break
            case LastKind.Dereference:
                type = dereference(expression, expression.target, scopes)
                break
            case LastKind.Equal:
            case LastKind.NotEqual:
                type = binary(expression, expression.left, expression.right, Capabilities.Equatable, scopes, booleanType)
                break
            case LastKind.GreaterThan:
            case LastKind.GreaterThanEqual:
            case LastKind.LessThan:
            case LastKind.LessThanEqual:
                type = binary(expression, expression.left, expression.right, Capabilities.Comparable, scopes, booleanType)
                break
            case LastKind.And:
            case LastKind.Or:
                type = binary(expression, expression.left, expression.right, Capabilities.Logical, scopes)
                break
            case LastKind.IfThenElse:
                type = ifThenElseExpresssion(expression, scopes)
                break
            case LastKind.Literal:
                type = primitiveType(expression.primitiveKind)
                break
            case LastKind.StructLiteral:
                type = structLiteral(expression, scopes)
                break
            case LastKind.ArrayLiteral:
                type = arrayLiteral(expression, scopes)
                break
            case LastKind.Call:
                type = call(expression, scopes)
                break
            case LastKind.Select:
                type = select(expression, scopes)
                break
            case LastKind.Index:
                type = index(expression, scopes)
                break
            case LastKind.Memory:
                type = memory(expression, scopes)
                break
            case LastKind.Block:
                type = checkBlockOrLoop(expression, scopes)
                break
            case LastKind.SizeOf: {
                const targetType = typeExpr(expression.target, scopes)
                bind(expression.target, targetType)
                type = i32Type
                break
            }
            case LastKind.As: {
                const leftType = checkExpression(expression.left, scopes)
                const rightType = typeExpr(expression.right, scopes)
                if (rightType.kind == TypeKind.U32) {
                    expectPointer(expression.left, leftType)
                    type = rightType
                } else {
                    expectPointerOrPointerSized(expression.left, leftType)
                    type = expectPointerOrPointerSized(expression.right, rightType)
                }
                break
            }
            case LastKind.ConvertTo:
            case LastKind.WrapTo:
            case LastKind.ReinterpretAs:
            case LastKind.TruncateTo: {
                const left = checkExpression(expression.left, scopes)
                const right = typeExpr(expression.right, scopes)
                switch (expression.kind) {
                    case LastKind.ConvertTo:
                        validateConvert(expression, left, right)
                        break
                    case LastKind.WrapTo:
                        validateWrap(expression, left, right)
                        break
                    case LastKind.ReinterpretAs:
                        validateReinterpret(expression, left, right)
                        break
                    case LastKind.TruncateTo:
                        validateTruncate(expression, left, right)
                        break
                }
                type = right
                break
            }
        }
        bind(expression, type)
        return type
    }

    function addressOf(
        node: Expression,
        target: Expression,
        scopes: Scopes
    ): Type {
        const type = checkExpression(target, scopes)
        if (type.kind == TypeKind.Location && type.addressable) {
            return { kind: TypeKind.Pointer, target: type.type }
        }
        report(node, "The value does not have an address")
        return errorType
    }

    function reference(ref: Reference, scopes: Scopes): Type {
        const result = scopes.scope.find(ref.name)
        if (!result) {
            report(ref, `Symbol "${ref.name}" not found`)
            return errorType
        }
        return result
    }

    function dereference(
        node: Expression,
        target: Expression,
        scopes: Scopes
    ): Type {
        const type = read(checkExpression(target, scopes));
        if (type.kind == TypeKind.Pointer) {
            return { kind: TypeKind.Location, type: type.target }
        }
        report(node, "Expected a pointer type")
        return errorType
    }

    function ifThenElseExpresssion(node: IfThenElse, scopes: Scopes): Type {
        const conditionType = checkExpression(node.condition, scopes)
        mustMatch(node.condition, booleanType, conditionType)
        const thenScope = new Scope(scopes.scope)
        const elseScope = new Scope(scopes.scope)
        const thenType = checkBody(node.then, {...scopes, scope: thenScope })
        const elseType = checkBody(node.else, {...scopes, scope: elseScope })
        if (node.else.length) {
            mustMatch(node, elseType, thenType)
        }
        return thenType
    }

    function structLiteral(node: StructLiteral, scopes: Scopes): Type {
        const fields = new Scope<Type>()
        for (const field of node.fields) {
            const fieldType = checkExpression(field.value, scopes)
            if (fields.has(field.name.name)) {
                report(field, `Duplicate field name`)
            } else {
                fields.enter(field.name.name, { kind: TypeKind.Location, type: fieldType })
            }
        }
        return { kind: TypeKind.Struct, fields }
    }

    function arrayLiteral(node: ArrayLiteral, scopes: Scopes): Type {
        const elements = node.values
        const len = elements.length
        if (len > 0) {
            const elementType = arrayLiteralElementType(node, scopes)
            if (!('buffer' in elements)) {
                for (let i = 1; i < len; i++) {
                    const element = elements[i]
                    const type = checkExpression(element, scopes)
                    mustMatch(element, elementType, type)
                }
            }
            return {
                kind: TypeKind.Location,
                type: {
                    kind: TypeKind.Array,
                    elements: elementType,
                    size: elements.length
                }
            }
        }
        return { kind: TypeKind.Unknown }
    }

    function arrayLiteralElementType(node: ArrayLiteral, scopes: Scopes): Type {
        const values = node.values
        if (values instanceof Uint8Array)
            return u8Type
        if (values instanceof Uint16Array)
            return u16Type
        if (values instanceof Uint32Array)
            return u32Type
        if (values instanceof Int8Array)
            return i8Type
        if (values instanceof Int16Array)
            return i16Type
        if (values instanceof Int32Array)
            return i32Type
        if (values instanceof Float32Array)
            return f32Type
        if (values instanceof Float64Array)
            return f64Type
        return checkExpression(values[0], scopes)
    }

    function call(node: Call, scopes: Scopes): Type {
        const callType = checkExpression(node.target, scopes)
        requireCapability(callType, Capabilities.Callable, node.target)
        if (callType.kind != TypeKind.Function) {
            if (callType.kind != TypeKind.Error)
                report(node.target, `Expected a function reference`)
            return errorType
        }
        if (node.arguments.length != callType.parameters.size) {
            report(node, `Expected ${callType.parameters.size} argument${
                callType.parameters.size == 1 ? '' : 's'
            }, received ${node.arguments.length}`)
            return errorType
        }
        let index = 0
        callType.parameters.forEach((name, type) => {
            const arg = node.arguments[index++]
            const argType = checkExpression(arg, scopes)
            mustMatch(arg, type, argType)
        })
        return callType.result
    }

    function select(node: Select, scopes: Scopes): Type {
        const originalTarget = checkExpression(node.target, scopes)
        const targetType = read(originalTarget)
        function fieldTypeOf(type: StructType | UnionType): Type {
            if ((type as Type).kind == TypeKind.Error) return type
            const fieldType = type.fields.find(node.name.name)
            if (!fieldType) {
                report(node.name, `Type ${typeToString(targetType)} does not have member "${node.name.name}"`)
                return errorType
            }
            if (originalTarget.kind == TypeKind.Location && fieldType.kind != TypeKind.Location)
                return { kind: TypeKind.Location, type: fieldType }
            return fieldType

        }
        switch (targetType.kind) {
            case TypeKind.Struct:
            case TypeKind.Union:
                return fieldTypeOf(targetType);
            default:
                report(node.name, `Type ${typeToString(targetType)} does not have a member "${node.name.name}"`)
                return errorType
        }
    }

    function index(node: Index, scopes: Scopes): Type {
        const targetType = checkExpression(node.target, scopes)
        const indexType = checkExpression(node.index, scopes)
        requireCapability(targetType, Capabilities.Indexable, node)
        const array = expectArray(targetType, node)
        mustMatch(node, i32Type, indexType)
        const elementType = array.elements
        if (targetType.kind == TypeKind.Location)
            return { kind: TypeKind.Location, type: elementType, addressable: targetType.addressable }
        return elementType
    }

    function memory(node: Memory, scopes: Scopes): Type {
        switch (node.method) {
            case MemoryMethod.Top:
            case MemoryMethod.Limit:
                return voidPointerType
            case MemoryMethod.Grow:
                const amountType = checkExpression(node.amount, scopes)
                mustMatch(node.amount, amountType, i32Type)
                return i32Type
        }
    }

    function assign(node: Assign, scopes: Scopes): Type {
        const targetType = checkExpression(node.target, scopes)
        if (targetType.kind != TypeKind.Location) {
            report(node.target, `This expression cannot be assigned`)
            return errorType
        }
        const type = targetType.type
        const valueType = checkExpression(node.value, scopes)
        mustMatch(node, type, valueType)
        return voidType
    }


    function primitiveType(primitiveKind: PrimitiveKind): Type {
        switch(primitiveKind) {
            case PrimitiveKind.I8: return i8Type
            case PrimitiveKind.I16: return i16Type
            case PrimitiveKind.I32: return i32Type
            case PrimitiveKind.I64: return i64Type
            case PrimitiveKind.U8: return u8Type
            case PrimitiveKind.U16: return u16Type
            case PrimitiveKind.U32: return u32Type
            case PrimitiveKind.U64: return u64Type
            case PrimitiveKind.F32: return f32Type
            case PrimitiveKind.F64: return f64Type
            case PrimitiveKind.Bool: return booleanType
            case PrimitiveKind.Null: return nullType
            case PrimitiveKind.Void: return voidType
            case PrimitiveKind.Null: return nullType
        }
    }

    function pointerBinary(
        node: Expression,
        left: Expression,
        right: Expression,
        capabilities: Capabilities,
        scopes: Scopes,
        result?: Type
    ): Type {
        const leftType = read(checkExpression(left, scopes));
        if (leftType.kind == TypeKind.Pointer) {
            const rightType = read(checkExpression(right, scopes));
            mustMatch(node, i32Type, rightType);
            requireCapability(leftType, Capabilities.Pointer, node);
            return leftType;
        } else {
            return binary(node, left, right, capabilities, scopes, result, leftType);
        }
    }

    function binary(
        node: Expression,
        left: Expression,
        right: Expression,
        capabilities: Capabilities,
        scopes: Scopes,
        result?: Type,
        precalculatedLeftType?: Type
    ): Type {
        const leftType = precalculatedLeftType ?? checkExpression(left, scopes);
        const rightType = checkExpression(right, scopes);
        const type = mustMatch(node, leftType, rightType);
        requireCapability(leftType, capabilities, node);
        return result ?? type
    }

    function binaryWidenRight(
        node: Expression,
        left: Expression,
        right: Expression,
        capabilities: Capabilities,
        scopes: Scopes
    ): Type {
        const leftType = checkExpression(left, scopes)
        const rightType = checkExpression(right, scopes)
        const expectedRightType = widenType(leftType)
        requireCapability(leftType, capabilities, node)
        mustMatch(node, expectedRightType, rightType)
        return leftType
    }

    function unary(
        node: Expression,
        target: Expression,
        capabilities: Capabilities,
        scopes: Scopes,
        result?: Type
    ): Type {
        const type = checkExpression(target, scopes);
        requireCapability(type, capabilities, node);
        return result ?? type;
    }

    function requireCapability(type: Type, required: Capabilities, node: Expression) {
        if ((capabilitesOf(type) & required) != required) {
            if (type.kind == TypeKind.Error) return;
            let name = "operator";
            switch (node.kind) {
                case LastKind.Add: name = `"+"`; break;
                case LastKind.Subtract: name = `"-"`; break;
                case LastKind.Multiply: name = `"*"`; break;
                case LastKind.Divide: name = `"/"`; break;
                case LastKind.And: name = `"&&"`; break;
                case LastKind.Or: name = `"||"`; break;
                case LastKind.Index: name = `"[]"`; break;
                case LastKind.AddressOf: name = `"&"`; break;
                case LastKind.Dereference: name = `"^"`; break;
                case LastKind.Equal: name = `"=="`; break;
                case LastKind.GreaterThan: name = `">"`; break;
                case LastKind.GreaterThanEqual: name = `">="`; break;
                case LastKind.LessThan: name = `"<"`; break;
                case LastKind.LessThanEqual: name = `"<="`; break;
                case LastKind.NotEqual: name = `"!="`; break;
                default:
                    if ((required & Capabilities.Callable) != 0) {
                        report(node, `An expression of type ${typeToString(type)} is not callable`)
                        return
                    }
                    name = nameOfLastKind(node.kind)
                    break
            }
            report(node, `Operator ${name} not supported for type ${typeToString(type)}`);
        }
    }

    function checkBlockOrLoop(block: Block | Loop, scopes: Scopes): Type {
        const blockScope = new Scope(scopes.scope)
        const blockBranchTargets = new Scope(scopes.branchTargets)
        const name = block.name
        if (name) {
            enter(block, name.name, block, blockBranchTargets)
        }
        enter(block, "$$top", block, blockBranchTargets)
        return checkBody(block.body, { scope: blockScope, branchTargets: blockBranchTargets})
    }

    function checkBody(body: BodyElement[], scopes: Scopes): Type {
        enterDeclarations(body.filter(i => i.kind == LastKind.Var || i.kind == LastKind.Let) as Declaration[], scopes)
        let type = voidType
        for (const element of body) {
            type = checkBodyElement(element, scopes)
        }
        return type
    }

    function checkBodyElement(node: BodyElement, scopes: Scopes): Type {
        let type: Type
        switch (node.kind) {
            case LastKind.Var:
            case LastKind.Let:
            case LastKind.Type:
                return checkDeclaration(node, scopes)
            case LastKind.Block:
            case LastKind.Loop:
                type = checkBlockOrLoop(node, scopes)
                break
            case LastKind.Assign:
                type = assign(node, scopes)
                break
            case LastKind.Branch:
                validateBranchTarget(node, node.target?.name, scopes)
                type = voidType
                break
            case LastKind.BranchIndexed: {
                const conditionType = checkExpression(node.condition, scopes)
                mustMatch(node.condition, i32Type, conditionType)
                for (const target of node.targets) {
                    validateBranchTarget(node, target.name, scopes)
                }
                validateBranchTarget(node, node.else.name, scopes)
                type = voidType
                break
            }
            case LastKind.Return: {
                const value = node.value
                if (value) {
                    const resultType = required(scopes.scope.find("$$result"))
                    const valueType = checkExpression(value, scopes)
                    mustMatch(value, resultType, valueType)
                }
                type = voidType
                break
            }
            default:
                return checkExpression(node, scopes)
        }
        bind(node, type)
        return type
    }

    function validateBranchTarget(location: Locatable, target: string | undefined, scopes: Scopes) {
        const targetBlock = scopes.branchTargets.find(target ?? "$$top")
        if (!targetBlock) {
            if (target) {
                report(location, `Branch target "${target}" not found`)
            } else {
                report(location, "Not in a block or loop")
            }
        }
    }

    function funcParameters(parameterNodes: Parameter[], scopes: Scopes): Scope<Type> {
        const parameters = new Scope<Type>()
        for (const parameter of parameterNodes) {
            if (parameters.has(parameter.name.name)) {
                report(parameter, `Duplicate parameter name`)
                continue
            }
            const type = typeExpr(parameter.type, scopes)
            validateCanBeLocalOrGlobal(parameter.type, type)
            const parameterType: Type = { kind: TypeKind.Location, type }
            bind(parameter, parameterType)
            parameters.enter(parameter.name.name, parameterType)
        }
        return parameters
    }

    function typeExpr(node: Last, scopes: Scopes): Type {
        switch (node.kind) {
            case LastKind.Reference: {
                const result = scopes.scope.find(node.name)
                if (!result)  {
                    report(node, `Type "${node.name}" not found`)
                    return errorType
                }
                if (result.kind == TypeKind.Location) {
                    report(node, "Expected a type reference")
                }
                return result
            }
            case LastKind.Primitive:
                return primitiveType(node.primitive)
            case LastKind.Select:
                report(node, "Nested scopes not yet supported")
                return errorType
            case LastKind.ArrayConstructor: {
                const elements = typeExpr(node.element, scopes)
                return { kind: TypeKind.Array, elements, size: node.size }
            }
            case LastKind.PointerConstructor: {
                const target = typeExpr(node.target, scopes)
                return { kind: TypeKind.Pointer, target }
            }
            case LastKind.StructTypeLiteral:
                return structTypeLiteral(node, scopes)
            case LastKind.UnionTypeLiteral:
                return unionTypeLiteral(node, scopes)
            default:
                report(node, `Unsupported node in type expression: ${nameOfLastKind(node.kind)}`)
                return errorType
        }
    }

    function structuredType(tree: StructTypeLiteral | UnionTypeLiteral, scopes: Scopes): Scope<Type> {
        const fields = new Scope<Type>()
        for (const field of tree.fields) {
            if (fields.has(field.name.name)) {
                report(field, `Duplicate symbol`)
            }
            const fieldType = typeExpr(field.type, scopes)
            const unknown = hasUnknown(fieldType)
            if (unknown) {
                report(field.type, `Fields cannot be of an incomplete or recursive type ${unknown.name}`);
            }
            fields.enter(field.name.name, fieldType)
        }
        return fields
    }

    function structTypeLiteral(tree: StructTypeLiteral, scopes: Scopes): Type {
        const fields = structuredType(tree, scopes)
        return { kind: TypeKind.Struct, fields }
    }

    function unionTypeLiteral(tree: UnionTypeLiteral, scopes: Scopes): Type {
        const fields = structuredType(tree, scopes)
        return { kind: TypeKind.Union, fields }
    }

    function hasUnknown(type: Type): UnknownType | undefined {
        switch (type.kind) {
            case TypeKind.Array:
                return hasUnknown(type.elements);
            case TypeKind.Unknown:
                return type;
            case TypeKind.Union:
            case TypeKind.Struct:
                return type.fields.first((name, type) => hasUnknown(type));
        }
        return undefined
    }

    function bind(node: Last, type: Type) {
        types.set(node, type)
        if (type.kind == TypeKind.Unknown) {
            addFixup(type, final => types.set(node, final))
        }
        scanForFixes(type)
    }

    function addFixup(type: UnknownType, fixup: (final: Type) => void) {
        const list = fixups.get(type) ?? []
        list.push(fixup);
        fixups.set(type, list);
    }

    function fixup(type: UnknownType, finalType: Type) {
        const fixupsList = fixups.get(type) ?? [];
        for (const fixup of fixupsList) {
            fixup(finalType)
        }
        fixups.delete(type);
    }

    function scanForFixes(type: Type) {
        scan(type, () => { })

        function scan(type: Type, fixup: (final: Type) => void) {
            if (type.kind <= TypeKind.Boolean) return
            if (scanned.has(type)) return
            if (type.kind == TypeKind.Unknown) {
                addFixup(type, fixup)
                return
            }
            scanned.add(type)
            switch (type.kind) {
                case TypeKind.Array:
                    scan(type.elements, final => type.elements = final);
                    break
                case TypeKind.Function:
                    scan(type.result, final => type.result = final);
                    type.parameters.forEach((name, typeToFix) => {
                        scan(typeToFix, final => type.parameters.renter(name, final))
                    });
                    break
                case TypeKind.Location:
                    scan(type.type, final => type.type = final);
                    break;
                case TypeKind.Pointer:
                    scan(type.target, final => type.target = final);
                    break;
                case TypeKind.Struct:
                case TypeKind.Union:
                    type.fields.forEach((name, typeToFix) => {
                        scan(typeToFix, final => type.fields.renter(name, final))
                    })
                    break
            }
        }
    }

    function equivilent(from: Type, to: Type): boolean {
        if (from === to) return true;
        if (from.kind == TypeKind.Location) return equivilent(from.type, to)
        if (to.kind == TypeKind.Location) return equivilent(from, to.type)
        if (to.kind == TypeKind.Error || from.kind == TypeKind.Error) return true
        if (from.kind == to.kind) {
            switch (from.kind) {
                case TypeKind.I8:
                case TypeKind.I16:
                case TypeKind.I32:
                case TypeKind.I64:
                case TypeKind.F32:
                case TypeKind.F64:
                case TypeKind.Void:
                    return true;
                case TypeKind.Struct:
                case TypeKind.Union:
                case TypeKind.Function:
                    return false;
                case TypeKind.Pointer:
                    return equivilent(from.target, (to as PointerType).target)
                case TypeKind.Array:
                    return equivilent(from.elements, (to as ArrayType).elements)
            }
        }
        return false;
    }

    function substitute(type: Type, secondary: Type, primary: Type): Type {
        if (type === secondary) return primary
        switch (type.kind) {
            case TypeKind.Array:
                const elements = substitute(type.elements, secondary, primary)
                return elements == type.elements ? type : { kind: TypeKind.Array, elements }
            case TypeKind.Function:
                let changed = false
                const newParmeters = new Scope<Type>()
                type.parameters.forEach((name, paramType) => {
                    const sub = substitute(paramType, secondary, primary)
                    if (sub != paramType) changed = true
                    newParmeters.enter(name, sub)
                })
                const newResult = substitute(type.result, secondary, primary)
                if (newResult != type.result) changed = true
                if (changed) return { kind: TypeKind.Function, parameters: newParmeters, result: newResult }
                return type
        }
        return type
    }

    function unify(location: Locatable, from: StructType, to: StructType): Type {
        if (from === to) return from
        if (from.name != undefined && to.name != undefined) {
            report(location, `Expected ${typeToString(from)}, received ${typeToString(to)}`)
        }
        from.fields.forEach(name => {
            if (!to.fields.has(name)) {
                report(location, `Expected type ${typeToString(to)} to have a field named "${name}"`)
            }
        })
        to.fields.forEach((name, type) => {
            if (!from.fields.has(name)) {
                report(location, `Expected type ${typeToString(from)} to have a field named "${name}"`)
            } else {
                const fromFieldType = required(from.fields.find(name), location)
                mustMatch(location, fromFieldType, type)
            }
        })

        // Replace fields
        const primary = from.name ? from : to
        const secondary = primary === to ? from : to
        types.forEach((value, key) => {
            substitute(value, primary, secondary)
        })

        return primary
    }

    function expectStruct(type: Type, location: Locatable): StructType {
        const t = type.kind == TypeKind.Location ? type.type : type
        if (t.kind != TypeKind.Struct) {
            report(location, `Expected a struct type`)
            return errorType as any as StructType
        }
        return t
    }

    function expectArray(type: Type, location: Locatable): ArrayType {
        const t = type.kind == TypeKind.Location ? type.type : type
        if (t.kind != TypeKind.Array) {
            report(location, `Expected an array type`)
            return { kind: TypeKind.Array, elements: errorType }
        }
        return t
    }

    function mustMatch(location: Locatable, to: Type, from: Type): Type {
        if (!equivilent(from, to)) {
            const effectiveTo = to.kind == TypeKind.Location ? to.type : to
            const effectiveFrom = from.kind == TypeKind.Location ? from.type : from
            if (effectiveFrom.kind == TypeKind.Struct && effectiveTo.kind == TypeKind.Struct) {
                return unify(location, effectiveFrom, effectiveTo)
            }
            if (effectiveFrom.kind == TypeKind.Null || effectiveTo.kind == TypeKind.Null) {
                return nullTypeMatch(location, effectiveFrom, effectiveTo)
            }
            report(location, `Expected type ${typeToString(to)}, received ${typeToString(from)}`);
        }
        return to
    }

    function nullTypeMatch(location: Locatable, from: Type, to: Type): Type {
        from = read(from)
        to = read(to)
        if (from.kind == TypeKind.Null) {
            return expectPointer(location, to)
        }
        return expectPointer(location, from);
    }

    function expectPointerOrPointerSized(location: Locatable, type: Type): PointerType {
        if ((capabilitesOf(type) & (Capabilities.Pointer | Capabilities.PointerSized)) == 0) {
            expectPointer(location, type)
        }
        const effectiveType = read(type)
        return effectiveType.kind == TypeKind.Pointer ? effectiveType : voidPointerType
    }

    function expectPointer(location: Locatable, type: Type): PointerType {
        const effectiveType = read(type)
        if (effectiveType.kind != TypeKind.Pointer) {
            if (effectiveType.kind != TypeKind.Error) {
                report(location, `Expected type ${typeToString(type)} be a pointer was ${nameOfTypeKind(type.kind)}`)
            }
            return errorType as any as PointerType
        }
        return effectiveType
    }

    function validateConvert(location: Locatable, from: Type, to: Type): void {
        if (to.kind == TypeKind.Location) return validateConvert(location, from, to.type)

        switch (from.kind) {
            case TypeKind.Location:
                return validateConvert(location, from.type, to)
            case TypeKind.I32:
                if (to.kind == TypeKind.Boolean) return
                // fallthrough
            case TypeKind.I8:
            case TypeKind.I16:
            case TypeKind.I64:
            case TypeKind.U8:
            case TypeKind.U16:
            case TypeKind.U32:
            case TypeKind.U64:
                switch (to.kind) {
                    case TypeKind.I8:
                    case TypeKind.I16:
                    case TypeKind.I32:
                    case TypeKind.I64:
                    case TypeKind.U8:
                    case TypeKind.U16:
                    case TypeKind.U32:
                    case TypeKind.U64:
                    case TypeKind.F32:
                    case TypeKind.F64:
                        return
                }
                break
            case TypeKind.F32:
                switch (to.kind) {
                    case TypeKind.F64:
                        return
                }
                break
            case TypeKind.F64:
                switch (to.kind) {
                    case TypeKind.F32:
                        return
                }
                break
            case TypeKind.Boolean:
                if (to.kind == TypeKind.Boolean) return
                break
        }
        report(location, `Cannot convert ${typeToString(from)} to ${typeToString(to)}`)
    }

    function validateWrap(location: Locatable, from: Type, to: Type): void {
        if (from.kind == TypeKind.Location) return validateWrap(location, from.type, to)
        if (to.kind == TypeKind.Location) return validateWrap(location, from, to.type)
        if (from.kind != TypeKind.I64 || to.kind != TypeKind.I32) {
            report(location, `Cannot wrap a ${typeToString(from)} to ${typeToString(to)}`)
        }
    }

    function validateReinterpret(location: Locatable, from: Type, to: Type): void {
        if (to.kind == TypeKind.Location) return validateReinterpret(location, from, to.type)

        switch (from.kind) {
            case TypeKind.Location:
                return validateReinterpret(location, from.type, to)
            case TypeKind.U32:
                switch (to.kind) {
                    case TypeKind.Pointer:
                    case TypeKind.F32:
                        return
                }
                break
            case TypeKind.U64:
                switch (to.kind) {
                    case TypeKind.F64:
                        return
                }
                break
            case TypeKind.F32:
                switch (to.kind) {
                    case TypeKind.U32:
                        return
                }
                break
            case TypeKind.F64:
                switch (to.kind) {
                    case TypeKind.U64:
                        return
                }
                break
            case TypeKind.Pointer:
                switch (to.kind) {
                    case TypeKind.U32:
                        return
                    case TypeKind.Pointer:
                        return
                }
                break
        }

        report(location, `Cannot reinterpret ${typeToString(from)} to ${typeToString(to)}`)
    }

    function validateTruncate(location: Locatable, from: Type, to: Type): void {
        if (to.kind == TypeKind.Location) return validateTruncate(location, from, to.type)

        switch (from.kind) {
            case TypeKind.Location:
                return validateTruncate(location, from.type, to)
            case TypeKind.F32:
                switch (to.kind) {
                    case TypeKind.I32:
                    case TypeKind.U32:
                    case TypeKind.I64:
                    case TypeKind.U64:
                        return
                }
                break
            case TypeKind.F64:
                switch (to.kind) {
                    case TypeKind.I32:
                    case TypeKind.U32:
                    case TypeKind.I64:
                    case TypeKind.U64:
                        return
                }
                break
        }
        report(location, `Cannot truncate ${typeToString(from)} to ${typeToString(to)}`)
    }

    function read(type: Type): Type {
        if (type.kind == TypeKind.Location) return type.type
        return type
    }

    function enter<T>(location: Locatable, name: string, item: T, scope: Scope<T>) {
        if (scope.has(name)) {
            report(location, `Duplicate symbol ${name}`)
            return
        }
        scope.enter(name, item)
    }

    function renter<T>(location: Locatable, name: string, item: T, scope: Scope<T>) {
        scope.renter(name, item)
    }

    function report(location: Locatable, message: string, ...related: Diagnostic[]) {
        diagnostics.push({
            location,
            message,
            related
        })
    }

    function noExport(declaration: Declaration): Var | Let | Global | TypeNode | Function | ExportedMemory {
        if (declaration.kind == LastKind.Exported) return declaration.target
        return declaration
    }
}

function unwrap(type: Type): Type {
    switch (type.kind) {
        case TypeKind.Location: return type.type
        default: return type
    }
}

function isArrayType(type: Type): boolean {
    switch (type.kind) {
        case TypeKind.Array: return true
        case TypeKind.Location: return isArrayType(type.type)
    }
    return false
}

