import { 
    Add, AddressOf, And, ArrayConstructor, ArrayLiteral, As, Assign, Block, BodyElement, Branch, BranchIndexed, 
    Call, Declaration, Dereference, Divide, Exportable, Exported, Expression, Field, Function, IfThenElse, 
    Import, ImportFunction, ImportItem, ImportVariable, Index, LastKind, Let, LiteralBoolean, LiteralFloat32, 
    LiteralFloat64, LiteralInt16, LiteralInt32, LiteralInt64, LiteralInt8, LiteralKind, LiteralNull, LiteralUInt16,
    LiteralUInt32, LiteralUInt64, LiteralUInt8, Locatable, Loop, Module, Multiply, Negate, Not, Or, Parameter,
    PointerConstructor, Reference, Remainder, Return, Select, StructFieldLiteral, StructLiteral, StructTypeLiteral,
    Subtact, Type, TypeExpression, TypeSelect, Var 
} from "../last";
import { Scanner } from "./scanner";
import { Token } from "./tokens";

export interface Diagnostic {
    location: Locatable
    message: string
    related?: Diagnostic[]
}

export function parse(scanner: Scanner): Module | Diagnostic[] {
    let follows = setOf(Token.EOF, Token.Fun, Token.Var, Token.Let)
    let token = scanner.next()
    const diagnostics: Diagnostic[] = []
    const result = module()
    return diagnostics.length > 0 ? diagnostics : result

    function module(): Module {
        const start = scanner.start
        const imports = importStatements()
        const declarations = declarationStatements()
        return l<Module>(start, { kind: LastKind.Module, imports, declarations })
    }

    function importStatements(): Import[] {
        return sequence(importStatement, importSet)
    }

    function importStatement(): Import {
        const start = scanner.start
        expect(Token.Import)
        const module = expectName()
        expect(Token.LBrace)
        const imports = importItems(module)
        expect(Token.RBrace)
        return l<Import>(start, { kind: LastKind.Import, imports })
    }

    function importItems(module: string): ImportItem[] {
        return sequence(() => importItem(module), importSet, importSet, comma)
    }

    function importItem(module: string): ImportItem {
        const start = scanner.start
        const name = expectName()
        if (token == Token.LParen) {
            return importFunction(start, module, name)
        }
        return importVariable(start, module, name)
    }

    function importFunction(start: number, module: string, name: string): ImportFunction {
        expect(Token.LParen)
        const parameters = parameterList()
        expect(Token.RParen)
        expect(Token.Colon)
        const result = typeExpression()
        let as: string | undefined = undefined
        if (token == Token.As) {
            next()
            as = expectName()
        }
        return l<ImportFunction>(start, { kind: LastKind.ImportFunction, module, name, parameters, result, as })
    }

    function importVariable(start: number, module: string, name: string): ImportVariable {
        expect(Token.Colon)
        const type = typeExpression()
        let as: string | undefined = undefined
        if (token == Token.As) {
            next()
            as = expectName()
        }
        return l<ImportVariable>(start, { kind: LastKind.ImportVariable, module, name, type, as })
    }

    function parameterList(): Parameter[] {
        return sequence(parameter, identSet, rparenSet, comma)
    }

    function parameter(): Parameter {
        const start = scanner.start
        const name = expectName()
        expect(Token.Colon)
        const type = typeExpression()
        return l<Parameter>(start, { kind: LastKind.Parameter, name, type })
    }

    function typeExpression(): TypeExpression {
        const start = scanner.start
        let result: TypeExpression = primaryTypeExpression()
        while (true) {
            switch(token) {
                case Token.Dot:
                    next()
                    const name = expectName()
                    result = l<TypeSelect>(start, { kind: LastKind.TypeSelect, target: result, name })
                    continue
                case Token.Circumflex:
                    next()
                    result = l<PointerConstructor>(start, { kind: LastKind.PointerConstructor, target: result })
                    continue
                case Token.LBrack:
                    next()
                    let size: number | undefined = undefined
                    if (token as any == Token.Int32) {
                        size = scanner.value as number
                        next()
                    }
                    expect(Token.RBrack)
                    result = l<ArrayConstructor>(start, { kind: LastKind.ArrayConstructor, element: result, size })
                    continue

            }
            break
        }
        return result
    }

    function primaryTypeExpression(): TypeExpression {
        const start = scanner.start
        switch (token) {
            case Token.Identifier: {
                const name = expectName()
                return l<Reference>(start, { kind: LastKind.Reference, name })
            }
            case Token.Lt: {
                next()
                const fields = sequence(structFieldLiteral, identSet, gtSet, comma)
                expect(Token.Gt)
                return l<StructTypeLiteral>(start, { kind: LastKind.StructTypeLiteral, fields })
            }
            case Token.LParen: {
                const savedFollows = follows
                follows = unionOf(savedFollows, rparenSet)
                const result = typeExpression()
                follows = savedFollows
                return result
            }
            default:
                return l<Reference>(start, { kind: LastKind.Reference, name: expectName() })
        }
    }

    function structFieldLiteral(): StructFieldLiteral {
        const start = scanner.start
        const name = expectName()
        expect(Token.Colon)
        const type = typeExpression()
        return l<StructFieldLiteral>(start, { kind: LastKind.StructFieldLiteral, name, type })
    }

    function declarationStatements(): Declaration[] {
        return sequence(declarationStatement, declarationFirstSet, declarationFirstSet)
    }

    function declarationStatement(): Declaration {
        const start = scanner.start
        switch (token) {
            case Token.Export: {
                next()
                const target = exportable()
                return l<Exported>(start, { kind: LastKind.Exported, target })
            }
            case Token.Fun:
            case Token.Var:
                return exportable()
            case Token.Let:
                return letDeclaration()
            case Token.Type:
                return typeDeclaration()
            default:
                report("Expected a function, let, or var declration")
                return undefined as any as Declaration
        }
    }

    function exportable(): Exportable {
        const start = scanner.start
        switch (token) {
            case Token.Fun:
                return functionDeclaration()
            case Token.Var:
                return varDeclaration()
            default:
                report("Expected a let or var declaration")
                return undefined as any as Exportable
        }
    }

    function letDeclaration(): Let {
        const start = scanner.start
        expect(Token.Let)
        const name = expectName()
        expect(Token.Colon)
        const type = typeExpression()
        expect(Token.Equal)
        const value = expression()
        return l<Let>(start, { kind: LastKind.Let, name, type, value })
    }

    function varDeclaration(): Var {
        const start = scanner.start
        expect(Token.Var)
        const name = expectName()
        expect(Token.Colon)
        const type = typeExpression()
        let value: Expression | undefined = undefined
        if (token == Token.Equal) {
            next()
            value = expression()
        }
        return l<Var>(start, { kind: LastKind.Var, name, type, value })
    }

    function typeDeclaration(): Type {
        const start = scanner.start
        expect(Token.Type)
        const name = expectName()
        expect(Token.Equal)
        const type = typeExpression()
        return l<Type>(start, { kind: LastKind.Type, name, type })
    }

    function functionDeclaration(): Function {
        const start = scanner.start
        expect(Token.Fun)
        const name = expectName()
        expect(Token.LParen)
        const parameters = parameterList()
        expect(Token.RParen)
        expect(Token.Colon)
        const result = typeExpression()
        let body: Expression
        if (token == Token.Equal) {
            next()
            body = expression()
        } else {
            body = block()
        }
        return l<Function>(start, { kind: LastKind.Function, name, parameters, result, body })
    }

    function expression(): Expression {
        const start = scanner.start
        let left = orExpression()
        while (token == Token.And) {
            next()
            const right = orExpression()
            left = l<And>(start, { kind: LastKind.And, left, right })
        }
        return left
    }

    function orExpression(): Expression {
        const start = scanner.start
        let left = compareExpression()
        while (token == Token.Or) {
            next()
            const right = compareExpression()
            left = l<Or>(start, { kind: LastKind.Or, left, right })
        }
        return left
    }

    function compareExpression(): Expression {
        const start = scanner.start
        let left = addExpression()
        let hasOp = false
        let op = LastKind.GreaterThan
        switch (token) {
            case Token.Gt: op = LastKind.GreaterThan; hasOp = true; break
            case Token.Gte: op = LastKind.GreaterThanEqual; hasOp = true; break
            case Token.Lt: op = LastKind.LessThan; hasOp = true; break
            case Token.Lte: op = LastKind.LessThanEqual; hasOp = true; break
            case Token.EqualEqual: op = LastKind.Equal; hasOp = true; break
            case Token.NotEqual: op = LastKind.NotEqual; hasOp = true; break
        }
        if (hasOp) {
            next()
            const right = addExpression()
            return l<Expression>(start, { kind: op, left, right })
        }
        return left
    }

    function addExpression(): Expression {
        const start = scanner.start
        let left = multiplyExpression()
        while(true) {
            switch (token) {
                case Token.Plus: {
                    next()
                    const right = multiplyExpression()
                    left = l<Add>(start, { kind: LastKind.Add, left, right })
                    continue
                }
                case Token.Dash: {
                    next()
                    const right = multiplyExpression()
                    left = l<Subtact>(start, { kind: LastKind.Subtract, left, right })
                    continue
                }
            }
            break
        }
        return left
    }

    function multiplyExpression(): Expression {
        const start = scanner.start
        let left = asLevelExpression()
        while(true) {
            switch (token) {
                case Token.Star: {
                    next()
                    const right = asLevelExpression()
                    left = l<Multiply>(start, { kind: LastKind.Multiply, left, right })
                    continue
                }
                case Token.Dash: {
                    next()
                    const right = asLevelExpression()
                    left = l<Divide>(start, { kind: LastKind.Divide, left, right })
                    continue
                }
                case Token.Percent: {
                    next()
                    const right = asLevelExpression()
                    left = l<Remainder>(start, { kind: LastKind.Remainder, left, right})
                }
            }
            break
        }
        return left
    }

    function asLevelExpression(): Expression {
        const start = scanner.start
        let left = simpleExpression()
        if (token == Token.As) {
            next()
            const right = typeExpression()
            left = l<As>(start, { kind: LastKind.As, left, right })
        }
        return left
    }

    function simpleExpression(): Expression {
        const start = scanner.start
        let result = primitiveExpression()
        while (true) {
            switch (token) {
                case Token.LParen:
                    result = call(result)
                    continue
                case Token.LBrack:
                    result = index(result)
                    continue
                case Token.Dot:
                    result = select(result)
                    continue
                case Token.Circumflex:
                    result = dereference(result)
                    continue
            }
            break
        }
        return result
    }

    function primitiveExpression(): Expression {
        const start = scanner.start
        switch (token) {
            case Token.Identifier: {
                const name = expectName()
                return l<Reference>(start, { kind: LastKind.Reference, name })
            }
            case Token.Int8: {
                const value = scanner.value
                next()
                return l<LiteralInt8>(start, { kind: LastKind.Literal, literalKind: LiteralKind.Int8, value })
            }
            case Token.Int16: {
                const value = scanner.value
                next()
                return l<LiteralInt16>(start, { kind: LastKind.Literal, literalKind: LiteralKind.Int16, value })
            }
            case Token.Int32: {
                const value = scanner.value
                next()
                return l<LiteralInt32>(start, { kind: LastKind.Literal, literalKind: LiteralKind.Int32, value })
            }
            case Token.Int64: {
                const value = scanner.value
                next()
                return l<LiteralInt64>(start, { kind: LastKind.Literal, literalKind: LiteralKind.Int64, value })
            }
            case Token.UInt8: {
                const value = scanner.value
                next()
                return l<LiteralUInt8>(start, { kind: LastKind.Literal, literalKind: LiteralKind.UInt8, value })
            }
            case Token.UInt16: {
                const value = scanner.value
                next()
                return l<LiteralUInt16>(start, { kind: LastKind.Literal, literalKind: LiteralKind.UInt16, value })
            }
            case Token.UInt32: {
                const value = scanner.value
                next()
                return l<LiteralUInt32>(start, { kind: LastKind.Literal, literalKind: LiteralKind.UInt32, value })
            }
            case Token.UInt64: {
                const value = scanner.value
                next()
                return l<LiteralUInt64>(start, { kind: LastKind.Literal, literalKind: LiteralKind.UInt64, value })
            }
            case Token.Float32: {
                const value = scanner.value
                next()
                return l<LiteralFloat32>(start, { kind: LastKind.Literal, literalKind: LiteralKind.Float32, value })
            }
            case Token.Float64: {
                const value = scanner.value
                next()
                return l<LiteralFloat64>(start, { kind: LastKind.Literal, literalKind: LiteralKind.Float64, value })
            }
            case Token.True:
            case Token.False: {
                const value = scanner.value
                next()
                return l<LiteralBoolean>(start, { kind: LastKind.Literal, literalKind: LiteralKind.Boolean, value })
            }
            case Token.Null: {
                next()
                return l<LiteralNull>(start, { kind: LastKind.Literal, literalKind: LiteralKind.Null, value: null })
            }
            case Token.Plus: {
                next()
                return primitiveExpression()
            }
            case Token.Dash: {
                next()
                const target = primitiveExpression()
                return l<Negate>(start, { kind: LastKind.Negate, target })
            }
            case Token.Bang: {
                next()
                const target = primitiveExpression()
                return l<Not>(start, { kind: LastKind.Not, target })
            }
            case Token.Amp: {
                next()
                const target = simpleExpression()
                return l<AddressOf>(start, { kind: LastKind.AddressOf, target })
            }
            case Token.If: return ifExpression()
            case Token.LBrack: return array()
            case Token.LBrace: return struct()
            case Token.LParen: {
                next()
                const result = expression()
                expect(Token.RParen)
                return result
            }
            default:
                report(`Expected an expression, received ${tokenText(token)}`)
                skip()
                return undefined as any as Expression
        }
    }

    function call(target: Expression): Call {
        expect(Token.LParen)
        const args = sequence(expression, expressionFirstSet, rparenSet, comma)
        expect(Token.RParen)
        return l<Call>(target.start, { kind: LastKind.Call, target, arguments: args })
    }

    function index(target: Expression): Index {
        expect(Token.LBrack)
        const index = expression()
        expect(Token.RBrack)
        return l<Index>(target.start, { kind: LastKind.Index, target, index })
    }

    function select(target: Expression): Select {
        expect(Token.Dot)
        const name = expectName()
        return l<Select>(target.start, { kind: LastKind.Select, target, name })
    }

    function dereference(target: Expression): Dereference {
        expect(Token.Circumflex)
        return l<Dereference>(target.start, { kind: LastKind.Dereference, target })
    }

    function ifExpression(): IfThenElse {
        const start = scanner.start
        expect(Token.If)
        expect(Token.LParen)
        const condition = expressionOrBlock()
        expect(Token.RParen)
        const thenExpr = expressionOrBlock()
        let elseExpr: Expression | Block | undefined = undefined
        if (token == Token.Else) {
            next()
            elseExpr = expressionOrBlock()
        }
        return l<IfThenElse>(start, { kind: LastKind.IfThenElse, condition, then: thenExpr, else: elseExpr })
    }

    function array(): ArrayLiteral {
        const start = scanner.start
        expect(Token.LBrack)
        const elements = sequence(expression, expressionFirstSet, rbrackSet, comma)
        expect(Token.RBrack)
        return l<ArrayLiteral>(start, { kind: LastKind.ArrayLiteral, elements })
    }

    function struct(): StructLiteral {
        const start = scanner.start
        expect(Token.LBrace)
        const fields = sequence(field, identSet, rbraceSet, comma)
        expect(Token.RBrace)
        return l<StructLiteral>(start, { kind: LastKind.StructLiteral, fields })
    }

    function expressionOrBlock(): Expression | Block {
        if (token == Token.LBrace) {
            return block()
        } else {
            return expression()
        }
    }

    function field(): Field {
        const start = scanner.start
        const name = expectName()
        expect(Token.Colon)
        const value = expression()
        return l<Field>(start, { kind: LastKind.Field, name, value })
    }

    function block(): Block {
        const start = scanner.start
        expect(Token.LBrace)
        const body = sequence(bodyElement, bodyElementFirstSet, rbraceSet)
        expect(Token.RBrace)
        return l<Block>(start, { kind: LastKind.Block, body })
    }

    function bodyElement(): BodyElement {
        const start = scanner.start
        switch (token) {
            case Token.Loop: return loop()
            case Token.Block: return blockStatement()
            case Token.Branch: return branch()
            case Token.Return: return returnStatement()
            case Token.Var: return varDeclaration()
            case Token.Let: return letDeclaration()
            default: {
                const target = expression()
                if (token == Token.Equal) {
                    next()
                    const value = expression()
                    return l<Assign>(start, { kind: LastKind.Assign, target, value })
                }
                return target
            }
        }
    }

    function loop(): Loop {
        const start = scanner.start
        expect(Token.Loop)
        let name: string | undefined = undefined
        if (token == Token.Identifier) {
            name = expectName()
        }
        expect(Token.LBrace)
        const body = sequence(bodyElement, bodyElementFirstSet, rbraceSet)
        expect(Token.RBrace)
        return l<Loop>(start, { kind: LastKind.Loop, name, body })    
    }

    function blockStatement(): Block {
        const start = scanner.start
        expect(Token.Block)
        let name: string | undefined = undefined
        if (token == Token.Identifier) {
            name = expectName()
        }
        expect(Token.LBrace)
        const body = sequence(bodyElement, bodyElementFirstSet, rbraceSet)
        expect(Token.RBrace)
        return l<Block>(start, { kind: LastKind.Block, name, body })    
    }

    function branch(): Branch | BranchIndexed {
        const start = scanner.start
        expect(Token.Branch)
        if (token == Token.LParen) {
            next()
            const condition = expression()
            expect(Token.RParen)
            const targets = sequence(expectName, identSet, rparenSet, comma)
            expect(Token.Else)
            const elseTarget = expectName()
            return l<BranchIndexed>(start, { kind: LastKind.BranchIndexed, condition, targets, else: elseTarget })
        } else {
            let target: string | undefined = undefined
            if (token == Token.Identifier) {
                target = expectName()
            }
            return l<Branch>(start, { kind: LastKind.Branch, target })
        }
    }

    function returnStatement(): Return {
        const start = scanner.start
        expect(Token.Return)
        let value: Expression | undefined = undefined
        if (expressionFirstSet[token]) {
            value = expression()
        }
        return l<Return>(start, { kind: LastKind.Return, value })
    }

    function expectName(): string {
        const result = expect(Token.Identifier)
        if (typeof result !== "string") {
            return "<error>"
        }
        return result
    }

    function sequence<T>(element: () => T, firstSet: boolean[], followSet: boolean[] = [], separator = semi): T[] {
        const result: T[] = []
        const savedFollows = follows
        follows = unionOf(followSet, savedFollows)
        if (firstSet[token]) {
            result.push(element())
            if (separator == semi && token == Token.Semi) separator()
            if (separator == comma && token == Token.Comma) separator()
            let last = scanner.start
            while (firstSet[token]) {
                result.push(element())
                if (separator == semi && token == Token.Semi) separator()
                if (separator == comma && token == Token.Comma) separator()
                if (last == scanner.start) throw new Error(`Parser didn't make progress at ${last}`)
                last = scanner.start
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

    function report(message: string, location: Locatable = {start: scanner.start, end: scanner.end }) {
        diagnostics.push({ location, message })
    }

    function expect(expected: Token): any {
        if (token != expected) {
            if (expected != Token.EOF) {
                report(`Expected ${tokenText(expected)}, received ${tokenText(token)}`)
            }
            else report(`${tokenText(token)} was not expected here`)
            skip()
        }
        const result = scanner.value
        next()
        return result
    }

    function skip() {
        next()
        while (!follows[token]) next()
    }

    function l<T extends Locatable>(start: number | undefined, n: T): T {
        n.start = start
        n.end = scanner.end
        return n
    }
}

function tokenText(token: Token): string {
    switch (token) {
        case Token.Identifier: return "an identifier"
        case Token.Int8: return "an Int8 literal"
        case Token.Int16: return "an Int8 literal"
        case Token.Int32: return "an Int32 literal"
        case Token.Int64: return "an Int64 literal"
        case Token.UInt8: return "an UInt8 literal"
        case Token.UInt16: return "an UInt8 literal"
        case Token.UInt32: return "an UInt8 literal"
        case Token.UInt64: return "an UInt8 literal"
        case Token.Float32: return "an Float32 literal"
        case Token.Float64: return "an Float64 literal"
        case Token.Let: return "a `let` reserved word"
        case Token.Var: return "a `var` reserved word"
        case Token.Type: return "a `type` reserved word"
        case Token.Fun: return "a `fun` reserved word"
        case Token.True: return "a `true` reserved word"
        case Token.False: return "a `false` reserved word"
        case Token.If: return "a `if` reserved word"
        case Token.Else: return "a `else` reserved word"
        case Token.Export: return "a `export` reserved word"
        case Token.Import: return "a `import` reserved word"
        case Token.As: return "a `as` reserved word"
        case Token.Null: return "a `null` reserved word"
        case Token.Block: return "a `block` reserved word"
        case Token.Loop: return "a `loop` reserved word"
        case Token.Branch: return "a `branch` reserved word"
        case Token.Return: return "a `return` reserved word"
        case Token.Dot: return "a '.' operator"
        case Token.Dash: return "a '-' operator"
        case Token.Plus: return "a '+' operator"
        case Token.Star: return "a '*' operator"
        case Token.Slash: return "a '/' operator"
        case Token.Percent: return "a '%` operator"
        case Token.Semi: return "a ';' operator"
        case Token.Comma: return "a ',' operator"
        case Token.Equal: return "an '=' operator"
        case Token.Colon: return "a ':' operator"
        case Token.Bang: return "a '!' operator"
        case Token.Circumflex: return "a '^' operator"
        case Token.And: return "an '&&' operator"
        case Token.Amp: return "an '&' operator"
        case Token.Bar: return "a '|' operator"
        case Token.Or: return "a '||' operator"
        case Token.Gt: return "a '>' operator"
        case Token.Gte: return "a '>=' operator"
        case Token.Lt: return "a '<' operator"
        case Token.Lte: return "a '<=' operator"
        case Token.EqualEqual: return "an '==' operator"
        case Token.NotEqual: return "a '!=' operator"
        case Token.Arrow: return "an '->' operator"
        case Token.LParen: return "a '(' operator"
        case Token.RParen: return "a ')' operator"
        case Token.LBrace: return "a '{' operator"
        case Token.RBrace: return "a '}' operator"
        case Token.LBrack: return "a '[' operator"
        case Token.RBrack: return "a ']' operator"
        case Token.Error: return "an error symbol"
        case Token.EOF: return "end of file" 
    }
}

function setOf(...tokens: Token[]): boolean[] {
    const result: boolean[] = []
    for (const token of tokens) result[token] = true
    return result
}

function unionOf(a: boolean[], b: boolean[]): boolean[] {
    const result: boolean[] = []
    a.forEach((v, i) => result[i] = v)
    b.forEach((v, i) => result[i] = v)
    return result
}


const importSet = setOf(Token.Import)
const identSet = setOf(Token.Identifier)
const rparenSet = setOf(Token.RParen)
const rbrackSet = setOf(Token.RBrack)
const rbraceSet = setOf(Token.RBrace)

const gtSet = setOf(Token.Gt)
const declarationFirstSet = setOf(Token.Var, Token.Let, Token.Fun, Token.Export)
const expressionFirstSet = setOf(Token.Identifier, Token.Int8, Token.Int16, Token.Int32, Token.Int64,
    Token.UInt8, Token.UInt16, Token.UInt32, Token.UInt64, Token.Float32, Token.Float64, Token.Null, Token.True, 
    Token.False, Token.Dash, Token.Plus, Token.If, Token.Amp, Token.LBrack, Token.LBrace)
const statementFirstSet = setOf(Token.Var, Token.Let, Token.Loop, Token.Block, Token.Branch, Token.Return )
const bodyElementFirstSet = unionOf(expressionFirstSet, statementFirstSet)