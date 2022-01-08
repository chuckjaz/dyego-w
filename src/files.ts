import { Locatable } from './last'

// Position information of represented by a Locatable start/end value
export interface Position {
    fileName: string
    column: number
    line: number
    isValid: boolean
    display(): string
}

// A source file
export interface File {
    fileName: string
    size: number
    position(loc: Locatable): Position
}

// A source file builder
export interface FileBuilder {
    addLine(offset: number): void
    position(loc: Locatable): Position
    pos(offset: number): number
    build(): File
}

// A set of source files.

// A FileSet maps a single numeric value to a source file, line and column. Each file is mapped
// to a range of numbers based on the size of the file. For example, if the set contains 50 files
// each of size 1000, then 1 - 1000 will be the first file, 1001 - 2000 will be the second, etc.
// The value 0 is reserved and can be used to represent an invalid or missing position. A FileBuilder
// is used to record the position of the lines in the file. The builder is intended to used by a
// a tokenizer or scanner while it produces the tokens of a file.

export class FileSet {
    private lastBase = 1
    private bases: number[] = []
    files: File[] = []

    // Produce a source file builder for a file of size.
    buildFile(fileName: string, size: number): FileBuilder {
        const base = this.lastBase
        this.lastBase += size
        const index = this.bases.length
        this.bases.push(base)
        this.files.push(undefined as any as File)
        return new FileBuilderImpl(fileName, size, base, this, index)
    }

    // Find the source file associated with loc, if there is one.
    file(loc: Locatable): File | undefined {
        if (loc.start) {
            const index = find(this.bases, loc.start)
            return this.files[index]
        }
    }

    // Find the position associated with loc, if there is one.
    position(loc: Locatable): Position | undefined {
        if (loc.start) {
            return this.file(loc)?.position(loc)
        }
    }
}

class FileBuilderImpl implements FileBuilder {
    fileName: string
    base: number
    size: number
    lines: number[] = [0]
    fileSet: FileSet
    index: number

    constructor(fileName: string, size: number, base: number, fileSet: FileSet, index: number) {
        this.fileName = fileName
        this.size = size
        this.base = base
        this.fileSet = fileSet
        this.index = index
    }

    addLine(offset: number): void {
        if (this.lines.length == 0 || this.lines[this.lines.length-1] < offset) {
            this.lines.push(offset)
        } else {
            const index = search(this.lines, offset)
            if (index < 0) {
                this.lines.splice(-index - 1, 0, offset)
            }
        }
    }

    position(loc: Locatable) {
        const file = this.build()
        return file.position(loc)
    }

    pos(offset: number): number {
        const size = this.size
        if (offset < 0 || offset >= size)
            return -1
        return offset + this.base
    }

    build(): File {
        const file = new FileImpl(this.fileName, this.size, this.base, this.lines)
        this.fileSet.files[this.index] = file
        return file
    }
}

class PositionImpl implements Position {
    fileName: string
    line: number
    column: number
    length: number
    lineStart: number
    isValid: boolean

    constructor (
        fileName: string,
        line: number,
        lineStart: number,
        column: number,
        length: number
    ) {
        this.fileName = fileName
        this.line = line
        this.lineStart = lineStart
        this.column = column
        this.isValid = length >= 0
        this.length = length
    }

    display(): string {
        if (this.isValid)
            return `${this.fileName}:${this.line}:${this.column}`
        return "<invalid>"
    }
}

class FileImpl implements File {
    fileName: string
    size: number
    private base: number
    private lines: number[]

    constructor(fileName: string, size: number, base: number, lines: number[]) {
        this.fileName = fileName
        this.size = size
        this.base = base
        this.lines = lines
    }

    position(loc: Locatable): Position {
        const start = loc.start
        const end = loc.end
        if (start) {
            return this.positionOf(start, loc.end)
        } else {
            return new PositionImpl(this.fileName, -1, -1, -1, -1)
        }
    }

    private positionOf(start: number, end?: number): Position {
        const line = this.lineOf(start)
        if (line < 0)
            return new PositionImpl(this.fileName, line, 0, 0, -1)
        const lineStart = this.lines[line]
        const column = (start - this.base) - lineStart + 1
        return new PositionImpl(
            this.fileName,
            line + 1, lineStart,
            column,
            end ? end - start : 0
        )
    }

    private lineOf(position: number): number {
        const offset = position - this.base
        if (offset < 0 || offset >= this.size) {
            return -2
        }
        const line = find(this.lines, offset)
        const lineStart = this.lines[line]
        if (lineStart > offset) {
            if (line > 0) return line - 1
            return 0
        }
        return line
    }
}

function search(arr: number[], value: number): number {
    let start = 0
    let end = arr.length - 1
    while (start <= end) {
        const mid = (start + end) >> 1
        const v = arr[mid]
        if (value > v) {
            start = mid + 1
        } else if (value < v) {
            end = mid - 1
        } else {
            return mid
        }
    }
    return -start - 1
}

function find(arr: number[], value: number): number {
    const index = search(arr, value)
    if (index < 0) {
        const effective = -index - 1
        const len = arr.length
        if (effective >= len) {
            return len - 1
        }
        return effective
    }
    return index
}