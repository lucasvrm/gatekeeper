/**
 * Agent ↔ Orchestrator Bridge
 *
 * Implements the same pipeline operations as gatekeeper-orchestrator
 * (generatePlan, generateSpec, fixArtifacts, execute) but uses
 * AgentRunnerService under the hood for multi-provider, tool-based execution.
 *
 * Key responsibilities:
 *   1. Artifact persistence to disk (workspace.artifactsDir/{outputId}/)
 *   2. DB-driven prompt assembly (PromptInstruction table, managed via CRUD)
 *   3. Session context integration (git strategy, MCP prompts)
 *   4. Event translation (agent events → orchestrator SSE events)
 *   5. outputId generation and lifecycle management
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { PrismaClient } from '@prisma/client'
import { LLMProviderRegistry } from './providers/LLMProviderRegistry.js'
import { AgentToolExecutor, READ_TOOLS, WRITE_TOOLS, SAVE_ARTIFACT_TOOL } from './AgentToolExecutor.js'
import { AgentRunnerService } from './AgentRunnerService.js'
import { AgentPromptAssembler } from './AgentPromptAssembler.js'
import type {
  PhaseConfig,
  AgentEvent,
  AgentResult,
  ProviderName,
  TokenUsage,
} from '../types/agent.types.js'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface BridgeCallbacks {
  onEvent?: (event: AgentEvent) => void
}

/** Mirrors gatekeeper-orchestrator GeneratePlanInput */
export interface BridgePlanInput {
  taskDescription: string
  taskType?: string
  projectPath: string
  profileId?: string
  provider?: ProviderName
  model?: string
}

export interface BridgePlanOutput {
  outputId: string
  artifacts: Array<{ filename: string; content: string }>
  tokensUsed: TokenUsage
  agentResult: AgentResult
}

/** Mirrors gatekeeper-orchestrator GenerateSpecInput */
export interface BridgeSpecInput {
  outputId: string
  projectPath: string
  profileId?: string
  provider?: ProviderName
  model?: string
}

export interface BridgeSpecOutput {
  artifacts: Array<{ filename: string; content: string }>
  tokensUsed: TokenUsage
  agentResult: AgentResult
}

/** Mirrors gatekeeper-orchestrator ExecuteInput */
export interface BridgeExecuteInput {
  outputId: string
  projectPath: string
  provider?: ProviderName
  model?: string
}

export interface BridgeExecuteOutput {
  artifacts: Array<{ filename: string; content: string }>
  tokensUsed: TokenUsage
  agentResult: AgentResult
}

/** Mirrors gatekeeper-orchestrator FixArtifactsInput */
export interface BridgeFixInput {
  outputId: string
  projectPath: string
  target: 'plan' | 'spec'
  failedValidators: string[]
  rejectionReport?: string
  runId?: string
  profileId?: string
  provider?: ProviderName
  model?: string
}

export interface BridgeFixOutput {
  artifacts: Array<{ filename: string; content: string }>
  corrections: string[]
  tokensUsed: TokenUsage
  agentResult: AgentResult
}

export interface SessionContext {
  gitStrategy: string
  customInstructions: string
}

// ─── Bridge Service ────────────────────────────────────────────────────────

export class AgentOrchestratorBridge {
  private registry: LLMProviderRegistry
  private assembler: AgentPromptAssembler

  constructor(
    private prisma: PrismaClient,
    private gatekeeperApiUrl: string,
  ) {
    this.registry = LLMProviderRegistry.fromEnv()
    this.assembler = new AgentPromptAssembler(prisma)
  }

  // ─── Step 1: Generate Plan ───────────────────────────────────────────

  async generatePlan(
    input: BridgePlanInput,
    callbacks: BridgeCallbacks = {},
  ): Promise<BridgePlanOutput> {
    const outputId = this.generateOutputId(input.taskDescription)
    const emit = callbacks.onEvent ?? (() => {})

    emit({ type: 'agent:bridge_start', step: 1, outputId } as AgentEvent)

    // Resolve phase config
    const phase = await this.resolvePhaseConfig(1, input.provider, input.model)

    // Build system prompt from DB + session context
    const sessionContext = await this.fetchSessionContext(input.profileId)
    const basePrompt = await this.safeAssembleForStep(1)
    let systemPrompt = this.enrichPrompt(basePrompt, sessionContext)

    // Run agent
    const toolExecutor = new AgentToolExecutor()
    await toolExecutor.loadSafetyConfig()
    const runner = new AgentRunnerService(this.registry, toolExecutor)

    let userMessage: string
    let tools = [...READ_TOOLS, SAVE_ARTIFACT_TOOL]
    let outputDir: string | undefined

    if (this.isClaudeCode(phase)) {
      // Claude Code: write files directly via its Write tool
      outputDir = await this.resolveOutputDir(outputId, input.projectPath)
      systemPrompt += `\n\nIMPORTANT: You must write each artifact as a file using your Write tool.\nWrite artifacts to this directory: ${outputDir}/\nRequired files: plan.json, contract.md, task.spec.md`
      userMessage = this.buildPlanUserMessage(input.taskDescription, outputId, input.taskType)
        .replace('Use the save_artifact tool for each one.', `Write each artifact file to: ${outputDir}/`)
      tools = [...READ_TOOLS] // no save_artifact for claude-code
    } else {
      userMessage = this.buildPlanUserMessage(input.taskDescription, outputId, input.taskType)
    }

    const result = await runner.run({
      phase,
      systemPrompt,
      userMessage,
      tools,
      projectRoot: input.projectPath,
      onEvent: emit,
    })

    // Collect artifacts
    let memoryArtifacts = toolExecutor.getArtifacts()

    if (memoryArtifacts.size === 0 && this.isClaudeCode(phase) && outputDir) {
      // Claude Code wrote files directly — read them from disk
      console.log(`[Bridge] Claude Code: scanning ${outputDir} for artifacts...`)
      memoryArtifacts = this.readArtifactsFromDir(outputDir)
      console.log(`[Bridge] Found ${memoryArtifacts.size} file(s) on disk`)
    }

    if (memoryArtifacts.size === 0 && result.text) {
      // Fallback: try parsing artifacts from text response
      console.log('[Bridge] No artifacts found, trying text parse fallback...')
      memoryArtifacts = this.parseArtifactsFromText(result.text)
      console.log(`[Bridge] Parsed ${memoryArtifacts.size} artifact(s) from text`)
    }

    // Persist artifacts to disk
    const artifacts = await this.persistArtifacts(
      memoryArtifacts,
      outputId,
      input.projectPath,
    )

    emit({
      type: 'agent:bridge_complete',
      step: 1,
      outputId,
      artifactNames: artifacts.map((a) => a.filename),
    } as AgentEvent)

    return { outputId, artifacts, tokensUsed: result.tokensUsed, agentResult: result }
  }

  // ─── Step 2: Generate Spec ───────────────────────────────────────────

  async generateSpec(
    input: BridgeSpecInput,
    callbacks: BridgeCallbacks = {},
  ): Promise<BridgeSpecOutput> {
    const emit = callbacks.onEvent ?? (() => {})

    emit({ type: 'agent:bridge_start', step: 2, outputId: input.outputId } as AgentEvent)

    // Read existing artifacts from disk
    const existingArtifacts = await this.readArtifactsFromDisk(input.outputId, input.projectPath)

    if (!existingArtifacts['plan.json'] || !existingArtifacts['contract.md'] || !existingArtifacts['task.spec.md']) {
      const missing = ['plan.json', 'contract.md', 'task.spec.md']
        .filter((f) => !existingArtifacts[f])
      throw new BridgeError(
        `Missing step 1 artifacts: ${missing.join(', ')}`,
        'MISSING_ARTIFACTS',
        { missing, outputId: input.outputId },
      )
    }

    const phase = await this.resolvePhaseConfig(2, input.provider, input.model)
    const sessionContext = await this.fetchSessionContext(input.profileId)
    const basePrompt = await this.safeAssembleForStep(2)
    let systemPrompt = this.enrichPrompt(basePrompt, sessionContext)

    const toolExecutor = new AgentToolExecutor()
    await toolExecutor.loadSafetyConfig()
    const runner = new AgentRunnerService(this.registry, toolExecutor)

    let userMessage = this.buildSpecUserMessage(input.outputId, existingArtifacts)
    let tools = [...READ_TOOLS, SAVE_ARTIFACT_TOOL]
    let outputDir: string | undefined

    if (this.isClaudeCode(phase)) {
      outputDir = await this.resolveOutputDir(input.outputId, input.projectPath)
      systemPrompt += `\n\nIMPORTANT: Write test file(s) using your Write tool to: ${outputDir}/`
      userMessage = userMessage.replace(
        'Use the save_artifact tool to save the test file.',
        `Write the test file to: ${outputDir}/`,
      )
      tools = [...READ_TOOLS]
    }

    const result = await runner.run({
      phase,
      systemPrompt,
      userMessage,
      tools,
      projectRoot: input.projectPath,
      onEvent: emit,
    })

    let memoryArtifacts = toolExecutor.getArtifacts()

    if (memoryArtifacts.size === 0 && this.isClaudeCode(phase) && outputDir) {
      console.log(`[Bridge] Claude Code spec: scanning ${outputDir} for new artifacts...`)
      memoryArtifacts = this.readArtifactsFromDir(outputDir)
      // Filter to only new spec files (exclude plan artifacts)
      const existingNames = new Set(Object.keys(existingArtifacts))
      const specOnly = new Map<string, string>()
      for (const [name, content] of memoryArtifacts) {
        if (!existingNames.has(name)) specOnly.set(name, content)
      }
      if (specOnly.size > 0) memoryArtifacts = specOnly
      console.log(`[Bridge] Found ${memoryArtifacts.size} new spec file(s)`)
    }

    if (memoryArtifacts.size === 0 && result.text) {
      console.log('[Bridge] No spec artifacts found, trying text parse fallback...')
      memoryArtifacts = this.parseArtifactsFromText(result.text)
    }

    const artifacts = await this.persistArtifacts(
      memoryArtifacts,
      input.outputId,
      input.projectPath,
    )

    emit({
      type: 'agent:bridge_complete',
      step: 2,
      outputId: input.outputId,
      artifactNames: artifacts.map((a) => a.filename),
    } as AgentEvent)

    return { artifacts, tokensUsed: result.tokensUsed, agentResult: result }
  }

  // ─── Step 4: Execute ─────────────────────────────────────────────────

  async execute(
    input: BridgeExecuteInput,
    callbacks: BridgeCallbacks = {},
  ): Promise<BridgeExecuteOutput> {
    const emit = callbacks.onEvent ?? (() => {})

    emit({ type: 'agent:bridge_start', step: 4, outputId: input.outputId } as AgentEvent)

    const existingArtifacts = await this.readArtifactsFromDisk(input.outputId, input.projectPath)

    if (Object.keys(existingArtifacts).length === 0) {
      throw new BridgeError(
        `No artifacts found for ${input.outputId}`,
        'MISSING_ARTIFACTS',
        { outputId: input.outputId },
      )
    }

    const phase = await this.resolvePhaseConfig(4, input.provider, input.model)
    const basePrompt = await this.safeAssembleForStep(4)
    const sessionContext = await this.fetchSessionContext()
    const systemPrompt = this.enrichPrompt(basePrompt, sessionContext)

    const toolExecutor = new AgentToolExecutor()
    await toolExecutor.loadSafetyConfig()
    const runner = new AgentRunnerService(this.registry, toolExecutor)

    const userMessage = this.buildExecuteUserMessage(input.outputId, existingArtifacts)

    const result = await runner.run({
      phase,
      systemPrompt,
      userMessage,
      tools: [...READ_TOOLS, ...WRITE_TOOLS, SAVE_ARTIFACT_TOOL],
      projectRoot: input.projectPath,
      onEvent: emit,
    })

    // Coder may save artifacts too (e.g. implementation notes)
    const artifacts = await this.persistArtifacts(
      toolExecutor.getArtifacts(),
      input.outputId,
      input.projectPath,
    )

    emit({
      type: 'agent:bridge_complete',
      step: 4,
      outputId: input.outputId,
      artifactNames: artifacts.map((a) => a.filename),
    } as AgentEvent)

    return { artifacts, tokensUsed: result.tokensUsed, agentResult: result }
  }

  // ─── Fix: Correction after rejection ─────────────────────────────────

  async fixArtifacts(
    input: BridgeFixInput,
    callbacks: BridgeCallbacks = {},
  ): Promise<BridgeFixOutput> {
    const emit = callbacks.onEvent ?? (() => {})

    emit({ type: 'agent:bridge_start', step: 3, outputId: input.outputId } as AgentEvent)

    const existingArtifacts = await this.readArtifactsFromDisk(input.outputId, input.projectPath)

    // Fetch rejection report from API if we have a runId
    let rejectionReport = input.rejectionReport || ''
    if (!rejectionReport && input.runId) {
      rejectionReport = await this.fetchRejectionReport(input.runId)
    }

    const phase = await this.resolvePhaseConfig(
      input.target === 'plan' ? 1 : 2,
      input.provider,
      input.model,
    )
    const sessionContext = await this.fetchSessionContext(input.profileId)
    const basePrompt = await this.safeAssembleForStep(3)
    const systemPrompt = this.enrichPrompt(basePrompt, sessionContext)

    const toolExecutor = new AgentToolExecutor()
    await toolExecutor.loadSafetyConfig()
    const runner = new AgentRunnerService(this.registry, toolExecutor)

    const userMessage = this.buildFixUserMessage(
      input.target,
      input.outputId,
      existingArtifacts,
      rejectionReport,
      input.failedValidators,
    )

    const result = await runner.run({
      phase,
      systemPrompt,
      userMessage,
      tools: [...READ_TOOLS, SAVE_ARTIFACT_TOOL],
      projectRoot: input.projectPath,
      onEvent: emit,
    })

    const artifacts = await this.persistArtifacts(
      toolExecutor.getArtifacts(),
      input.outputId,
      input.projectPath,
    )

    // Extract corrections from the response text
    const corrections = result.text
      .split('\n')
      .filter((line) => line.trim().startsWith('-') || line.trim().startsWith('•'))
      .map((line) => line.trim())

    emit({
      type: 'agent:bridge_complete',
      step: 3,
      outputId: input.outputId,
      artifactNames: artifacts.map((a) => a.filename),
    } as AgentEvent)

    return {
      artifacts,
      corrections: corrections.length > 0
        ? corrections
        : ['Artifacts corrected (see agent output for details)'],
      tokensUsed: result.tokensUsed,
      agentResult: result,
    }
  }

  // ─── Artifact Persistence ────────────────────────────────────────────

  /**
   * Find the workspace/monorepo root by walking up from projectPath.
   * Looks for .git directory or root package.json with workspaces field.
   * Falls back to checking the Workspace model in DB.
   */
  private async resolveWorkspaceRoot(projectPath: string): Promise<string> {
    // 1. Try DB: Workspace whose rootPath is a parent of projectPath
    try {
      const workspaces = await this.prisma.workspace.findMany({
        where: { isActive: true },
      })
      for (const ws of workspaces) {
        const normalizedRoot = path.resolve(ws.rootPath)
        const normalizedProject = path.resolve(projectPath)
        if (normalizedProject.startsWith(normalizedRoot)) {
          return normalizedRoot
        }
      }
    } catch {
      // DB may not have workspaces — fall through
    }

    // 2. Walk up to find .git or root package.json with "workspaces"
    let current = path.resolve(projectPath)
    const root = path.parse(current).root

    while (current !== root) {
      // Check for .git
      if (fs.existsSync(path.join(current, '.git'))) {
        return current
      }
      // Check for root package.json with workspaces
      const pkgPath = path.join(current, 'package.json')
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
          if (pkg.workspaces) return current
        } catch {
          // ignore parse errors
        }
      }
      current = path.dirname(current)
    }

    // 3. Fallback: use projectPath itself
    return projectPath
  }

  /**
   * Resolve the artifacts directory name from Workspace model.
   * Falls back to "artifacts".
   */
  private async resolveArtifactsDirName(workspaceRoot: string): Promise<string> {
    try {
      const workspace = await this.prisma.workspace.findFirst({
        where: { rootPath: workspaceRoot, isActive: true },
      })
      return workspace?.artifactsDir || 'artifacts'
    } catch {
      return 'artifacts'
    }
  }

  /**
   * Persist in-memory artifacts to disk.
   * Directory: {workspaceRoot}/{artifactsDir}/{outputId}/
   */
  private async persistArtifacts(
    memoryArtifacts: Map<string, string>,
    outputId: string,
    projectPath: string,
  ): Promise<Array<{ filename: string; content: string }>> {
    if (memoryArtifacts.size === 0) return []

    const workspaceRoot = await this.resolveWorkspaceRoot(projectPath)
    const artifactsDirName = await this.resolveArtifactsDirName(workspaceRoot)
    const outputDir = path.join(workspaceRoot, artifactsDirName, outputId)
    fs.mkdirSync(outputDir, { recursive: true })

    const result: Array<{ filename: string; content: string }> = []

    for (const [filename, content] of memoryArtifacts) {
      const filePath = path.join(outputDir, filename)
      // Create parent directories if filename contains path separators
      // e.g. "src/__tests__/file.spec.ts" → creates artifacts/{outputId}/src/__tests__/
      const fileDir = path.dirname(filePath)
      if (fileDir !== outputDir) {
        fs.mkdirSync(fileDir, { recursive: true })
      }
      fs.writeFileSync(filePath, content, 'utf-8')
      result.push({ filename, content })
      console.log(`[Bridge] Artifact saved: ${filePath}`)
    }

    return result
  }

  /**
   * Read artifacts from disk for a given outputId.
   * Reads recursively to support nested filenames (e.g. src/__tests__/file.spec.ts).
   */
  async readArtifactsFromDisk(
    outputId: string,
    projectPath: string,
  ): Promise<Record<string, string>> {
    const workspaceRoot = await this.resolveWorkspaceRoot(projectPath)
    const artifactsDirName = await this.resolveArtifactsDirName(workspaceRoot)
    const outputDir = path.join(workspaceRoot, artifactsDirName, outputId)

    try {
      const result: Record<string, string> = {}

      const readDir = (dir: string, prefix: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          const relativeName = prefix ? `${prefix}/${entry.name}` : entry.name
          if (entry.isDirectory()) {
            readDir(path.join(dir, entry.name), relativeName)
          } else {
            result[relativeName] = fs.readFileSync(path.join(dir, entry.name), 'utf-8')
          }
        }
      }

      readDir(outputDir, '')
      return result
    } catch {
      return {}
    }
  }

  /**
   * Get the full path to the artifacts directory for an outputId.
   * Exposed for the controller to use when serving artifact reads.
   */
  async getArtifactsPath(outputId: string, projectPath: string): Promise<string> {
    const workspaceRoot = await this.resolveWorkspaceRoot(projectPath)
    const artifactsDirName = await this.resolveArtifactsDirName(workspaceRoot)
    return path.join(workspaceRoot, artifactsDirName, outputId)
  }


  // ─── Claude Code Helpers ──────────────────────────────────────────

  private static readonly FALLBACK_PROMPTS: Record<number, string> = {
    1: [
      'You are a senior software architect and TDD planning assistant.',
      'Analyze the codebase and produce these artifacts:',
      '- plan.json: implementation plan with files, dependencies, and steps',
      '- contract.md: behavioral contract describing inputs, outputs, and constraints',
      '- task.spec.md: human-readable specification of the task',
      'Be thorough but concise. Focus on testable behaviors.',
    ].join('\n'),
    2: [
      'You are a senior test engineer.',
      'Generate comprehensive test files based on the plan and contract provided.',
      'Follow existing project test conventions. Cover edge cases.',
    ].join('\n'),
    3: [
      'You are a senior software engineer fixing rejected artifacts.',
      'Correct the artifacts based on the failed validators and rejection report.',
    ].join('\n'),
    4: [
      'You are a senior software engineer.',
      'Implement the code to make all tests pass.',
      'Follow existing project conventions and patterns.',
    ].join('\n'),
  }

  /**
   * Safely assemble a system prompt for a pipeline step.
   * Never throws — falls back to a hardcoded default if the assembler fails.
   */
  private async safeAssembleForStep(step: number): Promise<string> {
    try {
      const prompt = await this.assembler.assembleForStep(step)
      if (prompt && prompt.trim()) return prompt
    } catch (err) {
      console.warn(`[Bridge] assembleForStep(${step}) threw:`, err)
    }
    console.log(`[Bridge] Using hardcoded fallback prompt for step ${step}`)
    return AgentOrchestratorBridge.FALLBACK_PROMPTS[step]
      || 'You are a helpful software engineering assistant.'
  }

  /**
   * Whether the resolved phase config uses Claude Code CLI provider.
   */
  private isClaudeCode(phase: PhaseConfig): boolean {
    return phase.provider === 'claude-code'
  }

  /**
   * Pre-create and return the output directory for artifacts.
   * Used when Claude Code needs to write files directly via its Write tool.
   */
  private async resolveOutputDir(outputId: string, projectPath: string): Promise<string> {
    const workspaceRoot = await this.resolveWorkspaceRoot(projectPath)
    const artifactsDirName = await this.resolveArtifactsDirName(workspaceRoot)
    const outputDir = path.join(workspaceRoot, artifactsDirName, outputId)
    fs.mkdirSync(outputDir, { recursive: true })
    return outputDir
  }

  /**
   * Read artifacts that Claude Code wrote to disk via its Write tool.
   * Converts the disk files to the same format as toolExecutor.getArtifacts().
   */
  private readArtifactsFromDir(outputDir: string): Map<string, string> {
    const result = new Map<string, string>()
    try {
      const readDir = (dir: string, prefix: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          const name = prefix ? `${prefix}/${entry.name}` : entry.name
          if (entry.isDirectory()) {
            readDir(path.join(dir, entry.name), name)
          } else {
            result.set(name, fs.readFileSync(path.join(dir, entry.name), 'utf-8'))
          }
        }
      }
      readDir(outputDir, '')
    } catch {
      // Directory might not exist yet or be empty
    }
    return result
  }

  /**
   * Parse artifacts from Claude Code's text response as a fallback.
   * Looks for fenced code blocks with filenames.
   * Pattern: ```filename or ```json // filename
   */
  private parseArtifactsFromText(text: string): Map<string, string> {
    const result = new Map<string, string>()
    // Match patterns like: ```plan.json or ```json plan.json or === plan.json ===
    const regex = /(?:^|\n)(?:={3,}\s*([\w.-]+)\s*={3,}|`{3}(?:\w+\s+)?([\w.-]+)\s*\n)([\s\S]*?)(?:`{3}|={3,}|$)/g
    let match
    while ((match = regex.exec(text)) !== null) {
      const filename = match[1] || match[2]
      const content = match[3]?.trim()
      if (filename && content) {
        result.set(filename, content)
      }
    }
    return result
  }
  // ─── Phase Config ────────────────────────────────────────────────────

  /**
   * Resolve PhaseConfig from DB + optional overrides.
   */
  private async resolvePhaseConfig(
    step: number,
    providerOverride?: ProviderName,
    modelOverride?: string,
  ): Promise<PhaseConfig> {
    const dbConfig = await this.prisma.agentPhaseConfig.findUnique({
      where: { step },
    })

    return {
      step,
      provider: (providerOverride ?? dbConfig?.provider ?? 'anthropic') as ProviderName,
      model: modelOverride ?? dbConfig?.model ?? 'claude-sonnet-4-5-20250929',
      maxTokens: dbConfig?.maxTokens ?? 8192,
      maxIterations: dbConfig?.maxIterations ?? 30,
      maxInputTokensBudget: dbConfig?.maxInputTokensBudget ?? 0,
      temperature: dbConfig?.temperature ?? undefined,
      fallbackProvider: dbConfig?.fallbackProvider as ProviderName | undefined,
      fallbackModel: dbConfig?.fallbackModel ?? undefined,
    }
  }

  // ─── Session Context ─────────────────────────────────────────────────

  /**
   * Fetch session context from the Gatekeeper API (same as gatekeeper-orchestrator).
   */
  private async fetchSessionContext(profileId?: string): Promise<SessionContext> {
    let gitStrategy = ''
    let customInstructions = ''

    try {
      const sessionRes = await fetch(`${this.gatekeeperApiUrl}/mcp/session`)
      if (!sessionRes.ok) throw new Error(`HTTP ${sessionRes.status}`)

      const session = (await sessionRes.json()) as Record<string, unknown>
      const config = session.config as Record<string, string> | undefined

      // Git strategy
      if (config?.gitStrategy === 'new-branch') {
        const branch = config.branch || 'feature/task'
        gitStrategy = `\n## Git Strategy\nCrie uma nova branch antes de implementar: ${branch}\n`
      } else if (config?.gitStrategy === 'existing-branch' && config.branch) {
        gitStrategy = `\n## Git Strategy\nUse a branch existente: ${config.branch}\n`
      } else {
        gitStrategy = `\n## Git Strategy\nCommit direto na branch atual.\n`
      }

      // Resolve prompts from active profile
      const activeProfileId = profileId || config?.activeProfileId
      let activePrompts: Array<{ name: string; content: string; isActive: boolean }> = []

      if (activeProfileId) {
        try {
          const profileRes = await fetch(`${this.gatekeeperApiUrl}/mcp/profiles/${activeProfileId}`)
          if (profileRes.ok) {
            const profile = (await profileRes.json()) as Record<string, unknown>
            const prompts = profile.prompts as Array<{ name: string; content: string; isActive: boolean }> | undefined
            activePrompts = prompts?.filter((p) => p.isActive) || []
          }
        } catch {
          // fallback below
        }
      }

      if (activePrompts.length === 0) {
        try {
          const promptsRes = await fetch(`${this.gatekeeperApiUrl}/mcp/prompts`)
          if (promptsRes.ok) {
            const promptsData = (await promptsRes.json()) as { data?: Array<{ name: string; content: string; isActive: boolean }> }
            activePrompts = (promptsData.data || []).filter((p) => p.isActive)
          }
        } catch {
          // ignore
        }
      }

      if (activePrompts.length > 0) {
        customInstructions += `\n## Instruções Adicionais\n`
        for (const p of activePrompts) {
          customInstructions += `### ${p.name}\n${p.content}\n\n`
        }
      }
    } catch {
      // API offline — continue without session context
    }

    return { gitStrategy, customInstructions }
  }

  /**
   * Enrich a base system prompt with session context.
   */
  private enrichPrompt(basePrompt: string, session: SessionContext): string {
    const parts = [basePrompt]
    if (session.gitStrategy) parts.push(session.gitStrategy)
    if (session.customInstructions) parts.push(session.customInstructions)
    return parts.join('\n\n')
  }

  // ─── User Message Builders ───────────────────────────────────────────

  private buildPlanUserMessage(
    taskDescription: string,
    outputId: string,
    taskType?: string,
  ): string {
    const parts = [
      `## Task`,
      `**Description:** ${taskDescription}`,
      taskType ? `**Type:** ${taskType}` : '',
      `**Output ID:** ${outputId}`,
      ``,
      `Analyze the codebase and produce the plan artifacts: plan.json, contract.md, task.spec.md.`,
      `Use the save_artifact tool for each one.`,
    ]
    return parts.filter(Boolean).join('\n')
  }

  private buildSpecUserMessage(
    outputId: string,
    artifacts: Record<string, string>,
  ): string {
    const artifactBlocks = Object.entries(artifacts)
      .map(([name, content]) => `### ${name}\n\`\`\`\n${content}\n\`\`\``)
      .join('\n\n')

    return [
      `## Output ID: ${outputId}`,
      `## Artifacts from Step 1`,
      artifactBlocks,
      ``,
      `Explore the project to understand testing conventions, then generate the complete test file.`,
      `Use the save_artifact tool to save the test file.`,
    ].join('\n\n')
  }

  private buildExecuteUserMessage(
    outputId: string,
    artifacts: Record<string, string>,
  ): string {
    const artifactBlocks = Object.entries(artifacts)
      .map(([name, content]) => `### ${name}\n\`\`\`\n${content}\n\`\`\``)
      .join('\n\n')

    return [
      `## Output ID: ${outputId}`,
      `## Approved Artifacts`,
      artifactBlocks,
      ``,
      `Implement the code to make all tests pass.`,
      `Use write_file to create/modify files and bash to run tests.`,
    ].join('\n\n')
  }

  private buildFixUserMessage(
    target: 'plan' | 'spec',
    outputId: string,
    artifacts: Record<string, string>,
    rejectionReport: string,
    failedValidators: string[],
  ): string {
    const artifactBlocks = Object.entries(artifacts)
      .map(([name, content]) => `### ${name}\n\`\`\`\n${content}\n\`\`\``)
      .join('\n\n')

    return [
      `## Target: ${target === 'plan' ? 'Planning artifacts' : 'Test file'}`,
      `## Output ID: ${outputId}`,
      `## Failed Validators\n${failedValidators.map((v) => `- \`${v}\``).join('\n')}`,
      rejectionReport ? `## Rejection Report\n\n${rejectionReport}` : '',
      `## Current Artifacts\n\n${artifactBlocks}`,
      ``,
      `Fix the artifacts to address the failed validators. Use save_artifact for each corrected file.`,
    ].filter(Boolean).join('\n\n')
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  /**
   * Generate an outputId (same format as gatekeeper-orchestrator ArtifactManager).
   */
  private generateOutputId(taskDescription: string): string {
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const nnn = String(Math.floor(Math.random() * 900) + 100)
    const slug = taskDescription
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 40)
      .replace(/-$/, '')
    return `${yyyy}_${mm}_${dd}_${nnn}_${slug}`
  }

  /**
   * Fetch rejection report from Gatekeeper API.
   */
  private async fetchRejectionReport(runId: string): Promise<string> {
    try {
      const res = await fetch(`${this.gatekeeperApiUrl}/runs/${runId}/results`)
      if (!res.ok) return `[Failed to fetch run results: HTTP ${res.status}]`

      const run = (await res.json()) as Record<string, unknown>
      let report = `## Run: ${runId}\nStatus: ${run.status}\n\n`

      const gateResults = run.gateResults as Array<{ passed: boolean; gateNumber: number; gateName: string }> | undefined
      if (gateResults?.length) {
        for (const gate of gateResults) {
          if (!gate.passed) {
            report += `### Gate ${gate.gateNumber}: ${gate.gateName} — FAILED\n`
          }
        }
      }

      const validatorResults = run.validatorResults as Array<{
        passed: boolean; validatorCode: string; message?: string; details?: unknown
      }> | undefined
      if (validatorResults?.length) {
        report += `\n### Failed Validators\n`
        for (const v of validatorResults) {
          if (!v.passed) {
            report += `\n#### ${v.validatorCode}\n`
            report += `Message: ${v.message || 'N/A'}\n`
            if (v.details) {
              report += `Details:\n\`\`\`\n${typeof v.details === 'string' ? v.details : JSON.stringify(v.details, null, 2)}\n\`\`\`\n`
            }
          }
        }
      }

      return report
    } catch (error) {
      return `[Error fetching rejection report: ${(error as Error).message}]`
    }
  }
}

// ─── Error Class ───────────────────────────────────────────────────────────

export class BridgeError extends Error {
  code: string
  details?: Record<string, unknown>

  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'BridgeError'
    this.code = code
    this.details = details
  }
}
