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
    BitAnd,
    BitOr,
    BitXor,
    BitShl,
    BitShr,
    BitRotr,
    BitRotl,
    CountLeadingZeros,
    CountTrailingZeros,
    CountNonZeros,
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
    Global,
    Primitive,
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
        case LastKind.BitAnd: return "BitAnd"
        case LastKind.BitOr: return "BitOr"
        case LastKind.BitXor: return "BitXor"
        case LastKind.BitShl: return "BitShl"
        case LastKind.BitShr: return "BitShr"
        case LastKind.BitRotr: return "BitRotr"
        case LastKind.BitRotl: return "BitRotl"
        case LastKind.CountLeadingZeros: return "CountLeadingZeros"
        case LastKind.CountTrailingZeros: return "CountTrailingZeros"
        case LastKind.CountNonZeros: return "CountNonZeros"
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
        case LastKind.Global: return "Global"
        case LastKind.Primitive: return "Primitive"
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

export const enum PrimitiveKind {
    I8, I16, I32, I64,
    U8, U16, U32, U64,
    F32, F64,
    Bool,
    Void,
    Null,
    Memory,
}

export function nameOfPrimitiveKind(kind: PrimitiveKind): string {
    switch (kind) {
        case PrimitiveKind.I8: return "i8"
        case PrimitiveKind.I16: return "i16"
        case PrimitiveKind.I32: return "i32"
        case PrimitiveKind.I64: return "i64"
        case PrimitiveKind.U8: return "u8"
        case PrimitiveKind.U16: return "u16"
        case PrimitiveKind.U32: return "u32"
        case PrimitiveKind.U64: return "u64"
        case PrimitiveKind.F32: return "f32"
        case PrimitiveKind.F64: return "f64"
        case PrimitiveKind.Bool: return "bool"
        case PrimitiveKind.Null: return "null"
        case PrimitiveKind.Void: return "void"
        case PrimitiveKind.Memory: return "memory"
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
    BitAnd |
    BitOr |
    BitXor |
    BitShl |
    BitShr |
    BitRotr |
    BitRotl |
    CountLeadingZeros |
    CountTrailingZeros |
    CountNonZeros |
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
    LiteralI8 |
    LiteralI6 |
    LiteralI32 |
    LiteralI64 |
    LiteralU8 |
    LiteralU16 |
    LiteralU32 |
    LiteralU64 |
    LiteralF32 |
    LiteralF64 |
    LiteralBool |
    LiteralNull |
    LiteralMemory

export type Exportable =
    Global |
    Function

export type Declaration =
    Let |
    Var |
    Global |
    TypeDeclaration |
    Function |
    Exported

export type Statement =
    Let |
    Var |
    TypeDeclaration |
    Loop |
    Block |
    Branch |
    BranchIndexed |
    Return |
    Assign

export type BodyElement =
    Statement |
    Expression

export type TypeExpression =
    Primitive |
    Reference |
    TypeSelect |
    StructTypeLiteral |
    ArrayConstructor |
    PointerConstructor

export type ImportItem =
    ImportFunction |
    ImportVariable

export type BranchTarget =
    Loop |
    Block

export type Last =
    Declaration |
    Statement |
    Expression |
    TypeExpression |
    Import |
    Parameter |
    ImportItem |
    Field |
    StructFieldLiteral |
    Module

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

/** Numeric addition (+) of left and right */
export interface Add extends LastNode, Binary { kind: LastKind.Add }

/** Numeric subtraction (-) of left and right */
export interface Subtact extends LastNode, Binary { kind: LastKind.Subtract }

/** Numeric multiplication (*) of left and right */
export interface Multiply extends LastNode, Binary { kind: LastKind.Multiply }

/** Numeric division (/) of left and right */
export interface Divide extends LastNode, Binary { kind: LastKind.Divide }

/** Numeric remainter (%) of left and right */
export interface Remainder extends LastNode, Binary { kind: LastKind.Remainder }

/** Numeric negation (~) of left and right */
export interface Negate extends LastNode, Unary { kind: LastKind.Negate }

/** Logical not of target */
export interface Not extends LastNode, Unary { kind: LastKind.Not }

/** Equals comparision (==) of left and right */
export interface Equal extends LastNode, Binary { kind: LastKind.Equal }

/** Not equals comparision (!=) of left and right */
export interface NotEqual extends LastNode, Binary { kind: LastKind.NotEqual }

/** Greater than comparsion (>) of left and right */
export interface GreaterThan extends LastNode, Binary { kind: LastKind.GreaterThan }

/** Greater than or equals comparison (>=) of left and right */
export interface GreaterThanEqual extends LastNode, Binary { kind: LastKind.GreaterThanEqual }

/** Less than comparision (<) of left and right */
export interface LessThan extends LastNode, Binary { kind: LastKind.LessThan }

/** Less than equals comparision (<=) of left and right */
export interface LessThanEqual extends LastNode, Binary { kind: LastKind.LessThanEqual }

/** Logical and (&&) of left and right (full evaluation, no short-circuit)  */
export interface And extends LastNode, Binary { kind: LastKind.And }

/** Logical or (||) of left and right (full evaluation, no short-circuit) */
export interface Or extends LastNode, Binary { kind: LastKind.Or }

/** Bitwise and (&) of left and right */
export interface BitAnd extends LastNode, Binary { kind: LastKind.BitAnd }

/** Bitwise or (|) of left and right */
export interface BitOr extends LastNode, Binary { kind: LastKind.BitOr }

/** Bitwise xor (^) of left and right */
export interface BitXor extends LastNode, Binary { kind: LastKind.BitXor }

/** Bitwise shift right (shr) of left and right */
export interface BitShr extends LastNode, Binary { kind: LastKind.BitShr }

/** Bitwise shift left (shl) of left and right */
export interface BitShl extends LastNode, Binary { kind: LastKind.BitShl }

/** Bitwise rotate right (rotr) of left and right */
export interface BitRotr extends LastNode, Binary { kind: LastKind.BitRotr }

/** Bitwise rotate left (rotl) of left and right */
export interface BitRotl extends LastNode, Binary { kind: LastKind.BitRotl }

/** Count leading zeros bits of target */
export interface CountLeadingZeros extends LastNode, Unary { kind: LastKind.CountLeadingZeros }

/** Count trailing zeros bits of target */
export interface CountTrailingZeros extends LastNode, Unary { kind: LastKind.CountTrailingZeros }

/** Count non-zero bits of target */
export interface CountNonZeros extends LastNode, Unary { kind: LastKind.CountNonZeros }

/** Cast of a pointer left to type expression right  */
export interface As extends LastNode { kind: LastKind.As, left: Expression, right: TypeExpression }

/** Memory address of target. Cannot be applied to locals, globals, or parameters */
export interface AddressOf extends LastNode, Unary { kind: LastKind.AddressOf }

/** Size of the type expression target */
export interface SizeOf extends LastNode { kind: LastKind.SizeOf; target: TypeExpression }

/** Dereference a pointer */
export interface Dereference extends LastNode, Unary { kind: LastKind.Dereference }

/** Number literal (abstract) */
export interface LiteralNumeric { kind: LastKind.Literal; value: number }

/** BigInt value literal */
export interface LiteralBigInt { kind: LastKind.Literal; value: bigint }

/** An Int8 literal (tiny) */
export interface LiteralI8 extends LastNode, LiteralNumeric { primitiveKind: PrimitiveKind.I8 }

/** An Int16 literal (short) */
export interface LiteralI6 extends LastNode, LiteralNumeric { primitiveKind: PrimitiveKind.I16 }

/** An Int32 literal (int) */
export interface LiteralI32 extends LastNode, LiteralNumeric { primitiveKind: PrimitiveKind.I32 }

/** An Int 64 literal (long) */
export interface LiteralI64 extends LastNode, LiteralBigInt { primitiveKind: PrimitiveKind.I64 }

/** A UInt8 literal (unsigned tiny) */
export interface LiteralU8 extends LastNode, LiteralNumeric { primitiveKind: PrimitiveKind.U8 }

/** A UInt16 literal (unsigned short) */
export interface LiteralU16 extends LastNode, LiteralNumeric { primitiveKind: PrimitiveKind.U16 }

/** A UInt32 literal (unsigned int) */
export interface LiteralU32 extends LastNode, LiteralNumeric { primitiveKind: PrimitiveKind.U32 }

/** A UInt64 literal (unsigned long) */
export interface LiteralU64 extends LastNode, LiteralBigInt { primitiveKind: PrimitiveKind.U64 }

/** A Float32 literal (single) */
export interface LiteralF32 extends LastNode, LiteralNumeric { primitiveKind: PrimitiveKind.F32 }

/** A Float64 literal (double) */
export interface LiteralF64 extends LastNode, LiteralNumeric { primitiveKind: PrimitiveKind.F64 }

/** A Boolean litreal (bool) */
export interface LiteralBool extends LastNode {
    kind: LastKind.Literal
    primitiveKind: PrimitiveKind.Bool
    value: boolean
}

/** A null literal (null) */
export interface LiteralNull extends LastNode {
    kind: LastKind.Literal
    primitiveKind: PrimitiveKind.Null
    value: null
}

/** A memory literal (memory) */
export interface LiteralMemory extends LastNode {
    kind: LastKind.Literal
    primitiveKind: PrimitiveKind.Memory
    value: null
}

/** A structured type initializer ({ ... }) */
export interface StructLiteral extends LastNode {
    kind: LastKind.StructLiteral
    fields: Field[]
}

/** A field of a structured type initializer ({f: ...}) */
export interface Field extends LastNode {
    kind: LastKind.Field
    name: Reference
    value: Expression
}

/** An array literal initializer ([...]) */
export interface ArrayLiteral extends LastNode {
    kind: LastKind.ArrayLiteral
    values: Expression[]
}

/** A block of statements or expresions ({ ... }). Branches to a block branch to after the block */
export interface Block extends LastNode {
    kind: LastKind.Block
    name?: Reference
    body: BodyElement[]
}

/** A block of statements or expressions. Branches to a loop branch to the top of the loop  */
export interface Loop extends LastNode {
    kind: LastKind.Loop
    name?: Reference
    body: BodyElement[]
}

/** An if-then-else statement or expression. */
export interface IfThenElse extends LastNode {
    kind: LastKind.IfThenElse
    condition: Expression
    then: BodyElement[]
    else: BodyElement[]
}

/** Branch to the target block or loop or the closest nested block or loop if the target is undefined */
export interface Branch extends LastNode {
    kind: LastKind.Branch
    target?: Reference
}

/** Branch based on the unsigned integer index value of condition into targets or to else if the number is not in range  */
export interface BranchIndexed extends LastNode {
    kind: LastKind.BranchIndexed
    condition: Expression
    targets: Reference[]
    else: Reference
}

/** Return from the enclosing function with an optional value  */
export interface Return extends LastNode {
    kind: LastKind.Return
    value?: Expression
}

/** Reference a parameter, local, global, function or data memory location */
export interface Reference extends LastNode {
    kind: LastKind.Reference
    name: string
}

/** Select a member of a structured type or builtin function of a type */
export interface Select extends LastNode {
    kind: LastKind.Select
    target: Expression
    name: Reference
}

/** Selet the 0 based targt index an array */
export interface Index extends LastNode {
    kind: LastKind.Index
    target: Expression
    index: Expression
}

/** Assign value (rvalue) to the location indicated by target (lvalue) */
export interface Assign extends LastNode {
    kind: LastKind.Assign
    target: Expression
    value: Expression
}

/** Declare a function with the given name, parameters, result type and statements or expressions */
export interface Function extends LastNode {
    kind: LastKind.Function
    name: Reference
    parameters: Parameter[]
    result: TypeExpression
    body: BodyElement[]
}

/** Declare a parameter of a function or function import */
export interface Parameter extends LastNode {
    kind: LastKind.Parameter
    name: Reference
    type: TypeExpression
}

/** Call the target with the given arguments, in order */
export interface Call extends LastNode {
    kind: LastKind.Call
    target: Expression
    arguments: Expression[]
}

/** Declare a constant expresion of the given name, type and value */
export interface Let extends LastNode {
    kind: LastKind.Let
    name: Reference
    type: TypeExpression
    value: Expression
}

/** Declare a variable with the given name and type with an optional initializer. */
export interface Var extends LastNode {
    kind: LastKind.Var
    name: Reference
    type?: TypeExpression
    value?: Expression
}

/** Declare a global varaible with the given name and type with an optional initializer */
export interface Global extends LastNode {
    kind: LastKind.Global
    name: Reference
    type: TypeExpression
    value: Expression
}

/** A reference to a primitive type */
export interface Primitive extends LastNode {
    kind: LastKind.Primitive
    primitive: PrimitiveKind
}

/** Declare a type with given name and type (typealias) */
export interface TypeDeclaration extends LastNode {
    kind: LastKind.Type
    name: Reference
    type: TypeExpression
}

/** Select a nested member of a type*/
export interface TypeSelect extends LastNode {
    kind: LastKind.TypeSelect
    target: TypeExpression
    name: Reference
}

/** Declare a structured type (struct) */
export interface StructTypeLiteral extends LastNode {
    kind: LastKind.StructTypeLiteral
    fields: StructFieldLiteral[]
}

/** Declare a field of a structured type with the given name and type */
export interface StructFieldLiteral extends LastNode {
    kind: LastKind.StructFieldLiteral
    name: Reference
    type: TypeExpression
}

/** An array type expresion ([]) */
export interface ArrayConstructor extends LastNode {
    kind: LastKind.ArrayConstructor
    element: TypeExpression
    size?: number
}

/** A pointr type expression (*) */
export interface PointerConstructor extends LastNode {
    kind: LastKind.PointerConstructor
    target: TypeExpression
}

/** Export the target declaration (export) */
export interface Exported extends LastNode {
    kind: LastKind.Exported
    target: Exportable
}

/** Import the given name from the given module (abstract), optionally renaming it */
export interface ImportDescription {
    module: Reference
    name: Reference
    as?: Reference
}

/** A list of import (import) */
export interface Import extends LastNode {
    kind: LastKind.Import
    imports: ImportItem[]
}

/** Import a function with the given name, parameters, and result from the given module */
export interface ImportFunction extends LastNode, ImportDescription {
    kind: LastKind.ImportFunction
    parameters: Parameter[]
    result: TypeExpression
}

/** Import a variable form the given name and type from the given module*/
export interface ImportVariable extends LastNode, ImportDescription {
    kind: LastKind.ImportVariable
    type: TypeExpression
}

/** The root elmenet of the AST which describes a compilation unit */
export interface Module extends LastNode {
    kind: LastKind.Module
    imports: Import[]
    declarations: Declaration[]
}

/** A utility function that allows copying a AST element and modifying some or all its values */
export function copy<T extends Last>(original: T, overrides: Partial<T> = {}): T {
    return { ...original, ...overrides }
}
