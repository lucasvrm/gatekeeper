import { join, dirname, basename } from 'path'
import { existsSync } from 'fs'
import { mkdir, copyFile } from 'fs/promises'
import { glob } from 'glob'
import { prisma } from '../db/client.js'
import type { ManifestInput } from '../types/index.js'

export class PathResolverService {
  private normalizePath(pathValue: string): string {
    return pathValue.replace(/\\/g, '/')
  }

  private ensureSrcPath(pathValue: string, projectRoot: string, specFileName: string): string {
    const normalized = this.normalizePath(pathValue)
    if (normalized.includes('/src/')) {
      return pathValue
    }

    return join(projectRoot, 'src', specFileName)
  }

  /**
   * Detecta o tipo de teste baseado nos arquivos do manifest
   * Procura por patterns em manifest.files para determinar o tipo
   */
  detectTestType(manifest: ManifestInput): string {
    const files = manifest.files || []

    // Converter paths para string única para análise
    const filesStr = files.map(f => f.path).join(' ').toLowerCase()

    // Ordem de prioridade na detecção
    if (filesStr.includes('/layout/') || filesStr.includes('\\layout\\')) {
      return 'layout'
    }
    if (filesStr.includes('/widgets/') || filesStr.includes('\\widgets\\')) {
      return 'widget'
    }
    if (filesStr.includes('/views/') || filesStr.includes('\\views\\')) {
      return 'view'
    }
    if (filesStr.includes('/ui/') || filesStr.includes('\\ui\\')) {
      return 'ui'
    }
    if (filesStr.includes('/components/') || filesStr.includes('\\components\\')) {
      return 'component'
    }
    if (filesStr.includes('/hooks/') || filesStr.includes('\\hooks\\')) {
      return 'hook'
    }
    if (filesStr.includes('/lib/') || filesStr.includes('\\lib\\')) {
      return 'lib'
    }
    if (filesStr.includes('/utils/') || filesStr.includes('\\utils\\')) {
      return 'util'
    }
    if (filesStr.includes('/services/') || filesStr.includes('\\services\\')) {
      return 'service'
    }
    if (filesStr.includes('/pages/') || filesStr.includes('\\pages\\')) {
      return 'page'
    }

    // Fallback: tentar detectar pelo nome do arquivo
    const firstFile = files[0]
    if (firstFile) {
      const firstFilePath = firstFile.path.toLowerCase()
      if (firstFilePath.includes('service')) return 'service'
      if (firstFilePath.includes('hook')) return 'hook'
      if (firstFilePath.includes('util')) return 'util'
      if (firstFilePath.includes('page')) return 'page'
    }

    // Default para component se não detectar nada
    console.warn('[PathResolver] Could not detect test type, defaulting to "component"')
    return 'component'
  }

  /**
   * Busca a convenção de path do banco de dados para o tipo de teste
   */
  async getPathConvention(testType: string): Promise<{ testType: string; pathPattern: string } | null> {
    const convention = await prisma.testPathConvention.findFirst({
      where: { testType, isActive: true },
    })

    if (!convention || !convention.isActive) {
      console.warn(`[PathResolver] No active convention found for test type: ${testType}`)
      return null
    }

    return {
      testType: convention.testType,
      pathPattern: convention.pathPattern,
    }
  }

  /**
   * Aplica o pattern da convenção substituindo placeholders
   * {name} - nome do componente/hook/etc extraído do manifest
   * {gate} - número do gate (não usado para agora, mas suportado)
   */
  applyPattern(
    pattern: string,
    manifest: ManifestInput,
    projectRoot: string,
    specFileName: string
  ): string {
    // Extrair nome base do arquivo spec (remover .spec.tsx)
    const nameWithoutExt = specFileName
      .replace('.spec.tsx', '')
      .replace('.spec.ts', '')
      .replace('.spec.jsx', '')
      .replace('.spec.js', '')

    // Converter para PascalCase para nome de componente
    const componentName = this.toPascalCase(nameWithoutExt)

    // Substituir placeholders
    let resolvedPath = pattern
      .replace(/{name}/g, componentName)
      .replace(/{gate}/g, '0') // Por enquanto sempre gate 0

    // Garantir que usa o nome do arquivo spec original
    const dir = dirname(resolvedPath)
    resolvedPath = join(dir, specFileName)

    // Combinar com projectRoot
    const absolutePath = join(projectRoot, resolvedPath)

    return this.normalizePath(absolutePath)
  }

  /**
   * Converte string para PascalCase
   * Ex: "my-component" -> "MyComponent"
   */
  private toPascalCase(str: string): string {
    return str
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('')
  }

  /**
   * Busca spec file por glob no projectRoot
   * Retorna o path encontrado se houver exatamente 1 match, null caso contrário
   */
  private findSpecByGlob(specFileName: string, projectRoot: string): string | null {
    try {
      const pattern = `**/${specFileName}`
      const matches = glob.sync(pattern, {
        cwd: projectRoot,
        absolute: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/artifacts/**'],
      })

      if (matches.length === 1) {
        console.log('[PathResolver] Glob found unique match:', matches[0])
        return matches[0]
      }

      if (matches.length > 1) {
        console.warn('[PathResolver] Glob found multiple matches, falling back to convention:', matches)
        return null
      }

      // Zero matches - fall through to convention
      return null
    } catch (error) {
      console.error('[PathResolver] Glob search failed:', error)
      return null
    }
  }

  /**
   * Função principal: garante que o spec está no path correto
   * Se não estiver, copia de artifacts/ para o destino correto
   * Retorna o path correto onde o arquivo deve estar
   */
  async ensureCorrectPath(
    artifactsSpecPath: string,
    manifest: ManifestInput,
    projectRoot: string,
    outputId: string
  ): Promise<string> {
    console.log('[PathResolver] ensureCorrectPath called with:')
    console.log('[PathResolver]   artifactsSpecPath:', artifactsSpecPath)
    console.log('[PathResolver]   projectRoot:', projectRoot)
    console.log('[PathResolver]   outputId:', outputId)

    const specFileName = basename(artifactsSpecPath)

    if (manifest.testFile && /[\\/]/.test(manifest.testFile)) {
      const directPath = join(projectRoot, manifest.testFile)
      const enforcedPath = this.ensureSrcPath(directPath, projectRoot, specFileName)
      if (enforcedPath !== directPath) {
        console.warn('[PathResolver] Resolved path missing /src/, enforcing fallback:', enforcedPath)
      }
      console.log('[PathResolver] Using manifest.testFile directly:', enforcedPath)

      const targetDir = dirname(enforcedPath)
      await mkdir(targetDir, { recursive: true })

      if (existsSync(artifactsSpecPath)) {
        await copyFile(artifactsSpecPath, enforcedPath)
        console.log('[PathResolver] ✅ File copied to manifest.testFile path:', enforcedPath)
      } else {
        console.warn('[PathResolver] ❌ Source file does not exist:', artifactsSpecPath)
      }

      return this.normalizePath(enforcedPath)
    }

    // Tentar glob search para encontrar spec existente
    const globFoundPath = this.findSpecByGlob(specFileName, projectRoot)
    if (globFoundPath) {
      const targetDir = dirname(globFoundPath)
      await mkdir(targetDir, { recursive: true })

      if (existsSync(artifactsSpecPath)) {
        await copyFile(artifactsSpecPath, globFoundPath)
        console.log('[PathResolver] ✅ File copied to glob-found path:', globFoundPath)
      } else {
        console.warn('[PathResolver] ❌ Source file does not exist:', artifactsSpecPath)
      }

      return this.normalizePath(globFoundPath)
    }

    // 1. Detectar tipo de teste
    const testType = this.detectTestType(manifest)
    console.log('[PathResolver] Detected test type:', testType)

    // 2. Buscar convenção
    const convention = await this.getPathConvention(testType)
    if (!convention) {
      const fallbackPath = join(projectRoot, 'src', specFileName)
      console.warn('[PathResolver] No convention found, using fallback path:', fallbackPath)

      const targetDir = dirname(fallbackPath)
      await mkdir(targetDir, { recursive: true })

      if (existsSync(artifactsSpecPath)) {
        await copyFile(artifactsSpecPath, fallbackPath)
        console.log('[PathResolver] ✅ File copied to fallback path:', fallbackPath)
      } else {
        console.warn('[PathResolver] ❌ Source file does not exist:', artifactsSpecPath)
      }

      return this.normalizePath(fallbackPath)
    }
    console.log('[PathResolver] Found convention pattern:', convention.pathPattern)

    // 3. Extrair nome do arquivo spec
    console.log('[PathResolver] Spec file name:', specFileName)

    // 4. Aplicar pattern para obter path correto
    const correctPath = this.applyPattern(
      convention.pathPattern,
      manifest,
      projectRoot,
      specFileName
    )
    const enforcedPath = this.ensureSrcPath(correctPath, projectRoot, specFileName)
    if (enforcedPath !== correctPath) {
      console.warn('[PathResolver] Convention path missing /src/, enforcing fallback:', enforcedPath)
    }
    console.log('[PathResolver] Calculated correct path:', enforcedPath)

    // 5. Verificar se já existe no path correto
    if (existsSync(enforcedPath)) {
      console.log('[PathResolver] File already exists at correct path')
      return this.normalizePath(enforcedPath)
    }

    // 6. Se não existe, copiar de artifacts/
    try {
      // Criar diretório de destino se não existir
      const targetDir = dirname(enforcedPath)
      await mkdir(targetDir, { recursive: true })
      console.log('[PathResolver] Created target directory:', targetDir)

      // Copiar arquivo
      if (existsSync(artifactsSpecPath)) {
        await copyFile(artifactsSpecPath, enforcedPath)
        console.log('[PathResolver] ✅ File copied successfully to:', enforcedPath)
      } else {
        console.error('[PathResolver] ❌ Source file does not exist:', artifactsSpecPath)
        throw new Error(`Source spec file not found: ${artifactsSpecPath}`)
      }

      return this.normalizePath(enforcedPath)
    } catch (error) {
      console.error('[PathResolver] ❌ Failed to copy file:', error)
      throw new Error(`Failed to copy spec to correct path: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Verifica se um arquivo precisa ser re-copiado
   * Útil para rerun - se o arquivo não existe mais no destino, copia novamente
   */
  async recheckAndCopy(
    testFilePath: string,
    artifactsSpecPath: string
  ): Promise<string> {
    console.log('[PathResolver] Rechecking path:', testFilePath)

    if (existsSync(testFilePath)) {
      console.log('[PathResolver] File exists, no action needed')
      return testFilePath
    }

    console.log('[PathResolver] File missing, will copy from artifacts')

    // Criar diretório se não existir
    const targetDir = dirname(testFilePath)
    await mkdir(targetDir, { recursive: true })

    // Copiar de artifacts
    if (existsSync(artifactsSpecPath)) {
      await copyFile(artifactsSpecPath, testFilePath)
      console.log('[PathResolver] ✅ File restored to:', testFilePath)
    } else {
      console.error('[PathResolver] ❌ Artifacts file also missing:', artifactsSpecPath)
      throw new Error('Cannot restore test file - artifacts source also missing')
    }

    return testFilePath
  }
}
