import * as path from 'path'
import { Options } from "./options";
import { Flags } from "./flag";
import { main } from './main';

const flags = new Flags()

flags.string("mapFileName", "File name to write a map file (implies --mapFile)")
flags.string("out", "Name of the output file")
flags.boolean("debug", "Debug the application", false, "d")
flags.boolean("run", "Run the application", false, "r")
flags.boolean("mapFile", "Write a map file", false)
flags.boolean("stack", "Enable stack allocations", false, "s")
flags.string("host", "Host file to run the module (required for run or debug)")

flags.parse(process.argv.slice(2))
if (!flags.report(true)) {
    process.exit(1)
}

if (flags.helpRequested) {
    console.log("last [<options>] <filenames> [-- <application options>]\n")
    console.log(flags.helpText())
    process.exit(0)
}

const firstFile = flags.args[0]
if (!firstFile) {
    console.log("Nothing to do")
    process.exit(1)
}

const out = flags.options.out ?? replaceExt(firstFile, '.wasm')
const defaultMapFile = out + ".map"

const options: Options = {
    mapFile: flags.options.mapFile || flags.options.mapFileName !== undefined,
    mapFileName: flags.options.mapFileName ?? defaultMapFile,
    outFile: out,
    debug: flags.options.debug,
    stack: flags.options.stack,
    run: flags.options.run,
    hostName: flags.options.host,
    args: flags.unprocessed
}

const result = main(flags.args, options)
process.exit(result)

function replaceExt(name: string, ext: string): string {
    return path.format({ ...path.parse(name), base: '', ext })
}