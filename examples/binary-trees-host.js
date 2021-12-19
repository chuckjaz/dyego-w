const fs = require("fs")

const bytes = fs.readFileSync(process.argv[2])
const mod = new WebAssembly.Module(bytes);
const inst = new WebAssembly.Instance(mod);

const {work} = inst.exports

const maxDepth = 21
for (let depth = 4; depth <= maxDepth; depth += 2) {
    const iterations = 1 << maxDepth - depth + 4;
    const check = work(iterations, depth);
    console.log(`${iterations}\t trees of depth ${depth}\t check: ${check}`);
}
