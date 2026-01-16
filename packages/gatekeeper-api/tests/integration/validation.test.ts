import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { rm } from 'fs/promises'
import { join } from 'path'

vi.mock('../../../src/db/client.js', () => ({
  prisma: {
    validationRun: {
      create: vi.fn(),
    },
  },
}))

vi.mock('../../../src/services/ValidationOrchestrator.js', () => ({
  ValidationOrchestrator: class {
    addToQueue = vi.fn().mockResolvedValue(undefined)
  },
}))

import app from '../../../src/server.js'
import { prisma } from '../../../src/db/client.js'

describe('POST /api/runs', () => {
  let baseUrl = ''
  let server: ReturnType<typeof app.listen>

  beforeAll(() => {
    server = app.listen(0)
    const address = server.address()
    if (typeof address === 'string' || address === null) {
      throw new Error('Failed to bind test server')
    }
    baseUrl = `http://localhost:${address.port}`
  })

  afterAll(async () => {
    await rm(join(process.cwd(), 'artifacts', 'integration-output-1'), {
      recursive: true,
      force: true,
    })

    await new Promise<void>((resolve) => {
      server.close(() => resolve())
    })
  })

  it('creates a run with all new fields and returns outputId', async () => {
    const createMock = prisma.validationRun.create as ReturnType<typeof vi.fn>
    createMock.mockResolvedValue({
      id: 'run-1',
      outputId: 'integration-output-1',
      status: 'PENDING',
      createdAt: new Date(),
    })

    const response = await fetch(`${baseUrl}/api/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outputId: 'integration-output-1',
        projectPath: 'project/path',
        taskPrompt: 'Implement the authentication flow',
        manifest: {
          files: [
            { path: 'src/auth.ts', action: 'CREATE', reason: 'New auth module' },
          ],
          testFile: 'tests/auth.test.ts',
        },
        testFilePath: 'tests/auth.test.ts',
        testFileContent: 'describe("auth", () => {})',
      }),
    })

    expect(response.status).toBe(201)
    const body = await response.json()

    expect(body.runId).toBe('run-1')
    expect(body.outputId).toBe('integration-output-1')
  })
})
