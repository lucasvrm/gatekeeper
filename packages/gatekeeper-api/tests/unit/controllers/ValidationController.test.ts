import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Request, Response } from 'express'
import { readFile, rm, stat } from 'fs/promises'
import { join } from 'path'
import type { CreateRunInput } from '../../../src/api/schemas/validation.schema'

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

import { prisma } from '../../../src/db/client.js'
import { ValidationController } from '../../../src/api/controllers/ValidationController.js'

const createResponse = () => {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as Response
}

const baseInput: CreateRunInput = {
  outputId: 'output-123',
  projectPath: 'project/path',
  taskPrompt: 'Implement the authentication flow',
  manifest: {
    files: [
      { path: 'src/auth.ts', action: 'CREATE', reason: 'New auth module' },
    ],
    testFile: 'tests/auth.test.ts',
  },
  testFilePath: 'tests/auth.test.ts',
  baseRef: 'origin/main',
  targetRef: 'HEAD',
  dangerMode: false,
}

describe('ValidationController.createRun', () => {
  const controller = new ValidationController()
  const createMock = prisma.validationRun.create as ReturnType<typeof vi.fn>

  afterEach(async () => {
    await rm(join(process.cwd(), 'artifacts', baseInput.outputId), {
      recursive: true,
      force: true,
    })
  })

  beforeEach(() => {
    createMock.mockReset()
  })

  it('saves test file in artifacts/{outputId}/ and creates the directory', async () => {
    const fileName = 'auth.test.ts'
    const testFileContent = 'describe("auth", () => {})'
    const outputId = baseInput.outputId
    const artifactsDir = join(process.cwd(), 'artifacts', outputId)
    const expectedFilePath = join(artifactsDir, fileName)

    createMock.mockResolvedValue({
      id: 'run-1',
      outputId,
      status: 'PENDING',
      createdAt: new Date(),
    })

    const req = {
      body: {
        ...baseInput,
        testFilePath: `tests/${fileName}`,
        testFileContent,
      },
    } as Request
    const res = createResponse()

    await controller.createRun(req, res)

    const savedContent = await readFile(expectedFilePath, 'utf8')
    expect(savedContent).toBe(testFileContent)

    const dirStats = await stat(artifactsDir)
    expect(dirStats.isDirectory()).toBe(true)
  })

  it('rejects testFileContent larger than the limit', async () => {
    const req = {
      body: {
        ...baseInput,
        testFileContent: 'a'.repeat(1048577),
      },
    } as Request
    const res = createResponse()

    await controller.createRun(req, res)

    expect(res.status).toHaveBeenCalledWith(413)
  })

  it('rejects invalid test file extension', async () => {
    const req = {
      body: {
        ...baseInput,
        testFilePath: 'tests/auth.txt',
        testFileContent: 'describe("auth", () => {})',
      },
    } as Request
    const res = createResponse()

    await controller.createRun(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('rejects outputId with path traversal characters', async () => {
    const req = {
      body: {
        ...baseInput,
        outputId: '../bad id',
        testFileContent: 'describe("auth", () => {})',
      },
    } as Request
    const res = createResponse()

    await controller.createRun(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })
})
