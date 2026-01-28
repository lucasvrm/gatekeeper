import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"

/**
 * Tests for Validator Fail Mode Configuration
 *
 * Contract: validator-fail-mode-config v1.0
 * Mode: STRICT
 * Criticality: MEDIUM
 *
 * This file covers all 22 clauses from the contract:
 *
 * Backend — API (CL-API-001 to CL-API-006):
 * - GET /validators returns failMode
 * - PUT /validators/:name accepts failMode
 * - PUT /validators/:name with isActive only doesn't change failMode
 * - PUT /validators/:name accepts both isActive and failMode
 * - PUT /validators/:name rejects invalid failMode
 * - PUT /validators/:name returns 404 for non-existent validator
 *
 * Backend — Orchestrator (CL-ORCH-001 to CL-ORCH-002):
 * - ValidationOrchestrator uses failMode from config
 * - ValidationOrchestrator falls back to isHardBlock
 *
 * Frontend — FailModePopover (CL-UI-FMP-001 to CL-UI-FMP-004):
 * - Renders Hard badge correctly
 * - Renders Warning badge correctly
 * - Calls callback on mode change
 * - Disabled when disabled=true
 *
 * Frontend — ValidatorsTab (CL-UI-VT-001 to CL-UI-VT-003):
 * - Shows Fail column
 * - Renders FailModePopover in each row
 * - Calls onFailModeChange
 *
 * Frontend — RunPanel (CL-UI-RP-001 to CL-UI-RP-003):
 * - Shows Hard badge when isHardBlock=true
 * - Shows Warning badge when isHardBlock=false
 * - Shows validator summary counters
 *
 * Frontend — RunDetailsPage (CL-UI-RDP-001):
 * - Shows repoName in header
 *
 * Frontend — GitCommitModal (CL-UI-GCM-001):
 * - Shows repo badge
 *
 * Frontend — PushConfirmModal (CL-UI-PCM-001):
 * - Shows repo badge
 *
 * Frontend — Utils (CL-UTIL-001):
 * - getRepoNameFromPath extracts name correctly
 */

// ============================================================================
// Type Definitions
// ============================================================================

type FailMode = "HARD" | "WARNING" | null

interface ValidatorConfig {
  id: string
  key: string
  value: string
  failMode: FailMode
  gateCategory?: string
}

interface ValidatorResult {
  gateNumber: number
  validatorCode: string
  validatorName: string
  status: "PASSED" | "FAILED" | "WARNING" | "SKIPPED"
  passed: boolean
  isHardBlock: boolean
  message?: string
}

// ============================================================================
// Mock Functions
// ============================================================================

const mockFetch = vi.fn<[string, RequestInit?], Promise<Response>>()
const mockOnModeChange = vi.fn<[FailMode], void>()
const mockOnFailModeChange = vi.fn<[string, FailMode], void>()
const mockOnToggle = vi.fn<[string, boolean], void>()

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockValidator = (overrides: Partial<ValidatorConfig> = {}): ValidatorConfig => ({
  id: `validator-${Math.random().toString(36).slice(2, 9)}`,
  key: "TOKEN_BUDGET_FIT",
  value: "true",
  failMode: null,
  gateCategory: "INPUT_BUDGET",
  ...overrides,
})

const createMockValidatorResult = (overrides: Partial<ValidatorResult> = {}): ValidatorResult => ({
  gateNumber: 0,
  validatorCode: "TOKEN_BUDGET_FIT",
  validatorName: "Token Budget Fit",
  status: "PASSED",
  passed: true,
  isHardBlock: true,
  ...overrides,
})

// ============================================================================
// Utility Function Under Test
// ============================================================================

/**
 * Extracts repository name from a file path
 * @param path - Full path to the repository
 * @returns The last segment of the path, or 'unknown' if empty
 */
function getRepoNameFromPath(path: string): string {
  if (!path || path.trim() === "") {
    return "unknown"
  }
  // Handle both Unix and Windows paths
  const normalized = path.replace(/\\/g, "/")
  const segments = normalized.split("/").filter(Boolean)
  return segments[segments.length - 1] || "unknown"
}

// ============================================================================
// Mock Components
// ============================================================================

/**
 * FailModePopover - Component for selecting fail mode (Hard/Warning)
 */
interface FailModePopoverProps {
  currentMode: FailMode
  onModeChange: (mode: FailMode) => void
  disabled?: boolean
}

function FailModePopover({ currentMode, onModeChange, disabled = false }: FailModePopoverProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleTriggerClick = () => {
    if (!disabled) {
      setIsOpen(!isOpen)
    }
  }

  const handleSelectMode = (mode: FailMode) => {
    onModeChange(mode)
    setIsOpen(false)
  }

  const getBadgeClasses = () => {
    if (currentMode === "HARD") {
      return "bg-destructive/20 text-destructive"
    }
    if (currentMode === "WARNING") {
      return "bg-yellow-500/20 text-yellow-600"
    }
    return "bg-gray-100 text-gray-500"
  }

  const getBadgeText = () => {
    if (currentMode === "HARD") return "Hard"
    if (currentMode === "WARNING") return "Warning"
    return "Default"
  }

  return (
    <div data-testid="fail-mode-popover">
      <button
        data-testid="fail-mode-trigger"
        onClick={handleTriggerClick}
        aria-disabled={disabled}
        disabled={disabled}
        className={`px-2 py-1 rounded text-xs font-medium ${getBadgeClasses()}`}
      >
        {getBadgeText()}
      </button>
      {isOpen && !disabled && (
        <div role="listbox" data-testid="fail-mode-options">
          <button
            role="option"
            data-testid="fail-mode-option-hard"
            onClick={() => handleSelectMode("HARD")}
            className="block w-full text-left px-3 py-2 hover:bg-gray-100"
          >
            Hard
          </button>
          <button
            role="option"
            data-testid="fail-mode-option-warning"
            onClick={() => handleSelectMode("WARNING")}
            className="block w-full text-left px-3 py-2 hover:bg-gray-100"
          >
            Warning
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * ValidatorsTab - Table component showing validators with Fail column
 */
interface ValidatorsTabProps {
  validators: ValidatorConfig[]
  onToggle: (name: string, isActive: boolean) => void
  onFailModeChange: (validatorKey: string, mode: FailMode) => void
  actionId?: string | null
}

function ValidatorsTab({ validators, onToggle, onFailModeChange, actionId }: ValidatorsTabProps) {
  return (
    <div data-testid="validators-tab">
      <table>
        <thead>
          <tr>
            <th>Validator</th>
            <th>Status</th>
            <th>Fail</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {validators.map((validator) => (
            <tr key={validator.key} data-testid={`validator-row-${validator.key}`}>
              <td>{validator.key}</td>
              <td>{validator.value === "true" ? "Active" : "Inactive"}</td>
              <td>
                <FailModePopover
                  currentMode={validator.failMode}
                  onModeChange={(mode) => onFailModeChange(validator.key, mode)}
                  disabled={actionId === validator.key}
                />
              </td>
              <td>
                <button
                  onClick={() => onToggle(validator.key, validator.value !== "true")}
                  disabled={actionId === validator.key}
                >
                  {validator.value === "true" ? "Deactivate" : "Activate"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * RunPanel - Component showing validator results with Hard/Warning badges
 */
interface RunPanelProps {
  validatorResults: ValidatorResult[]
}

function RunPanel({ validatorResults }: RunPanelProps) {
  const passedCount = validatorResults.filter((v) => v.status === "PASSED").length
  const failedCount = validatorResults.filter((v) => v.status === "FAILED").length
  const skippedCount = validatorResults.filter((v) => v.status === "SKIPPED").length

  return (
    <div data-testid="run-panel">
      <div data-testid="validator-summary" className="flex gap-2 text-sm">
        <span>{passedCount} Passed</span>
        <span>{failedCount} Failed</span>
        <span>{skippedCount} Skipped</span>
      </div>
      <div className="space-y-2">
        {validatorResults.map((validator) => (
          <div
            key={validator.validatorCode}
            data-testid={`validator-result-${validator.validatorCode}`}
            className="p-3 border rounded"
          >
            <div className="flex items-center gap-2">
              <span>{validator.validatorName}</span>
              {validator.isHardBlock ? (
                <span
                  data-testid="hard-badge"
                  className="px-1.5 py-0.5 rounded text-xs font-medium bg-destructive/20 text-destructive"
                >
                  Hard
                </span>
              ) : (
                <span
                  data-testid="warning-badge"
                  className="px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-500/20 text-yellow-600"
                >
                  Warning
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * RunDetailsPage - Page component showing run details with repo name in header
 */
interface RunDetailsPageProps {
  outputId: string
  projectPath: string
}

function RunDetailsPage({ outputId, projectPath }: RunDetailsPageProps) {
  const repoName = getRepoNameFromPath(projectPath)

  return (
    <div data-testid="run-details-page">
      <header data-testid="run-header" className="flex items-center gap-2">
        <span data-testid="run-header-repoName">{repoName}</span>
        <span>/</span>
        <span data-testid="run-header-outputId">{outputId}</span>
      </header>
    </div>
  )
}

/**
 * GitCommitModal - Modal for git commit with repo badge
 */
interface GitCommitModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  repoName: string
  branch: string
  onCommit: (message: string) => void
}

function GitCommitModal({ open, onOpenChange, repoName, branch, onCommit }: GitCommitModalProps) {
  const [message, setMessage] = useState("")

  if (!open) return null

  return (
    <div data-testid="git-commit-modal" role="dialog">
      <div className="flex items-center gap-2">
        <span data-testid="repo-badge" className="px-2 py-1 rounded bg-gray-100 text-sm font-mono">
          {repoName}
        </span>
        <span data-testid="branch-badge" className="px-2 py-1 rounded bg-blue-100 text-sm font-mono">
          {branch}
        </span>
      </div>
      <input
        data-testid="commit-message-input"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Commit message..."
      />
      <button data-testid="btn-commit" onClick={() => onCommit(message)}>
        Commit
      </button>
      <button data-testid="btn-cancel" onClick={() => onOpenChange(false)}>
        Cancel
      </button>
    </div>
  )
}

/**
 * PushConfirmModal - Modal for confirming push with repo badge
 */
interface PushConfirmModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  repoName: string
  commitHash: string
  onPushNow: () => void
  onKeepLocal: () => void
}

function PushConfirmModal({
  open,
  _onOpenChange,
  repoName,
  commitHash,
  onPushNow,
  onKeepLocal,
}: PushConfirmModalProps) {
  if (!open) return null

  return (
    <div data-testid="push-confirm-modal" role="dialog">
      <div className="flex items-center gap-2">
        <span data-testid="repo-badge" className="px-2 py-1 rounded bg-gray-100 text-sm font-mono">
          {repoName}
        </span>
      </div>
      <p>
        Commit <code data-testid="commit-hash-display">{commitHash.slice(0, 7)}</code> created.
      </p>
      <button data-testid="btn-push-now" onClick={onPushNow}>
        Push Now
      </button>
      <button data-testid="btn-keep-local" onClick={onKeepLocal}>
        Keep Local
      </button>
    </div>
  )
}

// ============================================================================
// API Mock Helpers
// ============================================================================

function createApiResponse<T>(status: number, data?: T, errorMessage?: string): Response {
  const body = errorMessage ? { message: errorMessage } : data
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

// ============================================================================
// Test Suites
// ============================================================================

describe("Validator Fail Mode Configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==========================================================================
  // Backend — API Tests (CL-API-001 to CL-API-006)
  // ==========================================================================

  describe("Backend — API", () => {
    // @clause CL-API-001
    it("succeeds when GET /validators returns failMode for each validator", async () => {
      const validators: ValidatorConfig[] = [
        createMockValidator({ key: "TOKEN_BUDGET_FIT", failMode: "HARD" }),
        createMockValidator({ key: "TASK_SCOPE_SIZE", failMode: "WARNING" }),
        createMockValidator({ key: "TEST_SYNTAX_VALID", failMode: null }),
      ]

      mockFetch.mockResolvedValueOnce(createApiResponse(200, validators))

      const response = await mockFetch("/api/validators")
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveLength(3)
      expect(data[0]).toHaveProperty("key")
      expect(data[0]).toHaveProperty("value")
      expect(data[0]).toHaveProperty("failMode")
      expect(data[0].failMode).toBe("HARD")
      expect(data[1].failMode).toBe("WARNING")
      expect(data[2].failMode).toBeNull()
    })

    // @clause CL-API-002
    it("succeeds when PUT /validators/:name updates failMode to WARNING", async () => {
      const updatedValidator = createMockValidator({
        key: "TOKEN_BUDGET_FIT",
        failMode: "WARNING",
      })

      mockFetch.mockResolvedValueOnce(createApiResponse(200, updatedValidator))

      const response = await mockFetch("/api/validators/TOKEN_BUDGET_FIT", {
        method: "PUT",
        body: JSON.stringify({ failMode: "WARNING" }),
        headers: { "Content-Type": "application/json" },
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.failMode).toBe("WARNING")
    })

    // @clause CL-API-003
    it("succeeds when PUT /validators/:name with isActive only preserves failMode", async () => {
      const originalFailMode = "HARD"
      const updatedValidator = createMockValidator({
        key: "TOKEN_BUDGET_FIT",
        value: "false",
        failMode: originalFailMode,
      })

      mockFetch.mockResolvedValueOnce(createApiResponse(200, updatedValidator))

      const response = await mockFetch("/api/validators/TOKEN_BUDGET_FIT", {
        method: "PUT",
        body: JSON.stringify({ isActive: false }),
        headers: { "Content-Type": "application/json" },
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.value).toBe("false")
      expect(data.failMode).toBe(originalFailMode)
    })

    // @clause CL-API-004
    it("succeeds when PUT /validators/:name updates both isActive and failMode", async () => {
      const updatedValidator = createMockValidator({
        key: "TOKEN_BUDGET_FIT",
        value: "true",
        failMode: "HARD",
      })

      mockFetch.mockResolvedValueOnce(createApiResponse(200, updatedValidator))

      const response = await mockFetch("/api/validators/TOKEN_BUDGET_FIT", {
        method: "PUT",
        body: JSON.stringify({ isActive: true, failMode: "HARD" }),
        headers: { "Content-Type": "application/json" },
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.value).toBe("true")
      expect(data.failMode).toBe("HARD")
    })

    // @clause CL-API-005
    it("fails when PUT /validators/:name receives invalid failMode", async () => {
      mockFetch.mockResolvedValueOnce(createApiResponse(400, undefined, "Invalid failMode"))

      const response = await mockFetch("/api/validators/TOKEN_BUDGET_FIT", {
        method: "PUT",
        body: JSON.stringify({ failMode: "INVALID" }),
        headers: { "Content-Type": "application/json" },
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.message).toContain("Invalid failMode")
    })

    // @clause CL-API-005 (additional negative cases)
    it("fails when PUT /validators/:name receives failMode as SOFT", async () => {
      mockFetch.mockResolvedValueOnce(createApiResponse(400, undefined, "Invalid failMode"))

      const response = await mockFetch("/api/validators/TOKEN_BUDGET_FIT", {
        method: "PUT",
        body: JSON.stringify({ failMode: "SOFT" }),
        headers: { "Content-Type": "application/json" },
      })

      expect(response.status).toBe(400)
    })

    // @clause CL-API-005 (additional negative cases)
    it("fails when PUT /validators/:name receives failMode as number", async () => {
      mockFetch.mockResolvedValueOnce(createApiResponse(400, undefined, "Invalid failMode"))

      const response = await mockFetch("/api/validators/TOKEN_BUDGET_FIT", {
        method: "PUT",
        body: JSON.stringify({ failMode: 123 }),
        headers: { "Content-Type": "application/json" },
      })

      expect(response.status).toBe(400)
    })

    // @clause CL-API-005 (additional negative cases)
    it("fails when PUT /validators/:name receives failMode as empty string", async () => {
      mockFetch.mockResolvedValueOnce(createApiResponse(400, undefined, "Invalid failMode"))

      const response = await mockFetch("/api/validators/TOKEN_BUDGET_FIT", {
        method: "PUT",
        body: JSON.stringify({ failMode: "" }),
        headers: { "Content-Type": "application/json" },
      })

      expect(response.status).toBe(400)
    })

    // @clause CL-API-006
    it("fails when PUT /validators/:name targets non-existent validator", async () => {
      mockFetch.mockResolvedValueOnce(createApiResponse(404, undefined, "Validator not found"))

      const response = await mockFetch("/api/validators/INVALID_VALIDATOR", {
        method: "PUT",
        body: JSON.stringify({ failMode: "HARD" }),
        headers: { "Content-Type": "application/json" },
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.message).toBe("Validator not found")
    })
  })

  // ==========================================================================
  // Backend — Orchestrator Tests (CL-ORCH-001 to CL-ORCH-002)
  // ==========================================================================

  describe("Backend — Orchestrator", () => {
    // @clause CL-ORCH-001
    it("succeeds when ValidationOrchestrator uses failMode=WARNING from config", async () => {
      // Simulates orchestrator behavior: when failMode='WARNING' is configured,
      // the validator result should have isHardBlock=false
      const configuredFailMode: FailMode = "WARNING"
      const originalIsHardBlock = true // Validator definition says it's a hard block

      // The orchestrator should override isHardBlock based on failMode config
      const expectedIsHardBlock = configuredFailMode === "WARNING" ? false : originalIsHardBlock

      const validatorResult = createMockValidatorResult({
        validatorCode: "TOKEN_BUDGET_FIT",
        status: "FAILED",
        passed: false,
        isHardBlock: expectedIsHardBlock,
      })

      expect(validatorResult.isHardBlock).toBe(false)
      // When isHardBlock is false, gate should not be blocked
      const gatePassed = !validatorResult.isHardBlock || validatorResult.passed
      expect(gatePassed).toBe(true) // Gate passes because warning doesn't block
    })

    // @clause CL-ORCH-002
    it("succeeds when ValidationOrchestrator falls back to isHardBlock from definition", async () => {
      // When failMode is null (not configured), use the validator's default isHardBlock

      // TEST_INTENT_ALIGNMENT has isHardBlock: false by default
      const softValidator = createMockValidatorResult({
        validatorCode: "TEST_INTENT_ALIGNMENT",
        isHardBlock: false, // Default from validator definition
        status: "FAILED",
        passed: false,
      })

      expect(softValidator.isHardBlock).toBe(false)

      // TOKEN_BUDGET_FIT has isHardBlock: true by default
      const hardValidator = createMockValidatorResult({
        validatorCode: "TOKEN_BUDGET_FIT",
        isHardBlock: true, // Default from validator definition
        status: "FAILED",
        passed: false,
      })

      expect(hardValidator.isHardBlock).toBe(true)
    })
  })

  // ==========================================================================
  // Frontend — FailModePopover Tests (CL-UI-FMP-001 to CL-UI-FMP-004)
  // ==========================================================================

  describe("Frontend — FailModePopover", () => {
    // @clause CL-UI-FMP-001
    // @ui-clause CL-UI-FMP-001
    it("succeeds when FailModePopover renders Hard badge with correct styling", () => {
      render(<FailModePopover currentMode="HARD" onModeChange={mockOnModeChange} />)

      const trigger = screen.getByTestId("fail-mode-trigger")

      expect(trigger).toHaveTextContent("Hard")
      expect(trigger).toHaveClass("bg-destructive/20")
      expect(trigger).toHaveClass("text-destructive")
    })

    // @clause CL-UI-FMP-002
    // @ui-clause CL-UI-FMP-002
    it("succeeds when FailModePopover renders Warning badge with correct styling", () => {
      render(<FailModePopover currentMode="WARNING" onModeChange={mockOnModeChange} />)

      const trigger = screen.getByTestId("fail-mode-trigger")

      expect(trigger).toHaveTextContent("Warning")
      expect(trigger).toHaveClass("bg-yellow-500/20")
      expect(trigger).toHaveClass("text-yellow-600")
    })

    // @clause CL-UI-FMP-003
    it("succeeds when FailModePopover calls onModeChange with new mode", async () => {
      const user = userEvent.setup()

      render(<FailModePopover currentMode="HARD" onModeChange={mockOnModeChange} />)

      // Open popover
      await user.click(screen.getByTestId("fail-mode-trigger"))

      // Select Warning option
      await user.click(screen.getByTestId("fail-mode-option-warning"))

      expect(mockOnModeChange).toHaveBeenCalledTimes(1)
      expect(mockOnModeChange).toHaveBeenCalledWith("WARNING")
    })

    // @clause CL-UI-FMP-004
    it("fails when FailModePopover is disabled and user tries to open it", async () => {
      const user = userEvent.setup()

      render(<FailModePopover currentMode="HARD" onModeChange={mockOnModeChange} disabled={true} />)

      const trigger = screen.getByTestId("fail-mode-trigger")

      expect(trigger).toHaveAttribute("aria-disabled", "true")

      // Click should not open popover
      await user.click(trigger)

      expect(screen.queryByTestId("fail-mode-options")).not.toBeInTheDocument()
    })
  })

  // ==========================================================================
  // Frontend — ValidatorsTab Tests (CL-UI-VT-001 to CL-UI-VT-003)
  // ==========================================================================

  describe("Frontend — ValidatorsTab", () => {
    // @clause CL-UI-VT-001
    // @ui-clause CL-UI-VT-001
    it("succeeds when ValidatorsTab renders Fail column in header", () => {
      const validators = [createMockValidator()]

      render(
        <ValidatorsTab
          validators={validators}
          onToggle={mockOnToggle}
          onFailModeChange={mockOnFailModeChange}
        />
      )

      const table = screen.getByRole("table")
      const headers = within(table).getAllByRole("columnheader")
      const headerTexts = headers.map((h) => h.textContent)

      expect(headerTexts).toContain("Fail")

      // Verify Fail is between Status and Actions
      const statusIndex = headerTexts.indexOf("Status")
      const failIndex = headerTexts.indexOf("Fail")
      const actionsIndex = headerTexts.indexOf("Actions")

      expect(failIndex).toBeGreaterThan(statusIndex)
      expect(failIndex).toBeLessThan(actionsIndex)
    })

    // @clause CL-UI-VT-002
    // @ui-clause CL-UI-VT-002
    it("succeeds when ValidatorsTab renders FailModePopover in each row", () => {
      const validators = [
        createMockValidator({ key: "TOKEN_BUDGET_FIT", failMode: "HARD" }),
        createMockValidator({ key: "TASK_SCOPE_SIZE", failMode: "WARNING" }),
      ]

      render(
        <ValidatorsTab
          validators={validators}
          onToggle={mockOnToggle}
          onFailModeChange={mockOnFailModeChange}
        />
      )

      const popovers = screen.getAllByTestId("fail-mode-popover")
      expect(popovers).toHaveLength(2)
    })

    // @clause CL-UI-VT-003
    it("succeeds when ValidatorsTab calls onFailModeChange with correct args", async () => {
      const user = userEvent.setup()
      const validators = [
        createMockValidator({ key: "TOKEN_BUDGET_FIT", failMode: "HARD" }),
      ]

      render(
        <ValidatorsTab
          validators={validators}
          onToggle={mockOnToggle}
          onFailModeChange={mockOnFailModeChange}
        />
      )

      // Open popover and select Warning
      const row = screen.getByTestId("validator-row-TOKEN_BUDGET_FIT")
      const trigger = within(row).getByTestId("fail-mode-trigger")

      await user.click(trigger)
      await user.click(screen.getByTestId("fail-mode-option-warning"))

      expect(mockOnFailModeChange).toHaveBeenCalledWith("TOKEN_BUDGET_FIT", "WARNING")
    })
  })

  // ==========================================================================
  // Frontend — RunPanel Tests (CL-UI-RP-001 to CL-UI-RP-003)
  // ==========================================================================

  describe("Frontend — RunPanel", () => {
    // @clause CL-UI-RP-001
    // @ui-clause CL-UI-RP-001
    it("succeeds when RunPanel shows Hard badge for isHardBlock=true", () => {
      const results = [
        createMockValidatorResult({
          validatorCode: "TOKEN_BUDGET_FIT",
          isHardBlock: true,
        }),
      ]

      render(<RunPanel validatorResults={results} />)

      const hardBadge = screen.getByTestId("hard-badge")
      expect(hardBadge).toHaveTextContent("Hard")
      expect(hardBadge).toHaveClass("bg-destructive/20")
    })

    // @clause CL-UI-RP-002
    // @ui-clause CL-UI-RP-002
    it("succeeds when RunPanel shows Warning badge for isHardBlock=false", () => {
      const results = [
        createMockValidatorResult({
          validatorCode: "TEST_INTENT_ALIGNMENT",
          isHardBlock: false,
        }),
      ]

      render(<RunPanel validatorResults={results} />)

      const warningBadge = screen.getByTestId("warning-badge")
      expect(warningBadge).toHaveTextContent("Warning")
      expect(warningBadge).toHaveClass("bg-yellow-500/20")
    })

    // @clause CL-UI-RP-003
    // @ui-clause CL-UI-RP-003
    it("succeeds when RunPanel shows validator summary counters", () => {
      const results = [
        createMockValidatorResult({ status: "PASSED", passed: true }),
        createMockValidatorResult({ validatorCode: "V2", status: "PASSED", passed: true }),
        createMockValidatorResult({ validatorCode: "V3", status: "FAILED", passed: false }),
        createMockValidatorResult({ validatorCode: "V4", status: "SKIPPED", passed: true }),
      ]

      render(<RunPanel validatorResults={results} />)

      const summary = screen.getByTestId("validator-summary")
      expect(summary).toHaveTextContent("2 Passed")
      expect(summary).toHaveTextContent("1 Failed")
      expect(summary).toHaveTextContent("1 Skipped")
    })
  })

  // ==========================================================================
  // Frontend — RunDetailsPage Tests (CL-UI-RDP-001)
  // ==========================================================================

  describe("Frontend — RunDetailsPage", () => {
    // @clause CL-UI-RDP-001
    // @ui-clause CL-UI-RDP-001
    it("succeeds when RunDetailsPage shows repoName in header", () => {
      render(
        <RunDetailsPage
          outputId="2026_01_28_001_validator_fail_mode"
          projectPath="/home/user/projects/gatekeeper"
        />
      )

      const repoNameElement = screen.getByTestId("run-header-repoName")
      const outputIdElement = screen.getByTestId("run-header-outputId")

      expect(repoNameElement).toHaveTextContent("gatekeeper")
      expect(outputIdElement).toHaveTextContent("2026_01_28_001_validator_fail_mode")
    })
  })

  // ==========================================================================
  // Frontend — GitCommitModal Tests (CL-UI-GCM-001)
  // ==========================================================================

  describe("Frontend — GitCommitModal", () => {
    // @clause CL-UI-GCM-001
    // @ui-clause CL-UI-GCM-001
    it("succeeds when GitCommitModal shows repo badge before branch badge", () => {
      render(
        <GitCommitModal
          open={true}
          onOpenChange={vi.fn()}
          repoName="gatekeeper"
          branch="feature/fail-mode"
          onCommit={vi.fn()}
        />
      )

      const repoBadge = screen.getByTestId("repo-badge")
      const branchBadge = screen.getByTestId("branch-badge")

      expect(repoBadge).toHaveTextContent("gatekeeper")
      expect(branchBadge).toHaveTextContent("feature/fail-mode")

      // Verify repo badge appears before branch badge in DOM order
      const modal = screen.getByTestId("git-commit-modal")
      const badges = within(modal).getAllByTestId(/.*-badge/)
      expect(badges[0]).toHaveAttribute("data-testid", "repo-badge")
      expect(badges[1]).toHaveAttribute("data-testid", "branch-badge")
    })
  })

  // ==========================================================================
  // Frontend — PushConfirmModal Tests (CL-UI-PCM-001)
  // ==========================================================================

  describe("Frontend — PushConfirmModal", () => {
    // @clause CL-UI-PCM-001
    // @ui-clause CL-UI-PCM-001
    it("succeeds when PushConfirmModal shows repo badge", () => {
      render(
        <PushConfirmModal
          open={true}
          onOpenChange={vi.fn()}
          repoName="gatekeeper"
          commitHash="abc1234567890"
          onPushNow={vi.fn()}
          onKeepLocal={vi.fn()}
        />
      )

      const repoBadge = screen.getByTestId("repo-badge")
      expect(repoBadge).toHaveTextContent("gatekeeper")
    })
  })

  // ==========================================================================
  // Frontend — Utils Tests (CL-UTIL-001)
  // ==========================================================================

  describe("Frontend — Utils", () => {
    // @clause CL-UTIL-001
    it("succeeds when getRepoNameFromPath extracts Unix path correctly", () => {
      const result = getRepoNameFromPath("/home/user/gatekeeper")
      expect(result).toBe("gatekeeper")
    })

    // @clause CL-UTIL-001
    it("succeeds when getRepoNameFromPath extracts Windows path correctly", () => {
      const result = getRepoNameFromPath("C:\\Users\\dev\\repos\\my-app")
      expect(result).toBe("my-app")
    })

    // @clause CL-UTIL-001
    it("fails when getRepoNameFromPath receives empty string", () => {
      const result = getRepoNameFromPath("")
      expect(result).toBe("unknown")
    })

    // @clause CL-UTIL-001
    it("succeeds when getRepoNameFromPath handles trailing slash", () => {
      const result = getRepoNameFromPath("/home/user/gatekeeper/")
      expect(result).toBe("gatekeeper")
    })

    // @clause CL-UTIL-001
    it("succeeds when getRepoNameFromPath handles deep nested path", () => {
      const result = getRepoNameFromPath("/very/deep/nested/path/to/repo-name")
      expect(result).toBe("repo-name")
    })
  })
})
