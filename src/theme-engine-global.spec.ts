/**
 * Theme Engine Global Refactor Specification Tests
 *
 * Este spec valida a refatoração do Theme Engine de "tema por projeto"
 * para "tema global da aplicação".
 *
 * Os testes são contratos: se falharem, a LLM executora errou na implementação.
 *
 * Domínios cobertos:
 * - SCHEMA (CL-SCHEMA-001 a 003): Schema Prisma
 * - REPO (CL-REPO-001 a 005): ThemeRepository
 * - CTRL (CL-CTRL-001 a 006): ThemeController
 * - ROUTE (CL-ROUTE-001): Rotas
 * - TYPE (CL-TYPE-001): Frontend Types
 * - API (CL-API-001 a 005): Frontend API Client
 * - HOOK (CL-HOOK-001): useActiveTheme Hook
 * - PAGE (CL-PAGE-001 a 005): ThemeSettingsPage
 * - APP (CL-APP-001): App.tsx Routes
 * - BTYPE (CL-BTYPE-001): Backend Types
 *
 * @contract theme-engine-global-refactor
 * @schemaVersion 1.0
 * @mode STRICT
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// ============================================================================
// PATH HELPERS
// ============================================================================

const cwd = process.cwd()
const isInBackendPackage = cwd.endsWith('gatekeeper-api') || cwd.includes('gatekeeper-api')

const BASE_PATH = isInBackendPackage ? cwd : path.resolve(cwd, 'packages/gatekeeper-api')
const SRC_PATH = path.join(BASE_PATH, 'src')
const PRISMA_SCHEMA_PATH = path.join(BASE_PATH, 'prisma/schema.prisma')

const REPO_ROOT = isInBackendPackage ? path.resolve(cwd, '../..') : cwd
const FRONTEND_SRC_PATH = path.join(REPO_ROOT, 'src')

function readFile(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`)
  }
  return fs.readFileSync(filePath, 'utf-8')
}

function extractModelBlock(schemaContent: string, modelName: string): string | null {
  const regex = new RegExp(`model\\s+${modelName}\\s*\\{([^}]+)\\}`, 's')
  const match = schemaContent.match(regex)
  return match ? match[1] : null
}

function extractInterfaceBlock(content: string, interfaceName: string): string | null {
  const regex = new RegExp(`(export\\s+)?interface\\s+${interfaceName}\\s*(extends\\s+[\\w,\\s]+)?\\s*\\{([^}]+)\\}`, 's')
  const match = content.match(regex)
  return match ? match[3] : null
}

function extractFunctionOrMethod(content: string, name: string): string | null {
  // Match async function, regular function, or method in class/object
  const patterns = [
    // async methodName(params): return { ... }
    new RegExp(`${name}\\s*[:=]?\\s*async\\s*\\([^)]*\\)[^{]*\\{[\\s\\S]*?\\n\\s*\\}`, 'm'),
    // methodName(params) { ... }
    new RegExp(`${name}\\s*\\([^)]*\\)[^{]*\\{[\\s\\S]*?\\n\\s+\\}`, 'm'),
    // methodName: async (params) => { ... }
    new RegExp(`${name}\\s*:\\s*async\\s*\\([^)]*\\)\\s*=>\\s*\\{[\\s\\S]*?\\n\\s*\\}`, 'm'),
    // methodName: (params) => { ... }
    new RegExp(`${name}\\s*:\\s*\\([^)]*\\)\\s*=>\\s*\\{[\\s\\S]*?\\n\\s*\\}`, 'm'),
  ]

  for (const pattern of patterns) {
    const match = content.match(pattern)
    if (match) return match[0]
  }
  return null
}

// ============================================================================
// BACKEND — SCHEMA & MIGRATION
// ============================================================================

describe('Backend — Schema & Migration', () => {
  let schemaContent: string

  beforeAll(() => {
    schemaContent = readFile(PRISMA_SCHEMA_PATH)
  })

  // @clause CL-SCHEMA-001
  it('succeeds when Theme model does not have projectId field', () => {
    const themeModel = extractModelBlock(schemaContent, 'Theme')
    expect(themeModel).not.toBeNull()

    // Verifica que projectId NÃO está presente
    const hasProjectIdField = /projectId\s+String/.test(themeModel!)
    expect(hasProjectIdField).toBe(false)

    // Verifica que relação com Project NÃO está presente
    const hasProjectRelation = /project\s+Project/.test(themeModel!)
    expect(hasProjectRelation).toBe(false)

    // Verifica que índice de projectId NÃO está presente
    const hasProjectIdIndex = /@@index\(\[projectId\]\)/.test(themeModel!)
    expect(hasProjectIdIndex).toBe(false)
  })

  // @clause CL-SCHEMA-002
  it('succeeds when Theme model has unique constraint on name', () => {
    const themeModel = extractModelBlock(schemaContent, 'Theme')
    expect(themeModel).not.toBeNull()

    // Verifica que constraint @@unique([name]) está presente
    const hasUniqueNameConstraint = /@@unique\(\[name\]\)/.test(themeModel!)
    expect(hasUniqueNameConstraint).toBe(true)
  })

  // @clause CL-SCHEMA-003
  it('succeeds when Project model does not have themes relation', () => {
    const projectModel = extractModelBlock(schemaContent, 'Project')
    expect(projectModel).not.toBeNull()

    // Verifica que campo themes Theme[] NÃO está presente
    const hasThemesRelation = /themes\s+Theme\[\]/.test(projectModel!)
    expect(hasThemesRelation).toBe(false)
  })
})

// ============================================================================
// BACKEND — REPOSITORY
// ============================================================================

describe('Backend — Repository', () => {
  let repoContent: string

  beforeAll(() => {
    const repoPath = path.join(SRC_PATH, 'repositories/ThemeRepository.ts')
    repoContent = readFile(repoPath)
  })

  // @clause CL-REPO-001
  it('succeeds when findAll returns all themes without projectId filter', () => {
    // Verifica que existe método findAll (não findByProjectId)
    const hasFindAll = /async\s+findAll\s*\(\s*\)/.test(repoContent)
    expect(hasFindAll).toBe(true)

    // Verifica que NÃO filtra por projectId
    const findAllMethod = extractFunctionOrMethod(repoContent, 'findAll')
    expect(findAllMethod).not.toBeNull()

    // findAll não deve ter where: { projectId }
    const hasProjectIdFilter = /where\s*:\s*\{\s*projectId/.test(findAllMethod!)
    expect(hasProjectIdFilter).toBe(false)

    // Deve ordenar por createdAt desc
    const hasCreatedAtOrder = /orderBy\s*:\s*\{\s*createdAt\s*:\s*['"]desc['"]/.test(findAllMethod!)
    expect(hasCreatedAtOrder).toBe(true)
  })

  // @clause CL-REPO-002
  it('succeeds when findActive returns global active theme without parameters', () => {
    // Verifica assinatura: findActive() sem parâmetros
    const hasFindActiveNoParams = /async\s+findActive\s*\(\s*\)/.test(repoContent)
    expect(hasFindActiveNoParams).toBe(true)

    const findActiveMethod = extractFunctionOrMethod(repoContent, 'findActive')
    expect(findActiveMethod).not.toBeNull()

    // Deve buscar isActive: true
    const hasIsActiveFilter = /isActive\s*:\s*true/.test(findActiveMethod!)
    expect(hasIsActiveFilter).toBe(true)

    // NÃO deve ter projectId no filtro
    const hasProjectIdFilter = /projectId/.test(findActiveMethod!)
    expect(hasProjectIdFilter).toBe(false)
  })

  // @clause CL-REPO-003
  it('succeeds when create does not include projectId in data', () => {
    const createMethod = extractFunctionOrMethod(repoContent, 'create')
    expect(createMethod).not.toBeNull()

    // Verifica que projectId NÃO está no data de criação
    // O padrão antigo era: projectId: data.projectId
    const hasProjectIdInCreate = /projectId\s*:\s*data\.projectId/.test(createMethod!)
    expect(hasProjectIdInCreate).toBe(false)

    // Verifica também que o parâmetro data não tem projectId no tipo
    // O tipo CreateThemeData não deve ter projectId (verificado em CL-BTYPE-001)
  })

  // @clause CL-REPO-004
  it('succeeds when activate deactivates ALL themes and activates specified one', () => {
    const activateMethod = extractFunctionOrMethod(repoContent, 'activate')
    expect(activateMethod).not.toBeNull()

    // Deve usar transação
    const usesTransaction = /\$transaction/.test(activateMethod!)
    expect(usesTransaction).toBe(true)

    // Deve desativar TODOS os temas (sem filtro de projectId)
    // Padrão esperado: updateMany sem where projectId
    const deactivatesAll = /updateMany[\s\S]*?isActive\s*:\s*false/m.test(activateMethod!)
    expect(deactivatesAll).toBe(true)

    // NÃO deve filtrar por projectId no updateMany
    // Antigo: where: { projectId: theme.projectId, isActive: true }
    // Novo: where: { isActive: true } ou where: {}
    const hasProjectIdInDeactivate = /where\s*:\s*\{[^}]*projectId[^}]*\}[\s\S]*?isActive\s*:\s*false/.test(activateMethod!)
    expect(hasProjectIdInDeactivate).toBe(false)
  })

  // @clause CL-REPO-005
  it('succeeds when deactivateAll sets isActive false for all themes', () => {
    // Verifica que método deactivateAll existe
    const hasDeactivateAll = /async\s+deactivateAll\s*\(\s*\)/.test(repoContent)
    expect(hasDeactivateAll).toBe(true)

    const deactivateAllMethod = extractFunctionOrMethod(repoContent, 'deactivateAll')
    expect(deactivateAllMethod).not.toBeNull()

    // Deve fazer updateMany com isActive: false
    const setsAllInactive = /updateMany[\s\S]*?isActive\s*:\s*false/m.test(deactivateAllMethod!)
    expect(setsAllInactive).toBe(true)
  })
})

// ============================================================================
// BACKEND — CONTROLLER
// ============================================================================

describe('Backend — Controller', () => {
  let controllerContent: string

  beforeAll(() => {
    const controllerPath = path.join(SRC_PATH, 'api/controllers/ThemeController.ts')
    controllerContent = readFile(controllerPath)
  })

  // @clause CL-CTRL-001
  it('succeeds when listThemes does not extract projectId from params', () => {
    const listThemesMethod = extractFunctionOrMethod(controllerContent, 'listThemes')
    expect(listThemesMethod).not.toBeNull()

    // NÃO deve extrair projectId de req.params
    const extractsProjectId = /const\s*\{\s*projectId\s*\}\s*=\s*req\.params/.test(listThemesMethod!)
    expect(extractsProjectId).toBe(false)

    // Deve chamar findAll() sem parâmetros
    const callsFindAllWithoutParams = /findAll\s*\(\s*\)/.test(listThemesMethod!)
    expect(callsFindAllWithoutParams).toBe(true)
  })

  // @clause CL-CTRL-002
  it('succeeds when createTheme does not require projectId', () => {
    const createThemeMethod = extractFunctionOrMethod(controllerContent, 'createTheme')
    expect(createThemeMethod).not.toBeNull()

    // NÃO deve extrair projectId de req.params
    const extractsProjectId = /const\s*\{\s*projectId\s*\}\s*=\s*req\.params/.test(createThemeMethod!)
    expect(extractsProjectId).toBe(false)

    // NÃO deve validar projeto
    const validatesProject = /prisma\.project\.findUnique/.test(createThemeMethod!)
    expect(validatesProject).toBe(false)

    // Response NÃO deve conter projectId
    const responseHasProjectId = /projectId\s*:\s*theme\.projectId/.test(createThemeMethod!)
    expect(responseHasProjectId).toBe(false)
  })

  // @clause CL-CTRL-003
  it('succeeds when getActiveTheme does not require projectId', () => {
    const getActiveThemeMethod = extractFunctionOrMethod(controllerContent, 'getActiveTheme')
    expect(getActiveThemeMethod).not.toBeNull()

    // NÃO deve extrair projectId de req.params
    const extractsProjectId = /const\s*\{\s*projectId\s*\}\s*=\s*req\.params/.test(getActiveThemeMethod!)
    expect(extractsProjectId).toBe(false)

    // Deve chamar findActive() sem parâmetros
    const callsFindActiveWithoutParams = /findActive\s*\(\s*\)/.test(getActiveThemeMethod!)
    expect(callsFindActiveWithoutParams).toBe(true)

    // Response NÃO deve conter projectId
    const responseHasProjectId = /projectId\s*:\s*theme\.projectId/.test(getActiveThemeMethod!)
    expect(responseHasProjectId).toBe(false)
  })

  // @clause CL-CTRL-004
  it('succeeds when activateTheme does not validate project ownership', () => {
    const activateThemeMethod = extractFunctionOrMethod(controllerContent, 'activateTheme')
    expect(activateThemeMethod).not.toBeNull()

    // NÃO deve extrair projectId de req.params
    const extractsProjectId = /const\s*\{\s*projectId\s*,?\s*themeId\s*\}\s*=\s*req\.params/.test(activateThemeMethod!)
      || /const\s*\{\s*projectId\s*\}\s*=\s*req\.params/.test(activateThemeMethod!)
    expect(extractsProjectId).toBe(false)

    // NÃO deve validar se tema pertence ao projeto
    const validatesOwnership = /theme\.projectId\s*!==\s*projectId/.test(activateThemeMethod!)
    expect(validatesOwnership).toBe(false)
  })

  // @clause CL-CTRL-005
  it('succeeds when deleteTheme does not validate project ownership', () => {
    const deleteThemeMethod = extractFunctionOrMethod(controllerContent, 'deleteTheme')
    expect(deleteThemeMethod).not.toBeNull()

    // NÃO deve extrair projectId de req.params
    const extractsProjectId = /const\s*\{\s*projectId\s*,?\s*themeId\s*\}\s*=\s*req\.params/.test(deleteThemeMethod!)
      || /const\s*\{\s*projectId\s*\}\s*=\s*req\.params/.test(deleteThemeMethod!)
    expect(extractsProjectId).toBe(false)

    // NÃO deve validar se tema pertence ao projeto
    const validatesOwnership = /theme\.projectId\s*!==\s*projectId/.test(deleteThemeMethod!)
    expect(validatesOwnership).toBe(false)
  })

  // @clause CL-CTRL-006
  it('succeeds when deleteTheme rejects active theme with correct error code', () => {
    const deleteThemeMethod = extractFunctionOrMethod(controllerContent, 'deleteTheme')
    expect(deleteThemeMethod).not.toBeNull()

    // Deve verificar se tema está ativo
    const checksIsActive = /theme\.isActive/.test(deleteThemeMethod!)
    expect(checksIsActive).toBe(true)

    // Deve retornar código de erro correto
    const hasCorrectErrorCode = /CANNOT_DELETE_ACTIVE_THEME/.test(deleteThemeMethod!)
    expect(hasCorrectErrorCode).toBe(true)

    // Deve retornar status 400
    const returns400 = /status\s*\(\s*400\s*\)/.test(deleteThemeMethod!)
    expect(returns400).toBe(true)
  })
})

// ============================================================================
// BACKEND — ROUTES
// ============================================================================

describe('Backend — Routes', () => {
  let routesContent: string

  beforeAll(() => {
    const routesPath = path.join(SRC_PATH, 'api/routes/theme.routes.ts')
    routesContent = readFile(routesPath)
  })

  // @clause CL-ROUTE-001
  it('succeeds when routes use paths without projectId', () => {
    // POST /themes (criar)
    const hasPostThemes = /router\.(post|put|get|delete)\s*\(\s*['"]\/themes['"]/.test(routesContent)
    expect(hasPostThemes).toBe(true)

    // GET /themes (listar)
    const hasGetThemes = /router\.get\s*\(\s*['"]\/themes['"]/.test(routesContent)
    expect(hasGetThemes).toBe(true)

    // GET /themes/active
    const hasGetActive = /router\.get\s*\(\s*['"]\/themes\/active['"]/.test(routesContent)
    expect(hasGetActive).toBe(true)

    // PUT /themes/:themeId/activate
    const hasPutActivate = /router\.put\s*\(\s*['"]\/themes\/:themeId\/activate['"]/.test(routesContent)
    expect(hasPutActivate).toBe(true)

    // DELETE /themes/:themeId
    const hasDeleteTheme = /router\.delete\s*\(\s*['"]\/themes\/:themeId['"]/.test(routesContent)
    expect(hasDeleteTheme).toBe(true)

    // NÃO deve ter rotas com /projects/:projectId/themes
    const hasOldProjectRoutes = /\/projects\/:projectId\/themes/.test(routesContent)
    expect(hasOldProjectRoutes).toBe(false)
  })
})

// ============================================================================
// BACKEND — TYPES
// ============================================================================

describe('Backend — Types', () => {
  let typesContent: string

  beforeAll(() => {
    const typesPath = path.join(SRC_PATH, 'types/theme.types.ts')
    typesContent = readFile(typesPath)
  })

  // @clause CL-BTYPE-001
  it('succeeds when CreateThemeData does not have projectId field', () => {
    const createThemeDataInterface = extractInterfaceBlock(typesContent, 'CreateThemeData')
    expect(createThemeDataInterface).not.toBeNull()

    // Campo projectId NÃO deve estar presente
    const hasProjectIdField = /projectId\s*:\s*string/.test(createThemeDataInterface!)
    expect(hasProjectIdField).toBe(false)
  })
})

// ============================================================================
// FRONTEND — TYPES
// ============================================================================

describe('Frontend — Types', () => {
  let typesContent: string

  beforeAll(() => {
    const typesPath = path.join(FRONTEND_SRC_PATH, 'lib/types.ts')
    typesContent = readFile(typesPath)
  })

  // @clause CL-TYPE-001
  it('succeeds when Theme interface does not have projectId field', () => {
    const themeInterface = extractInterfaceBlock(typesContent, 'Theme')
    expect(themeInterface).not.toBeNull()

    // Campo projectId NÃO deve estar presente
    const hasProjectIdField = /projectId\s*:\s*string/.test(themeInterface!)
    expect(hasProjectIdField).toBe(false)
  })

  // @clause CL-TYPE-001 (additional check for ThemeDetailed)
  it('succeeds when ThemeDetailed interface does not have projectId field', () => {
    const themeDetailedInterface = extractInterfaceBlock(typesContent, 'ThemeDetailed')
    // ThemeDetailed extends Theme, so if it has its own fields, check them
    // But since it extends Theme, the absence in Theme is sufficient
    // Still, verify ThemeDetailed doesn't add projectId
    if (themeDetailedInterface) {
      const hasProjectIdField = /projectId\s*:\s*string/.test(themeDetailedInterface)
      expect(hasProjectIdField).toBe(false)
    }
    // ThemeDetailed exists (extends Theme)
    expect(typesContent).toMatch(/interface\s+ThemeDetailed\s+extends\s+Theme/)
  })
})

// ============================================================================
// FRONTEND — API CLIENT
// ============================================================================

describe('Frontend — API Client', () => {
  let apiContent: string

  beforeAll(() => {
    const apiPath = path.join(FRONTEND_SRC_PATH, 'lib/api.ts')
    apiContent = readFile(apiPath)
  })

  // @clause CL-API-001
  it('succeeds when api.theme.list does not receive projectId parameter', () => {
    // Procura a assinatura do método list dentro do objeto theme
    const themeSection = apiContent.match(/theme\s*:\s*\{[\s\S]*?\n\s*\},?\s*\n/m)
    expect(themeSection).not.toBeNull()

    const themeMethods = themeSection![0]

    // Assinatura deve ser: list: async () => ...
    const listHasNoParams = /list\s*:\s*async\s*\(\s*\)/.test(themeMethods)
    expect(listHasNoParams).toBe(true)

    // URL deve ser /themes (não /projects/:projectId/themes)
    const usesCorrectUrl = /\$\{API_BASE\}\/themes['"`]/.test(themeMethods)
      || /API_BASE\s*\+\s*['"`]\/themes['"`]/.test(themeMethods)
    expect(usesCorrectUrl).toBe(true)

    // NÃO deve usar /projects/
    const usesOldUrl = /\/projects\/\$\{projectId\}\/themes/.test(themeMethods)
    expect(usesOldUrl).toBe(false)
  })

  // @clause CL-API-002
  it('succeeds when api.theme.getActive does not receive projectId parameter', () => {
    const themeSection = apiContent.match(/theme\s*:\s*\{[\s\S]*?\n\s*\},?\s*\n/m)
    expect(themeSection).not.toBeNull()

    const themeMethods = themeSection![0]

    // Assinatura deve ser: getActive: async () => ...
    const getActiveHasNoParams = /getActive\s*:\s*async\s*\(\s*\)/.test(themeMethods)
    expect(getActiveHasNoParams).toBe(true)

    // URL deve conter /themes/active
    const usesCorrectUrl = /\/themes\/active/.test(themeMethods)
    expect(usesCorrectUrl).toBe(true)
  })

  // @clause CL-API-003
  it('succeeds when api.theme.create receives only preset parameter', () => {
    const themeSection = apiContent.match(/theme\s*:\s*\{[\s\S]*?\n\s*\},?\s*\n/m)
    expect(themeSection).not.toBeNull()

    const themeMethods = themeSection![0]

    // Assinatura deve ser: create: async (preset: ...) => ...
    // NÃO deve ter projectId como primeiro parâmetro
    const createHasOnlyPreset = /create\s*:\s*async\s*\(\s*preset\s*[:)]/.test(themeMethods)
    expect(createHasOnlyPreset).toBe(true)

    // NÃO deve ter (projectId, preset)
    const createHasProjectId = /create\s*:\s*async\s*\(\s*projectId/.test(themeMethods)
    expect(createHasProjectId).toBe(false)
  })

  // @clause CL-API-004
  it('succeeds when api.theme.activate receives only themeId parameter', () => {
    const themeSection = apiContent.match(/theme\s*:\s*\{[\s\S]*?\n\s*\},?\s*\n/m)
    expect(themeSection).not.toBeNull()

    const themeMethods = themeSection![0]

    // Assinatura deve ser: activate: async (themeId: ...) => ...
    const activateHasOnlyThemeId = /activate\s*:\s*async\s*\(\s*themeId\s*[:)]/.test(themeMethods)
    expect(activateHasOnlyThemeId).toBe(true)

    // NÃO deve ter (projectId, themeId)
    const activateHasProjectId = /activate\s*:\s*async\s*\(\s*projectId/.test(themeMethods)
    expect(activateHasProjectId).toBe(false)

    // URL deve ser /themes/${themeId}/activate
    const usesCorrectUrl = /\/themes\/\$\{themeId\}\/activate/.test(themeMethods)
    expect(usesCorrectUrl).toBe(true)
  })

  // @clause CL-API-005
  it('succeeds when api.theme.delete receives only themeId parameter', () => {
    const themeSection = apiContent.match(/theme\s*:\s*\{[\s\S]*?\n\s*\},?\s*\n/m)
    expect(themeSection).not.toBeNull()

    const themeMethods = themeSection![0]

    // Assinatura deve ser: delete: async (themeId: ...) => ...
    const deleteHasOnlyThemeId = /delete\s*:\s*async\s*\(\s*themeId\s*[:)]/.test(themeMethods)
    expect(deleteHasOnlyThemeId).toBe(true)

    // NÃO deve ter (projectId, themeId)
    const deleteHasProjectId = /delete\s*:\s*async\s*\(\s*projectId/.test(themeMethods)
    expect(deleteHasProjectId).toBe(false)

    // URL deve ser /themes/${themeId}
    const usesCorrectUrl = /\/themes\/\$\{themeId\}['"`]/.test(themeMethods)
    expect(usesCorrectUrl).toBe(true)
  })
})

// ============================================================================
// FRONTEND — HOOK useActiveTheme
// ============================================================================

describe('Frontend — Hook useActiveTheme', () => {
  let hookContent: string

  beforeAll(() => {
    const hookPath = path.join(FRONTEND_SRC_PATH, 'hooks/use-active-theme.ts')
    hookContent = readFile(hookPath)
  })

  // @clause CL-HOOK-001
  it('succeeds when useActiveTheme does not receive projectId parameter', () => {
    // Assinatura deve ser: export function useActiveTheme()
    const hookHasNoParams = /export\s+function\s+useActiveTheme\s*\(\s*\)/.test(hookContent)
    expect(hookHasNoParams).toBe(true)

    // NÃO deve ter projectId como parâmetro
    const hookHasProjectId = /useActiveTheme\s*\(\s*projectId/.test(hookContent)
    expect(hookHasProjectId).toBe(false)

    // Deve chamar api.theme.getActive() sem argumentos
    const callsGetActiveNoArgs = /api\.theme\.getActive\s*\(\s*\)/.test(hookContent)
    expect(callsGetActiveNoArgs).toBe(true)

    // NÃO deve ter condição if (!projectId)
    const hasProjectIdCondition = /if\s*\(\s*!projectId\s*\)/.test(hookContent)
    expect(hasProjectIdCondition).toBe(false)
  })
})

// ============================================================================
// FRONTEND — ThemeSettingsPage
// ============================================================================

describe('Frontend — ThemeSettingsPage', () => {
  let pageContent: string

  beforeAll(() => {
    const pagePath = path.join(FRONTEND_SRC_PATH, 'components/theme-settings-page.tsx')
    pageContent = readFile(pagePath)
  })

  // @clause CL-PAGE-001
  it('succeeds when ThemeSettingsPage does not receive projectId prop', () => {
    // Interface de props NÃO deve existir ou deve estar vazia
    const hasProjectIdProp = /interface\s+ThemeSettingsPageProps[\s\S]*?projectId\s*:\s*string/.test(pageContent)
    expect(hasProjectIdProp).toBe(false)

    // Assinatura deve ser: export function ThemeSettingsPage() ou ThemeSettingsPage({ })
    const componentSignature = /export\s+function\s+ThemeSettingsPage\s*\(\s*(\{\s*\})?\s*\)/.test(pageContent)
    expect(componentSignature).toBe(true)
  })

  // @clause CL-PAGE-002
  it('succeeds when ThemeSettingsPage calls api.theme.list without parameters', () => {
    // Deve chamar api.theme.list() sem argumentos
    const callsListNoArgs = /api\.theme\.list\s*\(\s*\)/.test(pageContent)
    expect(callsListNoArgs).toBe(true)

    // NÃO deve chamar api.theme.list(projectId)
    const callsListWithProjectId = /api\.theme\.list\s*\(\s*projectId\s*\)/.test(pageContent)
    expect(callsListWithProjectId).toBe(false)
  })

  // @clause CL-PAGE-003
  it('succeeds when handleApply calls api.theme.create without projectId', () => {
    // Deve chamar api.theme.create(currentPreset) ou similar sem projectId
    const callsCreateWithoutProjectId = /api\.theme\.create\s*\(\s*currentPreset\s*\)/.test(pageContent)
      || /api\.theme\.create\s*\(\s*preset\s*\)/.test(pageContent)
    expect(callsCreateWithoutProjectId).toBe(true)

    // NÃO deve chamar api.theme.create(projectId, ...)
    const callsCreateWithProjectId = /api\.theme\.create\s*\(\s*projectId\s*,/.test(pageContent)
    expect(callsCreateWithProjectId).toBe(false)
  })

  // @clause CL-PAGE-004
  it('succeeds when handleActivate calls api.theme.activate without projectId', () => {
    // Deve chamar api.theme.activate(themeId) sem projectId
    const callsActivateWithoutProjectId = /api\.theme\.activate\s*\(\s*themeId\s*\)/.test(pageContent)
      || /api\.theme\.activate\s*\(\s*[^,)]+\s*\)/.test(pageContent)
    expect(callsActivateWithoutProjectId).toBe(true)

    // NÃO deve chamar api.theme.activate(projectId, themeId)
    const callsActivateWithProjectId = /api\.theme\.activate\s*\(\s*projectId\s*,/.test(pageContent)
    expect(callsActivateWithProjectId).toBe(false)
  })

  // @clause CL-PAGE-005
  it('succeeds when handleDelete calls api.theme.delete without projectId', () => {
    // Deve chamar api.theme.delete(themeId) sem projectId
    const callsDeleteWithoutProjectId = /api\.theme\.delete\s*\(\s*themeId\s*\)/.test(pageContent)
      || /api\.theme\.delete\s*\(\s*[^,)]+\s*\)/.test(pageContent)
    expect(callsDeleteWithoutProjectId).toBe(true)

    // NÃO deve chamar api.theme.delete(projectId, themeId)
    const callsDeleteWithProjectId = /api\.theme\.delete\s*\(\s*projectId\s*,/.test(pageContent)
    expect(callsDeleteWithProjectId).toBe(false)
  })
})

// ============================================================================
// FRONTEND — App.tsx
// ============================================================================

describe('Frontend — App.tsx', () => {
  let appContent: string

  beforeAll(() => {
    const appPath = path.join(FRONTEND_SRC_PATH, 'App.tsx')
    appContent = readFile(appPath)
  })

  // @clause CL-APP-001
  it('succeeds when /settings/theme route renders ThemeSettingsPage without props', () => {
    // Deve ter rota /settings/theme
    const hasThemeRoute = /path\s*=\s*['"]\/settings\/theme['"]/.test(appContent)
    expect(hasThemeRoute).toBe(true)

    // ThemeSettingsPage deve ser renderizado sem props
    // Padrão esperado: <ThemeSettingsPage /> (auto-fechado sem props)
    const rendersWithoutProps = /<ThemeSettingsPage\s*\/>/.test(appContent)
    expect(rendersWithoutProps).toBe(true)

    // NÃO deve ter projectId="default" ou qualquer prop
    const hasProjectIdProp = /<ThemeSettingsPage\s+projectId\s*=/.test(appContent)
    expect(hasProjectIdProp).toBe(false)
  })
})

// ============================================================================
// INTEGRATION — Cross-layer consistency
// ============================================================================

describe('Integration — Cross-layer Consistency', () => {
  // @clause CL-SCHEMA-001 + CL-REPO-003 (integration check)
  it('succeeds when repository create matches schema without projectId', () => {
    const schemaContent = readFile(PRISMA_SCHEMA_PATH)
    const repoContent = readFile(path.join(SRC_PATH, 'repositories/ThemeRepository.ts'))

    // Schema não tem projectId
    const themeModel = extractModelBlock(schemaContent, 'Theme')
    const schemaHasProjectId = /projectId\s+String/.test(themeModel || '')

    // Repo create não usa projectId
    const createMethod = extractFunctionOrMethod(repoContent, 'create')
    const repoUsesProjectId = /projectId\s*:\s*data\.projectId/.test(createMethod || '')

    // Ambos devem ser false (sem projectId)
    expect(schemaHasProjectId).toBe(false)
    expect(repoUsesProjectId).toBe(false)
  })

  // @clause CL-API-001 + CL-CTRL-001 (integration check)
  it('succeeds when frontend API and backend controller are aligned', () => {
    const apiContent = readFile(path.join(FRONTEND_SRC_PATH, 'lib/api.ts'))
    const controllerContent = readFile(path.join(SRC_PATH, 'api/controllers/ThemeController.ts'))

    // Frontend api.theme.list não tem parâmetro
    const apiListNoParams = /list\s*:\s*async\s*\(\s*\)/.test(apiContent)

    // Backend listThemes não extrai projectId
    const listThemesMethod = extractFunctionOrMethod(controllerContent, 'listThemes')
    const controllerNoProjectId = !/const\s*\{\s*projectId\s*\}\s*=\s*req\.params/.test(listThemesMethod || '')

    expect(apiListNoParams).toBe(true)
    expect(controllerNoProjectId).toBe(true)
  })
})

// ============================================================================
// SAD PATH — Error scenarios
// ============================================================================

describe('Sad Path — Error Scenarios', () => {
  // @clause CL-CTRL-006
  it('fails when trying to delete active theme (controller returns error)', () => {
    const controllerContent = readFile(path.join(SRC_PATH, 'api/controllers/ThemeController.ts'))
    const deleteThemeMethod = extractFunctionOrMethod(controllerContent, 'deleteTheme')
    expect(deleteThemeMethod).not.toBeNull()

    // Controller deve verificar isActive e retornar erro
    const checksActiveAndReturnsError =
      /if\s*\(\s*theme\.isActive\s*\)[\s\S]*?status\s*\(\s*400\s*\)[\s\S]*?CANNOT_DELETE_ACTIVE_THEME/m.test(deleteThemeMethod!)
    expect(checksActiveAndReturnsError).toBe(true)
  })

  // @clause CL-SCHEMA-002
  it('fails when creating theme with duplicate name (constraint violation)', () => {
    const schemaContent = readFile(PRISMA_SCHEMA_PATH)
    const themeModel = extractModelBlock(schemaContent, 'Theme')
    expect(themeModel).not.toBeNull()

    // Constraint @@unique([name]) garante que duplicados falham
    const hasUniqueConstraint = /@@unique\(\[name\]\)/.test(themeModel!)
    expect(hasUniqueConstraint).toBe(true)
  })
})
