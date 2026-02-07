/**
 * Gatekeeper Orchestrator
 *
 * Programmatic TDD pipeline:
 *   Step 1: generatePlan()  → plan.json + contract.md + task.spec.md
 *   Step 2: generateSpec()  → spec.test
 *   Step 3: Gatekeeper validation (via existing API — human in the loop)
 *           fixArtifacts()  → corrected artifacts after rejection
 *   Step 4: execute()       → Claude Agent SDK in project context
 */

export { Orchestrator, OrchestratorError } from './pipeline.js'
export { loadConfig } from './config.js'
export { ArtifactManager } from './artifact-manager.js'
export { LLMClient } from './llm-client.js'
export { parseArtifacts, validateArtifacts, extractCommentary } from './artifact-parser.js'
export { fetchSessionContext } from './session-context.js'
export {
  buildPlanPrompt,
  buildSpecPrompt,
  buildFixPrompt,
  buildExecutionPrompt,
} from './prompt-builder.js'
export { executeWithSDK, executeWithCLI } from './executor.js'
export { MicroplanExecutor } from './microplan-executor.js'

export type {
  // Pipeline
  PipelineStep,
  PipelineState,
  StepResult,
  TokenUsage,
  ValidationState,
  FailedValidator,
  ExecutionState,
  FixTarget,

  // API Inputs/Outputs
  GeneratePlanInput,
  GeneratePlanOutput,
  GenerateSpecInput,
  GenerateSpecOutput,
  FixArtifactsInput,
  FixArtifactsOutput,
  ExecuteInput,
  ExecuteOutput,

  // Artifacts
  ParsedArtifact,

  // Events
  OrchestratorEvent,

  // Config
  OrchestratorConfig,

  // Microplans
  Microplan,
  MicroplanFile,
  MicroplansDocument,
  MicroplanAction,
} from './types.js'
