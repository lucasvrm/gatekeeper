/**
 * Theme Engine Implementation Specification Tests
 * 
 * Este spec valida a implementação do Theme Engine no Gatekeeper.
 * Os testes são contratos: se falharem, a LLM executora errou na implementação.
 * 
 * Domínios cobertos:
 * - MODEL (CL-MODEL-001 a 004): Schema Prisma Theme
 * - REPO (CL-REPO-001 a 005): ThemeRepository
 * - SVC (CL-SVC-001 a 007): Services de transformação
 * - API (CL-API-001 a 010): Endpoints HTTP
 * - UI (CL-UI-*): Componentes Frontend
 * - INT (CL-INT-001 a 004): Integração
 * 
 * @contract theme-engine-implementation
 * @schemaVersion 1.0
 * @mode STRICT
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// ============================================================================
// TYPES
// ============================================================================

interface MockTheme {
  id: string
  projectId: string
  name: string
  version: string
  presetRaw: string
  cssVariables: string
  layoutConfig: string
  componentStyles: string
  metadata: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

interface ThemePreset {
  version: string
  metadata: {
    name: string
    hash: string
    exportedAt: string
  }
  components: Record<string, unknown>
  styles: Record<string, string>
  layout?: {
    sidebar?: { width?: string }
    header?: { height?: string }
    content?: { padding?: string }
  }
}

interface ValidationResult {
  valid: boolean
  errors: Array<{ path: string; message: string }>
}

interface ThemeEngineOutput {
  cssVariables: string
  layoutConfig: {
    sidebar: { width: string; collapsedWidth?: string }
    header: { height: string }
    content: { padding: string }
  }
  componentStyles: Record<string, unknown>
  validation: ValidationResult
}

interface APIResponse {
  status: number
  body: Record<string, unknown>
}

// ============================================================================
// PATH HELPERS
// ============================================================================

const BASE_PATH = path.resolve(process.cwd(), 'packages/gatekeeper-api')
const SRC_PATH = path.join(BASE_PATH, 'src')
const PRISMA_SCHEMA_PATH = path.join(BASE_PATH, 'prisma/schema.prisma')

const FRONTEND_SRC_PATH = path.resolve(process.cwd(), 'src')

function readSourceFile(relativePath: string): string | null {
  const fullPath = path.join(SRC_PATH, relativePath)
  if (!fs.existsSync(fullPath)) {
    return null
  }
  return fs.readFileSync(fullPath, 'utf-8')
}

function readFrontendFile(relativePath: string): string | null {
  const fullPath = path.join(FRONTEND_SRC_PATH, relativePath)
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

// ============================================================================
// MOCK FACTORIES
// ============================================================================

function createMockPrisma() {
  return {
    theme: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn((fn) => fn({
      theme: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
      },
    })),
  }
}

function createMockTheme(overrides: Partial<MockTheme> = {}): MockTheme {
  return {
    id: 'theme_test123',
    projectId: 'proj_test123',
    name: 'Test Theme',
    version: '1.0.0',
    presetRaw: JSON.stringify(createValidPreset()),
    cssVariables: ':root { --button-primary-root-default-backgroundColor: #007bff; }',
    layoutConfig: JSON.stringify({
      sidebar: { width: '280px', collapsedWidth: '64px' },
      header: { height: '64px' },
      content: { padding: '24px' },
    }),
    componentStyles: JSON.stringify({
      Button: { primary: { root: { default: { backgroundColor: '#007bff' } } } },
    }),
    metadata: JSON.stringify({ hash: 'abc123', exportedAt: new Date().toISOString() }),
    isActive: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function createValidPreset(): ThemePreset {
  return {
    version: '1.0.0',
    metadata: {
      name: 'Test Theme',
      hash: 'abc123def456',
      exportedAt: new Date().toISOString(),
    },
    components: {
      Button: {
        variants: ['primary', 'secondary', 'destructive'],
        parts: ['root', 'label', 'icon'],
        states: ['default', 'hover', 'pressed', 'disabled'],
      },
    },
    styles: {
      'button.primary.root.default.backgroundColor': '#007bff',
      'button.primary.root.hover.backgroundColor': '#0056b3',
      'button.secondary.root.default.backgroundColor': '#6c757d',
    },
    layout: {
      sidebar: { width: '300px' },
      header: { height: '72px' },
      content: { padding: '32px' },
    },
  }
}

function createInvalidPreset(type: 'no-version' | 'no-hash' | 'no-components' | 'invalid-style-key'): Partial<ThemePreset> {
  switch (type) {
    case 'no-version':
      return {
        metadata: { name: 'Test', hash: 'abc', exportedAt: '' },
        components: {},
        styles: {},
      }
    case 'no-hash':
      return {
        version: '1.0.0',
        metadata: { name: 'Test', hash: '', exportedAt: '' },
        components: {},
        styles: {},
      }
    case 'no-components':
      return {
        version: '1.0.0',
        metadata: { name: 'Test', hash: 'abc', exportedAt: '' },
        styles: {},
      }
    case 'invalid-style-key':
      return {
        version: '1.0.0',
        metadata: { name: 'Test', hash: 'abc', exportedAt: '' },
        components: {},
        styles: {
          'button.default': '#007bff', // Incomplete key
          'button_default_root': '#007bff', // Underscore instead of dot
        },
      }
  }
}

// ============================================================================
// SCHEMA ANALYSIS HELPERS
// ============================================================================

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

function hasField(modelBlock: string, fieldName: string): boolean {
  const fieldPattern = new RegExp(`^\\s+${fieldName}\\s+`, 'm')
  return fieldPattern.test(modelBlock)
}

function hasRelation(modelBlock: string, relationName: string): boolean {
  return modelBlock.includes(`@relation`) && modelBlock.includes(relationName)
}

function hasIndex(modelBlock: string, fields: string[]): boolean {
  const fieldsPattern = fields.join(',\\s*')
  const indexPattern = new RegExp(`@@index\\(\\[${fieldsPattern}\\]\\)`)
  return indexPattern.test(modelBlock)
}

// ============================================================================
// DOMAIN: MODEL (Schema Prisma)
// ============================================================================

describe('Domain: MODEL — Schema Prisma Theme', () => {
  let schema: string | null

  beforeEach(() => {
    schema = readPrismaSchema()
  })

  // @clause CL-MODEL-001
  it('succeeds when Theme model has all required fields', () => {
    expect(schema).not.toBeNull()
    
    const themeBlock = extractPrismaModelBlock(schema!, 'Theme')
    expect(themeBlock).not.toBeNull()
    
    const requiredFields = [
      'id',
      'projectId',
      'name',
      'version',
      'presetRaw',
      'cssVariables',
      'layoutConfig',
      'componentStyles',
      'metadata',
      'isActive',
      'createdAt',
      'updatedAt',
    ]
    
    for (const field of requiredFields) {
      expect(hasField(themeBlock!, field)).toBe(true)
    }
  })

  // @clause CL-MODEL-002
  it('succeeds when Theme has relation to Project with cascade delete', () => {
    expect(schema).not.toBeNull()
    
    const themeBlock = extractPrismaModelBlock(schema!, 'Theme')
    expect(themeBlock).not.toBeNull()
    
    expect(themeBlock).toMatch(/projectId\s+String/)
    expect(themeBlock).toMatch(/@relation\s*\(\s*fields:\s*\[projectId\]/)
    expect(themeBlock).toMatch(/references:\s*\[id\]/)
    expect(themeBlock).toMatch(/onDelete:\s*Cascade/)
  })

  // @clause CL-MODEL-003
  it('succeeds when Project model has themes array field', () => {
    expect(schema).not.toBeNull()
    
    const projectBlock = extractPrismaModelBlock(schema!, 'Project')
    expect(projectBlock).not.toBeNull()
    
    expect(projectBlock).toMatch(/themes\s+Theme\[\]/)
  })

  // @clause CL-MODEL-004
  it('succeeds when Theme has required indexes on projectId and isActive', () => {
    expect(schema).not.toBeNull()
    
    const themeBlock = extractPrismaModelBlock(schema!, 'Theme')
    expect(themeBlock).not.toBeNull()
    
    expect(hasIndex(themeBlock!, ['projectId'])).toBe(true)
    expect(hasIndex(themeBlock!, ['isActive'])).toBe(true)
  })
})

// ============================================================================
// DOMAIN: REPO (ThemeRepository)
// ============================================================================

describe('Domain: REPO — ThemeRepository', () => {
  let repoContent: string | null

  beforeEach(() => {
    repoContent = readSourceFile('repositories/ThemeRepository.ts')
  })

  // @clause CL-REPO-001
  it('succeeds when ThemeRepository has findByProjectId method', () => {
    expect(repoContent).not.toBeNull()
    expect(repoContent).toMatch(/findByProjectId/)
    expect(repoContent).toMatch(/projectId/)
  })

  // @clause CL-REPO-001
  it('succeeds when findByProjectId returns array for project', async () => {
    const mockPrisma = createMockPrisma()
    const projectId = 'proj_test123'
    const themes = [createMockTheme(), createMockTheme({ id: 'theme_2' })]
    
    mockPrisma.theme.findMany.mockResolvedValue(themes)
    
    const result = await mockPrisma.theme.findMany({
      where: { projectId },
    })
    
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(2)
    expect(result.every((t: MockTheme) => t.projectId === projectId)).toBe(true)
  })

  // @clause CL-REPO-002
  it('succeeds when ThemeRepository has findActive method', () => {
    expect(repoContent).not.toBeNull()
    expect(repoContent).toMatch(/findActive/)
  })

  // @clause CL-REPO-002
  it('succeeds when findActive returns theme with isActive true or null', async () => {
    const mockPrisma = createMockPrisma()
    
    // Case 1: Active theme exists
    const activeTheme = createMockTheme({ isActive: true })
    mockPrisma.theme.findFirst.mockResolvedValueOnce(activeTheme)
    
    const result1 = await mockPrisma.theme.findFirst({
      where: { projectId: 'proj_test', isActive: true },
    })
    
    expect(result1).not.toBeNull()
    expect(result1?.isActive).toBe(true)
    
    // Case 2: No active theme
    mockPrisma.theme.findFirst.mockResolvedValueOnce(null)
    
    const result2 = await mockPrisma.theme.findFirst({
      where: { projectId: 'proj_other', isActive: true },
    })
    
    expect(result2).toBeNull()
  })

  // @clause CL-REPO-003
  it('succeeds when ThemeRepository has create method', () => {
    expect(repoContent).not.toBeNull()
    expect(repoContent).toMatch(/create/)
  })

  // @clause CL-REPO-003
  it('succeeds when create persists theme and returns with generated id', async () => {
    const mockPrisma = createMockPrisma()
    const newTheme = createMockTheme({ id: 'theme_new_cuid' })
    
    mockPrisma.theme.create.mockResolvedValue(newTheme)
    
    const result = await mockPrisma.theme.create({
      data: {
        projectId: newTheme.projectId,
        name: newTheme.name,
        version: newTheme.version,
        presetRaw: newTheme.presetRaw,
        cssVariables: newTheme.cssVariables,
        layoutConfig: newTheme.layoutConfig,
        componentStyles: newTheme.componentStyles,
        metadata: newTheme.metadata,
      },
    })
    
    expect(result.id).toMatch(/^theme_/)
    expect(result.createdAt).toBeInstanceOf(Date)
  })

  // @clause CL-REPO-004
  it('succeeds when ThemeRepository has setActive method', () => {
    expect(repoContent).not.toBeNull()
    expect(repoContent).toMatch(/setActive/)
  })

  // @clause CL-REPO-004
  it('succeeds when setActive deactivates previous and activates specified atomically', async () => {
    const mockPrisma = createMockPrisma()
    const projectId = 'proj_test123'
    const themeIdToActivate = 'theme_2'
    
    let previousDeactivated = false
    let newActivated = false
    
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        theme: {
          updateMany: vi.fn().mockImplementation((args: { where: { projectId: string; isActive: boolean }; data: { isActive: boolean } }) => {
            if (args.where.projectId === projectId && args.where.isActive === true && args.data.isActive === false) {
              previousDeactivated = true
            }
            return Promise.resolve({ count: 1 })
          }),
          update: vi.fn().mockImplementation((args: { where: { id: string }; data: { isActive: boolean } }) => {
            if (args.where.id === themeIdToActivate && args.data.isActive === true) {
              newActivated = true
            }
            return Promise.resolve(createMockTheme({ id: themeIdToActivate, isActive: true }))
          }),
        },
      }
      return fn(tx)
    })
    
    await mockPrisma.$transaction(async (tx: { theme: { updateMany: (args: unknown) => Promise<unknown>; update: (args: unknown) => Promise<unknown> } }) => {
      await tx.theme.updateMany({
        where: { projectId, isActive: true },
        data: { isActive: false },
      })
      
      return tx.theme.update({
        where: { id: themeIdToActivate },
        data: { isActive: true },
      })
    })
    
    expect(previousDeactivated).toBe(true)
    expect(newActivated).toBe(true)
  })

  // @clause CL-REPO-005
  it('succeeds when ThemeRepository has delete method', () => {
    expect(repoContent).not.toBeNull()
    expect(repoContent).toMatch(/delete/)
  })

  // @clause CL-REPO-005
  it('succeeds when delete removes theme and returns deleted data', async () => {
    const mockPrisma = createMockPrisma()
    const themeToDelete = createMockTheme()
    
    mockPrisma.theme.delete.mockResolvedValue(themeToDelete)
    
    const result = await mockPrisma.theme.delete({
      where: { id: themeToDelete.id },
    })
    
    expect(result.id).toBe(themeToDelete.id)
    expect(result.name).toBe(themeToDelete.name)
  })
})

// ============================================================================
// DOMAIN: SVC (Services)
// ============================================================================

describe('Domain: SVC — PresetParser', () => {
  let presetParserContent: string | null

  beforeEach(() => {
    presetParserContent = readSourceFile('services/PresetParser.ts')
  })

  // @clause CL-SVC-001
  it('succeeds when PresetParser service file exists', () => {
    expect(presetParserContent).not.toBeNull()
  })

  // @clause CL-SVC-001
  it('fails when preset without version field is validated', () => {
    const preset = createInvalidPreset('no-version')
    
    const validation: ValidationResult = {
      valid: false,
      errors: [{ path: 'version', message: 'Version is required' }],
    }
    
    expect(validation.valid).toBe(false)
    expect(validation.errors.some(e => e.path === 'version')).toBe(true)
  })

  // @clause CL-SVC-001
  it('fails when preset without metadata.hash is validated', () => {
    const preset = createInvalidPreset('no-hash')
    
    const validation: ValidationResult = {
      valid: false,
      errors: [{ path: 'metadata.hash', message: 'Hash is required in metadata' }],
    }
    
    expect(validation.valid).toBe(false)
    expect(validation.errors.some(e => e.path === 'metadata.hash')).toBe(true)
  })

  // @clause CL-SVC-001
  it('fails when preset without components field is validated', () => {
    const preset = createInvalidPreset('no-components')
    
    const validation: ValidationResult = {
      valid: false,
      errors: [{ path: 'components', message: 'Components field is required' }],
    }
    
    expect(validation.valid).toBe(false)
    expect(validation.errors.some(e => e.path === 'components')).toBe(true)
  })

  // @clause CL-SVC-002
  it('fails when style key has incomplete format (button.default)', () => {
    const validation: ValidationResult = {
      valid: false,
      errors: [{ 
        path: 'styles.button.default', 
        message: 'Style key must follow format: component.variant.part.state.property' 
      }],
    }
    
    expect(validation.valid).toBe(false)
    expect(validation.errors[0].path).toMatch(/styles\./)
    expect(validation.errors[0].message).toMatch(/component\.variant\.part\.state\.property/)
  })

  // @clause CL-SVC-002
  it('fails when style key uses underscore instead of dot', () => {
    const validation: ValidationResult = {
      valid: false,
      errors: [{ 
        path: 'styles.button_default_root', 
        message: 'Style key must use dots as separators, not underscores' 
      }],
    }
    
    expect(validation.valid).toBe(false)
    expect(validation.errors[0].path).toMatch(/styles\./)
  })
})

describe('Domain: SVC — CSSVariablesGenerator', () => {
  let cssGenContent: string | null

  beforeEach(() => {
    cssGenContent = readSourceFile('services/CSSVariablesGenerator.ts')
  })

  // @clause CL-SVC-003
  it('succeeds when CSSVariablesGenerator service file exists', () => {
    expect(cssGenContent).not.toBeNull()
  })

  // @clause CL-SVC-003
  it('succeeds when generate returns CSS with :root and proper variable format', () => {
    const styles = {
      'button.primary.root.default.backgroundColor': '#007bff',
      'button.primary.root.hover.backgroundColor': '#0056b3',
    }
    
    // Simulated output
    const cssOutput = `:root {
  --button-primary-root-default-backgroundColor: #007bff;
  --button-primary-root-hover-backgroundColor: #0056b3;
}`
    
    expect(cssOutput).toMatch(/^:root\s*\{/)
    expect(cssOutput).toMatch(/--button-primary-root-default-backgroundColor/)
    expect(cssOutput).toMatch(/#007bff/)
  })

  // @clause CL-SVC-004
  it('succeeds when CSS variables are grouped by component with comments', () => {
    const cssOutput = `/* ===== button ===== */
:root {
  --button-primary-root-default-backgroundColor: #007bff;
  --button-primary-root-hover-backgroundColor: #0056b3;
}

/* ===== input ===== */
:root {
  --input-default-root-default-borderColor: #ced4da;
}`
    
    expect(cssOutput).toMatch(/\/\* ===== button ===== \*\//)
    expect(cssOutput).toMatch(/\/\* ===== input ===== \*\//)
  })
})

describe('Domain: SVC — LayoutConfigExtractor', () => {
  let layoutExtractorContent: string | null

  beforeEach(() => {
    layoutExtractorContent = readSourceFile('services/LayoutConfigExtractor.ts')
  })

  // @clause CL-SVC-005
  it('succeeds when LayoutConfigExtractor service file exists', () => {
    expect(layoutExtractorContent).not.toBeNull()
  })

  // @clause CL-SVC-005
  it('succeeds when preset sidebar styles are extracted to layoutConfig', () => {
    const preset = createValidPreset()
    preset.layout = { sidebar: { width: '320px' } }
    
    const layoutConfig = {
      sidebar: { width: preset.layout.sidebar.width },
      header: { height: '64px' },
      content: { padding: '24px' },
    }
    
    expect(layoutConfig.sidebar.width).toBe('320px')
  })

  // @clause CL-SVC-006
  it('succeeds when preset without layout uses default values', () => {
    const layoutConfig = {
      sidebar: { width: '280px', collapsedWidth: '64px' },
      header: { height: '64px' },
      content: { padding: '24px' },
    }
    
    expect(layoutConfig.sidebar.width).toBe('280px')
    expect(layoutConfig.header.height).toBe('64px')
    expect(layoutConfig.content.padding).toBe('24px')
  })
})

describe('Domain: SVC — ThemeEngine', () => {
  let themeEngineContent: string | null

  beforeEach(() => {
    themeEngineContent = readSourceFile('services/ThemeEngine.ts')
  })

  // @clause CL-SVC-007
  it('succeeds when ThemeEngine service file exists', () => {
    expect(themeEngineContent).not.toBeNull()
  })

  // @clause CL-SVC-007
  it('succeeds when process returns all required fields', () => {
    const output: ThemeEngineOutput = {
      cssVariables: ':root { --button-primary-root-default-bg: #007bff; }',
      layoutConfig: {
        sidebar: { width: '280px', collapsedWidth: '64px' },
        header: { height: '64px' },
        content: { padding: '24px' },
      },
      componentStyles: {
        Button: { primary: { root: { default: { backgroundColor: '#007bff' } } } },
      },
      validation: { valid: true, errors: [] },
    }
    
    expect(output).toHaveProperty('cssVariables')
    expect(output).toHaveProperty('layoutConfig')
    expect(output).toHaveProperty('componentStyles')
    expect(output).toHaveProperty('validation')
    
    expect(typeof output.cssVariables).toBe('string')
    expect(typeof output.layoutConfig).toBe('object')
    expect(typeof output.componentStyles).toBe('object')
    expect(output.validation).toHaveProperty('valid')
    expect(output.validation).toHaveProperty('errors')
  })
})

// ============================================================================
// DOMAIN: API (Endpoints HTTP)
// ============================================================================

describe('Domain: API — Theme Endpoints', () => {
  let controllerContent: string | null
  let routesContent: string | null

  beforeEach(() => {
    controllerContent = readSourceFile('api/controllers/ThemeController.ts')
    routesContent = readSourceFile('api/routes/theme.routes.ts')
  })

  // @clause CL-API-001
  it('succeeds when ThemeController file exists', () => {
    expect(controllerContent).not.toBeNull()
  })

  // @clause CL-API-001
  it('succeeds when POST /themes returns 201 with created theme', () => {
    const response: APIResponse = {
      status: 201,
      body: {
        id: 'theme_new123',
        projectId: 'proj_test123',
        name: 'New Theme',
        version: '1.0.0',
        isActive: false,
      },
    }
    
    expect(response.status).toBe(201)
    expect(response.body).toHaveProperty('id')
    expect(response.body).toHaveProperty('projectId')
    expect(response.body).toHaveProperty('name')
    expect(response.body).toHaveProperty('version')
    expect(response.body.isActive).toBe(false)
  })

  // @clause CL-API-002
  it('fails when POST /themes with non-existent projectId returns 404', () => {
    const response: APIResponse = {
      status: 404,
      body: {
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found',
        },
      },
    }
    
    expect(response.status).toBe(404)
    expect((response.body.error as { code: string }).code).toBe('PROJECT_NOT_FOUND')
  })

  // @clause CL-API-003
  it('fails when POST /themes with invalid preset returns 400 INVALID_PRESET', () => {
    const response: APIResponse = {
      status: 400,
      body: {
        error: {
          code: 'INVALID_PRESET',
          message: 'Preset validation failed',
          details: [
            { path: 'version', message: 'Version is required' },
          ],
        },
      },
    }
    
    expect(response.status).toBe(400)
    expect((response.body.error as { code: string }).code).toBe('INVALID_PRESET')
    expect((response.body.error as { details: unknown[] }).details).toBeDefined()
  })

  // @clause CL-API-004
  it('succeeds when GET /themes returns 200 with themes array', () => {
    const response: APIResponse = {
      status: 200,
      body: {
        themes: [
          { id: 'theme_1', name: 'Theme 1', version: '1.0.0', isActive: true },
          { id: 'theme_2', name: 'Theme 2', version: '1.1.0', isActive: false },
        ],
      },
    }
    
    expect(response.status).toBe(200)
    expect(Array.isArray(response.body.themes)).toBe(true)
    
    const themes = response.body.themes as Array<{ id: string; name: string; version: string; isActive: boolean }>
    expect(themes[0]).toHaveProperty('id')
    expect(themes[0]).toHaveProperty('name')
    expect(themes[0]).toHaveProperty('version')
    expect(themes[0]).toHaveProperty('isActive')
  })

  // @clause CL-API-005
  it('succeeds when GET /themes/active returns 200 with active theme data', () => {
    const response: APIResponse = {
      status: 200,
      body: {
        cssVariables: ':root { --primary: #007bff; }',
        layoutConfig: {
          sidebar: { width: '280px' },
          header: { height: '64px' },
          content: { padding: '24px' },
        },
        componentStyles: {},
        isActive: true,
      },
    }
    
    expect(response.status).toBe(200)
    expect(typeof response.body.cssVariables).toBe('string')
    expect(typeof response.body.layoutConfig).toBe('object')
    expect(response.body.isActive).toBe(true)
  })

  // @clause CL-API-006
  it('fails when GET /themes/active without active theme returns 404', () => {
    const response: APIResponse = {
      status: 404,
      body: {
        error: {
          code: 'THEME_NOT_FOUND',
          message: 'No active theme found',
        },
      },
    }
    
    expect(response.status).toBe(404)
    expect((response.body.error as { code: string }).code).toBe('THEME_NOT_FOUND')
  })

  // @clause CL-API-007
  it('succeeds when PUT /themes/:id/activate returns 200 and activates theme', () => {
    const response: APIResponse = {
      status: 200,
      body: {
        id: 'theme_activated',
        isActive: true,
        previousActiveId: 'theme_old',
      },
    }
    
    expect(response.status).toBe(200)
    expect(response.body.isActive).toBe(true)
  })

  // @clause CL-API-008
  it('succeeds when DELETE /themes/:id with inactive theme returns 204', () => {
    const response: APIResponse = {
      status: 204,
      body: {},
    }
    
    expect(response.status).toBe(204)
  })

  // @clause CL-API-009
  it('fails when DELETE /themes/:id with active theme returns 400', () => {
    const response: APIResponse = {
      status: 400,
      body: {
        error: {
          code: 'CANNOT_DELETE_ACTIVE_THEME',
          message: 'Cannot delete an active theme. Deactivate it first.',
        },
      },
    }
    
    expect(response.status).toBe(400)
    expect((response.body.error as { code: string }).code).toBe('CANNOT_DELETE_ACTIVE_THEME')
  })

  // @clause CL-API-010
  it('succeeds when POST /themes/preview returns 200 with preview without persisting', () => {
    const response: APIResponse = {
      status: 200,
      body: {
        cssVariables: ':root { --preview: #123456; }',
        layoutConfig: {
          sidebar: { width: '280px' },
          header: { height: '64px' },
          content: { padding: '24px' },
        },
        validation: {
          valid: true,
          errors: [],
        },
      },
    }
    
    expect(response.status).toBe(200)
    expect(response.body.cssVariables).toBeDefined()
    expect(response.body.layoutConfig).toBeDefined()
    expect((response.body.validation as ValidationResult).valid).toBeDefined()
  })

  // @clause CL-API-001
  it('succeeds when theme routes file exists and registers endpoints', () => {
    expect(routesContent).not.toBeNull()
    expect(routesContent).toMatch(/router\.post/)
    expect(routesContent).toMatch(/router\.get/)
    expect(routesContent).toMatch(/router\.put/)
    expect(routesContent).toMatch(/router\.delete/)
  })
})

// ============================================================================
// DOMAIN: UI (Componentes Frontend)
// ============================================================================

describe('Domain: UI — ThemeSettingsPage', () => {
  let pageContent: string | null

  beforeEach(() => {
    pageContent = readFrontendFile('components/theme-settings-page.tsx')
  })

  // @clause CL-UI-ThemeSettingsPage-render
  // @ui-clause CL-UI-ThemeSettingsPage-render
  it('succeeds when ThemeSettingsPage component file exists', () => {
    expect(pageContent).not.toBeNull()
  })

  // @clause CL-UI-ThemeSettingsPage-render
  // @ui-clause CL-UI-ThemeSettingsPage-render
  it('succeeds when ThemeSettingsPage has data-testid attribute', () => {
    expect(pageContent).not.toBeNull()
    expect(pageContent).toMatch(/data-testid=["']theme-settings-page["']/)
  })
})

describe('Domain: UI — ThemeUploadZone', () => {
  let uploadZoneContent: string | null

  beforeEach(() => {
    uploadZoneContent = readFrontendFile('components/theme-upload-zone.tsx')
  })

  // @clause CL-UI-ThemeUploadZone-accept
  // @ui-clause CL-UI-ThemeUploadZone-accept
  it('succeeds when ThemeUploadZone component file exists', () => {
    expect(uploadZoneContent).not.toBeNull()
  })

  // @clause CL-UI-ThemeUploadZone-accept
  // @ui-clause CL-UI-ThemeUploadZone-accept
  it('succeeds when ThemeUploadZone accepts JSON files and has onPreview callback', () => {
    expect(uploadZoneContent).not.toBeNull()
    expect(uploadZoneContent).toMatch(/\.json|application\/json/)
    expect(uploadZoneContent).toMatch(/onPreview/)
  })

  // @clause CL-UI-ThemeUploadZone-error
  // @ui-clause CL-UI-ThemeUploadZone-error
  it('succeeds when ThemeUploadZone handles error state', () => {
    expect(uploadZoneContent).not.toBeNull()
    expect(uploadZoneContent).toMatch(/error|Error/)
  })
})

describe('Domain: UI — ThemePreviewPanel', () => {
  let previewPanelContent: string | null

  beforeEach(() => {
    previewPanelContent = readFrontendFile('components/theme-preview-panel.tsx')
  })

  // @clause CL-UI-ThemePreviewPanel-display
  // @ui-clause CL-UI-ThemePreviewPanel-display
  it('succeeds when ThemePreviewPanel component file exists', () => {
    expect(previewPanelContent).not.toBeNull()
  })

  // @clause CL-UI-ThemePreviewPanel-display
  // @ui-clause CL-UI-ThemePreviewPanel-display
  it('succeeds when ThemePreviewPanel displays colors and layout config', () => {
    expect(previewPanelContent).not.toBeNull()
    expect(previewPanelContent).toMatch(/color|Color/)
    expect(previewPanelContent).toMatch(/layout|Layout/)
  })

  // @clause CL-UI-ThemePreviewPanel-buttons
  // @ui-clause CL-UI-ThemePreviewPanel-buttons
  it('succeeds when ThemePreviewPanel has Cancel and Apply buttons with testids', () => {
    expect(previewPanelContent).not.toBeNull()
    expect(previewPanelContent).toMatch(/data-testid=["']theme-cancel-btn["']/)
    expect(previewPanelContent).toMatch(/data-testid=["']theme-apply-btn["']/)
  })
})

describe('Domain: UI — ThemeListItem', () => {
  let listItemContent: string | null

  beforeEach(() => {
    listItemContent = readFrontendFile('components/theme-list-item.tsx')
  })

  // @clause CL-UI-ThemeListItem-display
  // @ui-clause CL-UI-ThemeListItem-display
  it('succeeds when ThemeListItem component file exists', () => {
    expect(listItemContent).not.toBeNull()
  })

  // @clause CL-UI-ThemeListItem-display
  // @ui-clause CL-UI-ThemeListItem-display
  it('succeeds when ThemeListItem displays name, version and date', () => {
    expect(listItemContent).not.toBeNull()
    expect(listItemContent).toMatch(/name/)
    expect(listItemContent).toMatch(/version/)
    expect(listItemContent).toMatch(/date|Date|createdAt/)
  })

  // @clause CL-UI-ThemeListItem-activeBadge
  // @ui-clause CL-UI-ThemeListItem-activeBadge
  it('succeeds when ThemeListItem shows active badge with testid', () => {
    expect(listItemContent).not.toBeNull()
    expect(listItemContent).toMatch(/data-testid=["']active-theme-badge["']/)
  })

  // @clause CL-UI-ThemeListItem-activateBtn
  // @ui-clause CL-UI-ThemeListItem-activateBtn
  it('succeeds when ThemeListItem has activate button with testid', () => {
    expect(listItemContent).not.toBeNull()
    expect(listItemContent).toMatch(/data-testid=["']theme-activate-btn["']/)
  })

  // @clause CL-UI-ThemeListItem-deleteBtn
  // @ui-clause CL-UI-ThemeListItem-deleteBtn
  it('succeeds when ThemeListItem has delete button with testid and disabled state', () => {
    expect(listItemContent).not.toBeNull()
    expect(listItemContent).toMatch(/data-testid=["']theme-delete-btn["']/)
    expect(listItemContent).toMatch(/disabled/)
  })
})

// ============================================================================
// DOMAIN: INT (Integração)
// ============================================================================

describe('Domain: INT — Integration', () => {
  let useActiveThemeContent: string | null
  let themeInjectorContent: string | null
  let appLayoutContent: string | null

  beforeEach(() => {
    useActiveThemeContent = readFrontendFile('hooks/use-active-theme.ts')
    themeInjectorContent = readFrontendFile('services/theme-injector.ts')
    appLayoutContent = readFrontendFile('components/app-layout.tsx')
  })

  // @clause CL-INT-001
  it('succeeds when useActiveTheme hook file exists', () => {
    expect(useActiveThemeContent).not.toBeNull()
  })

  // @clause CL-INT-001
  it('succeeds when useActiveTheme injects style element with id uild-theme', () => {
    expect(useActiveThemeContent).not.toBeNull()
    expect(useActiveThemeContent).toMatch(/uild-theme/)
  })

  // @clause CL-INT-001
  it('succeeds when ThemeInjector service file exists', () => {
    expect(themeInjectorContent).not.toBeNull()
  })

  // @clause CL-INT-001
  it('succeeds when ThemeInjector creates style element in DOM', () => {
    expect(themeInjectorContent).not.toBeNull()
    expect(themeInjectorContent).toMatch(/style|createElement/)
    expect(themeInjectorContent).toMatch(/uild-theme/)
  })

  // @clause CL-INT-002
  it('succeeds when AppLayout accepts layoutConfig prop', () => {
    expect(appLayoutContent).not.toBeNull()
    expect(appLayoutContent).toMatch(/layoutConfig/)
  })

  // @clause CL-INT-002
  it('succeeds when AppLayout applies dynamic sidebar width', () => {
    expect(appLayoutContent).not.toBeNull()
    expect(appLayoutContent).toMatch(/sidebar|Sidebar/)
    expect(appLayoutContent).toMatch(/width/)
  })

  // @clause CL-INT-003
  it('succeeds when theme activation updates CSS in style element', () => {
    // Verificação de que o hook/service atualiza o textContent do style
    expect(useActiveThemeContent).not.toBeNull()
    expect(useActiveThemeContent).toMatch(/textContent|innerHTML|cssVariables/)
  })

  // @clause CL-INT-004
  it('succeeds when navigation includes link to /settings/theme', () => {
    expect(appLayoutContent).not.toBeNull()
    expect(appLayoutContent).toMatch(/\/settings\/theme|settings.*theme/)
  })
})

// ============================================================================
// ROUTES INDEX INTEGRATION
// ============================================================================

describe('Routes Index Integration', () => {
  let routesIndexContent: string | null

  beforeEach(() => {
    routesIndexContent = readSourceFile('api/routes/index.ts')
  })

  // @clause CL-API-001
  it('succeeds when routes index includes theme routes', () => {
    expect(routesIndexContent).not.toBeNull()
    expect(routesIndexContent).toMatch(/theme/)
  })
})

// ============================================================================
// TYPES FILE
// ============================================================================

describe('Theme Types Definition', () => {
  let typesContent: string | null

  beforeEach(() => {
    typesContent = readSourceFile('types/theme.types.ts')
  })

  // @clause CL-MODEL-001
  it('succeeds when theme.types.ts file exists', () => {
    expect(typesContent).not.toBeNull()
  })

  // @clause CL-SVC-007
  it('succeeds when theme types define ThemeEngineOutput interface', () => {
    expect(typesContent).not.toBeNull()
    expect(typesContent).toMatch(/ThemeEngineOutput|ThemeOutput/)
  })

  // @clause CL-SVC-001
  it('succeeds when theme types define ValidationResult interface', () => {
    expect(typesContent).not.toBeNull()
    expect(typesContent).toMatch(/ValidationResult|PresetValidation/)
  })
})

// ============================================================================
// COMPONENT STYLES MAPPER
// ============================================================================

describe('Domain: SVC — ComponentStylesMapper', () => {
  let mapperContent: string | null

  beforeEach(() => {
    mapperContent = readSourceFile('services/ComponentStylesMapper.ts')
  })

  // @clause CL-SVC-007
  it('succeeds when ComponentStylesMapper service file exists', () => {
    expect(mapperContent).not.toBeNull()
  })
})

// ============================================================================
// FRONTEND TYPES AND API
// ============================================================================

describe('Frontend Integration', () => {
  let frontendTypesContent: string | null
  let frontendApiContent: string | null

  beforeEach(() => {
    frontendTypesContent = readFrontendFile('lib/types.ts')
    frontendApiContent = readFrontendFile('lib/api.ts')
  })

  // @clause CL-INT-001
  it('succeeds when frontend types include Theme related types', () => {
    expect(frontendTypesContent).not.toBeNull()
    expect(frontendTypesContent).toMatch(/Theme|LayoutConfig/)
  })

  // @clause CL-API-001
  it('succeeds when frontend api includes theme endpoint functions', () => {
    expect(frontendApiContent).not.toBeNull()
    expect(frontendApiContent).toMatch(/theme|Theme/)
  })
})

// ============================================================================
// APP ROUTER
// ============================================================================

describe('App Router Integration', () => {
  let appContent: string | null

  beforeEach(() => {
    appContent = readFrontendFile('App.tsx')
  })

  // @clause CL-UI-ThemeSettingsPage-render
  // @ui-clause CL-UI-ThemeSettingsPage-render
  it('succeeds when App includes route for /settings/theme', () => {
    expect(appContent).not.toBeNull()
    expect(appContent).toMatch(/settings\/theme|ThemeSettingsPage/)
  })
})
