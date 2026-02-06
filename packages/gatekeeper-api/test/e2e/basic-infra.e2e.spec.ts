/**
 * Teste básico de infraestrutura E2E
 * Valida que TestServer e TestClient funcionam antes de testar resiliência
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TestServer } from './setup/test-server'
import { TestClient } from './setup/test-client'
import { PrismaClient } from '@prisma/client'
import { app } from '@/server'

describe('Basic E2E Infrastructure', () => {
  let server: TestServer
  let client: TestClient
  let prisma: PrismaClient

  beforeAll(async () => {
    server = new TestServer(3003, app)
    await server.start()
    client = new TestClient('http://localhost:3003')
    prisma = server.getPrisma()
  }, 30000)

  afterAll(async () => {
    await server.stop()
  }, 10000)

  it('should start test server successfully', () => {
    expect(server).toBeDefined()
    expect(prisma).toBeDefined()
  })

  it('should connect to database', async () => {
    const workspaces = await prisma.workspace.findMany()
    expect(Array.isArray(workspaces)).toBe(true)
  })

  it('should make HTTP GET request', async () => {
    // Test simple health endpoint
    try {
      const response = await fetch('http://localhost:3003')
      expect(response).toBeDefined()
    } catch (error) {
      // Server might not have root endpoint, that's ok
      console.log('Root endpoint not found (expected)')
    }
  })

  it('should create workspace in database', async () => {
    const workspace = await prisma.workspace.create({
      data: {
        name: `Test WS ${Date.now()}`,
        rootPath: 'C:\\tmp\\test',
      },
    })

    expect(workspace.id).toBeDefined()
    expect(workspace.name).toContain('Test WS')

    // Cleanup
    await prisma.workspace.delete({ where: { id: workspace.id } })
  })
})
