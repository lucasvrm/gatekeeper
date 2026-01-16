import { describe, it, expect } from 'vitest'
import { CreateRunSchema } from '../../../src/api/schemas/validation.schema'

const baseInput = {
  outputId: 'output-1',
  projectPath: 'project/path',
  taskPrompt: 'Implement the authentication flow',
  manifest: {
    files: [
      { path: 'src/auth.ts', action: 'CREATE', reason: 'New auth module' },
    ],
    testFile: 'tests/auth.test.ts',
  },
  testFilePath: 'tests/auth.test.ts',
}

describe('CreateRunSchema', () => {
  it('requires outputId', () => {
    const { outputId, ...data } = baseInput
    const result = CreateRunSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('requires manifest', () => {
    const { manifest, ...data } = baseInput
    const result = CreateRunSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('requires testFilePath', () => {
    const { testFilePath, ...data } = baseInput
    const result = CreateRunSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('allows testFileContent as optional', () => {
    const result = CreateRunSchema.safeParse({
      ...baseInput,
      testFileContent: 'describe("auth", () => {})',
    })
    expect(result.success).toBe(true)
  })
})
