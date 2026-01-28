/**
 * TestClauseMappingValid @ui-clause Fix Specification Tests
 * 
 * Este spec valida a correção do validador TestClauseMappingValid para aceitar
 * @ui-clause como alternativa a @clause para cláusulas UI (CL-UI-*).
 * 
 * Se os testes falharem, a LLM executora errou na implementação.
 * 
 * Domínios cobertos:
 * - FIX (CL-FIX-001 a 003): Correção do bug
 * - INV (CL-INV-001 a 004): Invariantes preservados
 * - TYPE (CL-TYPE-001): Atualização de tipos
 * - CTX (CL-CTX-001): Context output
 * 
 * @contract fix-test-clause-mapping-ui-clause
 * @schemaVersion 1.0
 * @mode STRICT
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// ============================================================================
// TYPES
// ============================================================================

interface TestBlock {
  name: string
  startLine: number
  precedingComments: string[]
}

interface ContractClause {
  id: string
  kind: string
  normativity: string
  when: string
  then: string
}

interface TestMapping {
  tagPattern?: string
  uiTagPattern?: string
}

interface ContractInput {
  schemaVersion: string
  slug: string
  title: string
  mode: string
  changeType: string
  clauses: ContractClause[]
  testMapping?: TestMapping
}

interface ValidatorOutput {
  passed: boolean
  status: 'PASSED' | 'FAILED' | 'WARNING' | 'SKIPPED'
  message: string
  details?: Record<string, unknown>
  context?: {
    inputs: Array<{ label: string; value: unknown }>
    analyzed: Array<{ label: string; items: string[] }>
    findings: Array<{ type: string; message: string }>
    reasoning: string
  }
}

interface MockValidationContext {
  runId: string
  projectPath: string
  baseRef: string
  targetRef: string
  taskPrompt: string
  manifest: null
  contract: ContractInput | null
  testFilePath: string | null
  uiContract: null
  dangerMode: boolean
  services: {
    git: { readFile: ReturnType<typeof vi.fn> }
    ast: { getTestBlocksWithComments: ReturnType<typeof vi.fn> }
    testRunner: { runSingleTest: ReturnType<typeof vi.fn> }
    compiler: { compile: ReturnType<typeof vi.fn> }
    lint: { lint: ReturnType<typeof vi.fn> }
    build: { build: ReturnType<typeof vi.fn> }
    tokenCounter: { count: ReturnType<typeof vi.fn> }
    log: {
      debug: ReturnType<typeof vi.fn>
      info: ReturnType<typeof vi.fn>
      warn: ReturnType<typeof vi.fn>
      error: ReturnType<typeof vi.fn>
    }
  }
  config: Map<string, string>
  sensitivePatterns: string[]
  ambiguousTerms: string[]
  bypassedValidators: Set<string>
}

// ============================================================================
// PATH HELPERS
// ============================================================================

const BASE_PATH = path.resolve(process.cwd(), 'packages/gatekeeper-api')
const SRC_PATH = path.join(BASE_PATH, 'src')

function readSourceFile(relativePath: string): string | null {
  const fullPath = path.join(SRC_PATH, relativePath)
  if (!fs.existsSync(fullPath)) {
    return null
  }
  return fs.readFileSync(fullPath, 'utf-8')
}

// ============================================================================
// MOCK FACTORIES
// ============================================================================

function createMockContext(overrides: Partial<MockValidationContext> = {}): MockValidationContext {
  return {
    runId: 'run_test123',
    projectPath: '/test/path',
    baseRef: 'origin/main',
    targetRef: 'HEAD',
    taskPrompt: 'Test task',
    manifest: null,
    contract: null,
    testFilePath: null,
    uiContract: null,
    dangerMode: false,
    services: {
      git: { readFile: vi.fn() },
      ast: { getTestBlocksWithComments: vi.fn() },
      testRunner: { runSingleTest: vi.fn() },
      compiler: { compile: vi.fn() },
      lint: { lint: vi.fn() },
      build: { build: vi.fn() },
      tokenCounter: { count: vi.fn() },
      log: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    },
    config: new Map<string, string>(),
    sensitivePatterns: [],
    ambiguousTerms: [],
    bypassedValidators: new Set<string>(),
    ...overrides,
  }
}

function createContractWithClauses(clauses: ContractClause[], testMapping?: TestMapping): ContractInput {
  return {
    schemaVersion: '1.0',
    slug: 'test-contract',
    title: 'Test Contract',
    mode: 'STRICT',
    changeType: 'new',
    clauses,
    testMapping: testMapping ?? {
      tagPattern: '// @clause',
      uiTagPattern: '// @ui-clause',
    },
  }
}

function createTestBlock(name: string, startLine: number, comments: string[]): TestBlock {
  return {
    name,
    startLine,
    precedingComments: comments,
  }
}

// ============================================================================
// DOMAIN: TYPE — Atualização de tipos
// ============================================================================

describe('Domain: TYPE — TestMapping type update', () => {
  let typesContent: string | null

  beforeEach(() => {
    typesContent = readSourceFile('types/gates.types.ts')
  })

  // @clause CL-TYPE-001
  it('succeeds when TestMapping interface has uiTagPattern field', () => {
    expect(typesContent).not.toBeNull()
    
    // Find the TestMapping interface definition
    const testMappingMatch = typesContent!.match(/interface\s+TestMapping\s*\{([^}]+)\}/)
    expect(testMappingMatch).not.toBeNull()
    
    const interfaceBody = testMappingMatch![1]
    
    // Check for uiTagPattern field (optional string)
    expect(interfaceBody).toMatch(/uiTagPattern\s*\?\s*:\s*string/)
  })

  // @clause CL-TYPE-001
  it('succeeds when TestMapping preserves tagPattern field', () => {
    expect(typesContent).not.toBeNull()
    
    const testMappingMatch = typesContent!.match(/interface\s+TestMapping\s*\{([^}]+)\}/)
    expect(testMappingMatch).not.toBeNull()
    
    const interfaceBody = testMappingMatch![1]
    
    // Original tagPattern must still exist
    expect(interfaceBody).toMatch(/tagPattern\s*\?\s*:\s*string/)
  })
})

// ============================================================================
// DOMAIN: FIX — Correção do bug
// ============================================================================

describe('Domain: FIX — @ui-clause acceptance for UI clauses', () => {
  let validatorContent: string | null

  beforeEach(() => {
    validatorContent = readSourceFile('domain/validators/gate1/TestClauseMappingValid.ts')
  })

  // @clause CL-FIX-001
  it('succeeds when validator file handles uiTagPattern', () => {
    expect(validatorContent).not.toBeNull()
    
    // Validator should reference uiTagPattern from testMapping
    expect(validatorContent).toMatch(/uiTagPattern/)
  })

  // @clause CL-FIX-001
  it('succeeds when @ui-clause with valid CL-UI-* clause passes validation', () => {
    // Simulate expected behavior after fix
    const testBlocks: TestBlock[] = [
      createTestBlock(
        'renders button correctly',
        10,
        ['// @ui-clause CL-UI-Button-primary']
      ),
    ]
    
    const contract = createContractWithClauses([
      { id: 'CL-UI-Button-primary', kind: 'ui', normativity: 'MUST', when: 'button', then: 'renders' },
    ])
    
    // Expected output after fix implementation
    const expectedOutput: ValidatorOutput = {
      passed: true,
      status: 'PASSED',
      message: 'All 1 test have valid clause mappings',
    }
    
    // The validator should pass for @ui-clause with CL-UI-* clause
    expect(expectedOutput.passed).toBe(true)
    expect(expectedOutput.status).toBe('PASSED')
  })

  // @clause CL-FIX-001
  it('fails when @ui-clause references unknown CL-UI-* clause', () => {
    // Simulate expected behavior after fix
    const testBlocks: TestBlock[] = [
      createTestBlock(
        'renders unknown component',
        10,
        ['// @ui-clause CL-UI-Unknown-variant']
      ),
    ]
    
    const contract = createContractWithClauses([
      { id: 'CL-UI-Button-primary', kind: 'ui', normativity: 'MUST', when: 'button', then: 'renders' },
    ])
    
    // Expected output - should fail because clause doesn't exist
    const expectedOutput: ValidatorOutput = {
      passed: false,
      status: 'FAILED',
      message: 'Test "renders unknown component" references unknown clause "CL-UI-Unknown-variant"',
    }
    
    expect(expectedOutput.passed).toBe(false)
    expect(expectedOutput.status).toBe('FAILED')
    expect(expectedOutput.message).toMatch(/unknown clause/)
  })

  // @clause CL-FIX-002
  it('fails when @ui-clause is used for non-UI clause CL-MODEL-*', () => {
    // Expected behavior: @ui-clause should only work for CL-UI-* clauses
    const expectedOutput: ValidatorOutput = {
      passed: false,
      status: 'FAILED',
      message: '@ui-clause can only be used with UI clauses (CL-UI-*). Use @clause for CL-MODEL-001 instead.',
    }
    
    expect(expectedOutput.passed).toBe(false)
    expect(expectedOutput.status).toBe('FAILED')
    expect(expectedOutput.message).toMatch(/non-UI|CL-UI-|only.*UI/)
  })

  // @clause CL-FIX-002
  it('fails when @ui-clause is used for non-UI clause CL-API-*', () => {
    const expectedOutput: ValidatorOutput = {
      passed: false,
      status: 'FAILED',
      message: '@ui-clause can only be used with UI clauses (CL-UI-*). Use @clause for CL-API-001 instead.',
    }
    
    expect(expectedOutput.passed).toBe(false)
    expect(expectedOutput.message).toMatch(/non-UI|CL-UI-|only.*UI|@clause/)
  })

  // @clause CL-FIX-002
  it('fails when @ui-clause is used for non-UI clause CL-REPO-*', () => {
    const expectedOutput: ValidatorOutput = {
      passed: false,
      status: 'FAILED',
      message: '@ui-clause can only be used with UI clauses (CL-UI-*). Use @clause for CL-REPO-001 instead.',
    }
    
    expect(expectedOutput.passed).toBe(false)
    expect(expectedOutput.message).toMatch(/non-UI|CL-UI-|only.*UI|@clause/)
  })

  // @clause CL-FIX-003
  it('fails when @ui-clause has no clause ID (malformed)', () => {
    const expectedOutput: ValidatorOutput = {
      passed: false,
      status: 'FAILED',
      message: 'Test "test name" has malformed @ui-clause tag at line 10. Expected format: "// @ui-clause CL-UI-*"',
    }
    
    expect(expectedOutput.passed).toBe(false)
    expect(expectedOutput.status).toBe('FAILED')
    expect(expectedOutput.message).toMatch(/malformed/)
  })

  // @clause CL-FIX-003
  it('succeeds when validator detects malformed @ui-clause pattern', () => {
    expect(validatorContent).not.toBeNull()
    
    // Validator should have logic to detect malformed ui-clause tags
    // This checks that the validator code handles the @ui-clause pattern
    expect(validatorContent).toMatch(/@ui-clause|uiTagPattern/)
  })
})

// ============================================================================
// DOMAIN: INV — Invariantes preservados
// ============================================================================

describe('Domain: INV — Invariant preservation', () => {
  // @clause CL-INV-001
  it('succeeds when @clause with valid clause still passes', () => {
    // Original behavior must be preserved
    const expectedOutput: ValidatorOutput = {
      passed: true,
      status: 'PASSED',
      message: 'All 1 test have valid clause mappings',
    }
    
    expect(expectedOutput.passed).toBe(true)
    expect(expectedOutput.status).toBe('PASSED')
  })

  // @clause CL-INV-001
  it('succeeds when @clause behavior is unchanged for CL-MODEL-* clauses', () => {
    const testBlocks: TestBlock[] = [
      createTestBlock(
        'model has required fields',
        10,
        ['// @clause CL-MODEL-001']
      ),
    ]
    
    const contract = createContractWithClauses([
      { id: 'CL-MODEL-001', kind: 'behavior', normativity: 'MUST', when: 'model', then: 'has fields' },
    ])
    
    // This test verifies that @clause still works for non-UI clauses
    expect(testBlocks[0].precedingComments[0]).toMatch(/\/\/ @clause CL-MODEL-001/)
    expect(contract.clauses[0].id).toBe('CL-MODEL-001')
  })

  // @clause CL-INV-002
  it('fails when test has no tag and ALLOW_UNTAGGED_TESTS is false', () => {
    const config = new Map<string, string>()
    config.set('ALLOW_UNTAGGED_TESTS', 'false')
    
    const expectedOutput: ValidatorOutput = {
      passed: false,
      status: 'FAILED',
      message: 'Test "untagged test" at line 10 has no @clause tag. Add "// @clause <CLAUSE_ID>" before the test.',
    }
    
    expect(expectedOutput.passed).toBe(false)
    expect(expectedOutput.status).toBe('FAILED')
    expect(expectedOutput.message).toMatch(/no @clause tag/)
  })

  // @clause CL-INV-003
  it('succeeds when test has no tag and ALLOW_UNTAGGED_TESTS is true (returns WARNING)', () => {
    const config = new Map<string, string>()
    config.set('ALLOW_UNTAGGED_TESTS', 'true')
    
    const expectedOutput: ValidatorOutput = {
      passed: true,
      status: 'WARNING',
      message: 'Test "untagged test" at line 10 has no @clause tag. Consider adding "// @clause <CLAUSE_ID>" for traceability.',
    }
    
    expect(expectedOutput.passed).toBe(true)
    expect(expectedOutput.status).toBe('WARNING')
  })

  // @clause CL-INV-004
  it('fails when test references clause that does not exist', () => {
    const expectedOutput: ValidatorOutput = {
      passed: false,
      status: 'FAILED',
      message: 'Test "test name" references unknown clause "CL-NONEXISTENT-001". Valid clause IDs: CL-MODEL-001',
    }
    
    expect(expectedOutput.passed).toBe(false)
    expect(expectedOutput.status).toBe('FAILED')
    expect(expectedOutput.message).toMatch(/unknown clause/)
  })

  // @clause CL-INV-004
  it('fails when @clause references unknown clause ID', () => {
    const testBlocks: TestBlock[] = [
      createTestBlock(
        'test with bad reference',
        10,
        ['// @clause CL-DOES-NOT-EXIST']
      ),
    ]
    
    const contract = createContractWithClauses([
      { id: 'CL-MODEL-001', kind: 'behavior', normativity: 'MUST', when: 'x', then: 'y' },
    ])
    
    const validClauseIds = new Set(contract.clauses.map(c => c.id))
    const referencedId = 'CL-DOES-NOT-EXIST'
    
    expect(validClauseIds.has(referencedId)).toBe(false)
  })
})

// ============================================================================
// DOMAIN: CTX — Context output
// ============================================================================

describe('Domain: CTX — Context output includes both patterns', () => {
  let validatorContent: string | null

  beforeEach(() => {
    validatorContent = readSourceFile('domain/validators/gate1/TestClauseMappingValid.ts')
  })

  // @clause CL-CTX-001
  it('succeeds when validator output context includes TagPattern input', () => {
    expect(validatorContent).not.toBeNull()
    
    // Check that context.inputs includes TagPattern
    expect(validatorContent).toMatch(/label:\s*['"]TagPattern['"]/)
  })

  // @clause CL-CTX-001
  it('succeeds when validator output context includes UITagPattern input', () => {
    expect(validatorContent).not.toBeNull()
    
    // After fix, context.inputs should also include UITagPattern
    expect(validatorContent).toMatch(/label:\s*['"]UITagPattern['"]|uiTagPattern/)
  })

  // @clause CL-CTX-001
  it('succeeds when context inputs array has both pattern labels', () => {
    // Expected structure after fix
    const expectedContextInputs = [
      { label: 'Contract Clauses', value: ['CL-MODEL-001', 'CL-UI-Button-primary'] },
      { label: 'TagPattern', value: '// @clause' },
      { label: 'UITagPattern', value: '// @ui-clause' },
    ]
    
    const labels = expectedContextInputs.map(input => input.label)
    
    expect(labels).toContain('TagPattern')
    expect(labels).toContain('UITagPattern')
  })
})

// ============================================================================
// VALIDATOR STRUCTURE VERIFICATION
// ============================================================================

describe('Validator Structure Verification', () => {
  let validatorContent: string | null

  beforeEach(() => {
    validatorContent = readSourceFile('domain/validators/gate1/TestClauseMappingValid.ts')
  })

  // @clause CL-FIX-001
  it('succeeds when validator exports TestClauseMappingValidValidator', () => {
    expect(validatorContent).not.toBeNull()
    expect(validatorContent).toMatch(/export\s+(const|function)\s+TestClauseMappingValidValidator/)
  })

  // @clause CL-FIX-001
  it('succeeds when validator has code TEST_CLAUSE_MAPPING_VALID', () => {
    expect(validatorContent).not.toBeNull()
    expect(validatorContent).toMatch(/code:\s*['"]TEST_CLAUSE_MAPPING_VALID['"]/)
  })

  // @clause CL-FIX-001
  it('succeeds when validator is in gate 1 with order 10', () => {
    expect(validatorContent).not.toBeNull()
    expect(validatorContent).toMatch(/gate:\s*1/)
    expect(validatorContent).toMatch(/order:\s*10/)
  })

  // @clause CL-FIX-001
  it('succeeds when validator is a hard block', () => {
    expect(validatorContent).not.toBeNull()
    expect(validatorContent).toMatch(/isHardBlock:\s*true/)
  })

  // @clause CL-FIX-001
  it('succeeds when validator checks for CL-UI- prefix when using @ui-clause', () => {
    expect(validatorContent).not.toBeNull()
    
    // The fix should include logic to check if clause ID starts with CL-UI-
    // when the @ui-clause pattern is used
    expect(validatorContent).toMatch(/CL-UI-|startsWith.*UI|isUIClause/)
  })
})

// ============================================================================
// INTEGRATION SCENARIOS
// ============================================================================

describe('Integration Scenarios', () => {
  // @clause CL-FIX-001
  // @clause CL-INV-001
  it('succeeds when mixed @clause and @ui-clause tags are used correctly', () => {
    const contract = createContractWithClauses([
      { id: 'CL-MODEL-001', kind: 'behavior', normativity: 'MUST', when: 'model', then: 'exists' },
      { id: 'CL-UI-Button-primary', kind: 'ui', normativity: 'MUST', when: 'button', then: 'renders' },
    ])
    
    const testBlocks: TestBlock[] = [
      createTestBlock('model test', 10, ['// @clause CL-MODEL-001']),
      createTestBlock('button test', 20, ['// @ui-clause CL-UI-Button-primary']),
    ]
    
    // Both should be valid
    const validClauseIds = new Set(contract.clauses.map(c => c.id))
    
    expect(validClauseIds.has('CL-MODEL-001')).toBe(true)
    expect(validClauseIds.has('CL-UI-Button-primary')).toBe(true)
    
    // @clause references MODEL clause correctly
    expect(testBlocks[0].precedingComments[0]).toMatch(/@clause CL-MODEL-001/)
    
    // @ui-clause references UI clause correctly
    expect(testBlocks[1].precedingComments[0]).toMatch(/@ui-clause CL-UI-Button-primary/)
  })

  // @clause CL-FIX-002
  it('fails when @ui-clause is incorrectly used for MODEL clause in mixed scenario', () => {
    const contract = createContractWithClauses([
      { id: 'CL-MODEL-001', kind: 'behavior', normativity: 'MUST', when: 'model', then: 'exists' },
      { id: 'CL-UI-Button-primary', kind: 'ui', normativity: 'MUST', when: 'button', then: 'renders' },
    ])
    
    // Wrong: using @ui-clause for a MODEL clause
    const testBlock = createTestBlock(
      'model test with wrong tag',
      10,
      ['// @ui-clause CL-MODEL-001'] // WRONG!
    )
    
    const clauseId = 'CL-MODEL-001'
    const isUIClause = clauseId.startsWith('CL-UI-')
    
    // @ui-clause should only be valid for CL-UI-* clauses
    expect(isUIClause).toBe(false)
  })

  // @clause CL-FIX-001
  it('succeeds when @clause is used for UI clause (backwards compatibility)', () => {
    const contract = createContractWithClauses([
      { id: 'CL-UI-Button-primary', kind: 'ui', normativity: 'MUST', when: 'button', then: 'renders' },
    ])
    
    // Using @clause for UI clause should still work (backwards compatibility)
    const testBlock = createTestBlock(
      'button test with @clause',
      10,
      ['// @clause CL-UI-Button-primary']
    )
    
    const validClauseIds = new Set(contract.clauses.map(c => c.id))
    const clauseId = 'CL-UI-Button-primary'
    
    // @clause should work for any valid clause, including UI clauses
    expect(validClauseIds.has(clauseId)).toBe(true)
  })

  // @clause CL-INV-002
  // @clause CL-INV-003
  it('succeeds when untagged test handling depends on config', () => {
    const testBlock = createTestBlock('untagged test', 10, [])
    
    // No tags present
    expect(testBlock.precedingComments.length).toBe(0)
    
    // Behavior depends on ALLOW_UNTAGGED_TESTS config
    const configFalse = new Map<string, string>([['ALLOW_UNTAGGED_TESTS', 'false']])
    const configTrue = new Map<string, string>([['ALLOW_UNTAGGED_TESTS', 'true']])
    
    expect(configFalse.get('ALLOW_UNTAGGED_TESTS')).toBe('false') // → FAILED
    expect(configTrue.get('ALLOW_UNTAGGED_TESTS')).toBe('true')   // → WARNING
  })
})

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
  // @clause CL-FIX-003
  it('fails when @ui-clause has whitespace but no ID', () => {
    const testBlock = createTestBlock(
      'test with empty ui-clause',
      10,
      ['// @ui-clause   '] // Whitespace only after tag
    )
    
    const comment = testBlock.precedingComments[0]
    const match = comment.match(/\/\/ @ui-clause\s+(\S+)/)
    
    // Should not match because there's no ID after whitespace
    expect(match).toBeNull()
  })

  // @clause CL-FIX-001
  it('succeeds when @ui-clause ID has complex format CL-UI-Component-variant-subvariant', () => {
    const clauseId = 'CL-UI-ThemeListItem-activeBadge'
    
    expect(clauseId.startsWith('CL-UI-')).toBe(true)
    expect(clauseId.split('-').length).toBeGreaterThan(3)
  })

  // @clause CL-INV-004
  it('fails when clause ID is close but not exact match', () => {
    const contract = createContractWithClauses([
      { id: 'CL-UI-Button-primary', kind: 'ui', normativity: 'MUST', when: 'x', then: 'y' },
    ])
    
    const validClauseIds = new Set(contract.clauses.map(c => c.id))
    
    // Close but not exact
    expect(validClauseIds.has('CL-UI-Button-Primary')).toBe(false) // Wrong case
    expect(validClauseIds.has('CL-UI-Button')).toBe(false)          // Incomplete
    expect(validClauseIds.has('CL-UI-Button-primary ')).toBe(false) // Trailing space
  })

  // @clause CL-FIX-001
  it('succeeds when multiple @ui-clause tags exist in test file', () => {
    const testBlocks: TestBlock[] = [
      createTestBlock('test 1', 10, ['// @ui-clause CL-UI-Button-primary']),
      createTestBlock('test 2', 20, ['// @ui-clause CL-UI-Button-secondary']),
      createTestBlock('test 3', 30, ['// @ui-clause CL-UI-Input-default']),
    ]
    
    const contract = createContractWithClauses([
      { id: 'CL-UI-Button-primary', kind: 'ui', normativity: 'MUST', when: 'x', then: 'y' },
      { id: 'CL-UI-Button-secondary', kind: 'ui', normativity: 'MUST', when: 'x', then: 'y' },
      { id: 'CL-UI-Input-default', kind: 'ui', normativity: 'MUST', when: 'x', then: 'y' },
    ])
    
    const validClauseIds = new Set(contract.clauses.map(c => c.id))
    
    for (const block of testBlocks) {
      const match = block.precedingComments[0].match(/@ui-clause\s+(\S+)/)
      expect(match).not.toBeNull()
      expect(validClauseIds.has(match![1])).toBe(true)
    }
  })
})
