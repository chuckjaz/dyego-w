import * as fs from 'fs'
import { parse } from './parser'

describe("parser", () => {
    describe("literals", () => {
        it("can parse an i8", () => {
            l("1t")
        })

        it("can parse an i16", () => {
            l("1s")
        })

        it("can parse an i32", () => {
            l("1")
        })

        it("can parse an i64", () => {
            l("1l")
        })

        it("can parse an u8", () => {
            l("1ut")
        })

        it("can parse an u16", () => {
            l("1us")
        })

        it("can parse an u32", () => {
            l("1u")
        })

        it("can parse an u64", () => {
            l("1ul")
        })

        it("can parse a boolean", () => {
            l("true")
            l("false")
        })

        it("can parse null", () => {
            l("null")
        })

        function l(text: string) {
            parse(`let a = ${text}; fun b(): any { ${text} }`)
        }
    })
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