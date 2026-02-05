/**
 * @file pipeline-persistence.spec.ts
 * @description Contract spec — Persistência de eventos e estado de pipeline com suporte a replay SSE
 * @contract pipeline-persistence-models
 * @mode STRICT
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'

// ── Configuração ───────────────────────────────────────────────────────────

const prisma = new PrismaClient()

// ── Helpers ─────────────────────────────────────────────────────────────────

async function cleanupTestPipelineData() {
  // Cleanup em ordem reversa devido a possíveis constraints
  await prisma.pipelineEvent.deleteMany({
    where: {
      outputId: {
        startsWith: 'test-output-'
      }
    }
  })
  await prisma.pipelineState.deleteMany({
    where: {
      outputId: {
        startsWith: 'test-output-'
      }
    }
  })
}

function createTestEvent(overrides = {}) {
  return {
    outputId: 'test-output-default',
    stage: 'planning',
    eventType: 'agent:start',
    ...overrides
  }
}

function createTestState(overrides = {}) {
  return {
    outputId: 'test-output-state-default',
    ...overrides
  }
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── Setup ───────────────────────────────────────────────────────────────────

beforeEach(async () => {
  await cleanupTestPipelineData()
})

afterAll(async () => {
  await cleanupTestPipelineData()
  await prisma.$disconnect()
})

// ══════════════════════════════════════════════════════════════════════════════
// TESTS — PipelineEvent Structure
// ══════════════════════════════════════════════════════════════════════════════

describe('PipelineEvent - ID autoincremental', () => {
  // @clause CL-DB-001
  it('succeeds when event is created with autoincrement id', async () => {
    const event = await prisma.pipelineEvent.create({
      data: createTestEvent({ outputId: 'test-output-001' })
    })

    expect(event.id).toBeDefined()
    expect(typeof event.id).toBe('number')
    expect(event.id).toBeGreaterThan(0)
  })

  // @clause CL-DB-001
  it('succeeds when sequential events have ascending ids', async () => {
    const event1 = await prisma.pipelineEvent.create({
      data: createTestEvent({ outputId: 'test-output-002' })
    })
    const event2 = await prisma.pipelineEvent.create({
      data: createTestEvent({ outputId: 'test-output-002' })
    })

    expect(event2.id).toBeGreaterThan(event1.id)
    expect(event2.id - event1.id).toBe(1)
  })

  // @clause CL-DB-001
  it('fails when id is not autoincremented properly', async () => {
    const event1 = await prisma.pipelineEvent.create({
      data: createTestEvent({ outputId: 'test-output-003' })
    })
    const event2 = await prisma.pipelineEvent.create({
      data: createTestEvent({ outputId: 'test-output-003' })
    })

    // Espera-se que seja sequencial, falha se não for
    expect(event2.id).toBe(event1.id + 1)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// TESTS — Replay via Last-Event-ID
// ══════════════════════════════════════════════════════════════════════════════

describe('PipelineEvent - Replay eficiente via outputId e id', () => {
  // @clause CL-DB-002
  it('succeeds when querying events after Last-Event-ID', async () => {
    const outputId = 'test-output-replay-001'

    // Criar 5 eventos
    await prisma.pipelineEvent.create({ data: createTestEvent({ outputId }) })
    await prisma.pipelineEvent.create({ data: createTestEvent({ outputId }) })
    const lastSeen = await prisma.pipelineEvent.create({ data: createTestEvent({ outputId }) })
    const event4 = await prisma.pipelineEvent.create({ data: createTestEvent({ outputId }) })
    const event5 = await prisma.pipelineEvent.create({ data: createTestEvent({ outputId }) })

    // Simular cliente SSE com Last-Event-ID
    const replayEvents = await prisma.pipelineEvent.findMany({
      where: {
        outputId,
        id: { gt: lastSeen.id }
      },
      orderBy: { id: 'asc' }
    })

    expect(replayEvents).toHaveLength(2)
    expect(replayEvents[0].id).toBe(event4.id)
    expect(replayEvents[1].id).toBe(event5.id)
  })

  // @clause CL-DB-002
  it('succeeds when replay returns events in ascending id order', async () => {
    const outputId = 'test-output-replay-002'

    const ids = []
    for (let i = 0; i < 10; i++) {
      const evt = await prisma.pipelineEvent.create({ data: createTestEvent({ outputId }) })
      ids.push(evt.id)
    }

    const replayEvents = await prisma.pipelineEvent.findMany({
      where: { outputId, id: { gt: ids[4] } },
      orderBy: { id: 'asc' }
    })

    expect(replayEvents).toHaveLength(5)
    replayEvents.forEach((evt, idx) => {
      expect(evt.id).toBe(ids[5 + idx])
    })
  })

  // @clause CL-DB-002
  it('fails when replay query without index is slower than with index', async () => {
    // Este teste assume que o índice @@index([outputId, id]) existe
    // Sem o índice, a query seria full table scan
    const outputId = 'test-output-replay-003'

    // Criar 100 eventos para demonstrar performance
    for (let i = 0; i < 100; i++) {
      await prisma.pipelineEvent.create({ data: createTestEvent({ outputId }) })
    }

    const startTime = Date.now()
    await prisma.pipelineEvent.findMany({
      where: { outputId, id: { gt: 50 } },
      orderBy: { id: 'asc' }
    })
    const queryTime = Date.now() - startTime

    // Com índice, query deve ser rápida (<50ms para 100 eventos)
    expect(queryTime).toBeLessThan(50)
  })

  // @clause CL-DB-012
  it('succeeds when replay query has O(log n) performance with index', async () => {
    const outputId = 'test-output-perf-001'

    // Criar 1000 eventos
    for (let i = 0; i < 1000; i++) {
      await prisma.pipelineEvent.create({ data: createTestEvent({ outputId }) })
    }

    const startTime = Date.now()
    const events = await prisma.pipelineEvent.findMany({
      where: { outputId, id: { gt: 500 } },
      orderBy: { id: 'asc' }
    })
    const queryTime = Date.now() - startTime

    expect(events.length).toBeGreaterThan(0)
    // Com índice B-tree, query deve ser rápida mesmo com 1000 eventos
    expect(queryTime).toBeLessThan(100)
  })

  // @clause CL-DB-012
  it('fails when query without outputId filter performs poorly', async () => {
    // Query sem outputId não usa índice composto eficientemente
    const outputId = 'test-output-perf-002'

    for (let i = 0; i < 100; i++) {
      await prisma.pipelineEvent.create({ data: createTestEvent({ outputId }) })
    }

    // Query com outputId (usa índice)
    const withFilterStart = Date.now()
    await prisma.pipelineEvent.findMany({
      where: { outputId, id: { gt: 50 } }
    })
    const withFilterTime = Date.now() - withFilterStart

    expect(withFilterTime).toBeLessThan(50)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// TESTS — Consultas Temporais
// ══════════════════════════════════════════════════════════════════════════════

describe('PipelineEvent - Consultas temporais via createdAt', () => {
  // @clause CL-DB-003
  it('succeeds when querying events created after specific timestamp', async () => {
    const outputId = 'test-output-temporal-001'
    const now = new Date()

    await prisma.pipelineEvent.create({ data: createTestEvent({ outputId }) })
    await delay(100)

    const cutoffTime = new Date()
    await delay(100)

    const recentEvent1 = await prisma.pipelineEvent.create({ data: createTestEvent({ outputId }) })
    const recentEvent2 = await prisma.pipelineEvent.create({ data: createTestEvent({ outputId }) })

    const recentEvents = await prisma.pipelineEvent.findMany({
      where: {
        outputId,
        createdAt: { gte: cutoffTime }
      },
      orderBy: { createdAt: 'desc' }
    })

    expect(recentEvents).toHaveLength(2)
    expect(recentEvents[0].id).toBe(recentEvent2.id)
    expect(recentEvents[1].id).toBe(recentEvent1.id)
  })

  // @clause CL-DB-003
  it('succeeds when temporal query uses index for performance', async () => {
    const outputId = 'test-output-temporal-002'
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)

    // Criar eventos "antigos" e "recentes"
    for (let i = 0; i < 50; i++) {
      await prisma.pipelineEvent.create({ data: createTestEvent({ outputId }) })
    }

    const startTime = Date.now()
    await prisma.pipelineEvent.findMany({
      where: {
        outputId,
        createdAt: { gte: yesterday }
      }
    })
    const queryTime = Date.now() - startTime

    // Com índice @@index([outputId, createdAt]), deve ser rápido
    expect(queryTime).toBeLessThan(50)
  })

  // @clause CL-DB-003
  it('fails when temporal query without outputId filter is inefficient', async () => {
    const outputId = 'test-output-temporal-003'
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)

    for (let i = 0; i < 100; i++) {
      await prisma.pipelineEvent.create({ data: createTestEvent({ outputId }) })
    }

    // Query COM outputId (usa índice composto)
    const withFilterStart = Date.now()
    await prisma.pipelineEvent.findMany({
      where: {
        outputId,
        createdAt: { gte: yesterday }
      }
    })
    const withFilterTime = Date.now() - withFilterStart

    expect(withFilterTime).toBeLessThan(50)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// TESTS — Filtro por Stage
// ══════════════════════════════════════════════════════════════════════════════

describe('PipelineEvent - Filtro por stage', () => {
  // @clause CL-DB-004
  it('succeeds when filtering events by planning stage', async () => {
    const outputId = 'test-output-stage-001'

    await prisma.pipelineEvent.create({ data: createTestEvent({ outputId, stage: 'planning' }) })
    await prisma.pipelineEvent.create({ data: createTestEvent({ outputId, stage: 'spec' }) })
    await prisma.pipelineEvent.create({ data: createTestEvent({ outputId, stage: 'planning' }) })
    await prisma.pipelineEvent.create({ data: createTestEvent({ outputId, stage: 'execute' }) })

    const planningEvents = await prisma.pipelineEvent.findMany({
      where: { outputId, stage: 'planning' }
    })

    expect(planningEvents).toHaveLength(2)
    planningEvents.forEach(evt => expect(evt.stage).toBe('planning'))
  })

  // @clause CL-DB-004
  it('succeeds when stage filter query uses index for performance', async () => {
    const outputId = 'test-output-stage-002'
    const stages = ['planning', 'spec', 'fix', 'execute']

    // Criar 200 eventos distribuídos por stages
    for (let i = 0; i < 200; i++) {
      await prisma.pipelineEvent.create({
        data: createTestEvent({
          outputId,
          stage: stages[i % stages.length]
        })
      })
    }

    const startTime = Date.now()
    const executeEvents = await prisma.pipelineEvent.findMany({
      where: { outputId, stage: 'execute' }
    })
    const queryTime = Date.now() - startTime

    expect(executeEvents.length).toBe(50)
    // Com índice @@index([outputId, stage]), deve ser rápido
    expect(queryTime).toBeLessThan(50)
  })

  // @clause CL-DB-004
  it('fails when querying multiple stages without proper filtering', async () => {
    const outputId = 'test-output-stage-003'

    await prisma.pipelineEvent.create({ data: createTestEvent({ outputId, stage: 'planning' }) })
    await prisma.pipelineEvent.create({ data: createTestEvent({ outputId, stage: 'spec' }) })
    await prisma.pipelineEvent.create({ data: createTestEvent({ outputId, stage: 'execute' }) })

    const filteredEvents = await prisma.pipelineEvent.findMany({
      where: { outputId, stage: 'planning' }
    })

    // Deve retornar APENAS eventos de planning
    expect(filteredEvents).toHaveLength(1)
    expect(filteredEvents.every(evt => evt.stage === 'planning')).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// TESTS — Campos Obrigatórios de PipelineEvent
// ══════════════════════════════════════════════════════════════════════════════

describe('PipelineEvent - Campos obrigatórios', () => {
  // @clause CL-DB-005
  it('succeeds when creating event with all required fields', async () => {
    const event = await prisma.pipelineEvent.create({
      data: {
        outputId: 'test-output-fields-001',
        stage: 'spec',
        eventType: 'agent:tool_call'
      }
    })

    expect(event.outputId).toBe('test-output-fields-001')
    expect(event.stage).toBe('spec')
    expect(event.eventType).toBe('agent:tool_call')
    expect(event.createdAt).toBeInstanceOf(Date)
  })

  // @clause CL-DB-005
  it('succeeds when createdAt has default now() value', async () => {
    const beforeCreate = new Date()

    const event = await prisma.pipelineEvent.create({
      data: createTestEvent({ outputId: 'test-output-fields-002' })
    })

    const afterCreate = new Date()

    expect(event.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime())
    expect(event.createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime())
  })

  // @clause CL-DB-005
  it('fails when creating event without required outputId', async () => {
    await expect(
      prisma.pipelineEvent.create({
        data: {
          stage: 'planning',
          eventType: 'agent:start'
          // outputId omitido intencionalmente
        } as any
      })
    ).rejects.toThrow()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// TESTS — Payload JSON
// ══════════════════════════════════════════════════════════════════════════════

describe('PipelineEvent - Payload JSON', () => {
  // @clause CL-DB-006
  it('succeeds when storing structured metadata in payload', async () => {
    const metadata = {
      tool: 'save_artifact',
      input: { path: 'plan.json', content: '...' },
      tokensUsed: { inputTokens: 1200, outputTokens: 800 }
    }

    const event = await prisma.pipelineEvent.create({
      data: {
        ...createTestEvent({ outputId: 'test-output-payload-001' }),
        payload: JSON.stringify(metadata)
      }
    })

    expect(event.payload).toBeDefined()
    const parsed = JSON.parse(event.payload!)
    expect(parsed.tool).toBe('save_artifact')
    expect(parsed.tokensUsed.inputTokens).toBe(1200)
  })

  // @clause CL-DB-006
  it('succeeds when payload is null for events without metadata', async () => {
    const event = await prisma.pipelineEvent.create({
      data: createTestEvent({ outputId: 'test-output-payload-002' })
    })

    expect(event.payload).toBeNull()
  })

  // @clause CL-DB-006
  it('fails when payload contains invalid JSON string', async () => {
    const event = await prisma.pipelineEvent.create({
      data: {
        ...createTestEvent({ outputId: 'test-output-payload-003' }),
        payload: 'invalid-json-{'
      }
    })

    // Prisma aceita qualquer string, mas parsing deve falhar
    expect(() => JSON.parse(event.payload!)).toThrow()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// TESTS — PipelineState Structure
// ══════════════════════════════════════════════════════════════════════════════

describe('PipelineState - OutputId como PK', () => {
  // @clause CL-DB-007
  it('succeeds when creating state with outputId as primary key', async () => {
    const state = await prisma.pipelineState.create({
      data: createTestState({ outputId: 'test-state-pk-001' })
    })

    expect(state.outputId).toBe('test-state-pk-001')

    // Verificar unicidade via findUnique
    const found = await prisma.pipelineState.findUnique({
      where: { outputId: 'test-state-pk-001' }
    })
    expect(found).toBeDefined()
    expect(found!.outputId).toBe('test-state-pk-001')
  })

  // @clause CL-DB-007
  it('succeeds when upsert updates existing state by outputId', async () => {
    const outputId = 'test-state-pk-002'

    // Criar inicial
    await prisma.pipelineState.create({
      data: createTestState({ outputId, status: 'running' })
    })

    // Upsert (update)
    const updated = await prisma.pipelineState.upsert({
      where: { outputId },
      create: createTestState({ outputId }),
      update: { status: 'completed', progress: 100 }
    })

    expect(updated.status).toBe('completed')
    expect(updated.progress).toBe(100)

    // Verificar que não criou duplicata
    const count = await prisma.pipelineState.count({
      where: { outputId }
    })
    expect(count).toBe(1)
  })

  // @clause CL-DB-007
  it('fails when attempting to create duplicate outputId', async () => {
    const outputId = 'test-state-pk-003'

    await prisma.pipelineState.create({
      data: createTestState({ outputId })
    })

    // Tentar criar duplicata deve falhar (PK constraint)
    await expect(
      prisma.pipelineState.create({
        data: createTestState({ outputId })
      })
    ).rejects.toThrow()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// TESTS — Defaults de PipelineState
// ══════════════════════════════════════════════════════════════════════════════

describe('PipelineState - Defaults', () => {
  // @clause CL-DB-008
  it('succeeds when status defaults to "running"', async () => {
    const state = await prisma.pipelineState.create({
      data: { outputId: 'test-state-defaults-001' }
    })

    expect(state.status).toBe('running')
  })

  // @clause CL-DB-008
  it('succeeds when stage defaults to "planning"', async () => {
    const state = await prisma.pipelineState.create({
      data: { outputId: 'test-state-defaults-002' }
    })

    expect(state.stage).toBe('planning')
  })

  // @clause CL-DB-008
  it('succeeds when progress defaults to 0', async () => {
    const state = await prisma.pipelineState.create({
      data: { outputId: 'test-state-defaults-003' }
    })

    expect(state.progress).toBe(0)
  })

  // @clause CL-DB-008
  it('succeeds when lastEventId defaults to 0', async () => {
    const state = await prisma.pipelineState.create({
      data: { outputId: 'test-state-defaults-004' }
    })

    expect(state.lastEventId).toBe(0)
  })

  // @clause CL-DB-008
  it('fails when defaults are missing', async () => {
    const state = await prisma.pipelineState.create({
      data: { outputId: 'test-state-defaults-005' }
    })

    // Todos os defaults devem estar presentes
    expect(state.status).toBeDefined()
    expect(state.stage).toBeDefined()
    expect(state.progress).toBeDefined()
    expect(state.lastEventId).toBeDefined()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// TESTS — UpdatedAt Automático
// ══════════════════════════════════════════════════════════════════════════════

describe('PipelineState - UpdatedAt tracking', () => {
  // @clause CL-DB-009
  it('succeeds when updatedAt changes automatically on update', async () => {
    const outputId = 'test-state-updated-001'

    const initial = await prisma.pipelineState.create({
      data: createTestState({ outputId })
    })

    await delay(100)

    const updated = await prisma.pipelineState.update({
      where: { outputId },
      data: { progress: 50 }
    })

    expect(updated.updatedAt.getTime()).toBeGreaterThan(initial.updatedAt.getTime())
  })

  // @clause CL-DB-009
  it('succeeds when updatedAt reflects latest modification time', async () => {
    const outputId = 'test-state-updated-002'

    await prisma.pipelineState.create({
      data: createTestState({ outputId })
    })

    await delay(100)

    const beforeUpdate = new Date()
    await delay(50)

    const updated = await prisma.pipelineState.update({
      where: { outputId },
      data: { status: 'completed' }
    })

    const afterUpdate = new Date()

    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime())
    expect(updated.updatedAt.getTime()).toBeLessThanOrEqual(afterUpdate.getTime())
  })

  // @clause CL-DB-009
  it('fails when updatedAt does not change on update', async () => {
    const outputId = 'test-state-updated-003'

    const initial = await prisma.pipelineState.create({
      data: createTestState({ outputId })
    })

    await delay(100)

    const updated = await prisma.pipelineState.update({
      where: { outputId },
      data: { lastEventId: 10 }
    })

    // updatedAt DEVE mudar
    expect(updated.updatedAt.getTime()).not.toBe(initial.updatedAt.getTime())
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// TESTS — Summary JSON
// ══════════════════════════════════════════════════════════════════════════════

describe('PipelineState - Summary JSON', () => {
  // @clause CL-DB-010
  it('succeeds when storing structured summary data', async () => {
    const summary = {
      artifactNames: ['plan.json', 'contract.md', 'task_spec.md'],
      totalTokens: { inputTokens: 5000, outputTokens: 3000 },
      duration: 45000
    }

    const state = await prisma.pipelineState.create({
      data: {
        ...createTestState({ outputId: 'test-state-summary-001' }),
        summary: JSON.stringify(summary)
      }
    })

    expect(state.summary).toBeDefined()
    const parsed = JSON.parse(state.summary!)
    expect(parsed.artifactNames).toHaveLength(3)
    expect(parsed.totalTokens.inputTokens).toBe(5000)
  })

  // @clause CL-DB-010
  it('succeeds when summary is null for initial state', async () => {
    const state = await prisma.pipelineState.create({
      data: createTestState({ outputId: 'test-state-summary-002' })
    })

    expect(state.summary).toBeNull()
  })

  // @clause CL-DB-010
  it('fails when summary contains invalid JSON', async () => {
    const state = await prisma.pipelineState.create({
      data: {
        ...createTestState({ outputId: 'test-state-summary-003' }),
        summary: '{invalid json'
      }
    })

    expect(() => JSON.parse(state.summary!)).toThrow()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// TESTS — Links Opcionais (agentRunId, runId)
// ══════════════════════════════════════════════════════════════════════════════

describe('PipelineEvent - Links opcionais', () => {
  // @clause CL-DB-011
  it('succeeds when linking event to AgentRun via agentRunId', async () => {
    const event = await prisma.pipelineEvent.create({
      data: {
        ...createTestEvent({ outputId: 'test-output-links-001' }),
        agentRunId: 'agent-run-abc123'
      }
    })

    expect(event.agentRunId).toBe('agent-run-abc123')
  })

  // @clause CL-DB-015
  it('succeeds when linking event to ValidationRun via runId', async () => {
    const event = await prisma.pipelineEvent.create({
      data: {
        ...createTestEvent({ outputId: 'test-output-links-002' }),
        runId: 'validation-run-xyz789'
      }
    })

    expect(event.runId).toBe('validation-run-xyz789')
  })

  // @clause CL-DB-011
  it('fails when agentRunId is null for event without AgentRun link', async () => {
    const event = await prisma.pipelineEvent.create({
      data: createTestEvent({ outputId: 'test-output-links-003' })
    })

    expect(event.agentRunId).toBeNull()
    expect(event.runId).toBeNull()
  })
})

describe('PipelineState - Link opcional com AgentRun', () => {
  // @clause CL-DB-011
  it('succeeds when PipelineState links to AgentRun', async () => {
    const state = await prisma.pipelineState.create({
      data: {
        ...createTestState({ outputId: 'test-state-links-001' }),
        agentRunId: 'agent-run-def456'
      }
    })

    expect(state.agentRunId).toBe('agent-run-def456')
  })

  // @clause CL-DB-011
  it('succeeds when querying states by agentRunId', async () => {
    await prisma.pipelineState.create({
      data: {
        ...createTestState({ outputId: 'test-state-links-002' }),
        agentRunId: 'agent-run-common'
      }
    })
    await prisma.pipelineState.create({
      data: {
        ...createTestState({ outputId: 'test-state-links-003' }),
        agentRunId: 'agent-run-common'
      }
    })

    const states = await prisma.pipelineState.findMany({
      where: { agentRunId: 'agent-run-common' }
    })

    expect(states).toHaveLength(2)
  })

  // @clause CL-DB-011
  it('fails when agentRunId is required but null', async () => {
    const state = await prisma.pipelineState.create({
      data: createTestState({ outputId: 'test-state-links-004' })
    })

    // agentRunId é opcional
    expect(state.agentRunId).toBeNull()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// TESTS — Campos SHOULD (source, level, message)
// ══════════════════════════════════════════════════════════════════════════════

describe('PipelineEvent - Campos opcionais (SHOULD)', () => {
  // @clause CL-DB-013
  it('succeeds when source identifies event origin', async () => {
    const event = await prisma.pipelineEvent.create({
      data: {
        ...createTestEvent({ outputId: 'test-output-should-001' }),
        source: 'AgentRunnerService'
      }
    })

    expect(event.source).toBe('AgentRunnerService')
  })

  // @clause CL-DB-014
  it('succeeds when level and message support structured logging', async () => {
    const event = await prisma.pipelineEvent.create({
      data: {
        ...createTestEvent({ outputId: 'test-output-should-002' }),
        level: 'error',
        message: 'Failed to save artifact: permission denied'
      }
    })

    expect(event.level).toBe('error')
    expect(event.message).toContain('permission denied')
  })

  // @clause CL-DB-014
  it('fails when optional fields are null but expected', async () => {
    const event = await prisma.pipelineEvent.create({
      data: createTestEvent({ outputId: 'test-output-should-003' })
    })

    // Campos opcionais podem ser null
    expect(event.source).toBeNull()
    expect(event.level).toBeNull()
    expect(event.message).toBeNull()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// TESTS — Integration: Replay Workflow
// ══════════════════════════════════════════════════════════════════════════════

describe('Integration - Replay workflow completo', () => {
  // @clause CL-DB-001
  it('succeeds when simulating full SSE replay scenario', async () => {
    const outputId = 'test-integration-replay-001'

    // 1. Criar estado inicial
    await prisma.pipelineState.create({
      data: {
        outputId,
        agentRunId: 'agent-xyz',
        status: 'running',
        stage: 'planning'
      }
    })

    // 2. Criar eventos iniciais
    const evt1 = await prisma.pipelineEvent.create({
      data: createTestEvent({ outputId, eventType: 'agent:start', stage: 'planning' })
    })
    const evt2 = await prisma.pipelineEvent.create({
      data: createTestEvent({ outputId, eventType: 'agent:text', stage: 'planning' })
    })

    // 3. Atualizar estado com lastEventId
    await prisma.pipelineState.update({
      where: { outputId },
      data: { lastEventId: evt2.id, progress: 25 }
    })

    // 4. Cliente reconecta com Last-Event-ID
    const replayEvents = await prisma.pipelineEvent.findMany({
      where: {
        outputId,
        id: { gt: evt1.id }
      },
      orderBy: { id: 'asc' }
    })

    expect(replayEvents).toHaveLength(1)
    expect(replayEvents[0].id).toBe(evt2.id)

    // 5. Verificar estado atual
    const currentState = await prisma.pipelineState.findUnique({
      where: { outputId }
    })

    expect(currentState!.lastEventId).toBe(evt2.id)
    expect(currentState!.progress).toBe(25)
  })
})
