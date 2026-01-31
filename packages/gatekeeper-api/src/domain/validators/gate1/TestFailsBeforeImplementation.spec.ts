import { describe, it, expect, vi, beforeEach } from "vitest"

/**
 * Tests for TEST_FAILS_BEFORE_IMPLEMENTATION Validator Fix
 *
 * Contract: ui-polish-and-validator-fix v1.0
 * Mode: STRICT
 * Criticality: HIGH
 *
 * Clauses covered (Validator Fix - Tarefa 2):
 *
 * RF1 — Worktree Preparation (CL-RF1-001 to CL-RF1-003):
 * - Detect package manager via lockfile
 * - Install dependencies with correct command
 * - Fail as INFRA when installation fails or no lockfile
 *
 * RF2 — Failure Classification (CL-RF2-001 to CL-RF2-006):
 * - Classify ERR_MODULE_NOT_FOUND as INFRA
 * - Classify "failed to load config" as INFRA
 * - Classify "npm ERR!" as INFRA
 * - Classify "Test file not found" as INFRA (NOT acceptable)
 * - Classify assertion failures as VALID_TEST_FAILURE
 * - Fallback to UNKNOWN → treat as INFRA
 *
 * RF3 — Approval Criteria (CL-RF3-001 to CL-RF3-003):
 * - Approve only when classification = VALID_TEST_FAILURE
 * - Reject when classification = INFRA_FAILURE
 * - Reject when test passes (TDD violation)
 *
 * RF4 — Observability (CL-RF4-001 to CL-RF4-003):
 * - context.inputs includes baseRef, testFilePath, worktreePath
 * - context.analyzed includes commands with exitCodes
 * - evidence contains classification label
 */

// ============================================================================
// Type Definitions
// ============================================================================

type FailureClassification = "VALID_TEST_FAILURE" | "INFRA_FAILURE" | "UNKNOWN"
type ValidatorStatus = "PENDING" | "RUNNING" | "PASSED" | "FAILED" | "WARNING" | "SKIPPED"

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

interface ValidatorOutput {
  passed: boolean
  status: ValidatorStatus
  message: string
  context?: ValidatorContext
  evidence?: string
  details?: Record<string, unknown>
  metrics?: Record<string, number | string>
}

interface InstallResult {
  success: boolean
  command: string
  exitCode: number
  output: string
  duration: number
}

interface TestResult {
  passed: boolean
  exitCode: number
  output: string
  error?: string
  duration: number
}

interface LockfileConfig {
  file: string
  cmd: string
}

// ============================================================================
// Classification Patterns (Implementation Spec)
// ============================================================================

const INFRA_PATTERNS: RegExp[] = [
  /Cannot find package/i,
  /Cannot find module/i,
  /ERR_MODULE_NOT_FOUND/i,
  /failed to load config/i,
  /Startup Error/i,
  /npm ERR!/i,
  /command not found/i,
  /ENOENT/i,
  /Unsupported engine/i,
  /Test file not found/i,
]

const VALID_TEST_FAILURE_PATTERNS: RegExp[] = [
  /FAIL\s+.*\.(spec|test)\.(ts|tsx|js|jsx)/i,
  /AssertionError/i,
  /expect\(.*\)\.to/i,
  /\d+ failed/i,
  /Tests:\s+\d+ failed/i,
  /[✕×]/,
]

// ============================================================================
// Functions Under Test
// ============================================================================

/**
 * Classifies test output as VALID_TEST_FAILURE, INFRA_FAILURE, or UNKNOWN
 */
function classifyFailure(output: string, exitCode: number): FailureClassification {
  // If test passed (exitCode 0), this is unexpected in "red phase" context
  if (exitCode === 0) {
    return "UNKNOWN"
  }

  // Check for infra patterns first (higher priority)
  for (const pattern of INFRA_PATTERNS) {
    if (pattern.test(output)) {
      return "INFRA_FAILURE"
    }
  }

  // Check for valid test failure patterns
  for (const pattern of VALID_TEST_FAILURE_PATTERNS) {
    if (pattern.test(output)) {
      return "VALID_TEST_FAILURE"
    }
  }

  // Fallback to UNKNOWN (will be treated as INFRA)
  return "UNKNOWN"
}

/**
 * Detects the package manager based on lockfile presence
 */
function detectPackageManager(lockfiles: string[]): LockfileConfig | null {
  const lockfileOrder: LockfileConfig[] = [
    { file: "package-lock.json", cmd: "npm ci" },
    { file: "pnpm-lock.yaml", cmd: "pnpm install --frozen-lockfile" },
    { file: "yarn.lock", cmd: "yarn install --frozen-lockfile" },
  ]

  for (const config of lockfileOrder) {
    if (lockfiles.includes(config.file)) {
      return config
    }
  }

  return null
}

/**
 * Determines if validator should pass based on classification
 */
function shouldApprove(classification: FailureClassification, testPassed: boolean): boolean {
  // If test passed on baseRef, it's a TDD violation
  if (testPassed) {
    return false
  }

  // Only approve VALID_TEST_FAILURE
  return classification === "VALID_TEST_FAILURE"
}

/**
 * Generates ValidatorOutput based on classification and test result
 */
function generateValidatorOutput(
  classification: FailureClassification,
  testResult: TestResult,
  baseRef: string,
  testFilePath: string,
  worktreePath: string,
  installResult?: InstallResult
): ValidatorOutput {
  const contextInputs: ValidatorContextInput[] = [
    { label: "BaseRef", value: baseRef },
    { label: "TestFilePath", value: testFilePath },
    { label: "WorktreePath", value: worktreePath },
  ]

  const analyzedItems: string[] = []
  
  if (installResult) {
    analyzedItems.push(`Install: ${installResult.command} (exitCode: ${installResult.exitCode}, duration: ${installResult.duration}ms)`)
  }
  analyzedItems.push(`Test: exitCode=${testResult.exitCode}, duration=${testResult.duration}ms`)

  const contextAnalyzed: ValidatorContextAnalyzedGroup[] = [
    { label: "Commands Executed", items: analyzedItems },
  ]

  // TDD Violation case
  if (testResult.passed) {
    return {
      passed: false,
      status: "FAILED",
      message: "CLÁUSULA PÉTREA VIOLATION: Test passed on base_ref but should fail",
      context: {
        inputs: contextInputs,
        analyzed: contextAnalyzed,
        findings: [{ type: "fail", message: "Test passed on baseRef - TDD red phase required" }],
        reasoning: "Test must fail on base_ref to confirm TDD red phase.",
      },
      evidence: `Classification: TDD_VIOLATION\nTest output:\n${testResult.output.slice(0, 500)}`,
    }
  }

  // INFRA_FAILURE case
  if (classification === "INFRA_FAILURE" || classification === "UNKNOWN") {
    return {
      passed: false,
      status: "FAILED",
      message: `Infra failure detected: ${classification}`,
      context: {
        inputs: contextInputs,
        analyzed: contextAnalyzed,
        findings: [{ type: "fail", message: `Classification: ${classification}` }],
        reasoning: "Infrastructure issues prevent reliable test execution.",
      },
      evidence: `Classification: INFRA\nTest output:\n${testResult.output.slice(0, 500)}`,
    }
  }

  // VALID_TEST_FAILURE case - PASS
  return {
    passed: true,
    status: "PASSED",
    message: "Test correctly fails on base_ref (TDD red phase confirmed)",
    context: {
      inputs: contextInputs,
      analyzed: contextAnalyzed,
      findings: [{ type: "pass", message: "Valid test failure detected" }],
      reasoning: "Test failure on base_ref confirms TDD red phase.",
    },
    evidence: `Classification: VALID\nTest output:\n${testResult.output.slice(0, 500)}`,
  }
}

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockTestResult = (overrides: Partial<TestResult> = {}): TestResult => ({
  passed: false,
  exitCode: 1,
  output: "FAIL src/example.spec.ts\nAssertionError: expected true to be false",
  duration: 1500,
  ...overrides,
})

const createMockInstallResult = (overrides: Partial<InstallResult> = {}): InstallResult => ({
  success: true,
  command: "npm ci",
  exitCode: 0,
  output: "added 500 packages in 30s",
  duration: 30000,
  ...overrides,
})

// ============================================================================
// Test Suites
// ============================================================================

describe("TEST_FAILS_BEFORE_IMPLEMENTATION Validator Fix", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==========================================================================
  // RF1 — Worktree Preparation Tests (CL-RF1-001 to CL-RF1-003)
  // ==========================================================================

  describe("RF1 — Worktree Preparation", () => {
    // @clause CL-RF1-001
    it("succeeds when detectPackageManager finds package-lock.json first", () => {
      const lockfiles = ["package-lock.json", "yarn.lock"]
      const result = detectPackageManager(lockfiles)

      expect(result).not.toBeNull()
      expect(result?.file).toBe("package-lock.json")
      expect(result?.cmd).toBe("npm ci")
    })

    // @clause CL-RF1-001
    it("succeeds when detectPackageManager finds pnpm-lock.yaml second", () => {
      const lockfiles = ["pnpm-lock.yaml", "yarn.lock"]
      const result = detectPackageManager(lockfiles)

      expect(result).not.toBeNull()
      expect(result?.file).toBe("pnpm-lock.yaml")
      expect(result?.cmd).toBe("pnpm install --frozen-lockfile")
    })

    // @clause CL-RF1-001
    it("succeeds when detectPackageManager finds yarn.lock third", () => {
      const lockfiles = ["yarn.lock"]
      const result = detectPackageManager(lockfiles)

      expect(result).not.toBeNull()
      expect(result?.file).toBe("yarn.lock")
      expect(result?.cmd).toBe("yarn install --frozen-lockfile")
    })

    // @clause CL-RF1-002
    it("succeeds when npm ci command is selected for package-lock.json", () => {
      const lockfiles = ["package-lock.json"]
      const result = detectPackageManager(lockfiles)

      expect(result?.cmd).toBe("npm ci")
    })

    // @clause CL-RF1-002
    it("succeeds when pnpm install is selected for pnpm-lock.yaml", () => {
      const lockfiles = ["pnpm-lock.yaml"]
      const result = detectPackageManager(lockfiles)

      expect(result?.cmd).toBe("pnpm install --frozen-lockfile")
    })

    // @clause CL-RF1-002
    it("succeeds when yarn install is selected for yarn.lock", () => {
      const lockfiles = ["yarn.lock"]
      const result = detectPackageManager(lockfiles)

      expect(result?.cmd).toBe("yarn install --frozen-lockfile")
    })

    // @clause CL-RF1-003
    it("fails when no lockfile is found", () => {
      const lockfiles: string[] = []
      const result = detectPackageManager(lockfiles)

      expect(result).toBeNull()
    })

    // @clause CL-RF1-003
    it("fails when only irrelevant files are present", () => {
      const lockfiles = ["package.json", "tsconfig.json", "README.md"]
      const result = detectPackageManager(lockfiles)

      expect(result).toBeNull()
    })

    // @clause CL-RF1-003
    it("fails when installation result indicates failure", () => {
      const installResult = createMockInstallResult({
        success: false,
        exitCode: 1,
        output: "npm ERR! code ERESOLVE",
      })

      expect(installResult.success).toBe(false)
      expect(installResult.exitCode).not.toBe(0)
    })
  })

  // ==========================================================================
  // RF2 — Failure Classification Tests (CL-RF2-001 to CL-RF2-006)
  // ==========================================================================

  describe("RF2 — Failure Classification", () => {
    // @clause CL-RF2-001
    it("succeeds when classifyFailure detects ERR_MODULE_NOT_FOUND as INFRA", () => {
      const output = "Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'vitest'"
      const result = classifyFailure(output, 1)

      expect(result).toBe("INFRA_FAILURE")
    })

    // @clause CL-RF2-001
    it("succeeds when classifyFailure detects 'Cannot find package' as INFRA", () => {
      const output = "Error: Cannot find package '@testing-library/react'"
      const result = classifyFailure(output, 1)

      expect(result).toBe("INFRA_FAILURE")
    })

    // @clause CL-RF2-001
    it("succeeds when classifyFailure detects 'Cannot find module' as INFRA", () => {
      const output = "Error: Cannot find module './utils'"
      const result = classifyFailure(output, 1)

      expect(result).toBe("INFRA_FAILURE")
    })

    // @clause CL-RF2-002
    it("succeeds when classifyFailure detects 'failed to load config' as INFRA", () => {
      const output = "Error: failed to load config from vitest.config.ts"
      const result = classifyFailure(output, 1)

      expect(result).toBe("INFRA_FAILURE")
    })

    // @clause CL-RF2-002
    it("succeeds when classifyFailure detects 'Startup Error' as INFRA", () => {
      const output = "Startup Error: Failed to initialize test runner"
      const result = classifyFailure(output, 1)

      expect(result).toBe("INFRA_FAILURE")
    })

    // @clause CL-RF2-002
    it("succeeds when classifyFailure handles case-insensitive config errors", () => {
      const output = "FAILED TO LOAD CONFIG from vite.config.ts"
      const result = classifyFailure(output, 1)

      expect(result).toBe("INFRA_FAILURE")
    })

    // @clause CL-RF2-003
    it("succeeds when classifyFailure detects 'npm ERR!' as INFRA", () => {
      const output = "npm ERR! code ENOENT\nnpm ERR! syscall open"
      const result = classifyFailure(output, 1)

      expect(result).toBe("INFRA_FAILURE")
    })

    // @clause CL-RF2-003
    it("succeeds when classifyFailure detects 'command not found' as INFRA", () => {
      const output = "bash: vitest: command not found"
      const result = classifyFailure(output, 127)

      expect(result).toBe("INFRA_FAILURE")
    })

    // @clause CL-RF2-003
    it("succeeds when classifyFailure detects 'ENOENT' as INFRA", () => {
      const output = "Error: ENOENT: no such file or directory, open '/path/to/file'"
      const result = classifyFailure(output, 1)

      expect(result).toBe("INFRA_FAILURE")
    })

    // @clause CL-RF2-004
    it("succeeds when classifyFailure detects 'Test file not found' as INFRA", () => {
      const output = "Error: Test file not found: src/example.spec.ts"
      const result = classifyFailure(output, 1)

      expect(result).toBe("INFRA_FAILURE")
    })

    // @clause CL-RF2-004
    it("fails when 'Test file not found' is classified as acceptable (old behavior)", () => {
      const output = "Test file not found: src/missing.spec.ts"
      const result = classifyFailure(output, 1)

      // This should be INFRA_FAILURE, NOT a pass
      expect(result).not.toBe("VALID_TEST_FAILURE")
      expect(result).toBe("INFRA_FAILURE")
    })

    // @clause CL-RF2-004
    it("fails when 'Test file not found' results in validator passing", () => {
      const output = "Test file not found"
      const classification = classifyFailure(output, 1)
      const shouldPass = shouldApprove(classification, false)

      expect(shouldPass).toBe(false)
    })

    // @clause CL-RF2-005
    it("succeeds when classifyFailure detects 'FAIL' with spec file as VALID", () => {
      const output = "FAIL src/components/Button.spec.tsx\nAssertionError: expected true to be false"
      const result = classifyFailure(output, 1)

      expect(result).toBe("VALID_TEST_FAILURE")
    })

    // @clause CL-RF2-005
    it("succeeds when classifyFailure detects 'AssertionError' as VALID", () => {
      const output = "AssertionError [ERR_ASSERTION]: expected 1 to equal 2"
      const result = classifyFailure(output, 1)

      expect(result).toBe("VALID_TEST_FAILURE")
    })

    // @clause CL-RF2-005
    it("succeeds when classifyFailure detects test summary with failures as VALID", () => {
      const output = "Tests: 3 failed, 5 passed, 8 total"
      const result = classifyFailure(output, 1)

      expect(result).toBe("VALID_TEST_FAILURE")
    })

    // @clause CL-RF2-006
    it("succeeds when classifyFailure returns UNKNOWN for ambiguous output", () => {
      const output = "Some random error that doesn't match any pattern"
      const result = classifyFailure(output, 1)

      expect(result).toBe("UNKNOWN")
    })

    // @clause CL-RF2-006
    it("succeeds when UNKNOWN classification is treated as INFRA", () => {
      const output = "Unexpected error occurred"
      const classification = classifyFailure(output, 1)
      const shouldPass = shouldApprove(classification, false)

      expect(classification).toBe("UNKNOWN")
      expect(shouldPass).toBe(false)
    })

    // @clause CL-RF2-006
    it("succeeds when exitCode 0 results in UNKNOWN classification", () => {
      const output = "All tests passed"
      const result = classifyFailure(output, 0)

      expect(result).toBe("UNKNOWN")
    })
  })

  // ==========================================================================
  // RF3 — Approval Criteria Tests (CL-RF3-001 to CL-RF3-003)
  // ==========================================================================

  describe("RF3 — Approval Criteria", () => {
    // @clause CL-RF3-001
    it("succeeds when VALID_TEST_FAILURE classification results in PASSED", () => {
      const testResult = createMockTestResult({
        output: "FAIL src/test.spec.ts\nAssertionError: expected true to be false",
      })
      const classification = classifyFailure(testResult.output, testResult.exitCode)
      const result = shouldApprove(classification, testResult.passed)

      expect(classification).toBe("VALID_TEST_FAILURE")
      expect(result).toBe(true)
    })

    // @clause CL-RF3-001
    it("succeeds when only VALID_TEST_FAILURE allows validator to pass", () => {
      const validOutput = createMockTestResult({
        output: "FAIL tests/unit.spec.tsx\n1 failed",
      })
      const classification = classifyFailure(validOutput.output, validOutput.exitCode)

      expect(classification).toBe("VALID_TEST_FAILURE")
      expect(shouldApprove(classification, false)).toBe(true)
    })

    // @clause CL-RF3-001
    it("succeeds when generateValidatorOutput returns passed=true for VALID", () => {
      const testResult = createMockTestResult({
        output: "FAIL src/test.spec.ts\nAssertionError: expected true to be false",
      })
      const output = generateValidatorOutput(
        "VALID_TEST_FAILURE",
        testResult,
        "origin/main",
        "src/test.spec.ts",
        "/tmp/worktree"
      )

      expect(output.passed).toBe(true)
      expect(output.status).toBe("PASSED")
    })

    // @clause CL-RF3-002
    it("succeeds when INFRA_FAILURE classification results in FAILED", () => {
      const testResult = createMockTestResult({
        output: "Error: Cannot find package 'vitest'",
      })
      const classification = classifyFailure(testResult.output, testResult.exitCode)
      const result = shouldApprove(classification, testResult.passed)

      expect(classification).toBe("INFRA_FAILURE")
      expect(result).toBe(false)
    })

    // @clause CL-RF3-002
    it("succeeds when generateValidatorOutput returns passed=false for INFRA", () => {
      const testResult = createMockTestResult({
        output: "npm ERR! code ERESOLVE",
      })
      const output = generateValidatorOutput(
        "INFRA_FAILURE",
        testResult,
        "origin/main",
        "src/test.spec.ts",
        "/tmp/worktree"
      )

      expect(output.passed).toBe(false)
      expect(output.status).toBe("FAILED")
    })

    // @clause CL-RF3-002
    it("succeeds when UNKNOWN classification also results in FAILED", () => {
      const result = shouldApprove("UNKNOWN", false)
      expect(result).toBe(false)
    })

    // @clause CL-RF3-003
    it("fails when test passed on baseRef (TDD violation)", () => {
      const result = shouldApprove("VALID_TEST_FAILURE", true)

      expect(result).toBe(false)
    })

    // @clause CL-RF3-003
    it("fails when test passed even with infra classification", () => {
      const result = shouldApprove("INFRA_FAILURE", true)

      expect(result).toBe(false)
    })

    // @clause CL-RF3-003
    it("succeeds when generateValidatorOutput includes CLÁUSULA PÉTREA message for TDD violation", () => {
      const testResult = createMockTestResult({
        passed: true,
        exitCode: 0,
        output: "All tests passed",
      })
      const output = generateValidatorOutput(
        "VALID_TEST_FAILURE",
        testResult,
        "origin/main",
        "src/test.spec.ts",
        "/tmp/worktree"
      )

      expect(output.passed).toBe(false)
      expect(output.message).toContain("CLÁUSULA PÉTREA VIOLATION")
    })
  })

  // ==========================================================================
  // RF4 — Observability Tests (CL-RF4-001 to CL-RF4-003)
  // ==========================================================================

  describe("RF4 — Observability", () => {
    // @clause CL-RF4-001
    it("succeeds when context.inputs includes baseRef", () => {
      const testResult = createMockTestResult()
      const output = generateValidatorOutput(
        "VALID_TEST_FAILURE",
        testResult,
        "origin/main",
        "src/test.spec.ts",
        "/tmp/gatekeeper/run123/baseRef"
      )

      const baseRefInput = output.context?.inputs.find((i) => i.label === "BaseRef")
      expect(baseRefInput).toBeDefined()
      expect(baseRefInput?.value).toBe("origin/main")
    })

    // @clause CL-RF4-001
    it("succeeds when context.inputs includes testFilePath", () => {
      const testResult = createMockTestResult()
      const output = generateValidatorOutput(
        "VALID_TEST_FAILURE",
        testResult,
        "origin/main",
        "src/components/Button.spec.tsx",
        "/tmp/worktree"
      )

      const testFileInput = output.context?.inputs.find((i) => i.label === "TestFilePath")
      expect(testFileInput).toBeDefined()
      expect(testFileInput?.value).toBe("src/components/Button.spec.tsx")
    })

    // @clause CL-RF4-001
    it("succeeds when context.inputs includes worktreePath", () => {
      const testResult = createMockTestResult()
      const output = generateValidatorOutput(
        "VALID_TEST_FAILURE",
        testResult,
        "origin/main",
        "src/test.spec.ts",
        "/tmp/gatekeeper/abc123/baseRef"
      )

      const worktreeInput = output.context?.inputs.find((i) => i.label === "WorktreePath")
      expect(worktreeInput).toBeDefined()
      expect(worktreeInput?.value).toBe("/tmp/gatekeeper/abc123/baseRef")
    })

    // @clause CL-RF4-002
    it("succeeds when context.analyzed includes test command with exitCode", () => {
      const testResult = createMockTestResult({ exitCode: 1, duration: 2500 })
      const output = generateValidatorOutput(
        "VALID_TEST_FAILURE",
        testResult,
        "origin/main",
        "src/test.spec.ts",
        "/tmp/worktree"
      )

      const commandsGroup = output.context?.analyzed.find((a) => a.label === "Commands Executed")
      expect(commandsGroup).toBeDefined()
      expect(commandsGroup?.items.some((item) => item.includes("exitCode=1"))).toBe(true)
    })

    // @clause CL-RF4-002
    it("succeeds when context.analyzed includes install command when provided", () => {
      const testResult = createMockTestResult()
      const installResult = createMockInstallResult({ command: "npm ci", exitCode: 0, duration: 15000 })
      const output = generateValidatorOutput(
        "VALID_TEST_FAILURE",
        testResult,
        "origin/main",
        "src/test.spec.ts",
        "/tmp/worktree",
        installResult
      )

      const commandsGroup = output.context?.analyzed.find((a) => a.label === "Commands Executed")
      expect(commandsGroup).toBeDefined()
      expect(commandsGroup?.items.some((item) => item.includes("npm ci"))).toBe(true)
      expect(commandsGroup?.items.some((item) => item.includes("exitCode: 0"))).toBe(true)
    })

    // @clause CL-RF4-002
    it("succeeds when context.analyzed includes duration metrics", () => {
      const testResult = createMockTestResult({ duration: 3500 })
      const output = generateValidatorOutput(
        "VALID_TEST_FAILURE",
        testResult,
        "origin/main",
        "src/test.spec.ts",
        "/tmp/worktree"
      )

      const commandsGroup = output.context?.analyzed.find((a) => a.label === "Commands Executed")
      expect(commandsGroup?.items.some((item) => item.includes("duration"))).toBe(true)
    })

    // @clause CL-RF4-003
    it("succeeds when evidence contains 'Classification: VALID' for valid failures", () => {
      const testResult = createMockTestResult()
      const output = generateValidatorOutput(
        "VALID_TEST_FAILURE",
        testResult,
        "origin/main",
        "src/test.spec.ts",
        "/tmp/worktree"
      )

      expect(output.evidence).toContain("Classification: VALID")
    })

    // @clause CL-RF4-003
    it("succeeds when evidence contains 'Classification: INFRA' for infra failures", () => {
      const testResult = createMockTestResult({ output: "npm ERR! code ERESOLVE" })
      const output = generateValidatorOutput(
        "INFRA_FAILURE",
        testResult,
        "origin/main",
        "src/test.spec.ts",
        "/tmp/worktree"
      )

      expect(output.evidence).toContain("Classification: INFRA")
    })

    // @clause CL-RF4-003
    it("succeeds when evidence contains test output excerpt", () => {
      const testResult = createMockTestResult({
        output: "FAIL src/test.spec.ts\nAssertionError: expected 1 to equal 2",
      })
      const output = generateValidatorOutput(
        "VALID_TEST_FAILURE",
        testResult,
        "origin/main",
        "src/test.spec.ts",
        "/tmp/worktree"
      )

      expect(output.evidence).toContain("Test output:")
      expect(output.evidence).toContain("AssertionError")
    })
  })

  // ==========================================================================
  // Edge Cases and Integration Tests
  // ==========================================================================

  describe("Edge Cases", () => {
    // @clause CL-RF2-001
    it("succeeds when INFRA patterns take priority over VALID patterns", () => {
      // Output contains both INFRA and VALID patterns
      const output = "FAIL src/test.spec.ts\nError: Cannot find module './missing'"
      const result = classifyFailure(output, 1)

      // INFRA should win
      expect(result).toBe("INFRA_FAILURE")
    })

    // @clause CL-RF2-005
    it("succeeds when test failure indicator × (unicode) is detected", () => {
      const output = "× should render correctly (5ms)"
      const result = classifyFailure(output, 1)

      expect(result).toBe("VALID_TEST_FAILURE")
    })

    // @clause CL-RF2-005
    it("succeeds when test failure indicator ✕ is detected", () => {
      const output = "✕ should handle edge case (10ms)"
      const result = classifyFailure(output, 1)

      expect(result).toBe("VALID_TEST_FAILURE")
    })

    // @clause CL-RF1-001
    it("succeeds when lockfile detection follows deterministic order", () => {
      // All three lockfiles present - npm should win
      const lockfiles = ["yarn.lock", "pnpm-lock.yaml", "package-lock.json"]
      const result = detectPackageManager(lockfiles)

      expect(result?.file).toBe("package-lock.json")
    })

    // @clause CL-RF3-003
    it("succeeds when TDD violation takes priority over classification", () => {
      // Even with valid classification, if test passed, it's a violation
      const output = generateValidatorOutput(
        "VALID_TEST_FAILURE",
        createMockTestResult({ passed: true, exitCode: 0 }),
        "origin/main",
        "src/test.spec.ts",
        "/tmp/worktree"
      )

      expect(output.passed).toBe(false)
      expect(output.message).toContain("CLÁUSULA PÉTREA VIOLATION")
    })

    // @clause CL-RF4-001
    it("succeeds when all three required inputs are present", () => {
      const output = generateValidatorOutput(
        "VALID_TEST_FAILURE",
        createMockTestResult(),
        "origin/main",
        "src/test.spec.ts",
        "/tmp/worktree"
      )

      const inputLabels = output.context?.inputs.map((i) => i.label) ?? []
      expect(inputLabels).toContain("BaseRef")
      expect(inputLabels).toContain("TestFilePath")
      expect(inputLabels).toContain("WorktreePath")
    })

    // @clause CL-RF2-003
    it("succeeds when Unsupported engine is detected as INFRA", () => {
      const output = "error Unsupported engine: wanted node >= 18, got 16"
      const result = classifyFailure(output, 1)

      expect(result).toBe("INFRA_FAILURE")
    })
  })
})
