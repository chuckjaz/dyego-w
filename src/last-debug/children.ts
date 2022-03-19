import {
    BodyElement, copy, Declaration, Exportable, Expression, Field, Import, ImportItem, Last, LastKind, Parameter,
    Reference, FieldLiteral, TypeExpression
} from "../last";

export class Separator { readonly isSeparator = true }

const separator: Separator = new Separator()

export function * childrenOf(last: Last): Iterable<Last | Separator> {
    switch (last.kind) {
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
        case LastKind.As: {
            yield last.left
            yield last.right
            break
        }
        case LastKind.Negate:
        case LastKind.Not:
        case LastKind.Dereference:
        case LastKind.AddressOf:
        case LastKind.SizeOf: {
            yield last.target
            break
        }
        case LastKind.StructLiteral: {
            yield * last.fields
            break
        }
        case LastKind.Field: {
            yield last.name
            yield last.value
            break
        }
        case LastKind.ArrayLiteral: {
            const values = last.values
            if (!('buffer' in values))
                yield * values
            break
        }
        case LastKind.Block:
        case LastKind.Loop: {
            if (last.name) yield last.name
            yield * last.body
            yield separator
            break
        }
        case LastKind.IfThenElse: {
            yield last.condition
            yield * last.then
            yield separator
            yield * last.else
            yield separator
            break
        }
        case LastKind.Branch: {
            if (last.target) yield last.target
            break
        }
        case LastKind.BranchIndexed: {
            yield last.condition
            yield * last.targets
            yield separator
            yield last.else
            break
        }
        case LastKind.Return: {
            if (last.value) yield last.value
            break
        }
        case LastKind.Select: {
            yield last.target
            yield last.name
            break
        }
        case LastKind.Index: {
            yield last.target
            yield last.index
            break
        }
        case LastKind.Assign: {
            yield last.target
            yield last.value
            break
        }
        case LastKind.Function: {
            yield last.name
            yield * last.parameters
            yield separator
            yield last.result
            yield * last.body
            yield separator
            break
        }
        case LastKind.Parameter: {
            yield last.name
            yield last.type
            break
        }
        case LastKind.Call: {
            yield last.target
            yield * last.arguments
            yield separator
            break
        }
        case LastKind.Global:
        case LastKind.Let: {
            yield last.name
            yield last.type
            yield last.value
            break
        }
        case LastKind.Var: {
            yield last.name
            if (last.type) yield last.type
            yield separator
            if (last.value) yield last.value
            yield separator
            break
        }
        case LastKind.Type: {
            yield last.name
            yield last.type
            break
        }
        case LastKind.TypeSelect: {
            yield last.target
            yield last.name
            break
        }
        case LastKind.StructTypeLiteral: {
            yield * last.fields
            break
        }
        case LastKind.FieldLiteral: {
            yield last.name
            yield last.type
            break
        }
        case LastKind.ArrayConstructor: {
            yield last.element
            break
        }
        case LastKind.PointerConstructor:
        case LastKind.Exported: {
            yield last.target
            break
        }
        case LastKind.Import: {
            yield * last.imports
            break
        }
        case LastKind.ImportFunction: {
            yield last.module
            yield last.name
            if (last.as) yield last.as
            yield separator
            yield * last.parameters
            yield separator
            yield last.result
            break
        }
        case LastKind.ImportVariable: {
            yield last.module
            yield last.name
            if (last.as) yield last.as
            yield separator
            yield last.type
            break
        }
        case LastKind.Module: {
            yield * last.imports
            yield separator
            yield * last.declarations
            yield separator
            break
        }
    }
}

export function updateFromChildren(last: Last, children: Iterable<Last | Separator>): Last {
    const iterator = children[Symbol.iterator]()

    function nextValue(): Last | Separator {
        const next = iterator.next()
        if (next.done) error()
        return next.value
    }

    function next<T extends Last>(): T {
        const value = nextValue()
        if (value instanceof Separator) error()
        if (!('kind' in value)) error()
        return value as T
     }

     function optionalNext<T extends Last>(): T | undefined {
        const value = nextValue()
        if (value instanceof Separator) return undefined
        if (!('kind' in value)) error()
        const sep = nextValue()
        if (!(value instanceof Separator)) error()
        return value as T
     }

     function array<T extends Last>(): T[] {
        const result: T[] = []
        while (true) {
            const next = iterator.next()
            if (next.done) break
            const value = next.value
            if (value instanceof Separator) break
            if (!('kind' in value)) error()
            result.push(value as T)
        }
        return result
     }

    switch (last.kind) {
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
            const left = next<Expression>()
            const right = next<Expression>()
            if (left !==  last.left || right !== last.right) {
                return copy(last, { left, right })
            }
            return last
        }
        case LastKind.As: {
            const left = next<Expression>()
            const right = next<TypeExpression>()
            if (left !== last.left || right !== last.right) {
                return copy(last, { left, right })
            }
            return last
        }
        case LastKind.Negate:
        case LastKind.Not:
        case LastKind.Dereference:
        case LastKind.AddressOf: {
            const target = next<Expression>()
            if (target !== last.target) {
                return copy(last, { target })
            }
            return last
        }
        case LastKind.SizeOf: {
            const target = next<TypeExpression>()
            if (target !== last.target) {
                return copy(last, { target })
            }
            return last
        }
        case LastKind.StructLiteral: {
            const fields = array<Field>()
            if (!arrayEqual(fields, last.fields)) {
                return copy(last, { fields })
            }
            return last
        }
        case LastKind.Field: {
            const name = next<Reference>()
            const value = next<Expression>()
            if (name !== last.name || value !== last.value) {
                return copy(last, { name, value })
            }
            return last
        }
        case LastKind.ArrayLiteral: {
            const oldValues = last.values
            if (!('buffer' in oldValues)) {
                const values = array<Expression>()
                if (!arrayEqual(values, oldValues)) {
                    return copy(last, { values })
                }
            }
            return last
        }
        case LastKind.Block:
        case LastKind.Loop: {
            const name = optionalNext<Reference>()
            const body = array<BodyElement>()
            if (name !== last.name || !arrayEqual(body, last.body)) {
                return copy(last, { name, body })
            }
            return last
        }
        case LastKind.IfThenElse: {
            const condition = next<Expression>()
            const then = array<BodyElement>()
            const else_ = array<BodyElement>()
            if (
                condition !== last.condition ||
                !arrayEqual(then, last.then) ||
                !arrayEqual(else_, last.else)
            ) {
                return copy(last, { condition, then, else: else_ })
            }
            return last
        }
        case LastKind.Branch: {
            const target = optionalNext<Reference>()
            if (target !== last.target) {
                return copy(last, { target })
            }
            return last
        }
        case LastKind.BranchIndexed: {
            const condition = next<Expression>()
            const targets = array<Reference>()
            const else_ = next<Reference>()
            if (
                condition !== last.condition ||
                !arrayEqual(targets, last.targets) ||
                else_ !== last.else
            ) {
                return copy(last, { condition, targets, else: else_ })
            }
            return last
        }
        case LastKind.Return: {
            const value = optionalNext<Expression>()
            if (value !== last.value) {
                return copy(last, { value })
            }
            return last
        }
        case LastKind.Select: {
            const target = next<Expression>()
            const name = next<Reference>()
            if (target !== last.target || name !== last.name) {
                return copy(last, { target, name })
            }
            return last
        }
        case LastKind.Index: {
            const target = next<Expression>()
            const index = next<Expression>()
            if (target !== last.target || index !== last.index) {
                return copy(last, { target, index })
            }
            return last
        }
        case LastKind.Assign: {
            const target = next<Expression>()
            const value = next<Expression>()
            if (target !== last.target || value !== last.value) {
                return copy(last, { target, value })
            }
            return last
        }
        case LastKind.Function: {
            const name = next<Reference>()
            const parameters = array<Parameter>()
            const result = next<TypeExpression>()
            const body = array<BodyElement>()
            if (
                name !== last.name ||
                !arrayEqual(parameters, last.parameters) ||
                result != last.result ||
                !arrayEqual(body, last.body)
            ) {
                return copy(last, { name, parameters, result, body })
            }
            return last
        }
        case LastKind.Parameter: {
            const name = next<Reference>()
            const type = next<TypeExpression>()
            if (name !== last.name || type !== last.type) {
                return copy(last, { name, type })
            }
            return last
        }
        case LastKind.Call: {
            const target = next<Expression>()
            const args = array<Expression>()
            if (target !== last.target || !arrayEqual(args, last.arguments)) {
                return copy(last, { target, arguments: args })
            }
            return last
        }
        case LastKind.Global:
        case LastKind.Let: {
            const name = next<Reference>()
            const type = next<TypeExpression>()
            const value = next<Expression>()
            if (name !== last.name || type !== last.type || value !== last.value) {
                return copy(last, { name, type, value })
            }
            return last
        }
        case LastKind.Var: {
            const name = next<Reference>()
            const type = optionalNext<TypeExpression>()
            const value = optionalNext<Expression>()
            if (name !== last.name || type !== last.type || value !== last.value) {
                return copy(last, { name, type, value })
            }
            return last
        }
        case LastKind.Type: {
            const name = next<Reference>()
            const type = next<TypeExpression>()
            if (name !== last.name || type !== last.type) {
                return copy(last, { name, type })
            }
            return last
        }
        case LastKind.TypeSelect: {
            const target = next<TypeExpression>()
            const name = next<Reference>()
            if (target !== last.target || name !== last.name) {
                return copy(last, { target, name })
            }
            return last
        }
        case LastKind.StructTypeLiteral: {
            const fields = array<FieldLiteral>()
            if (!arrayEqual(fields, last.fields)) {
                return copy(last, { fields })
            }
            return last
        }
        case LastKind.FieldLiteral: {
            const name = next<Reference>()
            const type = next<TypeExpression>()
            if (name !== last.name || type !== last.type) {
                return copy(last, { name, type })
            }
            return last
        }
        case LastKind.ArrayConstructor: {
            const element = next<TypeExpression>()
            if (element !== last.element) {
                return copy(last, { element })
            }
            return last
        }
        case LastKind.PointerConstructor: {
            const target = next<TypeExpression>()
            if (target !== last.target) {
                return copy(last, { target })
            }
            return last
        }
        case LastKind.Exported: {
            const target = next<Exportable>()
            if (target !== last.target) {
                return copy(last, { target })
            }
            return last
        }
        case LastKind.Import: {
            const imports = array<ImportItem>()
            if (!arrayEqual(imports, last.imports)) {
                return copy(last, { imports })
            }
            return last
        }
        case LastKind.ImportFunction: {
            const module = next<Reference>()
            const name = next<Reference>()
            const as = optionalNext<Reference>()
            const parameters = array<Parameter>()
            const result = next<TypeExpression>()
            if (
                module !== last.module ||
                name !== last.name ||
                as !== last.as ||
                !arrayEqual(parameters, last.parameters) ||
                result !== last.result
            ) {
                return copy(last, { module, name, as, parameters, result })
            }
            return last
        }
        case LastKind.ImportVariable: {
            const module = next<Reference>()
            const name = next<Reference>()
            const as = optionalNext<Reference>()
            const type = next<TypeExpression>()
            if (module !== last.module || name !== last.name || as !== last.as || type !== last.type) {
                return copy(last, { module, name, as, type })
            }
            return last
        }
        case LastKind.Module: {
            const imports = array<Import>()
            const declarations = array<Declaration>()
            if (
                !arrayEqual(imports, last.imports) ||
                !arrayEqual(declarations, last.declarations)
            ) {
                return copy(last, { imports, declarations })
            }
            return last
        }
    }
    return last
}

function arrayEqual(a: Last[], b: Last[]): boolean {
    if (a.length != b.length) return false
    for (let i = 0, len = a.length; i < len; i++) {
        if (a[i] !== b[i]) return false
    }
    return true
}

function error() {
    throw new Error("Unexpected last shape")
}