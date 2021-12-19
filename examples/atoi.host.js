const fs = require("fs")

const bytes = fs.readFileSync(process.argv[2])
const mod = new WebAssembly.Module(bytes);
const inst = new WebAssembly.Instance(mod);

const {test_raw} = inst.exports

console.log(`test_raw() = ${test_raw()}`)
