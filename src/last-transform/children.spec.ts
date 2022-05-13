import * as fs from 'fs'
import { FileSet } from '../files'
import { Diagnostic, Last, LastKind, Module } from "../last"
import { parse, Scanner } from '../last-parser'
import { validate } from '../last-validate'
import { childrenOf, Separator } from './children'

describe("children", () => {
    describe("examples", () => {
        it("can iterate binary-trees.last.dg", () => {
            tf("last/binary-trees.last.dg", module => {
                // Validate counts of children
                expect(countChildrenMatching(module, node => node.kind == LastKind.Type)).toBe(1)
                expect(countChildrenMatching(module, node => node.kind == LastKind.Var)).toBe(2)
                expect(countChildrenMatching(module, node => node.kind == LastKind.Function)).toBe(1)
                expect(countChildrenMatching(module, node => node.kind == LastKind.Exported)).toBe(4)

                // Validate counts of all children
                expect(countAllMatching(module, node => node.kind == LastKind.Type)).toBe(1)
                expect(countAllMatching(module, node => node.kind == LastKind.Var)).toBe(7)
                expect(countAllMatching(module, node => node.kind == LastKind.Function)).toBe(5)
                expect(countAllMatching(module, node => node.kind == LastKind.Assign)).toBe(9)
            })
        })
    })
})

function countChildrenMatching(node: Last, predicate: (node: Last) => boolean): number {
    let result = 0
    for (const child of childrenOf(node)) {
        if (child instanceof Separator) continue
        if (predicate(child)) result++
    }
    return result
}

function countAllMatching(node: Last, predicate: (node: Last) => boolean): number {
    let result = 0
    for (const child of childrenOf(node)) {
        if (child instanceof Separator) continue
        if (predicate(child)) result++
        result += countAllMatching(child, predicate)
    }
    return result
}

function tf(name: string, cb: (module: Module) => void) {
    const text = fs.readFileSync(`examples/${name}`, 'utf8')
    tx(text, name, cb)
}

function tx(text: string, name: string = "<text>", cb: (module: Module) => void) {
    const fileSet = new FileSet()
    const module = v(p(text, name, fileSet), fileSet)
    cb(module)
}

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

function v(module: Module, fileSet: FileSet): Module {
    let diagnostics = validate(module)
    if (diagnostics.length > 0) report(diagnostics, fileSet)
    return module
}
