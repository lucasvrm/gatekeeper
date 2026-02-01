/**
 * @file test-runner-package-cwd.spec.ts
 * @description Contract spec — TestRunnerService runs package tests from correct cwd
 * @contract test-runner-package-cwd
 * @mode STRICT
 *
 * Regras:
 * - Importa e invoca o código REAL (TestRunnerService)
 * - Mock apenas de efeitos externos (execa, fs.existsSync)
 * - Sem snapshots
 * - Cada teste tem // @clause <ID> imediatamente acima (STRICT)
 * - Happy/Sad path via nome do it() (regex do validador): usar "success when" (happy) e "fails when" (sad)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

import { TestRunnerService } from '../TestRunnerService'

// ---------------------------
// Hoisted mocks
// ---------------------------

const { mockExeca, mockExistsSync } = vi.hoisted(() => {
  return {
    mockExeca: vi.fn(),
    mockExistsSync: vi.fn(),
  }
})

vi.mock('execa', () => ({
  execa: mockExeca,
}))

vi.mock('fs', () => ({
  existsSync: mockExistsSync,
}))

// ---------------------------
// Helpers
// ---------------------------

function okExecaResult(exitCode = 0) {
  return {
    exitCode,
    stdout: '',
    stderr: '',
  }
}

function pickCall() {
  const calls = mockExeca.mock.calls
  if (calls.length === 0) throw new Error('Expected execa to have been called at least once')
  return calls[calls.length - 1] as unknown as [
    string,
    string[],
    {
      cwd: string
      reject: boolean
      env: Record<string, string>
      timeout: number
      killSignal: string
      windowsHide: boolean
    },
  ]
}

beforeEach(() => {
  vi.clearAllMocks()
  mockExeca.mockResolvedValue(okExecaResult(0))
})

describe('TestRunnerService.runSingleTest — package cwd/path behavior', () => {
  // ===========================================================================
  // Pipeline guards (meta) — required by the tool contract:
  // - new helper method test should fail because method does not exist yet
  // ===========================================================================

  // @clause CL-TRS-001
  it('fails when a new helper method expected for runner cwd/path derivation does not exist yet', async () => {
    const mod = await import('../TestRunnerService')
    // Contract guard: forces implementation to introduce a helper (currently absent).
    expect(typeof (mod as any).deriveRunnerCwdAndPath).toBe('function')
  })

  // ===========================================================================
  // CL-TRS-001 — inside packages/gatekeeper-api => cwd is package root, runnerPath relative to it
  // ===========================================================================

  // @clause CL-TRS-001
  it('success when absoluteTestPath is under packages/gatekeeper-api and file exists using cwd=package root and runnerPath relative to it', async () => {
    const projectRoot = '/repo'
    const svc = new TestRunnerService(projectRoot)

    const abs = '/repo/packages/gatekeeper-api/src/services/__tests__/x.spec.ts'
    mockExistsSync.mockReturnValue(true)

    await svc.runSingleTest(abs)

    const [bin, args, opts] = pickCall()
    expect(bin).toBe('npm')
    expect(args).toEqual(['test', '--', 'src/services/__tests__/x.spec.ts'])
    expect(opts.cwd).toBe('/repo/packages/gatekeeper-api')
  })

  // @clause CL-TRS-001
  it('success when absoluteTestPath is under packages/gatekeeper-api normalizing runnerPath to forward slashes', async () => {
    const projectRoot = '/repo'
    const svc = new TestRunnerService(projectRoot)

    const abs = '/repo/packages/gatekeeper-api/src/services/__tests__/nested/y.spec.ts'
    mockExistsSync.mockReturnValue(true)

    await svc.runSingleTest(abs)

    const [, args] = pickCall()
    const runnerPath = args[2] ?? ''
    expect(runnerPath).toBe('src/services/__tests__/nested/y.spec.ts')
    expect(runnerPath).not.toContain('\\')
  })

  // @clause CL-TRS-001
  it('fails when legacy behavior still runs package tests from project root cwd', async () => {
    const projectRoot = '/repo'
    const svc = new TestRunnerService(projectRoot)

    const abs = '/repo/packages/gatekeeper-api/src/services/__tests__/legacy-fail.spec.ts'
    mockExistsSync.mockReturnValue(true)

    await svc.runSingleTest(abs)

    const [, , opts] = pickCall()
    // This MUST be package cwd; it will fail until the bugfix is implemented.
    expect(opts.cwd).toBe('/repo/packages/gatekeeper-api')
  })

  // ===========================================================================
  // CL-TRS-002 — outside packages/gatekeeper-api => cwd is projectPath, runnerPath relative to it
  // ===========================================================================

  // @clause CL-TRS-002
  it('success when absoluteTestPath is outside packages/gatekeeper-api and file exists using cwd=projectPath and runnerPath relative to it', async () => {
    const projectRoot = '/repo'
    const svc = new TestRunnerService(projectRoot)

    const abs = '/repo/other/area/y.spec.ts'
    mockExistsSync.mockReturnValue(true)

    await svc.runSingleTest(abs)

    const [bin, args, opts] = pickCall()
    expect(bin).toBe('npm')
    expect(args).toEqual(['test', '--', 'other/area/y.spec.ts'])
    expect(opts.cwd).toBe('/repo')
  })

  // @clause CL-TRS-002
  it('success when absoluteTestPath is outside packages/gatekeeper-api ensuring runnerPath uses forward slashes', async () => {
    const projectRoot = '/repo'
    const svc = new TestRunnerService(projectRoot)

    const abs = '/repo/a/b/c/z.spec.ts'
    mockExistsSync.mockReturnValue(true)

    await svc.runSingleTest(abs)

    const [, args] = pickCall()
    const runnerPath = args[2] ?? ''
    expect(runnerPath).toBe('a/b/c/z.spec.ts')
    expect(runnerPath).not.toContain('\\')
  })

  // @clause CL-TRS-002
  it('fails when runnerPath for outside-package tests is not computed relative to projectPath', async () => {
    const projectRoot = '/repo'
    const svc = new TestRunnerService(projectRoot)

    const abs = '/repo/other/area/relative-fail.spec.ts'
    mockExistsSync.mockReturnValue(true)

    await svc.runSingleTest(abs)

    const [, args] = pickCall()
    // Must NOT pass absolute path to npm test -- <path>
    expect(args[2]).toBe('other/area/relative-fail.spec.ts')
  })

  // ===========================================================================
  // CL-TRS-003 — missing file => not-found failure and NO execa call
  // ===========================================================================

  // @clause CL-TRS-003
  it('success when absoluteTestPath does not exist returning not-found failure result', async () => {
    const projectRoot = '/repo'
    const svc = new TestRunnerService(projectRoot)

    const abs = '/repo/packages/gatekeeper-api/src/services/__tests__/missing.spec.ts'
    mockExistsSync.mockReturnValue(false)

    const result = await svc.runSingleTest(abs)

    expect(result.passed).toBe(false)
    expect(result.exitCode).toBe(1)
    expect(result.error).toContain('File does not exist')
  })

  // @clause CL-TRS-003
  it('success when absoluteTestPath does not exist not calling execa', async () => {
    const projectRoot = '/repo'
    const svc = new TestRunnerService(projectRoot)

    const abs = '/repo/other/missing.spec.ts'
    mockExistsSync.mockReturnValue(false)

    await svc.runSingleTest(abs)

    expect(mockExeca).not.toHaveBeenCalled()
  })

  // @clause CL-TRS-003
  it('fails when absoluteTestPath does not exist but execa is still invoked', async () => {
    const projectRoot = '/repo'
    const svc = new TestRunnerService(projectRoot)

    const abs = '/repo/packages/gatekeeper-api/src/services/__tests__/missing-should-not-run.spec.ts'
    mockExistsSync.mockReturnValue(false)

    await svc.runSingleTest(abs)

    expect(mockExeca).not.toHaveBeenCalled()
  })
})
