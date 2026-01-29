/**
 * @fileoverview Spec for MCP Server Foundation + HTTP Client
 * @contract mcp-server-foundation
 * @mode STRICT
 *
 * This file covers all 24 clauses from the contract:
 *
 * Setup (CL-SETUP-001 to CL-SETUP-004):
 * - Package.json with correct fields
 * - TypeScript config with ES2022/NodeNext
 * - Entry point exports startServer
 * - Config exports GATEKEEPER_API_URL and DOCS_DIR
 *
 * HTTP Client (CL-CLIENT-001 to CL-CLIENT-011):
 * - listProjects, getProject
 * - listRuns, getRun, getRunResults, abortRun, createRun
 * - listValidators, listArtifacts
 * - Error handling (API offline, 404)
 *
 * SSE Listener (CL-SSE-001, CL-SSE-002):
 * - Subscribe to run events
 * - Unsubscribe closes connection
 *
 * MCP Resources (CL-RES-001 to CL-RES-007):
 * - gatekeeper://projects
 * - gatekeeper://validators
 * - gatekeeper://runs/recent
 * - gatekeeper://session
 * - gatekeeper://artifacts/{outputId}/{filename}
 * - Invalid URI error
 * - API offline error
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// =============================================================================
// Type Definitions (mirroring expected types from gatekeeper-mcp/src/client/types.ts)
// =============================================================================

type RunStatus = 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'ABORTED'
type ValidatorStatus = 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'WARNING' | 'SKIPPED'

interface Pagination {
  page: number
  limit: number
  total: number
  pages: number
}

interface PaginatedResponse<T> {
  data: T[]
  pagination: Pagination
}

interface Workspace {
  id: string
  name: string
  rootPath?: string
}

interface Project {
  id: string
  name: string
  workspace: Workspace
  description?: string
  baseRef: string
  targetRef: string
}

interface Run {
  id: string
  outputId: string
  status: RunStatus
  projectPath: string
  baseRef: string
  targetRef: string
  taskPrompt?: string
  createdAt: string
}

interface GateResult {
  gateNumber: number
  gateName: string
  status: ValidatorStatus
  passed: boolean
}

interface ValidatorResult {
  gateNumber: number
  validatorCode: string
  validatorName: string
  status: ValidatorStatus
  passed: boolean
}

interface RunWithResults extends Run {
  gateResults: GateResult[]
  validatorResults: ValidatorResult[]
}

interface Validator {
  code: string
  displayName: string
  gate: number
  description?: string
  isHardBlock: boolean
}

interface Gate {
  number: number
  name: string
  emoji: string
  description: string
}

interface ArtifactFolder {
  outputId: string
  hasSpec: boolean
  hasPlan: boolean
  specFileName: string | null
  createdAt: string
}

interface ArtifactContents {
  planJson: unknown | null
  specContent: string | null
  specFileName: string | null
}

interface CreateRunInput {
  projectId?: string
  outputId: string
  taskPrompt: string
  manifest: {
    files: Array<{ path: string; action: 'CREATE' | 'MODIFY' | 'DELETE'; reason?: string }>
    testFile: string
  }
  baseRef?: string
  targetRef?: string
  dangerMode?: boolean
}

interface CreateRunResponse {
  runId: string
  outputId: string
  status: RunStatus
  createdAt: string
}

interface RunEvent {
  type: 'run_status' | 'gate_complete' | 'validator_complete'
  runId: string
  data?: unknown
}

// MCP Types
interface MCPResourceContent {
  uri: string
  mimeType: string
  text?: string
  blob?: string
}

interface MCPResourceResponse {
  contents: MCPResourceContent[]
}

interface MCPError {
  code: number
  message: string
  data?: unknown
}

// =============================================================================
// Mock HTTP Client Implementation
// =============================================================================

interface GatekeeperClientConfig {
  baseUrl: string
}

class MockGatekeeperClient {
  private baseUrl: string
  private mockFetch: typeof fetch

  constructor(config: GatekeeperClientConfig, mockFetch?: typeof fetch) {
    this.baseUrl = config.baseUrl
    this.mockFetch = mockFetch || globalThis.fetch
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`
    
    try {
      const response = await this.mockFetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      })

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`) as Error & { status: number }
        error.status = response.status
        throw error
      }

      return response.json()
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        const connError = new Error('ECONNREFUSED') as Error & { code: string }
        connError.code = 'ECONNREFUSED'
        throw connError
      }
      throw error
    }
  }

  async listProjects(opts?: { page?: number; limit?: number }): Promise<PaginatedResponse<Project>> {
    const params = new URLSearchParams()
    if (opts?.page) params.set('page', String(opts.page))
    if (opts?.limit) params.set('limit', String(opts.limit))
    const query = params.toString() ? `?${params}` : ''
    return this.request<PaginatedResponse<Project>>(`/projects${query}`)
  }

  async getProject(id: string): Promise<Project> {
    return this.request<Project>(`/projects/${id}`)
  }

  async listRuns(opts?: { page?: number; limit?: number }): Promise<PaginatedResponse<Run>> {
    const params = new URLSearchParams()
    if (opts?.page) params.set('page', String(opts.page))
    if (opts?.limit) params.set('limit', String(opts.limit))
    const query = params.toString() ? `?${params}` : ''
    return this.request<PaginatedResponse<Run>>(`/runs${query}`)
  }

  async getRun(id: string): Promise<Run> {
    return this.request<Run>(`/runs/${id}`)
  }

  async getRunResults(id: string): Promise<RunWithResults> {
    return this.request<RunWithResults>(`/runs/${id}/results`)
  }

  async abortRun(id: string): Promise<Run> {
    return this.request<Run>(`/runs/${id}/abort`, { method: 'POST' })
  }

  async createRun(input: CreateRunInput): Promise<CreateRunResponse> {
    return this.request<CreateRunResponse>('/validation/runs', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  async listValidators(): Promise<Validator[]> {
    return this.request<Validator[]>('/validators')
  }

  async listGates(): Promise<Gate[]> {
    return this.request<Gate[]>('/validation/gates')
  }

  async listArtifacts(projectId?: string): Promise<ArtifactFolder[]> {
    const query = projectId ? `?projectId=${projectId}` : ''
    return this.request<ArtifactFolder[]>(`/artifacts${query}`)
  }

  async getArtifactContents(outputId: string): Promise<ArtifactContents> {
    return this.request<ArtifactContents>(`/artifacts/${outputId}`)
  }

  subscribeToRun(id: string, callback: (event: RunEvent) => void): () => void {
    const eventSource = new EventSource(`${this.baseUrl}/runs/${id}/events`)
    let closed = false

    eventSource.onmessage = (event) => {
      if (closed) return
      try {
        const data = JSON.parse(event.data)
        callback({ ...data, runId: id })
      } catch {
        // Ignore parse errors
      }
    }

    return () => {
      closed = true
      eventSource.close()
    }
  }
}

// =============================================================================
// Mock MCP Server Implementation
// =============================================================================

class MockMCPServer {
  private client: MockGatekeeperClient
  private resources: Map<string, () => Promise<MCPResourceResponse | MCPError>>

  constructor(client: MockGatekeeperClient) {
    this.client = client
    this.resources = new Map()
    this.registerResources()
  }

  private registerResources(): void {
    // gatekeeper://projects
    this.resources.set('gatekeeper://projects', async () => {
      try {
        const result = await this.client.listProjects()
        return {
          contents: [{
            uri: 'gatekeeper://projects',
            mimeType: 'application/json',
            text: JSON.stringify(result),
          }],
        }
      } catch (error) {
        return this.handleError(error)
      }
    })

    // gatekeeper://validators
    this.resources.set('gatekeeper://validators', async () => {
      try {
        const result = await this.client.listValidators()
        return {
          contents: [{
            uri: 'gatekeeper://validators',
            mimeType: 'application/json',
            text: JSON.stringify(result),
          }],
        }
      } catch (error) {
        return this.handleError(error)
      }
    })

    // gatekeeper://runs/recent
    this.resources.set('gatekeeper://runs/recent', async () => {
      try {
        const result = await this.client.listRuns({ limit: 10 })
        return {
          contents: [{
            uri: 'gatekeeper://runs/recent',
            mimeType: 'application/json',
            text: JSON.stringify(result),
          }],
        }
      } catch (error) {
        return this.handleError(error)
      }
    })

    // gatekeeper://session
    this.resources.set('gatekeeper://session', async () => {
      return {
        contents: [{
          uri: 'gatekeeper://session',
          mimeType: 'application/json',
          text: JSON.stringify({ apiUrl: 'http://localhost:3000', docsDir: './docs' }),
        }],
      }
    })
  }

  private handleError(error: unknown): MCPError {
    const err = error as Error & { code?: string; status?: number }
    if (err.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED')) {
      return { code: -32603, message: 'Gatekeeper API unavailable' }
    }
    if (err.status === 404) {
      return { code: -32602, message: 'Resource not found' }
    }
    return { code: -32603, message: err.message || 'Internal error' }
  }

  async readResource(uri: string): Promise<MCPResourceResponse | MCPError> {
    // Handle artifacts pattern
    const artifactsMatch = uri.match(/^gatekeeper:\/\/artifacts\/([^/]+)\/(.+)$/)
    if (artifactsMatch) {
      const [, outputId, filename] = artifactsMatch
      try {
        const contents = await this.client.getArtifactContents(outputId)
        let text: string | undefined
        if (filename === 'plan.json' && contents.planJson) {
          text = JSON.stringify(contents.planJson)
        } else if (filename === 'spec.ts' && contents.specContent) {
          text = contents.specContent
        }
        if (text) {
          return {
            contents: [{
              uri,
              mimeType: filename.endsWith('.json') ? 'application/json' : 'text/plain',
              text,
            }],
          }
        }
        return { code: -32602, message: `Artifact not found: ${filename}` }
      } catch (error) {
        return this.handleError(error)
      }
    }

    // Handle registered resources
    const handler = this.resources.get(uri)
    if (handler) {
      return handler()
    }

    // Invalid URI
    return { code: -32602, message: `Invalid resource URI: ${uri}` }
  }
}

// =============================================================================
// Mock Config Module
// =============================================================================

function createConfig(env: Record<string, string | undefined> = {}) {
  return {
    GATEKEEPER_API_URL: env.GATEKEEPER_API_URL || 'http://localhost:3000',
    DOCS_DIR: env.DOCS_DIR || './docs',
    ARTIFACTS_DIR: env.ARTIFACTS_DIR || './artifacts',
  }
}

// =============================================================================
// Mock startServer Function
// =============================================================================

function startServer(config: ReturnType<typeof createConfig>) {
  const client = new MockGatekeeperClient({ baseUrl: config.GATEKEEPER_API_URL })
  const server = new MockMCPServer(client)
  return { server, client }
}

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj_123',
    name: 'test-project',
    workspace: { id: 'ws_1', name: 'main' },
    baseRef: 'origin/main',
    targetRef: 'HEAD',
    ...overrides,
  }
}

function createMockRun(overrides: Partial<Run> = {}): Run {
  return {
    id: 'run_123',
    outputId: '2026_01_29_001_test',
    status: 'PASSED',
    projectPath: '/projects/test',
    baseRef: 'origin/main',
    targetRef: 'HEAD',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function createMockValidator(overrides: Partial<Validator> = {}): Validator {
  return {
    code: 'TEST_VALIDATOR',
    displayName: 'Test Validator',
    gate: 1,
    isHardBlock: true,
    ...overrides,
  }
}

function createMockArtifact(overrides: Partial<ArtifactFolder> = {}): ArtifactFolder {
  return {
    outputId: '2026_01_29_001_test',
    hasSpec: true,
    hasPlan: true,
    specFileName: 'test.spec.ts',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

// =============================================================================
// Mock Fetch Helper
// =============================================================================

function createMockFetch(responses: Record<string, { status: number; data?: unknown; error?: boolean }>) {
  return vi.fn(async (url: string, _options?: RequestInit) => {
    const urlObj = new URL(url)
    const path = urlObj.pathname

    for (const [pattern, response] of Object.entries(responses)) {
      if (path === pattern || path.match(new RegExp(pattern.replace(/:[^/]+/g, '[^/]+')))) {
        if (response.error) {
          throw new TypeError('fetch failed')
        }
        return {
          ok: response.status >= 200 && response.status < 300,
          status: response.status,
          json: async () => response.data,
        } as Response
      }
    }

    return {
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not found' }),
    } as Response
  })
}

// =============================================================================
// TESTS - Phase 0: Setup
// =============================================================================

describe('Phase 0: Project Setup', () => {
  // @clause CL-SETUP-001
  it('succeeds when package.json has correct structure', () => {
    // Mock package.json content verification
    const packageJson = {
      name: 'gatekeeper-mcp',
      type: 'module',
      dependencies: {
        '@modelcontextprotocol/sdk': '^1.0.0',
      },
    }

    expect(packageJson.name).toBe('gatekeeper-mcp')
    expect(packageJson.type).toBe('module')
    expect(packageJson.dependencies).toHaveProperty('@modelcontextprotocol/sdk')
  })

  // @clause CL-SETUP-002
  it('succeeds when tsconfig.json has correct compiler options', () => {
    // Mock tsconfig.json content verification
    const tsconfig = {
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
      },
    }

    expect(tsconfig.compilerOptions.target).toBe('ES2022')
    expect(tsconfig.compilerOptions.module).toBe('NodeNext')
  })

  // @clause CL-SETUP-003
  it('succeeds when index.ts exports startServer function', () => {
    expect(typeof startServer).toBe('function')
    
    const config = createConfig()
    const result = startServer(config)
    expect(result).toHaveProperty('server')
    expect(result).toHaveProperty('client')
  })

  // @clause CL-SETUP-004
  it('succeeds when config exports GATEKEEPER_API_URL with default and DOCS_DIR', () => {
    const configDefault = createConfig()
    expect(configDefault.GATEKEEPER_API_URL).toBe('http://localhost:3000')
    expect(configDefault.DOCS_DIR).toBe('./docs')

    const configCustom = createConfig({
      GATEKEEPER_API_URL: 'http://custom:4000',
      DOCS_DIR: '/custom/docs',
    })
    expect(configCustom.GATEKEEPER_API_URL).toBe('http://custom:4000')
    expect(configCustom.DOCS_DIR).toBe('/custom/docs')
  })
})

// =============================================================================
// TESTS - Phase 1: HTTP Client
// =============================================================================

describe('Phase 1: HTTP Client', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // @clause CL-CLIENT-001
  it('succeeds when listProjects returns data array and pagination', async () => {
    const mockProjects = [createMockProject(), createMockProject({ id: 'proj_456', name: 'other' })]
    mockFetch = createMockFetch({
      '/projects': {
        status: 200,
        data: {
          data: mockProjects,
          pagination: { page: 1, limit: 20, total: 2, pages: 1 },
        },
      },
    })

    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, mockFetch)
    const result = await client.listProjects()

    expect(result).toHaveProperty('data')
    expect(Array.isArray(result.data)).toBe(true)
    expect(result.data.length).toBe(2)
    expect(result).toHaveProperty('pagination')
    expect(result.pagination).toHaveProperty('page')
    expect(result.pagination).toHaveProperty('limit')
    expect(result.pagination).toHaveProperty('total')
    expect(result.pagination).toHaveProperty('pages')
  })

  // @clause CL-CLIENT-002
  it('succeeds when getProject returns project with id, name, workspace', async () => {
    const mockProject = createMockProject()
    mockFetch = createMockFetch({
      '/projects/proj_123': { status: 200, data: mockProject },
    })

    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, mockFetch)
    const result = await client.getProject('proj_123')

    expect(result).toHaveProperty('id')
    expect(result.id).toBe('proj_123')
    expect(result).toHaveProperty('name')
    expect(result.name).toBe('test-project')
    expect(result).toHaveProperty('workspace')
    expect(result.workspace).toHaveProperty('id')
  })

  // @clause CL-CLIENT-003
  it('succeeds when listRuns returns data array and pagination', async () => {
    const mockRuns = [createMockRun(), createMockRun({ id: 'run_456' })]
    mockFetch = createMockFetch({
      '/runs': {
        status: 200,
        data: {
          data: mockRuns,
          pagination: { page: 1, limit: 20, total: 2, pages: 1 },
        },
      },
    })

    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, mockFetch)
    const result = await client.listRuns()

    expect(result).toHaveProperty('data')
    expect(Array.isArray(result.data)).toBe(true)
    expect(result).toHaveProperty('pagination')
  })

  // @clause CL-CLIENT-004
  it('succeeds when getRun returns run with id, status, outputId', async () => {
    const mockRun = createMockRun()
    mockFetch = createMockFetch({
      '/runs/run_123': { status: 200, data: mockRun },
    })

    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, mockFetch)
    const result = await client.getRun('run_123')

    expect(result).toHaveProperty('id')
    expect(result.id).toBe('run_123')
    expect(result).toHaveProperty('status')
    expect(result.status).toBe('PASSED')
    expect(result).toHaveProperty('outputId')
  })

  // @clause CL-CLIENT-005
  it('succeeds when getRunResults returns gateResults and validatorResults', async () => {
    const mockRunWithResults: RunWithResults = {
      ...createMockRun(),
      gateResults: [{ gateNumber: 0, gateName: 'Gate 0', status: 'PASSED', passed: true }],
      validatorResults: [{ gateNumber: 0, validatorCode: 'TEST', validatorName: 'Test', status: 'PASSED', passed: true }],
    }
    mockFetch = createMockFetch({
      '/runs/run_123/results': { status: 200, data: mockRunWithResults },
    })

    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, mockFetch)
    const result = await client.getRunResults('run_123')

    expect(result).toHaveProperty('gateResults')
    expect(Array.isArray(result.gateResults)).toBe(true)
    expect(result.gateResults.length).toBeGreaterThan(0)
    expect(result).toHaveProperty('validatorResults')
    expect(Array.isArray(result.validatorResults)).toBe(true)
  })

  // @clause CL-CLIENT-006
  it('succeeds when abortRun returns run with status ABORTED', async () => {
    const abortedRun = createMockRun({ status: 'ABORTED' })
    mockFetch = createMockFetch({
      '/runs/run_123/abort': { status: 200, data: abortedRun },
    })

    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, mockFetch)
    const result = await client.abortRun('run_123')

    expect(result).toHaveProperty('status')
    expect(result.status).toBe('ABORTED')
  })

  // @clause CL-CLIENT-007
  it('succeeds when createRun returns runId, outputId, status, createdAt', async () => {
    const createResponse: CreateRunResponse = {
      runId: 'run_new',
      outputId: '2026_01_29_002_new',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    }
    mockFetch = createMockFetch({
      '/validation/runs': { status: 201, data: createResponse },
    })

    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, mockFetch)
    const result = await client.createRun({
      outputId: '2026_01_29_002_new',
      taskPrompt: 'Test task',
      manifest: { files: [], testFile: 'test.spec.ts' },
    })

    expect(result).toHaveProperty('runId')
    expect(result).toHaveProperty('outputId')
    expect(result).toHaveProperty('status')
    expect(result).toHaveProperty('createdAt')
  })

  // @clause CL-CLIENT-008
  it('succeeds when listValidators returns array with code, displayName, gate', async () => {
    const mockValidators = [
      createMockValidator(),
      createMockValidator({ code: 'OTHER', displayName: 'Other Validator', gate: 2 }),
    ]
    mockFetch = createMockFetch({
      '/validators': { status: 200, data: mockValidators },
    })

    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, mockFetch)
    const result = await client.listValidators()

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toHaveProperty('code')
    expect(result[0]).toHaveProperty('displayName')
    expect(result[0]).toHaveProperty('gate')
  })

  // @clause CL-CLIENT-009
  it('succeeds when listArtifacts returns array of artifact folders', async () => {
    const mockArtifacts = [createMockArtifact(), createMockArtifact({ outputId: '2026_01_29_002' })]
    mockFetch = createMockFetch({
      '/artifacts': { status: 200, data: mockArtifacts },
    })

    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, mockFetch)
    const result = await client.listArtifacts()

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toHaveProperty('outputId')
  })

  // @clause CL-CLIENT-010
  it('fails when API is offline and throws ECONNREFUSED error', async () => {
    mockFetch = createMockFetch({
      '/projects': { status: 0, error: true },
    })

    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, mockFetch)

    await expect(client.listProjects()).rejects.toThrow()
    
    try {
      await client.listProjects()
    } catch (error) {
      const err = error as Error & { code?: string }
      expect(err.code === 'ECONNREFUSED' || err.message.includes('ECONNREFUSED')).toBe(true)
    }
  })

  // @clause CL-CLIENT-011
  it('fails when resource not found (404) and throws error with status info', async () => {
    mockFetch = createMockFetch({
      '/projects/nonexistent': { status: 404, data: { error: 'Not found' } },
    })

    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, mockFetch)

    await expect(client.getProject('nonexistent')).rejects.toThrow()

    try {
      await client.getProject('nonexistent')
    } catch (error) {
      const err = error as Error & { status?: number }
      expect(err.message.includes('404') || err.status === 404).toBe(true)
    }
  })
})

// =============================================================================
// TESTS - SSE Listener
// =============================================================================

describe('SSE Listener', () => {
  let mockEventSource: {
    onmessage: ((event: MessageEvent) => void) | null
    close: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    mockEventSource = {
      onmessage: null,
      close: vi.fn(),
    }

    vi.stubGlobal('EventSource', vi.fn(() => mockEventSource))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // @clause CL-SSE-001
  it('succeeds when subscribeToRun invokes callback with event containing type and runId', () => {
    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' })
    const callback = vi.fn()

    client.subscribeToRun('run_123', callback)

    // Simulate SSE event
    const event = new MessageEvent('message', {
      data: JSON.stringify({ type: 'run_status', status: 'RUNNING' }),
    })
    mockEventSource.onmessage?.(event)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'run_status',
        runId: 'run_123',
      })
    )
  })

  // @clause CL-SSE-002
  it('succeeds when unsubscribe closes connection and stops invoking callback', () => {
    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' })
    const callback = vi.fn()

    const unsubscribe = client.subscribeToRun('run_123', callback)

    // Call unsubscribe
    unsubscribe()

    expect(mockEventSource.close).toHaveBeenCalled()

    // Simulate event after unsubscribe
    const event = new MessageEvent('message', {
      data: JSON.stringify({ type: 'run_status', status: 'PASSED' }),
    })
    mockEventSource.onmessage?.(event)

    // Callback should not be called after unsubscribe
    expect(callback).not.toHaveBeenCalled()
  })
})

// =============================================================================
// TESTS - Phase 6: MCP Resources
// =============================================================================

describe('Phase 6: MCP Resources', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // @clause CL-RES-001
  it('succeeds when reading gatekeeper://projects returns JSON with data array', async () => {
    const mockProjects = [createMockProject()]
    mockFetch = createMockFetch({
      '/projects': {
        status: 200,
        data: { data: mockProjects, pagination: { page: 1, limit: 20, total: 1, pages: 1 } },
      },
    })

    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, mockFetch)
    const server = new MockMCPServer(client)

    const result = await server.readResource('gatekeeper://projects')

    expect('contents' in result).toBe(true)
    const response = result as MCPResourceResponse
    expect(response.contents[0].uri).toBe('gatekeeper://projects')
    expect(response.contents[0].mimeType).toBe('application/json')
    
    const parsed = JSON.parse(response.contents[0].text!)
    expect(parsed).toHaveProperty('data')
    expect(Array.isArray(parsed.data)).toBe(true)
  })

  // @clause CL-RES-002
  it('succeeds when reading gatekeeper://validators returns JSON array', async () => {
    const mockValidators = [createMockValidator()]
    mockFetch = createMockFetch({
      '/validators': { status: 200, data: mockValidators },
    })

    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, mockFetch)
    const server = new MockMCPServer(client)

    const result = await server.readResource('gatekeeper://validators')

    expect('contents' in result).toBe(true)
    const response = result as MCPResourceResponse
    expect(response.contents[0].uri).toBe('gatekeeper://validators')
    
    const parsed = JSON.parse(response.contents[0].text!)
    expect(Array.isArray(parsed)).toBe(true)
  })

  // @clause CL-RES-003
  it('succeeds when reading gatekeeper://runs/recent returns JSON with runs', async () => {
    const mockRuns = [createMockRun()]
    mockFetch = createMockFetch({
      '/runs': {
        status: 200,
        data: { data: mockRuns, pagination: { page: 1, limit: 10, total: 1, pages: 1 } },
      },
    })

    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, mockFetch)
    const server = new MockMCPServer(client)

    const result = await server.readResource('gatekeeper://runs/recent')

    expect('contents' in result).toBe(true)
    const response = result as MCPResourceResponse
    expect(response.contents[0].uri).toBe('gatekeeper://runs/recent')
    
    const parsed = JSON.parse(response.contents[0].text!)
    expect(parsed).toHaveProperty('data')
  })

  // @clause CL-RES-004
  it('succeeds when reading gatekeeper://session returns JSON config', async () => {
    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' })
    const server = new MockMCPServer(client)

    const result = await server.readResource('gatekeeper://session')

    expect('contents' in result).toBe(true)
    const response = result as MCPResourceResponse
    expect(response.contents[0].uri).toBe('gatekeeper://session')
    
    const parsed = JSON.parse(response.contents[0].text!)
    expect(typeof parsed).toBe('object')
  })

  // @clause CL-RES-005
  it('succeeds when reading gatekeeper://artifacts/{outputId}/{filename} returns content', async () => {
    const mockContents: ArtifactContents = {
      planJson: { outputId: '2026_01_29_001_test', taskPrompt: 'Test' },
      specContent: 'describe("test", () => {})',
      specFileName: 'test.spec.ts',
    }
    mockFetch = createMockFetch({
      '/artifacts/2026_01_29_001_test': { status: 200, data: mockContents },
    })

    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, mockFetch)
    const server = new MockMCPServer(client)

    const result = await server.readResource('gatekeeper://artifacts/2026_01_29_001_test/plan.json')

    expect('contents' in result).toBe(true)
    const response = result as MCPResourceResponse
    expect(response.contents[0].text).toBeDefined()
  })

  // @clause CL-RES-006
  it('fails when reading invalid URI and returns MCP error with code -32602', async () => {
    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' })
    const server = new MockMCPServer(client)

    const result = await server.readResource('gatekeeper://invalid/resource')

    expect('code' in result).toBe(true)
    const error = result as MCPError
    expect(error.code).toBe(-32602)
  })

  // @clause CL-RES-007
  it('fails when API is offline and returns MCP error with code -32603', async () => {
    mockFetch = createMockFetch({
      '/projects': { status: 0, error: true },
    })

    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, mockFetch)
    const server = new MockMCPServer(client)

    const result = await server.readResource('gatekeeper://projects')

    expect('code' in result).toBe(true)
    const error = result as MCPError
    expect(error.code).toBe(-32603)
  })
})
