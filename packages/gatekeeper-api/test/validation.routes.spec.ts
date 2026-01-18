import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import type { Server } from 'node:http'
import { rm } from 'node:fs/promises'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import app from '../src/server.js'

describe('validation.routes', () => {
  const prisma = new PrismaClient()
  let server: Server
  let baseUrl: string
  const outputId = 'contract-run-test'

  const request = async (
    endpoint: string,
    options: { method?: string; body?: string; headers?: Record<string, string> } = {}
  ) => {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    })
    return response
  }

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve())
    })
    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Failed to start test server')
    }
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  afterAll(async () => {
    await prisma.$disconnect()
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
    }
    const artifactsPath = path.join(process.cwd(), 'artifacts', outputId)
    await rm(artifactsPath, { recursive: true, force: true })
  })

  it('accepts contract payload and persists it', async () => {
    const contract = {
      schemaVersion: '1.0.0',
      slug: 'api-contract',
      title: 'API contract for endpoints',
      mode: 'STRICT',
      changeType: 'new',
      targetArtifacts: ['api'],
      clauses: [
        {
          id: 'CL-API-001',
          kind: 'behavior',
          normativity: 'MUST',
          title: 'Return 200 for status check',
          spec: 'When the health endpoint is called, return 200 without error',
          observables: ['http'],
        },
      ],
    }

    const response = await request('/api/runs', {
      method: 'POST',
      body: JSON.stringify({
        outputId,
        projectPath: process.cwd(),
        taskPrompt: 'Validate contract for new API',
        manifest: {
          files: [{ path: 'src/index.ts', action: 'MODIFY' }],
          testFile: 'src/index.spec.ts',
        },
        testFilePath: 'src/index.spec.ts',
        baseRef: 'origin/main',
        targetRef: 'HEAD',
        dangerMode: false,
        runType: 'CONTRACT',
        contract,
      }),
    })

    expect(response.status).toBe(201)
    const body = await response.json()

    const persistedRun = await prisma.validationRun.findUnique({ where: { id: body.runId } })
    expect(persistedRun).toBeDefined()
    expect(persistedRun?.contractJson).toBe(JSON.stringify(contract))
  })
})
