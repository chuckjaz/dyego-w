export function padding(value: number): string {
    switch (value) {
        case 0: return ""
        case 1: return " "
        case 2: return "  "
        case 3: return "   "
        case 4: return "    "
    }
    const n = value >> 1
    return padding(n) + padding(n) + (value & 1 ? " " : "")
}
