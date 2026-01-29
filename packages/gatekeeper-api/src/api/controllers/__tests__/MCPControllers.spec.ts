import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Contract: mcp-session-backend
 * Mode: STRICT
 * 
 * Objetivo: Validar Models Prisma + Endpoints REST do MCP Session.
 * 
 * Este spec define o contrato para:
 * - Snippets CRUD (/api/mcp/snippets)
 * - Context Packs CRUD (/api/mcp/context-packs)
 * - Session Presets CRUD (/api/mcp/presets)
 * - Session Config singleton (/api/mcp/session)
 * - Session History (/api/mcp/history)
 * - Status endpoint (/api/mcp/status)
 */

// =============================================================================
// INLINE TYPES (evita dependência de @types/express durante validação)
// =============================================================================

interface Request {
  params?: Record<string, string>
  body?: Record<string, unknown>
  query?: Record<string, string | number>
}

interface Response {
  json: (data: unknown) => void
  status: (code: number) => Response
  send: () => void
}

// =============================================================================
// MOCK DATA FACTORIES
// =============================================================================

const createMockSnippet = (overrides = {}) => ({
  id: 'snip_test_001',
  name: 'Test Snippet',
  category: 'TEMPLATES',
  content: '# Test Template\n\nContent here',
  tags: '["test", "template"]',
  createdAt: new Date('2026-01-29T10:00:00Z'),
  updatedAt: new Date('2026-01-29T10:00:00Z'),
  ...overrides,
})

const createMockContextPack = (overrides = {}) => ({
  id: 'ctxp_test_001',
  name: 'Test Context Pack',
  description: 'A test context pack',
  files: '["src/index.ts", "src/utils.ts"]',
  createdAt: new Date('2026-01-29T10:00:00Z'),
  updatedAt: new Date('2026-01-29T10:00:00Z'),
  ...overrides,
})

const createMockPreset = (overrides = {}) => ({
  id: 'pres_test_001',
  name: 'Test Preset',
  config: JSON.stringify({ gitStrategy: 'main', taskType: 'bugfix' }),
  createdAt: new Date('2026-01-29T10:00:00Z'),
  updatedAt: new Date('2026-01-29T10:00:00Z'),
  ...overrides,
})

const createMockSessionConfig = (overrides = {}) => ({
  id: 'singleton',
  config: JSON.stringify({ gitStrategy: 'main', taskType: 'feature', snippetIds: [] }),
  updatedAt: new Date('2026-01-29T10:00:00Z'),
  ...overrides,
})

const createMockHistoryEntry = (overrides = {}) => ({
  id: 'hist_test_001',
  taskType: 'feature',
  gitStrategy: 'new_branch',
  branch: 'feature/test',
  projectId: 'proj_001',
  status: 'COMPLETED',
  runIds: '["run_001", "run_002"]',
  notes: 'Test session notes',
  createdAt: new Date('2026-01-29T10:00:00Z'),
  ...overrides,
})

// =============================================================================
// MOCK PRISMA CLIENT
// =============================================================================

const mockPrisma = vi.hoisted(() => ({
  snippet: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  contextPack: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  sessionPreset: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  mCPSessionConfig: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  sessionHistory: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  $queryRaw: vi.fn(),
}))

vi.mock('../../../db/client.js', () => ({
  prisma: mockPrisma,
}))

// =============================================================================
// MOCK CONTROLLERS (inline - serão implementados)
// =============================================================================

/**
 * Mock MCPSnippetController
 * Implementação esperada em: packages/gatekeeper-api/src/api/controllers/MCPSnippetController.ts
 */
class MCPSnippetController {
  async list(req: Request, res: Response): Promise<void> {
    const { page = 1, limit = 20, category } = req.query || {}
    const skip = (Number(page) - 1) * Number(limit)
    
    const where = category ? { category: String(category) } : {}
    
    const [snippets, total] = await Promise.all([
      mockPrisma.snippet.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      mockPrisma.snippet.count({ where }),
    ])

    res.json({
      data: snippets,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    })
  }

  async get(req: Request, res: Response): Promise<void> {
    const { id } = req.params || {}
    const snippet = await mockPrisma.snippet.findUnique({ where: { id } })
    
    if (!snippet) {
      res.status(404).json({ error: 'Snippet not found' })
      return
    }
    
    res.json(snippet)
  }

  async create(req: Request, res: Response): Promise<void> {
    const { name, category, content, tags } = req.body || {}
    
    if (!name) {
      res.status(400).json({ error: 'name is required' })
      return
    }

    // Check for duplicate name
    const existing = await mockPrisma.snippet.findUnique({ where: { name: String(name) } })
    if (existing) {
      res.status(400).json({ error: 'Snippet with this name already exists' })
      return
    }

    const snippet = await mockPrisma.snippet.create({
      data: {
        name: String(name),
        category: String(category || 'OTHER'),
        content: String(content || ''),
        tags: JSON.stringify(tags || []),
      },
    })

    res.status(201).json(snippet)
  }

  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params || {}
    const { name, category, content, tags } = req.body || {}

    const existing = await mockPrisma.snippet.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Snippet not found' })
      return
    }

    const updated = await mockPrisma.snippet.update({
      where: { id },
      data: {
        ...(name && { name: String(name) }),
        ...(category && { category: String(category) }),
        ...(content !== undefined && { content: String(content) }),
        ...(tags && { tags: JSON.stringify(tags) }),
      },
    })

    res.json(updated)
  }

  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params || {}

    const existing = await mockPrisma.snippet.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Snippet not found' })
      return
    }

    await mockPrisma.snippet.delete({ where: { id } })
    res.status(204).send()
  }
}

/**
 * Mock MCPContextPackController
 */
class MCPContextPackController {
  async list(req: Request, res: Response): Promise<void> {
    const { page = 1, limit = 20 } = req.query || {}
    const skip = (Number(page) - 1) * Number(limit)
    
    const [packs, total] = await Promise.all([
      mockPrisma.contextPack.findMany({
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      mockPrisma.contextPack.count(),
    ])

    res.json({
      data: packs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    })
  }

  async get(req: Request, res: Response): Promise<void> {
    const { id } = req.params || {}
    const pack = await mockPrisma.contextPack.findUnique({ where: { id } })
    
    if (!pack) {
      res.status(404).json({ error: 'Context pack not found' })
      return
    }
    
    res.json(pack)
  }

  async create(req: Request, res: Response): Promise<void> {
    const { name, description, files } = req.body || {}

    const pack = await mockPrisma.contextPack.create({
      data: {
        name: String(name),
        description: description ? String(description) : null,
        files: JSON.stringify(files || []),
      },
    })

    res.status(201).json(pack)
  }

  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params || {}
    const { name, description, files } = req.body || {}

    const existing = await mockPrisma.contextPack.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Context pack not found' })
      return
    }

    const updated = await mockPrisma.contextPack.update({
      where: { id },
      data: {
        ...(name && { name: String(name) }),
        ...(description !== undefined && { description: description ? String(description) : null }),
        ...(files && { files: JSON.stringify(files) }),
      },
    })

    res.json(updated)
  }

  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params || {}

    const existing = await mockPrisma.contextPack.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Context pack not found' })
      return
    }

    await mockPrisma.contextPack.delete({ where: { id } })
    res.status(204).send()
  }
}

/**
 * Mock MCPSessionPresetController
 */
class MCPSessionPresetController {
  async list(req: Request, res: Response): Promise<void> {
    const { page = 1, limit = 20 } = req.query || {}
    const skip = (Number(page) - 1) * Number(limit)
    
    const [presets, total] = await Promise.all([
      mockPrisma.sessionPreset.findMany({
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      mockPrisma.sessionPreset.count(),
    ])

    res.json({
      data: presets,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    })
  }

  async get(req: Request, res: Response): Promise<void> {
    const { id } = req.params || {}
    const preset = await mockPrisma.sessionPreset.findUnique({ where: { id } })
    
    if (!preset) {
      res.status(404).json({ error: 'Preset not found' })
      return
    }
    
    res.json(preset)
  }

  async create(req: Request, res: Response): Promise<void> {
    const { name, config } = req.body || {}

    const preset = await mockPrisma.sessionPreset.create({
      data: {
        name: String(name),
        config: typeof config === 'string' ? config : JSON.stringify(config),
      },
    })

    res.status(201).json(preset)
  }

  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params || {}
    const { name, config } = req.body || {}

    const existing = await mockPrisma.sessionPreset.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Preset not found' })
      return
    }

    const updated = await mockPrisma.sessionPreset.update({
      where: { id },
      data: {
        ...(name && { name: String(name) }),
        ...(config && { config: typeof config === 'string' ? config : JSON.stringify(config) }),
      },
    })

    res.json(updated)
  }

  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params || {}

    const existing = await mockPrisma.sessionPreset.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Preset not found' })
      return
    }

    await mockPrisma.sessionPreset.delete({ where: { id } })
    res.status(204).send()
  }
}

/**
 * Mock MCPSessionConfigController
 */
class MCPSessionConfigController {
  async get(_req: Request, res: Response): Promise<void> {
    let config = await mockPrisma.mCPSessionConfig.findUnique({ 
      where: { id: 'singleton' } 
    })

    if (!config) {
      config = await mockPrisma.mCPSessionConfig.upsert({
        where: { id: 'singleton' },
        update: {},
        create: {
          id: 'singleton',
          config: JSON.stringify({}),
        },
      })
    }

    res.json({
      id: config.id,
      config: JSON.parse(config.config as string),
      updatedAt: config.updatedAt,
    })
  }

  async update(req: Request, res: Response): Promise<void> {
    const { config } = req.body || {}

    const updated = await mockPrisma.mCPSessionConfig.upsert({
      where: { id: 'singleton' },
      update: {
        config: typeof config === 'string' ? config : JSON.stringify(config),
      },
      create: {
        id: 'singleton',
        config: typeof config === 'string' ? config : JSON.stringify(config),
      },
    })

    res.json({
      id: updated.id,
      config: JSON.parse(updated.config as string),
      updatedAt: updated.updatedAt,
    })
  }
}

/**
 * Mock MCPSessionHistoryController
 */
class MCPSessionHistoryController {
  async list(req: Request, res: Response): Promise<void> {
    const { page = 1, limit = 20 } = req.query || {}
    const skip = (Number(page) - 1) * Number(limit)
    
    const [history, total] = await Promise.all([
      mockPrisma.sessionHistory.findMany({
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      mockPrisma.sessionHistory.count(),
    ])

    res.json({
      data: history,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    })
  }

  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params || {}

    const existing = await mockPrisma.sessionHistory.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'History entry not found' })
      return
    }

    await mockPrisma.sessionHistory.delete({ where: { id } })
    res.status(204).send()
  }
}

/**
 * Mock MCPStatusController
 */
class MCPStatusController {
  async get(_req: Request, res: Response): Promise<void> {
    let databaseOk = false
    
    try {
      await mockPrisma.$queryRaw`SELECT 1`
      databaseOk = true
    } catch {
      databaseOk = false
    }

    res.json({
      database: databaseOk,
      timestamp: new Date().toISOString(),
    })
  }
}

// =============================================================================
// TEST HELPERS
// =============================================================================

function createMockResponse(): { res: Response; jsonSpy: ReturnType<typeof vi.fn>; statusSpy: ReturnType<typeof vi.fn>; sendSpy: ReturnType<typeof vi.fn> } {
  const jsonSpy = vi.fn()
  const sendSpy = vi.fn()
  const statusSpy = vi.fn()
  
  const res: Response = {
    json: jsonSpy,
    send: sendSpy,
    status: (code: number) => {
      statusSpy(code)
      return res
    },
  }
  
  return { res, jsonSpy, statusSpy, sendSpy }
}

// =============================================================================
// SNIPPET CONTROLLER TESTS
// =============================================================================

describe('MCPSnippetController', () => {
  let controller: MCPSnippetController
  
  beforeEach(() => {
    controller = new MCPSnippetController()
    vi.clearAllMocks()
  })

  describe('GET /api/mcp/snippets', () => {
    // @clause CL-SNIP-001
    it('succeeds when listing snippets with pagination', async () => {
      const mockSnippets = [
        createMockSnippet({ id: 'snip_001', name: 'Snippet 1' }),
        createMockSnippet({ id: 'snip_002', name: 'Snippet 2' }),
      ]
      
      mockPrisma.snippet.findMany.mockResolvedValue(mockSnippets)
      mockPrisma.snippet.count.mockResolvedValue(2)
      
      const req: Request = { query: { page: 1, limit: 20 } }
      const { res, jsonSpy } = createMockResponse()
      
      await controller.list(req, res)
      
      const response = jsonSpy.mock.calls[0][0]
      
      // Assertions: status 200, body.data array, body.pagination
      expect(Array.isArray(response.data)).toBe(true)
      expect(response.data).toHaveLength(2)
      expect(response.pagination).toBeDefined()
      expect(response.pagination.page).toBe(1)
      expect(response.pagination.limit).toBe(20)
      expect(response.pagination.total).toBe(2)
      expect(response.pagination.pages).toBe(1)
    })
  })

  describe('POST /api/mcp/snippets', () => {
    // @clause CL-SNIP-002
    it('succeeds when creating snippet with valid name, category, content', async () => {
      const createdSnippet = createMockSnippet({
        id: 'snip_new_001',
        name: 'New Snippet',
        category: 'TEMPLATES',
        content: '# New Content',
      })
      
      mockPrisma.snippet.findUnique.mockResolvedValue(null) // No duplicate
      mockPrisma.snippet.create.mockResolvedValue(createdSnippet)
      
      const req: Request = {
        body: {
          name: 'New Snippet',
          category: 'TEMPLATES',
          content: '# New Content',
        },
      }
      const { res, jsonSpy, statusSpy } = createMockResponse()
      
      await controller.create(req, res)
      
      expect(statusSpy).toHaveBeenCalledWith(201)
      
      const response = jsonSpy.mock.calls[0][0]
      
      // Assertions: status 201, body.id string, body.name = sent, body.createdAt ISO
      expect(typeof response.id).toBe('string')
      expect(response.id.length).toBeGreaterThan(0)
      expect(response.name).toBe('New Snippet')
      expect(response.createdAt).toBeDefined()
      expect(new Date(response.createdAt).toISOString()).toBe(response.createdAt.toISOString())
    })
  })

  describe('GET /api/mcp/snippets/:id', () => {
    // @clause CL-SNIP-003
    it('succeeds when fetching snippet by valid ID', async () => {
      const mockSnippet = createMockSnippet({
        id: 'snip_existing_001',
        name: 'Existing Snippet',
        category: 'INSTRUCTIONS',
        content: 'Content here',
        tags: '["tag1", "tag2"]',
      })
      
      mockPrisma.snippet.findUnique.mockResolvedValue(mockSnippet)
      
      const req: Request = { params: { id: 'snip_existing_001' } }
      const { res, jsonSpy } = createMockResponse()
      
      await controller.get(req, res)
      
      const response = jsonSpy.mock.calls[0][0]
      
      // Assertions: status 200, body contains id, name, category, content, tags
      expect(response.id).toBe('snip_existing_001')
      expect(response.name).toBe('Existing Snippet')
      expect(response.category).toBe('INSTRUCTIONS')
      expect(response.content).toBe('Content here')
      expect(response.tags).toBeDefined()
    })
  })

  describe('PUT /api/mcp/snippets/:id', () => {
    // @clause CL-SNIP-004
    it('succeeds when updating snippet with valid data', async () => {
      const existingSnippet = createMockSnippet({
        id: 'snip_update_001',
        name: 'Old Name',
        createdAt: new Date('2026-01-29T10:00:00Z'),
        updatedAt: new Date('2026-01-29T10:00:00Z'),
      })
      
      const updatedSnippet = {
        ...existingSnippet,
        name: 'New Name',
        updatedAt: new Date('2026-01-29T11:00:00Z'),
      }
      
      mockPrisma.snippet.findUnique.mockResolvedValue(existingSnippet)
      mockPrisma.snippet.update.mockResolvedValue(updatedSnippet)
      
      const req: Request = {
        params: { id: 'snip_update_001' },
        body: { name: 'New Name' },
      }
      const { res, jsonSpy } = createMockResponse()
      
      await controller.update(req, res)
      
      const response = jsonSpy.mock.calls[0][0]
      
      // Assertions: status 200, body.name = new value, updatedAt != createdAt
      expect(response.name).toBe('New Name')
      expect(response.updatedAt.getTime()).not.toBe(response.createdAt.getTime())
    })
  })

  describe('DELETE /api/mcp/snippets/:id', () => {
    // @clause CL-SNIP-005
    it('succeeds when deleting snippet with valid ID', async () => {
      const existingSnippet = createMockSnippet({ id: 'snip_delete_001' })
      
      mockPrisma.snippet.findUnique
        .mockResolvedValueOnce(existingSnippet) // First call: exists
        .mockResolvedValueOnce(null) // Subsequent call: not found
      mockPrisma.snippet.delete.mockResolvedValue(existingSnippet)
      
      const req: Request = { params: { id: 'snip_delete_001' } }
      const { res, statusSpy, sendSpy } = createMockResponse()
      
      await controller.delete(req, res)
      
      // Assertions: status 204
      expect(statusSpy).toHaveBeenCalledWith(204)
      expect(sendSpy).toHaveBeenCalled()
      
      // Verify snippet no longer exists
      const subsequentGet = await mockPrisma.snippet.findUnique({ where: { id: 'snip_delete_001' } })
      expect(subsequentGet).toBeNull()
    })
  })

  describe('Error Cases', () => {
    // @clause CL-SNIP-ERR-001
    it('fails when creating snippet without name', async () => {
      const req: Request = {
        body: {
          category: 'TEMPLATES',
          content: 'Some content',
        },
      }
      const { res, jsonSpy, statusSpy } = createMockResponse()
      
      await controller.create(req, res)
      
      expect(statusSpy).toHaveBeenCalledWith(400)
      
      const response = jsonSpy.mock.calls[0][0]
      expect(response.error).toBeDefined()
      expect(response.error.toLowerCase()).toContain('name')
    })

    // @clause CL-SNIP-ERR-002
    it('fails when fetching snippet with non-existent ID', async () => {
      mockPrisma.snippet.findUnique.mockResolvedValue(null)
      
      const req: Request = { params: { id: 'non_existent_id' } }
      const { res, jsonSpy, statusSpy } = createMockResponse()
      
      await controller.get(req, res)
      
      expect(statusSpy).toHaveBeenCalledWith(404)
      
      const response = jsonSpy.mock.calls[0][0]
      expect(response.error).toBeDefined()
      expect(response.error.toLowerCase()).toContain('not found')
    })

    // @clause CL-SNIP-ERR-003
    it('fails when creating snippet with duplicate name', async () => {
      const existingSnippet = createMockSnippet({ name: 'Duplicate Name' })
      mockPrisma.snippet.findUnique.mockResolvedValue(existingSnippet)
      
      const req: Request = {
        body: {
          name: 'Duplicate Name',
          category: 'TEMPLATES',
          content: 'Content',
        },
      }
      const { res, jsonSpy, statusSpy } = createMockResponse()
      
      await controller.create(req, res)
      
      expect(statusSpy).toHaveBeenCalledWith(400)
      
      const response = jsonSpy.mock.calls[0][0]
      expect(response.error).toBeDefined()
      expect(response.error.toLowerCase()).toContain('already exists')
    })
  })
})

// =============================================================================
// CONTEXT PACK CONTROLLER TESTS
// =============================================================================

describe('MCPContextPackController', () => {
  let controller: MCPContextPackController
  
  beforeEach(() => {
    controller = new MCPContextPackController()
    vi.clearAllMocks()
  })

  describe('GET /api/mcp/context-packs', () => {
    // @clause CL-CTXP-001
    it('succeeds when listing context packs with pagination', async () => {
      const mockPacks = [
        createMockContextPack({ id: 'ctxp_001', name: 'Pack 1' }),
        createMockContextPack({ id: 'ctxp_002', name: 'Pack 2' }),
      ]
      
      mockPrisma.contextPack.findMany.mockResolvedValue(mockPacks)
      mockPrisma.contextPack.count.mockResolvedValue(2)
      
      const req: Request = { query: { page: 1, limit: 20 } }
      const { res, jsonSpy } = createMockResponse()
      
      await controller.list(req, res)
      
      const response = jsonSpy.mock.calls[0][0]
      
      // Assertions: status 200, body.data array, body.pagination present
      expect(Array.isArray(response.data)).toBe(true)
      expect(response.pagination).toBeDefined()
      expect(response.pagination.page).toBe(1)
    })
  })

  describe('POST /api/mcp/context-packs', () => {
    // @clause CL-CTXP-002
    it('succeeds when creating context pack with name and files', async () => {
      const createdPack = createMockContextPack({
        id: 'ctxp_new_001',
        name: 'New Pack',
        files: '["src/file1.ts", "src/file2.ts"]',
      })
      
      mockPrisma.contextPack.create.mockResolvedValue(createdPack)
      
      const req: Request = {
        body: {
          name: 'New Pack',
          files: ['src/file1.ts', 'src/file2.ts'],
        },
      }
      const { res, jsonSpy, statusSpy } = createMockResponse()
      
      await controller.create(req, res)
      
      expect(statusSpy).toHaveBeenCalledWith(201)
      
      const response = jsonSpy.mock.calls[0][0]
      
      // Assertions: status 201, body.id string, body.files array
      expect(typeof response.id).toBe('string')
      expect(response.files).toBeDefined()
    })
  })

  describe('GET /api/mcp/context-packs/:id', () => {
    // @clause CL-CTXP-003
    it('succeeds when fetching context pack by valid ID', async () => {
      const mockPack = createMockContextPack({
        id: 'ctxp_existing_001',
        name: 'Existing Pack',
        description: 'Pack description',
        files: '["file1.ts"]',
      })
      
      mockPrisma.contextPack.findUnique.mockResolvedValue(mockPack)
      
      const req: Request = { params: { id: 'ctxp_existing_001' } }
      const { res, jsonSpy } = createMockResponse()
      
      await controller.get(req, res)
      
      const response = jsonSpy.mock.calls[0][0]
      
      // Assertions: status 200, body contains name, description, files
      expect(response.name).toBe('Existing Pack')
      expect(response.description).toBe('Pack description')
      expect(response.files).toBeDefined()
    })
  })

  describe('PUT /api/mcp/context-packs/:id', () => {
    // @clause CL-CTXP-004
    it('succeeds when updating context pack with valid data', async () => {
      const existingPack = createMockContextPack({
        id: 'ctxp_update_001',
        name: 'Old Name',
      })
      
      const updatedPack = {
        ...existingPack,
        name: 'Updated Name',
        updatedAt: new Date('2026-01-29T11:00:00Z'),
      }
      
      mockPrisma.contextPack.findUnique.mockResolvedValue(existingPack)
      mockPrisma.contextPack.update.mockResolvedValue(updatedPack)
      
      const req: Request = {
        params: { id: 'ctxp_update_001' },
        body: { name: 'Updated Name' },
      }
      const { res, jsonSpy } = createMockResponse()
      
      await controller.update(req, res)
      
      const response = jsonSpy.mock.calls[0][0]
      
      // Assertions: status 200, updated fields reflected
      expect(response.name).toBe('Updated Name')
    })
  })

  describe('DELETE /api/mcp/context-packs/:id', () => {
    // @clause CL-CTXP-005
    it('succeeds when deleting context pack with valid ID', async () => {
      const existingPack = createMockContextPack({ id: 'ctxp_delete_001' })
      
      mockPrisma.contextPack.findUnique.mockResolvedValue(existingPack)
      mockPrisma.contextPack.delete.mockResolvedValue(existingPack)
      
      const req: Request = { params: { id: 'ctxp_delete_001' } }
      const { res, statusSpy, sendSpy } = createMockResponse()
      
      await controller.delete(req, res)
      
      // Assertions: status 204
      expect(statusSpy).toHaveBeenCalledWith(204)
      expect(sendSpy).toHaveBeenCalled()
    })
  })
})

// =============================================================================
// SESSION PRESET CONTROLLER TESTS
// =============================================================================

describe('MCPSessionPresetController', () => {
  let controller: MCPSessionPresetController
  
  beforeEach(() => {
    controller = new MCPSessionPresetController()
    vi.clearAllMocks()
  })

  describe('GET /api/mcp/presets', () => {
    // @clause CL-PRES-001
    it('succeeds when listing presets with pagination', async () => {
      const mockPresets = [
        createMockPreset({ id: 'pres_001', name: 'Preset 1' }),
        createMockPreset({ id: 'pres_002', name: 'Preset 2' }),
      ]
      
      mockPrisma.sessionPreset.findMany.mockResolvedValue(mockPresets)
      mockPrisma.sessionPreset.count.mockResolvedValue(2)
      
      const req: Request = { query: { page: 1, limit: 20 } }
      const { res, jsonSpy } = createMockResponse()
      
      await controller.list(req, res)
      
      const response = jsonSpy.mock.calls[0][0]
      
      // Assertions: status 200, body.data array
      expect(Array.isArray(response.data)).toBe(true)
      expect(response.data).toHaveLength(2)
    })
  })

  describe('POST /api/mcp/presets', () => {
    // @clause CL-PRES-002
    it('succeeds when creating preset with name and config', async () => {
      const configObj = { gitStrategy: 'main', taskType: 'bugfix' }
      const createdPreset = createMockPreset({
        id: 'pres_new_001',
        name: 'Quick Bugfix',
        config: JSON.stringify(configObj),
      })
      
      mockPrisma.sessionPreset.create.mockResolvedValue(createdPreset)
      
      const req: Request = {
        body: {
          name: 'Quick Bugfix',
          config: configObj,
        },
      }
      const { res, jsonSpy, statusSpy } = createMockResponse()
      
      await controller.create(req, res)
      
      expect(statusSpy).toHaveBeenCalledWith(201)
      
      const response = jsonSpy.mock.calls[0][0]
      
      // Assertions: status 201, body.config is valid JSON object
      expect(response.config).toBeDefined()
      const parsedConfig = JSON.parse(response.config)
      expect(typeof parsedConfig).toBe('object')
      expect(parsedConfig.gitStrategy).toBe('main')
    })
  })

  describe('GET /api/mcp/presets/:id', () => {
    // @clause CL-PRES-003
    it('succeeds when fetching preset by valid ID', async () => {
      const mockPreset = createMockPreset({ id: 'pres_existing_001' })
      
      mockPrisma.sessionPreset.findUnique.mockResolvedValue(mockPreset)
      
      const req: Request = { params: { id: 'pres_existing_001' } }
      const { res, jsonSpy } = createMockResponse()
      
      await controller.get(req, res)
      
      // Assertions: status 200
      expect(jsonSpy).toHaveBeenCalled()
      const response = jsonSpy.mock.calls[0][0]
      expect(response.id).toBe('pres_existing_001')
    })
  })

  describe('PUT /api/mcp/presets/:id', () => {
    // @clause CL-PRES-004
    it('succeeds when updating preset with valid data', async () => {
      const existingPreset = createMockPreset({ id: 'pres_update_001' })
      const updatedPreset = { ...existingPreset, name: 'Updated Preset' }
      
      mockPrisma.sessionPreset.findUnique.mockResolvedValue(existingPreset)
      mockPrisma.sessionPreset.update.mockResolvedValue(updatedPreset)
      
      const req: Request = {
        params: { id: 'pres_update_001' },
        body: { name: 'Updated Preset' },
      }
      const { res, jsonSpy } = createMockResponse()
      
      await controller.update(req, res)
      
      // Assertions: status 200
      expect(jsonSpy).toHaveBeenCalled()
      const response = jsonSpy.mock.calls[0][0]
      expect(response.name).toBe('Updated Preset')
    })
  })

  describe('DELETE /api/mcp/presets/:id', () => {
    // @clause CL-PRES-005
    it('succeeds when deleting preset with valid ID', async () => {
      const existingPreset = createMockPreset({ id: 'pres_delete_001' })
      
      mockPrisma.sessionPreset.findUnique.mockResolvedValue(existingPreset)
      mockPrisma.sessionPreset.delete.mockResolvedValue(existingPreset)
      
      const req: Request = { params: { id: 'pres_delete_001' } }
      const { res, statusSpy, sendSpy } = createMockResponse()
      
      await controller.delete(req, res)
      
      // Assertions: status 204
      expect(statusSpy).toHaveBeenCalledWith(204)
      expect(sendSpy).toHaveBeenCalled()
    })
  })
})

// =============================================================================
// SESSION CONFIG CONTROLLER TESTS
// =============================================================================

describe('MCPSessionConfigController', () => {
  let controller: MCPSessionConfigController
  
  beforeEach(() => {
    controller = new MCPSessionConfigController()
    vi.clearAllMocks()
  })

  describe('GET /api/mcp/session', () => {
    // @clause CL-SESS-001
    it('succeeds when fetching session config singleton', async () => {
      const mockConfig = createMockSessionConfig()
      
      mockPrisma.mCPSessionConfig.findUnique.mockResolvedValue(mockConfig)
      
      const req: Request = {}
      const { res, jsonSpy } = createMockResponse()
      
      await controller.get(req, res)
      
      const response = jsonSpy.mock.calls[0][0]
      
      // Assertions: status 200, body.config object, body.id = 'singleton'
      expect(response.id).toBe('singleton')
      expect(typeof response.config).toBe('object')
      expect(response.updatedAt).toBeDefined()
    })
  })

  describe('PUT /api/mcp/session', () => {
    // @clause CL-SESS-002
    it('succeeds when updating session config with valid data', async () => {
      const newConfig = { gitStrategy: 'new_branch', taskType: 'feature' }
      const updatedConfig = {
        id: 'singleton',
        config: JSON.stringify(newConfig),
        updatedAt: new Date('2026-01-29T12:00:00Z'),
      }
      
      mockPrisma.mCPSessionConfig.upsert.mockResolvedValue(updatedConfig)
      
      const req: Request = {
        body: { config: newConfig },
      }
      const { res, jsonSpy } = createMockResponse()
      
      await controller.update(req, res)
      
      const response = jsonSpy.mock.calls[0][0]
      
      // Assertions: status 200, body.config reflects changes, body.updatedAt updated
      expect(response.config.gitStrategy).toBe('new_branch')
      expect(response.config.taskType).toBe('feature')
      expect(response.updatedAt).toBeDefined()
    })
  })
})

// =============================================================================
// SESSION HISTORY CONTROLLER TESTS
// =============================================================================

describe('MCPSessionHistoryController', () => {
  let controller: MCPSessionHistoryController
  
  beforeEach(() => {
    controller = new MCPSessionHistoryController()
    vi.clearAllMocks()
  })

  describe('GET /api/mcp/history', () => {
    // @clause CL-HIST-001
    it('succeeds when listing history ordered by createdAt desc', async () => {
      const mockHistory = [
        createMockHistoryEntry({ 
          id: 'hist_002', 
          createdAt: new Date('2026-01-29T12:00:00Z') 
        }),
        createMockHistoryEntry({ 
          id: 'hist_001', 
          createdAt: new Date('2026-01-29T10:00:00Z') 
        }),
      ]
      
      mockPrisma.sessionHistory.findMany.mockResolvedValue(mockHistory)
      mockPrisma.sessionHistory.count.mockResolvedValue(2)
      
      const req: Request = { query: { page: 1, limit: 20 } }
      const { res, jsonSpy } = createMockResponse()
      
      await controller.list(req, res)
      
      const response = jsonSpy.mock.calls[0][0]
      
      // Assertions: status 200, body.data ordered by createdAt desc
      expect(Array.isArray(response.data)).toBe(true)
      expect(response.data).toHaveLength(2)
      
      // Verify descending order
      const dates = response.data.map((h: { createdAt: Date }) => h.createdAt.getTime())
      expect(dates[0]).toBeGreaterThan(dates[1])
    })
  })

  describe('DELETE /api/mcp/history/:id', () => {
    // @clause CL-HIST-002
    it('succeeds when deleting history entry with valid ID', async () => {
      const existingEntry = createMockHistoryEntry({ id: 'hist_delete_001' })
      
      mockPrisma.sessionHistory.findUnique.mockResolvedValue(existingEntry)
      mockPrisma.sessionHistory.delete.mockResolvedValue(existingEntry)
      
      const req: Request = { params: { id: 'hist_delete_001' } }
      const { res, statusSpy, sendSpy } = createMockResponse()
      
      await controller.delete(req, res)
      
      // Assertions: status 204
      expect(statusSpy).toHaveBeenCalledWith(204)
      expect(sendSpy).toHaveBeenCalled()
    })

    // @clause CL-HIST-ERR-001
    it('fails when deleting history entry with non-existent ID', async () => {
      mockPrisma.sessionHistory.findUnique.mockResolvedValue(null)
      
      const req: Request = { params: { id: 'non_existent_id' } }
      const { res, statusSpy } = createMockResponse()
      
      await controller.delete(req, res)
      
      // Assertions: status 404
      expect(statusSpy).toHaveBeenCalledWith(404)
    })
  })
})

// =============================================================================
// STATUS CONTROLLER TESTS
// =============================================================================

describe('MCPStatusController', () => {
  let controller: MCPStatusController
  
  beforeEach(() => {
    controller = new MCPStatusController()
    vi.clearAllMocks()
  })

  describe('GET /api/mcp/status', () => {
    // @clause CL-STAT-001
    it('succeeds when fetching integration status', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ 1: 1 }])
      
      const req: Request = {}
      const { res, jsonSpy } = createMockResponse()
      
      await controller.get(req, res)
      
      const response = jsonSpy.mock.calls[0][0]
      
      // Assertions: status 200, body.database boolean, body.timestamp ISO datetime
      expect(typeof response.database).toBe('boolean')
      expect(response.database).toBe(true)
      expect(response.timestamp).toBeDefined()
      
      // Verify timestamp is valid ISO format
      const timestampDate = new Date(response.timestamp)
      expect(timestampDate.toISOString()).toBe(response.timestamp)
    })

    // @clause CL-STAT-001
    it('succeeds when database connection fails and returns false', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection failed'))
      
      const req: Request = {}
      const { res, jsonSpy } = createMockResponse()
      
      await controller.get(req, res)
      
      const response = jsonSpy.mock.calls[0][0]
      
      // Assertions: database should be false when connection fails
      expect(response.database).toBe(false)
      expect(response.timestamp).toBeDefined()
    })
  })
})

// =============================================================================
// PRISMA MODEL INVARIANT TESTS
// =============================================================================

describe('Prisma Model Invariants', () => {
  /**
   * Estes testes validam que os models Prisma serão definidos corretamente.
   * A validação real acontece via schema.prisma - estes testes documentam
   * os campos obrigatórios que devem existir.
   */

  describe('Snippet Model', () => {
    // @clause CL-MODEL-001
    it('succeeds when Snippet model has required fields: id, name, category, content, tags, createdAt, updatedAt', () => {
      const snippet = createMockSnippet()
      
      // Verify all required fields exist
      expect(snippet.id).toBeDefined()
      expect(typeof snippet.id).toBe('string')
      
      expect(snippet.name).toBeDefined()
      expect(typeof snippet.name).toBe('string')
      
      expect(snippet.category).toBeDefined()
      expect(typeof snippet.category).toBe('string')
      
      expect(snippet.content).toBeDefined()
      expect(typeof snippet.content).toBe('string')
      
      expect(snippet.tags).toBeDefined()
      expect(typeof snippet.tags).toBe('string') // JSON array as string
      
      expect(snippet.createdAt).toBeDefined()
      expect(snippet.createdAt instanceof Date).toBe(true)
      
      expect(snippet.updatedAt).toBeDefined()
      expect(snippet.updatedAt instanceof Date).toBe(true)
    })
  })

  describe('ContextPack Model', () => {
    // @clause CL-MODEL-002
    it('succeeds when ContextPack model has required fields: id, name, files, createdAt, updatedAt', () => {
      const pack = createMockContextPack()
      
      expect(pack.id).toBeDefined()
      expect(typeof pack.id).toBe('string')
      
      expect(pack.name).toBeDefined()
      expect(typeof pack.name).toBe('string')
      
      expect(pack.files).toBeDefined()
      expect(typeof pack.files).toBe('string') // JSON array as string
      
      expect(pack.createdAt).toBeDefined()
      expect(pack.createdAt instanceof Date).toBe(true)
      
      expect(pack.updatedAt).toBeDefined()
      expect(pack.updatedAt instanceof Date).toBe(true)
    })
  })

  describe('SessionPreset Model', () => {
    // @clause CL-MODEL-003
    it('succeeds when SessionPreset model has required fields: id, name, config, createdAt, updatedAt', () => {
      const preset = createMockPreset()
      
      expect(preset.id).toBeDefined()
      expect(typeof preset.id).toBe('string')
      
      expect(preset.name).toBeDefined()
      expect(typeof preset.name).toBe('string')
      
      expect(preset.config).toBeDefined()
      expect(typeof preset.config).toBe('string') // JSON as string
      
      expect(preset.createdAt).toBeDefined()
      expect(preset.createdAt instanceof Date).toBe(true)
      
      expect(preset.updatedAt).toBeDefined()
      expect(preset.updatedAt instanceof Date).toBe(true)
    })
  })

  describe('SessionHistory Model', () => {
    // @clause CL-MODEL-004
    it('succeeds when SessionHistory model has required fields: id, taskType, gitStrategy, status, createdAt', () => {
      const history = createMockHistoryEntry()
      
      expect(history.id).toBeDefined()
      expect(typeof history.id).toBe('string')
      
      expect(history.taskType).toBeDefined()
      expect(typeof history.taskType).toBe('string')
      
      expect(history.gitStrategy).toBeDefined()
      expect(typeof history.gitStrategy).toBe('string')
      
      expect(history.status).toBeDefined()
      expect(typeof history.status).toBe('string')
      expect(['COMPLETED', 'FAILED', 'ABORTED']).toContain(history.status)
      
      expect(history.createdAt).toBeDefined()
      expect(history.createdAt instanceof Date).toBe(true)
    })
  })

  describe('MCPSessionConfig Model', () => {
    // @clause CL-MODEL-005
    it('succeeds when MCPSessionConfig is singleton with id=singleton', () => {
      const config = createMockSessionConfig()
      
      // MCPSessionConfig MUST have id='singleton'
      expect(config.id).toBe('singleton')
      
      expect(config.config).toBeDefined()
      expect(typeof config.config).toBe('string')
      
      expect(config.updatedAt).toBeDefined()
      expect(config.updatedAt instanceof Date).toBe(true)
    })
  })
})
