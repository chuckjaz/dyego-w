import { Scanner } from "./scanner"
import { parse } from "./parser"
import { Module } from "../last"
import * as fs from "fs"

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
    const scanner = new Scanner(text + "\0")
    const moduleOrDiagnostics = parse(scanner)
    if (Array.isArray(moduleOrDiagnostics)) {
        const diagnostics: string[] = []
        for (const diagnostic of moduleOrDiagnostics) {
            const position = diagnostic.location.start
            if (position) {
                const { line, column } = lcOf(text, position);
                diagnostics.push(`${name}:${line}:${column}: ${diagnostic.message}`);
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

function lcOf(text: string, position: number): { line: number, column: number} {
    let line = 1;
    let start = 0;
    let index = 0;
    for (; index < position; index++) {
        switch(text[index]) {
            case `\r`:
                if (text[index + 1] == `\n`) index++
            case '\n':
                start = index + 1;
                line++
                break;
        }
    }
    return { line, column: index - start + 1 }
}