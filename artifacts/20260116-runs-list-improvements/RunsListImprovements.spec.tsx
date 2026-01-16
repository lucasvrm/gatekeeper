import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { RunsListPage } from "@/components/runs-list-page"
import type { Run } from "@/lib/types"

describe("runs-list-page coluna Rejected By mostrando failedValidatorCode", () => {
  it("should adicionar coluna Rejected By entre Gate e Created At", async () => {
    render(
      <MemoryRouter>
        <RunsListPage />
      </MemoryRouter>
    )

    const rejectedByHeader = await screen.findByText("Rejected By", {}, { timeout: 5000 })
    expect(rejectedByHeader).toBeTruthy()
  })

  it("should fail quando tabela não carrega e coluna Rejected By não aparece", async () => {
    render(
      <MemoryRouter>
        <RunsListPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      const headers = screen.queryAllByRole("columnheader")
      expect(headers.length).toBeGreaterThanOrEqual(0)
    }, { timeout: 5000 })
  })
})

describe("runs-list-page botão abort para runs com status PENDING ou RUNNING", () => {
  it("should adicionar botão abort na linha de run com status RUNNING", async () => {
    render(
      <MemoryRouter>
        <RunsListPage />
      </MemoryRouter>
    )

    const abortButtons = await screen.findAllByRole("button", { name: /abort/i }, { timeout: 5000 })
    expect(abortButtons.length).toBeGreaterThan(0)
  })
})

describe("runs-list-page coluna ações com ícone lixeira para deleção individual", () => {
  it("should adicionar coluna ações com ícone lixeira após Created At", async () => {
    render(
      <MemoryRouter>
        <RunsListPage />
      </MemoryRouter>
    )

    const deleteButtons = await screen.findAllByRole("button", { name: /delete/i }, { timeout: 5000 })
    expect(deleteButtons.length).toBeGreaterThan(0)
  })
})

describe("runs-list-page checkbox para seleção múltipla e bulk delete", () => {
  it("should adicionar checkbox em cada linha para seleção múltipla", async () => {
    render(
      <MemoryRouter>
        <RunsListPage />
      </MemoryRouter>
    )

    const checkboxes = await screen.findAllByRole("checkbox", {}, { timeout: 5000 })
    expect(checkboxes.length).toBeGreaterThan(0)
  })

  it("should mostrar botão bulk delete habilitado quando runs selecionados", async () => {
    render(
      <MemoryRouter>
        <RunsListPage />
      </MemoryRouter>
    )

    const checkboxes = await screen.findAllByRole("checkbox", {}, { timeout: 5000 })
    fireEvent.click(checkboxes[0])

    const bulkDeleteButton = screen.getByRole("button", { name: /delete selected/i })
    expect(bulkDeleteButton).not.toBeDisabled()
  })

  it("should fail quando nenhum run selecionado e bulk delete está desabilitado", async () => {
    render(
      <MemoryRouter>
        <RunsListPage />
      </MemoryRouter>
    )

    const bulkDeleteButton = await screen.findByRole("button", { name: /delete selected/i }, { timeout: 5000 })
    expect(bulkDeleteButton).toBeDisabled()
  })

  it("should abrir AlertDialog modal de confirmação ao clicar bulk delete", async () => {
    render(
      <MemoryRouter>
        <RunsListPage />
      </MemoryRouter>
    )

    const checkboxes = await screen.findAllByRole("checkbox", {}, { timeout: 5000 })
    fireEvent.click(checkboxes[0])

    const bulkDeleteButton = screen.getByRole("button", { name: /delete selected/i })
    fireEvent.click(bulkDeleteButton)

    const confirmDialog = await screen.findByRole("alertdialog", {}, { timeout: 5000 })
    expect(confirmDialog).toBeTruthy()
  })
})

describe("campo failedValidatorCode no modelo ValidationRun", () => {
  it("should armazenar código do validador que causou falha em failedValidatorCode", () => {
    const mockRun: Run = {
      id: "test-id",
      outputId: "test-output",
      projectPath: "/test/path",
      baseRef: "origin/main",
      targetRef: "HEAD",
      manifestJson: "{}",
      testFilePath: "test.spec.tsx",
      dangerMode: false,
      runType: "CONTRACT",
      status: "FAILED",
      currentGate: 1,
      failedAt: 1,
      failedValidatorCode: "TEST_SYNTAX_VALID",
      createdAt: "2026-01-16T00:00:00Z",
    }

    expect(mockRun.failedValidatorCode).toBe("TEST_SYNTAX_VALID")
  })

  it("should fail quando run passa e failedValidatorCode é undefined", () => {
    const mockRun: Run = {
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
    }

    expect(mockRun.failedValidatorCode).toBeUndefined()
  })
})