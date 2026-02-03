/**
 * Gatekeeper Orchestrator — Prompt Builder
 *
 * Builds prompts for each pipeline step.
 * Reads reference docs from DOCS_DIR subfolders (same as MCP server).
 * Unlike the MCP prompts, these don't include STOP boundaries or save_artifacts
 * instructions — the orchestrator handles I/O externally.
 */

import * as fs from 'fs'
import * as path from 'path'
import type { FixTarget } from './types.js'
import type { SessionContext } from './session-context.js'

// ─────────────────────────────────────────────────────────────────────────────
// Docs reader (same as MCP's LocalDocsReader)
// ─────────────────────────────────────────────────────────────────────────────

interface DocsResult {
  [folder: string]: { [file: string]: string }
}

/**
 * Read all markdown/text files from DOCS_DIR subfolders.
 * Returns { folderName: { fileName: content } }
 */
function readDocsFolder(docsDir: string): DocsResult {
  const result: DocsResult = {}

  if (!fs.existsSync(docsDir)) return result

  const folders = fs.readdirSync(docsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())

  for (const folder of folders) {
    const folderPath = path.join(docsDir, folder.name)
    const files = fs.readdirSync(folderPath)
      .filter(f => /\.(md|txt|json)$/.test(f))

    if (files.length > 0) {
      result[folder.name] = {}
      for (const file of files) {
        result[folder.name][file] = fs.readFileSync(path.join(folderPath, file), 'utf-8')
      }
    }
  }

  return result
}

/**
 * Format docs into a single string block for prompt injection.
 */
function formatDocs(docs: DocsResult): string {
  const sections: string[] = []

  for (const [folder, files] of Object.entries(docs)) {
    for (const [file, content] of Object.entries(files)) {
      sections.push(`### ${folder}/${file}\n\n${content}`)
    }
  }

  return sections.length > 0
    ? `\n## Documentação de Referência\n\n${sections.join('\n\n---\n\n')}`
    : ''
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt Builders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Step 1: Build prompt for plan generation.
 *
 * Called by pipeline.ts as:
 *   buildPlanPrompt(taskDescription, outputId, docsDir, session, taskType?)
 */
export function buildPlanPrompt(
  taskDescription: string,
  outputId: string,
  docsDir: string,
  sessionContext: SessionContext,
  taskType?: string
): string {
  const docs = formatDocs(readDocsFolder(docsDir))
  const { gitStrategy, customInstructions } = sessionContext

  return `# Gatekeeper — Gerar Plano de Implementação

## Sua Tarefa
Você é um arquiteto de software. Analise a tarefa abaixo e produza os artefatos de planejamento.

## Descrição da Tarefa
${taskDescription}
${taskType ? `\n**Tipo:** ${taskType}\n` : ''}
**Output ID:** ${outputId}
${gitStrategy}
${customInstructions}
${docs}

## Artefatos Esperados

Produza EXATAMENTE estes 3 arquivos como blocos de código nomeados:

### 1. \`plan.json\`
JSON com a estrutura:
\`\`\`json
{
  "taskTitle": "Título curto da tarefa",
  "taskType": "feature|bugfix|refactor",
  "scope": "Descrição do escopo",
  "approach": "Abordagem técnica",
  "files": [
    { "path": "src/...", "action": "CREATE|MODIFY|DELETE", "reason": "..." }
  ],
  "testFile": "caminho/do/arquivo.spec.ts",
  "risks": ["..."],
  "acceptanceCriteria": ["..."]
}
\`\`\`

### 2. \`contract.md\`
Contrato de mudança com cláusulas no formato:
\`\`\`markdown
# Contrato: {título}

## Metadata
- slug: nome-kebab
- changeType: feature|bugfix|refactor
- criticality: low|medium|high

## Cláusulas

### MUST-001: {descrição curta}
- **kind:** behavior|error|invariant|ui|constraint
- **when:** {condição}
- **then:** {resultado esperado}

### SHOULD-001: {descrição curta}
...
\`\`\`

### 3. \`task.spec.md\`
Especificação técnica detalhada descrevendo O QUE implementar (não COMO).

## Regras
- Use nomes de arquivo EXATOS como label do bloco de código
- Não inclua explicações fora dos blocos de código
- Paths devem ser relativos à raiz do projeto`
}

/**
 * Step 2: Build prompt for spec/test generation.
 *
 * Called by pipeline.ts as:
 *   buildSpecPrompt(outputId, planContent, contractContent, specContent, docsDir, session)
 */
export function buildSpecPrompt(
  outputId: string,
  plan: string,
  contract: string,
  taskSpec: string,
  docsDir: string,
  sessionContext: SessionContext
): string {
  const docs = formatDocs(readDocsFolder(docsDir))
  const { customInstructions } = sessionContext

  // Extract testFile path from plan.json
  let testFilePath = `${outputId}.spec.ts`
  try {
    const planObj = JSON.parse(plan)
    if (planObj.testFile) testFilePath = planObj.testFile
  } catch {
    // Use default
  }

  return `# Gatekeeper — Gerar Arquivo de Testes

## Sua Tarefa
Você é um engenheiro de testes. Crie o arquivo de testes baseado nos artefatos de planejamento.

## Output ID: ${outputId}

## Artefatos de Entrada

### plan.json
\`\`\`json
${plan}
\`\`\`

### contract.md
${contract}

### task.spec.md
${taskSpec}
${customInstructions}
${docs}

## Arquivo de Saída

Produza EXATAMENTE 1 arquivo como bloco de código nomeado:

### \`${testFilePath}\`

O arquivo de testes deve:
- Ter um \`describe\` principal com o título da tarefa
- Mapear CADA cláusula do contrato para pelo menos 1 teste
- Usar comentários \`// @clause MUST-001\` antes de cada \`it()\` para rastreabilidade
- Testar comportamentos, não implementação
- Incluir testes de erro/edge cases para cláusulas de tipo \`error\`
- Usar mocks/stubs conforme necessário
- Ser executável com vitest

## Regras
- Use o nome de arquivo EXATO como label do bloco de código
- Não inclua explicações fora do bloco de código
- Imports devem usar paths relativos à raiz do projeto`
}

/**
 * Fix: Build prompt for artifact correction after Gatekeeper rejection.
 *
 * Called by pipeline.ts as:
 *   buildFixPrompt(target, outputId, artifacts, rejectionReport, failedValidators, docsDir, session)
 */
export function buildFixPrompt(
  target: FixTarget,
  outputId: string,
  currentArtifacts: Record<string, string>,
  rejectionReport: string,
  failedValidators: string[],
  docsDir: string,
  sessionContext: SessionContext
): string {
  const docs = formatDocs(readDocsFolder(docsDir))
  const { customInstructions } = sessionContext

  const artifactBlocks = Object.entries(currentArtifacts)
    .map(([name, content]) => `### ${name}\n\`\`\`\n${content}\n\`\`\``)
    .join('\n\n')

  const targetDescription = target === 'plan'
    ? 'Corrija os artefatos de planejamento (plan.json, contract.md, task.spec.md)'
    : 'Corrija o arquivo de testes'

  return `# Gatekeeper — Correção de Artefatos

## Sua Tarefa
${targetDescription} para resolver os problemas apontados pelo Gatekeeper.

## Output ID: ${outputId}

## Validadores que Falharam
${failedValidators.map(v => `- \`${v}\``).join('\n')}

## Relatório de Rejeição

${rejectionReport}

## Artefatos Atuais

${artifactBlocks}
${customInstructions}
${docs}

## Regras
- Produza APENAS os arquivos que precisam ser corrigidos
- Use os nomes de arquivo EXATOS como labels dos blocos de código
- Corrija TODOS os problemas apontados no relatório
- Mantenha consistência entre plan.json, contract.md e task.spec.md
- Não inclua explicações fora dos blocos de código`
}

/**
 * Step 4: Build prompt for implementation execution.
 *
 * Called by pipeline.ts as:
 *   buildExecutionPrompt(outputId, artifacts, docsDir, session)
 */
export function buildExecutionPrompt(
  outputId: string,
  artifacts: Record<string, string>,
  docsDir: string,
  sessionContext: SessionContext
): string {
  const docs = formatDocs(readDocsFolder(docsDir))
  const { gitStrategy, customInstructions } = sessionContext

  const artifactBlocks = Object.entries(artifacts)
    .map(([name, content]) => `### ${name}\n\`\`\`\n${content}\n\`\`\``)
    .join('\n\n')

  return `# Gatekeeper — Implementação

## Contexto
Você está implementando a tarefa ${outputId}, validada pelo Gatekeeper.
Todos os artefatos abaixo foram aprovados. Siga-os à risca.
${gitStrategy}
${customInstructions}
${docs}

## Artefatos Aprovados

${artifactBlocks}

## Regras de Implementação
1. Leia o plan.json para entender o escopo e os arquivos a modificar
2. Leia o contract.md para entender os requisitos
3. Leia o task.spec.md para entender a especificação técnica
4. Leia o arquivo de testes para entender os comportamentos esperados
5. Implemente APENAS o que está descrito nos artefatos
6. Execute os testes após implementar para verificar que passam
7. Não modifique os arquivos de teste
8. Faça commit das mudanças com uma mensagem descritiva`
}
