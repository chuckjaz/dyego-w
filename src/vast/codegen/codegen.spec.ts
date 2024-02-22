import { Module } from "../ast"
import { parse } from "../parser/parser"
import { Scanner } from "../parser/scanner"
import { CheckResult, check } from "../types/check"
import { codegen } from "./codegen"
import { FileSet } from "../../files"

import * as fs from 'fs'
import * as last from '../../last'
import * as wasm from '../../wasm'
import * as lastWasm from '../../last-wasm'

describe("codegen", () => {
    describe("expressions", () => {
        describe("integral type operators", () => {
            describe("i8", () => {
                function bin(text: string, a: number, b: number, e: number = 42) {
                    cg(`fun Test(a: i8, b: i8): i8 { ${text} }`, (exports) => {
                        expect(exports['Test/a/b'](a, b)).toEqual(e)
                    })
                }
                function bbin(text: string, a: number, b: number, e: boolean) {
                    cg(`fun Test(a: i8, b: i8): bool { ${text} }`, (exports) => {
                        expect(exports['Test/a/b'](a, b)).toEqual(e ? 1 : 0)
                    })
                }
                function unary(text: string, a: number, e: number = 42) {
                    cg(`fun Test(a: i8): i8 { ${text} }`, (exports) => {
                        expect(exports['Test/a'](a)).toEqual(e)
                    })
                }
                describe("numeric", () => {
                    it("can add literals", () => {
                        cg(`fun Test(): i8 { 11t + 31t }`, ({Test}) => {
                            expect(Test()).toEqual(42)
                        })
                    })
                    it("can add", () => { bin('a + b', 11, 31) })
                    it("can subtract", () => { bin('a - b', 53, 11) })
                    it("can multiply", () => { bin('a * b', 21, 2) })
                    it("can divide", () => { bin('a / b', 84, 2) })
                    it("can modulus", () => { bin('a % b', 142, 100) })
                })
                describe("equatable", () => {
                    it("can equal", () => { bbin('a == b', 10, 12, false) })
                    it("can not equal", () => { bbin('a != b', 10, 12, true) })
                })
                describe("comparable", () => {
                    it("can compare >", () => { bbin('a > b', 10, 12, false) })
                    it("can compare <", () => { bbin('a < b', 10, 12, true) })
                    it("can compare >=", () => { bbin('a >= b', 10, 12, false) })
                    it("can compare <=", () => { bbin('a <= b', 10, 12, true) })
                })
                describe("negatable", () => {
                    it("can prefix plus", () => { unary("+a", 42) })
                    it("can prefix minus", () => { unary("-a", -42) })
                })
            })
            describe("i16", () => {
                function bin(text: string, a: number, b: number, e: number = 42) {
                    cg(`fun Test(a: i16, b: i16): i16 { ${text} }`, (exports) => {
                        expect(exports['Test/a/b'](a, b)).toEqual(e)
                    })
                }
                function bbin(text: string, a: number, b: number, e: boolean) {
                    cg(`fun Test(a: i16, b: i16): bool { ${text} }`, (exports) => {
                        expect(exports['Test/a/b'](a, b)).toEqual(e ? 1 : 0)
                    })
                }
                function unary(text: string, a: number, e: number = 42) {
                    cg(`fun Test(a: i16): i16 { ${text} }`, (exports) => {
                        expect(exports['Test/a'](a)).toEqual(e)
                    })
                }
                describe("numeric", () => {
                    it("can add literals", () => {
                        cg(`fun Test(): i8 { 11t + 31t }`, ({Test}) => {
                            expect(Test()).toEqual(42)
                        })
                    })
                    it("can add", () => { bin('a + b', 11, 31) })
                    it("can subtract", () => { bin('a - b', 53, 11) })
                    it("can multiply", () => { bin('a * b', 21, 2) })
                    it("can divide", () => { bin('a / b', 84, 2) })
                    it("can modulus", () => { bin('a % b', 142, 100) })
                })
                describe("equatable", () => {
                    it("can equal", () => { bbin('a == b', 10, 12, false) })
                    it("can not equal", () => { bbin('a != b', 10, 12, true) })
                })
                describe("comparable", () => {
                    it("can compare >", () => { bbin('a > b', 10, 12, false) })
                    it("can compare <", () => { bbin('a < b', 10, 12, true) })
                    it("can compare >=", () => { bbin('a >= b', 10, 12, false) })
                    it("can compare <=", () => { bbin('a <= b', 10, 12, true) })
                })
                describe("negatable", () => {
                    it("can prefix plus", () => { unary("+a", 42) })
                    it("can prefix minus", () => { unary("-a", -42) })
                })
            })
            describe("i32", () => {
                function bin(text: string, a: number, b: number, e: number = 42) {
                    cg(`fun Test(a: i32, b: i32): i32 { ${text} }`, (exports) => {
                        expect(exports['Test/a/b'](a, b)).toEqual(e)
                    })
                }
                function bbin(text: string, a: number, b: number, e: boolean) {
                    cg(`fun Test(a: i32, b: i32): bool { ${text} }`, (exports) => {
                        expect(exports['Test/a/b'](a, b)).toEqual(e ? 1 : 0)
                    })
                }
                function unary(text: string, a: number, e: number = 42) {
                    cg(`fun Test(a: i32): i32 { ${text} }`, (exports) => {
                        expect(exports['Test/a'](a)).toEqual(e)
                    })
                }
                describe("numeric", () => {
                    it("can add literals", () => {
                        cg(`fun Test(): i32 { 11 + 31 }`, ({Test}) => {
                            expect(Test()).toEqual(42)
                        })
                    })
                    it("can add", () => { bin('a + b', 11, 31) })
                    it("can subtract", () => { bin('a - b', 53, 11) })
                    it("can multiply", () => { bin('a * b', 21, 2) })
                    it("can divide", () => { bin('a / b', 84, 2) })
                    it("can modulus", () => { bin('a % b', 142, 100) })
                })
                describe("bitwise", () => {
                    it("can bit not", () => unary('~a', 23, ~23))
                    it("can bit or", () => { bin('a or b', 32, 10) })
                    it("can bit and", () => { bin('a and b', 43, 254) })
                    it("can bit shl", () => { bin('a shl b', 21, 1) })
                    it("can bit shr", () => { bin('a shr b', 84, 1) })
                    it("can bit ror", () => {
                        function ror(a: number, b: number): number {
                            let r = a
                            for (let i = 0; i < b; i++) {
                                if (r & 1) r = (1 << 31) | (r >> 1)
                                else r = r >> 1
                            }
                            return r
                        }
                        bin('a ror b', 23, 3, ror(23, 3))
                    })
                    it("can bit rol", () => {
                        function rol(a: number, b: number): number {
                            let r = a
                            for (let i = 0; i < b; i++) {
                                if (r & (1 << 31)) r = (r << 1) | 1
                                else r = r << 1
                            }
                            return r
                        }
                        bin('a rol b', 23, 3, rol(23, 3))
                    })
                })
                describe("equatable", () => {
                    it("can equal", () => { bbin('a == b', 10, 12, false) })
                    it("can not equal", () => { bbin('a != b', 10, 12, true) })
                })
                describe("comparable", () => {
                    it("can compare >", () => { bbin('a > b', 10, 12, false) })
                    it("can compare <", () => { bbin('a < b', 10, 12, true) })
                    it("can compare >=", () => { bbin('a >= b', 10, 12, false) })
                    it("can compare <=", () => { bbin('a <= b', 10, 12, true) })
                })
                describe("negatable", () => {
                    it("can prefix plus", () => { unary("+a", 42) })
                    it("can prefix minus", () => { unary("-a", -42) })
                })
                describe("bit countable", () => {
                    it("can count traling zeros", () => {
                        unary("a.countTrailingZeros()", 16, 4)
                    })
                    it("can count leading zeros", () => {
                        unary("a.countLeadingZeros()", 16, 27)
                    })
                    it("can count non-zero bits", () => {
                        unary("a.countNonZeros()", 5, 2)
                    })
                })
            })
            describe("i64", () => {
                function bin(text: string, a: bigint, b: bigint, e: bigint = 42n) {
                    cg(`fun Test(a: i64, b: i64): i64 { ${text} }`, (exports) => {
                        expect(exports['Test/a/b'](a, b)).toEqual(e)
                    })
                }
                function bbin(text: string, a: bigint, b: bigint, e: boolean) {
                    cg(`fun Test(a: i64, b: i64): bool { ${text} }`, (exports) => {
                        expect(exports['Test/a/b'](a, b)).toEqual(e ? 1 : 0)
                    })
                }
                function unary(text: string, a: bigint, e: bigint = 42n) {
                    cg(`fun Test(a: i64): i64 { ${text} }`, (exports) => {
                        expect(exports['Test/a'](a)).toEqual(e)
                    })
                }
                describe("numeric", () => {
                    it("can add literals", () => {
                        cg(`fun Test(): i32 { 11 + 31 }`, ({Test}) => {
                            expect(Test()).toEqual(42)
                        })
                    })
                    it("can add", () => { bin('a + b', 11n, 31n) })
                    it("can subtract", () => { bin('a - b', 53n, 11n) })
                    it("can multiply", () => { bin('a * b', 21n, 2n) })
                    it("can divide", () => { bin('a / b', 84n, 2n) })
                    it("can modulus", () => { bin('a % b', 142n, 100n) })
                })
                describe("bitwise", () => {
                    it("can bit not", () => unary('~a', 23n, ~23n))
                    it("can bit or", () => { bin('a or b', 32n, 10n) })
                    it("can bit and", () => { bin('a and b', 43n, 254n) })
                    it("can bit shl", () => { bin('a shl b', 21n, 1n) })
                    it("can bit shr", () => { bin('a shr b', 84n, 1n) })
                    it("can bit ror", () => {
                        function ror(a: bigint, b: number): bigint {
                            let r = a
                            for (let i = 0; i < b; i++) {
                                if (r & 1n) r = (1n << 63n) | (r >> 1n)
                                else r = r >> 1n
                            }
                            if (r & (1n << 63n)) {
                                r = -((~r + 1n) & ((1n << 63n) - 1n))
                            } else {
                                r = r & ((1n << 63n) - 1n)
                            }
                            return r
                        }
                        bin('a ror b', 23n, 3n, ror(23n, 3))
                    })
                    it("can bit rol", () => {
                        function rol(a: bigint, b: number): bigint {
                            let r = a
                            for (let i = 0; i < b; i++) {
                                if (r & (1n << 63n)) r = (r << 1n) | 1n
                                else r = r << 1n
                            }
                            if (r & (1n << 63n)) {
                                r = -((~r + 1n) & ((1n << 63n) - 1n))
                            } else {
                                r = r & ((1n << 63n) - 1n)
                            }
                            return r
                        }
                        bin('a rol b', 23n, 3n, rol(23n, 3))
                    })
                })
                describe("equatable", () => {
                    it("can equal", () => { bbin('a == b', 10n, 12n, false) })
                    it("can not equal", () => { bbin('a != b', 10n, 12n, true) })
                })
                describe("comparable", () => {
                    it("can compare >", () => { bbin('a > b', 10n, 12n, false) })
                    it("can compare <", () => { bbin('a < b', 10n, 12n, true) })
                    it("can compare >=", () => { bbin('a >= b', 10n, 12n, false) })
                    it("can compare <=", () => { bbin('a <= b', 10n, 12n, true) })
                })
                describe("negatable", () => {
                    it("can prefix plus", () => { unary("+a", 42n) })
                    it("can prefix minus", () => { unary("-a", -42n) })
                })
                describe("bit countable", () => {
                    it("can count traling zeros", () => {
                        unary("a.countTrailingZeros()", 16n, 4n)
                    })
                    it("can count leading zeros", () => {
                        unary("a.countLeadingZeros()", 16n, 59n)
                    })
                    it("can count non-zero bits", () => {
                        unary("a.countNonZeros()", 5n, 2n)
                    })
                })
            })
            describe("u8", () => {
                function bin(text: string, a: number, b: number, e: number = 42) {
                    cg(`fun Test(a: u8, b: u8): u8 { ${text} }`, (exports) => {
                        expect(exports['Test/a/b'](a, b)).toEqual(e)
                    })
                }
                function bbin(text: string, a: number, b: number, e: boolean) {
                    cg(`fun Test(a: u8, b: u8): bool { ${text} }`, (exports) => {
                        expect(exports['Test/a/b'](a, b)).toEqual(e ? 1 : 0)
                    })
                }
                function unary(text: string, a: number, e: number = 42) {
                    cg(`fun Test(a: u8): u8 { ${text} }`, (exports) => {
                        expect(exports['Test/a'](a)).toEqual(e)
                    })
                }
                describe("numeric", () => {
                    it("can add literals", () => {
                        cg(`fun Test(): u8 { 11ut + 31ut }`, ({Test}) => {
                            expect(Test()).toEqual(42)
                        })
                    })
                    it("can add", () => { bin('a + b', 11, 31) })
                    it("can subtract", () => { bin('a - b', 53, 11) })
                    it("can multiply", () => { bin('a * b', 21, 2) })
                    it("can divide", () => { bin('a / b', 84, 2) })
                    it("can modulus", () => { bin('a % b', 142, 100) })
                })
                describe("equatable", () => {
                    it("can equal", () => { bbin('a == b', 10, 12, false) })
                    it("can not equal", () => { bbin('a != b', 10, 12, true) })
                })
                describe("comparable", () => {
                    it("can compare >", () => { bbin('a > b', 10, 12, false) })
                    it("can compare <", () => { bbin('a < b', 10, 12, true) })
                    it("can compare >=", () => { bbin('a >= b', 10, 12, false) })
                    it("can compare <=", () => { bbin('a <= b', 10, 12, true) })
                })
            })
            describe("u16", () => {
                function bin(text: string, a: number, b: number, e: number = 42) {
                    cg(`fun Test(a: u16, b: u16): u16 { ${text} }`, (exports) => {
                        expect(exports['Test/a/b'](a, b)).toEqual(e)
                    })
                }
                function bbin(text: string, a: number, b: number, e: boolean) {
                    cg(`fun Test(a: u16, b: u16): bool { ${text} }`, (exports) => {
                        expect(exports['Test/a/b'](a, b)).toEqual(e ? 1 : 0)
                    })
                }
                function unary(text: string, a: number, e: number = 42) {
                    cg(`fun Test(a: u16): u16 { ${text} }`, (exports) => {
                        expect(exports['Test/a'](a)).toEqual(e)
                    })
                }
                describe("numeric", () => {
                    it("can add literals", () => {
                        cg(`fun Test(): u16 { 11us + 31us }`, ({Test}) => {
                            expect(Test()).toEqual(42)
                        })
                    })
                    it("can add", () => { bin('a + b', 11, 31) })
                    it("can subtract", () => { bin('a - b', 53, 11) })
                    it("can multiply", () => { bin('a * b', 21, 2) })
                    it("can divide", () => { bin('a / b', 84, 2) })
                    it("can modulus", () => { bin('a % b', 142, 100) })
                })
                describe("equatable", () => {
                    it("can equal", () => { bbin('a == b', 10, 12, false) })
                    it("can not equal", () => { bbin('a != b', 10, 12, true) })
                })
                describe("comparable", () => {
                    it("can compare >", () => { bbin('a > b', 10, 12, false) })
                    it("can compare <", () => { bbin('a < b', 10, 12, true) })
                    it("can compare >=", () => { bbin('a >= b', 10, 12, false) })
                    it("can compare <=", () => { bbin('a <= b', 10, 12, true) })
                })
            })
            describe("u32", () => {
                function bin(text: string, a: number, b: number, e: number = 42) {
                    cg(`fun Test(a: u32, b: u32): u32 { ${text} }`, (exports) => {
                        expect(exports['Test/a/b'](a, b)).toEqual(e)
                    })
                }
                function shift(text: string, a: number, b: number, e: number = 42) {
                    cg(`fun Test(a: u32, b: i32): u32 { ${text} }`, (exports) => {
                        expect(exports['Test/a/b'](a, b)).toEqual(e)
                    })
                }

                function bbin(text: string, a: number, b: number, e: boolean) {
                    cg(`fun Test(a: u32, b: u32): bool { ${text} }`, (exports) => {
                        expect(exports['Test/a/b'](a, b)).toEqual(e ? 1 : 0)
                    })
                }
                function unary(text: string, a: number, e: number = 42) {
                    cg(`fun Test(a: u32): u32 { ${text} }`, (exports) => {
                        expect(exports['Test/a'](a)).toEqual(e)
                    })
                }
                describe("numeric", () => {
                    it("can add literals", () => {
                        cg(`fun Test(): u32 { 11u + 31u }`, ({Test}) => {
                            expect(Test()).toEqual(42)
                        })
                    })
                    it("can add", () => { bin('a + b', 11, 31) })
                    it("can subtract", () => { bin('a - b', 53, 11) })
                    it("can multiply", () => { bin('a * b', 21, 2) })
                    it("can divide", () => { bin('a / b', 84, 2) })
                    it("can modulus", () => { bin('a % b', 142, 100) })
                })
                describe("bitwise", () => {
                    it("can bit not", () => unary('~a', 23, ~23))
                    it("can bit or", () => { bin('a or b', 32, 10) })
                    it("can bit and", () => { bin('a and b', 43, 254) })
                    it("can bit shl", () => { shift('a shl b', 21, 1) })
                    it("can bit shr", () => { shift('a shr b', 84, 1) })
                    it("can bit ror", () => {
                        function ror(a: number, b: number): number {
                            let r = a
                            for (let i = 0; i < b; i++) {
                                if (r & 1) r = (1 << 31) | (r >> 1)
                                else r = r >> 1
                            }

                            return r
                        }
                        shift('a ror b', 23, 3, ror(23, 3))
                    })
                    it("can bit rol", () => {
                        function rol(a: number, b: number): number {
                            let r = a
                            for (let i = 0; i < b; i++) {
                                if (r & (1 << 31)) r = (r << 1) | 1
                                else r = r << 1
                            }
                            return r
                        }
                        shift('a rol b', 23, 3, rol(23, 3))
                    })
                })
                describe("equatable", () => {
                    it("can equal", () => { bbin('a == b', 10, 12, false) })
                    it("can not equal", () => { bbin('a != b', 10, 12, true) })
                })
                describe("comparable", () => {
                    it("can compare >", () => { bbin('a > b', 10, 12, false) })
                    it("can compare <", () => { bbin('a < b', 10, 12, true) })
                    it("can compare >=", () => { bbin('a >= b', 10, 12, false) })
                    it("can compare <=", () => { bbin('a <= b', 10, 12, true) })
                })
                describe("bit countable", () => {
                    it("can count traling zeros", () => {
                        unary("a.countTrailingZeros()", 16, 4)
                    })
                    it("can count leading zeros", () => {
                        unary("a.countLeadingZeros()", 16, 27)
                    })
                    it("can count non-zero bits", () => {
                        unary("a.countNonZeros()", 5, 2)
                    })
                })
            })
            describe("u64", () => {
                function bin(text: string, a: bigint, b: bigint, e: bigint = 42n) {
                    cg(`fun Test(a: u64, b: u64): u64 { ${text} }`, (exports) => {
                        expect(exports['Test/a/b'](a, b)).toEqual(e)
                    })
                }
                function shift(text: string, a: bigint, b: bigint, e: bigint = 42n) {
                    cg(`fun Test(a: u64, b: i64): u64 { ${text} }`, (exports) => {
                        expect(exports['Test/a/b'](a, b)).toEqual(e)
                    })
                }

                function bbin(text: string, a: bigint, b: bigint, e: boolean) {
                    cg(`fun Test(a: u64, b: u64): bool { ${text} }`, (exports) => {
                        expect(exports['Test/a/b'](a, b)).toEqual(e ? 1 : 0)
                    })
                }
                function unary(text: string, a: bigint, e: bigint = 42n) {
                    cg(`fun Test(a: u64): u64 { ${text} }`, (exports) => {
                        expect(exports['Test/a'](a)).toEqual(e)
                    })
                }
                describe("numeric", () => {
                    it("can add literals", () => {
                        cg(`fun Test(): u64 { 11ul + 31ul }`, ({Test}) => {
                            expect(Test()).toEqual(42n)
                        })
                    })
                    it("can add", () => { bin('a + b', 11n, 31n) })
                    it("can subtract", () => { bin('a - b', 53n, 11n) })
                    it("can multiply", () => { bin('a * b', 21n, 2n) })
                    it("can divide", () => { bin('a / b', 84n, 2n) })
                    it("can modulus", () => { bin('a % b', 142n, 100n) })
                })
                describe("bitwise", () => {
                    it("can bit not", () => unary('~a', 23n, ~23n))
                    it("can bit or", () => { bin('a or b', 32n, 10n) })
                    it("can bit and", () => { bin('a and b', 43n, 254n) })
                    it("can bit shl", () => { shift('a shl b', 21n, 1n) })
                    it("can bit shr", () => { shift('a shr b', 84n, 1n) })
                    it("can bit ror", () => {
                        function ror(a: bigint, b: number): bigint {
                            let r = a
                            for (let i = 0; i < b; i++) {
                                if (r & 1n) r = (1n << 63n) | (r >> 1n)
                                else r = r >> 1n
                            }
                            if (r & (1n << 63n)) {
                                r = -((~r + 1n) & ((1n << 63n) - 1n))
                            } else {
                                r = r & ((1n << 63n) - 1n)
                            }
                            return r
                        }
                        shift('a ror b', 23n, 3n, ror(23n, 3))
                    })
                    it("can bit rol", () => {
                        function rol(a: bigint, b: number): bigint {
                            let r = a
                            for (let i = 0; i < b; i++) {
                                if (r & (1n << 31n)) r = (r << 1n) | 1n
                                else r = r << 1n
                            }
                            return r
                        }
                        shift('a rol b', 23n, 3n, rol(23n, 3))
                    })
                })
                describe("equatable", () => {
                    it("can equal", () => { bbin('a == b', 10n, 12n, false) })
                    it("can not equal", () => { bbin('a != b', 10n, 12n, true) })
                })
                describe("comparable", () => {
                    it("can compare >", () => { bbin('a > b', 10n, 12n, false) })
                    it("can compare <", () => { bbin('a < b', 10n, 12n, true) })
                    it("can compare >=", () => { bbin('a >= b', 10n, 12n, false) })
                    it("can compare <=", () => { bbin('a <= b', 10n, 12n, true) })
                })
                describe("bit countable", () => {
                    it("can count traling zeros", () => {
                        unary("a.countTrailingZeros()", 16n, 4n)
                    })
                    it("can count leading zeros", () => {
                        unary("a.countLeadingZeros()", 16n, 59n)
                    })
                    it("can count non-zero bits", () => {
                        unary("a.countNonZeros()", 5n, 2n)
                    })
                })
            })
        })
        describe("floating point type operators", () => {
            describe("f32", () => {
                function bin(text: string, a: number, b: number, e: number = 42) {
                    cg(`fun Test(a: f32, b: f32): f32 { ${text} }`, (exports) => {
                        expect(exports['Test/a/b'](a, b)).toEqual(e)
                    })
                }
                function bbin(text: string, a: number, b: number, e: boolean) {
                    cg(`fun Test(a: f32, b: f32): bool { ${text} }`, (exports) => {
                        expect(exports['Test/a/b'](a, b)).toEqual(e ? 1 : 0)
                    })
                }
                function unary(text: string, a: number, e: number = 42) {
                    cg(`fun Test(a: f32): f32 { ${text} }`, (exports) => {
                        expect(exports['Test/a'](a)).toEqual(e)
                    })
                }
                describe("numeric", () => {
                    it("can add literals", () => {
                        cg(`fun Test(): f32 { 11.0f + 31.0f }`, ({Test}) => {
                            expect(Test()).toEqual(42)
                        })
                    })
                    it("can add", () => { bin('a + b', 11, 31) })
                    it("can subtract", () => { bin('a - b', 53, 11) })
                    it("can multiply", () => { bin('a * b', 21, 2) })
                    it("can divide", () => { bin('a / b', 84, 2) })
                })
                describe("equatable", () => {
                    it("can equal", () => { bbin('a == b', 10, 12, false) })
                    it("can not equal", () => { bbin('a != b', 10, 12, true) })
                })
                describe("comparable", () => {
                    it("can compare >", () => { bbin('a > b', 10, 12, false) })
                    it("can compare <", () => { bbin('a < b', 10, 12, true) })
                    it("can compare >=", () => { bbin('a >= b', 10, 12, false) })
                    it("can compare <=", () => { bbin('a <= b', 10, 12, true) })
                })
                describe("negatable", () => {
                    it("can prefix plus", () => { unary("+a", 42) })
                    it("can prefix minus", () => { unary("-a", -42) })
                })
                describe("floatable", () => {
                    it("can absolute value", () => { unary("a.abs()", -42)})
                    it("can square root", () => { unary("a.sqrt()", 1764)})
                    it("can floor", () => { unary("a.floor()", 42.332)})
                    it("can ceiling", () => { unary("a.ceiling()", 41.23)})
                    it("can truncate", () => { unary("a.truncate()", 42.3324)})
                    it("can roundNearest", () => { unary("a.roundNearest()", 41.778)})
                    it("can copy sign", () => { bin("a sign b", -42, 23)})
                    it("can max", () => { bin("a max b", 23, 42)})
                    it("can min", () => { bin("a min b", 42, 123)})
                })
            })
            describe("f64", () => {
                function bin(text: string, a: number, b: number, e: number = 42) {
                    cg(`fun Test(a: f64, b: f64): f64 { ${text} }`, (exports) => {
                        expect(exports['Test/a/b'](a, b)).toEqual(e)
                    })
                }
                function bbin(text: string, a: number, b: number, e: boolean) {
                    cg(`fun Test(a: f64, b: f64): bool { ${text} }`, (exports) => {
                        expect(exports['Test/a/b'](a, b)).toEqual(e ? 1 : 0)
                    })
                }
                function unary(text: string, a: number, e: number = 42) {
                    cg(`fun Test(a: f64): f64 { ${text} }`, (exports) => {
                        expect(exports['Test/a'](a)).toEqual(e)
                    })
                }
                describe("numeric", () => {
                    it("can add literals", () => {
                        cg(`fun Test(): f64 { 11.0 + 31.0 }`, ({Test}) => {
                            expect(Test()).toEqual(42)
                        })
                    })
                    it("can add", () => { bin('a + b', 11, 31) })
                    it("can subtract", () => { bin('a - b', 53, 11) })
                    it("can multiply", () => { bin('a * b', 21, 2) })
                    it("can divide", () => { bin('a / b', 84, 2) })
                })
                describe("equatable", () => {
                    it("can equal", () => { bbin('a == b', 10, 12, false) })
                    it("can not equal", () => { bbin('a != b', 10, 12, true) })
                })
                describe("comparable", () => {
                    it("can compare >", () => { bbin('a > b', 10, 12, false) })
                    it("can compare <", () => { bbin('a < b', 10, 12, true) })
                    it("can compare >=", () => { bbin('a >= b', 10, 12, false) })
                    it("can compare <=", () => { bbin('a <= b', 10, 12, true) })
                })
                describe("negatable", () => {
                    it("can prefix plus", () => { unary("+a", 42) })
                    it("can prefix minus", () => { unary("-a", -42) })
                })
                describe("floatable", () => {
                    it("can absolute value", () => { unary("a.abs()", -42)})
                    it("can square root", () => { unary("a.sqrt()", 1764)})
                    it("can floor", () => { unary("a.floor()", 42.332)})
                    it("can ceiling", () => { unary("a.ceiling()", 41.23)})
                    it("can truncate", () => { unary("a.truncate()", 42.3324)})
                    it("can roundNearest", () => { unary("a.roundNearest()", 41.778)})
                    it("can copy sign", () => { bin("a sign b", -42, 23)})
                    it("can max", () => { bin("a max b", 23, 42)})
                    it("can min", () => { bin("a min b", 42, 123)})
                })
            })
        })
        describe("bool", () => {
            function bin(text: string, a: boolean, b: boolean, e: boolean = true) {
                cg(`fun Test(a: bool, b: bool): bool { ${text} }`, (exports) => {
                    expect(exports['Test/a/b'](a, b)).toEqual(e ? 1 : 0)
                })
            }
            function unary(text: string, a: boolean, e: boolean = true) {
                cg(`fun Test(a: bool): bool { ${text} }`, (exports) => {
                    expect(exports['Test/a'](a)).toEqual(e ? 1 : 0)
                })
            }
            describe("equatable", () => {
                it("can equal", () => { bin('a == b', true, true) })
                it("can not equal", () => { bin('a != b', true, false) })
            })
            describe("logical", () => {
                it("can and", () => { bin('a && b', true, true)})
                it("can or", () => { bin('a || b', true, false)})
                it("can not", () => { unary("!a", true, false)})
            })
        })
        describe("struct", () => {
            it("can construct a literal", () => {
                cg(`
                  fun Test(a: i32, b: i32): [a: i32; b: i32] {
                    [a: a, b: b]
                  }`, (exports) => {
                    expect(exports['Test/a/b'](1, 2)).toEqual([1, 2])
                  })
            })
            it("can select a field", () => {
                cg(`
                    fun Test(a: i32, b: i32): i32 {
                        val c: [a: i32; b: i32] = [a: a, b: b]
                        c.a + c.b
                    }
                `, (exports) => {
                    expect(exports['Test/a/b'](1, 2)).toEqual(3)
                })
            })       
        })
    })
})

function m(text: string): { module: Module, fileSet: FileSet } {
    const fileSet = new FileSet()
    const fileBuilder = fileSet.buildFile('<text>', text.length, text)
    const scanner = new Scanner(text, fileBuilder)
    fileBuilder.build()
    const { module, diagnostics } = parse(scanner)
    if (diagnostics.length) {
        report("parsing", diagnostics, fileSet)
    }
    return { module, fileSet }
}

function report(phase: string, diagnostics: last.Diagnostic[], fileSet: FileSet): never {
    const messages: string[] = []
    for (const diagnostic of diagnostics) {
        const location = diagnostic.location
        if (location.start) {
            const position = fileSet.position(location)
            messages.push(`${position?.display()}, ${phase}: ${diagnostic.message}`);
            if (position) {
                const file = fileSet.file(location)
                const line = '  ' + file?.lineText(position.line, position.line + 1)
                if (line) {
                    messages.push('\n' + line)
                    messages.push('^'.padStart(position.column + 3))
                }
            }
        } else {
            messages.push(diagnostic.message)
        }
    }
    throw new Error(messages.join("\n"))
}

function ck(module: Module, fileSet: FileSet): CheckResult {
    const checkResult = check(module)
    if (checkResult.diagnostics.length) {
        report("vast check", checkResult.diagnostics, fileSet)
    }
    expect(checkResult.diagnostics).toEqual([])
    return checkResult
}

function cgv(text: string): { module: last.Module, fileSet: FileSet } {
    const { module, fileSet } = m(text)
    const checkResult = ck(module, fileSet)
    const lastModule = codegen(module, checkResult)
    return { module: lastModule, fileSet }
}

function wsm(module: last.Module, fileSet: FileSet): Uint8Array  {
    const checkResult = last.check(module)
    if (Array.isArray(checkResult)) {
        report("last check", checkResult, fileSet)
    }
    const wasmModule = new wasm.Module()
    lastWasm.codegen(module, checkResult, wasmModule)
    const writer = new wasm.ByteWriter()
    wasmModule.write(writer)
    return writer.extract()
}

function cg(text: string, block: (exports: any) => void) {
    const { module: lastModule, fileSet } = cgv(text)
    const bytes = wsm(lastModule, fileSet)
    fs.writeFileSync("out/tmp.wasm", bytes)

    expect(WebAssembly.validate(bytes)).toBeTrue()
    const module = new WebAssembly.Module(bytes)
    const inst = new WebAssembly.Instance(module)
    block(inst.exports)
}
