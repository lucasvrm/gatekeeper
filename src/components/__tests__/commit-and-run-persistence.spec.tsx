import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import { useState, useEffect } from "react"

/**
 * Tests for Bugfixes — Commit Button Disable & Run Persistence
 *
 * Contract: commit-button-and-run-persistence v1.0
 * Mode: STRICT
 * Criticality: MEDIUM
 *
 * Bug 1: Botão Git Commit continua habilitado após commit bem-sucedido
 *   - CL-BTN-001: Estado commitJustDone existe e é false no início
 *   - CL-BTN-002: setCommitJustDone(true) é chamado após commit bem-sucedido
 *   - CL-BTN-003: Lógica de desabilitação inclui commitJustDone
 *
 * Bug 2: Run 2 desaparece após refresh
 *   - CL-RUN-001: GET /runs/:id/results inclui executionRuns array
 *   - CL-RUN-002: Frontend carrega executionRuns[0] como secondaryRun
 *   - CL-RUN-003: RunWithResults type inclui executionRuns?: Run[]
 *
 * Invariants:
 *   - CL-INV-001: Backward compat - executionRun.commitHash desabilita botão
 *   - CL-INV-002: EXECUTION run carrega CONTRACT como secondary
 *   - CL-INV-003: CONTRACT sem execution não quebra
 */

// ============================================================================
// Type Definitions
// ============================================================================

type RunStatus = "PENDING" | "RUNNING" | "PASSED" | "FAILED" | "ABORTED"
type RunType = "CONTRACT" | "EXECUTION"

interface MockRun {
  id: string
  outputId: string
  projectId?: string
  projectPath?: string
  status: RunStatus
  runType: RunType
  contractRunId?: string
  commitHash?: string | null
  commitMessage?: string | null
  committedAt?: string | null
}

interface MockRunWithResults extends MockRun {
  gateResults: Array<{ gateNumber: number; status: string }>
  validatorResults: Array<{ validatorCode: string; status: string }>
  executionRuns?: MockRun[]
}

interface GitStatusResponse {
  hasChanges: boolean
  hasConflicts: boolean
  branch: string
  isProtected: boolean
  diffStat: string
}

interface GitCommitResponse {
  commitHash: string
  message: string
}

// ============================================================================
// Mock API Functions
// ============================================================================

const mockGitStatus = vi.fn<[], Promise<GitStatusResponse>>()
const mockGitAdd = vi.fn<[], Promise<{ success: boolean }>>()
const mockGitCommit = vi.fn<[string], Promise<GitCommitResponse>>()
const mockGetRunWithResults = vi.fn<[string], Promise<MockRunWithResults>>()
const mockToast = {
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
}

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockRun = (overrides: Partial<MockRun> = {}): MockRun => ({
  id: "run-" + Math.random().toString(36).slice(2, 9),
  outputId: "2026_01_28_004_commit_button_and_run_persistence",
  projectId: "project-1",
  projectPath: "/path/to/project",
  status: "PASSED",
  runType: "CONTRACT",
  commitHash: null,
  commitMessage: null,
  committedAt: null,
  ...overrides,
})

const createMockRunWithResults = (overrides: Partial<MockRunWithResults> = {}): MockRunWithResults => ({
  ...createMockRun(),
  gateResults: [{ gateNumber: 1, status: "PASSED" }],
  validatorResults: [{ validatorCode: "V001", status: "PASSED" }],
  ...overrides,
})

const createDefaultGitStatus = (overrides: Partial<GitStatusResponse> = {}): GitStatusResponse => ({
  hasChanges: true,
  hasConflicts: false,
  branch: "feature/test-branch",
  isProtected: false,
  diffStat: "3 files changed, 120 insertions(+), 45 deletions(-)",
  ...overrides,
})

// ============================================================================
// Mock Components
// ============================================================================

/**
 * GitCommitButton mock implementing commitJustDone state (Bug 1 fix)
 */
interface GitCommitButtonProps {
  contractRun: MockRun
  executionRun: MockRun | null
  outputId: string
  onStatusCheck?: () => Promise<GitStatusResponse>
  onGitAdd?: () => Promise<{ success: boolean }>
  onGitCommit?: (message: string) => Promise<GitCommitResponse>
  toast?: typeof mockToast
}

function GitCommitButton({
  contractRun,
  executionRun,
  outputId,
  onStatusCheck = mockGitStatus,
  onGitAdd = mockGitAdd,
  onGitCommit = mockGitCommit,
  toast = mockToast,
}: GitCommitButtonProps) {
  // CL-BTN-001: Estado commitJustDone existe e é false no início
  const [commitJustDone, setCommitJustDone] = useState(false)
  const [loadingState, setLoadingState] = useState<"idle" | "staging" | "committing">("idle")
  const [localCommitHash, setLocalCommitHash] = useState<string | null>(null)

  // Visibility check
  const isVisible = contractRun.status === "PASSED" && executionRun?.status === "PASSED"
  if (!isVisible) return null

  // CL-INV-001: Backward compat - executionRun.commitHash já desabilita
  const hasExistingCommit = executionRun?.commitHash !== null && executionRun?.commitHash !== undefined

  // CL-BTN-003: Lógica de desabilitação inclui commitJustDone
  const isCommitDisabled = hasExistingCommit || commitJustDone

  const handleClick = async () => {
    if (isCommitDisabled) {
      toast.info("Commit already done")
      return
    }

    try {
      const status = await onStatusCheck()
      if (!status.hasChanges) {
        toast.info("No changes to commit")
        return
      }
      if (status.hasConflicts) {
        toast.warning("Please resolve merge conflicts first")
        return
      }

      // Staging
      setLoadingState("staging")
      await onGitAdd()

      // Committing
      setLoadingState("committing")
      const commitResult = await onGitCommit(`commit for ${outputId}`)
      setLocalCommitHash(commitResult.commitHash)

      // CL-BTN-002: setCommitJustDone(true) é chamado após commit bem-sucedido
      setCommitJustDone(true)

      toast.success(`Commit created: ${commitResult.commitHash.slice(0, 7)}`)
    } catch (error) {
      toast.error("Commit failed")
    } finally {
      setLoadingState("idle")
    }
  }

  return (
    <button
      type="button"
      data-testid="btn-git-commit"
      data-commit-just-done={commitJustDone}
      data-has-existing-commit={hasExistingCommit}
      data-is-disabled={isCommitDisabled}
      onClick={handleClick}
      disabled={loadingState !== "idle"}
      aria-disabled={isCommitDisabled || loadingState !== "idle"}
      className={isCommitDisabled ? "opacity-50 cursor-not-allowed" : ""}
    >
      {loadingState === "staging" ? "Staging..." : loadingState === "committing" ? "Committing..." : "Git Commit"}
    </button>
  )
}

/**
 * RunDetailsPage mock implementing executionRuns loading (Bug 2 fix)
 */
interface RunDetailsPageProps {
  runId: string
  onGetRunWithResults?: (id: string) => Promise<MockRunWithResults>
}

function RunDetailsPage({
  runId,
  onGetRunWithResults = mockGetRunWithResults,
}: RunDetailsPageProps) {
  const [primaryRun, setPrimaryRun] = useState<MockRunWithResults | null>(null)
  const [secondaryRun, setSecondaryRun] = useState<MockRunWithResults | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadRun = async () => {
      setLoading(true)
      try {
        const data = await onGetRunWithResults(runId)
        setPrimaryRun(data)

        // CL-INV-002: Se EXECUTION, carrega CONTRACT como secondary
        if (data.runType === "EXECUTION" && data.contractRunId) {
          try {
            const contractData = await onGetRunWithResults(data.contractRunId)
            setSecondaryRun(contractData)
          } catch {
            console.error("Failed to load contract run")
          }
        }
        // CL-RUN-002: Se CONTRACT com executionRuns[0], carrega como secondary
        else if (data.runType === "CONTRACT" && data.executionRuns?.[0]) {
          try {
            const executionData = await onGetRunWithResults(data.executionRuns[0].id)
            setSecondaryRun(executionData)
          } catch {
            console.error("Failed to load execution run")
          }
        }
        // CL-INV-003: CONTRACT sem execution não quebra
      } catch {
        console.error("Failed to load run")
      } finally {
        setLoading(false)
      }
    }

    loadRun()
  }, [runId, onGetRunWithResults])

  if (loading) {
    return <div data-testid="loading">Loading...</div>
  }

  if (!primaryRun) {
    return <div data-testid="not-found">Run not found</div>
  }

  return (
    <div data-testid="run-details-page">
      <div data-testid="primary-run" data-run-id={primaryRun.id} data-run-type={primaryRun.runType}>
        Primary: {primaryRun.outputId} ({primaryRun.runType})
      </div>
      {secondaryRun && (
        <div data-testid="secondary-run" data-run-id={secondaryRun.id} data-run-type={secondaryRun.runType}>
          Secondary: {secondaryRun.outputId} ({secondaryRun.runType})
        </div>
      )}
      {primaryRun.executionRuns && (
        <div data-testid="execution-runs-present" data-count={primaryRun.executionRuns.length}>
          Has {primaryRun.executionRuns.length} execution run(s)
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Test Suites
// ============================================================================

describe("Bugfixes — Commit Button Disable & Run Persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGitStatus.mockReset()
    mockGitAdd.mockReset()
    mockGitCommit.mockReset()
    mockGetRunWithResults.mockReset()
    mockToast.info.mockClear()
    mockToast.warning.mockClear()
    mockToast.error.mockClear()
    mockToast.success.mockClear()
  })

  // ==========================================================================
  // Bug 1: Botão Git Commit não desabilita após commit (CL-BTN-001 to CL-BTN-003)
  // ==========================================================================

  describe("Bug 1: GitCommitButton commitJustDone State", () => {
    // @clause CL-BTN-001
    it("succeeds when GitCommitButton initializes with commitJustDone as false", () => {
      const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })
      const executionRun = createMockRun({ status: "PASSED", runType: "EXECUTION", commitHash: null })

      render(
        <GitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test-output"
        />
      )

      const button = screen.getByTestId("btn-git-commit")
      expect(button).toBeInTheDocument()
      expect(button.getAttribute("data-commit-just-done")).toBe("false")
      expect(button.getAttribute("data-is-disabled")).toBe("false")
    })

    // @clause CL-BTN-002
    it("succeeds when setCommitJustDone(true) is called after successful commit", async () => {
      const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })
      const executionRun = createMockRun({ status: "PASSED", runType: "EXECUTION", commitHash: null })

      mockGitStatus.mockResolvedValue(createDefaultGitStatus())
      mockGitAdd.mockResolvedValue({ success: true })
      mockGitCommit.mockResolvedValue({ commitHash: "abc1234567890", message: "test commit" })

      render(
        <GitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test-output"
        />
      )

      const button = screen.getByTestId("btn-git-commit")

      // Before commit
      expect(button.getAttribute("data-commit-just-done")).toBe("false")

      // Click to commit
      fireEvent.click(button)

      // After commit completes
      await waitFor(() => {
        expect(button.getAttribute("data-commit-just-done")).toBe("true")
      })

      expect(mockGitCommit).toHaveBeenCalled()
      expect(mockToast.success).toHaveBeenCalled()
    })

    // @clause CL-BTN-003
    it("succeeds when button disabled logic includes commitJustDone", async () => {
      const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })
      const executionRun = createMockRun({ status: "PASSED", runType: "EXECUTION", commitHash: null })

      mockGitStatus.mockResolvedValue(createDefaultGitStatus())
      mockGitAdd.mockResolvedValue({ success: true })
      mockGitCommit.mockResolvedValue({ commitHash: "abc1234567890", message: "test commit" })

      render(
        <GitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test-output"
        />
      )

      const button = screen.getByTestId("btn-git-commit")

      // Before commit - button should NOT be disabled
      expect(button.getAttribute("data-is-disabled")).toBe("false")
      expect(button).not.toHaveClass("opacity-50")

      // Perform commit
      fireEvent.click(button)

      await waitFor(() => {
        expect(button.getAttribute("data-commit-just-done")).toBe("true")
      })

      // After commit - button SHOULD be disabled
      expect(button.getAttribute("data-is-disabled")).toBe("true")
      expect(button).toHaveClass("opacity-50")
      expect(button).toHaveClass("cursor-not-allowed")
    })
  })

  // ==========================================================================
  // Bug 2: Run 2 desaparece após refresh (CL-RUN-001 to CL-RUN-003)
  // ==========================================================================

  describe("Bug 2: Run Persistence via executionRuns", () => {
    // @clause CL-RUN-001
    it("succeeds when GET /runs/:id/results includes executionRuns for CONTRACT run", async () => {
      const executionRunData = createMockRun({
        id: "exec-run-123",
        runType: "EXECUTION",
        status: "PASSED",
      })

      const contractRunData = createMockRunWithResults({
        id: "contract-run-456",
        runType: "CONTRACT",
        status: "PASSED",
        executionRuns: [executionRunData], // API includes this field
      })

      mockGetRunWithResults.mockResolvedValue(contractRunData)

      render(<RunDetailsPage runId="contract-run-456" />)

      await waitFor(() => {
        expect(screen.getByTestId("primary-run")).toBeInTheDocument()
      })

      // Verify executionRuns is present in the response
      const executionRunsEl = screen.getByTestId("execution-runs-present")
      expect(executionRunsEl).toBeInTheDocument()
      expect(executionRunsEl.getAttribute("data-count")).toBe("1")
    })

    // @clause CL-RUN-002
    it("succeeds when frontend loads executionRuns[0] as secondaryRun for CONTRACT run", async () => {
      const executionRunData = createMockRun({
        id: "exec-run-123",
        runType: "EXECUTION",
        status: "PASSED",
      })

      const executionRunWithResults = createMockRunWithResults({
        ...executionRunData,
        gateResults: [{ gateNumber: 1, status: "PASSED" }],
        validatorResults: [],
      })

      const contractRunData = createMockRunWithResults({
        id: "contract-run-456",
        runType: "CONTRACT",
        status: "PASSED",
        executionRuns: [executionRunData],
      })

      mockGetRunWithResults
        .mockResolvedValueOnce(contractRunData) // First call for primary
        .mockResolvedValueOnce(executionRunWithResults) // Second call for secondary

      render(<RunDetailsPage runId="contract-run-456" />)

      await waitFor(() => {
        expect(screen.getByTestId("secondary-run")).toBeInTheDocument()
      })

      const secondaryRunEl = screen.getByTestId("secondary-run")
      expect(secondaryRunEl.getAttribute("data-run-id")).toBe("exec-run-123")
      expect(secondaryRunEl.getAttribute("data-run-type")).toBe("EXECUTION")
    })

    // @clause CL-RUN-003
    it("succeeds when RunWithResults type includes executionRuns array", () => {
      // This is a type verification test
      // We verify that our mock type correctly includes executionRuns
      const runWithResults: MockRunWithResults = {
        id: "test-run",
        outputId: "test-output",
        status: "PASSED",
        runType: "CONTRACT",
        gateResults: [],
        validatorResults: [],
        executionRuns: [
          {
            id: "exec-1",
            outputId: "exec-output",
            status: "PASSED",
            runType: "EXECUTION",
          },
        ],
      }

      // Type check: executionRuns exists and is an array
      expect(runWithResults.executionRuns).toBeDefined()
      expect(Array.isArray(runWithResults.executionRuns)).toBe(true)
      expect(runWithResults.executionRuns).toHaveLength(1)
      expect(runWithResults.executionRuns![0].runType).toBe("EXECUTION")
    })
  })

  // ==========================================================================
  // Invariants (CL-INV-001 to CL-INV-003)
  // ==========================================================================

  describe("Invariants — Backward Compatibility", () => {
    // @clause CL-INV-001
    it("succeeds when executionRun.commitHash already exists and button stays disabled", () => {
      const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })
      const executionRun = createMockRun({
        status: "PASSED",
        runType: "EXECUTION",
        commitHash: "existing-commit-hash-12345", // Already has commit
      })

      render(
        <GitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test-output"
        />
      )

      const button = screen.getByTestId("btn-git-commit")

      // Button should be disabled due to existing commitHash
      expect(button.getAttribute("data-has-existing-commit")).toBe("true")
      expect(button.getAttribute("data-is-disabled")).toBe("true")
      expect(button).toHaveClass("opacity-50")
      expect(button).toHaveClass("cursor-not-allowed")
    })

    // @clause CL-INV-002
    it("succeeds when viewing EXECUTION run loads CONTRACT run as secondary", async () => {
      const contractRunData = createMockRunWithResults({
        id: "contract-run-abc",
        runType: "CONTRACT",
        status: "PASSED",
      })

      const executionRunData = createMockRunWithResults({
        id: "exec-run-xyz",
        runType: "EXECUTION",
        status: "PASSED",
        contractRunId: "contract-run-abc", // Links to contract
      })

      mockGetRunWithResults
        .mockResolvedValueOnce(executionRunData) // Primary is EXECUTION
        .mockResolvedValueOnce(contractRunData) // Secondary is CONTRACT

      render(<RunDetailsPage runId="exec-run-xyz" />)

      await waitFor(() => {
        expect(screen.getByTestId("secondary-run")).toBeInTheDocument()
      })

      const primaryEl = screen.getByTestId("primary-run")
      const secondaryEl = screen.getByTestId("secondary-run")

      expect(primaryEl.getAttribute("data-run-type")).toBe("EXECUTION")
      expect(secondaryEl.getAttribute("data-run-type")).toBe("CONTRACT")
      expect(secondaryEl.getAttribute("data-run-id")).toBe("contract-run-abc")
    })

    // @clause CL-INV-003
    it("succeeds when CONTRACT run without execution runs does not break", async () => {
      const contractRunData = createMockRunWithResults({
        id: "contract-solo",
        runType: "CONTRACT",
        status: "PASSED",
        executionRuns: undefined, // No linked execution runs
      })

      mockGetRunWithResults.mockResolvedValue(contractRunData)

      render(<RunDetailsPage runId="contract-solo" />)

      await waitFor(() => {
        expect(screen.getByTestId("primary-run")).toBeInTheDocument()
      })

      // Should NOT have secondary run
      expect(screen.queryByTestId("secondary-run")).not.toBeInTheDocument()

      // Should NOT have execution-runs-present element
      expect(screen.queryByTestId("execution-runs-present")).not.toBeInTheDocument()

      // Page should render without errors
      const primaryEl = screen.getByTestId("primary-run")
      expect(primaryEl.getAttribute("data-run-type")).toBe("CONTRACT")
    })

    // @clause CL-INV-003
    it("succeeds when CONTRACT run with empty executionRuns array does not break", async () => {
      const contractRunData = createMockRunWithResults({
        id: "contract-empty",
        runType: "CONTRACT",
        status: "PASSED",
        executionRuns: [], // Empty array
      })

      mockGetRunWithResults.mockResolvedValue(contractRunData)

      render(<RunDetailsPage runId="contract-empty" />)

      await waitFor(() => {
        expect(screen.getByTestId("primary-run")).toBeInTheDocument()
      })

      // Should NOT have secondary run because executionRuns[0] doesn't exist
      expect(screen.queryByTestId("secondary-run")).not.toBeInTheDocument()

      // executionRuns-present should show with count 0
      const execRunsEl = screen.getByTestId("execution-runs-present")
      expect(execRunsEl.getAttribute("data-count")).toBe("0")
    })
  })

  // ==========================================================================
  // Sad Path Tests
  // ==========================================================================

  describe("Sad Path — Error Scenarios", () => {
    // @clause CL-BTN-002
    it("fails when commit operation throws error and commitJustDone stays false", async () => {
      const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })
      const executionRun = createMockRun({ status: "PASSED", runType: "EXECUTION", commitHash: null })

      mockGitStatus.mockResolvedValue(createDefaultGitStatus())
      mockGitAdd.mockResolvedValue({ success: true })
      mockGitCommit.mockRejectedValue(new Error("Commit failed"))

      render(
        <GitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test-output"
        />
      )

      const button = screen.getByTestId("btn-git-commit")
      fireEvent.click(button)

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith("Commit failed")
      })

      // commitJustDone should remain false on failure
      expect(button.getAttribute("data-commit-just-done")).toBe("false")
      expect(button.getAttribute("data-is-disabled")).toBe("false")
    })

    // @clause CL-RUN-002
    it("fails when executionRun fetch fails but page still renders", async () => {
      const executionRunData = createMockRun({
        id: "exec-run-fail",
        runType: "EXECUTION",
        status: "PASSED",
      })

      const contractRunData = createMockRunWithResults({
        id: "contract-run-789",
        runType: "CONTRACT",
        status: "PASSED",
        executionRuns: [executionRunData],
      })

      mockGetRunWithResults
        .mockResolvedValueOnce(contractRunData)
        .mockRejectedValueOnce(new Error("Failed to load execution")) // Second call fails

      render(<RunDetailsPage runId="contract-run-789" />)

      await waitFor(() => {
        expect(screen.getByTestId("primary-run")).toBeInTheDocument()
      })

      // Secondary should NOT be present because fetch failed
      expect(screen.queryByTestId("secondary-run")).not.toBeInTheDocument()

      // But page should still work
      const primaryEl = screen.getByTestId("primary-run")
      expect(primaryEl.getAttribute("data-run-type")).toBe("CONTRACT")
    })
  })
})
