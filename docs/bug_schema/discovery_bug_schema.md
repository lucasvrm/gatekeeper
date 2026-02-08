# Discovery Report: Bug de Schema — taskPrompt Inválido

> **Erro reportado**: "O contrato gerado pelo LLM tem erros de schema: taskPrompt (String must contain at least 10 character(s))"
>
> **Data**: 2026-02-08
> **Investigação**: 3 agents Explore + leituras de arquivos críticos

---

## Resumo

O sistema valida `taskPrompt` com mínimo de 10 caracteres em **dois pontos**:
1. **Backend** — Schema Zod `CreateRunSchema` em `/api/validation/runs`
2. **Frontend** — Ao enviar artifacts para validação

O erro ocorre quando `taskPrompt` chega vazio ou com menos de 10 caracteres. A investigação identificou **3 possíveis causas raiz**:
1. Frontend não passa `taskPrompt` corretamente ao criar ValidationRun
2. Agent não salva `task_prompt.md` com conteúdo mínimo
3. Confusão entre `taskDescription` (agent) vs `taskPrompt` (validation)

---

## Arquivos Relevantes

### 1. `packages/gatekeeper-api/src/api/schemas/validation.schema.ts`

**Contexto:** Define schemas Zod para validação de runs, incluindo `CreateRunSchema` que valida `taskPrompt`.

**Evidência:**
```typescript
export const CreateRunSchema = z.object({
  projectId: z.string().optional(),
  outputId: z.string().min(1),
  projectPath: z.string().min(1).optional(),
  taskPrompt: z.string().min(10),  // ← VALIDAÇÃO: mínimo 10 caracteres
  manifest: ManifestSchema,
  contract: ContractSchema.optional(),
  baseRef: z.string().default('origin/main'),
  targetRef: z.string().default('HEAD'),
  dangerMode: z.boolean().default(false),
  runType: z.enum(['CONTRACT', 'EXECUTION']).default('CONTRACT'),
  contractRunId: z.string().optional(),
})
```

**Observação:** Campo `taskPrompt` é **obrigatório** e deve ter **mínimo 10 caracteres**. Não há mensagem customizada, usa default do Zod: "String must contain at least 10 character(s)".

---

### 2. `packages/gatekeeper-api/src/api/routes/validation.routes.ts`

**Contexto:** Endpoint que recebe artifacts do frontend e cria ValidationRun. É aqui que o erro de schema é capturado.

**Evidência:**
```typescript
router.post('/runs', async (req, res, next) => {
  try {
    // ✅ AQUI: Validação Zod é feita
    const validatedData = CreateRunSchema.parse(req.body)  // linha 11
    req.body = validatedData
    await controller.createRun(req, res)
  } catch (error) {
    if (error instanceof ZodError) {
      // ✅ ERRO DE CONTRATO CAPTURADO AQUI
      const fields = error.errors.map(e => ({
        path: e.path.join('.'),
        expected: 'expected' in e ? e.expected : undefined,
        message: e.message,
      }))
      res.status(400).json({
        error: 'CONTRACT_SCHEMA_INVALID',
        message: 'O contrato gerado pelo LLM tem erros de schema: ' +
                 fields.map(f => f.path + ' (' + f.message + ')').join(', '),
        fields,  // Lista de erros Zod
      })
      return
    }
    next(error)
  }
})
```

**Observação:** O erro `taskPrompt (String must contain at least 10 character(s))` vem deste catch block. Frontend recebe status 400 com mensagem formatada.

---

### 3. `packages/gatekeeper-api/src/services/AgentOrchestratorBridge.ts`

**Contexto:** Orquestra steps 1-4 do agent pipeline. No Step 1, salva `task_prompt.md` como artifact.

**Evidência (linhas 403-406):**
```typescript
// Step 1: After LLM generates microplans, save task_prompt.md
memoryArtifacts.set('task_prompt.md', `# Task Prompt\n\n${input.taskDescription}`)

// ✅ Artifact validation BEFORE persisting
const validation = this.validator.validateStepArtifacts(1, memoryArtifacts)
if (!validation.valid) {
  // ... throw BridgeError
}
```

**Observação:** O artifact `task_prompt.md` é gerado a partir de `input.taskDescription`. Se `taskDescription` for vazio ou < 8 chars (considerando header `# Task Prompt\n\n`), o artifact será inválido. **Não há validação explícita do comprimento mínimo** antes de salvar.

---

### 4. `packages/gatekeeper-api/src/services/GatekeeperValidationBridge.ts`

**Contexto:** Lê artifacts do disco e cria ValidationRun no banco. É aqui que `taskPrompt` é salvo no DB.

**Evidência (linhas 139-145):**
```typescript
const run = await prisma.validationRun.create({
  data: {
    // ... outras fields
    taskPrompt: input.taskDescription,  // ← Salva taskDescription como taskPrompt
    manifestJson,
    contractJson: contractJson || null,
    // ...
  },
})
```

**Observação:** O campo `taskPrompt` no DB recebe diretamente `input.taskDescription`. Se o input vier vazio ou inválido, o run será criado com `taskPrompt` inválido (mas isso acontece **após** a validação Zod em `validation.routes.ts`).

---

### 5. `packages/gatekeeper-api/src/services/AgentPromptAssembler.ts`

**Contexto:** Renderiza templates Handlebars com variáveis para montar prompts do LLM. Linha 156 mostra quais variáveis são passadas ao template.

**Evidência (linhas 156-195):**
```typescript
async assembleUserMessageForStep(
  step: number,
  vars: Record<string, unknown>,
  kind?: string,
): Promise<string | null> {
  const where: Record<string, unknown> = {
    step,
    role: 'user',
    isActive: true,
  }

  // Query DB templates
  const templates = await this.prisma.promptInstruction.findMany({
    where,
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
  })

  if (templates.length === 0) return null

  // Render with Handlebars
  const combined = templates.map((t) => t.content).join('\n\n')
  return renderTemplate(combined, vars)
}
```

**Observação:** O método aceita `vars: Record<string, unknown>` — qualquer objeto. Não há validação de quais keys são obrigatórias. Se o caller passar variáveis erradas (ex: `taskPrompt` ao invés de `taskDescription`), o template Handlebars renderizará com valores vazios **silenciosamente**.

---

### 6. `packages/gatekeeper-api/seed-prompt-content-v2.ts`

**Contexto:** Define templates Handlebars que o LLM recebe. Linha 412 mostra o template para Step 1 (Planner).

**Evidência (linhas 412-436):**
```typescript
export const PLANNER_USER_MESSAGE_TEMPLATE = `## Tarefa
**Descrição:** {{taskDescription}}
{{#if taskType}}
**Tipo:** {{taskType}}
{{/if}}
**Output ID:** {{outputId}}

{{#if attachments}}
## Anexos
{{{attachments}}}
{{/if}}

---

## ⚠️ CRÍTICO: Salve os 3 arquivos

\`\`\`
save_artifact("microplans.json", <conteúdo>)
save_artifact("contract.md", <conteúdo>)
save_artifact("task_prompt.md", <conteúdo>)
\`\`\`

❌ NÃO explique o que vai fazer
❌ NÃO termine sem salvar os 3 arquivos
✅ Analise codebase → Gere artifacts → SALVE`
```

**Observação:** Template usa `{{taskDescription}}` (não `taskPrompt`). Se o código passar `{ taskPrompt: "..." }` ao invés de `{ taskDescription: "..." }`, a variável fica vazia.

---

### 7. `packages/gatekeeper-api/src/services/ArtifactValidationService.ts`

**Contexto:** Valida artifacts **antes de persistir no disco**. Step 1 valida `microplans.json`, mas **não valida** `task_prompt.md`.

**Evidência (linhas 267-333):**
```typescript
validateStepArtifacts(
  step: 1 | 2 | 3 | 4,
  artifacts: Map<string, string>
): { valid: boolean; results: ArtifactValidationResult[] } {
  const results: ArtifactValidationResult[] = []

  if (step === 1) {
    const microplansJson = artifacts.get('microplans.json')
    if (!microplansJson) {
      results.push({
        valid: false,
        severity: 'error',
        message: 'Artefato obrigatório ausente: microplans.json',
        details: { ... }
      })
    } else {
      results.push(this.validateMicroplansJson(microplansJson))
    }
    // ❌ NÃO valida task_prompt.md!
  }
  // ... outros steps

  const valid = results.every(r => r.valid)
  return { valid, results }
}
```

**Observação:** O serviço valida `microplans.json` (Step 1) e test file (Step 2), mas **não valida** `task_prompt.md`. Se `task_prompt.md` estiver vazio ou com < 10 chars, o artifact será persistido mesmo assim.

---

### 8. `src/components/orchestrator-page.tsx` (Frontend)

**Contexto:** Página do orquestrador que envia artifacts para validação. Procurar por chamadas a `/api/validation/runs`.

**Evidência:** *(Arquivo não lido ainda — investigação necessária)*

**Observação:** Precisa verificar:
- Como `taskPrompt` é extraído dos artifacts
- Se há transformação de `taskDescription` → `taskPrompt`
- Se há validação no frontend antes de enviar

---

## Estrutura de Dependências

```
Frontend (orchestrator-page.tsx)
  ↓ POST /api/validation/runs
  ↓ Body: { taskPrompt, manifest, contract, ... }
validation.routes.ts
  ↓ CreateRunSchema.parse(req.body)  ← ❌ ERRO AQUI se taskPrompt < 10 chars
  ↓
ValidationController.createRun()
  ↓
GatekeeperValidationBridge.validate()
  ↓ Cria ValidationRun: taskPrompt = input.taskDescription
  ↓
ValidationOrchestrator.runGates()
```

**Agent Pipeline (geração de artifacts):**
```
BridgeController.generatePlan (Step 1)
  ↓
AgentOrchestratorBridge.generatePlan()
  ↓ buildPlanUserMessageAsync({ taskDescription, outputId, ... })
  ↓
AgentPromptAssembler.assembleUserMessageForStep(1, vars)
  ↓ Renderiza PLANNER_USER_MESSAGE_TEMPLATE com {{taskDescription}}
  ↓
Agent LLM gera microplans.json, contract.md, task_prompt.md
  ↓
ArtifactValidationService.validateStepArtifacts(1, artifacts)
  ↓ Valida microplans.json (não valida task_prompt.md)
  ↓
Artifacts persistidos em disk: artifacts/{outputId}/task_prompt.md
```

---

## Padrões Identificados

### Naming Conventions
- **Agent input**: `taskDescription` (usado no agent pipeline)
- **Validation input**: `taskPrompt` (usado na validação de runs)
- **DB field**: `taskPrompt` (armazenado em `ValidationRun`)
- **Artifact**: `task_prompt.md` (arquivo no disco)

### Schema Validation Points
1. **Frontend → Backend** (`/api/validation/runs`):
   - Schema: `CreateRunSchema`
   - Valida: `taskPrompt.min(10)`
   - Retorna: 400 + "CONTRACT_SCHEMA_INVALID"

2. **Artifact Validation** (`ArtifactValidationService`):
   - Step 1: Valida `microplans.json` (não valida `task_prompt.md`)
   - Step 2: Valida test file (filename, content mínimo)

### Handlebars Template Variables
- **Step 1 (Planner)**: `{{taskDescription}}`, `{{outputId}}`, `{{taskType}}`, `{{attachments}}`
- **Step 2 (Spec)**: *(investigação necessária)*
- **Renderização silenciosa**: Variáveis inexistentes ficam vazias (não geram erro)

---

## Estado Atual vs Desejado

| Aspecto | Atual | Desejado |
|---------|-------|----------|
| **taskPrompt mínimo** | 10 chars (Zod) | 10 chars (ok) |
| **Artifact validation** | Valida `microplans.json`, ignora `task_prompt.md` | Validar `task_prompt.md` também |
| **Variable naming** | Confuso: `taskDescription` (agent) vs `taskPrompt` (validation) | Consistente em todo fluxo |
| **Handlebars validation** | Silenciosa (vars vazias) | Warn se variável não existe |
| **Error message** | "taskPrompt (String must contain at least 10 character(s))" | Mais descritiva: "taskPrompt vazio ou < 10 chars. Verifique taskDescription do agent." |

---

## Riscos

### Alto
- **`task_prompt.md` não validado**: Artifact pode ser persistido vazio, causando erro downstream na validação de runs
- **Confusão `taskDescription` vs `taskPrompt`**: Se código passar variável errada ao template, LLM recebe prompt vazio

### Médio
- **Frontend não valida antes de enviar**: Se frontend enviar `taskPrompt: ""`, erro só é detectado no backend (round-trip desnecessário)
- **Template mismatch**: Se template espera `{{taskPrompt}}` mas código passa `{ taskDescription }`, renderização falha silenciosamente

### Baixo
- **Schema muito restritivo**: Mínimo de 10 chars pode rejeitar tasks válidas muito curtas (ex: "Fix bug X")

---

## Arquivos NÃO Relevantes (descartados)

### Backend
- `src/api/controllers/ValidationController.ts` — Apenas chama GatekeeperValidationBridge, não manipula `taskPrompt`
- `src/services/ValidationOrchestrator.ts` — Apenas executa gates, não valida schema
- `src/domain/validators/gate0/*` — Validadores de negócio, não de schema Zod
- `src/types/gates.types.ts` — Type definitions, não lógica de validação

### Frontend
- `src/lib/api.ts` — HTTP client genérico, não processa `taskPrompt`
- `src/lib/types.ts` — Type definitions, não lógica

### Templates DB
- Step 2, 3, 4 prompts — Não relacionados ao erro de `taskPrompt` no Step 1

---

## Próximos Passos (Investigação Adicional)

1. **Ler `orchestrator-page.tsx`**: Verificar como `taskPrompt` é extraído e enviado
2. **Testar cenário**: Enviar `taskDescription: ""` e observar onde o erro ocorre
3. **Verificar DB seeds**: Conferir se templates DB estão corretos (variáveis match com código)
4. **Adicionar logs**: Instrumentar `AgentPromptAssembler` e `GatekeeperValidationBridge` para rastrear valores de `taskPrompt`/`taskDescription`

---

## Hipóteses de Causa Raiz

### Hipótese 1: Frontend envia `taskPrompt` vazio
**Evidência**: Erro ocorre em `validation.routes.ts` (Zod parse)
**Como testar**: Adicionar log em `orchestrator-page.tsx` antes de POST
**Probabilidade**: **ALTA** ⚠️

### Hipótese 2: Agent não salva `task_prompt.md` corretamente
**Evidência**: `AgentOrchestratorBridge.ts:405` cria artifact com `input.taskDescription`
**Como testar**: Verificar conteúdo de `artifacts/{outputId}/task_prompt.md` no disco
**Probabilidade**: **MÉDIA**

### Hipótese 3: Template variable mismatch (Step 1)
**Evidência**: Template usa `{{taskDescription}}`, código pode passar `taskPrompt`
**Como testar**: Adicionar log em `AgentPromptAssembler.assembleUserMessageForStep()`
**Probabilidade**: **BAIXA** (código parece consistente)

### Hipótese 4: Artifact validation não valida `task_prompt.md`
**Evidência**: `ArtifactValidationService.validateStepArtifacts(1)` só valida `microplans.json`
**Como testar**: Forçar `task_prompt.md` vazio e verificar se passa na validação
**Probabilidade**: **ALTA** ⚠️ (confirmada pelo código)

---

## Evidências Concretas para Debugging

### Console Logs Sugeridos

**1. AgentOrchestratorBridge.ts (linha 405):**
```typescript
console.log('[Bridge:generatePlan] taskDescription:', input.taskDescription)
console.log('[Bridge:generatePlan] task_prompt.md content:',
  `# Task Prompt\n\n${input.taskDescription}`)
```

**2. AgentPromptAssembler.ts (linha 194):**
```typescript
console.log('[Assembler] Step:', step, 'Vars:', Object.keys(vars))
console.log('[Assembler] Rendered template:', combined.substring(0, 200))
```

**3. validation.routes.ts (linha 11):**
```typescript
console.log('[Validation] req.body.taskPrompt:', req.body.taskPrompt)
console.log('[Validation] req.body.outputId:', req.body.outputId)
```

### Breakpoints Sugeridos

1. `validation.routes.ts:11` — Antes de `CreateRunSchema.parse()`
2. `AgentOrchestratorBridge.ts:405` — Após criar `task_prompt.md`
3. `orchestrator-page.tsx` — Onde monta body de POST `/api/validation/runs`

---

**Fim do Relatório**
