import {
    Add, AddressOf, And, ArrayConstructor, ArrayLiteral, Assign, BitAnd, BitOr, BitRotl, BitRotr, BitShl, BitShr,
    BitXor, Block, BodyElement, Branch, BranchIndexed, Call, CountLeadingZeros, CountNonZeros, CountTrailingZeros,
    Declaration, Dereference, Diagnostic, Divide, Exportable, Exported, Expression, Field, Function, Global, IfThenElse,
    Import, ImportFunction, ImportItem, ImportVariable, Index, LastKind, Let, LiteralBool, LiteralF32, LiteralF64,
    LiteralI6, LiteralI32, LiteralI64, LiteralI8, PrimitiveKind, LiteralNull, LiteralU16, LiteralU32, LiteralU64,
    LiteralU8, Locatable, Loop, Module, Multiply, Negate, Not, Or, Parameter, PointerConstructor, Reference, Remainder,
    Return, Select, SizeOf, FieldLiteral, StructLiteral, StructTypeLiteral, Subtact, TypeDeclaration, TypeExpression,
    TypeSelect, Var, Primitive, UnionTypeLiteral, AbsoluteValue, SquareRoot, Floor, Ceiling, Truncate, RoundNearest,
    CopySign, Minimum, Maximum, ConvertTo, WrapTo, ReinterpretAs, TruncateTo, Memory, MemoryMethod
} from "../last";
import { Scanner } from "../last-parser";
import { Token } from "./tokens";

interface PositionMap {
    pos(offset: number): number
}

export function parse(scanner: Scanner, builder?: PositionMap): Module | Diagnostic[] {
    let follows = setOf(Token.EOF, Token.Fun, Token.Var, Token.Let, Token.Type)
    let token = scanner.next()
    const diagnostics: Diagnostic[] = []
    const pos = builder ? {
        get start() { return builder.pos(scanner.start) },
        get end() { return builder.pos(scanner.end) }
    } : scanner
    const result = module()
    return diagnostics.length > 0 ? diagnostics : result

    function module(): Module {
        const start = pos.start
        const imports = importStatements()
        const declarations = declarationStatements()
        expect(Token.EOF)
        return l<Module>(start, { kind: LastKind.Module, imports, declarations })
    }

    function importStatements(): Import[] {
        return sequence(importStatement, importSet)
    }

    function importStatement(): Import {
        const start = pos.start
        expect(Token.Import)
        const module = expectName()
        expect(Token.LBrace)
        const imports = importItems(module)
        expect(Token.RBrace)
        return l<Import>(start, { kind: LastKind.Import, module, imports })
    }

    function importItems(module: Reference): ImportItem[] {
        return sequence(() => importItem(module), importItemSet, importItemSet, comma)
    }

    function importItem(module: Reference): ImportItem {
        switch (token) {
            case Token.Var:
                return importVariable(module)
            case Token.Fun:
                return importFunction(module)
            default:
                throw new Error("Unexpected token")
        }
    }

    function importFunction(module: Reference): ImportFunction {
        const start = pos.start
        expect(Token.Fun)
        const name = expectName()
        expect(Token.LParen)
        const parameters = parameterList()
        expect(Token.RParen)
        expect(Token.Colon)
        const result = typeExpression()
        let as: Reference | undefined = undefined
        if (token == Token.As) {
            next()
            as = expectName()
        }
        return l<ImportFunction>(start, { kind: LastKind.ImportFunction, module, name, parameters, result, as })
    }

    function importVariable(module: Reference): ImportVariable {
        const start = pos.start
        expect(Token.Var)
        const name = expectName()
        expect(Token.Colon)
        const type = typeExpression()
        let as: Reference | undefined = undefined
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
        const start = pos.start
        const name = expectName()
        expect(Token.Colon)
        const type = typeExpression()
        return l<Parameter>(start, { kind: LastKind.Parameter, name, type })
    }

    function typeExpression(): TypeExpression {
        const start = pos.start
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
                    if (token as any == Token.LiteralI32) {
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
        const start = pos.start
        switch (token) {
            case Token.Identifier: {
                return expectName()
            }
            case Token.I8: {
                next()
                return l<Primitive>(start, { kind: LastKind.Primitive, primitive: PrimitiveKind.I8 })
            }
            case Token.I16: {
                next()
                return l<Primitive>(start, { kind: LastKind.Primitive, primitive: PrimitiveKind.I16 })
            }
            case Token.I32: {
                next()
                return l<Primitive>(start, { kind: LastKind.Primitive, primitive: PrimitiveKind.I32 })
            }
            case Token.I64: {
                next()
                return l<Primitive>(start, { kind: LastKind.Primitive, primitive: PrimitiveKind.I64 })
            }
            case Token.U8: {
                next()
                return l<Primitive>(start, { kind: LastKind.Primitive, primitive: PrimitiveKind.U8 })
            }
            case Token.U16: {
                next()
                return l<Primitive>(start, { kind: LastKind.Primitive, primitive: PrimitiveKind.U16 })
            }
            case Token.U32: {
                next()
                return l<Primitive>(start, { kind: LastKind.Primitive, primitive: PrimitiveKind.U32 })
            }
            case Token.U64: {
                next()
                return l<Primitive>(start, { kind: LastKind.Primitive, primitive: PrimitiveKind.U64 })
            }
            case Token.F32: {
                next()
                return l<Primitive>(start, { kind: LastKind.Primitive, primitive: PrimitiveKind.F32 })
            }
            case Token.F64: {
                next()
                return l<Primitive>(start, { kind: LastKind.Primitive, primitive: PrimitiveKind.F64 })
            }
            case Token.Bool: {
                next()
                return l<Primitive>(start, { kind: LastKind.Primitive, primitive: PrimitiveKind.Bool })
            }
            case Token.Void: {
                next()
                return l<Primitive>(start, { kind: LastKind.Primitive, primitive: PrimitiveKind.Void })
            }
            case Token.Null: {
                next()
                return l<Primitive>(start, { kind: LastKind.Primitive, primitive: PrimitiveKind.Null })
            }
            case Token.Lt: {
                next()
                const fields = sequence(fieldLiteral, identSet, gtSet, comma)
                expect(Token.Gt)
                return l<StructTypeLiteral>(start, { kind: LastKind.StructTypeLiteral, fields })
            }
            case Token.UnionStart: {
                next()
                const fields = sequence(fieldLiteral, identSet, unionEndSet, comma)
                expect(Token.UnionEnd)
                return l<UnionTypeLiteral>(start, { kind: LastKind.UnionTypeLiteral, fields })
            }
            case Token.LParen: {
                const savedFollows = follows
                follows = unionOf(savedFollows, rparenSet)
                const result = typeExpression()
                follows = savedFollows
                return result
            }
            default:
                return expectName()
        }
    }

    function fieldLiteral(): FieldLiteral {
        const start = pos.start
        const name = expectName()
        expect(Token.Colon)
        const type = typeExpression()
        return l<FieldLiteral>(start, { kind: LastKind.FieldLiteral, name, type })
    }

    function declarationStatements(): Declaration[] {
        return sequence(declarationStatement, declarationFirstSet, declarationFirstSet)
    }

    function declarationStatement(): Declaration {
        const start = pos.start
        switch (token) {
            case Token.Export: {
                next()
                const target = exportable()
                return l<Exported>(start, { kind: LastKind.Exported, target })
            }
            case Token.Fun:
            case Token.Global:
                return exportable()
            case Token.Var:
                return varDeclaration()
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
        const start = pos.start
        switch (token) {
            case Token.Fun:
                return functionDeclaration()
            case Token.Global:
                return globalDeclaration()
            default:
                report("Expected a let or var declaration")
                return undefined as any as Exportable
        }
    }

    function letDeclaration(): Let {
        const start = pos.start
        expect(Token.Let)
        const name = expectName()
        expect(Token.Colon)
        const type = typeExpression()
        expect(Token.Equal)
        const value = expression()
        return l<Let>(start, { kind: LastKind.Let, name, type, value })
    }

    function varDeclaration(): Var {
        const start = pos.start
        expect(Token.Var)
        const name = expectName()
        let type: TypeExpression | undefined = undefined
        if (token == Token.Colon) {
            expect(Token.Colon)
            type = typeExpression()
        }
        let value: Expression | undefined = undefined
        if (token == Token.Equal) {
            next()
            value = expression()
        }
        if (!type && !value) {
            report("A value or type is required")
        }
        return l<Var>(start, { kind: LastKind.Var, name, type, value })
    }

    function globalDeclaration(): Global {
        const start = pos.start
        expect(Token.Global)
        const name = expectName()
        expect(Token.Colon)
        const type = typeExpression()
        expect(Token.Equal)
        const value = expression()
        return l<Global>(start, { kind: LastKind.Global, name, type, value })
    }

    function typeDeclaration(): TypeDeclaration {
        const start = pos.start
        expect(Token.Type)
        const name = expectName()
        expect(Token.Equal)
        const type = typeExpression()
        return l<TypeDeclaration>(start, { kind: LastKind.Type, name, type })
    }

    function functionDeclaration(): Function {
        const start = pos.start
        expect(Token.Fun)
        const name = expectName()
        expect(Token.LParen)
        const parameters = parameterList()
        expect(Token.RParen)
        expect(Token.Colon)
        const result = typeExpression()
        let body: BodyElement[]
        if (token == Token.Equal) {
            next()
            body = [expression()]
        } else {
            body = statements()
        }
        return l<Function>(start, { kind: LastKind.Function, name, parameters, result, body })
    }

    function expression(): Expression {
        return identExpression()
    }

    function identExpression(): Expression {
        const start = pos.start
        let left = orExpression()
        while (true) {
            switch (token) {
                case Token.Min: {
                    next()
                    const right = orExpression()
                    left = l<Minimum>(start, { kind: LastKind.Minimum, left, right })
                    continue
                }
                case Token.Max: {
                    next()
                    const right = orExpression()
                    left = l<Maximum>(start, { kind: LastKind.Maximum, left, right })
                    continue
                }
                case Token.CopySign: {
                    next()
                    const right = orExpression()
                    left = l<CopySign>(start, { kind: LastKind.CopySign, left, right })
                    continue
                }
                case Token.ConvertTo: {
                    next()
                    const right = typeExpression()
                    left = l<ConvertTo>(start, { kind: LastKind.ConvertTo, left, right })
                    continue
                }
                case Token.WrapTo: {
                    next()
                    const right = typeExpression()
                    left = l<WrapTo>(start, { kind: LastKind.WrapTo, left, right })
                    continue
                }
                case Token.ReinterpretAs: {
                    next()
                    const right = typeExpression()
                    left = l<ReinterpretAs>(start, { kind: LastKind.ReinterpretAs, left, right })
                    continue
                }
                case Token.TruncateTo: {
                    next()
                    let saturate = false
                    if (token as any == Token.Identifier && scanner.value == "saturated") {
                        next()
                        saturate = true
                    }
                    const right = typeExpression()
                    left = l<TruncateTo>(start, { kind: LastKind.TruncateTo, left, right, saturate })
                    continue
                }
            }
            break
        }
        return left
    }

    function orExpression(): Expression {
        const start = pos.start
        let left = andExpression()
        while (token == Token.Or) {
            next()
            const right = andExpression()
            left = l<Or>(start, { kind: LastKind.Or, left, right })
        }
        return left
    }

    function andExpression(): Expression {
        const start = pos.start
        let left = bitAndExpression()
        while (token == Token.And) {
            next()
            const right = bitAndExpression()
            left = l<And>(start, { kind: LastKind.And, left, right })
        }
        return left
    }

    function bitAndExpression(): Expression {
        const start = pos.start
        let left = bitOrExpression()
        while (token == Token.Amp) {
            next()
            const right = bitOrExpression()
            left = l<BitAnd>(start, { kind: LastKind.BitAnd, left, right })
        }
        return left
    }

    function bitOrExpression(): Expression {
        const start = pos.start
        let left = bitXorExpression()
        while (token == Token.Bar) {
            next()
            const right = bitXorExpression()
            left = l<BitOr>(start, { kind: LastKind.BitOr, left, right })
        }
        return left
    }

    function bitXorExpression(): Expression {
        const start = pos.start
        let left = compareExpression()
        while (token == Token.Xor) {
            next()
            const right = compareExpression()
            left = l<BitXor>(start, { kind: LastKind.BitXor, left, right })
        }
        return left
    }

    function compareExpression(): Expression {
        const start = pos.start
        let left = shiftExpression()
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
            const right = shiftExpression()
            return l<Expression>(start, { kind: op, left, right })
        }
        return left
    }

    function shiftExpression(): Expression {
        const start = pos.start
        let left = addExpression()
        while (true) {
            let op = LastKind.Branch
            switch (token) {
                case Token.Shl: {
                    next()
                    const right = addExpression()
                    left = l<BitShl>(start, { kind: LastKind.BitShl, left, right })
                    continue
                }
                case Token.Shr: {
                    next()
                    const right = addExpression()
                    left = l<BitShr>(start, { kind: LastKind.BitShr, left, right })
                    continue
                }
                case Token.Ror: {
                    next()
                    const right = addExpression()
                    left = l<BitRotr>(start, { kind: LastKind.BitRotr, left, right })
                    continue
                }
                case Token.Rol: {
                    next()
                    const right = addExpression()
                    left = l<BitRotl>(start, { kind: LastKind.BitRotl, left, right })
                    continue
                }
            }
            break
        }
        return left
    }

    function addExpression(): Expression {
        const start = pos.start
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
        const start = pos.start
        let left = simpleExpression()
        while(true) {
            switch (token) {
                case Token.Star: {
                    next()
                    const right = simpleExpression()
                    left = l<Multiply>(start, { kind: LastKind.Multiply, left, right })
                    continue
                }
                case Token.Slash: {
                    next()
                    const right = simpleExpression()
                    left = l<Divide>(start, { kind: LastKind.Divide, left, right })
                    continue
                }
                case Token.Percent: {
                    next()
                    const right = simpleExpression()
                    left = l<Remainder>(start, { kind: LastKind.Remainder, left, right})
                }
            }
            break
        }
        return left
    }

    function simpleExpression(): Expression {
        const start = pos.start
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
                case Token.CountLeadingZeros:
                    next()
                    result = l<CountLeadingZeros>(start, { kind: LastKind.CountLeadingZeros, target: result })
                    continue
                case Token.CountTrailingZeros:
                    next()
                    result = l<CountTrailingZeros>(start, { kind: LastKind.CountTrailingZeros, target: result })
                    continue
                case Token.CountNonZeros:
                    next()
                    result = l<CountNonZeros>(start, { kind: LastKind.CountNonZeros, target: result })
                    continue
                case Token.Abs:
                    next()
                    result = l<AbsoluteValue>(start, { kind: LastKind.AbsoluteValue, target: result })
                    continue
                case Token.Sqrt:
                    next()
                    result = l<SquareRoot>(start, { kind: LastKind.SquareRoot, target: result })
                    continue
                case Token.Floor:
                    next()
                    result = l<Floor>(start, { kind: LastKind.Floor, target: result })
                    continue
                case Token.Ceil:
                    next()
                    result = l<Ceiling>(start, { kind: LastKind.Ceiling, target: result })
                    continue
                case Token.Trunc:
                    next()
                    result = l<Truncate>(start, { kind: LastKind.Truncate, target: result })
                    continue
                case Token.Nearest:
                    next()
                    result = l<RoundNearest>(start, { kind: LastKind.RoundNearest, target: result })
                    continue
            }
            break
        }
        return result
    }

    function primitiveExpression(): Expression {
        const start = pos.start
        switch (token) {
            case Token.Identifier:
                return expectName()
            case Token.LiteralI8: {
                const value = scanner.value
                next()
                return l<LiteralI8>(start, { kind: LastKind.Literal, primitiveKind: PrimitiveKind.I8, value })
            }
            case Token.LiteralI16: {
                const value = scanner.value
                next()
                return l<LiteralI6>(start, { kind: LastKind.Literal, primitiveKind: PrimitiveKind.I16, value })
            }
            case Token.LiteralI32: {
                const value = scanner.value
                next()
                return l<LiteralI32>(start, { kind: LastKind.Literal, primitiveKind: PrimitiveKind.I32, value })
            }
            case Token.LiteralI64: {
                const value = scanner.value
                next()
                return l<LiteralI64>(start, { kind: LastKind.Literal, primitiveKind: PrimitiveKind.I64, value })
            }
            case Token.LiteralU8: {
                const value = scanner.value
                next()
                return l<LiteralU8>(start, { kind: LastKind.Literal, primitiveKind: PrimitiveKind.U8, value })
            }
            case Token.LiteralU16: {
                const value = scanner.value
                next()
                return l<LiteralU16>(start, { kind: LastKind.Literal, primitiveKind: PrimitiveKind.U16, value })
            }
            case Token.LiteralU32: {
                const value = scanner.value
                next()
                return l<LiteralU32>(start, { kind: LastKind.Literal, primitiveKind: PrimitiveKind.U32, value })
            }
            case Token.LiteralU64: {
                const value = scanner.value
                next()
                return l<LiteralU64>(start, { kind: LastKind.Literal, primitiveKind: PrimitiveKind.U64, value })
            }
            case Token.LiteralF32: {
                const value = scanner.value
                next()
                return l<LiteralF32>(start, { kind: LastKind.Literal, primitiveKind: PrimitiveKind.F32, value })
            }
            case Token.LiteralF64: {
                const value = scanner.value
                next()
                return l<LiteralF64>(start, { kind: LastKind.Literal, primitiveKind: PrimitiveKind.F64, value })
            }
            case Token.LiteralChar: {
                const value = scanner.value
                next()
                return l<LiteralU8>(start, { kind: LastKind.Literal, primitiveKind: PrimitiveKind.U8, value })
            }
            case Token.LiteralString: {
                const value = scanner.value as Buffer
                const values = new Uint8Array(value)
                next()
                return l<ArrayLiteral>(start, { kind: LastKind.ArrayLiteral, values })
            }
            case Token.True:
            case Token.False: {
                const value = scanner.value
                next()
                return l<LiteralBool>(start, { kind: LastKind.Literal, primitiveKind: PrimitiveKind.Bool, value })
            }
            case Token.Null: {
                next()
                return l<LiteralNull>(start, { kind: LastKind.Literal, primitiveKind: PrimitiveKind.Null, value: null })
            }
            case Token.Memory: {
                next()
                expect(Token.Dot)
                const methodName = expectName()
                switch (methodName.name) {
                    case "top": return l<Memory>(start, { kind: LastKind.Memory, method: MemoryMethod.Top })
                    case "limit": return l<Memory>(start, { kind: LastKind.Memory, method: MemoryMethod.Limit })
                    case "grow": {
                        expect(Token.LParen)
                        const amount = expression()
                        expect(Token.RParen)
                        return l<Memory>(start, { kind: LastKind.Memory, method: MemoryMethod.Grow,  amount })
                    }
                    default:
                        report("expected one of 'top', 'limit' or 'grow'", methodName)
                }
                return undefined as any as Expression
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
            case Token.Tilde: {
                next()
                const target = primitiveExpression()
                return l<Negate>(start, { kind: LastKind.Negate, target })
            }
            case Token.Amp: {
                next()
                const target = simpleExpression()
                return l<AddressOf>(start, { kind: LastKind.AddressOf, target })
            }
            case Token.If: return ifExpression()
            case Token.SizeOf: return sizeOfExpression()
            case Token.Block: return blockStatement()
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

    function expressionOrBody(): BodyElement[] {
        switch (token) {
            case Token.LBrace:
                return statements()
            default:
                return [expression()]
        }
    }

    function ifExpression(): IfThenElse {
        const start = pos.start
        expect(Token.If)
        expect(Token.LParen)
        const condition = expression()
        expect(Token.RParen)
        const thenExpr = expressionOrBody()
        let elseExpr: BodyElement[] = []
        if (token == Token.Else) {
            next()
            elseExpr = expressionOrBody()
        }
        return l<IfThenElse>(start, { kind: LastKind.IfThenElse, condition, then: thenExpr, else: elseExpr })
    }

    function sizeOfExpression(): SizeOf {
        const start = pos.start
        expect(Token.SizeOf)
        const target = typeExpression()
        return l<SizeOf>(start, { kind: LastKind.SizeOf, target })
    }

    function array(): ArrayLiteral {
        const start = pos.start
        expect(Token.LBrack)
        const elements = sequence(expression, expressionFirstSet, rbrackSet, comma)
        expect(Token.RBrack)
        return l<ArrayLiteral>(start, { kind: LastKind.ArrayLiteral, values: elements })
    }

    function struct(): StructLiteral {
        const start = pos.start
        expect(Token.LBrace)
        const fields = sequence(field, identSet, rbraceSet, comma)
        expect(Token.RBrace)
        return l<StructLiteral>(start, { kind: LastKind.StructLiteral, fields })
    }

    function field(): Field {
        const start = pos.start
        const name = expectName()
        expect(Token.Colon)
        const value = expression()
        return l<Field>(start, { kind: LastKind.Field, name, value })
    }

    function statements(): BodyElement[] {
        const start = pos.start
        expect(Token.LBrace)
        const body = sequence(bodyElement, bodyElementFirstSet, rbraceSet)
        expect(Token.RBrace)
        return body
    }

    function bodyElement(): BodyElement {
        const start = pos.start
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
        const start = pos.start
        expect(Token.Loop)
        let name: Reference | undefined = undefined
        if (token == Token.Identifier) {
            name = expectName()
        }
        expect(Token.LBrace)
        const body = sequence(bodyElement, bodyElementFirstSet, rbraceSet)
        expect(Token.RBrace)
        return l<Loop>(start, { kind: LastKind.Loop, name, body })
    }

    function blockStatement(): Block {
        const start = pos.start
        expect(Token.Block)
        let name: Reference | undefined = undefined
        if (token == Token.Identifier) {
            name = expectName()
        }
        expect(Token.LBrace)
        const body = sequence(bodyElement, bodyElementFirstSet, rbraceSet)
        expect(Token.RBrace)
        return l<Block>(start, { kind: LastKind.Block, name, body })
    }

    function branch(): Branch | BranchIndexed {
        const start = pos.start
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
            let target: Reference | undefined = undefined
            if (token == Token.Identifier) {
                target = expectName()
            }
            return l<Branch>(start, { kind: LastKind.Branch, target })
        }
    }

    function returnStatement(): Return {
        const start = pos.start
        expect(Token.Return)
        let value: Expression | undefined = undefined
        if (expressionFirstSet[token]) {
            value = expression()
        }
        return l<Return>(start, { kind: LastKind.Return, value })
    }

    function expectName(): Reference {
        const start = pos.start
        const result = expect(Token.Identifier)
        if (typeof result !== "string") {
            return { kind: LastKind.Reference, name: "<error>" }
        }
        return l<Reference>(start, { kind: LastKind.Reference, name: result })
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
        n.end = pos.end
        return n
    }
}

function tokenText(token: Token): string {
    switch (token) {
        case Token.Identifier: return "an identifier"
        case Token.LiteralI8: return "an Int8 literal"
        case Token.LiteralI16: return "an Int8 literal"
        case Token.LiteralI32: return "an Int32 literal"
        case Token.LiteralI64: return "an Int64 literal"
        case Token.LiteralU8: return "an UInt8 literal"
        case Token.LiteralU16: return "an UInt8 literal"
        case Token.LiteralU32: return "an UInt8 literal"
        case Token.LiteralU64: return "an UInt8 literal"
        case Token.LiteralF32: return "an Float32 literal"
        case Token.LiteralF64: return "an Float64 literal"
        case Token.LiteralString: return "a string literal"
        case Token.LiteralChar: return "a character literal"
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
        case Token.SizeOf: return "a `sizeof` reserved word"
        case Token.Global: return "a `global` reserved word"
        case Token.Xor: return "a `xor` reserved word"
        case Token.Shl: return "a `shl` reserved word"
        case Token.Shr: return "a `shr` reserved word"
        case Token.Ror: return "a `ror` reserved word"
        case Token.Rol: return "a `rol` reserved word"
        case Token.CountLeadingZeros: return "a `countleadingzeros` reserved word"
        case Token.CountTrailingZeros: return "a `counttrailingzeros` reserved word"
        case Token.CountNonZeros: return "a `countnonzeros` reserved word"
        case Token.Abs: return "a `abs` reserved word"
        case Token.Sqrt: return "a `sqrt` reserved word"
        case Token.Floor: return "a `floor` reserved word"
        case Token.Ceil: return "a `ceil` reserved word"
        case Token.Trunc: return "a `trunc` reserved word"
        case Token.Nearest: return "a `nearest` reserved word"
        case Token.Min: return "a `min` reserved word"
        case Token.Max: return "a `max` reserved word"
        case Token.CopySign: return "a `copysign` reserved word"
        case Token.ConvertTo: return " a `convertto` reserved word"
        case Token.WrapTo: return " a `wrapto` reserved word"
        case Token.ReinterpretAs: return " a `reinterpretas` reserved word"
        case Token.TruncateTo: return " a `truncateto` reserved word"
        case Token.I8: return "a `i8` reserved word"
        case Token.I16: return "a `i16` reserved word"
        case Token.I32: return "a `i32` reserved word"
        case Token.I64: return "a `i64` reserved word"
        case Token.U8: return "a `u8` reserved word"
        case Token.U16: return "a `u16` reserved word"
        case Token.U32: return "a `u32` reserved word"
        case Token.U64: return "a `u64` reserved word"
        case Token.F32: return "a `f32` reserved word"
        case Token.F64: return "a `f64` reserved word"
        case Token.Bool: return "a `bool` reserved word"
        case Token.Void: return "a `void` reserved word"
        case Token.Memory: return "a `memory` reserved word"
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
        case Token.Tilde: return "a '~' operator"
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
        case Token.UnionStart: return "a '<|' operator"
        case Token.UnionEnd: return "a '|>' operator"
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
const importItemSet = setOf(Token.Fun, Token.Var)
const identSet = setOf(Token.Identifier)
const rparenSet = setOf(Token.RParen)
const rbrackSet = setOf(Token.RBrack)
const rbraceSet = setOf(Token.RBrace)
const unionEndSet = setOf(Token.UnionEnd)

const gtSet = setOf(Token.Gt)
const declarationFirstSet = setOf(Token.Var, Token.Let, Token.Fun, Token.Global, Token.Type, Token.Export)
const expressionFirstSet = setOf(Token.Identifier, Token.LiteralI8, Token.LiteralI16, Token.LiteralI32,
    Token.LiteralI64, Token.LiteralU8, Token.LiteralU16, Token.LiteralU32, Token.LiteralU64, Token.LiteralF32,
    Token.LiteralF64, Token.Null, Token.Memory, Token.True, Token.False, Token.Dash, Token.Plus, Token.If, Token.Amp,
    Token.LBrack, Token.LBrace)
const statementFirstSet = setOf(Token.Var, Token.Let, Token.Loop, Token.Block, Token.Branch, Token.Return )
const bodyElementFirstSet = unionOf(expressionFirstSet, statementFirstSet)