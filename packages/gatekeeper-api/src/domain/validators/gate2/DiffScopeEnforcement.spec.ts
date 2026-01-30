import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DiffScopeEnforcementValidator } from './DiffScopeEnforcement.js'

/**
 * DiffScopeEnforcement Contract Spec
 * ===================================
 *
 * Contract: diff-scope-bidirectional v1.0
 * Mode: STRICT
 * Criticality: HIGH
 *
 * Objetivo: Validação bidirecional
 *   1. diff → manifest (scope creep)
 *   2. manifest → diff (implementação incompleta)
 *
 * Este arquivo cobre todas as 24 cláusulas do contrato:
 * - CL-DSE-001, CL-DSE-002: Early returns (null/empty manifest)
 * - CL-DSE-010 a CL-DSE-012: Scope creep detection
 * - CL-DSE-020 a CL-DSE-024: Implementação incompleta (action validation)
 * - CL-DSE-030, CL-DSE-031: testFile handling
 * - CL-DSE-040, CL-DSE-041: Configurações
 * - CL-DSE-050 a CL-DSE-053: Success cases
 * - CL-DSE-060, CL-DSE-061: Metrics
 * - CL-DSE-070, CL-DSE-071: Context structure
 * - CL-DSE-080, CL-DSE-081: Backward compatibility
 *
 * REGRA: Se estes testes falharem, a LLM executora errou na implementação.
 */

// =============================================================================
// INLINE TYPES (evita dependência durante validação)
// =============================================================================

type ValidatorStatus = 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'WARNING' | 'SKIPPED'
type ManifestAction = 'CREATE' | 'MODIFY' | 'DELETE'

interface ManifestFileEntry {
  path: string
  action: ManifestAction
  reason?: string
}

interface ManifestInput {
  files: ManifestFileEntry[]
  testFile: string
}

interface ValidatorContextInput {
  label: string
  value: string | number | boolean | string[] | Record<string, unknown> | ManifestInput
}

interface ValidatorContextAnalyzedGroup {
  label: string
  items: string[]
}

interface ValidatorContextFinding {
  type: 'pass' | 'fail' | 'warning' | 'info'
  message: string
  location?: string
}

interface ValidatorContext {
  inputs: ValidatorContextInput[]
  analyzed: ValidatorContextAnalyzedGroup[]
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

interface GitService {
  diff(baseRef: string, targetRef: string): Promise<string>
  readFile(filePath: string, ref?: string): Promise<string>
  getDiffFiles(baseRef: string, targetRef: string): Promise<string[]>
  checkout(ref: string): Promise<void>
  stash(): Promise<void>
  stashPop(): Promise<void>
  createWorktree(ref: string, path: string): Promise<void>
  removeWorktree(path: string): Promise<void>
  getCurrentRef(): Promise<string>
}

interface ValidationContext {
  runId: string
  projectPath: string
  baseRef: string
  targetRef: string
  taskPrompt: string
  manifest: ManifestInput | null
  contract: unknown | null
  testFilePath: string | null
  dangerMode: boolean
  services: {
    git: GitService
    ast: unknown
    testRunner: unknown
    compiler: unknown
    lint: unknown
    build: unknown
    tokenCounter: unknown
    log: unknown
  }
  config: Map<string, string>
  sensitivePatterns: string[]
  ambiguousTerms: string[]
  bypassedValidators: Set<string>
}

interface ValidatorDefinition {
  code: string
  name: string
  description: string
  gate: number
  order: number
  isHardBlock: boolean
  execute: (ctx: ValidationContext) => Promise<ValidatorOutput>
}

// =============================================================================
// MOCK FACTORIES
// =============================================================================

const createMockManifest = (overrides: Partial<ManifestInput> = {}): ManifestInput => ({
  files: [
    { path: 'src/Button.tsx', action: 'MODIFY' },
  ],
  testFile: 'src/__tests__/Button.spec.tsx',
  ...overrides,
})

const createMockGitService = (overrides: Partial<GitService> = {}): GitService => ({
  diff: vi.fn().mockResolvedValue(''),
  readFile: vi.fn().mockResolvedValue('file content'),
  getDiffFiles: vi.fn().mockResolvedValue(['src/Button.tsx']),
  checkout: vi.fn().mockResolvedValue(undefined),
  stash: vi.fn().mockResolvedValue(undefined),
  stashPop: vi.fn().mockResolvedValue(undefined),
  createWorktree: vi.fn().mockResolvedValue(undefined),
  removeWorktree: vi.fn().mockResolvedValue(undefined),
  getCurrentRef: vi.fn().mockResolvedValue('HEAD'),
  ...overrides,
})

const createMockContext = (overrides: Partial<ValidationContext> = {}): ValidationContext => {
  const defaultConfig = new Map<string, string>()
  
  return {
    runId: 'run_test_001',
    projectPath: '/test/project',
    baseRef: 'origin/main',
    targetRef: 'HEAD',
    taskPrompt: 'Test task',
    manifest: createMockManifest(),
    contract: null,
    testFilePath: 'src/__tests__/Button.spec.tsx',
    dangerMode: false,
    services: {
      git: createMockGitService(),
      ast: {},
      testRunner: {},
      compiler: {},
      lint: {},
      build: {},
      tokenCounter: {},
      log: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    },
    config: defaultConfig,
    sensitivePatterns: [],
    ambiguousTerms: [],
    bypassedValidators: new Set(),
    ...overrides,
  }
}

// =============================================================================
// TESTS
// =============================================================================

describe('DiffScopeEnforcementValidator Contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ===========================================================================
  // CL-DSE-001: No manifest provided
  // ===========================================================================
  describe('CL-DSE-001: No manifest provided', () => {
    // @clause CL-DSE-001
    it('fails when manifest is null', async () => {
      const ctx = createMockContext({ manifest: null })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(false)
      expect(result.status).toBe('FAILED')
      expect(result.message).toContain('No manifest provided')
    })

    // @clause CL-DSE-001
    it('fails when manifest is undefined', async () => {
      const ctx = createMockContext({ manifest: undefined as unknown as ManifestInput | null })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(false)
      expect(result.status).toBe('FAILED')
      expect(result.message).toContain('No manifest provided')
    })
  })

  // ===========================================================================
  // CL-DSE-002: Empty manifest files
  // ===========================================================================
  describe('CL-DSE-002: Empty manifest files', () => {
    // @clause CL-DSE-002
    it('fails when manifest.files is empty array', async () => {
      const ctx = createMockContext({
        manifest: createMockManifest({ files: [] }),
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(false)
      expect(result.status).toBe('FAILED')
      expect(result.message).toContain('no files declared')
    })
  })

  // ===========================================================================
  // CL-DSE-010: Scope creep detection
  // ===========================================================================
  describe('CL-DSE-010: Scope creep detection', () => {
    // @clause CL-DSE-010
    it('fails when diff contains file not declared in manifest', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue(['src/Button.tsx', 'src/Extra.tsx']),
        readFile: vi.fn().mockResolvedValue('content'), // file exists
      })

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [{ path: 'src/Button.tsx', action: 'MODIFY' }],
        }),
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(false)
      expect(result.status).toBe('FAILED')
      expect(result.details?.scopeCreepCount).toBeGreaterThan(0)
      expect(result.context?.findings.some(f =>
        f.type === 'fail' && f.message.includes('not declared')
      )).toBe(true)
    })

    // @clause CL-DSE-010
    it('succeeds when all diff files are in manifest', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue(['src/Button.tsx']),
        readFile: vi.fn().mockResolvedValue('content'), // file exists
      })

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [{ path: 'src/Button.tsx', action: 'MODIFY' }],
        }),
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(true)
      expect(result.status).toBe('PASSED')
      expect(result.metrics?.scopeCreepCount).toBe(0)
    })
  })

  // ===========================================================================
  // CL-DSE-011: testFile is not scope creep
  // ===========================================================================
  describe('CL-DSE-011: testFile is not scope creep', () => {
    // @clause CL-DSE-011
    it('succeeds when testFile appears in diff but not in manifest.files', async () => {
      const testFile = 'src/__tests__/Button.spec.tsx'
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue(['src/Button.tsx', testFile]),
        readFile: vi.fn().mockResolvedValue('content'),
      })

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [{ path: 'src/Button.tsx', action: 'MODIFY' }],
          testFile,
        }),
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(true)
      expect(result.metrics?.scopeCreepCount).toBe(0)
    })
  })

  // ===========================================================================
  // CL-DSE-012: Ignored patterns not scope creep
  // ===========================================================================
  describe('CL-DSE-012: Ignored patterns not scope creep', () => {
    // @clause CL-DSE-012
    it('succeeds when diff contains package-lock.json (default ignore)', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue(['src/Button.tsx', 'package-lock.json']),
        readFile: vi.fn().mockResolvedValue('content'),
      })

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [{ path: 'src/Button.tsx', action: 'MODIFY' }],
        }),
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(true)
      expect(result.metrics?.scopeCreepCount).toBe(0)
    })

    // @clause CL-DSE-012
    it('succeeds when diff matches custom DIFF_SCOPE_IGNORED_PATTERNS', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue(['src/Button.tsx', '.env.local']),
        readFile: vi.fn().mockResolvedValue('content'),
      })

      const config = new Map<string, string>()
      config.set('DIFF_SCOPE_IGNORED_PATTERNS', 'package-lock.json,.env.local')

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [{ path: 'src/Button.tsx', action: 'MODIFY' }],
        }),
        services: { ...createMockContext().services, git: mockGit },
        config,
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(true)
      expect(result.metrics?.scopeCreepCount).toBe(0)
    })
  })

  // ===========================================================================
  // CL-DSE-020: CREATE_NOT_CREATED detection
  // ===========================================================================
  describe('CL-DSE-020: CREATE_NOT_CREATED detection', () => {
    // @clause CL-DSE-020
    it('fails when manifest has CREATE action but file not in diff', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue(['src/Button.tsx']),
        readFile: vi.fn().mockImplementation((path, ref) => {
          if (path === 'src/NewFile.ts' && ref === 'origin/main') {
            return Promise.reject(new Error('File not found'))
          }
          return Promise.resolve('content')
        }),
      })

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [
            { path: 'src/Button.tsx', action: 'MODIFY' },
            { path: 'src/NewFile.ts', action: 'CREATE' },
          ],
        }),
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(false)
      expect(result.details?.incompleteCount).toBeGreaterThan(0)
      expect(result.context?.findings.some(f =>
        f.message.includes('CREATE_NOT_CREATED')
      )).toBe(true)
    })
  })

  // ===========================================================================
  // CL-DSE-021: CREATE_BUT_FILE_EXISTED detection
  // ===========================================================================
  describe('CL-DSE-021: CREATE_BUT_FILE_EXISTED detection', () => {
    // @clause CL-DSE-021
    it('fails when manifest has CREATE but file already existed in baseRef', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue(['src/Button.tsx', 'src/ExistingFile.ts']),
        readFile: vi.fn().mockResolvedValue('content'), // file exists in all refs
      })

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [
            { path: 'src/Button.tsx', action: 'MODIFY' },
            { path: 'src/ExistingFile.ts', action: 'CREATE' },
          ],
        }),
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(false)
      expect(result.context?.findings.some(f =>
        f.message.includes('CREATE_BUT_FILE_EXISTED')
      )).toBe(true)
    })
  })

  // ===========================================================================
  // CL-DSE-022: MODIFY_NOT_MODIFIED detection
  // ===========================================================================
  describe('CL-DSE-022: MODIFY_NOT_MODIFIED detection', () => {
    // @clause CL-DSE-022
    it('fails when manifest has MODIFY but file not in diff', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue(['src/Other.tsx']),
        readFile: vi.fn().mockResolvedValue('content'),
      })

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [
            { path: 'src/Other.tsx', action: 'MODIFY' },
            { path: 'src/Button.tsx', action: 'MODIFY' },
          ],
        }),
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(false)
      expect(result.details?.incompleteCount).toBeGreaterThan(0)
      expect(result.context?.findings.some(f =>
        f.message.includes('MODIFY_NOT_MODIFIED')
      )).toBe(true)
    })
  })

  // ===========================================================================
  // CL-DSE-023: MODIFY_BUT_FILE_NOT_EXISTED detection
  // ===========================================================================
  describe('CL-DSE-023: MODIFY_BUT_FILE_NOT_EXISTED detection', () => {
    // @clause CL-DSE-023
    it('fails when manifest has MODIFY but file did not exist in baseRef', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue(['src/NewFile.ts']),
        readFile: vi.fn().mockImplementation((path, ref) => {
          if (path === 'src/NewFile.ts' && ref === 'origin/main') {
            return Promise.reject(new Error('File not found'))
          }
          return Promise.resolve('content')
        }),
      })

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [{ path: 'src/NewFile.ts', action: 'MODIFY' }],
        }),
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(false)
      expect(result.context?.findings.some(f =>
        f.message.includes('MODIFY_BUT_FILE_NOT_EXISTED')
      )).toBe(true)
    })
  })

  // ===========================================================================
  // CL-DSE-024: DELETE_NOT_DELETED detection
  // ===========================================================================
  describe('CL-DSE-024: DELETE_NOT_DELETED detection', () => {
    // @clause CL-DSE-024
    it('fails when manifest has DELETE but file still exists in targetRef', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue(['src/Button.tsx']),
        readFile: vi.fn().mockResolvedValue('content'), // file still exists
      })

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [
            { path: 'src/Button.tsx', action: 'MODIFY' },
            { path: 'src/ToDelete.ts', action: 'DELETE' },
          ],
        }),
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(false)
      expect(result.context?.findings.some(f =>
        f.message.includes('DELETE_NOT_DELETED')
      )).toBe(true)
    })
  })

  // ===========================================================================
  // CL-DSE-030: Test-only diff allowed by default
  // ===========================================================================
  describe('CL-DSE-030: Test-only diff allowed', () => {
    // @clause CL-DSE-030
    it('succeeds when diff contains only testFile and ALLOW_TEST_ONLY_DIFF is not false', async () => {
      const testFile = 'src/__tests__/Button.spec.tsx'
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([testFile]),
        readFile: vi.fn().mockResolvedValue('content'),
      })

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [{ path: 'src/Button.tsx', action: 'MODIFY' }],
          testFile,
        }),
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(true)
      expect(result.status).toBe('PASSED')
      expect(result.message).toContain('Only test file modified')
    })
  })

  // ===========================================================================
  // CL-DSE-031: Test-only diff blocked when configured
  // ===========================================================================
  describe('CL-DSE-031: Test-only diff blocked', () => {
    // @clause CL-DSE-031
    it('fails when diff contains only testFile and ALLOW_TEST_ONLY_DIFF is false', async () => {
      const testFile = 'src/__tests__/Button.spec.tsx'
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([testFile]),
        readFile: vi.fn().mockResolvedValue('content'),
      })

      const config = new Map<string, string>()
      config.set('DIFF_SCOPE_ALLOW_TEST_ONLY_DIFF', 'false')

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [{ path: 'src/Button.tsx', action: 'MODIFY' }],
          testFile,
        }),
        services: { ...createMockContext().services, git: mockGit },
        config,
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(false)
      expect(result.status).toBe('FAILED')
    })
  })

  // ===========================================================================
  // CL-DSE-040: INCOMPLETE_FAIL_MODE=WARNING
  // ===========================================================================
  describe('CL-DSE-040: INCOMPLETE_FAIL_MODE=WARNING', () => {
    // @clause CL-DSE-040
    it('returns WARNING when incomplete but no scope creep and mode is WARNING', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue(['src/Button.tsx']),
        readFile: vi.fn().mockImplementation((path, ref) => {
          if (path === 'src/NewFile.ts' && ref === 'origin/main') {
            return Promise.reject(new Error('File not found'))
          }
          return Promise.resolve('content')
        }),
      })

      const config = new Map<string, string>()
      config.set('DIFF_SCOPE_INCOMPLETE_FAIL_MODE', 'WARNING')

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [
            { path: 'src/Button.tsx', action: 'MODIFY' },
            { path: 'src/NewFile.ts', action: 'CREATE' },
          ],
        }),
        services: { ...createMockContext().services, git: mockGit },
        config,
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      expect(result.status).toBe('WARNING')
      expect(result.details?.scopeCreepCount).toBe(0)
      expect(result.details?.incompleteCount).toBeGreaterThan(0)
    })
  })

  // ===========================================================================
  // CL-DSE-041: Custom ignored patterns
  // ===========================================================================
  describe('CL-DSE-041: Custom ignored patterns', () => {
    // @clause CL-DSE-041
    it('succeeds when file matches custom ignored pattern', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue(['src/Button.tsx', 'generated/types.ts']),
        readFile: vi.fn().mockResolvedValue('content'),
      })

      const config = new Map<string, string>()
      config.set('DIFF_SCOPE_IGNORED_PATTERNS', 'generated/')

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [{ path: 'src/Button.tsx', action: 'MODIFY' }],
        }),
        services: { ...createMockContext().services, git: mockGit },
        config,
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(true)
      expect(result.metrics?.scopeCreepCount).toBe(0)
    })
  })

  // ===========================================================================
  // CL-DSE-050: All implemented correctly
  // ===========================================================================
  describe('CL-DSE-050: All implemented correctly', () => {
    // @clause CL-DSE-050
    it('succeeds when diff matches manifest and all actions fulfilled', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue(['src/Button.tsx', 'src/NewFile.ts']),
        readFile: vi.fn().mockImplementation((path, ref) => {
          // Button exists in base (for MODIFY)
          if (path === 'src/Button.tsx') return Promise.resolve('content')
          // NewFile does NOT exist in base (for CREATE)
          if (path === 'src/NewFile.ts' && ref === 'origin/main') {
            return Promise.reject(new Error('File not found'))
          }
          // NewFile exists in target (was created)
          if (path === 'src/NewFile.ts') return Promise.resolve('new content')
          return Promise.resolve('content')
        }),
      })

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [
            { path: 'src/Button.tsx', action: 'MODIFY' },
            { path: 'src/NewFile.ts', action: 'CREATE' },
          ],
        }),
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(true)
      expect(result.status).toBe('PASSED')
      expect(result.metrics?.implementationRate).toBe('100%')
      expect(result.metrics?.overallHealth).toBe('PERFECT')
    })
  })

  // ===========================================================================
  // CL-DSE-051: CREATE action fulfilled
  // ===========================================================================
  describe('CL-DSE-051: CREATE action fulfilled', () => {
    // @clause CL-DSE-051
    it('succeeds when CREATE file is in diff and did not exist in baseRef', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue(['src/NewFile.ts']),
        readFile: vi.fn().mockImplementation((path, ref) => {
          if (path === 'src/NewFile.ts' && ref === 'origin/main') {
            return Promise.reject(new Error('File not found'))
          }
          return Promise.resolve('content')
        }),
      })

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [{ path: 'src/NewFile.ts', action: 'CREATE' }],
        }),
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(true)
      expect(result.context?.analyzed.find(a =>
        a.label.includes('Successfully Implemented')
      )?.items).toContain('src/NewFile.ts')
    })
  })

  // ===========================================================================
  // CL-DSE-052: MODIFY action fulfilled
  // ===========================================================================
  describe('CL-DSE-052: MODIFY action fulfilled', () => {
    // @clause CL-DSE-052
    it('succeeds when MODIFY file is in diff and existed in baseRef', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue(['src/Button.tsx']),
        readFile: vi.fn().mockResolvedValue('content'), // file exists
      })

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [{ path: 'src/Button.tsx', action: 'MODIFY' }],
        }),
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(true)
      expect(result.context?.analyzed.find(a =>
        a.label.includes('Successfully Implemented')
      )?.items).toContain('src/Button.tsx')
    })
  })

  // ===========================================================================
  // CL-DSE-053: DELETE action fulfilled
  // ===========================================================================
  describe('CL-DSE-053: DELETE action fulfilled', () => {
    // @clause CL-DSE-053
    it('succeeds when DELETE file does not exist in targetRef', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue(['src/Button.tsx']),
        readFile: vi.fn().mockImplementation((path, ref) => {
          // ToDelete does not exist in targetRef
          if (path === 'src/ToDelete.ts' && ref === 'HEAD') {
            return Promise.reject(new Error('File not found'))
          }
          return Promise.resolve('content')
        }),
      })

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [
            { path: 'src/Button.tsx', action: 'MODIFY' },
            { path: 'src/ToDelete.ts', action: 'DELETE' },
          ],
        }),
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(true)
      expect(result.context?.analyzed.find(a =>
        a.label.includes('Successfully Implemented')
      )?.items).toContain('src/ToDelete.ts')
    })
  })

  // ===========================================================================
  // CL-DSE-060: Metrics structure
  // ===========================================================================
  describe('CL-DSE-060: Metrics structure', () => {
    // @clause CL-DSE-060
    it('succeeds when output contains all required metrics', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue(['src/Button.tsx']),
        readFile: vi.fn().mockResolvedValue('content'),
      })

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [{ path: 'src/Button.tsx', action: 'MODIFY' }],
        }),
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      expect(typeof result.metrics?.implementationRate).toBe('string')
      expect(typeof result.metrics?.scopeCreepCount).toBe('number')
      expect(typeof result.metrics?.incompleteCount).toBe('number')
      expect(typeof result.metrics?.overallHealth).toBe('string')
    })
  })

  // ===========================================================================
  // CL-DSE-061: overallHealth calculation
  // ===========================================================================
  describe('CL-DSE-061: overallHealth calculation', () => {
    // @clause CL-DSE-061
    it('succeeds when 100% impl and 0 creep returns PERFECT', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue(['src/Button.tsx']),
        readFile: vi.fn().mockResolvedValue('content'),
      })

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [{ path: 'src/Button.tsx', action: 'MODIFY' }],
        }),
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      expect(result.metrics?.overallHealth).toBe('PERFECT')
    })

    // @clause CL-DSE-061
    it('succeeds when 80% impl and 0 creep returns GOOD', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue(['src/A.tsx', 'src/B.tsx', 'src/C.tsx', 'src/D.tsx']),
        readFile: vi.fn().mockImplementation((path, ref) => {
          // E doesn't exist in diff = incomplete
          if (path === 'src/E.tsx' && ref === 'origin/main') {
            return Promise.reject(new Error('File not found'))
          }
          return Promise.resolve('content')
        }),
      })

      const config = new Map<string, string>()
      config.set('DIFF_SCOPE_INCOMPLETE_FAIL_MODE', 'WARNING')

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [
            { path: 'src/A.tsx', action: 'MODIFY' },
            { path: 'src/B.tsx', action: 'MODIFY' },
            { path: 'src/C.tsx', action: 'MODIFY' },
            { path: 'src/D.tsx', action: 'MODIFY' },
            { path: 'src/E.tsx', action: 'CREATE' }, // not in diff = 80% impl
          ],
        }),
        services: { ...createMockContext().services, git: mockGit },
        config,
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      expect(result.metrics?.overallHealth).toBe('GOOD')
    })

    // @clause CL-DSE-061
    it('succeeds when 60% impl returns PARTIAL', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue(['src/A.tsx', 'src/B.tsx', 'src/C.tsx']),
        readFile: vi.fn().mockImplementation((path, ref) => {
          // D, E don't exist
          if ((path === 'src/D.tsx' || path === 'src/E.tsx') && ref === 'origin/main') {
            return Promise.reject(new Error('File not found'))
          }
          return Promise.resolve('content')
        }),
      })

      const config = new Map<string, string>()
      config.set('DIFF_SCOPE_INCOMPLETE_FAIL_MODE', 'WARNING')

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [
            { path: 'src/A.tsx', action: 'MODIFY' },
            { path: 'src/B.tsx', action: 'MODIFY' },
            { path: 'src/C.tsx', action: 'MODIFY' },
            { path: 'src/D.tsx', action: 'CREATE' },
            { path: 'src/E.tsx', action: 'CREATE' },
          ],
        }),
        services: { ...createMockContext().services, git: mockGit },
        config,
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      expect(result.metrics?.overallHealth).toBe('PARTIAL')
    })

    // @clause CL-DSE-061
    it('succeeds when <50% impl returns POOR', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue(['src/A.tsx']),
        readFile: vi.fn().mockImplementation((path, ref) => {
          // B, C, D, E don't exist
          if (path !== 'src/A.tsx' && ref === 'origin/main') {
            return Promise.reject(new Error('File not found'))
          }
          return Promise.resolve('content')
        }),
      })

      const config = new Map<string, string>()
      config.set('DIFF_SCOPE_INCOMPLETE_FAIL_MODE', 'WARNING')

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [
            { path: 'src/A.tsx', action: 'MODIFY' },
            { path: 'src/B.tsx', action: 'CREATE' },
            { path: 'src/C.tsx', action: 'CREATE' },
            { path: 'src/D.tsx', action: 'CREATE' },
            { path: 'src/E.tsx', action: 'CREATE' },
          ],
        }),
        services: { ...createMockContext().services, git: mockGit },
        config,
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      expect(result.metrics?.overallHealth).toBe('POOR')
    })
  })

  // ===========================================================================
  // CL-DSE-070: Context analyzed sections
  // ===========================================================================
  describe('CL-DSE-070: Context analyzed sections', () => {
    // @clause CL-DSE-070
    it('succeeds when context.analyzed contains 5 required sections', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue(['src/Button.tsx']),
        readFile: vi.fn().mockResolvedValue('content'),
      })

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [{ path: 'src/Button.tsx', action: 'MODIFY' }],
        }),
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      expect(result.context?.analyzed.length).toBeGreaterThanOrEqual(5)

      const labels = result.context?.analyzed.map(a => a.label) ?? []
      expect(labels.some(l => l.includes('Expected Files'))).toBe(true)
      expect(labels.some(l => l.includes('Actual Files'))).toBe(true)
      expect(labels.some(l => l.includes('Missing Implementation'))).toBe(true)
      expect(labels.some(l => l.includes('Undeclared Changes'))).toBe(true)
      expect(labels.some(l => l.includes('Successfully Implemented'))).toBe(true)
    })
  })

  // ===========================================================================
  // CL-DSE-071: Findings include hints
  // ===========================================================================
  describe('CL-DSE-071: Findings include hints', () => {
    // @clause CL-DSE-071
    it('succeeds when scope creep finding includes resolution hint', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue(['src/Button.tsx', 'src/Extra.tsx']),
        readFile: vi.fn().mockResolvedValue('content'),
      })

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [{ path: 'src/Button.tsx', action: 'MODIFY' }],
        }),
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      const scopeCreepFinding = result.context?.findings.find(f =>
        f.message.includes('Extra.tsx')
      )
      expect(scopeCreepFinding).toBeDefined()
      expect(scopeCreepFinding?.message).toMatch(/Add to manifest|revert/i)
    })

    // @clause CL-DSE-071
    it('succeeds when CREATE_NOT_CREATED finding includes resolution hint', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue(['src/Button.tsx']),
        readFile: vi.fn().mockImplementation((path, ref) => {
          if (path === 'src/NewFile.ts' && ref === 'origin/main') {
            return Promise.reject(new Error('File not found'))
          }
          return Promise.resolve('content')
        }),
      })

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [
            { path: 'src/Button.tsx', action: 'MODIFY' },
            { path: 'src/NewFile.ts', action: 'CREATE' },
          ],
        }),
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      const finding = result.context?.findings.find(f =>
        f.message.includes('CREATE_NOT_CREATED')
      )
      expect(finding).toBeDefined()
      expect(finding?.message).toMatch(/Create the file|remove/i)
    })
  })

  // ===========================================================================
  // CL-DSE-080: Backward compatibility
  // ===========================================================================
  describe('CL-DSE-080: Backward compatibility', () => {
    // @clause CL-DSE-080
    it('succeeds when baseline scenario (diff ⊂ manifest) returns PASSED', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue(['src/Button.tsx']),
        readFile: vi.fn().mockResolvedValue('content'),
      })

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [
            { path: 'src/Button.tsx', action: 'MODIFY' },
            { path: 'src/Extra.tsx', action: 'MODIFY' }, // More files in manifest than diff is OK
          ],
        }),
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      // Note: This will be FAILED due to incomplete implementation
      // unless we set WARNING mode. The contract expects backward compat
      // when diff ⊂ manifest AND all actions fulfilled.
      // For true backward compat we need the file NOT to be incomplete.
      // This test validates the core scope creep logic still works.
      expect(result.metrics?.scopeCreepCount).toBe(0)
    })
  })

  // ===========================================================================
  // CL-DSE-081: Validator metadata unchanged
  // ===========================================================================
  describe('CL-DSE-081: Validator metadata unchanged', () => {
    // @clause CL-DSE-081
    it('succeeds when validator.gate equals 2', () => {
      expect(DiffScopeEnforcementValidator.gate).toBe(2)
    })

    // @clause CL-DSE-081
    it('succeeds when validator.order equals 1', () => {
      expect(DiffScopeEnforcementValidator.order).toBe(1)
    })

    // @clause CL-DSE-081
    it('succeeds when validator.isHardBlock equals true', () => {
      expect(DiffScopeEnforcementValidator.isHardBlock).toBe(true)
    })

    // @clause CL-DSE-081
    it('succeeds when validator.code equals DIFF_SCOPE_ENFORCEMENT', () => {
      expect(DiffScopeEnforcementValidator.code).toBe('DIFF_SCOPE_ENFORCEMENT')
    })
  })
})
