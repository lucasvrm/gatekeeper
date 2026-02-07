/**
 * MCP Tools v3
 * 5 pipeline tools + 3 workflow tools (wrapping prompts)
 *
 * The 3 workflow tools (create_plan, generate_spec, implement_code) call
 * the same handlers as the MCP prompts. This gives Claude Desktop a
 * reliable invocation path (tools always work) while keeping the prompts
 * registered for clients that support them (Claude Code, VS Code, etc.).
 */

import * as fs from 'fs'
import * as path from 'path'
import type { Tool, TextContent } from '@modelcontextprotocol/sdk/types.js'
import type { GatekeeperClient } from './client/GatekeeperClient.js'
import type { Config } from './config.js'
import type { GatekeeperError, CreateRunInput } from './client/types.js'
import { handlePromptRequest, type PromptContext } from './prompts/index.js'

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
  // ── Workflow Tools (wrappers over MCP prompts) ────────────────────────────
  {
    name: 'create_plan',
    description:
      'Step 1/3 of TDD workflow. Returns full instructions, reference docs, session context, ' +
      'and STOP boundary for creating plan.json + contract.md + task.spec.md. ' +
      'Call this when the user wants to start a new TDD task. ' +
      'After receiving the response, follow the instructions precisely and use save_artifacts to persist the 3 files.',
    inputSchema: {
      type: 'object',
      properties: {
        taskDescription: {
          type: 'string',
          description: 'Description of the task to plan',
        },
        taskType: {
          type: 'string',
          description: 'Type of task (feature, bugfix, refactor)',
        },
      },
      required: ['taskDescription'],
    },
  },
  {
    name: 'generate_spec',
    description:
      'Step 2/3 of TDD workflow. Reads plan.json, contract.md, and task.spec.md from the ' +
      'outputId artifacts folder, then returns full instructions for generating the test code file. ' +
      'Call this after Step 1 is complete and all 3 artifacts are saved. ' +
      'After receiving the response, follow the instructions precisely and use save_artifacts to persist the test file.',
    inputSchema: {
      type: 'object',
      properties: {
        outputId: {
          type: 'string',
          description: 'Artifacts folder name (e.g. 2025_01_30_001_my-task)',
        },
      },
      required: ['outputId'],
    },
  },
  {
    name: 'implement_code',
    description:
      'Step 3/3 of TDD workflow. Reads all artifacts (plan, contract, task spec, test file) from ' +
      'the outputId folder, then returns full instructions for implementing production code. ' +
      'Call this after Step 2 is complete and the test file is saved. ' +
      'After receiving the response, follow the instructions precisely. Do NOT modify test files.',
    inputSchema: {
      type: 'object',
      properties: {
        outputId: {
          type: 'string',
          description: 'Artifacts folder name (e.g. 2025_01_30_001_my-task)',
        },
      },
      required: ['outputId'],
    },
  },

  // ── Pipeline Tools ────────────────────────────────────────────────────────
  {
    name: 'save_artifacts',
    description:
      'Save artifact files to disk. For Step 1 (create_plan), you MUST save ALL THREE files: ' +
      'microplans.json (preferred) or plan.json (deprecated), contract.md, AND task.spec.md. ' +
      'Do NOT call this tool until all three are ready. ' +
      'For Step 2 (generate_spec), save the test code file to the same outputId folder.',
    inputSchema: {
      type: 'object',
      properties: {
        outputId: {
          type: 'string',
          description: 'Folder name inside artifacts dir (e.g. "2025_01_30_001_button-redesign")',
        },
        files: {
          type: 'array',
          description: 'Array of files to save',
          items: {
            type: 'object',
            properties: {
              filename: { type: 'string', description: 'File name (e.g. microplans.json, contract.md)' },
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
    description:
      'Start a contract validation run (gates 0-1). Reads plan.json from the artifacts folder and creates the run via API.',
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

const WORKFLOW_TOOLS = new Set(['create_plan', 'generate_spec', 'implement_code'])

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  try {
    // Workflow tools → delegate to prompt handlers (single source of truth)
    if (WORKFLOW_TOOLS.has(name)) {
      return handleWorkflowTool(name, args, ctx)
    }

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

// ── Workflow Tool Handler ──────────────────────────────────────────────────
// Calls the exact same logic as MCP prompts, but returns as tool output
// so Claude Desktop can reliably invoke it.

async function handleWorkflowTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  const promptCtx: PromptContext = {
    client: ctx.client,
    docsDir: ctx.config.DOCS_DIR,
    artifactsDir: ctx.config.ARTIFACTS_DIR,
  }

  const result = await handlePromptRequest(name, args, promptCtx)

  // Extract text from PromptMessage[] → single string
  const text = result.messages
    .map((m) => {
      if (typeof m.content === 'string') return m.content
      if (m.content && typeof m.content === 'object' && 'text' in m.content) {
        return (m.content as { text: string }).text
      }
      return ''
    })
    .filter(Boolean)
    .join('\n\n')

  return { content: [{ type: 'text', text }] }
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
  let validationErrors: string[] = []

  for (const file of files) {
    const filepath = path.join(dir, file.filename)

    // Validate microplans.json schema
    if (file.filename === 'microplans.json') {
      try {
        const parsed = JSON.parse(file.content)

        // Validate required fields
        if (!parsed.task || typeof parsed.task !== 'string') {
          validationErrors.push('microplans.json: campo "task" (string) é obrigatório')
        }
        if (!Array.isArray(parsed.microplans) || parsed.microplans.length === 0) {
          validationErrors.push('microplans.json: campo "microplans" (array não-vazio) é obrigatório')
        } else {
          // Validate each microplan
          parsed.microplans.forEach((mp: any, idx: number) => {
            if (!mp.id || typeof mp.id !== 'string') {
              validationErrors.push(`microplans.json: microplan[${idx}].id (string) é obrigatório`)
            }
            if (!mp.goal || typeof mp.goal !== 'string') {
              validationErrors.push(`microplans.json: microplan[${idx}].goal (string) é obrigatório`)
            }
            if (!Array.isArray(mp.files) || mp.files.length === 0) {
              validationErrors.push(`microplans.json: microplan[${idx}].files (array não-vazio) é obrigatório`)
            } else {
              // Validate each file
              mp.files.forEach((f: any, fIdx: number) => {
                if (!f.path || typeof f.path !== 'string') {
                  validationErrors.push(`microplans.json: microplan[${idx}].files[${fIdx}].path (string) é obrigatório`)
                }
                if (!f.action || !['CREATE', 'EDIT', 'DELETE'].includes(f.action)) {
                  validationErrors.push(`microplans.json: microplan[${idx}].files[${fIdx}].action deve ser CREATE, EDIT ou DELETE`)
                }
                if (!f.what || typeof f.what !== 'string') {
                  validationErrors.push(`microplans.json: microplan[${idx}].files[${fIdx}].what (string) é obrigatório`)
                }
              })
            }
            if (!mp.verify || typeof mp.verify !== 'string') {
              validationErrors.push(`microplans.json: microplan[${idx}].verify (string) é obrigatório`)
            }
          })
        }
      } catch (err) {
        validationErrors.push(`microplans.json: JSON inválido - ${(err as Error).message}`)
      }
    }

    // Log deprecation warning for plan.json
    if (file.filename === 'plan.json') {
      console.log('⚠️ [DEPRECATED] plan.json está deprecated. Use microplans.json para novos projetos.')
    }

    fs.writeFileSync(filepath, file.content, 'utf-8')
    saved.push(file.filename)
  }

  // Return validation errors if any
  if (validationErrors.length > 0) {
    return {
      content: [{
        type: 'text',
        text: `❌ Erro(s) de validação:\n${validationErrors.map(e => `  • ${e}`).join('\n')}`,
      }],
      isError: true,
    }
  }

  // Warn if step 1 artifacts are incomplete
  const hasMicroplans = saved.includes('microplans.json')
  const hasPlan = saved.includes('plan.json')
  const hasContract = saved.includes('contract.md')
  const hasSpec = saved.includes('task.spec.md')
  let warning = ''

  if ((hasMicroplans || hasPlan) && hasContract && !hasSpec) {
    warning = '\n\n⚠️ MISSING task.spec.md — Step 1 requires ALL THREE: microplans.json (or plan.json), contract.md, AND task.spec.md. Generate task.spec.md and save it now.'
  }

  const formatUsed = hasMicroplans ? 'microplans.json' : hasPlan ? 'plan.json (deprecated)' : 'unknown'

  return {
    content: [{
      type: 'text',
      text: `✅ ${saved.length} arquivo(s) salvo(s) em ${dir}:\n${saved.map(f => `  • ${f}`).join('\n')}\n\n📋 Formato: ${formatUsed}${warning}`,
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
