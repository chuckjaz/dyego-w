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
            p("global a: Int = 1")
        })
    })
    describe("expressions", () => {
        describe("bitwise", () => {
            it("can parse a bitwise and", () => {
                p("var v: Int = a & b")
            })
            it("can parse a bitwise or", () => {
                p("var v: Int = a | b")
            })
            it("can parse a bitwise xor", () => {
                p("var v: Int = a xor b")
            })
            it("can parse a bitwas shr", () => {
                p("var v: Int = a shr b")
            })
            it("can parse a bitwas shl", () => {
                p("var v: Int = a shl b")
            })
            it("can parse a bitwas ror", () => {
                p("var v: Int = a ror b")
            })
            it("can parse a bitwas rol", () => {
                p("var v: Int = a rol b")
            })
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
