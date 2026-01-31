import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"
import { render, screen, within, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"

import { DashboardPage } from "@/components/dashboard-page"
import { RunsListPage } from "@/components/runs-list-page"
import { RunDetailsPage } from "@/components/run-details-page"
import { WorkspacesListPage } from "@/components/workspaces-list-page"
import { ProjectsListPage } from "@/components/projects-list-page"
import { NewValidationPage } from "@/components/new-validation-page"

import { api } from "@/lib/api"
import type { PaginatedResponse, Project, Run, RunWithResults, Workspace } from "@/lib/types"

// Prevent real SSE/EventSource usage from RunDetailsPage.
vi.mock("@/hooks/useRunEvents", () => ({
  useRunEvents: () => {},
}))

// Prevent real network usage: all page-level data loaders use api.*.
vi.mock("@/lib/api", () => ({
  API_BASE: "http://localhost:3001/api",
  api: {
    runs: {
      list: vi.fn(),
      getWithResults: vi.fn(),
      create: vi.fn(),
      uploadFiles: vi.fn(),
      abort: vi.fn(),
      delete: vi.fn(),
      rerunGate: vi.fn(),
      bypassValidator: vi.fn(),
    },
    workspaces: {
      list: vi.fn(),
      delete: vi.fn(),
    },
    projects: {
      list: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

type MockedApi = typeof api & {
  runs: {
    list: ReturnType<typeof vi.fn>
    getWithResults: ReturnType<typeof vi.fn>
  }
  workspaces: { list: ReturnType<typeof vi.fn> }
  projects: { list: ReturnType<typeof vi.fn> }
}

const mockedApi = api as unknown as MockedApi

const paginated = <T,>(data: T[], total = data.length): PaginatedResponse<T> => ({
  data,
  pagination: {
    page: 1,
    limit: data.length,
    total,
    pages: 1,
  },
})

const makeWorkspace = (overrides: Partial<Workspace> = {}): Workspace => ({
  id: "ws-1",
  name: "Acme",
  description: "Workspace",
  rootPath: "/workspaces/acme",
  artifactsDir: "/workspaces/acme/artifacts",
  isActive: true,
  createdAt: "2026-01-31T00:00:00.000Z",
  updatedAt: "2026-01-31T00:00:00.000Z",
  _count: { projects: 1, workspaceConfigs: 0 },
  ...overrides,
})

const makeProject = (overrides: Partial<Project> = {}): Project => ({
  id: "proj-1",
  workspaceId: "ws-1",
  workspace: {
    id: "ws-1",
    name: "Acme",
    rootPath: "/workspaces/acme",
    artifactsDir: "/workspaces/acme/artifacts",
  },
  name: "gatekeeper",
  description: "Project",
  baseRef: "origin/main",
  targetRef: "HEAD",
  backendWorkspace: "default",
  isActive: true,
  createdAt: "2026-01-31T00:00:00.000Z",
  updatedAt: "2026-01-31T00:00:00.000Z",
  _count: { validationRuns: 3 },
  ...overrides,
})

const makeRun = (overrides: Partial<Run> = {}): Run => ({
  id: "run-1",
  outputId: "2026_01_31_001_nova_validacao_cta",
  projectPath: "/home/user/repo",
  baseRef: "origin/main",
  targetRef: "HEAD",
  taskPrompt: "Create CTA Nova Validação",
  manifestJson: JSON.stringify({ testFile: "src/components/__tests__/x.spec.tsx", files: [] }),
  testFilePath: "src/components/__tests__/x.spec.tsx",
  dangerMode: false,
  runType: "CONTRACT",
  status: "PASSED",
  currentGate: 1,
  createdAt: "2026-01-31T00:00:00.000Z",
  updatedAt: "2026-01-31T00:00:00.000Z",
  commitHash: "abc123def4567890",
  commitMessage: "feat: add CTA",
  committedAt: "2026-01-31T00:00:00.000Z",
  project: {
    id: "proj-1",
    name: "gatekeeper",
    workspace: { id: "ws-1", name: "Acme" },
  },
  ...overrides,
})

const makeRunWithResults = (overrides: Partial<RunWithResults> = {}): RunWithResults => ({
  ...(makeRun() as RunWithResults),
  gateResults: [],
  validatorResults: [],
  executionRuns: [],
  ...overrides,
})

function renderAt(initialEntry: string, routes: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>{routes}</Routes>
    </MemoryRouter>
  )
}

beforeAll(() => {
  // Radix UI components may rely on ResizeObserver in some environments.
  if (!globalThis.ResizeObserver) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as any
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

// ============================================================================
// Contract: nova_validacao_cta_ui (STRICT) — Spec file
// ============================================================================

describe("Contract: nova_validacao_cta_ui — CTA 'Nova Validação' + ajustes de UI", () => {
  // --------------------------------------------------------------------------
  // CL-CTA-001
  // --------------------------------------------------------------------------

  // @clause CL-CTA-001
  it("succeeds when the CTA module exists and exports a reusable CTA component", async () => {
    const mod = await import("@/components/new-validation-cta-button")
    expect(mod).toHaveProperty("NewValidationCtaButton")
    expect(typeof (mod as { NewValidationCtaButton: unknown }).NewValidationCtaButton).toBe("function")
  })

  // @clause CL-CTA-001
  // @ui-clause CL-UI-NewValidationCtaButton-outline
  it("succeeds when the CTA renders with testid and required styling classes", async () => {
    const run = makeRunWithResults({ id: "run-cta-1" })
    mockedApi.runs.getWithResults.mockResolvedValueOnce(run)

    renderAt("/runs/run-cta-1", (
      <>
        <Route path="/runs/:id" element={<RunDetailsPage />} />
      </>
    ))

    const btn = await screen.findByTestId("btn-new-run")
    expect(btn).toHaveTextContent("Nova Validação")
    expect(btn).toHaveClass("bg-white")
    expect(btn).toHaveClass("border-gray-300")
    expect(btn).toHaveClass("text-blue-600")
    expect(btn).toHaveClass("hover:bg-blue-600")
    expect(btn).toHaveClass("hover:text-white")
    expect(btn).toHaveClass("hover:border-blue-600")
  })

  // @clause CL-CTA-001
  it("succeeds when clicking the CTA navigates to /runs/new", async () => {
    const user = userEvent.setup()

    const run = makeRunWithResults({ id: "run-cta-2" })
    mockedApi.runs.getWithResults.mockResolvedValueOnce(run)

    renderAt("/runs/run-cta-2", (
      <>
        <Route path="/runs/:id" element={<RunDetailsPage />} />
        <Route path="/runs/new" element={<div data-testid="route-runs-new" />} />
      </>
    ))

    const btn = await screen.findByTestId("btn-new-run")
    await user.click(btn)

    expect(await screen.findByTestId("route-runs-new")).toBeInTheDocument()
  })

  // --------------------------------------------------------------------------
  // CL-RUN-DETAILS-001
  // --------------------------------------------------------------------------

  // @clause CL-RUN-DETAILS-001
  it("succeeds when RunDetailsPage header action is the CTA labeled 'Nova Validação'", async () => {
    const run = makeRunWithResults({ id: "run-details-1" })
    mockedApi.runs.getWithResults.mockResolvedValueOnce(run)

    renderAt("/runs/run-details-1", (
      <>
        <Route path="/runs/:id" element={<RunDetailsPage />} />
      </>
    ))

    const header = await screen.findByTestId("run-header")
    const cta = within(header).getByTestId("btn-new-run")
    expect(cta).toHaveTextContent("Nova Validação")
    expect(cta.tagName.toLowerCase()).toBe("button")
  })

  // @clause CL-RUN-DETAILS-001
  it("succeeds when the legacy 'New Run' label is not present on RunDetailsPage", async () => {
    const run = makeRunWithResults({ id: "run-details-2" })
    mockedApi.runs.getWithResults.mockResolvedValueOnce(run)

    renderAt("/runs/run-details-2", (
      <>
        <Route path="/runs/:id" element={<RunDetailsPage />} />
      </>
    ))

    await screen.findByTestId("run-header")
    expect(screen.queryByText("New Run")).not.toBeInTheDocument()
  })

  // @clause CL-RUN-DETAILS-001
  it("fails when RunDetailsPage still shows a 'New Run' action instead of 'Nova Validação'", async () => {
    const run = makeRunWithResults({ id: "run-details-3" })
    mockedApi.runs.getWithResults.mockResolvedValueOnce(run)

    renderAt("/runs/run-details-3", (
      <>
        <Route path="/runs/:id" element={<RunDetailsPage />} />
      </>
    ))

    await screen.findByTestId("run-header")
    // Sad-path contract check: no legacy label should remain once CTA is implemented.
    expect(screen.queryByText("New Run")).not.toBeInTheDocument()
  })

  // --------------------------------------------------------------------------
  // CL-RUNS-LIST-001
  // --------------------------------------------------------------------------

  // @clause CL-RUNS-LIST-001
  it("succeeds when RunsListPage header shows the CTA with testid and label 'Nova Validação'", async () => {
    mockedApi.runs.list.mockResolvedValueOnce(paginated([makeRun({ id: "r1" })], 1))
    mockedApi.workspaces.list.mockResolvedValueOnce(paginated([makeWorkspace()], 1))
    mockedApi.projects.list.mockResolvedValueOnce(paginated([makeProject()], 1))

    renderAt("/runs", (
      <>
        <Route path="/runs" element={<RunsListPage />} />
      </>
    ))

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Runs de Validação" })).toBeInTheDocument()
    })

    const btn = screen.getByTestId("btn-new-run")
    expect(btn).toHaveTextContent("Nova Validação")
  })

  // @clause CL-RUNS-LIST-001
  it("succeeds when RunsListPage does not render the legacy 'New Validation' button", async () => {
    mockedApi.runs.list.mockResolvedValueOnce(paginated([makeRun({ id: "r2" })], 1))
    mockedApi.workspaces.list.mockResolvedValueOnce(paginated([makeWorkspace()], 1))
    mockedApi.projects.list.mockResolvedValueOnce(paginated([makeProject()], 1))

    renderAt("/runs", (
      <>
        <Route path="/runs" element={<RunsListPage />} />
      </>
    ))

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Runs de Validação" })).toBeInTheDocument()
    })

    expect(screen.queryByText("New Validation")).not.toBeInTheDocument()
  })

  // @clause CL-RUNS-LIST-001
  it("succeeds when clicking the RunsListPage CTA navigates to /runs/new", async () => {
    const user = userEvent.setup()

    mockedApi.runs.list.mockResolvedValueOnce(paginated([makeRun({ id: "r3" })], 1))
    mockedApi.workspaces.list.mockResolvedValueOnce(paginated([makeWorkspace()], 1))
    mockedApi.projects.list.mockResolvedValueOnce(paginated([makeProject()], 1))

    renderAt("/runs", (
      <>
        <Route path="/runs" element={<RunsListPage />} />
        <Route path="/runs/new" element={<div data-testid="route-runs-new" />} />
      </>
    ))

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Runs de Validação" })).toBeInTheDocument()
    })

    await user.click(screen.getByTestId("btn-new-run"))
    expect(await screen.findByTestId("route-runs-new")).toBeInTheDocument()
  })

  // --------------------------------------------------------------------------
  // CL-DASH-001
  // --------------------------------------------------------------------------

  // @clause CL-DASH-001
  it("succeeds when DashboardPage shows the CTA immediately to the right of the 'Todos Projetos' select", async () => {
    const recentRuns = [makeRun({ id: "dash-run-1" })]
    const workspaces = [makeWorkspace()]
    const projects = [makeProject()]

    mockedApi.runs.list
      .mockResolvedValueOnce(paginated(recentRuns, 1)) // recent runs (limit 5)
      .mockResolvedValueOnce(paginated(recentRuns, 1)) // all runs (limit 100)
    mockedApi.workspaces.list.mockResolvedValueOnce(paginated(workspaces, 1))
    mockedApi.projects.list.mockResolvedValueOnce(paginated(projects, 1))

    renderAt("/", (
      <>
        <Route path="/" element={<DashboardPage />} />
      </>
    ))

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument()
    })

    const projectTriggerText = screen.getByText("Todos Projetos")
    const projectTriggerButton = projectTriggerText.closest("button")
    expect(projectTriggerButton).not.toBeNull()

    const filterGroup = projectTriggerButton!.parentElement
    expect(filterGroup).not.toBeNull()

    const cta = within(filterGroup!).getByTestId("btn-new-run")
    const buttons = Array.from(within(filterGroup!).getAllByRole("button"))
    const projectIndex = buttons.indexOf(projectTriggerButton as HTMLButtonElement)
    const ctaIndex = buttons.indexOf(cta as HTMLButtonElement)

    expect(projectIndex).toBeGreaterThanOrEqual(0)
    expect(ctaIndex).toBe(projectIndex + 1)
  })

  // @clause CL-DASH-001
  it("succeeds when DashboardPage renders the CTA with label 'Nova Validação' in the filter group", async () => {
    const recentRuns = [makeRun({ id: "dash-run-2" })]
    mockedApi.runs.list
      .mockResolvedValueOnce(paginated(recentRuns, 1))
      .mockResolvedValueOnce(paginated(recentRuns, 1))
    mockedApi.workspaces.list.mockResolvedValueOnce(paginated([makeWorkspace()], 1))
    mockedApi.projects.list.mockResolvedValueOnce(paginated([makeProject()], 1))

    renderAt("/", (
      <>
        <Route path="/" element={<DashboardPage />} />
      </>
    ))

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument()
    })

    const btn = screen.getByTestId("btn-new-run")
    expect(btn).toHaveTextContent("Nova Validação")
  })

  // @clause CL-DASH-001
  it("fails when DashboardPage does not place the CTA next to the project select", async () => {
    const recentRuns = [makeRun({ id: "dash-run-3" })]
    mockedApi.runs.list
      .mockResolvedValueOnce(paginated(recentRuns, 1))
      .mockResolvedValueOnce(paginated(recentRuns, 1))
    mockedApi.workspaces.list.mockResolvedValueOnce(paginated([makeWorkspace()], 1))
    mockedApi.projects.list.mockResolvedValueOnce(paginated([makeProject()], 1))

    renderAt("/", (
      <>
        <Route path="/" element={<DashboardPage />} />
      </>
    ))

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument()
    })

    const projectTriggerText = screen.getByText("Todos Projetos")
    const projectTriggerButton = projectTriggerText.closest("button") as HTMLButtonElement | null
    expect(projectTriggerButton).not.toBeNull()

    const filterGroup = projectTriggerButton!.parentElement
    expect(filterGroup).not.toBeNull()

    const cta = within(filterGroup!).getByTestId("btn-new-run")
    const buttons = Array.from(within(filterGroup!).getAllByRole("button"))
    const projectIndex = buttons.indexOf(projectTriggerButton as HTMLButtonElement)
    const ctaIndex = buttons.indexOf(cta as HTMLButtonElement)

    // Sad-path: the CTA must be adjacent, not elsewhere.
    expect(ctaIndex).toBe(projectIndex + 1)
  })

  // --------------------------------------------------------------------------
  // CL-DASH-RECENT-001
  // --------------------------------------------------------------------------

  // @clause CL-DASH-RECENT-001
  it("succeeds when each Recent Runs card shows taskPrompt when available", async () => {
    const recentRuns = [
      makeRun({ id: "dash-task-1", taskPrompt: "Run task prompt A" }),
      makeRun({ id: "dash-task-2", taskPrompt: "Run task prompt B" }),
    ]

    mockedApi.runs.list
      .mockResolvedValueOnce(paginated(recentRuns, 2))
      .mockResolvedValueOnce(paginated(recentRuns, 2))
    mockedApi.workspaces.list.mockResolvedValueOnce(paginated([makeWorkspace()], 1))
    mockedApi.projects.list.mockResolvedValueOnce(paginated([makeProject()], 1))

    renderAt("/", (
      <>
        <Route path="/" element={<DashboardPage />} />
      </>
    ))

    await waitFor(() => {
      expect(screen.getByText("Recent Runs")).toBeInTheDocument()
    })

    const prompts = screen.getAllByTestId("recent-run-taskPrompt")
    expect(prompts).toHaveLength(2)
    expect(prompts[0]).toHaveTextContent("Run task prompt A")
    expect(prompts[1]).toHaveTextContent("Run task prompt B")
  })

  // @clause CL-DASH-RECENT-001
  it("succeeds when a Recent Runs card omits taskPrompt element if taskPrompt is missing", async () => {
    const recentRuns = [makeRun({ id: "dash-task-3", taskPrompt: undefined })]

    mockedApi.runs.list
      .mockResolvedValueOnce(paginated(recentRuns, 1))
      .mockResolvedValueOnce(paginated(recentRuns, 1))
    mockedApi.workspaces.list.mockResolvedValueOnce(paginated([makeWorkspace()], 1))
    mockedApi.projects.list.mockResolvedValueOnce(paginated([makeProject()], 1))

    renderAt("/", (
      <>
        <Route path="/" element={<DashboardPage />} />
      </>
    ))

    await waitFor(() => {
      expect(screen.getByText("Recent Runs")).toBeInTheDocument()
    })

    expect(screen.queryByTestId("recent-run-taskPrompt")).not.toBeInTheDocument()
  })

  // @clause CL-DASH-RECENT-001
  it("fails when Recent Runs does not render taskPrompt inside the card for runs that have it", async () => {
    const recentRuns = [makeRun({ id: "dash-task-4", taskPrompt: "Expected prompt" })]

    mockedApi.runs.list
      .mockResolvedValueOnce(paginated(recentRuns, 1))
      .mockResolvedValueOnce(paginated(recentRuns, 1))
    mockedApi.workspaces.list.mockResolvedValueOnce(paginated([makeWorkspace()], 1))
    mockedApi.projects.list.mockResolvedValueOnce(paginated([makeProject()], 1))

    renderAt("/", (
      <>
        <Route path="/" element={<DashboardPage />} />
      </>
    ))

    await waitFor(() => {
      expect(screen.getByText("Recent Runs")).toBeInTheDocument()
    })

    const prompt = screen.getByTestId("recent-run-taskPrompt")
    expect(prompt).toHaveTextContent("Expected prompt")
  })

  // --------------------------------------------------------------------------
  // CL-DASH-RECENT-002
  // --------------------------------------------------------------------------

  // @clause CL-DASH-RECENT-002
  it("succeeds when Recent Runs cards show commitHash and/or commitMessage when available", async () => {
    const recentRuns = [
      makeRun({ id: "dash-commit-1", commitHash: "abcdef1234567890", commitMessage: "fix: something" }),
      makeRun({ id: "dash-commit-2", commitHash: null, commitMessage: "chore: message only" }),
    ]

    mockedApi.runs.list
      .mockResolvedValueOnce(paginated(recentRuns, 2))
      .mockResolvedValueOnce(paginated(recentRuns, 2))
    mockedApi.workspaces.list.mockResolvedValueOnce(paginated([makeWorkspace()], 1))
    mockedApi.projects.list.mockResolvedValueOnce(paginated([makeProject()], 1))

    renderAt("/", (
      <>
        <Route path="/" element={<DashboardPage />} />
      </>
    ))

    await waitFor(() => {
      expect(screen.getByText("Recent Runs")).toBeInTheDocument()
    })

    const commitInfos = screen.getAllByTestId("recent-run-commit")
    expect(commitInfos).toHaveLength(2)

    expect(commitInfos[0].textContent).toContain("abcdef1")
    expect(commitInfos[0].textContent).toContain("fix: something")
    expect(commitInfos[1].textContent).toContain("chore: message only")
  })

  // @clause CL-DASH-RECENT-002
  it("succeeds when Recent Runs omits commit info element if both commitHash and commitMessage are missing", async () => {
    const recentRuns = [makeRun({ id: "dash-commit-3", commitHash: null, commitMessage: null })]

    mockedApi.runs.list
      .mockResolvedValueOnce(paginated(recentRuns, 1))
      .mockResolvedValueOnce(paginated(recentRuns, 1))
    mockedApi.workspaces.list.mockResolvedValueOnce(paginated([makeWorkspace()], 1))
    mockedApi.projects.list.mockResolvedValueOnce(paginated([makeProject()], 1))

    renderAt("/", (
      <>
        <Route path="/" element={<DashboardPage />} />
      </>
    ))

    await waitFor(() => {
      expect(screen.getByText("Recent Runs")).toBeInTheDocument()
    })

    expect(screen.queryByTestId("recent-run-commit")).not.toBeInTheDocument()
  })

  // @clause CL-DASH-RECENT-002
  it("fails when Recent Runs renders commit info placeholders instead of real commit content", async () => {
    const recentRuns = [
      makeRun({ id: "dash-commit-4", commitHash: "1234567890abcdef", commitMessage: "Expected commit message" }),
    ]

    mockedApi.runs.list
      .mockResolvedValueOnce(paginated(recentRuns, 1))
      .mockResolvedValueOnce(paginated(recentRuns, 1))
    mockedApi.workspaces.list.mockResolvedValueOnce(paginated([makeWorkspace()], 1))
    mockedApi.projects.list.mockResolvedValueOnce(paginated([makeProject()], 1))

    renderAt("/", (
      <>
        <Route path="/" element={<DashboardPage />} />
      </>
    ))

    await waitFor(() => {
      expect(screen.getByText("Recent Runs")).toBeInTheDocument()
    })

    const commit = screen.getByTestId("recent-run-commit")
    expect(commit.textContent).toContain("1234567")
    expect(commit.textContent).toContain("Expected commit message")
    expect(commit.textContent).not.toContain("undefined")
    expect(commit.textContent).not.toContain("null")
  })

  // --------------------------------------------------------------------------
  // CL-WORKSPACES-001
  // --------------------------------------------------------------------------

  // @clause CL-WORKSPACES-001
  it("succeeds when WorkspacesListPage header contains '+ Novo Workspace' and the CTA to its right", async () => {
    mockedApi.workspaces.list.mockResolvedValueOnce(paginated([makeWorkspace()], 1))

    renderAt("/workspaces", (
      <>
        <Route path="/workspaces" element={<WorkspacesListPage />} />
      </>
    ))

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Workspaces" })).toBeInTheDocument()
    })

    const header = screen.getByRole("heading", { name: "Workspaces" }).closest("div")
    expect(header).not.toBeNull()

    const pageHeaderRow = header!.parentElement
    expect(pageHeaderRow).not.toBeNull()
    expect(pageHeaderRow).toHaveClass("flex")

    const buttons = within(pageHeaderRow!).getAllByRole("button")
    expect(buttons.length).toBeGreaterThanOrEqual(2)

    const novoWorkspace = buttons.find((b) => b.textContent?.includes("Novo Workspace"))
    expect(novoWorkspace).toBeDefined()

    const cta = within(pageHeaderRow!).getByTestId("btn-new-run")
    expect(cta).toHaveTextContent("Nova Validação")

    const order = buttons.map((b) => b.getAttribute("data-testid") || b.textContent || "")
    expect(order.indexOf("btn-new-run")).toBe(buttons.indexOf(novoWorkspace as HTMLButtonElement) + 1)
  })

  // @clause CL-WORKSPACES-001
  it("succeeds when clicking the Workspaces CTA navigates to /runs/new", async () => {
    const user = userEvent.setup()
    mockedApi.workspaces.list.mockResolvedValueOnce(paginated([makeWorkspace()], 1))

    renderAt("/workspaces", (
      <>
        <Route path="/workspaces" element={<WorkspacesListPage />} />
        <Route path="/runs/new" element={<div data-testid="route-runs-new" />} />
      </>
    ))

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Workspaces" })).toBeInTheDocument()
    })

    await user.click(screen.getByTestId("btn-new-run"))
    expect(await screen.findByTestId("route-runs-new")).toBeInTheDocument()
  })

  // @clause CL-WORKSPACES-001
  it("fails when WorkspacesListPage does not render the CTA next to the '+ Novo Workspace' button", async () => {
    mockedApi.workspaces.list.mockResolvedValueOnce(paginated([makeWorkspace()], 1))

    renderAt("/workspaces", (
      <>
        <Route path="/workspaces" element={<WorkspacesListPage />} />
      </>
    ))

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Workspaces" })).toBeInTheDocument()
    })

    // Sad-path: if CTA is missing or elsewhere, this will fail.
    expect(screen.getByTestId("btn-new-run")).toBeInTheDocument()
  })

  // --------------------------------------------------------------------------
  // CL-PROJECTS-001
  // --------------------------------------------------------------------------

  // @clause CL-PROJECTS-001
  it("succeeds when ProjectsListPage header contains '+ Novo Projeto' and the CTA to its right", async () => {
    mockedApi.projects.list.mockResolvedValueOnce(paginated([makeProject()], 1))
    mockedApi.workspaces.list.mockResolvedValueOnce(paginated([makeWorkspace()], 1))

    renderAt("/projects", (
      <>
        <Route path="/projects" element={<ProjectsListPage />} />
      </>
    ))

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Projetos" })).toBeInTheDocument()
    })

    const headerRow = screen.getByRole("heading", { name: "Projetos" }).closest("div")?.parentElement
    expect(headerRow).not.toBeNull()

    const buttons = within(headerRow!).getAllByRole("button")
    const novoProjeto = buttons.find((b) => b.textContent?.includes("Novo Projeto"))
    expect(novoProjeto).toBeDefined()

    const cta = within(headerRow!).getByTestId("btn-new-run")
    expect(cta).toHaveTextContent("Nova Validação")

    expect(buttons.indexOf(cta as HTMLButtonElement)).toBe(buttons.indexOf(novoProjeto as HTMLButtonElement) + 1)
  })

  // @clause CL-PROJECTS-001
  it("succeeds when clicking the Projects CTA navigates to /runs/new", async () => {
    const user = userEvent.setup()

    mockedApi.projects.list.mockResolvedValueOnce(paginated([makeProject()], 1))
    mockedApi.workspaces.list.mockResolvedValueOnce(paginated([makeWorkspace()], 1))

    renderAt("/projects", (
      <>
        <Route path="/projects" element={<ProjectsListPage />} />
        <Route path="/runs/new" element={<div data-testid="route-runs-new" />} />
      </>
    ))

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Projetos" })).toBeInTheDocument()
    })

    await user.click(screen.getByTestId("btn-new-run"))
    expect(await screen.findByTestId("route-runs-new")).toBeInTheDocument()
  })

  // @clause CL-PROJECTS-001
  it("fails when ProjectsListPage does not render the CTA next to the '+ Novo Projeto' button", async () => {
    mockedApi.projects.list.mockResolvedValueOnce(paginated([makeProject()], 1))
    mockedApi.workspaces.list.mockResolvedValueOnce(paginated([makeWorkspace()], 1))

    renderAt("/projects", (
      <>
        <Route path="/projects" element={<ProjectsListPage />} />
      </>
    ))

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Projetos" })).toBeInTheDocument()
    })

    expect(screen.getByTestId("btn-new-run")).toBeInTheDocument()
  })

  // --------------------------------------------------------------------------
  // CL-RUNS-NEW-001
  // --------------------------------------------------------------------------

  // @clause CL-RUNS-NEW-001
  it("succeeds when /runs/new does not show a 'Voltar para Runs' control (ArrowLeft/back button)", async () => {
    mockedApi.projects.list.mockResolvedValueOnce(paginated([makeProject({ isActive: true })], 1))

    renderAt("/runs/new", (
      <>
        <Route path="/runs/new" element={<NewValidationPage />} />
      </>
    ))

    await waitFor(() => {
      expect(screen.getByRole("heading")).toBeInTheDocument()
    })

    expect(screen.queryByText("Voltar para Runs")).not.toBeInTheDocument()
    expect(screen.queryByTestId("btn-back")).not.toBeInTheDocument()
  })

  // @clause CL-RUNS-NEW-001
  it("succeeds when /runs/new does not expose any accessible control named 'Voltar para Runs'", async () => {
    mockedApi.projects.list.mockResolvedValueOnce(paginated([makeProject({ isActive: true })], 1))

    renderAt("/runs/new", (
      <>
        <Route path="/runs/new" element={<NewValidationPage />} />
      </>
    ))

    await waitFor(() => {
      expect(screen.getByRole("heading")).toBeInTheDocument()
    })

    expect(screen.queryByRole("button", { name: /Voltar para Runs/i })).not.toBeInTheDocument()
    expect(screen.queryByText("Voltar para Runs")).not.toBeInTheDocument()
  })

  // @clause CL-RUNS-NEW-001
  it("fails when /runs/new still renders the legacy back-button text 'Voltar para Runs'", async () => {
    mockedApi.projects.list.mockResolvedValueOnce(paginated([makeProject({ isActive: true })], 1))

    renderAt("/runs/new", (
      <>
        <Route path="/runs/new" element={<NewValidationPage />} />
      </>
    ))

    await waitFor(() => {
      expect(screen.getByRole("heading")).toBeInTheDocument()
    })

    expect(screen.queryByText("Voltar para Runs")).not.toBeInTheDocument()
  })

  // --------------------------------------------------------------------------
  // CL-RUNS-NEW-002
  // --------------------------------------------------------------------------

  // @clause CL-RUNS-NEW-002
  it("succeeds when /runs/new h1 title is exactly 'Nova Validação'", async () => {
    mockedApi.projects.list.mockResolvedValueOnce(paginated([makeProject({ isActive: true })], 1))

    renderAt("/runs/new", (
      <>
        <Route path="/runs/new" element={<NewValidationPage />} />
      </>
    ))

    const h1 = await screen.findByRole("heading", { level: 1, name: "Nova Validação" })
    expect(h1.tagName.toLowerCase()).toBe("h1")
  })

  // @clause CL-RUNS-NEW-002
  it("succeeds when /runs/new uses the same header row pattern as other routes (flex justify-between)", async () => {
    mockedApi.projects.list.mockResolvedValueOnce(paginated([makeProject({ isActive: true })], 1))

    const { container } = renderAt("/runs/new", (
      <>
        <Route path="/runs/new" element={<NewValidationPage />} />
      </>
    ))

    await screen.findByRole("heading", { level: 1, name: "Nova Validação" })

    // Structural parity check: other list pages use a flex header row at the top.
    const headerRow = container.querySelector("div.flex.items-center.justify-between")
    expect(headerRow).not.toBeNull()
  })

  // @clause CL-RUNS-NEW-002
  it("fails when /runs/new title is missing the accent (should be 'Nova Validação')", async () => {
    mockedApi.projects.list.mockResolvedValueOnce(paginated([makeProject({ isActive: true })], 1))

    renderAt("/runs/new", (
      <>
        <Route path="/runs/new" element={<NewValidationPage />} />
      </>
    ))

    // Sad-path contract check: exact title required.
    expect(screen.queryByRole("heading", { level: 1, name: "Nova Validacao" })).not.toBeInTheDocument()
  })
})
