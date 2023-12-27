import { Binary, BodyElement, Expression, Function, Last, LastKind, Literal, MemoryMethod, PrimitiveKind, Statement, TypeBinary, TypeExpression, Unary } from "../last";

export function dump(node: Last): string {
    let result = ""
    let linePrefix = ""
    let first = false

    dump(node, 0)
    return result

    function dump(node: Last, level: number) {
        switch (node.kind) {
            case LastKind.Add:
            case LastKind.Subtract:
            case LastKind.Multiply:
            case LastKind.Divide:
            case LastKind.Remainder:
            case LastKind.Equal:
            case LastKind.NotEqual:
            case LastKind.GreaterThan:
            case LastKind.GreaterThanEqual:
            case LastKind.LessThan:
            case LastKind.LessThanEqual:
            case LastKind.And:
            case LastKind.Or:
            case LastKind.BitAnd:
            case LastKind.BitOr:
            case LastKind.BitXor:
            case LastKind.BitRotl:
            case LastKind.BitRotr:
            case LastKind.BitShl:
            case LastKind.BitShr:
            case LastKind.Minimum:
            case LastKind.Maximum:
            case LastKind.CopySign:
            case LastKind.ConvertTo:
            case LastKind.WrapTo:
            case LastKind.ReinterpretAs:
            case LastKind.TruncateTo:
            case LastKind.As:
                return dumpBinary(node, level)
            case LastKind.Not:
            case LastKind.Negate:
            case LastKind.AddressOf:
            case LastKind.AbsoluteValue:
            case LastKind.CountLeadingZeros:
            case LastKind.CountNonZeros:
            case LastKind.CountTrailingZeros:
            case LastKind.SquareRoot:
            case LastKind.Floor:
            case LastKind.Ceiling:
            case LastKind.Truncate:
            case LastKind.RoundNearest:
            case LastKind.Dereference:
            case LastKind.SizeOf:
                return dumpUnary(node, level)
            case LastKind.Let:
            case LastKind.Var:
            case LastKind.Type:
            case LastKind.Loop:
            case LastKind.Block:
            case LastKind.Branch:
            case LastKind.BranchIndexed:
            case LastKind.Return:
            case LastKind.Assign:
                return dumpStatement(node)
            case LastKind.Primitive:
            case LastKind.TypeSelect:
            case LastKind.StructTypeLiteral:
            case LastKind.UnionTypeLiteral:
            case LastKind.ArrayConstructor:
            case LastKind.PointerConstructor:
                return dumpTypeExpression(node, 0)
            case LastKind.Literal:
                return dumpLiteral(node)
            case LastKind.Reference:
                return emit(node.name)
            case LastKind.Function:
                return dumpFunction(node)
            case LastKind.Global: {
                emit("global ")
                dump(node.name, 0)
                emit(": ")
                dump(node.type, 0)
                emit(" = ")
                dump(node.value, 0)
                return
            }
            case LastKind.Exported: {
                emit("export ")
                dump(node.target, 0)
                return
            }
            case LastKind.IfThenElse: {
                emit("if (")
                dump(node.condition, 0)
                emit(")")
                if (node.then.length > 1) {
                    emit(" {")
                    dumpBody(node.then)
                    emit("}")
                } else dump(node.then[0], 0)
                if (node.else.length > 0) {
                    emit(" else ")
                    if (node.else.length > 1) {
                        emit(" {")
                        dumpBody(node.else)
                        emit("}")
                    } else dump(node.else[0], 0)
                }
                return
            }
            case LastKind.Select: {
                dump(node.target, level)
                emit(".")
                dump(node.name, 0)
                return
            }
            case LastKind.Index: {
                dump(node.target, level)
                emit("[")
                dump(node.index, 0)
                emit("]")
                return
            }
            case LastKind.Call: {
                dump(node.target, level)
                emit("(")
                commas(node.arguments)
                emit(")")
                return
            }
            case LastKind.Memory: {
                emit("memory.")
                switch (node.method) {
                    case MemoryMethod.Grow:
                        emit("grow(")
                        dump(node.amount, 0)
                        emit(")")
                        return
                    case MemoryMethod.Limit:
                        emit("limit")
                        return
                    case MemoryMethod.Top:
                        emit("top")
                        return
                }
            }
            case LastKind.ArrayLiteral: {
                emit("[")
                if (Array.isArray(node.values)) {
                    commas(node.values)
                } else {
                    emit("...")
                }
                emit("]")
                return
            }
            case LastKind.StructLiteral: {
                emit("{")
                commas(node.fields)
                emit("}")
                return
            }
            case LastKind.Field: {
                dump(node.name, 0)
                emit(": ")
                dump(node.value, 0)
                return
            }
            case LastKind.Import: {
                emit("import {")
                commas(node.imports)
                emit("}")
                return
            }
            case LastKind.Parameter: {
                dump(node.name, 0)
                emit(": ")
                dumpTypeExpression(node.type, 0)
                return
            }
            case LastKind.ImportFunction: {
                emit("fun ")
                dump(node.name, 0)
                emit("(")
                commas(node.parameters)
                emit("): ")
                dumpTypeExpression(node.result, 0)
                if (node.as) {
                    emit(" as ")
                    dump(node.as, 0)
                }
                emit(" from ")
                dump(node.module, 0)
                return
            }
            case LastKind.ImportVariable: {
                dump(node.name, 0)
                emit(": ")
                dumpTypeExpression(node.type, 0)
                if (node.as) {
                    emit(" as ")
                    dump(node.as, 0)
                }
                emit(" from ")
                dump(node.module, 0)
                return
            }
            case LastKind.FieldLiteral: {
                dump(node.name, 0)
                emit(": ")
                dumpTypeExpression(node.type, 0)
                return
            }
            case LastKind.Module: {
                for (const item of node.imports) {
                    dump(item, 0)
                    nl()
                }
                for (const item of node.declarations) {
                    dump(item, 0)
                    nl()
                }
                return
            }
        }
    }

    function dumpFunction(node: Function) {
        emit("fun ")
        dump(node.name, 0)
        emit("(")
        commas(node.parameters)
        emit("): ")
        dump(node.result, 0)
        emit(" {")
        dumpBody(node.body)
        emit("}")
        nl()
    }

    function dumpBinary(node: Expression & (Binary | TypeBinary), level: number) {
        if (level > 0) emit("(")
        dump(node.left, level + 1)
        switch (node.kind) {
            case LastKind.Add: emit(" + "); break
            case LastKind.Subtract: emit(" - "); break
            case LastKind.Multiply: emit(" * "); break
            case LastKind.Divide: emit(" / "); break
            case LastKind.Remainder: emit(" % "); break
            case LastKind.Equal: emit(" == "); break
            case LastKind.NotEqual: emit(" != "); break
            case LastKind.GreaterThan: emit(" > "); break
            case LastKind.GreaterThanEqual: emit(" >= "); break
            case LastKind.LessThan: emit(" < "); break
            case LastKind.LessThanEqual: emit(" <= "); break
            case LastKind.And: emit(" && "); break
            case LastKind.Or: emit(" || "); break
            case LastKind.BitAnd: emit(" & "); break
            case LastKind.BitOr: emit(" | "); break
            case LastKind.BitXor: emit(" ^ "); break
            case LastKind.BitRotl: emit(" rotl "); break
            case LastKind.BitRotr: emit( "rotr"); break
            case LastKind.BitShl: emit(" << "); break
            case LastKind.BitShr: emit(" >> "); break
            case LastKind.Minimum: emit(" min "); break
            case LastKind.Maximum: emit(" max "); break
            case LastKind.CopySign: emit(" copysign "); break
            case LastKind.ConvertTo: emit(" convertto "); break
            case LastKind.WrapTo: emit(" wrapto "); break
            case LastKind.ReinterpretAs: emit(" reinterpretas "); break
            case LastKind.TruncateTo: emit(" truncateto "); break
            case LastKind.As: emit(" as "); break
        }
        dump(node.right, level + 1)
        if (level > 0) emit(")")
    }

    function dumpUnary(node: Expression & (Unary | { target: TypeExpression }), level: number) {
        switch (node.kind) {
            case LastKind.Not: emit("!"); break
            case LastKind.Negate: emit("-"); break
            case LastKind.AddressOf: emit("&"); break
            case LastKind.SizeOf: emit("sizeof "); break
        }
        dump(node.target, level)
        switch (node.kind) {
            case LastKind.AbsoluteValue: emit(" abs"); break
            case LastKind.CountLeadingZeros: emit(" countleadingzeros"); break
            case LastKind.CountNonZeros: emit(" countnonzeros"); break
            case LastKind.CountTrailingZeros: emit(" counttrailingzeros"); break
            case LastKind.SquareRoot: emit(" sqrt"); break
            case LastKind.Floor: emit(" floor"); break
            case LastKind.Ceiling: emit(" ceiling"); break
            case LastKind.Truncate: emit(" truncate"); break
            case LastKind.RoundNearest: emit(" roundnearest"); break
            case LastKind.Dereference: emit("^"); break
        }
    }

    function dumpLiteral(node: Literal) {
        switch (node.primitiveKind) {
            case PrimitiveKind.Bool:
            case PrimitiveKind.F32:
            case PrimitiveKind.F64:
            case PrimitiveKind.I16:
            case PrimitiveKind.I32:
            case PrimitiveKind.I64:
            case PrimitiveKind.I8:
            case PrimitiveKind.U16:
            case PrimitiveKind.U32:
            case PrimitiveKind.U64:
            case PrimitiveKind.U8:
                return emit(`${node.value}`)
            case PrimitiveKind.Null:
                return emit("null")
        }
    }

    function dumpTypeExpression(node: TypeExpression, level: number) {
        if (level > 1) emit("(")
        switch (node.kind) {
            case LastKind.Primitive:
                switch (node.primitive) {
                    case PrimitiveKind.Bool: emit("bool"); return
                    case PrimitiveKind.F32: emit("f32"); return
                    case PrimitiveKind.F64: emit("f64"); return
                    case PrimitiveKind.I16: emit("i16"); return
                    case PrimitiveKind.I32: emit("i32"); return
                    case PrimitiveKind.I64: emit("i64"); return
                    case PrimitiveKind.I8: emit("i8"); return
                    case PrimitiveKind.Null: emit("null"); return
                    case PrimitiveKind.U16: emit("u16"); return
                    case PrimitiveKind.U32: emit("u32"); return
                    case PrimitiveKind.U64: emit("u64"); return
                    case PrimitiveKind.U8: emit("u8"); return
                    case PrimitiveKind.Void: emit("void"); return
                }
            case LastKind.Reference:
                dump(node, 0)
                break
            case LastKind.TypeSelect:
                dumpTypeExpression(node.target, level)
                emit(".")
                dump(node.name, 0)
                break
            case LastKind.StructTypeLiteral: {
                emit("<")
                commas(node.fields)
                emit(">")
                break
            }
            case LastKind.UnionTypeLiteral: {
                emit("<| ")
                commas(node.fields)
                emit(" |>")
                break
            }
            case LastKind.ArrayConstructor: {
                dumpTypeExpression(node.element, level + 1)
                emit("[")
                if (node.size !== undefined) {
                    emit(`${node.size}`)
                }
                emit("]")
                break
            }
            case LastKind.PointerConstructor: {
                dumpTypeExpression(node.target, level + 1)
                emit("^")
                break
            }
        }
        if (level > 1) emit(")")
    }

    function dumpStatement(node: Statement) {
        switch (node.kind) {
            case LastKind.Let: {
                emit("let ")
                dump(node.name, 0)
                emit(": ")
                dump(node.type, 0)
                emit(" = ")
                dump(node.value, 0)
                return
            }
            case LastKind.Var: {
                emit("let ")
                dump(node.name, 0)
                if (node.type) {
                    emit(": ")
                    dump(node.type, 0)
                }
                if (node.value) {
                    emit(" = ")
                    dump(node.value, 0)
                }
                return
            }
            case LastKind.Block: {
                if (node.name) {
                    dump(node.name, 0)
                    emit(": ")
                }
                emit("{")
                dumpBody(node.body)
                emit("}")
                return
            }
            case LastKind.Type: {
                emit("type ")
                dump(node.name, 0)
                emit(" = ")
                dump(node.type, 0)
                return
            }
            case LastKind.Loop: {
                if (node.name) {
                    dump(node.name, 0)
                    emit(": ")
                }
                emit("loop {")
                dumpBody(node.body)
                emit("}")
                return
            }
            case LastKind.Branch: {
                emit("branch")
                if (node.target) {
                    emit(" ")
                    dump(node.target, 0)
                }
                return
            }
            case LastKind.BranchIndexed: {
                emit("branchindexed ")
                dump(node.condition, 0)
                emit(" [")
                commas(node.targets)
                emit("]")
                emit(" else ")
                dump(node.else, 0)
                return
            }
            case LastKind.Return: {
                emit("return")
                if (node.value) {
                    emit(" ")
                    dump(node.value, 0)
                }
                return
            }
            case LastKind.Assign: {
                dump(node.target, 0)
                emit(" = ")
                dump(node.value, 0)
                return
            }
        }
    }

    function dumpBody(body: BodyElement[]) {
        indent(() => {
            nl()
            for (const element of body) {
                dump(element, 0)
                nl()
            }
        })
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

    function commas<N extends Last>(nodes: N[]) {
        let first = true
        for (const node of nodes) {
            if (!first) emit(", ")
            first = false
            dump(node, 0)
        }
    }
}

