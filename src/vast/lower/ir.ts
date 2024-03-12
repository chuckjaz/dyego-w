import * as ast from "../ast"
import { Type } from "../types/types";
import { Location, ValLocation, VarLocation } from "../types/check"
import { Locatable } from "../../last";

export const enum IrKind {
    ArrayLiteral,
    Assign,
    Block,
    Break,
    Call,
    ComputedBranch,
    Continue,
    Definition,
    FieldLiteral,
    Function,
    For,
    If,
    Index,
    Literal,
    Module,
    Nothing,
    Reference,
    Return,
    Select,
    StructLiteral,
    While,
}

export interface Module extends IrNode {
    kind: IrKind.Module
    functions: Function[]
    data: (VarLocation | ValLocation)[]
    initialize: Block
}

export type Expression = 
    ArrayLiteral |
    Assign |
    Block |
    Call |
    ComputedBranch |
    If |
    Index |
    Literal |
    Nothing |
    Reference |
    Select |
    StructLiteral

export type Statement = 
    Break |
    Continue |
    Definition |
    Expression |
    For |
    Return |
    While

const brand = Symbol("vast ir brand")

export interface IrNode extends Locatable {
    [brand]?: never
    kind: IrKind | ast.Kind
    type: Type
}

export interface ArrayLiteral extends IrNode {
    kind: IrKind.ArrayLiteral
    values: Expression[]
}

export interface Assign extends IrNode {
    kind: IrKind.Assign
    target: Expression
    value: Expression
}

export interface Block extends IrNode {
    kind: IrKind.Block
    name?: ast.Reference
    statements: Statement[]
}

export interface Break extends IrNode {
    kind: IrKind.Break
    target?: ast.Reference
}

export interface Call extends IrNode {
    kind: IrKind.Call
    target: Expression
    args: Expression[]
}

export interface ComputedBranch extends IrNode {
    kind: IrKind.ComputedBranch
    target: Expression
    branches: (Expression | undefined)[]
    else: Expression
}

export interface Continue extends IrNode {
    kind: IrKind.Continue
    target?: ast.Reference
}

export interface Definition extends IrNode {
    kind: IrKind.Definition
    name: Reference
}

export interface For extends IrNode {
    kind: IrKind.For
    index: Reference
    initialize: Expression
    advance: Expression
}

export interface Function extends IrNode {
    kind: IrKind.Function
    name: Reference
    parameters: Reference[]
    body: Block
}

export interface If extends IrNode {
    kind: IrKind.If
    condition: Expression
    then: Block
    else: Block
}

export interface Index extends IrNode {
    kind: IrKind.Index
    target: Expression
    index: Expression
}

export interface Literal extends IrNode {
    kind: IrKind.Literal
    value: ast.Literal
}

export interface Nothing extends IrNode {
    kind: IrKind.Nothing
}

export interface Reference extends IrNode {
    kind: IrKind.Reference
    name: string
    location: Location
}

export interface Return extends IrNode {
    kind: IrKind.Return
    value: Expression
}

export interface Select extends IrNode {
    kind: IrKind.Select
    target: Expression
    name: Reference
}

export interface StructLiteral extends IrNode {
    kind: IrKind.StructLiteral
    fields: FieldLiteral[]
}

export interface FieldLiteral extends IrNode {
    kind: IrKind.FieldLiteral
    name: Reference
    value: Expression
}

export interface While extends IrNode {
    kind: IrKind.While
    condition: Expression
    body: Block
}