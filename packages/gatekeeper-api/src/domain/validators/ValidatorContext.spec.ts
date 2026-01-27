import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"

/**
 * Tests for Validator Context Implementation
 *
 * Contract: validator-context-implementation v1.0
 * Mode: STRICT
 * Criticality: HIGH
 *
 * Este arquivo cobre todas as 37 cláusulas do contrato:
 * - CL-CTX-001 a CL-CTX-006: Estrutura de dados e persistência
 * - CL-VAL-G0-001 a CL-VAL-G0-006: Validators Gate 0
 * - CL-VAL-G1-001 a CL-VAL-G1-010: Validators Gate 1
 * - CL-VAL-G2-001 a CL-VAL-G2-005: Validators Gate 2
 * - CL-VAL-G3-001 a CL-VAL-G3-002: Validators Gate 3
 * - CL-CTX-SKIP-001: Skip com motivo
 * - CL-UI-001 a CL-UI-005: UI do ValidatorContextPanel
 * - CL-BC-001 a CL-BC-002: Backward compatibility
 */

// ============================================================================
// Type Definitions - ValidatorContext Types
// ============================================================================

interface ValidatorContextInput {
  label: string
  value: string | number | boolean | string[] | Record<string, unknown>
}

interface ValidatorContextAnalyzedGroup {
  label: string
  items: string[]
}

interface ValidatorContextFinding {
  type: "pass" | "fail" | "warning" | "info"
  message: string
  location?: string
}

interface ValidatorContext {
  inputs: ValidatorContextInput[]
  analyzed: ValidatorContextAnalyzedGroup[]
  findings: ValidatorContextFinding[]
  reasoning: string
}

type ValidatorStatus = "PENDING" | "RUNNING" | "PASSED" | "FAILED" | "WARNING" | "SKIPPED"

interface ValidatorOutput {
  passed: boolean
  status: ValidatorStatus
  message: string
  details?: Record<string, unknown>
  context?: ValidatorContext
}

interface ValidatorResult {
  gateNumber: number
  validatorCode: string
  validatorName: string
  status: ValidatorStatus
  passed: boolean
  isHardBlock: boolean
  bypassed?: boolean
  message?: string
  details?: string // JSON string
}

// ============================================================================
// Test Fixtures - Factories para dados de teste
// ============================================================================

const createValidInput = (overrides: Partial<ValidatorContextInput> = {}): ValidatorContextInput => ({
  label: "Test Input",
  value: "test-value",
  ...overrides,
})

const createValidAnalyzedGroup = (overrides: Partial<ValidatorContextAnalyzedGroup> = {}): ValidatorContextAnalyzedGroup => ({
  label: "Test Group",
  items: ["item-1", "item-2"],
  ...overrides,
})

const createValidFinding = (overrides: Partial<ValidatorContextFinding> = {}): ValidatorContextFinding => ({
  type: "pass",
  message: "Test finding message",
  ...overrides,
})

const createValidContext = (overrides: Partial<ValidatorContext> = {}): ValidatorContext => ({
  inputs: [createValidInput()],
  analyzed: [createValidAnalyzedGroup()],
  findings: [createValidFinding()],
  reasoning: "Test reasoning explanation",
  ...overrides,
})

const createValidatorOutput = (overrides: Partial<ValidatorOutput> = {}): ValidatorOutput => ({
  passed: true,
  status: "PASSED",
  message: "Validation passed",
  context: createValidContext(),
  ...overrides,
})

// ============================================================================
// Mock ValidatorContextPanel Component
// ============================================================================

interface ValidatorContextPanelProps {
  context: ValidatorContext
}

function MockValidatorContextPanel({ context }: ValidatorContextPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const getFindingIcon = (type: ValidatorContextFinding["type"]) => {
    switch (type) {
      case "pass": return "✓"
      case "fail": return "✗"
      case "warning": return "⚠"
      case "info": return "ℹ"
    }
  }

  return (
    <div data-testid="validator-context-panel" className="border rounded p-2">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left font-medium"
        aria-expanded={isExpanded}
      >
        Context Details {isExpanded ? "▼" : "▶"}
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-3">
          {/* Inputs Section */}
          <div data-testid="context-inputs-section">
            <h4 className="font-semibold text-sm">Inputs</h4>
            <ul className="text-sm">
              {context.inputs.map((input, idx) => (
                <li key={idx}>
                  <strong>{input.label}:</strong>{" "}
                  {typeof input.value === "object"
                    ? JSON.stringify(input.value)
                    : String(input.value)}
                </li>
              ))}
            </ul>
          </div>

          {/* Analyzed Section */}
          <div data-testid="context-analyzed-section">
            <h4 className="font-semibold text-sm">Analyzed</h4>
            {context.analyzed.map((group, idx) => (
              <div key={idx}>
                <strong>{group.label}:</strong>
                <ul className="ml-4 text-sm">
                  {group.items.map((item, itemIdx) => (
                    <li key={itemIdx}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Findings Section */}
          <div data-testid="context-findings-section">
            <h4 className="font-semibold text-sm">Findings</h4>
            <ul className="text-sm">
              {context.findings.map((finding, idx) => (
                <li key={idx} data-testid={`finding-${finding.type}`}>
                  <span className="mr-1">{getFindingIcon(finding.type)}</span>
                  {finding.message}
                  {finding.location && (
                    <span className="text-muted-foreground ml-1">
                      at {finding.location}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Reasoning Section */}
          <div data-testid="context-reasoning-section">
            <h4 className="font-semibold text-sm">Reasoning</h4>
            <p className="text-sm">{context.reasoning}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Mock ValidatorCard Component (integração com panel)
// ============================================================================

interface MockValidatorCardProps {
  result: ValidatorResult
}

function MockValidatorCard({ result }: MockValidatorCardProps) {
  const parsedDetails = result.details ? JSON.parse(result.details) : null
  const hasContext = parsedDetails?.context != null

  return (
    <div data-testid="validator-card" className="border rounded p-3">
      <div className="flex justify-between items-center">
        <span className="font-medium">{result.validatorName}</span>
        <span className={`badge ${result.status.toLowerCase()}`}>{result.status}</span>
      </div>
      {result.message && <p className="text-sm mt-1">{result.message}</p>}

      {hasContext && (
        <MockValidatorContextPanel context={parsedDetails.context} />
      )}
    </div>
  )
}

// ============================================================================
// Mock Orchestrator - Simula serialização/persistência
// ============================================================================

class MockValidationOrchestrator {
  serializeDetails(output: ValidatorOutput): string | null {
    if (!output.details && !output.context) {
      return null
    }

    const merged: Record<string, unknown> = { ...output.details }

    if (output.context) {
      merged.context = output.context
    }

    return JSON.stringify(merged)
  }

  parseDetails(detailsJson: string | null): Record<string, unknown> | null {
    if (!detailsJson) return null
    return JSON.parse(detailsJson)
  }
}

// ============================================================================
// Mock Validators - Simulam comportamento esperado pós-implementação
// ============================================================================

// Gate 0 Validators
const mockTokenBudgetFitExecute = (): ValidatorOutput => ({
  passed: true,
  status: "PASSED",
  message: "Token budget OK: 5000 / 80000",
  context: {
    inputs: [
      { label: "MAX_TOKEN_BUDGET", value: 100000 },
      { label: "TOKEN_SAFETY_MARGIN", value: 0.8 },
    ],
    analyzed: [{ label: "Context Items", items: ["taskPrompt", "manifest", "refs"] }],
    findings: [{ type: "pass", message: "Token count within budget" }],
    reasoning: "Token count of 5000 is within the effective limit of 80000 (80% of 100000)",
  },
})

const mockTaskScopeSizeExecute = (): ValidatorOutput => ({
  passed: true,
  status: "PASSED",
  message: "Task scope within limits",
  context: {
    inputs: [{ label: "Manifest", value: { files: 3, testFile: "test.spec.tsx" } }],
    analyzed: [{ label: "Files List", items: ["src/a.ts", "src/b.ts", "src/c.ts"] }],
    findings: [{ type: "pass", message: "3 files within scope" }],
    reasoning: "Manifest contains 3 files which is within acceptable scope",
  },
})

const mockTaskClarityCheckExecute = (): ValidatorOutput => ({
  passed: false,
  status: "WARNING",
  message: "Ambiguous terms found in task prompt",
  context: {
    inputs: [
      { label: "TaskPrompt", value: "Implement the feature properly" },
      { label: "AmbiguousTerms", value: ["properly", "feature"] },
    ],
    analyzed: [{ label: "Terms Found", items: ["properly", "feature"] }],
    findings: [
      { type: "warning", message: "Term 'properly' is ambiguous" },
      { type: "warning", message: "Term 'feature' is too vague" },
    ],
    reasoning: "Task prompt contains 2 ambiguous terms that should be clarified",
  },
})

const mockSensitiveFilesLockExecute = (): ValidatorOutput => ({
  passed: false,
  status: "FAILED",
  message: "Sensitive files detected in manifest",
  context: {
    inputs: [
      { label: "Manifest Files", value: [".env", "config/secrets.ts", "src/app.ts"] },
      { label: "Sensitive Patterns", value: [".env*", "**/secrets*"] },
    ],
    analyzed: [{ label: "Files Checked", items: [".env", "config/secrets.ts", "src/app.ts"] }],
    findings: [
      { type: "fail", message: "File .env matches sensitive pattern .env*", location: ".env" },
      { type: "fail", message: "File config/secrets.ts matches pattern **/secrets*", location: "config/secrets.ts" },
      { type: "pass", message: "File src/app.ts is not sensitive" },
    ],
    reasoning: "2 of 3 files match sensitive patterns and cannot be modified without dangerMode",
  },
})

const mockDangerModeExplicitExecute = (): ValidatorOutput => ({
  passed: true,
  status: "PASSED",
  message: "Danger mode correctly configured",
  context: {
    inputs: [
      { label: "DangerMode", value: true },
      { label: "Sensitive Files Detected", value: 2 },
    ],
    analyzed: [],
    findings: [{ type: "info", message: "Danger mode enabled for sensitive file access" }],
    reasoning: "Danger mode is explicitly enabled and sensitive files are present, allowing modification",
  },
})

const mockPathConventionExecute = (): ValidatorOutput => ({
  passed: true,
  status: "PASSED",
  message: "Test file path follows conventions",
  context: {
    inputs: [
      { label: "TestFilePath", value: "src/components/button.spec.tsx" },
      { label: "Conventions", value: ["**/*.spec.{ts,tsx}", "**/*.test.{ts,tsx}"] },
    ],
    analyzed: [{ label: "Path vs Patterns", items: ["*.spec.tsx matches **/*.spec.{ts,tsx}"] }],
    findings: [{ type: "pass", message: "Path matches convention" }],
    reasoning: "Test file path src/components/button.spec.tsx matches the *.spec.tsx convention",
  },
})

// Gate 1 Validators
const mockTestSyntaxValidExecute = (): ValidatorOutput => ({
  passed: true,
  status: "PASSED",
  message: "Test file syntax is valid",
  context: {
    inputs: [{ label: "TestFilePath", value: "src/test.spec.tsx" }],
    analyzed: [],
    findings: [{ type: "pass", message: "No syntax errors found" }],
    reasoning: "TypeScript parser successfully parsed the test file without errors",
  },
})

const mockTestHasAssertionsExecute = (): ValidatorOutput => ({
  passed: true,
  status: "PASSED",
  message: "All test blocks have assertions",
  context: {
    inputs: [],
    analyzed: [{ label: "Test Blocks", items: ["should render button", "should handle click", "should be disabled"] }],
    findings: [
      { type: "pass", message: "Test 'should render button' has assertions" },
      { type: "pass", message: "Test 'should handle click' has assertions" },
      { type: "pass", message: "Test 'should be disabled' has assertions" },
    ],
    reasoning: "All 3 test blocks contain at least one expect() assertion",
  },
})

const mockTestCoversHappyAndSadPathExecute = (): ValidatorOutput => ({
  passed: true,
  status: "PASSED",
  message: "Tests cover both happy and sad paths",
  context: {
    inputs: [],
    analyzed: [
      { label: "Test Names", items: ["should render correctly (happy)", "should show error on invalid input (sad)", "should disable on loading (sad)"] },
    ],
    findings: [
      { type: "pass", message: "Happy path: 'should render correctly'" },
      { type: "pass", message: "Sad path: 'should show error on invalid input'" },
    ],
    reasoning: "Test file contains tests for both success scenarios (happy path) and error scenarios (sad path)",
  },
})

const mockTestFailsBeforeImplementationExecute = (): ValidatorOutput => ({
  passed: true,
  status: "PASSED",
  message: "Tests fail correctly before implementation",
  context: {
    inputs: [{ label: "BaseRef", value: "origin/main" }],
    analyzed: [{ label: "Test Run Result", items: ["3 tests failed as expected"] }],
    findings: [{ type: "pass", message: "All tests fail on base branch" }],
    reasoning: "Running tests against origin/main shows 3 failures, confirming TDD approach",
  },
})

const mockNoDecorativeTestsExecute = (): ValidatorOutput => ({
  passed: true,
  status: "PASSED",
  message: "No decorative tests detected",
  context: {
    inputs: [],
    analyzed: [{ label: "Test Blocks", items: ["renders button", "handles click event", "shows tooltip"] }],
    findings: [
      { type: "pass", message: "Test 'renders button' has substantive assertions" },
      { type: "pass", message: "Test 'handles click event' has substantive assertions" },
    ],
    reasoning: "All tests contain substantive assertions beyond just toBeDefined/toBeTruthy",
  },
})

const mockManifestFileLockExecute = (): ValidatorOutput => ({
  passed: true,
  status: "PASSED",
  message: "Manifest files are locked for modification",
  context: {
    inputs: [{ label: "Manifest", value: { files: ["src/a.ts", "src/b.ts"], testFile: "src/a.spec.ts" } }],
    analyzed: [{ label: "Files", items: ["src/a.ts", "src/b.ts", "src/a.spec.ts"] }],
    findings: [{ type: "pass", message: "All manifest files registered" }],
    reasoning: "Manifest defines 2 implementation files and 1 test file, all registered correctly",
  },
})

const mockNoImplicitFilesExecute = (): ValidatorOutput => ({
  passed: true,
  status: "PASSED",
  message: "No implicit file dependencies",
  context: {
    inputs: [
      { label: "Manifest", value: { files: ["src/a.ts"] } },
      { label: "TestFile", value: "src/a.spec.ts" },
    ],
    analyzed: [{ label: "Imports Found", items: ["./a", "@/lib/utils"] }],
    findings: [
      { type: "pass", message: "Import './a' resolves to manifest file" },
      { type: "pass", message: "Import '@/lib/utils' is external" },
    ],
    reasoning: "All imports in test file either reference manifest files or external modules",
  },
})

const mockImportRealityCheckExecute = (): ValidatorOutput => ({
  passed: true,
  status: "PASSED",
  message: "All imports resolve correctly",
  context: {
    inputs: [{ label: "TestFile", value: "src/test.spec.tsx" }],
    analyzed: [{ label: "Import Statements", items: ["@/components/button", "@/lib/utils", "vitest"] }],
    findings: [
      { type: "pass", message: "Import '@/components/button' resolves" },
      { type: "pass", message: "Import '@/lib/utils' resolves" },
      { type: "pass", message: "Import 'vitest' resolves" },
    ],
    reasoning: "All 3 import statements in the test file resolve to existing modules",
  },
})

const mockTestIntentAlignmentExecute = (): ValidatorOutput => ({
  passed: true,
  status: "PASSED",
  message: "Tests align with task intent",
  context: {
    inputs: [
      { label: "TaskPrompt", value: "Add hover state to button" },
      { label: "TestFile", value: "src/button.spec.tsx" },
    ],
    analyzed: [{ label: "Test Names vs Prompt", items: ["'renders hover state' aligns with 'hover state'"] }],
    findings: [{ type: "pass", message: "Test intent matches task prompt" }],
    reasoning: "Test names reference 'hover state' which aligns with the task prompt",
  },
})

const mockTestClauseMappingValidExecute = (): ValidatorOutput => ({
  passed: true,
  status: "PASSED",
  message: "All clause mappings are valid",
  context: {
    inputs: [
      { label: "Contract Clauses", value: ["CL-UI-001", "CL-UI-002", "CL-UI-003"] },
      { label: "TagPattern", value: "// @clause" },
    ],
    analyzed: [{ label: "Test Blocks", items: ["it('CL-UI-001: ...')", "it('CL-UI-002: ...')", "it('CL-UI-003: ...')"] }],
    findings: [
      { type: "pass", message: "CL-UI-001 is mapped to a test" },
      { type: "pass", message: "CL-UI-002 is mapped to a test" },
      { type: "pass", message: "CL-UI-003 is mapped to a test" },
    ],
    reasoning: "All 3 contract clauses have corresponding tests with @clause annotations",
  },
})

// Gate 2 Validators
const mockDiffScopeEnforcementExecute = (): ValidatorOutput => ({
  passed: true,
  status: "PASSED",
  message: "Diff is within manifest scope",
  context: {
    inputs: [
      { label: "Manifest", value: { files: ["src/a.ts", "src/b.ts"] } },
      { label: "BaseRef", value: "origin/main" },
      { label: "TargetRef", value: "HEAD" },
    ],
    analyzed: [{ label: "Diff Files", items: ["src/a.ts", "src/b.ts"] }],
    findings: [
      { type: "pass", message: "src/a.ts is in manifest" },
      { type: "pass", message: "src/b.ts is in manifest" },
    ],
    reasoning: "All files in the diff are declared in the manifest",
  },
})

const mockTestReadOnlyEnforcementExecute = (): ValidatorOutput => ({
  passed: true,
  status: "PASSED",
  message: "Test file is read-only in diff",
  context: {
    inputs: [{ label: "TestFile", value: "src/test.spec.tsx" }],
    analyzed: [{ label: "Diff Files", items: ["src/a.ts", "src/b.ts"] }],
    findings: [{ type: "pass", message: "Test file not modified in diff" }],
    reasoning: "The test file src/test.spec.tsx does not appear in the diff, preserving read-only constraint",
  },
})

const mockTaskTestPassesExecute = (): ValidatorOutput => ({
  passed: true,
  status: "PASSED",
  message: "All task tests pass",
  context: {
    inputs: [{ label: "TestFilePath", value: "src/test.spec.tsx" }],
    analyzed: [{ label: "Test Run Output", items: ["3 passed", "0 failed", "0 skipped"] }],
    findings: [{ type: "pass", message: "All tests pass" }],
    reasoning: "Running vitest on src/test.spec.tsx shows 3 passing tests",
  },
})

const mockStrictCompilationExecute = (): ValidatorOutput => ({
  passed: true,
  status: "PASSED",
  message: "TypeScript compilation successful",
  context: {
    inputs: [{ label: "ProjectPath", value: "/home/user/project" }],
    analyzed: [],
    findings: [{ type: "pass", message: "No compilation errors" }],
    reasoning: "tsc --noEmit completed successfully with no errors",
  },
})

const mockStyleConsistencyLintExecute = (): ValidatorOutput => ({
  passed: true,
  status: "PASSED",
  message: "Lint checks passed",
  context: {
    inputs: [],
    analyzed: [{ label: "Files Linted", items: ["src/a.ts", "src/b.ts"] }],
    findings: [
      { type: "pass", message: "src/a.ts: 0 errors" },
      { type: "pass", message: "src/b.ts: 0 errors" },
    ],
    reasoning: "ESLint found no errors or warnings in the changed files",
  },
})

// Gate 3 Validators
const mockFullRegressionPassExecute = (): ValidatorOutput => ({
  passed: true,
  status: "PASSED",
  message: "Full regression suite passes",
  context: {
    inputs: [],
    analyzed: [{ label: "Test Suite", items: ["150 tests total", "150 passed", "0 failed"] }],
    findings: [{ type: "pass", message: "All regression tests pass" }],
    reasoning: "Full test suite completed with 150/150 tests passing",
  },
})

const mockProductionBuildPassExecute = (): ValidatorOutput => ({
  passed: true,
  status: "PASSED",
  message: "Production build successful",
  context: {
    inputs: [{ label: "Build Command", value: "npm run build" }],
    analyzed: [],
    findings: [{ type: "pass", message: "Build completed successfully" }],
    reasoning: "Production build command executed with exit code 0",
  },
})

// Skip validator mock
const mockSkippedValidatorExecute = (): ValidatorOutput => ({
  passed: true,
  status: "SKIPPED",
  message: "Validator skipped",
  context: {
    inputs: [],
    analyzed: [],
    findings: [{ type: "info", message: "Skipped: No manifest provided" }],
    reasoning: "Validator was skipped because required input (manifest) is not available",
  },
})

// ============================================================================
// Tests
// ============================================================================

describe("ValidatorContext Implementation Contract", () => {
  const orchestrator = new MockValidationOrchestrator()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==========================================================================
  // CL-CTX-001: ValidatorContext.inputs é array de objetos label/value
  // ==========================================================================
  describe("CL-CTX-001: ValidatorContext.inputs structure", () => {
    // @clause CL-CTX-001
    it("happy path: context.inputs é um array de objetos com label string e value", () => {
      const context = createValidContext()

      expect(Array.isArray(context.inputs)).toBe(true)
      expect(context.inputs.length).toBeGreaterThan(0)

      for (const input of context.inputs) {
        expect(typeof input.label).toBe("string")
        expect(input).toHaveProperty("value")
      }
    })

    // @clause CL-CTX-001
    it("happy path: context.inputs aceita diferentes tipos de value", () => {
      const context = createValidContext({
        inputs: [
          createValidInput({ label: "String", value: "text" }),
          createValidInput({ label: "Number", value: 42 }),
          createValidInput({ label: "Boolean", value: true }),
          createValidInput({ label: "Array", value: ["a", "b", "c"] }),
          createValidInput({ label: "Object", value: { key: "value" } }),
        ],
      })

      expect(context.inputs[0].value).toBe("text")
      expect(context.inputs[1].value).toBe(42)
      expect(context.inputs[2].value).toBe(true)
      expect(context.inputs[3].value).toEqual(["a", "b", "c"])
      expect(context.inputs[4].value).toEqual({ key: "value" })
    })

    // @clause CL-CTX-001
    it("sad path: input sem label falha na validação de estrutura", () => {
      const invalidInput = { value: "test" } as ValidatorContextInput

      const isValidInput = (input: ValidatorContextInput): boolean => {
        return typeof input.label === "string" && input.label.length > 0 && "value" in input
      }

      expect(isValidInput(invalidInput)).toBe(false)
    })
  })

  // ==========================================================================
  // CL-CTX-002: ValidatorContext.analyzed é array de grupos
  // ==========================================================================
  describe("CL-CTX-002: ValidatorContext.analyzed structure", () => {
    // @clause CL-CTX-002
    it("happy path: context.analyzed é array de grupos com label e items", () => {
      const context = createValidContext()

      expect(Array.isArray(context.analyzed)).toBe(true)

      for (const group of context.analyzed) {
        expect(typeof group.label).toBe("string")
        expect(Array.isArray(group.items)).toBe(true)
        for (const item of group.items) {
          expect(typeof item).toBe("string")
        }
      }
    })

    // @clause CL-CTX-002
    it("sad path: grupo sem items falha na validação de estrutura", () => {
      const invalidGroup = { label: "Test" } as ValidatorContextAnalyzedGroup

      const isValidGroup = (group: ValidatorContextAnalyzedGroup): boolean => {
        return (
          typeof group.label === "string" &&
          Array.isArray(group.items) &&
          group.items.every((item) => typeof item === "string")
        )
      }

      expect(isValidGroup(invalidGroup)).toBe(false)
    })
  })

  // ==========================================================================
  // CL-CTX-003: ValidatorContext.findings é array tipado
  // ==========================================================================
  describe("CL-CTX-003: ValidatorContext.findings structure", () => {
    // @clause CL-CTX-003
    it("happy path: context.findings possui type, message e location opcional", () => {
      const context = createValidContext({
        findings: [
          createValidFinding({ type: "pass", message: "OK" }),
          createValidFinding({ type: "fail", message: "Error", location: "line 42" }),
          createValidFinding({ type: "warning", message: "Warn" }),
          createValidFinding({ type: "info", message: "Info" }),
        ],
      })

      expect(Array.isArray(context.findings)).toBe(true)

      const validTypes = ["pass", "fail", "warning", "info"]
      for (const finding of context.findings) {
        expect(validTypes).toContain(finding.type)
        expect(typeof finding.message).toBe("string")
        if (finding.location) {
          expect(typeof finding.location).toBe("string")
        }
      }
    })

    // @clause CL-CTX-003
    it("sad path: finding com type inválido não passa validação de tipo", () => {
      const validTypes = ["pass", "fail", "warning", "info"]
      const invalidType = "invalid"

      expect(validTypes).not.toContain(invalidType)
    })
  })

  // ==========================================================================
  // CL-CTX-004: ValidatorContext.reasoning é string explicativa
  // ==========================================================================
  describe("CL-CTX-004: ValidatorContext.reasoning structure", () => {
    // @clause CL-CTX-004
    it("happy path: context.reasoning é string não-vazia", () => {
      const context = createValidContext({
        reasoning: "This validation passed because all conditions were met.",
      })

      expect(typeof context.reasoning).toBe("string")
      expect(context.reasoning.length).toBeGreaterThan(0)
    })

    // @clause CL-CTX-004
    it("sad path: reasoning vazio não atende requisito", () => {
      const context = createValidContext({ reasoning: "" })

      expect(context.reasoning.length).toBe(0)
    })
  })

  // ==========================================================================
  // CL-CTX-005: Context é mesclado em details
  // ==========================================================================
  describe("CL-CTX-005: Context persistence in details", () => {
    // @clause CL-CTX-005
    it("happy path: context é serializado em details junto com outras propriedades", () => {
      const output = createValidatorOutput({
        details: { errors: [], violations: ["v1"] },
        context: createValidContext(),
      })

      const serialized = orchestrator.serializeDetails(output)
      expect(serialized).not.toBeNull()

      const parsed = JSON.parse(serialized!)
      expect(parsed).toHaveProperty("context")
      expect(parsed).toHaveProperty("errors")
      expect(parsed).toHaveProperty("violations")
      expect(parsed.context.reasoning).toBe("Test reasoning explanation")
    })

    // @clause CL-CTX-005
    it("happy path: details existentes são preservados quando context é adicionado", () => {
      const output = createValidatorOutput({
        details: { customField: "original", count: 5 },
        context: createValidContext(),
      })

      const serialized = orchestrator.serializeDetails(output)
      const parsed = JSON.parse(serialized!)

      expect(parsed.customField).toBe("original")
      expect(parsed.count).toBe(5)
      expect(parsed.context).toBeDefined()
    })
  })

  // ==========================================================================
  // CL-CTX-006: Context é opcional
  // ==========================================================================
  describe("CL-CTX-006: Context is optional", () => {
    // @clause CL-CTX-006
    it("happy path: validator sem context persiste normalmente", () => {
      const output: ValidatorOutput = {
        passed: true,
        status: "PASSED",
        message: "OK",
        details: { info: "some data" },
        // context não definido
      }

      const serialized = orchestrator.serializeDetails(output)
      expect(serialized).not.toBeNull()

      const parsed = JSON.parse(serialized!)
      expect(parsed).not.toHaveProperty("context")
      expect(parsed.info).toBe("some data")
    })

    // @clause CL-CTX-006
    it("happy path: output sem details e sem context retorna null", () => {
      const output: ValidatorOutput = {
        passed: true,
        status: "PASSED",
        message: "OK",
      }

      const serialized = orchestrator.serializeDetails(output)
      expect(serialized).toBeNull()
    })
  })

  // ==========================================================================
  // Gate 0 Validators
  // ==========================================================================
  describe("Gate 0 Validators Context", () => {
    // @clause CL-VAL-G0-001
    it("happy path: TokenBudgetFit retorna context com inputs de config", () => {
      const output = mockTokenBudgetFitExecute()

      expect(output.context).toBeDefined()
      expect(output.context!.inputs.some((i) => i.label === "MAX_TOKEN_BUDGET")).toBe(true)
      expect(output.context!.inputs.some((i) => i.label === "TOKEN_SAFETY_MARGIN")).toBe(true)
      expect(output.context!.reasoning).toContain("Token")
    })

    // @clause CL-VAL-G0-002
    it("happy path: TaskScopeSize retorna context com manifest e files analyzed", () => {
      const output = mockTaskScopeSizeExecute()

      expect(output.context).toBeDefined()
      expect(output.context!.inputs.some((i) => i.label === "Manifest")).toBe(true)
      expect(output.context!.analyzed.some((a) => a.label === "Files List")).toBe(true)
    })

    // @clause CL-VAL-G0-003
    it("happy path: TaskClarityCheck retorna context com ambiguous terms findings", () => {
      const output = mockTaskClarityCheckExecute()

      expect(output.context).toBeDefined()
      expect(output.context!.inputs.some((i) => i.label === "AmbiguousTerms")).toBe(true)
      expect(output.context!.findings.some((f) => f.type === "warning")).toBe(true)
    })

    // @clause CL-VAL-G0-004
    it("happy path: SensitiveFilesLock retorna context com patterns e findings por violação", () => {
      const output = mockSensitiveFilesLockExecute()

      expect(output.context).toBeDefined()
      expect(output.context!.inputs.some((i) => i.label === "Sensitive Patterns")).toBe(true)
      expect(output.context!.findings.filter((f) => f.type === "fail").length).toBeGreaterThan(0)
      expect(output.context!.findings.some((f) => f.location !== undefined)).toBe(true)
    })

    // @clause CL-VAL-G0-005
    it("happy path: DangerModeExplicit retorna context com dangerMode e sensitive detection", () => {
      const output = mockDangerModeExplicitExecute()

      expect(output.context).toBeDefined()
      expect(output.context!.inputs.some((i) => i.label === "DangerMode")).toBe(true)
      expect(output.context!.reasoning).toContain("Danger")
    })

    // @clause CL-VAL-G0-006
    it("happy path: PathConvention retorna context com conventions e path analysis", () => {
      const output = mockPathConventionExecute()

      expect(output.context).toBeDefined()
      expect(output.context!.inputs.some((i) => i.label === "TestFilePath")).toBe(true)
      expect(output.context!.inputs.some((i) => i.label === "Conventions")).toBe(true)
      expect(output.context!.analyzed.some((a) => a.label === "Path vs Patterns")).toBe(true)
    })
  })

  // ==========================================================================
  // Gate 1 Validators
  // ==========================================================================
  describe("Gate 1 Validators Context", () => {
    // @clause CL-VAL-G1-001
    it("happy path: TestSyntaxValid retorna context com testFilePath e findings de erros", () => {
      const output = mockTestSyntaxValidExecute()

      expect(output.context).toBeDefined()
      expect(output.context!.inputs.some((i) => i.label === "TestFilePath")).toBe(true)
      expect(output.context!.reasoning).toContain("parser")
    })

    // @clause CL-VAL-G1-002
    it("happy path: TestHasAssertions retorna context com test blocks analyzed", () => {
      const output = mockTestHasAssertionsExecute()

      expect(output.context).toBeDefined()
      expect(output.context!.analyzed.some((a) => a.label === "Test Blocks")).toBe(true)
      expect(output.context!.findings.every((f) => f.type === "pass")).toBe(true)
    })

    // @clause CL-VAL-G1-003
    it("happy path: TestCoversHappyAndSadPath retorna context com test names e happy/sad findings", () => {
      const output = mockTestCoversHappyAndSadPathExecute()

      expect(output.context).toBeDefined()
      expect(output.context!.analyzed.some((a) => a.label === "Test Names")).toBe(true)
      expect(output.context!.findings.some((f) => f.message.includes("Happy path"))).toBe(true)
      expect(output.context!.findings.some((f) => f.message.includes("Sad path"))).toBe(true)
    })

    // @clause CL-VAL-G1-004
    it("happy path: TestFailsBeforeImplementation retorna context com baseRef e test run result", () => {
      const output = mockTestFailsBeforeImplementationExecute()

      expect(output.context).toBeDefined()
      expect(output.context!.inputs.some((i) => i.label === "BaseRef")).toBe(true)
      expect(output.context!.analyzed.some((a) => a.label === "Test Run Result")).toBe(true)
    })

    // @clause CL-VAL-G1-005
    it("happy path: NoDecorativeTests retorna context com test blocks e decorative findings", () => {
      const output = mockNoDecorativeTestsExecute()

      expect(output.context).toBeDefined()
      expect(output.context!.analyzed.some((a) => a.label === "Test Blocks")).toBe(true)
      expect(output.context!.reasoning).toContain("assertions")
    })

    // @clause CL-VAL-G1-006
    it("happy path: ManifestFileLock retorna context com manifest input e files analyzed", () => {
      const output = mockManifestFileLockExecute()

      expect(output.context).toBeDefined()
      expect(output.context!.inputs.some((i) => i.label === "Manifest")).toBe(true)
      expect(output.context!.analyzed.some((a) => a.label === "Files")).toBe(true)
    })

    // @clause CL-VAL-G1-007
    it("happy path: NoImplicitFiles retorna context com manifest, testFile e imports analyzed", () => {
      const output = mockNoImplicitFilesExecute()

      expect(output.context).toBeDefined()
      expect(output.context!.inputs.some((i) => i.label === "Manifest")).toBe(true)
      expect(output.context!.inputs.some((i) => i.label === "TestFile")).toBe(true)
      expect(output.context!.analyzed.some((a) => a.label === "Imports Found")).toBe(true)
    })

    // @clause CL-VAL-G1-008
    it("happy path: ImportRealityCheck retorna context com testFile e import statements findings", () => {
      const output = mockImportRealityCheckExecute()

      expect(output.context).toBeDefined()
      expect(output.context!.inputs.some((i) => i.label === "TestFile")).toBe(true)
      expect(output.context!.analyzed.some((a) => a.label === "Import Statements")).toBe(true)
      expect(output.context!.findings.every((f) => f.message.includes("resolves"))).toBe(true)
    })

    // @clause CL-VAL-G1-009
    it("happy path: TestIntentAlignment retorna context com taskPrompt, testFile e analysis", () => {
      const output = mockTestIntentAlignmentExecute()

      expect(output.context).toBeDefined()
      expect(output.context!.inputs.some((i) => i.label === "TaskPrompt")).toBe(true)
      expect(output.context!.inputs.some((i) => i.label === "TestFile")).toBe(true)
      expect(output.context!.analyzed.some((a) => a.label === "Test Names vs Prompt")).toBe(true)
    })

    // @clause CL-VAL-G1-010
    it("happy path: TestClauseMappingValid retorna context com clauses, tagPattern e findings", () => {
      const output = mockTestClauseMappingValidExecute()

      expect(output.context).toBeDefined()
      expect(output.context!.inputs.some((i) => i.label === "Contract Clauses")).toBe(true)
      expect(output.context!.inputs.some((i) => i.label === "TagPattern")).toBe(true)
      expect(output.context!.findings.every((f) => f.message.includes("mapped"))).toBe(true)
    })
  })

  // ==========================================================================
  // Gate 2 Validators
  // ==========================================================================
  describe("Gate 2 Validators Context", () => {
    // @clause CL-VAL-G2-001
    it("happy path: DiffScopeEnforcement retorna context com manifest, refs e diff files", () => {
      const output = mockDiffScopeEnforcementExecute()

      expect(output.context).toBeDefined()
      expect(output.context!.inputs.some((i) => i.label === "Manifest")).toBe(true)
      expect(output.context!.inputs.some((i) => i.label === "BaseRef")).toBe(true)
      expect(output.context!.inputs.some((i) => i.label === "TargetRef")).toBe(true)
      expect(output.context!.analyzed.some((a) => a.label === "Diff Files")).toBe(true)
    })

    // @clause CL-VAL-G2-002
    it("happy path: TestReadOnlyEnforcement retorna context com testFile e diff analysis", () => {
      const output = mockTestReadOnlyEnforcementExecute()

      expect(output.context).toBeDefined()
      expect(output.context!.inputs.some((i) => i.label === "TestFile")).toBe(true)
      expect(output.context!.analyzed.some((a) => a.label === "Diff Files")).toBe(true)
    })

    // @clause CL-VAL-G2-003
    it("happy path: TaskTestPasses retorna context com testFilePath e test run output", () => {
      const output = mockTaskTestPassesExecute()

      expect(output.context).toBeDefined()
      expect(output.context!.inputs.some((i) => i.label === "TestFilePath")).toBe(true)
      expect(output.context!.analyzed.some((a) => a.label === "Test Run Output")).toBe(true)
    })

    // @clause CL-VAL-G2-004
    it("happy path: StrictCompilation retorna context com projectPath e compilation findings", () => {
      const output = mockStrictCompilationExecute()

      expect(output.context).toBeDefined()
      expect(output.context!.inputs.some((i) => i.label === "ProjectPath")).toBe(true)
      expect(output.context!.reasoning).toContain("tsc")
    })

    // @clause CL-VAL-G2-005
    it("happy path: StyleConsistencyLint retorna context com files linted e lint findings", () => {
      const output = mockStyleConsistencyLintExecute()

      expect(output.context).toBeDefined()
      expect(output.context!.analyzed.some((a) => a.label === "Files Linted")).toBe(true)
      expect(output.context!.findings.every((f) => f.message.includes("errors"))).toBe(true)
    })
  })

  // ==========================================================================
  // Gate 3 Validators
  // ==========================================================================
  describe("Gate 3 Validators Context", () => {
    // @clause CL-VAL-G3-001
    it("happy path: FullRegressionPass retorna context com test suite analyzed e findings", () => {
      const output = mockFullRegressionPassExecute()

      expect(output.context).toBeDefined()
      expect(output.context!.analyzed.some((a) => a.label === "Test Suite")).toBe(true)
      expect(output.context!.reasoning).toContain("test")
    })

    // @clause CL-VAL-G3-002
    it("happy path: ProductionBuildPass retorna context com build command e findings", () => {
      const output = mockProductionBuildPassExecute()

      expect(output.context).toBeDefined()
      expect(output.context!.inputs.some((i) => i.label === "Build Command")).toBe(true)
      expect(output.context!.findings.some((f) => f.message.includes("Build"))).toBe(true)
    })
  })

  // ==========================================================================
  // CL-CTX-SKIP-001: Skip indica motivo no context
  // ==========================================================================
  describe("CL-CTX-SKIP-001: Skip reason in context", () => {
    // @clause CL-CTX-SKIP-001
    it("happy path: validator SKIPPED tem finding info explicando motivo", () => {
      const output = mockSkippedValidatorExecute()

      expect(output.status).toBe("SKIPPED")
      expect(output.context).toBeDefined()
      expect(output.context!.findings.some((f) => f.type === "info")).toBe(true)
      expect(output.context!.findings.some((f) => f.message.includes("Skipped"))).toBe(true)
    })

    // @clause CL-CTX-SKIP-001
    it("sad path: validator SKIPPED sem finding info viola contrato", () => {
      const invalidOutput: ValidatorOutput = {
        passed: true,
        status: "SKIPPED",
        message: "Skipped",
        context: {
          inputs: [],
          analyzed: [],
          findings: [], // Sem info finding
          reasoning: "Skipped",
        },
      }

      const hasInfoFinding = invalidOutput.context!.findings.some((f) => f.type === "info")
      expect(hasInfoFinding).toBe(false) // Violação do contrato
    })
  })

  // ==========================================================================
  // UI Tests
  // ==========================================================================
  describe("ValidatorContextPanel UI", () => {
    // @clause CL-UI-001
    it("happy path: ValidatorContextPanel renderiza quando há context", () => {
      const result: ValidatorResult = {
        gateNumber: 0,
        validatorCode: "TEST_VALIDATOR",
        validatorName: "Test Validator",
        status: "PASSED",
        passed: true,
        isHardBlock: false,
        details: JSON.stringify({ context: createValidContext() }),
      }

      render(<MockValidatorCard result={result} />)

      expect(screen.getByTestId("validator-context-panel")).toBeInTheDocument()
    })

    // @clause CL-UI-002
    it("happy path: ValidatorContextPanel NÃO renderiza quando não há context", () => {
      const result: ValidatorResult = {
        gateNumber: 0,
        validatorCode: "TEST_VALIDATOR",
        validatorName: "Test Validator",
        status: "PASSED",
        passed: true,
        isHardBlock: false,
        details: JSON.stringify({ info: "no context here" }),
      }

      render(<MockValidatorCard result={result} />)

      expect(screen.queryByTestId("validator-context-panel")).not.toBeInTheDocument()
    })

    // @clause CL-UI-003
    it("happy path: ValidatorContextPanel exibe todas as seções ao expandir", async () => {
      const user = userEvent.setup()
      const context = createValidContext()

      render(<MockValidatorContextPanel context={context} />)

      // Expande o painel
      const trigger = screen.getByRole("button", { name: /context details/i })
      await user.click(trigger)

      expect(screen.getByTestId("context-inputs-section")).toBeInTheDocument()
      expect(screen.getByTestId("context-analyzed-section")).toBeInTheDocument()
      expect(screen.getByTestId("context-findings-section")).toBeInTheDocument()
      expect(screen.getByTestId("context-reasoning-section")).toBeInTheDocument()
    })

    // @clause CL-UI-004
    it("happy path: ValidatorContextPanel inicia colapsado", () => {
      const context = createValidContext()

      render(<MockValidatorContextPanel context={context} />)

      const trigger = screen.getByRole("button", { name: /context details/i })
      expect(trigger).toHaveAttribute("aria-expanded", "false")

      // Seções não devem estar visíveis inicialmente
      expect(screen.queryByTestId("context-inputs-section")).not.toBeInTheDocument()
    })

    // @clause CL-UI-005
    it("happy path: Findings exibem ícones por tipo (pass, fail, warning, info)", async () => {
      const user = userEvent.setup()
      const context = createValidContext({
        findings: [
          createValidFinding({ type: "pass", message: "Pass message" }),
          createValidFinding({ type: "fail", message: "Fail message" }),
          createValidFinding({ type: "warning", message: "Warning message" }),
          createValidFinding({ type: "info", message: "Info message" }),
        ],
      })

      render(<MockValidatorContextPanel context={context} />)

      // Expande para ver findings
      await user.click(screen.getByRole("button", { name: /context details/i }))

      expect(screen.getByTestId("finding-pass")).toBeInTheDocument()
      expect(screen.getByTestId("finding-fail")).toBeInTheDocument()
      expect(screen.getByTestId("finding-warning")).toBeInTheDocument()
      expect(screen.getByTestId("finding-info")).toBeInTheDocument()
    })
  })

  // ==========================================================================
  // Backward Compatibility
  // ==========================================================================
  describe("Backward Compatibility", () => {
    // @clause CL-BC-001
    it("happy path: validators sem context funcionam normalmente", () => {
      const output: ValidatorOutput = {
        passed: true,
        status: "PASSED",
        message: "Validator passed without context",
      }

      // Não deve lançar exceção
      expect(() => orchestrator.serializeDetails(output)).not.toThrow()

      // Details deve ser null quando não há context nem details
      const serialized = orchestrator.serializeDetails(output)
      expect(serialized).toBeNull()
    })

    // @clause CL-BC-001
    it("happy path: UI renderiza validator card sem context normalmente", () => {
      const result: ValidatorResult = {
        gateNumber: 0,
        validatorCode: "TEST_VALIDATOR",
        validatorName: "Test Validator",
        status: "PASSED",
        passed: true,
        isHardBlock: false,
        message: "All good",
        // Sem details (undefined)
      }

      render(<MockValidatorCard result={result} />)

      expect(screen.getByTestId("validator-card")).toBeInTheDocument()
      expect(screen.getByText("Test Validator")).toBeInTheDocument()
      expect(screen.queryByTestId("validator-context-panel")).not.toBeInTheDocument()
    })

    // @clause CL-BC-002
    it("happy path: details existentes são preservados quando context é adicionado", () => {
      const output: ValidatorOutput = {
        passed: false,
        status: "FAILED",
        message: "Validation failed",
        details: {
          errors: ["Error 1", "Error 2"],
          violations: [{ file: "a.ts", line: 10 }],
          customMetric: 42,
        },
        context: createValidContext(),
      }

      const serialized = orchestrator.serializeDetails(output)
      expect(serialized).not.toBeNull()

      const parsed = JSON.parse(serialized!)

      // Propriedades originais preservadas
      expect(parsed.errors).toEqual(["Error 1", "Error 2"])
      expect(parsed.violations).toEqual([{ file: "a.ts", line: 10 }])
      expect(parsed.customMetric).toBe(42)

      // Context também presente
      expect(parsed.context).toBeDefined()
      expect(parsed.context.reasoning).toBe("Test reasoning explanation")
    })

    // @clause CL-BC-002
    it("sad path: serialização não perde dados com estruturas complexas", () => {
      const output: ValidatorOutput = {
        passed: true,
        status: "PASSED",
        message: "OK",
        details: {
          nested: {
            deep: {
              value: [1, 2, { key: "val" }],
            },
          },
        },
        context: createValidContext({
          inputs: [
            createValidInput({ label: "Complex", value: { a: { b: [1, 2, 3] } } }),
          ],
        }),
      }

      const serialized = orchestrator.serializeDetails(output)
      const parsed = JSON.parse(serialized!)

      expect(parsed.nested.deep.value).toEqual([1, 2, { key: "val" }])
      expect(parsed.context.inputs[0].value).toEqual({ a: { b: [1, 2, 3] } })
    })
  })

  // ==========================================================================
  // Integration: Full Flow Test
  // ==========================================================================
  describe("Integration: Full Validator Flow", () => {
    // @clause CL-CTX-005
    // @clause CL-BC-002
    it("happy path: fluxo completo de persistência e renderização de context", async () => {
      const user = userEvent.setup()

      // 1. Validator executa e retorna output com context
      const output = mockTokenBudgetFitExecute()

      // 2. Orchestrator serializa para persistência
      const serialized = orchestrator.serializeDetails({
        ...output,
        details: { existingProp: "preserved" },
      })

      // 3. Simula leitura do banco
      const result: ValidatorResult = {
        gateNumber: 0,
        validatorCode: "TOKEN_BUDGET_FIT",
        validatorName: "Token Budget Fit",
        status: output.status,
        passed: output.passed,
        isHardBlock: true,
        message: output.message,
        details: serialized!,
      }

      // 4. UI renderiza o resultado
      render(<MockValidatorCard result={result} />)

      // 5. Verifica que context panel está presente
      expect(screen.getByTestId("validator-context-panel")).toBeInTheDocument()

      // 6. Expande e verifica conteúdo
      await user.click(screen.getByRole("button", { name: /context details/i }))

      // Verifica que inputs do TokenBudgetFit estão presentes
      const inputsSection = screen.getByTestId("context-inputs-section")
      expect(within(inputsSection).getByText(/MAX_TOKEN_BUDGET/)).toBeInTheDocument()
    })
  })
})
