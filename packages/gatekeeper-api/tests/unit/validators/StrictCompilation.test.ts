import { describe, it, expect } from 'vitest'
import { StrictCompilationValidator } from '../../../src/domain/validators/gate2/StrictCompilation'
import type { ValidationContext } from '../../../src/types/index'

describe('StrictCompilation Validator', () => {
  it('should pass when compilation succeeds', async () => {
    const mockContext = {
      services: {
        compiler: {
          compile: async () => ({
            success: true,
            errors: [],
            output: 'Compilation successful',
          }),
        } as any,
      } as any,
    } as ValidationContext

    const result = await StrictCompilationValidator.execute(mockContext)
    
    expect(result.passed).toBe(true)
    expect(result.status).toBe('PASSED')
  })

  it('should fail when compilation has errors', async () => {
    const mockContext = {
      services: {
        compiler: {
          compile: async () => ({
            success: false,
            errors: [
              'src/user.ts:10:5 - error TS2322: Type "string" is not assignable to type "number"',
              'src/auth.ts:15:10 - error TS2304: Cannot find name "User"',
            ],
            output: '',
          }),
        } as any,
      } as any,
    } as ValidationContext

    const result = await StrictCompilationValidator.execute(mockContext)
    
    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
    expect(result.message).toContain('2 error(s)')
    expect(result.evidence).toContain('TS2322')
    expect(result.evidence).toContain('TS2304')
  })

  it('should limit errors in evidence to 10', async () => {
    const errors = Array.from({ length: 15 }, (_, i) => `Error ${i + 1}`)
    
    const mockContext = {
      services: {
        compiler: {
          compile: async () => ({
            success: false,
            errors,
            output: '',
          }),
        } as any,
      } as any,
    } as ValidationContext

    const result = await StrictCompilationValidator.execute(mockContext)
    
    expect(result.passed).toBe(false)
    expect(result.evidence).toContain('and 5 more')
    expect(result.details?.errorCount).toBe(15)
  })

  it('should handle compilation service errors', async () => {
    const mockContext = {
      services: {
        compiler: {
          compile: async () => {
            throw new Error('Compiler not found')
          },
        } as any,
      } as any,
    } as ValidationContext

    const result = await StrictCompilationValidator.execute(mockContext)
    
    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
    expect(result.message).toContain('Compiler not found')
  })
})
