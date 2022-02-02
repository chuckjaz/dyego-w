exports.main = function({offsetMomentum, energy, mainLoop}, args) {
    const count = args[0] ? parseInt(args[0]) : 10
    offsetMomentum()
    console.log('energy:', energy().toFixed(9))
    mainLoop(count)
    console.log('energy:', energy().toFixed(9))
}
