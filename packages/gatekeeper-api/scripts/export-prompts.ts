/**
 * Script para exportar todos os prompts do banco
 * Usado para sincronizar seed.ts com o estado atual do banco
 *
 * Uso: npx tsx scripts/export-prompts.ts
 */

import { PrismaClient } from '@prisma/client'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const prisma = new PrismaClient()

async function exportPrompts() {
  console.log('Exportando prompts do banco...')

  const allPrompts = await prisma.promptInstruction.findMany({
    orderBy: [
      { step: 'asc' },
      { role: 'asc' },
      { kind: 'asc' },
      { order: 'asc' },
    ],
  })

  console.log(`✓ Encontrados ${allPrompts.length} prompts no banco`)

  // Separar por categoria (mesma lógica do seed atual)
  const pipelinePrompts = allPrompts.filter(p =>
    p.step !== null &&
    p.role === 'system' &&
    ['instruction', 'doc', 'prompt', 'cli', null].includes(p.kind)
  )

  const userMessageTemplates = allPrompts.filter(p =>
    p.step !== null &&
    p.role === 'user'
  )

  const dynamicInstructionTemplates = allPrompts.filter(p =>
    p.step !== null &&
    p.kind &&
    !['instruction', 'doc', 'prompt', 'cli'].includes(p.kind)
  )

  const sessionPrompts = allPrompts.filter(p => p.step === null)

  // Gerar arrays para o seed (formato JSON simples)
  const output = {
    exportedAt: new Date().toISOString(),
    totalPrompts: allPrompts.length,
    categories: {
      pipeline: pipelinePrompts.length,
      userTemplates: userMessageTemplates.length,
      dynamic: dynamicInstructionTemplates.length,
      session: sessionPrompts.length,
    },
    pipelinePrompts: pipelinePrompts.map(p => ({
      name: p.name,
      step: p.step,
      kind: p.kind,
      role: p.role,
      order: p.order,
      isActive: p.isActive,
      content: p.content,
    })),
    userMessageTemplates: userMessageTemplates.map(p => ({
      name: p.name,
      step: p.step,
      kind: p.kind,
      role: p.role,
      order: p.order,
      isActive: p.isActive,
      content: p.content,
    })),
    dynamicInstructionTemplates: dynamicInstructionTemplates.map(p => ({
      name: p.name,
      step: p.step,
      kind: p.kind,
      role: p.role,
      order: p.order,
      isActive: p.isActive,
      content: p.content,
    })),
    sessionPrompts: sessionPrompts.map(p => ({
      name: p.name,
      kind: p.kind,
      role: p.role,
      order: p.order,
      isActive: p.isActive,
      content: p.content,
    })),
  }

  // Salvar em JSON
  const outputPath = join(__dirname, '../prisma/prompts-export.json')
  writeFileSync(outputPath, JSON.stringify(output, null, 2))

  console.log(`✓ Prompts exportados para: ${outputPath}`)
  console.log(`\nResumo:`)
  console.log(`  - Pipeline: ${pipelinePrompts.length}`)
  console.log(`  - User Templates: ${userMessageTemplates.length}`)
  console.log(`  - Dynamic Instructions: ${dynamicInstructionTemplates.length}`)
  console.log(`  - Session: ${sessionPrompts.length}`)
}

exportPrompts()
  .then(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
  .catch(async (e) => {
    console.error('Erro ao exportar prompts:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
