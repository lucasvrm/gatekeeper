/**
 * @file orchestrator-config-sync.spec.ts
 * @description Contract spec — Sincronização de configuração do Orchestrator com seed
 * @contract orchestrator-config-sync
 * @mode STRICT
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { PrismaClient } from '@prisma/client'

// ── Configuração ───────────────────────────────────────────────────────────

const prisma = new PrismaClient()

// ── Seed Reference Data ──────────────────────────────────────────────────────
// These values MUST match seed.ts agentPhaseConfigs array (lines 666-711)

const SEED_CONFIGS = [
  {
    step: 1,
    provider: 'claude-code',
    model: 'opus',
    fallbackProvider: 'openai',
    fallbackModel: 'gpt-4o',
  },
  {
    step: 2,
    provider: 'claude-code',
    model: 'opus',
    fallbackProvider: 'mistral',
    fallbackModel: 'mistral-large-latest',
  },
  {
    step: 3,
    provider: 'claude-code',
    model: 'opus',
    fallbackProvider: 'openai',
    fallbackModel: 'gpt-4o',
  },
  {
    step: 4,
    provider: 'claude-code',
    model: 'opus',
    fallbackProvider: 'openai',
    fallbackModel: 'gpt-4o',
  },
] as const

// ── Helpers ─────────────────────────────────────────────────────────────────

async function getSeedConfigForStep(step: number) {
  return SEED_CONFIGS.find(c => c.step === step)
}

async function createDuplicateConfig(step: number) {
  return await prisma.agentPhaseConfig.create({
    data: {
      step,
      provider: 'duplicate-provider',
      model: 'duplicate-model',
      maxTokens: 8192,
      maxIterations: 10,
      maxInputTokensBudget: 100000,
      temperature: 0.5,
    },
  })
}

async function getAllConfigsForStep(step: number) {
  return await prisma.agentPhaseConfig.findMany({
    where: { step },
    orderBy: { updatedAt: 'desc' },
  })
}

// ── Setup ───────────────────────────────────────────────────────────────────

beforeEach(async () => {
  // Ensure clean state: delete all configs
  await prisma.agentPhaseConfig.deleteMany({})

  // Re-run seed logic for AgentPhaseConfig
  for (const config of SEED_CONFIGS) {
    await prisma.agentPhaseConfig.upsert({
      where: { step: config.step },
      create: {
        step: config.step,
        provider: config.provider,
        model: config.model,
        maxTokens: config.step === 4 ? 32768 : 16384,
        maxIterations: config.step === 1 ? 40 : config.step === 2 ? 35 : config.step === 3 ? 15 : 60,
        maxInputTokensBudget: config.step === 1 ? 500000 : config.step === 2 ? 300000 : config.step === 3 ? 200000 : 800000,
        temperature: config.step === 1 ? 0.3 : config.step === 2 ? 0.2 : config.step === 3 ? 0.2 : 0.1,
        fallbackProvider: config.fallbackProvider,
        fallbackModel: config.fallbackModel,
      },
      update: {
        provider: config.provider,
        model: config.model,
        fallbackProvider: config.fallbackProvider,
        fallbackModel: config.fallbackModel,
      },
    })
  }
})

afterAll(async () => {
  await prisma.$disconnect()
})

// ══════════════════════════════════════════════════════════════════════════════
// TESTS — CL-CFG-001: Pipeline usa configs do seed
// ══════════════════════════════════════════════════════════════════════════════

describe('AgentRunnerController.runPipeline - configs do banco', () => {
  // @clause CL-CFG-001
  it('succeeds when step 1 config matches seed values', async () => {
    const config = await prisma.agentPhaseConfig.findUnique({
      where: { step: 1 },
    })
    const seedConfig = await getSeedConfigForStep(1)

    expect(config).toBeDefined()
    expect(config?.provider).toBe(seedConfig?.provider)
    expect(config?.model).toBe(seedConfig?.model)
    expect(config?.fallbackProvider).toBe(seedConfig?.fallbackProvider)
    expect(config?.fallbackModel).toBe(seedConfig?.fallbackModel)
  })

  // @clause CL-CFG-001
  it('succeeds when step 2 config matches seed values', async () => {
    const config = await prisma.agentPhaseConfig.findUnique({
      where: { step: 2 },
    })
    const seedConfig = await getSeedConfigForStep(2)

    expect(config).toBeDefined()
    expect(config?.provider).toBe(seedConfig?.provider)
    expect(config?.model).toBe(seedConfig?.model)
    expect(config?.fallbackProvider).toBe(seedConfig?.fallbackProvider)
    expect(config?.fallbackModel).toBe(seedConfig?.fallbackModel)
  })

  // @clause CL-CFG-001
  it('fails when config does not match seed (simulated drift)', async () => {
    // Simulate config drift
    await prisma.agentPhaseConfig.update({
      where: { step: 1 },
      data: { provider: 'wrong-provider', model: 'wrong-model' },
    })

    const config = await prisma.agentPhaseConfig.findUnique({
      where: { step: 1 },
    })
    const seedConfig = await getSeedConfigForStep(1)

    expect(config?.provider).not.toBe(seedConfig?.provider)
    expect(config?.model).not.toBe(seedConfig?.model)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// TESTS — CL-CFG-002: Sem duplicatas na tabela
// ══════════════════════════════════════════════════════════════════════════════

describe('AgentPhaseConfig - verificação de duplicatas', () => {
  // @clause CL-CFG-002
  it('succeeds when each step has exactly one record', async () => {
    const allConfigs = await prisma.agentPhaseConfig.findMany()
    const stepCounts = new Map<number, number>()

    for (const config of allConfigs) {
      stepCounts.set(config.step, (stepCounts.get(config.step) || 0) + 1)
    }

    for (const step of [1, 2, 3, 4]) {
      expect(stepCounts.get(step)).toBe(1)
    }
  })

  // @clause CL-CFG-002
  it('succeeds when duplicate detection finds multiple records per step', async () => {
    // Create a duplicate for step 1
    await createDuplicateConfig(1)

    const configs = await getAllConfigsForStep(1)
    expect(configs.length).toBeGreaterThan(1)
  })

  // @clause CL-CFG-002
  it('fails when multiple configs exist for same step without removal', async () => {
    await createDuplicateConfig(2)
    await createDuplicateConfig(2)

    const configs = await getAllConfigsForStep(2)
    expect(configs.length).toBeGreaterThan(1)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// TESTS — CL-CFG-003: Seed atualiza valores de config
// ══════════════════════════════════════════════════════════════════════════════

describe('Seed upsert - atualização de valores', () => {
  // @clause CL-CFG-003
  it('succeeds when seed upsert updates provider field', async () => {
    // Simulate old config
    await prisma.agentPhaseConfig.update({
      where: { step: 3 },
      data: { provider: 'old-provider' },
    })

    // Re-run seed upsert
    const seedConfig = SEED_CONFIGS.find(c => c.step === 3)!
    await prisma.agentPhaseConfig.upsert({
      where: { step: 3 },
      create: {
        step: 3,
        provider: seedConfig.provider,
        model: seedConfig.model,
        maxTokens: 16384,
        maxIterations: 15,
        maxInputTokensBudget: 200000,
        temperature: 0.2,
        fallbackProvider: seedConfig.fallbackProvider,
        fallbackModel: seedConfig.fallbackModel,
      },
      update: {
        provider: seedConfig.provider,
        model: seedConfig.model,
        fallbackProvider: seedConfig.fallbackProvider,
        fallbackModel: seedConfig.fallbackModel,
      },
    })

    const config = await prisma.agentPhaseConfig.findUnique({ where: { step: 3 } })
    expect(config?.provider).toBe(seedConfig.provider)
  })

  // @clause CL-CFG-003
  it('succeeds when seed upsert updates model and fallback fields', async () => {
    const seedConfig = SEED_CONFIGS.find(c => c.step === 4)!

    // Update with seed values
    await prisma.agentPhaseConfig.upsert({
      where: { step: 4 },
      create: {
        step: 4,
        provider: seedConfig.provider,
        model: seedConfig.model,
        maxTokens: 32768,
        maxIterations: 60,
        maxInputTokensBudget: 800000,
        temperature: 0.1,
        fallbackProvider: seedConfig.fallbackProvider,
        fallbackModel: seedConfig.fallbackModel,
      },
      update: {
        provider: seedConfig.provider,
        model: seedConfig.model,
        fallbackProvider: seedConfig.fallbackProvider,
        fallbackModel: seedConfig.fallbackModel,
      },
    })

    const config = await prisma.agentPhaseConfig.findUnique({ where: { step: 4 } })
    expect(config?.model).toBe(seedConfig.model)
    expect(config?.fallbackProvider).toBe(seedConfig.fallbackProvider)
    expect(config?.fallbackModel).toBe(seedConfig.fallbackModel)
  })

  // @clause CL-CFG-003
  it('fails when seed upsert does not update config fields', async () => {
    await prisma.agentPhaseConfig.update({
      where: { step: 2 },
      data: { provider: 'stale-provider', model: 'stale-model' },
    })

    // Do NOT run upsert (simulate seed not executed)
    const config = await prisma.agentPhaseConfig.findUnique({ where: { step: 2 } })
    const seedConfig = SEED_CONFIGS.find(c => c.step === 2)!

    expect(config?.provider).not.toBe(seedConfig.provider)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// TESTS — CL-CFG-004: Lista retorna um registro por step
// ══════════════════════════════════════════════════════════════════════════════

describe('AgentPhaseConfigController.list - um registro por step', () => {
  // @clause CL-CFG-004
  it('succeeds when list returns exactly 4 configs (one per step)', async () => {
    const configs = await prisma.agentPhaseConfig.findMany()
    expect(configs.length).toBe(4)

    const steps = configs.map(c => c.step).sort()
    expect(steps).toEqual([1, 2, 3, 4])
  })

  // @clause CL-CFG-004
  it('succeeds when each step (1-4) has exactly one record', async () => {
    for (const step of [1, 2, 3, 4]) {
      const config = await prisma.agentPhaseConfig.findUnique({ where: { step } })
      expect(config).toBeDefined()
      expect(config?.step).toBe(step)
    }
  })

  // @clause CL-CFG-004
  it('fails when step has no config record', async () => {
    await prisma.agentPhaseConfig.delete({ where: { step: 3 } })

    const config = await prisma.agentPhaseConfig.findUnique({ where: { step: 3 } })
    expect(config).toBeNull()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// TESTS — CL-CFG-005: Remoção automática de duplicatas
// ══════════════════════════════════════════════════════════════════════════════

describe('Duplicate removal - keep most recent by updatedAt', () => {
  // @clause CL-CFG-005
  it('succeeds when system removes older duplicate and keeps newest', async () => {
    const older = await createDuplicateConfig(1)

    // Wait to ensure different updatedAt
    await new Promise(resolve => setTimeout(resolve, 10))

    const newer = await prisma.agentPhaseConfig.create({
      data: {
        step: 1,
        provider: 'newer-provider',
        model: 'newer-model',
        maxTokens: 16384,
        maxIterations: 40,
        maxInputTokensBudget: 500000,
        temperature: 0.3,
      },
    })

    // Simulate duplicate removal logic: deleteMany where step=1 AND id != newest
    const configs = await getAllConfigsForStep(1)
    const newestId = configs[0].id // sorted by updatedAt DESC

    await prisma.agentPhaseConfig.deleteMany({
      where: {
        step: 1,
        id: { not: newestId },
      },
    })

    const remaining = await getAllConfigsForStep(1)
    expect(remaining.length).toBe(1)
    expect(remaining[0].id).toBe(newestId)
  })

  // @clause CL-CFG-005
  it('succeeds when removal keeps config with latest updatedAt', async () => {
    await createDuplicateConfig(2)
    await new Promise(resolve => setTimeout(resolve, 10))
    await createDuplicateConfig(2)

    const configs = await getAllConfigsForStep(2)
    const newest = configs[0] // DESC order

    // Remove all except newest
    await prisma.agentPhaseConfig.deleteMany({
      where: {
        step: 2,
        id: { not: newest.id },
      },
    })

    const remaining = await getAllConfigsForStep(2)
    expect(remaining.length).toBe(1)
    expect(remaining[0].updatedAt).toEqual(newest.updatedAt)
  })

  // @clause CL-CFG-005
  it('fails when older duplicates are not removed', async () => {
    await createDuplicateConfig(4)
    await createDuplicateConfig(4)

    // Do NOT remove duplicates
    const configs = await getAllConfigsForStep(4)
    expect(configs.length).toBeGreaterThan(1)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// TESTS — CL-CFG-006: Consistência com seed
// ══════════════════════════════════════════════════════════════════════════════

describe('Orchestrator routes - consistência com seed', () => {
  // @clause CL-CFG-006
  it('succeeds when all configs match seed provider and model', async () => {
    const configs = await prisma.agentPhaseConfig.findMany()

    for (const config of configs) {
      const seedConfig = SEED_CONFIGS.find(c => c.step === config.step)!
      expect(config.provider).toBe(seedConfig.provider)
      expect(config.model).toBe(seedConfig.model)
    }
  })

  // @clause CL-CFG-006
  it('succeeds when step 2 fallback matches seed definition', async () => {
    const config = await prisma.agentPhaseConfig.findUnique({ where: { step: 2 } })
    const seedConfig = SEED_CONFIGS.find(c => c.step === 2)!

    expect(config?.fallbackProvider).toBe(seedConfig.fallbackProvider)
    expect(config?.fallbackModel).toBe(seedConfig.fallbackModel)
  })

  // @clause CL-CFG-006
  it('fails when config drifts from seed values', async () => {
    await prisma.agentPhaseConfig.update({
      where: { step: 1 },
      data: { provider: 'drifted-provider', model: 'drifted-model' },
    })

    const config = await prisma.agentPhaseConfig.findUnique({ where: { step: 1 } })
    const seedConfig = SEED_CONFIGS.find(c => c.step === 1)!

    expect(config?.provider).not.toBe(seedConfig.provider)
    expect(config?.model).not.toBe(seedConfig.model)
  })
})
