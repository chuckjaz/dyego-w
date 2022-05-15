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
                import host { fun printI32(text: i32): void };

                fun test(value: i32): void {
                    printI32(value);
                }
            `)
        })
        it("can enter a variable", () => {
            t(`
                import host {
                    var count: i32,
                    var offset: i32
                 };

                fun test(): i32 = count + offset;
            `)
        })
    })
    describe("declarations", () => {
        describe("let", () => {
            it("can detect a type error", () => {
                d("let a: i64 = !{Expected type i64, received i32}!10;")
            })
        })
        describe("var", () => {
            it("can detect a type error", () => {
                d("var a: i64 = !{Expected type i64, received i32}!10;")
            })
            it("can infer a type", () => {
                t("var a = 10")
            })
            it("can detect a type error with an inferred type", () => {
                d("var a = 10; var b: i64 = !{Expected type i64, received i32}!a")
            })
        })
        describe("fun", () => {
            it("can detect a result error", () => {
                d("fun test(): i64 = !{Expected type i64, received i32}!10")
            })
            it("can detect a return result type error", () => {
                d(`
                    fun test(): i64 {
                        return !{Expected type i64, received i32}!10;
                    }
                `)
            })
            it("can detect a missing return", () => {
                d(`
                    fun test(): i64 {
                        !{Last statement must be a return or an expresion}!let a: i32 = 10;
                    }
                `)
            })
        })
        describe("global", () => {
            it("declare a global", () => {
                t("global a: i32 = 10;")
            })
            it("can the value in an exprssion", () => {
                t(`
                    global a: i32 = 10;

                    fun test(): i32 = a + 10;
                `)
            })
            it("detect an type mismatch", () => {
                d("global a: i32 = !{Expected type i32, received f64}!1.0")
            })
        })
    })
    describe("expression", () => {
        const comparisonOperators = "<,>,>=,<=,==,!=".split(",")

        it("can detect an undefined reference", () => {
            d(`let a: i32 = !{Symbol "b" not found}!b`)
        })
        it("can detect a capability error", () => {
            d(`let a: bool = !{Operator "+" not supported for type bool}!true + false`)
        })
        it("can detected an invalid pointer operator", () => {
            d(`var a: i32^; var b: i32^ = !{Operator "*" not supported for type i32^}!a * a`)
        })
        it("can check numeric operators", () => {
            const numericTypes = "i8,i16,i32,i64,u8,u16,u32,u64".split(",")
            const numericBinaryOperators = "+,-,*,/,%".split(",")
            const numericUnaryOperators = "~,+,-".split(",")
            for (const type of numericTypes) {
                for (const op of numericBinaryOperators) {
                    t(`fun test(a: ${type}, b: ${type}): ${type} = a ${op} b`)
                }
                for (const op of comparisonOperators) {
                    t(`fun test(a: ${type}, b: ${type}): bool = a ${op} b`)
                }
                for (const op of numericUnaryOperators) {
                    t(`fun test(a: ${type}): ${type} = ${op}a`)
                }
            }
        })
        it("can check floating point operators", () => {
            const floatingPointTypes = "f32,f64".split(",")
            const floatingPointBinaryOperators = "+,-,*,/".split(",")
            const floatingPointUnaryOperators = "+,-".split(",")
            for(const type of floatingPointTypes) {
                for (const op of floatingPointBinaryOperators) {
                    t(`fun test(a: ${type}, b: ${type}): ${type} = a ${op} b`)
                }
                for (const op of comparisonOperators) {
                    t(`fun test(a: ${type}, b: ${type}): bool = a ${op} b`)
                }
                for (const op of floatingPointUnaryOperators) {
                    t(`fun test(a: ${type}): ${type} = ${op}a`)
                }
            }
        })
        it("can check logical operators", () => {
            const logicalTypes = "bool".split(",")
            const logicalBinaryOperators = "&&,||".split(",")
            const logicalUnaryOperators = "!".split(",")
            for(const type of logicalTypes) {
                for (const op of logicalBinaryOperators) {
                    t(`fun test(a: ${type}, b: ${type}): ${type} = a ${op} b`)
                }
                for (const op of "==,!=".split(",")) {
                    t(`fun test(a: ${type}, b: ${type}): bool = a ${op} b`)
                }
                for (const op of logicalUnaryOperators) {
                    t(`fun test(a: ${type}): ${type} = ${op}a`)
                }
            }
        })
        it("can check a sizeof expression", () => {
            t("fun test(): i32 = sizeof i32;")
        })
        it("can check a block expression", () => {
            t(`
                fun test(): i32 {
                    let a: i32 = block { 10 };
                    return a;
                }
            `)
        })
        it("can detect taking the address of a no addressable", () => {
            d(`
                fun test(): i32^ {
                    var a: i32 = 1;
                    return !{The value does not have an address}!&a;
                }
            `)
        })
        it("can detect dereferencing a non-pointer", () => {
            d(`
                fun test(): i32 {
                    var a: i32 = 2;
                    var b: i32 = !{Expected a pointer type}!a^;
                    return a;
                }
            `)
        })
        it("can detect a duplicate field name in struct literal", () => {
            d(`
                type Point = < x: f64, y: f64 >;

                fun test(): Point = { x: 1.0, y: 2.0, !{Duplicate field name}!x: 3.0 };
            `)
        })
        it("can detect calling a non-function", () => {
            d(`
                fun test(): i32 {
                    var a: i32 = 1;
                    return !{An expression of type i32 is not callable}!!{Expected a function reference}!a();
                }
            `)
        })
        it("can detect the wrong number of parameters", () => {
            d(`
                fun target(a: i32, b: i32, c: i32): void { }
                fun test(): void {
                    !{Expected 3 arguments, received 1}!target(1)
                }
            `)
        })
        it("can detect a missing field", () => {
            d(`
                import host { fun getPoint(): Point }

                type Point = < x: i32, y: i32 >;

                fun test(): i32 {
                    return getPoint().!{Type Point does not have member "z"}!z;
                }
            `)
        })
        it("can successfully type selecting a result", () => {
            t(`
                import host { fun getPoint(): Point }

                type Point = < x: i32, y: i32 >;

                fun test(): i32 = getPoint().x;
            `)
        })
        it("can detect an reference to an invalid builtin", () => {
            d(`
                fun test(a: i32): i32 = a.!{Type i32 does not have a member "invalidBuiltin"}!invalidBuiltin();
            `)
        })
        it("can detect assigning a value non-location", () => {
            d(`
                import host { fun getPoint(): Point }

                type Point = < x: i32, y: i32 >;

                fun test(a: i32): void {
                    !{This expression cannot be assigned}!getPoint().x = 12;
                }
            `)
        })
        it("can detect an invalid branch label", () => {
            d(`
                fun test(): void {
                    var x: i32 = 1;
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
                fun test(): void {
                    !{Not in a block or loop}!branch;
                }
            `)
        })
        it("can detect a duplicate parameter name", () => {
            d(`
                fun test(a: i32, !{Duplicate parameter name}!a: i32): void {

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
                    tx(`var a: i8 = 1t; var b: i8 = 2t; var v: i8 = ${expr}`)
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
                    tx(`var a: i16 = 1s; var b: i16 = 2s; var v: i16 = ${expr}`)
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
                    return tx(`var a: i32 = 1; var b: i32 = 2; var v: i32 = ${expr}`)
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
                    tx(`var a: i64 = 1l; var b: i64 = 2l; var v: i64 = ${expr}`)
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
                    tx(`var a: u8 = 1ut; var b: u8 = 2ut; var v: u8 = ${expr}`)
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
                    tx(`var a: u16 = 1us; var b: u16 = 2us; var v: u16 = ${expr}`)
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
                    tx(`var a: u32 = 1u; var b: u32 = 2u; var v: u32 = ${expr}`)
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
                    tx(`var a: u64 = 1ul; var b: u64 = 2ul; var v: u64 = ${expr}`)
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
        it("can check a pointer reinterpret as an u32", () => {
            t(`
                var a: i32;
                var b: i32^ = &a;
                var c: u32 = b reinterpretas u32;
            `)
        })
        it("can check a conversion of a u32 to a pointer", () => {
            t(`
                var a: u32;
                var b: i32^ = a reinterpretas i32^;
            `)
        })
        it("can use array indexing as a substitute for pointer arithmetic", () => {
            t(`
                var a: u8[123];
                var p = (&(a[10])) reinterpretas u8[]^;
                var p2 = &p^[1];
            `)
        })
    })

    describe("string literal", () => {
        it("can use a string literal to initialize a var", () => {
            t(`var v: u8[] = "a value";`)
        })
    })

    describe("structs", () => {
        it("can pass a struct as a parameter", () => {
            t(`
                type Point = < x: i32, y: i32 >;

                fun offset(p: Point, offset: i32): Point {
                    return {x: p.x + offset, y: p.y + offset }
                }

                fun test(): void {
                    var p: Point = {x: 10, y: 20};
                    var p2: Point = offset(p, 22);
                }
            `)
        })
    })

    describe("unions", () => {
        it("can declare a union type", () => {
            t(`type Union = <| i: i32, l: i64, f: f64 |>`)
        })
        it("can declare a union variable", () => {
            t(`
                type Union = <| i: i32, l: i64, f: f64 |>;
                var u: Union;
            `)
        })
        it("can assign a value to a union field", () => {
            t(`
                type Union = <| i: i32, l: i64, f: f64 |>;
                var u: Union;

                fun test(): void {
                    u.i = 42;
                    u.l = 42l;
                    u.f = 4.2;
                }
            `)
        })
    })

    describe("negative tests", () => {
        it("can report array locals", () => {
            d(`
                fun sum(a: i32[]^, size: i32): i32 {
                    return size
                }
                fun test(): void {
                    var a: !{${nonLocalError("i32[2]")}}!i32[2] = [1, 2];
                    sum(!{The value does not have an address}!&a, 2);
                }
            `)
        })
        it("can report when taking the address of a local", () => {
            d(`
                fun t(a: i32^): i32 = a^
                fun test(): void {
                    var a: i32 = 1;
                    t(!{The value does not have an address}!&a)
                }
            `)
        })
    })
})

function nonLocalError(name: string) {
    return `A value of type ${name} (or struct containing that type) cannot be passed as a parameter, returned as a result, declared as global, or stored in a local variable`
}

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
    if (types.diagnostics.length > 0) {
        report(text, name, types.diagnostics, fileSet)
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
