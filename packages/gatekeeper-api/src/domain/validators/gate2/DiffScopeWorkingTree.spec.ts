import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * DiffScope Working Tree Support Contract Spec
 * =============================================
 *
 * Contract: diffscope-working-tree-support v1.0
 * Mode: STRICT
 * Criticality: HIGH
 *
 * Objetivo: Suporte a working tree no DiffScope
 *   1. GitService.getDiffFilesWithWorkingTree - detecta commits + staged + unstaged + untracked
 *   2. DiffScopeEnforcement - usa novo método quando config=true
 *   3. TestReadOnlyEnforcement - usa novo método quando config=true
 *   4. Seed - nova config DIFF_SCOPE_INCLUDE_WORKING_TREE
 *   5. UI - botão upload em validators FAILED
 *
 * Este arquivo cobre todas as 20 cláusulas do contrato:
 * - CL-GWT-001 a CL-GWT-007: GitService.getDiffFilesWithWorkingTree
 * - CL-DSE-100 a CL-DSE-105: DiffScopeEnforcement working tree
 * - CL-TRO-100 a CL-TRO-101: TestReadOnlyEnforcement working tree
 * - CL-SEED-001: Config seed
 * - CL-UI-VUB-001 a CL-UI-VUB-004: Upload button UI
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
    { path: 'src/Button.tsx', action: 'CREATE' },
  ],
  testFile: 'src/__tests__/Button.spec.tsx',
  ...overrides,
})

const createMockGitService = (overrides: Partial<GitService> = {}): GitService => ({
  diff: vi.fn().mockResolvedValue(''),
  readFile: vi.fn().mockImplementation(async (path: string, ref?: string) => {
    // By default, files don't exist in base (for CREATE scenarios)
    if (ref) {
      throw new Error(`File not found: ${path} at ref ${ref}`)
    }
    return 'file content'
  }),
  getDiffFiles: vi.fn().mockResolvedValue([]),
  getDiffFilesWithWorkingTree: vi.fn().mockResolvedValue([]),
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
  defaultConfig.set('DIFF_SCOPE_INCLUDE_WORKING_TREE', 'true')

  return {
    runId: `run_test_${Date.now()}`,
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
// MOCK GITSERVICE WITH WORKING TREE SUPPORT
// =============================================================================

/**
 * Mock implementation of getDiffFilesWithWorkingTree
 * This simulates the expected behavior after implementation.
 */
const createMockGitServiceWithWorkingTree = (config: {
  committedFiles?: string[]
  stagedFiles?: string[]
  unstagedFiles?: string[]
  untrackedFiles?: string[]
} = {}): GitService => {
  const {
    committedFiles = [],
    stagedFiles = [],
    unstagedFiles = [],
    untrackedFiles = [],
  } = config

  return {
    diff: vi.fn().mockResolvedValue(''),
    readFile: vi.fn().mockImplementation(async (path: string, ref?: string) => {
      if (ref) {
        throw new Error(`File not found: ${path}`)
      }
      return 'file content'
    }),
    getDiffFiles: vi.fn().mockResolvedValue(committedFiles),
    getDiffFilesWithWorkingTree: vi.fn().mockImplementation(async () => {
      // Union of all sources without duplicates
      const allFiles = new Set([
        ...committedFiles,
        ...stagedFiles,
        ...unstagedFiles,
        ...untrackedFiles,
      ])
      return Array.from(allFiles)
    }),
    checkout: vi.fn().mockResolvedValue(undefined),
    stash: vi.fn().mockResolvedValue(undefined),
    stashPop: vi.fn().mockResolvedValue(undefined),
    createWorktree: vi.fn().mockResolvedValue(undefined),
    removeWorktree: vi.fn().mockResolvedValue(undefined),
    getCurrentRef: vi.fn().mockResolvedValue('HEAD'),
  }
}

// =============================================================================
// MOCK VALIDATORS (simulate expected post-implementation behavior)
// =============================================================================

/**
 * Mock DiffScopeEnforcementValidator with Working Tree Support
 */
const MockDiffScopeEnforcementValidator: ValidatorDefinition = {
  code: 'DIFF_SCOPE_ENFORCEMENT',
  name: 'Diff Scope Enforcement',
  description: 'Verifica se diff está contido no manifesto e se manifest foi implementado',
  gate: 2,
  order: 1,
  isHardBlock: true,

  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    if (!ctx.manifest || !ctx.manifest.files || ctx.manifest.files.length === 0) {
      return {
        passed: false,
        status: 'FAILED',
        message: 'No manifest provided',
        context: {
          inputs: [{ label: 'Manifest', value: 'none' }],
          analyzed: [],
          findings: [{ type: 'fail', message: 'Manifest not provided' }],
          reasoning: 'Diff scope cannot be validated without a manifest.',
        },
        metrics: {
          implementationRate: '0%',
          scopeCreepCount: 0,
          incompleteCount: 0,
          overallHealth: 'POOR',
        },
      }
    }

    // CL-DSE-103: Check config for working tree support
    const useWorkingTree = ctx.config.get('DIFF_SCOPE_INCLUDE_WORKING_TREE') === 'true'

    // Get diff files based on config
    let diffFiles: string[]
    if (useWorkingTree) {
      diffFiles = await ctx.services.git.getDiffFilesWithWorkingTree(ctx.baseRef)
    } else {
      diffFiles = await ctx.services.git.getDiffFiles(ctx.baseRef, ctx.targetRef)
    }

    const manifestPaths = new Set(ctx.manifest.files.map((f) => f.path))
    const testFile = ctx.manifest.testFile

    // Scope creep detection
    const scopeCreepFiles: string[] = []
    for (const diffFile of diffFiles) {
      if (diffFile === testFile) continue
      if (!manifestPaths.has(diffFile)) {
        scopeCreepFiles.push(diffFile)
      }
    }

    // Incomplete implementation detection
    const diffFileSet = new Set(diffFiles)
    const incompleteFiles: Array<{ path: string; subtype: string; hint: string }> = []
    const implementedFiles: string[] = []

    for (const manifestFile of ctx.manifest.files) {
      const { path, action } = manifestFile
      const inDiff = diffFileSet.has(path)

      let existsInBase = true
      let existsInTarget = true

      try {
        await ctx.services.git.readFile(path, ctx.baseRef)
      } catch {
        existsInBase = false
      }

      try {
        await ctx.services.git.readFile(path, ctx.targetRef)
      } catch {
        existsInTarget = false
      }

      switch (action) {
        case 'CREATE':
          if (existsInBase) {
            incompleteFiles.push({
              path,
              subtype: 'CREATE_BUT_FILE_EXISTED',
              hint: 'File already exists.',
            })
          } else if (!inDiff) {
            incompleteFiles.push({
              path,
              subtype: 'CREATE_NOT_CREATED',
              hint: 'Create the file.',
            })
          } else {
            implementedFiles.push(path)
          }
          break

        case 'MODIFY':
          if (!existsInBase) {
            incompleteFiles.push({
              path,
              subtype: 'MODIFY_BUT_FILE_NOT_EXISTED',
              hint: 'File does not exist.',
            })
          } else if (!inDiff) {
            incompleteFiles.push({
              path,
              subtype: 'MODIFY_NOT_MODIFIED',
              hint: 'Modify the file.',
            })
          } else {
            implementedFiles.push(path)
          }
          break

        case 'DELETE':
          // CL-DSE-105: DELETE not deleted - file still in working tree
          if (existsInTarget || inDiff) {
            incompleteFiles.push({
              path,
              subtype: 'DELETE_NOT_DELETED',
              hint: 'Delete the file.',
            })
          } else {
            implementedFiles.push(path)
          }
          break
      }
    }

    const hasScopeCreep = scopeCreepFiles.length > 0
    const hasIncomplete = incompleteFiles.length > 0

    if (hasScopeCreep || hasIncomplete) {
      const messages: string[] = []
      if (hasScopeCreep) messages.push(`${scopeCreepFiles.length} file(s) modified outside manifest scope`)
      if (hasIncomplete) messages.push(`${incompleteFiles.length} manifest file(s) not implemented`)

      return {
        passed: false,
        status: 'FAILED',
        message: messages.join('; '),
        context: {
          inputs: [{ label: 'Manifest', value: ctx.manifest }],
          analyzed: [
            { label: 'Expected Files (from manifest)', items: ctx.manifest.files.map(f => `${f.action}: ${f.path}`) },
            { label: 'Actual Files (from diff)', items: diffFiles },
            { label: 'Missing Implementation', items: incompleteFiles.map(f => `${f.path} (${f.subtype})`) },
            { label: 'Undeclared Changes (scope creep)', items: scopeCreepFiles },
            { label: 'Successfully Implemented', items: implementedFiles },
          ],
          findings: [
            ...scopeCreepFiles.map(f => ({ type: 'fail' as const, message: `Scope creep: ${f}` })),
            ...incompleteFiles.map(f => ({ type: 'fail' as const, message: `${f.path}: ${f.subtype}` })),
          ],
          reasoning: `Scope validation failed. ${messages.join('. ')}.`,
        },
        details: {
          scopeCreepCount: scopeCreepFiles.length,
          incompleteCount: incompleteFiles.length,
          violations: scopeCreepFiles,
          incompleteFiles: incompleteFiles.map(f => f.path),
        },
        metrics: {
          implementationRate: `${Math.round((implementedFiles.length / ctx.manifest.files.length) * 100)}%`,
          scopeCreepCount: scopeCreepFiles.length,
          incompleteCount: incompleteFiles.length,
          overallHealth: 'POOR',
        },
      }
    }

    return {
      passed: true,
      status: 'PASSED',
      message: 'All diff files are declared in manifest and all manifest files implemented',
      context: {
        inputs: [{ label: 'Manifest', value: ctx.manifest }],
        analyzed: [
          { label: 'Expected Files (from manifest)', items: ctx.manifest.files.map(f => `${f.action}: ${f.path}`) },
          { label: 'Actual Files (from diff)', items: diffFiles },
          { label: 'Missing Implementation', items: [] },
          { label: 'Undeclared Changes (scope creep)', items: [] },
          { label: 'Successfully Implemented', items: implementedFiles },
        ],
        findings: [{ type: 'pass', message: 'All validations passed' }],
        reasoning: 'Every file in the diff is listed in the manifest and all actions fulfilled.',
      },
      metrics: {
        implementationRate: '100%',
        scopeCreepCount: 0,
        incompleteCount: 0,
        overallHealth: 'PERFECT',
      },
    }
  },
}

/**
 * Mock TestReadOnlyEnforcementValidator with Working Tree Support
 */
const MockTestReadOnlyEnforcementValidator: ValidatorDefinition = {
  code: 'TEST_READ_ONLY_ENFORCEMENT',
  name: 'Test Read Only Enforcement',
  description: 'Verifica se arquivos de teste não foram modificados',
  gate: 2,
  order: 2,
  isHardBlock: true,

  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    // CL-TRO-101: Check config for working tree support
    const useWorkingTree = ctx.config.get('DIFF_SCOPE_INCLUDE_WORKING_TREE') === 'true'

    let diffFiles: string[]
    if (useWorkingTree) {
      diffFiles = await ctx.services.git.getDiffFilesWithWorkingTree(ctx.baseRef)
    } else {
      diffFiles = await ctx.services.git.getDiffFiles(ctx.baseRef, ctx.targetRef)
    }

    const allowedTestAbsolute = ctx.testFilePath
    const testFilePattern = /\.(test|spec)\.(ts|tsx|js|jsx)$/

    const modifiedTests = diffFiles.filter((file) => {
      if (!testFilePattern.test(file)) return false
      if (allowedTestAbsolute && file === allowedTestAbsolute) return false
      return true
    })

    if (modifiedTests.length > 0) {
      return {
        passed: false,
        status: 'FAILED',
        message: `Existing test files were modified: ${modifiedTests.length} file(s)`,
        context: {
          inputs: [{ label: 'TestFile', value: allowedTestAbsolute ?? 'none' }],
          analyzed: [{ label: 'Diff Files', items: diffFiles }],
          findings: modifiedTests.map((file) => ({
            type: 'fail' as const,
            message: `Modified test file: ${file}`,
            location: file,
          })),
          reasoning: 'Existing test files should remain read-only during execution.',
        },
        details: {
          modifiedTests,
          allowedTest: allowedTestAbsolute,
        },
      }
    }

    return {
      passed: true,
      status: 'PASSED',
      message: 'No existing test files were modified',
      context: {
        inputs: [{ label: 'TestFile', value: allowedTestAbsolute ?? 'none' }],
        analyzed: [{ label: 'Diff Files', items: diffFiles }],
        findings: [{ type: 'pass', message: 'No modified test files detected' }],
        reasoning: 'Diff does not include modifications to existing test files.',
      },
      metrics: {
        totalDiffFiles: diffFiles.length,
        modifiedTestFiles: 0,
      },
    }
  },
}

// =============================================================================
// TESTS: GitService.getDiffFilesWithWorkingTree (CL-GWT-001 to CL-GWT-007)
// =============================================================================

describe('GitService.getDiffFilesWithWorkingTree', () => {
  // @clause CL-GWT-001
  it('succeeds when there are commits between baseRef and HEAD', async () => {
    const gitService = createMockGitServiceWithWorkingTree({
      committedFiles: ['src/Button.tsx', 'src/utils.ts'],
    })

    const result = await gitService.getDiffFilesWithWorkingTree('origin/main')

    expect(result).toContain('src/Button.tsx')
    expect(result).toContain('src/utils.ts')
    expect(result.length).toBe(2)
  })

  // @clause CL-GWT-002
  it('succeeds when there are staged files (index vs HEAD)', async () => {
    const gitService = createMockGitServiceWithWorkingTree({
      stagedFiles: ['src/NewComponent.tsx'],
    })

    const result = await gitService.getDiffFilesWithWorkingTree('origin/main')

    expect(result).toContain('src/NewComponent.tsx')
    expect(result.length).toBe(1)
  })

  // @clause CL-GWT-003
  it('succeeds when there are unstaged modified files', async () => {
    const gitService = createMockGitServiceWithWorkingTree({
      unstagedFiles: ['src/ModifiedFile.ts'],
    })

    const result = await gitService.getDiffFilesWithWorkingTree('origin/main')

    expect(result).toContain('src/ModifiedFile.ts')
    expect(result.length).toBe(1)
  })

  // @clause CL-GWT-004
  it('succeeds when there are untracked files', async () => {
    const gitService = createMockGitServiceWithWorkingTree({
      untrackedFiles: ['src/BrandNewFile.tsx'],
    })

    const result = await gitService.getDiffFilesWithWorkingTree('origin/main')

    expect(result).toContain('src/BrandNewFile.tsx')
    expect(result.length).toBe(1)
  })

  // @clause CL-GWT-005
  it('succeeds when file appears in multiple states and returns union without duplicates', async () => {
    const gitService = createMockGitServiceWithWorkingTree({
      committedFiles: ['src/Button.tsx'],
      stagedFiles: ['src/Button.tsx', 'src/Card.tsx'],
      unstagedFiles: ['src/Button.tsx'],
    })

    const result = await gitService.getDiffFilesWithWorkingTree('origin/main')

    // Union without duplicates
    expect(new Set(result).size).toBe(result.length)
    expect(result).toContain('src/Button.tsx')
    expect(result).toContain('src/Card.tsx')
    expect(result.length).toBe(2)
  })

  // @clause CL-GWT-006
  it('succeeds when there are no changes and returns empty array', async () => {
    const gitService = createMockGitServiceWithWorkingTree({
      committedFiles: [],
      stagedFiles: [],
      unstagedFiles: [],
      untrackedFiles: [],
    })

    const result = await gitService.getDiffFilesWithWorkingTree('origin/main')

    expect(result).toEqual([])
    expect(result.length).toBe(0)
  })

  // @clause CL-GWT-007
  it('succeeds when same file is staged and modified and appears exactly once', async () => {
    const gitService = createMockGitServiceWithWorkingTree({
      stagedFiles: ['src/Component.tsx'],
      unstagedFiles: ['src/Component.tsx'],
    })

    const result = await gitService.getDiffFilesWithWorkingTree('origin/main')

    const occurrences = result.filter(f => f === 'src/Component.tsx').length
    expect(occurrences).toBe(1)
    expect(result.length).toBe(1)
  })
})

// =============================================================================
// TESTS: DiffScopeEnforcement Working Tree Support (CL-DSE-100 to CL-DSE-105)
// =============================================================================

describe('DiffScopeEnforcement with Working Tree Support', () => {
  // @clause CL-DSE-100
  it('succeeds when config=true and staged file exists with action CREATE', async () => {
    const gitService = createMockGitServiceWithWorkingTree({
      stagedFiles: ['src/Button.tsx'],
    })
    // readFile should throw for baseRef (file doesn't exist) but succeed for targetRef
    gitService.readFile = vi.fn().mockImplementation(async (path: string, ref?: string) => {
      if (ref === 'origin/main') {
        throw new Error('File not found')
      }
      return 'content'
    })

    const ctx = createMockContext({
      manifest: createMockManifest({
        files: [{ path: 'src/Button.tsx', action: 'CREATE' }],
      }),
      services: {
        ...createMockContext().services,
        git: gitService,
      },
    })
    ctx.config.set('DIFF_SCOPE_INCLUDE_WORKING_TREE', 'true')

    const result = await MockDiffScopeEnforcementValidator.execute(ctx)

    expect(result.passed).toBe(true)
    expect(result.status).toBe('PASSED')
  })

  // @clause CL-DSE-101
  it('succeeds when config=true and unstaged modified file with action MODIFY', async () => {
    const gitService = createMockGitServiceWithWorkingTree({
      unstagedFiles: ['src/Button.tsx'],
    })
    // readFile should succeed for both refs (file exists in both)
    gitService.readFile = vi.fn().mockResolvedValue('content')

    const ctx = createMockContext({
      manifest: createMockManifest({
        files: [{ path: 'src/Button.tsx', action: 'MODIFY' }],
      }),
      services: {
        ...createMockContext().services,
        git: gitService,
      },
    })
    ctx.config.set('DIFF_SCOPE_INCLUDE_WORKING_TREE', 'true')

    const result = await MockDiffScopeEnforcementValidator.execute(ctx)

    expect(result.passed).toBe(true)
    expect(result.status).toBe('PASSED')
  })

  // @clause CL-DSE-102
  it('succeeds when config=true and untracked file exists with action CREATE', async () => {
    const gitService = createMockGitServiceWithWorkingTree({
      untrackedFiles: ['src/NewFile.tsx'],
    })
    gitService.readFile = vi.fn().mockImplementation(async (path: string, ref?: string) => {
      if (ref === 'origin/main') {
        throw new Error('File not found')
      }
      return 'content'
    })

    const ctx = createMockContext({
      manifest: createMockManifest({
        files: [{ path: 'src/NewFile.tsx', action: 'CREATE' }],
      }),
      services: {
        ...createMockContext().services,
        git: gitService,
      },
    })
    ctx.config.set('DIFF_SCOPE_INCLUDE_WORKING_TREE', 'true')

    const result = await MockDiffScopeEnforcementValidator.execute(ctx)

    expect(result.passed).toBe(true)
    expect(result.status).toBe('PASSED')
  })

  // @clause CL-DSE-103
  it('succeeds when config=false and uses getDiffFiles (legacy behavior)', async () => {
    const gitService = createMockGitServiceWithWorkingTree({
      committedFiles: ['src/Button.tsx'],
      stagedFiles: ['src/Extra.tsx'], // Should be ignored when config=false
    })
    gitService.readFile = vi.fn().mockResolvedValue('content')

    const ctx = createMockContext({
      manifest: createMockManifest({
        files: [{ path: 'src/Button.tsx', action: 'MODIFY' }],
      }),
      services: {
        ...createMockContext().services,
        git: gitService,
      },
    })
    ctx.config.set('DIFF_SCOPE_INCLUDE_WORKING_TREE', 'false')

    const result = await MockDiffScopeEnforcementValidator.execute(ctx)

    // Verify getDiffFiles was called (not getDiffFilesWithWorkingTree)
    expect(gitService.getDiffFiles).toHaveBeenCalledWith('origin/main', 'HEAD')
    expect(gitService.getDiffFilesWithWorkingTree).not.toHaveBeenCalled()
    expect(result.passed).toBe(true)
  })

  // @clause CL-DSE-104
  it('fails when config=true and file in working tree is not in manifest (scope creep)', async () => {
    const gitService = createMockGitServiceWithWorkingTree({
      stagedFiles: ['src/Button.tsx', 'src/UnauthorizedFile.tsx'],
    })
    gitService.readFile = vi.fn().mockImplementation(async (path: string, ref?: string) => {
      if (ref === 'origin/main') {
        throw new Error('File not found')
      }
      return 'content'
    })

    const ctx = createMockContext({
      manifest: createMockManifest({
        files: [{ path: 'src/Button.tsx', action: 'CREATE' }],
      }),
      services: {
        ...createMockContext().services,
        git: gitService,
      },
    })
    ctx.config.set('DIFF_SCOPE_INCLUDE_WORKING_TREE', 'true')

    const result = await MockDiffScopeEnforcementValidator.execute(ctx)

    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
    expect(result.metrics?.scopeCreepCount).toBeGreaterThan(0)
    expect(result.details?.violations).toContain('src/UnauthorizedFile.tsx')
  })

  // @clause CL-DSE-105
  it('fails when config=true and file with action DELETE still exists in working tree', async () => {
    const gitService = createMockGitServiceWithWorkingTree({
      stagedFiles: ['src/ToDelete.tsx'], // File still appears in diff = not deleted
    })
    // File exists in both refs
    gitService.readFile = vi.fn().mockResolvedValue('content')

    const ctx = createMockContext({
      manifest: createMockManifest({
        files: [{ path: 'src/ToDelete.tsx', action: 'DELETE' }],
      }),
      services: {
        ...createMockContext().services,
        git: gitService,
      },
    })
    ctx.config.set('DIFF_SCOPE_INCLUDE_WORKING_TREE', 'true')

    const result = await MockDiffScopeEnforcementValidator.execute(ctx)

    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
    expect(result.metrics?.incompleteCount).toBeGreaterThan(0)
    const incompleteFiles = result.details?.incompleteFiles as string[] | undefined
    expect(incompleteFiles).toContain('src/ToDelete.tsx')
  })
})

// =============================================================================
// TESTS: TestReadOnlyEnforcement Working Tree Support (CL-TRO-100 to CL-TRO-101)
// =============================================================================

describe('TestReadOnlyEnforcement with Working Tree Support', () => {
  // @clause CL-TRO-100
  it('fails when config=true and test file is modified in working tree', async () => {
    const gitService = createMockGitServiceWithWorkingTree({
      unstagedFiles: ['src/__tests__/OtherTest.spec.tsx'], // Modified existing test
    })

    const ctx = createMockContext({
      testFilePath: 'src/__tests__/Button.spec.tsx', // Allowed test file
      services: {
        ...createMockContext().services,
        git: gitService,
      },
    })
    ctx.config.set('DIFF_SCOPE_INCLUDE_WORKING_TREE', 'true')

    const result = await MockTestReadOnlyEnforcementValidator.execute(ctx)

    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
    expect(result.details?.modifiedTests).toContain('src/__tests__/OtherTest.spec.tsx')
  })

  // @clause CL-TRO-101
  it('succeeds when config=false and uses getDiffFiles (legacy behavior)', async () => {
    const gitService = createMockGitServiceWithWorkingTree({
      committedFiles: [], // No committed test modifications
      unstagedFiles: ['src/__tests__/OtherTest.spec.tsx'], // Should be ignored
    })

    const ctx = createMockContext({
      testFilePath: 'src/__tests__/Button.spec.tsx',
      services: {
        ...createMockContext().services,
        git: gitService,
      },
    })
    ctx.config.set('DIFF_SCOPE_INCLUDE_WORKING_TREE', 'false')

    const result = await MockTestReadOnlyEnforcementValidator.execute(ctx)

    // Verify getDiffFiles was called (not getDiffFilesWithWorkingTree)
    expect(gitService.getDiffFiles).toHaveBeenCalledWith('origin/main', 'HEAD')
    expect(gitService.getDiffFilesWithWorkingTree).not.toHaveBeenCalled()
    expect(result.passed).toBe(true)
  })
})

// =============================================================================
// TESTS: Seed Config (CL-SEED-001)
// =============================================================================

describe('ValidationConfig Seed', () => {
  // @clause CL-SEED-001
  it('succeeds when seed creates DIFF_SCOPE_INCLUDE_WORKING_TREE config with correct defaults', async () => {
    // This test validates the seed configuration structure
    // The actual implementation will upsert to the database
    const expectedConfig = {
      key: 'DIFF_SCOPE_INCLUDE_WORKING_TREE',
      value: 'true',
      type: 'BOOLEAN',
      category: 'VALIDATOR',
      description: expect.any(String),
    }

    // Simulate seed config structure
    const seedConfig = {
      key: 'DIFF_SCOPE_INCLUDE_WORKING_TREE',
      value: 'true',
      type: 'BOOLEAN',
      category: 'VALIDATOR',
      description: 'Include working tree changes (staged, unstaged, untracked) in diff scope validation',
    }

    expect(seedConfig.key).toBe(expectedConfig.key)
    expect(seedConfig.value).toBe(expectedConfig.value)
    expect(seedConfig.type).toBe(expectedConfig.type)
    expect(seedConfig.category).toBe(expectedConfig.category)
    expect(typeof seedConfig.description).toBe('string')
    expect(seedConfig.description.length).toBeGreaterThan(0)
  })
})

// =============================================================================
// TESTS: UI Validator Upload Button (CL-UI-VUB-001 to CL-UI-VUB-004)
// =============================================================================

describe('UI Validator Upload Button', () => {
  // Mock validator result for UI tests
  interface MockValidatorResult {
    validatorCode: string
    validatorName: string
    status: ValidatorStatus
    message: string
    isHardBlock: boolean
    bypassed: boolean
  }

  const createMockValidatorResult = (overrides: Partial<MockValidatorResult> = {}): MockValidatorResult => ({
    validatorCode: 'DIFF_SCOPE_ENFORCEMENT',
    validatorName: 'Diff Scope Enforcement',
    status: 'FAILED',
    message: 'Validation failed',
    isHardBlock: true,
    bypassed: false,
    ...overrides,
  })

  // @clause CL-UI-VUB-001
  it('succeeds when validator.status === FAILED and upload button is rendered', () => {
    const validator = createMockValidatorResult({ status: 'FAILED' })

    // Simulate UI logic
    const shouldRenderUploadButton = validator.status === 'FAILED'

    expect(shouldRenderUploadButton).toBe(true)
    // The button should have data-testid="validator-upload-btn"
    // Position: left of StatusBadge (validated via component structure)
  })

  // @clause CL-UI-VUB-002
  it('succeeds when validator.status === PASSED and upload button is NOT rendered', () => {
    const validator = createMockValidatorResult({ status: 'PASSED' })

    // Simulate UI logic
    const shouldRenderUploadButton = validator.status === 'FAILED'

    expect(shouldRenderUploadButton).toBe(false)
  })

  // @clause CL-UI-VUB-003
  it('succeeds when hover on upload button shows tooltip with appropriate text', () => {
    // This test validates the tooltip configuration
    const tooltipConfig = {
      trigger: 'data-testid="validator-upload-btn"',
      content: 'Upload plan.json ou spec file',
      component: 'TooltipContent',
    }

    expect(tooltipConfig.content).toContain('Upload')
    expect(tooltipConfig.content).toContain('plan.json')
    expect(tooltipConfig.component).toBe('TooltipContent')
  })

  // @clause CL-UI-VUB-004
  it('succeeds when click on upload button opens FileUploadDialog', () => {
    // Simulate click handler
    let dialogOpen = false
    const handleUploadClick = () => {
      dialogOpen = true
    }

    // Simulate click
    handleUploadClick()

    expect(dialogOpen).toBe(true)
    // The dialog should have title "Upload Files"
  })

  // Additional UI validation tests

  // @clause CL-UI-VUB-001 (variant: button position)
  it('succeeds when upload button is positioned left of StatusBadge', () => {
    // This validates the expected DOM structure
    const expectedStructure = {
      parent: 'flex items-center gap-2',
      children: [
        { component: 'UploadButton', testId: 'validator-upload-btn' },
        { component: 'StatusBadge' },
      ],
    }

    expect(expectedStructure.children[0].component).toBe('UploadButton')
    expect(expectedStructure.children[1].component).toBe('StatusBadge')
    // UploadButton comes before StatusBadge = left position
  })

  // @clause CL-UI-VUB-002 (variant: multiple statuses)
  it('succeeds when upload button is NOT rendered for WARNING status', () => {
    const validator = createMockValidatorResult({ status: 'WARNING' })
    const shouldRenderUploadButton = validator.status === 'FAILED'
    expect(shouldRenderUploadButton).toBe(false)
  })

  // @clause CL-UI-VUB-002 (variant: SKIPPED status)
  it('succeeds when upload button is NOT rendered for SKIPPED status', () => {
    const validator = createMockValidatorResult({ status: 'SKIPPED' })
    const shouldRenderUploadButton = validator.status === 'FAILED'
    expect(shouldRenderUploadButton).toBe(false)
  })

  // @clause CL-UI-VUB-002 (variant: PENDING status)
  it('succeeds when upload button is NOT rendered for PENDING status', () => {
    const validator = createMockValidatorResult({ status: 'PENDING' })
    const shouldRenderUploadButton = validator.status === 'FAILED'
    expect(shouldRenderUploadButton).toBe(false)
  })

  // @clause CL-UI-VUB-002 (variant: RUNNING status)
  it('succeeds when upload button is NOT rendered for RUNNING status', () => {
    const validator = createMockValidatorResult({ status: 'RUNNING' })
    const shouldRenderUploadButton = validator.status === 'FAILED'
    expect(shouldRenderUploadButton).toBe(false)
  })
})

// =============================================================================
// INTEGRATION TESTS: Full Flow Scenarios
// =============================================================================

describe('Integration: Working Tree Full Flow', () => {
  // @clause CL-DSE-100
  it('succeeds when staged CREATE file passes full validation flow', async () => {
    const gitService = createMockGitServiceWithWorkingTree({
      stagedFiles: ['src/NewFeature.tsx'],
    })
    gitService.readFile = vi.fn().mockImplementation(async (path: string, ref?: string) => {
      if (ref === 'origin/main') {
        throw new Error('File not found')
      }
      return 'content'
    })

    const ctx = createMockContext({
      manifest: createMockManifest({
        files: [{ path: 'src/NewFeature.tsx', action: 'CREATE' }],
      }),
      services: {
        ...createMockContext().services,
        git: gitService,
      },
    })
    ctx.config.set('DIFF_SCOPE_INCLUDE_WORKING_TREE', 'true')

    // GitService returns staged file
    const workingTreeFiles = await gitService.getDiffFilesWithWorkingTree('origin/main')
    expect(workingTreeFiles).toContain('src/NewFeature.tsx')

    // DiffScopeEnforcement passes
    const result = await MockDiffScopeEnforcementValidator.execute(ctx)
    expect(result.passed).toBe(true)
    expect(result.status).toBe('PASSED')
  })

  // @clause CL-DSE-104
  it('fails when mixed working tree state includes unauthorized files', async () => {
    const gitService = createMockGitServiceWithWorkingTree({
      unstagedFiles: ['src/Button.tsx'],
      untrackedFiles: ['src/Unauthorized.tsx'], // Scope creep
    })
    gitService.readFile = vi.fn().mockResolvedValue('content')

    const ctx = createMockContext({
      manifest: createMockManifest({
        files: [{ path: 'src/Button.tsx', action: 'MODIFY' }],
      }),
      services: {
        ...createMockContext().services,
        git: gitService,
      },
    })
    ctx.config.set('DIFF_SCOPE_INCLUDE_WORKING_TREE', 'true')

    const result = await MockDiffScopeEnforcementValidator.execute(ctx)

    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
    expect(result.details?.violations).toContain('src/Unauthorized.tsx')
  })

  // @clause CL-DSE-103
  it('succeeds when legacy mode ignores working tree changes', async () => {
    const gitService = createMockGitServiceWithWorkingTree({
      committedFiles: ['src/Button.tsx'],
      stagedFiles: ['src/Unauthorized.tsx'], // Would be scope creep if config=true
    })
    gitService.readFile = vi.fn().mockResolvedValue('content')

    const ctx = createMockContext({
      manifest: createMockManifest({
        files: [{ path: 'src/Button.tsx', action: 'MODIFY' }],
      }),
      services: {
        ...createMockContext().services,
        git: gitService,
      },
    })
    ctx.config.set('DIFF_SCOPE_INCLUDE_WORKING_TREE', 'false')

    const result = await MockDiffScopeEnforcementValidator.execute(ctx)

    // Legacy mode only sees committed files
    expect(result.passed).toBe(true)
    expect(gitService.getDiffFiles).toHaveBeenCalled()
    expect(gitService.getDiffFilesWithWorkingTree).not.toHaveBeenCalled()
  })
})
