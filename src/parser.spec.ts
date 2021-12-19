import * as fs from 'fs'
import { parse } from './parser'

describe("parser", () => {
    describe("examples", () => {
        it("can parse n-body", () => {
            p("n-body.dgw")
        })

        it("can parse binary-trees", () => {
            p("binary-trees.dgw")
        })

        it("can parse address", () => {
            p("address.dgw")
        })

        it("can parse atoi", () => {
            p("atoi.dgw")
        })

        function p(name: string) {
            const text = fs.readFileSync(`examples/${name}`, 'utf-8')
            try {
                const tree = parse(text);
                expect(tree).not.toBeUndefined();
            } catch(e: any) {
                if (e.position !== undefined) {
                    const { line, column } = lcOf(text, e.position);
                    throw Error(`${name}:${line}:${column}: ${e.message}\n${e.stack}`);
                }
            }
        }
    })
})

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