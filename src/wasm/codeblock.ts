import { ByteWriter } from "./bytewriter";
import { BlockType, FuncIndex, Inst, LabelIndex, LocalIndex, TableIndex, TypeIndex, ValueType } from "./wasm";

export abstract class Label { 
    private _brand: undefined;
    abstract resolved(): LabelIndex;
}

export interface CodeBlock {
    label: Label;
    body: Generate;
}

export interface Generate {
    inst(instruction: number): void;
    prefixInst(instruction: number): void;
    vectorInst(instruction: number): void;

    index(index: number): void;
    number(value: bigint): void;
    float32(value: number): void;
    float64(value: number): void
    memarg(align: number, offset: number): void;
    byte(value: number): void;

    label(): Label
    block(type: BlockType, label?: Label): CodeBlock;
    loop(type: BlockType, label?: Label): CodeBlock;

    br(label: Label): void;
    br_if(label: Label): void;
    table(label: Label[], elseLabel: Label): void;
    if(type: BlockType, label?: Label): { thenBlock: CodeBlock, elseBlock: CodeBlock };

    call(func: FuncIndex): void;
    callIndirect(type: TypeIndex, index: TableIndex): void;
    return(): void;

    local(type: ValueType): LocalIndex;
    release(index: LocalIndex): void;
    currentLocals(): ValueType[];

    done(): void

    write(writer: ByteWriter): void;
}

class LabelImpl extends Label {
    index: LabelIndex | undefined;
    assigned: boolean = false;

    constructor() {
        super();
    }

    size(): number {
        const index = this.index;
        if (index === undefined)
            return 4;
        else return bytesOf(index);
    }

    override resolved(): LabelIndex {
        const result = this.index;
        if (result === undefined) {
            throw new Error("Unresolved label");
        }
        if (!this.assigned) {
            throw new Error("Label was never assigned");
        }
        return result;
    }

    assign() { this.assigned = true; }
    resolve(index: LabelIndex) { this.index = index; }

    write(writer: ByteWriter) {
        const index = this.index;
        if (!this.assigned || index === undefined) {
            error("Label was not resolved correctly")
        }
        writer.write32u(index);
    }
}

class LocalsDelegate {
    locals: Locals;

    constructor(locals: Locals) {
        this.locals = locals;
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
}

class BasicBlock extends LocalsDelegate {
    block = new ByteWriter(64);
    isDone: boolean = false;
    label: LabelImpl;

    constructor(locals: Locals, label: LabelImpl) {
        super(locals);
        this.label = label;
        label.assign()
    }

    size(): number {
        return this.block.current;
    }

    inst(instruction: number) {
        this.check();
        this.block.writeByte(instruction);
    }

    prefixInst(instuction: number) {
        this.check();
        const block = this.block;
        block.writeByte(Inst.Extended);
        block.write32u(instuction);
    }

    vectorInst(instruction: number) {
        this.check();
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

    done() {
        this.isDone = true
    }

    write(writer: ByteWriter) {
        writer.write(this.block);
    }

    place(index: number) {
        this.label.resolve(index);
    }

    private check() {
        if (this.isDone) error("done() has already been called")
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

    write(writer: ByteWriter) {
        const expected = writer.current + this.size();
        writer.writeByte(this.inst);
        this.label.write(writer);
        while (writer.current < expected) {
            writer.writeByte(Inst.Nop)
        }
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

    write(writer: ByteWriter) {
        const expected = writer.current + this.size();
        writer.writeByte(Inst.Br_table);
        writer.write32u(this.branches.length);
        for (const label of this.branches) {
            label.write(writer);
        }
        this.elseBranch.write(writer);
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
    write(writer: ByteWriter) {
        writer.writeByte(Inst.End)
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
        const result = allocated.length
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

class GenerateImpl extends LocalsDelegate implements Generate {
    isDone = false;
    private current: BasicBlock;
    private blocks: GeneratedBlock[] = [];
    private tail: GeneratedBlock | undefined;

    constructor(locals: Locals, label: LabelImpl, tail?: GeneratedBlock) {
        super(locals);
        const current = new BasicBlock(locals, label);
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

    label(): Label {
        return new LabelImpl;
    }

    block(type: BlockType, label?: Label): CodeBlock {
        return this.newBlock(Inst.Block, type, label)
    }

    loop(type: BlockType, label?: Label): CodeBlock {
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

    if(type: BlockType, label?: Label): { thenBlock: CodeBlock; elseBlock: CodeBlock; } {
        const thenLabel = labelOf(label);
        const elseLabel = new LabelImpl();
        const elseBlock = new GenerateImpl(this.locals, elseLabel, new End());
        elseBlock.current.inst(Inst.Else);
        const thenBlock = new GenerateImpl(this.locals, thenLabel, elseBlock);
        thenBlock.current.inst(Inst.If);
        thenBlock.current.block.write128s(BigInt(type));
        return {
            thenBlock: {
                label: thenLabel,
                body: thenBlock,
            },
            elseBlock: {
                label: elseLabel,
                body: elseBlock
            }
        };
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

    done(): void {
        if (!this.isDone) {
            const blocks = this.blocks;
            this.current.done();
            const tail = this.tail;
            if (tail) {
                tail.done();
                blocks.push(tail);
            }
            if (blocks.some(it => !it.isDone)) {
                error("Not all blocks are complete")
            }
            this.isDone = true;
        }
    }

    place(index: number) {
        let current = index;
        for (const block of this.blocks) {
            block.place(index);
            current += block.size();
        }
    }

    write(writer: ByteWriter) {
        if (!this.isDone) {
            error("Block is not done.")
        }
        for (const block of this.blocks) {
            block.write(writer);
        }
    }

    private advance(block: GeneratedBlock) {
        const blocks = this.blocks;
        this.check()
        const current = this.current;
        current.done();
        const newCurrent = new BasicBlock(this.locals, new LabelImpl());
        blocks.push(block);
        blocks.push(newCurrent);
        this.current = newCurrent;
    }

    private newBlock(inst: number, type: BlockType, label?: Label): CodeBlock {
        this.check();
        const blockLabel = labelOf(label);
        const newBlock = new GenerateImpl(this.locals, blockLabel, new End());
        newBlock.inst(inst);
        newBlock.current.block.write128s(BigInt(type));
        this.advance(newBlock);
        return { label: blockLabel, body: newBlock }
    }

    private branch(inst: number, label: LabelImpl) {
        const branch = new Branch(inst, label);
        this.advance(branch);
    }

    private branchTable(labels: LabelImpl[], elseBranch: LabelImpl) {
        const table = new BranchTable(labels, elseBranch);
        this.advance(table);
    }

    private check() {
        if (this.isDone) error("done() has already been called.")
    }
}

class RootGenerator extends GenerateImpl {
    constructor() {
        super(new Locals(), new LabelImpl())
    }
    
    write(writer: ByteWriter): void {
        if (!this.isDone) {
            error("Generator is not done.")
        }

        let size = this.size();
        while(true) {
            this.place(0);
            const newSize = this.size();
            if (newSize < size) continue;
            break;
        }

        super.write(writer);
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
    return new RootGenerator();
}

export function label(): Label {
    return new LabelImpl()
}