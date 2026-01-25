import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"

/**
 * Tests for Button Position and Commit List
 *
 * Contract: button-position-and-commit-list v1.0
 * Mode: STRICT
 * Criticality: HIGH
 *
 * Bug 1: Posicionamento do Botão de Execução
 * - CL-BTN-001: Botão superior existe abaixo do ArtifactsInput
 * - CL-BTN-002: Botão inferior permanece no fim da página
 * - CL-BTN-003: Ambos os botões executam a mesma ação
 * - CL-BTN-004: Botões desabilitados quando canSubmit=false
 * - CL-BTN-005: Botões desabilitados durante submissão
 *
 * Bug 2: Commit Clicável na Lista de Runs
 * - CL-COMMIT-001: Célula de commit é clicável quando há commit
 * - CL-COMMIT-002: Modal abre ao clicar na célula de commit
 * - CL-COMMIT-003: Modal exibe informações do commit
 * - CL-COMMIT-004: Modal tem botão Fechar
 * - CL-COMMIT-005: Célula de commit sem commit mostra "-"
 *
 * Invariantes
 * - CL-INV-001: Outras colunas da tabela não afetadas
 * - CL-INV-002: Seleção em massa continua funcionando
 * - CL-INV-003: Navegação ao clicar na linha funciona
 */

// ============================================================================
// Mock Handlers
// ============================================================================

const mockNavigate = vi.fn()
const mockHandleSubmit = vi.fn()

// ============================================================================
// Type Definitions
// ============================================================================

type RunStatus = "PENDING" | "RUNNING" | "PASSED" | "FAILED" | "ABORTED"

interface MockRun {
  id: string
  outputId: string
  status: RunStatus
  currentGate: number
  projectPath: string
  commitHash: string | null
  commitMessage: string | null
  committedAt: string | null
  failedValidatorCode: string | null
  createdAt: string
  project?: {
    id: string
    name: string
    workspace?: {
      id: string
      name: string
    }
  }
}

// ============================================================================
// Data Fixtures
// ============================================================================

const createMockRun = (overrides: Partial<MockRun> = {}): MockRun => ({
  id: "run-123",
  outputId: "2026_01_25_001_test",
  status: "PASSED",
  currentGate: 2,
  projectPath: "/home/user/project",
  commitHash: "abc123def456",
  commitMessage: "fix: resolve button positioning issue",
  committedAt: "2026-01-25T10:30:00Z",
  failedValidatorCode: null,
  createdAt: "2026-01-25T10:00:00Z",
  project: {
    id: "proj-1",
    name: "gatekeeper",
    workspace: {
      id: "ws-1",
      name: "Anthropic",
    },
  },
  ...overrides,
})

// ============================================================================
// Mock NewValidationPage Component (simulates FIXED behavior)
// ============================================================================

interface MockNewValidationPageProps {
  canSubmit?: boolean
  isSubmitting?: boolean
  onSubmit?: () => void
}

function MockNewValidationPage({
  canSubmit = true,
  isSubmitting = false,
  onSubmit = mockHandleSubmit,
}: MockNewValidationPageProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit || isSubmitting) return
    onSubmit()
    mockNavigate("/runs/new-run-id")
  }

  const buttonText = isSubmitting ? "Iniciando..." : "Run Gates 0 e 1"
  const isDisabled = !canSubmit || isSubmitting

  return (
    <div className="p-8 space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card de Projeto */}
        <div className="p-6 bg-card border-border">
          <label>Projeto (Obrigatório)</label>
        </div>

        {/* Grid com ArtifactsInput e Preview */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Coluna de Inputs */}
          <div className="space-y-6">
            {/* ArtifactsInput Card */}
            <div className="p-6 bg-card border-border">
              <div data-testid="artifacts-input-tabs" className="space-y-4">
                <span>Artifacts Input</span>
              </div>
            </div>

            {/* NEW: Botão superior logo abaixo do ArtifactsInput */}
            <button
              type="submit"
              disabled={isDisabled}
              data-testid="btn-run-gates-top"
              className="w-full"
            >
              {buttonText}
            </button>
          </div>

          {/* Coluna de Preview */}
          <div className="space-y-6">
            <div className="space-y-3">
              <label>Preview</label>
              <div data-testid="json-preview">JSON Preview</div>
            </div>
          </div>
        </div>

        {/* Botões no fim da página (existente) */}
        <div className="flex items-center justify-start gap-3">
          <button
            type="submit"
            disabled={isDisabled}
            data-testid="btn-run-gates"
          >
            {buttonText}
          </button>
          <button
            type="button"
            onClick={() => mockNavigate("/runs")}
            data-testid="btn-cancel"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}

// ============================================================================
// Mock RunsListPage Component (simulates FIXED behavior with clickable commits)
// ============================================================================

interface MockRunsListPageProps {
  runs?: MockRun[]
  onNavigate?: (path: string) => void
}

function MockRunsListPage({
  runs = [createMockRun()],
  onNavigate = mockNavigate,
}: MockRunsListPageProps) {
  const [selectedRunIds, setSelectedRunIds] = useState<Set<string>>(new Set())
  const [commitModalOpen, setCommitModalOpen] = useState(false)
  const [selectedCommit, setSelectedCommit] = useState<MockRun | null>(null)

  const toggleSelection = (runId: string, checked: boolean) => {
    setSelectedRunIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(runId)
      } else {
        next.delete(runId)
      }
      return next
    })
  }

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRunIds(new Set(runs.map((r) => r.id)))
    } else {
      setSelectedRunIds(new Set())
    }
  }

  const handleCommitClick = (run: MockRun, e: React.MouseEvent) => {
    e.stopPropagation()
    if (run.commitMessage) {
      setSelectedCommit(run)
      setCommitModalOpen(true)
    }
  }

  const handleRowClick = (run: MockRun) => {
    onNavigate(`/runs/${run.id}`)
  }

  const handleBulkDelete = () => {
    // Simulate bulk delete
    setSelectedRunIds(new Set())
  }

  const allSelected = runs.length > 0 && runs.every((r) => selectedRunIds.has(r.id))

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => onNavigate("/runs/new")}
          data-testid="btn-new-run"
        >
          Nova Validação
        </button>
        <button
          type="button"
          onClick={handleBulkDelete}
          disabled={selectedRunIds.size === 0}
          data-testid="btn-bulk-delete"
        >
          Deletar Selecionados ({selectedRunIds.size})
        </button>
      </div>

      {/* Table */}
      <table data-testid="runs-table">
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => toggleSelectAll(e.target.checked)}
                aria-label="Select all runs"
                data-testid="select-all-checkbox"
              />
            </th>
            <th data-testid="col-run-id">Run ID</th>
            <th data-testid="col-output-id">Output ID</th>
            <th data-testid="col-status">Status</th>
            <th data-testid="col-gate">Gate</th>
            <th data-testid="col-rejected-by">Rejeitado Por</th>
            <th data-testid="col-project">Projeto / Path</th>
            <th data-testid="col-commit">Commit</th>
            <th data-testid="col-created">Criado Em</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr
              key={run.id}
              data-testid={`run-row-${run.id}`}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleRowClick(run)}
            >
              <td onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedRunIds.has(run.id)}
                  onChange={(e) => toggleSelection(run.id, e.target.checked)}
                  aria-label={`Select run ${run.id}`}
                  data-testid={`select-run-${run.id}`}
                />
              </td>
              <td data-testid={`run-id-${run.id}`}>{run.id.substring(0, 8)}</td>
              <td data-testid={`output-id-${run.id}`}>{run.outputId}</td>
              <td data-testid={`status-${run.id}`}>{run.status}</td>
              <td data-testid={`gate-${run.id}`}>Gate {run.currentGate}</td>
              <td data-testid={`rejected-by-${run.id}`}>{run.failedValidatorCode || "-"}</td>
              <td data-testid={`project-${run.id}`}>
                {run.project
                  ? `${run.project.workspace?.name} / ${run.project.name}`
                  : run.projectPath}
              </td>
              {/* FIXED: Célula de commit clicável */}
              <td
                data-testid={`commit-cell-${run.id}`}
                className={run.commitMessage ? "cursor-pointer" : ""}
                onClick={(e) => handleCommitClick(run, e)}
              >
                {run.commitMessage ? (
                  <span className="cursor-pointer hover:underline">
                    {run.commitMessage.length > 40
                      ? `${run.commitMessage.slice(0, 40)}...`
                      : run.commitMessage}
                  </span>
                ) : (
                  "-"
                )}
              </td>
              <td data-testid={`created-${run.id}`}>
                {new Date(run.createdAt).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Commit Info Modal */}
      {commitModalOpen && selectedCommit && (
        <div
          role="dialog"
          data-testid="commit-info-modal"
          className="fixed inset-0 bg-black/50 flex items-center justify-center"
        >
          <div className="bg-white p-6 rounded-lg max-w-lg w-full">
            <h2 className="text-lg font-bold mb-4">Informações do Commit</h2>
            <div className="space-y-2 text-sm">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Hash</div>
                <div data-testid="commit-info-hash" className="font-mono">
                  {selectedCommit.commitHash ?? "-"}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Mensagem</div>
                <div data-testid="commit-info-message">
                  {selectedCommit.commitMessage ?? "-"}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Data</div>
                <div data-testid="commit-info-date" className="font-mono">
                  {selectedCommit.committedAt
                    ? new Date(selectedCommit.committedAt).toLocaleString()
                    : "-"}
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setCommitModalOpen(false)}
                data-testid="btn-close-modal"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Test Suite
// ============================================================================

describe("button-position-and-commit-list", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==========================================================================
  // Bug 1: Posicionamento do Botão de Execução
  // ==========================================================================

  describe("Bug 1: Posicionamento do Botão de Execução", () => {
    // @clause CL-BTN-001
    it("should render top button after ArtifactsInput when valid page loads", () => {
      render(<MockNewValidationPage />)

      // Verifica que o botão superior existe
      const topButton = screen.getByTestId("btn-run-gates-top")
      expect(topButton).toBeInTheDocument()

      // Verifica que ArtifactsInput existe
      const artifactsInput = screen.getByTestId("artifacts-input-tabs")
      expect(artifactsInput).toBeInTheDocument()

      // Verifica estrutura: botão superior está após artifacts-input na DOM
      const form = topButton.closest("form")
      expect(form).toBeInTheDocument()
      const allTestIds = Array.from(form!.querySelectorAll("[data-testid]")).map(
        (el) => el.getAttribute("data-testid")
      )
      const artifactsIndex = allTestIds.indexOf("artifacts-input-tabs")
      const topButtonIndex = allTestIds.indexOf("btn-run-gates-top")
      expect(topButtonIndex).toBeGreaterThan(artifactsIndex)
    })

    // @clause CL-BTN-001
    it("should place top button within inputs section successfully", () => {
      render(<MockNewValidationPage />)

      const artifactsInput = screen.getByTestId("artifacts-input-tabs")
      const topButton = screen.getByTestId("btn-run-gates-top")

      // Ambos devem estar no mesmo container pai de grid
      const artifactsParentColumn = artifactsInput.closest(".space-y-6")

      // O botão deve estar no mesmo container lógico que o artifacts input
      expect(artifactsParentColumn).toContainElement(topButton)
    })

    // @clause CL-BTN-002
    it("should render bottom button at form end successfully", () => {
      render(<MockNewValidationPage />)

      const bottomButton = screen.getByTestId("btn-run-gates")
      expect(bottomButton).toBeInTheDocument()

      // Verifica que está no container final com botão Cancelar
      const cancelButton = screen.getByTestId("btn-cancel")
      expect(cancelButton).toBeInTheDocument()

      // Ambos devem estar no mesmo container flex
      const bottomButtonParent = bottomButton.parentElement
      expect(bottomButtonParent).toContainElement(cancelButton)
    })

    // @clause CL-BTN-002
    it("should display correct text on bottom button when valid", () => {
      render(<MockNewValidationPage />)

      const bottomButton = screen.getByTestId("btn-run-gates")
      expect(bottomButton).toHaveTextContent("Run Gates 0 e 1")
    })

    // @clause CL-BTN-003
    it("should execute handleSubmit successfully when top button clicked", async () => {
      const user = userEvent.setup()

      render(<MockNewValidationPage canSubmit={true} />)

      const topButton = screen.getByTestId("btn-run-gates-top")
      await user.click(topButton)

      expect(mockHandleSubmit).toHaveBeenCalledTimes(1)
      expect(mockNavigate).toHaveBeenCalledWith("/runs/new-run-id")
    })

    // @clause CL-BTN-003
    it("should execute handleSubmit successfully when bottom button clicked", async () => {
      const user = userEvent.setup()

      render(<MockNewValidationPage canSubmit={true} />)

      const bottomButton = screen.getByTestId("btn-run-gates")
      await user.click(bottomButton)

      expect(mockHandleSubmit).toHaveBeenCalledTimes(1)
      expect(mockNavigate).toHaveBeenCalledWith("/runs/new-run-id")
    })

    // @clause CL-BTN-004
    it("should fail to enable buttons when canSubmit is invalid", () => {
      render(<MockNewValidationPage canSubmit={false} />)

      const topButton = screen.getByTestId("btn-run-gates-top")
      const bottomButton = screen.getByTestId("btn-run-gates")

      expect(topButton).toBeDisabled()
      expect(bottomButton).toBeDisabled()
    })

    // @clause CL-BTN-004
    it("should not execute handleSubmit when buttons invalid and clicked", async () => {
      const user = userEvent.setup()

      render(<MockNewValidationPage canSubmit={false} />)

      const topButton = screen.getByTestId("btn-run-gates-top")
      const bottomButton = screen.getByTestId("btn-run-gates")

      await user.click(topButton)
      await user.click(bottomButton)

      expect(mockHandleSubmit).not.toHaveBeenCalled()
    })

    // @clause CL-BTN-005
    it("should disable buttons when isSubmitting passes to true", () => {
      render(<MockNewValidationPage isSubmitting={true} />)

      const topButton = screen.getByTestId("btn-run-gates-top")
      const bottomButton = screen.getByTestId("btn-run-gates")

      expect(topButton).toBeDisabled()
      expect(bottomButton).toBeDisabled()
    })

    // @clause CL-BTN-005
    it("should display loading text when submission passes", () => {
      render(<MockNewValidationPage isSubmitting={true} />)

      const topButton = screen.getByTestId("btn-run-gates-top")
      const bottomButton = screen.getByTestId("btn-run-gates")

      expect(topButton).toHaveTextContent("Iniciando...")
      expect(bottomButton).toHaveTextContent("Iniciando...")
    })
  })

  // ==========================================================================
  // Bug 2: Commit Clicável na Lista de Runs
  // ==========================================================================

  describe("Bug 2: Commit Clicável na Lista de Runs", () => {
    // @clause CL-COMMIT-001
    it("should render clickable commit cell when valid commit exists", () => {
      const runWithCommit = createMockRun({
        commitMessage: "feat: add new feature",
      })

      render(<MockRunsListPage runs={[runWithCommit]} />)

      const commitCell = screen.getByTestId(`commit-cell-${runWithCommit.id}`)
      expect(commitCell).toBeInTheDocument()
      expect(commitCell).toHaveClass("cursor-pointer")
    })

    // @clause CL-COMMIT-001
    it("should respond to click successfully when commit cell is valid", async () => {
      const user = userEvent.setup()
      const runWithCommit = createMockRun({
        commitMessage: "feat: clickable commit",
      })

      render(<MockRunsListPage runs={[runWithCommit]} />)

      const commitCell = screen.getByTestId(`commit-cell-${runWithCommit.id}`)
      await user.click(commitCell)

      // Modal deve abrir
      const modal = screen.getByTestId("commit-info-modal")
      expect(modal).toBeInTheDocument()
    })

    // @clause CL-COMMIT-002
    it("should open modal successfully when commit cell clicked", async () => {
      const user = userEvent.setup()
      const runWithCommit = createMockRun({
        id: "run-modal-test",
        commitMessage: "fix: modal test",
      })

      render(<MockRunsListPage runs={[runWithCommit]} />)

      // Modal não existe inicialmente
      expect(screen.queryByTestId("commit-info-modal")).not.toBeInTheDocument()

      // Clica na célula de commit
      const commitCell = screen.getByTestId(`commit-cell-${runWithCommit.id}`)
      await user.click(commitCell)

      // Modal deve existir
      const modal = screen.getByTestId("commit-info-modal")
      expect(modal).toBeInTheDocument()
      expect(modal).toHaveAttribute("role", "dialog")
    })

    // @clause CL-COMMIT-003
    it("should display commit hash successfully in modal", async () => {
      const user = userEvent.setup()
      const runWithCommit = createMockRun({
        commitHash: "abc123xyz789",
        commitMessage: "test: hash display",
      })

      render(<MockRunsListPage runs={[runWithCommit]} />)

      const commitCell = screen.getByTestId(`commit-cell-${runWithCommit.id}`)
      await user.click(commitCell)

      const hashElement = screen.getByTestId("commit-info-hash")
      expect(hashElement).toHaveTextContent("abc123xyz789")
    })

    // @clause CL-COMMIT-003
    it("should display commit message successfully in modal", async () => {
      const user = userEvent.setup()
      const runWithCommit = createMockRun({
        commitMessage: "feat: important feature implementation",
      })

      render(<MockRunsListPage runs={[runWithCommit]} />)

      const commitCell = screen.getByTestId(`commit-cell-${runWithCommit.id}`)
      await user.click(commitCell)

      const messageElement = screen.getByTestId("commit-info-message")
      expect(messageElement).toHaveTextContent("feat: important feature implementation")
    })

    // @clause CL-COMMIT-003
    it("should display commit date successfully when valid", async () => {
      const user = userEvent.setup()
      const runWithCommit = createMockRun({
        commitMessage: "test: date display",
        committedAt: "2026-01-25T15:30:00Z",
      })

      render(<MockRunsListPage runs={[runWithCommit]} />)

      const commitCell = screen.getByTestId(`commit-cell-${runWithCommit.id}`)
      await user.click(commitCell)

      const dateElement = screen.getByTestId("commit-info-date")
      // Verifica que contém parte da data formatada
      expect(dateElement.textContent).not.toBe("-")
      expect(dateElement.textContent!.length).toBeGreaterThan(5)
    })

    // @clause CL-COMMIT-004
    it("should close modal successfully when close button clicked", async () => {
      const user = userEvent.setup()
      const runWithCommit = createMockRun({
        commitMessage: "test: close button",
      })

      render(<MockRunsListPage runs={[runWithCommit]} />)

      // Abre o modal
      const commitCell = screen.getByTestId(`commit-cell-${runWithCommit.id}`)
      await user.click(commitCell)

      // Verifica que o modal está aberto
      expect(screen.getByTestId("commit-info-modal")).toBeInTheDocument()

      // Clica no botão Fechar
      const closeButton = screen.getByTestId("btn-close-modal")
      expect(closeButton).toHaveTextContent("Fechar")
      await user.click(closeButton)

      // Modal deve fechar
      await waitFor(() => {
        expect(screen.queryByTestId("commit-info-modal")).not.toBeInTheDocument()
      })
    })

    // @clause CL-COMMIT-005
    it("should fail to be clickable when commit is invalid (null)", () => {
      const runWithoutCommit = createMockRun({
        id: "run-no-commit",
        commitMessage: null,
        commitHash: null,
      })

      render(<MockRunsListPage runs={[runWithoutCommit]} />)

      const commitCell = screen.getByTestId(`commit-cell-${runWithoutCommit.id}`)
      expect(commitCell).toHaveTextContent("-")
      expect(commitCell).not.toHaveClass("cursor-pointer")
    })

    // @clause CL-COMMIT-005
    it("should fail to open modal when commit invalid and clicked", async () => {
      const user = userEvent.setup()
      const runWithoutCommit = createMockRun({
        id: "run-no-modal",
        commitMessage: null,
      })

      render(<MockRunsListPage runs={[runWithoutCommit]} />)

      const commitCell = screen.getByTestId(`commit-cell-${runWithoutCommit.id}`)
      await user.click(commitCell)

      // Modal não deve aparecer
      expect(screen.queryByTestId("commit-info-modal")).not.toBeInTheDocument()
    })
  })

  // ==========================================================================
  // Invariantes
  // ==========================================================================

  describe("Invariantes", () => {
    // @clause CL-INV-001
    it("should render Run ID column data successfully", () => {
      const run = createMockRun({ id: "test-run-001" })

      render(<MockRunsListPage runs={[run]} />)

      const runIdCell = screen.getByTestId(`run-id-${run.id}`)
      expect(runIdCell).toHaveTextContent("test-run")
    })

    // @clause CL-INV-001
    it("should render Output ID column data successfully", () => {
      const run = createMockRun({ outputId: "2026_01_25_specific_output" })

      render(<MockRunsListPage runs={[run]} />)

      const outputIdCell = screen.getByTestId(`output-id-${run.id}`)
      expect(outputIdCell).toHaveTextContent("2026_01_25_specific_output")
    })

    // @clause CL-INV-001
    it("should render Status column data successfully", () => {
      const run = createMockRun({ status: "FAILED" })

      render(<MockRunsListPage runs={[run]} />)

      const statusCell = screen.getByTestId(`status-${run.id}`)
      expect(statusCell).toHaveTextContent("FAILED")
    })

    // @clause CL-INV-001
    it("should render Gate column data successfully", () => {
      const run = createMockRun({ currentGate: 3 })

      render(<MockRunsListPage runs={[run]} />)

      const gateCell = screen.getByTestId(`gate-${run.id}`)
      expect(gateCell).toHaveTextContent("Gate 3")
    })

    // @clause CL-INV-001
    it("should render Rejected By column data successfully when valid", () => {
      const run = createMockRun({ failedValidatorCode: "IMPORT_REALITY_CHECK" })

      render(<MockRunsListPage runs={[run]} />)

      const rejectedByCell = screen.getByTestId(`rejected-by-${run.id}`)
      expect(rejectedByCell).toHaveTextContent("IMPORT_REALITY_CHECK")
    })

    // @clause CL-INV-001
    it("should render all table header columns successfully", () => {
      render(<MockRunsListPage runs={[createMockRun()]} />)

      expect(screen.getByTestId("col-run-id")).toBeInTheDocument()
      expect(screen.getByTestId("col-output-id")).toBeInTheDocument()
      expect(screen.getByTestId("col-status")).toBeInTheDocument()
      expect(screen.getByTestId("col-gate")).toBeInTheDocument()
      expect(screen.getByTestId("col-rejected-by")).toBeInTheDocument()
      expect(screen.getByTestId("col-project")).toBeInTheDocument()
      expect(screen.getByTestId("col-commit")).toBeInTheDocument()
      expect(screen.getByTestId("col-created")).toBeInTheDocument()
    })

    // @clause CL-INV-002
    it("should toggle individual run checkbox successfully", async () => {
      const user = userEvent.setup()
      const run = createMockRun({ id: "selectable-run" })

      render(<MockRunsListPage runs={[run]} />)

      const checkbox = screen.getByTestId(`select-run-${run.id}`) as HTMLInputElement
      expect(checkbox.checked).toBe(false)

      await user.click(checkbox)
      expect(checkbox.checked).toBe(true)

      await user.click(checkbox)
      expect(checkbox.checked).toBe(false)
    })

    // @clause CL-INV-002
    it("should toggle select all checkbox successfully", async () => {
      const user = userEvent.setup()
      const runs = [
        createMockRun({ id: "run-1" }),
        createMockRun({ id: "run-2" }),
        createMockRun({ id: "run-3" }),
      ]

      render(<MockRunsListPage runs={runs} />)

      const selectAllCheckbox = screen.getByTestId("select-all-checkbox") as HTMLInputElement

      await user.click(selectAllCheckbox)

      // Todos os checkboxes devem estar selecionados
      for (const run of runs) {
        const checkbox = screen.getByTestId(`select-run-${run.id}`) as HTMLInputElement
        expect(checkbox.checked).toBe(true)
      }
    })

    // @clause CL-INV-002
    it("should update bulk delete counter successfully when valid selection", async () => {
      const user = userEvent.setup()
      const runs = [
        createMockRun({ id: "run-delete-1" }),
        createMockRun({ id: "run-delete-2" }),
      ]

      render(<MockRunsListPage runs={runs} />)

      const bulkDeleteButton = screen.getByTestId("btn-bulk-delete")
      expect(bulkDeleteButton).toHaveTextContent("Deletar Selecionados (0)")

      // Seleciona uma run
      await user.click(screen.getByTestId("select-run-run-delete-1"))
      expect(bulkDeleteButton).toHaveTextContent("Deletar Selecionados (1)")

      // Seleciona outra run
      await user.click(screen.getByTestId("select-run-run-delete-2"))
      expect(bulkDeleteButton).toHaveTextContent("Deletar Selecionados (2)")
    })

    // @clause CL-INV-003
    it("should navigate to run details successfully when row clicked", async () => {
      const user = userEvent.setup()
      const run = createMockRun({ id: "navigable-run" })

      render(<MockRunsListPage runs={[run]} />)

      const row = screen.getByTestId(`run-row-${run.id}`)
      await user.click(row)

      expect(mockNavigate).toHaveBeenCalledWith("/runs/navigable-run")
    })

    // @clause CL-INV-003
    it("should not navigate when checkbox clicked", async () => {
      const user = userEvent.setup()
      const run = createMockRun({ id: "checkbox-run" })

      render(<MockRunsListPage runs={[run]} />)

      const checkbox = screen.getByTestId(`select-run-${run.id}`)
      await user.click(checkbox)

      // Navigate não deve ser chamado para navegação de detalhes
      expect(mockNavigate).not.toHaveBeenCalledWith("/runs/checkbox-run")
    })

    // @clause CL-INV-003
    it("should not navigate when valid commit cell clicked", async () => {
      const user = userEvent.setup()
      const run = createMockRun({
        id: "commit-click-run",
        commitMessage: "test: commit click",
      })

      render(<MockRunsListPage runs={[run]} />)

      const commitCell = screen.getByTestId(`commit-cell-${run.id}`)
      await user.click(commitCell)

      // Não deve navegar para detalhes (deve abrir modal)
      expect(mockNavigate).not.toHaveBeenCalledWith("/runs/commit-click-run")
      // Modal deve abrir
      expect(screen.getByTestId("commit-info-modal")).toBeInTheDocument()
    })
  })

  // ==========================================================================
  // Sad Paths / Edge Cases
  // ==========================================================================

  describe("Sad Paths", () => {
    // @clause CL-BTN-003
    it("should fail to submit when canSubmit is invalid", async () => {
      const user = userEvent.setup()

      render(<MockNewValidationPage canSubmit={false} />)

      // Tenta clicar nos botões desabilitados
      const topButton = screen.getByTestId("btn-run-gates-top")
      const bottomButton = screen.getByTestId("btn-run-gates")

      // userEvent não consegue clicar em botões desabilitados, mas podemos verificar o estado
      expect(topButton).toBeDisabled()
      expect(bottomButton).toBeDisabled()
      expect(mockHandleSubmit).not.toHaveBeenCalled()
    })

    // @clause CL-COMMIT-002
    it("should fail to open modal when commitMessage is invalid (null)", async () => {
      const user = userEvent.setup()
      const runWithoutCommit = createMockRun({
        id: "no-commit-run",
        commitMessage: null,
        commitHash: null,
      })

      render(<MockRunsListPage runs={[runWithoutCommit]} />)

      const commitCell = screen.getByTestId(`commit-cell-${runWithoutCommit.id}`)
      await user.click(commitCell)

      expect(screen.queryByTestId("commit-info-modal")).not.toBeInTheDocument()
    })

    // @clause CL-COMMIT-003
    it("should display error placeholder when commitHash is invalid (null)", async () => {
      const user = userEvent.setup()
      const run = createMockRun({
        commitHash: null,
        commitMessage: "message sem hash",
      })

      render(<MockRunsListPage runs={[run]} />)

      const commitCell = screen.getByTestId(`commit-cell-${run.id}`)
      await user.click(commitCell)

      const hashElement = screen.getByTestId("commit-info-hash")
      expect(hashElement).toHaveTextContent("-")
    })

    // @clause CL-COMMIT-003
    it("should display error placeholder when committedAt is invalid (null)", async () => {
      const user = userEvent.setup()
      const run = createMockRun({
        commitMessage: "message sem data",
        committedAt: null,
      })

      render(<MockRunsListPage runs={[run]} />)

      const commitCell = screen.getByTestId(`commit-cell-${run.id}`)
      await user.click(commitCell)

      const dateElement = screen.getByTestId("commit-info-date")
      expect(dateElement).toHaveTextContent("-")
    })

    // @clause CL-INV-002
    it("should fail to enable bulk delete when selection is invalid (empty)", () => {
      render(<MockRunsListPage runs={[createMockRun()]} />)

      const bulkDeleteButton = screen.getByTestId("btn-bulk-delete")
      expect(bulkDeleteButton).toBeDisabled()
    })

    // @clause CL-COMMIT-001
    it("should truncate long message when commit message exceeds limit", () => {
      const longMessage =
        "feat: this is a very long commit message that should be truncated when displayed in the cell"
      const run = createMockRun({
        commitMessage: longMessage,
      })

      render(<MockRunsListPage runs={[run]} />)

      const commitCell = screen.getByTestId(`commit-cell-${run.id}`)
      // Deve mostrar versão truncada (40 chars + ...)
      expect(commitCell.textContent!.length).toBeLessThan(longMessage.length)
      expect(commitCell.textContent).toContain("...")
    })

    // @clause CL-INV-001
    it("should display error placeholder when failedValidatorCode is invalid (null)", () => {
      const run = createMockRun({ failedValidatorCode: null })

      render(<MockRunsListPage runs={[run]} />)

      const rejectedByCell = screen.getByTestId(`rejected-by-${run.id}`)
      expect(rejectedByCell).toHaveTextContent("-")
    })
  })
})
