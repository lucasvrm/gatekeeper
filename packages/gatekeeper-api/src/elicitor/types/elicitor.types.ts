export enum TaskType {
  UI_COMPONENT = 'UI_COMPONENT',
  API_ENDPOINT = 'API_ENDPOINT',
  FEATURE = 'FEATURE',
  AUTH = 'AUTH',
  DATA = 'DATA',
  INTEGRATION = 'INTEGRATION',
}

export enum SessionStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  ERROR = 'ERROR',
}

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
}

export enum LLMProvider {
  ANTHROPIC = 'anthropic',
  OPENAI = 'openai',
  GOOGLE = 'google',
  OLLAMA = 'ollama',
}

export interface LLMAgentConfig {
  id: string
  name: string
  slug: string
  provider: LLMProvider
  model: string
  apiKey?: string
  apiKeyEnvVar?: string
  baseUrl?: string
  temperature: number
  maxTokens: number
}

/**
 * Contract clause during elicitation (before finalization).
 * T152: Added contract-related fields to ElicitationState.
 */
export interface ElicitedClause {
  id?: string // Generated during finalization
  kind: 'behavior' | 'error' | 'invariant' | 'constraint' | 'security' | 'ui'
  normativity: 'MUST' | 'SHOULD' | 'MAY'
  title: string
  spec: string
  observables: Array<'http' | 'ui' | 'db-effect' | 'event' | 'file' | 'log'>
  when?: string[]
  inputs?: Record<string, string>
  outputs?: Record<string, string>
  negativeCases?: string[]
  tags?: string[]
  notes?: string
}

export interface ElicitationState {
  type: TaskType
  name?: string
  manifestFiles?: ManifestFile[]

  // Legacy UI-specific fields (still supported)
  props?: PropDefinition[]
  states?: StateDefinition[]
  behaviors?: BehaviorDefinition[]
  accessibility?: AccessibilityDefinition
  edgeCases?: EdgeCaseDefinition[]

  // T152: Contract-related fields
  contractTitle?: string
  contractMode?: 'STRICT' | 'CREATIVE'
  contractScope?: 'internal' | 'external' | 'mixed'
  changeType?: 'new' | 'modify' | 'bugfix' | 'refactor'
  criticality?: 'low' | 'medium' | 'high' | 'critical'
  owners?: string[]
  clauses?: ElicitedClause[]
  shouldGenerateContract?: boolean // T153: Decision flag

  // Internal fields
  _initialPrompt?: string
  _defaults?: Record<string, boolean>
}

export interface ManifestFile {
  path: string
  action: 'CREATE' | 'MODIFY' | 'DELETE'
  reason?: string
}

export interface PropDefinition {
  name: string
  type: string
  required: boolean
  default?: unknown
  description?: string
  testCases?: TestCase[]
}

export interface StateDefinition {
  state: string
  description: string
  condition?: string
  cssIndicators?: string[]
  icon?: string
  duration?: string
}

export interface BehaviorDefinition {
  trigger: string
  action: string
  condition?: string
  onSuccess?: FeedbackDefinition
  onError?: FeedbackDefinition
  debounce?: number
}

export interface FeedbackDefinition {
  visual?: string
  feedback?: string
  navigate?: string
}

export interface AccessibilityDefinition {
  role?: string
  ariaLabel?: string
  keyboard?: KeyboardShortcut[]
  announceOnSuccess?: string
  announceOnError?: string
}

export interface KeyboardShortcut {
  key: string
  action: string
}

export interface EdgeCaseDefinition {
  scenario: string
  behavior: string
  test?: string
}

export interface TestCase {
  value: unknown
  expectedBehavior: string
}

export interface CompletenessResult {
  isComplete: boolean
  canGenerate: boolean
  completenessScore: number
  missingFields: string[]
  warnings: string[]
}

export interface LLMResponse {
  content: string
  tokensIn: number
  tokensOut: number
  durationMs: number
  finishReason: string
}

export interface ChatMessage {
  role: MessageRole
  content: string
}
