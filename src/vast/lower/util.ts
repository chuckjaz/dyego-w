import { LocationKind } from "../types/check"
import { Type, TypeKind } from "../types/types"
import { Expression, FieldLiteral, Function, IrKind, Module, PrimitiveKind, Statement } from "./ir"

export function dumpIr(node: Module | Function | FieldLiteral | Expression | Statement): string {
    let result = ""
    let linePrefix = ""
    let first = true

    dump(node)

    return result

    function dump(node: Module | Function | FieldLiteral | Expression | Statement) {
        switch (node.kind) {
            case IrKind.ArrayLiteral:
                emit("[")
                commas(node.values)
                emit("]")
                return
            case IrKind.Block:
                emit("{")
                nl()
                indent(() =>
                    node.statements.forEach(statement => { dump(statement); nl() })
                )
                emit("}")
                nl()
                return
            case IrKind.Call:
                dump(node.target)
                emit("(")
                commas(node.args)
                emit(")")
                return
            case IrKind.ComputedBranch:
                emit("branch ")
                dump(node.target)
                emit(" to ")
                commas(node.branches)
                return
            case IrKind.Assign:
                dump(node.target)
                emit(" = ")
                dump(node.value)
                return
            case IrKind.If:
                emit("if (")
                dump(node.condition)
                emit(") ")
                dump(node.then)
                nl()
                emit("else ")
                dump(node.then)
                return
            case IrKind.Index:
                dump(node.target)
                emit("[")
                dump(node.index)
                emit("]")
                return
            case IrKind.Literal:
                if (node.value.primitiveKind != PrimitiveKind.String) {
                    emit(`${node.value.value}`)
                }
                switch (node.value.primitiveKind) {
                    case PrimitiveKind.Bool:
                    case PrimitiveKind.Char:
                    case PrimitiveKind.I32:
                    case PrimitiveKind.Null:
                        break
                    case PrimitiveKind.F64:
                        emit("d")
                        break
                    case PrimitiveKind.F32:
                        emit("f")
                        break
                    case PrimitiveKind.I16:
                        emit("s")
                        break
                    case PrimitiveKind.I64:
                        emit("l")
                        break
                    case PrimitiveKind.I8:
                        emit("t")
                        break
                    case PrimitiveKind.String:
                        emit(`"${node.value.value}"`)
                        break
                    case PrimitiveKind.U16:
                        emit("us")
                        break
                    case PrimitiveKind.U32:
                        emit("u")
                        break
                    case PrimitiveKind.U64:
                        emit("ul")
                        break
                    case PrimitiveKind.U8:
                        emit("ut")
                        break
                }
                return
            case IrKind.Nothing:
                emit("<nothing>")
                return
            case IrKind.Reference:
                emit(node.name)
                return
            case IrKind.Select:
                dump(node.target)
                emit(".")
                dump(node.name)
                return
            case IrKind.StructLiteral:
                emit("[ ")
                commas(node.fields)
                emit(" ]")
                return
            case IrKind.Break:
                emit(`break ${node.target}`)
                return
            case IrKind.Continue:
                emit(`continue ${node.target}`)
                return
            case IrKind.Definition:
                switch (node.name.location.kind) {
                    case LocationKind.Context:
                        emit("context ")
                        break
                    case LocationKind.Function:
                        emit("fun ")
                        break
                    case LocationKind.Let:
                        emit("let ")
                        break
                    case LocationKind.Val:
                        emit("val ")
                        break
                    case LocationKind.Var:
                        emit("var ")
                        break
                }
                dump(node.name)
                emit(": ")
                dumpType(node.type)
                return
            case IrKind.For:
                emit("for (")
                dump(node.index)
                emit(" = ")
                dump(node.initialize)
                emit(" by ")
                dump(node.advance)
                emit(")")
                dump(node.body)
                return
            case IrKind.Return:
                emit("return ")
                dump(node.value)
                return
            case IrKind.While:
                emit("while (")
                dump(node.condition)
                emit(")")
                dump(node.body)
                return
            case IrKind.FieldLiteral:
                dump(node.name)
                emit(": ")
                dumpType(node.type)
                return
            case IrKind.Function:
                emit("fun ")
                dump(node.name)
                emit("(")
                commas(node.parameters)
                emit("): ")
                dumpType(node.body.type)
                dump(node.body)
                return
            case IrKind.Module:
                emit("module {")
                nl()
                indent(() => {
                    node.functions.forEach(func => {
                        dump(func)
                        nl()
                    })
                })
                emit("}")
                nl()
                return
        }
    }

    function dumpType(type: Type) {
        switch (type.kind) {
            case TypeKind.I8: emit("i8"); return
            case TypeKind.I16: emit("i16"); return
            case TypeKind.I32: emit("i32"); return
            case TypeKind.I64: emit("i64"); return
            case TypeKind.U8: emit("u8"); return
            case TypeKind.U16: emit("u16"); return
            case TypeKind.U32: emit("u32"); return
            case TypeKind.U64: emit("u64"); return
            case TypeKind.F32: emit("f32"); return
            case TypeKind.F64: emit("f64"); return
            case TypeKind.Boolean: emit("bool"); return
            case TypeKind.Char: emit("char"); return
            case TypeKind.String: emit("string"); return
            case TypeKind.Void: emit("void"); return
            case TypeKind.Array:
                dumpType(type.element)
                emit(`[${type.size}]`)
                return
            case TypeKind.Slice:
                dumpType(type.element)
                emit("[]")
                return
            case TypeKind.Struct:
                if (type.name) {
                    emit(type.name)
                } else {
                    emit("< ")
                    let comma = false
                    type.fields.forEach((name, field) => {
                        if (comma) emit(", ")
                        emit(`${name}: `)
                        dumpType(field.type)
                    })
                    emit(" >")
                }
                return
            case TypeKind.Function:
                emit("fun ()")
                let comma = false
                type.parameters.forEach((name, parameter) => {
                    if (comma) emit(", ")
                    emit(`${name}: `)
                    dumpType(parameter.type)
                })
                emit("): ")
                dumpType(type.result)
                return
            case TypeKind.Lambda:
                emit("<lambda>")
                return
            case TypeKind.Range:
                emit("Range")
                return
            case TypeKind.Never:
                emit("Never")
                return
            case TypeKind.Open:
                emit("_OPEN_")
                return
            case TypeKind.Error:
                emit("<error>")
        }
    }

    function nl() {
        result += "\n"
        first = true
    }

    function emit(text: string) {
        if (first) {
            result += linePrefix
            first = false
        }
        result += text
    }

    function indent(content: () => void) {
        const prefix = linePrefix
        linePrefix += "   "
        content()
        linePrefix = prefix
    }

    function commas<N extends Expression | Statement | FieldLiteral | undefined>(nodes: N[], types: boolean = false) {
        let first = true
        for (const node of nodes) {
            if (!first) emit(", ")
            first = false
            if (node) dump(node)
            else emit("<undefined>")
            if (node && types) {
                emit(": ")
                dumpType(node.type)
            }
        }
    }

}