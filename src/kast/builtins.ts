import * as last from '../last'
import { ArrayType, FunctionType, Type, TypeKind } from "./types";

export function createBuiltins(): last.Scope<Type> {
    const result = new last.Scope<Type>()

    const bool = primitive(
        last.PrimitiveKind.Bool,
        selfLogicalMethods,
        selfEquatableMethods,
    )

    const i32 = primitive(
        last.PrimitiveKind.I32,
        numericMethods,
        bitwizeMethods,
        negatableMethods,
        selfShiftMethods,
        selfRotatableMethods,
        selfBitcountableMethods,
        equatableMethods,
        comparableMethods,
    )

    const i8 = primitive(
        last.PrimitiveKind.I8,
        numericMethods,
        comparableMethods,
        equatableMethods,
        negatableMethods,
        bitwizeMethods,
    )

    const i16 = primitive(
        last.PrimitiveKind.I16,
        numericMethods,
        comparableMethods,
        equatableMethods,
        negatableMethods,
        bitwizeMethods,
    )

    const i64 = primitive(
        last.PrimitiveKind.I64,
        numericMethods,
        comparableMethods,
        equatableMethods,
        negatableMethods,
        bitwizeMethods,
        selfRotatableMethods,
        selfShiftMethods,
        selfBitcountableMethods,
    )
    
    const u32 = primitive(
        last.PrimitiveKind.U32,
        numericMethods,
        bitwizeMethods,
        negatableMethods,
        selfShiftMethods,
        selfRotatableMethods,
        selfBitcountableMethods,
        equatableMethods,
        comparableMethods,
    )

    const u8 = primitive(
        last.PrimitiveKind.U8,
        numericMethods,
        comparableMethods,
        equatableMethods,
        negatableMethods,
        bitwizeMethods,
    )

    const u16 = primitive(
        last.PrimitiveKind.U16,
        numericMethods,
        comparableMethods,
        equatableMethods,
        negatableMethods,
        bitwizeMethods,
    )

    const u64 = primitive(
        last.PrimitiveKind.U64,
        numericMethods,
        comparableMethods,
        equatableMethods,
        negatableMethods,
        bitwizeMethods,
        selfRotatableMethods,
        selfShiftMethods,
        selfBitcountableMethods,
    )

    const f32 = primitive(
        last.PrimitiveKind.F32,
        numericMethods,
        comparableMethods,
        equatableMethods,
        negatableMethods,
        floatingPointMethods,
    )

    const f64 = primitive(
        last.PrimitiveKind.F32,
        numericMethods,
        comparableMethods,
        equatableMethods,
        negatableMethods,
        floatingPointMethods,
    )

    const _void = primitive(
        last.PrimitiveKind.Void,
    )

    const _null = primitive(
        last.PrimitiveKind.Null
    )

    result.enter('i8', i8)
    result.enter('i16', i16)
    result.enter('i32', i32)
    result.enter('i64', i64)
    result.enter('u8', u8)
    result.enter('u16', u16)
    result.enter('u32', u32)
    result.enter('u64', u64)
    result.enter('f32', f32)
    result.enter('f64', f64)
    result.enter('bool', bool)
    result.enter('void', _void)
    result.enter('null', _null)

    return result

    function equatableMethods(self: Type): ScopeItem<FunctionType>[] {
        return [
            binaryOp("infix ==", self, bool),
            binaryOp("infix !=", self, bool),
        ]
    }

    function comparableMethods(self: Type): ScopeItem<FunctionType>[] {
        return [
            binaryOp("infix <=", self, bool),
            binaryOp("infix >=", self, bool),
            binaryOp("infix >", self, bool),
            binaryOp("infix <", self, bool),
        ]
    }
}

export function makeLocation(type: Type): Type {
    const self: any = {
        kind: TypeKind.Struct
    }
    self.fields = scope(item('location value', type))
    self.methods = scope(method('prefix *', self))
    return self
}

export function makeAddressableLocation(type: Type): Type {
    const self: any = {
        kind: TypeKind.Struct
    }
    self.fields = scope(item('location value', type))
    self.methods = scope(
        method('prefix *', self),
        method('prefix &', self)
    )
    return self
}

export function makePointer(type: Type): Type {
    const self: any = {
        kind: TypeKind.Struct,
        primitive: last.PrimitiveKind.I32
    }
    self.fields = emptyScope()
    self.methods = scope(method('postfix ^', makeAddressableLocation(type)))
    return self
}

export function makeArray(element: Type, size?: number): Type {
    const self: any = {
        kind: TypeKind.Array,
        element,
        size
    }
    self.methods = scope(
        method('postfix []', makeAddressableLocation(element))
    )
    return self
}

function primitive(
    primitive: last.PrimitiveKind,
    ...methods: ((type: Type) => ScopeItem<FunctionType>[])[]
): Type {
    const self: any = {
        kind: TypeKind.Struct,
        primitive
    }
    self.fields = emptyScope<Type>() 
    self.methods = scope<FunctionType>(...methods.map(m => m(self)).flat())
    return self
}

function selfLogicalMethods(self: Type): ScopeItem<FunctionType>[] {
    return [
        unaryOp("prefix !", self),
        binaryOp("inline &&", self),
        binaryOp("inline ||", self),
    ]
}

function selfEquatableMethods(self: Type): ScopeItem<FunctionType>[] {
    return [
        binaryOp("infix ==", self),
        binaryOp("infix !=", self),
    ]
}

function numericMethods(self: Type): ScopeItem<FunctionType>[] {
    return [
        binaryOp("infix +", self),
        binaryOp("infix -", self),
        binaryOp("infix *", self),
        binaryOp("infix /", self),
        binaryOp("infix %", self)
    ]
}

function bitwizeMethods(self: Type): ScopeItem<FunctionType>[] {
    return [
        binaryOp("infix &", self),
        binaryOp("infix |", self),
        binaryOp("infix ^", self),
    ]
}

function negatableMethods(self: Type): ScopeItem<FunctionType>[] {
    return [
        unaryOp("prefix ~", self)
    ]
}

function selfShiftMethods(self: Type): ScopeItem<FunctionType>[] {
    return [
        binaryOp("infix shl", self),
        binaryOp("infix shr", self),
    ]
}

function selfRotatableMethods(self: Type): ScopeItem<FunctionType>[] {
    return [
        binaryOp("infix rotr", self),
        binaryOp("infix rotl", self),
    ]
}

function selfBitcountableMethods(self: Type): ScopeItem<FunctionType>[] {
    return [
        method("countLeadingZeros", self),
        method("countTrailingZeros", self),
        method("countNonZeros", self),
    ]
}

function floatingPointMethods(self: Type): ScopeItem<FunctionType>[] {
    return [
        method('abs', self),
        method('sqrt', self),
        method('floor', self),
        method('ceil', self),
        method('trunc', self),
        method('round', self),
    ]
}

interface ScopeItem<T> {
    name: string,
    item: T
}

function item<T>(name: string, item: T): ScopeItem<T> {
    return { name, item }
}

function scope<T>(...scopeItems: ScopeItem<T>[]): last.Scope<T> {
    const result = new last.Scope<T>()
    for (const item of scopeItems) {
        result.enter(item.name, item.item)
    }
    return result
}

function emptyScope<T>(): last.Scope<T> {
    return new last.Scope<T>()
}

function functionType(result: Type, ...parameters: ScopeItem<Type>[]): FunctionType {
    return {
        kind: TypeKind.Function,
        parameters: scope(...parameters),
        result
    }   
}

function method(name: string, result: Type, ...parameters: ScopeItem<Type>[]): ScopeItem<FunctionType> {
    return item(name, functionType(result, ...parameters))
}

function binaryOp(name: string, type: Type, result: Type = type): ScopeItem<FunctionType> {
    return method(name, result, item("other", type))
}

function unaryOp(name: string, type: Type): ScopeItem<FunctionType> {
    return method(name, type)
}

