import { writeFileSync } from "fs"
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
    it("can call a built in member", () => {
        cg("export fun sqrt(a: Double): Double = a.sqrt()", exports => {
            const val = exports.sqrt(64)
            expect(val).toBe(8)
        })
    })
    it("can generate an if statement", () => {
        cg("export fun min(a: Double, b: Double): Double = if (a > b) b else a", exports => {
            const val = exports.min(72, 42)
            expect(val).toBe(42)
        })
    })
    it("can assign a variable", () => {
        cg(`
          export fun test(): Boolean {
              var i: Int = 0;
              i = i + 1;
              i == 1;
          }
        `, exports => {
            expect(exports.test()).toBeTruthy()
        })
    })
    it("can generate a while loop", () => {
        cg(`
            export fun test(): Int {
                var i: Int = 0;
                var sum: Int = 0;
                while (i < 10) {
                    sum = sum + i;
                    i = i + 1;
                }
                sum
            }
        `, exports => {
            expect(exports.test()).toBe(45)
        })
    })
    it("can declare globals", () => {
        cg(`
            var d: Int = 42;
            export fun test(): Int {
                d;
            }
        `, exports => {
            expect(exports.test()).toBe(42);
        })
    })
    it("can declare a global that requires init", () => {
        cg(`
            var a: Int = 12;
            var b: Int = 30;
            var c: Int = a + b;
            export fun test(): Int {
                c;
            }
        `, exports => {
            expect(exports.test()).toBe(42)
        })
    })
    it("can declare a global initalized array", () => {
        cg(`
            var values: Int[] = [1, 2, 3, 4, 5];

            export fun test(): Int {
                var i: Int = 0;
                var sum: Int = 0;
                while (i < 5) {
                    sum = sum + values[i]
                    i = i + 1
                }
                sum;
            }
        `, exports => {
            expect(exports.test()).toBe(15)
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
    writeFileSync("out/tmp.wasm", bytes)
    expect(WebAssembly.validate(bytes)).toBeTrue();
    const mod = new WebAssembly.Module(bytes);
    const inst = new WebAssembly.Instance(mod);
    cb(inst.exports)
}
