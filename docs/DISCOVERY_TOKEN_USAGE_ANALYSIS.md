# Discovery Token Usage Analysis

**Data**: 2026-02-07
**Investigação**: Por que o agent recebeu apenas 346 input tokens na iteration 1?

---

## Resumo Executivo

❌ **Problema confirmado**: Agent recebeu prompt incompleto ou vazio na primeira iteração
✅ **Causa raiz**: Provável bug no assembler ou contexto session vazio
✅ **Evidência**: Token usage de 346 é ~66% menor que o esperado

---

## 1. Token Usage Observado (Logs)

```json
{
  "iteration": 1,
  "tokensUsed": {
    "inputTokens": 346,
    "outputTokens": 114,
    "cacheCreationTokens": 3687,
    "cacheReadTokens": 0
  }
}
```

**Análise iteration 1**:
- **inputTokens**: 346 (MUITO BAIXO)
- **cacheCreationTokens**: 3687 (system prompt sendo cacheado pela primeira vez)
- **Agent response**: "I don't see the task description or relevant files in the input..."

**Análise iteration 2** (após tool call `list_directory`):
- **inputTokens**: 24117 (NORMAL - inclui conversation history + tool results)
- **cacheReadTokens**: 3687 (system prompt servido do cache)

---

## 2. Cálculo Teórico de Token Usage

### 2.1 System Prompt (step 0 - Discovery)

**Query DB**: `WHERE step=1 AND role='system' AND name LIKE 'discovery-%'`

Prompts esperados:
- `discovery-mandatory`: ~500 tokens (regras básicas, constraints)
- `discovery-system`: ~800 tokens (instruções detalhadas, exemplos)
- `discovery-examples`: ~300 tokens (exemplos de relatórios)

**Total system prompt estimado**: ~1600 tokens

**Cache behavior**:
- 1ª requisição: `cacheCreationTokens = 1600 * 1.25 = ~2000`
- Observado: `cacheCreationTokens = 3687` → **System prompt tem ~2950 tokens** (não 1600)

### 2.2 User Message (Discovery)

**Código** (`AgentOrchestratorBridge.ts:196`):

```typescript
userMessage = `## Task

**Description:** ${input.taskDescription}

**Output ID:** ${outputId}

**Instructions:** Explore the codebase and generate a discovery_report.md with your findings. Use read_file, glob_pattern, and grep_pattern tools to gather evidence. Save the report using save_artifact("discovery_report.md", content).`
```

**Breakdown** (assumindo `taskDescription = "Auditoria de ValidationOrchestrator context"`):

```
## Task                                                    →   2 tokens

**Description:** Auditoria de ValidationOrchestrator ctx  →  12 tokens

**Output ID:** 2026_02_07_825_auditoria-validation...     →  20 tokens

**Instructions:** Explore the codebase and generate...    →  50 tokens
────────────────────────────────────────────────────────────────────
Total userMessage:                                         ~84 tokens
```

### 2.3 Total Esperado (Iteration 1)

```
System prompt:     ~2950 tokens  (confirmado via cacheCreationTokens)
User message:      ~  84 tokens  (teórico)
Tools definition:  ~ 150 tokens  (READ_TOOLS + SAVE_ARTIFACT_TOOL)
Overhead (API):    ~  20 tokens  (role markers, etc)
─────────────────────────────────────────────────────────────────────
TOTAL ESPERADO:    ~3204 tokens
```

**Observado**: 346 tokens
**Diferença**: -2858 tokens (89% de redução!)

---

## 3. Hipóteses sobre a Discrepância

### Hipótese 1: Cache Read em vez de Cache Creation ❌
**Status**: DESCARTADA

- Se cache já existisse: `cacheReadTokens = 3687`, `inputTokens = 346`
- Mas observado: `cacheCreationTokens = 3687` (cache NOVO)
- **Conclusão**: System prompt foi enviado completo e cacheado

### Hipótese 2: userMessage vazio ou muito curto ✅
**Status**: ALTA PROBABILIDADE

**Evidência**:
- `inputTokens = 346` (muito baixo)
- `cacheCreationTokens = 3687` (system prompt OK)
- **346 = 3687 / 10.6** → userMessage representou apenas ~10% do esperado

**Possíveis causas**:
1. `input.taskDescription` estava vazio
2. Bug na construção do userMessage (template Handlebars?)
3. Variável `userMessage` não foi enviada ao provider

### Hipótese 3: Session Context vazio ❌
**Status**: IMPROVÁVEL

```typescript
const sessionContext = await this.fetchSessionContext(input.profileId)
const basePrompt = await this.assembler.assembleForSubstep(1, 'discovery-')
let systemPrompt = this.enrichPrompt(basePrompt, sessionContext)
```

- `enrichPrompt()` adiciona git strategy + custom instructions
- Se `sessionContext` vazio: system prompt seria ~200 tokens menor
- Mas `cacheCreationTokens = 3687` → system prompt foi enviado completo
- **Conclusão**: Session context não é o problema

### Hipótese 4: Provider não recebeu userMessage corretamente ✅
**Status**: POSSÍVEL

**Teoria**: Bug no `AnthropicProvider.chat()` ou `LLMProvider` abstraction

```typescript
// AgentRunnerService.ts:353
response = await llm.chat({
  model: phase.model,
  system: systemPrompt,
  messages,          // ← [{ role: 'user', content: userMessage }]
  tools,
  maxTokens: phase.maxTokens,
  temperature: phase.temperature,
  enableCache: true,
  cwd: projectRoot,
  onEvent: emit,
})
```

**Verificar**:
1. `messages[0].content` está correto antes da chamada
2. Provider não está fazendo sanitização/truncamento inesperado
3. API do Anthropic recebeu o content completo

---

## 4. Token Breakdown da Iteration 1 (Reversa)

Assumindo que `inputTokens = 346` reflete o que o LLM viu:

```
System prompt (base):              ~2950 tokens  ← cache creation
User message (observado):          ~   ? tokens  ← LOST
Tools definition:                  ~ 150 tokens
Overhead:                          ~  20 tokens
─────────────────────────────────────────────────
```

**Mas**: `cacheCreationTokens = 3687` não conta para `inputTokens`!
**Então**: `inputTokens = 346` representa APENAS:

```
User message:     ~ 200 tokens  (estimativa)
Tools definition: ~ 150 tokens
─────────────────────────────────────────────
Total:            ~ 350 tokens ✓
```

### Recálculo da User Message

Se `userMessage = 200 tokens`:

```
## Task                                                    →   2 tokens
**Description:** ${taskDescription}                       →   ? tokens
**Output ID:** 2026_02_07_825_auditoria-validation...     →  20 tokens
**Instructions:** Explore the codebase and generate...    →  50 tokens
```

**Restam**: 200 - 72 = 128 tokens para `taskDescription`

**Esperado**: "Auditoria de ValidationOrchestrator context" = ~12 tokens
**Se foi 128 tokens**: taskDescription tinha ~10x mais conteúdo?

❌ **NÃO FAZ SENTIDO**: Agent reclamou que não viu task description!

---

## 5. Conclusão da Análise

### ✅ Token Accounting Explicado

**Antropic API**: `inputTokens` NÃO inclui tokens de cache creation/read

```
Iteration 1:
  - inputTokens:          346  ← user message + tools (SEM system prompt)
  - cacheCreationTokens: 3687  ← system prompt (stored in cache)

Iteration 2:
  - inputTokens:        24117  ← conversation history + tool results
  - cacheReadTokens:     3687  ← system prompt (served from cache)
```

**Portanto**:
- System prompt: 3687 tokens (OK)
- User message + tools: 346 tokens
- **User message real**: 346 - 150 (tools) - 20 (overhead) = **~176 tokens**

### ❌ Problema Real

**Esperado**: userMessage com ~84 tokens mínimo
**Observado**: userMessage com ~176 tokens

**MAS**: Agent disse "I don't see the task description" → conteúdo estava vazio/genérico!

**Hipótese FINAL**: `input.taskDescription` estava vazio ou continha apenas texto genérico:

```typescript
// ❌ Enviado:
taskDescription = ""  ou  taskDescription = "..."

// ✅ Esperado:
taskDescription = "Auditoria de ValidationOrchestrator context handling durante pipeline execution"
```

---

## 6. Ação Corretiva

### Debug Logging Adicionado

**Arquivo**: `AgentOrchestratorBridge.ts` (linhas ~198-207)

```typescript
// 🔍 DEBUG: Log prompt composition
console.log('[Bridge:Discovery] ============ PROMPT DEBUG ============')
console.log('[Bridge:Discovery] taskDescription:', input.taskDescription)
console.log('[Bridge:Discovery] outputId:', outputId)
console.log('[Bridge:Discovery] provider type:', this.isCliProvider(phase) ? 'CLI' : 'API')
if (outputDir) console.log('[Bridge:Discovery] outputDir:', outputDir)
console.log('[Bridge:Discovery] userMessage length:', userMessage.length, 'chars')
console.log('[Bridge:Discovery] userMessage preview (first 500):', userMessage.slice(0, 500))
console.log('[Bridge:Discovery] systemPrompt length:', systemPrompt.length, 'chars')
console.log('[Bridge:Discovery] tools:', tools.map(t => t.name))
console.log('[Bridge:Discovery] =========================================')
```

### Próximos Passos

1. ✅ **Logs implementados** → próxima execução mostrará valores exatos
2. ⏳ **User testa discovery novamente** → capturar logs completos
3. ⏳ **Verificar BridgeController** → como `taskDescription` é passado para `generateDiscovery()`
4. ⏳ **Verificar frontend** → como request é montada ao chamar `/api/agent/bridge/discovery`

---

## 7. Arquivos para Investigar

### Backend
- `BridgeController.ts` → método que chama `bridge.generateDiscovery()`
- `agent.routes.ts` → route handler para `/api/agent/bridge/discovery`
- Verificar se body.taskDescription está sendo extraído corretamente

### Frontend
- `orchestrator-page.tsx` → onde discovery é disparada
- Verificar payload do `fetch('/api/agent/bridge/discovery', { ... })`

### Provider Abstraction
- `AnthropicProvider.ts` → verificar se `chat()` envia messages[0].content corretamente
- `LLMProvider.ts` → interface abstrata

---

## 8. Métricas de Referência

### Token Budget (Discovery - step 0)

```typescript
// Configuração atual (DB):
{
  step: 0,
  maxIterations: 5,
  maxInputTokensBudget: 10000,  // 10K input tokens
  maxTokens: 4000               // 4K output tokens
}
```

**Iteration 1 observada**: 346 / 10000 = 3.5% do budget usado ✅

### Comparação com outros steps

**Step 1 (Planner)**: ~1200 input tokens esperados
**Step 0 (Discovery)**: ~350 input tokens observados

**Diferença esperada**: Discovery deveria ser similar ao Planner (ambos recebem task description + instruções)

---

## Apêndice: Logs Completos (Exemplo)

```json
[
  {
    "type": "agent:bridge_start",
    "step": 1,
    "outputId": "2026_02_07_825_auditoria-validationorchestrator-context"
  },
  {
    "type": "agent:start",
    "provider": "anthropic",
    "model": "claude-sonnet-4-5-20250929"
  },
  {
    "type": "agent:iteration",
    "iteration": 1,
    "tokensUsed": {
      "inputTokens": 346,
      "outputTokens": 114,
      "cacheCreationTokens": 3687,
      "cacheReadTokens": 0
    }
  },
  {
    "type": "agent:tool_call",
    "tool": "list_directory",
    "input": {
      "path": ".",
      "recursive": true,
      "maxDepth": 2
    }
  },
  {
    "type": "agent:tool_result",
    "tool": "list_directory",
    "durationMs": 38
  },
  {
    "type": "agent:iteration",
    "iteration": 2,
    "tokensUsed": {
      "inputTokens": 24117,
      "outputTokens": 202,
      "cacheCreationTokens": 3687,
      "cacheReadTokens": 3687
    }
  },
  {
    "type": "agent:complete",
    "result": {
      "text": "I can see this is a large project, but I don't see the task description or relevant files in the input..."
    }
  }
]
```

---

**Contato**: Aguardando nova execução com logs de debug para confirmar valores exatos.
