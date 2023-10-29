import { PrimitiveKind, Scope } from '../last'

export const enum TypeKind {
    Array,
    Struct,
    Union,
    Null,
    Void,
    Function,
    Memory,
    Error,
}

export type Type =
    ArrayType |
    StructType |
    UnionType |
    NullType |
    VoidType |
    FunctionType |
    ErrorType

export interface ArrayType {
    kind: TypeKind.Array
    elements: Type
    size?: number
    methods: Scope<FunctionType>
}

export interface StructType {
    kind: TypeKind.Struct
    fields: Scope<Type>
    methods: Scope<FunctionType>
    name?: string
    primitive?: PrimitiveKind
    comparingTo?: Array<StructType>
}

export interface UnionType {
    kind: TypeKind.Union
    fields: Scope<Type>
    name?: string
    comparingTo?: Array<UnionType>
}

export interface NullType {
    kind: TypeKind.Null
}

export interface VoidType {
    kind: TypeKind.Void
}

export interface FunctionType {
    kind: TypeKind.Function
    parameters: Type[]
    result: Type
    name?: string
}

export interface ErrorType {
    kind: TypeKind.Error
}