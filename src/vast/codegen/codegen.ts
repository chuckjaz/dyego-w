import { ArrayLiteral, As, Assign, Block, Break, Call, Continue, Declaration, ElseCondition, Expression, FieldLiteral, For, Function, If, Index, Kind, Let, Literal, Module, Parameter, PrimitiveKind, Range, Reference, Return, Select, Statement, StructLiteral, TypeDeclaration, Val, Var, When, While } from "../ast";
import { error, required } from "../../utils";
import { CheckResult, FunctionLocation, Location, LocationKind } from "../types/check";

import * as last from "../../last"
import * as types from '../types/types'
import { LastKind } from "../../last";
import { Type, TypeKind } from "../types/types";

export function codegen(module: Module, checkResult: CheckResult): last.Module {
    const importNode: last.Import = {
        kind: LastKind.Import,
        imports: []
    }
    const imports: last.Import[] = [importNode]
    const declarations: last.Declaration[] = []
    const typeMap = new Map<types.Type, string>()
    const names = new Set<string>()
    const locationNames = new Map<Location, string>()
    const breakNames: string[][] = []
    const continueNames: string[][] = []
    const importMap = new Map<string, Map<string, string>>()
    const typeFunctions = new Map<types.Type, TypeFunctions>()

    let blockPrefix: last.BodyElement[] = []

    convertModule(module)

    return {
        kind: last.LastKind.Module,
        imports,
        declarations
    }

    function convertModule(module: Module) {
        module.declarations.forEach(convertDeclaration)
    }

    function convertDeclaration(declaration: Declaration) {
        switch (declaration.kind) {
            case Kind.Function:
                convertFunction(declaration)
                return
            case Kind.Let:
            case Kind.TypeDeclaration:
                return
            case Kind.Val:
                convertValDeclaration(declaration)
                return
            case Kind.Var:
                convertVarDeclaration(declaration)
                return
        }
    }

    function convertFunction(func: Function) {
        const name = nameOfFunction(func)
        const functionType = required(checkResult.types.get(func.name), func.name) as types.FunctionType
        const parameters = functionType.parameters
        const lastParameters: last.Parameter[] = []

        parameters.forEach((name, parameter) => {
            const parameterName = uniqueName(name)
            const parameterNode = required(parameter.node, func)
            const location = required(checkResult.references.get(parameterNode.alias), parameterNode)
            locationNames.set(location, parameterName)
            const ref = convertToReference(parameterNode.alias, parameterName)
            lastParameters.push({
                kind: LastKind.Parameter,
                name: ref,
                type: convertType(parameter.type)
            })
        })

        const lastResult = convertType(functionType.result)
        const body = convertExpression(func.body, true)
        const nameReference = convertToReference(func.name, name)
        const lastFunction: last.Function = {
            kind: LastKind.Function,
            name: nameReference,
            parameters: lastParameters,
            result: lastResult,
            body: [body]
        }
        const location = required(checkResult.references.get(func.name), func) as FunctionLocation
        if (location.exported) {
            declarations.push({
                kind: LastKind.Exported,
                target: lastFunction
            })
        } else {
            declarations.push(lastFunction)
        }
        locationNames.set(location, name)
    }

    function convertValDeclaration(valDeclaration: Val): last.BodyElement {
        const location = required(checkResult.references.get(valDeclaration.name), valDeclaration)
        assert(location.kind == LocationKind.Val, valDeclaration)
        const name = uniqueName(valDeclaration.name.name)
        const value = convertExpression(valDeclaration.value, true)
        locationNames.set(location, name)
        return {
            ...locOf(valDeclaration),
            kind: LastKind.Var,
            name: ref(name),
            value
        }
    }

    function convertVarDeclaration(varDeclaration: Var): last.Var {
        const location = required(checkResult.references.get(varDeclaration.name), varDeclaration)
        assert(location.kind == LocationKind.Var, varDeclaration)
        const name = uniqueName(varDeclaration.name.name)
        const value = varDeclaration.value != undefined ? convertExpression(varDeclaration.value, true) : undefined
        locationNames.set(location, name)
        return {
            ...locOf(varDeclaration),
            kind: LastKind.Var,
            name: ref(name),
            value
        }
    }

    function convertExpression(expression: Expression, valueRequired: boolean): last.Expression {
        function convert(): last.Expression {
            switch (expression.kind) {
                case Kind.ArrayLiteral:
                    return convertArrayLiteral(expression)
                case Kind.As:
                    return convertAs(expression)
                case Kind.Reference:
                    return convertReference(expression)
                case Kind.Assign:
                    return convertAssign(expression, valueRequired)
                case Kind.Block:
                    return convertBlock(expression)
                case Kind.Call:
                    return convertCall(expression)
                case Kind.If:
                    return convertIf(expression)
                case Kind.Index:
                    return convertIndex(expression)
                case Kind.Lambda:
                    error("Lambdas not supported yet", expression)
                case Kind.Literal:
                    return convertLiteral(expression)
                case Kind.Range:
                    return convertRange(expression)
                case Kind.Select:
                    return convertSelect(expression)
                case Kind.StructLiteral:
                    return convertStructLiteral(expression)
                case Kind.When:
                    return convertWhen(expression)
            }
            expression
        }

        const previous = blockPrefix
        blockPrefix = []
        const result = convert()
        if (blockPrefix.length == 0) {
            return result
        }
        if (result.kind == LastKind.Block) {
            return {
                kind: LastKind.Block,
                body: [...blockPrefix, ...result.body]
            }
        }
        return {
            kind: LastKind.Block,
            body: [...blockPrefix, result]
        }
    }

    function convertArrayLiteral(literal: ArrayLiteral): last.Expression {
        const values = literal.values.map(v => convertExpression(v, true))
        return {
            kind: LastKind.ArrayLiteral,
            values
        }
    }

    function convertLiteral(literal: Literal): last.Expression {
        const value = literal.value
        const primitiveKind = convertPrimitiveKind(literal.primitiveKind)
        if (primitiveKind === undefined) error("Literal kind not supported", literal)
        if (typeof value == "string") error("String not supported", literal)
        return {
            ...locOf(literal),
            kind: LastKind.Literal,
            primitiveKind,
            value
        } as last.Literal
    }

    function convertRange(expression: Range): last.Expression {
        return {
            ...locOf(expression),
            kind: LastKind.StructLiteral,
            fields: [
                {
                    kind: LastKind.Field,
                    name: ref("start"),
                    value: convertExpression(required(expression.left, expression), true)
                },
                {
                    kind: LastKind.Field,
                    name: ref("end"),
                    value: convertExpression(required(expression.right, expression), true)
                }
            ]
        }
    }

    function convertSelect(expression: Select): last.Expression {
        return {
            ...locOf(expression),
            kind: LastKind.Select,
            target: convertExpression(expression.target, true),
            name: setLoc(ref(expression.name.name), expression.name)
        }
    }

    function convertStructLiteral(expression: StructLiteral): last.Expression {
        const fields = expression.fields.map(convertField)
        return {
            ...locOf(expression),
            kind: LastKind.StructLiteral,
            fields
        }
    }

    function convertField(field: FieldLiteral): last.Field {
        return {
            ...locOf(field),
            kind: LastKind.Field,
            name: convertReference(field.name),
            value: convertExpression(field.value, true)
        }
    }

    function convertWhen(expression: When): last.Expression {
        let firstIf: last.IfThenElse | undefined = undefined
        let lastElseBody: last.BodyElement[] = []
        let elseBlock: Block | undefined = undefined
        const body: last.BodyElement[] = []
        const target = expression.target
        let targetName = ''
        if (target) {
            switch (target.kind) {
                case Kind.Val:
                case Kind.Var:
                    targetName = uniqueName(target.name.name)
                    body.push({
                        ...locOf(target),
                        kind: LastKind.Var,
                        name: ref(targetName),
                        value: convertExpression(required(target.value, target), true)
                    })
                    const location = required(checkResult.references.get(target.name), target)
                    locationNames.set(location, targetName)
                    break
                default:
                    targetName = uniqueName("value")
                    body.push({
                        ...locOf(target),
                        kind: LastKind.Var,
                        name: ref(targetName),
                        value: convertExpression(required(target, target), true)
                    })
                    break
            }
        }
        for (const clause of expression.clauses) {
            const condition = clause.condition
            switch (condition.kind) {
                case Kind.IsCondition:
                    error("Is condition not supported yet", condition)
                case Kind.ElseCondition:
                    elseBlock = clause.body
                    break
                default:
                    let value = convertExpression(condition, true)
                    if (target) {
                        value = lastEqual(value, ref(targetName))
                    }
                    const elseBody: last.BodyElement[] = []
                    const ifExpression = lastIf(value, [convertExpression(clause.body, true)], elseBody)
                    lastElseBody.push(ifExpression)
                    if (firstIf == undefined) firstIf = ifExpression
                    lastElseBody = elseBody
                    break
            }
        }
        if (elseBlock) {
            const value = convertExpression(elseBlock, true)
            lastElseBody.push(value)
        }
        return firstIf ?? { kind: LastKind.Block, body: lastElseBody }
    }

    function convertPrimitiveKind(kind: PrimitiveKind): last.PrimitiveKind | undefined {
        switch (kind) {
            case PrimitiveKind.I8: return last.PrimitiveKind.I8
            case PrimitiveKind.I16: return last.PrimitiveKind.I16
            case PrimitiveKind.I32: return last.PrimitiveKind.I32
            case PrimitiveKind.I64: return last.PrimitiveKind.I64
            case PrimitiveKind.U8: return last.PrimitiveKind.U8
            case PrimitiveKind.U16: return last.PrimitiveKind.U16
            case PrimitiveKind.U32: return last.PrimitiveKind.U32
            case PrimitiveKind.U64: return last.PrimitiveKind.U64
            case PrimitiveKind.F32: return last.PrimitiveKind.F32
            case PrimitiveKind.F64: return last.PrimitiveKind.F64
            case PrimitiveKind.Bool: return last.PrimitiveKind.Bool
        }
        return undefined
    }

    function convertAs(expression: As): last.Expression {
        todo("As not supported yet", expression)
    }

    function convertAssign(expression: Assign, valueRequired: boolean): last.Expression {
        const type = required(checkResult.types.get(expression), expression)
        const target = convertExpression(expression.target, true)
        const value = convertExpression(expression.value, true)
        if (type.kind != TypeKind.Slice) {
            if (valueRequired) {
                const tmpName = uniqueName("tmp")
                return lastBlock(lastVar(ref(tmpName), target), lastAssign(target, value), ref(tmpName))
            }
            return lastBlock(lastAssign(target, value))
        }
        const targetName = target.kind == LastKind.Reference ? target: ref(uniqueName("target"))
        const valueName = ref(uniqueName("value"))
        const funcs = typeFunctionsOf(type)
        return lastBlock(
            target.kind == LastKind.Reference ? undefined : lastVar(targetName, target),
            lastVar(valueName, funcs.copy(value)),
            funcs.release(targetName),
            lastAssign(targetName, valueName),
            valueName
        )
    }

    function convertBlock(block: Block): last.Block {
        const body = block.statements.map(convertStatement).flat()
        return {
            ...locOf(block),
            kind: LastKind.Block,
            body
        }
    }

    function convertCall(call: Call): last.Expression {
        const args = call.arguments.map(param => convertExpression(param.value, true))
        const originalTarget = call.target
        const target = convertExpression(originalTarget, true)
        if (originalTarget.kind == Kind.Select && target.kind == LastKind.Select) {
            // Add the `this` parameter
            args.unshift(target.target)

            // Check for intrinsics
            const location = checkResult.references.get(originalTarget.name)
            if (location != undefined) {
                if (location.kind == LocationKind.Function) {
                    if (location.func.modifier & types.FunctionModifier.Intrinsic) {
                        return intrinsic(location.func, call, args)
                    }
                }
            }
        }
        const type = required(checkResult.types.get(originalTarget), call)
        if (type.kind != TypeKind.Function) {
            error("Expected a function", call)
        }
        return {
            ...locOf(call),
            kind: LastKind.Call,
            target,
            arguments: args
        }
    }

    function convertIf(expression: If): last.IfThenElse {
        const condition = convertExpression(expression.condition, true)
        const thenClause = convertBlock(expression.then)
        const elseClause = convertBlock(expression.then)
        return {
            ...locOf(expression),
            kind: LastKind.IfThenElse,
            condition,
            then: thenClause.body,
            else: elseClause.body
        }
    }

    function convertIndex(expression: Index): last.Expression {
        const type = required(checkResult.types.get(expression), expression)
        const target = convertExpression(expression.target, true)
        const index = convertExpression(expression.index, true)
        switch (type.kind) {
            case TypeKind.Array:
            case TypeKind.String:
                return lastIndex(target, index)
            case TypeKind.Slice:
                return lastIndex(
                    lastSelect(target, "buffer"),
                    lastAdd(lastSelect(target, "offset"), index)
                )
        }
        error(`Unexpected type: ${types.nameOfTypeKind(type.kind)}`, expression)
    }

    function convertStatement(statement: Statement): last.BodyElement[] {
        switch (statement.kind) {
            case Kind.Function:
                error("Unsupported", statement)
            case Kind.Let:
            case Kind.TypeDeclaration:
                // Nothing to do.
                return []
            case Kind.Var:
                return [convertVarDeclaration(statement)]
            case Kind.Val:
                return [convertValDeclaration(statement)]
            case Kind.For:
                return convertFor(statement)
            case Kind.Break:
                return convertBreak(statement)
            case Kind.Continue:
                return convertContinue(statement)
            case Kind.Return:
                return convertReturn(statement)
            case Kind.While:
                return convertWhile(statement)
            default:
                return [convertExpression(statement, false)]
        }
        statement
        return []
    }

    function convertFor(forStatement: For): last.BodyElement[] {
        const target = convertExpression(forStatement.target, true)
        const results: last.BodyElement[] = []
        const targetType = required(checkResult.types.get(forStatement.target), forStatement)
        const itemName = uniqueName(forStatement.item.name.name)
        const itemLocation = required(checkResult.references.get(forStatement.item.name), forStatement.item.name)
        locationNames.set(itemLocation, itemName)
        const forTarget = uniqueName("target")
        results.push({
            ...locOf(forStatement.target),
            kind: LastKind.Var,
            name: ref(forTarget),
            value: target
        })
        results.push({
            ...locOf(forStatement.item),
            kind: LastKind.Var,
            name: ref(itemName),
        })
        const block = convertBlock(forStatement.body)
        const forStatementName = uniqueName("for")
        const forLoopName = uniqueName("loop")
        const kind = targetType.kind
        const forName = forStatement.name
        if (forName) {
            breakNames.push([forName.name, forStatementName])
            continueNames.push([forName.name, forLoopName])
        } else {
            breakNames.push(['', forStatementName])
            continueNames.push(['', forLoopName])
        }
        switch (kind) {
            case TypeKind.Range: {
                results.push({
                    kind: LastKind.Assign,
                    target: ref(itemName),
                    value: lastSelect(ref(forTarget), "start")
                })
                results.push(
                    lastNamedBlock(
                        forStatementName,
                        lastNamedLoop(
                            forLoopName,
                            lastIf(lastGte(ref(itemName), lastSelect(ref(forTarget), "end")), [
                                lastBranch(ref(forStatementName))
                            ], []),
                            block,
                            lastAssign(ref(itemName), lastAdd(ref(itemName), lastI32(1)))
                        )
                ))
                break
            }
            case TypeKind.Slice:
            case TypeKind.Array: {
                const indexName = uniqueName("index")
                const endName = uniqueName("end")
                results.push({
                    kind: LastKind.Var,
                    name: ref(indexName),
                    value: kind == TypeKind.Array ? lastI32(0) : lastSelect(ref(forTarget), "offset")
                })
                results.push({
                    kind: LastKind.Var,
                    name: ref(endName),
                    value: kind == TypeKind.Array ? lastI32((targetType as types.ArrayType).size) :
                        lastAdd(ref(indexName), lastSelect(ref(forTarget), "length"))
                })
                const forIndex = forStatement.index
                if (forIndex) {
                    const indexLocation = required(checkResult.references.get(forIndex.name), forIndex.name)
                    locationNames.set(indexLocation, indexName)
                }
                results.push(
                    lastNamedBlock(
                        forStatementName,
                        lastNamedLoop(
                            forLoopName,
                            lastIf(lastGte(ref(indexName), ref(endName)), [
                                lastBranch(ref(forStatementName))
                            ], []),
                            lastAssign(ref(itemName), lastIndex(ref(forTarget), ref(indexName))),
                            block
                        )
                    )
                )
                break
            }
        }
        return results
    }

    function convertWhile(statement: While): last.BodyElement[] {
        const whileStatementName = uniqueName("while")
        const whileLoopName = uniqueName("loop")
        const whileName = statement.name?.name ?? ''
        breakNames.push([whileName, whileStatementName])
        continueNames.push([whileName, whileLoopName])
        return [
            setLoc(lastNamedBlock(whileStatementName,
                lastNamedLoop(whileLoopName,
                    lastIf(convertExpression(statement.condition, true), [
                        convertBlock(statement.body)
                    ], [
                        lastBranch(ref(whileStatementName))
                    ])
                )
            ), statement)
        ]
    }

    function convertBreak(statement: Break): last.BodyElement[] {
        const target = statement.target
        const targetName = required(blockName(breakNames, target), statement)
        return [{
            ...locOf(statement),
            kind: LastKind.Branch,
            target: ref(targetName)
        }]
    }

    function convertContinue(statement: Continue): last.BodyElement[] {
        const target = statement.target
        const targetName = required(blockName(continueNames, target), statement)
        return [{
            ...locOf(statement),
            kind: LastKind.Branch,
            target: ref(targetName)
        }]
    }

    function convertReturn(statement: Return): last.BodyElement[] {
        const value = statement.value
        const valueExpr = value ? convertExpression(value, true) : undefined
        return [{
            ...locOf(statement),
            kind: LastKind.Return,
            value: valueExpr
        }]
    }

    function blockName(names: string[][], name?: Reference): string | undefined {
        if (name == undefined) {
            return names[names.length - 1][1]
        }
        for (const [vName, lastName] of names) {
            if (name.name == vName) return lastName
        }
        return undefined
    }

    function convertReference(reference: Reference): last.Reference {
        const location = required(checkResult.references.get(reference), reference) as Location
        const name = required(locationNames.get(location), reference)
        return convertToReference(reference, name)
    }

    function uniqueName(candidate: string): string {
        let name = candidate
        let candidateNumber = 0
        while (names.has(name)) {
            name = `${candidate}$${candidateNumber++}`
        }
        return name
    }

    function convertToReference(reference: Reference, name?: string): last.Reference {
        const result: last.Reference = { ...reference, kind: LastKind.Reference }
        if (name) result.name = name
        return result
    }

    function convertType(type: types.Type): last.TypeExpression {
        switch (type.kind) {
            case TypeKind.Array: {
                const element = convertType(type.element)
                if ('size' in type) {
                    return {
                        kind: LastKind.ArrayConstructor,
                        element,
                        size: type.size
                    }
                } else {
                    return {
                        kind: LastKind.ArrayConstructor,
                        element
                    }
                }
            }
            case TypeKind.Boolean: {
                return {
                    kind: LastKind.Primitive,
                    primitive: last.PrimitiveKind.Bool
                }
            }
            case TypeKind.Char: {
                return {
                    kind: LastKind.Primitive,
                    primitive: last.PrimitiveKind.I32
                }
            }
            case TypeKind.I8: {
                return {
                    kind: LastKind.Primitive,
                    primitive: last.PrimitiveKind.I8
                }
            }
            case TypeKind.I16: {
                return {
                    kind: LastKind.Primitive,
                    primitive: last.PrimitiveKind.I16
                }
            }
            case TypeKind.I32: {
                return {
                    kind: LastKind.Primitive,
                    primitive: last.PrimitiveKind.I32
                }
            }
            case TypeKind.I64: {
                return {
                    kind: LastKind.Primitive,
                    primitive: last.PrimitiveKind.I64
                }
            }
            case TypeKind.U8: {
                return {
                    kind: LastKind.Primitive,
                    primitive: last.PrimitiveKind.U8
                }
            }
            case TypeKind.U16: {
                return {
                    kind: LastKind.Primitive,
                    primitive: last.PrimitiveKind.U16
                }
            }
            case TypeKind.U32: {
                return {
                    kind: LastKind.Primitive,
                    primitive: last.PrimitiveKind.U32
                }
            }
            case TypeKind.U64: {
                return {
                    kind: LastKind.Primitive,
                    primitive: last.PrimitiveKind.U64
                }
            }
            case TypeKind.F32: {
                return {
                    kind: LastKind.Primitive,
                    primitive: last.PrimitiveKind.F32
                }
            }
            case TypeKind.F64: {
                return {
                    kind: LastKind.Primitive,
                    primitive: last.PrimitiveKind.F64
                }
            }
            case TypeKind.Error:
            case TypeKind.Never:
            case TypeKind.Void: {
                return {
                    kind: LastKind.Primitive,
                    primitive: last.PrimitiveKind.Void
                }
            }
            case TypeKind.String:
            case TypeKind.Slice:
                return referenceTo(type, () => {
                    const name = nameOfType(type)
                    declareStruct(name,
                        field("offset", i32()),
                        field("length", i32()),
                        field("capacity", i32()),
                        field("owner", ptr(ptr(lastVoid())))
                    )
                    return name
                })
            case TypeKind.Range:
                return referenceTo(type, () => {
                    const name = nameOfType(type)
                    declareStruct(name,
                        field("start", i32()),
                        field("end", i32())
                    )
                    return name
                })
            case TypeKind.Struct:
                return referenceTo(type, () => {
                    const name = nameOfType(type)
                    const fields = type.fields.map((name, f) => {
                        return field(name, convertType(f.type))
                    })
                    declareStruct(name, ...fields)
                    return name
                })
            case TypeKind.Function:
            case TypeKind.Lambda:
                throw new Error("Lambda not supported yet")
            case TypeKind.Open:
                throw new Error("Open type should have been erased")

        }

        function declareStruct(name: string, ...fields: last.FieldLiteral[]) {
            declareType(name, { kind: LastKind.StructTypeLiteral, fields })
        }

        function declareType(name: string, type: last.TypeExpression) {
            const declaration: last.TypeDeclaration = {
                kind: LastKind.Type,
                name: ref(name),
                type
            }
            declarations.push(declaration)
        }

        function referenceTo(type: Type, producer: () => string): last.Reference {
            let name = typeMap.get(type)
            if (!name) {
                name = producer()
                names.add(name)
                typeMap.set(type, name)
            }
            return ref(name)
        }

        function field(name: string, type: last.TypeExpression): last.FieldLiteral {
            return {
                kind: LastKind.FieldLiteral,
                name: ref(name),
                type
            }
        }

        function i32(): last.TypeExpression {
            return prim(last.PrimitiveKind.I32)
        }

        function prim(primitive: last.PrimitiveKind): last.TypeExpression {
            return { kind: LastKind.Primitive, primitive }
        }

        function ptr(target: last.TypeExpression): last.TypeExpression {
            return {
                kind: LastKind.PointerConstructor,
                target
            }
        }
    }

    function nameOfType(type: types.Type): string {
        switch (type.kind) {
            case TypeKind.Array: {
                const element = nameOfType(type.element)
                const size = 'size' in type ? `#${type.size}` : ''
                return `${element}_array${size}`
            }
            case TypeKind.I8: return 'i8'
            case TypeKind.I16: return 'i16'
            case TypeKind.I32: return 'i32'
            case TypeKind.I64: return 'i64'
            case TypeKind.U8: return 'u8'
            case TypeKind.U16: return 'u16'
            case TypeKind.U32: return 'u32'
            case TypeKind.U64: return 'u64'
            case TypeKind.Boolean: return 'bool'
            case TypeKind.Char: return 'char'
            case TypeKind.F32: return 'f32'
            case TypeKind.F64: return 'f64'
            case TypeKind.String: return 'string'
            case TypeKind.Error:
            case TypeKind.Never:
            case TypeKind.Open:
            case TypeKind.Void: return 'void'
            case TypeKind.Range: return `range_int`
            case TypeKind.Slice: return 'slice'
            case TypeKind.Struct:
                return uniqueName(typeMap.get(type) ?? 'struct')
            case TypeKind.Function:
            case TypeKind.Lambda:
                return uniqueName(funcTypeName(type))

        }

        function funcTypeName(type: types.FunctionType | types.LambdaType): string {
            let result = type.kind == TypeKind.Function ? "function" : "lambda"
            type.parameters.forEach((name, parameter) => {
                if (parameter.position >= 0) {
                    result += `_${name}:`
                } else {
                    result += "_"
                }
                result += nameOfType(parameter.type)
            })
            return result
        }
    }

    function typeFunctionsOf(type: types.Type): TypeFunctions {
        let result = typeFunctions.get(type)
        if (!result) {
            result = createTypeFunctions(type)
            typeFunctions.set(type, result)
        }
        return result
    }

    function createTypeFunctions(type: types.Type): TypeFunctions {
        const lastType = convertType(type)
        const elementTypeName = nameOfType(type)
        const allocate = allocateTypeFunction(lastType, elementTypeName)
        const copy = copyTypeFunction(lastType, elementTypeName)
        const release = releaseTypeFunction(lastType, elementTypeName)
        const unique = uniqueTypeFunction(lastType, elementTypeName)
        return {
            allocate,
            copy,
            release,
            unique
        }
    }

    function allocateTypeFunction(type: last.TypeExpression, name: string): () => last.Expression {
        const allocateName = uniqueName(`${name}_allocate`)
        const systemMalloc = mallocFunc()
        const allocateNameRef = ref(allocateName)
        const allocateFunction = lastFunc(allocateNameRef, [lastParam("size", lastInt())], lastPtr(lastArr(type)),
            lastAs(lastCall(systemMalloc, lastMult(lastSizeOf(type), ref("size"))), lastPtr(lastArr(type)))
        )
        declarations.push(allocateFunction)
        return () => lastCall(allocateNameRef)
    }

    function copyTypeFunction(type: last.TypeExpression, name: string): (expr: last.Expression) => last.Expression {
        const systemCopy = cloneFunc()
        return expr => lastAs(lastCall(systemCopy, lastAs(expr, lastPtr(lastVoid()))), type)
    }

    function releaseTypeFunction(type: last.TypeExpression, name: string): (expr: last.Expression) => last.Expression {
        const systemFree = freeFunc()
        const releaseName = uniqueName(`${name}_release`)
        const tmp = uniqueName("value")
        const releaseFunction = lastFunc(ref(releaseName), [lastParam("value", type)], lastVoid(),
            lastVar(ref(tmp), lastAdd(lastSelect(ref("value"), "refCount"), lastI32(-1))),
            lastAssign(lastSelect(ref("value"), "refCount"), ref(tmp)),
            lastIf(
                lastEqual(ref(tmp), lastI32(0)),
                [lastCall(systemFree, ref("value"))],
                []
            )
        )
        declarations.push(releaseFunction)
        return expr => lastCall(ref(releaseName), expr)
    }

    function uniqueTypeFunction(type: last.TypeExpression, name: string): (expr: last.Expression) => last.Expression {
        const systemClone = cloneFunc()
        const cloneName = uniqueName(`${name}_clone`)
        const cloneFunction = lastFunc(ref(cloneName), [lastParam("value", type)], lastVoid(),
            lastIf(
                lastEqual(lastSelect(ref("value"), "refCount"), lastI32(1)),
                [ref("value")],
                [lastAs(lastCall(systemClone, ref("value")), type)]
            )
        )
        declarations.push(cloneFunction)
        return expr => lastCall(ref(cloneName), expr)
    }

    function importFunction(module: string, name: string, parameters: last.Parameter[], result: last.TypeExpression): last.Reference {
        let moduleMap = importMap.get(module)
        if (!moduleMap) {
            moduleMap = new Map<string, string>()
            importMap.set(module, moduleMap)
        }
        let importName = moduleMap.get(name)
        if (!importName) {
            importName = uniqueName(name)
            moduleMap.set(name, importName)
            const importFunction: last.ImportFunction = {
                kind: LastKind.ImportFunction,
                module: ref(module),
                name: ref(name),
                as: ref(importName),
                parameters,
                result
            }
            importNode.imports.push(importFunction)
        }
        return ref(importName)
    }

    function mallocFunc(): last.Reference {
        return importFunction(dyegoSystem, mallocName, mallocParamters, mallocResult)
    }

    function cloneFunc(): last.Reference {
        return importFunction(dyegoSystem, cloneName, cloneParameters, cloneResult)
    }

    function freeFunc(): last.Reference {
        return importFunction(dyegoSystem, freeName, freeParameters, freeResult)
    }
}

function todo(message: string, location: last.Locatable): never {
    error(`TODO: ${message}`, location)
}

function ref(name: string): last.Reference {
    return {
        kind: LastKind.Reference,
        name
    }
}

function nameOfFunction(func: Function): string {
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

interface TypeFunctions {
    allocate: () => last.Expression
    copy: (expression: last.Expression) => last.Expression
    release: (expression: last.Expression) => last.BodyElement
    unique: (expression: last.Reference) => last.Expression
}

// System
const dyegoSystem = "dyego-system"

// System.malloc
const mallocName = "malloc"
const mallocParamters: last.Parameter[] = [lastParam("size", lastInt())]
const mallocResult = lastPtr(lastVoid())

// System.free
const freeName = "free"
const freeParameters: last.Parameter[] = [lastParam("value", lastPtr(lastVoid()))]
const freeResult = lastVoid()

// System.clone
const cloneName = "clone"
const cloneParameters: last.Parameter[] = [lastParam("value", lastPtr(lastVoid()))]
const cloneResult = lastPtr(lastVoid())

function lastI32(value: number): last.LiteralI32 {
    return {
        kind: LastKind.Literal,
        primitiveKind: last.PrimitiveKind.I32,
        value
    }
}

function lastVoid(): last.Primitive {
    return {
        kind: LastKind.Primitive,
        primitive: last.PrimitiveKind.Void
    }
}

function lastAssign(target: last.Expression, value: last.Expression): last.Assign {
    return {
        ...locOf(target, value),
        kind: LastKind.Assign,
        target,
        value
    }
}

function lastBlock(...elements: (last.BodyElement | undefined)[]): last.Block {
    const body = elements.filter(item => item) as last.BodyElement[]
    return {
        ...locOf(...body),
        kind: LastKind.Block,
        body
    }
}

function lastNamedBlock(
    name: string,
    ...elements: (last.BodyElement | undefined)[]
): last.Block {
    const body = elements.filter(item => item) as last.BodyElement[]
    return {
        ...locOf(...body),
        kind: LastKind.Block,
        name: ref(name),
        body
    }
}

function lastLoop(...elements: (last.BodyElement | undefined)[]): last.Loop {
    const body = elements.filter(item => item) as last.BodyElement[]
    return {
        ...locOf(...body),
        kind: LastKind.Loop,
        body
    }
}

function lastNamedLoop(name: string, ...elements: (last.BodyElement | undefined)[]): last.Loop {
    const body = elements.filter(item => item) as last.BodyElement[]
    return {
        ...locOf(...body),
        kind: LastKind.Loop,
        name: ref(name),
        body
    }
}

function lastFunc(name: last.Reference,  parameters: last.Parameter[], result: last.TypeExpression, ...body: last.BodyElement[]): last.Function {
    return {
        kind: LastKind.Function,
        name,
        parameters,
        result,
        body
    }
}

function lastArr(element: last.TypeExpression, size?: number): last.ArrayConstructor {
    return {
        kind: LastKind.ArrayConstructor,
        element,
        size
    }
}

function lastVar(name: last.Reference, value: last.Expression): last.Var {
    return {
        kind: LastKind.Var,
        name,
        value
    }
}

function lastParam(name: string, type: last.TypeExpression): last.Parameter {
    return {
        kind: LastKind.Parameter,
        name: ref(name),
        type
    }
}

function lastInt(): last.Primitive {
    return {
        kind: LastKind.Primitive,
        primitive: last.PrimitiveKind.I32
    }
}

function lastPtr(type: last.TypeExpression): last.PointerConstructor {
    return {
        kind: LastKind.PointerConstructor,
        target: type
    }
}

function lastSizeOf(target: last.TypeExpression): last.SizeOf {
    return {
        kind: LastKind.SizeOf,
        target
    }
}

function lastAs(left: last.Expression, right: last.TypeExpression): last.As {
    return {
        kind: LastKind.As,
        left,
        right
    }
}

function lastCall(target: last.Expression, ...args: last.Expression[]): last.Expression {
    return {
        kind: LastKind.Call,
        target,
        arguments: args
    }
}

function lastMult(left: last.Expression, right: last.Expression): last.Expression {
    return { kind: LastKind.Multiply, left, right }
}

function lastEqual(left: last.Expression, right: last.Expression): last.Expression {
    return {
        ...locOf(left, right),
        kind: LastKind.Equal,
        left,
        right
    }
}

function lastGte(left: last.Expression, right: last.Expression): last.Expression {
    return {
        ...locOf(left, right),
        kind: LastKind.GreaterThanEqual,
        left,
        right
    }
}

function lastIf(condition: last.Expression, then: last.BodyElement[], else_: last.BodyElement[]): last.IfThenElse {
    return {
        ...locOf(condition, ...then, ...else_),
        kind: LastKind.IfThenElse,
        condition,
        then,
        else: else_
    }
}

function lastIndex(target: last.Expression, index: last.Expression): last.Index {
    return {
        ...locOf(target, index),
        kind: LastKind.Index,
        target,
        index
    }
}
function lastSelect(target: last.Expression, name: string): last.Select {
    return {
        ...locOf(target),
        kind: LastKind.Select,
        target,
        name: ref(name)
    }
}

function lastAdd(left: last.Expression, right: last.Expression): last.Add {
    return {
        kind: LastKind.Add,
        left,
        right
    }
}

function lastBranch(target?: last.Reference): last.Branch {
    return { kind: LastKind.Branch, target }
}

function intrinsic(func: types.Function, call: Call,  args: last.Expression[]): last.Expression {
    function binary(kind: LastKind): last.Expression {
        assert(args.length == 2, call)
        return {
            ...locOf(call),
            kind,
            left: args[0],
            right: args[1]
        } as last.Expression
    }
    function unary(kind: LastKind): last.Expression {
        assert(args.length == 1, call)
        return {
            ...locOf(call),
            kind,
            target: args[0],
        } as last.Expression
    }
    function identity(): last.Expression {
        assert(args.length == 1, call)
        return args[0]
    }
    switch (func.name) {
        case 'infix +':  return binary(LastKind.Add)
        case 'infix -': return binary(LastKind.Subtract)
        case 'infix *': return binary(LastKind.Multiply)
        case 'infix /': return binary(LastKind.Divide)
        case 'infix %': return binary(LastKind.Remainder)
        case 'infix or': return binary(LastKind.BitOr)
        case 'infix and': return binary(LastKind.BitAnd)
        case 'infix shr': return binary(LastKind.BitShr)
        case 'infix shl': return binary(LastKind.BitShl)
        case 'infix ror': return binary(LastKind.BitRotr)
        case 'infix rol': return binary(LastKind.BitRotl)
        case 'charCode': return identity()
        case 'infix >': return binary(LastKind.GreaterThan)
        case 'infix <': return binary(LastKind.LessThan)
        case 'infix >=': return binary(LastKind.GreaterThanEqual)
        case 'infix <=': return binary(LastKind.LessThanEqual)
        case 'infix ==': return binary(LastKind.Equal)
        case 'infix !=': return binary(LastKind.NotEqual)
        case 'sqrt': return unary(LastKind.SquareRoot)
        case 'infix &&': return binary(LastKind.And)
        case 'infix ||': return binary(LastKind.Or)
        case 'prefix +': return identity()
        case 'prefix -': return unary(LastKind.Negate)
        case 'countTrailingZeros': return unary(LastKind.CountTrailingZeros)
        case 'countLeadingZeros': return unary(LastKind.CountLeadingZeros)
        case 'countNonZeros': return unary(LastKind.CountNonZeros)
    }
    error(`Unsupported intrinsic: ${func.name}`, call)
}

function locOf<E extends last.Locatable>(...locatables: E[]): last.Locatable {
    let start: number | undefined = undefined
    let end: number | undefined = undefined
    for (const loc of locatables) {
        if (start === undefined || (loc.start != undefined && start > loc.start)) {
            start = loc.start
        }
        if (end === undefined || (loc.end != undefined && end > loc.end)) {
            end = loc.start
        }
    }
    return { start, end }
}

function setLoc<L extends last.LastNode, E extends last.Locatable>(
    node: L,
    ...locatables: E[]
): L {
    const loc = locOf(...locatables)
    node.start = loc.start
    node.end = loc.end
    return node
}

function assert(expression: boolean, location: last.Locatable) {
    if (!expression) error("Assertion failed", location)
}
