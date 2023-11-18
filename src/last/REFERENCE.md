# Node Kinds

### AbsoluteValue `abs T -> T where T: Floatable`

Take the absolute value of the operant. The operant type must have the `Floatable` capability.

### Add `T + T -> T where T: Numeric`

Adds the operants. Operants must be equivilent type with the `Numeric` capability.

### AddressOf `T -> ^T where T: Location`

Take the address of the operant. The operant must have the `Location` capability.

### And `T && T -> Boolean where T: Logical`

Logical and of the operants. Operants must be equivilent type with the `Logical` capability.

### ArrayConstructor `<type-expression>[<size?>]`

Declare an array type. If size is unspecified it is an unbound bound array of zero size (allocates no memory), Elements are sequencial in their unpacked size. The size of the array is size of the elmeent times the size.

### ArrayIndex `A[i32] -> E where (A : (EP[]+Locatable, E: EP+Locatable) or (A: E[])`

Retrive the specified element from an array. The result of the expression is the element type of the array. If the array is `Locatable` then so is the expression.

### ArrayLiteral `[ T, ... ]`

Specifies an array literal.

### As `T as N -> N where T: Pointer | PointerSized, N: Pointer | PointerSized`

Converts the type of the operant to the specified type where the types have the `Pointer` or `PointerSized` capabilities.

### Assign `T+Location = T`

Assign the value of the expression to a `Location` of the same type.

### BitAnd `T & T -> T where T: Bitwiseable`

Bitwise and of the operants. Operants must be equivilent type with the `Bitwiseable` capability.

### BitOr `T | T -> T where T: Bitwiseable`

Bitwise or of the operants. Operants must be equivilent type with the `Bitwiseable` capability.

### BitRotl `T rotl swiden(T) -> T where T: Rotatable`

Bitwise rotate left right bits of the left operant. The left operant must have the `Rotatable` capability and the right operant must be the wide version of `T`.

### BitRotl `T rotr swiden(T) -> T where T: Rotatable`

Bitwise rotate right right bits of the left operant. The left operant must have the `Rotatable` capability and the right operant must be the wide version of `T`.

### BitShl `T << swiden(T) -> T where T: Bitwiseable`

Bitwise shift left right bits of the left operant. The left operant must have the `Bitwiseable` capability and the right operant must be the wide version of `T`.

### BitShr `T >> swiden(T) -> T where T: Bitwiseable`

Bitwise shift right right bits of the left operant. The left operant must have the `Bitwiseable` capability and the right operant must be the wide version of `T`.

### BitXor `T ^ T -> T where T: Bitwiseable`

Bitwise or of the operants. Operants must be equivilent type with the `Bitwiseable` capability.

### Block `{ ...: T } -> T`

A sequence of expressions. The value of a block is the value of the last expression. A block can have an optional name which can be the target of a `Branch`. A block that is the target of block `Branch` must have a `Void` type. A `Branch` targeted at a `Block` branches to the end of the `Block`.

### Branch `branch -> Never`

Branch to the enclosing `Block` or `Loop` or the specified target.

### BranchIndexed `branch i32 [Ref,...] else Ref -> Never`

Branch to the referenced target based on the index. If the expression is out of range then the else reference is taken.

### Call `T(P, ...) -> R where T: Callable(R) -> R`

Call the specified function with the given parameters. The target of the call must have the `Callable` capability. The result of the expression is the type returned by the specified function.

### Ceiling `ceil T -> T where T: Floatable`

The ceiling value of the operant. The operant type must have the `Floatable` capability.

### ConvertTo `T convertto N`

Converts the operant to the specified type. The conversion must be a valid conversion from the type conversion table below.

### CopySign `T copysign T -> T where T: Floatable`

The copy the sign from the left to the right operant. The operants must be of equivilent type with the `Floatable` capability.

### CountLeadingZeros `T -> T where T: Bitcountable`

Count the number of leading zero bits of the operant. Type operant must have the `Bitcountable` capability.

### CountNonZeros `T -> T where T: Bitcountable`

Count the number of non-zero bits of the operant. Type operant must have the `Bitcountable` capability.

### CountTrailingZeros `T -> T where T: Bitcountable`

Count the number of trailing zero bits of the operant. Type operant must have the `Bitcountable` capability.

### Dereference `P^ -> T + Location where P: T^`

Dereference the pointer operant. The resulting type receives the `Location` capability.

### Divide `T / T -> T where T: Numeric`

Divides the operants. Operants must be equivilent type and with the `Numeric` capability.

### Equals `T == T -> Boolean where T: Equatable`

Compares operants for equality. Operants must be equivilent type with the `Equatable` capability.

### Export `export <exportable item>`

Export a global variable or function.

### Field `<name>: T -> n/a`

Specifies the value of a struct literal. A `Field` is only valid in a `StructLiteral`.

### FieldLiteral `<name>: <type-expression>`

Specifies a field of a struct or union type.

### Floor `floor T -> T where T: Floatable`

The floor value of the operant. The operant type must have the `Floatable` capability.

### Function `fun <name>(<param>...): T { ...: T} -> Void`

Declare a function with the given name.

### Global `global <name>: T = T -> Void`

Declare a global variable with the given name and type initalized to the given value.

### GreaterThan `T > T -> Boolean where T: Comparable`

Compares operants and is true if left is greater than right. Operants must be equivilent type with the `Comprable` capability.

### GreaterThanEquals `T >= T -> Boolean where T: Comparable`

Compares operants and is true if left is greater than or equal to right. Operants must be equivilent type with the `Comprable` capability.

### IfThenElse `if Boolean { ...: T } else { ...: T} -> T`

Executes the then or else sequence depending on the value of the expression. The value of the then and else sequences must match if the else has a sequence.

### Import `<import-declaration> ...`

Import exported items from another module.

### ImportFunction `<module> <name> <alias?>(<param>...): <return-type>`

Import an exported function from another module, optionally renaming it.

### ImportVariable `<module> <name> <alias?> : <type-expression>`

Import an export global variable of the given expected type.

### LessThan `T < T -> Boolean where T: Comparable`

Compares operants and is true if left is greater than right. Operants must be equivilent type with the `Comprable` capability.

### LessThanEquals `T <= T -> Boolean where T: Comparable`

Compares operants and is true if left is greater than or equal to right. Operants must be equivilent type with the `Comprable` capability.

### Let `let <name> = T`

Declare a compile time constant.

### LiteralBool `-> Boolean`

Specifies a `Boolean` literal

### LiteralI8 `-> i8`

Specifies an `i8` literal.

### LiteralI16 `-> i16`

Specifies an `i16` literal.

### LiteralI32 `-> i32`

Specifies an `i32` literal.

### LiteralI64 `-> i64`

Specifies an `i64` literal.

### Literalf32 `-> f32`

Specifies a `f32` literal.

### Literalf64 `-> f64`

Specifies a `f64` literal.

### LiteralNull `-> Null`

Specifies a `null` pointer literal

### LiteralU8 `-> u8`

Specifies an `u8` literal.

### LiteralU16 `-> u16`

Specifies an `u16` literal.

### LiteralU32 `-> u32`

Specifies an `u32` literal.

### LiteralU64 `-> u64`

Specifies an `u64` literal.

### Loop `loop { ... } -> Void`

A sequence of block elements. The `Loop` can have an optional name which can be the target of a `Branch`. A `Branch` that targets a `Loop` will branch to the first statement of the loop.

### MemoryLimit `memory$limit -> Void^`

The pointer to the limit of the allocated memory. The result is `Void^`.

### MemoryTop `memory$top -> Void^`

The pointer to the top of memory section. The result is `Void^`.

### MemoryGrow `memory$grow(i32) -> i32`

Grow the allocated memory by the specified number of pages.

### Minimum `T max T -> T where T: Floatable`

The maximum value of the operants. The operant type must have the `Floatable` capability.

### Minimum `T min T -> T where T: Floatable`

The minimum value of the operants. The operant type must have the `Floatable` capability.

### Module `<import>... <declaration>...`

Define a module. This the root node of the AST.

### Multiply - `T * T -> T where T: Numeric`

Multiplies the operants. Operants must be equivilent type and with the `Numeric` capability.

### Negate `-T -> T where T: Negatable`

Negates the operant. Operant must have the `Negatable` capability.

### Not `!T -> T where T: Logical`

Logical not of the operant. Operant must have the `Logical` capability

### NotEquals `T != T -> Boolean where T: Equatable`

Compares operants for inequality. Operants must be equivilent type with the `Equatable` capability.

### Or `T || T -> Boolean where T: Logical`

Logical or of the operants. Operants must be equivilent type with the `Logical` capability.

### Parameter `<name>: T -> n/a`

Declare a parmeter. A `Parameter` is only valid in an `Function` declaration.

### PointerConstructor `<type-expression> ^`

Declare a pointer to a type expression. Pointers are 4 bytes and stored in an i32.

### Primitive `<name> -> n/a`

Specifies a primitive type in a type expression.

### Reference `<name> -> T`

Reference a parameter, local, global, function or data memory location. The type of the result depends on the symbol being referenced.

### ReinterpretAs `T as N`

Reinterpret the operant as the specified type. The reinterpretation must a valid reinterpretation from the type reinterpretation table below.

### Remainder `T % T where T: Numeric`

Remainder of the operants. Operants must be equivilent type and with the `Numeric` capability.

### Return `return [T] -> Never`

Return the value (if specified, Void if not) from the enclosing function.

### RoundNearest `trunc T -> T where T: Floatable`

The nearest round value of the operant. The operant type must have the `Floatable` capability.

### Select `S.<name> -> T where S : { ..., <name>: T }`

Select the named field of a struct type. The type of the expression is the type of the field.

### SizeOf `sizeof T -> i32`

The allocation size of the specified type.

### SquareRoot `sqrt T -> T where T: Floatable`

Take the square root of the operant. The operant type must have the `Floatable` capability.

### StructLiteral `{ <name>: T ... }`

Specifies a struct literal with the given fields.

### StructTypeLiteral `{ <name>: <type-expression> ... }`

Declare a structured type. The fields are layed out sequencially unpacked. The size of the type is the sum of the size of the fields.

### Subtract - `T - T -> T where T: Numeric`

Subtracts the operants. Operants must be equivilent type and with the `Numeric` capability.

### Truncate `trunc T -> T where T: Floatable`

The truncated value of the operant. The operant type must have the `Floatable` capability.

### TruncateTo `T trunc N -> N`

Truncate the operant to the specified type with the specified saturation. The truncation must be valid from the type truncation table below.

### TypeDeclaration `<type-expression> -> T`

Declare a named alias for type expression.

### TypeSelect `<type-expression>.<name> -> T`

Select a member of a type.

### UnionTypeLiteral `{ <name>: <type-expression> ... }`

Declare a union type. The fields are layed out overlapping. The size is the size of the largest field.

### Var `var <name>: T = T`

Declare a variable location with the given name. If the type is not specified it is inferred from the initialization expression.

### WrapTo `wrap i64 -> i32`

Wrap the operant to `i32`. The operant must be of type `i64`.

## Type primitives

| Type | Packed size | Unpacked size | WASM type | Description                                             |
| ---- | ----------- | ------------- | --------- | ------------------------------------------------------- |
| i8   |  1 byte     | 4 bytes       | I32       | 8 bit signed integer value                              |
| i16  |  2 bytes    | 4 bytes       | I32       | 16 bit signed integer value                             |
| i32  |  4 bytes    | 4 bytes       | I32       | 32 bit signed integer value                             |
| i64  |  8 bytes    | 8 bytes       | I64       | 64 bit signed integer value                             |
| u8   |  1 byte     | 4 bytes       | I32       | 8 bit unsigned integer value                            |
| u16  |  2 bytes    | 4 bytes       | I32       | 16 bit unsigned integer value                           |
| u32  |  4 bytes    | 4 bytes       | I32       | 32 bit unsigned integer value                           |
| u64  |  8 bytes    | 8 bytes       | I64       | 64 bit unsigned integer value                           |
| f32  |  4 bytes    | 4 bytes       | F32       | 32 bit floating point value                             |
| f64  |  8 bytes    | 8 bytes       | F64       | 64 bit floating point value                             |
| Bool |  1 byte     | 4 bytes       | I32       | A Boolean value 0 - false, 1 - true                     |
| Void |  0 bytes    | 0 bytes       | N/A       | Returned by a function with no return value             |
| Null |  4 bytes    | 4 bytes       | I32       | A null pointer                                          |

## Type capabilites

The following primitive types have the given capabilites:

| Type    | Capabilities                                                        |
| ------- | ----------------------------------------------------------------------------------------------- |
| Boolean | Logical, Equatable                                                                              |
| i8      | Bitwiseable, Comparable, Equatable, Negatable, Numeric                                          |
| i16     | Bitwiseable, Comparable, Equatable, Negatable, Numeric                                          |
| i32     | Bitcountable, Bitwiseable, Comparable, Equatable, Negatable, Numeric, PointerSized, Rotateable  |
| i64     | Bitcountable, Bitwiseable, Comparable, Equatable, Negatable, Numeric, Rotatable                 |
| f32     | Equatable, Comparable, Floatable, Negatable, Numeric                                            |
| f64     | Equatable, Comparable, Floatable, Negatable, Numeric                                            |
| u8      | Bitwiseable, Comparable, Equatable, Negatable, Numeric                                          |
| u16     | Bitwiseable, Comparable, Equatable, Negatable, Numeric                                          |
| u32     | Bitcountable, Bitwiseable, Comparable, Equatable, Negatable, Numeric, PointerSized, Rotateable  |
| u64     | Bitcountable, Bitwiseable, Comparable, Equatable, Negatable, Numeric, Rotatable                 |

Types of the form `T[]` have the `Indexable` capability.

Function types have the `Callable` capability.

Types with a location have `Loadable` and `Storeable` capabilities.

All types of the form `^T` have `Pointer`, `Comparable`, `Equatable`, `Loadable`, and `Storeable` capabilities.

The `null` types has the `Comparable` capability.

## Type conversions

The following are valid type conversions:

| From    | To                                                      |
| ------- | ------------------------------------------------------- |
| Boolean | i32                                                     |
| i8      | i8, i16, i32, i64, u8, u16, u32, u64, f32, f64          |
| i16     | i8, i16, i32, i64, u8, u16, u32, u64, f32, f64          |
| i32     | Boolean, i8, i16, i32, i64, u8, u16, u32, u64, f32, f64 |
| i64     | i8, i16, i32, i64, u8, u16, u32, u64, f32, f64          |
| f32     | f64                                                     |
| f64     | f32                                                     |
| u8      | i8, i16, i32, i64, u8, u16, u32, u64, f32, f64          |
| u16     | i8, i16, i32, i64, u8, u16, u32, u64, f32, f64          |
| u32     | i8, i16, i32, i64, u8, u16, u32, u64, f32, f64          |
| u64     | i8, i16, i32, i64, u8, u16, u32, u64, f32, f64          |

## Type truncations

The following are valid type truncations:

| From    | To                                                      |
| ------- | ------------------------------------------------------- |
| f32     | i32, i64, u32, u64                                      |
| f64     | i32, i64, u32, u64                                      |

## Type reinterpretation

The following types can be reinterpeted as

| From    | To            |
| ------- | ------------- |
| f32     | u32           |
| f64     | u64           |
| Pointer | Pointer, u32  |
| u32     | Pointer, f32  |
| u64     | f64           |

where `Pointer` is a pointer to any other type.

## Type functions

### swiden(T)

The `swiden` of `T` is the widest signed primitive type that holds `T` from `i32`, `i64`. For example, the `swiden` type of `i8` is `i32` and the `swiden` type of `u64` is `i64`.