/**
 * @file typescript-errors-fix.spec.ts
 * @description Testes de verificação para correção de 84 erros TypeScript no frontend
 * @contract typescript-errors-fix v1.0
 */

import { describe, it, expect } from 'vitest'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

describe('typescript-errors-fix', () => {
  describe('CL-TS-001: TypeScript compila sem erros', () => {
    // @clause CL-TS-001
    it('should exit with code 0 and no TS errors when running typecheck', () => {
      let exitCode = 0
      let stdout = ''

      try {
        stdout = execSync('npm run typecheck', {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        })
      } catch (error: unknown) {
        const execError = error as { status?: number; stdout?: string }
        exitCode = execError.status ?? 1
        stdout = execError.stdout ?? ''
      }

      expect(exitCode).toBe(0)
      expect(stdout).not.toContain('error TS')
    })
  })

  describe('CL-TS-002: Arquivos de spec órfãos removidos', () => {
    const orphanFiles = [
      'src/AppLayoutV2.spec.tsx',
      'src/components/PathResolverService.spec.ts',
      'src/components/SandboxService.spec.ts',
    ]

    // @clause CL-TS-002
    it.each(orphanFiles)('should not have orphan spec file: %s', (filePath) => {
      const fullPath = path.resolve(process.cwd(), filePath)
      const exists = fs.existsSync(fullPath)

      expect(exists).toBe(false)
    })
  })

  describe('CL-TS-003: Arquivo de spec duplicado removido', () => {
    // @clause CL-TS-003
    it('should not have duplicate spec at src/run-panel.spec.tsx', () => {
      const duplicatePath = path.resolve(process.cwd(), 'src/run-panel.spec.tsx')
      const exists = fs.existsSync(duplicatePath)

      expect(exists).toBe(false)
    })

    // @clause CL-TS-003
    it('should keep original spec at src/components/run-panel.spec.tsx', () => {
      const originalPath = path.resolve(process.cwd(), 'src/components/run-panel.spec.tsx')
      const exists = fs.existsSync(originalPath)

      expect(exists).toBe(true)
    })
  })

  describe('CL-TS-004: tsconfig.json inclui vitest.setup.ts', () => {
    // @clause CL-TS-004
    it('should have vitest.setup.ts in include array', () => {
      const tsconfigPath = path.resolve(process.cwd(), 'tsconfig.json')
      const content = fs.readFileSync(tsconfigPath, 'utf-8')
      const tsconfig = JSON.parse(content) as { include?: string[] }

      expect(tsconfig.include).toContain('vitest.setup.ts')
    })
  })

  describe('CL-TS-005: Tipo ArtifactContents.planJson corrigido', () => {
    // @clause CL-TS-005
    it('should have planJson typed as LLMPlanOutput | null', () => {
      const typesPath = path.resolve(process.cwd(), 'src/lib/types.ts')
      const content = fs.readFileSync(typesPath, 'utf-8')

      expect(content).toContain('planJson: LLMPlanOutput | null')
    })
  })

  describe('CL-TS-006: requestData tipado com satisfies', () => {
    // @clause CL-TS-006
    it('should use satisfies CreateRunRequest for requestData', () => {
      const pagePath = path.resolve(process.cwd(), 'src/components/new-validation-page.tsx')
      const content = fs.readFileSync(pagePath, 'utf-8')

      expect(content).toContain('satisfies CreateRunRequest')
    })
  })

  describe('CL-TS-007: Import @github/spark/spark tratado', () => {
    // @clause CL-TS-007
    it('should not have active import of @github/spark/spark', () => {
      const mainPath = path.resolve(process.cwd(), 'src/main.tsx')
      const content = fs.readFileSync(mainPath, 'utf-8')
      const lines = content.split('\n')

      const hasActiveImport = lines.some((line) => {
        const trimmed = line.trim()
        const isComment = trimmed.startsWith('//') || trimmed.startsWith('/*')
        const hasSparkImport = trimmed.includes('import') && trimmed.includes('@github/spark/spark')
        return hasSparkImport && !isComment
      })

      expect(hasActiveImport).toBe(false)
    })
  })
})
