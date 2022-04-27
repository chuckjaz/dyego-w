import { FileSet } from "../files"
import { check, CheckResult, copy, Diagnostic, Import, ImportItem, LastKind, Locatable, Module } from "../last"
import { parse, Scanner } from "../last-parser"
import { ByteWriter, Mapping, Module as WasmModule } from "../wasm"
import { codegen } from "../last-wasm"
import { validate } from "../last-validate"
import { transform } from "../last-debug"
import { Options } from "./options"
import { importJson } from "../last-import-json/import"
import { ExtensionConverter } from "../last-import-json/extension-converter"
import { FilterConverter } from "../last-import-json/filter-converter"

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
            const module = importJson(text, [
                new ExtensionConverter(),
                new FilterConverter(
                    "func_write",
                    "func_read",
                    "func_open",
                    "func_close",
                    "func_openat",
                    "func_exit",
                    "func_wait",
                    "func_lseek",
                    "func_mmap",
                    "func_execve"
                )
            ])
            const validateResult = validate(module)
            if (validateResult.length > 0) {
                diagnostics.push(...validateResult)
                return emptyModule
            }
            if (options.debug) {
                return transform(module)
            }
            return module
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

function mergeModules(modules: Module[]): Module | Diagnostic[] {
    const diagnostics: Diagnostic[] = []

    function reportDuplicate(name: string, location: Locatable, other: Locatable) {
        diagnostics.push({
            location,
            message: `Duplicate import "${name}"`,
            related: [
                {
                    location: other,
                    message: "Already used here"
                }
            ]
        })
    }

    const used = new Map<string, { location: Locatable, module: string }>()
    const asNames = new Map<string, Locatable>()
    const imports: Import[] = []
    for (const module of modules) {
        for (const imp of module.imports) {
            const items: ImportItem[] = []
            for (const item of imp.imports) {
                if (item.as) {
                    const otherAs = asNames.get(item.as.name) ??
                        used.get(item.name.name)?.location
                    if (otherAs) {
                        reportDuplicate(item.as.name, item.as, otherAs)
                        continue
                    }
                    items.push(item)
                    continue
                }
                const other = used.get(item.name.name)
                if (other && other.module != item.module.name) {
                    reportDuplicate(item.name.name, item.name, other.location)
                }
            }
            if (items.length > 0) {
                imports.push(copy(imp, { imports: items }))
            }
        }
    }

    if (diagnostics.length > 0) {
        return diagnostics
    }

    const declarations = modules.flatMap(module => module.declarations)
    return {
        kind: LastKind.Module,
        imports,
        declarations
    }
}
