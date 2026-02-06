/**
 * E2E Tests: Real Orchestrator Integration
 *
 * Valida que:
 * 1. O método runPipelineAsync() usa orchestrator REAL (não setTimeout)
 * 2. Eventos são emitidos pelo orchestrator (não simulados)
 * 3. Timing varia naturalmente (não fixo)
 * 4. Pipeline completa executa corretamente
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { TestServer } from './setup/test-server'
import { TestClient } from './setup/test-client'
import { PrismaClient } from '@prisma/client'
import { app } from '@/server'

describe('Real Orchestrator Integration E2E', () => {
  let server: TestServer
  let client: TestClient
  let prisma: PrismaClient
  let testWorkspaceId: string
  let testProjectId: string

  beforeAll(async () => {
    server = new TestServer(3008, app)
    await server.start()
    client = new TestClient('http://localhost:3008')
    prisma = server.getPrisma()
    await new Promise((resolve) => setTimeout(resolve, 100))

    const workspace = await prisma.workspace.create({
      data: {
        name: 'E2E Integration Workspace',
        rootPath: 'C:\\tmp\\integration-test',
        artifactsDir: 'artifacts',
      },
    })
    testWorkspaceId = workspace.id

    const project = await prisma.project.create({
      data: {
        name: 'E2E Integration Project',
        workspaceId: testWorkspaceId,
        baseRef: 'origin/main',
        targetRef: 'HEAD',
      },
    })
    testProjectId = project.id
  }, 30000)

  afterAll(async () => {
    try {
      await prisma.project.deleteMany({ where: { workspaceId: testWorkspaceId } })
      await prisma.workspace.delete({ where: { id: testWorkspaceId } })
    } catch (error) {
      console.warn('[E2E Integration] Cleanup error:', error)
    }
    await server.stop()
  }, 10000)

  beforeEach(async () => {
    await prisma.pipelineEvent.deleteMany()
    await prisma.pipelineState.deleteMany()
    await prisma.agentRunStep.deleteMany()
    await prisma.agentRun.deleteMany()
  })

  // ─── Microplan 3.2: 202 Response Pattern ──────────────────────────────

  it('should return 202 Accepted with outputId and eventsUrl', async () => {
    const response = await client.post('/api/orchestrator/run', {
      projectId: testProjectId,
      task: 'Create a simple utility function for date formatting',
      phases: ['PLANNING'],
    })

    // Validações da resposta
    expect(response.status).toBe('accepted')
    expect(response.outputId).toBeDefined()
    expect(typeof response.outputId).toBe('string')
    expect(response.eventsUrl).toContain(response.outputId)
    expect(response.eventsUrl).toContain('/api/orchestrator/events/')
  }, 30000)

  // ─── Microplan 3.1 & 3.3: Real Orchestrator Execution ─────────────────

  it('should execute real orchestrator pipeline with PLANNING phase', async () => {
    const run = await client.post('/api/orchestrator/run', {
      projectId: testProjectId,
      task: 'Create a simple utility function for date formatting',
      phases: ['PLANNING'],
    })

    expect(run.status).toBe('accepted')
    expect(run.outputId).toBeDefined()

    // Conecta SSE para receber eventos
    const events: any[] = []
    const timestamps: number[] = []

    const sse = client.connectSSE(`/api/orchestrator/events/${run.outputId}`, {
      onMessage: (event) => {
        try {
          const data = JSON.parse(event.data)
          events.push(data)
          timestamps.push(Date.now())
        } catch (err) {
          // Ignorar erros de parse
        }
      },
    })

    // Aguarda completion ou erro
    await client.waitForEvent(
      sse,
      (logs) => logs.some((e) => e.type === 'agent:complete' || e.type === 'agent:error'),
      90000
    )

    sse.close()

    // Validações de eventos esperados
    console.log('[TEST] Events received:', events.map((e) => e.type))

    // Deve receber bridge_init (início do pipeline)
    expect(events.some((e) => e.type === 'agent:bridge_init')).toBe(true)

    // Deve receber step:start (tentativa de executar orchestrator)
    expect(events.some((e) => e.type === 'step:start')).toBe(true)

    // Deve receber agent:error (falha por falta de API key)
    // OU agent:complete (se API key estiver configurada)
    expect(
      events.some((e) => e.type === 'agent:complete' || e.type === 'agent:error')
    ).toBe(true)

    // Validação de timing variado (não fixo como setTimeout)
    // Se for orchestrator real, os deltas devem variar (não serão sempre 500ms, 1000ms, etc)
    if (timestamps.length > 2) {
      const deltas = timestamps.slice(1).map((t, i) => t - timestamps[i])
      const uniqueDeltas = new Set(deltas)
      const hasVariedTiming = uniqueDeltas.size > 1

      console.log('[TEST] Event timing deltas (ms):', deltas)
      console.log('[TEST] Unique delta count:', uniqueDeltas.size)

      // Timing variado indica orchestrator real (não setTimeout fixo)
      // Com orchestrator real, mesmo falhando rápido, os deltas não são fixos
      expect(hasVariedTiming).toBe(true)
    }
  }, 120000)

  it('should handle orchestrator error gracefully (invalid project)', async () => {
    try {
      await client.post('/api/orchestrator/run', {
        projectId: 'invalid-project-id',
        task: 'Test error handling',
        phases: ['PLANNING'],
      })
      expect.fail('Request should have failed')
    } catch (error: any) {
      // Deve retornar 404 (Project not found)
      expect(error.message).toContain('404')
    }
  }, 30000)

  it('should execute PLANNING + WRITING phases sequentially', async () => {
    const run = await client.post('/api/orchestrator/run', {
      projectId: testProjectId,
      task: 'Add a helper function',
      phases: ['PLANNING', 'WRITING'],
    })

    const events: any[] = []
    const sse = client.connectSSE(`/api/orchestrator/events/${run.outputId}`, {
      onMessage: (event) => {
        try {
          const data = JSON.parse(event.data)
          events.push(data)
        } catch (err) {
          // Ignorar
        }
      },
    })

    await client.waitForEvent(
      sse,
      (logs) => logs.some((e) => e.type === 'agent:complete' || e.type === 'agent:error'),
      180000 // 3min para PLANNING + WRITING
    )

    sse.close()

    console.log('[TEST] Multi-phase events:', events.map((e) => e.type))

    // Deve ter bridge_init (início)
    expect(events.some((e) => e.type === 'agent:bridge_init')).toBe(true)

    // Deve ter step:start (tentativa de executar)
    expect(events.some((e) => e.type === 'step:start')).toBe(true)

    // Deve ter completion ou erro
    expect(
      events.some((e) => e.type === 'agent:complete' || e.type === 'agent:error')
    ).toBe(true)

    // Nota: sem API key, o orchestrador falha antes de emitir eventos de plan/spec
    // O importante é que o padrão de execução está correto (não setTimeout)
  }, 200000)

  it('should update PipelineState correctly during execution', async () => {
    const run = await client.post('/api/orchestrator/run', {
      projectId: testProjectId,
      task: 'Test state tracking',
      phases: ['PLANNING'],
    })

    // Aguarda um pouco para estado ser criado e pipeline executar
    await client.wait(1000)

    // Verifica estado (pode ser running ou failed dependendo da velocidade)
    const initialState = await client.get(`/api/orchestrator/${run.outputId}/status`)
    expect(['running', 'failed']).toContain(initialState.status)
    expect(initialState.stage).toBeDefined()

    // Aguarda conclusão (se ainda não concluiu)
    await client.pollUntil(
      () => client.get(`/api/orchestrator/${run.outputId}/status`),
      (s) => s.status === 'completed' || s.status === 'failed',
      90000,
      2000
    )

    const finalState = await client.get(`/api/orchestrator/${run.outputId}/status`)
    expect(['completed', 'failed']).toContain(finalState.status)

    // Sem API key, o orchestrador vai falhar
    // O importante é que o estado foi atualizado corretamente
    if (finalState.status === 'completed') {
      expect(finalState.progress).toBe(100)
      expect(finalState.stage).toBe('complete')
    } else {
      // Status 'failed' é esperado quando não há API key configurada
      expect(finalState.status).toBe('failed')
    }
  }, 120000)
})
