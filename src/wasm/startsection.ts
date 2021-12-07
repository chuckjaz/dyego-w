import { ByteWriter } from "./bytewriter";
import { Section, writeSized } from "./section";
import { FuncIndex, SectionIndex } from "./wasm";

export class StartSection implements Section {
    private func: FuncIndex;

    constructor(func: FuncIndex) {
        this.func = func;
    }

    get index(): SectionIndex { return SectionIndex.Start }

    empty(): boolean {
        return false;
    }

    write(writer: ByteWriter): void {
        writer.writeByte(SectionIndex.Start);
        writeSized(writer, writer => writer.write32u(this.func));
    }
}