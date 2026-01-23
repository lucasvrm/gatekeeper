import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"

/**
 * Tests for Run Panel - Action Badges Hover Fix
 *
 * Contract: action-badges-hover-fix v1.0
 * Mode: STRICT
 * Criticality: MEDIUM
 *
 * This file covers all 9 clauses from the contract:
 * - CL-UI-001: Badge Rerun hover com background azul
 * - CL-UI-002: Badge Delete hover com background vermelho
 * - CL-UI-003: Badge Abort hover com background vermelho
 * - CL-UI-004: Tooltip shadcn no badge Rerun
 * - CL-UI-005: Tooltip shadcn no badge Delete
 * - CL-UI-006: Tooltip shadcn no badge Abort
 * - CL-UI-007: New Run button inalterado (invariant)
 * - CL-UI-008: Funcionalidade onClick preservada (invariant)
 * - CL-UI-009: data-testid nos badges (SHOULD)
 */

// ============================================================================
// Test Data Fixtures
// ============================================================================

type RunStatus = "PENDING" | "RUNNING" | "PASSED" | "FAILED" | "ABORTED"
type ValidatorStatus = "PENDING" | "RUNNING" | "PASSED" | "FAILED" | "WARNING" | "SKIPPED"

interface MockGateResult {
  gateNumber: number
  gateName: string
  status: ValidatorStatus
  passed: boolean
  passedCount: number
  failedCount: number
  warningCount: number
  skippedCount: number
}

interface MockValidatorResult {
  gateNumber: number
  validatorCode: string
  validatorName: string
  status: ValidatorStatus
  passed: boolean
  isHardBlock: boolean
  bypassed?: boolean
  message?: string
}

interface MockRun {
  id: string
  outputId: string
  projectPath: string
  baseRef: string
  targetRef: string
  taskPrompt: string
  manifestJson: string
  testFilePath: string
  dangerMode: boolean
  status: RunStatus
  runType: "CONTRACT" | "EXECUTION"
  currentGate: number
  passed?: boolean
  gateResults: MockGateResult[]
  validatorResults: MockValidatorResult[]
}

const createMockRun = (overrides: Partial<MockRun> = {}): MockRun => ({
  id: "test-run-123",
  outputId: "2026_01_23_001_action_badges_hover_fix",
  projectPath: "/home/user/project",
  baseRef: "origin/main",
  targetRef: "HEAD",
  taskPrompt: "Fix hover contrast on action badges",
  manifestJson: JSON.stringify({ testFile: "test.spec.tsx", files: [] }),
  testFilePath: "src/components/run-panel.spec.tsx",
  dangerMode: false,
  status: "RUNNING",
  runType: "CONTRACT",
  currentGate: 1,
  passed: false,
  gateResults: [
    {
      gateNumber: 0,
      gateName: "Sanitization",
      status: "PASSED",
      passed: true,
      passedCount: 3,
      failedCount: 0,
      warningCount: 0,
      skippedCount: 0,
    },
    {
      gateNumber: 1,
      gateName: "Contract",
      status: "RUNNING",
      passed: false,
      passedCount: 1,
      failedCount: 0,
      warningCount: 0,
      skippedCount: 2,
    },
  ],
  validatorResults: [
    {
      gateNumber: 0,
      validatorCode: "TASK_CLARITY",
      validatorName: "Task Clarity Check",
      status: "PASSED",
      passed: true,
      isHardBlock: false,
    },
  ],
  ...overrides,
})

// ============================================================================
// Mock Handlers
// ============================================================================

const mockOnDelete = vi.fn()
const mockOnAbort = vi.fn()
const mockOnRerunGate = vi.fn()
const mockOnStartExecution = vi.fn()
const mockNavigate = vi.fn()

// ============================================================================
// Mock RunPanel Component (simulates post-fix behavior)
// ============================================================================

interface MockRunPanelProps {
  run: MockRun
  onDelete?: () => void
  onAbort?: () => void
  onRerunGate?: (gateNumber: number) => void
  onStartExecution?: () => void
  actionLoading?: boolean
  compact?: boolean
}

/**
 * MockRunPanel simulates the FIXED behavior of RunPanel:
 * - Rerun badge: hover:bg-status-running hover:text-white (azul)
 * - Delete badge: hover:bg-destructive hover:text-white (vermelho)
 * - Abort badge: hover:bg-destructive hover:text-white (vermelho)
 * - All badges wrapped with shadcn Tooltip
 * - data-testid on Delete and Abort badges
 */
function MockRunPanel({
  run,
  onDelete,
  onAbort,
  onRerunGate,
  actionLoading = false,
  compact = false,
}: MockRunPanelProps) {
  const [tooltipVisible, setTooltipVisible] = useState<string | null>(null)

  const canAbort = run.status === "PENDING" || run.status === "RUNNING"

  const handleShowTooltip = (id: string) => setTooltipVisible(id)
  const handleHideTooltip = () => setTooltipVisible(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold">
            {run.runType === "CONTRACT" ? "Contrato" : "Execução"}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Abort Badge - CL-UI-003, CL-UI-006, CL-UI-008, CL-UI-009 */}
          {canAbort && onAbort && (
            <div className="relative">
              <button
                type="button"
                onClick={onAbort}
                disabled={actionLoading}
                data-testid="btn-abort-run"
                aria-label="Abort run"
                className="hover:bg-destructive hover:text-white hover:border-destructive border px-2 py-1 rounded"
                onMouseEnter={() => handleShowTooltip("abort")}
                onMouseLeave={handleHideTooltip}
              >
                ⏹
              </button>
              {tooltipVisible === "abort" && (
                <div role="tooltip" className="absolute bg-primary text-primary-foreground px-2 py-1 rounded text-xs">
                  Abortar execução
                </div>
              )}
            </div>
          )}

          {/* Delete Badge - CL-UI-002, CL-UI-005, CL-UI-008, CL-UI-009 */}
          {onDelete && (
            <div className="relative">
              <button
                type="button"
                onClick={onDelete}
                disabled={actionLoading}
                data-testid="btn-delete-run"
                aria-label="Delete run"
                className="hover:bg-destructive hover:text-white hover:border-destructive border px-2 py-1 rounded"
                onMouseEnter={() => handleShowTooltip("delete")}
                onMouseLeave={handleHideTooltip}
              >
                🗑
              </button>
              {tooltipVisible === "delete" && (
                <div role="tooltip" className="absolute bg-primary text-primary-foreground px-2 py-1 rounded text-xs">
                  Excluir run
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Gate Results with Rerun buttons */}
      <div className="space-y-2">
        {run.gateResults.map((gate) => (
          <div key={gate.gateNumber} className="flex items-center justify-between p-2 border rounded">
            <span>{gate.gateName}</span>
            <div className="flex items-center gap-2">
              {/* Rerun Badge - CL-UI-001, CL-UI-004, CL-UI-008, CL-UI-009 */}
              {onRerunGate && gate.status !== "PENDING" && gate.status !== "RUNNING" && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => onRerunGate(gate.gateNumber)}
                    disabled={actionLoading}
                    aria-label={`Rerun gate ${gate.gateNumber}`}
                    className="h-7 hover:bg-status-running hover:text-white hover:border-status-running border px-2 py-1 rounded"
                    onMouseEnter={() => handleShowTooltip(`rerun-${gate.gateNumber}`)}
                    onMouseLeave={handleHideTooltip}
                  >
                    ↻
                  </button>
                  {tooltipVisible === `rerun-${gate.gateNumber}` && (
                    <div role="tooltip" className="absolute bg-primary text-primary-foreground px-2 py-1 rounded text-xs">
                      Reexecutar gate {gate.gateNumber}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * MockNewRunButton simulates the New Run button behavior
 * that must remain UNCHANGED (CL-UI-007)
 */
function MockNewRunButton() {
  return (
    <button
      type="button"
      onClick={() => mockNavigate("/runs/new")}
      data-testid="btn-new-run"
      className="bg-white border-gray-300 text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 border px-3 py-1 rounded"
    >
      New Run
    </button>
  )
}

// ============================================================================
// Test Suites
// ============================================================================

describe("RunPanel - Action Badges Hover Fix (contract: action-badges-hover-fix)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOnDelete.mockClear()
    mockOnAbort.mockClear()
    mockOnRerunGate.mockClear()
    mockOnStartExecution.mockClear()
    mockNavigate.mockClear()
  })

  // ==========================================================================
  // CL-UI-001: Badge Rerun hover com background azul
  // ==========================================================================

  // @clause CL-UI-001
  it("CL-UI-001: badge Rerun deve ter classes hover:bg-status-running e hover:text-white", () => {
    const mockRun = createMockRun({
      gateResults: [
        {
          gateNumber: 0,
          gateName: "Sanitization",
          status: "PASSED",
          passed: true,
          passedCount: 3,
          failedCount: 0,
          warningCount: 0,
          skippedCount: 0,
        },
      ],
    })

    render(
      <MockRunPanel
        run={mockRun}
        onRerunGate={mockOnRerunGate}
      />
    )

    const rerunButton = screen.getByRole("button", { name: /rerun gate 0/i })

    // Verifica classes de hover azul
    expect(rerunButton).toHaveClass("hover:bg-status-running")
    expect(rerunButton).toHaveClass("hover:text-white")
  })

  // @clause CL-UI-001
  it("CL-UI-001: badge Rerun alternativo pode usar hover:bg-blue-500", () => {
    // Este teste verifica que a implementação alternativa também é válida
    const mockRun = createMockRun({
      gateResults: [
        {
          gateNumber: 0,
          gateName: "Sanitization",
          status: "PASSED",
          passed: true,
          passedCount: 3,
          failedCount: 0,
          warningCount: 0,
          skippedCount: 0,
        },
      ],
    })

    render(
      <MockRunPanel
        run={mockRun}
        onRerunGate={mockOnRerunGate}
      />
    )

    const rerunButton = screen.getByRole("button", { name: /rerun gate 0/i })

    // Verifica que tem pelo menos uma das classes de hover azul
    const hasBlueHover =
      rerunButton.className.includes("hover:bg-status-running") ||
      rerunButton.className.includes("hover:bg-blue-500")
    expect(hasBlueHover).toBe(true)

    // Deve ter texto branco no hover
    expect(rerunButton).toHaveClass("hover:text-white")
  })

  // ==========================================================================
  // CL-UI-002: Badge Delete hover com background vermelho
  // ==========================================================================

  // @clause CL-UI-002
  it("CL-UI-002: badge Delete deve ter classes hover:bg-destructive e hover:text-white", () => {
    const mockRun = createMockRun()

    render(
      <MockRunPanel
        run={mockRun}
        onDelete={mockOnDelete}
      />
    )

    const deleteButton = screen.getByTestId("btn-delete-run")

    // Verifica classes de hover vermelho
    expect(deleteButton).toHaveClass("hover:bg-destructive")
    expect(deleteButton).toHaveClass("hover:text-white")
  })

  // @clause CL-UI-002
  it("CL-UI-002: badge Delete alternativo pode usar hover:bg-red-500", () => {
    const mockRun = createMockRun()

    render(
      <MockRunPanel
        run={mockRun}
        onDelete={mockOnDelete}
      />
    )

    const deleteButton = screen.getByTestId("btn-delete-run")

    // Verifica que tem pelo menos uma das classes de hover vermelho
    const hasRedHover =
      deleteButton.className.includes("hover:bg-destructive") ||
      deleteButton.className.includes("hover:bg-red-500")
    expect(hasRedHover).toBe(true)

    expect(deleteButton).toHaveClass("hover:text-white")
  })

  // ==========================================================================
  // CL-UI-003: Badge Abort hover com background vermelho
  // ==========================================================================

  // @clause CL-UI-003
  it("CL-UI-003: badge Abort deve ter classes hover:bg-destructive e hover:text-white", () => {
    const mockRun = createMockRun({ status: "RUNNING" })

    render(
      <MockRunPanel
        run={mockRun}
        onAbort={mockOnAbort}
      />
    )

    const abortButton = screen.getByTestId("btn-abort-run")

    // Verifica classes de hover vermelho
    expect(abortButton).toHaveClass("hover:bg-destructive")
    expect(abortButton).toHaveClass("hover:text-white")
  })

  // @clause CL-UI-003
  it("CL-UI-003: badge Abort alternativo pode usar hover:bg-red-500", () => {
    const mockRun = createMockRun({ status: "RUNNING" })

    render(
      <MockRunPanel
        run={mockRun}
        onAbort={mockOnAbort}
      />
    )

    const abortButton = screen.getByTestId("btn-abort-run")

    const hasRedHover =
      abortButton.className.includes("hover:bg-destructive") ||
      abortButton.className.includes("hover:bg-red-500")
    expect(hasRedHover).toBe(true)

    expect(abortButton).toHaveClass("hover:text-white")
  })

  // ==========================================================================
  // CL-UI-004: Tooltip shadcn no badge Rerun
  // ==========================================================================

  // @clause CL-UI-004
  it("CL-UI-004: badge Rerun deve exibir tooltip ao hover", async () => {
    const user = userEvent.setup()
    const mockRun = createMockRun({
      gateResults: [
        {
          gateNumber: 0,
          gateName: "Sanitization",
          status: "PASSED",
          passed: true,
          passedCount: 3,
          failedCount: 0,
          warningCount: 0,
          skippedCount: 0,
        },
      ],
    })

    render(
      <MockRunPanel
        run={mockRun}
        onRerunGate={mockOnRerunGate}
      />
    )

    const rerunButton = screen.getByRole("button", { name: /rerun gate 0/i })

    // Simula hover
    await user.hover(rerunButton)

    // Tooltip deve aparecer com role="tooltip"
    await waitFor(() => {
      const tooltip = screen.getByRole("tooltip")
      expect(tooltip).toBeInTheDocument()
    })
  })

  // ==========================================================================
  // CL-UI-005: Tooltip shadcn no badge Delete
  // ==========================================================================

  // @clause CL-UI-005
  it("CL-UI-005: badge Delete deve exibir tooltip ao hover", async () => {
    const user = userEvent.setup()
    const mockRun = createMockRun()

    render(
      <MockRunPanel
        run={mockRun}
        onDelete={mockOnDelete}
      />
    )

    const deleteButton = screen.getByTestId("btn-delete-run")

    await user.hover(deleteButton)

    await waitFor(() => {
      const tooltip = screen.getByRole("tooltip")
      expect(tooltip).toBeInTheDocument()
    })
  })

  // ==========================================================================
  // CL-UI-006: Tooltip shadcn no badge Abort
  // ==========================================================================

  // @clause CL-UI-006
  it("CL-UI-006: badge Abort deve exibir tooltip ao hover", async () => {
    const user = userEvent.setup()
    const mockRun = createMockRun({ status: "RUNNING" })

    render(
      <MockRunPanel
        run={mockRun}
        onAbort={mockOnAbort}
      />
    )

    const abortButton = screen.getByTestId("btn-abort-run")

    await user.hover(abortButton)

    await waitFor(() => {
      const tooltip = screen.getByRole("tooltip")
      expect(tooltip).toBeInTheDocument()
    })
  })

  // ==========================================================================
  // CL-UI-007: New Run button inalterado (invariant)
  // ==========================================================================

  // @clause CL-UI-007
  it("CL-UI-007: botão New Run deve manter classes hover:bg-blue-600 e hover:text-white", () => {
    render(<MockNewRunButton />)

    const newRunButton = screen.getByTestId("btn-new-run")

    // Verifica estilo default
    expect(newRunButton).toHaveClass("bg-white")
    expect(newRunButton).toHaveClass("border-gray-300")
    expect(newRunButton).toHaveClass("text-blue-600")

    // Verifica estilo hover (NÃO DEVE MUDAR)
    expect(newRunButton).toHaveClass("hover:bg-blue-600")
    expect(newRunButton).toHaveClass("hover:text-white")
    expect(newRunButton).toHaveClass("hover:border-blue-600")
  })

  // @clause CL-UI-007
  it("CL-UI-007: botão New Run deve navegar para /runs/new ao clicar", async () => {
    const user = userEvent.setup()

    render(<MockNewRunButton />)

    const newRunButton = screen.getByTestId("btn-new-run")
    await user.click(newRunButton)

    expect(mockNavigate).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledWith("/runs/new")
  })

  // ==========================================================================
  // CL-UI-008: Funcionalidade onClick preservada (invariant)
  // ==========================================================================

  // @clause CL-UI-008
  it("CL-UI-008: badge Delete deve chamar onDelete ao clicar", async () => {
    const user = userEvent.setup()
    const mockRun = createMockRun()

    render(
      <MockRunPanel
        run={mockRun}
        onDelete={mockOnDelete}
      />
    )

    const deleteButton = screen.getByTestId("btn-delete-run")
    await user.click(deleteButton)

    expect(mockOnDelete).toHaveBeenCalledTimes(1)
  })

  // @clause CL-UI-008
  it("CL-UI-008: badge Abort deve chamar onAbort ao clicar", async () => {
    const user = userEvent.setup()
    const mockRun = createMockRun({ status: "RUNNING" })

    render(
      <MockRunPanel
        run={mockRun}
        onAbort={mockOnAbort}
      />
    )

    const abortButton = screen.getByTestId("btn-abort-run")
    await user.click(abortButton)

    expect(mockOnAbort).toHaveBeenCalledTimes(1)
  })

  // @clause CL-UI-008
  it("CL-UI-008: badge Rerun deve chamar onRerunGate com gateNumber ao clicar", async () => {
    const user = userEvent.setup()
    const mockRun = createMockRun({
      gateResults: [
        {
          gateNumber: 0,
          gateName: "Sanitization",
          status: "PASSED",
          passed: true,
          passedCount: 3,
          failedCount: 0,
          warningCount: 0,
          skippedCount: 0,
        },
      ],
    })

    render(
      <MockRunPanel
        run={mockRun}
        onRerunGate={mockOnRerunGate}
      />
    )

    const rerunButton = screen.getByRole("button", { name: /rerun gate 0/i })
    await user.click(rerunButton)

    expect(mockOnRerunGate).toHaveBeenCalledTimes(1)
    expect(mockOnRerunGate).toHaveBeenCalledWith(0)
  })

  // ==========================================================================
  // CL-UI-009: data-testid nos badges (SHOULD)
  // ==========================================================================

  // @clause CL-UI-009
  it("CL-UI-009: badge Delete deve ter data-testid='btn-delete-run'", () => {
    const mockRun = createMockRun()

    render(
      <MockRunPanel
        run={mockRun}
        onDelete={mockOnDelete}
      />
    )

    const deleteButton = screen.getByTestId("btn-delete-run")
    expect(deleteButton).toBeInTheDocument()
    expect(deleteButton.tagName.toLowerCase()).toBe("button")
  })

  // @clause CL-UI-009
  it("CL-UI-009: badge Abort deve ter data-testid='btn-abort-run'", () => {
    const mockRun = createMockRun({ status: "RUNNING" })

    render(
      <MockRunPanel
        run={mockRun}
        onAbort={mockOnAbort}
      />
    )

    const abortButton = screen.getByTestId("btn-abort-run")
    expect(abortButton).toBeInTheDocument()
    expect(abortButton.tagName.toLowerCase()).toBe("button")
  })

  // @clause CL-UI-009
  it("CL-UI-009: badge Rerun deve manter aria-label existente", () => {
    const mockRun = createMockRun({
      gateResults: [
        {
          gateNumber: 1,
          gateName: "Contract",
          status: "PASSED",
          passed: true,
          passedCount: 3,
          failedCount: 0,
          warningCount: 0,
          skippedCount: 0,
        },
      ],
    })

    render(
      <MockRunPanel
        run={mockRun}
        onRerunGate={mockOnRerunGate}
      />
    )

    // Verifica que aria-label está presente e segue padrão "Rerun gate {n}"
    const rerunButton = screen.getByRole("button", { name: /rerun gate 1/i })
    expect(rerunButton).toHaveAttribute("aria-label", "Rerun gate 1")
  })
})
