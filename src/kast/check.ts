import * as last from '../last'
import { Block, BodyElement, Call, Declaration, Expression, FieldLiteral, KastKind, Loop, Module, StructTypeLiteral, TypeExpression, UnionTypeLiteral } from './ast'
import { createBuiltins, makeArray, makePointer } from './builtins'
import { ArrayType, ErrorType, FunctionType, StructType, Type, TypeKind, UnionType } from './types'
import { Locatable, Scope } from '../last'
import { required } from '../utils'

export type Typeable = Expression | Declaration
export interface CheckResult {
    types: Map<Typeable, Type>
    definitions: Map<Type, Locatable>
    exported: Set<String>
    implicitGets: Set<Expression>
}

export function check(module: Module): CheckResult | Diagnostic[] {
    const diagnostics: Diagnostic[] = []
    const types = new Map<Typeable, Type>();
    const definitions = new Map<any, Locatable>();
    const exported = new Set<String>()
    const implicitGets = new Set<Expression>()
    const fixups = new Map<Type, ((final: Type) => void)[]>()
    const builtins = createBuiltins()
    const errorType: ErrorType = { kind: TypeKind.Error }
    const primitives: any = { }

    checkModule(module, {
        types: scope(builtins),
        expressions: emptyScope(),
        branchTargets: emptyScope()
    })

    return diagnostics.length ? diagnostics : { types, definitions, exported, implicitGets }

    function checkModule(module: Module, scopes: Scopes) {
        enterDeclarations(module.declarations, scopes)
    }

    function enterDeclarations(declarations: Declaration[], scopes: Scopes) {
        // Predeclare any types
        for (const declaration of declarations) {
            switch (declaration.kind) {
                case KastKind.Type:
                    const instance: any = { }
                    enter(declaration, declaration.name.name, instance, scopes.types)
            }
        }

        // Enter declarations
        for (const declaration of declarations) {
            enterDeclaration(declaration, scopes)
        }
    }

    function enterDeclaration(declaration: Declaration, scopes: Scopes) {
        switch (declaration.kind) {
            case KastKind.Exported:
                exported.add(declaration.target.name.name)
                enterDeclaration(declaration.target, scopes)
                break
            case KastKind.Let: {
                const type = typeExpr(declaration.type, scopes)
                enter(declaration, declaration.name.name, type, scopes.expressions)
                bind(declaration, type)
                break
            }
            case KastKind.Var: {
                const typeExpression = declaration.type
                const initializer = declaration.value
                const rawType = typeExpression ? typeExpr(typeExpression, scopes) :
                    initializer ? checkExpression(initializer, scopes) : (function() {
                        report(declaration, `Must have an initializer or a type`)
                        errorType
                    }())
            }
        }
    }

    function checkExpression(expr: Expression, scopes: Scopes): Type {
        switch (expr.kind) {
            case KastKind.Literal: 
                return primitive(expr.primitiveKind)
            case KastKind.Block:
                return checkBlockOrLoop(expr, scopes)
            case KastKind.Call:
                return checkCall(expr, scopes)
        }

        expr
    }

    function checkBlockOrLoop(expr: Block | Loop, scopes: Scopes): Type {
        const blockScopes = newScopes(scopes)
        const name = expr.name
        if (name) {
            enter(expr, name.name, expr, blockScopes.branchTargets)
        }
        enter(expr, "$$top", expr, blockScopes.branchTargets)
        return checkBody(expr.body, blockScopes)
    }

    function checkBody(body: BodyElement[], scopes: Scopes): Type {
        enterDeclarations(body.filter(i => i.kind == KastKind.Var || i.kind == KastKind.Let) as Declaration[], scopes)
        let type: Type | undefined = undefined
        for (const item of body) {
            type = checkBodyElement(item, scopes)
        }
        return type || primitive(last.PrimitiveKind.Void)
    }

    function checkBodyElement(element: BodyElement, scopes: Scopes): Type {
        switch (element.kind) {
            case KastKind.Var:
            case KastKind.Let:
            case KastKind.Type:
                return checkDeclaration(element, scopes)
            case KastKind.Block:
            case KastKind.Loop:
                return checkBlockOrLoop(element, scopes)
            case KastKind.Assign:
                return checkAssign(element, scopes)
            case KastKind.BranchReference:
                validateBranchTarget(element, element.name, scopes)
                return required(builtins.find('void'))
            case KastKind.BranchIndexed: {
                const condition = checkExpression(element.condition, scopes)
                mustMatch(element.condition, condition, primitive(last.PrimitiveKind.I32))
                for (const target of element.targets) {
                    validateBranchTarget(element, target, scopes)
                }
                validateBranchTarget(element, element.else, scopes)
                return primitive(last.PrimitiveKind.Void)
            }
            case KastKind.Return: {
                const value = element.value
                const valueType = value ? checkExpression(value, scopes) : primitive(last.PrimitiveKind.Void)
                const functionType = required(scopes.expressions.find("$$result"))
                mustMatch(value || element, valueType, functionType)
                return primitive(last.PrimitiveKind.Void)
            }
            default:
                return checkExpression(element, scopes)
        }
    }

    function checkCall(expr: Call, scopes: Scopes): Type {
        const targetType = checkExpression(expr, scopes)
        if (targetType.kind != TypeKind.Function) {
            if (targetType.kind == TypeKind.Error) return targetType
            report(expr, `Expected a function target`)
            return errorType
        }
        const len = expr.arguments.length;
        if (len != targetType.parameters.length) {
            report(expr, `Expected ${targetType.parameters.length} arguments but found ${expr.arguments.length}`)
            return errorType
        }
        for (let i = 0; i < len; i++) {
            const argument = expr.arguments[i]
            const parameterType = targetType.parameters[i]
            const argumentType = checkExpression(argument, scopes)
            mustMatch(argument, argumentType, parameterType)
        }
        return targetType.result
    }

    function asValue(expr: Expression, type: Type, scopes: Scopes): Type {
        if (type.kind == TypeKind.Struct) {
            const get = type.methods.find('location value')
            if (get) {
                implicitGets.add(expr)
                return get.result
            }
        }
        return type
    }

    function equivilent(from: Type, to: Type): boolean {
        if (from === to) return true
        if (to.kind == TypeKind.Error || from.kind == TypeKind.Error) return true
        if (from.kind == to.kind) {
            switch (from.kind) {
                case TypeKind.Struct: {
                    const _to: StructType = to as StructType
                    if ('primitive' in _to && 'primitive' in from && _to.primitive !== from.primitive) {
                        return false
                    }
                    return recursionGuard(from, _to, (from, to) => {
                        return equivlentScopes(from.fields, _to.fields) && equivlentScopes(from.methods, to.methods)                        
                    })
                }
                case TypeKind.Union:
                    return recursionGuard(from, to as UnionType, (from, to) => {
                        return equivlentScopes(from.fields, _to.fields)
                    })
                case TypeKind.Array: {
                    const _to = to as ArrayType
                    if (from.size != _to.size) return false
                    return equivilent(from.elements, _to.elements)
                }

            }
        }
        return false
    }

    function recursionGuard<T extends (Type & { comparingTo?: T[]})>(from: T, to: T, predicate: (from: T, to: T) => boolean) {
        if ((from.comparingTo?.indexOf(to) ?? -1) >= 0 ||(to.comparingTo?.indexOf(from) ?? -1) >= 0) {
            return true
        } 
        const oldFrom = from.comparingTo
        const oldTo = to.comparingTo
        try {
            return predicate(from, to)
        } finally {
            from.comparingTo = oldFrom
            to.comparingTo = oldTo
        }
    }
    
    function primitiveName(kind: last.PrimitiveKind): string {
        switch (kind) {
            case last.PrimitiveKind.Bool: return 'bool'
            case last.PrimitiveKind.F32: return 'f32'
            case last.PrimitiveKind.F64: return 'f64'
            case last.PrimitiveKind.I16: return 'i16'
            case last.PrimitiveKind.I32: return 'i32'
            case last.PrimitiveKind.I64: return 'i64'
            case last.PrimitiveKind.I8: return 'i8'
            case last.PrimitiveKind.Null: return 'null'
            case last.PrimitiveKind.U16: return 'u16'
            case last.PrimitiveKind.U32: return 'u32'
            case last.PrimitiveKind.U64: return 'u64'
            case last.PrimitiveKind.U8: return 'u8'
            case last.PrimitiveKind.Void: return 'void'
        }
    }

    function primitive(kind: last.PrimitiveKind): Type {
        const name = primitiveName(kind)
        let result = primitives[name]
        if (!result) {
            result = required(builtins.find(name))
            primitives[name] = result
        }
        return result
    }

    function typeExpr(expr: TypeExpression, scopes: Scopes): Type {
        switch (expr.kind) {
            case KastKind.Reference: {
                const result = scopes.types.find(expr.name)
                if (!result) {
                    report(expr, `Type ${expr.name} not found.`)
                    return errorType
                }
                return result
            }
            case KastKind.ArrayConstructor: {
                const element = typeExpr(expr.element, scopes)
                const size = expr.size
                return makeArray(element, size)
            }
            case KastKind.PointerConstructor: {
                const target = typeExpr(expr.target, scopes)
                return makePointer(target)
            }
            case KastKind.StructTypeLiteral:
                return structTypeLiteral(expr, scopes);
            case KastKind.UnionTypeLiteral:
                return unionTypeLiteral(expr, scopes)
        }
    }

    function structTypeLiteral(expr: StructTypeLiteral, scopes: Scopes): StructType {
        const fields = enterFields(expr, scopes)
        const methods = emptyScope<FunctionType>()
        if (expr.methods.length > 0) {
            report(expr.methods[0], `Methods not supported yet`)
        }
        return {
            kind: TypeKind.Struct,
            fields,
            methods
        }
    }

    function unionTypeLiteral(expr: UnionTypeLiteral, scopes: Scopes): UnionType {
        const fields = enterFields(expr, scopes)
        return {
            kind: TypeKind.Union,
            fields
        }
    }

    function enterFields(expr: { fields: FieldLiteral[]}, scopes: Scopes): Scope<Type> {
        const fields = emptyScope<Type>()
        for (const field of expr.fields) {
            if (fields.has(field.name.name)) {
                report(field, `Duplicate field ${field.name}`, ...related(field.name.name, fields))
                continue
            }
            const fieldType = typeExpr(field.type, scopes)
            if (!('kind' in fieldType)) {
                report(field, `Cannot have a recursive type`)
                continue
            }
            fields.enter(field.name.name, fieldType)
        }
        return fields
    }


    function enter<T>(location: Locatable, name: string, item: T, scope: Scope<T>) {
        if (scope.has(name)) {
            report(location, `Duplicate symbol ${name}`, ...related(name, scope))
        }
        scope.enter(name, item)
        definitions.set(item, location)
    }

    function bind(item: Typeable, type: Type) {
        types.set(item, type)
        if (isPredeclaredType(type)) {
            addFixup(type, (final) => types.set(item, final))
        }
    }

    function isPredeclaredType(type: Type): boolean {
        return !('kind' in type)
    }

    function addFixup(type: Type, fixup: (final: Type) => void) {
        const list = fixups.get(type) ?? []
        list.push(fixup);
        fixups.set(type, list);
    }

    function report(location: Locatable, message: string, ...related: Diagnostic[]) {
        diagnostics.push({
            location,
            message,
            related
        })
    }

    function related(name: string, scope: Scope<Type>): Diagnostic[] {
        const result = []
        const relatedLocation = definitions.get(scope.find(name))
        if (relatedLocation) {
            result.push(({
                location: relatedLocation,
                message: 'Location of previous declaration'
            }))
        }
        return result
    }

}

type Diagnostic = last.Diagnostic

interface Scopes {
    types: Scope<Type>,
    expressions: Scope<Type>,
    branchTargets: Scope<BranchTarget>
}

type BranchTarget =
    Loop | Block


function emptyScope<T>(): Scope<T> {
    return new Scope()
}

function scope<T>(base: Scope<T>): Scope<T> {
    return new Scope(base)
}

function newScopes(scopes: Scopes): Scopes {
    return {
        types: scope(scopes.types),
        expressions: scope(scopes.expressions),
        branchTargets: scope(scopes.branchTargets),
    }
}