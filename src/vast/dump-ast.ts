import { ArgumentModifier, Expression, FieldLiteralModifier, Function, ImplicitVal, Kind, Module, Parameter, ParameterModifier, Reference, Statement, StructTypeConstuctorFieldModifier, TypeExpression, Val, Var } from "./ast";

export function dump(item: Module | Statement): string {
    let result = ""
    let linePrefix = ""
    let first = false

    switch (item.kind) {
        case Kind.Module: dumpModule(item); break
        default: dumpStatement(item); break
    }
    return result

    function dumpModule(module: Module) {
        module.declarations.forEach(dumpStatement)
    }

    function dumpStatement(statement: Statement) {
        switch (statement.kind) {
            case Kind.Function:
                dumpFunction(statement)
                break
            case Kind.Let:
                emit("let ")
                dumpExpression(statement.name)
                emit(": ")
                dumpTypeExpression(statement.type)
                emit(" = ")
                dumpExpression(statement.value)
                break
            case Kind.Val:
                emit("val ")
                dumpExpression(statement.name)
                emit(": ")
                dumpTypeExpression(statement.type)
                emit(" = ")
                dumpExpression(statement.value)
                break
            case Kind.Var:
                emit("var ")
                dumpExpression(statement.name)
                emit(": ")
                dumpTypeExpression(statement.type)
                if (statement.value) {
                    emit(" = ")
                    dumpExpression(statement.value)
                }
                break
            case Kind.TypeDeclaration:
                emit("type ")
                dumpExpression(statement.name)
                emit(" = ")
                dumpTypeExpression(statement.type)
                break
            case Kind.Break:
                emit("break")
                if (statement.target) {
                    emit(" ")
                    dumpExpression(statement.target)
                }
                break
            case Kind.Continue:
                emit("break")
                if (statement.target) {
                    emit(" ")
                    dumpExpression(statement.target)
                }
                break
            case Kind.For:
                emit("for (")
                dumpForItem(statement.item)
                if (statement.index) {
                    emit(", ")
                    dumpForItem(statement.index)
                }
                emit(" in ")
                dumpExpression(statement.target)
                emit(")")
                dumpExpression(statement.body)
                break
            case Kind.Return:
                emit("return ")
                if (statement.value) {
                    emit(" ")
                    dumpExpression(statement.value)
                }
                break
            case Kind.While:
                emit("while (")
                dumpExpression(statement.condition)
                emit(") ")
                dumpExpression(statement.body)
                break
            case Kind.When:
                emit("when ")
                if (statement.target) {
                    emit("(")
                    dumpStatement(statement.target)
                    emit(") ")
                }
                emit("{")
                indent(() => {
                    statement.clauses.forEach(clause => {
                        const condition = clause.condition
                        switch (condition.kind) {
                            case Kind.IsCondition:
                                emit("is ")
                                dumpTypeExpression(condition.target)
                                break
                            case Kind.ElseCondition:
                                emit("else")
                                break
                            default:
                                dumpExpression(condition)
                                break
                        }
                        emit(" -> ")
                        dumpExpression(clause.body)
                    })
                })
                emit("}")
                break
            default:
                dumpExpression(statement)
        }
        nl()
    }

    function dumpForItem(item: ImplicitVal | Var) {
        switch (item.kind) {
            case Kind.ImplicitVal:
                dumpExpression(item.name)
                if (item.type.kind != Kind.Infer) {
                    emit(": ")
                    dumpTypeExpression(item.type)
                }
                break
            case Kind.Var: {
                emit("var ")
                dumpExpression(item.name)
                if (item.type.kind != Kind.Infer) {
                    emit(": ")
                    dumpTypeExpression(item.type)
                }
                break
            }
        }
    }

    function dumpFunction(func: Function) {
        emit("fun ")
        dumpExpression(func.name)
        emit("(")
        commas(func.parameters, dumpParameter)
        emit("): ")
        dumpTypeExpression(func.result)
        emit(" ")
        dumpExpression(func.body)
    }

    function dumpParameter(parameter: Parameter) {
        if (parameter.modifier & ParameterModifier.Var) {
            emit("var ")
        }
        if (parameter.modifier & ParameterModifier.Context) {
            emit("context ")
        }
        if (typeof parameter.name == 'number') {
            emit("_")
        } else {
            dumpExpression(parameter.name)
        }
        if (parameter.alias != parameter.name) {
            emit(" ")
            dumpExpression(parameter.alias)
        }
        emit(": ")
        dumpTypeExpression(parameter.type)
    }

    function dumpTypeExpression(type: TypeExpression) {
        switch (type.kind) {
            case Kind.ArrayTypeConstructor:
                dumpTypeExpression(type.element)
                emit("[")
                if (type.size) {
                    dumpExpression(type.size)
                }
                emit("]")
                break
            case Kind.FunctionType:
                emit("{ ")
                commas(type.parameters, dumpParameter)
                emit(" }: ")
                dumpTypeExpression(type.result)
                break
            case Kind.Infer:
                emit("infer")
                break
            case Kind.StructTypeConstructor:
                emit("[")
                nl()
                indent(() => {
                    type.fields.forEach(f => {
                        if (f.modifier & StructTypeConstuctorFieldModifier.Var) {
                            emit("var ")
                        }
                        dumpExpression(f.name)
                        emit(": ")
                        dumpTypeExpression(f.type)
                        nl()
                    })
                    type.methods.forEach(f => {
                        dumpFunction(f)
                        nl()
                    })
                    type.types.forEach(f => {
                        dumpStatement(f)
                        nl()
                    })
                })
                break
            case Kind.TypeSelect:
                dumpTypeExpression(type.target)
                emit(".")
                dumpExpression(type.name)
                break
            case Kind.Reference:
                emit(type.name)
                break
        }
    }

    function dumpExpression(expression: Expression) {
        switch (expression.kind) {
            case Kind.ArrayLiteral:
                emit("[")
                commas(expression.values, dumpExpression)
                emit("]")
                return
            case Kind.As:
                dumpExpression(expression.left)
                emit(" as ")
                dumpTypeExpression(expression.right)
                return
            case Kind.Assign:
                dumpExpression(expression.target)
                emit(" = ")
                dumpExpression(expression.value)
                return
            case Kind.Block:
                emit("{")
                nl()
                indent(() => {
                    expression.statements.forEach(dumpStatement)
                })
                emit("}")
                return
            case Kind.Call:
                dumpExpression(expression.target)
                emit("(")
                commas(expression.arguments, arg => {
                    if (arg.modifier & ArgumentModifier.Var) {
                        emit("var ")
                    }
                    if (arg.name) {
                        dumpExpression(arg.name)
                        emit(": ")
                    }
                    dumpExpression(arg.value)
                })
                emit(")")
                return
            case Kind.If:
                emit("if (")
                dumpExpression(expression.condition)
                emit(") ")
                dumpExpression(expression.then)
                emit(" else ")
                dumpExpression(expression.else)
                return
            case Kind.Index:
                dumpExpression(expression.target)
                emit("[")
                dumpExpression(expression.index)
                emit("]")
                return
            case Kind.Lambda:
                emit("{ ")
                commas(expression.parameters, dumpParameter)
                emit("->")
                nl()
                indent(() => {
                    expression.body.statements.forEach(dumpStatement)
                })
                emit("}: ")
                dumpTypeExpression(expression.result)
                return
            case Kind.Literal:
                emit(`${expression.value}`)
                return
            case Kind.Reference:
                emit(expression.name)
                return
            case Kind.Select:
                dumpExpression(expression.target)
                emit(".")
                dumpExpression(expression.name)
                return
            case Kind.StructLiteral:
                emit("[")
                commas(expression.fields, f => {
                    if (f.modifier & FieldLiteralModifier.Var) {
                        emit("var ")
                    }
                    dumpExpression(f.name)
                    emit(": ")
                    dumpExpression(f.value)
                })
                emit("]")
                return
            case Kind.Range:
                if (expression.left) dumpExpression(expression.left)
                emit("..")
                if (expression.right) dumpExpression(expression.right)
                return
            case Kind.When:
                emit("when")
                const target = expression.target
                if (target) {
                    emit("(")
                    dumpStatement(target)
                    emit(")")
                }
                emit(" {")
                nl()
                indent(() => {
                    for (const clause of expression.clauses) {
                        switch (clause.condition.kind) {
                            case Kind.IsCondition:
                                emit("is ")
                                dumpTypeExpression(clause.condition.target)
                                break
                            case Kind.ElseCondition:
                                emit("else")
                                break
                            default:
                                dumpExpression(clause.condition)
                                break
                        }
                        emit(" -> ")
                        dumpStatement(clause.body)
                        nl()
                    }
                })
                nl()
                return
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
        linePrefix += "  "
        content()
        linePrefix = prefix
    }

    function commas<T>(items: T[], content: (item: T) => void) {
        let first = true
        for (const item of items) {
            if (!first) emit(", ")
            first = false
            content(item)
        }
    }
}