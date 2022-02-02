export function run(module: Uint8Array, hostName: string, args: string[]): number {
    try {
        const mod = new WebAssembly.Module(module);
        const inst = new WebAssembly.Instance(mod)
        const host = require(hostName)
        return host.main(inst.exports, args)
    } catch(e: any) {
        console.log(e.message)
        return 1
    }
}