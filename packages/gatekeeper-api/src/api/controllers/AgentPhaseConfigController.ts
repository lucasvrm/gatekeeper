import type { Request, Response } from 'express'
import { prisma } from '../../db/client.js'
import type { CreatePhaseConfigInput, UpdatePhaseConfigInput } from '../schemas/agent.schema.js'
import { AgentPhaseConfigService } from '../../services/AgentPhaseConfigService.js'

export class AgentPhaseConfigController {
  /**
   * GET /agent/phases — List all phase configs
   */
  async list(_req: Request, res: Response): Promise<void> {
    const configs = await prisma.agentPhaseConfig.findMany({
      orderBy: { step: 'asc' },
    })
    res.json(configs)
  }

  /**
   * GET /agent/phases/:step — Get config for a specific step
   */
  async getByStep(req: Request, res: Response): Promise<void> {
    const step = parseInt(req.params.step, 10)

    if (isNaN(step)) {
      res.status(400).json({ error: 'step deve ser um número' })
      return
    }

    const config = await prisma.agentPhaseConfig.findUnique({
      where: { step },
    })

    if (!config) {
      res.status(404).json({ error: `Phase config para step ${step} não encontrado` })
      return
    }

    res.json(config)
  }

  /**
   * POST /agent/phases — Create a new phase config
   */
  async create(req: Request, res: Response): Promise<void> {
    const data = req.body as CreatePhaseConfigInput

    try {
      // Usar service para validação consistente
      const service = new AgentPhaseConfigService(prisma)
      await service.validateNoExisting(data.step)

      const config = await prisma.agentPhaseConfig.create({ data })
      res.status(201).json(config)
    } catch (err) {
      if (err instanceof Error && err.message.includes('já existe')) {
        res.status(409).json({ error: err.message })
        return
      }
      throw err
    }
  }

  /**
   * PUT /agent/phases/:step — Update an existing phase config
   */
  async update(req: Request, res: Response): Promise<void> {
    const step = parseInt(req.params.step, 10)
    const data = req.body as UpdatePhaseConfigInput

    if (isNaN(step)) {
      res.status(400).json({ error: 'step deve ser um número' })
      return
    }

    const existing = await prisma.agentPhaseConfig.findUnique({
      where: { step },
    })

    if (!existing) {
      res.status(404).json({ error: `Phase config para step ${step} não encontrado` })
      return
    }

    const config = await prisma.agentPhaseConfig.update({
      where: { step },
      data,
    })

    res.json(config)
  }

  /**
   * DELETE /agent/phases/:step — Delete a phase config
   */
  async delete(req: Request, res: Response): Promise<void> {
    const step = parseInt(req.params.step, 10)

    if (isNaN(step)) {
      res.status(400).json({ error: 'step deve ser um número' })
      return
    }

    try {
      await prisma.agentPhaseConfig.delete({ where: { step } })
      res.status(204).end()
    } catch {
      res.status(404).json({ error: `Phase config para step ${step} não encontrado` })
    }
  }

}
