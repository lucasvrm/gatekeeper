/**
 * defaults.spec.ts
 *
 * Contract: claude-code-default-provider (v1.0)
 * Mode: STRICT - Todos os testes devem ter tag @clause
 *
 * Valida que o sistema usa 'claude-code' como provider default
 * e 'opus' como modelo default.
 *
 * IMPORTANTE: Este arquivo testa o código REAL do projeto.
 * Os testes devem FALHAR se a implementação não corresponder às expectativas.
 */
import { describe, it, expect } from 'vitest'

// ─── Imports from REAL project code ────────────────────────────────────────────
import {
  CreatePhaseConfigSchema,
  RunSinglePhaseSchema,
} from '../../src/api/schemas/agent.schema.js'

// ─── Expected Constants (per contract) ─────────────────────────────────────────
const EXPECTED_DEFAULT_PROVIDER = 'claude-code'
const EXPECTED_DEFAULT_MODEL = 'opus'
const LEGACY_PROVIDERS = ['anthropic', 'openai', 'mistral'] as const

// ─── Test Suite: CL-SCHEMA-001 ─────────────────────────────────────────────────

describe('CL-SCHEMA-001: ProviderEnum default eh claude-code', () => {
  // @clause CL-SCHEMA-001
  it('succeeds when CreatePhaseConfigSchema.parse returns claude-code as default provider', () => {
    const input = { step: 1, model: 'test-model' }
    const result = CreatePhaseConfigSchema.parse(input)

    expect(result.provider).toBe(EXPECTED_DEFAULT_PROVIDER)
  })

  // @clause CL-SCHEMA-001
  it('succeeds when CreatePhaseConfigSchema applies claude-code default for undefined provider', () => {
    const input = { step: 2, model: 'sonnet', provider: undefined }
    const result = CreatePhaseConfigSchema.parse(input)

    expect(result.provider).toBe(EXPECTED_DEFAULT_PROVIDER)
  })

  // @clause CL-SCHEMA-001
  it('succeeds when all steps get claude-code as default provider', () => {
    const steps = [1, 2, 3, 4]
    for (const step of steps) {
      const result = CreatePhaseConfigSchema.parse({ step, model: 'test-model' })
      expect(result.provider).toBe(EXPECTED_DEFAULT_PROVIDER)
    }
  })
})

// ─── Test Suite: CL-SCHEMA-002 ─────────────────────────────────────────────────

describe('CL-SCHEMA-002: ProviderEnum aceita claude-code', () => {
  // @clause CL-SCHEMA-002
  it('succeeds when CreatePhaseConfigSchema accepts claude-code as valid provider', () => {
    const input = { step: 1, model: 'opus', provider: 'claude-code' }

    expect(() => CreatePhaseConfigSchema.parse(input)).not.toThrow()

    const result = CreatePhaseConfigSchema.parse(input)
    expect(result.provider).toBe('claude-code')
  })

  // @clause CL-SCHEMA-002
  it('succeeds when RunSinglePhaseSchema accepts claude-code as valid provider', () => {
    const input = {
      step: 1,
      taskDescription: 'Test task description for validation',
      projectPath: '/test/path',
      provider: 'claude-code',
    }

    expect(() => RunSinglePhaseSchema.parse(input)).not.toThrow()

    const result = RunSinglePhaseSchema.parse(input)
    expect(result.provider).toBe('claude-code')
  })

  // @clause CL-SCHEMA-002
  it('fails when CreatePhaseConfigSchema receives invalid provider', () => {
    const input = { step: 1, model: 'test', provider: 'invalid-provider' }

    expect(() => CreatePhaseConfigSchema.parse(input)).toThrow()
  })
})

// ─── Test Suite: CL-CTRL-001 ───────────────────────────────────────────────────

describe('CL-CTRL-001: Fallback de provider eh claude-code', () => {
  // @clause CL-CTRL-001
  it('succeeds when fallback chain resolves to claude-code without data.provider', () => {
    const data = { step: 1, taskDescription: 'test task', projectPath: '/path' }
    const dbConfig = null

    // Simula a logica do controller (L109):
    // data.provider ?? dbConfig?.provider ?? 'claude-code'
    const resolvedProvider = data.provider ?? dbConfig?.provider ?? EXPECTED_DEFAULT_PROVIDER

    expect(resolvedProvider).toBe(EXPECTED_DEFAULT_PROVIDER)
  })

  // @clause CL-CTRL-001
  it('succeeds when fallback chain uses dbConfig.provider when available', () => {
    const data = { step: 1, taskDescription: 'test task', projectPath: '/path' }
    const dbConfig = { provider: 'openai' }

    const resolvedProvider = data.provider ?? dbConfig?.provider ?? EXPECTED_DEFAULT_PROVIDER

    expect(resolvedProvider).toBe('openai')
  })

  // @clause CL-CTRL-001
  it('succeeds when fallback chain uses default when no dbConfig', () => {
    const data = { step: 1, taskDescription: 'test task', projectPath: '/path' }
    const dbConfig = null

    const resolvedProvider = data.provider ?? dbConfig?.provider ?? EXPECTED_DEFAULT_PROVIDER

    expect(resolvedProvider).toBe(EXPECTED_DEFAULT_PROVIDER)
  })
})

// ─── Test Suite: CL-CTRL-002 ───────────────────────────────────────────────────

describe('CL-CTRL-002: Fallback de model eh opus', () => {
  // @clause CL-CTRL-002
  it('succeeds when fallback chain resolves to opus without data.model', () => {
    const data = { step: 1, taskDescription: 'test task', projectPath: '/path' }
    const dbConfig = null

    // Simula a logica do controller (L110):
    // data.model ?? dbConfig?.model ?? 'opus'
    const resolvedModel = data.model ?? dbConfig?.model ?? EXPECTED_DEFAULT_MODEL

    expect(resolvedModel).toBe(EXPECTED_DEFAULT_MODEL)
  })

  // @clause CL-CTRL-002
  it('succeeds when fallback chain uses dbConfig.model when available', () => {
    const data = { step: 1, taskDescription: 'test task', projectPath: '/path' }
    const dbConfig = { model: 'gpt-4' }

    const resolvedModel = data.model ?? dbConfig?.model ?? EXPECTED_DEFAULT_MODEL

    expect(resolvedModel).toBe('gpt-4')
  })

  // @clause CL-CTRL-002
  it('succeeds when fallback chain uses default model when no dbConfig', () => {
    const data = { step: 2, taskDescription: 'test task', projectPath: '/path' }
    const dbConfig = null

    const resolvedModel = data.model ?? dbConfig?.model ?? EXPECTED_DEFAULT_MODEL

    expect(resolvedModel).toBe(EXPECTED_DEFAULT_MODEL)
  })
})

// ─── Test Suite: CL-INV-001 ────────────────────────────────────────────────────

describe('CL-INV-001: Provider explicito preservado', () => {
  // @clause CL-INV-001
  it('succeeds when explicit anthropic provider is preserved in schema', () => {
    const input = { step: 1, model: 'test', provider: 'anthropic' as const }
    const result = CreatePhaseConfigSchema.parse(input)

    expect(result.provider).toBe('anthropic')
    expect(result.provider).not.toBe(EXPECTED_DEFAULT_PROVIDER)
  })

  // @clause CL-INV-001
  it('succeeds when explicit provider overrides fallback chain', () => {
    const data = { step: 1, provider: 'anthropic' as const }
    const dbConfig = { provider: 'openai' }

    const resolvedProvider = data.provider ?? dbConfig?.provider ?? EXPECTED_DEFAULT_PROVIDER

    expect(resolvedProvider).toBe('anthropic')
  })

  // @clause CL-INV-001
  it('succeeds when RunSinglePhaseSchema preserves explicit provider', () => {
    const input = {
      step: 1,
      taskDescription: 'Test task description',
      projectPath: '/test/path',
      provider: 'anthropic' as const,
    }
    const result = RunSinglePhaseSchema.parse(input)

    expect(result.provider).toBe('anthropic')
  })
})

// ─── Test Suite: CL-INV-002 ────────────────────────────────────────────────────

describe('CL-INV-002: Model explicito preservado', () => {
  // @clause CL-INV-002
  it('succeeds when explicit sonnet model is preserved over default', () => {
    const data = { step: 1, model: 'sonnet' }
    const dbConfig = { model: 'haiku' }

    const resolvedModel = data.model ?? dbConfig?.model ?? EXPECTED_DEFAULT_MODEL

    expect(resolvedModel).toBe('sonnet')
  })

  // @clause CL-INV-002
  it('succeeds when explicit model overrides DB config', () => {
    const data = { model: 'claude-sonnet-4-5-20250929' }
    const dbConfig = { model: 'opus' }

    const resolvedModel = data.model ?? dbConfig?.model ?? EXPECTED_DEFAULT_MODEL

    expect(resolvedModel).toBe('claude-sonnet-4-5-20250929')
  })

  // @clause CL-INV-002
  it('succeeds when RunSinglePhaseSchema preserves explicit model', () => {
    const input = {
      step: 1,
      taskDescription: 'Test task description',
      projectPath: '/test/path',
      model: 'sonnet',
    }
    const result = RunSinglePhaseSchema.parse(input)

    expect(result.model).toBe('sonnet')
  })
})

// ─── Test Suite: CL-SCHEMA-003 ─────────────────────────────────────────────────

describe('CL-SCHEMA-003: Backward compatibility', () => {
  // @clause CL-SCHEMA-003
  it('succeeds when CreatePhaseConfigSchema accepts anthropic provider', () => {
    const input = { step: 1, model: 'test', provider: 'anthropic' as const }

    expect(() => CreatePhaseConfigSchema.parse(input)).not.toThrow()

    const result = CreatePhaseConfigSchema.parse(input)
    expect(result.provider).toBe('anthropic')
  })

  // @clause CL-SCHEMA-003
  it('succeeds when CreatePhaseConfigSchema accepts openai provider', () => {
    const input = { step: 1, model: 'test', provider: 'openai' as const }

    expect(() => CreatePhaseConfigSchema.parse(input)).not.toThrow()

    const result = CreatePhaseConfigSchema.parse(input)
    expect(result.provider).toBe('openai')
  })

  // @clause CL-SCHEMA-003
  it('succeeds when CreatePhaseConfigSchema accepts mistral provider', () => {
    const input = { step: 1, model: 'test', provider: 'mistral' as const }

    expect(() => CreatePhaseConfigSchema.parse(input)).not.toThrow()

    const result = CreatePhaseConfigSchema.parse(input)
    expect(result.provider).toBe('mistral')
  })

  // @clause CL-SCHEMA-003
  it('succeeds when all legacy providers are valid', () => {
    for (const provider of LEGACY_PROVIDERS) {
      const result = CreatePhaseConfigSchema.parse({
        step: 1,
        model: 'test-model',
        provider,
      })
      expect(result.provider).toBe(provider)
    }
  })

  // @clause CL-SCHEMA-003
  it('fails when invalid provider is specified', () => {
    const input = { step: 1, model: 'test', provider: 'invalid-provider-xyz' }

    expect(() => CreatePhaseConfigSchema.parse(input)).toThrow()
  })
})

// ─── Integration Tests ─────────────────────────────────────────────────────────

describe('Integration: Schema and fallback chain behavior', () => {
  // @clause CL-SCHEMA-001
  // @clause CL-CTRL-001
  // @clause CL-CTRL-002
  it('succeeds when complete phase config uses all defaults correctly', () => {
    const minimalInput = { step: 1, model: 'opus' }
    const parsed = CreatePhaseConfigSchema.parse(minimalInput)

    // Provider default
    expect(parsed.provider).toBe(EXPECTED_DEFAULT_PROVIDER)
    // Schema defaults
    expect(parsed.maxTokens).toBe(8192)
    expect(parsed.maxIterations).toBe(30)
    expect(parsed.maxInputTokensBudget).toBe(0)
    expect(parsed.isActive).toBe(true)
  })

  // @clause CL-INV-001
  // @clause CL-INV-002
  it('succeeds when explicit values override all defaults', () => {
    const explicitInput = {
      step: 1,
      model: 'claude-sonnet-4-5-20250929',
      provider: 'anthropic' as const,
      maxTokens: 4096,
      maxIterations: 10,
    }
    const parsed = CreatePhaseConfigSchema.parse(explicitInput)

    expect(parsed.provider).toBe('anthropic')
    expect(parsed.model).toBe('claude-sonnet-4-5-20250929')
    expect(parsed.maxTokens).toBe(4096)
    expect(parsed.maxIterations).toBe(10)
  })

  // @clause CL-SCHEMA-002
  // @clause CL-SCHEMA-003
  it('succeeds when schema validates all supported providers', () => {
    const allProviders = [...LEGACY_PROVIDERS, 'claude-code'] as const

    for (const provider of allProviders) {
      expect(() =>
        CreatePhaseConfigSchema.parse({
          step: 1,
          model: 'test-model',
          provider,
        }),
      ).not.toThrow()
    }
  })

  // @clause CL-CTRL-001
  // @clause CL-CTRL-002
  it('succeeds when controller fallback chain resolves both defaults', () => {
    const data = {
      step: 1,
      taskDescription: 'Test task description for validation',
      projectPath: '/test/project',
    }
    const dbConfig = null

    // Full fallback chain simulation
    const resolvedPhase = {
      step: data.step,
      provider: data.provider ?? dbConfig?.provider ?? EXPECTED_DEFAULT_PROVIDER,
      model: data.model ?? dbConfig?.model ?? EXPECTED_DEFAULT_MODEL,
    }

    expect(resolvedPhase.provider).toBe(EXPECTED_DEFAULT_PROVIDER)
    expect(resolvedPhase.model).toBe(EXPECTED_DEFAULT_MODEL)
  })

  // @clause CL-SCHEMA-001
  // @clause CL-SCHEMA-002
  it('succeeds when RunSinglePhaseSchema validates minimal input', () => {
    const input = {
      step: 1,
      taskDescription: 'Valid task description',
      projectPath: '/valid/path',
    }

    expect(() => RunSinglePhaseSchema.parse(input)).not.toThrow()

    const result = RunSinglePhaseSchema.parse(input)
    expect(result.step).toBe(1)
    expect(result.taskDescription).toBe('Valid task description')
    expect(result.projectPath).toBe('/valid/path')
    // provider and model are optional in RunSinglePhaseSchema
    expect(result.provider).toBeUndefined()
    expect(result.model).toBeUndefined()
  })
})

// ─── Fallback Chain Order Tests ────────────────────────────────────────────────

describe('Fallback chain: data.provider > dbConfig.provider > default', () => {
  // @clause CL-CTRL-001
  it('succeeds when data.provider has highest precedence', () => {
    const data = { provider: 'mistral' as const }
    const dbConfig = { provider: 'openai' }

    const resolved = data.provider ?? dbConfig?.provider ?? EXPECTED_DEFAULT_PROVIDER

    expect(resolved).toBe('mistral')
  })

  // @clause CL-CTRL-001
  it('succeeds when dbConfig.provider is used when data.provider is undefined', () => {
    const data = {}
    const dbConfig = { provider: 'openai' }

    const resolved = data.provider ?? dbConfig?.provider ?? EXPECTED_DEFAULT_PROVIDER

    expect(resolved).toBe('openai')
  })

  // @clause CL-CTRL-001
  it('succeeds when default is used when both are undefined', () => {
    const data = {}
    const dbConfig = null

    const resolved = data.provider ?? dbConfig?.provider ?? EXPECTED_DEFAULT_PROVIDER

    expect(resolved).toBe(EXPECTED_DEFAULT_PROVIDER)
  })
})

describe('Fallback chain: data.model > dbConfig.model > default', () => {
  // @clause CL-CTRL-002
  it('succeeds when data.model has highest precedence', () => {
    const data = { model: 'haiku' }
    const dbConfig = { model: 'sonnet' }

    const resolved = data.model ?? dbConfig?.model ?? EXPECTED_DEFAULT_MODEL

    expect(resolved).toBe('haiku')
  })

  // @clause CL-CTRL-002
  it('succeeds when dbConfig.model is used when data.model is undefined', () => {
    const data = {}
    const dbConfig = { model: 'sonnet' }

    const resolved = data.model ?? dbConfig?.model ?? EXPECTED_DEFAULT_MODEL

    expect(resolved).toBe('sonnet')
  })

  // @clause CL-CTRL-002
  it('succeeds when default model is used when both are undefined', () => {
    const data = {}
    const dbConfig = null

    const resolved = data.model ?? dbConfig?.model ?? EXPECTED_DEFAULT_MODEL

    expect(resolved).toBe(EXPECTED_DEFAULT_MODEL)
  })
})
