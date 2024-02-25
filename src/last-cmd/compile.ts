import { FileSet } from "../files"
import { check, CheckResult, copy, Diagnostic, Import, ImportItem, LastKind, Locatable, Module } from "../last"
import { parse, Scanner } from "../last-parser"
import { ByteWriter, Mapping, Module as WasmModule } from "../wasm"
import { codegen } from "../last-wasm"
import { validate } from "../last-validate"
import { transform } from "../last-debug"
import { Options } from "./options"
import { mergeModules } from "../last-util"

export interface CompileResult {
    module: Uint8Array
    lastModule: Module,
    checkResult: CheckResult
    mappings?: Mapping[]
}

export function compile(
    sourceFiles: string[],
    options: Options,
    fileSet: FileSet,
    readFile: (fileName: string) => string | Error
): CompileResult | Partial<Diagnostic>[] {
    const diagnostics: Partial<Diagnostic>[] = []

    // Parse the files
    const modules: Module[] = sourceFiles.map(source => {
        if (source.endsWith(".last.dg")) {
            const text = readFile(source)
            if (typeof text !== "string") {
                diagnostics.push({ message: `Error reading file: ${source}`})
                return emptyModule
            }
            const fileText = options.debug ? text : undefined
            const builder = fileSet.buildFile(source, text.length, fileText)
            const scanner = new Scanner(text, builder)
            const module = parse(scanner, builder)
            builder.build()

            if (Array.isArray(module)) {
                diagnostics.push(...module)
                return emptyModule
            } else {
                if (options.debug) {
                    return transform(module)
                }
                return module
            }
        } else if (source.endsWith(".json")) {
            const text = readFile(source)
            if (typeof text !== "string") {
                diagnostics.push({ message: `Error reading file: ${source}`})
                return emptyModule
            }
            const json = JSON.parse(text) as Module
            const validateResult = validate(json)
            if (validateResult.length > 0) {
                diagnostics.push(...validateResult)
                return emptyModule
            }
            if (options.debug) {
                return transform(json)
            }
            return json
        } else {
            diagnostics.push({ message: `Unrecognized file type: ${source}`})
            return emptyModule
        }
    })

    if (diagnostics.length) {
        return diagnostics
    }

    const module = mergeModules(modules)
    if (Array.isArray(module)) {
        return module
    }

    const checkResult = check(module)
    if (Array.isArray(checkResult)) {
        return checkResult
    }

    const wasmModule = new WasmModule()
    codegen(module, checkResult, wasmModule, options.mapFile)
    const writer = new ByteWriter()
    wasmModule.write(writer)
    return { module: writer.extract(), lastModule: module, checkResult, mappings: wasmModule.mappings() }
}

const emptyModule: Module = { kind: LastKind.Module, imports: [], declarations: [] }
