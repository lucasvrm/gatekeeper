import { describe, it, expect } from 'vitest'
import { TestIntentAlignmentValidator } from '../../../src/domain/validators/gate1/TestIntentAlignment'
import type { ValidationContext } from '../../../src/types/index'

describe('TestIntentAlignment Validator', () => {
  it('should pass with high alignment', async () => {
    const mockContext = {
      taskPrompt: 'Implement user authentication with email and password validation',
      testFilePath: 'tests/auth.test.ts',
      services: {
        git: {
          readFile: async () => `
            describe('Authentication', () => {
              it('should authenticate user with valid email and password', () => {
                expect(auth.validate(email, password)).toBe(true)
              })
              
              it('should reject invalid email format', () => {
                expect(() => auth.validate(badEmail, password)).toThrow()
              })
            })
          `,
        } as any,
      } as any,
    } as ValidationContext

    const result = await TestIntentAlignmentValidator.execute(mockContext)
    
    expect(result.passed).toBe(true)
    expect(result.status).toBe('PASSED')
  })

  it('should warn with low alignment', async () => {
    const mockContext = {
      taskPrompt: 'Implement user authentication with email and password validation',
      testFilePath: 'tests/database.test.ts',
      services: {
        git: {
          readFile: async () => `
            describe('Database', () => {
              it('should connect to database', () => {
                expect(db.connect()).resolves.toBe(true)
              })
              
              it('should query records', () => {
                expect(db.query()).resolves.toHaveLength(10)
              })
            })
          `,
        } as any,
      } as any,
    } as ValidationContext

    const result = await TestIntentAlignmentValidator.execute(mockContext)
    
    expect(result.passed).toBe(true)
    expect(result.status).toBe('WARNING')
    expect(result.message).toContain('Low alignment')
  })

  it('should fail when no test file path provided', async () => {
    const mockContext = {
      taskPrompt: 'Implement user authentication',
      testFilePath: undefined,
    } as ValidationContext

    const result = await TestIntentAlignmentValidator.execute(mockContext)
    
    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
  })

  it('should extract keywords correctly', async () => {
    const mockContext = {
      taskPrompt: 'Create function to calculate invoice total with taxes',
      testFilePath: 'tests/invoice.test.ts',
      services: {
        git: {
          readFile: async () => `
            describe('Invoice Calculator', () => {
              it('should calculate total with taxes', () => {
                expect(calculateTotal(100, 0.2)).toBe(120)
              })
            })
          `,
        } as any,
      } as any,
    } as ValidationContext

    const result = await TestIntentAlignmentValidator.execute(mockContext)
    
    expect(result.passed).toBe(true)
    expect(result.details?.alignmentRatio).toBeGreaterThan(0.3)
  })

  it('should filter stop words', async () => {
    const mockContext = {
      taskPrompt: 'The user should be able to authenticate with the system',
      testFilePath: 'tests/auth.test.ts',
      services: {
        git: {
          readFile: async () => `
            describe('User Authentication', () => {
              it('authenticates user in the system', () => {
                expect(authenticate(user)).toBe(true)
              })
            })
          `,
        } as any,
      } as any,
    } as ValidationContext

    const result = await TestIntentAlignmentValidator.execute(mockContext)
    
    expect(result.passed).toBe(true)
  })

  it('should be a soft gate (isHardBlock: false)', () => {
    expect(TestIntentAlignmentValidator.isHardBlock).toBe(false)
  })
})
