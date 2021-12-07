import { Scope } from "./ast";

export const enum TypeKind {
    Double,
    Int,
    String,
    Boolean,
    Array,
    Struct,
    Void,
    Lambda,
    Location,
    Unknown
}

export type Type =
    DoubleType |
    IntType |
    StringType |
    BooleanType |
    ArrayType |
    StructType |
    VoidType |
    LambdaType |
    LocationType |
    UnknownType


export const enum Capabilities {
    Addable = 0x0001,
    Subtractable = 0x0002,
    Multipliable = 0x0004,
    Dividable = 0x0008,
    Negatable = 0x0010,
    Comparable = 0x0020,
    Andable = 0x00040,
    Orable = 0x00080,
    Notable = 0x0100,
    Indexable = 0x0200,
    Callable = 0x0400,
    Loadable = 0x0800,
    Storeable = 0x1000,
}

export interface DoubleType {
    kind: TypeKind.Double
}

export interface IntType {
    kind: TypeKind.Int
}

export interface BooleanType {
    kind: TypeKind.Boolean
}

export interface StringType {
    kind: TypeKind.String
}

export interface UnknownType {
    kind: TypeKind.Unknown
}

export interface ArrayType {
    kind: TypeKind.Array
    elements: Type
    size?: number
}

export interface StructType {
    kind: TypeKind.Struct
    fields: Scope<Type>
    name?: string
}

export interface VoidType {
    kind: TypeKind.Void
}

export interface LambdaType {
    kind: TypeKind.Lambda
    parameters: Scope<Type>
    result: Type
    name?: string
}

export interface LocationType {
    kind: TypeKind.Location
    type: Type
}

export const booleanType: Type = { kind: TypeKind.Boolean }
export const voidType: Type = { kind: TypeKind.Void }
export const intType: Type = { kind: TypeKind.Int }
export const doubleType: Type = { kind: TypeKind.Double }
export const stringType: Type = { kind: TypeKind.String }

export const globals: Scope<Type> = new Scope();
globals.enter("Double", doubleType)
globals.enter("Boolean", booleanType)
globals.enter("Int", intType)
globals.enter("String", stringType)
globals.enter("Void", voidType)

function nameTypeToString(name: string, type: Type): string {
    return `${name}: ${typeToString(type)}`
}

export function capabilitesOf(type: Type): Capabilities {
    switch (type.kind) {
        case TypeKind.Int:
        case TypeKind.Double:
            return Capabilities.Addable | Capabilities.Subtractable |
                Capabilities.Dividable | Capabilities.Multipliable |
                Capabilities.Comparable | Capabilities.Negatable
        case TypeKind.Boolean:
            return Capabilities.Orable | Capabilities.Andable | Capabilities.Notable
        case TypeKind.Array:
            return Capabilities.Indexable
        case TypeKind.Lambda:
            return Capabilities.Callable
        case TypeKind.Location:
            return Capabilities.Loadable | Capabilities.Storeable | capabilitesOf(type.type)
        case TypeKind.String:
            return Capabilities.Addable | Capabilities.Callable
        case TypeKind.Struct:
            return 0
        case TypeKind.Void:
            return 0
        case TypeKind.Unknown:
            return 0
    }
}

export function typeToString(type: Type): string {
    switch (type.kind) {
        case TypeKind.Array: 
            return `${typeToString(type.elements)}[${type.size ?? ""}]`
        case TypeKind.Double:
            return `Double`
        case TypeKind.Int:
            return `Int`
        case TypeKind.Boolean:
            return `Boolean`
        case TypeKind.Lambda: 
            return type.name ?? `(${type.parameters.map(nameTypeToString).join(", ")})->${typeToString(type.result)}`
        case TypeKind.Location:
            return typeToString(type.type)
        case TypeKind.String:
            return `String`
        case TypeKind.Struct:
            return type.name ?? `<${type.fields.map(nameTypeToString).join(", ")}>`
        case TypeKind.Void:
            return `Void`
        case TypeKind.Unknown:
            return `Unknown`
    }
}
