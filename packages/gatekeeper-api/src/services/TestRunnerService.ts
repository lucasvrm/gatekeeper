import { execa } from 'execa'
import { relative, isAbsolute, resolve } from 'path'
import { existsSync } from 'fs'
import { stripAnsi } from '../utils/stripAnsi.js'
import type { TestRunnerService as ITestRunnerService, TestResult } from '../types/index.js'

export class TestRunnerService implements ITestRunnerService {
  private projectPath: string

  constructor(projectPath: string) {
    this.projectPath = projectPath
  }

  async runSingleTest(testPath: string): Promise<TestResult> {
    const startTime = Date.now()

    try {
      console.log('[TestRunnerService] Running test with:')
      console.log('[TestRunnerService]   projectPath:', this.projectPath)
      console.log('[TestRunnerService]   testPath:', testPath)

      // Check if file exists
      const absoluteTestPath = isAbsolute(testPath) ? testPath : resolve(this.projectPath, testPath)
      if (!existsSync(absoluteTestPath)) {
        return {
          passed: false,
          exitCode: 1,
          output: `Test file not found: ${testPath}`,
          error: `File does not exist: ${testPath}`,
          duration: Date.now() - startTime,
        }
      }

      // Convert absolute path to relative for test runner
      const relativePath = isAbsolute(testPath)
        ? relative(this.projectPath, testPath).replace(/\\/g, '/')
        : testPath

      console.log('[TestRunnerService]   relativePath:', relativePath)
      console.log('[TestRunnerService]   cwd:', this.projectPath)

      const result = await execa('npm', ['test', '--', relativePath], {
        cwd: this.projectPath,
        reject: false,
      })

      const duration = Date.now() - startTime
      const rawOutput = result.stdout + result.stderr

      return {
        passed: result.exitCode === 0,
        exitCode: result.exitCode ?? -1,
        output: stripAnsi(rawOutput),
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
      const rawOutput = result.stdout + result.stderr

      return {
        passed: result.exitCode === 0,
        exitCode: result.exitCode ?? -1,
        output: stripAnsi(rawOutput),
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
