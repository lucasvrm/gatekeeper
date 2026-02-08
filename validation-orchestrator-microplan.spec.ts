/**
 * ValidationOrchestrator — Microplan Integration Tests
 *
 * Tests that ensureSpecAtCorrectPath correctly extracts testFile from microplan.files array
 * instead of using the deprecated manifest.testFile field.
 */

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

describe('ValidationOrchestrator.ensureSpecAtCorrectPath - Microplan Integration', () => {
  let tmpRoot: string

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'validation-orch-mp-'))
    vi.clearAllMocks()
  })

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true })
  })

  // ── Happy Path ───────────────────────────────────────────────────────────

  it('should extract testFile from microplan.files array and copy spec', async () => {
    const orchestrator = new ValidationOrchestrator()
    const outputId = 'out-mp-123'
    const artifactsDir = 'inputs'
    const testFilePath = 'test/unit/sample.spec.ts'
    const specContents = 'describe("microplan test", () => { expect(1).toBe(1) })'

    // Create spec file in artifacts directory
    const artifactsPath = path.join(tmpRoot, artifactsDir, outputId, path.basename(testFilePath))
    fs.mkdirSync(path.dirname(artifactsPath), { recursive: true })
    fs.writeFileSync(artifactsPath, specContents)

    mockProjectFindUnique.mockResolvedValue({
      workspace: { artifactsDir },
    })

    const microplanJson = JSON.stringify({
      task: 'Test task',
      microplans: [
        {
          id: 'MP-1',
          goal: 'Create test',
          depends_on: [],
          files: [
            { path: 'src/service.ts', action: 'EDIT', what: 'Add method' },
            { path: testFilePath, action: 'CREATE', what: 'Test the method' },
          ],
          verify: 'npm test',
        },
      ],
    })

    const run = {
      id: 'run-mp-1',
      outputId,
      projectId: 'proj-1',
      projectPath: tmpRoot,
      microplanJson,
    }

    await (orchestrator as any).ensureSpecAtCorrectPath(run)

    const targetPath = path.join(tmpRoot, testFilePath)
    expect(fs.existsSync(targetPath)).toBe(true)
    expect(fs.readFileSync(targetPath, 'utf-8')).toBe(specContents)

    expect(mockValidationRunUpdate).toHaveBeenCalledWith({
      where: { id: 'run-mp-1' },
      data: { testFilePath: targetPath.replace(/\\/g, '/') },
    })
  })

  it('should find first .spec.ts file when multiple files exist', async () => {
    const orchestrator = new ValidationOrchestrator()
    const outputId = 'out-mp-456'
    const artifactsDir = 'inputs'
    const firstTestFile = 'test/unit/first.spec.ts'
    const secondTestFile = 'test/unit/second.test.ts'
    const specContents = 'describe("first test", () => { expect(true).toBe(true) })'

    // Create first spec file in artifacts directory
    const artifactsPath = path.join(tmpRoot, artifactsDir, outputId, path.basename(firstTestFile))
    fs.mkdirSync(path.dirname(artifactsPath), { recursive: true })
    fs.writeFileSync(artifactsPath, specContents)

    mockProjectFindUnique.mockResolvedValue({
      workspace: { artifactsDir },
    })

    const microplanJson = JSON.stringify({
      task: 'Test task with multiple test files',
      microplans: [
        {
          id: 'MP-1',
          goal: 'Create tests',
          depends_on: [],
          files: [
            { path: 'src/service.ts', action: 'EDIT', what: 'Add method' },
            { path: firstTestFile, action: 'CREATE', what: 'Test the method' },
            { path: secondTestFile, action: 'CREATE', what: 'Test edge cases' },
          ],
          verify: 'npm test',
        },
      ],
    })

    const run = {
      id: 'run-mp-2',
      outputId,
      projectId: 'proj-1',
      projectPath: tmpRoot,
      microplanJson,
    }

    await (orchestrator as any).ensureSpecAtCorrectPath(run)

    // Should use the first test file found
    const targetPath = path.join(tmpRoot, firstTestFile)
    expect(fs.existsSync(targetPath)).toBe(true)
    expect(fs.readFileSync(targetPath, 'utf-8')).toBe(specContents)
  })

  it('should handle .test.ts extension', async () => {
    const orchestrator = new ValidationOrchestrator()
    const outputId = 'out-mp-789'
    const artifactsDir = 'inputs'
    const testFilePath = 'src/__tests__/component.test.tsx'
    const specContents = 'describe("component", () => { expect(true).toBe(true) })'

    const artifactsPath = path.join(tmpRoot, artifactsDir, outputId, path.basename(testFilePath))
    fs.mkdirSync(path.dirname(artifactsPath), { recursive: true })
    fs.writeFileSync(artifactsPath, specContents)

    mockProjectFindUnique.mockResolvedValue({
      workspace: { artifactsDir },
    })

    const microplanJson = JSON.stringify({
      task: 'Test React component',
      microplans: [
        {
          id: 'MP-1',
          goal: 'Create component test',
          depends_on: [],
          files: [
            { path: 'src/Component.tsx', action: 'CREATE', what: 'Create component' },
            { path: testFilePath, action: 'CREATE', what: 'Test component' },
          ],
          verify: 'npm test',
        },
      ],
    })

    const run = {
      id: 'run-mp-3',
      outputId,
      projectId: 'proj-1',
      projectPath: tmpRoot,
      microplanJson,
    }

    await (orchestrator as any).ensureSpecAtCorrectPath(run)

    const targetPath = path.join(tmpRoot, testFilePath)
    expect(fs.existsSync(targetPath)).toBe(true)
    expect(fs.readFileSync(targetPath, 'utf-8')).toBe(specContents)
  })

  it('should copy spec from nested artifacts path when basename does not exist', async () => {
    const orchestrator = new ValidationOrchestrator()
    const outputId = 'out-mp-nested'
    const artifactsDir = 'inputs'
    const testFilePath = 'test/integration/nested.spec.ts'
    const specContents = 'describe("nested", () => { expect(true).toBe(true) })'

    // Create spec in nested path (Claude Code may nest files)
    const nestedArtifactsPath = path.join(tmpRoot, artifactsDir, outputId, testFilePath)
    fs.mkdirSync(path.dirname(nestedArtifactsPath), { recursive: true })
    fs.writeFileSync(nestedArtifactsPath, specContents)

    mockProjectFindUnique.mockResolvedValue({
      workspace: { artifactsDir },
    })

    const microplanJson = JSON.stringify({
      task: 'Test nested structure',
      microplans: [
        {
          id: 'MP-1',
          goal: 'Create nested test',
          depends_on: [],
          files: [
            { path: testFilePath, action: 'CREATE', what: 'Test nested functionality' },
          ],
          verify: 'npm test',
        },
      ],
    })

    const run = {
      id: 'run-mp-nested',
      outputId,
      projectId: 'proj-1',
      projectPath: tmpRoot,
      microplanJson,
    }

    await (orchestrator as any).ensureSpecAtCorrectPath(run)

    const targetPath = path.join(tmpRoot, testFilePath)
    expect(fs.existsSync(targetPath)).toBe(true)
    expect(fs.readFileSync(targetPath, 'utf-8')).toBe(specContents)
  })

  it('should aggregate files from multiple microplans', async () => {
    const orchestrator = new ValidationOrchestrator()
    const outputId = 'out-mp-multi'
    const artifactsDir = 'inputs'
    const testFilePath = 'test/unit/aggregated.spec.ts'
    const specContents = 'describe("aggregated", () => { expect(1).toBe(1) })'

    const artifactsPath = path.join(tmpRoot, artifactsDir, outputId, path.basename(testFilePath))
    fs.mkdirSync(path.dirname(artifactsPath), { recursive: true })
    fs.writeFileSync(artifactsPath, specContents)

    mockProjectFindUnique.mockResolvedValue({
      workspace: { artifactsDir },
    })

    const microplanJson = JSON.stringify({
      task: 'Multi-microplan task',
      microplans: [
        {
          id: 'MP-1',
          goal: 'Create service',
          depends_on: [],
          files: [
            { path: 'src/service.ts', action: 'CREATE', what: 'Create service' },
          ],
          verify: 'npm run typecheck',
        },
        {
          id: 'MP-2',
          goal: 'Create test',
          depends_on: ['MP-1'],
          files: [
            { path: testFilePath, action: 'CREATE', what: 'Test service' },
          ],
          verify: 'npm test',
        },
      ],
    })

    const run = {
      id: 'run-mp-multi',
      outputId,
      projectId: 'proj-1',
      projectPath: tmpRoot,
      microplanJson,
    }

    await (orchestrator as any).ensureSpecAtCorrectPath(run)

    const targetPath = path.join(tmpRoot, testFilePath)
    expect(fs.existsSync(targetPath)).toBe(true)
    expect(fs.readFileSync(targetPath, 'utf-8')).toBe(specContents)
  })

  // ── Sad Path ─────────────────────────────────────────────────────────────

  it('should skip when microplanJson is missing', async () => {
    const orchestrator = new ValidationOrchestrator()

    const run = {
      id: 'run-mp-no-json',
      outputId: 'out-mp-no-json',
      projectId: 'proj-1',
      projectPath: tmpRoot,
      microplanJson: null,
    }

    // Should not throw, just log warning and return early
    await expect((orchestrator as any).ensureSpecAtCorrectPath(run)).resolves.toBeUndefined()

    // Should not update database
    expect(mockValidationRunUpdate).not.toHaveBeenCalled()
  })

  it('should skip when microplanJson is invalid JSON', async () => {
    const orchestrator = new ValidationOrchestrator()

    const run = {
      id: 'run-mp-invalid-json',
      outputId: 'out-mp-invalid-json',
      projectId: 'proj-1',
      projectPath: tmpRoot,
      microplanJson: '{ invalid json',
    }

    // Should not throw, just log warning and return early
    await expect((orchestrator as any).ensureSpecAtCorrectPath(run)).resolves.toBeUndefined()

    // Should not update database
    expect(mockValidationRunUpdate).not.toHaveBeenCalled()
  })

  it('should skip when no test file found in microplan', async () => {
    const orchestrator = new ValidationOrchestrator()

    const microplanJson = JSON.stringify({
      task: 'Task without tests',
      microplans: [
        {
          id: 'MP-1',
          goal: 'Create service only',
          depends_on: [],
          files: [
            { path: 'src/service.ts', action: 'CREATE', what: 'Create service' },
            { path: 'src/types.ts', action: 'CREATE', what: 'Create types' },
          ],
          verify: 'npm run typecheck',
        },
      ],
    })

    const run = {
      id: 'run-mp-no-test',
      outputId: 'out-mp-no-test',
      projectId: 'proj-1',
      projectPath: tmpRoot,
      microplanJson,
    }

    // Should not throw, just log warning and return early
    await expect((orchestrator as any).ensureSpecAtCorrectPath(run)).resolves.toBeUndefined()

    // Should not update database
    expect(mockValidationRunUpdate).not.toHaveBeenCalled()
  })

  it('should skip when microplan structure is malformed', async () => {
    const orchestrator = new ValidationOrchestrator()

    const microplanJson = JSON.stringify({
      task: 'Malformed microplan',
      // Missing microplans array
    })

    const run = {
      id: 'run-mp-malformed',
      outputId: 'out-mp-malformed',
      projectId: 'proj-1',
      projectPath: tmpRoot,
      microplanJson,
    }

    // Should not throw, just log warning and return early
    await expect((orchestrator as any).ensureSpecAtCorrectPath(run)).resolves.toBeUndefined()

    // Should not update database
    expect(mockValidationRunUpdate).not.toHaveBeenCalled()
  })

  it('should throw when testFile is absolute path', async () => {
    const orchestrator = new ValidationOrchestrator()
    const outputId = 'out-mp-absolute'
    const artifactsDir = 'inputs'
    const absoluteTestPath = '/etc/passwd.spec.ts'

    mockProjectFindUnique.mockResolvedValue({
      workspace: { artifactsDir },
    })

    const microplanJson = JSON.stringify({
      task: 'Malicious task',
      microplans: [
        {
          id: 'MP-1',
          goal: 'Try to escape project root',
          depends_on: [],
          files: [
            { path: absoluteTestPath, action: 'CREATE', what: 'Malicious test' },
          ],
          verify: 'npm test',
        },
      ],
    })

    const run = {
      id: 'run-mp-absolute',
      outputId,
      projectId: 'proj-1',
      projectPath: tmpRoot,
      microplanJson,
    }

    // Should throw security error
    await expect((orchestrator as any).ensureSpecAtCorrectPath(run)).rejects.toThrow(
      'testFile must be a relative path inside the project root',
    )
  })

  it('should throw when testFile escapes project root', async () => {
    const orchestrator = new ValidationOrchestrator()
    const outputId = 'out-mp-escape'
    const artifactsDir = 'inputs'
    const escapingTestPath = '../../../etc/passwd.spec.ts'

    mockProjectFindUnique.mockResolvedValue({
      workspace: { artifactsDir },
    })

    const microplanJson = JSON.stringify({
      task: 'Malicious task',
      microplans: [
        {
          id: 'MP-1',
          goal: 'Try to escape project root',
          depends_on: [],
          files: [
            { path: escapingTestPath, action: 'CREATE', what: 'Malicious test' },
          ],
          verify: 'npm test',
        },
      ],
    })

    const run = {
      id: 'run-mp-escape',
      outputId,
      projectId: 'proj-1',
      projectPath: tmpRoot,
      microplanJson,
    }

    // Should throw security error
    await expect((orchestrator as any).ensureSpecAtCorrectPath(run)).rejects.toThrow(
      'testFile must not escape the project root',
    )
  })

  it('should throw when spec file not found in artifacts', async () => {
    const orchestrator = new ValidationOrchestrator()
    const outputId = 'out-mp-missing'
    const artifactsDir = 'inputs'
    const testFilePath = 'test/unit/missing.spec.ts'

    // Do NOT create the spec file in artifacts

    mockProjectFindUnique.mockResolvedValue({
      workspace: { artifactsDir },
    })

    const microplanJson = JSON.stringify({
      task: 'Task with missing spec',
      microplans: [
        {
          id: 'MP-1',
          goal: 'Create test',
          depends_on: [],
          files: [
            { path: testFilePath, action: 'CREATE', what: 'Test something' },
          ],
          verify: 'npm test',
        },
      ],
    })

    const run = {
      id: 'run-mp-missing',
      outputId,
      projectId: 'proj-1',
      projectPath: tmpRoot,
      microplanJson,
    }

    // Should throw error about missing spec file
    await expect((orchestrator as any).ensureSpecAtCorrectPath(run)).rejects.toThrow(
      'Spec file not found in artifacts staging path',
    )
  })

  it('should use existing file when spec not in artifacts but exists at target', async () => {
    const orchestrator = new ValidationOrchestrator()
    const outputId = 'out-mp-existing'
    const artifactsDir = 'inputs'
    const testFilePath = 'test/unit/existing.spec.ts'
    const existingContents = 'describe("existing", () => { expect(1).toBe(1) })'

    // Create spec at target location (but NOT in artifacts)
    const targetPath = path.join(tmpRoot, testFilePath)
    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
    fs.writeFileSync(targetPath, existingContents)

    mockProjectFindUnique.mockResolvedValue({
      workspace: { artifactsDir },
    })

    const microplanJson = JSON.stringify({
      task: 'Task with existing spec',
      microplans: [
        {
          id: 'MP-1',
          goal: 'Use existing test',
          depends_on: [],
          files: [
            { path: testFilePath, action: 'EDIT', what: 'Update test' },
          ],
          verify: 'npm test',
        },
      ],
    })

    const run = {
      id: 'run-mp-existing',
      outputId,
      projectId: 'proj-1',
      projectPath: tmpRoot,
      microplanJson,
    }

    // Should not throw, use existing file (with warning)
    await expect((orchestrator as any).ensureSpecAtCorrectPath(run)).resolves.toBeUndefined()

    // File should still exist with original contents
    expect(fs.existsSync(targetPath)).toBe(true)
    expect(fs.readFileSync(targetPath, 'utf-8')).toBe(existingContents)

    // Should still update database
    expect(mockValidationRunUpdate).toHaveBeenCalledWith({
      where: { id: 'run-mp-existing' },
      data: { testFilePath: targetPath.replace(/\\/g, '/') },
    })
  })
})
