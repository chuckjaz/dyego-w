import { ByteWriter } from "./bytewriter";
import { Section, writeSized } from "./section";
import { FuncIndex, SectionIndex, TypeIndex } from "./wasm";

export class FunctionSection implements Section {
    private offset: number;
    private funcs: TypeIndex[] = [];

    constructor(offset: number) {
        this.offset = offset;
    }

    get index(): SectionIndex { return SectionIndex.Function }

    empty(): boolean {
        return this.funcs.length == 0;
    }

    allocate(type: TypeIndex): FuncIndex {
        const funcs = this.funcs
        const result = this.offset + funcs.length;
        funcs.push(type);
        return result;
    }

    write(writer: ByteWriter) {
        writer.writeByte(SectionIndex.Function);
        writeSized(writer, writer => {
            const funcs = this.funcs;
            writer.write32u(funcs.length);
            writer.write32us(funcs)
        });
    }
}
