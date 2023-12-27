export function produceConsoleModule(getMemory: () => WebAssembly.Memory | undefined): any {
    let decoder = new TextDecoder("utf-8")
    return {
        printi32: (arg: number) => console.log(arg),
        printi64: (arg: number) => console.log(arg),
        printptr: (arg: number) => {
            console.log(`0x${arg.toString(16)}`)
        },
        println: (arg: number) => {
            let memory = getMemory()
            if (!memory) {
                console.log("Memory not exported, cannot print strings")
            } else {
                let u8Mem = new Uint8Array(memory.buffer)
                let end = arg
                for ( ; u8Mem[end]; end++)
                    ;
                const message = decoder.decode(u8Mem.slice(arg, end))
                console.log(message)
            }
        }
    }

}