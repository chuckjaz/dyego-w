import { ByteWriter } from "./bytewriter";
import { DataSection } from "./datasection";
import { Section, writeSized } from "./section";
import { SectionIndex } from "./wasm";

export class DataCountSection implements Section {
    count: number | DataSection;

    constructor(count: number | DataSection) {
        this.count = count;
    }

    get index(): SectionIndex { return SectionIndex.DataCount }

    empty(): boolean {
        return false;
    }

    write(writer: ByteWriter): void {
        writer.write32u(SectionIndex.DataCount);
        const countProvider = this.count
        const count = typeof countProvider == "number" ? countProvider : countProvider.size
        writeSized(writer, writer => writer.write32u(count));
    }
}
