# Discovery Report: Adicionar Botão Bypass no Card de Validação

> Preenchido automaticamente pelo agente Discovery.
> Cada afirmação DEVE ser sustentada por snippet real do código.

---

## Resumo

O card de validação no `/orchestrator` (Step 3) atualmente mostra gates, logs de erros e dois botões inline: "Corrigir Plano" e "Corrigir Testes". A tarefa requer adicionar um terceiro botão "Bypass" inline com os outros dois, reutilizando a lógica existente da rota `/runs/:id/v2`. O bypass permite marcar validators falhados como bypassados, resetando a run para PENDING e re-enfileirando para execução.

---

## Arquivos Relevantes

### 1. `src/components/orchestrator-page.tsx`

**Contexto:** Página principal do orchestrator onde o card de validação está localizado (Step 3). Contém os botões "Corrigir Plano" e "Corrigir Testes" que precisam ser redimensionados.

**Evidência (linhas 2797-2908):**
```typescript
{validationStatus === "FAILED" && runId && runResults && (
  <Card className="border-destructive/30">
    <CardHeader>
      <CardTitle className="text-destructive">✗ Validação Falhou</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      {/* Failed validators */}
      <div className="space-y-2">
        {(runResults.validatorResults ?? [])
          .filter((v: ValidatorResult) => !v.passed && !v.bypassed)
          .map((v: ValidatorResult) => (
            <div key={v.validatorCode}>
              <span>{v.validatorCode}</span>
              {v.isHardBlock && <Badge variant="destructive">HARD BLOCK</Badge>}
            </div>
          ))}
      </div>

      {/* Fix buttons */}
      <div className="flex gap-2">
        <Button onClick={() => openFixDialog(autoTarget)} className="flex-1">
          Corrigir {autoTarget === "plan" ? "Plano" : "Testes"} ⭐
        </Button>
        <Button onClick={() => openFixDialog(altTarget)} variant="outline" className="flex-1">
          Corrigir {altTarget === "plan" ? "Plano" : "Testes"}
        </Button>
      </div>
    </CardContent>
  </Card>
)}
```

**Observação:** Os dois botões usam `className="flex-1"` e estão dentro de um `div.flex`. O botão Bypass deve ser adicionado aqui, e os três botões devem redimensionar proporcionalmente (remover `flex-1` ou adicionar o terceiro também com `flex-1`).

---

### 2. `src/components/run-details-page-v2.tsx`

**Contexto:** Página com implementação existente do botão Bypass. Contém toda a lógica de estado, filtragem de validators bypassáveis, e handler de bypass que deve ser reutilizada.

**Evidência (estado - linha 72):**
```typescript
const [openBypassGate, setOpenBypassGate] = useState<number | null>(null)
```

**Evidência (filtro - linhas 230-236):**
```typescript
const getBypassableValidators = useCallback(
  (gateNumber: number) =>
    (validatorsByGate[gateNumber] ?? []).filter(
      (validator) => validator.status === "FAILED" && validator.isHardBlock && !validator.bypassed
    ),
  [validatorsByGate]
)
```

**Evidência (handler - linhas 349-359):**
```typescript
const handleBypassValidator = async (validator: UnifiedValidator) => {
  try {
    await api.runs.bypassValidator(validator.runId, validator.validatorCode)
    setOpenBypassGate(null)
    toast.success("Validator by-passado — run reenfileirado")
    await handlePrimaryEvent() // Reload data
  } catch (error) {
    console.error("Failed to bypass validator:", error)
    toast.error("Falha ao by-passar validator")
  }
}
```

**Evidência (UI - linhas 685-711):**
```typescript
<Button
  variant="outline"
  size="sm"
  disabled={isCommitted || !hasFailed}
  onClick={() => setOpenBypassGate((prev) => (prev === gate.gateNumber ? null : gate.gateNumber))}
  className="flex-1 h-6 text-[10px] justify-center"
>
  Bypass
</Button>

{/* Bypass dropdown */}
{openBypassGate === gate.gateNumber && getBypassableValidators(gate.gateNumber).length > 0 && (
  <div className="mt-1 space-y-1">
    {getBypassableValidators(gate.gateNumber).map((validator) => (
      <Button
        key={validator.validatorCode}
        variant="ghost"
        size="sm"
        className="w-full justify-start text-xs h-6"
        onClick={() => handleBypassValidator(validator)}
      >
        {validator.validatorCode}
      </Button>
    ))}
  </div>
)}
```

**Observação:** O botão Bypass abre um dropdown com lista de validators bypassáveis (FAILED + isHardBlock + !bypassed). Quando clicado em um validator, chama API e recarrega dados.

---

### 3. `src/lib/api.ts`

**Contexto:** Cliente HTTP que faz chamadas para o backend. Contém o método `bypassValidator` que será reutilizado.

**Evidência (linhas 230-237):**
```typescript
bypassValidator: async (id: string, validatorCode: string): Promise<{ message: string; runId: string }> => {
  const response = await fetchWithAuth(`${API_BASE}/runs/${id}/validators/${validatorCode}/bypass`, { method: "POST" })
  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(error?.message || error?.error || `Failed to bypass validator (${response.status})`)
  }
  return response.json()
},
```

**Observação:** Endpoint: `POST /api/runs/:id/validators/:validatorCode/bypass`. Retorna `{ message, runId }` em caso de sucesso. Já implementado e funcional.

---

### 4. `src/lib/types.ts`

**Contexto:** Definições de tipos TypeScript compartilhados. Interface `ValidatorResult` contém campo `bypassed` que indica se foi bypassado.

**Evidência (linhas 124-135):**
```typescript
export interface ValidatorResult {
  gateNumber: number
  validatorCode: string
  validatorName: string
  status: ValidatorStatus
  passed: boolean
  isHardBlock: boolean
  bypassed?: boolean
  message?: string
  details?: string
  evidence?: string
}
```

**Observação:** O campo `bypassed` é opcional e usado para filtrar validators já bypassados na UI (`.filter((v) => !v.bypassed)`).

---

### 5. `packages/gatekeeper-api/src/api/controllers/RunsController.ts`

**Contexto:** Controller backend que implementa a lógica de bypass. Valida se run está FAILED, marca validator como bypassado, reseta run para PENDING e re-enfileira.

**Evidência (linhas 272-385 - versão resumida):**
```typescript
async bypassValidator(req: Request, res: Response): Promise<void> {
  const { id, validatorCode } = req.params
  const run = await prisma.validationRun.findUnique({ where: { id } })

  if (run.status !== 'FAILED') {
    return res.status(400).json({ error: 'Run must be failed to bypass' })
  }

  const validatorResult = await prisma.validatorResult.findUnique({
    where: { runId_validatorCode: { runId: id, validatorCode } }
  })

  if (!validatorResult || validatorResult.status !== 'FAILED') {
    return res.status(400).json({ error: 'Cannot bypass validator' })
  }

  // Parse existing bypassed list
  let bypassedList: string[] = []
  if (run.bypassedValidators) {
    bypassedList = JSON.parse(run.bypassedValidators).filter((item) => typeof item === 'string')
  }

  const updatedBypassList = Array.from(new Set([...bypassedList, validatorCode]))
  const firstGate = run.runType === 'EXECUTION' ? 2 : 0

  // Reset run
  await prisma.validatorResult.deleteMany({ where: { runId: id } })
  await prisma.gateResult.deleteMany({ where: { runId: id } })
  await prisma.validationRun.update({
    where: { id },
    data: {
      status: 'PENDING',
      currentGate: firstGate,
      bypassedValidators: JSON.stringify(updatedBypassList),
    }
  })

  // Re-queue
  const orchestrator = new ValidationOrchestrator()
  orchestrator.addToQueue(id)

  res.json({ message: 'Validator bypassed and run queued for re-execution', runId: id })
}
```

**Observação:** Backend reseta completamente a run (apaga gate/validator results) e re-executa do zero, respeitando validators bypassados na lista `bypassedValidators`.

---

### 6. `packages/gatekeeper-api/src/api/routes/runs.routes.ts`

**Contexto:** Definição de rotas HTTP do backend. Endpoint de bypass está registrado.

**Evidência (linhas 127-129):**
```typescript
router.post('/runs/:id/validators/:validatorCode/bypass', (req, res, next) => {
  controller.bypassValidator(req, res).catch(next)
})
```

**Observação:** Rota aceita POST com parâmetros `:id` (runId) e `:validatorCode` no path.

---

### 7. `src/components/ui/button.tsx` e `src/components/ui/card.tsx`

**Contexto:** Componentes shadcn/ui reutilizáveis. Button e Card são usados no card de validação.

**Evidência (imports no orchestrator-page.tsx):**
```typescript
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
```

**Observação:** Componentes já importados. Não requerem mudanças, apenas reutilização.

---

## Estrutura de Dependências

```
orchestrator-page.tsx
  ← usado por: App.tsx (rota /orchestrator)
  → importa de:
    - @/lib/api (api.runs.bypassValidator - a ser adicionado)
    - @/lib/types (ValidatorResult, RunWithResults)
    - @/components/ui/* (Button, Card, Badge, etc)
    - sonner (toast)

run-details-page-v2.tsx
  ← usado por: App.tsx (rota /runs/:id/v2)
  → importa de:
    - @/lib/api (api.runs.bypassValidator - já usado)
    - @/lib/types (ValidatorResult)

api.ts (frontend)
  → chama: POST /api/runs/:id/validators/:validatorCode/bypass
  ← usado por: orchestrator-page.tsx, run-details-page-v2.tsx

RunsController.ts (backend)
  → usa: prisma.validationRun, prisma.validatorResult
  → usa: ValidationOrchestrator.addToQueue()
  ← chamado por: runs.routes.ts
```

---

## Padrões Identificados

- **Naming:**
  - Funções: camelCase (`handleBypassValidator`, `getBypassableValidators`)
  - Componentes: PascalCase (`Button`, `Card`)
  - Constantes: UPPER_SNAKE_CASE (`PLAN_VALIDATORS`, `SPEC_VALIDATORS`)

- **Imports:**
  - Alias `@/` para `src/`
  - Imports absolutos preferidos (ex: `@/lib/api`)
  - Imports relativos apenas para arquivos no mesmo diretório

- **Estado:**
  - useState para estado local UI (`openBypassGate`, `loading`)
  - useCallback para funções que dependem de props/state (`getBypassableValidators`)

- **API Calls:**
  - Sempre envolvidos em try/catch
  - Toast de sucesso/erro após cada operação
  - Reload de dados após mutação (`await handlePrimaryEvent()`)

- **Estilo:**
  - Tailwind CSS classes inline
  - shadcn/ui components (Button, Card, Badge)
  - Variants: `outline`, `ghost`, `destructive` para diferentes estados

- **Validação:**
  - Apenas validators com `status === "FAILED"` + `isHardBlock === true` + `!bypassed` são bypassáveis
  - Filtro: `.filter((v) => !v.passed && !v.bypassed)` para mostrar apenas falhados não-bypassados

---

## Estado Atual vs Desejado

| Aspecto | Atual | Desejado |
|---------|-------|----------|
| **Botões no card** | 2 botões (Plano, Testes) com `flex-1` | 3 botões inline (Plano, Testes, Bypass) com largura proporcional |
| **Estado bypass** | Não existe em `orchestrator-page.tsx` | Adicionar `openBypassValidators: boolean` ou similar |
| **Lógica bypass** | Só existe em `run-details-page-v2.tsx` | Reutilizar/copiar para `orchestrator-page.tsx` |
| **Dropdown validators** | Não existe | Adicionar dropdown similar ao de `run-details-page-v2.tsx` |
| **Validators bypassáveis** | N/A | Filtrar de `runResults.validatorResults` |
| **Handler bypass** | N/A | Copiar `handleBypassValidator` |
| **Reload após bypass** | N/A | Adicionar lógica para recarregar `runResults` |

---

## Riscos

- **orchestrator-page.tsx é grande** (2900+ linhas) — mudanças podem afetar outros steps se não forem cuidadosas
- **Estado compartilhado**: `runResults`, `runId`, `validationStatus` são usados em múltiplos lugares — garantir que reload após bypass atualiza corretamente
- **Concorrência**: Se usuário clicar em bypass durante validação em andamento (`validationStatus === "RUNNING"`), pode causar race condition — adicionar disable quando status é RUNNING
- **Tipos**: `ValidatorResult` pode ter campos opcionais (`bypassed?`) — garantir type guards para evitar undefined errors
- **Sincronização SSE**: Após bypass, backend emite `RUN_STATUS: PENDING` via SSE — garantir que UI escuta e atualiza estado
- **Layout responsivo**: 3 botões inline podem quebrar em telas pequenas — considerar wrap ou ajustar tamanhos

---

## Arquivos NÃO Relevantes (descartados)

- `src/components/fix-instructions-dialog.tsx` — Dialog para instruções de fix (LLM), não relacionado a bypass
- `src/hooks/useOrchestratorEvents.ts` — Hook de SSE, pode ser útil para reload mas não é core da feature
- `src/hooks/usePipelineReconciliation.ts` — Reconciliação de pipeline, não afeta bypass
- `packages/gatekeeper-api/src/services/ValidationOrchestrator.ts` — Orquestrador de validação, já chamado pelo backend após bypass
- `packages/gatekeeper-api/prisma/schema.prisma` — Schema do banco, campo `bypassedValidators` já existe

---

## Notas Finais

**Sequência de operação do bypass:**
1. Usuário clica em "Bypass" no card de validação
2. Dropdown abre mostrando validators bypassáveis (FAILED + isHardBlock + !bypassed)
3. Usuário clica em um validator específico (ex: "SPEC_SYNTAX")
4. Frontend chama `api.runs.bypassValidator(runId, validatorCode)`
5. Backend valida, adiciona validator à lista bypassed, reseta run para PENDING
6. Backend re-enfileira run via `ValidationOrchestrator.addToQueue()`
7. Backend emite SSE `RUN_STATUS: PENDING`
8. Frontend recebe SSE e atualiza UI (validationStatus, runResults)
9. Run é re-executada, pulando validators bypassados
10. UI mostra novo estado da validação

**Campos críticos:**
- `runId` — ID da ValidationRun (necessário para API call)
- `runResults.validatorResults` — Array de ValidatorResult (fonte de dados)
- `validationStatus` — Estado atual (FAILED, RUNNING, etc)
- `isHardBlock` — Apenas hard blocks são bypassáveis
- `bypassed` — Campo booleano que indica se já foi bypassado

**Implementação requer:**
1. Cópia de lógica de `run-details-page-v2.tsx` (estado, callback, handler)
2. Ajuste de layout para 3 botões inline (reduzir `flex-1` ou usar widths fixos)
3. Filtro de validators usando mesma lógica (FAILED + isHardBlock + !bypassed)
4. Integração com API existente (`api.runs.bypassValidator`)
5. Reload de dados após bypass (refetch `runResults` ou escutar SSE)
6. Validação de estado (disable durante RUNNING, hide se run commitada)
