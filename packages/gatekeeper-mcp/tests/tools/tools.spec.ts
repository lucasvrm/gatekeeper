/**
 * Unit tests for MCP Tools
 */

import { describe, it, expect } from 'vitest'
import { getAllTools } from '../../src/tools/index.js'

describe('Tools Registry', () => {
  it('returns all registered tools', () => {
    const tools = getAllTools()

    expect(Array.isArray(tools)).toBe(true)
    expect(tools.length).toBeGreaterThan(0)
  })

  it('each tool has name, description, and inputSchema', () => {
    const tools = getAllTools()

    for (const tool of tools) {
      expect(tool).toHaveProperty('name')
      expect(tool).toHaveProperty('description')
      expect(tool).toHaveProperty('inputSchema')
      expect(typeof tool.name).toBe('string')
      expect(typeof tool.description).toBe('string')
      expect(typeof tool.inputSchema).toBe('object')
    }
  })

  it('includes expected tool names', () => {
    const tools = getAllTools()
    const toolNames = tools.map(t => t.name)

    // Phase 2 tools
    expect(toolNames).toContain('list_projects')
    expect(toolNames).toContain('get_project')
    expect(toolNames).toContain('create_run')
    expect(toolNames).toContain('get_run_status')
    expect(toolNames).toContain('list_runs')
    expect(toolNames).toContain('abort_run')
    expect(toolNames).toContain('upload_spec')
    expect(toolNames).toContain('continue_run')
    expect(toolNames).toContain('list_validators')

    // Phase 3 tools
    expect(toolNames).toContain('save_artifact')
    expect(toolNames).toContain('read_artifact')
    expect(toolNames).toContain('list_artifacts')
    expect(toolNames).toContain('delete_artifact')

    // Phase 4 tools
    expect(toolNames).toContain('get_session_config')
    expect(toolNames).toContain('get_active_context_files')
    expect(toolNames).toContain('get_active_snippets')
    expect(toolNames).toContain('get_variables')

    // Phase 5 tools
    expect(toolNames).toContain('configure_notifications')
  })
})
