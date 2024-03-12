import { Locatable } from "./last"

export function unsupported(location: Locatable | undefined, message?: string): never {
    error(message ? "Not supported yet: " + message : "Not supported yet", location)
}

export function error(message: string, location?: Locatable): never {
    const e = new Error(message) as any
    if (location) e.position = location.start
    throw e
}

export function required<T>(value: T | undefined, location?: Locatable): T {
    if (value !== undefined) return value
    error("Value is required", location)
}

export function check(value: boolean, message?: string, location?: Locatable) {
    if (!value) error(message || "Failed check", location)
}
