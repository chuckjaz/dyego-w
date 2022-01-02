import { Locatable } from "./locatable"

export const enum LastKind {
    Add,
    Subtract,
    Multiply,
    Divide,
    Remainder,
    Negate,
    Not,
    Equal,
    NotEqual,
    GreaterThan,
    GreaterThanEqual,
    LessThan,
    LessThanEqual,
    And,
    Or,
    As,
    AddressOf,
    SizeOf,
    Dereference,
    Literal,
    StructLiteral,
    Field,
    ArrayLiteral,
    Block,
    Loop,
    IfThenElse,
    Branch,
    BranchIndexed,
    Return,
    Reference,
    Select,
    Index,
    Assign,
    Function,
    Parameter,
    Call,
    Let,
    Var,
    Type,
    TypeSelect,
    StructTypeLiteral,
    StructFieldLiteral,
    ArrayConstructor,
    PointerConstructor,
    Exported,
    Import,
    ImportFunction,
    ImportVariable,
    Module
}

export function nameOfLastKind(kind: LastKind): string {
    switch (kind) {
        case LastKind.Add: return "Add"
        case LastKind.Subtract: return "Subtract"
        case LastKind.Multiply: return "Multiply"
        case LastKind.Divide: return "Divide"
        case LastKind.Remainder: return "Remainder"
        case LastKind.Negate: return "Negate"
        case LastKind.Not: return "Not"
        case LastKind.Equal: return "Equal"
        case LastKind.NotEqual: return "NotEqual"
        case LastKind.GreaterThan: return "GreaterThan"
        case LastKind.GreaterThanEqual: return "GreaterThanEqual"
        case LastKind.LessThan: return "LessThan"
        case LastKind.LessThanEqual: return "LessThanEqual"
        case LastKind.And: return "And"
        case LastKind.Or: return "Or"
        case LastKind.As: return "As"
        case LastKind.AddressOf: return "AddressOf"
        case LastKind.SizeOf: return "SizeOf"
        case LastKind.Dereference: return "Dereference"
        case LastKind.Literal: return "Literal"
        case LastKind.StructLiteral: return "StructLiteral"
        case LastKind.Field: return "Field"
        case LastKind.ArrayLiteral: return "ArrayLiteral"
        case LastKind.Block: return "Block"
        case LastKind.Loop: return "Loop"
        case LastKind.IfThenElse: return "IfThenElse"
        case LastKind.Branch: return "Branch"
        case LastKind.BranchIndexed: return "BranchIndexed"
        case LastKind.Return: return "Return"
        case LastKind.Reference: return "Reference"
        case LastKind.Select: return "Select"
        case LastKind.Index: return "Index"
        case LastKind.Assign: return "Assign"
        case LastKind.Function: return "Function"
        case LastKind.Parameter: return "Parameter"
        case LastKind.Call: return "Call"
        case LastKind.Let: return "Let"
        case LastKind.Var: return "Var"
        case LastKind.Type: return "Type"
        case LastKind.TypeSelect: return "TypeSelect"
        case LastKind.StructTypeLiteral: return "StructTypeLiteral"
        case LastKind.StructFieldLiteral: return "StructFieldLiteral"
        case LastKind.ArrayConstructor: return "ArrayConstructor"
        case LastKind.PointerConstructor: return "PointerConstructor"
        case LastKind.Exported: return "Exported"
        case LastKind.Import: return "Import"
        case LastKind.ImportFunction: return "ImportFunction"
        case LastKind.ImportVariable: return "ImportVariable"
        case LastKind.Module: return "Module"        
    }
}

export const enum LiteralKind {
    Int8,
    Int16,
    Int32,
    Int64,
    UInt8,
    UInt16,
    UInt32,
    UInt64,
    Float32,
    Float64,
    Boolean,
    Null,
}

export function nameOfLiteralKind(kind: LiteralKind): string {
    switch (kind) {
        case LiteralKind.Int8: return "Int8";
        case LiteralKind.Int16: return "Int16";
        case LiteralKind.Int32: return "Int32";
        case LiteralKind.Int64: return "Int64";
        case LiteralKind.UInt8: return "UInt8";
        case LiteralKind.UInt16: return "UInt16";
        case LiteralKind.UInt32: return "UInt32";
        case LiteralKind.UInt64: return "UInt64";
        case LiteralKind.Float32: return "Float32";
        case LiteralKind.Float64: return "Float64";
        case LiteralKind.Boolean: return "Boolean";
        case LiteralKind.Null: return "Null";
    }
}

export type Expression =
    Add |
    Subtact |
    Multiply | 
    Divide |
    Remainder |
    Negate |
    Not |
    Equal |
    NotEqual |
    GreaterThan |
    GreaterThanEqual |
    LessThan |
    LessThanEqual |
    And |
    Or |
    As |
    AddressOf |
    SizeOf |
    Dereference |
    Literal |
    IfThenElse |
    Block |
    Reference |
    Select |
    Index |
    Call |
    ArrayLiteral |
    StructLiteral

export type Literal = 
    LiteralInt8 |
    LiteralInt16 |
    LiteralInt32 |
    LiteralInt64 |
    LiteralUInt8 |
    LiteralUInt16 |
    LiteralUInt32 |
    LiteralUInt64 |
    LiteralFloat32 |
    LiteralFloat64 |
    LiteralBoolean |
    LiteralNull

export type Exportable = Var | Function
export type Declaration = Let | Var | TypeDeclaration | Function | Exported
export type Statement = Let | Var | TypeDeclaration | Loop | Block | Branch | BranchIndexed | Return | Assign
export type BodyElement = Statement | Expression
export type TypeExpression = Reference | TypeSelect | StructTypeLiteral | ArrayConstructor | PointerConstructor
export type ImportItem = ImportFunction | ImportVariable
export type BranchTarget = Loop | Block
export type Last = Declaration | Statement | Expression | TypeExpression | Import | Parameter | ImportItem | Field | 
    StructFieldLiteral

export interface Binary {
    left: Expression
    right: Expression
}

export interface Unary {
    target: Expression
}

export interface LastNode extends Locatable {
    _brand?: never
}

export interface Add extends LastNode, Binary { kind: LastKind.Add }
export interface Subtact extends LastNode, Binary { kind: LastKind.Subtract }
export interface Multiply extends LastNode, Binary { kind: LastKind.Multiply }
export interface Divide extends LastNode, Binary { kind: LastKind.Divide }
export interface Remainder extends LastNode, Binary { kind: LastKind.Remainder }
export interface Negate extends LastNode, Unary { kind: LastKind.Negate }
export interface Not extends LastNode, Unary { kind: LastKind.Not }
export interface Equal extends LastNode, Binary { kind: LastKind.Equal }
export interface NotEqual extends LastNode, Binary { kind: LastKind.NotEqual }
export interface GreaterThan extends LastNode, Binary { kind: LastKind.GreaterThan }
export interface GreaterThanEqual extends LastNode, Binary { kind: LastKind.GreaterThanEqual }
export interface LessThan extends LastNode, Binary { kind: LastKind.LessThan }
export interface LessThanEqual extends LastNode, Binary { kind: LastKind.LessThanEqual }
export interface And extends LastNode, Binary { kind: LastKind.And }
export interface Or extends LastNode, Binary { kind: LastKind.Or }
export interface As extends LastNode { kind: LastKind.As, left: Expression, right: TypeExpression }
export interface AddressOf extends LastNode, Unary { kind: LastKind.AddressOf }
export interface SizeOf extends LastNode, Unary { kind: LastKind.SizeOf }
export interface Dereference extends LastNode, Unary { kind: LastKind.Dereference }

export interface LiteralNumeric { kind: LastKind.Literal; value: number }
export interface LiteralBigInt { kind: LastKind.Literal; value: bigint }

export interface LiteralInt8 extends LastNode, LiteralNumeric { literalKind: LiteralKind.Int8 }
export interface LiteralInt16 extends LastNode, LiteralNumeric { literalKind: LiteralKind.Int16 }
export interface LiteralInt32 extends LastNode, LiteralNumeric { literalKind: LiteralKind.Int32 }
export interface LiteralInt64 extends LastNode, LiteralBigInt { literalKind: LiteralKind.Int64 }
export interface LiteralUInt8 extends LastNode, LiteralNumeric { literalKind: LiteralKind.UInt8 }
export interface LiteralUInt16 extends LastNode, LiteralNumeric { literalKind: LiteralKind.UInt16 }
export interface LiteralUInt32 extends LastNode, LiteralNumeric { literalKind: LiteralKind.UInt32 }
export interface LiteralUInt64 extends LastNode, LiteralBigInt { literalKind: LiteralKind.UInt64 }
export interface LiteralFloat32 extends LastNode, LiteralNumeric { literalKind: LiteralKind.Float32 }
export interface LiteralFloat64 extends LastNode, LiteralNumeric { literalKind: LiteralKind.Float64 }

export interface LiteralBoolean extends LastNode { 
    kind: LastKind.Literal
    literalKind: LiteralKind.Boolean
    value: boolean
}

export interface LiteralNull extends LastNode { 
    kind: LastKind.Literal
    literalKind: LiteralKind.Null
    value: null
}

export interface StructLiteral extends LastNode {
    kind: LastKind.StructLiteral
    fields: Field[]
}

export interface Field extends LastNode {
    kind: LastKind.Field
    name: string
    value: Expression
}

export interface ArrayLiteral extends LastNode {
    kind: LastKind.ArrayLiteral
    values: Expression[]
}

export interface Block extends LastNode {
    kind: LastKind.Block
    name?: string
    body: BodyElement[]
}

export interface Loop extends LastNode {
    kind: LastKind.Loop
    name?: string
    body: BodyElement[]   
}

export interface IfThenElse extends LastNode {
    kind: LastKind.IfThenElse
    condition: Expression
    then: BodyElement[]
    else: BodyElement[]
}

export interface Branch extends LastNode {
    kind: LastKind.Branch
    target?: string
}

export interface BranchIndexed extends LastNode {
    kind: LastKind.BranchIndexed
    condition: Expression
    targets: string[]
    else: string
}

export interface Return extends LastNode {
    kind: LastKind.Return
    value?: Expression
}

export interface Reference extends LastNode {
    kind: LastKind.Reference
    name: string
}

export interface Select extends LastNode {
    kind: LastKind.Select
    target: Expression
    name: string
}

export interface Index extends LastNode {
    kind: LastKind.Index
    target: Expression
    index: Expression
}

export interface Assign extends LastNode {
    kind: LastKind.Assign
    target: Expression
    value: Expression
}

export interface Function extends LastNode {
    kind: LastKind.Function
    name: string
    parameters: Parameter[]
    result: TypeExpression
    body: BodyElement[]
}

export interface Parameter extends LastNode {
    kind: LastKind.Parameter
    name: string
    type: TypeExpression
}

export interface Call extends LastNode {
    kind: LastKind.Call
    target: Expression
    arguments: Expression[]
}

export interface Let extends LastNode {
    kind: LastKind.Let
    name: string
    type: TypeExpression
    value: Expression
}

export interface Var extends LastNode {
    kind: LastKind.Var
    name: string
    type: TypeExpression
    value?: Expression
}

export interface TypeDeclaration extends LastNode {
    kind: LastKind.Type
    name: string
    type: TypeExpression
}

export interface TypeSelect extends LastNode {
    kind: LastKind.TypeSelect
    target: TypeExpression
    name: string
}

export interface StructTypeLiteral extends LastNode {
    kind: LastKind.StructTypeLiteral
    fields: StructFieldLiteral[]
}

export interface StructFieldLiteral extends LastNode {
    kind: LastKind.StructFieldLiteral
    name: string
    type: TypeExpression
}

export interface ArrayConstructor extends LastNode {
    kind: LastKind.ArrayConstructor
    element: TypeExpression
    size?: number
}

export interface PointerConstructor extends LastNode {
    kind: LastKind.PointerConstructor
    target: TypeExpression
}

export interface Exported extends LastNode {
    kind: LastKind.Exported
    target: Exportable
}

export interface ImportDescription {
    module: string
    name: string
    as?: string
}

export interface Import extends LastNode {
    kind: LastKind.Import
    imports: ImportItem[]
}

export interface ImportFunction extends LastNode, ImportDescription {
    kind: LastKind.ImportFunction
    parameters: Parameter[]
    result: TypeExpression
}

export interface ImportVariable extends LastNode, ImportDescription {
    kind: LastKind.ImportVariable
    type: TypeExpression
}

export interface Module extends LastNode {
    kind: LastKind.Module
    imports: Import[]
    declarations: Declaration[]
}

export function copy<T extends Last>(original: T, overrides: Partial<T> = {}): T {
    return { ...original, ...overrides }
}
