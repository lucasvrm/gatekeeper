import { describe, it, expect, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { LLMAgentRepository } from '../src/repositories/LLMAgentRepository.js'

describe('LLMAgentRepository', () => {
  const prisma = new PrismaClient()
  const repository = new LLMAgentRepository(prisma)

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('creates and finds agents', async () => {
    const first = await repository.create({
      name: 'Agent One',
      slug: 'agent-one',
      provider: 'openai',
      model: 'gpt-4-turbo',
      apiKey: null,
      apiKeyEnvVar: null,
      baseUrl: null,
      temperature: 0.7,
      maxTokens: 512,
      systemPromptId: null,
      isActive: true,
      isDefault: false,
      sortOrder: 1,
    })

    const second = await repository.create({
      name: 'Agent Two',
      slug: 'agent-two',
      provider: 'openai',
      model: 'gpt-4-turbo',
      apiKey: null,
      apiKeyEnvVar: null,
      baseUrl: null,
      temperature: 0.7,
      maxTokens: 512,
      systemPromptId: null,
      isActive: false,
      isDefault: false,
      sortOrder: 2,
    })

    const all = await repository.findAll()
    expect(all.length).toBe(2)
    expect(all[0].id).toBe(first.id)

    const active = await repository.findActive()
    expect(active.length).toBe(1)
    expect(active[0].id).toBe(first.id)

    const byId = await repository.findById(first.id)
    expect(byId?.id).toBe(first.id)

    const bySlug = await repository.findBySlug(second.slug)
    expect(bySlug?.id).toBe(second.id)
  })

  it('updates and deletes agent', async () => {
    const agent = await repository.create({
      name: 'Agent Update',
      slug: 'agent-update',
      provider: 'openai',
      model: 'gpt-4-turbo',
      apiKey: null,
      apiKeyEnvVar: null,
      baseUrl: null,
      temperature: 0.7,
      maxTokens: 512,
      systemPromptId: null,
      isActive: true,
      isDefault: false,
      sortOrder: 1,
    })

    const updated = await repository.update(agent.id, { model: 'gpt-4o' })
    expect(updated.model).toBe('gpt-4o')

    await repository.delete(agent.id)
    const deleted = await repository.findById(agent.id)
    expect(deleted).toBeNull()
  })

  it('sets default agent using transaction', async () => {
    const one = await repository.create({
      name: 'Agent Default One',
      slug: 'agent-default-one',
      provider: 'openai',
      model: 'gpt-4-turbo',
      apiKey: null,
      apiKeyEnvVar: null,
      baseUrl: null,
      temperature: 0.7,
      maxTokens: 512,
      systemPromptId: null,
      isActive: true,
      isDefault: true,
      sortOrder: 1,
    })

    const two = await repository.create({
      name: 'Agent Default Two',
      slug: 'agent-default-two',
      provider: 'openai',
      model: 'gpt-4-turbo',
      apiKey: null,
      apiKeyEnvVar: null,
      baseUrl: null,
      temperature: 0.7,
      maxTokens: 512,
      systemPromptId: null,
      isActive: true,
      isDefault: false,
      sortOrder: 2,
    })

    await repository.setDefault(two.id)
    const defaultAgent = await repository.findDefault()
    expect(defaultAgent?.id).toBe(two.id)

    const all = await repository.findAll()
    const defaults = all.filter((agent) => agent.isDefault)
    expect(defaults.length).toBe(1)
    expect(defaults[0].id).toBe(two.id)

    await repository.update(one.id, { isDefault: false })
  })
})
