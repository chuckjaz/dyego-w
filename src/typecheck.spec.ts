import * as fs from 'fs'
import { Scope } from './ast'
import { parse } from './parser'
import { typeCheck } from './typecheck'
import { Type } from './types'

describe("typecheck", () => {
    it("can type check example", () => {
        const text = fs.readFileSync('examples/n-body.dgi', 'utf-8')
        const program = parse(text)
        expect(program).not.toBeUndefined()
        const scope = new Scope<Type>()
        typeCheck(scope, program)
    })
})