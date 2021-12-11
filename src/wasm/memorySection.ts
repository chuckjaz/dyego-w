import { ByteWriter } from './bytewriter';
import { Section, writeSized } from './section';
import { Limits, MemIndex, MemType, SectionIndex } from './wasm';

export class MemorySection implements Section {
    private offset: number;
    private memories: MemType[] = [];

    constructor(offset: number) {
        this.offset = offset;
    }

    allocate(memtype: MemType): MemIndex {
        const memories = this.memories;
        const index = this.offset + memories.length;
        memories.push(memtype);
        return index;
    }

    get index(): SectionIndex { return SectionIndex.Memory }

    empty(): boolean {
        return this.memories.length == 0;
    }

    write(writer: ByteWriter): void {
        writer.writeByte(SectionIndex.Memory);
        writeSized(writer, writer => {
            const memories = this.memories;
            writer.write32u(memories.length);
            for (const memory of memories) {
                writeLimits(writer, memory);
            }
        });
    }
}

export function writeLimits(writer: ByteWriter, limit: Limits) {
    if (limit.max) {
        writer.write32u(1)
        writer.write32u(limit.min)
        writer.write32u(limit.max)
    } else {
        writer.write32u(0)
        writer.write32u(limit.min)
    }
}
