/**
 * Gatekeeper Orchestrator — Executor
 *
 * Step 4: Execute implementation code in the project context.
 *
 * Mode B (default): Claude Agent SDK — programmatic invocation
 * Mode C (fallback): Generate prompt file + CLI command for manual execution
 */

import * as fs from 'fs'
import * as path from 'path'
import type { ExecuteOutput, OrchestratorEvent } from './types.js'

export interface ExecutorCallbacks {
  onEvent?: (event: OrchestratorEvent) => void
}

/**
 * Execute implementation via Claude Agent SDK (Mode B).
 *
 * Requires: @anthropic-ai/claude-agent-sdk installed
 * Requires: Claude Code installed on the machine
 * Requires: ANTHROPIC_API_KEY set in environment
 */
export async function executeWithSDK(
  prompt: string,
  projectPath: string,
  callbacks: ExecutorCallbacks = {}
): Promise<ExecuteOutput> {
  callbacks.onEvent?.({ type: 'execute:start', mode: 'sdk' })

  try {
    // Dynamic import — only loads if the package is installed
    const { query } = await import('@anthropic-ai/claude-agent-sdk')

    let sessionId: string | undefined

    for await (const message of query({
      prompt,
      options: {
        cwd: projectPath,
        allowedTools: ['Read', 'Write', 'Edit', 'MultiEdit', 'Bash', 'Glob', 'Grep'],
        permissionMode: 'acceptEdits',
        settingSources: ['project'], // Load CLAUDE.md from project
        maxTurns: 250,
      },
    })) {
      // Capture session ID from init message
      if (message.type === 'system' && message.subtype === 'init') {
        sessionId = (message as Record<string, unknown>).session_id as string
      }

      // Stream assistant messages
      if (message.type === 'assistant') {
        const content = (message as Record<string, unknown>).message as { content: Array<{ type: string; text?: string; name?: string }> }
        for (const block of content?.content || []) {
          if (block.type === 'text' && block.text) {
            callbacks.onEvent?.({ type: 'execute:message', text: block.text })
          }
          if (block.type === 'tool_use' && block.name) {
            callbacks.onEvent?.({ type: 'execute:tool_use', tool: block.name })
          }
        }
      }

      // Completion
      if (message.type === 'result') {
        const result = message as Record<string, unknown>
        if (result.subtype === 'success') {
          callbacks.onEvent?.({ type: 'execute:complete' })
        } else {
          callbacks.onEvent?.({
            type: 'execute:error',
            error: (result.error as string) || `Execution ended with: ${result.subtype}`,
          })
        }
      }
    }

    return { mode: 'sdk', sessionId }
  } catch (error) {
    const err = error as Error

    // If the SDK is not installed, fall back to CLI mode
    if (err.message?.includes('Cannot find module') || err.code === 'ERR_MODULE_NOT_FOUND') {
      callbacks.onEvent?.({
        type: 'execute:error',
        error: 'Claude Agent SDK não instalado. Gerando fallback CLI...',
      })
      return executeWithCLI(prompt, projectPath, callbacks)
    }

    callbacks.onEvent?.({ type: 'execute:error', error: err.message })
    throw error
  }
}

/**
 * Generate prompt file + CLI command for manual execution (Mode C / Fallback).
 *
 * Writes the prompt to a .md file and returns the claude CLI command.
 */
export async function executeWithCLI(
  prompt: string,
  projectPath: string,
  callbacks: ExecutorCallbacks = {}
): Promise<ExecuteOutput> {
  callbacks.onEvent?.({ type: 'execute:start', mode: 'cli' })

  // Write prompt to a temp file in the project
  const promptDir = path.join(projectPath, '.gatekeeper')
  fs.mkdirSync(promptDir, { recursive: true })

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const promptFilePath = path.join(promptDir, `execute-${timestamp}.md`)
  fs.writeFileSync(promptFilePath, prompt, 'utf-8')

  // Build the CLI command
  const command = [
    'claude',
    '-p',
    `"$(cat ${promptFilePath})"`,
    '--allowedTools',
    '"Read,Write,Edit,MultiEdit,Bash(npm *),Bash(npx *),Bash(git *),Bash(pnpm *),Glob,Grep"',
  ].join(' ')

  callbacks.onEvent?.({
    type: 'execute:message',
    text: `Prompt salvo em: ${promptFilePath}\n\nExecute no terminal:\n\ncd ${projectPath}\n${command}`,
  })

  callbacks.onEvent?.({ type: 'execute:complete' })

  return {
    mode: 'cli',
    command,
    promptFilePath,
  }
}
