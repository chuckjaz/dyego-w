import { check } from "../utils";
import { ByteWriter } from "./bytewriter";
import { BlockType, FuncIndex, Inst, LabelIndex, LocalIndex, TableIndex, TypeIndex, ValueType } from "./wasm";

export abstract class Label {
    private _brand: undefined;

    abstract readonly referenced: boolean
    abstract reference(): void
}

export interface Mapping {
    offset: number;
    location: Location;
}

export interface Generate {
    size(): number
    inst(instruction: number): void;
    prefixInst(instruction: number): void;
    vectorInst(instruction: number): void;

    index(index: number): void;
    number(value: bigint): void;
    snumber(value: bigint): void;
    float32(value: number): void;
    float64(value: number): void
    memarg(align: number, offset: number): void;
    byte(value: number): void;

    block(type: BlockType, label?: Label): Generate
    loop(type: BlockType, label?: Label): Generate;

    br(label: Label): void;
    br_if(label: Label): void;
    table(label: Label[], elseLabel: Label): void;
    if(type: BlockType, label?: Label): Generate;
    if_else(type: BlockType, label?: Label): { then: Generate, else: Generate }

    call(func: FuncIndex): void;
    callIndirect(type: TypeIndex, index: TableIndex): void;
    return(): void;

    parameter(type: ValueType): LocalIndex;
    local(type: ValueType): LocalIndex;
    release(index: LocalIndex): void;
    currentLocals(): ValueType[];

    pushLocation(start: number | undefined, end: number | undefined): void
    popLocation(): void

    write(writer: ByteWriter, mappings?: Mapping[]): void;
}

interface WriteContext {
    writer: ByteWriter
    controlStack: GeneratedBlock[]
    mappings?: Mapping[]
}

let labelId = 0

class LabelImpl extends Label {
    private id = labelId++
    index: LabelIndex | undefined;
    bound: GeneratedBlock | undefined;
    referenced: boolean = false;

    constructor() {
        super();
    }

    size(): number { return 1 }

    bind(bound: GeneratedBlock) {
        if (this.bound) error("Label was bound twice")
        this.bound = bound
    }

    reference() {
        this.referenced = true
    }

    writeTo(context: WriteContext) {
        const bound = this.bound
        if (!bound) error("Label was not bound")
        const index = context.controlStack.indexOf(bound)
        if (index < 0) error("Label was not in context")
        if (!this.referenced) error("Label written but was not marked as referenced")
        context.writer.write32u(index);
    }
}

interface Location {
    start?: number
    end?: number
}

class LocationStack {
    stack: Location[] = []

    pushLocation(start?: number, end?: number) {
        this.stack.push({ start, end })
    }

    popLocation() {
        const stack = this.stack
        check(stack.length > 0)
        const removed = stack.pop()
        if (stack.length > 0) {
            const l = stack.length - 1
            const last = stack[stack.length - 1]
            if (removed?.end && last.start && last.start < removed.end) {
                stack[l] = { start: removed.end, end: last.end }
            }
        }
    }

    top(): Location {
        const stack = this.stack
        let start: number | undefined = undefined
        let end: number | undefined = undefined
        for (let i = stack.length - 1; i >= 0; i--) {
            const loc = stack[i]
            start = start ?? loc.start
            end = end ?? loc.end
            if (start === undefined && end === end) break
        }
        return { start, end };
    }
}

class Delegate {
    locals: Locals;
    stack: LocationStack

    constructor(locals: Locals, stack: LocationStack) {
        this.locals = locals;
        this.stack = stack;
    }

    parameter(type: ValueType): LocalIndex {
        return this.locals.parameter(type);
    }

    local(type: ValueType): LocalIndex {
        return this.locals.local(type);
    }

    release(index: LocalIndex): void {
        this.locals.release(index);
    }

    currentLocals(): ValueType[] {
        return this.locals.currentLocals()
    }

    pushLocation(start: number | undefined, end: number | undefined) {
        return this.stack.pushLocation(start, end)
    }

    popLocation() {
        this.stack.popLocation()
    }
}

class BasicBlock extends Delegate {
    block = new ByteWriter(32);
    isDone: boolean = false;
    location: Location | undefined;
    mappings: Mapping[] = [];

    constructor(locals: Locals, stack: LocationStack) {
        super(locals, stack);
    }

    size(): number {
        return this.block.current;
    }

    inst(instruction: number) {
        this.updateLocation();
        this.block.writeByte(instruction);
    }

    prefixInst(instuction: number) {
        this.updateLocation();
        const block = this.block;
        block.writeByte(Inst.Extended);
        block.write32u(instuction);
    }

    vectorInst(instruction: number) {
        this.updateLocation();
        const block = this.block;
        block.writeByte(Inst.Vector);
        block.write32u(instruction);
    }

    index(index: number): void {
        this.block.write32u(index);
    }

    number(value: bigint): void {
        this.block.write128u(value);
    }

    snumber(value: bigint): void {
        this.block.write128s(value);
    }

    float32(value: number): void {
        const b = new Float32Array(1);
        b[0] = value;
        const bs = new Uint8Array(b.buffer);
        this.block.writeByteArray(bs);
    }

    float64(value: number): void {
        const b = new Float64Array(1);
        b[0] = value;
        const bs = new Uint8Array(b.buffer);
        this.block.writeByteArray(bs);
    }

    memarg(align: number, offset: number): void {
        this.block.write32us([align, offset]);
    }

    byte(value: number): void {
        this.block.writeByte(value);
    }

    writeTo(context: WriteContext) {
        const location = this.location
        const mappings = context.mappings
        if (location && mappings) {
            const offset = context.writer.current;
            for (const mapping of this.mappings) {
                mappings.push({ offset: offset + mapping.offset, location: mapping.location })
            }
        }
        context.writer.write(this.block);
    }

    private updateLocation() {
        let location = this.stack.top();
        const previous = this.location
        if (location && previous !== location) {
            if (previous) {
                const newStart = location.start
                const newEnd = location.end
                const previousStart = previous.start
                const previousEnd = previous.end
                if (
                    newStart === undefined || newEnd === undefined ||
                    previousStart === undefined || previousEnd === undefined
                ) return
                if (newStart < previousStart && previousEnd < newEnd) {
                    location = { start: previousEnd, end: newEnd }
                }
            }

            if (!previous || previous.start != location.start) {
                this.mappings.push({ offset: this.block.current, location });
            }
            this.location = location;
        }
    }
}

class Branch {
    isDone = true;
    inst: number;
    label: LabelImpl;

    constructor (inst: number, label: LabelImpl) {
        this.inst = inst;
        this.label = label;
    }

    size(): number {
        return 1 + this.label.size();
    }

    done() { }

    place(index: number) { }

    writeTo(context: WriteContext) {
        const writer = context.writer
        writer.writeByte(this.inst);
        this.label.writeTo(context);
    }
}

class BranchTable {
    isDone = true;
    private branches: LabelImpl[];
    private elseBranch: LabelImpl;
    constructor(branches: LabelImpl[], elseBranch: LabelImpl) {
        this.branches = branches;
        this.elseBranch = elseBranch;
    }

    size(): number {
        const branches = this.branches;
        return 1 + bytesOf(branches.length) + branches.reduce((p, l) => p + l.size(), 0) +
            this.elseBranch.size();
    }

    done() { }

    place(index: number) { }

    writeTo(context: WriteContext) {
        const writer = context.writer
        const expected = writer.current + this.size();
        writer.writeByte(Inst.Br_table);
        writer.write32u(this.branches.length);
        for (const label of this.branches) {
            label.writeTo(context);
        }
        this.elseBranch.writeTo(context);
        while (writer.current < expected) {
            writer.writeByte(Inst.Nop)
        }
    }
}


class End {
    isDone = true;
    size(): number { return 1 }
    done() { }
    place(index: number) { }
    writeTo(context: WriteContext) {
        context.writer.writeByte(Inst.End)
    }
}

function bytesOf(value: number): number {
    if (value <= 0x7F) return 1;
    if (value <= 0x7F * 0x7F) return 2;
    if (value <= 0x7F * 0x7F * 0x7F) return 3;
    return 4;
}

class Locals {
    allocated: ValueType[] = []
    released: { type: ValueType, index: LocalIndex }[] = []
    offset: number = 0

    parameter(type: ValueType): LocalIndex {
        return this.offset++
    }

    local(type: ValueType): LocalIndex {
        const released = this.released
        const len = released.length
        for (let i = 0; i < len; i++) {
            const r = released[i]
            if (r.type == type) {
                released.splice(i, 1);
                return r.index
            }
        }
        const allocated = this.allocated
        const result = allocated.length + this.offset
        allocated.push(type)
        return result
    }

    release(index: LocalIndex) {
        const allocated = this.allocated
        this.released.push({ type: allocated[index], index })
    }

    currentLocals(): ValueType[] {
        return this.allocated.slice(0)
    }
}

type GeneratedBlock = GenerateImpl | BasicBlock | Branch | BranchTable | End;

let genId = 0

class GenerateImpl extends Delegate implements Generate {
    private id = genId++
    private current: BasicBlock;
    private blocks: GeneratedBlock[] = [];
    private tail: GeneratedBlock | undefined;

    constructor(locals: Locals, stack: LocationStack, label: LabelImpl, tail?: GeneratedBlock) {
        super(locals, stack);
        label.bind(this)
        const current = new BasicBlock(locals, stack);
        this.current = current;
        this.blocks.push(current);
        this.tail = tail;
    }

    size(): number {
        return this.blocks.reduce((p, c) => p + c.size(), 0);
    }

    inst(instruction: number): void {
        this.current.inst(instruction);
    }

    prefixInst(instruction: number): void {
        this.current.prefixInst(instruction);
    }

    vectorInst(instruction: number): void {
        this.current.vectorInst(instruction);
    }

    index(index: number): void {
        this.current.index(index);
    }

    number(value: bigint): void {
        this.current.number(value);
    }

    snumber(value: bigint): void {
        this.current.snumber(value)
    }

    float32(value: number): void {
        this.current.float32(value);
    }

    float64(value: number): void {
        this.current.float64(value);
    }

    memarg(align: number, offset: number): void {
        this.current.memarg(align, offset);
    }

    byte(value: number): void {
        this.current.byte(value);
    }

    block(type: BlockType, label?: Label): Generate {
        return this.newBlock(Inst.Block, type, label)
    }

    loop(type: BlockType, label?: Label): Generate {
        return this.newBlock(Inst.Loop, type, label);
    }

    br(label: Label): void {
        this.branch(Inst.Br, implOf(label))
    }

    br_if(label: Label): void {
        this.branch(Inst.Br_if, implOf(label))
    }

    table(labels: Label[], elseBranch: Label) {
        const ls = labels.map(implOf);
        const el = implOf(elseBranch);
        this.branchTable(ls, el);
    }

    if(type: BlockType, label?: Label): Generate {
        const thenBlock = new GenerateImpl(this.locals, this.stack, labelOf(label), new End())
        thenBlock.inst(Inst.If)
        thenBlock.index(type)
        this.advance(thenBlock)
        return thenBlock
    }

    if_else(type: BlockType, label?: Label): { then: Generate; else: Generate } {
        const thenBlock = new GenerateImpl(this.locals, this.stack, labelOf(label))
        thenBlock.inst(Inst.If)
        thenBlock.index(type)
        this.advance(thenBlock)
        const elseBlock = new GenerateImpl(this.locals, this.stack, new LabelImpl(), new End())
        elseBlock.inst(Inst.Else)
        this.advance(elseBlock)
        return { then: thenBlock, else: elseBlock }
    }

    call(func: FuncIndex): void {
        const current = this.current;
        current.inst(Inst.Call);
        current.block.write32u(func);
    }

    callIndirect(type: number, index: number): void {
        const current = this.current;
        current.inst(Inst.Call_indirect);
        current.block.write32us([type, index]);
    }

    return(): void {
        this.current.inst(Inst.Return);
    }

    write(writer: ByteWriter, mappings?: Mapping[]) {
        this.writeTo({ writer, controlStack: [this], mappings })
    }

    writeTo(context: WriteContext) {
        const nestedBlock = {
            writer: context.writer,
            controlStack: [this, ...context.controlStack],
            mappings: context.mappings
        }
        for (const block of this.blocks) {
            block.writeTo(nestedBlock)
        }
        const tail = this.tail
        if (tail) tail.writeTo(nestedBlock)
    }

    private advance(block: GeneratedBlock) {
        const blocks = this.blocks;
        const current = this.current;
        const newCurrent = new BasicBlock(this.locals, this.stack);
        blocks.push(block);
        blocks.push(newCurrent);
        this.current = newCurrent;
    }

    private newBlock(inst: number, type: BlockType, label?: Label): Generate {
        const blockLabel = labelOf(label);
        const newBlock = new GenerateImpl(this.locals, this.stack, blockLabel, new End());
        newBlock.inst(inst);
        newBlock.current.block.write32u(type);
        this.advance(newBlock);
        return newBlock
    }

    private branch(inst: number, label: LabelImpl) {
        const branch = new Branch(inst, label);
        this.advance(branch);
    }

    private branchTable(labels: LabelImpl[], elseBranch: LabelImpl) {
        const table = new BranchTable(labels, elseBranch);
        this.advance(table);
    }
}


function error(message: string): never {
    throw new Error(message)
}

function implOf(label: Label): LabelImpl {
    if (label instanceof LabelImpl) return label;
    error("Unsupported label")
}

function labelOf(label: Label | undefined): LabelImpl {
    return label === undefined ? new LabelImpl() : implOf(label);
}

export function gen(): Generate {
    return new GenerateImpl(new Locals(), new LocationStack(), new LabelImpl());
}

export function label(): Label {
    return new LabelImpl()
}