import { Diagnostic, Locatable, Scope } from "../../last";
import { required } from "../../utils";
import { Call, Declaration, Expression, For, Function as FunctionNode, If, ImplicitVal, Index, Kind, Lambda, Let, Literal, Module, Parameter, ParameterModifier, PrimitiveKind, Range, Reference, Select, Statement, StructLiteral, StructTypeConstructor, StructTypeConstuctorField, TypeDeclaration, TypeExpression, Val, Var, When, While } from "../ast";
import { Type, Parameter as FunctionTypeParameter, ParameterModifier as FunctionTypeParameterModifier, Function, FunctionType, ErrorType, StructField, StructType, FunctionModifier, StructFieldModifier, OpenType, LambdaType, ArrayType, SliceType, TypeKind } from "./types";

interface PendingFunction {
    func: FunctionNode
    type: FunctionType
}

const i8Type: Type = { kind: TypeKind.I8 }
const i16Type: Type = { kind: TypeKind.I16 }
const i32Type: Type = { kind: TypeKind.I32 }
const i64Type: Type = { kind: TypeKind.I64 }
const u8Type: Type = { kind: TypeKind.U8 }
const u16Type: Type = { kind: TypeKind.U16 }
const u32Type: Type = { kind: TypeKind.U32 }
const u64Type: Type = { kind: TypeKind.U64 }
const f32Type: Type = { kind: TypeKind.F32 }
const f64Type: Type = { kind: TypeKind.F64 }
const charType: Type = { kind: TypeKind.Char }
const stringType: Type = { kind: TypeKind.String }
const booleanType: Type = { kind: TypeKind.Boolean }
const rangeType: Type = { kind: TypeKind.Range }
const voidType: Type = { kind: TypeKind.Void }
const neverType: Type = { kind: TypeKind.Never }
const errorType: ErrorType = { kind: TypeKind.Error }

function signedOf(type: Type): Type {
    switch (type.kind) {
        case TypeKind.U8: return i8Type
        case TypeKind.U16: return i16Type
        case TypeKind.U32: return i32Type
        case TypeKind.U64: return i64Type
        case TypeKind.I8: return i8Type
        case TypeKind.I16: return i16Type
        case TypeKind.I32: return i32Type
        case TypeKind.I64: return i64Type
    }
    throw Error("Not a numeric type")
}

const enum Capabilities {
    None = 0 << 0,
    Addable = 1 << 0,
    NumericOperators = 1 << 1,
    Modulus = 1 << 2,
    Equatable = 1 << 3,
    Comparable = 1 << 4,
    Bitwiseable = 1 << 5,
    Bitcountable = 1 << 6,
    Negatable = 1 << 7,
    Floatable = 1 << 8,
    Logical = 1 << 9,
    Charable = 1 << 10,
    Stringable = 1 << 11,
    Arrayable = 1 << 12,
}

const syntheticI8 = synthetic(i8Type, Capabilities.Comparable | Capabilities.Equatable | Capabilities.Negatable | Capabilities.NumericOperators | Capabilities.Modulus)
const syntheticI16 = synthetic(i16Type, Capabilities.Comparable | Capabilities.Equatable | Capabilities.Negatable | Capabilities.NumericOperators | Capabilities.Modulus)
const syntheticI32 = synthetic(i32Type, Capabilities.Bitcountable | Capabilities.Bitwiseable | Capabilities.Comparable | Capabilities.Equatable | Capabilities.Negatable | Capabilities.NumericOperators | Capabilities.Modulus)
const syntheticI64 = synthetic(i64Type, Capabilities.Bitcountable | Capabilities.Bitwiseable | Capabilities.Comparable | Capabilities.Equatable | Capabilities.Negatable | Capabilities.NumericOperators | Capabilities.Modulus)
const syntheticU8 = synthetic(u8Type, Capabilities.Bitwiseable | Capabilities.Comparable | Capabilities.Equatable | Capabilities.NumericOperators | Capabilities.Modulus)
const syntheticU16 = synthetic(u16Type, Capabilities.Bitwiseable | Capabilities.Comparable | Capabilities.Equatable | Capabilities.NumericOperators | Capabilities.Modulus)
const syntheticU32 = synthetic(u32Type, Capabilities.Bitcountable | Capabilities.Bitwiseable | Capabilities.Comparable | Capabilities.Equatable | Capabilities.NumericOperators | Capabilities.Modulus)
const syntheticU64 = synthetic(u64Type, Capabilities.Bitcountable | Capabilities.Bitwiseable | Capabilities.Comparable | Capabilities.Equatable | Capabilities.NumericOperators | Capabilities.Modulus)
const syntheticF32 = synthetic(f32Type, Capabilities.Comparable | Capabilities.Equatable | Capabilities.Floatable | Capabilities.Negatable | Capabilities.NumericOperators)
const syntheticF64 = synthetic(f64Type, Capabilities.Comparable | Capabilities.Equatable | Capabilities.Floatable | Capabilities.Negatable | Capabilities.NumericOperators)
const syntheticChar = synthetic(charType, Capabilities.Charable | Capabilities.Equatable | Capabilities.Comparable)
const syntheticString = synthetic(stringType, Capabilities.Arrayable | Capabilities.Stringable | Capabilities.Equatable | Capabilities.Comparable)
const syntheticBoolean = synthetic(booleanType, Capabilities.Equatable | Capabilities.Logical)
const syntheticRange = synthetic(rangeType, Capabilities.None)

const builtInTypes = (() => {
    const scope = new Scope<Type>()
    scope.enter("i8", i8Type)
    scope.enter("i16", i16Type)
    scope.enter("i32", i32Type)
    scope.enter("i64", i64Type)
    scope.enter("u8", u8Type)
    scope.enter("u16", u16Type)
    scope.enter("u32", u32Type)
    scope.enter("u64", u64Type)
    scope.enter("f32", f32Type)
    scope.enter("f64", f64Type)
    scope.enter("int", i32Type)
    scope.enter("string", stringType)
    scope.enter("char", charType)
    scope.enter("bool", booleanType)
    scope.enter("void", voidType)
    scope.enter("range", rangeType)
    return scope
})()

function synthetic(self: Type, capabilities: Capabilities): StructType {
    const fields = new Scope<StructField>()
    const types = new Scope<Type>()
    const methods = new Scope<Function>()

    function enter(name: string, func: Function) {
        methods.enter(name, func)
    }

    function param(position: number, type: Type): FunctionTypeParameter {
        return {
            name: position.toString(),
            alias: "_",
            position,
            modifier: FunctionTypeParameterModifier.None,
            type
        }
    }

    function prefix(name: string, result: Type = self) {
        const prefixName = `prefix ${name}`
        const parameters = new Scope<FunctionTypeParameter>()
        const func: Function = {
            name: prefixName,
            modifier: FunctionModifier.Method | FunctionModifier.Intrinsic,
            type: {
                kind: TypeKind.Function,
                parameters,
                result
            }
        }
        enter(prefixName, func)
    }

    function params0(name: string, result: Type): Function {
        const parameters = new Scope<FunctionTypeParameter>()
        const func: Function = {
            name,
            modifier: FunctionModifier.Method | FunctionModifier.Intrinsic,
            type: {
                kind: TypeKind.Function,
                parameters,
                result
            }
        }
        return func
    }

    function params1(name: string, result: Type, p0: Type): Function {
        const parameters = new Scope<FunctionTypeParameter>()
        parameters.enter("0", param(0, p0))
        const func: Function = {
            name,
            modifier: FunctionModifier.Method | FunctionModifier.Intrinsic,
            type: {
                kind: TypeKind.Function,
                parameters,
                result
            }
        }
        return func
    }

    function infix(name: string, result: Type = self, right: Type = self) {
        const internalName = `infix ${name}`
        enter(internalName, params1(internalName, result, right))
    }

    function method0(name: string, result: Type = self) {
        enter(name, params0(name, result))
    }

    function method1(name: string, result: Type = self, p0: Type = self) {
        enter(name, params1(name, result, p0))
    }

    function field(name: string, type: Type) {
        const field: StructField = {
            name,
            type,
            modifier: StructFieldModifier.Val
        }
        fields.enter(name, field)
    }

    if (capabilities & Capabilities.Arrayable) {
        field('size', i32Type)
    }

    if (capabilities & (Capabilities.Addable | Capabilities.NumericOperators)) {
        infix("+")
    }
    if (capabilities & Capabilities.Bitcountable) {
        method0("countTrailingZeros")
        method0("countLeadingZeros")
        method0("countNonZeros")
    }
    if (capabilities & Capabilities.Bitwiseable) {
        infix("or")
        infix("and")
        infix("shl", self, signedOf(self))
        infix("shr", self, signedOf(self))
        infix("ror", self, signedOf(self))
        infix("rol", self, signedOf(self))
        prefix("~")
    }
    if (capabilities & Capabilities.Charable) {
        method0("charCode", i32Type)
    }
    if (capabilities & Capabilities.Comparable) {
        infix(">", booleanType)
        infix("<", booleanType)
        infix(">=", booleanType)
        infix("<=", booleanType)
    }
    if (capabilities & Capabilities.Equatable) {
        infix("==", booleanType)
        infix("!=", booleanType)
    }
    if (capabilities & Capabilities.Floatable) {
        method0("abs")
        method0("sqrt")
        method0("floor")
        method0("ceiling")
        method0("truncate")
        method0("roundNearest")
        infix("sign")
        infix("min")
        infix("max")
    }
    if (capabilities & Capabilities.Logical) {
        infix("&&")
        infix("||")
        prefix("!")
    }
    if (capabilities & Capabilities.Negatable) {
        prefix("+")
        prefix("-")
    }
    if (capabilities & Capabilities.NumericOperators) {
        infix("-")
        infix("*")
        infix("/")
    }
    if (capabilities & Capabilities.Modulus) {
        infix("%")
    }
    if (capabilities & Capabilities.Stringable) {
        method1("indexOf", i32Type)
    }

    return {
        kind: TypeKind.Struct,
        fields,
        methods,
        types
    }
}

function syntheticOf(type: Type): StructType {
    switch (type.kind) {
        case TypeKind.I8: return syntheticI8
        case TypeKind.I16: return syntheticI16
        case TypeKind.I32: return syntheticI32
        case TypeKind.I64: return syntheticI64
        case TypeKind.U8: return syntheticU8
        case TypeKind.U16: return syntheticU16
        case TypeKind.U32: return syntheticU32
        case TypeKind.U64: return syntheticU64
        case TypeKind.F32: return syntheticF32
        case TypeKind.F64: return syntheticF64
        case TypeKind.Boolean: return syntheticBoolean
        case TypeKind.Char: return syntheticChar
        case TypeKind.Range: return syntheticRange
        case TypeKind.String: return syntheticString
        case TypeKind.Slice: return synthetic(type, Capabilities.Arrayable)
        case TypeKind.Function: return synthetic(type, Capabilities.None)
        case TypeKind.Array: return synthetic(type, Capabilities.Arrayable)
        case TypeKind.Error: return synthetic(type, Capabilities.None)
        case TypeKind.Lambda: return synthetic(type, Capabilities.None)
        case TypeKind.Never: return synthetic(type, Capabilities.None)
        case TypeKind.Open: {
            if (type.primary.bound) {
                return syntheticOf(type.primary.bound)
            } else {
                required(false)
                return synthetic(type, Capabilities.None)
            }
        }
        case TypeKind.Struct: return type
        case TypeKind.Void: return synthetic(type, Capabilities.None)
    }
}

export type StorageNode = Let | ImplicitVal | StructTypeConstuctorField | Val | Var | Parameter | Function

export interface CheckResult {
    types: Map<Statement, Type>
    references: Map<Reference, Location>
    locations: Map<Location, StorageNode>
    functions: Map<Function, FunctionNode>
    diagnostics: Diagnostic[]
}

interface ConstResult {
    value: any
    type: Type
}

const constError: ConstResult = {
    value: null,
    type: errorType
}

export function check(module: Module): CheckResult {
    const diagnostics: Diagnostic[] = []
    const pending: PendingFunction[] = []
    const types = new Map<Statement, Type>()
    const references = new Map<Reference, Location>()
    const locations = new Map<Location, StorageNode>()
    const fields = new Map<StructField, StructTypeConstuctorField>()
    const functions = new Map<Function, FunctionNode>()

    let scopes: Scopes = {
        types: new Scope(builtInTypes),
        locations: new Scope(),
        context: new Scope(),
        functions: new Scope(),
    }

    checkModule(module)
    return { types, references, locations, functions, diagnostics }

    function checkModule(module: Module) {
        module.declarations.forEach(checkDeclaration)
        for (let i = 0; i < pending.length; i++) {
            checkFunction(pending[i])
        }
    }

    function checkDeclaration(declaration: Declaration) {
        switch (declaration.kind) {
            case Kind.Function:
                enterFunction(declaration, FunctionModifier.None)
                return
            case Kind.Let:
                checkLetDeclaration(declaration)
                return
            case Kind.Val:
                checkValDeclaration(declaration)
                return
            case Kind.Var:
                checkVarDeclaration(declaration)
                return
            case Kind.TypeDeclaration:
                checkTypeDeclaration(declaration)
                return
        }
    }

    function checkLetDeclaration(letDeclaration: Let) {
        const name = letDeclaration.name
        const declaredType = convertTypeExpression(letDeclaration.type)
        const valueType = requiredBound(letDeclaration.value, checkExpression(letDeclaration.value))
        const value = evaluateToConstant(letDeclaration.value, declaredType)
        const type = mustMatch(letDeclaration.value, declaredType, valueType)
        const location: LetLocation = {
            kind: LocationKind.Let,
            type: requiredBound(letDeclaration, type),
            value
        }
        enterLocation(letDeclaration, name, location)
    }

    function checkValDeclaration(valDeclaration: Val) {
        const name = valDeclaration.name
        const declaredType = convertTypeExpression(valDeclaration.type)
        const valueType = inTypeContext(declaredType, () => requiredBound(valDeclaration.value, checkExpression(valDeclaration.value)))
        const type = mustMatch(valDeclaration.value, declaredType, valueType)
        const location: ValLocation = {
            kind: LocationKind.Val,
            type
        }
        enterLocation(valDeclaration, name, location)
    }

    function checkVarDeclaration(varDeclaration: Var) {
        const name = varDeclaration.name
        const declaredType = convertTypeExpression(varDeclaration.type)
        const varValue = varDeclaration.value
        const valueType =  varValue ? inTypeContext(declaredType, () => checkExpression(varValue)) : fresh()
        const type = mustMatch(varDeclaration, declaredType, valueType)
        const location: VarLocation = {
            kind: LocationKind.Var,
            type: requiredBound(varDeclaration, type)
        }
        enterLocation(varDeclaration, name, location)
    }

    function checkTypeDeclaration(typeDeclaration: TypeDeclaration) {
        const name = typeDeclaration.name.name
        const type = convertTypeExpression(typeDeclaration.type)
        scopeEnter(typeDeclaration, scopes.types, name, type)
        if (type.kind == TypeKind.Struct && !type.name) type.name = name
    }

    function enterFunction(func: FunctionNode, modifier: FunctionModifier): Function {
        const parameters = convertFunctionParameters(func.parameters)
        if (scopes.declarationContext) {
            const selfParameter: FunctionTypeParameter = {
                name: "self",
                alias: "self",
                position: -1,
                modifier: FunctionTypeParameterModifier.Context,
                type: scopes.declarationContext
            }
            scopeEnter(func, parameters, "self", selfParameter)
        }
        const result = convertTypeExpression(func.result)
        const type: FunctionType = {
            kind: TypeKind.Function,
            parameters,
            result
        }
        types.set(func.name, type)
        const name = func.name.name
        const functionEntry: Function = {
            name,
            modifier,
            type
        }
        const firstChar = name[0]
        const functionLocation: FunctionLocation = {
            kind: LocationKind.Function,
            type,
            func: functionEntry,
            exported: firstChar.toUpperCase() == firstChar
        }
        scopeEnter(func, scopes.functions, name, functionEntry)
        pending.push({ func, type })
        functions.set(functionEntry, func)
        references.set(func.name, functionLocation)
        return functionEntry
    }

    function checkFunction(pending: PendingFunction) {
        scope(() => {
            const func = pending.func

            // Set the context
            scopes.resultContext = pending.type.result
            scopes.typeContext = pending.type.result

            // Create parameter locations
            let parameterIndex = 0
            pending.type.parameters.forEach((_, param) => {
                const location: ValLocation = {
                    kind: LocationKind.Val,
                    type: param.type
                }

                let parameter: Parameter
                if (param.modifier & FunctionTypeParameterModifier.Context && param.name == "self") {
                    const self: Reference = { kind: Kind.Reference, name: "self" }
                    parameter = {
                        start: func.start,
                        end: func.end,
                        kind: Kind.Parameter,
                        modifier: ParameterModifier.None,
                        name: self,
                        alias: self,
                        type: { kind: Kind.Infer }
                    }
                } else {
                    parameter = func.parameters[parameterIndex++]
                }
                enterLocation(parameter, parameter.alias, location)
                if (param.modifier & FunctionTypeParameterModifier.Context) {
                    const contextType = param.type
                    if (contextType.kind == TypeKind.Struct) {
                        contextType.fields.forEach((name, field) => {
                            if (!scopes.locations.has(name)) {
                                const selfLocation: ContextLocation = {
                                    kind: LocationKind.Context,
                                    type: field.type,
                                    location
                                }
                                const fieldNode = required(fields.get(field))
                                enterLocation(fieldNode, fieldNode.name, selfLocation)
                            }
                        })
                        contextType.methods.forEach((name, method) => {
                            if (!scopes.functions.has(name)) {
                                scopes.functions.enter(name, method)
                            }
                        })
                    }
                }
            })
            const type = checkExpression(func.body)
            mustMatch(func.body, pending.type.result, type)
        })
    }

    function convertFunctionParameters(parameters: Parameter[]): Scope<FunctionTypeParameter> {
        const scope = new Scope<FunctionTypeParameter>()
        for (const parameter of parameters) {
            const convertedParameter = convertFunctionParameter(parameter)
            scopeEnter(parameter, scope, convertedParameter.name, convertedParameter)
        }
        return scope
    }

    function convertFunctionParameter(parameter: Parameter): FunctionTypeParameter {
        const nameRef = parameter.name
        const name = typeof nameRef == 'number' ? nameRef.toString() : nameRef.name
        const position = typeof nameRef == 'number' ? nameRef : -1
        const modifier = parameter.modifier as unknown as FunctionTypeParameterModifier
        const alias = parameter.alias.name
        const type = convertTypeExpression(parameter.type)
        return {
            name,
            alias,
            position,
            modifier,
            type,
            node: parameter
        }
    }

    function convertTypeExpression(type: TypeExpression): Type {
        switch (type.kind) {
            case Kind.ArrayTypeConstructor: {
                const element = convertTypeExpression(type.element)
                if (type.size != undefined) {
                    const { value: size } = evaluateToConstant(type.size, i32Type)
                    return {
                        kind: TypeKind.Array,
                        element,
                        size
                    }
                } else {
                    return {
                        kind: TypeKind.Slice,
                        element,
                    }
                }
            }
            case Kind.FunctionType: {
                const parameters = convertFunctionParameters(type.parameters)
                const result = convertTypeExpression(type.result)
                return {
                    kind: TypeKind.Lambda,
                    parameters,
                    result
                }
            }
            case Kind.Reference: {
                const referant = scopes.types.find(type.name)
                if (!referant) {
                    report(type, `Undefined type symbol '${type.name}'`)
                    return errorType
                }
                return referant
            }
            case Kind.Infer: {
                return fresh()
            }
            case Kind.StructTypeConstructor:
                return convertStructConstructor(type)
            case Kind.TypeSelect: {
                const target = convertTypeExpression(type.target)
                const referent = scopes.types.find(type.name.name)
                if (!referent) {
                    report(type, "Type not found")
                    return errorType
                }
                return referent
            }

        }
    }

    function evaluateToConstant(expression: Expression, type: Type): ConstResult {
        switch (expression.kind) {
            case Kind.Reference: {
                const referent = scopes.locations.find(expression.name)
                if (!referent) {
                    report(expression, `Undefined symbol '${expression.name}`)
                    return constError
                }
                if (referent.kind != LocationKind.Let) {
                    report(expression, "Expected a refernece to let")
                    return constError
                }
                const resultType = mustMatch(expression, type, referent.type)
                return { type: resultType, value: referent.value }
            }

            case Kind.Literal: {
                const literalType = checkExpression(expression)
                const resultType = mustMatch(expression, type, literalType)
                return { type: resultType, value: expression.value }
            }

            case Kind.Call: {
                const target = expression.target
                if (target.kind != Kind.Select) {
                    report(expression, "Expected a constant expression")
                    return constError
                }
                const opName = target.name.name
                const synthetic = syntheticOf(type)
                const method = synthetic.methods.find(opName)
                if (!method) {
                    report(expression, "Unsupported operation in a constant expression")
                    return constError
                }
                const left = evaluateToConstant(target.target, type)

                function binary(call: Call, op: (a: any, b: any) => any): any {
                    const right = call.arguments[0]
                    required(right && !right.name, expression)
                    const rightValue = evaluateToConstant(right.value, type)
                    return op(left, rightValue)
                }

                switch (opName) {
                    case 'prefix +': return { value: left, type }
                    case 'prefix -': return { value: -left, type }
                    case 'infix +': return { value: binary(expression, (a, b) => a + b), type }
                    case 'infix -': return { value: binary(expression, (a, b) => a - b), type }
                    case 'infix *': return { value: binary(expression, (a, b) => a * b), type }
                    case 'infix /': {
                        const value = binary(expression, (a, b) => {
                            if (b == 0) return undefined
                            return a / b
                        })
                        if (value == undefined) {
                            report(expression, "Divide by zero")
                        }
                        return { value, type }
                    }
                    default: {
                        report(expression, "Unsupported operaiton in a const expression")
                        return constError
                    }
                }
            }
            default:
                report(expression, "Expected a constant expression")
                return constError
        }
    }

    function convertStructConstructor(struct: StructTypeConstructor): StructType {
        const self: StructType = { kind: TypeKind.Struct } as any
        scope(() => {
            scopes.types.enter("self", self)
            scopes.declarationContext = self
            self.types = buildScope(struct.types, convertTypeDeclaration)
            self.fields = buildScope(struct.fields, convertStructConstructorField)
            self. methods = buildScope(struct.methods, m => enterFunction(m, FunctionModifier.Method))
        })
        return self
    }

    function convertStructConstructorField(field: StructTypeConstuctorField): StructField {
        const name = field.name.name
        const modifier = field.modifier as unknown as StructFieldModifier
        const type = convertTypeExpression(field.type)
        const result: StructField = { name, modifier, type }
        fields.set(result, field)
        return result
    }

    function checkExpression(expression: Expression, checkMethods: boolean = false): Type {
        return assoc(expression, () => {
            switch (expression.kind) {
                case Kind.ArrayLiteral: {
                    const typeContext = scopes.typeContext ?? voidType
                    const element: Type = typeContext.kind == TypeKind.Array || typeContext.kind == TypeKind.Slice ? typeContext.element : fresh()
                    for (const value of expression.values) {
                        const valueType = checkExpression(value)
                        mustMatch(value, element, valueType)
                    }
                    if (typeContext.kind == TypeKind.Slice) {
                        return {
                            kind: TypeKind.Slice,
                            element: simplify(element)
                        }
                    } else {
                        return {
                            kind: TypeKind.Array,
                            element: simplify(element),
                            size: expression.values.length
                        }
                    }
                }

                case Kind.As: {
                    report(expression, "As not supported yet (if ever)")
                    return errorType
                }

                case Kind.Assign: {
                    // TODO: validate the target is a var location
                    const target = checkExpression(expression.target)
                    const value = checkExpression(expression.value)
                    mustMatch(expression, target, value)
                    return target
                }

                case Kind.Block:
                    return checkStatments(expression.statements)

                case Kind.Call:
                    return checkCall(expression)

                case Kind.If:
                    return checkIf(expression)

                case Kind.Index:
                    return checkIndex(expression)

                case Kind.Lambda:
                    return checkLambda(expression)

                case Kind.Reference:
                    return checkReference(expression, checkMethods)

                case Kind.Literal:
                    return checkLiteral(expression)

                case Kind.Range:
                    return checkRange(expression)

                case Kind.Select:
                    return checkSelect(expression, checkMethods)

                case Kind.StructLiteral:
                    return checkStructLiteral(expression)

                case Kind.When:
                    return checkWhen(expression)

            }
        })
    }

    function checkCall(call: Call): Type {
        const target = checkExpression(call.target, /* checkMethods: */ true)
        if (target.kind != TypeKind.Function && target.kind != TypeKind.Lambda) {
            if (target.kind != TypeKind.Error) {
                report(call.target, "Expected a function or lambda")
            }
            return errorType
        }
        let position = 0
        let used = new Set<string>()
        for (const argument of call.arguments) {
            const argumentType = checkExpression(argument.value)
            const name = argument.name?.name ?? position.toString()
            if (used.has(name)) {
                report(argument, "Duplicate argument")
                return errorType
            }
            const parameter = target.parameters.find(name)
            if (!parameter) {
                if (argument.name) {
                    report(argument.value, "Argument not found")
                } else {
                    let message = "Too many positional arguments"
                    const missing = unused(used, target.parameters)
                    if (missing.length) {
                        message += ", expected the following named parameters: " + missing.join(", ")
                    }
                    report(argument.value, message)
                }
                return errorType
            }
            mustMatch(argument.value, parameter.type, argumentType)
            used.add(name)
            if (!argument.name) position++
        }

        if (used.size == target.parameters.size) {
            // All parameter are supplied
            return target.result
        }

        // process context
        target.parameters.forEach((name, param) => {
            if (param.modifier & FunctionTypeParameterModifier.Context) {
                used.add(name)
                // TODO: Validate the context
            }
        })

        if (used.size == target.parameters.size) {
            // Context supplied the rest
            return target.result
        }

        // Produce a curried type
        let curryPosition = 0
        const curryParameters = new Scope<FunctionTypeParameter>()
        target.parameters.forEach((name, parameter) => {
            if (!used.has(name)) {
                if (parameter.position >= 0)  {
                    const newParameter = {...parameter, position: curryPosition }
                    curryParameters.enter(curryPosition.toString(), newParameter)
                } else {
                    curryParameters.enter(parameter.name, parameter)
                }
            }
        })
        return { ...target, parameters: curryParameters }
    }

    function unused<T>(used: Set<string>, scope: Scope<FunctionTypeParameter>): string[] {
        const result: string[] = []
        scope.forEach((name, param) => {
            if (param.position < 0 && !used.has(name) ) result.push(name)
        })
        return result
    }

    function checkIf(expression: If): Type {
        const condition = checkExpression(expression.condition)
        mustMatch(expression.condition, booleanType, condition)
        const thenType = checkExpression(expression.then)
        const elsetype = checkExpression(expression.else)
        const ifType = mustMatch(expression.else, thenType, elsetype)
        return simplify(ifType)
    }

    function checkIndex(expression: Index): Type {
        const targetType = checkExpression(expression.target)
        if (targetType.kind != TypeKind.Array && targetType.kind != TypeKind.Slice) {
            if (targetType.kind != TypeKind.Error) {
                report(expression.target, "Expected an array or a slice")
            }
            return errorType
        }
        const indexType = checkExpression(expression.index)
        if (indexType.kind == TypeKind.Range) {
            return { kind: TypeKind.Slice, element: targetType.element }
        }
        mustMatch(expression.index, i32Type, indexType)
        return targetType.element
    }

    function checkLambda(lambda: Lambda): Type {
        const parameters = convertFunctionParameters(lambda.parameters)
        const result = convertTypeExpression(lambda.result)
        const body = checkExpression(lambda.body)
        mustMatch(lambda.body, result, body)
        requiredBound(lambda.body, result)
        return {
            kind: TypeKind.Lambda,
            parameters,
            result: simplify(result)
        }
    }

    function checkReference(reference: Reference, checkFunctions: boolean): Type {
        if (checkFunctions) {
            const method = scopes.functions.find(reference.name)
            if (method) {
                const loc: FunctionLocation = {
                    kind: LocationKind.Function,
                    func: method,
                    type: method.type,
                    exported: false
                }
                enterLocation(method, reference, loc)
                return method.type
            }
        }
        const location = scopes.locations.find(reference.name)
        if (!location) {
            if (!checkFunctions) {
                const method = scopes.functions.find(reference.name)
                if (method) {
                    report(reference, `The function '${reference.name}' should be called`)
                    return errorType
                }
            }
            if (scopes.selectContext) {
                report(reference, `Type ${nameOfType(scopes.selectContext)} does not have a member called ${reference.name}`)
            } else {
                report(reference, `Undefined identifier '${reference.name}'`)
            }
            return errorType
        }
        references.set(reference, location)
        return location.type
    }

    function checkLiteral(literal: Literal): Type {
        switch (literal.primitiveKind) {
            case PrimitiveKind.Bool: return booleanType
            case PrimitiveKind.Char: return charType
            case PrimitiveKind.I8: return i8Type
            case PrimitiveKind.I16: return i16Type
            case PrimitiveKind.I32: return i32Type
            case PrimitiveKind.I64: return i64Type
            case PrimitiveKind.U8: return u8Type
            case PrimitiveKind.U16: return u16Type
            case PrimitiveKind.U32: return u32Type
            case PrimitiveKind.U64: return u64Type
            case PrimitiveKind.F32: return f32Type
            case PrimitiveKind.F64: return f64Type
            case PrimitiveKind.Null: {
                report(literal, "null not supported yet (if ever)")
                return errorType
            }
            case PrimitiveKind.String: return stringType
        }
    }

    function checkRange(range: Range): Type {
        if (range.right) {
            const rightType = checkExpression(range.right)
            mustMatch(range.right, i32Type, rightType)
        }
        if (range.left) {
            const leftType = checkExpression(range.left)
            mustMatch(range.left, i32Type, leftType)
        }
        return { kind: TypeKind.Range }
    }

    function checkSelect(select: Select, checkMethods: boolean): Type {
        const target = checkExpression(select.target)
        return open(target, () => {
            return checkExpression(select.name, checkMethods)
        })
    }

    function checkStructLiteral(literal: StructLiteral): Type {
        const typeContext = scopes.typeContext
        if (!typeContext) {
            report(literal, "A type cannot be determined for the literal")
            return errorType
        }
        if (typeContext.kind != TypeKind.Struct) {
            report(literal, "A literal must be specified in a struct type context")
            return errorType
        }

        const used = new Set<string>()
        for (const field of literal.fields) {
            const name = field.name.name
            const typeField = typeContext.fields.find(name)
            if (!typeField) {
                report(field, `${nameOfType(typeContext)} does not have a field named ${name}`)
                return errorType
            }
            inTypeContext(typeField.type, () => {
                const valueType = checkExpression(field.value)
                mustMatch(field.value, typeField.type, valueType)
            })
            used.add(name)
        }
        if (used.size != typeContext.fields.size) {
            const missing: string[] = []
            typeContext.fields.forEach((name, _) => {
                if (!used.has(name)) missing.push(name)
            })
            report(literal, `Missing values for ${missing.join(", ")}`)
            return errorType
        }
        return typeContext
    }

    function checkWhen(when: When): Type {
        return scope(() => {
            const target = when.target
            let targetType: Type = booleanType
            if (target) {
                switch (target.kind) {
                    case Kind.Val:
                    case Kind.Var: {
                        const name = target.name
                        const valueType = checkExpression(required(target.value, when))
                        enterLocation(target, name, {
                            kind: target.kind == Kind.Val ? LocationKind.Val : LocationKind.Var,
                            type: valueType
                        })
                        targetType = valueType
                        break
                    }
                    default:
                        targetType = checkExpression(target)
                }
            }
            const result = fresh()
            for (const clause of when.clauses) {
                const condition = clause.condition
                const conditionType = inTypeContext(targetType, () => {
                    switch (condition.kind) {
                        case Kind.IsCondition:
                            report(clause, "is clause not supported")
                            return errorType
                        case Kind.ElseCondition:
                            return targetType
                        case Kind.Range:
                            checkExpression(condition)
                            return i32Type
                        default:
                            return checkExpression(condition)
                    }
                })
                mustMatch(clause.condition, targetType, conditionType)
                const bodyType = checkExpression(clause.body)
                mustMatch(clause.body, result, bodyType)
            }
            return simplify(result)
        })
    }

    function checkStatments(statements: Statement[]): Type {
        return scope(() => {
            const lastStatement = statements[statements.length - 1]
            let last = voidType
            let unreachableReported = false
            for (const statement of statements) {
                if (last.kind == TypeKind.Never) {
                    if (!unreachableReported) {
                        report(statement, "Unreachable code")
                        unreachableReported = true
                    }
                }
                const typeContext = statement === lastStatement ? scopes.typeContext ?? voidType : voidType
                inTypeContext(typeContext, () => {
                    last = checkStatement(statement)
                })
            }
            return last
        })
    }

    function checkStatement(statement: Statement): Type {
        switch (statement.kind) {
            case Kind.Function:
                report(statement, "Nested functions not supported yet.")
                return errorType
            case Kind.Val:
            case Kind.Var:
            case Kind.Let:
            case Kind.TypeDeclaration:
                checkDeclaration(statement)
                return voidType
            case Kind.For:
                checkForStatement(statement)
                return voidType
            case Kind.While:
                checkWhileStatement(statement)
                return voidType
            case Kind.Break:
            case Kind.Continue:
            case Kind.Return:
                return neverType
            default:
                return checkExpression(statement)
        }
    }

    function checkForStatement(forStatement: For) {
        scope(() => {
            let item = forStatement.item
            let name = item.name
            let indexName = forStatement.index?.name
            let itemType: Type
            const targetType = simplify(checkExpression(forStatement.target))
            switch (targetType.kind) {
                case TypeKind.Array:
                case TypeKind.Slice:
                    itemType = targetType.element
                    break
                case TypeKind.Error:
                    itemType = errorType
                    break
                case TypeKind.String:
                    itemType = charType
                    break
                case TypeKind.Range:
                    itemType = i32Type
                    break
                case TypeKind.Open:
                    report(forStatement.target, "Type cannot be inferred")
                    itemType = errorType
                    break
                default:
                    report(forStatement.target, "Expected an array, slice, range or string (iterable eventually)")
                    itemType = errorType
                    break
            }

            const itemLocation: ValLocation | VarLocation = {
                kind: item.kind == Kind.Var ? LocationKind.Var : LocationKind.Val ,
                type: itemType
            }
            enterLocation(forStatement.item, name, itemLocation)
            if (indexName) {
                const index: ValLocation = {
                    kind: LocationKind.Val,
                    type: i32Type
                }
                enterLocation(forStatement.index as ImplicitVal, indexName, index)
            }
            checkExpression(forStatement.body)
        })
        return voidType
    }

    function checkWhileStatement(whileStatement: While) {
        const conditionType = checkExpression(whileStatement.condition)
        mustMatch(whileStatement.condition, booleanType, conditionType)
        checkExpression(whileStatement.body)
    }

    function convertTypeDeclaration(declaration: TypeDeclaration): Type {
        return convertTypeExpression(declaration.type)
    }

    function mustMatch(location: Locatable, expected: Type, received: Type): Type {
        if (expected == received) return received
        if (expected.kind == TypeKind.Open) {
            const expectedBound = expected.bound
            if (expectedBound) {
                return mustMatch(location, expectedBound, received)
            }
            if (received.kind == TypeKind.Open) {
                const receivedBound = received.bound
                if (receivedBound) {
                    return bind(received, expected)
                } else {
                    return join(expected, received)
                }
            } else {
                bind(expected, received)
                return received
            }
        }
        if (received.kind == TypeKind.Open) {
            const receivedBound = received.bound
            if (receivedBound) {
                return mustMatch(location, expected, receivedBound)
            } else {
                return bind(received, expected)
            }
        }
        if (expected.kind == TypeKind.Error || expected.kind == TypeKind.Never) return received
        if (received.kind == TypeKind.Error || received.kind == TypeKind.Never) return expected
        if (expected != received) {
            if (expected.kind == received.kind) {
                switch (expected.kind) {
                    case TypeKind.Boolean:
                    case TypeKind.Char:
                    case TypeKind.String:
                    case TypeKind.I8:
                    case TypeKind.I16:
                    case TypeKind.I32:
                    case TypeKind.I64:
                    case TypeKind.U8:
                    case TypeKind.U16:
                    case TypeKind.U32:
                    case TypeKind.U64:
                    case TypeKind.F32:
                    case TypeKind.F64:
                    case TypeKind.Void:
                    case TypeKind.Range:
                        return received
                    case TypeKind.Array:
                        if (expected.size == (received as ArrayType).size) {
                            mustMatch(location, expected.element, (received as ArrayType).element)
                            return expected
                        }
                        break
                    case TypeKind.Slice: {
                        mustMatch(location, expected.element, (received as SliceType).element)
                        return expected
                    }
                    case TypeKind.Struct: {
                        // Structs must be identitical
                        break;
                    }
                    case TypeKind.Function:
                    case TypeKind.Lambda: {
                        const _received = received as FunctionType
                        const expectedParameters = expected.parameters
                        const receivedParameters = _received.parameters
                        let success = true
                        if (expectedParameters.size == receivedParameters.size) {
                            for (const name of expectedParameters.names()) {
                                const expectedParameter = required(expectedParameters.find(name), location)
                                const receivedParameter = receivedParameters.find(name)
                                if (!receivedParameter || expectedParameter.modifier != receivedParameter.modifier) {
                                    success = false
                                    break
                                }
                                mustMatch(location, expectedParameter.type, receivedParameter.type)
                            }
                            mustMatch(location, expected.result, _received.result)
                            if (success) return expected
                        }
                        break
                    }

                }
            }
        }

        report(location, `Mismatched types, expected ${nameOfType(expected)}, received ${nameOfType(received)}`)
        return errorType
    }

    function buildScope<N extends { name: Reference }, T>(nodes: N[], tx: (node: N) => T): Scope<T> {
        const scope = new Scope<T>()
        for (const node of nodes) {
            const type = tx(node)
            scopeEnter(node.name, scope, node.name.name, type)
        }
        return scope
    }

    function scope<R>(cb: () => R): R {
        let oldScopes = scopes
        scopes = {
            types: new Scope(scopes.types),
            locations: new Scope(scopes.locations),
            context: new Scope(scopes.context),
            functions: new Scope(scopes.functions),
            resultContext: scopes.resultContext,
            typeContext: scopes.typeContext,
            declarationContext: scopes.declarationContext
        }
        const result = cb()
        scopes = oldScopes
        return result
    }

    function open(type: Type, cb: () => Type): Type {
        if (type.kind == TypeKind.Error) {
            return type
        }
        let oldScopes = scopes
        const synthetic = syntheticOf(type)
        scopes = {
            types: new Scope(scopes.types, synthetic.types),
            locations: new Scope(fieldsToLocations(synthetic.fields), scopes.locations),
            functions: new Scope(synthetic.methods, scopes.functions),
            context: new Scope(scopes.context),
            typeContext: scopes.typeContext,
        }
        scopes.selectContext = type
        const result = cb()
        scopes = oldScopes
        return result
    }

    function assoc(item: Expression | Statement, cb: () => Type): Type {
        const type = cb()
        types.set(item, type)
        return type
    }

    function inTypeContext<R>(type: Type, cb: () => R): R {
        let oldScopes = scopes
        scopes = { ...scopes, typeContext: type }
        const result = cb()
        scopes = oldScopes
        return result
    }

    function enterLocation(storageNode: StorageNode, name: Reference, item: Location) {
        if (item.kind != LocationKind.Function) {
            scopeEnter(name, scopes.locations, name.name, item)
        }
        locations.set(item, storageNode)
        references.set(name, item)
    }

    function scopeEnter<T>(location: Locatable, scope: Scope<T>, name: string, item: T) {
        if (scope.has(name)) {
            report(location, "Duplicate parmaeter name")
            return
        }
        scope.enter(name, item)
    }

    function requiredBound(location: Locatable, type: Type): Type {
        let seen = new Set<Type>()

        function req(type: Type): Type {
            if (seen.has(type)) return type
            seen.add(type)
            switch (type.kind) {
                case TypeKind.Array:
                case TypeKind.Slice:
                    req(type.element)
                    return type
                case TypeKind.Boolean:
                case TypeKind.Char:
                case TypeKind.Error:
                case TypeKind.F32:
                case TypeKind.F64:
                case TypeKind.I16:
                case TypeKind.I32:
                case TypeKind.I64:
                case TypeKind.I8:
                case TypeKind.Never:
                case TypeKind.Range:
                case TypeKind.String:
                case TypeKind.U16:
                case TypeKind.U32:
                case TypeKind.U64:
                case TypeKind.U8:
                case TypeKind.Void:
                    return type
                case TypeKind.Function:
                case TypeKind.Lambda:
                    type.parameters.forEach((_, param) => req(param.type))
                    req(type.result)
                    return type
                case TypeKind.Struct:
                    type.fields.forEach((_, field) => req(field.type))
                    type.methods.forEach((_, method) => req(method.type))
                    type.types.forEach((_, type) => req(type))
                    return type
                case TypeKind.Open: {
                    if (type.primary.bound) {
                        return req(type.primary.bound)
                    }
                    report(location, "Type could not be inferred")
                    return errorType
                }
            }
        }

        return req(type)
    }

    function report(location: Locatable, message: string) {
        diagnostics.push({ location, message  })
    }
}

interface Scopes {
    types: Scope<Type>
    locations: Scope<Location>
    context: Scope<Location>
    functions: Scope<Function>
    typeContext?: Type
    resultContext?: Type
    declarationContext?: Type
    selectContext?: Type
}

export const enum LocationKind {
    Var,
    Val,
    Let,
    Context,
    Function,
}

export type Location = LetLocation | ValLocation | VarLocation | ContextLocation | FunctionLocation

export interface LetLocation {
    kind: LocationKind.Let
    type: Type
    value: any
}

export interface ValLocation {
    kind: LocationKind.Val
    type: Type
}

export interface VarLocation {
    kind: LocationKind.Var
    type: Type
}

export interface ContextLocation {
    kind: LocationKind.Context
    type: Type
    location: Location
}

export interface FunctionLocation {
    kind: LocationKind.Function
    type: Type
    func: Function
    exported: boolean
}

function fieldsToLocations(fields: Scope<StructField>): Scope<Location> {
    const result = new Scope<Location>()
    fields.forEach((name, field) => {
        result.enter(name, { kind: field.modifier == StructFieldModifier.Var ? LocationKind.Var : LocationKind.Var, type: field.type  })
    })
    return result
}

function simplify(type: Type): Type {
    if (type.kind == TypeKind.Open && type.primary.bound) return type.primary.bound
    return type
}

function fresh(): OpenType {
    const result: OpenType = { kind: TypeKind.Open, size: 1 } as any
    result.next = result
    result.primary = result
    return result
}

function join(a: OpenType, b: OpenType): OpenType {
    const aPrim = a.primary
    const bPrim = b.primary
    const shorter = aPrim.size > bPrim.size ? b : a
    const longer = aPrim.size > bPrim.size ? a : b
    longer.size = aPrim.size + bPrim.size
    for (let current = shorter; current != shorter; current = current.next) {
        current.primary = longer
    }
    return longer
}

function bind(a: OpenType, b: Type): Type {
    a.primary.bound = b
    return b
}

function nameOfType(type: Type): string {
    const openNames = new Map<OpenType, string>()

    function parameterText(parameter: FunctionTypeParameter): string {
        return (parameter.modifier & FunctionTypeParameterModifier.Var ? "var " : "") +
            (parameter.modifier & FunctionTypeParameterModifier.Context ? "context " : "") +
            `${parameter.name} ${parameter.alias}: ${nameOfType(parameter.type)}`
    }

    function functionText(func: FunctionType | LambdaType): string {
        return `{ ${func.parameters.map((_, p) => parameterText(p)).join(", ")} }: ${nameOfType(func.result)}`
    }

    function nameOfType(type: Type): string {
        switch (type.kind) {
            case TypeKind.I8: return "i8"
            case TypeKind.I16: return "i16"
            case TypeKind.I32: return "i32"
            case TypeKind.I64: return "i64"
            case TypeKind.U8: return "u8"
            case TypeKind.U16: return "u16"
            case TypeKind.U32: return "u32"
            case TypeKind.U64: return "u64"
            case TypeKind.F32: return "f32"
            case TypeKind.F64: return "f64"
            case TypeKind.Boolean: return "bool"
            case TypeKind.String: return "string"
            case TypeKind.Char: return "char"
            case TypeKind.Void: return "void"
            case TypeKind.Array: return `${nameOfType(type.element)}[${type.size}]`
            case TypeKind.Slice: return `${nameOfType(type.element)}[]`
            case TypeKind.Struct: return type.name ?? "<struct>"
            case TypeKind.Function:
            case TypeKind.Lambda: return functionText(type)
            case TypeKind.Range: return "range"
            case TypeKind.Never: return "<never>"
            case TypeKind.Error: return "<error>"
            case TypeKind.Open: {
                let name = openNames.get(type.primary)
                if (name) return name
                name = nameFor(openNames.size) + "'"
                openNames.set(type.primary, name)
                return name
            }
        }
    }

    return nameOfType(type)
}

function nameFor(value: number): string {
    if (value >= 26) {
        return nameFor(value / 26 - 1) + nameFor(value % 26)
    }
    return String.fromCharCode('a'.charCodeAt(0) + value)
}
