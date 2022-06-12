export class Scope<T> {
    private parents: Scope<T>[]
    private entries: Map<string, T> = new Map()
    private orders: Map<string, number> = new Map()

    constructor(...parents: (Scope<T> | undefined)[]) {
        this.parents = parents.filter(it => it) as Scope<T>[]
    }

    get size(): number {
        return this.entries.size
    }

    find(name: string): T | undefined {
        return this.entries.get(name) ?? this.findInParent(name)
    }

    order(name: string): number | undefined {
        return this.orders.get(name)
    }

    enter(name: string, value: T) {
        if (this.entries.has(name)) {
            throw new Error(`Duplicate name ${name}`)
        }
        this.orders.set(name, this.entries.size)
        this.entries.set(name, value)
    }

    renter(name: string, value: T) {
        if (!this.entries.has(name)) {
            throw new Error(`Cannot reenter a symbol that has not be entered: ${name}`)
        }
        this.entries.set(name, value)
    }

    has(name: string) {
        return this.entries.has(name)
    }

    forEach(callback: (name: string, value: T) => void) {
        this.internalForEach(new Set(), callback);
    }

    first<R>(callback: (name: string, value: T) => R | undefined): R | undefined {
        return this.internalFirst(new Set(), callback);
    }

    without(name: string): Scope<T> {
        const result = new Scope<T>(...this.parents)
        this.forEach((n, value) => {
            if (n !== name) result.enter(n, value)
        })
        return result
    }

    map<V>(callback: (name: string, value: T) => V): V[] {
        const result: V[] = []
        this.internalForEach(new Set(), (name, value) => {
            result.push(callback(name, value))
        })
        return result
    }

    all(callback: (name: string, value: T) => boolean): boolean {
        let result = true
        this.internalForEach(new Set(), (name, value) => {
            result = result || callback(name, value)
        })
        return result
    }

    private internalForEach(emitted: Set<string>, callback: (name: string, value: T) => void) {
        for (const entry of this.entries.entries()) {
            if (!emitted.has(entry[0])) {
                emitted.add(entry[0])
                callback(entry[0], entry[1])
            }
        }
        for (const parent of this.parents) {
            parent.internalForEach(emitted, callback)
        }
    }

    private internalFirst<R>(
        emitted: Set<string>,
        callback: (name: string, value: T) => R | undefined
    ): R | undefined {
        for (const entry of this.entries.entries()) {
            if (!emitted.has(entry[0])) {
                emitted.add(entry[0])
                const result = callback(entry[0], entry[1]);
                if (result !== undefined) return result;
            }
        }
        for (const parent of this.parents) {
            const result = parent.internalFirst(emitted, callback);
            if (result !== undefined) return result;
        }
        return undefined;
    }

    private findInParent(name: string): T | undefined {
        const parents = this.parents
        const l = parents.length
        for (let i = 0; i < l; i++) {
            const result = parents[i].find(name)
            if (result) return result
        }
        return undefined
    }
}