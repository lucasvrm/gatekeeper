import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PathResolverService } from './PathResolverService'

/**
 * Tests for PathResolverService refactor
 *
 * Contract: centralize-path-resolution
 * Mode: STRICT (all clauses must have @clause tags)
 */

// Mock fs modules
vi.mock('fs', () => ({
  existsSync: vi.fn(),
}))

vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  copyFile: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../db/client', () => ({
  prisma: {
    testPathConvention: {
      findFirst: vi.fn(),
    },
    validationRun: {
      update: vi.fn(),
    },
  },
}))

import { existsSync } from 'fs'
import { mkdir, copyFile } from 'fs/promises'
import { prisma } from '../db/client'

describe('PathResolverService - centralize-path-resolution', () => {
  let pathResolver: PathResolverService

  beforeEach(() => {
    pathResolver = new PathResolverService()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('CL-REF-001: testFilePath correto após uploadFiles', () => {
    // @clause CL-REF-001
    it('should update testFilePath based on convention when spec file is processed', async () => {
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

      const manifest = {
        testFile: 'Button.spec.tsx',
        files: [{ path: 'src/components/Button.tsx', action: 'CREATE' as const }]
      }

      const result = await pathResolver.ensureCorrectPath(
        '/project/artifacts/output-123/Button.spec.tsx',
        manifest,
        '/project',
        'output-123'
      )

      expect(result).toContain('src')
      expect(result).toContain('Button.spec.tsx')
    })

    // @clause CL-REF-001
    it('should return path within src/ directory structure', async () => {
      vi.mocked(existsSync).mockReturnValue(true)

      const manifest = {
        testFile: 'src/components/MyComponent.spec.tsx',
        files: []
      }

      const result = await pathResolver.ensureCorrectPath(
        '/tmp/artifacts/MyComponent.spec.tsx',
        manifest,
        '/project',
        'output-001'
      )

      expect(result).toContain('src')
    })
  })

  describe('CL-REF-002: Spec restaurado em rerunGate', () => {
    // @clause CL-REF-002
    it('should restore spec from artifacts when file missing at testFilePath', async () => {
      vi.mocked(existsSync).mockImplementation((p) => {
        if (String(p).includes('artifacts')) return true
        return false
      })

      const testFilePath = '/project/src/components/__tests__/Button.spec.tsx'
      const artifactsPath = '/project/artifacts/output-123/Button.spec.tsx'

      const result = await pathResolver.recheckAndCopy(testFilePath, artifactsPath)

      expect(mkdir).toHaveBeenCalled()
      expect(copyFile).toHaveBeenCalledWith(artifactsPath, testFilePath)
      expect(result).toBe(testFilePath)
    })

    // @clause CL-REF-002
    it('should throw error when both testFilePath and artifacts are missing', async () => {
      vi.mocked(existsSync).mockReturnValue(false)

      const testFilePath = '/project/src/missing.spec.tsx'
      const artifactsPath = '/project/artifacts/also-missing.spec.tsx'

      await expect(
        pathResolver.recheckAndCopy(testFilePath, artifactsPath)
      ).rejects.toThrow('Cannot restore test file')
    })

    // @clause CL-REF-002
    it('should return existing path when file already exists at testFilePath', async () => {
      vi.mocked(existsSync).mockReturnValue(true)

      const testFilePath = '/project/src/components/__tests__/Exists.spec.tsx'
      const artifactsPath = '/project/artifacts/Exists.spec.tsx'

      const result = await pathResolver.recheckAndCopy(testFilePath, artifactsPath)

      expect(copyFile).not.toHaveBeenCalled()
      expect(result).toBe(testFilePath)
    })
  })

  describe('CL-REF-003: EXECUTION run copia spec do CONTRACT', () => {
    // @clause CL-REF-003
    it('should process spec through ensureCorrectPath for EXECUTION runs', async () => {
      vi.mocked(existsSync).mockReturnValue(true)

      const manifest = {
        testFile: 'src/services/MyService.spec.ts',
        files: [{ path: 'src/services/MyService.ts', action: 'MODIFY' as const }]
      }

      const contractRunSpecPath = '/project/artifacts/contract-run/MyService.spec.ts'

      const result = await pathResolver.ensureCorrectPath(
        contractRunSpecPath,
        manifest,
        '/project',
        'execution-run-123'
      )

      expect(result).toContain('src')
      expect(result).toContain('MyService.spec.ts')
    })

    // @clause CL-REF-003
    it('should copy spec file when creating EXECUTION run from CONTRACT', async () => {
      vi.mocked(existsSync).mockImplementation((p) => {
        if (String(p).includes('contract-artifacts')) return true
        return false
      })

      const manifest = {
        testFile: 'packages/api/src/services/Auth.spec.ts',
        files: []
      }

      const result = await pathResolver.ensureCorrectPath(
        '/project/contract-artifacts/Auth.spec.ts',
        manifest,
        '/project',
        'exec-456'
      )

      expect(copyFile).toHaveBeenCalled()
      expect(result).toContain('Auth.spec.ts')
    })
  })

  describe('CL-REF-004: Fallback para src/ quando sem convenção', () => {
    // @clause CL-REF-004
    it('should use fallback path when no convention found', async () => {
      vi.mocked(existsSync).mockImplementation((p) => {
        if (String(p).includes('artifacts')) return true
        return false
      })
      vi.mocked(prisma.testPathConvention.findFirst).mockResolvedValue(null)

      const manifest = {
        testFile: 'Unknown.spec.ts',
        files: [{ path: 'src/unknown/Unknown.ts', action: 'CREATE' as const }]
      }

      const result = await pathResolver.ensureCorrectPath(
        '/project/artifacts/Unknown.spec.ts',
        manifest,
        '/project',
        'output-fallback'
      )

      expect(typeof result).toBe('string')
      expect(result).toContain('Unknown.spec.ts')
    })

    // @clause CL-REF-004
    it('should handle missing convention gracefully', async () => {
      vi.mocked(existsSync).mockReturnValue(false)
      vi.mocked(prisma.testPathConvention.findFirst).mockResolvedValue(null)

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const manifest = {
        testFile: 'NoConvention.spec.ts',
        files: []
      }

      await pathResolver.ensureCorrectPath(
        '/project/artifacts/NoConvention.spec.ts',
        manifest,
        '/project',
        'no-convention'
      ).catch(() => {})

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('CL-REF-005: Path DEVE conter /src/', () => {
    // @clause CL-REF-005
    it('should ensure testFilePath contains src for vitest monitoring', async () => {
      vi.mocked(existsSync).mockReturnValue(true)

      const manifest = {
        testFile: 'src/components/MyComponent.spec.tsx',
        files: []
      }

      const result = await pathResolver.ensureCorrectPath(
        '/tmp/artifacts/MyComponent.spec.tsx',
        manifest,
        '/project',
        'output-src'
      )

      expect(result).toContain('src')
    })

    // @clause CL-REF-005
    it('should place spec in src path based on manifest.testFile', async () => {
      vi.mocked(existsSync).mockReturnValue(true)

      const manifest = {
        testFile: 'packages/gatekeeper-api/src/services/Test.spec.ts',
        files: []
      }

      const result = await pathResolver.ensureCorrectPath(
        '/artifacts/Test.spec.ts',
        manifest,
        '/project',
        'test-123'
      )

      expect(result).toContain('src')
      expect(result).toContain('services')
    })
  })

  describe('CL-REF-006: Assinatura PathResolverService inalterada', () => {
    // @clause CL-REF-006
    it('should maintain ensureCorrectPath signature with 4 parameters', () => {
      expect(typeof pathResolver.ensureCorrectPath).toBe('function')
      expect(pathResolver.ensureCorrectPath.length).toBe(4)
    })

    // @clause CL-REF-006
    it('should maintain recheckAndCopy signature with 2 parameters', () => {
      expect(typeof pathResolver.recheckAndCopy).toBe('function')
      expect(pathResolver.recheckAndCopy.length).toBe(2)
    })

    // @clause CL-REF-006
    it('should have ensureCorrectPath return Promise<string>', async () => {
      vi.mocked(existsSync).mockReturnValue(true)

      const manifest = { testFile: 'src/test.spec.ts', files: [] }
      const result = pathResolver.ensureCorrectPath('/a', manifest, '/b', 'c')

      expect(result).toBeInstanceOf(Promise)
      const resolved = await result
      expect(typeof resolved).toBe('string')
    })
  })

  describe('CL-REF-007: Testes existentes passam', () => {
    // @clause CL-REF-007
    it('should have all required public methods available', () => {
      expect(typeof pathResolver.detectTestType).toBe('function')
      expect(typeof pathResolver.ensureCorrectPath).toBe('function')
      expect(typeof pathResolver.recheckAndCopy).toBe('function')
      expect(typeof pathResolver.getPathConvention).toBe('function')
      expect(typeof pathResolver.applyPattern).toBe('function')
    })

    // @clause CL-REF-007
    it('should detect test type correctly for components', () => {
      const manifest = {
        testFile: '',
        files: [{ path: 'src/components/Button.tsx', action: 'CREATE' as const }]
      }

      const result = pathResolver.detectTestType(manifest)

      expect(result).toBe('component')
    })

    // @clause CL-REF-007
    it('should detect test type correctly for services', () => {
      const manifest = {
        testFile: '',
        files: [{ path: 'src/services/AuthService.ts', action: 'CREATE' as const }]
      }

      const result = pathResolver.detectTestType(manifest)

      expect(result).toBe('service')
    })
  })

  describe('CL-REF-008: Lógica centralizada em uploadFiles', () => {
    // @clause CL-REF-008
    it('should have detectTestType as instance method for centralized access', () => {
      const service = new PathResolverService()
      
      const manifest = {
        testFile: '',
        files: [{ path: 'src/hooks/useAuth.ts', action: 'CREATE' as const }]
      }

      const result = service.detectTestType(manifest)

      expect(result).toBe('hook')
    })

    // @clause CL-REF-008
    it('should provide single entry point via ensureCorrectPath', async () => {
      vi.mocked(existsSync).mockReturnValue(true)

      const manifest = {
        testFile: 'src/lib/utils.spec.ts',
        files: [{ path: 'src/lib/utils.ts', action: 'MODIFY' as const }]
      }

      const result = await pathResolver.ensureCorrectPath(
        '/artifacts/utils.spec.ts',
        manifest,
        '/project',
        'centralized-001'
      )

      expect(typeof result).toBe('string')
      expect(result).toContain('utils.spec.ts')
    })
  })

  describe('CL-REF-009: detectTestType sem duplicação', () => {
    // @clause CL-REF-009
    it('should be the single source of detectTestType logic', () => {
      expect(typeof pathResolver.detectTestType).toBe('function')
      expect(pathResolver.detectTestType.length).toBe(1)
    })

    // @clause CL-REF-009
    it('should accept manifest parameter and return test type string', () => {
      const manifest = {
        testFile: '',
        files: [{ path: 'src/pages/Home.tsx', action: 'CREATE' as const }]
      }

      const result = pathResolver.detectTestType(manifest)

      expect(typeof result).toBe('string')
      expect(result).toBe('page')
    })

    // @clause CL-REF-009
    it('should detect multiple test types correctly', () => {
      const testCases = [
        { path: 'src/components/X.tsx', expected: 'component' },
        { path: 'src/services/X.ts', expected: 'service' },
        { path: 'src/hooks/X.ts', expected: 'hook' },
        { path: 'src/utils/X.ts', expected: 'util' },
        { path: 'src/lib/X.ts', expected: 'lib' },
      ]

      for (const tc of testCases) {
        const manifest = {
          testFile: '',
          files: [{ path: tc.path, action: 'CREATE' as const }]
        }
        const result = pathResolver.detectTestType(manifest)
        expect(result).toBe(tc.expected)
      }
    })
  })
})
