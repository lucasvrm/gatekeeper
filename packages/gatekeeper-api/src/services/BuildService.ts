import { execa } from 'execa'
import { stripAnsi } from '../utils/stripAnsi.js'
import type { BuildService as IBuildService, BuildResult } from '../types/index.js'

export class BuildService implements IBuildService {
  private projectPath: string

  constructor(projectPath: string) {
    this.projectPath = projectPath
  }

  async build(): Promise<BuildResult> {
    try {
      const result = await execa('npm', ['run', 'build'], {
        cwd: this.projectPath,
        reject: false,
      })

      const rawOutput = result.stdout + result.stderr

      return {
        success: result.exitCode === 0,
        exitCode: result.exitCode ?? -1,
        output: stripAnsi(rawOutput),
      }
    } catch (error) {
      return {
        success: false,
        exitCode: 1,
        output: stripAnsi(error instanceof Error ? error.message : String(error)),
      }
    }
  }
}
