import { LastKind, Module } from "../last";
import { Converter } from "./import";

export class FilterConverter implements Converter {
    private exludes: Map<string, boolean> = new Map()

    constructor(...excludes: string[]) {
        for (const exclude of excludes) {
            this.exludes.set(exclude, true)
        }
    }

    finish(node: Module): Module {
        node.declarations = node.declarations.filter(declaration => {
            if (declaration.kind == LastKind.Function) {
                return !this.exludes.has(declaration.name.name)
            }
            return true
        })
        return node;
    }

    convert = { }
}
