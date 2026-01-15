import { describe, it, expect, beforeEach } from 'vitest'
import { TestCoversHappyAndSadPathValidator } from '../../../src/domain/validators/gate1/TestCoversHappyAndSadPath'
import type { ValidationContext } from '../../../src/types/index'

describe('TestCoversHappyAndSadPath Validator', () => {
  let mockContext: Partial<ValidationContext>

  beforeEach(() => {
    mockContext = {
      testFilePath: 'tests/example.test.ts',
      services: {
        git: {
          readFile: async (path: string) => '',
        } as any,
      } as any,
    } as ValidationContext
  })

  it('should pass when test has both happy and sad path', async () => {
    mockContext.services!.git.readFile = async () => `
      describe('UserService', () => {
        it('should successfully create user', async () => {
          expect(result).toBe(true)
        })
        
        it('should throw error when invalid data', async () => {
          expect(() => createUser({})).toThrow()
        })
      })
    `

    const result = await TestCoversHappyAndSadPathValidator.execute(mockContext as ValidationContext)
    
    expect(result.passed).toBe(true)
    expect(result.status).toBe('PASSED')
  })

  it('should fail when test only has happy path', async () => {
    mockContext.services!.git.readFile = async () => `
      describe('UserService', () => {
        it('should successfully create user', async () => {
          expect(result).toBe(true)
        })
      })
    `

    const result = await TestCoversHappyAndSadPathValidator.execute(mockContext as ValidationContext)
    
    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
    expect(result.message).toContain('sad path')
  })

  it('should fail when test only has sad path', async () => {
    mockContext.services!.git.readFile = async () => `
      describe('UserService', () => {
        it('should fail when invalid data', async () => {
          expect(() => createUser({})).toThrow()
        })
      })
    `

    const result = await TestCoversHappyAndSadPathValidator.execute(mockContext as ValidationContext)
    
    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
    expect(result.message).toContain('happy path')
  })

  it('should fail when no test file path provided', async () => {
    mockContext.testFilePath = undefined

    const result = await TestCoversHappyAndSadPathValidator.execute(mockContext as ValidationContext)
    
    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
  })

  it('should detect various happy path patterns', async () => {
    mockContext.services!.git.readFile = async () => `
      it('when valid input passes', () => {})
      it('should work correctly', () => {})
      it('fails on invalid data', () => {})
    `

    const result = await TestCoversHappyAndSadPathValidator.execute(mockContext as ValidationContext)
    
    expect(result.passed).toBe(true)
    expect(result.status).toBe('PASSED')
  })
})
