import { Scanner } from "./scanner"
import { Token } from "./tokens"

describe("scanning literals", () => {
    it("can scan integers", () => {
        expect(vscan("1 1t 1s 1l 1u 1ut 1us 1ul")).toEqual([
            { token: Token.LiteralI32, value: 1 },
            { token: Token.LiteralI8, value: 1 },
            { token: Token.LiteralI16, value: 1 },
            { token: Token.LiteralI64, value: 1n },
            { token: Token.LiteralU32, value: 1 },
            { token: Token.LiteralU8, value: 1 },
            { token: Token.LiteralU16, value: 1 },
            { token: Token.LiteralU64, value: 1n }
        ])
        expect(vscan("-1 -1t -1s -1l")).toEqual([
            { token: Token.LiteralI32, value: -1 },
            { token: Token.LiteralI8, value: -1 },
            { token: Token.LiteralI16, value: -1 },
            { token: Token.LiteralI64, value: -1n },
        ])
    })
    it("can scan floating point nubmers", () => {
        expect(vscan("1.0 1.0f 1.0d")).toEqual([
            { token: Token.LiteralF64, value: 1 },
            { token: Token.LiteralF32, value: 1 },
            { token: Token.LiteralF64, value: 1 },
        ])
    })
    it("can scan boolean", () => {
        expect(vscan("true false")).toEqual([
            { token: Token.True, value: true },
            { token: Token.False, value: false },
        ])
    })
    it("can scan a string", () => {
        expect(vscan('"abc" "a\\nb"')).toEqual([
            { token: Token.LiteralString, value: "abc" },
            { token: Token.LiteralString, value: "a\nb" },
        ])
    })
})

describe("scan identifiers", () => {
    it("can scan simple identifiers", () => {
        expect(vscan("a ab _a a_a _")).toEqual([
            { token: Token.Identifier, value: "a"},
            { token: Token.Identifier, value: "ab"},
            { token: Token.Identifier, value: "_a"},
            { token: Token.Identifier, value: "a_a"},
            { token: Token.Identifier, value: "_"},
        ])
    })
    it("can scan a escaped identifier", () => {
        expect(vscan("`$$$ %%% $$$`")).toEqual([
            { token: Token.Identifier, value: "$$$ %%% $$$"}
        ])
    })
    it("can scan reserved words", () => {
        expect(scan("let fun if else break continue return while type val var context import as null infer")).toEqual([
            Token.Let, Token.Fun, Token.If, Token.Else, Token.Break, Token.Continue, Token.Return, Token.While, 
            Token.Type, Token.Val, Token.Var, Token.Context, Token.Import, Token.As, Token.Null, Token.Infer,
        ])
    })
})

describe("scan operators", () => {
    it("can scan operators", () => {
        expect(scan("- . & && | || + * / ; , = == ! != : ^ ~ ( ) { } [ ] % > >= < <=")).toEqual([
            Token.Dash, Token.Dot, Token.Amp, Token.And, Token.Bar, Token.Or, Token.Plus, Token.Star, Token.Slash,
            Token.Semi, Token.Comma, Token.Equal, Token.EqualEqual, Token.Bang, Token.NotEqual, Token.Colon,
            Token.Circumflex, Token.Tilde, Token.LParen, Token.RParen, Token.LBrace, Token.RBrace, Token.LBrack,
            Token.RBrack, Token.Percent, Token.Gt, Token.Gte, Token.Lt, Token.Lte  
        ])
    })
})

function scan(text: string): Token[] {
    const scanner = new Scanner(text)
    const tokens: Token[] = []
    for (let token = scanner.next(); token != Token.EOF; token = scanner.next()) {
        tokens.push(token)
    }
    return tokens
}

function vscan(text: string): {token: Token, value: any}[] {
    const scanner = new Scanner(text)
    const results: {token: Token, value: any}[] = []
    for (let token = scanner.next(), value = scanner.value; token != Token.EOF; token = scanner.next(), value = scanner.value) {
        results.push({ token, value })
    }
    return results
}