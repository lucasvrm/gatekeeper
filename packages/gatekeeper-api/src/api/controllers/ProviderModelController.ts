import type { Request, Response } from 'express'
import { prisma } from '../../db/client.js'
import type { CreateProviderModelInput, UpdateProviderModelInput, DiscoverModelsInput } from '../schemas/agent.schema.js'

export class ProviderModelController {
  /**
   * GET /agent/models?provider=X — List models (optional filter by provider)
   */
  async list(req: Request, res: Response): Promise<void> {
    const { provider } = req.query
    const where = provider ? { provider: String(provider) } : {}

    const models = await prisma.providerModel.findMany({
      where,
      orderBy: [{ provider: 'asc' }, { modelId: 'asc' }],
    })

    res.json(models)
  }

  /**
   * POST /agent/models — Create a new model entry
   */
  async create(req: Request, res: Response): Promise<void> {
    const data = req.body as CreateProviderModelInput

    const existing = await prisma.providerModel.findUnique({
      where: { provider_modelId: { provider: data.provider, modelId: data.modelId } },
    })

    if (existing) {
      res.status(409).json({ error: `Model ${data.modelId} already exists for provider ${data.provider}` })
      return
    }

    const model = await prisma.providerModel.create({ data })
    res.status(201).json(model)
  }

  /**
   * PUT /agent/models/:id — Update label/isActive
   */
  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    const data = req.body as UpdateProviderModelInput

    try {
      const model = await prisma.providerModel.update({
        where: { id },
        data,
      })
      res.json(model)
    } catch {
      res.status(404).json({ error: `Model ${id} not found` })
    }
  }

  /**
   * DELETE /agent/models/:id — Remove a model entry
   */
  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params

    try {
      await prisma.providerModel.delete({ where: { id } })
      res.status(204).end()
    } catch {
      res.status(404).json({ error: `Model ${id} not found` })
    }
  }

  /**
   * POST /agent/models/discover — Proxy to provider API to list available models
   */
  async discover(req: Request, res: Response): Promise<void> {
    const { provider } = req.body as DiscoverModelsInput

    let url: string
    let headers: Record<string, string>
    let curlMasked: string

    switch (provider) {
      case 'openai': {
        const key = process.env.OPENAI_API_KEY
        if (!key) {
          res.status(400).json({ error: 'OPENAI_API_KEY not configured', curl: '', status: 0, data: null })
          return
        }
        url = 'https://api.openai.com/v1/models'
        headers = { Authorization: `Bearer ${key}` }
        curlMasked = `curl -s ${url} -H "Authorization: Bearer sk-...${key.slice(-4)}"`
        break
      }
      case 'anthropic': {
        const key = process.env.ANTHROPIC_API_KEY
        if (!key) {
          res.status(400).json({ error: 'ANTHROPIC_API_KEY not configured', curl: '', status: 0, data: null })
          return
        }
        url = 'https://api.anthropic.com/v1/models'
        headers = {
          'X-Api-Key': key,
          'anthropic-version': '2023-06-01',
        }
        curlMasked = `curl -s ${url} -H "X-Api-Key: sk-...${key.slice(-4)}" -H "anthropic-version: 2023-06-01"`
        break
      }
      case 'mistral': {
        const key = process.env.MISTRAL_API_KEY
        if (!key) {
          res.status(400).json({ error: 'MISTRAL_API_KEY not configured', curl: '', status: 0, data: null })
          return
        }
        url = 'https://api.mistral.ai/v1/models'
        headers = { Authorization: `Bearer ${key}` }
        curlMasked = `curl -s ${url} -H "Authorization: Bearer ...${key.slice(-4)}"`
        break
      }
      default:
        res.status(400).json({ error: `Unsupported provider for discovery: ${provider}` })
        return
    }

    try {
      const response = await fetch(url, { headers })
      const data = await response.json()

      res.json({
        curl: curlMasked,
        status: response.status,
        data,
      })
    } catch (err) {
      res.json({
        curl: curlMasked!,
        status: 0,
        data: null,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
}
