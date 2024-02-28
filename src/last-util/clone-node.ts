import { Last, LastKind, MemoryMethod } from "../last";

function maybeClone<T extends Last>(node: T | undefined): T | undefined {
    return node ? cloneNode(node) : undefined
}

export function cloneNode<T extends Last>(node: T): T {
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
            return {...node, left: cloneNode(node.left), right: cloneNode(node.right) }
        case LastKind.BitNot:
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
        case LastKind.Dereference:
            return {...node, target: cloneNode(node.target) }
        case LastKind.ConvertTo:
        case LastKind.WrapTo:
        case LastKind.ReinterpretAs:
        case LastKind.TruncateTo:
        case LastKind.As:
            return {...node, left: cloneNode(node.left), right: cloneNode(node.right) }
        case LastKind.SizeOf:
            return {...node, target: cloneNode(node.target) }
        case LastKind.Literal:
        case LastKind.Reference:
        case LastKind.Primitive:
            return { ...node }
        case LastKind.StructLiteral:
            return { ...node, fields: node.fields.map(cloneNode) }
        case LastKind.Field:
            return { ...node, name: cloneNode(node.name), value: cloneNode(node.value) }
        case LastKind.ArrayLiteral:
            if (Array.isArray(node.values))
                return { ...node, values: node.values.map(cloneNode) }
            return { ...node }
        case LastKind.Block:
        case LastKind.Loop:
            return { ...node, body: node.body.map(cloneNode) }
        case LastKind.IfThenElse:
            return { ...node, condition: cloneNode(node.condition), then: node.then.map(cloneNode), else: node.else.map(cloneNode) }
        case LastKind.Branch:
            return { ...node, target: maybeClone(node.target) }
        case LastKind.BranchIndexed:
            return { ...node, condition: cloneNode(node.condition), else: cloneNode(node.else), targets: node.targets.map(cloneNode) }
        case LastKind.Return:
            return { ...node, value: maybeClone(node.value) }
        case LastKind.Select:
            return { ...node, target: cloneNode(node.target), name: cloneNode(node.name) }
        case LastKind.Index:
            return { ...node, target: cloneNode(node.target), index: cloneNode(node.index) }
        case LastKind.Assign:
            return { ...node, target: cloneNode(node.target), value: cloneNode(node.value) }
        case LastKind.Function:
            return { ...node, name: cloneNode(node.name), parameters: node.parameters.map(cloneNode), result: cloneNode(node.result), body: node.body.map(cloneNode) }
        case LastKind.Parameter:
            return { ...node, name: cloneNode(node.name), type: cloneNode(node.type) }
        case LastKind.Call:
            return { ...node, target: cloneNode(node.target), arguments: node.arguments.map(cloneNode) }
        case LastKind.Memory:
            switch (node.method) {
                case MemoryMethod.Top:
                case MemoryMethod.Limit:
                    return { ...node }
                case MemoryMethod.Grow:
                    return { ...node, amount: cloneNode(node.amount) }
                case MemoryMethod.Copy:
                    return { ...node, source: cloneNode(node.source), destination: cloneNode(node.destination), amount: cloneNode(node.amount) }
                case MemoryMethod.Fill:
                    return { ...node, destination: cloneNode(node.destination), amount: cloneNode(node.amount), value: cloneNode(node.value) }
            }
        case LastKind.Let:
            return { ...node, name: cloneNode(node.name), type: cloneNode(node.type), value: cloneNode(node.value) }
        case LastKind.Var:
            return { ...node, name: cloneNode(node.name), type: maybeClone(node.type), value: maybeClone(node.value) }
        case LastKind.Global:
            return { ...node, name: cloneNode(node.name), type: cloneNode(node.type), value: cloneNode(node.value) }
        case LastKind.Type:
            return { ...node, name: cloneNode(node.name), type: cloneNode(node.type) }
        case LastKind.TypeSelect:
            return { ...node, name: cloneNode(node.name) }
        case LastKind.StructTypeLiteral:
        case LastKind.UnionTypeLiteral:
            return { ...node, fields: node.fields.map(cloneNode) }
        case LastKind.FieldLiteral:
            return { ...node, name: cloneNode(node.name), type: cloneNode(node.type) }
        case LastKind.ArrayConstructor:
            return { ...node, element: cloneNode(node.element) }
        case LastKind.PointerConstructor:
            return { ...node, target: cloneNode(node.target) }
        case LastKind.Exported:
            return { ...node, target: cloneNode(node.target) }
        case LastKind.Import:
            return { ...node, imports: node.imports.map(cloneNode) }
        case LastKind.ImportFunction:
            return { ...node, name: cloneNode(node.name), module: cloneNode(node.module), parameters: node.parameters.map(cloneNode), result: cloneNode(node.result) }
        case LastKind.ImportVariable:
            return { ...node, name: cloneNode(node.name), module: cloneNode(node.module), type: cloneNode(node.type) }
        case LastKind.ExportedMemory:
            return { ...node, name: cloneNode(node.name) }
        case LastKind.Module:
            return { ...node, imports: node.imports.map(cloneNode), declarations: node.declarations.map(cloneNode) }
    }
}