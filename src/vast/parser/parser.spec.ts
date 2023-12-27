import { FileSet } from "../../files"
import { Argument, ArgumentModifier, Block, Call, Declaration, Expression, FieldLiteralModifier, Function, I32Literal, Kind, Lambda, Let, Module, Node, Parameter, ParameterModifier, PrimitiveKind, Reference, Statement, StructTypeConstuctorField, TypeExpression } from "../ast"
import { dump } from "../dump-ast"
import { parse } from "./parser"
import { Scanner } from "./scanner"

import * as fs from "fs"

describe("module", () => {
    it("can parse an empty module", () => {
        expect(m("")).toEqual({
            kind: Kind.Module,
            declarations: []
        })
    })
})

describe("expression", () => {
    describe("literal", () => {
        it("can parse an i32", () => {
            expect(e("1")).toEqual(one)
        })
        it("can parse an i8", () => {
            expect(e("1t")).toEqual({
                kind: Kind.Literal,
                primitiveKind: PrimitiveKind.I8,
                value: 1
            })
        })
        it("can parse an i16", () => {
            expect(e("1s")).toEqual({
                kind: Kind.Literal,
                primitiveKind: PrimitiveKind.I16,
                value: 1
            })
        })
        it("can parse an i64", () => {
            expect(e("1l")).toEqual({
                kind: Kind.Literal,
                primitiveKind: PrimitiveKind.I64,
                value: 1n
            })
        })
        it("can parse an u8", () => {
            expect(e("1ut")).toEqual({
                kind: Kind.Literal,
                primitiveKind: PrimitiveKind.U8,
                value: 1
            })
        })
        it("can parse an u16", () => {
            expect(e("1us")).toEqual({
                kind: Kind.Literal,
                primitiveKind: PrimitiveKind.U16,
                value: 1
            })
        })
        it("can parse an u32", () => {
            expect(e("1u")).toEqual({
                kind: Kind.Literal,
                primitiveKind: PrimitiveKind.U32,
                value: 1
            })
        })
        it("can parse an u64", () => {
            expect(e("1ul")).toEqual({
                kind: Kind.Literal,
                primitiveKind: PrimitiveKind.U64,
                value: 1n
            })
        })
        it("can parse true", () => {
            expect(e("true")).toEqual({
                kind: Kind.Literal,
                primitiveKind: PrimitiveKind.Bool,
                value: true
            })
        })
        it("can parse false", () => {
            expect(e("false")).toEqual({
                kind: Kind.Literal,
                primitiveKind: PrimitiveKind.Bool,
                value: false
            })
        })
        it("can parse a double", () => {
            expect(e("1.0")).toEqual({
                kind: Kind.Literal,
                primitiveKind: PrimitiveKind.F64,
                value: 1
            })
        })
        it("can parse a float", () => {
            expect(e("1.0f")).toEqual({
                kind: Kind.Literal,
                primitiveKind: PrimitiveKind.F32,
                value: 1
            })
        })
        it("can parse a null", () => {
            expect(e("null")).toEqual({
                kind: Kind.Literal,
                primitiveKind: PrimitiveKind.Null,
                value: null,
            })
        })
    })
    describe("lamba", () => {
        it("can parse a simple lambda", () => {
            expect(e("{ a; a; a }")).toEqual(lda([], [a, a, a]))
        })
    })
    describe("call", () => {
        it("can parse a simple call", () => {
            expect(e("a()")).toEqual(call("a"))
        })
        it("can parse a call with a ordered argument", () => {
            expect(e("a(1)")).toEqual(call("a", 1))
        })
        it("can parse a call a named argument", () => {
            expect(e("a(name: 1)")).toEqual(call("a", namedArg("name", one)))
        })
        it("can parse a call with a mix of named and unnamed arguments", () => {
            expect(e("a(1, 1, name: 1, name2: 1)")).toEqual(
                call("a", arg(one), arg(one), namedArg("name", one), namedArg("name2", one))
            )
        })
        it("can call using juxtaposition", () => {
            expect(e("a a")).toEqual(call("a", arg(a)))
        })
        it("can reduce multiple expressions", () => {
            expect(e("a b c")).toEqual(call(call("a", arg(r("b"))), arg(r("c"))))
        })
    })
    describe("if", () => {
        it("can parse an if with else", () => {
            expect(e("if (a) { a } else { a }")).toEqual(
                {
                    kind: Kind.If,
                    condition: a,
                    then: blk(a),
                    else: blk(a),
                }
            )
        })
        it("can parse an if with no else", () => {
            expect(e("if (a) { a }")).toEqual(
                {
                    kind: Kind.If,
                    condition: a,
                    then: blk(a),
                    else: blk(),
                }
            )
        })
    })
    describe("index", () => {
        it("can parse an index", () => {
            expect(e("a[a]")).toEqual({
                kind: Kind.Index,
                target: a,
                index: a
            })
        })
    })
})

describe("declarations", () => {
    it("can parse a simple let", () => {
        expect(d("let a = 1")).toEqual(lets("a", one))
    })
})

describe("examples", () => {
    it("can parse sum.vast.dg", () => {
        parseExample("sum.vast.dg")
    })
    it("can parse atoi.vast.dg", () => {
        parseExample("atoi.vast.dg")
    })
    it("can parse binary-tree.vast.dg", () => {
        parseExample("binary-tree.vast.dg")
    })
})

function m(text: string): Module {
    const scanner = new Scanner(text)
    const { module, diagnostics } = parse(scanner)
    expect(diagnostics).toEqual([])
    if (!diagnostics.length) {
        return noLocations(module)
    }
    return module
}

function parseFile(text: string, name: string = "<text>"): Module {
    const fileSet = new FileSet()
    const builder = fileSet.buildFile(name, text.length, text)
    const scanner = new Scanner(text, builder)
    const fileInfo = builder.build()
    const { module, diagnostics } = parse(scanner, builder)
    if (diagnostics.length > 0) {
        const messages: string[] = []
        for (const diagnostic of diagnostics) {
            const location = diagnostic.location
            if (location.start) {
                const position = fileInfo.position(location)
                messages.push(`${position.display()} ${diagnostic.message}`);
            } else {
                messages.push(diagnostic.message)
            }
        }
        throw new Error(messages.join("\n"))
    }
    return module
}

function parseExample(name: string): Module {
    const text = fs.readFileSync(`src/vast/examples/vast/${name}`, 'utf-8')
    return parseFile(text, name)
}

function d(text: string): Declaration {
    const module = m(text)
    expect(module.declarations.length).toEqual(1)
    return module.declarations[0]
}

function e(text: string): Expression {
    const l = d(`let _ = ${text}`)
    if (l.kind == Kind.Let) {
        return l.value
    }
    throw Error("Incorrect result of declaration")
}

function lets(name: string, value: Expression, type: TypeExpression = { kind: Kind.Infer }): Let {
    return { kind: Kind.Let, name: r(name), value, type }
}

function blk(...statements: Statement[]): Block {
    return {
        kind: Kind.Block,
        statements
    }
}

function lda(parameters: Parameter[], statements: Statement[], result: TypeExpression = { kind: Kind.Infer }): Lambda {
    return {
        kind: Kind.Lambda,
        parameters,
        result,
        body: blk(...statements)
    }
}

function r(name: string): Reference {
    return { kind: Kind.Reference, name }
}

const one: I32Literal = {
    kind: Kind.Literal,
    primitiveKind: PrimitiveKind.I32,
    value: 1
}

const a: Reference = {
    kind: Kind.Reference,
    name: 'a'
}

const b: Reference = {
    kind: Kind.Reference,
    name: 'b'
}

function int(value: number): I32Literal {
    return {
        kind: Kind.Literal,
        primitiveKind: PrimitiveKind.I32,
        value
    }
}

function arg(value: Expression): Argument {
    return {
        kind: Kind.Argument,
        modifier: ArgumentModifier.None,
        value
    }
}

function namedArg(name: string, value: Expression, modifier: ArgumentModifier = ArgumentModifier.None): Argument {
    return {
        kind: Kind.Argument,
        modifier,
        name: r(name),
        value
    }
}

function call(target: string | Expression, ...args: (Argument | number | string)[]): Call {
    return {
        kind: Kind.Call,
        target: typeof target == 'string' ? r(target) : target,
        arguments: args.map(a => typeof a == 'number' ? arg(int(a)) : typeof a == 'string' ? arg(r(a)) : a) as Argument[]
    }
}

function noLocations(module: Module): Module {
    noLocation(module)
    module.declarations.forEach(statement)
    return module

    function statement(s: Statement) {
        noLocation(s)
        switch (s.kind) {
            case Kind.Break:
            case Kind.Continue:
                break
            case Kind.For:
                noLocation(s.item)
                if (s.item.kind == Kind.ImplicitVal) {
                    noLocation(s.item)
                    noLocation(s.item.name)
                    typeExpression(s.item.type)
                } else {
                    statement(s.item)
                }
                if (s.index) noLocation(s.index)
                expression(s.target)
                expression(s.body)
                break
            case Kind.Function:
                noLocation(s.name)
                s.parameters.forEach(parameter)
                typeExpression(s.result)
                expression(s.body)
                break
            case Kind.Let:
                noLocation(s.name)
                typeExpression(s.type)
                expression(s.value)
                break
            case Kind.Return:
                if (s.value) expression(s.value)
                break
            case Kind.TypeDeclaration:
                noLocation(s.name)
                typeExpression(s.type)
                break
            case Kind.Val:
                noLocation(s.name)
                typeExpression(s.type)
                expression(s.value)
                break
            case Kind.Var:
                noLocation(s.name)
                typeExpression(s.type)
                if (s.value) expression(s.value)
                break
            case Kind.While:
                expression(s.condition)
                expression(s.body)
                break
            case Kind.When:
                if (s.target) statement(s.target)
                s.clauses.forEach(c => {
                    const condition = c.condition
                    switch (condition.kind) {
                        case Kind.IsCondition:
                            noLocation(condition)
                            typeExpression(condition.target)
                            break
                        case Kind.ElseCondition:
                            break
                        default:
                            expression(condition)
                            break
                    }
                    expression(c.body)
                })
                break
            default:
                expression(s)
        }
    }

    function parameter(p: Parameter) {
        noLocation(p)
        const name = p.name
        if (typeof name  != 'number') noLocation(name)
        noLocation(p.alias)
        typeExpression(p.type)
    }

    function typeExpression(type: TypeExpression) {
        noLocation(type)
        switch (type.kind) {
            case Kind.ArrayTypeConstructor:
                typeExpression(type.element)
                const size = type.size
                if (size) expression(size)
                break
            case Kind.Reference:
            case Kind.Infer:
                break
            case Kind.FunctionType:
                type.parameters.forEach(parameter)
                typeExpression(type.result)
                break
            case Kind.StructTypeConstructor:
                type.fields.forEach(field)
                type.methods.forEach(statement)
                type.types.forEach(statement)
                break
            case Kind.TypeSelect:
                typeExpression(type.target)
                noLocation(type.name)
                break
        }
    }

    function expression(e: Expression) {
        noLocation(e)
        switch (e.kind) {
            case Kind.ArrayLiteral:
                e.values.forEach(expression)
                break
            case Kind.As:
                expression(e.left)
                typeExpression(e.right)
                break
            case Kind.Assign:
                expression(e.target)
                expression(e.value)
                break
            case Kind.Block:
                e.statements.forEach(statement)
                break
            case Kind.Reference:
            case Kind.Literal:
                break
            case Kind.Call:
                expression(e.target)
                e.arguments.forEach(a => {
                    noLocation(a)
                    if (a.name) noLocation(a.name)
                    expression(a.value)
                })
                break
            case Kind.If:
                expression(e.condition)
                expression(e.then)
                expression(e.else)
                break
            case Kind.Index:
                expression(e.target)
                expression(e.index)
                break
            case Kind.Lambda:
                e.parameters.forEach(parameter)
                typeExpression(e.result)
                expression(e.body)
                break
            case Kind.Select:
                expression(e.target)
                noLocation(e.name)
                break
            case Kind.StructLiteral:
                e.fields.forEach(f => {
                    noLocation(f)
                    noLocation(f.name)
                    expression(f.value)
                })
                break
        }
    }

    function field(field: StructTypeConstuctorField) {
        noLocation(field.name)
        typeExpression(field.type)
    }

    function noLocation(n: Node) {
        delete n.start
        delete n.end
    }
}
