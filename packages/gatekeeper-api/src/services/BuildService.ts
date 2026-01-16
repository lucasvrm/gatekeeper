import { execa } from 'execa'
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

      return {
        success: result.exitCode === 0,
        exitCode: result.exitCode ?? -1,
        output: result.stdout + result.stderr,
      }
    } catch (error) {
      return {
        success: false,
        exitCode: 1,
        output: error instanceof Error ? error.message : String(error),
      }
    }
  }
}
