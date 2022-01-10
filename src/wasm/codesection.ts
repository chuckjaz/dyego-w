import { ByteWriter } from "./bytewriter";
import { Mapping } from "./codeblock";
import { Section, writeSized } from "./section";
import { SectionIndex, ValueType } from "./wasm";

interface Code {
    locals: ValueType[];
    expr: ByteWriter;
    mappings?: Mapping[]
}

export class CodeSection implements Section {
    private codes: Code[] = [];

    get index(): SectionIndex { return SectionIndex.Code }

    allocate(locals: ValueType[], expr: ByteWriter, mappings?: Mapping[]) {
        this.codes.push({ locals, expr, mappings });
    }

    mappings(): Mapping[] {
        const result: Mapping[] = []
        for (const code of this.codes) {
            const mappings = code.mappings
            if (mappings) {
                result.push(...mappings)
            }
        }
        result.sort((a, b) => a.offset - b.offset)
        return dedup(result)
    }

    empty(): boolean {
        return this.codes.length === 0;
    }

    write(writer: ByteWriter): void {
        const base = writer.current
        writer.writeByte(SectionIndex.Code);
        const codes = this.codes;
        const offsets: number[] = [];
        const contentBase = writeSized(writer, writer => {
            writer.write32u(codes.length);
            for (const code of codes) {
                offsets.push(writeCode(writer, code));
            }
        });

        codes.forEach((code, index) => {
            const mappings = code.mappings;
            if (mappings) {
                const offset = offsets[index] + contentBase;
                for (const mapping of mappings) {
                    mapping.offset += offset
                }
            }
        })
    }
}

function writeCode(writer: ByteWriter, code: Code): number {
    const compressedVector: {local: ValueType, count: number}[] = [];
    let last = -1;
    let lastType: ValueType = -1;
    for (const local of code.locals) {
        if (local == lastType) {
            compressedVector[last].count++
        } else {
            last = compressedVector.length
            lastType = local
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
    const result = writer.current
    writer.write(code.expr);
    return result;
}

function dedup(mappings: Mapping[]): Mapping[] {
    let i = 1;
    let c = 0
    let l = mappings.length
    while (i < l) {
        if (mappings[i].location.start !== mappings[c].location.start) {
            const d = c + 1
            if (d != i) {
                mappings[d] = mappings[i]
            }
            c++;
        }
        i++
    }
    mappings.length = c + 1
    return mappings
}