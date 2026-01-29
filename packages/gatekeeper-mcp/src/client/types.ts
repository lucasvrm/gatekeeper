/**
 * Type definitions for Gatekeeper API
 * Mirrors the types from gatekeeper-api
 */

export type RunStatus = 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'ABORTED'
export type ValidatorStatus = 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'WARNING' | 'SKIPPED'

export interface Pagination {
  page: number
  limit: number
  total: number
  pages: number
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: Pagination
}

export interface Workspace {
  id: string
  name: string
  rootPath?: string
}

export interface Project {
  id: string
  name: string
  workspace: Workspace
  description?: string
  baseRef: string
  targetRef: string
}

export interface Run {
  id: string
  outputId: string
  status: RunStatus
  projectPath: string
  baseRef: string
  targetRef: string
  taskPrompt?: string
  createdAt: string
}

export interface GateResult {
  gateNumber: number
  gateName: string
  status: ValidatorStatus
  passed: boolean
}

export interface ValidatorResult {
  gateNumber: number
  validatorCode: string
  validatorName: string
  status: ValidatorStatus
  passed: boolean
}

export interface RunWithResults extends Run {
  gateResults: GateResult[]
  validatorResults: ValidatorResult[]
}

export interface Validator {
  code: string
  displayName: string
  gate: number
  description?: string
  isHardBlock: boolean
}

export interface Gate {
  number: number
  name: string
  emoji: string
  description: string
}

export interface ArtifactFolder {
  outputId: string
  hasSpec: boolean
  hasPlan: boolean
  specFileName: string | null
  createdAt: string
}

export interface ArtifactContents {
  planJson: unknown | null
  specContent: string | null
  specFileName: string | null
}

export interface CreateRunInput {
  projectId?: string
  outputId: string
  taskPrompt: string
  manifest: {
    files: Array<{ path: string; action: 'CREATE' | 'MODIFY' | 'DELETE'; reason?: string }>
    testFile: string
  }
  baseRef?: string
  targetRef?: string
  dangerMode?: boolean
}

export interface CreateRunResponse {
  runId: string
  outputId: string
  status: RunStatus
  createdAt: string
}

export interface RunEvent {
  type: 'run_status' | 'gate_complete' | 'validator_complete'
  runId: string
  data?: unknown
}

export interface GatekeeperClientConfig {
  baseUrl: string
}

export interface GatekeeperError extends Error {
  status?: number
  code?: string
}

export interface UploadFilesInput {
  files: Array<{ filename: string; content: string }>
}

export interface UploadFilesResponse {
  message: string
  files: string[]
}

export interface ContinueRunResponse {
  message: string
}
