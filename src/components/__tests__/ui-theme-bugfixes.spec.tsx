/**
 * UI Theme Bugfixes Specification Tests
 *
 * Este spec valida 2 bugfixes:
 * 1. Modal commit - diff-summary sem overflow-x-auto faz texto longo empurrar botões
 * 2. Theme - UILD exporta metadata.projectName mas Gatekeeper espera metadata.name
 *
 * Os testes são contratos: se falharem, a LLM executora errou na implementação.
 *
 * Domínios cobertos:
 * - UI (CL-UI-001): Overflow do diff-summary
 * - THEME (CL-THEME-001 a 003): Compatibilidade metadata
 * - INV (CL-INV-001, 002): Backward e UILD compatibility
 *
 * @contract ui-theme-bugfixes
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

// Detecta se estamos rodando do root do monorepo ou de packages/gatekeeper-api
const isInBackendPackage = cwd.endsWith('gatekeeper-api') || cwd.includes('gatekeeper-api')

// Caminhos do backend
const BACKEND_BASE = isInBackendPackage ? cwd : path.resolve(cwd, 'packages/gatekeeper-api')
const BACKEND_SRC = path.join(BACKEND_BASE, 'src')

// Caminhos do frontend (sempre no root)
const REPO_ROOT = isInBackendPackage ? path.resolve(cwd, '../..') : cwd
const FRONTEND_SRC = path.join(REPO_ROOT, 'src')

function readFile(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`)
  }
  return fs.readFileSync(filePath, 'utf-8')
}

function extractInterfaceBlock(content: string, interfaceName: string): string | null {
  // Match interface with potential nesting
  const regex = new RegExp(
    `(export\\s+)?interface\\s+${interfaceName}\\s*\\{([\\s\\S]*?)\\n\\}`,
    'm'
  )
  const match = content.match(regex)
  return match ? match[2] : null
}

function extractNestedObject(content: string, objectName: string): string | null {
  // Match nested object like metadata: { ... }
  const regex = new RegExp(`${objectName}\\s*:\\s*\\{([^}]+)\\}`, 's')
  const match = content.match(regex)
  return match ? match[1] : null
}

// ============================================================================
// BUG 1 — UI: Modal Commit Overflow
// ============================================================================

describe('Bug 1 — UI: Modal Commit Overflow', () => {
  let modalContent: string

  beforeAll(() => {
    const modalPath = path.join(FRONTEND_SRC, 'components/git-commit-modal.tsx')
    modalContent = readFile(modalPath)
  })

  // @clause CL-UI-001
  it('succeeds when diff-summary has overflow-x-auto class', () => {
    // Encontra o elemento diff-summary
    const hasDiffSummary = /data-testid=["']diff-summary["']/.test(modalContent)
    expect(hasDiffSummary).toBe(true)

    // O elemento deve ter overflow-x-auto na className
    // Padrão esperado: className="... overflow-x-auto ..."
    const diffSummaryPattern = /<div[^>]*data-testid=["']diff-summary["'][^>]*className=["'][^"']*overflow-x-auto[^"']*["'][^>]*>/s
    const altPattern = /<div[^>]*className=["'][^"']*overflow-x-auto[^"']*["'][^>]*data-testid=["']diff-summary["'][^>]*>/s
    
    const hasOverflowXAuto = diffSummaryPattern.test(modalContent) || altPattern.test(modalContent)
    expect(hasOverflowXAuto).toBe(true)
  })

  // @clause CL-UI-001
  it('succeeds when diff-summary element exists with proper structure', () => {
    // Verifica que diff-summary está dentro de um container adequado
    const hasDiffSummaryElement = /data-testid=["']diff-summary["']/.test(modalContent)
    expect(hasDiffSummaryElement).toBe(true)

    // Verifica que gitStatus.diffStat é renderizado dentro do elemento
    const rendersDiffStat = /\{gitStatus\.diffStat\}/.test(modalContent)
    expect(rendersDiffStat).toBe(true)
  })

  // @clause CL-UI-001
  it('succeeds when modal buttons are in DialogFooter', () => {
    // Verifica que os botões estão dentro do DialogFooter
    const hasDialogFooter = /<DialogFooter>/.test(modalContent)
    expect(hasDialogFooter).toBe(true)

    // Verifica que btn-commit-push está no footer
    const hasBtnCommitPush = /data-testid=["']btn-commit-push["']/.test(modalContent)
    expect(hasBtnCommitPush).toBe(true)

    // O diff-summary deve estar ANTES do <DialogFooter> no JSX
    // (usa <DialogFooter> para pegar o uso, não o import)
    const diffSummaryPos = modalContent.indexOf('diff-summary')
    const dialogFooterUsagePos = modalContent.indexOf('<DialogFooter>')
    expect(diffSummaryPos).toBeGreaterThan(-1)
    expect(dialogFooterUsagePos).toBeGreaterThan(-1)
    expect(diffSummaryPos).toBeLessThan(dialogFooterUsagePos)
  })

  // @clause CL-UI-001
  it('fails when diff-summary lacks overflow control', () => {
    // Verifica que diff-summary NÃO está sem controle de overflow
    // O elemento NÃO deve ter apenas classes sem overflow
    
    // Extrai a linha do diff-summary
    const diffSummaryMatch = modalContent.match(/<div[^>]*data-testid=["']diff-summary["'][^>]*>/)
    expect(diffSummaryMatch).not.toBeNull()

    if (diffSummaryMatch) {
      const elementTag = diffSummaryMatch[0]
      // Deve ter overflow-x-auto ou similar
      const hasOverflowClass = /overflow-x-auto|overflow-auto|overflow-x-scroll/.test(elementTag)
      expect(hasOverflowClass).toBe(true)
    }
  })
})

// ============================================================================
// BUG 2 — Backend: Theme Metadata Compatibility
// ============================================================================

describe('Bug 2 — Backend: Theme Metadata Interface', () => {
  let typesContent: string

  beforeAll(() => {
    const typesPath = path.join(BACKEND_SRC, 'types/theme.types.ts')
    typesContent = readFile(typesPath)
  })

  // @clause CL-THEME-001
  it('succeeds when ThemePreset.metadata accepts name as optional', () => {
    // Extrai o bloco da interface ThemePreset
    const themePresetBlock = extractInterfaceBlock(typesContent, 'ThemePreset')
    expect(themePresetBlock).not.toBeNull()

    // Extrai o objeto metadata dentro de ThemePreset
    const metadataBlock = extractNestedObject(themePresetBlock!, 'metadata')
    expect(metadataBlock).not.toBeNull()

    // name deve ser opcional (name?: string)
    const nameIsOptional = /name\s*\?\s*:\s*string/.test(metadataBlock!)
    expect(nameIsOptional).toBe(true)
  })

  // @clause CL-THEME-001
  it('succeeds when ThemePreset.metadata accepts projectName as optional', () => {
    const themePresetBlock = extractInterfaceBlock(typesContent, 'ThemePreset')
    expect(themePresetBlock).not.toBeNull()

    const metadataBlock = extractNestedObject(themePresetBlock!, 'metadata')
    expect(metadataBlock).not.toBeNull()

    // projectName deve ser opcional (projectName?: string)
    const projectNameIsOptional = /projectName\s*\?\s*:\s*string/.test(metadataBlock!)
    expect(projectNameIsOptional).toBe(true)
  })

  // @clause CL-THEME-001
  it('succeeds when metadata has both name and projectName fields', () => {
    const themePresetBlock = extractInterfaceBlock(typesContent, 'ThemePreset')
    expect(themePresetBlock).not.toBeNull()

    const metadataBlock = extractNestedObject(themePresetBlock!, 'metadata')
    expect(metadataBlock).not.toBeNull()

    // Deve ter ambos os campos
    const hasName = /name\s*\??\s*:/.test(metadataBlock!)
    const hasProjectName = /projectName\s*\??\s*:/.test(metadataBlock!)

    expect(hasName).toBe(true)
    expect(hasProjectName).toBe(true)
  })
})

describe('Bug 2 — Backend: Theme Controller Fallback', () => {
  let controllerContent: string

  beforeAll(() => {
    const controllerPath = path.join(BACKEND_SRC, 'api/controllers/ThemeController.ts')
    controllerContent = readFile(controllerPath)
  })

  // @clause CL-THEME-002
  it('succeeds when controller uses name ?? projectName fallback', () => {
    // Padrão esperado: metadata.name ?? metadata.projectName
    // ou: preset.metadata.name ?? preset.metadata.projectName
    const hasFallback = /metadata\.name\s*\?\?\s*metadata\.projectName/.test(controllerContent)
      || /preset\.metadata\.name\s*\?\?\s*preset\.metadata\.projectName/.test(controllerContent)
    
    expect(hasFallback).toBe(true)
  })

  // @clause CL-THEME-002
  it('succeeds when controller extracts themeName with fallback', () => {
    // Verifica que existe uma variável que usa o fallback
    // Padrões aceitos:
    // const themeName = metadata.name ?? metadata.projectName
    // const name = preset.metadata.name ?? preset.metadata.projectName
    const hasThemeNameExtraction = 
      /(?:const|let)\s+(?:themeName|name)\s*=\s*(?:preset\.)?metadata\.name\s*\?\?\s*(?:preset\.)?metadata\.projectName/.test(controllerContent)
    
    expect(hasThemeNameExtraction).toBe(true)
  })

  // @clause CL-THEME-003
  it('succeeds when controller validates presence of name before processing', () => {
    // Deve haver validação que verifica se name está presente
    // Padrão esperado: if (!themeName) ou if (!name)
    const hasNameValidation = /if\s*\(\s*!(?:themeName|name)\s*\)/.test(controllerContent)
    expect(hasNameValidation).toBe(true)
  })

  // @clause CL-THEME-003
  it('succeeds when controller returns 400 for missing name', () => {
    // Deve retornar 400 com INVALID_PRESET quando name está ausente
    const returns400 = /status\s*\(\s*400\s*\)/.test(controllerContent)
    expect(returns400).toBe(true)

    // Deve ter error code INVALID_PRESET
    const hasInvalidPresetError = /INVALID_PRESET/.test(controllerContent)
    expect(hasInvalidPresetError).toBe(true)
  })

  // @clause CL-THEME-003
  it('succeeds when validation happens before themeEngine.process', () => {
    // A validação de nome deve acontecer ANTES do processamento do tema
    const nameValidationPos = controllerContent.search(/if\s*\(\s*!(?:themeName|name)\s*\)/)
    const engineProcessPos = controllerContent.search(/themeEngine\.process/)

    // Se ambos existem, validação deve vir antes
    if (nameValidationPos > -1 && engineProcessPos > -1) {
      expect(nameValidationPos).toBeLessThan(engineProcessPos)
    } else {
      // Se não encontrou o padrão exato, verifica alternativas
      // A validação deve existir em algum lugar antes do process
      const hasEarlyValidation = /(?:const|let)\s+(?:themeName|name)\s*=[\s\S]*?if\s*\(\s*!(?:themeName|name)\s*\)[\s\S]*?themeEngine\.process/.test(controllerContent)
      expect(hasEarlyValidation).toBe(true)
    }
  })
})

// ============================================================================
// INVARIANTS — Backward Compatibility
// ============================================================================

describe('Invariants — Backward and UILD Compatibility', () => {
  let controllerContent: string
  let typesContent: string

  beforeAll(() => {
    const controllerPath = path.join(BACKEND_SRC, 'api/controllers/ThemeController.ts')
    const typesPath = path.join(BACKEND_SRC, 'types/theme.types.ts')
    controllerContent = readFile(controllerPath)
    typesContent = readFile(typesPath)
  })

  // @clause CL-INV-001
  it('succeeds when preset with metadata.name is supported (backward compatible)', () => {
    // O fallback name ?? projectName garante que name funciona
    const supportsFallback = /metadata\.name\s*\?\?/.test(controllerContent)
      || /preset\.metadata\.name\s*\?\?/.test(controllerContent)
    
    expect(supportsFallback).toBe(true)
  })

  // @clause CL-INV-001
  it('succeeds when metadata.name is first in fallback chain', () => {
    // name deve ser a primeira opção (prioridade)
    // Padrão: name ?? projectName (não projectName ?? name)
    const nameFirstPattern = /metadata\.name\s*\?\?\s*metadata\.projectName/.test(controllerContent)
      || /preset\.metadata\.name\s*\?\?\s*preset\.metadata\.projectName/.test(controllerContent)
    
    expect(nameFirstPattern).toBe(true)
  })

  // @clause CL-INV-002
  it('succeeds when preset with metadata.projectName is supported (UILD compatible)', () => {
    // O fallback name ?? projectName garante que projectName funciona como fallback
    const supportsProjectName = /\?\?\s*(?:preset\.)?metadata\.projectName/.test(controllerContent)
    expect(supportsProjectName).toBe(true)
  })

  // @clause CL-INV-002
  it('succeeds when projectName is valid fallback in type definition', () => {
    // O tipo deve aceitar projectName como opcional
    const themePresetBlock = extractInterfaceBlock(typesContent, 'ThemePreset')
    expect(themePresetBlock).not.toBeNull()

    const metadataBlock = extractNestedObject(themePresetBlock!, 'metadata')
    expect(metadataBlock).not.toBeNull()

    // projectName deve existir como campo opcional
    const hasProjectName = /projectName\s*\?\s*:\s*string/.test(metadataBlock!)
    expect(hasProjectName).toBe(true)
  })
})

// ============================================================================
// SAD PATHS — Invalid Patterns
// ============================================================================

describe('Sad Paths — Invalid Patterns Should Not Exist', () => {
  // @clause CL-UI-001
  it('fails when diff-summary has no overflow class', () => {
    const modalPath = path.join(FRONTEND_SRC, 'components/git-commit-modal.tsx')
    const modalContent = readFile(modalPath)

    // Encontra o elemento diff-summary
    const diffSummaryMatch = modalContent.match(/<div[^>]*data-testid=["']diff-summary["'][^>]*>/)
    expect(diffSummaryMatch).not.toBeNull()

    if (diffSummaryMatch) {
      const elementTag = diffSummaryMatch[0]
      // NÃO deve estar sem overflow
      const lacksOverflow = !/overflow/.test(elementTag)
      expect(lacksOverflow).toBe(false)
    }
  })

  // @clause CL-THEME-001
  it('fails when metadata.name is required (not optional)', () => {
    const typesPath = path.join(BACKEND_SRC, 'types/theme.types.ts')
    const typesContent = readFile(typesPath)

    const themePresetBlock = extractInterfaceBlock(typesContent, 'ThemePreset')
    expect(themePresetBlock).not.toBeNull()

    const metadataBlock = extractNestedObject(themePresetBlock!, 'metadata')
    expect(metadataBlock).not.toBeNull()

    // name NÃO deve ser required (sem ?)
    // Padrão problemático: name: string (sem ?)
    const nameIsRequired = /name\s*:\s*string/.test(metadataBlock!) 
      && !/name\s*\?\s*:\s*string/.test(metadataBlock!)
    
    expect(nameIsRequired).toBe(false)
  })

  // @clause CL-THEME-002
  it('fails when controller accesses name directly without fallback', () => {
    const controllerPath = path.join(BACKEND_SRC, 'api/controllers/ThemeController.ts')
    const controllerContent = readFile(controllerPath)

    // Padrão problemático: name: preset.metadata.name (sem fallback)
    // na criação do tema
    const directAccessPattern = /name\s*:\s*preset\.metadata\.name\s*[,}]/
    const hasDirectAccess = directAccessPattern.test(controllerContent)
    
    // Se tiver acesso direto, deve haver também fallback em outro lugar
    if (hasDirectAccess) {
      const hasFallbackSomewhere = /metadata\.name\s*\?\?\s*metadata\.projectName/.test(controllerContent)
      expect(hasFallbackSomewhere).toBe(true)
    }
  })

  // @clause CL-THEME-003
  it('fails when controller does not validate missing name', () => {
    const controllerPath = path.join(BACKEND_SRC, 'api/controllers/ThemeController.ts')
    const controllerContent = readFile(controllerPath)

    // Deve haver validação
    const hasValidation = /if\s*\(\s*!(?:themeName|name)\s*\)/.test(controllerContent)
    expect(hasValidation).toBe(true)
  })
})

// ============================================================================
// INTEGRATION — End-to-end Consistency
// ============================================================================

describe('Integration — Type and Controller Alignment', () => {
  // @clause CL-THEME-001 + CL-THEME-002
  it('succeeds when type definition matches controller usage', () => {
    const typesPath = path.join(BACKEND_SRC, 'types/theme.types.ts')
    const controllerPath = path.join(BACKEND_SRC, 'api/controllers/ThemeController.ts')
    
    const typesContent = readFile(typesPath)
    const controllerContent = readFile(controllerPath)

    // Tipo permite name e projectName opcionais
    const themePresetBlock = extractInterfaceBlock(typesContent, 'ThemePreset')
    const metadataBlock = extractNestedObject(themePresetBlock!, 'metadata')
    
    const typeAllowsOptionalName = /name\s*\?\s*:/.test(metadataBlock!)
    const typeAllowsProjectName = /projectName\s*\?\s*:/.test(metadataBlock!)

    // Controller usa fallback
    const controllerUsesFallback = /name\s*\?\?\s*(?:preset\.)?metadata\.projectName/.test(controllerContent)
      || /metadata\.name\s*\?\?\s*metadata\.projectName/.test(controllerContent)

    expect(typeAllowsOptionalName).toBe(true)
    expect(typeAllowsProjectName).toBe(true)
    expect(controllerUsesFallback).toBe(true)
  })

  // @clause CL-UI-001 + CL-INV-001
  it('succeeds when modal structure supports long content', () => {
    const modalPath = path.join(FRONTEND_SRC, 'components/git-commit-modal.tsx')
    const modalContent = readFile(modalPath)

    // Modal tem estrutura correta:
    // 1. diff-summary com overflow
    // 2. DialogFooter separado para botões
    
    const hasDiffSummaryWithOverflow = /data-testid=["']diff-summary["'][^>]*overflow/.test(modalContent)
      || /overflow[^>]*data-testid=["']diff-summary["']/.test(modalContent)
    const hasDialogFooter = /<DialogFooter>/.test(modalContent)
    
    expect(hasDiffSummaryWithOverflow).toBe(true)
    expect(hasDialogFooter).toBe(true)
  })
})
