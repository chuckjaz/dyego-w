import { Kind, Module, Reference } from "../ast"
import { parse } from "../parser/parser"
import { Scanner } from "../parser/scanner"
import { CheckResult, check } from "../types/check"
import { createFlow } from "./flow"
import { calculateLiveness } from "./live"

describe("live", () => {
    it("simple function", () => {
        validate("fun a(b: i32): i32 { @b }")
    })
    it("binary expression", () => {
        validate("fun a(b: i32): i32 { @b @+ b }")
    })
    it("call", () => {
        validate(`
            fun a(v1: i32, v2: i32) { }
            fun b(v: i32) { @a(v1: v, v2: @v) }
        `)
    })
    it("if expression", () => {
        validate(`
            fun a(v1: i32, v2: i32) { }
            fun b(b: bool, v: i32) {
                if (@b) {
                    @a(v1: v, v2: @v)
                } else {
                    @a(v1: v, v2: @v)
                }
            }
        `)
    })
    it("when expression", () => {
        validate(`
            fun a(v1: i32, v2: i32) { }
            fun b(s: i32, v: i32) {
                when (@s) {
                    1 -> @a(v1: v, v2: @v)
                    2 -> @a(v1: v, v2: @v)
                    3 -> @a(v1: v, v2: @v)
                }
            }
        `)
    })
})

function m(text: string): Module {
    const scanner = new Scanner(text)
    const { module, diagnostics } = parse(scanner)
    expect(diagnostics).toEqual([])
    return module
}

function c(module: Module): CheckResult {
    const checkResult = check(module)
    expect(checkResult.diagnostics).toEqual([])
    return checkResult
}

function extractLasts(text: string): { text: string, locations: Set<number>} {
    let resultText = ""
    let rest = text
    const locations = new Set<number>()
    let location = rest.indexOf('@')
    while (location > 0) {
        resultText += rest.substring(0, location)
        rest = rest.substring(location + 1)
        locations.add(resultText.length)
        location = rest.indexOf('@')
    }
    return { text: resultText + rest, locations }
}

function validate(exemplar: string) {
    const { text, locations } = extractLasts(exemplar)
    const module = m(text)
    const checkResult = c(module)
    const found = new Set<number>()
    for (const item of module.declarations) {
        if (item.kind == Kind.Function) {
            const flow = createFlow(item)
            const liveResult = calculateLiveness(flow, checkResult)
            for (const reference of liveResult.last) {
                if (!locations.has(reference.start ?? -1)) {
                    error(`Last found but was not expected at ${reference.start}`)
                }
                found.add(reference.start ?? -1)
            }
        }
    }
    if (found.size != locations.size) {
        const notFound: number[] = []
        for (const location of locations) {
            if (!found.has(location))
                notFound.push(location)
        }
        error(`Location ${notFound.map(a => a.toString()).join()} was not reported as an end`)
    }
}

function error(msg: string): never {
    throw Error(msg)
}