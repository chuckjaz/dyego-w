import { FileSet } from "../../files"
import { Diagnostic } from "../../last"
import { Expression, Module, Statement } from "../ast"
import { parse } from "../parser/parser"
import { Scanner } from "../parser/scanner"
import { check } from "./check"
import { Type, TypeKind } from "./types"
import * as fs from 'fs'

describe("module", () => {
    it("can type check an empty module", () => {
        tcm("")
    })
})

describe("literal", () => {
    it("can type check an i8", () => {
        expr("1t", TypeKind.I8)
    })
    it("can type check an i16", () => {
        expr("1s", TypeKind.I16)
    })
    it("can type check an i32", () => {
        expr("1", TypeKind.I32)
    })
    it("can type check an i64", () => {
        expr("1l", TypeKind.I64)
    })
    it("can type check an u8", () => {
        expr("1ut", TypeKind.U8)
    })
    it("can type check an u16", () => {
        expr("1us", TypeKind.U16)
    })
    it("can type check an u32", () => {
        expr("1u", TypeKind.U32)
    })
    it("can type check an u64", () => {
        expr("1ul", TypeKind.U64)
    })
    it("can type check an f32", () => {
        expr("1.0f", TypeKind.F32)
    })
    it("can type check an f64", () => {
        expr("1.0", TypeKind.F64)
    })
    it("can type check a character", () => {
        expr("'a'", TypeKind.Char)
    })
    it("can type check a string", () => {
        expr('"abc"', TypeKind.String)
    })
})

describe("functions", () => {
    it("can check a simple function", () => {
        tcm("fun a(): i32 { 0 }")
    })
})

describe("files", () => {
    it("can check sum.vast.dg", () => {
        checkExample("sum.vast.dg")
    })
    it("can check atoi.vast.dg", () => {
        checkExample("atoi.vast.dg")
    })
    it("can check binary-tree.vast.dg", () => {
        checkExample("binary-tree.vast.dg")
    })
    it("can check n-body.vast.dg", () => {
        checkExample("n-body.vast.dg")
    })
})

function m(text: string): Module {
    const scanner = new Scanner(text)
    const { module, diagnostics } = parse(scanner)
    expect(diagnostics).toEqual([])
    return module
}

function tcm(text: string): Map<Expression | Statement, Type> {
    const module = m(text)
    const { types, diagnostics } = check(module)
    expect(diagnostics).toEqual([])
    return types
}

function tc(spec: string): Type[] {
    const { text, locations } = parseLocations(spec)
    const types = tcm(text)
    const result: Type[] = []
    for (const [node, type] of types) {
        if (node.start && locations.has(node.start)) {
            result.push(type)
        }
    }
    return result
}

function one(spec: string): Type {
    const types = tc(spec)
    if (types.length != 1) {
        throw Error("Spec error")
    }
    return types[0]
}

function k(spec: string, kind: TypeKind) {
    const t = one(spec)
    expect(t.kind).toEqual(kind)
}

function expr(expr: string, kind: TypeKind) {
    k(`val _ = ~${expr}`, kind)
}

function parseLocations(text: string): { text: string, locations: Set<number> } {
    const locations: Set<number> = new Set()
    while (true) {
        const loc = text.indexOf("~")
        if (loc != undefined && loc >= 0) {
            locations.add(loc)
        } else {
            break
        }
        text = text.slice(0, loc) + text.slice(loc + 1)
    }
    return { text, locations }
}

function checkFile(text: string, name: string = "<text>"): { module: Module, types: Map<Statement | Expression, Type> } {
    const fileSet = new FileSet()
    const builder = fileSet.buildFile(name, text.length, text)
    const scanner = new Scanner(text, builder)
    const fileInfo = builder.build()

    function checkDiagnostics(diagnostics: Diagnostic[]) {
        if (diagnostics.length > 0) {
            const messages: string[] = []
            for (const diagnostic of diagnostics) {
                const location = diagnostic.location
                if (location.start) {
                    const position = fileInfo.position(location)
                    messages.push(`${position.display()} ${diagnostic.message}`);
                } else {
                    messages.push(diagnostic.message)
                }
            }
            throw new Error("Encountered errors:\n  " + messages.join("\n  "))
        }
    }

    const { module, diagnostics: parseErrors } = parse(scanner, builder)
    checkDiagnostics(parseErrors)
    const { types, diagnostics: checkErrors } = check(module)
    checkDiagnostics(checkErrors)
    return { module, types }
}

function checkExample(name: string): { module: Module, types: Map<Statement | Expression, Type> } {
    const text = fs.readFileSync(`src/vast/examples/vast/${name}`, 'utf-8')
    return checkFile(text, name)
}
