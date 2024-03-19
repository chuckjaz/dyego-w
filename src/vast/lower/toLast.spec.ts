import * as files from '../../files'
import * as fs from 'fs'
import * as last from '../../last'
import * as lastUtil from '../../last-util'
import * as test from '../test'

import { fromAst } from './fromAst'
import { toLast } from './toLast'
import { dumpIr } from './util'
describe("toLast", () => {
    describe("function", () => {
        it("simple", () => {
            cg(`
                fun Test(): i32 {
                    42
                }
            `, ({Test}) => {
                expect(Test()).toEqual(42)
            })
        })
    })
    describe("expressions", () => {
        function infix(type: string, a: number, b: number, text: string, v: number = 42, resultType: string = type) {
            cg(`
                fun Test(a: ${type}, b: ${type}): ${resultType} {
                    ${text}
                }
            `, ({'Test/a/b': Test }) => {
                expect(Test(a, b)).toEqual(v)
            })
        }
        function prefix(type: string, a: number, text: string, v: number = 42, resultType: string = type) {
            cg(`
                fun Test(a: ${type}): ${resultType} {
                    ${text}
                }
            `, ({'Test/a': Test }) => {
                expect(Test(a)).toEqual(v)
            })
        }
        function infixn(type: string, a: bigint, b: bigint, text: string, v: bigint = 42n, resultType: string = type) {
            cg(`
                fun Test(a: ${type}, b: ${type}): ${resultType} {
                    ${text}
                }
            `, ({'Test/a/b': Test }) => {
                expect(Test(a, b)).toEqual(v)
            })
        }
        function prefixn(type: string, a: bigint, text: string, v: bigint = 42n, resultType: string = type) {
            cg(`
                fun Test(a: ${type}): ${resultType} {
                    ${text}
                }
            `, ({'Test/a': Test }) => {
                expect(Test(a)).toEqual(v)
            })
        }
        describe("numerics", () => {
            describe("i8", () => {
                function t(a: number, b: number, text: string, v: number = 42) {
                    infix("i8",  a, b, text, v)
                }
                function b(a: number, b: number, text: string, v: boolean = true) {
                    infix("i8", a, b, text, v ? 1 : 0, "bool")
                }
                function p(a: number, text: string, v: number = 42) {
                    prefix("i8", a, text, v)
                }
                describe("infix", () => {
                    it("+", () => { t(21, 21, "a + b") })
                    it("-", () => { t(48, 6, "a - b") })
                    it("*", () => { t(21, 2, "a * b") })
                    it("/", () => { t(84, 2, "a / b") })
                    it("%", () => { t(142, 100, "a % b") })
                    it(">", () => { b(30, 10, "a > b") })
                    it("<", () => { b(30, 40, "a < b") })
                    it(">=", () => { b(30, 10, "a >= b") })
                    it("<=", () => { b(30, 40, "a <= b") })
                    it("==", () => { b(30, 30, "a == b") })
                    it("!=", () => { b(30, 40, "a != b") })
                })
                describe("prefix", () => {
                    it("+", () => { p(42, "+a") })
                    it("-", () => { p(-42, "-a") })
                })
            })
            describe("i16", () => {
                function t(a: number, b: number, text: string, v: number = 42) {
                    infix("i16",  a, b, text, v)
                }
                function b(a: number, b: number, text: string, v: boolean = true) {
                    infix("i16", a, b, text, v ? 1 : 0, "bool")
                }
                function p(a: number, text: string, v: number = 42) {
                    prefix("i16", a, text, v)
                }
                describe("infix", () => {
                    it("+", () => { t(21, 21, "a + b") })
                    it("-", () => { t(48, 6, "a - b") })
                    it("*", () => { t(21, 2, "a * b") })
                    it("/", () => { t(84, 2, "a / b") })
                    it("%", () => { t(142, 100, "a % b") })
                    it(">", () => { b(30, 10, "a > b") })
                    it("<", () => { b(30, 40, "a < b") })
                    it(">=", () => { b(30, 10, "a >= b") })
                    it("<=", () => { b(30, 40, "a <= b") })
                    it("==", () => { b(30, 30, "a == b") })
                    it("!=", () => { b(30, 40, "a != b") })
                })
                describe("prefix", () => {
                    it("+", () => { p(42, "+a") })
                    it("-", () => { p(-42, "-a") })
                })
            })
            describe("i32", () => {
                function t(a: number, b: number, text: string, v: number = 42) {
                    infix("i32",  a, b, text, v)
                }
                function b(a: number, b: number, text: string, v: boolean = true) {
                    infix("i32", a, b, text, v ? 1 : 0, "bool")
                }
                function p(a: number, text: string, v: number = 42) {
                    prefix("i32", a, text, v)
                }
                describe("infix", () => {
                    it("+", () => { t(21, 21, "a + b") })
                    it("-", () => { t(48, 6, "a - b") })
                    it("*", () => { t(21, 2, "a * b") })
                    it("/", () => { t(84, 2, "a / b") })
                    it("%", () => { t(142, 100, "a % b") })
                    it(">", () => { b(30, 10, "a > b") })
                    it("<", () => { b(30, 40, "a < b") })
                    it(">=", () => { b(30, 10, "a >= b") })
                    it("<=", () => { b(30, 40, "a <= b") })
                    it("==", () => { b(30, 30, "a == b") })
                    it("!=", () => { b(30, 40, "a != b") })
                    it("and", () => { t(43, 254, "a and b") })
                    it("or", () => { t(40, 2, "a or b") })
                    it("shl", () => { t(21, 1, "a shl b") })
                    it("shr", () => { t(84, 1, "a shr b") })
                    it("rol", () => { t(21, 1, "a rol b") })
                    it("ror", () => { t(84, 1, "a ror b") })
                    it("xor", () => { t(43, 1, "a xor b") })
                })
                describe("prefix", () => {
                    it("+", () => { p(42, "+a") })
                    it("-", () => { p(-42, "-a") })
                    it("~", () => { p(42, "~a", ~42)})
                })
                describe("methods", () => {
                    it("countTrailingZeros", () => {
                        p(128, "a.countTrailingZeros()", 7)
                    })
                    it("countLeadingZeros", () => {
                        p(128, "a.countLeadingZeros()", 24)
                    })
                    it("countNonZeros", () => {
                        p(128, "a.countNonZeros()", 1)
                    })
                })
            })
            describe("i64", () => {
                function t(a: bigint, b: bigint, text: string, v: bigint = 42n) {
                    infixn("i64",  a, b, text, v)
                }
                function b(a: bigint, b: bigint, text: string, v: boolean = true) {
                    cg(`
                    fun Test(a: i64, b: i64): bool {
                        ${text}
                    }
                    `, ({'Test/a/b': Test }) => {
                        expect(Test(a, b)).toEqual(v ? 1 : 0)
                    })
                }
                function p(a: bigint, text: string, v: bigint = 42n) {
                    prefixn("i64", a, text, v)
                }
                describe("infix", () => {
                    it("+", () => { t(21n, 21n, "a + b") })
                    it("-", () => { t(48n, 6n, "a - b") })
                    it("*", () => { t(21n, 2n, "a * b") })
                    it("/", () => { t(84n, 2n, "a / b") })
                    it("%", () => { t(142n, 100n, "a % b") })
                    it(">", () => { b(30n, 10n, "a > b") })
                    it("<", () => { b(30n, 40n, "a < b") })
                    it(">=", () => { b(30n, 10n, "a >= b") })
                    it("<=", () => { b(30n, 40n, "a <= b") })
                    it("==", () => { b(30n, 30n, "a == b") })
                    it("!=", () => { b(30n, 40n, "a != b") })
                    it("and", () => { t(43n, 254n, "a and b") })
                    it("or", () => { t(40n, 2n, "a or b") })
                    it("shl", () => { t(21n, 1n, "a shl b") })
                    it("shr", () => { t(84n, 1n, "a shr b") })
                    it("rol", () => { t(21n, 1n, "a rol b") })
                    it("ror", () => { t(84n, 1n, "a ror b") })
                    it("xor", () => { t(43n, 1n, "a xor b") })
                })
                describe("prefix", () => {
                    it("+", () => { p(42n, "+a") })
                    it("-", () => { p(-42n, "-a") })
                    it("~", () => { p(42n, "~a", ~42n)})
                })
                describe("methods", () => {
                    it("countTrailingZeros", () => {
                        p(128n, "a.countTrailingZeros()", 7n)
                    })
                    it("countLeadingZeros", () => {
                        p(128n, "a.countLeadingZeros()", 56n)
                    })
                    it("countNonZeros", () => {
                        p(128n, "a.countNonZeros()", 1n)
                    })
                })
            })
            describe("u8", () => {
                function t(a: number, b: number, text: string, v: number = 42) {
                    infix("u8",  a, b, text, v)
                }
                function b(a: number, b: number, text: string, v: boolean = true) {
                    infix("u8", a, b, text, v ? 1 : 0, "bool")
                }
                describe("infix", () => {
                    it("+", () => { t(21, 21, "a + b") })
                    it("-", () => { t(48, 6, "a - b") })
                    it("*", () => { t(21, 2, "a * b") })
                    it("/", () => { t(84, 2, "a / b") })
                    it("%", () => { t(142, 100, "a % b") })
                    it(">", () => { b(30, 10, "a > b") })
                    it("<", () => { b(30, 40, "a < b") })
                    it(">=", () => { b(30, 10, "a >= b") })
                    it("<=", () => { b(30, 40, "a <= b") })
                    it("==", () => { b(30, 30, "a == b") })
                    it("!=", () => { b(30, 40, "a != b") })
                })
            })
            describe("u16", () => {
                function t(a: number, b: number, text: string, v: number = 42) {
                    infix("u16",  a, b, text, v)
                }
                function b(a: number, b: number, text: string, v: boolean = true) {
                    infix("u16", a, b, text, v ? 1 : 0, "bool")
                }
                describe("infix", () => {
                    it("+", () => { t(21, 21, "a + b") })
                    it("-", () => { t(48, 6, "a - b") })
                    it("*", () => { t(21, 2, "a * b") })
                    it("/", () => { t(84, 2, "a / b") })
                    it("%", () => { t(142, 100, "a % b") })
                    it(">", () => { b(30, 10, "a > b") })
                    it("<", () => { b(30, 40, "a < b") })
                    it(">=", () => { b(30, 10, "a >= b") })
                    it("<=", () => { b(30, 40, "a <= b") })
                    it("==", () => { b(30, 30, "a == b") })
                    it("!=", () => { b(30, 40, "a != b") })
                })
            })
            describe("u32", () => {
                function t(a: number, b: number, text: string, v: number = 42) {
                    infix("u32",  a, b, text, v)
                }
                function ti(a: number, b: number, text: string, v: number = 42) {
                    cg(`
                        fun Test(a: u32, b: i32): u32 {
                            ${text}
                        }
                    `, ({'Test/a/b': Test }) => {
                        expect(Test(a, b)).toEqual(v)
                    })
                }
                function p(a: number, text: string, v: number = 42) {
                    prefix("u32", a, text, v)
                }
                function b(a: number, b: number, text: string, v: boolean = true) {
                    infix("u32", a, b, text, v ? 1 : 0, "bool")
                }
                describe("infix", () => {
                    it("+", () => { t(21, 21, "a + b") })
                    it("-", () => { t(48, 6, "a - b") })
                    it("*", () => { t(21, 2, "a * b") })
                    it("/", () => { t(84, 2, "a / b") })
                    it("%", () => { t(142, 100, "a % b") })
                    it(">", () => { b(30, 10, "a > b") })
                    it("<", () => { b(30, 40, "a < b") })
                    it(">=", () => { b(30, 10, "a >= b") })
                    it("<=", () => { b(30, 40, "a <= b") })
                    it("==", () => { b(30, 30, "a == b") })
                    it("!=", () => { b(30, 40, "a != b") })
                    it("and", () => { t(43, 254, "a and b") })
                    it("or", () => { t(40, 2, "a or b") })
                    it("shl", () => { ti(21, 1, "a shl b") })
                    it("shr", () => { ti(84, 1, "a shr b") })
                    it("rol", () => { ti(21, 1, "a rol b") })
                    it("ror", () => { ti(84, 1, "a ror b") })
                    it("xor", () => { t(43, 1, "a xor b") })
                })
                describe("prefix", () => {
                    it("~", () => { p(42, "~a", ~42)})
                })
                describe("methods", () => {
                    it("countTrailingZeros", () => {
                        p(128, "a.countTrailingZeros()", 7)
                    })
                    it("countLeadingZeros", () => {
                        p(128, "a.countLeadingZeros()", 24)
                    })
                    it("countNonZeros", () => {
                        p(128, "a.countNonZeros()", 1)
                    })
                })
            })
            describe("u64", () => {
                function t(a: bigint, b: bigint, text: string, v: bigint = 42n) {
                    infixn("u64",  a, b, text, v)
                }
                function b(a: bigint, b: bigint, text: string, v: boolean = true) {
                    cg(`
                    fun Test(a: u64, b: u64): bool {
                        ${text}
                    }
                    `, ({'Test/a/b': Test }) => {
                        expect(Test(a, b)).toEqual(v ? 1 : 0)
                    })
                }
                function p(a: bigint, text: string, v: bigint = 42n) {
                    prefixn("u64", a, text, v)
                }
                describe("infix", () => {
                    it("+", () => { t(21n, 21n, "a + b") })
                    it("-", () => { t(48n, 6n, "a - b") })
                    it("*", () => { t(21n, 2n, "a * b") })
                    it("/", () => { t(84n, 2n, "a / b") })
                    it("%", () => { t(142n, 100n, "a % b") })
                    it(">", () => { b(30n, 10n, "a > b") })
                    it("<", () => { b(30n, 40n, "a < b") })
                    it(">=", () => { b(30n, 10n, "a >= b") })
                    it("<=", () => { b(30n, 40n, "a <= b") })
                    it("==", () => { b(30n, 30n, "a == b") })
                    it("!=", () => { b(30n, 40n, "a != b") })
                })
                describe("methods", () => {
                    it("countTrailingZeros", () => {
                        p(128n, "a.countTrailingZeros()", 7n)
                    })
                    it("countLeadingZeros", () => {
                        p(128n, "a.countLeadingZeros()", 56n)
                    })
                    it("countNonZeros", () => {
                        p(128n, "a.countNonZeros()", 1n)
                    })
                })
            })
            describe("f32", () => {
                function t(a: number, b: number, text: string, v: number = 42) {
                    infix("f32", a, b, text, v)
                }
                function p(a: number, text: string, v: number = 42) {
                    prefix("f32", a, text, v)
                }
                function b(a: number, b: number, text: string, v: boolean = true) {
                    cg(`
                    fun Test(a: f32, b: f32): bool {
                        ${text}
                    }
                    `, ({'Test/a/b': Test }) => {
                        expect(Test(a, b)).toEqual(v ? 1 : 0)
                    })
                }
                describe("infix", () => {
                    it("+", () => { t(21, 21, "a + b") })
                    it("-", () => { t(48, 6, "a - b") })
                    it("*", () => { t(21, 2, "a * b") })
                    it("/", () => { t(84, 2, "a / b") })
                    it(">", () => { b(30, 10, "a > b") })
                    it("<", () => { b(30, 40, "a < b") })
                    it(">=", () => { b(30, 10, "a >= b") })
                    it("<=", () => { b(30, 40, "a <= b") })
                    it("==", () => { b(30, 30, "a == b") })
                    it("!=", () => { b(30, 40, "a != b") })
                    it("sign", () => { t(-42, 1, "a sign b") })
                    it("min", () => { t(100, 42, "a min b") })
                    it("max", () => { t(23, 42, "a max b") })
                })
                describe("prefix", () => {
                    it("+", () => { p(42, "+a") })
                    it("-", () => { p(-42, "-a") })
                })
                describe("methods", () => {
                    it("abs", () => { p(-42, "a.abs()") })
                    it("sqrt", () => { p(42 * 42, "a.sqrt()") })
                    it("floor", () => { p(42.33, "a.floor()") })
                    it("ceiling", () => { p(41.25, "a.ceiling()") })
                    it("truncate", () => { p(42.44, "a.truncate()") })
                    it("roundNearest", () => { p(41.9, "a.roundNearest()") })
                })
            })

        })
        describe("logical", () => {
            function t(a: boolean, b: boolean, text: string, v: boolean = true) {
                infix("bool", a ? 1 : 0, b ? 1:  0, text, v ? 1 : 0)
            }
            function p(a: boolean, text: string, v: boolean = true) {
                prefix("bool", a ? 1 : 0, text, v ? 1 : 0)
            }
            describe("infix", () => {
                it("&&", () => { t(true, true, "a && b") })
                it("||", () => { t(true, false, "a || b") })
                it("==", () => { t(false, false, "a == b") })
                it("!=", () => { t(true, false, "a != b") })
            })
            describe("prefix", () => {
                it("!", () => { p(false, "!a") })
            })
        })
    })
})


function cgv(text: string): { lastModule: last.Module, fileSet: files.FileSet } {
    const { module: astModule, fileSet } = test.m(text)
    const checkResult = test.ck(astModule, fileSet)
    const irModule = fromAst(astModule, checkResult)
    const irDump = dumpIr(irModule)
    fs.writeFileSync('out/tmp.ir', irDump)
    const lastModule = toLast(irModule)
    const lastDump = lastUtil.dump(lastModule)
    fs.writeFileSync('out/tmp.last', lastDump)
    return { lastModule, fileSet }
}

function cg(text: string, cb: (exported: any) => void) {
    const { lastModule, fileSet } = cgv(text)
    test.ex(lastModule, fileSet, cb)
}