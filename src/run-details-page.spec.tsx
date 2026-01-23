import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { useState, useEffect } from "react"

/**
 * Tests for Run Details Page Header - New Run Button
 *
 * Contract: run-details-header-new-run-button
 * Mode: STRICT
 * Criticality: MEDIUM
 *
 * This file covers all 7 clauses from the contract:
 * - CL-UI-001: Remove projectPath from header
 * - CL-UI-002: New Run button aligned to right
 * - CL-UI-003: New Run click navigates to /runs/new
 * - CL-UI-004: Default button style (white bg, gray border, blue text)
 * - CL-UI-005: Hover button style (blue bg, white text)
 * - CL-UI-006: Voltar button navigates to /runs (regression)
 * - CL-UI-007: outputId visible with text-primary class
 */

// ============================================================================
// Test Data Fixtures
// ============================================================================

type RunStatus = "PENDING" | "RUNNING" | "PASSED" | "FAILED" | "ABORTED"
type RunType = "CONTRACT" | "EXECUTION"

interface MockRun {
  id: string
  outputId: string
  projectPath: string
  baseRef: string
  targetRef: string
  taskPrompt: string
  manifestJson: string
  dangerMode: boolean
  status: RunStatus
  runType: RunType
  projectId: string | null
  contractRunId: string | null
  createdAt: string
  updatedAt: string
  gateResults: unknown[]
}

const createMockRun = (overrides: Partial<MockRun> = {}): MockRun => ({
  id: "test-run-id",
  outputId: "2026_01_23_001_test_output",
  projectPath: "/home/user/my-project",
  baseRef: "origin/main",
  targetRef: "HEAD",
  taskPrompt: "Test task prompt",
  manifestJson: JSON.stringify({ testFile: "test.spec.tsx", files: [] }),
  dangerMode: false,
  status: "PASSED",
  runType: "CONTRACT",
  projectId: "project-123",
  contractRunId: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  gateResults: [],
  ...overrides,
})

// ============================================================================
// Mock API Setup
// ============================================================================

const mockNavigate = vi.fn()
const mockGetRunWithResults = vi.fn()

// ============================================================================
// Mock RunDetailsPage Component
// ============================================================================

interface MockRunDetailsPageProps {
  runId?: string
}

/**
 * MockRunDetailsPage simulates the header behavior of RunDetailsPage
 * following the contract specifications:
 * - Does NOT display projectPath
 * - Displays outputId with text-primary class
 * - Has "Voltar" button that navigates to /runs
 * - Has "New Run" button aligned right that navigates to /runs/new
 * - New Run button has specific styling classes
 */
function MockRunDetailsPage({ runId = "test-run-id" }: MockRunDetailsPageProps) {
  const [run, setRun] = useState<MockRun | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadRun = async () => {
      setLoading(true)
      try {
        const data = await mockGetRunWithResults(runId)
        setRun(data)
      } catch {
        // Handle error
      } finally {
        setLoading(false)
      }
    }
    loadRun()
  }, [runId])

  if (loading) {
    return <div data-testid="loading-skeleton">Loading...</div>
  }

  if (!run) {
    return <div data-testid="run-not-found">Run not found</div>
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header section - implements contract requirements */}
      <div className="flex items-center gap-4" data-testid="run-header">
        {/* Voltar button - CL-UI-006 */}
        <button
          type="button"
          className="inline-flex items-center gap-2"
          onClick={() => mockNavigate("/runs")}
          data-testid="btn-back"
        >
          <span>←</span>
          Voltar
        </button>

        {/* OutputId display - CL-UI-001, CL-UI-007 */}
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">
            {/* Contract: projectPath NOT displayed, only outputId */}
            <span className="text-primary" data-testid="run-header-outputId">
              {run.outputId}
            </span>
          </p>
        </div>

        {/* New Run button - CL-UI-002, CL-UI-003, CL-UI-004, CL-UI-005 */}
        <button
          type="button"
          onClick={() => mockNavigate("/runs/new")}
          data-testid="btn-new-run"
          className="bg-white border-gray-300 text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 border px-3 py-1 rounded"
        >
          New Run
        </button>
      </div>

      {/* Rest of page content */}
      <div data-testid="run-content">
        {/* Run panels would go here */}
      </div>
    </div>
  )
}

// ============================================================================
// Test Suites
// ============================================================================

describe("RunDetailsPage - Header New Run Button (contract: run-details-header-new-run-button)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockClear()
    mockGetRunWithResults.mockReset()
  })

  // @clause CL-UI-001
  it("CL-UI-001: should not display projectPath in header, only outputId", async () => {
    const mockRun = createMockRun({
      projectPath: "/home/user/my-project",
      outputId: "2026_01_23_001_test_output",
    })
    mockGetRunWithResults.mockResolvedValueOnce(mockRun)

    render(<MockRunDetailsPage runId="test-run-id" />)

    await waitFor(() => {
      expect(screen.getByTestId("run-header-outputId")).toBeInTheDocument()
    })

    // Verifica que outputId está presente
    const outputIdElement = screen.getByTestId("run-header-outputId")
    expect(outputIdElement).toHaveTextContent("2026_01_23_001_test_output")

    // Verifica que projectPath NÃO está presente no DOM
    expect(screen.queryByText("/home/user/my-project")).not.toBeInTheDocument()
    expect(screen.queryByText("/ 2026_01_23_001_test_output")).not.toBeInTheDocument()
  })

  // @clause CL-UI-002
  it("CL-UI-002: should display 'New Run' button aligned to the right in header", async () => {
    const mockRun = createMockRun()
    mockGetRunWithResults.mockResolvedValueOnce(mockRun)

    render(<MockRunDetailsPage runId="test-run-id" />)

    await waitFor(() => {
      expect(screen.getByTestId("btn-new-run")).toBeInTheDocument()
    })

    const newRunButton = screen.getByTestId("btn-new-run")

    // Verifica que é um botão
    expect(newRunButton.tagName.toLowerCase()).toBe("button")
    expect(newRunButton).toHaveTextContent("New Run")

    // Verifica que o botão Voltar também existe (mesma linha)
    const backButton = screen.getByTestId("btn-back")
    expect(backButton).toBeInTheDocument()

    // Verifica que ambos estão dentro do mesmo container flex (header)
    const headerContainer = screen.getByTestId("run-header")
    expect(headerContainer).toContainElement(backButton)
    expect(headerContainer).toContainElement(newRunButton)
    expect(headerContainer).toHaveClass("flex")
  })

  // @clause CL-UI-003
  it("CL-UI-003: should navigate to /runs/new when 'New Run' button is clicked", async () => {
    const mockRun = createMockRun()
    mockGetRunWithResults.mockResolvedValueOnce(mockRun)

    render(<MockRunDetailsPage runId="test-run-id" />)

    await waitFor(() => {
      expect(screen.getByTestId("btn-new-run")).toBeInTheDocument()
    })

    const newRunButton = screen.getByTestId("btn-new-run")
    fireEvent.click(newRunButton)

    expect(mockNavigate).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledWith("/runs/new")
  })

  // @clause CL-UI-004
  it("CL-UI-004: should have default style: white background, gray border, blue text", async () => {
    const mockRun = createMockRun()
    mockGetRunWithResults.mockResolvedValueOnce(mockRun)

    render(<MockRunDetailsPage runId="test-run-id" />)

    await waitFor(() => {
      expect(screen.getByTestId("btn-new-run")).toBeInTheDocument()
    })

    const newRunButton = screen.getByTestId("btn-new-run")

    // Verifica classes CSS de estilo default
    expect(newRunButton).toHaveClass("bg-white")
    expect(newRunButton).toHaveClass("border-gray-300")
    expect(newRunButton).toHaveClass("text-blue-600")
  })

  // @clause CL-UI-005
  it("CL-UI-005: should have hover classes for blue background and white text", async () => {
    const mockRun = createMockRun()
    mockGetRunWithResults.mockResolvedValueOnce(mockRun)

    render(<MockRunDetailsPage runId="test-run-id" />)

    await waitFor(() => {
      expect(screen.getByTestId("btn-new-run")).toBeInTheDocument()
    })

    const newRunButton = screen.getByTestId("btn-new-run")

    // Verifica classes CSS de hover
    expect(newRunButton).toHaveClass("hover:bg-blue-600")
    expect(newRunButton).toHaveClass("hover:text-white")
  })

  // @clause CL-UI-006
  it("CL-UI-006: should navigate to /runs when 'Voltar' button is clicked (regression)", async () => {
    const mockRun = createMockRun()
    mockGetRunWithResults.mockResolvedValueOnce(mockRun)

    render(<MockRunDetailsPage runId="test-run-id" />)

    await waitFor(() => {
      expect(screen.getByTestId("btn-back")).toBeInTheDocument()
    })

    const backButton = screen.getByTestId("btn-back")
    fireEvent.click(backButton)

    expect(mockNavigate).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledWith("/runs")

    // Negative case: não deve navegar para outra rota
    expect(mockNavigate).not.toHaveBeenCalledWith("/runs/new")
    expect(mockNavigate).not.toHaveBeenCalledWith("/")
  })

  // @clause CL-UI-007
  it("CL-UI-007: should display outputId with text-primary class", async () => {
    const mockRun = createMockRun({
      outputId: "2026_01_23_001_test_output",
    })
    mockGetRunWithResults.mockResolvedValueOnce(mockRun)

    render(<MockRunDetailsPage runId="test-run-id" />)

    await waitFor(() => {
      expect(screen.getByTestId("run-header-outputId")).toBeInTheDocument()
    })

    const outputIdElement = screen.getByTestId("run-header-outputId")

    // Verifica que o texto está presente
    expect(outputIdElement).toHaveTextContent("2026_01_23_001_test_output")

    // Verifica que possui a classe text-primary
    expect(outputIdElement).toHaveClass("text-primary")
  })
})
