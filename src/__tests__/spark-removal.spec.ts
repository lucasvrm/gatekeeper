/**
 * @file spark-removal.spec.ts
 * @description Testes de verificação para remoção completa do framework Spark (@github/spark) do Gatekeeper
 * @contract spark-removal v1.0
 *
 * Estratégia: análise estática de arquivos (fs.readFileSync + fs.existsSync + execSync/grep).
 * Nenhum teste requer build ou runtime — todos operam sobre o conteúdo real do filesystem.
 */

import { describe, it, expect } from 'vitest'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

/** Resolve path relative to project root */
const root = process.cwd()
const resolvePath = (...segments: string[]) => path.resolve(root, ...segments)

/** Read file content as UTF-8 */
const readFile = (relativePath: string): string =>
  fs.readFileSync(resolvePath(relativePath), 'utf-8')

interface PackageJson {
  name: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

describe('spark-removal', () => {
  // ===========================================================================
  // CL-SPARK-001: Diretório spark-tools removido
  // ===========================================================================
  describe('CL-SPARK-001: Diretório spark-tools removido', () => {
    // @clause CL-SPARK-001
    it('should not find packages/spark-tools directory in filesystem', () => {
      const exists = fs.existsSync(resolvePath('packages/spark-tools'))
      expect(exists).toBe(false)
    })

    // @clause CL-SPARK-001
    it('should not find packages/spark-tools/package.json file', () => {
      const exists = fs.existsSync(resolvePath('packages/spark-tools/package.json'))
      expect(exists).toBe(false)
    })

    // @clause CL-SPARK-001
    it('fails when spark-tools directory is still listed in packages', () => {
      const entries = fs.readdirSync(resolvePath('packages'))
      expect(entries).not.toContain('spark-tools')
    })
  })

  // ===========================================================================
  // CL-SPARK-002: Arquivos metadata Spark removidos
  // ===========================================================================
  describe('CL-SPARK-002: Arquivos metadata Spark removidos', () => {
    // @clause CL-SPARK-002
    it('should not find spark.meta.json in project root', () => {
      const exists = fs.existsSync(resolvePath('spark.meta.json'))
      expect(exists).toBe(false)
    })

    // @clause CL-SPARK-002
    it('should not find runtime.config.json in project root', () => {
      const exists = fs.existsSync(resolvePath('runtime.config.json'))
      expect(exists).toBe(false)
    })

    // @clause CL-SPARK-002
    it('fails when any Spark metadata file is still in project root', () => {
      const rootEntries = fs.readdirSync(root)
      expect(rootEntries).not.toContain('spark.meta.json')
      expect(rootEntries).not.toContain('runtime.config.json')
    })
  })

  // ===========================================================================
  // CL-SPARK-003: Projeto renomeado no package.json
  // ===========================================================================
  describe('CL-SPARK-003: Projeto renomeado no package.json', () => {
    const readPkg = (): PackageJson => JSON.parse(readFile('package.json')) as PackageJson

    // @clause CL-SPARK-003
    it('should have gatekeeper as the package.json name', () => {
      expect(readPkg().name).toBe('gatekeeper')
    })

    // @clause CL-SPARK-003
    it('fails when package.json name still contains spark-template', () => {
      expect(readPkg().name).not.toBe('spark-template')
    })

    // @clause CL-SPARK-003
    it('fails when package.json name contains spark in any form', () => {
      expect(readPkg().name.toLowerCase()).not.toContain('spark')
    })
  })

  // ===========================================================================
  // CL-SPARK-004: Dependência @github/spark removida
  // ===========================================================================
  describe('CL-SPARK-004: Dependência @github/spark removida', () => {
    const readPkg = (): PackageJson => JSON.parse(readFile('package.json')) as PackageJson

    // @clause CL-SPARK-004
    it('should not have @github/spark in dependencies object', () => {
      const deps = readPkg().dependencies ?? {}
      expect(deps).not.toHaveProperty('@github/spark')
    })

    // @clause CL-SPARK-004
    it('fails when @github/spark key is still in dependencies', () => {
      const depKeys = Object.keys(readPkg().dependencies ?? {})
      expect(depKeys).not.toContain('@github/spark')
    })

    // @clause CL-SPARK-004
    it('fails when package.json raw text still references @github/spark', () => {
      const content = readFile('package.json')
      expect(content).not.toContain('"@github/spark"')
    })
  })

  // ===========================================================================
  // CL-SPARK-005: Imports Spark removidos do vite.config.ts
  // ===========================================================================
  describe('CL-SPARK-005: Imports Spark removidos do vite.config.ts', () => {
    const readVite = () => readFile('vite.config.ts')

    // @clause CL-SPARK-005
    it('should not contain @github/spark anywhere in vite.config.ts', () => {
      expect(readVite()).not.toContain('@github/spark')
    })

    // @clause CL-SPARK-005
    it('fails when @github/spark/spark-vite-plugin is still imported', () => {
      expect(readVite()).not.toContain('@github/spark/spark-vite-plugin')
    })

    // @clause CL-SPARK-005
    it('fails when @github/spark/vitePhosphorIconProxyPlugin is still imported', () => {
      expect(readVite()).not.toContain('@github/spark/vitePhosphorIconProxyPlugin')
    })
  })

  // ===========================================================================
  // CL-SPARK-006: Plugins Spark removidos do vite.config.ts
  // ===========================================================================
  describe('CL-SPARK-006: Plugins Spark removidos do vite.config.ts', () => {
    const readVite = () => readFile('vite.config.ts')

    // @clause CL-SPARK-006
    it('fails when sparkPlugin is still referenced in vite.config.ts', () => {
      expect(readVite()).not.toContain('sparkPlugin')
    })

    // @clause CL-SPARK-006
    it('fails when createIconImportProxy is still in vite.config.ts', () => {
      expect(readVite()).not.toContain('createIconImportProxy')
    })

    // @clause CL-SPARK-006
    it('fails when PluginOption type is still imported from vite', () => {
      expect(readVite()).not.toContain('PluginOption')
    })
  })

  // ===========================================================================
  // CL-SPARK-007: Plugins essenciais Vite preservados (invariant)
  // ===========================================================================
  describe('CL-SPARK-007: Plugins essenciais Vite preservados', () => {
    const readVite = () => readFile('vite.config.ts')

    // @clause CL-SPARK-007
    it('should have react() plugin in vite.config.ts', () => {
      expect(readVite()).toContain('react()')
    })

    // @clause CL-SPARK-007
    it('should have tailwindcss() plugin in vite.config.ts', () => {
      expect(readVite()).toContain('tailwindcss()')
    })

    // @clause CL-SPARK-007
    it('should have orquiVitePlugin() call in vite.config.ts', () => {
      expect(readVite()).toContain('orquiVitePlugin()')
    })
  })

  // ===========================================================================
  // CL-SPARK-008: Aliases de resolve preservados (invariant)
  // ===========================================================================
  describe('CL-SPARK-008: Aliases de resolve preservados', () => {
    const readVite = () => readFile('vite.config.ts')

    // @clause CL-SPARK-008
    it('should have @ path alias in vite.config.ts', () => {
      expect(readVite()).toContain("'@'")
    })

    // @clause CL-SPARK-008
    it('should have @orqui/runtime alias in vite.config.ts', () => {
      expect(readVite()).toContain('@orqui/runtime')
    })

    // @clause CL-SPARK-008
    it('should have both aliases in the resolve.alias section', () => {
      const content = readVite()
      const aliasIndex = content.indexOf('alias')
      expect(aliasIndex).toBeGreaterThan(-1)
      const aliasSection = content.substring(aliasIndex)
      expect(aliasSection).toContain("'@'")
      expect(aliasSection).toContain('@orqui/runtime')
    })
  })

  // ===========================================================================
  // CL-SPARK-009: Seletor CSS #spark-app removido do theme.css
  // ===========================================================================
  describe('CL-SPARK-009: Seletor CSS #spark-app removido do theme.css', () => {
    const readTheme = () => readFile('src/styles/theme.css')

    // @clause CL-SPARK-009
    it('should not contain #spark-app in theme.css', () => {
      expect(readTheme()).not.toContain('#spark-app')
    })

    // @clause CL-SPARK-009
    it('fails when #spark-app base selector is still in theme.css', () => {
      expect(readTheme()).not.toMatch(/#spark-app\s*\{/)
    })

    // @clause CL-SPARK-009
    it('fails when #spark-app.dark-theme selector is still in theme.css', () => {
      expect(readTheme()).not.toContain('#spark-app.dark-theme')
    })
  })

  // ===========================================================================
  // CL-SPARK-010: Seletores :root e .dark no @layer base
  // ===========================================================================
  describe('CL-SPARK-010: Seletores :root e .dark no @layer base', () => {
    const readTheme = () => readFile('src/styles/theme.css')

    // @clause CL-SPARK-010
    it('should have :root selector for light variables in theme.css', () => {
      expect(readTheme()).toContain(':root {')
    })

    // @clause CL-SPARK-010
    it('should have .dark selector for dark variables in theme.css', () => {
      expect(readTheme()).toContain('.dark {')
    })

    // @clause CL-SPARK-010
    it('should have :root and .dark selectors within @layer base block', () => {
      const content = readTheme()
      const lastLayerBaseIdx = content.lastIndexOf('@layer base')
      expect(lastLayerBaseIdx).toBeGreaterThan(-1)
      const afterLayerBase = content.substring(lastLayerBaseIdx)
      expect(afterLayerBase).toContain(':root {')
      expect(afterLayerBase).toContain('.dark {')
    })
  })

  // ===========================================================================
  // CL-SPARK-011: Bloco Spark overrides removido do stylesheet.ts
  // ===========================================================================
  describe('CL-SPARK-011: Bloco Spark overrides removido do stylesheet.ts', () => {
    const readStylesheet = () => readFile('packages/orqui/src/runtime/stylesheet.ts')

    // @clause CL-SPARK-011
    it('should not contain Spark variable overrides comment in stylesheet.ts', () => {
      expect(readStylesheet()).not.toContain('Spark variable overrides')
    })

    // @clause CL-SPARK-011
    it('fails when sparkLines variable is still in stylesheet.ts', () => {
      expect(readStylesheet()).not.toContain('sparkLines')
    })

    // @clause CL-SPARK-011
    it('fails when #spark-app selector is still in stylesheet.ts', () => {
      expect(readStylesheet()).not.toContain('#spark-app')
    })
  })

  // ===========================================================================
  // CL-SPARK-012: Documentação CLAUDE.md limpa
  // ===========================================================================
  describe('CL-SPARK-012: Documentação CLAUDE.md limpa', () => {
    const readClaude = () => readFile('CLAUDE.md')

    // @clause CL-SPARK-012
    it('should not reference spark-tools in CLAUDE.md', () => {
      expect(readClaude()).not.toContain('spark-tools')
    })

    // @clause CL-SPARK-012
    it('should not mention Ferramentas Spark in CLAUDE.md', () => {
      expect(readClaude()).not.toContain('Ferramentas Spark')
    })

    // @clause CL-SPARK-012
    it('fails when any spark-tools documentation reference remains', () => {
      const content = readClaude()
      expect(content).not.toContain('spark-tools')
      expect(content).not.toContain('Ferramentas Spark')
      expect(content).not.toMatch(/packages\/spark-tools/)
    })
  })

  // ===========================================================================
  // CL-SPARK-013: Bloco CL-TS-007 removido dos testes
  // ===========================================================================
  describe('CL-SPARK-013: Bloco CL-TS-007 removido dos testes', () => {
    // @clause CL-SPARK-013
    it('should not have CL-TS-007 in src/__tests__/typescript-errors-fix.spec.ts', () => {
      const content = readFile('src/__tests__/typescript-errors-fix.spec.ts')
      expect(content).not.toContain('CL-TS-007')
    })

    // @clause CL-SPARK-013
    it('should not have CL-TS-007 in src/typescript-errors-fix.spec.ts', () => {
      const content = readFile('src/typescript-errors-fix.spec.ts')
      expect(content).not.toContain('CL-TS-007')
    })

    // @clause CL-SPARK-013
    it('fails when CL-TS-007 describe block is still present in either spec', () => {
      const specInDir = readFile('src/__tests__/typescript-errors-fix.spec.ts')
      const specInSrc = readFile('src/typescript-errors-fix.spec.ts')
      expect(specInDir).not.toMatch(/CL-TS-007/)
      expect(specInSrc).not.toMatch(/CL-TS-007/)
    })
  })

  // ===========================================================================
  // CL-SPARK-014: Referências "sparkle" (ícone Phosphor) preservadas (invariant)
  // ===========================================================================
  describe('CL-SPARK-014: Referências sparkle preservadas nos ícones Phosphor', () => {
    // @clause CL-SPARK-014
    it('should have sparkle icon data in icons.tsx', () => {
      const content = readFile('packages/orqui/src/runtime/icons.tsx')
      expect(content).toContain('"sparkle"')
    })

    // @clause CL-SPARK-014
    it('should have sparkle reference in PhosphorIcons.tsx', () => {
      const content = readFile('packages/orqui/src/editor/components/PhosphorIcons.tsx')
      expect(content).toContain('sparkle')
    })

    // @clause CL-SPARK-014
    it('should preserve sparkle entries with SVG data in both icon files', () => {
      const icons = readFile('packages/orqui/src/runtime/icons.tsx')
      const phosphor = readFile('packages/orqui/src/editor/components/PhosphorIcons.tsx')
      expect(icons).toMatch(/"sparkle"\s*:/)
      expect(phosphor).toMatch(/["']sparkle["']/)
    })
  })

  // ===========================================================================
  // CL-SPARK-015: Nenhuma referência Spark restante no codebase (invariant)
  // ===========================================================================
  describe('CL-SPARK-015: Nenhuma referência Spark restante no codebase', () => {
    /**
     * Executa grep recursivo por "spark" (case-insensitive) filtrando sparkle e o próprio spec.
     * Retorna string vazia quando nenhum match é encontrado (grep exit code 1).
     */
    const grepForSpark = (includeFlags: string): string => {
      const cmd = [
        'grep -ri "spark"',
        includeFlags,
        '--exclude-dir="node_modules"',
        '--exclude="package-lock.json"',
        '--exclude="spark-removal.spec.ts"',
        '.',
        '| grep -vi "sparkle"',
      ].join(' ')

      try {
        return execSync(cmd, { encoding: 'utf-8', cwd: root }).trim()
      } catch {
        // grep retorna exit code 1 quando não encontra matches — estado esperado
        return ''
      }
    }

    // @clause CL-SPARK-015
    it('should find zero spark references in TS/TSX/JS files', () => {
      const result = grepForSpark('--include="*.ts" --include="*.tsx" --include="*.js"')
      expect(result).toBe('')
    })

    // @clause CL-SPARK-015
    it('should find zero spark references in CSS/JSON/MD files', () => {
      const result = grepForSpark('--include="*.css" --include="*.json" --include="*.md"')
      expect(result).toBe('')
    })

    // @clause CL-SPARK-015
    it('fails when any non-sparkle spark reference exists in codebase', () => {
      const allIncludes = [
        '--include="*.ts"',
        '--include="*.tsx"',
        '--include="*.js"',
        '--include="*.css"',
        '--include="*.json"',
        '--include="*.md"',
      ].join(' ')
      const result = grepForSpark(allIncludes)
      const matchCount = result === '' ? 0 : result.split('\n').length
      expect(matchCount).toBe(0)
    })
  })
})
