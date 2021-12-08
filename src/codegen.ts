import { ArrayLit, Assign, Call, CompareOp, Index, Function, Let, LiteralKind, Loop, NodeKind, Scope, Select, StructLit, Tree, Var, IfThenElse } from "./ast";
import { booleanType, builtInMethodsOf, f64Type, i32Type, Type, TypeKind, voidType } from "./types";
import { ByteWriter } from "./wasm/bytewriter";
import { Generate, gen, Label, label } from "./wasm/codeblock";
import { CodeSection } from "./wasm/codesection";
import { DataCountSection } from "./wasm/datacountsection";
import { DataSection } from "./wasm/datasection";
import { ExportKind, ExportSection } from "./wasm/exportsection";
import { FunctionSection } from "./wasm/functionSection";
import { GlobalSection } from "./wasm/globalsection";
import { ImportSection } from "./wasm/importSection";
import { Module } from "./wasm/module";
import { Section } from "./wasm/section";
import { TypeSection } from "./wasm/typesection";
import { FuncIndex, Inst, LocalIndex, NumberType, ReferenceType, ValueType } from "./wasm/wasm";

interface Symbol {
    type: GenType
    load(g: Generate): void
    store(g: Generate): void
    storeTo(symbol: Symbol, g: Generate): void
    addr(g: Generate): void
    call(args: Symbol[]): Symbol
    select(index: number | string): Symbol
    index(index: Symbol): Symbol
    simplify(): Symbol
    number(): number | undefined
}

interface GenTypeParts {
    piece?: ValueType
    fields?: GenType[]
    element?: GenType
    size?: number
    void?: boolean
}

function sizeOfParts(parts: GenTypeParts): number {
    const piece = parts.piece
    if (piece !== undefined) {
        switch(piece) {
            case NumberType.f32: return 4
            case NumberType.f64: return 8
            case NumberType.i32: return 4
            case NumberType.i64: return 8
            case ReferenceType.externref: return 4
            case ReferenceType.funcref: return 4
        }
    }
    const fields = parts.fields
    if (fields) {
        return fields.reduce((p, t) => p + t.size, 0)
    }
    const element = parts.element
    if (element) {
        const size = parts.size
        if (size === undefined) return 4
        return element.size * size
    }
    if (parts.void) return 0
    error("Invalid parts")
}

type LocalIndexes = LocalIndex | LocalIndexes[]
type LocalTypes = ValueType | LocalTypes[]

function flattenTypes(types: LocalTypes): ValueType[] {
    const result: ValueType[] = []
    function flatten(type: LocalTypes) {
        if (typeof type === "number")
            result.push(type)
        else type.forEach(flatten)
    }
    flatten(types)
    return result
}

class GenType {
    type: Type
    size: number
    parts: GenTypeParts

    constructor(type: Type, parts: GenTypeParts, size?: number) {
        this.type = type
        this.parts = parts
        this.size = size ?? sizeOfParts(parts)
    }

    loadData(g: Generate, addr: Symbol, offset: number) {
        const piece = this.parts.piece
        if (piece !== undefined) {
            switch (piece) {
                case NumberType.f32:
                    addr.load(g)
                    g.inst(Inst.f32_load)
                    g.index(offset)
                    g.index(4)
                    return
                case NumberType.f64:
                    addr.load(g)
                    g.inst(Inst.f64_load)
                    g.index(offset)
                    g.index(8)
                    return
                case NumberType.i32:
                    addr.load(g)
                    g.inst(Inst.i32_load)
                    g.index(offset)
                    g.index(4)
                    return
                case NumberType.i64:
                    addr.load(g)
                    g.inst(Inst.i64_load)
                    g.index(offset)
                    g.index(4)
                    return
                default:
                    unsupported()
            }
        }

        const fields = this.parts.fields
        if (fields) {
            let current = offset
            for (const field of fields) {
                field.loadData(g, addr, current)
                current += field.size
            }
            return
        }
        unsupported()
    }

    storeData(g: Generate, addr: Symbol, offset: number) {
        const piece = this.parts.piece
        if (piece !== undefined) {
            switch (piece) {
                case NumberType.f32:
                    addr.load(g)
                    g.inst(Inst.f32_store)
                    g.index(offset)
                    g.index(4)
                    return
                case NumberType.f64:
                    addr.load(g)
                    g.inst(Inst.f64_store)
                    g.index(offset)
                    g.index(8)
                    return
                case NumberType.i32:
                    addr.load(g)
                    g.inst(Inst.i32_store)
                    g.index(offset)
                    g.index(4)
                    return
                case NumberType.i64:
                    addr.load(g)
                    g.inst(Inst.i64_store)
                    g.index(offset)
                    g.index(8)
                    return
                default:
                    unsupported()
            }
        }
        const fields = this.parts.fields
        if (fields) {
            let current = offset
            const offsets: number[] = []
            for (const field of fields) {
                offsets.push(current)
                current += field.size
            }
            for (let i = offsets.length - 1; i >= 0; i--) {
                fields[i].storeData(g, addr, offsets[i])
            }
            return
        }
        unsupported()
    }

    loadLocal(g: Generate, localIndex: LocalIndexes) {
        if (typeof localIndex == "number") {
            g.inst(Inst.Local_get)
            g.index(localIndex)
        } else {
            const fields = required(this.parts.fields)
            check(fields.length == localIndex.length)
            for (let i = 0; i < fields.length; i++) {
                fields[i].loadLocal(g,localIndex[i])
            }
        }
    }

    storeLocal(g: Generate, localIndex: LocalIndexes) {
        if (typeof localIndex == "number") {
            g.inst(Inst.Local_set)
            g.index(localIndex)
        } else {
            const fields = required(this.parts.fields)
            check(fields.length == localIndex.length)
            for (let i =fields.length - 1; i >=0; i--) {
                fields[i].loadLocal(g,localIndex[i])
            }
        }
    }

    locals(): LocalTypes {
        const parts = this.parts
        const piece = parts.piece
        if (piece !== undefined) {
            return piece
        }
        const fields = parts.fields
        if (fields !== undefined) {
            return fields.map(t => t.locals())
        }
        if (parts.void) return []
        unsupported()
    }

    select(index: number | string): { type: GenType, offset: number, index: number } {
        if (typeof index === "string") {
            const type = this.type
            if (type.kind == TypeKind.Struct) {
                index = required(type.fields.order(index))
            } else unsupported()
        }
        const fields = required(this.parts.fields)
        check(index <= fields.length)
        const type = fields[index]
        const offset = fields.slice(0, index - 1).reduce((p, t) => p + t.size, 0)
        return { type, offset, index }
    }

    index(): GenType {
        return required(this.parts.element)
    }

    op(kind: NodeKind, g: Generate) {
        switch (kind) {
            case NodeKind.Add:
                switch (this.type.kind) {
                    case TypeKind.I8:
                    case TypeKind.I16:
                    case TypeKind.I32:
                    case TypeKind.U8:
                    case TypeKind.U16:
                    case TypeKind.U32:
                        g.inst(Inst.i32_add)
                        return
                    case TypeKind.I64:
                    case TypeKind.U64:
                        g.inst(Inst.i64_add)
                        return
                    case TypeKind.F32:
                        g.inst(Inst.f32_add)
                        return
                    case TypeKind.F64:
                        g.inst(Inst.f64_add)
                        return
                }
                break
            case NodeKind.Subtract:
                switch (this.type.kind) {
                    case TypeKind.I8:
                    case TypeKind.I16:
                    case TypeKind.I32:
                    case TypeKind.U8:
                    case TypeKind.U16:
                    case TypeKind.U32:
                        g.inst(Inst.i32_sub)
                        return
                    case TypeKind.I64:
                    case TypeKind.U64:
                        g.inst(Inst.i64_sub)
                        return
                    case TypeKind.F32:
                        g.inst(Inst.f32_sub)
                        return
                    case TypeKind.F64:
                        g.inst(Inst.f64_sub)
                        return
                }
                break
            case NodeKind.Multiply:
                switch (this.type.kind) {
                    case TypeKind.I8:
                    case TypeKind.I16:
                    case TypeKind.I32:
                    case TypeKind.U8:
                    case TypeKind.U16:
                    case TypeKind.U32:
                        g.inst(Inst.i32_mul)
                        return
                    case TypeKind.I64:
                    case TypeKind.U64:
                        g.inst(Inst.i64_mul)
                        return
                    case TypeKind.F32:
                        g.inst(Inst.f32_mul)
                        return
                    case TypeKind.F64:
                        g.inst(Inst.f64_mul)
                        return
                }
                break
            case NodeKind.Divide:
                switch (this.type.kind) {
                    case TypeKind.I8:
                    case TypeKind.I16:
                    case TypeKind.I32:
                        g.inst(Inst.i32_div_s)
                        break
                    case TypeKind.U8:
                    case TypeKind.U16:
                    case TypeKind.U32:
                        g.inst(Inst.i32_div_u)
                        break
                    case TypeKind.I64:
                        g.inst(Inst.i64_div_s)
                        return
                    case TypeKind.U64:
                        g.inst(Inst.i64_div_u)
                        return
                    case TypeKind.F32:
                        g.inst(Inst.f64_div)
                        return
                    case TypeKind.F64:
                        g.inst(Inst.f64_div)
                        return
                }
                break
        }
        unsupported()
    }

    compare(op: CompareOp, g: Generate) {
        switch (op) {
            case CompareOp.Equal:
                switch (this.type.kind) {
                    case TypeKind.I8:
                    case TypeKind.I16:
                    case TypeKind.I32:
                    case TypeKind.U8:
                    case TypeKind.U16:
                    case TypeKind.U32:
                        g.inst(Inst.i32_eq)
                        return
                    case TypeKind.I64:
                    case TypeKind.U64:
                        g.inst(Inst.i64_eq)
                        return
                    case TypeKind.F32:
                        g.inst(Inst.f32_eq)
                        return
                    case TypeKind.F64:
                        g.inst(Inst.f64_eq)
                        return
                }
                break
            case CompareOp.GreaterThan:
                switch (this.type.kind) {
                    case TypeKind.I8:
                    case TypeKind.I16:
                    case TypeKind.I32:
                        g.inst(Inst.i32_gt_s)
                        return
                    case TypeKind.U8:
                    case TypeKind.U16:
                    case TypeKind.U32:
                        g.inst(Inst.i32_gt_u)
                        return
                    case TypeKind.I64:
                        g.inst(Inst.i64_gt_s)
                        return
                    case TypeKind.U64:
                        g.inst(Inst.i64_gt_u)
                        return
                    case TypeKind.F32:
                        g.inst(Inst.f32_gt)
                        return
                    case TypeKind.F64:
                        g.inst(Inst.f64_gt)
                        return
                }
                break
            case CompareOp.GreaterThanEqual:
                switch (this.type.kind) {
                    case TypeKind.I8:
                    case TypeKind.I16:
                    case TypeKind.I32:
                        g.inst(Inst.i32_gt_s)
                        return
                    case TypeKind.U8:
                    case TypeKind.U16:
                    case TypeKind.U32:
                        g.inst(Inst.i32_gt_u)
                        return
                    case TypeKind.I64:
                        g.inst(Inst.i64_gt_s)
                        return
                    case TypeKind.U64:
                        g.inst(Inst.i64_gt_u)
                        return
                    case TypeKind.F32:
                        g.inst(Inst.f64_gt)
                        return
                    case TypeKind.F64:
                        g.inst(Inst.f64_gt)
                        return
                }
                break
            case CompareOp.LessThan:
                switch (this.type.kind) {
                    case TypeKind.I8:
                    case TypeKind.I16:
                    case TypeKind.I32:
                        g.inst(Inst.i32_lt_s)
                        return
                    case TypeKind.U8:
                    case TypeKind.U16:
                    case TypeKind.U32:
                        g.inst(Inst.i32_lt_u)
                        return
                    case TypeKind.I64:
                        g.inst(Inst.i64_lt_s)
                        return
                    case TypeKind.U64:
                        g.inst(Inst.i64_lt_u)
                        return
                    case TypeKind.F32:
                        g.inst(Inst.f64_lt)
                        return
                    case TypeKind.F64:
                        g.inst(Inst.f64_lt)
                        return
                }
                break
            case CompareOp.LessThanEqual:
                switch (this.type.kind) {
                    case TypeKind.I8:
                    case TypeKind.I16:
                    case TypeKind.I32:
                        g.inst(Inst.i32_le_s)
                        return
                    case TypeKind.U8:
                    case TypeKind.U16:
                    case TypeKind.U32:
                        g.inst(Inst.i32_le_u)
                        return
                    case TypeKind.I64:
                        g.inst(Inst.i64_le_s)
                        return
                    case TypeKind.U64:
                        g.inst(Inst.i64_le_u)
                        return
                    case TypeKind.F32:
                        g.inst(Inst.f64_le)
                        return
                    case TypeKind.F64:
                        g.inst(Inst.f64_le)
                        return
                }
                break
            case CompareOp.NotEqual:
                switch (this.type.kind) {
                    case TypeKind.I8:
                    case TypeKind.I16:
                    case TypeKind.I32:
                        g.inst(Inst.i32_ne)
                        return
                    case TypeKind.U8:
                    case TypeKind.U16:
                    case TypeKind.U32:
                        g.inst(Inst.i32_ne)
                        return
                    case TypeKind.I64:
                        g.inst(Inst.i64_ne)
                        return
                    case TypeKind.U64:
                        g.inst(Inst.i64_ne)
                        return
                    case TypeKind.F32:
                        g.inst(Inst.f64_ne)
                        return
                    case TypeKind.F64:
                        g.inst(Inst.f64_ne)
                        return
                }
                break
        }
        unsupported()
    }
}

class LocalSymbol implements Symbol {
    type: GenType
    locals: LocalIndexes

    constructor(type: GenType, locals: LocalIndexes) {
        this.type = type
        this.locals = locals
    }

    load(g: Generate): void {
        this.type.loadLocal(g, this.locals)
    }

    store(g: Generate): void {
        this.type.storeLocal(g, this.locals)
    }

    storeTo(symbol: Symbol, g:Generate) {
        this.load(g)
        symbol.store(g)
    }

    addr(g: Generate): void {
        unsupported()
    }

    call(args: Symbol[]): Symbol {
        unsupported()
    }

    select(index: number | string): Symbol {
        const locals = this.locals
        if (typeof locals === "number") {
            unsupported()
        }
        const {type, index: actualIndex} = this.type.select(index)
        return new LocalSymbol(type, locals[actualIndex])
    }

    index(index: Symbol): Symbol {
        unsupported()
    }

    simplify(): Symbol { return this }

    number(): undefined {
        return undefined
    }
}

const i32GenType = genTypeOf(i32Type)
const f64GenType = genTypeOf(f64Type)
const voidGenType = genTypeOf(voidType)
const booleanGenType = genTypeOf(booleanType)

abstract class LoadonlySymbol {
    abstract load(g: Generate): void

    store(g: Generate): void {
        unsupported()
    }

    storeTo(symbol: Symbol, g: Generate) {
        this.load(g)
        symbol.store(g)
    }

    addr(g: Generate): void {
        unsupported()
    }

    call(args: Symbol[]): Symbol {
        unsupported()
    }

    select(index: number | string): Symbol {
        unsupported()
    }

    index(index: Symbol): Symbol {
        unsupported()
    }

    number(): number | undefined {
        return undefined
    }

    simplify(): Symbol {
        return this as any as Symbol
    }
}

class EmptySymbol extends LoadonlySymbol implements Symbol {
    type = voidGenType

    load(g: Generate): void { }

    simplify(): Symbol {
        return this
    }
}

const emptySymbol = new EmptySymbol()

class NumberConstSymbol extends LoadonlySymbol implements Symbol {
    type = i32GenType
    value: number

    constructor(value: number) {
        super()
        this.value = value
    }

    load(g: Generate): void {
        g.inst(Inst.i32_const)
        g.index(this.value)
    }

    simplify(): Symbol {
        return this
    }

    number(): number {
        return this.value
    }
}

class DoubleConstSymbol extends LoadonlySymbol implements Symbol {
    type = f64GenType
    value: number

    constructor(value: number) {
        super()
        this.value = value
    }

    load(g: Generate): void {
        g.inst(Inst.f64_const)
        g.float64(this.value)
    }
}

function simplified(symbols: Symbol[]): Symbol[] {
    const simple = symbols.map(s => s.simplify())
    for (let i = 0, len = simple.length; i < len; i++) {
        if (simple[i] !== symbols[i]) return simple
    }
    return symbols
}

class StructLiteralSymbol extends LoadonlySymbol implements Symbol {
    type: GenType
    fields: Symbol[]

    constructor(type: GenType, fields: Symbol[]) {
        super()
        this.type = type
        this.fields = fields
    }

    load(g: Generate) {
        const fields = this.fields
        for (const field of fields) {
            field.load(g)
        }
    }

    storeTo(symbol: Symbol, g: Generate) {
        const fields = this.fields
        const len = fields.length
        for (let i = 0; i < len; i++) {
            fields[i].storeTo(symbol.select(i), g)
        }
    }

    simplify(): Symbol {
        const simpleFields = simplified(this.fields)
        if (simpleFields === this.fields)
            return this
        return new StructLiteralSymbol(this.type, simpleFields)
    }
}

class ArrayLiteralSymbol extends LoadonlySymbol implements Symbol {
    type: GenType
    elements: Symbol[]

    constructor(type: GenType, elements: Symbol[]) {
        super()
        this.type = type
        this.elements = elements
    }

    load(g: Generate) {
        const elements = this.elements
        for (const element of elements) {
            element.load(g)
        }
    }

    storeTo(symbol: Symbol, g: Generate) {
        const elements = this.elements
        const len = elements.length
        for (let i = 0; i < len; i++) {
            elements[i].storeTo(symbol.index(new NumberConstSymbol(i)), g)
        }
    }

    simplify(): Symbol {
        const elements = this.elements
        const simple = simplified(elements)
        if (elements === simple)
            return this
        return new ArrayLiteralSymbol(this.type, simple)
    }
}

class AssignSymbol extends LoadonlySymbol implements Symbol {
    type = voidGenType
    target: Symbol
    value: Symbol

    constructor(target: Symbol, value: Symbol) {
        super()
        this.target = target
        this.value = value
    }

    load(g: Generate) {
        this.value.storeTo(this.value, g)
    }

    simplify(): Symbol {
        const target = this.target
        const value = this.value
        const simpleTarget = target.simplify()
        const simpleValue = value.simplify()
        if (target === simpleTarget && value === simpleValue) {
            return new AssignSymbol(simpleTarget, simpleValue)
        }
        return this
    }
}

class OpSymbol extends LoadonlySymbol implements Symbol {
    type: GenType
    left: Symbol
    right: Symbol
    op: NodeKind

    constructor(type: GenType, left: Symbol, right: Symbol, op: NodeKind) {
        super()
        this.type = type
        this.left = left
        this.right = right
        this.op = op
    }

    load(g: Generate) {
        this.left.load(g)
        this.right.load(g)
        this.type.op(this.op, g)
    }

    simplify(): Symbol {
        const left = this.left
        const leftSimple = left.simplify()
        const right = this.right
        const rightSimple = right.simplify()
        const leftNumber = left.number()
        const rightNumber = right.number()
        if (leftNumber !== undefined && rightNumber !== undefined) {
            let result: number = 0
            switch (this.op) {
                case NodeKind.Add:
                    result = leftNumber + rightNumber
                    break
                case NodeKind.Subtract:
                    result = leftNumber - rightNumber
                    break
                case NodeKind.Multiply:
                    result = leftNumber * rightNumber
                    break
                case NodeKind.Divide:
                    if (rightNumber === 0) error("Divide by zero")
                    result = leftNumber / rightNumber
                    break
                default:
                    return this
            }
            switch (this.type.type.kind) {
                case TypeKind.I8:
                    result = result | 0x7F
                    break
                case TypeKind.I16:
                    result = result | 0x7FFF
                    break
                case TypeKind.I32:
                    result = result | 0x7FFFFFFF
                    break
                case TypeKind.U8:
                    result = result | 0xFF
                    break
                case TypeKind.U16:
                    result = result | 0xFFFF
                    break
                case TypeKind.U32:
                    result = result | 0xFFFFFFFF
                    break
            }
            return new NumberConstSymbol(result)
        }
        if (left === leftSimple && right === rightSimple) {
            return this
        }
        return new OpSymbol(this.type, leftSimple, rightSimple, this.op)
    }
}

class InstSymbol extends LoadonlySymbol implements Symbol {
    type: GenType
    inst: Inst
    args: Symbol[]

    constructor(type: GenType, inst: Inst, args: Symbol[]) {
        super()
        this.type = type
        this.inst = inst
        this.args = args
    }

    load(g: Generate) {
        for (const arg of this.args) {
            arg.load(g)
        }
        g.inst(this.inst)
    }
}

class BuiltinsSymbol extends LoadonlySymbol implements Symbol {
    type: GenType
    inst: Inst
    target: Symbol

    constructor(type: GenType, inst: Inst, target: Symbol) {
        super()
        this.type = type
        this.inst = inst
        this.target = target
    }

    load(g: Generate) {
        unsupported()
    }

    call(args: Symbol[]) {
        return new InstSymbol(this.type, this.inst, [this.target, ...args])
    }
}

function builtinSymbolFor(type: Type, result: GenType, name: string, target: Symbol): Symbol {
    let inst = Inst.Nop
    switch (name) {
        case "countLeadingZeros":
            switch (type.kind) {
                case TypeKind.I8:
                case TypeKind.I16:
                case TypeKind.I32:
                case TypeKind.U8:
                case TypeKind.U16:
                case TypeKind.U32:
                    inst = Inst.i32_clz
                    break
                case TypeKind.I64:
                case TypeKind.U64:
                    inst = Inst.i64_clz
                    break
            }
            break
        case "countTrailingZeros":
            switch (type.kind) {
                case TypeKind.I8:
                case TypeKind.I16:
                case TypeKind.I32:
                case TypeKind.U8:
                case TypeKind.U16:
                case TypeKind.U32:
                    inst = Inst.i32_ctz
                    break
                case TypeKind.I64:
                case TypeKind.U64:
                    inst = Inst.i64_ctz
                    break
            }
            break
        case "countNonZeros":
            switch (type.kind) {
                case TypeKind.I8:
                case TypeKind.I16:
                case TypeKind.I32:
                case TypeKind.U8:
                case TypeKind.U16:
                case TypeKind.U32:
                    inst = Inst.i32_popcnt
                    break
                case TypeKind.I64:
                case TypeKind.U64:
                    inst = Inst.i64_popcnt
                    break
            }
            break
        case "abs":
            switch (type.kind) {
                case TypeKind.F32:
                    inst = Inst.f32_abs
                    break
                case TypeKind.F64:
                    inst = Inst.f64_abs
                    break
            }
            break
        case "sqrt":
            switch (type.kind) {
                case TypeKind.F32:
                    inst = Inst.f32_sqrt
                    break
                case TypeKind.F64:
                    inst = Inst.f64_sqrt
                    break
            }
            break
        case "floor":
            switch (type.kind) {
                case TypeKind.F32:
                    inst = Inst.f32_floor
                    break
                case TypeKind.F64:
                    inst = Inst.f64_floor
                    break
            }
            break
        case "ceil":
            switch (type.kind) {
                case TypeKind.F32:
                    inst = Inst.f32_ceil
                    break
                case TypeKind.F64:
                    inst = Inst.f64_ceil
                    break
            }
            break
        case "trunc":
            switch (type.kind) {
                case TypeKind.F32:
                    inst = Inst.f32_trunc
                    break
                case TypeKind.F64:
                    inst = Inst.f64_trunc
                    break
            }
            break
        case "nearest":
            switch (type.kind) {
                case TypeKind.F32:
                    inst = Inst.f32_nearest
                    break
                case TypeKind.F64:
                    inst = Inst.f64_nearest
                    break
            }
            break
        case "min":
            switch (type.kind) {
                case TypeKind.F32:
                    inst = Inst.f32_min
                    break
                case TypeKind.F64:
                    inst = Inst.f64_min
                    break
            }
            break
        case "max":
            switch (type.kind) {
                case TypeKind.F32:
                    inst = Inst.f32_max
                    break
                case TypeKind.F64:
                    inst = Inst.f64_max
                    break
            }
            break
        case "copysign":
            switch (type.kind) {
                case TypeKind.F32:
                    inst = Inst.f32_copysign
                    break
                case TypeKind.F64:
                    inst = Inst.f64_copysign
                    break
            }
            break
    }
    if (inst == Inst.Nop) unsupported()
    return new BuiltinsSymbol(result, inst, target)
}

const trueSymbol = new NumberConstSymbol(1)
const falseSymbol = new NumberConstSymbol(0)

class CompareSymbol extends LoadonlySymbol implements Symbol {
    type = booleanGenType
    left: Symbol
    right: Symbol
    op: CompareOp

    constructor(left: Symbol, right: Symbol, op: CompareOp) {
        super()
        this.left = left.simplify()
        this.right = right.simplify()
        this.op = op
    }

    load(g: Generate): void {
        this.left.load(g)
        this.right.load(g)
        this.left.type.compare(this.op, g)
    }

    simplify(): Symbol {
        const left = this.left
        const right = this.right
        const leftSimple = left.simplify()
        const rightSimple = right.simplify()
        const leftNumber = leftSimple.number()
        const rightNumber = rightSimple.number()
        if (leftNumber !== undefined && rightNumber !== undefined) {
            switch (this.op) {
                case CompareOp.Equal:
                    return leftNumber === rightNumber ? trueSymbol : falseSymbol
                case CompareOp.GreaterThan:
                    return leftNumber > rightNumber ? trueSymbol : falseSymbol
                case CompareOp.GreaterThanEqual:
                    return leftNumber >= rightNumber ? trueSymbol : falseSymbol
                case CompareOp.LessThan:
                    return leftNumber < rightNumber ? trueSymbol : falseSymbol
                case CompareOp.LessThanEqual:
                    return leftNumber <= rightNumber ? trueSymbol : falseSymbol
                case CompareOp.NotEqual:
                    return leftNumber !== rightNumber ? trueSymbol : falseSymbol
            }
        }
        if (left === leftSimple && right === rightSimple)
            return this
        return new CompareSymbol(leftSimple, rightSimple, this.op)
    }
}

class GotoSymbol extends LoadonlySymbol implements Symbol {
    type = voidGenType
    label: Label

    constructor(label: Label) {
        super()
        this.label = label
    }

    load(g: Generate) {
        g.br(this.label)
    }
}

class ReturnSymbol extends LoadonlySymbol implements Symbol {
    type = voidGenType
    expr: Symbol | undefined

    constructor(expr?: Symbol) {
        super()
        this.expr = expr
    }

    load(g: Generate) {
        const expr = this.expr
        if (expr) {
            expr.load(g)
        }
        g.return()
    }
}

class CallSymbol extends LoadonlySymbol implements Symbol {
    type: GenType
    funcIndex: FuncIndex
    args: Symbol[]

    constructor(type: GenType, index: FuncIndex, args: Symbol[]) {
        super()
        this.type = type
        this.funcIndex = index
        this.args = args.map(it => it.simplify())
    }

    load(g: Generate) {
        const args = this.args
        for (const arg of args) {
            arg.load(g)
        }
        g.inst(Inst.Call)
        g.index(this.funcIndex)
    }

    simplify(): Symbol {
        const args = this.args
        const simpleArgs = simplified(args)
        if (args === simpleArgs)
            return this
        return new CallSymbol(this.type, this.funcIndex, simpleArgs)
    }
}

class IfThenSymbol extends LoadonlySymbol implements Symbol {
    type: GenType
    condition: Symbol
    then: Symbol
    else: Symbol | undefined

    constructor(type: GenType, condition: Symbol, body: Symbol, e?: Symbol) {
        super()
        this.type = type
        this.condition = condition.simplify()
        this.then = body.simplify()
        this.else = e?.simplify()
    }

    load(g: Generate) {
        this.condition.load(g)
        const type = this.type
        const blockType = type.parts.piece ?? 0x40
        const {thenBlock, elseBlock} = g.if(blockType)
        const body = this.then
        const e = this.else
        body.load(thenBlock.body)
        if (e) {
            e.load(elseBlock.body)
        }
    }

    simplify(): Symbol {
        const condition = this.condition
        const then = this.then
        const e = this.else
        const conditionSimple = condition.simplify()
        const thenSimple = then.simplify()
        const elseSimple = e?.simplify()

        const conditionNumber = condition.number()
        if (conditionNumber === 1) return thenSimple
        if (elseSimple && conditionNumber === 0) return elseSimple
        if (condition === conditionSimple && then === thenSimple && e === elseSimple)
            return this
        return new IfThenSymbol(this.type, conditionSimple, thenSimple, elseSimple)
    }
}

class LoopSymbol extends LoadonlySymbol implements Symbol {
    type: GenType;
    symbols: Symbol[]
    breakLabel: Label
    continueLabel: Label

    constructor(type: GenType, symbols: Symbol[], breakLabel: Label, continueLable: Label) {
        super()
        this.type = type
        this.symbols = symbols
        this.breakLabel = breakLabel
        this.continueLabel = continueLable
    }

    load(g: Generate): void {
        const {body: outer} = g.block(0x40, this.breakLabel)
        const {body} = outer.loop(0x40, this.continueLabel)
        for (const symbol of this.symbols) {
            symbol.load(body)
        }
    }

    simplify(): Symbol {
        const symbols = this.symbols
        const simple = simplified(symbols)
        if (simple === symbols)
            return this
        return new LoopSymbol(this.type, simple, this.breakLabel, this.continueLabel)
    }
}

class BlockSymbol extends LoadonlySymbol implements Symbol {
    type: GenType
    symbols: Symbol[]
    label: Label

    constructor(type: GenType, symbols: Symbol[], label: Label) {
        super()
        this.type = type
        this.symbols = symbols
        this.label = label
    }

    load(g: Generate): void {
        const type = this.type
        const blockType = type.parts.piece ?? 0x40
        const {body} = g.loop(blockType)
        for (const symbol of this.symbols) {
            symbol.load(body)
        }
    }

    simplify(): Symbol {
        const symbols = this.symbols
        const simple = simplified(symbols)
        if (simple.length == 1) return simple[0]
        if (symbols === simple)
            return this
        return new BlockSymbol(this.type, symbols, this.label)
    }
}

class FunctionSymbol extends LoadonlySymbol implements Symbol {
    type: GenType
    funcIndex: FuncIndex

    constructor(type: GenType, funcIndex: FuncIndex) {
        super()
        this.type = type
        this.funcIndex = funcIndex
    }

    load(g: Generate): void {
        unsupported()
    }

    simplify(): Symbol {
        return this
    }

    call(args: Symbol[]): Symbol {
        return new CallSymbol(this.type, this.funcIndex, args)
    }
}

class ScaledOffsetSymbol extends LoadonlySymbol implements Symbol {
    type = i32GenType
    base: Symbol
    i: Symbol
    scale: Symbol

    constructor(base: Symbol, index: Symbol, scale: Symbol) {
        super()
        this.base = base
        this.i = index
        this.scale = scale
    }

    load(g: Generate): void {
        this.base.load(g)
        this.i.load(g)
        this.scale.load(g)
        g.inst(Inst.i32_mul)
        g.inst(Inst.i32_add)
    }

    simplify(): Symbol {
        const base = this.base.simplify()
        const i = this.i.simplify()
        const scale = this.scale.simplify()

        const baseNumber = this.base.number()
        const iNumber = this.i.number()
        const scaleNumber = this.scale.number()
        if (baseNumber !== undefined && iNumber !== undefined && scaleNumber != undefined) {
            return new NumberConstSymbol(baseNumber + scaleNumber * iNumber)
        }
        if (iNumber !== undefined && scaleNumber != undefined) {
            return new OpSymbol(i32GenType, this.base, new NumberConstSymbol(scaleNumber * iNumber), NodeKind.Add)
        }
        if (this.base === base && this.i === i && this.scale === scale)
            return this
        return new ScaledOffsetSymbol(base, i, scale)
    }
}

const zeroSymbol = new NumberConstSymbol(0)

class DataSymbol implements Symbol {
    type: GenType
    address: Symbol

    constructor(type: GenType, address: Symbol) {
        this.type = type
        this.address = address
    }

    load(g: Generate): void {
        const address = this.address.number()
        if (address !== undefined)
            this.type.loadData(g, zeroSymbol, address)
        else
            this.type.loadData(g, this.address, 0)
    }

    store(g: Generate): void {
        const address = this.address.number()
        if (address !== undefined)
            this.type.storeData(g, zeroSymbol, address)
        else
            this.type.storeData(g, this.address, 0)
    }

    storeTo(symbol: Symbol, g:Generate) {
        this.load(g)
        symbol.store(g)
    }

    addr(g: Generate): void {
        this.address.load(g)
    }

    call(args: Symbol[]): Symbol {
        unsupported()
    }

    select(index: number): Symbol {
        const {type, offset} = this.type.select(index)
        const offsetAddress = new OpSymbol(i32GenType, this.address, new NumberConstSymbol(offset), NodeKind.And)
        return new DataSymbol(type, offsetAddress)
    }

    index(index: Symbol): Symbol {
        const element = this.type.index()
        const size = element.size
        const sizeSymbol = new NumberConstSymbol(size)
        const offsetAddress = new ScaledOffsetSymbol(this.address, sizeSymbol, index)
        return new DataSymbol(element, offsetAddress)
    }

    simplify(): Symbol {
        return this
    }

    number(): undefined {
        return undefined
    }
}

function genTypeOf(type: Type, cache?: Map<Type, GenType>): GenType {
    const cached = cache?.get(type)
    if (cached) return cached
    switch (type.kind) {
        case TypeKind.I8:
        case TypeKind.U8:
            return new GenType(type, { piece: NumberType.i32 }, 1)
        case TypeKind.I16:
        case TypeKind.U16:
            return new GenType(type, { piece: NumberType.i32 }, 2)
        case TypeKind.I32:
        case TypeKind.U32:
            return new GenType(type, { piece: NumberType.i32 })
        case TypeKind.I64:
        case TypeKind.U64:
            return new GenType(type, { piece: NumberType.i64 })
        case TypeKind.Boolean:
            return new GenType(type, { piece: NumberType.i32 }, 1)
        case TypeKind.F32:
            return new GenType(type, { piece: NumberType.f32 })
        case TypeKind.F64:
            return new GenType(type, { piece: NumberType.f64 })
        case TypeKind.Unknown:
            unsupported()
        case TypeKind.Void:
            return new GenType(type, { void: true })
        case TypeKind.Array:
            return new GenType(type, {
                element: genTypeOf(type.elements),
                size: type.size
            })
        case TypeKind.Struct:
            const fields = type.fields.map((name, t) => genTypeOf(t, cached))
            return new GenType(type, { fields })
        case TypeKind.Location:
            return genTypeOf(type.type, cache)
        case TypeKind.Function:
            return genTypeOf(type.result, cache)
    }
    unsupported()
}

function none(): never {
    throw new Error("Internal code gen error")
}

function unsupported(): never {
    throw new Error("Not supported yet")
}

function error(message: string): never {
    throw new Error(message)
}

function required<T>(value: T | undefined): T {
    if (value !== undefined) return value
    error("Value is required")
}

function check(value: boolean, message?: string) {
    if (!value) error(message || "Failed check")
}

interface SymbolAllocator {
    allocate(type: GenType, init?: Symbol): Symbol
    release(symbol: Symbol): void
}

class DataAllocator implements SymbolAllocator {
    data: DataSection

    constructor(data: DataSection) {
        this.data = data
    }

    allocate(type: GenType, init?: Symbol): Symbol {
        const size = type.size
        const buffer = new Uint8Array(size)
        const bytes = new ByteWriter(buffer, size)
        const data = this.data
        if (init) {
            const simpleInit = init.simplify()
            const g = gen()
            simpleInit.load(g)
            const expr = new ByteWriter()
            g.write(expr)
            const address = data.allocateActive(bytes, expr)
            return new DataSymbol(type, new NumberConstSymbol(address))
        } else {
            const address = data.allocatePassive(bytes)
            return new DataSymbol(type, new NumberConstSymbol(address))
        }
    }

    release(symbol: Symbol) { }
}

class LocalAllocator implements SymbolAllocator {
    g: Generate

    constructor(g: Generate) {
        this.g = g
    }

    allocate(type: GenType, init?: Symbol): Symbol {
        const g = this.g
        function localTypesToIndexes(parts: LocalTypes): LocalIndexes {
            if (typeof parts == "number") {
                return g.local(parts)
            } else {
                return parts.map(localTypesToIndexes)
            }
        }
        return new LocalSymbol(type, localTypesToIndexes(type.locals()))
    }

    release(symbol: Symbol) {
        const g = this.g
        function releaseIndexes(indexes: LocalIndexes) {
            if (typeof indexes == "number") {
                g.release(indexes)
            } else {
                indexes.forEach(releaseIndexes)
            }
        }
        if (symbol instanceof LocalSymbol) {
            releaseIndexes(symbol.locals)
        }
    }
}

interface Scopes {
    continues: Scope<Label>
    breaks: Scope<Label>
    symbols: Scope<Symbol>
    alloc: SymbolAllocator
    letTarget?: string
}

export function codegen(program: Tree[], types: Map<Tree, Type>, module: Module) {
    const genTypes = new Map<Type, GenType>()
    const typeSection = new TypeSection()
    const importSection = new ImportSection()
    const globalSection = new GlobalSection(importSection.globalsCount)
    const funcSection = new FunctionSection(importSection.funcsCount)
    const codeSection = new CodeSection()
    const dataSection = new DataSection()
    const dataAllocator = new DataAllocator(dataSection)
    const exportSection = new ExportSection()
    const dataCountSection = new DataCountSection(dataSection)
    function typeOfType(type: Type | undefined): GenType {
        return genTypeOf(required(type), genTypes)
    }

    function typeOf(tree: Tree): GenType {
        return typeOfType(types.get(tree))
    }

    const rootScope = new Scope<Symbol>()
    const rootScopes: Scopes = {
        continues: new Scope<Label>(),
        breaks: new Scope<Label>(),
        symbols: rootScope,
        alloc: dataAllocator
    }

    // rootScope.enter('sqrt', new FunctionSymbol(doubleGenType, sqrtIndex))
    // rootScope.enter('print', new FunctionSymbol(voidGenType, printIndex))

    statementsToSymbol(program, rootScopes)

    function addSection(section: Section) {
        if (!section.empty()) module.addSection(section)
    }

    addSection(typeSection)
    addSection(importSection)
    addSection(funcSection)
    addSection(exportSection)
    addSection(dataCountSection)
    addSection(codeSection)
    addSection(dataSection)

    function statementsToSymbol(trees: Tree[], scopes: Scopes, l: Label = label()): BlockSymbol {
        const statements: Symbol[] = []
        const blockScope = new Scope<Symbol>(scopes.symbols)
        for (const tree of trees) {
            statements.push(treeToSymbol(tree, {...scopes, symbols: blockScope }))
        }
        const type = statements.length > 0 ? statements[statements.length - 1].type : voidGenType
        return new BlockSymbol(type, statements, l)
    }

    function treeToSymbol(tree: Tree, scopes: Scopes): Symbol {
        switch (tree.kind) {
            case NodeKind.Add:
            case NodeKind.Subtract:
            case NodeKind.Multiply:
            case NodeKind.Divide: {
                const left = treeToSymbol(tree.left, scopes)
                const right = treeToSymbol(tree.right, scopes)
                const type = typeOf(tree)
                return new OpSymbol(type, left, right, tree.kind)
            }
            case NodeKind.Compare: {
                const left = treeToSymbol(tree.left, scopes)
                const right = treeToSymbol(tree.right, scopes)
                return new CompareSymbol(left, right, tree.op)
            }
            case NodeKind.BlockExpression:
                return statementsToSymbol(tree.block, scopes)
            case NodeKind.Break: {
                const l = required(scopes.breaks.find(tree.name ?? "$top"))
                return new GotoSymbol(l)
            }
            case NodeKind.Continue: {
                const l = required(scopes.continues.find(tree.name ?? "$top"))
                return new GotoSymbol(l)
            }
            case NodeKind.Return: {
                const value = tree.value
                const expr = value ? treeToSymbol(value, scopes) : undefined
                return new ReturnSymbol(expr)
            }
            case NodeKind.Literal:
                switch (tree.literalKind) {
                    case LiteralKind.Int:
                        return new NumberConstSymbol(tree.value)
                    case LiteralKind.Double:
                        return new DoubleConstSymbol(tree.value)
                }
                break
            case NodeKind.StructLit:
                return structLitToSymbol(tree, scopes)
            case NodeKind.Field:
                return treeToSymbol(tree.value, scopes)
            case NodeKind.ArrayLit:
                return arrayLitToSymbol(tree, scopes)
            case NodeKind.Reference:
                return required(scopes.symbols.find(tree.name))
            case NodeKind.Select:
                return selectToSymbol(tree, scopes)
            case NodeKind.Index:
                return indexToSymbol(tree, scopes)
            case NodeKind.Spread:
                unsupported()
            case NodeKind.FieldRef:
                unsupported()
            case NodeKind.Assign:
                return assignToSymbol(tree, scopes)
            case NodeKind.Function:
                return functionToSymbol(tree, scopes)
            case NodeKind.Call:
                return callToSymbol(tree, scopes)
            case NodeKind.Var:
                return varToSymbol(tree, scopes)
            case NodeKind.Let:
                return letToSymbol(tree, scopes)
            case NodeKind.IfThenElse:
                return ifThenElseSymbol(tree, scopes)
            case NodeKind.Loop:
                return loopToSymbol(tree, scopes)
            case NodeKind.Type:
            case NodeKind.StructTypeLit:
            case NodeKind.StructField:
            case NodeKind.ArrayCtor:
                return emptySymbol
        }

        unsupported()
    }

    function structLitToSymbol(tree: StructLit, scopes: Scopes): Symbol {
        const type = typeOf(tree)
        const fields = tree.body.map(f => treeToSymbol(f, scopes))
        return new StructLiteralSymbol(type, fields)
    }

    function arrayLitToSymbol(tree: ArrayLit, scopes: Scopes): Symbol {
        const type = typeOf(tree)
        const elements = tree.values.map(e => treeToSymbol(e, scopes))
        return new ArrayLiteralSymbol(type, elements)
    }

    function selectToSymbol(tree: Select, scopes: Scopes): Symbol {
        const target = treeToSymbol(tree.target, scopes)
        const targetType = read(required(types.get(tree.target)))
        if (targetType.kind == TypeKind.Struct)
            return target.select(tree.name)
        else {
            const type = typeOf(tree)
            return builtinSymbolFor(targetType, type, tree.name, target)
        }
    }

    function indexToSymbol(tree: Index, scopes: Scopes): Symbol {
        const target = treeToSymbol(tree.target, scopes)
        const index = treeToSymbol(tree.index, scopes)
        return target.index(index)
    }

    function assignToSymbol(tree: Assign, scopes: Scopes): Symbol {
        const target = treeToSymbol(tree.target, scopes)
        const value = treeToSymbol(tree.value, scopes)
        return new AssignSymbol(target, value)
    }

    function functionToSymbol(tree: Function, scopes: Scopes): Symbol {
        const g = gen()

        // Create the function scopes
        const alloc = scopes.letTarget === "_main" ? scopes.alloc : new LocalAllocator(g)
        const symbols = new Scope<Symbol>(scopes.symbols)
        const continues = new Scope<Label>()
        const breaks = new Scope<Label>()
        const functionScopes: Scopes = { alloc, symbols, continues, breaks }

        // Add parameters
        for (const parameter of tree.parameters) {
            const type = typeOf(parameter)
            symbols.enter(parameter.name, alloc.allocate(type))
        }

        // Create the function type
        const parameters: ValueType[] = []
        for (const parameter of tree.parameters) {
            const type = typeOf(parameter)
            parameters.push(...flattenTypes(type.locals()))
        }
        const resultType = typeOf(tree)
        const result = flattenTypes(resultType.locals())
        const typeIndex = typeSection.funtionType({
            parameters,
            result
        })

        // Create the function index
        const funcIndex = funcSection.allocate(typeIndex)
        const funcSymbol = new FunctionSymbol(resultType, funcIndex)

        // Allow the function to call itself if it is named
        const functionName = scopes.letTarget
        if (functionName)
            symbols.enter(functionName, funcSymbol)

        // Generate the body
        const body = statementsToSymbol(tree.body, functionScopes).simplify()
        body.load(g)
        g.inst(Inst.End)
        g.done()
        const bytes = new ByteWriter()
        g.write(bytes)
        codeSection.allocate(g.currentLocals(), bytes)
        if (tree.exported) {
            exportSection.allocate(tree.name, ExportKind.Func, funcIndex)
        }

        return funcSymbol
    }

    function callToSymbol(tree: Call, scopes: Scopes): Symbol {
        const target = treeToSymbol(tree.target, scopes)
        const args = tree.arguments.map(a => treeToSymbol(a, scopes))
        return target.call(args)
    }

    function varToSymbol(tree: Var, scopes: Scopes): Symbol {
        const alloc = scopes.alloc
        const symbols = scopes.symbols
        const value = treeToSymbol(tree.value, scopes)
        const type = typeOf(tree)
        const varSymbol = alloc.allocate(type, value)
        symbols.enter(tree.name, varSymbol)
        return emptySymbol
    }

    function letToSymbol(tree: Let, scopes: Scopes): Symbol {
        const symbol = treeToSymbol(tree.value, { ...scopes, letTarget: tree.name })
        scopes.symbols.enter(tree.name, symbol)
        return emptySymbol
    }

    function ifThenElseSymbol(tree: IfThenElse, scopes: Scopes): Symbol {
        const condition = treeToSymbol(tree.condition, scopes)
        const then = treeToSymbol(tree.then, scopes)
        const elsePart = tree.else && treeToSymbol(tree.else, scopes)

        return new IfThenSymbol(then.type, condition, then, elsePart)
    }

    function loopToSymbol(tree: Loop, scopes: Scopes): Symbol {
        const breakLabel = label()
        const continueLabel = label()
        const name = tree.name
        const symbols = scopes.symbols
        const alloc = scopes.alloc
        const breaks = new Scope<Label>(scopes.breaks)
        const continues = new Scope<Label>(scopes.continues)
        breaks.enter("$top", breakLabel)
        continues.enter("$top", continueLabel)
        if (name) {
            breaks.enter(name, breakLabel)
            continues.enter(name, continueLabel)
        }
        const body = statementsToSymbol(tree.body, { symbols, alloc, breaks, continues })
        return new LoopSymbol(voidGenType, body.symbols, breakLabel, continueLabel)
    }

    function read(type: Type): Type {
        if (type.kind == TypeKind.Location) return type.type
        return type
    }
}