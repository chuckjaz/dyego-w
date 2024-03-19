import * as ast from '../ast'
import * as files from '../../files'
import * as fs from 'fs'
import * as parser from '../parser'

import { report } from './report'
import { dump } from '../dump-ast'

export function m(text: string): { module: ast.Module, fileSet: files.FileSet } {
    const fileSet = new files.FileSet()
    const fileBuilder = fileSet.buildFile('<text>', text.length, text)
    const scanner = new parser.Scanner(text, fileBuilder)
    fileBuilder.build()
    const { module, diagnostics } = parser.parse(scanner)
    if (diagnostics.length) {
        report("parsing", diagnostics, fileSet)
    }
    const moduleDump = dump(module)
    fs.writeFileSync('out/tmp.ast', moduleDump)
    return { module, fileSet }
}
