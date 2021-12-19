import * as fs from 'fs'
import { Scope } from './ast'
import { parse } from './parser'
import { typeCheck } from './typecheck'
import { Type } from './types'

describe("typecheck", () => {
    describe("examples", () => {
        it("can type check n-body", () => {
            tcf("n-body.dgw")
        })
        it("can type check binary-trees", () => {
            tcf("binary-trees.dgw")
        })
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

function tc(text: string, name: string = "<text>") {
    try {
        const program = parse(text)
        expect(program).not.toBeUndefined()
        const scope = new Scope<Type>()
        typeCheck(scope, program)
    } catch(e: any) {
        const position = e.position ?? e.start
        if (position !== undefined) {
            const { line, column } = lcOf(text, position);
            throw Error(`${name}:${line}:${column}: ${e.message}\n${e.stack}`);
        }
        throw e
    }
}

function tcf(name: string) {
    const text = fs.readFileSync(`examples/${name}`, 'utf-8')
    tc(text, name)
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