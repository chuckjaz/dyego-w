import { ByteWriter } from "./bytewriter";
import { Mapping } from "./codeblock";
import { CodeSection } from "./codesection";
import { Section } from "./section";

export class Module {
    private sections: Section[] = [];

    addSection(section: Section) {
        this.sections.push(section);
    }

    write(writer: ByteWriter) {
        writer.writeBytes([ 0x00, 0x61, 0x73, 0x6D, 0x01, 0x00, 0x00, 0x00]);
        for (const section of this.sections) {
            if (!section.empty()) {
                section.write(writer);
            }
        }
    }

    mappings(): Mapping[] | undefined {
        for (const section of this.sections) {
            if (section instanceof CodeSection) {
                return section.mappings()
            }
        }
        return undefined
    }
}
