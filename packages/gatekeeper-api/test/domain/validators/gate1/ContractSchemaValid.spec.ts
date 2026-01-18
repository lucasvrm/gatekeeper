import { describe, it, expect } from 'vitest'
import type { ValidationContext } from '../../../src/types/index.js'
import type { ContractV1 } from '../../../src/types/contract.types.js'
import { ContractSchemaValidValidator } from '../../../src/domain/validators/gate1/ContractSchemaValid.js'

const stubContext = (contract: ContractV1, modeOverrides?: Partial<ValidationContext>): ValidationContext => {
  const baseContext: ValidationContext = {
    runId: 'run-id',
    projectPath: '.',
    baseRef: 'origin/main',
    targetRef: 'HEAD',
    taskPrompt: 'Validate schema',
    manifest: null,
    testFilePath: 'tests/example.spec.ts',
    dangerMode: false,
    services: {
      git: {
        diff: async () => '',
        readFile: async () => '',
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
    ...modeOverrides,
  }

  return baseContext
}

const minimalContract = (): ContractV1 => ({
  schemaVersion: '1.0.0',
  slug: 'schema-validator',
  title: 'Contract schema validation',
  mode: 'STRICT',
  changeType: 'new',
  targetArtifacts: ['src/service.ts'],
  clauses: [
    {
      id: 'CL-SCHEMA-001',
      kind: 'behavior',
      normativity: 'MUST',
      title: 'Should validate schema',
      spec: 'When running validation, the schema is enforced',
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
  testMapping: {
    format: 'comment_tags',
    allowMultiple: true,
  },
})

describe('ContractSchemaValidValidator', () => {
  it('passes for a minimal valid contract', async () => {
    const contract = minimalContract()
    const result = await ContractSchemaValidValidator.execute(stubContext(contract))
    expect(result.passed).toBe(true)
    expect(result.status).toBe('PASSED')
  })

  it('fails when mode enum is invalid', async () => {
    const contract = { ...minimalContract(), mode: 'UNKNOWN' as ContractV1['mode'] }
    const result = await ContractSchemaValidValidator.execute(stubContext(contract))
    expect(result.status).toBe('FAILED')
    expect(result.details?.errors?.some((err: string) => err.includes('mode'))).toBe(true)
  })

  it('fails when clause IDs are duplicated', async () => {
    const contract = minimalContract()
    contract.clauses.push({ ...contract.clauses[0] })
    const result = await ContractSchemaValidValidator.execute(stubContext(contract))
    expect(result.status).toBe('FAILED')
    const issues = result.details?.issues as Array<{ path: string }>
    expect(issues?.some(issue => issue.path === 'clauses')).toBe(true)
  })

  it('fails when testMapping allowlist is provided without allowUntagged', async () => {
    const contract = minimalContract()
    contract.testMapping = {
      format: 'comment_tags',
      allowMultiple: true,
      allowUntagged: false,
      untaggedAllowlist: ['beforeEach'],
    }
    const result = await ContractSchemaValidValidator.execute(stubContext(contract))
    expect(result.status).toBe('FAILED')
    const issues = result.details?.issues as Array<{ path: string }>
    expect(issues?.some(issue => issue.path === 'testMapping.untaggedAllowlist')).toBe(true)
  })

  it('fails when strict contract lacks assertionSurface', async () => {
    const contract = minimalContract()
    delete contract.assertionSurface
    const result = await ContractSchemaValidValidator.execute(stubContext(contract))
    expect(result.status).toBe('FAILED')
    const issues = result.details?.issues as Array<{ path: string }>
    expect(issues?.some(issue => issue.path === 'assertionSurface')).toBe(true)
  })

  it('warns when creative contract lacks assertionSurface', async () => {
    const contract = { ...minimalContract(), mode: 'CREATIVE' }
    delete contract.assertionSurface
    const result = await ContractSchemaValidValidator.execute(stubContext(contract))
    expect(result.status).toBe('WARNING')
    const issues = result.details?.issues as Array<{ severity: string }>
    expect(issues?.some(issue => issue.severity === 'WARNING')).toBe(true)
  })

  it('fails when expectedCoverage mentions security with no security clause', async () => {
    const contract = minimalContract()
    contract.expectedCoverage = { minTestsForSecurity: 2 }
    const result = await ContractSchemaValidValidator.execute(stubContext(contract))
    expect(result.status).toBe('FAILED')
    const issues = result.details?.issues as Array<{ path: string }>
    expect(
      issues?.some(issue => issue.path === 'expectedCoverage.minTestsForSecurity'),
    ).toBe(true)
  })
})
