import * as fs from 'fs'
import { parse } from './parser'

describe("parser", () => {
    it("can parse example", () => {
        const text = fs.readFileSync('examples/n-body.dgw', 'utf-8')
        const tree = parse(text)
        expect(tree).not.toBeUndefined()
    })
})