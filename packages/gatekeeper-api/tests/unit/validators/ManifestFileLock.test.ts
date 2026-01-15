import { describe, it, expect } from 'vitest'
import { ManifestFileLockValidator } from '../../../src/domain/validators/gate1/ManifestFileLock'
import type { ValidationContext, ManifestInput } from '../../../src/types/index'

describe('ManifestFileLock Validator', () => {
  it('should pass with valid manifest', async () => {
    const manifest: ManifestInput = {
      files: [
        { path: 'src/user.ts', action: 'CREATE', reason: 'New user module' },
        { path: 'src/auth.ts', action: 'MODIFY', reason: 'Add authentication' },
      ],
      testFile: 'tests/user.test.ts',
    }

    const mockContext = {
      manifest,
    } as ValidationContext

    const result = await ManifestFileLockValidator.execute(mockContext)
    
    expect(result.passed).toBe(true)
    expect(result.status).toBe('PASSED')
    expect(result.metrics).toBeDefined()
  })

  it('should fail when manifest is missing', async () => {
    const mockContext = {
      manifest: null,
    } as ValidationContext

    const result = await ManifestFileLockValidator.execute(mockContext)
    
    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
    expect(result.message).toContain('No manifest')
  })

  it('should fail when files array is empty', async () => {
    const manifest: ManifestInput = {
      files: [],
      testFile: 'tests/user.test.ts',
    }

    const mockContext = {
      manifest,
    } as ValidationContext

    const result = await ManifestFileLockValidator.execute(mockContext)
    
    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
    expect(result.message).toContain('empty')
  })

  it('should fail when file path has glob patterns', async () => {
    const manifest: ManifestInput = {
      files: [
        { path: 'src/**/*.ts', action: 'MODIFY', reason: 'Update all files' },
      ],
      testFile: 'tests/user.test.ts',
    }

    const mockContext = {
      manifest,
    } as ValidationContext

    const result = await ManifestFileLockValidator.execute(mockContext)
    
    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
    expect(result.message).toContain('glob patterns')
  })

  it('should fail when file path contains vague references', async () => {
    const manifest: ManifestInput = {
      files: [
        { path: 'src/user.ts', action: 'CREATE', reason: 'New user module' },
        { path: 'src/etc/other.ts', action: 'MODIFY', reason: 'Update' },
      ],
      testFile: 'tests/user.test.ts',
    }

    const mockContext = {
      manifest,
    } as ValidationContext

    const result = await ManifestFileLockValidator.execute(mockContext)
    
    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
    expect(result.evidence).toContain('etc')
  })

  it('should fail when action is invalid', async () => {
    const manifest: ManifestInput = {
      files: [
        { path: 'src/user.ts', action: 'UPDATE' as any, reason: 'New user module' },
      ],
      testFile: 'tests/user.test.ts',
    }

    const mockContext = {
      manifest,
    } as ValidationContext

    const result = await ManifestFileLockValidator.execute(mockContext)
    
    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
    expect(result.message).toContain('invalid action')
  })

  it('should fail when testFile is missing', async () => {
    const manifest: ManifestInput = {
      files: [
        { path: 'src/user.ts', action: 'CREATE', reason: 'New user module' },
      ],
      testFile: '',
    }

    const mockContext = {
      manifest,
    } as ValidationContext

    const result = await ManifestFileLockValidator.execute(mockContext)
    
    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
  })

  it('should fail when testFile does not have test extension', async () => {
    const manifest: ManifestInput = {
      files: [
        { path: 'src/user.ts', action: 'CREATE', reason: 'New user module' },
      ],
      testFile: 'tests/user.ts',
    }

    const mockContext = {
      manifest,
    } as ValidationContext

    const result = await ManifestFileLockValidator.execute(mockContext)
    
    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
    expect(result.message).toContain('test or .spec extension')
  })
})
