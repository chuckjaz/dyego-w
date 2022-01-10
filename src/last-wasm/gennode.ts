import { booleanType, i32Type, LastKind, Locatable, memoryType, nameOfLastKind, Type, TypeDeclaration, TypeKind, typeToString, voidPointerType, voidType } from "../last";
import { check, error, required, unsupported } from "../utils";
import { ByteWriter, DataSection, FuncIndex, gen, Generate, Inst, Label, LocalIndex, NumberType, ReferenceType, ValueType } from "../wasm";

export interface GenNode {
    type: GenType
    location?: Locatable
    load(g: Generate): void
    pop(g: Generate): void
    store(value: GenNode, g: Generate): void
    storeTo(symbol: GenNode, g: Generate): void
    addr(g: Generate): void
    call(args: GenNode[], location?: Locatable): GenNode
    select(index: number | string): GenNode
    index(index: GenNode): GenNode
    reference(location: Locatable): GenNode
    addressOf(): GenNode
    simplify(): GenNode
    number(): number | undefined
    tryNot(): GenNode | undefined
    initMemory(bytes: ByteWriter): boolean
}

interface GenTypeParts {
    piece?: ValueType
    fields?: GenType[]
    element?: GenType
    size?: number
    void?: boolean
    memory?: boolean
}

export class GenType {
    type: Type
    size: number
    parts: GenTypeParts

    constructor(type: Type, parts: GenTypeParts, size?: number) {
        this.type = type
        this.parts = parts
        this.size = size ?? sizeOfParts(parts)
    }

    loadData(location: Locatable, g: Generate, addr: GenNode, offset: number) {
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

    storeData(location: Locatable, g: Generate, addr: GenNode, value: GenNode, offset: number) {
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

    popToData(location: Locatable, g: Generate, addr: GenNode, offset: number) {
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
            g.inst(Inst.Local_set)
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

    storeLocal(g: Generate, value: GenNode, localIndex: LocalIndexes) {
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
        if (parts.void || parts.memory) return []
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

    index(location: Locatable): GenType {
        return required(this.parts.element, location)
    }

    op(location: Locatable, kind: LastKind, g: Generate) {
        switch (kind) {
            case LastKind.Add:
                switch (this.type.kind) {
                    case TypeKind.I8:
                    case TypeKind.I16:
                    case TypeKind.I32:
                    case TypeKind.U8:
                    case TypeKind.U16:
                    case TypeKind.U32:
                    case TypeKind.Pointer:
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
            case LastKind.Subtract:
                switch (this.type.kind) {
                    case TypeKind.I8:
                    case TypeKind.I16:
                    case TypeKind.I32:
                    case TypeKind.U8:
                    case TypeKind.U16:
                    case TypeKind.U32:
                    case TypeKind.Pointer:
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
            case LastKind.Multiply:
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
            case LastKind.Divide:
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
                        return
                    case TypeKind.I64:
                        g.inst(Inst.i64_div_s)
                        return
                    case TypeKind.U64:
                        g.inst(Inst.i64_div_u)
                        return
                    case TypeKind.F32:
                        g.inst(Inst.f32_div)
                        return
                    case TypeKind.F64:
                        g.inst(Inst.f64_div)
                        return
                }
                break
            case LastKind.Remainder:
                switch (this.type.kind) {
                    case TypeKind.I8:
                    case TypeKind.I16:
                    case TypeKind.I32:
                        g.inst(Inst.i32_rem_s)
                        return
                    case TypeKind.I64:
                        g.inst(Inst.i64_rem_s)
                        return
                    case TypeKind.U8:
                    case TypeKind.U16:
                    case TypeKind.U32:
                        g.inst(Inst.i32_rem_u)
                        return
                    case TypeKind.U64:
                        g.inst(Inst.i64_rem_u)
                        return
                }
            case LastKind.Not:
                switch (this.type.kind) {
                    case TypeKind.Boolean:
                        g.inst(Inst.i32_eqz)
                        return
                }
                break
            case LastKind.Negate:
                switch (this.type.kind) {
                    case TypeKind.F32:
                        g.inst(Inst.f32_neg)
                        return
                    case TypeKind.F64:
                        g.inst(Inst.f64_neg)
                        return
                }
        }
        unsupported(location, `op ${nameOfLastKind(kind)} for ${typeToString(this.type)}`)
    }

    drop(location: Locatable, g: Generate) {
        const parts = this.parts
        if (parts.element !== undefined) {
            const size = parts.size
                if (size !== undefined) {
                for (let i = 0; i < size; i++) {
                    parts.element.drop(location, g)
                }
            }
        } else if (parts.fields !== undefined) {
            const fields = parts.fields
            for (let i = fields.length - 1; i >=0; i--) {
                const field = fields[i];
                field.drop(location, g)
            }
        } else if (parts.piece !== undefined) {
            g.inst(Inst.Drop)
        } else if (parts.memory || parts.void) {
            // Nothing to drop
        } else {
            unsupported(location)
        }
    }

    needsClamp(): boolean {
        switch(this.type.kind) {
            case TypeKind.I8:
            case TypeKind.I16:
            case TypeKind.U8:
            case TypeKind.U16:
                return true
        }
        return false
    }

    clamp(location: Locatable, g: Generate) {
        switch (this.type.kind) {
            case TypeKind.I8:
                g.inst(Inst.i32_extend8_s)
                break
            case TypeKind.I16:
                g.inst(Inst.i32_extend16_s)
                break
            case TypeKind.U8:
                g.inst(Inst.i32_const)
                g.snumber(0xFFn)
                g.inst(Inst.i32_and)
                break
            case TypeKind.U16:
                g.inst(Inst.i32_const)
                g.snumber(0xFFFFn)
                g.inst(Inst.i32_and)
                break
        }
    }

    compare(location: Locatable, op: LastKind, g: Generate) {
        switch (op) {
            case LastKind.Equal:
                switch (this.type.kind) {
                    case TypeKind.I8:
                    case TypeKind.I16:
                    case TypeKind.I32:
                    case TypeKind.U8:
                    case TypeKind.U16:
                    case TypeKind.U32:
                    case TypeKind.Pointer:
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
            case LastKind.GreaterThan:
                switch (this.type.kind) {
                    case TypeKind.I8:
                    case TypeKind.I16:
                    case TypeKind.I32:
                    case TypeKind.Pointer:
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
            case LastKind.GreaterThanEqual:
                switch (this.type.kind) {
                    case TypeKind.I8:
                    case TypeKind.I16:
                    case TypeKind.I32:
                        g.inst(Inst.i32_ge_s)
                        return
                    case TypeKind.U8:
                    case TypeKind.U16:
                    case TypeKind.U32:
                    case TypeKind.Pointer:
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
            case LastKind.LessThan:
                switch (this.type.kind) {
                    case TypeKind.I8:
                    case TypeKind.I16:
                    case TypeKind.I32:
                        g.inst(Inst.i32_lt_s)
                        return
                    case TypeKind.U8:
                    case TypeKind.U16:
                    case TypeKind.U32:
                    case TypeKind.Pointer:
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
            case LastKind.LessThanEqual:
                switch (this.type.kind) {
                    case TypeKind.I8:
                    case TypeKind.I16:
                    case TypeKind.I32:
                        g.inst(Inst.i32_le_s)
                        return
                    case TypeKind.U8:
                    case TypeKind.U16:
                    case TypeKind.U32:
                    case TypeKind.Pointer:
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
            case LastKind.NotEqual:
                switch (this.type.kind) {
                    case TypeKind.I8:
                    case TypeKind.I16:
                    case TypeKind.I32:
                        g.inst(Inst.i32_ne)
                        return
                    case TypeKind.U8:
                    case TypeKind.U16:
                    case TypeKind.U32:
                    case TypeKind.Pointer:
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
            case TypeKind.U32:
            case TypeKind.Pointer: {
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
    if (parts.void || parts.memory) return 0
    error("Invalid parts")
}

type LocalIndexes = LocalIndex | LocalIndexes[]
type LocalTypes = ValueType | LocalTypes[]

export function flattenTypes(types: LocalTypes): ValueType[] {
    const result: ValueType[] = []
    function flatten(type: LocalTypes) {
        if (typeof type === "number")
            result.push(type)
        else type.forEach(flatten)
    }
    flatten(types)
    return result
}

export function genTypeOf(location: Locatable | undefined, type: Type, cache?: Map<Type, GenType>): GenType {
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
        case TypeKind.Pointer:
            return new GenType(type, { piece: NumberType.i32 })
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
        case TypeKind.Memory:
            return new GenType(type, { memory: true })
    }
    unsupported(location)
}

export const i32GenType = genTypeOf(undefined, i32Type)
export const voidGenType = genTypeOf(undefined, voidType)
export const voidPointerGenType = genTypeOf(undefined, voidPointerType)
const booleanGenType = genTypeOf(undefined, booleanType)
const memoryGenType = genTypeOf(undefined, memoryType)

export interface LocationAllocator {
    parameter(location: Locatable, type: GenType): GenNode
    allocate(location: Locatable, type: GenType, init?: GenNode): GenNode
    release(node: GenNode): void
}

export class DataAllocator implements LocationAllocator {
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

    parameter(location: Locatable, type: GenType): GenNode {
        unsupported(location, "Parameters cannot be allocated in memory")
    }

    allocate(location: Locatable, type: GenType, init?: GenNode): GenNode {
        const size = type.size
        const address = this.offset + this.current
        this.current += size
        const node = new DataGenNode(
            location,
            type,
            new NumberConstGenNode(location, i32GenType, address)
        )
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
                const assign = new AssignGenNode(location, node, simplifiedInit)
                assign.load(this.init)
            }
        }
        return node
    }

    release(node: GenNode) { }
}

export class LocalAllocator implements LocationAllocator {
    g: Generate

    constructor(g: Generate) {
        this.g = g
    }

    parameter(location: Locatable, type: GenType): GenNode {
        const g = this.g
        function localTypesToIndexes(parts: LocalTypes): LocalIndexes {
            if (typeof parts == "number") {
                return g.parameter(parts)
            } else {
                return parts.map(localTypesToIndexes)
            }
        }
        return new LocalGenNode(location, type, localTypesToIndexes(type.locals(location)))
    }

    allocate(location: Locatable, type: GenType, init?: GenNode): GenNode {
        const g = this.g
        function localTypesToIndexes(parts: LocalTypes): LocalIndexes {
            if (typeof parts == "number") {
                return g.local(parts)
            } else {
                return parts.map(localTypesToIndexes)
            }
        }
        return new LocalGenNode(location, type, localTypesToIndexes(type.locals(location)))
    }

    release(node: GenNode) {
        const g = this.g
        function releaseIndexes(indexes: LocalIndexes) {
            if (typeof indexes == "number") {
                g.release(indexes)
            } else {
                indexes.forEach(releaseIndexes)
            }
        }
        if (node instanceof LocalGenNode) {
            releaseIndexes(node.locals)
        }
    }
}

class LocalGenNode implements GenNode {
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

    store(value: GenNode, g: Generate): void {
        this.type.storeLocal(g, value, this.locals)
    }

    storeTo(symbol: GenNode, g: Generate): void {
        symbol.store(this, g)
    }

    addr(g: Generate): void {
        unsupported(this.location)
    }

    call(args: GenNode[], location?: Locatable): GenNode {
        unsupported(location ?? this.location)
    }

    select(index: number | string): GenNode {
        const locals = this.locals
        if (typeof locals === "number") {
            unsupported(this.location)
        }
        const {type, index: actualIndex} = this.type.select(this.location, index)
        return new LocalGenNode(this.location, type, locals[actualIndex])
    }

    index(index: GenNode): GenNode {
        unsupported(this.location)
    }

    reference(location: Locatable): GenNode {
        return new LocalGenNode(location, this.type, this.locals)
    }


    addressOf(): GenNode {
        unsupported(this.location, "addressOf is not supported on this symbol")
    }

    simplify(): GenNode { return this }

    tryNot(): GenNode | undefined { return undefined }

    number(): undefined {
        return undefined
    }

    initMemory(bytes: ByteWriter): boolean {
        return false
    }
}

abstract class LoadonlyGenNode {
    location: Locatable | undefined

    constructor(location: Locatable | undefined) {
        this.location = location
    }

    abstract load(g: Generate): void

    store(value: GenNode, g: Generate): void {
        unsupported(this.location)
    }

    storeTo(symbol: GenNode, g: Generate): void {
        symbol.store(this as any as GenNode, g)
    }

    pop(g: Generate): void {
        unsupported(this.location)
    }

    addr(g: Generate): void {
        unsupported(this.location)
    }

    call(args: GenNode[]): GenNode {
        unsupported(this.location)
    }

    select(index: number | string): GenNode {
        unsupported(this.location)
    }

    index(index: GenNode): GenNode {
        unsupported(this.location)
    }

    addressOf(): GenNode {
        unsupported(this.location, "addressOf is not supported on this symbol")
    }

    number(): number | undefined {
        return undefined
    }

    tryNot(): GenNode | undefined {
        return undefined
    }

    initMemory(bytes: ByteWriter): boolean {
        return false
    }
}

class EmptyGenNode extends LoadonlyGenNode implements GenNode {
    type = voidGenType

    load(g: Generate): void { }

    initMemory(bytes: ByteWriter): boolean {
        return true
    }

    reference(location: Locatable): GenNode {
        return this
    }

    simplify(): GenNode {
        return this
    }
}

export const emptyGenNode = new EmptyGenNode(undefined)

export class ClampGenNode extends LoadonlyGenNode implements GenNode {
    location: Locatable
    type: GenType
    target: GenNode

    constructor(location: Locatable, target: GenNode) {
        super(location)
        this.location = location
        this.type = target.type
        this.target = target
    }

    load(g: Generate): void {
        g.pushLocation(this.location.start, this.location.end)
        this.target.load(g)
        this.type.clamp(this.location, g)
        g.popLocation()
    }

    reference(location: Locatable): GenNode {
        return new ClampGenNode(location, this.target)
    }

    simplify(): GenNode {
        if (!this.type.needsClamp()) return this.target
        return this
    }
}

export class NumberConstGenNode extends LoadonlyGenNode implements GenNode {
    type: GenType
    value: number

    constructor(location: Locatable | undefined, type: GenType, value: number) {
        super(location)
        this.location = location
        this.type = type
        this.value = value
    }

    load(g: Generate): void {
        g.inst(Inst.i32_const)
        let value = this.value
        if (value > 0x7FFFFFFF) {
            // U32 values > 2^31-1 are written as negative numbers with the same bit pattern
            value = value | 0
        }
        g.snumber(BigInt(value))
    }

    reference(location: Locatable): GenNode {
        return new NumberConstGenNode(location, this.type, this.value)
    }

    simplify(): GenNode {
        return this
    }

    number(): number {
        return this.value
    }

    tryNot(): GenNode {
        return new NumberConstGenNode(this.location, this.type, this.value === 0 ? 1 : 0)
    }

    initMemory(bytes: ByteWriter): boolean {
        return this.type.writeValue(bytes, this.value)
    }
}

export class BigIntConstGenNode extends LoadonlyGenNode implements GenNode {
    type: GenType
    value: bigint

    constructor(location: Locatable | undefined, type: GenType, value: bigint) {
        super(location)
        this.type = type
        this.location = location
        this.value = value
    }

    load(g: Generate): void {
        g.inst(Inst.i64_const)
        g.snumber(this.value)
    }

    reference(location: Locatable): GenNode {
        return new BigIntConstGenNode(location, this.type, this.value)
    }

    simplify(): GenNode { return this }

    initMemory(bytes: ByteWriter): boolean {
        return this.type.writeValue(bytes, this.value)
    }
}

export class DoubleConstGenNode extends LoadonlyGenNode implements GenNode {
    type: GenType
    value: number

    constructor(location: Locatable, type: GenType, value: number) {
        super(location)
        this.location = location
        this.type = type
        this.value = value
    }

    number(): number {
        return this.value
    }

    load(g: Generate): void {
        g.inst(Inst.f64_const)
        g.float64(this.value)
    }

    reference(location: Locatable): GenNode {
        return new DoubleConstGenNode(location, this.type, this.value)
    }

    simplify(): GenNode {
        return this
    }

    initMemory(bytes: ByteWriter): boolean {
        return this.type.writeValue(bytes, this.value)
    }
}

function simplified(nodes: GenNode[]): GenNode[] {
    const simple: GenNode[] = []
    let changed = false
    for (const node of nodes) {
        const s = node.simplify()
        changed = changed || s !== node
        simple.push(s)
    }
    return changed ? simple : nodes
}

export class StructLiteralGenNode extends LoadonlyGenNode implements GenNode {
    location: Locatable
    type: GenType
    fields: GenNode[]

    constructor(location: Locatable, type: GenType, fields: GenNode[]) {
        super(location)
        this.location = location
        this.type = type
        this.fields = fields
    }

    load(g: Generate) {
        const fields = this.fields
        for (const field of fields) {
            g.pushLocation(field.location?.start, field.location?.end)
            field.load(g)
            g.popLocation()
        }
    }

    storeTo(symbol: GenNode, g: Generate) {
        const fields = this.fields
        const len = fields.length
        for (let i = 0; i < len; i++) {
            const field = fields[i]
            g.pushLocation(field.location?.start, field.location?.end)
            field.storeTo(symbol.select(i), g)
            g.popLocation()
        }
    }

    reference(location: Locatable): GenNode {
        return new StructLiteralGenNode(location, this.type, this.fields)
    }

    simplify(): GenNode {
        const simpleFields = simplified(this.fields)
        if (simpleFields === this.fields)
            return this
        return new StructLiteralGenNode(this.location, this.type, simpleFields)
    }

    initMemory(bytes: ByteWriter): boolean {
        for (const symbol of this.fields) {
            if (!symbol.initMemory(bytes)) return false
        }
        return true
    }
}

export class ArrayLiteralGenNode extends LoadonlyGenNode implements GenNode {
    location: Locatable
    type: GenType
    elements: GenNode[]

    constructor(location: Locatable, type: GenType, elements: GenNode[]) {
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

    storeTo(symbol: GenNode, g: Generate) {
        const elements = this.elements
        const len = elements.length
        for (let i = 0; i < len; i++) {
            const addr = symbol.index(new NumberConstGenNode(this.location, i32GenType, i)).simplify()
            elements[i].storeTo(addr, g)
        }
    }

    reference(location: Locatable): GenNode {
        return new ArrayLiteralGenNode(location, this.type, this.elements)
    }

    simplify(): GenNode {
        const elements = this.elements
        const simple = simplified(elements)
        if (elements === simple)
            return this
        return new ArrayLiteralGenNode(this.location, this.type, simple)
    }

    initMemory(bytes: ByteWriter): boolean {
        for (const element of this.elements) {
            if (!element.initMemory(bytes)) return false
        }
        return true
    }
}

export class AssignGenNode extends LoadonlyGenNode implements GenNode {
    location: Locatable
    type = voidGenType
    target: GenNode
    value: GenNode

    constructor(location: Locatable, target: GenNode, value: GenNode) {
        super(location)
        this.location = location
        this.target = target
        this.value = value
    }

    load(g: Generate) {
        this.value.storeTo(this.target, g)
    }

    reference(location: Locatable): GenNode {
        return new AssignGenNode(location, this.target, this.value)
    }

    simplify(): GenNode {
        const target = this.target
        const value = this.value
        const simpleTarget = target.simplify()
        const simpleValue = value.simplify()
        if (target === simpleTarget && value === simpleValue) {
            return this
        }
        return new AssignGenNode(this.location, simpleTarget, simpleValue)
    }
}

export class UnaryOpGenNode extends LoadonlyGenNode implements GenNode {
    location: Locatable
    type: GenType
    target: GenNode
    op: LastKind

    constructor(location: Locatable, type: GenType, target: GenNode, op: LastKind) {
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

    reference(location: Locatable): GenNode {
        return new UnaryOpGenNode(location, this.type, this.target, this.op)
    }

    simplify(): GenNode {
        const target = this.target
        const newTarget = target.simplify()
        switch(this.op) {
            case LastKind.Not:
                const tryNot = newTarget.tryNot()
                if (tryNot) return tryNot
                break
            case LastKind.Negate:
                const num = target.number()
                if (num !== undefined) {
                    switch (this.type.type.kind) {
                        case TypeKind.F64:
                        case TypeKind.F32:
                            return new DoubleConstGenNode(this.location, this.type, -num)
                    }
                    return new NumberConstGenNode(this.location, this.type, -num)
                }
                break

        }
        if (newTarget !== target) {
            return new UnaryOpGenNode(this.location, this.type, newTarget, this.op)
        }
        return this
    }
}

export class OpGenNode extends LoadonlyGenNode implements GenNode {
    location: Locatable
    type: GenType
    left: GenNode
    right: GenNode
    op: LastKind

    constructor(location: Locatable, type: GenType, left: GenNode, right: GenNode, op: LastKind) {
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

    reference(location: Locatable): GenNode {
        return new OpGenNode(location, this.type, this.left, this.right, this.op)
    }

    simplify(): GenNode {
        const type = this.type
        const left = this.left
        const right = this.right
        const leftSimple = left.simplify()
        const rightSimple = right.simplify()
        const leftNumber = leftSimple.number()
        const rightNumber = rightSimple.number()
        if (leftNumber !== undefined && rightNumber !== undefined) {
            let result: number = 0
            switch (this.op) {
                case LastKind.Add:
                    result = leftNumber + rightNumber
                    break
                case LastKind.Subtract:
                    result = leftNumber - rightNumber
                    break
                case LastKind.Multiply:
                    result = leftNumber * rightNumber
                    break
                case LastKind.Divide:
                    if (rightNumber === 0) error("Divide by zero")
                    result = leftNumber / rightNumber
                    break
                default:
                    return this
            }
            switch (this.type.type.kind) {
                case TypeKind.I8:
                    result = result & 0x7F
                    break
                case TypeKind.I16:
                    result = result & 0x7FFF
                    break
                case TypeKind.I32:
                    result = result & 0x7FFFFFFF
                    break
                case TypeKind.U8:
                    result = result & 0xFF
                    break
                case TypeKind.U16:
                    result = result & 0xFFFF
                    break
                case TypeKind.Pointer:
                case TypeKind.U32:
                    result = result & 0xFFFFFFFF
                    break
            }
            switch (type.type.kind) {
                case TypeKind.F64:
                case TypeKind.F32:
                    return new DoubleConstGenNode(this.location, this.type, result)
            }
            return new NumberConstGenNode(this.location, this.type, result)
        }
        if (leftNumber === 0 || rightNumber === 0) {
            switch (this.op) {
                case LastKind.Add:
                    return leftNumber === 0 ? rightSimple : leftSimple
                case LastKind.Subtract:
                    if (rightNumber === 0) return  leftSimple
            }
        }
        if (leftNumber === 1 || rightNumber === 0) {
            switch (this.op) {
                case LastKind.Multiply:
                    return leftNumber === 1 ? rightSimple : leftSimple
                case LastKind.Divide:
                    if (rightNumber === 1) return leftSimple
            }
        }
        if (left === leftSimple && right === rightSimple) {
            return this
        }
        return new OpGenNode(this.location, this.type, leftSimple, rightSimple, this.op)
    }
}

class InstGenNode extends LoadonlyGenNode implements GenNode {
    location: Locatable
    type: GenType
    inst: Inst
    args: GenNode[]

    constructor(location: Locatable, type: GenType, inst: Inst, args: GenNode[]) {
        super(location)
        this.location = location
        this.type = type
        this.inst = inst
        this.args = args
    }

    load(g: Generate) {
        g.pushLocation(this.location?.start, this.location?.end)
        for (const arg of this.args) {
            arg.load(g)
        }
        g.inst(this.inst)
        g.popLocation()
    }

    reference(location: Locatable): GenNode {
        return new InstGenNode(location, this.type, this.inst, this.args)
    }

    simplify(): GenNode {
        return this
    }
}

class BuiltinsGenNode extends LoadonlyGenNode implements GenNode {
    location: Locatable
    type: GenType
    inst: Inst
    target: GenNode
    offset?: number

    constructor(location: Locatable, type: GenType, inst: Inst, target: GenNode, offset?: number) {
        super(location)
        this.location = location
        this.type = type
        this.inst = inst
        this.target = target
        this.offset = offset
    }

    load(g: Generate) {
        unsupported(this.location)
    }

    call(args: GenNode[], location?: Locatable) {
        let result: GenNode = new InstGenNode(
            location ?? this.location,
            this.type,
            this.inst,
            [this.target, ...args]
        )
        const offset = this.offset
        if (offset !== undefined) {
            result = new OpGenNode(
                this.location,
                i32GenType,
                result,
                new NumberConstGenNode(this.location, i32GenType, offset),
                LastKind.Subtract
            )
        }
        return result
    }

    reference(location: Locatable): GenNode {
        return new BuiltinsGenNode(location, this.type, this.inst, this.target, this.offset)
    }

    simplify(): GenNode {
        const target = this.target.simplify()
        if (target !== this.target) {
            return new BuiltinsGenNode(this.location, this.type, this.inst, target)
        }
        return this
    }
}

class ComplexGenNode extends LoadonlyGenNode implements GenNode {
    location: Locatable
    type: GenType
    gen: (g: Generate) => void
    args: GenNode[]

    constructor(location: Locatable, type: GenType, args: GenNode[],  gen: (g: Generate) => void) {
        super(location)
        this.location = location
        this.type = type
        this.gen = gen
        this.args = args
    }

    reference(location: Locatable): GenNode {
        return new ComplexGenNode(location, this.type, this.args, this.gen)
    }

    load(g: Generate) {
        g.pushLocation(this.location?.start, this.location?.end)
        for (const symbol of this.args) {
            symbol.load(g)
        }
        this.gen(g)
        g.popLocation()
    }

    simplify(): GenNode {
        const args = simplified(this.args)
        if (args !== this.args) {
            return new ComplexGenNode(this.location, this.type, args, this.gen)
        }
        return this
    }
}

class BuiltinComplexGenNode extends LoadonlyGenNode implements GenNode {
    location: Locatable
    type: GenType
    gen: (g: Generate) => void

    constructor(location: Locatable, type: GenType, gen: (g: Generate) => void) {
        super(location)
        this.location = location
        this.type = type
        this.gen = gen
    }

    load(g: Generate) {
        unsupported(this.location)
    }

    reference(location: Locatable): GenNode {
        return new BuiltinComplexGenNode(location, this.type, this.gen)
    }

    simplify(): GenNode {
        return this
    }

    call(args: GenNode[], location?: Locatable) {
        return new ComplexGenNode(location ?? this.location, this.type, args, this.gen)
    }
}

export function builtinGenNodeFor(
    location: Locatable,
    type: Type,
    result: GenType,
    name: string,
    target: GenNode
): GenNode {
    let inst = Inst.Nop
    let offset: number | undefined = undefined
    let clamp = false
    if (type.kind == TypeKind.Location)
        return builtinGenNodeFor(location, type.type, result, name, target)
    switch (name) {
        case "countLeadingZeros":
            switch (type.kind) {
                case TypeKind.I8:
                case TypeKind.U8:
                    offset = 8
                    clamp = true
                case TypeKind.I16:
                case TypeKind.U16:
                    offset = (offset ?? 0) + 16
                    clamp = true
                case TypeKind.I32:
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
                case TypeKind.U8:
                case TypeKind.U16:
                    clamp = true
                case TypeKind.I32:
                case TypeKind.U32:
                    inst = Inst.i32_popcnt
                    break
                case TypeKind.I64:
                case TypeKind.U64:
                    inst = Inst.i64_popcnt
                    break
            }
            break
        case "shiftLeft":
            switch (type.kind) {
                case TypeKind.I8:
                case TypeKind.I16:
                case TypeKind.U8:
                case TypeKind.U16:
                    clamp = true
                case TypeKind.I32:
                case TypeKind.U32:
                    inst = Inst.i32_shl
                    break
                case TypeKind.I64:
                case TypeKind.U64:
                    inst = Inst.i64_shl
                    break
            }
            break
        case "shiftRight":
            switch (type.kind) {
                case TypeKind.I8:
                case TypeKind.I16:
                    clamp = true
                case TypeKind.I32:
                    inst = Inst.i32_shr_s
                    break
                case TypeKind.I64:
                    inst = Inst.i64_shr_s
                    break
                case TypeKind.U8:
                case TypeKind.U16:
                    clamp = true
                case TypeKind.U32:
                    inst = Inst.i32_shr_u
                    break
                case TypeKind.U64:
                    inst = Inst.i64_shr_u
                    break
            }
            break
        case "rotateLeft":
            switch (type.kind) {
                case TypeKind.I8:
                case TypeKind.I16:
                case TypeKind.U8:
                case TypeKind.U16:
                    clamp = true
                case TypeKind.I32:
                case TypeKind.U32:
                    inst = Inst.i32_rotl
                    break
                case TypeKind.I64:
                case TypeKind.U64:
                    inst = Inst.i64_rotl
                    break
            }
            break
        case "rotateRight":
            switch (type.kind) {
                case TypeKind.I8:
                case TypeKind.I16:
                case TypeKind.U8:
                case TypeKind.U16:
                    clamp = true
                case TypeKind.I32:
                case TypeKind.U32:
                    inst = Inst.i32_rotr
                    break
                case TypeKind.I64:
                case TypeKind.U64:
                    inst = Inst.i64_rotr
                    break
            }
            break
        case "bitAnd":
            switch (type.kind) {
                case TypeKind.I8:
                case TypeKind.I16:
                case TypeKind.U8:
                case TypeKind.U16:
                case TypeKind.I32:
                case TypeKind.U32:
                    inst = Inst.i32_and
                    break
                case TypeKind.I64:
                case TypeKind.U64:
                    inst = Inst.i64_and
                    break
            }
            break
        case "bitOr":
            switch (type.kind) {
                case TypeKind.I8:
                case TypeKind.I16:
                case TypeKind.U8:
                case TypeKind.U16:
                case TypeKind.I32:
                case TypeKind.U32:
                    inst = Inst.i32_or
                    break
                case TypeKind.I64:
                case TypeKind.U64:
                    inst = Inst.i64_or
                    break
            }
            break
        case "bitXor":
            switch (type.kind) {
                case TypeKind.I8:
                case TypeKind.I16:
                case TypeKind.U8:
                case TypeKind.U16:
                case TypeKind.I32:
                case TypeKind.U32:
                    inst = Inst.i32_xor
                    break
                case TypeKind.I64:
                case TypeKind.U64:
                    inst = Inst.i64_xor
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
        case "top":
            switch (type.kind) {
                case TypeKind.Memory:
                    return new BuiltinComplexGenNode(location, result, g => {
                        // The top of memory is generated at address 0 which also
                        // reserves 0 as an invalid data pointer that can be used for null
                        i32GenType.loadData(location, g, zeroGenNode, 0)
                    })
            }
            break
        case "limit":
            switch (type.kind) {
                case TypeKind.Memory:
                    return new BuiltinComplexGenNode(location, result, g => {
                        g.inst(Inst.Memory_size)
                        g.index(0)
                        g.inst(Inst.i32_const)
                        g.inst(16)
                        g.inst(Inst.i32_shl)
                    })
            }
            break
        case "grow":
            switch (type.kind) {
                case TypeKind.Memory:
                    return new BuiltinComplexGenNode(location, result, g => {
                        g.inst(Inst.Memory_grow)
                        g.index(0)
                    })
            }
            break
    }
    if (clamp && target.type.needsClamp()) {
        target = new ClampGenNode(location, target)
    }
    if (inst == Inst.Nop) unsupported(location, `${name} for type ${typeToString(type)}`)

    return new BuiltinsGenNode(location, result, inst, target, offset)
}

export const trueGenNode = new NumberConstGenNode(undefined, booleanGenType, 1)
export const falseGenNode = new NumberConstGenNode(undefined, booleanGenType, 0)
export const zeroGenNode = new NumberConstGenNode(undefined, i32GenType, 0)

export class CompareGenNode extends LoadonlyGenNode implements GenNode {
    location: Locatable
    type = booleanGenType
    left: GenNode
    right: GenNode
    op: LastKind

    constructor(location: Locatable, left: GenNode, right: GenNode, op: LastKind) {
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

    simplify(): GenNode {
        const left = this.left
        const right = this.right
        const leftSimple = left.simplify()
        const rightSimple = right.simplify()
        const leftNumber = leftSimple.number()
        const rightNumber = rightSimple.number()
        if (leftNumber !== undefined && rightNumber !== undefined) {
            switch (this.op) {
                case LastKind.Equal:
                    return leftNumber === rightNumber ? trueGenNode : falseGenNode
                case LastKind.GreaterThan:
                    return leftNumber > rightNumber ? trueGenNode : falseGenNode
                case LastKind.GreaterThanEqual:
                    return leftNumber >= rightNumber ? trueGenNode : falseGenNode
                case LastKind.LessThan:
                    return leftNumber < rightNumber ? trueGenNode : falseGenNode
                case LastKind.LessThanEqual:
                    return leftNumber <= rightNumber ? trueGenNode : falseGenNode
                case LastKind.NotEqual:
                    return leftNumber !== rightNumber ? trueGenNode : falseGenNode
            }
        }
        if (left === leftSimple && right === rightSimple)
            return this
        return new CompareGenNode(this.location, leftSimple, rightSimple, this.op)
    }

    reference(location: Locatable): GenNode {
        return new CompareGenNode(location, this.left, this.right, this.op)
    }

    tryNot(): GenNode | undefined {
        let newOp: LastKind | undefined = undefined
        switch (this.op) {
            case LastKind.Equal: newOp = LastKind.NotEqual; break
            case LastKind.GreaterThan: newOp = LastKind.LessThanEqual; break
            case LastKind.GreaterThanEqual: newOp = LastKind.LessThan; break
            case LastKind.LessThan: newOp = LastKind.GreaterThanEqual; break
            case LastKind.LessThanEqual: newOp = LastKind.GreaterThan; break
            case LastKind.NotEqual: newOp = LastKind.Equal; break
        }
        if (newOp !== undefined)
            return new CompareGenNode(this.location, this.left, this.right, newOp)
        return undefined
    }
}

export class GotoGenNode extends LoadonlyGenNode implements GenNode {
    location: Locatable
    type = voidGenType
    label: Label

    constructor(location: Locatable, label: Label) {
        super(location)
        this.location = location
        this.label = label
        label.reference()
    }

    reference(location: Locatable): GenNode {
        return new GotoGenNode(location, this.label)
    }

    load(g: Generate) {
        g.pushLocation(this.location?.start, this.location?.end)
        g.br(this.label)
        g.popLocation()
    }

    simplify(): GenNode {
        return this
    }
}

export class BranchTableGenNode extends LoadonlyGenNode implements GenNode {
    location: Locatable
    type = voidGenType
    expression: GenNode
    labels: Label[]
    elseLabel: Label

    constructor(location: Locatable, expression: GenNode, labels: Label[], elseLabel: Label) {
        super(location)
        this.location = location
        this.expression = expression
        this.labels = labels
        this.elseLabel = elseLabel
        labels.forEach(label => label.reference())
        elseLabel.reference()
    }

    load(g: Generate) {
        g.pushLocation(this.location?.start, this.location?.end)
        this.expression.load(g)
        g.table(this.labels, this.elseLabel)
        g.popLocation()
    }

    reference(location: Locatable): GenNode {
        return new BranchTableGenNode(location, this.expression, this.labels, this.elseLabel)
    }

    simplify(): GenNode {
        const expression = this.expression.simplify()
        if (expression !== this.expression) {
            return new BranchTableGenNode(this.location, expression, this.labels, this.elseLabel)
        }
        return this
    }
}

export class ReturnGenNode extends LoadonlyGenNode implements GenNode {
    location: Locatable
    type = voidGenType
    expr: GenNode | undefined

    constructor(location: Locatable, expr?: GenNode) {
        super(location)
        this.location = location
        if (expr && expr.type.needsClamp()) {
            expr = new ClampGenNode(location, expr)
        }
        this.expr = expr
    }

    load(g: Generate) {
        g.pushLocation(this.location?.start, this.location?.end)
        const expr = this.expr
        if (expr) {
            expr.load(g)
        }
        g.return()
        g.popLocation()
    }

    reference(location: Locatable): GenNode {
        return new ReturnGenNode(location, this.expr)
    }

    simplify(): GenNode {
        return this
    }
}

class CallGenNode extends LoadonlyGenNode implements GenNode {
    location: Locatable
    type: GenType
    funcIndex: FuncIndex
    args: GenNode[]

    constructor(location: Locatable, type: GenType, index: FuncIndex, args: GenNode[]) {
        super(location)
        this.location = location
        this.type = type
        this.funcIndex = index
        this.args = args
    }

    load(g: Generate) {
        const args = this.args
        for (const arg of args) {
            arg.load(g)
        }
        g.inst(Inst.Call)
        g.index(this.funcIndex)
    }

    reference(location: Locatable): GenNode {
        return new CallGenNode(location, this.type, this.funcIndex, this.args)
    }

    storeTo(symbol: GenNode, g: Generate) {
        g.pushLocation(this.location?.start, this.location?.end)
        this.load(g)
        symbol.pop(g)
        g.popLocation()
    }

    simplify(): GenNode {
        const args = this.args
        const simpleArgs = simplified(args)
        if (args === simpleArgs)
            return this
        return new CallGenNode(this.location, this.type, this.funcIndex, simpleArgs)
    }
}

export class IfThenGenNode extends LoadonlyGenNode implements GenNode {
    location: Locatable
    type: GenType
    condition: GenNode
    then: GenNode
    else: GenNode | undefined

    constructor(location: Locatable, type: GenType, condition: GenNode, body: GenNode, e?: GenNode) {
        super(location)
        this.location = location
        this.type = type
        this.condition = condition
        this.then = body
        this.else = e
    }

    reference(location: Locatable): GenNode {
        return new IfThenGenNode(location, this.type, this.condition, this.then, this.else)
    }

    load(g: Generate) {
        g.pushLocation(this.location?.start, this.location?.end)
        const type = this.type
        const blockType = type.parts.piece ?? 0x40
        this.condition.load(g)
        const thenGenNode = this.then
        const elseGenNode = this.else
        if (elseGenNode) {
            const blocks = g.if_else(blockType)
            thenGenNode.load(blocks.then)
            elseGenNode.load(blocks.else)
        } else {
            const block = g.if(blockType)
            thenGenNode.load(block)
        }
        g.popLocation()
    }

    simplify(): GenNode {
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
        return new IfThenGenNode(this.location, this.type, conditionSimple, thenSimple, elseSimple)
    }
}

export class LoopGenNode extends LoadonlyGenNode implements GenNode {
    location: Locatable
    type: GenType;
    nodes: GenNode[]
    branchLabel: Label

    constructor(location: Locatable, type: GenType, nodes: GenNode[], branchLabel: Label) {
        super(location)
        this.location = location
        this.type = type
        this.nodes = nodes
        this.branchLabel = branchLabel
    }

    load(g: Generate): void {
        g.pushLocation(this.location?.start, this.location?.end)
        const loopBlock = g.loop(0x40, this.branchLabel)
        for (const node of this.nodes) {
            g.pushLocation(node.location?.start, node.location?.end)
            node.load(loopBlock)
            g.popLocation()
        }
        g.popLocation()
    }

    reference(location: Locatable): GenNode {
        return new LoopGenNode(location, this.type, this.nodes, this.branchLabel)
    }

    simplify(): GenNode {
        const nodes = this.nodes
        const simple = simplified(nodes)
        if (simple === nodes)
            return this
        return new LoopGenNode(this.location, this.type, simple, this.branchLabel)
    }
}

export class BodyGenNode extends LoadonlyGenNode implements GenNode {
    location: Locatable
    type: GenType
    nodes: GenNode[]

    constructor(location: Locatable, type: GenType, nodes: GenNode[]) {
        super(location)
        this.location = location
        this.type = type
        this.nodes = nodes
    }

    load(g: Generate): void {
        g.pushLocation(this.location?.start, this.location?.end)
        for (const symbol of this.nodes) {
            g.pushLocation(symbol.location?.start, symbol.location?.end)
            symbol.load(g)
            g.popLocation()
        }
        g.popLocation()
    }

    reference(location: Locatable): GenNode {
        return new BodyGenNode(location, this.type, this.nodes)
    }

    simplify(): GenNode {
        const nodes = this.nodes
        const simple =  simplified(nodes)
        if (simple.length == 1) return simple[0]
        if (nodes === simple)
            return this
        return new BodyGenNode(this.location, this.type, simple)
    }
}

export class BlockGenNode extends LoadonlyGenNode implements GenNode {
    location: Locatable
    type: GenType
    nodes: GenNode[]
    label: Label

    constructor(location: Locatable, type: GenType, symbols: GenNode[], label: Label) {
        super(location)
        this.location = location
        this.type = type
        this.nodes = symbols
        this.label = label
    }

    load(g: Generate): void {
        g.pushLocation(this.location?.start, this.location?.end)
        const type = this.type
        const blockType = type.parts.piece ?? 0x40
        const body = g.block(blockType, this.label)
        for (const symbol of this.nodes) {
            g.pushLocation(symbol.location?.start, this.location?.end)
            symbol.load(body)
            g.popLocation()
        }
        g.popLocation()
    }

    reference(location: Locatable): GenNode {
        return new BlockGenNode(location, this.type, this.nodes, this.label)
    }

    simplify(): GenNode {
        const nodes = this.nodes
        const simple = simplified(nodes)
        if (simple.length == 1 && !this.label.referenced) return simple[0].reference(this.location)
        if (nodes === simple)
            return this
        return new BlockGenNode(this.location, this.type, simple, this.label)
    }
}

export class FunctionGenNode extends LoadonlyGenNode implements GenNode {
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

    reference(location: Locatable): GenNode {
        return new FunctionGenNode(location, this.type, this.funcIndex)
    }

    simplify(): GenNode {
        return this
    }

    call(args: GenNode[], location?: Locatable): GenNode {
        return new CallGenNode(location ?? this.location, this.type, this.funcIndex, args)
    }
}

class ScaledOffsetGenNode extends LoadonlyGenNode implements GenNode {
    location: Locatable
    type = i32GenType
    base: GenNode
    i: GenNode
    scale: GenNode

    constructor(location: Locatable, base: GenNode, index: GenNode, scale: GenNode) {
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

    reference(location: Locatable): GenNode {
        return new ScaledOffsetGenNode(location, this.base, this.i, this.scale)
    }

    simplify(): GenNode {
        const base = this.base.simplify()
        const i = this.i.simplify()
        const scale = this.scale.simplify()

        const baseNumber = base.number()
        const iNumber = i.number()
        const scaleNumber = scale.number()
        if (baseNumber !== undefined && iNumber !== undefined && scaleNumber != undefined) {
            return new NumberConstGenNode(this.location, i32GenType, baseNumber + scaleNumber * iNumber)
        }
        if (iNumber !== undefined && scaleNumber != undefined) {
            return new OpGenNode(
                this.location, i32GenType,
                this.base,
                new NumberConstGenNode(this.location, i32GenType, scaleNumber * iNumber),
                LastKind.Add
            )
        }
        if (this.base === base && this.i === i && this.scale === scale)
            return this
        return new ScaledOffsetGenNode(this.location, base, i, scale)
    }
}

export class DataGenNode implements GenNode {
    location: Locatable
    type: GenType
    address: GenNode

    constructor(location: Locatable, type: GenType, address: GenNode) {
        this.location = location
        this.type = type
        this.address = address
    }

    load(g: Generate): void {
        const address = this.address.number()
        if (address !== undefined)
            this.type.loadData(this.location, g, zeroGenNode, address)
        else
            this.type.loadData(this.location, g, this.address, 0)
    }

    pop(g: Generate): void {
        const address = this.address.number()
        if (address !== undefined)
            this.type.popToData(this.location, g, zeroGenNode, address)
        else
            this.type.popToData(this.location, g, this.address, 0)
    }

    store(value: GenNode, g: Generate): void {
        const address = this.address.number()
        if (address !== undefined)
            this.type.storeData(this.location, g, zeroGenNode, value, address)
        else
            this.type.storeData(this.location, g, this.address, value, 0)
    }

    storeTo(symbol: GenNode, g: Generate): void {
        symbol.store(this, g)
    }

    addr(g: Generate): void {
        this.address.load(g)
    }

    call(args: GenNode[], location?: Locatable): GenNode {
        unsupported(location ?? this.location)
    }

    select(index: number): GenNode {
        const {type, offset} = this.type.select(this.location, index)
        const offsetAddress = new OpGenNode(
            this.location,
            i32GenType,
            this.address,
            new NumberConstGenNode(this.location, i32GenType, offset),
            LastKind.Add
        )
        return new DataGenNode(this.location, type, offsetAddress)
    }

    index(index: GenNode): GenNode {
        const element = this.type.index(this.location)
        const size = element.size
        const sizeGenNode = new NumberConstGenNode(this.location, i32GenType, size)
        const offsetAddress = new ScaledOffsetGenNode(this.location, this.address, index, sizeGenNode)
        return new DataGenNode(this.location, element, offsetAddress)
    }

    reference(location: Locatable): GenNode {
        return new DataGenNode(location, this.type, this.address)
    }

    addressOf(): GenNode {
        return this.address
    }

    simplify(): GenNode {
        const address = this.address
        const newAddress = address.simplify()
        if (address !== newAddress) {
            return new DataGenNode(this.location, this.type, newAddress)
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

export class MemoryGenNode extends LoadonlyGenNode implements GenNode {
    type = memoryGenType

    load(g: Generate) { }

    reference(location: Locatable): GenNode {
        return this
    }

    simplify(): GenNode {
        return this
    }
}

export class DropGenNode extends LoadonlyGenNode implements GenNode {
    location: Locatable
    type = voidGenType
    target: GenNode
    dropType: GenType

    constructor(location: Locatable, type: GenType, target: GenNode) {
        super(location)
        this.location = location
        this.dropType = type
        this.target = target
    }

    load(g: Generate) {
        this.target.load(g)
        this.dropType.drop(this.location, g)
    }

    reference(location: Locatable): GenNode {
        return new DropGenNode(location, this.type, this.target)
    }

    simplify(): GenNode {
        const target = this.target.simplify()
        if (target !== this.target)
            return new DropGenNode(this.location, this.dropType, target)
        return this
    }
}
