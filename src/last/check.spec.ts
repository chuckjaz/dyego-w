import * as fs from 'fs'

import { parse, Scanner } from "../last-parser"
import { Module } from "./ast"
import { check, CheckResult } from './check'
import { Diagnostic } from "./diagnostic"
import { FileSet } from "../files"
import { error } from '../utils'

describe("check", () => {
    describe("examples", () => {
        it("can check address.last.dg", () => {
            te("last/address.last.dg")
        })
        it("can check atoi.last.dg", () => {
            te("last/atoi.last.dg")
        })
        it("can check binary-trees.last.dg", () => {
            te("last/binary-trees.last.dg")
        })
        it("can check n-body.last.dg", () => {
            te("last/n-body.last.dg")
        })
    })
    describe("imports", () => {
        it("can enter a function", () => {
            t(`
                import host { fun printInt(text: Int): Void };

                fun test(value: Int): Void {
                    printInt(value);
                }
            `)
        })
        it("can enter a variable", () => {
            t(`
                import host {
                    var count: Int,
                    var offset: Int
                 };

                fun test(): Int = count + offset;
            `)
        })
    })
    describe("declarations", () => {
        describe("let", () => {
            it("can detect a type error", () => {
                d("let a: Int64 = !{Expected type Int64, received Int}!10;")
            })
        })
        describe("var", () => {
            it("can detect a type error", () => {
                d("var a: Int64 = !{Expected type Int64, received Int}!10;")
            })
            it("can infer a type", () => {
                t("var a = 10")
            })
            it("can detect a type error with an inferred type", () => {
                d("var a = 10; var b: Int64 = !{Expected type Int64, received Int}!a")
            })
        })
        describe("fun", () => {
            it("can detect a result error", () => {
                d("fun test(): Int64 = !{Expected type Int64, received Int}!10")
            })
            it("can detect a return result type error", () => {
                d(`
                    fun test(): Int64 {
                        return !{Expected type Int64, received Int}!10;
                    }
                `)
            })
            it("can detect a missing return", () => {
                d(`
                    fun test(): Int64 {
                        !{Last statement must be a return or an expresion}!let a: Int = 10;
                    }
                `)
            })
        })
        describe("global", () => {
            it("declare a global", () => {
                t("global a: Int = 10;")
            })
            it("can the value in an exprssion", () => {
                t(`
                    global a: Int = 10;

                    fun test(): Int = a + 10;
                `)
            })
            it("detect an type mismatch", () => {
                d("global a: Int = !{Expected type Int, received Float64}!1.0")
            })
        })
    })
    describe("expression", () => {
        const comparisonOperators = "<,>,>=,<=,==,!=".split(",")

        it("can detect an undefined reference", () => {
            d(`let a: Int = !{Symbol "b" not found}!b`)
        })
        it("can detect a capability error", () => {
            d(`let a: Boolean = !{Operator "+" not supported for type Boolean}!true + false`)
        })
        it("can detected an invalid pointer operator", () => {
            d(`var a: Int^; var b: Int^ = !{Operator "*" not supported for type Int^}!a * a`)
        })
        it("can check numeric operators", () => {
            const numericTypes = "Int8,Int16,Int32,Int64,UInt8,UInt16,UInt32,UInt64".split(",")
            const numericBinaryOperators = "+,-,*,/,%".split(",")
            const numericUnaryOperators = "~,+,-".split(",")
            for (const type of numericTypes) {
                for (const op of numericBinaryOperators) {
                    t(`fun test(a: ${type}, b: ${type}): ${type} = a ${op} b`)
                }
                for (const op of comparisonOperators) {
                    t(`fun test(a: ${type}, b: ${type}): Boolean = a ${op} b`)
                }
                for (const op of numericUnaryOperators) {
                    t(`fun test(a: ${type}): ${type} = ${op}a`)
                }
            }
        })
        it("can check floating point operators", () => {
            const floatingPointTypes = "Float32,Float64".split(",")
            const floatingPointBinaryOperators = "+,-,*,/".split(",")
            const floatingPointUnaryOperators = "+,-".split(",")
            for(const type of floatingPointTypes) {
                for (const op of floatingPointBinaryOperators) {
                    t(`fun test(a: ${type}, b: ${type}): ${type} = a ${op} b`)
                }
                for (const op of comparisonOperators) {
                    t(`fun test(a: ${type}, b: ${type}): Boolean = a ${op} b`)
                }
                for (const op of floatingPointUnaryOperators) {
                    t(`fun test(a: ${type}): ${type} = ${op}a`)
                }
            }
        })
        it("can check logical operators", () => {
            const logicalTypes = "Boolean".split(",")
            const logicalBinaryOperators = "&&,||".split(",")
            const logicalUnaryOperators = "!".split(",")
            for(const type of logicalTypes) {
                for (const op of logicalBinaryOperators) {
                    t(`fun test(a: ${type}, b: ${type}): ${type} = a ${op} b`)
                }
                for (const op of "==,!=".split(",")) {
                    t(`fun test(a: ${type}, b: ${type}): Boolean = a ${op} b`)
                }
                for (const op of logicalUnaryOperators) {
                    t(`fun test(a: ${type}): ${type} = ${op}a`)
                }
            }
        })
        it("can check a sizeof expression", () => {
            t("fun test(): Int = sizeof Int;")
        })
        it("can check a block expression", () => {
            t(`
                fun test(): Int {
                    let a: Int = block { 10 };
                    return a;
                }
            `)
        })
        it("can detect taking the address of a no addressable", () => {
            d(`
                fun test(): Int^ {
                    var a: Int = 1;
                    return !{The value does not have an address}!&a;
                }
            `)
        })
        it("can detect dereferencing a non-pointer", () => {
            d(`
                fun test(): Int {
                    var a: Int = 2;
                    var b: Int = !{Expected a pointer type}!a^;
                    return a;
                }
            `)
        })
        it("can detect a duplicate field name in struct literal", () => {
            d(`
                type Point = < x: Float64, y: Float64 >;

                fun test(): Point = { x: 1.0, y: 2.0, !{Duplicate field name}!x: 3.0 };
            `)
        })
        it("can detect calling a non-function", () => {
            d(`
                fun test(): Int {
                    var a: Int = 1;
                    return !{An expression of type Int is not callable}!!{Expected a function reference}!a();
                }
            `)
        })
        it("can detect the wrong number of parameters", () => {
            d(`
                fun target(a: Int, b: Int, c: Int): Void { }
                fun test(): Void {
                    !{Expected 3 arguments, received 1}!target(1)
                }
            `)
        })
        it("can detect a missing field", () => {
            d(`
                import host { fun getPoint(): Point }

                type Point = < x: Int, y: Int >;

                fun test(): Int {
                    return getPoint().!{Type Point does not have member "z"}!z;
                }
            `)
        })
        it("can successfully type selecting a result", () => {
            t(`
                import host { fun getPoint(): Point }

                type Point = < x: Int, y: Int >;

                fun test(): Int = getPoint().x;
            `)
        })
        it("can detect an reference to an invalid builtin", () => {
            d(`
                fun test(a: Int): Int = a.!{Type Int does not have a member "invalidBuiltin"}!invalidBuiltin();
            `)
        })
        it("can detect assigning a value non-location", () => {
            d(`
                import host { fun getPoint(): Point }

                type Point = < x: Int, y: Int >;

                fun test(a: Int): Void {
                    !{This expression cannot be assigned}!getPoint().x = 12;
                }
            `)
        })
        it("can detect an invalid branch label", () => {
            d(`
                fun test(): Void {
                    var x: Int = 1;
                    loop loop3 {
                        if (x > 0) {
                            !{Branch target "loop2" not found}!branch loop2;
                        }
                    }
                }
            `)
        })
        it("can detect when a branch is invalid", () => {
            d(`
                fun test(): Void {
                    !{Not in a block or loop}!branch;
                }
            `)
        })
        it("can detect a duplicate parameter name", () => {
            d(`
                fun test(a: Int, !{Duplicate parameter name}!a: Int): Void {

                }
            `)
        })
        it("can detect reference to an undefined type", () => {
            d(`
                fun test(): !{Type "Invalid" not found}!Invalid {

                }
            `)
        })
    })

    describe('integers', () => {
        function tx(text: string): [Module, CheckResult] {
            return t(text)
        }
        describe("i8", () => {
            describe("bitwise operators", () => {
                function t(expr: string) {
                    tx(`var a: Int8 = 1t; var b: Int8 = 2t; var v: Int8 = ${expr}`)
                }

                it("can check a bitwise and", () => {
                    t("a & b")
                })
                it("can check a bitwise or", () => {
                    t("a | b")
                })
                it("can check a bitwise xor", () => {
                    t("a xor b")
                })
                it("can check a shr", () => {
                    t("a shr 1")
                })
                it("can check a shl", () => {
                    t("a shl 2")
                })
            })
        })
        describe("i16", () => {
            describe("bitwise operators", () => {
                function t(expr: string) {
                    tx(`var a: Int16 = 1s; var b: Int16 = 2s; var v: Int16 = ${expr}`)
                }

                it("can check a bitwise and", () => {
                    t("a & b")
                })
                it("can check a bitwise or", () => {
                    t("a | b")
                })
                it("can check a bitwise xor", () => {
                    t("a xor b")
                })
                it("can check a shr", () => {
                    t("a shr 1")
                })
                it("can check a shl", () => {
                    t("a shl 2")
                })
            })
        })
        describe("i32", () => {
            describe("bitwise operators", () => {
                function t(expr: string): [Module, CheckResult] {
                    return tx(`var a: Int32 = 1; var b: Int32 = 2; var v: Int32 = ${expr}`)
                }

                it("can check a bitwise and", () => {
                    t("a & b")
                })
                it("can check a bitwise or", () => {
                    t("a | b")
                })
                it("can check a bitwise xor", () => {
                    t("a xor b")
                })
                it("can check a shr", () => {
                    t("a shr 1")
                })
                it("can check a shl", () => {
                    t("a shl 2")
                })
                it("can check a ror", () => {
                    t("a ror 1")
                })
                it("can check a rol", () => {
                    t("a rol 1")
                })
            })
        })
        describe("i64", () => {
            describe("bitwise operators", () => {
                function t(expr: string) {
                    tx(`var a: Int64 = 1l; var b: Int64 = 2l; var v: Int64 = ${expr}`)
                }

                it("can check a bitwise and", () => {
                    t("a & b")
                })
                it("can check a bitwise or", () => {
                    t("a | b")
                })
                it("can check a bitwise xor", () => {
                    t("a xor b")
                })
                it("can check a shr", () => {
                    t("a shr 1l")
                })
                it("can check a shl", () => {
                    t("a shl 2l")
                })
                it("can check a ror", () => {
                    t("a ror 1l")
                })
                it("can check a rol", () => {
                    t("a rol 1l")
                })
            })
        })
        describe("u8", () => {
            describe("bitwise operators", () => {
                function t(expr: string) {
                    tx(`var a: UInt8 = 1ut; var b: UInt8 = 2ut; var v: UInt8 = ${expr}`)
                }

                it("can check a bitwise and", () => {
                    t("a & b")
                })
                it("can check a bitwise or", () => {
                    t("a | b")
                })
                it("can check a bitwise xor", () => {
                    t("a xor b")
                })
                it("can check a shr", () => {
                    t("a shr 1")
                })
                it("can check a shl", () => {
                    t("a shl 2")
                })
            })
        })
        describe("u16", () => {
            describe("bitwise operators", () => {
                function t(expr: string) {
                    tx(`var a: UInt16 = 1us; var b: UInt16 = 2us; var v: UInt16 = ${expr}`)
                }

                it("can check a bitwise and", () => {
                    t("a & b")
                })
                it("can check a bitwise or", () => {
                    t("a | b")
                })
                it("can check a bitwise xor", () => {
                    t("a xor b")
                })
                it("can check a shr", () => {
                    t("a shr 1")
                })
                it("can check a shl", () => {
                    t("a shl 2")
                })
            })
        })
        describe("u32", () => {
            describe("bitwise operators", () => {
                function t(expr: string) {
                    tx(`var a: UInt32 = 1u; var b: UInt32 = 2u; var v: UInt32 = ${expr}`)
                }

                it("can check a bitwise and", () => {
                    t("a & b")
                })
                it("can check a bitwise or", () => {
                    t("a | b")
                })
                it("can check a bitwise xor", () => {
                    t("a xor b")
                })
                it("can check a shr", () => {
                    t("a shr 1")
                })
                it("can check a shl", () => {
                    t("a shl 2")
                })
                it("can check a ror", () => {
                    t("a ror 1")
                })
                it("can check a rol", () => {
                    t("a rol 1")
                })
            })
        })
        describe("u64", () => {
            describe("bitwise operators", () => {
                function t(expr: string) {
                    tx(`var a: UInt64 = 1ul; var b: UInt64 = 2ul; var v: UInt64 = ${expr}`)
                }

                it("can check a bitwise and", () => {
                    t("a & b")
                })
                it("can check a bitwise or", () => {
                    t("a | b")
                })
                it("can check a bitwise xor", () => {
                    t("a xor b")
                })
                it("can check a shr", () => {
                    t("a shr 1l")
                })
                it("can check a shl", () => {
                    t("a shl 2l")
                })
                it("can check a ror", () => {
                    t("a ror 1l")
                })
                it("can check a rol", () => {
                    t("a rol 1l")
                })
            })
        })
    })

    describe("pointers", () => {
        it("can check a pointer converted to an UInt", () => {
            t(`
                var a: Int;
                var b: Int^ = &a;
                var c: UInt = b as UInt;
            `)
        })
        it("can check a conversion of a UInt to a pointer", () => {
            t(`
                var a: UInt;
                var b: Int^ = a as Int^;
            `)
        })
    })

    describe("negative tests", () => {
        it("can report array locals", () => {
            d(`
                fun sum(a: Int[]^, size: Int): Int {
                    return size
                }
                fun test(): Void {
                    var a: !{Local arrays are not supported}!Int[2] = [1, 2];
                    sum(!{The value does not have an address}!&a, 2);
                }
            `)
        })
        it("can report when taking the address of a local", () => {
            d(`
                fun t(a: Int^): Int = a^
                fun test(): Void {
                    var a: Int = 1;
                    t(!{The value does not have an address}!&a)
                }
            `)
        })
    })
})

function report(text: string, name: string, diagnostics: Diagnostic[], fileSet: FileSet | undefined): never {
    const messages: string[] = []
    for (const diagnostic of diagnostics) {
        if (diagnostic.location.start) {
            const position = fileSet?.position(diagnostic.location)?.display() ?? diagnostic.location.start
            messages.push(`${position}: ${diagnostic.message}`);
        } else {
            messages.push(diagnostic.message)
        }
    }
    throw new Error(messages.join("\n"))
}

function p(text: string, name: string = "<text>", fileSet: FileSet | undefined = undefined): Module {
    const builder = fileSet?.buildFile(name, text.length)
    const scanner = new Scanner(text + "\0", builder)
    const module = parse(scanner, builder)
    builder?.build()
    if (Array.isArray(module)) {
        report(text, name, module, fileSet)
    }
    return module
}

function t(text: string, name: string = "<text>"): [Module, CheckResult] {
    const fileSet = new FileSet()
    const module = p(text, name, fileSet)
    const types = check(module)
    if (Array.isArray(types)) {
        report(text, name, types, fileSet)
    }
    return [module, types]
}

function diagnosticsOf(text: string): [string, Diagnostic[]] {
    const diagnostics: Diagnostic[] = []
    while (true) {
        const start = text.indexOf("!{")
        if (start < 0) return [text, diagnostics];
        const end = text.indexOf("}!", start)
        const message = text.substring(start + 2, end)
        text = text.substring(0, start) + text.substring(end + 2)
        diagnostics.push({ location: { start }, message })
    }
}

function d(spec: string, name: string = "<text>") {
    const [text, diagnostics] = diagnosticsOf(spec)
    if (diagnostics.length <= 0) error("Incorrect specification")
    const fileSet = new FileSet()
    const module = p(text, name, fileSet)
    const result = check(module)
    if (Array.isArray(result)) {
        const file = fileSet.file(name)
        if (!file) error("Incorrect specification")
        let expectedIndex = 0
        let receivedIndex = 0
        while (expectedIndex < diagnostics.length || receivedIndex < result.length) {
            const expectedPos = expectedIndex < diagnostics.length ?
                file.pos(diagnostics[expectedIndex].location.start!!) :
                Number.MAX_SAFE_INTEGER
            const receivedPos = receivedIndex < result.length ?
                result[receivedIndex].location.start!! :
                Number.MAX_SAFE_INTEGER
            if (expectedPos < receivedPos) {
                error(`Expected a diagnostic at ${file.position({
                    start: expectedPos
                }).display()}: ${diagnostics[expectedIndex].message}`)
            } else if (receivedPos < expectedPos) {
                const diagnostic = result[receivedIndex]
                error(`Unexpected diagnostic at ${
                    file.position(diagnostic.location).display()
                }: ${diagnostic.message}`)
            } else {
                const expected = diagnostics[expectedIndex++].message
                const received = result[receivedIndex++].message
                expect(received).toEqual(expected)
            }
        }
    } else {
        error("Expected at least one diagnostic")
    }
}

function te(name: string): [Module, CheckResult] {
    const text = fs.readFileSync(`examples/${name}`, 'utf-8')
    return t(text, name)
}
