/**
 * Codex CLI Provider — Headless CLI Adapter
 *
 * Delegates the entire agent loop to the OpenAI Codex CLI (`codex`),
 * similar to ClaudeCodeProvider but for OpenAI models.
 *
 * How it works:
 *   1. Receives ChatParams (system, messages, tools, model, etc.)
 *   2. Combines messages into a single prompt string
 *   3. Spawns `codex --quiet --auto-edit` with the prompt
 *   4. Codex handles LLM calls AND tool execution internally
 *   5. Parses output and returns LLMResponse
 *   6. Returns stopReason 'end_turn' (loop always runs 1 iteration)
 *
 * Install: npm install -g @openai/codex
 * Auth: OPENAI_API_KEY env var
 */

import { spawn } from 'node:child_process'
import type {
  LLMProvider,
  LLMResponse,
  ChatParams,
  ContentBlock,
  AgentEvent,
} from '../../types/agent.types.js'

// ─── Config ───────────────────────────────────────────────────────────────────

export interface CodexCliProviderConfig {
  /** Path to the codex CLI binary. Defaults to 'codex'. */
  codexPath?: string
  /** Timeout in milliseconds. Defaults to 600_000 (10 min). */
  timeoutMs?: number
  /** Approval mode. Defaults to 'auto-edit' for full automation. */
  approvalMode?: 'suggest' | 'auto-edit' | 'full-auto'
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export class CodexCliProvider implements LLMProvider {
  readonly name = 'codex-cli' as const

  private codexPath: string
  private timeoutMs: number
  private approvalMode: string

  constructor(config?: CodexCliProviderConfig) {
    this.codexPath = config?.codexPath || 'codex'
    this.timeoutMs = config?.timeoutMs || 600_000
    this.approvalMode = config?.approvalMode || 'full-auto'
  }

  // ─── LLMProvider.chat() ───────────────────────────────────────────────

  async chat(params: ChatParams): Promise<LLMResponse> {
    const prompt = this.buildPrompt(params)
    const emit = params.onEvent ?? (() => {})

    console.log(
      `[Codex] Spawning: ${this.codexPath} --quiet` +
      ` --model ${params.model}` +
      ` (cwd: ${params.cwd || 'inherit'})`,
    )

    const startMs = Date.now()
    const result = await this.spawnAndStream(params, prompt, emit)
    const durationMs = Date.now() - startMs

    console.log(
      `[Codex] Done in ${(durationMs / 1000).toFixed(1)}s`,
    )

    const content: ContentBlock[] = [{ type: 'text', text: result.text }]

    return {
      content,
      stopReason: 'end_turn',
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
      },
    }
  }

  // ─── Prompt Construction ──────────────────────────────────────────────

  private buildPrompt(params: ChatParams): string {
    const parts: string[] = []

    // Include system prompt as context
    if (params.system) {
      parts.push(`<system_instructions>\n${params.system}\n</system_instructions>`)
    }

    for (const msg of params.messages) {
      if (typeof msg.content === 'string') {
        parts.push(msg.content)
      } else {
        for (const block of msg.content) {
          if (block.type === 'text') {
            parts.push(block.text)
          }
        }
      }
    }

    return parts.join('\n\n')
  }

  // ─── Process Management ───────────────────────────────────────────────

  private spawnAndStream(
    params: ChatParams,
    prompt: string,
    emit: (event: AgentEvent) => void,
  ): Promise<{ text: string }> {
    const args: string[] = [
      '--quiet',
      `--approval-mode`, this.approvalMode,
      '--model', params.model || 'o3-mini',
    ]

    return new Promise((resolve, reject) => {
      const child = spawn(this.codexPath, args, {
        cwd: params.cwd || process.cwd(),
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      let stdout = ''
      let stderr = ''

      const timer = setTimeout(() => {
        child.kill('SIGTERM')
        reject(new Error(
          `Codex CLI timed out after ${this.timeoutMs / 1000}s`,
        ))
      }, this.timeoutMs)

      child.stdout.on('data', (chunk: Buffer) => {
        const text = chunk.toString()
        stdout += text

        // Emit text events for real-time feedback
        if (text.trim()) {
          emit({ type: 'agent:text', text: text.trim().slice(0, 200) })
        }
      })

      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString()
      })

      child.on('close', (code: number | null) => {
        clearTimeout(timer)

        if (code !== 0 && !stdout.trim()) {
          reject(new Error(
            `Codex CLI exited with code ${code}.\nstderr: ${stderr.slice(-500)}`,
          ))
          return
        }

        resolve({ text: stdout.trim() || '(no output)' })
      })

      child.on('error', (err: Error & { code?: string }) => {
        clearTimeout(timer)
        if (err.code === 'ENOENT') {
          reject(new Error(
            `Codex CLI not found at "${this.codexPath}". ` +
            `Install with: npm install -g @openai/codex`,
          ))
        } else {
          reject(err)
        }
      })

      // Send prompt via stdin
      child.stdin.write(prompt)
      child.stdin.end()
    })
  }
}
