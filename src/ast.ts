export const enum NodeKind {
    Add,
    Subtract,
    Multiply,
    Divide,
    Negate,
    Not,
    Compare,
    And,
    Or,
    As,
    AddressOf,
    Dereference,
    BlockExpression,
    IfThenElse,
    Loop,
    Switch,
    SwitchCase,
    Break,
    BreakIndexed,
    Continue,
    Return,
    Literal,
    StructLit,
    ArrayLit,
    Field,
    Reference,
    Select,
    Spread,
    Index,
    FieldRef,
    Assign,
    Function,
    Parameter,
    Call,
    Let,
    Var,
    Type,
    StructTypeLit,
    StructField,
    ArrayCtor,
    PointerCtor,
    Import,
    ImportFunction
}

export function nameOfNodeKind(kind: NodeKind): string {
    switch (kind) {
        case NodeKind.Add: return "Add"
        case NodeKind.Subtract: return "Subtract"
        case NodeKind.Multiply: return "Multiply"
        case NodeKind.Divide: return "Divide"
        case NodeKind.Negate: return "Negate"
        case NodeKind.Not: return "Not"
        case NodeKind.Compare: return "Compare"
        case NodeKind.And: return "And"
        case NodeKind.Or: return "Or"
        case NodeKind.As: return "As"
        case NodeKind.AddressOf: return "AddressOf"
        case NodeKind.Dereference: return "Dereference"
        case NodeKind.BlockExpression: return "BlockExpression"
        case NodeKind.IfThenElse: return "IfThenElse"
        case NodeKind.Loop: return "Loop"
        case NodeKind.Switch: return "Switch"
        case NodeKind.SwitchCase: return "SwitchCase"
        case NodeKind.Break: return "Break"
        case NodeKind.BreakIndexed: return 'BreakIndexed'
        case NodeKind.Continue: return "Continue"
        case NodeKind.Return: return "Return"
        case NodeKind.Literal: return "Literal"
        case NodeKind.StructLit: return "StructLit"
        case NodeKind.ArrayLit: return "ArrayLit"
        case NodeKind.Field: return "Field"
        case NodeKind.Reference: return "Reference"
        case NodeKind.Select: return "Select"
        case NodeKind.Spread: return "Spread"
        case NodeKind.Index: return "Index"
        case NodeKind.FieldRef: return "FieldRef"
        case NodeKind.Assign: return "Assign"
        case NodeKind.Function: return "Function"
        case NodeKind.Parameter: return "Parameter"
        case NodeKind.Call: return "Call"
        case NodeKind.Let: return "Let"
        case NodeKind.Var: return "Var"
        case NodeKind.Type: return "Type"
        case NodeKind.StructTypeLit: return "StructTypeLit"
        case NodeKind.StructField: return "StructField"
        case NodeKind.ArrayCtor: return "ArrayCtor"
        case NodeKind.PointerCtor: return "PointerCtor"
        case NodeKind.Import: return "Import"
        case NodeKind.ImportFunction: return "ImportItem"
    }
}

export type Tree =
    Add |
    Subtract |
    Multiply |
    Divide |
    Compare |
    And |
    Or |
    As |
    Negate |
    Not |
    AddressOf |
    Dereference |
    BlockExpression |
    IfThenElse |
    Loop |
    Switch |
    SwitchCase |
    Break |
    BreakIndexed |
    Continue |
    Return |
    Literal |
    StructLit |
    ArrayLit |
    Field |
    Reference |
    Select |
    Spread |
    Index |
    FieldRef |
    Assign |
    Function |
    Parameter |
    Call |
    Let |
    Var |
    Type |
    StructTypeLit |
    StructField |
    ArrayCtor |
    PointerCtor |
    Import |
    ImportItem

export interface Locatable {
    start?: number
    end?: number
}

export interface Add extends Locatable {
    kind: NodeKind.Add
    left: Tree
    right: Tree
}

export interface Subtract extends Locatable {
    kind: NodeKind.Subtract
    left: Tree
    right: Tree
}

export interface Multiply extends Locatable {
    kind: NodeKind.Multiply
    left: Tree
    right: Tree
}

export interface Divide extends Locatable {
    kind: NodeKind.Divide
    left: Tree
    right: Tree
}

export interface Negate extends Locatable {
    kind: NodeKind.Negate
    target: Tree
}

export interface Not extends Locatable {
    kind: NodeKind.Not
    target: Tree
}

export const enum CompareOp {
    Equal,
    NotEqual,
    LessThan,
    LessThanEqual,
    GreaterThan,
    GreaterThanEqual,
    Unknown,
}

export function nameOfCompareOp(op: CompareOp): string {
    switch (op) {
        case CompareOp.Equal: return "Equal"
        case CompareOp.NotEqual: return "NotEqual"
        case CompareOp.LessThan: return "LessThan"
        case CompareOp.LessThanEqual: return "LessThanEqual"
        case CompareOp.GreaterThan: return "GreaterThan"
        case CompareOp.GreaterThanEqual: return "GreaterThanEqual"
        case CompareOp.Unknown: return "Unknown"
    }
}

export interface Compare extends Locatable {
    kind: NodeKind.Compare
    op: CompareOp
    left: Tree
    right: Tree
}

export interface And extends Locatable {
    kind: NodeKind.And
    left: Tree
    right: Tree
}

export interface Or extends Locatable {
    kind: NodeKind.Or
    left: Tree
    right: Tree
}

export interface As extends Locatable {
    kind: NodeKind.As
    left: Tree
    right: Tree
}

export interface AddressOf extends Locatable {
    kind: NodeKind.AddressOf
    target: Tree
}

export interface Dereference extends Locatable {
    kind: NodeKind.Dereference
    target: Tree
}

export interface BlockExpression extends Locatable {
    kind: NodeKind.BlockExpression
    name?: string
    block: Tree[]
}

export interface IfThenElse extends Locatable {
    kind: NodeKind.IfThenElse
    condition: Tree
    then: Tree
    else?: Tree
}

export interface Loop extends Locatable {
    kind: NodeKind.Loop
    name?: string
    body: Tree[]
}

export interface Switch extends Locatable {
    kind: NodeKind.Switch
    target: Tree
    name?: string
    cases: SwitchCase[]
}

export interface SwitchCase extends Locatable {
    kind: NodeKind.SwitchCase
    expressions: Tree[]
    default?: boolean
    body: Tree[]
}

export interface Break extends Locatable {
    kind: NodeKind.Break
    name?: string
}

export interface BreakIndexed extends Locatable {
    kind: NodeKind.BreakIndexed
    expression: Tree
    labels: string[]
    else: string
}

export interface Continue extends Locatable {
    kind: NodeKind.Continue
    name?: string
}

export interface Return extends Locatable {
    kind: NodeKind.Return
    value?: Tree
}

export const enum LiteralKind {
    Int,
    Double,
    Boolean,
    Null,
}

export function nameOfLiteralKind(kind: LiteralKind): string {
    switch (kind) {
        case LiteralKind.Boolean: return "Boolean";
        case LiteralKind.Int: return "Int";
        case LiteralKind.Double: return "Double";
        case LiteralKind.Null: return "Null";
    }
}

export type Literal =
    LiteralInt |
    LiteralDouble |
    LiteralBoolean |
    LiteralNull

export interface LiteralInt extends Locatable {
    kind: NodeKind.Literal
    literalKind: LiteralKind.Int
    value: number
}

export interface LiteralDouble extends Locatable {
    kind: NodeKind.Literal
    literalKind: LiteralKind.Double
    value: number
}

export interface LiteralBoolean extends Locatable {
    kind: NodeKind.Literal
    literalKind: LiteralKind.Boolean
    value: boolean
}

export interface LiteralNull extends Locatable {
    kind: NodeKind.Literal
    literalKind: LiteralKind.Null
    value: null
}

export interface StructLit extends Locatable {
    kind: NodeKind.StructLit
    body: Tree[]
}

export interface Field extends Locatable {
    kind: NodeKind.Field
    name: string
    value: Tree
}

export interface ArrayLit extends Locatable {
    kind: NodeKind.ArrayLit
    values: Tree[]
}

export interface Reference extends Locatable {
    kind: NodeKind.Reference
    name: string
}

export interface Select extends Locatable {
    kind: NodeKind.Select
    target: Tree
    name: string
}

export interface Spread extends Locatable {
    kind: NodeKind.Spread
    target: Tree
}

export interface Index extends Locatable {
    kind: NodeKind.Index
    target: Tree
    index: Tree
}

export interface FieldRef extends Locatable {
    kind: NodeKind.FieldRef
    target: Tree
    index: number
}

export interface Assign extends Locatable {
    kind: NodeKind.Assign
    target: Tree
    value: Tree
}

export interface Function extends Locatable {
    kind: NodeKind.Function
    name: string
    parameters: Parameter[]
    body: Tree[]
    result: Tree
    exported?: boolean
}

export interface Parameter extends Locatable {
    kind: NodeKind.Parameter
    name: string
    type: Tree
}

export interface Call extends Locatable {
    kind: NodeKind.Call
    target: Tree
    arguments: Tree[]
}

export interface Let extends Locatable {
    kind: NodeKind.Let
    name: string
    type?: Tree
    value: Tree
}

export interface Var extends Locatable {
    kind: NodeKind.Var
    name: string
    type?: Tree
    value: Tree
    exported?: boolean
}

export interface Type extends Locatable {
    kind: NodeKind.Type
    name: string
    type: Tree
}

export interface StructTypeLit extends Locatable {
    kind: NodeKind.StructTypeLit
    fields: StructField[]
}

export interface StructField extends Locatable {
    kind: NodeKind.StructField
    name: string
    type: Tree
}

export interface ArrayCtor extends Locatable {
    kind: NodeKind.ArrayCtor
    element: Tree
    size?: number
}

export interface PointerCtor extends Locatable {
    kind: NodeKind.PointerCtor
    target: Tree
}

export interface Import extends Locatable {
    kind: NodeKind.Import
    imports: ImportItem[]
}

export type ImportItem = ImportFunction

export interface ImportFunction extends Locatable {
    kind: NodeKind.ImportFunction
    name: string
    module: string
    parameters: Parameter[]
    result: Tree
    as?: string
}

export function * childrenOf(tree: Tree): Iterable<Tree> {
    switch (tree.kind) {
        case NodeKind.Add:
        case NodeKind.Subtract:
        case NodeKind.Multiply:
        case NodeKind.Divide:
        case NodeKind.Compare:
        case NodeKind.And:
        case NodeKind.Or:
        case NodeKind.As:
            yield tree.left
            yield tree.right
            return
        case NodeKind.Negate:
        case NodeKind.Not:
        case NodeKind.AddressOf:
        case NodeKind.Dereference:
            yield tree.target
            return
        case NodeKind.BlockExpression:
            yield * tree.block
            return
        case NodeKind.IfThenElse:
            yield tree.condition
            yield tree.then
            if (tree.else) yield tree.else
            return
        case NodeKind.Loop:
            yield * tree.body
            return
        case NodeKind.Switch:
            yield tree.target
            yield * tree.cases
            return
        case NodeKind.SwitchCase:
            yield * tree.expressions
            yield * tree.body
            return
        case NodeKind.Break:
        case NodeKind.BreakIndexed:
        case NodeKind.Continue:
            return
        case NodeKind.Return:
            if (tree.value) yield tree.value
            return
        case NodeKind.Literal:
            return
        case NodeKind.StructLit:
            yield * tree.body
            return
        case NodeKind.ArrayLit:
            yield * tree.values
            return
        case NodeKind.Field:
            yield tree.value
            return
        case NodeKind.Reference:
            return
        case NodeKind.Select:
        case NodeKind.Spread:
            yield tree.target
            return
        case NodeKind.Index:
            yield tree.target
            yield tree.index
            return
        case NodeKind.FieldRef:
            yield tree.target
            return
        case NodeKind.Assign:
            yield tree.target
            yield tree.value
            return
        case NodeKind.Function:
            yield * tree.parameters
            yield tree.result
            yield * tree.body
            return
        case NodeKind.Parameter:
            yield tree.type
            return
        case NodeKind.Call:
            yield tree.target
            yield * tree.arguments
            return
        case NodeKind.Let:
        case NodeKind.Var:
            if (tree.type) yield tree.type
            yield tree.value
            return
        case NodeKind.Type:
            yield tree.type
            return
        case NodeKind.StructTypeLit:
            yield * tree.fields
            return
        case NodeKind.StructField:
            yield tree.type
            return
        case NodeKind.ArrayCtor:
            yield tree.element
            return
        case NodeKind.PointerCtor:
            yield tree.target
            return
        case NodeKind.Import:
            yield * tree.imports
            return
        case NodeKind.ImportFunction:
            yield * tree.parameters
            yield tree.result
            return
    }
}

export function copy<T extends Tree>(original: T, overrides: Partial<T> = {}): T {
    return { ...original, ...overrides }
}

export class Scope<T> {
    private parents: Scope<T>[]
    private entries: Map<string, T> = new Map()
    private orders: Map<string, number> = new Map()

    constructor(...parents: (Scope<T> | undefined)[]) {
        this.parents = parents.filter(it => it) as Scope<T>[]
    }

    get size(): number {
        return this.entries.size
    }

    find(name: string): T | undefined {
        return this.entries.get(name) ?? this.findInParent(name)
    }

    order(name: string): number | undefined {
        return this.orders.get(name)
    }

    enter(name: string, value: T) {
        if (this.entries.has(name)) {
            throw new Error(`Duplicate name ${name}`)
        }
        this.orders.set(name, this.entries.size)
        this.entries.set(name, value)
    }

    renter(name: string, value: T) {
        if (!this.entries.has(name)) {
            throw new Error(`Cannot reenter a symbol that has not be entered: ${name}`)
        }
        this.entries.set(name, value)
    }

    has(name: string) {
        return this.entries.has(name)
    }

    forEach(callback: (name: string, value: T) => void) {
        this.internalForEach(new Set(), callback);
    }

    first<R>(callback: (name: string, value: T) => R | undefined): R | undefined {
        return this.internalFirst(new Set(), callback);
    }

    without(name: string): Scope<T> {
        const result = new Scope<T>(...this.parents)
        this.forEach((n, value) => {
            if (n !== name) result.enter(n, value)
        })
        return result
    }

    map<V>(callback: (name: string, value: T) => V): V[] {
        const result: V[] = []
        this.internalForEach(new Set(), (name, value) => {
            result.push(callback(name, value))
        })
        return result
    }

    private internalForEach(emitted: Set<string>, callback: (name: string, value: T) => void) {
        for (const entry of this.entries.entries()) {
            if (!emitted.has(entry[0])) {
                emitted.add(entry[0])
                callback(entry[0], entry[1])
            }
        }
        for (const parent of this.parents) {
            parent.internalForEach(emitted, callback)
        }
    }

    private internalFirst<R>(
        emitted: Set<string>,
        callback: (name: string, value: T) => R | undefined
    ): R | undefined {
        for (const entry of this.entries.entries()) {
            if (!emitted.has(entry[0])) {
                emitted.add(entry[0])
                const result = callback(entry[0], entry[1]);
                if (result !== undefined) return result;
            }
        }
        for (const parent of this.parents) {
            const result = parent.internalFirst(emitted, callback);
            if (result !== undefined) return result;
        }
        return undefined;
    }

    private findInParent(name: string): T | undefined {
        const parents = this.parents
        const l = parents.length
        for (let i = 0; i < l; i++) {
            const result = parents[i].find(name)
            if (result) return result
        }
        return undefined
    }
}
