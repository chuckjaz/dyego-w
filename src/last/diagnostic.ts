import { Locatable } from "./locatable";

export interface Diagnostic {
    location: Locatable
    message: string
    related?: Diagnostic[]
}

