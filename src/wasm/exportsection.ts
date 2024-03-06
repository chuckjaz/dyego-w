import { ByteWriter } from "./bytewriter";
import { Section, writeSized } from "./section";
import { SectionIndex } from "./wasm";

export const enum ExportKind {
    Func = 0x00,
    Table = 0x01,
    Mem = 0x02,
    Global = 0x03,
}

interface Export {
    name: string;
    kind: ExportKind;
    index: number;
}

export class ExportSection implements Section {
    private exports: Export[] = [];

    allocate(name: string, kind: ExportKind, index: number) {
        this.exports.push({ name, kind, index });
    }

    get index(): SectionIndex { return SectionIndex.Export }

    empty(): boolean {
        return this.exports.length === 0;
    }

    write(writer: ByteWriter): void {
        writer.writeByte(SectionIndex.Export);
        writeSized(writer, writer => {
            const exports = this.exports;
            writer.write32u(exports.length);
            for (const exp of exports) {
                writeExport(writer, exp);
            }
        });
    }
}

function writeExport(writer: ByteWriter, exp: Export) {
    writer.writeName(exp.name);
    writer.writeByte(exp.kind);
    writer.write32u(exp.index);
}