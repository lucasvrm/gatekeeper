/**
 * TEMPLATE: Como criar novos testes E2E de resiliência
 *
 * Este arquivo é um exemplo/template - não será executado nos testes
 * Copie e adapte para criar novos casos de teste
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { TestServer } from './setup/test-server'
import { TestClient } from './setup/test-client'
import { PrismaClient } from '@prisma/client'
import { app } from '@/server'

describe('Meu Novo Teste E2E', () => {
  let server: TestServer
  let client: TestClient
  let prisma: PrismaClient
  let testProjectId: string

  // ──────────────────────────────────────────────────────────────────────
  // Setup: Executado UMA VEZ antes de todos os testes desta suite
  // ──────────────────────────────────────────────────────────────────────
  beforeAll(async () => {
    // 1. Inicia servidor de teste isolado (porta 3001)
    server = new TestServer(3001, app)
    await server.start()

    // 2. Cria cliente HTTP/SSE
    client = new TestClient('http://localhost:3001')

    // 3. Obtém instância Prisma
    prisma = server.getPrisma()

    // 4. Cria workspace + project de teste
    const ws = await prisma.workspace.create({
      data: { name: 'Test Workspace', path: '/tmp/test' },
    })

    const proj = await prisma.project.create({
      data: {
        name: 'Test Project',
        path: '/tmp/project',
        workspaceId: ws.id,
      },
    })

    testProjectId = proj.id
  }, 30000) // Timeout 30s para setup

  // ──────────────────────────────────────────────────────────────────────
  // Cleanup: Executado UMA VEZ após todos os testes desta suite
  // ──────────────────────────────────────────────────────────────────────
  afterAll(async () => {
    await server.stop()
  }, 10000)

  // ──────────────────────────────────────────────────────────────────────
  // Setup/Cleanup entre cada teste individual
  // ──────────────────────────────────────────────────────────────────────
  beforeEach(async () => {
    // Limpa outputs entre testes para isolar
    await prisma.agentOutput.deleteMany({ where: { projectId: testProjectId } })
  })

  afterEach(() => {
    // Fecha todas as conexões SSE abertas
    client.closeAllSSE()
  })

  // ──────────────────────────────────────────────────────────────────────
  // CASO DE TESTE EXEMPLO 1: Teste simples de request/response
  // ──────────────────────────────────────────────────────────────────────
  it('should make a simple POST request', async () => {
    const response = await client.post('/api/orchestrator/run', {
      projectId: testProjectId,
      task: 'Test task - simple button component',
      phases: ['PLANNING'],
    })

    expect(response.outputId).toBeDefined()
    expect(typeof response.outputId).toBe('string')
  })

  // ──────────────────────────────────────────────────────────────────────
  // CASO DE TESTE EXEMPLO 2: Conectar SSE e aguardar evento
  // ──────────────────────────────────────────────────────────────────────
  it('should connect to SSE and receive events', async () => {
    // 1. Inicia pipeline
    const { outputId } = await client.post('/api/orchestrator/run', {
      projectId: testProjectId,
      task: 'Test task - counter component',
      phases: ['PLANNING'],
    })

    // 2. Conecta ao SSE endpoint
    const receivedEvents: any[] = []

    const sse = client.connectSSE(`/api/orchestrator/events/${outputId}`, {
      onMessage: (event) => {
        const data = JSON.parse(event.data)
        receivedEvents.push(data)
        console.log(`Received event: ${data.type}`)
      },
    })

    // 3. Aguarda até receber evento específico
    await client.waitForEvent(
      sse,
      (logs) => logs.some((log) => log.type === 'bridge_plan_done'),
      30000 // Timeout 30s
    )

    // 4. Validações
    expect(receivedEvents.length).toBeGreaterThan(0)
    expect(receivedEvents.some((e) => e.type === 'bridge_init')).toBe(true)

    // 5. Fecha conexão (ou deixa afterEach fazer cleanup)
    sse.close()
  }, 40000)

  // ──────────────────────────────────────────────────────────────────────
  // CASO DE TESTE EXEMPLO 3: Polling até condição ser satisfeita
  // ──────────────────────────────────────────────────────────────────────
  it('should poll until pipeline reaches a specific stage', async () => {
    // 1. Inicia pipeline
    const { outputId } = await client.post('/api/orchestrator/run', {
      projectId: testProjectId,
      task: 'Test task - form validation',
      phases: ['PLANNING', 'WRITING'],
    })

    // 2. Aguarda até status atingir 'execute' ou 'failed'
    const status = await client.pollUntil(
      () => client.get(`/api/orchestrator/${outputId}/status`),
      (s) => s.stage === 'execute' || s.status === 'failed',
      30000, // Timeout 30s
      500 // Intervalo de polling: 500ms
    )

    // 3. Validações
    expect(['execute', 'spec']).toContain(status.stage)
    expect(status.lastEventId).toBeGreaterThan(0)
  }, 40000)

  // ──────────────────────────────────────────────────────────────────────
  // CASO DE TESTE EXEMPLO 4: Deduplicação customizada
  // ──────────────────────────────────────────────────────────────────────
  it('should track and deduplicate SSE events', async () => {
    const { outputId } = await client.post('/api/orchestrator/run', {
      projectId: testProjectId,
      task: 'Test dedup',
      phases: ['PLANNING'],
    })

    const processedIds = new Set<string>()
    const logs: any[] = []

    const sse = client.connectSSE(`/api/orchestrator/events/${outputId}`, {
      onMessage: (event) => {
        const frameId = event.lastEventId

        // Dedup logic
        if (frameId && processedIds.has(frameId)) {
          console.warn(`Duplicate detected: ${frameId}`)
          return // Ignora duplicata
        }

        processedIds.add(frameId)
        logs.push(JSON.parse(event.data))
      },
    })

    await client.waitForEvent(sse, (logs) => logs.length >= 3)

    // Validações
    expect(logs.length).toBe(processedIds.size) // Sem duplicatas
    expect(processedIds.size).toBeGreaterThan(0)

    sse.close()
  }, 30000)

  // ──────────────────────────────────────────────────────────────────────
  // CASO DE TESTE EXEMPLO 5: Validação direta no banco
  // ──────────────────────────────────────────────────────────────────────
  it('should persist events to database', async () => {
    const { outputId } = await client.post('/api/orchestrator/run', {
      projectId: testProjectId,
      task: 'Test persistence',
      phases: ['PLANNING'],
    })

    // Aguarda alguns eventos via polling
    await client.wait(5000)

    // Valida diretamente no banco
    const output = await prisma.agentOutput.findUnique({
      where: { id: outputId },
      include: { events: true },
    })

    expect(output).not.toBeNull()
    expect(output!.events.length).toBeGreaterThan(0)
  }, 20000)

  // ──────────────────────────────────────────────────────────────────────
  // DICAS E PADRÕES
  // ──────────────────────────────────────────────────────────────────────

  /*
   * ✅ BOAS PRÁTICAS:
   *
   * 1. Timeouts generosos: Pipelines reais demoram 20-60s
   *    - Use timeout de pelo menos 30s em testes E2E
   *    - Adicione timeout no final do `it()`: it('test', async () => {...}, 60000)
   *
   * 2. Logs abundantes: Use console.log para debugging
   *    - Prefixe com identificador: console.log('[TEST 1] ...')
   *    - Ajuda muito quando teste falha no CI
   *
   * 3. Cleanup garantido: Sempre feche SSE no afterEach
   *    - client.closeAllSSE() fecha todas as conexões abertas
   *
   * 4. Asserções específicas: Não use apenas toBeTruthy()
   *    - Valide valores concretos: expect(status.stage).toBe('execute')
   *
   * 5. Isolamento: beforeEach limpa outputs para evitar interferência
   *
   * 6. Nomenclatura clara:
   *    - Describe: Agrupa casos relacionados
   *    - it('should {comportamento} when {condição}'): Descreve expectativa
   *
   * 7. Estrutura comentada:
   *    // 1. Setup
   *    // 2. Action
   *    // 3. Assert
   *
   * ⚠️ EVITE:
   *
   * - Timeouts muito curtos (< 10s para E2E)
   * - Dependências entre testes (cada teste deve ser independente)
   * - Validações fracas (toBeTruthy, toExist quando pode ser mais específico)
   * - Esquecer de fechar SSE (memory leak)
   * - Assumir ordem de eventos SSE (sempre use predicados robustos)
   */
})
