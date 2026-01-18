import { describe, it, expect } from 'vitest'
import type { ValidationContext } from '../../../../src/types/index.js'
import type { ContractV1 } from '../../../../src/types/contract.types.js'
import { TestIntentAlignmentValidator } from '../../../../src/domain/validators/gate1/TestIntentAlignment.js'

const makeContext = ({
  contract,
  fileContent,
  taskPrompt = 'Ensure the login flow validates credentials and MFA',
}: {
  contract?: ContractV1
  fileContent: string
  taskPrompt?: string
}): ValidationContext => ({
  runId: 'intent-alignment',
  projectPath: '.',
  baseRef: 'origin/main',
  targetRef: 'HEAD',
  taskPrompt,
  manifest: null,
  testFilePath: 'src/tests/intent.spec.ts',
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
})

const contractBase = (): ContractV1 => ({
  schemaVersion: '1.0.0',
  slug: 'intent-contract',
  title: 'Intent coverage',
  mode: 'STRICT',
  changeType: 'new',
  targetArtifacts: ['src/tests/intent.spec.ts'],
  clauses: [
    {
      id: 'CL-INTENT-001',
      kind: 'behavior',
      normativity: 'SHOULD',
      title: 'Greet the user on login',
      spec: 'The login test should mention greeting the user after success',
      observables: ['ui'],
    },
  ],
})

describe('TestIntentAlignmentValidator', () => {
  it('warns when alignment is low without contract cues', async () => {
    const fileContent = `
      describe('misc', () => {
        it('runs a helper', () => {
          expect(true).toBe(true)
        })
      })
    `

    const result = await TestIntentAlignmentValidator.execute(
      makeContext({ fileContent, taskPrompt: 'Build the payment notification flow' }),
    )

    expect(result.status).toBe('WARNING')
  })

  it('passes and de-emphasizes warnings when clause tags exist', async () => {
    const contract = contractBase()
    const fileContent = `
      // @clause CL-INTENT-001
      it('logs a greeting', () => {
        expect(true).toBe(true)
      })
    `

    const result = await TestIntentAlignmentValidator.execute(
      makeContext({ contract, fileContent, taskPrompt: 'Build an onboarding flow with greetings' }),
    )

    expect(result.status).toBe('PASSED')
    expect(result.details?.alignmentDeemphasized).toBe(true)
    expect(result.details?.clauseTagCount).toBeGreaterThan(0)
  })
})
