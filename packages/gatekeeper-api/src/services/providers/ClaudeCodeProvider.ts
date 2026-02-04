/**
 * Claude Code Provider — Headless CLI Adapter
 *
 * Delegates the entire agent loop to the Claude Code CLI (`claude -p`),
 * allowing the Gatekeeper pipeline to run without an Anthropic API key
 * when the user has a Claude Max/Pro subscription.
 *
 * How it works:
 *   1. Receives ChatParams (system, messages, tools, model, etc.)
 *   2. Combines messages into a single prompt string
 *   3. Spawns `claude -p <prompt> --system-prompt <s> --output-format json`
 *   4. Claude Code handles LLM calls AND tool execution internally
 *   5. Parses the JSON result and returns LLMResponse
 *   6. Returns stopReason 'end_turn' (loop always runs 1 iteration)
 *
 * Trade-offs vs AnthropicProvider:
 *   + No API key required (uses Max/Pro subscription)
 *   + Claude Code handles tool execution with its own safety sandbox
 *   - Our AgentToolExecutor is bypassed (Claude Code uses its own tools)
 *   - ~12s startup overhead per invocation (Claude Code process init)
 *   - No prompt caching control
 *
 * Auth: Claude Code uses whatever auth the user configured:
 *   - Claude.ai Pro/Max login (`claude login`)
 *   - API key via ANTHROPIC_API_KEY env var
 *   - Bedrock/Vertex via env toggles
 */

import { spawn } from 'node:child_process'
import type {
  LLMProvider,
  LLMResponse,
  ChatParams,
  ContentBlock,
} from '../../types/agent.types.js'

// ─── Config ───────────────────────────────────────────────────────────────────

export interface ClaudeCodeProviderConfig {
  /** Path to the claude CLI binary. Defaults to 'claude'. */
  claudePath?: string
  /** Timeout in milliseconds. Defaults to 600_000 (10 min). */
  timeoutMs?: number
  /** Permission mode for Claude Code. Defaults to 'bypassPermissions'. */
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan'
  /** Allowed tools for Claude Code. Defaults to standard set. */
  allowedTools?: string[]
  /** Disallowed tools for Claude Code. */
  disallowedTools?: string[]
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export class ClaudeCodeProvider implements LLMProvider {
  readonly name = 'claude-code' as const

  private claudePath: string
  private timeoutMs: number
  private permissionMode: string
  private allowedTools: string[]
  private disallowedTools: string[]

  constructor(config?: ClaudeCodeProviderConfig) {
    this.claudePath = config?.claudePath || 'claude'
    this.timeoutMs = config?.timeoutMs || 600_000
    this.permissionMode = config?.permissionMode || 'bypassPermissions'
    this.allowedTools = config?.allowedTools || [
      'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep',
    ]
    this.disallowedTools = config?.disallowedTools || []
  }

  // ─── LLMProvider.chat() ───────────────────────────────────────────────

  async chat(params: ChatParams): Promise<LLMResponse> {
    const prompt = this.buildPrompt(params)
    const args = this.buildArgs(params)
    const emit = params.onEvent ?? (() => {})

    console.log(
      `[ClaudeCode] Spawning: ${this.claudePath} (stdin pipe) ` +
      `--model ${this.mapModel(params.model)} ` +
      `(cwd: ${params.cwd || 'inherit'})`,
    )

    const startMs = Date.now()
    const result = await this.spawnAndStream(args, prompt, params.system, emit, params.cwd)
    const durationMs = Date.now() - startMs

    console.log(
      `[ClaudeCode] Done in ${(durationMs / 1000).toFixed(1)}s` +
      ` — ${result.numTurns} turns, $${result.costUsd.toFixed(4)} USD` +
      (result.sessionId ? `, session: ${result.sessionId}` : ''),
    )

    if (result.isError) {
      throw new Error(`Claude Code returned error: ${result.resultText}`)
    }

    const usage = result.usage
    const content: ContentBlock[] = [{ type: 'text', text: result.resultText }]

    return {
      content,
      stopReason: 'end_turn',
      usage: {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cacheCreationTokens: usage.cacheCreationTokens,
        cacheReadTokens: usage.cacheReadTokens,
      },
    }
  }

  // ─── Prompt Construction ──────────────────────────────────────────────

  /**
   * Flatten the LLM message history into a single prompt string.
   *
   * In normal operation, the AgentRunnerService only calls chat() once
   * (because we always return stopReason 'end_turn'). So `messages` is
   * typically just one user message. But we handle multi-message for safety.
   */
  private buildPrompt(params: ChatParams): string {
    const parts: string[] = []

    for (const msg of params.messages) {
      if (typeof msg.content === 'string') {
        parts.push(msg.content)
      } else {
        for (const block of msg.content) {
          if (block.type === 'text') {
            parts.push(block.text)
          }
          if (block.type === 'tool_result') {
            parts.push(
              `[Tool result (${block.toolUseId})]: ${block.content}`,
            )
          }
        }
      }
    }

    return parts.join('\n\n')
  }

  // ─── CLI Arguments ────────────────────────────────────────────────────

  private buildArgs(params: ChatParams): string[] {
    const args: string[] = [
      '-p', '-',                    // read prompt from stdin
      '--output-format', 'stream-json',
      '--verbose',                  // required for stream-json with -p
      '--permission-mode', this.permissionMode,
    ]

    // Model mapping: full API string → Claude Code short name
    const model = this.mapModel(params.model)
    args.push('--model', model)

    // Tool permissions
    if (this.allowedTools.length > 0) {
      args.push('--allowedTools', this.allowedTools.join(','))
    }
    if (this.disallowedTools.length > 0) {
      args.push('--disallowedTools', this.disallowedTools.join(','))
    }

    return args
  }

  /**
   * Map full Anthropic model string to Claude Code's short name.
   *
   * Claude Code accepts: 'sonnet', 'opus', 'haiku'
   * Our PhaseConfig stores: 'claude-sonnet-4-5-20250929', etc.
   * Also accepts direct short names from the UI.
   */
  private mapModel(model: string): string {
    const lower = model.toLowerCase()
    if (lower === 'sonnet' || lower === 'opus' || lower === 'haiku') return lower
    if (lower.includes('opus')) return 'opus'
    if (lower.includes('haiku')) return 'haiku'
    return 'sonnet' // default
  }

  // ─── Process Management ───────────────────────────────────────────────

  /**
   * Spawn `claude` with stream-json output and emit events in real-time.
   *
   * Claude Code's `--output-format stream-json` emits newline-delimited JSON:
   *   {"type":"system","subtype":"init","session_id":"..."}
   *   {"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"..."}]}}
   *   {"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","name":"Read",...}]}}
   *   {"type":"tool","tool_use_id":"...","name":"Read","content":"..."}
   *   {"type":"result","subtype":"success","result":"...","total_cost_usd":0.19,...}
   *
   * Adaptive stdin strategy for ENAMETOOLONG on Windows (same as before).
   */
  private spawnAndStream(
    args: string[],
    prompt: string,
    systemPrompt: string,
    emit: (event: import('../../types/agent.types.js').AgentEvent) => void,
    cwd?: string,
  ): Promise<{
    resultText: string
    costUsd: number
    numTurns: number
    sessionId: string
    isError: boolean
    usage: {
      inputTokens: number
      outputTokens: number
      cacheCreationTokens: number
      cacheReadTokens: number
    }
  }> {
    const SAFE_ARG_LIMIT = 30_000
    const totalArgLength = args.join(' ').length + systemPrompt.length + prompt.length

    let finalArgs: string[]
    let stdinPayload: string

    if (totalArgLength < SAFE_ARG_LIMIT) {
      finalArgs = [...args.filter(a => a !== '-p' && a !== '-'), '-p', prompt, '--append-system-prompt', systemPrompt]
      stdinPayload = ''
    } else {
      console.log(`[ClaudeCode] Args too large (${totalArgLength} chars), using stdin pipe`)
      finalArgs = [...args]
      stdinPayload = `<system_instructions>\n${systemPrompt}\n</system_instructions>\n\n${prompt}`
    }

    return new Promise((resolve, reject) => {
      const child = spawn(this.claudePath, finalArgs, {
        cwd: cwd || process.cwd(),
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      let stderr = ''
      let lineBuffer = ''
      let iteration = 0
      let lastResultEvent: ClaudeCodeJsonResult | null = null

      const timer = setTimeout(() => {
        child.kill('SIGTERM')
        reject(new Error(
          `Claude Code timed out after ${this.timeoutMs / 1000}s`,
        ))
      }, this.timeoutMs)

      // ── Parse stream-json line by line ──────────────────────────────────
      const processLine = (line: string) => {
        const trimmed = line.trim()
        if (!trimmed) return

        try {
          const event = JSON.parse(trimmed) as StreamJsonEvent

          switch (event.type) {
            case 'system':
              // init event — session started
              break

            case 'assistant': {
              // Assistant produced content (text or tool_use)
              const content = event.message?.content
              if (!Array.isArray(content)) break

              for (const block of content) {
                if (block.type === 'text' && block.text) {
                  emit({ type: 'agent:text', text: block.text.slice(0, 200) })
                }
                if (block.type === 'tool_use') {
                  emit({
                    type: 'agent:tool_call',
                    tool: block.name || 'unknown',
                    input: block.input || {},
                  })
                }
              }
              break
            }

            case 'tool': {
              // Tool result
              const isError = event.is_error === true
              emit({
                type: 'agent:tool_result',
                tool: event.name || 'unknown',
                isError,
                durationMs: 0, // Claude Code doesn't report per-tool timing
              })
              // Each tool round-trip counts as an iteration
              iteration++
              const usage = this.extractUsageFromStreamEvent(event)
              emit({
                type: 'agent:iteration',
                iteration,
                tokensUsed: usage,
              })
              break
            }

            case 'result': {
              // Final result
              lastResultEvent = event as unknown as ClaudeCodeJsonResult
              break
            }
          }
        } catch (err) {
          // Non-JSON line, ignore (e.g. progress dots)
        }
      }

      child.stdout.on('data', (chunk: Buffer) => {
        lineBuffer += chunk.toString()
        const lines = lineBuffer.split('\n')
        // Keep the last (potentially incomplete) line in the buffer
        lineBuffer = lines.pop() || ''
        for (const line of lines) {
          processLine(line)
        }
      })

      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString()
      })

      child.on('close', (code) => {
        clearTimeout(timer)

        // Process any remaining line in buffer
        if (lineBuffer.trim()) {
          processLine(lineBuffer)
        }

        if (lastResultEvent) {
          const parsed = lastResultEvent
          const modelUsage = parsed.modelUsage
            ? Object.values(parsed.modelUsage)[0]
            : null

          resolve({
            resultText: parsed.result || '',
            costUsd: parsed.total_cost_usd || 0,
            numTurns: parsed.num_turns || 0,
            sessionId: parsed.session_id || '',
            isError: parsed.is_error === true || parsed.subtype === 'error',
            usage: {
              inputTokens: modelUsage?.inputTokens || 0,
              outputTokens: modelUsage?.outputTokens || 0,
              cacheCreationTokens: modelUsage?.cacheCreationInputTokens || 0,
              cacheReadTokens: modelUsage?.cacheReadInputTokens || 0,
            },
          })
        } else if (code !== 0) {
          reject(new Error(
            `Claude Code exited with code ${code}.\nstderr: ${stderr.slice(-500)}`,
          ))
        } else {
          // No result event but exited successfully (shouldn't happen normally)
          resolve({
            resultText: '(no output)',
            costUsd: 0,
            numTurns: 0,
            sessionId: '',
            isError: false,
            usage: { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 },
          })
        }
      })

      child.on('error', (err) => {
        clearTimeout(timer)
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          reject(new Error(
            `Claude Code CLI not found at "${this.claudePath}". ` +
            `Install with: npm install -g @anthropic-ai/claude-code`,
          ))
        } else {
          reject(err)
        }
      })

      // Pipe prompt via stdin (or close if using args)
      if (stdinPayload) {
        child.stdin.write(stdinPayload)
      }
      child.stdin.end()
    })
  }

  /**
   * Extract cumulative usage from a stream event (approximation).
   * Stream events don't carry per-event usage, so we return zeros.
   * The final 'result' event has the totals.
   */
  private extractUsageFromStreamEvent(_event: StreamJsonEvent): import('../../types/agent.types.js').TokenUsage {
    return {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
    }
  }
}

// ─── Internal Types ─────────────────────────────────────────────────────────

/**
 * Stream-json events from `claude -p --output-format stream-json`
 *
 * Each line is a JSON object with a 'type' field:
 *   system  — init, session info
 *   assistant — LLM content (text, tool_use blocks)
 *   tool    — tool execution result
 *   result  — final summary (same schema as json format)
 */
interface StreamJsonEvent {
  type: 'system' | 'assistant' | 'tool' | 'result'
  subtype?: string
  session_id?: string
  message?: {
    role?: string
    content?: Array<{
      type: string
      text?: string
      name?: string
      id?: string
      input?: Record<string, unknown>
    }>
  }
  // tool event fields
  tool_use_id?: string
  name?: string
  content?: string
  is_error?: boolean
  // result event fields (same as ClaudeCodeJsonResult)
  result?: string
  total_cost_usd?: number
  num_turns?: number
  duration_ms?: number
  modelUsage?: Record<string, {
    inputTokens?: number
    outputTokens?: number
    cacheReadInputTokens?: number
    cacheCreationInputTokens?: number
    costUSD?: number
  }>
}

/**
 * JSON result — used for the final 'result' event in stream-json mode.
 */
interface ClaudeCodeJsonResult {
  type: string
  subtype?: string
  result?: string
  total_cost_usd?: number
  num_turns?: number
  session_id?: string
  is_error?: boolean
  duration_ms?: number
  modelUsage?: Record<string, {
    inputTokens?: number
    outputTokens?: number
    cacheReadInputTokens?: number
    cacheCreationInputTokens?: number
    costUSD?: number
  }>
}
