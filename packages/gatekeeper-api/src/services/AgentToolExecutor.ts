/**
 * Agent Tool Executor
 *
 * Executes filesystem tools in a sandboxed context.
 * All paths are resolved relative to projectRoot and validated to prevent
 * path traversal attacks.
 *
 * Tools:
 *   READ  — read_file, list_directory, search_code (phases 1, 2, 4)
 *   WRITE — write_file, bash (phase 4 only)
 *
 * Security:
 *   - safePath() prevents path traversal (../ attacks)
 *   - bash allowlist restricts commands in write mode
 *   - All errors are caught and returned as { isError: true }
 *
 * Cross-platform:
 *   - search_code uses pure Node.js (no grep dependency)
 *   - bash supports both Windows (cmd/PowerShell) and Unix shells
 */

import { readFile, readdir, mkdir, writeFile, stat } from 'node:fs/promises'
import { resolve, dirname, relative, sep, extname } from 'node:path'
import { execSync } from 'node:child_process'
import type { ToolDefinition, ToolExecutionResult } from '../types/agent.types.js'

// ─── Bash Allowlist ────────────────────────────────────────────────────────

const BASH_ALLOWED_PREFIXES = [
  // Build & test
  'npm test',
  'npm run test',
  'npm run build',
  'npx tsc',
  'npx vitest',
  'npx jest',
  'npx eslint',
  // Git
  'git status',
  'git diff',
  'git log',
  // Unix read commands
  'cat ',
  'ls ',
  'find ',
  'grep ',
  'head ',
  'tail ',
  'wc ',
  // Windows equivalents
  'type ',
  'dir ',
  'findstr ',
]

// ─── search_code configuration ────────────────────────────────────────────

const SEARCH_SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage',
  '.next', '.cache', '.turbo', '__pycache__',
])

const SEARCH_BINARY_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg',
  '.woff', '.woff2', '.ttf', '.eot',
  '.zip', '.tar', '.gz', '.rar',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.exe', '.dll', '.so', '.dylib',
  '.lock',
])

// ─── Tool Definitions ──────────────────────────────────────────────────────

export const READ_TOOLS: ToolDefinition[] = [
  {
    name: 'read_file',
    description:
      'Read the contents of a file at the given path relative to the project root.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative file path from project root',
        },
        maxLines: {
          type: 'number',
          description: 'Max lines to return (default: all)',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'list_directory',
    description:
      'List files and directories at the given path. Returns names with type indicators (/ for directories).',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative directory path (default: ".")',
        },
        recursive: {
          type: 'boolean',
          description: 'List recursively (default: false)',
        },
        maxDepth: {
          type: 'number',
          description: 'Max recursion depth when recursive (default: 3)',
        },
      },
      required: [],
    },
  },
  {
    name: 'search_code',
    description:
      'Search for a text or regex pattern in project files. Returns matching lines with file path and line number. Works cross-platform.',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Text or regex pattern to search for',
        },
        path: {
          type: 'string',
          description: 'Directory to search in (default: ".")',
        },
        fileGlob: {
          type: 'string',
          description: 'File extension filter (e.g. ".ts", ".tsx")',
        },
        maxResults: {
          type: 'number',
          description: 'Max matches to return (default: 50)',
        },
      },
      required: ['pattern'],
    },
  },
]

export const WRITE_TOOLS: ToolDefinition[] = [
  {
    name: 'write_file',
    description:
      'Write content to a file. Creates parent directories if needed.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative file path from project root',
        },
        content: {
          type: 'string',
          description: 'File content to write',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'bash',
    description:
      'Execute a shell command in the project directory. Only allowed commands: npm test, npm run build, npx tsc, git status/diff/log, and basic read commands.',
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Shell command to execute',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 30000)',
        },
      },
      required: ['command'],
    },
  },
]

export const SAVE_ARTIFACT_TOOL: ToolDefinition = {
  name: 'save_artifact',
  description:
    'Save a named artifact (plan.json, contract.md, task.spec.md, or .spec.ts file). Use this when you have finished producing an artifact.',
  inputSchema: {
    type: 'object',
    properties: {
      filename: {
        type: 'string',
        description:
          'Artifact filename (e.g. "plan.json", "contract.md", "task.spec.md")',
      },
      content: {
        type: 'string',
        description: 'Complete artifact content',
      },
    },
    required: ['filename', 'content'],
  },
}

// ─── Executor Class ────────────────────────────────────────────────────────

export class AgentToolExecutor {
  private artifacts = new Map<string, string>()

  /**
   * Get all saved artifacts from save_artifact tool calls.
   */
  getArtifacts(): Map<string, string> {
    return new Map(this.artifacts)
  }

  /**
   * Clear artifacts (between phases).
   */
  clearArtifacts(): void {
    this.artifacts.clear()
  }

  /**
   * Execute a tool call in the context of a project root.
   */
  async execute(
    toolName: string,
    input: Record<string, unknown>,
    projectRoot: string,
  ): Promise<ToolExecutionResult> {
    try {
      switch (toolName) {
        case 'read_file':
          return await this.readFile(
            input.path as string,
            input.maxLines as number | undefined,
            projectRoot,
          )

        case 'list_directory':
          return await this.listDirectory(
            (input.path as string) || '.',
            (input.recursive as boolean) ?? false,
            (input.maxDepth as number) ?? 3,
            projectRoot,
          )

        case 'search_code':
          return await this.searchCode(
            input.pattern as string,
            (input.path as string) || '.',
            (input.fileGlob as string) || '',
            (input.maxResults as number) || 50,
            projectRoot,
          )

        case 'write_file':
          return await this.writeFile(
            input.path as string,
            input.content as string,
            projectRoot,
          )

        case 'bash':
          return this.bash(
            input.command as string,
            (input.timeout as number) || 30000,
            projectRoot,
          )

        case 'save_artifact':
          return this.saveArtifact(
            input.filename as string,
            input.content as string,
          )

        default:
          return { content: `Unknown tool: ${toolName}`, isError: true }
      }
    } catch (err) {
      return {
        content: `Error executing ${toolName}: ${(err as Error).message}`,
        isError: true,
      }
    }
  }

  // ─── Path Security ─────────────────────────────────────────────────────

  private safePath(relativePath: string, projectRoot: string): string {
    const resolved = resolve(projectRoot, relativePath)
    const normalizedRoot = resolve(projectRoot)

    if (!resolved.startsWith(normalizedRoot + sep) && resolved !== normalizedRoot) {
      throw new Error(`Path escapes project root: ${relativePath}`)
    }

    return resolved
  }

  // ─── Tool Implementations ──────────────────────────────────────────────

  private async readFile(
    path: string,
    maxLines: number | undefined,
    projectRoot: string,
  ): Promise<ToolExecutionResult> {
    const filePath = this.safePath(path, projectRoot)
    let content = await readFile(filePath, 'utf-8')

    if (maxLines && maxLines > 0) {
      const lines = content.split('\n')

      // Don't count trailing empty line from final newline
      const totalLines =
        lines.length > 0 && lines[lines.length - 1] === ''
          ? lines.length - 1
          : lines.length

      if (totalLines > maxLines) {
        content =
          lines.slice(0, maxLines).join('\n') +
          `\n... (${totalLines - maxLines} more lines)`
      }
    }

    return { content, isError: false }
  }

  private async listDirectory(
    path: string,
    recursive: boolean,
    maxDepth: number,
    projectRoot: string,
  ): Promise<ToolExecutionResult> {
    const dirPath = this.safePath(path, projectRoot)
    const entries = await this.listDirRecursive(dirPath, projectRoot, recursive, maxDepth, 0)
    return { content: entries.join('\n'), isError: false }
  }

  private async listDirRecursive(
    dirPath: string,
    projectRoot: string,
    recursive: boolean,
    maxDepth: number,
    currentDepth: number,
  ): Promise<string[]> {
    const entries = await readdir(dirPath, { withFileTypes: true })
    const result: string[] = []

    const filtered = entries.filter(
      (e) =>
        !e.name.startsWith('.') &&
        e.name !== 'node_modules' &&
        e.name !== 'dist' &&
        e.name !== '.git',
    )

    for (const entry of filtered) {
      const rel = relative(projectRoot, resolve(dirPath, entry.name))
      if (entry.isDirectory()) {
        result.push(`${rel}/`)
        if (recursive && currentDepth < maxDepth) {
          const children = await this.listDirRecursive(
            resolve(dirPath, entry.name),
            projectRoot,
            true,
            maxDepth,
            currentDepth + 1,
          )
          result.push(...children)
        }
      } else {
        result.push(rel)
      }
    }

    return result
  }

  /**
   * Pure Node.js search — no grep dependency.
   * Recursively walks the directory, reads text files, matches pattern.
   */
  private async searchCode(
    pattern: string,
    path: string,
    fileExt: string,
    maxResults: number,
    projectRoot: string,
  ): Promise<ToolExecutionResult> {
    const searchPath = this.safePath(path, projectRoot)
    const regex = new RegExp(pattern, 'i')
    const matches: string[] = []

    await this.searchDir(searchPath, projectRoot, regex, fileExt, maxResults, matches)

    if (matches.length === 0) {
      return { content: 'No matches found.', isError: false }
    }

    return { content: matches.join('\n'), isError: false }
  }

  private async searchDir(
    dirPath: string,
    projectRoot: string,
    regex: RegExp,
    fileExt: string,
    maxResults: number,
    matches: string[],
  ): Promise<void> {
    if (matches.length >= maxResults) return

    let entries
    try {
      entries = await readdir(dirPath, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (matches.length >= maxResults) return

      if (entry.isDirectory()) {
        if (SEARCH_SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) {
          continue
        }
        await this.searchDir(
          resolve(dirPath, entry.name),
          projectRoot,
          regex,
          fileExt,
          maxResults,
          matches,
        )
        continue
      }

      // Skip binary files
      const ext = extname(entry.name).toLowerCase()
      if (SEARCH_BINARY_EXTS.has(ext)) continue

      // Filter by extension if provided
      if (fileExt && ext !== fileExt && !entry.name.endsWith(fileExt)) {
        continue
      }

      // Read and search
      const filePath = resolve(dirPath, entry.name)
      try {
        const content = await readFile(filePath, 'utf-8')
        const lines = content.split('\n')

        for (let i = 0; i < lines.length; i++) {
          if (matches.length >= maxResults) return
          if (regex.test(lines[i])) {
            const relPath = relative(projectRoot, filePath)
            matches.push(`${relPath}:${i + 1}:${lines[i]}`)
          }
        }
      } catch {
        // Skip unreadable files
      }
    }
  }

  private async writeFile(
    path: string,
    content: string,
    projectRoot: string,
  ): Promise<ToolExecutionResult> {
    const filePath = this.safePath(path, projectRoot)
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, content, 'utf-8')

    const stats = await stat(filePath)
    return {
      content: `Written ${path} (${stats.size} bytes)`,
      isError: false,
    }
  }

  private bash(
    command: string,
    timeout: number,
    projectRoot: string,
  ): ToolExecutionResult {
    const trimmed = command.trim()
    const isAllowed = BASH_ALLOWED_PREFIXES.some((prefix) =>
      trimmed.startsWith(prefix),
    )

    if (!isAllowed) {
      return {
        content:
          `Command not allowed: "${trimmed}". ` +
          `Allowed prefixes: ${BASH_ALLOWED_PREFIXES.join(', ')}`,
        isError: true,
      }
    }

    try {
      const result = execSync(command, {
        cwd: projectRoot,
        encoding: 'utf-8',
        timeout: Math.min(timeout, 60000),
        maxBuffer: 1024 * 1024,
        shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
      })
      return { content: result || '(no output)', isError: false }
    } catch (err) {
      const execError = err as { stdout?: string; stderr?: string; message: string }
      const output = [execError.stdout, execError.stderr]
        .filter(Boolean)
        .join('\n')
      return {
        content: output || `Command failed: ${execError.message}`,
        isError: true,
      }
    }
  }

  private saveArtifact(
    filename: string,
    content: string,
  ): ToolExecutionResult {
    this.artifacts.set(filename, content)
    return {
      content: `Artifact saved: ${filename} (${content.length} chars)`,
      isError: false,
    }
  }
}
