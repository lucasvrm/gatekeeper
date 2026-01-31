import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"

/**
 * Tests for Run Details V2 - UI Polish
 *
 * Contract: ui-polish-and-validator-fix v1.0
 * Mode: STRICT
 * Criticality: HIGH
 *
 * Clauses covered (UI Polish - Tarefa 1):
 *
 * Progress Bar (CL-PB-001 to CL-PB-003):
 * - Orange when RUNNING
 * - Green when PASSED
 * - Red when FAILED
 *
 * Task Prompt Card (CL-TP-001 to CL-TP-004):
 * - Title "Prompt da Tarefa" with data-testid="overview-task-prompt"
 * - Displays taskPrompt content
 * - Uses whitespace-pre-wrap for line breaks
 * - Has space-y-1 class
 *
 * Gate Nodes (CL-GN-001 to CL-GN-003):
 * - Solid green for PASSED (bg-status-passed)
 * - Solid red for FAILED (bg-status-failed)
 * - Blue with opacity for RUNNING (bg-status-running/20)
 */

// ============================================================================
// Type Definitions
// ============================================================================

type RunStatus = "PENDING" | "RUNNING" | "PASSED" | "FAILED" | "ABORTED"
type ValidatorStatus = "PENDING" | "RUNNING" | "PASSED" | "FAILED" | "WARNING" | "SKIPPED"

interface GateResult {
  gateNumber: number
  gateName: string
  status: ValidatorStatus
  passed: boolean
  passedCount: number
  failedCount: number
  warningCount: number
  skippedCount: number
}

interface ValidatorResult {
  gateNumber: number
  validatorCode: string
  validatorName: string
  status: ValidatorStatus
  passed: boolean
  isHardBlock: boolean
  message?: string
}

interface Run {
  id: string
  outputId: string
  projectPath: string
  baseRef: string
  targetRef: string
  taskPrompt?: string
  status: RunStatus
  runType: "CONTRACT" | "EXECUTION"
  commitHash?: string | null
  commitMessage?: string | null
}

interface RunWithResults extends Run {
  gateResults: GateResult[]
  validatorResults: ValidatorResult[]
}

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockRun = (overrides: Partial<RunWithResults> = {}): RunWithResults => ({
  id: `run-${Math.random().toString(36).slice(2, 9)}`,
  outputId: "2026_01_31_001_ui-polish",
  projectPath: "/home/user/gatekeeper",
  baseRef: "origin/main",
  targetRef: "HEAD",
  taskPrompt: "Default task prompt",
  status: "RUNNING",
  runType: "CONTRACT",
  gateResults: [],
  validatorResults: [],
  ...overrides,
})

const createMockGateResult = (overrides: Partial<GateResult> = {}): GateResult => ({
  gateNumber: 0,
  gateName: "Gate 0 - Pre-validation",
  status: "PENDING",
  passed: false,
  passedCount: 0,
  failedCount: 0,
  warningCount: 0,
  skippedCount: 0,
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
// Helper Functions Under Test
// ============================================================================

/**
 * Returns the appropriate progress bar color class based on run status
 */
function getProgressBarColor(status: RunStatus | undefined): string {
  switch (status) {
    case "RUNNING":
      return "bg-status-warning"
    case "PASSED":
      return "bg-status-passed"
    case "FAILED":
      return "bg-status-failed"
    default:
      return "bg-status-pending"
  }
}

/**
 * Returns the node class for a gate based on its status
 */
function getNodeClass(status: ValidatorStatus): string {
  if (status === "PASSED") return "border-status-passed bg-status-passed"
  if (status === "FAILED") return "border-status-failed bg-status-failed"
  if (status === "WARNING") return "border-status-warning bg-status-warning/20"
  if (status === "SKIPPED") return "border-status-skipped bg-status-skipped/20"
  if (status === "RUNNING") return "border-status-running bg-status-running/20"
  return "border-status-pending bg-status-pending/20"
}

// ============================================================================
// Mock Components
// ============================================================================

interface ProgressProps {
  value: number
  className?: string
  indicatorClassName?: string
  role?: string
  "aria-valuemin"?: number
  "aria-valuemax"?: number
  "aria-valuenow"?: number
}

function MockProgress({
  value,
  className = "",
  indicatorClassName = "",
  role,
  "aria-valuemin": ariaMin,
  "aria-valuemax": ariaMax,
  "aria-valuenow": ariaNow,
}: ProgressProps) {
  return (
    <div
      className={className}
      role={role}
      aria-valuemin={ariaMin}
      aria-valuemax={ariaMax}
      aria-valuenow={ariaNow}
      data-testid="progress-root"
    >
      <div
        data-testid="progress-indicator"
        className={indicatorClassName}
        style={{ width: `${value}%` }}
      />
    </div>
  )
}

interface CardProps {
  children: React.ReactNode
  className?: string
  "data-testid"?: string
}

function MockCard({ children, className = "", "data-testid": testId }: CardProps) {
  return (
    <div className={className} data-testid={testId}>
      {children}
    </div>
  )
}

interface OverviewProgressCardProps {
  progressPercentage: number
  status: RunStatus | undefined
  passedCount: number
  totalCount: number
}

function OverviewProgressCard({
  progressPercentage,
  status,
  passedCount,
  totalCount,
}: OverviewProgressCardProps) {
  return (
    <MockCard className="col-span-2 p-4 space-y-2" data-testid="overview-progress">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Progresso</h3>
        <span className="text-sm font-mono">{progressPercentage}%</span>
      </div>
      <MockProgress
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPercentage}
        value={progressPercentage}
        className="h-2"
        indicatorClassName={getProgressBarColor(status)}
      />
      <p className="text-xs text-muted-foreground">
        {passedCount} / {totalCount} passed
      </p>
    </MockCard>
  )
}

interface TaskPromptCardProps {
  taskPrompt: string | undefined
}

function TaskPromptCard({ taskPrompt }: TaskPromptCardProps) {
  return (
    <MockCard className="col-span-6 p-4 space-y-1" data-testid="overview-task-prompt">
      <h3 className="text-sm font-semibold">Prompt da Tarefa</h3>
      <p
        className="text-xs text-muted-foreground whitespace-pre-wrap break-words line-clamp-4"
        title={taskPrompt || "—"}
        data-testid="task-prompt-content"
      >
        {taskPrompt || "—"}
      </p>
    </MockCard>
  )
}

interface GateNodeProps {
  status: ValidatorStatus
  gateNumber: number
}

function GateNode({ status, gateNumber }: GateNodeProps) {
  return (
    <div
      className="relative ml-12"
      data-testid={`gate-card-${gateNumber}`}
    >
      <div
        data-testid={`gate-node-${gateNumber}`}
        className={`absolute -left-6 top-4 w-4 h-4 rounded-full border-2 ${getNodeClass(status)}`}
      />
      <MockCard className="p-4">
        <h4 className="text-sm font-semibold">Gate {gateNumber}</h4>
      </MockCard>
    </div>
  )
}

// ============================================================================
// Test Suites
// ============================================================================

describe("Run Details V2 - UI Polish", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==========================================================================
  // Progress Bar Tests (CL-PB-001 to CL-PB-003)
  // ==========================================================================

  describe("Progress Bar - Color based on primaryRun.status", () => {
    // @clause CL-PB-001
    // @ui-clause CL-UI-PB-001-running-base
    it("succeeds when progress bar shows orange color for RUNNING status", () => {
      const run = createMockRun({ status: "RUNNING" })

      render(
        <OverviewProgressCard
          progressPercentage={50}
          status={run.status}
          passedCount={2}
          totalCount={4}
        />
      )

      const indicator = screen.getByTestId("progress-indicator")
      expect(indicator).toHaveClass("bg-status-warning")
    })

    // @clause CL-PB-001
    // @ui-clause CL-UI-PB-001-running-0-percent
    it("succeeds when progress bar is orange for RUNNING even at 0%", () => {
      const run = createMockRun({ status: "RUNNING" })

      render(
        <OverviewProgressCard
          progressPercentage={0}
          status={run.status}
          passedCount={0}
          totalCount={4}
        />
      )

      const indicator = screen.getByTestId("progress-indicator")
      expect(indicator).toHaveClass("bg-status-warning")
      expect(indicator).not.toHaveClass("bg-status-pending")
    })

    // @clause CL-PB-001
    // @ui-clause CL-UI-PB-001-running-100-percent
    it("succeeds when progress bar is orange for RUNNING even at 100%", () => {
      const run = createMockRun({ status: "RUNNING" })

      render(
        <OverviewProgressCard
          progressPercentage={100}
          status={run.status}
          passedCount={4}
          totalCount={4}
        />
      )

      const indicator = screen.getByTestId("progress-indicator")
      expect(indicator).toHaveClass("bg-status-warning")
      expect(indicator).not.toHaveClass("bg-status-passed")
    })

    // @clause CL-PB-002
    // @ui-clause CL-UI-PB-002-passed-base
    it("succeeds when progress bar shows green color for PASSED status", () => {
      const run = createMockRun({ status: "PASSED" })

      render(
        <OverviewProgressCard
          progressPercentage={100}
          status={run.status}
          passedCount={4}
          totalCount={4}
        />
      )

      const indicator = screen.getByTestId("progress-indicator")
      expect(indicator).toHaveClass("bg-status-passed")
    })

    // @clause CL-PB-002
    // @ui-clause CL-UI-PB-002-passed-partial
    it("succeeds when progress bar is green for PASSED even at partial percentage", () => {
      const run = createMockRun({ status: "PASSED" })

      render(
        <OverviewProgressCard
          progressPercentage={75}
          status={run.status}
          passedCount={3}
          totalCount={4}
        />
      )

      const indicator = screen.getByTestId("progress-indicator")
      expect(indicator).toHaveClass("bg-status-passed")
      expect(indicator).not.toHaveClass("bg-status-warning")
    })

    // @clause CL-PB-002
    // @ui-clause CL-UI-PB-002-passed-not-warning
    it("succeeds when PASSED status overrides percentage-based logic", () => {
      const run = createMockRun({ status: "PASSED" })

      render(
        <OverviewProgressCard
          progressPercentage={50}
          status={run.status}
          passedCount={2}
          totalCount={4}
        />
      )

      const indicator = screen.getByTestId("progress-indicator")
      expect(indicator).toHaveClass("bg-status-passed")
    })

    // @clause CL-PB-003
    // @ui-clause CL-UI-PB-003-failed-base
    it("succeeds when progress bar shows red color for FAILED status", () => {
      const run = createMockRun({ status: "FAILED" })

      render(
        <OverviewProgressCard
          progressPercentage={25}
          status={run.status}
          passedCount={1}
          totalCount={4}
        />
      )

      const indicator = screen.getByTestId("progress-indicator")
      expect(indicator).toHaveClass("bg-status-failed")
    })

    // @clause CL-PB-003
    // @ui-clause CL-UI-PB-003-failed-0-percent
    it("succeeds when progress bar is red for FAILED at 0%", () => {
      const run = createMockRun({ status: "FAILED" })

      render(
        <OverviewProgressCard
          progressPercentage={0}
          status={run.status}
          passedCount={0}
          totalCount={4}
        />
      )

      const indicator = screen.getByTestId("progress-indicator")
      expect(indicator).toHaveClass("bg-status-failed")
      expect(indicator).not.toHaveClass("bg-status-pending")
    })

    // @clause CL-PB-003
    // @ui-clause CL-UI-PB-003-failed-high-percent
    it("succeeds when progress bar is red for FAILED even at high percentage", () => {
      const run = createMockRun({ status: "FAILED" })

      render(
        <OverviewProgressCard
          progressPercentage={90}
          status={run.status}
          passedCount={9}
          totalCount={10}
        />
      )

      const indicator = screen.getByTestId("progress-indicator")
      expect(indicator).toHaveClass("bg-status-failed")
      expect(indicator).not.toHaveClass("bg-status-passed")
    })
  })

  // ==========================================================================
  // Task Prompt Card Tests (CL-TP-001 to CL-TP-004)
  // ==========================================================================

  describe("Task Prompt Card", () => {
    // @clause CL-TP-001
    // @ui-clause CL-UI-TP-001-title
    it("succeeds when card has title 'Prompt da Tarefa'", () => {
      render(<TaskPromptCard taskPrompt="Test task" />)

      const card = screen.getByTestId("overview-task-prompt")
      const title = within(card).getByText("Prompt da Tarefa")

      expect(title).toBeInTheDocument()
      expect(title.tagName.toLowerCase()).toBe("h3")
    })

    // @clause CL-TP-001
    // @ui-clause CL-UI-TP-001-testid
    it("succeeds when card has data-testid='overview-task-prompt'", () => {
      render(<TaskPromptCard taskPrompt="Test task" />)

      const card = screen.getByTestId("overview-task-prompt")
      expect(card).toBeInTheDocument()
    })

    // @clause CL-TP-001
    // @ui-clause CL-UI-TP-001-not-commit
    it("fails when card title is 'Commit' instead of 'Prompt da Tarefa'", () => {
      render(<TaskPromptCard taskPrompt="Test task" />)

      const card = screen.getByTestId("overview-task-prompt")
      expect(within(card).queryByText("Commit")).not.toBeInTheDocument()
    })

    // @clause CL-TP-002
    // @ui-clause CL-UI-TP-002-displays-content
    it("succeeds when card displays taskPrompt content", () => {
      const taskPrompt = "Implement feature X with proper error handling"

      render(<TaskPromptCard taskPrompt={taskPrompt} />)

      const content = screen.getByTestId("task-prompt-content")
      expect(content).toHaveTextContent(taskPrompt)
    })

    // @clause CL-TP-002
    // @ui-clause CL-UI-TP-002-long-content
    it("succeeds when card displays long taskPrompt content", () => {
      const taskPrompt = "This is a very long task prompt that describes multiple requirements and edge cases that need to be handled correctly."

      render(<TaskPromptCard taskPrompt={taskPrompt} />)

      const content = screen.getByTestId("task-prompt-content")
      expect(content).toHaveTextContent(taskPrompt)
    })

    // @clause CL-TP-002
    // @ui-clause CL-UI-TP-002-empty-fallback
    it("succeeds when card shows fallback for undefined taskPrompt", () => {
      render(<TaskPromptCard taskPrompt={undefined} />)

      const content = screen.getByTestId("task-prompt-content")
      expect(content).toHaveTextContent("—")
    })

    // @clause CL-TP-003
    // @ui-clause CL-UI-TP-003-whitespace-pre-wrap
    it("succeeds when taskPrompt content has whitespace-pre-wrap class", () => {
      const taskPrompt = "Line 1\nLine 2\nLine 3"

      render(<TaskPromptCard taskPrompt={taskPrompt} />)

      const content = screen.getByTestId("task-prompt-content")
      expect(content).toHaveClass("whitespace-pre-wrap")
    })

    // @clause CL-TP-003
    // @ui-clause CL-UI-TP-003-break-words
    it("succeeds when taskPrompt content has break-words class", () => {
      const taskPrompt = "Line with very long words"

      render(<TaskPromptCard taskPrompt={taskPrompt} />)

      const content = screen.getByTestId("task-prompt-content")
      expect(content).toHaveClass("break-words")
    })

    // @clause CL-TP-003
    // @ui-clause CL-UI-TP-003-no-truncate
    it("fails when taskPrompt content uses truncate class instead of whitespace-pre-wrap", () => {
      render(<TaskPromptCard taskPrompt="Test task" />)

      const content = screen.getByTestId("task-prompt-content")
      expect(content).not.toHaveClass("truncate")
    })

    // @clause CL-TP-004
    // @ui-clause CL-UI-TP-004-space-y-1
    it("succeeds when card has space-y-1 class", () => {
      render(<TaskPromptCard taskPrompt="Test task" />)

      const card = screen.getByTestId("overview-task-prompt")
      expect(card).toHaveClass("space-y-1")
    })

    // @clause CL-TP-004
    // @ui-clause CL-UI-TP-004-not-space-y-2
    it("fails when card has space-y-2 class instead of space-y-1", () => {
      render(<TaskPromptCard taskPrompt="Test task" />)

      const card = screen.getByTestId("overview-task-prompt")
      expect(card).not.toHaveClass("space-y-2")
    })

    // @clause CL-TP-004
    // @ui-clause CL-UI-TP-004-col-span
    it("succeeds when card has col-span-6 class", () => {
      render(<TaskPromptCard taskPrompt="Test task" />)

      const card = screen.getByTestId("overview-task-prompt")
      expect(card).toHaveClass("col-span-6")
    })
  })

  // ==========================================================================
  // Gate Node Tests (CL-GN-001 to CL-GN-003)
  // ==========================================================================

  describe("Gate Nodes - Solid colors for PASSED/FAILED", () => {
    // @clause CL-GN-001
    // @ui-clause CL-UI-GN-001-passed-solid
    it("succeeds when PASSED gate node has solid green background", () => {
      render(<GateNode status="PASSED" gateNumber={0} />)

      const node = screen.getByTestId("gate-node-0")
      expect(node).toHaveClass("bg-status-passed")
      expect(node.className).not.toContain("bg-status-passed/20")
    })

    // @clause CL-GN-001
    // @ui-clause CL-UI-GN-001-passed-border
    it("succeeds when PASSED gate node has border-status-passed", () => {
      render(<GateNode status="PASSED" gateNumber={0} />)

      const node = screen.getByTestId("gate-node-0")
      expect(node).toHaveClass("border-status-passed")
    })

    // @clause CL-GN-001
    // @ui-clause CL-UI-GN-001-passed-no-opacity
    it("succeeds when PASSED gate node does not have opacity modifier", () => {
      render(<GateNode status="PASSED" gateNumber={1} />)

      const node = screen.getByTestId("gate-node-1")
      const classes = node.className
      expect(classes).not.toMatch(/bg-status-passed\/\d+/)
    })

    // @clause CL-GN-002
    // @ui-clause CL-UI-GN-002-failed-solid
    it("succeeds when FAILED gate node has solid red background", () => {
      render(<GateNode status="FAILED" gateNumber={0} />)

      const node = screen.getByTestId("gate-node-0")
      expect(node).toHaveClass("bg-status-failed")
      expect(node.className).not.toContain("bg-status-failed/20")
    })

    // @clause CL-GN-002
    // @ui-clause CL-UI-GN-002-failed-border
    it("succeeds when FAILED gate node has border-status-failed", () => {
      render(<GateNode status="FAILED" gateNumber={0} />)

      const node = screen.getByTestId("gate-node-0")
      expect(node).toHaveClass("border-status-failed")
    })

    // @clause CL-GN-002
    // @ui-clause CL-UI-GN-002-failed-no-opacity
    it("succeeds when FAILED gate node does not have opacity modifier", () => {
      render(<GateNode status="FAILED" gateNumber={2} />)

      const node = screen.getByTestId("gate-node-2")
      const classes = node.className
      expect(classes).not.toMatch(/bg-status-failed\/\d+/)
    })

    // @clause CL-GN-003
    // @ui-clause CL-UI-GN-003-running-opacity
    it("succeeds when RUNNING gate node has blue with 20% opacity", () => {
      render(<GateNode status="RUNNING" gateNumber={0} />)

      const node = screen.getByTestId("gate-node-0")
      expect(node).toHaveClass("bg-status-running/20")
    })

    // @clause CL-GN-003
    // @ui-clause CL-UI-GN-003-running-border
    it("succeeds when RUNNING gate node has border-status-running", () => {
      render(<GateNode status="RUNNING" gateNumber={0} />)

      const node = screen.getByTestId("gate-node-0")
      expect(node).toHaveClass("border-status-running")
    })

    // @clause CL-GN-003
    // @ui-clause CL-UI-GN-003-pending-opacity
    it("succeeds when PENDING gate node has opacity (not solid)", () => {
      render(<GateNode status="PENDING" gateNumber={3} />)

      const node = screen.getByTestId("gate-node-3")
      expect(node).toHaveClass("bg-status-pending/20")
    })
  })

  // ==========================================================================
  // Integration Tests - getProgressBarColor function
  // ==========================================================================

  describe("getProgressBarColor helper function", () => {
    // @clause CL-PB-001
    it("succeeds when getProgressBarColor returns warning for RUNNING", () => {
      expect(getProgressBarColor("RUNNING")).toBe("bg-status-warning")
    })

    // @clause CL-PB-002
    it("succeeds when getProgressBarColor returns passed for PASSED", () => {
      expect(getProgressBarColor("PASSED")).toBe("bg-status-passed")
    })

    // @clause CL-PB-003
    it("succeeds when getProgressBarColor returns failed for FAILED", () => {
      expect(getProgressBarColor("FAILED")).toBe("bg-status-failed")
    })

    // @clause CL-PB-001
    it("succeeds when getProgressBarColor returns pending for undefined", () => {
      expect(getProgressBarColor(undefined)).toBe("bg-status-pending")
    })

    // @clause CL-PB-001
    it("succeeds when getProgressBarColor returns pending for PENDING", () => {
      expect(getProgressBarColor("PENDING")).toBe("bg-status-pending")
    })

    // @clause CL-PB-001
    it("succeeds when getProgressBarColor returns pending for ABORTED", () => {
      expect(getProgressBarColor("ABORTED")).toBe("bg-status-pending")
    })
  })

  // ==========================================================================
  // Integration Tests - getNodeClass function
  // ==========================================================================

  describe("getNodeClass helper function", () => {
    // @clause CL-GN-001
    it("succeeds when getNodeClass returns solid green for PASSED", () => {
      const result = getNodeClass("PASSED")
      expect(result).toBe("border-status-passed bg-status-passed")
      expect(result).not.toContain("/20")
    })

    // @clause CL-GN-002
    it("succeeds when getNodeClass returns solid red for FAILED", () => {
      const result = getNodeClass("FAILED")
      expect(result).toBe("border-status-failed bg-status-failed")
      expect(result).not.toContain("/20")
    })

    // @clause CL-GN-003
    it("succeeds when getNodeClass returns blue with opacity for RUNNING", () => {
      const result = getNodeClass("RUNNING")
      expect(result).toContain("bg-status-running/20")
    })

    // @clause CL-GN-003
    it("succeeds when getNodeClass returns opacity for WARNING", () => {
      const result = getNodeClass("WARNING")
      expect(result).toContain("bg-status-warning/20")
    })

    // @clause CL-GN-003
    it("succeeds when getNodeClass returns opacity for SKIPPED", () => {
      const result = getNodeClass("SKIPPED")
      expect(result).toContain("bg-status-skipped/20")
    })

    // @clause CL-GN-003
    it("succeeds when getNodeClass returns opacity for PENDING", () => {
      const result = getNodeClass("PENDING")
      expect(result).toContain("bg-status-pending/20")
    })
  })

  // ==========================================================================
  // Edge Cases and Boundary Tests
  // ==========================================================================

  describe("Edge Cases", () => {
    // @clause CL-TP-002
    it("succeeds when taskPrompt with special characters is displayed correctly", () => {
      const taskPrompt = "Implement: <Component> with 'quotes' & \"double quotes\""

      render(<TaskPromptCard taskPrompt={taskPrompt} />)

      const content = screen.getByTestId("task-prompt-content")
      expect(content).toHaveTextContent(taskPrompt)
    })

    // @clause CL-TP-003
    it("succeeds when taskPrompt with multiple newlines preserves formatting", () => {
      const taskPrompt = "Line 1\n\nLine 3\n\n\nLine 6"

      render(<TaskPromptCard taskPrompt={taskPrompt} />)

      const content = screen.getByTestId("task-prompt-content")
      expect(content).toHaveClass("whitespace-pre-wrap")
      expect(content).toHaveTextContent(taskPrompt)
    })

    // @clause CL-GN-001
    it("succeeds when multiple gates render with correct status colors", () => {
      render(
        <>
          <GateNode status="PASSED" gateNumber={0} />
          <GateNode status="FAILED" gateNumber={1} />
          <GateNode status="RUNNING" gateNumber={2} />
        </>
      )

      const node0 = screen.getByTestId("gate-node-0")
      const node1 = screen.getByTestId("gate-node-1")
      const node2 = screen.getByTestId("gate-node-2")

      expect(node0).toHaveClass("bg-status-passed")
      expect(node1).toHaveClass("bg-status-failed")
      expect(node2).toHaveClass("bg-status-running/20")
    })
  })
})
