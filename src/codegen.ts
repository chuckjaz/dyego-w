import { ArrayLit, Assign, Call, CompareOp, Index, Function, Let, LiteralKind, Locatable, Loop, NodeKind, Scope, Select, StructLit, Tree, Var, IfThenElse, nameOfNodeKind } from "./ast";
import { booleanType, f64Type, i32Type, Type, TypeKind, typeToString, voidType } from "./types";
import { ByteWriter } from "./wasm/bytewriter";
import { Generate, gen, Label, label } from "./wasm/codeblock";
import { CodeSection } from "./wasm/codesection";
import { DataCountSection } from "./wasm/datacountsection";
import { DataSection } from "./wasm/datasection";
import { ExportKind, ExportSection } from "./wasm/exportsection";
import { FunctionSection } from "./wasm/functionSection";
import { GlobalSection } from "./wasm/globalsection";
import { ImportSection } from "./wasm/importSection";
import { MemorySection } from "./wasm/memorySection";
import { Module } from "./wasm/module";
import { Section } from "./wasm/section";
import { StartSection } from "./wasm/startsection";
import { TypeSection } from "./wasm/typesection";
import { FuncIndex, Inst, LocalIndex, NumberType, ReferenceType, ValueType } from "./wasm/wasm";

interface Symbol {
    type: GenType
    location?: Locatable
    load(g: Generate): void
    pop(g: Generate): void
    store(value: Symbol, g: Generate): void
    storeTo(symbol: Symbol, g: Generate): void
    addr(g: Generate): void
    call(args: Symbol[]): Symbol
    select(index: number | string): Symbol
    index(index: Symbol): Symbol
    simplify(): Symbol
    number(): number | undefined
    tryNot(): Symbol | undefined
    initMemory(bytes: ByteWriter): boolean
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

    loadData(location: Locatable, g: Generate, addr: Symbol, offset: number) {
        const piece = this.parts.piece
        if (piece !== undefined) {
            switch (piece) {
                case NumberType.f32:
                    addr.load(g)
                    g.inst(Inst.f32_load)
                    g.index(0)
                    g.index(offset)
                    return
                case NumberType.f64:
                    addr.load(g)
                    g.inst(Inst.f64_load)
                    g.index(0)
                    g.index(offset)
                    return
                case NumberType.i32:
                    addr.load(g)
                    g.inst(Inst.i32_load)
                    g.index(0)
                    g.index(offset)
                    return
                case NumberType.i64:
                    addr.load(g)
                    g.inst(Inst.i64_load)
                    g.index(0)
                    g.index(offset)
                    return
                default:
                    unsupported(location)
            }
        }

        const fields = this.parts.fields
        if (fields) {
            let current = offset
            for (const field of fields) {
                field.loadData(location, g, addr, current)
                current += field.size
            }
            return
        }
        unsupported(location, `load: ${typeToString(this.type)}`)
    }

    storeData(location: Locatable, g: Generate, addr: Symbol, value: Symbol, offset: number) {
        const piece = this.parts.piece
        if (piece !== undefined) {
            switch (piece) {
                case NumberType.f32:
                    addr.load(g)
                    value.load(g)
                    g.inst(Inst.f32_store)
                    g.index(0)
                    g.index(offset)
                    return
                case NumberType.f64:
                    addr.load(g)
                    value.load(g)
                    g.inst(Inst.f64_store)
                    g.index(0)
                    g.index(offset)
                    return
                case NumberType.i32:
                    addr.load(g)
                    value.load(g)
                    g.inst(Inst.i32_store)
                    g.index(0)
                    g.index(offset)
                    return
                case NumberType.i64:
                    addr.load(g)
                    value.load(g)
                    g.inst(Inst.i64_store)
                    g.index(0)
                    g.index(offset)
                    return
                default:
                    unsupported(location, `store: ${typeToString(this.type)}`)
                }
        }
        const fields = this.parts.fields
        if (fields) {
            let current = 0
            for (let i = 0; i < fields.length; i++) {
                const field = fields[i]
                field.storeData(location, g, addr, value.select(i), current)
                current += field.size
            }
            return
        }
        unsupported(location, `store: ${typeToString(this.type)}`)
    }

    popToData(location: Locatable, g: Generate, addr: Symbol, offset: number) {
        const piece = this.parts.piece
        const thisType = this.type
        const size = this.size
        let i32Local: LocalIndex | undefined
        let f32Local: LocalIndex | undefined
        let i64Local: LocalIndex | undefined
        let f64Local: LocalIndex | undefined

        function tmpLocal(type: NumberType): LocalIndex {
            switch (type) {
                case NumberType.f32:
                    if (f32Local === undefined) {
                        f32Local = g.local(type)
                    }
                    return f32Local
                case NumberType.f64:
                    if (f64Local === undefined) {
                        f64Local = g.local(type)
                    }
                    return f64Local
                case NumberType.i32:
                    if (i32Local === undefined) {
                        i32Local = g.local(type)
                    }
                    return i32Local
                case NumberType.i64:
                    if (i64Local === undefined) {
                        i64Local = g.local(type)
                    }
                default:
                    unsupported(location, `pop: ${typeToString(thisType)}`)
                }
        }

        function returnTmpLocals() {
            if (i32Local !== undefined) g.release(i32Local)
            if (i64Local !== undefined) g.release(i64Local)
            if (f32Local !== undefined) g.release(f32Local)
            if (f64Local !== undefined) g.release(f64Local)
        }

        function store(piece: LocalIndex, inst: Inst) {
            const local = tmpLocal(piece)
            g.inst(Inst.Local_set)
            g.index(local)
            addr.load(g)
            g.inst(Inst.Local_get)
            g.index(local)
            g.inst(inst)
            g.index(0)
            g.index(offset)
        }

        function doStore(parts: GenTypeParts) {
            if (piece !== undefined) {
                switch (piece) {
                    case NumberType.f32:
                        store(piece, Inst.f32_store)
                        return
                    case NumberType.f64:
                        store(piece, Inst.f64_store)
                        return
                    case NumberType.i32:
                        store(piece, Inst.i32_store)
                        return
                    case NumberType.i64:
                        store(piece, Inst.i64_store)
                        return
                    default:
                        unsupported(location, `pop: ${typeToString(thisType)}`)
                    }
            }
            const fields = parts.fields
            if (fields) {
                let current = offset + size
                for (let i = fields.length - 1 ; i >= 0; i--) {
                    const field = fields[i]
                    current -= field.size
                    field.popToData(location, g, addr, current)
                }
                return
            }
            unsupported(location, `pop: ${typeToString(thisType)}`)
        }

        doStore(this.parts)
        returnTmpLocals()
    }

    popToLocals(g: Generate, localIndex: LocalIndexes) {
        if (typeof localIndex == "number") {
            g.inst(Inst.Local_get)
            g.index(localIndex)
        } else {
            const fields = required(this.parts.fields)
            for (let i = fields.length - 1; i >= 0; i--) {
                fields[i].popToLocals(g, localIndex[i])
            }
        }
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

    storeLocal(g: Generate, value: Symbol, localIndex: LocalIndexes) {
        if (typeof localIndex == "number") {
            value.load(g)
            g.inst(Inst.Local_set)
            g.index(localIndex)
        } else {
            const fields = required(this.parts.fields)
            check(fields.length == localIndex.length)
            for (let i = 0; i < fields.length; i++) {
                fields[i].storeLocal(g, value.select(i), localIndex[i])
            }
        }
    }

    locals(location: Locatable): LocalTypes {
        const parts = this.parts
        const piece = parts.piece
        if (piece !== undefined) {
            return piece
        }
        const fields = parts.fields
        if (fields !== undefined) {
            return fields.map(t => t.locals(location))
        }
        if (parts.void) return []
        unsupported(location, `locals: ${typeToString(this.type)}`)
    }

    select(location: Locatable, index: number | string): { type: GenType, offset: number, index: number } {
        if (typeof index === "string") {
            const type = this.type
            if (type.kind == TypeKind.Struct) {
                index = required(type.fields.order(index))
            } else unsupported(location, `select: ${typeToString(this.type)}`)

        }
        const fields = required(this.parts.fields)
        check(index <= fields.length)
        const type = fields[index]
        const offset = fields.slice(0, index).reduce((p, t) => p + t.size, 0)
        return { type, offset, index }
    }

    index(): GenType {
        return required(this.parts.element)
    }

    op(location: Locatable, kind: NodeKind, g: Generate) {
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
                        return
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
            case NodeKind.Not:
                switch (this.type.kind) {
                    case TypeKind.Boolean:
                        g.inst(Inst.i32_eqz)
                        return
                }
                break
            case NodeKind.Negate:
                switch (this.type.kind) {
                    case TypeKind.F32:
                        g.inst(Inst.f32_neg)
                        return
                    case TypeKind.F64:
                        g.inst(Inst.f64_neg)
                        return
                }
        }
        unsupported(location, `op ${nameOfNodeKind(kind)} for ${typeToString(this.type)}`)
    }

    compare(location: Locatable, op: CompareOp, g: Generate) {
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
                        g.inst(Inst.i32_ge_s)
                        return
                    case TypeKind.U8:
                    case TypeKind.U16:
                    case TypeKind.U32:
                        g.inst(Inst.i32_ge_u)
                        return
                    case TypeKind.I64:
                        g.inst(Inst.i64_ge_s)
                        return
                    case TypeKind.U64:
                        g.inst(Inst.i64_ge_u)
                        return
                    case TypeKind.F32:
                        g.inst(Inst.f64_ge)
                        return
                    case TypeKind.F64:
                        g.inst(Inst.f64_ge)
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
        unsupported(location)
    }

    writeValue(bytes: ByteWriter, value: number | bigint): boolean {
        switch (this.type.kind) {
            case TypeKind.I8:
            case TypeKind.U8:
                bytes.writeByte(Number(value))
                break
            case TypeKind.I16:
            case TypeKind.U16: {
                const v = Number(value)
                bytes.writeByte(v | 0xFF)
                bytes.writeByte((v >> 8) | 0xFF)
                break
            }
            case TypeKind.I32:
            case TypeKind.U32: {
                const v = Number(value)
                const b = new Uint8Array(4)
                const i = new Int32Array(b.buffer)
                i[0] = Number(value)
                bytes.writeByteArray(b)
                break
            }
            case TypeKind.I64: {
                const v = BigInt(value)
                const b = new Uint8Array(8)
                const i = new Int32Array(b.buffer)
                i[0] = Number(v | 0xFFFFFFFFn)
                i[1] = Number((v >> 32n) | 0xFFFFFFFFn)
                bytes.writeByteArray(b)
                break
            }
            case TypeKind.F32: {
                const b = new Uint8Array(4)
                const f = new Float32Array(b.buffer)
                f[0] = Number(value)
                bytes.writeByteArray(b)
                break
            }
            case TypeKind.F64: {
                const b = new Uint8Array(8)
                const f = new Float64Array(b.buffer)
                f[0] = Number(value)
                bytes.writeByteArray(b)
                break
            }
            default:
                return false
        }
        return true
    }
}

class LocalSymbol implements Symbol {
    type: GenType
    location: Locatable
    locals: LocalIndexes

    constructor(location: Locatable, type: GenType, locals: LocalIndexes) {
        this.location = location
        this.type = type
        this.locals = locals
    }

    load(g: Generate): void {
        this.type.loadLocal(g, this.locals)
    }

    pop(g: Generate) {
        this.type.popToLocals(g, this.locals)
    }

    store(value: Symbol, g: Generate): void {
        this.type.storeLocal(g, value, this.locals)
    }

    storeTo(symbol: Symbol, g: Generate): void {
        symbol.store(this, g)
    }

    addr(g: Generate): void {
        unsupported(this.location)
    }

    call(args: Symbol[]): Symbol {
        unsupported(this.location)
    }

    select(index: number | string): Symbol {
        const locals = this.locals
        if (typeof locals === "number") {
            unsupported(this.location)
        }
        const {type, index: actualIndex} = this.type.select(this.location, index)
        return new LocalSymbol(this.location, type, locals[actualIndex])
    }

    index(index: Symbol): Symbol {
        unsupported(this.location)
    }

    simplify(): Symbol { return this }

    tryNot(): Symbol | undefined { return undefined }

    number(): undefined {
        return undefined
    }

    initMemory(bytes: ByteWriter): boolean {
        return false
    }
}

const i32GenType = genTypeOf(undefined, i32Type)
const f64GenType = genTypeOf(undefined, f64Type)
const voidGenType = genTypeOf(undefined, voidType)
const booleanGenType = genTypeOf(undefined, booleanType)

abstract class LoadonlySymbol {
    location: Locatable | undefined

    constructor(location: Locatable | undefined) {
        this.location = location
    }

    abstract load(g: Generate): void

    store(value: Symbol, g: Generate): void {
        unsupported(this.location)
    }

    storeTo(symbol: Symbol, g: Generate): void {
        symbol.store(this as any as Symbol, g)
    }

    pop(g: Generate): void {
        unsupported(this.location)
    }

    addr(g: Generate): void {
        unsupported(this.location)
    }

    call(args: Symbol[]): Symbol {
        unsupported(this.location)
    }

    select(index: number | string): Symbol {
        unsupported(this.location)
    }

    index(index: Symbol): Symbol {
        unsupported(this.location)
    }

    number(): number | undefined {
        return undefined
    }

    simplify(): Symbol {
        return this as any as Symbol
    }

    tryNot(): Symbol | undefined {
        return undefined
    }

    initMemory(bytes: ByteWriter): boolean {
        return false
    }
}

class EmptySymbol extends LoadonlySymbol implements Symbol {
    type = voidGenType

    load(g: Generate): void { }

    initMemory(bytes: ByteWriter): boolean {
        return true
    }
}

const emptySymbol = new EmptySymbol(undefined)

class NumberConstSymbol extends LoadonlySymbol implements Symbol {
    type = i32GenType
    value: number

    constructor(location: Locatable | undefined, value: number) {
        super(location)
        this.location = location
        this.value = value
    }

    load(g: Generate): void {
        g.inst(Inst.i32_const)
        g.index(this.value)
    }

    number(): number {
        return this.value
    }

    tryNot(): Symbol {
        return new NumberConstSymbol(this.location, this.value === 0 ? 1 : 0)
    }

    initMemory(bytes: ByteWriter): boolean {
        return this.type.writeValue(bytes, this.value)
    }
}

class DoubleConstSymbol extends LoadonlySymbol implements Symbol {
    type = f64GenType
    value: number

    constructor(location: Locatable, value: number) {
        super(location)
        this.location = location
        this.value = value
    }

    number(): number {
        return this.value
    }

    load(g: Generate): void {
        g.inst(Inst.f64_const)
        g.float64(this.value)
    }

    initMemory(bytes: ByteWriter): boolean {
        return this.type.writeValue(bytes, this.value)
    }
}

function simplified(symbols: Symbol[]): Symbol[] {
    const simple: Symbol[] = []
    let changed = false
    for (const symbol of symbols) {
        const s = symbol.simplify()
        changed = changed || s !== symbol
        simple.push(s)
    }
    return changed ? simple : symbols
}

class StructLiteralSymbol extends LoadonlySymbol implements Symbol {
    location: Locatable
    type: GenType
    fields: Symbol[]

    constructor(location: Locatable, type: GenType, fields: Symbol[]) {
        super(location)
        this.location = location
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
        return new StructLiteralSymbol(this.location, this.type, simpleFields)
    }

    initMemory(bytes: ByteWriter): boolean {
        for (const symbol of this.fields) {
            if (!symbol.initMemory(bytes)) return false
        }
        return true
    }
}

class ArrayLiteralSymbol extends LoadonlySymbol implements Symbol {
    location: Locatable
    type: GenType
    elements: Symbol[]

    constructor(location: Locatable, type: GenType, elements: Symbol[]) {
        super(location)
        this.location = location
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
            const addr = symbol.index(new NumberConstSymbol(this.location, i)).simplify()
            elements[i].storeTo(addr, g)
        }
    }

    simplify(): Symbol {
        const elements = this.elements
        const simple = simplified(elements)
        if (elements === simple)
            return this
        return new ArrayLiteralSymbol(this.location, this.type, simple)
    }

    initMemory(bytes: ByteWriter): boolean {
        for (const element of this.elements) {
            if (!element.initMemory(bytes)) return false
        }
        return true
    }
}

class AssignSymbol extends LoadonlySymbol implements Symbol {
    location: Locatable
    type = voidGenType
    target: Symbol
    value: Symbol

    constructor(location: Locatable, target: Symbol, value: Symbol) {
        super(location)
        this.location = location
        this.target = target
        this.value = value
    }

    load(g: Generate) {
        this.value.storeTo(this.target, g)
    }

    simplify(): Symbol {
        const target = this.target
        const value = this.value
        const simpleTarget = target.simplify()
        const simpleValue = value.simplify()
        if (target === simpleTarget && value === simpleValue) {
            return this
        }
        return new AssignSymbol(this.location, simpleTarget, simpleValue)
    }
}

class UnaryOpSymbol extends LoadonlySymbol implements Symbol {
    location: Locatable
    type: GenType
    target: Symbol
    op: NodeKind

    constructor(location: Locatable, type: GenType, target: Symbol, op: NodeKind) {
        super(location)
        this.location = location
        this.type = type
        this.target = target
        this.op = op
    }

    load(g: Generate) {
        this.target.load(g)
        this.type.op(this.location, this.op, g)
    }

    simplify(): Symbol {
        const target = this.target
        const newTarget = target.simplify()
        switch(this.op) {
            case NodeKind.Not:
                const tryNot = newTarget.tryNot()
                if (tryNot) return tryNot
                break
            case NodeKind.Negate:
                const num = target.number()
                if (num !== undefined) {
                    switch (this.type.type.kind) {
                        case TypeKind.F64:
                        case TypeKind.F32:
                            return new DoubleConstSymbol(this.location, -num)
                    }
                    return new NumberConstSymbol(this.location, -num)
                }
                break

        }
        if (newTarget !== target) {
            return new UnaryOpSymbol(this.location, this.type, newTarget, this.op)
        }
        return this
    }
}

class OpSymbol extends LoadonlySymbol implements Symbol {
    location: Locatable
    type: GenType
    left: Symbol
    right: Symbol
    op: NodeKind

    constructor(location: Locatable, type: GenType, left: Symbol, right: Symbol, op: NodeKind) {
        super(location)
        this.location = location
        this.type = type
        this.left = left
        this.right = right
        this.op = op
    }

    load(g: Generate) {
        this.left.load(g)
        this.right.load(g)
        this.type.op(this.location, this.op, g)
    }

    simplify(): Symbol {
        const type = this.type
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
            switch (type.type.kind) {
                case TypeKind.F64:
                case TypeKind.F32:
                    return new DoubleConstSymbol(this.location, result)
            }
            return new NumberConstSymbol(this.location, result)
        }
        if (left === leftSimple && right === rightSimple) {
            return this
        }
        return new OpSymbol(this.location, this.type, leftSimple, rightSimple, this.op)
    }
}

class InstSymbol extends LoadonlySymbol implements Symbol {
    location: Locatable
    type: GenType
    inst: Inst
    args: Symbol[]

    constructor(location: Locatable, type: GenType, inst: Inst, args: Symbol[]) {
        super(location)
        this.location = location
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
    location: Locatable
    type: GenType
    inst: Inst
    target: Symbol

    constructor(location: Locatable, type: GenType, inst: Inst, target: Symbol) {
        super(location)
        this.location = location
        this.type = type
        this.inst = inst
        this.target = target
    }

    load(g: Generate) {
        unsupported(this.location)
    }

    call(args: Symbol[]) {
        return new InstSymbol(this.location, this.type, this.inst, [this.target, ...args])
    }
}

function builtinSymbolFor(location: Locatable, type: Type, result: GenType, name: string, target: Symbol): Symbol {
    let inst = Inst.Nop
    if (type.kind == TypeKind.Location)
        return builtinSymbolFor(location, type.type, result, name, target)
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
    if (inst == Inst.Nop) unsupported(location, `${name} for type ${typeToString(type)}`)
    return new BuiltinsSymbol(location, result, inst, target)
}

const trueSymbol = new NumberConstSymbol(undefined, 1)
const falseSymbol = new NumberConstSymbol(undefined, 0)

class CompareSymbol extends LoadonlySymbol implements Symbol {
    location: Locatable
    type = booleanGenType
    left: Symbol
    right: Symbol
    op: CompareOp

    constructor(location: Locatable, left: Symbol, right: Symbol, op: CompareOp) {
        super(location)
        this.location = location
        this.left = left.simplify()
        this.right = right.simplify()
        this.op = op
    }

    load(g: Generate): void {
        this.left.load(g)
        this.right.load(g)
        this.left.type.compare(this.location, this.op, g)
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
        return new CompareSymbol(this.location, leftSimple, rightSimple, this.op)
    }

    tryNot(): Symbol | undefined {
        let newOp: CompareOp | undefined = undefined
        switch (this.op) {
            case CompareOp.Equal: newOp = CompareOp.NotEqual; break
            case CompareOp.GreaterThan: newOp = CompareOp.LessThanEqual; break
            case CompareOp.GreaterThanEqual: newOp = CompareOp.LessThan; break
            case CompareOp.LessThan: newOp = CompareOp.GreaterThanEqual; break
            case CompareOp.LessThanEqual: newOp = CompareOp.GreaterThan; break
            case CompareOp.NotEqual: newOp = CompareOp.Equal; break
        }
        if (newOp !== undefined)
            return new CompareSymbol(this.location, this.left, this.right, newOp)
        return undefined
    }
}

class GotoSymbol extends LoadonlySymbol implements Symbol {
    location: Locatable
    type = voidGenType
    label: Label

    constructor(location: Locatable, label: Label) {
        super(location)
        this.location = location
        this.label = label
    }

    load(g: Generate) {
        g.br(this.label)
    }
}

class ReturnSymbol extends LoadonlySymbol implements Symbol {
    location: Locatable
    type = voidGenType
    expr: Symbol | undefined

    constructor(location: Locatable, expr?: Symbol) {
        super(location)
        this.location = location
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
    location: Locatable
    type: GenType
    funcIndex: FuncIndex
    args: Symbol[]

    constructor(location: Locatable, type: GenType, index: FuncIndex, args: Symbol[]) {
        super(location)
        this.location = location
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

    storeTo(symbol: Symbol, g: Generate) {
        this.load(g)
        symbol.pop(g)
    }

    simplify(): Symbol {
        const args = this.args
        const simpleArgs = simplified(args)
        if (args === simpleArgs)
            return this
        return new CallSymbol(this.location, this.type, this.funcIndex, simpleArgs)
    }
}

class IfThenSymbol extends LoadonlySymbol implements Symbol {
    location: Locatable
    type: GenType
    condition: Symbol
    then: Symbol
    else: Symbol | undefined

    constructor(location: Locatable, type: GenType, condition: Symbol, body: Symbol, e?: Symbol) {
        super(location)
        this.location = location
        this.type = type
        this.condition = condition.simplify()
        this.then = body.simplify()
        this.else = e?.simplify()
    }

    load(g: Generate) {
        const type = this.type
        const blockType = type.parts.piece ?? 0x40
        this.condition.load(g)
        const thenSymbol = this.then
        const elseSymbol = this.else
        if (elseSymbol) {
            const blocks = g.if_else(blockType)
            thenSymbol.load(blocks.then)
            elseSymbol.load(blocks.else)
        } else {
            const block = g.if(blockType)
            thenSymbol.load(block)
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
        return new IfThenSymbol(this.location, this.type, conditionSimple, thenSimple, elseSimple)
    }
}

class LoopSymbol extends LoadonlySymbol implements Symbol {
    location: Locatable
    type: GenType;
    symbols: Symbol[]
    breakLabel: Label
    continueLabel: Label

    constructor(location: Locatable, type: GenType, symbols: Symbol[], breakLabel: Label, continueLable: Label) {
        super(location)
        this.location = location
        this.type = type
        this.symbols = symbols
        this.breakLabel = breakLabel
        this.continueLabel = continueLable
    }

    load(g: Generate): void {
        const breakBlock = g.block(0x40, this.breakLabel)
        const loopBlock = breakBlock.loop(0x40, this.continueLabel)
        for (const symbol of this.symbols) {
            symbol.load(loopBlock)
        }
        loopBlock.br(this.continueLabel)
    }

    simplify(): Symbol {
        const symbols = this.symbols
        const simple = simplified(symbols)
        if (simple === symbols)
            return this
        return new LoopSymbol(this.location, this.type, simple, this.breakLabel, this.continueLabel)
    }
}

class BodySymbol extends LoadonlySymbol implements Symbol {
    location: Locatable
    type = voidGenType
    symbols: Symbol[]

    constructor(location: Locatable, symbols: Symbol[]) {
        super(location)
        this.location = location
        this.symbols = symbols
    }

    load(g: Generate): void {
        for (const symbol of this.symbols) {
            symbol.load(g)
        }
    }

    simplify(): Symbol {
        const symbols = this.symbols
        const simple = simplified(symbols)
        if (simple.length == 1) return simple[0]
        if (symbols === simple)
            return this
        return new BodySymbol(this.location, symbols)
    }
}

class BlockSymbol extends LoadonlySymbol implements Symbol {
    location: Locatable
    type: GenType
    symbols: Symbol[]
    label: Label

    constructor(location: Locatable, type: GenType, symbols: Symbol[], label: Label) {
        super(location)
        this.location = location
        this.type = type
        this.symbols = symbols
        this.label = label
    }

    load(g: Generate): void {
        const type = this.type
        const blockType = type.parts.piece ?? 0x40
        const body = g.block(blockType)
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
        return new BlockSymbol(this.location, this.type, symbols, this.label)
    }
}

class FunctionSymbol extends LoadonlySymbol implements Symbol {
    location: Locatable
    type: GenType
    funcIndex: FuncIndex

    constructor(location: Locatable, type: GenType, funcIndex: FuncIndex) {
        super(location)
        this.location = location
        this.type = type
        this.funcIndex = funcIndex
    }

    load(g: Generate): void {
        unsupported(this.location)
    }

    simplify(): Symbol {
        return this
    }

    call(args: Symbol[]): Symbol {
        return new CallSymbol(this.location, this.type, this.funcIndex, args)
    }
}

class ScaledOffsetSymbol extends LoadonlySymbol implements Symbol {
    location: Locatable
    type = i32GenType
    base: Symbol
    i: Symbol
    scale: Symbol

    constructor(location: Locatable, base: Symbol, index: Symbol, scale: Symbol) {
        super(location)
        this.location = location
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

        const baseNumber = base.number()
        const iNumber = i.number()
        const scaleNumber = scale.number()
        if (baseNumber !== undefined && iNumber !== undefined && scaleNumber != undefined) {
            return new NumberConstSymbol(this.location, baseNumber + scaleNumber * iNumber)
        }
        if (iNumber !== undefined && scaleNumber != undefined) {
            return new OpSymbol(this.location, i32GenType, this.base, new NumberConstSymbol(this.location, scaleNumber * iNumber), NodeKind.Add)
        }
        if (this.base === base && this.i === i && this.scale === scale)
            return this
        return new ScaledOffsetSymbol(this.location, base, i, scale)
    }
}

const zeroSymbol = new NumberConstSymbol(undefined, 0)

class DataSymbol implements Symbol {
    location: Locatable
    type: GenType
    address: Symbol

    constructor(location: Locatable, type: GenType, address: Symbol) {
        this.location = location
        this.type = type
        this.address = address
    }

    load(g: Generate): void {
        const address = this.address.number()
        if (address !== undefined)
            this.type.loadData(this.location, g, zeroSymbol, address)
        else
            this.type.loadData(this.location, g, this.address, 0)
    }

    pop(g: Generate): void {
        const address = this.address.number()
        if (address !== undefined)
            this.type.popToData(this.location, g, zeroSymbol, address)
        else
            this.type.popToData(this.location, g, this.address, 0)
    }

    store(value: Symbol, g: Generate): void {
        const address = this.address.number()
        if (address !== undefined)
            this.type.storeData(this.location, g, zeroSymbol, value, address)
        else
            this.type.storeData(this.location, g, this.address, value, 0)
    }

    storeTo(symbol: Symbol, g: Generate): void {
        symbol.store(this, g)
    }

    addr(g: Generate): void {
        this.address.load(g)
    }

    call(args: Symbol[]): Symbol {
        unsupported(this.location)
    }

    select(index: number): Symbol {
        const {type, offset} = this.type.select(this.location, index)
        const offsetAddress = new OpSymbol(this.location, i32GenType, this.address, new NumberConstSymbol(this.location, offset), NodeKind.Add)
        return new DataSymbol(this.location, type, offsetAddress)
    }

    index(index: Symbol): Symbol {
        const element = this.type.index()
        const size = element.size
        const sizeSymbol = new NumberConstSymbol(this.location, size)
        const offsetAddress = new ScaledOffsetSymbol(this.location, this.address, index, sizeSymbol)
        return new DataSymbol(this.location, element, offsetAddress)
    }

    simplify(): Symbol {
        const address = this.address
        const newAddress = address.simplify()
        if (address !== newAddress) {
            return new DataSymbol(this.location, this.type, newAddress)
        }
        return this
    }

    tryNot() {
        return undefined
    }

    number(): undefined {
        return undefined
    }

    initMemory(bytes: ByteWriter) {
        return false
    }
}

function genTypeOf(location: Locatable | undefined, type: Type, cache?: Map<Type, GenType>): GenType {
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
            unsupported(location)
        case TypeKind.Void:
            return new GenType(type, { void: true })
        case TypeKind.Array:
            return new GenType(type, {
                element: genTypeOf(location, type.elements),
                size: type.size
            })
        case TypeKind.Struct:
            const fields = type.fields.map((name, t) => genTypeOf(location, t, cached))
            return new GenType(type, { fields })
        case TypeKind.Location:
            return genTypeOf(location, type.type, cache)
        case TypeKind.Function:
            return genTypeOf(location, type.result, cache)
    }
    unsupported(location)
}

function none(): never {
    throw new Error("Internal code gen error")
}

function unsupported(location: Locatable | undefined, message?: string): never {
    const e = new Error(message ? "Not supported yet: " + message : "Not supported yet");
    if (location) (e as any).position = location.start
    throw e
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
    parameter(location: Locatable, type: GenType): Symbol
    allocate(location: Locatable, type: GenType, init?: Symbol): Symbol
    release(symbol: Symbol): void
}

class DataAllocator implements SymbolAllocator {
    private current: number = 0
    data: DataSection
    offset: number
    init: Generate

    constructor(data: DataSection, offset: number, init: Generate) {
        this.data = data
        this.offset = offset
        this.init = init
    }

    get size() { return this.current }

    parameter(location: Locatable, type: GenType): Symbol {
        unsupported(location, "Parameters cannot be allocated in memory")
    }

    allocate(location: Locatable, type: GenType, init?: Symbol): Symbol {
        const size = type.size
        const address = this.offset + this.current
        this.current += size
        const symbol = new DataSymbol(location, type, new NumberConstSymbol(location, address))
        if (init) {
            const simplifiedInit = init.simplify()
            const initBytes = new ByteWriter(size)
            if (simplifiedInit.initMemory(initBytes)) {
                check(initBytes.current == size, "Byte written and size disagree")
                const data = this.data
                const g = gen()
                g.inst(Inst.i32_const)
                g.index(address)
                g.inst(Inst.End)
                const expr = new ByteWriter()
                g.write(expr)
                data.allocateActive(initBytes, expr)
            } else {
                const assign = new AssignSymbol(location, symbol, simplifiedInit)
                assign.load(this.init)
            }
        }
        return symbol
    }

    release(symbol: Symbol) { }
}

class LocalAllocator implements SymbolAllocator {
    g: Generate

    constructor(g: Generate) {
        this.g = g
    }

    parameter(location: Locatable, type: GenType): Symbol {
        const g = this.g
        function localTypesToIndexes(parts: LocalTypes): LocalIndexes {
            if (typeof parts == "number") {
                return g.parameter(parts)
            } else {
                return parts.map(localTypesToIndexes)
            }
        }
        return new LocalSymbol(location, type, localTypesToIndexes(type.locals(location)))
    }

    allocate(location: Locatable, type: GenType, init?: Symbol): Symbol {
        const g = this.g
        function localTypesToIndexes(parts: LocalTypes): LocalIndexes {
            if (typeof parts == "number") {
                return g.local(parts)
            } else {
                return parts.map(localTypesToIndexes)
            }
        }
        return new LocalSymbol(location, type, localTypesToIndexes(type.locals(location)))
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
    const initGen = gen()
    const dataAllocator = new DataAllocator(dataSection, 0, initGen)
    const exportSection = new ExportSection()
    const dataCountSection = new DataCountSection(dataSection)
    const memorySection = new MemorySection(0)
    let startSection: StartSection | undefined = undefined

    function typeOfType(location: Locatable | undefined, type: Type | undefined): GenType {
        return genTypeOf(location, required(type), genTypes)
    }

    function typeOf(tree: Tree): GenType {
        return typeOfType(tree, types.get(tree))
    }

    const rootScope = new Scope<Symbol>()
    const rootScopes: Scopes = {
        continues: new Scope<Label>(),
        breaks: new Scope<Label>(),
        symbols: rootScope,
        alloc: dataAllocator
    }

    statementsToSymbol(program, rootScopes)

    // Allocate memory if necessary
    if (dataAllocator.size > 0) {
        memorySection.allocate({ min: dataAllocator.size })
    }

    // Aloocate an init function if necessary
    if (initGen.size() > 0) {
        const type = typeSection.funtionType({parameters: [], result: []})
        const funcIndex = funcSection.allocate(type)
        const bytes = new ByteWriter()
        initGen.inst(Inst.End)
        initGen.write(bytes)
        codeSection.allocate(initGen.currentLocals(), bytes)
        startSection = new StartSection(funcIndex)
    }

    function addSection(section: Section | undefined) {
        if (section && !section.empty()) module.addSection(section)
    }

    addSection(typeSection)
    addSection(importSection)
    addSection(funcSection)
    addSection(memorySection)
    addSection(exportSection)
    addSection(startSection)
    // if (!dataSection.empty())
    //     addSection(dataCountSection)
    addSection(codeSection)
    addSection(dataSection)

    function statementsToBodySymbol(trees: Tree[], scopes: Scopes) {
        const statements: Symbol[] = []
        for (const tree of trees) {
            statements.push(treeToSymbol(tree, scopes))
        }
        const location = { start: trees[0]?.start, end: trees[trees.length - 1]?.end }
        return new BodySymbol(location, statements)
    }

    function statementsToSymbol(trees: Tree[], scopes: Scopes, l: Label = label()): BlockSymbol {
        const statements: Symbol[] = []
        const blockScope = new Scope<Symbol>(scopes.symbols)
        for (const tree of trees) {
            statements.push(treeToSymbol(tree, {...scopes, symbols: blockScope }))
        }
        const type = statements.length > 0 ? statements[statements.length - 1].type : voidGenType
        const location = { start: trees[0]?.start, end: trees[trees.length - 1]?.end }
        return new BlockSymbol(location, type, statements, l)
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
                return new OpSymbol(tree, type, left, right, tree.kind)
            }
            case NodeKind.Not: {
                const target = treeToSymbol(tree.target, scopes)
                const type = typeOf(tree)
                return new UnaryOpSymbol(tree, type, target, tree.kind)
            }
            case NodeKind.Negate: {
                const target = treeToSymbol(tree.target, scopes)
                const type = typeOf(tree)
                switch (type.type.kind) {
                    case TypeKind.F32:
                    case TypeKind.F64:
                        return new UnaryOpSymbol(tree, type, target, tree.kind)
                    case TypeKind.I8:
                    case TypeKind.I16:
                    case TypeKind.I32:
                        return new OpSymbol(tree, type, zeroSymbol, target, NodeKind.Subtract)
                }
                break
            }
            case NodeKind.Compare: {
                const left = treeToSymbol(tree.left, scopes)
                const right = treeToSymbol(tree.right, scopes)
                return new CompareSymbol(tree, left, right, tree.op)
            }
            case NodeKind.BlockExpression:
                return statementsToSymbol(tree.block, scopes)
            case NodeKind.Break: {
                const l = required(scopes.breaks.find(tree.name ?? "$top"))
                return new GotoSymbol(tree, l)
            }
            case NodeKind.Continue: {
                const l = required(scopes.continues.find(tree.name ?? "$top"))
                return new GotoSymbol(tree, l)
            }
            case NodeKind.Return: {
                const value = tree.value
                const expr = value ? treeToSymbol(value, scopes) : undefined
                return new ReturnSymbol(tree, expr)
            }
            case NodeKind.Literal:
                switch (tree.literalKind) {
                    case LiteralKind.Int:
                        return new NumberConstSymbol(tree, tree.value)
                    case LiteralKind.Double:
                        return new DoubleConstSymbol(tree, tree.value)
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
                unsupported(tree)
            case NodeKind.FieldRef:
                unsupported(tree)
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

        unsupported(tree)
    }

    function structLitToSymbol(tree: StructLit, scopes: Scopes): Symbol {
        const type = typeOf(tree)
        const fields = tree.body.map(f => treeToSymbol(f, scopes))
        return new StructLiteralSymbol(tree, type, fields)
    }

    function arrayLitToSymbol(tree: ArrayLit, scopes: Scopes): Symbol {
        const type = typeOf(tree)
        const elements = tree.values.map(e => treeToSymbol(e, scopes))
        return new ArrayLiteralSymbol(tree, type, elements)
    }

    function selectToSymbol(tree: Select, scopes: Scopes): Symbol {
        const target = treeToSymbol(tree.target, scopes)
        const targetType = read(required(types.get(tree.target)))
        if (targetType.kind == TypeKind.Struct)
            return target.select(tree.name)
        else {
            const type = typeOf(tree)
            return builtinSymbolFor(tree, targetType, type, tree.name, target)
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
        return new AssignSymbol(tree, target, value)
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
            symbols.enter(parameter.name, alloc.parameter(parameter, type))
        }

        // Create the function type
        const parameters: ValueType[] = []
        for (const parameter of tree.parameters) {
            const type = typeOf(parameter)
            parameters.push(...flattenTypes(type.locals(parameter)))
        }
        const resultType = typeOf(tree)
        const result = flattenTypes(resultType.locals(tree.result))
        const typeIndex = typeSection.funtionType({
            parameters,
            result
        })

        // Create the function index
        const funcIndex = funcSection.allocate(typeIndex)
        const funcSymbol = new FunctionSymbol(tree, resultType, funcIndex)

        // Allow the function to call itself if it is named
        const functionName = tree.name
        if (functionName)
            scopes.symbols.enter(functionName, funcSymbol)

        // Generate the body
        const body = statementsToBodySymbol(tree.body, functionScopes).simplify()
        body.load(g)
        g.inst(Inst.End)
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
        const varSymbol = alloc.allocate(tree, type, value)
        symbols.enter(tree.name, varSymbol)
        return new AssignSymbol(tree, varSymbol, value)
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

        return new IfThenSymbol(tree, then.type, condition, then, elsePart)
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
        return new LoopSymbol(tree, voidGenType, body.symbols, breakLabel, continueLabel)
    }

    function read(type: Type): Type {
        if (type.kind == TypeKind.Location) return type.type
        return type
    }
}