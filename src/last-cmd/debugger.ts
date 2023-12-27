import { FileSet, Position } from "../files";
import { LastKind, Function, Type, typeToString, Declaration, TypeKind } from "../last";
import { CompileResult } from "./compile";
import { produceConsoleModule } from "./console-module";
import { readLine } from "./readline";
import { padding } from "./util";

export function debug(
    result: CompileResult,
    fileSet: FileSet,
    hostName: string,
    args: string[]
): number {
    try {
        const metadata = new Metadata(result)
        const dbgr = new Debugger(fileSet, metadata)
        const mod = new WebAssembly.Module(result.module)
        let memory: WebAssembly.Memory
        const inst = new WebAssembly.Instance(mod,  {
            'debug-host': {
                functionStart: dbgr.functionStart.bind(dbgr),
                functionEnd: dbgr.functionEnd.bind(dbgr),
                statement: dbgr.statement.bind(dbgr)
            },
            'console': produceConsoleModule(() => memory)
        });
        memory = inst.exports.mem as WebAssembly.Memory
        const host = require(hostName)
        return host.main(inst.exports, args)
    } catch(e: any) {
        console.log(e.stack)
        return 1
    }
}

const enum Instruction {
    Continue
}

const enum State {
    StepInto,
    StepOver,
    StepOut,
    Running,
    Stopped,
}

class Debugger {
    private fileSet: FileSet
    private stack: Stack
    private breakPoints: boolean[] = []
    private commands = new Map<string, Command>()
    private commandDefs: Command[] = []
    private state: Iterator<Instruction, any, number>
    private stepOverDepth: number = 0
    constructor(fileSet: FileSet, metadata: Metadata) {
        this.fileSet = fileSet
        this.stack = new Stack(fileSet, metadata)
        this.defineCommands()
        this.state = this.debug()
        this.state.next(0)
    }

    functionStart(loc: number) {
        this.stack.push(loc)
    }

    functionEnd(loc: number) {
        this.stack.pop()
    }

    statement(loc: number) {
        this.stack.update(loc)
        this.state.next(loc)
    }

    *debug(): Iterator<Instruction, any, number> {
        let state: State = State.StepInto
        let location = 0

        main: while (true) {
            location = state == State.Stopped ? location : yield Instruction.Continue
            switch (state) {
                case State.StepInto:
                    state = State.Stopped;
                    break
                case State.StepOver: {
                    if (this.stack.depth == this.stepOverDepth) {
                        state = State.Stopped
                        break
                    }
                    continue main
                }
                case State.StepOut: {
                    if (this.stack.depth < this.stepOverDepth) {
                        state = State.Stopped
                        break
                    }
                    continue main
                }
                case State.Running:
                    if (this.breakPoints[location] === true) {
                        state = State.Stopped
                        break
                    }
                    continue main
                case State.Stopped: break
            }
            state = this.expectCommand(location)
        }
    }

    private lastCommand: string | undefined

    private expectCommand(location: number): State {
        this.showPosition(location)
        process.stdout.write("> ")
        let line = readLine()
        if (line === undefined) process.exit(0)
        if (line == "" && this.lastCommand !== undefined) {
            line = this.lastCommand
        }
        this.lastCommand = line
        const [cmdName, ...args] = line.split(" ")
        const cmd = this.commands.get(cmdName)
        if (cmd !== undefined) {
            return cmd.execute(...args)
        } else {
            console.log(`Unknown command: ${cmdName}. Use "help" for a list of commands`)
            return State.Stopped
        }
    }

    private showPosition(location: number) {
        let pos: Position | undefined = undefined
        let lineText: string | undefined = undefined
        let loc = { start: location }
        const file = this.fileSet.file(loc)
        if (file !== undefined) {
            pos = file.position(loc)
            lineText = file.lineText(pos.line, pos.line + 1)
        }
        if (pos && lineText) {
            console.log(`\n${pos.display()}\n${lineText}`)
        } else {
            console.log(`\n[${pos?.display() ?? `<unknown: ${location}>`}]`)
        }
    }

    private defineCommands() {
        this.command("step", () => {
            this.stepOverDepth = this.stack.depth
            return State.StepOver
        }, "Step over the next statement", "s")
        this.command("next", () => State.StepInto, "Step into the next statement", "n")
        this.command("out", () => {
            this.stepOverDepth = this.stack.depth
            return State.StepOut
        }, "Step out of the current function", "o")
        this.command("run", () => State.Running, "Run the program to completion or next break", "r")
        this.command("quit", () => process.exit(0), "Terminate the process", "q")
        this.command("trace", () => {
            this.stack.print()
            return State.Stopped
        }, "Print the stack", "bt")
        this.command("help", () => {
            let width = 0
            const names: string[] = []
            for (const {name, shortNames} of this.commandDefs) {
                const text = shortNames.length > 0 ?
                    `${name} (${shortNames.join(", ")}):` : `${name}:`
                names.push(text)
                width = Math.max(width, text.length)
            }

            console.log("Commands:")
            names.forEach((name, index) => {
                console.log(`${name}${padding(width - name.length)}: ${this.commandDefs[index].description}`)
            })
            console.log()
            return State.Stopped

        }, "Print this message", "?", "h")
    }
    private command(
        name: string,
        execute: (...args: string[]) => State,
        description: string,
        ...shortNames: string[]
    )  {
        const cmd: Command = { name, execute, shortNames, description };
        this.commandDefs.push(cmd)
        this.commands.set(name, cmd)
        for (const shortName of shortNames) {
            this.commands.set(shortName, cmd)
        }
    }
}

class Metadata {
    private compileResult: CompileResult
    private locationToFunction?: Map<number, Function>

    constructor(compileResult: CompileResult) {
        this.compileResult = compileResult
    }

    functionTypeOf(location: number): Type | undefined {
        const func = this.functionNodeOf(location)
        if (func !== undefined) {
            const types = this.compileResult.checkResult.types
            return types.get(func)
        }
        return undefined
    }

    private functionNodeOf(location: number): Function | undefined {
        let map = this.locationToFunction
        if (!map) {
            const newMap = new Map<number, Function>()
            this.locationToFunction = newMap
            const module = this.compileResult.lastModule

            function processDeclaration(declaration: Declaration) {
                switch (declaration.kind) {
                    case LastKind.Function:
                        const start = declaration.start
                        if (start !== undefined) {
                            newMap.set(start, declaration)
                        }
                        break
                    case LastKind.Exported:
                        processDeclaration(declaration.target)
                        break
                }
            }

            module.declarations.forEach(processDeclaration)
            map = newMap
        }
        return map.get(location)
    }
}

class Stack {
    private locations: [number,number][] = []
    private fileSet: FileSet
    private metadata: Metadata

    constructor(fileSet: FileSet, metadata: Metadata) {
        this.fileSet = fileSet
        this.metadata = metadata
    }

    update(location: number) {
        this.locations[this.depth -1][1] = location
    }

    push(location: number) {
        this.locations.push([location, 0])
    }

    pop() { this.locations.pop() }

    get depth() { return this.locations.length }

    print(count: number = 10, from: number = this.locations.length - 1) {
        const effectiveFrom = Math.min(from, this.locations.length - 1)
        const effectiveTo = Math.max(from - count + 1, 0)
        for (let frame = effectiveFrom; frame >= effectiveTo; frame--) {
            const frameInfo = this.locations[frame]
            if (frameInfo[1] !== 0) {
                console.log(this.functionDescription(this.locations[frame]))
            }
        }
    }

    functionDescription([func, ip]: [number, number]): string {
        const position = this.fileSet.position({ start: ip })
        const type = this.metadata.functionTypeOf(func)
        if (position != null && type != null) {
            return `${debuggerTypeName(type)} [${position.display()}]`
        } else if (type != null) {
            return debuggerTypeName(type)
        } else if (position != null) {
            return `<unknown>:${position.display()}`
        } else return `<unknown:${ip}`
    }
}

function debuggerTypeName(type: Type): string {
    switch (type.kind) {
        case TypeKind.Function: {
            return `fun ${type.name ?? ''}(${type.parameters.map((name, type) =>
               `${name}: ${debuggerTypeName(type)}`).join(", ")}): ${
                   debuggerTypeName(type.result)
                }`
        }
    }
    return typeToString(type)
}

interface Command {
    name: string
    shortNames: string[]
    description: string
    execute: (...args: string[]) => State
}