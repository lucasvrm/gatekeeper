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
    const args = this.buildArgs(params, prompt)

    console.log(
      `[ClaudeCode] Spawning: ${this.claudePath} -p "..." ` +
      `--model ${this.mapModel(params.model)} ` +
      `(cwd: ${params.cwd || 'inherit'})`,
    )

    const startMs = Date.now()
    const result = await this.spawnAndCollect(args, params.cwd)
    const durationMs = Date.now() - startMs

    console.log(
      `[ClaudeCode] Done in ${(durationMs / 1000).toFixed(1)}s` +
      ` — ${result.numTurns} turns, $${result.costUsd.toFixed(4)} USD` +
      (result.sessionId ? `, session: ${result.sessionId}` : ''),
    )

    if (result.isError) {
      throw new Error(`Claude Code returned error: ${result.resultText}`)
    }

    // Map token usage from Claude Code's response
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

  private buildArgs(params: ChatParams, prompt: string): string[] {
    const args: string[] = [
      '-p', prompt,
      '--output-format', 'json',
      '--append-system-prompt', params.system,
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
   * Spawn `claude -p` with JSON output and collect the result.
   *
   * With `--output-format json`, Claude Code outputs a single JSON object
   * on stdout when done. We collect all stdout, parse it on exit.
   */
  private spawnAndCollect(
    args: string[],
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
    return new Promise((resolve, reject) => {
      const child = spawn(this.claudePath, args, {
        cwd: cwd || process.cwd(),
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      let stdout = ''
      let stderr = ''

      // Timeout guard
      const timer = setTimeout(() => {
        child.kill('SIGTERM')
        reject(new Error(
          `Claude Code timed out after ${this.timeoutMs / 1000}s`,
        ))
      }, this.timeoutMs)

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString()
      })

      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString()
      })

      child.on('close', (code) => {
        clearTimeout(timer)

        if (code !== 0 && !stdout.trim()) {
          reject(new Error(
            `Claude Code exited with code ${code}.\n` +
            `stderr: ${stderr.slice(-500)}`,
          ))
          return
        }

        try {
          const parsed = JSON.parse(stdout.trim()) as ClaudeCodeJsonResult
          
          // Extract token usage from modelUsage if available
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
        } catch {
          // If JSON parsing fails, return raw output
          if (code === 0) {
            resolve({
              resultText: stdout.trim() || '(no output)',
              costUsd: 0,
              numTurns: 0,
              sessionId: '',
              isError: false,
              usage: { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 },
            })
          } else {
            reject(new Error(
              `Claude Code exited with code ${code} and unparseable output.\n` +
              `stdout: ${stdout.slice(-300)}\nstderr: ${stderr.slice(-300)}`,
            ))
          }
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

      // Close stdin immediately (we pass prompt via args, not stdin)
      child.stdin.end()
    })
  }
}

// ─── Internal Types ─────────────────────────────────────────────────────────

/**
 * JSON result from `claude -p --output-format json`
 * Based on the actual output observed:
 * {
 *   "type": "result",
 *   "subtype": "success",
 *   "is_error": false,
 *   "result": "...",
 *   "total_cost_usd": 0.19,
 *   "num_turns": 1,
 *   "session_id": "...",
 *   "modelUsage": {
 *     "claude-opus-4-5-20251101": {
 *       "inputTokens": 3,
 *       "outputTokens": 4,
 *       "cacheReadInputTokens": 13880,
 *       "cacheCreationInputTokens": 29805,
 *       "costUSD": 0.19
 *     }
 *   }
 * }
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
