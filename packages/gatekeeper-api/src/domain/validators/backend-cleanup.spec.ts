import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Backend Cleanup Contract Spec
 * =============================
 * 
 * Contrato: remove-theme-ui-contract-backend
 * Objetivo: Remover todos os services, repositories, controllers, routes, validators
 *           e types relacionados a Theme Engine e UI Contract do backend Gatekeeper.
 * 
 * REGRA: Se estes testes falharem, a LLM executora errou na implementação.
 * Os testes validam estrutura estática e contratos, não comportamento runtime.
 */

// === CAMINHOS DOS ARQUIVOS ===

// __dirname = packages/gatekeeper-api/src/domain/validators
const API_ROOT = path.resolve(__dirname, '../../..') // packages/gatekeeper-api
const SRC_ROOT = path.join(API_ROOT, 'src')

// Directories
const SERVICES_DIR = path.join(SRC_ROOT, 'services')
const REPOSITORIES_DIR = path.join(SRC_ROOT, 'repositories')
const CONTROLLERS_DIR = path.join(SRC_ROOT, 'api/controllers')
const ROUTES_DIR = path.join(SRC_ROOT, 'api/routes')
const TYPES_DIR = path.join(SRC_ROOT, 'types')
const GATE1_DIR = path.join(SRC_ROOT, 'domain/validators/gate1')
const CONFIG_DIR = path.join(SRC_ROOT, 'config')
const TESTS_DIR = path.join(API_ROOT, 'tests')

// Key files
const ROUTES_INDEX_PATH = path.join(ROUTES_DIR, 'index.ts')
const TYPES_INDEX_PATH = path.join(TYPES_DIR, 'index.ts')
const GATES_TYPES_PATH = path.join(TYPES_DIR, 'gates.types.ts')
const GATES_CONFIG_PATH = path.join(CONFIG_DIR, 'gates.config.ts')
const VALIDATION_ORCHESTRATOR_PATH = path.join(SERVICES_DIR, 'ValidationOrchestrator.ts')
const PROJECT_CONTROLLER_PATH = path.join(CONTROLLERS_DIR, 'ProjectController.ts')

// === FILES THAT MUST BE DELETED ===

const SERVICES_TO_DELETE = [
  'ThemeEngine.ts',
  'PresetParser.ts',
  'CSSVariablesGenerator.ts',
  'LayoutConfigExtractor.ts',
  'ComponentStylesMapper.ts',
  'UIContractValidatorService.ts',
  'UIClauseGeneratorService.ts',
  'UIComponentExtractorService.ts',
  'UIPlanComparisonService.ts',
  'UITestCoverageService.ts',
]

const REPOSITORIES_TO_DELETE = [
  'ThemeRepository.ts',
  'UIContractRepository.ts',
]

const CONTROLLERS_TO_DELETE = [
  'ThemeController.ts',
  'UIContractController.ts',
]

const ROUTES_TO_DELETE = [
  'theme.routes.ts',
  'ui-contract.routes.ts',
]

const VALIDATORS_TO_DELETE = [
  'UIPlanCoverage.ts',
  'UITestCoverage.ts',
]

const TYPES_TO_DELETE = [
  'theme.types.ts',
  'ui-contract.types.ts',
]

const TESTS_TO_DELETE = [
  'theme/theme-engine.spec.ts',
  'theme/theme-engine-global.spec.ts',
  'ui-contract/ui-contract-backend.spec.ts',
]

const CONTROLLER_TESTS_TO_DELETE = [
  '__tests__/uild-v2.spec.ts',
]

// === SERVICES THAT MUST BE PRESERVED ===

const PRESERVED_SERVICES = [
  'ASTService.ts',
  'ArtifactsService.ts',
  'BuildService.ts',
  'CompilerService.ts',
  'GitOperationsService.ts',
  'GitService.ts',
  'LintService.ts',
  'LogService.ts',
  'PathResolverService.ts',
  'RunEventService.ts',
  'SandboxService.ts',
  'TestRunnerService.ts',
  'TokenCounterService.ts',
  'ValidationOrchestrator.ts',
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
  return fs.readdirSync(dirPath).filter(f => f.endsWith('.ts'))
}

function countPatternOccurrences(content: string, pattern: string): number {
  const regex = new RegExp(pattern, 'g')
  const matches = content.match(regex)
  return matches ? matches.length : 0
}

// === VARIÁVEIS GLOBAIS PARA CACHE ===

let routesIndexContent: string
let typesIndexContent: string
let gatesTypesContent: string
let gatesConfigContent: string
let validationOrchestratorContent: string
let projectControllerContent: string

let servicesFiles: string[]
let repositoriesFiles: string[]
let controllersFiles: string[]
let routesFiles: string[]
let typesFiles: string[]
let gate1Files: string[]

// === SETUP ===

beforeAll(() => {
  // Read file contents (may fail if files don't exist after deletion)
  try {
    routesIndexContent = readFileContent(ROUTES_INDEX_PATH)
  } catch {
    routesIndexContent = ''
  }
  
  try {
    typesIndexContent = readFileContent(TYPES_INDEX_PATH)
  } catch {
    typesIndexContent = ''
  }
  
  try {
    gatesTypesContent = readFileContent(GATES_TYPES_PATH)
  } catch {
    gatesTypesContent = ''
  }
  
  try {
    gatesConfigContent = readFileContent(GATES_CONFIG_PATH)
  } catch {
    gatesConfigContent = ''
  }
  
  try {
    validationOrchestratorContent = readFileContent(VALIDATION_ORCHESTRATOR_PATH)
  } catch {
    validationOrchestratorContent = ''
  }
  
  try {
    projectControllerContent = readFileContent(PROJECT_CONTROLLER_PATH)
  } catch {
    projectControllerContent = ''
  }
  
  // Get directory listings
  servicesFiles = getFilesInDirectory(SERVICES_DIR)
  repositoriesFiles = getFilesInDirectory(REPOSITORIES_DIR)
  controllersFiles = getFilesInDirectory(CONTROLLERS_DIR)
  routesFiles = getFilesInDirectory(ROUTES_DIR)
  typesFiles = getFilesInDirectory(TYPES_DIR)
  gate1Files = getFilesInDirectory(GATE1_DIR)
})

// === TESTES ===

describe('Backend Cleanup Contract - Remove Theme and UIContract', () => {

  describe('CL-BE-001: Services de Theme deletados', () => {
    
    // @clause CL-BE-001
    it('succeeds when ThemeEngine.ts does not exist in services directory', () => {
      const exists = fileExists(path.join(SERVICES_DIR, 'ThemeEngine.ts'))
      expect(exists).toBe(false)
    })
    
    // @clause CL-BE-001
    it('succeeds when PresetParser.ts does not exist in services directory', () => {
      const exists = fileExists(path.join(SERVICES_DIR, 'PresetParser.ts'))
      expect(exists).toBe(false)
    })
    
    // @clause CL-BE-001
    it('succeeds when CSSVariablesGenerator.ts does not exist in services directory', () => {
      const exists = fileExists(path.join(SERVICES_DIR, 'CSSVariablesGenerator.ts'))
      expect(exists).toBe(false)
    })
    
    // @clause CL-BE-001
    it('succeeds when LayoutConfigExtractor.ts does not exist in services directory', () => {
      const exists = fileExists(path.join(SERVICES_DIR, 'LayoutConfigExtractor.ts'))
      expect(exists).toBe(false)
    })
    
    // @clause CL-BE-001
    it('succeeds when ComponentStylesMapper.ts does not exist in services directory', () => {
      const exists = fileExists(path.join(SERVICES_DIR, 'ComponentStylesMapper.ts'))
      expect(exists).toBe(false)
    })
    
    // @clause CL-BE-001
    it('fails when any Theme service file still exists', () => {
      const themeFiles = servicesFiles.filter(f => 
        f.includes('Theme') || 
        f.includes('Preset') || 
        f.includes('CSS') || 
        f.includes('Layout') || 
        f.includes('ComponentStyles')
      )
      expect(themeFiles).toHaveLength(0)
    })
  })

  describe('CL-BE-002: Services de UIContract deletados', () => {
    
    // @clause CL-BE-002
    it('succeeds when UIContractValidatorService.ts does not exist', () => {
      const exists = fileExists(path.join(SERVICES_DIR, 'UIContractValidatorService.ts'))
      expect(exists).toBe(false)
    })
    
    // @clause CL-BE-002
    it('succeeds when UIClauseGeneratorService.ts does not exist', () => {
      const exists = fileExists(path.join(SERVICES_DIR, 'UIClauseGeneratorService.ts'))
      expect(exists).toBe(false)
    })
    
    // @clause CL-BE-002
    it('succeeds when UIComponentExtractorService.ts does not exist', () => {
      const exists = fileExists(path.join(SERVICES_DIR, 'UIComponentExtractorService.ts'))
      expect(exists).toBe(false)
    })
    
    // @clause CL-BE-002
    it('succeeds when UIPlanComparisonService.ts does not exist', () => {
      const exists = fileExists(path.join(SERVICES_DIR, 'UIPlanComparisonService.ts'))
      expect(exists).toBe(false)
    })
    
    // @clause CL-BE-002
    it('succeeds when UITestCoverageService.ts does not exist', () => {
      const exists = fileExists(path.join(SERVICES_DIR, 'UITestCoverageService.ts'))
      expect(exists).toBe(false)
    })
    
    // @clause CL-BE-002
    it('fails when any UI service file still exists', () => {
      const uiFiles = servicesFiles.filter(f => f.startsWith('UI'))
      expect(uiFiles).toHaveLength(0)
    })
  })

  describe('CL-BE-003: Repositories deletados', () => {
    
    // @clause CL-BE-003
    it('succeeds when ThemeRepository.ts does not exist', () => {
      const exists = fileExists(path.join(REPOSITORIES_DIR, 'ThemeRepository.ts'))
      expect(exists).toBe(false)
    })
    
    // @clause CL-BE-003
    it('succeeds when UIContractRepository.ts does not exist', () => {
      const exists = fileExists(path.join(REPOSITORIES_DIR, 'UIContractRepository.ts'))
      expect(exists).toBe(false)
    })
    
    // @clause CL-BE-003
    it('fails when Theme or UIContract repositories still exist', () => {
      const forbidden = repositoriesFiles.filter(f => 
        f.includes('Theme') || f.includes('UIContract')
      )
      expect(forbidden).toHaveLength(0)
    })
  })

  describe('CL-BE-004: Controllers deletados', () => {
    
    // @clause CL-BE-004
    it('succeeds when ThemeController.ts does not exist', () => {
      const exists = fileExists(path.join(CONTROLLERS_DIR, 'ThemeController.ts'))
      expect(exists).toBe(false)
    })
    
    // @clause CL-BE-004
    it('succeeds when UIContractController.ts does not exist', () => {
      const exists = fileExists(path.join(CONTROLLERS_DIR, 'UIContractController.ts'))
      expect(exists).toBe(false)
    })
    
    // @clause CL-BE-004
    it('fails when Theme or UIContract controllers still exist', () => {
      const forbidden = controllersFiles.filter(f => 
        f.includes('Theme') || f.includes('UIContract')
      )
      expect(forbidden).toHaveLength(0)
    })
  })

  describe('CL-BE-005: Routes deletadas', () => {
    
    // @clause CL-BE-005
    it('succeeds when theme.routes.ts does not exist', () => {
      const exists = fileExists(path.join(ROUTES_DIR, 'theme.routes.ts'))
      expect(exists).toBe(false)
    })
    
    // @clause CL-BE-005
    it('succeeds when ui-contract.routes.ts does not exist', () => {
      const exists = fileExists(path.join(ROUTES_DIR, 'ui-contract.routes.ts'))
      expect(exists).toBe(false)
    })
    
    // @clause CL-BE-005
    it('fails when theme or ui-contract route files still exist', () => {
      const forbidden = routesFiles.filter(f => 
        f.includes('theme') || f.includes('ui-contract')
      )
      expect(forbidden).toHaveLength(0)
    })
  })

  describe('CL-BE-006: Routes index atualizado', () => {
    
    // @clause CL-BE-006
    it('succeeds when routes/index.ts does not import uiContractRoutes', () => {
      const hasImport = /import\s*\{[^}]*uiContractRoutes[^}]*\}/.test(routesIndexContent)
      expect(hasImport).toBe(false)
    })
    
    // @clause CL-BE-006
    it('succeeds when routes/index.ts does not import themeRoutes', () => {
      const hasImport = /import\s*\{[^}]*themeRoutes[^}]*\}/.test(routesIndexContent)
      expect(hasImport).toBe(false)
    })
    
    // @clause CL-BE-006
    it('succeeds when routes/index.ts does not use uiContractRoutes', () => {
      const hasUsage = /router\.use\([^)]*uiContractRoutes/.test(routesIndexContent)
      expect(hasUsage).toBe(false)
    })
    
    // @clause CL-BE-006
    it('succeeds when routes/index.ts does not use themeRoutes', () => {
      const hasUsage = /router\.use\([^)]*themeRoutes/.test(routesIndexContent)
      expect(hasUsage).toBe(false)
    })
    
    // @clause CL-BE-006
    it('fails when routes/index.ts contains any ui-contract reference', () => {
      const count = countPatternOccurrences(routesIndexContent, 'ui-contract')
      expect(count).toBe(0)
    })
  })

  describe('CL-BE-007: Validators UI deletados', () => {
    
    // @clause CL-BE-007
    it('succeeds when UIPlanCoverage.ts does not exist in gate1', () => {
      const exists = fileExists(path.join(GATE1_DIR, 'UIPlanCoverage.ts'))
      expect(exists).toBe(false)
    })
    
    // @clause CL-BE-007
    it('succeeds when UITestCoverage.ts does not exist in gate1', () => {
      const exists = fileExists(path.join(GATE1_DIR, 'UITestCoverage.ts'))
      expect(exists).toBe(false)
    })
    
    // @clause CL-BE-007
    it('fails when any UI validator file still exists in gate1', () => {
      const uiValidators = gate1Files.filter(f => f.startsWith('UI'))
      expect(uiValidators).toHaveLength(0)
    })
  })

  describe('CL-BE-008: gates.config.ts atualizado', () => {
    
    // @clause CL-BE-008
    it('succeeds when gates.config.ts does not import UIPlanCoverageValidator', () => {
      const hasImport = /import\s*\{[^}]*UIPlanCoverageValidator[^}]*\}/.test(gatesConfigContent)
      expect(hasImport).toBe(false)
    })
    
    // @clause CL-BE-008
    it('succeeds when gates.config.ts does not import UITestCoverageValidator', () => {
      const hasImport = /import\s*\{[^}]*UITestCoverageValidator[^}]*\}/.test(gatesConfigContent)
      expect(hasImport).toBe(false)
    })
    
    // @clause CL-BE-008
    it('succeeds when gates.config.ts validators array does not contain UI validators', () => {
      const hasUIPlan = /UIPlanCoverageValidator\s*,?/.test(gatesConfigContent)
      const hasUITest = /UITestCoverageValidator\s*,?/.test(gatesConfigContent)
      expect(hasUIPlan).toBe(false)
      expect(hasUITest).toBe(false)
    })
    
    // @clause CL-BE-008
    it('fails when gates.config.ts contains any UI validator reference', () => {
      const count = countPatternOccurrences(gatesConfigContent, 'UI(Plan|Test)Coverage')
      expect(count).toBe(0)
    })
  })

  describe('CL-BE-009: Types deletados', () => {
    
    // @clause CL-BE-009
    it('succeeds when theme.types.ts does not exist', () => {
      const exists = fileExists(path.join(TYPES_DIR, 'theme.types.ts'))
      expect(exists).toBe(false)
    })
    
    // @clause CL-BE-009
    it('succeeds when ui-contract.types.ts does not exist', () => {
      const exists = fileExists(path.join(TYPES_DIR, 'ui-contract.types.ts'))
      expect(exists).toBe(false)
    })
    
    // @clause CL-BE-009
    it('fails when theme or ui-contract type files still exist', () => {
      const forbidden = typesFiles.filter(f => 
        f.includes('theme') || f.includes('ui-contract')
      )
      expect(forbidden).toHaveLength(0)
    })
  })

  describe('CL-BE-010: types/index.ts atualizado', () => {
    
    // @clause CL-BE-010
    it('succeeds when types/index.ts does not export ui-contract.types', () => {
      const hasExport = /export\s*\*\s*from\s*['"]\.\/ui-contract\.types/.test(typesIndexContent)
      expect(hasExport).toBe(false)
    })
    
    // @clause CL-BE-010
    it('fails when types/index.ts contains any ui-contract reference', () => {
      const count = countPatternOccurrences(typesIndexContent, 'ui-contract')
      expect(count).toBe(0)
    })
  })

  describe('CL-BE-011: gates.types.ts atualizado', () => {
    
    // @clause CL-BE-011
    it('succeeds when gates.types.ts does not import UIContractSchema', () => {
      const hasImport = /import\s+type\s*\{[^}]*UIContractSchema[^}]*\}/.test(gatesTypesContent)
      expect(hasImport).toBe(false)
    })
    
    // @clause CL-BE-011
    it('succeeds when ValidatorCode does not include UI_PLAN_COVERAGE', () => {
      const hasCode = /['"]UI_PLAN_COVERAGE['"]/.test(gatesTypesContent)
      expect(hasCode).toBe(false)
    })
    
    // @clause CL-BE-011
    it('succeeds when ValidatorCode does not include UI_TEST_COVERAGE', () => {
      const hasCode = /['"]UI_TEST_COVERAGE['"]/.test(gatesTypesContent)
      expect(hasCode).toBe(false)
    })
    
    // @clause CL-BE-011
    it('succeeds when ValidationContext does not have uiContract field', () => {
      // Check for uiContract field definition in ValidationContext
      const hasField = /uiContract\s*:\s*UIContractSchema/.test(gatesTypesContent)
      expect(hasField).toBe(false)
    })
    
    // @clause CL-BE-011
    it('succeeds when ContractClause.kind does not include "ui"', () => {
      // Look for kind type that includes 'ui'
      const hasUIKind = /kind:\s*['"][^'"]*['"](\s*\|\s*['"][^'"]*['"])*\s*\|\s*['"]ui['"]/.test(gatesTypesContent)
      const hasUIKindAlt = /['"]ui['"]\s*\|/.test(gatesTypesContent)
      expect(hasUIKind || hasUIKindAlt).toBe(false)
    })
    
    // @clause CL-BE-011
    it('succeeds when AssertionSurface does not have ui field', () => {
      // Check for ui?: { ... } in AssertionSurface
      const hasUIField = /ui\?\s*:\s*\{/.test(gatesTypesContent)
      expect(hasUIField).toBe(false)
    })
    
    // @clause CL-BE-011
    it('fails when gates.types.ts contains any UIContract reference', () => {
      const count = countPatternOccurrences(gatesTypesContent, 'UIContract')
      expect(count).toBe(0)
    })
  })

  describe('CL-BE-012: ValidationOrchestrator limpo', () => {
    
    // @clause CL-BE-012
    it('succeeds when ValidationOrchestrator does not query prisma.uIContract', () => {
      const hasQuery = /prisma\.uIContract\.findUnique/.test(validationOrchestratorContent)
      expect(hasQuery).toBe(false)
    })
    
    // @clause CL-BE-012
    it('succeeds when ValidationOrchestrator does not declare uiContract variable', () => {
      const hasVar = /let\s+uiContract\s*=/.test(validationOrchestratorContent)
      expect(hasVar).toBe(false)
    })
    
    // @clause CL-BE-012
    it('succeeds when buildContext return does not include uiContract', () => {
      // Look for uiContract in the return statement
      const hasReturnField = /return\s*\{[\s\S]*uiContract[\s\S]*\}/.test(validationOrchestratorContent)
      expect(hasReturnField).toBe(false)
    })
    
    // @clause CL-BE-012
    it('fails when ValidationOrchestrator contains any uiContract reference', () => {
      const count = countPatternOccurrences(validationOrchestratorContent, 'uiContract')
      expect(count).toBe(0)
    })
  })

  describe('CL-BE-013: ProjectController limpo', () => {
    
    // @clause CL-BE-013
    it('succeeds when getProject include does not have uiContract: true', () => {
      const hasInclude = /uiContract:\s*true/.test(projectControllerContent)
      expect(hasInclude).toBe(false)
    })
    
    // @clause CL-BE-013
    it('fails when ProjectController contains any uiContract reference', () => {
      const count = countPatternOccurrences(projectControllerContent, 'uiContract')
      expect(count).toBe(0)
    })
  })

  describe('CL-BE-014 & CL-BE-015: API Endpoints removidos (static validation)', () => {
    
    // @clause CL-BE-014
    it('succeeds when no route file defines /api/themes endpoint', () => {
      // theme.routes.ts should not exist
      const themeRoutesExists = fileExists(path.join(ROUTES_DIR, 'theme.routes.ts'))
      expect(themeRoutesExists).toBe(false)
    })
    
    // @clause CL-BE-015
    it('succeeds when no route file defines /api/projects/:id/ui-contract endpoint', () => {
      // ui-contract.routes.ts should not exist
      const uiContractRoutesExists = fileExists(path.join(ROUTES_DIR, 'ui-contract.routes.ts'))
      expect(uiContractRoutesExists).toBe(false)
    })
    
    // @clause CL-BE-014
    // @clause CL-BE-015
    it('succeeds when routes/index.ts does not register theme or ui-contract routes', () => {
      const hasThemeRoute = routesIndexContent.includes('themeRoutes')
      const hasUIContractRoute = routesIndexContent.includes('uiContractRoutes')
      expect(hasThemeRoute).toBe(false)
      expect(hasUIContractRoute).toBe(false)
    })
  })

  describe('CL-BE-016 & CL-BE-017: Build Integrity (static validation)', () => {
    
    // @clause CL-BE-016
    it('succeeds when no dangling imports reference deleted files in gates.config.ts', () => {
      // Check that gates.config.ts doesn't import from non-existent files
      const importedValidators = gatesConfigContent.match(/from\s*['"]\.\.\/domain\/validators\/gate1\/([^'"]+)['"]/g) || []
      
      for (const importMatch of importedValidators) {
        const filename = importMatch.match(/gate1\/([^'"]+)/)?.[1]?.replace('.js', '.ts')
        if (filename) {
          // Should not be UI validators
          expect(filename).not.toMatch(/^UI/)
        }
      }
    })
    
    // @clause CL-BE-016
    it('succeeds when no dangling imports reference deleted files in routes/index.ts', () => {
      // Check that routes/index.ts doesn't import from non-existent files
      const importedRoutes = routesIndexContent.match(/from\s*['"]\.\/([^'"]+)['"]/g) || []
      
      for (const importMatch of importedRoutes) {
        const filename = importMatch.match(/\.\/([^'"]+)/)?.[1]
        if (filename) {
          // Should not be theme or ui-contract routes
          expect(filename).not.toMatch(/theme\.routes|ui-contract\.routes/)
        }
      }
    })
    
    // @clause CL-BE-017
    it('succeeds when test directories for theme are deleted', () => {
      const themeTestDir = path.join(TESTS_DIR, 'theme')
      // Either the directory doesn't exist, or it's empty
      if (fs.existsSync(themeTestDir)) {
        const files = fs.readdirSync(themeTestDir).filter(f => f.endsWith('.ts') || f.endsWith('.spec.ts'))
        expect(files).toHaveLength(0)
      } else {
        expect(true).toBe(true)
      }
    })
    
    // @clause CL-BE-017
    it('succeeds when test directories for ui-contract are deleted', () => {
      const uiContractTestDir = path.join(TESTS_DIR, 'ui-contract')
      // Either the directory doesn't exist, or it's empty
      if (fs.existsSync(uiContractTestDir)) {
        const files = fs.readdirSync(uiContractTestDir).filter(f => f.endsWith('.ts') || f.endsWith('.spec.ts'))
        expect(files).toHaveLength(0)
      } else {
        expect(true).toBe(true)
      }
    })
    
    // @clause CL-BE-017
    it('succeeds when uild-v2.spec.ts is deleted from controllers/__tests__', () => {
      const testPath = path.join(CONTROLLERS_DIR, '__tests__/uild-v2.spec.ts')
      const exists = fileExists(testPath)
      expect(exists).toBe(false)
    })
  })

  describe('Invariants: Preserved files must still exist', () => {
    
    // @clause CL-BE-001
    // @clause CL-BE-002
    it('succeeds when core services are preserved', () => {
      for (const service of PRESERVED_SERVICES) {
        const exists = fileExists(path.join(SERVICES_DIR, service))
        expect(exists, `Service ${service} must exist`).toBe(true)
      }
    })
    
    // @clause CL-BE-003
    it('succeeds when core repositories are preserved', () => {
      const preservedRepos = [
        'GateResultRepository.ts',
        'ValidationRunRepository.ts',
        'ValidatorResultRepository.ts',
      ]
      for (const repo of preservedRepos) {
        const exists = fileExists(path.join(REPOSITORIES_DIR, repo))
        expect(exists, `Repository ${repo} must exist`).toBe(true)
      }
    })
    
    // @clause CL-BE-004
    it('succeeds when core controllers are preserved', () => {
      const preservedControllers = [
        'ConfigController.ts',
        'GitController.ts',
        'ProjectController.ts',
        'RunsController.ts',
        'ValidationController.ts',
        'ValidatorController.ts',
        'WorkspaceController.ts',
      ]
      for (const controller of preservedControllers) {
        const exists = fileExists(path.join(CONTROLLERS_DIR, controller))
        expect(exists, `Controller ${controller} must exist`).toBe(true)
      }
    })
    
    // @clause CL-BE-005
    it('succeeds when core routes are preserved', () => {
      const preservedRoutes = [
        'config.routes.ts',
        'git.routes.ts',
        'index.ts',
        'project.routes.ts',
        'runs.routes.ts',
        'validation.routes.ts',
        'validators.routes.ts',
        'workspace.routes.ts',
      ]
      for (const route of preservedRoutes) {
        const exists = fileExists(path.join(ROUTES_DIR, route))
        expect(exists, `Route ${route} must exist`).toBe(true)
      }
    })
    
    // @clause CL-BE-007
    it('succeeds when core gate1 validators are preserved', () => {
      const preservedValidators = [
        'ImportRealityCheck.ts',
        'ManifestFileLock.ts',
        'NoDecorativeTests.ts',
        'NoImplicitFiles.ts',
        'TestClauseMappingValid.ts',
        'TestCoversHappyAndSadPath.ts',
        'TestFailsBeforeImplementation.ts',
        'TestHasAssertions.ts',
        'TestIntentAlignment.ts',
        'TestSyntaxValid.ts',
      ]
      for (const validator of preservedValidators) {
        const exists = fileExists(path.join(GATE1_DIR, validator))
        expect(exists, `Validator ${validator} must exist`).toBe(true)
      }
    })
    
    // @clause CL-BE-009
    it('succeeds when gates.types.ts is preserved', () => {
      const exists = fileExists(GATES_TYPES_PATH)
      expect(exists).toBe(true)
    })
  })
})
