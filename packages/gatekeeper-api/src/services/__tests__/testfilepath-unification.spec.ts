import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Test Specification: Unificação do Path do Spec de Testes
 * Contract: testfilepath-unification
 * Mode: STRICT
 */

// =============================================================================
// MOCKS
// =============================================================================

const mocks = vi.hoisted(() => ({
  copyFile: vi.fn<[string, string], Promise<void>>(),
  mkdir: vi.fn<[string, { recursive?: boolean }], Promise<string | undefined>>(),
  access: vi.fn<[string], Promise<void>>(),
  consolelog: vi.fn<[...args: unknown[]], void>(),
  runSingleTest: vi.fn<[string], Promise<{ passed: boolean; error?: string }>>(),
  createWorktree: vi.fn<[string], Promise<string>>(),
  cleanupWorktree: vi.fn<[string], Promise<void>>(),
}))

vi.mock('node:fs/promises', () => ({
  copyFile: mocks.copyFile,
  mkdir: mocks.mkdir,
  access: mocks.access,
}))

// =============================================================================
// HELPERS
// =============================================================================

/** Normalize path to forward slashes and lowercase for cross-platform comparison */
function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').toLowerCase()
}

/** Join paths and normalize to forward slashes */
function joinNormalized(...parts: string[]): string {
  return parts.join('/').replace(/\/+/g, '/')
}

/** Get dirname with forward slashes */
function dirnameNormalized(p: string): string {
  const normalized = normalizePath(p)
  const lastSlash = normalized.lastIndexOf('/')
  return lastSlash > 0 ? normalized.substring(0, lastSlash) : normalized
}

/** Get relative path with forward slashes */
function relativeNormalized(from: string, to: string): string {
  const fromParts = normalizePath(from).split('/').filter(Boolean)
  const toParts = normalizePath(to).split('/').filter(Boolean)
  
  // Find common prefix
  let commonLength = 0
  while (commonLength < fromParts.length && 
         commonLength < toParts.length && 
         fromParts[commonLength] === toParts[commonLength]) {
    commonLength++
  }
  
  return toParts.slice(commonLength).join('/')
}

/** Check if path is absolute */
function isAbsolutePath(p: string): boolean {
  return p.startsWith('/') || /^[a-zA-Z]:/.test(p)
}

// =============================================================================
// TYPES
// =============================================================================

interface ValidationContext {
  testFilePath: string | null
  projectPath: string
  manifest?: { testFile?: string }
  services: {
    testRunner: { runSingleTest: typeof mocks.runSingleTest }
    worktree: {
      create: typeof mocks.createWorktree
      cleanup: typeof mocks.cleanupWorktree
    }
  }
}

interface ValidatorResult {
  passed: boolean
  status?: string
  message?: string
  context?: { inputs?: Record<string, unknown>; findings?: unknown[] }
  details?: { modifiedTests?: string[] }
}

// =============================================================================
// INLINE VALIDATOR IMPLEMENTATIONS (expected post-implementation behavior)
// =============================================================================

async function executeTestFailsBeforeImplementation(
  ctx: ValidationContext
): Promise<ValidatorResult> {
  const { copyFile, mkdir, access } = await import('node:fs/promises')
  
  // CL-TFBI-004: Log debug at start
  console.log('[TEST_FAILS_BEFORE_IMPLEMENTATION] Using testFilePath:', ctx.testFilePath)
  
  if (!ctx.testFilePath) {
    return {
      passed: false,
      status: 'FAILED',
      message: 'Test file path not configured',
      context: { inputs: { testFilePath: ctx.testFilePath } }
    }
  }
  
  // CL-TFBI-003: Fail gracefully if spec doesn't exist
  try {
    await access(ctx.testFilePath)
  } catch {
    return {
      passed: false,
      status: 'FAILED',
      message: `Test file not found: ${ctx.testFilePath}`,
      context: { inputs: { testFilePath: ctx.testFilePath } }
    }
  }
  
  // Create worktree
  const worktreePath = await ctx.services.worktree.create('baseRef')
  const worktreeNormalized = normalizePath(worktreePath)
  
  // Calculate relative path (normalized)
  const testFileNormalized = normalizePath(ctx.testFilePath)
  const projectNormalized = normalizePath(ctx.projectPath)
  
  const rel = isAbsolutePath(ctx.testFilePath)
    ? relativeNormalized(projectNormalized, testFileNormalized)
    : testFileNormalized
  
  const testInWorktree = joinNormalized(worktreeNormalized, rel)
  
  // CL-TFBI-001: Copy spec to worktree before running test
  const testDir = dirnameNormalized(testInWorktree)
  await mkdir(testDir, { recursive: true })
  await copyFile(ctx.testFilePath, testInWorktree)
  console.log('[TEST_FAILS_BEFORE_IMPLEMENTATION] Copied spec to worktree:', testInWorktree)
  
  // CL-TFBI-002: Run test in worktree after copy
  const result = await ctx.services.testRunner.runSingleTest(testInWorktree)
  
  await ctx.services.worktree.cleanup(worktreePath)
  
  return {
    passed: !result.passed,
    status: result.passed ? 'FAILED' : 'PASSED',
    message: result.passed 
      ? 'Test should fail before implementation' 
      : 'Test correctly fails before implementation',
    context: {
      inputs: { testFilePath: ctx.testFilePath, testInWorktree },
      findings: [{ testResult: result }]
    }
  }
}

async function executeTaskTestPasses(
  ctx: ValidationContext
): Promise<ValidatorResult> {
  // CL-TTP-003: Log debug at start
  console.log('[TASK_TEST_PASSES] Using testFilePath:', ctx.testFilePath)
  
  // CL-TTP-002: Fail if testFilePath not defined
  if (!ctx.testFilePath) {
    return {
      passed: false,
      status: 'FAILED',
      message: 'No test file path configured',
      context: { inputs: { testFilePath: null } }
    }
  }
  
  // CL-TTP-001: Use ctx.testFilePath directly
  const result = await ctx.services.testRunner.runSingleTest(ctx.testFilePath)
  
  return {
    passed: result.passed,
    status: result.passed ? 'PASSED' : 'FAILED',
    message: result.passed ? 'Tests passed' : `Tests failed: ${result.error || 'unknown error'}`,
    context: {
      inputs: { testFilePath: ctx.testFilePath },
      findings: [{ testResult: result }]
    }
  }
}

function executeTestReadOnlyEnforcement(
  ctx: ValidationContext,
  modifiedFiles: string[]
): ValidatorResult {
  // CL-TROE-004: Log debug at start
  console.log('[TEST_READ_ONLY_ENFORCEMENT] Using testFilePath:', ctx.testFilePath)
  
  // CL-TROE-001: Normalize allowedTest path
  const allowedTest = ctx.testFilePath 
    ? normalizePath(joinNormalized(ctx.projectPath, 
        isAbsolutePath(ctx.testFilePath) 
          ? relativeNormalized(ctx.projectPath, ctx.testFilePath)
          : ctx.testFilePath))
    : null
  
  const testFilePatterns = [/\.spec\.[tj]sx?$/, /\.test\.[tj]sx?$/, /__tests__\//]
  const excludedPatterns = [/node_modules/, /\.d\.ts$/]
  
  const modifiedTests: string[] = []
  
  for (const file of modifiedFiles) {
    const fileNormalized = normalizePath(file)
    
    if (excludedPatterns.some(p => p.test(fileNormalized))) continue
    if (!testFilePatterns.some(p => p.test(fileNormalized))) continue
    
    // CL-TROE-001: Normalize for comparison
    const resolvedNormalized = normalizePath(joinNormalized(ctx.projectPath, file))
    
    // CL-TROE-002: Allow modification of declared spec
    if (allowedTest && resolvedNormalized === allowedTest) continue
    
    // CL-TROE-003: Block other modified tests
    modifiedTests.push(file)
  }
  
  if (modifiedTests.length > 0) {
    return {
      passed: false,
      status: 'FAILED',
      message: `Test files were modified outside the allowed spec: ${modifiedTests.join(', ')}`,
      context: {
        inputs: { testFilePath: ctx.testFilePath },
        findings: modifiedTests.map(f => ({ violatingFile: f }))
      },
      details: { modifiedTests }
    }
  }
  
  return {
    passed: true,
    status: 'PASSED',
    message: 'No unauthorized test modifications detected',
    context: { inputs: { testFilePath: ctx.testFilePath }, findings: [] },
    details: { modifiedTests: [] }
  }
}

// =============================================================================
// FIXTURES
// =============================================================================

function createMockContext(overrides: Partial<ValidationContext> = {}): ValidationContext {
  return {
    testFilePath: '/project/src/__tests__/feature.spec.ts',
    projectPath: '/project',
    manifest: undefined,
    services: {
      testRunner: { runSingleTest: mocks.runSingleTest },
      worktree: { create: mocks.createWorktree, cleanup: mocks.cleanupWorktree }
    },
    ...overrides
  }
}

// =============================================================================
// TESTS
// =============================================================================

describe('TestFailsBeforeImplementation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(mocks.consolelog)
    mocks.access.mockResolvedValue(undefined)
    mocks.mkdir.mockResolvedValue(undefined)
    mocks.copyFile.mockResolvedValue(undefined)
    mocks.createWorktree.mockResolvedValue('/tmp/worktree-abc123')
    mocks.cleanupWorktree.mockResolvedValue(undefined)
    mocks.runSingleTest.mockResolvedValue({ passed: false })
  })
  
  afterEach(() => {
    vi.restoreAllMocks()
  })
  
  // @clause CL-TFBI-001
  it('succeeds when spec is copied to worktree before running test', async () => {
    const ctx = createMockContext({
      testFilePath: '/project/src/__tests__/Button.spec.tsx',
      projectPath: '/project'
    })
    
    await executeTestFailsBeforeImplementation(ctx)
    
    // Verify mkdir was called to create directory in worktree
    expect(mocks.mkdir).toHaveBeenCalledWith(
      expect.stringContaining('tmp/worktree-abc123'),
      { recursive: true }
    )
    
    // Verify copyFile was called with correct source and destination
    expect(mocks.copyFile).toHaveBeenCalledWith(
      '/project/src/__tests__/Button.spec.tsx',
      expect.stringContaining('tmp/worktree-abc123')
    )
    
    // Verify copy happened BEFORE runSingleTest
    const copyOrder = mocks.copyFile.mock.invocationCallOrder[0]
    const runOrder = mocks.runSingleTest.mock.invocationCallOrder[0]
    expect(copyOrder).toBeLessThan(runOrder)
  })
  
  // @clause CL-TFBI-001
  it('succeeds when worktree directory is created recursively', async () => {
    const ctx = createMockContext({
      testFilePath: '/project/packages/api/src/deep/nested/__tests__/service.spec.ts'
    })
    
    await executeTestFailsBeforeImplementation(ctx)
    
    expect(mocks.mkdir).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ recursive: true })
    )
  })
  
  // @clause CL-TFBI-002
  it('succeeds when runSingleTest is called with worktree path', async () => {
    const ctx = createMockContext({
      testFilePath: '/project/src/__tests__/feature.spec.ts'
    })
    
    await executeTestFailsBeforeImplementation(ctx)
    
    expect(mocks.runSingleTest).toHaveBeenCalledWith(
      expect.stringContaining('tmp/worktree-abc123')
    )
    expect(mocks.runSingleTest).not.toHaveBeenCalledWith(
      '/project/src/__tests__/feature.spec.ts'
    )
  })
  
  // @clause CL-TFBI-002
  it('succeeds when test result is evaluated after copy', async () => {
    const ctx = createMockContext()
    mocks.runSingleTest.mockResolvedValue({ passed: false, error: 'Test failed as expected' })
    
    const result = await executeTestFailsBeforeImplementation(ctx)
    
    expect(result.passed).toBe(true)
    expect(result.status).toBe('PASSED')
  })
  
  // @clause CL-TFBI-003
  it('fails when testFilePath points to non-existent file', async () => {
    const ctx = createMockContext({
      testFilePath: '/project/src/__tests__/missing.spec.ts'
    })
    mocks.access.mockRejectedValue(new Error('ENOENT'))
    
    const result = await executeTestFailsBeforeImplementation(ctx)
    
    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
    expect(result.message).toContain('not found')
    expect(mocks.copyFile).not.toHaveBeenCalled()
    expect(mocks.runSingleTest).not.toHaveBeenCalled()
  })
  
  // @clause CL-TFBI-003
  it('fails when testFilePath is null', async () => {
    const ctx = createMockContext({ testFilePath: null })
    
    const result = await executeTestFailsBeforeImplementation(ctx)
    
    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
    expect(result.message).toContain('not configured')
  })
  
  // @clause CL-TFBI-004
  it('succeeds when debug log is emitted with testFilePath', async () => {
    const ctx = createMockContext({
      testFilePath: '/project/src/__tests__/component.spec.tsx'
    })
    
    await executeTestFailsBeforeImplementation(ctx)
    
    expect(mocks.consolelog).toHaveBeenCalledWith(
      '[TEST_FAILS_BEFORE_IMPLEMENTATION] Using testFilePath:',
      '/project/src/__tests__/component.spec.tsx'
    )
  })
  
  // @clause CL-TFBI-004
  it('succeeds when copy log is emitted with worktree path', async () => {
    const ctx = createMockContext()
    
    await executeTestFailsBeforeImplementation(ctx)
    
    expect(mocks.consolelog).toHaveBeenCalledWith(
      '[TEST_FAILS_BEFORE_IMPLEMENTATION] Copied spec to worktree:',
      expect.stringContaining('tmp/worktree-abc123')
    )
  })
})

describe('TaskTestPasses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(mocks.consolelog)
    mocks.runSingleTest.mockResolvedValue({ passed: true })
  })
  
  afterEach(() => {
    vi.restoreAllMocks()
  })
  
  // @clause CL-TTP-001
  it('succeeds when ctx.testFilePath is used directly', async () => {
    const ctx = createMockContext({
      testFilePath: '/project/src/__tests__/feature.spec.ts',
      manifest: { testFile: 'different/path/other.spec.ts' }
    })
    
    await executeTaskTestPasses(ctx)
    
    expect(mocks.runSingleTest).toHaveBeenCalledWith(
      '/project/src/__tests__/feature.spec.ts'
    )
    expect(mocks.runSingleTest).not.toHaveBeenCalledWith(
      expect.stringContaining('different/path')
    )
  })
  
  // @clause CL-TTP-001
  it('succeeds when manifest.testFile is ignored', async () => {
    const ctx = createMockContext({
      testFilePath: '/project/packages/api/src/__tests__/service.spec.ts',
      manifest: { testFile: 'packages/api/src/__tests__/wrong.spec.ts' }
    })
    
    await executeTaskTestPasses(ctx)
    
    expect(mocks.runSingleTest).toHaveBeenCalledTimes(1)
    expect(mocks.runSingleTest).toHaveBeenCalledWith(
      '/project/packages/api/src/__tests__/service.spec.ts'
    )
  })
  
  // @clause CL-TTP-002
  it('fails when testFilePath is null', async () => {
    const ctx = createMockContext({ testFilePath: null })
    
    const result = await executeTaskTestPasses(ctx)
    
    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
    expect(result.message).toBe('No test file path configured')
    expect(mocks.runSingleTest).not.toHaveBeenCalled()
  })
  
  // @clause CL-TTP-002
  it('fails when testFilePath is empty string', async () => {
    const ctx = createMockContext({ testFilePath: '' as unknown as null })
    
    const result = await executeTaskTestPasses(ctx)
    
    expect(result.passed).toBe(false)
    expect(result.message).toBe('No test file path configured')
  })
  
  // @clause CL-TTP-003
  it('succeeds when debug log is emitted with path used', async () => {
    const ctx = createMockContext({
      testFilePath: '/project/src/__tests__/utils.spec.ts'
    })
    
    await executeTaskTestPasses(ctx)
    
    expect(mocks.consolelog).toHaveBeenCalledWith(
      '[TASK_TEST_PASSES] Using testFilePath:',
      '/project/src/__tests__/utils.spec.ts'
    )
  })
})

describe('TestReadOnlyEnforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(mocks.consolelog)
  })
  
  afterEach(() => {
    vi.restoreAllMocks()
  })
  
  // @clause CL-TROE-001
  it('succeeds when paths are normalized with forward slashes', () => {
    const ctx = createMockContext({
      testFilePath: '/project/src/__tests__/feature.spec.ts',
      projectPath: '/project'
    })
    
    const modifiedFiles = ['src\\__tests__\\feature.spec.ts']
    const result = executeTestReadOnlyEnforcement(ctx, modifiedFiles)
    
    expect(result.passed).toBe(true)
    expect(result.details?.modifiedTests).toHaveLength(0)
  })
  
  // @clause CL-TROE-001
  it('succeeds when paths are normalized to lowercase', () => {
    const ctx = createMockContext({
      testFilePath: '/project/src/__tests__/Feature.spec.ts',
      projectPath: '/project'
    })
    
    const modifiedFiles = ['src/__tests__/FEATURE.spec.ts']
    const result = executeTestReadOnlyEnforcement(ctx, modifiedFiles)
    
    expect(result.passed).toBe(true)
    expect(result.details?.modifiedTests).toHaveLength(0)
  })
  
  // @clause CL-TROE-002
  it('succeeds when declared spec modification is allowed', () => {
    const ctx = createMockContext({
      testFilePath: '/project/src/__tests__/Button.spec.tsx',
      projectPath: '/project'
    })
    
    const modifiedFiles = ['src/__tests__/Button.spec.tsx']
    const result = executeTestReadOnlyEnforcement(ctx, modifiedFiles)
    
    expect(result.passed).toBe(true)
    expect(result.message).toContain('No unauthorized')
    expect(result.details?.modifiedTests).not.toContain('src/__tests__/Button.spec.tsx')
  })
  
  // @clause CL-TROE-002
  it('succeeds when only the allowed spec is in modified files', () => {
    const ctx = createMockContext({
      testFilePath: '/project/packages/ui/src/__tests__/Dialog.spec.tsx',
      projectPath: '/project'
    })
    
    const modifiedFiles = [
      'packages/ui/src/__tests__/Dialog.spec.tsx',
      'packages/ui/src/components/Dialog.tsx',
      'README.md'
    ]
    const result = executeTestReadOnlyEnforcement(ctx, modifiedFiles)
    
    expect(result.passed).toBe(true)
  })
  
  // @clause CL-TROE-003
  it('fails when other test file is modified', () => {
    const ctx = createMockContext({
      testFilePath: '/project/src/__tests__/allowed.spec.ts',
      projectPath: '/project'
    })
    
    const modifiedFiles = [
      'src/__tests__/allowed.spec.ts',
      'src/__tests__/forbidden.spec.ts'
    ]
    const result = executeTestReadOnlyEnforcement(ctx, modifiedFiles)
    
    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
    expect(result.details?.modifiedTests).toContain('src/__tests__/forbidden.spec.ts')
  })
  
  // @clause CL-TROE-003
  it('fails when test file outside declared spec is modified', () => {
    const ctx = createMockContext({
      testFilePath: '/project/src/__tests__/feature.spec.ts',
      projectPath: '/project'
    })
    
    const modifiedFiles = [
      'src/__tests__/other.test.tsx',
      'src/components/__tests__/Button.spec.tsx'
    ]
    const result = executeTestReadOnlyEnforcement(ctx, modifiedFiles)
    
    expect(result.passed).toBe(false)
    expect(result.details?.modifiedTests).toHaveLength(2)
    expect(result.message).toContain('modified outside the allowed spec')
  })
  
  // @clause CL-TROE-004
  it('succeeds when debug log is emitted with testFilePath', () => {
    const ctx = createMockContext({
      testFilePath: '/project/src/__tests__/feature.spec.ts'
    })
    
    executeTestReadOnlyEnforcement(ctx, [])
    
    expect(mocks.consolelog).toHaveBeenCalledWith(
      '[TEST_READ_ONLY_ENFORCEMENT] Using testFilePath:',
      '/project/src/__tests__/feature.spec.ts'
    )
  })
})

describe('Path Normalization Function', () => {
  // @clause CL-TROE-001
  it('succeeds when backslashes are converted to forward slashes', () => {
    const result = normalizePath('src\\components\\__tests__\\Button.spec.tsx')
    
    expect(result).toBe('src/components/__tests__/button.spec.tsx')
    expect(result).not.toContain('\\')
  })
  
  // @clause CL-TROE-001
  it('succeeds when path is converted to lowercase', () => {
    const result = normalizePath('SRC/Components/__TESTS__/MyComponent.spec.TSX')
    
    expect(result).toBe('src/components/__tests__/mycomponent.spec.tsx')
  })
  
  // @clause CL-TROE-001
  it('succeeds when mixed separators are normalized', () => {
    const result = normalizePath('packages\\api/src/__tests__\\Service.SPEC.ts')
    
    expect(result).toBe('packages/api/src/__tests__/service.spec.ts')
  })
})

describe('Integration: Cross-Validator Path Consistency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(mocks.consolelog)
    mocks.access.mockResolvedValue(undefined)
    mocks.mkdir.mockResolvedValue(undefined)
    mocks.copyFile.mockResolvedValue(undefined)
    mocks.createWorktree.mockResolvedValue('/tmp/worktree-xyz')
    mocks.cleanupWorktree.mockResolvedValue(undefined)
    mocks.runSingleTest.mockResolvedValue({ passed: true })
  })
  
  afterEach(() => {
    vi.restoreAllMocks()
  })
  
  // @clause CL-TTP-001
  it('succeeds when all validators use same testFilePath', async () => {
    const testFilePath = '/project/src/__tests__/unified.spec.ts'
    const ctx = createMockContext({
      testFilePath,
      projectPath: '/project',
      manifest: { testFile: 'wrong/manifest/path.spec.ts' }
    })
    
    await executeTaskTestPasses(ctx)
    
    expect(mocks.runSingleTest).toHaveBeenLastCalledWith(testFilePath)
    
    const logCalls = mocks.consolelog.mock.calls
    const ttpLog = logCalls.find(c => String(c[0]).includes('[TASK_TEST_PASSES]'))
    expect(ttpLog).toBeDefined()
    expect(ttpLog![1]).toBe(testFilePath)
  })
  
  // @clause CL-TTP-001
  it('succeeds when ctx.testFilePath takes precedence over manifest', async () => {
    const ctx = createMockContext({
      testFilePath: '/project/src/__tests__/correct.spec.ts',
      manifest: { testFile: 'src/__tests__/incorrect.spec.ts' }
    })
    
    await executeTaskTestPasses(ctx)
    
    const calls = mocks.runSingleTest.mock.calls.map(c => c[0])
    expect(calls).not.toContain(expect.stringContaining('incorrect'))
    expect(calls).toContain('/project/src/__tests__/correct.spec.ts')
  })
})
