/**
 * Migration Script: Simplified Prompts with Few-Shot Learning
 *
 * Este script atualiza os prompts do pipeline para a versão simplificada
 * baseada em exemplos concretos (few-shot) ao invés de instruções abstratas.
 *
 * Executar: npx tsx prisma/migrate-prompts-v2.ts
 *
 * Data: 2026-02-04
 */

import { PrismaClient } from '@prisma/client'
import * as v2 from './seed-prompt-content-v2'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Starting prompt migration to v2 (simplified with few-shot)...\n')

  // =============================================================================
  // STEP 1: PLANNER — Prompts Simplificados
  // =============================================================================

  const plannerPrompts = [
    {
      name: 'planner-system-v2',
      step: 1,
      kind: 'instruction',
      role: 'system',
      order: 1,
      content: v2.PLANNER_SYSTEM_PROMPT,
    },
    {
      name: 'planner-schema-reference-v2',
      step: 1,
      kind: 'doc',
      role: 'system',
      order: 2,
      content: v2.PLANNER_SCHEMA_REFERENCE,
    },
    {
      name: 'planner-examples-v2',
      step: 1,
      kind: 'doc',
      role: 'system',
      order: 3,
      content: v2.PLANNER_EXAMPLES,
    },
    {
      name: 'planner-user-message-v2',
      step: 1,
      kind: 'prompt',
      role: 'user',
      order: 1,
      content: v2.PLANNER_USER_MESSAGE_TEMPLATE,
    },
    {
      name: 'planner-mandatory-v2',
      step: 1,
      kind: 'playbook',
      role: 'system',
      order: 0,
      content: v2.PLANNER_MANDATORY,
    },
  ]

  // =============================================================================
  // STEP 2: SPEC WRITER — Prompts Simplificados
  // =============================================================================

  const specWriterPrompts = [
    {
      name: 'specwriter-system-v2',
      step: 2,
      kind: 'instruction',
      role: 'system',
      order: 1,
      content: v2.SPEC_WRITER_SYSTEM_PROMPT,
    },
    {
      name: 'specwriter-schema-reference-v2',
      step: 2,
      kind: 'doc',
      role: 'system',
      order: 2,
      content: v2.SPEC_WRITER_SCHEMA_REFERENCE,
    },
    {
      name: 'specwriter-examples-v2',
      step: 2,
      kind: 'doc',
      role: 'system',
      order: 3,
      content: v2.SPEC_WRITER_EXAMPLES,
    },
    {
      name: 'specwriter-user-message-v2',
      step: 2,
      kind: 'prompt',
      role: 'user',
      order: 1,
      content: v2.SPEC_WRITER_USER_MESSAGE_TEMPLATE,
    },
    {
      name: 'specwriter-mandatory-v2',
      step: 2,
      kind: 'playbook',
      role: 'system',
      order: 0,
      content: v2.SPEC_WRITER_MANDATORY,
    },
  ]

  // =============================================================================
  // STEP 3: FIXER — Prompts Simplificados
  // =============================================================================

  const fixerPrompts = [
    {
      name: 'fixer-system-v2',
      step: 3,
      kind: 'instruction',
      role: 'system',
      order: 1,
      content: v2.FIXER_SYSTEM_PROMPT,
    },
    {
      name: 'fixer-correction-guide-v2',
      step: 3,
      kind: 'doc',
      role: 'system',
      order: 2,
      content: v2.FIXER_CORRECTION_GUIDE,
    },
    {
      name: 'fixer-user-message-v2',
      step: 3,
      kind: 'prompt',
      role: 'user',
      order: 1,
      content: v2.FIXER_USER_MESSAGE_TEMPLATE,
    },
  ]

  // =============================================================================
  // STEP 4: EXECUTOR — Prompts Simplificados
  // =============================================================================

  const executorPrompts = [
    {
      name: 'executor-system-v2',
      step: 4,
      kind: 'instruction',
      role: 'system',
      order: 1,
      content: v2.EXECUTOR_SYSTEM_PROMPT,
    },
    {
      name: 'executor-example-v2',
      step: 4,
      kind: 'doc',
      role: 'system',
      order: 2,
      content: v2.EXECUTOR_EXAMPLE,
    },
    {
      name: 'executor-user-message-v2',
      step: 4,
      kind: 'prompt',
      role: 'user',
      order: 1,
      content: v2.EXECUTOR_USER_MESSAGE_TEMPLATE,
    },
    {
      name: 'executor-mandatory-v2',
      step: 4,
      kind: 'playbook',
      role: 'system',
      order: 0,
      content: v2.EXECUTOR_MANDATORY,
    },
  ]

  // =============================================================================
  // RETRY MESSAGES — Mantidos (são importantes)
  // =============================================================================

  const retryPrompts = [
    {
      name: 'retry-api-critical-failure',
      step: 3,
      kind: 'retry',
      role: 'user',
      order: 1,
      content: v2.RETRY_API_CRITICAL_FAILURE,
    },
    {
      name: 'retry-cli-critical-failure',
      step: 3,
      kind: 'retry-cli',
      role: 'user',
      order: 1,
      content: v2.RETRY_CLI_CRITICAL_FAILURE,
    },
    {
      name: 'retry-api-final-instruction',
      step: 3,
      kind: 'retry',
      role: 'user',
      order: 10,
      content: v2.RETRY_API_FINAL_INSTRUCTION,
    },
    {
      name: 'retry-cli-final-instruction',
      step: 3,
      kind: 'retry-cli',
      role: 'user',
      order: 10,
      content: v2.RETRY_CLI_FINAL_INSTRUCTION,
    },
    {
      name: 'retry-previous-response-reference',
      step: 3,
      kind: 'retry',
      role: 'user',
      order: 2,
      content: v2.RETRY_PREVIOUS_RESPONSE,
    },
    {
      name: 'retry-original-artifact',
      step: 3,
      kind: 'retry',
      role: 'user',
      order: 3,
      content: v2.RETRY_ORIGINAL_ARTIFACT,
    },
    {
      name: 'retry-rejection-reminder',
      step: 3,
      kind: 'retry',
      role: 'user',
      order: 4,
      content: v2.RETRY_REJECTION_REMINDER,
    },
  ]

  // =============================================================================
  // CLI APPENDS — Mantidos (necessários para Claude Code)
  // =============================================================================

  const cliAppends = [
    {
      name: 'cli-append-plan',
      step: 1,
      kind: 'system-append-cli',
      role: 'system',
      order: 1,
      content: v2.CLI_APPEND_PLAN,
    },
    {
      name: 'cli-append-spec',
      step: 2,
      kind: 'system-append-cli',
      role: 'system',
      order: 1,
      content: v2.CLI_APPEND_SPEC,
    },
    {
      name: 'cli-append-fix',
      step: 3,
      kind: 'system-append-cli',
      role: 'system',
      order: 1,
      content: v2.CLI_APPEND_FIX,
    },
    {
      name: 'cli-append-execute',
      step: 4,
      kind: 'system-append-cli',
      role: 'system',
      order: 1,
      content: v2.CLI_APPEND_EXECUTE,
    },
  ]

  // =============================================================================
  // CLI REPLACEMENTS — Mantidos
  // =============================================================================

  const cliReplacements = [
    {
      name: 'cli-replace-save-artifact-plan',
      step: 1,
      kind: 'cli-replace',
      role: 'user',
      order: 1,
      content: v2.CLI_REPLACE_SAVE_ARTIFACT_PLAN,
    },
    {
      name: 'cli-replace-critical-spec',
      step: 2,
      kind: 'cli-replace',
      role: 'user',
      order: 1,
      content: v2.CLI_REPLACE_CRITICAL_SPEC,
    },
    {
      name: 'cli-replace-reminder-spec',
      step: 2,
      kind: 'cli-replace',
      role: 'user',
      order: 2,
      content: v2.CLI_REPLACE_REMINDER_SPEC,
    },
    {
      name: 'cli-replace-execute-tools',
      step: 4,
      kind: 'cli-replace',
      role: 'user',
      order: 1,
      content: v2.CLI_REPLACE_EXECUTE_TOOLS,
    },
  ]

  // =============================================================================
  // PROMPTS DINÂMICOS — Mantidos
  // =============================================================================

  // =============================================================================
  // PROMPTS DINÂMICOS
  // =============================================================================
  // NOTA Vertex Analysis:
  // - git-strategy-*: USEFUL (contexto para decisões de git)
  // - custom-instructions-header: UNNECESSARY (removido - apenas apresentação)
  // =============================================================================

  const dynamicPrompts = [
    // REMOVIDO: custom-instructions-header (Vertex: "purely for display")
    {
      name: 'git-strategy-new-branch',
      step: null,
      kind: 'git-strategy',
      role: 'system',
      order: 1,
      content: v2.GIT_STRATEGY_NEW_BRANCH,
    },
    {
      name: 'git-strategy-existing-branch',
      step: null,
      kind: 'git-strategy',
      role: 'system',
      order: 2,
      content: v2.GIT_STRATEGY_EXISTING_BRANCH,
    },
    {
      name: 'git-strategy-main',
      step: null,
      kind: 'git-strategy',
      role: 'system',
      order: 3,
      content: v2.GIT_STRATEGY_MAIN,
    },
  ]

  // =============================================================================
  // EXECUTAR UPSERTS
  // =============================================================================

  const allPrompts = [
    ...plannerPrompts,
    ...specWriterPrompts,
    ...fixerPrompts,
    ...executorPrompts,
    ...retryPrompts,
    ...cliAppends,
    ...cliReplacements,
    ...dynamicPrompts,
  ]

  // Desativar prompts antigos
  const oldPromptNames = [
    'planner-core',
    'specwriter-core',
    'fixer-core',
    'coder-core',
    'plan-user-message',
    'spec-user-message',
    'fix-user-message',
    'fix-user-message-cli',
    'execute-user-message',
    '#STAR HERE <<<MANDATORY>>>',
    '#STAR HERE <<MANDATORY>>',
    '#STAR HERE <MANDATORY>',
    'SPEC_WRITER_PLAYBOOK',
    'EXECUTOR_PLAYBOOK',
    'step3-fixer-api-user-message',
    'FIX_PLAYBOOK',
    // VERTEX: classificado como UNNECESSARY
    'custom-instructions-header',
  ]

  console.log('📦 Desativando prompts antigos...')
  for (const name of oldPromptNames) {
    try {
      await prisma.promptInstruction.update({
        where: { name },
        data: { isActive: false },
      })
      console.log(`  ✗ Desativado: ${name}`)
    } catch {
      // Prompt não existe, ignorar
    }
  }

  console.log('\n📝 Inserindo/atualizando prompts v2...')
  for (const prompt of allPrompts) {
    await prisma.promptInstruction.upsert({
      where: { name: prompt.name },
      create: {
        ...prompt,
        isActive: true,
      },
      update: {
        content: prompt.content,
        step: prompt.step,
        kind: prompt.kind,
        role: prompt.role ?? 'system',
        order: prompt.order,
        isActive: true,
      },
    })
    console.log(`  ✓ ${prompt.name}`)
  }

  // =============================================================================
  // RESUMO
  // =============================================================================

  console.log('\n' + '='.repeat(60))
  console.log('📊 RESUMO DA MIGRAÇÃO (com análise Vertex AI)')
  console.log('='.repeat(60))
  console.log(`  Prompts desativados: ${oldPromptNames.length}`)
  console.log(`  Prompts v2 inseridos: ${allPrompts.length}`)
  console.log('')
  console.log('  Step 1 (Planner):    5 prompts (system, schema, examples, user, mandatory)')
  console.log('  Step 2 (Spec):       5 prompts (system, schema, examples, user, mandatory)')
  console.log('  Step 3 (Fixer):      10 prompts (3 core + 7 retry) — ESSENTIAL per Vertex')
  console.log('  Step 4 (Executor):   4 prompts')
  console.log('  CLI Appends:         4 prompts — USEFUL per Vertex (kept for emphasis)')
  console.log('  CLI Replacements:    4 prompts')
  console.log('  Dinâmicos:           3 prompts (removed custom-instructions-header)')
  console.log('='.repeat(60))
  console.log('')
  console.log('📋 Vertex AI Analysis Applied:')
  console.log('  ✓ Removed: custom-instructions-header (UNNECESSARY)')
  console.log('  ✓ Kept: cli-append-* (USEFUL - needed for Claude Code)')
  console.log('  ✓ Kept: retry-* prompts (ESSENTIAL - critical for error recovery)')
  console.log('  ✓ Kept: guidance-* prompts (ESSENTIAL - targeted error fixes)')
  console.log('='.repeat(60))
  console.log('\n✅ Migração concluída com sucesso!')
  console.log('\n⚠️  NOTA: Os guidances do Fixer foram mantidos no seed.ts original.')
  console.log('    Eles continuam funcionando em conjunto com os novos prompts.')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Migração falhou:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
