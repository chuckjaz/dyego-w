exports.main = function ({work}, args) {
    const iterations = args[0] ? parseInt(args[0]) : 10
    const depth = args[1] ? parseInt(args[1]) : 5
    console.log(`work(${iterations}, ${depth})`, work(iterations, depth))
}