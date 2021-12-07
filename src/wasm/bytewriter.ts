import * as leb128 from './leb128'

export class ByteWriter {
    private bytes: Uint8Array
    private _current: number

    constructor(init: number | Uint8Array = 1024, current?: number) {
        this.bytes = typeof init === "number" ? new Uint8Array(init) : init;
        this._current = current ?? 0
    }

    get current(): number {
        return this._current;
    }

    writeByte(byte: number) {
        this.ensure(1)
        this.bytes[this._current++] = byte & 0xFF
    }

    writeBytes(bytes: number[]) {
        this.ensure(bytes.length)
        const b = this.bytes
        let current = this._current
        for (const byte of bytes) {
            b[current++] = byte & 0xFF;
        }
        this._current = current
    }

    writeByteArray(bytes: Uint8Array) {
        this.ensure(bytes.length)
        const b = this.bytes
        let current = this._current
        for (const byte of bytes) {
            b[current++] = byte;
        }
        this._current = current
    }

    write32u(value: number) {
        this.write128u(BigInt(value))
    }

    write32us(values: number[]) {
        this.ensure(values.length);
        let limit = this.bytes.length;
        let current = this._current;
        let bytes = this.bytes;
        for (const value of values) {
            if (value < 0x7F && current < limit) {
                bytes[current++] = value;
            } else {
                this._current = current;
                this.write32u(value);
                current = this._current;
                bytes = this.bytes;
                limit = bytes.length;
            }
        }
        this._current = current
    }

    write128s(value: bigint) {
        this.ensure(7)
        this._current += leb128.writeSigned(this.bytes, this._current, value)
    }

    write128u(value: bigint) {
        this.ensure(7)
        this._current += leb128.writeUnsigned(this.bytes, this._current, value)
    }

    writeName(name: string) {
        const nameBytes = this.encoder.encode(name);
        const l = nameBytes.length
        this.write32u(l)
        this.ensure(nameBytes.length);
        const bytes = this.bytes
        let current = this._current
        for (const b of nameBytes) {
            bytes[current++] = b
        }
        this._current = current
    }

    write(writer: ByteWriter) {
        const size = writer._current;
        const current = this._current;
        this.ensure(size);
        const bytes = this.bytes;
        const source = writer.bytes;
        for (let i = 0, j = current; i < size; i++, j++) {
            bytes[j] = source[i];
        }
        this._current += size;
    }

    extract(): Uint8Array {
        return this.bytes.slice(0, this._current)
    }

    private encoder = new TextEncoder();

    private ensure(count: number) {
        const bytes = this.bytes;
        const size = bytes.length;
        const needed = this.current + count;
        if (needed < size) return
        let newSize = size * 2;
        while (newSize < needed) {
            newSize *= 2;
        }
        const newBytes = new Uint8Array(newSize);
        for (let i = 0; i < size; i++) {
            newBytes[i] = bytes[i];
        }
        this.bytes = newBytes;
    }
}