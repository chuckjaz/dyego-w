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
