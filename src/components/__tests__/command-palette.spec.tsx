import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, within, waitFor, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

/**
 * Contract: command-palette-search v1.0
 * Mode: STRICT
 * Criticality: medium
 *
 * Tests for CommandPalette (Cmd+K) with unified search across
 * Pages, Actions, Runs, Projects, Workspaces, and Validators.
 *
 * These tests import the REAL component — they MUST fail in red-phase
 * because `command-palette.tsx` and `use-command-palette.ts` do not exist yet.
 */

// ---------------------------------------------------------------------------
// Imports of REAL code that does NOT exist yet (red-phase)
// ---------------------------------------------------------------------------
import { CommandPalette } from "@/components/command-palette"
import { useCommandPalette } from "@/hooks/use-command-palette"

// Import real types for mock factories
import type {
  Run,
  Project,
  Workspace,
  ConfigItem,
  PaginatedResponse,
} from "@/lib/types"
import { api } from "@/lib/api"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn()

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  )
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock("@/lib/api", () => ({
  API_BASE: "http://localhost:3001/api",
  api: {
    runs: {
      list: vi.fn(),
      get: vi.fn(),
      getWithResults: vi.fn(),
      create: vi.fn(),
      abort: vi.fn(),
      delete: vi.fn(),
      rerunGate: vi.fn(),
      bypassValidator: vi.fn(),
      uploadFiles: vi.fn(),
    },
    projects: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    workspaces: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      getConfigs: vi.fn(),
      updateConfig: vi.fn(),
      deleteConfig: vi.fn(),
    },
    validators: {
      list: vi.fn(),
      update: vi.fn(),
      bulkUpdate: vi.fn(),
    },
    gates: {
      list: vi.fn(),
      getValidators: vi.fn(),
    },
    config: {
      list: vi.fn(),
      update: vi.fn(),
    },
  },
}))

type MockedApi = {
  runs: { list: ReturnType<typeof vi.fn> }
  projects: { list: ReturnType<typeof vi.fn> }
  workspaces: { list: ReturnType<typeof vi.fn> }
  validators: { list: ReturnType<typeof vi.fn> }
}

const mockedApi = api as unknown as MockedApi

// ---------------------------------------------------------------------------
// Mock Factories
// ---------------------------------------------------------------------------

const paginated = <T,>(
  data: T[],
  total = data.length
): PaginatedResponse<T> => ({
  data,
  pagination: { page: 1, limit: data.length, total, pages: 1 },
})

const makeRun = (overrides: Partial<Run> = {}): Run => ({
  id: "run-1",
  outputId: "2026_01_31_001_test-run",
  projectPath: "/projects/gatekeeper",
  baseRef: "origin/main",
  targetRef: "HEAD",
  taskPrompt: "Implement feature X with tests",
  manifestJson: "{}",
  testFilePath: "src/__tests__/test.spec.tsx",
  dangerMode: false,
  runType: "CONTRACT",
  status: "PASSED",
  currentGate: 3,
  createdAt: "2026-01-31T10:00:00.000Z",
  ...overrides,
})

const makeProject = (overrides: Partial<Project> = {}): Project => ({
  id: "proj-1",
  workspaceId: "ws-1",
  workspace: { id: "ws-1", name: "Acme Corp" },
  name: "gatekeeper",
  description: "Code validation system",
  baseRef: "origin/main",
  targetRef: "HEAD",
  isActive: true,
  createdAt: "2026-01-31T00:00:00.000Z",
  updatedAt: "2026-01-31T00:00:00.000Z",
  ...overrides,
})

const makeWorkspace = (overrides: Partial<Workspace> = {}): Workspace => ({
  id: "ws-1",
  name: "Acme Corp",
  description: "Main workspace",
  rootPath: "/workspaces/acme",
  artifactsDir: "/workspaces/acme/artifacts",
  isActive: true,
  createdAt: "2026-01-31T00:00:00.000Z",
  updatedAt: "2026-01-31T00:00:00.000Z",
  ...overrides,
})

const makeValidator = (overrides: Partial<ConfigItem> = {}): ConfigItem => ({
  id: "val-1",
  key: "MANIFEST_FILES",
  value: true,
  type: "BOOLEAN",
  category: "INPUT_SCOPE",
  description: "Validates manifest files exist",
  ...overrides,
})

// ---------------------------------------------------------------------------
// Seed Data
// ---------------------------------------------------------------------------

const SEED_RUNS: Run[] = [
  makeRun({ id: "run-1", outputId: "2026_01_30_001_feature-a", status: "PASSED" }),
  makeRun({ id: "run-2", outputId: "2026_01_30_002_feature-b", status: "FAILED" }),
  makeRun({ id: "run-3", outputId: "2026_01_31_001_bugfix-c", status: "RUNNING" }),
]

const SEED_PROJECTS: Project[] = [
  makeProject({ id: "proj-1", name: "gatekeeper" }),
  makeProject({ id: "proj-2", name: "uild-engine", workspace: { id: "ws-2", name: "Labs" } }),
]

const SEED_WORKSPACES: Workspace[] = [
  makeWorkspace({ id: "ws-1", name: "Acme Corp" }),
  makeWorkspace({ id: "ws-2", name: "Labs", rootPath: "/workspaces/labs" }),
]

const SEED_VALIDATORS: ConfigItem[] = [
  makeValidator({ id: "val-1", key: "MANIFEST_FILES", description: "Validates manifest files exist" }),
  makeValidator({ id: "val-2", key: "TEST_COVERAGE", description: "Checks test coverage thresholds", category: "TESTS_CONTRACTS" }),
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupAPIMocks({
  runs = SEED_RUNS,
  projects = SEED_PROJECTS,
  workspaces = SEED_WORKSPACES,
  validators = SEED_VALIDATORS,
  runsError = false,
  projectsError = false,
  workspacesError = false,
  validatorsError = false,
}: {
  runs?: Run[]
  projects?: Project[]
  workspaces?: Workspace[]
  validators?: ConfigItem[]
  runsError?: boolean
  projectsError?: boolean
  workspacesError?: boolean
  validatorsError?: boolean
} = {}) {
  if (runsError) {
    mockedApi.runs.list.mockRejectedValue(new Error("Failed to fetch runs"))
  } else {
    mockedApi.runs.list.mockResolvedValue(paginated(runs))
  }

  if (projectsError) {
    mockedApi.projects.list.mockRejectedValue(new Error("Failed to fetch projects"))
  } else {
    mockedApi.projects.list.mockResolvedValue(paginated(projects))
  }

  if (workspacesError) {
    mockedApi.workspaces.list.mockRejectedValue(new Error("Failed to fetch workspaces"))
  } else {
    mockedApi.workspaces.list.mockResolvedValue(paginated(workspaces))
  }

  if (validatorsError) {
    mockedApi.validators.list.mockRejectedValue(new Error("Failed to fetch validators"))
  } else {
    mockedApi.validators.list.mockResolvedValue(validators)
  }
}

/**
 * Renders CommandPalette in an open state inside MemoryRouter.
 * Uses the real component — fails in red-phase because source file doesn't exist.
 */
function renderPalette(open = true, onOpenChange?: (open: boolean) => void) {
  const handleOpenChange = onOpenChange ?? vi.fn()
  return render(
    <MemoryRouter>
      <CommandPalette open={open} onOpenChange={handleOpenChange} />
    </MemoryRouter>
  )
}

/**
 * Wrapper component that uses the real useCommandPalette hook,
 * exposing trigger controls for testing keyboard shortcuts and header integration.
 */
function TestHarness({ children }: { children?: React.ReactNode }) {
  const { open, setOpen, openPalette } = useCommandPalette()
  return (
    <MemoryRouter>
      <div>
        <div
          data-testid="command-palette-trigger"
          onClick={() => openPalette()}
        >
          <input
            type="text"
            placeholder="Buscar..."
            onFocus={() => openPalette()}
          />
        </div>
        <CommandPalette open={open} onOpenChange={setOpen} />
        {children}
      </div>
    </MemoryRouter>
  )
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  setupAPIMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ===========================================================================
// CL-CMDPAL-001 — Opens with Cmd+K / Ctrl+K
// ===========================================================================
describe("CL-CMDPAL-001 — Opens with Cmd+K / Ctrl+K", () => {
  // @clause CL-CMDPAL-001
  it("succeeds when user presses Cmd+K and dialog appears in the DOM", async () => {
    render(<TestHarness />)

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
      )
    })

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    })
  })

  // @clause CL-CMDPAL-001
  it("succeeds when user presses Ctrl+K on Windows and dialog opens", async () => {
    render(<TestHarness />)

    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true })
      )
    })

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    })
  })

  // @clause CL-CMDPAL-001
  it("succeeds when dialog opens and cmdk-input receives focus", async () => {
    render(<TestHarness />)

    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
      )
    })

    await waitFor(() => {
      const dialog = screen.getByRole("dialog")
      const input = dialog.querySelector("[cmdk-input]")
      expect(input).toBeInTheDocument()
      expect(input).toHaveFocus()
    })
  })

  // @clause CL-CMDPAL-001
  it("fails when Cmd+J is pressed instead of Cmd+K — dialog should not open", async () => {
    render(<TestHarness />)

    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "j", metaKey: true, bubbles: true })
      )
    })

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})

// ===========================================================================
// CL-CMDPAL-002 — Closes with Escape
// ===========================================================================
describe("CL-CMDPAL-002 — Closes with Escape", () => {
  // @clause CL-CMDPAL-002
  it("succeeds when Escape is pressed and dialog is removed from DOM", async () => {
    const user = userEvent.setup()
    renderPalette(true)

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    })

    await user.keyboard("{Escape}")

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
  })

  // @clause CL-CMDPAL-002
  it("succeeds when dialog closes and onOpenChange receives false", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    renderPalette(true, onOpenChange)

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    })

    await user.keyboard("{Escape}")

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  // @clause CL-CMDPAL-002
  it("fails when dialog is not open and Escape has no effect", async () => {
    const onOpenChange = vi.fn()
    renderPalette(false, onOpenChange)

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      )
    })

    expect(onOpenChange).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// CL-CMDPAL-003 — Pages group with 7 navigation items
// ===========================================================================
describe("CL-CMDPAL-003 — Pages group with 7 navigation items", () => {
  // @clause CL-CMDPAL-003
  it("succeeds when Pages group heading is visible in the dialog", async () => {
    renderPalette(true)

    await waitFor(() => {
      const dialog = screen.getByRole("dialog")
      const headings = dialog.querySelectorAll("[cmdk-group-heading]")
      const pagesHeading = Array.from(headings).find(
        (h) => h.textContent?.includes("Pages")
      )
      expect(pagesHeading).toBeTruthy()
    })
  })

  // @clause CL-CMDPAL-003
  it("succeeds when Pages group renders exactly 7 navigation items", async () => {
    renderPalette(true)

    await waitFor(() => {
      const dialog = screen.getByRole("dialog")
      const headings = dialog.querySelectorAll("[cmdk-group-heading]")
      const pagesHeading = Array.from(headings).find(
        (h) => h.textContent?.includes("Pages")
      )
      expect(pagesHeading).toBeTruthy()

      const pagesGroup = pagesHeading!.closest("[cmdk-group]")
      expect(pagesGroup).toBeTruthy()

      const items = pagesGroup!.querySelectorAll("[cmdk-item]")
      expect(items.length).toBe(7)
    })
  })

  // @clause CL-CMDPAL-003
  it("succeeds when Pages group contains all expected navigation labels", async () => {
    renderPalette(true)

    const expectedLabels = [
      "Dashboard",
      "Runs",
      "Gates",
      "Workspaces",
      "Projects",
      "MCP",
      "Config",
    ]

    await waitFor(() => {
      const dialog = screen.getByRole("dialog")
      for (const label of expectedLabels) {
        const items = dialog.querySelectorAll("[cmdk-item]")
        const matchingItem = Array.from(items).find((item) =>
          item.textContent?.includes(label)
        )
        expect(matchingItem).toBeTruthy()
      }
    })
  })

  // @clause CL-CMDPAL-003
  it("fails when dialog is closed and Pages group is not in the DOM", () => {
    renderPalette(false)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})

// ===========================================================================
// CL-CMDPAL-004 — Actions group with at least 3 quick action items
// ===========================================================================
describe("CL-CMDPAL-004 — Actions group with quick action items", () => {
  // @clause CL-CMDPAL-004
  it("succeeds when Actions group heading is visible", async () => {
    renderPalette(true)

    await waitFor(() => {
      const dialog = screen.getByRole("dialog")
      const headings = dialog.querySelectorAll("[cmdk-group-heading]")
      const actionsHeading = Array.from(headings).find(
        (h) => h.textContent?.includes("Actions")
      )
      expect(actionsHeading).toBeTruthy()
    })
  })

  // @clause CL-CMDPAL-004
  it("succeeds when Actions group renders at least 3 items", async () => {
    renderPalette(true)

    await waitFor(() => {
      const dialog = screen.getByRole("dialog")
      const headings = dialog.querySelectorAll("[cmdk-group-heading]")
      const actionsHeading = Array.from(headings).find(
        (h) => h.textContent?.includes("Actions")
      )
      expect(actionsHeading).toBeTruthy()

      const actionsGroup = actionsHeading!.closest("[cmdk-group]")
      const items = actionsGroup!.querySelectorAll("[cmdk-item]")
      expect(items.length).toBeGreaterThanOrEqual(3)
    })
  })

  // @clause CL-CMDPAL-004
  it("succeeds when Actions group contains Nova Validação, Criar Projeto, Criar Workspace", async () => {
    renderPalette(true)

    const expectedActions = [
      "Nova Validação",
      "Criar Projeto",
      "Criar Workspace",
    ]

    await waitFor(() => {
      const dialog = screen.getByRole("dialog")
      const headings = dialog.querySelectorAll("[cmdk-group-heading]")
      const actionsHeading = Array.from(headings).find(
        (h) => h.textContent?.includes("Actions")
      )
      const actionsGroup = actionsHeading!.closest("[cmdk-group]")
      const items = actionsGroup!.querySelectorAll("[cmdk-item]")
      const itemTexts = Array.from(items).map((i) => i.textContent)

      for (const action of expectedActions) {
        const found = itemTexts.some((text) => text?.includes(action))
        expect(found).toBe(true)
      }
    })
  })

  // @clause CL-CMDPAL-004
  it("fails when dialog is not open and Actions group is absent", () => {
    renderPalette(false)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})

// ===========================================================================
// CL-CMDPAL-005 — Filters items by query
// ===========================================================================
describe("CL-CMDPAL-005 — Filters items by query", () => {
  // @clause CL-CMDPAL-005
  it("succeeds when typing 'Runs' keeps the Runs page item visible", async () => {
    const user = userEvent.setup()
    renderPalette(true)

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    })

    const dialog = screen.getByRole("dialog")
    const input = dialog.querySelector("[cmdk-input]") as HTMLInputElement
    expect(input).toBeInTheDocument()

    await user.type(input, "Runs")

    await waitFor(() => {
      const visibleItems = dialog.querySelectorAll(
        "[cmdk-item]:not([aria-hidden='true']):not([data-disabled='true'])"
      )
      const visibleTexts = Array.from(visibleItems).map((i) => i.textContent)
      const hasRuns = visibleTexts.some((t) => t?.includes("Runs"))
      expect(hasRuns).toBe(true)
    })
  })

  // @clause CL-CMDPAL-005
  it("succeeds when typing a query hides non-matching items", async () => {
    const user = userEvent.setup()
    renderPalette(true)

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    })

    const dialog = screen.getByRole("dialog")
    const input = dialog.querySelector("[cmdk-input]") as HTMLInputElement

    await user.type(input, "Dashboard")

    await waitFor(() => {
      // "Gates" should not be visible when searching for "Dashboard"
      const visibleItems = dialog.querySelectorAll(
        "[cmdk-item]:not([aria-hidden='true'])"
      )
      const visibleTexts = Array.from(visibleItems).map((i) => i.textContent)
      const hasGates = visibleTexts.some((t) => t?.includes("Gates") && !t?.includes("Dashboard"))
      expect(hasGates).toBe(false)
    })
  })

  // @clause CL-CMDPAL-005
  it("fails when input is empty and filtering is not applied — all items should remain", async () => {
    renderPalette(true)

    await waitFor(() => {
      const dialog = screen.getByRole("dialog")
      const allItems = dialog.querySelectorAll("[cmdk-item]")
      // With no query, Pages (7) + Actions (3) should be visible at minimum
      expect(allItems.length).toBeGreaterThanOrEqual(10)
    })
  })
})

// ===========================================================================
// CL-CMDPAL-006 — Selecting Page item navigates and closes dialog
// ===========================================================================
describe("CL-CMDPAL-006 — Selecting Page item navigates and closes", () => {
  // @clause CL-CMDPAL-006
  it("succeeds when selecting Runs item calls navigate with /runs", async () => {
    const user = userEvent.setup()
    renderPalette(true)

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    })

    const dialog = screen.getByRole("dialog")
    const items = dialog.querySelectorAll("[cmdk-item]")
    const runsItem = Array.from(items).find(
      (item) => item.textContent?.includes("Runs") && !item.textContent?.includes("Recent")
    )
    expect(runsItem).toBeTruthy()

    await user.click(runsItem!)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/runs")
    })
  })

  // @clause CL-CMDPAL-006
  it("succeeds when selecting Dashboard item calls navigate with /", async () => {
    const user = userEvent.setup()
    renderPalette(true)

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    })

    const dialog = screen.getByRole("dialog")
    const items = dialog.querySelectorAll("[cmdk-item]")
    const dashboardItem = Array.from(items).find(
      (item) => item.textContent?.includes("Dashboard")
    )
    expect(dashboardItem).toBeTruthy()

    await user.click(dashboardItem!)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/")
    })
  })

  // @clause CL-CMDPAL-006
  it("succeeds when selecting a page item causes dialog to close", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    renderPalette(true, onOpenChange)

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    })

    const dialog = screen.getByRole("dialog")
    const items = dialog.querySelectorAll("[cmdk-item]")
    const configItem = Array.from(items).find(
      (item) => item.textContent?.includes("Config")
    )
    expect(configItem).toBeTruthy()

    await user.click(configItem!)

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  // @clause CL-CMDPAL-006
  it("fails when navigate is not called if no item is selected", async () => {
    renderPalette(true)

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    })

    expect(mockNavigate).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// CL-CMDPAL-007 — Recent Runs group with run items
// ===========================================================================
describe("CL-CMDPAL-007 — Recent Runs group with run items", () => {
  // @clause CL-CMDPAL-007
  it("succeeds when Recent Runs group heading is visible after data loads", async () => {
    renderPalette(true)

    await waitFor(() => {
      const dialog = screen.getByRole("dialog")
      const headings = dialog.querySelectorAll("[cmdk-group-heading]")
      const runsHeading = Array.from(headings).find(
        (h) => h.textContent?.includes("Recent Runs")
      )
      expect(runsHeading).toBeTruthy()
    })
  })

  // @clause CL-CMDPAL-007
  it("succeeds when run items display outputId text", async () => {
    renderPalette(true)

    await waitFor(() => {
      const dialog = screen.getByRole("dialog")
      const headings = dialog.querySelectorAll("[cmdk-group-heading]")
      const runsHeading = Array.from(headings).find(
        (h) => h.textContent?.includes("Recent Runs")
      )
      expect(runsHeading).toBeTruthy()

      const runsGroup = runsHeading!.closest("[cmdk-group]")
      const items = runsGroup!.querySelectorAll("[cmdk-item]")
      expect(items.length).toBe(SEED_RUNS.length)

      const firstItemText = items[0].textContent
      expect(firstItemText).toContain(SEED_RUNS[0].outputId)
    })
  })

  // @clause CL-CMDPAL-007
  it("succeeds when run items show status badge (PASSED/FAILED/RUNNING)", async () => {
    renderPalette(true)

    await waitFor(() => {
      const dialog = screen.getByRole("dialog")
      const headings = dialog.querySelectorAll("[cmdk-group-heading]")
      const runsHeading = Array.from(headings).find(
        (h) => h.textContent?.includes("Recent Runs")
      )
      const runsGroup = runsHeading!.closest("[cmdk-group]")
      const items = runsGroup!.querySelectorAll("[cmdk-item]")

      // Check that at least one item contains a status text
      const allTexts = Array.from(items).map((i) => i.textContent)
      const hasStatusBadge = allTexts.some(
        (t) =>
          t?.includes("PASSED") ||
          t?.includes("FAILED") ||
          t?.includes("RUNNING")
      )
      expect(hasStatusBadge).toBe(true)
    })
  })

  // @clause CL-CMDPAL-007
  it("fails when api.runs.list rejects and Recent Runs group does not render", async () => {
    setupAPIMocks({ runsError: true })
    renderPalette(true)

    // Wait for other groups to load
    await waitFor(() => {
      const dialog = screen.getByRole("dialog")
      const headings = dialog.querySelectorAll("[cmdk-group-heading]")
      const pagesHeading = Array.from(headings).find(
        (h) => h.textContent?.includes("Pages")
      )
      expect(pagesHeading).toBeTruthy()
    })

    const dialog = screen.getByRole("dialog")
    const headings = dialog.querySelectorAll("[cmdk-group-heading]")
    const runsHeading = Array.from(headings).find(
      (h) => h.textContent?.includes("Recent Runs")
    )
    expect(runsHeading).toBeFalsy()
  })
})

// ===========================================================================
// CL-CMDPAL-008 — Selecting run item navigates to /runs/{id}/v2
// ===========================================================================
describe("CL-CMDPAL-008 — Selecting run item navigates to run details", () => {
  // @clause CL-CMDPAL-008
  it("succeeds when selecting first run navigates to /runs/run-1/v2", async () => {
    const user = userEvent.setup()
    renderPalette(true)

    await waitFor(() => {
      const dialog = screen.getByRole("dialog")
      const headings = dialog.querySelectorAll("[cmdk-group-heading]")
      const runsHeading = Array.from(headings).find(
        (h) => h.textContent?.includes("Recent Runs")
      )
      expect(runsHeading).toBeTruthy()
    })

    const dialog = screen.getByRole("dialog")
    const headings = dialog.querySelectorAll("[cmdk-group-heading]")
    const runsHeading = Array.from(headings).find(
      (h) => h.textContent?.includes("Recent Runs")
    )
    const runsGroup = runsHeading!.closest("[cmdk-group]")
    const runItems = runsGroup!.querySelectorAll("[cmdk-item]")

    await user.click(runItems[0])

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/runs/run-1/v2")
    })
  })

  // @clause CL-CMDPAL-008
  it("succeeds when selecting second run navigates to /runs/run-2/v2", async () => {
    const user = userEvent.setup()
    renderPalette(true)

    await waitFor(() => {
      const dialog = screen.getByRole("dialog")
      const headings = dialog.querySelectorAll("[cmdk-group-heading]")
      const runsHeading = Array.from(headings).find(
        (h) => h.textContent?.includes("Recent Runs")
      )
      expect(runsHeading).toBeTruthy()
    })

    const dialog = screen.getByRole("dialog")
    const headings = dialog.querySelectorAll("[cmdk-group-heading]")
    const runsHeading = Array.from(headings).find(
      (h) => h.textContent?.includes("Recent Runs")
    )
    const runsGroup = runsHeading!.closest("[cmdk-group]")
    const runItems = runsGroup!.querySelectorAll("[cmdk-item]")

    await user.click(runItems[1])

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/runs/run-2/v2")
    })
  })

  // @clause CL-CMDPAL-008
  it("succeeds when selecting a run also closes the dialog", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    renderPalette(true, onOpenChange)

    await waitFor(() => {
      const dialog = screen.getByRole("dialog")
      const headings = dialog.querySelectorAll("[cmdk-group-heading]")
      const runsHeading = Array.from(headings).find(
        (h) => h.textContent?.includes("Recent Runs")
      )
      expect(runsHeading).toBeTruthy()
    })

    const dialog = screen.getByRole("dialog")
    const headings = dialog.querySelectorAll("[cmdk-group-heading]")
    const runsHeading = Array.from(headings).find(
      (h) => h.textContent?.includes("Recent Runs")
    )
    const runsGroup = runsHeading!.closest("[cmdk-group]")
    const runItems = runsGroup!.querySelectorAll("[cmdk-item]")

    await user.click(runItems[0])

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })
})

// ===========================================================================
// CL-CMDPAL-009 — Projects group renders project names
// ===========================================================================
describe("CL-CMDPAL-009 — Projects group renders project names", () => {
  // @clause CL-CMDPAL-009
  it("succeeds when Projects group heading is visible", async () => {
    renderPalette(true)

    await waitFor(() => {
      const dialog = screen.getByRole("dialog")
      const headings = dialog.querySelectorAll("[cmdk-group-heading]")
      const projHeading = Array.from(headings).find(
        (h) => h.textContent?.includes("Projects")
      )
      expect(projHeading).toBeTruthy()
    })
  })

  // @clause CL-CMDPAL-009
  it("succeeds when project items display project name", async () => {
    renderPalette(true)

    await waitFor(() => {
      const dialog = screen.getByRole("dialog")
      const headings = dialog.querySelectorAll("[cmdk-group-heading]")
      const projHeading = Array.from(headings).find(
        (h) => h.textContent?.includes("Projects")
      )
      expect(projHeading).toBeTruthy()

      const projGroup = projHeading!.closest("[cmdk-group]")
      const items = projGroup!.querySelectorAll("[cmdk-item]")
      expect(items.length).toBe(SEED_PROJECTS.length)

      const itemTexts = Array.from(items).map((i) => i.textContent)
      expect(itemTexts.some((t) => t?.includes("gatekeeper"))).toBe(true)
      expect(itemTexts.some((t) => t?.includes("uild-engine"))).toBe(true)
    })
  })

  // @clause CL-CMDPAL-009
  it("succeeds when selecting a project navigates to /projects/{id}", async () => {
    const user = userEvent.setup()
    renderPalette(true)

    await waitFor(() => {
      const dialog = screen.getByRole("dialog")
      const headings = dialog.querySelectorAll("[cmdk-group-heading]")
      const projHeading = Array.from(headings).find(
        (h) => h.textContent?.includes("Projects")
      )
      expect(projHeading).toBeTruthy()
    })

    const dialog = screen.getByRole("dialog")
    const headings = dialog.querySelectorAll("[cmdk-group-heading]")
    const projHeading = Array.from(headings).find(
      (h) => h.textContent?.includes("Projects")
    )
    const projGroup = projHeading!.closest("[cmdk-group]")
    const items = projGroup!.querySelectorAll("[cmdk-item]")

    await user.click(items[0])

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/projects/proj-1")
    })
  })

  // @clause CL-CMDPAL-009
  it("fails when api.projects.list rejects and Projects group does not render", async () => {
    setupAPIMocks({ projectsError: true })
    renderPalette(true)

    await waitFor(() => {
      const dialog = screen.getByRole("dialog")
      const headings = dialog.querySelectorAll("[cmdk-group-heading]")
      const pagesHeading = Array.from(headings).find(
        (h) => h.textContent?.includes("Pages")
      )
      expect(pagesHeading).toBeTruthy()
    })

    const dialog = screen.getByRole("dialog")
    const headings = dialog.querySelectorAll("[cmdk-group-heading]")
    const projHeading = Array.from(headings).find(
      (h) => h.textContent?.includes("Projects")
    )
    expect(projHeading).toBeFalsy()
  })
})

// ===========================================================================
// CL-CMDPAL-010 — Workspaces group renders workspace names
// ===========================================================================
describe("CL-CMDPAL-010 — Workspaces group renders workspace names", () => {
  // @clause CL-CMDPAL-010
  it("succeeds when Workspaces group heading is visible", async () => {
    renderPalette(true)

    await waitFor(() => {
      const dialog = screen.getByRole("dialog")
      const headings = dialog.querySelectorAll("[cmdk-group-heading]")
      const wsHeading = Array.from(headings).find(
        (h) => h.textContent?.includes("Workspaces")
      )
      expect(wsHeading).toBeTruthy()
    })
  })

  // @clause CL-CMDPAL-010
  it("succeeds when workspace items display workspace name", async () => {
    renderPalette(true)

    await waitFor(() => {
      const dialog = screen.getByRole("dialog")
      const headings = dialog.querySelectorAll("[cmdk-group-heading]")
      const wsHeading = Array.from(headings).find(
        (h) => h.textContent?.includes("Workspaces")
      )
      expect(wsHeading).toBeTruthy()

      const wsGroup = wsHeading!.closest("[cmdk-group]")
      const items = wsGroup!.querySelectorAll("[cmdk-item]")
      expect(items.length).toBe(SEED_WORKSPACES.length)

      const itemTexts = Array.from(items).map((i) => i.textContent)
      expect(itemTexts.some((t) => t?.includes("Acme Corp"))).toBe(true)
      expect(itemTexts.some((t) => t?.includes("Labs"))).toBe(true)
    })
  })

  // @clause CL-CMDPAL-010
  it("succeeds when selecting a workspace navigates to /workspaces/{id}", async () => {
    const user = userEvent.setup()
    renderPalette(true)

    await waitFor(() => {
      const dialog = screen.getByRole("dialog")
      const headings = dialog.querySelectorAll("[cmdk-group-heading]")
      const wsHeading = Array.from(headings).find(
        (h) => h.textContent?.includes("Workspaces")
      )
      expect(wsHeading).toBeTruthy()
    })

    const dialog = screen.getByRole("dialog")
    const headings = dialog.querySelectorAll("[cmdk-group-heading]")
    const wsHeading = Array.from(headings).find(
      (h) => h.textContent?.includes("Workspaces")
    )
    const wsGroup = wsHeading!.closest("[cmdk-group]")
    const items = wsGroup!.querySelectorAll("[cmdk-item]")

    await user.click(items[0])

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/workspaces/ws-1")
    })
  })

  // @clause CL-CMDPAL-010
  it("fails when api.workspaces.list rejects and Workspaces group is absent", async () => {
    setupAPIMocks({ workspacesError: true })
    renderPalette(true)

    await waitFor(() => {
      const dialog = screen.getByRole("dialog")
      const headings = dialog.querySelectorAll("[cmdk-group-heading]")
      const pagesHeading = Array.from(headings).find(
        (h) => h.textContent?.includes("Pages")
      )
      expect(pagesHeading).toBeTruthy()
    })

    const dialog = screen.getByRole("dialog")
    const headings = dialog.querySelectorAll("[cmdk-group-heading]")
    const wsHeading = Array.from(headings).find(
      (h) => h.textContent?.includes("Workspaces")
    )
    expect(wsHeading).toBeFalsy()
  })
})

// ===========================================================================
// CL-CMDPAL-011 — Validators group renders code and name
// ===========================================================================
describe("CL-CMDPAL-011 — Validators group renders code and name", () => {
  // @clause CL-CMDPAL-011
  it("succeeds when Validators group heading is visible", async () => {
    renderPalette(true)

    await waitFor(() => {
      const dialog = screen.getByRole("dialog")
      const headings = dialog.querySelectorAll("[cmdk-group-heading]")
      const valHeading = Array.from(headings).find(
        (h) => h.textContent?.includes("Validators")
      )
      expect(valHeading).toBeTruthy()
    })
  })

  // @clause CL-CMDPAL-011
  it("succeeds when validator items display key (code) and description (name)", async () => {
    renderPalette(true)

    await waitFor(() => {
      const dialog = screen.getByRole("dialog")
      const headings = dialog.querySelectorAll("[cmdk-group-heading]")
      const valHeading = Array.from(headings).find(
        (h) => h.textContent?.includes("Validators")
      )
      expect(valHeading).toBeTruthy()

      const valGroup = valHeading!.closest("[cmdk-group]")
      const items = valGroup!.querySelectorAll("[cmdk-item]")
      expect(items.length).toBe(SEED_VALIDATORS.length)

      // Check first validator shows both key and description
      const firstText = items[0].textContent
      expect(firstText).toContain("MANIFEST_FILES")
      expect(firstText).toContain("Validates manifest files exist")
    })
  })

  // @clause CL-CMDPAL-011
  it("succeeds when selecting a validator navigates to /gates", async () => {
    const user = userEvent.setup()
    renderPalette(true)

    await waitFor(() => {
      const dialog = screen.getByRole("dialog")
      const headings = dialog.querySelectorAll("[cmdk-group-heading]")
      const valHeading = Array.from(headings).find(
        (h) => h.textContent?.includes("Validators")
      )
      expect(valHeading).toBeTruthy()
    })

    const dialog = screen.getByRole("dialog")
    const headings = dialog.querySelectorAll("[cmdk-group-heading]")
    const valHeading = Array.from(headings).find(
      (h) => h.textContent?.includes("Validators")
    )
    const valGroup = valHeading!.closest("[cmdk-group]")
    const items = valGroup!.querySelectorAll("[cmdk-item]")

    await user.click(items[0])

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/gates")
    })
  })

  // @clause CL-CMDPAL-011
  it("fails when api.validators.list rejects and Validators group is absent", async () => {
    setupAPIMocks({ validatorsError: true })
    renderPalette(true)

    await waitFor(() => {
      const dialog = screen.getByRole("dialog")
      const headings = dialog.querySelectorAll("[cmdk-group-heading]")
      const pagesHeading = Array.from(headings).find(
        (h) => h.textContent?.includes("Pages")
      )
      expect(pagesHeading).toBeTruthy()
    })

    const dialog = screen.getByRole("dialog")
    const headings = dialog.querySelectorAll("[cmdk-group-heading]")
    const valHeading = Array.from(headings).find(
      (h) => h.textContent?.includes("Validators")
    )
    expect(valHeading).toBeFalsy()
  })
})

// ===========================================================================
// CL-CMDPAL-012 — Header search input opens CommandPalette
// ===========================================================================
describe("CL-CMDPAL-012 — Header search input opens CommandPalette", () => {
  // @clause CL-CMDPAL-012
  it("succeeds when clicking the header search trigger opens the dialog", async () => {
    const user = userEvent.setup()
    render(<TestHarness />)

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    const trigger = screen.getByTestId("command-palette-trigger")
    await user.click(trigger)

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    })
  })

  // @clause CL-CMDPAL-012
  it("succeeds when focusing the header search input opens the dialog", async () => {
    const user = userEvent.setup()
    render(<TestHarness />)

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    const input = screen.getByPlaceholderText("Buscar...")
    await user.click(input)

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    })
  })

  // @clause CL-CMDPAL-012
  it("fails when header trigger is not clicked and dialog remains closed", () => {
    render(<TestHarness />)

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})

// ===========================================================================
// CL-CMDPAL-013 — Empty state when no results match
// ===========================================================================
describe("CL-CMDPAL-013 — Empty state when no results match", () => {
  // @clause CL-CMDPAL-013
  it("succeeds when typing non-matching query shows empty state message", async () => {
    const user = userEvent.setup()
    renderPalette(true)

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    })

    const dialog = screen.getByRole("dialog")
    const input = dialog.querySelector("[cmdk-input]") as HTMLInputElement

    await user.type(input, "xyznonexistent123abcdef")

    await waitFor(() => {
      const emptyEl = dialog.querySelector("[cmdk-empty]")
      expect(emptyEl).toBeInTheDocument()
      expect(emptyEl!.textContent).toContain("Nenhum resultado encontrado")
    })
  })

  // @clause CL-CMDPAL-013
  it("succeeds when empty state element has the cmdk-empty attribute", async () => {
    const user = userEvent.setup()
    renderPalette(true)

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    })

    const dialog = screen.getByRole("dialog")
    const input = dialog.querySelector("[cmdk-input]") as HTMLInputElement

    await user.type(input, "zzzznoitemmatches999")

    await waitFor(() => {
      const emptyEl = dialog.querySelector("[cmdk-empty]")
      expect(emptyEl).not.toBeNull()
      expect(emptyEl!.textContent!.length).toBeGreaterThan(0)
    })
  })

  // @clause CL-CMDPAL-013
  it("fails when query matches items and empty state is not shown", async () => {
    const user = userEvent.setup()
    renderPalette(true)

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    })

    const dialog = screen.getByRole("dialog")
    const input = dialog.querySelector("[cmdk-input]") as HTMLInputElement

    await user.type(input, "Dashboard")

    await waitFor(() => {
      const emptyEl = dialog.querySelector("[cmdk-empty]")
      // When items match, cmdk-empty should either not exist or be hidden
      if (emptyEl) {
        // cmdk hides the empty element when items match
        expect(emptyEl).not.toBeVisible()
      } else {
        expect(emptyEl).toBeNull()
      }
    })
  })
})

// ===========================================================================
// CL-CMDPAL-014 — Loading: static groups visible immediately
// ===========================================================================
describe("CL-CMDPAL-014 — Loading state: static groups visible immediately", () => {
  // @clause CL-CMDPAL-014
  it("succeeds when Pages group is visible before API calls resolve", async () => {
    // Make APIs hang (never resolve)
    mockedApi.runs.list.mockReturnValue(new Promise(() => {}))
    mockedApi.projects.list.mockReturnValue(new Promise(() => {}))
    mockedApi.workspaces.list.mockReturnValue(new Promise(() => {}))
    mockedApi.validators.list.mockReturnValue(new Promise(() => {}))

    renderPalette(true)

    // Pages should appear immediately (static, no API needed)
    await waitFor(() => {
      const dialog = screen.getByRole("dialog")
      const headings = dialog.querySelectorAll("[cmdk-group-heading]")
      const pagesHeading = Array.from(headings).find(
        (h) => h.textContent?.includes("Pages")
      )
      expect(pagesHeading).toBeTruthy()
    })
  })

  // @clause CL-CMDPAL-014
  it("succeeds when Actions group is visible before API calls resolve", async () => {
    mockedApi.runs.list.mockReturnValue(new Promise(() => {}))
    mockedApi.projects.list.mockReturnValue(new Promise(() => {}))
    mockedApi.workspaces.list.mockReturnValue(new Promise(() => {}))
    mockedApi.validators.list.mockReturnValue(new Promise(() => {}))

    renderPalette(true)

    await waitFor(() => {
      const dialog = screen.getByRole("dialog")
      const headings = dialog.querySelectorAll("[cmdk-group-heading]")
      const actionsHeading = Array.from(headings).find(
        (h) => h.textContent?.includes("Actions")
      )
      expect(actionsHeading).toBeTruthy()
    })
  })

  // @clause CL-CMDPAL-014
  it("succeeds when dynamic groups appear only after APIs resolve", async () => {
    let resolveRuns!: (v: PaginatedResponse<Run>) => void
    mockedApi.runs.list.mockReturnValue(
      new Promise((r) => { resolveRuns = r })
    )
    mockedApi.projects.list.mockResolvedValue(paginated(SEED_PROJECTS))
    mockedApi.workspaces.list.mockResolvedValue(paginated(SEED_WORKSPACES))
    mockedApi.validators.list.mockResolvedValue(SEED_VALIDATORS)

    renderPalette(true)

    // Initially no Recent Runs
    const dialog = screen.getByRole("dialog")
    await waitFor(() => {
      const headings = dialog.querySelectorAll("[cmdk-group-heading]")
      const pagesHeading = Array.from(headings).find(
        (h) => h.textContent?.includes("Pages")
      )
      expect(pagesHeading).toBeTruthy()
    })

    // Resolve runs API
    await act(async () => {
      resolveRuns(paginated(SEED_RUNS))
    })

    await waitFor(() => {
      const headings = dialog.querySelectorAll("[cmdk-group-heading]")
      const runsHeading = Array.from(headings).find(
        (h) => h.textContent?.includes("Recent Runs")
      )
      expect(runsHeading).toBeTruthy()
    })
  })

  // @clause CL-CMDPAL-014
  it("fails when all APIs reject — static groups still render without crash", async () => {
    setupAPIMocks({
      runsError: true,
      projectsError: true,
      workspacesError: true,
      validatorsError: true,
    })

    renderPalette(true)

    await waitFor(() => {
      const dialog = screen.getByRole("dialog")
      const headings = dialog.querySelectorAll("[cmdk-group-heading]")
      const pagesHeading = Array.from(headings).find(
        (h) => h.textContent?.includes("Pages")
      )
      const actionsHeading = Array.from(headings).find(
        (h) => h.textContent?.includes("Actions")
      )
      expect(pagesHeading).toBeTruthy()
      expect(actionsHeading).toBeTruthy()
    })

    // Verify no dynamic groups
    const dialog = screen.getByRole("dialog")
    const headings = dialog.querySelectorAll("[cmdk-group-heading]")
    const headingTexts = Array.from(headings).map((h) => h.textContent)
    expect(headingTexts.some((t) => t?.includes("Recent Runs"))).toBe(false)
    expect(headingTexts.some((t) => t?.includes("Projects"))).toBe(false)
    expect(headingTexts.some((t) => t?.includes("Workspaces"))).toBe(false)
    expect(headingTexts.some((t) => t?.includes("Validators"))).toBe(false)
  })
})
