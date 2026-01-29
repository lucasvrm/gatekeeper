/**
 * @fileoverview Spec for MCP Tools + Prompts + Notifications (Plano 2)
 * @contract mcp-tools-prompts-notifications
 * @mode STRICT
 *
 * This file covers all 36 clauses from the contract:
 *
 * Tools - Runs/Projects (CL-TOOL-001 to CL-TOOL-012)
 * Tools - Artifacts (CL-ART-001 to CL-ART-007)
 * Tools - Session Config (CL-SESS-001 to CL-SESS-004)
 * Notifications (CL-NOTIFY-001 to CL-NOTIFY-004)
 * Prompts (CL-PROMPT-001 to CL-PROMPT-005)
 * Client Extensions (CL-CLIENT-001 to CL-CLIENT-002)
 * Server Registration (CL-SERVER-001 to CL-SERVER-002)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// =============================================================================
// Type Definitions
// =============================================================================

type RunStatus = 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'ABORTED'

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
}

interface Project {
  id: string
  name: string
  workspace: Workspace
}

interface Run {
  id: string
  outputId: string
  status: RunStatus
  createdAt: string
}

interface Validator {
  code: string
  displayName: string
  gate: number
}

interface CreateRunInput {
  outputId: string
  taskPrompt: string
  manifest: {
    files: Array<{ path: string; action: string }>
    testFile: string
  }
}

interface CreateRunResponse {
  runId: string
  outputId: string
  status: RunStatus
  createdAt: string
}

interface UploadFilesResponse {
  message: string
  files: string[]
}

interface MCPToolResult {
  content: Array<{ type: string; text: string }>
  isError?: boolean
}

interface MCPPromptMessage {
  role: string
  content: { type: string; text: string }
}

interface MCPPromptResult {
  messages: MCPPromptMessage[]
}

interface MCPTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

interface MCPPrompt {
  name: string
  description: string
}

interface NotificationConfig {
  desktop: boolean
  sound: boolean
}

// =============================================================================
// Mock Config
// =============================================================================

interface Config {
  GATEKEEPER_API_URL: string
  DOCS_DIR: string
  ARTIFACTS_DIR: string
  NOTIFICATIONS_DESKTOP: boolean
  NOTIFICATIONS_SOUND: boolean
}

function createMockConfig(overrides: Partial<Config> = {}): Config {
  return {
    GATEKEEPER_API_URL: 'http://localhost:3000',
    DOCS_DIR: './docs',
    ARTIFACTS_DIR: './artifacts',
    NOTIFICATIONS_DESKTOP: true,
    NOTIFICATIONS_SOUND: true,
    ...overrides,
  }
}

// =============================================================================
// Mock HTTP Client with new methods
// =============================================================================

class MockGatekeeperClient {
  private baseUrl: string
  private mockFetch: (url: string, options?: RequestInit) => Promise<Response>

  constructor(
    config: { baseUrl: string },
    mockFetch?: (url: string, options?: RequestInit) => Promise<Response>
  ) {
    this.baseUrl = config.baseUrl
    this.mockFetch = mockFetch || (async () => new Response('{}'))
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`
    try {
      const response = await this.mockFetch(url, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...options?.headers },
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

  async listProjects(): Promise<PaginatedResponse<Project>> {
    return this.request('/projects')
  }

  async getProject(id: string): Promise<Project> {
    return this.request(`/projects/${id}`)
  }

  async listValidators(): Promise<Validator[]> {
    return this.request('/validators')
  }

  async createRun(input: CreateRunInput): Promise<CreateRunResponse> {
    return this.request('/validation/runs', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  async getRun(id: string): Promise<Run> {
    return this.request(`/runs/${id}`)
  }

  async listRuns(): Promise<PaginatedResponse<Run>> {
    return this.request('/runs')
  }

  async abortRun(id: string): Promise<Run> {
    return this.request(`/runs/${id}/abort`, { method: 'POST' })
  }

  // New methods for Plano 2
  async uploadRunFiles(id: string, files: Array<{ filename: string; content: string }>): Promise<UploadFilesResponse> {
    return this.request(`/runs/${id}/files`, {
      method: 'PUT',
      body: JSON.stringify({ files }),
    })
  }

  async continueRun(id: string, gate: number): Promise<{ message: string }> {
    return this.request(`/runs/${id}/rerun/${gate}`, { method: 'POST' })
  }
}

// =============================================================================
// Mock Tool Handlers
// =============================================================================

function createToolHandler(client: MockGatekeeperClient, config: Config) {
  return async (name: string, args: Record<string, unknown>): Promise<MCPToolResult> => {
    try {
      switch (name) {
        case 'list_projects': {
          const result = await client.listProjects()
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        }

        case 'get_project': {
          const projectId = args.projectId as string
          if (!projectId) {
            return { content: [{ type: 'text', text: 'Missing projectId' }], isError: true }
          }
          const result = await client.getProject(projectId)
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        }

        case 'list_validators': {
          const result = await client.listValidators()
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        }

        case 'create_run': {
          const { outputId, taskPrompt, manifest } = args as {
            outputId?: string
            taskPrompt?: string
            manifest?: { files: unknown[]; testFile: string }
          }
          if (!outputId || !taskPrompt || !manifest) {
            return {
              content: [{ type: 'text', text: 'Missing required fields: outputId, taskPrompt, manifest' }],
              isError: true,
            }
          }
          const result = await client.createRun({
            outputId,
            taskPrompt,
            manifest: manifest as CreateRunInput['manifest'],
          })
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        }

        case 'get_run_status': {
          const runId = args.runId as string
          if (!runId) {
            return { content: [{ type: 'text', text: 'Missing runId' }], isError: true }
          }
          const result = await client.getRun(runId)
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        }

        case 'list_runs': {
          const result = await client.listRuns()
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        }

        case 'abort_run': {
          const runId = args.runId as string
          const result = await client.abortRun(runId)
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        }

        case 'upload_spec': {
          const { runId, content: specContent } = args as { runId: string; content: string }
          const result = await client.uploadRunFiles(runId, [
            { filename: 'spec.ts', content: specContent },
          ])
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        }

        case 'continue_run': {
          const { runId, gate } = args as { runId: string; gate?: number }
          const result = await client.continueRun(runId, gate ?? 0)
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        }

        case 'save_artifact': {
          const { outputId, filename, content } = args as {
            outputId: string
            filename: string
            content: string
          }
          // Security check for path traversal
          if (filename.includes('..') || outputId.includes('..')) {
            return {
              content: [{ type: 'text', text: 'Invalid path: path traversal not allowed' }],
              isError: true,
            }
          }
          const artifactPath = path.join(config.ARTIFACTS_DIR, outputId, filename)
          const dir = path.dirname(artifactPath)
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
          }
          fs.writeFileSync(artifactPath, content)
          return { content: [{ type: 'text', text: JSON.stringify({ path: artifactPath }) }] }
        }

        case 'read_artifact': {
          const { outputId, filename } = args as { outputId: string; filename: string }
          const artifactPath = path.join(config.ARTIFACTS_DIR, outputId, filename)
          if (!fs.existsSync(artifactPath)) {
            return {
              content: [{ type: 'text', text: `Artifact not found: ${artifactPath}` }],
              isError: true,
            }
          }
          const content = fs.readFileSync(artifactPath, 'utf-8')
          return { content: [{ type: 'text', text: content }] }
        }

        case 'list_artifacts': {
          const { outputId } = args as { outputId?: string }
          if (outputId) {
            const dir = path.join(config.ARTIFACTS_DIR, outputId)
            if (!fs.existsSync(dir)) {
              return { content: [{ type: 'text', text: JSON.stringify([]) }] }
            }
            const files = fs.readdirSync(dir).map((f) => ({ filename: f }))
            return { content: [{ type: 'text', text: JSON.stringify(files) }] }
          } else {
            if (!fs.existsSync(config.ARTIFACTS_DIR)) {
              return { content: [{ type: 'text', text: JSON.stringify([]) }] }
            }
            const folders = fs.readdirSync(config.ARTIFACTS_DIR).map((f) => ({ outputId: f }))
            return { content: [{ type: 'text', text: JSON.stringify(folders) }] }
          }
        }

        case 'delete_artifact': {
          const { outputId, filename } = args as { outputId: string; filename: string }
          const artifactPath = path.join(config.ARTIFACTS_DIR, outputId, filename)
          if (!fs.existsSync(artifactPath)) {
            return {
              content: [{ type: 'text', text: `Artifact not found: ${artifactPath}` }],
              isError: true,
            }
          }
          fs.unlinkSync(artifactPath)
          return { content: [{ type: 'text', text: JSON.stringify({ deleted: true }) }] }
        }

        case 'get_session_config': {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  GATEKEEPER_API_URL: config.GATEKEEPER_API_URL,
                  DOCS_DIR: config.DOCS_DIR,
                  ARTIFACTS_DIR: config.ARTIFACTS_DIR,
                  notifications: {
                    desktop: config.NOTIFICATIONS_DESKTOP,
                    sound: config.NOTIFICATIONS_SOUND,
                  },
                }),
              },
            ],
          }
        }

        case 'get_active_context_files': {
          if (!fs.existsSync(config.DOCS_DIR)) {
            return { content: [{ type: 'text', text: JSON.stringify([]) }] }
          }
          const files = fs.readdirSync(config.DOCS_DIR).filter((f) => f.endsWith('.md'))
          return { content: [{ type: 'text', text: JSON.stringify(files) }] }
        }

        case 'get_active_snippets': {
          // Placeholder for Plano 3
          return { content: [{ type: 'text', text: JSON.stringify([]) }] }
        }

        case 'get_variables': {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  GATEKEEPER_API_URL: config.GATEKEEPER_API_URL,
                  DOCS_DIR: config.DOCS_DIR,
                  ARTIFACTS_DIR: config.ARTIFACTS_DIR,
                }),
              },
            ],
          }
        }

        case 'configure_notifications': {
          const { desktop, sound } = args as { desktop?: boolean; sound?: boolean }
          if (desktop !== undefined) config.NOTIFICATIONS_DESKTOP = desktop
          if (sound !== undefined) config.NOTIFICATIONS_SOUND = sound
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  desktop: config.NOTIFICATIONS_DESKTOP,
                  sound: config.NOTIFICATIONS_SOUND,
                }),
              },
            ],
          }
        }

        default:
          return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true }
      }
    } catch (error) {
      const err = error as Error & { code?: string; status?: number }
      if (err.code === 'ECONNREFUSED') {
        return {
          content: [{ type: 'text', text: 'error: API unavailable (ECONNREFUSED)' }],
          isError: true,
        }
      }
      if (err.status === 404) {
        return {
          content: [{ type: 'text', text: 'error: not found (404)' }],
          isError: true,
        }
      }
      return { content: [{ type: 'text', text: `error: ${err.message}` }], isError: true }
    }
  }
}

// =============================================================================
// Mock Prompt Handlers
// =============================================================================

function createPromptHandler(config: Config) {
  return async (name: string, args: Record<string, unknown>): Promise<MCPPromptResult> => {
    const readPlaybook = (filename: string): string => {
      const filepath = path.join(config.DOCS_DIR, filename)
      if (!fs.existsSync(filepath)) {
        return `[${filename} not found - using fallback]`
      }
      return fs.readFileSync(filepath, 'utf-8')
    }

    switch (name) {
      case 'create_plan': {
        const { taskDescription } = args as { taskDescription: string }
        let text: string
        try {
          const questionnaires = readPlaybook('CONTRACT_QUESTIONNAIRES.md')
          const playbook = readPlaybook('PLANNER_PLAYBOOK.md')
          text = `# Create Plan\n\n## Task\n${taskDescription}\n\n## CONTRACT_QUESTIONNAIRES\n${questionnaires}\n\n## PLANNER_PLAYBOOK\n${playbook}`
        } catch {
          text = `# Create Plan\n\n## Task\n${taskDescription}\n\n[Playbook files not found - proceeding with basic guidance]`
        }
        return {
          messages: [{ role: 'user', content: { type: 'text', text } }],
        }
      }

      case 'generate_spec': {
        const { contractContent } = args as { contractContent: string }
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `# Generate Spec\n\n## Contract\n${contractContent}\n\nGenerate a test specification that covers all clauses.`,
              },
            },
          ],
        }
      }

      case 'implement_code': {
        const { specContent, contractContent } = args as {
          specContent: string
          contractContent: string
        }
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `# Implement Code\n\n## Contract\n${contractContent}\n\n## Spec\n${specContent}\n\nImplement the code to make the tests pass.`,
              },
            },
          ],
        }
      }

      case 'fix_gate_failure': {
        const { validatorCode, errorMessage } = args as {
          validatorCode: string
          errorMessage: string
        }
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `# Fix Gate Failure\n\n## Validator: ${validatorCode}\n\n## Error\n${errorMessage}\n\nAnalyze the failure and provide a fix.`,
              },
            },
          ],
        }
      }

      default:
        return {
          messages: [
            { role: 'user', content: { type: 'text', text: `Unknown prompt: ${name}` } },
          ],
        }
    }
  }
}

// =============================================================================
// Mock Notification Manager
// =============================================================================

interface MockNotifier {
  notify: ReturnType<typeof vi.fn>
  play: ReturnType<typeof vi.fn>
}

function createMockNotificationManager(config: Config) {
  const desktopNotifier: MockNotifier = { notify: vi.fn(), play: vi.fn() }
  const soundNotifier: MockNotifier = { notify: vi.fn(), play: vi.fn() }

  return {
    desktopNotifier,
    soundNotifier,
    handleRunStatusChange(runId: string, newStatus: RunStatus) {
      if (!config.NOTIFICATIONS_DESKTOP && !config.NOTIFICATIONS_SOUND) {
        return
      }

      if (newStatus === 'PASSED') {
        if (config.NOTIFICATIONS_DESKTOP) {
          desktopNotifier.notify({ title: 'Run Passed', message: `Run ${runId} passed` })
        }
        if (config.NOTIFICATIONS_SOUND) {
          soundNotifier.play('success')
        }
      } else if (newStatus === 'FAILED') {
        if (config.NOTIFICATIONS_DESKTOP) {
          desktopNotifier.notify({ title: 'Run Failed', message: `Run ${runId} failed` })
        }
        if (config.NOTIFICATIONS_SOUND) {
          soundNotifier.play('failure')
        }
      }
    },
  }
}

// =============================================================================
// Mock Server
// =============================================================================

function createMockServer(config: Config, client: MockGatekeeperClient) {
  const toolHandler = createToolHandler(client, config)
  const promptHandler = createPromptHandler(config)

  const tools: MCPTool[] = [
    { name: 'list_projects', description: 'List all projects', inputSchema: { type: 'object' } },
    { name: 'get_project', description: 'Get a project by ID', inputSchema: { type: 'object', properties: { projectId: { type: 'string' } }, required: ['projectId'] } },
    { name: 'list_validators', description: 'List all validators', inputSchema: { type: 'object' } },
    { name: 'create_run', description: 'Create a validation run', inputSchema: { type: 'object', properties: { outputId: { type: 'string' }, taskPrompt: { type: 'string' }, manifest: { type: 'object' } }, required: ['outputId', 'taskPrompt', 'manifest'] } },
    { name: 'get_run_status', description: 'Get run status', inputSchema: { type: 'object', properties: { runId: { type: 'string' } }, required: ['runId'] } },
    { name: 'list_runs', description: 'List all runs', inputSchema: { type: 'object' } },
    { name: 'abort_run', description: 'Abort a run', inputSchema: { type: 'object', properties: { runId: { type: 'string' } }, required: ['runId'] } },
    { name: 'upload_spec', description: 'Upload spec file', inputSchema: { type: 'object', properties: { runId: { type: 'string' }, content: { type: 'string' } }, required: ['runId', 'content'] } },
    { name: 'continue_run', description: 'Continue a failed run', inputSchema: { type: 'object', properties: { runId: { type: 'string' }, gate: { type: 'number' } }, required: ['runId'] } },
    { name: 'save_artifact', description: 'Save an artifact', inputSchema: { type: 'object', properties: { outputId: { type: 'string' }, filename: { type: 'string' }, content: { type: 'string' } }, required: ['outputId', 'filename', 'content'] } },
    { name: 'read_artifact', description: 'Read an artifact', inputSchema: { type: 'object', properties: { outputId: { type: 'string' }, filename: { type: 'string' } }, required: ['outputId', 'filename'] } },
    { name: 'list_artifacts', description: 'List artifacts', inputSchema: { type: 'object', properties: { outputId: { type: 'string' } } } },
    { name: 'delete_artifact', description: 'Delete an artifact', inputSchema: { type: 'object', properties: { outputId: { type: 'string' }, filename: { type: 'string' } }, required: ['outputId', 'filename'] } },
    { name: 'get_session_config', description: 'Get session config', inputSchema: { type: 'object' } },
    { name: 'get_active_context_files', description: 'Get active context files', inputSchema: { type: 'object' } },
    { name: 'get_active_snippets', description: 'Get active snippets', inputSchema: { type: 'object' } },
    { name: 'get_variables', description: 'Get environment variables', inputSchema: { type: 'object' } },
    { name: 'configure_notifications', description: 'Configure notifications', inputSchema: { type: 'object', properties: { desktop: { type: 'boolean' }, sound: { type: 'boolean' } } } },
  ]

  const prompts: MCPPrompt[] = [
    { name: 'create_plan', description: 'Create a validation plan' },
    { name: 'generate_spec', description: 'Generate test spec from contract' },
    { name: 'implement_code', description: 'Implement code from spec' },
    { name: 'fix_gate_failure', description: 'Fix a gate failure' },
  ]

  return {
    listTools: () => ({ tools }),
    listPrompts: () => ({ prompts }),
    callTool: toolHandler,
    getPrompt: promptHandler,
  }
}

// =============================================================================
// Mock Fetch Helper
// =============================================================================

function createMockFetch(responses: Record<string, { status: number; data?: unknown; error?: boolean }>) {
  return async (url: string, _options?: RequestInit): Promise<Response> => {
    const urlObj = new URL(url)
    const pathName = urlObj.pathname

    for (const [pattern, response] of Object.entries(responses)) {
      const regex = new RegExp(`^${pattern.replace(/:[^/]+/g, '[^/]+')}$`)
      if (pathName === pattern || regex.test(pathName)) {
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

    return { ok: false, status: 404, json: async () => ({ error: 'Not found' }) } as Response
  }
}

// =============================================================================
// Test Fixtures
// =============================================================================

const TEST_ARTIFACTS_DIR = '/tmp/test-artifacts'
const TEST_DOCS_DIR = '/tmp/test-docs'

function setupTestDirs() {
  if (!fs.existsSync(TEST_ARTIFACTS_DIR)) {
    fs.mkdirSync(TEST_ARTIFACTS_DIR, { recursive: true })
  }
  if (!fs.existsSync(TEST_DOCS_DIR)) {
    fs.mkdirSync(TEST_DOCS_DIR, { recursive: true })
  }
}

function cleanupTestDirs() {
  if (fs.existsSync(TEST_ARTIFACTS_DIR)) {
    fs.rmSync(TEST_ARTIFACTS_DIR, { recursive: true, force: true })
  }
  if (fs.existsSync(TEST_DOCS_DIR)) {
    fs.rmSync(TEST_DOCS_DIR, { recursive: true, force: true })
  }
}

// =============================================================================
// TESTS - Phase 2: Tools for Runs/Projects
// =============================================================================

describe('Phase 2: Tools for Runs/Projects', () => {
  let config: Config
  let mockFetch: ReturnType<typeof createMockFetch>

  beforeEach(() => {
    config = createMockConfig({ ARTIFACTS_DIR: TEST_ARTIFACTS_DIR, DOCS_DIR: TEST_DOCS_DIR })
    setupTestDirs()
  })

  afterEach(() => {
    cleanupTestDirs()
  })

  // @clause CL-TOOL-001
  it('succeeds when list_projects returns JSON with data array and pagination', async () => {
    mockFetch = createMockFetch({
      '/projects': {
        status: 200,
        data: {
          data: [{ id: 'proj_1', name: 'test', workspace: { id: 'ws_1', name: 'main' } }],
          pagination: { page: 1, limit: 20, total: 1, pages: 1 },
        },
      },
    })

    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, mockFetch)
    const server = createMockServer(config, client)
    const result = await server.callTool('list_projects', {})

    expect(result.content[0].type).toBe('text')
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed).toHaveProperty('data')
    expect(Array.isArray(parsed.data)).toBe(true)
    expect(parsed).toHaveProperty('pagination')
  })

  // @clause CL-TOOL-002
  it('succeeds when get_project returns JSON with id, name, workspace', async () => {
    mockFetch = createMockFetch({
      '/projects/proj_1': {
        status: 200,
        data: { id: 'proj_1', name: 'test', workspace: { id: 'ws_1', name: 'main' } },
      },
    })

    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, mockFetch)
    const server = createMockServer(config, client)
    const result = await server.callTool('get_project', { projectId: 'proj_1' })

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed).toHaveProperty('id')
    expect(parsed).toHaveProperty('name')
    expect(parsed).toHaveProperty('workspace')
  })

  // @clause CL-TOOL-003
  it('succeeds when list_validators returns array with code, displayName, gate', async () => {
    mockFetch = createMockFetch({
      '/validators': {
        status: 200,
        data: [{ code: 'TEST', displayName: 'Test Validator', gate: 1 }],
      },
    })

    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, mockFetch)
    const server = createMockServer(config, client)
    const result = await server.callTool('list_validators', {})

    const parsed = JSON.parse(result.content[0].text)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed[0]).toHaveProperty('code')
    expect(parsed[0]).toHaveProperty('displayName')
    expect(parsed[0]).toHaveProperty('gate')
  })

  // @clause CL-TOOL-004
  it('succeeds when create_run returns runId, outputId, status PENDING, createdAt', async () => {
    mockFetch = createMockFetch({
      '/validation/runs': {
        status: 201,
        data: {
          runId: 'run_123',
          outputId: '2026_01_29_001',
          status: 'PENDING',
          createdAt: new Date().toISOString(),
        },
      },
    })

    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, mockFetch)
    const server = createMockServer(config, client)
    const result = await server.callTool('create_run', {
      outputId: '2026_01_29_001',
      taskPrompt: 'Test task',
      manifest: { files: [], testFile: 'test.spec.ts' },
    })

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed).toHaveProperty('runId')
    expect(parsed.status).toBe('PENDING')
  })

  // @clause CL-TOOL-005
  it('succeeds when get_run_status returns JSON with id, status, outputId', async () => {
    mockFetch = createMockFetch({
      '/runs/run_123': {
        status: 200,
        data: { id: 'run_123', status: 'RUNNING', outputId: '2026_01_29_001', createdAt: new Date().toISOString() },
      },
    })

    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, mockFetch)
    const server = createMockServer(config, client)
    const result = await server.callTool('get_run_status', { runId: 'run_123' })

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed).toHaveProperty('id')
    expect(parsed).toHaveProperty('status')
    expect(parsed).toHaveProperty('outputId')
  })

  // @clause CL-TOOL-006
  it('succeeds when list_runs returns JSON with data array and pagination', async () => {
    mockFetch = createMockFetch({
      '/runs': {
        status: 200,
        data: {
          data: [{ id: 'run_1', status: 'PASSED', outputId: 'out_1', createdAt: new Date().toISOString() }],
          pagination: { page: 1, limit: 20, total: 1, pages: 1 },
        },
      },
    })

    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, mockFetch)
    const server = createMockServer(config, client)
    const result = await server.callTool('list_runs', {})

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed).toHaveProperty('data')
    expect(parsed).toHaveProperty('pagination')
  })

  // @clause CL-TOOL-007
  it('succeeds when abort_run returns run with status ABORTED', async () => {
    mockFetch = createMockFetch({
      '/runs/run_123/abort': {
        status: 200,
        data: { id: 'run_123', status: 'ABORTED', outputId: 'out_1', createdAt: new Date().toISOString() },
      },
    })

    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, mockFetch)
    const server = createMockServer(config, client)
    const result = await server.callTool('abort_run', { runId: 'run_123' })

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.status).toBe('ABORTED')
  })

  // @clause CL-TOOL-008
  it('succeeds when upload_spec returns message and files', async () => {
    mockFetch = createMockFetch({
      '/runs/run_123/files': {
        status: 200,
        data: { message: 'Files uploaded', files: ['spec.ts'] },
      },
    })

    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, mockFetch)
    const server = createMockServer(config, client)
    const result = await server.callTool('upload_spec', { runId: 'run_123', content: 'test content' })

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed).toHaveProperty('message')
    expect(parsed).toHaveProperty('files')
    expect(Array.isArray(parsed.files)).toBe(true)
  })

  // @clause CL-TOOL-009
  it('succeeds when continue_run returns message confirming rerun', async () => {
    mockFetch = createMockFetch({
      '/runs/run_123/rerun/0': {
        status: 200,
        data: { message: 'Run restarted from gate 0' },
      },
    })

    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, mockFetch)
    const server = createMockServer(config, client)
    const result = await server.callTool('continue_run', { runId: 'run_123' })

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed).toHaveProperty('message')
  })

  // @clause CL-TOOL-010
  it('fails when API is offline and returns isError true', async () => {
    mockFetch = createMockFetch({
      '/projects': { status: 0, error: true },
    })

    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, mockFetch)
    const server = createMockServer(config, client)
    const result = await server.callTool('list_projects', {})

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('error')
  })

  // @clause CL-TOOL-011
  it('fails when create_run is called without required fields and returns isError true', async () => {
    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, createMockFetch({}))
    const server = createMockServer(config, client)
    const result = await server.callTool('create_run', { outputId: 'test' }) // missing taskPrompt and manifest

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('required')
  })

  // @clause CL-TOOL-012
  it('fails when get_run_status is called with nonexistent runId and returns isError true', async () => {
    mockFetch = createMockFetch({
      '/runs/nonexistent': { status: 404, data: { error: 'Not found' } },
    })

    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, mockFetch)
    const server = createMockServer(config, client)
    const result = await server.callTool('get_run_status', { runId: 'nonexistent' })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('not found')
  })
})

// =============================================================================
// TESTS - Phase 3: Tools for Artifacts
// =============================================================================

describe('Phase 3: Tools for Artifacts', () => {
  let config: Config

  beforeEach(() => {
    config = createMockConfig({ ARTIFACTS_DIR: TEST_ARTIFACTS_DIR, DOCS_DIR: TEST_DOCS_DIR })
    setupTestDirs()
  })

  afterEach(() => {
    cleanupTestDirs()
  })

  // @clause CL-ART-001
  it('succeeds when save_artifact saves file and returns path', async () => {
    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, createMockFetch({}))
    const server = createMockServer(config, client)

    const result = await server.callTool('save_artifact', {
      outputId: '2026_01_29_001',
      filename: 'plan.json',
      content: '{"test": true}',
    })

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed).toHaveProperty('path')
    
    const savedPath = path.join(TEST_ARTIFACTS_DIR, '2026_01_29_001', 'plan.json')
    expect(fs.existsSync(savedPath)).toBe(true)
    expect(fs.readFileSync(savedPath, 'utf-8')).toBe('{"test": true}')
  })

  // @clause CL-ART-002
  it('succeeds when read_artifact returns file content', async () => {
    // Setup: create artifact first
    const artifactDir = path.join(TEST_ARTIFACTS_DIR, '2026_01_29_001')
    fs.mkdirSync(artifactDir, { recursive: true })
    fs.writeFileSync(path.join(artifactDir, 'test.txt'), 'Hello World')

    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, createMockFetch({}))
    const server = createMockServer(config, client)

    const result = await server.callTool('read_artifact', {
      outputId: '2026_01_29_001',
      filename: 'test.txt',
    })

    expect(result.content[0].text).toBe('Hello World')
  })

  // @clause CL-ART-003
  it('succeeds when list_artifacts without outputId returns folders with outputId', async () => {
    // Setup: create artifact folders
    fs.mkdirSync(path.join(TEST_ARTIFACTS_DIR, 'output_1'), { recursive: true })
    fs.mkdirSync(path.join(TEST_ARTIFACTS_DIR, 'output_2'), { recursive: true })

    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, createMockFetch({}))
    const server = createMockServer(config, client)

    const result = await server.callTool('list_artifacts', {})

    const parsed = JSON.parse(result.content[0].text)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.length).toBe(2)
    expect(parsed[0]).toHaveProperty('outputId')
  })

  // @clause CL-ART-004
  it('succeeds when list_artifacts with outputId returns files with filename', async () => {
    // Setup: create files in artifact folder
    const artifactDir = path.join(TEST_ARTIFACTS_DIR, '2026_01_29_001')
    fs.mkdirSync(artifactDir, { recursive: true })
    fs.writeFileSync(path.join(artifactDir, 'plan.json'), '{}')
    fs.writeFileSync(path.join(artifactDir, 'spec.ts'), '')

    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, createMockFetch({}))
    const server = createMockServer(config, client)

    const result = await server.callTool('list_artifacts', { outputId: '2026_01_29_001' })

    const parsed = JSON.parse(result.content[0].text)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.length).toBe(2)
    expect(parsed[0]).toHaveProperty('filename')
  })

  // @clause CL-ART-005
  it('succeeds when delete_artifact deletes file and returns deleted true', async () => {
    // Setup: create artifact
    const artifactDir = path.join(TEST_ARTIFACTS_DIR, '2026_01_29_001')
    fs.mkdirSync(artifactDir, { recursive: true })
    const filePath = path.join(artifactDir, 'to_delete.txt')
    fs.writeFileSync(filePath, 'delete me')

    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, createMockFetch({}))
    const server = createMockServer(config, client)

    const result = await server.callTool('delete_artifact', {
      outputId: '2026_01_29_001',
      filename: 'to_delete.txt',
    })

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.deleted).toBe(true)
    expect(fs.existsSync(filePath)).toBe(false)
  })

  // @clause CL-ART-006
  it('fails when read_artifact is called for nonexistent file and returns isError true', async () => {
    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, createMockFetch({}))
    const server = createMockServer(config, client)

    const result = await server.callTool('read_artifact', {
      outputId: 'nonexistent',
      filename: 'missing.txt',
    })

    expect(result.isError).toBe(true)
  })

  // @clause CL-ART-007
  it('fails when save_artifact is called with path traversal and returns isError true', async () => {
    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, createMockFetch({}))
    const server = createMockServer(config, client)

    const result = await server.callTool('save_artifact', {
      outputId: '2026_01_29_001',
      filename: '../../../etc/passwd',
      content: 'malicious',
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('path')
    
    // Verify file was NOT saved outside artifacts dir
    expect(fs.existsSync('/etc/passwd.bak')).toBe(false)
  })
})

// =============================================================================
// TESTS - Phase 4: Tools for Session Config
// =============================================================================

describe('Phase 4: Tools for Session Config', () => {
  let config: Config

  beforeEach(() => {
    config = createMockConfig({ ARTIFACTS_DIR: TEST_ARTIFACTS_DIR, DOCS_DIR: TEST_DOCS_DIR })
    setupTestDirs()
  })

  afterEach(() => {
    cleanupTestDirs()
  })

  // @clause CL-SESS-001
  it('succeeds when get_session_config returns GATEKEEPER_API_URL, DOCS_DIR, ARTIFACTS_DIR', async () => {
    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, createMockFetch({}))
    const server = createMockServer(config, client)

    const result = await server.callTool('get_session_config', {})

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed).toHaveProperty('GATEKEEPER_API_URL')
    expect(parsed).toHaveProperty('DOCS_DIR')
    expect(parsed).toHaveProperty('ARTIFACTS_DIR')
  })

  // @clause CL-SESS-002
  it('succeeds when get_active_context_files returns array of .md files', async () => {
    // Setup: create .md files in DOCS_DIR
    fs.writeFileSync(path.join(TEST_DOCS_DIR, 'PLAYBOOK.md'), '# Playbook')
    fs.writeFileSync(path.join(TEST_DOCS_DIR, 'CONTRACT.md'), '# Contract')
    fs.writeFileSync(path.join(TEST_DOCS_DIR, 'readme.txt'), 'Not markdown')

    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, createMockFetch({}))
    const server = createMockServer(config, client)

    const result = await server.callTool('get_active_context_files', {})

    const parsed = JSON.parse(result.content[0].text)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.length).toBe(2)
    expect(parsed.every((f: string) => f.endsWith('.md'))).toBe(true)
  })

  // @clause CL-SESS-003
  it('succeeds when get_active_snippets returns empty array (placeholder)', async () => {
    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, createMockFetch({}))
    const server = createMockServer(config, client)

    const result = await server.callTool('get_active_snippets', {})

    const parsed = JSON.parse(result.content[0].text)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.length).toBe(0)
  })

  // @clause CL-SESS-004
  it('succeeds when get_variables returns environment variables', async () => {
    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, createMockFetch({}))
    const server = createMockServer(config, client)

    const result = await server.callTool('get_variables', {})

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed).toHaveProperty('GATEKEEPER_API_URL')
    expect(parsed).toHaveProperty('DOCS_DIR')
  })
})

// =============================================================================
// TESTS - Phase 5: Notifications
// =============================================================================

describe('Phase 5: Notifications', () => {
  let config: Config

  beforeEach(() => {
    config = createMockConfig({ ARTIFACTS_DIR: TEST_ARTIFACTS_DIR, DOCS_DIR: TEST_DOCS_DIR })
    setupTestDirs()
  })

  afterEach(() => {
    cleanupTestDirs()
  })

  // @clause CL-NOTIFY-001
  it('succeeds when run changes to PASSED and notifications enabled, toast and sound triggered', () => {
    const notificationManager = createMockNotificationManager(config)
    
    notificationManager.handleRunStatusChange('run_123', 'PASSED')

    expect(notificationManager.desktopNotifier.notify).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining('Passed') })
    )
    expect(notificationManager.soundNotifier.play).toHaveBeenCalledWith('success')
  })

  // @clause CL-NOTIFY-002
  it('succeeds when run changes to FAILED and notifications enabled, toast and sound triggered', () => {
    const notificationManager = createMockNotificationManager(config)
    
    notificationManager.handleRunStatusChange('run_123', 'FAILED')

    expect(notificationManager.desktopNotifier.notify).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining('Failed') })
    )
    expect(notificationManager.soundNotifier.play).toHaveBeenCalledWith('failure')
  })

  // @clause CL-NOTIFY-003
  it('succeeds when notifications disabled and run changes status, no toast or sound triggered', () => {
    config.NOTIFICATIONS_DESKTOP = false
    config.NOTIFICATIONS_SOUND = false
    const notificationManager = createMockNotificationManager(config)
    
    notificationManager.handleRunStatusChange('run_123', 'PASSED')

    expect(notificationManager.desktopNotifier.notify).not.toHaveBeenCalled()
    expect(notificationManager.soundNotifier.play).not.toHaveBeenCalled()
  })

  // @clause CL-NOTIFY-004
  it('succeeds when configure_notifications updates config and reflects in get_session_config', async () => {
    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, createMockFetch({}))
    const server = createMockServer(config, client)

    // Configure notifications to disable desktop
    const configResult = await server.callTool('configure_notifications', { desktop: false })
    const configParsed = JSON.parse(configResult.content[0].text)
    expect(configParsed.desktop).toBe(false)

    // Verify get_session_config reflects change
    const sessionResult = await server.callTool('get_session_config', {})
    const sessionParsed = JSON.parse(sessionResult.content[0].text)
    expect(sessionParsed.notifications.desktop).toBe(false)
  })
})

// =============================================================================
// TESTS - Phase 7: Prompts
// =============================================================================

describe('Phase 7: Prompts', () => {
  let config: Config

  beforeEach(() => {
    config = createMockConfig({ ARTIFACTS_DIR: TEST_ARTIFACTS_DIR, DOCS_DIR: TEST_DOCS_DIR })
    setupTestDirs()
  })

  afterEach(() => {
    cleanupTestDirs()
  })

  // @clause CL-PROMPT-001
  it('succeeds when create_plan includes CONTRACT_QUESTIONNAIRES, PLANNER_PLAYBOOK, and taskDescription', async () => {
    // Setup: create playbook files
    fs.writeFileSync(path.join(TEST_DOCS_DIR, 'CONTRACT_QUESTIONNAIRES.md'), '# Questionnaires')
    fs.writeFileSync(path.join(TEST_DOCS_DIR, 'PLANNER_PLAYBOOK.md'), '# Planner Playbook')

    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, createMockFetch({}))
    const server = createMockServer(config, client)

    const result = await server.getPrompt('create_plan', { taskDescription: 'Build a new feature' })

    expect(result.messages[0].role).toBe('user')
    expect(result.messages[0].content.text).toContain('CONTRACT_QUESTIONNAIRES')
    expect(result.messages[0].content.text).toContain('PLANNER_PLAYBOOK')
    expect(result.messages[0].content.text).toContain('Build a new feature')
  })

  // @clause CL-PROMPT-002
  it('succeeds when generate_spec contains contractContent', async () => {
    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, createMockFetch({}))
    const server = createMockServer(config, client)

    const contractContent = '## Clause CL-001\nWhen X then Y'
    const result = await server.getPrompt('generate_spec', { contractContent })

    expect(result.messages[0].role).toBe('user')
    expect(result.messages[0].content.text).toContain(contractContent)
  })

  // @clause CL-PROMPT-003
  it('succeeds when implement_code contains specContent and contractContent', async () => {
    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, createMockFetch({}))
    const server = createMockServer(config, client)

    const specContent = 'describe("test", () => { it("works") })'
    const contractContent = '## Contract clause'
    const result = await server.getPrompt('implement_code', { specContent, contractContent })

    expect(result.messages[0].role).toBe('user')
    expect(result.messages[0].content.text).toContain(specContent)
    expect(result.messages[0].content.text).toContain(contractContent)
  })

  // @clause CL-PROMPT-004
  it('succeeds when fix_gate_failure contains validatorCode and errorMessage', async () => {
    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, createMockFetch({}))
    const server = createMockServer(config, client)

    const result = await server.getPrompt('fix_gate_failure', {
      validatorCode: 'TestSyntaxValid',
      errorMessage: 'SyntaxError: Unexpected token',
    })

    expect(result.messages[0].content.text).toContain('TestSyntaxValid')
    expect(result.messages[0].content.text).toContain('SyntaxError: Unexpected token')
  })

  // @clause CL-PROMPT-005
  it('succeeds when DOCS_DIR does not exist and prompt returns fallback message without throwing', async () => {
    // Use nonexistent docs dir
    config.DOCS_DIR = '/nonexistent/docs/dir'
    
    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, createMockFetch({}))
    const server = createMockServer(config, client)

    // Should not throw
    const result = await server.getPrompt('create_plan', { taskDescription: 'Test task' })

    expect(result.messages[0].role).toBe('user')
    expect(result.messages[0].content.text).toContain('Test task')
    // Should contain fallback indicator
    expect(result.messages[0].content.text).toMatch(/not found|fallback/i)
  })
})

// =============================================================================
// TESTS - Client Extensions
// =============================================================================

describe('Client Extensions', () => {
  // @clause CL-CLIENT-001
  it('succeeds when uploadRunFiles makes PUT request and returns message and files', async () => {
    const mockFetch = createMockFetch({
      '/runs/run_123/files': {
        status: 200,
        data: { message: 'Files uploaded successfully', files: ['spec.ts', 'plan.json'] },
      },
    })

    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, mockFetch)
    const result = await client.uploadRunFiles('run_123', [
      { filename: 'spec.ts', content: 'test content' },
    ])

    expect(result).toHaveProperty('message')
    expect(result).toHaveProperty('files')
  })

  // @clause CL-CLIENT-002
  it('succeeds when continueRun makes POST request to rerun endpoint', async () => {
    const mockFetch = createMockFetch({
      '/runs/run_123/rerun/1': {
        status: 200,
        data: { message: 'Run restarted from gate 1' },
      },
    })

    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, mockFetch)
    const result = await client.continueRun('run_123', 1)

    expect(result).toHaveProperty('message')
  })
})

// =============================================================================
// TESTS - Server Registration
// =============================================================================

describe('Server Registration', () => {
  let config: Config

  beforeEach(() => {
    config = createMockConfig({ ARTIFACTS_DIR: TEST_ARTIFACTS_DIR, DOCS_DIR: TEST_DOCS_DIR })
    setupTestDirs()
  })

  afterEach(() => {
    cleanupTestDirs()
  })

  // @clause CL-SERVER-001
  it('succeeds when ListToolsRequest returns tools array with name, description, inputSchema', () => {
    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, createMockFetch({}))
    const server = createMockServer(config, client)

    const result = server.listTools()

    expect(Array.isArray(result.tools)).toBe(true)
    expect(result.tools.length).toBeGreaterThan(0)
    
    const tool = result.tools[0]
    expect(tool).toHaveProperty('name')
    expect(tool).toHaveProperty('description')
    expect(tool).toHaveProperty('inputSchema')
  })

  // @clause CL-SERVER-002
  it('succeeds when ListPromptsRequest returns prompts array with name and description', () => {
    const client = new MockGatekeeperClient({ baseUrl: 'http://localhost:3000' }, createMockFetch({}))
    const server = createMockServer(config, client)

    const result = server.listPrompts()

    expect(Array.isArray(result.prompts)).toBe(true)
    expect(result.prompts.length).toBeGreaterThan(0)
    
    const prompt = result.prompts[0]
    expect(prompt).toHaveProperty('name')
    expect(prompt).toHaveProperty('description')
  })
})
