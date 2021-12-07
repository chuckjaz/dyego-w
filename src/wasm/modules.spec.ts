import { ByteWriter } from "./bytewriter";
import { gen, Generate } from "./codeblock";
import { CodeSection } from "./codesection";
import { ExportKind, ExportSection } from "./exportsection";
import { FunctionSection } from "./functionSection";
import { Module } from "./module";
import { TypeSection } from "./typesection";
import { Inst, NumberType } from "./wasm";

describe("modules", () => {
    it("can validate a hand written module", () => {
        const b = new ByteWriter();
        b.writeBytes([
            // Header
            0x00, 0x61, 0x73, 0x6d,
            0x01, 0x00, 0x00, 0x00,

            // Type section
            0x01,
            0x07,
            0x01,
            0x60,
            0x02,
            0x7F,
            0x7F,
            0x01,
            0x7F,

            // Function section
            0x03,
            0x02,
            0x01,
            0x00,

            // Exports section
            0x07,
            0x07,
            0x01,
            0x03, 0x61, 0x64, 0x64,
            0x00,
            0x00,

            // Code section
            0x0A,
            0x09,
            0x01,
            0x07,
            0x00,
            0x20,
            0x00,
            0x20,
            0x01,
            0x6A,
            0x0B,
        ]);
        const m = b.extract();
        expect(WebAssembly.validate(m)).toBeTrue();
        const mod = new WebAssembly.Module(m);
        const inst = new WebAssembly.Instance(mod);
        const val = (inst.exports as any).add(30, 12);
        expect(val).toBe(42);
    });
    it("can create a module with an add function", () => {
        const typeSection = new TypeSection();
        // (a: i32, b: i32) -> i32
        const typeIndex = typeSection.funtionType({
            parameters: [NumberType.i32, NumberType.i32],
            result: [NumberType.i32]
        });

        // a + b
        const g = generate(g => {
            g.inst(Inst.Local_get);
            g.index(0);
            g.inst(Inst.Local_get);
            g.index(1);
            g.inst(Inst.i32_add);
            g.inst(Inst.End);
        });
        const codeSection = new CodeSection();
        const code = new ByteWriter();
        g.write(code);
        codeSection.allocate([], code);

        const funcSection = new FunctionSection(0);
        const funcIndex = funcSection.allocate(typeIndex);

        // export add
        const exportSection = new ExportSection();
        exportSection.allocate("add", ExportKind.Func, funcIndex);

        // Create the module
        const module = new Module();
        module.addSection(typeSection);
        module.addSection(funcSection);
        module.addSection(exportSection);
        module.addSection(codeSection);

        const mw = new ByteWriter();
        module.write(mw);
        const moduleBytes = mw.extract();

        expect(WebAssembly.validate(moduleBytes)).toBeTrue();
        const mod = new WebAssembly.Module(moduleBytes);
        const inst = new WebAssembly.Instance(mod);
        const val = (inst.exports as any).add(30, 12);
        expect(val).toBe(42);
    });
    it("can create a factorial function", () => {
        // Type section
        const typeSection = new TypeSection();
        // (a: f64) -> f64
        const typeIndex = typeSection.funtionType({
            parameters: [NumberType.f64],
            result: [NumberType.f64]
        });

        // Code
        // fac(a: Double) = if (a < 1) 1 else a * fac(a - 1.0)
        const g = generate(g => {
            g.inst(Inst.Local_get);
            g.index(0);
            g.inst(Inst.f64_const);
            g.float64(1);
            g.inst(Inst.f64_lt);
            g.if(NumberType.f64)    
        })
        gen();
        
        const thenBlock = gen();

    });
});

function generate(cb: (g: Generate) => void): Generate {
    const g = gen();
    cb(g);
    g.done();
    return g;
}