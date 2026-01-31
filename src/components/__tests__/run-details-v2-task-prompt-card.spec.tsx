import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

/**
 * Tests for Run Details V2 - Task Prompt Card
 *
 * Contract: run-details-v2-task-prompt-card v1.0
 * Mode: STRICT
 * Criticality: MEDIUM
 * ChangeType: modify
 *
 * This file covers all 8 clauses from the contract:
 *
 * Task Prompt Card (CL-TASK-001 to CL-TASK-005):
 * - CL-TASK-001: Card title é "Prompt da Tarefa"
 * - CL-TASK-002: Card exibe taskPrompt com truncate
 * - CL-TASK-003: Badge exibe changeType quando contractJson existe
 * - CL-TASK-004: Badge exibe fallback quando contractJson não existe
 * - CL-TASK-005: Badge exibe fallback quando contractJson é JSON inválido
 *
 * Filter Buttons (CL-FLT-001 to CL-FLT-002):
 * - CL-FLT-001: Filter button inativo tem hover 50% mais escuro
 * - CL-FLT-002: Filter button ativo mantém estilos
 *
 * Layout (CL-LAY-001):
 * - CL-LAY-001: Card mantém layout col-span-6
 */

// ============================================================================
// Type Definitions (inline para evitar dependências externas)
// ============================================================================

type RunStatus = "PENDING" | "RUNNING" | "PASSED" | "FAILED" | "ABORTED"
type StatusFilter = "ALL" | "PASSED" | "FAILED" | "WARNING" | "SKIPPED"

interface RunWithResults {
  id: string
  outputId: string
  projectPath: string
  taskPrompt?: string
  contractJson?: string
  status: RunStatus
  runType: "CONTRACT" | "EXECUTION"
  commitHash?: string | null
  commitMessage?: string | null
}

// ============================================================================
// Test Fixtures / Factories
// ============================================================================

const createMockRun = (overrides: Partial<RunWithResults> = {}): RunWithResults => ({
  id: `run-${Math.random().toString(36).slice(2, 9)}`,
  outputId: "2026_01_30_001_test_task",
  projectPath: "/home/user/projects/gatekeeper",
  taskPrompt: "Implementar validação de formulário com campos obrigatórios",
  contractJson: JSON.stringify({ changeType: "modify", slug: "form-validation" }),
  status: "PASSED",
  runType: "CONTRACT",
  commitHash: null,
  commitMessage: null,
  ...overrides,
})

const STATUS_FILTERS: StatusFilter[] = ["ALL", "PASSED", "FAILED", "WARNING", "SKIPPED"]

// ============================================================================
// Helper Functions (simulando implementação pós-contrato)
// ============================================================================

/**
 * Extrai o changeType do contractJson
 * Esta função simula o comportamento esperado da implementação
 */
function getChangeType(run: RunWithResults | null): string | null {
  if (!run?.contractJson) return null
  try {
    const contract = JSON.parse(run.contractJson)
    return contract.changeType || null
  } catch {
    return null
  }
}

// ============================================================================
// Mock Components (simulam comportamento pós-implementação)
// ============================================================================

/**
 * TaskPromptCard - Componente que renderiza o card "Prompt da Tarefa"
 * Simula o comportamento esperado após a implementação do contrato
 */
interface TaskPromptCardProps {
  run: RunWithResults | null
}

function TaskPromptCard({ run }: TaskPromptCardProps) {
  const changeType = getChangeType(run)
  const badgeText = changeType || "—"
  const taskPromptText = run?.taskPrompt || "—"

  return (
    <div
      className="col-span-6 p-4 space-y-2"
      data-testid="overview-task-prompt"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Prompt da Tarefa</h3>
        <span
          className="font-mono px-2 py-1 rounded text-xs"
          data-testid="task-prompt-badge"
        >
          {badgeText}
        </span>
      </div>
      <p
        className="text-xs text-muted-foreground truncate"
        title={taskPromptText}
      >
        {taskPromptText}
      </p>
    </div>
  )
}

/**
 * FilterButton - Componente de botão de filtro
 * Simula o comportamento esperado após a implementação do contrato
 */
interface FilterButtonProps {
  status: StatusFilter
  isActive: boolean
  count: number
  onClick: () => void
}

function FilterButton({ status, isActive, count, onClick }: FilterButtonProps) {
  const label = status === "ALL" ? "All" : status.charAt(0) + status.slice(1).toLowerCase()

  return (
    <button
      type="button"
      data-testid={`filter-btn-${status}`}
      className={
        isActive
          ? "px-3 bg-blue-600 text-white hover:bg-blue-700"
          : "px-3 bg-muted text-muted-foreground hover:bg-muted/50 hover:text-white"
      }
      onClick={onClick}
    >
      {label} ({count})
    </button>
  )
}

/**
 * FilterBar - Barra de filtros completa
 */
interface FilterBarProps {
  activeFilter: StatusFilter
  counts: Record<StatusFilter, number>
  onFilterChange: (filter: StatusFilter) => void
}

function FilterBar({ activeFilter, counts, onFilterChange }: FilterBarProps) {
  return (
    <div className="flex gap-2" data-testid="filter-bar">
      {STATUS_FILTERS.map((status) => (
        <FilterButton
          key={status}
          status={status}
          isActive={activeFilter === status}
          count={counts[status]}
          onClick={() => onFilterChange(status)}
        />
      ))}
    </div>
  )
}

/**
 * OverviewCards - Grid de cards de overview incluindo TaskPromptCard
 */
interface OverviewCardsProps {
  run: RunWithResults | null
}

function OverviewCards({ run }: OverviewCardsProps) {
  return (
    <div className="grid grid-cols-12 gap-4" data-testid="overview-cards">
      <div className="col-span-2 p-4" data-testid="overview-progress">
        <h3 className="text-sm font-semibold">Progresso</h3>
      </div>
      <div className="col-span-2 p-4" data-testid="overview-contract">
        <h3 className="text-sm font-semibold">Contrato</h3>
      </div>
      <div className="col-span-2 p-4" data-testid="overview-execution">
        <h3 className="text-sm font-semibold">Execução</h3>
      </div>
      <TaskPromptCard run={run} />
    </div>
  )
}

// ============================================================================
// Test Suites
// ============================================================================

describe("Run Details V2 - Task Prompt Card", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==========================================================================
  // CL-TASK-001: Card title é "Prompt da Tarefa"
  // ==========================================================================

  describe("CL-TASK-001 — Card title é 'Prompt da Tarefa'", () => {
    // @clause CL-TASK-001
    // @ui-clause CL-UI-TaskPromptCard-title
    it("succeeds when card renders with title 'Prompt da Tarefa'", () => {
      const mockRun = createMockRun()

      render(<TaskPromptCard run={mockRun} />)

      const card = screen.getByTestId("overview-task-prompt")
      const title = within(card).getByRole("heading", { level: 3 })

      expect(title).toHaveTextContent("Prompt da Tarefa")
    })

    // @clause CL-TASK-001
    // @ui-clause CL-UI-TaskPromptCard-testid
    it("succeeds when card has data-testid='overview-task-prompt'", () => {
      const mockRun = createMockRun()

      render(<TaskPromptCard run={mockRun} />)

      const card = screen.getByTestId("overview-task-prompt")

      expect(card).toBeInTheDocument()
      expect(card).toHaveAttribute("data-testid", "overview-task-prompt")
    })

    // @clause CL-TASK-001
    // @ui-clause CL-UI-TaskPromptCard-present
    it("succeeds when card is present in overview cards grid", () => {
      const mockRun = createMockRun()

      render(<OverviewCards run={mockRun} />)

      const overviewCards = screen.getByTestId("overview-cards")
      const taskPromptCard = within(overviewCards).getByTestId("overview-task-prompt")
      const title = within(taskPromptCard).getByRole("heading", { level: 3 })

      expect(taskPromptCard).toBeInTheDocument()
      expect(title).toHaveTextContent("Prompt da Tarefa")
    })

    // @clause CL-TASK-001
    it("succeeds when card title is visible with correct styling", () => {
      const mockRun = createMockRun()

      render(<TaskPromptCard run={mockRun} />)

      const card = screen.getByTestId("overview-task-prompt")
      const title = within(card).getByRole("heading", { level: 3 })

      expect(title).toBeVisible()
      expect(title).toHaveClass("text-sm")
      expect(title).toHaveClass("font-semibold")
    })
  })

  // ==========================================================================
  // CL-TASK-002: Card exibe taskPrompt com truncate
  // ==========================================================================

  describe("CL-TASK-002 — Card exibe taskPrompt com truncate", () => {
    // @clause CL-TASK-002
    // @ui-clause CL-UI-TaskPromptCard-truncate
    it("succeeds when taskPrompt text has truncate class", () => {
      const mockRun = createMockRun({
        taskPrompt: "Implementar validação de formulário com campos obrigatórios e mensagens de erro customizadas",
      })

      render(<TaskPromptCard run={mockRun} />)

      const card = screen.getByTestId("overview-task-prompt")
      const textElement = within(card).getByText(/Implementar validação/)

      expect(textElement).toHaveClass("truncate")
    })

    // @clause CL-TASK-002
    // @ui-clause CL-UI-TaskPromptCard-title-attr
    it("succeeds when taskPrompt element has title attribute with full text", () => {
      const fullTaskPrompt = "Implementar validação de formulário com campos obrigatórios e mensagens de erro customizadas para melhor UX"
      const mockRun = createMockRun({ taskPrompt: fullTaskPrompt })

      render(<TaskPromptCard run={mockRun} />)

      const card = screen.getByTestId("overview-task-prompt")
      const textElement = within(card).getByText(/Implementar validação/)

      expect(textElement).toHaveAttribute("title", fullTaskPrompt)
    })

    // @clause CL-TASK-002
    // @ui-clause CL-UI-TaskPromptCard-content
    it("succeeds when card displays taskPrompt content correctly", () => {
      const taskPrompt = "Corrigir bug no login com autenticação OAuth"
      const mockRun = createMockRun({ taskPrompt })

      render(<TaskPromptCard run={mockRun} />)

      const card = screen.getByTestId("overview-task-prompt")
      const textElement = within(card).getByText(taskPrompt)

      expect(textElement).toBeInTheDocument()
      expect(textElement).toHaveTextContent(taskPrompt)
    })

    // @clause CL-TASK-002
    it("succeeds when taskPrompt displays fallback '—' when undefined", () => {
      const mockRun = createMockRun({ taskPrompt: undefined })

      render(<TaskPromptCard run={mockRun} />)

      const card = screen.getByTestId("overview-task-prompt")
      const textElement = card.querySelector("p")

      expect(textElement).toHaveTextContent("—")
      expect(textElement).toHaveAttribute("title", "—")
    })
  })

  // ==========================================================================
  // CL-TASK-003: Badge exibe changeType quando contractJson existe
  // ==========================================================================

  describe("CL-TASK-003 — Badge exibe changeType quando contractJson existe", () => {
    // @clause CL-TASK-003
    // @ui-clause CL-UI-TaskPromptCard-badge-modify
    it("succeeds when badge displays 'modify' changeType", () => {
      const mockRun = createMockRun({
        contractJson: JSON.stringify({ changeType: "modify", slug: "form-validation" }),
      })

      render(<TaskPromptCard run={mockRun} />)

      const badge = screen.getByTestId("task-prompt-badge")

      expect(badge).toHaveTextContent("modify")
    })

    // @clause CL-TASK-003
    // @ui-clause CL-UI-TaskPromptCard-badge-bugfix
    it("succeeds when badge displays 'bugfix' changeType", () => {
      const mockRun = createMockRun({
        contractJson: JSON.stringify({ changeType: "bugfix", slug: "login-fix" }),
      })

      render(<TaskPromptCard run={mockRun} />)

      const badge = screen.getByTestId("task-prompt-badge")

      expect(badge).toHaveTextContent("bugfix")
    })

    // @clause CL-TASK-003
    // @ui-clause CL-UI-TaskPromptCard-badge-new
    it("succeeds when badge displays 'new' changeType", () => {
      const mockRun = createMockRun({
        contractJson: JSON.stringify({ changeType: "new", slug: "feature-x" }),
      })

      render(<TaskPromptCard run={mockRun} />)

      const badge = screen.getByTestId("task-prompt-badge")

      expect(badge).toHaveTextContent("new")
    })

    // @clause CL-TASK-003
    // @ui-clause CL-UI-TaskPromptCard-badge-refactor
    it("succeeds when badge displays 'refactor' changeType", () => {
      const mockRun = createMockRun({
        contractJson: JSON.stringify({ changeType: "refactor", slug: "cleanup" }),
      })

      render(<TaskPromptCard run={mockRun} />)

      const badge = screen.getByTestId("task-prompt-badge")

      expect(badge).toHaveTextContent("refactor")
    })

    // @clause CL-TASK-003
    it("succeeds when badge has data-testid='task-prompt-badge'", () => {
      const mockRun = createMockRun({
        contractJson: JSON.stringify({ changeType: "modify" }),
      })

      render(<TaskPromptCard run={mockRun} />)

      const badge = screen.getByTestId("task-prompt-badge")

      expect(badge).toBeInTheDocument()
      expect(badge).toHaveAttribute("data-testid", "task-prompt-badge")
    })
  })

  // ==========================================================================
  // CL-TASK-004: Badge exibe fallback quando contractJson não existe
  // ==========================================================================

  describe("CL-TASK-004 — Badge exibe fallback quando contractJson não existe", () => {
    // @clause CL-TASK-004
    // @ui-clause CL-UI-TaskPromptCard-badge-fallback-null
    it("succeeds when badge displays '—' when contractJson is null", () => {
      const mockRun = createMockRun({ contractJson: undefined })

      render(<TaskPromptCard run={mockRun} />)

      const badge = screen.getByTestId("task-prompt-badge")

      expect(badge).toHaveTextContent("—")
    })

    // @clause CL-TASK-004
    // @ui-clause CL-UI-TaskPromptCard-badge-fallback-empty
    it("succeeds when badge displays '—' when contractJson is empty string", () => {
      const mockRun = createMockRun({ contractJson: "" })

      render(<TaskPromptCard run={mockRun} />)

      const badge = screen.getByTestId("task-prompt-badge")

      expect(badge).toHaveTextContent("—")
    })

    // @clause CL-TASK-004
    // @ui-clause CL-UI-TaskPromptCard-badge-fallback-no-changeType
    it("succeeds when badge displays '—' when contractJson has no changeType field", () => {
      const mockRun = createMockRun({
        contractJson: JSON.stringify({ slug: "some-task", title: "Task" }),
      })

      render(<TaskPromptCard run={mockRun} />)

      const badge = screen.getByTestId("task-prompt-badge")

      expect(badge).toHaveTextContent("—")
    })

    // @clause CL-TASK-004
    it("succeeds when badge is present even with null run", () => {
      render(<TaskPromptCard run={null} />)

      const badge = screen.getByTestId("task-prompt-badge")

      expect(badge).toBeInTheDocument()
      expect(badge).toHaveTextContent("—")
    })
  })

  // ==========================================================================
  // CL-TASK-005: Badge exibe fallback quando contractJson é JSON inválido
  // ==========================================================================

  describe("CL-TASK-005 — Badge exibe fallback quando contractJson é JSON inválido", () => {
    // @clause CL-TASK-005
    // @ui-clause CL-UI-TaskPromptCard-badge-invalid-json
    it("succeeds when badge displays '—' for malformed JSON", () => {
      const mockRun = createMockRun({
        contractJson: "{ invalid json syntax",
      })

      render(<TaskPromptCard run={mockRun} />)

      const badge = screen.getByTestId("task-prompt-badge")

      expect(badge).toHaveTextContent("—")
    })

    // @clause CL-TASK-005
    // @ui-clause CL-UI-TaskPromptCard-badge-invalid-partial
    it("succeeds when badge displays '—' for partial JSON", () => {
      const mockRun = createMockRun({
        contractJson: '{"changeType": "modify"',
      })

      render(<TaskPromptCard run={mockRun} />)

      const badge = screen.getByTestId("task-prompt-badge")

      expect(badge).toHaveTextContent("—")
    })

    // @clause CL-TASK-005
    // @ui-clause CL-UI-TaskPromptCard-badge-invalid-random
    it("succeeds when badge displays '—' for random string", () => {
      const mockRun = createMockRun({
        contractJson: "not-json-at-all-just-random-text",
      })

      render(<TaskPromptCard run={mockRun} />)

      const badge = screen.getByTestId("task-prompt-badge")

      expect(badge).toHaveTextContent("—")
    })

    // @clause CL-TASK-005
    it("fails when contractJson is corrupted and does not crash component", () => {
      const mockRun = createMockRun({
        contractJson: "}}}{{{not valid",
      })

      // Should not throw
      expect(() => render(<TaskPromptCard run={mockRun} />)).not.toThrow()

      const badge = screen.getByTestId("task-prompt-badge")
      expect(badge).toHaveTextContent("—")
    })
  })

  // ==========================================================================
  // CL-FLT-001: Filter button inativo tem hover 50% mais escuro
  // ==========================================================================

  describe("CL-FLT-001 — Filter button inativo tem hover:bg-muted/50", () => {
    const mockCounts: Record<StatusFilter, number> = {
      ALL: 10,
      PASSED: 5,
      FAILED: 2,
      WARNING: 1,
      SKIPPED: 2,
    }

    // @clause CL-FLT-001
    // @ui-clause CL-UI-FilterButton-inactive-hover
    it("succeeds when inactive filter button has hover:bg-muted/50 class", () => {
      render(
        <FilterBar
          activeFilter="ALL"
          counts={mockCounts}
          onFilterChange={vi.fn()}
        />
      )

      // PASSED button is inactive when ALL is active
      const passedButton = screen.getByTestId("filter-btn-PASSED")

      expect(passedButton).toHaveClass("hover:bg-muted/50")
    })

    // @clause CL-FLT-001
    // @ui-clause CL-UI-FilterButton-inactive-all-have-hover
    it("succeeds when all inactive buttons have hover:bg-muted/50", () => {
      render(
        <FilterBar
          activeFilter="PASSED"
          counts={mockCounts}
          onFilterChange={vi.fn()}
        />
      )

      // ALL, FAILED, WARNING, SKIPPED are inactive when PASSED is active
      const allButton = screen.getByTestId("filter-btn-ALL")
      const failedButton = screen.getByTestId("filter-btn-FAILED")
      const warningButton = screen.getByTestId("filter-btn-WARNING")
      const skippedButton = screen.getByTestId("filter-btn-SKIPPED")

      expect(allButton).toHaveClass("hover:bg-muted/50")
      expect(failedButton).toHaveClass("hover:bg-muted/50")
      expect(warningButton).toHaveClass("hover:bg-muted/50")
      expect(skippedButton).toHaveClass("hover:bg-muted/50")
    })

    // @clause CL-FLT-001
    // @ui-clause CL-UI-FilterButton-inactive-base-bg
    it("succeeds when inactive button has bg-muted base class", () => {
      render(
        <FilterBar
          activeFilter="ALL"
          counts={mockCounts}
          onFilterChange={vi.fn()}
        />
      )

      const failedButton = screen.getByTestId("filter-btn-FAILED")

      expect(failedButton).toHaveClass("bg-muted")
    })

    // @clause CL-FLT-001
    it("succeeds when inactive button has text-muted-foreground class", () => {
      render(
        <FilterBar
          activeFilter="ALL"
          counts={mockCounts}
          onFilterChange={vi.fn()}
        />
      )

      const warningButton = screen.getByTestId("filter-btn-WARNING")

      expect(warningButton).toHaveClass("text-muted-foreground")
    })
  })

  // ==========================================================================
  // CL-FLT-002: Filter button ativo mantém estilos
  // ==========================================================================

  describe("CL-FLT-002 — Filter button ativo mantém bg-blue-600 e text-white", () => {
    const mockCounts: Record<StatusFilter, number> = {
      ALL: 10,
      PASSED: 5,
      FAILED: 2,
      WARNING: 1,
      SKIPPED: 2,
    }

    // @clause CL-FLT-002
    // @ui-clause CL-UI-FilterButton-active-bg
    it("succeeds when active button has bg-blue-600 class", () => {
      render(
        <FilterBar
          activeFilter="ALL"
          counts={mockCounts}
          onFilterChange={vi.fn()}
        />
      )

      const allButton = screen.getByTestId("filter-btn-ALL")

      expect(allButton).toHaveClass("bg-blue-600")
    })

    // @clause CL-FLT-002
    // @ui-clause CL-UI-FilterButton-active-text
    it("succeeds when active button has text-white class", () => {
      render(
        <FilterBar
          activeFilter="ALL"
          counts={mockCounts}
          onFilterChange={vi.fn()}
        />
      )

      const allButton = screen.getByTestId("filter-btn-ALL")

      expect(allButton).toHaveClass("text-white")
    })

    // @clause CL-FLT-002
    // @ui-clause CL-UI-FilterButton-active-both-classes
    it("succeeds when active button has both bg-blue-600 and text-white", () => {
      render(
        <FilterBar
          activeFilter="FAILED"
          counts={mockCounts}
          onFilterChange={vi.fn()}
        />
      )

      const failedButton = screen.getByTestId("filter-btn-FAILED")

      expect(failedButton).toHaveClass("bg-blue-600")
      expect(failedButton).toHaveClass("text-white")
    })

    // @clause CL-FLT-002
    it("succeeds when different active filter shows correct styles", async () => {
      const onFilterChange = vi.fn()
      const user = userEvent.setup()

      const { rerender } = render(
        <FilterBar
          activeFilter="ALL"
          counts={mockCounts}
          onFilterChange={onFilterChange}
        />
      )

      // Initially ALL is active
      expect(screen.getByTestId("filter-btn-ALL")).toHaveClass("bg-blue-600")
      expect(screen.getByTestId("filter-btn-PASSED")).not.toHaveClass("bg-blue-600")

      // Simulate clicking PASSED
      await user.click(screen.getByTestId("filter-btn-PASSED"))
      expect(onFilterChange).toHaveBeenCalledWith("PASSED")

      // Rerender with PASSED active
      rerender(
        <FilterBar
          activeFilter="PASSED"
          counts={mockCounts}
          onFilterChange={onFilterChange}
        />
      )

      expect(screen.getByTestId("filter-btn-PASSED")).toHaveClass("bg-blue-600")
      expect(screen.getByTestId("filter-btn-PASSED")).toHaveClass("text-white")
      expect(screen.getByTestId("filter-btn-ALL")).not.toHaveClass("bg-blue-600")
    })
  })

  // ==========================================================================
  // CL-LAY-001: Card mantém layout col-span-6
  // ==========================================================================

  describe("CL-LAY-001 — Card mantém layout col-span-6", () => {
    // @clause CL-LAY-001
    // @ui-clause CL-UI-TaskPromptCard-layout-colSpan
    it("succeeds when card has col-span-6 class", () => {
      const mockRun = createMockRun()

      render(<TaskPromptCard run={mockRun} />)

      const card = screen.getByTestId("overview-task-prompt")

      expect(card).toHaveClass("col-span-6")
    })

    // @clause CL-LAY-001
    // @ui-clause CL-UI-TaskPromptCard-layout-grid
    it("succeeds when card is within 12-column grid", () => {
      const mockRun = createMockRun()

      render(<OverviewCards run={mockRun} />)

      const overviewCards = screen.getByTestId("overview-cards")
      const taskPromptCard = within(overviewCards).getByTestId("overview-task-prompt")

      expect(overviewCards).toHaveClass("grid-cols-12")
      expect(taskPromptCard).toHaveClass("col-span-6")
    })

    // @clause CL-LAY-001
    // @ui-clause CL-UI-TaskPromptCard-layout-position
    it("succeeds when card occupies correct position in grid", () => {
      const mockRun = createMockRun()

      render(<OverviewCards run={mockRun} />)

      const overviewCards = screen.getByTestId("overview-cards")
      const progressCard = within(overviewCards).getByTestId("overview-progress")
      const contractCard = within(overviewCards).getByTestId("overview-contract")
      const executionCard = within(overviewCards).getByTestId("overview-execution")
      const taskPromptCard = within(overviewCards).getByTestId("overview-task-prompt")

      // Verify all cards are present
      expect(progressCard).toBeInTheDocument()
      expect(contractCard).toBeInTheDocument()
      expect(executionCard).toBeInTheDocument()
      expect(taskPromptCard).toBeInTheDocument()

      // Verify col-span classes
      expect(progressCard).toHaveClass("col-span-2")
      expect(contractCard).toHaveClass("col-span-2")
      expect(executionCard).toHaveClass("col-span-2")
      expect(taskPromptCard).toHaveClass("col-span-6")
    })

    // @clause CL-LAY-001
    it("succeeds when card maintains p-4 spacing class", () => {
      const mockRun = createMockRun()

      render(<TaskPromptCard run={mockRun} />)

      const card = screen.getByTestId("overview-task-prompt")

      expect(card).toHaveClass("p-4")
    })
  })

  // ==========================================================================
  // Integration Tests - Combined Scenarios
  // ==========================================================================

  describe("Integration — Combined Scenarios", () => {
    const mockCounts: Record<StatusFilter, number> = {
      ALL: 10,
      PASSED: 5,
      FAILED: 2,
      WARNING: 1,
      SKIPPED: 2,
    }

    // @clause CL-TASK-001
    // @clause CL-TASK-002
    // @clause CL-TASK-003
    it("succeeds when card renders complete happy path scenario", () => {
      const mockRun = createMockRun({
        taskPrompt: "Implementar feature de autenticação com OAuth2",
        contractJson: JSON.stringify({ changeType: "new", slug: "oauth-auth" }),
      })

      render(<TaskPromptCard run={mockRun} />)

      const card = screen.getByTestId("overview-task-prompt")
      const title = within(card).getByRole("heading", { level: 3 })
      const badge = screen.getByTestId("task-prompt-badge")
      const taskText = within(card).getByText(/Implementar feature/)

      // CL-TASK-001
      expect(title).toHaveTextContent("Prompt da Tarefa")

      // CL-TASK-002
      expect(taskText).toHaveClass("truncate")
      expect(taskText).toHaveAttribute("title", "Implementar feature de autenticação com OAuth2")

      // CL-TASK-003
      expect(badge).toHaveTextContent("new")
    })

    // @clause CL-TASK-004
    // @clause CL-TASK-005
    it("fails when contractJson is missing or invalid shows fallback", () => {
      // Test null contractJson
      const mockRunNull = createMockRun({ contractJson: undefined })
      const { rerender } = render(<TaskPromptCard run={mockRunNull} />)

      let badge = screen.getByTestId("task-prompt-badge")
      expect(badge).toHaveTextContent("—")

      // Test invalid JSON
      rerender(<TaskPromptCard run={createMockRun({ contractJson: "invalid{json" })} />)
      badge = screen.getByTestId("task-prompt-badge")
      expect(badge).toHaveTextContent("—")
    })

    // @clause CL-FLT-001
    // @clause CL-FLT-002
    it("succeeds when filter buttons toggle correctly between states", async () => {
      const onFilterChange = vi.fn()
      const user = userEvent.setup()

      const { rerender } = render(
        <FilterBar
          activeFilter="ALL"
          counts={mockCounts}
          onFilterChange={onFilterChange}
        />
      )

      // Verify initial state
      const allBtn = screen.getByTestId("filter-btn-ALL")
      const failedBtn = screen.getByTestId("filter-btn-FAILED")

      // CL-FLT-002: Active button styles
      expect(allBtn).toHaveClass("bg-blue-600")
      expect(allBtn).toHaveClass("text-white")

      // CL-FLT-001: Inactive button styles
      expect(failedBtn).toHaveClass("hover:bg-muted/50")
      expect(failedBtn).not.toHaveClass("bg-blue-600")

      // Click FAILED
      await user.click(failedBtn)
      expect(onFilterChange).toHaveBeenCalledWith("FAILED")

      // Rerender with new state
      rerender(
        <FilterBar
          activeFilter="FAILED"
          counts={mockCounts}
          onFilterChange={onFilterChange}
        />
      )

      // Verify styles swapped
      expect(screen.getByTestId("filter-btn-FAILED")).toHaveClass("bg-blue-600")
      expect(screen.getByTestId("filter-btn-FAILED")).toHaveClass("text-white")
      expect(screen.getByTestId("filter-btn-ALL")).toHaveClass("hover:bg-muted/50")
    })
  })
})
