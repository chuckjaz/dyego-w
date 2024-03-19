import * as ast from "../ast"
import * as check from "../types/check"
import * as ir from "./ir"

import { FunctionType, StructType, Type, TypeKind } from "../types/types"
import { Locatable } from "../../last"
import { check as chk, error, required } from "../../utils"
import { IrKind } from "./ir"
import { FunctionLocation } from "../types/check"

export function fromAst(astModule: ast.Module, checkResult: check.CheckResult): ir.Module {
    const data: (check.ValLocation | check.VarLocation)[] = []
    const functions: ir.Function[] = []
    const initializers: ir.Statement[] = []

    let uniquBlockNumber = 0
    let topBlock: string = ""

    for (const declaration of astModule.declarations) {
        if (declaration.kind == ast.Kind.Function) {
            functions.push(convertFunction(declaration))
        } else {
            const irDeclaration = convertStatement(declaration, false)
            if (irDeclaration.kind != IrKind.Nothing) {
                initializers.push(irDeclaration)
            }
            if (irDeclaration.kind == IrKind.Definition) {
                const item = irDeclaration.name.location
                if (item.kind == check.LocationKind.Val || item.kind == check.LocationKind.Var) {
                    data.push(item)
                }
            }
        }
    }

    return {
        kind: IrKind.Module,
        type: voidType,
        functions,
        data,
        initialize: { kind: IrKind.Block, name: uniqueBlockName(), type: voidType, statements: initializers }
    }

    function convertFunction(func: ast.Function): ir.Function {
        const location = required(checkResult.references.get(func.name), func) as FunctionLocation
        const parameters = func.parameters.map(parameter => convertReference(parameter.alias))
        const type = required(checkResult.types.get(func.body), func.body)
        const name = convertReference(func.name, nameOfFunction(func))
        const body = convertBlock(type, func.body, type.kind != TypeKind.Void)
        return {
            ...locationOf(func),
            kind: IrKind.Function,
            type,
            location,
            name,
            parameters,
            body
        }
    }

    function convertExpression(expression: ast.Expression, valueNeeded: boolean): ir.Expression {
        const type = required(checkResult.types.get(expression), expression)
        switch (expression.kind) {
            case ast.Kind.ArrayLiteral:
                return {
                    ...locationOf(expression),
                    kind: IrKind.ArrayLiteral,
                    type,
                    values: expression.values.map(value => convertExpression(value, true))
                }
            case ast.Kind.As:
                return convertExpression(expression.left, valueNeeded)
            case ast.Kind.Assign:
                if (valueNeeded)
                    return convertAssignExpression(expression)
                else
                    return {
                        ...locationOf(expression),
                        kind: IrKind.Block,
                        type: voidType,
                        name: uniqueBlockName(),
                        statements: [convertAssignStatment(expression)]
                    }
            case ast.Kind.Block:
                return convertBlock(type, expression, valueNeeded)
            case ast.Kind.Call:
                return convertCall(type, expression)
            case ast.Kind.If:
                return {
                    ...locationOf(expression),
                    kind: IrKind.If,
                    type,
                    condition: convertExpression(expression.condition, true),
                    then: convertBlock(type, expression.then, valueNeeded),
                    else: convertBlock(type, expression.else, valueNeeded)
                }
            case ast.Kind.Index:
                return {
                    ...locationOf(expression),
                    kind: IrKind.Index,
                    type,
                    target: convertExpression(expression.target, true),
                    index: convertExpression(expression.index, true)
                }
            case ast.Kind.Lambda:
                error("Not supported yet", expression)
            case ast.Kind.Literal:
                return {
                    ...locationOf(expression),
                    kind: IrKind.Literal,
                    type,
                    value: expression
                }
            case ast.Kind.Range:
                const start = convertExpressionOrNothing(expression.left)
                const end = convertExpressionOrNothing(expression.right)
                return {
                    ...locationOf(expression),
                    kind: IrKind.StructLiteral,
                    type,
                    fields: [ syntheticField("start", start), syntheticField("end", end) ]
                }
            case ast.Kind.Reference:
                return convertReference(expression, undefined, type)
            case ast.Kind.Select: {
                const name = convertExpression(expression.name, true) as ir.Reference
                return {
                    ...locationOf(expression),
                    kind: IrKind.Select,
                    type,
                    target: convertExpression(expression.target, true),
                    name
                }
            }
            case ast.Kind.StructLiteral:
                return convertStructLiteral(type, expression)
            case ast.Kind.When:
                return convertWhen(type, expression)
        }
    }

    function convertAssignExpression(expression: ast.Assign): ir.Block {
        const target = convertExpression(expression.target, true)
        const value = convertExpression(expression.value, true)

        if (isSimple(expression.value)) {
            const assign: ir.Assign = {
                kind: IrKind.Assign,
                type: voidType,
                target,
                value
            }
            return {
                ...locationOf(expression),
                kind: IrKind.Block,
                name: uniqueBlockName(),
                type: value.type,
                statements: [ assign, value ]
            }
        }

        const location: check.ValLocation = {
            kind: check.LocationKind.Val,
            type: target.type
        }
        const name: ir.Reference = {
            kind: IrKind.Reference,
            type: location.type,
            name: "tmp",
            location
        }
        const definition: ir.Definition = {
            kind: IrKind.Definition,
            type: location.type,
            name
        }
        const assignTmp: ir.Assign = {
            kind: IrKind.Assign,
            type: voidType,
            target: name,
            value
        }
        const assign: ir.Assign = {
            kind: IrKind.Assign,
            type: voidType,
            target,
            value: name
        }
        return {
            ...locationOf(expression),
            kind: IrKind.Block,
            type: location.type,
            name: uniqueBlockName(),
            statements: [ definition, assignTmp, assign, name ]
        }
    }

    function convertAssignStatment(expression: ast.Assign): ir.Assign {
        const target = convertExpression(expression.target, true)
        const value = convertExpression(expression.value, true)
        return {
            ...locationOf(expression),
            kind: IrKind.Assign,
            type: voidType,
            target,
            value
        }
    }

    function convertStatement(statement: ast.Statement, valueNeeded: boolean): ir.Statement {
        switch (statement.kind) {
            case ast.Kind.Var:
            case ast.Kind.Val:
                if (statement.value) {
                    const target = convertReference(statement.name, undefined, voidType)
                    const value = convertExpression(statement.value, true)
                    return {
                        ...locationOf(statement),
                        kind: IrKind.Assign,
                        type: voidType,
                        target,
                        value
                    }
                }
                return nothing()
            case ast.Kind.Function:
            case ast.Kind.TypeDeclaration:
            case ast.Kind.Let:
                return nothing()
            case ast.Kind.For:
                return convertFor(statement)
            case ast.Kind.Break:
                return {
                    ...locationOf(statement),
                    kind: IrKind.Break,
                    type: voidType,
                    target: statement.target?.name ?? topBlock
                }
            case ast.Kind.Continue:
                return {
                    ...locationOf(statement),
                    kind: IrKind.Continue,
                    type: voidType,
                    target: statement.target?.name ?? topBlock
                }
            case ast.Kind.While:
                const [name, body] = namedBlock(statement, () => convertBlock(voidType, statement.body, false))
                return {
                    ...locationOf(statement),
                    kind: IrKind.While,
                    type: voidType,
                    name,
                    condition: convertExpression(statement.condition, true),
                    body
                }
            case ast.Kind.Return:
                return {
                    ...locationOf(statement),
                    kind: IrKind.Return,
                    type: voidType,
                    value: convertExpressionOrNothing(statement.value)
                }
            default:
                return convertExpression(statement, valueNeeded)
        }
    }

    function convertBlock(type: Type, expression: ast.Block, valueNeeded: boolean): ir.Block {
        const astStatements = expression.statements
        const len = astStatements.length;
        const end = valueNeeded ? len - 2 : len - 1
        const [name, irStatements] = namedBlock(expression, () => {
            const irStatements: ir.Statement[] = []
            for (let i = 0; i < end; i++) {
                const statement = astStatements[i]
                const irStatement = convertStatement(statement, false)
                if (irStatement.kind != IrKind.Nothing)
                    irStatements.push(irStatement)
            }
            if (len > 0) {
                irStatements.push(convertStatement(astStatements[len - 1], true))
            }
            return irStatements
        })
        return {
            ...locationOf(expression),
            kind: IrKind.Block,
            type,
            name,
            statements: irStatements
        }
    }

    function convertCall(type: Type, expression: ast.Call): ir.Expression {
        const originalTarget = expression.target
        let target = convertExpression(originalTarget, true)
        const targetType = target.type
        chk(targetType.kind == TypeKind.Function, "Required a function type", expression)
        const callType = targetType as FunctionType
        const args: ir.Expression[] = []
        const isComplex: boolean[] = []
        const parameters = callType.parameters
        const statements: ir.Statement[] = []

        function needsReorder(index: number): boolean {
            for (let i = 0; i < index; i++) if (isComplex[i]) return true
            return false
        }

        function expectedPosition() {
            for (let i = 0; i < args.length; i++) if (!args[i]) return i
            return args.length
        }

        function tmpFor(value: ir.Expression): ir.Reference {
            const type = value.type
            const location: check.VarLocation = {
                kind: check.LocationKind.Var,
                type: value.type
            }
            const name: ir.Reference = {
                kind: IrKind.Reference,
                type,
                name: "tmp",
                location
            }
            const definition: ir.Definition = {
                kind: IrKind.Definition,
                type: voidType,
                name
            }
            const init: ir.Assign = {
                kind: IrKind.Assign,
                type: voidType,
                target: name,
                value

            }
            statements.push(definition)
            statements.push(init)
            return name
        }

        for (const argument of expression.arguments) {
            const value = convertExpression(argument.value, true)
            const name = argument.name ? argument.name.name : expectedPosition().toString()
            const index = required(parameters.order(name), argument)
            isComplex[index] = !isSimple(argument.value)
            if (needsReorder(index) && isComplex[index]) {
                args[index] = tmpFor(value)
            } else {
                args[index] = value
            }
        }

        if (target.kind == IrKind.Select) {
            args.unshift(target.target)
            target = target.name
        }

        const call: ir.Call = {
            ...locationOf(expression),
            kind: IrKind.Call,
            type,
            target,
            args
        }
        if (statements.length) {
            return {
                ...locationOf(expression),
                kind: IrKind.Block,
                name: uniqueBlockName(),
                type,
                statements
            }
        } else {
            return call
        }
    }

    function convertReference(
        expression: ast.Reference,
        name?: string,
        type?: Type
    ): ir.Reference {
        const t = type ?? required(checkResult.types.get(expression), expression)
        const location = required(checkResult.references.get(expression), expression)
        return {
            ...locationOf(expression),
            kind: IrKind.Reference,
            type: t,
            name: name ?? expression.name,
            location
        }
    }

    function convertStructLiteral(type_: Type, expression: ast.StructLiteral): ir.Expression {
        const fields: ir.FieldLiteral[] = []
        const type = type_ as StructType
        const isComplex: boolean[] = []
        const statements: ir.Statement[] = []

        function needsReorder(index: number): boolean {
            for (let i = 0; i < index; i++) if (isComplex[i]) return true
            return false
        }

        function tmpFor(value: ir.Expression): ir.Reference {
            const type = value.type
            const location: check.VarLocation = {
                kind: check.LocationKind.Var,
                type: value.type
            }
            const name: ir.Reference = {
                kind: IrKind.Reference,
                type,
                name: "tmp",
                location
            }
            const definition: ir.Definition = {
                kind: IrKind.Definition,
                type: voidType,
                name
            }
            const init: ir.Assign = {
                kind: IrKind.Assign,
                type: voidType,
                target: name,
                value

            }
            statements.push(definition)
            statements.push(init)
            return name
        }

        // Names need to be in the order they appear in the type declaration
        const typeFields = type.fields
        for (const field of expression.fields) {
            const name = convertReference(field.name)
            let value = convertExpression(field.value, true)
            const index = required(typeFields.order(name.name), field)
            isComplex[index] = !isSimple(field.value)
            if (needsReorder(index) && isComplex[index]) {
                value = tmpFor(value)
            }
            fields[index] = {
                kind: IrKind.FieldLiteral,
                type: voidType,
                name,
                value
            }
        }
        fields.forEach(field => required(field, expression))
        return {
            ...locationOf(expression),
            kind: IrKind.StructLiteral,
            type,
            fields
        }
    }

    function convertWhen(type: Type, expression: ast.When): ir.Expression {
        error("not supported yet", expression)
    }

    function convertFor(statement: ast.For): ir.For {
        error("not supported yet", statement)
    }

    function uniqueBlockName(): string {
        return `block_${uniquBlockNumber++}`
    }
    function dup<N extends ir.Reference | ir.Literal>(node: N): N {
        return { ...node }
    }

    function nothing(): ir.Nothing {
        return {
            kind: IrKind.Nothing,
            type: voidType
        }
    }

    function convertExpressionOrNothing(expression: ast.Expression | undefined): ir.Expression {
        if (expression !== undefined)
            return convertExpression(expression, true)
        return nothing()
    }

    function isSimple(expression: ast.Expression): boolean {
        switch (expression.kind) {
            case ast.Kind.Reference:
            case ast.Kind.Literal:
                return true
        }
        return false
    }

    function syntheticField(name: string, value: ir.Expression): ir.FieldLiteral {
        const location: check.ValLocation = {
            kind: check.LocationKind.Val,
            type: value.type
        }
        const irRef: ir.Reference = {
            kind: IrKind.Reference,
            type: value.type,
            location,
            name,
        }
        return {
            kind: IrKind.FieldLiteral,
            type: voidType,
            name: irRef,
            value
        }
    }

    function namedBlock<R>(node: { name?: ast.Reference }, block: () => R): [string, R] {
        const name = node.name?.name ?? uniqueBlockName()
        const oldTopBlock = topBlock
        topBlock = name
        const result = block()
        topBlock = oldTopBlock
        return [name, result]
    }
}

function locationOf(locatable: Locatable): Locatable {
    return { start: locatable.start, end: locatable.end }
}

const voidType: Type = { kind: TypeKind.Void }

function nameOfFunction(func: ast.Function): string {
    let params = ""
    let positionalParameters = 0
    for (const parameter of func.parameters) {
        if (typeof parameter.name == 'number') {
            positionalParameters++
        } else {
            params += `/${parameter.name.name}`
        }
    }
    if (positionalParameters) {
        params += `/${positionalParameters}`
    }
    return `${func.name.name}${params}`
}
