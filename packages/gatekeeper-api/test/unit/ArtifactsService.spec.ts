/**
 * ArtifactsService — Unit Tests
 *
 * Tests filesystem operations for artifact management:
 *   - listFolders: enumerate artifact directories
 *   - validateFolder: check if an artifact folder exists and has spec/plan
 *   - readContents: read plan.json and spec files
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import * as fss from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { ArtifactsService } from '../../src/services/ArtifactsService.js'

describe('ArtifactsService', () => {
  let svc: ArtifactsService
  let tmpDir: string

  beforeEach(() => {
    svc = new ArtifactsService()
    tmpDir = fss.mkdtempSync(path.join(os.tmpdir(), 'artifacts-svc-'))
  })

  afterEach(() => {
    fss.rmSync(tmpDir, { recursive: true, force: true })
  })

  // ── Helper ────────────────────────────────────────────────────────────

  async function createArtifact(
    outputId: string,
    opts: { plan?: object; specName?: string; specContent?: string } = {},
  ) {
    const dir = path.join(tmpDir, outputId)
    await fs.mkdir(dir, { recursive: true })
    if (opts.plan) {
      await fs.writeFile(path.join(dir, 'plan.json'), JSON.stringify(opts.plan))
    }
    if (opts.specName && opts.specContent) {
      await fs.writeFile(path.join(dir, opts.specName), opts.specContent)
    }
  }

  // ── validateFolder ─────────────────────────────────────────────────

  describe('validateFolder', () => {
    it('returns exists:false for missing directory', async () => {
      const r = await svc.validateFolder(tmpDir, 'nonexistent')
      expect(r.exists).toBe(false)
      expect(r.hasSpec).toBe(false)
      expect(r.hasPlan).toBe(false)
    })

    it('detects plan.json', async () => {
      await createArtifact('out1', { plan: { files: [] } })
      const r = await svc.validateFolder(tmpDir, 'out1')
      expect(r.exists).toBe(true)
      expect(r.hasPlan).toBe(true)
      expect(r.hasSpec).toBe(false)
    })

    it('detects .spec.ts file', async () => {
      await createArtifact('out2', { specName: 'app.spec.ts', specContent: 'test code' })
      const r = await svc.validateFolder(tmpDir, 'out2')
      expect(r.exists).toBe(true)
      expect(r.hasSpec).toBe(true)
      expect(r.specFileName).toBe('app.spec.ts')
    })

    it('detects .spec.tsx file', async () => {
      await createArtifact('out3', { specName: 'ui.spec.tsx', specContent: 'tsx test' })
      const r = await svc.validateFolder(tmpDir, 'out3')
      expect(r.hasSpec).toBe(true)
      expect(r.specFileName).toBe('ui.spec.tsx')
    })

    it('returns hasSpec:false for non-spec files', async () => {
      const dir = path.join(tmpDir, 'out4')
      await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(path.join(dir, 'readme.md'), 'hello')
      const r = await svc.validateFolder(tmpDir, 'out4')
      expect(r.exists).toBe(true)
      expect(r.hasSpec).toBe(false)
    })
  })

  // ── listFolders ───────────────────────────────────────────────────────

  describe('listFolders', () => {
    it('lists all artifact folders', async () => {
      await createArtifact('out-a', { plan: { task: 'A' } })
      await createArtifact('out-b', { specName: 'b.spec.ts', specContent: 'test b' })
      const folders = await svc.listFolders(tmpDir)
      expect(folders).toHaveLength(2)
      const ids = folders.map((f) => f.outputId).sort()
      expect(ids).toEqual(['out-a', 'out-b'])
    })

    it('correctly identifies plan/spec presence', async () => {
      await createArtifact('full', {
        plan: { files: [] },
        specName: 'component.spec.ts',
        specContent: 'describe("x", () => {})',
      })
      const folders = await svc.listFolders(tmpDir)
      const full = folders.find((f) => f.outputId === 'full')!
      expect(full.hasPlan).toBe(true)
      expect(full.hasSpec).toBe(true)
      expect(full.specFileName).toBe('component.spec.ts')
    })

    it('returns empty array for empty directory', async () => {
      const folders = await svc.listFolders(tmpDir)
      expect(folders).toEqual([])
    })
  })

  // ── readContents ──────────────────────────────────────────────────────

  describe('readContents', () => {
    it('reads plan.json and spec content', async () => {
      const plan = { files: [{ path: 'src/x.ts' }], testFile: 'x.spec.ts' }
      await createArtifact('full-read', {
        plan,
        specName: 'x.spec.ts',
        specContent: 'it("works", () => { expect(1).toBe(1) })',
      })
      const r = await svc.readContents(tmpDir, 'full-read')
      expect(r.planJson).toEqual(plan)
      expect(r.specContent).toContain('expect(1).toBe(1)')
      expect(r.specFileName).toBe('x.spec.ts')
    })

    it('returns nulls for missing folder', async () => {
      const r = await svc.readContents(tmpDir, 'missing')
      expect(r.planJson).toBeNull()
      expect(r.specContent).toBeNull()
      expect(r.specFileName).toBeNull()
    })

    it('handles malformed plan.json', async () => {
      const dir = path.join(tmpDir, 'bad-plan')
      await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(path.join(dir, 'plan.json'), 'NOT JSON!!!')
      const r = await svc.readContents(tmpDir, 'bad-plan')
      expect(r.planJson).toBeNull()
    })

    it('returns null specContent when no spec file', async () => {
      await createArtifact('no-spec', { plan: { task: 'x' } })
      const r = await svc.readContents(tmpDir, 'no-spec')
      expect(r.planJson).not.toBeNull()
      expect(r.specContent).toBeNull()
    })
  })
})
