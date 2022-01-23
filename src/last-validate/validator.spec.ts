import * as fs from 'fs'
import { FileSet } from '../files'
import { Diagnostic, Module } from '../last'
import { parse, Scanner } from '../last-parser'
import { validate } from './validator'

describe("validator", () => {
    describe("examples", () => {
        it('can validate address.last.dg', () => {
            ve('last/address.last.dg')
        })
        it('can validate atoi.last.dg', () => {
            ve('last/atoi.last.dg')
        })
        it('can validate binary-trees.last.dg', () => {
            ve('last/binary-trees.last.dg')
        })
        it('can validate n-body.last.dg', () => {
            ve('last/n-body.last.dg')
        })
    })
})

function ve(name: string) {
    const text = fs.readFileSync(`examples/${name}`, 'utf-8')
    v(text, name)
}

function v(text: string, name: string = "<text>") {
    const fileSet = new FileSet()
    const module = p(text, name)
    const diagnostics = validate(module)
    if (diagnostics.length > 0) report(text, name, diagnostics, fileSet)
}

function report(text: string, name: string, diagnostics: Diagnostic[], fileSet: FileSet | undefined): never {
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
        report(text, name, module, fileSet)
    }
    return module
}
