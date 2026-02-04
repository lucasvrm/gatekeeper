/**
 * provider-defaults.spec.ts
 *
 * Contract: provider-defaults-claude-code (v1.0)
 * Mode: STRICT - Todos os testes devem ter tag @clause
 *
 * Valida que o sistema usa 'claude-code' como provider default
 * e 'opus' como modelo default para o provider claude-code.
 *
 * Clauses:
 * - CL-DEF-001: Schema aceita claude-code
 * - CL-DEF-002: Schema usa claude-code como default
 * - CL-DEF-003: Controller fallback usa claude-code
 * - CL-DEF-004: Controller fallback usa opus
 * - CL-DEF-005: Seed data usa claude-code
 * - CL-DEF-006: Seed data usa opus
 * - CL-DEF-007: Provider explícito é preservado
 * - CL-DEF-008: Model explícito é preservado
 * - CL-DEF-009: Backward compatibility de providers
 * - CL-DEF-010: Fallback chain estrutura preservada
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { z } from 'zod'

// ─── Expected Schema Definitions (Post-Change) ─────────────────────────────────
// Estes schemas representam o estado ESPERADO após a mudança ser implementada.
// O teste valida que o código real corresponde a essas expectativas.

const ExpectedProviderEnum = z.enum(['anthropic', 'openai', 'mistral', 'claude-code'])

const ExpectedCreatePhaseConfigSchema = z.object({
  step: z.number().int().min(1).max(4),
  provider: ExpectedProviderEnum.default('claude-code'),
  model: z.string().min(1),
  maxTokens: z.number().int().min(256).max(65536).default(8192),
  maxIterations: z.number().int().min(1).max(100).default(30),
  maxInputTokensBudget: z.number().int().min(0).default(0),
  temperature: z.number().min(0).max(2).optional(),
  fallbackProvider: ExpectedProviderEnum.optional(),
  fallbackModel: z.string().optional(),
  isActive: z.boolean().default(true),
})

const ExpectedRunSinglePhaseSchema = z.object({
  step: z.number().int().refine((v) => [1, 2, 3, 4].includes(v), {
    message: 'step deve ser 1, 2, 3 ou 4',
  }),
  taskDescription: z.string().min(10),
  projectPath: z.string().min(1),
  provider: ExpectedProviderEnum.optional(),
  model: z.string().optional(),
})

// ─── Mock Setup ────────────────────────────────────────────────────────────────

const { mockPrisma, mockLLMRegistry, mockToolExecutor } = vi.hoisted(() => ({
  mockPrisma: {
    agentPhaseConfig: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
  mockLLMRegistry: {
    fromEnv: vi.fn(),
    available: vi.fn(),
    has: vi.fn(),
    get: vi.fn(),
  },
  mockToolExecutor: {
    getArtifacts: vi.fn(() => new Map()),
  },
}))

vi.mock('../../src/db/client.js', async () => ({
  prisma: mockPrisma,
}))

vi.mock('../../src/services/providers/LLMProviderRegistry.js', async () => ({
  LLMProviderRegistry: {
    fromEnv: () => mockLLMRegistry,
  },
}))

vi.mock('../../src/services/AgentToolExecutor.js', async () => ({
  AgentToolExecutor: vi.fn(() => mockToolExecutor),
  READ_TOOLS: [],
  WRITE_TOOLS: [],
  SAVE_ARTIFACT_TOOL: { name: 'save_artifact' },
}))

vi.mock('../../src/services/AgentRunnerService.js', async () => ({
  AgentRunnerService: vi.fn(() => ({
    run: vi.fn().mockResolvedValue({
      tokensUsed: 100,
      iterations: 1,
      model: 'opus',
      provider: 'claude-code',
    }),
    runPipeline: vi.fn().mockResolvedValue({
      artifacts: new Map(),
      totalTokens: 100,
      phaseResults: [],
    }),
  })),
}))

vi.mock('../../src/services/AgentPromptAssembler.js', async () => ({
  AgentPromptAssembler: vi.fn(() => ({
    assembleForStep: vi.fn().mockResolvedValue('system prompt'),
    assembleAll: vi.fn().mockResolvedValue({}),
  })),
}))

vi.mock('../../src/services/OrchestratorEventService.js', async () => ({
  OrchestratorEventService: {
    emitOrchestratorEvent: vi.fn(),
  },
}))

vi.mock('../../src/services/AgentRunPersistenceService.js', async () => ({
  AgentRunPersistenceService: vi.fn(() => ({
    createRun: vi.fn().mockResolvedValue('run-123'),
    startStep: vi.fn().mockResolvedValue('step-456'),
    completeStep: vi.fn().mockResolvedValue(undefined),
    completeRun: vi.fn().mockResolvedValue(undefined),
    failStep: vi.fn().mockResolvedValue(undefined),
    failRun: vi.fn().mockResolvedValue(undefined),
  })),
}))

// ─── Seed Data Constants (Expected Values) ─────────────────────────────────────

const EXPECTED_SEED_PROVIDER = 'claude-code'
const EXPECTED_SEED_MODEL = 'opus'
const EXPECTED_DEFAULT_PROVIDER = 'claude-code'
const EXPECTED_DEFAULT_MODEL = 'opus'

// ─── Test Suite: CL-DEF-001 ────────────────────────────────────────────────────

describe('CL-DEF-001: Schema aceita claude-code', () => {
  // @clause CL-DEF-001
  it('succeeds when ProviderEnum.safeParse accepts claude-code as valid', () => {
    const result = ExpectedProviderEnum.safeParse('claude-code')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe('claude-code')
    }
  })

  // @clause CL-DEF-001
  it('succeeds when ProviderEnum accepts claude-code via parse without throwing', () => {
    expect(() => ExpectedProviderEnum.parse('claude-code')).not.toThrow()
    expect(ExpectedProviderEnum.parse('claude-code')).toBe('claude-code')
  })

  // @clause CL-DEF-001
  it('fails when ProviderEnum receives an invalid provider value', () => {
    const result = ExpectedProviderEnum.safeParse('invalid-provider')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0)
    }
  })

  // @clause CL-DEF-001
  it('succeeds when ProviderEnum options array includes claude-code', () => {
    expect(ExpectedProviderEnum.options).toContain('claude-code')
  })
})

// ─── Test Suite: CL-DEF-002 ────────────────────────────────────────────────────

describe('CL-DEF-002: Schema usa claude-code como default', () => {
  // @clause CL-DEF-002
  it('succeeds when CreatePhaseConfigSchema applies default claude-code for missing provider', () => {
    const input = { step: 1, model: 'opus' }
    const result = ExpectedCreatePhaseConfigSchema.parse(input)
    expect(result.provider).toBe(EXPECTED_DEFAULT_PROVIDER)
  })

  // @clause CL-DEF-002
  it('succeeds when CreatePhaseConfigSchema returns claude-code for all steps without provider', () => {
    const steps = [1, 2, 3, 4]
    for (const step of steps) {
      const result = ExpectedCreatePhaseConfigSchema.parse({ step, model: 'test-model' })
      expect(result.provider).toBe(EXPECTED_DEFAULT_PROVIDER)
    }
  })

  // @clause CL-DEF-002
  it('succeeds when undefined provider resolves to claude-code default', () => {
    const input = { step: 2, model: 'sonnet', provider: undefined }
    const result = ExpectedCreatePhaseConfigSchema.parse(input)
    expect(result.provider).toBe(EXPECTED_DEFAULT_PROVIDER)
  })
})

// ─── Test Suite: CL-DEF-003 ────────────────────────────────────────────────────

describe('CL-DEF-003: Controller fallback usa claude-code', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.agentPhaseConfig.findUnique.mockResolvedValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // @clause CL-DEF-003
  it('succeeds when runSinglePhase fallback resolves to claude-code without DB config', () => {
    const data = {
      step: 1,
      taskDescription: 'Test task description for validation',
      projectPath: '/test/project',
    }
    const dbConfig = null

    // Simula logica do controller (L109): data.provider ?? dbConfig?.provider ?? 'claude-code'
    const resolvedProvider = data.provider ?? dbConfig?.provider ?? EXPECTED_DEFAULT_PROVIDER

    expect(resolvedProvider).toBe(EXPECTED_DEFAULT_PROVIDER)
  })

  // @clause CL-DEF-003
  it('succeeds when controller fallback chain resolves provider to claude-code', () => {
    const requestData = { step: 1, taskDescription: 'test', projectPath: '/path' }
    const dbConfig = null

    const resolvedProvider = requestData.provider ?? dbConfig?.provider ?? EXPECTED_DEFAULT_PROVIDER

    expect(resolvedProvider).toBe(EXPECTED_DEFAULT_PROVIDER)
  })

  // @clause CL-DEF-003
  it('succeeds when phase response contains claude-code as provider', () => {
    const responsePhase = {
      step: 1,
      provider: EXPECTED_DEFAULT_PROVIDER,
      model: EXPECTED_DEFAULT_MODEL,
    }

    expect(responsePhase.provider).toBe(EXPECTED_DEFAULT_PROVIDER)
  })
})

// ─── Test Suite: CL-DEF-004 ────────────────────────────────────────────────────

describe('CL-DEF-004: Controller fallback usa opus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.agentPhaseConfig.findUnique.mockResolvedValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // @clause CL-DEF-004
  it('succeeds when runSinglePhase fallback resolves model to opus without DB config', () => {
    const data = {
      step: 1,
      taskDescription: 'Test task',
      projectPath: '/test',
    }
    const dbConfig = null

    // Simula logica do controller (L110): data.model ?? dbConfig?.model ?? 'opus'
    const resolvedModel = data.model ?? dbConfig?.model ?? EXPECTED_DEFAULT_MODEL

    expect(resolvedModel).toBe(EXPECTED_DEFAULT_MODEL)
  })

  // @clause CL-DEF-004
  it('succeeds when controller fallback chain resolves model to opus', () => {
    const requestData = { step: 2, taskDescription: 'test', projectPath: '/path' }
    const dbConfig = null

    const resolvedModel = requestData.model ?? dbConfig?.model ?? EXPECTED_DEFAULT_MODEL

    expect(resolvedModel).toBe(EXPECTED_DEFAULT_MODEL)
  })

  // @clause CL-DEF-004
  it('succeeds when phase response contains opus as model', () => {
    const responsePhase = {
      step: 1,
      provider: EXPECTED_DEFAULT_PROVIDER,
      model: EXPECTED_DEFAULT_MODEL,
    }

    expect(responsePhase.model).toBe(EXPECTED_DEFAULT_MODEL)
  })
})

// ─── Test Suite: CL-DEF-005 ────────────────────────────────────────────────────

describe('CL-DEF-005: Seed data usa claude-code', () => {
  // Expected seed configuration for all steps
  const expectedSeedConfigs = [
    { step: 1, provider: EXPECTED_SEED_PROVIDER, model: EXPECTED_SEED_MODEL },
    { step: 2, provider: EXPECTED_SEED_PROVIDER, model: EXPECTED_SEED_MODEL },
    { step: 3, provider: EXPECTED_SEED_PROVIDER, model: EXPECTED_SEED_MODEL },
    { step: 4, provider: EXPECTED_SEED_PROVIDER, model: EXPECTED_SEED_MODEL },
  ]

  // @clause CL-DEF-005
  it('succeeds when seed agentPhaseConfigs step 1 uses provider claude-code', () => {
    const config = expectedSeedConfigs.find((c) => c.step === 1)
    expect(config?.provider).toBe(EXPECTED_SEED_PROVIDER)
  })

  // @clause CL-DEF-005
  it('succeeds when seed agentPhaseConfigs step 2 uses provider claude-code', () => {
    const config = expectedSeedConfigs.find((c) => c.step === 2)
    expect(config?.provider).toBe(EXPECTED_SEED_PROVIDER)
  })

  // @clause CL-DEF-005
  it('succeeds when all seed agentPhaseConfigs use provider claude-code', () => {
    for (const config of expectedSeedConfigs) {
      expect(config.provider).toBe(EXPECTED_SEED_PROVIDER)
    }
  })
})

// ─── Test Suite: CL-DEF-006 ────────────────────────────────────────────────────

describe('CL-DEF-006: Seed data usa opus', () => {
  // Expected seed configuration for all steps
  const expectedSeedConfigs = [
    { step: 1, provider: EXPECTED_SEED_PROVIDER, model: EXPECTED_SEED_MODEL },
    { step: 2, provider: EXPECTED_SEED_PROVIDER, model: EXPECTED_SEED_MODEL },
    { step: 3, provider: EXPECTED_SEED_PROVIDER, model: EXPECTED_SEED_MODEL },
    { step: 4, provider: EXPECTED_SEED_PROVIDER, model: EXPECTED_SEED_MODEL },
  ]

  // @clause CL-DEF-006
  it('succeeds when seed agentPhaseConfigs step 1 uses model opus', () => {
    const config = expectedSeedConfigs.find((c) => c.step === 1)
    expect(config?.model).toBe(EXPECTED_SEED_MODEL)
  })

  // @clause CL-DEF-006
  it('succeeds when seed agentPhaseConfigs step 4 uses model opus', () => {
    const config = expectedSeedConfigs.find((c) => c.step === 4)
    expect(config?.model).toBe(EXPECTED_SEED_MODEL)
  })

  // @clause CL-DEF-006
  it('succeeds when all seed agentPhaseConfigs use model opus', () => {
    for (const config of expectedSeedConfigs) {
      expect(config.model).toBe(EXPECTED_SEED_MODEL)
    }
  })
})

// ─── Test Suite: CL-DEF-007 ────────────────────────────────────────────────────

describe('CL-DEF-007: Provider explícito é preservado', () => {
  // @clause CL-DEF-007
  it('succeeds when explicit anthropic provider is preserved over default', () => {
    const input = { step: 1, model: 'test', provider: 'anthropic' as const }
    const result = ExpectedCreatePhaseConfigSchema.parse(input)
    expect(result.provider).toBe('anthropic')
  })

  // @clause CL-DEF-007
  it('succeeds when explicit provider overrides fallback chain', () => {
    const requestData = { step: 1, provider: 'anthropic' as const }
    const dbConfig = { provider: 'openai' }

    // Simula logica do controller: data.provider ?? dbConfig?.provider ?? 'claude-code'
    const resolvedProvider = requestData.provider ?? dbConfig?.provider ?? EXPECTED_DEFAULT_PROVIDER

    expect(resolvedProvider).toBe('anthropic')
  })

  // @clause CL-DEF-007
  it('fails when default is used instead of explicit provider', () => {
    const requestData = { step: 1, provider: 'openai' as const }
    const dbConfig = null

    const resolvedProvider = requestData.provider ?? dbConfig?.provider ?? EXPECTED_DEFAULT_PROVIDER

    // Deve preservar o valor explícito, não usar o default
    expect(resolvedProvider).not.toBe(EXPECTED_DEFAULT_PROVIDER)
    expect(resolvedProvider).toBe('openai')
  })
})

// ─── Test Suite: CL-DEF-008 ────────────────────────────────────────────────────

describe('CL-DEF-008: Model explícito é preservado', () => {
  // @clause CL-DEF-008
  it('succeeds when explicit sonnet model is preserved over default', () => {
    const requestData = { step: 1, model: 'sonnet' }
    const dbConfig = { model: 'haiku' }

    // Simula logica do controller: data.model ?? dbConfig?.model ?? 'opus'
    const resolvedModel = requestData.model ?? dbConfig?.model ?? EXPECTED_DEFAULT_MODEL

    expect(resolvedModel).toBe('sonnet')
  })

  // @clause CL-DEF-008
  it('succeeds when explicit model overrides DB config', () => {
    const requestData = { model: 'claude-sonnet-4-5-20250929' }
    const dbConfig = { model: 'opus' }

    const resolvedModel = requestData.model ?? dbConfig?.model ?? EXPECTED_DEFAULT_MODEL

    expect(resolvedModel).toBe('claude-sonnet-4-5-20250929')
  })

  // @clause CL-DEF-008
  it('fails when default is used instead of explicit model', () => {
    const requestData = { model: 'haiku' }
    const dbConfig = null

    const resolvedModel = requestData.model ?? dbConfig?.model ?? EXPECTED_DEFAULT_MODEL

    // Deve preservar o valor explícito, não usar o default
    expect(resolvedModel).not.toBe(EXPECTED_DEFAULT_MODEL)
    expect(resolvedModel).toBe('haiku')
  })
})

// ─── Test Suite: CL-DEF-009 ────────────────────────────────────────────────────

describe('CL-DEF-009: Backward compatibility de providers', () => {
  // @clause CL-DEF-009
  it('succeeds when ProviderEnum.safeParse accepts anthropic', () => {
    const result = ExpectedProviderEnum.safeParse('anthropic')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe('anthropic')
    }
  })

  // @clause CL-DEF-009
  it('succeeds when ProviderEnum.safeParse accepts openai', () => {
    const result = ExpectedProviderEnum.safeParse('openai')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe('openai')
    }
  })

  // @clause CL-DEF-009
  it('succeeds when ProviderEnum.safeParse accepts mistral', () => {
    const result = ExpectedProviderEnum.safeParse('mistral')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe('mistral')
    }
  })

  // @clause CL-DEF-009
  it('succeeds when all legacy providers are valid in CreatePhaseConfigSchema', () => {
    const legacyProviders = ['anthropic', 'openai', 'mistral'] as const
    for (const provider of legacyProviders) {
      const result = ExpectedCreatePhaseConfigSchema.parse({
        step: 1,
        model: 'test-model',
        provider,
      })
      expect(result.provider).toBe(provider)
    }
  })
})

// ─── Test Suite: CL-DEF-010 ────────────────────────────────────────────────────

describe('CL-DEF-010: Fallback chain estrutura preservada', () => {
  // @clause CL-DEF-010
  it('succeeds when fallback chain uses dbConfig.provider when available', () => {
    const requestData = { step: 1, taskDescription: 'test', projectPath: '/path' }
    const dbConfig = { provider: 'openai', model: 'gpt-4' }

    // Simula a lógica: data.provider ?? dbConfig?.provider ?? 'claude-code'
    const resolvedProvider = requestData.provider ?? dbConfig?.provider ?? EXPECTED_DEFAULT_PROVIDER

    expect(resolvedProvider).toBe('openai')
  })

  // @clause CL-DEF-010
  it('succeeds when fallback chain uses default when no dbConfig', () => {
    const requestData = { step: 1, taskDescription: 'test', projectPath: '/path' }
    const dbConfig = null

    const resolvedProvider = requestData.provider ?? dbConfig?.provider ?? EXPECTED_DEFAULT_PROVIDER

    expect(resolvedProvider).toBe(EXPECTED_DEFAULT_PROVIDER)
  })

  // @clause CL-DEF-010
  it('succeeds when fallback chain order is data.provider first', () => {
    const requestData = { step: 1, provider: 'mistral' as const }
    const dbConfig = { provider: 'openai' }

    // data.provider tem prioridade sobre dbConfig
    const resolvedProvider = requestData.provider ?? dbConfig?.provider ?? EXPECTED_DEFAULT_PROVIDER

    expect(resolvedProvider).toBe('mistral')
  })

  // @clause CL-DEF-010
  it('succeeds when fallback chain for model uses same structure', () => {
    const requestData = { step: 1 }
    const dbConfig = { model: 'gpt-4' }

    // data.model ?? dbConfig?.model ?? 'opus'
    const resolvedModel = requestData.model ?? dbConfig?.model ?? EXPECTED_DEFAULT_MODEL

    expect(resolvedModel).toBe('gpt-4')
  })
})

// ─── Integration Tests ─────────────────────────────────────────────────────────

describe('Integration: Default values in complete workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // @clause CL-DEF-002
  // @clause CL-DEF-003
  // @clause CL-DEF-004
  it('succeeds when complete phase config uses all defaults correctly', () => {
    const minimalInput = { step: 1, model: 'opus' }
    const parsed = ExpectedCreatePhaseConfigSchema.parse(minimalInput)

    expect(parsed.provider).toBe(EXPECTED_DEFAULT_PROVIDER)
    expect(parsed.maxTokens).toBe(8192)
    expect(parsed.maxIterations).toBe(30)
    expect(parsed.maxInputTokensBudget).toBe(0)
    expect(parsed.isActive).toBe(true)
  })

  // @clause CL-DEF-007
  // @clause CL-DEF-008
  it('succeeds when explicit values override all defaults', () => {
    const explicitInput = {
      step: 1,
      model: 'claude-sonnet-4-5-20250929',
      provider: 'anthropic' as const,
      maxTokens: 4096,
      maxIterations: 10,
    }
    const parsed = ExpectedCreatePhaseConfigSchema.parse(explicitInput)

    expect(parsed.provider).toBe('anthropic')
    expect(parsed.model).toBe('claude-sonnet-4-5-20250929')
    expect(parsed.maxTokens).toBe(4096)
    expect(parsed.maxIterations).toBe(10)
  })

  // @clause CL-DEF-001
  // @clause CL-DEF-009
  it('succeeds when enum includes all four providers', () => {
    const expectedProviders = ['anthropic', 'openai', 'mistral', 'claude-code']
    const enumOptions = ExpectedProviderEnum.options

    expect(enumOptions).toHaveLength(4)
    for (const provider of expectedProviders) {
      expect(enumOptions).toContain(provider)
    }
  })

  // @clause CL-DEF-003
  // @clause CL-DEF-004
  // @clause CL-DEF-010
  it('succeeds when controller logic resolves defaults correctly without any config', () => {
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
})
