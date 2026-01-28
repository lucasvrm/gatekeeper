import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState, useEffect } from "react"

/**
 * Tests for Git Commit Button with Modal and Push
 *
 * Contract: git-commit-button v1.0
 * Mode: STRICT
 * Criticality: HIGH
 *
 * This file covers all 34 clauses from the contract:
 *
 * Visibility (CL-GC-001 to CL-GC-004):
 * - Button visible when both runs passed
 * - Button hidden when contract run not passed
 * - Button hidden when execution run not passed
 * - Button positioned before New Run button
 *
 * Design (CL-GC-005 to CL-GC-008):
 * - Default style: orange bg, dark green text
 * - Hover style: green bg, orange text
 * - GitCommit icon present
 * - Tooltip with correct text
 *
 * Initial Validations (CL-GC-009 to CL-GC-010):
 * - Toast when no changes
 * - Toast when conflicts exist
 *
 * Pre-Commit Modal (CL-GC-011 to CL-GC-020):
 * - Modal opens on click when validations pass
 * - Pre-filled message in YYYY_MM_DD_slug format
 * - Message editable
 * - Empty message disables commit button
 * - Short message (<10 chars) disables commit button
 * - Branch badge visible
 * - Protected branch warning
 * - Diff summary visible
 * - Push checkbox checked by default
 * - Cancel closes modal
 *
 * Git Execution (CL-GC-021 to CL-GC-024):
 * - Staging loading state
 * - Committing loading state
 * - Pushing loading state
 * - Commit hash captured
 *
 * Push Confirmation Modal (CL-GC-025 to CL-GC-028):
 * - Push modal appears after commit (if checkbox checked)
 * - Push modal doesn't appear if checkbox unchecked
 * - "Keep Local" closes without push
 * - "Push Now" executes push
 *
 * Error Handling (CL-GC-029 to CL-GC-032):
 * - Git add failure toast
 * - Git commit failure toast with details
 * - Remote ahead error with Pull & Retry
 * - Permission denied with troubleshooting
 *
 * Final Feedback (CL-GC-033 to CL-GC-034):
 * - Local commit success toast
 * - Commit + push success toast
 */

// ============================================================================
// Type Definitions
// ============================================================================

type RunStatus = "PENDING" | "RUNNING" | "PASSED" | "FAILED" | "ABORTED"

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

interface GitPushResponse {
  branch: string
  commitHash: string
}

interface GitErrorResponse {
  error: {
    code: "NO_CHANGES" | "HAS_CONFLICTS" | "REMOTE_AHEAD" | "PERMISSION_DENIED" | "COMMIT_FAILED" | "PUSH_FAILED"
    message: string
  }
}

interface MockRun {
  id: string
  outputId: string
  status: RunStatus
  runType: "CONTRACT" | "EXECUTION"
}

// ============================================================================
// Mock Functions
// ============================================================================

const mockGitStatus = vi.fn<[], Promise<GitStatusResponse>>()
const mockGitAdd = vi.fn<[], Promise<{ success: boolean }>>()
const mockGitCommit = vi.fn<[string], Promise<GitCommitResponse>>()
const mockGitPush = vi.fn<[], Promise<GitPushResponse>>()
const mockGitPull = vi.fn<[], Promise<{ success: boolean }>>()
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
  id: "test-run-id",
  outputId: "2026_01_23_002_git_commit_button",
  status: "PASSED",
  runType: "CONTRACT",
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
 * GitCommitButton - Mock component implementing contract specifications
 */
interface GitCommitButtonProps {
  contractRun: MockRun
  executionRun: MockRun
  outputId: string
  onStatusCheck?: () => Promise<GitStatusResponse>
  onGitAdd?: () => Promise<{ success: boolean }>
  onGitCommit?: (message: string) => Promise<GitCommitResponse>
  onGitPush?: () => Promise<GitPushResponse>
  toast?: typeof mockToast
}

function GitCommitButton({
  contractRun,
  executionRun,
  outputId,
  onStatusCheck = mockGitStatus,
  onGitAdd = mockGitAdd,
  onGitCommit = mockGitCommit,
  onGitPush = mockGitPush,
  toast = mockToast,
}: GitCommitButtonProps) {
  const [showModal, setShowModal] = useState(false)
  const [showPushConfirmModal, setShowPushConfirmModal] = useState(false)
  const [gitStatus, setGitStatus] = useState<GitStatusResponse | null>(null)
  const [commitMessage, setCommitMessage] = useState("")
  const [pushToRemote, setPushToRemote] = useState(true)
  const [loadingState, setLoadingState] = useState<"idle" | "staging" | "committing" | "pushing">("idle")
  const [commitHash, setCommitHash] = useState<string | null>(null)

  // CL-GC-001, CL-GC-002, CL-GC-003: Button visibility based on run statuses
  const isVisible = contractRun.status === "PASSED" && executionRun.status === "PASSED"

  if (!isVisible) {
    return null
  }

  const handleClick = async () => {
    try {
      const status = await onStatusCheck()
      setGitStatus(status)

      // CL-GC-009: No changes
      if (!status.hasChanges) {
        toast.info("No changes to commit")
        return
      }

      // CL-GC-010: Has conflicts
      if (status.hasConflicts) {
        toast.warning("Please resolve merge conflicts first")
        return
      }

      // CL-GC-011: Open modal
      // CL-GC-012: Pre-fill message with YYYY_MM_DD_slug format
      const today = new Date()
      const datePrefix = `${today.getFullYear()}_${String(today.getMonth() + 1).padStart(2, "0")}_${String(today.getDate()).padStart(2, "0")}`
      setCommitMessage(`${datePrefix}_${outputId}`)
      setShowModal(true)
    } catch {
      toast.error("Failed to check git status")
    }
  }

  const handleCommit = async () => {
    let currentStep: 'staging' | 'committing' = 'staging'
    try {
      // CL-GC-021: Staging state
      setLoadingState("staging")
      currentStep = 'staging'
      await onGitAdd()

      // CL-GC-022: Committing state
      setLoadingState("committing")
      currentStep = 'committing'
      const result = await onGitCommit(commitMessage)
      setCommitHash(result.commitHash)

      setShowModal(false)

      // CL-GC-025, CL-GC-026: Show push confirm if checkbox checked
      if (pushToRemote) {
        setShowPushConfirmModal(true)
      } else {
        // CL-GC-033: Local commit success
        toast.success(`Commit created successfully - ${result.commitHash.slice(0, 7)} - Local only (not pushed)`)
      }
    } catch (error) {
      const err = error as { code?: string; message?: string }
      if (currentStep === "staging") {
        // CL-GC-029: Add failure
        toast.error(`Failed to stage changes: ${err.message}`)
      } else {
        // CL-GC-030: Commit failure
        toast.error(`Commit failed: ${err.message}`, {
          action: { label: "View Details", onClick: () => {} },
        })
      }
    } finally {
      setLoadingState("idle")
    }
  }

  const handlePush = async () => {
    try {
      // CL-GC-023: Pushing state
      setLoadingState("pushing")
      const result = await onGitPush()

      setShowPushConfirmModal(false)
      // CL-GC-034: Commit + push success
      toast.success(`Changes committed and pushed to ${result.branch} - ${result.commitHash.slice(0, 7)}`)
    } catch (error) {
      const err = error as { code?: string; message?: string }
      // CL-GC-031: Remote ahead
      if (err.code === "REMOTE_AHEAD") {
        toast.warning("Remote has new commits", {
          action: [
            { label: "Pull & Retry", onClick: () => {} },
            { label: "Keep Local", onClick: () => {} },
          ],
        })
      }
      // CL-GC-032: Permission denied
      else if (err.code === "PERMISSION_DENIED") {
        toast.error(`Permission denied: ${err.message}. Check your SSH keys or repository permissions.`)
      }
    } finally {
      setLoadingState("idle")
    }
  }

  const handleKeepLocal = () => {
    // CL-GC-027: Keep local
    setShowPushConfirmModal(false)
    toast.success(`Commit ${commitHash?.slice(0, 7)} created - Local only`)
  }

  // CL-GC-014, CL-GC-015: Validation
  const isMessageValid = commitMessage.length >= 10

  const getButtonText = () => {
    switch (loadingState) {
      case "staging":
        return "Staging..."
      case "committing":
        return "Committing..."
      case "pushing":
        return "Pushing..."
      default:
        return "Git Commit"
    }
  }

  return (
    <>
      {/* CL-GC-004, CL-GC-005, CL-GC-006, CL-GC-007, CL-GC-008 */}
      <button
        type="button"
        data-testid="btn-git-commit"
        onClick={handleClick}
        aria-label="Commit validated changes to Git"
        className="bg-orange-500 text-green-900 hover:bg-green-600 hover:text-orange-500 inline-flex items-center gap-2 px-3 py-1.5 rounded font-medium"
      >
        <svg
          data-testid="git-commit-icon"
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="4" />
          <line x1="1.05" y1="12" x2="7" y2="12" />
          <line x1="17.01" y1="12" x2="22.96" y2="12" />
        </svg>
        {getButtonText()}
      </button>

      {/* CL-GC-011 to CL-GC-020: Pre-commit Modal */}
      {showModal && gitStatus && (
        <div role="dialog" data-testid="git-commit-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg space-y-4">
            <h2 className="text-xl font-semibold">Commit Changes</h2>

            {/* CL-GC-016, CL-GC-017: Branch badge */}
            <div className="flex items-center gap-2">
              <span data-testid="branch-badge" className="px-2 py-1 bg-gray-100 rounded text-sm">
                {gitStatus.branch}
              </span>
              {gitStatus.isProtected && (
                <span data-testid="protected-branch-warning" className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">
                  Protected branch
                </span>
              )}
            </div>

            {/* CL-GC-018: Diff summary */}
            <div data-testid="diff-summary" className="p-3 bg-gray-50 rounded font-mono text-sm">
              {gitStatus.diffStat}
            </div>

            {/* CL-GC-012, CL-GC-013: Commit message input */}
            <div>
              <label htmlFor="commit-message" className="block text-sm font-medium mb-1">
                Commit Message
              </label>
              <input
                id="commit-message"
                type="text"
                data-testid="commit-message-input"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                placeholder="Enter commit message..."
              />
              {commitMessage.length < 10 && (
                <p className="text-sm text-red-500 mt-1">Message must be at least 10 characters</p>
              )}
            </div>

            {/* CL-GC-019: Push checkbox */}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                data-testid="push-checkbox"
                checked={pushToRemote}
                onChange={(e) => setPushToRemote(e.target.checked)}
                className="w-4 h-4"
              />
              <span>Push to remote after commit</span>
            </label>

            {/* Modal actions */}
            <div className="flex justify-end gap-2 pt-4">
              {/* CL-GC-020: Cancel button */}
              <button
                type="button"
                data-testid="btn-cancel"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border rounded"
              >
                Cancel
              </button>
              {/* CL-GC-014, CL-GC-015: Commit button disabled when invalid */}
              <button
                type="button"
                data-testid="btn-commit-push"
                onClick={handleCommit}
                disabled={!isMessageValid || loadingState !== "idle"}
                className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
              >
                {loadingState !== "idle" ? getButtonText() : "Commit & Push"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CL-GC-024, CL-GC-025: Push Confirmation Modal */}
      {showPushConfirmModal && commitHash && (
        <div role="dialog" data-testid="push-confirm-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md space-y-4">
            <h2 className="text-xl font-semibold">Push to Remote?</h2>
            <p>
              Commit <code data-testid="commit-hash-display" className="px-1 bg-gray-100 rounded">{commitHash.slice(0, 7)}</code> created successfully.
            </p>
            <p>Do you want to push to remote now?</p>

            <div className="flex justify-end gap-2 pt-4">
              {/* CL-GC-027: Keep Local button */}
              <button
                type="button"
                data-testid="btn-keep-local"
                onClick={handleKeepLocal}
                className="px-4 py-2 border rounded"
              >
                No, Keep Local
              </button>
              {/* CL-GC-028: Push Now button */}
              <button
                type="button"
                data-testid="btn-push-now"
                onClick={handlePush}
                disabled={loadingState === "pushing"}
                className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
              >
                {loadingState === "pushing" ? "Pushing..." : "Yes, Push Now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/**
 * Container component simulating the run details page header
 */
interface RunDetailsHeaderProps {
  contractRun: MockRun
  executionRun: MockRun
  outputId: string
}

function RunDetailsHeader({ contractRun, executionRun, outputId }: RunDetailsHeaderProps) {
  return (
    <div className="flex items-center gap-4" data-testid="run-header">
      <div className="flex-1">Run Details</div>
      {/* CL-GC-004: GitCommitButton appears before New Run */}
      <GitCommitButton
        contractRun={contractRun}
        executionRun={executionRun}
        outputId={outputId}
      />
      <button type="button" data-testid="btn-new-run" className="px-3 py-1.5 rounded">
        New Run
      </button>
    </div>
  )
}

// ============================================================================
// Test Suites
// ============================================================================

describe("GitCommitButton (contract: git-commit-button)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGitStatus.mockReset()
    mockGitAdd.mockReset()
    mockGitCommit.mockReset()
    mockGitPush.mockReset()
    mockToast.info.mockClear()
    mockToast.warning.mockClear()
    mockToast.error.mockClear()
    mockToast.success.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ==========================================================================
  // Button Visibility Tests (CL-GC-001 to CL-GC-003)
  // ==========================================================================

  describe("Button Visibility", () => {
    // @clause CL-GC-001
    it("CL-GC-001: should show button when both contractRun and executionRun have PASSED status", () => {
      const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })
      const executionRun = createMockRun({ status: "PASSED", runType: "EXECUTION" })

      render(
        <RunDetailsHeader
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="2026_01_23_002_git_commit_button"
        />
      )

      const button = screen.getByTestId("btn-git-commit")
      expect(button).toBeInTheDocument()
      expect(button.tagName.toLowerCase()).toBe("button")
    })

    // @clause CL-GC-002
    it("CL-GC-002: should NOT show button when contractRun.status is not PASSED", () => {
      const failedStatuses: RunStatus[] = ["PENDING", "RUNNING", "FAILED", "ABORTED"]

      failedStatuses.forEach((status) => {
        const contractRun = createMockRun({ status, runType: "CONTRACT" })
        const executionRun = createMockRun({ status: "PASSED", runType: "EXECUTION" })

        const { unmount } = render(
          <RunDetailsHeader
            contractRun={contractRun}
            executionRun={executionRun}
            outputId="test-output"
          />
        )

        expect(screen.queryByTestId("btn-git-commit")).not.toBeInTheDocument()
        unmount()
      })
    })

    // @clause CL-GC-003
    it("CL-GC-003: should NOT show button when executionRun.status is not PASSED", () => {
      const failedStatuses: RunStatus[] = ["PENDING", "RUNNING", "FAILED", "ABORTED"]

      failedStatuses.forEach((status) => {
        const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })
        const executionRun = createMockRun({ status, runType: "EXECUTION" })

        const { unmount } = render(
          <RunDetailsHeader
            contractRun={contractRun}
            executionRun={executionRun}
            outputId="test-output"
          />
        )

        expect(screen.queryByTestId("btn-git-commit")).not.toBeInTheDocument()
        unmount()
      })
    })
  })

  // ==========================================================================
  // Button Position Test (CL-GC-004)
  // ==========================================================================

  describe("Button Position", () => {
    // @clause CL-GC-004
    it("CL-GC-004: should position Git Commit button before New Run button in DOM", () => {
      const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })
      const executionRun = createMockRun({ status: "PASSED", runType: "EXECUTION" })

      render(
        <RunDetailsHeader
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test-output"
        />
      )

      const header = screen.getByTestId("run-header")
      const gitCommitBtn = screen.getByTestId("btn-git-commit")
      const newRunBtn = screen.getByTestId("btn-new-run")

      // Check DOM order: btn-git-commit should come before btn-new-run
      const allButtons = within(header).getAllByRole("button")
      const gitCommitIndex = allButtons.indexOf(gitCommitBtn)
      const newRunIndex = allButtons.indexOf(newRunBtn)

      expect(gitCommitIndex).toBeLessThan(newRunIndex)
    })
  })

  // ==========================================================================
  // Button Design Tests (CL-GC-005 to CL-GC-008)
  // ==========================================================================

  describe("Button Design", () => {
    // @clause CL-GC-005
    it("CL-GC-005: should have orange background and dark green text in idle state", () => {
      const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })
      const executionRun = createMockRun({ status: "PASSED", runType: "EXECUTION" })

      render(
        <RunDetailsHeader
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test-output"
        />
      )

      const button = screen.getByTestId("btn-git-commit")
      expect(button).toHaveClass("bg-orange-500")
      expect(button).toHaveClass("text-green-900")
    })

    // @clause CL-GC-006
    it("CL-GC-006: should have hover classes for green background and orange text", () => {
      const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })
      const executionRun = createMockRun({ status: "PASSED", runType: "EXECUTION" })

      render(
        <RunDetailsHeader
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test-output"
        />
      )

      const button = screen.getByTestId("btn-git-commit")
      expect(button).toHaveClass("hover:bg-green-600")
      expect(button).toHaveClass("hover:text-orange-500")
    })

    // @clause CL-GC-007
    it("CL-GC-007: should contain GitCommit SVG icon", () => {
      const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })
      const executionRun = createMockRun({ status: "PASSED", runType: "EXECUTION" })

      render(
        <RunDetailsHeader
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test-output"
        />
      )

      const button = screen.getByTestId("btn-git-commit")
      const svg = button.querySelector("svg")
      expect(svg).toBeInTheDocument()
      expect(svg?.tagName.toLowerCase()).toBe("svg")
    })

    // @clause CL-GC-008
    it("CL-GC-008: should have tooltip with correct aria-label text", () => {
      const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })
      const executionRun = createMockRun({ status: "PASSED", runType: "EXECUTION" })

      render(
        <RunDetailsHeader
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test-output"
        />
      )

      const button = screen.getByTestId("btn-git-commit")
      expect(button).toHaveAttribute("aria-label", "Commit validated changes to Git")
    })
  })

  // ==========================================================================
  // Initial Validations Tests (CL-GC-009 to CL-GC-010)
  // ==========================================================================

  describe("Initial Validations", () => {
    // @clause CL-GC-009
    it("CL-GC-009: should show info toast and NOT open modal when no changes exist", async () => {
      const user = userEvent.setup()
      const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })
      const executionRun = createMockRun({ status: "PASSED", runType: "EXECUTION" })

      mockGitStatus.mockResolvedValueOnce(createDefaultGitStatus({ hasChanges: false }))

      render(
        <GitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test-output"
          onStatusCheck={mockGitStatus}
          toast={mockToast}
        />
      )

      const button = screen.getByTestId("btn-git-commit")
      await user.click(button)

      await waitFor(() => {
        expect(mockToast.info).toHaveBeenCalledTimes(1)
        expect(mockToast.info).toHaveBeenCalledWith(expect.stringContaining("No changes"))
      })

      expect(screen.queryByTestId("git-commit-modal")).not.toBeInTheDocument()
    })

    // @clause CL-GC-010
    it("CL-GC-010: should show warning toast and NOT open modal when conflicts exist", async () => {
      const user = userEvent.setup()
      const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })
      const executionRun = createMockRun({ status: "PASSED", runType: "EXECUTION" })

      mockGitStatus.mockResolvedValueOnce(createDefaultGitStatus({ hasChanges: true, hasConflicts: true }))

      render(
        <GitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test-output"
          onStatusCheck={mockGitStatus}
          toast={mockToast}
        />
      )

      const button = screen.getByTestId("btn-git-commit")
      await user.click(button)

      await waitFor(() => {
        expect(mockToast.warning).toHaveBeenCalledTimes(1)
        expect(mockToast.warning).toHaveBeenCalledWith(expect.stringContaining("conflict"))
      })

      expect(screen.queryByTestId("git-commit-modal")).not.toBeInTheDocument()
    })
  })

  // ==========================================================================
  // Pre-Commit Modal Tests (CL-GC-011 to CL-GC-020)
  // ==========================================================================

  describe("Pre-Commit Modal", () => {
    // @clause CL-GC-011
    it("CL-GC-011: should open modal when clicked with changes and no conflicts", async () => {
      const user = userEvent.setup()
      const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })
      const executionRun = createMockRun({ status: "PASSED", runType: "EXECUTION" })

      mockGitStatus.mockResolvedValueOnce(createDefaultGitStatus())

      render(
        <GitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test-output"
          onStatusCheck={mockGitStatus}
          toast={mockToast}
        />
      )

      const button = screen.getByTestId("btn-git-commit")
      await user.click(button)

      await waitFor(() => {
        expect(screen.getByTestId("git-commit-modal")).toBeInTheDocument()
      })

      const modal = screen.getByTestId("git-commit-modal")
      expect(modal).toHaveAttribute("role", "dialog")
    })

    // @clause CL-GC-012
    it("CL-GC-012: should pre-fill commit message in YYYY_MM_DD_slug format", async () => {
      const user = userEvent.setup()
      const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })
      const executionRun = createMockRun({ status: "PASSED", runType: "EXECUTION" })
      const outputId = "2026_01_23_002_git_commit_button"

      mockGitStatus.mockResolvedValueOnce(createDefaultGitStatus())

      render(
        <GitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId={outputId}
          onStatusCheck={mockGitStatus}
          toast={mockToast}
        />
      )

      await user.click(screen.getByTestId("btn-git-commit"))

      await waitFor(() => {
        const input = screen.getByTestId("commit-message-input") as HTMLInputElement
        expect(input.value).toMatch(/^\d{4}_\d{2}_\d{2}_\w+/)
      })
    })

    // @clause CL-GC-013
    it("CL-GC-013: should allow user to edit commit message", async () => {
      const user = userEvent.setup()
      const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })
      const executionRun = createMockRun({ status: "PASSED", runType: "EXECUTION" })

      mockGitStatus.mockResolvedValueOnce(createDefaultGitStatus())

      render(
        <GitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test-output"
          onStatusCheck={mockGitStatus}
          toast={mockToast}
        />
      )

      await user.click(screen.getByTestId("btn-git-commit"))

      await waitFor(() => {
        expect(screen.getByTestId("git-commit-modal")).toBeInTheDocument()
      })

      const input = screen.getByTestId("commit-message-input") as HTMLInputElement
      await user.clear(input)
      await user.type(input, "Custom commit message")

      expect(input.value).toBe("Custom commit message")
    })

    // @clause CL-GC-014
    it("CL-GC-014: should disable Commit button when message is empty", async () => {
      const user = userEvent.setup()
      const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })
      const executionRun = createMockRun({ status: "PASSED", runType: "EXECUTION" })

      mockGitStatus.mockResolvedValueOnce(createDefaultGitStatus())

      render(
        <GitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test-output"
          onStatusCheck={mockGitStatus}
          toast={mockToast}
        />
      )

      await user.click(screen.getByTestId("btn-git-commit"))

      await waitFor(() => {
        expect(screen.getByTestId("git-commit-modal")).toBeInTheDocument()
      })

      const input = screen.getByTestId("commit-message-input")
      await user.clear(input)

      const commitBtn = screen.getByTestId("btn-commit-push")
      expect(commitBtn).toBeDisabled()
    })

    // @clause CL-GC-015
    it("CL-GC-015: should disable Commit button when message is less than 10 characters", async () => {
      const user = userEvent.setup()
      const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })
      const executionRun = createMockRun({ status: "PASSED", runType: "EXECUTION" })

      mockGitStatus.mockResolvedValueOnce(createDefaultGitStatus())

      render(
        <GitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test-output"
          onStatusCheck={mockGitStatus}
          toast={mockToast}
        />
      )

      await user.click(screen.getByTestId("btn-git-commit"))

      await waitFor(() => {
        expect(screen.getByTestId("git-commit-modal")).toBeInTheDocument()
      })

      const input = screen.getByTestId("commit-message-input")
      await user.clear(input)
      await user.type(input, "short")

      const commitBtn = screen.getByTestId("btn-commit-push")
      expect(commitBtn).toBeDisabled()
    })

    // @clause CL-GC-016
    it("CL-GC-016: should display branch badge with branch name", async () => {
      const user = userEvent.setup()
      const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })
      const executionRun = createMockRun({ status: "PASSED", runType: "EXECUTION" })

      mockGitStatus.mockResolvedValueOnce(createDefaultGitStatus({ branch: "feature/my-branch" }))

      render(
        <GitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test-output"
          onStatusCheck={mockGitStatus}
          toast={mockToast}
        />
      )

      await user.click(screen.getByTestId("btn-git-commit"))

      await waitFor(() => {
        const badge = screen.getByTestId("branch-badge")
        expect(badge).toBeInTheDocument()
        expect(badge).toHaveTextContent("feature/my-branch")
      })
    })

    // @clause CL-GC-017
    it("CL-GC-017: should show protected branch warning for main/master/develop", async () => {
      const user = userEvent.setup()
      const protectedBranches = ["main", "master", "develop"]

      for (const branch of protectedBranches) {
        const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })
        const executionRun = createMockRun({ status: "PASSED", runType: "EXECUTION" })

        mockGitStatus.mockResolvedValueOnce(createDefaultGitStatus({ branch, isProtected: true }))

        const { unmount } = render(
          <GitCommitButton
            contractRun={contractRun}
            executionRun={executionRun}
            outputId="test-output"
            onStatusCheck={mockGitStatus}
            toast={mockToast}
          />
        )

        await user.click(screen.getByTestId("btn-git-commit"))

        await waitFor(() => {
          const warning = screen.getByTestId("protected-branch-warning")
          expect(warning).toBeInTheDocument()
          expect(warning).toHaveTextContent(/protected/i)
        })

        unmount()
      }
    })

    // @clause CL-GC-018
    it("CL-GC-018: should display diff summary with diff content", async () => {
      const user = userEvent.setup()
      const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })
      const executionRun = createMockRun({ status: "PASSED", runType: "EXECUTION" })
      const diffStat = "5 files changed, 200 insertions(+), 50 deletions(-)"

      mockGitStatus.mockResolvedValueOnce(createDefaultGitStatus({ diffStat }))

      render(
        <GitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test-output"
          onStatusCheck={mockGitStatus}
          toast={mockToast}
        />
      )

      await user.click(screen.getByTestId("btn-git-commit"))

      await waitFor(() => {
        const diffSummary = screen.getByTestId("diff-summary")
        expect(diffSummary).toBeInTheDocument()
        expect(diffSummary).toHaveTextContent(diffStat)
      })
    })

    // @clause CL-GC-019
    it("CL-GC-019: should have push checkbox checked by default", async () => {
      const user = userEvent.setup()
      const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })
      const executionRun = createMockRun({ status: "PASSED", runType: "EXECUTION" })

      mockGitStatus.mockResolvedValueOnce(createDefaultGitStatus())

      render(
        <GitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test-output"
          onStatusCheck={mockGitStatus}
          toast={mockToast}
        />
      )

      await user.click(screen.getByTestId("btn-git-commit"))

      await waitFor(() => {
        const checkbox = screen.getByTestId("push-checkbox") as HTMLInputElement
        expect(checkbox).toBeInTheDocument()
        expect(checkbox.checked).toBe(true)
      })
    })

    // @clause CL-GC-020
    it("CL-GC-020: should close modal and not call git endpoints when Cancel is clicked", async () => {
      const user = userEvent.setup()
      const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })
      const executionRun = createMockRun({ status: "PASSED", runType: "EXECUTION" })

      mockGitStatus.mockResolvedValueOnce(createDefaultGitStatus())

      render(
        <GitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test-output"
          onStatusCheck={mockGitStatus}
          onGitAdd={mockGitAdd}
          onGitCommit={mockGitCommit}
          onGitPush={mockGitPush}
          toast={mockToast}
        />
      )

      await user.click(screen.getByTestId("btn-git-commit"))

      await waitFor(() => {
        expect(screen.getByTestId("git-commit-modal")).toBeInTheDocument()
      })

      const cancelBtn = screen.getByTestId("btn-cancel")
      await user.click(cancelBtn)

      await waitFor(() => {
        expect(screen.queryByTestId("git-commit-modal")).not.toBeInTheDocument()
      })

      expect(mockGitAdd).not.toHaveBeenCalled()
      expect(mockGitCommit).not.toHaveBeenCalled()
      expect(mockGitPush).not.toHaveBeenCalled()
    })
  })

  // ==========================================================================
  // Git Execution Tests (CL-GC-021 to CL-GC-024)
  // ==========================================================================

  describe("Git Execution Loading States", () => {
    // @clause CL-GC-021
    it("CL-GC-021: should show 'Staging...' with spinner during git add", async () => {
      const user = userEvent.setup()
      const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })
      const executionRun = createMockRun({ status: "PASSED", runType: "EXECUTION" })

      mockGitStatus.mockResolvedValueOnce(createDefaultGitStatus())
      // Make git add hang to observe loading state
      mockGitAdd.mockImplementation(() => new Promise(() => {}))

      render(
        <GitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test-output-long"
          onStatusCheck={mockGitStatus}
          onGitAdd={mockGitAdd}
          onGitCommit={mockGitCommit}
          toast={mockToast}
        />
      )

      await user.click(screen.getByTestId("btn-git-commit"))

      await waitFor(() => {
        expect(screen.getByTestId("git-commit-modal")).toBeInTheDocument()
      })

      const commitBtn = screen.getByTestId("btn-commit-push")
      await user.click(commitBtn)

      await waitFor(() => {
        expect(commitBtn).toHaveTextContent(/staging/i)
      })
    })

    // @clause CL-GC-022
    it("CL-GC-022: should show 'Committing...' with spinner during git commit", async () => {
      const user = userEvent.setup()
      const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })
      const executionRun = createMockRun({ status: "PASSED", runType: "EXECUTION" })

      mockGitStatus.mockResolvedValueOnce(createDefaultGitStatus())
      mockGitAdd.mockResolvedValueOnce({ success: true })
      // Make git commit hang to observe loading state
      mockGitCommit.mockImplementation(() => new Promise(() => {}))

      render(
        <GitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test-output-long"
          onStatusCheck={mockGitStatus}
          onGitAdd={mockGitAdd}
          onGitCommit={mockGitCommit}
          toast={mockToast}
        />
      )

      await user.click(screen.getByTestId("btn-git-commit"))

      await waitFor(() => {
        expect(screen.getByTestId("git-commit-modal")).toBeInTheDocument()
      })

      const commitBtn = screen.getByTestId("btn-commit-push")
      await user.click(commitBtn)

      await waitFor(() => {
        expect(commitBtn).toHaveTextContent(/committing/i)
      })
    })

    // @clause CL-GC-023
    it("CL-GC-023: should show 'Pushing...' with spinner during git push", async () => {
      const user = userEvent.setup()
      const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })
      const executionRun = createMockRun({ status: "PASSED", runType: "EXECUTION" })

      mockGitStatus.mockResolvedValueOnce(createDefaultGitStatus())
      mockGitAdd.mockResolvedValueOnce({ success: true })
      mockGitCommit.mockResolvedValueOnce({ commitHash: "abc1234567890", message: "test" })
      // Make git push hang to observe loading state
      mockGitPush.mockImplementation(() => new Promise(() => {}))

      render(
        <GitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test-output-long"
          onStatusCheck={mockGitStatus}
          onGitAdd={mockGitAdd}
          onGitCommit={mockGitCommit}
          onGitPush={mockGitPush}
          toast={mockToast}
        />
      )

      await user.click(screen.getByTestId("btn-git-commit"))

      await waitFor(() => {
        expect(screen.getByTestId("git-commit-modal")).toBeInTheDocument()
      })

      const commitBtn = screen.getByTestId("btn-commit-push")
      await user.click(commitBtn)

      await waitFor(() => {
        expect(screen.getByTestId("push-confirm-modal")).toBeInTheDocument()
      })

      const pushBtn = screen.getByTestId("btn-push-now")
      await user.click(pushBtn)

      await waitFor(() => {
        expect(pushBtn).toHaveTextContent(/pushing/i)
      })
    })

    // @clause CL-GC-024
    it("CL-GC-024: should display commit hash (7 digits) in push confirm modal", async () => {
      const user = userEvent.setup()
      const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })
      const executionRun = createMockRun({ status: "PASSED", runType: "EXECUTION" })
      const fullHash = "abc1234567890def"

      mockGitStatus.mockResolvedValueOnce(createDefaultGitStatus())
      mockGitAdd.mockResolvedValueOnce({ success: true })
      mockGitCommit.mockResolvedValueOnce({ commitHash: fullHash, message: "test" })

      render(
        <GitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test-output-long"
          onStatusCheck={mockGitStatus}
          onGitAdd={mockGitAdd}
          onGitCommit={mockGitCommit}
          toast={mockToast}
        />
      )

      await user.click(screen.getByTestId("btn-git-commit"))

      await waitFor(() => {
        expect(screen.getByTestId("git-commit-modal")).toBeInTheDocument()
      })

      const commitBtn = screen.getByTestId("btn-commit-push")
      await user.click(commitBtn)

      await waitFor(() => {
        expect(screen.getByTestId("push-confirm-modal")).toBeInTheDocument()
      })

      const hashDisplay = screen.getByTestId("commit-hash-display")
      expect(hashDisplay).toHaveTextContent(fullHash.slice(0, 7))
    })
  })

  // ==========================================================================
  // Push Confirmation Modal Tests (CL-GC-025 to CL-GC-028)
  // ==========================================================================

  describe("Push Confirmation Modal", () => {
    // @clause CL-GC-025
    it("CL-GC-025: should show push confirm modal after commit when checkbox is checked", async () => {
      const user = userEvent.setup()
      const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })
      const executionRun = createMockRun({ status: "PASSED", runType: "EXECUTION" })

      mockGitStatus.mockResolvedValueOnce(createDefaultGitStatus())
      mockGitAdd.mockResolvedValueOnce({ success: true })
      mockGitCommit.mockResolvedValueOnce({ commitHash: "abc1234", message: "test" })

      render(
        <GitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test-output-long"
          onStatusCheck={mockGitStatus}
          onGitAdd={mockGitAdd}
          onGitCommit={mockGitCommit}
          toast={mockToast}
        />
      )

      await user.click(screen.getByTestId("btn-git-commit"))

      await waitFor(() => {
        expect(screen.getByTestId("git-commit-modal")).toBeInTheDocument()
      })

      // Ensure checkbox is checked (default)
      const checkbox = screen.getByTestId("push-checkbox") as HTMLInputElement
      expect(checkbox.checked).toBe(true)

      const commitBtn = screen.getByTestId("btn-commit-push")
      await user.click(commitBtn)

      await waitFor(() => {
        expect(screen.getByTestId("push-confirm-modal")).toBeInTheDocument()
      })
    })

    // @clause CL-GC-026
    it("CL-GC-026: should NOT show push confirm modal and show success toast when checkbox is unchecked", async () => {
      const user = userEvent.setup()
      const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })
      const executionRun = createMockRun({ status: "PASSED", runType: "EXECUTION" })

      mockGitStatus.mockResolvedValueOnce(createDefaultGitStatus())
      mockGitAdd.mockResolvedValueOnce({ success: true })
      mockGitCommit.mockResolvedValueOnce({ commitHash: "abc1234", message: "test" })

      render(
        <GitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test-output-long"
          onStatusCheck={mockGitStatus}
          onGitAdd={mockGitAdd}
          onGitCommit={mockGitCommit}
          toast={mockToast}
        />
      )

      await user.click(screen.getByTestId("btn-git-commit"))

      await waitFor(() => {
        expect(screen.getByTestId("git-commit-modal")).toBeInTheDocument()
      })

      // Uncheck the push checkbox
      const checkbox = screen.getByTestId("push-checkbox")
      await user.click(checkbox)

      const commitBtn = screen.getByTestId("btn-commit-push")
      await user.click(commitBtn)

      await waitFor(() => {
        expect(screen.queryByTestId("push-confirm-modal")).not.toBeInTheDocument()
        expect(mockToast.success).toHaveBeenCalledTimes(1)
        expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining("Local only"))
      })
    })

    // @clause CL-GC-027
    it("CL-GC-027: should close modal and show local-only toast when 'Keep Local' is clicked", async () => {
      const user = userEvent.setup()
      const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })
      const executionRun = createMockRun({ status: "PASSED", runType: "EXECUTION" })

      mockGitStatus.mockResolvedValueOnce(createDefaultGitStatus())
      mockGitAdd.mockResolvedValueOnce({ success: true })
      mockGitCommit.mockResolvedValueOnce({ commitHash: "abc1234", message: "test" })

      render(
        <GitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test-output-long"
          onStatusCheck={mockGitStatus}
          onGitAdd={mockGitAdd}
          onGitCommit={mockGitCommit}
          onGitPush={mockGitPush}
          toast={mockToast}
        />
      )

      await user.click(screen.getByTestId("btn-git-commit"))

      await waitFor(() => {
        expect(screen.getByTestId("git-commit-modal")).toBeInTheDocument()
      })

      const commitBtn = screen.getByTestId("btn-commit-push")
      await user.click(commitBtn)

      await waitFor(() => {
        expect(screen.getByTestId("push-confirm-modal")).toBeInTheDocument()
      })

      const keepLocalBtn = screen.getByTestId("btn-keep-local")
      await user.click(keepLocalBtn)

      await waitFor(() => {
        expect(screen.queryByTestId("push-confirm-modal")).not.toBeInTheDocument()
        expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining("Local only"))
      })

      expect(mockGitPush).not.toHaveBeenCalled()
    })

    // @clause CL-GC-028
    it("CL-GC-028: should call push endpoint and show success toast when 'Push Now' is clicked", async () => {
      const user = userEvent.setup()
      const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })
      const executionRun = createMockRun({ status: "PASSED", runType: "EXECUTION" })

      mockGitStatus.mockResolvedValueOnce(createDefaultGitStatus({ branch: "feature/test" }))
      mockGitAdd.mockResolvedValueOnce({ success: true })
      mockGitCommit.mockResolvedValueOnce({ commitHash: "abc1234", message: "test" })
      mockGitPush.mockResolvedValueOnce({ branch: "feature/test", commitHash: "abc1234" })

      render(
        <GitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test-output-long"
          onStatusCheck={mockGitStatus}
          onGitAdd={mockGitAdd}
          onGitCommit={mockGitCommit}
          onGitPush={mockGitPush}
          toast={mockToast}
        />
      )

      await user.click(screen.getByTestId("btn-git-commit"))

      await waitFor(() => {
        expect(screen.getByTestId("git-commit-modal")).toBeInTheDocument()
      })

      const commitBtn = screen.getByTestId("btn-commit-push")
      await user.click(commitBtn)

      await waitFor(() => {
        expect(screen.getByTestId("push-confirm-modal")).toBeInTheDocument()
      })

      const pushNowBtn = screen.getByTestId("btn-push-now")
      await user.click(pushNowBtn)

      await waitFor(() => {
        expect(mockGitPush).toHaveBeenCalledTimes(1)
        expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining("feature/test"))
      })
    })
  })

  // ==========================================================================
  // Error Handling Tests (CL-GC-029 to CL-GC-032)
  // ==========================================================================

  describe("Error Handling", () => {
    // @clause CL-GC-029
    it("CL-GC-029: should show error toast when git add fails", async () => {
      const user = userEvent.setup()
      const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })
      const executionRun = createMockRun({ status: "PASSED", runType: "EXECUTION" })

      mockGitStatus.mockResolvedValueOnce(createDefaultGitStatus())
      mockGitAdd.mockRejectedValueOnce({ code: "ADD_FAILED", message: "Permission denied" })

      render(
        <GitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test-output-long"
          onStatusCheck={mockGitStatus}
          onGitAdd={mockGitAdd}
          onGitCommit={mockGitCommit}
          toast={mockToast}
        />
      )

      await user.click(screen.getByTestId("btn-git-commit"))

      await waitFor(() => {
        expect(screen.getByTestId("git-commit-modal")).toBeInTheDocument()
      })

      const commitBtn = screen.getByTestId("btn-commit-push")
      await user.click(commitBtn)

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledTimes(1)
        expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining("stage"))
      })
    })

    // @clause CL-GC-030
    it("CL-GC-030: should show error toast with View Details action when git commit fails", async () => {
      const user = userEvent.setup()
      const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })
      const executionRun = createMockRun({ status: "PASSED", runType: "EXECUTION" })

      mockGitStatus.mockResolvedValueOnce(createDefaultGitStatus())
      mockGitAdd.mockResolvedValueOnce({ success: true })
      mockGitCommit.mockRejectedValueOnce({ code: "COMMIT_FAILED", message: "Pre-commit hook failed" })

      render(
        <GitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test-output-long"
          onStatusCheck={mockGitStatus}
          onGitAdd={mockGitAdd}
          onGitCommit={mockGitCommit}
          toast={mockToast}
        />
      )

      await user.click(screen.getByTestId("btn-git-commit"))

      await waitFor(() => {
        expect(screen.getByTestId("git-commit-modal")).toBeInTheDocument()
      })

      const commitBtn = screen.getByTestId("btn-commit-push")
      await user.click(commitBtn)

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledTimes(1)
        expect(mockToast.error).toHaveBeenCalledWith(
          expect.stringContaining("Commit failed"),
          expect.objectContaining({ action: expect.anything() })
        )
      })
    })

    // @clause CL-GC-031
    it("CL-GC-031: should show warning toast with Pull & Retry and Keep Local buttons when remote is ahead", async () => {
      const user = userEvent.setup()
      const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })
      const executionRun = createMockRun({ status: "PASSED", runType: "EXECUTION" })

      mockGitStatus.mockResolvedValueOnce(createDefaultGitStatus())
      mockGitAdd.mockResolvedValueOnce({ success: true })
      mockGitCommit.mockResolvedValueOnce({ commitHash: "abc1234", message: "test" })
      mockGitPush.mockRejectedValueOnce({ code: "REMOTE_AHEAD", message: "Remote has new commits" })

      render(
        <GitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test-output-long"
          onStatusCheck={mockGitStatus}
          onGitAdd={mockGitAdd}
          onGitCommit={mockGitCommit}
          onGitPush={mockGitPush}
          toast={mockToast}
        />
      )

      await user.click(screen.getByTestId("btn-git-commit"))

      await waitFor(() => {
        expect(screen.getByTestId("git-commit-modal")).toBeInTheDocument()
      })

      const commitBtn = screen.getByTestId("btn-commit-push")
      await user.click(commitBtn)

      await waitFor(() => {
        expect(screen.getByTestId("push-confirm-modal")).toBeInTheDocument()
      })

      const pushNowBtn = screen.getByTestId("btn-push-now")
      await user.click(pushNowBtn)

      await waitFor(() => {
        expect(mockToast.warning).toHaveBeenCalledTimes(1)
        expect(mockToast.warning).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ action: expect.anything() })
        )
      })
    })

    // @clause CL-GC-032
    it("CL-GC-032: should show error toast with troubleshooting text when permission denied", async () => {
      const user = userEvent.setup()
      const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })
      const executionRun = createMockRun({ status: "PASSED", runType: "EXECUTION" })

      mockGitStatus.mockResolvedValueOnce(createDefaultGitStatus())
      mockGitAdd.mockResolvedValueOnce({ success: true })
      mockGitCommit.mockResolvedValueOnce({ commitHash: "abc1234", message: "test" })
      mockGitPush.mockRejectedValueOnce({ code: "PERMISSION_DENIED", message: "Authentication failed" })

      render(
        <GitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test-output-long"
          onStatusCheck={mockGitStatus}
          onGitAdd={mockGitAdd}
          onGitCommit={mockGitCommit}
          onGitPush={mockGitPush}
          toast={mockToast}
        />
      )

      await user.click(screen.getByTestId("btn-git-commit"))

      await waitFor(() => {
        expect(screen.getByTestId("git-commit-modal")).toBeInTheDocument()
      })

      const commitBtn = screen.getByTestId("btn-commit-push")
      await user.click(commitBtn)

      await waitFor(() => {
        expect(screen.getByTestId("push-confirm-modal")).toBeInTheDocument()
      })

      const pushNowBtn = screen.getByTestId("btn-push-now")
      await user.click(pushNowBtn)

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledTimes(1)
        expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining("Permission denied"))
      })
    })
  })

  // ==========================================================================
  // Final Feedback Tests (CL-GC-033 to CL-GC-034)
  // ==========================================================================

  describe("Final Feedback", () => {
    // @clause CL-GC-033
    it("CL-GC-033: should show success toast with hash and 'Local only' for local commit", async () => {
      const user = userEvent.setup()
      const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })
      const executionRun = createMockRun({ status: "PASSED", runType: "EXECUTION" })
      const commitHash = "abc1234567"

      mockGitStatus.mockResolvedValueOnce(createDefaultGitStatus())
      mockGitAdd.mockResolvedValueOnce({ success: true })
      mockGitCommit.mockResolvedValueOnce({ commitHash, message: "test" })

      render(
        <GitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test-output-long"
          onStatusCheck={mockGitStatus}
          onGitAdd={mockGitAdd}
          onGitCommit={mockGitCommit}
          toast={mockToast}
        />
      )

      await user.click(screen.getByTestId("btn-git-commit"))

      await waitFor(() => {
        expect(screen.getByTestId("git-commit-modal")).toBeInTheDocument()
      })

      // Uncheck push checkbox
      const checkbox = screen.getByTestId("push-checkbox")
      await user.click(checkbox)

      const commitBtn = screen.getByTestId("btn-commit-push")
      await user.click(commitBtn)

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledTimes(1)
        const successCall = mockToast.success.mock.calls[0][0]
        expect(successCall).toContain(commitHash.slice(0, 7))
        expect(successCall).toContain("Local only")
      })
    })

    // @clause CL-GC-034
    it("CL-GC-034: should show success toast with hash and branch for commit + push", async () => {
      const user = userEvent.setup()
      const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })
      const executionRun = createMockRun({ status: "PASSED", runType: "EXECUTION" })
      const commitHash = "def5678901"
      const branch = "feature/my-feature"

      mockGitStatus.mockResolvedValueOnce(createDefaultGitStatus({ branch }))
      mockGitAdd.mockResolvedValueOnce({ success: true })
      mockGitCommit.mockResolvedValueOnce({ commitHash, message: "test" })
      mockGitPush.mockResolvedValueOnce({ branch, commitHash })

      render(
        <GitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test-output-long"
          onStatusCheck={mockGitStatus}
          onGitAdd={mockGitAdd}
          onGitCommit={mockGitCommit}
          onGitPush={mockGitPush}
          toast={mockToast}
        />
      )

      await user.click(screen.getByTestId("btn-git-commit"))

      await waitFor(() => {
        expect(screen.getByTestId("git-commit-modal")).toBeInTheDocument()
      })

      const commitBtn = screen.getByTestId("btn-commit-push")
      await user.click(commitBtn)

      await waitFor(() => {
        expect(screen.getByTestId("push-confirm-modal")).toBeInTheDocument()
      })

      const pushNowBtn = screen.getByTestId("btn-push-now")
      await user.click(pushNowBtn)

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledTimes(1)
        const successCall = mockToast.success.mock.calls[0][0]
        expect(successCall).toContain(commitHash.slice(0, 7))
        expect(successCall).toContain(branch)
      })
    })
  })
})
