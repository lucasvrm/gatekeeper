import { execa } from 'execa'
import { relative, isAbsolute, resolve, sep, posix } from 'path'
import * as fs from 'fs'
import { stripAnsi } from '../utils/stripAnsi.js'
import type { TestRunnerService as ITestRunnerService, TestResult } from '../types/index.js'

type TestRunnerOptions = {
  timeout?: number
}

type PathApi = {
  resolve: typeof resolve
  relative: typeof relative
  sep: string
}

export function deriveRunnerCwdAndPath(absoluteTestPath: string, projectPath: string) {
  const isPosixStyle =
    absoluteTestPath.startsWith('/') &&
    !absoluteTestPath.includes('\\') &&
    projectPath.startsWith('/') &&
    !projectPath.includes('\\')
  const pathApi: PathApi = isPosixStyle ? posix : { resolve, relative, sep }

  const packageRoot = pathApi.resolve(projectPath, 'packages', 'gatekeeper-api')
  const isInPackage =
    absoluteTestPath === packageRoot || absoluteTestPath.startsWith(packageRoot + pathApi.sep)

  const runnerCwd = isInPackage ? packageRoot : projectPath
  const runnerPath = pathApi.relative(runnerCwd, absoluteTestPath).replace(/\\/g, '/')

  return { runnerCwd, runnerPath }
}

export class TestRunnerService implements ITestRunnerService {
  private projectPath: string
  private timeoutMs: number

  constructor(projectPath: string, options: TestRunnerOptions = {}) {
    this.projectPath = projectPath
    this.timeoutMs = options.timeout ?? 10 * 60 * 1000
  }

  async runSingleTest(testPath: string): Promise<TestResult> {
    const startTime = Date.now()

    try {
      console.log('[TestRunnerService] Running test with:')
      console.log('[TestRunnerService]   projectPath:', this.projectPath)
      console.log('[TestRunnerService]   testPath:', testPath)

      // Check if file exists
      const absoluteTestPath = isAbsolute(testPath) ? testPath : resolve(this.projectPath, testPath)
      if (!fs.existsSync(absoluteTestPath)) {
        return {
          passed: false,
          exitCode: 1,
          output: `Test file not found: ${testPath}`,
          error: `File does not exist: ${testPath}`,
          duration: Date.now() - startTime,
        }
      }

      const { runnerCwd, runnerPath } = deriveRunnerCwdAndPath(
        absoluteTestPath,
        this.projectPath,
      )

      console.log('[TestRunnerService]   relativePath:', runnerPath)
      console.log('[TestRunnerService]   cwd:', runnerCwd)

      const result = await execa('npm', ['test', '--', runnerPath], {
        cwd: runnerCwd,
        reject: false,
        env: { ...process.env, CI: '1' },
        timeout: this.timeoutMs,
        killSignal: 'SIGKILL',
        windowsHide: true,
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
        env: { ...process.env, CI: '1' },
        timeout: this.timeoutMs,
        killSignal: 'SIGKILL',
        windowsHide: true,
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
