/**
 * MCP Tools v2
 * 5 tools focused on the pipeline workflow
 */

import * as fs from 'fs'
import * as path from 'path'
import type { Tool, TextContent } from '@modelcontextprotocol/sdk/types.js'
import type { GatekeeperClient } from './client/GatekeeperClient.js'
import type { Config } from './config.js'
import type { GatekeeperError, CreateRunInput } from './client/types.js'

export interface ToolContext {
  client: GatekeeperClient
  config: Config
}

export interface ToolResult {
  content: TextContent[]
  isError?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Definitions
// ─────────────────────────────────────────────────────────────────────────────

export const tools: Tool[] = [
  {
    name: 'save_artifacts',
    description: 'Save one or more artifact files to disk. Use after generating plan.json, contract.md, task.spec.md, or spec tests.',
    inputSchema: {
      type: 'object',
      properties: {
        outputId: {
          type: 'string',
          description: 'Folder name inside artifacts dir (e.g. "button-redesign")',
        },
        files: {
          type: 'array',
          description: 'Array of files to save',
          items: {
            type: 'object',
            properties: {
              filename: { type: 'string', description: 'File name (e.g. plan.json, contract.md)' },
              content: { type: 'string', description: 'File content' },
            },
            required: ['filename', 'content'],
          },
        },
      },
      required: ['outputId', 'files'],
    },
  },
  {
    name: 'start_contract_run',
    description: 'Start a contract validation run (gates 0-1). Reads plan.json from the artifacts folder and creates the run via API.',
    inputSchema: {
      type: 'object',
      properties: {
        outputId: {
          type: 'string',
          description: 'Artifacts folder name containing plan.json',
        },
        projectId: {
          type: 'string',
          description: 'Optional project ID',
        },
      },
      required: ['outputId'],
    },
  },
  {
    name: 'continue_execution',
    description: 'Continue a run to execution phase (gates 2-3) after contract validation passes.',
    inputSchema: {
      type: 'object',
      properties: {
        runId: {
          type: 'string',
          description: 'Run ID from the contract run',
        },
        gateNumber: {
          type: 'number',
          description: 'Gate to start from (default: 2)',
        },
      },
      required: ['runId'],
    },
  },
  {
    name: 'get_run_status',
    description: 'Get human-readable status of a validation run, including which gate/validator passed or failed.',
    inputSchema: {
      type: 'object',
      properties: {
        runId: {
          type: 'string',
          description: 'Run ID',
        },
      },
      required: ['runId'],
    },
  },
  {
    name: 'list_recent_runs',
    description: 'List recent validation runs with brief status.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Max number of runs to return (default: 5)',
        },
      },
    },
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Tool Handlers
// ─────────────────────────────────────────────────────────────────────────────

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  try {
    switch (name) {
      case 'save_artifacts':
        return handleSaveArtifacts(args, ctx)
      case 'start_contract_run':
        return handleStartContractRun(args, ctx)
      case 'continue_execution':
        return handleContinueExecution(args, ctx)
      case 'get_run_status':
        return handleGetRunStatus(args, ctx)
      case 'list_recent_runs':
        return handleListRecentRuns(args, ctx)
      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true }
    }
  } catch (error) {
    const err = error as GatekeeperError
    if (err.code === 'ECONNREFUSED') {
      return { content: [{ type: 'text', text: '❌ Gatekeeper API indisponível (ECONNREFUSED)' }], isError: true }
    }
    return { content: [{ type: 'text', text: `❌ Erro: ${err.message}` }], isError: true }
  }
}

// ── save_artifacts ──────────────────────────────────────────────────────────

async function handleSaveArtifacts(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  const { outputId, files } = args as {
    outputId: string
    files: Array<{ filename: string; content: string }>
  }

  if (!outputId || !files?.length) {
    return { content: [{ type: 'text', text: '❌ outputId e files são obrigatórios' }], isError: true }
  }

  const dir = path.join(ctx.config.ARTIFACTS_DIR, outputId)
  fs.mkdirSync(dir, { recursive: true })

  const saved: string[] = []
  for (const file of files) {
    const filepath = path.join(dir, file.filename)
    fs.writeFileSync(filepath, file.content, 'utf-8')
    saved.push(file.filename)
  }

  return {
    content: [{
      type: 'text',
      text: `✅ ${saved.length} arquivo(s) salvo(s) em ${dir}:\n${saved.map(f => `  • ${f}`).join('\n')}`,
    }],
  }
}

// ── start_contract_run ──────────────────────────────────────────────────────

async function handleStartContractRun(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  const { outputId, projectId } = args as { outputId: string; projectId?: string }

  if (!outputId) {
    return { content: [{ type: 'text', text: '❌ outputId é obrigatório' }], isError: true }
  }

  // Read plan.json from artifacts folder
  const planPath = path.join(ctx.config.ARTIFACTS_DIR, outputId, 'plan.json')
  if (!fs.existsSync(planPath)) {
    return {
      content: [{ type: 'text', text: `❌ plan.json não encontrado em ${planPath}` }],
      isError: true,
    }
  }

  let plan: Record<string, unknown>
  try {
    plan = JSON.parse(fs.readFileSync(planPath, 'utf-8'))
  } catch {
    return { content: [{ type: 'text', text: '❌ plan.json inválido (JSON parse error)' }], isError: true }
  }

  const input: CreateRunInput = {
    outputId: (plan.outputId as string) || outputId,
    taskPrompt: (plan.taskPrompt as string) || '',
    manifest: plan.manifest as CreateRunInput['manifest'],
    projectId,
    baseRef: plan.baseRef as string | undefined,
    targetRef: plan.targetRef as string | undefined,
    dangerMode: (plan.dangerMode as boolean) ?? false,
  }

  const result = await ctx.client.createRun(input)

  return {
    content: [{
      type: 'text',
      text: `✅ Contract run criado!\n  Run ID: ${result.runId}\n  Output: ${result.outputId}\n  Status: ${result.status}`,
    }],
  }
}

// ── continue_execution ──────────────────────────────────────────────────────

async function handleContinueExecution(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  const { runId, gateNumber } = args as { runId: string; gateNumber?: number }

  if (!runId) {
    return { content: [{ type: 'text', text: '❌ runId é obrigatório' }], isError: true }
  }

  const result = await ctx.client.continueRun(runId, gateNumber ?? 2)

  return {
    content: [{
      type: 'text',
      text: `✅ Execução continuada\n  Run: ${runId}\n  Gate: ${gateNumber ?? 2}\n  ${result.message}`,
    }],
  }
}

// ── get_run_status ──────────────────────────────────────────────────────────

async function handleGetRunStatus(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  const runId = args.runId as string
  if (!runId) {
    return { content: [{ type: 'text', text: '❌ runId é obrigatório' }], isError: true }
  }

  const run = await ctx.client.getRunResults(runId)

  const statusEmoji = run.status === 'PASSED' ? '✅' : run.status === 'FAILED' ? '❌' : run.status === 'RUNNING' ? '⏳' : '⏸️'

  let text = `${statusEmoji} Run ${runId}\n`
  text += `  Status: ${run.status}\n`
  text += `  Output: ${run.outputId}\n`
  text += `  Gate atual: ${run.currentGate}\n`

  if (run.gateResults?.length) {
    text += '\n  Gates:\n'
    for (const gate of run.gateResults) {
      const gateEmoji = gate.passed ? '✅' : gate.status === 'RUNNING' ? '⏳' : gate.status === 'PENDING' ? '⏸️' : '❌'
      text += `    ${gateEmoji} Gate ${gate.gateNumber} (${gate.gateName}): ${gate.status}\n`
    }
  }

  if (run.failedValidatorCode) {
    text += `\n  ❌ Falhou em: ${run.failedValidatorCode}\n`
    const failedValidator = run.validatorResults?.find(v => v.validatorCode === run.failedValidatorCode)
    if (failedValidator?.message) {
      text += `  Motivo: ${failedValidator.message}\n`
    }
  }

  return { content: [{ type: 'text', text }] }
}

// ── list_recent_runs ────────────────────────────────────────────────────────

async function handleListRecentRuns(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  const limit = (args.limit as number) || 5
  const result = await ctx.client.listRuns({ limit })

  if (!result.data?.length) {
    return { content: [{ type: 'text', text: 'Nenhuma run encontrada.' }] }
  }

  const lines = result.data.map((run) => {
    const emoji = run.status === 'PASSED' ? '✅' : run.status === 'FAILED' ? '❌' : run.status === 'RUNNING' ? '⏳' : '⏸️'
    const date = new Date(run.createdAt).toLocaleString('pt-BR')
    return `${emoji} ${run.id.slice(0, 8)}… | ${run.outputId} | ${run.status} | ${date}`
  })

  return {
    content: [{
      type: 'text',
      text: `Últimas ${result.data.length} runs:\n${lines.join('\n')}`,
    }],
  }
}
