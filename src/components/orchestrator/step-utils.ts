/**
 * @file step-utils.ts
 * @module Orchestrator/StepUtils
 * @description Helpers para geração dinâmica de labels e descriptions de steps
 *
 * Usado por context-panel e testes para manter single source of truth.
 */

/**
 * Gera label dinâmico baseado no número do step
 * @param step - Número do step (0-4)
 * @returns Label traduzido ou fallback "Step N" para steps desconhecidos
 */
export function generateStepLabel(step: number): string {
  const labels: Record<number, string> = {
    0: 'Discovery',
    1: 'Planejamento',
    2: 'Testes',
    3: 'Correção',
    4: 'Execução',
  }
  return labels[step] || `Step ${step}`
}

/**
 * Gera description dinâmica baseado no número do step
 * @param step - Número do step (0-4)
 * @returns Description curta ou fallback "step N" para steps desconhecidos
 */
export function generateStepDescription(step: number): string {
  const descriptions: Record<number, string> = {
    0: 'codebase exploration',
    1: 'plan + contract',
    2: 'spec file',
    3: 'fix implementation',
    4: 'implementation',
  }
  return descriptions[step] || `step ${step}`
}
