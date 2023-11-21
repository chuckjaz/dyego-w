import { Diagnostic, Locatable } from "../../last";
import { Argument, ArgumentModifier, ArrayLiteral, Block, Call, Declaration, ElseCondition, Expression, FieldLiteral, FieldLiteralModifier, For, Function, ImplicitVal, IsCondition, Kind, Lambda, Let, Module, Node, Parameter, ParameterModifier, PrimitiveKind, Reference, Select, Statement, StructLiteral, StructTypeConstuctorField, StructTypeConstuctorFieldModifier, TypeDeclaration, TypeExpression, Val, Var, When, WhenClause, While } from "../ast";
import { Scanner } from "./scanner";
import { Token, toString  } from "./tokens";

function tokenString(token: Token): string {
    return toString(token)
}

interface PositionMap {
    pos(offset: number): number
}

export interface ParseResult {
    module: Module
    diagnostics: Diagnostic[]
}

export function parse(scanner: Scanner, builder?: PositionMap): { module: Module, diagnostics: Diagnostic[] } {
    let follows = setOf(Token.EOF, Token.Fun, Token.Var, Token.Let, Token.Type)
    let token = scanner.next()
    let diagnostics: Diagnostic[] = []
    const pos = builder ? {
        get start() { return builder.pos(scanner.start) },
        get end() { return builder.pos(scanner.end) }
    } : {
        get start() { return scanner.start },
        get end() { return scanner.end},
    };

    const result = module()
    expect(Token.EOF)
    return { module: result, diagnostics }

    function module(): Module {
        return loc(() => {
            const declarations = declarationStatements()
            return { kind: Kind.Module, declarations }
        })
    }

    function declarationStatements(): Declaration[] {
        return sequence(declarationStatement, declarationFirstSet, declarationFirstSet)
    }

    function declarationStatement(): Declaration {
        switch (token) {
            case Token.Let:
                return letDeclaration()
            case Token.Var:
                return varDeclaration()
            case Token.Val:
                return valDeclaration()
            case Token.Type:
                return typeDeclaration()
            case Token.Fun:
                return funDeclaration()
            default:
                report("Expected a declaration")
                skip()
                return undefined as any as Declaration
        }
    }

    function letDeclaration(): Let {
        return loc(() => {
            expect(Token.Let)
            const name = expectName()
            const type = optionalTypeExpression()
            expect(Token.Equal)
            const value = expression()
            return { kind: Kind.Let, name, type, value }
        })
    }

    function valDeclaration(): Val {
        return loc(() => {
            expect(Token.Val)
            const name = expectName()
            const type = optionalTypeExpression()
            expect(Token.Equal)
            const value = expression()
            return { kind: Kind.Val, name, type, value }
        })
    }

    function varDeclaration(): Var {
        return loc(() => {
            expect(Token.Var)
            const name = expectName()
            const type = optionalTypeExpression()
            const value = optionalExpression()
            return { kind: Kind.Var, name, type, value }
        })
    }

    function funDeclaration(): Function {
        return loc(() => {
            expect(Token.Fun)
            const name = expectName()
            expect(Token.LParen)
            const parameters = functionParameters()
            expect(Token.RParen)
            const result = optionalTypeExpression()
            const body = block()
            return { kind: Kind.Function, name, parameters, result, body}
        })
    }

    function functionParameters(): Parameter[] {
        const parameters = sequence(parameter, parameterFirstSet, parameterFollowSet, comma)

        // Mark positional paraemters
        let position = 0
        for (const parameter of parameters) {
            const name = parameter.name
            if (parameter.alias != parameter.name && typeof name != "number" && name.name == "_") {
                parameter.name = position++
            }
        }

        return parameters
    }

    function parameter(): Parameter {
        return loc(() => {
            let modifier = ParameterModifier.None
            if (token == Token.Context) {
                next()
                modifier |= ParameterModifier.Context
            }
            if (token == Token.Var) {
                next()
                modifier |= ParameterModifier.Var
            }
            const name = expectName()
            let alias = name
            if (token == Token.Identifier) {
                alias = expectName()
            }
            expect(Token.Colon)
            const type = typeExpression()
            return { kind: Kind.Parameter, modifier, name, alias, type }
        })
    }

    function block(): Block {
        return loc(() => {
            expect(Token.LBrace)
            const statements = sequence(statement, statementFirstSet, statementFollowSet)
            expect(Token.RBrace)
            return { kind: Kind.Block, statements }
        })
    }

    function statement(): Statement {
        if (expressionFirstSet[token]) {
            return expression()
        }
        if (declarationFirstSet[token]) {
            return declarationStatement()
        }
        switch (token) {
            case Token.Return: {
                return loc(() => {
                    next()
                    let value: Expression | undefined = undefined
                    if (expressionFirstSet[token]) {
                        value = expression()
                    }
                    return { kind: Kind.Return, value }
                })
            }
            case Token.Break:
                return loc(() => {
                    next()
                    const target = optionalName()
                    return { kind: Kind.Break, target }
                })
            case Token.Continue:
                return loc(() => {
                    next()
                    const target = optionalName()
                    return { kind: Kind.Continue, target }
                })
            case Token.For:
                return forStatement()
            case Token.While:
                return whileStatement()
            default:
                report("Expected as statement")
                return undefined as any as Statement
        }
    }

    function when(): When {
        return loc(() => {
            expect(Token.When)
            let target: Expression | undefined = undefined
            if (token == Token.LParen) {
                expect(Token.LParen)
                target = expression()
                expect(Token.RParen)
            }
            expect(Token.LBrace)
            const clauses = sequence(whenClause, whenClauseFirstSet, whenClauseFollowSet)
            expect(Token.RBrace)
            return {
                kind: Kind.When,
                target,
                clauses
            }
        })
    }

    function whenClause(): WhenClause {
        return loc(() => {
            const condition = whenClauseCondition()
            expect(Token.Arrow)
            let body: Block
            if (token == Token.RBrace) {
                body = block()
            } else {
                const statements = [statement()]
                body = extend({
                    kind: Kind.Block,
                    statements
                }, ...statements)
            }
            return {
                kind: Kind.WhenClause,
                condition,
                body
            }
        })
    }

    function whenClauseCondition(): Expression | IsCondition | ElseCondition {
        return loc(() => {
            switch (token) {
                case Token.Else:
                    next()
                    return {
                        kind: Kind.ElseCondition
                    }
                case Token.Is: {
                    next()
                    const target = typeExpression()
                    return {
                        kind: Kind.IsCondition,
                        target
                    }
                }
                default:
                    return expression()
            }
        })
    }

    function forStatement(): For {
        return loc(() => {
            expect(Token.For)
            expect(Token.LParen)
            let item: ImplicitVal | Var
            if (token == Token.Var) {
                item = loc(() => {
                    next()
                    const name = expectName()
                    let type: TypeExpression = { kind: Kind.Infer }
                    if (token == Token.Colon) {
                        next()
                        type = typeExpression()
                    }
                    return {
                        kind: Kind.Var,
                        name,
                        type
                    }

                })
            } else {
                item = loc(() => {
                    const name = expectName()
                    let type: TypeExpression = { kind: Kind.Infer }
                    if (token == Token.Colon) {
                        next()
                        type = typeExpression()
                    }
                    return {
                        kind: Kind.ImplicitVal,
                        name,
                        type
                    }
                })
            }
            let index: ImplicitVal | undefined = undefined
            if (token == Token.Comma) {
                index = loc(() => {
                    next()
                    const name = expectName()
                    const type: TypeExpression = { kind: Kind.Infer }
                    return {
                        kind: Kind.ImplicitVal,
                        name,
                        type
                    }
                })
            }
            expect(Token.In)
            const target = expression()
            expect(Token.RParen)
            const body = block()
            return { kind: Kind.For, item, index, target, body }
        })
    }

    function whileStatement(): While {
        return loc(() => {
            expect(Token.While)
            expect(Token.LParen)
            const condition = expression()
            expect(Token.RParen)
            const body = block()
            return { kind: Kind.While, condition, body }
        })
    }

    function typeDeclaration(): TypeDeclaration {
        return loc(() => {
            expect(Token.Type)
            const name = expectName()
            expect(Token.Equal)
            const type = typeExpression()
            return { kind: Kind.TypeDeclaration, name, type }
        })
    }

    function optionalExpression(): Expression | undefined {
        if (token == Token.Equal) {
            next()
            return expression()
        }
        return undefined
    }

    function expression(firstName: Reference | undefined = undefined): Expression {
        return assignExpression(firstName)
    }

    function assignExpression(firstName: Reference | undefined = undefined): Expression {
        let left = orExpression(firstName)
        while (token == Token.Equal) {
            next()
            const right = orExpression()
            left = { kind: Kind.Assign, start: left.start, end: right.end, target: left, value: right}
        }
        return left
    }

    function orExpression(firstName: Reference | undefined = undefined): Expression {
        let left = andExpression(firstName)
        while (token == Token.Or) {
            const name = opName('infix ||')
            const right = andExpression()
            left = operatorCall(name, left, right)
        }
        return left
    }

    function andExpression(firstName: Reference | undefined = undefined): Expression {
        let left = compareExpression(firstName)
        while (token == Token.And) {
            const name = opName('infix ||')
            const right = compareExpression()
            left = operatorCall(name, left, right)
        }
        return left
    }

    function compareExpression(firstName: Reference | undefined = undefined): Expression {
        const left = addExpression(firstName)
        let operatorName = ''
        switch (token) {
            case Token.Gt: operatorName = `infix >`; break
            case Token.Lt: operatorName = `infix <`; break
            case Token.Gte: operatorName = `infix >=`; break
            case Token.Lte: operatorName = `infix <=`; break
            case Token.EqualEqual: operatorName = 'infix =='; break
            case Token.NotEqual: operatorName = 'infix !='; break
            default: return left
        }
        const name = opName(operatorName)
        next()
        const right = addExpression()
        return operatorCall(name, left, right)
    }

    function addExpression(firstName: Reference | undefined = undefined): Expression {
        let left = multiplyExpression(firstName)
        while (true) {
            switch (token) {
                case Token.Plus: left = operatorCall(opName('infix +'), left, multiplyExpression()); break
                case Token.Dash: left = operatorCall(opName('infix -'), left, multiplyExpression()); break
                default: return left
            }
        }
    }

    function multiplyExpression(firstName: Reference | undefined = undefined): Expression {
        let left = simpleExpression(firstName)
        while (true) {
            switch (token) {
                case Token.Star: left = operatorCall(opName('infix *'), left, multiplyExpression()); continue
                case Token.Slash: left = operatorCall(opName('infix /'), left, multiplyExpression()); continue
            }
            break
        }
        return left
    }

    function simpleExpression(firstName: Reference | undefined = undefined): Expression {
        return simpleExpressionTarget(firstName ?? primitiveExpression())
    }

    function simpleExpressionTarget(target: Expression): Expression {
        const start = pos.start
        while (true) {
            switch (token) {
                case Token.LParen:
                    target = call(target)
                    continue
                case Token.LBrack:
                    target = index(target)
                    continue
                case Token.Dot:
                    target = select(target)
                    continue
                case Token.DotDot:
                    target = range(target)
                    continue
                default: {
                    if (!scanner.nl && expressionFirstNoInfixeSet[token]) {
                        target = extend({
                            start,
                            end: start,
                            kind: Kind.Call,
                            target: target,
                            arguments: [arg(primitiveExpression())]
                        })
                        continue
                    }
                }
            }
            break
        }
        return target
    }

    function call(target: Expression): Expression {
        return extend(loc(() => {
            expect(Token.LParen)
            const args = sequence(argument, argumentFirstSet, argumentFollowSet, comma)
            expect(Token.RParen)
            return {
                kind: Kind.Call,
                target,
                arguments: args
            }
        }), target)
    }

    function argument(): Argument {
        let modifier = ArgumentModifier.None
        if (token == Token.Var) {
            next()
            modifier |= ArgumentModifier.Var
        }
        let name: Reference | undefined = undefined
        let value: Expression
        if (token == Token.Identifier) {
            const reference = expectName()
            if (token as any == Token.Colon) {
                next()
                name = reference
                value = expression()
            } else {
                value = simpleExpressionTarget(reference)
            }
        } else {
            value = expression()
        }
        const result: Argument = { kind: Kind.Argument, modifier, value }
        if (name) result.name = name
        return result
    }

    function index(target: Expression): Expression {
        const start = pos.start
        expect(Token.LBrack)
        const index = expression()
        expect(Token.RBrack)
        return extend({
            start,
            end: start,
            kind: Kind.Index,
            target,
            index
        }, target)
    }

    function select(target: Expression): Expression {
        const start = pos.start
        expect(Token.Dot)
        const name = expectName()
        return extend({
            start,
            end: start,
            kind: Kind.Select,
            target,
            name
        })
    }

    function range(left: Expression | undefined ): Expression {
        const start = left?.start ?? pos.start
        const end =  left?.end ?? pos.start
        expect(Token.DotDot)
        const right = expressionFirstSet[token] ? primitiveExpression() : undefined
        return extend({
            start,
            end,
            kind: Kind.Range,
            left,
            right
        })
    }

    function primitiveExpression(): Expression {
        switch (token) {
            case Token.Identifier: return expectName()
            case Token.LiteralI8: return l({ kind: Kind.Literal, primitiveKind: PrimitiveKind.I8, value: scanner.value })
            case Token.LiteralI16: return l({ kind: Kind.Literal, primitiveKind: PrimitiveKind.I16, value: scanner.value })
            case Token.LiteralI32: return l({ kind: Kind.Literal, primitiveKind: PrimitiveKind.I32, value: scanner.value })
            case Token.LiteralI64: return l({ kind: Kind.Literal, primitiveKind: PrimitiveKind.I64, value: scanner.value })
            case Token.LiteralU8: return l({ kind: Kind.Literal, primitiveKind: PrimitiveKind.U8, value: scanner.value })
            case Token.LiteralU16: return l({ kind: Kind.Literal, primitiveKind: PrimitiveKind.U16, value: scanner.value })
            case Token.LiteralU32: return l({ kind: Kind.Literal, primitiveKind: PrimitiveKind.U32, value: scanner.value })
            case Token.LiteralU64: return l({ kind: Kind.Literal, primitiveKind: PrimitiveKind.U64, value: scanner.value })
            case Token.LiteralF32: return l({ kind: Kind.Literal, primitiveKind: PrimitiveKind.F32, value: scanner.value })
            case Token.LiteralF64: return l({ kind: Kind.Literal, primitiveKind: PrimitiveKind.F64, value: scanner.value })
            case Token.LiteralChar: return l({ kind: Kind.Literal, primitiveKind: PrimitiveKind.Char, value: scanner.value })
            case Token.LiteralString: return l({ kind: Kind.Literal, primitiveKind: PrimitiveKind.String, value: scanner.value })
            case Token.True:
            case Token.False: return l({ kind: Kind.Literal, primitiveKind: PrimitiveKind.Bool, value: token == Token.True })
            case Token.Null: return l({ kind: Kind.Literal, primitiveKind: PrimitiveKind.Null, value: null })
            case Token.Plus:  return operatorCall(opName('prefix +'), simpleExpression())
            case Token.Dash: return operatorCall(opName('prefix -'), simpleExpression())
            case Token.Bang: return operatorCall(opName('prefix !'), simpleExpression())
            case Token.If: return ifExpr()
            case Token.When: return when();
            case Token.DotDot: return range(undefined)
            case Token.LBrack: return structOrArrayLiteral()
            case Token.LBrace: return lambda()
            case Token.LParen: {
                next()
                const result = expression()
                expect(Token.RParen)
                return result
            }
        }
        report("Expected an expression")
        skip()
        return undefined as any as Expression
    }

    function lambda(): Lambda {
        return loc(() => {
            expect(Token.LBrace)
            const parameters = tryParameters()
            const statements = sequence(statement, statementFirstSet, statementFollowSet)
            expect(Token.RBrace)
            const result = optionalTypeExpression()
            return {
                kind: Kind.Lambda,
                parameters,
                result,
                body: {
                    kind: Kind.Block,
                    statements
                }
            }
        })
    }

    function tryParameters(): Parameter[] {
        const oldScanner = scanner.clone()
        const oldToken = token
        const oldDiagnostics = [...diagnostics]
        let result = functionParameters()
        expect(Token.Arrow)
        if (diagnostics.length != oldDiagnostics.length) {
            scanner = oldScanner
            token = oldToken
            diagnostics = oldDiagnostics
            result = []
        }
        return result
    }

    function ifExpr(): Expression {
        return loc(() => {
            expect(Token.If)
            expect(Token.LParen)
            const condition = expression()
            expect(Token.RParen)
            const thenClause = block()
            let elseClause: Block
            if (token == Token.Else) {
                next()
                elseClause = block()
            } else {
                elseClause = { kind: Kind.Block, statements: [] }
            }
            return { kind: Kind.If, condition, then: thenClause, else: elseClause }
        })
    }

    function structOrArrayLiteral(): ArrayLiteral | StructLiteral {
        return loc(() => {
            expect(Token.LBrack)
            let values: Expression[]
            switch (token) {
                case Token.Colon:
                case Token.Var:
                    const fields = structLiteralFields()
                    expect(Token.RBrack)
                    return {
                        kind: Kind.StructLiteral,
                        fields,
                    }
                case Token.Identifier: {
                    const name = expectName()
                    if (token as any == Token.Colon) {
                        const fields = structLiteralFields(name)
                        expect(Token.RBrack)
                        return {
                            kind: Kind.StructLiteral,
                            fields,
                        }
                    } else {
                        values = arrayValues(name)
                    }
                }
                default:
                   values = arrayValues()
            }
            expect(Token.RBrack)
            return {
                kind: Kind.ArrayLiteral,
                values
            }
        })
    }

    function structLiteralFields(firstName: Reference | undefined = undefined): FieldLiteral[] {
        return sequence(() => {
            const result = fieldLiteral(firstName)
            firstName = undefined
            return result
        }, fieldLiteralFirstSet, fieldLiteralFollowSet, comma, firstName != undefined)
    }

    function arrayValues(firstName: Reference | undefined = undefined): Expression[] {
        return sequence(() => {
            const result = expression(firstName)
            firstName = undefined
            return result
        }, arrayValueFirstSet, arrayValueFollowSet, comma, firstName != undefined)
    }

    function fieldLiteral(firstName: Reference | undefined): FieldLiteral {
        return loc(() => {
            let modifier = FieldLiteralModifier.None
            if (token == Token.Var) {
                next()
                modifier = FieldLiteralModifier.Var
            }
            let name: Reference
            let value: Expression
            if (token == Token.Colon && !firstName) {
                next()
                if (token as any != Token.Identifier) {
                    report(`Expected an identifier`)
                    name = { kind: Kind.Reference, name: "<error>" }
                } else {
                    name = { kind: Kind.Reference, start: pos.start, end: pos.end, name: scanner.value }
                }
                value = expression()
            } else {
                name = firstName || expectName()
                expect(Token.Colon)
                value = expression()
            }
            return {
                kind: Kind.FieldLiteral,
                modifier,
                name,
                value
            }
        })
    }

    function opName(name: string): Reference {
        const result: Reference = {
            start: pos.start,
            end: pos.end,
            kind: Kind.Reference,
            name
        }
        next()
        return result
    }

    function operatorCall(name: Reference, ...exprs:  Expression[]) {
        const [receiver, ...rest] = exprs
        const select: Select = {
            kind: Kind.Select,
            target: receiver,
            name,
        }
        const args: Argument[] = rest.map(arg)
        const result: Call = { kind: Kind.Call, target: select, arguments: args }
        return extend(result, ...args)
    }

    function arg(value: Expression): Argument {
        return { start: value && value.start, end: value && value.end, kind: Kind.Argument, modifier: ArgumentModifier.None, value }
    }

    function optionalTypeExpression(): TypeExpression {
        if (token == Token.Colon) {
            next()
            return typeExpression()
        }
        return { kind: Kind.Infer }
    }

    function typeExpression(firstName: Reference | undefined = undefined): TypeExpression {
        return loc(() => {
            const start = pos.start
            let result = firstName ?? primitiveTypeExpression()
            while (true) {
                switch (token) {
                    case Token.LBrack: {
                        next()
                        let size: Expression | undefined = undefined
                        if (token as any != Token.RBrack) {
                            size = expression()
                        }
                        expect(Token.RBrack)
                        result = extend({
                            start,
                            end: start,
                            kind: Kind.ArrayTypeConstructor,
                            element: result,
                            size
                        })
                        continue
                    }
                    case Token.Dot: {
                        next()
                        const name = expectName()
                        result = {
                            start: result.start,
                            end: name.end,
                            kind: Kind.TypeSelect,
                            target: result,
                            name
                        }
                        continue
                    }
                }
                break
            }
            return result
        })
    }

    function primitiveTypeExpression(): TypeExpression {
        switch (token) {
            case Token.Identifier: return expectName()
            case Token.LBrack:
                return loc(() => {
                    next()
                    const { fields, methods, types } = structTypeConstructorBody()
                    expect(Token.RBrack)
                    return {
                        kind: Kind.StructTypeConstructor,
                        fields,
                        methods,
                        types
                    }
                })
            case Token.LBrace: return functionType()
        }
        report("Expected a type expression")
        skip()
        return undefined as any as TypeExpression
    }

    function functionType(): TypeExpression {
        return loc(() => {
            expect(Token.LBrace)
            const parameters = functionParameters()
            expect(Token.RBrace)
            const result = optionalTypeExpression()
            return {
                kind: Kind.FunctionType,
                parameters,
                result
            }
        })
    }

    function structTypeConstructorBody(firstName: Reference | undefined = undefined): { fields: StructTypeConstuctorField[], methods: Function[], types: TypeDeclaration[] } {
        const items = sequence(() => {
            const result = structTypeConstructorItem(firstName)
            firstName = undefined
            return result
        }, structTypeFieldFirstSet, structTypeFieldFollowSet)
        const fields = items.filter(i => i.kind == Kind.StructTypeConstuctorField) as StructTypeConstuctorField[]
        const methods = items.filter(i => i.kind == Kind.Function) as Function[]
        const types = items.filter(i => i.kind == Kind.TypeDeclaration) as TypeDeclaration[]
        return { fields, methods, types }
    }

    function structTypeConstructorItem(firstName: Reference | undefined): StructTypeConstuctorField | Function | TypeDeclaration {
        return loc(() => {
            let modifier = StructTypeConstuctorFieldModifier.None
            if (token == Token.Var) {
                next()
                modifier |= StructTypeConstuctorFieldModifier.Var
                firstName = expectName()
            }
            if (firstName || token == Token.Identifier) {
                const name = firstName ?? expectName()
                expect(Token.Colon)
                const type = typeExpression()
                return {
                    kind: Kind.StructTypeConstuctorField,
                    modifier,
                    name,
                    type
                }
            }
            switch (token) {
                case Token.Fun: return funDeclaration()
                case Token.Type: return typeDeclaration()
            }
            report("Expected a field, method or type")
            skip()
            return undefined as any as StructTypeConstuctorField
        })
    }
    function expectName(): Reference {
        return loc(() => {
            const name = scanner.value as string
            expect(Token.Identifier)
            return { kind: Kind.Reference, name }
        })
    }

    function optionalName(): Reference | undefined {
        if (token == Token.Identifier) {
            return expectName()
        }
        return undefined
    }

    function sequence<T>(element: () => T, firstSet: boolean[], followSet: boolean[] = [], separator = semi, forced: boolean = false): T[] {
        const result: T[] = []
        const savedFollows = follows
        follows = unionOf(followSet, savedFollows)
        if (forced || firstSet[token]) {
            result.push(element())
            if (separator == semi && token == Token.Semi) separator()
            if (separator == comma && token == Token.Comma) separator()
            let last = pos.start
            while (firstSet[token]) {
                result.push(element())
                if (separator == semi && token == Token.Semi) separator()
                if (separator == comma && token == Token.Comma) separator()
                if (last == pos.start) throw new Error(`Parser didn't make progress at ${last}`)
                last = pos.start
            }
        }
        follows = savedFollows
        return result
    }

    function semi() {
        expect(Token.Semi)
        while (token == Token.Semi) next()
    }

    function comma() {
        expect(Token.Comma)
        while (token == Token.Comma) next()
    }

    function next(): Token {
        token = scanner.next()
        while (token == Token.Error) {
            report(scanner.message)
            token = scanner.next()
        }
        return token
    }

    function expect(e: Token) {
        if (token != e) {
            report(`Expected a ${tokenString(e)}, received ${tokenString(token)}`)
            skip()
        } else {
            next()
        }
    }

    function report(message: string, location: Locatable = {start: pos.start, end: pos.end }) {
        diagnostics.push({ location, message })
    }

    function skip() {
        next()
        while (!follows[token]) next()
    }

    function loc<T extends Node>(rule: () => T): T {
        const start = pos.start
        const result = rule()
        const end = pos.end
        return { start, end, ...result }
    }

    function l<N extends Node>(node: N): N {
        node.start = pos.start
        node.end = pos.end
        next()
        return node
    }

    function extend<N extends Node>(node: N, ...children: Node[]): N {
        const all = [node, ...children]
        const start = all.map(n => n?.start).filter(s => s != undefined).reduce((p, v) => (p as number) < (v as number) ? p : v, undefined)
        const end = all.map(n => n?.end).filter(s => s != undefined).reduce((p, v) => (p as number) > (v as number) ? p : v, undefined)
        if (start != undefined) node.start = start
        if (end != undefined) node.end = end
        return node
    }
}

function setOf(...tokens: Token[]): boolean[] {
    const result: boolean[] = []
    for (const token of tokens) result[token] = true
    return result
}

function unionOf(...sets: boolean[][]): boolean[] {
    const result: boolean[] = []
    sets.forEach(set => set.forEach((v, i) => result[i] = v))
    return result
}

const declarationFirstSet = setOf(Token.Var, Token.Val, Token.Let, Token.Fun, Token.Type)
const parameterFirstSet = setOf(Token.Identifier, Token.Var, Token.Context)
const parameterFollowSet = setOf(Token.RParen)
const expressionFirstSet = setOf(Token.Identifier, Token.LiteralI8, Token.LiteralI16, Token.LiteralI32,
    Token.LiteralI64, Token.LiteralU8, Token.LiteralU16, Token.LiteralU32, Token.LiteralU64, Token.LiteralF32,
    Token.LiteralF64, Token.LiteralChar, Token.Null, Token.True, Token.False, Token.Dash, Token.Plus, Token.If,
    Token.LBrack, Token.LBrace, Token.LParen, Token.When, Token.DotDot)
const expressionFirstNoInfixeSet = setOf(Token.Identifier, Token.LiteralI8, Token.LiteralI16, Token.LiteralI32,
    Token.LiteralI64, Token.LiteralU8, Token.LiteralU16, Token.LiteralU32, Token.LiteralU64, Token.LiteralF32,
    Token.LiteralF64, Token.LiteralChar, Token.Null, Token.True, Token.False, Token.If,
    Token.LBrack, Token.LBrace, Token.LParen, Token.When, Token.DotDot)
const statementFirstSet = unionOf(
    expressionFirstSet,
    declarationFirstSet,
    setOf(Token.Break, Token.Continue, Token.For, Token.Return, Token.While)
)
const statementFollowSet = unionOf(statementFirstSet, setOf(Token.EOF, Token.RBrace))
const argumentFollowSet = setOf(Token.Comma, Token.RParen)
const argumentFirstSet = unionOf(expressionFirstSet, setOf(Token.Var, Token.Context))
const arrayValueFirstSet = expressionFirstSet
const arrayValueFollowSet = setOf(Token.Comma, Token.RBrack)
const fieldLiteralFirstSet = setOf(Token.Identifier, Token.Var, Token.Colon)
const fieldLiteralFollowSet = setOf(Token.Comma, Token.RBrack)
const structTypeFieldFirstSet = setOf(Token.Identifier, Token.Fun, Token.Type, Token.Var)
const structTypeFieldFollowSet = setOf(Token.Comma, Token.LBrack)
const whenClauseFirstSet = unionOf(expressionFirstSet, setOf(Token.Else, Token.Is))
const whenClauseFollowSet = setOf(Token.RBrace, Token.Semi)