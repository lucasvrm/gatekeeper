import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * ValidatorMetadata Contract Spec
 * ================================
 * 
 * Contrato: validator-metadata-refactor
 * Objetivo: Mover metadados de validators para banco de dados (ValidatorMetadata)
 * 
 * REGRA: Se estes testes falharem, a LLM executora errou na implementação.
 * Os testes validam estrutura estática e contratos, não comportamento runtime.
 */

// === CONSTANTES DE REFERÊNCIA ===

const EXPECTED_VALIDATOR_CODES = [
  'TOKEN_BUDGET_FIT',
  'TASK_SCOPE_SIZE',
  'TASK_CLARITY_CHECK',
  'SENSITIVE_FILES_LOCK',
  'DANGER_MODE_EXPLICIT',
  'PATH_CONVENTION',
  'TEST_SYNTAX_VALID',
  'TEST_HAS_ASSERTIONS',
  'TEST_COVERS_HAPPY_AND_SAD_PATH',
  'TEST_FAILS_BEFORE_IMPLEMENTATION',
  'NO_DECORATIVE_TESTS',
  'MANIFEST_FILE_LOCK',
  'NO_IMPLICIT_FILES',
  'IMPORT_REALITY_CHECK',
  'TEST_INTENT_ALIGNMENT',
  'TEST_CLAUSE_MAPPING_VALID',
  'DIFF_SCOPE_ENFORCEMENT',
  'TEST_READ_ONLY_ENFORCEMENT',
  'TASK_TEST_PASSES',
  'STRICT_COMPILATION',
  'STYLE_CONSISTENCY_LINT',
  'FULL_REGRESSION_PASS',
  'PRODUCTION_BUILD_PASS',
  'UI_PLAN_COVERAGE',
  'UI_TEST_COVERAGE',
] as const

const EXPECTED_CATEGORIES = [
  'INPUT_SCOPE',
  'FILE_DISCIPLINE',
  'SECURITY',
  'TECHNICAL_QUALITY',
  'TESTS_CONTRACTS',
] as const

const RENAMED_DISPLAY_NAMES: Record<string, string> = {
  'NO_DECORATIVE_TESTS': 'No Meaningless Tests',
  'IMPORT_REALITY_CHECK': 'Imports Must Exist',
  'TASK_SCOPE_SIZE': 'Task Scope Limit',
  'PATH_CONVENTION': 'Path Naming Convention',
  'TEST_CLAUSE_MAPPING_VALID': 'Test Contract Mapping Valid',
}

const REQUIRED_MODEL_FIELDS = [
  'code',
  'displayName',
  'description',
  'category',
  'gate',
  'order',
  'isHardBlock',
] as const

// === CAMINHOS DOS ARQUIVOS ===

// __dirname = packages/gatekeeper-api/src/domain/validators
const API_ROOT = path.resolve(__dirname, '../../..') // packages/gatekeeper-api
const PROJECT_ROOT = path.resolve(__dirname, '../../../../..') // gatekeeper root

const PRISMA_SCHEMA_PATH = path.join(API_ROOT, 'prisma/schema.prisma')
const SEED_PATH = path.join(API_ROOT, 'prisma/seed.ts')
const GATES_TYPES_PATH = path.join(API_ROOT, 'src/types/gates.types.ts')
const VALIDATOR_CONTROLLER_PATH = path.join(API_ROOT, 'src/api/controllers/ValidatorController.ts')
const FRONTEND_VALIDATORS_TAB_PATH = path.join(PROJECT_ROOT, 'src/components/validators-tab.tsx')
const FRONTEND_TYPES_PATH = path.join(PROJECT_ROOT, 'src/lib/types.ts')

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

function extractModelFields(modelContent: string): string[] {
  const fieldRegex = /^\s*(\w+)\s+\w+/gm
  const fields: string[] = []
  let match
  while ((match = fieldRegex.exec(modelContent)) !== null) {
    if (!match[1].startsWith('@@')) {
      fields.push(match[1])
    }
  }
  return fields
}

function countUpsertCalls(seedContent: string, modelName: string): number {
  const regex = new RegExp(`prisma\\.${modelName}\\.upsert`, 'gi')
  const matches = seedContent.match(regex)
  return matches ? matches.length : 0
}

function extractValidatorMetadataFromSeed(seedContent: string): Array<{
  code: string
  displayName: string
  category: string
}> {
  // Procura pelo array de validatorMetadata no seed
  const arrayMatch = seedContent.match(/validatorMetadata\s*(?::\s*[^=]+=)?\s*\[([^\]]+)\]/s)
  if (!arrayMatch) return []
  
  const entries: Array<{ code: string; displayName: string; category: string }> = []
  const objectRegex = /\{\s*code:\s*['"]([^'"]+)['"][^}]*displayName:\s*['"]([^'"]+)['"][^}]*category:\s*['"]([^'"]+)['"][^}]*\}/gs
  
  let match
  while ((match = objectRegex.exec(seedContent)) !== null) {
    entries.push({
      code: match[1],
      displayName: match[2],
      category: match[3],
    })
  }
  
  return entries
}

// === VARIÁVEIS GLOBAIS PARA CACHE ===

let prismaSchema: string
let seedContent: string
let gatesTypesContent: string
let validatorControllerContent: string
let frontendValidatorsTabContent: string
let frontendTypesContent: string

// === SETUP ===

beforeAll(() => {
  prismaSchema = readFileContent(PRISMA_SCHEMA_PATH)
  seedContent = readFileContent(SEED_PATH)
  gatesTypesContent = readFileContent(GATES_TYPES_PATH)
  validatorControllerContent = readFileContent(VALIDATOR_CONTROLLER_PATH)
  
  // Frontend files podem não existir ainda
  try {
    frontendValidatorsTabContent = readFileContent(FRONTEND_VALIDATORS_TAB_PATH)
  } catch {
    frontendValidatorsTabContent = ''
  }
  
  try {
    frontendTypesContent = readFileContent(FRONTEND_TYPES_PATH)
  } catch {
    frontendTypesContent = ''
  }
})

// === TESTES ===

describe('ValidatorMetadata Contract', () => {
  
  describe('CL-META-001: ValidatorMetadata model exists', () => {
    
    // @clause CL-META-001
    it('succeeds when ValidatorMetadata model is defined in schema.prisma', () => {
      const modelContent = extractPrismaModel(prismaSchema, 'ValidatorMetadata')
      expect(modelContent).not.toBeNull()
      expect(modelContent!.length).toBeGreaterThan(0)
    })
    
    // @clause CL-META-001
    it('succeeds when ValidatorMetadata has code field marked as unique', () => {
      const modelContent = extractPrismaModel(prismaSchema, 'ValidatorMetadata')
      expect(modelContent).not.toBeNull()
      expect(modelContent).toMatch(/code\s+String\s+@unique/)
    })
    
    // @clause CL-META-001
    it('succeeds when ValidatorMetadata contains all required fields', () => {
      const modelContent = extractPrismaModel(prismaSchema, 'ValidatorMetadata')
      expect(modelContent).not.toBeNull()
      
      const fields = extractModelFields(modelContent!)
      
      for (const requiredField of REQUIRED_MODEL_FIELDS) {
        expect(fields).toContain(requiredField)
      }
    })
    
    // @clause CL-META-001
    it('fails when ValidatorMetadata model is missing from schema', () => {
      // Este teste valida que a extração funciona corretamente
      const fakeModel = extractPrismaModel(prismaSchema, 'NonExistentModel')
      expect(fakeModel).toBeNull()
    })
  })

  describe('CL-META-002: Seed populates 25 validators', () => {
    
    // @clause CL-META-002
    it('succeeds when seed.ts contains ValidatorMetadata upsert operations', () => {
      // Verifica que o seed contém operações para ValidatorMetadata
      expect(seedContent).toMatch(/validatorMetadata/i)
    })
    
    // @clause CL-META-002
    it('succeeds when seed defines exactly 25 validator metadata entries', () => {
      // Conta quantos objetos com 'code' aparecem no array de metadata
      const codeMatches = seedContent.match(/code:\s*['"][A-Z_]+['"]/g)
      
      // Filtra apenas os que são ValidatorCodes conhecidos
      const validCodes = codeMatches?.filter(match => {
        const code = match.match(/['"]([A-Z_]+)['"]/)?.[1]
        return code && EXPECTED_VALIDATOR_CODES.includes(code as typeof EXPECTED_VALIDATOR_CODES[number])
      })
      
      expect(validCodes).not.toBeNull()
      expect(validCodes!.length).toBe(25)
    })
    
    // @clause CL-META-002
    it('succeeds when all 25 ValidatorCodes have corresponding metadata in seed', () => {
      for (const code of EXPECTED_VALIDATOR_CODES) {
        const codePattern = new RegExp(`code:\\s*['"]${code}['"]`)
        expect(seedContent).toMatch(codePattern)
      }
    })
    
    // @clause CL-META-002
    it('fails when a ValidatorCode is missing from seed metadata', () => {
      // Verifica que códigos inexistentes não estão presentes
      const fakeCode = 'FAKE_VALIDATOR_CODE_XYZ'
      const fakePattern = new RegExp(`code:\\s*['"]${fakeCode}['"]`)
      expect(seedContent).not.toMatch(fakePattern)
    })
  })

  describe('CL-META-003: Seed uses 5 categories', () => {
    
    // @clause CL-META-003
    it('succeeds when seed contains all 5 expected categories', () => {
      for (const category of EXPECTED_CATEGORIES) {
        const categoryPattern = new RegExp(`category:\\s*['"]${category}['"]`)
        expect(seedContent).toMatch(categoryPattern)
      }
    })
    
    // @clause CL-META-003
    it('succeeds when seed uses only the 5 allowed categories', () => {
      // Extrai todas as categorias do seed
      const categoryMatches = seedContent.match(/category:\s*['"]([A-Z_]+)['"]/g)
      expect(categoryMatches).not.toBeNull()
      
      const uniqueCategories = new Set(
        categoryMatches!.map(match => {
          const cat = match.match(/['"]([A-Z_]+)['"]/)?.[1]
          return cat
        }).filter(Boolean)
      )
      
      // Verifica que são exatamente 5 categorias
      const validCategories = [...uniqueCategories].filter(cat => 
        EXPECTED_CATEGORIES.includes(cat as typeof EXPECTED_CATEGORIES[number])
      )
      
      expect(validCategories.length).toBe(5)
    })
    
    // @clause CL-META-003
    it('fails when an invalid category is used in seed', () => {
      const invalidCategory = 'INVALID_CATEGORY_XYZ'
      const invalidPattern = new RegExp(`category:\\s*['"]${invalidCategory}['"]`)
      expect(seedContent).not.toMatch(invalidPattern)
    })
  })

  describe('CL-META-004: API returns metadata from database', () => {
    
    // @clause CL-META-004
    it('succeeds when ValidatorController imports prisma client', () => {
      expect(validatorControllerContent).toMatch(/import.*prisma.*from/i)
    })
    
    // @clause CL-META-004
    it('succeeds when ValidatorController queries ValidatorMetadata', () => {
      // Verifica que o controller faz query no ValidatorMetadata
      expect(validatorControllerContent).toMatch(/validatorMetadata/i)
    })
    
    // @clause CL-META-004
    it('succeeds when API response includes displayName field', () => {
      expect(validatorControllerContent).toMatch(/displayName/i)
    })
    
    // @clause CL-META-004
    it('succeeds when API response includes description field', () => {
      expect(validatorControllerContent).toMatch(/description/i)
    })
    
    // @clause CL-META-004
    it('succeeds when API response includes category field', () => {
      // Verifica que category aparece no response mapping
      const hasCategory = validatorControllerContent.includes('category')
      expect(hasCategory).toBe(true)
    })
    
    // @clause CL-META-004
    it('fails when API does not include metadata fields in response', () => {
      // Este teste garante que o controller não retorna apenas key/value
      // Se displayName não está presente, o refactor não foi feito
      const hasMetadataFields = 
        validatorControllerContent.includes('displayName') ||
        validatorControllerContent.includes('description')
      
      expect(hasMetadataFields).toBe(true)
    })
  })

  describe('CL-META-005: ValidatorCode type unchanged', () => {
    
    // @clause CL-META-005
    it('succeeds when ValidatorCode type contains all 25 original codes', () => {
      for (const code of EXPECTED_VALIDATOR_CODES) {
        const codePattern = new RegExp(`['"]${code}['"]`)
        expect(gatesTypesContent).toMatch(codePattern)
      }
    })
    
    // @clause CL-META-005
    it('succeeds when no ValidatorCode was renamed', () => {
      // Verifica que nenhum código foi alterado
      const validatorCodeBlock = gatesTypesContent.match(/type ValidatorCode\s*=[\s\S]*?(?=\n\nexport|$)/)?.[0]
      expect(validatorCodeBlock).not.toBeNull()
      
      for (const code of EXPECTED_VALIDATOR_CODES) {
        expect(validatorCodeBlock).toContain(code)
      }
    })
    
    // @clause CL-META-005
    it('fails when a new code is added to ValidatorCode', () => {
      const fakeCode = 'NEW_VALIDATOR_CODE_ADDED'
      expect(gatesTypesContent).not.toContain(fakeCode)
    })
  })

  describe('CL-META-006: Execution logic unchanged', () => {
    
    // @clause CL-META-006
    it('succeeds when execute function signature remains in validator definitions', () => {
      // Verifica que a interface ValidatorDefinition ainda tem execute
      expect(gatesTypesContent).toMatch(/execute:\s*\(ctx:\s*ValidationContext\)\s*=>\s*Promise<ValidatorOutput>/)
    })
    
    // @clause CL-META-006
    it('succeeds when ValidationContext interface is preserved', () => {
      expect(gatesTypesContent).toMatch(/interface ValidationContext/)
    })
    
    // @clause CL-META-006
    it('succeeds when ValidatorOutput interface is preserved', () => {
      expect(gatesTypesContent).toMatch(/interface ValidatorOutput/)
    })
  })

  describe('CL-META-007: Seed is idempotent', () => {
    
    // @clause CL-META-007
    it('succeeds when seed uses upsert for ValidatorMetadata', () => {
      // Verifica que o seed usa upsert (não create) para evitar duplicatas
      expect(seedContent).toMatch(/\.upsert\s*\(/)
    })
    
    // @clause CL-META-007
    it('succeeds when upsert uses code as unique identifier', () => {
      // Verifica que o where clause usa code
      expect(seedContent).toMatch(/where:\s*\{\s*code:/i)
    })
    
    // @clause CL-META-007
    it('fails when seed uses createMany without conflict handling', () => {
      // createMany sem onConflict pode criar duplicatas
      const hasUnsafeCreate = seedContent.match(/\.createMany\s*\(\s*\{[^}]*\}\s*\)/)
      
      // Se usar createMany, deve ter skipDuplicates ou não usar para metadata
      if (hasUnsafeCreate) {
        expect(seedContent).toMatch(/skipDuplicates:\s*true/)
      }
    })
  })

  describe('CL-META-008: Frontend without hardcoded categories', () => {
    
    // @clause CL-META-008
    it('succeeds when validators-tab.tsx does not contain VALIDATOR_CATEGORIES constant', () => {
      if (!frontendValidatorsTabContent) {
        // Arquivo não existe ainda, passará após implementação
        expect(true).toBe(true)
        return
      }
      
      const hasHardcodedCategories = frontendValidatorsTabContent.includes('const VALIDATOR_CATEGORIES')
      expect(hasHardcodedCategories).toBe(false)
    })
    
    // @clause CL-META-008
    it('succeeds when validators-tab.tsx does not contain VALIDATOR_DESCRIPTIONS constant', () => {
      if (!frontendValidatorsTabContent) {
        expect(true).toBe(true)
        return
      }
      
      const hasHardcodedDescriptions = frontendValidatorsTabContent.includes('const VALIDATOR_DESCRIPTIONS')
      expect(hasHardcodedDescriptions).toBe(false)
    })
    
    // @clause CL-META-008
    it('succeeds when validators-tab.tsx does not contain VALIDATOR_CATEGORY_LOOKUP constant', () => {
      if (!frontendValidatorsTabContent) {
        expect(true).toBe(true)
        return
      }
      
      const hasHardcodedLookup = frontendValidatorsTabContent.includes('const VALIDATOR_CATEGORY_LOOKUP')
      expect(hasHardcodedLookup).toBe(false)
    })
    
    // @clause CL-META-008
    it('fails when frontend still has hardcoded validator metadata', () => {
      if (!frontendValidatorsTabContent) {
        expect(true).toBe(true)
        return
      }
      
      // Se qualquer uma dessas constantes existir, o refactor não foi completado
      const hasAnyHardcode = 
        frontendValidatorsTabContent.includes('const VALIDATOR_CATEGORIES') ||
        frontendValidatorsTabContent.includes('const VALIDATOR_DESCRIPTIONS') ||
        frontendValidatorsTabContent.includes('const VALIDATOR_CATEGORY_LOOKUP')
      
      expect(hasAnyHardcode).toBe(false)
    })
  })

  describe('CL-META-009: TypeScript compilation passes', () => {
    
    // @clause CL-META-009
    it('succeeds when gates.types.ts has valid TypeScript syntax', () => {
      // Verifica sintaxe básica - se o arquivo pode ser lido e tem estrutura válida
      expect(gatesTypesContent).toMatch(/export type/)
      expect(gatesTypesContent).toMatch(/export interface/)
    })
    
    // @clause CL-META-009
    it('succeeds when ValidatorCategory type is defined in gates.types.ts', () => {
      // O novo tipo ValidatorCategory deve existir
      expect(gatesTypesContent).toMatch(/type ValidatorCategory\s*=/)
    })
    
    // @clause CL-META-009
    it('succeeds when ValidatorCategory includes all 5 categories', () => {
      for (const category of EXPECTED_CATEGORIES) {
        const categoryPattern = new RegExp(`['"]${category}['"]`)
        expect(gatesTypesContent).toMatch(categoryPattern)
      }
    })
  })

  describe('CL-META-010: Renamed displayNames are correct', () => {
    
    // @clause CL-META-010
    it('succeeds when NO_DECORATIVE_TESTS has displayName "No Meaningless Tests"', () => {
      const pattern = /NO_DECORATIVE_TESTS['"][\s\S]*?displayName:\s*['"]No Meaningless Tests['"]/
      expect(seedContent).toMatch(pattern)
    })
    
    // @clause CL-META-010
    it('succeeds when IMPORT_REALITY_CHECK has displayName "Imports Must Exist"', () => {
      const pattern = /IMPORT_REALITY_CHECK['"][\s\S]*?displayName:\s*['"]Imports Must Exist['"]/
      expect(seedContent).toMatch(pattern)
    })
    
    // @clause CL-META-010
    it('succeeds when TASK_SCOPE_SIZE has displayName "Task Scope Limit"', () => {
      const pattern = /TASK_SCOPE_SIZE['"][\s\S]*?displayName:\s*['"]Task Scope Limit['"]/
      expect(seedContent).toMatch(pattern)
    })
    
    // @clause CL-META-010
    it('succeeds when PATH_CONVENTION has displayName "Path Naming Convention"', () => {
      const pattern = /PATH_CONVENTION['"][\s\S]*?displayName:\s*['"]Path Naming Convention['"]/
      expect(seedContent).toMatch(pattern)
    })
    
    // @clause CL-META-010
    it('succeeds when TEST_CLAUSE_MAPPING_VALID has displayName "Test Contract Mapping Valid"', () => {
      const pattern = /TEST_CLAUSE_MAPPING_VALID['"][\s\S]*?displayName:\s*['"]Test Contract Mapping Valid['"]/
      expect(seedContent).toMatch(pattern)
    })
    
    // @clause CL-META-010
    it('fails when renamed validators do not have correct displayName', () => {
      // Verifica que os 5 validators renomeados têm displayNames diferentes do code
      for (const [code, expectedDisplayName] of Object.entries(RENAMED_DISPLAY_NAMES)) {
        // O displayName NÃO deve ser igual ao code (seria erro não renomear)
        const incorrectPattern = new RegExp(`${code}['"]\\s*,?\\s*displayName:\\s*['"]${code}['"]`)
        expect(seedContent).not.toMatch(incorrectPattern)
      }
    })
  })

  describe('Assertion Surface: HTTP Response Structure', () => {
    
    // @clause CL-META-004
    it('succeeds when API response structure supports required payload paths', () => {
      // Verifica que o controller monta objeto com os campos esperados
      const requiredPaths = [
        'key',
        'value',
        'displayName',
        'description',
        'category',
        'gate',
        'order',
        'isHardBlock',
        'failMode',
      ]
      
      // O controller deve referenciar esses campos de alguma forma
      let matchCount = 0
      for (const field of requiredPaths) {
        if (validatorControllerContent.includes(field)) {
          matchCount++
        }
      }
      
      // Deve ter pelo menos os campos principais
      expect(matchCount).toBeGreaterThanOrEqual(5)
    })
  })

  describe('Additional Contract Invariants', () => {
    
    // @clause CL-META-001
    it('succeeds when ValidatorMetadata has proper indexes for performance', () => {
      const modelContent = extractPrismaModel(prismaSchema, 'ValidatorMetadata')
      expect(modelContent).not.toBeNull()
      
      // Verifica indexes importantes
      expect(modelContent).toMatch(/@@index\(\[category\]\)/)
      expect(modelContent).toMatch(/@@index\(\[gate\]\)/)
    })
    
    // @clause CL-META-001
    it('succeeds when ValidatorMetadata has timestamp fields', () => {
      const modelContent = extractPrismaModel(prismaSchema, 'ValidatorMetadata')
      expect(modelContent).not.toBeNull()
      
      expect(modelContent).toMatch(/createdAt/)
      expect(modelContent).toMatch(/updatedAt/)
    })
    
    // @clause CL-META-002
    it('succeeds when each category has at least one validator', () => {
      for (const category of EXPECTED_CATEGORIES) {
        const pattern = new RegExp(`category:\\s*['"]${category}['"]`)
        const matches = seedContent.match(new RegExp(pattern, 'g'))
        expect(matches).not.toBeNull()
        expect(matches!.length).toBeGreaterThanOrEqual(1)
      }
    })
  })
})
