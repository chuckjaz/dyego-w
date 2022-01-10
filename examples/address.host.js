const fs = require("fs")

const bytes = fs.readFileSync(process.argv[2])
const mod = new WebAssembly.Module(bytes);
const inst = new WebAssembly.Instance(mod);

const {test1} = inst.exports

console.log(`test1() = ${test1()}`)
