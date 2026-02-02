import type { ValidatorDefinition, ValidationContext, ValidatorOutput, ValidatorContextInput, ValidatorContextAnalyzedGroup, ValidatorContextFinding } from '../../../types/index.js'
import { access, copyFile, mkdir, readdir, rm } from 'fs/promises'
import { dirname, isAbsolute, join, relative as pathRelative } from 'path'
import { tmpdir } from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'
import { TestRunnerService } from '../../../services/TestRunnerService.js'

const execAsync = promisify(exec)

// ============================================================================
// Type Definitions
// ============================================================================

type FailureClassification = 'VALID_TEST_FAILURE' | 'INFRA_FAILURE' | 'UNKNOWN'

interface InstallResult {
  success: boolean
  command: string
  exitCode: number
  output: string
  duration: number
}

interface LockfileConfig {
  file: string
  cmd: string
  fallbackCmd: string
}

// ============================================================================
// Classification Patterns
// ============================================================================

const INFRA_PATTERNS: RegExp[] = [
  /Cannot find package/i,
  /Cannot find module/i,
  /ERR_MODULE_NOT_FOUND/i,
  /failed to load config/i,
  /Startup Error/i,
  /npm ERR!/i,
  /command not found/i,
  /ENOENT/i,
  /Unsupported engine/i,
  /Test file not found/i,
]

const VALID_TEST_FAILURE_PATTERNS: RegExp[] = [
  /FAIL\s+.*\.(spec|test)\.(ts|tsx|js|jsx)/i,
  /AssertionError/i,
  /expect\(.*\)\.to/i,
  /\d+ failed/i,
  /Tests:\s+\d+ failed/i,
  /[✕×]/,
]

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Classifies test output as VALID_TEST_FAILURE, INFRA_FAILURE, or UNKNOWN
 */
function classifyFailure(output: string, exitCode: number): FailureClassification {
  // If test passed (exitCode 0), this is unexpected in "red phase" context
  if (exitCode === 0) {
    return 'UNKNOWN'
  }

  // Check for infra patterns first (higher priority)
  for (const pattern of INFRA_PATTERNS) {
    if (pattern.test(output)) {
      return 'INFRA_FAILURE'
    }
  }

  // Check for valid test failure patterns
  for (const pattern of VALID_TEST_FAILURE_PATTERNS) {
    if (pattern.test(output)) {
      return 'VALID_TEST_FAILURE'
    }
  }

  // Fallback to UNKNOWN (will be treated as INFRA)
  return 'UNKNOWN'
}

/**
 * Detects the package manager based on lockfile presence in the worktree
 */
async function detectPackageManager(worktreePath: string): Promise<LockfileConfig | null> {
  const lockfileOrder: LockfileConfig[] = [
    { file: 'package-lock.json', cmd: 'npm ci', fallbackCmd: 'npm install --no-audit --no-fund' },
    { file: 'pnpm-lock.yaml', cmd: 'pnpm install --frozen-lockfile', fallbackCmd: 'pnpm install --no-frozen-lockfile' },
    { file: 'yarn.lock', cmd: 'yarn install --frozen-lockfile', fallbackCmd: 'yarn install' },
  ]

  let files: string[]
  try {
    files = await readdir(worktreePath)
  } catch {
    return null
  }

  for (const config of lockfileOrder) {
    if (files.includes(config.file)) {
      return config
    }
  }

  return null
}

/**
 * Patterns that indicate a lockfile sync issue (recoverable via fallback)
 */
const LOCKFILE_SYNC_PATTERNS: RegExp[] = [
  /package-lock\.json.*are in sync/i,
  /npm ci.*can only install.*when.*in sync/i,
  /Missing:.*from lock file/i,
  /EUSAGE/i,
  /frozen-lockfile/i,
  /lockfile is not up-to-date/i,
]

function isLockfileSyncError(output: string): boolean {
  return LOCKFILE_SYNC_PATTERNS.some((pattern) => pattern.test(output))
}

/**
 * Executes a single install command and returns the result
 */
async function executeInstallCommand(
  command: string,
  worktreePath: string
): Promise<InstallResult> {
  const startTime = Date.now()

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: worktreePath,
      timeout: 300000, // 5 minutes
      maxBuffer: 10 * 1024 * 1024, // 10MB
    })

    const duration = Date.now() - startTime
    const output = `${stdout}\n${stderr}`.trim()

    return {
      success: true,
      command,
      exitCode: 0,
      output,
      duration,
    }
  } catch (error) {
    const duration = Date.now() - startTime
    const execError = error as { code?: number; stdout?: string; stderr?: string; message?: string }
    const output = `${execError.stdout || ''}\n${execError.stderr || ''}\n${execError.message || ''}`.trim()

    return {
      success: false,
      command,
      exitCode: execError.code ?? 1,
      output,
      duration,
    }
  }
}

/**
 * Installs dependencies in the worktree.
 * Uses strict install (npm ci) first; falls back to permissive install (npm install)
 * if the failure is due to lockfile desync (common when checking out older refs).
 */
async function installDependencies(worktreePath: string): Promise<InstallResult> {
  const packageManager = await detectPackageManager(worktreePath)

  if (!packageManager) {
    return {
      success: false,
      command: 'none',
      exitCode: -1,
      output: 'No lockfile found (package-lock.json, pnpm-lock.yaml, or yarn.lock)',
      duration: 0,
    }
  }

  // Try strict install first (npm ci / --frozen-lockfile)
  const strictResult = await executeInstallCommand(packageManager.cmd, worktreePath)

  if (strictResult.success) {
    return strictResult
  }

  // If strict install failed due to lockfile sync issues, try permissive fallback
  if (isLockfileSyncError(strictResult.output)) {
    console.log(
      `[TEST_FAILS_BEFORE_IMPLEMENTATION] Lockfile sync issue detected, falling back to: ${packageManager.fallbackCmd}`
    )

    const fallbackResult = await executeInstallCommand(packageManager.fallbackCmd, worktreePath)

    if (fallbackResult.success) {
      // Return success but note the fallback in output for transparency
      return {
        ...fallbackResult,
        command: `${packageManager.cmd} → ${packageManager.fallbackCmd} (lockfile fallback)`,
      }
    }

    // Both failed — return the fallback error (more informative)
    return {
      ...fallbackResult,
      command: `${packageManager.cmd} → ${packageManager.fallbackCmd} (both failed)`,
      output: `Strict install failed (lockfile desync):\n${strictResult.output.slice(0, 300)}\n\nFallback install also failed:\n${fallbackResult.output}`,
    }
  }

  // Non-lockfile error — return original result as-is
  return strictResult
}

/**
 * Generates ValidatorOutput with proper context, inputs, analyzed groups, and evidence
 */
function generateValidatorOutput(
  classification: FailureClassification,
  testPassed: boolean,
  testOutput: string,
  testExitCode: number,
  testDuration: number,
  baseRef: string,
  testFilePath: string,
  worktreePath: string,
  installResult?: InstallResult
): ValidatorOutput {
  const contextInputs: ValidatorContextInput[] = [
    { label: 'BaseRef', value: baseRef },
    { label: 'TestFilePath', value: testFilePath },
    { label: 'WorktreePath', value: worktreePath },
  ]

  const analyzedItems: string[] = []

  if (installResult) {
    analyzedItems.push(`Install: ${installResult.command} (exitCode: ${installResult.exitCode}, duration: ${installResult.duration}ms)`)
  }
  analyzedItems.push(`Test: exitCode=${testExitCode}, duration=${testDuration}ms`)

  const contextAnalyzed: ValidatorContextAnalyzedGroup[] = [
    { label: 'Commands Executed', items: analyzedItems },
  ]

  const outputExcerpt = testOutput.slice(0, 500)

  // TDD Violation case - test passed on baseRef
  if (testPassed) {
    const findings: ValidatorContextFinding[] = [
      { type: 'fail', message: 'Test passed on baseRef - TDD red phase required' },
    ]

    return {
      passed: false,
      status: 'FAILED',
      message: 'CLÁUSULA PÉTREA VIOLATION: Test passed on base_ref but should fail',
      context: {
        inputs: contextInputs,
        analyzed: contextAnalyzed,
        findings,
        reasoning: 'Test must fail on base_ref to confirm TDD red phase.',
      },
      evidence: `Classification: TDD_VIOLATION\nTest output:\n${outputExcerpt}`,
    }
  }

  // INFRA_FAILURE case
  if (classification === 'INFRA_FAILURE' || classification === 'UNKNOWN') {
    const findings: ValidatorContextFinding[] = [
      { type: 'fail', message: `Classification: ${classification}` },
    ]

    return {
      passed: false,
      status: 'FAILED',
      message: `Infra failure detected: ${classification}`,
      context: {
        inputs: contextInputs,
        analyzed: contextAnalyzed,
        findings,
        reasoning: 'Infrastructure issues prevent reliable test execution.',
      },
      evidence: `Classification: INFRA\nTest output:\n${outputExcerpt}`,
    }
  }

  // VALID_TEST_FAILURE case - PASS
  const findings: ValidatorContextFinding[] = [
    { type: 'pass', message: 'Valid test failure detected' },
  ]

  return {
    passed: true,
    status: 'PASSED',
    message: 'Test correctly fails on base_ref (TDD red phase confirmed)',
    context: {
      inputs: contextInputs,
      analyzed: contextAnalyzed,
      findings,
      reasoning: 'Test failure on base_ref confirms TDD red phase.',
    },
    evidence: `Classification: VALID\nTest output:\n${outputExcerpt}`,
  }
}

export const TestFailsBeforeImplementationValidator: ValidatorDefinition = {
  code: 'TEST_FAILS_BEFORE_IMPLEMENTATION',
  name: 'Test Fails Before Implementation',
  description: 'CLÁUSULA PÉTREA: Teste deve falhar no base_ref',
  gate: 1,
  order: 4,
  isHardBlock: true,

  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    console.log('[TEST_FAILS_BEFORE_IMPLEMENTATION] Using testFilePath:', ctx.testFilePath)
    if (!ctx.testFilePath) {
      return {
        passed: false,
        status: 'FAILED',
        message: 'Test file path not configured',
        context: {
          inputs: [{ label: 'BaseRef', value: ctx.baseRef }],
          analyzed: [],
          findings: [{ type: 'fail', message: 'Test file path not provided' }],
          reasoning: 'Cannot validate base_ref behavior without a test file path.',
        },
      }
    }

    // Sandbox path: %TEMP%\gatekeeper\<runId>\baseRef
    const worktreePath = join(tmpdir(), 'gatekeeper', ctx.runId, 'baseRef')
    const worktreeParent = dirname(worktreePath)

    // If testFilePath is absolute in the real repo, re-resolve inside the worktree.
    const rel = isAbsolute(ctx.testFilePath)
      ? pathRelative(ctx.projectPath, ctx.testFilePath)
      : ctx.testFilePath
    const testInWorktree = join(worktreePath, rel)
    const testInWorktreeNormalized = testInWorktree.replace(/\\/g, '/')

    let installResult: InstallResult | undefined

    try {
      try {
        await access(ctx.testFilePath)
      } catch {
        return {
          passed: false,
          status: 'FAILED',
          message: `Test file not found: ${ctx.testFilePath}`,
          context: {
            inputs: [
              { label: 'BaseRef', value: ctx.baseRef },
              { label: 'TestFilePath', value: ctx.testFilePath },
              { label: 'WorktreePath', value: worktreePath },
            ],
            analyzed: [],
            findings: [{ type: 'fail', message: 'Test file not found' }],
            reasoning: 'Cannot run base_ref test because the test file does not exist.',
          },
          evidence: 'Classification: INFRA\nTest file does not exist in the source location.',
        }
      }

      // Ensure clean sandbox directory
      await rm(worktreePath, { recursive: true, force: true })
      await mkdir(worktreeParent, { recursive: true })

      console.log('[TEST_FAILS_BEFORE_IMPLEMENTATION] Creating baseRef worktree:', {
        baseRef: ctx.baseRef,
        worktreePath,
      })

      await ctx.services.git.createWorktree(ctx.baseRef, worktreePath)

      // RF1: Install dependencies in the worktree
      console.log('[TEST_FAILS_BEFORE_IMPLEMENTATION] Installing dependencies in worktree...')
      installResult = await installDependencies(worktreePath)

      if (!installResult.success) {
        console.log('[TEST_FAILS_BEFORE_IMPLEMENTATION] Dependency installation failed:', installResult.output)
        return generateValidatorOutput(
          'INFRA_FAILURE',
          false,
          installResult.output,
          installResult.exitCode,
          installResult.duration,
          ctx.baseRef,
          ctx.testFilePath,
          worktreePath,
          installResult
        )
      }

      console.log('[TEST_FAILS_BEFORE_IMPLEMENTATION] Dependencies installed successfully')

      const runner = new TestRunnerService(worktreePath)

      const testDir = dirname(testInWorktree)
      const testDirNormalized = testDir.replace(/\\/g, '/')
      await mkdir(testDirNormalized, { recursive: true })
      await copyFile(ctx.testFilePath, testInWorktreeNormalized)
      console.log('[TEST_FAILS_BEFORE_IMPLEMENTATION] Copied spec to worktree:', testInWorktreeNormalized)

      console.log('[TEST_FAILS_BEFORE_IMPLEMENTATION] Running test in worktree:', {
        testFilePath: ctx.testFilePath,
        testInWorktree,
      })

      const result = await runner.runSingleTest(testInWorktreeNormalized)

      // RF2: Classify the failure
      const classification = classifyFailure(result.output, result.exitCode)
      console.log('[TEST_FAILS_BEFORE_IMPLEMENTATION] Failure classification:', classification)

      // RF3: Generate output based on classification
      return generateValidatorOutput(
        classification,
        result.passed,
        result.output,
        result.exitCode,
        result.duration,
        ctx.baseRef,
        ctx.testFilePath,
        worktreePath,
        installResult
      )
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return {
        passed: false,
        status: 'FAILED',
        message: 'Failed to run base_ref test in worktree',
        context: {
          inputs: [
            { label: 'BaseRef', value: ctx.baseRef },
            { label: 'TestFilePath', value: ctx.testFilePath },
            { label: 'WorktreePath', value: worktreePath },
          ],
          analyzed: installResult
            ? [{ label: 'Commands Executed', items: [`Install: ${installResult.command} (exitCode: ${installResult.exitCode})`] }]
            : [],
          findings: [{ type: 'fail', message: 'Worktree test execution failed' }],
          reasoning: 'An error occurred while running the test in the base_ref worktree.',
        },
        evidence: `Classification: INFRA\nBaseRef: ${ctx.baseRef}\nWorktree: ${worktreePath}\nError: ${errorMessage}`,
      }
    } finally {
      try {
        await ctx.services.git.removeWorktree(worktreePath)
      } catch (cleanupError) {
        console.warn(
          '[TEST_FAILS_BEFORE_IMPLEMENTATION] Failed to remove worktree:',
          cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
        )
      }

      // Best-effort filesystem cleanup
      try {
        await rm(worktreePath, { recursive: true, force: true })
      } catch {
        // Intentionally ignored - cleanup is best-effort only
      }
    }
  },
}
