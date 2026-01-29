import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { glob } from 'glob'

/**
 * Database Cleanup Contract Spec
 * ==============================
 * 
 * Contrato: remove-theme-ui-contract-database
 * Objetivo: Remover modelos Theme e UIContract do database layer do Gatekeeper
 * 
 * REGRA: Se estes testes falharem, a LLM executora errou na implementação.
 * Os testes validam estrutura estática e contratos, não comportamento runtime.
 */

// === CAMINHOS DOS ARQUIVOS ===

// __dirname = packages/gatekeeper-api/src/domain/validators
const API_ROOT = path.resolve(__dirname, '../../..') // packages/gatekeeper-api
const PRISMA_DIR = path.join(API_ROOT, 'prisma')
const PRISMA_SCHEMA_PATH = path.join(PRISMA_DIR, 'schema.prisma')
const SEED_PATH = path.join(PRISMA_DIR, 'seed.ts')
const MIGRATIONS_DIR = path.join(PRISMA_DIR, 'migrations')

// === MODELS QUE DEVEM SER PRESERVADOS ===

const PRESERVED_MODELS = [
  'Workspace',
  'Project',
  'WorkspaceConfig',
  'ValidationRun',
  'GateResult',
  'ValidatorResult',
  'ValidationLog',
  'ManifestFile',
  'SensitiveFileRule',
  'AmbiguousTerm',
  'ValidationConfig',
  'TestPathConvention',
  'ValidatorMetadata',
] as const

// === CAMPOS DO PROJECT QUE DEVEM SER PRESERVADOS ===

const PRESERVED_PROJECT_FIELDS = [
  'id',
  'workspaceId',
  'workspace',
  'name',
  'description',
  'baseRef',
  'targetRef',
  'backendWorkspace',
  'isActive',
  'createdAt',
  'updatedAt',
  'validationRuns',
] as const

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
  const lines = modelContent.split('\n')
  const fields: string[] = []
  
  for (const line of lines) {
    const trimmed = line.trim()
    // Skip empty lines, comments, and index declarations
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) {
      continue
    }
    // Extract field name (first word before space)
    const fieldMatch = trimmed.match(/^(\w+)\s+/)
    if (fieldMatch) {
      fields.push(fieldMatch[1])
    }
  }
  
  return fields
}

function countPatternOccurrences(content: string, pattern: string): number {
  const regex = new RegExp(pattern, 'g')
  const matches = content.match(regex)
  return matches ? matches.length : 0
}

async function findMigrationFiles(): Promise<string[]> {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return []
  }
  
  const pattern = path.join(MIGRATIONS_DIR, '**/migration.sql').replace(/\\/g, '/')
  return glob.sync(pattern)
}

function findLatestMigrationWithDropThemeOrUIContract(migrationFiles: string[]): string | null {
  // Look for migration files that contain DROP for Theme or UIContract
  for (const file of migrationFiles.reverse()) {
    const content = fs.readFileSync(file, 'utf-8')
    if (
      content.includes('DROP TABLE') && 
      (content.toLowerCase().includes('theme') || content.toLowerCase().includes('uicontract'))
    ) {
      return file
    }
  }
  return null
}

// === VARIÁVEIS GLOBAIS PARA CACHE ===

let prismaSchema: string
let seedContent: string
let migrationFiles: string[]
let relevantMigrationPath: string | null
let relevantMigrationContent: string | null

// === SETUP ===

beforeAll(async () => {
  prismaSchema = readFileContent(PRISMA_SCHEMA_PATH)
  seedContent = readFileContent(SEED_PATH)
  migrationFiles = await findMigrationFiles()
  relevantMigrationPath = findLatestMigrationWithDropThemeOrUIContract(migrationFiles)
  
  if (relevantMigrationPath) {
    relevantMigrationContent = readFileContent(relevantMigrationPath)
  } else {
    relevantMigrationContent = null
  }
})

// === TESTES ===

describe('Database Cleanup Contract - Remove Theme and UIContract', () => {
  
  describe('CL-DB-001: Schema não contém model Theme', () => {
    
    // @clause CL-DB-001
    it('succeeds when model Theme is not present in schema.prisma', () => {
      const modelContent = extractPrismaModel(prismaSchema, 'Theme')
      expect(modelContent).toBeNull()
    })
    
    // @clause CL-DB-001
    it('succeeds when "model Theme" literal string is absent from schema', () => {
      const occurrences = countPatternOccurrences(prismaSchema, 'model\\s+Theme\\s*\\{')
      expect(occurrences).toBe(0)
    })
    
    // @clause CL-DB-001
    it('fails when schema still contains Theme model definition', () => {
      // Validates that our extraction logic would find Theme if it existed
      const fakeSchemaWithTheme = `
        model Theme {
          id String @id
          name String
        }
      `
      const modelContent = extractPrismaModel(fakeSchemaWithTheme, 'Theme')
      expect(modelContent).not.toBeNull()
      
      // But actual schema should NOT have it
      const actualModel = extractPrismaModel(prismaSchema, 'Theme')
      expect(actualModel).toBeNull()
    })
  })

  describe('CL-DB-002: Schema não contém model UIContract', () => {
    
    // @clause CL-DB-002
    it('succeeds when model UIContract is not present in schema.prisma', () => {
      const modelContent = extractPrismaModel(prismaSchema, 'UIContract')
      expect(modelContent).toBeNull()
    })
    
    // @clause CL-DB-002
    it('succeeds when "model UIContract" literal string is absent from schema', () => {
      const occurrences = countPatternOccurrences(prismaSchema, 'model\\s+UIContract\\s*\\{')
      expect(occurrences).toBe(0)
    })
    
    // @clause CL-DB-002
    it('fails when schema still contains UIContract model definition', () => {
      // Validates that our extraction logic works
      const fakeSchemaWithUIContract = `
        model UIContract {
          id String @id
          projectId String
        }
      `
      const modelContent = extractPrismaModel(fakeSchemaWithUIContract, 'UIContract')
      expect(modelContent).not.toBeNull()
      
      // But actual schema should NOT have it
      const actualModel = extractPrismaModel(prismaSchema, 'UIContract')
      expect(actualModel).toBeNull()
    })
  })

  describe('CL-DB-003: Project não tem relação uiContract', () => {
    
    // @clause CL-DB-003
    it('succeeds when Project model does not contain uiContract field', () => {
      const projectModel = extractPrismaModel(prismaSchema, 'Project')
      expect(projectModel).not.toBeNull()
      
      const hasUIContractField = projectModel!.includes('uiContract')
      expect(hasUIContractField).toBe(false)
    })
    
    // @clause CL-DB-003
    it('succeeds when Project model does not reference UIContract type', () => {
      const projectModel = extractPrismaModel(prismaSchema, 'Project')
      expect(projectModel).not.toBeNull()
      
      // Should not have any line with UIContract reference
      const hasUIContractType = /UIContract/.test(projectModel!)
      expect(hasUIContractType).toBe(false)
    })
    
    // @clause CL-DB-003
    it('fails when Project model still has uiContract relation', () => {
      const fakeProjectWithUIContract = `
        id String @id
        name String
        uiContract UIContract?
      `
      const hasUIContractField = fakeProjectWithUIContract.includes('uiContract')
      expect(hasUIContractField).toBe(true)
      
      // But actual Project model should NOT have it
      const actualProjectModel = extractPrismaModel(prismaSchema, 'Project')
      expect(actualProjectModel).not.toBeNull()
      expect(actualProjectModel!.includes('uiContract')).toBe(false)
    })
  })

  describe('CL-DB-004: Migration DROP Theme existe', () => {
    
    // @clause CL-DB-004
    it('succeeds when a migration file contains DROP TABLE for Theme', () => {
      expect(relevantMigrationContent).not.toBeNull()
      
      // Case-insensitive check for DROP TABLE ... Theme
      const hasDropTheme = /DROP\s+TABLE\s+IF\s+EXISTS\s+["']?Theme["']?/i.test(relevantMigrationContent!)
      expect(hasDropTheme).toBe(true)
    })
    
    // @clause CL-DB-004
    it('succeeds when migration drops Theme indexes before table', () => {
      expect(relevantMigrationContent).not.toBeNull()
      
      // Should drop indexes - at minimum Theme_name_key or Theme_isActive_idx
      const hasIndexDrop = /DROP\s+INDEX\s+IF\s+EXISTS\s+["']?Theme_/i.test(relevantMigrationContent!)
      expect(hasIndexDrop).toBe(true)
    })
    
    // @clause CL-DB-004
    it('fails when no migration contains Theme DROP statements', () => {
      // This test validates that our detection works
      const fakeMigration = 'DROP TABLE IF EXISTS "SomeOther";'
      const hasDropTheme = /DROP\s+TABLE\s+IF\s+EXISTS\s+["']?Theme["']?/i.test(fakeMigration)
      expect(hasDropTheme).toBe(false)
      
      // But actual migration SHOULD have it
      expect(relevantMigrationContent).not.toBeNull()
      const actualHasDropTheme = /DROP\s+TABLE\s+IF\s+EXISTS\s+["']?Theme["']?/i.test(relevantMigrationContent!)
      expect(actualHasDropTheme).toBe(true)
    })
  })

  describe('CL-DB-005: Migration DROP UIContract existe', () => {
    
    // @clause CL-DB-005
    it('succeeds when a migration file contains DROP TABLE for UIContract', () => {
      expect(relevantMigrationContent).not.toBeNull()
      
      // Case-insensitive check for DROP TABLE ... UIContract
      const hasDropUIContract = /DROP\s+TABLE\s+IF\s+EXISTS\s+["']?UIContract["']?/i.test(relevantMigrationContent!)
      expect(hasDropUIContract).toBe(true)
    })
    
    // @clause CL-DB-005
    it('succeeds when migration drops UIContract indexes before table', () => {
      expect(relevantMigrationContent).not.toBeNull()
      
      // Should drop indexes - at minimum UIContract_projectId_key or UIContract_projectId_idx
      const hasIndexDrop = /DROP\s+INDEX\s+IF\s+EXISTS\s+["']?UIContract_/i.test(relevantMigrationContent!)
      expect(hasIndexDrop).toBe(true)
    })
    
    // @clause CL-DB-005
    it('fails when no migration contains UIContract DROP statements', () => {
      // This test validates that our detection works
      const fakeMigration = 'DROP TABLE IF EXISTS "SomeOther";'
      const hasDropUIContract = /DROP\s+TABLE\s+IF\s+EXISTS\s+["']?UIContract["']?/i.test(fakeMigration)
      expect(hasDropUIContract).toBe(false)
      
      // But actual migration SHOULD have it
      expect(relevantMigrationContent).not.toBeNull()
      const actualHasDropUIContract = /DROP\s+TABLE\s+IF\s+EXISTS\s+["']?UIContract["']?/i.test(relevantMigrationContent!)
      expect(actualHasDropUIContract).toBe(true)
    })
  })

  describe('CL-DB-006: Seed não contém UI_PLAN_COVERAGE', () => {
    
    // @clause CL-DB-006
    it('succeeds when seed.ts does not contain UI_PLAN_COVERAGE in validatorConfigs', () => {
      // Check for the key in validator configs array
      const hasInValidatorConfigs = /['"]UI_PLAN_COVERAGE['"]/.test(seedContent)
      expect(hasInValidatorConfigs).toBe(false)
    })
    
    // @clause CL-DB-006
    it('succeeds when seed.ts validatorMetadata does not have UI_PLAN_COVERAGE entry', () => {
      // Look for code: 'UI_PLAN_COVERAGE' pattern
      const hasInMetadata = /code:\s*['"]UI_PLAN_COVERAGE['"]/.test(seedContent)
      expect(hasInMetadata).toBe(false)
    })
    
    // @clause CL-DB-006
    it('fails when UI_PLAN_COVERAGE still exists anywhere in seed.ts', () => {
      const occurrences = countPatternOccurrences(seedContent, 'UI_PLAN_COVERAGE')
      expect(occurrences).toBe(0)
    })
  })

  describe('CL-DB-007: Seed não contém UI_TEST_COVERAGE', () => {
    
    // @clause CL-DB-007
    it('succeeds when seed.ts does not contain UI_TEST_COVERAGE in validatorConfigs', () => {
      const hasInValidatorConfigs = /['"]UI_TEST_COVERAGE['"]/.test(seedContent)
      expect(hasInValidatorConfigs).toBe(false)
    })
    
    // @clause CL-DB-007
    it('succeeds when seed.ts validatorMetadata does not have UI_TEST_COVERAGE entry', () => {
      const hasInMetadata = /code:\s*['"]UI_TEST_COVERAGE['"]/.test(seedContent)
      expect(hasInMetadata).toBe(false)
    })
    
    // @clause CL-DB-007
    it('fails when UI_TEST_COVERAGE still exists anywhere in seed.ts', () => {
      const occurrences = countPatternOccurrences(seedContent, 'UI_TEST_COVERAGE')
      expect(occurrences).toBe(0)
    })
  })

  describe('CL-DB-008: Outros models permanecem intactos', () => {
    
    // @clause CL-DB-008
    it('succeeds when all preserved models still exist in schema', () => {
      for (const modelName of PRESERVED_MODELS) {
        const modelContent = extractPrismaModel(prismaSchema, modelName)
        expect(modelContent, `Model ${modelName} should exist in schema`).not.toBeNull()
      }
    })
    
    // @clause CL-DB-008
    it('succeeds when Workspace model has expected fields', () => {
      const workspaceModel = extractPrismaModel(prismaSchema, 'Workspace')
      expect(workspaceModel).not.toBeNull()
      
      const fields = extractModelFields(workspaceModel!)
      expect(fields).toContain('id')
      expect(fields).toContain('name')
      expect(fields).toContain('rootPath')
      expect(fields).toContain('projects')
    })
    
    // @clause CL-DB-008
    it('succeeds when Project model preserves all non-uiContract fields', () => {
      const projectModel = extractPrismaModel(prismaSchema, 'Project')
      expect(projectModel).not.toBeNull()
      
      const fields = extractModelFields(projectModel!)
      
      for (const expectedField of PRESERVED_PROJECT_FIELDS) {
        expect(fields, `Project should have field: ${expectedField}`).toContain(expectedField)
      }
    })
    
    // @clause CL-DB-008
    it('succeeds when ValidationRun model is unchanged', () => {
      const validationRunModel = extractPrismaModel(prismaSchema, 'ValidationRun')
      expect(validationRunModel).not.toBeNull()
      
      const fields = extractModelFields(validationRunModel!)
      
      // Core fields that must exist
      expect(fields).toContain('id')
      expect(fields).toContain('projectId')
      expect(fields).toContain('outputId')
      expect(fields).toContain('status')
      expect(fields).toContain('passed')
    })
    
    // @clause CL-DB-008
    it('succeeds when ValidatorMetadata model is unchanged', () => {
      const validatorMetadataModel = extractPrismaModel(prismaSchema, 'ValidatorMetadata')
      expect(validatorMetadataModel).not.toBeNull()
      
      const fields = extractModelFields(validatorMetadataModel!)
      
      expect(fields).toContain('id')
      expect(fields).toContain('code')
      expect(fields).toContain('displayName')
      expect(fields).toContain('description')
      expect(fields).toContain('category')
      expect(fields).toContain('gate')
    })
    
    // @clause CL-DB-008
    it('fails when any preserved model is accidentally removed', () => {
      // Validates our detection logic works for missing models
      const fakeSchema = `
        model Workspace { id String @id }
      `
      
      // Project should NOT exist in fake schema
      const missingModel = extractPrismaModel(fakeSchema, 'Project')
      expect(missingModel).toBeNull()
      
      // But ALL preserved models SHOULD exist in actual schema
      for (const modelName of PRESERVED_MODELS) {
        const modelContent = extractPrismaModel(prismaSchema, modelName)
        expect(modelContent, `${modelName} must exist`).not.toBeNull()
      }
    })
  })

  describe('Assertion Surface: Seed Validator Count', () => {
    
    // @clause CL-DB-006
    // @clause CL-DB-007
    it('succeeds when seed.ts has exactly 24 validator configs after removal', () => {
      // Original: 26 validators, minus UI_PLAN_COVERAGE and UI_TEST_COVERAGE = 24
      const validatorConfigMatches = seedContent.match(/\{\s*key:\s*['"][A-Z_]+['"]/g)
      
      // Count should be 24 (original 26 minus 2 UI validators)
      // Note: This accounts for both validatorConfigs entries
      expect(validatorConfigMatches).not.toBeNull()
      expect(validatorConfigMatches!.length).toBe(24)
    })
    
    // @clause CL-DB-006
    // @clause CL-DB-007
    it('succeeds when seed.ts has exactly 24 validator metadata entries after removal', () => {
      // Original: 26 validators, minus UI_PLAN_COVERAGE and UI_TEST_COVERAGE = 24
      const metadataMatches = seedContent.match(/\{\s*code:\s*['"][A-Z_]+['"]/g)
      
      expect(metadataMatches).not.toBeNull()
      expect(metadataMatches!.length).toBe(24)
    })
  })

  describe('Additional Invariants', () => {
    
    // @clause CL-DB-001
    // @clause CL-DB-002
    it('succeeds when schema file is valid (no syntax indicators of broken relations)', () => {
      // A broken relation would typically show as orphaned @relation directive
      // If UIContract is removed but Project still references it, schema would be invalid
      
      // Count @relation directives referencing UIContract
      const brokenRelations = /@relation\([^)]*UIContract[^)]*\)/g.test(prismaSchema)
      expect(brokenRelations).toBe(false)
    })
    
    // @clause CL-DB-004
    // @clause CL-DB-005
    it('succeeds when migration file exists in migrations directory', () => {
      expect(relevantMigrationPath).not.toBeNull()
      expect(fs.existsSync(relevantMigrationPath!)).toBe(true)
    })
    
    // @clause CL-DB-008
    it('succeeds when Project model still has validationRuns relation', () => {
      const projectModel = extractPrismaModel(prismaSchema, 'Project')
      expect(projectModel).not.toBeNull()
      
      // Project must still have validationRuns relation
      expect(projectModel).toMatch(/validationRuns\s+ValidationRun\[\]/)
    })
  })
})
