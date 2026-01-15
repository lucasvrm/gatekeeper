import { execa } from 'execa'
import type { CompilerService as ICompilerService, CompileResult } from '../types/index.js'

export class CompilerService implements ICompilerService {
  private projectPath: string

  constructor(projectPath: string) {
    this.projectPath = projectPath
  }

  async compile(path?: string): Promise<CompileResult> {
    try {
      const args = ['--noEmit']
      
      if (path) {
        args.push(path)
      }

      const result = await execa('tsc', args, {
        cwd: this.projectPath,
        reject: false,
      })

      const errors =
        result.exitCode !== 0
          ? result.stdout
              .split('\n')
              .filter((line) => line.includes('error TS'))
          : []

      return {
        success: result.exitCode === 0,
        errors,
        output: result.stdout + result.stderr,
      }
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : String(error)],
        output: '',
      }
    }
  }
}
