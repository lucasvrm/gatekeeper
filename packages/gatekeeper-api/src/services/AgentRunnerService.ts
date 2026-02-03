/**
 * Agent Runner Service
 *
 * Provider-agnostic agent loop that drives the LLM through tool-using phases.
 * Works identically with Anthropic, OpenAI, or Mistral — the LLMProvider
 * interface handles all API differences.
 *
 * Loop:
 *   1. Call llm.chat() with system prompt, messages, and tools
 *   2. If stopReason === 'tool_use': execute tools, append results, go to 1
 *   3. If stopReason !== 'tool_use': extract text, return result
 *   4. If maxIterations exceeded: throw
 *
 * Features:
 *   - Automatic fallback to a secondary provider on failure
 *   - Per-iteration SSE event emission for real-time UI updates
 *   - Token usage tracking across all iterations
 *   - Tool execution timing
 */

import type {
  LLMProvider,
  LLMMessage,
  LLMResponse,
  ToolDefinition,
  ContentBlock,
  PhaseConfig,
  AgentEvent,
  AgentResult,
  TokenUsage,
  TextBlock,
  ToolUseBlock,
} from '../types/agent.types.js'
import type { LLMProviderRegistry } from './providers/LLMProviderRegistry.js'
import type { AgentToolExecutor } from './AgentToolExecutor.js'

// ─── Public API ────────────────────────────────────────────────────────────

export interface AgentRunOptions {
  phase: PhaseConfig
  systemPrompt: string
  userMessage: string
  tools: ToolDefinition[]
  projectRoot: string
  onEvent?: (event: AgentEvent) => void
}

export class AgentRunnerService {
  constructor(
    private registry: LLMProviderRegistry,
    private toolExecutor: AgentToolExecutor,
  ) {}

  /**
   * Run the agent loop for a single phase.
   *
   * Tries the primary provider. If it fails and a fallback is configured,
   * retries with the fallback provider (once — no recursive fallbacks).
   */
  async run(options: AgentRunOptions): Promise<AgentResult> {
    const { phase, onEvent } = options
    const emit = onEvent ?? (() => {})

    try {
      const provider = this.registry.get(phase.provider)
      return await this.runWithProvider(provider, phase, options, emit)
    } catch (error) {
      // Attempt fallback if configured
      if (phase.fallbackProvider && phase.fallbackModel) {
        emit({
          type: 'agent:fallback',
          from: `${phase.provider}/${phase.model}`,
          to: `${phase.fallbackProvider}/${phase.fallbackModel}`,
          reason: (error as Error).message,
        })

        const fallbackPhase: PhaseConfig = {
          ...phase,
          provider: phase.fallbackProvider,
          model: phase.fallbackModel,
          // No recursive fallbacks
          fallbackProvider: undefined,
          fallbackModel: undefined,
        }

        const fallbackProvider = this.registry.get(fallbackPhase.provider)
        return await this.runWithProvider(fallbackProvider, fallbackPhase, options, emit)
      }

      // No fallback — propagate original error
      emit({ type: 'agent:error', error: (error as Error).message })
      throw error
    }
  }

  /**
   * Run the full 3-phase pipeline.
   *
   * Phase 1 (Planner) → Phase 2 (Spec Writer) → Phase 4 (Coder)
   * Output from each phase feeds into the next as user message context.
   */
  async runPipeline(params: {
    phases: PhaseConfig[]
    systemPrompts: Map<number, string>
    taskDescription: string
    projectRoot: string
    readTools: ToolDefinition[]
    writeTools: ToolDefinition[]
    saveArtifactTool: ToolDefinition
    onEvent?: (event: AgentEvent) => void
  }): Promise<{
    artifacts: Map<string, string>
    totalTokens: TokenUsage
    phaseResults: AgentResult[]
  }> {
    const {
      phases,
      systemPrompts,
      taskDescription,
      projectRoot,
      readTools,
      writeTools,
      saveArtifactTool,
      onEvent,
    } = params

    const phaseResults: AgentResult[] = []
    const totalTokens: TokenUsage = { inputTokens: 0, outputTokens: 0 }

    // Clear artifacts between pipeline runs
    this.toolExecutor.clearArtifacts()

    for (const phase of phases) {
      const systemPrompt = systemPrompts.get(phase.step)
      if (!systemPrompt) {
        throw new Error(`No system prompt configured for step ${phase.step}`)
      }

      // Determine tools for this phase
      const tools: ToolDefinition[] = [...readTools, saveArtifactTool]
      if (phase.step === 4) {
        tools.push(...writeTools)
      }

      // Build user message
      let userMessage: string
      if (phase.step === 1) {
        // Planner: just the task description
        userMessage = taskDescription
      } else {
        // Subsequent phases: include previous artifacts as context
        const artifacts = this.toolExecutor.getArtifacts()
        const artifactContext = [...artifacts.entries()]
          .map(([name, content]) => `--- ${name} ---\n${content}`)
          .join('\n\n')

        userMessage =
          phase.step === 2
            ? `Task: ${taskDescription}\n\nArtifacts from Phase 1:\n${artifactContext}`
            : `Task: ${taskDescription}\n\nArtifacts:\n${artifactContext}\n\nImplement the code to make all tests pass.`
      }

      const result = await this.run({
        phase,
        systemPrompt,
        userMessage,
        tools,
        projectRoot,
        onEvent,
      })

      phaseResults.push(result)
      totalTokens.inputTokens += result.tokensUsed.inputTokens
      totalTokens.outputTokens += result.tokensUsed.outputTokens
    }

    return {
      artifacts: this.toolExecutor.getArtifacts(),
      totalTokens,
      phaseResults,
    }
  }

  // ─── Private: Core Loop ──────────────────────────────────────────────────

  private async runWithProvider(
    llm: LLMProvider,
    phase: PhaseConfig,
    options: AgentRunOptions,
    emit: (event: AgentEvent) => void,
  ): Promise<AgentResult> {
    const { systemPrompt, userMessage, tools, projectRoot } = options
    const messages: LLMMessage[] = [{ role: 'user', content: userMessage }]

    let iteration = 0
    const totalTokens: TokenUsage = { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 }

    emit({
      type: 'agent:start',
      provider: llm.name,
      model: phase.model,
      step: phase.step,
    })

    while (iteration < phase.maxIterations) {
      iteration++

      // ── LLM Call ────────────────────────────────────────────────────────

      const response = await llm.chat({
        model: phase.model,
        system: systemPrompt,
        messages,
        tools,
        maxTokens: phase.maxTokens,
        temperature: phase.temperature,
        enableCache: true,
      })

      totalTokens.inputTokens += response.usage.inputTokens
      totalTokens.outputTokens += response.usage.outputTokens
      totalTokens.cacheCreationTokens = (totalTokens.cacheCreationTokens || 0) + (response.usage.cacheCreationTokens || 0)
      totalTokens.cacheReadTokens = (totalTokens.cacheReadTokens || 0) + (response.usage.cacheReadTokens || 0)

      emit({
        type: 'agent:iteration',
        iteration,
        tokensUsed: { ...totalTokens },
      })

      // ── Emit content events ─────────────────────────────────────────────

      for (const block of response.content) {
        if (block.type === 'text') {
          emit({ type: 'agent:text', text: block.text })
        }
        if (block.type === 'tool_use') {
          emit({
            type: 'agent:tool_call',
            tool: block.name,
            input: block.input,
          })
        }
      }

      // ── Check if done ───────────────────────────────────────────────────

      if (response.stopReason !== 'tool_use') {
        const text = response.content
          .filter((b): b is TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n')

        const result: AgentResult = {
          text,
          tokensUsed: totalTokens,
          iterations: iteration,
          provider: llm.name,
          model: phase.model,
        }

        emit({ type: 'agent:complete', result })
        return result
      }

      // ── Execute tool calls ──────────────────────────────────────────────

      const toolResults: ContentBlock[] = []

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue

        const start = Date.now()
        const result = await this.toolExecutor.execute(
          block.name,
          block.input,
          projectRoot,
        )
        const durationMs = Date.now() - start

        toolResults.push({
          type: 'tool_result',
          toolUseId: block.id,
          content: result.content,
          isError: result.isError,
        })

        emit({
          type: 'agent:tool_result',
          tool: block.name,
          isError: result.isError,
          durationMs,
        })
      }

      // ── Append to history ───────────────────────────────────────────────

      messages.push({ role: 'assistant', content: response.content })
      messages.push({ role: 'user', content: toolResults })
    }

    // Exceeded max iterations
    const error = new Error(
      `Agent exceeded max iterations (${phase.maxIterations}) on step ${phase.step} ` +
        `with ${llm.name}/${phase.model}. Tokens used: ${totalTokens.inputTokens}in/${totalTokens.outputTokens}out`,
    )
    emit({ type: 'agent:error', error: error.message })
    throw error
  }
}
