import { required } from "../../utils";
import { Kind, Reference } from "../ast";
import { CheckResult, Location } from "../types/check";
import { Flow } from "./flow";

export interface LiveResult {
    last: Set<Reference>
}

export function calculateLiveness(flow: Flow, checkResult: CheckResult): LiveResult {
    const last = new Set<Reference>()

    // Find last references
    let currentFlow = flow
    while (currentFlow.exits.size) {
        currentFlow = first(currentFlow.exits)
    }

    const pending: Flow[] =[]
    const seens: Set<Location>[] = []
    const flows = new Set<Flow>()
    pending.push(currentFlow)
    seens.push(new Set())

    while (pending.length > 0) {
        const current = required(pending.pop())
        const seen = required(seens.pop())

        if (allIn(current.exits, flows)) {
            for (let i = current.visits.length - 1; i >= 0; i--) {
                const visit = current.visits[i]
                const node = visit.node
                if (node.kind == Kind.Reference) {
                    const location = required(checkResult.references.get(node)) as Location
                    if (!seen.has(location) && !current.loop) {
                        last.add(node)
                    }
                    seen.add(location)
                }
            }

            for (const flow of current.enters) {
                pending.push(flow)
                seens.push(clone(seen))
            }

            flows.add(current)
        } else {
            // One or more of the flows it exists into is not yet finished,
            // Add it back to the queue to process later.
            pending.unshift(current)
            seens.unshift(seen)
        }
    }

    return { last }
}

function first<E>(s: Set<E>): E {
    for (const element of s) { return element }
    throw Error()
}

function clone<E>(a: Set<E>): Set<E> {
    const result = new Set<E>()
    for (const item of a) result.add(item)
    return  result
}

function allIn<E>(a: Set<E>, b: Set<E>): boolean {
    for (const item of a) {
        if (!b.has(item)) return false
    }
    return true
}