import { Token } from "./tokens"

export class Scanner {
    text: string
    start: number = 0
    end: number = 0
    prev: number = 0
    value: any
    message: string = ""

    constructor(text: string) {
        this.text = text + "\0"
    }

    clone(): Scanner {
        const result = new Scanner(this.text)
        result.start = this.start
        result.end = this.end
        result.prev = this.prev
        result.value = this.value
        return result
    }

    next(): Token {
        const text = this.text
        let i = this.end
        this.prev = this.start
        let result = Token.EOF
        this.value = undefined
        loop: while (true) {
            const c = text[i]
            this.start = i++
            switch (c) {
                case "\0":
                    i--
                    break loop
                case " ": case "\t": case "\n": case "\r":
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
                            case "else": result = Token.Else; break
                            case "branch": result = Token.Branch; break
                            case "loop": result = Token.Loop; break
                            case "return": result = Token.Return; break
                            case "type": result = Token.Type; break
                            case "var": result = Token.Var; break
                            case "export": result = Token.Export; break
                            case "import": result = Token.Import; break
                            case "as": result = Token.As; break
                            case "null": result = Token.Null; break
                            case "block": result = Token.Block; break
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
                            result = Token.Int32
                            break
                    }
                    if (result != Token.Int32) break

                    // Intentional fallthrough

                case "0": case "1": case "2": case "3": case "4":
                case "5": case "6": case "7": case "8": case "9": {
                    let isInt = true;
                    while (true) {
                        switch (text[i]) {
                            case ".": case "E": case "e": case "-": case "+":
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
                    let size = Token.Int32
                    let floatSize = Token.Float64
                    const last = i
                    switch (text[i]) {
                        case "u":
                            i++
                            isUnsigned = true
                            break
                    }
                    switch (text[i]) {
                        case "t": i++; size = Token.Int8; break
                        case "s": i++; size = Token.Int16; break
                        case "l": i++; size = Token.Int64; break
                        case "f": i++; isInt = false; floatSize = Token.Float32; break
                        case "d": i++; isInt = false; break
                    }
                    if (isInt) {
                        result = isUnsigned ? size + 4 : size
                        if (size == Token.Int64) {
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
                                case Token.Int8:
                                    if (value >= 0) value = value & 0x7F
                                    else value = -(-value & 0xFF)
                                    break
                                case Token.Int16:
                                    if (value >= 0) value = value & 0x7FFF
                                    else value = -(-value & 0xFFFF)
                                    break
                                case Token.Int32:
                                    if (value > 0x7FFFFFFF || value < -0x80000000) {
                                        result = Token.Error
                                        break loop
                                    }
                                    break
                                case Token.UInt8:
                                    value = value & 0xFF
                                    break
                                case Token.UInt16:
                                    value = value & 0xFFFF
                                    break
                                case Token.UInt32:
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
                case ".":
                    result = Token.Dot
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
                    if (text[i] == "|") {
                        i++
                        result = Token.Or
                    } else {
                        result = Token.Bar
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
                                    case "*":
                                        if (text[i] == "/") {
                                            i++
                                            continue loop
                                        }
                                        break
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
                                    case "\r":
                                        if (text[i] == "\n") i++
                                    case "\n":
                                        continue loop
                                    case "\0":
                                        i--
                                        break loop
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
                case ">":
                    if (text[i] == "=") {
                        i++
                        result = Token.Gte
                    } else {
                        result = Token.Gt
                    }
                    break
                case "<":
                    if (text[i] == "=") {
                        i++
                        result = Token.Lte
                    } else {
                        result = Token.Lt
                    }
                    break
                default:
                    result = Token.Error
                    break
            }
            break
        }

        this.end = i
        return result
    }
}