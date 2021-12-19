import { ArrayLit, Assign, BlockExpression, Call, CompareOp, Index, Function, LiteralKind, Locatable, Loop, nameOfLiteralKind, nameOfNodeKind, NodeKind, Reference, Return, Scope, Select, StructLit, StructTypeLit, Tree, Import, Parameter, IfThenElse, nameOfCompareOp, BreakIndexed, Switch, SwitchCase } from "./ast"
import { ArrayType, booleanType, builtInMethodsOf, capabilitesOf, Capabilities, f64Type, globals, i32Type, nameOfTypeKind, nullType, PointerType, StructType, Type, TypeKind, typeToString, UnknownType, voidType } from "./types";

const builtins = new Scope<Type>(globals)

interface Scopes {
    scope: Scope<Type>,
    continues: Scope<Tree>,
    breaks: Scope<Tree>,
    root: Scope<Type>
}

export function typeCheck(incommingScope: Scope<Type>, program: Tree[]): Map<Tree, Type> {
    const result = new Map<Tree, Type>()
    const fixups = new Map<UnknownType, ((final: Type) => void)[]>()
    const scanned = new Set<Type>()
    const moduleScope = new Scope(builtins, incommingScope)

    typeCheckStatements(program, {
        scope: moduleScope,
        continues: new Scope<Tree>(),
        breaks: new Scope<Tree>(),
        root: moduleScope
    })
    return result;

    function bind(node: Tree, type: Type) {
        required(result.get(node) === undefined)
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

    function typeCheckStatements(trees: Tree[], scopes: Scopes): Type {
        let lastType = voidType
        for (const tree of trees) {
            lastType = typeCheckStatement(tree, scopes)
        }
        return lastType
    }

    function enter<T>(location: Locatable, name: string, item: T, scope: Scope<T>) {
        if (scope.has(name)) error(location, `Duplicate symbol ${name}`)
        scope.enter(name, item)
    }

    function renter<T>(location: Locatable, name: string, item: T, scope: Scope<T>) {
        scope.renter(name, item)
    }

    function typeCheckStatement(tree: Tree, scopes: Scopes): Type {
        switch (tree.kind) {
            case NodeKind.Let: {
                const exprType = read(typeCheckExpr(tree.value, scopes))
                const declaredTypeTree = tree.type
                const type = declaredTypeTree ? typeExpr(declaredTypeTree, scopes) : exprType
                mustMatch(tree.value, exprType, type)
                validateConst(tree.value, scopes)
                enter(tree, tree.name, type, scopes.scope)
                return voidType
            }
            case NodeKind.Var: {
                const exprType = read(typeCheckExpr(tree.value, scopes))
                const declaredTypeTree = tree.type
                let type = declaredTypeTree ? typeExpr(declaredTypeTree, scopes) : exprType
                if (exprType.kind == TypeKind.Array && type.kind == TypeKind.Array) {
                    if (exprType.size !== undefined) {
                        type = { ...type, size: exprType.size }
                    }
                }
                mustMatch(tree.value, exprType, type)
                var treeType: Type = { kind: TypeKind.Location, type, addressable: scopes.scope == scopes.root }
                enter(tree, tree.name, treeType, scopes.scope)
                bind(tree, treeType)
                return voidType
            }
            case NodeKind.Type: {
                const preenteredType: Type = { kind: TypeKind.Unknown, name: tree.name };
                enter(tree, tree.name, preenteredType, scopes.scope);
                const type = typeExpr(tree.type, scopes);
                if (type.kind == TypeKind.Struct) {
                    type.name = tree.name;
                }
                bind(tree, type);
                renter(tree, tree.name, type, scopes.scope);
                fixup(preenteredType, type);
                return voidType;
            }
            case NodeKind.Function: {
                const type = typeCheckExpr(tree, scopes)
                enter(tree, tree.name, type, scopes.scope)
                return type
            }
            case NodeKind.Import: {
                typeCheckImport(tree, scopes)
                return voidType
            }
            default:
                return typeCheckExpr(tree, scopes)
        }
    }

    function typeCheckImport(tree: Import, scopes: Scopes) {
        for (const imp of tree.imports) {
            switch (imp.kind) {
                case NodeKind.ImportFunction: {
                    const parameterNodes = imp.parameters
                    const parameters = funcParameters(parameterNodes, scopes)
                    const funcResult = typeExpr(imp.result, scopes)
                    const name = imp.name
                    const type: Type = { kind: TypeKind.Function, parameters, result: funcResult, name }
                    bind(imp, type)
                    enter(imp, imp.as ?? name, type, scopes.scope)
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
                case NodeKind.Add: name = `"+"`; break;
                case NodeKind.Subtract: name = `"-"`; break;
                case NodeKind.Multiply: name = `"*"`; break;
                case NodeKind.Divide: name = `"/"`; break;
                case NodeKind.And: name = `"&&"`; break;
                case NodeKind.Or: name = `"||"`; break;
                case NodeKind.Index: name = `"[]"`; break;
                case NodeKind.AddressOf: name = `"&"`; break;
                case NodeKind.Dereference: name = `"^"`; break;
                case NodeKind.Compare:
                    switch (node.op) {
                        case CompareOp.Equal: name = `"=="`; break;
                        case CompareOp.GreaterThan: name = `">"`; break;
                        case CompareOp.GreaterThanEqual: name = `">="`; break;
                        case CompareOp.LessThan: name = `"<"`; break;
                        case CompareOp.LessThanEqual: name = `"<="`; break;
                        case CompareOp.NotEqual: name = `"!="`; break;
                        default: name = nameOfCompareOp(node.op)
                    }
                default: name = nameOfNodeKind(node.kind)
            }
            error(node, `Operator ${name} not support for type ${typeToString(type)}`);
        }
    }

    function pointerBinary(
        node: Tree,
        left: Tree,
        right: Tree,
        capabilities: Capabilities,
        scopes: Scopes,
        result?: Type
    ): Type {
        const leftType = read(typeCheckExpr(left, scopes));
        if (leftType.kind == TypeKind.Pointer) {
            const rightType = read(typeCheckExpr(right, scopes));
            mustMatch(node, rightType, i32Type);
            requireCapability(leftType, Capabilities.Pointer, node);
            return leftType;
        } else {
            return binary(node, left, right, capabilities, scopes, result, leftType);
        }
    }

    function binary(
        node: Tree,
        left: Tree,
        right: Tree,
        capabilities: Capabilities,
        scopes: Scopes,
        result?: Type,
        precalculatedLeftType?: Type
    ): Type {
        const leftType = precalculatedLeftType ?? typeCheckExpr(left, scopes);
        const rightType = typeCheckExpr(right, scopes);
        const type = mustMatch(node, leftType, rightType);
        requireCapability(leftType, capabilities, node);
        return result ?? type
    }

    function unary(
        node: Tree,
        target: Tree,
        capabilities: Capabilities,
        scopes: Scopes,
        result?: Type
    ): Type {
        const type = typeCheckExpr(target, scopes);
        requireCapability(type, capabilities, node);
        return result ?? type;
    }

    function dereference(
        node: Tree,
        target: Tree,
        scopes: Scopes
    ): Type {
        const type = read(typeCheckExpr(target, scopes));
        if (type.kind == TypeKind.Pointer) {
            return { kind: TypeKind.Location, type: type.target }
        }
        error(node, "Expected a pointer type")
    }

    function addressOf(
        node: Tree,
        target: Tree,
        scopes: Scopes
    ): Type {
        const type = typeCheckExpr(target, scopes)
        if (type.kind == TypeKind.Location && type.addressable) {
            return { kind: TypeKind.Pointer, target: type }
        }
        error(node, "The value does not have an address")
    }

    function validateConst(tree: Tree, scopes: Scopes) {
        switch (tree.kind) {
            case NodeKind.Reference:
                const type = required(scopes.scope.find(tree.name))
                if (type.kind == TypeKind.Location) {
                    error(tree, "Expected a constant expression")
                }
                break
            case NodeKind.Add:
            case NodeKind.Subtract:
            case NodeKind.Multiply:
            case NodeKind.Divide:
            case NodeKind.Compare:
            case NodeKind.And:
            case NodeKind.Or:
                validateConst(tree.left, scopes)
                validateConst(tree.right, scopes)
                break
            case NodeKind.Negate:
            case NodeKind.Not:
                validateConst(tree.target, scopes)
                break
            case NodeKind.Literal:
                break
            default:
                error(tree, "Expected a constant expression")
        }
    }

    function typeCheckExpr(tree: Tree, scopes: Scopes): Type {
        if (result.has(tree)) {
            return result.get(tree)!!
        }
        let type: Type = { kind: TypeKind.Void }
        switch (tree.kind) {
            case NodeKind.Reference:
                type = reference(tree, scopes)
                break
            case NodeKind.Add:
                type = pointerBinary(tree, tree.left, tree.right, Capabilities.Numeric, scopes)
                break
            case NodeKind.Subtract:
                type = pointerBinary(tree, tree.left, tree.right, Capabilities.Numeric, scopes)
                break
            case NodeKind.Multiply:
                type = binary(tree, tree.left, tree.right, Capabilities.Numeric, scopes)
                break
            case NodeKind.Divide:
                type = binary(tree, tree.left, tree.right, Capabilities.Numeric, scopes)
                break
            case NodeKind.Negate:
                type = unary(tree, tree.target, Capabilities.Negatable, scopes)
                break
            case NodeKind.Not:
                type = unary(tree, tree.target, Capabilities.Logical, scopes)
                break
            case NodeKind.AddressOf:
                type = addressOf(tree, tree.target, scopes)
                break
            case NodeKind.Dereference:
                type = dereference(tree, tree.target, scopes)
                break
            case NodeKind.Compare:
                type = binary(tree, tree.left, tree.right, Capabilities.Comparable, scopes, booleanType)
                break
            case NodeKind.And:
                type = binary(tree, tree.left, tree.right, Capabilities.Logical, scopes)
                break
            case NodeKind.Or:
                type = binary(tree, tree.left, tree.right, Capabilities.Logical, scopes)
                break
            case NodeKind.BlockExpression:
                type = blockExpression(tree, scopes)
                break
            case NodeKind.IfThenElse:
                type = ifThenElseExpresssion(tree, scopes)
                break
            case NodeKind.Loop:
                type = loopStatement(tree, scopes)
                break
            case NodeKind.Switch:
                type = switchStatement(tree, scopes)
                break
            case NodeKind.Break: {
                const name = tree.name ?? '$$top';
                if (scopes.breaks.find(name) === undefined) {
                    error(tree, tree.name === undefined ? "Not in a block" : `Label ${name} not found`)
                }
                type = voidType
                break
            }
            case NodeKind.BreakIndexed: {
                type = breakIndexed(tree, scopes)
                break
            }
            case NodeKind.Continue: {
                const name = tree.name ?? `$$top`
                if (scopes.continues.find(name) === undefined){
                    error(tree, tree.name === undefined ? "Not in a block" : `Label ${name} not found`)
                }
                type = voidType
                break
            }
            case NodeKind.Return:
                type = returnStatement(tree, scopes)
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
                    case LiteralKind.Null:
                        type = nullType
                        break
                }
                break
            case NodeKind.Function:
                type = func(tree, scopes)
                break
            case NodeKind.StructLit:
                type = structLit(tree, scopes)
                break
            case NodeKind.ArrayLit:
                type = arrayLiteral(tree, scopes)
                break
            case NodeKind.Call:
                type = call(tree, scopes)
                break
            case NodeKind.Select:
                type = select(tree, scopes)
                break
            case NodeKind.Index:
                type = index(tree, scopes)
                break
            case NodeKind.Assign:
                type = assign(tree, scopes)
                break
            case NodeKind.As: {
                const leftType = typeCheckExpr(tree.left, scopes)
                expectPointer(tree.left, leftType)
                const rightType = typeExpr(tree.right, scopes)
                type = expectPointer(tree.right, rightType)
                break
            }
            default:
                error(tree, `Unsupported node ${nameOfNodeKind(tree.kind)}`)
        }
        bind(tree, type);
        return type
    }

    function func(tree: Function, scopes: Scopes): Type {
        const parameters = funcParameters(tree.parameters, scopes)
        const resultType = typeExpr(tree.result, scopes)
        const bodyScope = new Scope(parameters, scopes.scope)
        bodyScope.enter("$$result", resultType)
        const funcType: Type = { kind: TypeKind.Function, parameters, result: resultType }
        bodyScope.enter(tree.name, funcType)
        const bodyResult = typeCheckStatements(tree.body, {...scopes,  scope: bodyScope })
        if (bodyResult.kind != TypeKind.Void) {
            mustMatch(tree, bodyResult, resultType)
        }
        return funcType;
    }

    function funcParameters(parameterNodes: Parameter[], scopes: Scopes): Scope<Type> {
        const parameters = new Scope<Type>()
        for (const parameter of parameterNodes) {
            if (parameters.has(parameter.name)) error(parameter, `Duplicate parameter name`)
            const type = typeExpr(parameter.type, scopes)
            const parameterType: Type = { kind: TypeKind.Location, type }
            bind(parameter, parameterType)
            parameters.enter(parameter.name, parameterType)
        }
        return parameters
    }

    function call(tree: Call, scopes: Scopes): Type {
        const callType = typeCheckExpr(tree.target, scopes)
        requireCapability(callType, Capabilities.Callable, tree.target)
        if (callType.kind != TypeKind.Function) error(tree.target, `Expected a function reference`)
        if (tree.arguments.length != callType.parameters.size) {
            error(tree, `Expected ${callType.parameters.size} arguments, received ${tree.arguments.length}`)
        }
        let index = 0
        callType.parameters.forEach((name, type) => {
            const arg = tree.arguments[index++]
            const argType = typeCheckExpr(arg, scopes)
            mustMatch(arg, argType, type)
        })
        return callType.result
    }

    function select(tree: Select, scopes: Scopes): Type {
        const originalTarget = typeCheckExpr(tree.target, scopes)
        const targetType = read(originalTarget)
        function fieldTypeOf(type: StructType): Type {
            const fieldType = type.fields.find(tree.name)
            if (!fieldType) error(tree, `Type ${typeToString(targetType)} does not have member "${tree.name}"`)
            if (originalTarget.kind == TypeKind.Location && fieldType.kind != TypeKind.Location)
                return { kind: TypeKind.Location, type: fieldType }
            return fieldType

        }
        switch (targetType.kind) {
            case TypeKind.Struct:
                return fieldTypeOf(targetType);
            case TypeKind.Pointer:
                const refType = expectStruct(targetType.target, tree.target);
                return fieldTypeOf(refType);
            default:
                const builtins = builtInMethodsOf(targetType)
                const memberType = builtins.find(tree.name)
                if (!memberType) error(tree, `Type ${typeToString(targetType)} does not have a member "${tree.name}"`)
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

    function index(tree: Index, scopes: Scopes): Type {
        const targetType = typeCheckExpr(tree.target, scopes)
        requireCapability(targetType, Capabilities.Indexable, tree)
        const array = expectArray(targetType, tree)
        const elementType = array.elements
        if (targetType.kind == TypeKind.Location)
            return { kind: TypeKind.Location, type: elementType, addressable: targetType.addressable }
        return elementType
    }

    function assign(tree: Assign, scopes: Scopes): Type {
        const targetType = typeCheckExpr(tree.target, scopes)
        if (targetType.kind != TypeKind.Location) error(tree, `Expected a lvalue`)
        const type = targetType.type
        const valueType = typeCheckExpr(tree.value, scopes)
        mustMatch(tree, valueType, type)
        return voidType
    }

    function structLit(tree: StructLit, scopes: Scopes): Type {
        const fields = new Scope<Type>()
        for (const item of tree.body) {
            switch (item.kind) {
                case NodeKind.Field: {
                    const fieldType = typeCheckExpr(item.value, scopes)
                    if (fields.has(item.name)) error(item, `Duplicate field name`)
                    fields.enter(item.name, { kind: TypeKind.Location, type: fieldType })
                    break
                }
            }
        }
        return { kind: TypeKind.Struct, fields }
    }

    function reference(ref: Reference, scopes: Scopes): Type {
        const result = scopes.scope.find(ref.name)
        if (!result) {
            error(ref, `Symbol "${ref.name}" not found`)
        }
        return result
    }

    function blockExpression(block: BlockExpression, scopes: Scopes): Type {
        const breaks = new Scope<Tree>(scopes.breaks)
        const name = block.name
        if (name) {
            enter(block, name, block, breaks)
        }
        enter(block, '$$top', block, breaks)
        return typeCheckStatements(block.block, {...scopes, breaks })
    }

    function ifThenElseExpresssion(tree: IfThenElse, scopes: Scopes): Type {
        const conditionType = typeCheckExpr(tree.condition, scopes)
        mustMatch(tree.condition, conditionType, booleanType)
        const thenType = typeCheckExpr(tree.then, scopes)
        const elseNode = tree.else
        var ifType: Type
        if (!elseNode) {
            ifType = voidType
        } else {
            const elseType = typeCheckExpr(elseNode, scopes)
            mustMatch(tree, elseType, thenType)
            ifType = thenType
        }
        return ifType
    }

    function loopStatement(loop: Loop, scopes: Scopes): Type {
        const continues = new Scope<Tree>(scopes.continues)
        const breaks = new Scope<Tree>(scopes.breaks)
        const name = loop.name
        if (name) {
            enter(loop, name, loop, continues)
            enter(loop, name, loop, breaks)
        }
        enter(loop, '$$top', loop, continues)
        enter(loop, '$$top', loop, breaks)
        typeCheckStatements(loop.body, {...scopes, continues, breaks })
        return voidType
    }

    function breakIndexed(tree: BreakIndexed, scopes: Scopes): Type {
        const expressionType = typeCheckExpr(tree.expression, scopes)
        mustMatch(tree, i32Type, expressionType)
        for (const name of tree.labels) {
            if (!scopes.breaks.find(name)) {
                error(tree, `Could not find block with name ${name}`)
            }
        }
        if (tree.else) {
            if (!scopes.breaks.find(tree.else)) {
                error(tree, `Could not find block with name ${tree.else}`)
            }
        }
        return voidType
    }

    function returnStatement(ret: Return, scopes: Scopes): Type {
        const value = ret.value
        const expectType = scopes.scope.find("$$result")
        if (value) {
            if (!expectType) error(ret, "No result expected of a void type")
            const valueType = typeCheckExpr(value, scopes)
            mustMatch(value, expectType, valueType)
        } else {
            if (expectType) error(ret, `Result value of type ${typeToString(expectType)}`)
        }
        return voidType
    }

    function switchStatement(tree: Switch, scopes: Scopes): Type {
        const expressionType = typeCheckExpr(tree.target, scopes)
        mustMatch(tree.target, expressionType, i32Type)
        for (const cs of tree.cases) {
            switchCase(cs, scopes)
        }
        return voidType
    }

    function switchCase(tree: SwitchCase, scopes: Scopes) {
        for (const expression of tree.expressions) {
            const exprType = typeCheckExpr(expression, scopes)
            mustMatch(expression, exprType, i32Type)
        }
        typeCheckStatements(tree.body, scopes)
    }

    function arrayLiteral(tree: ArrayLit, scopes: Scopes): Type {
        const elements = tree.values
        const len = elements.length
        if (len > 0) {
            const elementType = typeCheckExpr(elements[0], scopes)
            for (let i = 1; i < len; i++) {
                const element = elements[i]
                const type = typeCheckExpr(element, scopes)
                mustMatch(element, elementType, type)
            }
            return { kind: TypeKind.Array, elements: elementType, size: elements.length }
        }
        return { kind: TypeKind.Unknown }
    }

    function typeExpr(tree: Tree, scopes: Scopes): Type {
        switch (tree.kind) {
            case NodeKind.Reference: {
                const result = scopes.scope.find(tree.name)
                if (!result) error(tree, `Type ${tree.name} not found.`)
                if (result.kind == TypeKind.Location) error(tree, "Expected a type reference")
                return result
            }
            case NodeKind.Select:
                error(tree, "Nested scopes not yet supported")
            case NodeKind.ArrayCtor: {
                const elements = typeExpr(tree.element, scopes)
                return { kind: TypeKind.Array, elements, size: tree.size }
            }
            case NodeKind.PointerCtor: {
                const target = typeExpr(tree.target, scopes)
                return { kind: TypeKind.Pointer, target }
            }
            case NodeKind.StructTypeLit:
                return structTypeLiteral(tree, scopes)
            default:
                error(tree, `Unsupported node in type expression: ${nameOfNodeKind(tree.kind)}`)
        }
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

    function structTypeLiteral(tree: StructTypeLit, scopes: Scopes): Type {
        const fields = new Scope<Type>()
        for (const field of tree.fields) {
            if (fields.has(field.name)) error(field, `Dupicate symbol`)
            const fieldType = typeExpr(field.type, scopes)
            const unknown = hasUnknown(fieldType)
            if (unknown) {
                error(field.type, `Fields cannot be of an incomplete or recursive type ${unknown.name}`);
            }
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
            if (from.kind == TypeKind.Null || to.kind == TypeKind.Null) {
                return nullTypeMatch(location, from, to)
            }
            error(location, `Expected type ${typeToString(from)}, received ${typeToString(to)}`);
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
            error(location, `Expected type ${typeToString(type)} be a pointer was ${nameOfTypeKind(type.kind)}`)
        }
        return type
    }
}

function error(location: Locatable, message: string): never {
    const e = new Error(message) as any
    e.start = location.start
    e.end = location.end
    throw e
}

function required<T>(value: T | undefined): T {
    if (!value)
        throw new Error("Required a value")
    return value
}