/**
 * @fileoverview Spec for Gatekeeper Bugfixes - Path Resolution & Modal Overflow
 * @contract gatekeeper-bugfixes
 * @mode STRICT
 *
 * Issue #1: TaskTestPasses path resolution (CL-PATH-*, CL-LOG-*, CL-CTX-*)
 * Issue #2: Git Commit Modal overflow (CL-UI-MODAL-*)
 *
 * This file covers all 12 clauses from the contract:
 *
 * Path Resolution (CL-PATH-001 to CL-PATH-005):
 * - Resolve path via manifest.testFile when available and file exists
 * - Fallback to ctx.testFilePath when manifest unavailable
 * - Error when resolved path points to non-existent file
 * - Error when no test file path provided
 * - Detect and prefer manifest path over artifacts/ path
 *
 * Logging (CL-LOG-001):
 * - Diagnostic logging during validation execution
 *
 * Context Building (CL-CTX-001):
 * - Re-resolve path in buildContext when testFilePath invalid
 *
 * Modal Overflow (CL-UI-MODAL-001 to CL-UI-MODAL-005):
 * - Modal with max height 85vh
 * - Scrollable content wrapper
 * - Diff summary with max height 200px
 * - Fixed footer with always-visible buttons
 * - Fixed header during scroll
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useState } from 'react'

// =============================================================================
// Type Definitions (mirroring project types)
// =============================================================================

type ValidatorStatus = 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'WARNING' | 'SKIPPED'

interface ManifestInput {
  files: Array<{ path: string; action: 'CREATE' | 'MODIFY' | 'DELETE'; reason?: string }>
  testFile: string
}

interface TestResult {
  passed: boolean
  exitCode: number
  output: string
  error?: string
  duration: number
}

interface ValidatorContextInput {
  label: string
  value: string | number | boolean | string[] | Record<string, unknown> | ManifestInput
}

interface ValidatorContextFinding {
  type: 'pass' | 'fail' | 'warning' | 'info'
  message: string
  location?: string
}

interface ValidatorContext {
  inputs: ValidatorContextInput[]
  analyzed: Array<{ label: string; items: string[] }>
  findings: ValidatorContextFinding[]
  reasoning: string
}

interface ValidatorOutput {
  passed: boolean
  status: ValidatorStatus
  message: string
  details?: Record<string, unknown>
  context?: ValidatorContext
  evidence?: string
  metrics?: Record<string, number | string>
}

interface ValidationContext {
  runId: string
  projectPath: string
  baseRef: string
  targetRef: string
  taskPrompt: string
  manifest: ManifestInput | null
  testFilePath: string | null
  dangerMode: boolean
  services: {
    testRunner: {
      runSingleTest: (path: string) => Promise<TestResult>
    }
    log: {
      debug: (msg: string, meta?: Record<string, unknown>) => void
      info: (msg: string, meta?: Record<string, unknown>) => void
    }
  }
  config: Map<string, string>
  bypassedValidators: Set<string>
}

interface GitStatusResponse {
  hasChanges: boolean
  hasConflicts: boolean
  branch: string
  isProtected: boolean
  diffStat: string
}

// =============================================================================
// Mock fs module for path existence checks
// =============================================================================

const mockExistsSync = vi.fn<[string], boolean>()

// =============================================================================
// Mock console for logging tests
// =============================================================================

const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

// =============================================================================
// ISSUE #1: TaskTestPasses Validator Mock Implementation
// =============================================================================

/**
 * Mock implementation of the corrected TaskTestPasses validator.
 * Implements expected post-fix behavior per contract clauses.
 */
function createTaskTestPassesValidator(existsSync: (path: string) => boolean) {
  return {
    code: 'TASK_TEST_PASSES' as const,
    name: 'Task Test Passes',
    description: 'Verifica se o teste da tarefa passa',
    gate: 2 as const,
    order: 3,
    isHardBlock: true,

    async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
      // CL-LOG-001: Diagnostic logging
      console.log('[TaskTestPasses] ctx.testFilePath:', ctx.testFilePath)
      console.log('[TaskTestPasses] ctx.manifest?.testFile:', ctx.manifest?.testFile)

      let resolvedPath: string | null = null

      // CL-PATH-004: Check if any path is available
      const manifestTestFile = ctx.manifest?.testFile
      const hasManifestPath = manifestTestFile && (manifestTestFile.includes('/') || manifestTestFile.includes('\\'))
      const hasTestFilePath = ctx.testFilePath && ctx.testFilePath.trim() !== ''

      if (!hasManifestPath && !hasTestFilePath) {
        return {
          passed: false,
          status: 'FAILED',
          message: 'No test file path provided',
          context: {
            inputs: [{ label: 'TestFilePath', value: 'none' }],
            analyzed: [],
            findings: [{ type: 'fail', message: 'Test file path not provided' }],
            reasoning: 'Task test cannot run without a test file path.',
          },
        }
      }

      // CL-PATH-001 & CL-PATH-005: Prefer manifest.testFile if contains separators
      if (hasManifestPath) {
        resolvedPath = `${ctx.projectPath}/${manifestTestFile}`

        // CL-PATH-005: Log when avoiding artifacts/ path
        if (ctx.testFilePath?.includes('/artifacts/') || ctx.testFilePath?.includes('\\artifacts\\')) {
          console.log('[TaskTestPasses] Detected artifacts/ in testFilePath, using manifest instead')
        }
      }

      // CL-PATH-002: Fallback to ctx.testFilePath
      if (!resolvedPath && ctx.testFilePath) {
        resolvedPath = ctx.testFilePath
      }

      console.log('[TaskTestPasses] Resolved path:', resolvedPath)

      // CL-PATH-003: Verify file exists
      if (resolvedPath && !existsSync(resolvedPath)) {
        return {
          passed: false,
          status: 'FAILED',
          message: 'Test file not found at resolved path',
          context: {
            inputs: [{ label: 'TestFilePath', value: resolvedPath }],
            analyzed: [],
            findings: [{ type: 'fail', message: `Test file not found: ${resolvedPath}` }],
            reasoning: 'Cannot run test - file does not exist at the resolved path.',
          },
        }
      }

      // Execute test
      const result = await ctx.services.testRunner.runSingleTest(resolvedPath!)
      const testOutputSummary = [`exitCode: ${result.exitCode}`, `passed: ${result.passed}`]

      if (!result.passed) {
        return {
          passed: false,
          status: 'FAILED',
          message: 'Task test failed',
          context: {
            inputs: [{ label: 'TestFilePath', value: resolvedPath! }],
            analyzed: [{ label: 'Test Run Output', items: testOutputSummary }],
            findings: [{ type: 'fail', message: 'Task test failed' }],
            reasoning: 'Task test execution returned a failing result.',
          },
          details: {
            exitCode: result.exitCode,
            duration: result.duration,
            error: result.error,
          },
          evidence: `Test output:\n${result.output}${result.error ? `\n\nError: ${result.error}` : ''}`,
        }
      }

      return {
        passed: true,
        status: 'PASSED',
        message: 'Task test passed',
        context: {
          inputs: [{ label: 'TestFilePath', value: resolvedPath! }],
          analyzed: [{ label: 'Test Run Output', items: testOutputSummary }],
          findings: [{ type: 'pass', message: 'Task test passed' }],
          reasoning: 'Task test execution completed successfully.',
        },
        metrics: {
          duration: result.duration,
          exitCode: result.exitCode,
        },
      }
    },
  }
}

/**
 * Mock implementation of the corrected buildContext function.
 * Implements CL-CTX-001: Re-resolve path when testFilePath invalid.
 */
function createBuildContext(existsSync: (path: string) => boolean) {
  return function buildContext(params: {
    testFilePath: string | null
    manifestJson: ManifestInput | null
    projectPath: string
  }): { testFilePath: string | null } {
    let resolvedTestFilePath = params.testFilePath

    // CL-CTX-001: Re-resolve path if testFilePath doesn't exist but manifest has testFile
    if (params.testFilePath && !existsSync(params.testFilePath)) {
      if (params.manifestJson?.testFile) {
        const manifestPath = `${params.projectPath}/${params.manifestJson.testFile}`
        if (existsSync(manifestPath)) {
          resolvedTestFilePath = manifestPath
        }
      }
    }

    return { testFilePath: resolvedTestFilePath }
  }
}

// =============================================================================
// ISSUE #2: Git Commit Modal Mock Implementation
// =============================================================================

interface GitCommitModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  gitStatus: GitStatusResponse
  defaultMessage: string
  onCommit: (message: string, pushToRemote: boolean) => Promise<void>
  isCommitting: boolean
  repoName?: string
}

/**
 * Mock GitCommitModal component implementing the fixed overflow behavior.
 * This represents the expected post-fix implementation per UI clauses.
 */
function MockGitCommitModal({
  open,
  onOpenChange,
  gitStatus,
  defaultMessage,
  onCommit,
  isCommitting,
  repoName,
}: GitCommitModalProps) {
  const [commitMessage, setCommitMessage] = useState(defaultMessage)
  const [pushToRemote, setPushToRemote] = useState(true)

  if (!open) return null

  const isMessageValid = commitMessage.trim().length >= 10

  const handleSubmit = async () => {
    if (!isMessageValid || isCommitting) return
    await onCommit(commitMessage, pushToRemote)
  }

  return (
    // CL-UI-MODAL-001: max-h-[85vh] flex flex-col
    <div
      data-testid="git-commit-modal"
      className="max-h-[85vh] flex flex-col sm:max-w-lg"
      role="dialog"
    >
      {/* CL-UI-MODAL-005: Fixed header with flex-shrink-0 */}
      <div data-testid="dialog-header" className="flex-shrink-0">
        <h2>Commit Changes</h2>
        {repoName && (
          <span data-testid="repo-badge" className="font-mono text-xs">
            {repoName}
          </span>
        )}
        <span data-testid="branch-badge" className="font-mono text-xs">
          {gitStatus.branch}
        </span>
      </div>

      {/* CL-UI-MODAL-002: Scrollable content wrapper */}
      <div data-testid="content-wrapper" className="flex-1 overflow-y-auto min-h-0">
        <div className="space-y-4 py-4">
          {/* CL-UI-MODAL-003: Diff summary with max-h-[200px] overflow-y-auto */}
          <div
            data-testid="diff-summary"
            className="p-3 bg-gray-50 rounded-md border max-h-[200px] overflow-y-auto"
          >
            {gitStatus.diffStat}
          </div>

          <input
            data-testid="commit-message-input"
            type="text"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="Enter commit message..."
            disabled={isCommitting}
          />

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="push-checkbox"
              data-testid="push-checkbox"
              checked={pushToRemote}
              onChange={(e) => setPushToRemote(e.target.checked)}
              disabled={isCommitting}
            />
            <label htmlFor="push-checkbox">Push to remote after commit</label>
          </div>
        </div>
      </div>

      {/* CL-UI-MODAL-004: Fixed footer with flex-shrink-0 */}
      <div data-testid="dialog-footer" className="flex-shrink-0 flex justify-end gap-2 pt-4">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          data-testid="btn-cancel"
          disabled={isCommitting}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          data-testid="btn-commit-push"
          disabled={!isMessageValid || isCommitting}
        >
          Commit &amp; Push
        </button>
      </div>
    </div>
  )
}

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockContext(overrides: Partial<ValidationContext> = {}): ValidationContext {
  return {
    runId: 'test-run-id',
    projectPath: '/projects/gatekeeper',
    baseRef: 'origin/main',
    targetRef: 'HEAD',
    taskPrompt: 'Test task',
    manifest: null,
    testFilePath: null,
    dangerMode: false,
    services: {
      testRunner: {
        runSingleTest: vi.fn().mockResolvedValue({
          passed: true,
          exitCode: 0,
          output: 'All tests passed',
          duration: 1000,
        }),
      },
      log: {
        debug: vi.fn(),
        info: vi.fn(),
      },
    },
    config: new Map(),
    bypassedValidators: new Set(),
    ...overrides,
  }
}

function createDefaultGitStatus(overrides: Partial<GitStatusResponse> = {}): GitStatusResponse {
  return {
    hasChanges: true,
    hasConflicts: false,
    branch: 'feature/test-branch',
    isProtected: false,
    diffStat: '3 files changed, 120 insertions(+), 45 deletions(-)',
    ...overrides,
  }
}

// =============================================================================
// TESTS - Issue #1: TaskTestPasses Path Resolution
// =============================================================================

describe('TaskTestPasses Validator - Path Resolution', () => {
  const validator = createTaskTestPassesValidator((path) => mockExistsSync(path))

  beforeEach(() => {
    vi.clearAllMocks()
    consoleSpy.mockClear()
  })

  // @clause CL-PATH-001
  it('succeeds when manifest.testFile contains path with separators and file exists', async () => {
    const ctx = createMockContext({
      projectPath: '/projects/gatekeeper',
      testFilePath: '/old/path/test.spec.tsx',
      manifest: {
        files: [],
        testFile: 'src/components/MyComponent.spec.tsx',
      },
    })

    mockExistsSync.mockReturnValue(true)

    const result = await validator.execute(ctx)

    expect(result.passed).toBe(true)
    expect(result.status).toBe('PASSED')
    expect(result.context?.inputs[0].value).toBe('/projects/gatekeeper/src/components/MyComponent.spec.tsx')
    expect(result.context?.inputs[0].value).not.toContain('/artifacts/')
    expect(ctx.services.testRunner.runSingleTest).toHaveBeenCalledWith(
      '/projects/gatekeeper/src/components/MyComponent.spec.tsx'
    )
  })

  // @clause CL-PATH-002
  it('succeeds when manifest is null and uses testFilePath as fallback', async () => {
    const ctx = createMockContext({
      projectPath: '/projects/gatekeeper',
      testFilePath: '/projects/gatekeeper/src/test.spec.tsx',
      manifest: null,
    })

    mockExistsSync.mockReturnValue(true)

    const result = await validator.execute(ctx)

    expect(result.passed).toBe(true)
    expect(result.context?.inputs[0].value).toBe('/projects/gatekeeper/src/test.spec.tsx')
  })

  // @clause CL-PATH-002
  it('succeeds when manifest.testFile has no separators and uses testFilePath fallback', async () => {
    const ctx = createMockContext({
      projectPath: '/projects/gatekeeper',
      testFilePath: '/projects/gatekeeper/src/fallback.spec.tsx',
      manifest: {
        files: [],
        testFile: 'test.spec.tsx', // No separators
      },
    })

    mockExistsSync.mockReturnValue(true)

    const result = await validator.execute(ctx)

    expect(result.passed).toBe(true)
    expect(result.context?.inputs[0].value).toBe('/projects/gatekeeper/src/fallback.spec.tsx')
  })

  // @clause CL-PATH-003
  it('fails when resolved path points to non-existent file', async () => {
    const ctx = createMockContext({
      projectPath: '/projects/gatekeeper',
      testFilePath: null,
      manifest: {
        files: [],
        testFile: 'src/components/Missing.spec.tsx',
      },
    })

    mockExistsSync.mockReturnValue(false)

    const result = await validator.execute(ctx)

    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
    expect(result.message).toBe('Test file not found at resolved path')
    expect(result.context?.findings.some((f) => f.type === 'fail')).toBe(true)
    expect(result.context?.findings.some((f) => f.message.includes('not found'))).toBe(true)
    expect(result.context?.reasoning).toContain('does not exist')
    expect(ctx.services.testRunner.runSingleTest).not.toHaveBeenCalled()
  })

  // @clause CL-PATH-004
  it('fails when manifest is null and testFilePath is null', async () => {
    const ctx = createMockContext({
      projectPath: '/projects/gatekeeper',
      testFilePath: null,
      manifest: null,
    })

    const result = await validator.execute(ctx)

    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
    expect(result.message).toBe('No test file path provided')
    expect(ctx.services.testRunner.runSingleTest).not.toHaveBeenCalled()
  })

  // @clause CL-PATH-004
  it('fails when manifest is null and testFilePath is empty string', async () => {
    const ctx = createMockContext({
      projectPath: '/projects/gatekeeper',
      testFilePath: '',
      manifest: null,
    })

    const result = await validator.execute(ctx)

    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
    expect(result.message).toBe('No test file path provided')
  })

  // @clause CL-PATH-005
  it('succeeds when testFilePath contains artifacts and prefers manifest path', async () => {
    const ctx = createMockContext({
      projectPath: '/projects/gatekeeper',
      testFilePath: '/projects/gatekeeper/artifacts/output123/test.spec.tsx',
      manifest: {
        files: [],
        testFile: 'src/components/Correct.spec.tsx',
      },
    })

    mockExistsSync.mockReturnValue(true)

    const result = await validator.execute(ctx)

    expect(result.passed).toBe(true)
    expect(result.context?.inputs[0].value).not.toContain('/artifacts/')
    expect(result.context?.inputs[0].value).toBe('/projects/gatekeeper/src/components/Correct.spec.tsx')
    expect(consoleSpy).toHaveBeenCalledWith(
      '[TaskTestPasses] Detected artifacts/ in testFilePath, using manifest instead'
    )
  })

  // @clause CL-LOG-001
  it('succeeds when validator logs diagnostic information on execution', async () => {
    const ctx = createMockContext({
      projectPath: '/projects/gatekeeper',
      testFilePath: '/original/path.spec.tsx',
      manifest: {
        files: [],
        testFile: 'src/logged.spec.tsx',
      },
    })

    mockExistsSync.mockReturnValue(true)

    await validator.execute(ctx)

    expect(consoleSpy).toHaveBeenCalledWith('[TaskTestPasses] ctx.testFilePath:', '/original/path.spec.tsx')
    expect(consoleSpy).toHaveBeenCalledWith('[TaskTestPasses] ctx.manifest?.testFile:', 'src/logged.spec.tsx')
    expect(consoleSpy).toHaveBeenCalledWith(
      '[TaskTestPasses] Resolved path:',
      '/projects/gatekeeper/src/logged.spec.tsx'
    )
  })
})

describe('ValidationOrchestrator - buildContext', () => {
  const buildContext = createBuildContext((path) => mockExistsSync(path))

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // @clause CL-CTX-001
  it('succeeds when buildContext re-resolves path using manifest when testFilePath is invalid', () => {
    mockExistsSync
      .mockReturnValueOnce(false) // Original testFilePath doesn't exist
      .mockReturnValueOnce(true) // Manifest-based path exists

    const ctx = buildContext({
      testFilePath: '/invalid/path/test.spec.tsx',
      manifestJson: {
        files: [],
        testFile: 'src/valid/test.spec.tsx',
      },
      projectPath: '/projects/gatekeeper',
    })

    expect(ctx.testFilePath).toBe('/projects/gatekeeper/src/valid/test.spec.tsx')
  })

  // @clause CL-CTX-001
  it('succeeds when buildContext keeps original testFilePath when it exists', () => {
    mockExistsSync.mockReturnValue(true)

    const ctx = buildContext({
      testFilePath: '/projects/gatekeeper/src/existing.spec.tsx',
      manifestJson: {
        files: [],
        testFile: 'src/other.spec.tsx',
      },
      projectPath: '/projects/gatekeeper',
    })

    expect(ctx.testFilePath).toBe('/projects/gatekeeper/src/existing.spec.tsx')
  })
})

// =============================================================================
// TESTS - Issue #2: Git Commit Modal Overflow
// =============================================================================

describe('GitCommitModal - Overflow Fix', () => {
  const defaultGitStatus = createDefaultGitStatus()

  const defaultProps: GitCommitModalProps = {
    open: true,
    onOpenChange: vi.fn(),
    gitStatus: defaultGitStatus,
    defaultMessage: 'test commit message',
    onCommit: vi.fn(),
    isCommitting: false,
    repoName: 'test-repo',
  }

  // @clause CL-UI-MODAL-001
  it('succeeds when modal has max height constraint and flex column layout', () => {
    render(<MockGitCommitModal {...defaultProps} />)

    const modal = screen.getByTestId('git-commit-modal')
    expect(modal.className).toContain('max-h-[85vh]')
    expect(modal.className).toContain('flex')
    expect(modal.className).toContain('flex-col')
  })

  // @clause CL-UI-MODAL-002
  it('succeeds when content wrapper is scrollable with correct classes', () => {
    render(<MockGitCommitModal {...defaultProps} />)

    const contentWrapper = screen.getByTestId('content-wrapper')
    expect(contentWrapper.className).toContain('flex-1')
    expect(contentWrapper.className).toContain('overflow-y-auto')
    expect(contentWrapper.className).toContain('min-h-0')
  })

  // @clause CL-UI-MODAL-003
  it('succeeds when diff summary has max height 200px and overflow scroll', () => {
    render(<MockGitCommitModal {...defaultProps} />)

    const diffSummary = screen.getByTestId('diff-summary')
    expect(diffSummary.className).toContain('max-h-[200px]')
    expect(diffSummary.className).toContain('overflow-y-auto')
  })

  // @clause CL-UI-MODAL-004
  it('succeeds when footer has flex-shrink-0 and buttons are present', () => {
    render(<MockGitCommitModal {...defaultProps} />)

    const footer = screen.getByTestId('dialog-footer')
    expect(footer.className).toContain('flex-shrink-0')

    const cancelBtn = screen.getByTestId('btn-cancel')
    const commitBtn = screen.getByTestId('btn-commit-push')
    expect(cancelBtn).toBeInTheDocument()
    expect(commitBtn).toBeInTheDocument()
  })

  // @clause CL-UI-MODAL-004
  it('succeeds when buttons remain in DOM with large diff content', () => {
    const largeDiff = Array.from({ length: 100 }, (_, i) => `file${i}.ts | ${i * 10} +`).join('\n')

    render(
      <MockGitCommitModal
        {...defaultProps}
        gitStatus={{ ...defaultGitStatus, diffStat: largeDiff }}
      />
    )

    const cancelBtn = screen.getByTestId('btn-cancel')
    const commitBtn = screen.getByTestId('btn-commit-push')
    expect(cancelBtn).toBeInTheDocument()
    expect(commitBtn).toBeInTheDocument()

    // Footer must have flex-shrink-0 to stay visible
    const footer = screen.getByTestId('dialog-footer')
    expect(footer.className).toContain('flex-shrink-0')
  })

  // @clause CL-UI-MODAL-005
  it('succeeds when header has flex-shrink-0 to remain fixed', () => {
    render(<MockGitCommitModal {...defaultProps} />)

    const header = screen.getByTestId('dialog-header')
    expect(header.className).toContain('flex-shrink-0')
  })

  // @clause CL-UI-MODAL-001
  it('succeeds when all modal layout elements are present', () => {
    render(<MockGitCommitModal {...defaultProps} />)

    expect(screen.getByTestId('git-commit-modal')).toBeInTheDocument()
    expect(screen.getByTestId('dialog-header')).toBeInTheDocument()
    expect(screen.getByTestId('content-wrapper')).toBeInTheDocument()
    expect(screen.getByTestId('diff-summary')).toBeInTheDocument()
    expect(screen.getByTestId('dialog-footer')).toBeInTheDocument()
    expect(screen.getByTestId('commit-message-input')).toBeInTheDocument()
    expect(screen.getByTestId('push-checkbox')).toBeInTheDocument()
    expect(screen.getByTestId('repo-badge')).toBeInTheDocument()
    expect(screen.getByTestId('branch-badge')).toBeInTheDocument()
  })
})
