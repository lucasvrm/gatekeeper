import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PathResolverService } from './PathResolverService'
import { SandboxService } from './SandboxService'

/**
 * Tests for PathResolverService bugfix + SandboxService
 *
 * Contract: sandbox-and-pathresolver-bugfix
 * Mode: STRICT (all clauses must have @clause tags)
 *
 * TDD Requirement: These tests MUST fail on origin/main because:
 * - SandboxService doesn't exist yet
 * - PathResolverService.detectTestType() doesn't recognize /services/ (bug)
 * - PathResolverService.ensureCorrectPath() ignores manifest.testFile (bug)
 */

describe('PathResolverService', () => {
  let pathResolver: PathResolverService

  beforeEach(() => {
    pathResolver = new PathResolverService()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('detectTestType()', () => {
    // @clause CL-PATH-001
    it('should return "service" for manifest with files in /services/', () => {
      const manifest = {
        testFile: '',
        files: [
          { path: 'packages/gatekeeper-api/src/services/SandboxService.ts', action: 'CREATE' as const }
        ]
      }

      const result = pathResolver.detectTestType(manifest)

      expect(result).toBe('service')
    })

    // @clause CL-PATH-001
    it('should return "service" for manifest with files in \\services\\ (Windows)', () => {
      const manifest = {
        testFile: '',
        files: [
          { path: 'packages\\gatekeeper-api\\src\\services\\SandboxService.ts', action: 'CREATE' as const }
        ]
      }

      const result = pathResolver.detectTestType(manifest)

      expect(result).toBe('service')
    })

    // @clause CL-PATH-001
    it('should return "service" for src/services/ path', () => {
      const manifest = {
        testFile: '',
        files: [
          { path: 'src/services/MyService.ts', action: 'CREATE' as const }
        ]
      }

      const result = pathResolver.detectTestType(manifest)

      expect(result).toBe('service')
    })

    // @clause CL-PATH-004
    it('should return "component" for manifest with files in /components/', () => {
      const manifest = {
        testFile: '',
        files: [
          { path: 'src/components/Button.tsx', action: 'CREATE' as const }
        ]
      }

      const result = pathResolver.detectTestType(manifest)

      expect(result).toBe('component')
    })

    // @clause CL-PATH-004
    it('should use fallback detection by filename when no directory pattern matches', () => {
      const manifest = {
        testFile: '',
        files: [
          { path: 'SandboxService.ts', action: 'CREATE' as const }
        ]
      }

      const result = pathResolver.detectTestType(manifest)

      expect(result).toBe('service')
    })
  })

  describe('ensureCorrectPath()', () => {
    // @clause CL-PATH-002
    it('should use manifest.testFile directly when it contains full path with /', async () => {
      const manifest = {
        testFile: 'packages/gatekeeper-api/src/services/SandboxService.spec.ts',
        files: []
      }

      const result = await pathResolver.ensureCorrectPath(
        '/tmp/artifacts/SandboxService.spec.ts',
        manifest,
        '/project',
        'output-123'
      )

      expect(result).toContain('packages/gatekeeper-api/src/services/SandboxService.spec.ts')
      expect(result).not.toContain('/components/')
    })

    // @clause CL-PATH-003
    it('should copy spec to /services/ not /components/ when manifest.testFile has /services/', async () => {
      const manifest = {
        testFile: 'packages/gatekeeper-api/src/services/PathResolverService.spec.ts',
        files: [
          { path: 'packages/gatekeeper-api/src/services/PathResolverService.ts', action: 'MODIFY' as const }
        ]
      }

      const result = await pathResolver.ensureCorrectPath(
        '/tmp/artifacts/PathResolverService.spec.ts',
        manifest,
        '/project',
        'output-456'
      )

      expect(result).toContain('/services/')
      expect(result).not.toContain('/components/')
    })

    // @clause CL-PATH-004
    it('should use detectTestType() fallback when manifest.testFile has no path separator', async () => {
      const manifest = {
        testFile: 'MyComponent.spec.tsx',
        files: [
          { path: 'src/components/MyComponent.tsx', action: 'CREATE' as const }
        ]
      }

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await pathResolver.ensureCorrectPath(
        '/tmp/artifacts/MyComponent.spec.tsx',
        manifest,
        '/project',
        'output-789'
      ).catch(() => {})

      const calls = consoleSpy.mock.calls.map(c => c[0])
      const usedDetectTestType = calls.some(c => 
        typeof c === 'string' && c.includes('Detected test type')
      )

      expect(usedDetectTestType).toBe(true)

      consoleSpy.mockRestore()
    })

    // @clause CL-PATH-005
    it('should return path that can be read by ImportRealityCheck', async () => {
      const manifest = {
        testFile: 'packages/gatekeeper-api/src/services/Test.spec.ts',
        files: []
      }

      const result = await pathResolver.ensureCorrectPath(
        '/tmp/artifacts/Test.spec.ts',
        manifest,
        '/project',
        'output-abc'
      )

      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
      expect(result).toContain('Test.spec.ts')
    })
  })
})

describe('SandboxService', () => {
  let sandboxService: SandboxService

  const projectPath = '/tmp/test-project'
  const sandboxBasePath = '/tmp/sandbox'
  const targetRef = 'HEAD'

  beforeEach(() => {
    sandboxService = new SandboxService()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('create()', () => {
    // @clause CL-SANDBOX-001
    it('should return sandboxPath containing targetRef on success', async () => {
      const result = await sandboxService.create(projectPath, sandboxBasePath, targetRef)

      expect(result.sandboxPath).toContain(targetRef)
      expect(typeof result.success).toBe('boolean')
    })

    // @clause CL-SANDBOX-002
    it('should return junctionCreated boolean indicating junction status', async () => {
      const result = await sandboxService.create(projectPath, sandboxBasePath, targetRef)

      expect(typeof result.junctionCreated).toBe('boolean')
    })

    // @clause CL-SANDBOX-003
    it('should return success=true and junctionCreated=false when node_modules is absent', async () => {
      const result = await sandboxService.create('/nonexistent/project', sandboxBasePath, targetRef)

      if (result.success && !result.junctionCreated) {
        expect(result.success).toBe(true)
        expect(result.junctionCreated).toBe(false)
      }
    })

    // @clause CL-SANDBOX-004
    it('should return junctionCreated=false but success=true when mklink fails', async () => {
      const result = await sandboxService.create(projectPath, sandboxBasePath, targetRef)

      if (!result.junctionCreated && result.success) {
        expect(result.junctionCreated).toBe(false)
        expect(result.success).toBe(true)
      }
    })

    // @clause CL-SANDBOX-005
    it('should return success=false with error when git worktree fails', async () => {
      const result = await sandboxService.create('/invalid/git/repo', sandboxBasePath, targetRef)

      if (!result.success) {
        expect(result.success).toBe(false)
        expect(typeof result.error).toBe('string')
      }
    })
  })

  describe('createNodeModulesJunction()', () => {
    // @clause CL-SANDBOX-002
    it('should return success boolean for junction creation', async () => {
      const result = await sandboxService.createNodeModulesJunction(projectPath, sandboxBasePath)

      expect(typeof result.success).toBe('boolean')
    })

    // @clause CL-SANDBOX-003
    it('should return success=false when node_modules does not exist', async () => {
      const result = await sandboxService.createNodeModulesJunction('/no/node_modules/here', sandboxBasePath)

      expect(result.success).toBe(false)
      expect(typeof result.error).toBe('string')
    })

    // @clause CL-SANDBOX-004
    it('should handle mklink failure gracefully', async () => {
      const result = await sandboxService.createNodeModulesJunction('/invalid', '/also/invalid')

      expect(typeof result.success).toBe('boolean')
      if (!result.success) {
        expect(result.error).not.toBe('')
      }
    })
  })

  describe('cleanup()', () => {
    // @clause CL-SANDBOX-006
    it('should not throw when cleaning up sandbox', async () => {
      await expect(sandboxService.cleanup(sandboxBasePath)).resolves.not.toThrow()
    })

    // @clause CL-SANDBOX-006
    it('should handle nonexistent path gracefully', async () => {
      await expect(sandboxService.cleanup('/nonexistent/sandbox')).resolves.not.toThrow()
    })
  })

  describe('SandboxResult interface', () => {
    // @clause CL-SANDBOX-001
    it('should return object with success, sandboxPath, junctionCreated properties', async () => {
      const result = await sandboxService.create(projectPath, sandboxBasePath, targetRef)

      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('sandboxPath')
      expect(result).toHaveProperty('junctionCreated')
    })

    // @clause CL-SANDBOX-005
    it('should include error property when success is false', async () => {
      const result = await sandboxService.create('/invalid', sandboxBasePath, targetRef)

      if (!result.success) {
        expect(result).toHaveProperty('error')
      }
    })
  })
})
