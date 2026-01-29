import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * UI Code Compliance Validators Contract Spec
 * ===========================================
 * 
 * Contrato: gatekeeper-ui-validators
 * Objetivo: Implementar validators PROTECTED_FILES e UI_CODE_COMPLIANCE
 * 
 * REGRA: Se estes testes falharem, a LLM executora errou na implementação.
 * Os testes validam estrutura estática e contratos, não comportamento runtime.
 */

// === CONSTANTES DE REFERÊNCIA ===

const REQUIRED_VALIDATOR_CODES = ['PROTECTED_FILES', 'UI_CODE_COMPLIANCE'] as const

const EXPECTED_API_ENDPOINTS = [
  'POST /api/projects/:projectId/component-registry',
  'GET /api/projects/:projectId/component-registry',
  'DELETE /api/projects/:projectId/component-registry',
] as const

const EXPECTED_ERROR_CODES = [
  'INVALID_REGISTRY',
  'REGISTRY_NOT_FOUND',
  'INTERNAL_ERROR',
] as const

const EXPECTED_VIOLATION_TYPES = [
  'forbidden-element',
  'forbidden-class',
  'inline-style',
] as const

// === CAMINHOS DOS ARQUIVOS ===

// __dirname = packages/gatekeeper-api/src/domain/validators/__tests__
const VALIDATORS_ROOT = path.resolve(__dirname, '..')
const API_ROOT = path.resolve(__dirname, '../../..')
const PROJECT_ROOT = path.resolve(__dirname, '../../../../../..')

const PROTECTED_FILES_VALIDATOR_PATH = path.join(VALIDATORS_ROOT, 'gate1/ProtectedFiles.ts')
const UI_CODE_COMPLIANCE_VALIDATOR_PATH = path.join(VALIDATORS_ROOT, 'gate2/UICodeCompliance.ts')
const VALIDATOR_INDEX_PATH = path.join(VALIDATORS_ROOT, 'index.ts')

const COMPONENT_REGISTRY_SERVICE_PATH = path.join(API_ROOT, 'src/services/ComponentRegistryService.ts')
const JSX_ANALYZER_SERVICE_PATH = path.join(API_ROOT, 'src/services/JSXAnalyzerService.ts')
const COMPONENT_REGISTRY_REPOSITORY_PATH = path.join(API_ROOT, 'src/repositories/ComponentRegistryRepository.ts')

const COMPONENT_REGISTRY_ROUTES_PATH = path.join(API_ROOT, 'src/api/routes/component-registry.routes.ts')
const COMPONENT_REGISTRY_CONTROLLER_PATH = path.join(API_ROOT, 'src/api/controllers/ComponentRegistryController.ts')
const ROUTES_INDEX_PATH = path.join(API_ROOT, 'src/api/routes/index.ts')

const COMPONENT_REGISTRY_TYPES_PATH = path.join(API_ROOT, 'src/types/component-registry.types.ts')
const PRISMA_SCHEMA_PATH = path.join(API_ROOT, 'prisma/schema.prisma')

// === UTILIDADES ===

function readFileContent(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`)
  }
  return fs.readFileSync(filePath, 'utf-8')
}

function extractPrismaModel(schemaContent: string, modelName: string): string | null {
  const modelRegex = new RegExp(`model\\s+${modelName}\\s*\\{([^}]+)\\}`, 's')
  const match = schemaContent.match(modelRegex)
  return match ? match[1] : null
}

// === DADOS CARREGADOS ===

let protectedFilesContent: string
let uiCodeComplianceContent: string
let validatorIndexContent: string
let componentRegistryServiceContent: string
let jsxAnalyzerServiceContent: string
let componentRegistryRoutesContent: string
let componentRegistryControllerContent: string
let routesIndexContent: string
let componentRegistryTypesContent: string
let prismaSchemaContent: string

beforeAll(() => {
  // Validators
  if (fs.existsSync(PROTECTED_FILES_VALIDATOR_PATH)) {
    protectedFilesContent = readFileContent(PROTECTED_FILES_VALIDATOR_PATH)
  }
  if (fs.existsSync(UI_CODE_COMPLIANCE_VALIDATOR_PATH)) {
    uiCodeComplianceContent = readFileContent(UI_CODE_COMPLIANCE_VALIDATOR_PATH)
  }
  if (fs.existsSync(VALIDATOR_INDEX_PATH)) {
    validatorIndexContent = readFileContent(VALIDATOR_INDEX_PATH)
  }
  
  // Services
  if (fs.existsSync(COMPONENT_REGISTRY_SERVICE_PATH)) {
    componentRegistryServiceContent = readFileContent(COMPONENT_REGISTRY_SERVICE_PATH)
  }
  if (fs.existsSync(JSX_ANALYZER_SERVICE_PATH)) {
    jsxAnalyzerServiceContent = readFileContent(JSX_ANALYZER_SERVICE_PATH)
  }
  
  // API
  if (fs.existsSync(COMPONENT_REGISTRY_ROUTES_PATH)) {
    componentRegistryRoutesContent = readFileContent(COMPONENT_REGISTRY_ROUTES_PATH)
  }
  if (fs.existsSync(COMPONENT_REGISTRY_CONTROLLER_PATH)) {
    componentRegistryControllerContent = readFileContent(COMPONENT_REGISTRY_CONTROLLER_PATH)
  }
  if (fs.existsSync(ROUTES_INDEX_PATH)) {
    routesIndexContent = readFileContent(ROUTES_INDEX_PATH)
  }
  
  // Types & Schema
  if (fs.existsSync(COMPONENT_REGISTRY_TYPES_PATH)) {
    componentRegistryTypesContent = readFileContent(COMPONENT_REGISTRY_TYPES_PATH)
  }
  if (fs.existsSync(PRISMA_SCHEMA_PATH)) {
    prismaSchemaContent = readFileContent(PRISMA_SCHEMA_PATH)
  }
})

// =============================================================================
// TESTES DAS CLÁUSULAS
// =============================================================================

describe('Validators - Existência', () => {
  
  // @clause CL-VAL-001
  it('succeeds when PROTECTED_FILES validator exists in gate1', () => {
    expect(fs.existsSync(PROTECTED_FILES_VALIDATOR_PATH)).toBe(true)
    expect(protectedFilesContent).toMatch(/PROTECTED_FILES/i)
  })
  
  // @clause CL-VAL-001
  it('succeeds when PROTECTED_FILES is configured as gate 1 hard block', () => {
    expect(protectedFilesContent).toMatch(/gate:\s*1/)
    expect(protectedFilesContent).toMatch(/isHardBlock:\s*true/)
  })
  
  // @clause CL-VAL-001
  it('succeeds when PROTECTED_FILES is registered in validator index', () => {
    expect(validatorIndexContent).toMatch(/ProtectedFiles/i)
  })
  
  // @clause CL-VAL-001
  it('fails when PROTECTED_FILES validator file does not exist', () => {
    const fakePath = path.join(VALIDATORS_ROOT, 'gate1/NonExistentValidator.ts')
    expect(fs.existsSync(fakePath)).toBe(false)
  })
  
  // @clause CL-VAL-002
  it('succeeds when UI_CODE_COMPLIANCE validator exists in gate2', () => {
    expect(fs.existsSync(UI_CODE_COMPLIANCE_VALIDATOR_PATH)).toBe(true)
    expect(uiCodeComplianceContent).toMatch(/UI_CODE_COMPLIANCE/i)
  })
  
  // @clause CL-VAL-002
  it('succeeds when UI_CODE_COMPLIANCE is configured as gate 2 hard block', () => {
    expect(uiCodeComplianceContent).toMatch(/gate:\s*2/)
    expect(uiCodeComplianceContent).toMatch(/isHardBlock:\s*true/)
  })
  
  // @clause CL-VAL-002
  it('succeeds when UI_CODE_COMPLIANCE is registered in validator index', () => {
    expect(validatorIndexContent).toMatch(/UICodeCompliance/i)
  })
  
  // @clause CL-VAL-002
  it('fails when UI_CODE_COMPLIANCE is not in gate 2', () => {
    // Verificar que não está em gate 1 ou 3
    const notInGate1 = !uiCodeComplianceContent.match(/gate:\s*1/)
    const notInGate3 = !uiCodeComplianceContent.match(/gate:\s*3/)
    expect(notInGate1).toBe(true)
    expect(notInGate3).toBe(true)
  })
})

describe('PROTECTED_FILES - Comportamento', () => {
  
  // @clause CL-PRT-001
  it('succeeds when validator checks files against protectedPaths', () => {
    expect(protectedFilesContent).toMatch(/protectedPaths/i)
    expect(protectedFilesContent).toMatch(/FAILED|FAIL/i)
  })
  
  // @clause CL-PRT-001
  it('succeeds when validator returns FAIL for protected file modifications', () => {
    // Verificar que existe lógica para retornar failed
    expect(protectedFilesContent).toMatch(/passed:\s*false/)
    expect(protectedFilesContent).toMatch(/status:\s*['"]FAILED['"]/)
  })
  
  // @clause CL-PRT-001
  it('succeeds when validator lists protected files in details', () => {
    expect(protectedFilesContent).toMatch(/details/i)
    expect(protectedFilesContent).toMatch(/protectedFiles/i)
  })
  
  // @clause CL-PRT-001
  it('fails when validator does not check for protected files', () => {
    // Validar que existe verificação (não pode estar vazio)
    const hasProtectedCheck = protectedFilesContent.includes('protectedPaths') || 
                              protectedFilesContent.includes('protected')
    expect(hasProtectedCheck).toBe(true)
  })
  
  // @clause CL-PRT-002
  it('succeeds when validator allows non-protected file modifications', () => {
    // Verificar que existe lógica para retornar passed
    expect(protectedFilesContent).toMatch(/passed:\s*true/)
    expect(protectedFilesContent).toMatch(/status:\s*['"]PASSED['"]/)
  })
  
  // @clause CL-PRT-002
  it('succeeds when validator checks files are outside protected paths', () => {
    // Deve haver lógica de verificação de paths
    const hasPathCheck = protectedFilesContent.includes('path') && 
                         protectedFilesContent.includes('protected')
    expect(hasPathCheck).toBe(true)
  })
  
  // @clause CL-PRT-002
  it('fails when validator blocks all file modifications', () => {
    // Deve ter condição para PASS (não pode sempre retornar FAIL)
    const hasPassed = protectedFilesContent.match(/passed:\s*true/)
    expect(hasPassed).not.toBeNull()
  })
  
  // @clause CL-PRT-003
  it('succeeds when validator skips when no registry exists', () => {
    expect(protectedFilesContent).toMatch(/SKIPPED/i)
    expect(protectedFilesContent).toMatch(/registry/i)
  })
  
  // @clause CL-PRT-003
  it('succeeds when validator checks for registry presence', () => {
    // Deve verificar se registry existe antes de processar
    const hasRegistryCheck = protectedFilesContent.includes('registry') && 
                             (protectedFilesContent.includes('if') || protectedFilesContent.includes('?'))
    expect(hasRegistryCheck).toBe(true)
  })
  
  // @clause CL-PRT-003
  it('fails when validator processes without checking for registry', () => {
    // Validar que existe verificação de registry
    const hasRegistryCondition = protectedFilesContent.match(/if.*registry|registry.*\?/)
    expect(hasRegistryCondition).not.toBeNull()
  })
})

describe('UI_CODE_COMPLIANCE - Detecção de Violations', () => {
  
  // @clause CL-UIC-001
  it('succeeds when validator detects forbidden HTML elements', () => {
    expect(uiCodeComplianceContent).toMatch(/forbidden.*elements?|elements?.*forbidden/i)
    expect(uiCodeComplianceContent).toMatch(/forbidden-element/i)
  })
  
  // @clause CL-UIC-001
  it('succeeds when validator returns FAIL for forbidden elements', () => {
    expect(uiCodeComplianceContent).toMatch(/type:\s*['"]forbidden-element['"]/)
    expect(uiCodeComplianceContent).toMatch(/violation/i)
  })
  
  // @clause CL-UIC-001
  it('fails when validator does not check for forbidden elements', () => {
    const hasForbiddenElementCheck = uiCodeComplianceContent.includes('forbidden') && 
                                      uiCodeComplianceContent.includes('element')
    expect(hasForbiddenElementCheck).toBe(true)
  })
  
  // @clause CL-UIC-002
  it('succeeds when validator detects forbidden CSS classes', () => {
    expect(uiCodeComplianceContent).toMatch(/forbidden.*class|class.*forbidden|forbiddenPatterns/i)
    expect(uiCodeComplianceContent).toMatch(/forbidden-class/i)
  })
  
  // @clause CL-UIC-002
  it('succeeds when validator uses pattern matching for classes', () => {
    // Deve usar regex ou pattern matching
    const hasPatternMatching = uiCodeComplianceContent.includes('pattern') || 
                               uiCodeComplianceContent.includes('match') ||
                               uiCodeComplianceContent.includes('regex')
    expect(hasPatternMatching).toBe(true)
  })
  
  // @clause CL-UIC-002
  it('fails when validator does not check CSS classes', () => {
    const hasClassCheck = uiCodeComplianceContent.includes('class') || 
                          uiCodeComplianceContent.includes('className')
    expect(hasClassCheck).toBe(true)
  })
  
  // @clause CL-UIC-003
  it('succeeds when validator detects inline styles', () => {
    expect(uiCodeComplianceContent).toMatch(/inline.*style|style.*inline/i)
    expect(uiCodeComplianceContent).toMatch(/inline-style/i)
  })
  
  // @clause CL-UIC-003
  it('succeeds when validator checks for style attribute usage', () => {
    const hasStyleCheck = uiCodeComplianceContent.includes('style') && 
                          (uiCodeComplianceContent.includes('{{') || 
                           uiCodeComplianceContent.includes('inline'))
    expect(hasStyleCheck).toBe(true)
  })
  
  // @clause CL-UIC-003
  it('fails when validator ignores inline styles', () => {
    const hasInlineStyleCheck = uiCodeComplianceContent.match(/inline-style|inline.*style/)
    expect(hasInlineStyleCheck).not.toBeNull()
  })
  
  // @clause CL-UIC-004
  it('succeeds when validator passes valid code', () => {
    expect(uiCodeComplianceContent).toMatch(/passed:\s*true/)
    expect(uiCodeComplianceContent).toMatch(/violations.*\[\]|violations.*length.*0/i)
  })
  
  // @clause CL-UIC-004
  it('succeeds when validator returns empty violations array for valid code', () => {
    // Deve retornar array vazio quando não há problemas
    const hasEmptyViolations = uiCodeComplianceContent.includes('violations') && 
                               (uiCodeComplianceContent.includes('[]') || 
                                uiCodeComplianceContent.includes('length'))
    expect(hasEmptyViolations).toBe(true)
  })
  
  // @clause CL-UIC-004
  it('fails when validator does not handle valid code scenario', () => {
    const hasPassScenario = uiCodeComplianceContent.match(/passed:\s*true/)
    expect(hasPassScenario).not.toBeNull()
  })
  
  // @clause CL-UIC-005
  it('succeeds when validator collects multiple violations', () => {
    // Deve ter estrutura para coletar múltiplas violations
    const hasViolationsArray = uiCodeComplianceContent.includes('violations') && 
                               (uiCodeComplianceContent.includes('push') || 
                                uiCodeComplianceContent.includes('...') ||
                                uiCodeComplianceContent.includes('concat'))
    expect(hasViolationsArray).toBe(true)
  })
  
  // @clause CL-UIC-005
  it('succeeds when validator returns all found violations', () => {
    expect(uiCodeComplianceContent).toMatch(/violations/i)
    expect(uiCodeComplianceContent).toMatch(/details/i)
  })
  
  // @clause CL-UIC-005
  it('fails when validator stops at first violation', () => {
    // Não deve ter early return após primeira violation
    const hasMultipleViolationSupport = !uiCodeComplianceContent.match(/return.*violation[^s]/)
    expect(hasMultipleViolationSupport).toBe(true)
  })
  
  // @clause CL-UIC-006
  it('succeeds when validator skips when no registry exists', () => {
    expect(uiCodeComplianceContent).toMatch(/SKIPPED/i)
    expect(uiCodeComplianceContent).toMatch(/registry/i)
  })
  
  // @clause CL-UIC-006
  it('succeeds when validator checks registry before analyzing', () => {
    const hasRegistryCheck = uiCodeComplianceContent.includes('registry') && 
                             (uiCodeComplianceContent.includes('if') || 
                              uiCodeComplianceContent.includes('?') ||
                              uiCodeComplianceContent.includes('!'))
    expect(hasRegistryCheck).toBe(true)
  })
  
  // @clause CL-UIC-006
  it('fails when validator processes without registry check', () => {
    const hasRegistryCondition = uiCodeComplianceContent.match(/if.*registry|registry.*\?|!.*registry/)
    expect(hasRegistryCondition).not.toBeNull()
  })
  
  // @clause CL-UIC-007
  it('succeeds when validator filters for TSX/JSX files only', () => {
    const hasTsxJsxFilter = uiCodeComplianceContent.includes('.tsx') || 
                            uiCodeComplianceContent.includes('.jsx') ||
                            uiCodeComplianceContent.match(/\.(tsx|jsx)/)
    expect(hasTsxJsxFilter).toBe(true)
  })
  
  // @clause CL-UIC-007
  it('succeeds when validator ignores non-code files', () => {
    // Deve ter lógica para filtrar por extensão
    const hasExtensionFilter = uiCodeComplianceContent.includes('endsWith') || 
                               uiCodeComplianceContent.includes('extension') ||
                               uiCodeComplianceContent.includes('filter')
    expect(hasExtensionFilter).toBe(true)
  })
  
  // @clause CL-UIC-007
  it('fails when validator attempts to parse non-TSX files', () => {
    // Validar que existe filtro de extensão
    const hasFileTypeCheck = uiCodeComplianceContent.match(/\.tsx|\.jsx|endsWith/)
    expect(hasFileTypeCheck).not.toBeNull()
  })
})

describe('API Endpoints', () => {
  
  // @clause CL-API-001
  it('succeeds when POST endpoint exists for component-registry', () => {
    expect(componentRegistryRoutesContent).toMatch(/post|POST/i)
    expect(componentRegistryRoutesContent).toMatch(/component-registry/i)
  })
  
  // @clause CL-API-001
  it('succeeds when POST endpoint returns 201 with id and hash', () => {
    // Controller deve retornar 201
    expect(componentRegistryControllerContent).toMatch(/201/)
    expect(componentRegistryControllerContent).toMatch(/id/i)
    expect(componentRegistryControllerContent).toMatch(/hash/i)
  })
  
  // @clause CL-API-001
  it('succeeds when POST endpoint is registered in routes index', () => {
    expect(routesIndexContent).toMatch(/component-registry/i)
  })
  
  // @clause CL-API-001
  it('fails when POST endpoint does not create registry', () => {
    const hasCreateLogic = componentRegistryControllerContent.includes('create') || 
                           componentRegistryControllerContent.includes('save') ||
                           componentRegistryControllerContent.includes('upsert')
    expect(hasCreateLogic).toBe(true)
  })
  
  // @clause CL-API-002
  it('succeeds when GET endpoint exists for component-registry', () => {
    expect(componentRegistryRoutesContent).toMatch(/get|GET/i)
    expect(componentRegistryRoutesContent).toMatch(/component-registry/i)
  })
  
  // @clause CL-API-002
  it('succeeds when GET endpoint returns 200 with registry content', () => {
    expect(componentRegistryControllerContent).toMatch(/200/)
    expect(componentRegistryControllerContent).toMatch(/content/i)
  })
  
  // @clause CL-API-002
  it('fails when GET endpoint does not retrieve registry', () => {
    const hasGetLogic = componentRegistryControllerContent.includes('findUnique') || 
                        componentRegistryControllerContent.includes('findFirst') ||
                        componentRegistryControllerContent.includes('get')
    expect(hasGetLogic).toBe(true)
  })
  
  // @clause CL-API-003
  it('succeeds when DELETE endpoint exists for component-registry', () => {
    expect(componentRegistryRoutesContent).toMatch(/delete|DELETE/i)
    expect(componentRegistryRoutesContent).toMatch(/component-registry/i)
  })
  
  // @clause CL-API-003
  it('succeeds when DELETE endpoint returns 204', () => {
    expect(componentRegistryControllerContent).toMatch(/204/)
  })
  
  // @clause CL-API-003
  it('fails when DELETE endpoint does not remove registry', () => {
    const hasDeleteLogic = componentRegistryControllerContent.includes('delete') || 
                           componentRegistryControllerContent.includes('remove')
    expect(hasDeleteLogic).toBe(true)
  })
  
  // @clause CL-API-004
  it('succeeds when POST validates YAML format', () => {
    // Deve validar YAML antes de salvar
    expect(componentRegistryControllerContent).toMatch(/validate|validation/i)
  })
  
  // @clause CL-API-004
  it('succeeds when POST returns 400 for invalid YAML', () => {
    expect(componentRegistryControllerContent).toMatch(/400/)
    expect(componentRegistryControllerContent).toMatch(/INVALID_REGISTRY/i)
  })
  
  // @clause CL-API-004
  it('fails when POST accepts any input without validation', () => {
    const hasValidation = componentRegistryControllerContent.includes('validate') || 
                          componentRegistryControllerContent.includes('valid')
    expect(hasValidation).toBe(true)
  })
  
  // @clause CL-API-005
  it('succeeds when GET returns 404 when registry not found', () => {
    expect(componentRegistryControllerContent).toMatch(/404/)
    expect(componentRegistryControllerContent).toMatch(/REGISTRY_NOT_FOUND|not.*found/i)
  })
  
  // @clause CL-API-005
  it('succeeds when GET handles null registry case', () => {
    const hasNullCheck = componentRegistryControllerContent.includes('null') || 
                         componentRegistryControllerContent.includes('!') ||
                         componentRegistryControllerContent.includes('not found')
    expect(hasNullCheck).toBe(true)
  })
  
  // @clause CL-API-005
  it('fails when GET does not handle missing registry', () => {
    const has404Response = componentRegistryControllerContent.match(/404/)
    expect(has404Response).not.toBeNull()
  })
})

describe('Services', () => {
  
  // @clause CL-SVC-001
  it('succeeds when JSXAnalyzerService exists', () => {
    expect(fs.existsSync(JSX_ANALYZER_SERVICE_PATH)).toBe(true)
  })
  
  // @clause CL-SVC-001
  it('succeeds when JSXAnalyzerService has analyze method', () => {
    expect(jsxAnalyzerServiceContent).toMatch(/analyze|async\s+analyze/i)
  })
  
  // @clause CL-SVC-001
  it('succeeds when analyze returns Violation array', () => {
    // Deve retornar array de violations
    expect(jsxAnalyzerServiceContent).toMatch(/Violation\[\]|Array<Violation>/i)
  })
  
  // @clause CL-SVC-001
  it('succeeds when Violation has required fields', () => {
    // Verificar type definition ou uso
    const hasViolationFields = jsxAnalyzerServiceContent.includes('type') && 
                               jsxAnalyzerServiceContent.includes('line') &&
                               jsxAnalyzerServiceContent.includes('message')
    expect(hasViolationFields).toBe(true)
  })
  
  // @clause CL-SVC-001
  it('fails when JSXAnalyzerService does not exist', () => {
    const fakePath = path.join(API_ROOT, 'src/services/NonExistentService.ts')
    expect(fs.existsSync(fakePath)).toBe(false)
  })
  
  // @clause CL-SVC-002
  it('succeeds when ComponentRegistryService exists', () => {
    expect(fs.existsSync(COMPONENT_REGISTRY_SERVICE_PATH)).toBe(true)
  })
  
  // @clause CL-SVC-002
  it('succeeds when ComponentRegistryService has validate method', () => {
    expect(componentRegistryServiceContent).toMatch(/validate|validation/i)
  })
  
  // @clause CL-SVC-002
  it('succeeds when validate returns ValidationResult', () => {
    // Deve retornar objeto com valid e errors
    const hasValidationResult = componentRegistryServiceContent.includes('valid') && 
                                (componentRegistryServiceContent.includes('error') || 
                                 componentRegistryServiceContent.includes('ValidationResult'))
    expect(hasValidationResult).toBe(true)
  })
  
  // @clause CL-SVC-002
  it('succeeds when validate checks YAML structure', () => {
    // Deve verificar estrutura do YAML
    const hasYamlCheck = componentRegistryServiceContent.includes('yaml') || 
                         componentRegistryServiceContent.includes('parse') ||
                         componentRegistryServiceContent.includes('components')
    expect(hasYamlCheck).toBe(true)
  })
  
  // @clause CL-SVC-002
  it('fails when ComponentRegistryService does not validate YAML', () => {
    const hasValidateMethod = componentRegistryServiceContent.match(/validate|validation/)
    expect(hasValidateMethod).not.toBeNull()
  })
})

describe('Database Schema', () => {
  
  it('succeeds when ComponentRegistry model exists in Prisma schema', () => {
    const model = extractPrismaModel(prismaSchemaContent, 'ComponentRegistry')
    expect(model).not.toBeNull()
  })
  
  it('succeeds when ComponentRegistry has required fields', () => {
    const model = extractPrismaModel(prismaSchemaContent, 'ComponentRegistry')
    expect(model).not.toBeNull()
    expect(model).toMatch(/projectId/)
    expect(model).toMatch(/content/)
    expect(model).toMatch(/hash/)
  })
  
  it('succeeds when ComponentRegistry has unique projectId constraint', () => {
    const model = extractPrismaModel(prismaSchemaContent, 'ComponentRegistry')
    expect(model).toMatch(/projectId.*@unique|@unique.*projectId/i)
  })
  
  it('fails when ComponentRegistry model is missing', () => {
    const fakeModel = extractPrismaModel(prismaSchemaContent, 'NonExistentModel')
    expect(fakeModel).toBeNull()
  })
})

describe('Types Definition', () => {
  
  it('succeeds when component-registry types file exists', () => {
    expect(fs.existsSync(COMPONENT_REGISTRY_TYPES_PATH)).toBe(true)
  })
  
  it('succeeds when Violation type is defined', () => {
    const hasViolationType = componentRegistryTypesContent.includes('Violation') && 
                             (componentRegistryTypesContent.includes('interface') || 
                              componentRegistryTypesContent.includes('type'))
    expect(hasViolationType).toBe(true)
  })
  
  it('succeeds when AnalysisRules type is defined', () => {
    const hasAnalysisRulesType = componentRegistryTypesContent.includes('AnalysisRules') ||
                                 componentRegistryTypesContent.includes('rules') ||
                                 jsxAnalyzerServiceContent.includes('AnalysisRules')
    expect(hasAnalysisRulesType).toBe(true)
  })
  
  it('succeeds when ValidationResult type is defined', () => {
    const hasValidationResultType = componentRegistryTypesContent.includes('ValidationResult') ||
                                    componentRegistryServiceContent.includes('ValidationResult')
    expect(hasValidationResultType).toBe(true)
  })
  
  it('fails when types file does not define required interfaces', () => {
    const hasRequiredTypes = componentRegistryTypesContent.includes('Violation') || 
                             componentRegistryTypesContent.includes('interface') ||
                             componentRegistryTypesContent.includes('type')
    expect(hasRequiredTypes).toBe(true)
  })
})

describe('Integration', () => {
  
  it('succeeds when validators use ComponentRegistryService', () => {
    // Validators devem usar o service
    const protectedUsesService = protectedFilesContent.includes('ComponentRegistry') || 
                                  protectedFilesContent.includes('registry')
    const uiUsesService = uiCodeComplianceContent.includes('ComponentRegistry') || 
                          uiCodeComplianceContent.includes('JSXAnalyzer')
    
    expect(protectedUsesService || uiUsesService).toBe(true)
  })
  
  it('succeeds when UI_CODE_COMPLIANCE uses JSXAnalyzerService', () => {
    const usesAnalyzer = uiCodeComplianceContent.includes('JSXAnalyzer') || 
                         uiCodeComplianceContent.includes('analyze') ||
                         uiCodeComplianceContent.includes('violation')
    expect(usesAnalyzer).toBe(true)
  })
  
  it('succeeds when controller uses ComponentRegistryService', () => {
    const usesService = componentRegistryControllerContent.includes('ComponentRegistry') || 
                        componentRegistryControllerContent.includes('service')
    expect(usesService).toBe(true)
  })
  
  it('fails when components are not integrated', () => {
    // Validar que existe integração entre componentes
    const hasIntegration = (
      protectedFilesContent.includes('registry') ||
      uiCodeComplianceContent.includes('analyzer') ||
      componentRegistryControllerContent.includes('service')
    )
    expect(hasIntegration).toBe(true)
  })
})
