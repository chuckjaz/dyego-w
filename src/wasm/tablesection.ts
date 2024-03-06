import { ByteWriter } from "./bytewriter";
import { writeLimits } from "./memorySection";
import { Section, writeSized } from "./section";
import { Limits, ReferenceType, SectionIndex, TableIndex, TableType } from "./wasm";

export class TableSection implements Section {
    private offset: number;
    private tables: TableType[] = [];

    constructor(offset: number) {
        this.offset = offset;
    }

    allocate(ref: ReferenceType, lim: Limits): TableIndex {
        const tables = this.tables;
        const index = this.offset + tables.length;
        tables.push({ ref, lim })
        return index;
    }

    get index(): SectionIndex { return SectionIndex.Table }

    empty(): boolean {
        return this.tables.length == 0;
    }

    write(writer: ByteWriter): void {
        writer.writeByte(SectionIndex.Table);
        writeSized(writer, writer => {
            const tables = this.tables;
            writer.write32u(tables.length);
            for (const table of tables) {
                writeTableType(writer, table);
            }
        });
    }
}

function writeTableType(writer: ByteWriter, table: TableType) {
    writer.write32u(table.ref);
    writeLimits(writer, table.lim);
}