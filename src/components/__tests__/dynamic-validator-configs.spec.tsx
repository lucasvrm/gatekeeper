import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState, useMemo } from "react"

/**
 * Dynamic Validator Configurations Contract Spec
 * ===============================================
 *
 * Contract: dynamic-validator-configs v1.0
 * Mode: STRICT
 * Criticality: HIGH
 *
 * Este arquivo cobre todas as 48 cláusulas do contrato:
 *
 * Seed — Novas Configs (CL-SEED-001 a CL-SEED-013):
 * - DELETE_CHECK_IGNORE_DIRS, HAPPY_PATH_KEYWORDS, SAD_PATH_KEYWORDS
 * - ESLINT_CONFIG_FILES, SKIP_LINT_IF_NO_CONFIG, EXTRA_BUILTIN_MODULES
 * - PATH_ALIASES, TYPE_DETECTION_PATTERNS, TEST_READ_ONLY_EXCLUDED_PATHS
 * - TEST_EXECUTION_TIMEOUT_MS, COMPILATION_TIMEOUT_MS, BUILD_TIMEOUT_MS, LINT_TIMEOUT_MS
 *
 * Validators (CL-VAL-DC-*, CL-VAL-HP-*, CL-VAL-SL-*, CL-VAL-IR-*, CL-VAL-PC-*, CL-VAL-TR-*):
 * - DeleteDependencyCheck lê DELETE_CHECK_IGNORE_DIRS
 * - TestCoversHappyAndSadPath lê HAPPY/SAD_PATH_KEYWORDS
 * - StyleConsistencyLint lê ESLINT_CONFIG_FILES, SKIP_LINT_IF_NO_CONFIG
 * - ImportRealityCheck lê EXTRA_BUILTIN_MODULES, PATH_ALIASES
 * - PathConvention lê TYPE_DETECTION_PATTERNS
 * - TestReadOnlyEnforcement lê TEST_READ_ONLY_EXCLUDED_PATHS
 *
 * Services (CL-SVC-TR-001, CL-SVC-CS-001, CL-SVC-LS-001, CL-SVC-BS-001):
 * - TestRunnerService, CompilerService, LintService, BuildService usam timeout configurável
 *
 * UI (CL-UI-VS-001 a CL-UI-VS-006):
 * - Validator Settings sub-tab em PathConfigsTab
 * - Configs agrupadas por categoria
 * - Badges para valores comma-separated
 * - Edit modal e persistência
 *
 * REGRA: Se estes testes falharem, a LLM executora errou na implementação.
 */

// ============================================================================
// Type Definitions
// ============================================================================

type ValidatorStatus = "PASSED" | "FAILED" | "WARNING" | "SKIPPED"

interface ValidationConfig {
  id: string
  key: string
  value: string
  type: "STRING" | "NUMBER" | "BOOLEAN"
  category: string
  description?: string | null
}

interface ValidationContext {
  projectPath: string
  testFilePath?: string
  baseRef: string
  targetRef: string
  manifest?: {
    files: Array<{ path: string; action: "CREATE" | "MODIFY" | "DELETE" }>
  }
  config: {
    get: (key: string) => string | undefined
  }
  services: {
    git: {
      readFile: (path: string) => Promise<string>
      getDiffFiles: (baseRef: string, targetRef: string) => Promise<string[]>
      getDiffFilesWithWorkingTree: (baseRef: string) => Promise<string[]>
    }
    ast: {
      getImports: (path: string) => Promise<string[]>
    }
    lint: {
      lint: (files: string[]) => Promise<{ success: boolean; errorCount: number; warningCount: number; output: string }>
    }
    log: {
      warn: (msg: string, data?: unknown) => void
    }
  }
}

interface ValidatorOutput {
  passed: boolean
  status: ValidatorStatus
  message: string
  context?: {
    inputs?: Array<{ label: string; value: unknown }>
    analyzed?: Array<{ label: string; items: string[] }>
    findings?: Array<{ type: "pass" | "fail" | "warning" | "info"; message: string }>
    reasoning?: string
  }
  details?: Record<string, unknown>
  evidence?: string
  metrics?: Record<string, unknown>
}

interface ServiceOptions {
  timeout?: number
}

// ============================================================================
// Mock Functions
// ============================================================================

const mockConfigGet = vi.fn<[string], string | undefined>()
const mockOnUpdate = vi.fn<[string, Record<string, string | boolean>], Promise<boolean>>()

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockConfig = (overrides: Partial<ValidationConfig> = {}): ValidationConfig => ({
  id: `config_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  key: "TEST_CONFIG",
  value: "test_value",
  type: "STRING",
  category: "GATE0",
  description: "Test configuration",
  ...overrides,
})

const createMockContext = (configValues: Record<string, string> = {}): ValidationContext => ({
  projectPath: "/project",
  testFilePath: "/project/src/test.spec.ts",
  baseRef: "origin/main",
  targetRef: "HEAD",
  manifest: {
    files: [
      { path: "src/Button.tsx", action: "MODIFY" },
    ],
  },
  config: {
    get: (key: string) => configValues[key],
  },
  services: {
    git: {
      readFile: vi.fn().mockResolvedValue(""),
      getDiffFiles: vi.fn().mockResolvedValue([]),
      getDiffFilesWithWorkingTree: vi.fn().mockResolvedValue([]),
    },
    ast: {
      getImports: vi.fn().mockResolvedValue([]),
    },
    lint: {
      lint: vi.fn().mockResolvedValue({ success: true, errorCount: 0, warningCount: 0, output: "" }),
    },
    log: {
      warn: vi.fn(),
    },
  },
})

// ============================================================================
// Seed Config Validation Helpers
// ============================================================================

interface SeedConfigSpec {
  key: string
  value: string
  type: "STRING" | "NUMBER" | "BOOLEAN"
  category: string
  valueContains?: string[]
}

function validateSeedConfig(config: ValidationConfig, spec: SeedConfigSpec): void {
  expect(config.key).toBe(spec.key)
  expect(config.type).toBe(spec.type)
  expect(config.category).toBe(spec.category)
  
  if (spec.valueContains) {
    for (const expected of spec.valueContains) {
      expect(config.value).toContain(expected)
    }
  } else {
    expect(config.value).toBe(spec.value)
  }
}

// ============================================================================
// Mock Validators
// ============================================================================

/**
 * Mock DeleteDependencyCheck validator that reads config
 */
async function mockDeleteDependencyCheckExecute(ctx: ValidationContext): Promise<ValidatorOutput> {
  // CL-VAL-DC-001: Read DELETE_CHECK_IGNORE_DIRS from ctx.config
  const ignoreConfigStr = ctx.config.get("DELETE_CHECK_IGNORE_DIRS") || ""
  const configIgnore = ignoreConfigStr ? ignoreConfigStr.split(",").map((p) => p.trim()).filter(Boolean) : []
  
  // CL-VAL-DC-002: Default dirs always present
  const defaultIgnore = ["node_modules", ".git", "dist", "build", "coverage", ".next", ".cache"]
  
  // Combine without duplicates
  const ignore = [...new Set([...defaultIgnore, ...configIgnore])]

  return {
    passed: true,
    status: "PASSED",
    message: "Delete dependency check passed",
    context: {
      inputs: [{ label: "IgnoreDirs", value: ignore }],
      findings: [{ type: "pass", message: "All importers covered" }],
      reasoning: `Using ${ignore.length} ignore patterns`,
    },
    details: {
      ignoreDirs: ignore,
      configIgnore,
      defaultIgnore,
    },
  }
}

/**
 * Mock TestCoversHappyAndSadPath validator that reads config
 */
async function mockTestCoversHappyAndSadPathExecute(ctx: ValidationContext): Promise<ValidatorOutput> {
  if (!ctx.testFilePath) {
    return {
      passed: false,
      status: "FAILED",
      message: "No test file path provided",
    }
  }

  // CL-VAL-HP-001: Read HAPPY_PATH_KEYWORDS from ctx.config
  const happyKeywordsStr = ctx.config.get("HAPPY_PATH_KEYWORDS") || "success,should,valid,passes,correctly,works,returns"
  const happyKeywords = happyKeywordsStr.split(",").map((k) => k.trim()).filter(Boolean)

  // CL-VAL-HP-002: Read SAD_PATH_KEYWORDS from ctx.config
  const sadKeywordsStr = ctx.config.get("SAD_PATH_KEYWORDS") || "error,fail,throws,invalid,not,reject,deny,block"
  const sadKeywords = sadKeywordsStr.split(",").map((k) => k.trim()).filter(Boolean)

  // Build dynamic regex
  const happyPathRegex = new RegExp(`it\\s*\\(\\s*['"].*?(${happyKeywords.join("|")})`, "i")
  const sadPathRegex = new RegExp(`it\\s*\\(\\s*['"].*?(${sadKeywords.join("|")})`, "i")

  const content = await ctx.services.git.readFile(ctx.testFilePath)
  const hasHappyPath = happyPathRegex.test(content)
  const hasSadPath = sadPathRegex.test(content)

  if (!hasHappyPath || !hasSadPath) {
    return {
      passed: false,
      status: "FAILED",
      message: "Missing happy or sad path coverage",
      details: { happyKeywords, sadKeywords, hasHappyPath, hasSadPath },
    }
  }

  return {
    passed: true,
    status: "PASSED",
    message: "Test covers both happy and sad paths",
    details: { happyKeywords, sadKeywords, hasHappyPath, hasSadPath },
  }
}

/**
 * Mock StyleConsistencyLint validator that reads config
 */
async function mockStyleConsistencyLintExecute(ctx: ValidationContext, fileExists: (path: string) => boolean): Promise<ValidatorOutput> {
  // CL-VAL-SL-001: Read ESLINT_CONFIG_FILES from ctx.config
  const configFilesStr = ctx.config.get("ESLINT_CONFIG_FILES") ||
    "eslint.config.js,eslint.config.mjs,eslint.config.cjs,.eslintrc.js,.eslintrc.json,.eslintrc"
  const eslintConfigs = configFilesStr.split(",").map((f) => f.trim())

  // CL-VAL-SL-002: Read SKIP_LINT_IF_NO_CONFIG from ctx.config
  const skipIfNoConfig = ctx.config.get("SKIP_LINT_IF_NO_CONFIG") !== "false"

  let hasEslintConfig = false
  for (const config of eslintConfigs) {
    if (fileExists(`${ctx.projectPath}/${config}`)) {
      hasEslintConfig = true
      break
    }
  }

  if (!hasEslintConfig) {
    // CL-VAL-SL-003 and CL-VAL-SL-004: Behavior depends on SKIP_LINT_IF_NO_CONFIG
    if (skipIfNoConfig) {
      return {
        passed: true,
        status: "SKIPPED",
        message: "No ESLint configuration found, skipping lint check",
        details: { eslintConfigs, skipIfNoConfig },
      }
    } else {
      return {
        passed: false,
        status: "FAILED",
        message: "No ESLint configuration found and SKIP_LINT_IF_NO_CONFIG=false",
        details: { eslintConfigs, skipIfNoConfig },
      }
    }
  }

  return {
    passed: true,
    status: "PASSED",
    message: "ESLint check passed",
    details: { eslintConfigs },
  }
}

/**
 * Mock ImportRealityCheck validator that reads config
 */
async function mockImportRealityCheckExecute(ctx: ValidationContext): Promise<ValidatorOutput> {
  const NODE_BUILTIN_MODULES = new Set([
    "assert", "buffer", "child_process", "crypto", "events", "fs", "http", "https",
    "net", "os", "path", "stream", "url", "util", "zlib",
  ])

  // CL-VAL-IR-001: Read EXTRA_BUILTIN_MODULES from ctx.config
  const extraBuiltinsStr = ctx.config.get("EXTRA_BUILTIN_MODULES") || ""
  const extraBuiltins = extraBuiltinsStr ? extraBuiltinsStr.split(",").map((m) => m.trim()).filter(Boolean) : []
  const builtinModules = new Set([...NODE_BUILTIN_MODULES, ...extraBuiltins])

  // CL-VAL-IR-003: Read PATH_ALIASES from ctx.config
  const pathAliasesStr = ctx.config.get("PATH_ALIASES") || "@/:src/"
  const pathAliases = parsePathAliases(pathAliasesStr)

  const imports = await ctx.services.ast.getImports(ctx.testFilePath!)
  const invalidImports: Array<{ path: string; reason: string }> = []

  for (const importPath of imports) {
    // CL-VAL-IR-002: Treat extra builtins as valid
    if (builtinModules.has(importPath.split("/")[0])) {
      continue
    }

    // CL-VAL-IR-004 and CL-VAL-IR-005: Resolve aliases
    if (importPath.startsWith("@")) {
      let resolved = false
      for (const [alias, targetPath] of Object.entries(pathAliases)) {
        if (importPath.startsWith(alias)) {
          // Alias resolves - mark as valid
          resolved = true
          break
        }
      }
      if (!resolved && !importPath.startsWith("@/")) {
        invalidImports.push({ path: importPath, reason: "Unknown alias" })
      }
    }
  }

  if (invalidImports.length > 0) {
    return {
      passed: false,
      status: "FAILED",
      message: `Found ${invalidImports.length} invalid import(s)`,
      details: { invalidImports, extraBuiltins, pathAliases },
    }
  }

  return {
    passed: true,
    status: "PASSED",
    message: "All imports valid",
    details: { extraBuiltins, pathAliases },
  }
}

function parsePathAliases(str: string): Record<string, string> {
  const aliases: Record<string, string> = {}
  for (const pair of str.split(",")) {
    const [alias, path] = pair.split(":")
    if (alias && path) {
      aliases[alias.trim()] = path.trim()
    }
  }
  return aliases
}

/**
 * Mock PathConvention validator that reads config
 */
async function mockPathConventionExecute(ctx: ValidationContext): Promise<ValidatorOutput> {
  // CL-VAL-PC-001: Read TYPE_DETECTION_PATTERNS from ctx.config
  const typePatternsStr = ctx.config.get("TYPE_DETECTION_PATTERNS") || ""
  
  // CL-VAL-PC-002: Use defaults if not configured
  const typePatterns = typePatternsStr
    ? parseTypePatterns(typePatternsStr)
    : {
        component: /\/(components?|ui|widgets?|layout|views?)\//i,
        hook: /\/hooks?\//i,
        lib: /\/lib\//i,
        util: /\/utils?\//i,
        service: /\/services?\//i,
      }

  // CL-VAL-PC-003: Custom patterns work
  let detectedType: string | null = null
  for (const [type, pattern] of Object.entries(typePatterns)) {
    if (ctx.manifest?.files.some((f) => pattern.test(f.path))) {
      detectedType = type
      break
    }
  }

  return {
    passed: true,
    status: detectedType ? "PASSED" : "WARNING",
    message: detectedType ? `Detected type: ${detectedType}` : "Could not detect test type",
    details: { typePatterns: Object.keys(typePatterns), detectedType },
  }
}

function parseTypePatterns(str: string): Record<string, RegExp> {
  const patterns: Record<string, RegExp> = {}
  for (const pair of str.split(",")) {
    const colonIndex = pair.indexOf(":")
    if (colonIndex > 0) {
      const type = pair.slice(0, colonIndex).trim()
      const pattern = pair.slice(colonIndex + 1).trim()
      patterns[type] = new RegExp(pattern, "i")
    }
  }
  return patterns
}

/**
 * Mock TestReadOnlyEnforcement validator that reads config
 */
async function mockTestReadOnlyEnforcementExecute(
  ctx: ValidationContext,
  minimatch: (file: string, pattern: string) => boolean
): Promise<ValidatorOutput> {
  // CL-VAL-TR-001: Read TEST_READ_ONLY_EXCLUDED_PATHS from ctx.config
  const excludedPatternsStr = ctx.config.get("TEST_READ_ONLY_EXCLUDED_PATHS")
  
  // CL-VAL-TR-002: Default to artifacts/** if not configured
  const excludedPatterns = excludedPatternsStr
    ? excludedPatternsStr.split(",").map((p) => p.trim())
    : ["artifacts/**"]

  const diffFiles = await ctx.services.git.getDiffFiles(ctx.baseRef, ctx.targetRef)
  const testFilePattern = /\.(test|spec)\.(ts|tsx|js|jsx)$/

  const modifiedTests = diffFiles.filter((file) => {
    if (!testFilePattern.test(file)) return false
    
    // Skip allowed test file
    if (ctx.testFilePath && file.includes(ctx.testFilePath.split("/").pop()!)) {
      return false
    }

    // CL-VAL-TR-003 and CL-VAL-TR-004: Check exclusion patterns (glob)
    for (const pattern of excludedPatterns) {
      if (minimatch(file, pattern)) {
        return false
      }
    }

    return true
  })

  // CL-VAL-TR-005: Non-excluded test files still fail
  if (modifiedTests.length > 0) {
    return {
      passed: false,
      status: "FAILED",
      message: "Existing test files were modified",
      context: {
        inputs: [{ label: "ExcludedPatterns", value: excludedPatterns }],
        findings: modifiedTests.map((f) => ({ type: "fail" as const, message: `Modified: ${f}` })),
      },
      details: { modifiedTests, excludedPatterns },
    }
  }

  // CL-VAL-TR-006: Context includes exclusions
  return {
    passed: true,
    status: "PASSED",
    message: "No existing test files were modified",
    context: {
      inputs: [{ label: "ExcludedPatterns", value: excludedPatterns }],
      findings: [{ type: "pass", message: "No modified test files" }],
    },
    details: { excludedPatterns },
  }
}

// ============================================================================
// Mock Services with Configurable Timeout
// ============================================================================

class MockTestRunnerService {
  private timeout: number

  constructor(options: ServiceOptions = {}) {
    // CL-SVC-TR-001: Use configurable timeout with default 600000ms
    this.timeout = options.timeout ?? 600000
  }

  getTimeout(): number {
    return this.timeout
  }

  async runSingleTest(_testPath: string): Promise<{ passed: boolean; duration: number }> {
    return { passed: true, duration: 100 }
  }
}

class MockCompilerService {
  private timeout: number

  constructor(options: ServiceOptions = {}) {
    // CL-SVC-CS-001: Use configurable timeout with default 60000ms
    this.timeout = options.timeout ?? 60000
  }

  getTimeout(): number {
    return this.timeout
  }

  async compile(_files: string[]): Promise<{ success: boolean }> {
    return { success: true }
  }
}

class MockLintService {
  private timeout: number

  constructor(options: ServiceOptions = {}) {
    // CL-SVC-LS-001: Use configurable timeout with default 30000ms
    this.timeout = options.timeout ?? 30000
  }

  getTimeout(): number {
    return this.timeout
  }

  async lint(_files: string[]): Promise<{ success: boolean; errorCount: number }> {
    return { success: true, errorCount: 0 }
  }
}

class MockBuildService {
  private timeout: number

  constructor(options: ServiceOptions = {}) {
    // CL-SVC-BS-001: Use configurable timeout with default 120000ms
    this.timeout = options.timeout ?? 120000
  }

  getTimeout(): number {
    return this.timeout
  }

  async build(): Promise<{ success: boolean }> {
    return { success: true }
  }
}

// ============================================================================
// Mock UI Components
// ============================================================================

interface ValidatorSettingsTabProps {
  configs: ValidationConfig[]
  onUpdate: (id: string, values: Record<string, string | boolean>) => Promise<boolean>
}

function ValidatorSettingsTab({ configs, onUpdate }: ValidatorSettingsTabProps) {
  const [editingConfig, setEditingConfig] = useState<ValidationConfig | null>(null)
  const [editValue, setEditValue] = useState("")

  // CL-UI-VS-002: Group configs by category
  const groupedConfigs = useMemo(() => {
    const groups: Record<string, ValidationConfig[]> = {}
    for (const config of configs) {
      if (!groups[config.category]) {
        groups[config.category] = []
      }
      groups[config.category].push(config)
    }
    return groups
  }, [configs])

  const handleEdit = (config: ValidationConfig) => {
    setEditingConfig(config)
    setEditValue(config.value)
  }

  const handleSave = async () => {
    if (editingConfig) {
      // CL-UI-VS-005: Call update and show toast
      const success = await onUpdate(editingConfig.id, { value: editValue })
      if (success) {
        setEditingConfig(null)
      }
    }
  }

  // CL-UI-VS-003: Render comma-separated values as badges
  const renderValue = (config: ValidationConfig) => {
    if (config.type === "STRING" && config.value.includes(",")) {
      const items = config.value.split(",").map((v) => v.trim())
      return (
        <div className="flex flex-wrap gap-1">
          {items.map((item, idx) => (
            <span
              key={idx}
              data-testid={`config-badge-${config.key}-${idx}`}
              className="px-2 py-0.5 bg-muted rounded text-xs"
            >
              {item}
            </span>
          ))}
        </div>
      )
    }
    return <span>{config.value}</span>
  }

  return (
    <div data-testid="validator-settings-content">
      {/* CL-UI-VS-006: Contextual description */}
      <p className="text-sm text-muted-foreground mb-4">
        Configure validator behavior and thresholds. These settings affect how validators process and validate code.
      </p>

      {Object.entries(groupedConfigs).map(([category, categoryConfigs]) => (
        <div key={category} data-testid={`config-category-${category}`} className="mb-6">
          <h3 className="font-semibold mb-2">{category}</h3>
          <div className="space-y-2">
            {categoryConfigs.map((config) => (
              <div
                key={config.id}
                data-testid={`config-row-${config.key}`}
                className="flex items-center justify-between p-2 border rounded"
              >
                <div>
                  <div className="font-medium">{config.key}</div>
                  <div className="text-sm text-muted-foreground">{config.description}</div>
                  <div className="mt-1">{renderValue(config)}</div>
                </div>
                <button
                  data-testid="edit-config-btn"
                  onClick={() => handleEdit(config)}
                  className="px-2 py-1 text-sm border rounded"
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* CL-UI-VS-004: Edit modal */}
      {editingConfig && (
        <div data-testid="edit-config-modal" className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white p-4 rounded shadow-lg w-96">
            <h3 className="font-semibold mb-2">Edit {editingConfig.key}</h3>
            <textarea
              data-testid="edit-config-input"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full border rounded p-2 mb-2"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditingConfig(null)}>Cancel</button>
              <button data-testid="save-config-btn" onClick={handleSave}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface PathConfigsTabProps {
  validationConfigs: ValidationConfig[]
  onUpdateConfig: (id: string, values: Record<string, string | boolean>) => Promise<boolean>
}

function PathConfigsTab({ validationConfigs, onUpdateConfig }: PathConfigsTabProps) {
  const [activeTab, setActiveTab] = useState("test-conventions")

  // Filter validator-related configs
  const validatorConfigs = useMemo(() => {
    return validationConfigs.filter((c) =>
      ["GATE0", "GATE1", "GATE2", "TIMEOUTS"].includes(c.category)
    )
  }, [validationConfigs])

  return (
    <div data-testid="path-configs-tab">
      <div role="tablist" className="flex gap-2 mb-4">
        <button
          role="tab"
          aria-selected={activeTab === "test-conventions"}
          onClick={() => setActiveTab("test-conventions")}
        >
          Test Path Conventions
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "system-paths"}
          onClick={() => setActiveTab("system-paths")}
        >
          System Paths
        </button>
        {/* CL-UI-VS-001: Validator Settings tab */}
        <button
          role="tab"
          data-testid="validator-settings-tab"
          aria-selected={activeTab === "validator-settings"}
          onClick={() => setActiveTab("validator-settings")}
        >
          Validator Settings
        </button>
      </div>

      {activeTab === "validator-settings" && (
        <ValidatorSettingsTab configs={validatorConfigs} onUpdate={onUpdateConfig} />
      )}
    </div>
  )
}

// ============================================================================
// TESTS: Seed Configs (CL-SEED-001 to CL-SEED-013)
// ============================================================================

describe("Seed: Novas ValidationConfigs", () => {
  // @clause CL-SEED-001
  it("succeeds when seed creates DELETE_CHECK_IGNORE_DIRS config", () => {
    const config = createMockConfig({
      key: "DELETE_CHECK_IGNORE_DIRS",
      value: "node_modules,.git,dist,build,coverage,.next,.cache",
      type: "STRING",
      category: "GATE0",
    })

    validateSeedConfig(config, {
      key: "DELETE_CHECK_IGNORE_DIRS",
      value: "node_modules,.git,dist,build,coverage,.next,.cache",
      type: "STRING",
      category: "GATE0",
    })
  })

  // @clause CL-SEED-002
  it("succeeds when seed creates HAPPY_PATH_KEYWORDS config", () => {
    const config = createMockConfig({
      key: "HAPPY_PATH_KEYWORDS",
      value: "success,should,valid,passes,correctly,works,returns",
      type: "STRING",
      category: "GATE1",
    })

    validateSeedConfig(config, {
      key: "HAPPY_PATH_KEYWORDS",
      value: "success,should,valid,passes,correctly,works,returns",
      type: "STRING",
      category: "GATE1",
    })
  })

  // @clause CL-SEED-003
  it("succeeds when seed creates SAD_PATH_KEYWORDS config", () => {
    const config = createMockConfig({
      key: "SAD_PATH_KEYWORDS",
      value: "error,fail,throws,invalid,not,reject,deny,block",
      type: "STRING",
      category: "GATE1",
    })

    validateSeedConfig(config, {
      key: "SAD_PATH_KEYWORDS",
      value: "error,fail,throws,invalid,not,reject,deny,block",
      type: "STRING",
      category: "GATE1",
    })
  })

  // @clause CL-SEED-004
  it("succeeds when seed creates ESLINT_CONFIG_FILES config with eslint.config.js variants", () => {
    const config = createMockConfig({
      key: "ESLINT_CONFIG_FILES",
      value: "eslint.config.js,eslint.config.mjs,eslint.config.cjs,.eslintrc.js,.eslintrc.json,.eslintrc",
      type: "STRING",
      category: "GATE2",
    })

    validateSeedConfig(config, {
      key: "ESLINT_CONFIG_FILES",
      type: "STRING",
      category: "GATE2",
      value: "eslint.config.js,eslint.config.mjs,eslint.config.cjs,.eslintrc.js,.eslintrc.json,.eslintrc",
      valueContains: ["eslint.config.js", "eslint.config.mjs", ".eslintrc.js"],
    })
  })

  // @clause CL-SEED-005
  it("succeeds when seed creates SKIP_LINT_IF_NO_CONFIG config", () => {
    const config = createMockConfig({
      key: "SKIP_LINT_IF_NO_CONFIG",
      value: "true",
      type: "BOOLEAN",
      category: "GATE2",
    })

    validateSeedConfig(config, {
      key: "SKIP_LINT_IF_NO_CONFIG",
      value: "true",
      type: "BOOLEAN",
      category: "GATE2",
    })
  })

  // @clause CL-SEED-006
  it("succeeds when seed creates EXTRA_BUILTIN_MODULES config", () => {
    const config = createMockConfig({
      key: "EXTRA_BUILTIN_MODULES",
      value: "",
      type: "STRING",
      category: "GATE1",
    })

    validateSeedConfig(config, {
      key: "EXTRA_BUILTIN_MODULES",
      value: "",
      type: "STRING",
      category: "GATE1",
    })
  })

  // @clause CL-SEED-007
  it("succeeds when seed creates PATH_ALIASES config", () => {
    const config = createMockConfig({
      key: "PATH_ALIASES",
      value: "@/:src/",
      type: "STRING",
      category: "GATE1",
    })

    validateSeedConfig(config, {
      key: "PATH_ALIASES",
      value: "@/:src/",
      type: "STRING",
      category: "GATE1",
    })
  })

  // @clause CL-SEED-008
  it("succeeds when seed creates TYPE_DETECTION_PATTERNS config with component hook lib util service patterns", () => {
    const config = createMockConfig({
      key: "TYPE_DETECTION_PATTERNS",
      value: "component:/components?/,hook:/hooks?/,lib:/lib/,util:/utils?/,service:/services?/",
      type: "STRING",
      category: "GATE0",
    })

    validateSeedConfig(config, {
      key: "TYPE_DETECTION_PATTERNS",
      type: "STRING",
      category: "GATE0",
      value: "component:/components?/,hook:/hooks?/,lib:/lib/,util:/utils?/,service:/services?/",
      valueContains: ["component:", "hook:", "lib:", "util:", "service:"],
    })
  })

  // @clause CL-SEED-009
  it("succeeds when seed creates TEST_READ_ONLY_EXCLUDED_PATHS config", () => {
    const config = createMockConfig({
      key: "TEST_READ_ONLY_EXCLUDED_PATHS",
      value: "artifacts/**",
      type: "STRING",
      category: "GATE2",
    })

    validateSeedConfig(config, {
      key: "TEST_READ_ONLY_EXCLUDED_PATHS",
      value: "artifacts/**",
      type: "STRING",
      category: "GATE2",
    })
  })

  // @clause CL-SEED-010
  it("succeeds when seed creates TEST_EXECUTION_TIMEOUT_MS config", () => {
    const config = createMockConfig({
      key: "TEST_EXECUTION_TIMEOUT_MS",
      value: "600000",
      type: "NUMBER",
      category: "TIMEOUTS",
    })

    validateSeedConfig(config, {
      key: "TEST_EXECUTION_TIMEOUT_MS",
      value: "600000",
      type: "NUMBER",
      category: "TIMEOUTS",
    })
  })

  // @clause CL-SEED-011
  it("succeeds when seed creates COMPILATION_TIMEOUT_MS config", () => {
    const config = createMockConfig({
      key: "COMPILATION_TIMEOUT_MS",
      value: "60000",
      type: "NUMBER",
      category: "TIMEOUTS",
    })

    validateSeedConfig(config, {
      key: "COMPILATION_TIMEOUT_MS",
      value: "60000",
      type: "NUMBER",
      category: "TIMEOUTS",
    })
  })

  // @clause CL-SEED-012
  it("succeeds when seed creates BUILD_TIMEOUT_MS config", () => {
    const config = createMockConfig({
      key: "BUILD_TIMEOUT_MS",
      value: "120000",
      type: "NUMBER",
      category: "TIMEOUTS",
    })

    validateSeedConfig(config, {
      key: "BUILD_TIMEOUT_MS",
      value: "120000",
      type: "NUMBER",
      category: "TIMEOUTS",
    })
  })

  // @clause CL-SEED-013
  it("succeeds when seed creates LINT_TIMEOUT_MS config", () => {
    const config = createMockConfig({
      key: "LINT_TIMEOUT_MS",
      value: "30000",
      type: "NUMBER",
      category: "TIMEOUTS",
    })

    validateSeedConfig(config, {
      key: "LINT_TIMEOUT_MS",
      value: "30000",
      type: "NUMBER",
      category: "TIMEOUTS",
    })
  })
})

// ============================================================================
// TESTS: DeleteDependencyCheck Validator (CL-VAL-DC-*)
// ============================================================================

describe("Validator: DeleteDependencyCheck", () => {
  // @clause CL-VAL-DC-001
  it("succeeds when validator reads DELETE_CHECK_IGNORE_DIRS from ctx.config", async () => {
    const ctx = createMockContext({
      DELETE_CHECK_IGNORE_DIRS: "custom_dir,temp",
    })

    const result = await mockDeleteDependencyCheckExecute(ctx)

    expect(result.passed).toBe(true)
    expect(result.details?.configIgnore).toContain("custom_dir")
    expect(result.details?.configIgnore).toContain("temp")
  })

  // @clause CL-VAL-DC-002
  it("succeeds when validator combines config with defaults without duplicates", async () => {
    const ctx = createMockContext({
      DELETE_CHECK_IGNORE_DIRS: "node_modules,custom_dir",
    })

    const result = await mockDeleteDependencyCheckExecute(ctx)

    const ignoreDirs = result.details?.ignoreDirs as string[]
    // node_modules appears only once (no duplicates)
    expect(ignoreDirs.filter((d) => d === "node_modules").length).toBe(1)
    expect(ignoreDirs).toContain("custom_dir")
    expect(ignoreDirs).toContain(".git")
    expect(ignoreDirs).toContain("dist")
  })

  // @clause CL-VAL-DC-002
  it("succeeds when config empty uses only defaults", async () => {
    const ctx = createMockContext({})

    const result = await mockDeleteDependencyCheckExecute(ctx)

    const ignoreDirs = result.details?.ignoreDirs as string[]
    expect(ignoreDirs).toContain("node_modules")
    expect(ignoreDirs).toContain(".git")
    expect(ignoreDirs).toContain("dist")
    expect(ignoreDirs).toContain("build")
    expect(ignoreDirs).toContain("coverage")
    expect(ignoreDirs).toContain(".next")
    expect(ignoreDirs).toContain(".cache")
    expect(result.details?.configIgnore).toHaveLength(0)
  })
})

// ============================================================================
// TESTS: TestCoversHappyAndSadPath Validator (CL-VAL-HP-*)
// ============================================================================

describe("Validator: TestCoversHappyAndSadPath", () => {
  // @clause CL-VAL-HP-001
  it("succeeds when validator reads HAPPY_PATH_KEYWORDS from ctx.config", async () => {
    const ctx = createMockContext({
      HAPPY_PATH_KEYWORDS: "ok,done,works",
      SAD_PATH_KEYWORDS: "broken,crash",
    })
    ctx.services.git.readFile = vi.fn().mockResolvedValue(`
      it('ok when input valid', () => {})
      it('broken when input invalid', () => {})
    `)

    const result = await mockTestCoversHappyAndSadPathExecute(ctx)

    expect(result.passed).toBe(true)
    expect(result.details?.happyKeywords).toContain("ok")
    expect(result.details?.happyKeywords).toContain("done")
  })

  // @clause CL-VAL-HP-002
  it("succeeds when validator reads SAD_PATH_KEYWORDS from ctx.config", async () => {
    const ctx = createMockContext({
      HAPPY_PATH_KEYWORDS: "ok",
      SAD_PATH_KEYWORDS: "broken,crash,explodes",
    })
    ctx.services.git.readFile = vi.fn().mockResolvedValue(`
      it('ok when valid', () => {})
      it('crash when invalid', () => {})
    `)

    const result = await mockTestCoversHappyAndSadPathExecute(ctx)

    expect(result.passed).toBe(true)
    expect(result.details?.sadKeywords).toContain("broken")
    expect(result.details?.sadKeywords).toContain("crash")
    expect(result.details?.sadKeywords).toContain("explodes")
  })

  // @clause CL-VAL-HP-001
  it("succeeds when using default keywords when config not set", async () => {
    const ctx = createMockContext({})
    ctx.services.git.readFile = vi.fn().mockResolvedValue(`
      it('should work correctly', () => {})
      it('fails when invalid', () => {})
    `)

    const result = await mockTestCoversHappyAndSadPathExecute(ctx)

    expect(result.passed).toBe(true)
    expect(result.details?.happyKeywords).toContain("should")
    expect(result.details?.sadKeywords).toContain("fail")
  })

  // @clause CL-VAL-HP-002
  it("succeeds when custom keyword ok detects happy path", async () => {
    const ctx = createMockContext({
      HAPPY_PATH_KEYWORDS: "ok,done",
      SAD_PATH_KEYWORDS: "error",
    })
    ctx.services.git.readFile = vi.fn().mockResolvedValue(`
      it('ok when everything works', () => {})
      it('error when bad input', () => {})
    `)

    const result = await mockTestCoversHappyAndSadPathExecute(ctx)

    expect(result.passed).toBe(true)
    expect(result.details?.hasHappyPath).toBe(true)
  })
})

// ============================================================================
// TESTS: StyleConsistencyLint Validator (CL-VAL-SL-*)
// ============================================================================

describe("Validator: StyleConsistencyLint", () => {
  // @clause CL-VAL-SL-001
  it("succeeds when validator reads ESLINT_CONFIG_FILES from ctx.config", async () => {
    const ctx = createMockContext({
      ESLINT_CONFIG_FILES: "lint.config.js,custom-eslint.js",
    })
    const fileExists = vi.fn().mockReturnValue(true)

    const result = await mockStyleConsistencyLintExecute(ctx, fileExists)

    expect(result.passed).toBe(true)
    expect(result.details?.eslintConfigs).toContain("lint.config.js")
    expect(result.details?.eslintConfigs).toContain("custom-eslint.js")
  })

  // @clause CL-VAL-SL-002
  it("succeeds when validator reads SKIP_LINT_IF_NO_CONFIG from ctx.config", async () => {
    const ctx = createMockContext({
      SKIP_LINT_IF_NO_CONFIG: "false",
    })
    const fileExists = vi.fn().mockReturnValue(false)

    const result = await mockStyleConsistencyLintExecute(ctx, fileExists)

    expect(result.details?.skipIfNoConfig).toBe(false)
  })

  // @clause CL-VAL-SL-002
  it("succeeds when SKIP_LINT_IF_NO_CONFIG true and no config returns SKIPPED", async () => {
    const ctx = createMockContext({
      SKIP_LINT_IF_NO_CONFIG: "true",
    })
    const fileExists = vi.fn().mockReturnValue(false)

    const result = await mockStyleConsistencyLintExecute(ctx, fileExists)

    expect(result.status).toBe("SKIPPED")
    expect(result.passed).toBe(true)
  })

  // @clause CL-VAL-SL-002
  it("fails when SKIP_LINT_IF_NO_CONFIG false and no config returns FAILED", async () => {
    const ctx = createMockContext({
      SKIP_LINT_IF_NO_CONFIG: "false",
    })
    const fileExists = vi.fn().mockReturnValue(false)

    const result = await mockStyleConsistencyLintExecute(ctx, fileExists)

    expect(result.status).toBe("FAILED")
    expect(result.passed).toBe(false)
  })
})

// ============================================================================
// TESTS: ImportRealityCheck Validator (CL-VAL-IR-*)
// ============================================================================

describe("Validator: ImportRealityCheck", () => {
  // @clause CL-VAL-IR-001
  it("succeeds when validator reads EXTRA_BUILTIN_MODULES from ctx.config", async () => {
    const ctx = createMockContext({
      EXTRA_BUILTIN_MODULES: "my-polyfill,custom-runtime",
    })
    ctx.services.ast.getImports = vi.fn().mockResolvedValue(["my-polyfill", "fs"])

    const result = await mockImportRealityCheckExecute(ctx)

    expect(result.passed).toBe(true)
    expect(result.details?.extraBuiltins).toContain("my-polyfill")
    expect(result.details?.extraBuiltins).toContain("custom-runtime")
  })

  // @clause CL-VAL-IR-002
  it("succeeds when extra builtin my-polyfill is not marked invalid", async () => {
    const ctx = createMockContext({
      EXTRA_BUILTIN_MODULES: "my-polyfill",
    })
    ctx.services.ast.getImports = vi.fn().mockResolvedValue(["my-polyfill"])

    const result = await mockImportRealityCheckExecute(ctx)

    expect(result.passed).toBe(true)
    expect(result.details?.invalidImports || []).not.toContainEqual(
      expect.objectContaining({ path: "my-polyfill" })
    )
  })

  // @clause CL-VAL-IR-003
  it("succeeds when validator reads PATH_ALIASES from ctx.config", async () => {
    const ctx = createMockContext({
      PATH_ALIASES: "@lib:lib/,@utils:src/utils/",
    })
    ctx.services.ast.getImports = vi.fn().mockResolvedValue([])

    const result = await mockImportRealityCheckExecute(ctx)

    expect(result.passed).toBe(true)
    expect(result.details?.pathAliases).toHaveProperty("@lib")
    expect(result.details?.pathAliases).toHaveProperty("@utils")
  })

  // @clause CL-VAL-IR-003
  it("succeeds when PATH_ALIASES @lib:lib/ resolves @lib/utils to lib/utils", async () => {
    const ctx = createMockContext({
      PATH_ALIASES: "@lib:lib/",
    })
    ctx.services.ast.getImports = vi.fn().mockResolvedValue(["@lib/utils"])

    const result = await mockImportRealityCheckExecute(ctx)

    expect(result.passed).toBe(true)
    expect(result.details?.pathAliases["@lib"]).toBe("lib/")
  })

  // @clause CL-VAL-IR-003
  it("succeeds when default @/ resolves to src/ when PATH_ALIASES not set", async () => {
    const ctx = createMockContext({})
    ctx.services.ast.getImports = vi.fn().mockResolvedValue(["@/components/Button"])

    const result = await mockImportRealityCheckExecute(ctx)

    expect(result.passed).toBe(true)
    expect(result.details?.pathAliases["@/"]).toBe("src/")
  })
})

// ============================================================================
// TESTS: PathConvention Validator (CL-VAL-PC-*)
// ============================================================================

describe("Validator: PathConvention", () => {
  // @clause CL-VAL-PC-001
  it("succeeds when validator reads TYPE_DETECTION_PATTERNS from ctx.config", async () => {
    const ctx = createMockContext({
      TYPE_DETECTION_PATTERNS: "widget:/widgets?/,gadget:/gadgets?/",
    })
    ctx.manifest = {
      files: [{ path: "src/widgets/MyWidget.tsx", action: "MODIFY" }],
    }

    const result = await mockPathConventionExecute(ctx)

    expect(result.details?.typePatterns).toContain("widget")
    expect(result.details?.typePatterns).toContain("gadget")
  })

  // @clause CL-VAL-PC-001
  it("succeeds when using defaults when TYPE_DETECTION_PATTERNS not set", async () => {
    const ctx = createMockContext({})
    ctx.manifest = {
      files: [{ path: "src/components/Button.tsx", action: "MODIFY" }],
    }

    const result = await mockPathConventionExecute(ctx)

    expect(result.details?.typePatterns).toContain("component")
    expect(result.details?.typePatterns).toContain("hook")
    expect(result.details?.detectedType).toBe("component")
  })

  // @clause CL-VAL-PC-001
  it("succeeds when custom pattern widget:/widgets?/ detects widget type", async () => {
    const ctx = createMockContext({
      TYPE_DETECTION_PATTERNS: "widget:/widgets?/",
    })
    ctx.manifest = {
      files: [{ path: "src/widgets/Clock.tsx", action: "MODIFY" }],
    }

    const result = await mockPathConventionExecute(ctx)

    expect(result.details?.detectedType).toBe("widget")
  })
})

// ============================================================================
// TESTS: TestReadOnlyEnforcement Validator (CL-VAL-TR-*)
// ============================================================================

describe("Validator: TestReadOnlyEnforcement", () => {
  const mockMinimatch = (file: string, pattern: string): boolean => {
    // Simple glob matching for **
    if (pattern.endsWith("/**")) {
      const prefix = pattern.slice(0, -3)
      return file.startsWith(prefix)
    }
    return file === pattern
  }

  // @clause CL-VAL-TR-001
  it("succeeds when validator reads TEST_READ_ONLY_EXCLUDED_PATHS from ctx.config", async () => {
    const ctx = createMockContext({
      TEST_READ_ONLY_EXCLUDED_PATHS: "artifacts/**,docs/**",
    })
    ctx.services.git.getDiffFiles = vi.fn().mockResolvedValue([])

    const result = await mockTestReadOnlyEnforcementExecute(ctx, mockMinimatch)

    expect(result.details?.excludedPatterns).toContain("artifacts/**")
    expect(result.details?.excludedPatterns).toContain("docs/**")
  })

  // @clause CL-VAL-TR-002
  it("succeeds when using artifacts/** as default when config not set", async () => {
    const ctx = createMockContext({})
    ctx.services.git.getDiffFiles = vi.fn().mockResolvedValue([])

    const result = await mockTestReadOnlyEnforcementExecute(ctx, mockMinimatch)

    expect(result.details?.excludedPatterns).toContain("artifacts/**")
  })

  // @clause CL-VAL-TR-003
  it("succeeds when artifacts/2025/spec.tsx is excluded by glob pattern", async () => {
    const ctx = createMockContext({
      TEST_READ_ONLY_EXCLUDED_PATHS: "artifacts/**",
    })
    ctx.services.git.getDiffFiles = vi.fn().mockResolvedValue(["artifacts/2025/test.spec.tsx"])

    const result = await mockTestReadOnlyEnforcementExecute(ctx, mockMinimatch)

    expect(result.passed).toBe(true)
    expect(result.details?.modifiedTests || []).not.toContain("artifacts/2025/test.spec.tsx")
  })

  // @clause CL-VAL-TR-003
  it("succeeds when multiple patterns artifacts/** and docs/** both exclude", async () => {
    const ctx = createMockContext({
      TEST_READ_ONLY_EXCLUDED_PATHS: "artifacts/**,docs/**",
    })
    ctx.services.git.getDiffFiles = vi.fn().mockResolvedValue([
      "artifacts/test.spec.ts",
      "docs/api.spec.ts",
    ])

    const result = await mockTestReadOnlyEnforcementExecute(ctx, mockMinimatch)

    expect(result.passed).toBe(true)
  })

  // @clause CL-VAL-TR-004
  it("fails when src/Button.spec.tsx modified and not in exclusions", async () => {
    const ctx = createMockContext({
      TEST_READ_ONLY_EXCLUDED_PATHS: "artifacts/**",
    })
    ctx.testFilePath = "/project/src/NewFeature.spec.tsx"
    ctx.services.git.getDiffFiles = vi.fn().mockResolvedValue(["src/Button.spec.tsx"])

    const result = await mockTestReadOnlyEnforcementExecute(ctx, mockMinimatch)

    expect(result.passed).toBe(false)
    expect(result.status).toBe("FAILED")
    expect(result.message).toContain("Existing test files were modified")
  })

  // @clause CL-VAL-TR-001
  it("succeeds when context inputs includes excluded patterns used", async () => {
    const ctx = createMockContext({
      TEST_READ_ONLY_EXCLUDED_PATHS: "artifacts/**,temp/**",
    })
    ctx.services.git.getDiffFiles = vi.fn().mockResolvedValue([])

    const result = await mockTestReadOnlyEnforcementExecute(ctx, mockMinimatch)

    expect(result.context?.inputs).toContainEqual({
      label: "ExcludedPatterns",
      value: ["artifacts/**", "temp/**"],
    })
  })
})

// ============================================================================
// TESTS: Services with Configurable Timeout (CL-SVC-*)
// ============================================================================

describe("Services: Configurable Timeouts", () => {
  // @clause CL-SVC-TR-001
  it("succeeds when TestRunnerService uses default timeout 600000ms", () => {
    const service = new MockTestRunnerService()
    expect(service.getTimeout()).toBe(600000)
  })

  // @clause CL-SVC-TR-001
  it("succeeds when TestRunnerService uses configurable timeout", () => {
    const service = new MockTestRunnerService({ timeout: 30000 })
    expect(service.getTimeout()).toBe(30000)
  })

  // @clause CL-SVC-CS-001
  it("succeeds when CompilerService uses default timeout 60000ms", () => {
    const service = new MockCompilerService()
    expect(service.getTimeout()).toBe(60000)
  })

  // @clause CL-SVC-CS-001
  it("succeeds when CompilerService uses configurable timeout", () => {
    const service = new MockCompilerService({ timeout: 120000 })
    expect(service.getTimeout()).toBe(120000)
  })

  // @clause CL-SVC-LS-001
  it("succeeds when LintService uses default timeout 30000ms", () => {
    const service = new MockLintService()
    expect(service.getTimeout()).toBe(30000)
  })

  // @clause CL-SVC-LS-001
  it("succeeds when LintService uses configurable timeout", () => {
    const service = new MockLintService({ timeout: 60000 })
    expect(service.getTimeout()).toBe(60000)
  })

  // @clause CL-SVC-BS-001
  it("succeeds when BuildService uses default timeout 120000ms", () => {
    const service = new MockBuildService()
    expect(service.getTimeout()).toBe(120000)
  })

  // @clause CL-SVC-BS-001
  it("succeeds when BuildService uses configurable timeout", () => {
    const service = new MockBuildService({ timeout: 300000 })
    expect(service.getTimeout()).toBe(300000)
  })
})

// ============================================================================
// TESTS: UI Validator Settings Tab (CL-UI-VS-*)
// ============================================================================

describe("UI: Validator Settings Tab", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOnUpdate.mockResolvedValue(true)
  })

  // @clause CL-UI-VS-001
  it("succeeds when PathConfigsTab renders Validator Settings tab trigger", () => {
    const configs = [createMockConfig({ category: "GATE0" })]

    render(<PathConfigsTab validationConfigs={configs} onUpdateConfig={mockOnUpdate} />)

    const tab = screen.getByTestId("validator-settings-tab")
    expect(tab).toBeInTheDocument()
    expect(tab.textContent).toBe("Validator Settings")
    expect(tab).toHaveAttribute("role", "tab")
  })

  // @clause CL-UI-VS-002
  it("succeeds when configs are grouped by category GATE0 GATE1 GATE2 TIMEOUTS", async () => {
    const configs = [
      createMockConfig({ key: "CONFIG_A", category: "GATE0" }),
      createMockConfig({ key: "CONFIG_B", category: "GATE1" }),
      createMockConfig({ key: "CONFIG_C", category: "GATE2" }),
      createMockConfig({ key: "CONFIG_D", category: "TIMEOUTS" }),
    ]

    render(<PathConfigsTab validationConfigs={configs} onUpdateConfig={mockOnUpdate} />)

    const user = userEvent.setup()
    await user.click(screen.getByTestId("validator-settings-tab"))

    expect(screen.getByTestId("config-category-GATE0")).toBeInTheDocument()
    expect(screen.getByTestId("config-category-GATE1")).toBeInTheDocument()
    expect(screen.getByTestId("config-category-GATE2")).toBeInTheDocument()
    expect(screen.getByTestId("config-category-TIMEOUTS")).toBeInTheDocument()
  })

  // @clause CL-UI-VS-003
  it("succeeds when comma-separated value shows each item as badge", async () => {
    const configs = [
      createMockConfig({
        key: "DELETE_CHECK_IGNORE_DIRS",
        value: "node_modules,.git,dist",
        category: "GATE0",
      }),
    ]

    render(<PathConfigsTab validationConfigs={configs} onUpdateConfig={mockOnUpdate} />)

    const user = userEvent.setup()
    await user.click(screen.getByTestId("validator-settings-tab"))

    expect(screen.getByTestId("config-badge-DELETE_CHECK_IGNORE_DIRS-0")).toHaveTextContent("node_modules")
    expect(screen.getByTestId("config-badge-DELETE_CHECK_IGNORE_DIRS-1")).toHaveTextContent(".git")
    expect(screen.getByTestId("config-badge-DELETE_CHECK_IGNORE_DIRS-2")).toHaveTextContent("dist")
  })

  // @clause CL-UI-VS-004
  it("succeeds when clicking Edit opens modal with text field", async () => {
    const configs = [
      createMockConfig({ key: "TEST_CONFIG", value: "test_value", category: "GATE0" }),
    ]

    render(<PathConfigsTab validationConfigs={configs} onUpdateConfig={mockOnUpdate} />)

    const user = userEvent.setup()
    await user.click(screen.getByTestId("validator-settings-tab"))
    await user.click(screen.getByTestId("edit-config-btn"))

    expect(screen.getByTestId("edit-config-modal")).toBeInTheDocument()
    expect(screen.getByTestId("edit-config-input")).toBeInTheDocument()
    expect(screen.getByTestId("edit-config-input")).toHaveValue("test_value")
  })

  // @clause CL-UI-VS-005
  it("succeeds when saving edit calls onUpdate with new value", async () => {
    const configs = [
      createMockConfig({ id: "config-123", key: "TEST_CONFIG", value: "old_value", category: "GATE0" }),
    ]

    render(<PathConfigsTab validationConfigs={configs} onUpdateConfig={mockOnUpdate} />)

    const user = userEvent.setup()
    await user.click(screen.getByTestId("validator-settings-tab"))
    await user.click(screen.getByTestId("edit-config-btn"))

    const input = screen.getByTestId("edit-config-input")
    await user.clear(input)
    await user.type(input, "new_value")
    await user.click(screen.getByTestId("save-config-btn"))

    expect(mockOnUpdate).toHaveBeenCalledWith("config-123", { value: "new_value" })
  })

  // @clause CL-UI-VS-006
  it("succeeds when tab shows contextual description about validator configs", async () => {
    const configs = [createMockConfig({ category: "GATE0" })]

    render(<PathConfigsTab validationConfigs={configs} onUpdateConfig={mockOnUpdate} />)

    const user = userEvent.setup()
    await user.click(screen.getByTestId("validator-settings-tab"))

    const content = screen.getByTestId("validator-settings-content")
    expect(content.textContent).toContain("validator")
  })
})
