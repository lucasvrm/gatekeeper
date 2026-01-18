import { describe, it, expect } from 'vitest'
import type { ValidationContext } from '../../../../src/types/index.js'
import type { ContractV1 } from '../../../../src/types/contract.types.js'
import { TestCoversHappyAndSadPathValidator } from '../../../../src/domain/validators/gate1/TestCoversHappyAndSadPath.js'

const makeContext = (
  contract: ContractV1 | undefined,
  fileContent: string,
  overrides: Partial<ValidationContext> = {},
): ValidationContext => {
  const baseContext: ValidationContext = {
    runId: 'run-test-covers',
    projectPath: '.',
    baseRef: 'origin/main',
    targetRef: 'HEAD',
    taskPrompt: 'Verify behavior coverage',
    manifest: null,
    testFilePath: 'src/tests/behavior.spec.ts',
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
    contractJson: contract ? JSON.stringify(contract) : undefined,
    contractParseError: undefined,
    ...overrides,
  }

  return baseContext
}

const baseContract = (): ContractV1 => ({
  schemaVersion: '1.0.0',
  slug: 'behavior-contract',
  title: 'Behavior contract',
  mode: 'STRICT',
  changeType: 'new',
  targetArtifacts: ['src/tests/behavior.spec.ts'],
  clauses: [
    {
      id: 'CL-BHV-001',
      kind: 'behavior',
      normativity: 'MUST',
      title: 'Ensure login handles both success and failure',
      spec: 'Login should accept valid credentials and reject invalid ones',
      observables: ['http'],
    },
  ],
})

describe('TestCoversHappyAndSadPathValidator', () => {
  it('fails when fallback check misses sad path without contract', async () => {
    const fileContent = `
      it('reports success', () => {
        expect(true).toBe(true)
      })
    `

    const result = await TestCoversHappyAndSadPathValidator.execute(makeContext(undefined, fileContent))
    expect(result.status).toBe('FAILED')
    expect(result.message).toContain('happy path')
  })

  it('fails when a behavior clause has no sad path coverage in STRICT', async () => {
    const contract = baseContract()
    const fileContent = `
      // @clause CL-BHV-001
      it('logs in successfully', () => {
        expect(true).toBe(true)
      })
    `

    const result = await TestCoversHappyAndSadPathValidator.execute(makeContext(contract, fileContent))
    expect(result.status).toBe('FAILED')
    expect(result.details?.missingClauseCoverage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ clauseId: 'CL-BHV-001', missing: 'sad' }),
      ]),
    )
  })

  it('passes when behavior clause has both happy and sad tests', async () => {
    const contract = baseContract()
    const fileContent = `
      // @clause CL-BHV-001
      it('logs in successfully', () => {
        expect(true).toBe(true)
      })
      // @clause CL-BHV-001
      it('fails when credentials are invalid', () => {
        expect(false).toBe(false)
      })
    `

    const result = await TestCoversHappyAndSadPathValidator.execute(makeContext(contract, fileContent))
    expect(result.status).toBe('PASSED')
  })

  it('emits a warning in CREATIVE mode when sad coverage is missing', async () => {
    const contract = {
      ...baseContract(),
      mode: 'CREATIVE',
    }
    const fileContent = `
      // @clause CL-BHV-001
      it('logs in successfully', () => {
        expect(true).toBe(true)
      })
    `

    const result = await TestCoversHappyAndSadPathValidator.execute(makeContext(contract, fileContent))
    expect(result.status).toBe('WARNING')
  })
})
