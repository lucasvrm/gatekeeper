# Seed Sync Report

**Data**: 2026-02-07T11:26:07.125Z
**Status**: ✅ Concluído com sucesso

## Resumo

Todos os prompts/instruções/docs do banco foram sincronizados para o `seed.ts`. O seed agora é a **fonte da verdade** e reflete exatamente o conteúdo do banco de dados.

## Estatísticas

### Totais no Banco
- **Total de prompts**: 40
- **Pipeline prompts** (step !== null, role = system): 8
- **User message templates** (step !== null, role = user): 24
- **Dynamic instructions** (guidances, retry, cli, etc): 23
- **Session prompts** (step = null): 4

### Sincronização no seed.ts

✅ **pipelinePrompts**: 4 entries (linhas 813-838)
✅ **userMessageTemplates**: 24 entries (linhas 861-898)
✅ **dynamicInstructionTemplates**: 23 entries (linhas 922-1143)

## Arquivos Modificados

1. ✅ `prisma/seed.ts` — Arrays sincronizados com banco
2. ✅ Comentário de timestamp atualizado
3. ✅ Todas as entries antigas removidas/substituídas

## Scripts Criados

### 1. `scripts/export-prompts.ts`
Exporta todos os prompts do banco para JSON.

**Uso**:
```bash
npx tsx scripts/export-prompts.ts
```

**Output**: `prisma/prompts-export.json`

### 2. `scripts/sync-seed-prompts.ts`
Sincroniza `seed.ts` com o conteúdo do banco (via export JSON).

**Uso**:
```bash
npx tsx scripts/export-prompts.ts  # Step 1: exportar
npx tsx scripts/sync-seed-prompts.ts  # Step 2: sincronizar
```

## Workflow para Manter Sincronizado

Sempre que modificar prompts via UI ou diretamente no banco:

```bash
cd packages/gatekeeper-api
npm run db:seed                      # Popular banco
npx tsx scripts/export-prompts.ts    # Exportar conteúdo atual
npx tsx scripts/sync-seed-prompts.ts # Sincronizar seed.ts
git add prisma/seed.ts
git commit -m "chore: sync seed prompts with database"
```

## Validação

✅ Typecheck passou sem erros
✅ Seed rodou com sucesso
✅ Total de prompts correto: 51 criados (4 + 24 + 23)

## Notas Importantes

### Conteúdo Removido

❌ **seed-prompt-content.ts** — Arquivo antigo com constantes deprecadas:
- `CONTRACT_QUESTIONNAIRES_CONTENT`
- `UI_QUESTIONNAIRE_CONTENT`
- `PLANNER_PLAYBOOK_CONTENT`
- Etc.

Esses conteúdos **NÃO são mais usados**. O sistema atual usa:
- Tabela `PromptInstruction` no banco
- CRUD completo via `/api/mcp/prompts`
- UI de gerenciamento em `src/components/prompts-tab.tsx`

### Categorias de Prompts

1. **Pipeline Prompts** (step 1-4, role=system)
   - Prompts principais de cada fase
   - Ex: planner-core, specwriter-core, fixer-core, coder-core

2. **User Message Templates** (step 1-4, role=user)
   - Templates Handlebars para mensagens do usuário
   - Suportam placeholders como `{{task_description}}`
   - Ex: plan-user-message, spec-user-message

3. **Dynamic Instructions** (step 1-4, kind específico)
   - Instruções condicionais: guidance, retry, cli-replace, etc.
   - Montadas dinamicamente dependendo do contexto
   - Ex: guidance-import-reality, retry-api-critical-failure

4. **Session Prompts** (step=null)
   - Prompts globais não vinculados a nenhum step
   - Gerenciados via MCP Session Config

## Próximos Passos

✅ seed.ts sincronizado
✅ Scripts de automação criados
⏭️ Considerar adicionar ao workflow de CI/CD
⏭️ Documentar na wiki do projeto
