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

  async rerunGate(req: Request, res: Response): Promise<void> {
    const { id, gateNumber } = req.params
    const gate = parseInt(gateNumber)

    const run = await prisma.validationRun.findUnique({
      where: { id },
    })

    if (!run) {
      res.status(404).json({ error: 'Run not found' })
      return
    }

    if (run.status === 'PENDING' || run.status === 'RUNNING') {
      res.status(400).json({
        error: 'Cannot rerun gate',
        message: 'Run is currently in progress',
      })
      return
    }

    // Validate gate number is valid for run type
    const validGates = run.runType === 'EXECUTION' ? [2, 3] : [0, 1]
    if (!validGates.includes(gate)) {
      res.status(400).json({
        error: 'Invalid gate number',
        message: `Gate ${gate} is not valid for ${run.runType} runs`,
      })
      return
    }

    // For simplicity, we'll rerun the entire run
    // Delete all gate and validator results
    await prisma.validatorResult.deleteMany({
      where: { runId: id },
    })

    await prisma.gateResult.deleteMany({
      where: { runId: id },
    })

    // Reset run to initial state
    const firstGate = run.runType === 'EXECUTION' ? 2 : 0
    await prisma.validationRun.update({
      where: { id },
      data: {
        status: 'PENDING',
        currentGate: firstGate,
        passed: false,
        failedAt: null,
        failedValidatorCode: null,
        startedAt: null,
        completedAt: null,
      },
    })

    // Import and queue the run for execution
    const { ValidationOrchestrator } = await import('../../services/ValidationOrchestrator.js')
    const orchestrator = new ValidationOrchestrator()
    orchestrator.addToQueue(id).catch((error) => {
      console.error(`Error re-executing run ${id}:`, error)
    })

    res.json({ message: 'Run queued for re-execution', runId: id })
  }
}
