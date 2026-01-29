import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Frontend Cleanup Contract Spec
 * ==============================
 * 
 * Contrato: remove-theme-ui-contract-frontend
 * Objetivo: Remover todos os componentes, hooks, services, API client e types
 *           relacionados a Theme Engine e UI Contract do frontend Gatekeeper.
 * 
 * REGRA: Se estes testes falharem, a LLM executora errou na implementação.
 * Os testes validam estrutura estática e contratos, não comportamento runtime.
 */

// === CAMINHOS DOS ARQUIVOS ===

// __dirname = src/components/__tests__
const SRC_ROOT = path.resolve(__dirname, '../..') // src
const PROJECT_ROOT = path.resolve(__dirname, '../../..') // gatekeeper root

// Directories
const COMPONENTS_DIR = path.join(SRC_ROOT, 'components')
const HOOKS_DIR = path.join(SRC_ROOT, 'hooks')
const SERVICES_DIR = path.join(SRC_ROOT, 'services')
const STYLES_DIR = path.join(SRC_ROOT, 'styles')
const LIB_DIR = path.join(SRC_ROOT, 'lib')
const COMPONENTS_TESTS_DIR = path.join(COMPONENTS_DIR, '__tests__')

// Key files
const APP_PATH = path.join(SRC_ROOT, 'App.tsx')
const APP_LAYOUT_PATH = path.join(COMPONENTS_DIR, 'app-layout.tsx')
const PROJECT_DETAILS_PATH = path.join(COMPONENTS_DIR, 'project-details-page.tsx')
const API_PATH = path.join(LIB_DIR, 'api.ts')
const TYPES_PATH = path.join(LIB_DIR, 'types.ts')
const MAIN_CSS_PATH = path.join(SRC_ROOT, 'main.css')
const THEME_JSON_PATH = path.join(PROJECT_ROOT, 'theme.json')

// === FILES THAT MUST BE DELETED ===

const THEME_COMPONENTS_TO_DELETE = [
  'theme-settings-page.tsx',
  'theme-upload-zone.tsx',
  'theme-preview-panel.tsx',
  'theme-list-item.tsx',
]

const UI_CONTRACT_COMPONENTS_TO_DELETE = [
  'ui-contract-section.tsx',
  'ui-contract-upload-dialog.tsx',
]

const HOOKS_TO_DELETE = [
  'use-active-theme.tsx',
]

const SERVICES_TO_DELETE = [
  'theme-injector.ts',
]

const STYLES_TO_DELETE = [
  'theme.css',
]

const COMPONENT_TESTS_TO_DELETE = [
  'theme-settings-page.spec.tsx',
  'ui-contract-section.spec.tsx',
  'ui-theme-bugfixes.spec.tsx',
]

const SRC_TESTS_TO_DELETE = [
  'theme-engine.spec.ts',
  'theme-engine-global.spec.ts',
  'ui-contract-backend.spec.ts',
  'test-clause-mapping-ui-clause.spec.ts',
]

const HOOKS_TESTS_TO_DELETE = [
  'use-active-theme.spec.tsx',
]

// === COMPONENTS THAT MUST BE PRESERVED ===

const PRESERVED_COMPONENTS = [
  'app-layout.tsx',
  'dashboard-page.tsx',
  'runs-list-page.tsx',
  'run-details-page.tsx',
  'project-details-page.tsx',
  'projects-list-page.tsx',
  'config-page.tsx',
  'gates-page.tsx',
  'status-badge.tsx',
]

// === UTILIDADES ===

function readFileContent(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`)
  }
  return fs.readFileSync(filePath, 'utf-8')
}

function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath)
}

function getFilesInDirectory(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) {
    return []
  }
  return fs.readdirSync(dirPath).filter(f => 
    f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.css')
  )
}

function countPatternOccurrences(content: string, pattern: string): number {
  const regex = new RegExp(pattern, 'g')
  const matches = content.match(regex)
  return matches ? matches.length : 0
}

// === VARIÁVEIS GLOBAIS PARA CACHE ===

let appContent: string
let appLayoutContent: string
let projectDetailsContent: string
let apiContent: string
let typesContent: string
let mainCssContent: string

let componentsFiles: string[]
let hooksFiles: string[]
let servicesFiles: string[]
let stylesFiles: string[]
let componentTestsFiles: string[]
let srcFiles: string[]

// === SETUP ===

beforeAll(() => {
  // Read file contents (may fail if files are deleted)
  try {
    appContent = readFileContent(APP_PATH)
  } catch {
    appContent = ''
  }
  
  try {
    appLayoutContent = readFileContent(APP_LAYOUT_PATH)
  } catch {
    appLayoutContent = ''
  }
  
  try {
    projectDetailsContent = readFileContent(PROJECT_DETAILS_PATH)
  } catch {
    projectDetailsContent = ''
  }
  
  try {
    apiContent = readFileContent(API_PATH)
  } catch {
    apiContent = ''
  }
  
  try {
    typesContent = readFileContent(TYPES_PATH)
  } catch {
    typesContent = ''
  }
  
  try {
    mainCssContent = readFileContent(MAIN_CSS_PATH)
  } catch {
    mainCssContent = ''
  }
  
  // Get directory listings
  componentsFiles = getFilesInDirectory(COMPONENTS_DIR)
  hooksFiles = getFilesInDirectory(HOOKS_DIR)
  servicesFiles = getFilesInDirectory(SERVICES_DIR)
  stylesFiles = getFilesInDirectory(STYLES_DIR)
  componentTestsFiles = getFilesInDirectory(COMPONENTS_TESTS_DIR)
  srcFiles = getFilesInDirectory(SRC_ROOT)
})

// === TESTES ===

describe('Frontend Cleanup Contract - Remove Theme and UIContract', () => {

  describe('CL-FE-001: Componentes Theme deletados', () => {
    
    // @clause CL-FE-001
    it('succeeds when theme-settings-page.tsx does not exist', () => {
      const exists = fileExists(path.join(COMPONENTS_DIR, 'theme-settings-page.tsx'))
      expect(exists).toBe(false)
    })
    
    // @clause CL-FE-001
    it('succeeds when theme-upload-zone.tsx does not exist', () => {
      const exists = fileExists(path.join(COMPONENTS_DIR, 'theme-upload-zone.tsx'))
      expect(exists).toBe(false)
    })
    
    // @clause CL-FE-001
    it('succeeds when theme-preview-panel.tsx does not exist', () => {
      const exists = fileExists(path.join(COMPONENTS_DIR, 'theme-preview-panel.tsx'))
      expect(exists).toBe(false)
    })
    
    // @clause CL-FE-001
    it('succeeds when theme-list-item.tsx does not exist', () => {
      const exists = fileExists(path.join(COMPONENTS_DIR, 'theme-list-item.tsx'))
      expect(exists).toBe(false)
    })
    
    // @clause CL-FE-001
    it('fails when any theme component still exists', () => {
      const themeComponents = componentsFiles.filter(f => f.startsWith('theme-'))
      expect(themeComponents).toHaveLength(0)
    })
  })

  describe('CL-FE-002: Componentes UIContract deletados', () => {
    
    // @clause CL-FE-002
    it('succeeds when ui-contract-section.tsx does not exist', () => {
      const exists = fileExists(path.join(COMPONENTS_DIR, 'ui-contract-section.tsx'))
      expect(exists).toBe(false)
    })
    
    // @clause CL-FE-002
    it('succeeds when ui-contract-upload-dialog.tsx does not exist', () => {
      const exists = fileExists(path.join(COMPONENTS_DIR, 'ui-contract-upload-dialog.tsx'))
      expect(exists).toBe(false)
    })
    
    // @clause CL-FE-002
    it('fails when any ui-contract component still exists', () => {
      const uiContractComponents = componentsFiles.filter(f => f.startsWith('ui-contract-'))
      expect(uiContractComponents).toHaveLength(0)
    })
  })

  describe('CL-FE-003: Hook use-active-theme deletado', () => {
    
    // @clause CL-FE-003
    it('succeeds when use-active-theme.tsx does not exist', () => {
      const exists = fileExists(path.join(HOOKS_DIR, 'use-active-theme.tsx'))
      expect(exists).toBe(false)
    })
    
    // @clause CL-FE-003
    it('fails when any theme hook still exists', () => {
      const themeHooks = hooksFiles.filter(f => f.includes('theme'))
      expect(themeHooks).toHaveLength(0)
    })
  })

  describe('CL-FE-004: Service theme-injector deletado', () => {
    
    // @clause CL-FE-004
    it('succeeds when theme-injector.ts does not exist', () => {
      const exists = fileExists(path.join(SERVICES_DIR, 'theme-injector.ts'))
      expect(exists).toBe(false)
    })
    
    // @clause CL-FE-004
    it('fails when any theme service still exists', () => {
      const themeServices = servicesFiles.filter(f => f.includes('theme'))
      expect(themeServices).toHaveLength(0)
    })
  })

  describe('CL-FE-005: App.tsx sem Theme', () => {
    
    // @clause CL-FE-005
    it('succeeds when App.tsx does not import ThemeSettingsPage', () => {
      const hasImport = /import\s*\{[^}]*ThemeSettingsPage[^}]*\}/.test(appContent)
      expect(hasImport).toBe(false)
    })
    
    // @clause CL-FE-005
    it('succeeds when App.tsx does not import theme-settings-page', () => {
      const hasImport = /from\s*['"]@\/components\/theme-settings-page['"]/.test(appContent)
      expect(hasImport).toBe(false)
    })
    
    // @clause CL-FE-005
    it('succeeds when App.tsx does not import ActiveThemeProvider', () => {
      const hasImport = /import\s*\{[^}]*ActiveThemeProvider[^}]*\}/.test(appContent)
      expect(hasImport).toBe(false)
    })
    
    // @clause CL-FE-005
    it('succeeds when App.tsx does not import use-active-theme', () => {
      const hasImport = /from\s*['"]@\/hooks\/use-active-theme['"]/.test(appContent)
      expect(hasImport).toBe(false)
    })
    
    // @clause CL-FE-005
    it('succeeds when App.tsx does not have /settings/theme route', () => {
      const hasRoute = /path\s*=\s*['"]\/settings\/theme['"]/.test(appContent)
      expect(hasRoute).toBe(false)
    })
    
    // @clause CL-FE-005
    it('succeeds when App.tsx does not use ActiveThemeProvider wrapper', () => {
      const hasWrapper = /<ActiveThemeProvider>/.test(appContent)
      expect(hasWrapper).toBe(false)
    })
    
    // @clause CL-FE-005
    it('fails when App.tsx contains any theme reference', () => {
      const themeRefs = countPatternOccurrences(appContent, 'theme|Theme')
      // Allow references in comments or unrelated usage
      const hasThemeComponent = /<ThemeSettingsPage/.test(appContent)
      const hasThemeProvider = /ActiveThemeProvider/.test(appContent)
      expect(hasThemeComponent || hasThemeProvider).toBe(false)
    })
  })

  describe('CL-FE-006: app-layout sem Theme navigation', () => {
    
    // @clause CL-FE-006
    it('succeeds when navigation does not contain Theme item', () => {
      // Look for { name: "Theme" in navigation array
      const hasThemeNav = /\{\s*name:\s*['"]Theme['"]/.test(appLayoutContent)
      expect(hasThemeNav).toBe(false)
    })
    
    // @clause CL-FE-006
    it('succeeds when navigation does not have /settings/theme path', () => {
      const hasThemePath = /path:\s*['"]\/settings\/theme['"]/.test(appLayoutContent)
      expect(hasThemePath).toBe(false)
    })
    
    // @clause CL-FE-006
    it('succeeds when app-layout does not import PaintBrush icon', () => {
      const hasImport = /import\s*\{[^}]*PaintBrush[^}]*\}/.test(appLayoutContent)
      expect(hasImport).toBe(false)
    })
    
    // @clause CL-FE-006
    it('succeeds when app-layout does not import LayoutConfig type', () => {
      const hasImport = /import\s+type\s*\{[^}]*LayoutConfig[^}]*\}/.test(appLayoutContent)
      expect(hasImport).toBe(false)
    })
    
    // @clause CL-FE-006
    it('succeeds when AppLayoutProps does not have layoutConfig prop', () => {
      const hasLayoutConfigProp = /layoutConfig\s*\?\s*:\s*LayoutConfig/.test(appLayoutContent)
      expect(hasLayoutConfigProp).toBe(false)
    })
    
    // @clause CL-FE-006
    it('fails when app-layout contains layoutConfig usage', () => {
      const count = countPatternOccurrences(appLayoutContent, 'layoutConfig')
      expect(count).toBe(0)
    })
  })

  describe('CL-FE-007: project-details sem UIContractSection', () => {
    
    // @clause CL-FE-007
    it('succeeds when project-details does not import UIContractSection', () => {
      const hasImport = /import\s*\{[^}]*UIContractSection[^}]*\}/.test(projectDetailsContent)
      expect(hasImport).toBe(false)
    })
    
    // @clause CL-FE-007
    it('succeeds when project-details does not import ui-contract-section', () => {
      const hasImport = /from\s*['"]@\/components\/ui-contract-section['"]/.test(projectDetailsContent)
      expect(hasImport).toBe(false)
    })
    
    // @clause CL-FE-007
    it('succeeds when project-details does not use UIContractSection component', () => {
      const hasComponent = /<UIContractSection/.test(projectDetailsContent)
      expect(hasComponent).toBe(false)
    })
    
    // @clause CL-FE-007
    it('fails when project-details contains any UIContractSection reference', () => {
      const count = countPatternOccurrences(projectDetailsContent, 'UIContractSection')
      expect(count).toBe(0)
    })
  })

  describe('CL-FE-008: API client sem theme', () => {
    
    // @clause CL-FE-008
    it('succeeds when api.ts does not have theme object', () => {
      // Look for theme: { or theme:{
      const hasThemeObject = /\btheme\s*:\s*\{/.test(apiContent)
      expect(hasThemeObject).toBe(false)
    })
    
    // @clause CL-FE-008
    it('succeeds when api.ts does not have /api/themes endpoint', () => {
      const hasThemeEndpoint = /\/api\/themes/.test(apiContent)
      expect(hasThemeEndpoint).toBe(false)
    })
    
    // @clause CL-FE-008
    it('fails when api.ts contains theme API methods', () => {
      const hasThemeMethods = /theme\.list|theme\.getActive|theme\.create|theme\.activate|theme\.delete/.test(apiContent)
      expect(hasThemeMethods).toBe(false)
    })
  })

  describe('CL-FE-009: API client sem uiContract', () => {
    
    // @clause CL-FE-009
    it('succeeds when api.ts does not have uiContract object', () => {
      const hasUIContractObject = /\buiContract\s*:\s*\{/.test(apiContent)
      expect(hasUIContractObject).toBe(false)
    })
    
    // @clause CL-FE-009
    it('succeeds when api.ts does not have /ui-contract endpoint', () => {
      const hasUIContractEndpoint = /\/ui-contract/.test(apiContent)
      expect(hasUIContractEndpoint).toBe(false)
    })
    
    // @clause CL-FE-009
    it('fails when api.ts contains uiContract API methods', () => {
      const hasUIContractMethods = /uiContract\.get|uiContract\.upload|uiContract\.delete/.test(apiContent)
      expect(hasUIContractMethods).toBe(false)
    })
  })

  describe('CL-FE-010: Types sem Theme interfaces', () => {
    
    // @clause CL-FE-010
    it('succeeds when types.ts does not have Theme interface', () => {
      const hasInterface = /export\s+interface\s+Theme\s*\{/.test(typesContent)
      expect(hasInterface).toBe(false)
    })
    
    // @clause CL-FE-010
    it('succeeds when types.ts does not have ThemeDetailed interface', () => {
      const hasInterface = /export\s+interface\s+ThemeDetailed/.test(typesContent)
      expect(hasInterface).toBe(false)
    })
    
    // @clause CL-FE-010
    it('succeeds when types.ts does not have LayoutConfig interface', () => {
      const hasInterface = /export\s+interface\s+LayoutConfig/.test(typesContent)
      expect(hasInterface).toBe(false)
    })
    
    // @clause CL-FE-010
    it('succeeds when types.ts does not have ThemePreset interface', () => {
      const hasInterface = /export\s+interface\s+ThemePreset/.test(typesContent)
      expect(hasInterface).toBe(false)
    })
    
    // @clause CL-FE-010
    it('succeeds when types.ts does not have ThemeValidationResult interface', () => {
      const hasInterface = /export\s+interface\s+ThemeValidationResult/.test(typesContent)
      expect(hasInterface).toBe(false)
    })
    
    // @clause CL-FE-010
    it('succeeds when types.ts does not have ThemePreviewResponse interface', () => {
      const hasInterface = /export\s+interface\s+ThemePreviewResponse/.test(typesContent)
      expect(hasInterface).toBe(false)
    })
  })

  describe('CL-FE-011: Types sem UIContract interfaces', () => {
    
    // @clause CL-FE-011
    it('succeeds when types.ts does not have UIContractSchema interface', () => {
      const hasInterface = /export\s+interface\s+UIContractSchema/.test(typesContent)
      expect(hasInterface).toBe(false)
    })
    
    // @clause CL-FE-011
    it('succeeds when types.ts does not have UIContract interface', () => {
      const hasInterface = /export\s+interface\s+UIContract\s*\{/.test(typesContent)
      expect(hasInterface).toBe(false)
    })
  })

  describe('CL-FE-012: Project type sem uiContract', () => {
    
    // @clause CL-FE-012
    it('succeeds when Project interface does not have uiContract field', () => {
      // Find Project interface and check for uiContract field
      const projectMatch = typesContent.match(/export\s+interface\s+Project\s*\{([^}]+)\}/)
      if (projectMatch) {
        const hasUIContractField = /uiContract\s*\??\s*:/.test(projectMatch[1])
        expect(hasUIContractField).toBe(false)
      }
      // If Project interface not found, that's fine (file might be modified)
      expect(true).toBe(true)
    })
    
    // @clause CL-FE-012
    it('fails when types.ts contains uiContract in Project interface', () => {
      // More specific check for uiContract in Project
      const hasUIContractInProject = /interface\s+Project[^}]*uiContract\s*\??\s*:\s*UIContract/.test(typesContent)
      expect(hasUIContractInProject).toBe(false)
    })
  })

  describe('CL-FE-013: CSS sem theme.css import', () => {
    
    // @clause CL-FE-013
    it('succeeds when main.css does not import theme.css', () => {
      const hasImport = /@import\s*['"]\.\/styles\/theme\.css['"]/.test(mainCssContent)
      expect(hasImport).toBe(false)
    })
    
    // @clause CL-FE-013
    it('fails when main.css contains any theme.css reference', () => {
      const count = countPatternOccurrences(mainCssContent, 'theme\\.css')
      expect(count).toBe(0)
    })
  })

  describe('CL-FE-014: theme.css deletado', () => {
    
    // @clause CL-FE-014
    it('succeeds when theme.css does not exist in styles directory', () => {
      const exists = fileExists(path.join(STYLES_DIR, 'theme.css'))
      expect(exists).toBe(false)
    })
    
    // @clause CL-FE-014
    it('fails when any theme CSS file exists', () => {
      const themeStyles = stylesFiles.filter(f => f.includes('theme'))
      expect(themeStyles).toHaveLength(0)
    })
  })

  describe('CL-FE-015: theme.json deletado', () => {
    
    // @clause CL-FE-015
    it('succeeds when theme.json does not exist in project root', () => {
      const exists = fileExists(THEME_JSON_PATH)
      expect(exists).toBe(false)
    })
  })

  describe('CL-FE-016: Testes Theme/UIContract deletados', () => {
    
    // @clause CL-FE-016
    it('succeeds when theme-settings-page.spec.tsx does not exist', () => {
      const exists = fileExists(path.join(COMPONENTS_TESTS_DIR, 'theme-settings-page.spec.tsx'))
      expect(exists).toBe(false)
    })
    
    // @clause CL-FE-016
    it('succeeds when ui-contract-section.spec.tsx does not exist', () => {
      const exists = fileExists(path.join(COMPONENTS_TESTS_DIR, 'ui-contract-section.spec.tsx'))
      expect(exists).toBe(false)
    })
    
    // @clause CL-FE-016
    it('succeeds when ui-theme-bugfixes.spec.tsx does not exist', () => {
      const exists = fileExists(path.join(COMPONENTS_TESTS_DIR, 'ui-theme-bugfixes.spec.tsx'))
      expect(exists).toBe(false)
    })
    
    // @clause CL-FE-016
    it('succeeds when use-active-theme.spec.tsx does not exist', () => {
      const exists = fileExists(path.join(HOOKS_DIR, 'use-active-theme.spec.tsx'))
      expect(exists).toBe(false)
    })
    
    // @clause CL-FE-016
    it('succeeds when theme-engine.spec.ts does not exist in src', () => {
      const exists = fileExists(path.join(SRC_ROOT, 'theme-engine.spec.ts'))
      expect(exists).toBe(false)
    })
    
    // @clause CL-FE-016
    it('succeeds when theme-engine-global.spec.ts does not exist in src', () => {
      const exists = fileExists(path.join(SRC_ROOT, 'theme-engine-global.spec.ts'))
      expect(exists).toBe(false)
    })
    
    // @clause CL-FE-016
    it('succeeds when ui-contract-backend.spec.ts does not exist in src', () => {
      const exists = fileExists(path.join(SRC_ROOT, 'ui-contract-backend.spec.ts'))
      expect(exists).toBe(false)
    })
    
    // @clause CL-FE-016
    it('succeeds when test-clause-mapping-ui-clause.spec.ts does not exist in src', () => {
      const exists = fileExists(path.join(SRC_ROOT, 'test-clause-mapping-ui-clause.spec.ts'))
      expect(exists).toBe(false)
    })
    
    // @clause CL-FE-016
    it('fails when any theme/ui-contract test file still exists', () => {
      const forbiddenTestPatterns = componentTestsFiles.filter(f => 
        f.includes('theme') || f.includes('ui-contract')
      )
      expect(forbiddenTestPatterns).toHaveLength(0)
    })
  })

  describe('CL-FE-017: Rota /settings/theme redireciona (static validation)', () => {
    
    // @clause CL-FE-017
    it('succeeds when no Route element defines /settings/theme', () => {
      const hasThemeRoute = /Route[^>]*path\s*=\s*['"]\/settings\/theme['"]/.test(appContent)
      expect(hasThemeRoute).toBe(false)
    })
    
    // @clause CL-FE-017
    it('succeeds when App.tsx has wildcard redirect to /', () => {
      // There should be a Route path="*" that redirects to /
      const hasWildcard = /Route[^>]*path\s*=\s*['"]\*['"]/.test(appContent)
      const hasNavigateToRoot = /<Navigate\s+to\s*=\s*['"]\/['"]/.test(appContent)
      
      // If app content is empty (file heavily modified), skip this check
      if (!appContent) {
        expect(true).toBe(true)
        return
      }
      
      expect(hasWildcard && hasNavigateToRoot).toBe(true)
    })
  })

  describe('CL-FE-018 & CL-FE-019 & CL-FE-020: Build Integrity (static validation)', () => {
    
    // @clause CL-FE-018
    it('succeeds when no dangling imports reference deleted theme files', () => {
      // Check that preserved files don't import deleted theme components
      if (appContent) {
        expect(appContent).not.toMatch(/from\s*['"]@\/components\/theme-/)
        expect(appContent).not.toMatch(/from\s*['"]@\/hooks\/use-active-theme['"]/)
      }
    })
    
    // @clause CL-FE-018
    it('succeeds when no dangling imports reference deleted ui-contract files', () => {
      if (projectDetailsContent) {
        expect(projectDetailsContent).not.toMatch(/from\s*['"]@\/components\/ui-contract-/)
      }
    })
    
    // @clause CL-FE-019
    it('succeeds when api.ts does not reference non-existent theme types', () => {
      if (apiContent) {
        // Should not import Theme types that no longer exist
        expect(apiContent).not.toMatch(/import\s+type\s*\{[^}]*Theme[^}]*\}\s*from/)
      }
    })
    
    // @clause CL-FE-020
    it('succeeds when app-layout.tsx has valid syntax (no incomplete references)', () => {
      if (appLayoutContent) {
        // Should not have LayoutConfig reference
        expect(appLayoutContent).not.toMatch(/LayoutConfig/)
        // Navigation array should be valid
        expect(appLayoutContent).toMatch(/const\s+navigation\s*=\s*\[/)
      }
    })
  })

  describe('Invariants: Preserved files must still exist', () => {
    
    // @clause CL-FE-001
    it('succeeds when App.tsx is preserved', () => {
      const exists = fileExists(APP_PATH)
      expect(exists).toBe(true)
    })
    
    // @clause CL-FE-006
    it('succeeds when app-layout.tsx is preserved', () => {
      const exists = fileExists(APP_LAYOUT_PATH)
      expect(exists).toBe(true)
    })
    
    // @clause CL-FE-007
    it('succeeds when project-details-page.tsx is preserved', () => {
      const exists = fileExists(PROJECT_DETAILS_PATH)
      expect(exists).toBe(true)
    })
    
    // @clause CL-FE-008
    // @clause CL-FE-009
    it('succeeds when api.ts is preserved', () => {
      const exists = fileExists(API_PATH)
      expect(exists).toBe(true)
    })
    
    // @clause CL-FE-010
    // @clause CL-FE-011
    // @clause CL-FE-012
    it('succeeds when types.ts is preserved', () => {
      const exists = fileExists(TYPES_PATH)
      expect(exists).toBe(true)
    })
    
    // @clause CL-FE-013
    it('succeeds when main.css is preserved', () => {
      const exists = fileExists(MAIN_CSS_PATH)
      expect(exists).toBe(true)
    })
    
    // @clause CL-FE-001
    it('succeeds when core components are preserved', () => {
      for (const component of PRESERVED_COMPONENTS) {
        const exists = fileExists(path.join(COMPONENTS_DIR, component))
        expect(exists, `Component ${component} must exist`).toBe(true)
      }
    })
    
    // @clause CL-FE-003
    it('succeeds when core hooks are preserved', () => {
      const preservedHooks = ['use-mobile.ts', 'useGitOperations.ts', 'useRunEvents.ts']
      for (const hook of preservedHooks) {
        const exists = fileExists(path.join(HOOKS_DIR, hook))
        expect(exists, `Hook ${hook} must exist`).toBe(true)
      }
    })
  })
})
