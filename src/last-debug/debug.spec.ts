import * as fs from 'fs'
import { FileSet } from '../files'
import { check, Diagnostic, Module } from '../last'
import { validate } from '../last-validate'
import { transform } from './debug'
import { ByteWriter, Module as WasmModule } from '../wasm'
import { codegen } from '../last-wasm'
import { parse, Scanner } from '../last-parser'

describe("debug", () => {
    describe("examples", () => {
        describe('address.last.dg', () => {
            it('can trace test1', () => {
                const l = txe("last/address.last.dg", ({test1}) => {
                    test1()
                })
                expect(summarize(l)).toEqual('vNlast/address.last.dg:L17C8C27vL1C1L2C5L3L4L5C9L6C13L7L8L5C9L6C13L7L8L5C9L6C13L7L8L5C9L6C13L7L8L5C9L6C13L7L8L5C9L6C13L7L8L5C9L11C5^L1C1^L17C8')
            })
            it('can trace test2', () => {
                const l = txe("last/address.last.dg", ({test2}) => {
                    test2()
                })
                expect(summarize(l)).toEqual('vNlast/address.last.dg:L18C8C27vL1C1L2C5L3L4L5C9L6C13L7L8L5C9L6C13L7L8L5C9L6C13L7L8L5C9L11C5^L1C1^L18C8')
            })
            it('can trace test3', () => {
                const l = txe("last/address.last.dg", ({test3}) => {
                    test3()
                })
                expect(summarize(l)).toEqual('vNlast/address.last.dg:L19C8L20C5L21L22L23L24C9L25C13vL1C1L2C5L3L4L5C9L6C13L7L8L5C9L6C13L7L8L5C9L6C13L7L8L5C9L6C13L7L8L5C9L6C13L7L8L5C9L6C13L7L8L5C9L11C5^L1C1L26C13L27L24C9L25C13vL1C1L2C5L3L4L5C9L6C13L7L8L5C9L6C13L7L8L5C9L6C13L7L8L5C9L6C13L7L8L5C9L6C13L7L8L5C9L11C5^L1C1L26C13L27L24C9L25C13vL1C1L2C5L3L4L5C9L6C13L7L8L5C9L6C13L7L8L5C9L6C13L7L8L5C9L6C13L7L8L5C9L11C5^L1C1L26C13L27L24C9L25C13vL1C1L2C5L3L4L5C9L6C13L7L8L5C9L6C13L7L8L5C9L6C13L7L8L5C9L11C5^L1C1L26C13L27L24C9L25C13vL1C1L2C5L3L4L5C9L6C13L7L8L5C9L6C13L7L8L5C9L11C5^L1C1L26C13L27L24C9L25C13vL1C1L2C5L3L4L5C9L6C13L7L8L5C9L11C5^L1C1L26C13L27L24C9L30C5^L19C8')
            })
        })
        it('can trace binary-trees.last.dg', () => {
            const l = txe('last/binary-trees.last.dg', ({work}) => {
                work(1, 3)
            })
            expect(summarize(l)).toEqual("vNlast/binary-trees.last.dg:L39C8L40C5L41L42L43C9L44C13vL35C8L36C5C20vL35C8L36C5C20vL35C8L36C5C20vL35C8L36C5L37C10vL6C1L7C5L8L11C9L12L13L16L18C5L19L20^L6C1^L35C8vL36C5L37C10vL6C1L7C5L8L11C9L12L13L16L18C5L19L20^L6C1^L35C8vL6C1L7C5L8L11C9L12L13L16L18C5L19L20^L6C1^L35C8vL36C5C20vL35C8L36C5L37C10vL6C1L7C5L8L11C9L12L13L16L18C5L19L20^L6C1^L35C8vL36C5L37C10vL6C1L7C5L8L11C9L12L13L16L18C5L19L20^L6C1^L35C8vL6C1L7C5L8L11C9L12L13L16L18C5L19L20^L6C1^L35C8vL6C1L7C5L8L11C9L12L13L16L18C5L19L20^L6C1^L35C8vL36C5C20vL35C8L36C5C20vL35C8L36C5L37C10vL6C1L7C5L8L11C9L12L13L16L18C5L19L20^L6C1^L35C8vL36C5L37C10vL6C1L7C5L8L11C9L12L13L16L18C5L19L20^L6C1^L35C8vL6C1L7C5L8L11C9L12L13L16L18C5L19L20^L6C1^L35C8vL36C5C20vL35C8L36C5L37C10vL6C1L7C5L8L11C9L12L13L16L18C5L19L20^L6C1^L35C8vL36C5L37C10vL6C1L7C5L8L11C9L12L13L16L18C5L19L20^L6C1^L35C8vL6C1L7C5L8L11C9L12L13L16L18C5L19L20^L6C1^L35C8vL6C1L7C5L8L11C9L12L13L16L18C5L19L20^L6C1^L35C8vL6C1L7C5L8L11C9L12L13L16L18C5L19L20^L6C1^L35C8L45C13vL32C8L33C5C35vL32C8L33C5C35vL32C8L33C5C35vL32C8L33C5C28^L32C8vL33C5C28^L32C8^vL33C5C35vL32C8L33C5C28^L32C8vL33C5C28^L32C8^^vL33C5C35vL32C8L33C5C35vL32C8L33C5C28^L32C8vL33C5C28^L32C8^vL33C5C35vL32C8L33C5C28^L32C8vL33C5C28^L32C8^^^L46C13vL23C8L24C5^L23C8L47C13L48L43C9L51C5^L39C8")
        })
    })
})

function txe(name: string, cb: (exports: any) => void): Instruction[] {
    const text = fs.readFileSync(`examples/${name}`, 'utf8')
    return tx(text, name, cb)
}

function v(module: Module, fileSet: FileSet): Module {
    let diagnostics = validate(module)
    if (diagnostics.length > 0) report(diagnostics, fileSet)
    return module
}

interface Instruction {
    location: string
    inst: string
}

function tx(text: string, name: string = "<text>", cb: (exports: any) => void): Instruction[] {
    const fileSet = new FileSet()
    const module = v(p(text, name, fileSet), fileSet)
    const debugModule = v(transform(module), fileSet)
    const checkResult = check(debugModule)
    if (Array.isArray(checkResult)) report(checkResult, fileSet)

    const wasmModule = new WasmModule()

    codegen(debugModule, checkResult, wasmModule)
    const writer = new ByteWriter()
    wasmModule.write(writer)
    const bytes = writer.extract()
    fs.writeFileSync("out/tmp.wasm", bytes)

    const mod = new WebAssembly.Module(bytes);
    const results: Instruction[] = []


    function record(inst: string, start: number) {
        const pos = fileSet.position({ start })
        results.push( { location: pos?.display() ?? `$start`, inst })
    }

    const inst = new WebAssembly.Instance(mod, {
        'debug-host': {
            functionStart: function(loc: number) { record("start", loc) },
            functionEnd: function(loc: number) { record("end", loc) },
            statement: function(loc: number) { record("statement", loc) }
        }
    });
    cb(inst.exports)
    return results
}

function summarize(instructions: Instruction[]): string {
    let prevLine = ""
    let prevColumn = ""
    let prevName = ""
    let result = ""
    for (const instruction of instructions) {
        const [name, line, column] = instruction.location.split(':')
        switch (instruction.inst) {
            case "start": result += "v"; break
            case "end": result += "^"; break
        }
        if (prevName != name) {
            result += `N${name}:`
            prevName = name
        }
        if (prevLine != line) {
            result += `L${line}`
            prevLine = line
        }
        if (prevColumn != column) {
            result += `C${column}`
            prevColumn = column
        }
    }
    return result
}

function report(diagnostics: Diagnostic[], fileSet: FileSet | undefined): never {
    const messages: string[] = []
    for (const diagnostic of diagnostics) {
        if (diagnostic.location.start) {
            const position = fileSet?.position(diagnostic.location)?.display() ?? diagnostic.location.start
            messages.push(`${position}: ${diagnostic.message}`);
        } else {
            messages.push(diagnostic.message)
        }
    }
    throw new Error(messages.join("\n"))
}

function p(text: string, name: string = "<text>", fileSet: FileSet | undefined = undefined): Module {
    const builder = fileSet?.buildFile(name, text.length)
    const scanner = new Scanner(text + "\0", builder)
    const module = parse(scanner, builder)
    builder?.build()
    if (Array.isArray(module)) {
        report(module, fileSet)
    }
    return module
}
