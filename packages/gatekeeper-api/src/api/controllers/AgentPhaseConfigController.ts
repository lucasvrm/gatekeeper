import type { Request, Response } from 'express'
import { prisma } from '../../db/client.js'
import type { CreatePhaseConfigInput, UpdatePhaseConfigInput } from '../schemas/agent.schema.js'

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

    const existing = await prisma.agentPhaseConfig.findUnique({
      where: { step: data.step },
    })

    if (existing) {
      res.status(409).json({
        error: `Phase config para step ${data.step} já existe. Use PUT para atualizar.`,
      })
      return
    }

    const config = await prisma.agentPhaseConfig.create({ data })
    res.status(201).json(config)
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

  /**
   * GET /agent/providers — List available providers (from env)
   */
  async listProviders(_req: Request, res: Response): Promise<void> {
    const providers = [
      {
        name: 'anthropic',
        configured: !!process.env.ANTHROPIC_API_KEY,
        models: [
          'claude-sonnet-4-5-20250929',
          'claude-haiku-4-5-20251001',
          'claude-opus-4-5-20251101',
        ],
      },
      {
        name: 'openai',
        configured: !!process.env.OPENAI_API_KEY,
        models: [
          'gpt-4.1',
          'gpt-4.1-mini',
          'gpt-4.1-nano',
          'o3-mini',
        ],
      },
      {
        name: 'mistral',
        configured: !!process.env.MISTRAL_API_KEY,
        models: [
          'mistral-large-latest',
          'mistral-medium-latest',
          'codestral-latest',
        ],
      },
      {
        name: 'claude-code',
        configured: process.env.CLAUDE_CODE_ENABLED === 'true',
        models: [
          'sonnet',
          'opus',
          'haiku',
        ],
        note: 'Uses Claude Code CLI (Max/Pro subscription). No API key required.',
      },
    ]

    res.json(providers)
  }
}
