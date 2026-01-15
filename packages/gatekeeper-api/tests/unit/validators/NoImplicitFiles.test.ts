import { describe, it, expect } from 'vitest'
import { NoImplicitFilesValidator } from '../../../src/domain/validators/gate1/NoImplicitFiles'
import type { ValidationContext } from '../../../src/types/index'

describe('NoImplicitFiles Validator', () => {
  it('should pass when prompt has explicit file references only', async () => {
    const mockContext = {
      taskPrompt: 'Implement user authentication in src/auth.ts and src/user.ts files',
    } as ValidationContext

    const result = await NoImplicitFilesValidator.execute(mockContext)
    
    expect(result.passed).toBe(true)
    expect(result.status).toBe('PASSED')
  })

  it('should fail when prompt contains "outros arquivos"', async () => {
    const mockContext = {
      taskPrompt: 'Implement user authentication and update outros arquivos necessários',
    } as ValidationContext

    const result = await NoImplicitFilesValidator.execute(mockContext)
    
    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
    expect(result.evidence).toContain('outros arquivos')
  })

  it('should fail when prompt contains "other files"', async () => {
    const mockContext = {
      taskPrompt: 'Implement user authentication and other files as needed',
    } as ValidationContext

    const result = await NoImplicitFilesValidator.execute(mockContext)
    
    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
    expect(result.evidence).toContain('other files')
  })

  it('should fail when prompt contains "etc"', async () => {
    const mockContext = {
      taskPrompt: 'Update user module, auth module, etc',
    } as ValidationContext

    const result = await NoImplicitFilesValidator.execute(mockContext)
    
    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
    expect(result.evidence).toContain('etc')
  })

  it('should fail when prompt contains "..."', async () => {
    const mockContext = {
      taskPrompt: 'Implement user authentication in src/auth.ts, src/user.ts, ...',
    } as ValidationContext

    const result = await NoImplicitFilesValidator.execute(mockContext)
    
    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
    expect(result.evidence).toContain('...')
  })

  it('should fail when prompt contains "related files"', async () => {
    const mockContext = {
      taskPrompt: 'Implement authentication and update related files',
    } as ValidationContext

    const result = await NoImplicitFilesValidator.execute(mockContext)
    
    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
    expect(result.evidence).toContain('related files')
  })

  it('should fail when prompt contains "all files"', async () => {
    const mockContext = {
      taskPrompt: 'Update all files in the authentication module',
    } as ValidationContext

    const result = await NoImplicitFilesValidator.execute(mockContext)
    
    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
    expect(result.evidence).toContain('all files')
  })

  it('should detect multiple implicit terms', async () => {
    const mockContext = {
      taskPrompt: 'Update auth files and other related files, etc',
    } as ValidationContext

    const result = await NoImplicitFilesValidator.execute(mockContext)
    
    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
    expect(result.details?.foundTerms).toHaveLength(3)
  })

  it('should be case insensitive', async () => {
    const mockContext = {
      taskPrompt: 'Update files and OTHER FILES as needed',
    } as ValidationContext

    const result = await NoImplicitFilesValidator.execute(mockContext)
    
    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
  })
})
