import { ByteWriter } from "./bytewriter";
import { Section, writeSized } from "./section";
import { MemIndex, SectionIndex } from "./wasm";

export const enum DataMode {
    Active = 0x00,
    Passive = 0x01,
    ActiveMemory = 0x02,
}

interface PassiveData {
    mode: DataMode.Passive;
    bytes: ByteWriter;
}

interface ActiveData {
    mode: DataMode.Active;
    bytes: ByteWriter;
    expr: ByteWriter;
}

interface ActiveMemoryData {
    mode: DataMode.ActiveMemory;
    bytes: ByteWriter;
    expr: ByteWriter;
    memindex: MemIndex;
}

type Data = PassiveData | ActiveData | ActiveMemoryData;

export class DataSection implements Section {
    private datas: Data[] = [];

    allocatePassive(bytes: ByteWriter) {
        this.datas.push({ mode: DataMode.Passive, bytes });
    }

    allocateActive(bytes: ByteWriter, expr: ByteWriter) {
        this.datas.push({ mode: DataMode.Active, bytes, expr });
    }

    allocateActiveMemory(bytes: ByteWriter, expr: ByteWriter, memindex: MemIndex) {
        this.datas.push({ mode: DataMode.ActiveMemory, bytes, expr, memindex });
    }

    get index(): SectionIndex { return SectionIndex.Data }

    empty(): boolean {
        return this.datas.length === 0;
    }

    get segments(): number {
        return this.datas.length;
    }

    write(writer: ByteWriter): void {
        writer.writeByte(SectionIndex.Data);
        writeSized(writer, writer => {
            const datas = this.datas;
            writer.write32u(datas.length);
            for (const data of datas) {
                writeData(writer, data);
            }
        });
    }
}

function writeData(writer: ByteWriter, data: Data) {
    writer.writeByte(data.mode);
    switch (data.mode) {
        case DataMode.ActiveMemory:
            writer.write32u(data.memindex);
            // fallthrough
        case DataMode.Active:
            writer.write(data.expr);
            break;
    }
    writer.write32u(data.bytes.current);
    writer.write(data.bytes);
}