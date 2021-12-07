import { Token } from "./tokens"

export class Scanner {
    text: string
    start: number = 0
    end: number = 0
    value: any

    constructor(text: string) {
        this.text = text + "\0"
    }

    clone(): Scanner {
        const result = new Scanner(this.text)
        result.start = this.start
        result.end = this.end
        result.value = this.value
        return result
    }

    next(): Token {
        const text = this.text
        let i = this.end
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
                            case "when": result = Token.When; break
                            case "if": result = Token.If; break
                            case "else": result = Token.Else; break
                            case "break": result = Token.Break; break
                            case "continue": result = Token.Continue; break
                            case "while": result = Token.While; break
                            case "loop": result = Token.Loop; break
                            case "return": result = Token.Return; break
                            case "type": result = Token.Type; break
                            case "var": result = Token.Var; break
                            case "export": result = Token.Export; break
                        }
                        break
                    }
                    break
                }
                case "0": case "1": case "2": case "3": case "4":
                case "5": case "6": case "7": case "8": case "9": {
                    let isInt = false;
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
                    if (isInt) {
                        result = Token.Int
                        this.value = parseInt(text.substring(this.start, i))
                    } else {
                        result = Token.Double
                        this.value = parseFloat(text.substring(this.start, i))
                    }
                    break                
                }
                case ".":
                    if (text[i] == "." && text[i+1] == ".") {
                        i += 2
                        result = Token.Spread
                        break
                    }
                    result = Token.Dot
                    break
                case "&":
                    if (text[i] == "&") {
                        i++
                        result = Token.And
                    } else {
                        result = Token.Error
                    }
                    break
                case "|":
                    if (text[i] == "|") {
                        i++
                        result = Token.Or
                    } else {
                        result = Token.Error
                    }
                    break
                case "+":
                    result = Token.Plus
                    break
                case "-":
                    if (text[i] == ">") {
                        i++
                        result = Token.Arrow
                    } else {
                        result = Token.Dash
                    }
                    break
                case "*":
                    result = Token.Star
                    break
                case "/":
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