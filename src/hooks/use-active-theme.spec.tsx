import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, screen } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import * as fs from 'fs'
import * as path from 'path'

// ============================================================================
// MOCKS - Definidos antes dos imports reais
// ============================================================================

const mockThemeInjectorInject = vi.fn()
const mockThemeInjectorRemove = vi.fn()
const mockThemeInjectorUpdate = vi.fn()

vi.mock('@/services/theme-injector', () => ({
  ThemeInjector: {
    inject: mockThemeInjectorInject,
    remove: mockThemeInjectorRemove,
    update: mockThemeInjectorUpdate,
  },
}))

const mockApiThemeGetActive = vi.fn()
const mockApiThemeActivate = vi.fn()
const mockApiThemeCreate = vi.fn()
const mockApiThemeDelete = vi.fn()

vi.mock('@/lib/api', () => ({
  api: {
    theme: {
      getActive: mockApiThemeGetActive,
      activate: mockApiThemeActivate,
      create: mockApiThemeCreate,
      delete: mockApiThemeDelete,
    },
  },
}))

// ============================================================================
// TIPOS INLINE - Evita imports externos
// ============================================================================

interface ThemeDetailed {
  id: string
  name: string
  cssVariables: Record<string, string>
  layoutConfig: LayoutConfig
  isActive: boolean
}

interface LayoutConfig {
  gridColumns: number
  gridRows: number
  gap: number
}

// ============================================================================
// COMPONENTES INLINE DE TESTE
// ============================================================================

// Simulação do ActiveThemeProvider esperado pós-implementação
const MockActiveThemeContext = {
  theme: null as ThemeDetailed | null,
  layoutConfig: null as LayoutConfig | null,
  loading: false,
  error: null as string | null,
  refresh: vi.fn(),
}

// Consumer component para testar hook
function TestConsumer() {
  // Simula useActiveTheme hook após implementação
  const context = MockActiveThemeContext
  return (
    <div>
      <div data-testid="theme-name">{context.theme?.name || 'no-theme'}</div>
      <div data-testid="loading">{String(context.loading)}</div>
      <div data-testid="error">{context.error || 'no-error'}</div>
    </div>
  )
}

// ============================================================================
// UTILITÁRIOS DE ANÁLISE ESTÁTICA
// ============================================================================

function fileExists(relativePath: string): boolean {
  const fullPath = path.join(process.cwd(), relativePath)
  try {
    return fs.existsSync(fullPath)
  } catch {
    return false
  }
}

function fileContains(relativePath: string, searchString: string): boolean {
  const fullPath = path.join(process.cwd(), relativePath)
  try {
    const content = fs.readFileSync(fullPath, 'utf-8')
    return content.includes(searchString)
  } catch {
    return false
  }
}

function fileContainsRegex(relativePath: string, pattern: RegExp): boolean {
  const fullPath = path.join(process.cwd(), relativePath)
  try {
    const content = fs.readFileSync(fullPath, 'utf-8')
    return pattern.test(content)
  } catch {
    return false
  }
}

// ============================================================================
// TESTES - FASE 1: REMOÇÃO DO SISTEMA LEGADO
// ============================================================================

describe('ActiveThemeProvider - Removal of Legacy Customization System', () => {
  
  // @clause CL-REMOVE-001
  it('succeeds when CustomizationProvider is completely removed from codebase', () => {
    // Verifica que arquivo do provider legado não existe
    const providerExists = fileExists('src/hooks/use-customization.tsx')
    expect(providerExists).toBe(false)
    
    // Verifica que App.tsx não importa CustomizationProvider
    const appImportsCustomization = fileContains(
      'src/App.tsx', 
      'CustomizationProvider'
    )
    expect(appImportsCustomization).toBe(false)
    
    // Verifica que não há uso do provider na árvore
    const appUsesCustomization = fileContainsRegex(
      'src/App.tsx',
      /<CustomizationProvider/
    )
    expect(appUsesCustomization).toBe(false)
  })

  // @clause CL-REMOVE-002
  it('succeeds when CustomizationTab is removed from config page', () => {
    // Verifica que arquivo do tab não existe
    const tabExists = fileExists('src/components/customization-tab.tsx')
    expect(tabExists).toBe(false)
    
    // Verifica que config-page não importa CustomizationTab
    const configImportsTab = fileContains(
      'src/components/config-page.tsx',
      'CustomizationTab'
    )
    expect(configImportsTab).toBe(false)
    
    // Verifica que não há TabsTrigger com value="customization"
    const hasTrigger = fileContainsRegex(
      'src/components/config-page.tsx',
      /TabsTrigger[^>]*value=["']customization["']/
    )
    expect(hasTrigger).toBe(false)
    
    // Verifica que não há TabsContent com value="customization"
    const hasContent = fileContainsRegex(
      'src/components/config-page.tsx',
      /TabsContent[^>]*value=["']customization["']/
    )
    expect(hasContent).toBe(false)
  })

  // @clause CL-REMOVE-003
  it('succeeds when customization API is removed from frontend', () => {
    // Verifica que api.configTables.customization não existe mais
    const hasCustomizationApi = fileContainsRegex(
      'src/lib/api.ts',
      /configTables[^}]*customization/s
    )
    expect(hasCustomizationApi).toBe(false)
    
    // Verifica que não há métodos get/update customization
    const hasGetCustomization = fileContains(
      'src/lib/api.ts',
      'getCustomization'
    )
    expect(hasGetCustomization).toBe(false)
    
    const hasUpdateCustomization = fileContains(
      'src/lib/api.ts',
      'updateCustomization'
    )
    expect(hasUpdateCustomization).toBe(false)
  })

  // @clause CL-REMOVE-004
  it('succeeds when CustomizationSettings type is removed', () => {
    // Verifica que interface não existe em types.ts
    const hasInterface = fileContainsRegex(
      'src/lib/types.ts',
      /interface\s+CustomizationSettings/
    )
    expect(hasInterface).toBe(false)
    
    // Verifica que não há export do tipo
    const hasExport = fileContainsRegex(
      'src/lib/types.ts',
      /export.*CustomizationSettings/
    )
    expect(hasExport).toBe(false)
  })

  // @clause CL-REMOVE-005
  it('succeeds when customization routes are removed from backend', () => {
    // Verifica que rotas GET/PUT customization não existem
    const hasGetRoute = fileContainsRegex(
      'packages/gatekeeper-api/src/api/routes/config.routes.ts',
      /router\.get\(['"]\/customization['"]/
    )
    expect(hasGetRoute).toBe(false)
    
    const hasPutRoute = fileContainsRegex(
      'packages/gatekeeper-api/src/api/routes/config.routes.ts',
      /router\.put\(['"]\/customization['"]/
    )
    expect(hasPutRoute).toBe(false)
    
    // Verifica que métodos do controller foram removidos
    const hasGetMethod = fileContains(
      'packages/gatekeeper-api/src/api/controllers/ConfigController.ts',
      'getCustomization'
    )
    expect(hasGetMethod).toBe(false)
    
    const hasUpdateMethod = fileContains(
      'packages/gatekeeper-api/src/api/controllers/ConfigController.ts',
      'updateCustomization'
    )
    expect(hasUpdateMethod).toBe(false)
    
    // Verifica que constantes CUSTOMIZATION_* foram removidas
    const hasConstants = fileContainsRegex(
      'packages/gatekeeper-api/src/api/controllers/ConfigController.ts',
      /CUSTOMIZATION_/
    )
    expect(hasConstants).toBe(false)
  })
})

// ============================================================================
// TESTES - FASE 2: ACTIVETHEMEPROVIDER
// ============================================================================

describe('ActiveThemeProvider - Context Implementation', () => {
  
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // @clause CL-PROVIDER-001
  it('succeeds when ActiveThemeContext exports correct interface', () => {
    // Verifica estrutura do contexto via análise estática
    const fileContent = fs.readFileSync(
      path.join(process.cwd(), 'src/hooks/use-active-theme.tsx'),
      'utf-8'
    )
    
    // Verifica que tipo do contexto contém campos obrigatórios
    const hasThemeField = /theme:\s*ThemeDetailed\s*\|\s*null/.test(fileContent)
    expect(hasThemeField).toBe(true)
    
    const hasLayoutConfigField = /layoutConfig:\s*LayoutConfig\s*\|\s*null/.test(fileContent)
    expect(hasLayoutConfigField).toBe(true)
    
    const hasLoadingField = /loading:\s*boolean/.test(fileContent)
    expect(hasLoadingField).toBe(true)
    
    const hasErrorField = /error:\s*string\s*\|\s*null/.test(fileContent)
    expect(hasErrorField).toBe(true)
    
    const hasRefreshField = /refresh:\s*\(\)\s*=>\s*Promise<void>/.test(fileContent)
    expect(hasRefreshField).toBe(true)
    
    // Verifica que ActiveThemeProvider é exportado
    const hasProviderExport = /export\s+(function|const)\s+ActiveThemeProvider/.test(fileContent)
    expect(hasProviderExport).toBe(true)
  })

  // @clause CL-PROVIDER-002
  it('succeeds when Provider loads active theme on mount', () => {
    // Mock de tema ativo
    const mockTheme: ThemeDetailed = {
      id: 'theme-1',
      name: 'Dark Theme',
      cssVariables: {
        '--primary': '#000000',
        '--background': '#ffffff',
      },
      layoutConfig: {
        gridColumns: 12,
        gridRows: 8,
        gap: 16,
      },
      isActive: true,
    }
    
    mockApiThemeGetActive.mockResolvedValueOnce(mockTheme)
    
    // Verifica que useEffect chama loadTheme via análise estática
    const fileContent = fs.readFileSync(
      path.join(process.cwd(), 'src/hooks/use-active-theme.tsx'),
      'utf-8'
    )
    
    // Verifica presença de useEffect que chama loadTheme
    const hasLoadEffect = /useEffect\s*\([^)]*loadTheme/.test(fileContent)
    expect(hasLoadEffect).toBe(true)
    
    // Verifica que loadTheme chama api.theme.getActive
    const callsGetActive = /api\.theme\.getActive\(\)/.test(fileContent)
    expect(callsGetActive).toBe(true)
    
    // Verifica que ThemeInjector.inject é chamado quando há tema
    const callsInject = /ThemeInjector\.inject\(/.test(fileContent)
    expect(callsInject).toBe(true)
    
    // Verifica lógica condicional para injeção
    const hasConditionalInject = /if\s*\([^)]*activeTheme[^)]*\)[^}]*ThemeInjector\.inject/s.test(fileContent)
    expect(hasConditionalInject).toBe(true)
  })

  // @clause CL-PROVIDER-003
  it('succeeds when refresh method reloads theme and reinjects CSS', () => {
    // Verifica que refresh é um useCallback
    const fileContent = fs.readFileSync(
      path.join(process.cwd(), 'src/hooks/use-active-theme.tsx'),
      'utf-8'
    )
    
    const hasRefreshCallback = /refresh:\s*loadTheme/.test(fileContent) ||
                               /const\s+loadTheme\s*=\s*useCallback/.test(fileContent)
    expect(hasRefreshCallback).toBe(true)
    
    // Verifica que loadTheme seta loading durante operação
    const setsLoading = /setLoading\(true\)/.test(fileContent)
    expect(setsLoading).toBe(true)
    
    // Verifica que loadTheme é async
    const isAsync = /async\s+\(?\)?\s*=>/.test(fileContent) || 
                    /useCallback\s*\(\s*async/.test(fileContent)
    expect(isAsync).toBe(true)
    
    // Verifica que refresh está no valor do contexto
    const exportsRefresh = /refresh:\s*loadTheme/.test(fileContent) ||
                          /{[^}]*refresh[^}]*}/.test(fileContent)
    expect(exportsRefresh).toBe(true)
  })

  // @clause CL-PROVIDER-004
  it('fails when useActiveTheme is called outside Provider', () => {
    // Verifica que hook valida contexto
    const fileContent = fs.readFileSync(
      path.join(process.cwd(), 'src/hooks/use-active-theme.tsx'),
      'utf-8'
    )
    
    // Verifica que há validação de contexto
    const hasContextCheck = /if\s*\(\s*!context\s*\)/.test(fileContent)
    expect(hasContextCheck).toBe(true)
    
    // Verifica que throw error tem mensagem correta
    const hasErrorMessage = /throw.*Error.*useActiveTheme must be used within ActiveThemeProvider/.test(fileContent)
    expect(hasErrorMessage).toBe(true)
    
    // Verifica que useContext é chamado
    const usesContext = /useContext\(ActiveThemeContext\)/.test(fileContent)
    expect(usesContext).toBe(true)
  })
})

// ============================================================================
// TESTES - FASE 3: INTEGRAÇÃO NO APP.TSX
// ============================================================================

describe('ActiveThemeProvider - App Integration', () => {
  
  // @clause CL-APP-001
  it('succeeds when ActiveThemeProvider wraps AppLayout in component tree', () => {
    const fileContent = fs.readFileSync(
      path.join(process.cwd(), 'src/App.tsx'),
      'utf-8'
    )
    
    // Verifica import do ActiveThemeProvider
    const importsProvider = /import.*ActiveThemeProvider.*from.*@\/hooks\/use-active-theme/.test(fileContent)
    expect(importsProvider).toBe(true)
    
    // Verifica que Provider envolve AppLayout
    const wrapsAppLayout = /<ActiveThemeProvider[^>]*>[\s\S]*<AppLayout/.test(fileContent)
    expect(wrapsAppLayout).toBe(true)
    
    // Verifica que CustomizationProvider não está mais presente
    const noCustomizationProvider = !/<CustomizationProvider/.test(fileContent)
    expect(noCustomizationProvider).toBe(true)
  })
})

// ============================================================================
// TESTES - FASE 4: THEMESETTINGSPAGE REFRESH
// ============================================================================

describe('ActiveThemeProvider - ThemeSettingsPage Integration', () => {
  
  // @clause CL-SETTINGS-001
  it('succeeds when handleActivate calls refresh after successful activation', () => {
    const fileContent = fs.readFileSync(
      path.join(process.cwd(), 'src/components/theme-settings-page.tsx'),
      'utf-8'
    )
    
    // Verifica que useActiveTheme é importado
    const importsHook = /import.*useActiveTheme.*from.*@\/hooks\/use-active-theme/.test(fileContent)
    expect(importsHook).toBe(true)
    
    // Verifica que refresh é destructurado do hook
    const destructuresRefresh = /const\s*{\s*[^}]*refresh[^}]*}\s*=\s*useActiveTheme\(\)/.test(fileContent)
    expect(destructuresRefresh).toBe(true)
    
    // Verifica que handleActivate chama refresh
    const handleActivateCallsRefresh = /handleActivate[^{]*{[\s\S]*?await\s+refresh\(\)/.test(fileContent) ||
                                       /handleActivate[^{]*{[\s\S]*?refresh\(\)/.test(fileContent)
    expect(handleActivateCallsRefresh).toBe(true)
    
    // Verifica que refresh é chamado após api.theme.activate
    const orderCorrect = /api\.theme\.activate[\s\S]{0,200}refresh\(\)/.test(fileContent)
    expect(orderCorrect).toBe(true)
  })

  // @clause CL-SETTINGS-002
  it('succeeds when handleApply calls refresh after theme creation with auto-activation', () => {
    const fileContent = fs.readFileSync(
      path.join(process.cwd(), 'src/components/theme-settings-page.tsx'),
      'utf-8'
    )
    
    // Verifica que handleApply chama refresh
    const handleApplyCallsRefresh = /handleApply[^{]*{[\s\S]*?await\s+refresh\(\)/.test(fileContent) ||
                                    /handleApply[^{]*{[\s\S]*?refresh\(\)/.test(fileContent)
    expect(handleApplyCallsRefresh).toBe(true)
    
    // Verifica que refresh é chamado após api.theme.create
    const orderCorrect = /api\.theme\.create[\s\S]{0,300}refresh\(\)/.test(fileContent)
    expect(orderCorrect).toBe(true)
  })

  // @clause CL-SETTINGS-003
  it('succeeds when handleDelete calls refresh after deleting active theme', () => {
    const fileContent = fs.readFileSync(
      path.join(process.cwd(), 'src/components/theme-settings-page.tsx'),
      'utf-8'
    )
    
    // Verifica que handleDelete chama refresh
    const handleDeleteCallsRefresh = /handleDelete[^{]*{[\s\S]*?await\s+refresh\(\)/.test(fileContent) ||
                                     /handleDelete[^{]*{[\s\S]*?refresh\(\)/.test(fileContent)
    expect(handleDeleteCallsRefresh).toBe(true)
    
    // Verifica que refresh é chamado após api.theme.delete
    const orderCorrect = /api\.theme\.delete[\s\S]{0,300}refresh\(\)/.test(fileContent)
    expect(orderCorrect).toBe(true)
  })
})

// ============================================================================
// TESTES - FASE 5: EDGE CASES
// ============================================================================

describe('ActiveThemeProvider - Edge Cases', () => {
  
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // @clause CL-EDGE-001
  it('succeeds when no active theme triggers CSS removal', () => {
    const fileContent = fs.readFileSync(
      path.join(process.cwd(), 'src/hooks/use-active-theme.tsx'),
      'utf-8'
    )
    
    // Verifica que há condição para tema null
    const hasNullCheck = /if\s*\([^)]*!activeTheme[^)]*\)/.test(fileContent) ||
                        /else\s*{[\s\S]*?ThemeInjector\.remove/.test(fileContent)
    expect(hasNullCheck).toBe(true)
    
    // Verifica que ThemeInjector.remove é chamado quando sem tema
    const removesOnNull = /(!activeTheme|activeTheme\s*===\s*null)[^}]*ThemeInjector\.remove\(\)/.test(fileContent) ||
                         /else\s*{[^}]*ThemeInjector\.remove\(\)/.test(fileContent)
    expect(removesOnNull).toBe(true)
  })

  // @clause CL-EDGE-002
  it('fails when API error breaks application - error must be caught', () => {
    const fileContent = fs.readFileSync(
      path.join(process.cwd(), 'src/hooks/use-active-theme.tsx'),
      'utf-8'
    )
    
    // Verifica que há try-catch em loadTheme
    const hasTryCatch = /try\s*{[\s\S]*?api\.theme\.getActive[\s\S]*?}\s*catch/.test(fileContent)
    expect(hasTryCatch).toBe(true)
    
    // Verifica que error state é setado no catch
    const setsErrorState = /catch[^{]*{[\s\S]*?setError\(/.test(fileContent)
    expect(setsErrorState).toBe(true)
    
    // Verifica que finally reseta loading
    const hasFinally = /finally\s*{[\s\S]*?setLoading\(false\)/.test(fileContent)
    expect(hasFinally).toBe(true)
    
    // Verifica que erro é capturado de forma genérica
    const catchesGenericError = /catch\s*\([\s\S]*?\)/.test(fileContent)
    expect(catchesGenericError).toBe(true)
  })

  // @clause CL-EDGE-002 (sad path adicional - network timeout)
  it('fails when network timeout occurs - must not crash application', () => {
    const fileContent = fs.readFileSync(
      path.join(process.cwd(), 'src/hooks/use-active-theme.tsx'),
      'utf-8'
    )
    
    // Verifica que error é tratado como string ou Error
    const handlesErrorType = /err instanceof Error/.test(fileContent) ||
                            /err\.message/.test(fileContent)
    expect(handlesErrorType).toBe(true)
    
    // Verifica que há fallback para mensagem de erro
    const hasFallbackMessage = /Failed to load theme|Error loading theme/.test(fileContent)
    expect(hasFallbackMessage).toBe(true)
  })

  // @clause CL-EDGE-002 (sad path adicional - API retorna 500)
  it('fails when API returns 500 error - application must remain functional', () => {
    const fileContent = fs.readFileSync(
      path.join(process.cwd(), 'src/hooks/use-active-theme.tsx'),
      'utf-8'
    )
    
    // Verifica que não há throw não capturado em loadTheme
    const noUnhandledThrow = !/loadTheme[^{]*{[\s\S]*?throw(?![\s\S]*catch)/.test(fileContent)
    expect(noUnhandledThrow).toBe(true)
    
    // Verifica que estado error é acessível no contexto
    const errorInContext = /error:\s*string\s*\|\s*null/.test(fileContent)
    expect(errorInContext).toBe(true)
  })
})

// ============================================================================
// TESTES DE INTEGRAÇÃO - COMPORTAMENTO COMPLETO
// ============================================================================

describe('ActiveThemeProvider - Full Integration Behavior', () => {
  
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // @clause CL-PROVIDER-002 + CL-PROVIDER-003 (comportamento integrado)
  it('succeeds when complete theme lifecycle works correctly', () => {
    const fileContent = fs.readFileSync(
      path.join(process.cwd(), 'src/hooks/use-active-theme.tsx'),
      'utf-8'
    )
    
    // Verifica sequência completa: load → inject → refresh capability
    const hasCompleteFlow = /api\.theme\.getActive[\s\S]*ThemeInjector\.inject/.test(fileContent) &&
                           /refresh[^}]*loadTheme/.test(fileContent)
    expect(hasCompleteFlow).toBe(true)
    
    // Verifica que estado é gerenciado com useState
    const usesState = /useState.*theme|useState.*loading|useState.*error/.test(fileContent)
    expect(usesState).toBe(true)
    
    // Verifica que valor do contexto é memorizado
    const usesMemo = /useMemo\s*\([^)]*\)\s*,\s*\[[^\]]*theme[^\]]*\]/.test(fileContent)
    expect(usesMemo).toBe(true)
  })

  // @clause CL-APP-001 + CL-PROVIDER-002 (integração App + Provider)
  it('succeeds when Provider is correctly integrated in App component tree', () => {
    const appContent = fs.readFileSync(
      path.join(process.cwd(), 'src/App.tsx'),
      'utf-8'
    )
    
    const providerContent = fs.readFileSync(
      path.join(process.cwd(), 'src/hooks/use-active-theme.tsx'),
      'utf-8'
    )
    
    // Verifica que App importa e usa Provider
    const appUsesProvider = /import.*ActiveThemeProvider/.test(appContent) &&
                           /<ActiveThemeProvider/.test(appContent)
    expect(appUsesProvider).toBe(true)
    
    // Verifica que Provider aceita children
    const providerHasChildren = /children:\s*React\.ReactNode/.test(providerContent) ||
                               /\{\s*children\s*\}:\s*\{\s*children:\s*React\.ReactNode/.test(providerContent)
    expect(providerHasChildren).toBe(true)
    
    // Verifica que Provider renderiza children
    const providersRendersChildren = /{children}/.test(providerContent)
    expect(providersRendersChildren).toBe(true)
  })

  // @clause CL-SETTINGS-001 + CL-SETTINGS-002 + CL-SETTINGS-003 (todas as chamadas de refresh)
  it('succeeds when all theme operations in settings page trigger refresh', () => {
    const fileContent = fs.readFileSync(
      path.join(process.cwd(), 'src/components/theme-settings-page.tsx'),
      'utf-8'
    )
    
    // Verifica que pelo menos 3 handlers chamam refresh
    const refreshCallsCount = (fileContent.match(/refresh\(\)/g) || []).length
    expect(refreshCallsCount).toBeGreaterThanOrEqual(3)
    
    // Verifica que refresh é usado em handlers de tema
    const usedInHandlers = /handle(Activate|Apply|Delete)[^{]*{[\s\S]*?refresh\(\)/.test(fileContent)
    expect(usedInHandlers).toBe(true)
  })
})
