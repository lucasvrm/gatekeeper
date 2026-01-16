import { render, screen, fireEvent } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { vi } from "vitest"
import { RunsListPage } from "@/components/runs-list-page"
import { AppLayout } from "@/components/app-layout"
import type { RunWithResults } from "@/lib/types"

describe("runs-list-page checkbox select all no header da tabela", () => {
  it("should adicionar checkbox select all no header para selecionar todas as runs", async () => {
    render(
      <MemoryRouter>
        <RunsListPage />
      </MemoryRouter>
    )

    const selectAllCheckbox = await screen.findByRole("checkbox", { name: /select all/i }, { timeout: 5000 })
    expect(selectAllCheckbox).toBeTruthy()
  })

  it("should fail quando checkbox select all não seleciona todas as runs", async () => {
    render(
      <MemoryRouter>
        <RunsListPage />
      </MemoryRouter>
    )

    const selectAllCheckbox = await screen.findByRole("checkbox", { name: /select all/i }, { timeout: 5000 })
    fireEvent.click(selectAllCheckbox)

    const allCheckboxes = await screen.findAllByRole("checkbox", {}, { timeout: 5000 })
    const checkedCount = allCheckboxes.filter(cb => cb.hasAttribute("data-state") && cb.getAttribute("data-state") === "checked").length
    expect(checkedCount).toBeGreaterThan(0)
  })
})

describe("runs-list-page traduzir strings para português", () => {
  it("should traduzir Validation Runs para Runs de Validação", async () => {
    render(
      <MemoryRouter>
        <RunsListPage />
      </MemoryRouter>
    )

    const heading = await screen.findByText("Runs de Validação", {}, { timeout: 5000 })
    expect(heading).toBeTruthy()
  })

  it("should traduzir Filter by Status para Filtrar por Status", async () => {
    render(
      <MemoryRouter>
        <RunsListPage />
      </MemoryRouter>
    )

    const filterLabel = await screen.findByText(/Filtrar por Status/i, {}, { timeout: 5000 })
    expect(filterLabel).toBeTruthy()
  })

  it("should traduzir Path do Projeto na coluna da tabela", async () => {
    render(
      <MemoryRouter>
        <RunsListPage />
      </MemoryRouter>
    )

    const columnHeader = await screen.findByText("Path do Projeto", {}, { timeout: 5000 })
    expect(columnHeader).toBeTruthy()
  })

  it("should traduzir Rejeitado Por na coluna da tabela", async () => {
    render(
      <MemoryRouter>
        <RunsListPage />
      </MemoryRouter>
    )

    const columnHeader = await screen.findByText("Rejeitado Por", {}, { timeout: 5000 })
    expect(columnHeader).toBeTruthy()
  })

  it("should traduzir Criado Em na coluna da tabela", async () => {
    render(
      <MemoryRouter>
        <RunsListPage />
      </MemoryRouter>
    )

    const columnHeader = await screen.findByText("Criado Em", {}, { timeout: 5000 })
    expect(columnHeader).toBeTruthy()
  })

  it("should fail quando strings não estão traduzidas e Validation Runs aparece", async () => {
    render(
      <MemoryRouter>
        <RunsListPage />
      </MemoryRouter>
    )

    const englishHeading = screen.queryByText("Validation Runs")
    expect(englishHeading).toBeNull()
  })
})

describe("app-layout traduzir Validation Dashboard para Dashboard de Validações", () => {
  it("should traduzir Validation Dashboard para Dashboard de Validações", () => {
    render(
      <MemoryRouter>
        <AppLayout><div>Test content</div></AppLayout>
      </MemoryRouter>
    )

    const dashboardText = screen.getByText("Dashboard de Validações")
    expect(dashboardText).toBeTruthy()
  })

  it("should fail quando Validation Dashboard aparece em inglês", () => {
    render(
      <MemoryRouter>
        <AppLayout><div>Test content</div></AppLayout>
      </MemoryRouter>
    )

    const englishText = screen.queryByText("Validation Dashboard")
    expect(englishText).toBeNull()
  })
})

describe("run-panel botão rerun por gate e taskPromptOpen true por default", () => {
  const mockRun: RunWithResults = {
    id: "test-id",
    outputId: "test-output",
    projectPath: "/test/path",
    baseRef: "origin/main",
    targetRef: "HEAD",
    manifestJson: "{}",
    testFilePath: "test.spec.tsx",
    dangerMode: false,
    runType: "CONTRACT",
    status: "PASSED",
    currentGate: 1,
    createdAt: "2026-01-16T00:00:00Z",
    taskPrompt: "Test task prompt",
    gateResults: [
      {
        gateNumber: 0,
        gateName: "SANITIZATION",
        status: "PASSED",
        passed: true,
        passedCount: 5,
        failedCount: 0,
        warningCount: 0,
        skippedCount: 0,
      }
    ],
    validatorResults: [],
  }

  it("should traduzir Task Prompt para Prompt da Tarefa em run-panel", async () => {
    const { RunPanel } = await import("@/components/run-panel")
    render(<RunPanel run={mockRun} />)

    const promptLabel = screen.getByText(/Prompt da Tarefa/i)
    expect(promptLabel).toBeTruthy()
  })

  it("should definir taskPromptOpen como true por default mostrando conteúdo expandido", async () => {
    const { RunPanel } = await import("@/components/run-panel")
    render(<RunPanel run={mockRun} />)

    const taskPromptContent = screen.getByText("Test task prompt")
    expect(taskPromptContent).toBeTruthy()
  })

  it("should fail quando Task Prompt aparece em inglês", async () => {
    const { RunPanel } = await import("@/components/run-panel")
    render(<RunPanel run={mockRun} />)

    const englishLabel = screen.queryByText("Task Prompt")
    expect(englishLabel).toBeNull()
  })

  it("should adicionar botão rerun por gate permitindo reexecutar gate específico", async () => {
    const { RunPanel } = await import("@/components/run-panel")
    const mockOnRerunGate = vi.fn()
    render(<RunPanel run={mockRun} onRerunGate={mockOnRerunGate} />)

    const rerunButton = screen.getByRole("button", { name: /rerun gate 0/i })
    expect(rerunButton).toBeTruthy()
  })
})
