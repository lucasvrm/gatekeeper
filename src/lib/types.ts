export type RunStatus = "PENDING" | "RUNNING" | "PASSED" | "FAILED" | "ABORTED"
export type ValidatorStatus = "PENDING" | "RUNNING" | "PASSED" | "FAILED" | "WARNING" | "SKIPPED"

export type ValidatorCategory =
  | "INPUT_SCOPE"
  | "FILE_DISCIPLINE"
  | "SECURITY"
  | "TECHNICAL_QUALITY"
  | "TESTS_CONTRACTS"

export interface Workspace {
  id: string
  name: string
  description?: string
  rootPath: string
  artifactsDir: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count?: {
    projects: number
    workspaceConfigs: number
    testPathConventions?: number
  }
}

export interface Project {
  id: string
  workspaceId: string
  workspace?: {
    id: string
    name: string
    rootPath?: string
    artifactsDir?: string
  }
  name: string
  description?: string
  baseRef: string
  targetRef: string
  backendWorkspace?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count?: {
    validationRuns: number
  }
}

export interface ArtifactFolder {
  outputId: string
  hasSpec: boolean
  hasPlan: boolean
  specFileName: string | null
  createdAt: string
}

export interface ArtifactContents {
  planJson: LLMPlanOutput | null
  specContent: string | null
  specFileName: string | null
}

export type ArtifactInputMode = "dropdown" | "autocomplete" | "upload"

export interface WorkspaceConfig {
  id: string
  workspaceId: string
  key: string
  value: string
  type: 'STRING' | 'NUMBER' | 'BOOLEAN'
  category: string
  description?: string
  updatedAt: string
}

export interface Run {
  id: string
  projectId?: string
  project?: {
    id: string
    name: string
    workspace?: {
      id: string
      name: string
    }
  }
  outputId: string
  projectPath: string
  baseRef: string
  targetRef: string
  taskPrompt?: string
  contractJson?: string
  manifestJson: string
  testFilePath: string
  dangerMode: boolean
  runType: 'CONTRACT' | 'EXECUTION'
  contractRunId?: string
  status: RunStatus
  commitHash?: string | null
  commitMessage?: string | null
  committedAt?: string | null
  currentGate: number
  passed?: boolean
  failedAt?: number
  failedValidatorCode?: string | null
  createdAt: string
  updatedAt?: string
}

export interface GateResult {
  gateNumber: number
  gateName: string
  status: ValidatorStatus
  passed: boolean
  passedCount: number
  failedCount: number
  warningCount: number
  skippedCount: number
  completedAt?: Date
  startedAt?: Date
  durationMs?: number
}

export interface ValidatorResult {
  gateNumber: number
  validatorCode: string
  validatorName: string
  status: ValidatorStatus
  passed: boolean
  isHardBlock: boolean
  bypassed?: boolean
  message?: string
  details?: string
  evidence?: string
}

export interface ValidatorContextInput {
  label: string
  value: string | number | boolean | string[] | Record<string, unknown>
}

export interface ValidatorContextAnalyzedGroup {
  label: string
  items: string[]
}

export interface ValidatorContextFinding {
  type: "pass" | "fail" | "warning" | "info"
  message: string
  location?: string
}

export interface ValidatorContext {
  inputs: ValidatorContextInput[]
  analyzed: ValidatorContextAnalyzedGroup[]
  findings: ValidatorContextFinding[]
  reasoning: string
}

export interface RunWithResults extends Run {
  gateResults: GateResult[]
  validatorResults: ValidatorResult[]
  executionRuns?: Run[]
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export interface Gate {
  number: number
  name: string
  emoji: string
  description: string
  validatorCount: number
}

export interface Validator {
  code: string
  name: string
  description: string
  order: number
  isHardBlock: boolean
}

export type FailMode = "HARD" | "WARNING" | null

export interface ConfigItem {
  id: string
  key: string
  value: string | number | boolean
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

export interface ManifestFile {
  path: string
  action: "CREATE" | "MODIFY" | "DELETE"
  reason?: string
}

export interface ValidationManifest {
  files: ManifestFile[]
  testFile: string
}

export interface ContractClause {
  id: string
  kind: 'behavior' | 'error' | 'invariant' | 'ui'
  normativity: 'MUST' | 'SHOULD' | 'MAY'
  when: string
  then: string
}

export interface AssertionSurfaceHttp {
  methods?: string[]
  successStatuses?: number[]
  errorStatuses?: number[]
  payloadPaths?: string[]
}

export interface AssertionSurfaceUi {
  routes?: string[]
  testIds?: string[]
  roles?: string[]
  ariaLabels?: string[]
}

export interface AssertionSurface {
  http?: AssertionSurfaceHttp
  ui?: AssertionSurfaceUi
  effects?: string[]
}

export interface TestMapping {
  tagPattern?: string
}

export interface Contract {
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

export interface LLMPlanOutput {
  outputId: string
  projectPath?: string
  baseRef: string
  targetRef: string
  taskPrompt: string
  dangerMode: boolean
  manifest: ValidationManifest
  contract?: Contract
}

export interface CreateRunRequest {
  projectId?: string
  outputId: string
  projectPath?: string
  taskPrompt: string
  manifest: ValidationManifest
  contract?: Contract
  baseRef?: string
  targetRef?: string
  dangerMode?: boolean
  runType?: 'CONTRACT' | 'EXECUTION'
  contractRunId?: string
}

export interface CreateRunResponse {
  runId: string
  outputId: string
  status: RunStatus
  createdAt: string
}

export interface GitStatusResponse {
  hasChanges: boolean
  hasConflicts: boolean
  branch: string
  isProtected: boolean
  diffStat: string
}

export interface GitCommitResponse {
  commitHash: string
  message: string
}

export interface GitPushResponse {
  branch: string
  commitHash: string
}

export interface GitFetchStatusResponse {
  fetchOutput: string
  statusText: string
}

export interface GitDiffResponse {
  filePath: string
  status: "modified" | "added" | "deleted"
  diff: string
}

export interface GitChangedFile {
  path: string
  status: string
}

export interface GitErrorResponse {
  error: {
    code: 'NO_CHANGES' | 'HAS_CONFLICTS' | 'REMOTE_AHEAD' | 'PERMISSION_DENIED' | 'COMMIT_FAILED' | 'PUSH_FAILED'
    message: string
  }
}

// MCP Session Types
export type GitStrategy = "main" | "new-branch" | "existing-branch"
export type TaskType = "bugfix" | "feature" | "refactor" | "test" | "other"

export interface MCPSessionConfig {
  activeProfileId: string | null
  gitStrategy: GitStrategy
  branch: string
  taskType: TaskType
  projectId: string | null
  docsDir: string
}

// Session Profile
export interface SessionProfile {
  id: string
  name: string
  taskType: TaskType
  gitStrategy: GitStrategy
  branch: string | null
  docsDir: string | null
  createdAt: string
  updatedAt: string
  prompts: PromptInstruction[]
}

// Agent Pipeline Phase Config
export type ProviderName = string

export interface AgentPhaseConfig {
  step: number  // 1=Planner, 2=Spec, 3=Fixer, 4=Coder
  provider: ProviderName
  model: string
  maxTokens: number
  maxIterations: number
  maxInputTokensBudget: number  // 0 = unlimited
  temperature: number | null
  fallbackProvider: ProviderName | null
  fallbackModel: string | null
  createdAt: string
  updatedAt: string
}

export const STEP_LABELS: Record<number, string> = {
  1: 'Planner',
  2: 'Spec Writer',
  3: 'Fixer',
  4: 'Coder',
}

export interface MCPStatus {
  gatekeeperApi: "online" | "offline"
  database: "connected" | "disconnected"
  docsDir: "accessible" | "not-found" | "not-configured"
  git: string
}

// Prompt Instructions
export interface PromptInstruction {
  id: string
  name: string
  content: string
  step: number | null  // null = session prompt, 1-4 = pipeline step
  kind: string | null  // 'instruction' | 'doc' | 'prompt' | 'cli' | null
  role: 'system' | 'user'  // 'system' = system prompt, 'user' = user message template
  order: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// Placeholders available for user message templates by step
export const USER_MESSAGE_PLACEHOLDERS: Record<number, Array<{ name: string; description: string }>> = {
  1: [
    { name: 'taskDescription', description: 'Descrição da tarefa' },
    { name: 'taskType', description: 'Tipo da tarefa (bugfix, feature, etc.)' },
    { name: 'outputId', description: 'ID único da saída do pipeline' },
    { name: 'attachments', description: 'Arquivos anexados (formatados)' },
  ],
  2: [
    { name: 'outputId', description: 'ID único da saída do pipeline' },
    { name: 'testFileName', description: 'Nome do arquivo de teste esperado' },
    { name: 'artifactBlocks', description: 'Artefatos do Step 1 formatados' },
  ],
  3: [
    { name: 'target', description: 'Alvo da correção (plan ou spec)' },
    { name: 'outputId', description: 'ID único da saída do pipeline' },
    { name: 'failedValidators', description: 'Lista de validadores que falharam' },
    { name: 'rejectionReport', description: 'Relatório de rejeição detalhado' },
    { name: 'taskPrompt', description: 'Prompt original da tarefa' },
    { name: 'artifactBlocks', description: 'Artefatos atuais formatados' },
    { name: 'outputDir', description: 'Diretório de saída (CLI mode)' },
    { name: 'artifactFiles', description: 'Lista de arquivos de artefatos (CLI mode)' },
    { name: 'specFiles', description: 'Nomes dos arquivos de spec (CLI mode)' },
    { name: 'isSpec', description: 'Boolean se target é spec (CLI mode)' },
  ],
  4: [
    { name: 'outputId', description: 'ID único da saída do pipeline' },
    { name: 'artifactBlocks', description: 'Artefatos aprovados formatados' },
  ],
}

export const PIPELINE_STEPS: Record<number, { name: string; description: string }> = {
  1: { name: 'Planner', description: 'Gera plan.json, contract.md, task.spec.md' },
  2: { name: 'Spec Writer', description: 'Gera o arquivo de teste (.spec.ts)' },
  3: { name: 'Fixer', description: 'Corrige artifacts rejeitados pelo Gatekeeper' },
  4: { name: 'Coder', description: 'Implementa o código para passar os testes' },
}

// Dynamic instruction template categories (kind values)
export const DYNAMIC_INSTRUCTION_KINDS: Record<string, { label: string; description: string; icon: string }> = {
  'retry': { label: 'Retry (API)', description: 'Mensagens de retry quando LLM não salva artifacts', icon: '🔄' },
  'retry-cli': { label: 'Retry (CLI)', description: 'Mensagens de retry para Claude Code', icon: '🔄' },
  'system-append-cli': { label: 'CLI Appends', description: 'Texto adicionado ao system prompt para CLI', icon: '📎' },
  'git-strategy': { label: 'Git Strategy', description: 'Instruções de estratégia Git por tipo', icon: '🌿' },
  'guidance': { label: 'Validator Guidance', description: 'Orientações específicas por validador', icon: '📋' },
  'cli-replace': { label: 'CLI Replacements', description: 'Substituições de texto para modo CLI', icon: '🔀' },
  'custom-instructions': { label: 'Custom Headers', description: 'Headers para instruções customizadas', icon: '📝' },
}

// MCP CRUD Types (v1 - mantidos para compatibilidade)
export interface Snippet {
  id: string
  name: string
  category: string
  content: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface ContextPack {
  id: string
  name: string
  description: string | null
  files: string[]
  createdAt: string
  updatedAt: string
}

export interface SessionPreset {
  id: string
  name: string
  config: MCPSessionConfig
  createdAt: string
  updatedAt: string
}

export interface SessionHistory {
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

// ─────────────────────────────────────────────────────────────────────────────
// Add to src/lib/types.ts
// ─────────────────────────────────────────────────────────────────────────────

export type OrchestratorContentKind = 'instruction' | 'doc' | 'prompt'

export interface OrchestratorContent {
  id: string
  kind: OrchestratorContentKind
  step: number
  name: string
  content: string
  order: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider Info (from /agent/providers)
// ─────────────────────────────────────────────────────────────────────────────

export interface ProviderInfo {
  id: string
  name: string
  label: string
  authType: string
  envVarName: string | null
  isActive: boolean
  order: number
  note?: string | null
  configured: boolean
  models: string[]
}

export interface Provider {
  id: string
  name: string
  label: string
  authType: string
  envVarName: string | null
  isActive: boolean
  order: number
  note: string | null
  createdAt: string
  updatedAt: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider Model Registry Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ProviderModel {
  id: string
  provider: ProviderName
  modelId: string
  label: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ModelDiscoveryResult {
  curl: string
  status: number
  data: unknown
  error?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Grid Engine Types
// ─────────────────────────────────────────────────────────────────────────────

export interface GridItem {
  component: string
  colStart: number
  rowStart: number
  colSpan: number
  rowSpan: number
  props?: Record<string, any>
}

export interface GridLayoutConfig {
  columns: number
  rowHeight: string
  gap: string
  items: GridItem[]
}

export interface PipelineState {
  outputId: string
  status: string   // 'running' | 'completed' | 'failed'
  stage: string    // 'planning' | 'spec' | 'fix' | 'execute' | 'complete'
  progress: number // 0-100
  summary: string | null
  lastEventId: number
  agentRunId: string | null
  startedAt: string
  updatedAt: string
}

export interface PipelineEvent {
  id: number
  outputId: string
  stage: string
  eventType: string
  level: string | null
  message: string | null
  payload: string | null
  source: string | null
  createdAt: string
}

// ─── Log Filtering ────────────────────────────────────────────────────────────

export interface LogFilterOptions {
  level?: 'error' | 'warn' | 'info' | 'debug'
  stage?: string
  type?: string
  search?: string
  startDate?: string  // ISO 8601 datetime string
  endDate?: string    // ISO 8601 datetime string
}

export interface FilteredLogsResponse {
  outputId: string
  filters: LogFilterOptions
  count: number
  events: Array<Record<string, unknown> & { type: string; id?: number; timestamp?: number; seq?: number }>
}

/**
 * Métricas agregadas de logs do orquestrador.
 */
export interface LogMetrics {
  /** ID da pipeline */
  pipelineId: string

  /** Número total de eventos */
  totalEvents: number

  /** Contagem de eventos por nível (error, warning, info) */
  byLevel: Record<string, number>

  /** Contagem de eventos por fase (planning, spec, fix, execute) */
  byStage: Record<string, number>

  /** Contagem de eventos por tipo (agent:start, agent:error, etc) */
  byType: Record<string, number>

  /** Duração da execução */
  duration: {
    /** Duração em milissegundos */
    ms: number
    /** Duração formatada (HH:mm:ss) */
    formatted: string
  }

  /** Timestamp do primeiro evento (ISO string) */
  firstEvent: string | null

  /** Timestamp do último evento (ISO string) */
  lastEvent: string | null
}
