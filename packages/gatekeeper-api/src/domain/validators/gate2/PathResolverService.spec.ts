import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Tests for PathResolverService - Glob Fallback
 *
 * Contract: pathresolver-glob-fallback v1.0
 * Mode: STRICT (all clauses must have @clause tags)
 *
 * Cláusulas cobertas:
 * - CL-GLOB-001: Glob encontra único match
 * - CL-GLOB-002: Glob não regride spec em src/
 * - CL-GLOB-003: Múltiplos matches fazem fallback
 * - CL-GLOB-004: Zero matches fazem fallback
 * - CL-GLOB-005: Path completo no manifest ignora glob
 * - CL-GLOB-006: Assinaturas inalteradas
 * - CL-GLOB-007: Testes existentes passam
 */

// Use vi.hoisted() to declare mocks that will be referenced in vi.mock()
const { mockGlobSync } = vi.hoisted(() => ({
  mockGlobSync: vi.fn(),
}))

// Mock fs modules
vi.mock(import('fs'), async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    existsSync: vi.fn(),
  }
})

vi.mock(import('fs/promises'), async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    mkdir: vi.fn().mockResolvedValue(undefined),
    copyFile: vi.fn().mockResolvedValue(undefined),
  }
})

vi.mock(import('../db/client'), async () => {
  return {
    prisma: {
      testPathConvention: {
        findFirst: vi.fn(),
      },
      validationRun: {
        update: vi.fn(),
      },
    },
  }
})

// Mock glob module using hoisted mock function
vi.mock(import('glob'), async () => {
  return {
    glob: {
      sync: mockGlobSync,
    },
    sync: mockGlobSync,
    default: {
      sync: mockGlobSync,
    },
  }
})

import { PathResolverService } from './PathResolverService'
import { existsSync } from 'fs'
import { mkdir, copyFile } from 'fs/promises'
import { prisma } from '../db/client'

describe('PathResolverService - pathresolver-glob-fallback', () => {
  let pathResolver: PathResolverService

  beforeEach(() => {
    pathResolver = new PathResolverService()
    vi.clearAllMocks()
    mockGlobSync.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ===========================================================================
  // CL-GLOB-001: Glob encontra único match
  // ===========================================================================
  describe('CL-GLOB-001: Glob encontra único match', () => {
    // @clause CL-GLOB-001
    it('should return glob-found path when exactly one match exists', async () => {
      const foundPath = '/project/packages/gatekeeper-mcp/GatekeeperMCP.spec.ts'
      
      mockGlobSync.mockReturnValue([foundPath])
      vi.mocked(existsSync).mockImplementation((p) => {
        if (String(p).includes('artifacts')) return true
        return false
      })
      vi.mocked(prisma.testPathConvention.findFirst).mockResolvedValue(null)

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const manifest = {
        testFile: 'GatekeeperMCP.spec.ts',
        files: []
      }

      const result = await pathResolver.ensureCorrectPath(
        '/project/artifacts/output-123/GatekeeperMCP.spec.ts',
        manifest,
        '/project',
        'output-123'
      )

      expect(result).toContain('packages/gatekeeper-mcp')
      expect(result).toContain('GatekeeperMCP.spec.ts')
      
      const logCalls = consoleSpy.mock.calls.map(c => c.join(' '))
      expect(logCalls.some(c => c.includes('Glob found unique match'))).toBe(true)
      
      consoleSpy.mockRestore()
    })

    // @clause CL-GLOB-001
    it('should copy file to glob-found destination when unique match found', async () => {
      const foundPath = '/project/packages/api/src/services/Auth.spec.ts'
      
      mockGlobSync.mockReturnValue([foundPath])
      vi.mocked(existsSync).mockImplementation((p) => {
        if (String(p).includes('artifacts')) return true
        return false
      })
      vi.mocked(prisma.testPathConvention.findFirst).mockResolvedValue(null)

      const manifest = {
        testFile: 'Auth.spec.ts',
        files: []
      }

      await pathResolver.ensureCorrectPath(
        '/project/artifacts/Auth.spec.ts',
        manifest,
        '/project',
        'output-glob'
      )

      expect(copyFile).toHaveBeenCalled()
      const copyCallArgs = vi.mocked(copyFile).mock.calls[0]
      expect(copyCallArgs[1]).toContain('packages/api/src/services')
    })
  })

  // ===========================================================================
  // CL-GLOB-002: Glob não regride spec em src/
  // ===========================================================================
  describe('CL-GLOB-002: Glob não regride spec em src/', () => {
    // @clause CL-GLOB-002
    it('should return src path when spec in src/components/ is found by glob', async () => {
      const foundPath = '/project/src/components/Button.spec.tsx'
      
      mockGlobSync.mockReturnValue([foundPath])
      vi.mocked(existsSync).mockImplementation((p) => {
        if (String(p).includes('artifacts')) return true
        return false
      })
      vi.mocked(prisma.testPathConvention.findFirst).mockResolvedValue(null)

      const manifest = {
        testFile: 'Button.spec.tsx',
        files: []
      }

      const result = await pathResolver.ensureCorrectPath(
        '/project/artifacts/Button.spec.tsx',
        manifest,
        '/project',
        'output-src-glob'
      )

      expect(result).toContain('/src/')
      expect(result).toContain('Button.spec.tsx')
    })

    // @clause CL-GLOB-002
    it('should preserve nested path when glob finds spec in deep src structure', async () => {
      const foundPath = '/project/src/features/auth/__tests__/Login.spec.tsx'
      
      mockGlobSync.mockReturnValue([foundPath])
      vi.mocked(existsSync).mockImplementation((p) => {
        if (String(p).includes('artifacts')) return true
        return false
      })
      vi.mocked(prisma.testPathConvention.findFirst).mockResolvedValue(null)

      const manifest = {
        testFile: 'Login.spec.tsx',
        files: []
      }

      const result = await pathResolver.ensureCorrectPath(
        '/project/artifacts/Login.spec.tsx',
        manifest,
        '/project',
        'nested-src'
      )

      expect(result).toContain('src/features/auth')
      expect(result).toContain('Login.spec.tsx')
    })
  })

  // ===========================================================================
  // CL-GLOB-003: Múltiplos matches fazem fallback
  // ===========================================================================
  describe('CL-GLOB-003: Múltiplos matches fazem fallback', () => {
    // @clause CL-GLOB-003
    it('should fallback to convention when glob finds multiple matches', async () => {
      const multipleMatches = [
        '/project/src/components/Button.spec.tsx',
        '/project/packages/ui/Button.spec.tsx',
      ]
      
      mockGlobSync.mockReturnValue(multipleMatches)
      vi.mocked(existsSync).mockImplementation((p) => {
        if (String(p).includes('artifacts')) return true
        return false
      })
      vi.mocked(prisma.testPathConvention.findFirst).mockResolvedValue({
        id: '1',
        testType: 'component',
        pathPattern: 'src/components/__tests__/{name}.spec.tsx',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const manifest = {
        testFile: 'Button.spec.tsx',
        files: [{ path: 'src/components/Button.tsx', action: 'MODIFY' as const }]
      }

      const result = await pathResolver.ensureCorrectPath(
        '/project/artifacts/Button.spec.tsx',
        manifest,
        '/project',
        'multiple-matches'
      )

      expect(result).not.toBe(multipleMatches[0])
      expect(result).not.toBe(multipleMatches[1])
      expect(result).toContain('src/components')
      
      const warnCalls = consoleSpy.mock.calls.map(c => c.join(' '))
      expect(warnCalls.some(c => c.includes('multiple matches'))).toBe(true)
      
      consoleSpy.mockRestore()
    })

    // @clause CL-GLOB-003
    it('throws no error when multiple matches are found', async () => {
      const multipleMatches = [
        '/project/a/Test.spec.ts',
        '/project/b/Test.spec.ts',
        '/project/c/Test.spec.ts',
      ]
      
      mockGlobSync.mockReturnValue(multipleMatches)
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(prisma.testPathConvention.findFirst).mockResolvedValue(null)

      const manifest = {
        testFile: 'Test.spec.ts',
        files: []
      }

      await expect(
        pathResolver.ensureCorrectPath(
          '/project/artifacts/Test.spec.ts',
          manifest,
          '/project',
          'no-throw-multi'
        )
      ).resolves.toBeDefined()
    })
  })

  // ===========================================================================
  // CL-GLOB-004: Zero matches fazem fallback
  // ===========================================================================
  describe('CL-GLOB-004: Zero matches fazem fallback', () => {
    // @clause CL-GLOB-004
    it('should fallback to convention when glob finds zero matches', async () => {
      mockGlobSync.mockReturnValue([])
      vi.mocked(existsSync).mockImplementation((p) => {
        if (String(p).includes('artifacts')) return true
        return false
      })
      vi.mocked(prisma.testPathConvention.findFirst).mockResolvedValue({
        id: '1',
        testType: 'service',
        pathPattern: 'src/services/__tests__/{name}.spec.ts',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const manifest = {
        testFile: 'NewService.spec.ts',
        files: [{ path: 'src/services/NewService.ts', action: 'CREATE' as const }]
      }

      const result = await pathResolver.ensureCorrectPath(
        '/project/artifacts/NewService.spec.ts',
        manifest,
        '/project',
        'zero-matches'
      )

      expect(result).toContain('src/services')
      expect(result).toContain('NewService.spec.ts')
    })

    // @clause CL-GLOB-004
    it('throws no error when glob finds nothing', async () => {
      mockGlobSync.mockReturnValue([])
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(prisma.testPathConvention.findFirst).mockResolvedValue(null)

      const manifest = {
        testFile: 'Nonexistent.spec.ts',
        files: []
      }

      await expect(
        pathResolver.ensureCorrectPath(
          '/project/artifacts/Nonexistent.spec.ts',
          manifest,
          '/project',
          'graceful-zero'
        )
      ).resolves.toBeDefined()
    })

    // @clause CL-GLOB-004
    it('should use src fallback when no glob matches and no convention', async () => {
      mockGlobSync.mockReturnValue([])
      vi.mocked(existsSync).mockImplementation((p) => {
        if (String(p).includes('artifacts')) return true
        return false
      })
      vi.mocked(prisma.testPathConvention.findFirst).mockResolvedValue(null)

      const manifest = {
        testFile: 'Orphan.spec.ts',
        files: []
      }

      const result = await pathResolver.ensureCorrectPath(
        '/project/artifacts/Orphan.spec.ts',
        manifest,
        '/project',
        'no-convention-fallback'
      )

      expect(result).toContain('src')
      expect(result).toContain('Orphan.spec.ts')
    })
  })

  // ===========================================================================
  // CL-GLOB-005: Path completo no manifest ignora glob
  // ===========================================================================
  describe('CL-GLOB-005: Path completo no manifest ignora glob', () => {
    // @clause CL-GLOB-005
    it('should skip glob when manifest.testFile contains path separators', async () => {
      vi.mocked(existsSync).mockReturnValue(true)
      
      const manifest = {
        testFile: 'packages/gatekeeper-api/src/services/PathResolverService.spec.ts',
        files: []
      }

      const result = await pathResolver.ensureCorrectPath(
        '/project/artifacts/PathResolverService.spec.ts',
        manifest,
        '/project',
        'full-path-manifest'
      )

      expect(mockGlobSync).not.toHaveBeenCalled()
      expect(result).toContain('packages/gatekeeper-api/src/services')
      expect(result).toContain('PathResolverService.spec.ts')
    })

    // @clause CL-GLOB-005
    it('should not call glob when manifest.testFile has forward slashes', async () => {
      vi.mocked(existsSync).mockReturnValue(true)
      
      const manifest = {
        testFile: 'src/components/__tests__/Button.spec.tsx',
        files: []
      }

      await pathResolver.ensureCorrectPath(
        '/project/artifacts/Button.spec.tsx',
        manifest,
        '/project',
        'forward-slash'
      )

      expect(mockGlobSync).not.toHaveBeenCalled()
    })

    // @clause CL-GLOB-005
    it('should not call glob when manifest.testFile has backslashes', async () => {
      vi.mocked(existsSync).mockReturnValue(true)
      
      const manifest = {
        testFile: 'src\\components\\Button.spec.tsx',
        files: []
      }

      await pathResolver.ensureCorrectPath(
        '/project/artifacts/Button.spec.tsx',
        manifest,
        '/project',
        'backslash'
      )

      expect(mockGlobSync).not.toHaveBeenCalled()
    })
  })

  // ===========================================================================
  // CL-GLOB-006: Assinaturas inalteradas
  // ===========================================================================
  describe('CL-GLOB-006: Assinaturas inalteradas', () => {
    // @clause CL-GLOB-006
    it('should accept 4 parameters in ensureCorrectPath', () => {
      expect(pathResolver.ensureCorrectPath.length).toBe(4)
    })

    // @clause CL-GLOB-006
    it('should return Promise of string from ensureCorrectPath', async () => {
      vi.mocked(existsSync).mockReturnValue(true)
      mockGlobSync.mockReturnValue([])

      const manifest = { testFile: 'src/test.spec.ts', files: [] }
      const result = pathResolver.ensureCorrectPath('/a', manifest, '/b', 'c')

      expect(result).toBeInstanceOf(Promise)
      
      const resolved = await result
      expect(typeof resolved).toBe('string')
    })

    // @clause CL-GLOB-006
    it('should have recheckAndCopy with 2 parameters', () => {
      expect(pathResolver.recheckAndCopy.length).toBe(2)
    })

    // @clause CL-GLOB-006
    it('should have detectTestType with 1 parameter', () => {
      expect(pathResolver.detectTestType.length).toBe(1)
    })
  })

  // ===========================================================================
  // CL-GLOB-007: Testes existentes passam
  // ===========================================================================
  describe('CL-GLOB-007: Testes existentes passam', () => {
    // @clause CL-GLOB-007
    it('should detect component type correctly', () => {
      const manifest = {
        testFile: '',
        files: [{ path: 'src/components/Button.tsx', action: 'CREATE' as const }]
      }
      expect(pathResolver.detectTestType(manifest)).toBe('component')
    })

    // @clause CL-GLOB-007
    it('should detect service type correctly', () => {
      const manifest = {
        testFile: '',
        files: [{ path: 'src/services/Auth.ts', action: 'CREATE' as const }]
      }
      expect(pathResolver.detectTestType(manifest)).toBe('service')
    })

    // @clause CL-GLOB-007
    it('should detect hook type correctly', () => {
      const manifest = {
        testFile: '',
        files: [{ path: 'src/hooks/useAuth.ts', action: 'CREATE' as const }]
      }
      expect(pathResolver.detectTestType(manifest)).toBe('hook')
    })

    // @clause CL-GLOB-007
    it('should not copy when file exists in recheckAndCopy', async () => {
      vi.mocked(existsSync).mockReturnValue(true)

      const testFilePath = '/project/src/test.spec.ts'
      const artifactsPath = '/project/artifacts/test.spec.ts'

      const result = await pathResolver.recheckAndCopy(testFilePath, artifactsPath)

      expect(result).toBe(testFilePath)
      expect(copyFile).not.toHaveBeenCalled()
    })

    // @clause CL-GLOB-007
    it('should return convention data from getPathConvention', async () => {
      vi.mocked(prisma.testPathConvention.findFirst).mockResolvedValue({
        id: '1',
        testType: 'component',
        pathPattern: 'src/components/__tests__/{name}.spec.tsx',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await pathResolver.getPathConvention('component')

      expect(result).toEqual({
        testType: 'component',
        pathPattern: 'src/components/__tests__/{name}.spec.tsx',
      })
    })

    // @clause CL-GLOB-007
    it('should apply pattern with placeholders correctly', () => {
      const manifest = {
        testFile: 'Button.spec.tsx',
        files: []
      }

      const result = pathResolver.applyPattern(
        'src/components/__tests__/{name}.spec.tsx',
        manifest,
        '/project',
        'Button.spec.tsx'
      )

      expect(result).toContain('src/components/__tests__')
      expect(result).toContain('Button.spec.tsx')
    })
  })
})
