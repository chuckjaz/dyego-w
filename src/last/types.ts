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
    Negatable = 1 << 3,
    Floatable = 1 << 4,
    Equatable = 1 << 5,
    Comparable = 1 << 6,
    Logical = 1 << 7,
    Indexable = 1 << 8,
    Pointer = 1 << 9,
    Callable = 1 << 10,
    Loadable = 1 << 11,
    Storeable = 1 << 12,
    Builtins = 1 << 13,
    PointerSized = 1 << 14,
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
globals.enter("Double", f64Type)
globals.enter("Float64", f64Type)
globals.enter("Float32", f32Type)
globals.enter("Boolean", booleanType)
globals.enter("Int8", i8Type)
globals.enter("Int16", i16Type)
globals.enter("Int32", i32Type)
globals.enter("Int64", i64Type)
globals.enter("UInt8", u8Type)
globals.enter("UInt16", u16Type)
globals.enter("UInt32", u32Type)
globals.enter("UInt", u32Type)
globals.enter("UInt64", u64Type)
globals.enter("Int", i32Type)
globals.enter("Void", voidType)
globals.enter("memory", { kind: TypeKind.Location, type: memoryType });
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
                Capabilities.Negatable | Capabilities.Bitwizeable | Capabilities.Rotatable |
                Capabilities.PointerSized;
        case TypeKind.I64:
        case TypeKind.U64:
            return Capabilities.Numeric | Capabilities.Comparable | Capabilities.Equatable |
                Capabilities.Negatable | Capabilities.Bitwizeable | Capabilities.Rotatable;
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
            return `Int8`
        case TypeKind.I16:
            return `Int16`
        case TypeKind.I32:
            return `Int`
        case TypeKind.I64:
            return `Int64`
        case TypeKind.U8:
            return `UInt8`
        case TypeKind.U16:
            return `UInt16`
        case TypeKind.U32:
            return `UInt`
        case TypeKind.U64:
            return `UInt64`
        case TypeKind.F32:
            return `Float32`
        case TypeKind.F64:
            return `Float64`
        case TypeKind.Array:
            return `${typeToString(type.elements)}[${type.size ?? ""}]`
        case TypeKind.Boolean:
            return `Boolean`
        case TypeKind.Function:
            return type.name ?? `(${type.parameters.map(nameTypeToString).join(", ")})->${typeToString(type.result)}`
        case TypeKind.Location:
            return typeToString(type.type)
        case TypeKind.Struct:
            return type.name ?? `<${type.fields.map(nameTypeToString).join(", ")}>`
        case TypeKind.Pointer:
            return `${typeToString(type.target)}^`
        case TypeKind.Null:
            return `null`;
        case TypeKind.Void:
            return `Void`
        case TypeKind.Memory:
            return `Memory`
        case TypeKind.Unknown:
            return `Unknown`
        case TypeKind.Error:
            return `Error`
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

function capabilityMethods(type: Type, scope: Scope<Type>) {
    let capabilities = capabilitesOf(type)
    const thisP = scopeOf({ name: "this", type })
    const thisAndOther = scopeOf({ name: "this", type }, { name: "other", type })
    let valueType = i32Type
    switch (type.kind) {
        case TypeKind.I64:
        case TypeKind.U64:
            valueType = i64Type
            break
    }
    const thisAndValue = scopeOf({ name: "this", type }, { name: "value", type: valueType })
    if (capabilities & Capabilities.Bitwizeable) {
        let resultType = i32Type
        switch (type.kind) {
            case TypeKind.I64:
            case TypeKind.U64:
                resultType = i64Type
                break
        }
        enter(scope, "countLeadingZeros", thisP, resultType)
        enter(scope, "countTrailingZeros", thisP, resultType)
        enter(scope, "countNonZeros", thisP, resultType)
    }
    if (capabilities & Capabilities.Rotatable) {
        enter(scope, "rotateLeft", thisAndValue, type)
        enter(scope, "rotateRight", thisAndValue, type)
    }
    if (capabilities & Capabilities.Floatable) {
        enter(scope, "abs", thisP, type)
        enter(scope, "sqrt", thisP, type)
        enter(scope, "floor", thisP, type)
        enter(scope, "ceil", thisP, type)
        enter(scope, "trunc", thisP, type)
        enter(scope, "nearest", thisP, type)
        enter(scope, "min", thisAndOther, type)
        enter(scope, "max", thisAndOther, type)
        enter(scope, "copysign", thisAndOther, type)
    }
}

function conversionMethods(type: Type, scope: Scope<Type>) {
    const thisP = scopeOf({ name: "this", type })
    const kind = type.kind
    switch (kind) {
        case TypeKind.I8:
        case TypeKind.I16:
        case TypeKind.I32:
        case TypeKind.I64:
        case TypeKind.U8:
        case TypeKind.U16:
        case TypeKind.U32:
        case TypeKind.U64: {
            if (kind != TypeKind.I8)
                enter(scope, "toInt8", thisP, i8Type)
            if (kind != TypeKind.I16)
                enter(scope, "toInt16", thisP, i16Type)
            if (kind != TypeKind.I32)
                enter(scope, "toInt", thisP, i32Type)
            if (kind != TypeKind.I64)
                enter(scope, "toInt64", thisP, i64Type)
            if (kind != TypeKind.U8)
                enter(scope, "toUInt8", thisP, u8Type)
            if (kind != TypeKind.U16)
                enter(scope, "toUInt16", thisP, u16Type)
            if (kind != TypeKind.U32)
                enter(scope, "toUInt", thisP, u32Type)
            if (kind != TypeKind.U64)
                enter(scope, "toUInt64", thisP, u64Type)
            enter(scope, "toFloat32", thisP, f32Type)
            enter(scope, "toFloat64", thisP, f64Type)
            switch (kind) {
                case TypeKind.I8:
                    enter(scope, "extendToInt32", thisP, i32Type)
                    enter(scope, "extendToInt64", thisP, i64Type)
                    break
                case TypeKind.I16:
                    enter(scope, "extendToInt32", thisP, i32Type)
                    enter(scope, "extendToInt64", thisP, i64Type)
                    break
                case TypeKind.I32:
                    enter(scope, "extendToInt64", thisP, i64Type)
                    enter(scope, "convertToFloat32", thisP, f32Type)
                    enter(scope, "convertToFloat64", thisP, f32Type)
                    break
                case TypeKind.U32:
                    enter(scope, "convertToFloat32", thisP, f32Type)
                    enter(scope, "convertToFloat64", thisP, f32Type)
                    enter(scope, "reinterpretAsFloat32", thisP, f32Type)
                    break
                case TypeKind.I64:
                    enter(scope, "wrapToInt32", thisP, i32Type)
                    enter(scope, "convertToFloat32", thisP, f32Type)
                    enter(scope, "convertToFloat64", thisP, f32Type)
                    break
                case TypeKind.U64:
                    enter(scope, "reinterpretAsFloat64", thisP, f64Type)
                    enter(scope, "convertToFloat32", thisP, f32Type)
                    enter(scope, "convertToFloat64", thisP, f32Type)
                    break
            }
            break
        }
        case TypeKind.F32: {
            enter(scope, "truncToInt32", thisP, i32Type)
            enter(scope, "truncToUInt32", thisP, u32Type)
            enter(scope, "truncToInt64", thisP, i64Type)
            enter(scope, "truncToUInt64", thisP, u64Type)
            enter(scope, "promoteToFloat64", thisP, f64Type)
            enter(scope, "reinterpretToUInt32", thisP, u32Type)
            break
        }
        case TypeKind.F64: {
            enter(scope, "truncToInt32", thisP, i32Type)
            enter(scope, "truncToUInt32", thisP, u32Type)
            enter(scope, "truncToInt64", thisP, i64Type)
            enter(scope, "truncToUInt64", thisP, u64Type)
            enter(scope, "demoteToFloat32", thisP, f32Type)
            enter(scope, "reinterpretToUInt64", thisP, u64Type)
            break
        }
        case TypeKind.Boolean:
            enter(scope, "toInt", thisP, i32Type)
            break
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
        capabilityMethods(type, scope)
        conversionMethods(type, scope)
        if (type.kind != TypeKind.Pointer) {
            builtinCache.set(type.kind, scope)
        }
    }
    return scope
}