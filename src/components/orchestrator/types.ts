// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedArtifact {
  filename: string
  content: string
}

export interface StepResult {
  outputId?: string
  artifacts?: ParsedArtifact[]
  tokensUsed?: { inputTokens: number; outputTokens: number }
  correctedTaskPrompt?: string
  microplansArtifact?: ParsedArtifact
  hasMicroplans?: boolean
}

export interface LogEntry {
  time: string
  type: string
  text: string
}

export type WizardStep = 0 | 1 | 2 | 3 | 4
export type PageTab = "pipeline"

export interface StepLLMConfig {
  provider: string
  model: string
}

export interface OrchestratorSession {
  outputId?: string
  step: number
  completedSteps: number[]
  taskDescription: string
  taskType?: string
  selectedProjectId: string | null
  provider: string
  model: string
  stepLLMs?: Record<number, StepLLMConfig>
  planArtifacts: ParsedArtifact[]
  specArtifacts: ParsedArtifact[]
  runId: string | null
  savedAt: number
  // Pipeline reconciliation fields
  lastEventId: number
  lastSeq: number
  pipelineStatus: string | null    // 'running' | 'completed' | 'failed'
  pipelineStage: string | null     // 'planning' | 'spec' | 'fix' | 'execute' | 'complete'
  pipelineProgress: number         // 0-100
  microplansArtifact?: ParsedArtifact
  hasMicroplans?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const SESSION_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
export const SESSION_KEY_PREFIX = "gk-pipeline-"
export const ACTIVE_KEY = "gk-active-pipeline"

export const STEPS = [
  { num: 0, label: "Tarefa" },
  { num: 1, label: "Plano" },
  { num: 2, label: "Testes" },
  { num: 3, label: "Validação" },
  { num: 4, label: "Execução" },
] as const
