import { describe, it, expect, beforeEach } from 'vitest'
import { NoDecorativeTestsValidator } from '../../../src/domain/validators/gate1/NoDecorativeTests'
import type { ValidationContext } from '../../../src/types/index'

describe('NoDecorativeTests Validator', () => {
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

  it('should pass when tests have proper assertions', async () => {
    mockContext.services!.git.readFile = async () => `
      describe('UserService', () => {
        it('should create user', async () => {
          const user = await createUser({ name: 'John' })
          expect(user.name).toBe('John')
          expect(user.id).toBeDefined()
        })
      })
    `

    const result = await NoDecorativeTestsValidator.execute(mockContext as ValidationContext)
    
    expect(result.passed).toBe(true)
    expect(result.status).toBe('PASSED')
  })

  it('should fail when test is completely empty', async () => {
    mockContext.services!.git.readFile = async () => `
      describe('UserService', () => {
        it('should create user', () => {})
      })
    `

    const result = await NoDecorativeTestsValidator.execute(mockContext as ValidationContext)
    
    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
    expect(result.message).toContain('empty')
  })

  it('should fail when test has no assertions', async () => {
    mockContext.services!.git.readFile = async () => `
      describe('UserService', () => {
        it('should create user', () => {
          const user = createUser({ name: 'John' })
          console.log(user)
        })
      })
    `

    const result = await NoDecorativeTestsValidator.execute(mockContext as ValidationContext)
    
    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
  })

  it('should fail when render without assertions', async () => {
    mockContext.services!.git.readFile = async () => `
      it('renders component', () => {
        render(<MyComponent />)
      })
    `

    const result = await NoDecorativeTestsValidator.execute(mockContext as ValidationContext)
    
    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
    expect(result.message).toContain('render')
  })

  it('should pass when render has assertions', async () => {
    mockContext.services!.git.readFile = async () => `
      it('renders component', () => {
        const { getByText } = render(<MyComponent />)
        expect(getByText('Hello')).toBeInTheDocument()
      })
    `

    const result = await NoDecorativeTestsValidator.execute(mockContext as ValidationContext)
    
    expect(result.passed).toBe(true)
    expect(result.status).toBe('PASSED')
  })

  it('should fail when no test file path provided', async () => {
    mockContext.testFilePath = undefined

    const result = await NoDecorativeTestsValidator.execute(mockContext as ValidationContext)
    
    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
  })
})
