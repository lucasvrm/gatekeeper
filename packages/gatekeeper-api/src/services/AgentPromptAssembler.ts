/**
 * Agent Prompt Assembler
 *
 * Builds system prompts for each pipeline phase by querying
 * PromptInstruction entries from the database.
 *
 * Content is managed via CRUD (seed + API) — no hardcoded defaults.
 * Pipeline entries are identified by step + kind fields on PromptInstruction.
 */

import type { PrismaClient } from '@prisma/client'

interface AssembledPrompt {
  systemPrompt: string
  instructions: string[]
  docs: string[]
}

export class AgentPromptAssembler {
  constructor(private prisma: PrismaClient) {}

  /**
   * Assemble the system prompt for a given pipeline step.
   *
   * Queries PromptInstruction entries where step is set,
   * concatenated in order. The kind field is ignored for assembly —
   * all active entries for the step are joined as a single prompt.
   */
  async assembleForStep(step: number): Promise<string> {
    const contents = await this.prisma.promptInstruction.findMany({
      where: { step, isActive: true },
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
}
