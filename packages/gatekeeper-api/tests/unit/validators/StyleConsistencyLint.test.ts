import { describe, it, expect } from 'vitest'
import { StyleConsistencyLintValidator } from '../../../src/domain/validators/gate2/StyleConsistencyLint'
import type { ValidationContext, ManifestInput } from '../../../src/types/index'

describe('StyleConsistencyLint Validator', () => {
  it('should skip when no manifest provided', async () => {
    const mockContext = {
      manifest: null,
      projectPath: '/fake/path',
    } as ValidationContext

    const result = await StyleConsistencyLintValidator.execute(mockContext)
    
    expect(result.passed).toBe(true)
    expect(result.status).toBe('SKIPPED')
    expect(result.message).toContain('No manifest')
  })

  it('should skip when no lintable files in manifest', async () => {
    const manifest: ManifestInput = {
      files: [
        { path: 'README.md', action: 'MODIFY', reason: 'Update docs' },
        { path: 'package.json', action: 'MODIFY', reason: 'Add dep' },
      ],
      testFile: 'tests/user.test.ts',
    }

    const mockContext = {
      manifest,
      projectPath: '/fake/path',
      services: {
        lint: {} as any,
      } as any,
    } as ValidationContext

    const result = await StyleConsistencyLintValidator.execute(mockContext)
    
    expect(result.passed).toBe(true)
    expect(result.status).toBe('SKIPPED')
    expect(result.message).toContain('No lintable files')
  })

  it('should pass when all files pass lint', async () => {
    const manifest: ManifestInput = {
      files: [
        { path: 'src/user.ts', action: 'CREATE', reason: 'New module' },
        { path: 'src/auth.ts', action: 'MODIFY', reason: 'Update auth' },
      ],
      testFile: 'tests/user.test.ts',
    }

    const mockContext = {
      manifest,
      projectPath: __dirname,
      services: {
        lint: {
          lint: async () => ({
            success: true,
            errorCount: 0,
            warningCount: 0,
            output: 'All files pass',
          }),
        } as any,
      } as any,
    } as ValidationContext

    const result = await StyleConsistencyLintValidator.execute(mockContext)
    
    expect(result.passed).toBe(true)
    expect(result.status).toBe('PASSED')
    expect(result.metrics?.filesChecked).toBe(2)
  })

  it('should fail when lint finds errors', async () => {
    const manifest: ManifestInput = {
      files: [
        { path: 'src/user.ts', action: 'CREATE', reason: 'New module' },
      ],
      testFile: 'tests/user.test.ts',
    }

    const mockContext = {
      manifest,
      projectPath: __dirname,
      services: {
        lint: {
          lint: async () => ({
            success: false,
            errorCount: 3,
            warningCount: 1,
            output: 'Found 3 errors and 1 warning',
          }),
        } as any,
      } as any,
    } as ValidationContext

    const result = await StyleConsistencyLintValidator.execute(mockContext)
    
    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
    expect(result.message).toContain('3 error(s)')
    expect(result.message).toContain('1 warning(s)')
  })

  it('should exclude deleted files from lint', async () => {
    const manifest: ManifestInput = {
      files: [
        { path: 'src/user.ts', action: 'CREATE', reason: 'New module' },
        { path: 'src/old.ts', action: 'DELETE', reason: 'Remove old' },
      ],
      testFile: 'tests/user.test.ts',
    }

    let lintedFiles: string[] = []
    
    const mockContext = {
      manifest,
      projectPath: __dirname,
      services: {
        lint: {
          lint: async (files: string[]) => {
            lintedFiles = files
            return {
              success: true,
              errorCount: 0,
              warningCount: 0,
              output: '',
            }
          },
        } as any,
      } as any,
    } as ValidationContext

    await StyleConsistencyLintValidator.execute(mockContext)
    
    expect(lintedFiles).toHaveLength(1)
    expect(lintedFiles[0]).toBe('src/user.ts')
  })

  it('should handle lint service errors', async () => {
    const manifest: ManifestInput = {
      files: [
        { path: 'src/user.ts', action: 'CREATE', reason: 'New module' },
      ],
      testFile: 'tests/user.test.ts',
    }

    const mockContext = {
      manifest,
      projectPath: __dirname,
      services: {
        lint: {
          lint: async () => {
            throw new Error('ESLint not configured')
          },
        } as any,
      } as any,
    } as ValidationContext

    const result = await StyleConsistencyLintValidator.execute(mockContext)
    
    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
    expect(result.message).toContain('ESLint not configured')
  })
})
