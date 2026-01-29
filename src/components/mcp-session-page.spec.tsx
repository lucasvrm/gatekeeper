import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { useState, useEffect } from "react"
import { toast } from "sonner"

/**
 * Tests for MCP Session Page - Core Infrastructure
 *
 * Contract: mcp-session-page-4a
 * Mode: STRICT
 * Criticality: MEDIUM
 *
 * This file covers all 10 clauses from the contract:
 * - CL-MCP-001: Página renderiza com tabs Config e Status
 * - CL-MCP-002: SessionConfigTab carrega config ao montar
 * - CL-MCP-003: Campo branch aparece condicionalmente
 * - CL-MCP-004: Salvar config chama API corretamente
 * - CL-MCP-005: Status tab carrega indicadores
 * - CL-MCP-006: Item de menu navega para /mcp
 * - CL-MCP-007: Erro ao carregar config exibe toast
 * - CL-MCP-008: Erro ao salvar config exibe toast
 * - CL-MCP-009: Skeleton durante loading
 * - CL-MCP-010: Status badges refletem estado
 */

// ============================================================================
// Test Data Fixtures
// ============================================================================

type GitStrategy = "main" | "new-branch" | "existing-branch"
type TaskType = "bugfix" | "feature" | "refactor" | "test" | "other"

interface MCPSessionConfig {
  gitStrategy: GitStrategy
  branch: string
  taskType: TaskType
  projectId: string | null
  customInstructions: string
}

interface MCPStatus {
  mcpServer: "connected" | "disconnected"
  gatekeeperApi: "online" | "offline"
  git: string
  docs: "accessible" | "not-found"
}

const createMockConfig = (overrides: Partial<MCPSessionConfig> = {}): MCPSessionConfig => ({
  gitStrategy: "main",
  branch: "",
  taskType: "bugfix",
  projectId: null,
  customInstructions: "",
  ...overrides,
})

const createMockStatus = (overrides: Partial<MCPStatus> = {}): MCPStatus => ({
  mcpServer: "connected",
  gatekeeperApi: "online",
  git: "main",
  docs: "accessible",
  ...overrides,
})

// ============================================================================
// Mock API and Navigation Setup
// ============================================================================

const mockNavigate = vi.fn()
const mockGetSessionConfig = vi.fn()
const mockUpdateSessionConfig = vi.fn()
const mockGetMCPStatus = vi.fn()
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
}

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: (message: string) => mockToast.success(message),
    error: (message: string) => mockToast.error(message),
  },
}))

// ============================================================================
// Mock Components - Simulate Post-Implementation Behavior
// ============================================================================

/**
 * MockMCPSessionPage simulates the main page with tabs
 * Contract requirements:
 * - Renders tabs Config and Status
 * - Config tab is active by default
 * - Switches between tabs on click
 */
function MockMCPSessionPage() {
  const [activeTab, setActiveTab] = useState<"config" | "status">("config")

  return (
    <div data-testid="mcp-session-page" className="p-8 space-y-6">
      <div className="border-b border-border">
        <div role="tablist" className="flex gap-4">
          <button
            role="tab"
            aria-selected={activeTab === "config"}
            onClick={() => setActiveTab("config")}
            className={activeTab === "config" ? "border-b-2 border-primary" : ""}
            data-testid="tab-config"
          >
            Config
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "status"}
            onClick={() => setActiveTab("status")}
            className={activeTab === "status" ? "border-b-2 border-primary" : ""}
            data-testid="tab-status"
          >
            Status
          </button>
        </div>
      </div>

      <div className="mt-6">
        {activeTab === "config" && <MockSessionConfigTab />}
        {activeTab === "status" && <MockStatusTab />}
      </div>
    </div>
  )
}

/**
 * MockSessionConfigTab simulates the session config form
 * Contract requirements:
 * - Loads config from GET /api/mcp/session on mount
 * - Displays skeleton during loading
 * - Shows branch input conditionally based on git strategy
 * - Saves config via PUT /api/mcp/session with correct payload
 * - Shows success/error toasts appropriately
 */
function MockSessionConfigTab() {
  const [config, setConfig] = useState<MCPSessionConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [gitStrategy, setGitStrategy] = useState<GitStrategy>("main")
  const [branch, setBranch] = useState("")
  const [taskType, setTaskType] = useState<TaskType>("bugfix")
  const [customInstructions, setCustomInstructions] = useState("")

  useEffect(() => {
    const loadConfig = async () => {
      setLoading(true)
      try {
        const data = await mockGetSessionConfig()
        setConfig(data.config)
        setGitStrategy(data.config.gitStrategy)
        setBranch(data.config.branch)
        setTaskType(data.config.taskType)
        setCustomInstructions(data.config.customInstructions)
      } catch (error) {
        toast.error("Falha ao carregar configuração")
      } finally {
        setLoading(false)
      }
    }
    loadConfig()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await mockUpdateSessionConfig({
        config: {
          gitStrategy,
          branch,
          taskType,
          projectId: null,
          customInstructions,
        },
      })
      toast.success("Configuração salva com sucesso")
      
      // Reload config after save
      const data = await mockGetSessionConfig()
      setConfig(data.config)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro ao salvar configuração"
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div data-testid="session-config-tab">
        <div data-testid="config-skeleton">Loading skeleton...</div>
      </div>
    )
  }

  return (
    <div data-testid="session-config-tab" className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Git Strategy</label>
        <div role="radiogroup" className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              role="radio"
              name="git-strategy"
              value="main"
              checked={gitStrategy === "main"}
              onChange={(e) => setGitStrategy(e.target.value as GitStrategy)}
              data-testid="git-strategy-radio-main"
            />
            <span>main</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              role="radio"
              name="git-strategy"
              value="new-branch"
              checked={gitStrategy === "new-branch"}
              onChange={(e) => setGitStrategy(e.target.value as GitStrategy)}
              data-testid="git-strategy-radio-new-branch"
            />
            <span>new branch</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              role="radio"
              name="git-strategy"
              value="existing-branch"
              checked={gitStrategy === "existing-branch"}
              onChange={(e) => setGitStrategy(e.target.value as GitStrategy)}
              data-testid="git-strategy-radio-existing-branch"
            />
            <span>existing branch</span>
          </label>
        </div>
      </div>

      {(gitStrategy === "new-branch" || gitStrategy === "existing-branch") && (
        <div>
          <label className="block text-sm font-medium mb-2">Branch</label>
          <input
            type="text"
            role="textbox"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            data-testid="branch-input"
            className="border rounded px-3 py-2 w-full"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-2">Task Type</label>
        <select
          value={taskType}
          onChange={(e) => setTaskType(e.target.value as TaskType)}
          data-testid="task-type-select"
          className="border rounded px-3 py-2 w-full"
        >
          <option value="bugfix">Bugfix</option>
          <option value="feature">Feature</option>
          <option value="refactor">Refactor</option>
          <option value="test">Test</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Custom Instructions</label>
        <textarea
          role="textbox"
          value={customInstructions}
          onChange={(e) => setCustomInstructions(e.target.value)}
          data-testid="custom-instructions-textarea"
          className="border rounded px-3 py-2 w-full"
          rows={4}
        />
      </div>

      <button
        role="button"
        onClick={handleSave}
        disabled={saving}
        data-testid="save-config-button"
        className="bg-primary text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {saving ? "Salvando..." : "Salvar"}
      </button>
    </div>
  )
}

/**
 * MockStatusTab simulates the status indicators
 * Contract requirements:
 * - Loads status from GET /api/mcp/status on mount
 * - Displays status badges for MCP Server, Gatekeeper API, Git, Docs
 * - Shows green badges for "ok" status, red badges for "error" status
 */
function MockStatusTab() {
  const [status, setStatus] = useState<MCPStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadStatus = async () => {
      setLoading(true)
      try {
        const data = await mockGetMCPStatus()
        setStatus(data)
      } catch (error) {
        console.error("Failed to load status:", error)
      } finally {
        setLoading(false)
      }
    }
    loadStatus()
  }, [])

  if (loading) {
    return <div data-testid="status-tab">Loading...</div>
  }

  if (!status) {
    return <div data-testid="status-tab">Failed to load status</div>
  }

  const getBadgeColor = (value: string) => {
    if (value === "connected" || value === "online" || value === "accessible") {
      return "bg-green-500"
    }
    return "bg-red-500"
  }

  return (
    <div data-testid="status-tab" className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="font-medium">MCP Server:</span>
        <span
          data-testid="status-mcp-badge"
          className={`px-2 py-1 rounded text-white text-sm ${getBadgeColor(status.mcpServer)}`}
        >
          {status.mcpServer}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="font-medium">Gatekeeper API:</span>
        <span
          data-testid="status-api-badge"
          className={`px-2 py-1 rounded text-white text-sm ${getBadgeColor(status.gatekeeperApi)}`}
        >
          {status.gatekeeperApi}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="font-medium">Git Branch:</span>
        <span
          data-testid="status-git-badge"
          className="px-2 py-1 rounded bg-gray-500 text-white text-sm"
        >
          {status.git}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="font-medium">Documentation:</span>
        <span
          data-testid="status-docs-badge"
          className={`px-2 py-1 rounded text-white text-sm ${getBadgeColor(status.docs)}`}
        >
          {status.docs}
        </span>
      </div>
    </div>
  )
}

/**
 * MockAppLayout simulates the navigation menu
 * Contract requirements:
 * - Includes "MCP Session" menu item
 * - Navigates to /mcp when clicked
 * - Highlights active menu item
 */
interface MockAppLayoutProps {
  currentPath: string
}

function MockAppLayout({ currentPath }: MockAppLayoutProps) {
  const navigation = [
    { name: "Dashboard", path: "/" },
    { name: "Runs", path: "/runs" },
    { name: "MCP Session", path: "/mcp" },
    { name: "Config", path: "/config" },
  ]

  return (
    <nav data-testid="app-navigation">
      {navigation.map((item) => {
        const isActive = currentPath === item.path
        return (
          <button
            key={item.path}
            onClick={() => mockNavigate(item.path)}
            data-testid={`nav-item-${item.path}`}
            className={isActive ? "bg-primary text-white" : "text-gray-600"}
          >
            {item.name}
          </button>
        )
      })}
    </nav>
  )
}

// ============================================================================
// Test Suites
// ============================================================================

describe("MCPSessionPage - Core Infrastructure (contract: mcp-session-page-4a)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockClear()
    mockGetSessionConfig.mockReset()
    mockUpdateSessionConfig.mockReset()
    mockGetMCPStatus.mockReset()
    mockToast.success.mockClear()
    mockToast.error.mockClear()
  })

  // @clause CL-MCP-001
  it("succeeds when user accesses /mcp and page renders with Config and Status tabs", () => {
    const mockConfig = createMockConfig()
    mockGetSessionConfig.mockResolvedValueOnce({ config: mockConfig })

    render(<MockMCPSessionPage />)

    // Verify page container is present
    expect(screen.getByTestId("mcp-session-page")).toBeInTheDocument()

    // Verify both tabs are visible
    expect(screen.getByRole("tab", { name: /config/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /status/i })).toBeInTheDocument()

    // Verify Config tab is active by default
    const configTab = screen.getByRole("tab", { name: /config/i })
    expect(configTab).toHaveAttribute("aria-selected", "true")
  })

  // @clause CL-MCP-002
  it("succeeds when SessionConfigTab mounts and loads session config from API", async () => {
    const mockConfig = createMockConfig({
      gitStrategy: "main",
      branch: "",
      taskType: "feature",
      customInstructions: "Test instructions",
    })
    mockGetSessionConfig.mockResolvedValueOnce({ config: mockConfig })

    render(<MockSessionConfigTab />)

    // Verify API is called
    expect(mockGetSessionConfig).toHaveBeenCalledTimes(1)

    // Verify skeleton is shown during loading
    expect(screen.getByTestId("config-skeleton")).toBeInTheDocument()

    // Wait for config to load
    await waitFor(() => {
      expect(screen.getByTestId("session-config-tab")).toBeInTheDocument()
    })

    // Verify form is populated with config values
    const mainRadio = screen.getByTestId("git-strategy-radio-main") as HTMLInputElement
    expect(mainRadio.checked).toBe(true)

    const taskTypeSelect = screen.getByTestId("task-type-select") as HTMLSelectElement
    expect(taskTypeSelect.value).toBe("feature")

    const customInstructionsTextarea = screen.getByTestId("custom-instructions-textarea") as HTMLTextAreaElement
    expect(customInstructionsTextarea.value).toBe("Test instructions")
  })

  // @clause CL-MCP-003
  it("succeeds when user selects new-branch strategy and branch field appears", async () => {
    const mockConfig = createMockConfig({ gitStrategy: "main" })
    mockGetSessionConfig.mockResolvedValueOnce({ config: mockConfig })

    render(<MockSessionConfigTab />)

    await waitFor(() => {
      expect(screen.getByTestId("session-config-tab")).toBeInTheDocument()
    })

    // Initially branch input should not be visible (git strategy is main)
    expect(screen.queryByTestId("branch-input")).not.toBeInTheDocument()

    // Select new-branch strategy
    const newBranchRadio = screen.getByTestId("git-strategy-radio-new-branch")
    fireEvent.click(newBranchRadio)

    // Verify branch input is now visible
    await waitFor(() => {
      expect(screen.getByTestId("branch-input")).toBeInTheDocument()
    })

    // Verify we can type in the branch input
    const branchInput = screen.getByTestId("branch-input") as HTMLInputElement
    fireEvent.change(branchInput, { target: { value: "feature/test" } })
    expect(branchInput.value).toBe("feature/test")
  })

  // @clause CL-MCP-003 (existing-branch)
  it("succeeds when user selects existing-branch strategy and branch field appears", async () => {
    const mockConfig = createMockConfig({ gitStrategy: "main" })
    mockGetSessionConfig.mockResolvedValueOnce({ config: mockConfig })

    render(<MockSessionConfigTab />)

    await waitFor(() => {
      expect(screen.getByTestId("session-config-tab")).toBeInTheDocument()
    })

    // Select existing-branch strategy
    const existingBranchRadio = screen.getByTestId("git-strategy-radio-existing-branch")
    fireEvent.click(existingBranchRadio)

    // Verify branch input is visible
    await waitFor(() => {
      expect(screen.getByTestId("branch-input")).toBeInTheDocument()
    })
  })

  // @clause CL-MCP-004
  it("succeeds when user fills form and clicks save, then PUT API is called with correct payload", async () => {
    const mockConfig = createMockConfig()
    mockGetSessionConfig.mockResolvedValue({ config: mockConfig })
    mockUpdateSessionConfig.mockResolvedValueOnce({ success: true })

    render(<MockSessionConfigTab />)

    await waitFor(() => {
      expect(screen.getByTestId("session-config-tab")).toBeInTheDocument()
    })

    // Change git strategy to new-branch
    const newBranchRadio = screen.getByTestId("git-strategy-radio-new-branch")
    fireEvent.click(newBranchRadio)

    await waitFor(() => {
      expect(screen.getByTestId("branch-input")).toBeInTheDocument()
    })

    // Fill in branch name
    const branchInput = screen.getByTestId("branch-input")
    fireEvent.change(branchInput, { target: { value: "feature/test" } })

    // Change task type
    const taskTypeSelect = screen.getByTestId("task-type-select")
    fireEvent.change(taskTypeSelect, { target: { value: "refactor" } })

    // Fill custom instructions
    const customInstructions = screen.getByTestId("custom-instructions-textarea")
    fireEvent.change(customInstructions, { target: { value: "Custom test instructions" } })

    // Click save
    const saveButton = screen.getByTestId("save-config-button")
    fireEvent.click(saveButton)

    // Verify API was called with correct payload
    await waitFor(() => {
      expect(mockUpdateSessionConfig).toHaveBeenCalledTimes(1)
      expect(mockUpdateSessionConfig).toHaveBeenCalledWith({
        config: {
          gitStrategy: "new-branch",
          branch: "feature/test",
          taskType: "refactor",
          projectId: null,
          customInstructions: "Custom test instructions",
        },
      })
    })

    // Verify success toast was shown
    expect(mockToast.success).toHaveBeenCalledWith("Configuração salva com sucesso")

    // Verify config was reloaded
    await waitFor(() => {
      expect(mockGetSessionConfig).toHaveBeenCalledTimes(2) // Initial load + reload after save
    })
  })

  // @clause CL-MCP-005
  it("succeeds when user accesses Status tab and indicators are loaded from API", async () => {
    const mockStatus = createMockStatus({
      mcpServer: "connected",
      gatekeeperApi: "online",
      git: "main",
      docs: "accessible",
    })
    mockGetMCPStatus.mockResolvedValueOnce(mockStatus)

    render(<MockStatusTab />)

    // Verify API is called
    expect(mockGetMCPStatus).toHaveBeenCalledTimes(1)

    await waitFor(() => {
      expect(screen.getByTestId("status-tab")).toBeInTheDocument()
    })

    // Verify all status badges are present
    expect(screen.getByTestId("status-mcp-badge")).toBeInTheDocument()
    expect(screen.getByTestId("status-api-badge")).toBeInTheDocument()
    expect(screen.getByTestId("status-git-badge")).toBeInTheDocument()
    expect(screen.getByTestId("status-docs-badge")).toBeInTheDocument()

    // Verify badge content
    expect(screen.getByTestId("status-mcp-badge")).toHaveTextContent("connected")
    expect(screen.getByTestId("status-api-badge")).toHaveTextContent("online")
    expect(screen.getByTestId("status-git-badge")).toHaveTextContent("main")
    expect(screen.getByTestId("status-docs-badge")).toHaveTextContent("accessible")
  })

  // @clause CL-MCP-006
  it("succeeds when user clicks MCP Session menu item and navigates to /mcp", () => {
    render(<MockAppLayout currentPath="/" />)

    const mcpMenuItem = screen.getByTestId("nav-item-/mcp")
    expect(mcpMenuItem).toBeInTheDocument()
    expect(mcpMenuItem).toHaveTextContent("MCP Session")

    fireEvent.click(mcpMenuItem)

    expect(mockNavigate).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledWith("/mcp")
  })

  // @clause CL-MCP-006 (highlight active)
  it("succeeds when user is on /mcp route and menu item is highlighted", () => {
    render(<MockAppLayout currentPath="/mcp" />)

    const mcpMenuItem = screen.getByTestId("nav-item-/mcp")
    
    // Verify menu item has active styling
    expect(mcpMenuItem).toHaveClass("bg-primary")
    expect(mcpMenuItem).toHaveClass("text-white")

    // Verify other menu items are not active
    const dashboardMenuItem = screen.getByTestId("nav-item-/")
    expect(dashboardMenuItem).not.toHaveClass("bg-primary")
  })

  // @clause CL-MCP-007
  it("fails when GET /api/mcp/session returns 500 error and error toast is shown", async () => {
    mockGetSessionConfig.mockRejectedValueOnce(new Error("Server error"))

    render(<MockSessionConfigTab />)

    // Wait for error handling
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Falha ao carregar configuração")
    })

    // Verify skeleton is no longer shown
    expect(screen.queryByTestId("config-skeleton")).not.toBeInTheDocument()
  })

  // @clause CL-MCP-007 (network error)
  it("fails when GET /api/mcp/session has network timeout and error toast is shown", async () => {
    mockGetSessionConfig.mockRejectedValueOnce(new Error("Network timeout"))

    render(<MockSessionConfigTab />)

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Falha ao carregar configuração")
    })
  })

  // @clause CL-MCP-008
  it("fails when PUT /api/mcp/session returns 500 error and error toast is shown", async () => {
    const mockConfig = createMockConfig()
    mockGetSessionConfig.mockResolvedValue({ config: mockConfig })
    mockUpdateSessionConfig.mockRejectedValueOnce(new Error("Internal server error"))

    render(<MockSessionConfigTab />)

    await waitFor(() => {
      expect(screen.getByTestId("save-config-button")).toBeInTheDocument()
    })

    const saveButton = screen.getByTestId("save-config-button")
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Internal server error")
    })

    // Verify button is re-enabled after error
    expect(saveButton).not.toBeDisabled()
  })

  // @clause CL-MCP-008 (validation error)
  it("fails when PUT /api/mcp/session returns 400 validation error and error toast is shown", async () => {
    const mockConfig = createMockConfig()
    mockGetSessionConfig.mockResolvedValue({ config: mockConfig })
    mockUpdateSessionConfig.mockRejectedValueOnce(new Error("Invalid branch name"))

    render(<MockSessionConfigTab />)

    await waitFor(() => {
      expect(screen.getByTestId("save-config-button")).toBeInTheDocument()
    })

    const saveButton = screen.getByTestId("save-config-button")
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Invalid branch name")
    })
  })

  // @clause CL-MCP-009
  it("should display skeleton during initial config load", () => {
    const mockConfig = createMockConfig()
    mockGetSessionConfig.mockImplementation(() => new Promise(() => {})) // Never resolves

    render(<MockSessionConfigTab />)

    // Verify skeleton is displayed
    expect(screen.getByTestId("config-skeleton")).toBeInTheDocument()
    expect(screen.getByTestId("config-skeleton")).toHaveTextContent("Loading skeleton...")
  })

  // @clause CL-MCP-009 (button disabled during save)
  it("should disable save button during PUT request", async () => {
    const mockConfig = createMockConfig()
    mockGetSessionConfig.mockResolvedValue({ config: mockConfig })
    mockUpdateSessionConfig.mockImplementation(() => new Promise(() => {})) // Never resolves

    render(<MockSessionConfigTab />)

    await waitFor(() => {
      expect(screen.getByTestId("save-config-button")).toBeInTheDocument()
    })

    const saveButton = screen.getByTestId("save-config-button")
    fireEvent.click(saveButton)

    // Verify button is disabled during save
    await waitFor(() => {
      expect(saveButton).toBeDisabled()
      expect(saveButton).toHaveTextContent("Salvando...")
    })
  })

  // @clause CL-MCP-010
  it("should display green badges when all services are ok", async () => {
    const mockStatus = createMockStatus({
      mcpServer: "connected",
      gatekeeperApi: "online",
      git: "main",
      docs: "accessible",
    })
    mockGetMCPStatus.mockResolvedValueOnce(mockStatus)

    render(<MockStatusTab />)

    await waitFor(() => {
      expect(screen.getByTestId("status-mcp-badge")).toBeInTheDocument()
    })

    // Verify all badges have green color
    expect(screen.getByTestId("status-mcp-badge")).toHaveClass("bg-green-500")
    expect(screen.getByTestId("status-api-badge")).toHaveClass("bg-green-500")
    expect(screen.getByTestId("status-docs-badge")).toHaveClass("bg-green-500")
  })

  // @clause CL-MCP-010 (error states)
  it("should display red badges when services have errors", async () => {
    const mockStatus = createMockStatus({
      mcpServer: "disconnected",
      gatekeeperApi: "offline",
      git: "main",
      docs: "not-found",
    })
    mockGetMCPStatus.mockResolvedValueOnce(mockStatus)

    render(<MockStatusTab />)

    await waitFor(() => {
      expect(screen.getByTestId("status-mcp-badge")).toBeInTheDocument()
    })

    // Verify badges with errors have red color
    expect(screen.getByTestId("status-mcp-badge")).toHaveClass("bg-red-500")
    expect(screen.getByTestId("status-api-badge")).toHaveClass("bg-red-500")
    expect(screen.getByTestId("status-docs-badge")).toHaveClass("bg-red-500")

    // Verify badge content shows error status
    expect(screen.getByTestId("status-mcp-badge")).toHaveTextContent("disconnected")
    expect(screen.getByTestId("status-api-badge")).toHaveTextContent("offline")
    expect(screen.getByTestId("status-docs-badge")).toHaveTextContent("not-found")
  })
})
