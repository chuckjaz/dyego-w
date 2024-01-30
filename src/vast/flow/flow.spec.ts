import { Function, Kind, Module, Node, Statement, kindName } from "../ast"
import { parse } from "../parser/parser"
import { Scanner } from "../parser/scanner"
import { Flow, Visit, VisitKind, flow, visitKindName } from "./flow"

import * as fs from "fs"

describe("flow", () => {
    it("can flow a simple function", () => {
        fl("fun a(): i32 { 1 }")
    })
    it("can flow calls", () => {
        fl(`
            fun a(p: i32[]): i32 {
                b(p)
                b(p)
                b(p)
            }
        `)
    } )
    it("can flow an if statement", () => {
        fl(`
            fun a(b: bool): i32 {
                if (b) { c } else { d }
            }
        `)
    })
    it("can flow a for statement", () => {
        fl(`
            fun a(items: i32[]): i32 {
                for (item in items) {
                    c(item)
                }
            }
        `)
    })
    it("can flow a for statement with continue", () => {
        fl(`
            fun a(items: i32[]): i32 {
                for (item in items) {
                    c(item)
                    if (item) {
                        continue
                    }
                    c(item)
                }
            }
        `)
    })
    it("can flow a while", () => {
        fl(`
            fun a(count: i32): i32 {
                var i = 0
                while (i < count) {
                    b()
                    c()
                    i = i + 1
                }
            }

        `)
    })
    it("can flow a while with a break", () => {
        fl(`
            fun a(count: i32): i32 {
                var i = 0
                while (i < count) {
                    if (count > 10) {
                        break
                    }
                    b()
                }
            }
        `)
    })
    it("can flow a while with a continue", () => {
        fl(`
            fun a(count: i32): i32 {
                var i = 0
                while (i < count) {
                    if (count > 10) {
                        continue
                    }
                    b()
                }
            }
        `)
    })
    it("can flow a when expression", () => {
        fl(`
            fun a(p: i32): i32 {
                when(a) {
                    1 -> 2
                    2 -> 3
                    3 -> 4
                    else -> 5
                }
            }
        `)
    })
    describe("examples", () => {
        it("can flow sum.vast.dg", () => {
            flowExample("sum.vast.dg")
        })
        it("can flow atoi.vast.dg", () => {
            flowExample("atoi.vast.dg")
        })
        it("can flow binary-tree.vast.dg", () => {
            flowExample("binary-tree.vast.dg")
        })
    })
})


function m(text: string): Module {
    const scanner = new Scanner(text)
    const { module, diagnostics } = parse(scanner)
    expect(diagnostics).toEqual([])
    return module
}

function func(text: string): Function {
    const module = m(text)
    expect(module.declarations.length).toBe(1)
    const result = module.declarations[0]
    expect(result.kind).toBe(Kind.Function)
    return result as Function
}

function fl(text: string): Flow {
    const f = func(text)
    const result = flow(f)
    validate(f.body, result)
    return result
}

function dfl(text: string): Flow {
    const f = func(text)
    const result = flow(f)
    console.log(dump(result, text))
    validate(f.body, result)
    return result
}

function flowExample(name: string) {
    const text = fs.readFileSync(`src/vast/examples/vast/${name}`, 'utf-8')
    const module = m(text)
    for (const declaration of module.declarations) {
        if (declaration.kind == Kind.Function) {
            const result = flow(declaration)
            validate(declaration.body, result)
        }
    }
}

function validate(node: Statement, nodeFlow: Flow) {
    const nodes = new Set<Node>()
    const visited = new Set<Node>()
    const flows = new Set<Flow>()
    traverse(node, item => nodes.add(item))
    validateFlow(nodeFlow)
    nodes.forEach(n => {
        if (!visited.has(n)) {
            nerr("Node was not visited", n)
        }
    })

    function validateFlow(flow: Flow) {
        if (flows.has(flow)) return
        flows.add(flow)
        for (const visit of flow.visits) {
            if (visit.kind == VisitKind.Enter || visit.kind == VisitKind.Leaf) {
                if (visited.has(visit.node)) {
                    nerr("Node visited twice", node)
                }
                visited.add(visit.node)
            }
        }
        flow.exits.forEach(child => {
            if (!child.enters.has(flow)) {
                ferr("exit does not have an enter from one of its flows")
            }
        })
        flow.enters.forEach(child => {
            if (!child.exits.has(flow)) {
                ferr("enter does not have an exit from one of its flows")
            }
        })
        flow.exits.forEach(validateFlow)
        if ((flow.enters.size == 0) != (flow == nodeFlow)) {
            ferr("flow with no enters that is not the first one")
        }
    }

    function nerr(msg: string, node: Node) {
        throw Error(`${msg}: ${node.start}, ${kindName(node.kind)}`)
    }

    function ferr(msg: string) {
        throw Error(`flow #${flows.size} ${msg}`)
    }
}

function dump(flow: Flow, text: string = ""): string {
    let result = ""
    let numberOfFlow = new Map<Flow, number>()
    let emitted = new Set<Flow>()
    println()
    const collected = new Set<Flow>()
    const flows: Flow[] = []
    collect(flow)
    flows.sort((a, b) => startOf(a) - startOf(b))
    flows.forEach(numberOf)
    flows.forEach(dumpFlow)
    return result

    function startOf(flow: Flow): number {
        if (flow.visits.length > 0) {
            const visit = flow.visits[0]
            switch (visit.kind) {
                case VisitKind.Enter:
                case VisitKind.Leaf:
                    return visit.node.start ?? text.length
                case VisitKind.Leave:
                    return visit.node.end ?? visit.node.start ?? text.length
            }
        }
        return text.length
    }

    function collect(flow: Flow) {
        if (collected.has(flow)) return
        flows.push(flow)
        collected.add(flow)
        flow.enters.forEach(collect)
        flow.exits.forEach(collect)
    }

    function dumpFlow(flow: Flow) {
        if (emitted.has(flow)) return
        emitted.add(flow)
        println(`Flow #${numberOf(flow)}`)
        println("--------")
        dumpFlowNumbers("Enters", flow.enters)
        dumpVisits(flow.visits)
        dumpFlowNumbers("Exits", flow.exits)
        println()
    }

    function numberOf(flow: Flow): number {
        let result = numberOfFlow.get(flow)
        if (result === undefined) {
            result = numberOfFlow.size + 1
            numberOfFlow.set(flow, result)
        }
        return result
    }

    function dumpFlowNumbers(name: string, flows: Set<Flow>) {
        print(`${name}: `)
        let first = true
        flows.forEach(flow => {
            if (!first) print(", ")
            print(`${numberOf(flow)}`)
            first = false
        })
        println()
    }

    function dumpVisits(visits: Visit[]) {
        for (const visit of visits) {
            print(visitKindName(visit.kind))
            print(": ")
            const node = visit.node
            const start = node.start
            print(`${kindName(node.kind)}(${start})`)
            if (start) {
                print(" ")
                let nl = text.indexOf("\n", start)
                let e = node.end ?? nl
                let e2 = e > nl ? nl : e
                let end = e2 > (node.start ?? 0) ? e2 : text.length
                print(text.substring(start, end))
            }
            println()
        }
    }

    function print(msg: string) {
        result += msg
    }

    function println(msg: string = "") {
        print(msg)
        print("\n")
    }
}

function traverse(node: Statement, cb: (node: Node) => void) {
    cb(node)
    switch (node.kind) {
        case Kind.Function:
        case Kind.TypeDeclaration:
        case Kind.Let:
        case Kind.Lambda:
        case Kind.Literal:
        case Kind.Reference:
        case Kind.Break:
        case Kind.Continue:
            break
        case Kind.Val:
            traverse(node.value, cb)
            break
        case Kind.Var:
            if (node.value) traverse(node.value, cb)
            break
        case Kind.ArrayLiteral:
            node.values.forEach(value => traverse(value, cb))
            break
        case Kind.As:
            traverse(node.left, cb)
            break
        case Kind.Assign:
            traverse(node.value, cb)
            traverse(node.target, cb)
            break
        case Kind.Block:
            node.statements.forEach(node => traverse(node, cb))
            break
        case Kind.Call:
            node.arguments.forEach(arg => traverse(arg.value, cb))
            break
        case Kind.If:
            traverse(node.condition, cb)
            traverse(node.then, cb)
            traverse(node.else, cb)
            break
        case Kind.Index:
            traverse(node.index, cb)
            traverse(node.target, cb)
            break
        case Kind.Range:
            if (node.left) traverse(node.left, cb)
            if (node.right) traverse(node.right, cb)
            break
        case Kind.Select:
            traverse(node.target, cb)
            break
        case Kind.StructLiteral:
            node.fields.forEach(field => traverse(field.value, cb))
            break
        case Kind.When:
            if (node.target) traverse(node.target, cb)
            node.clauses.forEach(clause => {
                const condition = clause.condition
                switch (condition.kind) {
                    case Kind.IsCondition:
                    case Kind.ElseCondition:
                        break
                    default:
                        traverse(condition, cb)
                        break
                }
                traverse(clause.body, cb)
            })
            break
        case Kind.For:
            traverse(node.target, cb)
            traverse(node.body, cb)
            break
        case Kind.Return:
            if (node.value) traverse(node.value, cb)
            break
        case Kind.While:
            traverse(node.condition, cb)
            traverse(node.body, cb)
            break
    }
}