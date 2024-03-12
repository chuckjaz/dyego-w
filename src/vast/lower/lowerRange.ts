import { Scope } from "../../last";
import { Function as FunctionType, StructField, StructFieldModifier, StructType, Type, TypeKind } from "../types/types";
import { IrNode, Module } from "./ir";
import { transformer } from './transformer'

const fields = new Scope<StructField>()
const types = new Scope<Type>()
const methods = new Scope<FunctionType>()
const i32Type: Type = { kind: TypeKind.I32 }

fields.enter("start", {
    name: "start",
    type: i32Type,
    modifier: StructFieldModifier.Val
})
fields.enter("end", {
    name: "end",
    type: i32Type,
    modifier: StructFieldModifier.Val
})
const rangeType: StructType = {
    kind: TypeKind.Struct,
    name: "Range",
    fields,
    types,
    methods
}

function typeVisitor<N extends IrNode>(node: N): N | undefined {
    if (node.type.kind == TypeKind.Range) {
        node.type = rangeType
        return node
    }
}

export const lowerRange = transformer(typeVisitor)


