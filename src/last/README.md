# Last

Last intended to be the last AST just before WASM code generation. It is a more convienient and higher level generalization than the WASM text format as the sections and instruction type selection are inferred during WASM generation instead of being explicit.

Last supports,

1. WASM generation
2. Abstract data types
3. Validation
4. Limited transformation
5. Merging

It doesn't support generics, higher-kinded abstraction or any other powerful abstractions such as FP or OOP or, well, anything. It doesn't have a runtime or runtime support (no allocations, no garbage collection, no math library, no i/o, ...). It is at the same level of abstraction as C but without the standard library and no pointer arithmetic (though you can come close by casting a pointer to an Int to a pointer to an Int[]^).

Last comes with a parser but the langague is not intended to be used. It is just to give a serialization syntax for the AST that allows easier debugging of tools that generate Last ASTs.

The Last module itself is just the specification of the AST and an AST type checker to ensure the type usage is consistent. Other modules are required for bulding, manipulating, and transforming Last ASTs.

## Modules

`last` is a module that contains the type definitioins for Last ASTs, types, and a type checker. The type checker only validates that type usage is consistent (similar to what you would expect from a C compiler).

`last-cmd` is a command-line wrapper around the the Last AST system that enables compiling and debugging Last ASTs. It accepts Last AST definition in the `.last.dg` format, which is the syntax parsed by `last-parser`, or in JSON format. The JSON format is not a direct serialization of Last ASTs into JSON, as Last uses numbers to distinquish which AST node is which, but uses a string in place of a number which is desearlized into the number. This allows the numbers to change across Last versions. The names are stable, the numbers are not.

`last-debug` is a module that transforms an AST by injecting debug hooks into the AST. These hooks are used by `last-cmd` to support very simple command-line style debugging similar to gdb (but with only a very small subset of gdb's features).

`last-parser` is a module that contains a parser that will transform a textual representation of the Last AST into a Last AST. It is not intended to be a real langauge as it lacks the ergonomics you would expect in one. It is just intended to support debugging and testing of Last ASTs. For example, there is no `while` or `for` loops, just `block`, `loop` and `branch`. This is because these concepts don't exist in WASM either and Last is an WASM AST, not an AST for a particular language.

`last-validate` is a module that validates the internal consistency of a Last AST. This validates that the Last AST is well formed. It does not validate semantics. This means that an AST is well-formed even if it is not correctly typed. An AST is required to be well-formed to be type checked. An AST is required to be well-formed and correctly typed to be generated. An AST should be well-formed to be transformed and produce a well-formed AST as a result of the transform. A tranform of a non-well-formed AST should be considered undefined (that is, if the transform fails or crashes on non-well-formed input, it is the fault of the input, not the transform). Transforming an AST that type checks before the transform should type check after the transform (that is, if the transform succeeds and the AST doesn't type check it is the fault of the transform, not the input of the transform).

`last-wasm` transforms Last ASTs into a WASM module that can be loaded and executed by a WASM runtime.

## Support modules

`files` is a module that simplifies the handling of source files.

`source-map` is a module that is used by Last to create source maps. This is used to tranlate the `Location` information in the AST into source line information that can be used, for example, by the Chrome developer tools to enable source line stepping.

`wasm` is a module that supports the genration the WASM binary module format. It is used by `last-wasm` to generate WASM modules.