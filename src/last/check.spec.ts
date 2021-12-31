import { parse, Scanner } from "../last-parser"
import { Last, Module } from "./ast"
import { check } from './check'
import { Type } from "./types"
import { Diagnostic } from "./diagnostic"
import * as fs from 'fs'

describe("check", () => {
    describe("examples", () => {
        it("can check address.last.dg", () => {
            te("last/address.last.dg")
        })
        it("can check atoi.last.dg", () => {
            te("last/atoi.last.dg")
        })
        it("can check binary-trees.last.dg", () => {
            te("last/binary-trees.last.dg")
        })
        it("can check n-body.last.dg", () => {
            te("last/n-body.last.dg")
        })
    })
})

function report(text: string, name: string, diagnostics: Diagnostic[]): never {
    const messages: string[] = []
    for (const diagnostic of diagnostics) {
        const position = diagnostic.location.start
        if (position) {
            const { line, column } = lcOf(text, position);
            messages.push(`${name}:${line}:${column}: ${diagnostic.message}`);
        } else {
            messages.push(diagnostic.message)
        }
    }
    throw new Error(messages.join("\n"))
}

function p(text: string, name: string = "<text>"): Module {
    const scanner = new Scanner(text + "\0")
    const module = parse(scanner)
    if (Array.isArray(module)) {
        report(text, name, module)
    } 
    return module
}

function t(text: string, name: string = "<text>"): [Module, Map<Last, Type>] {
    const module = p(text, name)
    const types = check(module)
    if (Array.isArray(types)) {
        report(text, name, types)
    }
    return [module, types]
}

function te(name: string): [Module, Map<Last, Type>] {
    const text = fs.readFileSync(`examples/${name}`, 'utf-8')
    return t(text, name)
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