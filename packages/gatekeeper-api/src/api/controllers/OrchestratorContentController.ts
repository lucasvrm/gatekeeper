import type { Request, Response } from 'express'
import { prisma } from '../../db/client.js'
import type { CreateContentInput, UpdateContentInput } from '../schemas/agent.schema.js'

export class OrchestratorContentController {
  /**
   * GET /agent/content — List all content, optionally filtered by step/kind
   */
  async list(req: Request, res: Response): Promise<void> {
    const step = req.query.step ? parseInt(req.query.step as string, 10) : undefined
    const kind = req.query.kind as string | undefined

    const where: Record<string, unknown> = {}
    if (step !== undefined && !isNaN(step)) where.step = step
    if (kind) where.kind = kind

    const contents = await prisma.orchestratorContent.findMany({
      where,
      orderBy: [{ step: 'asc' }, { kind: 'asc' }, { order: 'asc' }],
    })

    res.json(contents)
  }

  /**
   * GET /agent/content/:id — Get a single content entry
   */
  async getById(req: Request, res: Response): Promise<void> {
    const { id } = req.params

    const content = await prisma.orchestratorContent.findUnique({
      where: { id },
    })

    if (!content) {
      res.status(404).json({ error: 'Content não encontrado' })
      return
    }

    res.json(content)
  }

  /**
   * GET /agent/content/preview/:step — Preview assembled prompt for a step
   */
  async previewPrompt(req: Request, res: Response): Promise<void> {
    const step = parseInt(req.params.step, 10)

    if (isNaN(step)) {
      res.status(400).json({ error: 'step deve ser um número' })
      return
    }

    const contents = await prisma.orchestratorContent.findMany({
      where: { step, isActive: true },
      orderBy: [{ kind: 'asc' }, { order: 'asc' }],
    })

    // Assemble like AgentPromptAssembler
    const instructions = contents
      .filter((c) => c.kind === 'instruction')
      .map((c) => c.content)

    const docs = contents
      .filter((c) => c.kind === 'doc')
      .map((c) => c.content)

    const prompts = contents
      .filter((c) => c.kind === 'prompt')
      .map((c) => c.content)

    const parts: string[] = []
    if (instructions.length > 0) parts.push(instructions.join('\n\n'))
    if (docs.length > 0) parts.push('## Reference Documentation\n\n' + docs.join('\n\n---\n\n'))
    if (prompts.length > 0) parts.push(prompts.join('\n\n'))

    const assembled = parts.join('\n\n')

    res.json({
      step,
      entryCount: contents.length,
      charCount: assembled.length,
      preview: assembled,
    })
  }

  /**
   * POST /agent/content — Create a new content entry
   */
  async create(req: Request, res: Response): Promise<void> {
    const data = req.body as CreateContentInput

    // Check unique constraint
    const existing = await prisma.orchestratorContent.findUnique({
      where: {
        step_kind_name: {
          step: data.step,
          kind: data.kind,
          name: data.name,
        },
      },
    })

    if (existing) {
      res.status(409).json({
        error: `Content com step=${data.step}, kind="${data.kind}", name="${data.name}" já existe.`,
      })
      return
    }

    const content = await prisma.orchestratorContent.create({ data })
    res.status(201).json(content)
  }

  /**
   * PUT /agent/content/:id — Update an existing content entry
   */
  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    const data = req.body as UpdateContentInput

    const existing = await prisma.orchestratorContent.findUnique({
      where: { id },
    })

    if (!existing) {
      res.status(404).json({ error: 'Content não encontrado' })
      return
    }

    const content = await prisma.orchestratorContent.update({
      where: { id },
      data,
    })

    res.json(content)
  }

  /**
   * DELETE /agent/content/:id — Delete a content entry
   */
  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params

    try {
      await prisma.orchestratorContent.delete({ where: { id } })
      res.status(204).end()
    } catch {
      res.status(404).json({ error: 'Content não encontrado' })
    }
  }
}
