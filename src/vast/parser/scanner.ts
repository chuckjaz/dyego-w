import { Token } from "./tokens"

export interface PositionBuilder {
    addLine(offset: number): void
    pos(offset: number): number
}

export class Scanner {
    text: string
    start: number = 0
    end: number = 0
    prev: number = 0
    nl: boolean = false
    value: any
    message: string = ""
    builder: PositionBuilder | undefined

    constructor(text: string, builder?: PositionBuilder) {
        this.text = text
        this.builder = builder
    }

    clone(): Scanner {
        const result = new Scanner(this.text)
        result.start = this.start
        result.end = this.end
        result.prev = this.prev
        result.value = this.value
        result.nl = this.nl
        result.builder = this.builder
        return result
    }

    next(): Token {
        const text = this.text
        let i = this.end
        this.prev = this.start
        let result = Token.EOF
        this.value = undefined
        this.nl = false
        loop: while (true) {
            const c = text[i]
            this.start = i++
            switch (c) {
                case undefined:
                case "\0":
                    i--
                    break loop
                case " ": case "\t":
                    continue
                case "\r":
                    if (text[i] == "\n") i++
                    // fallthrough
                case "\n":
                    this.builder?.addLine(i)
                    this.nl = true
                    continue
                case "A": case "B": case "C": case "D": case "E":
                case "F": case "G": case "H": case "I": case "J":
                case "K": case "L": case "M": case "N": case "O":
                case "P": case "Q": case "R": case "S": case "T":
                case "U": case "V": case "W": case "X": case "Y":
                case "Z":
                case "a": case "b": case "c": case "d": case "e":
                case "f": case "g": case "h": case "i": case "j":
                case "k": case "l": case "m": case "n": case "o":
                case "p": case "q": case "r": case "s": case "t":
                case "u": case "v": case "w": case "x": case "y":
                case "z": case "_": {
                    while (true) {
                        switch (text[i]) {
                            case "A": case "B": case "C": case "D": case "E":
                            case "F": case "G": case "H": case "I": case "J":
                            case "K": case "L": case "M": case "N": case "O":
                            case "P": case "Q": case "R": case "S": case "T":
                            case "U": case "V": case "W": case "X": case "Y":
                            case "Z":
                            case "a": case "b": case "c": case "d": case "e":
                            case "f": case "g": case "h": case "i": case "j":
                            case "k": case "l": case "m": case "n": case "o":
                            case "p": case "q": case "r": case "s": case "t":
                            case "u": case "v": case "w": case "x": case "y":
                            case "z": case "_":
                            case "0": case "1": case "2": case "3": case "4":
                            case "5": case "6": case "7": case "8": case "9":
                                i++
                                continue
                        }
                        result = Token.Identifier
                        const ident = text.substring(this.start, i)
                        this.value = ident
                        switch (ident) {
                            case "let": result = Token.Let; break
                            case "fun": result = Token.Fun; break
                            case "true":
                                result = Token.True
                                this.value = true
                                break
                            case "false":
                                result = Token.False
                                this.value = false
                                break
                            case "if": result = Token.If; break
                            case "in": result = Token.In; break
                            case "is": result = Token.Is; break
                            case "else": result = Token.Else; break
                            case "for": result = Token.For; break
                            case "break": result = Token.Break; break
                            case "continue": result = Token.Continue; break
                            case "return": result = Token.Return; break
                            case "when": result = Token.When; break
                            case "while": result = Token.While; break
                            case "type": result = Token.Type; break
                            case "val": result = Token.Val; break
                            case "var": result = Token.Var; break
                            case "context": result = Token.Context; break
                            case "import": result = Token.Import; break
                            case "as": result = Token.As; break
                            case "null": result = Token.Null; break
                            case "infer": result = Token.Infer; break
                        }
                        break
                    }
                    break
                }
                case "-":
                    result = Token.Dash
                    switch (text[i]) {
                        case ">":
                            i++
                            result = Token.Arrow
                            break
                        case "0": case "1": case "2": case "3": case "4":
                        case "5": case "6": case "7": case "8": case "9":
                            result = Token.LiteralI32
                            break
                    }
                    if (result != Token.LiteralI32) break

                    // Intentional fallthrough

                case "0": case "1": case "2": case "3": case "4":
                case "5": case "6": case "7": case "8": case "9": {
                    let isInt = true;
                    while (true) {
                        switch (text[i]) {
                            case ".":
                                if (text[i + 1] == ".") {
                                    break
                                }
                                // fallthrough
                            case "E": case "e": case "-": case "+":
                                isInt = false;
                                // fallthrough
                            case "0": case "1": case "2": case "3": case "4":
                            case "5": case "6": case "7": case "8": case "9":
                                i++
                                continue
                        }
                        break
                    }
                    let isUnsigned = false
                    let size = Token.LiteralI32
                    let floatSize = Token.LiteralF64
                    const last = i
                    switch (text[i]) {
                        case "u":
                            i++
                            isUnsigned = true
                            break
                    }
                    switch (text[i]) {
                        case "t": i++; size = Token.LiteralI8; break
                        case "s": i++; size = Token.LiteralI16; break
                        case "l": i++; size = Token.LiteralI64; break
                        case "f": i++; isInt = false; floatSize = Token.LiteralF32; break
                        case "d": i++; isInt = false; break
                    }
                    if (isInt) {
                        result = isUnsigned ? size + 4 : size
                        if (size == Token.LiteralI64) {
                            this.value = BigInt(text.substring(this.start, last))
                            if (isUnsigned && this.value < 0n) {
                                this.message = "Unsigned values cannot be negative"
                                result = Token.Error
                                break loop
                            }
                        } else {
                            let value = parseInt(text.substring(this.start, last))
                            if (isUnsigned && value < 0) {
                                this.message = "Unsigned values cannot be negative"
                                result = Token.Error
                                break loop
                            }
                            const originalValue = value
                            switch (result) {
                                case Token.LiteralI8:
                                    if (value >= 0) value = value & 0x7F
                                    else value = -(-value & 0xFF)
                                    break
                                case Token.LiteralI16:
                                    if (value >= 0) value = value & 0x7FFF
                                    else value = -(-value & 0xFFFF)
                                    break
                                case Token.LiteralI32:
                                    if (value > 0x7FFFFFFF || value < -0x80000000) {
                                        result = Token.Error
                                        break loop
                                    }
                                    break
                                case Token.LiteralU8:
                                    value = value & 0xFF
                                    break
                                case Token.LiteralU16:
                                    value = value & 0xFFFF
                                    break
                                case Token.LiteralU32:
                                    if (value < 0 || value > 0xFFFFFFFF) {
                                        result = Token.Error
                                        break loop
                                    }
                                    break
                            }
                            if (value != originalValue) {
                                this.message = "Literal out of range"
                                result = Token.Error
                            }
                            this.value = value
                        }
                    } else {
                        result = floatSize
                        this.value = parseFloat(text.substring(this.start, last))
                        if (isUnsigned) {
                            this.message = "Floating point values cannot be unsigned"
                            result = Token.Error
                            break loop
                        }
                    }
                    break
                }
                case "`": {
                    result = Token.Identifier
                    while (true) {
                        switch (text[i]) {
                            case "\n":
                            case "\r":
                                this.message = "Unterminated indentifier"
                                result = Token.Error
                                break loop
                            case "`":
                                i++
                                break
                            case undefined:
                            case "\0":
                                i--
                                result = Token.Error
                                break
                            default:
                                i++
                                continue
                        }

                        break
                    }
                    this.value = text.substring(this.start + 1, i - 1)
                    break
                }
                case "'":
                    result = Token.LiteralChar
                    let ch = text[i++]
                    switch (ch) {
                        case undefined:
                            result = Token.Error
                            this.message = "Unterminated char"
                            break loop
                        case '\\': {
                            switch (text[i++]) {
                                case 'n': this.value = "\n"; break
                                case 'r': this.value = "\r"; break
                                case 'b': this.value = "\b"; break
                                case 't': this.value = "\t"; break
                                case undefined:
                                case `\0`:
                                    result = Token.Error
                                    this.message = "Unterminated char"
                                    break loop
                                default:
                                    result = Token.Error
                                    this.message = "Invalid escape character"
                                    break
                            }
                        }
                        default:
                            this.value = ch
                            break
                    }
                    if (text[i++] != "'") {
                        i--
                        result = Token.Error
                        this.message = "Unterniated char"
                    }
                    break
                case '"': {
                    result = Token.LiteralString
                    let startPos = i
                    let prefix = ""
                    function shift() {
                        prefix += text.substring(startPos, i - 1)
                        startPos = i
                    }
                    while (true) {
                        switch (text[i++]) {
                            case '"':
                                shift()
                                this.value = prefix
                                i++
                                break loop
                            case undefined:
                            case '\0':
                            case '\n':
                                result = Token.Error
                                this.message = "Unterminated string"
                                break loop
                            case '\\':
                                shift()
                                switch (text[i++]) {
                                    case 'n': prefix += "\n"; break
                                    case 'r': prefix += "\r"; break
                                    case 'b': prefix += "\b"; break
                                    case 't': prefix += "\t"; break
                                    case undefined:
                                    case `\0`:
                                        i--
                                    default:
                                        this.message = "Invalidate character"
                                        break loop
                                }
                                startPos = i
                            }
                        }
                    }
                case ".":
                    result = Token.Dot
                    if (text[i] == ".") {
                        i++
                        result = Token.DotDot
                        if (text[i] == ".") {
                            i++
                            result = Token.Splat
                        }
                    }
                    break
                case "&":
                    if (text[i] == "&") {
                        i++
                        result = Token.And
                    } else {
                        result = Token.Amp
                    }
                    break
                case "|":
                    result = Token.Bar
                    switch (text[i]) {
                        case "|":
                            i++
                            result = Token.Or
                            break
                    }
                    break
                case "+":
                    result = Token.Plus
                    break
                case "*":
                    result = Token.Star
                    break
                case "/":
                    switch (text[i]) {
                        case "*":  {
                            i++
                            while(true) {
                                switch (text[i++]) {
                                    case "\r":
                                        if (text[i] == "\n") i++
                                        // fallthrough
                                    case "\n":
                                        this.builder?.addLine(i)
                                        continue
                                    case "*":
                                        if (text[i] == "/") {
                                            i++
                                            continue loop
                                        }
                                        break
                                    case undefined:
                                    case "\0":
                                        i--
                                        this.message = "Unterminated comment"
                                        result = Token.Error
                                        break loop
                                }
                            }
                        }
                        case "/": {
                            i++
                            while(true) {
                                switch(text[i++]) {
                                    case "\r": case "\n": case "\0":
                                        i--
                                        continue loop
                                }
                            }
                        }
                    }
                    result = Token.Slash
                    break
                case ";":
                    result = Token.Semi
                    break
                case ",":
                    result = Token.Comma
                    break
                case "=":
                    if (text[i] == "=") {
                        i++
                        result = Token.EqualEqual
                    } else {
                        result = Token.Equal
                    }
                    break
                case ":":
                    result = Token.Colon
                    break
                case "!":
                    if (text[i] == "=") {
                        i++
                        result = Token.NotEqual
                    } else {
                        result = Token.Bang
                    }
                    break
                case "^":
                    result = Token.Circumflex
                    break
                case "~":
                    result = Token.Tilde
                    break
                case "(":
                    result = Token.LParen
                    break
                case ")":
                    result = Token.RParen
                    break
                case "{":
                    result = Token.LBrace
                    break
                case "}":
                    result = Token.RBrace
                    break
                case "[":
                    result = Token.LBrack
                    break
                case "]":
                    result = Token.RBrack
                    break
                case "%":
                    result = Token.Percent
                    break
                case ">":
                    if (text[i] == "=") {
                        i++
                        result = Token.Gte
                    } else {
                        result = Token.Gt
                    }
                    break
                case "<":
                    result = Token.Lt
                    switch (text[i]) {
                        case "=":
                            i++
                            result = Token.Lte
                            break
                    }
                    break
                default:
                    this.message = `Unrecognized character "${text[i-1]}"`
                    result = Token.Error
                    break
            }
            break
        }

        this.end = i
        return result
    }
}
