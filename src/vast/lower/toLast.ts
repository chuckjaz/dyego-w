import * as ir from "./ir"
import * as last from "../../last"
import * as types from "../types/types"
import { LastKind, Locatable } from "../../last"
import { error, required } from "../../utils"
import { TypeKind } from "../types/types"
import { IrKind } from "./ir"

import { Location, LocationKind } from "../types/check"

export function toLast(module: ir.Module): last.Module {
    const importNode: last.Import = {
        kind: LastKind.Import,
        imports: []
    }
    const imports: last.Import[] = [importNode]
    const declarations: last.Declaration[] = []
    const typeMap = new Map<types.Type, string>()
    const names = new Set<string>()
    const locationNames = new Map<Location, string>()
    const importMap = new Map<string, Map<string, string>>()

    convertModule(module)

    return {
        kind: LastKind.Module,
        imports,
        declarations
    }

    function convertModule(module: ir.Module) {
        assert(module.initialize.statements.length == 0, module, "Initialization not supported yet")
        module.functions.forEach(convertFunction)
    }

    function convertFunction(func: ir.Function) {
        const name = convertReference(func.name)
        const parameters = func.parameters.map<last.Parameter>(parameter => {
            return {
                kind: LastKind.Parameter,
                name: convertReference(parameter),
                type: convertType(parameter.type)
            }
        })
        const result = convertType(func.body.type)
        const body = convertExpression(func.body)
        const lastFunction: last.Function = {
            kind: LastKind.Function,
            name,
            parameters,
            result,
            body: body.kind == LastKind.Block && !body.name ? body.body : [body]
        }
        if (func.location.exported) {
            declarations.push({
                kind: LastKind.Exported,
                target: lastFunction
            })
        } else {
            declarations.push(lastFunction)
        }
    }

    function convertExpression(expression: ir.Expression): last.Expression {
        switch (expression.kind) {
            case IrKind.ArrayLiteral:
                return convertArrayLiteral(expression)
            case IrKind.Block:
                return convertBlock(expression)
            case IrKind.Call:
                return convertCall(expression)
            case IrKind.ComputedBranch:
                return convertComputedBranch(expression)
            case IrKind.If:
                return convertIf(expression)
            case IrKind.Index:
                return convertIndex(expression)
            case IrKind.Literal:
                return convertLiteral(expression)
            case IrKind.Nothing:
                error("Nothing should have been removed", expression)
            case IrKind.Reference:
                return convertReference(expression)
            case IrKind.Select:
                return convertSelect(expression)
            case IrKind.StructLiteral:
                return convertStructLiteral(expression)
        }
    }

    function convertStatement(statement: ir.Statement): last.BodyElement {
        switch (statement.kind) {
            case IrKind.Assign:
                return convertAssign(statement)
            case IrKind.Break:
                return convertBreak(statement)
            case IrKind.Continue:
                return convertContinue(statement)
            case IrKind.Definition:
                return convertDefinition(statement)
            case IrKind.For:
                return convertFor(statement)
            case IrKind.Return:
                return convertReturn(statement)
            case IrKind.While:
                return convertWhile(statement)
            default:
                return convertExpression(statement)
        }
    }

    function convertArrayLiteral(expression: ir.ArrayLiteral): last.Expression {
        const values = expression.values.map(convertExpression)
        return {
            ...locOf(expression),
            kind: LastKind.ArrayLiteral,
            values
        }
    }

    function convertAssign(statement: ir.Assign): last.Assign {
        const target = convertExpression(statement.target)
        const value = convertExpression(statement.value)
        return {
            ...locOf(statement),
            kind: LastKind.Assign,
            target,
            value
        }
    }

    function convertBreak(statement: ir.Break): last.Branch {
        return {
            ...locOf(statement),
            kind: LastKind.Branch,
            target: ref(statement.target)
        }
    }

    function convertContinue(statement: ir.Continue): last.Branch {
        return {
            ...locOf(statement),
            kind: LastKind.Branch,
            target: ref(`${statement.target}_c`)
        }
    }

    function convertBlock(expression: ir.Block): last.Block {
        const statements = expression.statements.map(convertStatement).flat()
        return {
            ...locOf(expression),
            kind: LastKind.Block,
            body: statements
        }
    }

    function convertCall(expression: ir.Call): last.Expression {
        const originalTarget = expression.target
        const target = convertExpression(expression.target)
        const args = expression.args.map(convertExpression)

        // Check for intrinsics
        if (
            originalTarget.kind == IrKind.Reference &&
            originalTarget.location.kind == LocationKind.Function &&
            (originalTarget.location.func.modifier & types.FunctionModifier.Intrinsic) != 0
        ) {
            return intrinsic(originalTarget.location.func, expression, args)
        }
        return {
            ...locOf(expression),
            kind: LastKind.Call,
            target,
            arguments: args
        }
    }

    function convertComputedBranch(expression: ir.ComputedBranch): last.Expression {
        error("Not supported yet", expression)
    }

    function convertDefinition(statement: ir.Definition): last.Var {
        const name = convertReference(statement.name)
        const type = convertType(statement.type)
        return {
            ...locOf(statement),
            kind: LastKind.Var,
            name,
            type
        }
    }

    function convertFieldLiteral(field: ir.FieldLiteral): last.Field {
        const name = convertReference(field.name)
        const value = convertExpression(field.value)
        return {
            ...locOf(field),
            kind: LastKind.Field,
            name,
            value
        }
    }

    function convertFor(statement: ir.For): last.Statement {
        error("Not suppported yet", statement)
    }

    function convertIf(expression: ir.If): last.IfThenElse {
        const condition = convertExpression(expression.condition)
        const thenPart = convertBlock(expression.then)
        const elsePart = convertBlock(expression.else)
        return {
            ...locOf(expression),
            kind: LastKind.IfThenElse,
            condition,
            then: thenPart.body,
            else: elsePart.body,
        }
    }

    function convertIndex(expression: ir.Index): last.Expression {
        const target = convertExpression(expression.target)
        const index = convertExpression(expression.index)
        return {
            ...locOf(expression),
            kind: LastKind.Index,
            target,
            index
        }
    }

    function convertLiteral(expression: ir.Literal): last.Literal {
        const primitiveKind = convertPrimitiveKind(expression.value.primitiveKind, expression)
        const value = expression.value.value
        if (typeof value == "string") error("String should have been lowered", expression)
        return {
            ...locOf(expression),
            kind: LastKind.Literal,
            primitiveKind: primitiveKind,
            value
        } as last.Literal
    }

    function convertReference(reference: ir.Reference): last.Reference {
        function newName(): string {
            const name = uniqueName(reference.name)
            locationNames.set(reference.location, name)
            return name
        }

        return {
            ...locOf(reference),
            kind: LastKind.Reference,
            name: locationNames.get(reference.location) ?? newName()
        }
    }

    function convertReturn(statement: ir.Return): last.Return {
        return {
            ...locOf(statement),
            kind: LastKind.Return,
            value: statement.value.kind == IrKind.Nothing ? undefined : convertExpression(statement.value)
        }
    }

    function convertSelect(expression: ir.Select): last.Expression {
        const target = convertExpression(expression.target)
        const name = convertReference(expression.name)
        return {
            ...locOf(expression),
            kind: LastKind.Select,
            target,
            name
        }
    }

    function convertStructLiteral(expression: ir.StructLiteral): last.Expression {
        const fields = expression.fields.map(convertFieldLiteral)
        return {
            ...locOf(expression),
            kind: LastKind.StructLiteral,
            fields
        }
    }

    function convertWhile(statement: ir.While): last.Block {
        const continueName = `${statement.name}_c`
        const breakName = statement.name
        const condition = convertExpression(statement.condition)
        const body = convertBlock(statement.body)
        const mainBlock: last.Loop = {
            ...locOf(statement),
            kind: LastKind.Loop,
            name: ref(continueName),
            body: [
                lastIf(condition, [...body.body, lastBranch(continueName)], [])
            ]
        }
        return {
            ...locOf(statement),
            kind: LastKind.Block,
            name: ref(breakName),
            body: [mainBlock]
        }
    }

    function lastIf(
        condition: last.Expression,
        thenPart: last.BodyElement[],
        elsePart: last.BodyElement[]
    ): last.IfThenElse {
        return {
            ...locOf(condition, ...thenPart, ...elsePart),
            kind: LastKind.IfThenElse,
            condition,
            then: thenPart,
            else: elsePart
        }
    }

    function lastBranch(
        target: string
    ): last.Branch {
        return {
            kind: LastKind.Branch,
            target: ref(target)
        }
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
            case TypeKind.Range:
                throw new Error(`${types.nameOfTypeKind(type.kind)} should have been lowered already`)
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

    function referenceTo(type: types.Type, producer: () => string): last.Reference {
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

    function uniqueName(candidate: string): string {
        let name = candidate
        let candidateNumber = 0
        while (names.has(name)) {
            name = `${candidate}$${candidateNumber++}`
        }
        return name
    }
}

function intrinsic(func: types.Function, call: ir.Call,  args: last.Expression[]): last.Expression {
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
        case 'infix xor': return binary(LastKind.BitXor)
        case 'charCode': return identity()
        case 'infix >': return binary(LastKind.GreaterThan)
        case 'infix <': return binary(LastKind.LessThan)
        case 'infix >=': return binary(LastKind.GreaterThanEqual)
        case 'infix <=': return binary(LastKind.LessThanEqual)
        case 'infix ==': return binary(LastKind.Equal)
        case 'infix !=': return binary(LastKind.NotEqual)
        case 'abs': return unary(LastKind.AbsoluteValue)
        case 'sqrt': return unary(LastKind.SquareRoot)
        case 'floor': return unary(LastKind.Floor)
        case 'ceiling': return unary(LastKind.Ceiling)
        case 'truncate': return unary(LastKind.Truncate)
        case 'roundNearest': return unary(LastKind.RoundNearest)
        case 'infix sign': return binary(LastKind.CopySign)
        case 'infix min': return binary(LastKind.Minimum)
        case 'infix max': return binary(LastKind.Maximum)
        case 'infix &&': return binary(LastKind.And)
        case 'infix ||': return binary(LastKind.Or)
        case 'prefix !': return unary(LastKind.Not)
        case 'prefix ~': return unary(LastKind.BitNot)
        case 'prefix +': return identity()
        case 'prefix -': return unary(LastKind.Negate)
        case 'countTrailingZeros': return unary(LastKind.CountTrailingZeros)
        case 'countLeadingZeros': return unary(LastKind.CountLeadingZeros)
        case 'countNonZeros': return unary(LastKind.CountNonZeros)
    }
    error(`Unsupported intrinsic: ${func.name}`, call)
}

function ref(name: string): last.Reference {
    return {
        kind: LastKind.Reference,
        name
    }
}

function assert(expression: boolean, location: last.Locatable, message?: string) {
    if (!expression) error(`Assertion failed${message ? `: ${message}` : ''}`, location)
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

function convertPrimitiveKind(kind: ir.PrimitiveKind, location: Locatable):
    last.PrimitiveKind.I8 |
    last.PrimitiveKind.I16 |
    last.PrimitiveKind.I32 |
    last.PrimitiveKind.I64 |
    last.PrimitiveKind.U8 |
    last.PrimitiveKind.U16 |
    last.PrimitiveKind.U32 |
    last.PrimitiveKind.U64 |
    last.PrimitiveKind.F32 |
    last.PrimitiveKind.F64 |
    last.PrimitiveKind.Bool
{
    switch (kind) {
        case ir.PrimitiveKind.I8: return last.PrimitiveKind.I8
        case ir.PrimitiveKind.I16: return last.PrimitiveKind.I16
        case ir.PrimitiveKind.I32: return last.PrimitiveKind.I32
        case ir.PrimitiveKind.I64: return last.PrimitiveKind.I64
        case ir.PrimitiveKind.U8: return last.PrimitiveKind.U8
        case ir.PrimitiveKind.U16: return last.PrimitiveKind.U16
        case ir.PrimitiveKind.U32: return last.PrimitiveKind.U32
        case ir.PrimitiveKind.U64: return last.PrimitiveKind.U64
        case ir.PrimitiveKind.F32: return last.PrimitiveKind.F32
        case ir.PrimitiveKind.F64: return last.PrimitiveKind.F64
        case ir.PrimitiveKind.Bool: return last.PrimitiveKind.Bool
    }
    error("Unknown primitive kind", location)
}
