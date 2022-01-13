import { copy, LastKind, LiteralKind, nameOfLastKind, nameOfLiteralKind, Reference } from "./ast"

describe("ast", () => {
    it("can get a name of all last kinds", () => {
        for (let kind = LastKind.Add; kind <= LastKind.Module; kind++) {
            const name = nameOfLastKind(kind)
            const nameSet = new Set<string>()
            expect(name).not.toBeUndefined()
            expect(nameSet.has(name)).toBeFalse()
            nameSet.add(name)
        }
    })
    it("can get a name for all literal kinds", () => {
        for (let kind = LiteralKind.Int8; kind <= LiteralKind.Null; kind++) {
            const name = nameOfLiteralKind(kind)
            const nameSet = new Set<string>()
            expect(name).not.toBeUndefined()
            expect(nameSet.has(name)).toBeFalse()
            nameSet.add(name)
        }
    })
    it("can create a copy of a node", () => {
        const n: Reference = { kind: LastKind.Reference, name: "someName" }
        const copyOfn = copy(n)
        expect(n).toEqual(copyOfn)
        expect(n).not.toBe(copyOfn)
    })
    it("can create a copy of a node and change values", () => {
        const n: Reference = { kind: LastKind.Reference, name: "someName" }
        const copyOfn = copy(n, { name: "someOtherName" })
        expect(copyOfn.kind).toBe(LastKind.Reference)
        expect(copyOfn.name).toBe("someOtherName")
    })
})