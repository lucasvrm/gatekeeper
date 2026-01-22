import { execa } from 'execa'
import { stripAnsi } from '../utils/stripAnsi.js'
import type { CompilerService as ICompilerService, CompileResult } from '../types/index.js'

export class CompilerService implements ICompilerService {
  private projectPath: string

  constructor(projectPath: string) {
    this.projectPath = projectPath
  }

  async compile(path?: string): Promise<CompileResult> {
    try {
      const args = ['--noEmit', '--project', 'tsconfig.json']

      const result = await execa('tsc', args, {
        cwd: this.projectPath,
        reject: false,
      })

      let errors: string[] = []

      if (result.exitCode !== 0) {
        const allErrors = result.stdout
          .split('\n')
          .filter((line) => line.includes('error TS'))

        // Se um path foi especificado, filtrar apenas erros desse arquivo
        if (path) {
          const normalizedPath = path.replace(/\\/g, '/')
          errors = allErrors.filter((line) => line.includes(normalizedPath))
        } else {
          errors = allErrors
        }
      }

      const rawOutput = result.stdout + result.stderr

      return {
        success: errors.length === 0,
        errors,
        output: stripAnsi(rawOutput),
      }
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : String(error)],
        output: stripAnsi(''),
      }
    }
  }
}
