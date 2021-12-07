import { CompareOp, Let, LiteralBoolean, LiteralKind, Locatable, NodeKind, Parameter, Function, Reference, Scope, StructField, Tree, Var, WhenClause } from "./ast";
import { Scanner } from "./scanner";
import { Token } from "./tokens";

export function parse(text: string): Tree[] {
    let uniqueWhen = 0;
    let scanner = new Scanner(text)

    let token = scanner.next()
    return program()

    function l<T extends Locatable>(cb: () => T): T {
        const start = scanner.start
        const n = cb()
        n.start = start
        n.end = scanner.end
        return n
    }

    function next() {
        token = scanner.next()
    }

    function program(): Tree[] {
        const result = topLevelSequence()
        expect(Token.EOF)
        return result
    }

    function semi() {
        while (token == Token.Semi) {
            next()
        }
    }

    function comma() {
        while (token == Token.Comma) {
            next()
        }
    }

    function topLevelSequence(): Tree[] {
        const result: Tree[] = []
        while (token != Token.EOF) {
            switch(token) {
                case Token.Export: {
                    next()
                    const item = exportableTopLevelItem()
                    item.exported = true
                    result.push(item)
                    semi()
                    continue
                }
                case Token.Fun: 
                case Token.Var: {
                    result.push(exportableTopLevelItem())
                    semi()
                    continue
                }
                case Token.Let:
                    result.push(letDeclaration())
                    semi()
                    continue
                case Token.Type:
                    result.push(typeDeclaration())
                    semi()
                    continue
            }

            break
        }
        return result
    }

    function exportableTopLevelItem(): Function | Var {
        switch(token) {
            case Token.Fun:
                return func()
            case Token.Var:
                return varDeclaration()
        }
        expect(Token.Fun)
        error("")
    }

    function sequence(): Tree[] {
        const result: Tree[] = []
        
        while (token != Token.EOF) {
            switch(token) {
                case Token.Identifier:
                case Token.Int:
                case Token.Double:
                case Token.True:
                case Token.False:
                case Token.Dash:
                case Token.Plus:
                case Token.If:
                case Token.When:
                case Token.While:
                case Token.Loop:
                case Token.Break:
                case Token.Continue:
                case Token.Return:
                case Token.LParen:
                case Token.LBrack:
                case Token.LBrace:
                    result.push(expression())
                    semi()
                    continue
                case Token.Export: {
                    result.push(exportedFunc())
                    semi()
                    continue
                }
                case Token.Fun: {
                    result.push(func())
                    semi()
                    continue
                }
                case Token.Let:
                    result.push(letDeclaration())
                    semi()
                    continue
                case Token.Var:
                    result.push(varDeclaration())
                    semi()
                    continue
                case Token.Type:
                    result.push(typeDeclaration())
                    semi()
                    continue
            }
            break
        }
        return result
    }

    function block(): Tree[] {
        expect(Token.LBrace)
        const result = sequence()
        expect(Token.RBrace)
        return result
    }

    function letDeclaration(): Let {
        return l<Let>(() => {
            expect(Token.Let)
            const name = expectName()
            let type: Tree | undefined
            if (token == Token.Colon) {
                expect(Token.Colon)
                type = typeExpression()
            }
            expect(Token.Equal)
            const value = expression()
            return { kind: NodeKind.Let, name, type, value }
        })
    }

    function varDeclaration(): Var {
        return l<Var>(() => {
            expect(Token.Var)
            const name = expectName()
            let type: Tree | undefined
            if (token == Token.Colon) {
                expect(Token.Colon)
                type = typeExpression()
            }
            expect(Token.Equal)
            const value = expression()
            return { kind: NodeKind.Var, name, type, value }
        })
    }

    function typeDeclaration(): Tree {
        return l<Tree>(() => {
            expect(Token.Type)
            const name = expectName()
            expect(Token.Equal)
            const type = typeExpression()
            return { kind: NodeKind.Type, name, type }
        })
    }

    function expression(): Tree {
        return l(() => {
            let result = andExpression()
            if (token == Token.Equal) {
                next()
                const value = andExpression()
                return { kind: NodeKind.Assign, target: result, value }
            }
            return result    
        })
    }

    function andExpression(): Tree {
        return l(() => {
            let result = orExperssion()
            if (token == Token.And) {
                next()
                const right = orExperssion()
                result = { kind: NodeKind.And, left: result, right }
            }
            return result    
        })
    }

    function orExperssion(): Tree {
        return l(() => {
            let result = compareExpression()
            if (token == Token.Or) {
                next()
                const right = compareExpression()
                result = { kind: NodeKind.Or, left: result, right}
            }
            return result
        })
    }

    function compareExpression(): Tree {
        return l(() => {
            let result = addExpression()
            let op = CompareOp.Unknown
            switch (token) {
                case Token.Gt: op = CompareOp.GreaterThan; break
                case Token.Gte: op = CompareOp.GreaterThanEqual; break
                case Token.Lt: op = CompareOp.LessThan; break
                case Token.Lte: op = CompareOp.LessThanEqual; break
                case Token.EqualEqual: op = CompareOp.Equal; break
                case Token.NotEqual: op = CompareOp.NotEqual; break
            }
            if (op != CompareOp.Unknown) {
                next()
                const right = addExpression()
                result = { kind: NodeKind.Compare, op, left: result, right }
            }
            return result
        })
    }

    function addExpression(): Tree {
        return l(() => {
            let result = multiplyExpression()
            while (true) {
                switch (token) {
                    case Token.Plus: {
                        next()
                        const right = addExpression()
                        result = { kind: NodeKind.Add, left: result, right }
                        continue
                    }
                    case Token.Dash: {
                        next()
                        const right = addExpression()
                        result = { kind: NodeKind.Subtract, left: result, right }
                        continue
                    }
                }
                break
            }
            return result
        })
    }

    function multiplyExpression(): Tree {
        return l(() => {
            let result = simpleExpression()
            while (true) {
                switch (token) {
                    case Token.Star: {
                        next()
                        const right = multiplyExpression()
                        result = { kind: NodeKind.Multiply, left: result, right }
                        continue
                    }
                    case Token.Slash: {
                        next()
                        const right = multiplyExpression()
                        result = { kind: NodeKind.Divide, left: result, right }
                        continue
                    }
                }
                break
            }
            return result
        })
    }

    function simpleExpression(): Tree {
        return l(() => {
            let result = primitiveExpression()
            while (true) {
                switch (token) {
                    case Token.LParen:
                        result = call(result)
                        continue
                    case Token.LBrack:
                        result = index(result)
                        continue
                    case Token.Dot: {
                        next()
                        const name = expectName()
                        result = { kind: NodeKind.Select, target: result, name }
                        continue
                    }
                }
                break
            }
            return result
        })
    }

    function call(target: Tree): Tree {
        return l<Tree>(() => {
            expect(Token.LParen)
            const args: Tree[] = []
            while (token != Token.RParen && token != Token.EOF) {
                args.push(expression())
                if (token == Token.Comma) next()
            }
            expect(Token.RParen)
            return { kind: NodeKind.Call, target, arguments: args }    
        })
    }

    function index(target: Tree): Tree {
        return l<Tree>(() => {
            expect(Token.LBrack)
            const index = expression()
            expect(Token.RBrack)
            return { kind: NodeKind.Index, target, index }
        })
    }

    function primitiveExpression(): Tree {
        return l<Tree>(() => {
            switch (token) {
                case Token.Int: {
                    const value = scanner.value
                    next() 
                    return { kind: NodeKind.Literal, literalKind: LiteralKind.Int, value }
                }
                case Token.Double: {
                    const value = scanner.value
                    next() 
                    return { kind: NodeKind.Literal, literalKind: LiteralKind.Double, value }
                }
                case Token.True: 
                case Token.False: {
                    const value = scanner.value
                    next()
                    return { kind: NodeKind.Literal, literalKind: LiteralKind.Boolean, value }
                }
                case Token.Identifier: {
                    const name = scanner.value as string
                    next()
                    return { kind: NodeKind.Reference, name }
                }
                case Token.Plus: {
                    next()
                    return primitiveExpression()
                }
                case Token.Dash: {
                    next()
                    const target = primitiveExpression()
                    return { kind: NodeKind.Negate, target }
                }
                case Token.Bang: {
                    next()
                    const target = primitiveExpression()
                    return { kind: NodeKind.Not, target }
                }
                case Token.When: return when()
                case Token.If: return ifExpr()
                case Token.Loop: return loop()
                case Token.While: return whileExpr()
                case Token.Break: {
                    next()
                    let name: string | undefined = undefined
                    if (token as any == Token.Identifier) {
                        name == expectName()
                    }
                    return { kind: NodeKind.Break, name }
                }
                case Token.Continue: {
                    next()
                    let name: string | undefined = undefined
                    if (token as any == Token.Identifier) {
                        name == expectName()
                    }
                    return { kind: NodeKind.Continue, name }
                }
                case Token.Return: {
                    next()
                    let value: Tree | undefined = undefined
                    switch (token as any) {
                        case Token.Identifier:
                        case Token.Int:
                        case Token.Double:
                        case Token.True:
                        case Token.False:
                        case Token.Dash:
                        case Token.Plus:
                        case Token.If:
                        case Token.When:
                        case Token.While:
                        case Token.Loop:
                        case Token.Break:
                        case Token.Continue:
                        case Token.Return:
                        case Token.LParen:
                        case Token.LBrack:
                        case Token.LBrace:
                        case Token.Fun: {
                            value = expression()
                            break
                        }        
                    }
                    return { kind: NodeKind.Return, value }
                }
                case Token.LBrack: return array()
                case Token.LBrace: return struct()
                case Token.LParen: {
                    next()
                    const result = expression()
                    expect(Token.RParen)
                    return result
                }
            }
    
            error(`Expected an expression`)
        })
    }

    function func(exported: boolean = false): Function {
        return l<Function>(() => {
            expect(Token.Fun)
            const name = expectName()
            expect(Token.LParen)
            const parameters: Parameter[] = []
            while (token != Token.RParen && token != Token.EOF) {
                const name = expectName()
                expect(Token.Colon)
                const type = typeExpression()
                parameters.push({ kind: NodeKind.Parameter, name, type })
                if (token == Token.Comma) next()
            }
            expect(Token.RParen)
            expect(Token.Colon)
            const result = typeExpression()
            let body: Tree[] = []
            switch (token as any) {
                case Token.Equal:
                    next()
                    body.push(expression())
                    break
                case Token.LBrace:
                    body = block()
                    break
                default:
                    expect(Token.LBrace)
                    break
            }
            return { kind: NodeKind.Function, parameters, body, result, name, exported }
        })
    }

    function when(): Tree {
        return l<Tree>(() => {
            expect(Token.When)
            let target: Tree | undefined = undefined
            let targetName: string | undefined = undefined
            if (token == Token.LParen) {
                expect(Token.LParen)
                target = expression()
                expect(Token.RParen)
                targetName = `$$when_${uniqueWhen++}`
            }
            expect(Token.LBrace)
            const clauses = whenClauses(targetName)
            expect(Token.RBrace)
            return { kind: NodeKind.When, target, targetName, clauses }
        })
    }

    function whenElseClause(): WhenClause {
        return l<WhenClause>(() => {
            expect(Token.Else)
            expect(Token.Arrow)
            const body = expression()
            const condition: LiteralBoolean = {
                kind: NodeKind.Literal,
                literalKind: LiteralKind.Boolean,
                value: true
            }
            return { kind: NodeKind.WhenClause, condition, body }
        })
    }

    function whenClauses(targetName: string | undefined): WhenClause[] {
        const result: WhenClause[] = []
        while (true) {
            switch (token) {
                case Token.Else: {
                    result.push(whenElseClause())
                    semi()
                    continue
                }
                case Token.EOF:
                case Token.RBrace:
                    break
                default: {
                    let clause = l<WhenClause>(() => {
                        let condition = expression()
                        if (targetName) {
                            condition = {
                                kind: NodeKind.Compare,
                                op: CompareOp.Equal,
                                left: {
                                    kind: NodeKind.Reference,
                                    name: targetName
                                },
                                right: condition
                            }
                        }
                        expect(Token.Arrow)
                        const body = expression()
                        return { kind: NodeKind.WhenClause, condition, body }
                    })
                    result.push(clause)
                    semi()
                    continue
                }
            }

            break
        }

        return result
    }

    function blockOrExpression(): Tree {
        return l<Tree>(() => {
            if (token == Token.LBrace) {
                const blk = block()
                return { kind: NodeKind.BlockExpression, block: blk }
            } else {
                return expression()
            }
        })
    }

    function ifExpr(): Tree {
        return l<Tree>(() => {
            const clauses: WhenClause[] = []
            const ifClause = l<WhenClause>(() => {
                expect(Token.If)
                expect(Token.LParen)
                const condition = expression()
                expect(Token.RParen)
                const body = blockOrExpression()    
                return { kind: NodeKind.WhenClause, condition, body }
            })
            clauses.push(ifClause)
            if (token == Token.Else) {
                next()
                const elseClause = l<WhenClause>(() => {
                    const condition: Tree = { kind: NodeKind.Literal, literalKind: LiteralKind.Boolean, value: true }
                    const body = blockOrExpression()
                    return { kind: NodeKind.WhenClause, condition, body }
                })
                clauses.push(elseClause)
            }
            return { kind: NodeKind.When, clauses }    
        })
    }

    function loop(): Tree {
        return l<Tree>(() => {
            expect(Token.Loop)
            let name: string | undefined = undefined
            if (token == Token.Identifier) {
                name = expectName()
            }
            const body = block()
            return { kind: NodeKind.Loop, name, body }
        })
    }

    function whileExpr(): Tree {
        return l<Tree>(() => {
            expect(Token.While)
            let name: string | undefined = undefined
            if (token == Token.Identifier) {
                name = expectName()
            }
            expect(Token.LParen)
            const condition = expression()
            expect(Token.RParen)
            const test: Tree = {
                kind: NodeKind.When,
                clauses: [
                    {
                        kind: NodeKind.WhenClause,
                        condition: {
                            kind: NodeKind.Not,
                            target: condition
                        },
                        body: {
                            kind: NodeKind.Break
                        }
                    }
                ]
            }
            const body = [test, ...block()]
            return { kind: NodeKind.Loop, body }        
        })
    }

    function exportedFunc(): Tree {
        expect(Token.Export)
        return func(true)
    }

    function struct(): Tree {
        return l<Tree>(() => {
            const body: Tree[] = []
            expect(Token.LBrace)
            while (true) {
                switch(token) {
                    case Token.Identifier:
                        body.push(field())
                        if (token as any == Token.Comma) next()
                        continue
                    case Token.Spread: {
                        next()
                        const target = expression()
                        body.push({ kind: NodeKind.Spread, target })
                        if (token as any == Token.Comma) next()
                        continue
                    }
                    case Token.Let:
                        body.push(letDeclaration())
                        if (token as any == Token.Comma) next()
                        continue
                    case Token.Fun:
                        body.push(func(false))
                        if (token as any == Token.Comma) next()
                        continue
                }
                break
            }
            expect(Token.RBrace)
            return { kind: NodeKind.StructLit, body }
            })
    }

    function field(): Tree {
        return l<Tree>(() => {
            const name = expectName()
            expect(Token.Colon)
            const value = expression()
            return { kind: NodeKind.Field, name, value }
        })
    }

    function array(): Tree {
        return l<Tree>(() => {
            const values: Tree[] = []
            expect(Token.LBrack)
            while (true) {
                switch (token) {
                    case Token.RBrack:
                    case Token.EOF:
                        break
                    case Token.Spread: {
                        values.push(l<Tree>(() => {
                            next()
                            const target = expression()
                            return { kind: NodeKind.Spread, target }
                        }))
                        if (token as any == Token.Comma) next()
                        continue
                    }
                    default:
                        values.push(expression())
                        if (token == Token.Comma) next()
                        continue
                }
                break
            }
            expect(Token.RBrack)
            return { kind: NodeKind.ArrayLit, values }
        })
    }

    function typeExpression(): Tree {
        return l<Tree>(() => {
            let result = primitiveTypeExpression()
            while (true) {
                switch (token) {
                    case Token.Dot: {
                        next()
                        const name = expectName()
                        result = { kind: NodeKind.Select, target: result, name }
                        continue
                    }
                    case Token.LBrack: {
                        next()
                        if (token as any == Token.Int) {
                            const size = scanner.value as number
                            expect(Token.RBrack)
                            result = { kind: NodeKind.ArrayCtor, element: result, size }
                        } else {
                            expect(Token.RBrack)
                            result = { kind: NodeKind.ArrayCtor, element: result }
                        }
                        continue
                    }
                }
                break
            }
            return result    
        })
    }

    function primitiveTypeExpression(): Tree {
        return l<Tree>(() => {
            switch (token) {
                case Token.Identifier: {
                    const name = expectName()
                    return { kind: NodeKind.Reference, name }
                }
                case Token.Lt: {
                    next()
                    const fields: StructField[] = []
                    while (true) {
                        switch (token as any) {
                            case Token.Identifier:
                                const field = l<StructField>(() => {
                                    const name = expectName()
                                    expect(Token.Colon)
                                    const type = typeExpression()
                                    return { kind: NodeKind.StructField, name, type }
                                })
                                fields.push(field)
                                comma()
                                continue
                        }
                        break
                    }
                    expect(Token.Gt)
                    return { kind: NodeKind.StructTypeLit, fields }
                }
                case Token.LParen: {
                    next()
                    const result = typeExpression()
                    expect(Token.RParen)
                    return result
                }
                default:
                    return { kind: NodeKind.Reference, name: expectName() }
            }
        })
    }

    function error(message: string): never {
        const e = new Error(message);
        (e as any).position = scanner.start
        throw e
    }
    
    function expectName(): string {
        if (token != Token.Identifier) {
            error(`Expected an identifer`)
        }
        const result = scanner.value as string
        next()
        return result
    }

    function tokenText(token: Token): string {
        switch (token) {
            case Token.Identifier: return "an identifier"
            case Token.Dash: return `"-"`
            case Token.Dot: return `"."`
            case Token.EOF: return `end of the file`
            case Token.Equal: return `"="`
            case Token.LBrace: return `"{"`
            case Token.LParen: return `"("`
            case Token.Let: return `let`
            case Token.Fun: return `fun`
            case Token.Var: return `var`
            case Token.Type: return `type`
            case Token.True: return `true`
            case Token.False: return `false`
            case Token.When: return `when`
            case Token.While: return `while`
            case Token.If: return `if`
            case Token.Else: return `else`
            case Token.Export: return `export`
            case Token.Loop: return `loop`
            case Token.Break: return `break`
            case Token.Continue: return `continue`
            case Token.Return: return `return`
            case Token.Int: return `an int`
            case Token.Double: return `a double`
            case Token.Plus: return `"+"`
            case Token.RBrace: return `"}"`
            case Token.RParen: return `")"`
            case Token.Semi: return `";"`
            case Token.Slash: return `"/"`
            case Token.Star: return `"*"`
            case Token.Comma: return `","`
            case Token.Colon: return `":"`
            case Token.Bang: return `"!"`
            case Token.LBrack: return `"["`
            case Token.RBrack: return `"]"`
            case Token.Spread: return `"..."`
            case Token.Arrow: return `"->"`
            case Token.And: return `"&&"`
            case Token.Or: return `"||"`
            case Token.EqualEqual: return `"=="`
            case Token.NotEqual: return `"!="`
            case Token.Lt: return `"<"`
            case Token.Lte: return `"<="`
            case Token.Gt: return `">"`
            case Token.Gte: return `">="`
            case Token.Error: return `an invalid token`
        }
    }

    function expect(expected: Token): any {
        if (token != expected) {
            if (expected != Token.EOF)
                error(`Expected ${tokenText(expected)}`)
            else error(`The token ${tokenText(token)} was not expected here`)
        }
        const result = scanner.value
        next()
        return result
    }

    function peek() {
        const cloned = scanner.clone()
        return scanner.next()
    }
}
