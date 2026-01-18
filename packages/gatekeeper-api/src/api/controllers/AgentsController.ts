import type { Request, Response } from 'express'
import { prisma } from '../../db/client.js'
import { LLMAgentRepository } from '../../repositories/LLMAgentRepository.js'
import { LLMAdapterManager } from '../../elicitor/adapters/LLMAdapterManager.js'
import { LLMProvider } from '../../elicitor/types/elicitor.types.js'

const repository = new LLMAgentRepository(prisma)
const adapterManager = new LLMAdapterManager(prisma)

const providerValues = new Set<string>(Object.values(LLMProvider))

const getErrorCode = (error: unknown): string | null => {
  if (!error || typeof error !== 'object') {
    return null
  }

  const code = (error as { code?: unknown }).code
  return typeof code === 'string' ? code : null
}

const slugify = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (!Number.isNaN(parsed)) {
      return parsed
    }
  }
  return null
}

export class AgentsController {
  async list(req: Request, res: Response): Promise<void> {
    const agents = await repository.findAll()
    res.json(agents)
  }

  async get(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    const agent = await repository.findById(id)

    if (!agent) {
      res.status(404).json({ message: 'Agent not found' })
      return
    }

    res.json(agent)
  }

  async create(req: Request, res: Response): Promise<void> {
    const {
      name, provider, model, apiKeyEnvVar, baseUrl, temperature, maxTokens, isDefault,
      projectPath, generatePlanJson, generateLog, generateTaskPrompt, generateSpecFile
    } = req.body

    if (!name || typeof name !== 'string' || name.trim().length < 3) {
      res.status(400).json({ message: 'Name is required (min 3 chars)' })
      return
    }

    const normalizedProvider = typeof provider === 'string' ? provider.toLowerCase() : ''
    if (!providerValues.has(normalizedProvider)) {
      res.status(400).json({ message: 'Invalid provider' })
      return
    }

    if (!model || typeof model !== 'string' || model.trim() === '') {
      res.status(400).json({ message: 'Model is required' })
      return
    }

    const tempValue = toNumber(temperature)
    const maxTokensValue = toNumber(maxTokens)
    if (tempValue === null || tempValue < 0 || tempValue > 1) {
      res.status(400).json({ message: 'Temperature must be between 0 and 1' })
      return
    }
    if (maxTokensValue === null || maxTokensValue <= 0) {
      res.status(400).json({ message: 'Max tokens must be a positive number' })
      return
    }

    const slug = slugify(name)

    try {
      const created = await repository.create({
        name: name.trim(),
        slug,
        provider: normalizedProvider,
        model: model.trim(),
        apiKey: null,
        apiKeyEnvVar: typeof apiKeyEnvVar === 'string' && apiKeyEnvVar.trim() ? apiKeyEnvVar.trim() : null,
        baseUrl: typeof baseUrl === 'string' && baseUrl.trim() ? baseUrl.trim() : null,
        temperature: tempValue,
        maxTokens: Math.floor(maxTokensValue),
        isActive: true,
        isDefault: Boolean(isDefault),
        sortOrder: 0,
        systemPromptId: null,
        projectPath: typeof projectPath === 'string' && projectPath.trim() ? projectPath.trim() : '.',
        generatePlanJson: typeof generatePlanJson === 'boolean' ? generatePlanJson : true,
        generateLog: typeof generateLog === 'boolean' ? generateLog : true,
        generateTaskPrompt: typeof generateTaskPrompt === 'boolean' ? generateTaskPrompt : true,
        generateSpecFile: typeof generateSpecFile === 'boolean' ? generateSpecFile : true,
        defaultContractMode: 'STRICT', // T172: Default contract mode
      })

      if (created.isDefault) {
        await repository.setDefault(created.id)
      }

      const agent = await repository.findById(created.id)
      res.status(201).json(agent ?? created)
    } catch (error: unknown) {
      if (getErrorCode(error) === 'P2002') {
        res.status(400).json({ message: 'Agent name or slug already exists' })
        return
      }
      throw error
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    const {
      name, provider, model, apiKeyEnvVar, baseUrl, temperature, maxTokens, isActive, isDefault,
      projectPath, generatePlanJson, generateLog, generateTaskPrompt, generateSpecFile
    } = req.body

    const existing = await repository.findById(id)
    if (!existing) {
      res.status(404).json({ message: 'Agent not found' })
      return
    }

    const data: Partial<typeof existing> = {}

    if (typeof name === 'string' && name.trim()) {
      data.name = name.trim()
      data.slug = slugify(name)
    }

    if (typeof provider === 'string') {
      const normalizedProvider = provider.toLowerCase()
      if (!providerValues.has(normalizedProvider)) {
        res.status(400).json({ message: 'Invalid provider' })
        return
      }
      data.provider = normalizedProvider
    }

    if (typeof model === 'string' && model.trim()) {
      data.model = model.trim()
    }

    if (typeof apiKeyEnvVar === 'string') {
      data.apiKeyEnvVar = apiKeyEnvVar.trim() ? apiKeyEnvVar.trim() : null
    }

    if (typeof baseUrl === 'string') {
      data.baseUrl = baseUrl.trim() ? baseUrl.trim() : null
    }

    const tempValue = toNumber(temperature)
    if (tempValue !== null) {
      if (tempValue < 0 || tempValue > 1) {
        res.status(400).json({ message: 'Temperature must be between 0 and 1' })
        return
      }
      data.temperature = tempValue
    }

    const maxTokensValue = toNumber(maxTokens)
    if (maxTokensValue !== null) {
      if (maxTokensValue <= 0) {
        res.status(400).json({ message: 'Max tokens must be a positive number' })
        return
      }
      data.maxTokens = Math.floor(maxTokensValue)
    }

    if (typeof isActive === 'boolean') {
      data.isActive = isActive
    }

    if (typeof isDefault === 'boolean') {
      data.isDefault = isDefault
    }

    if (typeof projectPath === 'string') {
      data.projectPath = projectPath.trim() || '.'
    }

    if (typeof generatePlanJson === 'boolean') {
      data.generatePlanJson = generatePlanJson
    }

    if (typeof generateLog === 'boolean') {
      data.generateLog = generateLog
    }

    if (typeof generateTaskPrompt === 'boolean') {
      data.generateTaskPrompt = generateTaskPrompt
    }

    if (typeof generateSpecFile === 'boolean') {
      data.generateSpecFile = generateSpecFile
    }

    try {
      const updated = await repository.update(id, data)

      if (updated.isDefault) {
        await repository.setDefault(updated.id)
      }

      adapterManager.invalidate(updated.id)
      const agent = await repository.findById(updated.id)
      res.json(agent ?? updated)
    } catch (error: unknown) {
      if (getErrorCode(error) === 'P2002') {
        res.status(409).json({ message: 'Agent name or slug already exists' })
        return
      }
      throw error
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    const existing = await repository.findById(id)
    if (!existing) {
      res.status(404).json({ message: 'Agent not found' })
      return
    }

    try {
      await repository.delete(id)
      adapterManager.invalidate(id)
      res.status(204).send()
    } catch (error: unknown) {
      console.error('Error deleting agent:', error)
      res.status(500).json({
        message: 'Failed to delete agent',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  async setDefault(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    const existing = await repository.findById(id)
    if (!existing) {
      res.status(404).json({ message: 'Agent not found' })
      return
    }

    await repository.setDefault(id)
    adapterManager.invalidate(id)
    const agent = await repository.findById(id)
    res.json(agent)
  }

  async test(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    const existing = await repository.findById(id)
    if (!existing) {
      res.status(404).json({ message: 'Agent not found' })
      return
    }

    const start = Date.now()
    const ok = await adapterManager.validateAgent(id)
    const latencyMs = Date.now() - start

    res.json({ ok, latencyMs })
  }
}
