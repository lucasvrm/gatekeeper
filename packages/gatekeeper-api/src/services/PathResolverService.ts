import { join, dirname, basename } from 'path'
import { existsSync } from 'fs'
import { mkdir, copyFile } from 'fs/promises'
import { prisma } from '../db/client.js'
import type { ManifestInput } from '../types/index.js'

export class PathResolverService {
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

    return absolutePath
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

    if (manifest.testFile && /[\\/]/.test(manifest.testFile)) {
      const directPath = join(projectRoot, manifest.testFile)
      console.log('[PathResolver] Using manifest.testFile directly:', directPath)

      const targetDir = dirname(directPath)
      await mkdir(targetDir, { recursive: true })

      if (existsSync(artifactsSpecPath)) {
        await copyFile(artifactsSpecPath, directPath)
        console.log('[PathResolver] ✅ File copied to manifest.testFile path:', directPath)
      } else {
        console.warn('[PathResolver] ❌ Source file does not exist:', artifactsSpecPath)
      }

      return directPath.replace(/\\/g, '/')
    }

    // 1. Detectar tipo de teste
    const testType = this.detectTestType(manifest)
    console.log('[PathResolver] Detected test type:', testType)

    // 2. Buscar convenção
    const convention = await this.getPathConvention(testType)
    if (!convention) {
      console.warn('[PathResolver] No convention found, keeping file in artifacts')
      return artifactsSpecPath
    }
    console.log('[PathResolver] Found convention pattern:', convention.pathPattern)

    // 3. Extrair nome do arquivo spec
    const specFileName = basename(artifactsSpecPath)
    console.log('[PathResolver] Spec file name:', specFileName)

    // 4. Aplicar pattern para obter path correto
    const correctPath = this.applyPattern(
      convention.pathPattern,
      manifest,
      projectRoot,
      specFileName
    )
    console.log('[PathResolver] Calculated correct path:', correctPath)

    // 5. Verificar se já existe no path correto
    if (existsSync(correctPath)) {
      console.log('[PathResolver] File already exists at correct path')
      return correctPath
    }

    // 6. Se não existe, copiar de artifacts/
    try {
      // Criar diretório de destino se não existir
      const targetDir = dirname(correctPath)
      await mkdir(targetDir, { recursive: true })
      console.log('[PathResolver] Created target directory:', targetDir)

      // Copiar arquivo
      if (existsSync(artifactsSpecPath)) {
        await copyFile(artifactsSpecPath, correctPath)
        console.log('[PathResolver] ✅ File copied successfully to:', correctPath)
      } else {
        console.error('[PathResolver] ❌ Source file does not exist:', artifactsSpecPath)
        throw new Error(`Source spec file not found: ${artifactsSpecPath}`)
      }

      return correctPath
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
