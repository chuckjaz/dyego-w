import * as ast from '../ast'
import * as check from '../types/check'
import * as files from '../../files'

import { report } from './report'

export function ck(module: ast.Module, fileSet: files.FileSet): check.CheckResult {
    const checkResult = check.check(module)
    if (checkResult.diagnostics.length) {
        report("vast check", checkResult.diagnostics, fileSet)
    }
    expect(checkResult.diagnostics).toEqual([])
    return checkResult
}

