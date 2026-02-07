import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'
import { resolve, dirname, relative } from 'path'
import { readFileSync, readdirSync } from 'fs'

const toPosixPath = (value: string): string => value.replace(/\\/g, '/')

/**
 * Extrai imports de um arquivo de código
 */
function extractImportsFromContent(content: string): string[] {
  const imports: string[] = []
  const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g
  let match
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1])
  }
  return imports
}

/**
 * Resolve um path de import para path absoluto
 */
function resolveImportPath(importPath: string, fromFilePath: string, projectPath: string): string | null {
  // Handle @/ alias -> src/
  if (importPath.startsWith('@/')) {
    return resolve(projectPath, 'src', importPath.slice(2))
  }

  // Handle relative imports
  if (importPath.startsWith('./') || importPath.startsWith('../')) {
    const fromDir = dirname(fromFilePath)
    return resolve(fromDir, importPath)
  }

  // External package - not relevant for delete check
  return null
}

/**
 * Verifica se um import resolvido corresponde a um arquivo deletado
 */
function matchesDeletedFile(resolvedImport: string, deletedFilePath: string, projectPath: string): boolean {
  const normalize = (p: string): string => {
    const posix = toPosixPath(p).replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, '')
    // Normalize to relative path from project
    if (posix.startsWith(toPosixPath(projectPath))) {
      return posix.slice(toPosixPath(projectPath).length).replace(/^\//, '')
    }
    return posix
  }

  const normalizedImport = normalize(resolvedImport)
  const normalizedDeleted = normalize(deletedFilePath)

  // Direct match
  if (normalizedImport === normalizedDeleted) return true

  // Match with extensions
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']
  for (const ext of extensions) {
    if (normalize(resolvedImport + ext) === normalizedDeleted) return true
  }

  // Index file match
  if (normalize(resolvedImport + '/index') === normalizedDeleted) return true

  return false
}

/**
 * Escaneia diretório recursivamente para encontrar arquivos de código
 */
function scanProjectFiles(dir: string, projectPath: string, ignorePatterns: string[] = []): string[] {
  const files: string[] = []
  const ignore = [...ignorePatterns]

  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = resolve(dir, entry.name)

      if (ignore.some(pattern => entry.name === pattern || fullPath.includes(`/${pattern}/`) || fullPath.includes(`\\${pattern}\\`))) {
        continue
      }

      if (entry.isDirectory()) {
        files.push(...scanProjectFiles(fullPath, projectPath, ignorePatterns))
      } else if (entry.isFile() && /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) {
        files.push(fullPath)
      }
    }
  } catch {
    // Ignore permission errors
  }

  return files
}

export const DeleteDependencyCheckValidator: ValidatorDefinition = {
  code: 'DELETE_DEPENDENCY_CHECK',
  name: 'Delete Dependency Check',
  description: 'Validates that files importing deleted files are covered in manifest',
  gate: 0,
  order: 7,
  isHardBlock: true,

  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    const baseContext = {
      inputs: [] as { label: string; value: string | string[] | Record<string, unknown> }[],
      analyzed: [] as { label: string; items: string[] }[],
      findings: [] as { type: 'pass' | 'fail' | 'warning' | 'info'; message: string; location?: string }[],
      reasoning: ''
    }

    // CL-DEL-001: No microplan
    if (!ctx.microplan || !ctx.microplan.files) {
      return {
        passed: true,
        status: 'SKIPPED',
        message: 'No microplan provided',
        context: {
          ...baseContext,
          reasoning: 'Microplan is null or undefined'
        },
        details: {},
        evidence: ''
      }
    }

    const files = ctx.microplan.files
    const deleteFiles = files.filter(f => f.action === 'DELETE')

    baseContext.inputs.push({ label: 'Microplan Files', value: files.map(f => f.path) })

    // CL-DEL-002: No DELETE operations
    if (deleteFiles.length === 0) {
      return {
        passed: true,
        status: 'PASSED',
        message: 'No DELETE operations in microplan',
        context: {
          ...baseContext,
          reasoning: 'No files marked for deletion'
        },
        details: {},
        evidence: ''
      }
    }

    baseContext.analyzed.push({ label: 'Files Marked for DELETE', items: deleteFiles.map(f => f.path) })

    const defaultIgnore = ['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.cache']
    const ignoreConfigStr = ctx.config.get('DELETE_CHECK_IGNORE_DIRS') || ''
    const configIgnore = ignoreConfigStr
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    const ignoreDirs = Array.from(new Set([...defaultIgnore, ...configIgnore]))

    baseContext.inputs.push({ label: 'Ignore Dirs', value: ignoreDirs })

    // Scan project files for importers
    const projectFiles = scanProjectFiles(ctx.projectPath, ctx.projectPath, ignoreDirs)
    const orphanedImports: Array<{ deletedFile: string; importers: string[] }> = []
    const suggestions: Array<{ path: string; action: 'EDIT' }> = []

    for (const deleteFile of deleteFiles) {
      const deletePath = deleteFile.path
      const absoluteDeletePath = resolve(ctx.projectPath, deletePath)
      const importers: string[] = []

      for (const projectFile of projectFiles) {
        // Skip the file being deleted
        if (projectFile === absoluteDeletePath) continue

        try {
          const content = readFileSync(projectFile, 'utf-8')
          const imports = extractImportsFromContent(content)

          for (const imp of imports) {
            const resolvedImport = resolveImportPath(imp, projectFile, ctx.projectPath)
            if (resolvedImport && matchesDeletedFile(resolvedImport, absoluteDeletePath, ctx.projectPath)) {
              const relativeProjectFile = toPosixPath(relative(ctx.projectPath, projectFile))

              // Check if importer is covered in microplan
              const isInMicroplan = files.some(f =>
                toPosixPath(f.path) === relativeProjectFile && (f.action === 'EDIT' || f.action === 'DELETE')
              )

              if (!isInMicroplan) {
                importers.push(relativeProjectFile)
              }
              break // Found import, no need to check other imports
            }
          }
        } catch {
          // Ignore read errors
        }
      }

      if (importers.length > 0) {
        orphanedImports.push({
          deletedFile: deletePath,
          importers
        })
        for (const imp of importers) {
          if (!suggestions.some(s => s.path === imp)) {
            suggestions.push({ path: imp, action: 'EDIT' })
          }
        }
      }
    }

    // CL-DEL-003, CL-DEL-004, CL-DEL-005: All importers covered
    if (orphanedImports.length === 0) {
      const hasScannedFiles = projectFiles.length > 0
      return {
        passed: true,
        status: 'PASSED',
        message: hasScannedFiles
          ? `All importers of ${deleteFiles.length} deleted file(s) are covered in microplan`
          : `No importers found for ${deleteFiles.length} deleted file(s)`,
        context: {
          ...baseContext,
          findings: [{ type: 'pass', message: 'All importers are covered by MODIFY or DELETE entries' }],
          reasoning: 'All importers are covered by MODIFY or DELETE entries'
        },
        details: {},
        evidence: ''
      }
    }

    // CL-DEL-006: Uncovered importers found
    const totalOrphans = orphanedImports.reduce((sum, o) => sum + o.importers.length, 0)

    // CL-DEL-010: Evidence format
    const evidence = orphanedImports.map(o => {
      const importersList = o.importers.map(i => `    - ${i}`).join('\n')
      const suggestionsList = o.importers.map(i => `    - ${i} (EDIT)`).join('\n')
      return `DELETE: ${o.deletedFile}\n  Imported by (NOT in microplan):\n${importersList}\n  Suggested additions:\n${suggestionsList}`
    }).join('\n\n')

    // CL-DEL-013: Context structure
    baseContext.findings = orphanedImports.map(o => ({
      type: 'fail' as const,
      message: `File ${o.deletedFile} is imported by ${o.importers.length} file(s) not in microplan`,
      location: o.deletedFile
    }))
    baseContext.reasoning = `${totalOrphans} importers are not covered in microplan`

    return {
      passed: false,
      status: 'FAILED',
      message: `Found ${totalOrphans} file(s) importing deleted files but not in microplan`,
      context: baseContext,
      details: {
        orphanedImports,
        suggestions
      },
      evidence
    }
  }
}
