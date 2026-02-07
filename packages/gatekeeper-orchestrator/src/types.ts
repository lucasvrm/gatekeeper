/**
 * Gatekeeper Orchestrator — Types
 *
 * Pipeline:
 *   Step 0: Human writes task (natural language)
 *   Step 1: LLM₁ → plan.json + contract.md + task.spec.md
 *   Step 2: LLM₂ → spec.test (test code)
 *   Step 3: Gatekeeper validation (gates 0-1) — HUMAN in the loop
 *   Step 4: Claude Agent SDK executes in project context
 */

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline Types
// ─────────────────────────────────────────────────────────────────────────────

export type PipelineStep = 'idle' | 'planning' | 'spec' | 'validating' | 'fixing' | 'executing' | 'completed' | 'failed'

export type FixTarget = 'plan' | 'spec'

export interface PipelineState {
  id: string
  outputId: string
  taskDescription: string
  taskType?: string
  currentStep: PipelineStep
  steps: StepResult[]
  validation?: ValidationState
  execution?: ExecutionState
  createdAt: string
  updatedAt: string
}

export interface StepResult {
  step: number
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  artifacts: string[]
  tokensUsed?: TokenUsage
  error?: string
  startedAt?: string
  completedAt?: string
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
}

export interface ValidationState {
  runId: string
  status: string
  failedValidators?: FailedValidator[]
}

export interface FailedValidator {
  code: string
  gate: number
  message: string
}

export interface ExecutionState {
  status: 'running' | 'completed' | 'failed'
  sessionId?: string
  error?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// API Inputs
// ─────────────────────────────────────────────────────────────────────────────

export interface GeneratePlanInput {
  taskDescription: string
  taskType?: string
  profileId?: string
  model?: string
}

export interface GeneratePlanOutput {
  outputId: string
  artifacts: ParsedArtifact[]
  tokensUsed: TokenUsage
}

export interface GenerateSpecInput {
  outputId: string
  profileId?: string
  model?: string
}

export interface GenerateSpecOutput {
  artifacts: ParsedArtifact[]
  tokensUsed: TokenUsage
}

export interface FixArtifactsInput {
  outputId: string
  target: FixTarget
  runId: string
  /** Validator codes the human chose NOT to bypass (i.e. real failures to fix) */
  failedValidators: string[]
  profileId?: string
  model?: string
}

export interface FixArtifactsOutput {
  artifacts: ParsedArtifact[]
  corrections: string[]
  tokensUsed: TokenUsage
}

export interface ExecuteInput {
  outputId: string
  projectPath: string
  model?: string
}

export interface ExecuteOutput {
  mode: 'sdk' | 'cli'
  /** SDK mode: session ID for tracking */
  sessionId?: string
  /** CLI fallback: command + prompt file path */
  command?: string
  promptFilePath?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Artifact Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedArtifact {
  filename: string
  content: string
}

// ─────────────────────────────────────────────────────────────────────────────
// SSE Events (for real-time UI updates)
// ─────────────────────────────────────────────────────────────────────────────

export type OrchestratorEvent =
  | { type: 'step:start'; step: number; name: string }
  | { type: 'step:artifact'; step: number; filename: string }
  | { type: 'step:llm_chunk'; step: number; text: string }
  | { type: 'step:complete'; step: number; tokensUsed: TokenUsage }
  | { type: 'step:error'; step: number; error: string }
  | { type: 'fix:start'; target: FixTarget; attempt: number }
  | { type: 'fix:complete'; corrections: string[] }
  | { type: 'execute:start'; mode: 'sdk' | 'cli' }
  | { type: 'execute:message'; text: string }
  | { type: 'execute:tool_use'; tool: string }
  | { type: 'execute:complete' }
  | { type: 'execute:error'; error: string }

// ─────────────────────────────────────────────────────────────────────────────
// Microplans (replaces plan.json monolith)
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

export interface OrchestratorConfig {
  /** Anthropic API key for LLM calls (steps 1, 2, fix) */
  anthropicApiKey: string
  /** Default model for text generation steps */
  defaultModel: string
  /** Directory for reference docs (same as MCP DOCS_DIR) */
  docsDir: string
  /** Directory for artifact storage (same as MCP ARTIFACTS_DIR) */
  artifactsDir: string
  /** Gatekeeper API base URL */
  gatekeeperApiUrl: string
  /** Max tokens for LLM responses */
  maxTokens: number
}
