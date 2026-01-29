import type { Request, Response } from 'express'
import { prisma } from '../../db/client.js'

export class MCPSessionHistoryController {
  async list(req: Request, res: Response): Promise<void> {
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 20
    const skip = (page - 1) * limit

    const [history, total] = await Promise.all([
      prisma.sessionHistory.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.sessionHistory.count(),
    ])

    res.json({
      data: history,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  }

  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params

    const existing = await prisma.sessionHistory.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'History entry not found' })
      return
    }

    await prisma.sessionHistory.delete({ where: { id } })
    res.status(204).send()
  }
}
