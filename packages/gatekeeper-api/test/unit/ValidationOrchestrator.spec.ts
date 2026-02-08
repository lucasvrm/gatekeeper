import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

// ─── Mocks ─────────────────────────────────────────────────────────────────

const mockProjectFindUnique = vi.fn()
const mockValidationRunUpdate = vi.fn()

vi.mock('../../src/db/client', () => ({
  prisma: {
    project: {
      findUnique: mockProjectFindUnique,
    },
    validationRun: {
      update: mockValidationRunUpdate,
    },
  },
}))

import { ValidationOrchestrator } from '../../src/services/ValidationOrchestrator.js'

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('ValidationOrchestrator.ensureSpecAtCorrectPath', () => {
  let tmpRoot: string

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'validation-orch-'))
    vi.clearAllMocks()
  })

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true })
  })

  it('copies spec from artifacts dir to manifest.testFile and updates testFilePath', async () => {
    const orchestrator = new ValidationOrchestrator()
    const outputId = 'out-123'
    const artifactsDir = 'inputs'
    const manifestTestFile = 'src/__tests__/Sample.spec.ts'
    const specContents = 'describe("sample", () => { expect(1).toBe(1) })'

    const artifactsPath = path.join(tmpRoot, artifactsDir, outputId, path.basename(manifestTestFile))
    fs.mkdirSync(path.dirname(artifactsPath), { recursive: true })
    fs.writeFileSync(artifactsPath, specContents)

    mockProjectFindUnique.mockResolvedValue({
      workspace: { artifactsDir },
    })

    const run = {
      id: 'run-1',
      outputId,
      projectId: 'proj-1',
      projectPath: tmpRoot,
      manifestJson: JSON.stringify({ testFile: manifestTestFile }),
    }

    await (orchestrator as any).ensureSpecAtCorrectPath(run)

    const targetPath = path.join(tmpRoot, manifestTestFile)
    expect(fs.existsSync(targetPath)).toBe(true)
    expect(fs.readFileSync(targetPath, 'utf-8')).toBe(specContents)

    expect(mockValidationRunUpdate).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: { testFilePath: targetPath.replace(/\\/g, '/') },
    })
  })

  it('copies spec from nested artifacts path when basename does not exist', async () => {
    const orchestrator = new ValidationOrchestrator()
    const outputId = 'out-456'
    const artifactsDir = 'inputs'
    const manifestTestFile = 'src/__tests__/Nested.spec.ts'
    const specContents = 'describe("nested", () => { expect(true).toBe(true) })'

    const nestedArtifactsPath = path.join(tmpRoot, artifactsDir, outputId, manifestTestFile)
    fs.mkdirSync(path.dirname(nestedArtifactsPath), { recursive: true })
    fs.writeFileSync(nestedArtifactsPath, specContents)

    mockProjectFindUnique.mockResolvedValue({
      workspace: { artifactsDir },
    })

    const run = {
      id: 'run-2',
      outputId,
      projectId: 'proj-1',
      projectPath: tmpRoot,
      manifestJson: JSON.stringify({ testFile: manifestTestFile }),
    }

    await (orchestrator as any).ensureSpecAtCorrectPath(run)

    const targetPath = path.join(tmpRoot, manifestTestFile)
    expect(fs.existsSync(targetPath)).toBe(true)
    expect(fs.readFileSync(targetPath, 'utf-8')).toBe(specContents)
  })
})
