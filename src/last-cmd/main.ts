import * as fs from "fs"
import { FileSet } from "../files";
import { Diagnostic } from "../last";
import { SourceMap } from "../source-map";
import { Mapping } from "../wasm";
import { compile } from "./compile";
import { debug } from "./debugger";
import { Options } from "./options";
import { run } from "./run";


export function main(sources: string[], options: Options): number {
    const fileSet = new FileSet()
    const result = compile(sources, options, fileSet, sourceFileName => {
        try {
            return fs.readFileSync(sourceFileName, 'utf-8')
        } catch(e: any) {
            return e
        }
    })

    if (Array.isArray(result)) {
        report(result, fileSet)
        return 1
    }

    const {module, mappings} = result

    if (options.run) {
        if (!options.hostName) {
            console.log("Host name is required")
            return 1
        }
        return run(module, options.hostName, options.args ?? [])
    }

    if (options.debug) {
        if (!options.hostName) {
            console.log("Host name is required")
            return 1
        }
        return debug(result, fileSet, options.hostName, options.args ?? [])
    }

    try {
        fs.writeFileSync(options.outFile, module)
    } catch(e: any) {
        console.log(e.message)
        return 1
    }

    if (mappings && options.mapFile) {
        const mapFileName = options.outFile + ".map"
        if (!writeMapFile(mapFileName, options.outFile, mappings, fileSet)) {
            return 1
        }
    }

    return 0
}

function report(diagnostics: Partial<Diagnostic>[], fileSet: FileSet, prefix: string = "") {
    for (const diagnostic of diagnostics) {
        const position = diagnostic.location ? fileSet.position(diagnostic.location) : undefined
        console.log(`${prefix}${position ? position.display() + ": " : ''}${diagnostic.message}`)
        if (diagnostic.related) {
            report(diagnostic.related, fileSet, prefix + "  ")
        }
    }
}

function writeMapFile(mapFileName: string, outputName: string, mappings: Mapping[], fileSet: FileSet): boolean {
    try {
        const sourceMap = new SourceMap(outputName);
        const fileNameIndexes = new Map<string, number>();
        for (const mapping of mappings) {
            const position = fileSet.position(mapping.location)
            if (position?.isValid) {
                var fileIndex: number
                const fileName = `../${position.fileName}`
                if (fileNameIndexes.has(fileName)) {
                    fileIndex = fileNameIndexes.get(fileName)!!
                } else {
                    fileIndex = sourceMap.addFile(fileName)
                    fileNameIndexes.set(fileName, fileIndex)
                }
                sourceMap.addMapping(mapping.offset, fileIndex, position.line, position.column)
            }
        }
        const sourceMapText = sourceMap.toMap()
        fs.writeFileSync(mapFileName, sourceMapText, "utf8")
    } catch(e: any) {
        console.log(e.message)
        return false
    }
    return true
}
