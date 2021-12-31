import { required } from "../utils";
import { BranchTarget, Declaration, Last, LastKind, Let, Function, Module, nameOfLastKind, StructTypeLiteral, Type as TypeNode, Var, Parameter, Import, Expression, Block, Loop, Reference, IfThenElse, LiteralKind, StructLiteral, ArrayLiteral, Call, Select, Index, Assign, BodyElement } from "./ast";
import { Diagnostic } from "./diagnostic";
import { Locatable } from "./locatable";
import { Scope } from "./scope";
import { globals, Type, TypeKind, UnknownType, typeToString, nameOfTypeKind, PointerType, ErrorType, StructType, booleanType, ArrayType, FunctionType, voidType, Capabilities, capabilitesOf, i32Type, i8Type, i16Type, i64Type, u8Type, u16Type, u32Type, u64Type, f32Type, f64Type, nullType, builtInMethodsOf } from "./types";

const builtins = new Scope<Type>(globals)

interface Scopes {
    scope: Scope<Type>,
    branchTargets: Scope<BranchTarget>
}

export function check(module: Module): Map<Last, Type> | Diagnostic[] {
    const diagnostics: Diagnostic[] = []
    const result = new Map<Last, Type>()
    const fixups = new Map<UnknownType, ((final: Type) => void)[]>()
    const scanned = new Set<Type>()
    const moduleScope = new Scope(builtins)
    const errorType: ErrorType = { kind: TypeKind.Error }

    checkModule(module, {
        scope: moduleScope,
        branchTargets: new Scope()
    })
    return diagnostics.length > 0 ? diagnostics : result

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
                    enter(declaration, declaration.name, instance, scope)
                    break
            }
        }

        // Enter types
        for (const d of declarations) {
            const declaration = noExport(d)
            switch (declaration.kind) {
                case LastKind.Let: {
                    const type = typeExpr(declaration.type, scopes)
                    enter(declaration, declaration.name, type, scope)
                    bind(declaration, type)
                    break
                }
                case LastKind.Var: {
                    const type = typeExpr(declaration.type, scopes)
                    const addressable = scope === moduleScope
                    enter(declaration, declaration.name, { kind: TypeKind.Location, type, addressable }, scope)
                    bind(declaration, type)
                    break
                }
                case LastKind.Function: {
                    const parameters = funcParameters(declaration.parameters, scopes)
                    const result = typeExpr(declaration.result, scopes)
                    const type: FunctionType = { kind: TypeKind.Function, parameters, result }
                    enter(declaration, declaration.name, type, scope)
                    bind(declaration, type)
                    break
                }
                case LastKind.Type: {
                    const preentered = required(scope.find(declaration.name))
                    const type = typeExpr(declaration.type, scopes);
                    if (type.kind == TypeKind.Struct) {
                        type.name = declaration.name;
                    }
                    bind(declaration, type)
                    renter(declaration, declaration.name, type, scopes.scope)
                    if (preentered.kind == TypeKind.Unknown) {
                        fixup(preentered, type)
                    }
                    break
                }
            }
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
                        enter(importItem, importItem.as ?? importItem.name, type, scope)
                        break
                    }
                    case LastKind.ImportVariable: {
                        const type = typeExpr(importItem.type, scopes)
                        enter(importItem, importItem.as ?? importItem.name, type, scope)
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
                const type = required(scope.find(declaration.name))
                const valueType = checkExpression(declaration.value, scopes)
                mustMatch(declaration, type, valueType)
                return voidType
            }
            case LastKind.Var: {
                const value = declaration.value
                if (value) {
                    const type = required(scope.find(declaration.name))
                    const valueType = checkExpression(value, scopes)
                    mustMatch(declaration, type, valueType)
                }
                return voidType
            }
            case LastKind.Type: return voidType
            case LastKind.Function: {
                const functionType = required(scope.find(declaration.name))
                if (functionType.kind != TypeKind.Function) {
                    return errorType
                }
                const resultType = functionType.result
                const bodyScope = new Scope(scope)
                bodyScope.enter("$$result", resultType)
                functionType.parameters.forEach((name, type) => {
                    if (type.kind != TypeKind.Location) {
                        type = { kind: TypeKind.Location, type }
                    }
                    bodyScope.enter(name, type)
                })
                const bodyType = checkBlockOrExprssion(
                    declaration.body,
                    { scope: bodyScope, branchTargets: scopes.branchTargets }
                )
                mustMatch(declaration.body, resultType, bodyType)
                return voidType
            }
        }
    }

    function checkBlockOrExprssion(blockOrExpression: Block | Expression, scopes: Scopes): Type {
        switch (blockOrExpression.kind) {
            case LastKind.Block:
                return checkBlockOrLoop(blockOrExpression, scopes)
            default:
                return checkExpression(blockOrExpression, scopes)
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
                type = literalType(expression.literalKind)
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
            case LastKind.Block:
                type = checkBlockOrLoop(expression, scopes)
                break
            case LastKind.SizeOf:
                typeExpr(expression.target, scopes)
                type = i32Type
                break
            case LastKind.As: {
                const leftType = checkExpression(expression.left, scopes)
                expectPointer(expression.left, leftType)
                const rightType = typeExpr(expression.right, scopes)
                type = expectPointer(expression.right, rightType)
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
            return { kind: TypeKind.Pointer, target: type }
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
        const thenType = checkBlockOrExprssion(node.then, scopes)
        const elseNode = node.else
        var ifType: Type
        if (!elseNode) {
            ifType = voidType
        } else {
            const elseType = checkBlockOrExprssion(elseNode, scopes)
            mustMatch(node, elseType, thenType)
            ifType = thenType
        }
        return ifType
    }

    function structLiteral(node: StructLiteral, scopes: Scopes): Type {
        const fields = new Scope<Type>()
        for (const field of node.fields) {
            const fieldType = checkExpression(field.value, scopes)
            if (fields.has(field.name)) {
                report(field, `Duplicate field name`)
            } else {
                fields.enter(field.name, { kind: TypeKind.Location, type: fieldType })
            }
        }
        return { kind: TypeKind.Struct, fields }
    }

    function arrayLiteral(node: ArrayLiteral, scopes: Scopes): Type {
        const elements = node.values
        const len = elements.length
        if (len > 0) {
            const elementType = checkExpression(elements[0], scopes)
            for (let i = 1; i < len; i++) {
                const element = elements[i]
                const type = checkExpression(element, scopes)
                mustMatch(element, elementType, type)
            }
            return { kind: TypeKind.Array, elements: elementType, size: elements.length }
        }
        return { kind: TypeKind.Unknown }
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
        function fieldTypeOf(type: StructType): Type {
            const fieldType = type.fields.find(node.name)
            if (!fieldType) {
                report(node, `Type ${typeToString(targetType)} does not have member "${node.name}"`)
                return errorType
            }
            if (originalTarget.kind == TypeKind.Location && fieldType.kind != TypeKind.Location)
                return { kind: TypeKind.Location, type: fieldType }
            return fieldType

        }
        switch (targetType.kind) {
            case TypeKind.Struct:
                return fieldTypeOf(targetType);
            case TypeKind.Pointer:
                const refType = expectStruct(targetType.target, node.target);
                return fieldTypeOf(refType);
            default:
                const builtins = builtInMethodsOf(targetType)
                const memberType = builtins.find(node.name)
                if (!memberType) {
                    report(node, `Type ${typeToString(targetType)} does not have a member "${node.name}"`)
                    return errorType
                }
                if (memberType.kind == TypeKind.Function) {
                    const thisParameter = memberType.parameters.find("this")
                    if (thisParameter != null) {
                        mustMatch(node, originalTarget, thisParameter)
                        return {
                            kind: TypeKind.Function,
                            name: memberType.name,
                            parameters: memberType.parameters.without("this"),
                            result: memberType.result
                        }
                    }
                }
                return memberType
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


    function literalType(literalKind: LiteralKind): Type {
        switch(literalKind) {
            case LiteralKind.Int8: return i8Type
            case LiteralKind.Int16: return i16Type
            case LiteralKind.Int32: return i32Type
            case LiteralKind.Int64: return i64Type
            case LiteralKind.UInt8: return u8Type
            case LiteralKind.UInt16: return u16Type
            case LiteralKind.UInt32: return u32Type
            case LiteralKind.UInt64: return u64Type
            case LiteralKind.Float32: return f32Type
            case LiteralKind.Float64: return f64Type
            case LiteralKind.Boolean: return booleanType
            case LiteralKind.Null: return nullType
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
                default: name = nameOfLastKind(node.kind)
            }
            if (type.kind !== TypeKind.Error) {
                report(node, `Operator ${name} not support for type ${typeToString(type)}`);
            }
        }
    }

    function checkBlockOrLoop(block: Block | Loop, scopes: Scopes): Type {
        const blockScope = new Scope(scopes.scope)
        const blockBranchTargets = new Scope(scopes.branchTargets)
        const name = block.name
        if (name) {
            enter(block, name, block, blockBranchTargets)
        }
        enter(block, "$$top", block, blockBranchTargets)
        return checkBlockBody(block.body, { scope: blockScope, branchTargets: blockBranchTargets})
    }

    function checkBlockBody(body: BodyElement[], scopes: Scopes): Type {
        enterDeclarations(body.filter(i => i.kind == LastKind.Var || LastKind.Let) as Declaration[], scopes)
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
                type = checkDeclaration(node, scopes)
                break
            case LastKind.Block:
            case LastKind.Loop:
                type = checkBlockOrLoop(node, scopes)
                break
            case LastKind.Assign:
                type = assign(node, scopes)
                break
            case LastKind.Branch:
                validateBranchTarget(node, node.target, scopes)
                type = voidType
                break
            case LastKind.BranchIndexed:
                for (const target of node.targets) {
                    validateBranchTarget(node, target, scopes)
                }
                validateBranchTarget(node, node.else, scopes)
                type = voidType
                break
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
                report(location, `Branch target ${target} not found`)
            } else {
                report(location, "Not in a block or loop")
            }
        }
    }

    function funcParameters(parameterNodes: Parameter[], scopes: Scopes): Scope<Type> {
        const parameters = new Scope<Type>()
        for (const parameter of parameterNodes) {
            if (parameters.has(parameter.name)) {
                report(parameter, `Duplicate parameter name`)
            }
            const type = typeExpr(parameter.type, scopes)
            const parameterType: Type = { kind: TypeKind.Location, type }
            bind(parameter, parameterType)
            parameters.enter(parameter.name, parameterType)
        }
        return parameters
    }

    function typeExpr(node: Last, scopes: Scopes): Type {
        switch (node.kind) {
            case LastKind.Reference: {
                const result = scopes.scope.find(node.name)
                if (!result)  {
                    report(node, `Type ${node.name} not found.`)
                    return errorType
                }
                if (result.kind == TypeKind.Location) {
                    report(node, "Expected a type reference")
                }
                return result
            }
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
            default:
                report(node, `Unsupported node in type expression: ${nameOfLastKind(node.kind)}`)
                return errorType
        }
    }

    function structTypeLiteral(tree: StructTypeLiteral, scopes: Scopes): Type {
        const fields = new Scope<Type>()
        for (const field of tree.fields) {
            if (fields.has(field.name)) {
                report(field, `Dupicate symbol`)
            }
            const fieldType = typeExpr(field.type, scopes)
            const unknown = hasUnknown(fieldType)
            if (unknown) {
                report(field.type, `Fields cannot be of an incomplete or recursive type ${unknown.name}`);
            }
            fields.enter(field.name, fieldType)
        }
        return { kind: TypeKind.Struct, fields }
    }

    function hasUnknown(type: Type): UnknownType | undefined {
        switch (type.kind) {
            case TypeKind.Array:
                return hasUnknown(type.elements);
            case TypeKind.Unknown:
                return type;
            case TypeKind.Struct:
                return type.fields.first((name, type) => hasUnknown(type));
        }
        return undefined
    }


    function bind(node: Last, type: Type) {
        required(result.get(node) === undefined, node)
        result.set(node, type)
        if (type.kind == TypeKind.Unknown) {
            addFixup(type, final => result.set(node, final))
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
            }
            const fromFieldType = required(from.fields.find(name), location)
            mustMatch(location, fromFieldType, type)
        })

        // Replace fields
        const primary = from.name ? from : to
        const secondary = primary === to ? from : to
        result.forEach((value, key) => {
            substitute(value, primary, secondary)
        })

        return primary
    }

    function expectBoolean(location: Locatable, type: Type) {
        return mustMatch(location, type, booleanType)
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
            if (from.kind == TypeKind.Struct && to.kind == TypeKind.Struct) {
                return unify(location, from, to)
            }
            if (from.kind == TypeKind.Null || to.kind == TypeKind.Null) {
                return nullTypeMatch(location, from, to)
            }
            report(location, `Expected type ${typeToString(from)}, received ${typeToString(to)}`);
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

    function expectPointer(location: Locatable, type: Type): PointerType {
        if (type.kind != TypeKind.Pointer) {
            if (type.kind != TypeKind.Error) {
                report(location, `Expected type ${typeToString(type)} be a pointer was ${nameOfTypeKind(type.kind)}`)
            }
            return errorType as any as PointerType
        }
        return type
    }

    function read(type: Type): Type {
        if (type.kind == TypeKind.Location) return type.type
        return type
    }

    function enter<T>(location: Locatable, name: string, item: T, scope: Scope<T>) {
        if (scope.has(name)) report(location, `Duplicate symbol ${name}`)
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

    function noExport(declaration: Declaration): Var | Let | TypeNode | Function {
        if (declaration.kind == LastKind.Exported) return declaration.target
        return declaration
    }
}