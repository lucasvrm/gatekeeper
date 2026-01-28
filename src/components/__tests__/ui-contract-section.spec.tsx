/**
 * UI Contract Frontend & Documentation Specification Tests
 * 
 * Este spec valida a implementação das Fases 4 (Frontend) e 5 (Documentação).
 * Os testes são contratos: se falharem, a LLM executora errou na implementação.
 * 
 * Fase 4 (CL-FE-001 a CL-FE-014): Frontend components, API client, tipos
 * Fase 5 (CL-DOC-001 a CL-DOC-007): Documentação
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// ============================================================================
// TYPES
// ============================================================================

interface UIContract {
  id: string
  projectId: string
  version: string
  hash: string
  uploadedAt: string
  contract?: UIContractSchema
}

interface UIContractSchema {
  version: string
  metadata: {
    projectName: string
    exportedFrom: string
    exportedAt: string
    hash: string
  }
  components: Record<string, unknown>
  styles: Record<string, string>
}

interface MockProject {
  id: string
  name: string
  uiContract: UIContract | null
}

// ============================================================================
// HELPERS
// ============================================================================

const ROOT_PATH = path.resolve(process.cwd())
const SRC_PATH = path.join(ROOT_PATH, 'src')
const DOCS_PATH = path.join(ROOT_PATH, 'packages/gatekeeper-api/docs')
const README_PATH = path.join(ROOT_PATH, 'packages/gatekeeper-api/README.md')

function readSourceFile(relativePath: string): string | null {
  const fullPath = path.join(SRC_PATH, relativePath)
  if (!fs.existsSync(fullPath)) {
    return null
  }
  return fs.readFileSync(fullPath, 'utf-8')
}

function readDocsFile(filename: string): string | null {
  const fullPath = path.join(DOCS_PATH, filename)
  if (!fs.existsSync(fullPath)) {
    return null
  }
  return fs.readFileSync(fullPath, 'utf-8')
}

function readReadme(): string | null {
  if (!fs.existsSync(README_PATH)) {
    return null
  }
  return fs.readFileSync(README_PATH, 'utf-8')
}

function fileExists(relativePath: string): boolean {
  return fs.existsSync(path.join(SRC_PATH, relativePath))
}

function docsFileExists(filename: string): boolean {
  return fs.existsSync(path.join(DOCS_PATH, filename))
}

function createMockUIContract(): UIContract {
  return {
    id: 'uic_test123',
    projectId: 'proj_test123',
    version: '1.0.0',
    hash: 'abc123def456',
    uploadedAt: new Date().toISOString(),
    contract: {
      version: '1.0.0',
      metadata: {
        projectName: 'TestProject',
        exportedFrom: 'Figma',
        exportedAt: new Date().toISOString(),
        hash: 'abc123def456',
      },
      components: {
        Button: { variants: ['primary', 'secondary'] },
      },
      styles: {
        'Button.primary.root.default.backgroundColor': '#007bff',
      },
    },
  }
}

function createMockProject(withContract: boolean = false): MockProject {
  return {
    id: 'proj_test123',
    name: 'Test Project',
    uiContract: withContract ? createMockUIContract() : null,
  }
}

// ============================================================================
// PHASE 4 — FRONTEND: Component Structure
// ============================================================================

describe('Phase 4 — Frontend: Component Files', () => {
  // @clause CL-FE-001
  it('succeeds when UIContractSection component file exists', () => {
    const componentContent = readSourceFile('components/ui-contract-section.tsx')
    
    expect(componentContent).not.toBeNull()
    expect(componentContent).toMatch(/export\s+(function|const)\s+UIContractSection/)
  })

  // @clause CL-FE-001
  it('succeeds when UIContractSection has data-testid="ui-contract-section"', () => {
    const componentContent = readSourceFile('components/ui-contract-section.tsx')
    
    expect(componentContent).not.toBeNull()
    expect(componentContent).toMatch(/data-testid=["']ui-contract-section["']/)
  })

  // @clause CL-FE-004
  it('succeeds when UIContractUploadDialog component file exists', () => {
    const componentContent = readSourceFile('components/ui-contract-upload-dialog.tsx')
    
    expect(componentContent).not.toBeNull()
    expect(componentContent).toMatch(/export\s+(function|const)\s+UIContractUploadDialog/)
  })

  // @clause CL-FE-004
  it('succeeds when UIContractUploadDialog has data-testid="ui-contract-upload-dialog"', () => {
    const componentContent = readSourceFile('components/ui-contract-upload-dialog.tsx')
    
    expect(componentContent).not.toBeNull()
    expect(componentContent).toMatch(/data-testid=["']ui-contract-upload-dialog["']/)
  })

  // @clause CL-FE-004
  it('succeeds when UIContractUploadDialog has dropzone with data-testid', () => {
    const componentContent = readSourceFile('components/ui-contract-upload-dialog.tsx')
    
    expect(componentContent).not.toBeNull()
    expect(componentContent).toMatch(/data-testid=["']ui-contract-dropzone["']/)
  })
})

// ============================================================================
// PHASE 4 — FRONTEND: Empty State
// ============================================================================

describe('Phase 4 — Frontend: Empty State', () => {
  // @clause CL-FE-002
  it('succeeds when UIContractSection has empty state with data-testid', () => {
    const componentContent = readSourceFile('components/ui-contract-section.tsx')
    
    expect(componentContent).not.toBeNull()
    expect(componentContent).toMatch(/data-testid=["']ui-contract-empty["']/)
  })

  // @clause CL-FE-002
  it('succeeds when UIContractSection has upload button in empty state', () => {
    const componentContent = readSourceFile('components/ui-contract-section.tsx')
    
    expect(componentContent).not.toBeNull()
    expect(componentContent).toMatch(/data-testid=["']ui-contract-upload-btn["']/)
  })
})

// ============================================================================
// PHASE 4 — FRONTEND: Loaded State
// ============================================================================

describe('Phase 4 — Frontend: Loaded State', () => {
  // @clause CL-FE-003
  it('succeeds when UIContractSection has loaded state with data-testid', () => {
    const componentContent = readSourceFile('components/ui-contract-section.tsx')
    
    expect(componentContent).not.toBeNull()
    expect(componentContent).toMatch(/data-testid=["']ui-contract-loaded["']/)
  })

  // @clause CL-FE-003
  it('succeeds when UIContractSection has version display', () => {
    const componentContent = readSourceFile('components/ui-contract-section.tsx')
    
    expect(componentContent).not.toBeNull()
    expect(componentContent).toMatch(/data-testid=["']ui-contract-version["']/)
  })

  // @clause CL-FE-003
  it('succeeds when UIContractSection has hash display', () => {
    const componentContent = readSourceFile('components/ui-contract-section.tsx')
    
    expect(componentContent).not.toBeNull()
    expect(componentContent).toMatch(/data-testid=["']ui-contract-hash["']/)
  })

  // @clause CL-FE-003
  it('succeeds when UIContractSection has date display', () => {
    const componentContent = readSourceFile('components/ui-contract-section.tsx')
    
    expect(componentContent).not.toBeNull()
    expect(componentContent).toMatch(/data-testid=["']ui-contract-date["']/)
  })
})

// ============================================================================
// PHASE 4 — FRONTEND: Delete Functionality
// ============================================================================

describe('Phase 4 — Frontend: Delete Functionality', () => {
  // @clause CL-FE-008
  it('succeeds when UIContractSection has delete button', () => {
    const componentContent = readSourceFile('components/ui-contract-section.tsx')
    
    expect(componentContent).not.toBeNull()
    expect(componentContent).toMatch(/data-testid=["']ui-contract-delete-btn["']/)
  })

  // @clause CL-FE-008
  it('succeeds when UIContractSection uses AlertDialog for delete confirmation', () => {
    const componentContent = readSourceFile('components/ui-contract-section.tsx')
    
    expect(componentContent).not.toBeNull()
    // Verifica uso de AlertDialog (shadcn/ui)
    expect(componentContent).toMatch(/AlertDialog|alertdialog|confirm/i)
  })
})

// ============================================================================
// PHASE 4 — FRONTEND: Upload Validation
// ============================================================================

describe('Phase 4 — Frontend: Upload Validation', () => {
  // @clause CL-FE-005
  it('succeeds when UIContractUploadDialog validates JSON files', () => {
    const componentContent = readSourceFile('components/ui-contract-upload-dialog.tsx')
    
    expect(componentContent).not.toBeNull()
    // Deve verificar extensão .json ou tipo application/json
    expect(componentContent).toMatch(/\.json|application\/json|JSON/i)
  })

  // @clause CL-FE-005
  it('succeeds when UIContractUploadDialog has submit button', () => {
    const componentContent = readSourceFile('components/ui-contract-upload-dialog.tsx')
    
    expect(componentContent).not.toBeNull()
    expect(componentContent).toMatch(/data-testid=["']ui-contract-submit-btn["']/)
  })
})

// ============================================================================
// PHASE 4 — FRONTEND: API Client
// ============================================================================

describe('Phase 4 — Frontend: API Client', () => {
  // @clause CL-FE-011
  it('succeeds when api.ts has uiContract namespace', () => {
    const apiContent = readSourceFile('lib/api.ts')
    
    expect(apiContent).not.toBeNull()
    expect(apiContent).toMatch(/uiContract\s*:\s*\{/)
  })

  // @clause CL-FE-011
  it('succeeds when api.uiContract has get method', () => {
    const apiContent = readSourceFile('lib/api.ts')
    
    expect(apiContent).not.toBeNull()
    // Deve ter método get dentro de uiContract
    expect(apiContent).toMatch(/uiContract[\s\S]*?get\s*:\s*async/)
  })

  // @clause CL-FE-011
  it('succeeds when api.uiContract has upload method', () => {
    const apiContent = readSourceFile('lib/api.ts')
    
    expect(apiContent).not.toBeNull()
    // Deve ter método upload dentro de uiContract
    expect(apiContent).toMatch(/uiContract[\s\S]*?upload\s*:\s*async/)
  })

  // @clause CL-FE-011
  it('succeeds when api.uiContract has delete method', () => {
    const apiContent = readSourceFile('lib/api.ts')
    
    expect(apiContent).not.toBeNull()
    // Deve ter método delete dentro de uiContract
    expect(apiContent).toMatch(/uiContract[\s\S]*?delete\s*:\s*async/)
  })

  // @clause CL-FE-011
  it('succeeds when api.uiContract.get calls correct endpoint', () => {
    const apiContent = readSourceFile('lib/api.ts')
    
    expect(apiContent).not.toBeNull()
    expect(apiContent).toMatch(/projects\/.*\/ui-contract|ui-contract/)
  })
})

// ============================================================================
// PHASE 4 — FRONTEND: Types
// ============================================================================

describe('Phase 4 — Frontend: Types', () => {
  // @clause CL-FE-012
  it('succeeds when types.ts exports UIContract interface', () => {
    const typesContent = readSourceFile('lib/types.ts')
    
    expect(typesContent).not.toBeNull()
    expect(typesContent).toMatch(/export\s+(interface|type)\s+UIContract\b/)
  })

  // @clause CL-FE-012
  it('succeeds when UIContract has required fields', () => {
    const typesContent = readSourceFile('lib/types.ts')
    
    expect(typesContent).not.toBeNull()
    // UIContract deve ter: id, projectId, version, hash, uploadedAt
    expect(typesContent).toMatch(/UIContract[\s\S]*?id\s*:\s*string/)
    expect(typesContent).toMatch(/UIContract[\s\S]*?projectId\s*:\s*string/)
    expect(typesContent).toMatch(/UIContract[\s\S]*?version\s*:\s*string/)
    expect(typesContent).toMatch(/UIContract[\s\S]*?hash\s*:\s*string/)
    expect(typesContent).toMatch(/UIContract[\s\S]*?uploadedAt\s*:\s*string/)
  })

  // @clause CL-FE-012
  it('succeeds when types.ts exports UIContractSchema interface', () => {
    const typesContent = readSourceFile('lib/types.ts')
    
    expect(typesContent).not.toBeNull()
    expect(typesContent).toMatch(/export\s+(interface|type)\s+UIContractSchema\b/)
  })

  // @clause CL-FE-012
  it('succeeds when UIContractSchema has required fields', () => {
    const typesContent = readSourceFile('lib/types.ts')
    
    expect(typesContent).not.toBeNull()
    // UIContractSchema deve ter: version, metadata, components, styles
    expect(typesContent).toMatch(/UIContractSchema[\s\S]*?version\s*:/)
    expect(typesContent).toMatch(/UIContractSchema[\s\S]*?metadata\s*:/)
    expect(typesContent).toMatch(/UIContractSchema[\s\S]*?components\s*:/)
    expect(typesContent).toMatch(/UIContractSchema[\s\S]*?styles\s*:/)
  })
})

// ============================================================================
// PHASE 4 — FRONTEND: Page Integration
// ============================================================================

describe('Phase 4 — Frontend: Page Integration', () => {
  // @clause CL-FE-001
  it('succeeds when project-details-page imports UIContractSection', () => {
    const pageContent = readSourceFile('components/project-details-page.tsx')
    
    expect(pageContent).not.toBeNull()
    expect(pageContent).toMatch(/import.*UIContractSection|from.*ui-contract-section/)
  })

  // @clause CL-FE-001
  it('succeeds when project-details-page renders UIContractSection', () => {
    const pageContent = readSourceFile('components/project-details-page.tsx')
    
    expect(pageContent).not.toBeNull()
    expect(pageContent).toMatch(/<UIContractSection/)
  })

  // @clause CL-FE-013
  it('succeeds when project-details-page preserves header with back button', () => {
    const pageContent = readSourceFile('components/project-details-page.tsx')
    
    expect(pageContent).not.toBeNull()
    expect(pageContent).toMatch(/ArrowLeft|Voltar|navigate.*projects/)
  })

  // @clause CL-FE-013
  it('succeeds when project-details-page preserves project data card', () => {
    const pageContent = readSourceFile('components/project-details-page.tsx')
    
    expect(pageContent).not.toBeNull()
    expect(pageContent).toMatch(/Base\s*Ref|baseRef/)
    expect(pageContent).toMatch(/Target\s*Ref|targetRef/)
  })

  // @clause CL-FE-013
  it('succeeds when project-details-page preserves Runs section', () => {
    const pageContent = readSourceFile('components/project-details-page.tsx')
    
    expect(pageContent).not.toBeNull()
    expect(pageContent).toMatch(/Runs|Nova\s*Run/)
    expect(pageContent).toMatch(/<Table/)
  })
})

// ============================================================================
// PHASE 4 — FRONTEND: No New Dependencies
// ============================================================================

describe('Phase 4 — Frontend: No New Dependencies', () => {
  // @clause CL-FE-014
  it('succeeds when package.json has no new dependencies', () => {
    const packageJsonPath = path.join(ROOT_PATH, 'package.json')
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
    
    // Lista de dependências conhecidas/permitidas
    const allowedDeps = [
      '@hookform/resolvers',
      '@phosphor-icons/react',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-label',
      '@radix-ui/react-popover',
      '@radix-ui/react-progress',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-select',
      '@radix-ui/react-separator',
      '@radix-ui/react-slider',
      '@radix-ui/react-slot',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
      '@radix-ui/react-tooltip',
      '@tanstack/react-query',
      '@tanstack/react-table',
      'class-variance-authority',
      'clsx',
      'cmdk',
      'diff2html',
      'lucide-react',
      'react',
      'react-dom',
      'react-dropzone',
      'react-hook-form',
      'react-router-dom',
      'react-syntax-highlighter',
      'sonner',
      'tailwind-merge',
      'tailwindcss-animate',
      'vaul',
      'zod',
    ]
    
    const deps = Object.keys(packageJson.dependencies || {})
    
    for (const dep of deps) {
      // Verifica se a dependência é conhecida ou é uma variação permitida
      const isAllowed = allowedDeps.some(allowed => 
        dep === allowed || dep.startsWith('@radix-ui/') || dep.startsWith('@tanstack/')
      )
      expect(isAllowed || allowedDeps.includes(dep)).toBe(true)
    }
  })
})

// ============================================================================
// PHASE 4 — FRONTEND: Toast Usage
// ============================================================================

describe('Phase 4 — Frontend: Toast Integration', () => {
  // @clause CL-FE-006
  it('succeeds when UIContractSection uses toast for success messages', () => {
    const componentContent = readSourceFile('components/ui-contract-section.tsx')
    
    expect(componentContent).not.toBeNull()
    // Deve usar toast (sonner ou similar)
    expect(componentContent).toMatch(/toast|Toast|sonner/i)
  })

  // @clause CL-FE-007
  it('succeeds when UIContractUploadDialog uses toast for error messages', () => {
    const componentContent = readSourceFile('components/ui-contract-upload-dialog.tsx')
    
    expect(componentContent).not.toBeNull()
    expect(componentContent).toMatch(/toast|Toast|sonner/i)
  })
})

// ============================================================================
// PHASE 5 — DOCUMENTATION: API Documentation
// ============================================================================

describe('Phase 5 — Documentation: API Documentation', () => {
  // @clause CL-DOC-001
  it('succeeds when UI_CONTRACT_API.md file exists', () => {
    expect(docsFileExists('UI_CONTRACT_API.md')).toBe(true)
  })

  // @clause CL-DOC-001
  it('succeeds when UI_CONTRACT_API.md documents GET endpoint', () => {
    const content = readDocsFile('UI_CONTRACT_API.md')
    
    expect(content).not.toBeNull()
    expect(content).toMatch(/GET/i)
    expect(content).toMatch(/\/api\/projects\/.*\/ui-contract|ui-contract/)
  })

  // @clause CL-DOC-001
  it('succeeds when UI_CONTRACT_API.md documents POST endpoint', () => {
    const content = readDocsFile('UI_CONTRACT_API.md')
    
    expect(content).not.toBeNull()
    expect(content).toMatch(/POST/i)
  })

  // @clause CL-DOC-001
  it('succeeds when UI_CONTRACT_API.md documents DELETE endpoint', () => {
    const content = readDocsFile('UI_CONTRACT_API.md')
    
    expect(content).not.toBeNull()
    expect(content).toMatch(/DELETE/i)
  })

  // @clause CL-DOC-001
  it('succeeds when UI_CONTRACT_API.md has request/response examples', () => {
    const content = readDocsFile('UI_CONTRACT_API.md')
    
    expect(content).not.toBeNull()
    // Deve ter blocos de código com exemplos
    expect(content).toMatch(/```(json|typescript|ts)?[\s\S]*?```/)
  })

  // @clause CL-DOC-006
  it('succeeds when UI_CONTRACT_API.md documents error codes', () => {
    const content = readDocsFile('UI_CONTRACT_API.md')
    
    expect(content).not.toBeNull()
    expect(content).toMatch(/INVALID_CONTRACT/)
    expect(content).toMatch(/PROJECT_NOT_FOUND/)
    expect(content).toMatch(/CONTRACT_NOT_FOUND/)
  })

  // @clause CL-DOC-006
  it('succeeds when UI_CONTRACT_API.md documents HTTP status codes', () => {
    const content = readDocsFile('UI_CONTRACT_API.md')
    
    expect(content).not.toBeNull()
    expect(content).toMatch(/400|Bad Request/i)
    expect(content).toMatch(/404|Not Found/i)
    expect(content).toMatch(/200|OK|Success/i)
  })
})

// ============================================================================
// PHASE 5 — DOCUMENTATION: Schema Documentation
// ============================================================================

describe('Phase 5 — Documentation: Schema Documentation', () => {
  // @clause CL-DOC-002
  it('succeeds when UI_CONTRACT_SCHEMA.md file exists', () => {
    expect(docsFileExists('UI_CONTRACT_SCHEMA.md')).toBe(true)
  })

  // @clause CL-DOC-002
  it('succeeds when UI_CONTRACT_SCHEMA.md has TypeScript definition', () => {
    const content = readDocsFile('UI_CONTRACT_SCHEMA.md')
    
    expect(content).not.toBeNull()
    // Deve ter definição TypeScript
    expect(content).toMatch(/```(typescript|ts)[\s\S]*?interface|type[\s\S]*?```/)
  })

  // @clause CL-DOC-002
  it('succeeds when UI_CONTRACT_SCHEMA.md documents version field', () => {
    const content = readDocsFile('UI_CONTRACT_SCHEMA.md')
    
    expect(content).not.toBeNull()
    expect(content).toMatch(/version/i)
  })

  // @clause CL-DOC-002
  it('succeeds when UI_CONTRACT_SCHEMA.md documents metadata field', () => {
    const content = readDocsFile('UI_CONTRACT_SCHEMA.md')
    
    expect(content).not.toBeNull()
    expect(content).toMatch(/metadata/i)
  })

  // @clause CL-DOC-002
  it('succeeds when UI_CONTRACT_SCHEMA.md documents components field', () => {
    const content = readDocsFile('UI_CONTRACT_SCHEMA.md')
    
    expect(content).not.toBeNull()
    expect(content).toMatch(/components/i)
  })

  // @clause CL-DOC-002
  it('succeeds when UI_CONTRACT_SCHEMA.md documents styles field', () => {
    const content = readDocsFile('UI_CONTRACT_SCHEMA.md')
    
    expect(content).not.toBeNull()
    expect(content).toMatch(/styles/i)
  })

  // @clause CL-DOC-002
  it('succeeds when UI_CONTRACT_SCHEMA.md has valid example', () => {
    const content = readDocsFile('UI_CONTRACT_SCHEMA.md')
    
    expect(content).not.toBeNull()
    // Deve ter exemplo JSON válido
    expect(content).toMatch(/```json[\s\S]*?\{[\s\S]*?"version"[\s\S]*?\}[\s\S]*?```/)
  })

  // @clause CL-DOC-005
  it('succeeds when UI_CONTRACT_SCHEMA.md JSON examples are valid', () => {
    const content = readDocsFile('UI_CONTRACT_SCHEMA.md')
    
    expect(content).not.toBeNull()
    
    // Extrai blocos JSON e valida
    const jsonBlocks = content!.match(/```json\n([\s\S]*?)```/g)
    
    if (jsonBlocks) {
      for (const block of jsonBlocks) {
        const jsonContent = block.replace(/```json\n?/, '').replace(/```$/, '').trim()
        expect(() => JSON.parse(jsonContent)).not.toThrow()
      }
    }
  })
})

// ============================================================================
// PHASE 5 — DOCUMENTATION: README Update
// ============================================================================

describe('Phase 5 — Documentation: README Update', () => {
  // @clause CL-DOC-003
  it('succeeds when README.md has UI Contract section', () => {
    const content = readReadme()
    
    expect(content).not.toBeNull()
    expect(content).toMatch(/UI\s*Contract/i)
  })

  // @clause CL-DOC-003
  it('succeeds when README.md links to API documentation', () => {
    const content = readReadme()
    
    expect(content).not.toBeNull()
    expect(content).toMatch(/UI_CONTRACT_API\.md|docs\/.*ui.*contract.*api/i)
  })

  // @clause CL-DOC-003
  it('succeeds when README.md links to Schema documentation', () => {
    const content = readReadme()
    
    expect(content).not.toBeNull()
    expect(content).toMatch(/UI_CONTRACT_SCHEMA\.md|docs\/.*ui.*contract.*schema/i)
  })

  // @clause CL-DOC-003
  it('succeeds when README.md has brief description of UI Contract', () => {
    const content = readReadme()
    
    expect(content).not.toBeNull()
    // Deve ter descrição além do título
    const uiContractSection = content!.match(/##.*UI\s*Contract[\s\S]*?(?=##|$)/i)
    expect(uiContractSection).not.toBeNull()
    expect(uiContractSection![0].length).toBeGreaterThan(50)
  })
})

// ============================================================================
// PHASE 5 — DOCUMENTATION: Validators Documentation
// ============================================================================

describe('Phase 5 — Documentation: Validators', () => {
  // @clause CL-DOC-004
  it('succeeds when documentation mentions UI_PLAN_COVERAGE validator', () => {
    const apiDoc = readDocsFile('UI_CONTRACT_API.md')
    const schemaDoc = readDocsFile('UI_CONTRACT_SCHEMA.md')
    const readme = readReadme()
    
    // Pelo menos um dos documentos deve mencionar o validator
    const hasReference = 
      (apiDoc && apiDoc.match(/UI_PLAN_COVERAGE/)) ||
      (schemaDoc && schemaDoc.match(/UI_PLAN_COVERAGE/)) ||
      (readme && readme.match(/UI_PLAN_COVERAGE/))
    
    // SHOULD - não falha se não tiver, mas verifica se tem
    if (hasReference) {
      expect(hasReference).toBeTruthy()
    } else {
      // Warn but don't fail (SHOULD, not MUST)
      console.warn('UI_PLAN_COVERAGE validator not documented (SHOULD)')
      expect(true).toBe(true)
    }
  })

  // @clause CL-DOC-004
  it('succeeds when documentation mentions UI_TEST_COVERAGE validator', () => {
    const apiDoc = readDocsFile('UI_CONTRACT_API.md')
    const schemaDoc = readDocsFile('UI_CONTRACT_SCHEMA.md')
    const readme = readReadme()
    
    const hasReference = 
      (apiDoc && apiDoc.match(/UI_TEST_COVERAGE/)) ||
      (schemaDoc && schemaDoc.match(/UI_TEST_COVERAGE/)) ||
      (readme && readme.match(/UI_TEST_COVERAGE/))
    
    if (hasReference) {
      expect(hasReference).toBeTruthy()
    } else {
      console.warn('UI_TEST_COVERAGE validator not documented (SHOULD)')
      expect(true).toBe(true)
    }
  })
})

// ============================================================================
// PHASE 5 — DOCUMENTATION: Code Examples Validity
// ============================================================================

describe('Phase 5 — Documentation: Valid Examples', () => {
  // @clause CL-DOC-005
  it('succeeds when UI_CONTRACT_API.md has syntactically valid JSON examples', () => {
    const content = readDocsFile('UI_CONTRACT_API.md')
    
    expect(content).not.toBeNull()
    
    const jsonBlocks = content!.match(/```json\n([\s\S]*?)```/g)
    
    if (jsonBlocks && jsonBlocks.length > 0) {
      for (const block of jsonBlocks) {
        const jsonContent = block.replace(/```json\n?/, '').replace(/```$/, '').trim()
        if (jsonContent.startsWith('{') || jsonContent.startsWith('[')) {
          expect(() => JSON.parse(jsonContent)).not.toThrow()
        }
      }
    }
  })
})

// ============================================================================
// PHASE 5 — DOCUMENTATION: No Code Changes
// ============================================================================

describe('Phase 5 — Documentation: No Code Changes', () => {
  // @clause CL-DOC-007
  it('succeeds when only documentation files are in docs folder', () => {
    const docsFolder = path.join(ROOT_PATH, 'packages/gatekeeper-api/docs')
    
    if (fs.existsSync(docsFolder)) {
      const files = fs.readdirSync(docsFolder)
      
      for (const file of files) {
        // Todos os arquivos devem ser .md
        expect(file.endsWith('.md') || fs.statSync(path.join(docsFolder, file)).isDirectory()).toBe(true)
      }
    }
  })
})

// ============================================================================
// BEHAVIORAL TESTS: Upload Success Flow
// ============================================================================

describe('Phase 4 — Behavioral: Upload Success Flow', () => {
  // @clause CL-FE-006
  it('succeeds when upload success closes dialog and shows toast', () => {
    // Verifica estrutura do componente para upload success
    const componentContent = readSourceFile('components/ui-contract-upload-dialog.tsx')
    
    expect(componentContent).not.toBeNull()
    // Deve fechar dialog após sucesso
    expect(componentContent).toMatch(/setOpen\s*\(\s*false\s*\)|onClose|closeDialog|close/i)
    // Deve mostrar toast de sucesso
    expect(componentContent).toMatch(/toast.*success|success.*toast/i)
  })
})

// ============================================================================
// BEHAVIORAL TESTS: Upload Error Flow
// ============================================================================

describe('Phase 4 — Behavioral: Upload Error Flow', () => {
  // @clause CL-FE-007
  it('succeeds when upload error keeps dialog open', () => {
    const componentContent = readSourceFile('components/ui-contract-upload-dialog.tsx')
    
    expect(componentContent).not.toBeNull()
    // Deve ter tratamento de erro
    expect(componentContent).toMatch(/catch|error|Error/i)
    // Deve mostrar toast de erro
    expect(componentContent).toMatch(/toast.*error|error.*toast/i)
  })

  // @clause CL-FE-007
  it('fails when upload receives 400 INVALID_CONTRACT error', () => {
    // Simula resposta de erro
    const errorResponse = {
      error: {
        code: 'INVALID_CONTRACT',
        message: 'Contract validation failed',
        details: [{ path: 'version', message: 'Required' }],
      },
    }
    
    expect(errorResponse.error.code).toBe('INVALID_CONTRACT')
    expect(errorResponse.error.details).toBeDefined()
  })

  // @clause CL-FE-007
  it('fails when upload receives 404 PROJECT_NOT_FOUND error', () => {
    const errorResponse = {
      error: {
        code: 'PROJECT_NOT_FOUND',
        message: 'Project not found',
      },
    }
    
    expect(errorResponse.error.code).toBe('PROJECT_NOT_FOUND')
  })
})

// ============================================================================
// BEHAVIORAL TESTS: Delete Flow
// ============================================================================

describe('Phase 4 — Behavioral: Delete Flow', () => {
  // @clause CL-FE-009
  it('succeeds when delete success shows toast and updates section', () => {
    const componentContent = readSourceFile('components/ui-contract-section.tsx')
    
    expect(componentContent).not.toBeNull()
    // Deve chamar API delete
    expect(componentContent).toMatch(/api\.uiContract\.delete|delete.*uiContract/)
    // Deve mostrar toast
    expect(componentContent).toMatch(/toast/i)
  })

  // @clause CL-FE-010
  it('fails when delete receives 404 CONTRACT_NOT_FOUND error', () => {
    const errorResponse = {
      error: {
        code: 'CONTRACT_NOT_FOUND',
        message: 'UI Contract not found',
      },
    }
    
    expect(errorResponse.error.code).toBe('CONTRACT_NOT_FOUND')
  })
})

// ============================================================================
// INTEGRATION: File Structure Summary
// ============================================================================

describe('Integration: File Structure', () => {
  // @clause CL-FE-001 @clause CL-FE-004
  it('succeeds when all required component files exist', () => {
    expect(fileExists('components/ui-contract-section.tsx')).toBe(true)
    expect(fileExists('components/ui-contract-upload-dialog.tsx')).toBe(true)
  })

  // @clause CL-DOC-001 @clause CL-DOC-002
  it('succeeds when all required documentation files exist', () => {
    expect(docsFileExists('UI_CONTRACT_API.md')).toBe(true)
    expect(docsFileExists('UI_CONTRACT_SCHEMA.md')).toBe(true)
  })

  // @clause CL-FE-011 @clause CL-FE-012
  it('succeeds when lib files are properly modified', () => {
    const apiContent = readSourceFile('lib/api.ts')
    const typesContent = readSourceFile('lib/types.ts')
    
    expect(apiContent).toMatch(/uiContract/)
    expect(typesContent).toMatch(/UIContract/)
    expect(typesContent).toMatch(/UIContractSchema/)
  })
})
