import { ByteWriter } from "./bytewriter";
import { Section, writeSized } from "./section";
import { GlobalIndex, Mut, SectionIndex, ValueType } from "./wasm";

interface GlobalLocation {
    type: ValueType;
    mut: Mut;
    expr: ByteWriter;
}

export class GlobalSection implements Section {
    private offset: number;
    private globals: GlobalLocation[] = []

    constructor(offset: number) {
        this.offset = offset;
    }

    allocate(type: ValueType, mut: Mut, expr: ByteWriter): GlobalIndex {
        const globals = this.globals;
        const result = this.offset + globals.length;
        globals.push({ type, mut, expr });
        return result;
    }

    get index(): SectionIndex { return SectionIndex.Global }

    empty(): boolean {
        return this.globals.length === 0;
    }

    write(writer: ByteWriter): void {
        writer.writeByte(SectionIndex.Global);
        writeSized(writer, writer => {
            const globals = this.globals;
            writer.write32u(globals.length);
            for (const location of globals) {
                writeGlobalLocation(writer, location);
            }
        });
    }
}

function writeGlobalLocation(writer: ByteWriter, location: GlobalLocation) {
    writer.writeByte(location.type);
    writer.writeByte(location.mut);
    writer.write(location.expr);
}