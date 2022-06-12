import {
    Binary, BodyElement, Declaration, Expression, FieldLiteral, Import, ImportItem, isExpression, Last, LastKind,
    MemoryMethod, Module, Parameter, PrimitiveKind, Reference, TypeBinary, TypeExpression, Unary
} from "../last"

export function lastToText(module: Module): string {
    let result = ""
    let indent = ""

    convertModule(module)

    return result


    function convertModule(module: Module) {
        for (const imp of module.imports) {
            convertImport(imp)
        }
        for (const declaration of module.declarations) {
            convertDeclaration(declaration)
        }
    }

    function convertImport(imp: Import) {
        a("import ")
        i(imp.module)
        list(" {", "}", true, imp.imports, importClause)
        nl()
    }

    function list<T>(prefix: string, suffix: string, nls: boolean, items: T[], disp: (item: T) => void) {
        a(prefix)
        if (items.length > 0) {
            level(() => {
                if (nls) nl()
                let first = true
                for (const item of items) {
                    if (!first) { if (!nls) a(", "); else nl() }
                    first = false
                    disp(item)
                }
            })
        }
        if (nls) nl()
        a(suffix)
    }

    function importClause(clause: ImportItem) {
        switch(clause.kind) {
            case LastKind.ImportFunction:
                i(clause.name)
                parameterList(clause.parameters)
                a(": ")
                typeExpression(clause.result)
                break
            case LastKind.ImportVariable:
                i(clause.name)
                break
        }
    }

    function parameterList(parameters: Parameter[]) {
        list("(", ")", false, parameters, parameter => {
            i(parameter.name)
            a(": ")
            typeExpression(parameter.type)
        })
    }

    function typeExpression(type: TypeExpression) {
        switch (type.kind) {
            case LastKind.Primitive:
                switch (type.primitive) {
                    case PrimitiveKind.I8: a("i8"); break
                    case PrimitiveKind.I16: a("i16"); break
                    case PrimitiveKind.I32: a("i32"); break
                    case PrimitiveKind.I64: a("i64"); break
                    case PrimitiveKind.U8: a("u8"); break
                    case PrimitiveKind.U16: a("u16"); break
                    case PrimitiveKind.U32: a("u32"); break
                    case PrimitiveKind.U64: a("u64"); break
                    case PrimitiveKind.F32: a("f32"); break
                    case PrimitiveKind.F64: a("f64"); break
                    case PrimitiveKind.Bool: a("bool"); break
                    case PrimitiveKind.Void: a("void"); break
                    case PrimitiveKind.Null: a("null"); break
                }
                break
            case LastKind.Reference:
                i(type)
                break
            case LastKind.TypeSelect:
                typeExpression(type.target)
                a(".")
                i(type.name)
                break
            case LastKind.StructTypeLiteral:
                a("<")
                fieldLiterals(type.fields)
                a(">")
                break
            case LastKind.UnionTypeLiteral:
                a("<|")
                fieldLiterals(type.fields)
                a("|>")
                break
            case LastKind.ArrayConstructor:
                typeExpression(type.element)
                a("[")
                if (type.size !== undefined) {
                    a(`${type.size}`)
                }
                a("]")
                break
            case LastKind.PointerConstructor:
                typeExpression(type.target)
                a("^")
                break
        }
    }

    function fieldLiterals(fields: FieldLiteral[]) {
        list("", "", true, fields, field => {
            i(field.name)
            a(": ")
            typeExpression(field.type)
        })
    }

    function convertDeclaration(declaration: Declaration) {
        switch (declaration.kind) {
            case LastKind.Let:
                a("let ")
                i(declaration.name)
                a(": ")
                typeExpression(declaration.type)
                nl()
                break
            case LastKind.Var:
                a("var ")
                i(declaration.name)
                if (declaration.type) {
                    a(": ")
                    typeExpression(declaration.type)
                }
                if (declaration.value) {
                    a(" = ")
                    expression(declaration.value)
                }
                nl()
                break
            case LastKind.Global:
                a("global ")
                i(declaration.name)
                a(": ")
                typeExpression(declaration.type)
                a(" = ")
                isExpression(declaration.value)
                nl()
                break
            case LastKind.Type:
                a("type ")
                i(declaration.name)
                a(" = ")
                typeExpression(declaration.type)
                nl()
                break
            case LastKind.Function:
                a("fun ")
                i(declaration.name)
                parameterList(declaration.parameters)
                a(": ")
                typeExpression(declaration.result)
                body(declaration.body)
                nl()
                break
            case LastKind.Exported:
                a("export ")
                convertDeclaration(declaration.target)
                break
        }
    }

    function body(body: BodyElement[]) {
        list("{", "}", true, body, statement)
    }

    function expression(node: Expression) {
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
            case LastKind.BitShl:
            case LastKind.BitShr:
            case LastKind.BitRotr:
            case LastKind.BitRotl:
            case LastKind.Minimum:
            case LastKind.Maximum:
            case LastKind.CopySign:
                binop(node)
                break
            case LastKind.As:
            case LastKind.ConvertTo:
            case LastKind.WrapTo:
            case LastKind.ReinterpretAs:
            case LastKind.TruncateTo:
                typebinop(node)
                break
            case LastKind.AddressOf:
            case LastKind.Negate:
            case LastKind.Not:
            case LastKind.CountLeadingZeros:
            case LastKind.CountTrailingZeros:
            case LastKind.CountNonZeros:
            case LastKind.AbsoluteValue:
            case LastKind.SquareRoot:
            case LastKind.Floor:
            case LastKind.Ceiling:
            case LastKind.Truncate:
            case LastKind.RoundNearest:
                unop(node)
                break
            case LastKind.SizeOf:
                a("sizeof ")
                typeExpression(node.target)
                break
            case LastKind.Reference:
                i(node)
                break
            case LastKind.Block:
                list("{", "}", true, node.body, statement)
                break
            case LastKind.Dereference:
                expression(node.target)
                a("^")
                break
            case LastKind.Literal:
                a(`${node.value}`)
                break
            case LastKind.IfThenElse:
                a("if (")
                expression(node.condition)
                a(") ")
                body(node.then)
                a(" else ")
                body(node.else)
                break
            case LastKind.Select:
                expression(node.target)
                a(".")
                i(node.name)
                break
            case LastKind.Index:
                expression(node.target)
                a("[")
                expression(node.index)
                a("]")
                break
            case LastKind.Call:
                expression(node.target)
                list("(", ")", false, node.arguments, expression)
                break
            case LastKind.Memory:
                a("memory.")
                switch(node.method) {
                    case MemoryMethod.Grow:
                        a("grow")
                        list("(", ")", false, [node.amount], expression)
                        break
                    case MemoryMethod.Limit:
                        a("limit")
                        break
                    case MemoryMethod.Top:
                        a("top")
                        break
                }
                break
            case LastKind.ArrayLiteral:
                const values = node.values
                if (Array.isArray(values))
                    list("[", "]", false, values, expression)
                else {
                    a("[")
                    a(values.join(", "))
                    a("]")
                }
                break
            case LastKind.StructLiteral:
                list("[", "]", false, node.fields, field => {
                    i(field.name)
                    a(": ")
                    expression(field.value)
                })
                break
        }
    }

    function binop(node: Last & Binary) {
        expression(node.left)
        switch (node.kind) {
            case LastKind.Add: a(" + "); break
            case LastKind.Subtract: a(" - "); break
            case LastKind.Multiply: a(" * "); break
            case LastKind.Divide: a(" / "); break
            case LastKind.Remainder: a(" % "); break
            case LastKind.Equal: a(" == "); break
            case LastKind.NotEqual: a(" != "); break
            case LastKind.GreaterThan: a(" > "); break
            case LastKind.GreaterThanEqual: a(" >= "); break
            case LastKind.LessThan: a(" < "); break
            case LastKind.LessThanEqual: a(" <= "); break
            case LastKind.And: a(" && "); break
            case LastKind.Or: a(" || "); break
            case LastKind.BitAnd: a(" & "); break
            case LastKind.BitOr: a(" | "); break
            case LastKind.BitXor: a(" ^ "); break
            case LastKind.BitShl: a(" shl "); break
            case LastKind.BitShr: a(" shr "); break
            case LastKind.BitRotr: a(" rotr "); break
            case LastKind.BitRotl: a(" rotl "); break
            case LastKind.Minimum: a(" min "); break
            case LastKind.Maximum: a(" max "); break
            case LastKind.CopySign: a(" copysign "); break
        }
        expression(node.right)
    }

    function typebinop(node: Last & TypeBinary) {
        expression(node.left)
        switch (node.kind) {
            case LastKind.As: a(" as "); break
            case LastKind.ConvertTo: a(" convertto "); break
            case LastKind.WrapTo: a(" wrapto "); break
            case LastKind.ReinterpretAs: a(" reinterpretas "); break
            case LastKind.TruncateTo: a(" truncateto "); break
        }
        typeExpression(node.right)
    }

    function unop(node: Last & Unary) {
        switch (node.kind) {
            case LastKind.AddressOf: a("&"); break
            case LastKind.Negate: a("-"); break
            case LastKind.Not: a("!"); break
            case LastKind.CountLeadingZeros: a("countleadingzeros "); break
            case LastKind.CountTrailingZeros: a("counttrailingzeros "); break
            case LastKind.CountNonZeros: a("countnonzeros "); break
            case LastKind.AbsoluteValue: a("abs "); break
            case LastKind.SquareRoot: a("sqrt "); break
            case LastKind.Floor: a("floor "); break
            case LastKind.Ceiling: a("ceil "); break
            case LastKind.Truncate: a("trunc "); break
            case LastKind.RoundNearest: a("nearest "); break
        }
        expression(node.target)
    }

    function statement(node: BodyElement) {
        switch(node.kind) {
            case LastKind.Var:
            case LastKind.Let:
            case LastKind.Type:
                convertDeclaration(node)
                break
            case LastKind.Loop:
                a("loop ")
                if (node.name) {
                    i(node.name)
                    a(" ")
                }
                body(node.body)
                break
            case LastKind.Branch:
                a("branch")
                if (node.target) {
                    a(" ")
                    i(node.target)
                }
                break
            case LastKind.BranchIndexed:
                a("branch (")
                expression(node.condition)
                a(")")
                list("", "", false, node.targets, expression)
                a(" else ")
                i(node.else)
                break
            case LastKind.Return:
                a("return")
                if (node.value) {
                    a(" ")
                    expression(node.value)
                }
                break
            case LastKind.Assign:
                expression(node.target)
                a(" = ")
                expression(node.value)
                break
            default:
                 expression(node)
        }
    }

    function a(txt: string) {
        result += txt
    }

    function i(reference: Reference) {
        if (reference.name.match(ident)) {
            a(reference.name)
        } else {
            a("`" + reference.name + "`")
        }
    }

    function level(block: () => void) {
        const prev = indent
        indent += "    "
        block()
        indent = prev
    }

    function nl() {
        result += "\n" + indent
    }
}

const ident = /[a-zA-Z][a-zA-Z0-9]*/