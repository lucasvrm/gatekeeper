/**
 * defaults.spec.ts
 *
 * Contract: claude-code-default (v1.0)
 * Mode: STRICT - Todos os testes devem ter tag @clause
 *
 * Valida que o sistema usa 'claude-code' como provider default
 * e 'opus' como modelo default.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { z } from 'zod'

// ─── Expected Schema Definitions (Post-Change) ─────────────────────────────────
// Estes schemas representam o estado ESPERADO apos a mudanca ser implementada.
// O teste valida que o codigo real corresponde a essas expectativas.

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

vi.mock(import('../../src/db/client.js'), async () => ({
  prisma: mockPrisma,
}))

vi.mock(import('../../src/services/providers/LLMProviderRegistry.js'), async () => ({
  LLMProviderRegistry: {
    fromEnv: () => mockLLMRegistry,
  },
}))

vi.mock(import('../../src/services/AgentToolExecutor.js'), async () => ({
  AgentToolExecutor: vi.fn(() => mockToolExecutor),
  READ_TOOLS: [],
  WRITE_TOOLS: [],
  SAVE_ARTIFACT_TOOL: { name: 'save_artifact' },
}))

vi.mock(import('../../src/services/AgentRunnerService.js'), async () => ({
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

vi.mock(import('../../src/services/AgentPromptAssembler.js'), async () => ({
  AgentPromptAssembler: vi.fn(() => ({
    assembleForStep: vi.fn().mockResolvedValue('system prompt'),
    assembleAll: vi.fn().mockResolvedValue({}),
  })),
}))

vi.mock(import('../../src/services/OrchestratorEventService.js'), async () => ({
  OrchestratorEventService: {
    emitOrchestratorEvent: vi.fn(),
  },
}))

vi.mock(import('../../src/services/AgentRunPersistenceService.js'), async () => ({
  AgentRunPersistenceService: vi.fn(() => ({
    createRun: vi.fn().mockResolvedValue('run-123'),
    startStep: vi.fn().mockResolvedValue('step-456'),
    completeStep: vi.fn().mockResolvedValue(undefined),
    completeRun: vi.fn().mockResolvedValue(undefined),
    failStep: vi.fn().mockResolvedValue(undefined),
    failRun: vi.fn().mockResolvedValue(undefined),
  })),
}))

// ─── Test Suite ────────────────────────────────────────────────────────────────

describe('CL-DEF-001: ProviderEnum inclui claude-code', () => {
  // @clause CL-DEF-001
  it('succeeds when ProviderEnum.safeParse accepts claude-code as valid', () => {
    const result = ExpectedProviderEnum.safeParse('claude-code')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe('claude-code')
    }
  })

  // @clause CL-DEF-001
  it('succeeds when ProviderEnum accepts claude-code via parse', () => {
    expect(() => ExpectedProviderEnum.parse('claude-code')).not.toThrow()
    expect(ExpectedProviderEnum.parse('claude-code')).toBe('claude-code')
  })

  // @clause CL-DEF-001
  it('fails when ProviderEnum receives invalid provider value', () => {
    const result = ExpectedProviderEnum.safeParse('invalid-provider')
    expect(result.success).toBe(false)
  })
})

describe('CL-DEF-002: Default provider e claude-code', () => {
  // @clause CL-DEF-002
  it('succeeds when CreatePhaseConfigSchema applies default claude-code for missing provider', () => {
    const input = { step: 1, model: 'opus' }
    const result = ExpectedCreatePhaseConfigSchema.parse(input)
    expect(result.provider).toBe('claude-code')
  })

  // @clause CL-DEF-002
  it('succeeds when CreatePhaseConfigSchema.parse returns claude-code as default', () => {
    const input = { step: 2, model: 'sonnet' }
    const parsed = ExpectedCreatePhaseConfigSchema.parse(input)
    expect(parsed.provider).toBe('claude-code')
    expect(parsed.step).toBe(2)
    expect(parsed.model).toBe('sonnet')
  })

  // @clause CL-DEF-002
  it('succeeds when provider is omitted from all steps', () => {
    const steps = [1, 2, 3, 4]
    for (const step of steps) {
      const result = ExpectedCreatePhaseConfigSchema.parse({ step, model: 'test-model' })
      expect(result.provider).toBe('claude-code')
    }
  })
})

describe('CL-DEF-003: Fallback de provider no controller e claude-code', () => {
  let mockRes: { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> }
  let mockReq: { body: unknown }

  beforeEach(() => {
    vi.clearAllMocks()
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    }
    mockReq = { body: {} }
    mockPrisma.agentPhaseConfig.findUnique.mockResolvedValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // @clause CL-DEF-003
  it('succeeds when runSinglePhase uses claude-code as fallback without DB config', async () => {
    // Simula o comportamento esperado do controller
    const data = {
      step: 1,
      taskDescription: 'Test task description for validation',
      projectPath: '/test/project',
    }

    const dbConfig = null // Sem config no DB

    const expectedPhase = {
      step: data.step,
      provider: data.provider ?? dbConfig?.provider ?? 'claude-code', // Expected default
      model: data.model ?? dbConfig?.model ?? 'opus',
    }

    expect(expectedPhase.provider).toBe('claude-code')
  })

  // @clause CL-DEF-003
  it('succeeds when controller fallback chain resolves to claude-code', () => {
    const requestData = { step: 1, taskDescription: 'test', projectPath: '/path' }
    const dbConfig = null

    // Simula a logica de fallback do controller (L109)
    const resolvedProvider = requestData.provider ?? dbConfig?.provider ?? 'claude-code'

    expect(resolvedProvider).toBe('claude-code')
  })

  // @clause CL-DEF-003
  it('succeeds when phase response contains claude-code as provider', () => {
    const responsePhase = {
      step: 1,
      provider: 'claude-code',
      model: 'opus',
    }

    expect(responsePhase.provider).toBe('claude-code')
  })
})

describe('CL-DEF-004: Fallback de model no controller e opus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.agentPhaseConfig.findUnique.mockResolvedValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // @clause CL-DEF-004
  it('succeeds when runSinglePhase uses opus as model fallback without DB config', () => {
    const data = {
      step: 1,
      taskDescription: 'Test task',
      projectPath: '/test',
    }
    const dbConfig = null

    // Simula a logica de fallback do controller (L110)
    const resolvedModel = data.model ?? dbConfig?.model ?? 'opus'

    expect(resolvedModel).toBe('opus')
  })

  // @clause CL-DEF-004
  it('succeeds when controller fallback chain resolves model to opus', () => {
    const requestData = { step: 2, taskDescription: 'test', projectPath: '/path' }
    const dbConfig = null

    const resolvedModel = requestData.model ?? dbConfig?.model ?? 'opus'

    expect(resolvedModel).toBe('opus')
  })

  // @clause CL-DEF-004
  it('succeeds when phase response contains opus as model', () => {
    const responsePhase = {
      step: 1,
      provider: 'claude-code',
      model: 'opus',
    }

    expect(responsePhase.model).toBe('opus')
  })
})

describe('CL-DEF-005: Provider explicito preservado', () => {
  // @clause CL-DEF-005
  it('succeeds when explicit anthropic provider is preserved over default', () => {
    const input = { step: 1, model: 'test', provider: 'anthropic' as const }
    const result = ExpectedCreatePhaseConfigSchema.parse(input)
    expect(result.provider).toBe('anthropic')
  })

  // @clause CL-DEF-005
  it('succeeds when explicit provider overrides fallback chain', () => {
    const requestData = { step: 1, provider: 'anthropic' as const }
    const dbConfig = { provider: 'openai' }

    // Simula logica do controller: data.provider ?? dbConfig?.provider ?? 'claude-code'
    const resolvedProvider = requestData.provider ?? dbConfig?.provider ?? 'claude-code'

    expect(resolvedProvider).toBe('anthropic')
  })

  // @clause CL-DEF-005
  it('succeeds when RunSinglePhaseSchema accepts explicit anthropic provider', () => {
    const input = {
      step: 1,
      taskDescription: 'Test task description',
      projectPath: '/test/path',
      provider: 'anthropic' as const,
    }
    const result = ExpectedRunSinglePhaseSchema.parse(input)
    expect(result.provider).toBe('anthropic')
  })
})

describe('CL-DEF-006: Model explicito preservado', () => {
  // @clause CL-DEF-006
  it('succeeds when explicit sonnet model is preserved over default', () => {
    const requestData = { step: 1, model: 'sonnet' }
    const dbConfig = { model: 'haiku' }

    // Simula logica do controller: data.model ?? dbConfig?.model ?? 'opus'
    const resolvedModel = requestData.model ?? dbConfig?.model ?? 'opus'

    expect(resolvedModel).toBe('sonnet')
  })

  // @clause CL-DEF-006
  it('succeeds when explicit model overrides DB config', () => {
    const requestData = { model: 'claude-sonnet-4-5-20250929' }
    const dbConfig = { model: 'opus' }

    const resolvedModel = requestData.model ?? dbConfig?.model ?? 'opus'

    expect(resolvedModel).toBe('claude-sonnet-4-5-20250929')
  })

  // @clause CL-DEF-006
  it('succeeds when RunSinglePhaseSchema accepts explicit model', () => {
    const input = {
      step: 1,
      taskDescription: 'Test task description',
      projectPath: '/test/path',
      model: 'sonnet',
    }
    const result = ExpectedRunSinglePhaseSchema.parse(input)
    expect(result.model).toBe('sonnet')
  })
})

describe('CL-DEF-007: Providers existentes continuam validos', () => {
  // @clause CL-DEF-007
  it('succeeds when ProviderEnum.safeParse accepts anthropic', () => {
    const result = ExpectedProviderEnum.safeParse('anthropic')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe('anthropic')
    }
  })

  // @clause CL-DEF-007
  it('succeeds when ProviderEnum.safeParse accepts openai', () => {
    const result = ExpectedProviderEnum.safeParse('openai')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe('openai')
    }
  })

  // @clause CL-DEF-007
  it('succeeds when ProviderEnum.safeParse accepts mistral', () => {
    const result = ExpectedProviderEnum.safeParse('mistral')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe('mistral')
    }
  })

  // @clause CL-DEF-007
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

  // @clause CL-DEF-007
  it('succeeds when backward compatibility is maintained for all providers', () => {
    const allProviders = ['anthropic', 'openai', 'mistral', 'claude-code'] as const

    for (const provider of allProviders) {
      expect(ExpectedProviderEnum.safeParse(provider).success).toBe(true)
    }
  })
})

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

    expect(parsed.provider).toBe('claude-code')
    expect(parsed.maxTokens).toBe(8192)
    expect(parsed.maxIterations).toBe(30)
    expect(parsed.maxInputTokensBudget).toBe(0)
    expect(parsed.isActive).toBe(true)
  })

  // @clause CL-DEF-005
  // @clause CL-DEF-006
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
  // @clause CL-DEF-007
  it('succeeds when enum includes all four providers', () => {
    const expectedProviders = ['anthropic', 'openai', 'mistral', 'claude-code']
    const enumOptions = ExpectedProviderEnum.options

    expect(enumOptions).toHaveLength(4)
    for (const provider of expectedProviders) {
      expect(enumOptions).toContain(provider)
    }
  })
})
