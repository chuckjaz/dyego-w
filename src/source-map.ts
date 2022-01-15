export class SourceMap {
    files: string[] = []
    mappings: Mapping[] = []
    names: string[] = []
    target: string
    sourceRoot?: string

    constructor(target: string, sourceRoot?: string) {
        this.target = target
        this.sourceRoot = sourceRoot
    }

    addFile(fileName: string): number {
        return this.files.push(fileName) - 1
    }

    addName(name: string): number {
        return this.names.push(name) - 1
    }

    addMapping(offset: number, fileIndex: number, line: number, column: number, name?: number) {
        this.mappings.push({ offset, fileIndex, line, column, name })
    }

    toMap(sourceContent?: string): string {
        const mappingArray = this.mappings.sort((a, b) => a.offset - b.offset)
        let previousOffset = 0
        let previousLine = 0
        let previousColumn = 0
        let previousFile = 0
        let prevousName = 0

        const mappings = mappingArray.map(instance => {
            const offset = instance.offset - previousOffset
            const line = (instance.line - 1) - previousLine
            const column = (instance.column - 1) - previousColumn
            const file = instance.fileIndex - previousFile
            let name: number | undefined = undefined
            const n = instance.name
            if (n) {
                name = n -prevousName
                prevousName = n
            }
            previousOffset = instance.offset
            previousLine = (instance.line - 1)
            previousColumn = (instance.column - 1)
            previousFile = instance.fileIndex

            return convertToVlq(offset) + convertToVlq(file) + convertToVlq(line) +
                convertToVlq(column) + (name === undefined ? "" : convertToVlq(name))
        }).join(",")

        const mapData: SourceMapData = {
            version: "3",
            sources: this.files,
            names: this.names,
            mappings
        }
        if (sourceContent) {
            mapData.sourceContent = sourceContent
        }
        if (this.target) mapData.file = this.target
        if (this.sourceRoot) mapData.sourceRoot = this.sourceRoot

        return JSON.stringify(mapData)
    }
}

const enum Vlq {
    BaseShift = 5,
    Base = 1 << Vlq.BaseShift,
    BaseMask = Vlq.Base - 1,
    Continuation = Vlq.Base
}

const base64Nums = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split("")

function convertToVlq(value: number): string {
    let current = value < 0 ? ((-value) << 1) | 1 : value << 1
    let result = ""
    while (true) {
        const digit = current & Vlq.BaseMask;
        result += base64Nums[current < Vlq.Base ? digit : (digit | Vlq.Continuation)];
        current >>= Vlq.BaseShift
        if (current <= 0) break
    }
    return result
}

interface SourceMapData {
    version: string
    file?: string
    sourceRoot?: string
    sources: string[]
    names: string[]
    mappings: string
    sourceContent?: string
}

interface Mapping {
    offset: number
    fileIndex: number,
    line: number
    column: number
    name?: number
}