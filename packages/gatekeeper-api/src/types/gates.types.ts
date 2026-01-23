export type GateNumber = 0 | 1 | 2 | 3

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
  | 'TOKEN_BUDGET_FIT'
  | 'TASK_SCOPE_SIZE'
  | 'TASK_CLARITY_CHECK'
  | 'SENSITIVE_FILES_LOCK'
  | 'DANGER_MODE_EXPLICIT'
  | 'PATH_CONVENTION'
  | 'TEST_SYNTAX_VALID'
  | 'TEST_HAS_ASSERTIONS'
  | 'TEST_COVERS_HAPPY_AND_SAD_PATH'
  | 'TEST_FAILS_BEFORE_IMPLEMENTATION'
  | 'NO_DECORATIVE_TESTS'
  | 'MANIFEST_FILE_LOCK'
  | 'NO_IMPLICIT_FILES'
  | 'IMPORT_REALITY_CHECK'
  | 'TEST_INTENT_ALIGNMENT'
  | 'TEST_CLAUSE_MAPPING_VALID'
  | 'DIFF_SCOPE_ENFORCEMENT'
  | 'TEST_READ_ONLY_ENFORCEMENT'
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

export interface ManifestInput {
  files: ManifestFileEntry[]
  testFile: string
}

export interface ContractClause {
  id: string
  kind: 'behavior' | 'error' | 'invariant' | 'ui' | 'constraint'
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
  ui?: {
    routes?: string[]
    testIds?: string[]
    roles?: string[]
    ariaLabels?: string[]
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

export interface ValidationContext {
  runId: string
  projectPath: string
  baseRef: string
  targetRef: string
  taskPrompt: string
  manifest: ManifestInput | null
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
}

export interface ValidatorOutput {
  passed: boolean
  status: ValidatorStatus
  message: string
  details?: Record<string, unknown>
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
