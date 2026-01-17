import { describe, it, expect, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { ElicitationSessionRepository } from '../src/repositories/ElicitationSessionRepository.js'
import { SessionStatus } from '../src/elicitor/types/elicitor.types.js'

describe('ElicitationSessionRepository', () => {
  const prisma = new PrismaClient()
  const repository = new ElicitationSessionRepository(prisma)

  afterAll(async () => {
    await prisma.$disconnect()
  })

  const createAgent = async () => {
    return prisma.lLMAgent.create({
      data: {
        name: 'Session Agent',
        slug: 'session-agent',
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
  }

  it('creates and finds by outputId', async () => {
    const agent = await createAgent()
    const session = await repository.create({
      outputId: '20260101-session',
      agentId: agent.id,
      initialPrompt: 'Build a button',
      detectedType: 'UI_COMPONENT',
    })

    const found = await repository.findByOutputId(session.outputId)
    expect(found?.id).toBe(session.id)
    expect(found?.agent?.id).toBe(agent.id)
  })

  it('adds message and increments tokens', async () => {
    const agent = await createAgent()
    const session = await repository.create({
      outputId: '20260101-msg',
      agentId: agent.id,
      initialPrompt: 'Build a button',
      detectedType: 'UI_COMPONENT',
    })

    await repository.addMessage(session.id, {
      role: 'user',
      content: 'hello',
      round: 1,
      tokensIn: 10,
      tokensOut: 5,
    })

    const updated = await repository.findById(session.id)
    expect(updated?.totalTokensIn).toBe(10)
    expect(updated?.totalTokensOut).toBe(5)
    expect(updated?.currentRound).toBe(1)
  })

  it('completes session with status COMPLETED', async () => {
    const agent = await createAgent()
    const session = await repository.create({
      outputId: '20260101-complete',
      agentId: agent.id,
      initialPrompt: 'Build a button',
      detectedType: 'UI_COMPONENT',
    })

    const completed = await repository.complete(session.id, {
      completenessScore: 90,
      taskPrompt: 'Task prompt',
      planJson: '{"ok":true}',
      totalDurationMs: 1000,
    })

    expect(completed.status).toBe(SessionStatus.COMPLETED)
    expect(completed.completedAt).toBeTruthy()
  })
})
