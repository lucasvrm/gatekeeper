import { describe, it, expect, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { LLMAdapterManager } from '../src/elicitor/adapters/LLMAdapterManager.js'

describe('LLMAdapterManager', () => {
  const prisma = new PrismaClient()
  const manager = new LLMAdapterManager(prisma)

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('caches adapters and invalidates', async () => {
    const agent = await prisma.lLMAgent.create({
      data: {
        name: 'GPT Test',
        slug: 'gpt-test',
        provider: 'openai',
        model: 'gpt-4-turbo',
        apiKey: 'test-key',
        temperature: 0.7,
        maxTokens: 256,
        isActive: true,
        isDefault: false,
        sortOrder: 0,
      },
    })

    const first = await manager.getAdapter(agent.id)
    const second = await manager.getAdapter(agent.id)

    expect(first).toBe(second)

    manager.invalidate(agent.id)
    const third = await manager.getAdapter(agent.id)

    expect(third).not.toBe(first)
  })
})
