import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { execa } from 'execa'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promises as fs } from 'node:fs'
import { existsSync, readFileSync } from 'node:fs'

type AnyPrisma = any

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const packageRoot = path.resolve(__dirname, '../../..') // packages/gatekeeper-api
const repoRoot = path.resolve(packageRoot, '../..') // repo root
const schemaPath = path.join(packageRoot, 'prisma', 'schema.prisma')

const normalizePath = (p: string) => p.replace(/\\/g, '/')

const makeMockRes = () => {
  const res: any = {}
  res.status = vi.fn().mockImplementation(() => res)
  res.json = vi.fn().mockImplementation(() => res)
  return res
}

const makeTempDir = async (prefix: string) => {
  const root = process.env.TMPDIR || process.env.TEMP || '/tmp'
  return await fs.mkdtemp(path.join(root, prefix))
}

let prisma: AnyPrisma
let ValidationController: any
let RunsController: any
let ValidationOrchestrator: any

// We create a dedicated SQLite DB per test file run, but reset data between tests.
// IMPORTANT: env must be set BEFORE importing prisma/client and app code that imports it.
beforeAll(async () => {
  const dbDir = await makeTempDir('gatekeeper-test-db-')
  const dbFile = path.join(dbDir, 'test.db')
  process.env.DATABASE_URL = `file:${dbFile}`

  const prismaCliRepo = path.join(
    repoRoot,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'prisma.cmd' : 'prisma',
  )
  const prismaCliPkg = path.join(
    packageRoot,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'prisma.cmd' : 'prisma',
  )
  const prismaCli = existsSync(prismaCliRepo) ? prismaCliRepo : prismaCliPkg

  // Ensure schema is applied to the empty SQLite file
  await execa(prismaCli, ['migrate', 'deploy', '--schema', schemaPath], {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
  })

  ;({ prisma } = await import('../../db/client.js'))
  ;({ ValidationController } = await import('../../api/controllers/ValidationController.js'))
  ;({ RunsController } = await import('../../api/controllers/RunsController.js'))
  ;({ ValidationOrchestrator } = await import('../ValidationOrchestrator.js'))
})

afterAll(async () => {
  if (prisma) {
    await prisma.$disconnect()
  }
})

const cleanDb = async () => {
  // Order matters due to relations.
  await prisma.validatorResult.deleteMany().catch(() => {})
  await prisma.gateResult.deleteMany().catch(() => {})
  await prisma.validationRun.deleteMany()
  await prisma.project.deleteMany()
  await prisma.workspace.deleteMany()
}

let projectRoot: string
let workspaceId: string
let projectId: string

const seedWorkspaceProject = async (artifactsDir: string) => {
  projectRoot = await makeTempDir('gatekeeper-project-')

  const ws = await prisma.workspace.create({
    data: {
      name: `ws-${Math.random().toString(16).slice(2)}`,
      rootPath: projectRoot,
      artifactsDir,
      isActive: true,
    },
  })
  workspaceId = ws.id

  const proj = await prisma.project.create({
    data: {
      workspaceId,
      name: `proj-${Math.random().toString(16).slice(2)}`,
      baseRef: 'origin/main',
      targetRef: 'HEAD',
      isActive: true,
    },
    include: { workspace: true },
  })
  projectId = proj.id

  return { ws, proj }
}

beforeEach(async () => {
  await cleanDb()
})

afterEach(async () => {
  if (projectRoot) {
    await fs.rm(projectRoot, { recursive: true, force: true }).catch(() => {})
  }
})

describe('artifacts-source-canonical-execution', () => {
  // @clause CL-DB-001
  it('succeeds when a run is created and testFilePath is persisted as the canonical repo path', async () => {
    await seedWorkspaceProject('artifacts')

    const manifestTestFile = 'packages/gatekeeper-api/src/services/__tests__/some.spec.ts'
    const req: any = {
      body: {
        outputId: 'out-db-001',
        projectId,
        taskPrompt: 'contract test',
        manifest: { testFile: manifestTestFile },
        dangerMode: false,
        runType: 'CONTRACT',
      },
    }
    const res = makeMockRes()

    const controller = new ValidationController()
    await controller.createRun(req, res)

    const json = res.json.mock.calls[0]?.[0]
    const runId = json?.runId
    expect(runId).toBeTruthy()

    const run = await prisma.validationRun.findUnique({ where: { id: runId } })
    expect(run).toBeTruthy()

    const expectedCanonical = normalizePath(path.join(projectRoot, manifestTestFile))
    expect(normalizePath(run.testFilePath)).toBe(expectedCanonical)
  })

  // @clause CL-UPLOAD-001
  it('succeeds when uploading files and staging always writes into <projectRoot>/<artifactsDir>/<outputId>/ regardless of absolute testFilePath', async () => {
    const artifactsDir = 'inputs'
    await seedWorkspaceProject(artifactsDir)

    const manifestTestFile = 'packages/gatekeeper-api/src/services/__tests__/upload-target.spec.ts'
    const canonicalSpecPath = path.join(projectRoot, manifestTestFile)
    const canonicalSpecDir = path.dirname(canonicalSpecPath)
    const outputId = 'out-upload-001'
    const specFileName = path.basename(manifestTestFile)

    const run = await prisma.validationRun.create({
      data: {
        projectId,
        outputId,
        projectPath: projectRoot,
        taskPrompt: 'upload test',
        manifestJson: JSON.stringify({ testFile: manifestTestFile }),
        testFilePath: canonicalSpecPath, // absolute on purpose
        baseRef: 'origin/main',
        targetRef: 'HEAD',
        dangerMode: false,
        runType: 'CONTRACT',
        status: 'RUNNING', // avoid enqueue side effects
      },
    })

    const planJson = JSON.stringify({ manifest: { testFile: manifestTestFile } })
    const specBody = `// spec content ${Date.now()}`

    const req: any = {
      params: { id: run.id },
      files: {
        planJson: [
          {
            buffer: Buffer.from(planJson, 'utf-8'),
            size: Buffer.byteLength(planJson),
            originalname: 'plan.json',
          },
        ],
        specFile: [
          {
            buffer: Buffer.from(specBody, 'utf-8'),
            size: Buffer.byteLength(specBody),
            originalname: specFileName,
          },
        ],
      },
    }
    const res = makeMockRes()

    const controller = new RunsController()
    await controller.uploadFiles(req, res)

    const expectedArtifactsSpecPath = path.join(projectRoot, artifactsDir, outputId, specFileName)
    expect(existsSync(expectedArtifactsSpecPath)).toBe(true)

    // Must NOT stage into the canonical spec directory (legacy behavior we want to eliminate)
    const wronglyStagedPath = path.join(canonicalSpecDir, specFileName)
    expect(existsSync(wronglyStagedPath)).toBe(false)
  })

  // @clause CL-EXEC-001
  it('succeeds when a staged spec exists and ensureSpecAtCorrectPath overwrites the canonical spec and normalizes DB', async () => {
    await seedWorkspaceProject('artifacts')

    const manifestTestFile = 'packages/gatekeeper-api/src/services/__tests__/exec-overwrite.spec.ts'
    const outputId = 'out-exec-001'
    const specFileName = path.basename(manifestTestFile)

    const canonicalSpecPath = path.join(projectRoot, manifestTestFile)
    await fs.mkdir(path.dirname(canonicalSpecPath), { recursive: true })
    await fs.writeFile(canonicalSpecPath, 'OLD_CANONICAL', 'utf-8')

    const stagingSpecPath = path.join(projectRoot, 'artifacts', outputId, specFileName)
    await fs.mkdir(path.dirname(stagingSpecPath), { recursive: true })
    await fs.writeFile(stagingSpecPath, 'NEW_FROM_STAGING', 'utf-8')

    const run = await prisma.validationRun.create({
      data: {
        projectId,
        outputId,
        projectPath: projectRoot,
        taskPrompt: 'exec overwrite test',
        manifestJson: JSON.stringify({ testFile: manifestTestFile }),
        testFilePath: normalizePath(stagingSpecPath), // legacy: points to artifacts
        baseRef: 'origin/main',
        targetRef: 'HEAD',
        dangerMode: false,
        runType: 'CONTRACT',
      },
    })

    const orchestrator = new ValidationOrchestrator()
    await orchestrator.ensureSpecAtCorrectPath(run)

    const canonicalBody = readFileSync(canonicalSpecPath, 'utf-8')
    expect(canonicalBody).toBe('NEW_FROM_STAGING')

    const updated = await prisma.validationRun.findUnique({ where: { id: run.id } })
    expect(normalizePath(updated.testFilePath)).toBe(normalizePath(canonicalSpecPath))
  })

  // @clause CL-EXEC-002
  it('succeeds when the canonical spec already exists and ensureSpecAtCorrectPath still normalizes DB to the canonical path', async () => {
    await seedWorkspaceProject('artifacts')

    const manifestTestFile = 'packages/gatekeeper-api/src/services/__tests__/exec-normalize-only.spec.ts'
    const outputId = 'out-exec-002'
    const specFileName = path.basename(manifestTestFile)

    const canonicalSpecPath = path.join(projectRoot, manifestTestFile)
    await fs.mkdir(path.dirname(canonicalSpecPath), { recursive: true })
    await fs.writeFile(canonicalSpecPath, 'CANONICAL_PRESENT', 'utf-8')

    const legacyArtifactsPath = path.join(projectRoot, 'artifacts', outputId, specFileName)

    const run = await prisma.validationRun.create({
      data: {
        projectId,
        outputId,
        projectPath: projectRoot,
        taskPrompt: 'exec normalize-only test',
        manifestJson: JSON.stringify({ testFile: manifestTestFile }),
        testFilePath: normalizePath(legacyArtifactsPath), // legacy: points to artifacts
        baseRef: 'origin/main',
        targetRef: 'HEAD',
        dangerMode: false,
        runType: 'CONTRACT',
      },
    })

    const orchestrator = new ValidationOrchestrator()
    await orchestrator.ensureSpecAtCorrectPath(run)

    const updated = await prisma.validationRun.findUnique({ where: { id: run.id } })
    expect(normalizePath(updated.testFilePath)).toBe(normalizePath(canonicalSpecPath))
  })

  // @clause CL-CONFIG-001
  it('succeeds when workspace.artifactsDir is not "artifacts" and ensureSpecAtCorrectPath uses the resolved artifactsDir for staging lookup', async () => {
    const artifactsDir = 'inputs'
    await seedWorkspaceProject(artifactsDir)

    const manifestTestFile = 'packages/gatekeeper-api/src/services/__tests__/config-artifactsDir.spec.ts'
    const outputId = 'out-config-001'
    const specFileName = path.basename(manifestTestFile)

    const stagingSpecPath = path.join(projectRoot, artifactsDir, outputId, specFileName)
    await fs.mkdir(path.dirname(stagingSpecPath), { recursive: true })
    await fs.writeFile(stagingSpecPath, 'FROM_CUSTOM_ARTIFACTS_DIR', 'utf-8')

    const run = await prisma.validationRun.create({
      data: {
        projectId,
        outputId,
        projectPath: projectRoot,
        taskPrompt: 'config artifactsDir test',
        manifestJson: JSON.stringify({ testFile: manifestTestFile }),
        testFilePath: normalizePath(stagingSpecPath), // could be legacy or anything
        baseRef: 'origin/main',
        targetRef: 'HEAD',
        dangerMode: false,
        runType: 'CONTRACT',
      },
    })

    const orchestrator = new ValidationOrchestrator()
    await orchestrator.ensureSpecAtCorrectPath(run)

    const canonicalSpecPath = path.join(projectRoot, manifestTestFile)
    expect(existsSync(canonicalSpecPath)).toBe(true)
  })

  // @clause CL-SEC-001
  it('fails when manifest.testFile is absolute or escapes projectPath after normalization', async () => {
    await seedWorkspaceProject('artifacts')

    const req: any = {
      body: {
        outputId: 'out-sec-001',
        projectId,
        taskPrompt: 'security test',
        manifest: { testFile: '../outside.spec.ts' },
        dangerMode: false,
        runType: 'CONTRACT',
      },
    }
    const res = makeMockRes()

    const controller = new ValidationController()
    await controller.createRun(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    const payload = res.json.mock.calls[0]?.[0] || {}
    expect(typeof payload.error).toBe('string')
  })
})
