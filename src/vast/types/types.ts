import { Scope } from '../../last'

import * as ast from './../ast'

export const enum TypeKind {
    I8,
    I16,
    I32,
    I64,
    U8,
    U16,
    U32,
    U64,
    F32,
    F64,
    Boolean,
    Char,
    String,
    Void,
    Array,
    Slice,
    Struct,
    Function,
    Lambda,
    Range,
    Never,
    Open,
    Error,
}

export function nameOfTypeKind(kind: TypeKind): string {
    switch (kind) {
        case TypeKind.I8: return "I8"
        case TypeKind.I16: return "I16"
        case TypeKind.I32: return "I32"
        case TypeKind.I64: return "I64"
        case TypeKind.U8: return "U8"
        case TypeKind.U16: return "U16"
        case TypeKind.U32: return "U32"
        case TypeKind.U64: return "U64"
        case TypeKind.F32: return "F32"
        case TypeKind.F64: return "F64"
        case TypeKind.Boolean: return "Boolean"
        case TypeKind.Char: return "Char"
        case TypeKind.String: return "String"
        case TypeKind.Void: return "Void"
        case TypeKind.Array: return "Array"
        case TypeKind.Slice: return "Slice"
        case TypeKind.Struct: return "Struct"
        case TypeKind.Function: return "Function"
        case TypeKind.Lambda: return "Lambda"
        case TypeKind.Range: return "Range"
        case TypeKind.Never: return "Never"
        case TypeKind.Open: return "Open"
        case TypeKind.Error: return "Error"
    }
}

export type Type =
    I8 | I16 | I32 | I64 |
    U8 | U16 | U32 | U64 |
    F32 | F64 |
    BooleanType |
    StringType | CharType |
    VoidType |
    ArrayType | SliceType |
    StructType |
    FunctionType | LambdaType |
    OpenType |
    RangeType |
    NeverType |
    ErrorType

export interface I8 {
    kind: TypeKind.I8
}

export interface I16 {
    kind: TypeKind.I16
}

export interface I32 {
    kind: TypeKind.I32
}

export interface I64 {
    kind: TypeKind.I64
}

export interface U8 {
    kind: TypeKind.U8
}

export interface U16 {
    kind: TypeKind.U16
}

export interface U32 {
    kind: TypeKind.U32
}

export interface U64 {
    kind: TypeKind.U64
}

export interface F32 {
    kind: TypeKind.F32
}

export interface F64 {
    kind: TypeKind.F64
}

export interface CharType {
    kind: TypeKind.Char
}

export interface StringType {
    kind: TypeKind.String
}

export interface BooleanType {
    kind: TypeKind.Boolean
}

export interface VoidType {
    kind: TypeKind.Void
}

export interface ArrayType {
    kind: TypeKind.Array
    element: Type
    size: number
}

export interface SliceType {
    kind: TypeKind.Slice
    element: Type
}

export interface StructType {
    kind: TypeKind.Struct
    name?: string
    fields: Scope<StructField>
    types: Scope<Type>
    methods: Scope<Function>
}

export interface StructField {
    name: string
    type: Type
    modifier: StructFieldModifier
}

export const enum StructFieldModifier {
    Val,
    Var,
}

export interface FunctionType {
    kind: TypeKind.Function
    parameters: Scope<Parameter>
    result: Type
}

export interface Function {
    name: string
    modifier: FunctionModifier
    type: FunctionType
}

export const enum FunctionModifier {
    None = 0x0000,
    Method = 0x0001,
    Intrinsic = 0x0002,
}

export interface LambdaType {
    kind: TypeKind.Lambda
    parameters: Scope<Parameter>
    result: Type
}

export interface Parameter {
    name: string
    alias: string
    position: number
    modifier: ParameterModifier
    type: Type
    node?: ast.Parameter
}

export const enum ParameterModifier {
    None = 0x0000,
    Var = 0x0001,
    Context = 0x0002,
}

export interface RangeType {
    kind: TypeKind.Range
}

export interface NeverType {
    kind: TypeKind.Never
}

export interface OpenType {
    kind: TypeKind.Open
    next: OpenType
    primary: OpenType
    size: number
    bound?: Type
}

export interface ErrorType {
    kind: TypeKind.Error
}