import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { AgentToolExecutor } from '../AgentToolExecutor.js'

describe('AgentToolExecutor', () => {
  let executor: AgentToolExecutor
  let projectRoot: string

  beforeEach(async () => {
    executor = new AgentToolExecutor()
    projectRoot = await mkdtemp(join(tmpdir(), 'agent-test-'))

    // Create test file structure
    await mkdir(join(projectRoot, 'src'), { recursive: true })
    await mkdir(join(projectRoot, 'src', 'utils'), { recursive: true })
    await writeFile(join(projectRoot, 'src', 'index.ts'), 'export const hello = "world"\n')
    await writeFile(join(projectRoot, 'src', 'utils', 'helpers.ts'), 'export function add(a: number, b: number) { return a + b }\n')
    await writeFile(join(projectRoot, 'package.json'), '{"name":"test","version":"1.0.0"}\n')
  })

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true })
  })

  // ─── Path Security ────────────────────────────────────────────────────

  describe('path security', () => {
    it('should block path traversal with ../', async () => {
      const result = await executor.execute(
        'read_file',
        { path: '../../../etc/passwd' },
        projectRoot,
      )
      expect(result.isError).toBe(true)
      expect(result.content).toContain('escapes project root')
    })

    it('should block path traversal with encoded characters', async () => {
      const result = await executor.execute(
        'read_file',
        { path: 'src/../../etc/passwd' },
        projectRoot,
      )
      expect(result.isError).toBe(true)
      expect(result.content).toContain('escapes project root')
    })

    it('should allow valid relative paths', async () => {
      const result = await executor.execute(
        'read_file',
        { path: 'src/index.ts' },
        projectRoot,
      )
      expect(result.isError).toBe(false)
      expect(result.content).toContain('hello')
    })
  })

  // ─── read_file ────────────────────────────────────────────────────────

  describe('read_file', () => {
    it('should read file contents', async () => {
      const result = await executor.execute(
        'read_file',
        { path: 'src/index.ts' },
        projectRoot,
      )
      expect(result.isError).toBe(false)
      expect(result.content).toBe('export const hello = "world"\n')
    })

    it('should respect maxLines', async () => {
      // 5 lines of content (no trailing newline to avoid off-by-one)
      await writeFile(
        join(projectRoot, 'src', 'multi.ts'),
        'line1\nline2\nline3\nline4\nline5',
      )

      const result = await executor.execute(
        'read_file',
        { path: 'src/multi.ts', maxLines: 2 },
        projectRoot,
      )
      expect(result.isError).toBe(false)
      expect(result.content).toContain('line1')
      expect(result.content).toContain('line2')
      expect(result.content).toContain('3 more lines')
      expect(result.content).not.toContain('line3')
    })

    it('should handle trailing newline in maxLines count', async () => {
      // With trailing newline: 5 real lines + empty = 5 counted
      await writeFile(
        join(projectRoot, 'src', 'trailing.ts'),
        'a\nb\nc\nd\ne\n',
      )

      const result = await executor.execute(
        'read_file',
        { path: 'src/trailing.ts', maxLines: 2 },
        projectRoot,
      )
      expect(result.isError).toBe(false)
      expect(result.content).toContain('3 more lines')
    })

    it('should error on non-existent file', async () => {
      const result = await executor.execute(
        'read_file',
        { path: 'src/nonexistent.ts' },
        projectRoot,
      )
      expect(result.isError).toBe(true)
    })
  })

  // ─── list_directory ───────────────────────────────────────────────────

  describe('list_directory', () => {
    it('should list directory contents', async () => {
      const result = await executor.execute(
        'list_directory',
        { path: '.' },
        projectRoot,
      )
      expect(result.isError).toBe(false)
      expect(result.content).toContain('src/')
      expect(result.content).toContain('package.json')
    })

    it('should list subdirectory', async () => {
      const result = await executor.execute(
        'list_directory',
        { path: 'src' },
        projectRoot,
      )
      expect(result.isError).toBe(false)
      expect(result.content).toContain('index.ts')
      expect(result.content).toContain('utils/')
    })

    it('should filter out hidden files and node_modules', async () => {
      await mkdir(join(projectRoot, 'node_modules'), { recursive: true })
      await mkdir(join(projectRoot, '.git'), { recursive: true })

      const result = await executor.execute(
        'list_directory',
        { path: '.' },
        projectRoot,
      )
      expect(result.content).not.toContain('node_modules')
      expect(result.content).not.toContain('.git')
    })
  })

  // ─── write_file ───────────────────────────────────────────────────────

  describe('write_file', () => {
    it('should write file and create parent dirs', async () => {
      const result = await executor.execute(
        'write_file',
        { path: 'src/new/deep/file.ts', content: 'export const x = 1' },
        projectRoot,
      )
      expect(result.isError).toBe(false)
      expect(result.content).toContain('Written')

      // Verify file exists
      const readBack = await executor.execute(
        'read_file',
        { path: 'src/new/deep/file.ts' },
        projectRoot,
      )
      expect(readBack.content).toBe('export const x = 1')
    })
  })

  // ─── bash ─────────────────────────────────────────────────────────────

  describe('bash', () => {
    it('should allow whitelisted npm commands', async () => {
      // npm --version works cross-platform and is prefixed with 'npm '
      // But it's not in allowlist. Use 'npx tsc --version' which is.
      const result = await executor.execute(
        'bash',
        { command: 'npx tsc --version' },
        projectRoot,
      )
      // May succeed or fail depending on tsc install, but should NOT be blocked
      // The key test: it was not blocked by allowlist
      expect(result.content).not.toContain('not allowed')
    })

    it('should block non-whitelisted commands', async () => {
      const result = await executor.execute(
        'bash',
        { command: 'rm -rf /' },
        projectRoot,
      )
      expect(result.isError).toBe(true)
      expect(result.content).toContain('not allowed')
    })

    it('should block curl/wget', async () => {
      const result = await executor.execute(
        'bash',
        { command: 'curl https://evil.com' },
        projectRoot,
      )
      expect(result.isError).toBe(true)
      expect(result.content).toContain('not allowed')
    })

    it('should allow git commands', async () => {
      // git --version works cross-platform
      const result = await executor.execute(
        'bash',
        { command: 'git status' },
        projectRoot,
      )
      // Won't be blocked by allowlist (may fail if not a git repo, that's fine)
      expect(result.content).not.toContain('not allowed')
    })
  })

  // ─── save_artifact ────────────────────────────────────────────────────

  describe('save_artifact', () => {
    it('should save and retrieve artifacts', async () => {
      const result = await executor.execute(
        'save_artifact',
        { filename: 'plan.json', content: '{"task":"test"}' },
        projectRoot,
      )
      expect(result.isError).toBe(false)
      expect(result.content).toContain('plan.json')

      const artifacts = executor.getArtifacts()
      expect(artifacts.get('plan.json')).toBe('{"task":"test"}')
    })

    it('should clear artifacts', async () => {
      await executor.execute(
        'save_artifact',
        { filename: 'test.md', content: 'hello' },
        projectRoot,
      )

      executor.clearArtifacts()
      expect(executor.getArtifacts().size).toBe(0)
    })
  })

  // ─── search_code (pure Node.js) ───────────────────────────────────────

  describe('search_code', () => {
    it('should find pattern in files', async () => {
      const result = await executor.execute(
        'search_code',
        { pattern: 'hello', path: '.' },
        projectRoot,
      )
      expect(result.isError).toBe(false)
      expect(result.content).toContain('index.ts')
      expect(result.content).toContain('hello')
    })

    it('should return line numbers', async () => {
      const result = await executor.execute(
        'search_code',
        { pattern: 'hello', path: '.' },
        projectRoot,
      )
      expect(result.isError).toBe(false)
      // Format: relative/path.ts:lineNum:lineContent
      expect(result.content).toMatch(/index\.ts:\d+:/)
    })

    it('should search in subdirectories', async () => {
      const result = await executor.execute(
        'search_code',
        { pattern: 'add', path: '.' },
        projectRoot,
      )
      expect(result.isError).toBe(false)
      expect(result.content).toContain('helpers.ts')
    })

    it('should return no matches message', async () => {
      const result = await executor.execute(
        'search_code',
        { pattern: 'zzz_nonexistent_zzz', path: '.' },
        projectRoot,
      )
      expect(result.isError).toBe(false)
      expect(result.content).toContain('No matches')
    })

    it('should filter by file extension', async () => {
      await writeFile(join(projectRoot, 'readme.md'), 'hello from markdown\n')

      const result = await executor.execute(
        'search_code',
        { pattern: 'hello', path: '.', fileGlob: '.md' },
        projectRoot,
      )
      expect(result.isError).toBe(false)
      expect(result.content).toContain('readme.md')
      expect(result.content).not.toContain('index.ts')
    })

    it('should respect maxResults', async () => {
      // Create multiple files with matches
      for (let i = 0; i < 10; i++) {
        await writeFile(
          join(projectRoot, 'src', `file${i}.ts`),
          `export const val${i} = "match_target"\n`,
        )
      }

      const result = await executor.execute(
        'search_code',
        { pattern: 'match_target', path: '.', maxResults: 3 },
        projectRoot,
      )
      expect(result.isError).toBe(false)
      const lines = result.content.split('\n').filter(Boolean)
      expect(lines.length).toBeLessThanOrEqual(3)
    })

    it('should skip node_modules', async () => {
      await mkdir(join(projectRoot, 'node_modules', 'pkg'), { recursive: true })
      await writeFile(
        join(projectRoot, 'node_modules', 'pkg', 'index.js'),
        'const hello = "from_node_modules"\n',
      )

      const result = await executor.execute(
        'search_code',
        { pattern: 'from_node_modules', path: '.' },
        projectRoot,
      )
      expect(result.content).toContain('No matches')
    })
  })

  // ─── Unknown tool ─────────────────────────────────────────────────────

  describe('unknown tool', () => {
    it('should return error for unknown tool', async () => {
      const result = await executor.execute(
        'fly_to_moon',
        {},
        projectRoot,
      )
      expect(result.isError).toBe(true)
      expect(result.content).toContain('Unknown tool')
    })
  })
})
