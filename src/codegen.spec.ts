import { Scope } from "./ast"
import { codegen } from "./codegen"
import { parse } from "./parser"
import { typeCheck } from "./typecheck"
import { Type } from "./types"
import { ByteWriter } from "./wasm/bytewriter"
import { Module } from "./wasm/module"

describe("codegen", () => {
    it("can create add function", () => {
        cg("export fun add(a: Int, b: Int): Int = a + b", exports => {
            const val = exports.add(30, 12);
            expect(val).toBe(42);
        })
    })
})

function cg(text: string, cb: (exports: any) => void): any {
    const program = parse(text)
    const scope = new Scope<Type>()
    const types = typeCheck(scope, program)
    const module = new Module()
    codegen(program, types, module)
    const writer = new ByteWriter()
    module.write(writer) 
    const bytes = writer.extract()
    expect(WebAssembly.validate(bytes)).toBeTrue();
    const mod = new WebAssembly.Module(bytes);
    const inst = new WebAssembly.Instance(mod);
    cb(inst.exports)
}