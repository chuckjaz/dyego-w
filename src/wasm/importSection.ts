import { ByteWriter } from "./bytewriter";
import { writeLimits } from "./memorySection";
import { Section, writeSized } from "./section";
import { FuncIndex, GlobalIndex, MemIndex, MemType, Mut, SectionIndex, TableIndex, TypeIndex, ValueType } from "./wasm";

interface GlobalType {
    mut: Mut;
    type: ValueType
}

interface GlobalImport {
    module: string;
    name: string;
    item: GlobalType;
}

interface TableImport {
    module: string;
    name: string;
    item: TableIndex;
}

interface MemoryImport {
    module: string;
    name: string;
    item: MemType;
}

interface TypeImport {
    module: string;
    name: string;
    item: TypeIndex;
}

type Import<T> = { module: string; name: string; item: T };

export class ImportSection implements Section {
    private globals: GlobalImport[] = []
    private tables: TableImport[] = []
    private memories: MemoryImport[] = []
    private funcs: TypeImport[] = []
    private tablesMap: Map<string, TableIndex> = new Map()
    private memoriesMap: Map<string, MemIndex> = new Map()
    private funcsMap: Map<string, FuncIndex> = new Map()

    get globalsCount() { return this.globals.length; }
    get tablesCount() { return this.tables.length; }
    get memoriesCount() { return this.memories.length; }
    get funcsCount() { return this.funcs.length; }

    get index(): SectionIndex { return SectionIndex.Import }

    empty(): boolean {
        return this.globals.length == 0 && this.tables.length == 0 && this.memories.length == 0 &&
            this.funcs.length == 0;
    }

    importGlobal(module: string, name: string, mut: Mut, type: ValueType): GlobalIndex {
        return this.allocateSlot<GlobalType>(module, name, { type, mut }, this.globals);
    }

    importTable(module: string, name: string, index: TableIndex): TableIndex {
        return this.allocate<TableIndex>(module, name, index, numberToString, this.tables, this.tablesMap);
    }

    importMemory(module: string, name: string, memType: MemType): MemIndex {
        return this.allocate<MemType>(module, name, memType, memTypeToString, this.memories, this.memoriesMap);
    }

    importFunction(module: string, name: string, index: TypeIndex): FuncIndex {
        return this.allocate<FuncIndex>(module, name, index, numberToString, this.funcs, this.funcsMap);
    }

    write(writer: ByteWriter) {
        writer.write32u(SectionIndex.Import);
        writeSized(writer, writer => {
            writer.write32u(SectionIndex.Import);
            const globals = this.globals;
            const tables = this.tables;
            const memories = this.memories;
            const funcs = this.funcs;
            const len = globals.length + tables.length + memories.length + funcs.length;
            writer.write32u(len);
            for (const imp of globals) {
                writeGlobalImport(writer, imp);
            }
            for (const imp of tables) {
                writeImport(writer, imp);
            }
            for (const imp of memories) {
                writeMemoryImport(writer, imp);
            }
            for (const imp of funcs) {
                writeImport(writer, imp);
            }
        });
    }

    private allocate<T>(
        module: string,
        name: string,
        item: T,
        itemToString: (item: T) => string,
        a: Import<T>[],
        map: Map<string, number>
    ): number {
        const key = `${module}:${name}:${itemToString(item)}`;
        let index = map.get(key);
        if (index === undefined) {
            index = a.length;
            a.push({module, name, item});
            map.set(key, index)
        }
        return index;
    }

    private allocateSlot<T>(
        module: string,
        name: string,
        item: T,
        a: Import<T>[]
    ): number {
        const result = a.length
        a.push({ module, name, item })
        return result
    }
}

function numberToString(value: number) {
    return `${value}`
}

function memTypeToString(value: MemType) {
    return `${value.min}:${value.max ?? 'e'}`
}

function writeImport(writer: ByteWriter, imp: Import<number>) {
    writer.writeName(imp.module);
    writer.writeName(imp.name);
    writer.write32u(imp.item)
}

function writeMemoryImport(writer: ByteWriter, imp: MemoryImport) {
    writer.writeName(imp.module);
    writer.writeName(imp.name);
    writeLimits(writer, imp.item);
}

function writeGlobalImport(writer: ByteWriter, imp: GlobalImport) {
    writer.writeName(imp.module)
    writer.writeName(imp.name)
    writer.writeByte(imp.item.mut)
    writer.writeByte(imp.item.type)
}