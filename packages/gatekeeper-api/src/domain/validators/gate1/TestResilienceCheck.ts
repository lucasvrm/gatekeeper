import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'

// Default fragile patterns - implementation-dependent test patterns
const DEFAULT_FRAGILE_PATTERNS = [
  '.querySelector(',
  '.querySelectorAll(',
  '.getElementsByClassName(',
  '.getElementsByTagName(',
  '.getElementById(',
  '.className',
  '.innerHTML',
  '.outerHTML',
  '.style.',
  'container.firstChild',
  'container.children',
  'wrapper.find(',
  '.dive()',
  'toMatchSnapshot()',
  'toMatchInlineSnapshot()',
]

// Default resilient patterns - observable behavior-based test patterns
const DEFAULT_RESILIENT_PATTERNS = [
  'getByRole(',
  'getByText(',
  'getByLabelText(',
  'getByPlaceholderText(',
  'getByDisplayValue(',
  'getByAltText(',
  'getByTitle(',
  'getByTestId(',
  'findByRole(',
  'findByText(',
  'userEvent.',
  'screen.',
  'toBeVisible()',
  'toBeInTheDocument()',
  'toHaveTextContent(',
  'toHaveAccessibleName(',
  'toHaveAttribute(',
]

// Indicators that a test file is a UI test
const UI_TEST_INDICATORS = [
  'render(',
  'screen.',
  '@testing-library',
  'mount(',
  'shallow(',
  'fireEvent',
  'userEvent',
]

// Suggestions for replacing fragile patterns with resilient alternatives
const FRAGILE_PATTERN_SUGGESTIONS: Record<string, string> = {
  '.querySelector(': 'Use screen.getByRole() or screen.getByTestId() instead',
  '.querySelectorAll(': 'Use screen.getAllByRole() or screen.getAllByTestId() instead',
  '.getElementsByClassName(': 'Use screen.getByRole() with accessible names instead',
  '.getElementsByTagName(': 'Use screen.getByRole() with semantic roles instead',
  '.getElementById(': 'Use screen.getByTestId() or screen.getByRole() instead',
  '.className': 'Assert on accessible properties or toHaveClass() instead',
  '.innerHTML': 'Use toHaveTextContent() or screen.getByText() instead',
  '.outerHTML': 'Use toHaveTextContent() or specific accessible assertions instead',
  '.style.': 'Use toHaveStyle() or CSS-in-JS testing utilities instead',
  'container.firstChild': 'Use screen.getByRole() or more specific queries instead',
  'container.children': 'Use screen.getAllByRole() or within() for scoped queries',
  'wrapper.find(': 'Migrate from Enzyme to React Testing Library',
  '.dive()': 'Migrate from Enzyme to React Testing Library',
  'toMatchSnapshot()': 'Use explicit assertions like toHaveTextContent(), toBeVisible()',
  'toMatchInlineSnapshot()': 'Use explicit assertions like toHaveTextContent(), toBeVisible()',
}

interface PatternFinding {
  pattern: string
  suggestion?: string
}

export const TestResilienceCheckValidator: ValidatorDefinition = {
  code: 'TEST_RESILIENCE_CHECK',
  name: 'Test Resilience Check',
  description: 'Rejects fragile test patterns and requires resilient observable-based patterns',
  gate: 1,
  order: 6,
  isHardBlock: true,

  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    // CL-VALID-006: Fail if testFilePath is null or undefined
    if (!ctx.testFilePath) {
      return {
        passed: false,
        status: 'FAILED',
        message: 'Test file path not provided',
        context: {
          inputs: [{ label: 'TestFilePath', value: 'none' }],
          analyzed: [],
          findings: [{ type: 'fail', message: 'Test file path is missing or not provided' }],
          reasoning: 'Cannot analyze test resilience without a test file path.',
        },
      }
    }

    try {
      const content = await ctx.services.git.readFile(ctx.testFilePath)

      // CL-VALID-005: Check for @resilience-skip comment (opt-out)
      if (content.includes('// @resilience-skip')) {
        return {
          passed: true,
          status: 'SKIPPED',
          message: 'Test file opted out of resilience check via @resilience-skip',
          context: {
            inputs: [{ label: 'TestFilePath', value: ctx.testFilePath }],
            analyzed: [{ label: 'Skip Directive', items: ['// @resilience-skip found'] }],
            findings: [{ type: 'info', message: 'Resilience check skipped by opt-out directive' }],
            reasoning: 'Test file contains // @resilience-skip comment, skipping validation.',
          },
          details: {
            isUITest: true,
            fragileFindings: [],
            resilientFindings: [],
          },
        }
      }

      // CL-VALID-010: Get patterns from config or use defaults
      const fragilePatterns = ctx.config.has('FRAGILE_PATTERNS')
        ? ctx.config.get('FRAGILE_PATTERNS')!.split(',').map((p) => p.trim()).filter(Boolean)
        : DEFAULT_FRAGILE_PATTERNS

      const resilientPatterns = ctx.config.has('RESILIENT_PATTERNS')
        ? ctx.config.get('RESILIENT_PATTERNS')!.split(',').map((p) => p.trim()).filter(Boolean)
        : DEFAULT_RESILIENT_PATTERNS

      // CL-VALID-011: Check if it's a UI test
      // Also consider presence of resilient patterns as indicator of UI test
      const hasUIIndicators = UI_TEST_INDICATORS.some((indicator) => content.includes(indicator))
      const hasResilientPatterns = resilientPatterns.some((pattern) => content.includes(pattern))
      const isUITest = hasUIIndicators || hasResilientPatterns
      const skipNonUITests = ctx.config.get('SKIP_NON_UI_TESTS') !== 'false' // default true

      if (!isUITest && skipNonUITests) {
        return {
          passed: true,
          status: 'SKIPPED',
          message: 'Non-UI test file skipped (SKIP_NON_UI_TESTS is enabled)',
          context: {
            inputs: [{ label: 'TestFilePath', value: ctx.testFilePath }],
            analyzed: [{ label: 'UI Indicators', items: ['No UI test indicators found'] }],
            findings: [{ type: 'info', message: 'Skipped: not a UI test file' }],
            reasoning: 'Test file does not contain UI testing indicators and SKIP_NON_UI_TESTS is enabled.',
          },
          details: {
            isUITest: false,
            fragileFindings: [],
            resilientFindings: [],
          },
        }
      }

      // Detect patterns
      const fragileFindings: PatternFinding[] = []
      const resilientFindings: PatternFinding[] = []

      for (const pattern of fragilePatterns) {
        if (content.includes(pattern)) {
          fragileFindings.push({
            pattern,
            suggestion: FRAGILE_PATTERN_SUGGESTIONS[pattern],
          })
        }
      }

      for (const pattern of resilientPatterns) {
        if (content.includes(pattern)) {
          resilientFindings.push({ pattern })
        }
      }

      const fragilePatternCount = fragileFindings.length
      const resilientPatternCount = resilientFindings.length
      const totalPatterns = fragilePatternCount + resilientPatternCount
      const resilienceRatio = totalPatterns > 0 ? resilientPatternCount / totalPatterns : 0

      // Build findings for context
      const findings: Array<{ type: 'pass' | 'fail' | 'warning'; message: string }> = []

      for (const finding of fragileFindings) {
        const msg = finding.suggestion
          ? `Fragile pattern found: \`${finding.pattern}\` - ${finding.suggestion}`
          : `Fragile pattern found: \`${finding.pattern}\``
        findings.push({ type: 'fail', message: msg })
      }

      for (const finding of resilientFindings) {
        findings.push({ type: 'pass', message: `Resilient pattern found: \`${finding.pattern}\`` })
      }

      // CL-VALID-001, CL-VALID-003, CL-VALID-007, CL-VALID-008, CL-VALID-009: Fail if fragile patterns found
      if (fragilePatternCount > 0) {
        const evidenceLines = fragileFindings.map((f) => {
          if (f.suggestion) {
            return `  - Found \`${f.pattern}\`. ${f.suggestion}`
          }
          return `  - Found \`${f.pattern}\``
        })

        return {
          passed: false,
          status: 'FAILED',
          message: `Found ${fragilePatternCount} fragile test pattern(s). Replace with resilient patterns.`,
          context: {
            inputs: [{ label: 'TestFilePath', value: ctx.testFilePath }],
            analyzed: [
              { label: 'Fragile Patterns Found', items: fragileFindings.map((f) => f.pattern) },
              { label: 'Resilient Patterns Found', items: resilientFindings.map((f) => f.pattern) },
            ],
            findings,
            reasoning: 'Fragile test patterns access implementation details. Use observable behavior-based patterns instead.',
          },
          evidence: `Fragile patterns detected:\n${evidenceLines.join('\n')}`,
          metrics: {
            fragilePatternCount,
            resilientPatternCount,
            resilienceRatio,
          },
          details: {
            isUITest,
            fragileFindings: fragileFindings.map((f) => f.pattern),
            resilientFindings: resilientFindings.map((f) => f.pattern),
          },
        }
      }

      // CL-VALID-002: Pass if only resilient patterns found
      if (resilientPatternCount > 0) {
        return {
          passed: true,
          status: 'PASSED',
          message: `Test file uses ${resilientPatternCount} resilient pattern(s) with no fragile patterns.`,
          context: {
            inputs: [{ label: 'TestFilePath', value: ctx.testFilePath }],
            analyzed: [
              { label: 'Fragile Patterns Found', items: [] },
              { label: 'Resilient Patterns Found', items: resilientFindings.map((f) => f.pattern) },
            ],
            findings,
            reasoning: 'Test file uses resilient observable-based patterns that are resistant to implementation changes.',
          },
          metrics: {
            fragilePatternCount: 0,
            resilientPatternCount,
            resilienceRatio: 1.0,
          },
          details: {
            isUITest,
            fragileFindings: [],
            resilientFindings: resilientFindings.map((f) => f.pattern),
          },
        }
      }

      // CL-VALID-004: Warning if no DOM patterns found (pure unit test) and SKIP_NON_UI_TESTS is false
      return {
        passed: true,
        status: 'WARNING',
        message: 'No fragile or resilient DOM patterns detected. This may be a pure unit test.',
        context: {
          inputs: [{ label: 'TestFilePath', value: ctx.testFilePath }],
          analyzed: [
            { label: 'Fragile Patterns Found', items: [] },
            { label: 'Resilient Patterns Found', items: [] },
          ],
          findings: [{ type: 'warning', message: 'No DOM testing patterns detected in test file' }],
          reasoning: 'Test file does not contain any recognized DOM testing patterns. If this is a UI test, consider using resilient patterns like getByRole().',
        },
        metrics: {
          fragilePatternCount: 0,
          resilientPatternCount: 0,
          resilienceRatio: 0,
        },
        details: {
          isUITest,
          fragileFindings: [],
          resilientFindings: [],
        },
      }
    } catch (error) {
      return {
        passed: false,
        status: 'FAILED',
        message: `Failed to analyze test file: ${error instanceof Error ? error.message : String(error)}`,
        context: {
          inputs: [{ label: 'TestFilePath', value: ctx.testFilePath }],
          analyzed: [],
          findings: [{ type: 'fail', message: 'Failed to read or analyze test file' }],
          reasoning: 'An error occurred while reading the test file for resilience analysis.',
        },
      }
    }
  },
}
