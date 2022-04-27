import { BitXor, Block, BodyElement, copy, Declaration, Expression, IfThenElse, Last, LastKind, LiteralI32, LiteralI64, Module, PrimitiveKind, Reference } from "../last";
import { ConvertContext, Converter } from "./import";

export class ExtensionConverter implements Converter {
    private tmpVar = 0

    private breaks = empty
    private continues = empty

    private additional: Declaration[] = []

    enter(node: any) {
        if (node && node.kind == LastKind.Function) {
            this.breaks = empty
            this.continues = empty
        }
    }

    finish(node: Module): Module {
        if (this.additional.length > 0) {
            node.declarations.push(...this.additional)
        }
        return node
    }

    convert = {
        For: this.For.bind(this),
        While: this.While.bind(this),
        Break: this.Break.bind(this),
        Continue: this.Continue.bind(this),
        String: this.String.bind(this),
        BitInvert: this.BitInvert.bind(this),
    }

    While(node: any, context: ConvertContext): Last {
        return this.break((breakName) => {
            return this.continue((continueName) => {
                const block: Block = {
                    kind: LastKind.Block,
                    name: ref(breakName),
                    body: [
                        {
                            kind: LastKind.Loop,
                            name: ref(continueName),
                            body: [
                                ifStmt(
                                    context,
                                    node.condition,
                                    [
                                        ...node.body,
                                        {
                                            kind: LastKind.Branch,
                                            name: ref(continueName)
                                        }
                                    ]
                                )
                            ]
                        }
                    ]
                }
                return block
            })
        })
    }

    For(node: any, context: ConvertContext): Last {
        return this.break((breakName) => {
            return this.continue((continueName) => {
                const body: BodyElement[] = []
                if (node.init) {
                    body.push(context.convertNode(node.init) as BodyElement)
                }
                const loopBody: BodyElement[] = []
                if (node.condition) {
                    loopBody.push(
                        ifStmt(
                            context,
                            node.condition,
                            node.body,
                            [ { kind: LastKind.Branch, target: ref(breakName) }]
                        )
                    )
                } else {
                    loopBody.push(...node.body)
                }
                if (node.step) {
                    loopBody.push(context.convertNode(node.step) as BodyElement)
                }
                loopBody.push({
                    kind: LastKind.Branch,
                    target: ref(continueName)
                })
                body.push({
                    kind: LastKind.Loop,
                    name: ref(continueName),
                    body: loopBody
                })
                const block: Block = {
                    kind: LastKind.Block,
                    name: ref(breakName),
                    body
                }
                return block
            })
        })
    }

    Break(_node: any, _context: ConvertContext): Last {
        return {
            kind: LastKind.Branch,
            target: { kind: LastKind.Reference, name: this.breaks.top() }
        }
    }

    Continue(_node: any, _context: ConvertContext): Last {
        return {
            kind: LastKind.Branch,
            target: { kind: LastKind.Reference, name: this.continues.top() }
        }
    }

    String(node: any, _context: ConvertContext): Last {
        const buffer = new TextEncoder().encode(node.value + "\0")
        const name = this.unique()
        this.additional.push({
            kind: LastKind.Var,
            name: ref(name),
            value: {
                kind: LastKind.ArrayLiteral,
                values: buffer
            }
        })
        return {
            kind: LastKind.AddressOf,
            target: ref(name)
        }
    }

    BitInvert(node: any, context: ConvertContext): Last {
        const target = context.convertNode(node.target)
        return {
            kind: LastKind.BitXor,
            left: target,
            right: lit64(-1)
        } as BitXor
    }

    private unique(): string {
        return `$$tmp${this.tmpVar++}`
    }

    private break<R>(block: (name: string) => R): R {
        const previous = this.breaks
        const name = this.unique()
        this.breaks = new JumpScope(name, previous)
        const result = block(name)
        this.breaks = previous
        return result
    }

    private continue<R>(block: (name: string) => R): R {
        const previous = this.continues
        const name = this.unique()
        this.continues = new JumpScope(name, previous)
        const result = block(name)
        this.continues = previous
        return result
    }
}

function ifStmt(context: ConvertContext, condition: any, thn: any[], els?: any[]): IfThenElse {
    return {
        kind: LastKind.IfThenElse,
        condition: context.convertNode(condition) as Expression,
        then: context.convertArray(thn) as BodyElement[],
        else: els ? context.convertArray(els) as BodyElement[] : []
    }
}

function ref(name: string): Reference {
    return { kind: LastKind.Reference, name }
}

function lit32(value: number): LiteralI32 {
    return { kind: LastKind.Literal, primitiveKind: PrimitiveKind.I32, value }
}

function lit64(value: number): LiteralI64 {
    return { kind: LastKind.Literal, primitiveKind: PrimitiveKind.I64, value: BigInt(value) }
}

class JumpScope {
    private name: string
    private parent: JumpScope | undefined;
    constructor(name: string, parent?: JumpScope) {
        this.name = name
        this.parent = parent
    }

    top(): string {
        return this.name
    }

    contains(name: string): boolean {
        return name == this.name || this.parent?.contains(name) == true
    }
}

const empty = new JumpScope("$$empty");

