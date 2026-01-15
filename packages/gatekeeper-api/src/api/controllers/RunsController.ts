import type { Request, Response } from 'express'
import { prisma } from '../../db/client.js'

export class RunsController {
  async getRun(req: Request, res: Response): Promise<void> {
    const { id } = req.params

    const run = await prisma.validationRun.findUnique({
      where: { id },
    })

    if (!run) {
      res.status(404).json({ error: 'Run not found' })
      return
    }

    res.json(run)
  }

  async listRuns(req: Request, res: Response): Promise<void> {
    const { page = 1, limit = 20, status } = req.query
    const skip = (Number(page) - 1) * Number(limit)

    const where = status ? { status: String(status) } : undefined

    const [runs, total] = await Promise.all([
      prisma.validationRun.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.validationRun.count({ where }),
    ])

    res.json({
      data: runs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    })
  }

  async getRunResults(req: Request, res: Response): Promise<void> {
    const { id } = req.params

    const run = await prisma.validationRun.findUnique({
      where: { id },
      include: {
        gateResults: {
          orderBy: { gateNumber: 'asc' },
        },
        validatorResults: {
          orderBy: [{ gateNumber: 'asc' }, { validatorOrder: 'asc' }],
        },
      },
    })

    if (!run) {
      res.status(404).json({ error: 'Run not found' })
      return
    }

    res.json(run)
  }

  async abortRun(req: Request, res: Response): Promise<void> {
    const { id } = req.params

    const run = await prisma.validationRun.findUnique({
      where: { id },
    })

    if (!run) {
      res.status(404).json({ error: 'Run not found' })
      return
    }

    if (run.status !== 'PENDING' && run.status !== 'RUNNING') {
      res.status(400).json({
        error: 'Cannot abort run',
        message: `Run is already ${run.status}`,
      })
      return
    }

    const updated = await prisma.validationRun.update({
      where: { id },
      data: {
        status: 'ABORTED',
        completedAt: new Date(),
      },
    })

    res.json(updated)
  }

  async deleteRun(req: Request, res: Response): Promise<void> {
    const { id } = req.params

    await prisma.validationRun.delete({
      where: { id },
    })

    res.status(204).send()
  }
}
