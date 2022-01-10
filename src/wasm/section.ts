import { ByteWriter } from "./bytewriter";
import { SectionIndex } from "./wasm";

export interface Section {
    index: SectionIndex;
    empty(): boolean;
    write(writer: ByteWriter): void;
}

export function writeSized(writer: ByteWriter, cb: (writer: ByteWriter) => void): number {
    const content = new ByteWriter();
    cb(content);
    writer.write32u(content.current);
    const result = writer.current;
    writer.write(content);
    return result;
}