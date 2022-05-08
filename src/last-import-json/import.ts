import {
    ArrayConstructor, ArrayLiteral, Binary, copy, Function, Global, ImportFunction, ImportVariable, Last, LastKind,
    Let, Literal, Memory, MemoryMethod, Module, Primitive, PrimitiveKind, Unary, Var
} from "../last";
import { childrenOf, Separator } from "../last-debug";
import { validate } from "../last-validate";

export interface ConvertContext {
    convertNode(node: any): Last
    convertArray(nodes: any[]): Last[]
}

export type ConverterFunctions = {
    [name: string]: (node: any, context: ConvertContext) => Last
}

export interface Converter {
    enter?(node: any): void
    exit?(node: any): void
    finish?(node: Module): Module
    convert: ConverterFunctions
}

function propagateLocationInformation(parent: Last, node: Last) {
    if (!node) {
        throw new Error(`Node with loc ${parent.loc}, kind: ${parent.kind} has an invalid form`)
    }
    if (!("loc" in node) && !("start" in node)) {
        if ("loc" in parent) {
            node.loc = parent.loc
        }
        if ("start" in parent) {
            node.start = parent.start
        }
    }
    for (const child of childrenOf(node)) {
        if (child instanceof Separator) continue
        propagateLocationInformation(node, child)
    }
}

export function importJson(text: string, converters: Converter[] = []): Module {
    const json = JSON.parse(text) as Module
    let result = convertNode(json) as Module
    for (const converter of converters) {
        if (converter.finish) result = converter.finish(result)
    }
    if (!("declarations" in result) || !Array.isArray(result.declarations)) {
        throw Error("Invalid module, must contain a declarations array")
    }
    let f = validate(result);
    if (f.length) console.log(f)
    for (const child of result.declarations) {
        if (child instanceof Separator) continue
        propagateLocationInformation(result, child)
    }
    return result

    function convertNode(node: any): Last {
        for (const converter of converters) {
            if (converter.enter) converter.enter(node);
        }
        try {
            if (node === undefined) {
                // Don't report this now, let validate report this
                return undefined as any as Last
            }
            const kind = typeof node.kind == "string" ? lastKindStringToEnum(node.kind) : node.kind as LastKind
            switch (kind) {
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
                case LastKind.ConvertTo:
                case LastKind.WrapTo:
                case LastKind.ReinterpretAs:
                case LastKind.TruncateTo:
                case LastKind.As:
                    return convertBinary(node, kind);
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
                case LastKind.AddressOf:
                case LastKind.SizeOf:
                case LastKind.Dereference:
                    return convertUnary(node, kind);
                case LastKind.Literal:
                    return convertLiteral(node, kind);
                case LastKind.StructLiteral:
                    return copy(node, { kind, fields: convertArray(node.fields) })
                case LastKind.Field:
                    return copy(node, { kind, name: convertNode(node.name), value: convertNode(node.value) })
                case LastKind.ArrayLiteral:
                    return convertArrayLiteral(node, kind)
                case LastKind.Block:
                case LastKind.Loop:
                    return copy(node, { kind, body: convertArray(node.body) })
                case LastKind.IfThenElse:
                    return copy(node, {
                        kind,
                        condition: convertNode(node.condition),
                        then: convertArray(node.then),
                        else: convertArray(node.else)
                    })
                case LastKind.Branch:
                    return copy(node, { kind });
                case LastKind.BranchIndexed:
                    if (node.else) {
                        return copy(node, {
                            kind,
                            condition: convertNode(node.condition),
                            targets: convertArray(node.targets),
                            else: convertNode(node.else)
                        })
                    }
                    return copy(node, {
                        kind,
                        condition: convertNode(node.condition),
                        targets: convertArray(node.targets)
                    })
                case LastKind.Return:
                    if (node.value) {
                        return copy(node, { kind, value: convertNode(node.value) })
                    }
                    return copy(node, { kind })
                case LastKind.Reference:
                    return copy(node, { kind })
                case LastKind.Select:
                    return copy(node, { kind, target: convertNode(node.target), name: convertNode(node.name) })
                case LastKind.Index:
                    return copy(node, { kind, target: convertNode(node.target), index: convertNode(node.index) })
                case LastKind.Assign:
                    return copy(node, { kind, target: convertNode(node.target), value: convertNode(node.value) })
                case LastKind.Function:
                    return convertFunction(node, kind)
                case LastKind.Parameter:
                    return copy(node, { kind, name: convertNode(node.name), type: convertNode(node.type) })
                case LastKind.Call:
                    return copy(node, { kind, target: convertNode(node.target), arguments: convertArray(node.arguments) })
                case LastKind.Memory:
                    return convertMemory(node, kind)
                case LastKind.Let:
                    return convertLet(node, kind)
                case LastKind.Var:
                    return convertVar(node, kind)
                case LastKind.Global:
                    return convertGlobal(node, kind)
                case LastKind.Primitive:
                    return convertPrimitive(node, kind)
                case LastKind.Type:
                    return copy(node, { kind, name: convertNode(node.name), type: convertNode(node.type) })
                case LastKind.TypeSelect:
                    return copy(node, { kind, target: convertNode(node.target), name: convertNode(node.name) })
                case LastKind.StructTypeLiteral:
                case LastKind.UnionTypeLiteral:
                    return copy(node, { kind, fields: convertArray(node.fields) })
                case LastKind.FieldLiteral:
                    return copy(node, { kind, name: convertNode(node.name), type: convertNode(node.type) })
                case LastKind.ArrayConstructor:
                    return convertArrayConstructor(node, kind)
                case LastKind.PointerConstructor:
                    return copy(node, { kind, target: convertNode(node.target )})
                case LastKind.Exported:
                    return copy(node, { kind, target: convertNode(node.target) })
                case LastKind.Import:
                    return copy(node, { kind, imports: convertArray(node.imports) })
                case LastKind.ImportFunction:
                    return convertImportFunction(node, kind)
                case LastKind.ImportVariable:
                    return convertImportVariable(node, kind)
                case LastKind.Module:
                    return convertModule(node, kind)
                default: {
                    let result = node;
                    for (const converter of converters) {
                        if (converter && typeof kind as any === "string" && converter[kind]) {
                            result = converter.convert[kind](result, { convertNode, convertArray })
                        }
                    }
                    return result
                }
            }
        } finally {
            for (const converter of converters) {
                if (converter.exit) converter.exit(node)
            }
        }
    }

    function convertBinary(node: any, kind: LastKind): Last & Binary {
        return copy(node, { kind, left: convertNode(node.left), right: convertNode(node.right) })
    }

    function convertUnary(node: any, kind: LastKind): Last & Unary {
        return copy(node, { kind, target: convertNode(node.target) })
    }

    function convertLiteral(node: any, kind: LastKind): Literal {
        const primitiveKind = lastPrimitiveKindStringToEnum(node.primitiveKind)
        if (primitiveKind == PrimitiveKind.I64 && typeof node.value === "number") {
            return copy(node, { kind, primitiveKind, value: BigInt(node.value) })
        }
        return copy(node, { kind, primitiveKind })
    }

    function convertArray<T extends Last>(nodes: any[]): T[] {
        if (!Array.isArray(nodes)) {
            // Let validate report this
            return nodes as T[]
        }
        return nodes.map(convertNode) as T[]
    }

    function convertArrayLiteral(node: any, kind: LastKind): ArrayLiteral {
        const values = Array.isArray(node.values) ? convertArray(node.values) : node.values
        return copy(node, { kind, values })
    }

    function convertFunction(node: any, kind: LastKind): Function {
        return copy(
            node,
            {
                kind,
                name: convertNode(node.name),
                parameters: convertArray(node.parameters),
                result: convertNode(node.result),
                body: convertArray(node.body)
            }
        )
    }

    function convertMemory(node: any, kind: LastKind): Memory {
        const method = typeof node.method === "string" ? lastMemoryMethodStringToEnum(node.method) : node.method
        return copy(node, { kind, method }) as Memory
    }

    function convertLet(node: any, kind: LastKind): Let {
        return copy(node, {
            kind,
            name: convertNode(node.name),
            type: convertNode(node.type),
            value: convertNode(node.value)
        })
    }

    function convertVar(node: any, kind: LastKind): Var {
        const overrides: any = { kind, name: convertNode(node.name) }
        if (node.type) overrides.type = convertNode(node.type)
        if (node.value) overrides.value = convertNode(node.value)
        return copy(node, overrides)
    }

    function convertGlobal(node: any, kind: LastKind): Global {
        return copy(node, {
            kind,
            name: convertNode(node.name),
            type: convertNode(node.type),
            value: convertNode(node.value)
        })
    }

    function convertPrimitive(node: any, kind: LastKind): Primitive {
        const primitive = typeof node.primitive === "string" ? lastPrimitiveKindStringToEnum(node.primitive) : node.primitive
        return copy(node, { kind, primitive })
    }

    function convertArrayConstructor(node: any, kind: LastKind): ArrayConstructor {
        if (node.size !== undefined) {
            return copy(node, { kind, element: convertNode(node.element), size: node.size })
        }
        return copy(node, { kind, element: convertNode(node.element) })
    }

    function convertImportFunction(node: any, kind: LastKind): ImportFunction {
        return copy(node, {
            kind,
            parameters: convertArray(node.parameters),
            result: convertNode(node.result)
        })
    }

    function convertImportVariable(node: any, kind: LastKind): ImportVariable {
        return copy(node, {
            kind,
            type: convertNode(node.type)
        })
    }

    function convertModule(node: any, kind: LastKind): Module {
    return copy(node, {
        kind,
        imports: convertArray(node.imports),
        declarations: convertArray(node.declarations)
    })
    }
    function lastKindStringToEnum(text: string): LastKind {
        switch (text) {
            case "Add": return LastKind.Add
            case "Subtract": return LastKind.Subtract
            case "Multiply": return LastKind.Multiply
            case "Divide": return LastKind.Divide
            case "Remainder": return LastKind.Remainder
            case "Negate": return LastKind.Negate
            case "Not": return LastKind.Not
            case "Equal": return LastKind.Equal
            case "NotEqual": return LastKind.NotEqual
            case "GreaterThan": return LastKind.GreaterThan
            case "GreaterThanEqual": return LastKind.GreaterThanEqual
            case "LessThan": return LastKind.LessThan
            case "LessThanEqual": return LastKind.LessThanEqual
            case "And": return LastKind.And
            case "Or": return LastKind.Or
            case "BitAnd": return LastKind.BitAnd
            case "BitOr": return LastKind.BitOr
            case "BitXor": return LastKind.BitXor
            case "BitShl": return LastKind.BitShl
            case "BitShr": return LastKind.BitShr
            case "BitRotr": return LastKind.BitRotr
            case "BitRotl": return LastKind.BitRotl
            case "CountLeadingZeros": return LastKind.CountLeadingZeros
            case "CountTrailingZeros": return LastKind.CountTrailingZeros
            case "CountNonZeros": return LastKind.CountNonZeros
            case "AbsoluteValue": return LastKind.AbsoluteValue
            case "SquareRoot": return LastKind.SquareRoot
            case "Floor": return LastKind.Floor
            case "Ceiling": return LastKind.Ceiling
            case "Truncate": return LastKind.Truncate
            case "RoundNearest": return LastKind.RoundNearest
            case "Minimum": return LastKind.Minimum
            case "Maximum": return LastKind.Maximum
            case "CopySign": return LastKind.CopySign
            case "ConvertTo": return LastKind.ConvertTo
            case "WrapTo": return LastKind.WrapTo
            case "ReinterpretAs": return LastKind.ReinterpretAs
            case "TruncateTo": return LastKind.TruncateTo
            case "As": return LastKind.As
            case "AddressOf": return LastKind.AddressOf
            case "SizeOf": return LastKind.SizeOf
            case "Dereference": return LastKind.Dereference
            case "Literal": return LastKind.Literal
            case "StructLiteral": return LastKind.StructLiteral
            case "Field": return LastKind.Field
            case "ArrayLiteral": return LastKind.ArrayLiteral
            case "Block": return LastKind.Block
            case "Loop": return LastKind.Loop
            case "IfThenElse": return LastKind.IfThenElse
            case "Branch": return LastKind.Branch
            case "BranchIndexed": return LastKind.BranchIndexed
            case "Return": return LastKind.Return
            case "Reference": return LastKind.Reference
            case "Select": return LastKind.Select
            case "Index": return LastKind.Index
            case "Assign": return LastKind.Assign
            case "Function": return LastKind.Function
            case "Parameter": return LastKind.Parameter
            case "Call": return LastKind.Call
            case "Memory": return LastKind.Memory
            case "Let": return LastKind.Let
            case "Var": return LastKind.Var
            case "Global": return LastKind.Global
            case "Primitive": return LastKind.Primitive
            case "Type": return LastKind.Type
            case "TypeSelect": return LastKind.TypeSelect
            case "StructTypeLiteral": return LastKind.StructTypeLiteral
            case "UnionTypeLiteral": return LastKind.UnionTypeLiteral
            case "FieldLiteral": return LastKind.FieldLiteral
            case "ArrayConstructor": return LastKind.ArrayConstructor
            case "PointerConstructor": return LastKind.PointerConstructor
            case "Exported": return LastKind.Exported
            case "Import": return LastKind.Import
            case "ImportFunction": return LastKind.ImportFunction
            case "ImportVariable": return LastKind.ImportVariable
            case "Module": return LastKind.Module
        }
        return text as any as LastKind
    }

    function lastPrimitiveKindStringToEnum(text: string): PrimitiveKind {
        switch (text) {
            case "I8": return PrimitiveKind.I8
            case "I16": return PrimitiveKind.I16
            case "I32": return PrimitiveKind.I32
            case "I64": return PrimitiveKind.I64
            case "U8": return PrimitiveKind.U8
            case "U16": return PrimitiveKind.U16
            case "U32": return PrimitiveKind.U32
            case "U64": return PrimitiveKind.U64
            case "F32": return PrimitiveKind.F32
            case "F64": return PrimitiveKind.F64
            case "Bool": return PrimitiveKind.Bool
            case "Void": return PrimitiveKind.Void
            case "Null": return PrimitiveKind.Null
        }
        return text as any as PrimitiveKind
    }

    function lastMemoryMethodStringToEnum(text: string): MemoryMethod {
        switch (text) {
            case "Top": return MemoryMethod.Top;
            case "Limit": return MemoryMethod.Limit;
            case "Grow": return MemoryMethod.Grow;
        }
        throw new Error(`Unkonwn memory method ${text}`)
    }
}