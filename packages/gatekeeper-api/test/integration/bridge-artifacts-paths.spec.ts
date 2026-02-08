/**
 * Integration Tests: Bridge artifacts endpoints
 *
 * Validates that BridgeController reads artifacts from the resolved
 * workspace artifactsDir path for a given outputId.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Request, Response } from 'express'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

// ─── Mocks ─────────────────────────────────────────────────────────────────

const mockFindMany = vi.fn()
const mockFindFirst = vi.fn()

vi.mock('../../src/db/client', () => ({
  prisma: {
    workspace: {
      findMany: mockFindMany,
      findFirst: mockFindFirst,
    },
  },
}))

vi.mock('../../src/services/AgentPromptAssembler', () => ({
  AgentPromptAssembler: class {},
}))

vi.mock('../../src/services/providers/LLMProviderRegistry', () => ({
  LLMProviderRegistry: class {
    static fromEnv() { return new this() }
  },
}))

import { BridgeController } from '../../src/api/controllers/BridgeController'

// ─── Helpers ───────────────────────────────────────────────────────────────

interface MockRequest {
  body: Record<string, unknown>
  params: Record<string, string>
  query: Record<string, string>
}

interface MockResponse {
  statusCode: number
  body: Record<string, unknown>
  headersSent: boolean
  status: (code: number) => MockResponse
  json: (data: Record<string, unknown>) => MockResponse
}

function createMockRequest(
  body: Record<string, unknown> = {},
  params: Record<string, string> = {},
  query: Record<string, string> = {},
): MockRequest {
  return { body, params, query }
}

function createMockResponse(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    body: {},
    headersSent: false,
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(data: Record<string, unknown>) {
      this.body = data
      this.headersSent = true
      return this
    },
  }
  return res
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('BridgeController artifacts endpoints', () => {
  let tmpRoot: string
  let projectPath: string

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-artifacts-'))
    projectPath = path.join(tmpRoot, 'project')
    fs.mkdirSync(projectPath, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true })
    vi.clearAllMocks()
  })

  it('reads artifact from workspace artifactsDir path', async () => {
    const outputId = 'out-bridge-1'
    const artifactsDir = 'inputs'
    const outputDir = path.join(tmpRoot, artifactsDir, outputId)
    fs.mkdirSync(outputDir, { recursive: true })
    fs.writeFileSync(path.join(outputDir, 'microplans.json'), '{"task":"Test","microplans":[]}')

    mockFindMany.mockResolvedValue([
      { rootPath: tmpRoot, artifactsDir, isActive: true },
    ])
    mockFindFirst.mockResolvedValue({ rootPath: tmpRoot, artifactsDir, isActive: true })

    const controller = new BridgeController()
    const req = createMockRequest(
      {},
      { outputId, filename: 'microplans.json' },
      { projectPath },
    )
    const res = createMockResponse()

    await controller.readArtifact(req as unknown as Request, res as unknown as Response)

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({
      outputId,
      filename: 'microplans.json',
    })
    expect(res.body.content).toContain('"microplans"')
  })
})
