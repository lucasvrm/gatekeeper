import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname, isAbsolute } from 'path'

// Node.js built-in modules (não precisam estar em package.json)
const NODE_BUILTIN_MODULES = [
  'assert', 'buffer', 'child_process', 'cluster', 'crypto', 'dgram', 'dns',
  'domain', 'events', 'fs', 'http', 'https', 'net', 'os', 'path', 'punycode',
  'querystring', 'readline', 'repl', 'stream', 'string_decoder', 'timers',
  'tls', 'tty', 'url', 'util', 'v8', 'vm', 'zlib', 'perf_hooks', 'async_hooks',
  'http2', 'inspector', 'worker_threads', 'trace_events', 'process'
]


export const ImportRealityCheckValidator: ValidatorDefinition = {
  code: 'IMPORT_REALITY_CHECK',
  name: 'Import Reality Check',
  description: 'Verifica se imports do teste existem',
  gate: 1,
  order: 8,
  isHardBlock: true,
  
  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    if (!ctx.testFilePath) {
      return {
        passed: false,
        status: 'FAILED',
        message: 'No test file path provided',
      }
    }

    try {
      const absoluteTestPath = isAbsolute(ctx.testFilePath)
        ? ctx.testFilePath
        : resolve(ctx.projectPath, ctx.testFilePath)
      const imports = await ctx.services.ast.getImports(absoluteTestPath)

      const invalidImports: Array<{path: string, reason: string}> = []
      const testFileDir = dirname(absoluteTestPath)
      
      for (const importPath of imports) {
        if (importPath.startsWith('.') || importPath.startsWith('/') || importPath.startsWith('@/')) {
          let resolvedPath = importPath
          if (importPath.startsWith('.')) {
            resolvedPath = resolve(testFileDir, importPath)
          } else if (importPath.startsWith('@/')) {
            // @/ é path alias para src/
            resolvedPath = resolve(ctx.projectPath, 'src', importPath.slice(2))
          } else {
            resolvedPath = resolve(ctx.projectPath, importPath.slice(1))
          }

          const possibleExtensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx']
          let exists = false

          for (const ext of possibleExtensions) {
            if (existsSync(resolvedPath + ext)) {
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
          const packageJsonPath = resolve(ctx.projectPath, 'package.json')
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

              
              if (NODE_BUILTIN_MODULES.includes(packageName) || packageName.startsWith('node:')) {

              
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
          evidence: `Invalid imports:\n${invalidImports.map(i => `  - ${i.path}: ${i.reason}`).join('\n')}`,
          details: {
            invalidImports,
            totalImports: imports.length,
          },
        }
      }

      return {
        passed: true,
        status: 'PASSED',
        message: 'All imports are valid and exist',
        metrics: {
          totalImports: imports.length,
          validImports: imports.length,
        },
      }
    } catch (error) {
      return {
        passed: false,
        status: 'FAILED',
        message: `Failed to check imports: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  },
}
