/**
 * LLM Provider Registry
 *
 * Factory and runtime lookup for LLM providers.
 * Instantiates providers lazily based on available API keys.
 *
 * Usage:
 *   const registry = new LLMProviderRegistry({
 *     anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
 *     openai: { apiKey: process.env.OPENAI_API_KEY },
 *   })
 *
 *   const llm = registry.get('anthropic')
 *   const response = await llm.chat({ ... })
 */

import { AnthropicProvider } from './AnthropicProvider.js'
import { OpenAIProvider } from './OpenAIProvider.js'
import { MistralProvider } from './MistralProvider.js'
import type { LLMProvider, ProviderName } from '../../types/agent.types.js'

export interface ProviderCredentials {
  apiKey: string
}

export interface ProviderRegistryConfig {
  anthropic?: ProviderCredentials
  openai?: ProviderCredentials
  mistral?: ProviderCredentials
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
            : 'No providers configured. Set at least one API key.'),
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
    })
  }
}
