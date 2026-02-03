/**
 * MCP Prompts v2
 * - 2 prompts: create_plan, generate_spec
 * - Reads all docs from subfolder (DOCS_DIR/create_plan/, DOCS_DIR/generate_spec/)
 * - Fetches session config + prompt instructions from API
 */

import type { Prompt, PromptMessage } from '@modelcontextprotocol/sdk/types.js'
import type { GatekeeperClient } from '../client/GatekeeperClient.js'
import { LocalDocsReader } from './LocalDocsReader.js'

export interface PromptContext {
  client: GatekeeperClient
  docsDir: string
}

export interface PromptResult {
  messages: PromptMessage[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt Definitions
// ─────────────────────────────────────────────────────────────────────────────

const prompts: Prompt[] = [
  {
    name: 'create_plan',
    description: 'Generate a task plan (plan.json + contract.md + task.spec.md) using Gatekeeper methodology',
    arguments: [
      {
        name: 'taskDescription',
        description: 'Description of the task to plan',
        required: true,
      },
      {
        name: 'taskType',
        description: 'Type of task (e.g. feature, bugfix, refactor)',
        required: false,
      },
    ],
  },
  {
    name: 'generate_spec',
    description: 'Generate test specification from contract',
    arguments: [
      {
        name: 'contractContent',
        description: 'Content of contract.md',
        required: true,
      },
      {
        name: 'planContent',
        description: 'Content of plan.json (optional)',
        required: false,
      },
    ],
  },
]

export function getAllPrompts(): Prompt[] {
  return prompts
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function handlePromptRequest(
  name: string,
  args: Record<string, unknown>,
  ctx: PromptContext
): Promise<PromptResult> {
  // Fetch session config + prompt instructions from API (best effort)
  let sessionContext = ''
  try {
    const sessionRes = await ctx.client.getSessionConfig()
    const config = sessionRes.config

    // Git strategy instruction
    if (config?.gitStrategy === 'new-branch') {
      const branchName = config.branch || `feature/${(args.taskDescription as string || 'task').slice(0, 30).replace(/\s+/g, '-').toLowerCase()}`
      sessionContext += `\n## Git Strategy\nCrie uma nova branch antes de implementar: ${branchName}\n`
    } else if (config?.gitStrategy === 'existing-branch' && config.branch) {
      sessionContext += `\n## Git Strategy\nUse a branch existente: ${config.branch}\n`
    } else {
      sessionContext += `\n## Git Strategy\nCommit direto na branch atual.\n`
    }

    // Resolve prompts: profile-aware or fallback to all active
    let activePrompts: { name: string; content: string; isActive: boolean }[] = []

    if (config?.activeProfileId) {
      try {
        const profile = await ctx.client.getProfile(config.activeProfileId)
        activePrompts = profile.prompts.filter(p => p.isActive)
      } catch {
        // Profile not found — fallback to all active
        const promptsRes = await ctx.client.getPrompts()
        activePrompts = promptsRes.filter(p => p.isActive)
      }
    } else {
      const promptsRes = await ctx.client.getPrompts()
      activePrompts = promptsRes.filter(p => p.isActive)
    }

    if (activePrompts.length > 0) {
      sessionContext += `\n## Instruções Adicionais\n`
      for (const p of activePrompts) {
        sessionContext += `### ${p.name}\n${p.content}\n\n`
      }
    }
  } catch {
    // API offline — continue without session context
    sessionContext += '\n[Session config unavailable — API offline]\n'
  }

  switch (name) {
    case 'create_plan':
      return handleCreatePlan(args, ctx.docsDir, sessionContext)
    case 'generate_spec':
      return handleGenerateSpec(args, ctx.docsDir, sessionContext)
    default:
      return {
        messages: [{
          role: 'user',
          content: { type: 'text', text: `Unknown prompt: ${name}` },
        }],
      }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual Prompt Handlers
// ─────────────────────────────────────────────────────────────────────────────

function handleCreatePlan(
  args: Record<string, unknown>,
  docsDir: string,
  sessionContext: string
): PromptResult {
  const reader = new LocalDocsReader(docsDir)
  const taskDescription = args.taskDescription as string
  const taskType = args.taskType as string | undefined

  const docs = reader.readFolder('create_plan')

  let text = `# Create Plan\n\n## Task\n${taskDescription}\n`

  if (taskType) {
    text += `\n## Task Type\n${taskType}\n`
  }

  text += `\n## Reference Documents\n${docs}\n`
  text += sessionContext

  return {
    messages: [{
      role: 'user',
      content: { type: 'text', text },
    }],
  }
}

function handleGenerateSpec(
  args: Record<string, unknown>,
  docsDir: string,
  sessionContext: string
): PromptResult {
  const reader = new LocalDocsReader(docsDir)
  const contractContent = args.contractContent as string
  const planContent = args.planContent as string | undefined

  const docs = reader.readFolder('generate_spec')

  let text = `# Generate Spec\n\n## Contract\n${contractContent}\n`

  if (planContent) {
    text += `\n## Plan\n${planContent}\n`
  }

  text += `\n## Reference Documents\n${docs}\n`
  text += sessionContext
  text += `\nGenerate a test specification that covers all clauses in the contract.\nEach test should be tagged with its corresponding clause ID using \`// @clause CL-XXX\` comments.\n`

  return {
    messages: [{
      role: 'user',
      content: { type: 'text', text },
    }],
  }
}

export { LocalDocsReader } from './LocalDocsReader.js'
