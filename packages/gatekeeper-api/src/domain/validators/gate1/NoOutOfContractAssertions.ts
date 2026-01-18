import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'
import type { AssertionTarget, ContractV1, TestAssertion } from '../../../types/contract.types.js'

const INFRA_ASSERTION_PATTERNS: Array<{ regex: RegExp; reason: string }> = [
  { regex: /\brender\s*\(/i, reason: 'render helper invocation' },
  { regex: /\bscreen\./i, reason: 'screen helper invocation' },
  { regex: /\bfireEvent\./i, reason: 'fireEvent helper invocation' },
  { regex: /\b(act|setup)\s*\(/i, reason: 'test helper setup call' },
  { regex: /\b(beforeEach|afterEach|beforeAll|afterAll)\b/i, reason: 'test lifecycle setup' },
]

const LOG_ASSERTION_PATTERNS: Array<{ regex: RegExp; reason: string }> = [
  { regex: /console\.(log|warn|info|error|debug)/i, reason: 'console logging assertion' },
  { regex: /\blogger\.[a-zA-Z_]+\(/i, reason: 'logger helper assertion' },
]

const getSkipReason = (assertion: TestAssertion): string | null => {
  const code = assertion.code
  for (const { regex, reason } of INFRA_ASSERTION_PATTERNS) {
    if (regex.test(code)) {
      return reason
    }
  }
  for (const { regex, reason } of LOG_ASSERTION_PATTERNS) {
    if (regex.test(code)) {
      return reason
    }
  }
  return null
}

const appendSkippedAssertionEvidence = (
  skipped: Array<{ assertion: TestAssertion; reason: string }>,
  lines: string[],
): void => {
  if (skipped.length === 0) {
    return
  }

  lines.push('', `Ignored ${skipped.length} helper assertion(s):`)
  const preview = skipped.slice(0, 5)
  preview.forEach(({ assertion, reason }) => {
    lines.push(`  - ${assertion.file}:${assertion.line} (${reason})`)
  })
  if (skipped.length > preview.length) {
    lines.push(`  ...and ${skipped.length - preview.length} more`)
  }
}
import { parseClauseTags } from '../../../utils/clauseTagParser.js'
import { parseAssertions, mapAssertionsToClauses, findUnmappedAssertions } from '../../../utils/assertionParser.js'

/**
 * NO_OUT_OF_CONTRACT_ASSERTIONS validator (T015, T018, T019, T024, T025, T028)
 *
 * Validates that all test assertions are mapped to contract clauses via @clause tags.
 * - SKIPPED if contract field is absent (T015)
 * - In STRICT mode: all assertions must be mapped (T018)
 * - In CREATIVE mode: allows unmapped assertions with WARNING (T019)
 * - Detects expect, assert, snapshot, mock, and structural assertions (T024, T025)
 * - Provides actionable error messages (T028)
 */
export const NoOutOfContractAssertionsValidator: ValidatorDefinition = {
  code: 'NO_OUT_OF_CONTRACT_ASSERTIONS',
  name: 'No Out-of-Contract Assertions',
  description: 'Valida que todas as asserções estão mapeadas a cláusulas do contrato',
  gate: 1,
  order: 4,
  isHardBlock: true, // Can be WARNING in CREATIVE mode (adjusted in execution)

  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    const contract = (ctx as unknown as { contract?: ContractV1 }).contract

    if (!contract) {
      return {
        passed: true,
        status: 'SKIPPED',
        message: 'No contract provided; validator skipped',
      }
    }

    if (!ctx.testFilePath) {
      return {
        passed: false,
        status: 'FAILED',
        message: 'No test file path provided',
      }
    }

    let testFileContent: string
    try {
      testFileContent = await ctx.services.git.readFile(ctx.testFilePath, ctx.targetRef)
    } catch (error) {
      return {
        passed: false,
        status: 'FAILED',
        message: `Failed to read test file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }

    const clauseTags = parseClauseTags(testFileContent, ctx.testFilePath)
    const parsedAssertions = parseAssertions(testFileContent, ctx.testFilePath)
    const skippedAssertions: Array<{ assertion: TestAssertion; reason: string }> = []
    const relevantAssertions = parsedAssertions.filter((assertion) => {
      const reason = getSkipReason(assertion)
      if (reason) {
        skippedAssertions.push({ assertion, reason })
        return false
      }
      return true
    })
    const mappedAssertions = mapAssertionsToClauses(relevantAssertions, clauseTags)
    const unmappedAssertions = findUnmappedAssertions(mappedAssertions)

    const totalAssertions = relevantAssertions.length
    const mappedCount = totalAssertions - unmappedAssertions.length
    const mappingPercent = totalAssertions > 0 ? (mappedCount / totalAssertions) * 100 : 100
    const parsedAssertionCount = parsedAssertions.length

    const assertionSurface = contract.assertionSurface
    const httpSurface = assertionSurface?.http
    const allowedEndpoints = new Set(
      (httpSurface?.endpoints ?? [])
        .map((endpoint) => `${(endpoint.method ?? 'GET').toUpperCase()} ${endpoint.path}`.toUpperCase()),
    )
    const allowedStatusCodes = new Set((httpSurface?.statusCodes ?? []).map((code) => String(code)))
    const endpointStatusCodes = new Map<string, Set<string>>()
    for (const [key, codes] of Object.entries(httpSurface?.endpointStatusCodes ?? {})) {
      endpointStatusCodes.set(key.toUpperCase(), new Set(codes.map((code) => String(code))))
    }
    const allowedErrorCodes = new Set(assertionSurface?.errors?.codes ?? [])
    const allowedPayloadPaths = new Set(assertionSurface?.payloadPaths ?? [])
    const allowedSelectors = new Set(Object.values(assertionSurface?.ui?.selectors ?? {}))

    const hasEndpointSurface = allowedEndpoints.size > 0
    const hasStatusSurface = allowedStatusCodes.size > 0 || endpointStatusCodes.size > 0
    const hasErrorSurface = allowedErrorCodes.size > 0
    const hasPayloadSurface = allowedPayloadPaths.size > 0
    const hasSelectorSurface = allowedSelectors.size > 0

    const surfaceViolations: Array<{ assertion: TestAssertion; target: AssertionTarget }> = []

    const isTargetAllowed = (target: AssertionTarget): boolean => {
      switch (target.type) {
        case 'endpoint': {
          if (!hasEndpointSurface) {
            return true
          }
          return allowedEndpoints.has(target.value.toUpperCase())
        }
        case 'statusCode': {
          if (!hasStatusSurface) {
            return true
          }
          const generalAllowed = allowedStatusCodes.has(target.value)
          if (generalAllowed) {
            return true
          }
          if (target.context) {
            const endpointCodes = endpointStatusCodes.get(target.context.toUpperCase())
            return endpointCodes?.has(target.value) ?? false
          }
          return false
        }
        case 'errorCode': {
          if (!hasErrorSurface) {
            return true
          }
          return allowedErrorCodes.has(target.value)
        }
        case 'payloadPath': {
          if (!hasPayloadSurface) {
            return true
          }
          return allowedPayloadPaths.has(target.value)
        }
        case 'selector': {
          if (!hasSelectorSurface) {
            return true
          }
          return allowedSelectors.has(target.value)
        }
        default:
          return true
      }
    }

    for (const assertion of mappedAssertions) {
      for (const target of assertion.targets) {
        if (!isTargetAllowed(target)) {
          surfaceViolations.push({ assertion, target })
        }
      }
    }

    const creative = contract.mode === 'CREATIVE'
    const hasMappingIssues = unmappedAssertions.length > 0
    const hasSurfaceIssues = surfaceViolations.length > 0


    if (!hasMappingIssues && !hasSurfaceIssues) {
      const successEvidenceLines = [
        `Assertion mapping: ${mappingPercent.toFixed(1)}% (${mappedCount}/${totalAssertions} assertions mapped)`,
        `Total @clause tags: ${clauseTags.length}`,
      ]
      appendSkippedAssertionEvidence(skippedAssertions, successEvidenceLines)
      successEvidenceLines.push('', 'Prefer extending the contract assertionSurface before relaxing tests.')

      return {
        passed: true,
        status: 'PASSED',
        message: `All ${totalAssertions} assertion(s) are mapped to contract clauses`,
        details: {
          totalAssertions,
          parsedAssertions: parsedAssertionCount,
          mappedAssertions: mappedCount,
          unmappedAssertions: 0,
          mappingPercent,
          contractMode: contract.mode,
          skippedAssertions: skippedAssertions.map(({ assertion, reason }) => ({
            file: assertion.file,
            line: assertion.line,
            type: assertion.type,
            reason,
          })),
          assertionTypes: {
            expect: parsedAssertions.filter((a) => a.type === 'expect').length,
            assert: parsedAssertions.filter((a) => a.type === 'assert').length,
            snapshot: parsedAssertions.filter((a) => a.type === 'snapshot').length,
            mock: parsedAssertions.filter((a) => a.type === 'mock').length,
            structural: parsedAssertions.filter((a) => a.type === 'structural').length,
          },
        },
        evidence: successEvidenceLines.join('\n'),
      }
    }

    const status = creative ? 'WARNING' : 'FAILED'
    const messageParts: string[] = []
    if (hasMappingIssues) {
      messageParts.push(`Found ${unmappedAssertions.length} unmapped assertion(s)`)
    }
    if (hasSurfaceIssues) {
      messageParts.push(`Found ${surfaceViolations.length} assertions outside assertionSurface`)
    }

    const evidenceLines: string[] = []
    if (hasMappingIssues) {
      evidenceLines.push(
        `Assertion mapping: ${mappingPercent.toFixed(1)}% (${mappedCount}/${totalAssertions} assertions mapped)`,
        '',
        `Unmapped assertions (${unmappedAssertions.length}):`,
        ...unmappedAssertions.map((assertion) =>
          `  - ${assertion.file}:${assertion.line} [${assertion.type}]: ${assertion.code.substring(0, 80)}${
            assertion.code.length > 80 ? '...' : ''
          }`,
        ),
      )
    }

    if (hasSurfaceIssues) {
      if (evidenceLines.length > 0) {
        evidenceLines.push('')
      }
      evidenceLines.push('Assertions referencing surfaces not declared in contract:')
      surfaceViolations.slice(0, 10).forEach(({ assertion, target }) => {
        const context = target.context ? ` (context: ${target.context})` : ''
        evidenceLines.push(
          `  - ${assertion.file}:${assertion.line} [${target.type}] ${target.value}${context}`,
        )
      })
      if (surfaceViolations.length > 10) {
        evidenceLines.push(`  ...and ${surfaceViolations.length - 10} more`)
      }
      evidenceLines.push(
        '',
        'Action required:',
        '  1. Extend the contract assertionSurface with the missing targets (endpoints, status codes, selectors, payload paths, or error codes).',
        '  2. Tag affected tests with @clause references and re-run validation.',
      )
    }

    evidenceLines.push('', `Mode: ${contract.mode} (${status === 'WARNING' ? 'warnings allowed' : 'strict enforcement'})`)
    appendSkippedAssertionEvidence(skippedAssertions, evidenceLines)
    evidenceLines.push('', 'Prefer extending the contract assertionSurface before relaxing tests.')

    return {
      passed: false,
      status,
      message: messageParts.join(' · '),
      details: {
        totalAssertions,
        parsedAssertions: parsedAssertionCount,
        mappedAssertions: mappedCount,
        unmappedAssertions: unmappedAssertions.length,
        mappingPercent,
        contractMode: contract.mode,
        skippedAssertions: skippedAssertions.map(({ assertion, reason }) => ({
          file: assertion.file,
          line: assertion.line,
          type: assertion.type,
          reason,
        })),
        surfaceViolations: surfaceViolations.map(({ assertion, target }) => ({
          clauseId: assertion.mappedClauses,
          line: assertion.line,
          type: target.type,
          value: target.value,
          context: target.context,
        })),
      },
      evidence: evidenceLines.join('\n'),
    }
  },
}
