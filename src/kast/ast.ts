import * as last from '../last'

export const enum KastKind {
    Module,
    Import,
    ImportFunction,
    ImportVariable,
    Exported,
    Type,
    StructTypeLiteral,
    UnionTypeLiteral,
    ArrayConstructor,
    PointerConstructor,
    FunctionType,
    Let,
    Var,
    Reference,
    Call,
    Select,
    Literal,
    StructLiteral,
    Field,
    ArrayLiteral,
    Function,
    Parameter,
    As,
    SizeOf,
    AddressOf,
    Dereference,
    IfThenElse,
    Block,
    Loop,
    FieldLiteral,
    BranchReference,
    BranchIndexed,
    Return,
    Assign,
    LastBlock,
}

const brand = Symbol()

export interface KastNode extends last.Locatable {
    [brand]?: never
}

export interface Module extends KastNode {
    kind: KastKind.Module
    imports: Import[]
    declarations: Declaration[]
}

export interface Import extends KastNode {
    kind: KastKind.Import
    imports: ImportItem[]
}

export type Declaration =
    Let |
    Var |
    TypeDeclaration |
    Function |
    Exported

export type ImportItem =
    ImportFunction |
    ImportVariable

export interface Let extends KastNode {
    kind: KastKind.Let
    name: Reference
    type: TypeExpression
    value: Expression
}

export interface Var extends KastNode {
    kind: KastKind.Var
    name: Reference
    type?: TypeExpression
    value?: Expression
}

export interface TypeDeclaration extends KastNode {
    kind: KastKind.Type
    name: Reference
    type: TypeExpression
}

export interface Function extends KastNode {
    kind: KastKind.Function
    name: Reference
    parameters: Parameter[]
    result: TypeExpression
    body: Block
}

export interface Exported extends KastNode {
    kind: KastKind.Exported
    target: Exportable
}

export interface ImportFunction extends KastNode, ImportDescription {
    kind: KastKind.ImportFunction
    parameters: Parameter[]
    result: TypeExpression
}

export interface ImportVariable extends KastNode, ImportDescription {
    kind: KastKind.ImportVariable
    type: TypeExpression
}

export type ImportDescription = last.ImportDescription

export interface Reference extends KastNode {
    kind: KastKind.Reference
    name: string
}

export type TypeExpression =
    Reference |
    StructTypeLiteral |
    UnionTypeLiteral |
    ArrayConstructor |
    PointerConstructor

export type Expression =
    Literal |
    Call |
    Select |
    ArrayLiteral |
    StructLiteral |
    As |
    SizeOf |
    AddressOf |
    Dereference |
    IfThenElse |
    Block |
    LastBlock

export interface Parameter extends KastNode {
    kind: KastKind.Parameter
    name: Reference
    type: TypeExpression
}

export type BodyElement =
    Statement |
    Expression

export type Exportable =
    Var |
    Function

export interface StructTypeLiteral extends KastNode {
    kind: KastKind.StructTypeLiteral
    fields: FieldLiteral[]
    methods: Function[]
}

export interface UnionTypeLiteral extends KastNode {
    kind: KastKind.UnionTypeLiteral
    fields: FieldLiteral[]
}

export interface ArrayConstructor extends KastNode {
    kind: KastKind.ArrayConstructor
    element: TypeExpression
    size?: number
}

export interface PointerConstructor extends KastNode {
    kind: KastKind.PointerConstructor
    target: TypeExpression
}

export type Literal =
    LiteralI8 |
    LiteralI16 |
    LiteralI32 |
    LiteralI64 |
    LiteralU8 |
    LiteralU16 |
    LiteralU32 |
    LiteralU64 |
    LiteralF32 |
    LiteralF64 |
    LiteralBool |
    LiteralNull
 
export interface Call extends KastNode {
    kind: KastKind.Call
    target: Expression
    arguments: Expression[]
}

export interface Select extends KastNode {
    kind: KastKind.Select
    target: Expression
    name: Reference
}

export interface ArrayLiteral extends KastNode {
    kind: KastKind.ArrayLiteral
    values: Expression[]
}

export interface StructLiteral extends KastNode {
    kind: KastKind.StructLiteral
    field: Field[]
}

export interface As extends KastNode {
    kind: KastKind.As
    target: Expression
    type: TypeExpression
}

export interface SizeOf extends KastNode {
    kind: KastKind.SizeOf
    target: TypeExpression
}

export interface AddressOf extends KastNode {
    kind: KastKind.AddressOf
    target: Expression
}

export interface Dereference extends KastNode {
    kind: KastKind.Dereference
    target: Expression
}

export interface IfThenElse extends KastNode {
    kind: KastKind.IfThenElse
    condition: Expression
    then: Block
    else: Block
}

export interface Block extends KastNode {
    kind: KastKind.Block
    name?: Reference
    body: BodyElement[]
}

export interface LastBlock extends KastNode {
    kind: KastKind.LastBlock
    body: last.Block
    type: TypeExpression
}

export type Statement =
    Let |
    Var |
    TypeDeclaration |
    Loop |
    Block |
    Branch |
    Return |
    Assign

export interface FieldLiteral extends KastNode {
    kind: KastKind.FieldLiteral
    name: Reference
    type: TypeExpression
}

export interface LiteralNumeric extends KastNode {
    kind: KastKind.Literal
    value: number
}

export interface LiteralBitInt extends KastNode {
    kind: KastKind.Literal
    value: bigint
}

export interface LiteralI8 extends LiteralNumeric {
    primitiveKind: last.PrimitiveKind.I8
}

export interface LiteralI16 extends LiteralNumeric {
    primitiveKind: last.PrimitiveKind.I16
}

export interface LiteralI32 extends LiteralNumeric {
    primitiveKind: last.PrimitiveKind.I32
}

export interface LiteralI64 extends LiteralBitInt {
    primitiveKind: last.PrimitiveKind.I64
}

export interface LiteralU8 extends LiteralNumeric {
    primitiveKind: last.PrimitiveKind.U8
}

export interface LiteralU16 extends LiteralNumeric {
    primitiveKind: last.PrimitiveKind.U16
}

export interface LiteralU32 extends LiteralNumeric {
    primitiveKind: last.PrimitiveKind.U32
}

export interface LiteralU64 extends LiteralBitInt {
    primitiveKind: last.PrimitiveKind.U64
}

export interface LiteralF32 extends LiteralNumeric {
    primitiveKind: last.PrimitiveKind.F32
}

export interface LiteralF64 extends LiteralNumeric {
    primitiveKind: last.PrimitiveKind.F64
}

export interface LiteralBool extends KastNode {
    kind: KastKind.Literal
    primitiveKind: last.PrimitiveKind.Bool
    value: boolean
}

export interface LiteralNull extends KastNode {
    kind: KastKind.Literal
    primitiveKind: last.PrimitiveKind.Null
    value: null
}

export interface Field extends KastNode {
    kind: KastKind.Field
    name: Reference
    value: Expression
}

export interface Loop extends KastNode {
    kind: KastKind.Loop
    name?: Reference
    body: BodyElement[]
}

export type Branch = 
    BranchReference |
    BranchIndexed

export interface BranchReference extends KastNode {
    kind: KastKind.BranchReference
    name?: Reference
}

export interface BranchIndexed extends KastNode {
    kind: KastKind.BranchIndexed
    condition: Expression
    targets: Reference[]
    else: Reference
}

export interface Return extends KastNode {
    kind: KastKind.Return
    value?: Expression
}

export interface Assign extends KastNode {
    kind: KastKind.Assign
    target: Expression
    value: Expression
}

    