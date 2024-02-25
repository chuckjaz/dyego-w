import { copy, Diagnostic, Import, ImportItem, LastKind, Locatable, Module } from "../last"

export function mergeModules(modules: Module[]): Module | Diagnostic[] {
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
