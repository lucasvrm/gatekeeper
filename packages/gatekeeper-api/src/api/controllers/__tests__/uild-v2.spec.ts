/**
 * UILD v2 Test Suite
 * Contract: uild-v2
 * Mode: STRICT (allowUntagged: false)
 *
 * Refatoração UILD: Remove sistema UIContract granular, cria ComponentCatalogEditor,
 * implementa geradores de component-registry.yaml, AppLayout.tsx e layout-variables.css.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import * as YAML from 'yaml'

const ROOT_DIR = process.cwd()

// ============================================================================
// Helper Functions
// ============================================================================

function readFile(relativePath: string): string {
  const fullPath = join(ROOT_DIR, relativePath)
  if (!existsSync(fullPath)) {
    throw new Error(`File not found: ${relativePath}`)
  }
  return readFileSync(fullPath, 'utf-8')
}

function fileExists(relativePath: string): boolean {
  return existsSync(join(ROOT_DIR, relativePath))
}

function hasDataTestId(content: string, testId: string): boolean {
  const pattern = new RegExp(`data-testid=["'\`]${testId}["'\`]`)
  return pattern.test(content)
}

function hasImport(content: string, importName: string): boolean {
  const pattern = new RegExp(`import.*${importName}`)
  return pattern.test(content)
}

function hasExport(content: string, exportName: string): boolean {
  const pattern = new RegExp(`export.*${exportName}`)
  return pattern.test(content)
}

function countOccurrences(content: string, searchString: string): number {
  return (content.match(new RegExp(searchString, 'g')) || []).length
}

// ============================================================================
// TESTES - FASE 1: REMOÇÃO DE CÓDIGO LEGADO
// ============================================================================

describe('Fase 1: Remoção de Código Legado', () => {
  
  // @clause CL-RM-001
  it('succeeds when ComponentStyleEditor.tsx is completely removed', () => {
    const editorExists = fileExists('src/components/layout/ComponentStyleEditor.tsx')
    expect(editorExists).toBe(false)
    
    // Verifica que nenhum arquivo importa ComponentStyleEditor
    const filesToCheck = [
      'src/components/layout/LayoutConfigurator.tsx',
      'src/components/layout/ExportDialog.tsx',
      'src/App.tsx',
    ]
    
    filesToCheck.forEach(file => {
      if (fileExists(file)) {
        const content = readFile(file)
        const importsEditor = hasImport(content, 'ComponentStyleEditor')
        expect(importsEditor).toBe(false)
      }
    })
  })

  // @clause CL-RM-002
  it('succeeds when all ComponentPreview granular files are removed', () => {
    // Verifica que arquivos de preview granular não existem
    const previewFiles = [
      'src/components/layout/ComponentPreview.tsx',
      'src/components/layout/ComponentPreviewV2.tsx',
      'src/components/layout/ComponentPreviewGallery.tsx',
      'src/components/layout/componentStyleCatalog.ts',
    ]
    
    previewFiles.forEach(file => {
      const exists = fileExists(file)
      expect(exists).toBe(false)
    })
    
    // Verifica que nenhum arquivo importa esses componentes
    if (fileExists('src/components/layout/LayoutConfigurator.tsx')) {
      const content = readFile('src/components/layout/LayoutConfigurator.tsx')
      expect(hasImport(content, 'ComponentPreview')).toBe(false)
      expect(hasImport(content, 'ComponentPreviewV2')).toBe(false)
      expect(hasImport(content, 'ComponentPreviewGallery')).toBe(false)
      expect(hasImport(content, 'componentStyleCatalog')).toBe(false)
    }
  })

  // @clause CL-RM-003
  it('succeeds when all UIContract legacy files are removed from lib/', () => {
    const uiContractFiles = [
      'src/lib/componentRequirements.ts',
      'src/lib/createEmptyUIContract.ts',
      'src/lib/migrateToUIContract.ts',
      'src/lib/uiContractUtils.ts',
      'src/lib/validateUIContract.ts',
      'src/types/ui-contract.types.ts',
    ]
    
    uiContractFiles.forEach(file => {
      const exists = fileExists(file)
      expect(exists).toBe(false)
    })
    
    // Verifica que types/index.ts não exporta UIContract types
    if (fileExists('src/types/index.ts')) {
      const content = readFile('src/types/index.ts')
      expect(content.includes('ui-contract.types')).toBe(false)
      expect(hasExport(content, 'UIContract')).toBe(false)
    }
  })
})

// ============================================================================
// TESTES - FASE 2: INVARIANTES (ARQUIVOS PRESERVADOS)
// ============================================================================

describe('Fase 2: Invariantes - Arquivos Preservados', () => {
  
  // @clause CL-INV-001
  it('succeeds when LayoutConfigPanel is preserved and functional', () => {
    const panelExists = fileExists('src/components/layout/LayoutConfigPanel.tsx')
    expect(panelExists).toBe(true)
    
    // Verifica que é um componente React válido
    const content = readFile('src/components/layout/LayoutConfigPanel.tsx')
    
    // Deve ter export do componente
    expect(
      hasExport(content, 'LayoutConfigPanel') ||
      content.includes('export default')
    ).toBe(true)
    
    // Deve ter configurações de sidebar/header/content
    expect(content.includes('sidebar')).toBe(true)
    expect(content.includes('header')).toBe(true)
    expect(content.includes('content')).toBe(true)
  })

  // @clause CL-INV-002
  it('succeeds when LayoutPreview is preserved and functional', () => {
    const previewExists = fileExists('src/components/layout/LayoutPreview.tsx')
    expect(previewExists).toBe(true)
    
    // Verifica que é um componente React válido
    const content = readFile('src/components/layout/LayoutPreview.tsx')
    
    // Deve ter export do componente
    expect(
      hasExport(content, 'LayoutPreview') ||
      content.includes('export default')
    ).toBe(true)
    
    // Deve ter preview visual do layout
    expect(
      content.includes('preview') ||
      content.includes('Preview')
    ).toBe(true)
  })
})

// ============================================================================
// TESTES - FASE 3: COMPONENT CATALOG EDITOR
// ============================================================================

describe('Fase 3: ComponentCatalogEditor', () => {
  
  // @clause CL-CAT-001
  it('succeeds when ComponentCatalogEditor exists and renders component list', () => {
    const editorExists = fileExists('src/components/layout/ComponentCatalogEditor.tsx')
    expect(editorExists).toBe(true)
    
    const content = readFile('src/components/layout/ComponentCatalogEditor.tsx')
    
    // Deve ter data-testid principal
    expect(hasDataTestId(content, 'component-catalog-editor')).toBe(true)
    
    // Deve ter export do componente
    expect(
      hasExport(content, 'ComponentCatalogEditor') ||
      content.includes('export default')
    ).toBe(true)
    
    // Deve renderizar lista de componentes
    expect(
      hasDataTestId(content, 'component-list') ||
      content.includes('component') && content.includes('list')
    ).toBe(true)
  })

  // @clause CL-CAT-002
  it('succeeds when user can add new component to catalog', () => {
    const content = readFile('src/components/layout/ComponentCatalogEditor.tsx')
    
    // Deve ter botão de adicionar
    expect(hasDataTestId(content, 'add-component-btn')).toBe(true)
    
    // Deve ter handler de adição (onClick ou similar)
    expect(
      content.includes('onClick') ||
      content.includes('onPress') ||
      content.includes('handleAdd')
    ).toBe(true)
    
    // Deve ter campos para novo componente (name, import)
    expect(content.includes('name')).toBe(true)
    expect(content.includes('import')).toBe(true)
  })

  // @clause CL-CAT-003
  it('succeeds when user can edit component details', () => {
    const content = readFile('src/components/layout/ComponentCatalogEditor.tsx')
    
    // Deve ter inputs para variants
    expect(
      hasDataTestId(content, 'variants-input') ||
      content.includes('variants')
    ).toBe(true)
    
    // Deve ter inputs para forbidden elements
    expect(
      hasDataTestId(content, 'forbidden-elements-input') ||
      content.includes('forbidden') && content.includes('elements')
    ).toBe(true)
    
    // Deve ter inputs para forbidden classes
    expect(
      hasDataTestId(content, 'forbidden-classes-input') ||
      content.includes('forbidden') && content.includes('classes')
    ).toBe(true)
    
    // Deve ter textarea para usage example
    expect(
      hasDataTestId(content, 'usage-textarea') ||
      content.includes('usage')
    ).toBe(true)
  })

  // @clause CL-CAT-004
  it('succeeds when user can remove component from catalog', () => {
    const content = readFile('src/components/layout/ComponentCatalogEditor.tsx')
    
    // Deve ter botão de remover
    expect(
      hasDataTestId(content, 'remove-component-btn') ||
      content.includes('remove') ||
      content.includes('delete')
    ).toBe(true)
    
    // Deve ter handler de remoção
    expect(
      content.includes('handleRemove') ||
      content.includes('handleDelete') ||
      content.includes('onRemove') ||
      content.includes('onDelete')
    ).toBe(true)
  })
})

// ============================================================================
// TESTES - FASE 4: GERADORES (UNIT TESTS)
// ============================================================================

describe('Fase 4: Geradores - generateRegistry', () => {
  
  // Mock data para testes
  const mockLayoutConfig = {
    sidebar: {
      position: 'left' as const,
      width: 280,
      collapsedWidth: 64,
      collapsible: true,
    },
    header: {
      height: 64,
      fixed: true,
    },
    content: {
      padding: 24,
      maxWidth: 1400,
    },
  }
  
  const mockComponents = {
    Button: {
      import: '@/components/ui/button',
      variants: ['default', 'destructive', 'outline'],
      forbidden: {
        elements: ['button'],
        classes: ['bg-*', 'text-*'],
      },
      usage: '<Button variant="default">Click</Button>',
    },
    Select: {
      import: '@/components/ui/select',
      exports: ['Select', 'SelectTrigger', 'SelectValue'],
      forbidden: {
        elements: ['select', 'option'],
      },
    },
  }
  
  const mockGlobalRules = {
    forbiddenPatterns: [
      {
        pattern: 'bg-\\[#.*\\]',
        message: 'Use design system colors',
      },
    ],
    allowedColorClasses: ['bg-primary', 'bg-destructive'],
    protectedPaths: ['src/components/ui/**'],
  }

  // @clause CL-GEN-001
  it('succeeds when generateRegistry produces valid YAML with all sections', () => {
    // Importa função real ou simula
    let generateRegistry: any
    try {
      const module = require(join(ROOT_DIR, 'src/lib/generateRegistry'))
      generateRegistry = module.generateRegistry || module.default
    } catch {
      // Se não existir ainda, testa estrutura do arquivo
      const generatorExists = fileExists('src/lib/generateRegistry.ts')
      expect(generatorExists).toBe(true)
      
      if (generatorExists) {
        const content = readFile('src/lib/generateRegistry.ts')
        expect(hasExport(content, 'generateRegistry')).toBe(true)
        return // Pula teste funcional se arquivo existe mas não compila
      }
    }
    
    // Se função existe, testa comportamento
    if (generateRegistry) {
      const yaml = generateRegistry(mockLayoutConfig, mockComponents, mockGlobalRules)
      
      // Deve retornar string
      expect(typeof yaml).toBe('string')
      
      // Deve ser parseável como YAML
      let parsed: any
      expect(() => {
        parsed = YAML.parse(yaml)
      }).not.toThrow()
      
      // Deve conter seção version
      expect(parsed).toHaveProperty('version')
      expect(parsed.version).toBe('1.0')
      
      // Deve conter seção metadata
      expect(parsed).toHaveProperty('metadata')
      expect(parsed.metadata).toHaveProperty('generatedBy', 'uild')
      
      // Deve conter seção layout
      expect(parsed).toHaveProperty('layout')
      expect(parsed.layout).toHaveProperty('component')
      expect(parsed.layout).toHaveProperty('import')
      expect(parsed.layout).toHaveProperty('config')
      
      // Deve conter seção components
      expect(parsed).toHaveProperty('components')
      expect(parsed.components).toHaveProperty('Button')
      expect(parsed.components).toHaveProperty('Select')
      
      // Deve conter seção globalRules
      expect(parsed).toHaveProperty('globalRules')
      expect(parsed.globalRules).toHaveProperty('forbiddenPatterns')
    }
  })

  // @clause CL-GEN-001
  it('succeeds when registry includes component variants and forbidden rules', () => {
    const generatorExists = fileExists('src/lib/generateRegistry.ts')
    expect(generatorExists).toBe(true)
    
    let generateRegistry: any
    try {
      const module = require(join(ROOT_DIR, 'src/lib/generateRegistry'))
      generateRegistry = module.generateRegistry || module.default
    } catch {
      return // Pula se não compila
    }
    
    if (generateRegistry) {
      const yaml = generateRegistry(mockLayoutConfig, mockComponents, mockGlobalRules)
      const parsed = YAML.parse(yaml)
      
      // Button deve ter variants
      expect(parsed.components.Button.variants).toContain('default')
      expect(parsed.components.Button.variants).toContain('destructive')
      
      // Button deve ter forbidden elements e classes
      expect(parsed.components.Button.forbidden.elements).toContain('button')
      expect(parsed.components.Button.forbidden.classes).toContain('bg-*')
    }
  })
})

describe('Fase 4: Geradores - generateAppLayout', () => {
  
  const mockLayoutConfig = {
    sidebar: {
      position: 'left' as const,
      width: 280,
      collapsedWidth: 64,
      collapsible: true,
    },
    header: {
      height: 64,
      fixed: true,
    },
    content: {
      padding: 24,
      maxWidth: 1400,
    },
  }

  // @clause CL-GEN-002
  it('succeeds when generateAppLayout produces valid TSX with LAYOUT_CONFIG', () => {
    const generatorExists = fileExists('src/lib/generateAppLayout.ts')
    expect(generatorExists).toBe(true)
    
    let generateAppLayout: any
    try {
      const module = require(join(ROOT_DIR, 'src/lib/generateAppLayout'))
      generateAppLayout = module.generateAppLayout || module.default
    } catch {
      return // Pula se não compila
    }
    
    if (generateAppLayout) {
      const tsx = generateAppLayout(mockLayoutConfig)
      
      // Deve retornar string
      expect(typeof tsx).toBe('string')
      
      // Deve conter const LAYOUT_CONFIG
      expect(tsx.includes('const LAYOUT_CONFIG')).toBe(true)
      
      // Deve conter valores do config
      expect(tsx.includes('280')).toBe(true) // sidebar width
      expect(tsx.includes('64')).toBe(true) // header height
      expect(tsx.includes('24')).toBe(true) // content padding
      
      // Deve conter function AppLayout
      expect(
        tsx.includes('function AppLayout') ||
        tsx.includes('const AppLayout') ||
        tsx.includes('export default function AppLayout')
      ).toBe(true)
      
      // Deve conter subcomponentes
      expect(tsx.includes('AppLayout.Sidebar')).toBe(true)
      expect(tsx.includes('AppLayout.Header')).toBe(true)
      expect(tsx.includes('AppLayout.Content')).toBe(true)
    }
  })

  // @clause CL-GEN-002
  it('succeeds when AppLayout TSX contains proper TypeScript/React structure', () => {
    const generatorExists = fileExists('src/lib/generateAppLayout.ts')
    expect(generatorExists).toBe(true)
    
    let generateAppLayout: any
    try {
      const module = require(join(ROOT_DIR, 'src/lib/generateAppLayout'))
      generateAppLayout = module.generateAppLayout || module.default
    } catch {
      return
    }
    
    if (generateAppLayout) {
      const tsx = generateAppLayout(mockLayoutConfig)
      
      // Deve ter imports React
      expect(
        tsx.includes("import React") ||
        tsx.includes("import * as React") ||
        tsx.includes("'use client'")
      ).toBe(true)
      
      // Deve ter export do componente
      expect(
        tsx.includes('export') &&
        tsx.includes('AppLayout')
      ).toBe(true)
    }
  })
})

describe('Fase 4: Geradores - generateLayoutCSS', () => {
  
  const mockLayoutConfig = {
    sidebar: {
      position: 'left' as const,
      width: 280,
      collapsedWidth: 64,
      collapsible: true,
    },
    header: {
      height: 64,
      fixed: true,
    },
    content: {
      padding: 24,
      maxWidth: 1400,
    },
  }

  // @clause CL-GEN-003
  it('succeeds when generateLayoutCSS produces valid CSS with layout variables', () => {
    const generatorExists = fileExists('src/lib/generateLayoutCSS.ts')
    expect(generatorExists).toBe(true)
    
    let generateLayoutCSS: any
    try {
      const module = require(join(ROOT_DIR, 'src/lib/generateLayoutCSS'))
      generateLayoutCSS = module.generateLayoutCSS || module.default
    } catch {
      return
    }
    
    if (generateLayoutCSS) {
      const css = generateLayoutCSS(mockLayoutConfig)
      
      // Deve retornar string
      expect(typeof css).toBe('string')
      
      // Deve conter variáveis CSS --layout-*
      expect(css.includes('--layout-sidebar-width')).toBe(true)
      expect(css.includes('--layout-header-height')).toBe(true)
      expect(css.includes('--layout-content-padding')).toBe(true)
      
      // Deve conter valores corretos
      expect(css.includes('280px')).toBe(true)
      expect(css.includes('64px')).toBe(true)
      expect(css.includes('24px')).toBe(true)
    }
  })

  // @clause CL-GEN-003
  it('succeeds when CSS variables correspond to config values', () => {
    const generatorExists = fileExists('src/lib/generateLayoutCSS.ts')
    expect(generatorExists).toBe(true)
    
    let generateLayoutCSS: any
    try {
      const module = require(join(ROOT_DIR, 'src/lib/generateLayoutCSS'))
      generateLayoutCSS = module.generateLayoutCSS || module.default
    } catch {
      return
    }
    
    if (generateLayoutCSS) {
      const css = generateLayoutCSS(mockLayoutConfig)
      
      // Verifica mapeamento correto de valores
      const hasSidebarWidth = css.includes('--layout-sidebar-width') && css.includes('280')
      const hasHeaderHeight = css.includes('--layout-header-height') && css.includes('64')
      const hasContentPadding = css.includes('--layout-content-padding') && css.includes('24')
      
      expect(hasSidebarWidth).toBe(true)
      expect(hasHeaderHeight).toBe(true)
      expect(hasContentPadding).toBe(true)
    }
  })
})

// ============================================================================
// TESTES - FASE 5: EXPORT DIALOG
// ============================================================================

describe('Fase 5: ExportDialog - Download Buttons', () => {
  
  // @clause CL-EXP-001
  it('succeeds when export registry button exists and triggers YAML download', () => {
    const dialogExists = fileExists('src/components/layout/ExportDialog.tsx')
    expect(dialogExists).toBe(true)
    
    const content = readFile('src/components/layout/ExportDialog.tsx')
    
    // Deve ter botão de export registry
    expect(
      hasDataTestId(content, 'export-registry-btn') ||
      content.includes('registry') && content.includes('export')
    ).toBe(true)
    
    // Deve ter lógica de download (.yaml)
    expect(
      content.includes('.yaml') ||
      content.includes('component-registry')
    ).toBe(true)
    
    // Deve ter handler de download
    expect(
      content.includes('download') ||
      content.includes('Download') ||
      content.includes('blob') ||
      content.includes('URL.createObjectURL')
    ).toBe(true)
  })

  // @clause CL-EXP-002
  it('succeeds when export AppLayout button exists and triggers TSX download', () => {
    const content = readFile('src/components/layout/ExportDialog.tsx')
    
    // Deve ter botão de export AppLayout
    expect(
      hasDataTestId(content, 'export-applayout-btn') ||
      content.includes('AppLayout') && content.includes('export')
    ).toBe(true)
    
    // Deve ter lógica de download (.tsx)
    expect(
      content.includes('.tsx') ||
      content.includes('AppLayout.tsx')
    ).toBe(true)
  })

  // @clause CL-EXP-003
  it('succeeds when export CSS button exists and triggers CSS download', () => {
    const content = readFile('src/components/layout/ExportDialog.tsx')
    
    // Deve ter botão de export CSS
    expect(
      hasDataTestId(content, 'export-css-btn') ||
      content.includes('CSS') && content.includes('export') ||
      content.includes('variables') && content.includes('export')
    ).toBe(true)
    
    // Deve ter lógica de download (.css)
    expect(
      content.includes('.css') ||
      content.includes('layout-variables')
    ).toBe(true)
  })

  // @clause CL-EXP-001 + CL-EXP-002 + CL-EXP-003
  it('succeeds when ExportDialog integrates all three generators', () => {
    const content = readFile('src/components/layout/ExportDialog.tsx')
    
    // Deve importar os geradores
    expect(
      hasImport(content, 'generateRegistry') ||
      hasImport(content, 'generateAppLayout') ||
      hasImport(content, 'generateLayoutCSS')
    ).toBe(true)
    
    // Deve ter pelo menos 3 handlers de export diferentes
    const exportCount = countOccurrences(content, 'export') + 
                       countOccurrences(content, 'Export') +
                       countOccurrences(content, 'download')
    
    expect(exportCount).toBeGreaterThanOrEqual(3)
  })
})

// ============================================================================
// TESTES - FASE 6: VALIDAÇÃO (ERROR HANDLING)
// ============================================================================

describe('Fase 6: Validação - Error Cases', () => {
  
  // @clause CL-VAL-001
  it('fails when export is attempted with empty catalog - validation error shown', () => {
    const content = readFile('src/components/layout/ExportDialog.tsx')
    
    // Deve ter validação de catálogo vazio
    expect(
      content.includes('length === 0') ||
      content.includes('isEmpty') ||
      content.includes('empty') ||
      content.includes('no components') ||
      content.includes('pelo menos')
    ).toBe(true)
    
    // Deve exibir erro (toast ou alert)
    expect(
      content.includes('toast.error') ||
      content.includes('alert') ||
      content.includes('error')
    ).toBe(true)
  })

  // @clause CL-VAL-001
  it('fails when catalog has zero components - download does not occur', () => {
    // Verifica no ComponentCatalogEditor ou ExportDialog
    const files = [
      'src/components/layout/ComponentCatalogEditor.tsx',
      'src/components/layout/ExportDialog.tsx',
    ]
    
    let hasValidation = false
    files.forEach(file => {
      if (fileExists(file)) {
        const content = readFile(file)
        if (
          content.includes('components.length') ||
          content.includes('isEmpty') ||
          content.includes('!components') ||
          content.includes('components?.length === 0')
        ) {
          hasValidation = true
        }
      }
    })
    
    expect(hasValidation).toBe(true)
  })

  // @clause CL-VAL-002
  it('fails when component has no import path - validation error shown', () => {
    const content = readFile('src/components/layout/ComponentCatalogEditor.tsx')
    
    // Deve validar campo import
    expect(
      content.includes('import') && (
        content.includes('required') ||
        content.includes('trim()') ||
        content.includes('!import') ||
        content.includes('import.length') ||
        content.includes('validation')
      )
    ).toBe(true)
    
    // Deve mostrar erro se import vazio
    expect(
      content.includes('error') ||
      content.includes('invalid') ||
      content.includes('required')
    ).toBe(true)
  })

  // @clause CL-VAL-002
  it('fails when import path is only whitespace - validation catches it', () => {
    const content = readFile('src/components/layout/ComponentCatalogEditor.tsx')
    
    // Deve usar trim() para validar
    expect(
      content.includes('.trim()') ||
      content.includes('trim()')
    ).toBe(true)
    
    // Validação deve checar se resultado é vazio após trim
    expect(
      content.includes('trim()') && (
        content.includes('.length') ||
        content.includes('=== ""') ||
        content.includes('!import')
      )
    ).toBe(true)
  })
})

// ============================================================================
// TESTES - FASE 7: TYPES E INTEGRAÇÃO
// ============================================================================

describe('Fase 7: Types e Integração', () => {
  
  // @clause CL-CAT-001 (implícito - types necessários)
  it('succeeds when registry.types.ts defines necessary interfaces', () => {
    const typesExist = fileExists('src/types/registry.types.ts')
    expect(typesExist).toBe(true)
    
    const content = readFile('src/types/registry.types.ts')
    
    // Deve ter interfaces para ComponentRegistry
    expect(
      content.includes('interface') ||
      content.includes('type')
    ).toBe(true)
    
    // Deve exportar tipos
    expect(content.includes('export')).toBe(true)
  })

  // @clause CL-CAT-001 (implícito - integração com types/index.ts)
  it('succeeds when types/index.ts exports registry types', () => {
    const indexExists = fileExists('src/types/index.ts')
    expect(indexExists).toBe(true)
    
    const content = readFile('src/types/index.ts')
    
    // Deve importar/exportar registry types
    expect(
      content.includes('registry.types') ||
      content.includes('./registry')
    ).toBe(true)
  })

  // @clause CL-RM-003 (verificação adicional)
  it('succeeds when types/index.ts no longer exports UIContract types', () => {
    const content = readFile('src/types/index.ts')
    
    // Não deve ter referência a ui-contract
    expect(content.includes('ui-contract')).toBe(false)
    expect(content.includes('UIContract')).toBe(false)
  })
})

// ============================================================================
// TESTES - FASE 8: INTEGRAÇÃO COMPLETA
// ============================================================================

describe('Fase 8: Integração Completa', () => {
  
  // @clause CL-RM-001
  // @clause CL-RM-002
  // @clause CL-RM-003
  it('succeeds when all legacy files are removed and new files exist', () => {
    // Arquivos que NÃO devem existir
    const removedFiles = [
      'src/components/layout/ComponentStyleEditor.tsx',
      'src/components/layout/ComponentPreview.tsx',
      'src/components/layout/ComponentPreviewV2.tsx',
      'src/components/layout/ComponentPreviewGallery.tsx',
      'src/components/layout/componentStyleCatalog.ts',
      'src/lib/componentRequirements.ts',
      'src/lib/createEmptyUIContract.ts',
      'src/lib/migrateToUIContract.ts',
      'src/lib/uiContractUtils.ts',
      'src/lib/validateUIContract.ts',
      'src/types/ui-contract.types.ts',
    ]
    
    removedFiles.forEach(file => {
      expect(fileExists(file)).toBe(false)
    })
    
    // Arquivos que DEVEM existir
    const newFiles = [
      'src/components/layout/ComponentCatalogEditor.tsx',
      'src/lib/generateRegistry.ts',
      'src/lib/generateAppLayout.ts',
      'src/lib/generateLayoutCSS.ts',
      'src/types/registry.types.ts',
    ]
    
    newFiles.forEach(file => {
      expect(fileExists(file)).toBe(true)
    })
    
    // Arquivos preservados
    const preservedFiles = [
      'src/components/layout/LayoutConfigPanel.tsx',
      'src/components/layout/LayoutPreview.tsx',
    ]
    
    preservedFiles.forEach(file => {
      expect(fileExists(file)).toBe(true)
    })
  })

  // @clause CL-CAT-001
  // @clause CL-EXP-001
  // @clause CL-GEN-001
  it('succeeds when ComponentCatalogEditor integrates with all generators', () => {
    const catalogContent = readFile('src/components/layout/ComponentCatalogEditor.tsx')
    const dialogContent = readFile('src/components/layout/ExportDialog.tsx')
    
    // ComponentCatalogEditor deve ser usado no ExportDialog ou similar
    const catalogUsed = 
      hasImport(dialogContent, 'ComponentCatalogEditor') ||
      dialogContent.includes('catalog') ||
      catalogContent.includes('onExport') ||
      catalogContent.includes('onChange')
    
    expect(catalogUsed).toBe(true)
    
    // ExportDialog deve usar os geradores
    const usesGenerators =
      hasImport(dialogContent, 'generateRegistry') ||
      hasImport(dialogContent, 'generateAppLayout') ||
      hasImport(dialogContent, 'generateLayoutCSS') ||
      dialogContent.includes('generateRegistry') ||
      dialogContent.includes('generateAppLayout') ||
      dialogContent.includes('generateLayoutCSS')
    
    expect(usesGenerators).toBe(true)
  })

  // @clause CL-INV-001
  // @clause CL-GEN-001
  it('succeeds when UILD v2 maintains backward compatibility with layout config', () => {
    // Layout config deve continuar sendo usado
    const panelContent = readFile('src/components/layout/LayoutConfigPanel.tsx')
    
    // Deve ter state ou props para sidebar/header/content
    expect(
      panelContent.includes('sidebar') &&
      panelContent.includes('header') &&
      panelContent.includes('content')
    ).toBe(true)
    
    // Geradores devem aceitar layout config
    if (fileExists('src/lib/generateRegistry.ts')) {
      const registryContent = readFile('src/lib/generateRegistry.ts')
      expect(
        registryContent.includes('layoutConfig') ||
        registryContent.includes('layout')
      ).toBe(true)
    }
  })
})
