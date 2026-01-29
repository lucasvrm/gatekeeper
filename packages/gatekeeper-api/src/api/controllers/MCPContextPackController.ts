import type { Request, Response } from 'express'
import { prisma } from '../../db/client.js'

export class MCPContextPackController {
  async list(req: Request, res: Response): Promise<void> {
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 20
    const skip = (page - 1) * limit

    const [packs, total] = await Promise.all([
      prisma.contextPack.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.contextPack.count(),
    ])

    res.json({
      data: packs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  }

  async get(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    const pack = await prisma.contextPack.findUnique({ where: { id } })

    if (!pack) {
      res.status(404).json({ error: 'Context pack not found' })
      return
    }

    res.json(pack)
  }

  async create(req: Request, res: Response): Promise<void> {
    const { name, description, files } = req.body

    const pack = await prisma.contextPack.create({
      data: {
        name: String(name),
        description: description ? String(description) : null,
        files: JSON.stringify(files || []),
      },
    })

    res.status(201).json(pack)
  }

  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    const { name, description, files } = req.body

    const existing = await prisma.contextPack.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Context pack not found' })
      return
    }

    const updated = await prisma.contextPack.update({
      where: { id },
      data: {
        ...(name && { name: String(name) }),
        ...(description !== undefined && { description: description ? String(description) : null }),
        ...(files && { files: JSON.stringify(files) }),
      },
    })

    res.json(updated)
  }

  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params

    const existing = await prisma.contextPack.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Context pack not found' })
      return
    }

    await prisma.contextPack.delete({ where: { id } })
    res.status(204).send()
  }
}
