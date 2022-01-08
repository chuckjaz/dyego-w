import {
    ArrayLiteral, Assign, Call, CheckResult, Function, IfThenElse, Import, ImportFunction, Index, Last, LastKind, Let, LiteralKind,
    Locatable, Loop, Module, nameOfLastKind, Scope, Select, StructLiteral, Type, TypeKind, Var
} from "../last"
import {
    error, required, unsupported
} from "../utils"
import {
    ByteWriter, CodeSection, DataSection, ExportKind, ExportSection, FunctionSection, gen, ImportSection, Inst, label,
    Label, MemorySection, Module as WasmModule, Section, StartSection, TypeIndex, TypeSection, ValueType
} from "../wasm"
import {
    ArrayLiteralGenNode, AssignGenNode, BigIntConstGenNode, BlockGenNode, BodyGenNode, BranchTableGenNode, ClampGenNode,
    CompareGenNode, DataAllocator, DataGenNode, DoubleConstGenNode, DropGenNode, emptyGenNode, flattenTypes,
    FunctionGenNode, GenNode, GenType, genTypeOf, GotoGenNode, i32GenType, LocalAllocator, LocationAllocator,
    MemoryGenNode, NumberConstGenNode, OpGenNode, ReturnGenNode, StructLiteralGenNode, UnaryOpGenNode, voidGenType,
    voidPointerGenType, zeroGenNode, builtinGenNodeFor, IfThenGenNode, LoopGenNode, trueGenNode, falseGenNode
} from "./gennode"

interface Scopes {
    branchTargets: Scope<Label>
    nodes: Scope<GenNode>
    alloc: LocationAllocator
}

export function codegen(lastModule: Module, checkResult: CheckResult, wasmModule: WasmModule) {
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

    // Allocate the top-of-memory variable.
    dataAllocator.allocate({ start: 0 }, voidPointerGenType)

    function typeOfType(location: Locatable | undefined, type: Type | undefined): GenType {
        return genTypeOf(location, required(type, location), genTypes)
    }

    function typeOf(tree: Last): GenType {
        return typeOfType(tree, types.get(tree))
    }

    const rootScope = new Scope<GenNode>()
    rootScope.enter("memory", new MemoryGenNode({ start: 0 }))
    const rootScopes: Scopes = {
        branchTargets: new Scope<Label>(),
        nodes: rootScope,
        alloc: dataAllocator
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
    addSection(exportSection)
    addSection(startSection)
    addSection(codeSection)
    addSection(dataSection)

    function genImports(imports: Import[], scopes: Scopes) {
        for (const importStatement of imports) {
            for (const item of importStatement.imports) {
                switch (item.kind) {
                    case LastKind.ImportFunction:
                        const typeIndex = typeIndexOf(item)
                        const funcIndex = importSection.importFunction(
                            item.module,
                            item.name,
                            typeIndex
                        )
                        const resultType = typeOf(item)
                        const functionGenNode = new FunctionGenNode(item, resultType, funcIndex)
                        scopes.nodes.enter(item.as ?? item.name, functionGenNode)
                        break
                }
            }
        }
    }

    function statementsToBodyGenNode(containerType: GenType, nodes: Last[], scopes: Scopes) {
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
        if (containerType.parts.void) {
            statements.push(statementToGenNode(nodes[prev], scopes))
        } else {
            statements.push(lastToGenNode(nodes[prev], scopes))
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
            case LastKind.Remainder: {
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
                    branches.enter(name, blockLabel)
                    blockScopes = {...scopes, branchTargets: branches }
                }
                return blockElementsToGenNode(node, node.body, blockScopes, blockLabel)
            }
            case LastKind.Branch: {
                const l = required(scopes.branchTargets.find(node.target ?? "$top"))
                return new GotoGenNode(node, l)
            }
            case LastKind.BranchIndexed: {
                const condition = lastToGenNode(node.condition, scopes);
                const labels = node.targets.map(
                    name => required(scopes.branchTargets.find(name))
                )
                const elseLabel = required(scopes.branchTargets.find(node.else))
                return new BranchTableGenNode(node, condition, labels, elseLabel)
            }
            case LastKind.Return: {
                const value = node.value
                const expr = value ? lastToGenNode(value, scopes) : undefined
                return new ReturnGenNode(node, expr)
            }
            case LastKind.Literal:
                switch (node.literalKind) {
                    case LiteralKind.Int8:
                    case LiteralKind.Int16:
                    case LiteralKind.Int32:
                    case LiteralKind.UInt8:
                    case LiteralKind.UInt16:
                    case LiteralKind.UInt32:
                        return new NumberConstGenNode(node, typeOf(node), node.value)
                    case LiteralKind.Int64:
                    case LiteralKind.UInt64:
                        return new BigIntConstGenNode(node, typeOf(node), node.value)
                    case LiteralKind.Float32:
                    case LiteralKind.Float64:
                        return new DoubleConstGenNode(node, typeOf(node), node.value)
                    case LiteralKind.Null:
                        return zeroGenNode
                    case LiteralKind.Boolean:
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
                return required(scopes.nodes.find(node.name), node)
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
            case LastKind.IfThenElse:
                return ifThenElseGenNode(node, scopes)
            case LastKind.Loop:
                return loopToGenNode(node, scopes)
            case LastKind.As:
                return lastToGenNode(node.left, scopes)
            case LastKind.Exported:
                return lastToGenNode(node.target, scopes)
            case LastKind.Type:
            case LastKind.StructTypeLiteral:
            case LastKind.StructFieldLiteral:
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
        const elements = tree.values.map(e => lastToGenNode(e, scopes))
        return new ArrayLiteralGenNode(tree, type, elements)
    }

    function selectToGenNode(tree: Select, scopes: Scopes): GenNode {
        let target = lastToGenNode(tree.target, scopes)
        let targetType = read(required(types.get(tree.target)))
        if (targetType.kind == TypeKind.Pointer) {
            targetType = targetType.target
            target = new DataGenNode(tree, typeOfType(tree, targetType), target)
        }
        if (targetType.kind == TypeKind.Struct)
            return target.select(tree.name)
        else {
            const type = typeOf(tree)
            return builtinGenNodeFor(tree, targetType, type, tree.name, target)
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

    function functionToGenNode(node: Function, scopes: Scopes): GenNode {
        const g = gen()

        // Create the function scopes
        const alloc = new LocalAllocator(g)
        const nodes = new Scope<GenNode>(scopes.nodes)
        const branchTargets = new Scope<Label>()
        const functionScopes: Scopes = { alloc, nodes, branchTargets }

        // Add parameters
        for (const parameter of node.parameters) {
            const type = typeOf(parameter)
            nodes.enter(parameter.name, alloc.parameter(parameter, type))
        }

        // Create the function type
        const typeIndex = typeIndexOf(node)
        const resultType = typeOf(node)

        // Create the function index
        const funcIndex = funcSection.allocate(typeIndex)
        const funcGenNode = new FunctionGenNode(node, resultType, funcIndex)

        // Allow the function to call itself if it is named
        const functionName = node.name
        if (functionName)
            scopes.nodes.enter(functionName, funcGenNode)

        // Generate the body
        let body = statementsToBodyGenNode(resultType, node.body, functionScopes).simplify()
        if (body.type.needsClamp()) {
            body = new ClampGenNode(node, body)
        }
        body.load(g)
        g.inst(Inst.End)
        const bytes = new ByteWriter()
        g.write(bytes)
        codeSection.allocate(g.currentLocals(), bytes)

        if (exported.has(node.name)) {
            exportSection.allocate(node.name, ExportKind.Func, funcIndex)
        }

        return funcGenNode
    }

    function callToGenNode(tree: Call, scopes: Scopes): GenNode {
        const target = lastToGenNode(tree.target, scopes)
        const args = tree.arguments.map(a => lastToGenNode(a, scopes))
        return target.call(args)
    }

    function varToGenNode(node: Var, scopes: Scopes): GenNode {
        const alloc = scopes.alloc
        const nodes = scopes.nodes
        const nodeValue = node.value
        const value = nodeValue ? lastToGenNode(nodeValue, scopes) : emptyGenNode
        const type = typeOf(node)
        const varGenNode = alloc.allocate(node, type, value)
        nodes.enter(node.name, varGenNode)
        if (nodeValue)
            return new AssignGenNode(node, varGenNode, value)
        else return emptyGenNode
    }

    function letToGenNode(tree: Let, scopes: Scopes): GenNode {
        const symbol = lastToGenNode(tree.value, scopes)
        scopes.nodes.enter(tree.name, symbol)
        return emptyGenNode
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
        const branchTargets = new Scope<Label>(scopes.branchTargets)
        branchTargets.enter("$top", branchLabel)
        if (name) {
            branchTargets.enter(name, branchLabel)
        }
        const type = typeOf(node)
        const body = statementsToGenNode(type, node.body, { nodes, alloc, branchTargets })
        return new LoopGenNode(node, voidGenType, body, branchLabel)
    }

    function read(type: Type): Type {
        if (type.kind == TypeKind.Location) return type.type
        return type
    }
}