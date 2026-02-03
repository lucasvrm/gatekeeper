/**
 * Gatekeeper Orchestrator — Pipeline
 *
 * Core orchestration logic. Each method corresponds to a UI action (button click).
 * The human controls the flow; the orchestrator executes each step.
 *
 * Pipeline:
 *   Step 0: Human writes task (UI) → calls generatePlan()
 *   Step 1: LLM₁ generates plan artifacts → saved to disk
 *   Step 2: Human clicks "Generate Tests" → calls generateSpec()
 *   Step 3: Human clicks "Validate" → uses existing Gatekeeper API
 *          (the orchestrator provides fetchRejectionReport() as helper)
 *          → Human decides: bypass, fix, or approve
 *          → If fix: calls fixArtifacts()
 *   Step 4: Human clicks "Execute" → calls execute()
 */

import { LLMClient } from './llm-client.js'
import { ArtifactManager } from './artifact-manager.js'
import { parseArtifacts, validateArtifacts, extractCommentary } from './artifact-parser.js'
import { fetchSessionContext } from './session-context.js'
import { buildPlanPrompt, buildSpecPrompt, buildFixPrompt, buildExecutionPrompt } from './prompt-builder.js'
import { executeWithSDK, executeWithCLI } from './executor.js'
import type {
  OrchestratorConfig,
  GeneratePlanInput,
  GeneratePlanOutput,
  GenerateSpecInput,
  GenerateSpecOutput,
  FixArtifactsInput,
  FixArtifactsOutput,
  ExecuteInput,
  ExecuteOutput,
  OrchestratorEvent,
  FixTarget,
} from './types.js'

export interface OrchestratorCallbacks {
  onEvent?: (event: OrchestratorEvent) => void
}

export class Orchestrator {
  private llm: LLMClient
  private artifacts: ArtifactManager
  private config: OrchestratorConfig

  constructor(config: OrchestratorConfig) {
    this.config = config
    this.llm = new LLMClient(config.anthropicApiKey)
    this.artifacts = new ArtifactManager(config.artifactsDir)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 1: Generate Plan
  // ─────────────────────────────────────────────────────────────────────────

  async generatePlan(
    input: GeneratePlanInput,
    callbacks: OrchestratorCallbacks = {}
  ): Promise<GeneratePlanOutput> {
    const outputId = this.artifacts.generateOutputId(input.taskDescription)
    const model = input.model || this.config.defaultModel

    callbacks.onEvent?.({ type: 'step:start', step: 1, name: 'create_plan' })

    // Fetch session context
    const session = await fetchSessionContext(
      this.config.gatekeeperApiUrl,
      input.profileId
    )

    // Build prompt (fetches instructions/docs/prompts from DB)
    const prompt = await buildPlanPrompt(
      input.taskDescription,
      outputId,
      this.config.gatekeeperApiUrl,
      session,
      input.taskType
    )

    // Call LLM with streaming
    const response = await this.llm.stream(prompt, {
      onText: (chunk) => {
        callbacks.onEvent?.({ type: 'step:llm_chunk', step: 1, text: chunk })
      },
    }, { model, maxTokens: this.config.maxTokens })

    // Parse artifacts from response
    const parsed = parseArtifacts(response.text)
    const missing = validateArtifacts(parsed, ['plan.json', 'contract.md', 'task.spec.md'])

    if (missing.length > 0) {
      callbacks.onEvent?.({
        type: 'step:error',
        step: 1,
        error: `Artefatos faltando: ${missing.join(', ')}`,
      })
      throw new OrchestratorError(
        `LLM failed to generate required artifacts: ${missing.join(', ')}`,
        'MISSING_ARTIFACTS',
        { missing, outputId }
      )
    }

    // Save to disk
    this.artifacts.saveArtifacts(outputId, parsed)

    for (const artifact of parsed) {
      callbacks.onEvent?.({ type: 'step:artifact', step: 1, filename: artifact.filename })
    }

    callbacks.onEvent?.({ type: 'step:complete', step: 1, tokensUsed: response.tokensUsed })

    return {
      outputId,
      artifacts: parsed,
      tokensUsed: response.tokensUsed,
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 2: Generate Spec Test
  // ─────────────────────────────────────────────────────────────────────────

  async generateSpec(
    input: GenerateSpecInput,
    callbacks: OrchestratorCallbacks = {}
  ): Promise<GenerateSpecOutput> {
    const { outputId } = input
    const model = input.model || this.config.defaultModel

    callbacks.onEvent?.({ type: 'step:start', step: 2, name: 'generate_spec' })

    // Read existing artifacts
    const planContent = this.artifacts.readArtifact(outputId, 'plan.json')
    const contractContent = this.artifacts.readArtifact(outputId, 'contract.md')
    const specContent = this.artifacts.readArtifact(outputId, 'task.spec.md')

    if (!planContent || !contractContent || !specContent) {
      const missing: string[] = []
      if (!planContent) missing.push('plan.json')
      if (!contractContent) missing.push('contract.md')
      if (!specContent) missing.push('task.spec.md')
      throw new OrchestratorError(
        `Missing step 1 artifacts: ${missing.join(', ')}`,
        'MISSING_ARTIFACTS',
        { missing, outputId }
      )
    }

    // Fetch session context
    const session = await fetchSessionContext(
      this.config.gatekeeperApiUrl,
      input.profileId
    )

    // Build prompt (fetches instructions/docs/prompts from DB)
    const prompt = await buildSpecPrompt(
      outputId,
      planContent,
      contractContent,
      specContent,
      this.config.gatekeeperApiUrl,
      session
    )

    // Call LLM with streaming
    const response = await this.llm.stream(prompt, {
      onText: (chunk) => {
        callbacks.onEvent?.({ type: 'step:llm_chunk', step: 2, text: chunk })
      },
    }, { model, maxTokens: this.config.maxTokens })

    // Parse test file from response
    const parsed = parseArtifacts(response.text)

    if (parsed.length === 0) {
      callbacks.onEvent?.({
        type: 'step:error',
        step: 2,
        error: 'LLM não gerou nenhum arquivo de teste',
      })
      throw new OrchestratorError(
        'LLM failed to generate test file',
        'MISSING_ARTIFACTS',
        { outputId }
      )
    }

    // Save to disk (same outputId folder)
    this.artifacts.saveArtifacts(outputId, parsed)

    for (const artifact of parsed) {
      callbacks.onEvent?.({ type: 'step:artifact', step: 2, filename: artifact.filename })
    }

    callbacks.onEvent?.({ type: 'step:complete', step: 2, tokensUsed: response.tokensUsed })

    return {
      artifacts: parsed,
      tokensUsed: response.tokensUsed,
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Fix: Correction after Gatekeeper rejection
  // ─────────────────────────────────────────────────────────────────────────

  async fixArtifacts(
    input: FixArtifactsInput,
    callbacks: OrchestratorCallbacks = {}
  ): Promise<FixArtifactsOutput> {
    const { outputId, target, runId, failedValidators } = input
    const model = input.model || this.config.defaultModel

    const attempt = 1 // Could track retries externally
    callbacks.onEvent?.({ type: 'fix:start', target, attempt })

    // Read all current artifacts
    const artifacts = this.artifacts.readAllArtifacts(outputId)

    // Fetch rejection report from Gatekeeper API
    const rejectionReport = await this.fetchRejectionReport(runId)

    // Fetch session context
    const session = await fetchSessionContext(
      this.config.gatekeeperApiUrl,
      input.profileId
    )

    // Build fix prompt (fetches instructions/docs/prompts from DB)
    const prompt = await buildFixPrompt(
      target,
      outputId,
      artifacts,
      rejectionReport,
      failedValidators,
      this.config.gatekeeperApiUrl,
      session
    )

    // Call LLM with streaming
    const response = await this.llm.stream(prompt, {
      onText: (chunk) => {
        callbacks.onEvent?.({ type: 'step:llm_chunk', step: 3, text: chunk })
      },
    }, { model, maxTokens: this.config.maxTokens })

    // Parse corrected artifacts
    const parsed = parseArtifacts(response.text)
    const corrections = extractCommentary(response.text)
      .split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
      .map(line => line.trim())

    if (parsed.length === 0) {
      throw new OrchestratorError(
        'LLM failed to generate corrected artifacts',
        'FIX_FAILED',
        { outputId, target }
      )
    }

    // Overwrite existing artifacts with corrected versions
    this.artifacts.saveArtifacts(outputId, parsed)

    callbacks.onEvent?.({
      type: 'fix:complete',
      corrections: corrections.length > 0 ? corrections : ['Artifacts corrected (see response for details)'],
    })

    return {
      artifacts: parsed,
      corrections,
      tokensUsed: response.tokensUsed,
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 4: Execute
  // ─────────────────────────────────────────────────────────────────────────

  async execute(
    input: ExecuteInput,
    callbacks: OrchestratorCallbacks = {}
  ): Promise<ExecuteOutput> {
    const { outputId, projectPath } = input

    // Read all artifacts
    const artifacts = this.artifacts.readAllArtifacts(outputId)

    if (Object.keys(artifacts).length === 0) {
      throw new OrchestratorError(
        `No artifacts found for ${outputId}`,
        'MISSING_ARTIFACTS',
        { outputId }
      )
    }

    // Fetch session context
    const session = await fetchSessionContext(this.config.gatekeeperApiUrl)

    // Build execution prompt (fetches instructions/docs/prompts from DB)
    const prompt = await buildExecutionPrompt(
      outputId,
      artifacts,
      this.config.gatekeeperApiUrl,
      session
    )

    // Try SDK first (Mode B), fall back to CLI (Mode C)
    try {
      return await executeWithSDK(prompt, projectPath, {
        onEvent: callbacks.onEvent,
      })
    } catch {
      return await executeWithCLI(prompt, projectPath, {
        onEvent: callbacks.onEvent,
      })
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helper: Fetch rejection report from Gatekeeper
  // ─────────────────────────────────────────────────────────────────────────

  async fetchRejectionReport(runId: string): Promise<string> {
    try {
      const res = await fetch(`${this.config.gatekeeperApiUrl}/runs/${runId}/results`)
      if (!res.ok) return `[Failed to fetch run results: HTTP ${res.status}]`

      const run = await res.json()

      let report = `## Run: ${runId}\n`
      report += `Status: ${run.status}\n\n`

      if (run.gateResults?.length) {
        for (const gate of run.gateResults) {
          if (!gate.passed) {
            report += `### Gate ${gate.gateNumber}: ${gate.gateName} — FAILED\n`
          }
        }
      }

      if (run.validatorResults?.length) {
        report += `\n### Failed Validators\n`
        for (const v of run.validatorResults) {
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

  // ─────────────────────────────────────────────────────────────────────────
  // Expose artifact manager for external use
  // ─────────────────────────────────────────────────────────────────────────

  getArtifactManager(): ArtifactManager {
    return this.artifacts
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Error class
// ─────────────────────────────────────────────────────────────────────────────

export class OrchestratorError extends Error {
  code: string
  details?: Record<string, unknown>

  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'OrchestratorError'
    this.code = code
    this.details = details
  }
}
