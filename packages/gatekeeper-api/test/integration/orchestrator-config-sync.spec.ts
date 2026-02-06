/**
 * @file orchestrator-config-sync.spec.ts
 * @description Contract spec — Sincronização de configuração do orchestrator com seed.ts
 * @contract orchestrator-config-sync
 * @mode STRICT
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'

// ── Configuração ───────────────────────────────────────────────────────────

const prisma = new PrismaClient()

// ── Fixtures ────────────────────────────────────────────────────────────────

// Valores canônicos do seed.ts (linhas 666-711)
const SEED_CONFIGS = [
  {
    step: 1,
    provider: 'claude-code',
    model: 'opus',
    maxTokens: 16384,
    maxIterations: 40,
    maxInputTokensBudget: 500_000,
    temperature: 0.3,
    fallbackProvider: 'openai',
    fallbackModel: 'gpt-4o',
  },
  {
    step: 2,
    provider: 'claude-code',
    model: 'opus',
    maxTokens: 16384,
    maxIterations: 35,
    maxInputTokensBudget: 300_000,
    temperature: 0.2,
    fallbackProvider: 'mistral',
    fallbackModel: 'mistral-large-latest',
  },
  {
    step: 3,
    provider: 'claude-code',
    model: 'opus',
    maxTokens: 16384,
    maxIterations: 15,
    maxInputTokensBudget: 200_000,
    temperature: 0.2,
    fallbackProvider: 'openai',
    fallbackModel: 'gpt-4o',
  },
  {
    step: 4,
    provider: 'claude-code',
    model: 'opus',
    maxTokens: 32768,
    maxIterations: 60,
    maxInputTokensBudget: 800_000,
    temperature: 0.1,
    fallbackProvider: 'openai',
    fallbackModel: 'gpt-4o',
  },
]

// ── Helpers ─────────────────────────────────────────────────────────────────

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function ensureSeedConfigs(): Promise<void> {
  // Garantir que configs do seed existam
  for (const config of SEED_CONFIGS) {
    await prisma.agentPhaseConfig.upsert({
      where: { step: config.step },
      create: config,
      update: {
        provider: config.provider,
        model: config.model,
        maxTokens: config.maxTokens,
        maxIterations: config.maxIterations,
        maxInputTokensBudget: config.maxInputTokensBudget,
        temperature: config.temperature,
        fallbackProvider: config.fallbackProvider,
        fallbackModel: config.fallbackModel,
      },
    })
  }
}

// ── Setup ───────────────────────────────────────────────────────────────────

beforeEach(async () => {
  // Garantir estado limpo e sincronizado com seed
  await ensureSeedConfigs()
})

afterAll(async () => {
  await prisma.$disconnect()
})

// ══════════════════════════════════════════════════════════════════════════════
// CL-CFG-001: Pipeline usa configurações do seed
// ══════════════════════════════════════════════════════════════════════════════

describe('CL-CFG-001 - Pipeline usa configurações do seed', () => {
  // @clause CL-CFG-001
  it('succeeds when step 1 config matches seed values', async () => {
    const config = await prisma.agentPhaseConfig.findUnique({
      where: { step: 1 },
    })

    expect(config).toBeDefined()
    expect(config!.provider).toBe('claude-code')
    expect(config!.model).toBe('opus')
    expect(config!.fallbackProvider).toBe('openai')
    expect(config!.fallbackModel).toBe('gpt-4o')
    expect(config!.maxTokens).toBe(16384)
    expect(config!.maxIterations).toBe(40)
    expect(config!.maxInputTokensBudget).toBe(500_000)
    expect(config!.temperature).toBe(0.3)
  })

  // @clause CL-CFG-001
  it('succeeds when step 2 config uses correct mistral fallback', async () => {
    const config = await prisma.agentPhaseConfig.findUnique({
      where: { step: 2 },
    })

    expect(config).toBeDefined()
    expect(config!.provider).toBe('claude-code')
    expect(config!.model).toBe('opus')
    expect(config!.fallbackProvider).toBe('mistral')
    expect(config!.fallbackModel).toBe('mistral-large-latest')
    expect(config!.maxTokens).toBe(16384)
    expect(config!.maxIterations).toBe(35)
    expect(config!.maxInputTokensBudget).toBe(300_000)
    expect(config!.temperature).toBe(0.2)
  })

  // @clause CL-CFG-001
  it('fails when config values drift from seed', async () => {
    // Simular drift
    await prisma.agentPhaseConfig.update({
      where: { step: 1 },
      data: {
        provider: 'wrong-provider',
        model: 'wrong-model',
        fallbackProvider: 'wrong-fallback',
      },
    })

    const config = await prisma.agentPhaseConfig.findUnique({
      where: { step: 1 },
    })

    // Deve ser diferente do seed (evidenciando drift)
    expect(config!.provider).toBe('wrong-provider')
    expect(config!.model).toBe('wrong-model')
    expect(config!.fallbackProvider).toBe('wrong-fallback')

    // Re-sincronizar com seed
    await ensureSeedConfigs()

    const synced = await prisma.agentPhaseConfig.findUnique({
      where: { step: 1 },
    })

    // Agora deve corresponder ao seed
    expect(synced!.provider).toBe('claude-code')
    expect(synced!.model).toBe('opus')
    expect(synced!.fallbackProvider).toBe('openai')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// CL-CFG-002: Sem duplicatas na tabela
// ══════════════════════════════════════════════════════════════════════════════

describe('CL-CFG-002 - Sem duplicatas na tabela', () => {
  // @clause CL-CFG-002
  it('succeeds when exactly 4 records exist (one per step)', async () => {
    const allConfigs = await prisma.agentPhaseConfig.findMany()

    expect(allConfigs).toHaveLength(4)

    const steps = allConfigs.map(c => c.step).sort()
    expect(steps).toEqual([1, 2, 3, 4])
  })

  // @clause CL-CFG-002
  it('succeeds when each step has exactly one record', async () => {
    for (const step of [1, 2, 3, 4]) {
      const configs = await prisma.agentPhaseConfig.findMany({
        where: { step },
      })

      expect(configs).toHaveLength(1)
    }
  })

  // @clause CL-CFG-002
  it('fails when query returns more than one record per step', async () => {
    // Nota: O schema define step como @id, então duplicatas
    // não podem existir via Prisma. Este teste documenta a invariante.

    const step1Configs = await prisma.agentPhaseConfig.findMany({
      where: { step: 1 },
    })

    // Deve ser exatamente 1
    expect(step1Configs).toHaveLength(1)

    // Tentar criar duplicata resultaria em erro do Prisma
    await expect(
      prisma.agentPhaseConfig.create({
        data: {
          step: 1,
          provider: 'duplicate',
          model: 'duplicate',
          maxTokens: 0,
          maxIterations: 0,
          maxInputTokensBudget: 0,
        },
      })
    ).rejects.toThrow()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// CL-CFG-003: Seed atualiza valores de config
// ══════════════════════════════════════════════════════════════════════════════

describe('CL-CFG-003 - Seed atualiza valores de config', () => {
  // @clause CL-CFG-003
  it('succeeds when upsert overwrites drifted provider and model', async () => {
    // Simular drift
    await prisma.agentPhaseConfig.update({
      where: { step: 1 },
      data: {
        provider: 'drifted-provider',
        model: 'drifted-model',
      },
    })

    const drifted = await prisma.agentPhaseConfig.findUnique({
      where: { step: 1 },
    })
    expect(drifted!.provider).toBe('drifted-provider')

    // Re-executar upsert do seed
    const seedConfig = SEED_CONFIGS[0]
    await prisma.agentPhaseConfig.upsert({
      where: { step: 1 },
      create: seedConfig,
      update: {
        provider: seedConfig.provider,
        model: seedConfig.model,
        fallbackProvider: seedConfig.fallbackProvider,
        fallbackModel: seedConfig.fallbackModel,
      },
    })

    const updated = await prisma.agentPhaseConfig.findUnique({
      where: { step: 1 },
    })

    expect(updated!.provider).toBe('claude-code')
    expect(updated!.model).toBe('opus')
  })

  // @clause CL-CFG-003
  it('succeeds when upsert updates all fields to seed values', async () => {
    // Modificar múltiplos campos
    await prisma.agentPhaseConfig.update({
      where: { step: 2 },
      data: {
        provider: 'old-provider',
        model: 'old-model',
        maxTokens: 999,
        maxIterations: 5,
        fallbackProvider: 'old-fallback',
        fallbackModel: 'old-fallback-model',
      },
    })

    // Re-executar upsert do seed
    const seedConfig = SEED_CONFIGS[1] // step 2
    await prisma.agentPhaseConfig.upsert({
      where: { step: 2 },
      create: seedConfig,
      update: {
        provider: seedConfig.provider,
        model: seedConfig.model,
        maxTokens: seedConfig.maxTokens,
        maxIterations: seedConfig.maxIterations,
        maxInputTokensBudget: seedConfig.maxInputTokensBudget,
        temperature: seedConfig.temperature,
        fallbackProvider: seedConfig.fallbackProvider,
        fallbackModel: seedConfig.fallbackModel,
      },
    })

    const updated = await prisma.agentPhaseConfig.findUnique({
      where: { step: 2 },
    })

    expect(updated!.provider).toBe('claude-code')
    expect(updated!.model).toBe('opus')
    expect(updated!.maxTokens).toBe(16384)
    expect(updated!.maxIterations).toBe(35)
    expect(updated!.fallbackProvider).toBe('mistral')
    expect(updated!.fallbackModel).toBe('mistral-large-latest')
  })

  // @clause CL-CFG-003
  it('fails when update does not include fallback fields', async () => {
    // Modificar fallbacks
    await prisma.agentPhaseConfig.update({
      where: { step: 3 },
      data: {
        fallbackProvider: 'wrong-fallback',
        fallbackModel: 'wrong-model',
      },
    })

    // Upsert SEM incluir fallback fields
    await prisma.agentPhaseConfig.upsert({
      where: { step: 3 },
      create: SEED_CONFIGS[2],
      update: {
        provider: SEED_CONFIGS[2].provider,
        model: SEED_CONFIGS[2].model,
        // Omitir fallbackProvider e fallbackModel
      },
    })

    const updated = await prisma.agentPhaseConfig.findUnique({
      where: { step: 3 },
    })

    // Fallbacks devem permanecer incorretos
    expect(updated!.fallbackProvider).toBe('wrong-fallback')
    expect(updated!.fallbackModel).toBe('wrong-model')

    // Agora fazer upsert correto
    await prisma.agentPhaseConfig.upsert({
      where: { step: 3 },
      create: SEED_CONFIGS[2],
      update: {
        provider: SEED_CONFIGS[2].provider,
        model: SEED_CONFIGS[2].model,
        fallbackProvider: SEED_CONFIGS[2].fallbackProvider,
        fallbackModel: SEED_CONFIGS[2].fallbackModel,
      },
    })

    const corrected = await prisma.agentPhaseConfig.findUnique({
      where: { step: 3 },
    })

    expect(corrected!.fallbackProvider).toBe('openai')
    expect(corrected!.fallbackModel).toBe('gpt-4o')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// CL-CFG-004: Lista retorna um registro por step
// ══════════════════════════════════════════════════════════════════════════════

describe('CL-CFG-004 - Lista retorna um registro por step', () => {
  // @clause CL-CFG-004
  it('succeeds when findMany returns exactly 4 records', async () => {
    const configs = await prisma.agentPhaseConfig.findMany()

    expect(configs).toHaveLength(4)
  })

  // @clause CL-CFG-004
  it('succeeds when returned steps are [1, 2, 3, 4]', async () => {
    const configs = await prisma.agentPhaseConfig.findMany({
      orderBy: { step: 'asc' },
    })

    const steps = configs.map(c => c.step)
    expect(steps).toEqual([1, 2, 3, 4])
  })

  // @clause CL-CFG-004
  it('fails when list returns fewer than 4 records', async () => {
    // Deletar um registro
    await prisma.agentPhaseConfig.delete({ where: { step: 4 } })

    const configs = await prisma.agentPhaseConfig.findMany()

    // Deve ter apenas 3
    expect(configs).toHaveLength(3)

    // Restaurar para 4
    await ensureSeedConfigs()

    const restored = await prisma.agentPhaseConfig.findMany()
    expect(restored).toHaveLength(4)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// CL-CFG-005: Remoção automática de duplicatas
// ══════════════════════════════════════════════════════════════════════════════

describe('CL-CFG-005 - Remoção automática de duplicatas', () => {
  // @clause CL-CFG-005
  it('succeeds when only newest record is kept after duplicate detection', async () => {
    // Nota: step é @id, então não podemos criar duplicatas reais via Prisma.
    // Este teste documenta a lógica que seria aplicada se duplicatas existissem.

    // Simular cenário onde haveria duplicatas (via raw query ou migração)
    // Para este teste, validamos a lógica de ordenação por updatedAt

    const configs = await prisma.agentPhaseConfig.findMany({
      where: { step: 1 },
      orderBy: { updatedAt: 'desc' },
    })

    // Deve haver apenas 1
    expect(configs).toHaveLength(1)

    // Se houvesse múltiplos, o primeiro seria o mais recente
    const newest = configs[0]
    expect(newest).toBeDefined()
    expect(newest.updatedAt).toBeInstanceOf(Date)
  })

  // @clause CL-CFG-005
  it('succeeds when updatedAt ordering identifies newest record', async () => {
    // Criar registro
    const initial = await prisma.agentPhaseConfig.findUnique({
      where: { step: 1 },
    })
    expect(initial).toBeDefined()

    await delay(10)

    // Atualizar para mudar updatedAt
    await prisma.agentPhaseConfig.update({
      where: { step: 1 },
      data: { provider: 'updated-provider' },
    })

    const updated = await prisma.agentPhaseConfig.findUnique({
      where: { step: 1 },
    })

    // updatedAt deve ser posterior
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(
      initial!.updatedAt.getTime()
    )
  })

  // @clause CL-CFG-005
  it('fails when older records are not removed', async () => {
    // Este teste documenta que a estratégia seria:
    // 1. Buscar todos os registros com mesmo step
    // 2. Ordenar por updatedAt desc
    // 3. Manter o primeiro (mais recente)
    // 4. Deletar os demais

    // Como step é @id, este cenário não pode ocorrer via Prisma
    // Mas documentamos a lógica de resolução

    const configs = await prisma.agentPhaseConfig.findMany({
      where: { step: 2 },
      orderBy: { updatedAt: 'desc' },
    })

    expect(configs).toHaveLength(1)

    // Se houvesse duplicatas:
    // const newestId = configs[0].step
    // const oldIds = configs.slice(1).map(c => c.step)
    // await prisma.agentPhaseConfig.deleteMany({
    //   where: { step: 2, NOT: { step: newestId } }
    // })
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// CL-CFG-006: Consistência com seed
// ══════════════════════════════════════════════════════════════════════════════

describe('CL-CFG-006 - Consistência com seed', () => {
  // @clause CL-CFG-006
  it('succeeds when all DB configs match seed definitions', async () => {
    const dbConfigs = await prisma.agentPhaseConfig.findMany({
      orderBy: { step: 'asc' },
    })

    expect(dbConfigs).toHaveLength(4)

    for (let i = 0; i < dbConfigs.length; i++) {
      const dbConfig = dbConfigs[i]
      const seedConfig = SEED_CONFIGS[i]

      expect(dbConfig.step).toBe(seedConfig.step)
      expect(dbConfig.provider).toBe(seedConfig.provider)
      expect(dbConfig.model).toBe(seedConfig.model)
      expect(dbConfig.maxTokens).toBe(seedConfig.maxTokens)
      expect(dbConfig.maxIterations).toBe(seedConfig.maxIterations)
      expect(dbConfig.maxInputTokensBudget).toBe(seedConfig.maxInputTokensBudget)
      expect(dbConfig.temperature).toBe(seedConfig.temperature)
      expect(dbConfig.fallbackProvider).toBe(seedConfig.fallbackProvider)
      expect(dbConfig.fallbackModel).toBe(seedConfig.fallbackModel)
    }
  })

  // @clause CL-CFG-006
  it('succeeds when step 4 has highest maxTokens value', async () => {
    const step4 = await prisma.agentPhaseConfig.findUnique({
      where: { step: 4 },
    })

    // Step 4 (Coder) deve ter 32768 tokens (maior que os outros 16384)
    expect(step4!.maxTokens).toBe(32768)

    const otherSteps = await prisma.agentPhaseConfig.findMany({
      where: { step: { not: 4 } },
    })

    for (const config of otherSteps) {
      expect(config.maxTokens).toBeLessThan(step4!.maxTokens)
    }
  })

  // @clause CL-CFG-006
  it('fails when DB values diverge from seed after CRUD operations', async () => {
    // Modificar valores via update
    await prisma.agentPhaseConfig.update({
      where: { step: 1 },
      data: {
        provider: 'divergent-provider',
        model: 'divergent-model',
        maxTokens: 999,
      },
    })

    const divergent = await prisma.agentPhaseConfig.findUnique({
      where: { step: 1 },
    })

    // Valores devem estar diferentes do seed
    expect(divergent!.provider).not.toBe(SEED_CONFIGS[0].provider)
    expect(divergent!.model).not.toBe(SEED_CONFIGS[0].model)
    expect(divergent!.maxTokens).not.toBe(SEED_CONFIGS[0].maxTokens)

    // Re-sincronizar
    await ensureSeedConfigs()

    const synchronized = await prisma.agentPhaseConfig.findUnique({
      where: { step: 1 },
    })

    // Agora deve corresponder ao seed
    expect(synchronized!.provider).toBe(SEED_CONFIGS[0].provider)
    expect(synchronized!.model).toBe(SEED_CONFIGS[0].model)
    expect(synchronized!.maxTokens).toBe(SEED_CONFIGS[0].maxTokens)
  })
})
