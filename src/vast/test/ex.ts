import * as files from '../../files'
import * as fs from 'fs'
import * as last from '../../last'

import { wsm } from './wsm'

export function ex(lastModule: last.Module, fileSet: files.FileSet, block: (exports: any) => void) {
    const bytes = wsm(lastModule, fileSet)
    fs.writeFileSync("out/tmp.wasm", bytes)

    expect(WebAssembly.validate(bytes)).toBeTrue()
    const module = new WebAssembly.Module(bytes)
    const inst = new WebAssembly.Instance(module)
    block(inst.exports)
}
