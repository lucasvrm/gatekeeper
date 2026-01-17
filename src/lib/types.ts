export type RunStatus = "PENDING" | "RUNNING" | "PASSED" | "FAILED" | "ABORTED"
export type ValidatorStatus = "PENDING" | "RUNNING" | "PASSED" | "FAILED" | "WARNING" | "SKIPPED"

export interface Run {
  id: string
  outputId: string
  projectPath: string
  baseRef: string
  targetRef: string
  taskPrompt?: string
  manifestJson: string
  testFilePath: string
  dangerMode: boolean
  runType: 'CONTRACT' | 'EXECUTION'
  contractRunId?: string
  status: RunStatus
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
  message?: string
  details?: string
  evidence?: string
}

export interface RunWithResults extends Run {
  gateResults: GateResult[]
  validatorResults: ValidatorResult[]
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

export interface ConfigItem {
  id: string
  key: string
  value: string | number | boolean
  type: "STRING" | "NUMBER" | "BOOLEAN"
  category: string
  description: string
}

export interface LLMAgent {
  id: string
  name: string
  slug: string
  provider: "anthropic" | "openai" | "google" | "ollama"
  model: string
  apiKeyEnvVar?: string | null
  baseUrl?: string | null
  temperature: number
  maxTokens: number
  isActive: boolean
  isDefault: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface CreateAgentInput {
  name: string
  provider: LLMAgent["provider"]
  model: string
  apiKeyEnvVar?: string | null
  baseUrl?: string | null
  temperature: number
  maxTokens: number
  isDefault?: boolean
}

export interface UpdateAgentInput {
  name?: string
  provider?: LLMAgent["provider"]
  model?: string
  apiKeyEnvVar?: string | null
  baseUrl?: string | null
  temperature?: number
  maxTokens?: number
  isActive?: boolean
  isDefault?: boolean
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

export interface LLMPlanOutput {
  outputId: string
  projectPath: string
  baseRef: string
  targetRef: string
  taskPrompt: string
  testFilePath: string
  dangerMode: boolean
  manifest: ValidationManifest
}

export interface CreateRunRequest {
  outputId: string
  projectPath: string
  taskPrompt: string
  manifest: ValidationManifest
  testFilePath: string
  testFileContent?: string
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
