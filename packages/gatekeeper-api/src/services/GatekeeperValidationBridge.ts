/**
 * Gatekeeper Validation Bridge
 *
 * Connects the Agent Pipeline fix loop to the Gatekeeper validation system.
 *
 * Instead of heuristic text analysis ("tests passed"), this service runs the
 * real validation gates (0-3) by creating a transient ValidationRun and
 * executing it through the ValidationOrchestrator.
 *
 * Flow:
 *   1. Parse manifest/contract from pipeline artifacts (plan.json)
 *   2. Create a ValidationRun record in DB
 *   3. Execute validation synchronously via ValidationOrchestrator
 *   4. Query structured results (failed validators, gate results, rejection report)
 *   5. Return to caller for fix loop decision
 *
 * The rejection report is pre-formatted for the fixer agent, giving it
 * precise information about what failed and why — far superior to parsing
 * "tests passed" from agent text output.
 */

import { join, resolve } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { prisma } from '../db/client.js'
import { ValidationOrchestrator } from './ValidationOrchestrator.js'

// ─── Input / Output Types ─────────────────────────────────────────────────────

export interface PipelineValidationInput {
  outputId: string
  projectPath: string
  taskDescription: string
  /** DB Project ID — optional, improves artifact resolution */
  projectId?: string
  baseRef?: string
  targetRef?: string
  /** CONTRACT = gates 0-1 (plan/spec quality), EXECUTION = gates 2-3 (implementation) */
  runType: 'CONTRACT' | 'EXECUTION'
  /** Link to a previous CONTRACT run (for EXECUTION runs) */
  contractRunId?: string
  /** Pre-parsed manifest JSON — if not provided, reads from plan.json on disk */
  manifestJson?: string
  /** Pre-parsed contract JSON */
  contractJson?: string
  /** Explicit test file path (absolute) */
  testFilePath?: string
}

export interface FailedValidator {
  code: string
  name: string
  gate: number
  message: string
  details?: string
}

export interface GateResultSummary {
  gate: number
  name: string
  passed: boolean
  passedCount: number
  failedCount: number
  warningCount: number
}

export interface PipelineValidationResult {
  /** ID of the created ValidationRun (can be used for deeper inspection) */
  validationRunId: string
  passed: boolean
  status: string
  failedGate?: number
  failedGateName?: string
  failedValidatorCode?: string
  failedValidators: FailedValidator[]
  failedValidatorCodes: string[]
  gateResults: GateResultSummary[]
  /** Pre-formatted rejection report for the fixer agent */
  rejectionReport: string
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class GatekeeperValidationBridge {
  private orchestrator: ValidationOrchestrator

  constructor() {
    this.orchestrator = new ValidationOrchestrator()
  }

  /**
   * Run Gatekeeper validation against the current state of the project.
   *
   * Creates a real ValidationRun, executes it through all relevant gates,
   * and returns structured results for the fix loop.
   */
  async validate(input: PipelineValidationInput): Promise<PipelineValidationResult> {
    // ── 1. Resolve manifest data ────────────────────────────────────────

    let manifestJson = input.manifestJson
    let testFilePath = input.testFilePath
    let contractJson = input.contractJson

    if (!manifestJson) {
      const artifactData = await this.readArtifactData(input.outputId, input.projectPath)
      manifestJson = manifestJson || artifactData.manifestJson
      contractJson = contractJson || artifactData.contractJson
      testFilePath = testFilePath || artifactData.testFilePath
    }

    if (!manifestJson) {
      return this.buildSkippedResult(
        'Cannot validate: no manifest found in plan.json or input. ' +
        'Falling back to heuristic mode.',
      )
    }

    // Parse manifest to extract testFile path
    let manifest: { files?: unknown[]; testFile?: string }
    try {
      manifest = JSON.parse(manifestJson)
    } catch {
      return this.buildSkippedResult('Cannot validate: manifest JSON is invalid.')
    }

    if (!testFilePath && manifest.testFile) {
      testFilePath = join(input.projectPath, manifest.testFile).replace(/\\/g, '/')
    }

    if (!testFilePath) {
      return this.buildSkippedResult('Cannot validate: no testFilePath in manifest.')
    }

    // ── 2. Create ValidationRun ─────────────────────────────────────────

    const run = await prisma.validationRun.create({
      data: {
        projectId: input.projectId || null,
        outputId: `agent_${input.outputId}`,
        projectPath: input.projectPath,
        baseRef: input.baseRef || 'origin/main',
        targetRef: input.targetRef || 'HEAD',
        taskPrompt: input.taskDescription,
        manifestJson,
        testFilePath: testFilePath.replace(/\\/g, '/'),
        contractJson: contractJson || null,
        contractRunId: input.contractRunId || null,
        dangerMode: false,
        runType: input.runType,
        status: 'PENDING',
      },
    })

    console.log(`[GatekeeperValidationBridge] Created ValidationRun ${run.id} (type=${input.runType}) for outputId=${input.outputId}`)

    // ── 3. Execute validation synchronously ─────────────────────────────

    try {
      await this.orchestrator.executeRun(run.id)
    } catch (error) {
      console.error(
        `[GatekeeperValidationBridge] Validation execution error for run ${run.id}:`,
        error,
      )
      // Don't throw — the run record should have been updated with failure status.
      // We'll read the results from DB below.
    }

    // ── 4. Build structured result ──────────────────────────────────────

    return this.buildResultFromDb(run.id)
  }

  // ─── Result Building ──────────────────────────────────────────────────────

  private async buildResultFromDb(runId: string): Promise<PipelineValidationResult> {
    const run = await prisma.validationRun.findUnique({
      where: { id: runId },
      include: {
        gateResults: { orderBy: { gateNumber: 'asc' } },
        validatorResults: {
          orderBy: [{ gateNumber: 'asc' }, { validatorOrder: 'asc' }],
        },
      },
    })

    if (!run) {
      throw new Error(`[GatekeeperValidationBridge] ValidationRun ${runId} not found after execution`)
    }

    const failedValidators: FailedValidator[] = (run.validatorResults || [])
      .filter((v: any) => !v.passed && (v.status === 'FAILED' || v.status === 'WARNING'))
      .map((v: any) => ({
        code: v.validatorCode,
        name: v.validatorName,
        gate: v.gateNumber,
        message: v.message || 'No message',
        details: v.details || undefined,
      }))

    const gateResults: GateResultSummary[] = (run.gateResults || []).map((g: any) => ({
      gate: g.gateNumber,
      name: g.gateName,
      passed: g.passed,
      passedCount: g.passedCount,
      failedCount: g.failedCount,
      warningCount: g.warningCount,
    }))

    const failedGateResult = (run.gateResults || []).find((g: any) => !g.passed)

    const rejectionReport = this.buildRejectionReport(
      runId,
      run.status,
      gateResults,
      failedValidators,
    )

    return {
      validationRunId: runId,
      passed: run.passed,
      status: run.status,
      failedGate: run.failedAt ?? undefined,
      failedGateName: failedGateResult?.gateName,
      failedValidatorCode: run.failedValidatorCode ?? undefined,
      failedValidators,
      failedValidatorCodes: failedValidators.map((v) => v.code),
      gateResults,
      rejectionReport,
    }
  }

  /**
   * Build a human-readable (and LLM-readable) rejection report.
   *
   * This report is injected into the fixer agent's prompt, giving it
   * structured information about exactly which validators failed and why.
   */
  private buildRejectionReport(
    runId: string,
    status: string,
    gateResults: GateResultSummary[],
    failedValidators: FailedValidator[],
  ): string {
    const lines: string[] = [
      `## Gatekeeper Validation Report`,
      `**Run:** ${runId}`,
      `**Status:** ${status}`,
      '',
    ]

    // Gate summary
    for (const gate of gateResults) {
      const icon = gate.passed ? '✅' : '❌'
      lines.push(`### ${icon} Gate ${gate.gate}: ${gate.name}`)
      lines.push(
        `Passed: ${gate.passedCount} | Failed: ${gate.failedCount} | Warnings: ${gate.warningCount}`,
      )
      lines.push('')
    }

    // Failed validators detail
    if (failedValidators.length > 0) {
      lines.push('## Failed Validators (Action Required)')
      lines.push('')

      for (const v of failedValidators) {
        lines.push(`### ❌ \`${v.code}\` — ${v.name} (Gate ${v.gate})`)
        lines.push(`**Message:** ${v.message}`)

        if (v.details) {
          try {
            const details = JSON.parse(v.details)

            // Extract actionable info
            if (details.violations && Array.isArray(details.violations)) {
              lines.push(`**Scope Violations:** ${details.violations.join(', ')}`)
            }
            if (details.incompleteFiles && Array.isArray(details.incompleteFiles)) {
              lines.push(`**Incomplete Files:** ${details.incompleteFiles.join(', ')}`)
            }
            if (details.errors && Array.isArray(details.errors)) {
              lines.push(`**Errors:**`)
              for (const err of details.errors.slice(0, 20)) {
                lines.push(`- ${typeof err === 'string' ? err : JSON.stringify(err)}`)
              }
            }
            if (details.failedTests && Array.isArray(details.failedTests)) {
              lines.push(`**Failed Tests:**`)
              for (const test of details.failedTests.slice(0, 10)) {
                lines.push(`- ${typeof test === 'string' ? test : JSON.stringify(test)}`)
              }
            }

            // Full details as JSON block (truncated)
            const detailsStr = JSON.stringify(details, null, 2)
            if (detailsStr.length <= 3000) {
              lines.push('```json')
              lines.push(detailsStr)
              lines.push('```')
            } else {
              lines.push('```json')
              lines.push(detailsStr.slice(0, 3000) + '\n... (truncated)')
              lines.push('```')
            }
          } catch {
            // details is a plain string
            if (v.details.length <= 3000) {
              lines.push(`**Details:** ${v.details}`)
            } else {
              lines.push(`**Details:** ${v.details.slice(0, 3000)}... (truncated)`)
            }
          }
        }
        lines.push('')
      }
    }

    return lines.join('\n')
  }

  // ─── Artifact Reading ─────────────────────────────────────────────────────

  /**
   * Resolve the artifacts directory name from Workspace model in DB.
   * Falls back to "artifacts" if no workspace found.
   */
  private async resolveArtifactsDirName(projectPath: string): Promise<string> {
    try {
      // 1. Try DB: find workspace that contains this projectPath
      const workspaces = await prisma.workspace.findMany({
        where: { isActive: true },
      })
      for (const ws of workspaces) {
        const normalizedRoot = resolve(ws.rootPath)
        const normalizedProject = resolve(projectPath)
        if (normalizedProject.startsWith(normalizedRoot)) {
          return ws.artifactsDir || 'artifacts'
        }
      }
    } catch {
      // DB not available — fall through
    }
    return 'artifacts'
  }

  /**
   * Resolve workspace root from DB or filesystem.
   * Mirrors AgentOrchestratorBridge.resolveWorkspaceRoot().
   */
  private async resolveWorkspaceRoot(projectPath: string): Promise<string> {
    try {
      const workspaces = await prisma.workspace.findMany({
        where: { isActive: true },
      })
      for (const ws of workspaces) {
        const normalizedRoot = resolve(ws.rootPath)
        const normalizedProject = resolve(projectPath)
        if (normalizedProject.startsWith(normalizedRoot)) {
          return normalizedRoot
        }
      }
    } catch {
      // DB not available
    }

    // Fallback: walk up to .git
    let current = resolve(projectPath)
    const root = current.split('/')[0] || '/'
    while (current !== root) {
      if (existsSync(join(current, '.git'))) return current
      const parent = resolve(current, '..')
      if (parent === current) break
      current = parent
    }

    return projectPath
  }

  /**
   * Read manifest and contract from pipeline artifacts on disk.
   * Uses DB workspace resolution instead of blind filesystem walk-up.
   */
  private async readArtifactData(outputId: string, projectPath: string): Promise<{
    manifestJson?: string
    contractJson?: string
    testFilePath?: string
  }> {
    const workspaceRoot = await this.resolveWorkspaceRoot(projectPath)
    const artifactsDirName = await this.resolveArtifactsDirName(projectPath)
    const artifactDir = join(workspaceRoot, artifactsDirName, outputId)

    if (!existsSync(artifactDir)) {
      console.warn(`[GatekeeperValidationBridge] Artifact dir not found: ${artifactDir}`)
      return {}
    }

    const result: {
      manifestJson?: string
      contractJson?: string
      testFilePath?: string
    } = {}

    // ── Read plan.json for manifest ─────────────────────────────────────
    const planPath = join(artifactDir, 'plan.json')
    if (existsSync(planPath)) {
      try {
        const planRaw = readFileSync(planPath, 'utf-8')
        const plan = JSON.parse(planRaw)

        // plan.json may have manifest at top level or nested
        if (plan.manifest && plan.manifest.files && plan.manifest.testFile) {
          result.manifestJson = JSON.stringify(plan.manifest)
          result.testFilePath = join(projectPath, plan.manifest.testFile).replace(/\\/g, '/')
        } else if (plan.files && plan.testFile) {
          // plan.json might itself be the manifest
          result.manifestJson = JSON.stringify({ files: plan.files, testFile: plan.testFile })
          result.testFilePath = join(projectPath, plan.testFile).replace(/\\/g, '/')
        }
      } catch (err) {
        console.warn(`[GatekeeperValidationBridge] Failed to parse plan.json:`, err)
      }
    }

    // ── Read contract.json if present ───────────────────────────────────
    const contractPath = join(artifactDir, 'contract.json')
    if (existsSync(contractPath)) {
      try {
        result.contractJson = readFileSync(contractPath, 'utf-8')
      } catch {
        // ignore
      }
    }

    return result
  }

  // ─── Fallback ─────────────────────────────────────────────────────────────

  /**
   * Build a "skipped" result when validation can't run
   * (e.g. missing manifest). The caller can fall back to heuristic mode.
   */
  private buildSkippedResult(reason: string): PipelineValidationResult {
    console.warn(`[GatekeeperValidationBridge] Skipping validation: ${reason}`)

    return {
      validationRunId: '',
      passed: false,
      status: 'SKIPPED',
      failedValidators: [],
      failedValidatorCodes: [],
      gateResults: [],
      rejectionReport: `Validation skipped: ${reason}`,
    }
  }
}
