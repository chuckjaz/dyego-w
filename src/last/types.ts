import { Scope } from "./scope";

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
    Array,
    Struct,
    Union,
    Pointer,
    Null,
    Void,
    Function,
    Location,
    Memory,
    Unknown,
    Error,
}

export function nameOfTypeKind(kind: TypeKind): string {
    switch (kind) {
        case TypeKind.I8: return "I8";
        case TypeKind.I16: return "I16";
        case TypeKind.I32: return "I32";
        case TypeKind.I64: return "I64";
        case TypeKind.U8: return "U8";
        case TypeKind.U16: return "U16";
        case TypeKind.U32: return "U32";
        case TypeKind.U64: return "U64";
        case TypeKind.F32: return "F32";
        case TypeKind.F64: return "F64";
        case TypeKind.Boolean: return "Boolean";
        case TypeKind.Array: return "Array";
        case TypeKind.Struct: return "Struct";
        case TypeKind.Union: return "Union";
        case TypeKind.Pointer: return "Pointer";
        case TypeKind.Null: return "Null";
        case TypeKind.Void: return "Void";
        case TypeKind.Function: return "Function";
        case TypeKind.Location: return "Location";
        case TypeKind.Memory: return "Memory";
        case TypeKind.Unknown: return "Unknown";
        case TypeKind.Error: return "Error"
    }
}

export type Type =
    I8 | I16 | I32 | I64 |
    U8 | U16 | U32 | U64 |
    F32 | F64 |
    BooleanType |
    ArrayType |
    StructType |
    UnionType |
    PointerType |
    NullType |
    VoidType |
    FunctionType |
    LocationType |
    MemoryType |
    UnknownType |
    ErrorType

export const enum Capabilities {
    Numeric = 1 << 0,
    Bitwizeable = 1 << 1,
    Rotatable = 1 << 2,
    Bitcountable = 1 << 3,
    Negatable = 1 << 4,
    Floatable = 1 << 5,
    Equatable = 1 << 6,
    Comparable = 1 << 7,
    Logical = 1 << 8,
    Indexable = 1 << 9,
    Pointer = 1 << 10,
    Callable = 1 << 11,
    Loadable = 1 << 12,
    Storeable = 1 << 13,
    Builtins = 1 << 14,
    PointerSized = 1 << 15,
}

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

export interface BooleanType {
    kind: TypeKind.Boolean
}

export interface UnknownType {
    kind: TypeKind.Unknown
    name?: string
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

export interface UnionType {
    kind: TypeKind.Union
    fields: Scope<Type>
    name?: string
}

export interface PointerType {
    kind: TypeKind.Pointer
    target: Type
}

export interface NullType {
    kind: TypeKind.Null
}

export interface VoidType {
    kind: TypeKind.Void
}

export interface FunctionType {
    kind: TypeKind.Function
    parameters: Scope<Type>
    result: Type
    name?: string
}

export interface LocationType {
    kind: TypeKind.Location
    type: Type
    addressable?: boolean
}

export interface MemoryType {
    kind: TypeKind.Memory
}

export interface ErrorType {
    kind: TypeKind.Error
}

export const booleanType: Type = { kind: TypeKind.Boolean }
export const voidType: Type = { kind: TypeKind.Void }
export const i8Type: Type = { kind: TypeKind.I8 }
export const i16Type: Type = { kind: TypeKind.I16 }
export const i32Type: Type = { kind: TypeKind.I32 }
export const i64Type: Type = { kind: TypeKind.I64 }
export const u8Type: Type = { kind: TypeKind.U8 }
export const u16Type: Type = { kind: TypeKind.U16 }
export const u32Type: Type = { kind: TypeKind.U32 }
export const u64Type: Type = { kind: TypeKind.U64 }
export const f32Type: Type = { kind: TypeKind.F32 }
export const f64Type: Type = { kind: TypeKind.F64 }
export const nullType: Type = { kind: TypeKind.Null }
export const voidPointerType: PointerType = { kind: TypeKind.Pointer, target: voidType }
export const memoryType: Type = { kind: TypeKind.Memory }

export const globals: Scope<Type> = new Scope();

function nameTypeToString(name: string, type: Type): string {
    return `${name}: ${typeToString(type)}`
}

export function capabilitesOf(type: Type): Capabilities {
    switch (type.kind) {
        case TypeKind.I8:
        case TypeKind.I16:
        case TypeKind.U8:
        case TypeKind.U16:
            return Capabilities.Numeric | Capabilities.Comparable | Capabilities.Equatable |
                Capabilities.Negatable | Capabilities.Bitwizeable;
        case TypeKind.I32:
        case TypeKind.U32:
            return Capabilities.Numeric | Capabilities.Comparable | Capabilities.Equatable |
                Capabilities.Negatable | Capabilities.Bitwizeable | Capabilities.Bitcountable |
                Capabilities.Rotatable | Capabilities.PointerSized;
        case TypeKind.I64:
        case TypeKind.U64:
            return Capabilities.Numeric | Capabilities.Comparable | Capabilities.Equatable |
                Capabilities.Negatable | Capabilities.Bitwizeable | Capabilities.Rotatable |
                Capabilities.Bitcountable;
        case TypeKind.F32:
        case TypeKind.F64:
            return Capabilities.Numeric | Capabilities.Comparable | Capabilities.Equatable |
                Capabilities.Negatable | Capabilities.Floatable;
        case TypeKind.Boolean:
            return Capabilities.Logical | Capabilities.Equatable;
        case TypeKind.Array:
            return Capabilities.Indexable;
        case TypeKind.Function:
            return Capabilities.Callable;
        case TypeKind.Location:
            return Capabilities.Loadable | Capabilities.Storeable | capabilitesOf(type.type);
        case TypeKind.Pointer:
            return Capabilities.Pointer | Capabilities.Comparable | Capabilities.Equatable |
                Capabilities.Loadable | Capabilities.Storeable;
        case TypeKind.Null:
            return Capabilities.Comparable;
        case TypeKind.Struct:
            return 0;
        case TypeKind.Union:
            return 0;
        case TypeKind.Void:
            return 0;
        case TypeKind.Unknown:
            return 0;
        case TypeKind.Error:
            return 0;
        case TypeKind.Memory:
            return Capabilities.Builtins;
    }
}

export function typeToString(type: Type): string {
    switch (type.kind) {
        case TypeKind.I8:
            return `i8`
        case TypeKind.I16:
            return `i16`
        case TypeKind.I32:
            return `i32`
        case TypeKind.I64:
            return `i64`
        case TypeKind.U8:
            return `u8`
        case TypeKind.U16:
            return `u16`
        case TypeKind.U32:
            return `u32`
        case TypeKind.U64:
            return `u64`
        case TypeKind.F32:
            return `f32`
        case TypeKind.F64:
            return `f64`
        case TypeKind.Array:
            return `${typeToString(type.elements)}[${type.size ?? ""}]`
        case TypeKind.Boolean:
            return `bool`
        case TypeKind.Function:
            return type.name ?? `(${type.parameters.map(nameTypeToString).join(", ")})->${typeToString(type.result)}`
        case TypeKind.Location:
            return typeToString(type.type)
        case TypeKind.Struct:
            return type.name ?? `<${type.fields.map(nameTypeToString).join(", ")}>`
        case TypeKind.Union:
            return type.name ?? `<|${type.fields.map(nameTypeToString).join(", ")}|>`
        case TypeKind.Pointer:
            return `${typeToString(type.target)}^`
        case TypeKind.Null:
            return `null`;
        case TypeKind.Void:
            return `void`
        case TypeKind.Memory:
            return `memory`
        case TypeKind.Unknown:
            return `unknown`
        case TypeKind.Error:
            return `error`
    }
}

const capabilitiesCache = new Map<Capabilities, Scope<Type>>()

function scopeOf(...values: {name: string, type: Type}[]): Scope<Type> {
    const result = new Scope<Type>()
    for (const value of values) {
        result.enter(value.name, value.type)
    }
    return result
}

function enter(scope: Scope<Type>, name: string, parameters: Scope<Type>, result: Type) {
    scope.enter(name, {
        kind: TypeKind.Function,
        parameters,
        result
    })
}

function conversionMethods(type: Type, scope: Scope<Type>) {
    const thisP = scopeOf({ name: "this", type })
    const kind = type.kind
    switch (kind) {
        case TypeKind.Memory:
            enter(scope, "grow", scopeOf(
                { name: "this", type },
                { name: "amount", type: i32Type }
            ), i32Type);
            enter(scope, "top", thisP, voidPointerType);
            enter(scope, "limit", thisP, voidPointerType)
            break
    }
}

const builtinCache = new Map<TypeKind, Scope<Type>>()

export function builtInMethodsOf(type: Type): Scope<Type> {
    let scope = type.kind != TypeKind.Pointer ? builtinCache.get(type.kind) : null
    if (!scope) {
        scope = new Scope<Type>()
        conversionMethods(type, scope)
        if (type.kind != TypeKind.Pointer) {
            builtinCache.set(type.kind, scope)
        }
    }
    return scope
}