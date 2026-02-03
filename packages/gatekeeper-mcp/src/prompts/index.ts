/**
 * MCP Prompts v2.3
 * - 3 prompts: create_plan, generate_spec, implement_code
 * - Each prompt has explicit STOP boundary
 * - Flow:
 *   1. create_plan → produces plan.json + contract.md + task.spec.md → saves to artifacts/{outputId}
 *   2. generate_spec(outputId) → reads 3 artifacts from disk → produces spec.test → saves to same folder
 *   3. implement_code(outputId) → reads 4 artifacts from disk → implements code
 */

import * as fs from 'fs'
import * as path from 'path'
import type { Prompt, PromptMessage } from '@modelcontextprotocol/sdk/types.js'
import type { GatekeeperClient } from '../client/GatekeeperClient.js'
import { LocalDocsReader } from './LocalDocsReader.js'

export interface PromptContext {
  client: GatekeeperClient
  docsDir: string
  artifactsDir: string
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
    description: 'Step 1/3 — Generate plan.json + contract.md + task.spec.md. Do NOT generate test code or implementation.',
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
    description: 'Step 2/3 — Read artifacts from outputId folder, generate spec.test. Do NOT implement code.',
    arguments: [
      {
        name: 'outputId',
        description: 'Artifacts folder name (e.g. 2025_01_30_001_my-task)',
        required: true,
      },
    ],
  },
  {
    name: 'implement_code',
    description: 'Step 3/3 — Read artifacts from outputId folder, implement code that passes spec.test. Do NOT modify tests.',
    arguments: [
      {
        name: 'outputId',
        description: 'Artifacts folder name (e.g. 2025_01_30_001_my-task)',
        required: true,
      },
    ],
  },
]

export function getAllPrompts(): Prompt[] {
  return prompts
}

// ─────────────────────────────────────────────────────────────────────────────
// Artifact Reader
// ─────────────────────────────────────────────────────────────────────────────

function readArtifact(artifactsDir: string, outputId: string, filename: string): string | null {
  const filepath = path.join(artifactsDir, outputId, filename)
  try {
    return fs.readFileSync(filepath, 'utf-8')
  } catch {
    return null
  }
}

function listArtifacts(artifactsDir: string, outputId: string): string[] {
  const dir = path.join(artifactsDir, outputId)
  try {
    return fs.readdirSync(dir)
  } catch {
    return []
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OutputId Generator
// ─────────────────────────────────────────────────────────────────────────────

function generateOutputId(taskDescription: string): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const nnn = String(Math.floor(Math.random() * 900) + 100) // 100-999
  const slug = taskDescription
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40)
    .replace(/-$/, '')
  return `${yyyy}_${mm}_${dd}_${nnn}_${slug}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Stop Boundaries
// ─────────────────────────────────────────────────────────────────────────────

function stopPlan(outputId: string): string {
  return `
---
## ⛔ STOP — Boundary Rule
Your job in this conversation is ONLY to produce **plan.json**, **contract.md**, and **task.spec.md**.
- Do NOT generate test code (spec.test).
- Do NOT generate implementation code.
- Do NOT continue to the next step.
- Save ALL 3 artifacts using the save_artifacts tool with outputId exactly: **${outputId}**
- After saving, STOP.
The test code and implementation will be done by separate LLMs in separate conversations.
---`
}

const STOP_SPEC = `
---
## ⛔ STOP — Boundary Rule
Your job in this conversation is ONLY to produce the test code file.
- Do NOT implement any production code.
- Do NOT modify the contract, plan, or task.spec.md.
- Do NOT continue to the next step.
- Save the test file using the save_artifacts tool to the SAME outputId folder.
- After saving, STOP.
The implementation will be done by a separate LLM in a separate conversation.
---`

const STOP_CODE = `
---
## ⛔ STOP — Boundary Rule
Your job in this conversation is ONLY to implement production code that passes the spec tests.
- Do NOT modify the spec tests.
- Do NOT modify the task spec (task.spec.md).
- Do NOT modify the contract (contract.md).
- Do NOT modify the plan (plan.json).
- If a test seems wrong, flag it but do NOT change it.
---`

// ─────────────────────────────────────────────────────────────────────────────
// Session Context Builder
// ─────────────────────────────────────────────────────────────────────────────

async function buildSessionContext(
  ctx: PromptContext,
  args: Record<string, unknown>
): Promise<string> {
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
    sessionContext += '\n[Session config unavailable — API offline]\n'
  }
  return sessionContext
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function handlePromptRequest(
  name: string,
  args: Record<string, unknown>,
  ctx: PromptContext
): Promise<PromptResult> {
  const sessionContext = await buildSessionContext(ctx, args)

  switch (name) {
    case 'create_plan':
      return handleCreatePlan(args, ctx, sessionContext)
    case 'generate_spec':
      return handleGenerateSpec(args, ctx, sessionContext)
    case 'implement_code':
      return handleImplementCode(args, ctx, sessionContext)
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
// Step 1: Create Plan
// ─────────────────────────────────────────────────────────────────────────────

function handleCreatePlan(
  args: Record<string, unknown>,
  ctx: PromptContext,
  sessionContext: string
): PromptResult {
  const reader = new LocalDocsReader(ctx.docsDir)
  const taskDescription = args.taskDescription as string
  const taskType = args.taskType as string | undefined
  const outputId = generateOutputId(taskDescription)

  const docs = reader.readFolder('create_plan')

  let text = `# Create Plan (Step 1/3)\n\n## Task\n${taskDescription}\n`
  text += `\n## OutputId\n${outputId}\n`

  if (taskType) {
    text += `\n## Task Type\n${taskType}\n`
  }

  text += `\n## Reference Documents\n${docs}\n`
  text += sessionContext
  text += `\nGenerate the following 3 artifacts:\n1. **plan.json** — structured task plan\n2. **contract.md** — validation contract with clauses (CL-XXX)\n3. **task.spec.md** — human-readable test specification describing what each test should verify\n`
  text += stopPlan(outputId)

  return {
    messages: [{
      role: 'user',
      content: { type: 'text', text },
    }],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2: Generate Spec Test
// ─────────────────────────────────────────────────────────────────────────────

function handleGenerateSpec(
  args: Record<string, unknown>,
  ctx: PromptContext,
  sessionContext: string
): PromptResult {
  const reader = new LocalDocsReader(ctx.docsDir)
  const outputId = args.outputId as string

  // Read artifacts from disk
  const planContent = readArtifact(ctx.artifactsDir, outputId, 'plan.json')
  const contractContent = readArtifact(ctx.artifactsDir, outputId, 'contract.md')
  const specContent = readArtifact(ctx.artifactsDir, outputId, 'task.spec.md')
  const files = listArtifacts(ctx.artifactsDir, outputId)

  if (!planContent || !contractContent || !specContent) {
    const missing: string[] = []
    if (!planContent) missing.push('plan.json')
    if (!contractContent) missing.push('contract.md')
    if (!specContent) missing.push('task.spec.md')

    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `❌ Artefatos faltando em ${outputId}: ${missing.join(', ')}\nArquivos encontrados: ${files.join(', ') || 'nenhum'}`,
        },
      }],
    }
  }

  const docs = reader.readFolder('generate_spec')

  let text = `# Generate Spec Test (Step 2/3)\n\n`
  text += `## OutputId\n${outputId}\n\n`
  text += `## Plan (plan.json)\n\`\`\`json\n${planContent}\n\`\`\`\n\n`
  text += `## Contract (contract.md)\n${contractContent}\n\n`
  text += `## Task Spec (task.spec.md)\n${specContent}\n\n`
  text += `## Reference Documents\n${docs}\n`
  text += sessionContext
  text += `\nGenerate the actual test code file that implements every test case described in task.spec.md.\nEach test should be tagged with its corresponding clause ID using \`// @clause CL-XXX\` comments.\nSave the test file to the same outputId folder: ${outputId}\n`
  text += STOP_SPEC

  return {
    messages: [{
      role: 'user',
      content: { type: 'text', text },
    }],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3: Implement Code
// ─────────────────────────────────────────────────────────────────────────────

function handleImplementCode(
  args: Record<string, unknown>,
  ctx: PromptContext,
  sessionContext: string
): PromptResult {
  const reader = new LocalDocsReader(ctx.docsDir)
  const outputId = args.outputId as string

  // Read all artifacts from disk
  const planContent = readArtifact(ctx.artifactsDir, outputId, 'plan.json')
  const contractContent = readArtifact(ctx.artifactsDir, outputId, 'contract.md')
  const specContent = readArtifact(ctx.artifactsDir, outputId, 'task.spec.md')
  const files = listArtifacts(ctx.artifactsDir, outputId)

  // Find the test file (could be named differently)
  const testFile = files.find(f => f.match(/\.spec\.(ts|tsx|js|jsx)$/) || f.match(/\.test\.(ts|tsx|js|jsx)$/) || f === 'spec.test')
  const testContent = testFile ? readArtifact(ctx.artifactsDir, outputId, testFile) : null

  if (!planContent || !contractContent || !specContent || !testContent) {
    const missing: string[] = []
    if (!planContent) missing.push('plan.json')
    if (!contractContent) missing.push('contract.md')
    if (!specContent) missing.push('task.spec.md')
    if (!testContent) missing.push('spec.test (test code file)')

    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `❌ Artefatos faltando em ${outputId}: ${missing.join(', ')}\nArquivos encontrados: ${files.join(', ') || 'nenhum'}`,
        },
      }],
    }
  }

  const docs = reader.readFolder('implement_code')

  let text = `# Implement Code (Step 3/3)\n\n`
  text += `## OutputId\n${outputId}\n\n`
  text += `## Plan (plan.json)\n\`\`\`json\n${planContent}\n\`\`\`\n\n`
  text += `## Contract (contract.md)\n${contractContent}\n\n`
  text += `## Task Spec (task.spec.md)\n${specContent}\n\n`
  text += `## Spec Test (${testFile})\n\`\`\`\n${testContent}\n\`\`\`\n\n`
  text += `## Reference Documents\n${docs}\n`
  text += sessionContext
  text += `\nImplement the production code so that ALL spec tests pass.\nDo NOT modify any test file. If a test seems incorrect, flag it but implement to pass it.\n`
  text += STOP_CODE

  return {
    messages: [{
      role: 'user',
      content: { type: 'text', text },
    }],
  }
}

export { LocalDocsReader } from './LocalDocsReader.js'
