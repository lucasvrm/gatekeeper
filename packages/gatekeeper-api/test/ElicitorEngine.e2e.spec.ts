import { test, expect } from 'vitest'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { ElicitorEngine } from '../src/elicitor/ElicitorEngine.js'

const apiKey = process.env.OPENAI_API_KEY
const maybeTest = apiKey ? test : test.skip

maybeTest('ElicitorEngine e2e flow', async () => {
  const prisma = new PrismaClient()

  try {
    const agent = await prisma.lLMAgent.create({
      data: {
        name: 'E2E Agent',
        slug: 'e2e-agent',
        provider: 'openai',
        model: 'gpt-4-turbo',
        apiKey: apiKey as string,
        temperature: 0.2,
        maxTokens: 512,
        isActive: true,
        isDefault: true,
        sortOrder: 0,
      },
    })

    const engine = new ElicitorEngine(prisma)
    const started = await engine.start(agent.id, 'Create a simple UI button component.')

    const manifestQuestion = await engine.getNextQuestion()
    expect(manifestQuestion?.id).toBe('manifestFiles')

    await engine.processAnswer(JSON.stringify([
      { path: 'src/components/PrimaryButton.tsx', action: 'CREATE' },
      { path: 'src/components/PrimaryButton.spec.tsx', action: 'CREATE' },
    ]))

    for (let i = 0; i < 6; i++) {
      const question = await engine.getNextQuestion()
      if (!question) {
        break
      }

      const answer = question.allowDefault ? '__DEFAULT__' : 'PrimaryButton'
      await engine.processAnswer(answer)

      const completeness = engine.getCompleteness()
      if (completeness.canGenerate) {
        break
      }
    }

    const completeness = engine.getCompleteness()
    expect(completeness.canGenerate).toBe(true)

    const outputDir = path.join(process.cwd(), 'artifacts')
    const output = await engine.generate(outputDir)

    expect(output.outputId).toBe(started.outputId)
    expect(output.planJson).toHaveProperty('manifest')
  } finally {
    await prisma.$disconnect()
  }
}, 60000)
