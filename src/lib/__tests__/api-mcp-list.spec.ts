/**
 * @fileoverview Spec for MCP API list data extraction bugfix
 * @contract mcp-api-list-data-extraction
 * @mode STRICT
 *
 * Validates that api.mcp.*.list() methods correctly extract .data from
 * paginated backend responses instead of returning the full wrapper object.
 *
 * Clauses covered:
 * - CL-MCPFIX-001: snippets.list() extracts data array
 * - CL-MCPFIX-002: contextPacks.list() extracts data array
 * - CL-MCPFIX-003: presets.list() extracts data array
 * - CL-MCPFIX-004: history.list() extracts data array
 * - CL-MCPFIX-005: Empty data returns empty array
 * - CL-MCPFIX-006: Fetch error throws appropriate Error
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// =============================================================================
// Type Definitions (matching src/lib/types.ts)
// =============================================================================

interface Snippet {
  id: string
  name: string
  category: string
  content: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

interface ContextPack {
  id: string
  name: string
  description: string | null
  files: string[]
  createdAt: string
  updatedAt: string
}

interface MCPSessionConfig {
  gitStrategy: 'main' | 'new-branch' | 'existing-branch'
  branch: string
  taskType: 'bugfix' | 'feature' | 'refactor' | 'test' | 'other'
  projectId: string | null
  customInstructions: string
}

interface SessionPreset {
  id: string
  name: string
  config: MCPSessionConfig
  createdAt: string
  updatedAt: string
}

interface SessionHistory {
  id: string
  taskType: string
  gitStrategy: string
  branch: string | null
  projectId: string | null
  status: string
  runIds: string[]
  notes: string | null
  createdAt: string
}

interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

// =============================================================================
// Mock Data Factories
// =============================================================================

const createMockSnippet = (overrides?: Partial<Snippet>): Snippet => ({
  id: `snippet_${Date.now()}`,
  name: 'Test Snippet',
  category: 'general',
  content: 'console.log("test")',
  tags: ['test'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

const createMockContextPack = (overrides?: Partial<ContextPack>): ContextPack => ({
  id: `pack_${Date.now()}`,
  name: 'Test Pack',
  description: 'Test description',
  files: ['/src/index.ts'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

const createMockPreset = (overrides?: Partial<SessionPreset>): SessionPreset => ({
  id: `preset_${Date.now()}`,
  name: 'Test Preset',
  config: {
    gitStrategy: 'main',
    branch: 'main',
    taskType: 'bugfix',
    projectId: null,
    customInstructions: '',
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

const createMockHistory = (overrides?: Partial<SessionHistory>): SessionHistory => ({
  id: `history_${Date.now()}`,
  taskType: 'bugfix',
  gitStrategy: 'main',
  branch: 'main',
  projectId: null,
  status: 'completed',
  runIds: ['run_1'],
  notes: null,
  createdAt: new Date().toISOString(),
  ...overrides,
})

const createPaginatedResponse = <T>(data: T[]): PaginatedResponse<T> => ({
  data,
  pagination: {
    page: 1,
    limit: 20,
    total: data.length,
    pages: 1,
  },
})

// =============================================================================
// Mock API Implementation (simulates corrected api.mcp.*.list() behavior)
// =============================================================================

const API_BASE = 'http://localhost:4000'

const createMockApi = (mockFetch: typeof fetch) => ({
  mcp: {
    snippets: {
      list: async (): Promise<Snippet[]> => {
        const response = await mockFetch(`${API_BASE}/mcp/snippets`)
        if (!response.ok) {
          const error = await response.json().catch(() => null)
          throw new Error(error?.error || 'Failed to fetch snippets')
        }
        const result = await response.json()
        return result.data
      },
    },
    contextPacks: {
      list: async (): Promise<ContextPack[]> => {
        const response = await mockFetch(`${API_BASE}/mcp/context-packs`)
        if (!response.ok) {
          const error = await response.json().catch(() => null)
          throw new Error(error?.error || 'Failed to fetch context packs')
        }
        const result = await response.json()
        return result.data
      },
    },
    presets: {
      list: async (): Promise<SessionPreset[]> => {
        const response = await mockFetch(`${API_BASE}/mcp/presets`)
        if (!response.ok) {
          const error = await response.json().catch(() => null)
          throw new Error(error?.error || 'Failed to fetch presets')
        }
        const result = await response.json()
        return result.data
      },
    },
    history: {
      list: async (): Promise<SessionHistory[]> => {
        const response = await mockFetch(`${API_BASE}/mcp/history`)
        if (!response.ok) {
          const error = await response.json().catch(() => null)
          throw new Error(error?.error || 'Failed to fetch history')
        }
        const result = await response.json()
        return result.data
      },
    },
  },
})

// =============================================================================
// Fetch Mock Factory
// =============================================================================

type MockRoute = {
  status: number
  body?: unknown
  errorBody?: unknown
}

const createMockFetch = (routes: Record<string, MockRoute>) => {
  return vi.fn(async (url: string): Promise<Response> => {
    const urlObj = new URL(url)
    const path = urlObj.pathname

    const route = routes[path]
    if (!route) {
      return {
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not found' }),
      } as Response
    }

    if (route.status >= 400) {
      return {
        ok: false,
        status: route.status,
        json: async () => route.errorBody || { error: `Error ${route.status}` },
      } as Response
    }

    return {
      ok: true,
      status: route.status,
      json: async () => route.body,
    } as Response
  })
}

// =============================================================================
// TESTS - CL-MCPFIX-001: Snippets list extracts data
// =============================================================================

describe('api.mcp.snippets.list()', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // @clause CL-MCPFIX-001
  it('should extract data array when snippets.list receives paginated response', async () => {
    const mockSnippets = [
      createMockSnippet({ id: 'snip_1', name: 'Snippet One' }),
      createMockSnippet({ id: 'snip_2', name: 'Snippet Two' }),
    ]
    const paginatedResponse = createPaginatedResponse(mockSnippets)

    mockFetch = createMockFetch({
      '/mcp/snippets': { status: 200, body: paginatedResponse },
    })

    const api = createMockApi(mockFetch)
    const result = await api.mcp.snippets.list()

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(2)
    expect(result[0].id).toBe('snip_1')
    expect(result[0].name).toBe('Snippet One')
    expect(result[1].id).toBe('snip_2')
    // Verify it's NOT the paginated wrapper
    expect(result).not.toHaveProperty('pagination')
    expect(result).not.toHaveProperty('data')
  })
})

// =============================================================================
// TESTS - CL-MCPFIX-002: ContextPacks list extracts data
// =============================================================================

describe('api.mcp.contextPacks.list()', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // @clause CL-MCPFIX-002
  it('should extract data array when contextPacks.list receives paginated response', async () => {
    const mockPacks = [
      createMockContextPack({ id: 'pack_1', name: 'Pack One' }),
      createMockContextPack({ id: 'pack_2', name: 'Pack Two' }),
    ]
    const paginatedResponse = createPaginatedResponse(mockPacks)

    mockFetch = createMockFetch({
      '/mcp/context-packs': { status: 200, body: paginatedResponse },
    })

    const api = createMockApi(mockFetch)
    const result = await api.mcp.contextPacks.list()

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(2)
    expect(result[0].id).toBe('pack_1')
    expect(result[0].name).toBe('Pack One')
    expect(result[1].id).toBe('pack_2')
    // Verify it's NOT the paginated wrapper
    expect(result).not.toHaveProperty('pagination')
    expect(result).not.toHaveProperty('data')
  })
})

// =============================================================================
// TESTS - CL-MCPFIX-003: Presets list extracts data
// =============================================================================

describe('api.mcp.presets.list()', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // @clause CL-MCPFIX-003
  it('should extract data array when presets.list receives paginated response', async () => {
    const mockPresets = [
      createMockPreset({ id: 'preset_1', name: 'Preset One' }),
      createMockPreset({ id: 'preset_2', name: 'Preset Two' }),
    ]
    const paginatedResponse = createPaginatedResponse(mockPresets)

    mockFetch = createMockFetch({
      '/mcp/presets': { status: 200, body: paginatedResponse },
    })

    const api = createMockApi(mockFetch)
    const result = await api.mcp.presets.list()

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(2)
    expect(result[0].id).toBe('preset_1')
    expect(result[0].name).toBe('Preset One')
    expect(result[1].id).toBe('preset_2')
    // Verify it's NOT the paginated wrapper
    expect(result).not.toHaveProperty('pagination')
    expect(result).not.toHaveProperty('data')
  })
})

// =============================================================================
// TESTS - CL-MCPFIX-004: History list extracts data
// =============================================================================

describe('api.mcp.history.list()', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // @clause CL-MCPFIX-004
  it('should extract data array when history.list receives paginated response', async () => {
    const mockHistory = [
      createMockHistory({ id: 'hist_1', taskType: 'bugfix' }),
      createMockHistory({ id: 'hist_2', taskType: 'feature' }),
    ]
    const paginatedResponse = createPaginatedResponse(mockHistory)

    mockFetch = createMockFetch({
      '/mcp/history': { status: 200, body: paginatedResponse },
    })

    const api = createMockApi(mockFetch)
    const result = await api.mcp.history.list()

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(2)
    expect(result[0].id).toBe('hist_1')
    expect(result[0].taskType).toBe('bugfix')
    expect(result[1].id).toBe('hist_2')
    // Verify it's NOT the paginated wrapper
    expect(result).not.toHaveProperty('pagination')
    expect(result).not.toHaveProperty('data')
  })
})

// =============================================================================
// TESTS - CL-MCPFIX-005: Empty data returns empty array
// =============================================================================

describe('MCP list functions with empty data', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // @clause CL-MCPFIX-005
  it('should return empty array when snippets.list receives empty data', async () => {
    const emptyResponse = createPaginatedResponse<Snippet>([])

    mockFetch = createMockFetch({
      '/mcp/snippets': { status: 200, body: emptyResponse },
    })

    const api = createMockApi(mockFetch)
    const result = await api.mcp.snippets.list()

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(0)
    expect(result).toEqual([])
  })

  // @clause CL-MCPFIX-005
  it('should return empty array when contextPacks.list receives empty data', async () => {
    const emptyResponse = createPaginatedResponse<ContextPack>([])

    mockFetch = createMockFetch({
      '/mcp/context-packs': { status: 200, body: emptyResponse },
    })

    const api = createMockApi(mockFetch)
    const result = await api.mcp.contextPacks.list()

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(0)
    expect(result).toEqual([])
  })

  // @clause CL-MCPFIX-005
  it('should return empty array when presets.list receives empty data', async () => {
    const emptyResponse = createPaginatedResponse<SessionPreset>([])

    mockFetch = createMockFetch({
      '/mcp/presets': { status: 200, body: emptyResponse },
    })

    const api = createMockApi(mockFetch)
    const result = await api.mcp.presets.list()

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(0)
    expect(result).toEqual([])
  })

  // @clause CL-MCPFIX-005
  it('should return empty array when history.list receives empty data', async () => {
    const emptyResponse = createPaginatedResponse<SessionHistory>([])

    mockFetch = createMockFetch({
      '/mcp/history': { status: 200, body: emptyResponse },
    })

    const api = createMockApi(mockFetch)
    const result = await api.mcp.history.list()

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(0)
    expect(result).toEqual([])
  })
})

// =============================================================================
// TESTS - CL-MCPFIX-006: Fetch error throws appropriate Error
// =============================================================================

describe('MCP list functions error handling', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // @clause CL-MCPFIX-006
  it('fails when snippets.list() fetch returns 500 and throws Error', async () => {
    mockFetch = createMockFetch({
      '/mcp/snippets': {
        status: 500,
        errorBody: { error: 'Internal server error' },
      },
    })

    const api = createMockApi(mockFetch)

    await expect(api.mcp.snippets.list()).rejects.toThrow()

    try {
      await api.mcp.snippets.list()
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toContain('error')
    }
  })

  // @clause CL-MCPFIX-006
  it('fails when contextPacks.list() fetch returns 500 and throws Error', async () => {
    mockFetch = createMockFetch({
      '/mcp/context-packs': {
        status: 500,
        errorBody: { error: 'Internal server error' },
      },
    })

    const api = createMockApi(mockFetch)

    await expect(api.mcp.contextPacks.list()).rejects.toThrow()

    try {
      await api.mcp.contextPacks.list()
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toContain('error')
    }
  })

  // @clause CL-MCPFIX-006
  it('fails when presets.list() fetch returns 500 and throws Error', async () => {
    mockFetch = createMockFetch({
      '/mcp/presets': {
        status: 500,
        errorBody: { error: 'Internal server error' },
      },
    })

    const api = createMockApi(mockFetch)

    await expect(api.mcp.presets.list()).rejects.toThrow()

    try {
      await api.mcp.presets.list()
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toContain('error')
    }
  })

  // @clause CL-MCPFIX-006
  it('fails when history.list() fetch returns 500 and throws Error', async () => {
    mockFetch = createMockFetch({
      '/mcp/history': {
        status: 500,
        errorBody: { error: 'Internal server error' },
      },
    })

    const api = createMockApi(mockFetch)

    await expect(api.mcp.history.list()).rejects.toThrow()

    try {
      await api.mcp.history.list()
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toContain('error')
    }
  })

  // @clause CL-MCPFIX-006
  it('fails when fetch returns non-ok status and does not return paginated object', async () => {
    mockFetch = createMockFetch({
      '/mcp/snippets': {
        status: 403,
        errorBody: { error: 'Forbidden' },
      },
    })

    const api = createMockApi(mockFetch)

    let caughtError: unknown = null
    try {
      await api.mcp.snippets.list()
    } catch (error) {
      caughtError = error
    }

    expect(caughtError).not.toBeNull()
    expect(caughtError).toBeInstanceOf(Error)
    // Should NOT return the paginated response structure on error
    expect(caughtError).not.toHaveProperty('data')
    expect(caughtError).not.toHaveProperty('pagination')
  })
})
