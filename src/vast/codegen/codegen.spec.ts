import { Module } from "../ast"
import { parse } from "../parser/parser"
import { Scanner } from "../parser/scanner"
import { CheckResult, check } from "../types/check"
import { codegen } from "./codegen"
import { FileSet } from "../../files"

import * as fs from 'fs'
import * as last from '../../last'
import * as wasm from '../../wasm'
import * as lastWasm from '../../last-wasm'

describe("codegen", () => {
    describe("expressions", () => {
        describe("i8", () => {
            function bin(text: string, a: number, b: number, e: number = 42) {
                cg(`fun Test(a: i8, b: i8): i8 { ${text} }`, (exports) => {
                    expect(exports['Test/a/b'](a, b)).toEqual(e)
                })
            }
            function bbin(text: string, a: number, b: number, e: boolean) {
                cg(`fun Test(a: i8, b: i8): bool { ${text} }`, (exports) => {
                    expect(exports['Test/a/b'](a, b)).toEqual(e ? 1 : 0)
                })
            }
            describe("numberic", () => {
                it("can add literals", () => {
                    cg(`fun Test(): i8 { 11t + 31t }`, ({Test}) => {
                        expect(Test()).toEqual(42)
                    })
                })
                it("can add", () => { bin('a + b', 11, 31) })
                it("can subtract", () => { bin('a - b', 53, 11) })
                it("can multiply", () => { bin('a * b', 21, 2) })
                it("can divide", () => { bin('a / b', 84, 2) })
                it("can modulus", () => { bin('a % b', 142, 100) })
            })
        })
        describe("i32", () => {
            function bin(text: string, a: number, b: number, e: number = 42) {
                cg(`fun Test(a: i32, b: i32): i32 { ${text} }`, (exports) => {
                    expect(exports['Test/a/b'](a, b)).toEqual(e)
                })
            }
            function bbin(text: string, a: number, b: number, e: boolean) {
                cg(`fun Test(a: i32, b: i32): bool { ${text} }`, (exports) => {
                    expect(exports['Test/a/b'](a, b)).toEqual(e ? 1 : 0)
                })
            }
            describe("numberic", () => {
                it("can add literals", () => {
                    cg(`fun Test(): i32 { 11 + 31 }`, ({Test}) => {
                        expect(Test()).toEqual(42)
                    })
                })
                it("can add", () => { bin('a + b', 11, 31) })
                it("can subtract", () => { bin('a - b', 53, 11) })
                it("can multiply", () => { bin('a * b', 21, 2) })
                it("can divide", () => { bin('a / b', 84, 2) })
                it("can modulus", () => { bin('a % b', 142, 100) })
            })
            describe("bitwise", () => {
                it("can bit or", () => { bin('a or b', 32, 10) })
                it("can bit and", () => { bin('a and b', 43, 254) })
                it("can bit shl", () => { bin('a shl b', 21, 1) })
                it("can bit shr", () => { bin('a shr b', 84, 1) })
                it("can bit ror", () => {
                    function ror(a: number, b: number): number {
                        let r = a
                        for (let i = 0; i < b; i++) {
                            if (r & 1) r = (1 << 31) | (r >> 1)
                            else r = r >> 1
                        }
                        return r
                    }
                    bin('a ror b', 23, 3, ror(23, 3))
                })
                it("can bit rol", () => {
                    function rol(a: number, b: number): number {
                        let r = a
                        for (let i = 0; i < b; i++) {
                            if (r & (1 << 31)) r = (r << 1) | 1
                            else r = r << 1
                        }
                        return r
                    }
                    bin('a rol b', 23, 3, rol(23, 3))
                })
            })
            describe("equatable", () => {
                it("can equal", () => { bbin('a == b', 10, 12, false) })
                it("can not equal", () => { bbin('a != b', 10, 12, true) })
            })
            describe("comparable", () => {
                it("can compare >", () => { bbin('a > b', 10, 12, false) })
                it("can compare <", () => { bbin('a < b', 10, 12, true) })
                it("can compare >=", () => { bbin('a >= b', 10, 12, false) })
                it("can compare <=", () => { bbin('a <= b', 10, 12, true) })
            })
        })
    })
})

function m(text: string): { module: Module, fileSet: FileSet } {
    const fileSet = new FileSet()
    const fileBuilder = fileSet.buildFile('<text>', text.length, text)
    const scanner = new Scanner(text, fileBuilder)
    fileBuilder.build()
    const { module, diagnostics } = parse(scanner)
    if (diagnostics.length) {
        report(diagnostics, fileSet)
    }
    return { module, fileSet }
}

function report(diagnostics: last.Diagnostic[], fileSet: FileSet): never {
    const messages: string[] = []
    for (const diagnostic of diagnostics) {
        const location = diagnostic.location
        if (location.start) {
            const position = fileSet.position(location)
            messages.push(`${position?.display()}: ${diagnostic.message}`);
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

function ck(module: Module, fileSet: FileSet): CheckResult {
    const checkResult = check(module)
    if (checkResult.diagnostics.length) {
        report(checkResult.diagnostics, fileSet)
    }
    expect(checkResult.diagnostics).toEqual([])
    return checkResult
}

function cgv(text: string): last.Module {
    const { module, fileSet } = m(text)
    const checkResult = ck(module, fileSet)
    return codegen(module, checkResult)
}

function wsm(module: last.Module): Uint8Array  {
    const checkResult = last.check(module)
    if (Array.isArray(checkResult)) {
        expect(checkResult).toEqual([])
        throw Error("check errors")
    }
    const wasmModule = new wasm.Module()
    lastWasm.codegen(module, checkResult, wasmModule)
    const writer = new wasm.ByteWriter()
    wasmModule.write(writer)
    return writer.extract()
}

function cg(text: string, block: (exports: any) => void) {
    const lastModule = cgv(text)
    const bytes = wsm(lastModule)
    fs.writeFileSync("out/tmp.wasm", bytes)

    expect(WebAssembly.validate(bytes)).toBeTrue()
    const module = new WebAssembly.Module(bytes)
    const inst = new WebAssembly.Instance(module)
    block(inst.exports)
}
