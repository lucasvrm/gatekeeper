/**
 * Unit tests for MCP Prompts
 */

import { describe, it, expect } from 'vitest'
import { getAllPrompts, handlePromptRequest } from '../../src/prompts/index.js'

describe('Prompts Registry', () => {
  it('returns all registered prompts', () => {
    const prompts = getAllPrompts()

    expect(Array.isArray(prompts)).toBe(true)
    expect(prompts.length).toBeGreaterThan(0)
  })

  it('each prompt has name and description', () => {
    const prompts = getAllPrompts()

    for (const prompt of prompts) {
      expect(prompt).toHaveProperty('name')
      expect(prompt).toHaveProperty('description')
      expect(typeof prompt.name).toBe('string')
      expect(typeof prompt.description).toBe('string')
    }
  })

  it('includes expected prompt names', () => {
    const prompts = getAllPrompts()
    const promptNames = prompts.map(p => p.name)

    expect(promptNames).toContain('create_plan')
    expect(promptNames).toContain('generate_spec')
    expect(promptNames).toContain('implement_code')
    expect(promptNames).toContain('fix_gate_failure')
  })
})

describe('Prompt Handlers', () => {
  const nonExistentDocsDir = '/nonexistent/docs/dir'

  it('create_plan returns messages with taskDescription', () => {
    const result = handlePromptRequest(
      'create_plan',
      { taskDescription: 'Test task' },
      nonExistentDocsDir
    )

    expect(result.messages).toHaveLength(1)
    expect(result.messages[0].role).toBe('user')
    expect(result.messages[0].content.text).toContain('Test task')
  })

  it('generate_spec returns messages with contractContent', () => {
    const result = handlePromptRequest(
      'generate_spec',
      { contractContent: 'CL-001: Test clause' },
      nonExistentDocsDir
    )

    expect(result.messages).toHaveLength(1)
    expect(result.messages[0].role).toBe('user')
    expect(result.messages[0].content.text).toContain('CL-001: Test clause')
  })

  it('implement_code returns messages with spec and contract', () => {
    const result = handlePromptRequest(
      'implement_code',
      {
        specContent: 'describe("test")',
        contractContent: 'CL-001',
      },
      nonExistentDocsDir
    )

    expect(result.messages).toHaveLength(1)
    expect(result.messages[0].content.text).toContain('describe("test")')
    expect(result.messages[0].content.text).toContain('CL-001')
  })

  it('fix_gate_failure returns messages with validator and error', () => {
    const result = handlePromptRequest(
      'fix_gate_failure',
      {
        validatorCode: 'TEST_SYNTAX_VALID',
        errorMessage: 'SyntaxError: Unexpected token',
      },
      nonExistentDocsDir
    )

    expect(result.messages).toHaveLength(1)
    expect(result.messages[0].content.text).toContain('TEST_SYNTAX_VALID')
    expect(result.messages[0].content.text).toContain('SyntaxError: Unexpected token')
  })

  it('handles missing DOCS_DIR gracefully with fallback', () => {
    const result = handlePromptRequest(
      'create_plan',
      { taskDescription: 'Test' },
      nonExistentDocsDir
    )

    // Should not throw, should contain fallback indicator
    expect(result.messages).toHaveLength(1)
    expect(result.messages[0].content.text).toMatch(/not found|fallback/i)
  })
})
