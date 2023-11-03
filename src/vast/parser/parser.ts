import { Diagnostic, Locatable, PrimitiveKind } from "../../last";
import { error } from "../../utils";
import { Argument, ArgumentModifier, ArrayLiteral, Block, Call, Expression, FieldLiteral, FieldLiteralModifier, Function, Kind, Let, Module, Node, Parameter, ParameterModifier, Reference, Statement, StructLiteral, StructTypeConstuctorField, TypeDeclaration, TypeExpression, Val, Var, While } from "../ast";
import { Scanner } from "./scanner";
import { Token } from "./tokens";


interface PositionMap {
    pos(offset: number): number
}

export interface ParseResult {
    module: Module
    diagnostics: Diagnostic[]
}

export function parser(scanner: Scanner, builder?: PositionMap) {
    let follows = setOf(Token.EOF, Token.Fun, Token.Var, Token.Let, Token.Type)
    let token = scanner.next()
    const diagnostics: Diagnostic[] = []
    const pos = builder ? {
        get start() { return builder.pos(scanner.start) },
        get end() { return builder.pos(scanner.end) }
    } : scanner
    
    const result = module()
    return { module: result, diagnostics }

    function module(): Module { 
        return loc(() => {
            const statements = declarationStatements()
            return { kind: Kind.Module, statements }
        })
    }

    function declarationStatements(): Statement[] {
        return sequence(declarationStatement, declarationFirstSet, declarationFirstSet)        
    }

    function declarationStatement(): Statement {
        const start = pos.start
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
                return undefined as any as Statement
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
            expect(Token.Val)
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
            return { kind: Kind.Function, parameters, result, body}
        })
    }

    function functionParameters(): Parameter[] {
        return sequence(parameter, parameterFirstSet, parameterFollowSet, comma)
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
            case Token.While:
                return whileStatement()
            default:
                report("Expected as statement")
                return undefined as any as Statement
        }
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
        return orExpression(firstName)
    }

    function orExpression(firstName: Reference | undefined = undefined): Expression {
        let left = andExpression(firstName)
        while (token == Token.Or) {
            next()
            const right = andExpression()
            left = operatorCall('infix ||', left, right)
        }
        return left
    }

    function andExpression(firstName: Reference | undefined = undefined): Expression {
        let left = compareExpression(firstName)
        while (token == Token.And) {
            next()
            const right = compareExpression()
            left = operatorCall('infix ||', left, right)
        }
        return left
    }

    function compareExpression(firstName: Reference | undefined = undefined): Expression {
        const left = addExpression(firstName)
        let name = ''
        switch (token) {
            case Token.Gt: name = `infix >`; break
            case Token.Lt: name = `infix <`; break
            case Token.Gte: name = `infix >=`; break
            case Token.Lte: name = `infix <=`; break
            case Token.EqualEqual: name = 'infix =='; break
            case Token.NotEqual: name = 'infix !='; break
            default: return left
        }
        next()
        const right = addExpression()
        return operatorCall(name, left, right) 
    }

    function addExpression(firstName: Reference | undefined = undefined): Expression {
        let left = multiplyExpression(firstName)
        while (true) {
            switch (token) {
                case Token.Plus: next(); left = operatorCall('infix +', left, multiplyExpression()); break
                case Token.Dash: next(); left = operatorCall('infix -', left, multiplyExpression()); break
                default: return left 
            }
        } 
    }

    function multiplyExpression(firstName: Reference | undefined = undefined): Expression {
        let left = simpleExpression(firstName)
        while (true) {
            switch (token) {
                case Token.Star: next(); left = operatorCall('infix *', left, multiplyExpression()); continue
                case Token.Slash: next(); left = operatorCall('infix /', left, multiplyExpression()); continue
            }
            break
        } 
        return left
    }

    function simpleExpression(firstName: Reference | undefined = undefined): Expression {
        return simpleExpressionTarget(firstName ?? primitiveExpression())
    }

    function simpleExpressionTarget(target: Expression): Expression {
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
                default: {
                    if (!scanner.nl && expressionFirstSet[token]) {
                        target = extend({
                            kind: Kind.Call,
                            target: target,
                            arguments: [arg(simpleExpression())]
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
        expect(Token.LParen)
        const args = sequence(argument, argumentFirstSet, argumentFollowSet, comma)
        expect(Token.RParen)
        return extend({
            kind: Kind.Call,
            target,
            arguments: args
        }, ...args)
        
    }

    function argument(): Argument {
        const start = pos.start
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
        return { kind: Kind.Argument, modifier, name, value }
    }

    function index(target: Expression): Expression {
        const start = pos.start
        expect(Token.LBrack)
        const index = expression()
        expect(Token.RBrack)
        return extend({
            start,
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
            kind: Kind.Select,
            target,
            name
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
            case Token.True:
            case Token.False: return l({ kind: Kind.Literal, primitiveKind: PrimitiveKind.F64, value: token == Token.True })
            case Token.Null: return l({ kind: Kind.Literal, primitiveKind: PrimitiveKind.F64, value: null })
            case Token.Plus: {
                next()
                return operatorCall('prefix +', simpleExpression())
            }
            case Token.Dash: {
                next()
                return operatorCall('prefix -', simpleExpression())
            }
            case Token.Bang: {
                next()
                return operatorCall('prefix !', simpleExpression())
            }
            case Token.If: return ifExpr()
            case Token.LBrack: return structOrarrayLiteral()
        }
        report("Expected an expression")
        skip()
        return undefined as any as Expression
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

    function structOrarrayLiteral(): ArrayLiteral | StructLiteral {
        return loc(() => {
            expect(Token.LBrack)
            let values: Expression[]
            switch (token) {
                case Token.Colon:
                case Token.Var:
                    const fields = structLiteralFields()
                    return {
                        kind: Kind.StructLiteral,
                        fields,
                    }
                case Token.Identifier: {
                    const name = expectName()
                    if (token as any == Token.Colon) {
                        const fields = structLiteralFields(name)
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
        }, fieldLiteralFirstSet, fieldLiteralFollowSet, comma)
    }

    function arrayValues(firstName: Reference | undefined = undefined): Expression[] {
        return sequence(() => {
            const result = expression(firstName)
            firstName = undefined
            return result
        }, arrayValueFirstSet, arrayValueFollowSet)
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
            if (token == Token.Colon) {
                next()
                value = expression()
                name = rightMostName(value)
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

    function rightMostName(expression: Expression): Reference {
        switch (expression.kind) {
            case Kind.Reference: return expression
            case Kind.Select: return expression.name
            default: {
                report("Requires a right most name", expression)
                return undefined as any as Reference
            }
        }
    }

    function operatorCall(name: string, ...exprs:  Expression[]) {
        const target: Reference = { kind: Kind.Reference, name }
        const args: Argument[] = exprs.map(arg)
        const result: Call = { kind: Kind.Call, target, arguments: args }
        return extend(result, ...args)
    }

    function arg(value: Expression): Argument {
        return { start: value.start, end: value.end, kind: Kind.Argument, modifier: ArgumentModifier.None, value }
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
            let result = firstName ?? primitiveTypeExpression()
            while (true) {
                switch (token) {
                    case Token.LBrack: {
                        next()
                        let size: Expression | undefined = undefined
                        if (token as any != Token.RBrace) {
                            size = expression()
                        }
                        expect(Token.RBrack)
                        result = extend({
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
                    const { fields, methods, types } = structTypeConstructorBody()
                    expect(Token.RBrack)
                    return {
                        kind: Kind.StructTypeConstructor,
                        fields,
                        methods,
                        types
                    }
                })
            case Token.RBrace: return functionType()
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
            if (firstName || token == Token.Identifier) {
                const name = firstName ?? expectName()
                expect(Token.Colon)
                const type = typeExpression()
                return {
                    kind: Kind.StructTypeConstuctorField,
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

    function sequence<T>(element: () => T, firstSet: boolean[], followSet: boolean[] = [], separator = semi): T[] {
        const result: T[] = []
        const savedFollows = follows
        follows = unionOf(followSet, savedFollows)
        if (firstSet[token]) {
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
        const start = all.map(n => n.start).filter(s => s != undefined).reduce((p, v) => (p as number) < (v as number) ? p : v)
        const end = all.map(n => n.end).filter(s => s != undefined).reduce((p, v) => (p as number) > (v as number) ? p : v)
        node.start = start
        node.end = end
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
    Token.LiteralF64, Token.Null, Token.True, Token.False, Token.Dash, Token.Plus, Token.If,
    Token.LBrack, Token.LBrace)
const statementFirstSet = unionOf(
    expressionFirstSet,
    declarationFirstSet,
    setOf(Token.Break, Token.Continue, Token.Return, Token.While)
)
const statementFollowSet = unionOf(statementFirstSet, setOf(Token.EOF, Token.RBrace))
const argumentFollowSet = setOf(Token.Comma, Token.RParen)
const argumentFirstSet = unionOf(expressionFirstSet, setOf(Token.Var, Token.Context))
const arrayValueFirstSet = expressionFirstSet
const arrayValueFollowSet = setOf(Token.Comma, Token.RBrack)
const fieldLiteralFirstSet = setOf(Token.Identifier, Token.Var)
const fieldLiteralFollowSet = setOf(Token.Comma, Token.RBrack)
const structTypeFieldFirstSet = setOf(Token.Identifier, Token.Fun, Token.Type, Token.Var)
const structTypeFieldFollowSet = setOf(Token.Comma, Token.LBrack)