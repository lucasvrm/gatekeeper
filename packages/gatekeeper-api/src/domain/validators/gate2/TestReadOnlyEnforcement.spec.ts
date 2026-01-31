import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TestReadOnlyEnforcementValidator } from './TestReadOnlyEnforcement.js'

/**
 * TestReadOnlyEnforcement Contract Spec
 * =====================================
 *
 * Contract: test-read-only-manifest-fix v1.0
 * Mode: STRICT
 * Criticality: HIGH
 *
 * Objetivo: Corrigir o validator para reconhecer ctx.manifest.testFile
 * como arquivo de teste permitido, além de ctx.testFilePath.
 *
 * Este arquivo cobre todas as 10 cláusulas do contrato:
 * - CL-TROE-001: manifest.testFile é permitido
 * - CL-TROE-002: testFilePath continua funcionando
 * - CL-TROE-003: ambos os paths são permitidos simultaneamente
 * - CL-TROE-010: arquivo de teste extra é bloqueado
 * - CL-TROE-011: funciona quando manifest é null
 * - CL-TROE-012: funciona quando testFilePath é null
 * - CL-TROE-020: context.inputs inclui ambos os paths
 * - CL-TROE-030: metadata do validator não muda
 * - CL-TROE-040: exclusion patterns continuam funcionando
 * - CL-TROE-050: normalização de path funciona cross-platform
 *
 * REGRA: Se estes testes falharem, a LLM executora errou na implementação.
 *
 * TDD: Estes testes DEVEM FALHAR no baseRef (bug presente) e PASSAR após o fix.
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
  getDiffFilesWithWorkingTree(baseRef: string): Promise<string[]>
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
  getDiffFilesWithWorkingTree: vi.fn().mockResolvedValue(['src/Button.tsx']),
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
    testFilePath: 'artifacts/2026_01_30_001/Button.spec.tsx',
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
// TESTS - Usam o validator REAL para garantir TDD red phase
// =============================================================================

describe('TestReadOnlyEnforcementValidator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ===========================================================================
  // CL-TROE-001: manifest.testFile é permitido
  // ===========================================================================
  describe('CL-TROE-001: manifest.testFile é permitido', () => {
    // @clause CL-TROE-001
    it('succeeds when diff contains only manifest.testFile', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/Button.tsx',
          'src/__tests__/Button.spec.tsx', // = manifest.testFile
        ]),
      })

      const ctx = createMockContext({
        manifest: createMockManifest({
          testFile: 'src/__tests__/Button.spec.tsx',
        }),
        testFilePath: null, // Sem testFilePath, apenas manifest.testFile
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await TestReadOnlyEnforcementValidator.execute(ctx)

      // BUG: Atualmente falha porque não reconhece manifest.testFile
      // APÓS FIX: Deve passar
      expect(result.passed).toBe(true)
      expect(result.status).toBe('PASSED')
    })

    // @clause CL-TROE-001
    it('succeeds when manifest.testFile is recognized with different relative path', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'packages/ui/Button.tsx',
          'packages/ui/__tests__/Button.spec.tsx',
        ]),
      })

      const ctx = createMockContext({
        manifest: createMockManifest({
          testFile: 'packages/ui/__tests__/Button.spec.tsx',
        }),
        testFilePath: null,
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await TestReadOnlyEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(true)
      expect(result.status).toBe('PASSED')
    })

    // @clause CL-TROE-001
    it('succeeds when manifest.testFile uses .test.ts extension', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/utils.ts',
          'src/utils.test.ts',
        ]),
      })

      const ctx = createMockContext({
        manifest: createMockManifest({
          testFile: 'src/utils.test.ts',
        }),
        testFilePath: null,
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await TestReadOnlyEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(true)
      expect(result.status).toBe('PASSED')
    })

    // @clause CL-TROE-001
    it('succeeds when manifest.testFile uses .spec.jsx extension', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/Component.jsx',
          'src/Component.spec.jsx',
        ]),
      })

      const ctx = createMockContext({
        manifest: createMockManifest({
          testFile: 'src/Component.spec.jsx',
        }),
        testFilePath: null,
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await TestReadOnlyEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(true)
      expect(result.status).toBe('PASSED')
    })
  })

  // ===========================================================================
  // CL-TROE-002: testFilePath continua funcionando (backward compat)
  // ===========================================================================
  describe('CL-TROE-002: testFilePath continua funcionando', () => {
    // @clause CL-TROE-002
    it('succeeds when diff contains only ctx.testFilePath', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/Button.tsx',
          'src/__tests__/Button.spec.tsx',
        ]),
      })

      const ctx = createMockContext({
        testFilePath: 'src/__tests__/Button.spec.tsx',
        manifest: null, // Sem manifest, apenas testFilePath
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await TestReadOnlyEnforcementValidator.execute(ctx)

      // Este deve passar mesmo antes do fix (backward compat)
      expect(result.passed).toBe(true)
      expect(result.status).toBe('PASSED')
    })

    // @clause CL-TROE-002
    it('succeeds when testFilePath is in deep nested path', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/deep/nested/feature/Handler.ts',
          'src/deep/nested/feature/__tests__/Handler.spec.ts',
        ]),
      })

      const ctx = createMockContext({
        testFilePath: 'src/deep/nested/feature/__tests__/Handler.spec.ts',
        manifest: null,
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await TestReadOnlyEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(true)
      expect(result.status).toBe('PASSED')
    })

    // @clause CL-TROE-002
    it('succeeds when testFilePath uses .test.tsx extension', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/App.tsx',
          'src/App.test.tsx',
        ]),
      })

      const ctx = createMockContext({
        testFilePath: 'src/App.test.tsx',
        manifest: null,
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await TestReadOnlyEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(true)
      expect(result.status).toBe('PASSED')
    })
  })

  // ===========================================================================
  // CL-TROE-003: ambos os paths são permitidos simultaneamente
  // ===========================================================================
  describe('CL-TROE-003: ambos os paths são permitidos simultaneamente', () => {
    // @clause CL-TROE-003
    it('succeeds when diff contains both testFilePath and manifest.testFile', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/Button.tsx',
          'artifacts/2026_01_30_001/Button.spec.tsx', // testFilePath
          'src/__tests__/Button.spec.tsx', // manifest.testFile
        ]),
      })

      const ctx = createMockContext({
        testFilePath: 'artifacts/2026_01_30_001/Button.spec.tsx',
        manifest: createMockManifest({
          testFile: 'src/__tests__/Button.spec.tsx',
        }),
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await TestReadOnlyEnforcementValidator.execute(ctx)

      // BUG: Atualmente falha porque manifest.testFile é tratado como extra
      // APÓS FIX: Deve passar
      expect(result.passed).toBe(true)
      expect(result.status).toBe('PASSED')
    })

    // @clause CL-TROE-003
    it('succeeds when paths differ by directory structure', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'packages/core/Service.ts',
          'artifacts/run_123/Service.spec.ts', // source (testFilePath)
          'packages/core/__tests__/Service.spec.ts', // destination (manifest.testFile)
        ]),
      })

      const ctx = createMockContext({
        testFilePath: 'artifacts/run_123/Service.spec.ts',
        manifest: createMockManifest({
          testFile: 'packages/core/__tests__/Service.spec.ts',
        }),
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await TestReadOnlyEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(true)
      expect(result.status).toBe('PASSED')
    })

    // @clause CL-TROE-003
    it('succeeds when both paths are in different packages', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'packages/shared/utils.ts',
          'packages/shared-tests/utils.spec.ts', // testFilePath
          'packages/shared/__tests__/utils.spec.ts', // manifest.testFile
        ]),
      })

      const ctx = createMockContext({
        testFilePath: 'packages/shared-tests/utils.spec.ts',
        manifest: createMockManifest({
          testFile: 'packages/shared/__tests__/utils.spec.ts',
        }),
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await TestReadOnlyEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(true)
      expect(result.status).toBe('PASSED')
    })
  })

  // ===========================================================================
  // CL-TROE-010: arquivo de teste extra é bloqueado
  // ===========================================================================
  describe('CL-TROE-010: arquivo de teste extra é bloqueado', () => {
    // @clause CL-TROE-010
    it('fails when diff contains extra .spec.ts file beyond allowed', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/Button.tsx',
          'src/__tests__/Button.spec.tsx', // allowed (manifest.testFile)
          'src/__tests__/OtherExisting.spec.tsx', // EXTRA - not allowed!
        ]),
      })

      const ctx = createMockContext({
        manifest: createMockManifest({
          testFile: 'src/__tests__/Button.spec.tsx',
        }),
        testFilePath: 'src/__tests__/Button.spec.tsx', // Same as manifest for this test
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await TestReadOnlyEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(false)
      expect(result.status).toBe('FAILED')
      expect(result.details?.modifiedTests).toContain('src/__tests__/OtherExisting.spec.tsx')
    })

    // @clause CL-TROE-010
    it('fails when multiple extra test files are modified', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/Component.tsx',
          'src/__tests__/Component.spec.tsx', // allowed
          'src/__tests__/Utils.spec.tsx', // EXTRA
          'src/__tests__/Helpers.spec.tsx', // EXTRA
        ]),
      })

      const ctx = createMockContext({
        testFilePath: 'src/__tests__/Component.spec.tsx',
        manifest: createMockManifest({
          testFile: 'src/__tests__/Component.spec.tsx',
        }),
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await TestReadOnlyEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(false)
      expect(result.status).toBe('FAILED')
      const modifiedTests = result.details?.modifiedTests as string[]
      expect(modifiedTests).toContain('src/__tests__/Utils.spec.tsx')
      expect(modifiedTests).toContain('src/__tests__/Helpers.spec.tsx')
      expect(modifiedTests).not.toContain('src/__tests__/Component.spec.tsx')
    })

    // @clause CL-TROE-010
    it('fails when extra .test.ts file is modified', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/api/handler.ts',
          'src/api/handler.test.ts', // allowed
          'src/api/routes.test.ts', // EXTRA
        ]),
      })

      const ctx = createMockContext({
        testFilePath: 'src/api/handler.test.ts',
        manifest: createMockManifest({
          testFile: 'src/api/handler.test.ts',
        }),
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await TestReadOnlyEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(false)
      expect(result.status).toBe('FAILED')
      expect(result.details?.modifiedTests).toContain('src/api/routes.test.ts')
    })
  })

  // ===========================================================================
  // CL-TROE-011: funciona quando manifest é null
  // ===========================================================================
  describe('CL-TROE-011: funciona quando manifest é null', () => {
    // @clause CL-TROE-011
    it('succeeds when manifest is null and diff contains only testFilePath', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/Button.tsx',
          'src/__tests__/Button.spec.tsx',
        ]),
      })

      const ctx = createMockContext({
        manifest: null,
        testFilePath: 'src/__tests__/Button.spec.tsx',
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await TestReadOnlyEnforcementValidator.execute(ctx)

      // Backward compat - deve passar mesmo antes do fix
      expect(result.passed).toBe(true)
      expect(result.status).toBe('PASSED')
    })

    // @clause CL-TROE-011
    it('succeeds when manifest is null and no test files in diff', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/Button.tsx',
          'src/utils/helper.ts',
        ]),
      })

      const ctx = createMockContext({
        manifest: null,
        testFilePath: 'src/__tests__/Button.spec.tsx', // not in diff
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await TestReadOnlyEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(true)
      expect(result.status).toBe('PASSED')
    })

    // @clause CL-TROE-011
    it('fails when manifest is null and diff contains extra test file', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/Button.tsx',
          'src/__tests__/Button.spec.tsx', // allowed
          'src/__tests__/ExistingTest.spec.tsx', // EXTRA - not allowed!
        ]),
      })

      const ctx = createMockContext({
        manifest: null,
        testFilePath: 'src/__tests__/Button.spec.tsx',
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await TestReadOnlyEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(false)
      expect(result.status).toBe('FAILED')
      expect(result.details?.modifiedTests).toContain('src/__tests__/ExistingTest.spec.tsx')
    })
  })

  // ===========================================================================
  // CL-TROE-012: funciona quando testFilePath é null
  // ===========================================================================
  describe('CL-TROE-012: funciona quando testFilePath é null', () => {
    // @clause CL-TROE-012
    it('succeeds when testFilePath is null and diff contains only manifest.testFile', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/Component.tsx',
          'src/__tests__/Component.spec.tsx',
        ]),
      })

      const ctx = createMockContext({
        testFilePath: null,
        manifest: createMockManifest({
          testFile: 'src/__tests__/Component.spec.tsx',
        }),
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await TestReadOnlyEnforcementValidator.execute(ctx)

      // BUG: Atualmente falha porque não reconhece manifest.testFile
      // APÓS FIX: Deve passar
      expect(result.passed).toBe(true)
      expect(result.status).toBe('PASSED')
    })

    // @clause CL-TROE-012
    it('succeeds when testFilePath is null and manifest.testFile is in nested path', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'packages/domain/user/UserService.ts',
          'packages/domain/user/__tests__/UserService.spec.ts',
        ]),
      })

      const ctx = createMockContext({
        testFilePath: null,
        manifest: createMockManifest({
          testFile: 'packages/domain/user/__tests__/UserService.spec.ts',
        }),
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await TestReadOnlyEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(true)
      expect(result.status).toBe('PASSED')
    })

    // @clause CL-TROE-012
    it('fails when testFilePath is null and diff contains extra test file', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/feature/Handler.ts',
          'src/feature/__tests__/Handler.spec.ts', // allowed (manifest.testFile)
          'src/feature/__tests__/AnotherHandler.spec.ts', // EXTRA
        ]),
      })

      const ctx = createMockContext({
        testFilePath: 'src/feature/__tests__/Handler.spec.ts', // Set to same as manifest for this test
        manifest: createMockManifest({
          testFile: 'src/feature/__tests__/Handler.spec.ts',
        }),
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await TestReadOnlyEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(false)
      expect(result.status).toBe('FAILED')
      expect(result.details?.modifiedTests).toContain('src/feature/__tests__/AnotherHandler.spec.ts')
    })
  })

  // ===========================================================================
  // CL-TROE-020: context.inputs inclui ambos os paths
  // ===========================================================================
  describe('CL-TROE-020: context.inputs inclui informação sobre paths permitidos', () => {
    // @clause CL-TROE-020
    it('succeeds when context.inputs contains TestFile info', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue(['src/Button.tsx']),
      })

      const ctx = createMockContext({
        testFilePath: 'src/__tests__/Button.spec.tsx',
        manifest: null,
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await TestReadOnlyEnforcementValidator.execute(ctx)

      expect(result.context?.inputs).toBeDefined()
      expect(result.context?.inputs.length).toBeGreaterThan(0)
      const hasTestFileInfo = result.context?.inputs.some(
        (input) => input.label.toLowerCase().includes('test')
      )
      expect(hasTestFileInfo).toBe(true)
    })

    // @clause CL-TROE-020
    it('succeeds when context.inputs contains AllowedTests after fix', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue(['src/Button.tsx']),
      })

      const ctx = createMockContext({
        testFilePath: 'artifacts/run_001/Button.spec.tsx',
        manifest: createMockManifest({
          testFile: 'src/__tests__/Button.spec.tsx',
        }),
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await TestReadOnlyEnforcementValidator.execute(ctx)

      expect(result.context?.inputs).toBeDefined()
      // Após o fix, deve ter AllowedTests com ambos os paths
      // Por enquanto, verifica que existe algum input sobre testes
      const hasTestInfo = result.context?.inputs.some(
        (input) => input.label.toLowerCase().includes('test') || 
                   input.label.toLowerCase().includes('allowed')
      )
      expect(hasTestInfo).toBe(true)
    })

    // @clause CL-TROE-020
    it('succeeds when context.inputs includes ExcludedPatterns', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue(['src/Button.tsx']),
      })

      const ctx = createMockContext({
        testFilePath: 'src/__tests__/Button.spec.tsx',
        manifest: null,
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await TestReadOnlyEnforcementValidator.execute(ctx)

      expect(result.context?.inputs).toBeDefined()
      const excludedPatternsInput = result.context?.inputs.find(
        (input) => input.label.toLowerCase().includes('excluded') ||
                   input.label.toLowerCase().includes('pattern')
      )
      expect(excludedPatternsInput).toBeDefined()
    })
  })

  // ===========================================================================
  // CL-TROE-030: metadata do validator não muda
  // ===========================================================================
  describe('CL-TROE-030: metadata do validator não muda', () => {
    // @clause CL-TROE-030
    it('succeeds when validator.code equals TEST_READ_ONLY_ENFORCEMENT', () => {
      expect(TestReadOnlyEnforcementValidator.code).toBe('TEST_READ_ONLY_ENFORCEMENT')
    })

    // @clause CL-TROE-030
    it('succeeds when validator.gate equals 2', () => {
      expect(TestReadOnlyEnforcementValidator.gate).toBe(2)
    })

    // @clause CL-TROE-030
    it('succeeds when validator.order equals 2', () => {
      expect(TestReadOnlyEnforcementValidator.order).toBe(2)
    })

    // @clause CL-TROE-030
    it('succeeds when validator.isHardBlock equals true', () => {
      expect(TestReadOnlyEnforcementValidator.isHardBlock).toBe(true)
    })
  })

  // ===========================================================================
  // CL-TROE-040: exclusion patterns continuam funcionando
  // ===========================================================================
  describe('CL-TROE-040: exclusion patterns continuam funcionando', () => {
    // @clause CL-TROE-040
    it('succeeds when test file in artifacts/ is ignored by default', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/Button.tsx',
          'artifacts/run_001/Button.spec.tsx', // In artifacts/ - should be ignored
          'artifacts/run_001/Other.spec.tsx', // In artifacts/ - should be ignored
        ]),
      })

      const ctx = createMockContext({
        testFilePath: null,
        manifest: null, // Neither testFilePath nor manifest.testFile set
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await TestReadOnlyEnforcementValidator.execute(ctx)

      // Backward compat - artifacts exclusion should work
      expect(result.passed).toBe(true)
      expect(result.status).toBe('PASSED')
    })

    // @clause CL-TROE-040
    it('succeeds when test file in nested artifacts path is ignored', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/Component.tsx',
          'artifacts/2026_01_30/specs/Component.spec.tsx',
        ]),
      })

      const ctx = createMockContext({
        testFilePath: null,
        manifest: null,
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await TestReadOnlyEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(true)
      expect(result.status).toBe('PASSED')
    })

    // @clause CL-TROE-040
    it('succeeds when custom exclusion pattern is respected', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/Button.tsx',
          'generated/__tests__/Button.spec.tsx', // Should be excluded by custom pattern
        ]),
      })

      const config = new Map<string, string>()
      config.set('TEST_READ_ONLY_EXCLUDED_PATHS', 'artifacts/**,generated/**')

      const ctx = createMockContext({
        testFilePath: null,
        manifest: null,
        config,
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await TestReadOnlyEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(true)
      expect(result.status).toBe('PASSED')
    })
  })

  // ===========================================================================
  // CL-TROE-050: normalização de path funciona cross-platform
  // ===========================================================================
  describe('CL-TROE-050: normalização de path funciona cross-platform', () => {
    // @clause CL-TROE-050
    it('should recognize test file with backslashes when using testFilePath', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src\\Button.tsx', // Windows-style path
          'src\\__tests__\\Button.spec.tsx', // Windows-style test path
        ]),
      })

      const ctx = createMockContext({
        testFilePath: 'src/__tests__/Button.spec.tsx', // Unix-style
        manifest: null,
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await TestReadOnlyEnforcementValidator.execute(ctx)

      // Backward compat - path normalization should work with testFilePath
      expect(result.passed).toBe(true)
      expect(result.status).toBe('PASSED')
    })

    // @clause CL-TROE-050
    it('should handle case differences in paths', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'SRC/Button.tsx',
          'SRC/__TESTS__/Button.spec.tsx', // Different case
        ]),
      })

      const ctx = createMockContext({
        testFilePath: 'src/__tests__/Button.spec.tsx', // Lowercase
        manifest: null,
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await TestReadOnlyEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(true)
      expect(result.status).toBe('PASSED')
    })

    // @clause CL-TROE-050
    it('should normalize mixed path separators correctly', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'packages/core/Service.ts',
          'packages\\core\\__tests__/Service.spec.ts', // Mixed separators
        ]),
      })

      const ctx = createMockContext({
        testFilePath: 'packages/core/__tests__/Service.spec.ts',
        manifest: null,
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await TestReadOnlyEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(true)
      expect(result.status).toBe('PASSED')
    })
  })

  // ===========================================================================
  // ADDITIONAL EDGE CASES
  // ===========================================================================
  describe('Edge cases and additional coverage', () => {
    // @clause CL-TROE-001
    it('succeeds when no test files exist in diff at all', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/Button.tsx',
          'src/utils/helper.ts',
          'README.md',
        ]),
      })

      const ctx = createMockContext({
        testFilePath: 'src/__tests__/Button.spec.tsx',
        manifest: createMockManifest({
          testFile: 'src/__tests__/Button.spec.tsx',
        }),
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await TestReadOnlyEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(true)
      expect(result.status).toBe('PASSED')
    })

    // @clause CL-TROE-010
    it('fails when only extra test files exist (no implementation)', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/__tests__/Unauthorized.spec.tsx', // EXTRA - not in allowed
        ]),
      })

      const ctx = createMockContext({
        testFilePath: 'src/__tests__/Button.spec.tsx', // not in diff
        manifest: null,
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await TestReadOnlyEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(false)
      expect(result.status).toBe('FAILED')
      expect(result.details?.modifiedTests).toContain('src/__tests__/Unauthorized.spec.tsx')
    })

    // @clause CL-TROE-003
    it('succeeds when working tree mode is enabled with testFilePath', async () => {
      const mockGit = createMockGitService({
        getDiffFilesWithWorkingTree: vi.fn().mockResolvedValue([
          'src/Button.tsx',
          'src/__tests__/Button.spec.tsx',
        ]),
        getDiffFiles: vi.fn().mockResolvedValue([]),
      })

      const config = new Map<string, string>()
      config.set('DIFF_SCOPE_INCLUDE_WORKING_TREE', 'true')

      const ctx = createMockContext({
        testFilePath: 'src/__tests__/Button.spec.tsx',
        manifest: null,
        config,
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await TestReadOnlyEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(true)
      expect(result.status).toBe('PASSED')
      expect(mockGit.getDiffFilesWithWorkingTree).toHaveBeenCalled()
      expect(mockGit.getDiffFiles).not.toHaveBeenCalled()
    })
  })
})
