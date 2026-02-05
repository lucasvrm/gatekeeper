/**
 * @file orchestrator-task-prompt-display.spec.tsx
 * @description Contract spec — Task prompt display card in orchestrator page
 * @contract orchestrator-task-prompt-display
 * @mode STRICT
 */

import React from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

// Hoisted mocks
const { mockNavigate, mockToast } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom")
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  }
})

vi.mock("sonner", () => ({ toast: mockToast }))

// Mock API calls
vi.mock("@/lib/api", () => ({
  API_BASE: "http://localhost:3000",
  api: {
    projects: {
      list: vi.fn().mockResolvedValue([]),
    },
    providers: {
      listAvailable: vi.fn().mockResolvedValue([]),
      listModels: vi.fn().mockResolvedValue([]),
    },
  },
}))

// Component under test (REAL)
import { default as OrchestratorPage } from "@/components/orchestrator-page"

// Fixtures
function createDefaultProps() {
  return {}
}

// Setup
beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
})

afterEach(() => {
  sessionStorage.clear()
})

describe("Task prompt display card in orchestrator page", () => {
  // @clause CL-UI-001
  it("succeeds when card with title is visible on step 0", () => {
    render(
      <MemoryRouter>
        <OrchestratorPage {...createDefaultProps()} />
      </MemoryRouter>
    )

    expect(screen.getByTestId("task-prompt-display-card")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /objetivo da tarefa/i })).toBeInTheDocument()
  })

  // @clause CL-UI-001
  it("succeeds when card is within a visible region", () => {
    render(
      <MemoryRouter>
        <OrchestratorPage {...createDefaultProps()} />
      </MemoryRouter>
    )

    const card = screen.getByTestId("task-prompt-display-card")
    expect(card).toBeVisible()
  })

  // @clause CL-UI-001
  it("fails when card is missing from step 0", () => {
    render(
      <MemoryRouter>
        <OrchestratorPage {...createDefaultProps()} />
      </MemoryRouter>
    )

    // Card MUST exist
    expect(screen.getByTestId("task-prompt-display-card")).toBeInTheDocument()
  })

  // @clause CL-UI-002
  it("succeeds when taskDescription content is rendered in card", async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <OrchestratorPage {...createDefaultProps()} />
      </MemoryRouter>
    )

    const textarea = screen.getByRole("textbox", { name: /descrição da tarefa/i })
    await user.clear(textarea)
    await user.type(textarea, "Implementar feature de login")

    const content = screen.getByTestId("task-prompt-content")
    expect(content).toHaveTextContent("Implementar feature de login")
  })

  // @clause CL-UI-002
  it("succeeds when multiline taskDescription is rendered with preserved newlines", async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <OrchestratorPage {...createDefaultProps()} />
      </MemoryRouter>
    )

    const textarea = screen.getByRole("textbox", { name: /descrição da tarefa/i })
    const multilineText = "Linha 1\nLinha 2\nLinha 3"

    await user.clear(textarea)
    await user.type(textarea, multilineText)

    const content = screen.getByTestId("task-prompt-content")
    expect(content).toHaveTextContent(multilineText)
    // Verify whitespace-pre-wrap class for newline preservation
    expect(content).toHaveClass(/whitespace-pre-wrap/)
  })

  // @clause CL-UI-002
  it("fails when taskDescription content is not displayed", async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <OrchestratorPage {...createDefaultProps()} />
      </MemoryRouter>
    )

    const textarea = screen.getByRole("textbox", { name: /descrição da tarefa/i })
    await user.clear(textarea)
    await user.type(textarea, "Test content")

    const content = screen.getByTestId("task-prompt-content")
    // Must NOT be empty when taskDescription has content
    expect(content.textContent).toBeTruthy()
    expect(content).toHaveTextContent("Test content")
  })

  // @clause CL-UI-003
  it("succeeds when placeholder is shown for empty taskDescription", () => {
    render(
      <MemoryRouter>
        <OrchestratorPage {...createDefaultProps()} />
      </MemoryRouter>
    )

    const content = screen.getByTestId("task-prompt-content")
    expect(content).toHaveTextContent(/nenhuma tarefa descrita ainda/i)
  })

  // @clause CL-UI-003
  it("succeeds when placeholder is shown for whitespace-only taskDescription", async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <OrchestratorPage {...createDefaultProps()} />
      </MemoryRouter>
    )

    const textarea = screen.getByRole("textbox", { name: /descrição da tarefa/i })
    await user.clear(textarea)
    await user.type(textarea, "   ")

    const content = screen.getByTestId("task-prompt-content")
    expect(content).toHaveTextContent(/nenhuma tarefa descrita ainda/i)
  })

  // @clause CL-UI-003
  it("fails when placeholder is missing for undefined taskDescription", () => {
    render(
      <MemoryRouter>
        <OrchestratorPage {...createDefaultProps()} />
      </MemoryRouter>
    )

    const content = screen.getByTestId("task-prompt-content")
    // Must have some text (either placeholder or actual content)
    expect(content.textContent).toBeTruthy()
  })

  // @clause CL-UI-004
  it("succeeds when card appears before task description textarea", () => {
    const { container } = render(
      <MemoryRouter>
        <OrchestratorPage {...createDefaultProps()} />
      </MemoryRouter>
    )

    const card = screen.getByTestId("task-prompt-display-card")
    const textarea = screen.getByRole("textbox", { name: /descrição da tarefa/i })

    // Compare DOM positions
    const cardPosition = card.compareDocumentPosition(textarea)
    // DOCUMENT_POSITION_FOLLOWING = 4 (card comes before textarea)
    expect(cardPosition & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  // @clause CL-UI-004
  it("succeeds when card is visible in viewport on step 0", () => {
    render(
      <MemoryRouter>
        <OrchestratorPage {...createDefaultProps()} />
      </MemoryRouter>
    )

    const card = screen.getByTestId("task-prompt-display-card")
    expect(card).toBeVisible()
  })

  // @clause CL-UI-004
  it("fails when card is positioned after task description textarea", () => {
    const { container } = render(
      <MemoryRouter>
        <OrchestratorPage {...createDefaultProps()} />
      </MemoryRouter>
    )

    const card = screen.getByTestId("task-prompt-display-card")
    const textarea = screen.getByRole("textbox", { name: /descrição da tarefa/i })

    // Card MUST come before textarea
    const cardPosition = card.compareDocumentPosition(textarea)
    expect(cardPosition & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  // @clause CL-UI-005
  it("succeeds when card updates immediately after typing in textarea", async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <OrchestratorPage {...createDefaultProps()} />
      </MemoryRouter>
    )

    const textarea = screen.getByRole("textbox", { name: /descrição da tarefa/i })
    const content = screen.getByTestId("task-prompt-content")

    // Initial state: placeholder
    expect(content).toHaveTextContent(/nenhuma tarefa descrita ainda/i)

    // Type first word
    await user.clear(textarea)
    await user.type(textarea, "A")

    // Should update immediately (reactive)
    await waitFor(() => {
      expect(content).toHaveTextContent("A")
      expect(content).not.toHaveTextContent(/nenhuma tarefa descrita ainda/i)
    })
  })

  // @clause CL-UI-005
  it("succeeds when card reflects incremental changes in textarea", async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <OrchestratorPage {...createDefaultProps()} />
      </MemoryRouter>
    )

    const textarea = screen.getByRole("textbox", { name: /descrição da tarefa/i })
    const content = screen.getByTestId("task-prompt-content")

    await user.clear(textarea)
    await user.type(textarea, "Step 1")

    await waitFor(() => {
      expect(content).toHaveTextContent("Step 1")
    })

    await user.type(textarea, " and Step 2")

    await waitFor(() => {
      expect(content).toHaveTextContent("Step 1 and Step 2")
    })
  })

  // @clause CL-UI-005
  it("fails when card does not update after textarea change", async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <OrchestratorPage {...createDefaultProps()} />
      </MemoryRouter>
    )

    const textarea = screen.getByRole("textbox", { name: /descrição da tarefa/i })
    const content = screen.getByTestId("task-prompt-content")

    await user.clear(textarea)
    await user.type(textarea, "New task")

    // Card MUST update (reactive behavior)
    await waitFor(() => {
      expect(content).toHaveTextContent("New task")
    })
  })
})
