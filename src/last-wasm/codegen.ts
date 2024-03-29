import {
    ArrayLiteral, Assign, Call, CheckResult, Function, Global, IfThenElse, Import, ImportFunction, Index, Last,
    LastKind, Let, PrimitiveKind, Locatable, Loop, Module, nameOfLastKind, Scope, Select, StructLiteral, Type,
    TypeKind, Var, u8Type, MemoryMethod
} from "../last"
import {
    error, required, unsupported
} from "../utils"
import {
    ByteWriter, CodeSection, DataSection, ExportKind, ExportSection, FunctionSection, gen, ImportSection, Inst, label,
    Label, Mapping, MemorySection, Module as WasmModule, Mut, Section, StartSection, TypeIndex, TypeSection, ValueType, DeferredCode
} from "../wasm"
import { GlobalSection } from "../wasm/globalsection"
import {
    ArrayLiteralGenNode, AssignGenNode, BigIntConstGenNode, BlockGenNode, BodyGenNode, BranchTableGenNode, ClampGenNode,
    CompareGenNode, DataAllocator, DataGenNode, DoubleConstGenNode, DropGenNode, emptyGenNode, flattenTypes,
    FunctionGenNode, GenNode, GenType, genTypeOf, GotoGenNode, i32GenType, LocalAllocator, LocationAllocator,
    NumberConstGenNode, OpGenNode, ReturnGenNode, StructLiteralGenNode, UnaryOpGenNode, voidGenType,
    voidPointerGenType, zeroGenNode, builtinGenNodeFor, IfThenGenNode, LoopGenNode, trueGenNode, falseGenNode,
    GlobalsAllocator, LocalIndexes, GlobalGenNode, TypeConvertGenNode, MemoryMethodGenNode,
} from "./gennode"

interface Scopes {
    branchTargets: Scope<Label>
    nodes: Scope<GenNode>
    alloc: LocationAllocator
    globals: GlobalsAllocator
}

interface FunctionDeclaration  {
    funcGenNode: GenNode
    funcIndex: number
    code: DeferredCode
}

export function codegen(
    lastModule: Module,
    checkResult: CheckResult,
    wasmModule: WasmModule,
    mappings: boolean = false
) {
    const { types, exported } = checkResult
    const genTypes = new Map<Type, GenType>()
    const typeSection = new TypeSection()
    const importSection = new ImportSection()
    const codeSection = new CodeSection()
    const dataSection = new DataSection()
    const initGen = gen()
    const dataAllocator = new DataAllocator(dataSection, 0, initGen)
    const exportSection = new ExportSection()
    const memorySection = new MemorySection(0)
    let startSection: StartSection | undefined = undefined
    const functions = new Map<Function, FunctionDeclaration>()

    // Allocate the top-of-memory variable.
    dataAllocator.allocate({ start: 0 }, voidPointerGenType)

    function typeOfType(location: Locatable | undefined, type: Type | undefined): GenType {
        return genTypeOf(location, required(type, location), genTypes)
    }

    function typeOf(tree: Last): GenType {
        return typeOfType(tree, types.get(tree))
    }

    const rootScope = new Scope<GenNode>()
    const globalSection = new GlobalSection(importSection.globalsCount)
    const globalsAllocator = new GlobalsAllocator(globalSection)
    const rootScopes: Scopes = {
        branchTargets: new Scope<Label>(),
        nodes: rootScope,
        alloc: dataAllocator,
        globals: globalsAllocator,
    }

    genImports(lastModule.imports, rootScopes)
    const funcSection = new FunctionSection(importSection.funcsCount)

    statementsToBodyGenNode(voidGenType, lastModule.declarations, rootScopes)

    // Allocate memory if necessary
    if (dataAllocator.size > 4) {
        const min = (dataAllocator.size + 0xFFFF) >> 16
        memorySection.allocate({ min })
        const topValue = new ByteWriter(4)
        topValue.writeU32LittleEndian(dataAllocator.size)
        const g = gen()
        zeroGenNode.load(g)
        g.inst(Inst.End)
        const address = new ByteWriter()
        g.write(address)
        dataSection.allocateActive(topValue, address)
    }

    // Allocate an init function if necessary
    if (initGen.size() > 0) {
        const type = typeSection.funtionType({parameters: [], result: []})
        const funcIndex = funcSection.allocate(type)
        const bytes = new ByteWriter()
        initGen.inst(Inst.End)
        initGen.write(bytes)
        codeSection.allocate(initGen.currentLocals(), bytes)
        startSection = new StartSection(funcIndex)
    }

    function addSection(section: Section | undefined) {
        if (section && !section.empty()) wasmModule.addSection(section)
    }

    addSection(typeSection)
    addSection(importSection)
    addSection(funcSection)
    addSection(memorySection)
    addSection(globalSection)
    addSection(exportSection)
    addSection(startSection)
    addSection(codeSection)
    addSection(dataSection)

    function genImports(imports: Import[], scopes: Scopes) {
        for (const importStatement of imports) {
            for (const item of importStatement.imports) {
                switch (item.kind) {
                    case LastKind.ImportFunction: {
                        const typeIndex = typeIndexOf(item)
                        const funcIndex = importSection.importFunction(
                            item.module.name,
                            item.name.name,
                            typeIndex
                        )
                        const resultType = typeOf(item)
                        const functionGenNode = new FunctionGenNode(item, resultType, funcIndex)
                        scopes.nodes.enter((item.as ?? item.name).name, functionGenNode)
                        break
                    }
                    case LastKind.ImportVariable: {
                        const type = typeOf(item)

                        function typeToIndexes(indexes: LocalIndexes): LocalIndexes {
                            if (typeof indexes === "number") {
                                return importSection.importGlobal(
                                    item.module.name,
                                    item.name.name,
                                    Mut.Var,
                                    indexes
                                )
                            } else {
                                return indexes.map(typeToIndexes)
                            }
                        }

                        const indexes = typeToIndexes(type.locals(item))
                        const global = new GlobalGenNode(item, type, indexes)
                        scopes.nodes.enter((item.as ?? item.name).name, global)
                        break
                    }
                }
            }
        }
    }

    function statementsToBodyGenNode(containerType: GenType, nodes: Last[], scopes: Scopes) {
        declareFunctions(nodes, scopes)
        const statements = statementsToGenNode(containerType, nodes, scopes)
        const location = { start: nodes[0]?.start, end: nodes[nodes.length - 1]?.end }
        const bodyType = statements.length > 0 ? statements[statements.length - 1].type : voidGenType
        return new BodyGenNode(location, bodyType, statements)
    }

    function blockElementsToGenNode(container: Last, nodes: Last[], scopes: Scopes, l: Label = label()): BlockGenNode {
        const blockScope = new Scope<GenNode>(scopes.nodes)
        const blockScopes = {...scopes, nodes: blockScope }
        const containerType = typeOf(container)
        const statements = statementsToGenNode(containerType, nodes, blockScopes)
        const type = statements.length > 0 ? statements[statements.length - 1].type : voidGenType
        const location = { start: nodes[0]?.start, end: nodes[nodes.length - 1]?.end }
        return new BlockGenNode(location, type, statements, l)
    }

    function statementsToGenNode(containerType: GenType, nodes: Last[], scopes: Scopes): GenNode[] {
        const statements: GenNode[] = []
        const len = nodes.length
        const prev = len - 1
        for (let i = 0; i < prev; i++ ) {
            const node = nodes[i]
            statements.push(statementToGenNode(node, scopes))
        }
        if (prev >= 0) {
            if (containerType.parts.void) {
                statements.push(statementToGenNode(nodes[prev], scopes))
            } else  {
                statements.push(lastToGenNode(nodes[prev], scopes))
            }
        }
        return statements
    }

    function dropIfNecessary(node: Last, target: GenNode):  GenNode {
        return target.type.parts.void ? target : new DropGenNode(node, target.type, target)
    }

    function statementToGenNode(node: Last, scopes: Scopes): GenNode {
        return dropIfNecessary(node, lastToGenNode(node, scopes))
    }

    function lastToGenNode(node: Last, scopes: Scopes): GenNode {
        switch (node.kind) {
            case LastKind.Add:
            case LastKind.Subtract:
            case LastKind.Multiply:
            case LastKind.Divide:
            case LastKind.Remainder:
            case LastKind.BitAnd:
            case LastKind.BitOr:
            case LastKind.BitXor:
            case LastKind.BitRotl:
            case LastKind.BitRotr:
            case LastKind.BitShl:
            case LastKind.BitShr:
            case LastKind.Minimum:
            case LastKind.Maximum:
            case LastKind.CopySign: {
                const left = lastToGenNode(node.left, scopes)
                let right = lastToGenNode(node.right, scopes)
                const type = typeOf(node)
                const tcType = type.type
                if (tcType.kind == TypeKind.Pointer) {
                    const pointerTarget = tcType.target
                    const pointerGenType = typeOfType(node, pointerTarget)
                    right = new OpGenNode(
                        node, i32GenType,
                        right,
                        new NumberConstGenNode(node, i32GenType, pointerGenType.size),
                        LastKind.Multiply
                    )
                }
                return new OpGenNode(node, type, left, right, node.kind)
            }
            case LastKind.CountLeadingZeros:
            case LastKind.CountTrailingZeros:
            case LastKind.CountNonZeros:
            case LastKind.AbsoluteValue:
            case LastKind.SquareRoot:
            case LastKind.Floor:
            case LastKind.Ceiling:
            case LastKind.Truncate:
            case LastKind.RoundNearest:
            case LastKind.BitNot: {
                const target = lastToGenNode(node.target, scopes)
                const type = typeOf(node)
                return new UnaryOpGenNode(node, type, target, node.kind)
            }
            case LastKind.ConvertTo:
            case LastKind.WrapTo:
            case LastKind.ReinterpretAs:
            case LastKind.TruncateTo: {
                const left = lastToGenNode(node.left, scopes)
                const from = typeOf(node.left)
                const type = typeOf(node)
                const saturated = node.kind == LastKind.TruncateTo && node.saturate
                return new TypeConvertGenNode(node, type, left, from, node.kind, saturated)
            }
            case LastKind.Not: {
                const target = lastToGenNode(node.target, scopes)
                const type = typeOf(node)
                return new UnaryOpGenNode(node, type, target, node.kind)
            }
            case LastKind.Negate: {
                const target = lastToGenNode(node.target, scopes)
                const type = typeOf(node)
                switch (type.type.kind) {
                    case TypeKind.F32:
                    case TypeKind.F64:
                        return new UnaryOpGenNode(node, type, target, node.kind)
                    case TypeKind.I8:
                    case TypeKind.I16:
                    case TypeKind.I32:
                        return new OpGenNode(node, type, zeroGenNode, target, LastKind.Subtract)
                }
                break
            }
            case LastKind.Equal:
            case LastKind.NotEqual:
            case LastKind.GreaterThan:
            case LastKind.GreaterThanEqual:
            case LastKind.LessThan:
            case LastKind.LessThanEqual: {
                const left = lastToGenNode(node.left, scopes)
                const right = lastToGenNode(node.right, scopes)
                return new CompareGenNode(node, left, right, node.kind)
            }
            case LastKind.AddressOf: {
                const target = lastToGenNode(node.target, scopes)
                return target.addressOf()
            }
            case LastKind.Dereference: {
                const targetGenNode = lastToGenNode(node.target, scopes)
                const targetType = typeOf(node.target).type
                if (targetType.kind != TypeKind.Pointer) {
                    error("Expected a pointer type", node.target)
                }
                const referencedType = typeOfType(node.target, targetType.target)
                return new DataGenNode(node, referencedType, targetGenNode)
            }
            case LastKind.Block: {
                const name = node.name
                let blockScopes = scopes
                let blockLabel: Label | undefined = undefined
                if (name) {
                    const branches = new Scope<Label>(scopes.branchTargets)
                    blockLabel = label()
                    branches.enter(name.name, blockLabel)
                    blockScopes = {...scopes, branchTargets: branches }
                }
                return blockElementsToGenNode(node, node.body, blockScopes, blockLabel)
            }
            case LastKind.Branch: {
                const l = required(scopes.branchTargets.find(node.target?.name ?? "$top"))
                return new GotoGenNode(node, l)
            }
            case LastKind.BranchIndexed: {
                const condition = lastToGenNode(node.condition, scopes);
                const labels = node.targets.map(
                    name => required(scopes.branchTargets.find(name.name))
                )
                const elseLabel = required(scopes.branchTargets.find(node.else.name))
                return new BranchTableGenNode(node, condition, labels, elseLabel)
            }
            case LastKind.Return: {
                const value = node.value
                const expr = value ? lastToGenNode(value, scopes) : undefined
                return new ReturnGenNode(node, expr)
            }
            case LastKind.Literal:
                switch (node.primitiveKind) {
                    case PrimitiveKind.I8:
                    case PrimitiveKind.I16:
                    case PrimitiveKind.I32:
                    case PrimitiveKind.U8:
                    case PrimitiveKind.U16:
                    case PrimitiveKind.U32:
                        return new NumberConstGenNode(node, typeOf(node), node.value)
                    case PrimitiveKind.I64:
                    case PrimitiveKind.U64:
                        return new BigIntConstGenNode(node, typeOf(node), node.value)
                    case PrimitiveKind.F32:
                    case PrimitiveKind.F64:
                        return new DoubleConstGenNode(node, typeOf(node), node.value)
                    case PrimitiveKind.Null:
                        return zeroGenNode
                    case PrimitiveKind.Bool:
                        return node.value ? trueGenNode : falseGenNode
                }
                break
            case LastKind.StructLiteral:
                return structLiteralToGenNode(node, scopes)
            case LastKind.Field:
                return lastToGenNode(node.value, scopes)
            case LastKind.ArrayLiteral:
                return arrayLitToGenNode(node, scopes)
            case LastKind.Reference:
                return required(scopes.nodes.find(node.name), node).reference(node)
            case LastKind.Select:
                return selectToGenNode(node, scopes)
            case LastKind.Index:
                return indexToGenNode(node, scopes)
            case LastKind.Assign:
                return assignToGenNode(node, scopes)
            case LastKind.Function:
                return functionToGenNode(node, scopes)
            case LastKind.Call:
                return callToGenNode(node, scopes)
            case LastKind.Var:
                return varToGenNode(node, scopes)
            case LastKind.Let:
                return letToGenNode(node, scopes)
            case LastKind.Global:
                return globalToGenNode(node, scopes)
            case LastKind.IfThenElse:
                return ifThenElseGenNode(node, scopes)
            case LastKind.Loop:
                return loopToGenNode(node, scopes)
            case LastKind.As:
                return lastToGenNode(node.left, scopes)
            case LastKind.Exported:
                return lastToGenNode(node.target, scopes)
            case LastKind.Memory:
                switch (node.method) {
                    case MemoryMethod.Limit:
                    case MemoryMethod.Top:
                        return new MemoryMethodGenNode(node, node.method)
                    case MemoryMethod.Grow:
                        return new MemoryMethodGenNode(node, node.method, lastToGenNode(node.amount, scopes))
                }
            case LastKind.SizeOf: {
                const targetType = typeOf(node.target)
                const valueType = typeOf(node)
                return new NumberConstGenNode(node, valueType, targetType.size)
            }
            case LastKind.ExportedMemory:
                exportSection.allocate(node.name.name, ExportKind.Mem, 0)
                return emptyGenNode
            case LastKind.Type:
            case LastKind.StructTypeLiteral:
            case LastKind.FieldLiteral:
            case LastKind.ArrayConstructor:
                return emptyGenNode
        }

        unsupported(node, `Unhandled node type ${nameOfLastKind(node.kind)}`)
    }

    function structLiteralToGenNode(tree: StructLiteral, scopes: Scopes): GenNode {
        const type = typeOf(tree)
        const fields = tree.fields.map(f => lastToGenNode(f, scopes))
        return new StructLiteralGenNode(tree, type, fields)
    }

    function arrayLitToGenNode(tree: ArrayLiteral, scopes: Scopes): GenNode {
        const type = typeOf(tree)
        let elements: GenNode[] = []
        const values = tree.values
        if (Array.isArray(values))
            elements = values.map(e => lastToGenNode(e, scopes))
        else if (values instanceof Uint8Array) {
            const u8GenType = typeOfType(tree, u8Type)
            for (const e of values) {
                elements.push(new NumberConstGenNode(tree, u8GenType, e))
            }
        } else {
            unsupported(tree, "Non-Uint8Array not yet supported")
        }
        return new ArrayLiteralGenNode(tree, type, elements)
    }

    function selectToGenNode(tree: Select, scopes: Scopes): GenNode {
        let target = lastToGenNode(tree.target, scopes)
        let targetType = read(required(types.get(tree.target)))
        if (targetType.kind == TypeKind.Pointer) {
            targetType = targetType.target
            target = new DataGenNode(tree, typeOfType(tree, targetType), target)
        }
        if (targetType.kind == TypeKind.Struct || targetType.kind == TypeKind.Union)
            return target.select(tree.name.name)
        else {
            const type = typeOf(tree)
            return builtinGenNodeFor(tree, targetType, type, tree.name.name, target)
        }
    }

    function indexToGenNode(node: Index, scopes: Scopes): GenNode {
        const target = lastToGenNode(node.target, scopes)
        const index = lastToGenNode(node.index, scopes)
        return target.index(index)
    }

    function assignToGenNode(node: Assign, scopes: Scopes): GenNode {
        const target = lastToGenNode(node.target, scopes)
        const value = lastToGenNode(node.value, scopes)
        return new AssignGenNode(node, target, value)
    }

    function typeIndexOf(node: Function | ImportFunction): TypeIndex {
        // Create the function type
        const parameters: ValueType[] = []
        for (const parameter of node.parameters) {
            const type = typeOf(parameter)
            parameters.push(...flattenTypes(type.locals(parameter)))
        }
        const resultType = typeOf(node)
        const result = flattenTypes(resultType.locals(node.result))
        return typeSection.funtionType({
            parameters,
            result
        })
    }

    function declareFunctions(nodes: Last[], scopes: Scopes) {
        for (const node of nodes) {
            switch (node.kind) {
                case LastKind.Function:
                    declareFunction(node, scopes)
                    break
                case LastKind.Exported:
                    if (node.target.kind == LastKind.Function) {
                        declareFunction(node.target, scopes)
                    }
                    break
            }
        }
    }

    function declareFunction(node: Function, scopes: Scopes): FunctionDeclaration {
        let result = functions.get(node)
        if (result) return result

        // Create the function type
        const typeIndex = typeIndexOf(node)
        const resultType = typeOf(node)

        // Create the function index
        const funcIndex = funcSection.allocate(typeIndex)
        const funcGenNode = new FunctionGenNode(node, resultType, funcIndex)
        const functionName = node.name

        // If funciton is named, declare it in the scope
        if (functionName) {
            scopes.nodes.enter(functionName.name, funcGenNode)
        }

        const code = codeSection.preallocate(node)

        result = { funcGenNode, funcIndex, code }
        functions.set(node, result)
        return result
    }

    function functionToGenNode(node: Function, scopes: Scopes): GenNode {
        const { funcGenNode, funcIndex, code } = declareFunction(node, scopes)

        const g = gen()

        // Create the function scopes
        const alloc = new LocalAllocator(g)
        const nodes = new Scope<GenNode>(scopes.nodes)
        const globals = scopes.globals
        const branchTargets = new Scope<Label>()
        const functionScopes: Scopes = { alloc, nodes, globals, branchTargets }

        // Add parameters
        for (const parameter of node.parameters) {
            const type = typeOf(parameter)
            nodes.enter(parameter.name.name, alloc.parameter(parameter, type))
        }

        // Generate the body
        const resultType = typeOf(node)
        let body = statementsToBodyGenNode(resultType, node.body, functionScopes).simplify()
        if (body.type.needsClamp()) {
            body = new ClampGenNode(node, body)
        }
        g.pushLocation(body.location?.start, body.location?.end)
        body.load(g)
        g.inst(Inst.End)
        g.popLocation()
        const bytes = new ByteWriter()
        const localMapping: Mapping[] | undefined = mappings ? [] : undefined
        g.write(bytes, localMapping)
        code.resolve(g.currentLocals(), bytes, localMapping)

        if (exported.has(node.name.name)) {
            exportSection.allocate(node.name.name, ExportKind.Func, funcIndex)
        }

        return funcGenNode
    }

    function callToGenNode(node: Call, scopes: Scopes): GenNode {
        const target = lastToGenNode(node.target, scopes)
        const args = node.arguments.map(a => lastToGenNode(a, scopes))
        return target.call(args, node)
    }

    function varToGenNode(node: Var, scopes: Scopes): GenNode {
        const alloc = scopes.alloc
        const nodes = scopes.nodes
        const nodeValue = node.value
        const value = nodeValue ? lastToGenNode(nodeValue, scopes) : undefined
        const type = typeOf(node)
        const varGenNode = alloc.allocate(node, type, value)
        nodes.enter(node.name.name, varGenNode)
        if (value)
            return new AssignGenNode(node, varGenNode, value)
        else return emptyGenNode
    }

    function letToGenNode(tree: Let, scopes: Scopes): GenNode {
        const symbol = lastToGenNode(tree.value, scopes)
        scopes.nodes.enter(tree.name.name, symbol)
        return emptyGenNode
    }

    function globalToGenNode(node: Global, scopes: Scopes): GenNode {
        const alloc = scopes.globals
        const nodes = scopes.nodes
        const value = lastToGenNode(node.value, scopes)
        const type = typeOf(node)
        nodes.enter(node.name.name, value)
        const result = alloc.allocate(node, type, value)
        if (exported.has(node.name.name)) {
            result.export(node, node.name.name, exportSection)
        }
        return result
    }

    function ifThenElseGenNode(node: IfThenElse, scopes: Scopes): GenNode {
        const condition = lastToGenNode(node.condition, scopes)
        let type = typeOf(node)
        let then: GenNode = statementsToBodyGenNode(type, node.then, scopes)
        let elsePart: GenNode | undefined = undefined
        if (node.else.length) {
            elsePart = statementsToBodyGenNode(type, node.else, scopes)
        } else {
            then = dropIfNecessary(node, then)
            type = voidGenType
        }
        return new IfThenGenNode(node, type, condition, then, elsePart)
    }

    function loopToGenNode(node: Loop, scopes: Scopes): GenNode {
        const branchLabel = label()
        const name = node.name
        const nodes = scopes.nodes
        const alloc = scopes.alloc
        const globals = scopes.globals
        const branchTargets = new Scope<Label>(scopes.branchTargets)
        branchTargets.enter("$top", branchLabel)
        if (name) {
            branchTargets.enter(name.name, branchLabel)
        }
        const type = typeOf(node)
        const body = statementsToGenNode(type, node.body, { nodes, alloc, globals, branchTargets })
        return new LoopGenNode(node, voidGenType, body, branchLabel)
    }

    function read(type: Type): Type {
        if (type.kind == TypeKind.Location) return type.type
        return type
    }
}