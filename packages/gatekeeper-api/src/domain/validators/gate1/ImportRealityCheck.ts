import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname, isAbsolute, relative } from 'path'

// Node.js built-in modules (não precisam estar em package.json)
const NODE_BUILTIN_MODULES = [
  'assert', 'buffer', 'child_process', 'cluster', 'crypto', 'dgram', 'dns',
  'domain', 'events', 'fs', 'http', 'https', 'net', 'os', 'path', 'punycode',
  'querystring', 'readline', 'repl', 'stream', 'string_decoder', 'timers',
  'tls', 'tty', 'url', 'util', 'v8', 'vm', 'zlib', 'perf_hooks', 'async_hooks',
  'http2', 'inspector', 'worker_threads', 'trace_events', 'process'
]


const toPosixPath = (value: string): string => value.replace(/\\/g, '/')

const stripLeadingDotSegments = (value: string): string => {
  const parts = value.split(/[\\/]+/).filter(Boolean)
  let start = 0
  while (start < parts.length && (parts[start] === '..' || parts[start] === '.')) {
    start++
  }
  return parts.slice(start).join('/')
}

const parseCsv = (value: string | undefined): string[] =>
  (value || '').split(',').map((item) => item.trim()).filter(Boolean)

const parsePathAliases = (value: string | undefined): Array<{ alias: string; target: string }> => {
  const raw = value && value.trim() !== '' ? value : '@/:src/'
  const pairs = raw.split(',').map((pair) => pair.trim()).filter(Boolean)
  const aliases: Array<{ alias: string; target: string }> = []

  for (const pair of pairs) {
    const [aliasRaw, targetRaw] = pair.split(':')
    if (!aliasRaw || !targetRaw) continue
    const alias = aliasRaw.trim()
    const target = targetRaw.trim()
    aliases.push({ alias, target })
  }

  return aliases
}

const resolveAliasPath = (
  importPath: string,
  projectPath: string,
  aliases: Array<{ alias: string; target: string }>
): string | null => {
  for (const { alias, target } of aliases) {
    const aliasPrefix = alias.endsWith('/') ? alias : `${alias}/`
    const targetPrefix = target.endsWith('/') ? target : `${target}/`
    if (importPath === alias || importPath.startsWith(aliasPrefix)) {
      const remainder = importPath === alias ? '' : importPath.slice(aliasPrefix.length)
      return resolve(projectPath, targetPrefix, remainder)
    }
  }
  return null
}

export const ImportRealityCheckValidator: ValidatorDefinition = {
  code: 'IMPORT_REALITY_CHECK',
  name: 'Import Reality Check',
  description: 'Verifica se imports do teste existem',
  gate: 1,
  order: 9,
  isHardBlock: true,
  
  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    if (!ctx.testFilePath) {
      return {
        passed: false,
        status: 'FAILED',
        message: 'No test file path provided',
        context: {
          inputs: [{ label: 'TestFile', value: 'none' }],
          analyzed: [],
          findings: [{ type: 'fail', message: 'Test file path not provided' }],
          reasoning: 'Cannot validate imports without a test file path.',
        },
      }
    }

    try {
      const absoluteTestPath = isAbsolute(ctx.testFilePath)
        ? ctx.testFilePath
        : resolve(ctx.projectPath, ctx.testFilePath)
      const imports = await ctx.services.ast.getImports(absoluteTestPath)
      const extraBuiltins = parseCsv(ctx.config.get('EXTRA_BUILTIN_MODULES'))
      const builtinModules = new Set([...NODE_BUILTIN_MODULES, ...extraBuiltins])
      const pathAliases = parsePathAliases(ctx.config.get('PATH_ALIASES'))
      const pathAliasesMap = Object.fromEntries(pathAliases.map((entry) => [entry.alias, entry.target]))

      const invalidImports: Array<{path: string, reason: string}> = []
      const testFileDir = dirname(absoluteTestPath)
      const projectPath = resolve(ctx.projectPath)
      const relativeToProject = relative(projectPath, testFileDir)
      const isTestFileOutsideProject = relativeToProject.startsWith('..') || relativeToProject.includes('..\\') || relativeToProject.includes('../')
      const baseDirForRelativeImports = isTestFileOutsideProject ? projectPath : testFileDir
      const manifestCreateAbsolute = new Set(
        ctx.microplan?.files
          .filter((file) => file.action === 'CREATE')
          .map((file) => isAbsolute(file.path) ? file.path : resolve(projectPath, file.path)) ?? []
      )
      const manifestCreateRelative = new Set(
        ctx.microplan?.files
          .filter((file) => file.action === 'CREATE')
          .map((file) => stripLeadingDotSegments(toPosixPath(file.path)))
          .filter((normalized) => normalized !== '') ?? []
      )
      
      for (const importPath of imports) {
        const aliasResolved = resolveAliasPath(importPath, projectPath, pathAliases)
        if (importPath.startsWith('.') || importPath.startsWith('/') || aliasResolved) {
          let resolvedPath = importPath
          if (importPath.startsWith('.')) {
            resolvedPath = resolve(baseDirForRelativeImports, importPath)
            const relativeTarget = relative(projectPath, resolvedPath)
            if (relativeTarget.startsWith('..') || relativeTarget.startsWith('..\\')) {
              const strippedImport = importPath.replace(/^(?:\.\.[\\/])+/, '')
              if (strippedImport && strippedImport !== importPath) {
                resolvedPath = resolve(projectPath, strippedImport)
              }
            }
          } else if (aliasResolved) {
            resolvedPath = aliasResolved
          } else {
            resolvedPath = resolve(projectPath, importPath.slice(1))
          }

          const possibleExtensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx']
          let exists = false

          for (const ext of possibleExtensions) {
            const candidatePath = resolvedPath + ext
            const relativeFromProject = stripLeadingDotSegments(toPosixPath(relative(projectPath, candidatePath)))
            const matchesManifestRelative = relativeFromProject && manifestCreateRelative.has(relativeFromProject)
            const matchesManifestAbsolute = manifestCreateAbsolute.has(candidatePath)
            if (existsSync(candidatePath) || matchesManifestRelative || matchesManifestAbsolute) {
              exists = true
              break
            }
          }

          if (!exists) {
            invalidImports.push({
              path: importPath,
              reason: 'File does not exist',
            })
          }
        } else {
          // For monorepo projects, check workspace-specific package.json first
          let packageJsonPath = resolve(ctx.projectPath, 'package.json')

          // If test is in a workspace directory, try workspace package.json first
          const workspaceMatch = absoluteTestPath.match(/[\/\\](packages[\/\\][^\/\\]+)[\/\\]/)
          if (workspaceMatch) {
            const workspacePackageJson = resolve(ctx.projectPath, workspaceMatch[1], 'package.json')
            if (existsSync(workspacePackageJson)) {
              packageJsonPath = workspacePackageJson
            }
          }

          if (existsSync(packageJsonPath)) {
            try {
              const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
              const allDeps = {
                ...(packageJson.dependencies || {}),
                ...(packageJson.devDependencies || {}),
              }
              
              const packageName = importPath.startsWith('@') 
                ? importPath.split('/').slice(0, 2).join('/')
                : importPath.split('/')[0]
              
              // Verificar se é módulo built-in do Node.js

              
              if (builtinModules.has(packageName) || packageName.startsWith('node:')) {

              
                // Módulo built-in, não precisa estar em package.json

              
              } else if (!allDeps[packageName]) {
                invalidImports.push({
                  path: importPath,
                  reason: `Package "${packageName}" not found in dependencies`,
                })
              }
            } catch (error) {
              ctx.services.log.warn('Failed to parse package.json', { error })
            }
          }
        }
      }

      if (invalidImports.length > 0) {
        return {
          passed: false,
          status: 'FAILED',
          message: `Found ${invalidImports.length} invalid import(s)`,
          context: {
            inputs: [
              { label: 'TestFile', value: ctx.testFilePath },
              { label: 'Extra Builtins', value: extraBuiltins },
              { label: 'Path Aliases', value: pathAliasesMap },
            ],
            analyzed: [{ label: 'Import Statements', items: imports }],
            findings: invalidImports.map((entry) => ({
              type: 'fail' as const,
              message: `${entry.path}: ${entry.reason}`,
            })),
            reasoning: 'One or more import statements could not be resolved.',
          },
          evidence: `Invalid imports:\n${invalidImports.map(i => `  - ${i.path}: ${i.reason}`).join('\n')}`,
          details: {
            invalidImports,
            totalImports: imports.length,
            extraBuiltins,
            pathAliases: pathAliasesMap,
          },
        }
      }

      return {
        passed: true,
        status: 'PASSED',
        message: 'All imports are valid and exist',
        context: {
          inputs: [
            { label: 'TestFile', value: ctx.testFilePath },
            { label: 'Extra Builtins', value: extraBuiltins },
            { label: 'Path Aliases', value: pathAliasesMap },
          ],
          analyzed: [{ label: 'Import Statements', items: imports }],
          findings: imports.map((path) => ({
            type: 'pass' as const,
            message: `Import "${path}" resolves`,
          })),
          reasoning: 'All import statements resolve to existing modules or dependencies.',
        },
        metrics: {
          totalImports: imports.length,
          validImports: imports.length,
        },
        details: {
          extraBuiltins,
          pathAliases: pathAliasesMap,
        },
      }
    } catch (error) {
      return {
        passed: false,
        status: 'FAILED',
        message: `Failed to check imports: ${error instanceof Error ? error.message : String(error)}`,
        context: {
          inputs: [{ label: 'TestFile', value: ctx.testFilePath }],
          analyzed: [],
          findings: [{ type: 'fail', message: 'Import analysis failed' }],
          reasoning: 'An error occurred while resolving imports.',
        },
      }
    }
  },
}
