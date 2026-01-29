import type { Request, Response } from 'express'
import { prisma } from '../../db/client.js'

export class MCPSessionPresetController {
  async list(req: Request, res: Response): Promise<void> {
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 20
    const skip = (page - 1) * limit

    const [presets, total] = await Promise.all([
      prisma.sessionPreset.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.sessionPreset.count(),
    ])

    res.json({
      data: presets,
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
    const preset = await prisma.sessionPreset.findUnique({ where: { id } })

    if (!preset) {
      res.status(404).json({ error: 'Preset not found' })
      return
    }

    res.json(preset)
  }

  async create(req: Request, res: Response): Promise<void> {
    const { name, config } = req.body

    const preset = await prisma.sessionPreset.create({
      data: {
        name: String(name),
        config: typeof config === 'string' ? config : JSON.stringify(config),
      },
    })

    res.status(201).json(preset)
  }

  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    const { name, config } = req.body

    const existing = await prisma.sessionPreset.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Preset not found' })
      return
    }

    const updated = await prisma.sessionPreset.update({
      where: { id },
      data: {
        ...(name && { name: String(name) }),
        ...(config && { config: typeof config === 'string' ? config : JSON.stringify(config) }),
      },
    })

    res.json(updated)
  }

  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params

    const existing = await prisma.sessionPreset.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Preset not found' })
      return
    }

    await prisma.sessionPreset.delete({ where: { id } })
    res.status(204).send()
  }
}
