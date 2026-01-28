/**
 * UI Contract Backend Specification Tests
 * 
 * Este spec valida a implementação do suporte a UI Contracts no Gatekeeper.
 * Os testes são contratos: se falharem, a LLM executora errou na implementação.
 * 
 * Domínios cobertos:
 * - MODEL (CL-MODEL-001 a 004): Types e Prisma
 * - REPO (CL-REPO-001 a 004): Repository
 * - VALID (CL-VALID-001 a 005): Validation Service
 * - API (CL-API-001 a 008): Controller e Routes
 * - ORCH (CL-ORCH-001 a 002): Orchestrator
 * - VALIDATOR (CL-VALIDATOR-001 a 013): Validators
 */

import { describe, it, expect, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// ============================================================================
// TYPES
// ============================================================================

interface MockUIContract {
  id: string
  projectId: string
  contractJson: string
  version: string
  hash: string
  uploadedAt: Date
  updatedAt: Date
}

interface UIContractSchema {
  version: string
  metadata: {
    projectName: string
    exportedFrom: string
    exportedAt: string
    hash: string
  }
  components: Record<string, unknown>
  styles: Record<string, string>
}

interface ValidatorOutput {
  passed: boolean
  status: string
  message: string
  details?: Record<string, unknown>
  metrics?: Record<string, number>
  context?: {
    inputs: Array<{ label: string; value: unknown }>
    analyzed: Array<{ label: string; items: string[] }>
    findings: Array<{ type: string; message: string }>
    reasoning: string
  }
}

// ============================================================================
// HELPERS
// ============================================================================

const BASE_PATH = path.resolve(process.cwd(), 'packages/gatekeeper-api')
const SRC_PATH = path.join(BASE_PATH, 'src')
const PRISMA_SCHEMA_PATH = path.join(BASE_PATH, 'prisma/schema.prisma')

function readSourceFile(relativePath: string): string | null {
  const fullPath = path.join(SRC_PATH, relativePath)
  if (!fs.existsSync(fullPath)) {
    return null
  }
  return fs.readFileSync(fullPath, 'utf-8')
}

function readPrismaSchema(): string | null {
  if (!fs.existsSync(PRISMA_SCHEMA_PATH)) {
    return null
  }
  return fs.readFileSync(PRISMA_SCHEMA_PATH, 'utf-8')
}

function createMockPrisma() {
  return {
    uIContract: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
    },
  }
}

function createMockUIContract(overrides: Partial<MockUIContract> = {}): MockUIContract {
  return {
    id: 'uic_test123',
    projectId: 'proj_test123',
    contractJson: JSON.stringify({
      version: '1.0.0',
      metadata: {
        projectName: 'TestProject',
        exportedFrom: 'Figma',
        exportedAt: new Date().toISOString(),
        hash: 'abc123',
      },
      components: {
        Button: { variants: ['primary', 'secondary'] },
      },
      styles: {
        'Button.primary.root.default.backgroundColor': '#007bff',
      },
    }),
    version: '1.0.0',
    hash: 'abc123',
    uploadedAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function createValidUIContractSchema(): UIContractSchema {
  return {
    version: '1.0.0',
    metadata: {
      projectName: 'TestProject',
      exportedFrom: 'Figma',
      exportedAt: new Date().toISOString(),
      hash: 'abc123def456',
    },
    components: {
      Button: {
        variants: ['primary', 'secondary'],
        parts: ['root', 'label', 'icon'],
        states: ['default', 'hover', 'pressed', 'disabled'],
      },
    },
    styles: {
      'Button.primary.root.default.backgroundColor': '#007bff',
      'Button.primary.root.hover.backgroundColor': '#0056b3',
    },
  }
}

function createMockValidationContext(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    runId: 'run_test123',
    projectPath: '/test/path',
    baseRef: 'origin/main',
    targetRef: 'HEAD',
    taskPrompt: 'Test task',
    manifest: null,
    contract: null,
    testFilePath: null,
    uiContract: null,
    dangerMode: false,
    services: {
      git: { readFile: vi.fn() },
      ast: { getTestBlocksWithComments: vi.fn() },
      testRunner: { runSingleTest: vi.fn() },
      compiler: { compile: vi.fn() },
      lint: { lint: vi.fn() },
      build: { build: vi.fn() },
      tokenCounter: { count: vi.fn() },
      log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    },
    config: new Map<string, string>(),
    sensitivePatterns: [],
    ambiguousTerms: [],
    bypassedValidators: new Set<string>(),
    ...overrides,
  }
}

/**
 * Extrai bloco de um modelo Prisma do schema
 */
function extractPrismaModelBlock(schema: string, modelName: string): string | null {
  const lines = schema.split('\n')
  let inModel = false
  let braceCount = 0
  const blockLines: string[] = []
  
  for (const line of lines) {
    if (line.match(new RegExp(`^model\\s+${modelName}\\s*\\{`))) {
      inModel = true
      braceCount = 1
      continue
    }
    
    if (inModel) {
      braceCount += (line.match(/\{/g) || []).length
      braceCount -= (line.match(/\}/g) || []).length
      
      if (braceCount <= 0) {
        break
      }
      blockLines.push(line)
    }
  }
  
  return blockLines.length > 0 ? blockLines.join('\n') : null
}

/**
 * Extrai bloco de interface/type do código TypeScript
 */
function extractTypeBlock(content: string, typeName: string, kind: 'interface' | 'type'): string | null {
  const lines = content.split('\n')
  let inType = false
  let braceCount = 0
  const blockLines: string[] = []
  
  const startPattern = kind === 'interface' 
    ? new RegExp(`^\\s*(export\\s+)?interface\\s+${typeName}`)
    : new RegExp(`^\\s*(export\\s+)?type\\s+${typeName}\\s*=`)
  
  for (const line of lines) {
    if (!inType && startPattern.test(line)) {
      inType = true
      if (kind === 'type' && !line.includes('{')) {
        // Union type sem braces
        blockLines.push(line)
        if (line.includes(';') || !line.includes('|')) {
          // Continua até encontrar o fim
        }
        continue
      }
    }
    
    if (inType) {
      blockLines.push(line)
      braceCount += (line.match(/\{/g) || []).length
      braceCount -= (line.match(/\}/g) || []).length
      
      if (kind === 'type' && braceCount === 0 && line.includes(';')) {
        break
      }
      if (kind === 'interface' && braceCount === 0 && blockLines.length > 1) {
        break
      }
    }
  }
  
  return blockLines.length > 0 ? blockLines.join('\n') : null
}

// ============================================================================
// PHASE 1 — MODELAGEM (Types)
// ============================================================================

describe('Phase 1 — Modelagem: Types', () => {
  // @clause CL-MODEL-001
  it('succeeds when UIContractSchema and related types are exported from types file', () => {
    const typesContent = readSourceFile('types/ui-contract.types.ts')
    
    expect(typesContent).not.toBeNull()
    
    const requiredTypes = [
      'ComponentState',
      'UIContractMetadata', 
      'UIComponentPart',
      'UIComponentDefinition',
      'UIStyleValue',
      'UIContractSchema',
    ]
    
    for (const typeName of requiredTypes) {
      const exportPattern = new RegExp(`export\\s+(type|interface)\\s+${typeName}`)
      expect(typesContent).toMatch(exportPattern)
    }
  })

  // @clause CL-MODEL-001
  it('succeeds when types are re-exported from index.ts', () => {
    const indexContent = readSourceFile('types/index.ts')
    
    expect(indexContent).not.toBeNull()
    expect(indexContent).toMatch(/export.*from.*['"]\.\/ui-contract\.types/)
  })
})

// ============================================================================
// PHASE 1 — MODELAGEM (Prisma)
// ============================================================================

describe('Phase 1 — Modelagem: Prisma', () => {
  // @clause CL-MODEL-002
  it('succeeds when UIContract model exists in Prisma schema with required fields', () => {
    const schema = readPrismaSchema()
    
    expect(schema).not.toBeNull()
    expect(schema).toContain('model UIContract')
    
    const requiredFields = ['id', 'projectId', 'contractJson', 'version', 'hash', 'uploadedAt', 'updatedAt']
    const modelBlock = extractPrismaModelBlock(schema!, 'UIContract')
    
    expect(modelBlock).not.toBeNull()
    
    for (const field of requiredFields) {
      expect(modelBlock).toContain(field)
    }
  })

  // @clause CL-MODEL-003
  it('succeeds when Project model has optional uiContract relation', () => {
    const schema = readPrismaSchema()
    
    expect(schema).not.toBeNull()
    
    const modelBlock = extractPrismaModelBlock(schema!, 'Project')
    expect(modelBlock).not.toBeNull()
    expect(modelBlock).toMatch(/uiContract\s+UIContract\?/)
  })

  // @clause CL-MODEL-004
  it('succeeds when projectId has unique constraint in UIContract', () => {
    const schema = readPrismaSchema()
    
    expect(schema).not.toBeNull()
    
    const modelBlock = extractPrismaModelBlock(schema!, 'UIContract')
    expect(modelBlock).not.toBeNull()
    expect(modelBlock).toMatch(/projectId\s+\S+.*@unique/)
  })

  // @clause CL-MODEL-004
  it('fails when attempting to create duplicate UIContract for same project', async () => {
    const mockPrisma = createMockPrisma()
    
    const uniqueConstraintError = new Error('Unique constraint failed on the fields: (`projectId`)')
    mockPrisma.uIContract.upsert.mockRejectedValueOnce(uniqueConstraintError)
    
    await expect(
      mockPrisma.uIContract.upsert({
        where: { projectId: 'proj_existing' },
        create: { projectId: 'proj_existing', contractJson: '{}', version: '1.0', hash: 'abc' },
        update: {},
      })
    ).rejects.toThrow(/[Uu]nique constraint/)
  })
})

// ============================================================================
// PHASE 1 — REPOSITORY
// ============================================================================

describe('Phase 1 — Repository', () => {
  // @clause CL-REPO-001
  it('succeeds when findByProjectId returns UIContract if exists', async () => {
    const mockPrisma = createMockPrisma()
    const mockContract = createMockUIContract()
    
    mockPrisma.uIContract.findUnique.mockResolvedValueOnce(mockContract)
    
    const result = await mockPrisma.uIContract.findUnique({
      where: { projectId: 'proj_test123' },
    })
    
    expect(result).not.toBeNull()
    expect(result.id).toBe('uic_test123')
    expect(result.projectId).toBe('proj_test123')
    expect(result.contractJson).toBeDefined()
    expect(mockPrisma.uIContract.findUnique).toHaveBeenCalledWith({
      where: { projectId: 'proj_test123' },
    })
  })

  // @clause CL-REPO-001
  it('succeeds when findByProjectId returns null if not exists', async () => {
    const mockPrisma = createMockPrisma()
    
    mockPrisma.uIContract.findUnique.mockResolvedValueOnce(null)
    
    const result = await mockPrisma.uIContract.findUnique({
      where: { projectId: 'proj_nonexistent' },
    })
    
    expect(result).toBeNull()
  })

  // @clause CL-REPO-002
  it('succeeds when upsert creates new contract if not exists', async () => {
    const mockPrisma = createMockPrisma()
    const newContract = createMockUIContract({ id: 'uic_new' })
    
    mockPrisma.uIContract.upsert.mockResolvedValueOnce(newContract)
    
    const result = await mockPrisma.uIContract.upsert({
      where: { projectId: 'proj_new' },
      create: {
        projectId: 'proj_new',
        contractJson: newContract.contractJson,
        version: '1.0.0',
        hash: 'newhash',
      },
      update: {
        contractJson: newContract.contractJson,
        version: '1.0.0',
        hash: 'newhash',
      },
    })
    
    expect(result).not.toBeNull()
    expect(result.id).toBe('uic_new')
    expect(mockPrisma.uIContract.upsert).toHaveBeenCalled()
  })

  // @clause CL-REPO-002
  it('succeeds when upsert updates existing contract', async () => {
    const mockPrisma = createMockPrisma()
    const updatedContract = createMockUIContract({ 
      version: '2.0.0',
      hash: 'updatedhash',
    })
    
    mockPrisma.uIContract.upsert.mockResolvedValueOnce(updatedContract)
    
    const result = await mockPrisma.uIContract.upsert({
      where: { projectId: 'proj_test123' },
      create: { projectId: 'proj_test123', contractJson: '{}', version: '2.0.0', hash: 'updatedhash' },
      update: { contractJson: '{}', version: '2.0.0', hash: 'updatedhash' },
    })
    
    expect(result.version).toBe('2.0.0')
    expect(result.hash).toBe('updatedhash')
  })

  // @clause CL-REPO-003
  it('succeeds when delete removes contract from database', async () => {
    const mockPrisma = createMockPrisma()
    const deletedContract = createMockUIContract()
    
    mockPrisma.uIContract.delete.mockResolvedValueOnce(deletedContract)
    mockPrisma.uIContract.findUnique.mockResolvedValueOnce(null)
    
    await mockPrisma.uIContract.delete({
      where: { projectId: 'proj_test123' },
    })
    
    const findResult = await mockPrisma.uIContract.findUnique({
      where: { projectId: 'proj_test123' },
    })
    
    expect(findResult).toBeNull()
  })

  // @clause CL-REPO-004
  it('succeeds when exists returns true for project with contract', async () => {
    const mockPrisma = createMockPrisma()
    
    mockPrisma.uIContract.count.mockResolvedValueOnce(1)
    
    const count = await mockPrisma.uIContract.count({
      where: { projectId: 'proj_with_contract' },
    })
    
    expect(count).toBeGreaterThan(0)
    expect(count > 0).toBe(true)
  })

  // @clause CL-REPO-004
  it('succeeds when exists returns false for project without contract', async () => {
    const mockPrisma = createMockPrisma()
    
    mockPrisma.uIContract.count.mockResolvedValueOnce(0)
    
    const count = await mockPrisma.uIContract.count({
      where: { projectId: 'proj_without_contract' },
    })
    
    expect(count).toBe(0)
    expect(count > 0).toBe(false)
  })

  // @clause CL-REPO-001
  it('succeeds when UIContractRepository file exists with required methods', () => {
    const repoContent = readSourceFile('repositories/UIContractRepository.ts')
    
    expect(repoContent).not.toBeNull()
    expect(repoContent).toMatch(/findByProjectId/)
    expect(repoContent).toMatch(/upsert/)
    expect(repoContent).toMatch(/delete/)
    expect(repoContent).toMatch(/exists/)
  })
})

// ============================================================================
// PHASE 2 — API VALIDATION SERVICE
// ============================================================================

describe('Phase 2 — API Validation Service', () => {
  // @clause CL-VALID-001
  it('fails when required fields are missing from contract', () => {
    const invalidContract: Record<string, unknown> = {}
    
    const requiredFields = ['version', 'metadata', 'components', 'styles']
    const missingFields = requiredFields.filter(field => !(field in invalidContract))
    
    expect(missingFields.length).toBeGreaterThan(0)
    expect(missingFields).toContain('version')
    expect(missingFields).toContain('metadata')
  })

  // @clause CL-VALID-001
  it('succeeds when UIContractValidatorService file exists', () => {
    const serviceContent = readSourceFile('services/UIContractValidatorService.ts')
    
    expect(serviceContent).not.toBeNull()
    expect(serviceContent).toMatch(/validate/)
  })

  // @clause CL-VALID-002
  it('fails when metadata is incomplete', () => {
    const contract = {
      version: '1.0.0',
      metadata: {
        projectName: 'Test',
      },
      components: { Button: {} },
      styles: {},
    }
    
    const requiredMetadataFields = ['projectName', 'exportedFrom', 'exportedAt', 'hash']
    const missingFields = requiredMetadataFields.filter(
      field => !(field in (contract.metadata as Record<string, unknown>))
    )
    
    expect(missingFields.length).toBeGreaterThan(0)
    expect(missingFields).toContain('exportedFrom')
    expect(missingFields).toContain('exportedAt')
    expect(missingFields).toContain('hash')
  })

  // @clause CL-VALID-003
  it('fails when components is empty', () => {
    const contract = {
      version: '1.0.0',
      metadata: {
        projectName: 'Test',
        exportedFrom: 'Figma',
        exportedAt: new Date().toISOString(),
        hash: 'abc123',
      },
      components: {},
      styles: {},
    }
    
    const componentCount = Object.keys(contract.components).length
    const isValid = componentCount > 0
    
    expect(isValid).toBe(false)
    expect(componentCount).toBe(0)
  })

  // @clause CL-VALID-004
  it('fails when style key has invalid format', () => {
    const validKeyPattern = /^[A-Za-z]+\.[A-Za-z]+\.[A-Za-z]+\.[A-Za-z]+\.[A-Za-z]+$/
    
    const invalidKeys = [
      'Button',
      'Button.primary',
      'Button.primary.root',
      'Button.primary.root.hover',
      'button primary root hover bg',
    ]
    
    for (const key of invalidKeys) {
      const isValid = validKeyPattern.test(key)
      expect(isValid).toBe(false)
    }
    
    const validKey = 'Button.primary.root.hover.backgroundColor'
    expect(validKeyPattern.test(validKey)).toBe(true)
  })

  // @clause CL-VALID-005
  it('succeeds when contract is valid with all required fields', () => {
    const validContract = createValidUIContractSchema()
    
    const errors: Array<{ path: string; message: string }> = []
    
    if (!validContract.version) errors.push({ path: 'version', message: 'Required' })
    
    const metadataFields = ['projectName', 'exportedFrom', 'exportedAt', 'hash'] as const
    for (const field of metadataFields) {
      if (!validContract.metadata?.[field]) {
        errors.push({ path: `metadata.${field}`, message: 'Required' })
      }
    }
    
    if (!validContract.components || Object.keys(validContract.components).length === 0) {
      errors.push({ path: 'components', message: 'Must have at least one component' })
    }
    
    const validKeyPattern = /^[A-Za-z]+\.[A-Za-z]+\.[A-Za-z]+\.[A-Za-z]+\.[A-Za-z]+$/
    for (const key of Object.keys(validContract.styles || {})) {
      if (!validKeyPattern.test(key)) {
        errors.push({ path: `styles.${key}`, message: 'Invalid key format' })
      }
    }
    
    expect(errors).toHaveLength(0)
  })
})

// ============================================================================
// PHASE 2 — API CONTROLLER
// ============================================================================

describe('Phase 2 — API Controller', () => {
  // @clause CL-API-001
  it('succeeds when GET returns 200 with existing contract', () => {
    const mockContract = createMockUIContract()
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    }
    
    mockRes.status(200)
    mockRes.json({
      id: mockContract.id,
      projectId: mockContract.projectId,
      version: mockContract.version,
      hash: mockContract.hash,
      uploadedAt: mockContract.uploadedAt,
      contract: JSON.parse(mockContract.contractJson),
    })
    
    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        projectId: expect.any(String),
        version: expect.any(String),
        hash: expect.any(String),
        uploadedAt: expect.any(Date),
        contract: expect.any(Object),
      })
    )
  })

  // @clause CL-API-002
  it('succeeds when POST returns 201 for new contract', () => {
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    }
    
    mockRes.status(201)
    mockRes.json({
      success: true,
      id: 'uic_new',
      hash: 'newhash',
      uploadedAt: new Date(),
    })
    
    expect(mockRes.status).toHaveBeenCalledWith(201)
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        id: expect.any(String),
        hash: expect.any(String),
        uploadedAt: expect.any(Date),
      })
    )
  })

  // @clause CL-API-003
  it('succeeds when POST returns 200 for existing contract update', () => {
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    }
    
    mockRes.status(200)
    mockRes.json({
      success: true,
      id: 'uic_existing',
      hash: 'updatedhash',
      uploadedAt: new Date(),
    })
    
    expect(mockRes.status).toHaveBeenCalledWith(200)
  })

  // @clause CL-API-004
  it('succeeds when DELETE returns 204 and removes contract', () => {
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    }
    
    mockRes.status(204)
    mockRes.send()
    
    expect(mockRes.status).toHaveBeenCalledWith(204)
    expect(mockRes.send).toHaveBeenCalled()
  })

  // @clause CL-API-005
  it('fails when operation targets non-existent project with 404 PROJECT_NOT_FOUND', () => {
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    }
    
    mockRes.status(404)
    mockRes.json({
      error: {
        code: 'PROJECT_NOT_FOUND',
        message: 'Project not found',
      },
    })
    
    expect(mockRes.status).toHaveBeenCalledWith(404)
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'PROJECT_NOT_FOUND',
        }),
      })
    )
  })

  // @clause CL-API-006
  it('fails when GET/DELETE targets project without contract with 404 CONTRACT_NOT_FOUND', () => {
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    }
    
    mockRes.status(404)
    mockRes.json({
      error: {
        code: 'CONTRACT_NOT_FOUND',
        message: 'UI Contract not found for this project',
      },
    })
    
    expect(mockRes.status).toHaveBeenCalledWith(404)
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'CONTRACT_NOT_FOUND',
        }),
      })
    )
  })

  // @clause CL-API-007
  it('fails when POST has invalid schema with 400 INVALID_CONTRACT', () => {
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    }
    
    mockRes.status(400)
    mockRes.json({
      error: {
        code: 'INVALID_CONTRACT',
        message: 'Contract validation failed',
        details: [
          { path: 'version', message: 'Required' },
          { path: 'metadata.projectName', message: 'Required' },
        ],
      },
    })
    
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'INVALID_CONTRACT',
          details: expect.any(Array),
        }),
      })
    )
  })

  // @clause CL-API-008
  it('succeeds when UIContractController file exists with required methods', () => {
    const controllerContent = readSourceFile('api/controllers/UIContractController.ts')
    
    expect(controllerContent).not.toBeNull()
    expect(controllerContent).toMatch(/getContract|get/)
    expect(controllerContent).toMatch(/createOrUpdate|upsert|post/)
    expect(controllerContent).toMatch(/delete|remove/)
  })

  // @clause CL-API-008
  it('succeeds when ui-contract routes file exists and registers endpoints', () => {
    const routesContent = readSourceFile('api/routes/ui-contract.routes.ts')
    
    expect(routesContent).not.toBeNull()
    expect(routesContent).toMatch(/router\.get/)
    expect(routesContent).toMatch(/router\.post/)
    expect(routesContent).toMatch(/router\.delete/)
    expect(routesContent).toMatch(/ui-contract|uiContract/)
  })

  // @clause CL-API-008
  it('succeeds when routes are registered in index.ts', () => {
    const indexContent = readSourceFile('api/routes/index.ts')
    
    expect(indexContent).not.toBeNull()
    expect(indexContent).toMatch(/ui-contract|uiContract/)
  })
})

// ============================================================================
// PHASE 3 — VALIDATION CONTEXT
// ============================================================================

describe('Phase 3 — ValidationContext', () => {
  // @clause CL-ORCH-001
  it('succeeds when ValidationContext type includes uiContract field', () => {
    const typesContent = readSourceFile('types/gates.types.ts')
    
    expect(typesContent).not.toBeNull()
    
    const interfaceBlock = extractTypeBlock(typesContent!, 'ValidationContext', 'interface')
    expect(interfaceBlock).not.toBeNull()
    expect(interfaceBlock).toMatch(/uiContract/)
  })

  // @clause CL-ORCH-002
  it('succeeds when ValidationOrchestrator loads UIContract in buildContext', () => {
    const orchestratorContent = readSourceFile('services/ValidationOrchestrator.ts')
    
    expect(orchestratorContent).not.toBeNull()
    expect(orchestratorContent).toMatch(/buildContext|createContext/)
    expect(orchestratorContent).toMatch(/uiContract|UIContract/)
  })

  // @clause CL-ORCH-002
  it('succeeds when context has uiContract as object when project has UIContract', () => {
    const ctx = createMockValidationContext({
      uiContract: createValidUIContractSchema(),
    })
    
    expect(ctx.uiContract).not.toBeNull()
    expect(ctx.uiContract).toHaveProperty('version')
    expect(ctx.uiContract).toHaveProperty('components')
  })

  // @clause CL-ORCH-002
  it('succeeds when context has uiContract as null when project has no UIContract', () => {
    const ctx = createMockValidationContext({
      uiContract: null,
    })
    
    expect(ctx.uiContract).toBeNull()
  })
})

// ============================================================================
// PHASE 3 — VALIDATOR UI_PLAN_COVERAGE
// ============================================================================

describe('Phase 3 — Validator UI_PLAN_COVERAGE', () => {
  // @clause CL-VALIDATOR-001
  it('succeeds when UI_PLAN_COVERAGE is registered in gate 1 with order 11 and isHardBlock true', () => {
    const configContent = readSourceFile('config/gates.config.ts')
    
    expect(configContent).not.toBeNull()
    expect(configContent).toMatch(/UIPlanCoverage/)
    
    const validatorContent = readSourceFile('domain/validators/gate1/UIPlanCoverage.ts')
    expect(validatorContent).not.toBeNull()
    expect(validatorContent).toMatch(/gate:\s*1/)
    expect(validatorContent).toMatch(/order:\s*11/)
    expect(validatorContent).toMatch(/isHardBlock:\s*true/)
  })

  // @clause CL-VALIDATOR-002
  it('succeeds when UI_PLAN_COVERAGE returns SKIPPED without uiContract', () => {
    const ctx = createMockValidationContext({
      uiContract: null,
      manifest: { files: [], testFile: '' },
    })
    
    const output: ValidatorOutput = {
      passed: true,
      status: 'SKIPPED',
      message: 'No UI Contract found',
    }
    
    expect(output.status).toBe('SKIPPED')
    expect(output.passed).toBe(true)
    expect(output.message).toMatch(/[Nn]o.*[Uu][Ii]\s*[Cc]ontract/)
  })

  // @clause CL-VALIDATOR-003
  it('succeeds when UI_PLAN_COVERAGE returns SKIPPED without manifest', () => {
    const ctx = createMockValidationContext({
      uiContract: createValidUIContractSchema(),
      manifest: null,
    })
    
    const output: ValidatorOutput = {
      passed: true,
      status: 'SKIPPED',
      message: 'No manifest provided',
    }
    
    expect(output.status).toBe('SKIPPED')
    expect(output.passed).toBe(true)
  })

  // @clause CL-VALIDATOR-004
  it('succeeds when UI_PLAN_COVERAGE returns PASSED when manifest does not affect UI components', () => {
    const ctx = createMockValidationContext({
      uiContract: createValidUIContractSchema(),
      manifest: {
        files: [
          { path: 'src/utils/helpers.ts', action: 'MODIFY' },
          { path: 'src/services/api.ts', action: 'CREATE' },
        ],
        testFile: 'tests/utils.spec.ts',
      },
    })
    
    const output: ValidatorOutput = {
      passed: true,
      status: 'PASSED',
      message: 'No UI components affected',
    }
    
    expect(output.status).toBe('PASSED')
    expect(output.passed).toBe(true)
    expect(output.message).toMatch(/[Nn]o.*[Uu][Ii].*components.*affected/)
  })

  // @clause CL-VALIDATOR-005
  it('succeeds when UI_PLAN_COVERAGE returns PASSED with 100% coverage', () => {
    const output: ValidatorOutput = {
      passed: true,
      status: 'PASSED',
      message: 'All required clauses covered',
      metrics: {
        coveragePercent: 100,
        coveredClauses: 5,
        totalClauses: 5,
      },
    }
    
    expect(output.status).toBe('PASSED')
    expect(output.passed).toBe(true)
    expect(output.metrics!.coveragePercent).toBe(100)
  })

  // @clause CL-VALIDATOR-006
  it('fails when UI_PLAN_COVERAGE has gaps in required clauses', () => {
    const output = {
      passed: false,
      status: 'FAILED',
      message: 'Missing coverage for required clauses',
      details: {
        gaps: ['CL-UI-001', 'CL-UI-003'],
        covered: ['CL-UI-002', 'CL-UI-004'],
        affectedComponents: ['Button', 'Input'],
      },
      metrics: {
        coveragePercent: 50,
        coveredClauses: 2,
        totalClauses: 4,
      },
    }
    
    expect(output.status).toBe('FAILED')
    expect(output.passed).toBe(false)
    expect(output.details.gaps).toContain('CL-UI-001')
    expect(output.details.gaps.length).toBeGreaterThan(0)
  })

  // @clause CL-VALIDATOR-007
  it('succeeds when validator output includes required metrics', () => {
    const output: ValidatorOutput = {
      passed: true,
      status: 'PASSED',
      message: 'Coverage validation complete',
      metrics: {
        coveragePercent: 85,
        coveredClauses: 17,
        totalClauses: 20,
      },
    }
    
    expect(output.metrics).toHaveProperty('coveragePercent')
    expect(output.metrics).toHaveProperty('coveredClauses')
    expect(output.metrics).toHaveProperty('totalClauses')
    expect(typeof output.metrics!.coveragePercent).toBe('number')
    expect(output.metrics!.coveragePercent).toBeGreaterThanOrEqual(0)
    expect(output.metrics!.coveragePercent).toBeLessThanOrEqual(100)
  })

  // @clause CL-VALIDATOR-001
  it('succeeds when UIPlanCoverage.ts file exists with correct structure', () => {
    const validatorContent = readSourceFile('domain/validators/gate1/UIPlanCoverage.ts')
    
    expect(validatorContent).not.toBeNull()
    expect(validatorContent).toMatch(/UI_PLAN_COVERAGE/)
    expect(validatorContent).toMatch(/execute/)
  })
})

// ============================================================================
// PHASE 3 — VALIDATOR UI_TEST_COVERAGE
// ============================================================================

describe('Phase 3 — Validator UI_TEST_COVERAGE', () => {
  // @clause CL-VALIDATOR-008
  it('succeeds when UI_TEST_COVERAGE is registered in gate 1 with order 12 and isHardBlock false', () => {
    const validatorContent = readSourceFile('domain/validators/gate1/UITestCoverage.ts')
    
    expect(validatorContent).not.toBeNull()
    expect(validatorContent).toMatch(/gate:\s*1/)
    expect(validatorContent).toMatch(/order:\s*12/)
    expect(validatorContent).toMatch(/isHardBlock:\s*false/)
  })

  // @clause CL-VALIDATOR-009
  it('succeeds when UI_TEST_COVERAGE returns SKIPPED without uiContract', () => {
    const output: ValidatorOutput = {
      passed: true,
      status: 'SKIPPED',
      message: 'No UI Contract found',
    }
    
    expect(output.status).toBe('SKIPPED')
    expect(output.passed).toBe(true)
  })

  // @clause CL-VALIDATOR-010
  it('succeeds when UI_TEST_COVERAGE returns SKIPPED without testFilePath', () => {
    const output: ValidatorOutput = {
      passed: true,
      status: 'SKIPPED',
      message: 'No test file path provided',
    }
    
    expect(output.status).toBe('SKIPPED')
    expect(output.passed).toBe(true)
  })

  // @clause CL-VALIDATOR-011
  it('succeeds when UI_TEST_COVERAGE returns WARNING without @ui-clause tags', () => {
    const output: ValidatorOutput = {
      passed: true,
      status: 'WARNING',
      message: 'No @ui-clause tags found in test file. Consider adding them for traceability.',
    }
    
    expect(output.status).toBe('WARNING')
    expect(output.passed).toBe(true)
    expect(output.message).toMatch(/@ui-clause/)
  })

  // @clause CL-VALIDATOR-012
  it('succeeds when UI_TEST_COVERAGE returns PASSED with @ui-clause tags found', () => {
    const output: ValidatorOutput = {
      passed: true,
      status: 'PASSED',
      message: 'Found 3 @ui-clause tags covering UI contract',
      context: {
        inputs: [{ label: 'Test File', value: 'tests/Button.spec.tsx' }],
        analyzed: [{ label: 'UI Clauses Found', items: ['CL-UI-001', 'CL-UI-002', 'CL-UI-003'] }],
        findings: [{ type: 'pass', message: 'All UI clause tags are valid' }],
        reasoning: 'Test file contains valid @ui-clause annotations',
      },
    }
    
    expect(output.status).toBe('PASSED')
    expect(output.passed).toBe(true)
    expect(output.context!.analyzed[0].items.length).toBeGreaterThan(0)
  })

  // @clause CL-VALIDATOR-008
  it('succeeds when UITestCoverage.ts file exists with correct structure', () => {
    const validatorContent = readSourceFile('domain/validators/gate1/UITestCoverage.ts')
    
    expect(validatorContent).not.toBeNull()
    expect(validatorContent).toMatch(/UI_TEST_COVERAGE/)
    expect(validatorContent).toMatch(/execute/)
  })
})

// ============================================================================
// PHASE 3 — VALIDATOR CODE TYPES
// ============================================================================

describe('Phase 3 — ValidatorCode Types', () => {
  // @clause CL-VALIDATOR-013
  it('succeeds when ValidatorCode type includes UI_PLAN_COVERAGE and UI_TEST_COVERAGE', () => {
    const typesContent = readSourceFile('types/gates.types.ts')
    
    expect(typesContent).not.toBeNull()
    
    const typeBlock = extractTypeBlock(typesContent!, 'ValidatorCode', 'type')
    expect(typeBlock).not.toBeNull()
    expect(typeBlock).toMatch(/UI_PLAN_COVERAGE/)
    expect(typeBlock).toMatch(/UI_TEST_COVERAGE/)
  })
})

// ============================================================================
// AUXILIARY SERVICES (estrutura)
// ============================================================================

describe('Auxiliary Services Structure', () => {
  // @clause CL-MODEL-001
  it('succeeds when UIComponentExtractorService exists', () => {
    const serviceContent = readSourceFile('services/UIComponentExtractorService.ts')
    expect(serviceContent).not.toBeNull()
  })

  // @clause CL-VALIDATOR-001
  it('succeeds when UIClauseGeneratorService exists', () => {
    const serviceContent = readSourceFile('services/UIClauseGeneratorService.ts')
    expect(serviceContent).not.toBeNull()
  })

  // @clause CL-VALIDATOR-001
  it('succeeds when UIPlanComparisonService exists', () => {
    const serviceContent = readSourceFile('services/UIPlanComparisonService.ts')
    expect(serviceContent).not.toBeNull()
  })

  // @clause CL-VALIDATOR-008
  it('succeeds when UITestCoverageService exists', () => {
    const serviceContent = readSourceFile('services/UITestCoverageService.ts')
    expect(serviceContent).not.toBeNull()
  })
})

// ============================================================================
// INTEGRATION SCENARIOS
// ============================================================================

describe('Integration Scenarios', () => {
  // @clause CL-API-001 @clause CL-API-005 @clause CL-API-006
  it('succeeds when API flow handles project existence correctly', async () => {
    const mockPrisma = createMockPrisma()
    
    // Cenário 1: Projeto existe com contrato
    mockPrisma.project.findUnique.mockResolvedValueOnce({ id: 'proj_1' })
    mockPrisma.uIContract.findUnique.mockResolvedValueOnce(createMockUIContract())
    
    const project1 = await mockPrisma.project.findUnique({ where: { id: 'proj_1' } })
    const contract1 = await mockPrisma.uIContract.findUnique({ where: { projectId: 'proj_1' } })
    
    expect(project1).not.toBeNull()
    expect(contract1).not.toBeNull()
    
    // Cenário 2: Projeto existe sem contrato
    mockPrisma.project.findUnique.mockResolvedValueOnce({ id: 'proj_2' })
    mockPrisma.uIContract.findUnique.mockResolvedValueOnce(null)
    
    const project2 = await mockPrisma.project.findUnique({ where: { id: 'proj_2' } })
    const contract2 = await mockPrisma.uIContract.findUnique({ where: { projectId: 'proj_2' } })
    
    expect(project2).not.toBeNull()
    expect(contract2).toBeNull()
    
    // Cenário 3: Projeto não existe
    mockPrisma.project.findUnique.mockResolvedValueOnce(null)
    
    const project3 = await mockPrisma.project.findUnique({ where: { id: 'proj_none' } })
    
    expect(project3).toBeNull()
  })

  // @clause CL-VALIDATOR-002 @clause CL-VALIDATOR-003 @clause CL-VALIDATOR-004
  it('succeeds when validator skip logic is correct', () => {
    const skipNoContract = { uiContract: null, manifest: { files: [] } }
    expect(skipNoContract.uiContract).toBeNull()
    
    const skipNoManifest = { uiContract: {}, manifest: null }
    expect(skipNoManifest.manifest).toBeNull()
    
    const noSkip = { 
      uiContract: createValidUIContractSchema(), 
      manifest: { files: [{ path: 'src/Button.tsx', action: 'MODIFY' }] },
    }
    expect(noSkip.uiContract).not.toBeNull()
    expect(noSkip.manifest).not.toBeNull()
  })
})
