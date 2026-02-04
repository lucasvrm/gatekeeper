/**
 * GatekeeperValidationBridge — Unit Tests
 *
 * Tests the extractable logic of GatekeeperValidationBridge:
 *   - buildRejectionReport: formats structured validation results for LLM consumption
 *   - buildSkippedResult: returns a standardized "skipped" response
 *   - readArtifactData: reads plan.json/contract.json from disk, extracts manifest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('../../src/db/client.js', () => ({
  prisma: {
    workspace: { findMany: vi.fn().mockResolvedValue([]) },
    validationRun: { create: vi.fn(), findUnique: vi.fn() },
  },
}))

vi.mock('../../src/services/ValidationOrchestrator.js', () => ({
  ValidationOrchestrator: class MockOrchestrator {
    executeRun = vi.fn()
  },
}))

import { GatekeeperValidationBridge } from '../../src/services/GatekeeperValidationBridge.js'
import type { FailedValidator, GateResultSummary } from '../../src/services/GatekeeperValidationBridge.js'

// ─── Helpers ───────────────────────────────────────────────────────────────

function createBridge() { return new GatekeeperValidationBridge() }

function callReport(
  b: GatekeeperValidationBridge,
  runId: string,
  status: string,
  gates: GateResultSummary[],
  validators: FailedValidator[],
): string {
  return (b as any).buildRejectionReport(runId, status, gates, validators)
}

function callSkipped(b: GatekeeperValidationBridge, reason: string) {
  return (b as any).buildSkippedResult(reason)
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('GatekeeperValidationBridge', () => {
  let b: GatekeeperValidationBridge

  beforeEach(() => { b = createBridge() })

  // ── buildSkippedResult ───────────────────────────────────────────────

  describe('buildSkippedResult', () => {
    it('returns SKIPPED status with empty arrays', () => {
      const r = callSkipped(b, 'No manifest found')
      expect(r.status).toBe('SKIPPED')
      expect(r.passed).toBe(false)
      expect(r.validationRunId).toBe('')
      expect(r.failedValidators).toEqual([])
      expect(r.failedValidatorCodes).toEqual([])
      expect(r.gateResults).toEqual([])
    })

    it('includes reason in rejectionReport', () => {
      const r = callSkipped(b, 'manifest JSON is invalid')
      expect(r.rejectionReport).toBe('Validation skipped: manifest JSON is invalid')
    })
  })

  // ── buildRejectionReport ─────────────────────────────────────────────

  describe('buildRejectionReport', () => {
    it('formats header correctly', () => {
      const r = callReport(b, 'run-123', 'PASSED', [], [])
      expect(r).toContain('## Gatekeeper Validation Report')
      expect(r).toContain('**Run:** run-123')
      expect(r).toContain('**Status:** PASSED')
      expect(r).not.toContain('Failed Validators')
    })

    it('formats passing and failing gates with icons', () => {
      const gates: GateResultSummary[] = [
        { gate: 0, name: 'Preparation', passed: true, passedCount: 3, failedCount: 0, warningCount: 0 },
        { gate: 1, name: 'Tests', passed: false, passedCount: 5, failedCount: 2, warningCount: 1 },
      ]
      const r = callReport(b, 'run-456', 'FAILED', gates, [])
      expect(r).toContain('### ✅ Gate 0: Preparation')
      expect(r).toContain('Passed: 3 | Failed: 0 | Warnings: 0')
      expect(r).toContain('### ❌ Gate 1: Tests')
      expect(r).toContain('Passed: 5 | Failed: 2 | Warnings: 1')
    })

    it('formats failed validators with code, name, gate, message', () => {
      const validators: FailedValidator[] = [
        { code: 'NO_DECORATIVE_TESTS', name: 'No Decorative Tests', gate: 1, message: 'Found 2 empty tests' },
      ]
      const r = callReport(b, 'run-789', 'FAILED', [], validators)
      expect(r).toContain('## Failed Validators (Action Required)')
      expect(r).toContain('### ❌ `NO_DECORATIVE_TESTS` — No Decorative Tests (Gate 1)')
      expect(r).toContain('**Message:** Found 2 empty tests')
    })

    it('extracts violations, incompleteFiles, errors from JSON details', () => {
      const details = JSON.stringify({
        violations: ['file1.ts', 'file2.ts'],
        incompleteFiles: ['file3.ts'],
        errors: ['Error in line 10', 'Missing import'],
      })
      const r = callReport(b, 'run-x', 'FAILED', [], [
        { code: 'DIFF_SCOPE', name: 'Diff Scope', gate: 2, message: 'Out of scope', details },
      ])
      expect(r).toContain('**Scope Violations:** file1.ts, file2.ts')
      expect(r).toContain('**Incomplete Files:** file3.ts')
      expect(r).toContain('- Error in line 10')
      expect(r).toContain('- Missing import')
    })

    it('extracts failedTests from JSON details', () => {
      const details = JSON.stringify({ failedTests: ['test1 should work', 'test2 should not crash'] })
      const r = callReport(b, 'run-y', 'FAILED', [], [
        { code: 'TASK_TEST_PASSES', name: 'Task Tests', gate: 2, message: 'Tests failed', details },
      ])
      expect(r).toContain('**Failed Tests:**')
      expect(r).toContain('- test1 should work')
      expect(r).toContain('- test2 should not crash')
    })

    it('truncates large JSON details at 3000 chars', () => {
      const obj: Record<string, string> = {}
      for (let i = 0; i < 200; i++) obj[`key_${i}`] = 'x'.repeat(20)
      const details = JSON.stringify(obj)
      expect(details.length).toBeGreaterThan(3000)

      const r = callReport(b, 'run-z', 'FAILED', [], [
        { code: 'BIG', name: 'Big', gate: 1, message: 'Large', details },
      ])
      expect(r).toContain('... (truncated)')
    })

    it('handles plain string details (non-JSON)', () => {
      const r = callReport(b, 'run-p', 'FAILED', [], [
        { code: 'PLAIN', name: 'Plain', gate: 1, message: 'Failed', details: 'Simple error text' },
      ])
      expect(r).toContain('**Details:** Simple error text')
    })

    it('truncates large plain string details', () => {
      const r = callReport(b, 'run-l', 'FAILED', [], [
        { code: 'LONG', name: 'Long', gate: 1, message: 'Failed', details: 'A'.repeat(5000) },
      ])
      expect(r).toContain('... (truncated)')
      expect(r.length).toBeLessThan(5000)
    })

    it('limits errors array to 20 items', () => {
      const errors = Array.from({ length: 30 }, (_, i) => `Error ${i}`)
      const r = callReport(b, 'run-m', 'FAILED', [], [
        { code: 'MANY', name: 'Many', gate: 2, message: 'Lots', details: JSON.stringify({ errors }) },
      ])
      expect(r).toContain('- Error 19')
      expect(r).not.toContain('- Error 20')
    })

    it('limits failedTests array to 10 items', () => {
      const failedTests = Array.from({ length: 15 }, (_, i) => `test ${i}`)
      const r = callReport(b, 'run-t', 'FAILED', [], [
        { code: 'TESTS', name: 'Tests', gate: 2, message: 'Many', details: JSON.stringify({ failedTests }) },
      ])
      expect(r).toContain('- test 9')
      expect(r).not.toContain('- test 10')
    })

    it('handles multiple validators across multiple gates', () => {
      const r = callReport(b, 'run-multi', 'FAILED', [], [
        { code: 'V1', name: 'Val 1', gate: 1, message: 'G1 issue' },
        { code: 'V2', name: 'Val 2', gate: 2, message: 'G2 issue A' },
        { code: 'V3', name: 'Val 3', gate: 2, message: 'G2 issue B' },
      ])
      expect(r).toContain('`V1`')
      expect(r).toContain('`V2`')
      expect(r).toContain('`V3`')
    })
  })

  // ── readArtifactData ─────────────────────────────────────────────────

  describe('readArtifactData', () => {
    let tmpDir: string
    const outputId = 'test-output-123'

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gk-bridge-'))
    })

    afterEach(() => {
      if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    function setup(plan?: object, contract?: string) {
      const dir = path.join(tmpDir, 'artifacts', outputId)
      fs.mkdirSync(dir, { recursive: true })
      if (plan) fs.writeFileSync(path.join(dir, 'plan.json'), JSON.stringify(plan, null, 2))
      if (contract) fs.writeFileSync(path.join(dir, 'contract.json'), contract)
      ;(b as any).resolveWorkspaceRoot = async () => tmpDir
      ;(b as any).resolveArtifactsDirName = async () => 'artifacts'
    }

    it('extracts manifest from plan.json with nested manifest object', async () => {
      setup({
        manifest: { files: [{ path: 'src/app.ts', action: 'MODIFY' }], testFile: 'src/__tests__/app.spec.ts' },
      })
      const r = await (b as any).readArtifactData(outputId, tmpDir)
      expect(r.manifestJson).toBeDefined()
      const m = JSON.parse(r.manifestJson!)
      expect(m.files).toHaveLength(1)
      expect(m.testFile).toBe('src/__tests__/app.spec.ts')
      expect(r.testFilePath).toContain('app.spec.ts')
    })

    it('extracts manifest from plan.json with flat structure', async () => {
      setup({ files: [{ path: 'src/utils.ts', action: 'CREATE' }], testFile: 'test/utils.spec.ts' })
      const r = await (b as any).readArtifactData(outputId, tmpDir)
      const m = JSON.parse(r.manifestJson!)
      expect(m.testFile).toBe('test/utils.spec.ts')
    })

    it('reads contract.json when present', async () => {
      const json = JSON.stringify({ clauses: [{ id: 'CL-001' }] })
      setup({ manifest: { files: [], testFile: 'test.ts' } }, json)
      const r = await (b as any).readArtifactData(outputId, tmpDir)
      expect(r.contractJson).toBe(json)
    })

    it('returns empty object when artifact directory does not exist', async () => {
      ;(b as any).resolveWorkspaceRoot = async () => tmpDir
      ;(b as any).resolveArtifactsDirName = async () => 'artifacts'
      const r = await (b as any).readArtifactData('nonexistent', tmpDir)
      expect(r).toEqual({})
    })

    it('returns empty when plan.json has no manifest or files', async () => {
      setup({ description: 'No manifest here' })
      const r = await (b as any).readArtifactData(outputId, tmpDir)
      expect(r.manifestJson).toBeUndefined()
    })

    it('handles malformed plan.json gracefully', async () => {
      const dir = path.join(tmpDir, 'artifacts', outputId)
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, 'plan.json'), '{ invalid json !!!')
      ;(b as any).resolveWorkspaceRoot = async () => tmpDir
      ;(b as any).resolveArtifactsDirName = async () => 'artifacts'
      const r = await (b as any).readArtifactData(outputId, tmpDir)
      expect(r.manifestJson).toBeUndefined()
    })

    it('normalizes backslash paths in testFilePath', async () => {
      setup({ manifest: { files: [], testFile: 'src\\__tests__\\app.spec.ts' } })
      const r = await (b as any).readArtifactData(outputId, tmpDir)
      expect(r.testFilePath).not.toContain('\\')
    })
  })
})
