import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest'

/**
 * Tests for SandboxService
 *
 * Contract: sandbox-service-node-modules-junction
 * Mode: STRICT (all clauses must have @clause tags)
 *
 * TDD Requirement: These tests MUST fail on origin/main because SandboxService doesn't exist yet.
 */

// Mock modules BEFORE imports
vi.mock('execa', () => ({
  execa: vi.fn(),
}))

vi.mock('simple-git', () => ({
  simpleGit: vi.fn(),
}))

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  lstatSync: vi.fn(),
}))

// Import after mocks are set up
import { SandboxService } from './SandboxService.js'
import { execa } from 'execa'
import { simpleGit } from 'simple-git'
import { existsSync, lstatSync } from 'fs'

describe('SandboxService', () => {
  let service: SandboxService
  let mockGit: {
    raw: Mock
  }

  const originalProjectPath = 'C:\\Coding\\pipe'
  const sandboxBasePath = 'C:\\Users\\lucas\\AppData\\Local\\Temp\\gatekeeper\\run-123'
  const targetRef = 'HEAD'
  const expectedSandboxPath = `${sandboxBasePath}\\${targetRef}`

  beforeEach(() => {
    vi.clearAllMocks()

    mockGit = {
      raw: vi.fn(),
    }
    ;(simpleGit as Mock).mockReturnValue(mockGit)
    ;(existsSync as Mock).mockReturnValue(true)
    ;(lstatSync as Mock).mockReturnValue({
      isSymbolicLink: () => false,
    })
    ;(execa as Mock).mockResolvedValue({ stdout: '', stderr: '' })

    service = new SandboxService()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('create()', () => {
    // @clause CL-SANDBOX-001
    it('should create worktree via git worktree add and return sandboxPath', async () => {
      mockGit.raw.mockResolvedValue('')
      ;(existsSync as Mock).mockReturnValue(true)

      const result = await service.create(originalProjectPath, sandboxBasePath, targetRef)

      expect(simpleGit).toHaveBeenCalledWith(originalProjectPath)
      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree',
        'add',
        expect.stringContaining(targetRef),
        targetRef,
      ])
      expect(result.success).toBe(true)
      expect(result.sandboxPath).toContain(targetRef)
    })

    // @clause CL-SANDBOX-002
    it('should create junction via mklink /J when node_modules exists', async () => {
      mockGit.raw.mockResolvedValue('')
      ;(existsSync as Mock).mockImplementation((path: string) => {
        if (path.includes('node_modules')) {
          return !path.includes(sandboxBasePath)
        }
        return true
      })
      ;(execa as Mock).mockResolvedValue({ stdout: 'Junction created', stderr: '' })

      const result = await service.create(originalProjectPath, sandboxBasePath, targetRef)

      expect(execa).toHaveBeenCalledWith(
        'cmd',
        expect.arrayContaining(['/c', 'mklink', '/J']),
        expect.objectContaining({ windowsHide: true })
      )
      expect(result.junctionCreated).toBe(true)
      expect(result.success).toBe(true)
    })

    // @clause CL-SANDBOX-003
    it('should NOT create junction and return junctionCreated=false when node_modules is absent', async () => {
      mockGit.raw.mockResolvedValue('')
      ;(existsSync as Mock).mockImplementation((path: string) => {
        return !path.includes('node_modules')
      })

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await service.create(originalProjectPath, sandboxBasePath, targetRef)

      expect(execa).not.toHaveBeenCalledWith(
        'cmd',
        expect.arrayContaining(['mklink']),
        expect.anything()
      )
      expect(result.junctionCreated).toBe(false)
      expect(result.success).toBe(true)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('node_modules')
      )

      consoleSpy.mockRestore()
    })

    // @clause CL-SANDBOX-004
    it('should return junctionCreated=false and success=true when mklink fails', async () => {
      mockGit.raw.mockResolvedValue('')
      ;(existsSync as Mock).mockImplementation((path: string) => {
        if (path.includes('node_modules')) {
          return !path.includes(sandboxBasePath)
        }
        return true
      })

      const mklinkError = new Error('Access denied: mklink requires elevated permissions')
      ;(execa as Mock).mockRejectedValueOnce(mklinkError)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await service.create(originalProjectPath, sandboxBasePath, targetRef)

      expect(result.junctionCreated).toBe(false)
      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    // @clause CL-SANDBOX-005
    it('should return success=false with error when git worktree add fails', async () => {
      const gitError = new Error('fatal: path already exists')
      mockGit.raw.mockRejectedValueOnce(gitError)
      ;(existsSync as Mock).mockReturnValue(false)

      const result = await service.create(originalProjectPath, sandboxBasePath, targetRef)

      expect(result.success).toBe(false)
      expect(result.error).toContain('fatal')
      expect(execa).not.toHaveBeenCalledWith(
        'cmd',
        expect.arrayContaining(['mklink']),
        expect.anything()
      )
    })

    // @clause CL-SANDBOX-008
    it('should use double quotes in mklink command for paths with spaces', async () => {
      const pathWithSpaces = 'C:\\Coding\\my project'
      const sandboxWithSpaces = 'C:\\Users\\lucas\\App Data\\Temp\\gatekeeper\\run-123'

      mockGit.raw.mockResolvedValue('')
      ;(existsSync as Mock).mockImplementation((path: string) => {
        if (path.includes('node_modules')) {
          return !path.includes(sandboxWithSpaces)
        }
        return true
      })
      ;(execa as Mock).mockResolvedValue({ stdout: '', stderr: '' })

      await service.create(pathWithSpaces, sandboxWithSpaces, targetRef)

      const execaCalls = (execa as Mock).mock.calls
      const mklinkCall = execaCalls.find(
        (call: unknown[]) => Array.isArray(call[1]) && call[1].includes('mklink')
      )

      expect(mklinkCall).toBeDefined()
      if (mklinkCall) {
        const args = mklinkCall[1] as string[]
        const targetPath = args.find((arg: string) => arg.includes('node_modules') && arg.includes(sandboxWithSpaces))
        const sourcePath = args.find((arg: string) => arg.includes('node_modules') && arg.includes(pathWithSpaces))
        expect(targetPath).toBeDefined()
        expect(sourcePath).toBeDefined()
      }
    })

    // @clause CL-SANDBOX-009
    it('should reuse existing worktree without error', async () => {
      const worktreeExistsError = new Error("fatal: 'HEAD' is already checked out")
      mockGit.raw.mockRejectedValueOnce(worktreeExistsError)
      ;(existsSync as Mock).mockReturnValue(true)
      ;(execa as Mock).mockResolvedValue({ stdout: '', stderr: '' })

      const result = await service.create(originalProjectPath, sandboxBasePath, targetRef)

      expect(result.success).toBe(true)
      expect(result.sandboxPath).toContain(targetRef)
    })
  })

  describe('createNodeModulesJunction()', () => {
    // @clause CL-SANDBOX-002
    it('should execute mklink /J with correct arguments', async () => {
      ;(existsSync as Mock).mockReturnValue(true)
      ;(execa as Mock).mockResolvedValue({ stdout: 'Junction created', stderr: '' })

      const result = await service.createNodeModulesJunction(
        originalProjectPath,
        expectedSandboxPath
      )

      expect(execa).toHaveBeenCalledWith(
        'cmd',
        [
          '/c',
          'mklink',
          '/J',
          expect.stringContaining('node_modules'),
          expect.stringContaining('node_modules'),
        ],
        expect.objectContaining({ windowsHide: true })
      )
      expect(result.success).toBe(true)
    })

    // @clause CL-SANDBOX-003
    it('should return success=false without error when node_modules does not exist', async () => {
      ;(existsSync as Mock).mockReturnValue(false)

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await service.createNodeModulesJunction(
        originalProjectPath,
        expectedSandboxPath
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('node_modules')
      expect(execa).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    // @clause CL-SANDBOX-004
    it('should return success=false with error message when mklink command fails', async () => {
      ;(existsSync as Mock).mockReturnValue(true)
      ;(execa as Mock).mockRejectedValueOnce(new Error('Permission denied'))

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await service.createNodeModulesJunction(
        originalProjectPath,
        expectedSandboxPath
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('Permission denied')

      consoleSpy.mockRestore()
    })
  })

  describe('cleanup()', () => {
    // @clause CL-SANDBOX-006
    it('should remove junction via rmdir then worktree via git worktree remove', async () => {
      ;(existsSync as Mock).mockReturnValue(true)
      ;(lstatSync as Mock).mockReturnValue({
        isSymbolicLink: () => true,
      })
      ;(execa as Mock).mockResolvedValue({ stdout: '', stderr: '' })
      mockGit.raw.mockResolvedValue('')

      await service.cleanup(expectedSandboxPath)

      expect(execa).toHaveBeenCalledWith(
        'cmd',
        ['/c', 'rmdir', expect.stringContaining('node_modules')],
        expect.objectContaining({ windowsHide: true })
      )
      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree',
        'remove',
        expectedSandboxPath,
        '--force',
      ])
    })

    // @clause CL-SANDBOX-006
    it('should skip rmdir if node_modules path does not exist', async () => {
      ;(existsSync as Mock).mockReturnValue(false)
      mockGit.raw.mockResolvedValue('')

      await service.cleanup(expectedSandboxPath)

      expect(execa).not.toHaveBeenCalledWith(
        'cmd',
        expect.arrayContaining(['rmdir']),
        expect.anything()
      )
      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree',
        'remove',
        expectedSandboxPath,
        '--force',
      ])
    })

    // @clause CL-SANDBOX-006
    it('should not propagate error if sandbox path does not exist', async () => {
      ;(existsSync as Mock).mockReturnValue(false)
      mockGit.raw.mockRejectedValueOnce(new Error('Path does not exist'))

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await expect(service.cleanup(expectedSandboxPath)).resolves.not.toThrow()

      consoleSpy.mockRestore()
    })

    // @clause CL-SANDBOX-007
    it('should use rmdir (not rm -rf) to ensure original node_modules is not affected', async () => {
      ;(existsSync as Mock).mockReturnValue(true)
      ;(lstatSync as Mock).mockReturnValue({
        isSymbolicLink: () => true,
      })
      ;(execa as Mock).mockResolvedValue({ stdout: '', stderr: '' })
      mockGit.raw.mockResolvedValue('')

      await service.cleanup(expectedSandboxPath)

      const execaCalls = (execa as Mock).mock.calls
      const hasRmRf = execaCalls.some(
        (call: unknown[]) =>
          typeof call[0] === 'string' &&
          (call[0].includes('rm') || (Array.isArray(call[1]) && call[1].some((arg: string) => arg.includes('-rf'))))
      )

      expect(hasRmRf).toBe(false)

      const hasRmdir = execaCalls.some(
        (call: unknown[]) => Array.isArray(call[1]) && call[1].includes('rmdir')
      )
      expect(hasRmdir).toBe(true)
    })
  })

  describe('Junction invariants', () => {
    // @clause CL-SANDBOX-007
    it('should never copy files from node_modules (junction is pointer only)', async () => {
      mockGit.raw.mockResolvedValue('')
      ;(existsSync as Mock).mockImplementation((path: string) => {
        if (path.includes('node_modules')) {
          return !path.includes(sandboxBasePath)
        }
        return true
      })
      ;(execa as Mock).mockResolvedValue({ stdout: '', stderr: '' })

      await service.create(originalProjectPath, sandboxBasePath, targetRef)

      const execaCalls = (execa as Mock).mock.calls
      const hasCopyCommand = execaCalls.some(
        (call: unknown[]) =>
          (typeof call[0] === 'string' && (call[0].includes('cp') || call[0].includes('copy') || call[0].includes('xcopy'))) ||
          (Array.isArray(call[1]) && call[1].some((arg: string) => 
            typeof arg === 'string' && (arg.includes('cp') || arg.includes('copy') || arg.includes('xcopy'))
          ))
      )

      expect(hasCopyCommand).toBe(false)
    })

    // @clause CL-SANDBOX-007
    it('should create junction using mklink /J (not /D which requires admin)', async () => {
      mockGit.raw.mockResolvedValue('')
      ;(existsSync as Mock).mockImplementation((path: string) => {
        if (path.includes('node_modules')) {
          return !path.includes(sandboxBasePath)
        }
        return true
      })
      ;(execa as Mock).mockResolvedValue({ stdout: '', stderr: '' })

      await service.create(originalProjectPath, sandboxBasePath, targetRef)

      const execaCalls = (execa as Mock).mock.calls
      const mklinkCall = execaCalls.find(
        (call: unknown[]) => Array.isArray(call[1]) && call[1].includes('mklink')
      )

      expect(mklinkCall).toBeDefined()
      if (mklinkCall) {
        const args = mklinkCall[1] as string[]
        expect(args).toContain('/J')
        expect(args).not.toContain('/D')
      }
    })
  })
})
