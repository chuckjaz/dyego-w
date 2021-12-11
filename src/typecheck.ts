import { ArrayLit, Assign, BlockExpression, Call, CompareOp, Index, Function, LiteralKind, Locatable, Loop, nameOfLiteralKind, nameOfNodeKind, NodeKind, Reference, Return, Scope, Select, StructLit, StructTypeLit, Tree, Import, Parameter, IfThenElse } from "./ast"
import { ArrayType, booleanType, builtInMethodsOf, capabilitesOf, Capabilities, f64Type, globals, i32Type, StructType, Type, TypeKind, typeToString, voidType } from "./types";

const builtins = new Scope<Type>(globals)

export function typeCheck(scope: Scope<Type>, program: Tree[]): Map<Tree, Type> {
    const result = new Map<Tree, Type>()
    const moduleScope = new Scope(builtins, scope)

    typeCheckStatements(program, moduleScope)
    return result;

    function typeCheckStatements(trees: Tree[], scope: Scope<Type>): Type {
        let lastType = voidType
        for (const tree of trees) {
            lastType = typeCheckStatement(tree, scope)
        }
        return lastType
    }

    function enter(location: Locatable, name: string, type: Type, scope: Scope<Type>) {
        if (scope.has(name)) error(location, `Duplicate symbol ${name}`)
        scope.enter(name, type)
    }

    function typeCheckStatement(tree: Tree, scope: Scope<Type>): Type {
        switch (tree.kind) {
            case NodeKind.Let: {
                const exprType = typeCheckExpr(tree.value, scope)
                const declaredTypeTree = tree.type
                const type = declaredTypeTree ? typeExpr(declaredTypeTree, scope) : exprType
                mustMatch(tree.value, exprType, type)
                if (type.kind == TypeKind.Function) {
                    type.name = tree.name
                    enter(tree, tree.name, type, scope)
                } else {
                    enter(tree, tree.name, { kind: TypeKind.Location, type }, scope)
                }
                return voidType
            }
            case NodeKind.Var: {
                const exprType = typeCheckExpr(tree.value, scope)
                const declaredTypeTree = tree.type
                let type = declaredTypeTree ? typeExpr(declaredTypeTree, scope) : exprType
                if (exprType.kind == TypeKind.Array && type.kind == TypeKind.Array) {
                    if (exprType.size !== undefined) {
                        type = { ...type, size: exprType.size }
                    }
                }
                mustMatch(tree.value, exprType, type)
                var treeType: Type = { kind: TypeKind.Location, type }
                enter(tree, tree.name, treeType, scope)
                result.set(tree, treeType)
                return voidType
            }
            case NodeKind.Type: {
                const type = typeExpr(tree.type, scope)
                if (type.kind == TypeKind.Struct) {
                    type.name = tree.name
                }
                enter(tree, tree.name, type, scope)
                return voidType
            }
            case NodeKind.Function: {
                const type = typeCheckExpr(tree, scope)
                enter(tree, tree.name, type, scope)
                return type
            }
            case NodeKind.Import: {
                typeCheckImport(tree, scope)
                return voidType
            }
            default:
                return typeCheckExpr(tree, scope)
        }
    }

    function typeCheckImport(tree: Import, scope: Scope<Type>) {
        for (const imp of tree.imports) {
            switch (imp.kind) {
                case NodeKind.ImportFunction: {
                    const parameterNodes = imp.parameters
                    const parameters = funcParameters(parameterNodes, scope)
                    const funcResult = typeExpr(imp.result, scope)
                    const name = imp.name
                    const type: Type = { kind: TypeKind.Function, parameters, result: funcResult, name }
                    result.set(imp, type)
                    enter(imp, imp.as ?? name, type, scope)
                    break
                }
                default:
                    error(imp, `Unsuppoerted node type: ${nameOfNodeKind(imp.kind)}`)
            }
        }
    }

    function requireCapability(type: Type, required: Capabilities, node: Tree) {
        if ((capabilitesOf(type) & required) != required) {
            let name = "operator";
            switch (node.kind) {
                case NodeKind.Add: name = ` "+"`; break;
                case NodeKind.Subtract: name = ` "-"`; break;
                case NodeKind.Multiply: name = ` "*"`; break;
                case NodeKind.Divide: name = ` "/"`; break;
                case NodeKind.And: name = ` "&&"`; break;
                case NodeKind.Or: name = ` "||"`; break;
                case NodeKind.Compare:
                    switch (node.op) {
                        case CompareOp.Equal: name = ` "=="`; break;
                        case CompareOp.GreaterThan: name = ` ">"`; break;
                        case CompareOp.GreaterThanEqual: name = ` ">="`; break;
                        case CompareOp.LessThan: name = ` "<"`; break;
                        case CompareOp.LessThanEqual: name = ` "<="`; break;
                        case CompareOp.NotEqual: name = ` "!="`; break;
                    }
            }
            error(node, `Operator ${name} not support for type ${typeToString(type)}`);
        }
    }

    function binary(
        node: Tree,
        left: Tree,
        right: Tree,
        capabilities: Capabilities,
        scope: Scope<Type>,
        result?: Type
    ): Type {
        const leftType = typeCheckExpr(left, scope);
        const rightType = typeCheckExpr(right, scope);
        const type = mustMatch(node, leftType, rightType);
        requireCapability(leftType, capabilities, node);
        return result ?? type
    }

    function unary(
        node: Tree,
        target: Tree,
        capabilities: Capabilities,
        scope: Scope<Type>,
        result?: Type
    ): Type {
        const type = typeCheckExpr(target, scope);
        requireCapability(type, capabilities, node);
        return result ?? type;
    }

    function typeCheckExpr(tree: Tree, scope: Scope<Type>): Type {
        if (result.has(tree)) {
            return result.get(tree)!!
        }
        let type: Type = { kind: TypeKind.Void }
        switch (tree.kind) {
            case NodeKind.Reference:
                type = reference(tree, scope)
                break
            case NodeKind.Add:
                type = binary(tree, tree.left, tree.right, Capabilities.Numeric, scope)
                break
            case NodeKind.Subtract:
                type = binary(tree, tree.left, tree.right, Capabilities.Numeric, scope)
                break
            case NodeKind.Multiply:
                type = binary(tree, tree.left, tree.right, Capabilities.Numeric, scope)
                break
            case NodeKind.Divide:
                type = binary(tree, tree.left, tree.right, Capabilities.Numeric, scope)
                break
            case NodeKind.Negate:
                type = unary(tree, tree.target, Capabilities.Negatable, scope)
                break
            case NodeKind.Not:
                type = unary(tree, tree.target, Capabilities.Logical, scope)
                break
            case NodeKind.Compare:
                type = binary(tree, tree.left, tree.right, Capabilities.Comparable, scope, booleanType)
                break
            case NodeKind.And:
                type = binary(tree, tree.left, tree.right, Capabilities.Logical, scope)
                break
            case NodeKind.Or:
                type = binary(tree, tree.left, tree.right, Capabilities.Logical, scope)
                break
            case NodeKind.BlockExpression:
                type = blockExpression(tree, scope)
                break
            case NodeKind.IfThenElse:
                type = ifThenElseExpresssion(tree, scope)
                break
            case NodeKind.Loop:
                type = loopStatement(tree, scope)
                break
            case NodeKind.Break:
                type = voidType
                break
            case NodeKind.Continue:
                type = voidType
                break
            case NodeKind.Return:
                type = returnStatement(tree, scope)
                break
            case NodeKind.Literal:
                switch (tree.literalKind) {
                    case LiteralKind.Boolean:
                        type = booleanType
                        break
                    case LiteralKind.Double:
                        type = f64Type
                        break
                    case LiteralKind.Int:
                        type = i32Type
                        break
                }
                break
            case NodeKind.Function:
                type = func(tree, scope)
                break
            case NodeKind.StructLit:
                type = structLit(tree, scope)
                break
            case NodeKind.ArrayLit:
                type = arrayLiteral(tree, scope)
                break
            case NodeKind.Call:
                type = call(tree, scope)
                break
            case NodeKind.Select:
                type = select(tree, scope)
                break
            case NodeKind.Index:
                type = index(tree, scope)
                break
            case NodeKind.Assign:
                type = assign(tree, scope)
                break
            default:
                error(tree, `Unsupported node ${nameOfNodeKind(tree.kind)}`)
        }
        result.set(tree, type);
        return type
    }

    function func(tree: Function, scope: Scope<Type>): Type {
        const parameters = funcParameters(tree.parameters, scope)
        const resultType = typeExpr(tree.result, scope)
        const bodyScope = new Scope(parameters, scope)
        bodyScope.enter("$$result", resultType)
        const bodyResult = typeCheckStatements(tree.body, bodyScope)
        if (bodyResult.kind != TypeKind.Void) {
            mustMatch(tree, bodyResult, resultType)
        }
        return { kind: TypeKind.Function, parameters, result: resultType }
    }

    function funcParameters(parameterNodes: Parameter[], scope: Scope<Type>): Scope<Type> {
        const parameters = new Scope<Type>()
        for (const parameter of parameterNodes) {
            if (parameters.has(parameter.name)) error(parameter, `Duplicate parameter name`)
            const type = typeExpr(parameter.type, scope)
            const parameterType: Type = { kind: TypeKind.Location, type }
            result.set(parameter, parameterType)
            parameters.enter(parameter.name, parameterType)
        }
        return parameters
    }

    function call(tree: Call, scope: Scope<Type>): Type {
        const callType = typeCheckExpr(tree.target, scope)
        requireCapability(callType, Capabilities.Callable, tree.target)
        if (callType.kind != TypeKind.Function) error(tree.target, `Expected a function reference`)
        if (tree.arguments.length != callType.parameters.size) {
            error(tree, `Expected ${callType.parameters.size} arguments, received ${tree.arguments.length}`)
        }
        let index = 0
        callType.parameters.forEach((name, type) => {
            const arg = tree.arguments[index++]
            const argType = typeCheckExpr(arg, scope)
            mustMatch(arg, argType, type)
        })
        return callType.result
    }

    function select(tree: Select, scope: Scope<Type>): Type {
        const originalTarget = typeCheckExpr(tree.target, scope)
        const targetType = read(originalTarget)
        switch (targetType.kind) {
            case TypeKind.Struct:
                const fieldType = targetType.fields.find(tree.name)
                if (!fieldType) error(tree, `Type ${typeToString(targetType)} does not have member "${tree.name}"`)
                if (originalTarget.kind == TypeKind.Location)
                    return { kind: TypeKind.Location, type: fieldType }
                return fieldType
            default:
                const builtins = builtInMethodsOf(targetType)
                const memberType = builtins.find(tree.name)
                if (!memberType) error(tree, `Type ${typeToString(targetType)} does not ahve a member "${tree.name}"`)
                if (memberType.kind == TypeKind.Function) {
                    const thisParameter = memberType.parameters.find("this")
                    if (thisParameter != null) {
                        mustMatch(tree, originalTarget, thisParameter)
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

    function read(type: Type): Type {
        if (type.kind == TypeKind.Location) return type.type
        return type
    }

    function index(tree: Index, scope: Scope<Type>): Type {
        const targetType = typeCheckExpr(tree.target, scope)
        requireCapability(targetType, Capabilities.Indexable, tree)
        const array = expectArray(targetType, tree)
        const elementType = array.elements
        if (targetType.kind == TypeKind.Location)
            return { kind: TypeKind.Location, type: elementType }
        return elementType
    }

    function assign(tree: Assign, scope: Scope<Type>): Type {
        const targetType = typeCheckExpr(tree.target, scope)
        if (targetType.kind != TypeKind.Location) error(tree, `Expected a lvalue`)
        const type = targetType.type
        const valueType = typeCheckExpr(tree.value, scope)
        mustMatch(tree, valueType, type)
        return voidType
    }

    function structLit(tree: StructLit, scope: Scope<Type>): Type {
        const fields = new Scope<Type>()
        for (const item of tree.body) {
            switch (item.kind) {
                case NodeKind.Field: {
                    const fieldType = typeCheckExpr(item.value, scope)
                    if (fields.has(item.name)) error(item, `Duplicate field name`)
                    fields.enter(item.name, { kind: TypeKind.Location, type: fieldType })
                    break
                }
            }
        }
        return { kind: TypeKind.Struct, fields }
    }

    function reference(ref: Reference, scope: Scope<Type>): Type {
        const result = scope.find(ref.name)
        if (!result) {
            error(ref, `Symbol "${ref.name}" not found`)
        }
        return result
    }

    function blockExpression(block: BlockExpression, scope: Scope<Type>): Type {
        return typeCheckStatements(block.block, scope)
    }

    function ifThenElseExpresssion(tree: IfThenElse, scope: Scope<Type>): Type {
        const conditionType = typeCheckExpr(tree.condition, scope)
        mustMatch(tree.condition, conditionType, booleanType)
        const thenType = typeCheckExpr(tree.then, scope)
        const elseNode = tree.else
        var ifType: Type
        if (!elseNode) {
            ifType = voidType
        } else {
            const elseType = typeCheckExpr(elseNode, scope)
            mustMatch(tree, elseType, thenType)
            ifType = thenType
        }
        return ifType
    }

    function loopStatement(loop: Loop, scope: Scope<Type>): Type {
        typeCheckStatements(loop.body, scope)
        return voidType
    }

    function returnStatement(ret: Return, scope: Scope<Type>): Type {
        const value = ret.value
        const expectType = scope.find("$$result")
        if (value) {
            if (!expectType) error(ret, "No result expected of a void type")
            const valueType = typeCheckExpr(value, scope)
            mustMatch(value, expectType, valueType)
        } else {
            if (expectType) error(ret, `Result value of type ${typeToString(expectType)}`)
        }
        return voidType
    }

    function arrayLiteral(tree: ArrayLit, scope: Scope<Type>): Type {
        const elements = tree.values
        const len = elements.length
        if (len > 0) {
            const elementType = typeCheckExpr(elements[0], scope)
            for (let i = 1; i < len; i++) {
                const element = elements[i]
                const type = typeCheckExpr(element, scope)
                mustMatch(element, elementType, type)
            }
            return { kind: TypeKind.Array, elements: elementType, size: elements.length }
        }
        return { kind: TypeKind.Unknown }
    }

    function typeExpr(tree: Tree, scope: Scope<Type>): Type {
        switch (tree.kind) {
            case NodeKind.Reference: {
                const result = scope.find(tree.name)
                if (!result) error(tree, `Type ${tree.name} not found.`)
                if (result.kind == TypeKind.Location) error(tree, "Expected a type reference")
                return result
            }
            case NodeKind.Select:
                error(tree, "Nested scopes not yet supported")
            case NodeKind.ArrayCtor: {
                const elements = typeExpr(tree.element, scope)
                return { kind: TypeKind.Array, elements, size: tree.size }
            }
            case NodeKind.StructTypeLit:
                return structTypeLiteral(tree, scope)
            default:
                error(tree, `Unsupported node in type expression: ${nameOfNodeKind(tree.kind)}`)
        }
    }

    function structTypeLiteral(tree: StructTypeLit, scope: Scope<Type>): Type {
        const fields = new Scope<Type>()
        for (const field of tree.fields) {
            if (fields.has(field.name)) error(field, `Dupicate symbol`)
            const fieldType = typeExpr(field.type, scope)
            fields.enter(field.name, fieldType)
        }
        return { kind: TypeKind.Struct, fields }
    }

    function equivilent(from: Type, to: Type): boolean {
        if (from === to) return true;
        if (from.kind == TypeKind.Location) return equivilent(from.type, to)
        if (to.kind == TypeKind.Location) return equivilent(from, to.type)
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
            error(location, `Expected ${typeToString(from)}, received ${typeToString(to)}`)
        }
        from.fields.forEach(name => {
            if (!to.fields.has(name)) error(location, `Expected type ${typeToString(to)} to have a field named "${name}"`)
        })
        to.fields.forEach((name, type) => {
            if (!from.fields.has(name)) error(location, `Expected type ${typeToString(from)} to have a field named "${name}"`)
            const fromFieldType = required(from.fields.find(name))
            mustMatch(location, fromFieldType, type)
        })

        // Replace fields
        const primary = from.name ? from : to
        const secondary = primary === to ? from : to
        result.forEach((value, key) => {
            const sub = substitute(value, primary, to)
        })

        return primary
    }

    function expectBoolean(location: Locatable, type: Type) {
        return mustMatch(location, type, booleanType)
    }

    function expectStruct(type: Type, location: Locatable): StructType {
        const t = type.kind == TypeKind.Location ? type.type : type
        if (t.kind != TypeKind.Struct) error(location, `Expected a struct type`)
        return t
    }

    function expectArray(type: Type, location: Locatable): ArrayType {
        const t = type.kind == TypeKind.Location ? type.type : type
        if (t.kind != TypeKind.Array) error(location, `Expected an array type`)
        return t
    }

    function mustMatch(location: Locatable, from: Type, to: Type): Type {
        if (!equivilent(from, to)) {
            if (from.kind == TypeKind.Struct && to.kind == TypeKind.Struct) {
                return unify(location, from, to)
            }
            error(location, `Expected type ${typeToString(from)}, received ${typeToString(to)}`);
        }
        return to
    }
}

function error(location: Locatable, message: string): never {
    const e = new Error(message) as any
    e.start = location.start
    e.end = location.end
    throw e
}

function required<T>(value: T | undefined): T {
    if (!value) throw new Error("Required a value")
    return value
}