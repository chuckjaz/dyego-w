import { FileSet } from "../files"
import { check, CheckResult, Diagnostic, Module } from "../last"
import { parse, Scanner } from "../last-parser"
import { lastToText } from "../last-text/text"
import { codegen } from "../last-wasm"
import { ByteWriter, Module as WasmModule } from "../wasm"
import { transform } from "./stack-transform"
import * as fs from 'fs'

describe("stack-transform", () => {
    it("can move a addressed variable to the stack", () => {
        t(`
            fun test(): i32 {
                var t = 0;
                var p = &t;
                return p^;
            }
        `)
    })

    it("can move a parameter", () => {
        t(`
            fun w(p: i32^): void {
                p^ = 23;
            }

            fun test(a: i32): i32 {
                w(&a)
                return a
            }
        `)
    })

    it("can move a value in a return expression", () => {
        t(`
            fun w(p: u32^): i32 {
                p^ = 23u;
                return 23;
            }

            fun test(a: i32): i32 {
                return w(&a reinterpretas u32^)
            }
        `)
    })

    it("can move a not expression", () => {
        t(`
            fun w(p: i32^): void {
                p^ = 32;
            }

            fun r(v: i32): bool {
                return false
            }

            fun test(): void {
                var tmp: i32;
                w(&tmp)
                if (!(r(tmp))) {
                    tmp = tmp + 1
                }
            }
        `)
    })

    it("can generate a execute a parameter move", () => {
        cg(`
            export fun r(buffer: u8^): u8 {
                return buffer^;
            }

            export fun test(c: u8): u8 {
                return r(&c);
            }

        `, ({test}) => {
            expect(test(23)).toEqual(23)
        })
    })
})

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

function txc(module: Module, fileSet: FileSet): [Module, CheckResult] {
    const checkResult = check(module)
    const transformedModule = transform(module, checkResult)
    const transformedCheckResult = check(transformedModule)
    if (transformedCheckResult.diagnostics.length > 0) {
        const transformedText = lastToText(transformedModule)
        console.log(`tx:\n${transformedText}`)
        report(transformedCheckResult.diagnostics, fileSet)
    }
    return [transformedModule, transformedCheckResult]
}

function tx(module: Module, fileSet: FileSet): Module {
    return txc(module, fileSet)[0]
}

function t(text: string) {
    const fileSet = new FileSet()
    const module = p(text, "<text>", fileSet)
    tx(module, fileSet)
}

function cg(text: string, cb: (exports: any) => void, name: string = "<text>", imports?: WebAssembly.Imports): any {
    let fileSet = new FileSet()
    function s<T>(value: T | Diagnostic[]): T {
        if (Array.isArray(value)) report(value, fileSet)
        return value
    }

    let writer: ByteWriter
    const fileBuilder = fileSet.buildFile(name, text.length)
    const scanner = new Scanner(text + "\0", fileBuilder)
    fileBuilder.build()
    const parsedModule = s(parse(scanner, fileBuilder))
    const [module, checkResult] = txc(parsedModule, fileSet)
    if (checkResult.diagnostics.length > 0) {
        report(checkResult.diagnostics, fileSet)
    }
    const wasmModule = new WasmModule()

    codegen(module, checkResult, wasmModule, true)
    writer = new ByteWriter()
    wasmModule.write(writer)
    const bytes = writer.extract()
    fs.writeFileSync("out/tmp.wasm", bytes)

    expect(WebAssembly.validate(bytes)).toBeTrue();
    const mod = new WebAssembly.Module(bytes);
    const inst = new WebAssembly.Instance(mod, imports);
    cb(inst.exports)
}
