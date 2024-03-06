import * as fs from 'fs'
import { FileSet } from '../files';
import { check, Diagnostic, Locatable, Scope } from '../last';
import { parse, Scanner } from '../last-parser';
import { SourceMap } from '../source-map';
import { ByteWriter, Mapping, Module } from '../wasm';
import { codegen } from './codegen';

describe("last codegen", () => {
    it("can create add function", () => {
        cg("export fun add(a: i32, b: i32): i32 = a + b", exports => {
            const val = exports.add(30, 12);
            expect(val).toBe(42);
        })
    })
    it("can generate an if statement", () => {
        cg("export fun minimum(a: f64, b: f64): f64 = if (a > b) b else a", exports => {
            const val = exports.minimum(72, 42)
            expect(val).toBe(42)
        })
    })
    it("can assign a variable", () => {
        cg(`
          export fun test(): bool {
              var i: i32;
              i = i + 1;
              i == 1;
          }
        `, exports => {
            expect(exports.test()).toBeTruthy()
        })
    })
    it("can generate a loop", () => {
        cg(`
            export fun test(): i32 {
                var i: i32 = 0;
                var sum: i32 = 0;
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
    it("can declare top level vars", () => {
        cg(`
            var d: i32 = 42;
            export fun test(): i32 {
                d;
            }
        `, exports => {
            expect(exports.test()).toBe(42);
        })
    })
    it("can declare a top level var that requires init", () => {
        cg(`
            var a: i32 = 12;
            var b: i32 = 30;
            var c: i32 = a + b;
            export fun test(): i32 {
                c;
            }
        `, exports => {
            expect(exports.test()).toBe(42)
        })
    })
    it("can declare a global variable", () => {
        cg(`
            export global a: i32 = 42;
        `, ({a}) => {
            expect(a.value).toBe(42)
        })
    })
    it("can export a structured type", () => {
        cg(`
            type Point = < x: i32, y: i32>

            export global point: Point = { x: 10, y: 20 }
        `, exports => {
            expect(exports['point$x'].value).toBe(10)
            expect(exports['point$y'].value).toBe(20)
        })
    })
    it("can assign a value to a union field", () => {
        cg(`
            type Union = <| i: i32, l: i64 |>;
            var u: Union;

            export fun test(v: i64): i32 {
                u.l = v;
                return u.i;
            }
        `, ({test}) => {
            expect(test(54n)).toBe(54)
        })
    })
    it("can declare a var initalized array", () => {
        cg(`
            var values: i32[5] = [1, 2, 3, 4, 5];

            export fun test(): i32 {
                var i: i32 = 0;
                var sum: i32 = 0;
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
    it("can initialize an u8 array with a string literal", () => {
        cg(`
            var text: u8[] = "Some text";

            export fun test(index: i32): u8 = text[index];
        `, ({test}) => {
            expect(test(0)).toEqual('S'.charCodeAt(0))
        })
    })
    describe("functions", () => {
        it("can call a function", () => {
            cg(`
                fun add(a: i32, b: i32): i32 = a + b

                export fun test(a: i32, b: i32): i32 {
                    return add(a, b)
                }
            `, ({test}) => {
                expect(test(32, 10)).toBe(42)
            })
        })
        it("can call recursive function", () => {
            cg(`
                export fun fib(n: i32): i32 {
                    if (n == 0) 0
                    else if (n == 1) 1
                    else fib(n - 1) + fib(n - 2)
                }
            `, ({fib}) => {
                expect(fib(7)).toEqual(13)
            })
        })
        it("can call mutually recursive functions", () => {
            cg(`
                fun a(n: i32): i32 {
                    if (n > 0) b(n - 1) + 1
                    else 0
                }

                fun b(n: i32): i32 {
                    if (n > 0) a(n - 1) + 1
                    else 0
                }

                export fun test(): i32 {
                    a(42)
                }
            `, ({test}) => {
                expect(test()).toEqual(42)
            })
        })
    })
    describe("types", () => {
        describe("primitive types", () => {
            describe("i8", () => {
                it("can add", () => {
                    cg("export fun test(a: i8, b: i8): i8 = a + b", ({test}) => {
                        expect(test(1, 2)).toEqual(3)
                        expect(test(127, 1)).toEqual(-128)
                        expect(test(-128, -1)).toEqual(127)
                    })
                })
                it("can subtract", () => {
                    cg("export fun test(a: i8, b: i8): i8 = a - b", ({test}) => {
                        expect(test(1, 2)).toEqual(-1)
                    })
                })
                it("can multiply", () => {
                    cg("export fun test(a: i8, b: i8): i8 = a * b", ({test}) => {
                        expect(test(2, 3)).toEqual(6)
                    })
                })
                it("can divide", () => {
                    cg("export fun test(a: i8, b: i8): i8 = a / b", ({test}) => {
                        expect(test(14, 2)).toEqual(7)
                    })
                })
                it("can remainder", () => {
                    cg("export fun test(a: i8, b: i8): i8 = a % b", ({test}) => {
                        expect(test(23, 3)).toEqual(23 % 3)
                    })
                })
                describe("bitwise", () => {
                    it("can bitwise and", () => {
                        cg("export fun test(a: i8, b: i8): i8 = a & b", ({test}) => {
                            expect(test(7, 3)).toEqual(7 & 3)
                        })
                    })
                    it("can bitwise or", () => {
                        cg("export fun test(a: i8, b: i8): i8 = a | b", ({test}) => {
                            expect(test(6, 3)).toEqual(6 | 3)
                        })
                    })
                    it("can bitwise xor", () => {
                        cg("export fun test(a: i8, b: i8): i8 = a xor b", ({test}) => {
                            expect(test(7, 2)).toEqual(7 ^ 2)
                        })
                    })
                    it("can bitwise shr", () => {
                        cg("export fun test(a: i8, b: i32): i8 = a shr b", ({test}) => {
                            expect(test(7, 2)).toEqual(7 >> 2)
                        })
                    })
                    it("can bitwise shl", () => {
                        cg("export fun test(a: i8, b: i32): i8 = a shl b", ({test}) => {
                            expect(test(7, 2)).toEqual(7 << 2)
                        })
                    })
                })
                it("can compare", () => {
                    cg("export fun test(a: i8, b: i8): bool = a > b", ({test}) => {
                        expect(test(14, 2)).toEqual(1)
                    })
                    cg("export fun test(a: i8, b: i8): bool = a < b", ({test}) => {
                        expect(test(14, 2)).toEqual(0)
                    })
                    cg("export fun test(a: i8, b: i8): bool = a >= b", ({test}) => {
                        expect(test(14, 2)).toEqual(1)
                    })
                    cg("export fun test(a: i8, b: i8): bool = a <= b", ({test}) => {
                        expect(test(14, 2)).toEqual(0)
                    })
                    cg("export fun test(a: i8, b: i8): bool = a == b", ({test}) => {
                        expect(test(14, 2)).toEqual(0)
                    })
                    cg("export fun test(a: i8, b: i8): bool = a != b", ({test}) => {
                        expect(test(14, 2)).toEqual(1)
                    })
                })
                it("can return 127", () => {
                    cg("export fun test(): i8 = 127t", ({test}) => {
                        expect(test()).toEqual(127)
                    })
                })
                it("can return -128", () => {
                    cg("export fun test(): i8 = -128t", ({test}) => {
                        expect(test()).toEqual(-128)
                    })
                })
                describe("conversion", () => {
                    it("can convert to i16", () => {
                        cg(`export fun test(a: i8): i16 = a convertto i16`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                    it("can convert to i32", () => {
                        cg(`export fun test(a: i8): i32 = a convertto i32`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                    it("can convert to i64", () => {
                        cg(`export fun test(a: i8): i64 = a convertto i64`, ({test}) => {
                            expect(test(15)).toBe(15n)
                        })
                    })
                    it("can convert to u8", () => {
                        cg(`export fun test(a: i8): u8 = a convertto u8`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                    it("can convert to u16", () => {
                        cg(`export fun test(a: i8): u16 = a convertto u16`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                    it("can convert to u32", () => {
                        cg(`export fun test(a: i8): u32 = a convertto u32`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                    it("can convert to u64", () => {
                        cg(`export fun test(a: i8): u64 = a convertto u64`, ({test}) => {
                            expect(test(15)).toBe(15n)
                        })
                    })
                    it("can convert to f32", () => {
                        cg(`export fun test(a: i8): f32 = a convertto f32`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                    it("can convert to f64", () => {
                        cg(`export fun test(a: i8): f64 = a convertto f64`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                })
            })
            describe("u8", () => {
                it("can add", () => {
                    cg("export fun test(a: u8, b: u8): u8 = a + b", ({test}) => {
                        expect(test(1, 2)).toEqual(3)
                        expect(test(255, 1)).toEqual(0)
                    })
                })
                it("can subtract", () => {
                    cg("export fun test(a: u8, b: u8): u8 = a - b", ({test}) => {
                        expect(test(2, 1)).toEqual(1)
                        expect(test(0, 1)).toEqual(255)
                    })
                })
                it("can multiply", () => {
                    cg("export fun test(a: u8, b: u8): u8 = a * b", ({test}) => {
                        expect(test(2, 3)).toEqual(6)
                    })
                })
                it("can divide", () => {
                    cg("export fun test(a: u8, b: u8): u8 = a / b", ({test}) => {
                        expect(test(14, 2)).toEqual(7)
                    })
                })
                it("can remainder", () => {
                    cg("export fun test(a: u8, b: u8): u8 = a % b", ({test}) => {
                        expect(test(23, 3)).toEqual(23 % 3)
                    })
                })
                describe("bitwise", () => {
                    it("can bitwise and", () => {
                        cg("export fun test(a: u8, b: u8): u8 = a & b", ({test}) => {
                            expect(test(7, 3)).toEqual(7 & 3)
                        })
                    })
                    it("can bitwise or", () => {
                        cg("export fun test(a: u8, b: u8): u8 = a | b", ({test}) => {
                            expect(test(6, 3)).toEqual(6 | 3)
                        })
                    })
                    it("can bitwise xor", () => {
                        cg("export fun test(a: u8, b: u8): u8 = a xor b", ({test}) => {
                            expect(test(7, 2)).toEqual(7 ^ 2)
                        })
                    })
                    it("can bitwise shr", () => {
                        cg("export fun test(a: u8, b: i32): u8 = a shr b", ({test}) => {
                            expect(test(7, 2)).toEqual(7 >> 2)
                        })
                    })
                    it("can bitwise shl", () => {
                        cg("export fun test(a: u8, b: i32): u8 = a shl b", ({test}) => {
                            expect(test(7, 2)).toEqual(7 << 2)
                        })
                    })
                })
                it("can compare", () => {
                    cg("export fun test(a: u8, b: u8): bool = a > b", ({test}) => {
                        expect(test(14, 2)).toEqual(1)
                    })
                    cg("export fun test(a: u8, b: u8): bool = a < b", ({test}) => {
                        expect(test(14, 2)).toEqual(0)
                    })
                    cg("export fun test(a: u8, b: u8): bool = a >= b", ({test}) => {
                        expect(test(14, 2)).toEqual(1)
                    })
                    cg("export fun test(a: u8, b: u8): bool = a <= b", ({test}) => {
                        expect(test(14, 2)).toEqual(0)
                    })
                    cg("export fun test(a: u8, b: u8): bool = a == b", ({test}) => {
                        expect(test(14, 2)).toEqual(0)
                    })
                    cg("export fun test(a: u8, b: u8): bool = a != b", ({test}) => {
                        expect(test(14, 2)).toEqual(1)
                    })
                })
                it("can return 255", () => {
                    cg("export fun test(): u8 = 255ut", ({test}) => {
                        expect(test()).toEqual(255)
                    })
                })
                it("can return 0", () => {
                    cg("export fun test(): u8 = 0ut", ({test}) => {
                        expect(test()).toEqual(0)
                    })
                })
                describe("conversion", () => {
                    it("can convert to i8", () => {
                        cg(`export fun test(a: u8): i8 = a convertto i8`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                    it("can convert to i16", () => {
                        cg(`export fun test(a: u8): i16 = a convertto i16`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                    it("can convert to i32", () => {
                        cg(`export fun test(a: u8): i32 = a convertto i32`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                    it("can convert to i64", () => {
                        cg(`export fun test(a: u8): i64 = a convertto i64`, ({test}) => {
                            expect(test(15)).toBe(15n)
                        })
                    })
                    it("can convert to u16", () => {
                        cg(`export fun test(a: u8): u16 = a convertto u16`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                    it("can convert to u32", () => {
                        cg(`export fun test(a: u8): u32 = a convertto u32`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                    it("can convert to u64", () => {
                        cg(`export fun test(a: u8): u64 = a convertto u64`, ({test}) => {
                            expect(test(15)).toBe(15n)
                        })
                    })
                    it("can convert to f32", () => {
                        cg(`export fun test(a: u8): f32 = a convertto f32`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                    it("can convert to f64", () => {
                        cg(`export fun test(a: u8): f64 = a convertto f64`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                })
            })
            describe("i16", () => {
                it("can add", () => {
                    cg("export fun test(a: i16, b: i16): i16 = a + b", ({test}) => {
                        expect(test(1, 2)).toEqual(3)
                        expect(test(0x7fff, 1)).toEqual(-0x8000)
                        expect(test(-0x8000, -1)).toEqual(0x7fff)
                    })
                })
                it("can subtract", () => {
                    cg("export fun test(a: i16, b: i16): i16 = a - b", ({test}) => {
                        expect(test(1, 2)).toEqual(-1)
                    })
                })
                it("can multiply", () => {
                    cg("export fun test(a: i16, b: i16): i16 = a * b", ({test}) => {
                        expect(test(2, 3)).toEqual(6)
                    })
                })
                it("can divide", () => {
                    cg("export fun test(a: i16, b: i16): i16 = a / b", ({test}) => {
                        expect(test(14, 2)).toEqual(7)
                    })
                })
                it("can remainder", () => {
                    cg("export fun test(a: i16, b: i16): i16 = a % b", ({test}) => {
                        expect(test(23, 3)).toEqual(23 % 3)
                    })
                })
                describe("bitwise", () => {
                    it("can bitwise and", () => {
                        cg("export fun test(a: i16, b: i16): i16 = a & b", ({test}) => {
                            expect(test(7, 3)).toEqual(7 & 3)
                        })
                    })
                    it("can bitwise or", () => {
                        cg("export fun test(a: i16, b: i16): i16 = a | b", ({test}) => {
                            expect(test(6, 3)).toEqual(6 | 3)
                        })
                    })
                    it("can bitwise xor", () => {
                        cg("export fun test(a: i16, b: i16): i16 = a xor b", ({test}) => {
                            expect(test(7, 2)).toEqual(7 ^ 2)
                        })
                    })
                    it("can bitwise shr", () => {
                        cg("export fun test(a: i16, b: i32): i16 = a shr b", ({test}) => {
                            expect(test(7, 2)).toEqual(7 >> 2)
                        })
                    })
                    it("can bitwise shl", () => {
                        cg("export fun test(a: i16, b: i32): i16 = a shl b", ({test}) => {
                            expect(test(7, 2)).toEqual(7 << 2)
                        })
                    })
                })
                it("can compare", () => {
                    cg("export fun test(a: i16, b: i16): bool = a > b", ({test}) => {
                        expect(test(14, 2)).toEqual(1)
                    })
                    cg("export fun test(a: i16, b: i16): bool = a < b", ({test}) => {
                        expect(test(14, 2)).toEqual(0)
                    })
                    cg("export fun test(a: i16, b: i16): bool = a >= b", ({test}) => {
                        expect(test(14, 2)).toEqual(1)
                    })
                    cg("export fun test(a: i16, b: i16): bool = a <= b", ({test}) => {
                        expect(test(14, 2)).toEqual(0)
                    })
                    cg("export fun test(a: i16, b: i16): bool = a == b", ({test}) => {
                        expect(test(14, 2)).toEqual(0)
                    })
                    cg("export fun test(a: i16, b: i16): bool = a != b", ({test}) => {
                        expect(test(14, 2)).toEqual(1)
                    })
                })
                it("can return 32767", () =>{
                    cg("export fun test(): i16 = 32767s", ({test}) => {
                        expect(test()).toEqual(32767)
                    })
                })
                it("can return -32768", () => {
                    cg("export fun test(): i16 = -32768s", ({test}) => {
                        expect(test()).toEqual(-32768)
                    })
                })
                describe("conversion", () => {
                    it("can convert to i8", () => {
                        cg(`export fun test(a: i16): i8 = a convertto i8`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                    it("can convert to i32", () => {
                        cg(`export fun test(a: i16): i32 = a convertto i32`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                    it("can convert to i64", () => {
                        cg(`export fun test(a: i16): i64 = a convertto i64`, ({test}) => {
                            expect(test(15)).toBe(15n)
                        })
                    })
                    it("can convert to u8", () => {
                        cg(`export fun test(a: i16): u8 = a convertto u8`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                    it("can convert to u16", () => {
                        cg(`export fun test(a: i16): u16 = a convertto u16`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                    it("can convert to u32", () => {
                        cg(`export fun test(a: i16): u32 = a convertto u32`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                    it("can convert to u64", () => {
                        cg(`export fun test(a: i16): u64 = a convertto u64`, ({test}) => {
                            expect(test(15)).toBe(15n)
                        })
                    })
                    it("can convert to f32", () => {
                        cg(`export fun test(a: i16): f32 = a convertto f32`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                    it("can convert to f64", () => {
                        cg(`export fun test(a: i16): f64 = a convertto f64`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                })
            })
            describe("u16", () => {
                it("can add", () => {
                    cg("export fun test(a: u16, b: u16): u16 = a + b", ({test}) => {
                        expect(test(1, 2)).toEqual(3)
                        expect(test(65535, 1)).toEqual(0)
                    })
                })
                it("can subtract", () => {
                    cg("export fun test(a: u16, b: u16): u16 = a - b", ({test}) => {
                        expect(test(2, 1)).toEqual(1)
                        expect(test(0, 1)).toEqual(65535)
                    })
                })
                it("can multiply", () => {
                    cg("export fun test(a: u16, b: u16): u16 = a * b", ({test}) => {
                        expect(test(2, 3)).toEqual(6)
                    })
                })
                it("can divide", () => {
                    cg("export fun test(a: u16, b: u16): u16 = a / b", ({test}) => {
                        expect(test(14, 2)).toEqual(7)
                    })
                })
                it("can remainder", () => {
                    cg("export fun test(a: u16, b: u16): u16 = a % b", ({test}) => {
                        expect(test(23, 3)).toEqual(23 % 3)
                    })
                })
                describe("bitwise", () => {
                    it("can bitwise and", () => {
                        cg("export fun test(a: u16, b: u16): u16 = a & b", ({test}) => {
                            expect(test(7, 3)).toEqual(7 & 3)
                        })
                    })
                    it("can bitwise or", () => {
                        cg("export fun test(a: u16, b: u16): u16 = a | b", ({test}) => {
                            expect(test(6, 3)).toEqual(6 | 3)
                        })
                    })
                    it("can bitwise xor", () => {
                        cg("export fun test(a: u16, b: u16): u16 = a xor b", ({test}) => {
                            expect(test(7, 2)).toEqual(7 ^ 2)
                        })
                    })
                    it("can bitwise shr", () => {
                        cg("export fun test(a: u16, b: i32): u16 = a shr b", ({test}) => {
                            expect(test(7, 2)).toEqual(7 >> 2)
                        })
                    })
                    it("can bitwise shl", () => {
                        cg("export fun test(a: u16, b: i32): u16 = a shl b", ({test}) => {
                            expect(test(7, 2)).toEqual(7 << 2)
                        })
                    })
                })
                it("can compare", () => {
                    cg("export fun test(a: u16, b: u16): bool = a > b", ({test}) => {
                        expect(test(14, 2)).toEqual(1)
                    })
                    cg("export fun test(a: u16, b: u16): bool = a < b", ({test}) => {
                        expect(test(14, 2)).toEqual(0)
                    })
                    cg("export fun test(a: u16, b: u16): bool = a >= b", ({test}) => {
                        expect(test(14, 2)).toEqual(1)
                    })
                    cg("export fun test(a: u16, b: u16): bool = a <= b", ({test}) => {
                        expect(test(14, 2)).toEqual(0)
                    })
                    cg("export fun test(a: u16, b: u16): bool = a == b", ({test}) => {
                        expect(test(14, 2)).toEqual(0)
                    })
                    cg("export fun test(a: u16, b: u16): bool = a != b", ({test}) => {
                        expect(test(14, 2)).toEqual(1)
                    })
                })
                it("can return 65535", () => {
                    cg("export fun test(): u16 = 65535us", ({test}) => {
                        expect(test()).toEqual(65535)
                    })
                })
                it("can return 0", () => {
                    cg("export fun test(): u16 = 0us", ({test}) => {
                        expect(test()).toEqual(0)
                    })
                })
                describe("conversion", () => {
                    it("can convert to i8", () => {
                        cg(`export fun test(a: u16): i8 = a convertto i8`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                    it("can convert to i16", () => {
                        cg(`export fun test(a: u16): i16 = a convertto i16`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                    it("can convert to i32", () => {
                        cg(`export fun test(a: u16): i32 = a convertto i32`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                    it("can convert to i64", () => {
                        cg(`export fun test(a: u16): i64 = a convertto i64`, ({test}) => {
                            expect(test(15)).toBe(15n)
                        })
                    })
                    it("can convert to u8", () => {
                        cg(`export fun test(a: u16): u8 = a convertto u8`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                    it("can convert to u32", () => {
                        cg(`export fun test(a: u16): u32 = a convertto u32`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                    it("can convert to u64", () => {
                        cg(`export fun test(a: u16): u64 = a convertto u64`, ({test}) => {
                            expect(test(15)).toBe(15n)
                        })
                    })
                    it("can convert to f32", () => {
                        cg(`export fun test(a: u16): f32 = a convertto f32`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                    it("can convert to f64", () => {
                        cg(`export fun test(a: u16): f64 = a convertto f64`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                })
            })
            describe("i32", () => {
                it("can add", () => {
                    cg("export fun test(a: i32, b: i32): i32 = a + b", ({test}) => {
                        expect(test(1, 2)).toEqual(3)
                        expect(test(0x7fffffff, 1)).toEqual(-0x80000000)
                        expect(test(-0x80000000, -1)).toEqual(0x7fffffff)
                    })
                })
                it("can subtract", () => {
                    cg("export fun test(a: i32, b: i32): i32 = a - b", ({test}) => {
                        expect(test(1, 2)).toEqual(-1)
                    })
                })
                it("can multiply", () => {
                    cg("export fun test(a: i32, b: i32): i32 = a * b", ({test}) => {
                        expect(test(2, 3)).toEqual(6)
                    })
                })
                it("can divide", () => {
                    cg("export fun test(a: i32, b: i32): i32 = a / b", ({test}) => {
                        expect(test(14, 2)).toEqual(7)
                    })
                })
                it("can remainder", () => {
                    cg("export fun test(a: i32, b: i32): i32 = a % b", ({test}) => {
                        expect(test(23, 3)).toEqual(23 % 3)
                    })
                })
                describe("bitwise", () => {
                    it("can bitwise and", () => {
                        cg("export fun test(a: i32, b: i32): i32 = a & b", ({test}) => {
                            expect(test(7, 3)).toEqual(7 & 3)
                        })
                    })
                    it("can bitwise or", () => {
                        cg("export fun test(a: i32, b: i32): i32 = a | b", ({test}) => {
                            expect(test(6, 3)).toEqual(6 | 3)
                        })
                    })
                    it("can bitwise xor", () => {
                        cg("export fun test(a: i32, b: i32): i32 = a xor b", ({test}) => {
                            expect(test(7, 2)).toEqual(7 ^ 2)
                        })
                    })
                    it("can bitwise shr", () => {
                        cg("export fun test(a: i32, b: i32): i32 = a shr b", ({test}) => {
                            expect(test(7, 2)).toEqual(7 >> 2)
                        })
                    })
                    it("can bitwise shl", () => {
                        cg("export fun test(a: i32, b: i32): i32 = a shl b", ({test}) => {
                            expect(test(7, 2)).toEqual(7 << 2)
                        })
                    })
                    it("can bitwise ror", () => {
                        cg("export fun test(a: i32, b: i32): i32 = a ror b", ({test}) => {
                            expect(test(7, 2)).toEqual(-1073741823)
                        })
                    })
                    it("can bitwise rol", () => {
                        cg("export fun test(a: i32, b: i32): i32 = a rol b", ({test}) => {
                            expect(test(7, 2)).toEqual(7 << 2)
                        })
                    })
                })
                describe("counting", () => {
                    it("can count trailing zeros", () => {
                        cg("export fun test(a: i32): i32 = a counttrailingzeros", ({test}) => {
                            expect(test(32)).toEqual(5)
                        })
                    })
                    it("can count leading zeros", () => {
                        cg("export fun test(a: i32): i32 = a countleadingzeros", ({test}) => {
                            expect(test(32)).toEqual(26)
                        })
                    })
                    it("can count non-zeros", () => {
                        cg("export fun test(a: i32): i32 = a countnonzeros", ({test}) => {
                            expect(test(0x55)).toEqual(4)
                        })
                    })
                })
                it("can compare", () => {
                    cg("export fun test(a: i32, b: i32): bool = a > b", ({test}) => {
                        expect(test(14, 2)).toEqual(1)
                    })
                    cg("export fun test(a: i32, b: i32): bool = a < b", ({test}) => {
                        expect(test(14, 2)).toEqual(0)
                    })
                    cg("export fun test(a: i32, b: i32): bool = a >= b", ({test}) => {
                        expect(test(14, 2)).toEqual(1)
                    })
                    cg("export fun test(a: i32, b: i32): bool = a <= b", ({test}) => {
                        expect(test(14, 2)).toEqual(0)
                    })
                    cg("export fun test(a: i32, b: i32): bool = a == b", ({test}) => {
                        expect(test(14, 2)).toEqual(0)
                    })
                    cg("export fun test(a: i32, b: i32): bool = a != b", ({test}) => {
                        expect(test(14, 2)).toEqual(1)
                    })
                })
                it("can return 2147483647", () =>{
                    cg("export fun test(): i32 = 2147483647", ({test}) => {
                        expect(test()).toEqual(2147483647)
                    })
                })
                it("can return -2147483648", () => {
                    cg("export fun test(): i32 = -2147483648", ({test}) => {
                        expect(test()).toEqual(-2147483648)
                    })
                })
                describe("conversion", () => {
                    it("can convert to i8", () => {
                        cg(`export fun test(a: i32): i8 = a convertto i8`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                    it("can convert to i16", () => {
                        cg(`export fun test(a: i32): i16 = a convertto i16`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                    it("can convert to i64", () => {
                        cg(`export fun test(a: i32): i64 = a convertto i64`, ({test}) => {
                            expect(test(15)).toBe(15n)
                        })
                    })
                    it("can convert to u8", () => {
                        cg(`export fun test(a: i32): u8 = a convertto u8`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                    it("can convert to u16", () => {
                        cg(`export fun test(a: i32): u16 = a convertto u16`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                    it("can convert to u32", () => {
                        cg(`export fun test(a: i32): u32 = a convertto u32`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                    it("can convert to u64", () => {
                        cg(`export fun test(a: i32): u64 = a convertto u64`, ({test}) => {
                            expect(test(15)).toBe(15n)
                        })
                    })
                    it("can convert to f32", () => {
                        cg(`export fun test(a: i32): f32 = a convertto f32`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                    it("can convert to f64", () => {
                        cg(`export fun test(a: i32): f64 = a convertto f64`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                })
            })
            describe("u32", () => {
                it("can add", () => {
                    cg("export fun test(a: u32, b: u32): u32 = a + b", ({test}) => {
                        expect(test(1, 2)).toEqual(3)
                        expect(test(4294967295, 1)).toEqual(0)
                    })
                })
                it("can subtract", () => {
                    cg("export fun test(a: u32, b: u32): u32 = a - b", ({test}) => {
                        expect(test(2, 1)).toEqual(1)
                        expect(test(0, 1)).toEqual(-1)
                    })
                })
                it("can multiply", () => {
                    cg("export fun test(a: u32, b: u32): u32 = a * b", ({test}) => {
                        expect(test(2, 3)).toEqual(6)
                    })
                })
                it("can divide", () => {
                    cg("export fun test(a: u32, b: u32): u32 = a / b", ({test}) => {
                        expect(test(14, 2)).toEqual(7)
                    })
                })
                it("can remainder", () => {
                    cg("export fun test(a: u32, b: u32): u32 = a % b", ({test}) => {
                        expect(test(23, 3)).toEqual(23 % 3)
                    })
                })
                describe("bitwise", () => {
                    it("can bitwise and", () => {
                        cg("export fun test(a: u32, b: u32): u32 = a & b", ({test}) => {
                            expect(test(7, 3)).toEqual(7 & 3)
                        })
                    })
                    it("can bitwise or", () => {
                        cg("export fun test(a: u32, b: u32): u32 = a | b", ({test}) => {
                            expect(test(6, 3)).toEqual(6 | 3)
                        })
                    })
                    it("can bitwise xor", () => {
                        cg("export fun test(a: u32, b: u32): u32 = a xor b", ({test}) => {
                            expect(test(7, 2)).toEqual(7 ^ 2)
                        })
                    })
                    it("can bitwise shr", () => {
                        cg("export fun test(a: u32, b: i32): u32 = a shr b", ({test}) => {
                            expect(test(7, 2)).toEqual(7 >> 2)
                        })
                    })
                    it("can bitwise shl", () => {
                        cg("export fun test(a: u32, b: i32): u32 = a shl b", ({test}) => {
                            expect(test(7, 2)).toEqual(7 << 2)
                        })
                    })
                    it("can bitwise ror", () => {
                        cg("export fun test(a: u32, b: i32): u32 = a ror b", ({test}) => {
                            expect(test(7, 2)).toEqual(-1073741823)
                        })
                    })
                    it("can bitwise rol", () => {
                        cg("export fun test(a: u32, b: i32): u32 = a rol b", ({test}) => {
                            expect(test(7, 2)).toEqual(7 << 2)
                        })
                    })
                })
                describe("counting", () => {
                    it("can count trailing zeros", () => {
                        cg("export fun test(a: u32): u32 = a counttrailingzeros", ({test}) => {
                            expect(test(32)).toEqual(5)
                        })
                    })
                    it("can count leading zeros", () => {
                        cg("export fun test(a: u32): u32 = a countleadingzeros", ({test}) => {
                            expect(test(32)).toEqual(26)
                        })
                    })
                    it("can count non-zeros", () => {
                        cg("export fun test(a: u32): u32 = a countnonzeros", ({test}) => {
                            expect(test(0x55)).toEqual(4)
                        })
                    })
                })
                it("can compare", () => {
                    cg("export fun test(a: u32, b: u32): bool = a > b", ({test}) => {
                        expect(test(14, 2)).toEqual(1)
                    })
                    cg("export fun test(a: u32, b: u32): bool = a < b", ({test}) => {
                        expect(test(14, 2)).toEqual(0)
                    })
                    cg("export fun test(a: u32, b: u32): bool = a >= b", ({test}) => {
                        expect(test(14, 2)).toEqual(1)
                    })
                    cg("export fun test(a: u32, b: u32): bool = a <= b", ({test}) => {
                        expect(test(14, 2)).toEqual(0)
                    })
                    cg("export fun test(a: u32, b: u32): bool = a == b", ({test}) => {
                        expect(test(14, 2)).toEqual(0)
                    })
                    cg("export fun test(a: u32, b: u32): bool = a != b", ({test}) => {
                        expect(test(14, 2)).toEqual(1)
                    })
                })
                it("can return 4294967295", () => {
                    cg("export fun test(): u32 = 4294967295u", ({test}) => {
                        expect(test()).toEqual(-1)
                    })
                })
                it("can return 0", () => {
                    cg("export fun test(): u32 = 0u", ({test}) => {
                        expect(test()).toEqual(0)
                    })
                })
                describe("conversion", () => {
                    it("can convert to i8", () => {
                        cg(`export fun test(a: u32): i8 = a convertto i8`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                    it("can convert to i16", () => {
                        cg(`export fun test(a: u32): i16 = a convertto i16`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                    it("can convert to i32", () => {
                        cg(`export fun test(a: u32): i32 = a convertto i32`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                    it("can convert to i64", () => {
                        cg(`export fun test(a: u32): i64 = a convertto i64`, ({test}) => {
                            expect(test(15)).toBe(15n)
                        })
                    })
                    it("can convert to u8", () => {
                        cg(`export fun test(a: u32): u8 = a convertto u8`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                    it("can convert to u16", () => {
                        cg(`export fun test(a: u32): u16 = a convertto u16`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                    it("can convert to u64", () => {
                        cg(`export fun test(a: u32): u64 = a convertto u64`, ({test}) => {
                            expect(test(15)).toBe(15n)
                        })
                    })
                    it("can convert to f32", () => {
                        cg(`export fun test(a: u32): f32 = a convertto f32`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                    it("can convert to f64", () => {
                        cg(`export fun test(a: u32): f64 = a convertto f64`, ({test}) => {
                            expect(test(15)).toBe(15)
                        })
                    })
                    it("can convert to a Pointer", () => {
                        cg(`
                            var a: i32;
                            var b: i32^ = &a;
                            export fun test(): u32 = b reinterpretas u32;
                        `, ({test}) => {
                            expect(test()).toEqual(4)
                        })
                    })
                })
            })
            describe("i64", () => {
                it("can add", () => {
                    cg("export fun test(a: i64, b: i64): i64 = a + b", ({test}) => {
                        expect(test(1n, 2n)).toEqual(3n)
                        expect(test(0x7fffffffffffffffn, 1n)).toEqual(-0x8000000000000000n)
                        expect(test(-0x8000000000000000n, -1n)).toEqual(0x7fffffffffffffffn)
                    })
                })
                it("can subtract", () => {
                    cg("export fun test(a: i64, b: i64): i64 = a - b", ({test}) => {
                        expect(test(1n, 2n)).toEqual(-1n)
                    })
                })
                it("can multiply", () => {
                    cg("export fun test(a: i64, b: i64): i64 = a * b", ({test}) => {
                        expect(test(2n, 3n)).toEqual(6n)
                    })
                })
                it("can divide", () => {
                    cg("export fun test(a: i64, b: i64): i64 = a / b", ({test}) => {
                        expect(test(14n, 2n)).toEqual(7n)
                    })
                })
                it("can remainder", () => {
                    cg("export fun test(a: i64, b: i64): i64 = a % b", ({test}) => {
                        expect(test(23n, 3n)).toEqual(23n % 3n)
                    })
                })
                describe("bitwise", () => {
                    it("can bitwise and", () => {
                        cg("export fun test(a: i64, b: i64): i64 = a & b", ({test}) => {
                            expect(test(7n, 3n)).toEqual(7n & 3n)
                        })
                    })
                    it("can bitwise or", () => {
                        cg("export fun test(a: i64, b: i64): i64 = a | b", ({test}) => {
                            expect(test(6n, 3n)).toEqual(6n | 3n)
                        })
                    })
                    it("can bitwise xor", () => {
                        cg("export fun test(a: i64, b: i64): i64 = a xor b", ({test}) => {
                            expect(test(7n, 2n)).toEqual(7n ^ 2n)
                        })
                    })
                    it("can bitwise shr", () => {
                        cg("export fun test(a: i64, b: i64): i64 = a shr b", ({test}) => {
                            expect(test(7n, 2n)).toEqual(7n >> 2n)
                        })
                    })
                    it("can bitwise shl", () => {
                        cg("export fun test(a: i64, b: i64): i64 = a shl b", ({test}) => {
                            expect(test(7n, 2n)).toEqual(7n << 2n)
                        })
                    })
                    it("can bitwise ror", () => {
                        cg("export fun test(a: i64, b: i64): i64 = a ror b", ({test}) => {
                            expect(test(7n, 2n)).toEqual(-4611686018427387903n)
                        })
                    })
                    it("can bitwise rol", () => {
                        cg("export fun test(a: i64, b: i64): i64 = a rol b", ({test}) => {
                            expect(test(7n, 2n)).toEqual(7n << 2n)
                        })
                    })
                })
                describe("counting", () => {
                    it("can count trailing zeros", () => {
                        cg("export fun test(a: i64): i64 = a counttrailingzeros", ({test}) => {
                            expect(test(32n)).toEqual(5n)
                        })
                    })
                    it("can count leading zeros", () => {
                        cg("export fun test(a: i64): i64 = a countleadingzeros", ({test}) => {
                            expect(test(32n)).toEqual(58n)
                        })
                    })
                    it("can count non-zeros", () => {
                        cg("export fun test(a: i64): i64 = a countnonzeros", ({test}) => {
                            expect(test(0x55n)).toEqual(4n)
                        })
                    })
                })
                it("can compare", () => {
                    cg("export fun test(a: i64, b: i64): bool = a > b", ({test}) => {
                        expect(test(14n, 2n)).toEqual(1)
                    })
                    cg("export fun test(a: i64, b: i64): bool = a < b", ({test}) => {
                        expect(test(14n, 2n)).toEqual(0)
                    })
                    cg("export fun test(a: i64, b: i64): bool = a >= b", ({test}) => {
                        expect(test(14n, 2n)).toEqual(1)
                    })
                    cg("export fun test(a: i64, b: i64): bool = a <= b", ({test}) => {
                        expect(test(14n, 2n)).toEqual(0)
                    })
                    cg("export fun test(a: i64, b: i64): bool = a == b", ({test}) => {
                        expect(test(14n, 2n)).toEqual(0)
                    })
                    cg("export fun test(a: i64, b: i64): bool = a != b", ({test}) => {
                        expect(test(14n, 2n)).toEqual(1)
                    })
                })
                it("can return 9223372036854775807", () =>{
                    cg("export fun test(): i64 = 9223372036854775807l", ({test}) => {
                        expect(test()).toEqual(9223372036854775807n)
                    })
                })
                it("can return -9223372036854775808", () => {
                    cg("export fun test(): i64 = -9223372036854775808l", ({test}) => {
                        expect(test()).toEqual(-9223372036854775808n)
                    })
                })
                describe("conversion", () => {
                    it("can convert to i8", () => {
                        cg(`export fun test(a: i64): i8 = a convertto i8`, ({test}) => {
                            expect(test(15n)).toBe(15)
                        })
                    })
                    it("can convert to i16", () => {
                        cg(`export fun test(a: i64): i16 = a convertto i16`, ({test}) => {
                            expect(test(15n)).toBe(15)
                        })
                    })
                    it("can convert to i32", () => {
                        cg(`export fun test(a: i64): i32 = a convertto i32`, ({test}) => {
                            expect(test(15n)).toBe(15)
                        })
                    })
                    it("can convert to u8", () => {
                        cg(`export fun test(a: i64): u8 = a convertto u8`, ({test}) => {
                            expect(test(15n)).toBe(15)
                        })
                    })
                    it("can convert to u16", () => {
                        cg(`export fun test(a: i64): u16 = a convertto u16`, ({test}) => {
                            expect(test(15n)).toBe(15)
                        })
                    })
                    it("can convert to u32", () => {
                        cg(`export fun test(a: i64): u32 = a convertto u32`, ({test}) => {
                            expect(test(15n)).toBe(15)
                        })
                    })
                    it("can convert to u64", () => {
                        cg(`export fun test(a: i64): u64 = a convertto u64`, ({test}) => {
                            expect(test(15n)).toBe(15n)
                        })
                    })
                    it("can convert to f32", () => {
                        cg(`export fun test(a: i64): f32 = a convertto f32`, ({test}) => {
                            expect(test(15n)).toBe(15)
                        })
                    })
                    it("can convert to f64", () => {
                        cg(`export fun test(a: i64): f64 = a convertto f64`, ({test}) => {
                            expect(test(15n)).toBe(15)
                        })
                    })
                })
            })
            describe("u64", () => {
                it("can add", () => {
                    cg("export fun test(a: u64, b: u64): u64 = a + b", ({test}) => {
                        expect(test(1n, 2n)).toEqual(3n)
                        expect(test(18446744073709551615n, 1n)).toEqual(0n)
                    })
                })
                it("can subtract", () => {
                    cg("export fun test(a: u64, b: u64): u64 = a - b", ({test}) => {
                        expect(test(2n, 1n)).toEqual(1n)
                        expect(test(0n, 1n)).toEqual(-1n)
                    })
                })
                it("can multiply", () => {
                    cg("export fun test(a: u64, b: u64): u64 = a * b", ({test}) => {
                        expect(test(2n, 3n)).toEqual(6n)
                    })
                })
                it("can divide", () => {
                    cg("export fun test(a: u64, b: u64): u64 = a / b", ({test}) => {
                        expect(test(14n, 2n)).toEqual(7n)
                    })
                })
                it("can remainder", () => {
                    cg("export fun test(a: u64, b: u64): u64 = a % b", ({test}) => {
                        expect(test(23n, 3n)).toEqual(23n % 3n)
                    })
                })
                describe("bitwise", () => {
                    it("can bitwise and", () => {
                        cg("export fun test(a: u64, b: u64): u64 = a & b", ({test}) => {
                            expect(test(7n, 3n)).toEqual(7n & 3n)
                        })
                    })
                    it("can bitwise or", () => {
                        cg("export fun test(a: u64, b: u64): u64 = a | b", ({test}) => {
                            expect(test(6n, 3n)).toEqual(6n | 3n)
                        })
                    })
                    it("can bitwise xor", () => {
                        cg("export fun test(a: u64, b: u64): u64 = a xor b", ({test}) => {
                            expect(test(7n, 2n)).toEqual(7n ^ 2n)
                        })
                    })
                    it("can bitwise shr", () => {
                        cg("export fun test(a: u64, b: i64): u64 = a shr b", ({test}) => {
                            expect(test(7n, 2n)).toEqual(7n >> 2n)
                        })
                    })
                    it("can bitwise shl", () => {
                        cg("export fun test(a: u64, b: i64): u64 = a shl b", ({test}) => {
                            expect(test(7n, 2n)).toEqual(7n << 2n)
                        })
                    })
                    it("can bitwise ror", () => {
                        cg("export fun test(a: u64, b: i64): u64 = a ror b", ({test}) => {
                            expect(test(7n, 2n)).toEqual(-4611686018427387903n)
                        })
                    })
                    it("can bitwise rol", () => {
                        cg("export fun test(a: u64, b: i64): u64 = a rol b", ({test}) => {
                            expect(test(7n, 2n)).toEqual(7n << 2n)
                        })
                    })
                })
                describe("counting", () => {
                    it("can count trailing zeros", () => {
                        cg("export fun test(a: u64): u64 = a counttrailingzeros", ({test}) => {
                            expect(test(32n)).toEqual(5n)
                        })
                    })
                    it("can count leading zeros", () => {
                        cg("export fun test(a: u64): u64 = a countleadingzeros", ({test}) => {
                            expect(test(32n)).toEqual(58n)
                        })
                    })
                    it("can count non-zeros", () => {
                        cg("export fun test(a: u64): u64 = a countnonzeros", ({test}) => {
                            expect(test(0x55n)).toEqual(4n)
                        })
                    })
                })
                it("can compare", () => {
                    cg("export fun test(a: u64, b: u64): bool = a > b", ({test}) => {
                        expect(test(14n, 2n)).toEqual(1)
                    })
                    cg("export fun test(a: u64, b: u64): bool = a < b", ({test}) => {
                        expect(test(14n, 2n)).toEqual(0)
                    })
                    cg("export fun test(a: u64, b: u64): bool = a >= b", ({test}) => {
                        expect(test(14n, 2n)).toEqual(1)
                    })
                    cg("export fun test(a: u64, b: u64): bool = a <= b", ({test}) => {
                        expect(test(14n, 2n)).toEqual(0)
                    })
                    cg("export fun test(a: u64, b: u64): bool = a == b", ({test}) => {
                        expect(test(14n, 2n)).toEqual(0)
                    })
                    cg("export fun test(a: u64, b: u64): bool = a != b", ({test}) => {
                        expect(test(14n, 2n)).toEqual(1)
                    })
                })
                it("can return 9223372036854775807", () => {
                    cg("export fun test(): u64 = 9223372036854775807ul", ({test}) => {
                        expect(test()).toEqual(9223372036854775807n)
                    })
                })
                it("can return 0", () => {
                    cg("export fun test(): u64 = 0ul", ({test}) => {
                        expect(test()).toEqual(0n)
                    })
                })
                describe("conversion", () => {
                    it("can convert to i8", () => {
                        cg(`export fun test(a: u64): i8 = a convertto i8`, ({test}) => {
                            expect(test(15n)).toBe(15)
                        })
                    })
                    it("can convert to i16", () => {
                        cg(`export fun test(a: u64): i16 = a convertto i16`, ({test}) => {
                            expect(test(15n)).toBe(15)
                        })
                    })
                    it("can convert to i32", () => {
                        cg(`export fun test(a: u64): i32 = a convertto i32`, ({test}) => {
                            expect(test(15n)).toBe(15)
                        })
                    })
                    it("can convert to i64", () => {
                        cg(`export fun test(a: u64): i64 = a convertto i64`, ({test}) => {
                            expect(test(15n)).toBe(15n)
                        })
                    })
                    it("can convert to u8", () => {
                        cg(`export fun test(a: u64): u8 = a convertto u8`, ({test}) => {
                            expect(test(15n)).toBe(15)
                        })
                    })
                    it("can convert to u16", () => {
                        cg(`export fun test(a: u64): u16 = a convertto u16`, ({test}) => {
                            expect(test(15n)).toBe(15)
                        })
                    })
                    it("can convert to u32", () => {
                        cg(`export fun test(a: u64): u32 = a convertto u32`, ({test}) => {
                            expect(test(15n)).toBe(15)
                        })
                    })
                    it("can convert to f32", () => {
                        cg(`export fun test(a: u64): f32 = a convertto f32`, ({test}) => {
                            expect(test(15n)).toBe(15)
                        })
                    })
                    it("can convert to f64", () => {
                        cg(`export fun test(a: u64): f64 = a convertto f64`, ({test}) => {
                            expect(test(15n)).toBe(15)
                        })
                    })
                })
            })
            describe("f32", () => {
                it("can add", () => {
                    cg("export fun test(a: f32, b: f32): f32 = a + b", ({test}) => {
                        expect(test(1, 2)).toEqual(3)
                        expect(test(23, 19)).toEqual(42)
                        expect(test(1.23, 3.43)).toBeCloseTo(1.23 + 3.43)
                    })
                })
                it("can subtract", () => {
                    cg("export fun test(a: f32, b: f32): f32 = a - b", ({test}) => {
                        expect(test(1, 2)).toEqual(-1)
                    })
                })
                it("can multiply", () => {
                    cg("export fun test(a: f32, b: f32): f32 = a * b", ({test}) => {
                        expect(test(2, 3)).toEqual(6)
                    })
                })
                it("can divide", () => {
                    cg("export fun test(a: f32, b: f32): f32 = a / b", ({test}) => {
                        expect(test(14, 2)).toEqual(7)
                    })
                })
                it("can abs", () => {
                    cg("export fun test(a: f32): f32 = a abs", ({test}) => {
                        expect(test(-32)).toEqual(32)
                    })
                })
                it("can sqrt", () => {
                    cg("export fun test(a: f32): f32 = a sqrt", ({test}) => {
                        expect(test(25)).toEqual(5)
                    })
                })
                it("can floor", () => {
                    cg("export fun test(a: f32): f32 = a floor", ({test}) => {
                        expect(test(25.93)).toEqual(25)
                    })
                })
                it("can ceil", () => {
                    cg("export fun test(a: f32): f32 = a ceil", ({test}) => {
                        expect(test(25.93)).toEqual(26)
                    })
                })
                it("can trunc", () => {
                    cg("export fun test(a: f32): f32 = a trunc", ({test}) => {
                        expect(test(25.93)).toEqual(25)
                    })
                })
                it("can nearest", () => {
                    cg("export fun test(a: f32): f32 = a nearest", ({test}) => {
                        expect(test(25.93)).toEqual(26)
                    })
                })
                it("can min", () => {
                    cg("export fun test(a: f32, b: f32): f32 = a min b", ({test}) => {
                        expect(test(25, 30)).toEqual(25)
                    })
                })
                it("can max", () => {
                    cg("export fun test(a: f32, b: f32): f32 = a max b ", ({test}) => {
                        expect(test(25, 30)).toEqual(30)
                    })
                })
                it("can copysign", () => {
                    cg("export fun test(a: f32, b: f32): f32 = a copysign b", ({test}) => {
                        expect(test(1, 23)).toEqual(1)
                        expect(test(1, -23)).toEqual(-1)
                    })
                })
                describe("conversions", () => {
                    it("can truncate to i32", () => {
                        cg("export fun test(a: f32): i32 = a truncateto i32", ({test}) => {
                            expect(test(15.5)).toBe(15)
                        })
                    })
                    it("can truncate to u32", () => {
                        cg("export fun test(a: f32): u32 = a truncateto u32", ({test}) => {
                            expect(test(15.5)).toBe(15)
                        })
                    })
                    it("can truncate to i64", () => {
                        cg("export fun test(a: f32): i64 = a truncateto i64", ({test}) => {
                            expect(test(15.5)).toBe(15n)
                        })
                    })
                    it("can truncate to u64", () => {
                        cg("export fun test(a: f32): u64 = a truncateto u64", ({test}) => {
                            expect(test(15.5)).toBe(15n)
                        })
                    })
                    it("can convert to f64", () => {
                        cg("export fun test(a: f32): f64 = a convertto f64", ({test}) => {
                            expect(test(15.5)).toBe(15.5)
                        })
                    })
                    it("can reinterpret as a u32", () => {
                        cg("export fun test(a: f32): u32 = a reinterpretas u32", ({test}) => {
                            expect(test(10)).toBe(1092616192)
                        })
                    })
                })
            })
            describe("f64", () => {
                it("can add", () => {
                    cg("export fun test(a: f64, b: f64): f64 = a + b", ({test}) => {
                        expect(test(1, 2)).toEqual(3)
                        expect(test(23, 19)).toEqual(42)
                        expect(test(1.23, 3.43)).toBeCloseTo(1.23 + 3.43)
                    })
                })
                it("can subtract", () => {
                    cg("export fun test(a: f64, b: f64): f64 = a - b", ({test}) => {
                        expect(test(1, 2)).toEqual(-1)
                    })
                })
                it("can multiply", () => {
                    cg("export fun test(a: f64, b: f64): f64 = a * b", ({test}) => {
                        expect(test(2, 3)).toEqual(6)
                    })
                })
                it("can divide", () => {
                    cg("export fun test(a: f64, b: f64): f64 = a / b", ({test}) => {
                        expect(test(14, 2)).toEqual(7)
                    })
                })
                it("can abs", () => {
                    cg("export fun test(a: f64): f64 = a abs", ({test}) => {
                        expect(test(-32)).toEqual(32)
                    })
                })
                it("can sqrt", () => {
                    cg("export fun test(a: f64): f64 = a sqrt", ({test}) => {
                        expect(test(25)).toEqual(5)
                    })
                })
                it("can floor", () => {
                    cg("export fun test(a: f64): f64 = a floor", ({test}) => {
                        expect(test(25.93)).toEqual(25)
                    })
                })
                it("can ceil", () => {
                    cg("export fun test(a: f64): f64 = a ceil", ({test}) => {
                        expect(test(25.93)).toEqual(26)
                    })
                })
                it("can trunc", () => {
                    cg("export fun test(a: f64): f64 = a trunc", ({test}) => {
                        expect(test(25.93)).toEqual(25)
                    })
                })
                it("can nearest", () => {
                    cg("export fun test(a: f64): f64 = a nearest", ({test}) => {
                        expect(test(25.93)).toEqual(26)
                    })
                })
                it("can min", () => {
                    cg("export fun test(a: f64, b: f64): f64 = a min b", ({test}) => {
                        expect(test(25, 30)).toEqual(25)
                    })
                })
                it("can max", () => {
                    cg("export fun test(a: f64, b: f64): f64 = a max b", ({test}) => {
                        expect(test(25, 30)).toEqual(30)
                    })
                })
                it("can copysign", () => {
                    cg("export fun test(a: f64, b: f64): f64 = a copysign b", ({test}) => {
                        expect(test(1, 23)).toEqual(1)
                        expect(test(1, -23)).toEqual(-1)
                    })
                })
                describe("conversions", () => {
                    it("can truncate to i32", () => {
                        cg("export fun test(a: f64): i32 = a truncateto i32", ({test}) => {
                            expect(test(15.5)).toBe(15)
                        })
                    })
                    it("can truncate to u32", () => {
                        cg("export fun test(a: f64): u32 = a truncateto u32", ({test}) => {
                            expect(test(15.5)).toBe(15)
                        })
                    })
                    it("can truncate to i64", () => {
                        cg("export fun test(a: f64): i64 = a truncateto i64", ({test}) => {
                            expect(test(15.5)).toBe(15n)
                        })
                    })
                    it("can truncate to u64", () => {
                        cg("export fun test(a: f64): u64 = a truncateto u64", ({test}) => {
                            expect(test(15.5)).toBe(15n)
                        })
                    })
                    it("can convert to f32", () => {
                        cg("export fun test(a: f64): f32 = a convertto f32", ({test}) => {
                            expect(test(15.5)).toBe(15.5)
                        })
                    })
                    it("can reinterpret to u64", () => {
                        cg("export fun test(a: f64): u64 = a reinterpretas u64", ({test}) => {
                            expect(test(10)).toBe(4621819117588971520n)
                        })
                    })
                })
            })
        })
    })
    describe("imports", () => {
        it("can import a function", () => {
            cg(`
                import host {
                    fun getValue(): i32
                }

                export fun test(): i32 = getValue();
            `, ({test}) => {
                expect(test()).toEqual(42)
            }, "<text>", {
                host: {
                    getValue: () => 42
                }
            })
        })
        it("can import a variable", () => {
            cg(`
                import host { var value: i32 }

                export fun test(): i32 = value
            `, ({test}) => {
                expect(test()).toEqual(42)
            }, "<text>", {
                host: {
                    value: new WebAssembly.Global({ mutable: true, value: "i32" }, 42)
                }
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
    describe("variables", () => {
        it("can assign void to an inferred value", () => {
            cg(`
                fun t(): void { }

                fun c(v: i32): void { }

                export fun test(): void {
                    var a = t()
                    c(10)
                    a;
                }
            `, ({test}) => {
                test()
            })
        })
    })
    describe("function references", () => {
        it("can take a reference to a function", () => {
            cg(`
                fun f(): void {}

                export fun test(): void {
                    var p = &f;
                }
            `, ({test}) => {
                test()
            })
        })
        it("can call a function through a function", () => {
            cg(`
                fun f(): i32 { 42 }
                export fun test(): i32 {
                    var p = &f
                    p()
                }
            `, ({test}) => {
                expect(test()).toEqual(42)
            })
        })
    })
})

function report(text: string, name: string, diagnostics: Diagnostic[], fileSet: FileSet): never {
    const messages: string[] = []
    for (const diagnostic of diagnostics) {
        const location = diagnostic.location
        if (location.start) {
            const position = fileSet.position(location)
            messages.push(`${position?.display()}: ${diagnostic.message}`);
        } else {
            messages.push(diagnostic.message)
        }
    }
    throw new Error(messages.join("\n"))
}

function cg(text: string, cb: (exports: any) => void, name: string = "<text>", imports?: WebAssembly.Imports): any {
    let fileSet = new FileSet()
    function s<T>(value: T | Diagnostic[]): T {
        if (Array.isArray(value)) report(text, name, value, fileSet)
        return value
    }

    let writer: ByteWriter
    const fileBuilder = fileSet.buildFile(name, text.length)
    const scanner = new Scanner(text + "\0", fileBuilder)
    fileBuilder.build()
    const module = s(parse(scanner, fileBuilder))
    const checkResult = s(check(module))
    const wasmModule = new Module()

    codegen(module, checkResult, wasmModule, true)
    writer = new ByteWriter()
    wasmModule.write(writer)
    const bytes = writer.extract()
    fs.writeFileSync("out/tmp.wasm", bytes)

    const sourceMap = new SourceMap("out/tmp.wasm");
    const fileNameIndexes = new Map<string, number>();
    const mappings = wasmModule.mappings()
    if (mappings) {
        for (const mapping of mappings) {
            const position = fileSet.position(mapping.location)
            if (position?.isValid) {
                var fileIndex: number
                const fileName = `../${position.fileName}`
                if (fileNameIndexes.has(fileName)) {
                    fileIndex = fileNameIndexes.get(fileName)!!
                } else {
                    fileIndex = sourceMap.addFile(fileName)
                    fileNameIndexes.set(fileName, fileIndex)
                }
                sourceMap.addMapping(mapping.offset, fileIndex, position.line, position.column)
            }
        }
        const sourceMapText = sourceMap.toMap(name == "<text>" ? text : undefined)
        fs.writeFileSync("out/tmp.wasm.map", sourceMapText, "utf8")
    }

    expect(WebAssembly.validate(bytes)).toBeTrue();
    const mod = new WebAssembly.Module(bytes);
    const inst = new WebAssembly.Instance(mod, imports);
    cb(inst.exports)
}

function cgf(name: string, cb: (exports: any) => void): any {
    const fileName = `examples/${name}`
    const text = fs.readFileSync(fileName, 'utf-8')
    cg(text, cb, fileName)
}
