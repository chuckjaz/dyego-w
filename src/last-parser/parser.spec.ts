import { Scanner } from "./scanner"
import { parse } from "./parser"
import { Module } from "../last"
import * as fs from "fs"
import { FileSet } from "../files"

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
