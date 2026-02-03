import type { Request, Response } from 'express'
import { prisma } from '../../db/client.js'

type ContentKind = 'instruction' | 'doc' | 'prompt'

/**
 * Generic CRUD controller for OrchestratorContent.
 * Instantiated per kind (instruction, doc, prompt) — same logic, different filters.
 */
export class OrchestratorContentController {
  private kind: ContentKind
  private label: string

  constructor(kind: ContentKind) {
    this.kind = kind
    this.label = kind.charAt(0).toUpperCase() + kind.slice(1)
  }

  async list(req: Request, res: Response): Promise<void> {
    const step = req.query.step !== undefined ? Number(req.query.step) : undefined
    const active = req.query.active === 'true' ? true : undefined

    const where: Record<string, unknown> = { kind: this.kind }
    if (step !== undefined && !isNaN(step)) where.step = step
    if (active !== undefined) where.isActive = active

    const items = await prisma.orchestratorContent.findMany({
      where,
      orderBy: [{ step: 'asc' }, { order: 'asc' }, { name: 'asc' }],
    })

    res.json({ data: items })
  }

  async get(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    const item = await prisma.orchestratorContent.findFirst({
      where: { id, kind: this.kind },
    })

    if (!item) {
      res.status(404).json({ error: `${this.label} not found` })
      return
    }

    res.json(item)
  }

  async create(req: Request, res: Response): Promise<void> {
    const { step, name, content, order, isActive } = req.body

    if (step === undefined || !name || content === undefined) {
      res.status(400).json({ error: 'step, name, and content are required' })
      return
    }

    if (typeof step !== 'number' || step < 0 || step > 4) {
      res.status(400).json({ error: 'step must be 0-4' })
      return
    }

    try {
      const item = await prisma.orchestratorContent.create({
        data: {
          kind: this.kind,
          step,
          name,
          content,
          order: order ?? 0,
          isActive: isActive ?? true,
        },
      })
      res.status(201).json(item)
    } catch (error: unknown) {
      const prismaError = error as { code?: string }
      if (prismaError.code === 'P2002') {
        res.status(409).json({
          error: `${this.label} "${name}" already exists for step ${step}`,
        })
        return
      }
      throw error
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    const { step, name, content, order, isActive } = req.body

    if (step !== undefined && (typeof step !== 'number' || step < 0 || step > 4)) {
      res.status(400).json({ error: 'step must be 0-4' })
      return
    }

    try {
      const item = await prisma.orchestratorContent.update({
        where: { id },
        data: {
          ...(step !== undefined && { step }),
          ...(name !== undefined && { name }),
          ...(content !== undefined && { content }),
          ...(order !== undefined && { order }),
          ...(isActive !== undefined && { isActive }),
        },
      })
      res.json(item)
    } catch (error: unknown) {
      const prismaError = error as { code?: string }
      if (prismaError.code === 'P2025') {
        res.status(404).json({ error: `${this.label} not found` })
        return
      }
      if (prismaError.code === 'P2002') {
        res.status(409).json({ error: `${this.label} "${name}" already exists for that step` })
        return
      }
      throw error
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params

    try {
      await prisma.orchestratorContent.delete({ where: { id } })
      res.json({ deleted: true })
    } catch (error: unknown) {
      const prismaError = error as { code?: string }
      if (prismaError.code === 'P2025') {
        res.status(404).json({ error: `${this.label} not found` })
        return
      }
      throw error
    }
  }

  async reorder(req: Request, res: Response): Promise<void> {
    const { items } = req.body

    if (!Array.isArray(items)) {
      res.status(400).json({ error: 'items array required: [{ id, order }]' })
      return
    }

    await prisma.$transaction(
      items.map((item: { id: string; order: number }) =>
        prisma.orchestratorContent.update({
          where: { id: item.id },
          data: { order: item.order },
        })
      )
    )

    res.json({ reordered: items.length })
  }
}
