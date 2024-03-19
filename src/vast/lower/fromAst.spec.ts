import * as ast from '../ast'
import * as ir from './ir'
import * as last from '../../last'

import { FileSet } from '../../files'
import { parse } from '../parser/parser'
import { Scanner } from '../parser/scanner'
import { check } from '../types/check'
import { fromAst } from './fromAst'
import { dumpIr } from './util'

describe("ir", () => {
    describe("fromAst", () => {
        it("can convert an empty module", () => {
            const module = cv("")
            expect(module).not.toBeUndefined()
        })
        it("can convert a function", () => {
            const module = cv(`
                fun test(): i32 { 23 }
            `)
            expect(module).not.toBeUndefined()
            expect(module.functions.length).toEqual(1)
        })
        it("can convert an array literal", () => {
            const module = cv(`
                val a = [ 10, 20 ]
            `)
            expect(module).not.toBeUndefined()
        })
        it("can convert an binary expression", () => {
            const module = cv(`
                fun Test(a: i32, b: i32): i32 {
                    a + b
                }
            `)
            expect(module).not.toBeUndefined()
            const text = dumpIr(module)
            expect(text).toContain("infix +")
        })
    })
})

function cv(text: string): ir.Module {
    const { module: astModule, fileSet } = m(text)
    const checkResult = check(astModule)
    if (checkResult.diagnostics.length) {
        report("check", checkResult.diagnostics, fileSet)
    }
    const irModule = fromAst(astModule, checkResult)
    return irModule
}

function m(text: string): { module: ast.Module, fileSet: FileSet } {
    const fileSet = new FileSet()
    const fileBuilder = fileSet.buildFile('<text>', text.length, text)
    const scanner = new Scanner(text, fileBuilder)
    fileBuilder.build()
    const { module, diagnostics } = parse(scanner)
    if (diagnostics.length) {
        report("parsing", diagnostics, fileSet)
    }
    return { module, fileSet }
}

function report(phase: string, diagnostics: last.Diagnostic[], fileSet: FileSet): never {
    const messages: string[] = []
    for (const diagnostic of diagnostics) {
        const location = diagnostic.location
        if (location.start) {
            const position = fileSet.position(location)
            messages.push(`${position?.display()}, ${phase}: ${diagnostic.message}`);
            if (position) {
                const file = fileSet.file(location)
                const line = '  ' + file?.lineText(position.line, position.line + 1)
                if (line) {
                    messages.push('\n' + line)
                    messages.push('^'.padStart(position.column + 3))
                }
            }
        } else {
            messages.push(diagnostic.message)
        }
    }
    throw new Error(messages.join("\n"))
}
