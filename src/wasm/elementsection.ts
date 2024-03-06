import { ByteWriter } from "./bytewriter";
import { Section, writeSized } from "./section";
import { SectionIndex } from "./wasm";

export const enum ElementMode {
    ActiveFuncRef = 0x00,
    PassiveRef = 0x01,
    ActiveRef = 0x02,
    DeclarativeRef = 0x03,
    ActiveFuncExpr = 0x04,
    PassiveExpr = 0x05,
    ActiveExpr = 0x06,
    DeclarativeExpr = 0x07,
}

export const enum ElementKind {
    FuncRef = 0x00,
}

export interface ActiveFuncRefElement {
    mode: ElementMode.ActiveFuncRef
    offset: ByteWriter
    funcrefs: number[]
}

export interface PassiveRefElement {
    mode: ElementMode.PassiveRef
    kind: ElementKind
    refs: number[]
}

export interface ActiveRefElement {
    mode: ElementMode.ActiveRef
    table: number
    offset: ByteWriter
    kind: ElementKind
    refs: number[]
}

export interface DeclarativeRefElement {
    mode: ElementMode.DeclarativeRef
    kind: ElementKind
    refs: number[]
}

export interface ActiveFuncExprElement {
    mode: ElementMode.ActiveFuncExpr
    offset: ByteWriter
    refs: ByteWriter[]
}

export interface PassiveExprElement {
    mode: ElementMode.PassiveExpr
    kind: ElementKind
    refs: ByteWriter[]
}

export interface ActiveExprElement {
    mode: ElementMode.ActiveExpr
    table: number
    offset: ByteWriter
    kind: ElementKind
    refs: ByteWriter[]
}

export interface DeclarativeExprElement {
    mode: ElementMode.DeclarativeExpr
    kind: ElementKind
    refs: ByteWriter[]
}

export type Element =
    ActiveFuncRefElement |
    PassiveRefElement |
    ActiveRefElement |
    DeclarativeRefElement |
    ActiveFuncExprElement |
    PassiveExprElement |
    ActiveExprElement |
    DeclarativeExprElement

export class ElementSection implements Section {
    elements: Element[] = []

    get index(): SectionIndex { return SectionIndex.Element }

    allocate(element: Element) {
        this.elements.push(element)
    }

    empty(): boolean {
        return this.elements.length == 0
    }

    write(writer: ByteWriter): void {
        writer.writeByte(SectionIndex.Element);
        writeSized(writer, writer => {
            const elements = this.elements
            writer.write32u(elements.length)
            for (const element of elements) {
                writeElement(writer, element)
            }
        })
    }
}

function writeElement(writer: ByteWriter, element: Element) {
    writer.write32u(element.mode)
    switch (element.mode) {
        case ElementMode.ActiveFuncRef:
            writer.write(element.offset)
            writeRefs(writer, element.funcrefs)
            break
        case ElementMode.PassiveRef:
            writer.writeByte(element.kind)
            writeRefs(writer, element.refs)
            break
        case ElementMode.ActiveRef:
            writer.write32u(element.table)
            writer.write(element.offset)
            writer.writeByte(element.kind)
            writeRefs(writer, element.refs)
            break
        case ElementMode.DeclarativeRef:
            writer.writeByte(element.kind)
            writeRefs(writer, element.refs)
            break
        case ElementMode.ActiveFuncExpr:
            writer.write(element.offset)
            writeExprs(writer, element.refs)
            break
        case ElementMode.PassiveExpr:
            writer.writeByte(element.kind)
            writeExprs(writer, element.refs)
            break
        case ElementMode.ActiveExpr:
            writer.writeByte(element.table)
            writer.write(element.offset)
            writer.writeByte(element.kind)
            writeExprs(writer, element.refs)
            break
        case ElementMode.DeclarativeExpr:
            writer.writeByte(element.kind)
            writeExprs(writer, element.refs)
            break
    }
}

function writeRefs(writer: ByteWriter, refs: number[]) {
    writer.write32u(refs.length)
    writer.write32us(refs)
}

function writeExprs(writer: ByteWriter, exprs: ByteWriter[]) {
    writer.write32u(exprs.length)
    exprs.forEach(expr => writer.write(expr))
}