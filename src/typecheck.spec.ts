import * as fs from 'fs'
import { Scope } from './ast'
import { parse } from './parser'
import { typeCheck } from './typecheck'
import { Type } from './types'

describe("typecheck", () => {
    it("can type check example", () => {
        const text = fs.readFileSync('examples/n-body.dgw', 'utf-8')
        const program = parse(text)
        expect(program).not.toBeUndefined()
        const scope = new Scope<Type>()
        typeCheck(scope, program)
    })

    it("can type check a simple expression", () => {
        tc("fun add(a: Int, b: Int): Int = a + b")
    })
    it("can call a built in method", () => {
        tc("fun sqrt(a: Double): Double = a.sqrt()")
    })
    it("can use an if statement", () => {
        tc("fun min(a: Double, b: Double): Double = if (a > b) b else a")
    })
})

function tc(text: string) {
    const program = parse(text)
    expect(program).not.toBeUndefined()
    const scope = new Scope<Type>()
    typeCheck(scope, program)
}