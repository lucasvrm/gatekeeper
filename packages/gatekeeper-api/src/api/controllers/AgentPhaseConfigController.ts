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
   * GET /agent/providers — List available providers (from DB + env)
   */
  async listProviders(_req: Request, res: Response): Promise<void> {
    const dbModels = await prisma.providerModel.findMany({
      where: { isActive: true },
      orderBy: [{ provider: 'asc' }, { modelId: 'asc' }],
    })

    // Group models by provider
    const modelsByProvider: Record<string, string[]> = {}
    for (const m of dbModels) {
      if (!modelsByProvider[m.provider]) modelsByProvider[m.provider] = []
      modelsByProvider[m.provider].push(m.modelId)
    }

    const configuredMap: Record<string, boolean> = {
      'anthropic': !!process.env.ANTHROPIC_API_KEY,
      'openai': !!process.env.OPENAI_API_KEY,
      'mistral': !!process.env.MISTRAL_API_KEY,
      'claude-code': process.env.CLAUDE_CODE_ENABLED === 'true',
      'codex-cli': process.env.CODEX_CLI_ENABLED === 'true',
    }

    const providerNames = [...new Set([...Object.keys(modelsByProvider), ...Object.keys(configuredMap)])]

    const providers = providerNames.map(name => ({
      name,
      configured: configuredMap[name] ?? false,
      models: modelsByProvider[name] ?? [],
      ...(name === 'claude-code' ? { note: 'Uses Claude Code CLI (Max/Pro subscription). No API key required.' } : {}),
      ...(name === 'codex-cli' ? { note: 'Uses OpenAI Codex CLI. Requires OPENAI_API_KEY and npm i -g @openai/codex.' } : {}),
    }))

    res.json(providers)
  }
}
