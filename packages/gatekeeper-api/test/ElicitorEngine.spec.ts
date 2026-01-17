import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { ElicitorEngine } from '../src/elicitor/ElicitorEngine.js'
import { LLMAdapterManager } from '../src/elicitor/adapters/LLMAdapterManager.js'
import type { ILLMAdapter, ModelInfo } from '../src/elicitor/adapters/ILLMAdapter.js'
import type { ChatMessage, LLMAgentConfig } from '../src/elicitor/types/elicitor.types.js'
import type { ElicitationState } from '../src/elicitor/types/elicitor.types.js'

describe('ElicitorEngine', () => {
  const prisma = new PrismaClient()
  let getAdapterSpy: ReturnType<typeof vi.spyOn>

  class FakeAdapter implements ILLMAdapter {
    readonly provider = 'test'
    private initialized = false

    async initialize(_config: LLMAgentConfig): Promise<void> {
      this.initialized = true
    }

    isReady(): boolean {
      return this.initialized
    }

    async chat(messages: ChatMessage[]): Promise<{ content: string; tokensIn: number; tokensOut: number; durationMs: number; finishReason: string }> {
      const content = messages[messages.length - 1]?.content ?? ''

      if (content.includes('Classifique a tarefa')) {
        return { content: 'UI_COMPONENT', tokensIn: 0, tokensOut: 0, durationMs: 0, finishReason: 'stop' }
      }

      if (content.includes('Voce e o Elicitor.')) {
        return {
          content: JSON.stringify({ id: 'name', text: 'Qual o nome?', type: 'text', allowDefault: true }),
          tokensIn: 0,
          tokensOut: 0,
          durationMs: 0,
          finishReason: 'stop',
        }
      }

      if (content.includes('Atualize o estado do contrato')) {
        return {
          content: JSON.stringify({ name: 'PrimaryButton', behaviors: [{ trigger: 'click', action: 'submit' }] }),
          tokensIn: 0,
          tokensOut: 0,
          durationMs: 0,
          finishReason: 'stop',
        }
      }

      return { content: 'UI_COMPONENT', tokensIn: 0, tokensOut: 0, durationMs: 0, finishReason: 'stop' }
    }

    async validateApiKey(): Promise<boolean> {
      return true
    }

    getModelInfo(): ModelInfo {
      return {
        provider: this.provider,
        model: 'fake',
        maxTokens: 2048,
        contextWindow: 2048,
        supportsStreaming: false,
        supportsTools: false,
      }
    }
  }

  const createAgent = async () => {
    return prisma.lLMAgent.create({
      data: {
        name: 'Elicitor Agent',
        slug: 'elicitor-agent',
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

  beforeEach(() => {
    const adapter = new FakeAdapter()
    getAdapterSpy = vi.spyOn(LLMAdapterManager.prototype, 'getAdapter').mockResolvedValue(adapter)
  })

  afterEach(() => {
    getAdapterSpy.mockRestore()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('start creates a session', async () => {
    const agent = await createAgent()
    const engine = new ElicitorEngine(prisma)

    const result = await engine.start(agent.id, 'Build a button')

    expect(result.detectedType).toBe('UI_COMPONENT')
    const session = await prisma.elicitationSession.findUnique({ where: { outputId: result.outputId } })
    expect(session).toBeTruthy()
  })

  it('getNextQuestion returns manifest files request first', async () => {
    const agent = await createAgent()
    const engine = new ElicitorEngine(prisma)
    await engine.start(agent.id, 'Build a button')

    const question = await engine.getNextQuestion()
    expect(question?.id).toBe('manifestFiles')
    expect(question?.type).toBe('text')
  })

  it('processAnswer updates manifestFiles', async () => {
    const agent = await createAgent()
    const engine = new ElicitorEngine(prisma)
    await engine.start(agent.id, 'Build a button')

    const question = await engine.getNextQuestion()
    expect(question?.id).toBe('manifestFiles')

    await engine.processAnswer(JSON.stringify([{ path: 'src/components/Button.tsx', action: 'CREATE' }]))

    const state = (engine as unknown as { contractState: ElicitationState }).contractState
    expect(state?.manifestFiles?.length).toBe(1)
  })

  it('processAnswer updates state from LLM', async () => {
    const agent = await createAgent()
    const engine = new ElicitorEngine(prisma)
    await engine.start(agent.id, 'Build a button')

    await engine.getNextQuestion()
    await engine.processAnswer(JSON.stringify([{ path: 'src/components/Button.tsx', action: 'CREATE' }]))

    const question = await engine.getNextQuestion()
    expect(question?.id).toBe('name')

    await engine.processAnswer('PrimaryButton')

    const state = (engine as unknown as { contractState: ElicitationState }).contractState
    expect(state?.name).toBe('PrimaryButton')
  })

  it('getCompleteness returns a score', async () => {
    const agent = await createAgent()
    const engine = new ElicitorEngine(prisma)
    await engine.start(agent.id, 'Build a button')

    await engine.getNextQuestion()
    await engine.processAnswer(JSON.stringify([{ path: 'src/components/Button.tsx', action: 'CREATE' }]))

    const result = engine.getCompleteness()
    expect(result.completenessScore).toBeGreaterThanOrEqual(0)
  })

  it('resume restores session state', async () => {
    const agent = await createAgent()
    const engine = new ElicitorEngine(prisma)
    const started = await engine.start(agent.id, 'Build a button')

    await engine.getNextQuestion()
    await engine.processAnswer(JSON.stringify([{ path: 'src/components/Button.tsx', action: 'CREATE' }]))

    const resumedEngine = new ElicitorEngine(prisma)
    const resumed = await resumedEngine.resume(started.outputId)

    expect(resumed.outputId).toBe(started.outputId)
    expect(resumed.detectedType).toBe('UI_COMPONENT')
    expect(resumed.currentRound).toBeGreaterThanOrEqual(1)
  })
})
