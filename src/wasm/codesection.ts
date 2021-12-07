import { ByteWriter } from "./bytewriter";
import { Section, writeSized } from "./section";
import { SectionIndex, ValueType } from "./wasm";

interface Code {
    locals: ValueType[];
    expr: ByteWriter;
}

export class CodeSection implements Section {
    private codes: Code[] = [];

    get index(): SectionIndex { return SectionIndex.Code }
    
    allocate(locals: ValueType[], expr: ByteWriter) {
        this.codes.push({ locals, expr });
    }

    empty(): boolean {
        return this.codes.length === 0;
    }

    write(writer: ByteWriter): void {
        writer.writeByte(SectionIndex.Code);
        writeSized(writer, writer => {
            const codes = this.codes;
            writer.write32u(codes.length);
            for (const code of codes) {
                writeCode(writer, code);
            }
        });
    }
}

function writeCode(writer: ByteWriter, code: Code) {
    const compressedVector: {local: ValueType, count: number}[] = [];
    const last = -1;
    const lastType: ValueType = -1;
    for (const local of code.locals) {
        if (local == lastType) {
            compressedVector[last].count++
        } else {
            compressedVector.push({ local, count: 1 });
        }
    }
    const compressedVectorBytes = new ByteWriter(compressedVector.length * 3 + 2);
    compressedVectorBytes.write32u(compressedVector.length);
    for (const locals of compressedVector) {
        compressedVectorBytes.write32u(locals.count);
        compressedVectorBytes.writeByte(locals.local);
    }
    const size = compressedVectorBytes.current + code.expr.current;
    writer.write32u(size);
    writer.write(compressedVectorBytes);
    writer.write(code.expr);   
}