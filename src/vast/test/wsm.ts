import * as files from '../../files'
import * as last from '../../last'
import * as lastWasm from '../../last-wasm'
import * as wasm from '../../wasm'

import { report } from './report'

export function wsm(module: last.Module, fileSet: files.FileSet): Uint8Array  {
    const checkResult = last.check(module)
    if (Array.isArray(checkResult)) {
        report("last check", checkResult, fileSet)
    }
    const wasmModule = new wasm.Module()
    lastWasm.codegen(module, checkResult, wasmModule)
    const writer = new wasm.ByteWriter()
    wasmModule.write(writer)
    return writer.extract()
}

