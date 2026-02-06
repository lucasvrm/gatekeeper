/**
 * Teste simples do endpoint /run
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TestServer } from './setup/test-server'
import { TestClient } from './setup/test-client'
import { PrismaClient } from '@prisma/client'
import { app } from '@/server'

describe('API Endpoint Test', () => {
  let server: TestServer
  let client: TestClient
  let prisma: PrismaClient
  let testProjectId: string

  beforeAll(async () => {
    server = new TestServer(3004, app)
    await server.start()
    client = new TestClient('http://localhost:3004')
    prisma = server.getPrisma()

    // Cria workspace + project
    const ws = await prisma.workspace.create({
      data: { name: 'Test WS', rootPath: 'C:\\tmp\\test' },
    })
    const proj = await prisma.project.create({
      data: { name: 'Test Proj', workspaceId: ws.id },
    })
    testProjectId = proj.id
  }, 30000)

  afterAll(async () => {
    await server.stop()
  }, 10000)

  it('should respond to POST /api/orchestrator/run', async () => {
    console.log('[TEST] Making POST request...')

    try {
      const response = await client.post('/api/orchestrator/run', {
        projectId: testProjectId,
        task: 'Test task - simple button component',
        phases: ['PLANNING'],
      })

      console.log('[TEST] Response:', response)

      expect(response).toBeDefined()
      expect(response.outputId).toBeDefined()
      expect(typeof response.outputId).toBe('string')
    } catch (error) {
      console.error('[TEST] Error:', error)
      throw error
    }
  }, 30000)
})
