/**
 * Gatekeeper Orchestrator — Config
 */

import type { OrchestratorConfig } from './types.js'

export function loadConfig(overrides?: Partial<OrchestratorConfig>): OrchestratorConfig {
  return {
    anthropicApiKey: overrides?.anthropicApiKey || process.env.ANTHROPIC_API_KEY || '',
    defaultModel: overrides?.defaultModel || process.env.ORCHESTRATOR_MODEL || 'claude-sonnet-4-5-20250929',
    docsDir: overrides?.docsDir || process.env.DOCS_DIR || './docs',
    artifactsDir: overrides?.artifactsDir || process.env.ARTIFACTS_DIR || './artifacts',
    gatekeeperApiUrl: overrides?.gatekeeperApiUrl || process.env.GATEKEEPER_API_URL || 'http://localhost:3000/api',
    maxTokens: overrides?.maxTokens || Number(process.env.ORCHESTRATOR_MAX_TOKENS) || 8192,
  }
}
