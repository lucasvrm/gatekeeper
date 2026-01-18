/**
 * Contract-related types for structured contract validation.
 * Following T014-T029 decisions for contract schema and clause mapping.
 */

/**
 * Contract mode determines validation severity.
 * - STRICT: All validations are hard-block (FAILED stops run)
 * - CREATIVE: Coverage/mapping can be WARNING, more permissive
 */
export type ContractMode = 'STRICT' | 'CREATIVE'

/**
 * Clause type helps categorize different kinds of contract clauses.
 * Examples: ENDPOINT, UI, BUSINESS_LOGIC, ERROR_HANDLING, etc.
 */
export type ClauseType =
  | 'ENDPOINT'
  | 'UI'
  | 'BUSINESS_LOGIC'
  | 'ERROR_HANDLING'
  | 'INTEGRATION'
  | 'SIDE_EFFECT'
  | 'STRUCTURE'
  | 'OTHER'

/**
 * Represents a single contract clause.
 * ID format: CL-<TYPE>-<SEQUENCE> (e.g., CL-ENDPOINT-001)
 * IDs are immutable once created (T020)
 */
export interface ContractClause {
  /**
   * Unique identifier following format: CL-<TYPE>-<SEQUENCE>
   * Examples: CL-ENDPOINT-001, CL-UI-014
   */
  id: string

  /**
   * Human-readable description of what this clause validates
   */
  description: string

  /**
   * Optional type categorization for better organization
   */
  type?: ClauseType

  /**
   * Optional additional metadata (e.g., HTTP status codes, UI selectors)
   */
  metadata?: Record<string, unknown>
}

/**
 * Structured contract that can be validated against tests.
 * Optional field in plan.json (T014) - validators SKIP if absent (T015)
 */
export interface Contract {
  /**
   * Contract mode affects validation severity
   */
  mode: ContractMode

  /**
   * List of clauses that define the contract
   */
  clauses: ContractClause[]

  /**
   * Optional version for contract evolution tracking
   */
  version?: string

  /**
   * Optional metadata about contract generation
   */
  metadata?: {
    generatedBy?: string
    generatedAt?: string
    taskType?: string
  }
}

/**
 * Result of parsing clause tags from test files.
 * Tag format: // @clause CL-<TYPE>-<SEQUENCE> (T021)
 */
export interface ClauseTag {
  /**
   * The clause ID referenced in the tag
   */
  clauseId: string

  /**
   * File where the tag was found
   */
  file: string

  /**
   * Line number where the tag appears
   */
  line: number

  /**
   * The test block name (describe/it) this tag is associated with
   */
  testName?: string
}

/**
 * Assertion found in test code that needs contract validation.
 * Used by NO_OUT_OF_CONTRACT_ASSERTIONS validator.
 */
export interface TestAssertion {
  /**
   * Type of assertion (expect, assert, snapshot, etc.)
   */
  type: 'expect' | 'assert' | 'snapshot' | 'structural' | 'mock' | 'spy'

  /**
   * File where assertion was found
   */
  file: string

  /**
   * Line number of assertion
   */
  line: number

  /**
   * The actual assertion code
   */
  code: string

  /**
   * Clause IDs this assertion is mapped to (from nearby @clause tags)
   */
  mappedClauses: string[]

  /**
   * Test block name containing this assertion
   */
  testName?: string
}

/**
 * Coverage report for contract clauses.
 * Used by CONTRACT_CLAUSE_COVERAGE validator.
 */
export interface ClauseCoverageReport {
  /**
   * Total number of clauses in contract
   */
  totalClauses: number

  /**
   * Number of clauses with at least one test mapping
   */
  coveredClauses: number

  /**
   * Coverage percentage
   */
  coveragePercent: number

  /**
   * List of clause IDs that have no test coverage
   */
  uncoveredClauseIds: string[]

  /**
   * Mapping of clause ID to test locations
   */
  clauseToTests: Record<string, ClauseTag[]>
}
