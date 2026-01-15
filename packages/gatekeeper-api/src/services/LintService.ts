import { execa } from 'execa'
import type { LintService as ILintService, LintResult } from '../types/index.js'

export class LintService implements ILintService {
  private projectPath: string

  constructor(projectPath: string) {
    this.projectPath = projectPath
  }

  async lint(paths: string[]): Promise<LintResult> {
    try {
      const result = await execa('eslint', paths, {
        cwd: this.projectPath,
        reject: false,
      })

      const errorCount = (result.stdout.match(/error/gi) || []).length
      const warningCount = (result.stdout.match(/warning/gi) || []).length

      return {
        success: result.exitCode === 0,
        errorCount,
        warningCount,
        output: result.stdout + result.stderr,
      }
    } catch (error) {
      return {
        success: false,
        errorCount: 1,
        warningCount: 0,
        output: error instanceof Error ? error.message : String(error),
      }
    }
  }
}
