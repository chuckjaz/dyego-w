import * as fs from 'fs'

import { check, Diagnostic, Scope } from '../last';
import { parse, Scanner } from '../last-parser';
import { ByteWriter, Module } from '../wasm';
import { codegen } from './codegen';

describe("last codegen", () => {
    it("can create add function", () => {
        cg("export fun add(a: Int, b: Int): Int = a + b", exports => {
            const val = exports.add(30, 12);
            expect(val).toBe(42);
        })
    })
    it("can call a built in member", () => {
        cg("export fun sqrt(a: Double): Double = a.sqrt()", exports => {
            const val = exports.sqrt(64)
            expect(val).toBe(8)
        })
    })
    it("can generate an if statement", () => {
        cg("export fun min(a: Double, b: Double): Double = if (a > b) b else a", exports => {
            const val = exports.min(72, 42)
            expect(val).toBe(42)
        })
    })
    it("can assign a variable", () => {
        cg(`
          export fun test(): Boolean {
              var i: Int;
              i = i + 1;
              i == 1;
          }
        `, exports => {
            expect(exports.test()).toBeTruthy()
        })
    })
    it("can generate a loop", () => {
        cg(`
            export fun test(): Int {
                var i: Int = 0;
                var sum: Int = 0;
                loop {
                    if (i < 10) {
                        sum = sum + i;
                        i = i + 1;
                        branch;
                    }
                }
                sum
            }
        `, exports => {
            expect(exports.test()).toBe(45)
        })
    })
    it("can declare globals", () => {
        cg(`
            var d: Int = 42;
            export fun test(): Int {
                d;
            }
        `, exports => {
            expect(exports.test()).toBe(42);
        })
    })
    it("can declare a global that requires init", () => {
        cg(`
            var a: Int = 12;
            var b: Int = 30;
            var c: Int = a + b;
            export fun test(): Int {
                c;
            }
        `, exports => {
            expect(exports.test()).toBe(42)
        })
    })
    it("can declare a global initalized array", () => {
        cg(`
            var values: Int[5] = [1, 2, 3, 4, 5];

            export fun test(): Int {
                var i: Int = 0;
                var sum: Int = 0;
                loop {
                    if (i < 5) {
                        sum = sum + values[i];
                        i = i + 1;
                        branch;
                    }
                }
                sum;
            }
        `, exports => {
            expect(exports.test()).toBe(15)
        })
    })
    describe("types", () => {
        describe("primitive types", () => {
            describe("i8", () => {
                it("can add", () => {
                    cg("export fun test(a: Int8, b: Int8): Int8 = a + b", ({test}) => {
                        expect(test(1, 2)).toEqual(3)
                        expect(test(127, 1)).toEqual(-128)
                        expect(test(-128, -1)).toEqual(127)
                    })
                })
                it("can subtract", () => {
                    cg("export fun test(a: Int8, b: Int8): Int8 = a - b", ({test}) => {
                        expect(test(1, 2)).toEqual(-1)
                    })
                })
                it("can multiply", () => {
                    cg("export fun test(a: Int8, b: Int8): Int8 = a * b", ({test}) => {
                        expect(test(2, 3)).toEqual(6)
                    })
                })
                it("can divide", () => {
                    cg("export fun test(a: Int8, b: Int8): Int8 = a / b", ({test}) => {
                        expect(test(14, 2)).toEqual(7)
                    })
                })
                it("can compare", () => {
                    cg("export fun test(a: Int8, b: Int8): Boolean = a > b", ({test}) => {
                        expect(test(14, 2)).toEqual(1)
                    })
                    cg("export fun test(a: Int8, b: Int8): Boolean = a < b", ({test}) => {
                        expect(test(14, 2)).toEqual(0)
                    })
                    cg("export fun test(a: Int8, b: Int8): Boolean = a >= b", ({test}) => {
                        expect(test(14, 2)).toEqual(1)
                    })
                    cg("export fun test(a: Int8, b: Int8): Boolean = a <= b", ({test}) => {
                        expect(test(14, 2)).toEqual(0)
                    })
                    cg("export fun test(a: Int8, b: Int8): Boolean = a == b", ({test}) => {
                        expect(test(14, 2)).toEqual(0)
                    })
                    cg("export fun test(a: Int8, b: Int8): Boolean = a != b", ({test}) => {
                        expect(test(14, 2)).toEqual(1)
                    })
                })
                it("can return 127", () => {
                    cg("export fun test(): Int8 = 127t", ({test}) => {
                        expect(test()).toEqual(127)
                    })
                })
                it("can return -128", () => {
                    cg("export fun test(): Int8 = -128t", ({test}) => {
                        expect(test()).toEqual(-128)
                    })
                })
                describe("builtins", () => {
                    it("can count leading bits", () => {
                        cg("export fun test(a: Int8): Int = a.countLeadingZeros()", ({test}) => {
                            expect(test(1)).toEqual(7)
                            expect(test(5)).toEqual(5)
                        })
                    })
                    it("can count trailing bits", () => {
                        cg("export fun test(a: Int8): Int = a.countTrailingZeros()", ({test}) => {
                            expect(test(1)).toEqual(0)
                            expect(test(2)).toEqual(1)
                            expect(test(32)).toEqual(5)
                        })
                    })
                    it("can count non-zero bits", () => {
                        cg("export fun test(a: Int8): Int = a.countNonZeros()", ({test}) => {
                            expect(test(1)).toEqual(1)
                            expect(test(5 * 16 + 5)).toEqual(4)
                        })
                    })
                })
            })
            describe("u8", () => {
                it("can add", () => {
                    cg("export fun test(a: UInt8, b: UInt8): UInt8 = a + b", ({test}) => {
                        expect(test(1, 2)).toEqual(3)
                        expect(test(255, 1)).toEqual(0)
                    })
                })
                it("can subtract", () => {
                    cg("export fun test(a: UInt8, b: UInt8): UInt8 = a - b", ({test}) => {
                        expect(test(2, 1)).toEqual(1)
                        expect(test(0, 1)).toEqual(255)
                    })
                })
                it("can multiply", () => {
                    cg("export fun test(a: UInt8, b: UInt8): UInt8 = a * b", ({test}) => {
                        expect(test(2, 3)).toEqual(6)
                    })
                })
                it("can divide", () => {
                    cg("export fun test(a: UInt8, b: UInt8): UInt8 = a / b", ({test}) => {
                        expect(test(14, 2)).toEqual(7)
                    })
                })
                it("can compare", () => {
                    cg("export fun test(a: UInt8, b: UInt8): Boolean = a > b", ({test}) => {
                        expect(test(14, 2)).toEqual(1)
                    })
                    cg("export fun test(a: UInt8, b: UInt8): Boolean = a < b", ({test}) => {
                        expect(test(14, 2)).toEqual(0)
                    })
                    cg("export fun test(a: UInt8, b: UInt8): Boolean = a >= b", ({test}) => {
                        expect(test(14, 2)).toEqual(1)
                    })
                    cg("export fun test(a: UInt8, b: UInt8): Boolean = a <= b", ({test}) => {
                        expect(test(14, 2)).toEqual(0)
                    })
                    cg("export fun test(a: UInt8, b: UInt8): Boolean = a == b", ({test}) => {
                        expect(test(14, 2)).toEqual(0)
                    })
                    cg("export fun test(a: UInt8, b: UInt8): Boolean = a != b", ({test}) => {
                        expect(test(14, 2)).toEqual(1)
                    })
                })
                it("can return 255", () => {
                    cg("export fun test(): UInt8 = 255ut", ({test}) => {
                        expect(test()).toEqual(255)
                    })
                })
                it("can return 0", () => {
                    cg("export fun test(): UInt8 = 0ut", ({test}) => {
                        expect(test()).toEqual(0)
                    })
                })
                describe("builtins", () => {
                    it("can count leading bits", () => {
                        cg("export fun test(a: UInt8): Int = a.countLeadingZeros()", ({test}) => {
                            expect(test(1)).toEqual(7)
                            expect(test(5)).toEqual(5)
                        })
                    })
                    it("can count trailing bits", () => {
                        cg("export fun test(a: UInt8): Int = a.countTrailingZeros()", ({test}) => {
                            expect(test(1)).toEqual(0)
                            expect(test(2)).toEqual(1)
                            expect(test(32)).toEqual(5)
                        })
                    })
                    it("can count non-zero bits", () => {
                        cg("export fun test(a: UInt8): Int = a.countNonZeros()", ({test}) => {
                            expect(test(1)).toEqual(1)
                            expect(test(5 * 16 + 5)).toEqual(4)
                        })
                    })
                })
            })
            describe("i16", () => {
                it("can add", () => {
                    cg("export fun test(a: Int16, b: Int16): Int16 = a + b", ({test}) => {
                        expect(test(1, 2)).toEqual(3)
                        expect(test(0x7fff, 1)).toEqual(-0x8000)
                        expect(test(-0x8000, -1)).toEqual(0x7fff)
                    })
                })
                it("can subtract", () => {
                    cg("export fun test(a: Int16, b: Int16): Int16 = a - b", ({test}) => {
                        expect(test(1, 2)).toEqual(-1)
                    })
                })
                it("can multiply", () => {
                    cg("export fun test(a: Int16, b: Int16): Int16 = a * b", ({test}) => {
                        expect(test(2, 3)).toEqual(6)
                    })
                })
                it("can divide", () => {
                    cg("export fun test(a: Int16, b: Int16): Int16 = a / b", ({test}) => {
                        expect(test(14, 2)).toEqual(7)
                    })
                })
                it("can compare", () => {
                    cg("export fun test(a: Int16, b: Int16): Boolean = a > b", ({test}) => {
                        expect(test(14, 2)).toEqual(1)
                    })
                    cg("export fun test(a: Int16, b: Int16): Boolean = a < b", ({test}) => {
                        expect(test(14, 2)).toEqual(0)
                    })
                    cg("export fun test(a: Int16, b: Int16): Boolean = a >= b", ({test}) => {
                        expect(test(14, 2)).toEqual(1)
                    })
                    cg("export fun test(a: Int16, b: Int16): Boolean = a <= b", ({test}) => {
                        expect(test(14, 2)).toEqual(0)
                    })
                    cg("export fun test(a: Int16, b: Int16): Boolean = a == b", ({test}) => {
                        expect(test(14, 2)).toEqual(0)
                    })
                    cg("export fun test(a: Int16, b: Int16): Boolean = a != b", ({test}) => {
                        expect(test(14, 2)).toEqual(1)
                    })
                })
                it("can return 32767", () =>{
                    cg("export fun test(): Int16 = 32767s", ({test}) => {
                        expect(test()).toEqual(32767)
                    })
                })
                it("can return -32768", () => {
                    cg("export fun test(): Int16 = -32768s", ({test}) => {
                        expect(test()).toEqual(-32768)
                    })
                })
                describe("builtins", () => {
                    it("can count leading bits", () => {
                        cg("export fun test(a: Int16): Int = a.countLeadingZeros()", ({test}) => {
                            expect(test(1)).toEqual(15)
                            expect(test(5)).toEqual(13)
                        })
                    })
                    it("can count trailing bits", () => {
                        cg("export fun test(a: Int16): Int = a.countTrailingZeros()", ({test}) => {
                            expect(test(1)).toEqual(0)
                            expect(test(2)).toEqual(1)
                            expect(test(32)).toEqual(5)
                        })
                    })
                    it("can count non-zero bits", () => {
                        cg("export fun test(a: Int16): Int = a.countNonZeros()", ({test}) => {
                            expect(test(1)).toEqual(1)
                            expect(test(5 * 16 + 5)).toEqual(4)
                        })
                    })
                })

            })
            describe("u16", () => {
                it("can add", () => {
                    cg("export fun test(a: UInt16, b: UInt16): UInt16 = a + b", ({test}) => {
                        expect(test(1, 2)).toEqual(3)
                        expect(test(65535, 1)).toEqual(0)
                    })
                })
                it("can subtract", () => {
                    cg("export fun test(a: UInt16, b: UInt16): UInt16 = a - b", ({test}) => {
                        expect(test(2, 1)).toEqual(1)
                        expect(test(0, 1)).toEqual(65535)
                    })
                })
                it("can multiply", () => {
                    cg("export fun test(a: UInt16, b: UInt16): UInt16 = a * b", ({test}) => {
                        expect(test(2, 3)).toEqual(6)
                    })
                })
                it("can divide", () => {
                    cg("export fun test(a: UInt16, b: UInt16): UInt16 = a / b", ({test}) => {
                        expect(test(14, 2)).toEqual(7)
                    })
                })
                it("can compare", () => {
                    cg("export fun test(a: UInt16, b: UInt16): Boolean = a > b", ({test}) => {
                        expect(test(14, 2)).toEqual(1)
                    })
                    cg("export fun test(a: UInt16, b: UInt16): Boolean = a < b", ({test}) => {
                        expect(test(14, 2)).toEqual(0)
                    })
                    cg("export fun test(a: UInt16, b: UInt16): Boolean = a >= b", ({test}) => {
                        expect(test(14, 2)).toEqual(1)
                    })
                    cg("export fun test(a: UInt16, b: UInt16): Boolean = a <= b", ({test}) => {
                        expect(test(14, 2)).toEqual(0)
                    })
                    cg("export fun test(a: UInt16, b: UInt16): Boolean = a == b", ({test}) => {
                        expect(test(14, 2)).toEqual(0)
                    })
                    cg("export fun test(a: UInt16, b: UInt16): Boolean = a != b", ({test}) => {
                        expect(test(14, 2)).toEqual(1)
                    })
                })
                it("can return 65535", () => {
                    cg("export fun test(): UInt16 = 65535us", ({test}) => {
                        expect(test()).toEqual(65535)
                    })
                })
                it("can return 0", () => {
                    cg("export fun test(): UInt16 = 0us", ({test}) => {
                        expect(test()).toEqual(0)
                    })
                })
                describe("builtins", () => {
                    it("can count leading bits", () => {
                        cg("export fun test(a: UInt16): Int = a.countLeadingZeros()", ({test}) => {
                            expect(test(1)).toEqual(15)
                            expect(test(5)).toEqual(13)
                        })
                    })
                    it("can count trailing bits", () => {
                        cg("export fun test(a: UInt16): Int = a.countTrailingZeros()", ({test}) => {
                            expect(test(1)).toEqual(0)
                            expect(test(2)).toEqual(1)
                            expect(test(32)).toEqual(5)
                        })
                    })
                    it("can count non-zero bits", () => {
                        cg("export fun test(a: UInt16): Int = a.countNonZeros()", ({test}) => {
                            expect(test(1)).toEqual(1)
                            expect(test(5 * 16 + 5)).toEqual(4)
                        })
                    })
                })

            })
            describe("i32", () => {
                it("can add", () => {
                    cg("export fun test(a: Int32, b: Int32): Int32 = a + b", ({test}) => {
                        expect(test(1, 2)).toEqual(3)
                        expect(test(0x7fffffff, 1)).toEqual(-0x80000000)
                        expect(test(-0x80000000, -1)).toEqual(0x7fffffff)
                    })
                })
                it("can subtract", () => {
                    cg("export fun test(a: Int32, b: Int32): Int32 = a - b", ({test}) => {
                        expect(test(1, 2)).toEqual(-1)
                    })
                })
                it("can multiply", () => {
                    cg("export fun test(a: Int32, b: Int32): Int32 = a * b", ({test}) => {
                        expect(test(2, 3)).toEqual(6)
                    })
                })
                it("can divide", () => {
                    cg("export fun test(a: Int32, b: Int32): Int32 = a / b", ({test}) => {
                        expect(test(14, 2)).toEqual(7)
                    })
                })
                it("can compare", () => {
                    cg("export fun test(a: Int32, b: Int32): Boolean = a > b", ({test}) => {
                        expect(test(14, 2)).toEqual(1)
                    })
                    cg("export fun test(a: Int32, b: Int32): Boolean = a < b", ({test}) => {
                        expect(test(14, 2)).toEqual(0)
                    })
                    cg("export fun test(a: Int32, b: Int32): Boolean = a >= b", ({test}) => {
                        expect(test(14, 2)).toEqual(1)
                    })
                    cg("export fun test(a: Int32, b: Int32): Boolean = a <= b", ({test}) => {
                        expect(test(14, 2)).toEqual(0)
                    })
                    cg("export fun test(a: Int32, b: Int32): Boolean = a == b", ({test}) => {
                        expect(test(14, 2)).toEqual(0)
                    })
                    cg("export fun test(a: Int32, b: Int32): Boolean = a != b", ({test}) => {
                        expect(test(14, 2)).toEqual(1)
                    })
                })
                it("can return 2147483647", () =>{
                    cg("export fun test(): Int32 = 2147483647", ({test}) => {
                        expect(test()).toEqual(2147483647)
                    })
                })
                it("can return -2147483648", () => {
                    cg("export fun test(): Int32 = -2147483648", ({test}) => {
                        expect(test()).toEqual(-2147483648)
                    })
                })
                describe("builtins", () => {
                    it("can count leading bits", () => {
                        cg("export fun test(a: Int32): Int = a.countLeadingZeros()", ({test}) => {
                            expect(test(1)).toEqual(31)
                            expect(test(5)).toEqual(29)
                        })
                    })
                    it("can count trailing bits", () => {
                        cg("export fun test(a: Int32): Int = a.countTrailingZeros()", ({test}) => {
                            expect(test(1)).toEqual(0)
                            expect(test(2)).toEqual(1)
                            expect(test(32)).toEqual(5)
                        })
                    })
                    it("can count non-zero bits", () => {
                        cg("export fun test(a: Int32): Int = a.countNonZeros()", ({test}) => {
                            expect(test(1)).toEqual(1)
                            expect(test(5 * 16 + 5)).toEqual(4)
                        })
                    })
                })
            })
            describe("u32", () => {
                it("can add", () => {
                    cg("export fun test(a: UInt32, b: UInt32): UInt32 = a + b", ({test}) => {
                        expect(test(1, 2)).toEqual(3)
                        expect(test(4294967295, 1)).toEqual(0)
                    })
                })
                it("can subtract", () => {
                    cg("export fun test(a: UInt32, b: UInt32): UInt32 = a - b", ({test}) => {
                        expect(test(2, 1)).toEqual(1)
                        expect(test(0, 1)).toEqual(-1)
                    })
                })
                it("can multiply", () => {
                    cg("export fun test(a: UInt32, b: UInt32): UInt32 = a * b", ({test}) => {
                        expect(test(2, 3)).toEqual(6)
                    })
                })
                it("can divide", () => {
                    cg("export fun test(a: UInt32, b: UInt32): UInt32 = a / b", ({test}) => {
                        expect(test(14, 2)).toEqual(7)
                    })
                })
                it("can compare", () => {
                    cg("export fun test(a: UInt32, b: UInt32): Boolean = a > b", ({test}) => {
                        expect(test(14, 2)).toEqual(1)
                    })
                    cg("export fun test(a: UInt32, b: UInt32): Boolean = a < b", ({test}) => {
                        expect(test(14, 2)).toEqual(0)
                    })
                    cg("export fun test(a: UInt32, b: UInt32): Boolean = a >= b", ({test}) => {
                        expect(test(14, 2)).toEqual(1)
                    })
                    cg("export fun test(a: UInt32, b: UInt32): Boolean = a <= b", ({test}) => {
                        expect(test(14, 2)).toEqual(0)
                    })
                    cg("export fun test(a: UInt32, b: UInt32): Boolean = a == b", ({test}) => {
                        expect(test(14, 2)).toEqual(0)
                    })
                    cg("export fun test(a: UInt32, b: UInt32): Boolean = a != b", ({test}) => {
                        expect(test(14, 2)).toEqual(1)
                    })
                })
                it("can return 4294967295", () => {
                    cg("export fun test(): UInt32 = 4294967295u", ({test}) => {
                        expect(test()).toEqual(-1)
                    })
                })
                it("can return 0", () => {
                    cg("export fun test(): UInt32 = 0u", ({test}) => {
                        expect(test()).toEqual(0)
                    })
                })
                describe("builtins", () => {
                    it("can count leading bits", () => {
                        cg("export fun test(a: UInt32): Int = a.countLeadingZeros()", ({test}) => {
                            expect(test(1)).toEqual(31)
                            expect(test(5)).toEqual(29)
                        })
                    })
                    it("can count trailing bits", () => {
                        cg("export fun test(a: UInt32): Int = a.countTrailingZeros()", ({test}) => {
                            expect(test(1)).toEqual(0)
                            expect(test(2)).toEqual(1)
                            expect(test(32)).toEqual(5)
                        })
                    })
                    it("can count non-zero bits", () => {
                        cg("export fun test(a: UInt32): Int = a.countNonZeros()", ({test}) => {
                            expect(test(1)).toEqual(1)
                            expect(test(5 * 16 + 5)).toEqual(4)
                        })
                    })
                })
            })
            describe("i64", () => {
                it("can add", () => {
                    cg("export fun test(a: Int64, b: Int64): Int64 = a + b", ({test}) => {
                        expect(test(1n, 2n)).toEqual(3n)
                        expect(test(0x7fffffffffffffffn, 1n)).toEqual(-0x8000000000000000n)
                        expect(test(-0x8000000000000000n, -1n)).toEqual(0x7fffffffffffffffn)
                    })
                })
                it("can subtract", () => {
                    cg("export fun test(a: Int64, b: Int64): Int64 = a - b", ({test}) => {
                        expect(test(1n, 2n)).toEqual(-1n)
                    })
                })
                it("can multiply", () => {
                    cg("export fun test(a: Int64, b: Int64): Int64 = a * b", ({test}) => {
                        expect(test(2n, 3n)).toEqual(6n)
                    })
                })
                it("can divide", () => {
                    cg("export fun test(a: Int64, b: Int64): Int64 = a / b", ({test}) => {
                        expect(test(14n, 2n)).toEqual(7n)
                    })
                })
                it("can compare", () => {
                    cg("export fun test(a: Int64, b: Int64): Boolean = a > b", ({test}) => {
                        expect(test(14n, 2n)).toEqual(1)
                    })
                    cg("export fun test(a: Int64, b: Int64): Boolean = a < b", ({test}) => {
                        expect(test(14n, 2n)).toEqual(0)
                    })
                    cg("export fun test(a: Int64, b: Int64): Boolean = a >= b", ({test}) => {
                        expect(test(14n, 2n)).toEqual(1)
                    })
                    cg("export fun test(a: Int64, b: Int64): Boolean = a <= b", ({test}) => {
                        expect(test(14n, 2n)).toEqual(0)
                    })
                    cg("export fun test(a: Int64, b: Int64): Boolean = a == b", ({test}) => {
                        expect(test(14n, 2n)).toEqual(0)
                    })
                    cg("export fun test(a: Int64, b: Int64): Boolean = a != b", ({test}) => {
                        expect(test(14n, 2n)).toEqual(1)
                    })
                })
                it("can return 9223372036854775807", () =>{
                    cg("export fun test(): Int64 = 9223372036854775807l", ({test}) => {
                        expect(test()).toEqual(9223372036854775807n)
                    })
                })
                it("can return -9223372036854775808", () => {
                    cg("export fun test(): Int64 = -9223372036854775808l", ({test}) => {
                        expect(test()).toEqual(-9223372036854775808n)
                    })
                })
                describe("builtins", () => {
                    it("can count leading bits", () => {
                        cg("export fun test(a: Int64): Int64 = a.countLeadingZeros()", ({test}) => {
                            expect(test(1n)).toEqual(63n)
                            expect(test(5n)).toEqual(61n)
                        })
                    })
                    it("can count trailing bits", () => {
                        cg("export fun test(a: Int64): Int64 = a.countTrailingZeros()", ({test}) => {
                            expect(test(1n)).toEqual(0n)
                            expect(test(2n)).toEqual(1n)
                            expect(test(32n)).toEqual(5n)
                        })
                    })
                    it("can count non-zero bits", () => {
                        cg("export fun test(a: Int64): Int64 = a.countNonZeros()", ({test}) => {
                            expect(test(1n)).toEqual(1n)
                            expect(test(5n * 16n + 5n)).toEqual(4n)
                        })
                    })
                })
            })
            describe("u64", () => {
                it("can add", () => {
                    cg("export fun test(a: UInt64, b: UInt64): UInt64 = a + b", ({test}) => {
                        expect(test(1n, 2n)).toEqual(3n)
                        expect(test(18446744073709551615n, 1n)).toEqual(0n)
                    })
                })
                it("can subtract", () => {
                    cg("export fun test(a: UInt64, b: UInt64): UInt64 = a - b", ({test}) => {
                        expect(test(2n, 1n)).toEqual(1n)
                        expect(test(0n, 1n)).toEqual(-1n)
                    })
                })
                it("can multiply", () => {
                    cg("export fun test(a: UInt64, b: UInt64): UInt64 = a * b", ({test}) => {
                        expect(test(2n, 3n)).toEqual(6n)
                    })
                })
                it("can divide", () => {
                    cg("export fun test(a: UInt64, b: UInt64): UInt64 = a / b", ({test}) => {
                        expect(test(14n, 2n)).toEqual(7n)
                    })
                })
                it("can compare", () => {
                    cg("export fun test(a: UInt64, b: UInt64): Boolean = a > b", ({test}) => {
                        expect(test(14n, 2n)).toEqual(1)
                    })
                    cg("export fun test(a: UInt64, b: UInt64): Boolean = a < b", ({test}) => {
                        expect(test(14n, 2n)).toEqual(0)
                    })
                    cg("export fun test(a: UInt64, b: UInt64): Boolean = a >= b", ({test}) => {
                        expect(test(14n, 2n)).toEqual(1)
                    })
                    cg("export fun test(a: UInt64, b: UInt64): Boolean = a <= b", ({test}) => {
                        expect(test(14n, 2n)).toEqual(0)
                    })
                    cg("export fun test(a: UInt64, b: UInt64): Boolean = a == b", ({test}) => {
                        expect(test(14n, 2n)).toEqual(0)
                    })
                    cg("export fun test(a: UInt64, b: UInt64): Boolean = a != b", ({test}) => {
                        expect(test(14n, 2n)).toEqual(1)
                    })
                })
                it("can return 9223372036854775807", () => {
                    cg("export fun test(): UInt64 = 9223372036854775807ul", ({test}) => {
                        expect(test()).toEqual(9223372036854775807n)
                    })
                })
                it("can return 0", () => {
                    cg("export fun test(): UInt64 = 0ul", ({test}) => {
                        expect(test()).toEqual(0n)
                    })
                })
                describe("builtins", () => {
                    it("can count leading bits", () => {
                        cg("export fun test(a: UInt64): Int64 = a.countLeadingZeros()", ({test}) => {
                            expect(test(1n)).toEqual(63n)
                            expect(test(5n)).toEqual(61n)
                        })
                    })
                    it("can count trailing bits", () => {
                        cg("export fun test(a: UInt64): Int64 = a.countTrailingZeros()", ({test}) => {
                            expect(test(1n)).toEqual(0n)
                            expect(test(2n)).toEqual(1n)
                            expect(test(32n)).toEqual(5n)
                        })
                    })
                    it("can count non-zero bits", () => {
                        cg("export fun test(a: UInt64): Int64 = a.countNonZeros()", ({test}) => {
                            expect(test(1n)).toEqual(1n)
                            expect(test(5n * 16n + 5n)).toEqual(4n)
                        })
                    })
                })
            })
        })
    })
    describe("examples", () => {
        it("can run the n-body benchmark", () => {
            cgf('last/n-body.last.dg', ({offsetMomentum}) => {
                offsetMomentum()
            })
        })

        it("can run the binary-tree benchmark", () => {
            cgf('last/binary-trees.last.dg', ({work}) => {
                work(1, 10);
            })
        })

        it("can run the address example", () => {
            cgf("last/address.last.dg", ({test1, test2, test3}) => {
                expect(test1()).toEqual(1 + 2 + 3 + 4 + 5 + 6)
                expect(test2()).toEqual(4 + 5 + 6)
                expect(test3()).toEqual(
                    1 + 2 + 3 + 4 + 5 + 6 +
                        2 + 3 + 4 + 5 + 6 +
                            3 + 4 + 5 + 6 +
                                4 + 5 + 6 +
                                    5 + 6 +
                                        6
                )
            })
        })

        it("can run the atoi example", () => {
            cgf("last/atoi.last.dg", ({test}) => {
                expect(test()).toEqual(42)
            })
        })
    })

})

function report(text: string, name: string, diagnostics: Diagnostic[]): never {
    const messages: string[] = []
    for (const diagnostic of diagnostics) {
        const position = diagnostic.location.start
        if (position) {
            const { line, column } = lcOf(text, position);
            messages.push(`${name}:${line}:${column}: ${diagnostic.message}`);
        } else {
            messages.push(diagnostic.message)
        }
    }
    throw new Error(messages.join("\n"))
}

function cg(text: string, cb: (exports: any) => void, name: string = "<text>"): any {
    function s<T>(value: T | Diagnostic[]): T {
        if (Array.isArray(value)) report(text, name, value)
        return value
    }

    let writer: ByteWriter
    const scanner = new Scanner(text + "\0")
    const module = s(parse(scanner))
    const checkResult = s(check(module))
    const wasmModule = new Module()

    codegen(module, checkResult, wasmModule)
    writer = new ByteWriter()
    wasmModule.write(writer)
    const bytes = writer.extract()
    fs.writeFileSync("out/tmp.wasm", bytes)
    expect(WebAssembly.validate(bytes)).toBeTrue();
    const mod = new WebAssembly.Module(bytes);
    const inst = new WebAssembly.Instance(mod);
    cb(inst.exports)
}

function cgf(name: string, cb: (exports: any) => void): any {
    const text = fs.readFileSync(`examples/${name}`, 'utf-8')
    cg(text, cb, name)
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