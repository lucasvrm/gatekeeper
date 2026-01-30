import { execa } from 'execa'
import { resolve, isAbsolute } from 'path'
import { existsSync } from 'fs'
import { stripAnsi } from '../utils/stripAnsi.js'
import type { LintService as ILintService, LintResult } from '../types/index.js'

type LintOptions = {
  timeout?: number
}

export class LintService implements ILintService {
  private projectPath: string
  private timeoutMs: number

  constructor(projectPath: string, options: LintOptions = {}) {
    this.projectPath = projectPath
    this.timeoutMs = options.timeout ?? 30 * 1000
  }

  async lint(paths: string[]): Promise<LintResult> {
    try {
      // Convert relative paths to absolute and filter out non-existent files
      const absolutePaths = paths
        .map(p => isAbsolute(p) ? p : resolve(this.projectPath, p))
        .filter(p => existsSync(p))

      if (absolutePaths.length === 0) {
        return {
          success: true,
          errorCount: 0,
          warningCount: 0,
          output: 'No existing files to lint',
        }
      }

      const result = await execa('eslint', absolutePaths, {
        cwd: this.projectPath,
        reject: false,
        timeout: this.timeoutMs,
      })

      const rawOutput = result.stdout + result.stderr
      const errorCount = (rawOutput.match(/error/gi) || []).length
      const warningCount = (rawOutput.match(/warning/gi) || []).length

      return {
        success: result.exitCode === 0,
        errorCount,
        warningCount,
        output: stripAnsi(rawOutput),
      }
    } catch (error) {
      return {
        success: false,
        errorCount: 1,
        warningCount: 0,
        output: stripAnsi(error instanceof Error ? error.message : String(error)),
      }
    }
  }
}
