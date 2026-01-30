import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Fix testFilePath Resolution and Spec Copy Flow
 * ===============================================
 *
 * Contract: fix-testfilepath-mismatch v1.0
 * Mode: STRICT (all clauses must have @clause tags)
 *
 * IMPORTANTE: Estes testes validam o CONTRATO (estado desejado após implementação).
 * - ANTES da implementação: testes DEVEM FALHAR
 * - DEPOIS da implementação: testes DEVEM PASSAR
 *
 * Clauses:
 * - CL-EXEC-001: executeRun copia spec de artifacts para destino antes dos gates
 * - CL-EXEC-002: executeRun atualiza banco após cópia
 * - CL-CTX-001: buildContext usa testFilePath do banco (já corrigido)
 * - CL-CTX-002: buildContext preserva fallback quando cópia não aconteceu
 * - CL-TRO-001: TestReadOnlyEnforcement normaliza paths antes de comparar
 * - CL-TRO-002: TestReadOnlyEnforcement bloqueia outros arquivos de teste modificados
 * - CL-PRS-001: PathResolverService não usa glob
 * - CL-PRS-002: PathResolverService preserva comportamento de cópia
 * - CL-PKG-001: package.json não contém dependência glob
 * - CL-TEST-001: database-cleanup.spec.ts funciona sem glob
 */

// === FILE PATHS ===
const API_ROOT = path.resolve(__dirname, '../..')
const SERVICES_DIR = path.join(API_ROOT, 'services')
const VALIDATORS_DIR = path.join(API_ROOT, 'domain', 'validators')
const VALIDATION_ORCHESTRATOR_PATH = path.join(SERVICES_DIR, 'ValidationOrchestrator.ts')
const PATH_RESOLVER_PATH = path.join(SERVICES_DIR, 'PathResolverService.ts')
const TEST_READ_ONLY_PATH = path.join(VALIDATORS_DIR, 'gate2', 'TestReadOnlyEnforcement.ts')
const DATABASE_CLEANUP_SPEC_PATH = path.join(VALIDATORS_DIR, 'database-cleanup.spec.ts')
const PACKAGE_JSON_PATH = path.join(API_ROOT, '..', 'package.json')

// === UTILITIES ===

function readFileContent(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`)
  }
  return fs.readFileSync(filePath, 'utf-8')
}

/**
 * Extrai o corpo de um método específico do código fonte
 */
function extractMethodBody(content: string, methodName: string): string | null {
  const methodPattern = new RegExp(`(async\\s+)?${methodName}\\s*\\([^)]*\\)\\s*(?::\\s*[^{]+)?\\s*\\{`, 'g')
  const match = methodPattern.exec(content)

  if (!match) return null

  const startIndex = match.index + match[0].length
  let braceCount = 1
  let endIndex = startIndex

  for (let i = startIndex; i < content.length && braceCount > 0; i++) {
    if (content[i] === '{') braceCount++
    if (content[i] === '}') braceCount--
    endIndex = i
  }

  return content.substring(match.index, endIndex + 1)
}

// === CACHED FILE CONTENTS ===

let orchestratorContent: string
let pathResolverContent: string
let testReadOnlyContent: string
let databaseCleanupSpecContent: string
let packageJsonContent: string
let packageJson: Record<string, unknown>
let executeRunBody: string | null

// === SETUP ===

beforeAll(() => {
  orchestratorContent = readFileContent(VALIDATION_ORCHESTRATOR_PATH)
  pathResolverContent = readFileContent(PATH_RESOLVER_PATH)
  testReadOnlyContent = readFileContent(TEST_READ_ONLY_PATH)
  databaseCleanupSpecContent = readFileContent(DATABASE_CLEANUP_SPEC_PATH)
  packageJsonContent = readFileContent(PACKAGE_JSON_PATH)
  packageJson = JSON.parse(packageJsonContent)
  executeRunBody = extractMethodBody(orchestratorContent, 'executeRun')
})

// === TESTS ===

describe('Fix testFilePath Resolution and Spec Copy Flow', () => {
  // ===========================================================================
  // CL-EXEC-001: executeRun copia spec de artifacts para destino ANTES dos gates
  // ===========================================================================
  describe('CL-EXEC-001: executeRun copia spec antes dos gates', () => {
    // @clause CL-EXEC-001
    it('succeeds when executeRun checks if testFilePath contains artifacts', () => {
      // CONTRATO: executeRun DEVE verificar se testFilePath contém /artifacts/
      expect(executeRunBody).not.toBeNull()

      const hasArtifactsCheck =
        executeRunBody!.includes('/artifacts/') ||
        executeRunBody!.includes("includes('artifacts')") ||
        executeRunBody!.includes('includes("artifacts")')

      expect(hasArtifactsCheck).toBe(true)
    })

    // @clause CL-EXEC-001
    it('succeeds when executeRun copies file from artifacts to manifest.testFile destination', () => {
      // CONTRATO: executeRun DEVE copiar arquivo usando copyFile/copyFileSync
      expect(executeRunBody).not.toBeNull()

      const hasCopyInExecuteRun =
        executeRunBody!.includes('copyFile') ||
        executeRunBody!.includes('copyFileSync')

      expect(hasCopyInExecuteRun).toBe(true)
    })

    // @clause CL-EXEC-001
    it('succeeds when copy happens before buildContext call', () => {
      // CONTRATO: A cópia DEVE acontecer ANTES de buildContext
      expect(executeRunBody).not.toBeNull()

      const copyIndex = Math.max(
        executeRunBody!.indexOf('copyFile'),
        executeRunBody!.indexOf('copyFileSync')
      )
      const buildContextIndex = executeRunBody!.indexOf('buildContext')

      // copyFile deve existir E aparecer ANTES de buildContext
      expect(copyIndex).toBeGreaterThan(-1)
      expect(buildContextIndex).toBeGreaterThan(-1)
      expect(copyIndex).toBeLessThan(buildContextIndex)
    })

    // @clause CL-EXEC-001
    it('fails when artifacts path is not detected before copy', () => {
      // CONTRATO: Deve haver verificação de artifacts antes da cópia
      expect(executeRunBody).not.toBeNull()

      const artifactsCheckIndex = Math.max(
        executeRunBody!.indexOf('/artifacts/'),
        executeRunBody!.indexOf("'artifacts'")
      )
      const copyIndex = Math.max(
        executeRunBody!.indexOf('copyFile'),
        executeRunBody!.indexOf('copyFileSync')
      )

      expect(artifactsCheckIndex).toBeGreaterThan(-1)
      expect(copyIndex).toBeGreaterThan(-1)
    })
  })

  // ===========================================================================
  // CL-EXEC-002: executeRun atualiza banco após cópia
  // ===========================================================================
  describe('CL-EXEC-002: executeRun atualiza banco após cópia', () => {
    // @clause CL-EXEC-002
    it('succeeds when executeRun updates testFilePath in database after copy', () => {
      // CONTRATO: Após copiar, DEVE atualizar run.testFilePath no banco
      expect(executeRunBody).not.toBeNull()

      // Deve ter update com testFilePath
      const hasTestFilePathUpdate =
        executeRunBody!.includes('testFilePath:') ||
        (executeRunBody!.includes('update') && executeRunBody!.includes('testFilePath'))

      expect(hasTestFilePathUpdate).toBe(true)
    })

    // @clause CL-EXEC-002
    it('succeeds when database update happens before buildContext', () => {
      // CONTRATO: Atualização do banco DEVE acontecer ANTES de buildContext
      expect(executeRunBody).not.toBeNull()

      // Procurar por padrão de update de testFilePath
      const updatePattern = /update[^}]*testFilePath/s
      const match = updatePattern.exec(executeRunBody!)

      const updateIndex = match ? match.index : -1
      const buildContextIndex = executeRunBody!.indexOf('buildContext')

      expect(updateIndex).toBeGreaterThan(-1)
      expect(updateIndex).toBeLessThan(buildContextIndex)
    })

    // @clause CL-EXEC-002
    it('succeeds when updated path is normalized without backslashes', () => {
      // CONTRATO: O path atualizado NÃO DEVE conter backslashes
      expect(executeRunBody).not.toBeNull()

      // Deve normalizar o path antes de salvar
      const hasNormalization =
        executeRunBody!.includes(".replace(/\\\\/g, '/')") ||
        executeRunBody!.includes('.replace(/\\\\') ||
        executeRunBody!.includes('normalize')

      expect(hasNormalization).toBe(true)
    })

    // @clause CL-EXEC-002
    it('fails when updated path still contains artifacts reference', () => {
      // CONTRATO: O path atualizado NÃO DEVE conter /artifacts/
      // Verificar que o path salvo é o destino (manifest.testFile), não o original
      expect(executeRunBody).not.toBeNull()

      // Deve usar manifest.testFile como novo path
      const usesManifestAsNewPath =
        executeRunBody!.includes('manifest.testFile') ||
        executeRunBody!.includes('manifest?.testFile')

      expect(usesManifestAsNewPath).toBe(true)
    })
  })

  // ===========================================================================
  // CL-CTX-001: buildContext usa testFilePath do banco (já corrigido)
  // ===========================================================================
  describe('CL-CTX-001: buildContext usa testFilePath do banco', () => {
    // @clause CL-CTX-001
    it('succeeds when buildContext returns normalized testFilePath', () => {
      // CONTRATO: ctx.testFilePath DEVE usar forward slashes apenas
      const buildContextBody = extractMethodBody(orchestratorContent, 'buildContext')
      expect(buildContextBody).not.toBeNull()

      const returnsTestFilePath =
        buildContextBody!.includes('testFilePath:') ||
        buildContextBody!.includes('testFilePath,')

      expect(returnsTestFilePath).toBe(true)
    })

    // @clause CL-CTX-001
    it('succeeds when buildContext normalizes path separators', () => {
      // CONTRATO: buildContext DEVE normalizar separadores
      const buildContextBody = extractMethodBody(orchestratorContent, 'buildContext')
      expect(buildContextBody).not.toBeNull()

      const hasNormalization =
        buildContextBody!.includes(".replace(/\\\\/g, '/')") ||
        buildContextBody!.includes('.replace(/\\\\') ||
        orchestratorContent.includes('normalizePath')

      expect(hasNormalization).toBe(true)
    })
  })

  // ===========================================================================
  // CL-CTX-002: buildContext preserva fallback quando cópia não aconteceu
  // ===========================================================================
  describe('CL-CTX-002: buildContext preserva fallback', () => {
    // @clause CL-CTX-002
    it('succeeds when buildContext handles undefined manifest.testFile', () => {
      // CONTRATO: Se manifest.testFile é undefined, usar valor original do banco
      const hasFallbackCheck =
        orchestratorContent.includes('manifest?.testFile') ||
        orchestratorContent.includes('if (manifest') ||
        orchestratorContent.includes('manifest &&')

      expect(hasFallbackCheck).toBe(true)
    })

    // @clause CL-CTX-002
    it('succeeds when fallback path is still normalized', () => {
      // CONTRATO: Mesmo no fallback, o path DEVE ser normalizado
      const buildContextBody = extractMethodBody(orchestratorContent, 'buildContext')
      expect(buildContextBody).not.toBeNull()

      // Normalização deve acontecer independente do branch
      const hasUnconditionalNormalization =
        buildContextBody!.includes(".replace(/\\\\/g, '/')") ||
        orchestratorContent.includes('normalizePath')

      expect(hasUnconditionalNormalization).toBe(true)
    })
  })

  // ===========================================================================
  // CL-TRO-001: TestReadOnlyEnforcement normaliza paths antes de comparar
  // ===========================================================================
  describe('CL-TRO-001: TestReadOnlyEnforcement normaliza paths', () => {
    // @clause CL-TRO-001
    it('succeeds when allowedTestAbsolute is normalized before comparison', () => {
      // CONTRATO: allowedTestAbsolute DEVE ser normalizado
      const hasAllowedNormalization =
        testReadOnlyContent.includes('allowedTestAbsolute') &&
        (testReadOnlyContent.includes(".replace(/\\\\/g, '/')") ||
         testReadOnlyContent.includes('normalizedAllowed'))

      expect(hasAllowedNormalization).toBe(true)
    })

    // @clause CL-TRO-001
    it('succeeds when diffAbsolute is normalized before comparison', () => {
      // CONTRATO: diffAbsolute DEVE ser normalizado
      const hasDiffNormalization =
        testReadOnlyContent.includes('diffAbsolute') &&
        (testReadOnlyContent.includes(".replace(/\\\\/g, '/')") ||
         testReadOnlyContent.includes('normalizedDiff') ||
         testReadOnlyContent.includes('normalizedFile'))

      expect(hasDiffNormalization).toBe(true)
    })

    // @clause CL-TRO-001
    it('succeeds when comparison uses normalized paths', () => {
      // CONTRATO: A comparação deve usar paths normalizados
      const usesNormalizedComparison =
        testReadOnlyContent.includes('normalizedFile') ||
        testReadOnlyContent.includes('normalizedAllowed') ||
        (testReadOnlyContent.includes('allowedTestAbsolute') &&
         testReadOnlyContent.includes('diffAbsolute') &&
         testReadOnlyContent.includes(".replace(/\\\\/g, '/')"))

      expect(usesNormalizedComparison).toBe(true)
    })
  })

  // ===========================================================================
  // CL-TRO-002: TestReadOnlyEnforcement bloqueia outros arquivos de teste
  // ===========================================================================
  describe('CL-TRO-002: TestReadOnlyEnforcement bloqueia testes não autorizados', () => {
    // @clause CL-TRO-002
    it('succeeds when validator returns FAILED for unauthorized test modifications', () => {
      // CONTRATO: DEVE retornar FAILED quando testes não autorizados são modificados
      const returnsFailed =
        testReadOnlyContent.includes("status: 'FAILED'") &&
        testReadOnlyContent.includes('passed: false')

      expect(returnsFailed).toBe(true)
    })

    // @clause CL-TRO-002
    it('succeeds when modifiedTests array is populated with unauthorized files', () => {
      // CONTRATO: modifiedTests DEVE conter arquivos não autorizados
      const hasModifiedTestsPopulation =
        testReadOnlyContent.includes('modifiedTests') &&
        (testReadOnlyContent.includes('modifiedTests.push') ||
         testReadOnlyContent.includes('modifiedTests = '))

      expect(hasModifiedTestsPopulation).toBe(true)
    })

    // @clause CL-TRO-002
    it('succeeds when .spec.ts and .test.ts patterns are detected', () => {
      // CONTRATO: DEVE detectar arquivos .spec.ts e .test.ts
      const detectsTestPatterns =
        (testReadOnlyContent.includes('.spec.') || testReadOnlyContent.includes('spec.ts')) &&
        (testReadOnlyContent.includes('.test.') || testReadOnlyContent.includes('test.ts'))

      expect(detectsTestPatterns).toBe(true)
    })
  })

  // ===========================================================================
  // CL-PRS-001: PathResolverService NÃO usa glob
  // ===========================================================================
  describe('CL-PRS-001: PathResolverService não usa glob', () => {
    // @clause CL-PRS-001
    it('succeeds when PathResolverService does not import glob', () => {
      // CONTRATO: NÃO DEVE ter import de glob
      const hasGlobImport =
        /import\s*\{\s*glob\s*\}\s*from/.test(pathResolverContent) ||
        /import\s+glob\s+from/.test(pathResolverContent) ||
        /from\s*['"]glob['"]/.test(pathResolverContent)

      expect(hasGlobImport).toBe(false)
    })

    // @clause CL-PRS-001
    it('succeeds when findSpecByGlob method does not exist', () => {
      // CONTRATO: Método findSpecByGlob NÃO DEVE existir
      const hasFindSpecByGlob = pathResolverContent.includes('findSpecByGlob')

      expect(hasFindSpecByGlob).toBe(false)
    })

    // @clause CL-PRS-001
    it('succeeds when no glob.sync calls exist', () => {
      // CONTRATO: NÃO DEVE ter chamadas a glob.sync
      const hasGlobSync = pathResolverContent.includes('glob.sync')

      expect(hasGlobSync).toBe(false)
    })
  })

  // ===========================================================================
  // CL-PRS-002: PathResolverService preserva comportamento de cópia
  // ===========================================================================
  describe('CL-PRS-002: PathResolverService preserva comportamento de cópia', () => {
    // @clause CL-PRS-002
    it('succeeds when copyFile is used for file transfer', () => {
      // CONTRATO: DEVE usar copyFile para transferir arquivos
      const usesCopyFile = pathResolverContent.includes('copyFile')

      expect(usesCopyFile).toBe(true)
    })

    // @clause CL-PRS-002
    it('succeeds when mkdir creates destination directory', () => {
      // CONTRATO: DEVE criar diretório de destino se não existir
      const usesMkdir = pathResolverContent.includes('mkdir')

      expect(usesMkdir).toBe(true)
    })

    // @clause CL-PRS-002
    it('succeeds when mkdir uses recursive option', () => {
      // CONTRATO: mkdir DEVE usar recursive: true
      const hasMkdirRecursive =
        pathResolverContent.includes('mkdir') &&
        pathResolverContent.includes('recursive: true')

      expect(hasMkdirRecursive).toBe(true)
    })
  })

  // ===========================================================================
  // CL-PKG-001: package.json NÃO contém dependência glob
  // ===========================================================================
  describe('CL-PKG-001: package.json não contém glob', () => {
    // @clause CL-PKG-001
    it('succeeds when dependencies does not contain glob', () => {
      // CONTRATO: dependencies NÃO DEVE conter glob
      const deps = packageJson.dependencies as Record<string, string> | undefined
      const hasGlob = deps && 'glob' in deps

      expect(hasGlob).toBe(false)
    })

    // @clause CL-PKG-001
    it('succeeds when devDependencies does not contain glob', () => {
      // CONTRATO: devDependencies NÃO DEVE conter glob
      const devDeps = packageJson.devDependencies as Record<string, string> | undefined
      const hasGlobDev = devDeps && 'glob' in devDeps

      expect(hasGlobDev).toBe(false)
    })

    // @clause CL-PKG-001
    it('fails when glob exists in any dependency section', () => {
      // CONTRATO: glob NÃO DEVE existir em nenhuma seção de dependências
      const deps = packageJson.dependencies as Record<string, string> | undefined
      const devDeps = packageJson.devDependencies as Record<string, string> | undefined
      const peerDeps = packageJson.peerDependencies as Record<string, string> | undefined

      const hasGlobAnywhere =
        (deps && 'glob' in deps) ||
        (devDeps && 'glob' in devDeps) ||
        (peerDeps && 'glob' in peerDeps)

      expect(hasGlobAnywhere).toBe(false)
    })
  })

  // ===========================================================================
  // CL-TEST-001: database-cleanup.spec.ts funciona sem glob
  // ===========================================================================
  describe('CL-TEST-001: database-cleanup.spec.ts funciona sem glob', () => {
    // @clause CL-TEST-001
    it('succeeds when database-cleanup.spec.ts does not import glob', () => {
      // CONTRATO: NÃO DEVE ter import de glob
      const hasGlobImport =
        /import\s*\{\s*glob\s*\}\s*from/.test(databaseCleanupSpecContent) ||
        /from\s*['"]glob['"]/.test(databaseCleanupSpecContent)

      expect(hasGlobImport).toBe(false)
    })

    // @clause CL-TEST-001
    it('succeeds when database-cleanup.spec.ts does not use glob.sync', () => {
      // CONTRATO: NÃO DEVE usar glob.sync
      const usesGlobSync = databaseCleanupSpecContent.includes('glob.sync')

      expect(usesGlobSync).toBe(false)
    })

    // @clause CL-TEST-001
    it('succeeds when fs.readdirSync is used for file discovery', () => {
      // CONTRATO: DEVE usar fs.readdirSync para descobrir arquivos
      const usesReaddirSync = databaseCleanupSpecContent.includes('readdirSync')

      expect(usesReaddirSync).toBe(true)
    })

    // @clause CL-TEST-001
    it('succeeds when recursive file discovery is implemented', () => {
      // CONTRATO: DEVE ter implementação recursiva para descobrir arquivos
      const hasRecursiveLogic =
        databaseCleanupSpecContent.includes('recursive') ||
        (databaseCleanupSpecContent.includes('readdirSync') &&
         databaseCleanupSpecContent.includes('isDirectory'))

      expect(hasRecursiveLogic).toBe(true)
    })
  })

  // ===========================================================================
  // Integration: Verificação de ordem de execução
  // ===========================================================================
  describe('Integration: Execution Order', () => {
    // @clause CL-EXEC-001
    // @clause CL-EXEC-002
    it('succeeds when executeRun follows correct order: detect -> copy -> update -> buildContext', () => {
      expect(executeRunBody).not.toBeNull()

      // Índices de cada operação
      const artifactsIdx = Math.max(
        executeRunBody!.indexOf('/artifacts/'),
        executeRunBody!.indexOf("'artifacts'")
      )
      const copyIdx = Math.max(
        executeRunBody!.indexOf('copyFile'),
        executeRunBody!.indexOf('copyFileSync')
      )
      const buildContextIdx = executeRunBody!.indexOf('buildContext')

      // Todas as operações devem existir
      expect(artifactsIdx).toBeGreaterThan(-1)
      expect(copyIdx).toBeGreaterThan(-1)
      expect(buildContextIdx).toBeGreaterThan(-1)

      // Ordem correta: artifacts check < copy < buildContext
      expect(artifactsIdx).toBeLessThan(copyIdx)
      expect(copyIdx).toBeLessThan(buildContextIdx)
    })
  })
})
