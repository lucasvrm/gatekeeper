import { describe, it, expect } from 'vitest'
import type { ValidationContext } from '../../../../src/types/index.js'
import type { ContractV1 } from '../../../../src/types/contract.types.js'
import { TestClauseMappingValidValidator } from '../../../../src/domain/validators/gate1/TestClauseMappingValid.js'

const makeContext = (
  contract: ContractV1,
  fileContent: string,
  overrides: Partial<ValidationContext> = {},
): ValidationContext => {
  const baseContext: ValidationContext = {
    runId: 'run-1',
    projectPath: '.',
    baseRef: 'origin/main',
    targetRef: 'HEAD',
    taskPrompt: 'Validate test mapping',
    manifest: null,
    testFilePath: 'src/tests/example.spec.ts',
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
  slug: 'mapping-contract',
  title: 'Mapping contract',
  mode: 'STRICT',
  changeType: 'new',
  targetArtifacts: ['src/tests/example.spec.ts'],
  clauses: [
    {
      id: 'CL-MAP-001',
      kind: 'behavior',
      normativity: 'MUST',
      title: 'Mapping example',
      spec: 'Map tags to clauses',
      observables: ['http'],
    },
    {
      id: 'CL-MAP-002',
      kind: 'behavior',
      normativity: 'MAY',
      title: 'Optional mapping',
      spec: 'Allow optional checks',
      observables: ['http'],
    },
  ],
  assertionSurface: {
    http: {
      endpoints: [
        {
          method: 'GET',
          path: '/health',
        },
      ],
    },
  },
})

describe('TestClauseMappingValidValidator', () => {
  it('passes when each test references valid clauses', async () => {
    const contract = baseContract()
    const fileContent = `
    // @clause CL-MAP-001
    it('validates mapping', () => {})
    `

    const result = await TestClauseMappingValidValidator.execute(makeContext(contract, fileContent))
    expect(result.status).toBe('PASSED')
  })

  it('fails when a tag references a missing clause', async () => {
    const contract = baseContract()
    const fileContent = `
    // @clause CL-MAP-999
    it('invalid clause', () => {})
    `

    const result = await TestClauseMappingValidValidator.execute(makeContext(contract, fileContent))
    expect(result.status).toBe('FAILED')
    expect(result.details?.invalidTags?.length).toBeGreaterThanOrEqual(1)
  })

  it('fails on strict runs when tests are missing tags', async () => {
    const contract = baseContract()
    const fileContent = `
    it('missing tag', () => {})
    `

    const result = await TestClauseMappingValidValidator.execute(makeContext(contract, fileContent))
    expect(result.status).toBe('FAILED')
    expect(result.details?.testsWithoutTags?.length).toBe(1)
  })

  it('allows untagged tests listed on the allowlist', async () => {
    const contract = {
      ...baseContract(),
      testMapping: {
        allowUntagged: false,
        untaggedAllowlist: ['setup'],
      },
    }
    const fileContent = `
    it('setup helper', () => {})
    `

    const result = await TestClauseMappingValidValidator.execute(makeContext(contract, fileContent))
    expect(result.status).toBe('PASSED')
  })

  it('fails when allowMultiple=false and a test has multiple tags', async () => {
    const contract = {
      ...baseContract(),
      testMapping: {
        allowMultiple: false,
      },
    }
    const fileContent = `
    // @clause CL-MAP-001
    // @clause CL-MAP-002
    it('multiple tags', () => {})
    `

    const result = await TestClauseMappingValidValidator.execute(makeContext(contract, fileContent))
    expect(result.status).toBe('FAILED')
    expect(result.details?.testsWithMultipleTags?.length).toBe(1)
  })

  it('warns when creative runs have missing tags', async () => {
    const contract = {
      ...baseContract(),
      mode: 'CREATIVE',
    }
    const fileContent = `
    it('creative missing tag', () => {})
    `

    const result = await TestClauseMappingValidValidator.execute(makeContext(contract, fileContent))
    expect(result.status).toBe('WARNING')
    expect(result.details?.testsWithoutTags?.length).toBe(1)
  })
})
