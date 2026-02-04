/**
 * LLM Provider Registry
 *
 * Factory and runtime lookup for LLM providers.
 * Instantiates providers lazily based on available API keys / config.
 *
 * Usage:
 *   const registry = new LLMProviderRegistry({
 *     anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
 *     openai: { apiKey: process.env.OPENAI_API_KEY },
 *     'claude-code': { enabled: true },
 *   })
 *
 *   const llm = registry.get('anthropic')
 *   const response = await llm.chat({ ... })
 */

import { AnthropicProvider } from './AnthropicProvider.js'
import { OpenAIProvider } from './OpenAIProvider.js'
import { MistralProvider } from './MistralProvider.js'
import { ClaudeCodeProvider } from './ClaudeCodeProvider.js'
import type { ClaudeCodeProviderConfig } from './ClaudeCodeProvider.js'
import type { LLMProvider, ProviderName } from '../../types/agent.types.js'

export interface ProviderCredentials {
  apiKey: string
}

export interface ClaudeCodeCredentials {
  enabled: true
  /** Path to claude binary (default: 'claude') */
  claudePath?: string
  /** Timeout in ms (default: 600_000) */
  timeoutMs?: number
  /** Permission mode (default: 'bypassPermissions') */
  permissionMode?: ClaudeCodeProviderConfig['permissionMode']
  /** Allowed tools */
  allowedTools?: string[]
  /** Disallowed tools */
  disallowedTools?: string[]
}

export interface ProviderRegistryConfig {
  anthropic?: ProviderCredentials
  openai?: ProviderCredentials
  mistral?: ProviderCredentials
  'claude-code'?: ClaudeCodeCredentials
}

export class LLMProviderRegistry {
  private providers = new Map<ProviderName, LLMProvider>()

  constructor(config: ProviderRegistryConfig) {
    if (config.anthropic?.apiKey) {
      this.providers.set('anthropic', new AnthropicProvider(config.anthropic.apiKey))
    }
    if (config.openai?.apiKey) {
      this.providers.set('openai', new OpenAIProvider(config.openai.apiKey))
    }
    if (config.mistral?.apiKey) {
      this.providers.set('mistral', new MistralProvider(config.mistral.apiKey))
    }
    if (config['claude-code']?.enabled) {
      const cc = config['claude-code']
      this.providers.set('claude-code', new ClaudeCodeProvider({
        claudePath: cc.claudePath,
        timeoutMs: cc.timeoutMs,
        permissionMode: cc.permissionMode,
        allowedTools: cc.allowedTools,
        disallowedTools: cc.disallowedTools,
      }))
    }
  }

  /**
   * Get a provider by name. Throws if not configured.
   */
  get(name: ProviderName): LLMProvider {
    const provider = this.providers.get(name)
    if (!provider) {
      const available = this.available()
      throw new Error(
        `Provider "${name}" not configured. ` +
          (available.length > 0
            ? `Available providers: ${available.join(', ')}`
            : 'No providers configured. Set at least one API key (or enable claude-code).'),
      )
    }
    return provider
  }

  /**
   * Check if a provider is configured and available.
   */
  has(name: ProviderName): boolean {
    return this.providers.has(name)
  }

  /**
   * List all configured provider names.
   */
  available(): ProviderName[] {
    return [...this.providers.keys()]
  }

  /**
   * Create a registry from environment variables.
   * Convenience factory for the common case.
   *
   * API-key providers:
   *   ANTHROPIC_API_KEY, OPENAI_API_KEY, MISTRAL_API_KEY
   *
   * Claude Code (no key needed):
   *   CLAUDE_CODE_ENABLED=true
   *   CLAUDE_CODE_PATH=claude (optional)
   */
  static fromEnv(env: NodeJS.ProcessEnv = process.env): LLMProviderRegistry {
    return new LLMProviderRegistry({
      anthropic: env.ANTHROPIC_API_KEY
        ? { apiKey: env.ANTHROPIC_API_KEY }
        : undefined,
      openai: env.OPENAI_API_KEY
        ? { apiKey: env.OPENAI_API_KEY }
        : undefined,
      mistral: env.MISTRAL_API_KEY
        ? { apiKey: env.MISTRAL_API_KEY }
        : undefined,
      'claude-code': env.CLAUDE_CODE_ENABLED === 'true'
        ? {
            enabled: true as const,
            claudePath: env.CLAUDE_CODE_PATH || undefined,
          }
        : undefined,
    })
  }
}
