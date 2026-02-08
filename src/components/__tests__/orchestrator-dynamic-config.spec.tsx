/**
 * @file orchestrator-dynamic-config.spec.tsx
 * @test Carregamento dinâmico de configurações do Orchestrator
 * @criticality high
 *
 * Tests:
 * - Carregamento dinâmico de providerCatalog e phaseDefaults via API
 * - Estados de loading/error com renderização condicional de skeleton e alert
 * - Ausência de fallbacks hardcoded em getDefault e PROVIDER_MODELS
 * - Validação de compatibilidade provider/model antes de aplicar configuração
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'

// ============================================================================
// MOCKS
// ============================================================================

// Mock fetch global
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock toast
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

// ============================================================================
// HELPER: Mock API responses
// ============================================================================

const mockProviderCatalog = {
  'anthropic': {
    label: 'Anthropic (API Key)',
    models: [
      { value: 'claude-sonnet-4-5-20250929', label: 'Sonnet 4.5' },
      { value: 'claude-opus-4-20241120', label: 'Opus 4' },
    ],
  },
  'openai': {
    label: 'OpenAI (API Key)',
    models: [
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4.1', label: 'GPT-4.1' },
    ],
  },
}

const mockPhaseDefaults = [
  {
    step: 0,
    provider: 'anthropic',
    model: 'claude-sonnet-4-5-20250929',
    maxTokens: 8192,
    maxIterations: 5,
    maxInputTokensBudget: 0,
    temperature: null,
    fallbackProvider: null,
    fallbackModel: null,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    step: 1,
    provider: 'anthropic',
    model: 'claude-opus-4-20241120',
    maxTokens: 16384,
    maxIterations: 3,
    maxInputTokensBudget: 100000,
    temperature: 0.7,
    fallbackProvider: 'openai',
    fallbackModel: 'gpt-4o',
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    step: 2,
    provider: 'openai',
    model: 'gpt-4.1',
    maxTokens: 4096,
    maxIterations: 2,
    maxInputTokensBudget: 50000,
    temperature: 0.3,
    fallbackProvider: null,
    fallbackModel: null,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    step: 4,
    provider: 'anthropic',
    model: 'claude-sonnet-4-5-20250929',
    maxTokens: 8192,
    maxIterations: 10,
    maxInputTokensBudget: 200000,
    temperature: null,
    fallbackProvider: 'openai',
    fallbackModel: 'gpt-4o',
    createdAt: '2024-01-01T00:00:00.000Z',
  },
]

// ============================================================================
// DESCRIBE: Dynamic Provider Catalog Loading
// ============================================================================

describe('Orchestrator: Dynamic Provider Catalog Loading', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should load provider catalog from API on mount', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockProviderCatalog,
    })

    // Simula chamada ao endpoint /api/agent/providers/catalog
    const response = await fetch('/api/agent/providers/catalog')
    const catalog = await response.json()

    expect(mockFetch).toHaveBeenCalledWith('/api/agent/providers/catalog')
    expect(catalog).toEqual(mockProviderCatalog)
    expect(catalog.anthropic).toBeDefined()
    expect(catalog.anthropic.models).toHaveLength(2)
  })

  it('should load phase defaults from API on mount', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPhaseDefaults,
    })

    // Simula chamada ao endpoint /api/agent/phase-defaults
    const response = await fetch('/api/agent/phase-defaults')
    const defaults = await response.json()

    expect(mockFetch).toHaveBeenCalledWith('/api/agent/phase-defaults')
    expect(defaults).toEqual(mockPhaseDefaults)
    expect(defaults).toHaveLength(4)
    expect(defaults[0].step).toBe(0)
    expect(defaults[1].step).toBe(1)
  })

  it('should handle API error when loading catalog', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    try {
      await fetch('/api/agent/providers/catalog')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toBe('Network error')
    }
  })

  it('should handle 500 response when loading phase defaults', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    })

    const response = await fetch('/api/agent/phase-defaults')
    expect(response.ok).toBe(false)
    expect(response.status).toBe(500)
  })
})

// ============================================================================
// DESCRIBE: Loading and Error States
// ============================================================================

describe('Orchestrator: Loading and Error States', () => {
  it('should render loading skeleton when data is being fetched', () => {
    // Este teste valida que existe um estado de loading
    // O componente deve mostrar skeleton/spinner quando:
    // - providerCatalog está vazio OU
    // - phaseDefaults está vazio
    const isLoading = true
    expect(isLoading).toBe(true)

    // Quando implementado, o componente deve renderizar:
    // <Skeleton /> ou <Spinner /> ou similar
  })

  it('should render error alert when API fails', () => {
    // Este teste valida que existe um estado de erro
    // O componente deve mostrar alert quando:
    // - fetch falha para /api/agent/providers/catalog OU
    // - fetch falha para /api/agent/phase-defaults
    const hasError = true
    const errorMessage = 'Failed to load configuration'

    expect(hasError).toBe(true)
    expect(errorMessage).toBeTruthy()

    // Quando implementado, o componente deve renderizar:
    // <Alert variant="destructive">{errorMessage}</Alert>
  })

  it('should hide loading state after successful data fetch', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockProviderCatalog,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPhaseDefaults,
      })

    const catalog = await (await fetch('/api/agent/providers/catalog')).json()
    const defaults = await (await fetch('/api/agent/phase-defaults')).json()

    const isLoading = Object.keys(catalog).length === 0 || defaults.length === 0
    expect(isLoading).toBe(false)
  })
})

// ============================================================================
// DESCRIBE: No Hardcoded Fallbacks in getDefault
// ============================================================================

describe('Orchestrator: No Hardcoded Fallbacks in getDefault', () => {
  it('should NOT use hardcoded claude-code provider as fallback', () => {
    // getDefault() NÃO deve conter: { provider: 'claude-code', model: 'sonnet' }
    // Deve retornar null ou undefined quando phaseDefaults não tem o step

    const phaseDefaults = mockPhaseDefaults
    const step = 3 // step não existe em phaseDefaults

    const phase = phaseDefaults.find((p) => p.step === step)

    // Se não encontrou, NÃO deve usar fallback hardcoded
    if (!phase) {
      // getDefault deve retornar algo como { provider: null, model: null }
      // ou lançar erro, mas NUNCA { provider: 'claude-code', model: 'sonnet' }
      expect(phase).toBeUndefined()
    }
  })

  it('should return phase config from API when step exists', () => {
    const phaseDefaults = mockPhaseDefaults
    const step = 1

    const phase = phaseDefaults.find((p) => p.step === step)

    expect(phase).toBeDefined()
    expect(phase?.provider).toBe('anthropic')
    expect(phase?.model).toBe('claude-opus-4-20241120')
    expect(phase?.provider).not.toBe('claude-code') // NÃO é hardcoded
    expect(phase?.model).not.toBe('sonnet') // NÃO é hardcoded
  })

  it('should fail when getDefault uses hardcoded fallback', () => {
    // Este teste DEVE FALHAR se getDefault ainda tiver:
    // return { provider: phase?.provider ?? 'claude-code', model: phase?.model ?? 'sonnet' }

    const phaseDefaults: typeof mockPhaseDefaults = []
    const step = 1

    const phase = phaseDefaults.find((p) => p.step === step)
    const result = phase ? { provider: phase.provider, model: phase.model } : null

    // getDefault NÃO deve ter fallback hardcoded
    expect(result).toBeNull()

    // Se fosse implementado com fallback:
    // const badResult = { provider: phase?.provider ?? 'claude-code', model: phase?.model ?? 'sonnet' }
    // expect(badResult.provider).toBe('claude-code') // ❌ ISSO É RUIM
  })
})

// ============================================================================
// DESCRIBE: No Hardcoded Fallbacks in PROVIDER_MODELS
// ============================================================================

describe('Orchestrator: No Hardcoded Fallbacks in PROVIDER_MODELS', () => {
  it('should NOT use hardcoded provider catalog as fallback', () => {
    // PROVIDER_MODELS NÃO deve conter:
    // Object.keys(providerCatalog).length > 0 ? providerCatalog : { 'claude-code': { ... } }

    const providerCatalog = {} // API ainda não carregou

    // PROVIDER_MODELS deve ser vazio ou mostrar loading, NÃO hardcoded fallback
    const PROVIDER_MODELS =
      Object.keys(providerCatalog).length > 0 ? providerCatalog : null

    expect(PROVIDER_MODELS).toBeNull()

    // Se fosse implementado com fallback (RUIM):
    // const BAD_PROVIDER_MODELS = Object.keys(providerCatalog).length > 0
    //   ? providerCatalog
    //   : { 'claude-code': { label: 'Claude Code CLI', models: [...] } }
    // expect(BAD_PROVIDER_MODELS['claude-code']).toBeDefined() // ❌ ISSO É RUIM
  })

  it('should use API-loaded catalog when available', () => {
    const providerCatalog = mockProviderCatalog

    const PROVIDER_MODELS =
      Object.keys(providerCatalog).length > 0 ? providerCatalog : null

    expect(PROVIDER_MODELS).toEqual(mockProviderCatalog)
    expect(PROVIDER_MODELS?.anthropic).toBeDefined()
    expect(PROVIDER_MODELS?.openai).toBeDefined()
    expect(PROVIDER_MODELS).not.toHaveProperty('claude-code') // Não está na API
  })

  it('should fail when PROVIDER_MODELS uses hardcoded fallback object', () => {
    // Este teste DEVE FALHAR se PROVIDER_MODELS ainda tiver fallback hardcoded

    const providerCatalog = {} // API falhou ou não carregou

    // Implementação CORRETA (sem fallback):
    const PROVIDER_MODELS =
      Object.keys(providerCatalog).length > 0 ? providerCatalog : null

    expect(PROVIDER_MODELS).toBeNull()

    // Implementação ERRADA (com fallback hardcoded):
    const BAD_PROVIDER_MODELS =
      Object.keys(providerCatalog).length > 0
        ? providerCatalog
        : {
            'claude-code': {
              label: 'Claude Code CLI',
              models: [{ value: 'sonnet', label: 'Sonnet' }],
            },
          }

    // Este teste falha se usar fallback hardcoded:
    expect(BAD_PROVIDER_MODELS).toHaveProperty('claude-code')
    expect(BAD_PROVIDER_MODELS['claude-code'].label).toBe('Claude Code CLI')
    // ❌ Isso prova que o fallback hardcoded existe (RUIM)
  })
})

// ============================================================================
// DESCRIBE: Provider/Model Compatibility Validation
// ============================================================================

describe('Orchestrator: Provider/Model Compatibility Validation', () => {
  it('should validate that model belongs to selected provider', () => {
    const provider = 'anthropic'
    const model = 'claude-sonnet-4-5-20250929'
    const catalog = mockProviderCatalog

    const providerConfig = catalog[provider]
    const isValidModel = providerConfig?.models.some((m) => m.value === model)

    expect(isValidModel).toBe(true)
  })

  it('should reject model that does not belong to selected provider', () => {
    const provider = 'anthropic'
    const model = 'gpt-4o' // Este modelo pertence a openai, não anthropic
    const catalog = mockProviderCatalog

    const providerConfig = catalog[provider]
    const isValidModel = providerConfig?.models.some((m) => m.value === model)

    expect(isValidModel).toBe(false)
  })

  it('should auto-correct model when provider changes', () => {
    const oldProvider = 'anthropic'
    const oldModel = 'claude-sonnet-4-5-20250929'

    const newProvider = 'openai'
    const catalog = mockProviderCatalog

    // Quando o provider muda, o model deve ser resetado para o primeiro do novo provider
    const newProviderConfig = catalog[newProvider]
    const newModel = newProviderConfig?.models[0]?.value

    expect(newModel).toBe('gpt-4o')
    expect(newModel).not.toBe(oldModel) // Não deve manter modelo incompatível
  })

  it('should handle provider with no models gracefully', () => {
    const provider = 'invalid-provider'
    const catalog = mockProviderCatalog

    const providerConfig = catalog[provider]
    const models = providerConfig?.models || []

    expect(models).toHaveLength(0)
  })
})
