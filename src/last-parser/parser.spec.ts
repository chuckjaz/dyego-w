import { Scanner } from "./scanner"
import { parse } from "./parser"
import { ArrayLiteral, LastKind, Literal, Module, PrimitiveKind, TypeKind } from "../last"
import * as fs from "fs"
import { FileSet } from "../files"
import { inspect } from "util"

describe("parser", () => {
    describe("examples", () => {
        it("can parse address.last.dg", () => {
            pe("last/address.last.dg")
        })
        it("can parse atoi.last.dg", () => {
            pe("last/atoi.last.dg")
        })
        it("can parse binary-trees.last.dg", () => {
            pe("last/binary-trees.last.dg")
        })
        it("can parse n-body.last.dg", () => {
            pe("last/n-body.last.dg")
        })
    })
    describe("globals", () => {
        it("can parse a global declaration", () => {
            p("global a: i32 = 1")
        })
    })
    describe("literals", () => {
        function pl(literal: string): Literal {
            const tree = p(`var a = ${literal}`)
            if (tree.kind == LastKind.Module) {
                const decl = tree.declarations[0]
                if (decl && decl.kind == LastKind.Var && decl.value && decl.value.kind == LastKind.Literal) {
                    return decl.value
                }
            }
            throw new Error("Expected a literal")
        }
        function pa(literal: string): ArrayLiteral {
            const tree = p(`var a = ${literal}`)
            if (tree.kind == LastKind.Module) {
                const decl = tree.declarations[0]
                if (decl && decl.kind == LastKind.Var && decl.value && decl.value.kind == LastKind.ArrayLiteral) {
                    return decl.value
                }
            }
            throw new Error("Expected an array literal")
        }
        it("can parse an int", () => {
            const l = pl("12313333")
            expect(l.kind).toEqual(LastKind.Literal)
            expect(l.primitiveKind).toEqual(PrimitiveKind.I32)
            expect(l.value).toEqual(12313333)
        })
        it("can parse a float", () => {
            const l = pl("1.23")
            expect(l.kind).toEqual(LastKind.Literal)
            expect(l.primitiveKind).toEqual(PrimitiveKind.F64)
            expect(l.value).toBeCloseTo(1.23)
        })
        it("can parse a string literal", () => {
            const l = pa('"this is a literal"')
            expect(l.kind).toEqual(LastKind.ArrayLiteral)
            const values = l.values
            expect('buffer' in values).toBeTrue()
            const buffer = Buffer.from(values as Uint8Array)
            const text = buffer.toString('utf-8')
            expect(text).toEqual("this is a literal\0")
        })
    })
    describe("expressions", () => {
        describe("bitwise", () => {
            it("can parse a bitwise and", () => {
                p("var v: i32 = a & b")
            })
            it("can parse a bitwise or", () => {
                p("var v: i32 = a | b")
            })
            it("can parse a bitwise xor", () => {
                p("var v: i32 = a xor b")
            })
            it("can parse a bitwas shr", () => {
                p("var v: i32 = a shr b")
            })
            it("can parse a bitwas shl", () => {
                p("var v: i32 = a shl b")
            })
            it("can parse a bitwas ror", () => {
                p("var v: i32 = a ror b")
            })
            it("can parse a bitwas rol", () => {
                p("var v: i32 = a rol b")
            })
        })
        describe("counting", () => {
            it("can parse a counttrailingzeros", () => {
                p("var v: i32 = a counttrailingzeros")
            })
            it("can parse a countleadingzeros", () => {
                p("var v: i32 = a countleadingzeros")
            })
            it("can parse a countnonzeros", () => {
                p("var v: i32 = a countnonzeros")
            })
        })
    })
    describe("types", () => {
        function t(text: string) {
            p(`var v: ${text} = 0`);
        }
        describe("primitives", () => {
            it("can parse i8", () => { t("i8") })
            it("can parse i16", () => { t("i16") })
            it("can parse i32", () => { t("i32") })
            it("can parse i64", () => { t("i64") })
            it("can parse u8", () => { t("u8") })
            it("can parse u16", () => { t("u16") })
            it("can parse u32", () => { t("u32") })
            it("can parse u64", () => { t("u64") })
            it("can parse f32", () => { t("f32") })
            it("can parse f64", () => { t("f64") })
            it("can parse void", () => { t("void") })
        })
        describe("struct", () => {
            it("can parse struct", () => { t("<a: i32, c: i32>") })
        })
        describe("union", () => {
            it("can parse union", () => { t("<| a: i32, c: i64 |>") })
        })
        describe("func type", () => {
            it("can parse parameterless", () => t("fun (): void"))
            it("can parse parameters", () => t("fun(a: i32, b: i64): void"))
        })
    })
})

function p(text: string, name: string = "<text>"): Module {
    const fileSet = new FileSet()
    const builder = fileSet.buildFile(name, text.length)
    const scanner = new Scanner(text + "\0", builder)
    const fileInfo = builder.build()
    const moduleOrDiagnostics = parse(scanner, builder)
    if (Array.isArray(moduleOrDiagnostics)) {
        const diagnostics: string[] = []
        for (const diagnostic of moduleOrDiagnostics) {
            const location = diagnostic.location
            if (location.start) {
                const position = fileInfo.position(location)
                diagnostics.push(`${position.display()} ${diagnostic.message}`);
            } else {
                diagnostics.push(diagnostic.message)
            }
        }
        throw new Error(diagnostics.join("\n"))
    }
    return moduleOrDiagnostics
}

function pe(name: string): Module {
    const text = fs.readFileSync(`examples/${name}`, 'utf-8')
    return p(text, name)
}
