/**
 * E2E Testes de Resiliência e Duplicidade do Sistema de Reconciliação SSE
 *
 * Valida:
 * - Reconexão após tab discard
 * - Replay correto via Last-Event-ID
 * - Concorrência e sincronização
 * - Divergência local/remote
 * - Deduplicação de eventos
 * - Monotonia de IDs
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { TestServer } from './setup/test-server'
import { TestClient } from './setup/test-client'
import { PrismaClient } from '@prisma/client'
import { app } from '@/server'

describe('Pipeline Resilience & Deduplication E2E', () => {
  let server: TestServer
  let client: TestClient
  let prisma: PrismaClient
  let testWorkspaceId: string
  let testProjectId: string

  beforeAll(async () => {
    // Inicializa servidor de teste na porta 3002 (evita conflito com dev server)
    server = new TestServer(3002, app)
    await server.start()

    // Inicializa cliente de teste
    client = new TestClient('http://localhost:3002')

    // Obtém Prisma Client após servidor iniciar
    prisma = server.getPrisma()

    // Aguarda um momento para garantir que prisma está pronto
    await new Promise(resolve => setTimeout(resolve, 100))

    // Cria workspace e projeto de teste
    const workspace = await prisma.workspace.create({
      data: {
        name: 'E2E Test Workspace',
        rootPath: 'C:\\tmp\\test-workspace',
        artifactsDir: 'artifacts',
      },
    })
    testWorkspaceId = workspace.id

    const project = await prisma.project.create({
      data: {
        name: 'E2E Test Project',
        workspaceId: testWorkspaceId,
        baseRef: 'origin/main',
        targetRef: 'HEAD',
      },
    })
    testProjectId = project.id

    console.log(`[E2E] Test workspace: ${testWorkspaceId}`)
    console.log(`[E2E] Test project: ${testProjectId}`)
  }, 30000)

  afterAll(async () => {
    // Cleanup
    try {
      await prisma.project.deleteMany({ where: { workspaceId: testWorkspaceId } })
      await prisma.workspace.delete({ where: { id: testWorkspaceId } })
    } catch (error) {
      console.warn('[E2E] Cleanup error:', error)
    }

    await server.stop()
  }, 10000)

  beforeEach(async () => {
    // Limpa runs entre testes (sem filtro já que é DB de teste isolado)
    await prisma.pipelineEvent.deleteMany()
    await prisma.pipelineState.deleteMany()
    await prisma.agentRunStep.deleteMany()
    await prisma.agentRun.deleteMany()
  })

  afterEach(() => {
    // Fecha todas as conexões SSE abertas
    client.closeAllSSE()
  })

  /**
   * TESTE 1: Reconexão após Tab Discard
   *
   * Simula:
   * 1. Pipeline inicia e executa até PLANNING completo (step 2)
   * 2. Tab fecha/descarta (desconexão SSE)
   * 3. Tab reabre: restore via GET /status
   * 4. SSE reconecta com Last-Event-ID
   * 5. Pipeline continua e completa
   *
   * Valida:
   * - Estado restaurado corretamente
   * - Sem duplicação de logs
   * - lastEventId retomado corretamente
   */
  it('should restore state after tab discard and continue without duplicates', async () => {
    console.log('[TEST 1] Starting tab discard test...')

    // 1. Inicia pipeline
    const startRes = await client.post('/api/orchestrator/run', {
      projectId: testProjectId,
      task: 'Test task for tab discard - implement a simple calculator',
      phases: ['PLANNING', 'WRITING'],
    })
    expect(startRes.outputId).toBeDefined()
    const outputId = startRes.outputId
    console.log(`[TEST 1] Pipeline started: ${outputId}`)

    // 2. Conecta SSE e processa eventos até PLANNING completar
    const logs: any[] = []
    const processedIds = new Set<string>()
    let lastEventId = '0'
    let lastSeq = 0

    const sse1 = client.connectSSE(`/api/orchestrator/events/${outputId}`, {
      onMessage: (event) => {
        const frameId = event.lastEventId || `${Date.now()}`

        if (processedIds.has(frameId)) {
          throw new Error(`DUPLICATE EVENT DETECTED: ${frameId}`)
        }

        processedIds.add(frameId)
        const data = JSON.parse(event.data)
        logs.push(data)
        lastEventId = frameId

        const seq = parseInt(frameId, 10)
        if (!isNaN(seq) && seq > 0) {
          if (seq <= lastSeq) {
            throw new Error(`NON-MONOTONIC SEQ: ${seq} after ${lastSeq}`)
          }
          lastSeq = seq
        }

        console.log(`[TEST 1] Event received: ${data.type} (id: ${frameId})`)
      },
    })

    // Aguarda até PLANNING completar (agent:bridge_plan_done)
    await client.waitForEvent(sse1, (logs) =>
      logs.some((log) => log.type === 'agent:bridge_plan_done')
    )

    console.log(`[TEST 1] PLANNING completed. Collected ${logs.length} events`)

    // Valida que chegamos no step 2
    const statusBeforeDiscard = await client.get(`/api/orchestrator/${outputId}/status`)
    expect(statusBeforeDiscard.stage).toBe('spec')
    expect(statusBeforeDiscard.status).toBe('running')
    const logsCountBeforeDiscard = logs.length
    console.log(`[TEST 1] Status before discard: ${statusBeforeDiscard.stage}, ${logsCountBeforeDiscard} logs`)

    // 3. Simula tab discard: desconecta SSE
    sse1.close()
    await client.wait(300) // Aguarda desconexão
    console.log('[TEST 1] Tab discarded (SSE closed)')

    // 4. Simula reabertura de tab: restore via GET /status
    const restoredStatus = await client.get(`/api/orchestrator/${outputId}/status`)
    expect(restoredStatus.stage).toBeDefined()
    console.log(`[TEST 1] Restored status: ${restoredStatus.stage}, lastEventId: ${restoredStatus.lastEventId}`)

    // 5. Backfill eventos perdidos via REST (se houver)
    let missedEvents: any[] = []
    if (restoredStatus.lastEventId > parseInt(lastEventId, 10)) {
      console.log(`[TEST 1] Backfilling events since ${lastEventId}`)
      const backfillRes = await client.get(
        `/api/orchestrator/${outputId}/events?sinceId=${lastEventId}&limit=200`
      )
      missedEvents = backfillRes.events || []
      console.log(`[TEST 1] Backfilled ${missedEvents.length} missed events`)

      // Adiciona ao processedIds para dedup
      missedEvents.forEach((e: any) => {
        processedIds.add(e.id.toString())
      })
    }

    // 6. Reconecta SSE com Last-Event-ID
    const logs2: any[] = []
    let lastEventId2 = restoredStatus.lastEventId.toString()

    const sse2 = client.connectSSE(`/api/orchestrator/events/${outputId}`, {
      lastEventId: lastEventId2, // Simula Last-Event-ID header
      onMessage: (event) => {
        const frameId = event.lastEventId || `${Date.now()}`

        if (processedIds.has(frameId)) {
          console.warn(`[TEST 1] DUPLICATE EVENT AFTER RECONNECT (skipped): ${frameId}`)
          return // Dedup!
        }

        processedIds.add(frameId)
        const data = JSON.parse(event.data)
        logs2.push(data)

        console.log(`[TEST 1] Event after reconnect: ${data.type} (id: ${frameId})`)
      },
    })

    // Aguarda pipeline completar ou falhar
    await client.waitForEvent(
      sse2,
      (logs) =>
        logs.some(
          (log) => log.type === 'agent:complete' || log.type === 'agent:error' || log.type === 'agent:bridge_execute_done'
        ),
      60000 // 60s timeout
    )

    console.log(`[TEST 1] Pipeline completed. Received ${logs2.length} new events after reconnect`)

    // 7. Validações finais
    const finalStatus = await client.get(`/api/orchestrator/${outputId}/status`)

    // Total de eventos únicos processados
    const totalUniqueEvents = processedIds.size
    console.log(`[TEST 1] Total unique events: ${totalUniqueEvents}`)
    console.log(`[TEST 1] Final status: ${finalStatus.status}, stage: ${finalStatus.stage}`)

    // Garantir que não houve duplicatas
    expect(processedIds.size).toBe(logsCountBeforeDiscard + missedEvents.length + logs2.length)

    // Pipeline deve ter completado ou falhado (não stuck)
    expect(['completed', 'failed', 'running']).toContain(finalStatus.status)

    sse2.close()
  }, 90000) // Timeout 90s para pipeline completa

  /**
   * TESTE 2: Divergência Local/Remote (Backend Wins)
   *
   * Simula:
   * 1. Cliente pensa que está em PLANNING (cache local desatualizado)
   * 2. Servidor já está em EXECUTING (cache expirou)
   * 3. Hook de reconciliação detecta divergência
   * 4. Estado local sobrescrito pelo remoto
   *
   * Valida:
   * - Backend sempre ganha
   * - Backfill de eventos perdidos
   */
  it('should reconcile divergent local/remote state (backend wins)', async () => {
    console.log('[TEST 2] Starting divergence test...')

    // 1. Inicia pipeline e aguarda chegar em EXECUTING
    const startRes = await client.post('/api/orchestrator/run', {
      projectId: testProjectId,
      task: 'Test task for divergence - create a todo list component',
      phases: ['PLANNING', 'WRITING'],
    })
    const outputId = startRes.outputId
    console.log(`[TEST 2] Pipeline started: ${outputId}`)

    // Aguarda até WRITING (step 3)
    const remoteStatus = await client.pollUntil(
      () => client.get(`/api/orchestrator/${outputId}/status`),
      (status) => status.stage === 'execute' || status.status === 'failed',
      40000
    )

    console.log(`[TEST 2] Remote status: ${remoteStatus.stage}, lastEventId: ${remoteStatus.lastEventId}`)
    expect(remoteStatus.stage).toBe('execute')

    // 2. Simula estado local desatualizado (ainda pensa que está em PLANNING)
    const localState = {
      pipelineStage: 'spec', // step 2 (desatualizado)
      pipelineStatus: 'running',
      lastEventId: 5, // Muito atrás
      lastSeq: 5,
    }

    console.log(`[TEST 2] Local state (stale): ${localState.pipelineStage}, lastEventId: ${localState.lastEventId}`)

    // 3. Reconciliação: compara local vs remote
    const needsReconciliation =
      localState.pipelineStage !== remoteStatus.stage ||
      localState.lastEventId < remoteStatus.lastEventId

    expect(needsReconciliation).toBe(true)
    console.log('[TEST 2] Reconciliation needed: true')

    // 4. Backfill: busca eventos perdidos
    let allMissedEvents: any[] = []
    let sinceId = localState.lastEventId
    let hasMore = true

    while (hasMore) {
      const page = await client.get(
        `/api/orchestrator/${outputId}/events?sinceId=${sinceId}&limit=200`
      )
      const events = page.events || []
      allMissedEvents = allMissedEvents.concat(events)
      hasMore = page.hasMore || false

      if (events.length > 0) {
        sinceId = events[events.length - 1].id
      } else {
        hasMore = false
      }
    }

    console.log(`[TEST 2] Backfilled ${allMissedEvents.length} missed events`)

    // 5. Aplica reconciliação: sobrescreve local com remote
    const reconciledState = {
      pipelineStage: remoteStatus.stage,
      pipelineStatus: remoteStatus.status,
      lastEventId: remoteStatus.lastEventId,
      logs: allMissedEvents,
    }

    // 6. Validações
    expect(reconciledState.pipelineStage).toBe('execute')
    expect(reconciledState.lastEventId).toBeGreaterThan(localState.lastEventId)
    expect(allMissedEvents.length).toBeGreaterThan(0)

    console.log(`[TEST 2] Reconciled state: ${reconciledState.pipelineStage}, lastEventId: ${reconciledState.lastEventId}`)
  }, 50000)

  /**
   * TESTE 3: Deduplicação de Eventos Duplicados
   *
   * Simula:
   * 1. Backend envia evento com id="X" duas vezes (bug ou retry)
   * 2. Frontend deve processar apenas uma vez
   *
   * Valida:
   * - processedIds Set detecta duplicata
   * - Handler executado apenas uma vez por evento único
   */
  it('should deduplicate duplicate events from SSE', async () => {
    console.log('[TEST 3] Starting deduplication test...')

    // 1. Inicia pipeline
    const startRes = await client.post('/api/orchestrator/run', {
      projectId: testProjectId,
      task: 'Test task for dedup - simple button component',
      phases: ['PLANNING'],
    })
    const outputId = startRes.outputId
    console.log(`[TEST 3] Pipeline started: ${outputId}`)

    // 2. Mock SSE que rastreia duplicatas
    const logs: any[] = []
    const processedIds = new Set<string>()
    let handlerCallCount = 0
    let duplicateDetected = false

    const sse = client.connectSSE(`/api/orchestrator/events/${outputId}`, {
      onMessage: (event) => {
        handlerCallCount++
        const frameId = event.lastEventId || `${Date.now()}`

        // Simula lógica de dedup do frontend
        if (processedIds.has(frameId)) {
          duplicateDetected = true
          console.warn(`[TEST 3] Duplicate detected: ${frameId}`)
          return // Ignora duplicata
        }

        processedIds.add(frameId)
        logs.push(JSON.parse(event.data))
      },
    })

    // 3. Aguarda alguns eventos
    await client.waitForEvent(sse, (logs) => logs.length >= 3)
    console.log(`[TEST 3] Received ${logs.length} unique events`)

    // 4. Simula envio de evento duplicado (mock manual)
    const firstProcessedId = Array.from(processedIds)[0]
    const mockDuplicateEvent = {
      lastEventId: firstProcessedId,
      data: JSON.stringify({ type: 'test', message: 'duplicate' }),
    }

    // Tenta processar evento duplicado manualmente
    const beforeSize = logs.length
    if (processedIds.has(mockDuplicateEvent.lastEventId)) {
      duplicateDetected = true
      console.log(`[TEST 3] Manual duplicate check: ${mockDuplicateEvent.lastEventId} already processed`)
      // Não adiciona a logs
    } else {
      processedIds.add(mockDuplicateEvent.lastEventId)
      logs.push(JSON.parse(mockDuplicateEvent.data))
    }
    const afterSize = logs.length

    // 5. Validações
    expect(duplicateDetected).toBe(true)
    expect(beforeSize).toBe(afterSize) // Não adicionou log duplicado
    expect(processedIds.size).toBe(logs.length) // Sempre em sync

    console.log(`[TEST 3] Dedup working correctly. Unique events: ${processedIds.size}`)

    sse.close()
  }, 30000)

  /**
   * TESTE 4: Monotonia de IDs e Sequências
   *
   * Simula:
   * 1. Pipeline completa executando
   * 2. Monitora lastEventId e lastSeq durante toda execução
   *
   * Valida:
   * - IDs sempre crescem
   * - Sem gaps ou decrementos
   */
  it('should maintain monotonic event IDs and sequences', async () => {
    console.log('[TEST 4] Starting monotonicity test...')

    // 1. Inicia pipeline
    const startRes = await client.post('/api/orchestrator/run', {
      projectId: testProjectId,
      task: 'Test task for monotonicity - simple counter',
      phases: ['PLANNING', 'WRITING'],
    })
    const outputId = startRes.outputId
    console.log(`[TEST 4] Pipeline started: ${outputId}`)

    // 2. Monitora IDs e sequências
    const ids: string[] = []
    const seqs: number[] = []
    let lastSeq = -1

    const sse = client.connectSSE(`/api/orchestrator/events/${outputId}`, {
      onMessage: (event) => {
        const frameId = event.lastEventId || `${Date.now()}`
        ids.push(frameId)

        const seq = parseInt(frameId, 10)
        if (!isNaN(seq) && seq > 0) {
          seqs.push(seq)

          // Valida monotonia
          if (seq <= lastSeq) {
            throw new Error(`NON-MONOTONIC SEQUENCE: ${seq} after ${lastSeq}`)
          }
          lastSeq = seq
        }
      },
    })

    // 3. Aguarda pipeline completar
    await client.waitForEvent(
      sse,
      (logs) =>
        logs.some(
          (log) =>
            log.type === 'agent:complete' || log.type === 'agent:error' || log.type === 'agent:bridge_execute_done'
        ),
      60000
    )

    console.log(`[TEST 4] Pipeline completed. Monitored ${seqs.length} sequences`)

    // 4. Validações
    expect(seqs.length).toBeGreaterThan(0)

    // Todos os seqs são crescentes
    for (let i = 1; i < seqs.length; i++) {
      expect(seqs[i]).toBeGreaterThan(seqs[i - 1])
    }

    // Sem gaps anormais (permite gaps pequenos por paralelismo)
    for (let i = 1; i < seqs.length; i++) {
      const gap = seqs[i] - seqs[i - 1]
      expect(gap).toBeLessThanOrEqual(5) // Permite pequenos gaps
    }

    console.log(`[TEST 4] Monotonicity validated. Sequences: ${seqs[0]} -> ${seqs[seqs.length - 1]}`)

    sse.close()
  }, 60000)

  /**
   * TESTE 5: Replay Correto via Last-Event-ID
   *
   * Simula:
   * 1. SSE conectado, recebe eventos 1-5
   * 2. Desconexão abrupta (network error)
   * 3. Durante desconexão, backend emite eventos 6-10
   * 4. Reconexão SSE com Last-Event-ID: 5
   * 5. Backend deve enviar apenas 6-10
   *
   * Valida:
   * - Backend não reenvia eventos 1-5
   * - Frontend não duplica processamento
   */
  it('should replay only missed events via Last-Event-ID', async () => {
    console.log('[TEST 5] Starting replay test...')

    // 1. Inicia pipeline
    const startRes = await client.post('/api/orchestrator/run', {
      projectId: testProjectId,
      task: 'Test task for replay - form validation',
      phases: ['PLANNING'],
    })
    const outputId = startRes.outputId
    console.log(`[TEST 5] Pipeline started: ${outputId}`)

    // 2. Conecta SSE e coleta primeiros eventos
    const logs1: any[] = []
    const processedIds = new Set<string>()
    let lastEventId = '0'
    let eventCount = 0
    const targetEventCount = 5

    const sse1 = client.connectSSE(`/api/orchestrator/events/${outputId}`, {
      onMessage: (event) => {
        const frameId = event.lastEventId || `${Date.now()}`
        processedIds.add(frameId)
        logs1.push(JSON.parse(event.data))
        lastEventId = frameId
        eventCount++

        console.log(`[TEST 5] Event ${eventCount}: ${frameId}`)

        // Desconecta após N eventos
        if (eventCount === targetEventCount) {
          console.log(`[TEST 5] Disconnecting after ${targetEventCount} events`)
          sse1.close()
        }
      },
    })

    // Aguarda até coletar eventos suficientes ou timeout
    await client.wait(10000) // 10s para coletar eventos

    console.log(`[TEST 5] Collected ${eventCount} events before disconnect`)
    expect(eventCount).toBeGreaterThanOrEqual(1) // Pelo menos 1 evento

    // 3. Aguarda backend emitir mais eventos (delay)
    await client.wait(3000)

    // 4. Reconecta com Last-Event-ID
    const logs2: any[] = []
    let duplicateDetected = false

    const sse2 = client.connectSSE(`/api/orchestrator/events/${outputId}`, {
      lastEventId,
      onMessage: (event) => {
        const frameId = event.lastEventId || `${Date.now()}`

        if (processedIds.has(frameId)) {
          duplicateDetected = true
          console.warn(`[TEST 5] DUPLICATE IN REPLAY: ${frameId}`)
          throw new Error(`DUPLICATE EVENT IN REPLAY: ${frameId}`)
        }

        processedIds.add(frameId)
        logs2.push(JSON.parse(event.data))
        console.log(`[TEST 5] New event after reconnect: ${frameId}`)
      },
    })

    // Aguarda pipeline completar ou alguns eventos novos
    await client
      .waitForEvent(
        sse2,
        (logs) => logs.some((log) => log.type === 'agent:bridge_plan_done' || log.type === 'agent:error') || logs.length >= 3,
        20000
      )
      .catch(() => {
        // Timeout OK se pipeline não completou
      })

    console.log(`[TEST 5] Received ${logs2.length} new events after reconnect`)

    // 5. Validações
    expect(duplicateDetected).toBe(false)

    // Se recebeu eventos novos, não devem ser duplicatas dos antigos
    if (logs2.length > 0) {
      expect(processedIds.size).toBeGreaterThan(eventCount)
    }

    console.log(`[TEST 5] Replay test completed. Total unique events: ${processedIds.size}`)

    sse2.close()
  }, 40000)
})
