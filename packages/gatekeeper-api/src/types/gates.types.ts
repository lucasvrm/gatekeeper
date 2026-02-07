export type GateNumber = 0 | 1 | 2 | 3

export type ValidatorCategory =
  | 'INPUT_SCOPE'
  | 'FILE_DISCIPLINE'
  | 'SECURITY'
  | 'TECHNICAL_QUALITY'
  | 'TESTS_CONTRACTS'

export type ValidatorStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'PASSED'
  | 'FAILED'
  | 'WARNING'
  | 'SKIPPED'

export type RunStatus = 
  | 'PENDING'
  | 'RUNNING'
  | 'PASSED'
  | 'FAILED'
  | 'ABORTED'

export type ValidatorCode =
  | 'TASK_CLARITY_CHECK'
  | 'SENSITIVE_FILES_LOCK'
  | 'DANGER_MODE_EXPLICIT'
  | 'PATH_CONVENTION'
  | 'DELETE_DEPENDENCY_CHECK'
  | 'TEST_SYNTAX_VALID'
  | 'TEST_HAS_ASSERTIONS'
  | 'TEST_COVERS_HAPPY_AND_SAD_PATH'
  | 'TEST_FAILS_BEFORE_IMPLEMENTATION'
  | 'NO_DECORATIVE_TESTS'
  | 'TEST_RESILIENCE_CHECK'
  | 'NO_IMPLICIT_FILES'
  | 'IMPORT_REALITY_CHECK'
  | 'TEST_INTENT_ALIGNMENT'
  | 'TEST_READ_ONLY_ENFORCEMENT'
  | 'UI_COMPONENT_REGISTRY'
  | 'UI_PROPS_COMPLIANCE'
  | 'TASK_TEST_PASSES'
  | 'STRICT_COMPILATION'
  | 'STYLE_CONSISTENCY_LINT'
  | 'FULL_REGRESSION_PASS'
  | 'PRODUCTION_BUILD_PASS'

export type ManifestAction = 'CREATE' | 'MODIFY' | 'DELETE'

export interface ManifestFileEntry {
  path: string
  action: ManifestAction
  reason?: string
}

/**
 * @deprecated Use MicroplansDocument instead. Microplans provide atomic, dependency-aware execution.
 */
export interface ManifestInput {
  files: ManifestFileEntry[]
  testFile: string
}

// ─── Microplans (replaces plan.json monolith) ───────────────────────────────

export type MicroplanAction = 'CREATE' | 'EDIT' | 'DELETE'

export interface MicroplanFile {
  path: string
  action: MicroplanAction
  what: string
}

export interface Microplan {
  id: string
  goal: string
  depends_on: string[]
  files: MicroplanFile[]
  verify: string
}

export interface MicroplansDocument {
  task: string
  microplans: Microplan[]
}

export interface ContractClause {
  id: string
  kind: 'behavior' | 'error' | 'invariant' | 'constraint'
  normativity: 'MUST' | 'SHOULD' | 'MAY'
  when: string
  then: string
}

export interface AssertionSurface {
  http?: {
    methods?: string[]
    successStatuses?: number[]
    errorStatuses?: number[]
    payloadPaths?: string[]
  }
  effects?: string[]
}

export interface TestMapping {
  tagPattern?: string
}

export interface ContractInput {
  schemaVersion: string
  slug: string
  title: string
  mode: string
  changeType: string
  criticality?: string
  clauses: ContractClause[]
  assertionSurface?: AssertionSurface
  testMapping?: TestMapping
}

export interface GitService {
  diff(baseRef: string, targetRef: string): Promise<string>
  readFile(filePath: string, ref?: string): Promise<string>
  checkout(ref: string): Promise<void>
  stash(): Promise<void>
  stashPop(): Promise<void>
  createWorktree(ref: string, path: string): Promise<void>
  removeWorktree(path: string): Promise<void>
  getDiffFiles(baseRef: string, targetRef: string): Promise<string[]>
  getDiffFilesWithWorkingTree(baseRef: string): Promise<string[]>
  getCurrentRef(): Promise<string>
}

export interface TestBlock {
  name: string
  startLine: number
  precedingComments: string[]
}

export interface ASTService {
  parseFile(filePath: string): Promise<unknown>
  getImports(filePath: string): Promise<string[]>
  getTestBlocksWithComments(filePath: string): Promise<TestBlock[]>
}

export interface TestRunnerService {
  runSingleTest(testPath: string): Promise<TestResult>
  runAllTests(): Promise<TestResult>
}

export interface CompilerService {
  compile(path?: string): Promise<CompileResult>
}

export interface LintService {
  lint(paths: string[]): Promise<LintResult>
}

export interface BuildService {
  build(): Promise<BuildResult>
}

export interface TokenCounterService {
  count(text: string): number
}

export interface LogService {
  debug(message: string, metadata?: Record<string, unknown>): void
  info(message: string, metadata?: Record<string, unknown>): void
  warn(message: string, metadata?: Record<string, unknown>): void
  error(message: string, metadata?: Record<string, unknown>): void
}

export interface SandboxResult {
  success: boolean
  sandboxPath: string
  junctionCreated: boolean
  error?: string
}

export interface SandboxService {
  create(originalProjectPath: string, sandboxBasePath: string, targetRef: string): Promise<SandboxResult>
  createNodeModulesJunction(originalProjectPath: string, sandboxPath: string): Promise<{ success: boolean; error?: string }>
  cleanup(sandboxPath: string): Promise<void>
}

export interface UIComponentProp {
  type: string
  required: boolean
  description: string
  default?: unknown
  enumValues?: string[]
}

export interface UIComponentSlot {
  name: string
  description?: string
}

export interface UIComponentVariant {
  name: string
  props?: Record<string, unknown>
}

export interface UIComponentExample {
  title?: string
  code: string
}

export interface UIRegistryComponent {
  name: string
  category: string
  description?: string
  source?: string
  props: Record<string, UIComponentProp>
  slots: UIComponentSlot[]
  variants: UIComponentVariant[]
  examples: UIComponentExample[]
  tags: string[]
}

export interface UIRegistryContract {
  $orqui?: { version: string }
  components: Record<string, UIRegistryComponent>
}

export interface LayoutContract {
  $orqui?: { version: string }
  structure?: unknown
  tokens?: unknown
  textStyles?: unknown
}

export interface OrquiLock {
  version: string
  generatedAt?: string
  contracts?: string[]
}

export interface UIContracts {
  registry: UIRegistryContract | null
  layout: LayoutContract | null
  lock: OrquiLock | null
}

export interface ValidationContext {
  runId: string
  projectPath: string
  baseRef: string
  targetRef: string
  taskPrompt: string
  microplan: Microplan | null
  /** @deprecated Use microplan.files instead */
  manifest: ManifestInput | null
  /** @deprecated Use microplan.verify instead */
  contract: ContractInput | null
  testFilePath: string | null
  dangerMode: boolean
  services: {
    git: GitService
    ast: ASTService
    testRunner: TestRunnerService
    compiler: CompilerService
    lint: LintService
    build: BuildService
    tokenCounter: TokenCounterService
    log: LogService
  }
  config: Map<string, string>
  sensitivePatterns: string[]
  ambiguousTerms: string[]
  bypassedValidators: Set<string>
  uiContracts: UIContracts | null
}

export interface ValidatorContextInput {
  label: string
  value: string | number | boolean | string[] | Record<string, unknown> | ManifestInput
}

export interface ValidatorContextAnalyzedGroup {
  label: string
  items: string[]
}

export interface ValidatorContextFinding {
  type: 'pass' | 'fail' | 'warning' | 'info'
  message: string
  location?: string
}

export interface ValidatorContext {
  inputs: ValidatorContextInput[]
  analyzed: ValidatorContextAnalyzedGroup[]
  findings: ValidatorContextFinding[]
  reasoning: string
}

export interface ValidatorOutput {
  passed: boolean
  status: ValidatorStatus
  message: string
  details?: Record<string, unknown>
  context?: ValidatorContext
  evidence?: string
  metrics?: Record<string, number | string>
}

export interface ValidatorDefinition {
  code: ValidatorCode
  name: string
  description: string
  gate: GateNumber
  order: number
  isHardBlock: boolean
  execute: (ctx: ValidationContext) => Promise<ValidatorOutput>
}

export interface GateDefinition {
  number: GateNumber
  name: string
  emoji: string
  description: string
  validators: ValidatorDefinition[]
}

export interface TestResult {
  passed: boolean
  exitCode: number
  output: string
  error?: string
  duration: number
}

export interface CompileResult {
  success: boolean
  errors: string[]
  output: string
}

export interface LintResult {
  success: boolean
  errorCount: number
  warningCount: number
  output: string
}

export interface BuildResult {
  success: boolean
  exitCode: number
  output: string
}
