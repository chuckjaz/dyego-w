const fs = require("fs")

const bytes = fs.readFileSync(process.argv[2])
const count = parseInt(process.argv[3])
const mod = new WebAssembly.Module(bytes);
const inst = new WebAssembly.Instance(mod);

const {offsetMomentum, energy, mainLoop} = inst.exports

offsetMomentum()

console.log(energy().toFixed(9))
mainLoop(count)
console.log(energy().toFixed(9))