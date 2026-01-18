import { FieldDefinition, FieldPriority, FieldValidationResult } from '../types.js'
import { ElicitationState } from '../../types/elicitor.types.js'

/**
 * T162-T171: Contract-specific validation rules.
 * These rules ensure contracts have sufficient information for validation.
 */
export class ContractRules {
  /**
   * T162: Check if contract has sufficient information to assemble assertionSurface.
   * In STRICT mode, observables are required for all clauses.
   */
  static validateAssertionSurface(state: ElicitationState): FieldValidationResult {
    if (!state.clauses || state.clauses.length === 0) {
      return { score: 100, isFilled: true, isValid: true }
    }

    // Check if STRICT mode
    const isStrict = state.contractMode === 'STRICT'

    let totalClauses = 0
    let clausesWithObservables = 0

    for (const clause of state.clauses) {
      totalClauses++
      if (clause.observables && clause.observables.length > 0) {
        clausesWithObservables++
      }
    }

    if (isStrict && clausesWithObservables < totalClauses) {
      return {
        score: (clausesWithObservables / totalClauses) * 100,
        isFilled: false,
        isValid: false,
        message: `STRICT mode requires all clauses to have observables. ${totalClauses - clausesWithObservables} clause(s) missing observables.`,
      }
    }

    return {
      score: 100,
      isFilled: true,
      isValid: true,
    }
  }

  /**
   * T163: Verify clauses exist and have testRequired information.
   * testRequired is derived from normativity: MUST/SHOULD → true, MAY → false
   */
  static validateClausesExist(clauses: unknown): FieldValidationResult {
    if (!Array.isArray(clauses)) {
      return {
        score: 0,
        isFilled: false,
        isValid: false,
        message: 'Contract requires at least one clause',
      }
    }

    if (clauses.length === 0) {
      return {
        score: 0,
        isFilled: false,
        isValid: false,
        message: 'Contract requires at least one clause',
      }
    }

    // Verify each clause has normativity (which determines testRequired)
    let clausesWithNormativity = 0
    for (const clause of clauses) {
      if (clause && typeof clause === 'object' && 'normativity' in clause) {
        clausesWithNormativity++
      }
    }

    if (clausesWithNormativity < clauses.length) {
      return {
        score: (clausesWithNormativity / clauses.length) * 100,
        isFilled: true,
        isValid: false,
        message: `${clauses.length - clausesWithNormativity} clause(s) missing normativity (MUST/SHOULD/MAY)`,
      }
    }

    return {
      score: 100,
      isFilled: true,
      isValid: true,
    }
  }

  /**
   * T165: API endpoints must have at least 1 happy path and 1 sad path clause.
   */
  static validateAPIHappyAndSadPaths(state: ElicitationState): FieldValidationResult {
    if (!state.clauses || state.clauses.length === 0) {
      return {
        score: 0,
        isFilled: false,
        isValid: false,
        message: 'API endpoint requires at least one behavior clause (happy path) and one error clause (sad path)',
      }
    }

    const behaviorClauses = state.clauses.filter(c => c.kind === 'behavior')
    const errorClauses = state.clauses.filter(c => c.kind === 'error')

    if (behaviorClauses.length === 0) {
      return {
        score: 50,
        isFilled: false,
        isValid: false,
        message: 'API endpoint requires at least one behavior clause (happy path)',
      }
    }

    if (errorClauses.length === 0) {
      return {
        score: 50,
        isFilled: false,
        isValid: false,
        message: 'API endpoint requires at least one error clause (sad path)',
      }
    }

    return {
      score: 100,
      isFilled: true,
      isValid: true,
    }
  }

  /**
   * T167: Observable errors should use error.codes, not messages.
   */
  static validateErrorCodeUsage(state: ElicitationState): FieldValidationResult {
    if (!state.clauses || state.clauses.length === 0) {
      return { score: 100, isFilled: true, isValid: true }
    }

    const errorClauses = state.clauses.filter(c => c.kind === 'error')
    if (errorClauses.length === 0) {
      return { score: 100, isFilled: true, isValid: true }
    }

    // Check if error clauses have outputs with status/code instead of message
    let properErrorHandling = 0
    for (const clause of errorClauses) {
      if (clause.outputs) {
        const hasStatusOrCode = Object.keys(clause.outputs).some(
          key => key.toLowerCase().includes('status') || key.toLowerCase().includes('code')
        )
        if (hasStatusOrCode) {
          properErrorHandling++
        }
      }
    }

    if (properErrorHandling < errorClauses.length) {
      return {
        score: (properErrorHandling / errorClauses.length) * 100,
        isFilled: true,
        isValid: false,
        message: 'Error clauses should specify status codes or error codes in outputs, not just messages',
      }
    }

    return {
      score: 100,
      isFilled: true,
      isValid: true,
    }
  }

  /**
   * T169: Prohibit clauses without observables (non-testable clauses).
   */
  static validateNoUntestableClauses(state: ElicitationState): FieldValidationResult {
    if (!state.clauses || state.clauses.length === 0) {
      return { score: 100, isFilled: true, isValid: true }
    }

    const untestableClauses = state.clauses.filter(
      c => !c.observables || c.observables.length === 0
    )

    if (untestableClauses.length > 0) {
      return {
        score: ((state.clauses.length - untestableClauses.length) / state.clauses.length) * 100,
        isFilled: true,
        isValid: false,
        message: `${untestableClauses.length} clause(s) have no observables (untestable). Every clause must specify where behavior can be observed.`,
      }
    }

    return {
      score: 100,
      isFilled: true,
      isValid: true,
    }
  }

  /**
   * T170: Ensure granularity - don't group everything in 1 clause.
   * Minimum 2 clauses for non-trivial tasks.
   */
  static validateGranularity(state: ElicitationState, minClauses = 2): FieldValidationResult {
    if (!state.clauses) {
      return {
        score: 0,
        isFilled: false,
        isValid: false,
        message: 'Contract requires clauses',
      }
    }

    if (state.clauses.length < minClauses) {
      return {
        score: (state.clauses.length / minClauses) * 100,
        isFilled: true,
        isValid: false,
        message: `Contract has ${state.clauses.length} clause(s). Consider breaking down into at least ${minClauses} clauses for better granularity.`,
      }
    }

    return {
      score: 100,
      isFilled: true,
      isValid: true,
    }
  }

  /**
   * T171: Limit clause count to avoid explosion.
   * Max 20 clauses per contract (soft limit, warning only).
   */
  static validateClauseLimit(state: ElicitationState, maxClauses = 20): FieldValidationResult {
    if (!state.clauses) {
      return { score: 100, isFilled: true, isValid: true }
    }

    if (state.clauses.length > maxClauses) {
      return {
        score: 100,
        isFilled: true,
        isValid: false,
        message: `Contract has ${state.clauses.length} clauses (max recommended: ${maxClauses}). Consider consolidating related clauses.`,
      }
    }

    return {
      score: 100,
      isFilled: true,
      isValid: true,
    }
  }

  /**
   * T164: Get minimum mandatory clauses for task type.
   */
  static getMinimumClausesByType(taskType: string): { behavior: number; error: number } {
    switch (taskType) {
      case 'API_ENDPOINT':
        return { behavior: 1, error: 1 } // T165: at least 1 happy and 1 sad
      case 'UI_COMPONENT':
        return { behavior: 1, error: 1 }
      case 'FEATURE':
        return { behavior: 2, error: 1 } // More complex, multiple behaviors
      case 'AUTH':
        return { behavior: 1, error: 1 }
      case 'DATA':
        return { behavior: 1, error: 1 }
      default:
        return { behavior: 1, error: 0 }
    }
  }

  /**
   * T164: Validate minimum clause requirements by type.
   */
  static validateMinimumClauses(state: ElicitationState): FieldValidationResult {
    if (!state.clauses || state.clauses.length === 0) {
      return {
        score: 0,
        isFilled: false,
        isValid: false,
        message: 'Contract requires clauses',
      }
    }

    const required = this.getMinimumClausesByType(state.type)
    const behaviorCount = state.clauses.filter(c => c.kind === 'behavior').length
    const errorCount = state.clauses.filter(c => c.kind === 'error').length

    const issues: string[] = []

    if (behaviorCount < required.behavior) {
      issues.push(`Needs ${required.behavior - behaviorCount} more behavior clause(s)`)
    }

    if (errorCount < required.error) {
      issues.push(`Needs ${required.error - errorCount} more error clause(s)`)
    }

    if (issues.length > 0) {
      const totalNeeded = required.behavior + required.error
      const totalHas = behaviorCount + errorCount
      return {
        score: (totalHas / totalNeeded) * 100,
        isFilled: true,
        isValid: false,
        message: issues.join('; '),
      }
    }

    return {
      score: 100,
      isFilled: true,
      isValid: true,
    }
  }

  /**
   * Get all contract validation field definitions for a task type.
   * These can be added to existing task rules.
   */
  static getContractFieldDefinitions(taskType: string): FieldDefinition[] {
    const fields: FieldDefinition[] = [
      {
        name: 'Contract Clauses',
        path: 'clauses',
        priority: FieldPriority.CRITICAL,
        weight: 15,
        description: 'Contract must have clauses defining testable requirements',
        validator: ContractRules.validateClausesExist,
      },
      {
        name: 'Assertion Surface',
        path: 'clauses',
        priority: FieldPriority.CRITICAL,
        weight: 10,
        description: 'Clauses must have observables for testing (T162)',
        validator: (_value, state) => ContractRules.validateAssertionSurface(state),
      },
      {
        name: 'No Untestable Clauses',
        path: 'clauses',
        priority: FieldPriority.IMPORTANT,
        weight: 8,
        description: 'All clauses must be testable (have observables) (T169)',
        validator: (_value, state) => ContractRules.validateNoUntestableClauses(state),
      },
      {
        name: 'Minimum Clauses',
        path: 'clauses',
        priority: FieldPriority.IMPORTANT,
        weight: 10,
        description: `Minimum required clauses for ${taskType} (T164)`,
        validator: (_value, state) => ContractRules.validateMinimumClauses(state),
      },
      {
        name: 'Clause Granularity',
        path: 'clauses',
        priority: FieldPriority.OPTIONAL,
        weight: 5,
        description: 'Clauses should have appropriate granularity (T170)',
        validator: (_value, state) => ContractRules.validateGranularity(state),
      },
      {
        name: 'Clause Limit',
        path: 'clauses',
        priority: FieldPriority.OPTIONAL,
        weight: 2,
        description: 'Avoid too many clauses (T171)',
        validator: (_value, state) => ContractRules.validateClauseLimit(state),
      },
    ]

    // T165: API-specific validation
    if (taskType === 'API_ENDPOINT') {
      fields.push({
        name: 'API Happy and Sad Paths',
        path: 'clauses',
        priority: FieldPriority.CRITICAL,
        weight: 12,
        description: 'API endpoints must have at least one behavior and one error clause (T165)',
        validator: (_value, state) => ContractRules.validateAPIHappyAndSadPaths(state),
      })

      fields.push({
        name: 'Error Code Usage',
        path: 'clauses',
        priority: FieldPriority.IMPORTANT,
        weight: 6,
        description: 'Error clauses should specify codes/status, not just messages (T167)',
        validator: (_value, state) => ContractRules.validateErrorCodeUsage(state),
      })
    }

    return fields
  }
}
