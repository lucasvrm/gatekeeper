/**
 * @fileoverview Spec: Consolidar Lógica de Cópia do Spec para Path Correto
 * @contract consolidate-spec-copy
 * @mode STRICT
 * @vitest-environment node
 *
 * IMPORTANTE: Este spec testa código REAL via análise estática.
 * - Testes de novo método FALHAM porque método não existe ainda
 * - Testes de remoção de legado FALHAM porque código ainda está presente
 * - Após implementação, todos devem PASSAR
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

// ============================================================================
// PATHS DOS ARQUIVOS REAIS DO PROJETO
// ============================================================================

const PROJECT_ROOT = path.resolve(__dirname, '../../..')
const VALIDATION_ORCHESTRATOR_PATH = path.join(
  PROJECT_ROOT,
  'src/services/ValidationOrchestrator.ts'
)
const VALIDATION_CONTROLLER_PATH = path.join(
  PROJECT_ROOT,
  'src/api/controllers/ValidationController.ts'
)
const RUNS_CONTROLLER_PATH = path.join(
  PROJECT_ROOT,
  'src/api/controllers/RunsController.ts'
)

// ============================================================================
// HELPERS PARA ANÁLISE ESTÁTICA
// ============================================================================

function readSourceFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8')
}

function extractMethodBody(source: string, methodName: string): string {
  const methodRegex = new RegExp(
    `(private|public|protected)?\\s*(async\\s+)?${methodName}\\s*\\([^)]*\\)[^{]*\\{`,
    'g'
  )
  const match = methodRegex.exec(source)
  if (!match) return ''

  const startIndex = match.index + match[0].length
  let braceCount = 1
  let endIndex = startIndex

  for (let i = startIndex; i < source.length && braceCount > 0; i++) {
    if (source[i] === '{') braceCount++
    if (source[i] === '}') braceCount--
    endIndex = i
  }

  return source.slice(startIndex, endIndex)
}

function methodExistsInSource(source: string, methodName: string): boolean {
  const methodRegex = new RegExp(
    `(private|public|protected)?\\s*(async\\s+)?${methodName}\\s*\\(`,
    'g'
  )
  return methodRegex.test(source)
}

// ============================================================================
// BLOCO 1: ensureSpecAtCorrectPath (NOVO MÉTODO)
// Estes testes DEVEM FALHAR porque o método ainda não existe
// ============================================================================

describe('ValidationOrchestrator.ensureSpecAtCorrectPath', () => {
  describe('CL-COPY-001: Método deve existir e copiar spec', () => {
    // @clause CL-COPY-001
    it('succeeds when ensureSpecAtCorrectPath method exists in ValidationOrchestrator', () => {
      const source = readSourceFile(VALIDATION_ORCHESTRATOR_PATH)
      const methodExists = methodExistsInSource(source, 'ensureSpecAtCorrectPath')
      
      // FALHA: método não existe ainda
      expect(methodExists).toBe(true)
    })

    // @clause CL-COPY-001
    it('succeeds when ensureSpecAtCorrectPath contains copyFile call', () => {
      const source = readSourceFile(VALIDATION_ORCHESTRATOR_PATH)
      const methodBody = extractMethodBody(source, 'ensureSpecAtCorrectPath')
      
      // FALHA: método não existe, então body é vazio
      expect(methodBody).toContain('copyFile')
    })

    // @clause CL-COPY-001
    it('succeeds when ensureSpecAtCorrectPath parses manifest.testFile', () => {
      const source = readSourceFile(VALIDATION_ORCHESTRATOR_PATH)
      const methodBody = extractMethodBody(source, 'ensureSpecAtCorrectPath')
      
      // FALHA: método não existe
      expect(methodBody).toMatch(/manifest.*testFile|testFile/i)
    })
  })

  describe('CL-COPY-002: Atualiza testFilePath no DB após cópia', () => {
    // @clause CL-COPY-002
    it('succeeds when ensureSpecAtCorrectPath updates testFilePath in database', () => {
      const source = readSourceFile(VALIDATION_ORCHESTRATOR_PATH)
      const methodBody = extractMethodBody(source, 'ensureSpecAtCorrectPath')
      
      // FALHA: método não existe
      expect(methodBody).toMatch(/update.*testFilePath|testFilePath/i)
    })

    // @clause CL-COPY-002
    it('succeeds when testFilePath is normalized with forward slashes', () => {
      const source = readSourceFile(VALIDATION_ORCHESTRATOR_PATH)
      const methodBody = extractMethodBody(source, 'ensureSpecAtCorrectPath')
      
      // FALHA: método não existe
      expect(methodBody).toMatch(/replace|normalize/i)
    })

    // @clause CL-COPY-002
    it('succeeds when prisma or repository update is called after copy', () => {
      const source = readSourceFile(VALIDATION_ORCHESTRATOR_PATH)
      const methodBody = extractMethodBody(source, 'ensureSpecAtCorrectPath')
      
      // FALHA: método não existe
      expect(methodBody).toMatch(/prisma|repository|\.update\s*\(/i)
    })
  })

  describe('CL-COPY-003: Cria diretório recursivamente', () => {
    // @clause CL-COPY-003
    it('succeeds when ensureSpecAtCorrectPath calls mkdir with recursive option', () => {
      const source = readSourceFile(VALIDATION_ORCHESTRATOR_PATH)
      const methodBody = extractMethodBody(source, 'ensureSpecAtCorrectPath')
      
      // FALHA: método não existe
      expect(methodBody).toMatch(/mkdir.*recursive|mkdirSync.*recursive/i)
    })

    // @clause CL-COPY-003
    it('succeeds when directory creation happens before file copy', () => {
      const source = readSourceFile(VALIDATION_ORCHESTRATOR_PATH)
      const methodBody = extractMethodBody(source, 'ensureSpecAtCorrectPath')
      
      // FALHA: método não existe
      const mkdirIndex = methodBody.search(/mkdir/i)
      const copyIndex = methodBody.search(/copyFile/i)
      
      expect(mkdirIndex).toBeGreaterThanOrEqual(0)
      expect(copyIndex).toBeGreaterThan(mkdirIndex)
    })

    // @clause CL-COPY-003
    it('succeeds when dirname is used to get parent directory', () => {
      const source = readSourceFile(VALIDATION_ORCHESTRATOR_PATH)
      const methodBody = extractMethodBody(source, 'ensureSpecAtCorrectPath')
      
      // FALHA: método não existe
      expect(methodBody).toMatch(/dirname|path\.dirname/i)
    })
  })

  describe('CL-COPY-004: Não copia se target já existe', () => {
    // @clause CL-COPY-004
    it('succeeds when ensureSpecAtCorrectPath checks if target exists before copy', () => {
      const source = readSourceFile(VALIDATION_ORCHESTRATOR_PATH)
      const methodBody = extractMethodBody(source, 'ensureSpecAtCorrectPath')
      
      // FALHA: método não existe
      expect(methodBody).toMatch(/existsSync|exists\s*\(/i)
    })

    // @clause CL-COPY-004
    it('succeeds when copy is conditional on target not existing', () => {
      const source = readSourceFile(VALIDATION_ORCHESTRATOR_PATH)
      const methodBody = extractMethodBody(source, 'ensureSpecAtCorrectPath')
      
      // FALHA: método não existe
      expect(methodBody).toMatch(/if\s*\(\s*!.*existsSync|if\s*\(\s*!.*exists/i)
    })

    // @clause CL-COPY-004
    it('succeeds when method has logic to skip copy if target exists', () => {
      const source = readSourceFile(VALIDATION_ORCHESTRATOR_PATH)
      const methodBody = extractMethodBody(source, 'ensureSpecAtCorrectPath')
      
      // FALHA: método não existe
      expect(methodBody.length).toBeGreaterThan(50)
    })
  })

  describe('CL-ERR-001: Graceful se manifest.testFile ausente', () => {
    // @clause CL-ERR-001
    it('succeeds when ensureSpecAtCorrectPath handles missing testFile gracefully', () => {
      const source = readSourceFile(VALIDATION_ORCHESTRATOR_PATH)
      const methodBody = extractMethodBody(source, 'ensureSpecAtCorrectPath')
      
      // FALHA: método não existe
      expect(methodBody).toMatch(/if\s*\(\s*!.*testFile|!manifest\.testFile/i)
    })

    // @clause CL-ERR-001
    it('succeeds when warning is logged for missing testFile', () => {
      const source = readSourceFile(VALIDATION_ORCHESTRATOR_PATH)
      const methodBody = extractMethodBody(source, 'ensureSpecAtCorrectPath')
      
      // FALHA: método não existe
      expect(methodBody).toMatch(/warn|log/i)
    })

    // @clause CL-ERR-001
    it('succeeds when method returns early for missing testFile without throwing', () => {
      const source = readSourceFile(VALIDATION_ORCHESTRATOR_PATH)
      const methodBody = extractMethodBody(source, 'ensureSpecAtCorrectPath')
      
      // FALHA: método não existe
      expect(methodBody).toContain('return')
    })
  })

  describe('CL-ERR-002: Graceful se artifacts não existe', () => {
    // @clause CL-ERR-002
    it('succeeds when ensureSpecAtCorrectPath checks artifacts file exists', () => {
      const source = readSourceFile(VALIDATION_ORCHESTRATOR_PATH)
      const methodBody = extractMethodBody(source, 'ensureSpecAtCorrectPath')
      
      // FALHA: método não existe
      expect(methodBody).toMatch(/existsSync.*artifact|artifact/i)
    })

    // @clause CL-ERR-002
    it('succeeds when warning is logged for missing artifacts', () => {
      const source = readSourceFile(VALIDATION_ORCHESTRATOR_PATH)
      const methodBody = extractMethodBody(source, 'ensureSpecAtCorrectPath')
      
      // FALHA: método não existe
      expect(methodBody).toMatch(/warn/i)
    })

    // @clause CL-ERR-002
    it('succeeds when execution continues without throwing for missing artifacts', () => {
      const source = readSourceFile(VALIDATION_ORCHESTRATOR_PATH)
      const methodBody = extractMethodBody(source, 'ensureSpecAtCorrectPath')
      
      // FALHA: método não existe
      // Método deve existir e não lançar exceção
      expect(methodBody.length).toBeGreaterThan(100)
    })
  })
})

// ============================================================================
// BLOCO 2: executeRun (INTEGRAÇÃO)
// Estes testes DEVEM FALHAR porque a chamada a ensureSpecAtCorrectPath não existe
// ============================================================================

describe('ValidationOrchestrator.executeRun', () => {
  describe('CL-EXEC-001: Chama ensureSpecAtCorrectPath antes de RUNNING', () => {
    // @clause CL-EXEC-001
    it('succeeds when executeRun calls ensureSpecAtCorrectPath', () => {
      const source = readSourceFile(VALIDATION_ORCHESTRATOR_PATH)
      const methodBody = extractMethodBody(source, 'executeRun')
      
      // FALHA: chamada não existe ainda
      expect(methodBody).toContain('ensureSpecAtCorrectPath')
    })

    // @clause CL-EXEC-001
    it('succeeds when ensureSpecAtCorrectPath is called before status RUNNING', () => {
      const source = readSourceFile(VALIDATION_ORCHESTRATOR_PATH)
      const methodBody = extractMethodBody(source, 'executeRun')
      
      // FALHA: chamada não existe ainda
      const ensureIndex = methodBody.indexOf('ensureSpecAtCorrectPath')
      const runningIndex = methodBody.search(/status.*RUNNING|RUNNING/i)
      
      expect(ensureIndex).toBeGreaterThanOrEqual(0)
      expect(runningIndex).toBeGreaterThan(ensureIndex)
    })

    // @clause CL-EXEC-001
    it('succeeds when ensureSpecAtCorrectPath is awaited', () => {
      const source = readSourceFile(VALIDATION_ORCHESTRATOR_PATH)
      const methodBody = extractMethodBody(source, 'executeRun')
      
      // FALHA: chamada não existe ainda
      expect(methodBody).toMatch(/await\s+.*ensureSpecAtCorrectPath|await\s+this\.ensureSpecAtCorrectPath/i)
    })
  })

  describe('CL-EXEC-002: Usa testFilePath atualizado em buildContext', () => {
    // @clause CL-EXEC-002
    it('succeeds when executeRun re-fetches run after ensureSpecAtCorrectPath', () => {
      const source = readSourceFile(VALIDATION_ORCHESTRATOR_PATH)
      const methodBody = extractMethodBody(source, 'executeRun')
      
      // FALHA: lógica de re-fetch não existe ainda
      const ensureIndex = methodBody.indexOf('ensureSpecAtCorrectPath')
      
      // Deve ter ensureSpecAtCorrectPath E depois um findById/findUnique
      expect(ensureIndex).toBeGreaterThanOrEqual(0)
      
      const afterEnsure = methodBody.slice(ensureIndex)
      expect(afterEnsure).toMatch(/findById|findUnique/i)
    })

    // @clause CL-EXEC-002
    it('succeeds when buildContext receives updated run object', () => {
      const source = readSourceFile(VALIDATION_ORCHESTRATOR_PATH)
      const methodBody = extractMethodBody(source, 'executeRun')
      
      // FALHA: padrão não existe ainda
      expect(methodBody).toMatch(/updatedRun|refreshedRun|refetch/i)
    })

    // @clause CL-EXEC-002
    it('succeeds when buildContext is called after ensureSpecAtCorrectPath', () => {
      const source = readSourceFile(VALIDATION_ORCHESTRATOR_PATH)
      const methodBody = extractMethodBody(source, 'executeRun')
      
      // FALHA: ensureSpecAtCorrectPath não existe
      const ensureIndex = methodBody.indexOf('ensureSpecAtCorrectPath')
      const buildIndex = methodBody.indexOf('buildContext')
      
      expect(ensureIndex).toBeGreaterThanOrEqual(0)
      expect(buildIndex).toBeGreaterThan(ensureIndex)
    })
  })
})

// ============================================================================
// BLOCO 3: REMOÇÃO DE CÓDIGO LEGADO
// Estes testes DEVEM FALHAR porque o código legado ainda está presente
// ============================================================================

describe('Legacy Code Removal', () => {
  describe('CL-LEGACY-001: buildContext não contém re-resolve', () => {
    // @clause CL-LEGACY-001
    it('succeeds when buildContext does not check existsSync for testFilePath', () => {
      const source = readSourceFile(VALIDATION_ORCHESTRATOR_PATH)
      const methodBody = extractMethodBody(source, 'buildContext')
      
      // FALHA: código legado ainda existe (linhas 347-357)
      const hasLegacyCheck = /if\s*\(\s*run\.testFilePath\s*&&\s*!existsSync/.test(methodBody)
      
      expect(hasLegacyCheck).toBe(false)
    })

    // @clause CL-LEGACY-001
    it('succeeds when buildContext does not declare resolvedTestFilePath', () => {
      const source = readSourceFile(VALIDATION_ORCHESTRATOR_PATH)
      const methodBody = extractMethodBody(source, 'buildContext')
      
      // FALHA: variável legada ainda existe
      const hasResolvedVar = /resolvedTestFilePath/.test(methodBody)
      
      expect(hasResolvedVar).toBe(false)
    })

    // @clause CL-LEGACY-001
    it('succeeds when buildContext does not contain path resolution fallback', () => {
      const source = readSourceFile(VALIDATION_ORCHESTRATOR_PATH)
      const methodBody = extractMethodBody(source, 'buildContext')
      
      // FALHA: lógica de fallback ainda existe
      const hasFallback = /testFilePath\s*[=:]\s*[^;{]+\?[^:]+:/.test(methodBody)
      
      expect(hasFallback).toBe(false)
    })
  })

  describe('CL-LEGACY-002: createRun não copia para EXECUTION', () => {
    // @clause CL-LEGACY-002
    it('succeeds when createRun does not call pathResolver.ensureCorrectPath', () => {
      const source = readSourceFile(VALIDATION_CONTROLLER_PATH)
      const methodBody = extractMethodBody(source, 'createRun')
      
      // FALHA: chamada legada ainda existe
      const hasEnsureCorrectPath = /pathResolver\.ensureCorrectPath/.test(methodBody)
      
      expect(hasEnsureCorrectPath).toBe(false)
    })

    // @clause CL-LEGACY-002
    it('succeeds when createRun does not have EXECUTION type copy block', () => {
      const source = readSourceFile(VALIDATION_CONTROLLER_PATH)
      const methodBody = extractMethodBody(source, 'createRun')
      
      // FALHA: bloco legado ainda existe (linhas 156-207)
      const hasExecutionBlock = /runType\s*===?\s*['"]EXECUTION['"]/.test(methodBody)
      
      expect(hasExecutionBlock).toBe(false)
    })

    // @clause CL-LEGACY-002
    it('succeeds when createRun does not contain copyFile operations', () => {
      const source = readSourceFile(VALIDATION_CONTROLLER_PATH)
      const methodBody = extractMethodBody(source, 'createRun')
      
      // FALHA: operação legada ainda existe
      const hasCopyFile = /copyFile|copyFileSync/.test(methodBody)
      
      expect(hasCopyFile).toBe(false)
    })
  })

  describe('CL-LEGACY-003: rerunGate não faz recheckAndCopy', () => {
    // @clause CL-LEGACY-003
    it('succeeds when rerunGate does not call pathResolver.recheckAndCopy', () => {
      const source = readSourceFile(RUNS_CONTROLLER_PATH)
      const methodBody = extractMethodBody(source, 'rerunGate')
      
      // FALHA: chamada legada ainda existe
      const hasRecheckAndCopy = /pathResolver\.recheckAndCopy/.test(methodBody)
      
      expect(hasRecheckAndCopy).toBe(false)
    })

    // @clause CL-LEGACY-003
    it('succeeds when rerunGate does not call ensureCorrectPath', () => {
      const source = readSourceFile(RUNS_CONTROLLER_PATH)
      const methodBody = extractMethodBody(source, 'rerunGate')
      
      // FALHA: chamada legada ainda existe
      const hasEnsureCorrectPath = /ensureCorrectPath/.test(methodBody)
      
      expect(hasEnsureCorrectPath).toBe(false)
    })

    // @clause CL-LEGACY-003
    it('succeeds when rerunGate does not contain copy logic', () => {
      const source = readSourceFile(RUNS_CONTROLLER_PATH)
      const methodBody = extractMethodBody(source, 'rerunGate')
      
      // FALHA: lógica legada ainda existe
      const hasCopyLogic = /copyFile|copyFileSync/.test(methodBody)
      
      expect(hasCopyLogic).toBe(false)
    })
  })

  describe('CL-LEGACY-004: uploadFiles não chama resolveAndPersistSpecPath', () => {
    // @clause CL-LEGACY-004
    it('succeeds when uploadFiles does not call this.resolveAndPersistSpecPath', () => {
      const source = readSourceFile(RUNS_CONTROLLER_PATH)
      const methodBody = extractMethodBody(source, 'uploadFiles')
      
      // FALHA: chamada legada ainda existe
      const hasResolveCall = /this\.resolveAndPersistSpecPath/.test(methodBody)
      
      expect(hasResolveCall).toBe(false)
    })

    // @clause CL-LEGACY-004
    it('succeeds when uploadFiles does not reference resolveAndPersistSpecPath', () => {
      const source = readSourceFile(RUNS_CONTROLLER_PATH)
      const methodBody = extractMethodBody(source, 'uploadFiles')
      
      // FALHA: referência legada ainda existe
      const hasReference = /resolveAndPersistSpecPath/.test(methodBody)
      
      expect(hasReference).toBe(false)
    })

    // @clause CL-LEGACY-004
    it('succeeds when uploadFiles only writes to artifacts directory', () => {
      const source = readSourceFile(RUNS_CONTROLLER_PATH)
      const methodBody = extractMethodBody(source, 'uploadFiles')
      
      // FALHA: lógica de cópia para manifest.testFile ainda existe
      const hasCopyToTarget = /copyFile.*manifest\.testFile|manifest\.testFile.*copyFile/.test(methodBody)
      
      expect(hasCopyToTarget).toBe(false)
    })
  })

  describe('CL-LEGACY-005: resolveAndPersistSpecPath removido', () => {
    // @clause CL-LEGACY-005
    it('succeeds when resolveAndPersistSpecPath method does not exist', () => {
      const source = readSourceFile(RUNS_CONTROLLER_PATH)
      
      // FALHA: método legado ainda existe
      const methodExists = methodExistsInSource(source, 'resolveAndPersistSpecPath')
      
      expect(methodExists).toBe(false)
    })

    // @clause CL-LEGACY-005
    it('succeeds when private resolveAndPersistSpecPath is not declared', () => {
      const source = readSourceFile(RUNS_CONTROLLER_PATH)
      
      // FALHA: declaração legada ainda existe
      const hasPrivateMethod = /private\s+(async\s+)?resolveAndPersistSpecPath/.test(source)
      
      expect(hasPrivateMethod).toBe(false)
    })

    // @clause CL-LEGACY-005
    it('succeeds when no references to resolveAndPersistSpecPath exist in RunsController', () => {
      const source = readSourceFile(RUNS_CONTROLLER_PATH)
      
      // FALHA: referências legadas ainda existem
      const referenceCount = (source.match(/resolveAndPersistSpecPath/g) || []).length
      
      expect(referenceCount).toBe(0)
    })
  })
})

// ============================================================================
// BLOCO 4: INVARIANTES DE REGRESSÃO
// Estes testes devem PASSAR mesmo antes da implementação (funcionalidade existente)
// ============================================================================

describe('Regression Invariants', () => {
  describe('CL-REG-001: createRun ainda cria run no DB', () => {
    // @clause CL-REG-001
    it('succeeds when createRun method exists in ValidationController', () => {
      const source = readSourceFile(VALIDATION_CONTROLLER_PATH)
      const methodExists = methodExistsInSource(source, 'createRun')
      
      // PASSA: método existe
      expect(methodExists).toBe(true)
    })

    // @clause CL-REG-001
    it('succeeds when createRun contains prisma.validationRun.create', () => {
      const source = readSourceFile(VALIDATION_CONTROLLER_PATH)
      const methodBody = extractMethodBody(source, 'createRun')
      
      // PASSA: operação existe
      expect(methodBody).toMatch(/prisma\.validationRun\.create|validationRun\.create/i)
    })

    // @clause CL-REG-001
    it('succeeds when createRun sets required fields', () => {
      const source = readSourceFile(VALIDATION_CONTROLLER_PATH)
      const methodBody = extractMethodBody(source, 'createRun')
      
      // PASSA: campos obrigatórios são setados
      expect(methodBody).toMatch(/outputId/i)
      expect(methodBody).toMatch(/projectPath/i)
    })
  })

  describe('CL-REG-002: uploadFiles ainda salva em artifacts', () => {
    // @clause CL-REG-002
    it('succeeds when uploadFiles method exists in RunsController', () => {
      const source = readSourceFile(RUNS_CONTROLLER_PATH)
      const methodExists = methodExistsInSource(source, 'uploadFiles')
      
      // PASSA: método existe
      expect(methodExists).toBe(true)
    })

    // @clause CL-REG-002
    it('succeeds when uploadFiles writes to artifacts directory', () => {
      const source = readSourceFile(RUNS_CONTROLLER_PATH)
      const methodBody = extractMethodBody(source, 'uploadFiles')
      
      // PASSA: escrita em artifacts existe
      expect(methodBody).toMatch(/artifacts/i)
    })

    // @clause CL-REG-002
    it('succeeds when uploadFiles uses writeFile operation', () => {
      const source = readSourceFile(RUNS_CONTROLLER_PATH)
      const methodBody = extractMethodBody(source, 'uploadFiles')
      
      // PASSA: operação de escrita existe
      expect(methodBody).toMatch(/writeFile|writeFileSync|fs\.promises\.writeFile/i)
    })
  })

  describe('CL-REG-003: rerunGate ainda reseta e enfileira', () => {
    // @clause CL-REG-003
    it('succeeds when rerunGate method exists in RunsController', () => {
      const source = readSourceFile(RUNS_CONTROLLER_PATH)
      const methodExists = methodExistsInSource(source, 'rerunGate')
      
      // PASSA: método existe
      expect(methodExists).toBe(true)
    })

    // @clause CL-REG-003
    it('succeeds when rerunGate deletes validator results', () => {
      const source = readSourceFile(RUNS_CONTROLLER_PATH)
      const methodBody = extractMethodBody(source, 'rerunGate')
      
      // PASSA: deleção existe
      expect(methodBody).toMatch(/validatorResult.*deleteMany|deleteMany.*validatorResult/i)
    })

    // @clause CL-REG-003
    it('succeeds when rerunGate adds run to queue', () => {
      const source = readSourceFile(RUNS_CONTROLLER_PATH)
      const methodBody = extractMethodBody(source, 'rerunGate')
      
      // PASSA: enfileiramento existe
      expect(methodBody).toMatch(/addToQueue|enqueue|queue\.add/i)
    })
  })
})
