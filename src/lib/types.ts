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
  kind: string | null  // 'instruction' | 'doc' | 'prompt' | null
  order: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export const PIPELINE_STEPS: Record<number, { name: string; description: string }> = {
  1: { name: 'Planner', description: 'Gera plan.json, contract.md, task.spec.md' },
  2: { name: 'Spec Writer', description: 'Gera o arquivo de teste (.spec.ts)' },
  3: { name: 'Fixer', description: 'Corrige artifacts rejeitados pelo Gatekeeper' },
  4: { name: 'Coder', description: 'Implementa o código para passar os testes' },
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
