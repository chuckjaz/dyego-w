import { produceConsoleModule } from "./console-module";

export function run(module: Uint8Array, hostName: string, args: string[]): number {
    console.log("running...")
    try {
        const mod = new WebAssembly.Module(module);
        let memory: WebAssembly.Memory
        const inst = new WebAssembly.Instance(mod, {
            'console': produceConsoleModule(() => memory)
        })
        memory = inst.exports.mem as WebAssembly.Memory
        const host = require(hostName)
        return host.main(inst.exports, args)
    } catch(e: any) {
        console.log(e.message)
        return 1
    }
}