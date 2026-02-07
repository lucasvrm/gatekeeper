/**
 * Sincroniza seed.ts com o conteúdo do banco (via prompts-export.json)
 * Remove entries que não existem no banco
 * Atualiza arrays com conteúdo real do banco
 *
 * Uso:
 * 1. npx tsx scripts/export-prompts.ts
 * 2. npx tsx scripts/sync-seed-prompts.ts
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function syncSeed() {
  console.log('Sincronizando seed.ts com conteúdo do banco...')

  // 1. Ler export JSON
  const exportPath = join(__dirname, '../prisma/prompts-export.json')
  const exportData = JSON.parse(readFileSync(exportPath, 'utf-8'))

  console.log(`✓ Lido export com ${exportData.totalPrompts} prompts`)
  console.log(`  - Pipeline: ${exportData.categories.pipeline}`)
  console.log(`  - User Templates: ${exportData.categories.userTemplates}`)
  console.log(`  - Dynamic: ${exportData.categories.dynamic}`)

  // 2. Ler seed.ts atual
  const seedPath = join(__dirname, '../prisma/seed.ts')
  let seedContent = readFileSync(seedPath, 'utf-8')

  // 3. Gerar novos arrays formatados
  const pipelineArray = formatPromptArray(exportData.pipelinePrompts, 'pipelinePrompts')
  const userArray = formatPromptArray(exportData.userMessageTemplates, 'userMessageTemplates')
  const dynamicArray = formatPromptArray(exportData.dynamicInstructionTemplates, 'dynamicInstructionTemplates')

  // 4. Substituir arrays no seed
  // Encontrar e substituir const pipelinePrompts = [...]
  seedContent = replaceArray(seedContent, 'pipelinePrompts', pipelineArray)
  seedContent = replaceArray(seedContent, 'userMessageTemplates', userArray)
  seedContent = replaceArray(seedContent, 'dynamicInstructionTemplates', dynamicArray)

  // 5. Atualizar comentário de data/fonte
  const timestamp = new Date().toISOString()
  const commentRegex = /\/\/ ⚠️ FONTE DA VERDADE:.*?\n\/\/ Total: \d+ prompts/s
  const newComment = `// ⚠️ FONTE DA VERDADE: Sincronizado com banco em ${timestamp}\n// Total: ${exportData.totalPrompts} prompts`

  if (commentRegex.test(seedContent)) {
    seedContent = seedContent.replace(commentRegex, newComment)
  }

  // 6. Salvar seed.ts atualizado
  writeFileSync(seedPath, seedContent, 'utf-8')
  console.log(`✓ seed.ts atualizado com sucesso`)
  console.log(`\nResumo das alterações:`)
  console.log(`  - pipelinePrompts: ${exportData.pipelinePrompts.length} entries`)
  console.log(`  - userMessageTemplates: ${exportData.userMessageTemplates.length} entries`)
  console.log(`  - dynamicInstructionTemplates: ${exportData.dynamicInstructionTemplates.length} entries`)
}

function formatPromptArray(prompts: any[], arrayName: string): string {
  if (prompts.length === 0) return '[]'

  const entries = prompts.map(p => {
    const fields: string[] = []

    // Sempre incluir name primeiro
    fields.push(`"name": ${JSON.stringify(p.name)}`)

    // Adicionar step se presente
    if (p.step !== undefined && p.step !== null) {
      fields.push(`"step": ${p.step}`)
    }

    // Adicionar kind se presente
    if (p.kind !== undefined && p.kind !== null) {
      fields.push(`"kind": ${JSON.stringify(p.kind)}`)
    }

    // Adicionar role se diferente de 'system' (default)
    if (p.role && p.role !== 'system') {
      fields.push(`"role": ${JSON.stringify(p.role)}`)
    }

    // Adicionar order
    fields.push(`"order": ${p.order}`)

    // Adicionar isActive se false (default é true)
    if (p.isActive === false) {
      fields.push(`"isActive": false`)
    }

    // Adicionar content por último
    fields.push(`"content": ${JSON.stringify(p.content)}`)

    const fieldStr = fields.map((f, i) => {
      const indent = '        '
      return `${indent}${f}`
    }).join(',\n')

    return `    {\n${fieldStr}\n      }`
  })

  return `[\n${entries.join(',\n')}\n  ]`
}

function replaceArray(content: string, arrayName: string, newArray: string): string {
  // Regex para capturar: const arrayName = [...] (multiline, incluindo upsert loop)
  const regex = new RegExp(
    `(const ${arrayName} = )\\[[\\s\\S]*?\\n  \\]`,
    'g'
  )

  if (!regex.test(content)) {
    console.warn(`⚠️  Array ${arrayName} não encontrado no seed.ts`)
    return content
  }

  return content.replace(regex, `$1${newArray}`)
}

syncSeed()
console.log('\n✓ Sincronização concluída')
