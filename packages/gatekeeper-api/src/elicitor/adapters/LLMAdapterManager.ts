import { PrismaClient } from '@prisma/client'

import { ILLMAdapter } from './ILLMAdapter.js'
import { LLMAdapterFactory } from './LLMAdapterFactory.js'
import { LLMAgentConfig, LLMProvider } from '../types/elicitor.types.js'
import { LLMAgentRepository } from '../../repositories/LLMAgentRepository.js'

export class LLMAdapterManager {
  private adapters: Map<string, ILLMAdapter> = new Map()
  private factory: LLMAdapterFactory
  private repository: LLMAgentRepository

  constructor(prisma: PrismaClient) {
    this.factory = LLMAdapterFactory.getInstance()
    this.repository = new LLMAgentRepository(prisma)
  }

  async getAdapter(agentId: string): Promise<ILLMAdapter> {
    const cached = this.adapters.get(agentId)
    if (cached) {
      return cached
    }

    const agent = await this.repository.findById(agentId)
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`)
    }

    if (!agent.isActive) {
      throw new Error(`Agent is not active: ${agent.name}`)
    }

    const config: LLMAgentConfig = {
      id: agent.id,
      name: agent.name,
      slug: agent.slug,
      provider: agent.provider as LLMProvider,
      model: agent.model,
      apiKey: agent.apiKey || undefined,
      apiKeyEnvVar: agent.apiKeyEnvVar || undefined,
      baseUrl: agent.baseUrl || undefined,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
    }

    const adapter = this.factory.create(config)
    await adapter.initialize(config)

    this.adapters.set(agentId, adapter)

    return adapter
  }

  async getDefaultAdapter(): Promise<ILLMAdapter> {
    const defaultAgent = await this.repository.findDefault()
    if (!defaultAgent) {
      throw new Error('No default agent configured')
    }
    return this.getAdapter(defaultAgent.id)
  }

  invalidate(agentId: string): void {
    this.adapters.delete(agentId)
  }

  invalidateAll(): void {
    this.adapters.clear()
  }

  async validateAgent(agentId: string): Promise<boolean> {
    const adapter = await this.getAdapter(agentId)
    return adapter.validateApiKey()
  }
}
