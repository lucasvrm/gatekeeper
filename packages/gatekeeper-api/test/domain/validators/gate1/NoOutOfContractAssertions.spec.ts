import { describe, it, expect } from 'vitest'
import type { ValidationContext } from '../../../../src/types/index.js'
import type { ContractV1 } from '../../../../src/types/contract.types.js'
import { NoOutOfContractAssertionsValidator } from '../../../../src/domain/validators/gate1/NoOutOfContractAssertions.js'

const makeContext = (
  contract: ContractV1,
  fileContent: string,
  overrides: Partial<ValidationContext> = {},
): ValidationContext => {
  const baseContext: ValidationContext = {
    runId: 'run-no-out',
    projectPath: '.',
    baseRef: 'origin/main',
    targetRef: 'HEAD',
    taskPrompt: 'Check assertions',
    manifest: null,
    testFilePath: 'src/tests/noout.spec.ts',
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
  slug: 'no-out-assertions',
  title: 'No out-of-contract assertions',
  mode: 'STRICT',
  changeType: 'new',
  targetArtifacts: ['src/tests/noout.spec.ts'],
  clauses: [
    {
      id: 'CL-NOOUT-001',
      kind: 'behavior',
      normativity: 'MUST',
      title: 'Validate login surface',
      spec: 'Cover the login endpoint assertions',
      observables: ['http'],
    },
  ],
  assertionSurface: {
    http: {
      endpoints: [
        {
          method: 'POST',
          path: '/api/login',
        },
      ],
      statusCodes: [200],
      endpointStatusCodes: {
        'POST /api/login': [200, 400],
      },
    },
    errors: {
      codes: ['AUTH_FAILURE'],
    },
    payloadPaths: ['user.id', 'token'],
    ui: {
      selectors: {
        loginButton: '[data-testid="login-submit"]',
      },
    },
  },
})

describe('NoOutOfContractAssertionsValidator', () => {
  it('passes when assertions stay within the assertion surface', async () => {
    const contract = baseContract()
    const fileContent = `
    // @clause CL-NOOUT-001
    it('logs in', () => {
      await request(app).post('/api/login')
      expect(response.status).toBe(200)
      expect(response.body.user.id).toBeDefined()
      cy.get('[data-testid="login-submit"]').click()
    })
    `

    const result = await NoOutOfContractAssertionsValidator.execute(
      makeContext(contract, fileContent),
    )
    expect(result.status).toBe('PASSED')
  })

  it('fails when hitting an endpoint outside the assertion surface', async () => {
    const contract = baseContract()
    const fileContent = `
    // @clause CL-NOOUT-001
    it('calls a rogue endpoint', () => {
      await request(app).post('/api/unknown')
      expect(response.status).toBe(200)
    })
    `

    const result = await NoOutOfContractAssertionsValidator.execute(
      makeContext(contract, fileContent),
    )
    expect(result.status).toBe('FAILED')
    expect(result.evidence).toContain('Assertions referencing surfaces not declared in contract')
  })

  it('warns in creative mode when status code is not declared', async () => {
    const contract = {
      ...baseContract(),
      mode: 'CREATIVE',
    }
    const fileContent = `
    // @clause CL-NOOUT-001
    it('exposes unknown status', () => {
      await request(app).post('/api/login')
      expect(response.status).toBe(500)
    })
    `

    const result = await NoOutOfContractAssertionsValidator.execute(
      makeContext(contract, fileContent),
    )
    expect(result.status).toBe('WARNING')
  })

  it('fails when asserting payload paths not listed in the surface', async () => {
    const contract = baseContract()
    const fileContent = `
    // @clause CL-NOOUT-001
    it('reads unexpected payload', () => {
      await request(app).post('/api/login')
      expect(response.body.unexpected).toBeDefined()
    })
    `

    const result = await NoOutOfContractAssertionsValidator.execute(
      makeContext(contract, fileContent),
    )
    expect(result.status).toBe('FAILED')
    expect(result.details?.surfaceViolations?.length).toBeGreaterThan(0)
  })

  it('fails when selectors are not declared', async () => {
    const contract = baseContract()
    const fileContent = `
    // @clause CL-NOOUT-001
    it('uses unknown selector', () => {
      cy.get('[data-testid="unknown-button"]').click()
    })
    `

    const result = await NoOutOfContractAssertionsValidator.execute(
      makeContext(contract, fileContent),
    )
    expect(result.status).toBe('FAILED')
    expect(result.evidence).toContain('Assertions referencing surfaces not declared in contract')
  })

  it('skips render-based assertions when a valid assertion covers the surface', async () => {
    const contract = baseContract()
    const fileContent = `
    // @clause CL-NOOUT-001
    it('renders and checks status', () => {
      render(<Login />)
      expect(response.status).toBe(200)
      expect(render(<Login />)).toBeTruthy()
    })
    `

    const result = await NoOutOfContractAssertionsValidator.execute(
      makeContext(contract, fileContent),
    )
    expect(result.status).toBe('PASSED')
    expect(result.details?.skippedAssertions?.length).toBeGreaterThan(0)
  })

  it('skips helper log assertions even when alignment is low', async () => {
    const contract = baseContract()
    const fileContent = `
    // @clause CL-NOOUT-001
    it('logs info and checks payload', () => {
      console.log('debug info')
      expect(response.body.token).toBeDefined()
    })
    `

    const result = await NoOutOfContractAssertionsValidator.execute(
      makeContext(contract, fileContent),
    )
    expect(result.status).toBe('PASSED')
    expect(result.details?.skippedAssertions?.length).toBeGreaterThan(0)
  })
})
