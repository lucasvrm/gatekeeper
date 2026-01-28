/**
 * Lint and TypeScript Fixes Specification Tests
 *
 * Este spec valida as correções de 2 erros de lint e 7 erros de TypeScript
 * que bloqueiam build/CI.
 *
 * Os testes são contratos: se falharem, a LLM executora errou na implementação.
 *
 * Domínios cobertos:
 * - LINT (CL-LINT-001, 002): Erros de ESLint
 * - TS (CL-TS-001, 002): Erros de TypeScript
 * - INV (CL-INV-001, 002, 003): Invariantes de build
 *
 * @contract fix-lint-typescript-errors
 * @schemaVersion 1.0
 * @mode STRICT
 */

import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// ============================================================================
// PATH HELPERS
// ============================================================================

const cwd = process.cwd()
const isInBackendPackage = cwd.endsWith('gatekeeper-api') || cwd.includes('gatekeeper-api')

const BASE_PATH = isInBackendPackage ? cwd : path.resolve(cwd, 'packages/gatekeeper-api')
const SRC_PATH = path.join(BASE_PATH, 'src')

function readFile(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`)
  }
  return fs.readFileSync(filePath, 'utf-8')
}

function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath)
}

function extractInterfaceBlock(content: string, interfaceName: string): string | null {
  const regex = new RegExp(`(export\\s+)?interface\\s+${interfaceName}\\s*(extends\\s+[\\w,\\s]+)?\\s*\\{([^}]+)\\}`, 's')
  const match = content.match(regex)
  return match ? match[3] : null
}

// ============================================================================
// LINT ERRORS
// ============================================================================

describe('Lint Errors — File Extensions and Empty Blocks', () => {
  // @clause CL-LINT-001
  it('succeeds when ValidatorContext.spec uses .tsx extension', () => {
    const tsxPath = path.join(SRC_PATH, 'domain/validators/ValidatorContext.spec.tsx')
    const tsPath = path.join(SRC_PATH, 'domain/validators/ValidatorContext.spec.ts')

    // Arquivo .tsx DEVE existir
    const tsxExists = fileExists(tsxPath)
    expect(tsxExists).toBe(true)

    // Arquivo .ts NÃO deve existir (foi renomeado)
    const tsExists = fileExists(tsPath)
    expect(tsExists).toBe(false)
  })

  // @clause CL-LINT-001
  it('succeeds when ValidatorContext.spec.tsx contains JSX syntax', () => {
    const tsxPath = path.join(SRC_PATH, 'domain/validators/ValidatorContext.spec.tsx')
    
    // Pula se arquivo não existe (será pego pelo teste anterior)
    if (!fileExists(tsxPath)) {
      expect.fail('ValidatorContext.spec.tsx does not exist')
    }

    const content = readFile(tsxPath)

    // Deve conter JSX (elementos React)
    const hasJsxElements = /<[A-Za-z][^>]*>/.test(content)
    expect(hasJsxElements).toBe(true)

    // Deve conter elementos específicos do componente
    const hasDataTestId = /data-testid=["']validator-context-panel["']/.test(content)
    expect(hasDataTestId).toBe(true)
  })

  // @clause CL-LINT-002
  it('succeeds when TestFailsBeforeImplementation catch block has explanatory comment', () => {
    const filePath = path.join(SRC_PATH, 'domain/validators/gate1/TestFailsBeforeImplementation.ts')
    const content = readFile(filePath)

    // Encontra o bloco catch do cleanup do filesystem
    // Padrão esperado: catch { /* comentário */ } ou catch { // comentário }
    
    // O arquivo contém: rm(worktreePath, { recursive: true, force: true })
    const hasWorktreeCleanup = /rm\s*\(\s*worktreePath/.test(content)
    expect(hasWorktreeCleanup).toBe(true)

    // O catch associado DEVE ter um comentário explicativo
    // Regex para encontrar try { ... rm(worktreePath ...) } catch { ... }
    const tryBlockPattern = /try\s*\{[^}]*rm\s*\(\s*worktreePath[^}]*\}\s*catch\s*\{([^}]*)\}/s
    const match = content.match(tryBlockPattern)
    
    expect(match).not.toBeNull()
    
    if (match) {
      const catchBlockContent = match[1]
      
      // Catch block NÃO deve estar completamente vazio
      // Deve ter pelo menos um comentário (// ou /* */)
      const hasComment = /\/\/|\/\*/.test(catchBlockContent)
      expect(hasComment).toBe(true)
      
      // O comentário deve ser explicativo (não apenas whitespace)
      const trimmedContent = catchBlockContent.trim()
      expect(trimmedContent.length).toBeGreaterThan(0)
    }
  })

  // @clause CL-LINT-002
  it('fails when catch block is completely empty', () => {
    const filePath = path.join(SRC_PATH, 'domain/validators/gate1/TestFailsBeforeImplementation.ts')
    const content = readFile(filePath)

    // Verifica que NÃO existe catch vazio (catch {}) sem qualquer conteúdo
    // Padrão problemático: } catch {}
    const hasEmptyCatch = /\}\s*catch\s*\{\s*\}/.test(content)
    expect(hasEmptyCatch).toBe(false)
  })
})

// ============================================================================
// TYPESCRIPT ERRORS
// ============================================================================

describe('TypeScript Errors — Type Annotations', () => {
  // @clause CL-TS-001
  it('succeeds when RunsController readdir catch returns explicit string[]', () => {
    const filePath = path.join(SRC_PATH, 'api/controllers/RunsController.ts')
    const content = readFile(filePath)

    // Deve conter .catch com retorno tipado como string[]
    // Padrões aceitos:
    // - .catch((): string[] => [])
    // - .catch(() => [] as string[])
    // - .catch((_): string[] => [])
    const hasTypedCatch = /\.catch\s*\(\s*\([^)]*\)\s*:\s*string\[\]\s*=>\s*\[\]\s*\)/.test(content)
      || /\.catch\s*\(\s*\(\s*\)\s*=>\s*\[\]\s+as\s+string\[\]\s*\)/.test(content)
    
    expect(hasTypedCatch).toBe(true)
  })

  // @clause CL-TS-001
  it('succeeds when contents.includes compiles without never error', () => {
    const filePath = path.join(SRC_PATH, 'api/controllers/RunsController.ts')
    const content = readFile(filePath)

    // Verifica que contents.includes('plan.json') existe
    const hasIncludesCall = /contents\.includes\s*\(\s*['"]plan\.json['"]\s*\)/.test(content)
    expect(hasIncludesCall).toBe(true)

    // Verifica que o catch está tipado (não retorna never[])
    // O padrão antigo problemático: .catch(() => [])
    // O padrão novo correto: .catch((): string[] => [])
    const hasUntypedCatch = /readdir\s*\([^)]+\)\s*\.catch\s*\(\s*\(\s*\)\s*=>\s*\[\]\s*\)/.test(content)
    expect(hasUntypedCatch).toBe(false)
  })

  // @clause CL-TS-002
  it('succeeds when ValidatorContextInput.value includes ManifestInput in union', () => {
    const filePath = path.join(SRC_PATH, 'types/gates.types.ts')
    const content = readFile(filePath)

    // Extrai a interface ValidatorContextInput
    const interfaceBlock = extractInterfaceBlock(content, 'ValidatorContextInput')
    expect(interfaceBlock).not.toBeNull()

    // Verifica que ManifestInput está no union type do value
    // Padrão esperado: value: ... | ManifestInput
    const hasManifestInputInValue = /value\s*:\s*[^;]+\|\s*ManifestInput/.test(interfaceBlock!)
    expect(hasManifestInputInValue).toBe(true)
  })

  // @clause CL-TS-002
  it('succeeds when ManifestInput is defined before ValidatorContextInput', () => {
    const filePath = path.join(SRC_PATH, 'types/gates.types.ts')
    const content = readFile(filePath)

    // ManifestInput deve estar definido
    const hasManifestInput = /export\s+interface\s+ManifestInput\s*\{/.test(content)
    expect(hasManifestInput).toBe(true)

    // ManifestInput deve vir ANTES de ValidatorContextInput no arquivo
    const manifestInputPos = content.indexOf('interface ManifestInput')
    const validatorContextInputPos = content.indexOf('interface ValidatorContextInput')
    
    expect(manifestInputPos).toBeGreaterThan(-1)
    expect(validatorContextInputPos).toBeGreaterThan(-1)
    expect(manifestInputPos).toBeLessThan(validatorContextInputPos)
  })

  // @clause CL-TS-002
  it('succeeds when ManifestInput has correct structure', () => {
    const filePath = path.join(SRC_PATH, 'types/gates.types.ts')
    const content = readFile(filePath)

    const interfaceBlock = extractInterfaceBlock(content, 'ManifestInput')
    expect(interfaceBlock).not.toBeNull()

    // ManifestInput deve ter files e testFile
    const hasFiles = /files\s*:\s*ManifestFileEntry\[\]/.test(interfaceBlock!)
    const hasTestFile = /testFile\s*:\s*string/.test(interfaceBlock!)
    
    expect(hasFiles).toBe(true)
    expect(hasTestFile).toBe(true)
  })
})

// ============================================================================
// VALIDATORS THAT USE ManifestInput
// ============================================================================

describe('Validators — ManifestInput Usage Compiles', () => {
  // @clause CL-TS-002
  it('succeeds when ManifestFileLock uses ctx.manifest in inputs', () => {
    const filePath = path.join(SRC_PATH, 'domain/validators/gate1/ManifestFileLock.ts')
    const content = readFile(filePath)

    // Deve usar ctx.manifest no value de inputs
    // Padrão: inputs: [{ label: 'Manifest', value: ctx.manifest }]
    const usesManifestInInputs = /inputs\s*:\s*\[\s*\{[^}]*value\s*:\s*ctx\.manifest/.test(content)
    expect(usesManifestInInputs).toBe(true)
  })

  // @clause CL-TS-002
  it('succeeds when NoImplicitFiles uses ctx.manifest in inputs', () => {
    const filePath = path.join(SRC_PATH, 'domain/validators/gate1/NoImplicitFiles.ts')
    const content = readFile(filePath)

    // Deve usar ctx.manifest no value de inputs
    const usesManifestInInputs = /inputs\s*:\s*\[\s*\{[^}]*value\s*:\s*ctx\.manifest/.test(content)
    expect(usesManifestInInputs).toBe(true)
  })

  // @clause CL-TS-002
  it('succeeds when DiffScopeEnforcement uses ctx.manifest in inputs', () => {
    const filePath = path.join(SRC_PATH, 'domain/validators/gate2/DiffScopeEnforcement.ts')
    const content = readFile(filePath)

    // Deve usar ctx.manifest no value de inputs
    const usesManifestInInputs = /inputs\s*:\s*\[\s*\{[^}]*value\s*:\s*ctx\.manifest/.test(content)
    expect(usesManifestInInputs).toBe(true)
  })
})

// ============================================================================
// INVARIANTS — Build and Lint Pass
// ============================================================================

describe('Invariants — Build Integrity', () => {
  // @clause CL-INV-001
  it('succeeds when no parsing errors exist in spec files', () => {
    // Verifica que não existem arquivos .spec.ts com JSX
    // (apenas .spec.tsx devem conter JSX)
    const validatorsDir = path.join(SRC_PATH, 'domain/validators')
    
    if (!fs.existsSync(validatorsDir)) {
      expect.fail('Validators directory does not exist')
    }

    // Encontra todos os arquivos .spec.ts (não .tsx)
    const findSpecTs = (dir: string): string[] => {
      const files: string[] = []
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          files.push(...findSpecTs(fullPath))
        } else if (entry.name.endsWith('.spec.ts') && !entry.name.endsWith('.spec.tsx')) {
          files.push(fullPath)
        }
      }
      return files
    }

    const specTsFiles = findSpecTs(validatorsDir)
    
    // Verifica que nenhum arquivo .spec.ts contém JSX
    for (const file of specTsFiles) {
      const content = readFile(file)
      // JSX pattern: <ComponentName ... > ou <div> etc.
      const hasJsx = /<[A-Z][a-zA-Z]*[^>]*>|<div|<span|<button/.test(content)
      
      if (hasJsx) {
        expect.fail(`File ${file} contains JSX but has .ts extension instead of .tsx`)
      }
    }
    
    // Se chegou aqui, não há arquivos .spec.ts com JSX
    expect(true).toBe(true)
  })

  // @clause CL-INV-002
  it('succeeds when all type assertions are valid', () => {
    const typesPath = path.join(SRC_PATH, 'types/gates.types.ts')
    const content = readFile(typesPath)

    // Verifica estrutura básica do arquivo
    const hasExports = /export\s+(interface|type)/.test(content)
    expect(hasExports).toBe(true)

    // Verifica que ManifestInput está exportado
    const hasManifestInputExport = /export\s+interface\s+ManifestInput/.test(content)
    expect(hasManifestInputExport).toBe(true)

    // Verifica que ValidatorContextInput está exportado
    const hasValidatorContextInputExport = /export\s+interface\s+ValidatorContextInput/.test(content)
    expect(hasValidatorContextInputExport).toBe(true)
  })

  // @clause CL-INV-003
  it('succeeds when validator behavior logic is unchanged', () => {
    // Verifica que as mudanças são apenas de tipos, não de lógica
    
    // TestFailsBeforeImplementation: apenas comentário adicionado
    const tfbiPath = path.join(SRC_PATH, 'domain/validators/gate1/TestFailsBeforeImplementation.ts')
    const tfbiContent = readFile(tfbiPath)
    
    // A lógica principal deve permanecer: rm(worktreePath, { recursive: true, force: true })
    const hasCleanupLogic = /rm\s*\(\s*worktreePath\s*,\s*\{\s*recursive\s*:\s*true\s*,\s*force\s*:\s*true\s*\}\s*\)/.test(tfbiContent)
    expect(hasCleanupLogic).toBe(true)

    // RunsController: apenas tipo adicionado
    const rcPath = path.join(SRC_PATH, 'api/controllers/RunsController.ts')
    const rcContent = readFile(rcPath)
    
    // A lógica principal deve permanecer: readdir e includes
    const hasReaddirLogic = /fs\.readdir\s*\(\s*filesystemArtifactDir\s*\)/.test(rcContent)
    const hasIncludesLogic = /contents\.includes\s*\(\s*['"]plan\.json['"]\s*\)/.test(rcContent)
    
    expect(hasReaddirLogic).toBe(true)
    expect(hasIncludesLogic).toBe(true)
  })
})

// ============================================================================
// SAD PATHS — What Should NOT Exist
// ============================================================================

describe('Sad Paths — Invalid Patterns Should Not Exist', () => {
  // @clause CL-LINT-001
  it('fails when ValidatorContext.spec.ts exists (should be .tsx)', () => {
    const tsPath = path.join(SRC_PATH, 'domain/validators/ValidatorContext.spec.ts')
    const exists = fileExists(tsPath)
    
    // Este arquivo NÃO deve existir após a correção
    expect(exists).toBe(false)
  })

  // @clause CL-LINT-002
  it('fails when any catch block is completely empty', () => {
    const filePath = path.join(SRC_PATH, 'domain/validators/gate1/TestFailsBeforeImplementation.ts')
    const content = readFile(filePath)

    // Pattern: } catch {} ou } catch { }
    const emptyCatchPattern = /\}\s*catch\s*\{\s*\}/g
    const matches = content.match(emptyCatchPattern)
    
    // Não deve haver catch blocks completamente vazios
    expect(matches).toBeNull()
  })

  // @clause CL-TS-001
  it('fails when catch returns untyped empty array', () => {
    const filePath = path.join(SRC_PATH, 'api/controllers/RunsController.ts')
    const content = readFile(filePath)

    // Pattern problemático: .catch(() => []) sem tipo
    // Deve ter sido substituído por .catch((): string[] => [])
    
    // Encontra todos os .catch(() => [])
    const untypedCatchPattern = /\.catch\s*\(\s*\(\s*\)\s*=>\s*\[\]\s*\)/g
    const matches = content.match(untypedCatchPattern)
    
    // Se houver matches, verifica se todos estão tipados
    if (matches) {
      for (const match of matches) {
        // O match NÃO deve ser simplesmente () => []
        // Deve ter tipo: (): string[] => []
        const isUntyped = /\.catch\s*\(\s*\(\s*\)\s*=>\s*\[\]\s*\)/.test(match)
        expect(isUntyped).toBe(false)
      }
    }
  })

  // @clause CL-TS-002
  it('fails when ValidatorContextInput.value does not include ManifestInput', () => {
    const filePath = path.join(SRC_PATH, 'types/gates.types.ts')
    const content = readFile(filePath)

    const interfaceBlock = extractInterfaceBlock(content, 'ValidatorContextInput')
    expect(interfaceBlock).not.toBeNull()

    // value DEVE incluir ManifestInput
    const includesManifestInput = /value\s*:\s*[^;]+ManifestInput/.test(interfaceBlock!)
    expect(includesManifestInput).toBe(true)
  })
})

// ============================================================================
// INTEGRATION — Cross-file Consistency
// ============================================================================

describe('Integration — Type Consistency Across Files', () => {
  // @clause CL-TS-002 + CL-INV-002
  it('succeeds when validators can use ManifestInput in context.inputs', () => {
    // Verifica que o tipo permite a estrutura usada pelos validators
    const typesPath = path.join(SRC_PATH, 'types/gates.types.ts')
    const typesContent = readFile(typesPath)

    // ValidatorContextInput deve aceitar ManifestInput
    const validatorContextInput = extractInterfaceBlock(typesContent, 'ValidatorContextInput')
    expect(validatorContextInput).not.toBeNull()
    
    const valueType = validatorContextInput!.match(/value\s*:\s*([^;]+)/)?.[1]?.trim()
    expect(valueType).toBeDefined()
    
    // O valueType deve incluir ManifestInput
    expect(valueType).toContain('ManifestInput')
  })

  // @clause CL-LINT-001 + CL-INV-001
  it('succeeds when spec file extension matches content type', () => {
    const tsxPath = path.join(SRC_PATH, 'domain/validators/ValidatorContext.spec.tsx')
    
    if (!fileExists(tsxPath)) {
      expect.fail('ValidatorContext.spec.tsx should exist')
    }

    const content = readFile(tsxPath)
    
    // Arquivo .tsx deve conter:
    // 1. Import de React (opcional se usando JSX transform)
    // 2. JSX syntax
    const hasJsx = /<[A-Za-z][^>]*>/.test(content)
    expect(hasJsx).toBe(true)
  })
})
