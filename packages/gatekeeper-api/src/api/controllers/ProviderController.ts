import type { Request, Response } from 'express'
import { prisma } from '../../db/client.js'
import type { CreateProviderInput, UpdateProviderInput } from '../schemas/agent.schema.js'

export class ProviderController {
  /**
   * GET /agent/providers — List active providers enriched with runtime `configured` status and models
   */
  async list(_req: Request, res: Response): Promise<void> {
    const [dbProviders, dbModels] = await Promise.all([
      prisma.provider.findMany({
        where: { isActive: true },
        orderBy: { order: 'asc' },
      }),
      prisma.providerModel.findMany({
        where: { isActive: true },
        orderBy: [{ provider: 'asc' }, { modelId: 'asc' }],
      }),
    ])

    const modelsByProvider: Record<string, string[]> = {}
    for (const m of dbModels) {
      if (!modelsByProvider[m.provider]) modelsByProvider[m.provider] = []
      modelsByProvider[m.provider].push(m.modelId)
    }

    const providers = dbProviders.map(p => ({
      id: p.id,
      name: p.name,
      label: p.label,
      authType: p.authType,
      envVarName: p.envVarName,
      isActive: p.isActive,
      order: p.order,
      note: p.note,
      configured: p.envVarName
        ? (p.authType === 'cli'
            ? process.env[p.envVarName] === 'true'
            : !!process.env[p.envVarName])
        : false,
      models: modelsByProvider[p.name] ?? [],
    }))

    res.json(providers)
  }

  /**
   * GET /agent/providers/all — List ALL providers (including inactive) for admin UI
   */
  async listAll(_req: Request, res: Response): Promise<void> {
    const providers = await prisma.provider.findMany({
      orderBy: { order: 'asc' },
    })
    res.json(providers)
  }

  /**
   * POST /agent/providers — Create a new provider
   */
  async create(req: Request, res: Response): Promise<void> {
    const data = req.body as CreateProviderInput

    const existing = await prisma.provider.findUnique({ where: { name: data.name } })
    if (existing) {
      res.status(409).json({ error: `Provider "${data.name}" already exists` })
      return
    }

    const provider = await prisma.provider.create({ data })
    res.status(201).json(provider)
  }

  /**
   * PUT /agent/providers/:id — Update a provider
   */
  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    const data = req.body as UpdateProviderInput

    try {
      const provider = await prisma.provider.update({ where: { id }, data })
      res.json(provider)
    } catch {
      res.status(404).json({ error: `Provider ${id} not found` })
    }
  }

  /**
   * DELETE /agent/providers/:id — Delete a provider
   */
  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params

    try {
      await prisma.provider.delete({ where: { id } })
      res.status(204).end()
    } catch {
      res.status(404).json({ error: `Provider ${id} not found` })
    }
  }
}
