/**
 * Gatekeeper Orchestrator — Prompt Builder (v2)
 *
 * Zero hardcoded templates. Everything comes from the DB via API:
 *   - Instructions (kind='instruction'): Define WHAT the LLM must do and produce
 *   - Docs (kind='doc'): Reference documentation about the project
 *   - Prompts (kind='prompt'): Behavioral directives and tone
 *
 * Each is scoped to a step (0-4) and ordered by `order` field.
 *
 * Assembly order:
 *   1. Instructions for the step (the task definition)
 *   2. Dynamic data (task description, artifacts, etc.)
 *   3. Docs for the step (reference material)
 *   4. Prompts for the step (behavioral guidelines)
 *   5. Session context (git strategy, MCP prompts)
 */

import type { FixTarget } from './types.js'
import type { SessionContext } from './session-context.js'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ContentItem {
  id: string
  name: string
  content: string
  order: number
}

interface StepContent {
  instructions: ContentItem[]
  docs: ContentItem[]
  prompts: ContentItem[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Content fetcher
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all active content for a given step from the Gatekeeper API.
 * Makes 3 parallel requests (instructions, docs, prompts).
 */
async function fetchStepContent(apiUrl: string, step: number): Promise<StepContent> {
  const fetchKind = async (kind: string): Promise<ContentItem[]> => {
    try {
      const res = await fetch(`${apiUrl}/orchestrator/${kind}s?step=${step}&active=true`)
      if (!res.ok) return []
      const data = await res.json()
      return data.data || []
    } catch {
      return []
    }
  }

  const [instructions, docs, prompts] = await Promise.all([
    fetchKind('instruction'),
    fetchKind('doc'),
    fetchKind('prompt'),
  ])

  return { instructions, docs, prompts }
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt assembler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assemble a complete prompt from DB content + dynamic data + session context.
 */
function assemblePrompt(
  content: StepContent,
  dynamicSections: string,
  sessionContext: SessionContext
): string {
  const parts: string[] = []

  // 1. Instructions (the "what to do and produce")
  if (content.instructions.length > 0) {
    for (const instr of content.instructions) {
      parts.push(instr.content)
    }
  }

  // 2. Dynamic data (task description, artifacts, etc.)
  parts.push(dynamicSections)

  // 3. Reference docs
  if (content.docs.length > 0) {
    const docBlock = content.docs
      .map((d) => `### ${d.name}\n\n${d.content}`)
      .join('\n\n---\n\n')
    parts.push(`## Documentação de Referência\n\n${docBlock}`)
  }

  // 4. Behavioral prompts
  if (content.prompts.length > 0) {
    const promptBlock = content.prompts
      .map((p) => `### ${p.name}\n\n${p.content}`)
      .join('\n\n')
    parts.push(`## Diretrizes\n\n${promptBlock}`)
  }

  // 5. Session context (git strategy + MCP custom instructions)
  if (sessionContext.gitStrategy) {
    parts.push(sessionContext.gitStrategy)
  }
  if (sessionContext.customInstructions) {
    parts.push(sessionContext.customInstructions)
  }

  return parts.filter(Boolean).join('\n\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API — one function per pipeline step
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Step 1: Build prompt for plan generation.
 *
 * Dynamic data: taskDescription, outputId, taskType
 */
export async function buildPlanPrompt(
  taskDescription: string,
  outputId: string,
  gatekeeperApiUrl: string,
  sessionContext: SessionContext,
  taskType?: string
): Promise<string> {
  const content = await fetchStepContent(gatekeeperApiUrl, 1)

  const dynamic = [
    `## Dados da Tarefa`,
    `**Descrição:** ${taskDescription}`,
    taskType ? `**Tipo:** ${taskType}` : '',
    `**Output ID:** ${outputId}`,
  ]
    .filter(Boolean)
    .join('\n')

  return assemblePrompt(content, dynamic, sessionContext)
}

/**
 * Step 2: Build prompt for spec/test generation.
 *
 * Dynamic data: outputId + existing artifacts (plan, contract, spec)
 */
export async function buildSpecPrompt(
  outputId: string,
  plan: string,
  contract: string,
  taskSpec: string,
  gatekeeperApiUrl: string,
  sessionContext: SessionContext
): Promise<string> {
  const content = await fetchStepContent(gatekeeperApiUrl, 2)

  const dynamic = [
    `## Output ID: ${outputId}`,
    `## Artefatos de Entrada`,
    `### plan.json\n\`\`\`json\n${plan}\n\`\`\``,
    `### contract.md\n${contract}`,
    `### task.spec.md\n${taskSpec}`,
  ].join('\n\n')

  return assemblePrompt(content, dynamic, sessionContext)
}

/**
 * Fix: Build prompt for artifact correction after Gatekeeper rejection.
 *
 * Dynamic data: target, outputId, current artifacts, rejection report, failed validators
 */
export async function buildFixPrompt(
  target: FixTarget,
  outputId: string,
  currentArtifacts: Record<string, string>,
  rejectionReport: string,
  failedValidators: string[],
  gatekeeperApiUrl: string,
  sessionContext: SessionContext
): Promise<string> {
  const content = await fetchStepContent(gatekeeperApiUrl, 3)

  const artifactBlocks = Object.entries(currentArtifacts)
    .map(([name, c]) => `### ${name}\n\`\`\`\n${c}\n\`\`\``)
    .join('\n\n')

  const dynamic = [
    `## Alvo: ${target === 'plan' ? 'Artefatos de planejamento' : 'Arquivo de testes'}`,
    `## Output ID: ${outputId}`,
    `## Validadores que Falharam\n${failedValidators.map((v) => `- \`${v}\``).join('\n')}`,
    `## Relatório de Rejeição\n\n${rejectionReport}`,
    `## Artefatos Atuais\n\n${artifactBlocks}`,
  ].join('\n\n')

  return assemblePrompt(content, dynamic, sessionContext)
}

/**
 * Step 4: Build prompt for implementation execution.
 *
 * Dynamic data: outputId + all approved artifacts
 */
export async function buildExecutionPrompt(
  outputId: string,
  artifacts: Record<string, string>,
  gatekeeperApiUrl: string,
  sessionContext: SessionContext
): Promise<string> {
  const content = await fetchStepContent(gatekeeperApiUrl, 4)

  const artifactBlocks = Object.entries(artifacts)
    .map(([name, c]) => `### ${name}\n\`\`\`\n${c}\n\`\`\``)
    .join('\n\n')

  const dynamic = [
    `## Output ID: ${outputId}`,
    `## Artefatos Aprovados\n\n${artifactBlocks}`,
  ].join('\n\n')

  return assemblePrompt(content, dynamic, sessionContext)
}
