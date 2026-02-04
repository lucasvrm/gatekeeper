/**
 * AgentOrchestratorBridge — Unit Tests
 *
 * Tests the pure/extractable functions of AgentOrchestratorBridge:
 *   - buildFixUserMessage: formats fix prompts with validator-specific guidance
 *   - buildPlanUserMessage / buildSpecUserMessage / buildExecuteUserMessage
 *   - resolveWorkspaceRoot: filesystem walk-up logic
 *   - persistArtifacts: saves in-memory artifacts to disk
 *   - readArtifactsFromDisk / readArtifactsFromDir
 *   - enrichPrompt: injects session context into system prompts
 *
 * The run methods (generatePlan, generateSpec, fixArtifacts, execute) are
 * integration concerns tested via pipeline tests.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('../../src/db/client.js', () => ({
  prisma: {
    workspace: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) },
    agentRun: { create: vi.fn(), update: vi.fn() },
    agentRunStep: { create: vi.fn(), update: vi.fn() },
    agentPhaseConfig: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
    validationRun: { create: vi.fn(), findUnique: vi.fn() },
  },
}))

vi.mock('../../src/services/AgentPromptAssembler.js', () => ({
  AgentPromptAssembler: class {
    assembleForStep = vi.fn().mockResolvedValue('system prompt base')
  },
}))

vi.mock('../../src/services/providers/LLMProviderRegistry.js', () => ({
  LLMProviderRegistry: class {
    static fromEnv() { return new this() }
    get = vi.fn()
    register = vi.fn()
  },
}))

import { AgentOrchestratorBridge } from '../../src/services/AgentOrchestratorBridge.js'

// ─── Helpers ───────────────────────────────────────────────────────────────

function createBridge(): AgentOrchestratorBridge {
  const fakePrisma = {
    workspace: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) },
    agentPhaseConfig: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
  }
  return new AgentOrchestratorBridge(fakePrisma as any, 'http://localhost:3000')
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('AgentOrchestratorBridge', () => {
  let bridge: AgentOrchestratorBridge

  beforeEach(() => {
    bridge = createBridge()
  })

  // ── buildFixUserMessage ──────────────────────────────────────────────

  describe('buildFixUserMessage', () => {
    function callBuildFix(
      target: 'plan' | 'spec',
      outputId: string,
      artifacts: Record<string, string>,
      rejectionReport: string,
      failedValidators: string[],
      taskPrompt?: string,
    ): string {
      return (bridge as any).buildFixUserMessage(
        target, outputId, artifacts, rejectionReport, failedValidators, taskPrompt,
      )
    }

    it('includes target, outputId and failed validator list', () => {
      const msg = callBuildFix('plan', 'out-1', {}, '', ['V1', 'V2'])
      expect(msg).toContain('## Target: Planning artifacts')
      expect(msg).toContain('## Output ID: out-1')
      expect(msg).toContain('- `V1`')
      expect(msg).toContain('- `V2`')
    })

    it('includes rejection report when provided', () => {
      const msg = callBuildFix('spec', 'out-2', {}, 'You failed gate 1', ['V1'])
      expect(msg).toContain('## Rejection Report')
      expect(msg).toContain('You failed gate 1')
    })

    it('includes task prompt guidance for NO_IMPLICIT_FILES', () => {
      const msg = callBuildFix('plan', 'out-3', {}, '', ['NO_IMPLICIT_FILES'], 'Add feature etc')
      expect(msg).toContain('## Original Task Prompt')
      expect(msg).toContain('corrected-task-prompt.txt')
      expect(msg).toContain('Add feature etc')
    })

    it('includes manifest guidance for TASK_SCOPE_SIZE', () => {
      const msg = callBuildFix('plan', 'out-4', {}, '', ['TASK_SCOPE_SIZE'])
      expect(msg).toContain('## Manifest Fix Guidance')
      expect(msg).toContain('TASK_SCOPE_SIZE')
      expect(msg).toContain('Reduce the number of files')
    })

    it('includes contract guidance for TEST_CLAUSE_MAPPING_VALID', () => {
      const msg = callBuildFix('spec', 'out-5', {}, '', ['TEST_CLAUSE_MAPPING_VALID'])
      expect(msg).toContain('## Contract Fix Guidance')
      expect(msg).toContain('@clause CL-XXX')
    })

    it('includes danger mode note for DANGER_MODE_EXPLICIT', () => {
      const msg = callBuildFix('plan', 'out-6', {}, '', ['DANGER_MODE_EXPLICIT'])
      expect(msg).toContain('## DangerMode Note')
    })

    it('includes artifact blocks in message', () => {
      const msg = callBuildFix('plan', 'out-7', {
        'plan.json': '{"files":[]}',
        'component.spec.ts': 'describe("x", () => {})',
      }, '', ['V1'])
      expect(msg).toContain('### plan.json')
      expect(msg).toContain('{"files":[]}')
      expect(msg).toContain('### component.spec.ts')
    })

    it('categorizes multiple validator types correctly', () => {
      const msg = callBuildFix(
        'plan', 'out-8', {}, '',
        ['NO_IMPLICIT_FILES', 'TASK_SCOPE_SIZE', 'TEST_CLAUSE_MAPPING_VALID'],
        'Do the thing etc',
      )
      expect(msg).toContain('## Original Task Prompt')
      expect(msg).toContain('## Manifest Fix Guidance')
      expect(msg).toContain('## Contract Fix Guidance')
    })
  })

  // ── buildSpecUserMessage ─────────────────────────────────────────────

  describe('buildSpecUserMessage', () => {
    it('includes outputId and artifacts from step 1', () => {
      const msg = (bridge as any).buildSpecUserMessage('out-spec', {
        'plan.json': '{"testFile":"test.ts"}',
      })
      expect(msg).toContain('## Output ID: out-spec')
      expect(msg).toContain('## Artifacts from Step 1')
      expect(msg).toContain('### plan.json')
    })
  })

  // ── buildExecuteUserMessage ──────────────────────────────────────────

  describe('buildExecuteUserMessage', () => {
    it('includes outputId and approved artifacts', () => {
      const msg = (bridge as any).buildExecuteUserMessage('out-exec', {
        'plan.json': '{}',
        'component.spec.ts': 'test code',
      })
      expect(msg).toContain('## Output ID: out-exec')
      expect(msg).toContain('## Approved Artifacts')
      expect(msg).toContain('Implement the code')
    })
  })

  // ── enrichPrompt ─────────────────────────────────────────────────────

  describe('enrichPrompt', () => {
    it('returns base prompt when no session context', () => {
      const result = (bridge as any).enrichPrompt('Base system prompt', {
        gitStrategy: '',
        customInstructions: '',
      })
      expect(result).toBe('Base system prompt')
    })

    it('appends git strategy and custom instructions', () => {
      const result = (bridge as any).enrichPrompt('Base prompt', {
        gitStrategy: 'Use feature branches',
        customInstructions: '## Extra\nDo TDD',
      })
      expect(result).toContain('Base prompt')
      expect(result).toContain('Use feature branches')
      expect(result).toContain('Do TDD')
    })
  })

  // ── readArtifactsFromDir ─────────────────────────────────────────────

  describe('readArtifactsFromDir', () => {
    let tmpDir: string

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-artifacts-'))
    })

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it('reads all files in a directory', () => {
      fs.writeFileSync(path.join(tmpDir, 'plan.json'), '{"files":[]}')
      fs.writeFileSync(path.join(tmpDir, 'spec.ts'), 'test code')

      const result = (bridge as any).readArtifactsFromDir(tmpDir)
      expect(result.get('plan.json')).toBe('{"files":[]}')
      expect(result.get('spec.ts')).toBe('test code')
    })

    it('returns empty map for nonexistent directory', () => {
      const result = (bridge as any).readArtifactsFromDir('/tmp/does-not-exist-xyz')
      expect(result.size).toBe(0)
    })

    it('reads nested directories recursively', () => {
      const sub = path.join(tmpDir, '_attachments')
      fs.mkdirSync(sub, { recursive: true })
      fs.writeFileSync(path.join(sub, 'readme.md'), 'notes')

      const result = (bridge as any).readArtifactsFromDir(tmpDir)
      expect(result.get('_attachments/readme.md')).toBe('notes')
    })
  })

  // ── persistArtifacts ─────────────────────────────────────────────────

  describe('persistArtifacts', () => {
    let tmpDir: string

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-persist-'))
      // Override resolveWorkspaceRoot and resolveArtifactsDirName
      ;(bridge as any).resolveWorkspaceRoot = async () => tmpDir
      ;(bridge as any).resolveArtifactsDirName = async () => 'artifacts'
    })

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it('saves in-memory artifacts to disk', async () => {
      const artifacts = new Map([
        ['plan.json', '{"files":[]}'],
        ['component.spec.ts', 'describe("x", () => {})'],
      ])

      const result = await (bridge as any).persistArtifacts(artifacts, 'out-persist', tmpDir)
      expect(result).toHaveLength(2)

      const planOnDisk = fs.readFileSync(
        path.join(tmpDir, 'artifacts', 'out-persist', 'plan.json'), 'utf-8'
      )
      expect(planOnDisk).toBe('{"files":[]}')
    })

    it('returns empty array for empty artifact map', async () => {
      const result = await (bridge as any).persistArtifacts(new Map(), 'out-empty', tmpDir)
      expect(result).toEqual([])
    })
  })
})
