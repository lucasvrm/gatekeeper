import { execa } from 'execa'
import type { TestRunnerService as ITestRunnerService, TestResult } from '../types/index.js'

export class TestRunnerService implements ITestRunnerService {
  private projectPath: string

  constructor(projectPath: string) {
    this.projectPath = projectPath
  }

  async runSingleTest(testPath: string): Promise<TestResult> {
    const startTime = Date.now()
    
    try {
      const result = await execa('npm', ['test', '--', testPath], {
        cwd: this.projectPath,
        reject: false,
      })

      const duration = Date.now() - startTime

      return {
        passed: result.exitCode === 0,
        exitCode: result.exitCode ?? -1,
        output: result.stdout + result.stderr,
        duration,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      
      return {
        passed: false,
        exitCode: 1,
        output: '',
        error: error instanceof Error ? error.message : String(error),
        duration,
      }
    }
  }

  async runAllTests(): Promise<TestResult> {
    const startTime = Date.now()
    
    try {
      const result = await execa('npm', ['test'], {
        cwd: this.projectPath,
        reject: false,
      })

      const duration = Date.now() - startTime

      return {
        passed: result.exitCode === 0,
        exitCode: result.exitCode ?? -1,
        output: result.stdout + result.stderr,
        duration,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      
      return {
        passed: false,
        exitCode: 1,
        output: '',
        error: error instanceof Error ? error.message : String(error),
        duration,
      }
    }
  }
}
