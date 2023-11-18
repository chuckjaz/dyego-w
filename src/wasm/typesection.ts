import { ByteWriter } from './bytewriter';
import { Section, writeSized } from './section';
import { FunctionType, NumberType, ReferenceType, ResultType, SectionIndex, TypeIndex, ValueType } from './wasm';

export class TypeSection implements Section {
    private types: FunctionType[] = []
    private map: Map<string, TypeIndex> = new Map()

    get index(): SectionIndex { return SectionIndex.Type }

    empty(): boolean {
        return this.types.length == 0;
    }

    funtionType(type: FunctionType): TypeIndex {
        const key = functionTypeToString(type);
        return this.map.get(key) ?? this.newIndex(key, type);
    }

    write(writer: ByteWriter) {
        writer.writeByte(SectionIndex.Type);
        writeSized(writer, writer => {
            const types = this.types;
            writer.write32u(types.length);
            for (const type of types) {
                writeFunctionType(writer, type)
            }
        });
    }

    private newIndex(key: string, type: FunctionType): TypeIndex {
        const map = this.map;
        const types = this.types
        const index = types.length;
        map.set(key, index);
        types.push(type);
        return index;
    }
}

function functionTypeToString(type: FunctionType) {
    return `${resultTypeToString(type.parameters)}->${resultTypeToString(type.result)}`;
}

function resultTypeToString(type: ResultType): string {
    return type.map(valueTypeToString).join(",");
}

function valueTypeToString(type: ValueType): string {
    switch (type) {
        case NumberType.i32: return "i32";
        case NumberType.i64: return "i64";
        case NumberType.f32: return "f32";
        case NumberType.f64: return "f64";
        case ReferenceType.externref: "xr";
        case ReferenceType.funcref: "fr";
    }
    error(`Unknown value type`);
}

function writeFunctionType(writer: ByteWriter, type: FunctionType) {
    writer.writeByte(0x60)
    writeResultType(writer, type.parameters)
    writeResultType(writer, type.result)
}

function writeResultType(writer: ByteWriter, type: ResultType) {
    writer.write32u(type.length)
    writer.writeBytes(type)
}

function error(message: string): never {
    throw new Error(message);
}