import { FileBuilder, FileSet } from "./files"
import { Locatable } from "./last"

describe("files", () => {
    it("can create a file set", () => {
        const fs = new FileSet()
        expect(fs).not.toBeNull()
    })
    it("can create a file builder", () => {
        const fs = new FileSet()
        const fb = fs.buildFile("a.dg", 100)
        expect(fb).not.toBeNull()
    })
    it("can create a file", () => {
        const fs = new FileSet()
        const fb = fs.buildFile("a.dg", 100)
        fb.addLine(50)
        fb.addLine(75)
        const loc1 = loc(fb, 10, 20)
        const loc2 = loc(fb, 50, 55)
        const f = fb.build()
        expect(f).not.toBeNull()
        const p1 = fs.position(loc1)
        const p2 = fs.position(loc2)
        expect(p1?.display()).toEqual("a.dg:1:11")
        expect(p2?.display()).toEqual("a.dg:2:1")
    })
    it("can create a file (out of order lines)", () => {
        const fs = new FileSet()
        const fb = fs.buildFile("a.dg", 100)
        fb.addLine(75)
        fb.addLine(50)
        const loc1 = loc(fb, 10, 20)
        const loc2 = loc(fb, 50, 55)
        const f = fb.build()
        expect(f).not.toBeNull()
        const p1 = fs.position(loc1)
        const p2 = fs.position(loc2)
        expect(p1?.display()).toEqual("a.dg:1:11")
        expect(p2?.display()).toEqual("a.dg:2:1")
    })

    function loc(fb: FileBuilder, start: number, end: number): Locatable {
        return { start: fb.pos(start), end: fb.pos(end) }
    }
})