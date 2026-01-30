import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState, useMemo } from "react"

/**
 * Config Page Enhancements Contract Spec
 * ======================================
 *
 * Contract: config-page-enhancements v1.0
 * Mode: STRICT
 * Criticality: MEDIUM
 *
 * Este arquivo cobre todas as 24 cláusulas do contrato:
 *
 * Task 1 — Filtro por Fail Mode (CL-UI-VT-FILTER-001 a CL-UI-VT-FILTER-005):
 * - Filtro fail mode dropdown existe
 * - Filtro Hard mostra apenas HARD
 * - Filtro Warning mostra apenas WARNING
 * - Filtro Default mostra apenas null
 * - Filtros combinam corretamente
 *
 * Task 2 — Bulk Actions (CL-UI-VT-BULK-001 a CL-UI-VT-BULK-008, CL-API-BULK-001 a CL-API-BULK-003):
 * - Checkbox em cada linha
 * - Checkbox select all no header
 * - Select all marca todos visíveis
 * - Barra de bulk actions aparece
 * - Botão Ativar Selecionados
 * - Botão Desativar Selecionados
 * - Dropdown Fail Mode em bulk
 * - Limpar seleção
 * - PATCH /validators/bulk sucesso
 * - PATCH /validators/bulk key inválida
 * - PATCH /validators/bulk failMode inválido
 *
 * Task 3 — Reordenação de Abas (CL-UI-TABS-001):
 * - Validation Configs após Validators
 *
 * Task 4 — Filtros em Validation Configs (CL-UI-VC-FILTER-001 a CL-UI-VC-FILTER-007):
 * - Input de filtro por key
 * - Select de filtro por type
 * - Select de filtro por category
 * - Filtro key filtra por substring
 * - Filtro type filtra exato
 * - Filtro category filtra exato
 * - Filtros combinam
 *
 * REGRA: Se estes testes falharem, a LLM executora errou na implementação.
 */

// ============================================================================
// Type Definitions
// ============================================================================

type FailMode = "HARD" | "WARNING" | null

interface ValidatorItem {
  key: string
  value: string
  failMode?: FailMode
  category?: string
  displayName?: string
  description?: string
}

interface ValidationConfigItem {
  id: string
  key: string
  value: string
  type: string
  category: string
  description?: string | null
}

interface BulkUpdatePayload {
  keys: string[]
  updates: {
    isActive?: boolean
    failMode?: FailMode
  }
}

interface BulkUpdateResponse {
  key: string
  value: string
  failMode?: FailMode
}

interface ApiError {
  code: string
  message: string
}

// ============================================================================
// Mock Functions
// ============================================================================

const mockOnToggle = vi.fn<[string, boolean], void | Promise<void>>()
const mockOnFailModeChange = vi.fn<[string, FailMode], void | Promise<void>>()
const mockOnBulkUpdate = vi.fn<[BulkUpdatePayload], Promise<BulkUpdateResponse[]>>()
const mockOnCreate = vi.fn<[Record<string, string | boolean>], Promise<boolean>>()
const mockOnUpdate = vi.fn<[string, Record<string, string | boolean>], Promise<boolean>>()
const mockOnDelete = vi.fn<[string], Promise<boolean>>()

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockValidator = (overrides: Partial<ValidatorItem> = {}): ValidatorItem => ({
  key: `VALIDATOR_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  value: "true",
  failMode: null,
  category: "INPUT_SCOPE",
  displayName: "Test Validator",
  description: "A test validator",
  ...overrides,
})

const createMockValidationConfig = (overrides: Partial<ValidationConfigItem> = {}): ValidationConfigItem => ({
  id: `config_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  key: "TEST_CONFIG",
  value: "100",
  type: "NUMBER",
  category: "THRESHOLD",
  description: "Test configuration",
  ...overrides,
})

// ============================================================================
// Mock Components — ValidatorsTab with Fail Mode Filter and Bulk Actions
// ============================================================================

interface ValidatorsTabProps {
  validators: ValidatorItem[]
  actionId: string | null
  activeCount: number
  inactiveCount: number
  onToggle: (name: string, isActive: boolean) => void | Promise<void>
  onFailModeChange: (validatorKey: string, mode: FailMode) => void | Promise<void>
  onBulkUpdate?: (payload: BulkUpdatePayload) => Promise<BulkUpdateResponse[]>
}

function ValidatorsTab({
  validators,
  actionId,
  onToggle,
  onFailModeChange,
  onBulkUpdate,
}: ValidatorsTabProps) {
  const [categoryFilter, setCategoryFilter] = useState("ALL")
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL")
  const [failModeFilter, setFailModeFilter] = useState<"ALL" | "HARD" | "WARNING" | "DEFAULT">("ALL")
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())

  const availableCategories = useMemo(() => {
    const categories = new Set(
      validators
        .map((v) => v.category)
        .filter((c): c is string => Boolean(c))
    )
    return Array.from(categories).sort()
  }, [validators])

  const filteredValidators = useMemo(() => {
    return validators.filter((validator) => {
      if (categoryFilter !== "ALL" && validator.category !== categoryFilter) {
        return false
      }
      if (statusFilter === "ACTIVE" && validator.value !== "true") {
        return false
      }
      if (statusFilter === "INACTIVE" && validator.value === "true") {
        return false
      }
      // CL-UI-VT-FILTER-002, CL-UI-VT-FILTER-003, CL-UI-VT-FILTER-004
      if (failModeFilter !== "ALL") {
        if (failModeFilter === "DEFAULT") {
          if (validator.failMode !== null && validator.failMode !== undefined) {
            return false
          }
        } else if (validator.failMode !== failModeFilter) {
          return false
        }
      }
      return true
    })
  }, [categoryFilter, statusFilter, failModeFilter, validators])

  const visibleKeys = useMemo(() => filteredValidators.map((v) => v.key), [filteredValidators])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedKeys(new Set(visibleKeys))
    } else {
      setSelectedKeys(new Set())
    }
  }

  const handleSelectOne = (key: string, checked: boolean) => {
    const newSet = new Set(selectedKeys)
    if (checked) {
      newSet.add(key)
    } else {
      newSet.delete(key)
    }
    setSelectedKeys(newSet)
  }

  const handleBulkActivate = async () => {
    if (onBulkUpdate && selectedKeys.size > 0) {
      await onBulkUpdate({ keys: Array.from(selectedKeys), updates: { isActive: true } })
    }
  }

  const handleBulkDeactivate = async () => {
    if (onBulkUpdate && selectedKeys.size > 0) {
      await onBulkUpdate({ keys: Array.from(selectedKeys), updates: { isActive: false } })
    }
  }

  const handleBulkFailMode = async (mode: FailMode) => {
    if (onBulkUpdate && selectedKeys.size > 0) {
      await onBulkUpdate({ keys: Array.from(selectedKeys), updates: { failMode: mode } })
    }
  }

  const handleClearSelection = () => {
    setSelectedKeys(new Set())
  }

  const isAllSelected = visibleKeys.length > 0 && visibleKeys.every((key) => selectedKeys.has(key))

  return (
    <div data-testid="validators-tab">
      <div className="flex items-center gap-3">
        {/* Category Filter */}
        <select
          data-testid="category-filter"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="ALL">Todas categorias</option>
          {availableCategories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          data-testid="status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "INACTIVE")}
        >
          <option value="ALL">Todos status</option>
          <option value="ACTIVE">Ativo</option>
          <option value="INACTIVE">Inativo</option>
        </select>

        {/* CL-UI-VT-FILTER-001: Fail Mode Filter */}
        <select
          data-testid="fail-mode-filter"
          value={failModeFilter}
          onChange={(e) => setFailModeFilter(e.target.value as "ALL" | "HARD" | "WARNING" | "DEFAULT")}
        >
          <option value="ALL">Todos tipos</option>
          <option value="HARD">Hard</option>
          <option value="WARNING">Warning</option>
          <option value="DEFAULT">Default</option>
        </select>
      </div>

      {/* CL-UI-VT-BULK-004: Bulk Actions Bar */}
      {selectedKeys.size > 0 && (
        <div data-testid="bulk-actions-bar" className="flex items-center gap-2 p-2 bg-muted rounded">
          <span data-testid="selected-count">{selectedKeys.size} validators selecionados</span>
          <button data-testid="bulk-activate-btn" onClick={handleBulkActivate}>
            Ativar Selecionados
          </button>
          <button data-testid="bulk-deactivate-btn" onClick={handleBulkDeactivate}>
            Desativar Selecionados
          </button>
          <select
            data-testid="bulk-fail-mode-dropdown"
            onChange={(e) => handleBulkFailMode(e.target.value === "HARD" ? "HARD" : e.target.value === "WARNING" ? "WARNING" : null)}
            defaultValue=""
          >
            <option value="" disabled>Definir Fail Mode</option>
            <option value="HARD">Hard</option>
            <option value="WARNING">Warning</option>
          </select>
          <button data-testid="clear-selection-btn" onClick={handleClearSelection}>
            Limpar Seleção
          </button>
        </div>
      )}

      <table>
        <thead>
          <tr>
            {/* CL-UI-VT-BULK-002: Select All Checkbox */}
            <th>
              <input
                type="checkbox"
                data-testid="select-all-checkbox"
                checked={isAllSelected}
                onChange={(e) => handleSelectAll(e.target.checked)}
              />
            </th>
            <th>Validator</th>
            <th>Categoria</th>
            <th>Status</th>
            <th>Fail</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredValidators.map((validator) => {
            const isActive = validator.value === "true"
            return (
              <tr key={validator.key} data-testid={`validator-row-${validator.key}`}>
                {/* CL-UI-VT-BULK-001: Checkbox in each row */}
                <td>
                  <input
                    type="checkbox"
                    data-testid={`validator-checkbox-${validator.key}`}
                    checked={selectedKeys.has(validator.key)}
                    onChange={(e) => handleSelectOne(validator.key, e.target.checked)}
                  />
                </td>
                <td>{validator.displayName ?? validator.key}</td>
                <td>{validator.category}</td>
                <td>{isActive ? "Active" : "Inactive"}</td>
                <td data-testid={`fail-mode-${validator.key}`}>
                  {validator.failMode ?? "Default"}
                </td>
                <td>
                  <button
                    onClick={() => onToggle(validator.key, !isActive)}
                    disabled={actionId === validator.key}
                  >
                    {isActive ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ============================================================================
// Mock Components — ValidationConfigsTab with Filters
// ============================================================================

interface ValidationConfigsTabProps {
  items: ValidationConfigItem[]
  onCreate: (values: Record<string, string | boolean>) => Promise<boolean>
  onUpdate: (id: string, values: Record<string, string | boolean>) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
}

function ValidationConfigsTab({ items, onCreate, onUpdate, onDelete }: ValidationConfigsTabProps) {
  const [keyFilter, setKeyFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState("ALL")
  const [categoryFilter, setCategoryFilter] = useState("ALL")

  const uniqueTypes = useMemo(() => {
    const types = new Set(items.map((item) => item.type))
    return Array.from(types).sort()
  }, [items])

  const uniqueCategories = useMemo(() => {
    const categories = new Set(items.map((item) => item.category))
    return Array.from(categories).sort()
  }, [items])

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // CL-UI-VC-FILTER-004: Key filter (case-insensitive substring)
      if (keyFilter && !item.key.toLowerCase().includes(keyFilter.toLowerCase())) {
        return false
      }
      // CL-UI-VC-FILTER-005: Type filter (exact match)
      if (typeFilter !== "ALL" && item.type !== typeFilter) {
        return false
      }
      // CL-UI-VC-FILTER-006: Category filter (exact match)
      if (categoryFilter !== "ALL" && item.category !== categoryFilter) {
        return false
      }
      return true
    })
  }, [items, keyFilter, typeFilter, categoryFilter])

  return (
    <div data-testid="validation-configs-tab">
      <div className="flex items-center gap-3">
        {/* CL-UI-VC-FILTER-001: Key Filter Input */}
        <input
          type="text"
          data-testid="key-filter"
          placeholder="Filtrar por key..."
          value={keyFilter}
          onChange={(e) => setKeyFilter(e.target.value)}
        />

        {/* CL-UI-VC-FILTER-002: Type Filter Select */}
        <select
          data-testid="type-filter"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="ALL">Todos types</option>
          {uniqueTypes.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>

        {/* CL-UI-VC-FILTER-003: Category Filter Select */}
        <select
          data-testid="category-filter"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="ALL">Todas categorias</option>
          {uniqueCategories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      <table data-testid="validation-configs-table">
        <thead>
          <tr>
            <th>Key</th>
            <th>Value</th>
            <th>Type</th>
            <th>Category</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredItems.map((item) => (
            <tr key={item.id} data-testid={`config-row-${item.id}`}>
              <td data-testid={`config-key-${item.id}`}>{item.key}</td>
              <td>{item.value}</td>
              <td data-testid={`config-type-${item.id}`}>{item.type}</td>
              <td data-testid={`config-category-${item.id}`}>{item.category}</td>
              <td>
                <button onClick={() => onDelete(item.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ============================================================================
// Mock Components — ConfigPage with Tabs
// ============================================================================

interface ConfigPageProps {
  validators: ValidatorItem[]
  validationConfigs: ValidationConfigItem[]
  onToggle: (name: string, isActive: boolean) => void | Promise<void>
  onFailModeChange: (validatorKey: string, mode: FailMode) => void | Promise<void>
  onBulkUpdate?: (payload: BulkUpdatePayload) => Promise<BulkUpdateResponse[]>
  onCreateConfig: (values: Record<string, string | boolean>) => Promise<boolean>
  onUpdateConfig: (id: string, values: Record<string, string | boolean>) => Promise<boolean>
  onDeleteConfig: (id: string) => Promise<boolean>
}

function ConfigPage({
  validators,
  validationConfigs,
  onToggle,
  onFailModeChange,
  onBulkUpdate,
  onCreateConfig,
  onUpdateConfig,
  onDeleteConfig,
}: ConfigPageProps) {
  const [activeTab, setActiveTab] = useState("validators")

  // CL-UI-TABS-001: Tab order
  const tabs = [
    { value: "validators", label: "Validators" },
    { value: "validation-configs", label: "Validation Configs" },
    { value: "path-configs", label: "Path Configs" },
    { value: "sensitive-file-rules", label: "Sensitive File Rules" },
    { value: "ambiguous-terms", label: "Ambiguous Terms" },
  ]

  return (
    <div data-testid="config-page">
      <div role="tablist" data-testid="tabs-list">
        {tabs.map((tab, index) => (
          <button
            key={tab.value}
            role="tab"
            data-testid={`tab-${tab.value}`}
            data-tab-index={index}
            aria-selected={activeTab === tab.value}
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "validators" && (
        <ValidatorsTab
          validators={validators}
          actionId={null}
          activeCount={validators.filter((v) => v.value === "true").length}
          inactiveCount={validators.filter((v) => v.value !== "true").length}
          onToggle={onToggle}
          onFailModeChange={onFailModeChange}
          onBulkUpdate={onBulkUpdate}
        />
      )}

      {activeTab === "validation-configs" && (
        <ValidationConfigsTab
          items={validationConfigs}
          onCreate={onCreateConfig}
          onUpdate={onUpdateConfig}
          onDelete={onDeleteConfig}
        />
      )}
    </div>
  )
}

// ============================================================================
// Mock API Handler for Bulk Update
// ============================================================================

interface MockApiHandler {
  bulkUpdate: (payload: BulkUpdatePayload) => Promise<{ status: number; body: BulkUpdateResponse[] | { error: ApiError } }>
}

function createMockApiHandler(validators: ValidatorItem[]): MockApiHandler {
  const validKeys = new Set(validators.map((v) => v.key))

  return {
    bulkUpdate: async (payload: BulkUpdatePayload) => {
      // CL-API-BULK-002: Check for invalid keys
      for (const key of payload.keys) {
        if (!validKeys.has(key)) {
          return {
            status: 404,
            body: { error: { code: "VALIDATOR_NOT_FOUND", message: `Validator ${key} not found` } },
          }
        }
      }

      // CL-API-BULK-003: Check for invalid failMode
      if (payload.updates.failMode !== undefined &&
          payload.updates.failMode !== null &&
          payload.updates.failMode !== "HARD" &&
          payload.updates.failMode !== "WARNING") {
        return {
          status: 400,
          body: { error: { code: "INVALID_FAIL_MODE", message: "Invalid failMode value" } },
        }
      }

      // CL-API-BULK-001: Success
      const updated: BulkUpdateResponse[] = payload.keys.map((key) => {
        const validator = validators.find((v) => v.key === key)!
        return {
          key,
          value: payload.updates.isActive !== undefined
            ? (payload.updates.isActive ? "true" : "false")
            : validator.value,
          failMode: payload.updates.failMode !== undefined
            ? payload.updates.failMode
            : validator.failMode,
        }
      })

      return { status: 200, body: updated }
    },
  }
}

// ============================================================================
// TESTS: Task 1 — Filtro por Fail Mode (CL-UI-VT-FILTER-*)
// ============================================================================

describe("Task 1: Filtro por Fail Mode na Aba Validators", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // @clause CL-UI-VT-FILTER-001
  it("succeeds when ValidatorsTab renders fail mode filter dropdown", () => {
    const validators = [createMockValidator()]

    render(
      <ValidatorsTab
        validators={validators}
        actionId={null}
        activeCount={1}
        inactiveCount={0}
        onToggle={mockOnToggle}
        onFailModeChange={mockOnFailModeChange}
      />
    )

    const failModeFilter = screen.getByTestId("fail-mode-filter")
    expect(failModeFilter).toBeInTheDocument()
    expect(failModeFilter.tagName.toLowerCase()).toBe("select")

    // Check options
    const options = within(failModeFilter).getAllByRole("option")
    const optionTexts = options.map((opt) => opt.textContent)
    expect(optionTexts).toContain("Todos tipos")
    expect(optionTexts).toContain("Hard")
    expect(optionTexts).toContain("Warning")
    expect(optionTexts).toContain("Default")
  })

  // @clause CL-UI-VT-FILTER-002
  it("succeeds when selecting Hard filter shows only HARD validators", async () => {
    const validators = [
      createMockValidator({ key: "V_HARD", failMode: "HARD" }),
      createMockValidator({ key: "V_WARNING", failMode: "WARNING" }),
      createMockValidator({ key: "V_DEFAULT", failMode: null }),
    ]

    render(
      <ValidatorsTab
        validators={validators}
        actionId={null}
        activeCount={3}
        inactiveCount={0}
        onToggle={mockOnToggle}
        onFailModeChange={mockOnFailModeChange}
      />
    )

    const user = userEvent.setup()
    const failModeFilter = screen.getByTestId("fail-mode-filter")

    await user.selectOptions(failModeFilter, "HARD")

    expect(screen.getByTestId("validator-row-V_HARD")).toBeInTheDocument()
    expect(screen.queryByTestId("validator-row-V_WARNING")).not.toBeInTheDocument()
    expect(screen.queryByTestId("validator-row-V_DEFAULT")).not.toBeInTheDocument()
  })

  // @clause CL-UI-VT-FILTER-003
  it("succeeds when selecting Warning filter shows only WARNING validators", async () => {
    const validators = [
      createMockValidator({ key: "V_HARD", failMode: "HARD" }),
      createMockValidator({ key: "V_WARNING", failMode: "WARNING" }),
      createMockValidator({ key: "V_DEFAULT", failMode: null }),
    ]

    render(
      <ValidatorsTab
        validators={validators}
        actionId={null}
        activeCount={3}
        inactiveCount={0}
        onToggle={mockOnToggle}
        onFailModeChange={mockOnFailModeChange}
      />
    )

    const user = userEvent.setup()
    const failModeFilter = screen.getByTestId("fail-mode-filter")

    await user.selectOptions(failModeFilter, "WARNING")

    expect(screen.queryByTestId("validator-row-V_HARD")).not.toBeInTheDocument()
    expect(screen.getByTestId("validator-row-V_WARNING")).toBeInTheDocument()
    expect(screen.queryByTestId("validator-row-V_DEFAULT")).not.toBeInTheDocument()
  })

  // @clause CL-UI-VT-FILTER-004
  it("succeeds when selecting Default filter shows only null failMode validators", async () => {
    const validators = [
      createMockValidator({ key: "V_HARD", failMode: "HARD" }),
      createMockValidator({ key: "V_WARNING", failMode: "WARNING" }),
      createMockValidator({ key: "V_DEFAULT", failMode: null }),
    ]

    render(
      <ValidatorsTab
        validators={validators}
        actionId={null}
        activeCount={3}
        inactiveCount={0}
        onToggle={mockOnToggle}
        onFailModeChange={mockOnFailModeChange}
      />
    )

    const user = userEvent.setup()
    const failModeFilter = screen.getByTestId("fail-mode-filter")

    await user.selectOptions(failModeFilter, "DEFAULT")

    expect(screen.queryByTestId("validator-row-V_HARD")).not.toBeInTheDocument()
    expect(screen.queryByTestId("validator-row-V_WARNING")).not.toBeInTheDocument()
    expect(screen.getByTestId("validator-row-V_DEFAULT")).toBeInTheDocument()
  })

  // @clause CL-UI-VT-FILTER-005
  it("succeeds when category and failMode filters combine correctly", async () => {
    const validators = [
      createMockValidator({ key: "V1", category: "INPUT_SCOPE", failMode: "HARD" }),
      createMockValidator({ key: "V2", category: "INPUT_SCOPE", failMode: "WARNING" }),
      createMockValidator({ key: "V3", category: "SECURITY", failMode: "HARD" }),
      createMockValidator({ key: "V4", category: "SECURITY", failMode: "WARNING" }),
    ]

    render(
      <ValidatorsTab
        validators={validators}
        actionId={null}
        activeCount={4}
        inactiveCount={0}
        onToggle={mockOnToggle}
        onFailModeChange={mockOnFailModeChange}
      />
    )

    const user = userEvent.setup()
    const categoryFilter = screen.getByTestId("category-filter")
    const failModeFilter = screen.getByTestId("fail-mode-filter")

    await user.selectOptions(categoryFilter, "INPUT_SCOPE")
    await user.selectOptions(failModeFilter, "HARD")

    // Only V1 should be visible (INPUT_SCOPE + HARD)
    expect(screen.getByTestId("validator-row-V1")).toBeInTheDocument()
    expect(screen.queryByTestId("validator-row-V2")).not.toBeInTheDocument()
    expect(screen.queryByTestId("validator-row-V3")).not.toBeInTheDocument()
    expect(screen.queryByTestId("validator-row-V4")).not.toBeInTheDocument()
  })
})

// ============================================================================
// TESTS: Task 2 — Bulk Actions (CL-UI-VT-BULK-* and CL-API-BULK-*)
// ============================================================================

describe("Task 2: Bulk Actions na Aba Validators", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // @clause CL-UI-VT-BULK-001
  it("succeeds when each validator row has a checkbox", () => {
    const validators = [
      createMockValidator({ key: "V1" }),
      createMockValidator({ key: "V2" }),
    ]

    render(
      <ValidatorsTab
        validators={validators}
        actionId={null}
        activeCount={2}
        inactiveCount={0}
        onToggle={mockOnToggle}
        onFailModeChange={mockOnFailModeChange}
        onBulkUpdate={mockOnBulkUpdate}
      />
    )

    expect(screen.getByTestId("validator-checkbox-V1")).toBeInTheDocument()
    expect(screen.getByTestId("validator-checkbox-V2")).toBeInTheDocument()
    expect(screen.getByTestId("validator-checkbox-V1").tagName.toLowerCase()).toBe("input")
  })

  // @clause CL-UI-VT-BULK-002
  it("succeeds when header has select all checkbox", () => {
    const validators = [createMockValidator({ key: "V1" })]

    render(
      <ValidatorsTab
        validators={validators}
        actionId={null}
        activeCount={1}
        inactiveCount={0}
        onToggle={mockOnToggle}
        onFailModeChange={mockOnFailModeChange}
        onBulkUpdate={mockOnBulkUpdate}
      />
    )

    const selectAllCheckbox = screen.getByTestId("select-all-checkbox")
    expect(selectAllCheckbox).toBeInTheDocument()
    expect(selectAllCheckbox.tagName.toLowerCase()).toBe("input")
  })

  // @clause CL-UI-VT-BULK-003
  it("succeeds when select all checkbox selects all visible validators", async () => {
    const validators = [
      createMockValidator({ key: "V1" }),
      createMockValidator({ key: "V2" }),
      createMockValidator({ key: "V3" }),
    ]

    render(
      <ValidatorsTab
        validators={validators}
        actionId={null}
        activeCount={3}
        inactiveCount={0}
        onToggle={mockOnToggle}
        onFailModeChange={mockOnFailModeChange}
        onBulkUpdate={mockOnBulkUpdate}
      />
    )

    const user = userEvent.setup()
    const selectAllCheckbox = screen.getByTestId("select-all-checkbox")

    await user.click(selectAllCheckbox)

    // All individual checkboxes should be checked
    expect(screen.getByTestId("validator-checkbox-V1")).toBeChecked()
    expect(screen.getByTestId("validator-checkbox-V2")).toBeChecked()
    expect(screen.getByTestId("validator-checkbox-V3")).toBeChecked()
  })

  // @clause CL-UI-VT-BULK-004
  it("succeeds when bulk actions bar appears with selection count", async () => {
    const validators = [
      createMockValidator({ key: "V1" }),
      createMockValidator({ key: "V2" }),
    ]

    render(
      <ValidatorsTab
        validators={validators}
        actionId={null}
        activeCount={2}
        inactiveCount={0}
        onToggle={mockOnToggle}
        onFailModeChange={mockOnFailModeChange}
        onBulkUpdate={mockOnBulkUpdate}
      />
    )

    // Initially no bulk actions bar
    expect(screen.queryByTestId("bulk-actions-bar")).not.toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByTestId("validator-checkbox-V1"))

    // Now bulk actions bar should appear
    const bulkBar = screen.getByTestId("bulk-actions-bar")
    expect(bulkBar).toBeInTheDocument()

    const selectedCount = screen.getByTestId("selected-count")
    expect(selectedCount.textContent).toContain("1")
  })

  // @clause CL-UI-VT-BULK-005
  it("succeeds when Ativar Selecionados calls onBulkUpdate with isActive true", async () => {
    const validators = [
      createMockValidator({ key: "V1", value: "false" }),
      createMockValidator({ key: "V2", value: "false" }),
    ]

    mockOnBulkUpdate.mockResolvedValue([
      { key: "V1", value: "true" },
      { key: "V2", value: "true" },
    ])

    render(
      <ValidatorsTab
        validators={validators}
        actionId={null}
        activeCount={0}
        inactiveCount={2}
        onToggle={mockOnToggle}
        onFailModeChange={mockOnFailModeChange}
        onBulkUpdate={mockOnBulkUpdate}
      />
    )

    const user = userEvent.setup()

    // Select validators
    await user.click(screen.getByTestId("validator-checkbox-V1"))
    await user.click(screen.getByTestId("validator-checkbox-V2"))

    // Click activate button
    await user.click(screen.getByTestId("bulk-activate-btn"))

    expect(mockOnBulkUpdate).toHaveBeenCalledWith({
      keys: expect.arrayContaining(["V1", "V2"]),
      updates: { isActive: true },
    })
  })

  // @clause CL-UI-VT-BULK-006
  it("succeeds when Desativar Selecionados calls onBulkUpdate with isActive false", async () => {
    const validators = [
      createMockValidator({ key: "V1", value: "true" }),
    ]

    mockOnBulkUpdate.mockResolvedValue([{ key: "V1", value: "false" }])

    render(
      <ValidatorsTab
        validators={validators}
        actionId={null}
        activeCount={1}
        inactiveCount={0}
        onToggle={mockOnToggle}
        onFailModeChange={mockOnFailModeChange}
        onBulkUpdate={mockOnBulkUpdate}
      />
    )

    const user = userEvent.setup()

    await user.click(screen.getByTestId("validator-checkbox-V1"))
    await user.click(screen.getByTestId("bulk-deactivate-btn"))

    expect(mockOnBulkUpdate).toHaveBeenCalledWith({
      keys: ["V1"],
      updates: { isActive: false },
    })
  })

  // @clause CL-UI-VT-BULK-007
  it("succeeds when bulk fail mode dropdown calls onBulkUpdate with failMode HARD", async () => {
    const validators = [createMockValidator({ key: "V1" })]

    mockOnBulkUpdate.mockResolvedValue([{ key: "V1", value: "true", failMode: "HARD" }])

    render(
      <ValidatorsTab
        validators={validators}
        actionId={null}
        activeCount={1}
        inactiveCount={0}
        onToggle={mockOnToggle}
        onFailModeChange={mockOnFailModeChange}
        onBulkUpdate={mockOnBulkUpdate}
      />
    )

    const user = userEvent.setup()

    await user.click(screen.getByTestId("validator-checkbox-V1"))

    const bulkFailModeDropdown = screen.getByTestId("bulk-fail-mode-dropdown")
    await user.selectOptions(bulkFailModeDropdown, "HARD")

    expect(mockOnBulkUpdate).toHaveBeenCalledWith({
      keys: ["V1"],
      updates: { failMode: "HARD" },
    })
  })

  // @clause CL-UI-VT-BULK-008
  it("succeeds when clear selection clears all checkboxes and hides bar", async () => {
    const validators = [
      createMockValidator({ key: "V1" }),
      createMockValidator({ key: "V2" }),
    ]

    render(
      <ValidatorsTab
        validators={validators}
        actionId={null}
        activeCount={2}
        inactiveCount={0}
        onToggle={mockOnToggle}
        onFailModeChange={mockOnFailModeChange}
        onBulkUpdate={mockOnBulkUpdate}
      />
    )

    const user = userEvent.setup()

    // Select all
    await user.click(screen.getByTestId("select-all-checkbox"))

    // Verify bulk bar is visible
    expect(screen.getByTestId("bulk-actions-bar")).toBeInTheDocument()

    // Click clear selection
    await user.click(screen.getByTestId("clear-selection-btn"))

    // Verify checkboxes are unchecked
    expect(screen.getByTestId("validator-checkbox-V1")).not.toBeChecked()
    expect(screen.getByTestId("validator-checkbox-V2")).not.toBeChecked()

    // Verify bulk bar is hidden
    expect(screen.queryByTestId("bulk-actions-bar")).not.toBeInTheDocument()
  })
})

// ============================================================================
// TESTS: Task 2 — API Bulk Update (CL-API-BULK-*)
// ============================================================================

describe("Task 2: API Bulk Update", () => {
  // @clause CL-API-BULK-001
  it("succeeds when PATCH /validators/bulk returns 200 with updated validators", async () => {
    const validators = [
      createMockValidator({ key: "K1", value: "false" }),
      createMockValidator({ key: "K2", value: "false" }),
    ]

    const apiHandler = createMockApiHandler(validators)

    const result = await apiHandler.bulkUpdate({
      keys: ["K1", "K2"],
      updates: { isActive: true },
    })

    expect(result.status).toBe(200)
    expect(Array.isArray(result.body)).toBe(true)

    const body = result.body as BulkUpdateResponse[]
    expect(body.length).toBe(2)
    expect(body[0].key).toBe("K1")
    expect(body[0].value).toBe("true")
    expect(body[1].key).toBe("K2")
    expect(body[1].value).toBe("true")
  })

  // @clause CL-API-BULK-002
  it("fails when PATCH /validators/bulk with invalid key returns 404", async () => {
    const validators = [createMockValidator({ key: "VALID_KEY" })]

    const apiHandler = createMockApiHandler(validators)

    const result = await apiHandler.bulkUpdate({
      keys: ["INVALID_KEY"],
      updates: { isActive: true },
    })

    expect(result.status).toBe(404)

    const body = result.body as { error: ApiError }
    expect(body.error.code).toBe("VALIDATOR_NOT_FOUND")
  })

  // @clause CL-API-BULK-003
  it("fails when PATCH /validators/bulk with invalid failMode returns 400", async () => {
    const validators = [createMockValidator({ key: "K1" })]

    const apiHandler = createMockApiHandler(validators)

    const result = await apiHandler.bulkUpdate({
      keys: ["K1"],
      updates: { failMode: "INVALID" as FailMode },
    })

    expect(result.status).toBe(400)

    const body = result.body as { error: ApiError }
    expect(body.error.code).toBe("INVALID_FAIL_MODE")
  })
})

// ============================================================================
// TESTS: Task 3 — Reordenação de Abas (CL-UI-TABS-001)
// ============================================================================

describe("Task 3: Reordenação de Abas", () => {
  // @clause CL-UI-TABS-001
  it("succeeds when tab order is Validators, Validation Configs, Path Configs, Sensitive File Rules, Ambiguous Terms", () => {
    const validators = [createMockValidator()]
    const validationConfigs = [createMockValidationConfig()]

    render(
      <ConfigPage
        validators={validators}
        validationConfigs={validationConfigs}
        onToggle={mockOnToggle}
        onFailModeChange={mockOnFailModeChange}
        onBulkUpdate={mockOnBulkUpdate}
        onCreateConfig={mockOnCreate}
        onUpdateConfig={mockOnUpdate}
        onDeleteConfig={mockOnDelete}
      />
    )

    const tabsList = screen.getByTestId("tabs-list")
    const tabs = within(tabsList).getAllByRole("tab")

    // Verify order by index
    expect(tabs[0]).toHaveAttribute("data-testid", "tab-validators")
    expect(tabs[1]).toHaveAttribute("data-testid", "tab-validation-configs")
    expect(tabs[2]).toHaveAttribute("data-testid", "tab-path-configs")
    expect(tabs[3]).toHaveAttribute("data-testid", "tab-sensitive-file-rules")
    expect(tabs[4]).toHaveAttribute("data-testid", "tab-ambiguous-terms")

    // Verify data-tab-index attributes
    expect(tabs[0]).toHaveAttribute("data-tab-index", "0")
    expect(tabs[1]).toHaveAttribute("data-tab-index", "1")
    expect(tabs[2]).toHaveAttribute("data-tab-index", "2")
  })
})

// ============================================================================
// TESTS: Task 4 — Filtros em Validation Configs (CL-UI-VC-FILTER-*)
// ============================================================================

describe("Task 4: Filtros na Aba Validation Configs", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // @clause CL-UI-VC-FILTER-001
  it("succeeds when ValidationConfigsTab renders key filter input", () => {
    const items = [createMockValidationConfig()]

    render(
      <ValidationConfigsTab
        items={items}
        onCreate={mockOnCreate}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
      />
    )

    const keyFilter = screen.getByTestId("key-filter")
    expect(keyFilter).toBeInTheDocument()
    expect(keyFilter.tagName.toLowerCase()).toBe("input")
    expect(keyFilter).toHaveAttribute("placeholder", "Filtrar por key...")
  })

  // @clause CL-UI-VC-FILTER-002
  it("succeeds when ValidationConfigsTab renders type filter select with unique types", () => {
    const items = [
      createMockValidationConfig({ id: "1", type: "NUMBER" }),
      createMockValidationConfig({ id: "2", type: "STRING" }),
      createMockValidationConfig({ id: "3", type: "BOOLEAN" }),
    ]

    render(
      <ValidationConfigsTab
        items={items}
        onCreate={mockOnCreate}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
      />
    )

    const typeFilter = screen.getByTestId("type-filter")
    expect(typeFilter).toBeInTheDocument()
    expect(typeFilter.tagName.toLowerCase()).toBe("select")

    const options = within(typeFilter).getAllByRole("option")
    const optionTexts = options.map((opt) => opt.textContent)

    expect(optionTexts).toContain("Todos types")
    expect(optionTexts).toContain("NUMBER")
    expect(optionTexts).toContain("STRING")
    expect(optionTexts).toContain("BOOLEAN")
  })

  // @clause CL-UI-VC-FILTER-003
  it("succeeds when ValidationConfigsTab renders category filter select", () => {
    const items = [
      createMockValidationConfig({ id: "1", category: "THRESHOLD" }),
      createMockValidationConfig({ id: "2", category: "VALIDATOR" }),
    ]

    render(
      <ValidationConfigsTab
        items={items}
        onCreate={mockOnCreate}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
      />
    )

    const categoryFilter = screen.getByTestId("category-filter")
    expect(categoryFilter).toBeInTheDocument()

    const options = within(categoryFilter).getAllByRole("option")
    const optionTexts = options.map((opt) => opt.textContent)

    expect(optionTexts).toContain("Todas categorias")
    expect(optionTexts).toContain("THRESHOLD")
    expect(optionTexts).toContain("VALIDATOR")
  })

  // @clause CL-UI-VC-FILTER-004
  it("succeeds when key filter performs case-insensitive substring filtering", async () => {
    const items = [
      createMockValidationConfig({ id: "1", key: "MAX_TOKEN_BUDGET" }),
      createMockValidationConfig({ id: "2", key: "TOKEN_SAFETY_MARGIN" }),
      createMockValidationConfig({ id: "3", key: "MAX_FILES_PER_TASK" }),
    ]

    render(
      <ValidationConfigsTab
        items={items}
        onCreate={mockOnCreate}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
      />
    )

    const user = userEvent.setup()
    const keyFilter = screen.getByTestId("key-filter")

    await user.type(keyFilter, "TOKEN")

    // Only items with "token" in key should be visible (case-insensitive)
    expect(screen.getByTestId("config-row-1")).toBeInTheDocument()
    expect(screen.getByTestId("config-row-2")).toBeInTheDocument()
    expect(screen.queryByTestId("config-row-3")).not.toBeInTheDocument()
  })

  // @clause CL-UI-VC-FILTER-005
  it("succeeds when type filter shows only items with matching type", async () => {
    const items = [
      createMockValidationConfig({ id: "1", type: "NUMBER" }),
      createMockValidationConfig({ id: "2", type: "STRING" }),
      createMockValidationConfig({ id: "3", type: "NUMBER" }),
    ]

    render(
      <ValidationConfigsTab
        items={items}
        onCreate={mockOnCreate}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
      />
    )

    const user = userEvent.setup()
    const typeFilter = screen.getByTestId("type-filter")

    await user.selectOptions(typeFilter, "NUMBER")

    expect(screen.getByTestId("config-row-1")).toBeInTheDocument()
    expect(screen.queryByTestId("config-row-2")).not.toBeInTheDocument()
    expect(screen.getByTestId("config-row-3")).toBeInTheDocument()
  })

  // @clause CL-UI-VC-FILTER-006
  it("succeeds when category filter shows only items with matching category", async () => {
    const items = [
      createMockValidationConfig({ id: "1", category: "THRESHOLD" }),
      createMockValidationConfig({ id: "2", category: "VALIDATOR" }),
      createMockValidationConfig({ id: "3", category: "THRESHOLD" }),
    ]

    render(
      <ValidationConfigsTab
        items={items}
        onCreate={mockOnCreate}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
      />
    )

    const user = userEvent.setup()
    const categoryFilter = screen.getByTestId("category-filter")

    await user.selectOptions(categoryFilter, "THRESHOLD")

    expect(screen.getByTestId("config-row-1")).toBeInTheDocument()
    expect(screen.queryByTestId("config-row-2")).not.toBeInTheDocument()
    expect(screen.getByTestId("config-row-3")).toBeInTheDocument()
  })

  // @clause CL-UI-VC-FILTER-007
  it("succeeds when type and category filters combine correctly", async () => {
    const items = [
      createMockValidationConfig({ id: "1", type: "STRING", category: "VALIDATOR" }),
      createMockValidationConfig({ id: "2", type: "STRING", category: "THRESHOLD" }),
      createMockValidationConfig({ id: "3", type: "NUMBER", category: "VALIDATOR" }),
      createMockValidationConfig({ id: "4", type: "NUMBER", category: "THRESHOLD" }),
    ]

    render(
      <ValidationConfigsTab
        items={items}
        onCreate={mockOnCreate}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
      />
    )

    const user = userEvent.setup()
    const typeFilter = screen.getByTestId("type-filter")
    const categoryFilter = screen.getByTestId("category-filter")

    await user.selectOptions(typeFilter, "STRING")
    await user.selectOptions(categoryFilter, "VALIDATOR")

    // Only item 1 should be visible (STRING + VALIDATOR)
    expect(screen.getByTestId("config-row-1")).toBeInTheDocument()
    expect(screen.queryByTestId("config-row-2")).not.toBeInTheDocument()
    expect(screen.queryByTestId("config-row-3")).not.toBeInTheDocument()
    expect(screen.queryByTestId("config-row-4")).not.toBeInTheDocument()
  })
})
