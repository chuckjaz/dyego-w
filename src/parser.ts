import { CompareOp, Let, LiteralBoolean, LiteralKind, Locatable, NodeKind, Parameter, Function, Reference, Scope, StructField, Tree, Var, ImportItem, ImportFunction, SwitchCase } from "./ast";
import { Scanner } from "./scanner";
import { Token } from "./tokens";

export function parse(text: string): Tree[] {
    let uniqueWhen = 0;
    let scanner = new Scanner(text)

    let token = scanner.next()
    return program()

    function l<T extends Locatable>(cb: () => T): T {
        return loc(scanner.start, cb())
    }

    function loc<T extends Locatable>(start: number, n: T): T {
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
                case Token.Import:
                    result.push(importDeclaration())
                    semi()
                    continue
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
                case Token.Block:
                case Token.Switch:
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

    function importDeclaration(): Tree {
        return l<Tree>(() => {
            expect(Token.Import)
            const module = expectName()
            expect(Token.LBrace)
            const imports = importItems(module)
            expect(Token.RBrace)
            return { kind: NodeKind.Import, imports }
        })
    }

    function importItems(module: string): ImportItem[] {
        const result: ImportItem[] = []
        while (true) {
            switch (token) {
                case Token.Fun:
                    result.push(importFunction(module))
                    semi()
                    continue
            }
            break
        }
        return result
    }

    function importFunction(module: string): ImportFunction {
        return l<ImportFunction>(() => {
            expect(Token.Fun)
            const name = expectName()
            const parameters = funcParameters()
            expect(Token.Colon)
            const result = typeExpression()
            let as: string | undefined = undefined
            if (token == Token.As) {
                next()
                as = expectName()
            }
            return { kind: NodeKind.ImportFunction, name, module, parameters, result, as  }
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
        const start = scanner.start
        let result = orExperssion()
        if (token == Token.And) {
            next()
            const right = orExperssion()
            result = loc<Tree>(start, { kind: NodeKind.And, left: result, right })
        }
        return result
    }

    function orExperssion(): Tree {
        const start = scanner.start
        let result = compareExpression()
        if (token == Token.Or) {
            next()
            const right = compareExpression()
            result = loc<Tree>(start, { kind: NodeKind.Or, left: result, right})
        }
        return result
    }

    function compareExpression(): Tree {
        const start = scanner.start
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
            result = loc<Tree>(start, { kind: NodeKind.Compare, op, left: result, right })
        }
        return result
    }

    function addExpression(): Tree {
        const start = scanner.start
        let result = multiplyExpression()
        while (true) {
            switch (token) {
                case Token.Plus: {
                    next()
                    const right = addExpression()
                    result = loc<Tree>(start, { kind: NodeKind.Add, left: result, right })
                    continue
                }
                case Token.Dash: {
                    next()
                    const right = addExpression()
                    result = loc<Tree>(start, { kind: NodeKind.Subtract, left: result, right })
                    continue
                }
            }
            break
        }
        return result
    }

    function multiplyExpression(): Tree {
        const start = scanner.start
        let result = asLevelExpression()
        while (true) {
            switch (token) {
                case Token.Star: {
                    next()
                    const right = multiplyExpression()
                    result = loc<Tree>(start, { kind: NodeKind.Multiply, left: result, right })
                    continue
                }
                case Token.Slash: {
                    next()
                    const right = multiplyExpression()
                    result = loc<Tree>(start, { kind: NodeKind.Divide, left: result, right })
                    continue
                }
            }
            break
        }
        return result
    }

    function asLevelExpression(): Tree {
        const start = scanner.start
        return l<Tree>(() => {
            let result = simpleExpression()
            switch (token) {
                case Token.As:
                    result = asExpr(result)
                    break
            }
            return result
        })
    }

    function simpleExpression(): Tree {
        const start = scanner.start
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
                        result = loc<Tree>(start, { kind: NodeKind.Select, target: result, name })
                        continue
                    }
                    case Token.Circumflex:
                        next()
                        result = loc<Tree>(start, { kind: NodeKind.Dereference, target: result })
                        continue
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

    function asExpr(left: Tree): Tree {
        return l<Tree>(() => {
            expect(Token.As)
            const right = typeExpression()
            return { kind: NodeKind.As, left, right }
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
                case Token.Null: {
                    next()
                    return { kind: NodeKind.Literal, literalKind: LiteralKind.Null, value: null }
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
                case Token.Amp: {
                    next()
                    const target = simpleExpression()
                    return { kind: NodeKind.AddressOf, target }
                }
                case Token.If: return ifExpr()
                case Token.Loop: return loop()
                case Token.Block: return blockExplicit()
                case Token.While: return whileExpr()
                case Token.Switch: return switchStatement()
                case Token.Break: {
                    next()
                    let name: string | undefined = undefined
                    switch (token as any) {
                        case Token.Identifier:
                            name = expectName()
                            break
                        case Token.LBrack:
                            next()
                            const expr = expression()
                            expect(Token.RBrack)
                            expect(Token.Colon)
                            const labels = expectNames()
                            expect(Token.Else)
                            const elseBlock = expectName()
                            return {
                                kind: NodeKind.BreakIndexed,
                                expression: expr,
                                labels,
                                else: elseBlock
                            };
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

    function param(): Parameter {
        return l<Parameter>(() => {
            const name = expectName()
            expect(Token.Colon)
            const type = typeExpression()
            return { kind: NodeKind.Parameter, name, type }
        })
    }

    function funcParameters(): Parameter[] {
        expect(Token.LParen)
        const parameters: Parameter[] = []
        while (token != Token.RParen && token != Token.EOF) {
            parameters.push(param())
            comma()
        }
        expect(Token.RParen)
        return parameters
    }

    function func(exported: boolean = false): Function {
        return l<Function>(() => {
            expect(Token.Fun)
            const name = expectName()
            const parameters = funcParameters()
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
            expect(Token.If)
            expect(Token.LParen)
            const condition = expression()
            expect(Token.RParen)
            const then = blockOrExpression()
            let elsePart: Tree | undefined = undefined
            if (token == Token.Else) {
                next()
                elsePart = blockOrExpression()
            }
            return { kind: NodeKind.IfThenElse, condition, then, else: elsePart }
        })
    }

    function optionalName(): string | undefined {
        if (token == Token.Identifier) {
            return expectName()
        }
    }

    function loop(): Tree {
        return l<Tree>(() => {
            expect(Token.Loop)
            let name = optionalName()
            const body = block()
            return { kind: NodeKind.Loop, name, body }
        })
    }

    function blockExplicit(): Tree {
        return l<Tree>(() => {
            expect(Token.Block)
            const name = optionalName()
            const body = block()
            return { kind: NodeKind.BlockExpression, block: body, name }
        })
    }

    function whileExpr(): Tree {
        return l<Tree>(() => {
            expect(Token.While)
            let name = optionalName()
            expect(Token.LParen)
            const condition = expression()
            expect(Token.RParen)
            const test: Tree = {
                kind: NodeKind.IfThenElse,
                condition: {
                    kind: NodeKind.Not,
                    target: condition
                },
                then: {
                    kind: NodeKind.Break
                }
            }
            const body = [test, ...block()]
            return { kind: NodeKind.Loop, body }
        })
    }

    function switchStatement(): Tree {
        return l<Tree>(() => {
            expect(Token.Switch)
            const name = optionalName()
            expect(Token.LParen)
            const target = expression()
            expect(Token.RParen)
            expect(Token.LBrace)
            const cases: SwitchCase[] = []
            while(true) {
                switch (token) {
                    case Token.Case:
                        cases.push(switchCase())
                        semi()
                        continue
                    case Token.Default:
                        cases.push(switchDefault())
                        semi()
                        continue
                }
                break
            }
            expect(Token.RBrace)
            return { kind: NodeKind.Switch, name, target, cases }
        })
    }

    function switchCase(): SwitchCase {
        return l<SwitchCase>(() => {
            expect(Token.Case)
            const expressions = expressionList()
            expect(Token.Colon)
            const body = sequence()
            return { kind: NodeKind.SwitchCase, expressions, body }
        })
    }

    function switchDefault(): SwitchCase {
        return l<SwitchCase>(() => {
            expect(Token.Default)
            expect(Token.Colon)
            const body = sequence()
            return { kind: NodeKind.SwitchCase, expressions: [], default: true, body }
        })
    }

    function expressionList(): Tree[] {
        const result: Tree[] = []
        while (true) {
            switch (token) {
                case Token.Colon:
                case Token.EOF:
                case Token.RBrace:
                    return result
            }
            result.push(expression())
            comma()
        }
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
            const start = scanner.start
            let result = primitiveTypeExpression()
            while (true) {
                switch (token) {
                    case Token.Dot: {
                        next()
                        const name = expectName()
                        result = loc<Tree>(start, { kind: NodeKind.Select, target: result, name })
                        continue
                    }
                    case Token.Circumflex: {
                        next()
                        result = loc<Tree>(start, {kind: NodeKind.PointerCtor, target: result })
                        continue
                    }
                    case Token.LBrack: {
                        next()
                        if (token as any == Token.Int) {
                            const size = scanner.value as number
                            expect(Token.RBrack)
                            result = loc<Tree>(start, { kind: NodeKind.ArrayCtor, element: result, size })
                        } else {
                            expect(Token.RBrack)
                            result = loc<Tree>(start, { kind: NodeKind.ArrayCtor, element: result })
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

    function expectNames(): string[] {
        const result: string[] = []
        while (token == Token.Identifier) {
            result.push(expectName())
            comma()
        }
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
            case Token.Null: return `null`
            case Token.When: return `when`
            case Token.While: return `while`
            case Token.If: return `if`
            case Token.Else: return `else`
            case Token.Export: return `export`
            case Token.Import: return `import`
            case Token.As: return `as`
            case Token.Block: return `block`
            case Token.Loop: return `loop`
            case Token.Switch: return `switch`
            case Token.Case: return `case`
            case Token.Fallthrough: return `fallthrough`
            case Token.Default: return `default`
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
            case Token.Circumflex: return `"^"`
            case Token.LBrack: return `"["`
            case Token.RBrack: return `"]"`
            case Token.Spread: return `"..."`
            case Token.Arrow: return `"->"`
            case Token.And: return `"&&"`
            case Token.Amp: return `"&"`
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
            else error(`The token "${tokenText(token)}" was not expected here`)
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
