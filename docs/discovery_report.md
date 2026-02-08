# Discovery Report: Hardcoded Provider/Model Cards no Orchestrator

**Data**: 2026-02-07
**Analista**: Claude Code
**Escopo**: Investigação de valores hardcoded nos cards de provider/modelo na página `/orchestrator`

---

## 1. Resumo Executivo

### Problema Identificado
A página `orchestrator-page.tsx` contém **3 pontos de hardcoding** que definem valores de provider/modelo:

1. **Array de steps hardcoded** em `context-panel.tsx` (linhas 128-132)
2. **Fallback hardcoded** em `getDefault()` em `orchestrator-page.tsx` (linha 318)
3. **Catálogo PROVIDER_MODELS hardcoded** em `orchestrator-page.tsx` (linhas 326-331)

### Estado Atual vs Desejado

**Estado Atual**:
- Sistema carrega dados do banco via API (`api.mcp.providers.list()`, `api.mcp.models.list()`, `api.mcp.phases.list()`)
- Enquanto API não carrega, usa fallbacks hardcoded
- Cards sempre mostram os mesmos 4 steps: Discovery (0), Planejamento (1), Testes (2), Execução (4)
- Valores hardcoded: `'claude-code'`, `'sonnet'`, 5 providers fixos

**Estado Desejado** (inferido):
- Cards devem refletir 100% do banco de dados
- Nenhum fallback hardcoded
- Steps dinâmicos baseados em `AgentPhaseConfig`
- Providers/models dinâmicos baseados em `Provider` e `ProviderModel`

### Impacto
- **Baixo impacto funcional**: Sistema funciona (DB está correto, API funciona)
- **Alto impacto de manutenção**: Qualquer mudança de configuração requer alterar código frontend
- **Risco de inconsistência**: UI pode mostrar valores diferentes do banco durante carregamento inicial

---

## 2. Arquivos Relevantes

### 2.1 Frontend — Context Panel
**Arquivo**: `src/components/orchestrator/context-panel.tsx`
**Linhas**: 128-165

```tsx
{([
  { step: 0, label: "Discovery", desc: "codebase exploration" },
  { step: 1, label: "Planejamento", desc: "plan + contract" },
  { step: 2, label: "Testes", desc: "spec file" },
  { step: 4, label: "Execução", desc: "implementation" },
] as const).map(({ step: s, label, desc }) => {
  const cfg = stepLLMs[s] ?? getDefault(s)
  return (
    <div key={s} className="space-y-1.5 p-2.5 rounded-lg border border-border">
      <Select value={cfg.provider} onValueChange={(v) => onStepLLMChange(s, "provider", v)}>
      <Select value={cfg.model} onValueChange={(v) => onStepLLMChange(s, "model", v)}>
    </div>
  )
})}
```

**Evidência**: Array hardcoded define exatamente 4 steps (0, 1, 2, 4). Step 3 não existe no array.

---

### 2.2 Frontend — Fallback de Default Provider
**Arquivo**: `src/components/orchestrator-page.tsx`
**Linhas**: 316-319

```tsx
const getDefault = (s: number): StepLLMConfig => {
  const phase = phaseDefaults.find(p => p.step === s)
  return { provider: phase?.provider ?? 'claude-code', model: phase?.model ?? 'sonnet' }
}
```

**Evidência**: Quando `phaseDefaults` está vazio ou não contém o step, retorna `'claude-code'` e `'sonnet'` hardcoded.

---

### 2.3 Frontend — Catálogo Hardcoded de Providers
**Arquivo**: `src/components/orchestrator-page.tsx`
**Linhas**: 322-331

```tsx
const PROVIDER_MODELS: Record<string, { label: string; models: { value: string; label: string }[] }> =
  Object.keys(providerCatalog).length > 0
    ? providerCatalog
    : {
        "claude-code": { label: "Claude Code CLI", models: [{ value: "sonnet", label: "Sonnet" }, { value: "opus", label: "Opus" }, { value: "haiku", label: "Haiku" }] },
        "codex-cli": { label: "Codex CLI", models: [{ value: "o3-mini", label: "o3-mini" }] },
        "anthropic": { label: "Anthropic (API Key)", models: [{ value: "claude-sonnet-4-5-20250929", label: "Sonnet 4.5" }] },
        "openai": { label: "OpenAI (API Key)", models: [{ value: "gpt-4.1", label: "GPT-4.1" }] },
        "mistral": { label: "Mistral (API Key)", models: [{ value: "mistral-large-latest", label: "Mistral Large" }] },
      }
```

**Evidência**: Objeto hardcoded com 5 providers. Usado como fallback quando `providerCatalog` está vazio.

---

### 2.4 Frontend — Carregamento Dinâmico (API)
**Arquivo**: `src/components/orchestrator-page.tsx`
**Linhas**: 262-282

```tsx
useEffect(() => {
  Promise.all([
    api.mcp.providers.list(),
    api.mcp.models.list(),
    api.mcp.phases.list(),
  ]).then(([providers, models, phases]) => {
    const catalog: Record<string, { label: string; models: { value: string; label: string }[] }> = {}
    for (const prov of providers) {
      catalog[prov.name] = { label: prov.label, models: [] }
    }
    for (const m of models.filter(m => m.isActive)) {
      if (!catalog[m.provider]) catalog[m.provider] = { label: m.provider, models: [] }
      catalog[m.provider].models.push({ value: m.modelId, label: m.label || m.modelId })
    }
    setProviderCatalog(catalog)
    setPhaseDefaults(phases)
  })
}, [])
```

**Evidência**: Sistema carrega dados do banco via 3 endpoints. Popula `providerCatalog` e `phaseDefaults` dinamicamente.

---

### 2.5 API Client — Métodos MCP
**Arquivo**: `src/lib/api.ts`
**Linhas**: 1037-1041, 1098-1105, 1131-1136

```ts
providers: {
  list: async (): Promise<ProviderInfo[]> => {
    const response = await fetchWithAuth(`${AGENT_BASE}/providers`)
    if (!response.ok) return []
    return response.json()
  },
  // ...
},

phases: {
  list: async (): Promise<AgentPhaseConfig[]> => {
    const response = await fetchWithAuth(`${AGENT_BASE}/phases`)
    if (!response.ok) {
      const error = await response.json().catch(() => null)
      throw new Error(error?.error || "Failed to fetch phase configs")
    }
    return response.json()
  },
  // ...
},

models: {
  list: async (provider?: string): Promise<ProviderModel[]> => {
    const params = provider ? `?provider=${encodeURIComponent(provider)}` : ''
    const response = await fetchWithAuth(`${AGENT_BASE}/models${params}`)
    if (!response.ok) throw new Error("Failed to fetch provider models")
    return response.json()
  },
  // ...
},
```

**Evidência**: API client tem métodos para buscar providers, models e phases do backend. Infraestrutura de carregamento dinâmico existe e funciona.

---

### 2.6 Backend — Schema AgentPhaseConfig
**Arquivo**: `packages/gatekeeper-api/prisma/schema.prisma`
**Linhas**: 410-422

```prisma
model AgentPhaseConfig {
  step                  Int      @id @default(autoincrement())
  provider              String   @default("claude-code")
  model                 String   @default("claude-sonnet-4-5-20250929")
  maxTokens             Int      @default(8192)
  maxIterations         Int      @default(30)
  maxInputTokensBudget  Int      @default(0)
  temperature           Float?
  fallbackProvider      String?
  fallbackModel         String?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}
```

**Evidência**: Tabela `AgentPhaseConfig` define configuração por step. Cada step tem `provider`, `model`, `maxTokens`, etc.

---

### 2.7 Backend — Seed de Providers
**Arquivo**: `packages/gatekeeper-api/prisma/seed.ts`
**Linhas**: 746-760

```ts
const providers = [
  { name: 'anthropic',   label: 'Anthropic (API Key)',  authType: 'api_key', envVarName: 'ANTHROPIC_API_KEY',   order: 1 },
  { name: 'openai',      label: 'OpenAI (API Key)',     authType: 'api_key', envVarName: 'OPENAI_API_KEY',      order: 2 },
  { name: 'mistral',     label: 'Mistral (API Key)',    authType: 'api_key', envVarName: 'MISTRAL_API_KEY',     order: 3 },
  { name: 'claude-code', label: 'Claude Code CLI',      authType: 'cli',     envVarName: 'CLAUDE_CODE_ENABLED', order: 4 },
  { name: 'codex-cli',   label: 'Codex CLI',            authType: 'cli',     envVarName: 'CODEX_CLI_ENABLED',   order: 5 },
]

for (const p of providers) {
  await prisma.provider.upsert({
    where: { name: p.name },
    update: { label: p.label, authType: p.authType, envVarName: p.envVarName, order: p.order },
    create: { ...p, isActive: true },
  })
}
```

**Evidência**: Seed cria 5 providers no banco: `anthropic`, `openai`, `mistral`, `claude-code`, `codex-cli`. Mesmo conjunto que está hardcoded no frontend.

---

### 2.8 Backend — Schema Provider
**Arquivo**: `packages/gatekeeper-api/prisma/schema.prisma`
**Linhas**: 372-385

```prisma
model Provider {
  id         String   @id @default(cuid())
  name       String   @unique
  label      String
  authType   String   @default("api_key")
  envVarName String?
  isActive   Boolean  @default(true)
  order      Int      @default(0)
  note       String?
  models     ProviderModel[]
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

**Evidência**: Tabela `Provider` define providers disponíveis. Relação 1:N com `ProviderModel`.

---

### 2.9 Frontend — Type StepLLMConfig
**Arquivo**: `src/components/orchestrator/types.ts`
**Linhas**: 30-33

```ts
export interface StepLLMConfig {
  provider: string
  model: string
}
```

**Evidência**: Interface que define configuração de LLM por step. Usada pelos cards no Context Panel.

---

### 2.10 Frontend — Type AgentPhaseConfig
**Arquivo**: `src/lib/types.ts`
**Linhas**: 386-396

```ts
export interface AgentPhaseConfig {
  step: number
  provider: ProviderName
  model: string
  maxTokens: number
  maxIterations: number
  maxInputTokensBudget: number
  temperature: number | null
  fallbackProvider: ProviderName | null
  fallbackModel: string | null
  createdAt: string
}
```

**Evidência**: Interface frontend que espelha o model Prisma `AgentPhaseConfig`. Retornada por `api.mcp.phases.list()`.

---

### 2.11 Banco de Dados — Dados Atuais
**Query**: `SELECT step, provider, model FROM AgentPhaseConfig ORDER BY step`

```json
[
  { "step": 0, "provider": "claude-code", "model": "sonnet" },
  { "step": 1, "provider": "claude-code", "model": "opus" },
  { "step": 2, "provider": "claude-code", "model": "opus" },
  { "step": 3, "provider": "claude-code", "model": "opus" },
  { "step": 4, "provider": "claude-code", "model": "opus" }
]
```

**Evidência**: Banco tem configurações para 5 steps (0-4). Todos usam `claude-code`. Step 0 usa `sonnet`, demais usam `opus`.

---

## 3. Estrutura de Dependências

```
orchestrator-page.tsx (UI principal)
├─> context-panel.tsx (cards de LLM config)
│   └─> hardcoded steps array [0, 1, 2, 4]
├─> useEffect → api.mcp.* (carregamento dinâmico)
│   ├─> api.mcp.providers.list() → GET /api/agent/providers
│   ├─> api.mcp.models.list()    → GET /api/agent/models
│   └─> api.mcp.phases.list()    → GET /api/agent/phases
└─> PROVIDER_MODELS (fallback hardcoded)
    └─> usado quando providerCatalog está vazio

Backend (gatekeeper-api)
├─> schema.prisma
│   ├─> Provider (5 registros seeded)
│   ├─> ProviderModel (N registros por provider)
│   └─> AgentPhaseConfig (5 registros: steps 0-4)
└─> API Routes
    ├─> GET /api/agent/providers   → ProviderController.list()
    ├─> GET /api/agent/models      → ProviderController.listModels()
    └─> GET /api/agent/phases      → PhaseController.list()
```

---

## 4. Padrões Identificados

### 4.1 Pattern: Fallback Hardcoded
**Localização**:
- `orchestrator-page.tsx:318` (getDefault)
- `orchestrator-page.tsx:326` (PROVIDER_MODELS)

**Comportamento**:
```
if (phaseDefaults está vazio || step não existe) {
  return { provider: 'claude-code', model: 'sonnet' }  // hardcoded
}
```

**Motivo inferido**: Garantir que UI sempre tenha valores válidos durante carregamento inicial ou em caso de falha da API.

### 4.2 Pattern: Dynamic Loading com Race Condition
**Localização**: `orchestrator-page.tsx:262-282`

**Comportamento**:
```
useEffect(() => {
  Promise.all([providers, models, phases]).then(...)
}, [])
```

**Problema potencial**: Se API demora ou falha, UI usa fallbacks hardcoded indefinidamente. Não há retry nem loading state visível para o usuário.

### 4.3 Pattern: Steps Fixos vs Steps Dinâmicos
**Localização**: `context-panel.tsx:128`

**Comportamento**: Array hardcoded `[0, 1, 2, 4]` define quais steps aparecem nos cards.

**Problema**: Step 3 existe no banco (`AgentPhaseConfig` tem step 3), mas não aparece nos cards. Adicionar novo step requer alterar código.

---

## 5. Estado Atual vs Desejado

| Componente | Estado Atual | Estado Desejado (inferido) |
|------------|--------------|----------------------------|
| **Steps no Context Panel** | Hardcoded array `[0,1,2,4]` | Dinâmico: buscar do `api.mcp.phases.list()` |
| **Default provider** | Fallback `'claude-code'` | Buscar primeiro provider ativo do banco |
| **Default model** | Fallback `'sonnet'` | Buscar primeiro model ativo do provider default |
| **PROVIDER_MODELS** | 5 providers hardcoded | 100% do `providerCatalog` (sem fallback) |
| **Loading state** | Não visível para usuário | Spinner ou skeleton durante carregamento |
| **Error handling** | Silencioso (usa fallback) | Toast/alert se API falhar |

---

## 6. Riscos

### 6.1 Risco: Inconsistência Durante Carregamento
**Severidade**: Média
**Probabilidade**: Alta

**Cenário**: Usuário abre `/orchestrator` → API demora 2s → vê cards com valores hardcoded → API carrega → cards mudam de valores → confusão.

**Evidência**: Não há loading state visível. `providerCatalog` inicia vazio, então `PROVIDER_MODELS` sempre usa fallback hardcoded inicialmente.

### 6.2 Risco: "Agente Sonnet Inválido"
**Severidade**: Alta (reportado pelo usuário)
**Probabilidade**: Desconhecida

**Hipótese**: `'sonnet'` é model válido apenas para `claude-code` (CLI). Se sistema tentar usar `'sonnet'` com provider `'anthropic'` (API), falhará.

**Evidência**:
- Hardcoded fallback: `{ provider: 'claude-code', model: 'sonnet' }` (linha 318)
- DB correto: Step 0 usa `claude-code` + `sonnet` ✓
- Mas: se `phaseDefaults` estiver vazio ou corrompido, getDefault retorna `'sonnet'` sem validar provider

**Impacto**: Erros de runtime ao executar agente se provider/model incompatíveis.

### 6.3 Risco: Manutenção Duplicada
**Severidade**: Baixa
**Probabilidade**: Alta

**Cenário**: Admin adiciona novo provider via API → funciona no backend → mas cards não mostram porque está hardcoded → dev precisa atualizar frontend manualmente.

**Evidência**: PROVIDER_MODELS hardcoded (linha 326) tem lista fixa. Adicionar 6º provider requer commit de código.

---

## 7. Arquivos NÃO Relevantes (Descartados)

- `src/components/orchestrator/step-indicator.tsx` — apenas UI de progresso, não lida com configuração
- `src/components/orchestrator/log-viewer.tsx` — exibe logs, não afeta LLM config
- `packages/gatekeeper-api/src/services/AgentRunnerService.ts` — consome PhaseConfig, mas não cria hardcodes
- `packages/gatekeeper-api/src/controllers/BridgeController.ts` — orquestra execução, não define providers
- `packages/gatekeeper-api/src/domain/validators/*` — validação de artifacts, não de providers

---

## 8. Conclusões

### Pontos Críticos
1. **3 hardcodes confirmados**: steps array, getDefault, PROVIDER_MODELS
2. **Infraestrutura dinâmica existe e funciona**: API retorna dados corretos, DB está correto
3. **Gap de UX**: Nenhum loading state ou error handling visível
4. **Risco de incompatibilidade**: Fallback `'sonnet'` pode causar erro se usado com provider errado

### Recomendação
- **Prioridade 1**: Investigar "agente sonnet inválido" reportado pelo usuário
- **Prioridade 2**: Remover fallback hardcoded ou adicionar validação provider/model
- **Prioridade 3**: Tornar steps dinâmicos (buscar de `phaseDefaults`)
- **Prioridade 4**: Adicionar loading/error states na UI

---

**Fim do Relatório**
