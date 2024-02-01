import { required } from "../../utils";
import { Block, Function, If, Kind, Node, Statement, When } from "../ast";

export enum VisitKind {
    Enter,
    Leave,
    Leaf,
}

export function visitKindName(kind: VisitKind): string {
    switch (kind) {
        case VisitKind.Enter: return "Enter"
        case VisitKind.Leave: return "Leave"
        case VisitKind.Leaf: return "Leaf"
    }
}

export interface Visit {
    kind: VisitKind
    node: Statement
}

export interface Flow {
    visits: Visit[]
    exits: Set<Flow>
    enters: Set<Flow>
    loop: boolean
}

export function createFlow(func: Function): Flow {
    let continueTarget: Flow | undefined = undefined
    let breakTarget: Flow | undefined = undefined
    let current = newFlow()

    const returnTarget = newFlow()
    const result = current
    flowStatement(func.body)
    flowTo(current, returnTarget)
    return result

    function newFlow(): Flow {
        return { visits: [], enters: new Set(), exits: new Set(), loop: continueTarget != undefined }
    }

    function flowBlock(node: Block) {
        node.statements.forEach(flowStatement)
    }

    function flowStatement(node: Statement) {
        current.visits.push({ kind: VisitKind.Enter, node })
        switch (node.kind) {
            case Kind.Function:
            case Kind.Let:
            case Kind.TypeDeclaration:
            case Kind.Lambda:
            case Kind.Literal:
            case Kind.Reference:
                // Nothing need be done for these
                break
            case Kind.Val:
            case Kind.Var:
                if (node.value) flowStatement(node.value)
                break
            case Kind.Block:
                flowBlock(node)
                break
            case Kind.For: {
                flowStatement(node.target)
                loop(() => flowStatement(node.body))
                break
            }
            case Kind.Break: {
                flowTo(current, required(breakTarget, node))
                break
            }
            case Kind.Continue: {
                flowTo(current, required(continueTarget, node))
                break
            }
            case Kind.Return: {
                flowTo(current, returnTarget)
                break
            }
            case Kind.While:
                loop(() => {
                    flowStatement(node.condition)
                    const rest = newFlow()
                    flowTo(current, rest)
                    flowTo(current, required(breakTarget, node))
                    current = rest
                    flowStatement(node.body)
                })
                break
            case Kind.ArrayLiteral: {
                for (const value of node.values) {
                    flowStatement(value)
                }
                break
            }
            case Kind.Block:
                flowBlock(node)
                break
            case Kind.As:
                flowStatement(node.left)
                break
            case Kind.Assign:
                flowStatement(node.value)
                flowStatement(node.target)
                break
            case Kind.Call:
                node.arguments.forEach(param => flowStatement(param.value))
                flowStatement(node.target)
                break
            case Kind.If:
                ifExpression(node)
                break
            case Kind.Index:
                flowStatement(node.index)
                flowStatement(node.target)
                break
            case Kind.Range:
                if (node.left) flowStatement(node.left)
                if (node.right) flowStatement(node.right)
                break
            case Kind.Select:
                flowStatement(node.target)
                flowStatement(node.name)
                break
            case Kind.StructLiteral:
                node.fields.forEach(field => flowStatement(field.value))
                break
            case Kind.When:
                whenExpression(node)
                break
        }
        const len = current.visits.length
        if (len > 0) {
            const last = current.visits[len - 1]
            if (last.kind == VisitKind.Enter && last.node == node) {
                last.kind = VisitKind.Leaf
                return
            }
        }
        current.visits.push({ kind: VisitKind.Leave, node })
    }

    function loop(cb: () => void) {
        const previousBreakTarget = breakTarget
        const previousContinueTarget = continueTarget

        const loopStart = newFlow()
        loopStart.loop = true
        const loopEnd = newFlow()
        flowTo(current, loopStart)
        current = loopStart

        continueTarget = loopStart
        breakTarget = loopEnd

        cb()

        flowTo(current, loopStart)
        flowTo(current, loopEnd)
        current = loopEnd
        breakTarget = previousBreakTarget
        continueTarget = previousContinueTarget
    }

    function ifExpression(expr: If) {
        flowStatement(expr.condition)
        const thenFlow = newFlow()
        const elseFlow = newFlow()
        const rest = newFlow()
        flowTo(current, thenFlow)
        flowTo(current, elseFlow)
        current = thenFlow
        flowStatement(expr.then)
        flowTo(current, rest)
        current = elseFlow
        flowStatement(expr.else)
        flowTo(current, rest)
        current = rest
    }

    function whenExpression(expr: When) {
        if (expr.target) flowStatement(expr.target)
        const start = current
        let lastExpr = start
        let hasElse = false
        const rest = newFlow()
        for (const clause of expr.clauses) {
            const clauseFlow = newFlow()
            const condition = clause.condition
            switch (condition.kind) {
                case Kind.IsCondition:
                    break
                case Kind.ElseCondition:
                    flowTo(lastExpr, clauseFlow)
                    hasElse = true
                    break
                default:
                    const conditionFlow = newFlow()
                    flowTo(lastExpr, conditionFlow)
                    current = conditionFlow
                    flowStatement(condition)
                    flowTo(current, clauseFlow)
                    lastExpr = current
                    break
            }
            current = clauseFlow
            flowStatement(clause.body)
            flowTo(current, rest)
        }
        if (!hasElse) {
            flowTo(lastExpr, rest)
        }
        current = rest
    }

    function flowTo(from: Flow, to: Flow) {
        to.enters.add(from)
        from.exits.add(to)
    }

}