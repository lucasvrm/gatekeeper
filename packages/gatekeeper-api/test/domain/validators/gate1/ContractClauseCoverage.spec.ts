import { describe, it, expect } from 'vitest'
import type { ValidationContext } from '../../../../src/types/index.js'
import type { ContractV1 } from '../../../../src/types/contract.types.js'
import { ContractClauseCoverageValidator } from '../../../../src/domain/validators/gate1/ContractClauseCoverage.js'

const makeContext = (
  contract: ContractV1,
  fileContent: string,
  overrides: Partial<ValidationContext> = {},
): ValidationContext => {
  const baseContext: ValidationContext = {
    runId: 'run-coverage',
    projectPath: '.',
    baseRef: 'origin/main',
    targetRef: 'HEAD',
    taskPrompt: 'Validate clause coverage',
    manifest: null,
    testFilePath: 'src/tests/coverage.spec.ts',
    dangerMode: false,
    services: {
      git: {
        diff: async () => '',
        readFile: async () => fileContent,
        checkout: async () => undefined,
        getDiffFiles: async () => [],
        getCurrentRef: async () => 'origin/main',
      },
      ast: {
        parseFile: async () => ({} as any),
        getImports: async () => [],
      },
      testRunner: {
        runSingleTest: async () => ({ passed: true, exitCode: 0, output: '', duration: 0 }),
        runAllTests: async () => ({ passed: true, exitCode: 0, output: '', duration: 0 }),
      },
      compiler: {
        compile: async () => ({ success: true, errors: [], output: '' }),
      },
      lint: {
        lint: async () => ({ success: true, errorCount: 0, warningCount: 0, output: '' }),
      },
      build: {
        build: async () => ({ success: true, exitCode: 0, output: '' }),
      },
      tokenCounter: {
        count: () => 0,
      },
      log: {
        debug: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
    },
    config: new Map(),
    sensitivePatterns: [],
    ambiguousTerms: [],
    contract,
    contractJson: JSON.stringify(contract),
    contractParseError: undefined,
    ...overrides,
  }

  return baseContext
}

const baseContract = (): ContractV1 => ({
  schemaVersion: '1.0.0',
  slug: 'coverage-contract',
  title: 'Coverage contract',
  mode: 'STRICT',
  changeType: 'new',
  targetArtifacts: ['src/tests/coverage.spec.ts'],
  clauses: [
    {
      id: 'CL-COVER-001',
      kind: 'behavior',
      normativity: 'MUST',
      title: 'Primary behavior is tested',
      spec: 'Cover the primary flow',
      observables: ['http'],
    },
    {
      id: 'CL-COVER-002',
      kind: 'behavior',
      normativity: 'SHOULD',
      title: 'Secondary behavior is tested',
      spec: 'Cover the secondary flow',
      observables: ['http'],
    },
  ],
})

describe('ContractClauseCoverageValidator', () => {
  it('passes when each clause has a tag', async () => {
    const contract = baseContract()
    const fileContent = `
    // @clause CL-COVER-001
    it('primary clause', () => {})

    // @clause CL-COVER-002
    it('secondary clause', () => {})
    `

    const result = await ContractClauseCoverageValidator.execute(
      makeContext(contract, fileContent),
    )
    expect(result.status).toBe('PASSED')
  })

  it('fails when a clause is missing tags', async () => {
    const contract = baseContract()
    const fileContent = `
    // @clause CL-COVER-001
    it('only primary clause', () => {})
    `

    const result = await ContractClauseCoverageValidator.execute(
      makeContext(contract, fileContent),
    )
    expect(result.status).toBe('FAILED')
    expect(result.details?.coverageReport?.uncoveredClauseIds).toContain('CL-COVER-002')
  })

  it('fails when expectedCoverage requires more than one test', async () => {
    const contract: ContractV1 = {
      ...baseContract(),
      expectedCoverage: {
        minTestsPerClause: 2,
      },
    }
    const fileContent = `
    // @clause CL-COVER-001
    it('primary clause once', () => {})

    // @clause CL-COVER-002
    it('secondary clause once', () => {})
    `

    const result = await ContractClauseCoverageValidator.execute(
      makeContext(contract, fileContent),
    )
    expect(result.status).toBe('FAILED')
    const clauseIssues = (result.details?.clauseIssues as Array<{ clauseId: string }> | undefined) ?? []
    expect(clauseIssues.some((issue) => issue.clauseId === 'CL-COVER-001')).toBe(true)
    expect(clauseIssues.some((issue) => issue.clauseId === 'CL-COVER-002')).toBe(true)
  })

  it('warns in creative mode when coverage requirements are unmet', async () => {
    const contract: ContractV1 = {
      ...baseContract(),
      mode: 'CREATIVE',
    }
    const fileContent = `
    // @clause CL-COVER-001
    it('primary clause only', () => {})
    `

    const result = await ContractClauseCoverageValidator.execute(
      makeContext(contract, fileContent),
    )
    expect(result.status).toBe('WARNING')
  })
})
