import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Documentation Cleanup Contract Spec
 * ====================================
 * 
 * Contrato: remove-theme-ui-contract-docs-cleanup
 * Objetivo: Remover documentação de Theme/UIContract e executar limpeza final
 *           do projeto para garantir que não há referências órfãs.
 * 
 * REGRA: Se estes testes falharem, a LLM executora errou na implementação.
 * Os testes validam estrutura estática e contratos, não comportamento runtime.
 */

// === CAMINHOS DOS ARQUIVOS ===

// __dirname = packages/gatekeeper-api/src/domain/validators
const API_ROOT = path.resolve(__dirname, '../../..') // packages/gatekeeper-api
const PROJECT_ROOT = path.resolve(__dirname, '../../../../..') // gatekeeper root
const SRC_ROOT = path.join(PROJECT_ROOT, 'src') // frontend src

// Documentation directories and files
const DOCS_DIR = path.join(API_ROOT, 'docs')
const BACKEND_SRC_DIR = path.join(API_ROOT, 'src')

// Key documentation files
const CLAUDE_MD_PATH = path.join(PROJECT_ROOT, 'CLAUDE.md')
const API_README_PATH = path.join(API_ROOT, 'README.md')
const AGENTS_MD_PATH = path.join(PROJECT_ROOT, 'AGENTS.md')

// Files to delete
const UI_CONTRACT_API_PATH = path.join(DOCS_DIR, 'UI_CONTRACT_API.md')
const UI_CONTRACT_SCHEMA_PATH = path.join(DOCS_DIR, 'UI_CONTRACT_SCHEMA.md')

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
  return fs.readdirSync(dirPath)
}

function countPatternOccurrences(content: string, pattern: string): number {
  const regex = new RegExp(pattern, 'gi')
  const matches = content.match(regex)
  return matches ? matches.length : 0
}

/**
 * Recursively get all files matching extensions in a directory
 */
function getFilesRecursively(dirPath: string, extensions: string[]): string[] {
  const results: string[] = []
  
  if (!fs.existsSync(dirPath)) {
    return results
  }
  
  function walk(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name)
      
      if (entry.isDirectory()) {
        // Skip node_modules and hidden directories
        if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
          walk(fullPath)
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name)
        if (extensions.includes(ext)) {
          results.push(fullPath)
        }
      }
    }
  }
  
  walk(dirPath)
  return results
}

/**
 * Search for pattern in files, excluding spec files
 */
function searchInSourceFiles(
  dirPath: string, 
  pattern: RegExp, 
  extensions: string[],
  excludePattern = /\.spec\./
): string[] {
  const files = getFilesRecursively(dirPath, extensions)
  const matches: string[] = []
  
  for (const file of files) {
    // Skip spec files
    if (excludePattern.test(file)) {
      continue
    }
    
    try {
      const content = fs.readFileSync(file, 'utf-8')
      if (pattern.test(content)) {
        matches.push(file)
      }
    } catch {
      // Skip files that can't be read
    }
  }
  
  return matches
}

// === VARIÁVEIS GLOBAIS PARA CACHE ===

let claudeMdContent: string
let apiReadmeContent: string
let agentsMdContent: string
let docsFiles: string[]

// === SETUP ===

beforeAll(() => {
  // Read file contents
  try {
    claudeMdContent = readFileContent(CLAUDE_MD_PATH)
  } catch {
    claudeMdContent = ''
  }
  
  try {
    apiReadmeContent = readFileContent(API_README_PATH)
  } catch {
    apiReadmeContent = ''
  }
  
  try {
    agentsMdContent = readFileContent(AGENTS_MD_PATH)
  } catch {
    agentsMdContent = ''
  }
  
  // Get directory listings
  docsFiles = getFilesInDirectory(DOCS_DIR)
})

// === TESTES ===

describe('Documentation Cleanup Contract - Remove Theme and UIContract Docs', () => {

  describe('CL-DOC-001: UI_CONTRACT_API.md deletado', () => {
    
    // @clause CL-DOC-001
    it('succeeds when UI_CONTRACT_API.md does not exist', () => {
      const exists = fileExists(UI_CONTRACT_API_PATH)
      expect(exists).toBe(false)
    })
    
    // @clause CL-DOC-001
    it('fails when docs directory contains UI_CONTRACT_API.md', () => {
      const hasFile = docsFiles.includes('UI_CONTRACT_API.md')
      expect(hasFile).toBe(false)
    })
  })

  describe('CL-DOC-002: UI_CONTRACT_SCHEMA.md deletado', () => {
    
    // @clause CL-DOC-002
    it('succeeds when UI_CONTRACT_SCHEMA.md does not exist', () => {
      const exists = fileExists(UI_CONTRACT_SCHEMA_PATH)
      expect(exists).toBe(false)
    })
    
    // @clause CL-DOC-002
    it('fails when docs directory contains UI_CONTRACT_SCHEMA.md', () => {
      const hasFile = docsFiles.includes('UI_CONTRACT_SCHEMA.md')
      expect(hasFile).toBe(false)
    })
  })

  describe('CL-DOC-003: CLAUDE.md sem UI Contracts', () => {
    
    // @clause CL-DOC-003
    it('succeeds when CLAUDE.md does not contain "UI Contracts" section', () => {
      // Look for section header like "#### 3. UI Contracts" or "## UI Contracts"
      const hasSection = /#{1,4}\s*\d*\.?\s*UI\s+Contracts/i.test(claudeMdContent)
      expect(hasSection).toBe(false)
    })
    
    // @clause CL-DOC-003
    it('succeeds when CLAUDE.md does not reference UI_PLAN_COVERAGE', () => {
      const hasRef = /UI_PLAN_COVERAGE/.test(claudeMdContent)
      expect(hasRef).toBe(false)
    })
    
    // @clause CL-DOC-003
    it('succeeds when CLAUDE.md does not reference UI_TEST_COVERAGE', () => {
      const hasRef = /UI_TEST_COVERAGE/.test(claudeMdContent)
      expect(hasRef).toBe(false)
    })
    
    // @clause CL-DOC-003
    it('succeeds when CLAUDE.md does not mention UIContractController', () => {
      const hasRef = /UIContractController/.test(claudeMdContent)
      expect(hasRef).toBe(false)
    })
    
    // @clause CL-DOC-003
    it('succeeds when CLAUDE.md does not mention UIContractValidatorService', () => {
      const hasRef = /UIContractValidatorService/.test(claudeMdContent)
      expect(hasRef).toBe(false)
    })
    
    // @clause CL-DOC-003
    it('fails when CLAUDE.md ValidationContext mentions uiContract field', () => {
      // Check if ValidationContext description still has uiContract
      const hasUIContractField = /ValidationContext[^}]*uiContract/i.test(claudeMdContent)
      expect(hasUIContractField).toBe(false)
    })
  })

  describe('CL-DOC-004: README.md sem UI Contract', () => {
    
    // @clause CL-DOC-004
    it('succeeds when README does not contain "## UI Contract" section', () => {
      const hasSection = /^##\s+UI\s+Contract/m.test(apiReadmeContent)
      expect(hasSection).toBe(false)
    })
    
    // @clause CL-DOC-004
    it('succeeds when README does not mention UI Contract endpoints', () => {
      const hasEndpoint = /\/api\/projects\/.*\/ui-contract/.test(apiReadmeContent)
      expect(hasEndpoint).toBe(false)
    })
    
    // @clause CL-DOC-004
    it('succeeds when README does not reference UI_CONTRACT_API.md', () => {
      const hasRef = /UI_CONTRACT_API\.md/.test(apiReadmeContent)
      expect(hasRef).toBe(false)
    })
    
    // @clause CL-DOC-004
    it('succeeds when README does not reference UI_CONTRACT_SCHEMA.md', () => {
      const hasRef = /UI_CONTRACT_SCHEMA\.md/.test(apiReadmeContent)
      expect(hasRef).toBe(false)
    })
    
    // @clause CL-DOC-004
    it('succeeds when README does not mention UI_PLAN_COVERAGE validator', () => {
      const hasRef = /UI_PLAN_COVERAGE/.test(apiReadmeContent)
      expect(hasRef).toBe(false)
    })
    
    // @clause CL-DOC-004
    it('succeeds when README does not mention UI_TEST_COVERAGE validator', () => {
      const hasRef = /UI_TEST_COVERAGE/.test(apiReadmeContent)
      expect(hasRef).toBe(false)
    })
    
    // @clause CL-DOC-004
    it('succeeds when README features list does not mention UI Contracts', () => {
      // Check for bullet point like "- Suporte a UI Contracts"
      const hasBullet = /-\s*Suporte\s+a\s+UI\s+Contracts/i.test(apiReadmeContent)
      expect(hasBullet).toBe(false)
    })
  })

  describe('CL-DOC-005: AGENTS.md limpo', () => {
    
    // @clause CL-DOC-005
    it('succeeds when AGENTS.md does not reference Theme', () => {
      // Check for Theme as a standalone concept (not part of other words)
      const hasThemeRef = /\bTheme\b/.test(agentsMdContent)
      expect(hasThemeRef).toBe(false)
    })
    
    // @clause CL-DOC-005
    it('succeeds when AGENTS.md does not reference UIContract', () => {
      const hasUIContractRef = /UIContract/.test(agentsMdContent)
      expect(hasUIContractRef).toBe(false)
    })
    
    // @clause CL-DOC-005
    it('succeeds when AGENTS.md does not reference UILD', () => {
      // Use word boundary to avoid matching "BUILD" in "PRODUCTION_BUILD_PASS"
      const hasUILDRef = /\bUILD\b/.test(agentsMdContent)
      expect(hasUILDRef).toBe(false)
    })
    
    // @clause CL-DOC-005
    it('succeeds when AGENTS.md does not reference UI_PLAN or UI_TEST validators', () => {
      const hasUIValidatorRef = /UI_PLAN|UI_TEST/.test(agentsMdContent)
      expect(hasUIValidatorRef).toBe(false)
    })
  })

  describe('CL-FIN-001: Grep backend limpo', () => {
    
    // @clause CL-FIN-001
    it('succeeds when backend source has no ThemeEngine references', () => {
      const pattern = /ThemeEngine/
      const matches = searchInSourceFiles(BACKEND_SRC_DIR, pattern, ['.ts'])
      expect(matches).toHaveLength(0)
    })
    
    // @clause CL-FIN-001
    it('succeeds when backend source has no UIContract references', () => {
      const pattern = /UIContract(?!\.spec)/
      const matches = searchInSourceFiles(BACKEND_SRC_DIR, pattern, ['.ts'])
      expect(matches).toHaveLength(0)
    })
    
    // @clause CL-FIN-001
    it('succeeds when backend source has no UI_PLAN_COVERAGE references', () => {
      const pattern = /UI_PLAN_COVERAGE/
      const matches = searchInSourceFiles(BACKEND_SRC_DIR, pattern, ['.ts'])
      expect(matches).toHaveLength(0)
    })
    
    // @clause CL-FIN-001
    it('succeeds when backend source has no UI_TEST_COVERAGE references', () => {
      const pattern = /UI_TEST_COVERAGE/
      const matches = searchInSourceFiles(BACKEND_SRC_DIR, pattern, ['.ts'])
      expect(matches).toHaveLength(0)
    })
    
    // @clause CL-FIN-001
    it('succeeds when backend source has no theme-injector references', () => {
      const pattern = /theme-injector/
      const matches = searchInSourceFiles(BACKEND_SRC_DIR, pattern, ['.ts'])
      expect(matches).toHaveLength(0)
    })
  })

  describe('CL-FIN-002: Grep frontend limpo', () => {
    
    // @clause CL-FIN-002
    it('succeeds when frontend source has no ThemeSettingsPage references', () => {
      const pattern = /ThemeSettingsPage/
      const matches = searchInSourceFiles(SRC_ROOT, pattern, ['.ts', '.tsx'])
      expect(matches).toHaveLength(0)
    })
    
    // @clause CL-FIN-002
    it('succeeds when frontend source has no ActiveThemeProvider references', () => {
      const pattern = /ActiveThemeProvider/
      const matches = searchInSourceFiles(SRC_ROOT, pattern, ['.ts', '.tsx'])
      expect(matches).toHaveLength(0)
    })
    
    // @clause CL-FIN-002
    it('succeeds when frontend source has no UIContractSection references', () => {
      const pattern = /UIContractSection/
      const matches = searchInSourceFiles(SRC_ROOT, pattern, ['.ts', '.tsx'])
      expect(matches).toHaveLength(0)
    })
    
    // @clause CL-FIN-002
    it('succeeds when frontend source has no use-active-theme references', () => {
      const pattern = /use-active-theme/
      const matches = searchInSourceFiles(SRC_ROOT, pattern, ['.ts', '.tsx'])
      expect(matches).toHaveLength(0)
    })
    
    // @clause CL-FIN-002
    it('succeeds when frontend source has no theme-injector references', () => {
      const pattern = /theme-injector/
      const matches = searchInSourceFiles(SRC_ROOT, pattern, ['.ts', '.tsx'])
      expect(matches).toHaveLength(0)
    })
  })

  describe('CL-FIN-003 to CL-FIN-008: Build Integrity (static validation)', () => {
    
    // @clause CL-FIN-003
    it('succeeds when tsconfig.json exists for type checking', () => {
      const frontendTsConfig = path.join(PROJECT_ROOT, 'tsconfig.json')
      const backendTsConfig = path.join(API_ROOT, 'tsconfig.json')
      
      expect(fileExists(frontendTsConfig)).toBe(true)
      expect(fileExists(backendTsConfig)).toBe(true)
    })
    
    // @clause CL-FIN-004
    it('succeeds when vite.config.ts exists for frontend build', () => {
      const viteConfig = path.join(PROJECT_ROOT, 'vite.config.ts')
      expect(fileExists(viteConfig)).toBe(true)
    })
    
    // @clause CL-FIN-005
    it('succeeds when package.json exists for backend build', () => {
      const packageJson = path.join(API_ROOT, 'package.json')
      expect(fileExists(packageJson)).toBe(true)
    })
    
    // @clause CL-FIN-006
    it('succeeds when vitest.config exists for frontend tests', () => {
      // Check for vitest.config.ts or vitest config in vite.config.ts
      const vitestConfig = path.join(PROJECT_ROOT, 'vitest.config.ts')
      const viteConfig = path.join(PROJECT_ROOT, 'vite.config.ts')
      
      const hasVitestConfig = fileExists(vitestConfig)
      const hasViteConfig = fileExists(viteConfig)
      
      expect(hasVitestConfig || hasViteConfig).toBe(true)
    })
    
    // @clause CL-FIN-007
    it('succeeds when backend has test configuration', () => {
      const packageJson = path.join(API_ROOT, 'package.json')
      if (fileExists(packageJson)) {
        const content = readFileContent(packageJson)
        const pkg = JSON.parse(content)
        expect(pkg.scripts?.test).toBeDefined()
      }
    })
    
    // @clause CL-FIN-008
    it('succeeds when eslint config exists for linting', () => {
      const eslintConfigs = [
        'eslint.config.js',
        'eslint.config.mjs',
        'eslint.config.cjs',
        '.eslintrc.js',
        '.eslintrc.json',
        '.eslintrc',
      ]
      
      const hasEslintConfig = eslintConfigs.some(config => 
        fileExists(path.join(PROJECT_ROOT, config))
      )
      
      expect(hasEslintConfig).toBe(true)
    })
  })

  describe('CL-FIN-009 to CL-FIN-012: App Structure (static validation)', () => {
    
    // @clause CL-FIN-009
    it('succeeds when backend server.ts or index.ts exists', () => {
      const serverTs = path.join(BACKEND_SRC_DIR, 'server.ts')
      const indexTs = path.join(BACKEND_SRC_DIR, 'index.ts')
      
      expect(fileExists(serverTs) || fileExists(indexTs)).toBe(true)
    })
    
    // @clause CL-FIN-010
    it('succeeds when frontend App.tsx exists', () => {
      const appTsx = path.join(SRC_ROOT, 'App.tsx')
      expect(fileExists(appTsx)).toBe(true)
    })
    
    // @clause CL-FIN-011
    it('succeeds when app-layout.tsx does not have Theme navigation', () => {
      const appLayoutPath = path.join(SRC_ROOT, 'components', 'app-layout.tsx')
      
      if (fileExists(appLayoutPath)) {
        const content = readFileContent(appLayoutPath)
        const hasThemeNav = /\{\s*name:\s*['"]Theme['"]/.test(content)
        expect(hasThemeNav).toBe(false)
      }
    })
    
    // @clause CL-FIN-012
    it('succeeds when project-details-page.tsx does not have UIContractSection', () => {
      const projectDetailsPath = path.join(SRC_ROOT, 'components', 'project-details-page.tsx')
      
      if (fileExists(projectDetailsPath)) {
        const content = readFileContent(projectDetailsPath)
        const hasUIContract = /UIContractSection/.test(content)
        expect(hasUIContract).toBe(false)
      }
    })
  })

  describe('Invariants: Documentation structure preserved', () => {
    
    // @clause CL-DOC-003
    it('succeeds when CLAUDE.md is preserved', () => {
      expect(fileExists(CLAUDE_MD_PATH)).toBe(true)
    })
    
    // @clause CL-DOC-004
    it('succeeds when API README.md is preserved', () => {
      expect(fileExists(API_README_PATH)).toBe(true)
    })
    
    // @clause CL-DOC-003
    it('succeeds when CLAUDE.md still has Gates documentation', () => {
      const hasGates = /Gate\s*\d/.test(claudeMdContent)
      expect(hasGates).toBe(true)
    })
    
    // @clause CL-DOC-003
    it('succeeds when CLAUDE.md still has Validators documentation', () => {
      const hasValidators = /Validadores|Validators/.test(claudeMdContent)
      expect(hasValidators).toBe(true)
    })
    
    // @clause CL-DOC-004
    it('succeeds when README still has Gates documentation', () => {
      const hasGates = /Gate\s*\d/.test(apiReadmeContent)
      expect(hasGates).toBe(true)
    })
    
    // @clause CL-DOC-004
    it('succeeds when README still has API Endpoints section', () => {
      const hasEndpoints = /##\s*API\s+Endpoints/.test(apiReadmeContent)
      expect(hasEndpoints).toBe(true)
    })
  })

  describe('No orphaned references in markdown files', () => {
    
    // @clause CL-DOC-003
    // @clause CL-DOC-004
    // @clause CL-DOC-005
    it('succeeds when no markdown files reference deleted docs', () => {
      const mdFiles = [CLAUDE_MD_PATH, API_README_PATH, AGENTS_MD_PATH]
      const deletedDocs = ['UI_CONTRACT_API.md', 'UI_CONTRACT_SCHEMA.md']
      
      for (const mdFile of mdFiles) {
        if (fileExists(mdFile)) {
          const content = readFileContent(mdFile)
          for (const doc of deletedDocs) {
            const hasRef = content.includes(doc)
            expect(hasRef, `${mdFile} should not reference ${doc}`).toBe(false)
          }
        }
      }
    })
    
    // @clause CL-FIN-001
    // @clause CL-FIN-002
    it('succeeds when no source files import deleted modules', () => {
      const deletedModules = [
        'ThemeEngine',
        'ThemeRepository',
        'UIContractRepository',
        'ThemeController',
        'UIContractController',
        'UIPlanCoverage',
        'UITestCoverage',
        'theme-settings-page',
        'ui-contract-section',
        'use-active-theme',
        'theme-injector',
      ]
      
      // Check backend
      for (const module of deletedModules) {
        const pattern = new RegExp(`from\\s*['"].*${module}['"]`)
        const backendMatches = searchInSourceFiles(BACKEND_SRC_DIR, pattern, ['.ts'])
        expect(backendMatches, `Backend should not import ${module}`).toHaveLength(0)
      }
      
      // Check frontend
      for (const module of deletedModules) {
        const pattern = new RegExp(`from\\s*['"].*${module}['"]`)
        const frontendMatches = searchInSourceFiles(SRC_ROOT, pattern, ['.ts', '.tsx'])
        expect(frontendMatches, `Frontend should not import ${module}`).toHaveLength(0)
      }
    })
  })
})
