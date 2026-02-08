# Discovery Report: UX Fixes Consolidados

## Contexto

Durante testes do sistema de orquestração de agentes LLM, foram identificados **7 problemas críticos de UX** que impactam a usabilidade e confiabilidade da interface. Os problemas se dividem em 2 categorias:

1. **State Management** (3 problemas) - Estados travados, recovery inconsistente
2. **UI/Layout** (4 problemas) - Badge redundante, header poluído, scroll, artifacts que desaparecem

## Problemas Identificados

### Categoria 1: State Management (Problemas Críticos)

#### Problema 1.1: Loading State Travado
**Severidade**: 🔴 CRÍTICA
**Impacto**: UI fica inutilizável, força refresh da página

**Sintoma**:
- Usuário clica em "Gerar Testes" (ou qualquer ação de agent)
- Processo morre ou é cancelado
- Botão fica em estado "loading" infinito (spinner + disabled)
- Não há forma de sair do estado sem refresh

**Causa Raiz**:
`orchestrator-page.tsx` linha ~717-721:
```tsx
} else if (event.type === "agent:cancelled") {
  setAgentStatus({ status: 'cancelled', isTerminal: true })
  // ❌ FALTA: setLoading(false), setIsGeneratingSpec(false), etc
}
```

Quando `agent:cancelled` é emitido (usuário clica em Kill ou processo falha), o handler **NÃO limpa os loading states**.

**Estados afetados**:
- `isGeneratingSpec` (linha 477)
- `isGeneratingPlan` (buscar no arquivo)
- `isExecuting` (buscar no arquivo)
- `loading` (linha 398)

**Arquivos afetados**:
- `packages/gatekeeper-api/src/components/orchestrator-page.tsx`

---

#### Problema 1.2: Artifacts Recovery Inconsistente
**Severidade**: 🟠 ALTA
**Impacto**: Usuário perde trabalho, custos desnecessários (refazer plano)

**Sintoma**:
- Artifacts existem no disco (`microplans.json`, `discovery_report.md`, etc)
- Botão "Recuperar do disco" fica desabilitado
- Após refresh: botão habilita mas artifacts não carregam
- Usuário tem que refazer plano desde o início

**Causa Raiz**:
`orchestrator-page.tsx` linha ~1186:
```tsx
if (!outputId || reconciliation.isLoading || planArtifacts.length > 0 ||
    discoveryArtifacts.length > 0 || resuming || resumeOutputId ||
    autoReloadTriedRef.current || loading) {
  return  // ❌ Auto-reload bloqueado por muitas condições
}
```

Auto-reload de artifacts depende de **8 condições simultâneas**. Se qualquer flag estiver travado (ex: `resuming=true`), o recovery falha.

**Flags problemáticos**:
- `resuming` (linha 396) - pode ficar travado se reconciliation falhar
- `loading` (linha 398) - pode estar true de operação anterior
- `reconciliation.isLoading` - pode nunca finalizar

**Arquivos afetados**:
- `packages/gatekeeper-api/src/components/orchestrator-page.tsx`

---

#### Problema 1.3: State Management Frágil
**Severidade**: 🟡 MÉDIA
**Impacto**: Bugs imprevisíveis, interações entre estados causam falhas

**Sintoma**:
- Estados interdependentes causam deadlocks
- `isGeneratingSpec` depende de `loading`
- `loading` depende de `resuming`
- `resuming` depende de `reconciliation.isLoading`
- Qualquer falha em um bloqueia todos os outros

**Causa Raiz**:
Múltiplos flags booleanos ao invés de state machine explícito.

**Estados identificados**:
- `loading` (linha 398)
- `isGeneratingSpec` (linha 477)
- `isGeneratingPlan` (buscar)
- `isExecuting` (buscar)
- `resuming` (linha 396)
- `reconciliation.isLoading` (hook externo)

**Solução sugerida**:
Consolidar em state machine único:
```tsx
type AgentPhase = 'idle' | 'generating_discovery' | 'generating_plan' |
                  'generating_spec' | 'executing' | 'validating'

const [agentPhase, setAgentPhase] = useState<AgentPhase>('idle')
const isLoading = agentPhase !== 'idle'
```

**Arquivos afetados**:
- `packages/gatekeeper-api/src/components/orchestrator-page.tsx`

---

### Categoria 2: UI/Layout (Problemas Visuais)

#### Problema 2.1: Badge "Plano" Redundante
**Severidade**: 🟢 BAIXA
**Impacto**: Poluição visual

**Sintoma**:
No step indicator, quando `plannerSubstep === 'planner'`, mostra:
```
┌─────────┐
│  PLAN   │  ← Badge principal
└─────────┘
    ↓
  [Plano]    ← Badge redundante
```

**Causa Raiz**:
`step-indicator.tsx` linha 12-16:
```tsx
const getSubstepLabel = (substep: PlannerSubstep) => {
  if (substep === 'discovery') return 'Discovery'
  if (substep === 'planner') return 'Plano'  // ❌ Redundante
  return null
}
```

**Fix**: Remover linha 14 (`if (substep === 'planner') return 'Plano'`)

**Arquivos afetados**:
- `src/components/orchestrator/step-indicator.tsx`

---

#### Problema 2.2: Header Poluído
**Severidade**: 🟢 BAIXA
**Impacto**: Informação desnecessária no header

**Sintoma**:
Header da página mostra ao lado do botão "Orchestrator":
- Últimos 8 caracteres do outputId (ex: `feat-abc`)
- Contador de steps (ex: `Step 2/4`)

**Causa Raiz**:
`orchestrator-page.tsx` linha 444-456:
```tsx
const headerPortals = usePageShell({
  page: "orchestrator",
  headerRight: outputId ? (
    <div className="flex items-center gap-2">
      <Badge variant="secondary" className="text-xs">
        Step {step}/4  ← Redundante (step indicator já mostra)
      </Badge>
      <span className="text-xs text-muted-foreground font-mono">
        {outputId.slice(-8)}  ← Não útil (truncado)
      </span>
    </div>
  ) : null,
})
```

**Fix**: Remover `headerRight` completamente ou passar `null`

**Arquivos afetados**:
- `packages/gatekeeper-api/src/components/orchestrator-page.tsx`

---

#### Problema 2.3: Botão "Prosseguir" Fora da Viewport
**Severidade**: 🟡 MÉDIA
**Impacto**: UX ruim, usuário tem que scroll down e depois scroll up

**Sintoma**:
No Step 0, quando task description é longa:
1. Usuário escreve texto grande no textarea
2. Textarea cresce, empurra botão "Prosseguir" para fora da viewport
3. Usuário tem que **scroll down** para clicar
4. Após clicar, precisa **scroll up** manualmente para ver o próximo step

**Comportamento esperado**:
Igual aos outros steps (2, 3, 4): container com altura fixa + scroll interno. Botão sempre visível.

**Causa Raiz**:
`orchestrator-page.tsx` linha 2254-2424:
```tsx
{step === 0 && (
  <div className="space-y-4">
    <Card>
      <CardHeader>...</CardHeader>
      <CardContent className="space-y-4">
        {/* Textarea cresce infinitamente */}
        <Textarea rows={6} ... />

        {/* Attachments */}
        <div>...</div>

        {/* Botão no final */}
        <Button>Prosseguir →</Button>
      </CardContent>
    </Card>
  </div>
)}
```

**Fix**: Adicionar `maxHeight` + `overflowY: auto` no `CardContent`

**Exemplo de implementação** (outros steps):
```tsx
<Card style={{ maxHeight: 'calc(100vh - 300px)', display: 'flex', flexDirection: 'column' }}>
  <CardHeader>...</CardHeader>
  <CardContent style={{ flex: 1, overflowY: 'auto' }}>
    {/* Conteúdo */}
  </CardContent>
</Card>
```

**Arquivos afetados**:
- `packages/gatekeeper-api/src/components/orchestrator-page.tsx`

---

#### Problema 2.4: Artifacts Desaparecem ao Mudar de Step
**Severidade**: 🟠 ALTA
**Impacto**: Usuário perde visibilidade do progresso

**Sintoma**:
Artifacts gerados desaparecem ao avançar de step:
- Discovery Report: visível só em `plannerSubstep === 'discovery'`
- Microplans: visível só em `step === 2`
- Spec: visível só em `step >= 3`

**Comportamento esperado**:
Uma vez gerado, artifact fica visível **permanentemente**.

**Causa Raiz**:

**Discovery** (`orchestrator-page.tsx` linha ~2458):
```tsx
{plannerSubstep === 'discovery' && discoveryReportContent && (
  // ❌ Condição de substep remove artifact ao avançar
  <Card>
    <CardTitle>Discovery Report</CardTitle>
    <ArtifactViewer artifacts={discoveryArtifacts} ... />
  </Card>
)}
```

**Microplans** (linha ~2520 - buscar):
```tsx
{step === 2 && planArtifacts.length > 0 && (
  // ❌ Condição de step remove ao avançar para step 3
  <Card>...</Card>
)}
```

**Fix**: Remover condição de step/substep, manter apenas validação de conteúdo:
```tsx
{discoveryReportContent && <Card>...</Card>}
{planArtifacts.length > 0 && <Card>...</Card>}
{specArtifacts.length > 0 && <Card>...</Card>}
```

**Arquivos afetados**:
- `packages/gatekeeper-api/src/components/orchestrator-page.tsx`

---

## Arquivos Afetados (Resumo)

| Arquivo | Problemas | Linhas Críticas |
|---------|-----------|-----------------|
| `src/components/orchestrator/step-indicator.tsx` | 2.1 | 12-16 |
| `packages/gatekeeper-api/src/components/orchestrator-page.tsx` | 1.1, 1.2, 1.3, 2.2, 2.3, 2.4 | 398, 444-456, 477, 717-721, 1186, 2254-2424, 2458, 2520 |

---

## Estratégia de Implementação

### MP-UX-1: Fixes Visuais (Rápidos)
- ✅ Problema 2.1: Badge redundante
- ✅ Problema 2.2: Header poluído
- ✅ Problema 2.3: Scroll no Step 0
- ✅ Problema 2.4: Artifacts persistem

**Complexidade**: Baixa (mudanças localizadas)
**Tempo estimado**: 10-15min
**Risco**: Baixo (zero impacto em lógica)

### MP-UX-2: Fixes de State Management (Complexos)
- ✅ Problema 1.1: Loading state travado
- ✅ Problema 1.2: Recovery inconsistente
- ✅ Problema 1.3: State consolidation

**Complexidade**: Alta (refatoração de estados)
**Tempo estimado**: 20-30min
**Risco**: Médio (pode afetar fluxo SSE)

---

## Critérios de Sucesso

### MP-UX-1:
- [ ] Badge "Plano" não aparece quando `plannerSubstep === 'planner'`
- [ ] Header não mostra outputId truncado nem contador "Step X/4"
- [ ] Step 0: botão "Prosseguir" sempre visível (mesmo com textarea longo)
- [ ] Discovery Report visível mesmo após avançar para planner
- [ ] Microplans visível mesmo após avançar para step 3
- [ ] Specs visível após geração (não desaparece)
- [ ] Typecheck passa sem erros (frontend)

### MP-UX-2:
- [ ] `agent:cancelled` limpa todos os loading states
- [ ] Timeout de 5min auto-limpa loading states (failsafe)
- [ ] Auto-reload de artifacts funciona mesmo com `resuming=true`
- [ ] Botão "Recuperar do disco" sempre habilitado (exceto quando já carregando)
- [ ] Estados consolidados em state machine (opcional/futuro)
- [ ] Typecheck passa sem erros (frontend)
- [ ] SSE events continuam funcionando normalmente

---

## Notas Técnicas

### SSE Events (Problema 1.1)
O evento `agent:cancelled` é emitido quando:
- Usuário clica em "Kill Agent"
- Backend mata processo (`BridgeController.killAgent()`)
- Processo morre por timeout

Handler atual (`orchestrator-page.tsx` linha ~717):
```tsx
} else if (event.type === "agent:cancelled") {
  setAgentStatus({ status: 'cancelled', isTerminal: true })
}
```

**Fix necessário**:
```tsx
} else if (event.type === "agent:cancelled") {
  setAgentStatus({ status: 'cancelled', isTerminal: true })
  setLoading(false)
  setIsGeneratingSpec(false)
  setIsGeneratingPlan(false)
  setIsExecuting(false)
}
```

### Auto-reload Logic (Problema 1.2)
Auto-reload acontece em `useEffect` (linha ~1180-1248).

**Condições atuais** (muito restritivas):
```tsx
if (!outputId || reconciliation.isLoading || planArtifacts.length > 0 ||
    discoveryArtifacts.length > 0 || resuming || resumeOutputId ||
    autoReloadTriedRef.current || loading) {
  return
}
```

**Fix sugerido** (apenas essenciais):
```tsx
if (!outputId || autoReloadTriedRef.current || planArtifacts.length > 0) {
  return
}
// Remove dependências de: resuming, loading, reconciliation
```

### Artifacts Persistence (Problema 2.4)
Artifacts são salvos em `{artifactsDir}/{outputId}/`:
- `discovery_report.md`
- `microplans.json`
- `{testFileName}.spec.ts`

Estados React:
- `discoveryReportContent` (string)
- `discoveryArtifacts` (array)
- `planArtifacts` (array)
- `specArtifacts` (array)

Esses estados **NÃO devem ser limpos** ao mudar de step. Apenas quando:
1. Usuário clica em "Reset"
2. Nova sessão é iniciada (outputId muda)

---

## Testes Manuais Recomendados

### Após MP-UX-1:
1. Iniciar nova tarefa, gerar discovery → verificar badge "Discovery" aparece
2. Avançar para planner → verificar badge "Plano" NÃO aparece
3. Verificar header → NÃO deve ter outputId nem "Step X/4"
4. Escrever task description longa (20 linhas) → botão "Prosseguir" visível
5. Gerar discovery → card Discovery Report aparece
6. Avançar para planner → Discovery Report continua visível
7. Gerar microplans → card Microplans aparece
8. Avançar para step 3 → Microplans continua visível

### Após MP-UX-2:
1. Iniciar geração de testes → clicar em "Kill Agent"
2. Verificar: botão sai de loading state imediatamente
3. Gerar plano com sucesso → refresh da página
4. Verificar: prompt "Restaurar sessão" aparece
5. Clicar em "Continuar Sessão" → artifacts carregam
6. Verificar: microplans.json foi carregado do disco (zero tokens gastos)
7. Deixar agent rodando por 5min → verificar timeout auto-limpa loading

---

## Dependências

- **Frontend**: React 19, TypeScript strict
- **UI Components**: Radix UI (Card, Button, Badge, etc)
- **Hooks**: `usePageShell`, `useOrchestratorEvents`, `usePipelineReconciliation`
- **Types**: `WizardStep`, `PlannerSubstep`, `ParsedArtifact`, `AgentStatus`

---

## Referências

- CLAUDE.md: Padrões de código e comandos
- MEMORY.md: Histórico de bugs (SSE freeze, template bugs, etc)
- `orchestrator/types.ts`: Type definitions
- `BridgeController.ts`: Backend handlers para kill, artifacts, etc
