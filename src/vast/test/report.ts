import * as last from '../../last'
import * as files from '../../files'

export function report(phase: string, diagnostics: last.Diagnostic[], fileSet: files.FileSet): never {
    const messages: string[] = []
    for (const diagnostic of diagnostics) {
        const location = diagnostic.location
        if (location.start) {
            const position = fileSet.position(location)
            messages.push(`${position?.display()}, ${phase}: ${diagnostic.message}`);
            if (position) {
                const file = fileSet.file(location)
                const line = '  ' + file?.lineText(position.line, position.line + 1)
                if (line) {
                    messages.push('\n' + line)
                    messages.push('^'.padStart(position.column + 3))
                }
            }
        } else {
            messages.push(diagnostic.message)
        }
    }
    throw new Error(messages.join("\n"))
}
