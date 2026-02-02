import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { DiffScopeEnforcementValidator } from './DiffScopeEnforcement'

/**
 * DiffScopeEnforcement Contract Spec
 * ===================================
 *
 * Contract: diff-scope-global-exclusions v1.0
 * Mode: STRICT
 * Criticality: HIGH
 *
 * Objetivo: Consolidar DIFF_SCOPE_IGNORED_PATTERNS em DIFF_SCOPE_GLOBAL_EXCLUSIONS
 * com suporte a glob via minimatch, adicionar seção "Globally Excluded Files" no
 * context.analyzed, e implementar PatternListEditor na UI.
 *
 * Este arquivo cobre todas as 15 cláusulas do contrato:
 *
 * Backend (Validator):
 * - CL-DSE-012: Config renomeada — exclusão por default e custom patterns
 * - CL-DSE-041: Custom patterns suportam glob via minimatch
 * - CL-DSE-042: Glob patterns funcionam corretamente (**.generated.ts, .*, .husky/**)
 * - CL-DSE-043: Fallback para config antiga DIFF_SCOPE_IGNORED_PATTERNS
 * - CL-DSE-044: Seção "Globally Excluded Files" no context.analyzed
 * - CL-DSE-045: Múltiplos patterns separados por vírgula
 * - CL-DSE-046: Config vazia resulta em nenhuma exclusão
 * - CL-DSE-070: Context analyzed contém >= 6 seções
 *
 * UI (PatternListEditor + ValidationConfigsTab):
 * - CL-UI-PatternListEditor-render: PatternListEditor renderiza badges
 * - CL-UI-PatternListEditor-add: Adicionar pattern via input
 * - CL-UI-PatternListEditor-remove: Remover pattern via botão ×
 * - CL-UI-PatternListEditor-duplicate: Não permite duplicatas
 * - CL-UI-PatternListEditor-empty: Estado vazio
 * - CL-UI-ValidationConfigsTab-badges: Tabela renderiza badges para configs pattern list
 * - CL-UI-ValidationConfigsTab-edit-patternlist: Modal de edição usa PatternListEditor
 *
 * REGRA: Se estes testes falharem, a LLM executora errou na implementação.
 *
 * TDD: Estes testes DEVEM FALHAR no baseRef e PASSAR após a implementação.
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
// UI TEST FIXTURES
// =============================================================================

type ValidationConfigItem = {
  id: string
  key: string
  value: string
  type: string
  category: string
  description?: string | null
}

const createPatternListConfig = (overrides: Partial<ValidationConfigItem> = {}): ValidationConfigItem => ({
  id: 'config-1',
  key: 'DIFF_SCOPE_GLOBAL_EXCLUSIONS',
  value: 'package-lock.json,yarn.lock,pnpm-lock.yaml',
  type: 'STRING',
  category: 'GATE2',
  description: 'Glob patterns for excluded files',
  ...overrides,
})

const createPlainConfig = (overrides: Partial<ValidationConfigItem> = {}): ValidationConfigItem => ({
  id: 'config-2',
  key: 'DIFF_SCOPE_ALLOW_TEST_ONLY_DIFF',
  value: 'true',
  type: 'BOOLEAN',
  category: 'GATE2',
  description: 'Allow test-only diffs',
  ...overrides,
})

// =============================================================================
// BACKEND TESTS — DiffScopeEnforcementValidator
// =============================================================================

describe('DiffScopeEnforcementValidator Contract — Global Exclusions', () => {

  // ===========================================================================
  // CL-DSE-012: Config renomeada — exclusão por default e custom patterns
  // ===========================================================================
  describe('CL-DSE-012: DIFF_SCOPE_GLOBAL_EXCLUSIONS config with default and custom patterns', () => {

    // @clause CL-DSE-012
    it('should pass when DIFF_SCOPE_GLOBAL_EXCLUSIONS uses default patterns to exclude lock files', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/Button.tsx',
          'package-lock.json',
          'yarn.lock',
        ]),
        readFile: vi.fn().mockResolvedValue('content'),
      })

      // No config set — should use default 'package-lock.json,yarn.lock,pnpm-lock.yaml'
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
    it('should pass when custom DIFF_SCOPE_GLOBAL_EXCLUSIONS excludes specified files', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/Button.tsx',
          'package-lock.json',
        ]),
        readFile: vi.fn().mockResolvedValue('content'),
      })

      const config = new Map<string, string>()
      config.set('DIFF_SCOPE_GLOBAL_EXCLUSIONS', 'package-lock.json')

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

    // @clause CL-DSE-012
    it('should pass when excluded file does not appear in Undeclared Changes', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/Button.tsx',
          'yarn.lock',
        ]),
        readFile: vi.fn().mockResolvedValue('content'),
      })

      const config = new Map<string, string>()
      config.set('DIFF_SCOPE_GLOBAL_EXCLUSIONS', 'yarn.lock')

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [{ path: 'src/Button.tsx', action: 'MODIFY' }],
        }),
        services: { ...createMockContext().services, git: mockGit },
        config,
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      const undeclaredSection = result.context?.analyzed.find(
        a => a.label.includes('Undeclared Changes')
      )
      expect(undeclaredSection?.items).not.toContain('yarn.lock')
    })

    // @clause CL-DSE-012
    it('fails when DIFF_SCOPE_GLOBAL_EXCLUSIONS does not cover an undeclared file', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/Button.tsx',
          'src/Unexpected.tsx',
        ]),
        readFile: vi.fn().mockResolvedValue('content'),
      })

      const config = new Map<string, string>()
      config.set('DIFF_SCOPE_GLOBAL_EXCLUSIONS', 'package-lock.json')

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [{ path: 'src/Button.tsx', action: 'MODIFY' }],
        }),
        services: { ...createMockContext().services, git: mockGit },
        config,
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(false)
      expect(result.metrics?.scopeCreepCount).toBeGreaterThan(0)
    })
  })

  // ===========================================================================
  // CL-DSE-041: Custom patterns support glob via minimatch
  // ===========================================================================
  describe('CL-DSE-041: Glob patterns via minimatch', () => {

    // @clause CL-DSE-041
    it('should pass when glob pattern generated/** excludes matching files', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/Button.tsx',
          'generated/schema.ts',
        ]),
        readFile: vi.fn().mockResolvedValue('content'),
      })

      const config = new Map<string, string>()
      config.set('DIFF_SCOPE_GLOBAL_EXCLUSIONS', 'generated/**')

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

    // @clause CL-DSE-041
    it('should pass when minimatch uses dot:true option to match dotfiles', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/Button.tsx',
          '.env.production',
        ]),
        readFile: vi.fn().mockResolvedValue('content'),
      })

      const config = new Map<string, string>()
      config.set('DIFF_SCOPE_GLOBAL_EXCLUSIONS', '.env.*')

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

    // @clause CL-DSE-041
    it('fails when glob pattern does not match the undeclared file', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/Button.tsx',
          'src/Extra.tsx',
        ]),
        readFile: vi.fn().mockResolvedValue('content'),
      })

      const config = new Map<string, string>()
      config.set('DIFF_SCOPE_GLOBAL_EXCLUSIONS', 'generated/**')

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [{ path: 'src/Button.tsx', action: 'MODIFY' }],
        }),
        services: { ...createMockContext().services, git: mockGit },
        config,
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(false)
      expect(result.metrics?.scopeCreepCount).toBeGreaterThan(0)
    })
  })

  // ===========================================================================
  // CL-DSE-042: Glob patterns work correctly for various patterns
  // ===========================================================================
  describe('CL-DSE-042: Glob patterns — **/*.generated.ts, .*, .husky/**', () => {

    // @clause CL-DSE-042
    it('should pass when **/*.generated.ts excludes nested generated files', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/Button.tsx',
          'src/api/types.generated.ts',
        ]),
        readFile: vi.fn().mockResolvedValue('content'),
      })

      const config = new Map<string, string>()
      config.set('DIFF_SCOPE_GLOBAL_EXCLUSIONS', '**/*.generated.ts')

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

    // @clause CL-DSE-042
    it('should pass when .* glob excludes dotfiles like .prettierrc', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/Button.tsx',
          '.prettierrc',
        ]),
        readFile: vi.fn().mockResolvedValue('content'),
      })

      const config = new Map<string, string>()
      config.set('DIFF_SCOPE_GLOBAL_EXCLUSIONS', '.*')

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

    // @clause CL-DSE-042
    it('should pass when .husky/** excludes entire husky directory', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/Button.tsx',
          '.husky/pre-commit',
          '.husky/commit-msg',
        ]),
        readFile: vi.fn().mockResolvedValue('content'),
      })

      const config = new Map<string, string>()
      config.set('DIFF_SCOPE_GLOBAL_EXCLUSIONS', '.husky/**')

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

    // @clause CL-DSE-042
    it('fails when **/*.generated.ts does NOT exclude src/Button.tsx', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/Button.tsx',
          'src/Extra.tsx',
        ]),
        readFile: vi.fn().mockResolvedValue('content'),
      })

      const config = new Map<string, string>()
      config.set('DIFF_SCOPE_GLOBAL_EXCLUSIONS', '**/*.generated.ts')

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [{ path: 'src/Button.tsx', action: 'MODIFY' }],
        }),
        services: { ...createMockContext().services, git: mockGit },
        config,
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      // src/Extra.tsx does NOT match **/*.generated.ts, so it's scope creep
      expect(result.passed).toBe(false)
      expect(result.metrics?.scopeCreepCount).toBe(1)
    })
  })

  // ===========================================================================
  // CL-DSE-043: Fallback to old config DIFF_SCOPE_IGNORED_PATTERNS
  // ===========================================================================
  describe('CL-DSE-043: Fallback to DIFF_SCOPE_IGNORED_PATTERNS', () => {

    // @clause CL-DSE-043
    it('should pass when GLOBAL_EXCLUSIONS is absent but IGNORED_PATTERNS exists', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/Button.tsx',
          'yarn.lock',
        ]),
        readFile: vi.fn().mockResolvedValue('content'),
      })

      const config = new Map<string, string>()
      // Only old config name — no DIFF_SCOPE_GLOBAL_EXCLUSIONS
      config.set('DIFF_SCOPE_IGNORED_PATTERNS', 'yarn.lock')

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

    // @clause CL-DSE-043
    it('should pass when neither config exists, using default patterns', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/Button.tsx',
          'pnpm-lock.yaml',
        ]),
        readFile: vi.fn().mockResolvedValue('content'),
      })

      // No config set at all → default 'package-lock.json,yarn.lock,pnpm-lock.yaml'
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

    // @clause CL-DSE-043
    it('should pass when GLOBAL_EXCLUSIONS takes precedence over IGNORED_PATTERNS', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/Button.tsx',
          'custom-file.log',
        ]),
        readFile: vi.fn().mockResolvedValue('content'),
      })

      const config = new Map<string, string>()
      config.set('DIFF_SCOPE_GLOBAL_EXCLUSIONS', 'custom-file.log')
      config.set('DIFF_SCOPE_IGNORED_PATTERNS', 'other-file.txt')

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [{ path: 'src/Button.tsx', action: 'MODIFY' }],
        }),
        services: { ...createMockContext().services, git: mockGit },
        config,
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      // GLOBAL_EXCLUSIONS = 'custom-file.log' should be used, excluding custom-file.log
      expect(result.passed).toBe(true)
      expect(result.metrics?.scopeCreepCount).toBe(0)
    })

    // @clause CL-DSE-043
    it('fails when fallback config does not cover the undeclared file', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/Button.tsx',
          'src/Unknown.tsx',
        ]),
        readFile: vi.fn().mockResolvedValue('content'),
      })

      const config = new Map<string, string>()
      config.set('DIFF_SCOPE_IGNORED_PATTERNS', 'yarn.lock')

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [{ path: 'src/Button.tsx', action: 'MODIFY' }],
        }),
        services: { ...createMockContext().services, git: mockGit },
        config,
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(false)
      expect(result.metrics?.scopeCreepCount).toBe(1)
    })
  })

  // ===========================================================================
  // CL-DSE-044: Section "Globally Excluded Files" in context.analyzed
  // ===========================================================================
  describe('CL-DSE-044: Globally Excluded Files section in analyzed', () => {

    // @clause CL-DSE-044
    it('should pass when analyzed contains Globally Excluded Files with excluded paths', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/Button.tsx',
          'package-lock.json',
        ]),
        readFile: vi.fn().mockResolvedValue('content'),
      })

      const config = new Map<string, string>()
      config.set('DIFF_SCOPE_GLOBAL_EXCLUSIONS', 'package-lock.json')

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [{ path: 'src/Button.tsx', action: 'MODIFY' }],
        }),
        services: { ...createMockContext().services, git: mockGit },
        config,
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      const excludedSection = result.context?.analyzed.find(
        a => a.label === 'Globally Excluded Files'
      )
      expect(excludedSection).toBeDefined()
      expect(excludedSection!.items).toContain('package-lock.json')
    })

    // @clause CL-DSE-044
    it('should pass when multiple excluded files appear in the section items', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/Button.tsx',
          'package-lock.json',
          'yarn.lock',
        ]),
        readFile: vi.fn().mockResolvedValue('content'),
      })

      const config = new Map<string, string>()
      config.set('DIFF_SCOPE_GLOBAL_EXCLUSIONS', 'package-lock.json,yarn.lock')

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [{ path: 'src/Button.tsx', action: 'MODIFY' }],
        }),
        services: { ...createMockContext().services, git: mockGit },
        config,
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      const excludedSection = result.context?.analyzed.find(
        a => a.label === 'Globally Excluded Files'
      )
      expect(excludedSection).toBeDefined()
      expect(excludedSection!.items).toContain('package-lock.json')
      expect(excludedSection!.items).toContain('yarn.lock')
      expect(excludedSection!.items).toHaveLength(2)
    })

    // @clause CL-DSE-044
    it('should pass when no files are excluded and section items is empty array', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue(['src/Button.tsx']),
        readFile: vi.fn().mockResolvedValue('content'),
      })

      const config = new Map<string, string>()
      config.set('DIFF_SCOPE_GLOBAL_EXCLUSIONS', 'package-lock.json')

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [{ path: 'src/Button.tsx', action: 'MODIFY' }],
        }),
        services: { ...createMockContext().services, git: mockGit },
        config,
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      const excludedSection = result.context?.analyzed.find(
        a => a.label === 'Globally Excluded Files'
      )
      expect(excludedSection).toBeDefined()
      expect(excludedSection!.items).toEqual([])
    })

    // @clause CL-DSE-044
    it('fails when Globally Excluded Files section is missing from analyzed', async () => {
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

      const labels = result.context?.analyzed.map(a => a.label) ?? []
      // This MUST be present after implementation
      expect(labels).toContain('Globally Excluded Files')
    })
  })

  // ===========================================================================
  // CL-DSE-045: Multiple CSV patterns
  // ===========================================================================
  describe('CL-DSE-045: Multiple patterns separated by comma', () => {

    // @clause CL-DSE-045
    it('should pass when .env.* and dist/** patterns both exclude matching files', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/Button.tsx',
          '.env.local',
          'dist/bundle.js',
        ]),
        readFile: vi.fn().mockResolvedValue('content'),
      })

      const config = new Map<string, string>()
      config.set('DIFF_SCOPE_GLOBAL_EXCLUSIONS', '.env.*,dist/**')

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

    // @clause CL-DSE-045
    it('should pass when excluded files from CSV appear in Globally Excluded Files section', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/Button.tsx',
          '.env.local',
          'dist/bundle.js',
        ]),
        readFile: vi.fn().mockResolvedValue('content'),
      })

      const config = new Map<string, string>()
      config.set('DIFF_SCOPE_GLOBAL_EXCLUSIONS', '.env.*,dist/**')

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [{ path: 'src/Button.tsx', action: 'MODIFY' }],
        }),
        services: { ...createMockContext().services, git: mockGit },
        config,
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      const excludedSection = result.context?.analyzed.find(
        a => a.label === 'Globally Excluded Files'
      )
      expect(excludedSection).toBeDefined()
      expect(excludedSection!.items).toContain('.env.local')
      expect(excludedSection!.items).toContain('dist/bundle.js')
    })

    // @clause CL-DSE-045
    it('should pass when three CSV patterns all apply correctly', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/Button.tsx',
          'package-lock.json',
          '.env.staging',
          'build/output.js',
        ]),
        readFile: vi.fn().mockResolvedValue('content'),
      })

      const config = new Map<string, string>()
      config.set('DIFF_SCOPE_GLOBAL_EXCLUSIONS', 'package-lock.json,.env.*,build/**')

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

    // @clause CL-DSE-045
    it('fails when only some CSV patterns match, leaving unmatched files as scope creep', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/Button.tsx',
          '.env.local',
          'src/Rogue.tsx',
        ]),
        readFile: vi.fn().mockResolvedValue('content'),
      })

      const config = new Map<string, string>()
      config.set('DIFF_SCOPE_GLOBAL_EXCLUSIONS', '.env.*,dist/**')

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [{ path: 'src/Button.tsx', action: 'MODIFY' }],
        }),
        services: { ...createMockContext().services, git: mockGit },
        config,
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      // .env.local is excluded but src/Rogue.tsx is not → scope creep
      expect(result.passed).toBe(false)
      expect(result.metrics?.scopeCreepCount).toBe(1)
    })
  })

  // ===========================================================================
  // CL-DSE-046: Empty config = no exclusions
  // ===========================================================================
  describe('CL-DSE-046: Empty DIFF_SCOPE_GLOBAL_EXCLUSIONS means no exclusions', () => {

    // @clause CL-DSE-046
    it('fails when config is empty string and undeclared file appears as scope creep', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/Button.tsx',
          'random-file.txt',
        ]),
        readFile: vi.fn().mockResolvedValue('content'),
      })

      const config = new Map<string, string>()
      config.set('DIFF_SCOPE_GLOBAL_EXCLUSIONS', '')

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [{ path: 'src/Button.tsx', action: 'MODIFY' }],
        }),
        services: { ...createMockContext().services, git: mockGit },
        config,
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      expect(result.passed).toBe(false)
      expect(result.metrics?.scopeCreepCount).toBeGreaterThan(0)
    })

    // @clause CL-DSE-046
    it('fails when empty config does not exclude package-lock.json', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/Button.tsx',
          'package-lock.json',
        ]),
        readFile: vi.fn().mockResolvedValue('content'),
      })

      const config = new Map<string, string>()
      config.set('DIFF_SCOPE_GLOBAL_EXCLUSIONS', '')

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [{ path: 'src/Button.tsx', action: 'MODIFY' }],
        }),
        services: { ...createMockContext().services, git: mockGit },
        config,
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      // Empty string means NO exclusions — even package-lock.json is scope creep
      expect(result.passed).toBe(false)
      expect(result.metrics?.scopeCreepCount).toBe(1)
    })

    // @clause CL-DSE-046
    it('should pass when empty config but all diff files are in manifest', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue(['src/Button.tsx']),
        readFile: vi.fn().mockResolvedValue('content'),
      })

      const config = new Map<string, string>()
      config.set('DIFF_SCOPE_GLOBAL_EXCLUSIONS', '')

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
  // CL-DSE-070: Context analyzed contains >= 6 sections
  // ===========================================================================
  describe('CL-DSE-070: Context analyzed has >= 6 sections including Globally Excluded Files', () => {

    // @clause CL-DSE-070
    it('should pass when context.analyzed contains at least 6 sections', async () => {
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

      expect(result.context?.analyzed.length).toBeGreaterThanOrEqual(6)
    })

    // @clause CL-DSE-070
    it('should pass when all 6 required section labels are present', async () => {
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

      const labels = result.context?.analyzed.map(a => a.label) ?? []
      expect(labels.some(l => l.includes('Expected Files'))).toBe(true)
      expect(labels.some(l => l.includes('Actual Files'))).toBe(true)
      expect(labels.some(l => l.includes('Globally Excluded Files'))).toBe(true)
      expect(labels.some(l => l.includes('Missing Implementation'))).toBe(true)
      expect(labels.some(l => l.includes('Undeclared Changes'))).toBe(true)
      expect(labels.some(l => l.includes('Successfully Implemented'))).toBe(true)
    })

    // @clause CL-DSE-070
    it('should pass when analyzed has 6 sections even on FAILED result', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue([
          'src/Button.tsx',
          'src/Extra.tsx',
        ]),
        readFile: vi.fn().mockResolvedValue('content'),
      })

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [{ path: 'src/Button.tsx', action: 'MODIFY' }],
        }),
        services: { ...createMockContext().services, git: mockGit },
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      expect(result.context?.analyzed.length).toBeGreaterThanOrEqual(6)
      expect(result.context?.analyzed.some(a => a.label === 'Globally Excluded Files')).toBe(true)
    })

    // @clause CL-DSE-070
    it('should pass when test-only diff early return also has 6 analyzed sections', async () => {
      const mockGit = createMockGitService({
        getDiffFiles: vi.fn().mockResolvedValue(['src/__tests__/Button.spec.tsx']),
        readFile: vi.fn().mockResolvedValue('content'),
      })

      const config = new Map<string, string>()
      config.set('DIFF_SCOPE_ALLOW_TEST_ONLY_DIFF', 'true')

      const ctx = createMockContext({
        manifest: createMockManifest({
          files: [{ path: 'src/Button.tsx', action: 'MODIFY' }],
          testFile: 'src/__tests__/Button.spec.tsx',
        }),
        services: { ...createMockContext().services, git: mockGit },
        config,
      })

      const result = await DiffScopeEnforcementValidator.execute(ctx)

      // Even early return paths must have 6 sections
      expect(result.context?.analyzed.length).toBeGreaterThanOrEqual(6)
      expect(result.context?.analyzed.some(a => a.label === 'Globally Excluded Files')).toBe(true)
    })
  })
})

// =============================================================================
// UI TESTS — PatternListEditor & ValidationConfigsTab
// =============================================================================

describe('UI Contract — PatternListEditor & ValidationConfigsTab', () => {

  // ===========================================================================
  // CL-UI-PatternListEditor-render: Renders badges
  // ===========================================================================
  describe('CL-UI-PatternListEditor-render: PatternListEditor renders badges', () => {

    // @clause CL-UI-PatternListEditor-render
    // @ui-clause CL-UI-PatternListEditor-render
    it('should pass when PatternListEditor is exported from validation-configs-tab', async () => {
      const mod = await import('@/components/validation-configs-tab')
      expect(mod).toHaveProperty('PatternListEditor')
      expect(typeof mod.PatternListEditor).toBe('function')
    })

    // @clause CL-UI-PatternListEditor-render
    // @ui-clause CL-UI-PatternListEditor-render
    it('should pass when rendered with 2 patterns and shows 2 badges', async () => {
      const { PatternListEditor } = await import('@/components/validation-configs-tab')
      const onChange = vi.fn()

      render(<PatternListEditor value="package-lock.json,yarn.lock" onChange={onChange} />)

      const editor = screen.getByTestId('pattern-list-editor')
      expect(editor).toBeInTheDocument()

      expect(screen.getByText('package-lock.json')).toBeInTheDocument()
      expect(screen.getByText('yarn.lock')).toBeInTheDocument()
    })

    // @clause CL-UI-PatternListEditor-render
    // @ui-clause CL-UI-PatternListEditor-render
    it('should pass when each badge has a remove button', async () => {
      const { PatternListEditor } = await import('@/components/validation-configs-tab')
      const onChange = vi.fn()

      render(<PatternListEditor value="package-lock.json,yarn.lock" onChange={onChange} />)

      expect(screen.getByTestId('pattern-remove-0')).toBeInTheDocument()
      expect(screen.getByTestId('pattern-remove-1')).toBeInTheDocument()
    })
  })

  // ===========================================================================
  // CL-UI-PatternListEditor-add: Add pattern via input
  // ===========================================================================
  describe('CL-UI-PatternListEditor-add: Add pattern via input', () => {
    const user = userEvent.setup()

    // @clause CL-UI-PatternListEditor-add
    // @ui-clause CL-UI-PatternListEditor-add
    it('should pass when pressing Enter adds a new badge and calls onChange', async () => {
      const { PatternListEditor } = await import('@/components/validation-configs-tab')
      const onChange = vi.fn()

      render(<PatternListEditor value="package-lock.json" onChange={onChange} />)

      const input = screen.getByTestId('pattern-input')
      await user.type(input, 'dist/**{Enter}')

      expect(onChange).toHaveBeenCalledWith('package-lock.json,dist/**')
    })

    // @clause CL-UI-PatternListEditor-add
    // @ui-clause CL-UI-PatternListEditor-add
    it('should pass when clicking add button adds a new badge', async () => {
      const { PatternListEditor } = await import('@/components/validation-configs-tab')
      const onChange = vi.fn()

      render(<PatternListEditor value="yarn.lock" onChange={onChange} />)

      const input = screen.getByTestId('pattern-input')
      await user.type(input, '.env.*')

      const addBtn = screen.getByTestId('pattern-add-btn')
      await user.click(addBtn)

      expect(onChange).toHaveBeenCalledWith('yarn.lock,.env.*')
    })

    // @clause CL-UI-PatternListEditor-add
    // @ui-clause CL-UI-PatternListEditor-add
    it('should pass when adding to empty value creates first pattern', async () => {
      const { PatternListEditor } = await import('@/components/validation-configs-tab')
      const onChange = vi.fn()

      render(<PatternListEditor value="" onChange={onChange} />)

      const input = screen.getByTestId('pattern-input')
      await user.type(input, 'generated/**{Enter}')

      expect(onChange).toHaveBeenCalledWith('generated/**')
    })
  })

  // ===========================================================================
  // CL-UI-PatternListEditor-remove: Remove pattern via × button
  // ===========================================================================
  describe('CL-UI-PatternListEditor-remove: Remove pattern via × button', () => {
    const user = userEvent.setup()

    // @clause CL-UI-PatternListEditor-remove
    // @ui-clause CL-UI-PatternListEditor-remove
    it('should pass when clicking × removes the badge and calls onChange without that pattern', async () => {
      const { PatternListEditor } = await import('@/components/validation-configs-tab')
      const onChange = vi.fn()

      render(<PatternListEditor value="package-lock.json,yarn.lock" onChange={onChange} />)

      const removeBtn = screen.getByTestId('pattern-remove-0')
      await user.click(removeBtn)

      expect(onChange).toHaveBeenCalledWith('yarn.lock')
    })

    // @clause CL-UI-PatternListEditor-remove
    // @ui-clause CL-UI-PatternListEditor-remove
    it('should pass when removing last badge calls onChange with empty string', async () => {
      const { PatternListEditor } = await import('@/components/validation-configs-tab')
      const onChange = vi.fn()

      render(<PatternListEditor value="package-lock.json" onChange={onChange} />)

      const removeBtn = screen.getByTestId('pattern-remove-0')
      await user.click(removeBtn)

      expect(onChange).toHaveBeenCalledWith('')
    })

    // @clause CL-UI-PatternListEditor-remove
    // @ui-clause CL-UI-PatternListEditor-remove
    it('should pass when removing middle badge preserves order of remaining patterns', async () => {
      const { PatternListEditor } = await import('@/components/validation-configs-tab')
      const onChange = vi.fn()

      render(<PatternListEditor value="a.txt,b.txt,c.txt" onChange={onChange} />)

      const removeBtn = screen.getByTestId('pattern-remove-1')
      await user.click(removeBtn)

      expect(onChange).toHaveBeenCalledWith('a.txt,c.txt')
    })
  })

  // ===========================================================================
  // CL-UI-PatternListEditor-duplicate: No duplicates allowed
  // ===========================================================================
  describe('CL-UI-PatternListEditor-duplicate: Duplicate patterns are rejected', () => {
    const user = userEvent.setup()

    // @clause CL-UI-PatternListEditor-duplicate
    // @ui-clause CL-UI-PatternListEditor-duplicate
    it('should pass when adding existing pattern does not call onChange', async () => {
      const { PatternListEditor } = await import('@/components/validation-configs-tab')
      const onChange = vi.fn()

      render(<PatternListEditor value="package-lock.json,yarn.lock" onChange={onChange} />)

      const input = screen.getByTestId('pattern-input')
      await user.type(input, 'yarn.lock{Enter}')

      expect(onChange).not.toHaveBeenCalled()
    })

    // @clause CL-UI-PatternListEditor-duplicate
    // @ui-clause CL-UI-PatternListEditor-duplicate
    it('should pass when badge count stays the same after duplicate attempt', async () => {
      const { PatternListEditor } = await import('@/components/validation-configs-tab')
      const onChange = vi.fn()

      render(<PatternListEditor value="a.txt,b.txt" onChange={onChange} />)

      const badgesBefore = screen.getAllByTestId(/^pattern-badge-/)
      expect(badgesBefore).toHaveLength(2)

      const input = screen.getByTestId('pattern-input')
      await user.type(input, 'a.txt{Enter}')

      const badgesAfter = screen.getAllByTestId(/^pattern-badge-/)
      expect(badgesAfter).toHaveLength(2)
    })

    // @clause CL-UI-PatternListEditor-duplicate
    // @ui-clause CL-UI-PatternListEditor-duplicate
    it('fails when a duplicate is somehow added and onChange is called', async () => {
      const { PatternListEditor } = await import('@/components/validation-configs-tab')
      const onChange = vi.fn()

      render(<PatternListEditor value="x.ts" onChange={onChange} />)

      const input = screen.getByTestId('pattern-input')
      await user.type(input, 'x.ts{Enter}')

      // onChange MUST NOT be called for duplicates
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  // ===========================================================================
  // CL-UI-PatternListEditor-empty: Empty state
  // ===========================================================================
  describe('CL-UI-PatternListEditor-empty: Empty value shows no badges', () => {

    // @clause CL-UI-PatternListEditor-empty
    // @ui-clause CL-UI-PatternListEditor-empty
    it('should pass when value is empty and no badges are rendered', async () => {
      const { PatternListEditor } = await import('@/components/validation-configs-tab')
      const onChange = vi.fn()

      render(<PatternListEditor value="" onChange={onChange} />)

      const badges = screen.queryAllByTestId(/^pattern-badge-/)
      expect(badges).toHaveLength(0)
    })

    // @clause CL-UI-PatternListEditor-empty
    // @ui-clause CL-UI-PatternListEditor-empty
    it('should pass when value is empty but input is visible and functional', async () => {
      const { PatternListEditor } = await import('@/components/validation-configs-tab')
      const onChange = vi.fn()

      render(<PatternListEditor value="" onChange={onChange} />)

      const input = screen.getByTestId('pattern-input')
      expect(input).toBeInTheDocument()
      expect(input).toBeVisible()
    })

    // @clause CL-UI-PatternListEditor-empty
    // @ui-clause CL-UI-PatternListEditor-empty
    it('should pass when editor container is present even with empty value', async () => {
      const { PatternListEditor } = await import('@/components/validation-configs-tab')
      const onChange = vi.fn()

      render(<PatternListEditor value="" onChange={onChange} />)

      expect(screen.getByTestId('pattern-list-editor')).toBeInTheDocument()
    })
  })

  // ===========================================================================
  // CL-UI-ValidationConfigsTab-badges: Table renders badges for pattern configs
  // ===========================================================================
  describe('CL-UI-ValidationConfigsTab-badges: Table renders badges for pattern list configs', () => {

    // @clause CL-UI-ValidationConfigsTab-badges
    // @ui-clause CL-UI-ValidationConfigsTab-badges
    it('should pass when _EXCLUSIONS config renders badges in value column', async () => {
      const { ValidationConfigsTab } = await import('@/components/validation-configs-tab')
      const items = [createPatternListConfig()]

      render(
        <ValidationConfigsTab
          items={items}
          onUpdate={vi.fn().mockResolvedValue(true)}
        />
      )

      const row = screen.getByTestId('config-row-config-1')
      const badges = within(row).getAllByText(/package-lock\.json|yarn\.lock|pnpm-lock\.yaml/)
      expect(badges.length).toBe(3)

      // Each badge should have font-mono class
      for (const badge of badges) {
        const badgeEl = badge.closest('[class*="font-mono"]') ?? badge
        expect(badgeEl.className).toMatch(/font-mono/)
      }
    })

    // @clause CL-UI-ValidationConfigsTab-badges
    // @ui-clause CL-UI-ValidationConfigsTab-badges
    it('should pass when _PATTERNS config also renders badges', async () => {
      const { ValidationConfigsTab } = await import('@/components/validation-configs-tab')
      const items = [
        createPatternListConfig({
          id: 'config-patterns',
          key: 'DIFF_SCOPE_IGNORED_PATTERNS',
          value: 'a.txt,b.txt',
        }),
      ]

      render(
        <ValidationConfigsTab
          items={items}
          onUpdate={vi.fn().mockResolvedValue(true)}
        />
      )

      const row = screen.getByTestId('config-row-config-patterns')
      expect(within(row).getByText('a.txt')).toBeInTheDocument()
      expect(within(row).getByText('b.txt')).toBeInTheDocument()
    })

    // @clause CL-UI-ValidationConfigsTab-badges
    // @ui-clause CL-UI-ValidationConfigsTab-badges
    it('should pass when non-pattern config does not render badges', async () => {
      const { ValidationConfigsTab } = await import('@/components/validation-configs-tab')
      const items = [createPlainConfig()]

      render(
        <ValidationConfigsTab
          items={items}
          onUpdate={vi.fn().mockResolvedValue(true)}
        />
      )

      const row = screen.getByTestId('config-row-config-2')
      // Plain config should render value as text, not as badges
      const cell = within(row).getByText('true')
      expect(cell).toBeInTheDocument()
      // Should NOT have badge-style rendering with font-mono
      const badgeElements = within(row).queryAllByTestId(/pattern-badge/)
      expect(badgeElements).toHaveLength(0)
    })
  })

  // ===========================================================================
  // CL-UI-ValidationConfigsTab-edit-patternlist: Edit modal uses PatternListEditor
  // ===========================================================================
  describe('CL-UI-ValidationConfigsTab-edit-patternlist: Edit modal renders PatternListEditor', () => {
    const user = userEvent.setup()

    // @clause CL-UI-ValidationConfigsTab-edit-patternlist
    // @ui-clause CL-UI-ValidationConfigsTab-edit-patternlist
    it('should pass when editing pattern list config shows PatternListEditor in modal', async () => {
      const { ValidationConfigsTab } = await import('@/components/validation-configs-tab')
      const items = [createPatternListConfig()]

      render(
        <ValidationConfigsTab
          items={items}
          onUpdate={vi.fn().mockResolvedValue(true)}
        />
      )

      // Click edit button
      const editBtn = within(screen.getByTestId('config-row-config-1')).getByText('Editar')
      await user.click(editBtn)

      // PatternListEditor should be rendered inside the modal
      expect(screen.getByTestId('pattern-list-editor')).toBeInTheDocument()
    })

    // @clause CL-UI-ValidationConfigsTab-edit-patternlist
    // @ui-clause CL-UI-ValidationConfigsTab-edit-patternlist
    it('should pass when pattern list editor in modal shows editable badges', async () => {
      const { ValidationConfigsTab } = await import('@/components/validation-configs-tab')
      const items = [createPatternListConfig({ value: 'a.txt,b.txt' })]

      render(
        <ValidationConfigsTab
          items={items}
          onUpdate={vi.fn().mockResolvedValue(true)}
        />
      )

      const editBtn = within(screen.getByTestId('config-row-config-1')).getByText('Editar')
      await user.click(editBtn)

      // Should see badges in the editor
      expect(screen.getByText('a.txt')).toBeInTheDocument()
      expect(screen.getByText('b.txt')).toBeInTheDocument()

      // Should have remove buttons
      expect(screen.getByTestId('pattern-remove-0')).toBeInTheDocument()
      expect(screen.getByTestId('pattern-remove-1')).toBeInTheDocument()
    })

    // @clause CL-UI-ValidationConfigsTab-edit-patternlist
    // @ui-clause CL-UI-ValidationConfigsTab-edit-patternlist
    it('should pass when pattern list editor in modal has input for adding new patterns', async () => {
      const { ValidationConfigsTab } = await import('@/components/validation-configs-tab')
      const items = [createPatternListConfig()]

      render(
        <ValidationConfigsTab
          items={items}
          onUpdate={vi.fn().mockResolvedValue(true)}
        />
      )

      const editBtn = within(screen.getByTestId('config-row-config-1')).getByText('Editar')
      await user.click(editBtn)

      const input = screen.getByTestId('pattern-input')
      expect(input).toBeInTheDocument()
      expect(input).toBeVisible()
    })
  })
})
