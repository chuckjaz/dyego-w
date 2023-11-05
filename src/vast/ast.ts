import { Locatable, PrimitiveKind } from "../last";

export const enum Kind {
    Argument,
    ArrayLiteral,
    ArrayTypeConstructor,
    As,
    Assign,
    Break,
    Block,
    Call,
    Continue,
    FieldLiteral,
    Function,
    FunctionType,
    If,
    IsCondition,
    Index,
    Infer,
    Lambda,
    Let,
    Literal,
    Module,
    Parameter,
    Return,
    Select,
    StructLiteral,
    StructTypeConstructor,
    StructTypeConstuctorField,
    TypeDeclaration,
    TypeSelect,
    Reference,
    Val,
    Var,
    While,
    When,
    WhenClause,
}

export type Expression =
    ArrayLiteral |
    As |
    Assign |
    Block |
    Call |
    If |
    Index |
    Lambda |
    Literal |
    Reference |
    Select |
    StructLiteral

export type Declaration =
    Function |
    Let |
    TypeDeclaration |
    Var |
    Val

export type Statement =
    Declaration |
    Expression |
    Break |
    Continue |
    Return |
    While |
    When

export type TypeExpression =
    ArrayTypeConstructor |
    FunctionType |
    Infer |
    Reference |
    StructTypeConstructor |
    TypeSelect 

export type Literal =
    I8Literal |
    I16Literal |
    I32Literal |
    I64Literal |
    U8Literal |
    U16Literal |
    U32Literal |
    U64Literal |
    F32Literal |
    F64Literal |
    BooleanLiteral |
    NullLiteral |
    BooleanLiteral

const brand = Symbol("vast ast brand")

export interface Node extends Locatable {
    [brand]?: never
    kind: Kind
}

export interface Argument extends Node {
    kind: Kind.Argument
    name?: Reference
    value: Expression
    modifier: ArgumentModifier
}

export const enum ArgumentModifier {
    None = 0x0000,
    Var = 0x0001,
}

export interface ArrayLiteral extends Node {
    kind: Kind.ArrayLiteral
    values: Expression[]
}

export interface ArrayTypeConstructor extends Node {
    kind: Kind.ArrayTypeConstructor
    element: TypeExpression
    size?: Expression
}

export interface As extends Node {
    kind: Kind.As
    left: Expression
    right: TypeExpression
}

export interface Assign extends Node {
    kind: Kind.Assign
    target: Expression
    value: Expression
}

export interface Block extends Node {
    kind: Kind.Block
    name?: Reference
    statements: Statement[]
}

export interface Break extends Node {
    kind: Kind.Break
    target?: Reference
}

export interface Call extends Node {
    kind: Kind.Call
    target: Expression
    arguments: Argument[]
}

export interface Continue extends Node {
    kind: Kind.Continue
    target?: Reference
}

export interface FieldLiteral extends Node {
    kind: Kind.FieldLiteral
    name: Reference
    modifier: FieldLiteralModifier
    value: Expression
}

export const enum FieldLiteralModifier {
    None = 0x0000,
    Var = 0x0001
} 

export interface Function extends Node {
    kind: Kind.Function
    name: Reference
    parameters: Parameter[]
    result: TypeExpression
    body: Block
}

export interface FunctionType extends Node {
    kind: Kind.FunctionType
    parameters: Parameter[]
    result: TypeExpression
}

export interface If extends Node {
    kind: Kind.If
    condition: Expression
    then: Block
    else: Block
}

export interface Index extends Node {
    kind: Kind.Index
    target: Expression
    index: Expression
}

export interface Infer extends Node {
    kind: Kind.Infer
}

export interface IsCondition extends Node {
    kind: Kind.IsCondition
    target: TypeExpression
}

export interface Lambda extends Node {
    kind: Kind.Lambda
    parameters: Parameter[]
    result: TypeExpression
    body: Block
}

export interface Let extends Node {
    kind: Kind.Let
    name: Reference
    type: TypeExpression
    value: Expression
}

export interface LiteralBase extends Node {
    kind: Kind.Literal
    primitiveKind: PrimitiveKind
}
export interface I8Literal extends LiteralBase { primitiveKind: PrimitiveKind.I8; value: number }
export interface I16Literal extends LiteralBase { primitiveKind: PrimitiveKind.I16; value: number }
export interface I32Literal extends LiteralBase { primitiveKind: PrimitiveKind.I32; value: number }
export interface I64Literal extends LiteralBase { primitiveKind: PrimitiveKind.I64; value: bigint }
export interface U8Literal extends LiteralBase { primitiveKind: PrimitiveKind.U8; value: number }
export interface U16Literal extends LiteralBase { primitiveKind: PrimitiveKind.U16; value: number }
export interface U32Literal extends LiteralBase { primitiveKind: PrimitiveKind.U32; value: number }
export interface U64Literal extends LiteralBase { primitiveKind: PrimitiveKind.U64; value: bigint }
export interface F32Literal extends LiteralBase { primitiveKind: PrimitiveKind.F32; value: number }
export interface F64Literal extends LiteralBase { primitiveKind: PrimitiveKind.F64; value: number }
export interface BooleanLiteral extends LiteralBase { primitiveKind: PrimitiveKind.Bool; value: boolean }
export interface NullLiteral extends LiteralBase { primitiveKind: PrimitiveKind.Null; value: null }

export interface Module extends Node {
    kind: Kind.Module
    declarations: Declaration[]
}

export interface Parameter extends Node {
    kind: Kind.Parameter
    name: Reference | number
    alias: Reference
    type: TypeExpression
    modifier: ParameterModifier
}

export const enum ParameterModifier {
    None = 0x0000,
    Context = 0x0001,
    Var = 0x0002,
}

export interface Reference extends Node {
    kind: Kind.Reference
    name: string
}

export interface Return extends Node {
    kind: Kind.Return
    value?: Expression
}

export interface Select extends Node {
    kind: Kind.Select
    target: Expression
    name: Reference
}

export interface StructLiteral extends Node {
    kind: Kind.StructLiteral
    fields: FieldLiteral[]
}

export interface StructTypeConstructor extends Node {
    kind: Kind.StructTypeConstructor
    fields: StructTypeConstuctorField[]
    methods: Function[]
    types: TypeDeclaration[]
}

export interface StructTypeConstuctorField extends Node {
    kind: Kind.StructTypeConstuctorField
    modifier: StructTypeConstuctorFieldModifier
    name: Reference
    type: TypeExpression
}

export const enum StructTypeConstuctorFieldModifier {
    None = 0x0000,
    Var = 0x0001,
}

export interface TypeDeclaration extends Node {
    kind: Kind.TypeDeclaration
    name: Reference
    type: TypeExpression
}

export interface TypeSelect extends Node {
    kind: Kind.TypeSelect
    target: TypeExpression
    name: Reference
}

export interface Val extends Node {
    kind: Kind.Val
    name: Reference
    type: TypeExpression
    value: Expression
}

export interface Var extends Node {
    kind: Kind.Var
    name: Reference
    type: TypeExpression
    value?: Expression 
}

export interface While extends Node {
    kind: Kind.While
    condition: Expression
    body: Block
}

export interface When extends Node {
    kind: Kind.When
    target?: Expression | Val | Var
    clauses: WhenClause[]
}

export interface WhenClause extends Node {
    kind: Kind.WhenClause
    condition: Expression | IsCondition
    body: Block
}