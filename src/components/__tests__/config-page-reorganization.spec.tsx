import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as fs from "node:fs"
import * as path from "node:path"

/**
 * Config Page Reorganization — 5 tabs → 4 tabs centradas no validator
 * ====================================================================
 *
 * Contract: config-page-reorganization v1.0
 * Mode: STRICT
 * Criticality: HIGH
 * changeType: refactor
 *
 * 28 cláusulas cobertas:
 *
 * Tab Structure:
 *   CL-UI-CFG-001  — Config page renderiza 4 tabs
 *   CL-UI-CFG-002  — Tab default é Validators
 *
 * Validators Tab — Gate Sections:
 *   CL-UI-VAL-001  — 4 seções de gate renderizadas
 *   CL-UI-VAL-002  — Seções de gate são colapsáveis
 *   CL-UI-VAL-003  — Gate header mostra contador ativos/total
 *
 * Validators Tab — Validator Row:
 *   CL-UI-VAL-004  — Cada validator tem Switch toggle
 *   CL-UI-VAL-005  — Switch toggle chama onToggle
 *   CL-UI-VAL-006  — Fail mode popover preservado
 *   CL-UI-VAL-007  — Validators com config mostram botão ⚙️
 *   CL-UI-VAL-008  — Validators sem config NÃO mostram botão ⚙️
 *
 * Validators Tab — Config Dialog:
 *   CL-UI-VAL-009  — Dialog TOKEN_BUDGET_FIT
 *   CL-UI-VAL-010  — Dialog DIFF_SCOPE_ENFORCEMENT
 *   CL-UI-VAL-011  — Comma-separated values como tag badges
 *   CL-UI-VAL-012  — Save no dialog persiste
 *
 * Validators Tab — Badges Especiais:
 *   CL-UI-VAL-013  — Badge PÉTREA e Switch disabled
 *   CL-UI-VAL-014  — Badge "ref" para validators com tabelas
 *
 * Validators Tab — Features Removidas:
 *   CL-UI-VAL-015  — Sem bulk actions
 *   CL-UI-VAL-016  — Sem filtros dropdown
 *
 * Security Rules Tab:
 *   CL-UI-SEC-001  — Seção Sensitive File Patterns
 *   CL-UI-SEC-002  — Seção Ambiguous Terms Detection
 *   CL-UI-SEC-003  — CRUD preservado
 *
 * Conventions Tab:
 *   CL-UI-CONV-001 — Seção Test Path Conventions
 *   CL-UI-CONV-002 — Seção System Paths (somente leitura parcial)
 *
 * Advanced Tab:
 *   CL-UI-ADV-001  — Global Flags com ALLOW_SOFT_GATES
 *   CL-UI-ADV-002  — Timeouts com 4 inputs numéricos
 *   CL-UI-ADV-003  — All Configs debug view read-only
 *   CL-UI-ADV-004  — Coverage Audit
 *
 * Refactor Invariants:
 *   CL-REFACTOR-001 — validation-configs-tab.tsx removido
 *
 * REGRA TDD: Estes testes DEVEM falhar antes da implementação (red phase).
 * Testes de componentes novos falham porque os arquivos não existem.
 * Testes de remoção de código legado falham porque o código ainda está presente.
 */

// ============================================================================
// Real Component Imports (TDD: new files will cause compilation failure)
// ============================================================================

import { ConfigPage } from "@/components/config-page"
import { ValidatorsTab } from "@/components/validators-tab"
import { SecurityRulesTab } from "@/components/security-rules-tab"
import { AdvancedTab } from "@/components/advanced-tab"
import { ValidatorConfigDialog } from "@/components/validator-config-dialog"

// ============================================================================
// API & External Module Mocks
// ============================================================================

vi.mock("@/lib/api", () => ({
  api: {
    validators: {
      list: vi.fn(),
      update: vi.fn(),
      bulkUpdate: vi.fn(),
    },
    configTables: {
      validationConfigs: {
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      sensitiveFileRules: {
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      ambiguousTerms: {
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      testPaths: {
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    },
  },
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

import { api } from "@/lib/api"
import type { FailMode } from "@/lib/types"

// ============================================================================
// Type Definitions (matching real project types)
// ============================================================================

interface ValidatorItem {
  id: string
  key: string
  value: string
  type: "STRING" | "NUMBER" | "BOOLEAN"
  category: string
  description: string
  failMode?: FailMode
  gateCategory?: string
  displayName?: string
  gate?: number
  order?: number
  isHardBlock?: boolean
}

interface ValidationConfigItem {
  id: string
  key: string
  value: string
  type: string
  category: string
  description?: string | null
}

interface SensitiveFileRule {
  id: string
  pattern: string
  category: string
  severity: string
  description?: string | null
  isActive: boolean
}

interface AmbiguousTerm {
  id: string
  term: string
  category: string
  suggestion?: string | null
  isActive: boolean
}

interface TestPathConvention {
  id: string
  testType: string
  pathPattern: string
  description?: string | null
  isActive: boolean
}

// ============================================================================
// Typed Mock Accessors
// ============================================================================

const mockValidatorsList = api.validators.list as ReturnType<typeof vi.fn>
const mockValidatorsUpdate = api.validators.update as ReturnType<typeof vi.fn>
const mockConfigsList = (api.configTables.validationConfigs.list) as ReturnType<typeof vi.fn>
const mockConfigsUpdate = (api.configTables.validationConfigs.update) as ReturnType<typeof vi.fn>
const mockSensitiveList = (api.configTables.sensitiveFileRules.list) as ReturnType<typeof vi.fn>
const mockSensitiveCreate = (api.configTables.sensitiveFileRules.create) as ReturnType<typeof vi.fn>
const mockSensitiveUpdate = (api.configTables.sensitiveFileRules.update) as ReturnType<typeof vi.fn>
const mockSensitiveDelete = (api.configTables.sensitiveFileRules.delete) as ReturnType<typeof vi.fn>
const mockAmbiguousList = (api.configTables.ambiguousTerms.list) as ReturnType<typeof vi.fn>
const mockAmbiguousCreate = (api.configTables.ambiguousTerms.create) as ReturnType<typeof vi.fn>
const mockAmbiguousUpdate = (api.configTables.ambiguousTerms.update) as ReturnType<typeof vi.fn>
const mockAmbiguousDelete = (api.configTables.ambiguousTerms.delete) as ReturnType<typeof vi.fn>
const mockTestPathsList = (api.configTables.testPaths.list) as ReturnType<typeof vi.fn>

// ============================================================================
// Mock Callback Functions
// ============================================================================

const mockOnToggle = vi.fn<[string, boolean], void | Promise<void>>()
const mockOnFailModeChange = vi.fn<[string, FailMode], void | Promise<void>>()
const mockOnUpdateConfig = vi.fn<[string, string], void | Promise<void>>()
const mockOnCreateSensitiveRule = vi.fn<[Partial<SensitiveFileRule>], Promise<void>>()
const mockOnUpdateSensitiveRule = vi.fn<[string, Partial<SensitiveFileRule>], Promise<void>>()
const mockOnDeleteSensitiveRule = vi.fn<[string], Promise<void>>()
const mockOnCreateAmbiguousTerm = vi.fn<[Partial<AmbiguousTerm>], Promise<void>>()
const mockOnUpdateAmbiguousTerm = vi.fn<[string, Partial<AmbiguousTerm>], Promise<void>>()
const mockOnDeleteAmbiguousTerm = vi.fn<[string], Promise<void>>()

// ============================================================================
// Fixture Factories
// ============================================================================

function createValidator(overrides: Partial<ValidatorItem> = {}): ValidatorItem {
  return {
    id: `val-${overrides.key ?? "UNKNOWN"}`,
    key: "UNKNOWN_VALIDATOR",
    value: "true",
    type: "BOOLEAN",
    category: "INPUT_SCOPE",
    description: "A test validator",
    failMode: null,
    gate: 0,
    order: 0,
    isHardBlock: false,
    displayName: overrides.key ?? "Unknown Validator",
    ...overrides,
  }
}

function createValidationConfig(overrides: Partial<ValidationConfigItem> = {}): ValidationConfigItem {
  return {
    id: `cfg-${overrides.key ?? "UNKNOWN"}`,
    key: "UNKNOWN_CONFIG",
    value: "0",
    type: "NUMBER",
    category: "GATE0",
    description: "A test config",
    ...overrides,
  }
}

function createSensitiveFileRule(overrides: Partial<SensitiveFileRule> = {}): SensitiveFileRule {
  return {
    id: `sfr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    pattern: "*.env",
    category: "CREDENTIALS",
    severity: "HIGH",
    description: "Environment files",
    isActive: true,
    ...overrides,
  }
}

function createAmbiguousTerm(overrides: Partial<AmbiguousTerm> = {}): AmbiguousTerm {
  return {
    id: `at-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    term: "maybe",
    category: "VAGUE",
    suggestion: "Use precise language",
    isActive: true,
    ...overrides,
  }
}

function createTestPath(overrides: Partial<TestPathConvention> = {}): TestPathConvention {
  return {
    id: `tp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    testType: "spec",
    pathPattern: "src/**/*.spec.tsx",
    description: "Spec test files",
    isActive: true,
    ...overrides,
  }
}

// ============================================================================
// Fixture Data — 27 Validators across 4 Gates
// ============================================================================

// Gate 0 — SANITIZATION 🧹 (7 validators, 5 active)
const gate0Validators: ValidatorItem[] = [
  createValidator({ key: "TOKEN_BUDGET_FIT", displayName: "Token Budget Fit", gate: 0, order: 0, category: "INPUT_SCOPE", description: "Verifica se o contexto cabe no budget de tokens", value: "true", failMode: "HARD" }),
  createValidator({ key: "TASK_SCOPE_SIZE", displayName: "Task Scope Size", gate: 0, order: 1, category: "INPUT_SCOPE", description: "Verifica o tamanho do escopo da tarefa", value: "true" }),
  createValidator({ key: "TASK_CLARITY_CHECK", displayName: "Task Clarity Check", gate: 0, order: 2, category: "INPUT_SCOPE", description: "Verifica clareza e ausência de termos ambíguos", value: "true" }),
  createValidator({ key: "SENSITIVE_FILES_LOCK", displayName: "Sensitive Files Lock", gate: 0, order: 3, category: "SECURITY", description: "Bloqueia modificação de arquivos sensíveis", value: "true" }),
  createValidator({ key: "DANGER_MODE_EXPLICIT", displayName: "Danger Mode Explicit", gate: 0, order: 4, category: "SECURITY", description: "Exige modo danger explícito para ações críticas", value: "true" }),
  createValidator({ key: "PATH_CONVENTION", displayName: "Path Convention", gate: 0, order: 5, category: "FILE_DISCIPLINE", description: "Verifica convenções de path", value: "false" }),
  createValidator({ key: "DELETE_DEPENDENCY_CHECK", displayName: "Delete Dependency Check", gate: 0, order: 6, category: "FILE_DISCIPLINE", description: "Verifica dependências antes de deletar", value: "false" }),
]

// Gate 1 — CONTRACT 📜 (11 validators, 10 active)
const gate1Validators: ValidatorItem[] = [
  createValidator({ key: "TEST_SYNTAX_VALID", displayName: "Test Syntax Valid", gate: 1, order: 0, category: "TESTS_CONTRACTS", description: "Verifica sintaxe do teste", value: "true" }),
  createValidator({ key: "TEST_HAS_ASSERTIONS", displayName: "Test Has Assertions", gate: 1, order: 1, category: "TESTS_CONTRACTS", description: "Verifica presença de assertions", value: "true" }),
  createValidator({ key: "TEST_COVERS_HAPPY_AND_SAD_PATH", displayName: "Test Covers Happy and Sad Path", gate: 1, order: 2, category: "TESTS_CONTRACTS", description: "Verifica cobertura de happy e sad path", value: "true" }),
  createValidator({ key: "TEST_FAILS_BEFORE_IMPLEMENTATION", displayName: "Test Fails Before Implementation", gate: 1, order: 3, category: "TESTS_CONTRACTS", description: "CLÁUSULA PÉTREA — Testes devem falhar antes da implementação", value: "true", isHardBlock: true }),
  createValidator({ key: "NO_DECORATIVE_TESTS", displayName: "No Decorative Tests", gate: 1, order: 4, category: "TESTS_CONTRACTS", description: "Proíbe testes decorativos", value: "true" }),
  createValidator({ key: "TEST_RESILIENCE_CHECK", displayName: "Test Resilience Check", gate: 1, order: 5, category: "TESTS_CONTRACTS", description: "Verifica resiliência dos testes", value: "true" }),
  createValidator({ key: "MANIFEST_FILE_LOCK", displayName: "Manifest File Lock", gate: 1, order: 6, category: "FILE_DISCIPLINE", description: "Verifica integridade do manifest", value: "true" }),
  createValidator({ key: "NO_IMPLICIT_FILES", displayName: "No Implicit Files", gate: 1, order: 7, category: "FILE_DISCIPLINE", description: "Proíbe arquivos implícitos", value: "true" }),
  createValidator({ key: "IMPORT_REALITY_CHECK", displayName: "Import Reality Check", gate: 1, order: 8, category: "TECHNICAL_QUALITY", description: "Verifica realidade dos imports", value: "true" }),
  createValidator({ key: "TEST_INTENT_ALIGNMENT", displayName: "Test Intent Alignment", gate: 1, order: 9, category: "TESTS_CONTRACTS", description: "Alinhamento de intenção dos testes", value: "true" }),
  createValidator({ key: "TEST_CLAUSE_MAPPING_VALID", displayName: "Test Clause Mapping Valid", gate: 1, order: 10, category: "TESTS_CONTRACTS", description: "Verifica mapeamento de cláusulas nos testes", value: "false" }),
]

// Gate 2 — EXECUTION ⚙️ (7 validators, 6 active)
const gate2Validators: ValidatorItem[] = [
  createValidator({ key: "DIFF_SCOPE_ENFORCEMENT", displayName: "Diff Scope Enforcement", gate: 2, order: 0, category: "TECHNICAL_QUALITY", description: "Enforcement de escopo do diff", value: "true" }),
  createValidator({ key: "TEST_READ_ONLY_ENFORCEMENT", displayName: "Test Read Only Enforcement", gate: 2, order: 1, category: "TECHNICAL_QUALITY", description: "Enforcement de leitura somente", value: "true" }),
  createValidator({ key: "UI_COMPONENT_REGISTRY", displayName: "UI Component Registry", gate: 2, order: 2, category: "TECHNICAL_QUALITY", description: "Registro de componentes UI", value: "true" }),
  createValidator({ key: "UI_PROPS_COMPLIANCE", displayName: "UI Props Compliance", gate: 2, order: 3, category: "TECHNICAL_QUALITY", description: "Conformidade de props UI", value: "true" }),
  createValidator({ key: "TASK_TEST_PASSES", displayName: "Task Test Passes", gate: 2, order: 4, category: "TECHNICAL_QUALITY", description: "Testes da tarefa passam", value: "true" }),
  createValidator({ key: "STRICT_COMPILATION", displayName: "Strict Compilation", gate: 2, order: 5, category: "TECHNICAL_QUALITY", description: "Compilação estrita", value: "true" }),
  createValidator({ key: "STYLE_CONSISTENCY_LINT", displayName: "Style Consistency Lint", gate: 2, order: 6, category: "TECHNICAL_QUALITY", description: "Consistência de estilo via lint", value: "false" }),
]

// Gate 3 — INTEGRITY 🏗️ (2 validators, 1 active)
const gate3Validators: ValidatorItem[] = [
  createValidator({ key: "FULL_REGRESSION_PASS", displayName: "Full Regression Pass", gate: 3, order: 0, category: "TECHNICAL_QUALITY", description: "Regressão completa passa", value: "true" }),
  createValidator({ key: "PRODUCTION_BUILD_PASS", displayName: "Production Build Pass", gate: 3, order: 1, category: "TECHNICAL_QUALITY", description: "Build de produção passa", value: "false" }),
]

const allValidators: ValidatorItem[] = [
  ...gate0Validators,
  ...gate1Validators,
  ...gate2Validators,
  ...gate3Validators,
]

// ============================================================================
// Fixture Data — Validation Configs (for validator dialogs)
// ============================================================================

const validationConfigFixtures: ValidationConfigItem[] = [
  // TOKEN_BUDGET_FIT configs
  createValidationConfig({ key: "MAX_TOKEN_BUDGET", value: "100000", type: "NUMBER", category: "GATE0", description: "Máximo de tokens permitidos" }),
  createValidationConfig({ key: "TOKEN_SAFETY_MARGIN", value: "0.8", type: "NUMBER", category: "GATE0", description: "Margem de segurança para tokens" }),
  // TASK_SCOPE_SIZE configs
  createValidationConfig({ key: "MAX_FILES_PER_TASK", value: "15", type: "NUMBER", category: "GATE0", description: "Máximo de arquivos por tarefa" }),
  // PATH_CONVENTION configs
  createValidationConfig({ key: "TYPE_DETECTION_PATTERNS", value: "*.spec.tsx,*.spec.ts,*.test.tsx", type: "STRING", category: "GATE0", description: "Padrões de detecção de tipo" }),
  // DELETE_DEPENDENCY_CHECK configs
  createValidationConfig({ key: "DELETE_CHECK_IGNORE_DIRS", value: "node_modules,dist,.git", type: "STRING", category: "GATE0", description: "Diretórios ignorados na verificação de dependências" }),
  // TEST_COVERS_HAPPY_AND_SAD_PATH configs
  createValidationConfig({ key: "HAPPY_PATH_KEYWORDS", value: "deve,should,espera,succeeds,passes", type: "STRING", category: "GATE1", description: "Keywords que indicam happy path" }),
  createValidationConfig({ key: "SAD_PATH_KEYWORDS", value: "error,fail,throws,invalid,rejects", type: "STRING", category: "GATE1", description: "Keywords que indicam sad path" }),
  // IMPORT_REALITY_CHECK configs
  createValidationConfig({ key: "EXTRA_BUILTIN_MODULES", value: "node:fs,node:path,node:url", type: "STRING", category: "GATE1", description: "Módulos builtin extra" }),
  createValidationConfig({ key: "PATH_ALIASES", value: "@/,~/", type: "STRING", category: "GATE1", description: "Aliases de path" }),
  // DIFF_SCOPE_ENFORCEMENT configs
  createValidationConfig({ key: "DIFF_SCOPE_INCLUDE_WORKING_TREE", value: "true", type: "BOOLEAN", category: "VALIDATOR", description: "Incluir working tree no diff" }),
  createValidationConfig({ key: "DIFF_SCOPE_IGNORED_PATTERNS", value: "*.lock,*.snap,dist/**", type: "STRING", category: "GATE2", description: "Padrões ignorados no diff" }),
  createValidationConfig({ key: "DIFF_SCOPE_ALLOW_TEST_ONLY_DIFF", value: "false", type: "BOOLEAN", category: "GATE2", description: "Permitir diff somente de testes" }),
  createValidationConfig({ key: "DIFF_SCOPE_INCOMPLETE_FAIL_MODE", value: "WARNING", type: "STRING", category: "GATE2", description: "Fail mode para diff incompleto" }),
  // TEST_READ_ONLY_ENFORCEMENT configs
  createValidationConfig({ key: "TEST_READ_ONLY_EXCLUDED_PATHS", value: "src/__mocks__,test/fixtures", type: "STRING", category: "GATE2", description: "Paths excluídos da verificação read-only" }),
  // STYLE_CONSISTENCY_LINT configs
  createValidationConfig({ key: "ESLINT_CONFIG_FILES", value: "eslint.config.ts,eslint.config.js", type: "STRING", category: "GATE2", description: "Arquivos de config do ESLint" }),
  createValidationConfig({ key: "SKIP_LINT_IF_NO_CONFIG", value: "true", type: "BOOLEAN", category: "GATE2", description: "Pular lint se não houver config" }),
  // TEST_CLAUSE_MAPPING_VALID configs
  createValidationConfig({ key: "ALLOW_UNTAGGED_TESTS", value: "false", type: "BOOLEAN", category: "GATE1", description: "Permitir testes sem tag de cláusula" }),
  // ALLOW_SOFT_GATES (global flag)
  createValidationConfig({ key: "ALLOW_SOFT_GATES", value: "false", type: "BOOLEAN", category: "GLOBAL", description: "Permite que gates soft não bloqueiem a execução" }),
  // Timeouts
  createValidationConfig({ key: "TEST_EXECUTION_TIMEOUT_MS", value: "600000", type: "NUMBER", category: "TIMEOUTS", description: "Timeout de execução de testes em ms" }),
  createValidationConfig({ key: "COMPILATION_TIMEOUT_MS", value: "60000", type: "NUMBER", category: "TIMEOUTS", description: "Timeout de compilação em ms" }),
  createValidationConfig({ key: "BUILD_TIMEOUT_MS", value: "120000", type: "NUMBER", category: "TIMEOUTS", description: "Timeout de build em ms" }),
  createValidationConfig({ key: "LINT_TIMEOUT_MS", value: "30000", type: "NUMBER", category: "TIMEOUTS", description: "Timeout de lint em ms" }),
  // System Paths
  createValidationConfig({ key: "PROJECT_ROOT", value: "/home/user/project", type: "STRING", category: "PATHS", description: "Raiz do projeto" }),
  createValidationConfig({ key: "BACKEND_WORKSPACE", value: "/home/user/project/packages/backend", type: "STRING", category: "PATHS", description: "Workspace backend" }),
  createValidationConfig({ key: "ARTIFACTS_DIR", value: "/home/user/project/artifacts", type: "STRING", category: "PATHS", description: "Diretório de artefatos" }),
  createValidationConfig({ key: "TEST_FILE_PATH", value: "src/components/__tests__", type: "STRING", category: "PATHS", description: "Path de arquivos de teste" }),
  createValidationConfig({ key: "SANDBOX_DIR", value: "/tmp/gatekeeper-sandbox", type: "STRING", category: "PATHS", description: "Diretório sandbox" }),
]

// ============================================================================
// Fixture Data — Security Rules
// ============================================================================

const sensitiveFileRuleFixtures: SensitiveFileRule[] = [
  createSensitiveFileRule({ id: "sfr-1", pattern: "*.env*", category: "CREDENTIALS", severity: "CRITICAL" }),
  createSensitiveFileRule({ id: "sfr-2", pattern: "*.pem", category: "CERTIFICATES", severity: "HIGH" }),
  createSensitiveFileRule({ id: "sfr-3", pattern: "secrets/**", category: "CREDENTIALS", severity: "CRITICAL", isActive: false }),
]

const ambiguousTermFixtures: AmbiguousTerm[] = [
  createAmbiguousTerm({ id: "at-1", term: "talvez", category: "VAGUE", suggestion: "Seja específico" }),
  createAmbiguousTerm({ id: "at-2", term: "provavelmente", category: "VAGUE", suggestion: "Use dados concretos" }),
  createAmbiguousTerm({ id: "at-3", term: "em breve", category: "TEMPORAL", suggestion: "Defina uma data" }),
]

// ============================================================================
// Fixture Data — Test Path Conventions
// ============================================================================

const testPathFixtures: TestPathConvention[] = [
  createTestPath({ id: "tp-1", testType: "spec", pathPattern: "src/**/*.spec.tsx", description: "React component specs" }),
  createTestPath({ id: "tp-2", testType: "unit", pathPattern: "src/**/*.test.ts", description: "Unit test files" }),
  createTestPath({ id: "tp-3", testType: "e2e", pathPattern: "e2e/**/*.spec.ts", description: "End-to-end tests", isActive: false }),
]

// ============================================================================
// Helpers
// ============================================================================

/**
 * Configura todos os mocks da API com dados de fixtures para renderizar ConfigPage.
 */
function setupApiMocks() {
  mockValidatorsList.mockResolvedValue(allValidators)
  mockConfigsList.mockResolvedValue(validationConfigFixtures)
  mockSensitiveList.mockResolvedValue(sensitiveFileRuleFixtures)
  mockAmbiguousList.mockResolvedValue(ambiguousTermFixtures)
  mockTestPathsList.mockResolvedValue(testPathFixtures)
  mockValidatorsUpdate.mockResolvedValue(allValidators[0])
  mockConfigsUpdate.mockResolvedValue(validationConfigFixtures[0])
  mockSensitiveCreate.mockResolvedValue(sensitiveFileRuleFixtures[0])
  mockSensitiveUpdate.mockResolvedValue(sensitiveFileRuleFixtures[0])
  mockSensitiveDelete.mockResolvedValue(undefined)
  mockAmbiguousCreate.mockResolvedValue(ambiguousTermFixtures[0])
  mockAmbiguousUpdate.mockResolvedValue(ambiguousTermFixtures[0])
  mockAmbiguousDelete.mockResolvedValue(undefined)
}

/**
 * Renderiza ConfigPage com mocks e aguarda carregamento.
 */
async function renderConfigPage() {
  setupApiMocks()
  render(<ConfigPage />)
  await waitFor(() => {
    expect(screen.queryByText(/carregando|loading/i) ?? screen.queryByRole("progressbar")).toBeNull()
  })
}

/**
 * Navega para uma tab específica clicando no trigger.
 */
async function clickTab(tabName: string) {
  const user = userEvent.setup()
  const tab = screen.getByRole("tab", { name: new RegExp(tabName, "i") })
  await user.click(tab)
}

/**
 * Conta validators ativos em uma lista.
 */
function countActive(validators: ValidatorItem[]): number {
  return validators.filter((v) => v.value === "true").length
}

// ============================================================================
// Test Suite
// ============================================================================

describe("Config Page Reorganization — 5 tabs → 4 tabs centradas no validator", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupApiMocks()
  })

  // ==========================================================================
  // Tab Structure
  // ==========================================================================

  describe("Tab Structure", () => {
    // @clause CL-UI-CFG-001
    // @ui-clause CL-UI-CFG-001
    it("should render exactly 4 tab triggers with correct names", async () => {
      await renderConfigPage()
      const tabs = screen.getAllByRole("tab")
      expect(tabs).toHaveLength(4)
      expect(screen.getByRole("tab", { name: /Validators/i })).toBeInTheDocument()
      expect(screen.getByRole("tab", { name: /Security Rules/i })).toBeInTheDocument()
      expect(screen.getByRole("tab", { name: /Conventions/i })).toBeInTheDocument()
      expect(screen.getByRole("tab", { name: /Advanced/i })).toBeInTheDocument()
    })

    // @clause CL-UI-CFG-001
    // @ui-clause CL-UI-CFG-001
    it("succeeds when all 4 new tab names are visible in the tab list", async () => {
      await renderConfigPage()
      const tabNames = ["Validators", "Security Rules", "Conventions", "Advanced"]
      for (const name of tabNames) {
        const tab = screen.getByRole("tab", { name: new RegExp(name, "i") })
        expect(tab).toBeVisible()
      }
    })

    // @clause CL-UI-CFG-001
    // @ui-clause CL-UI-CFG-001
    it("fails when old tab names (Validation Configs, Path Configs, Sensitive File Rules, Termos Ambíguos) are present", async () => {
      await renderConfigPage()
      const oldTabNames = ["Validation Configs", "Path Configs", "Sensitive File Rules", "Termos Ambíguos"]
      for (const name of oldTabNames) {
        expect(screen.queryByRole("tab", { name: new RegExp(name, "i") })).not.toBeInTheDocument()
      }
    })

    // @clause CL-UI-CFG-002
    // @ui-clause CL-UI-CFG-002
    it("should have Validators tab active by default", async () => {
      await renderConfigPage()
      const validatorsTab = screen.getByRole("tab", { name: /Validators/i })
      expect(validatorsTab).toHaveAttribute("aria-selected", "true")
    })

    // @clause CL-UI-CFG-002
    // @ui-clause CL-UI-CFG-002
    it("succeeds when gate-section-0 is present on initial render", async () => {
      await renderConfigPage()
      expect(screen.getByTestId("gate-section-0")).toBeInTheDocument()
    })

    // @clause CL-UI-CFG-002
    // @ui-clause CL-UI-CFG-002
    it("fails when non-Validators content is the default active tab", async () => {
      await renderConfigPage()
      expect(screen.queryByTestId("sensitive-file-patterns-section")).not.toBeInTheDocument()
      expect(screen.queryByTestId("timeouts-section")).not.toBeInTheDocument()
      expect(screen.queryByTestId("test-path-conventions-section")).not.toBeInTheDocument()
    })
  })

  // ==========================================================================
  // Validators Tab — Gate Sections
  // ==========================================================================

  describe("Validators Tab — Gate Sections", () => {
    // @clause CL-UI-VAL-001
    // @ui-clause CL-UI-VAL-001
    it("should render 4 gate sections with correct names", async () => {
      await renderConfigPage()
      expect(screen.getByTestId("gate-section-0")).toBeInTheDocument()
      expect(screen.getByTestId("gate-section-1")).toBeInTheDocument()
      expect(screen.getByTestId("gate-section-2")).toBeInTheDocument()
      expect(screen.getByTestId("gate-section-3")).toBeInTheDocument()
    })

    // @clause CL-UI-VAL-001
    // @ui-clause CL-UI-VAL-001
    it("succeeds when gate sections contain correct gate names and emojis", async () => {
      await renderConfigPage()
      const gate0 = screen.getByTestId("gate-section-0")
      expect(gate0).toHaveTextContent(/SANITIZATION/)
      expect(gate0).toHaveTextContent(/🧹/)

      const gate1 = screen.getByTestId("gate-section-1")
      expect(gate1).toHaveTextContent(/CONTRACT/)
      expect(gate1).toHaveTextContent(/📜/)

      const gate2 = screen.getByTestId("gate-section-2")
      expect(gate2).toHaveTextContent(/EXECUTION/)
      expect(gate2).toHaveTextContent(/⚙️/)

      const gate3 = screen.getByTestId("gate-section-3")
      expect(gate3).toHaveTextContent(/INTEGRITY/)
      expect(gate3).toHaveTextContent(/🏗️/)
    })

    // @clause CL-UI-VAL-001
    // @ui-clause CL-UI-VAL-001
    it("fails when fewer than 4 gate sections are rendered", async () => {
      await renderConfigPage()
      const gateSections = [
        screen.queryByTestId("gate-section-0"),
        screen.queryByTestId("gate-section-1"),
        screen.queryByTestId("gate-section-2"),
        screen.queryByTestId("gate-section-3"),
      ].filter(Boolean)
      expect(gateSections.length).toBe(4)
    })

    // @clause CL-UI-VAL-002
    // @ui-clause CL-UI-VAL-002
    it("should expand gate section when header is clicked", async () => {
      await renderConfigPage()
      const user = userEvent.setup()
      const gateHeader = screen.getByTestId("gate-header-1")
      await user.click(gateHeader)
      const gate1Section = screen.getByTestId("gate-section-1")
      expect(within(gate1Section).getByTestId("validator-row-TEST_SYNTAX_VALID")).toBeVisible()
    })

    // @clause CL-UI-VAL-002
    // @ui-clause CL-UI-VAL-002
    it("succeeds when clicking gate header toggles visibility of validator rows", async () => {
      await renderConfigPage()
      const user = userEvent.setup()
      const gateHeader = screen.getByTestId("gate-header-0")

      // First click: gate 0 starts collapsed (default closed), click to expand
      await user.click(gateHeader)
      expect(screen.getByTestId("validator-row-TOKEN_BUDGET_FIT")).toBeVisible()

      // Second click: collapse again
      await user.click(gateHeader)
      expect(screen.queryByTestId("validator-row-TOKEN_BUDGET_FIT")).not.toBeVisible()
    })

    // @clause CL-UI-VAL-002
    // @ui-clause CL-UI-VAL-002
    it("fails when collapsed gate section shows validator rows", async () => {
      await renderConfigPage()
      const user = userEvent.setup()

      // Gate 1 starts collapsed
      const gate1Section = screen.getByTestId("gate-section-1")
      expect(within(gate1Section).queryByTestId("validator-row-TEST_SYNTAX_VALID")).not.toBeVisible()
    })

    // @clause CL-UI-VAL-003
    // @ui-clause CL-UI-VAL-003
    it("should display active/total count per gate header", async () => {
      await renderConfigPage()
      const gate0Count = screen.getByTestId("gate-active-count-0")
      expect(gate0Count).toHaveTextContent(`${countActive(gate0Validators)} / ${gate0Validators.length}`)
    })

    // @clause CL-UI-VAL-003
    // @ui-clause CL-UI-VAL-003
    it("succeeds when all gate headers show count in N / M format", async () => {
      await renderConfigPage()
      const gates = [
        { testId: "gate-active-count-0", validators: gate0Validators },
        { testId: "gate-active-count-1", validators: gate1Validators },
        { testId: "gate-active-count-2", validators: gate2Validators },
        { testId: "gate-active-count-3", validators: gate3Validators },
      ]
      for (const { testId, validators } of gates) {
        const countEl = screen.getByTestId(testId)
        const active = countActive(validators)
        expect(countEl).toHaveTextContent(`${active} / ${validators.length}`)
      }
    })

    // @clause CL-UI-VAL-003
    // @ui-clause CL-UI-VAL-003
    it("fails when gate active count does not reflect actual active validators", async () => {
      await renderConfigPage()
      // Gate 3 has 1 active out of 2
      const gate3Count = screen.getByTestId("gate-active-count-3")
      expect(gate3Count).not.toHaveTextContent("0 / 2")
      expect(gate3Count).toHaveTextContent("1 / 2")
    })
  })

  // ==========================================================================
  // Validators Tab — Validator Row
  // ==========================================================================

  describe("Validators Tab — Validator Row", () => {
    // @clause CL-UI-VAL-004
    // @ui-clause CL-UI-VAL-004
    it("should render Switch with correct data-testid for each validator", async () => {
      await renderConfigPage()
      const gate0Section = screen.getByTestId("gate-section-0")
      const switchEl = within(gate0Section).getByTestId("validator-switch-TOKEN_BUDGET_FIT")
      expect(switchEl).toBeInTheDocument()
      expect(switchEl).toHaveAttribute("role", "switch")
    })

    // @clause CL-UI-VAL-004
    // @ui-clause CL-UI-VAL-004
    it("succeeds when Switch checked state reflects validator active status", async () => {
      await renderConfigPage()
      // TOKEN_BUDGET_FIT is active (value="true")
      const activeSwitch = screen.getByTestId("validator-switch-TOKEN_BUDGET_FIT")
      expect(activeSwitch).toHaveAttribute("aria-checked", "true")

      // Expand gate 2 to check an inactive validator
      const user = userEvent.setup()
      await user.click(screen.getByTestId("gate-header-2"))
      const inactiveSwitch = screen.getByTestId("validator-switch-STYLE_CONSISTENCY_LINT")
      expect(inactiveSwitch).toHaveAttribute("aria-checked", "false")
    })

    // @clause CL-UI-VAL-004
    // @ui-clause CL-UI-VAL-004
    it("fails when validator row lacks a role=switch element", async () => {
      await renderConfigPage()
      const user = userEvent.setup()
      // Expand gate 0 first (all gates start collapsed by default)
      await user.click(screen.getByTestId("gate-header-0"))
      const row = screen.getByTestId("validator-row-TOKEN_BUDGET_FIT")
      const switches = within(row).getAllByRole("switch")
      expect(switches.length).toBeGreaterThanOrEqual(1)
    })

    // @clause CL-UI-VAL-005
    // @ui-clause CL-UI-VAL-005
    it("should call onToggle when Switch is clicked", async () => {
      render(
        <ValidatorsTab
          validators={allValidators}
          validationConfigs={validationConfigFixtures}
          onToggle={mockOnToggle}
          onFailModeChange={mockOnFailModeChange}
          onUpdateConfig={mockOnUpdateConfig}
        />
      )
      const user = userEvent.setup()
      const switchEl = screen.getByTestId("validator-switch-TOKEN_BUDGET_FIT")
      await user.click(switchEl)
      expect(mockOnToggle).toHaveBeenCalledWith("TOKEN_BUDGET_FIT", false)
    })

    // @clause CL-UI-VAL-005
    // @ui-clause CL-UI-VAL-005
    it("succeeds when toggle callback receives correct key and inverted state", async () => {
      render(
        <ValidatorsTab
          validators={allValidators}
          validationConfigs={validationConfigFixtures}
          onToggle={mockOnToggle}
          onFailModeChange={mockOnFailModeChange}
          onUpdateConfig={mockOnUpdateConfig}
        />
      )
      const user = userEvent.setup()
      // PATH_CONVENTION is inactive (value="false"), so toggle should call with true
      await user.click(screen.getByTestId("validator-switch-PATH_CONVENTION"))
      expect(mockOnToggle).toHaveBeenCalledWith("PATH_CONVENTION", true)
    })

    // @clause CL-UI-VAL-005
    // @ui-clause CL-UI-VAL-005
    it("fails when onToggle is not called after Switch click", async () => {
      render(
        <ValidatorsTab
          validators={allValidators}
          validationConfigs={validationConfigFixtures}
          onToggle={mockOnToggle}
          onFailModeChange={mockOnFailModeChange}
          onUpdateConfig={mockOnUpdateConfig}
        />
      )
      const user = userEvent.setup()
      await user.click(screen.getByTestId("validator-switch-TASK_SCOPE_SIZE"))
      expect(mockOnToggle).toHaveBeenCalledTimes(1)
      expect(mockOnToggle).toHaveBeenCalledWith("TASK_SCOPE_SIZE", expect.any(Boolean))
    })

    // @clause CL-UI-VAL-006
    // @ui-clause CL-UI-VAL-006
    it("should render FailModePopover trigger in each validator row", async () => {
      await renderConfigPage()
      const gate0Section = screen.getByTestId("gate-section-0")
      const triggers = within(gate0Section).getAllByTestId("fail-mode-trigger")
      expect(triggers.length).toBeGreaterThanOrEqual(1)
    })

    // @clause CL-UI-VAL-006
    // @ui-clause CL-UI-VAL-006
    it("succeeds when fail mode trigger is present in TOKEN_BUDGET_FIT row", async () => {
      await renderConfigPage()
      const row = screen.getByTestId("validator-row-TOKEN_BUDGET_FIT")
      expect(within(row).getByTestId("fail-mode-trigger")).toBeInTheDocument()
    })

    // @clause CL-UI-VAL-006
    // @ui-clause CL-UI-VAL-006
    it("fails when validator row has no fail-mode-trigger", async () => {
      await renderConfigPage()
      const row = screen.getByTestId("validator-row-TASK_SCOPE_SIZE")
      const trigger = within(row).queryByTestId("fail-mode-trigger")
      expect(trigger).toBeInTheDocument()
    })

    // @clause CL-UI-VAL-007
    // @ui-clause CL-UI-VAL-007
    it("should show config button for validators with associated configs", async () => {
      await renderConfigPage()
      expect(screen.getByTestId("validator-config-btn-TOKEN_BUDGET_FIT")).toBeInTheDocument()
      expect(screen.getByTestId("validator-config-btn-TASK_SCOPE_SIZE")).toBeInTheDocument()
    })

    // @clause CL-UI-VAL-007
    // @ui-clause CL-UI-VAL-007
    it("succeeds when all 10 validators with configs have config buttons", async () => {
      await renderConfigPage()
      const user = userEvent.setup()

      // Expand all gates first
      await user.click(screen.getByTestId("gate-header-1"))
      await user.click(screen.getByTestId("gate-header-2"))

      const validatorsWithConfigs = [
        "TOKEN_BUDGET_FIT", "TASK_SCOPE_SIZE", "PATH_CONVENTION",
        "DELETE_DEPENDENCY_CHECK", "TEST_COVERS_HAPPY_AND_SAD_PATH",
        "IMPORT_REALITY_CHECK", "DIFF_SCOPE_ENFORCEMENT",
        "TEST_READ_ONLY_ENFORCEMENT", "STYLE_CONSISTENCY_LINT",
        "TEST_CLAUSE_MAPPING_VALID",
      ]
      for (const code of validatorsWithConfigs) {
        expect(screen.getByTestId(`validator-config-btn-${code}`)).toBeInTheDocument()
      }
    })

    // @clause CL-UI-VAL-007
    // @ui-clause CL-UI-VAL-007
    it("fails when DIFF_SCOPE_ENFORCEMENT lacks a config button", async () => {
      await renderConfigPage()
      const user = userEvent.setup()
      await user.click(screen.getByTestId("gate-header-2"))
      expect(screen.getByTestId("validator-config-btn-DIFF_SCOPE_ENFORCEMENT")).toBeInTheDocument()
    })

    // @clause CL-UI-VAL-008
    // @ui-clause CL-UI-VAL-008
    it("should not show config button for validators without configs", async () => {
      await renderConfigPage()
      const user = userEvent.setup()
      await user.click(screen.getByTestId("gate-header-1"))
      expect(screen.queryByTestId("validator-config-btn-TEST_SYNTAX_VALID")).not.toBeInTheDocument()
    })

    // @clause CL-UI-VAL-008
    // @ui-clause CL-UI-VAL-008
    it("fails when TEST_HAS_ASSERTIONS has a config button", async () => {
      await renderConfigPage()
      const user = userEvent.setup()
      await user.click(screen.getByTestId("gate-header-1"))
      expect(screen.queryByTestId("validator-config-btn-TEST_HAS_ASSERTIONS")).not.toBeInTheDocument()
    })

    // @clause CL-UI-VAL-008
    // @ui-clause CL-UI-VAL-008
    it("fails when MANIFEST_FILE_LOCK has a config button", async () => {
      await renderConfigPage()
      const user = userEvent.setup()
      await user.click(screen.getByTestId("gate-header-1"))
      expect(screen.queryByTestId("validator-config-btn-MANIFEST_FILE_LOCK")).not.toBeInTheDocument()
    })
  })

  // ==========================================================================
  // Validators Tab — Config Dialog
  // ==========================================================================

  describe("Validators Tab — Config Dialog", () => {
    // @clause CL-UI-VAL-009
    // @ui-clause CL-UI-VAL-009
    it("should open dialog with TOKEN_BUDGET_FIT config fields when ⚙️ is clicked", async () => {
      await renderConfigPage()
      const user = userEvent.setup()
      await user.click(screen.getByTestId("validator-config-btn-TOKEN_BUDGET_FIT"))
      expect(screen.getByTestId("validator-config-dialog")).toBeInTheDocument()
      expect(screen.getByTestId("validator-config-field-MAX_TOKEN_BUDGET")).toBeInTheDocument()
      expect(screen.getByTestId("validator-config-field-TOKEN_SAFETY_MARGIN")).toBeInTheDocument()
    })

    // @clause CL-UI-VAL-009
    // @ui-clause CL-UI-VAL-009
    it("succeeds when dialog contains MAX_TOKEN_BUDGET as a number input", async () => {
      await renderConfigPage()
      const user = userEvent.setup()
      await user.click(screen.getByTestId("validator-config-btn-TOKEN_BUDGET_FIT"))
      const field = screen.getByTestId("validator-config-field-MAX_TOKEN_BUDGET")
      const input = within(field).getByRole("spinbutton") ?? within(field).getByRole("textbox")
      expect(input).toBeInTheDocument()
    })

    // @clause CL-UI-VAL-009
    // @ui-clause CL-UI-VAL-009
    it("fails when TOKEN_BUDGET_FIT dialog is missing TOKEN_SAFETY_MARGIN field", async () => {
      await renderConfigPage()
      const user = userEvent.setup()
      await user.click(screen.getByTestId("validator-config-btn-TOKEN_BUDGET_FIT"))
      expect(screen.getByTestId("validator-config-field-TOKEN_SAFETY_MARGIN")).toBeInTheDocument()
    })

    // @clause CL-UI-VAL-010
    // @ui-clause CL-UI-VAL-010
    it("should show 4 fields when DIFF_SCOPE_ENFORCEMENT dialog opens", async () => {
      await renderConfigPage()
      const user = userEvent.setup()
      await user.click(screen.getByTestId("gate-header-2"))
      await user.click(screen.getByTestId("validator-config-btn-DIFF_SCOPE_ENFORCEMENT"))
      expect(screen.getByTestId("validator-config-dialog")).toBeInTheDocument()
      expect(screen.getByTestId("validator-config-field-DIFF_SCOPE_INCLUDE_WORKING_TREE")).toBeInTheDocument()
      expect(screen.getByTestId("validator-config-field-DIFF_SCOPE_IGNORED_PATTERNS")).toBeInTheDocument()
      expect(screen.getByTestId("validator-config-field-DIFF_SCOPE_ALLOW_TEST_ONLY_DIFF")).toBeInTheDocument()
      expect(screen.getByTestId("validator-config-field-DIFF_SCOPE_INCOMPLETE_FAIL_MODE")).toBeInTheDocument()
    })

    // @clause CL-UI-VAL-010
    // @ui-clause CL-UI-VAL-010
    it("succeeds when all DIFF_SCOPE config field testids are present in the dialog", async () => {
      await renderConfigPage()
      const user = userEvent.setup()
      await user.click(screen.getByTestId("gate-header-2"))
      await user.click(screen.getByTestId("validator-config-btn-DIFF_SCOPE_ENFORCEMENT"))

      const dialog = screen.getByTestId("validator-config-dialog")
      const expectedFields = [
        "validator-config-field-DIFF_SCOPE_INCLUDE_WORKING_TREE",
        "validator-config-field-DIFF_SCOPE_IGNORED_PATTERNS",
        "validator-config-field-DIFF_SCOPE_ALLOW_TEST_ONLY_DIFF",
        "validator-config-field-DIFF_SCOPE_INCOMPLETE_FAIL_MODE",
      ]
      for (const fieldId of expectedFields) {
        expect(within(dialog).getByTestId(fieldId)).toBeInTheDocument()
      }
    })

    // @clause CL-UI-VAL-010
    // @ui-clause CL-UI-VAL-010
    it("fails when DIFF_SCOPE_ENFORCEMENT dialog is missing any required field", async () => {
      await renderConfigPage()
      const user = userEvent.setup()
      await user.click(screen.getByTestId("gate-header-2"))
      await user.click(screen.getByTestId("validator-config-btn-DIFF_SCOPE_ENFORCEMENT"))

      const dialog = screen.getByTestId("validator-config-dialog")
      const fields = [
        "validator-config-field-DIFF_SCOPE_INCLUDE_WORKING_TREE",
        "validator-config-field-DIFF_SCOPE_IGNORED_PATTERNS",
        "validator-config-field-DIFF_SCOPE_ALLOW_TEST_ONLY_DIFF",
        "validator-config-field-DIFF_SCOPE_INCOMPLETE_FAIL_MODE",
      ]
      const allPresent = fields.every((f) => within(dialog).queryByTestId(f) !== null)
      expect(allPresent).toBe(true)
    })

    // @clause CL-UI-VAL-011
    // @ui-clause CL-UI-VAL-011
    it("should render comma-separated values as individual tag badges", async () => {
      await renderConfigPage()
      const user = userEvent.setup()
      await user.click(screen.getByTestId("gate-header-1"))
      await user.click(screen.getByTestId("validator-config-btn-TEST_COVERS_HAPPY_AND_SAD_PATH"))

      const dialog = screen.getByTestId("validator-config-dialog")
      const happyField = within(dialog).getByTestId("validator-config-field-HAPPY_PATH_KEYWORDS")
      // "deve,should,espera,succeeds,passes" → 5 badges
      const badges = within(happyField).getAllByRole("listitem") ?? within(happyField).getAllByText(/deve|should|espera|succeeds|passes/)
      expect(badges.length).toBeGreaterThanOrEqual(5)
    })

    // @clause CL-UI-VAL-011
    // @ui-clause CL-UI-VAL-011
    it("succeeds when each tag badge has a remove button", async () => {
      await renderConfigPage()
      const user = userEvent.setup()
      await user.click(screen.getByTestId("gate-header-1"))
      await user.click(screen.getByTestId("validator-config-btn-TEST_COVERS_HAPPY_AND_SAD_PATH"))

      const dialog = screen.getByTestId("validator-config-dialog")
      const happyField = within(dialog).getByTestId("validator-config-field-HAPPY_PATH_KEYWORDS")
      const removeButtons = within(happyField).getAllByRole("button", { name: /×|remove|✕/i })
      expect(removeButtons.length).toBeGreaterThanOrEqual(1)
    })

    // @clause CL-UI-VAL-011
    // @ui-clause CL-UI-VAL-011
    it("fails when comma-separated value renders as plain text instead of badges", async () => {
      await renderConfigPage()
      const user = userEvent.setup()
      await user.click(screen.getByTestId("validator-config-btn-PATH_CONVENTION"))

      const dialog = screen.getByTestId("validator-config-dialog")
      const field = within(dialog).getByTestId("validator-config-field-TYPE_DETECTION_PATTERNS")
      // Should have individual badges, not a single text input with comma-separated value
      const removeButtons = within(field).getAllByRole("button", { name: /×|remove|✕/i })
      expect(removeButtons.length).toBeGreaterThanOrEqual(1)
    })

    // @clause CL-UI-VAL-012
    // @ui-clause CL-UI-VAL-012
    it("should call update function when Save is clicked in dialog", async () => {
      render(
        <ValidatorsTab
          validators={allValidators}
          validationConfigs={validationConfigFixtures}
          onToggle={mockOnToggle}
          onFailModeChange={mockOnFailModeChange}
          onUpdateConfig={mockOnUpdateConfig}
        />
      )
      const user = userEvent.setup()
      await user.click(screen.getByTestId("validator-config-btn-TOKEN_BUDGET_FIT"))

      const dialog = screen.getByTestId("validator-config-dialog")
      const saveBtn = within(dialog).getByTestId("validator-config-save")
      await user.click(saveBtn)

      expect(mockOnUpdateConfig).toHaveBeenCalled()
    })

    // @clause CL-UI-VAL-012
    // @ui-clause CL-UI-VAL-012
    it("succeeds when dialog closes after successful save", async () => {
      mockOnUpdateConfig.mockResolvedValue(undefined)
      render(
        <ValidatorsTab
          validators={allValidators}
          validationConfigs={validationConfigFixtures}
          onToggle={mockOnToggle}
          onFailModeChange={mockOnFailModeChange}
          onUpdateConfig={mockOnUpdateConfig}
        />
      )
      const user = userEvent.setup()
      await user.click(screen.getByTestId("validator-config-btn-TOKEN_BUDGET_FIT"))

      expect(screen.getByTestId("validator-config-dialog")).toBeInTheDocument()
      await user.click(screen.getByTestId("validator-config-save"))

      await waitFor(() => {
        expect(screen.queryByTestId("validator-config-dialog")).not.toBeInTheDocument()
      })
    })

    // @clause CL-UI-VAL-012
    // @ui-clause CL-UI-VAL-012
    it("fails when save does not call update with config id and new value", async () => {
      render(
        <ValidatorsTab
          validators={allValidators}
          validationConfigs={validationConfigFixtures}
          onToggle={mockOnToggle}
          onFailModeChange={mockOnFailModeChange}
          onUpdateConfig={mockOnUpdateConfig}
        />
      )
      const user = userEvent.setup()
      await user.click(screen.getByTestId("validator-config-btn-TOKEN_BUDGET_FIT"))
      await user.click(screen.getByTestId("validator-config-save"))

      expect(mockOnUpdateConfig).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String)
      )
    })
  })

  // ==========================================================================
  // Validators Tab — Badges Especiais
  // ==========================================================================

  describe("Validators Tab — Badges Especiais", () => {
    // @clause CL-UI-VAL-013
    // @ui-clause CL-UI-VAL-013
    it("should show PÉTREA badge for TEST_FAILS_BEFORE_IMPLEMENTATION", async () => {
      await renderConfigPage()
      const user = userEvent.setup()
      await user.click(screen.getByTestId("gate-header-1"))

      const row = screen.getByTestId("validator-row-TEST_FAILS_BEFORE_IMPLEMENTATION")
      expect(row).toHaveTextContent(/PÉTREA/)
    })

    // @clause CL-UI-VAL-013
    // @ui-clause CL-UI-VAL-013
    it("succeeds when TEST_FAILS_BEFORE_IMPLEMENTATION switch is disabled", async () => {
      await renderConfigPage()
      const user = userEvent.setup()
      await user.click(screen.getByTestId("gate-header-1"))

      const switchEl = screen.getByTestId("validator-switch-TEST_FAILS_BEFORE_IMPLEMENTATION")
      expect(switchEl).toBeDisabled()
    })

    // @clause CL-UI-VAL-013
    // @ui-clause CL-UI-VAL-013
    it("fails when TEST_FAILS_BEFORE_IMPLEMENTATION switch can be toggled", async () => {
      await renderConfigPage()
      const user = userEvent.setup()
      await user.click(screen.getByTestId("gate-header-1"))

      const switchEl = screen.getByTestId("validator-switch-TEST_FAILS_BEFORE_IMPLEMENTATION")
      expect(switchEl).toHaveAttribute("disabled")
    })

    // @clause CL-UI-VAL-014
    // @ui-clause CL-UI-VAL-014
    it("should show ref badge for SENSITIVE_FILES_LOCK", async () => {
      await renderConfigPage()
      expect(screen.getByTestId("validator-ref-badge-SENSITIVE_FILES_LOCK")).toBeInTheDocument()
    })

    // @clause CL-UI-VAL-014
    // @ui-clause CL-UI-VAL-014
    it("succeeds when DANGER_MODE_EXPLICIT and TASK_CLARITY_CHECK have ref badges", async () => {
      await renderConfigPage()
      expect(screen.getByTestId("validator-ref-badge-DANGER_MODE_EXPLICIT")).toBeInTheDocument()
      expect(screen.getByTestId("validator-ref-badge-TASK_CLARITY_CHECK")).toBeInTheDocument()
    })

    // @clause CL-UI-VAL-014
    // @ui-clause CL-UI-VAL-014
    it("fails when table-dependent validators lack ref badge", async () => {
      await renderConfigPage()
      const refBadgeCodes = ["SENSITIVE_FILES_LOCK", "DANGER_MODE_EXPLICIT", "TASK_CLARITY_CHECK"]
      for (const code of refBadgeCodes) {
        expect(screen.getByTestId(`validator-ref-badge-${code}`)).toBeInTheDocument()
      }
    })
  })

  // ==========================================================================
  // Validators Tab — Features Removidas
  // ==========================================================================

  describe("Validators Tab — Features Removidas", () => {
    // @clause CL-UI-VAL-015
    // @ui-clause CL-UI-VAL-015
    it("should not render bulk-actions-bar in Validators tab", async () => {
      await renderConfigPage()
      expect(screen.queryByTestId("bulk-actions-bar")).not.toBeInTheDocument()
    })

    // @clause CL-UI-VAL-015
    // @ui-clause CL-UI-VAL-015
    it("fails when select-all-checkbox is present in Validators tab", async () => {
      await renderConfigPage()
      expect(screen.queryByTestId("select-all-checkbox")).not.toBeInTheDocument()
    })

    // @clause CL-UI-VAL-015
    // @ui-clause CL-UI-VAL-015
    it("fails when bulk-activate-btn is present in Validators tab", async () => {
      await renderConfigPage()
      expect(screen.queryByTestId("bulk-activate-btn")).not.toBeInTheDocument()
    })

    // @clause CL-UI-VAL-016
    // @ui-clause CL-UI-VAL-016
    it("should not render category-filter in Validators tab", async () => {
      await renderConfigPage()
      expect(screen.queryByTestId("category-filter")).not.toBeInTheDocument()
    })

    // @clause CL-UI-VAL-016
    // @ui-clause CL-UI-VAL-016
    it("fails when status-filter is present in Validators tab", async () => {
      await renderConfigPage()
      expect(screen.queryByTestId("status-filter")).not.toBeInTheDocument()
    })

    // @clause CL-UI-VAL-016
    // @ui-clause CL-UI-VAL-016
    it("fails when fail-mode-filter is present in Validators tab", async () => {
      await renderConfigPage()
      expect(screen.queryByTestId("fail-mode-filter")).not.toBeInTheDocument()
    })
  })

  // ==========================================================================
  // Security Rules Tab
  // ==========================================================================

  describe("Security Rules Tab", () => {
    // @clause CL-UI-SEC-001
    // @ui-clause CL-UI-SEC-001
    it("should render Sensitive File Patterns section when Security Rules tab is active", async () => {
      await renderConfigPage()
      await clickTab("Security Rules")
      expect(screen.getByTestId("sensitive-file-patterns-section")).toBeInTheDocument()
    })

    // @clause CL-UI-SEC-001
    // @ui-clause CL-UI-SEC-001
    it("succeeds when Sensitive File Patterns section indicates SensitiveFilesLock and DangerModeExplicit", async () => {
      await renderConfigPage()
      await clickTab("Security Rules")
      const section = screen.getByTestId("sensitive-file-patterns-section")
      expect(section).toHaveTextContent(/SensitiveFilesLock/)
      expect(section).toHaveTextContent(/DangerModeExplicit/)
    })

    // @clause CL-UI-SEC-001
    // @ui-clause CL-UI-SEC-001
    it("fails when Sensitive File Patterns section is not visible after tab selection", async () => {
      await renderConfigPage()
      await clickTab("Security Rules")
      const section = screen.getByTestId("sensitive-file-patterns-section")
      expect(section).toBeVisible()
    })

    // @clause CL-UI-SEC-002
    // @ui-clause CL-UI-SEC-002
    it("should render Ambiguous Terms Detection section when Security Rules tab is active", async () => {
      await renderConfigPage()
      await clickTab("Security Rules")
      expect(screen.getByTestId("ambiguous-terms-section")).toBeInTheDocument()
    })

    // @clause CL-UI-SEC-002
    // @ui-clause CL-UI-SEC-002
    it("succeeds when Ambiguous Terms section indicates TaskClarityCheck validator", async () => {
      await renderConfigPage()
      await clickTab("Security Rules")
      const section = screen.getByTestId("ambiguous-terms-section")
      expect(section).toHaveTextContent(/TaskClarityCheck/)
    })

    // @clause CL-UI-SEC-002
    // @ui-clause CL-UI-SEC-002
    it("fails when ambiguous-terms-section is missing from Security Rules tab", async () => {
      await renderConfigPage()
      await clickTab("Security Rules")
      expect(screen.getByTestId("ambiguous-terms-section")).toBeVisible()
    })

    // @clause CL-UI-SEC-003
    // @ui-clause CL-UI-SEC-003
    it("should have Add button in each section of Security Rules", async () => {
      render(
        <SecurityRulesTab
          sensitiveFileRules={sensitiveFileRuleFixtures}
          ambiguousTerms={ambiguousTermFixtures}
          onCreateSensitiveRule={mockOnCreateSensitiveRule}
          onUpdateSensitiveRule={mockOnUpdateSensitiveRule}
          onDeleteSensitiveRule={mockOnDeleteSensitiveRule}
          onCreateAmbiguousTerm={mockOnCreateAmbiguousTerm}
          onUpdateAmbiguousTerm={mockOnUpdateAmbiguousTerm}
          onDeleteAmbiguousTerm={mockOnDeleteAmbiguousTerm}
        />
      )

      const sensitiveSection = screen.getByTestId("sensitive-file-patterns-section")
      expect(within(sensitiveSection).getByRole("button", { name: /Adicionar/i })).toBeInTheDocument()

      const ambiguousSection = screen.getByTestId("ambiguous-terms-section")
      expect(within(ambiguousSection).getByRole("button", { name: /Adicionar/i })).toBeInTheDocument()
    })

    // @clause CL-UI-SEC-003
    // @ui-clause CL-UI-SEC-003
    it("succeeds when Edit, Toggle, and Delete buttons are present per item", async () => {
      render(
        <SecurityRulesTab
          sensitiveFileRules={sensitiveFileRuleFixtures}
          ambiguousTerms={ambiguousTermFixtures}
          onCreateSensitiveRule={mockOnCreateSensitiveRule}
          onUpdateSensitiveRule={mockOnUpdateSensitiveRule}
          onDeleteSensitiveRule={mockOnDeleteSensitiveRule}
          onCreateAmbiguousTerm={mockOnCreateAmbiguousTerm}
          onUpdateAmbiguousTerm={mockOnUpdateAmbiguousTerm}
          onDeleteAmbiguousTerm={mockOnDeleteAmbiguousTerm}
        />
      )

      const sensitiveSection = screen.getByTestId("sensitive-file-patterns-section")
      const editButtons = within(sensitiveSection).getAllByRole("button", { name: /Editar/i })
      expect(editButtons.length).toBeGreaterThanOrEqual(sensitiveFileRuleFixtures.length)

      const deleteButtons = within(sensitiveSection).getAllByRole("button", { name: /Excluir/i })
      expect(deleteButtons.length).toBeGreaterThanOrEqual(sensitiveFileRuleFixtures.length)
    })

    // @clause CL-UI-SEC-003
    // @ui-clause CL-UI-SEC-003
    it("fails when CRUD handlers are not connected to buttons", async () => {
      render(
        <SecurityRulesTab
          sensitiveFileRules={sensitiveFileRuleFixtures}
          ambiguousTerms={ambiguousTermFixtures}
          onCreateSensitiveRule={mockOnCreateSensitiveRule}
          onUpdateSensitiveRule={mockOnUpdateSensitiveRule}
          onDeleteSensitiveRule={mockOnDeleteSensitiveRule}
          onCreateAmbiguousTerm={mockOnCreateAmbiguousTerm}
          onUpdateAmbiguousTerm={mockOnUpdateAmbiguousTerm}
          onDeleteAmbiguousTerm={mockOnDeleteAmbiguousTerm}
        />
      )

      const user = userEvent.setup()
      const sensitiveSection = screen.getByTestId("sensitive-file-patterns-section")
      const deleteBtn = within(sensitiveSection).getAllByRole("button", { name: /Excluir/i })[0]
      await user.click(deleteBtn)
      expect(mockOnDeleteSensitiveRule).toHaveBeenCalledWith(sensitiveFileRuleFixtures[0].id)
    })
  })

  // ==========================================================================
  // Conventions Tab
  // ==========================================================================

  describe("Conventions Tab", () => {
    // @clause CL-UI-CONV-001
    // @ui-clause CL-UI-CONV-001
    it("should render Test Path Conventions section when Conventions tab is active", async () => {
      await renderConfigPage()
      await clickTab("Conventions")
      expect(screen.getByTestId("test-path-conventions-section")).toBeInTheDocument()
    })

    // @clause CL-UI-CONV-001
    // @ui-clause CL-UI-CONV-001
    it("succeeds when Test Path Conventions section has CRUD capabilities", async () => {
      await renderConfigPage()
      await clickTab("Conventions")
      const section = screen.getByTestId("test-path-conventions-section")
      expect(within(section).getByRole("button", { name: /Adicionar/i })).toBeInTheDocument()
      expect(within(section).getAllByRole("button", { name: /Editar/i }).length).toBeGreaterThanOrEqual(1)
    })

    // @clause CL-UI-CONV-001
    // @ui-clause CL-UI-CONV-001
    it("fails when test-path-conventions-section is absent from Conventions tab", async () => {
      await renderConfigPage()
      await clickTab("Conventions")
      expect(screen.getByTestId("test-path-conventions-section")).toBeVisible()
    })

    // @clause CL-UI-CONV-002
    // @ui-clause CL-UI-CONV-002
    it("should render System Paths section when Conventions tab is active", async () => {
      await renderConfigPage()
      await clickTab("Conventions")
      expect(screen.getByTestId("system-paths-section")).toBeInTheDocument()
    })

    // @clause CL-UI-CONV-002
    // @ui-clause CL-UI-CONV-002
    it("succeeds when System Paths section has Edit but no Add or Delete", async () => {
      await renderConfigPage()
      await clickTab("Conventions")
      const section = screen.getByTestId("system-paths-section")
      expect(within(section).getAllByRole("button", { name: /Editar/i }).length).toBeGreaterThanOrEqual(1)
      expect(within(section).queryByRole("button", { name: /Adicionar/i })).not.toBeInTheDocument()
      expect(within(section).queryByRole("button", { name: /Excluir/i })).not.toBeInTheDocument()
    })

    // @clause CL-UI-CONV-002
    // @ui-clause CL-UI-CONV-002
    it("fails when System Paths section allows create or delete operations", async () => {
      await renderConfigPage()
      await clickTab("Conventions")
      const section = screen.getByTestId("system-paths-section")
      expect(within(section).queryByRole("button", { name: /Adicionar/i })).not.toBeInTheDocument()
      expect(within(section).queryByRole("button", { name: /Excluir/i })).not.toBeInTheDocument()
    })
  })

  // ==========================================================================
  // Advanced Tab
  // ==========================================================================

  describe("Advanced Tab", () => {
    // @clause CL-UI-ADV-001
    // @ui-clause CL-UI-ADV-001
    it("should render Global Flags section with ALLOW_SOFT_GATES switch", async () => {
      await renderConfigPage()
      await clickTab("Advanced")
      expect(screen.getByTestId("global-flags-section")).toBeInTheDocument()
      expect(screen.getByTestId("allow-soft-gates-switch")).toBeInTheDocument()
    })

    // @clause CL-UI-ADV-001
    // @ui-clause CL-UI-ADV-001
    it("succeeds when ALLOW_SOFT_GATES text is visible and switch has role=switch", async () => {
      await renderConfigPage()
      await clickTab("Advanced")
      const section = screen.getByTestId("global-flags-section")
      expect(section).toHaveTextContent(/ALLOW_SOFT_GATES/)
      const switchEl = screen.getByTestId("allow-soft-gates-switch")
      expect(switchEl).toHaveAttribute("role", "switch")
    })

    // @clause CL-UI-ADV-001
    // @ui-clause CL-UI-ADV-001
    it("fails when global-flags-section is not present in Advanced tab", async () => {
      await renderConfigPage()
      await clickTab("Advanced")
      expect(screen.getByTestId("global-flags-section")).toBeVisible()
    })

    // @clause CL-UI-ADV-002
    // @ui-clause CL-UI-ADV-002
    it("should render Timeouts section with 4 numeric fields", async () => {
      await renderConfigPage()
      await clickTab("Advanced")
      expect(screen.getByTestId("timeouts-section")).toBeInTheDocument()
      expect(screen.getByTestId("timeout-field-TEST_EXECUTION_TIMEOUT_MS")).toBeInTheDocument()
      expect(screen.getByTestId("timeout-field-COMPILATION_TIMEOUT_MS")).toBeInTheDocument()
      expect(screen.getByTestId("timeout-field-BUILD_TIMEOUT_MS")).toBeInTheDocument()
      expect(screen.getByTestId("timeout-field-LINT_TIMEOUT_MS")).toBeInTheDocument()
    })

    // @clause CL-UI-ADV-002
    // @ui-clause CL-UI-ADV-002
    it("succeeds when all 4 timeout fields are present with correct testids", async () => {
      await renderConfigPage()
      await clickTab("Advanced")
      const timeoutKeys = [
        "TEST_EXECUTION_TIMEOUT_MS",
        "COMPILATION_TIMEOUT_MS",
        "BUILD_TIMEOUT_MS",
        "LINT_TIMEOUT_MS",
      ]
      for (const key of timeoutKeys) {
        const field = screen.getByTestId(`timeout-field-${key}`)
        expect(field).toBeInTheDocument()
      }
    })

    // @clause CL-UI-ADV-002
    // @ui-clause CL-UI-ADV-002
    it("fails when any timeout field is missing from the Timeouts section", async () => {
      await renderConfigPage()
      await clickTab("Advanced")
      const section = screen.getByTestId("timeouts-section")
      expect(within(section).getByTestId("timeout-field-TEST_EXECUTION_TIMEOUT_MS")).toBeInTheDocument()
      expect(within(section).getByTestId("timeout-field-COMPILATION_TIMEOUT_MS")).toBeInTheDocument()
      expect(within(section).getByTestId("timeout-field-BUILD_TIMEOUT_MS")).toBeInTheDocument()
      expect(within(section).getByTestId("timeout-field-LINT_TIMEOUT_MS")).toBeInTheDocument()
    })

    // @clause CL-UI-ADV-003
    // @ui-clause CL-UI-ADV-003
    it("should render All Configs debug view as read-only table", async () => {
      await renderConfigPage()
      await clickTab("Advanced")
      expect(screen.getByTestId("all-configs-debug-view")).toBeInTheDocument()
    })

    // @clause CL-UI-ADV-003
    // @ui-clause CL-UI-ADV-003
    it("succeeds when All Configs debug view contains config data with Key, Value, Type, Category columns", async () => {
      await renderConfigPage()
      await clickTab("Advanced")
      const debugView = screen.getByTestId("all-configs-debug-view")
      expect(debugView).toHaveTextContent(/Key/)
      expect(debugView).toHaveTextContent(/Value/)
      expect(debugView).toHaveTextContent(/Type/)
      expect(debugView).toHaveTextContent(/Category/)
    })

    // @clause CL-UI-ADV-003
    // @ui-clause CL-UI-ADV-003
    it("fails when All Configs debug view has Edit or Delete buttons", async () => {
      await renderConfigPage()
      await clickTab("Advanced")
      const debugView = screen.getByTestId("all-configs-debug-view")
      expect(within(debugView).queryByRole("button", { name: /Editar/i })).not.toBeInTheDocument()
      expect(within(debugView).queryByRole("button", { name: /Excluir/i })).not.toBeInTheDocument()
    })

    // @clause CL-UI-ADV-004
    // @ui-clause CL-UI-ADV-004
    it("should render Coverage Audit section", async () => {
      await renderConfigPage()
      await clickTab("Advanced")
      expect(screen.getByTestId("coverage-audit-section")).toBeInTheDocument()
    })

    // @clause CL-UI-ADV-004
    // @ui-clause CL-UI-ADV-004
    it("succeeds when Coverage Audit lists config keys with their UI locations", async () => {
      await renderConfigPage()
      await clickTab("Advanced")
      const section = screen.getByTestId("coverage-audit-section")
      // Should have at least 27 entries covering all config keys
      expect(section).toHaveTextContent(/MAX_TOKEN_BUDGET/)
      expect(section).toHaveTextContent(/ALLOW_SOFT_GATES/)
      expect(section).toHaveTextContent(/TEST_EXECUTION_TIMEOUT_MS/)
    })

    // @clause CL-UI-ADV-004
    // @ui-clause CL-UI-ADV-004
    it("fails when coverage-audit-section is not present in Advanced tab", async () => {
      await renderConfigPage()
      await clickTab("Advanced")
      expect(screen.getByTestId("coverage-audit-section")).toBeVisible()
    })
  })

  // ==========================================================================
  // Advanced Tab — Component-level tests
  // ==========================================================================

  describe("Advanced Tab — Component-level", () => {
    // @clause CL-UI-ADV-001
    // @ui-clause CL-UI-ADV-001
    it("should render AdvancedTab component with validationConfigs", () => {
      render(
        <AdvancedTab
          validationConfigs={validationConfigFixtures}
          onUpdateConfig={mockOnUpdateConfig}
        />
      )
      expect(screen.getByTestId("global-flags-section")).toBeInTheDocument()
      expect(screen.getByTestId("timeouts-section")).toBeInTheDocument()
      expect(screen.getByTestId("all-configs-debug-view")).toBeInTheDocument()
      expect(screen.getByTestId("coverage-audit-section")).toBeInTheDocument()
    })

    // @clause CL-UI-ADV-002
    // @ui-clause CL-UI-ADV-002
    it("succeeds when AdvancedTab timeout fields display current config values", () => {
      render(
        <AdvancedTab
          validationConfigs={validationConfigFixtures}
          onUpdateConfig={mockOnUpdateConfig}
        />
      )
      const testTimeoutField = screen.getByTestId("timeout-field-TEST_EXECUTION_TIMEOUT_MS")
      expect(testTimeoutField).toBeInTheDocument()
      // The field should contain or display the value 600000
      expect(testTimeoutField).toHaveTextContent(/600000/) 
    })

    // @clause CL-UI-ADV-003
    // @ui-clause CL-UI-ADV-003
    it("fails when AdvancedTab all-configs-debug-view allows editing", () => {
      render(
        <AdvancedTab
          validationConfigs={validationConfigFixtures}
          onUpdateConfig={mockOnUpdateConfig}
        />
      )
      const debugView = screen.getByTestId("all-configs-debug-view")
      expect(within(debugView).queryAllByRole("button", { name: /Editar|Edit/i })).toHaveLength(0)
      expect(within(debugView).queryAllByRole("button", { name: /Excluir|Delete/i })).toHaveLength(0)
    })
  })

  // ==========================================================================
  // Validator Config Dialog — Component-level tests
  // ==========================================================================

  describe("Validator Config Dialog — Component-level", () => {
    // @clause CL-UI-VAL-009
    // @ui-clause CL-UI-VAL-009
    it("should render ValidatorConfigDialog with TOKEN_BUDGET_FIT configs", () => {
      const tokenConfigs = validationConfigFixtures.filter(
        (c) => c.key === "MAX_TOKEN_BUDGET" || c.key === "TOKEN_SAFETY_MARGIN"
      )
      render(
        <ValidatorConfigDialog
          open={true}
          onOpenChange={vi.fn()}
          validatorCode="TOKEN_BUDGET_FIT"
          validatorDisplayName="Token Budget Fit"
          configs={tokenConfigs}
          onSave={vi.fn()}
        />
      )
      expect(screen.getByTestId("validator-config-dialog")).toBeInTheDocument()
      expect(screen.getByTestId("validator-config-field-MAX_TOKEN_BUDGET")).toBeInTheDocument()
      expect(screen.getByTestId("validator-config-field-TOKEN_SAFETY_MARGIN")).toBeInTheDocument()
    })

    // @clause CL-UI-VAL-010
    // @ui-clause CL-UI-VAL-010
    it("should render ValidatorConfigDialog with DIFF_SCOPE_ENFORCEMENT configs", () => {
      const diffConfigs = validationConfigFixtures.filter((c) =>
        c.key.startsWith("DIFF_SCOPE_")
      )
      render(
        <ValidatorConfigDialog
          open={true}
          onOpenChange={vi.fn()}
          validatorCode="DIFF_SCOPE_ENFORCEMENT"
          validatorDisplayName="Diff Scope Enforcement"
          configs={diffConfigs}
          onSave={vi.fn()}
        />
      )
      expect(screen.getByTestId("validator-config-field-DIFF_SCOPE_INCLUDE_WORKING_TREE")).toBeInTheDocument()
      expect(screen.getByTestId("validator-config-field-DIFF_SCOPE_IGNORED_PATTERNS")).toBeInTheDocument()
      expect(screen.getByTestId("validator-config-field-DIFF_SCOPE_ALLOW_TEST_ONLY_DIFF")).toBeInTheDocument()
      expect(screen.getByTestId("validator-config-field-DIFF_SCOPE_INCOMPLETE_FAIL_MODE")).toBeInTheDocument()
    })

    // @clause CL-UI-VAL-012
    // @ui-clause CL-UI-VAL-012
    it("succeeds when Save button calls onSave with correct arguments", async () => {
      const mockSave = vi.fn().mockResolvedValue(undefined)
      const tokenConfigs = validationConfigFixtures.filter(
        (c) => c.key === "MAX_TOKEN_BUDGET" || c.key === "TOKEN_SAFETY_MARGIN"
      )
      render(
        <ValidatorConfigDialog
          open={true}
          onOpenChange={vi.fn()}
          validatorCode="TOKEN_BUDGET_FIT"
          validatorDisplayName="Token Budget Fit"
          configs={tokenConfigs}
          onSave={mockSave}
        />
      )
      const user = userEvent.setup()
      await user.click(screen.getByTestId("validator-config-save"))
      expect(mockSave).toHaveBeenCalled()
    })
  })

  // ==========================================================================
  // Refactor Invariants
  // ==========================================================================

  describe("Refactor Invariants", () => {
    // @clause CL-REFACTOR-001
    it("should have validation-configs-tab.tsx deleted from the project", () => {
      const deletedFilePath = path.resolve(__dirname, "..", "validation-configs-tab.tsx")
      expect(fs.existsSync(deletedFilePath)).toBe(false)
    })

    // @clause CL-REFACTOR-001
    it("succeeds when config-page.tsx does not import validation-configs-tab", () => {
      const configPagePath = path.resolve(__dirname, "..", "config-page.tsx")
      const source = fs.readFileSync(configPagePath, "utf-8")
      expect(source).not.toContain("validation-configs-tab")
    })

    // @clause CL-REFACTOR-001
    it("fails when validation-configs-tab.tsx still exists or is still imported", () => {
      const deletedFilePath = path.resolve(__dirname, "..", "validation-configs-tab.tsx")
      const configPagePath = path.resolve(__dirname, "..", "config-page.tsx")
      const source = fs.readFileSync(configPagePath, "utf-8")

      const fileStillExists = fs.existsSync(deletedFilePath)
      const importStillPresent = source.includes("validation-configs-tab")

      expect(fileStillExists || importStillPresent).toBe(false)
    })
  })
})
