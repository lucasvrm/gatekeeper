/**
 * @fileoverview Testes unitários para validar os defaults de provider e model
 *
 * Este arquivo testa o contrato: claude-code-default-provider
 * - ProviderEnum deve incluir 'claude-code' e usar como default
 * - Fallbacks hardcoded devem ser 'claude-code' e 'opus'
 *
 * Veja contract.md para detalhes das cláusulas
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { z } from 'zod'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    agentPhaseConfig: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

vi.mock('../../src/db/client.js', async () => ({
  prisma: mockPrisma,
}))

vi.mock('../../src/services/providers/LLMProviderRegistry.js', async () => ({
  LLMProviderRegistry: {
    fromEnv: vi.fn(() => ({
      available: vi.fn(() => []),
      has: vi.fn(() => false),
      get: vi.fn(() => null),
    })),
  },
}))

vi.mock('../../src/services/AgentToolExecutor.js', async () => ({
  AgentToolExecutor: vi.fn(),
  READ_TOOLS: [],
  WRITE_TOOLS: [],
  SAVE_ARTIFACT_TOOL: {},
}))

vi.mock('../../src/services/AgentRunnerService.js', async () => ({
  AgentRunnerService: vi.fn(() => ({
    run: vi.fn().mockResolvedValue({
      tokensUsed: 100,
      iterations: 1,
      model: 'opus',
      provider: 'claude-code',
    }),
  })),
}))

vi.mock('../../src/services/AgentPromptAssembler.js', async () => ({
  AgentPromptAssembler: vi.fn(() => ({
    assemblePrompt: vi.fn().mockResolvedValue({ systemPrompt: '', messages: [] }),
  })),
}))

vi.mock('../../src/services/OrchestratorEventService.js', async () => ({
  OrchestratorEventService: {
    emitOrchestratorEvent: vi.fn(),
  },
}))

vi.mock('../../src/services/AgentRunPersistenceService.js', async () => ({
  AgentRunPersistenceService: vi.fn(() => ({
    createRun: vi.fn(),
    createPhaseRun: vi.fn(),
    updatePhaseRun: vi.fn(),
  })),
}))

vi.mock('nanoid', async () => ({
  nanoid: vi.fn(() => 'test-run-id'),
}))

// ─── Imports ──────────────────────────────────────────────────────────────────

import {
  CreatePhaseConfigSchema,
  RunSinglePhaseSchema,
} from '../../src/api/schemas/agent.schema.js'

import { AgentRunnerController } from '../../src/api/controllers/AgentRunnerController.js'

// ─── Constants ────────────────────────────────────────────────────────────────

const EXPECTED_DEFAULT_PROVIDER = 'claude-code'
const EXPECTED_DEFAULT_MODEL = 'opus'
const LEGACY_PROVIDERS = ['anthropic', 'openai', 'mistral'] as const

// ─── Helper para extrair enum options do schema ───────────────────────────────

function getProviderEnumOptions(): string[] {
  // CreatePhaseConfigSchema.shape.provider é z.ZodDefault wrapping z.ZodEnum
  // Precisamos acessar o enum interno
  const providerSchema = CreatePhaseConfigSchema.shape.provider
  // @ts-expect-error - acessando interno do Zod para teste
  const innerEnum = providerSchema._def.innerType || providerSchema._def.schema
  if (innerEnum && '_def' in innerEnum && innerEnum._def.values) {
    return innerEnum._def.values as string[]
  }
  return []
}

// ─── Setup/Teardown ───────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.agentPhaseConfig.findUnique.mockResolvedValue(null)
  mockPrisma.agentPhaseConfig.findMany.mockResolvedValue([])
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Provider Defaults - Schema Validation', () => {
  describe('ProviderEnum', () => {
    // @clause CL-DEF-001
    it('succeeds when ProviderEnum defaults to claude-code for undefined value', () => {
      const input = { step: 1, model: 'opus' }
      const result = CreatePhaseConfigSchema.parse(input)

      expect(result.provider).toBe(EXPECTED_DEFAULT_PROVIDER)
    })

    // @clause CL-DEF-001
    it('succeeds when CreatePhaseConfigSchema applies claude-code as provider default', () => {
      const input = { step: 2, model: 'sonnet' }
      const result = CreatePhaseConfigSchema.parse(input)

      expect(result.provider).toBe(EXPECTED_DEFAULT_PROVIDER)
    })

    // @clause CL-DEF-001
    it('succeeds when parsing minimal config without provider', () => {
      const safeParse = CreatePhaseConfigSchema.safeParse({ step: 1, model: 'opus' })

      expect(safeParse.success).toBe(true)
      if (safeParse.success) {
        expect(safeParse.data.provider).toBe(EXPECTED_DEFAULT_PROVIDER)
      }
    })

    // @clause CL-DEF-002
    it('succeeds when ProviderEnum accepts claude-code as valid value', () => {
      const input = { step: 1, model: 'opus', provider: 'claude-code' }
      const result = CreatePhaseConfigSchema.safeParse(input)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.provider).toBe('claude-code')
      }
    })

    // @clause CL-DEF-002
    it('succeeds when explicit claude-code provider is preserved', () => {
      const input = { step: 3, model: 'haiku', provider: 'claude-code' }
      const result = CreatePhaseConfigSchema.parse(input)

      expect(result.provider).toBe('claude-code')
    })

    // @clause CL-DEF-002
    it('succeeds when ProviderEnum includes claude-code in valid options', () => {
      const enumOptions = getProviderEnumOptions()

      expect(enumOptions).toContain('claude-code')
    })

    // @clause CL-INV-003
    it('succeeds when ProviderEnum accepts anthropic (backward compatibility)', () => {
      const input = { step: 1, model: 'opus', provider: 'anthropic' }
      const result = CreatePhaseConfigSchema.safeParse(input)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.provider).toBe('anthropic')
      }
    })

    // @clause CL-INV-003
    it('succeeds when ProviderEnum accepts openai (backward compatibility)', () => {
      const input = { step: 1, model: 'gpt-4', provider: 'openai' }
      const result = CreatePhaseConfigSchema.safeParse(input)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.provider).toBe('openai')
      }
    })

    // @clause CL-INV-003
    it('succeeds when ProviderEnum accepts mistral (backward compatibility)', () => {
      const input = { step: 1, model: 'mistral-large', provider: 'mistral' }
      const result = CreatePhaseConfigSchema.safeParse(input)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.provider).toBe('mistral')
      }
    })

    // @clause CL-INV-003
    it('succeeds when all legacy providers are accepted without error', () => {
      for (const provider of LEGACY_PROVIDERS) {
        const input = { step: 1, model: 'test-model', provider }
        const result = CreatePhaseConfigSchema.safeParse(input)

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.provider).toBe(provider)
        }
      }
    })

    // @clause CL-INV-001
    it('succeeds when explicit anthropic provider is preserved (not overwritten)', () => {
      const input = { step: 1, model: 'claude-3', provider: 'anthropic' }
      const result = CreatePhaseConfigSchema.parse(input)

      expect(result.provider).toBe('anthropic')
      expect(result.provider).not.toBe(EXPECTED_DEFAULT_PROVIDER)
    })

    it('fails when ProviderEnum receives invalid provider value', () => {
      const input = { step: 1, model: 'test', provider: 'invalid-provider' }
      const result = CreatePhaseConfigSchema.safeParse(input)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0)
      }
    })
  })

  describe('RunSinglePhaseSchema', () => {
    it('succeeds when RunSinglePhaseSchema accepts optional provider', () => {
      const input = {
        step: 1,
        taskDescription: 'Test task description',
        projectPath: '/test/path',
      }
      const result = RunSinglePhaseSchema.safeParse(input)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.provider).toBeUndefined()
      }
    })

    it('succeeds when RunSinglePhaseSchema accepts claude-code provider', () => {
      const input = {
        step: 1,
        taskDescription: 'Test task description',
        projectPath: '/test/path',
        provider: 'claude-code',
      }
      const result = RunSinglePhaseSchema.safeParse(input)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.provider).toBe('claude-code')
      }
    })
  })
})

describe('Provider Defaults - Controller Fallback Logic', () => {
  let controller: AgentRunnerController

  beforeEach(() => {
    controller = new AgentRunnerController()
  })

  // @clause CL-DEF-003
  it('succeeds when fallback provider is claude-code without DB config', async () => {
    mockPrisma.agentPhaseConfig.findUnique.mockResolvedValue(null)

    const mockReq = {
      body: {
        step: 1,
        taskDescription: 'Test task description for testing',
        projectPath: '/test/project',
      },
    } as any

    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any

    await controller.runSinglePhase(mockReq, mockRes)

    expect(mockRes.status).toHaveBeenCalledWith(202)
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: expect.objectContaining({
          provider: EXPECTED_DEFAULT_PROVIDER,
        }),
      })
    )
  })

  // @clause CL-DEF-003
  it('succeeds when fallback chain resolves to claude-code without request provider', async () => {
    mockPrisma.agentPhaseConfig.findUnique.mockResolvedValue(null)

    const mockReq = {
      body: {
        step: 2,
        taskDescription: 'Another test task description',
        projectPath: '/another/path',
      },
    } as any

    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any

    await controller.runSinglePhase(mockReq, mockRes)

    const jsonCall = mockRes.json.mock.calls[0][0]
    expect(jsonCall.phase.provider).toBe(EXPECTED_DEFAULT_PROVIDER)
  })

  // @clause CL-DEF-003
  it('succeeds when DB config is null and provider defaults to claude-code', async () => {
    mockPrisma.agentPhaseConfig.findUnique.mockResolvedValue(null)

    const mockReq = {
      body: {
        step: 3,
        taskDescription: 'Testing DB null scenario',
        projectPath: '/test/db-null',
      },
    } as any

    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any

    await controller.runSinglePhase(mockReq, mockRes)

    const jsonCall = mockRes.json.mock.calls[0][0]
    expect(jsonCall.phase.provider).toBe(EXPECTED_DEFAULT_PROVIDER)
  })

  // @clause CL-DEF-004
  it('succeeds when fallback model is opus without DB config', async () => {
    mockPrisma.agentPhaseConfig.findUnique.mockResolvedValue(null)

    const mockReq = {
      body: {
        step: 1,
        taskDescription: 'Test task for model fallback',
        projectPath: '/test/project',
      },
    } as any

    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any

    await controller.runSinglePhase(mockReq, mockRes)

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: expect.objectContaining({
          model: EXPECTED_DEFAULT_MODEL,
        }),
      })
    )
  })

  // @clause CL-DEF-004
  it('succeeds when fallback chain resolves to opus without request model', async () => {
    mockPrisma.agentPhaseConfig.findUnique.mockResolvedValue(null)

    const mockReq = {
      body: {
        step: 2,
        taskDescription: 'Model fallback test task',
        projectPath: '/model/fallback/test',
      },
    } as any

    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any

    await controller.runSinglePhase(mockReq, mockRes)

    const jsonCall = mockRes.json.mock.calls[0][0]
    expect(jsonCall.phase.model).toBe(EXPECTED_DEFAULT_MODEL)
  })

  // @clause CL-DEF-004
  it('succeeds when DB config is null and model defaults to opus', async () => {
    mockPrisma.agentPhaseConfig.findUnique.mockResolvedValue(null)

    const mockReq = {
      body: {
        step: 4,
        taskDescription: 'Testing model default with null DB',
        projectPath: '/test/model-default',
      },
    } as any

    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any

    await controller.runSinglePhase(mockReq, mockRes)

    const jsonCall = mockRes.json.mock.calls[0][0]
    expect(jsonCall.phase.model).toBe(EXPECTED_DEFAULT_MODEL)
  })

  // @clause CL-INV-001
  it('succeeds when explicit provider anthropic is preserved', async () => {
    mockPrisma.agentPhaseConfig.findUnique.mockResolvedValue(null)

    const mockReq = {
      body: {
        step: 1,
        taskDescription: 'Test with explicit anthropic provider',
        projectPath: '/test/project',
        provider: 'anthropic',
      },
    } as any

    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any

    await controller.runSinglePhase(mockReq, mockRes)

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: expect.objectContaining({
          provider: 'anthropic',
        }),
      })
    )
  })

  // @clause CL-INV-001
  it('succeeds when explicit provider openai is not overwritten by default', async () => {
    mockPrisma.agentPhaseConfig.findUnique.mockResolvedValue(null)

    const mockReq = {
      body: {
        step: 1,
        taskDescription: 'Test with explicit openai provider',
        projectPath: '/test/project',
        provider: 'openai',
      },
    } as any

    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any

    await controller.runSinglePhase(mockReq, mockRes)

    const jsonCall = mockRes.json.mock.calls[0][0]
    expect(jsonCall.phase.provider).toBe('openai')
    expect(jsonCall.phase.provider).not.toBe(EXPECTED_DEFAULT_PROVIDER)
  })

  // @clause CL-INV-001
  it('succeeds when explicit provider mistral is preserved over default', async () => {
    mockPrisma.agentPhaseConfig.findUnique.mockResolvedValue(null)

    const mockReq = {
      body: {
        step: 2,
        taskDescription: 'Test with explicit mistral provider',
        projectPath: '/test/mistral',
        provider: 'mistral',
      },
    } as any

    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any

    await controller.runSinglePhase(mockReq, mockRes)

    const jsonCall = mockRes.json.mock.calls[0][0]
    expect(jsonCall.phase.provider).toBe('mistral')
  })

  // @clause CL-INV-002
  it('succeeds when explicit model sonnet is preserved', async () => {
    mockPrisma.agentPhaseConfig.findUnique.mockResolvedValue(null)

    const mockReq = {
      body: {
        step: 1,
        taskDescription: 'Test with explicit sonnet model',
        projectPath: '/test/project',
        model: 'sonnet',
      },
    } as any

    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any

    await controller.runSinglePhase(mockReq, mockRes)

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: expect.objectContaining({
          model: 'sonnet',
        }),
      })
    )
  })

  // @clause CL-INV-002
  it('succeeds when explicit model haiku is not overwritten by default', async () => {
    mockPrisma.agentPhaseConfig.findUnique.mockResolvedValue(null)

    const mockReq = {
      body: {
        step: 1,
        taskDescription: 'Test with explicit haiku model',
        projectPath: '/test/project',
        model: 'haiku',
      },
    } as any

    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any

    await controller.runSinglePhase(mockReq, mockRes)

    const jsonCall = mockRes.json.mock.calls[0][0]
    expect(jsonCall.phase.model).toBe('haiku')
    expect(jsonCall.phase.model).not.toBe(EXPECTED_DEFAULT_MODEL)
  })

  // @clause CL-INV-002
  it('succeeds when explicit model gpt-4 is preserved over default', async () => {
    mockPrisma.agentPhaseConfig.findUnique.mockResolvedValue(null)

    const mockReq = {
      body: {
        step: 3,
        taskDescription: 'Test with explicit gpt-4 model',
        projectPath: '/test/gpt4',
        model: 'gpt-4',
      },
    } as any

    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any

    await controller.runSinglePhase(mockReq, mockRes)

    const jsonCall = mockRes.json.mock.calls[0][0]
    expect(jsonCall.phase.model).toBe('gpt-4')
  })

  it('succeeds when DB config provider is used when request omits provider', async () => {
    mockPrisma.agentPhaseConfig.findUnique.mockResolvedValue({
      step: 1,
      provider: 'openai',
      model: 'gpt-4',
      maxTokens: 8192,
      maxIterations: 30,
      maxInputTokensBudget: 0,
      temperature: null,
      fallbackProvider: null,
      fallbackModel: null,
    })

    const mockReq = {
      body: {
        step: 1,
        taskDescription: 'Test with DB config',
        projectPath: '/test/project',
      },
    } as any

    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any

    await controller.runSinglePhase(mockReq, mockRes)

    const jsonCall = mockRes.json.mock.calls[0][0]
    expect(jsonCall.phase.provider).toBe('openai')
  })

  it('succeeds when request provider takes precedence over DB config', async () => {
    mockPrisma.agentPhaseConfig.findUnique.mockResolvedValue({
      step: 1,
      provider: 'openai',
      model: 'gpt-4',
      maxTokens: 8192,
      maxIterations: 30,
      maxInputTokensBudget: 0,
      temperature: null,
      fallbackProvider: null,
      fallbackModel: null,
    })

    const mockReq = {
      body: {
        step: 1,
        taskDescription: 'Test with explicit provider over DB',
        projectPath: '/test/project',
        provider: 'claude-code',
      },
    } as any

    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any

    await controller.runSinglePhase(mockReq, mockRes)

    const jsonCall = mockRes.json.mock.calls[0][0]
    expect(jsonCall.phase.provider).toBe('claude-code')
  })
})

describe('Provider Defaults - Complete Fallback Chain', () => {
  let controller: AgentRunnerController

  beforeEach(() => {
    controller = new AgentRunnerController()
  })

  // @clause CL-DEF-003
  // @clause CL-DEF-004
  it('succeeds when complete fallback chain uses claude-code and opus defaults', async () => {
    mockPrisma.agentPhaseConfig.findUnique.mockResolvedValue(null)

    const mockReq = {
      body: {
        step: 1,
        taskDescription: 'Complete fallback chain test',
        projectPath: '/test/fallback',
      },
    } as any

    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any

    await controller.runSinglePhase(mockReq, mockRes)

    const jsonCall = mockRes.json.mock.calls[0][0]
    expect(jsonCall.phase.provider).toBe(EXPECTED_DEFAULT_PROVIDER)
    expect(jsonCall.phase.model).toBe(EXPECTED_DEFAULT_MODEL)
  })

  // @clause CL-DEF-003
  // @clause CL-DEF-004
  it('succeeds when all steps use correct defaults without DB config', async () => {
    mockPrisma.agentPhaseConfig.findUnique.mockResolvedValue(null)

    const steps = [1, 2, 3, 4]

    for (const step of steps) {
      const mockReq = {
        body: {
          step,
          taskDescription: `Test step ${step} defaults`,
          projectPath: `/test/step/${step}`,
        },
      } as any

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any

      await controller.runSinglePhase(mockReq, mockRes)

      const jsonCall = mockRes.json.mock.calls[0][0]
      expect(jsonCall.phase.provider).toBe(EXPECTED_DEFAULT_PROVIDER)
      expect(jsonCall.phase.model).toBe(EXPECTED_DEFAULT_MODEL)
    }
  })

  // @clause CL-DEF-003
  // @clause CL-DEF-004
  it('succeeds when response contains correct defaults in phase object', async () => {
    mockPrisma.agentPhaseConfig.findUnique.mockResolvedValue(null)

    const mockReq = {
      body: {
        step: 1,
        taskDescription: 'Verify response structure',
        projectPath: '/test/response',
      },
    } as any

    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any

    await controller.runSinglePhase(mockReq, mockRes)

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: expect.any(String),
        status: 'started',
        phase: {
          step: 1,
          provider: EXPECTED_DEFAULT_PROVIDER,
          model: EXPECTED_DEFAULT_MODEL,
        },
        eventsUrl: expect.stringContaining('/api/agent/events/'),
      })
    )
  })
})
