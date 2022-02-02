import * as fs from "fs"

export function readLine(): string | undefined {
    let buffer = Buffer.alloc(16)
    let offset = 0
    let result = ""
    while (true) {
        if (buffer.length == offset) {
            const newBuffer = Buffer.alloc(buffer.length + buffer.length / 2)
            buffer.copy(newBuffer, 0, 0, buffer.length)
            buffer = newBuffer
        }
        if (fs.readSync(0, buffer, offset, 1, null) != 1) {
            return undefined
        }
        if (buffer[offset] == 10) {
            result = buffer.slice(0, offset).toString('utf-8')
            break
        }
        offset++
    }
    return result
}