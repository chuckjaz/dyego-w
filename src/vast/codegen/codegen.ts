import { Declaration, Function, Kind, Let, Module, Statement, TypeDeclaration, Val, Var } from "../ast";
import { Declaration as LastDeclaration, Module as LastModule, Import as LastImport, LastKind, CheckResult } from "../../last"

export function codegen(module: Module, checkResult: CheckResult): LastModule {
    const imports: LastImport[] = []
    const declarations: LastDeclaration[] = []

    convertModule(module)

    return {
        kind: LastKind.Module,
        imports,
        declarations
    }

    function convertModule(module: Module) {
        module.declarations.forEach(convertDeclaration)
    }

    function convertDeclaration(declaration: Declaration) {
        switch (declaration.kind) {
            case Kind.Function:
                convertFunction(declaration)
                return
            case Kind.Let:
                convertLetDeclration(declaration)
                return
            case Kind.TypeDeclaration:
                convertTypeDeclaration(declaration)
                return
            case Kind.Val:
                convertValDeclaration(declaration)
                return
            case Kind.Var:
                convertVarDeclration(declaration)
                return
        }
    }

    function convertFunction(func: Function) {

    }

    function convertLetDeclration(letDeclaration: Let) {

    }

    function convertTypeDeclaration(typeDeclaration: TypeDeclaration) {

    }

    function convertValDeclaration(valDeclaration: Val) {

    }

    function convertVarDeclration(varDeclaration: Var) {

    }

}

