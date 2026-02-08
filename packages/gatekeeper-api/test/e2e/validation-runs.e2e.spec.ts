/**
 * E2E Tests: Validation Runs API
 *
 * Cobertura:
 * - POST /api/runs (create run)
 * - Validações de outputId e testFile
 * - Regras de contractRunId
 * - GET /api/runs e /api/runs/:id
 * - POST /api/runs/:id/abort
 * - POST /api/runs/:id/rerun/:gateNumber (gate inválido)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { TestServer } from './setup/test-server'
import { TestClient } from './setup/test-client'
import { PrismaClient } from '@prisma/client'
import { app } from '@/server'
import { AuthService } from '@/services/AuthService'

describe('Validation Runs API E2E', () => {
  let server: TestServer
  let client: TestClient
  let prisma: PrismaClient
  let testWorkspaceId: string
  let testProjectId: string

  const rootPath = 'C:\\tmp\\validation-runs-test'
  const specRelPath = 'src/__tests__/sample.validation.spec.ts'

  const createSpecFile = async () => {
    const specPath = join(rootPath, specRelPath)
    await fs.mkdir(join(rootPath, 'src', '__tests__'), { recursive: true })
    await fs.writeFile(
      specPath,
      [
        'import { describe, it, expect } from "vitest"',
        '',
        'describe("validation run spec", () => {',
        '  it("should pass", () => {',
        '    expect(true).toBe(true)',
        '  })',
        '})',
        '',
      ].join('\n'),
      'utf-8'
    )
  }

  const makeManifest = (testFile: string) => ({
    files: [{ path: testFile, action: 'CREATE' as const }],
    testFile,
  })

  beforeAll(async () => {
    server = new TestServer(3012, app)
    await server.start()
    client = new TestClient('http://localhost:3012')
    prisma = server.getPrisma()
    await new Promise((resolve) => setTimeout(resolve, 100))

    const authService = new AuthService()
    client.setAuthToken(authService.generateToken('e2e-user'))

    await createSpecFile()

    const workspace = await prisma.workspace.create({
      data: {
        name: 'E2E Validation Runs Workspace',
        rootPath,
        artifactsDir: 'artifacts',
      },
    })
    testWorkspaceId = workspace.id

    const project = await prisma.project.create({
      data: {
        name: 'E2E Validation Runs Project',
        workspaceId: testWorkspaceId,
        baseRef: 'origin/main',
        targetRef: 'HEAD',
      },
    })
    testProjectId = project.id
  }, 30000)

  afterAll(async () => {
    try {
      await prisma.validatorResult.deleteMany()
      await prisma.gateResult.deleteMany()
      await prisma.validationRun.deleteMany({ where: { projectId: testProjectId } })
      await prisma.project.deleteMany({ where: { workspaceId: testWorkspaceId } })
      await prisma.workspace.delete({ where: { id: testWorkspaceId } })
    } catch (error) {
      console.warn('[E2E Validation Runs] Cleanup error:', error)
    }

    try {
      await fs.rm(rootPath, { recursive: true, force: true })
    } catch (error) {
      console.warn('[E2E Validation Runs] FS cleanup error:', error)
    }

    await server.stop()
  }, 10000)

  beforeEach(async () => {
    await prisma.validatorResult.deleteMany()
    await prisma.gateResult.deleteMany()
    await prisma.validationRun.deleteMany()
  })

  it('should create a CONTRACT run via POST /api/runs', async () => {
    const outputId = `e2e-contract-${Date.now()}`

    const response = await client.post('/api/runs', {
      projectId: testProjectId,
      outputId,
      taskPrompt: 'Test validation run creation',
      manifest: makeManifest(specRelPath),
      runType: 'CONTRACT',
    })

    expect(response.runId).toBeDefined()
    expect(response.outputId).toBe(outputId)
    expect(response.status).toBe('PENDING')
  }, 30000)

  it('should reject outputId with path traversal', async () => {
    try {
      await client.post('/api/runs', {
        projectId: testProjectId,
        outputId: '../evil',
        taskPrompt: 'Invalid outputId test',
        manifest: makeManifest(specRelPath),
        runType: 'CONTRACT',
      })
      expect.fail('Expected request to fail')
    } catch (error: any) {
      const msg = String(error.message || '')
      expect(msg).toContain('400')
      expect(msg).toContain('Invalid outputId')
    }
  }, 30000)

  it('should reject absolute manifest.testFile paths', async () => {
    try {
      await client.post('/api/runs', {
        projectId: testProjectId,
        outputId: `e2e-abs-${Date.now()}`,
        taskPrompt: 'Absolute path test',
        manifest: makeManifest('C:\\tmp\\abs.spec.ts'),
        runType: 'CONTRACT',
      })
      expect.fail('Expected request to fail')
    } catch (error: any) {
      const msg = String(error.message || '')
      expect(msg).toContain('400')
      expect(msg).toContain('Invalid manifest.testFile')
    }
  }, 30000)

  it('should reject manifest.testFile that escapes project root', async () => {
    try {
      await client.post('/api/runs', {
        projectId: testProjectId,
        outputId: `e2e-escape-${Date.now()}`,
        taskPrompt: 'Escape root test',
        manifest: makeManifest('../outside.spec.ts'),
        runType: 'CONTRACT',
      })
      expect.fail('Expected request to fail')
    } catch (error: any) {
      const msg = String(error.message || '')
      expect(msg).toContain('400')
      expect(msg).toContain('Invalid manifest.testFile')
    }
  }, 30000)

  it('should reject invalid test file extension', async () => {
    try {
      await client.post('/api/runs', {
        projectId: testProjectId,
        outputId: `e2e-invalid-ext-${Date.now()}`,
        taskPrompt: 'Invalid extension test',
        manifest: makeManifest('src/__tests__/invalid.txt'),
        runType: 'CONTRACT',
      })
      expect.fail('Expected request to fail')
    } catch (error: any) {
      const msg = String(error.message || '')
      expect(msg).toContain('400')
      expect(msg).toContain('Invalid testFile extension')
    }
  }, 30000)

  it('should enforce contractRunId must be PASSED', async () => {
    const manifest = makeManifest(specRelPath)
    const failedContract = await prisma.validationRun.create({
      data: {
        projectId: testProjectId,
        outputId: `e2e-contract-failed-${Date.now()}`,
        projectPath: rootPath,
        taskPrompt: 'Failed contract run',
        manifestJson: JSON.stringify(manifest),
        testFilePath: join(rootPath, specRelPath).replace(/\\/g, '/'),
        baseRef: 'origin/main',
        targetRef: 'HEAD',
        dangerMode: false,
        status: 'FAILED',
        runType: 'CONTRACT',
      },
    })

    try {
      await client.post('/api/runs', {
        projectId: testProjectId,
        outputId: `e2e-exec-${Date.now()}`,
        taskPrompt: 'Execution run referencing failed contract',
        manifest,
        runType: 'EXECUTION',
        contractRunId: failedContract.id,
      })
      expect.fail('Expected request to fail')
    } catch (error: any) {
      const msg = String(error.message || '')
      expect(msg).toContain('400')
      expect(msg).toContain('Contract run must have PASSED status')
    }
  }, 30000)

  it('should list and fetch runs', async () => {
    const outputId = `e2e-list-${Date.now()}`
    const created = await client.post('/api/runs', {
      projectId: testProjectId,
      outputId,
      taskPrompt: 'List runs test',
      manifest: makeManifest(specRelPath),
      runType: 'CONTRACT',
    })

    const list = await client.get('/api/runs?status=PENDING')
    expect(Array.isArray(list.data)).toBe(true)
    const found = list.data.find((r: any) => r.id === created.runId)
    expect(found).toBeDefined()

    const fetched = await client.get(`/api/runs/${created.runId}`)
    expect(fetched.id).toBe(created.runId)
    expect(fetched.outputId).toBe(outputId)
  }, 30000)

  it('should abort a pending run', async () => {
    const outputId = `e2e-abort-${Date.now()}`
    const created = await client.post('/api/runs', {
      projectId: testProjectId,
      outputId,
      taskPrompt: 'Abort run test',
      manifest: makeManifest(specRelPath),
      runType: 'CONTRACT',
    })

    const aborted = await client.post(`/api/runs/${created.runId}/abort`, {})
    expect(aborted.status).toBe('ABORTED')
  }, 30000)

  it('should reject rerun for invalid gate number', async () => {
    const outputId = `e2e-rerun-${Date.now()}`
    const created = await client.post('/api/runs', {
      projectId: testProjectId,
      outputId,
      taskPrompt: 'Rerun gate validation test',
      manifest: makeManifest(specRelPath),
      runType: 'CONTRACT',
    })

    await prisma.validationRun.update({
      where: { id: created.runId },
      data: { status: 'FAILED' },
    })

    try {
      await client.post(`/api/runs/${created.runId}/rerun/2`, {})
      expect.fail('Expected request to fail')
    } catch (error: any) {
      const msg = String(error.message || '')
      expect(msg).toContain('400')
      expect(msg).toContain('Invalid gate number')
    }
  }, 30000)
})
