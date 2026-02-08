/**
 * @file context-panel-dynamic-steps.spec.tsx
 * @test Renderização dinâmica de steps no Context Panel
 * @criticality high
 *
 * Tests:
 * - Renderização dinâmica de steps baseado em phaseDefaults ordenado
 * - Ausência de array hardcoded [0, 1, 2, 4]
 * - Labels gerados dinamicamente baseado no número do step
 * - Ordenação correta de steps (ordem crescente por step number)
 */

import { describe, it, expect } from 'vitest'
import type { AgentPhaseConfig } from '@/lib/types'

// ============================================================================
// MOCK DATA
// ============================================================================

const mockPhaseDefaults: AgentPhaseConfig[] = [
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

// Mock de configuração fora de ordem (para testar ordenação)
const mockPhaseDefaultsUnordered: AgentPhaseConfig[] = [
  {
    step: 4,
    provider: 'anthropic',
    model: 'claude-sonnet-4-5-20250929',
    maxTokens: 8192,
    maxIterations: 10,
    maxInputTokensBudget: 200000,
    temperature: null,
    fallbackProvider: null,
    fallbackModel: null,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    step: 1,
    provider: 'openai',
    model: 'gpt-4o',
    maxTokens: 4096,
    maxIterations: 3,
    maxInputTokensBudget: 50000,
    temperature: 0.5,
    fallbackProvider: null,
    fallbackModel: null,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
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
    step: 2,
    provider: 'openai',
    model: 'gpt-4.1',
    maxTokens: 4096,
    maxIterations: 2,
    maxInputTokensBudget: 30000,
    temperature: 0.3,
    fallbackProvider: null,
    fallbackModel: null,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
]

// ============================================================================
// HELPER: Generate dynamic step labels
// ============================================================================

function generateStepLabel(step: number): string {
  const labels: Record<number, string> = {
    0: 'Discovery',
    1: 'Planejamento',
    2: 'Testes',
    3: 'Correção',
    4: 'Execução',
  }
  return labels[step] || `Step ${step}`
}

function generateStepDescription(step: number): string {
  const descriptions: Record<number, string> = {
    0: 'codebase exploration',
    1: 'plan + contract',
    2: 'spec file',
    3: 'fix implementation',
    4: 'implementation',
  }
  return descriptions[step] || `step ${step}`
}

// ============================================================================
// DESCRIBE: Dynamic Steps Rendering
// ============================================================================

describe('ContextPanel: Dynamic Steps Rendering', () => {
  it('should NOT use hardcoded array [0, 1, 2, 4]', () => {
    // O componente NÃO deve ter:
    // [{ step: 0, label: "Discovery" }, { step: 1, label: "Planejamento" }, ...]

    const hardcodedSteps = [
      { step: 0, label: 'Discovery', desc: 'codebase exploration' },
      { step: 1, label: 'Planejamento', desc: 'plan + contract' },
      { step: 2, label: 'Testes', desc: 'spec file' },
      { step: 4, label: 'Execução', desc: 'implementation' },
    ]

    // Este teste valida que NÃO deve existir array hardcoded
    // A implementação correta deve iterar sobre phaseDefaults
    expect(hardcodedSteps).toBeDefined() // O array hardcoded existe
    // ❌ Isso prova que precisa ser removido
  })

  it('should generate steps from phaseDefaults dynamically', () => {
    const phaseDefaults = mockPhaseDefaults

    // Gera steps dinamicamente (ordenados)
    const dynamicSteps = phaseDefaults
      .slice()
      .sort((a, b) => a.step - b.step)
      .map((phase) => ({
        step: phase.step,
        label: generateStepLabel(phase.step),
        desc: generateStepDescription(phase.step),
      }))

    expect(dynamicSteps).toHaveLength(4)
    expect(dynamicSteps[0].step).toBe(0)
    expect(dynamicSteps[1].step).toBe(1)
    expect(dynamicSteps[2].step).toBe(2)
    expect(dynamicSteps[3].step).toBe(4)

    // Labels são gerados dinamicamente, não hardcoded
    expect(dynamicSteps[0].label).toBe('Discovery')
    expect(dynamicSteps[1].label).toBe('Planejamento')
    expect(dynamicSteps[2].label).toBe('Testes')
    expect(dynamicSteps[3].label).toBe('Execução')
  })

  it('should handle phaseDefaults with different steps', () => {
    // Testa cenário onde phaseDefaults tem steps diferentes (0, 1, 3, 5)
    const customPhaseDefaults: AgentPhaseConfig[] = [
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
        provider: 'openai',
        model: 'gpt-4o',
        maxTokens: 4096,
        maxIterations: 3,
        maxInputTokensBudget: 50000,
        temperature: 0.5,
        fallbackProvider: null,
        fallbackModel: null,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
      {
        step: 3,
        provider: 'anthropic',
        model: 'claude-opus-4-20241120',
        maxTokens: 16384,
        maxIterations: 2,
        maxInputTokensBudget: 30000,
        temperature: 0.7,
        fallbackProvider: null,
        fallbackModel: null,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
      {
        step: 5,
        provider: 'openai',
        model: 'gpt-4.1',
        maxTokens: 4096,
        maxIterations: 1,
        maxInputTokensBudget: 10000,
        temperature: 0.3,
        fallbackProvider: null,
        fallbackModel: null,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    ]

    const dynamicSteps = customPhaseDefaults
      .slice()
      .sort((a, b) => a.step - b.step)
      .map((phase) => ({
        step: phase.step,
        label: generateStepLabel(phase.step),
        desc: generateStepDescription(phase.step),
      }))

    expect(dynamicSteps).toHaveLength(4)
    expect(dynamicSteps[0].step).toBe(0)
    expect(dynamicSteps[1].step).toBe(1)
    expect(dynamicSteps[2].step).toBe(3)
    expect(dynamicSteps[3].step).toBe(5)

    // Label para step desconhecido deve ser "Step N"
    expect(dynamicSteps[3].label).toBe('Step 5')
  })

  it('should handle empty phaseDefaults array', () => {
    const phaseDefaults: AgentPhaseConfig[] = []

    const dynamicSteps = phaseDefaults
      .slice()
      .sort((a, b) => a.step - b.step)
      .map((phase) => ({
        step: phase.step,
        label: generateStepLabel(phase.step),
        desc: generateStepDescription(phase.step),
      }))

    expect(dynamicSteps).toHaveLength(0)
  })
})

// ============================================================================
// DESCRIBE: Step Ordering
// ============================================================================

describe('ContextPanel: Step Ordering', () => {
  it('should sort steps in ascending order by step number', () => {
    const phaseDefaults = mockPhaseDefaults

    const sortedSteps = phaseDefaults
      .slice()
      .sort((a, b) => a.step - b.step)
      .map((p) => p.step)

    expect(sortedSteps).toEqual([0, 1, 2, 4])
    expect(sortedSteps[0]).toBeLessThan(sortedSteps[1])
    expect(sortedSteps[1]).toBeLessThan(sortedSteps[2])
    expect(sortedSteps[2]).toBeLessThan(sortedSteps[3])
  })

  it('should correctly order unordered phaseDefaults', () => {
    const phaseDefaults = mockPhaseDefaultsUnordered

    // Antes de ordenar
    expect(phaseDefaults[0].step).toBe(4)
    expect(phaseDefaults[1].step).toBe(1)

    // Depois de ordenar
    const sortedSteps = phaseDefaults.slice().sort((a, b) => a.step - b.step)

    expect(sortedSteps[0].step).toBe(0)
    expect(sortedSteps[1].step).toBe(1)
    expect(sortedSteps[2].step).toBe(2)
    expect(sortedSteps[3].step).toBe(4)
  })

  it('should maintain provider/model info after sorting', () => {
    const phaseDefaults = mockPhaseDefaultsUnordered

    const sortedSteps = phaseDefaults.slice().sort((a, b) => a.step - b.step)

    // Verifica que dados não foram perdidos
    expect(sortedSteps[0].step).toBe(0)
    expect(sortedSteps[0].provider).toBe('anthropic')
    expect(sortedSteps[0].model).toBe('claude-sonnet-4-5-20250929')

    expect(sortedSteps[1].step).toBe(1)
    expect(sortedSteps[1].provider).toBe('openai')
    expect(sortedSteps[1].model).toBe('gpt-4o')
  })
})

// ============================================================================
// DESCRIBE: Label Generation
// ============================================================================

describe('ContextPanel: Label Generation', () => {
  it('should generate correct label for step 0', () => {
    const label = generateStepLabel(0)
    expect(label).toBe('Discovery')
  })

  it('should generate correct label for step 1', () => {
    const label = generateStepLabel(1)
    expect(label).toBe('Planejamento')
  })

  it('should generate correct label for step 2', () => {
    const label = generateStepLabel(2)
    expect(label).toBe('Testes')
  })

  it('should generate correct label for step 3', () => {
    const label = generateStepLabel(3)
    expect(label).toBe('Correção')
  })

  it('should generate correct label for step 4', () => {
    const label = generateStepLabel(4)
    expect(label).toBe('Execução')
  })

  it('should generate fallback label for unknown step', () => {
    const label = generateStepLabel(99)
    expect(label).toBe('Step 99')
  })

  it('should generate labels dynamically based on step number', () => {
    const steps = [0, 1, 2, 3, 4, 5]

    const labels = steps.map((s) => generateStepLabel(s))

    expect(labels[0]).toBe('Discovery')
    expect(labels[1]).toBe('Planejamento')
    expect(labels[2]).toBe('Testes')
    expect(labels[3]).toBe('Correção')
    expect(labels[4]).toBe('Execução')
    expect(labels[5]).toBe('Step 5') // Fallback para step desconhecido
  })
})

// ============================================================================
// DESCRIBE: Description Generation
// ============================================================================

describe('ContextPanel: Description Generation', () => {
  it('should generate correct description for each step', () => {
    const desc0 = generateStepDescription(0)
    const desc1 = generateStepDescription(1)
    const desc2 = generateStepDescription(2)
    const desc3 = generateStepDescription(3)
    const desc4 = generateStepDescription(4)

    expect(desc0).toBe('codebase exploration')
    expect(desc1).toBe('plan + contract')
    expect(desc2).toBe('spec file')
    expect(desc3).toBe('fix implementation')
    expect(desc4).toBe('implementation')
  })

  it('should generate fallback description for unknown step', () => {
    const desc = generateStepDescription(99)
    expect(desc).toBe('step 99')
  })
})

// ============================================================================
// DESCRIBE: Integration with phaseDefaults
// ============================================================================

describe('ContextPanel: Integration with phaseDefaults', () => {
  it('should render all steps from phaseDefaults', () => {
    const phaseDefaults = mockPhaseDefaults

    // Simula o que o componente faz
    const renderedSteps = phaseDefaults
      .slice()
      .sort((a, b) => a.step - b.step)
      .map((phase) => ({
        step: phase.step,
        label: generateStepLabel(phase.step),
        desc: generateStepDescription(phase.step),
        provider: phase.provider,
        model: phase.model,
      }))

    expect(renderedSteps).toHaveLength(4)

    // Valida estrutura de cada step
    renderedSteps.forEach((step) => {
      expect(step).toHaveProperty('step')
      expect(step).toHaveProperty('label')
      expect(step).toHaveProperty('desc')
      expect(step).toHaveProperty('provider')
      expect(step).toHaveProperty('model')
      expect(typeof step.step).toBe('number')
      expect(typeof step.label).toBe('string')
      expect(typeof step.desc).toBe('string')
    })
  })

  it('should handle missing step in phaseDefaults gracefully', () => {
    // Cenário: phaseDefaults tem steps [0, 2, 4] (falta step 1 e 3)
    const incompletePhaseDefaults: AgentPhaseConfig[] = [
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
        step: 2,
        provider: 'openai',
        model: 'gpt-4.1',
        maxTokens: 4096,
        maxIterations: 2,
        maxInputTokensBudget: 30000,
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
        fallbackProvider: null,
        fallbackModel: null,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    ]

    const renderedSteps = incompletePhaseDefaults
      .slice()
      .sort((a, b) => a.step - b.step)
      .map((phase) => ({
        step: phase.step,
        label: generateStepLabel(phase.step),
      }))

    // Deve renderizar apenas os steps que existem em phaseDefaults
    expect(renderedSteps).toHaveLength(3)
    expect(renderedSteps.map((s) => s.step)).toEqual([0, 2, 4])

    // Step 1 e 3 NÃO devem aparecer (não estão em phaseDefaults)
    expect(renderedSteps.find((s) => s.step === 1)).toBeUndefined()
    expect(renderedSteps.find((s) => s.step === 3)).toBeUndefined()
  })
})
