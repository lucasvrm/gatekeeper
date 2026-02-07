/**
 * Agent Runner — Canonical Types
 *
 * These types define the provider-agnostic interface for the agent loop.
 * Each LLM provider (Anthropic, OpenAI, Mistral) normalizes its API
 * to/from these canonical types.
 *
 * Design: the agent loop never sees provider-specific formats.
 */

// ─── Content Blocks ──────────────────────────────────────────────────────────

export interface TextBlock {
  type: 'text'
  text: string
}

export interface ToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ToolResultBlock {
  type: 'tool_result'
  toolUseId: string
  content: string
  isError: boolean
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock

// ─── Messages ────────────────────────────────────────────────────────────────

export interface LLMMessage {
  role: 'user' | 'assistant'
  content: string | ContentBlock[]
}

// ─── Tool Definition ─────────────────────────────────────────────────────────

export interface ToolPropertySchema {
  type: string
  description?: string
  enum?: string[]
  default?: unknown
}

export interface ToolInputSchema {
  type: 'object'
  properties: Record<string, ToolPropertySchema>
  required?: string[]
}

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: ToolInputSchema
}

// ─── Response ────────────────────────────────────────────────────────────────

export type StopReason = 'end_turn' | 'tool_use' | 'max_tokens'

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  /** Tokens written to cache this request (charged at 1.25x) */
  cacheCreationTokens?: number
  /** Tokens read from cache this request (charged at 0.1x) */
  cacheReadTokens?: number
}

export interface LLMResponse {
  content: ContentBlock[]
  stopReason: StopReason
  usage: TokenUsage
}

// ─── Provider Interface ──────────────────────────────────────────────────────

export interface ChatParams {
  model: string
  system: string
  messages: LLMMessage[]
  tools: ToolDefinition[]
  maxTokens: number
  temperature?: number
  /** Enable prompt caching (Anthropic only — ignored by other providers) */
  enableCache?: boolean
  /** Working directory for process-spawning providers (e.g., claude-code). Ignored by API providers. */
  cwd?: string
  /**
   * Stream event callback for providers that manage their own agent loop (e.g., claude-code).
   * Allows the provider to emit granular events (tool_call, iteration, etc.) in real-time
   * instead of only returning results at the end.
   * API providers ignore this — the AgentRunnerService emits events from its own loop.
   */
  onEvent?: (event: AgentEvent) => void
}

export interface LLMProvider {
  readonly name: ProviderName
  chat(params: ChatParams): Promise<LLMResponse>
}

// ─── Provider Names & Config ─────────────────────────────────────────────────

export type ProviderName = string

export interface PhaseConfig {
  step: number
  provider: ProviderName
  model: string
  maxTokens: number
  maxIterations: number
  maxInputTokensBudget: number // 0 = unlimited, >0 = hard cap in tokens
  temperature?: number
  fallbackProvider?: ProviderName
  fallbackModel?: string
}

// ─── Agent Events ────────────────────────────────────────────────────────────

export type AgentEvent =
  | { type: 'agent:start'; provider: string; model: string; step: number }
  | { type: 'agent:text'; text: string }
  | { type: 'agent:thinking'; elapsedMs: number; iteration: number }
  | { type: 'agent:tool_call'; tool: string; input: Record<string, unknown> }
  | { type: 'agent:tool_result'; tool: string; isError: boolean; durationMs: number }
  | { type: 'agent:iteration'; iteration: number; tokensUsed: TokenUsage }
  | { type: 'agent:budget_warning'; usedTokens: number; budgetTokens: number; percentUsed: number }
  | { type: 'agent:budget_exceeded'; usedTokens: number; budgetTokens: number }
  | { type: 'agent:complete'; result: AgentResult }
  | { type: 'agent:fallback'; from: string; to: string; reason: string }
  | { type: 'agent:fallback_unavailable'; from: string; to: string; reason: string; availableProviders: ProviderName[]; originalError: string }
  | { type: 'agent:error'; error: string; availableProviders?: ProviderName[]; canRetry?: boolean }
  // Bridge pipeline events (emitted by AgentOrchestratorBridge & BridgeController)
  | { type: 'agent:bridge_start'; step: number; outputId?: string }
  | { type: 'agent:bridge_complete'; step: number; outputId: string; artifactNames: string[] }
  | { type: 'agent:validation_warning'; step: number; warnings: string[] }

// ─── Agent Result ────────────────────────────────────────────────────────────

export interface AgentResult {
  text: string
  tokensUsed: TokenUsage
  iterations: number
  provider: string
  model: string
}

// ─── Tool Executor ───────────────────────────────────────────────────────────

export interface ToolExecutionResult {
  content: string
  isError: boolean
}

// ─── Re-export Microplan types from gates.types ─────────────────────────────

export type { Microplan, MicroplanFile, MicroplansDocument, MicroplanAction } from './gates.types.js'
