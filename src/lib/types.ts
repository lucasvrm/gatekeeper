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
  bypassed?: boolean
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

export interface CustomizationSettings {
  appName: string
  appSubtitle: string
  logoUrl: string | null
  faviconUrl: string | null
  fonts: {
    sans: string
    serif: string
    mono: string
  }
  maxUploadMb: number
  colors: {
    accent: { background: string | null; text: string | null }
    primary: { background: string | null; text: string | null }
    secondary: { background: string | null; text: string | null }
    base: { background: string | null; text: string | null }
    background: { background: string | null; text: string | null }
    text: { background: string | null; text: string | null }
  }
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
