/**
 * Agent Prompt Assembler
 *
 * Builds system prompts and user message templates for each pipeline phase
 * by querying PromptInstruction entries from the database.
 *
 * Content is managed via CRUD (seed + API) — no hardcoded defaults.
 * Pipeline entries are identified by step + kind + role fields on PromptInstruction.
 *
 * Roles:
 *   - 'system' → concatenated into the system prompt
 *   - 'user' → user message template with Handlebars placeholders
 */

import type { PrismaClient } from '@prisma/client'
import Handlebars from 'handlebars'

interface AssembledPrompt {
  systemPrompt: string
  instructions: string[]
  docs: string[]
}

/**
 * Render a Handlebars template with variables.
 * Uses noEscape to preserve any HTML/markdown in the template.
 */
function renderTemplate(template: string, vars: Record<string, unknown>): string {
  const compiled = Handlebars.compile(template, { noEscape: true })
  return compiled(vars)
}

export class AgentPromptAssembler {
  constructor(private prisma: PrismaClient) {}

  /**
   * Assemble the system prompt for a given pipeline step.
   *
   * Queries PromptInstruction entries where step is set and role='system',
   * concatenated in order. The kind field is ignored for assembly —
   * all active entries for the step are joined as a single prompt.
   */
  async assembleForStep(step: number): Promise<string> {
    const contents = await this.prisma.promptInstruction.findMany({
      where: { step, role: 'system', isActive: true },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    })

    if (!contents || contents.length === 0) {
      throw new Error(
        `No prompt content configured for pipeline step ${step}. ` +
          `Run 'npm run db:seed' or create entries via the /api/agent/content CRUD API.`,
      )
    }

    const assembled = contents.map((c) => c.content).join('\n\n')

    if (!assembled) {
      throw new Error(
        `Prompt content for step ${step} exists but assembled to empty string. ` +
          `Check that entries have non-empty 'content' fields.`,
      )
    }

    return assembled
  }

  /**
   * Assemble prompts for all pipeline steps.
   * Returns a Map<step, systemPrompt>.
   */
  async assembleAll(): Promise<Map<number, string>> {
    const steps = [1, 2, 4]
    const result = new Map<number, string>()

    for (const step of steps) {
      result.set(step, await this.assembleForStep(step))
    }

    return result
  }

  /**
   * Assemble user message template for a given pipeline step.
   *
   * Queries PromptInstruction entries where step is set and role='user',
   * then applies Handlebars template rendering with the provided variables.
   *
   * @param step - Pipeline step (1-4)
   * @param vars - Template variables to substitute
   * @param kind - Optional kind filter (e.g., 'cli' for Claude Code specific templates)
   * @returns Rendered user message, or null if no template found
   */
  async assembleUserMessageForStep(
    step: number,
    vars: Record<string, unknown>,
    kind?: string,
  ): Promise<string | null> {
    const where: Record<string, unknown> = {
      step,
      role: 'user',
      isActive: true,
    }

    // If kind is specified, filter by it; otherwise get the default (kind is null or 'instruction')
    if (kind) {
      where.kind = kind
    }

    const templates = await this.prisma.promptInstruction.findMany({
      where,
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    })

    // If kind was specified but no results, fallback to default (no kind filter)
    if (templates.length === 0 && kind) {
      const fallback = await this.prisma.promptInstruction.findMany({
        where: { step, role: 'user', isActive: true },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
      })

      if (fallback.length === 0) return null

      const combined = fallback.map((t) => t.content).join('\n\n')
      return renderTemplate(combined, vars)
    }

    if (templates.length === 0) return null

    // Concatenate all templates for the step (usually there's just one)
    const combined = templates.map((t) => t.content).join('\n\n')
    return renderTemplate(combined, vars)
  }

  /**
   * Check if a user message template exists for a given step.
   */
  async hasUserMessageTemplate(step: number, kind?: string): Promise<boolean> {
    const where: Record<string, unknown> = {
      step,
      role: 'user',
      isActive: true,
    }
    if (kind) where.kind = kind

    const count = await this.prisma.promptInstruction.count({ where })
    return count > 0
  }

  // ─── Dynamic Instruction Templates ────────────────────────────────────────

  /**
   * Get a single template by name and render it with variables.
   */
  async getTemplateByName(
    name: string,
    vars: Record<string, unknown> = {},
  ): Promise<string | null> {
    const template = await this.prisma.promptInstruction.findUnique({
      where: { name },
    })

    if (!template || !template.isActive) return null
    return renderTemplate(template.content, vars)
  }

  /**
   * Get all templates matching a kind and optional step, rendered with variables.
   * Returns them concatenated in order.
   */
  async getTemplatesByKind(
    kind: string,
    vars: Record<string, unknown> = {},
    step?: number | null,
  ): Promise<string | null> {
    const where: Record<string, unknown> = {
      kind,
      isActive: true,
    }
    if (step !== undefined) {
      where.step = step
    }

    const templates = await this.prisma.promptInstruction.findMany({
      where,
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    })

    if (templates.length === 0) return null

    const rendered = templates.map((t) => renderTemplate(t.content, vars))
    return rendered.join('\n\n')
  }

  /**
   * Get CLI system prompt append for a specific step.
   */
  async getCliSystemAppend(step: number, vars: Record<string, unknown>): Promise<string | null> {
    return this.getTemplatesByKind('system-append-cli', vars, step)
  }

  /**
   * Get git strategy template based on strategy type.
   */
  async getGitStrategyTemplate(
    strategy: 'new-branch' | 'existing-branch' | 'main',
    vars: Record<string, unknown> = {},
  ): Promise<string | null> {
    const nameMap = {
      'new-branch': 'git-strategy-new-branch',
      'existing-branch': 'git-strategy-existing-branch',
      'main': 'git-strategy-main',
    }
    return this.getTemplateByName(nameMap[strategy], vars)
  }

  /**
   * Get custom instructions header.
   */
  async getCustomInstructionsHeader(): Promise<string | null> {
    return this.getTemplateByName('custom-instructions-header')
  }

  /**
   * Get all relevant guidance templates for a set of failed validators.
   * Returns only the guidance that applies to the validators that actually failed.
   */
  async getGuidanceForValidators(
    failedValidators: string[],
    vars: Record<string, unknown>,
  ): Promise<string[]> {
    // Map of validator codes to guidance template names
    const validatorGuidanceMap: Record<string, string> = {
      'NO_IMPLICIT_FILES': 'guidance-implicit-files',
      'TASK_CLARITY_CHECK': 'guidance-implicit-files',
      'TASK_SCOPE_SIZE': 'guidance-manifest-fix',
      'DELETE_DEPENDENCY_CHECK': 'guidance-manifest-fix',
      'PATH_CONVENTION': 'guidance-manifest-fix',
      'SENSITIVE_FILES_LOCK': 'guidance-manifest-fix',
      'TEST_CLAUSE_MAPPING_VALID': 'guidance-contract-clause-mapping',
      'TEST_RESILIENCE_CHECK': 'guidance-test-resilience',
      'NO_DECORATIVE_TESTS': 'guidance-test-quality',
      'TEST_HAS_ASSERTIONS': 'guidance-test-quality',
      'TEST_COVERS_HAPPY_AND_SAD_PATH': 'guidance-test-quality',
      'TEST_INTENT_ALIGNMENT': 'guidance-test-quality',
      'TEST_SYNTAX_VALID': 'guidance-test-quality',
      'IMPORT_REALITY_CHECK': 'guidance-test-quality',
      'MANIFEST_FILE_LOCK': 'guidance-test-quality',
      'CONTRACT_SCHEMA_INVALID': 'guidance-contract-schema',
      'DANGER_MODE_EXPLICIT': 'guidance-danger-mode',
    }

    // Collect unique guidance names needed
    const neededGuidance = new Set<string>()
    for (const validator of failedValidators) {
      const guidanceName = validatorGuidanceMap[validator]
      if (guidanceName) {
        neededGuidance.add(guidanceName)
      }
    }

    // Fetch and render each guidance
    const results: string[] = []
    for (const name of neededGuidance) {
      const rendered = await this.getTemplateByName(name, vars)
      if (rendered) {
        results.push(rendered)
      }
    }

    return results
  }

  /**
   * Build complete retry message from templates.
   */
  async buildRetryMessage(
    isCliProvider: boolean,
    vars: Record<string, unknown>,
  ): Promise<string | null> {
    const kind = isCliProvider ? 'retry-cli' : 'retry'

    // Get all retry templates for step 3
    const templates = await this.prisma.promptInstruction.findMany({
      where: {
        step: 3,
        kind: { in: [kind, 'retry'] }, // Include common 'retry' templates too
        isActive: true,
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    })

    if (templates.length === 0) return null

    // Filter: for CLI, use retry-cli templates; for API, use retry templates
    // but shared templates (like retry-previous-response-reference) should be included
    const filtered = templates.filter((t) => {
      if (isCliProvider) {
        // For CLI: use retry-cli specific OR shared retry templates that aren't API-specific
        return t.kind === 'retry-cli' || (t.kind === 'retry' && !t.name.includes('-api-'))
      } else {
        // For API: use retry specific OR shared retry templates that aren't CLI-specific
        return t.kind === 'retry' || (t.kind === 'retry-cli' && !t.name.includes('-cli-'))
      }
    })

    // Actually, let's simplify: CLI uses retry-cli, API uses retry
    const finalTemplates = templates.filter((t) => {
      if (isCliProvider) {
        return t.kind === 'retry-cli' ||
          (t.kind === 'retry' && ['retry-previous-response-reference', 'retry-original-artifact', 'retry-rejection-reminder'].includes(t.name))
      } else {
        return t.kind === 'retry' ||
          (t.kind === 'retry-cli' && false) // API never uses CLI templates
      }
    })

    const rendered = finalTemplates.map((t) => renderTemplate(t.content, vars))
    return rendered.join('\n\n')
  }

  /**
   * Get CLI message replacement template.
   */
  async getCliReplacement(
    step: number,
    replacementName: string,
    vars: Record<string, unknown>,
  ): Promise<string | null> {
    const name = `cli-replace-${replacementName}`
    return this.getTemplateByName(name, vars)
  }
}
