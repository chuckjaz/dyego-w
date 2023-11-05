export const enum Token {
    Identifier,
    LiteralI8,
    LiteralI16,
    LiteralI32,
    LiteralI64,
    LiteralU8,
    LiteralU16,
    LiteralU32,
    LiteralU64,
    LiteralF32,
    LiteralF64,
    LiteralString,
    LiteralChar,
    Let,
    Val,
    Var,
    Context,
    Infer,
    Type,
    Fun,
    True,
    False,
    If,
    Else,
    Import,
    As,
    Null,
    Break,
    Continue,
    Return,
    While,
    Dot,
    Dash,
    Plus,
    Star,
    Slash,
    Percent,
    Semi,
    Comma,
    Equal,
    Colon,
    Bang,
    Circumflex,
    Tilde,
    And,
    Amp,
    Bar,
    Or,
    Gt,
    Gte,
    Lt,
    Lte,
    EqualEqual,
    NotEqual,
    Arrow,
    LParen,
    RParen,
    LBrace,
    RBrace,
    LBrack,
    RBrack,
    Error,
    EOF
}

export function toString(token: Token): string {
    switch (token) {
        case Token.Identifier: return "Identifier"
        case Token.LiteralI8: return "LiteralI8"
        case Token.LiteralI16: return "LiteralI16"
        case Token.LiteralI32: return "LiteralI32"
        case Token.LiteralI64: return "LiteralI64"
        case Token.LiteralU8: return "LiteralU8"
        case Token.LiteralU16: return "LiteralU16"
        case Token.LiteralU32: return "LiteralU32"
        case Token.LiteralU64: return "LiteralU64"
        case Token.LiteralF32: return "LiteralF32"
        case Token.LiteralF64: return "LiteralF64"
        case Token.LiteralString: return "LiteralString"
        case Token.LiteralChar: return "LiteralChar"
        case Token.Let: return "Let"
        case Token.Val: return "Val"
        case Token.Var: return "Var"
        case Token.Context: return "Context"
        case Token.Infer: return "Infer"
        case Token.Type: return "Type"
        case Token.Fun: return "Fun"
        case Token.True: return "True"
        case Token.False: return "False"
        case Token.If: return "If"
        case Token.Else: return "Else"
        case Token.Import: return "Import"
        case Token.As: return "As"
        case Token.Null: return "Null"
        case Token.Break: return "Break"
        case Token.Continue: return "Continue"
        case Token.Return: return "Return"
        case Token.While: return "While"
        case Token.Dot: return "Dot"
        case Token.Dash: return "Dash"
        case Token.Plus: return "Plus"
        case Token.Star: return "Star"
        case Token.Slash: return "Slash"
        case Token.Percent: return "Percent"
        case Token.Semi: return "Semi"
        case Token.Comma: return "Comma"
        case Token.Equal: return "Equal"
        case Token.Colon: return "Colon"
        case Token.Bang: return "Bang"
        case Token.Circumflex: return "Circumflex"
        case Token.Tilde: return "Tilde"
        case Token.And: return "And"
        case Token.Amp: return "Amp"
        case Token.Bar: return "Bar"
        case Token.Or: return "Or"
        case Token.Gt: return "Gt"
        case Token.Gte: return "Gte"
        case Token.Lt: return "Lt"
        case Token.Lte: return "Lte"
        case Token.EqualEqual: return "EqualEqual"
        case Token.NotEqual: return "NotEqual"
        case Token.Arrow: return "Arrow"
        case Token.LParen: return "LParen"
        case Token.RParen: return "RParen"
        case Token.LBrace: return "LBrace"
        case Token.RBrace: return "RBrace"
        case Token.LBrack: return "LBrack"
        case Token.RBrack: return "RBrack"
        case Token.Error: return "Error"
        case Token.EOF: return "EOF"
    }
}