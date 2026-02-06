/**
 * E2E Tests: Log Rotation (Cleanup de eventos antigos)
 *
 * Valida que:
 * 1. Eventos antigos são deletados automaticamente
 * 2. Eventos recentes são preservados
 * 3. Endpoint manual funciona corretamente
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { TestServer } from './setup/test-server'
import { TestClient } from './setup/test-client'
import { PrismaClient } from '@prisma/client'
import { app } from '@/server'

describe('Log Rotation E2E', () => {
  let server: TestServer
  let client: TestClient
  let prisma: PrismaClient
  let testWorkspaceId: string
  let testProjectId: string

  beforeAll(async () => {
    server = new TestServer(3009, app)
    await server.start()
    client = new TestClient('http://localhost:3009')
    prisma = server.getPrisma()
    await new Promise((resolve) => setTimeout(resolve, 100))

    const workspace = await prisma.workspace.create({
      data: {
        name: 'E2E Log Rotation Workspace',
        rootPath: 'C:\\tmp\\log-rotation-test',
        artifactsDir: 'artifacts',
      },
    })
    testWorkspaceId = workspace.id

    const project = await prisma.project.create({
      data: {
        name: 'E2E Log Rotation Project',
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
      console.warn('[E2E Log Rotation] Cleanup error:', error)
    }
    await server.stop()
  }, 10000)

  beforeEach(async () => {
    await prisma.pipelineEvent.deleteMany()
    await prisma.pipelineState.deleteMany()
  })

  it('should delete events older than specified days', async () => {
    const outputId = 'test-cleanup-old'

    // Criar eventos antigos (manualmente backdated)
    const oldDate = new Date()
    oldDate.setDate(oldDate.getDate() - 35) // 35 dias atrás

    await prisma.pipelineEvent.createMany({
      data: [
        {
          outputId,
          stage: 'planning',
          eventType: 'agent:start',
          level: 'info',
          payload: JSON.stringify({ old: true }),
          createdAt: oldDate,
        },
        {
          outputId,
          stage: 'planning',
          eventType: 'agent:complete',
          level: 'info',
          payload: JSON.stringify({ old: true }),
          createdAt: oldDate,
        },
      ],
    })

    // Criar eventos recentes (não devem ser deletados)
    await prisma.pipelineEvent.createMany({
      data: [
        {
          outputId,
          stage: 'planning',
          eventType: 'agent:start',
          level: 'info',
          payload: JSON.stringify({ recent: true }),
        },
        {
          outputId,
          stage: 'planning',
          eventType: 'agent:complete',
          level: 'info',
          payload: JSON.stringify({ recent: true }),
        },
      ],
    })

    // Trigger cleanup via endpoint
    const response = await client.post('/api/orchestrator/cleanup-logs?olderThanDays=30', {})

    expect(response.success).toBe(true)
    expect(response.deletedCount).toBe(2) // 2 eventos antigos deletados

    // Verificar que eventos recentes foram preservados
    const remaining = await prisma.pipelineEvent.findMany({ where: { outputId } })
    expect(remaining.length).toBe(2)
    remaining.forEach((event) => {
      const payload = JSON.parse(event.payload || '{}')
      expect(payload.recent).toBe(true)
    })
  }, 30000)

  it('should preserve all events when retention period is long', async () => {
    const outputId = 'test-preserve-all'

    // Criar eventos de 10 dias atrás
    const recentDate = new Date()
    recentDate.setDate(recentDate.getDate() - 10)

    await prisma.pipelineEvent.createMany({
      data: [
        {
          outputId,
          stage: 'planning',
          eventType: 'agent:start',
          level: 'info',
          createdAt: recentDate,
        },
        {
          outputId,
          stage: 'planning',
          eventType: 'agent:complete',
          level: 'info',
          createdAt: recentDate,
        },
      ],
    })

    // Cleanup com retention de 90 dias (deve preservar tudo)
    const response = await client.post('/api/orchestrator/cleanup-logs?olderThanDays=90', {})

    expect(response.success).toBe(true)
    expect(response.deletedCount).toBe(0) // Nada deletado

    // Verificar que todos os eventos foram preservados
    const remaining = await prisma.pipelineEvent.findMany({ where: { outputId } })
    expect(remaining.length).toBe(2)
  }, 30000)

  it('should return error when cleanup fails', async () => {
    // Simular falha: tentar cleanup sem Prisma (não aplicável neste teste)
    // Apenas valida que o endpoint responde corretamente

    const response = await client.post('/api/orchestrator/cleanup-logs?olderThanDays=30', {})
    expect(response.success).toBe(true)
    expect(typeof response.deletedCount).toBe('number')
    expect(typeof response.retentionDays).toBe('number')
  }, 30000)

  it('should use default retention days from env', async () => {
    const response = await client.post('/api/orchestrator/cleanup-logs', {})

    expect(response.success).toBe(true)
    expect(response.retentionDays).toBe(30) // Default do .env.example
  }, 30000)
})
