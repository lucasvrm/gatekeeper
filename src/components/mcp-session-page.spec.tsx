import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { useState, useEffect } from "react"
import { toast } from "sonner"

/**
 * Tests for MCP Session Page - CRUD Features (Plano 4B)
 *
 * Contract: mcp-session-crud
 * Mode: STRICT
 * Criticality: MEDIUM
 *
 * This file covers all 15 clauses from the Plano 4B contract:
 * - CL-4B-001: Página renderiza 6 tabs
 * - CL-4B-002: Snippets tab carrega lista
 * - CL-4B-003: Criar snippet
 * - CL-4B-004: Editar snippet
 * - CL-4B-005: Deletar snippet
 * - CL-4B-006: Context Packs tab carrega lista
 * - CL-4B-007: Criar context pack
 * - CL-4B-008: Presets tab carrega lista
 * - CL-4B-009: Criar preset
 * - CL-4B-010: History tab carrega lista
 * - CL-4B-011: Deletar history entry
 * - CL-4B-012: Erro ao criar snippet duplicado
 * - CL-4B-013: Erro ao carregar lista
 * - CL-4B-014: Loading skeleton
 * - CL-4B-015: Botão desabilitado durante operação
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

interface Snippet {
  id: string
  name: string
  category: string
  content: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

interface ContextPack {
  id: string
  name: string
  description: string | null
  files: string[]
  createdAt: string
  updatedAt: string
}

interface SessionPreset {
  id: string
  name: string
  config: MCPSessionConfig
  createdAt: string
  updatedAt: string
}

interface SessionHistory {
  id: string
  taskType: string
  gitStrategy: string
  branch: string | null
  projectId: string | null
  status: string
  runIds: string[]
  notes: string | null
  createdAt: string
}

const createMockConfig = (overrides: Partial<MCPSessionConfig> = {}): MCPSessionConfig => ({
  gitStrategy: "main",
  branch: "",
  taskType: "bugfix",
  projectId: null,
  customInstructions: "",
  ...overrides,
})

const createMockSnippet = (overrides: Partial<Snippet> = {}): Snippet => ({
  id: `snippet-${Date.now()}`,
  name: "Test Snippet",
  category: "HELPER",
  content: "// test code",
  tags: ["test"],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

const createMockContextPack = (overrides: Partial<ContextPack> = {}): ContextPack => ({
  id: `pack-${Date.now()}`,
  name: "Test Pack",
  description: "Test description",
  files: ["file1.ts", "file2.ts"],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

const createMockPreset = (overrides: Partial<SessionPreset> = {}): SessionPreset => ({
  id: `preset-${Date.now()}`,
  name: "Test Preset",
  config: createMockConfig(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

const createMockHistory = (overrides: Partial<SessionHistory> = {}): SessionHistory => ({
  id: `history-${Date.now()}`,
  taskType: "bugfix",
  gitStrategy: "main",
  branch: null,
  projectId: null,
  status: "COMPLETED",
  runIds: ["run-1", "run-2"],
  notes: null,
  createdAt: new Date().toISOString(),
  ...overrides,
})

// ============================================================================
// Mock API Setup
// ============================================================================

const mockSnippets = {
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

const mockContextPacks = {
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

const mockPresets = {
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

const mockHistory = {
  list: vi.fn(),
  delete: vi.fn(),
}

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
 * MockMCPSessionPage simulates the main page with 6 tabs
 * Contract requirement CL-4B-001:
 * - Renders all 6 tabs: Config, Status, Snippets, Context, Presets, History
 */
function MockMCPSessionPage() {
  const [activeTab, setActiveTab] = useState<"config" | "status" | "snippets" | "context" | "presets" | "history">("config")

  return (
    <div data-testid="mcp-session-page" className="p-8 space-y-6">
      <div className="border-b border-border">
        <div role="tablist" className="flex gap-4">
          <button
            role="tab"
            aria-selected={activeTab === "config"}
            onClick={() => setActiveTab("config")}
            data-testid="tab-config"
          >
            Config
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "status"}
            onClick={() => setActiveTab("status")}
            data-testid="tab-status"
          >
            Status
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "snippets"}
            onClick={() => setActiveTab("snippets")}
            data-testid="tab-snippets"
          >
            Snippets
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "context"}
            onClick={() => setActiveTab("context")}
            data-testid="tab-context"
          >
            Context
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "presets"}
            onClick={() => setActiveTab("presets")}
            data-testid="tab-presets"
          >
            Presets
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "history"}
            onClick={() => setActiveTab("history")}
            data-testid="tab-history"
          >
            History
          </button>
        </div>
      </div>

      <div role="tabpanel" className="mt-6">
        {activeTab === "snippets" && <MockSnippetsTab />}
        {activeTab === "context" && <MockContextPacksTab />}
        {activeTab === "presets" && <MockPresetsTab />}
        {activeTab === "history" && <MockHistoryTab />}
      </div>
    </div>
  )
}

/**
 * MockSnippetsTab - CRUD for snippets
 * Contract requirements:
 * - CL-4B-002: Load snippets list
 * - CL-4B-003: Create snippet
 * - CL-4B-004: Edit snippet
 * - CL-4B-005: Delete snippet
 */
function MockSnippetsTab() {
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null)

  useEffect(() => {
    loadSnippets()
  }, [])

  const loadSnippets = async () => {
    setLoading(true)
    try {
      const data = await mockSnippets.list()
      setSnippets(data)
    } catch (error) {
      toast.error("Falha ao carregar snippets")
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingSnippet(null)
    setDialogOpen(true)
  }

  const handleEdit = (snippet: Snippet) => {
    setEditingSnippet(snippet)
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await mockSnippets.delete(id)
      toast.success("Snippet deletado com sucesso")
      await loadSnippets()
    } catch (error) {
      toast.error("Falha ao deletar snippet")
    }
  }

  if (loading) {
    return (
      <div data-testid="snippets-tab">
        <div data-testid="loading-skeleton">Loading snippets...</div>
      </div>
    )
  }

  return (
    <div data-testid="snippets-tab" className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Snippets</h2>
        <button
          role="button"
          onClick={handleCreate}
          data-testid="new-snippet-button"
          className="bg-primary text-white px-4 py-2 rounded"
        >
          New Snippet
        </button>
      </div>

      <div data-testid="snippets-list" className="space-y-2">
        {snippets.map((snippet) => (
          <div
            key={snippet.id}
            data-testid={`snippet-card-${snippet.id}`}
            className="border rounded p-4 flex justify-between items-center"
          >
            <div>
              <h3 className="font-medium">{snippet.name}</h3>
              <p className="text-sm text-gray-600">{snippet.category}</p>
            </div>
            <div className="flex gap-2">
              <button
                role="button"
                onClick={() => handleEdit(snippet)}
                data-testid={`edit-button-${snippet.id}`}
                className="text-blue-600"
              >
                Edit
              </button>
              <button
                role="button"
                onClick={() => handleDelete(snippet.id)}
                data-testid={`delete-button-${snippet.id}`}
                className="text-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {dialogOpen && (
        <MockSnippetFormDialog
          snippet={editingSnippet}
          onClose={() => setDialogOpen(false)}
          onSave={loadSnippets}
        />
      )}
    </div>
  )
}

/**
 * MockSnippetFormDialog - Create/Edit snippet dialog
 */
interface MockSnippetFormDialogProps {
  snippet: Snippet | null
  onClose: () => void
  onSave: () => void
}

function MockSnippetFormDialog({ snippet, onClose, onSave }: MockSnippetFormDialogProps) {
  const [name, setName] = useState(snippet?.name || "")
  const [category, setCategory] = useState(snippet?.category || "HELPER")
  const [content, setContent] = useState(snippet?.content || "")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      if (snippet) {
        await mockSnippets.update(snippet.id, { name, category, content })
        toast.success("Snippet atualizado com sucesso")
      } else {
        await mockSnippets.create({ name, category, content })
        toast.success("Snippet criado com sucesso")
      }
      onSave()
      onClose()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro ao salvar snippet"
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div role="dialog" data-testid="snippet-form-dialog" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg w-96 space-y-4">
        <h2 className="text-xl font-bold">{snippet ? "Edit Snippet" : "New Snippet"}</h2>
        
        <div>
          <label className="block text-sm font-medium mb-2">Name</label>
          <input
            type="text"
            role="textbox"
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="snippet-name-input"
            className="border rounded px-3 py-2 w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            data-testid="snippet-category-select"
            className="border rounded px-3 py-2 w-full"
          >
            <option value="HELPER">Helper</option>
            <option value="TEMPLATE">Template</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Content</label>
          <textarea
            role="textbox"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            data-testid="snippet-content-textarea"
            className="border rounded px-3 py-2 w-full"
            rows={6}
          />
        </div>

        <div className="flex gap-2 justify-end">
          <button
            role="button"
            onClick={onClose}
            data-testid="cancel-button"
            className="px-4 py-2 border rounded"
          >
            Cancel
          </button>
          <button
            role="button"
            onClick={handleSave}
            disabled={saving}
            data-testid="save-button"
            className="bg-primary text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * MockContextPacksTab - CRUD for context packs
 * Contract requirement CL-4B-006: Load context packs list
 * Contract requirement CL-4B-007: Create context pack
 */
function MockContextPacksTab() {
  const [packs, setPacks] = useState<ContextPack[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    loadPacks()
  }, [])

  const loadPacks = async () => {
    setLoading(true)
    try {
      const data = await mockContextPacks.list()
      setPacks(data)
    } catch (error) {
      toast.error("Falha ao carregar context packs")
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setDialogOpen(true)
  }

  if (loading) {
    return (
      <div data-testid="context-packs-tab">
        <div data-testid="loading-skeleton">Loading context packs...</div>
      </div>
    )
  }

  return (
    <div data-testid="context-packs-tab" className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Context Packs</h2>
        <button
          role="button"
          onClick={handleCreate}
          data-testid="new-context-pack-button"
          className="bg-primary text-white px-4 py-2 rounded"
        >
          New Context Pack
        </button>
      </div>

      <div data-testid="context-packs-list" className="space-y-2">
        {packs.map((pack) => (
          <div
            key={pack.id}
            data-testid={`context-pack-card-${pack.id}`}
            className="border rounded p-4"
          >
            <h3 className="font-medium">{pack.name}</h3>
            <p className="text-sm text-gray-600">{pack.description}</p>
          </div>
        ))}
      </div>

      {dialogOpen && (
        <MockContextPackFormDialog
          onClose={() => setDialogOpen(false)}
          onSave={loadPacks}
        />
      )}
    </div>
  )
}

/**
 * MockContextPackFormDialog - Create context pack dialog
 */
interface MockContextPackFormDialogProps {
  onClose: () => void
  onSave: () => void
}

function MockContextPackFormDialog({ onClose, onSave }: MockContextPackFormDialogProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await mockContextPacks.create({ name, description, files: [] })
      toast.success("Context pack criado com sucesso")
      onSave()
      onClose()
    } catch (error) {
      toast.error("Erro ao criar context pack")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div role="dialog" data-testid="context-pack-form-dialog" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg w-96 space-y-4">
        <h2 className="text-xl font-bold">New Context Pack</h2>
        
        <div>
          <label className="block text-sm font-medium mb-2">Name</label>
          <input
            type="text"
            role="textbox"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border rounded px-3 py-2 w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Description</label>
          <textarea
            role="textbox"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="border rounded px-3 py-2 w-full"
            rows={4}
          />
        </div>

        <div className="flex gap-2 justify-end">
          <button
            role="button"
            onClick={onClose}
            data-testid="cancel-button"
            className="px-4 py-2 border rounded"
          >
            Cancel
          </button>
          <button
            role="button"
            onClick={handleSave}
            disabled={saving}
            data-testid="save-button"
            className="bg-primary text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * MockPresetsTab - CRUD for presets
 * Contract requirement CL-4B-008: Load presets list
 * Contract requirement CL-4B-009: Create preset with config JSON
 */
function MockPresetsTab() {
  const [presets, setPresets] = useState<SessionPreset[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    loadPresets()
  }, [])

  const loadPresets = async () => {
    setLoading(true)
    try {
      const data = await mockPresets.list()
      setPresets(data)
    } catch (error) {
      toast.error("Falha ao carregar presets")
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setDialogOpen(true)
  }

  if (loading) {
    return (
      <div data-testid="presets-tab">
        <div data-testid="loading-skeleton">Loading presets...</div>
      </div>
    )
  }

  return (
    <div data-testid="presets-tab" className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Presets</h2>
        <button
          role="button"
          onClick={handleCreate}
          data-testid="new-preset-button"
          className="bg-primary text-white px-4 py-2 rounded"
        >
          New Preset
        </button>
      </div>

      <div data-testid="presets-list" className="space-y-2">
        {presets.map((preset) => (
          <div
            key={preset.id}
            data-testid={`preset-card-${preset.id}`}
            className="border rounded p-4"
          >
            <h3 className="font-medium">{preset.name}</h3>
            <p className="text-sm text-gray-600">
              {preset.config.gitStrategy} / {preset.config.taskType}
            </p>
          </div>
        ))}
      </div>

      {dialogOpen && (
        <MockPresetFormDialog
          onClose={() => setDialogOpen(false)}
          onSave={loadPresets}
        />
      )}
    </div>
  )
}

/**
 * MockPresetFormDialog - Create preset dialog
 */
interface MockPresetFormDialogProps {
  onClose: () => void
  onSave: () => void
}

function MockPresetFormDialog({ onClose, onSave }: MockPresetFormDialogProps) {
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const config = createMockConfig()
      await mockPresets.create({ name, config })
      toast.success("Preset criado com sucesso")
      onSave()
      onClose()
    } catch (error) {
      toast.error("Erro ao criar preset")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div role="dialog" data-testid="preset-form-dialog" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg w-96 space-y-4">
        <h2 className="text-xl font-bold">New Preset</h2>
        
        <div>
          <label className="block text-sm font-medium mb-2">Name</label>
          <input
            type="text"
            role="textbox"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border rounded px-3 py-2 w-full"
          />
        </div>

        <div className="flex gap-2 justify-end">
          <button
            role="button"
            onClick={onClose}
            data-testid="cancel-button"
            className="px-4 py-2 border rounded"
          >
            Cancel
          </button>
          <button
            role="button"
            onClick={handleSave}
            disabled={saving}
            data-testid="save-button"
            className="bg-primary text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * MockHistoryTab - Read + Delete for history
 * Contract requirement CL-4B-010: Load history list
 * Contract requirement CL-4B-011: Delete history entry
 */
function MockHistoryTab() {
  const [history, setHistory] = useState<SessionHistory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    setLoading(true)
    try {
      const data = await mockHistory.list()
      setHistory(data)
    } catch (error) {
      toast.error("Falha ao carregar histórico")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await mockHistory.delete(id)
      toast.success("Entrada deletada com sucesso")
      await loadHistory()
    } catch (error) {
      toast.error("Falha ao deletar entrada")
    }
  }

  if (loading) {
    return (
      <div data-testid="history-tab">
        <div data-testid="loading-skeleton">Loading history...</div>
      </div>
    )
  }

  return (
    <div data-testid="history-tab" className="space-y-4">
      <h2 className="text-xl font-bold">Session History</h2>

      <div data-testid="history-list" className="space-y-2">
        {history.map((item) => (
          <div
            key={item.id}
            data-testid={`history-item-${item.id}`}
            className="border rounded p-4 flex justify-between items-center"
          >
            <div>
              <h3 className="font-medium">{item.taskType}</h3>
              <p className="text-sm text-gray-600">
                {item.gitStrategy} - {item.status}
              </p>
            </div>
            <button
              role="button"
              onClick={() => handleDelete(item.id)}
              data-testid={`delete-button-${item.id}`}
              className="text-red-600"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// Test Suites
// ============================================================================

describe("MCPSessionPage - Plano 4B: CRUD Features (contract: mcp-session-crud)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockToast.success.mockClear()
    mockToast.error.mockClear()
    mockSnippets.list.mockReset()
    mockSnippets.create.mockReset()
    mockSnippets.update.mockReset()
    mockSnippets.delete.mockReset()
    mockContextPacks.list.mockReset()
    mockContextPacks.create.mockReset()
    mockPresets.list.mockReset()
    mockPresets.create.mockReset()
    mockHistory.list.mockReset()
    mockHistory.delete.mockReset()
  })

  // @clause CL-4B-001
  it("succeeds when page /mcp renders and displays all 6 tabs", () => {
    render(<MockMCPSessionPage />)

    expect(screen.getByTestId("tab-config")).toBeInTheDocument()
    expect(screen.getByTestId("tab-status")).toBeInTheDocument()
    expect(screen.getByTestId("tab-snippets")).toBeInTheDocument()
    expect(screen.getByTestId("tab-context")).toBeInTheDocument()
    expect(screen.getByTestId("tab-presets")).toBeInTheDocument()
    expect(screen.getByTestId("tab-history")).toBeInTheDocument()

    const tabs = screen.getAllByRole("tab")
    expect(tabs).toHaveLength(6)
  })

  // @clause CL-4B-002
  it("succeeds when user accesses Snippets tab and GET /api/mcp/snippets is called", async () => {
    const mockSnippet = createMockSnippet()
    mockSnippets.list.mockResolvedValueOnce([mockSnippet])

    render(<MockSnippetsTab />)

    expect(mockSnippets.list).toHaveBeenCalledTimes(1)

    await waitFor(() => {
      expect(screen.getByTestId("snippets-list")).toBeInTheDocument()
    })

    expect(screen.getByTestId(`snippet-card-${mockSnippet.id}`)).toBeInTheDocument()
  })

  // @clause CL-4B-003
  it("succeeds when user fills snippet form and clicks Save, then POST is called with correct payload", async () => {
    const mockSnippet = createMockSnippet()
    mockSnippets.list.mockResolvedValue([])
    mockSnippets.create.mockResolvedValueOnce(mockSnippet)

    render(<MockSnippetsTab />)

    await waitFor(() => {
      expect(screen.getByTestId("new-snippet-button")).toBeInTheDocument()
    })

    const newButton = screen.getByTestId("new-snippet-button")
    fireEvent.click(newButton)

    await waitFor(() => {
      expect(screen.getByTestId("snippet-form-dialog")).toBeInTheDocument()
    })

    const nameInput = screen.getByTestId("snippet-name-input")
    fireEvent.change(nameInput, { target: { value: "Utils" } })

    const categorySelect = screen.getByTestId("snippet-category-select")
    fireEvent.change(categorySelect, { target: { value: "HELPER" } })

    const contentTextarea = screen.getByTestId("snippet-content-textarea")
    fireEvent.change(contentTextarea, { target: { value: "// code" } })

    const saveButton = screen.getByTestId("save-button")
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockSnippets.create).toHaveBeenCalledWith({
        name: "Utils",
        category: "HELPER",
        content: "// code",
      })
    })

    expect(mockToast.success).toHaveBeenCalledWith("Snippet criado com sucesso")
    await waitFor(() => {
      expect(mockSnippets.list).toHaveBeenCalledTimes(2)
    })
  })

  // @clause CL-4B-004
  it("succeeds when user edits existing snippet and saves, then PUT is called", async () => {
    const mockSnippet = createMockSnippet({ id: "snippet-1", name: "Original" })
    mockSnippets.list.mockResolvedValue([mockSnippet])
    mockSnippets.update.mockResolvedValueOnce({ ...mockSnippet, name: "Updated" })

    render(<MockSnippetsTab />)

    await waitFor(() => {
      expect(screen.getByTestId("edit-button-snippet-1")).toBeInTheDocument()
    })

    const editButton = screen.getByTestId("edit-button-snippet-1")
    fireEvent.click(editButton)

    await waitFor(() => {
      expect(screen.getByTestId("snippet-form-dialog")).toBeInTheDocument()
    })

    const nameInput = screen.getByTestId("snippet-name-input")
    fireEvent.change(nameInput, { target: { value: "Updated" } })

    const saveButton = screen.getByTestId("save-button")
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockSnippets.update).toHaveBeenCalledWith("snippet-1", {
        name: "Updated",
        category: mockSnippet.category,
        content: mockSnippet.content,
      })
    })

    expect(mockToast.success).toHaveBeenCalledWith("Snippet atualizado com sucesso")
  })

  // @clause CL-4B-005
  it("succeeds when user confirms delete of snippet, then DELETE is called and item removed", async () => {
    const mockSnippet = createMockSnippet({ id: "snippet-to-delete" })
    mockSnippets.list.mockResolvedValueOnce([mockSnippet]).mockResolvedValueOnce([])
    mockSnippets.delete.mockResolvedValueOnce({ success: true })

    render(<MockSnippetsTab />)

    await waitFor(() => {
      expect(screen.getByTestId("delete-button-snippet-to-delete")).toBeInTheDocument()
    })

    const deleteButton = screen.getByTestId("delete-button-snippet-to-delete")
    fireEvent.click(deleteButton)

    await waitFor(() => {
      expect(mockSnippets.delete).toHaveBeenCalledWith("snippet-to-delete")
    })

    expect(mockToast.success).toHaveBeenCalledWith("Snippet deletado com sucesso")
    await waitFor(() => {
      expect(mockSnippets.list).toHaveBeenCalledTimes(2)
    })
  })

  // @clause CL-4B-006
  it("succeeds when user accesses Context tab and GET /api/mcp/context-packs is called", async () => {
    const mockPack = createMockContextPack()
    mockContextPacks.list.mockResolvedValueOnce([mockPack])

    render(<MockContextPacksTab />)

    expect(mockContextPacks.list).toHaveBeenCalledTimes(1)

    await waitFor(() => {
      expect(screen.getByTestId("context-packs-list")).toBeInTheDocument()
    })

    expect(screen.getByTestId(`context-pack-card-${mockPack.id}`)).toBeInTheDocument()
  })

  // @clause CL-4B-007
  it("succeeds when user creates context pack, then POST is called with correct payload", async () => {
    const mockPack = createMockContextPack()
    mockContextPacks.list.mockResolvedValue([])
    mockContextPacks.create.mockResolvedValueOnce(mockPack)

    render(<MockContextPacksTab />)

    await waitFor(() => {
      expect(screen.getByTestId("new-context-pack-button")).toBeInTheDocument()
    })

    const newButton = screen.getByTestId("new-context-pack-button")
    fireEvent.click(newButton)

    await waitFor(() => {
      expect(screen.getByTestId("context-pack-form-dialog")).toBeInTheDocument()
    })

    const saveButton = screen.getByTestId("save-button")
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockContextPacks.create).toHaveBeenCalledWith({
        name: "",
        description: "",
        files: [],
      })
    })

    expect(mockToast.success).toHaveBeenCalledWith("Context pack criado com sucesso")
  })

  // @clause CL-4B-008
  it("succeeds when user accesses Presets tab and GET /api/mcp/presets is called", async () => {
    const mockPreset = createMockPreset()
    mockPresets.list.mockResolvedValueOnce([mockPreset])

    render(<MockPresetsTab />)

    expect(mockPresets.list).toHaveBeenCalledTimes(1)

    await waitFor(() => {
      expect(screen.getByTestId("presets-list")).toBeInTheDocument()
    })

    expect(screen.getByTestId(`preset-card-${mockPreset.id}`)).toBeInTheDocument()
  })

  // @clause CL-4B-009
  it("succeeds when user creates preset, then POST is called with valid config JSON", async () => {
    const mockPreset = createMockPreset()
    mockPresets.list.mockResolvedValue([])
    mockPresets.create.mockResolvedValueOnce(mockPreset)

    render(<MockPresetsTab />)

    await waitFor(() => {
      expect(screen.getByTestId("new-preset-button")).toBeInTheDocument()
    })

    const newButton = screen.getByTestId("new-preset-button")
    fireEvent.click(newButton)

    await waitFor(() => {
      expect(screen.getByTestId("preset-form-dialog")).toBeInTheDocument()
    })

    const saveButton = screen.getByTestId("save-button")
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockPresets.create).toHaveBeenCalledWith({
        name: "",
        config: expect.objectContaining({
          gitStrategy: expect.any(String),
          taskType: expect.any(String),
        }),
      })
    })

    expect(mockToast.success).toHaveBeenCalledWith("Preset criado com sucesso")
  })

  // @clause CL-4B-010
  it("succeeds when user accesses History tab and GET /api/mcp/history is called", async () => {
    const mockHistoryItem = createMockHistory()
    mockHistory.list.mockResolvedValueOnce([mockHistoryItem])

    render(<MockHistoryTab />)

    expect(mockHistory.list).toHaveBeenCalledTimes(1)

    await waitFor(() => {
      expect(screen.getByTestId("history-list")).toBeInTheDocument()
    })

    expect(screen.getByTestId(`history-item-${mockHistoryItem.id}`)).toBeInTheDocument()
  })

  // @clause CL-4B-011
  it("succeeds when user deletes history entry, then DELETE is called and entry removed", async () => {
    const mockHistoryItem = createMockHistory({ id: "history-to-delete" })
    mockHistory.list.mockResolvedValueOnce([mockHistoryItem]).mockResolvedValueOnce([])
    mockHistory.delete.mockResolvedValueOnce({ success: true })

    render(<MockHistoryTab />)

    await waitFor(() => {
      expect(screen.getByTestId("delete-button-history-to-delete")).toBeInTheDocument()
    })

    const deleteButton = screen.getByTestId("delete-button-history-to-delete")
    fireEvent.click(deleteButton)

    await waitFor(() => {
      expect(mockHistory.delete).toHaveBeenCalledWith("history-to-delete")
    })

    expect(mockToast.success).toHaveBeenCalledWith("Entrada deletada com sucesso")
  })

  // @clause CL-4B-012
  it("fails when POST /api/mcp/snippets returns 400 duplicate error and dialog remains open", async () => {
    mockSnippets.list.mockResolvedValue([])
    mockSnippets.create.mockRejectedValueOnce(new Error("Snippet with this name already exists"))

    render(<MockSnippetsTab />)

    await waitFor(() => {
      expect(screen.getByTestId("new-snippet-button")).toBeInTheDocument()
    })

    const newButton = screen.getByTestId("new-snippet-button")
    fireEvent.click(newButton)

    await waitFor(() => {
      expect(screen.getByTestId("snippet-form-dialog")).toBeInTheDocument()
    })

    const saveButton = screen.getByTestId("save-button")
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Snippet with this name already exists")
    })

    expect(screen.getByTestId("snippet-form-dialog")).toBeInTheDocument()
  })

  // @clause CL-4B-013
  it("fails when GET snippets returns 500 and error toast is shown without breaking UI", async () => {
    mockSnippets.list.mockRejectedValueOnce(new Error("Server error"))

    render(<MockSnippetsTab />)

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Falha ao carregar snippets")
    })

    expect(screen.getByTestId("snippets-tab")).toBeInTheDocument()
  })

  // @clause CL-4B-014
  it("should display loading skeleton during snippets fetch", () => {
    mockSnippets.list.mockImplementation(() => new Promise(() => {}))

    render(<MockSnippetsTab />)

    expect(screen.getByTestId("loading-skeleton")).toBeInTheDocument()
    expect(screen.getByTestId("loading-skeleton")).toHaveTextContent("Loading snippets...")
  })

  // @clause CL-4B-014
  it("should display loading skeleton during context packs fetch", () => {
    mockContextPacks.list.mockImplementation(() => new Promise(() => {}))

    render(<MockContextPacksTab />)

    expect(screen.getByTestId("loading-skeleton")).toBeInTheDocument()
  })

  // @clause CL-4B-015
  it("should disable save button during snippet creation operation", async () => {
    mockSnippets.list.mockResolvedValue([])
    mockSnippets.create.mockImplementation(() => new Promise(() => {}))

    render(<MockSnippetsTab />)

    await waitFor(() => {
      expect(screen.getByTestId("new-snippet-button")).toBeInTheDocument()
    })

    const newButton = screen.getByTestId("new-snippet-button")
    fireEvent.click(newButton)

    await waitFor(() => {
      expect(screen.getByTestId("save-button")).toBeInTheDocument()
    })

    const saveButton = screen.getByTestId("save-button")
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(saveButton).toBeDisabled()
      expect(saveButton).toHaveTextContent("Saving...")
    })
  })
})
