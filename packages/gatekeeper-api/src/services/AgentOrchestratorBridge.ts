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
import { ArtifactValidationService } from './ArtifactValidationService.js'
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
  /** Pre-generated outputId (allows the caller to know the ID before the plan starts) */
  outputId?: string
  /** Discovery report content to inject into planner context */
  discoveryReportContent?: string
  /** Ad-hoc file attachments for additional context (not persistent config) */
  attachments?: Array<{ name: string; type: string; content: string }>
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
  /** Original task prompt — needed for validators that check taskPrompt (e.g. NO_IMPLICIT_FILES) */
  taskPrompt?: string
  /** User-provided custom instructions to guide the fix */
  customInstructions?: string
}

export interface BridgeFixOutput {
  artifacts: Array<{ filename: string; content: string }>
  corrections: string[]
  tokensUsed: TokenUsage
  agentResult: AgentResult
  /** If the fix addressed taskPrompt-level issues (e.g. NO_IMPLICIT_FILES), this contains the rewritten prompt */
  correctedTaskPrompt?: string
}

/** Discovery step input (substep before planning) */
export interface BridgeDiscoveryInput {
  taskDescription: string
  projectPath: string
  profileId?: string
  provider?: ProviderName
  model?: string
  /** Pre-generated outputId (allows the caller to know the ID before discovery starts) */
  outputId?: string
}

export interface BridgeDiscoveryOutput {
  outputId: string
  artifacts: Array<{ filename: string; content: string }>
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
  private validator: ArtifactValidationService

  constructor(
    private prisma: PrismaClient,
    private gatekeeperApiUrl: string,
  ) {
    this.registry = LLMProviderRegistry.fromEnv()
    this.assembler = new AgentPromptAssembler(prisma)
    this.validator = new ArtifactValidationService()
  }

  // ─── Step 0: Discovery (substep before planning) ─────────────────────

  async generateDiscovery(
    input: BridgeDiscoveryInput,
    callbacks: BridgeCallbacks = {},
  ): Promise<BridgeDiscoveryOutput> {
    const outputId = input.outputId || this.generateOutputId(input.taskDescription)
    const emit = callbacks.onEvent ?? (() => {})

    emit({ type: 'agent:bridge_start', step: 0, outputId } as AgentEvent)

    // Resolve phase config for discovery (step 0)
    const phase = await this.resolvePhaseConfig(0, input.provider, input.model)

    // Build system prompt from DB (discovery substep prompts)
    const sessionContext = await this.fetchSessionContext(input.profileId)
    const basePrompt = await this.assembler.assembleForSubstep(1, 'discovery-')
    let systemPrompt = this.enrichPrompt(basePrompt, sessionContext)

    // Run agent
    const toolExecutor = new AgentToolExecutor()
    await toolExecutor.loadSafetyConfig()
    const runner = new AgentRunnerService(this.registry, toolExecutor)

    let userMessage: string
    let tools = [...READ_TOOLS, SAVE_ARTIFACT_TOOL]
    let outputDir: string | undefined

    if (this.isCliProvider(phase)) {
      // Claude Code: write files directly via its Write tool
      outputDir = await this.resolveOutputDir(outputId, input.projectPath)
      systemPrompt += `\n\nIMPORTANT: You must write discovery_report.md to: ${outputDir}/`
      userMessage = `## Task\n\n**Description:** ${input.taskDescription}\n\n**Output ID:** ${outputId}\n\n**Instructions:** Explore the codebase and generate a discovery_report.md with your findings. Use read_file, glob_pattern, and grep_pattern tools to gather evidence. Write the report to ${outputDir}/discovery_report.md`
      tools = [...READ_TOOLS] // no save_artifact for claude-code
    } else {
      userMessage = `## Task\n\n**Description:** ${input.taskDescription}\n\n**Output ID:** ${outputId}\n\n**Instructions:** Explore the codebase and generate a discovery_report.md with your findings. Use read_file, glob_pattern, and grep_pattern tools to gather evidence. Save the report using save_artifact("discovery_report.md", content).`
    }

    const result = await runner.run({
      phase,
      systemPrompt,
      userMessage,
      tools,
      projectRoot: input.projectPath,
      onEvent: emit,
    })

    // Collect artifacts from tool executor
    let memoryArtifacts = toolExecutor.getArtifacts()

    if (memoryArtifacts.size === 0 && this.isCliProvider(phase) && outputDir) {
      // Claude Code wrote files directly — read them from disk
      console.log(`[Bridge] Claude Code: scanning ${outputDir} for artifacts...`)
      memoryArtifacts = this.readArtifactsFromDir(outputDir)
      console.log(`[Bridge] Found ${memoryArtifacts.size} file(s) on disk`)
    }

    if (memoryArtifacts.size === 0 && result.text) {
      // Fallback: try parsing artifacts from text response
      console.log('[Bridge:generateDiscovery] No artifacts found, trying text parse fallback...')
      const parsed = this.parseArtifactsFromText(result.text)
      for (const [filename, content] of parsed.entries()) {
        memoryArtifacts.set(filename, content)
      }
    }

    // ✅ VALIDATE discovery artifacts (NÃO exige microplans.json)
    const validation = this.validator.validateDiscoveryArtifacts(memoryArtifacts)
    if (!validation.valid) {
      const errorDetails = validation.results
        .filter(r => r.severity === 'error')
        .map(r => `${r.details.filename}: ${r.message}`)
        .join('; ')

      console.error('[Bridge:generateDiscovery] ❌ Artifact validation failed:', {
        errorCount: validation.results.filter(r => r.severity === 'error').length,
        errors: validation.results.filter(r => r.severity === 'error').map(r => ({
          file: r.details.filename,
          issues: r.details.issues
        }))
      })

      throw new BridgeError(
        `Discovery artifacts validation failed: ${errorDetails}`,
        'INVALID_ARTIFACTS',
      )
    }

    // Persist artifacts to disk
    await this.persistArtifacts(memoryArtifacts, outputId, input.projectPath)

    // Convert to array format
    const artifacts: Array<{ filename: string; content: string }> = []
    for (const [filename, content] of memoryArtifacts.entries()) {
      artifacts.push({ filename, content })
    }

    emit({
      type: 'agent:bridge_complete',
      step: 0,
      outputId,
      artifactNames: artifacts.map((a) => a.filename),
    } as AgentEvent)

    return {
      outputId,
      artifacts,
      tokensUsed: result.tokensUsed,
      agentResult: result,
    }
  }

  // ─── Step 1: Generate Plan ───────────────────────────────────────────

  async generatePlan(
    input: BridgePlanInput,
    callbacks: BridgeCallbacks = {},
  ): Promise<BridgePlanOutput> {
    const outputId = input.outputId || this.generateOutputId(input.taskDescription)
    const emit = callbacks.onEvent ?? (() => {})

    emit({ type: 'agent:bridge_start', step: 1, outputId } as AgentEvent)

    // Resolve phase config
    const phase = await this.resolvePhaseConfig(1, input.provider, input.model)

    // Build system prompt from DB + session context
    const sessionContext = await this.fetchSessionContext(input.profileId)
    const basePrompt = await this.assembler.assembleForStep(1)
    let systemPrompt = this.enrichPrompt(basePrompt, sessionContext)

    // Run agent
    const toolExecutor = new AgentToolExecutor()
    await toolExecutor.loadSafetyConfig()
    const runner = new AgentRunnerService(this.registry, toolExecutor)

    let userMessage: string
    let tools = [...READ_TOOLS, SAVE_ARTIFACT_TOOL]
    let outputDir: string | undefined

    if (this.isCliProvider(phase)) {
      // Claude Code: write files directly via its Write tool
      outputDir = await this.resolveOutputDir(outputId, input.projectPath)
      // Try to get CLI append from templates, fallback to hardcoded
      const cliAppend = await this.assembler.getCliSystemAppend(1, { outputDir })
      systemPrompt += cliAppend
        ? `\n\n${cliAppend}`
        : `\n\nIMPORTANT: You must write the microplans.json file using your Write tool.\nWrite artifact to this directory: ${outputDir}/\nRequired file: microplans.json`
      userMessage = await this.buildPlanUserMessageAsync(input.taskDescription, outputId, input.taskType)
      // Try to get CLI replacement from templates
      const cliReplace = await this.assembler.getCliReplacement(1, 'save-artifact-plan', { outputDir })
      userMessage = userMessage.replace('Use the save_artifact tool for each one.', cliReplace || `Write each artifact file to: ${outputDir}/`)
      tools = [...READ_TOOLS] // no save_artifact for claude-code

      // Save image attachments to disk so Claude Code can Read them
      if (input.attachments?.length) {
        const attachDir = path.join(outputDir, '_attachments')
        fs.mkdirSync(attachDir, { recursive: true })
        const attachParts: string[] = ['\n\n## Attached Reference Files']
        for (const att of input.attachments) {
          if (att.type.startsWith('image/')) {
            // Save base64 image to disk
            const base64Data = att.content.replace(/^data:[^;]+;base64,/, '')
            const filePath = path.join(attachDir, att.name)
            fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'))
            attachParts.push(`- Image: ${filePath} (use Read tool to view)`)
          } else {
            // Inline text content
            attachParts.push(`### ${att.name}\n\`\`\`\n${att.content.slice(0, 50_000)}\n\`\`\``)
          }
        }
        userMessage += attachParts.join('\n')
      }
    } else {
      userMessage = await this.buildPlanUserMessageAsync(input.taskDescription, outputId, input.taskType)

      // Inline attachments for API providers
      if (input.attachments?.length) {
        const attachParts: string[] = ['\n\n## Attached Reference Files']
        for (const att of input.attachments) {
          if (att.type.startsWith('image/')) {
            attachParts.push(`### ${att.name}\n(Image attachment — base64 content omitted for API providers. Description: ${att.name})`)
          } else {
            attachParts.push(`### ${att.name}\n\`\`\`\n${att.content.slice(0, 50_000)}\n\`\`\``)
          }
        }
        userMessage += attachParts.join('\n')
      }
    }

    // Inject discovery report if present (before task description)
    if (input.discoveryReportContent) {
      userMessage = `## Discovery Report\n\n${input.discoveryReportContent}\n\n${userMessage}`
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

    if (memoryArtifacts.size === 0 && this.isCliProvider(phase) && outputDir) {
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

    // Add task prompt as an artifact for future reference
    memoryArtifacts.set('task_prompt.md', `# Task Prompt\n\n${input.taskDescription}`)

    // ✅ VALIDATE artifacts before persisting
    const validation = this.validator.validateStepArtifacts(1, memoryArtifacts)
    if (!validation.valid) {
      const errorDetails = validation.results
        .filter(r => r.severity === 'error')
        .map(r => `${r.details.filename}: ${r.message}`)
        .join('; ')

      console.error('[Bridge:generatePlan] ❌ Artifact validation failed:', {
        errorCount: validation.results.filter(r => r.severity === 'error').length,
        errors: validation.results.filter(r => r.severity === 'error').map(r => ({
          file: r.details.filename,
          issues: r.details.issues
        }))
      })

      throw new BridgeError(
        `Plan artifacts validation failed: ${errorDetails}`,
        'INVALID_ARTIFACTS',
        { validation: validation.results }
      )
    }

    // Log warnings but don't block
    const warnings = validation.results.filter(r => r.severity === 'warning')
    if (warnings.length > 0) {
      console.warn('[Bridge:generatePlan] ⚠️ Validation warnings:', warnings.map(w => w.message))
      emit({
        type: 'agent:validation_warning',
        step: 1,
        warnings: warnings.map(w => w.message)
      } as AgentEvent)
    }

    console.log('[Bridge:generatePlan] ✅ Artifacts validated:', {
      count: memoryArtifacts.size,
      files: Array.from(memoryArtifacts.keys()),
      warningsCount: warnings.length
    })

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

    // Validate that microplans.json exists
    if (!existingArtifacts['microplans.json']) {
      throw new BridgeError(
        `Missing step 1 artifacts: microplans.json`,
        'MISSING_ARTIFACTS',
        { missing: ['microplans.json'], outputId: input.outputId },
      )
    }

    const phase = await this.resolvePhaseConfig(2, input.provider, input.model)
    const sessionContext = await this.fetchSessionContext(input.profileId)
    const basePrompt = await this.assembler.assembleForStep(2)
    let systemPrompt = this.enrichPrompt(basePrompt, sessionContext)

    const toolExecutor = new AgentToolExecutor()
    await toolExecutor.loadSafetyConfig()
    const runner = new AgentRunnerService(this.registry, toolExecutor)

    let userMessage = await this.buildSpecUserMessageAsync(input.outputId, existingArtifacts)
    let tools = [...READ_TOOLS, SAVE_ARTIFACT_TOOL]
    let outputDir: string | undefined

    if (this.isCliProvider(phase)) {
      outputDir = await this.resolveOutputDir(input.outputId, input.projectPath)
      // Debug: Log outputDir and expected test file
      const microplansData = JSON.parse(existingArtifacts['microplans.json'])
      // Find test file path from first microplan with a test file (*.spec.ts, *.test.ts, etc)
      let testFilePath = 'spec.ts'
      if (microplansData.microplans && Array.isArray(microplansData.microplans)) {
        for (const mp of microplansData.microplans) {
          if (mp.files && Array.isArray(mp.files)) {
            const testFile = mp.files.find((f: any) =>
              /\.(spec|test)\.(ts|tsx|js|jsx)$/.test(f.path)
            )
            if (testFile) {
              testFilePath = testFile.path
              break
            }
          }
        }
      }
      console.log('[Bridge:generateSpec] 🔍 OutputDir:', outputDir)
      console.log('[Bridge:generateSpec] 🔍 Expected testFile basename:', path.basename(testFilePath))
      // Try to get CLI append from templates, fallback to hardcoded
      const cliAppend = await this.assembler.getCliSystemAppend(2, { outputDir })
      systemPrompt += cliAppend
        ? `\n\n${cliAppend}`
        : `
IMPORTANT: Write test file(s) using your Write tool to: ${outputDir}/

CRITICAL PATH INSTRUCTION:
- When you read microplans.json, the test file path contains the FULL PROJECT PATH (e.g., "packages/gatekeeper-api/test/unit/defaults.spec.ts")
- You MUST extract ONLY THE FILENAME (e.g., "defaults.spec.ts") from this path
- Write the spec file with ONLY the filename: Write(path="${outputDir}/defaults.spec.ts")
- Do NOT preserve the directory structure from the file path
- Do NOT write to: ${outputDir}/packages/... (this is WRONG)

Example:
  microplans.json file path: "packages/gatekeeper-api/test/unit/defaults.spec.ts"
  Correct Write path: "${outputDir}/defaults.spec.ts"
  Wrong Write path: "${outputDir}/packages/gatekeeper-api/test/unit/defaults.spec.ts"
`
      // Add expected filename to help LLM
      const expectedFilename = path.basename(testFilePath)
      systemPrompt += `\nExpected filename: ${expectedFilename}`

      // Replace save_artifact instructions with Write tool instructions for CLI
      const criticalReplace = await this.assembler.getCliReplacement(2, 'critical-spec', { outputDir })
      const reminderReplace = await this.assembler.getCliReplacement(2, 'reminder-spec', { outputDir })
      userMessage = userMessage
        .replace(
          /## ⚠️ CRITICAL: You MUST call save_artifact[\s\S]*?Expected call:.*\n/,
          criticalReplace
            ? `${criticalReplace}\n`
            : `## ⚠️ CRITICAL: You MUST write the test file\nUse your Write tool to save the test file to: ${outputDir}/\n`,
        )
        .replace(
          'Use the save_artifact tool to save the test file.',
          `Write the test file to: ${outputDir}/`,
        )
        .replace(
          /## REMINDER:.*$/,
          reminderReplace || `## REMINDER: Write the test file to ${outputDir}/ — do NOT just output text.`,
        )
      tools = [...READ_TOOLS]
    }

    // Timeout protection for spec generation (Tarefa 8.1)
    const SPEC_TIMEOUT_MS = 5 * 60 * 1000  // 5 minutes
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Spec generation timeout after 5 minutes')), SPEC_TIMEOUT_MS)
    })

    let result
    try {
      result = await Promise.race([
        runner.run({
          phase,
          systemPrompt,
          userMessage,
          tools,
          projectRoot: input.projectPath,
          onEvent: emit,
        }),
        timeoutPromise
      ])
    } catch (error) {
      if (error instanceof Error && error.message.includes('timeout')) {
        emit({
          type: 'agent:error',
          phase: 'SPEC',
          error: 'Agent exceeded maximum execution time (5 minutes)',
          canRetry: true,
        } as any)
      }
      throw error
    }

    let memoryArtifacts = toolExecutor.getArtifacts()

    if (memoryArtifacts.size === 0 && this.isCliProvider(phase) && outputDir) {
      console.log(`[Bridge] Claude Code spec: scanning ${outputDir} for new artifacts...`)
      memoryArtifacts = this.readArtifactsFromDir(outputDir)
      // Filter to only spec files (exclude plan artifacts from step 1)
      // Use a fixed list instead of existingArtifacts to avoid filtering out spec files on re-generation
      const PLAN_ARTIFACTS = new Set(['microplans.json', 'task_prompt.md'])
      const specOnly = new Map<string, string>()
      for (const [name, content] of memoryArtifacts) {
        // Keep everything EXCEPT plan artifacts
        if (!PLAN_ARTIFACTS.has(name)) {
          specOnly.set(name, content)
        }
      }
      if (specOnly.size > 0) memoryArtifacts = specOnly
      console.log(`[Bridge] Found ${memoryArtifacts.size} spec file(s) (excluding plan artifacts)`)
    }

    // Fallback for API providers: if no artifacts from save_artifact tool, try reading from disk
    if (memoryArtifacts.size === 0 && !this.isCliProvider(phase)) {
      console.log('[Bridge] API provider returned no artifacts, trying disk fallback...')
      const outputDir = await this.resolveOutputDir(input.outputId, input.projectPath)
      const diskArtifacts = this.readArtifactsFromDir(outputDir)
      const PLAN_ARTIFACTS = new Set(['microplans.json', 'task_prompt.md'])
      const specOnly = new Map<string, string>()
      for (const [name, content] of diskArtifacts) {
        if (!PLAN_ARTIFACTS.has(name)) {
          specOnly.set(name, content)
        }
      }
      if (specOnly.size > 0) {
        memoryArtifacts = specOnly
        console.log(`[Bridge] Disk fallback found ${memoryArtifacts.size} spec file(s)`)
      }
    }

    if (memoryArtifacts.size === 0 && result.text) {
      console.log('[Bridge] No spec artifacts found, trying text parse fallback...')
      memoryArtifacts = this.parseArtifactsFromText(result.text)
    }

    // FIX-B: Smart recovery — extract largest code block from text response
    // When the LLM outputs the spec as text (not via save_artifact), the regex-based
    // parseArtifactsFromText fails because LLMs write ```typescript not ```typescript filename.tsx
    // This extracts the largest code block and maps it to the expected testFile name from plan.json.
    if (memoryArtifacts.size === 0 && result.text && result.text.length > 500) {
      console.log('[Bridge] Text parse failed, trying smart code block extraction...')
      const testFileName = this.extractTestFileNameFromPlan(existingArtifacts)
      const codeBlock = this.extractLargestCodeBlock(result.text)
      if (codeBlock && testFileName) {
        memoryArtifacts.set(testFileName, codeBlock)
        console.log(`[Bridge] ✅ Smart recovery: extracted "${testFileName}" (${codeBlock.length} chars) from text response`)
      } else {
        console.warn(`[Bridge] ⚠️ Smart recovery failed: testFileName=${testFileName}, codeBlock=${codeBlock?.length ?? 0} chars`)
      }
    }

    // ✅ VALIDATE spec artifacts before persisting
    const validation = this.validator.validateStepArtifacts(2, memoryArtifacts)
    if (!validation.valid) {
      const errorDetails = validation.results
        .filter(r => r.severity === 'error')
        .map(r => `${r.details.filename}: ${r.message}`)
        .join('; ')

      console.error('[Bridge:generateSpec] ❌ Artifact validation failed:', {
        errorCount: validation.results.filter(r => r.severity === 'error').length,
        errors: validation.results.filter(r => r.severity === 'error').map(r => ({
          file: r.details.filename,
          issues: r.details.issues
        }))
      })

      throw new BridgeError(
        `Spec artifacts validation failed: ${errorDetails}`,
        'INVALID_ARTIFACTS',
        { validation: validation.results }
      )
    }

    // Log warnings but don't block
    const warnings = validation.results.filter(r => r.severity === 'warning')
    if (warnings.length > 0) {
      console.warn('[Bridge:generateSpec] ⚠️ Validation warnings:', warnings.map(w => w.message))
      emit({
        type: 'agent:validation_warning',
        step: 2,
        warnings: warnings.map(w => w.message)
      } as AgentEvent)
    }

    console.log('[Bridge:generateSpec] ✅ Artifacts validated:', {
      count: memoryArtifacts.size,
      files: Array.from(memoryArtifacts.keys()),
      warningsCount: warnings.length
    })

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
    const basePrompt = await this.assembler.assembleForStep(4)
    const sessionContext = await this.fetchSessionContext()
    let systemPrompt = this.enrichPrompt(basePrompt, sessionContext)

    const toolExecutor = new AgentToolExecutor()
    await toolExecutor.loadSafetyConfig()
    const runner = new AgentRunnerService(this.registry, toolExecutor)

    let userMessage = await this.buildExecuteUserMessageAsync(input.outputId, existingArtifacts)
    let tools = [...READ_TOOLS, ...WRITE_TOOLS, SAVE_ARTIFACT_TOOL]

    if (this.isCliProvider(phase)) {
      // CLI providers have their own Write, Edit, Bash built-in — no need for our tools
      tools = [] // CLI ignores tools param entirely, uses its own
      // Replace API tool references with CLI tool names
      const cliToolsReplace = await this.assembler.getCliReplacement(4, 'execute-tools', {})
      userMessage = userMessage
        .replace('Use edit_file for surgical modifications, write_file for new files, and bash to run tests.',
          cliToolsReplace || 'Use your Edit tool for modifications, Write for new files, and Bash to run tests.')
      // Try to get CLI append from templates, fallback to hardcoded
      const cliAppend = await this.assembler.getCliSystemAppend(4, {})
      systemPrompt += cliAppend
        ? `\n\n${cliAppend}`
        : `\n\nIMPORTANT: Implement the code changes using your Write and Edit tools. Run tests using Bash.`
    }

    console.log('[Bridge:Execute] provider type:', this.isCliProvider(phase) ? 'CLI' : 'API')
    console.log('[Bridge:Execute] ⚠️  DEBUG projectRoot:', input.projectPath)
    console.log('[Bridge:Execute] ⚠️  DEBUG outputId:', input.outputId)

    const result = await runner.run({
      phase,
      systemPrompt,
      userMessage,
      tools,
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

    console.log('[Bridge:Fix] === START ===')
    console.log('[Bridge:Fix] target:', input.target)
    console.log('[Bridge:Fix] outputId:', input.outputId)
    console.log('[Bridge:Fix] runId:', input.runId)
    console.log('[Bridge:Fix] failedValidators:', input.failedValidators)
    console.log('[Bridge:Fix] provider:', input.provider, '| model:', input.model)
    console.log('[Bridge:Fix] taskPrompt length:', input.taskPrompt?.length ?? 0)

    emit({ type: 'agent:bridge_start', step: 3, outputId: input.outputId } as AgentEvent)

    const existingArtifacts = await this.readArtifactsFromDisk(input.outputId, input.projectPath)
    console.log('[Bridge:Fix] existingArtifacts on disk:', Object.keys(existingArtifacts))
    for (const [name, c] of Object.entries(existingArtifacts)) {
      const hash = Buffer.from(c).length  // simple size-based check
      console.log(`[Bridge:Fix]   PRE  ${name}: ${c.length} chars`)
    }

    // Fetch rejection report from API if we have a runId
    let rejectionReport = input.rejectionReport || ''
    if (!rejectionReport && input.runId) {
      rejectionReport = await this.fetchRejectionReport(input.runId)
    }
    console.log('[Bridge:Fix] rejectionReport:', rejectionReport.length, 'chars')
    if (rejectionReport.length > 0) {
      console.log('[Bridge:Fix] rejectionReport preview:', rejectionReport.slice(0, 300))
    }

    const phase = await this.resolvePhaseConfig(
      input.target === 'plan' ? 1 : 2,
      input.provider,
      input.model,
    )
    const sessionContext = await this.fetchSessionContext(input.profileId)
    const basePrompt = await this.assembler.assembleForStep(3)
    let systemPrompt = this.enrichPrompt(basePrompt, sessionContext)

    const toolExecutor = new AgentToolExecutor()
    await toolExecutor.loadSafetyConfig()
    const runner = new AgentRunnerService(this.registry, toolExecutor)

    // For CLI providers, use Write tool instead of save_artifact
    let tools = [...READ_TOOLS, SAVE_ARTIFACT_TOOL]
    let outputDir: string | undefined

    // Snapshot for change detection (used by CLI providers)
    const preFixSnapshot = new Map<string, string>()
    for (const [name, content] of Object.entries(existingArtifacts)) {
      preFixSnapshot.set(name, content)
    }

    if (this.isCliProvider(phase)) {
      outputDir = await this.resolveOutputDir(input.outputId, input.projectPath)
      tools = [...READ_TOOLS] // no save_artifact for claude-code — it uses its own Write tool
      // Try to get CLI append from templates, fallback to hardcoded
      const cliAppend = await this.assembler.getCliSystemAppend(3, { outputDir })
      systemPrompt += cliAppend
        ? `\n\n${cliAppend}`
        : `\n\nIMPORTANT: You must write each corrected artifact as a file using your Write tool.\nWrite corrected files to this directory: ${outputDir}/\nUse the EXACT same filename as the original artifact.`
    }

    let userMessage: string

    if (this.isCliProvider(phase) && outputDir) {
      // CLI mode: reference files by PATH instead of embedding content
      // This reduces the prompt from 80KB+ to ~3KB
      userMessage = await this.buildFixUserMessageForCliAsync(
        input.target,
        input.outputId,
        outputDir,
        existingArtifacts,
        rejectionReport,
        input.failedValidators,
        input.taskPrompt,
      )
    } else {
      // API mode: embed artifact content inline (save_artifact tool handles output)
      userMessage = await this.buildFixUserMessageAsync(
        input.target,
        input.outputId,
        existingArtifacts,
        rejectionReport,
        input.failedValidators,
        input.taskPrompt,
      )
    }

    // Append user-provided custom instructions if present
    if (input.customInstructions?.trim()) {
      userMessage += `\n\n## Instruções Adicionais do Usuário\n${input.customInstructions.trim()}`
      console.log('[Bridge:Fix] customInstructions:', input.customInstructions.slice(0, 200))
    }

    console.log('[Bridge:Fix] provider type:', this.isCliProvider(phase) ? 'CLI' : 'API')
    if (outputDir) console.log('[Bridge:Fix] outputDir:', outputDir)
    console.log('[Bridge:Fix] userMessage length:', userMessage.length, 'chars')
    console.log('[Bridge:Fix] userMessage preview (first 500):', userMessage.slice(0, 500))
    console.log('[Bridge:Fix] systemPrompt length:', systemPrompt.length, 'chars')
    console.log('[Bridge:Fix] tools:', tools.map(t => t.name))

    const result = await runner.run({
      phase,
      systemPrompt,
      userMessage,
      tools,
      projectRoot: input.projectPath,
      onEvent: emit,
    })

    console.log('[Bridge:Fix] LLM finished — iterations:', result.iterations)
    console.log('[Bridge:Fix] LLM tokens:', result.tokensUsed)
    console.log('[Bridge:Fix] LLM response text length:', result.text.length)
    console.log('[Bridge:Fix] LLM response text preview:', result.text.slice(0, 400))

    // Collect artifacts — same strategy as plan/spec steps
    let savedArtifacts = toolExecutor.getArtifacts()
    console.log('[Bridge:Fix] toolExecutor.getArtifacts() count:', savedArtifacts.size)

    if (savedArtifacts.size === 0 && this.isCliProvider(phase) && outputDir) {
      // Claude Code wrote files directly via Write tool — read them from disk
      console.log(`[Bridge:Fix] CLI provider: scanning ${outputDir} for updated artifacts...`)
      const diskArtifacts = this.readArtifactsFromDir(outputDir)
      console.log(`[Bridge:Fix] Found ${diskArtifacts.size} total file(s) on disk`)

      // Change detection: only keep files that actually changed
      const changedArtifacts = new Map<string, string>()
      for (const [name, content] of diskArtifacts) {
        const preContent = preFixSnapshot.get(name)
        if (!preContent) {
          // New file created by the fixer
          console.log(`[Bridge:Fix]   NEW: ${name} (${content.length} chars)`)
          changedArtifacts.set(name, content)
        } else if (preContent !== content) {
          // File was modified
          console.log(`[Bridge:Fix]   CHANGED: ${name} (${preContent.length} → ${content.length} chars)`)
          changedArtifacts.set(name, content)
        } else {
          console.log(`[Bridge:Fix]   UNCHANGED: ${name}`)
        }
      }
      savedArtifacts = changedArtifacts
      console.log(`[Bridge:Fix] Changed artifacts: ${savedArtifacts.size}`)
    }

    if (savedArtifacts.size === 0 && result.text) {
      // Fallback: try parsing artifacts from text response
      console.log('[Bridge:Fix] No artifacts found, trying text parse fallback...')
      savedArtifacts = this.parseArtifactsFromText(result.text)
      console.log(`[Bridge:Fix] Parsed ${savedArtifacts.size} artifact(s) from text`)
    }

    // FIX-2 & FIX-3: Smart recovery — extract largest code block from text response
    // When the LLM outputs the corrected artifact as text (not via save_artifact),
    // parseArtifactsFromText fails because LLMs write ```typescript not ```typescript filename.tsx
    // This extracts the largest code block and maps it to the expected filename.
    if (savedArtifacts.size === 0 && result.text && result.text.length > 500) {
      console.log('[Bridge:Fix] Text parse failed, trying smart code block extraction...')
      const codeBlock = this.extractLargestCodeBlock(result.text)
      if (codeBlock) {
        // Determine the expected filename based on target
        let targetFilename: string | null = null
        if (input.target === 'spec') {
          // Find spec file from existing artifacts
          targetFilename = Object.keys(existingArtifacts).find(
            (n) => n.endsWith('.spec.ts') || n.endsWith('.spec.tsx') || n.endsWith('.test.ts') || n.endsWith('.test.tsx'),
          ) || this.extractTestFileNameFromPlan(existingArtifacts)
        } else {
          targetFilename = 'plan.json'
        }

        if (targetFilename) {
          savedArtifacts.set(targetFilename, codeBlock)
          console.log(`[Bridge:Fix] ✅ Smart recovery: extracted "${targetFilename}" (${codeBlock.length} chars) from text response`)
        } else {
          console.warn(`[Bridge:Fix] ⚠️ Smart recovery failed: could not determine target filename`)
        }
      } else {
        console.warn(`[Bridge:Fix] ⚠️ Smart recovery failed: no code block found in ${result.text.length} char response`)
      }
    }

    // ── RETRY: If LLM explained but didn't save, force a second attempt ──
    // FIX-4: Include full context in retry (spec, rejection report, previous response)
    // Now uses templates from the database with fallback to hardcoded.
    if (savedArtifacts.size === 0 && result.text.length > 100) {
      console.warn('[Bridge:Fix] ⚠️ LLM explained fixes but did NOT call save_artifact. Forcing retry with full context...')

      // Determine target filename for the retry message
      let targetFilename = 'the artifact'
      if (input.target === 'spec') {
        targetFilename = Object.keys(existingArtifacts).find(
          (n) => n.endsWith('.spec.ts') || n.endsWith('.spec.tsx') || n.endsWith('.test.ts') || n.endsWith('.test.tsx'),
        ) || 'the spec file'
      } else {
        targetFilename = 'plan.json'
      }

      // Build original artifact content for retry context
      const originalArtifact = input.target === 'spec'
        ? Object.entries(existingArtifacts)
            .filter(([n]) => n.endsWith('.spec.ts') || n.endsWith('.spec.tsx') || n.endsWith('.test.ts') || n.endsWith('.test.tsx'))
            .map(([n, c]) => `### ${n}\n\`\`\`\n${c}\n\`\`\``)
            .join('\n\n')
        : `### plan.json\n\`\`\`json\n${existingArtifacts['plan.json'] || '{}'}\n\`\`\``

      // Try to build retry message from templates
      const retryTemplateVars = {
        targetFilename,
        outputDir: outputDir || '',
        previousResponse: result.text.slice(0, 8000),
        originalArtifact,
        rejectionReport: rejectionReport?.slice(0, 3000) || '',
      }

      let retryMessage = await this.assembler.buildRetryMessage(
        this.isCliProvider(phase),
        retryTemplateVars,
      )

      // Fallback to hardcoded if no templates found
      if (!retryMessage) {
        console.log('[Bridge:Fix] No retry templates found, using hardcoded fallback')
        const retryParts: string[] = []

        if (this.isCliProvider(phase)) {
          retryParts.push(
            `## ⚠️ CRITICAL FAILURE: You did NOT write any files!\n` +
            `Your previous response explained the fixes but you NEVER used your Write tool.\n` +
            `All your work is LOST. You MUST write the file NOW.\n\n` +
            `**DO NOT EXPLAIN AGAIN.** Just write the corrected file to: ${outputDir}/${targetFilename}`,
          )
        } else {
          retryParts.push(
            `## ⚠️ CRITICAL FAILURE: You did NOT call save_artifact!\n` +
            `Your previous response explained the fixes but you NEVER called the tool.\n` +
            `All your work is LOST. You MUST call save_artifact NOW.\n\n` +
            `**DO NOT EXPLAIN AGAIN.** Just call: save_artifact("${targetFilename}", <corrected content>)`,
          )
        }

        retryParts.push(
          `## Your Previous Response (for reference)\n` +
          `You already analyzed the issues and described the fixes:\n\n` +
          `\`\`\`\n${result.text.slice(0, 8000)}\n\`\`\`\n\n` +
          `Now APPLY those fixes and save the file.`,
        )

        retryParts.push(`## Original Artifact to Fix\n${originalArtifact}`)

        if (rejectionReport) {
          retryParts.push(`## Rejection Report (reminder)\n${rejectionReport.slice(0, 3000)}`)
        }

        if (this.isCliProvider(phase)) {
          retryParts.push(
            `## YOUR ONLY TASK NOW\n` +
            `Use your Write tool to save the corrected ${targetFilename} to ${outputDir}/\n` +
            `Do NOT explain. Do NOT analyze. Just WRITE THE FILE.`,
          )
        } else {
          retryParts.push(
            `## YOUR ONLY TASK NOW\n` +
            `Call save_artifact("${targetFilename}", <fully corrected content>)\n` +
            `Do NOT explain. Do NOT analyze. Just CALL THE TOOL.`,
          )
        }

        retryMessage = retryParts.join('\n\n')
      }

      console.log(`[Bridge:Fix] Retry message length: ${retryMessage.length} chars`)

      const retryResult = await runner.run({
        phase,
        systemPrompt,
        userMessage: retryMessage,
        tools,
        projectRoot: input.projectPath,
        onEvent: emit,
      })

      console.log('[Bridge:Fix] Retry finished — checking for artifacts...')
      savedArtifacts = toolExecutor.getArtifacts()
      console.log(`[Bridge:Fix] Retry artifacts count: ${savedArtifacts.size}`)

      if (savedArtifacts.size === 0 && this.isCliProvider(phase) && outputDir) {
        const diskArtifacts = this.readArtifactsFromDir(outputDir)
        const changedArtifacts = new Map<string, string>()
        for (const [name, content] of diskArtifacts) {
          const preContent = preFixSnapshot.get(name)
          if (!preContent || preContent !== content) {
            changedArtifacts.set(name, content)
          }
        }
        savedArtifacts = changedArtifacts
        console.log(`[Bridge:Fix] Retry disk scan: ${savedArtifacts.size} changed files`)
      }

      if (savedArtifacts.size === 0 && retryResult.text) {
        savedArtifacts = this.parseArtifactsFromText(retryResult.text)
        console.log(`[Bridge:Fix] Retry text parse: ${savedArtifacts.size} artifact(s)`)
      }

      // Smart recovery for retry as well
      if (savedArtifacts.size === 0 && retryResult.text && retryResult.text.length > 500) {
        console.log('[Bridge:Fix] Retry text parse failed, trying smart code block extraction...')
        const codeBlock = this.extractLargestCodeBlock(retryResult.text)
        if (codeBlock) {
          let retryTargetFilename: string | null = null
          if (input.target === 'spec') {
            retryTargetFilename = Object.keys(existingArtifacts).find(
              (n) => n.endsWith('.spec.ts') || n.endsWith('.spec.tsx') || n.endsWith('.test.ts') || n.endsWith('.test.tsx'),
            ) || this.extractTestFileNameFromPlan(existingArtifacts)
          } else {
            retryTargetFilename = 'plan.json'
          }

          if (retryTargetFilename) {
            savedArtifacts.set(retryTargetFilename, codeBlock)
            console.log(`[Bridge:Fix] ✅ Retry smart recovery: extracted "${retryTargetFilename}" (${codeBlock.length} chars)`)
          }
        }
      }

      // Update result with retry data
      result.tokensUsed.inputTokens += retryResult.tokensUsed.inputTokens
      result.tokensUsed.outputTokens += retryResult.tokensUsed.outputTokens
      result.iterations += retryResult.iterations
      result.text += '\n\n--- RETRY ---\n\n' + retryResult.text
    }

    if (savedArtifacts.size === 0) {
      console.warn('[Bridge:Fix] ⚠️ NO ARTIFACTS SAVED BY LLM (even after retry)! The fixer did not save any files.')
      console.warn('[Bridge:Fix] LLM response preview:', result.text.slice(0, 500))
    }
    for (const [name, c] of savedArtifacts) {
      console.log(`[Bridge:Fix]   POST ${name}: ${c.length} chars`)
    }

    const artifacts = await this.persistArtifacts(
      savedArtifacts,
      input.outputId,
      input.projectPath,
    )

    console.log('[Bridge:Fix] persistArtifacts result:', artifacts.length, 'files')
    // Compare pre vs post
    for (const art of artifacts) {
      const pre = existingArtifacts[art.filename]
      if (pre) {
        const identical = pre === art.content
        console.log(`[Bridge:Fix] COMPARE ${art.filename}: pre=${pre.length} post=${art.content.length} ${identical ? '⚠️ IDENTICAL' : '✅ CHANGED'}`)
        if (identical) {
          console.warn(`[Bridge:Fix] ⚠️ FIX LOOP: "${art.filename}" is IDENTICAL after fix — LLM did not modify it`)
        }
      } else {
        console.log(`[Bridge:Fix] NEW artifact: ${art.filename} (${art.content.length} chars)`)
      }
    }
    console.log('[Bridge:Fix] === END ===')

    // Check if the fixer produced a corrected task prompt
    const correctedPromptArtifact = artifacts.find((a) => a.filename === 'corrected-task-prompt.txt')
    const correctedTaskPrompt = correctedPromptArtifact?.content?.trim() || undefined

    // Don't include corrected-task-prompt.txt in the regular artifacts list
    const realArtifacts = artifacts.filter((a) => a.filename !== 'corrected-task-prompt.txt')

    // Extract corrections from the response text
    const corrections = result.text
      .split('\n')
      .filter((line) => line.trim().startsWith('-') || line.trim().startsWith('•'))
      .map((line) => line.trim())

    emit({
      type: 'agent:bridge_complete',
      step: 3,
      outputId: input.outputId,
      artifactNames: realArtifacts.map((a) => a.filename),
    } as AgentEvent)

    return {
      artifacts: realArtifacts,
      corrections: corrections.length > 0
        ? corrections
        : ['Artifacts corrected (see agent output for details)'],
      tokensUsed: result.tokensUsed,
      agentResult: result,
      correctedTaskPrompt,
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

      // Write artifact to disk
      fs.writeFileSync(filePath, content, 'utf-8')

      // ✅ Verify write succeeded
      if (!fs.existsSync(filePath)) {
        throw new BridgeError(
          `Failed to persist artifact: ${filename}`,
          'PERSIST_FAILED',
          { filename, outputDir }
        )
      }

      // ✅ Verify content matches
      const writtenContent = fs.readFileSync(filePath, 'utf-8')
      if (writtenContent !== content) {
        throw new BridgeError(
          `Artifact content mismatch after write: ${filename}`,
          'PERSIST_MISMATCH',
          { filename, expectedLength: content.length, actualLength: writtenContent.length }
        )
      }

      result.push({ filename, content })
      console.log(`[Bridge] Artifact saved and verified: ${filePath}`)
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

  /**
   * Whether the resolved phase config uses Claude Code CLI provider.
   */
  private isCliProvider(phase: PhaseConfig): boolean {
    return phase.provider === 'claude-code' || phase.provider === 'codex-cli'
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

  /**
   * Extract the expected test file name from microplans.json.
   * Returns just the filename (no path), e.g. "orchestrator-enhancements.spec.tsx"
   */
  private extractTestFileNameFromPlan(artifacts: Record<string, string>): string | null {
    try {
      const microplansJson = JSON.parse(artifacts['microplans.json'] || '{}')
      if (microplansJson.microplans && Array.isArray(microplansJson.microplans)) {
        for (const mp of microplansJson.microplans) {
          if (mp.files && Array.isArray(mp.files)) {
            const testFile = mp.files.find((f: any) =>
              /\.(spec|test)\.(ts|tsx|js|jsx)$/.test(f.path)
            )
            if (testFile) {
              return testFile.path.split('/').pop() || null
            }
          }
        }
      }
    } catch { /* ignore parse errors */ }
    return null
  }

  /**
   * Extract the largest fenced code block from a text response.
   * Used as a last-resort recovery when the LLM outputs spec as text
   * instead of using save_artifact. Only returns blocks that look like
   * test files (contain 'describe', 'test', 'it', or 'expect').
   */
  private extractLargestCodeBlock(text: string): string | null {
    const blocks: string[] = []
    const regex = /```(?:\w*)\s*\n([\s\S]*?)```/g
    let match
    while ((match = regex.exec(text)) !== null) {
      const content = match[1]?.trim()
      if (content && content.length > 200) {
        blocks.push(content)
      }
    }
    if (blocks.length === 0) return null

    // Sort by length descending, prefer blocks that look like test files
    blocks.sort((a, b) => {
      const aIsTest = /\b(describe|test|it|expect)\s*\(/.test(a) ? 1 : 0
      const bIsTest = /\b(describe|test|it|expect)\s*\(/.test(b) ? 1 : 0
      if (aIsTest !== bIsTest) return bIsTest - aIsTest
      return b.length - a.length
    })

    return blocks[0] || null
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
   * Uses templates from the database for git strategy and custom instructions header.
   */
  private async fetchSessionContext(profileId?: string): Promise<SessionContext> {
    let gitStrategy = ''
    let customInstructions = ''

    try {
      const sessionRes = await fetch(`${this.gatekeeperApiUrl}/mcp/session`)
      if (!sessionRes.ok) throw new Error(`HTTP ${sessionRes.status}`)

      const session = (await sessionRes.json()) as Record<string, unknown>
      const config = session.config as Record<string, string> | undefined

      // Git strategy — try to use template from DB
      const branch = config?.branch || 'feature/task'
      if (config?.gitStrategy === 'new-branch') {
        const template = await this.assembler.getGitStrategyTemplate('new-branch', { branch })
        gitStrategy = template || `\n## Git Strategy\nCrie uma nova branch antes de implementar: ${branch}\n`
      } else if (config?.gitStrategy === 'existing-branch' && config.branch) {
        const template = await this.assembler.getGitStrategyTemplate('existing-branch', { branch: config.branch })
        gitStrategy = template || `\n## Git Strategy\nUse a branch existente: ${config.branch}\n`
      } else {
        const template = await this.assembler.getGitStrategyTemplate('main', {})
        gitStrategy = template || `\n## Git Strategy\nCommit direto na branch atual.\n`
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
          // Only load session-level prompts (step=null), NOT pipeline entries
          const promptsRes = await fetch(`${this.gatekeeperApiUrl}/mcp/prompts?scope=session&full=true`)
          if (promptsRes.ok) {
            const promptsData = (await promptsRes.json()) as { data?: Array<{ name: string; content: string; isActive: boolean }> }
            activePrompts = (promptsData.data || []).filter((p) => p.isActive)
          }
        } catch {
          // ignore
        }
      }

      if (activePrompts.length > 0) {
        // Try to use custom instructions header from DB
        const header = await this.assembler.getCustomInstructionsHeader()
        customInstructions += header ? `\n${header}\n` : `\n## Instruções Adicionais\n`
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

  /**
   * Build user message for Step 1 (Plan).
   * Tries to use DB template first, falls back to hardcoded.
   */
  private async buildPlanUserMessageAsync(
    taskDescription: string,
    outputId: string,
    taskType?: string,
    attachments?: string,
  ): Promise<string> {
    // Try DB template first
    const template = await this.assembler.assembleUserMessageForStep(1, {
      taskDescription,
      outputId,
      taskType,
      attachments,
    })

    if (template) return template

    // Fallback to hardcoded
    return this.buildPlanUserMessage(taskDescription, outputId, taskType)
  }

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
      `Analyze the codebase and produce the microplans.json file.`,
      `Use the save_artifact tool to save it.`,
    ]
    return parts.filter(Boolean).join('\n')
  }

  /**
   * Build user message for Step 2 (Spec).
   * Tries to use DB template first, falls back to hardcoded.
   */
  private async buildSpecUserMessageAsync(
    outputId: string,
    artifacts: Record<string, string>,
  ): Promise<string> {
    const artifactBlocks = Object.entries(artifacts)
      .map(([name, content]) => `### ${name}\n\`\`\`\n${content}\n\`\`\``)
      .join('\n\n')

    // Extract expected test filename from microplans.json
    let testFileName = 'generated.spec.tsx'
    const extractedName = this.extractTestFileNameFromPlan(artifacts)
    if (extractedName) {
      testFileName = extractedName
    }

    // Try DB template first
    const template = await this.assembler.assembleUserMessageForStep(2, {
      outputId,
      testFileName,
      artifactBlocks,
      microplanJson: artifacts['microplans.json'] || '', // ✅ FIX: Inject microplan content for template
    })

    if (template) return template

    // Fallback to hardcoded
    return this.buildSpecUserMessage(outputId, artifacts)
  }

  private buildSpecUserMessage(
    outputId: string,
    artifacts: Record<string, string>,
  ): string {
    const artifactBlocks = Object.entries(artifacts)
      .map(([name, content]) => `### ${name}\n\`\`\`\n${content}\n\`\`\``)
      .join('\n\n')

    // Extract expected test filename from microplans.json
    let testFileName = 'generated.spec.tsx'
    const extractedName = this.extractTestFileNameFromPlan(artifacts)
    if (extractedName) {
      testFileName = extractedName
    }

    return [
      `## ⚠️ CRITICAL: You MUST call save_artifact`,
      `After generating the test file, you MUST call the \`save_artifact\` tool to save it.`,
      `Do NOT output the test code as text in your response — that will be LOST.`,
      `Expected call: \`save_artifact("${testFileName}", <complete test file content>)\``,
      ``,
      `## Output ID: ${outputId}`,
      `## Artifacts from Step 1`,
      artifactBlocks,
      ``,
      `## Instructions`,
      `1. Explore the project to understand testing conventions, imports, and patterns.`,
      `2. Generate the complete test file: **${testFileName}**`,
      `3. Use the save_artifact tool to save the test file.`,
      ``,
      `## REMINDER: call save_artifact("${testFileName}", content) — do NOT just output text.`,
    ].join('\n\n')
  }

  /**
   * Build user message for Step 4 (Execute).
   * Tries to use DB template first, falls back to hardcoded.
   */
  private async buildExecuteUserMessageAsync(
    outputId: string,
    artifacts: Record<string, string>,
  ): Promise<string> {
    const artifactBlocks = Object.entries(artifacts)
      .map(([name, content]) => `### ${name}\n\`\`\`\n${content}\n\`\`\``)
      .join('\n\n')

    // Try DB template first
    const template = await this.assembler.assembleUserMessageForStep(4, {
      outputId,
      artifactBlocks,
      microplanJson: artifacts['microplans.json'] || '', // ✅ FIX: Inject microplan content for template
    })

    if (template) return template

    // Fallback to hardcoded
    return this.buildExecuteUserMessage(outputId, artifacts)
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
      `Use edit_file for surgical modifications, write_file for new files, and bash to run tests.`,
    ].join('\n\n')
  }

  /**
   * Build user message for Step 3 (Fix) - API mode.
   * Tries to use DB template first, falls back to hardcoded.
   */
  private async buildFixUserMessageAsync(
    target: 'plan' | 'spec',
    outputId: string,
    artifacts: Record<string, string>,
    rejectionReport: string,
    failedValidators: string[],
    taskPrompt?: string,
  ): Promise<string> {
    const artifactBlocks = Object.entries(artifacts)
      .map(([name, content]) => `### ${name}\n\`\`\`\n${content}\n\`\`\``)
      .join('\n\n')

    // Try DB template first
    const template = await this.assembler.assembleUserMessageForStep(3, {
      target: target === 'plan' ? 'Planning artifacts' : 'Test spec artifacts',
      outputId,
      failedValidators,
      rejectionReport,
      gatekeeperError: rejectionReport, // ✅ FIX: Template expects gatekeeper_error
      taskPrompt,
      artifactBlocks,
      microplanJson: artifacts['microplans.json'] || '', // ✅ FIX: Inject microplan content for template
    })

    if (template) return template

    // Fallback to hardcoded (which has detailed guidance per validator type)
    return await this.buildFixUserMessageWithGuidance(target, outputId, artifacts, rejectionReport, failedValidators, taskPrompt)
  }

  /**
   * Build user message for Step 3 (Fix) - CLI mode.
   * Tries to use DB template first, falls back to hardcoded.
   */
  private async buildFixUserMessageForCliAsync(
    target: 'plan' | 'spec',
    outputId: string,
    outputDir: string,
    artifacts: Record<string, string>,
    rejectionReport: string,
    failedValidators: string[],
    taskPrompt?: string,
  ): Promise<string> {
    // Build artifact file list for template
    const artifactFiles = Object.entries(artifacts).map(([name, content]) => ({
      path: `${outputDir}/${name}`,
      chars: content.length,
    }))

    // Identify spec files
    const specFiles = Object.keys(artifacts)
      .filter((n) => n.endsWith('.spec.ts') || n.endsWith('.spec.tsx') || n.endsWith('.test.ts') || n.endsWith('.test.tsx'))
      .join(', ')

    // Try DB template first (kind='cli' for CLI-specific template)
    const template = await this.assembler.assembleUserMessageForStep(3, {
      target: target === 'plan' ? 'Planning artifacts' : 'Test spec artifacts',
      outputId,
      outputDir,
      failedValidators,
      rejectionReport,
      gatekeeperError: rejectionReport, // ✅ FIX: Template expects gatekeeper_error
      taskPrompt,
      artifactFiles,
      specFiles,
      isSpec: target === 'spec',
      microplanJson: artifacts['microplans.json'] || '', // ✅ FIX: Inject microplan content for template
    }, 'cli')

    if (template) return template

    // Fallback to hardcoded with dynamic guidance
    return await this.buildFixUserMessageForCliWithGuidance(target, outputId, outputDir, artifacts, rejectionReport, failedValidators, taskPrompt)
  }

  /**
   * Build fix user message for API providers.
   * Uses dynamic guidance templates from DB with hardcoded fallback.
   */
  private async buildFixUserMessageWithGuidance(
    target: 'plan' | 'spec',
    outputId: string,
    artifacts: Record<string, string>,
    rejectionReport: string,
    failedValidators: string[],
    taskPrompt?: string,
  ): Promise<string> {
    // Fetch dynamic guidance for failed validators from DB
    const dynamicGuidance = await this.assembler.getGuidanceForValidators(
      failedValidators,
      { target, outputId, taskPrompt, failedValidators }
    )

    // If we have dynamic guidance, use simplified structure
    if (dynamicGuidance.length > 0) {
      return this.buildFixUserMessageWithDynamicGuidance(
        target, outputId, artifacts, rejectionReport, failedValidators, taskPrompt, dynamicGuidance
      )
    }

    // Fallback to fully hardcoded guidance
    return this.buildFixUserMessage(target, outputId, artifacts, rejectionReport, failedValidators, taskPrompt)
  }

  /**
   * Build fix user message for CLI providers.
   * Uses dynamic guidance templates from DB with hardcoded fallback.
   */
  private async buildFixUserMessageForCliWithGuidance(
    target: 'plan' | 'spec',
    outputId: string,
    outputDir: string,
    artifacts: Record<string, string>,
    rejectionReport: string,
    failedValidators: string[],
    taskPrompt?: string,
  ): Promise<string> {
    // Fetch dynamic guidance for failed validators from DB
    const dynamicGuidance = await this.assembler.getGuidanceForValidators(
      failedValidators,
      { target, outputId, outputDir, taskPrompt, failedValidators }
    )

    // If we have dynamic guidance, use simplified structure
    if (dynamicGuidance.length > 0) {
      return this.buildFixUserMessageForCliWithDynamicGuidance(
        target, outputId, outputDir, artifacts, rejectionReport, failedValidators, taskPrompt, dynamicGuidance
      )
    }

    // Fallback to fully hardcoded guidance
    return this.buildFixUserMessageForCli(target, outputId, outputDir, artifacts, rejectionReport, failedValidators, taskPrompt)
  }

  /**
   * Build fix user message with dynamic guidance (API mode).
   */
  private buildFixUserMessageWithDynamicGuidance(
    target: 'plan' | 'spec',
    outputId: string,
    artifacts: Record<string, string>,
    rejectionReport: string,
    failedValidators: string[],
    taskPrompt: string | undefined,
    dynamicGuidance: string[],
  ): string {
    // Smart artifact selection (same as hardcoded version)
    const relevantFiles = new Set<string>()
    if (target === 'plan') {
      relevantFiles.add('plan.json')
      if (failedValidators.some(v => ['TEST_CLAUSE_MAPPING_VALID', 'CONTRACT_SCHEMA_INVALID'].includes(v))) {
        relevantFiles.add('contract.md')
      }
    } else {
      for (const name of Object.keys(artifacts)) {
        if (name.endsWith('.spec.ts') || name.endsWith('.spec.tsx') || name.endsWith('.test.ts') || name.endsWith('.test.tsx')) {
          relevantFiles.add(name)
        }
      }
      if (failedValidators.includes('TEST_CLAUSE_MAPPING_VALID')) {
        relevantFiles.add('contract.md')
        relevantFiles.add('plan.json')
      }
    }

    // Build artifact blocks
    const artifactSections: string[] = []
    const skippedFiles: string[] = []
    for (const [name, content] of Object.entries(artifacts)) {
      if (relevantFiles.has(name)) {
        artifactSections.push(`### ${name}\n\`\`\`\n${content}\n\`\`\``)
      } else {
        skippedFiles.push(`- ${name} (${content.length} chars — use read_file if needed)`)
      }
    }
    const artifactBlocks = artifactSections.join('\n\n')
    const skippedBlock = skippedFiles.length > 0
      ? `\n\n### Other artifacts (not included — use read_file to access if needed)\n${skippedFiles.join('\n')}`
      : ''

    const sections: string[] = [
      `## ⚠️ CRITICAL: You MUST call save_artifact\n` +
      `Your ONLY job is to fix the artifacts and save them. You are NOT done until you call \`save_artifact\`.\n` +
      `- Do NOT just explain what needs to change — that accomplishes NOTHING.\n` +
      `- Do NOT end your turn without calling \`save_artifact\`.\n` +
      `- You MUST read the artifact, apply fixes, then call: \`save_artifact(filename, corrected_content)\`\n` +
      `- If you do not call \`save_artifact\`, your work is LOST and you have FAILED the task.`,
      `## Target: ${target === 'plan' ? 'Planning artifacts' : 'Test file'}`,
      `## Output ID: ${outputId}`,
      `## Failed Validators\n${failedValidators.map((v) => `- \`${v}\``).join('\n')}`,
    ]

    if (rejectionReport) {
      sections.push(`## Rejection Report\n\n${rejectionReport}`)
    }

    if (taskPrompt && failedValidators.some(v => ['NO_IMPLICIT_FILES', 'TASK_CLARITY_CHECK', 'TOKEN_BUDGET_FIT'].includes(v))) {
      sections.push(`## Original Task Prompt\n\`\`\`\n${taskPrompt}\n\`\`\``)
    }

    // Add dynamic guidance from DB templates
    sections.push(`## Validator Fix Guidance\n\n${dynamicGuidance.join('\n\n')}`)

    sections.push(
      `## Current Artifacts\n\n${artifactBlocks}${skippedBlock}`,
      '',
      `## CRITICAL: You MUST use save_artifact\n` +
      `Do NOT just explain what needs to change. You MUST call the \`save_artifact\` tool for each file you fix.\n` +
      `If you do not call \`save_artifact\`, your fixes will be LOST and the pipeline will not progress.\n` +
      `For each corrected file, call: save_artifact(filename, corrected_content)`,
    )

    return sections.filter(Boolean).join('\n\n')
  }

  /**
   * Build fix user message for CLI with dynamic guidance.
   */
  private buildFixUserMessageForCliWithDynamicGuidance(
    target: 'plan' | 'spec',
    outputId: string,
    outputDir: string,
    artifacts: Record<string, string>,
    rejectionReport: string,
    failedValidators: string[],
    taskPrompt: string | undefined,
    dynamicGuidance: string[],
  ): string {
    const sections: string[] = []

    sections.push(
      `## ⚠️ CRITICAL: You MUST write the corrected files\n` +
      `Your ONLY job is to fix the artifacts and write them to disk. You are NOT done until you use your Write tool.\n` +
      `- Do NOT just explain what needs to change — that accomplishes NOTHING.\n` +
      `- Do NOT end your turn without writing the corrected files.\n` +
      `- You MUST: 1) Read the artifact, 2) Apply fixes, 3) Write the corrected file to: ${outputDir}/\n` +
      `- If you do not write the file, your work is LOST and you have FAILED the task.`,
    )

    sections.push(
      `## Target: ${target === 'plan' ? 'Planning artifacts' : 'Test spec artifacts'}`,
      `## Output ID: ${outputId}`,
    )

    sections.push(`## Failed Validators\n${failedValidators.map((v) => `- \`${v}\``).join('\n')}`)

    if (rejectionReport) {
      sections.push(`## Rejection Report\n${rejectionReport}`)
    }

    if (taskPrompt) {
      sections.push(`## Original Task\n${taskPrompt}`)
    }

    // Add dynamic guidance from DB templates
    sections.push(`## Validator Fix Guidance\n\n${dynamicGuidance.join('\n\n')}`)

    // File references
    const fileList = Object.entries(artifacts)
      .map(([name, content]) => `- ${outputDir}/${name} (${content.length} chars)`)
      .join('\n')

    sections.push(
      `## Artifact Files\nThe artifacts are on disk. Use your Read tool to read them:\n${fileList}`,
    )

    // Instructions
    if (target === 'spec') {
      const specFiles = Object.keys(artifacts).filter(
        (n) => n.endsWith('.spec.ts') || n.endsWith('.spec.tsx') || n.endsWith('.test.ts') || n.endsWith('.test.tsx'),
      )
      sections.push(
        `## Instructions\n` +
        `1. Read the test file(s): ${specFiles.join(', ')}\n` +
        `2. Fix the issues described in the rejection report and guidance above\n` +
        `3. Write the corrected file(s) back to: ${outputDir}/\n` +
        `   Use the EXACT same filename(s).`,
      )
    } else {
      sections.push(
        `## Instructions\n` +
        `1. Read plan.json from: ${outputDir}/plan.json\n` +
        `2. Fix the issues described in the rejection report and guidance above\n` +
        `3. Write the corrected plan.json back to: ${outputDir}/plan.json`,
      )
    }

    sections.push(
      `## ⚠️ REMINDER: You MUST write the files\n` +
      `Do NOT just explain what needs to change. Use your Write tool to save the corrected file(s) to ${outputDir}/.\n` +
      `If you do not write the files, your fixes will be LOST and the pipeline will FAIL.`,
    )

    return sections.filter(Boolean).join('\n\n')
  }

  private buildFixUserMessage(
    target: 'plan' | 'spec',
    outputId: string,
    artifacts: Record<string, string>,
    rejectionReport: string,
    failedValidators: string[],
    taskPrompt?: string,
  ): string {
    // Categorize failed validators by what data source they check
    const TASK_PROMPT_VALIDATORS = ['NO_IMPLICIT_FILES', 'TASK_CLARITY_CHECK', 'TOKEN_BUDGET_FIT']
    const MANIFEST_VALIDATORS = ['TASK_SCOPE_SIZE', 'DELETE_DEPENDENCY_CHECK', 'PATH_CONVENTION', 'SENSITIVE_FILES_LOCK', 'DANGER_MODE_EXPLICIT']
    const CONTRACT_VALIDATORS = ['TEST_CLAUSE_MAPPING_VALID']
    const SCHEMA_VALIDATORS = ['CONTRACT_SCHEMA_INVALID']
    const TEST_QUALITY_VALIDATORS = [
      'TEST_RESILIENCE_CHECK', 'NO_DECORATIVE_TESTS', 'TEST_HAS_ASSERTIONS',
      'TEST_COVERS_HAPPY_AND_SAD_PATH', 'TEST_INTENT_ALIGNMENT', 'TEST_SYNTAX_VALID',
      'IMPORT_REALITY_CHECK', 'MANIFEST_FILE_LOCK',
    ]

    const hasTaskPromptFailure = failedValidators.some((v) => TASK_PROMPT_VALIDATORS.includes(v))
    const hasManifestFailure = failedValidators.some((v) => MANIFEST_VALIDATORS.includes(v))
    const hasContractFailure = failedValidators.some((v) => CONTRACT_VALIDATORS.includes(v))
    const hasSchemaFailure = failedValidators.some((v) => SCHEMA_VALIDATORS.includes(v))
    const hasTestQualityFailure = failedValidators.some((v) => TEST_QUALITY_VALIDATORS.includes(v))
    const hasDangerModeFailure = failedValidators.includes('DANGER_MODE_EXPLICIT')

    // ── Smart artifact selection: only include what the LLM needs ──
    // Instead of dumping ALL artifacts (can be 80KB+), only include the ones
    // relevant to the failed validators. The LLM can use read_file/Read for others.
    const relevantFiles = new Set<string>()

    if (target === 'plan') {
      // Plan fixes always need plan.json
      relevantFiles.add('plan.json')
      // Contract fixes need plan.json (where contract lives) + contract.md
      if (hasContractFailure || hasSchemaFailure) {
        relevantFiles.add('contract.md')
      }
      // Manifest fixes need plan.json
      if (hasManifestFailure || hasDangerModeFailure) {
        // plan.json already added
      }
    } else {
      // Spec fixes need the test file(s)
      for (const name of Object.keys(artifacts)) {
        if (name.endsWith('.spec.ts') || name.endsWith('.spec.tsx') || name.endsWith('.test.ts') || name.endsWith('.test.tsx')) {
          relevantFiles.add(name)
        }
      }
      // Also include contract.md for clause mapping issues
      if (hasContractFailure) {
        relevantFiles.add('contract.md')
        relevantFiles.add('plan.json')
      }
    }

    // Build artifact blocks — full content for relevant files, summary for others
    const artifactSections: string[] = []
    const skippedFiles: string[] = []
    for (const [name, content] of Object.entries(artifacts)) {
      if (relevantFiles.has(name)) {
        artifactSections.push(`### ${name}\n\`\`\`\n${content}\n\`\`\``)
      } else {
        skippedFiles.push(`- ${name} (${content.length} chars — use read_file if needed)`)
      }
    }
    const artifactBlocks = artifactSections.join('\n\n')
    const skippedBlock = skippedFiles.length > 0
      ? `\n\n### Other artifacts (not included — use read_file to access if needed)\n${skippedFiles.join('\n')}`
      : ''

    const sections: string[] = [
      // CRITICAL instruction at the TOP so the LLM sees it first
      `## ⚠️ CRITICAL: You MUST call save_artifact\n` +
      `Your ONLY job is to fix the artifacts and save them. You are NOT done until you call \`save_artifact\`.\n` +
      `- Do NOT just explain what needs to change — that accomplishes NOTHING.\n` +
      `- Do NOT end your turn without calling \`save_artifact\`.\n` +
      `- You MUST read the artifact, apply fixes, then call: \`save_artifact(filename, corrected_content)\`\n` +
      `- If you do not call \`save_artifact\`, your work is LOST and you have FAILED the task.`,
      `## Target: ${target === 'plan' ? 'Planning artifacts' : 'Test file'}`,
      `## Output ID: ${outputId}`,
      `## Failed Validators\n${failedValidators.map((v) => `- \`${v}\``).join('\n')}`,
    ]

    if (rejectionReport) {
      sections.push(`## Rejection Report\n\n${rejectionReport}`)
    }

    // === Guidance for taskPrompt-level validators ===
    if (hasTaskPromptFailure && taskPrompt) {
      sections.push(
        `## Original Task Prompt\n` +
        `The validators NO_IMPLICIT_FILES and TASK_CLARITY_CHECK analyze the **task prompt text below**, ` +
        `NOT the plan artifacts. To fix these failures you MUST also save a corrected version of the ` +
        `task prompt as an artifact named \`corrected-task-prompt.txt\`.\n\n` +
        `\`\`\`\n${taskPrompt}\n\`\`\`\n\n` +
        `Remove any implicit/vague references (e.g. "etc", "...", "outros arquivos", "e tal", ` +
        `"among others", "all files", "any file", "related files", "necessary files", "e outros") ` +
        `and replace them with explicit, specific file or component names.`
      )
    }

    // === Guidance for manifest-level validators ===
    if (hasManifestFailure) {
      const tips: string[] = []
      if (failedValidators.includes('TASK_SCOPE_SIZE')) {
        tips.push('- **TASK_SCOPE_SIZE**: Reduce the number of files in `manifest.files` in plan.json (split into smaller tasks if needed)')
      }
      if (failedValidators.includes('DELETE_DEPENDENCY_CHECK')) {
        tips.push('- **DELETE_DEPENDENCY_CHECK**: Files marked DELETE have importers not listed in manifest. Add those importers as MODIFY in `manifest.files`')
      }
      if (failedValidators.includes('PATH_CONVENTION')) {
        tips.push('- **PATH_CONVENTION**: The `manifest.testFile` path does not follow project conventions. Update the testFile path in plan.json')
      }
      if (failedValidators.includes('SENSITIVE_FILES_LOCK')) {
        tips.push('- **SENSITIVE_FILES_LOCK**: Manifest includes sensitive files (.env, prisma/schema, etc.) but dangerMode is off. Remove sensitive files from manifest or flag the task as dangerMode')
      }
      sections.push(
        `## Manifest Fix Guidance\n` +
        `These validators check \`manifest.files\` and \`manifest.testFile\` inside **plan.json**. ` +
        `To fix, update the manifest section in plan.json and save it via save_artifact.\n\n` +
        tips.join('\n')
      )
    }

    // === Guidance for contract-level validators ===
    if (hasContractFailure) {
      sections.push(
        `## Contract Fix Guidance\n` +
        `**TEST_CLAUSE_MAPPING_VALID** checks that every test has a valid \`// @clause CL-XXX\` comment ` +
        `matching a clause ID defined in the \`contract\` field of plan.json. To fix:\n` +
        `1. If clause IDs in tests don't match contract: update either the test file or the contract clauses in plan.json\n` +
        `2. If tests are missing \`// @clause\` tags: add them to the spec test file\n` +
        `3. Save both corrected plan.json (with updated contract.clauses) and the test file as needed`
      )
    }

    // === Guidance for test quality validators (Gate 1) ===
    if (hasTestQualityFailure) {
      const tips: string[] = []
      if (failedValidators.includes('TEST_RESILIENCE_CHECK')) {
        tips.push(
          '- **TEST_RESILIENCE_CHECK**: The test file contains **fragile patterns** that depend on implementation details. ' +
          'You MUST replace ALL of these patterns in the spec file:\n' +
          '  - `.innerHTML` → use `toHaveTextContent()` or `screen.getByText()`\n' +
          '  - `.outerHTML` → use `toHaveTextContent()` or specific accessible assertions\n' +
          '  - `container.firstChild` → use `screen.getByRole()` or `screen.getByTestId()`\n' +
          '  - `container.children` → use `screen.getAllByRole()` or `within()` for scoped queries\n' +
          '  - `.querySelector()` / `.querySelectorAll()` → use `screen.getByRole()` / `screen.getAllByRole()`\n' +
          '  - `.getElementsByClassName()` / `.getElementsByTagName()` / `.getElementById()` → use `screen.getByRole()` / `screen.getByTestId()`\n' +
          '  - `.className` → use `toHaveClass()` or accessible assertions\n' +
          '  - `.style.` → use `toHaveStyle()` or CSS-in-JS utilities\n' +
          '  - `wrapper.find()` / `.dive()` → migrate to React Testing Library queries\n' +
          '  - `toMatchSnapshot()` / `toMatchInlineSnapshot()` → use explicit assertions like `toHaveTextContent()`, `toBeVisible()`\n' +
          '  Use ONLY resilient patterns: `screen.getByRole()`, `screen.getByText()`, `screen.getByTestId()`, ' +
          '`userEvent.*`, `toBeVisible()`, `toBeInTheDocument()`, `toHaveTextContent()`, `toHaveAttribute()`.'
        )
      }
      if (failedValidators.includes('NO_DECORATIVE_TESTS')) {
        tips.push('- **NO_DECORATIVE_TESTS**: Remove tests that only check rendering without meaningful assertions (e.g. `expect(component).toBeDefined()`). Every test must assert observable behavior.')
      }
      if (failedValidators.includes('TEST_HAS_ASSERTIONS')) {
        tips.push('- **TEST_HAS_ASSERTIONS**: Some test blocks are missing `expect()` calls. Add meaningful assertions to every `it()` / `test()` block.')
      }
      if (failedValidators.includes('TEST_COVERS_HAPPY_AND_SAD_PATH')) {
        tips.push('- **TEST_COVERS_HAPPY_AND_SAD_PATH**: The test file must cover both success (happy path) and failure/error (sad path) scenarios.')
      }
      if (failedValidators.includes('TEST_INTENT_ALIGNMENT')) {
        tips.push('- **TEST_INTENT_ALIGNMENT**: Test descriptions (`it("should...")`) must match what the test actually asserts. Align names with assertions.')
      }
      if (failedValidators.includes('TEST_SYNTAX_VALID')) {
        tips.push('- **TEST_SYNTAX_VALID**: The test file has syntax errors. Fix TypeScript/JavaScript syntax issues.')
      }
      if (failedValidators.includes('IMPORT_REALITY_CHECK')) {
        tips.push('- **IMPORT_REALITY_CHECK**: The test file imports modules that don\'t exist. Fix import paths to reference real files.')
      }
      if (failedValidators.includes('MANIFEST_FILE_LOCK')) {
        tips.push('- **MANIFEST_FILE_LOCK**: The test file modifies files not listed in the manifest. Only touch files declared in plan.json manifest.')
      }
      sections.push(
        `## Test Quality Fix Guidance\n` +
        `These validators check the **test spec file** content. You MUST:\n` +
        `1. Read the current spec file from the artifacts\n` +
        `2. Apply ALL the fixes below\n` +
        `3. Save the corrected spec file using \`save_artifact\` with the EXACT same filename\n\n` +
        tips.join('\n\n')
      )
    }

    // === Guidance for contract schema validation errors ===
    if (hasSchemaFailure) {
      sections.push(
        `## Contract Schema Fix Guidance\n` +
        `**CONTRACT_SCHEMA_INVALID**: The \`contract\` object inside plan.json has fields with wrong types. ` +
        `The Zod schema enforces strict types. Common mistakes:\n` +
        `- \`assertionSurface.effects\` must be an **array of strings**, e.g. \`["effect1", "effect2"]\` — NOT an object like \`{ "key": "value" }\`\n` +
        `- \`assertionSurface.http.methods\` must be an **array**, e.g. \`["GET", "POST"]\`\n` +
        `- \`assertionSurface.http.successStatuses\` must be an **array of integers**, e.g. \`[200, 201]\`\n` +
        `- \`assertionSurface.ui.routes\` must be an **array of strings**\n` +
        `- All array fields must be actual JSON arrays \`[]\`, never objects \`{}\` or strings\n\n` +
        `**You MUST:**\n` +
        `1. Read the current plan.json from the artifacts above\n` +
        `2. Find and fix every field that has the wrong type\n` +
        `3. Save the corrected plan.json using \`save_artifact\` with filename \`plan.json\`\n\n` +
        `The rejection report above tells you exactly which fields failed.`
      )
    }

    // === Guidance for dangerMode (user-controlled) ===
    if (hasDangerModeFailure) {
      sections.push(
        `## DangerMode Note\n` +
        `**DANGER_MODE_EXPLICIT** failed because dangerMode is enabled but manifest has no sensitive files, ` +
        `or sensitive files are present without dangerMode. This setting is controlled by the user in the UI. ` +
        `You can fix the plan.json by setting \`"dangerMode": true\` if sensitive files are needed, ` +
        `or remove sensitive files from the manifest if dangerMode should stay off.`
      )
    }

    sections.push(
      `## Current Artifacts\n\n${artifactBlocks}${skippedBlock}`,
      '',
      `## CRITICAL: You MUST use save_artifact\n` +
      `Do NOT just explain what needs to change. You MUST call the \`save_artifact\` tool for each file you fix.\n` +
      `If you do not call \`save_artifact\`, your fixes will be LOST and the pipeline will not progress.\n` +
      `For each corrected file, call: save_artifact(filename, corrected_content)`,
    )

    return sections.filter(Boolean).join('\n\n')
  }

  /**
   * Build a lightweight fix user message for CLI providers.
   *
   * Instead of embedding artifact content inline (which can be 80KB+),
   * this version references artifacts by FILE PATH so the CLI agent can
   * use its Read tool to access them. This reduces the prompt to ~3KB.
   */
  private buildFixUserMessageForCli(
    target: 'plan' | 'spec',
    outputId: string,
    outputDir: string,
    artifacts: Record<string, string>,
    rejectionReport: string,
    failedValidators: string[],
    taskPrompt?: string,
  ): string {
    const sections: string[] = []

    // CRITICAL instruction at the TOP so the LLM sees it first
    sections.push(
      `## ⚠️ CRITICAL: You MUST write the corrected files\n` +
      `Your ONLY job is to fix the artifacts and write them to disk. You are NOT done until you use your Write tool.\n` +
      `- Do NOT just explain what needs to change — that accomplishes NOTHING.\n` +
      `- Do NOT end your turn without writing the corrected files.\n` +
      `- You MUST: 1) Read the artifact, 2) Apply fixes, 3) Write the corrected file to: ${outputDir}/\n` +
      `- If you do not write the file, your work is LOST and you have FAILED the task.`,
    )

    sections.push(
      `## Target: ${target === 'plan' ? 'Planning artifacts' : 'Test spec artifacts'}`,
      `## Output ID: ${outputId}`,
    )

    sections.push(`## Failed Validators\n${failedValidators.map((v) => `- \`${v}\``).join('\n')}`)

    if (rejectionReport) {
      sections.push(`## Rejection Report\n${rejectionReport}`)
    }

    if (taskPrompt) {
      sections.push(`## Original Task\n${taskPrompt}`)
    }

    // File references — tell CLI where to find artifacts (not inline content)
    const fileList = Object.entries(artifacts)
      .map(([name, content]) => `- ${outputDir}/${name} (${content.length} chars)`)
      .join('\n')

    sections.push(
      `## Artifact Files\nThe artifacts are on disk. Use your Read tool to read them:\n${fileList}`,
    )

    // Identify which file(s) to fix
    if (target === 'spec') {
      const specFiles = Object.keys(artifacts).filter(
        (n) => n.endsWith('.spec.ts') || n.endsWith('.spec.tsx') || n.endsWith('.test.ts') || n.endsWith('.test.tsx'),
      )
      sections.push(
        `## Instructions\n` +
        `1. Read the test file(s): ${specFiles.join(', ')}\n` +
        `2. Fix the issues described in the rejection report above\n` +
        `3. Write the corrected file(s) back to: ${outputDir}/\n` +
        `   Use the EXACT same filename(s).`,
      )
    } else {
      sections.push(
        `## Instructions\n` +
        `1. Read plan.json from: ${outputDir}/plan.json\n` +
        `2. Fix the issues described in the rejection report above\n` +
        `3. Write the corrected plan.json back to: ${outputDir}/plan.json`,
      )
    }

    // Final reminder at the end
    sections.push(
      `## ⚠️ REMINDER: You MUST write the files\n` +
      `Do NOT just explain what needs to change. Use your Write tool to save the corrected file(s) to ${outputDir}/.\n` +
      `If you do not write the files, your fixes will be LOST and the pipeline will FAIL.`,
    )

    return sections.filter(Boolean).join('\n\n')
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
