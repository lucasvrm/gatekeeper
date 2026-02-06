# Testes E2E de Resiliência e Duplicidade

Este diretório contém testes de integração end-to-end que validam a robustez do sistema de reconciliação SSE (Server-Sent Events) implementado no Gatekeeper.

## Cenários Testados

### 1. **Reconexão após Tab Discard** (`TEST 1`)
**Arquivo:** `pipeline-resilience.spec.ts:it('should restore state after tab discard...')`

**Simula:**
1. Pipeline inicia e executa até PLANNING completo (step 2)
2. Aba do browser fecha/descarta (desconexão SSE)
3. Aba reabre: estado restaurado via `GET /api/orchestrator/{id}/status`
4. SSE reconecta automaticamente
5. Pipeline continua até completar

**Valida:**
- Estado (`pipelineStage`, `lastEventId`, `logs`) restaurado corretamente do localStorage
- Hook `usePipelineReconciliation` faz backfill de eventos perdidos via API REST
- SSE não duplica eventos já processados via REST (usando `processedIds` Set)
- UI continua do ponto exato onde parou sem perda de dados

---

### 2. **Divergência Local/Remote (Backend Wins)** (`TEST 2`)
**Arquivo:** `pipeline-resilience.spec.ts:it('should reconcile divergent local/remote state...')`

**Simula:**
1. Cache local pensa que pipeline está em `PLANNING` (step 2)
2. Servidor já avançou para `EXECUTING` (step 3) — cache desatualizado
3. Hook de reconciliação detecta divergência
4. Estado local sobrescrito pelo remoto

**Valida:**
- Backend sempre vence em caso de divergência (source of truth)
- Backfill paginado de eventos perdidos via `/api/orchestrator/{id}/events?sinceId={X}`
- UI "salta" para estado correto sem confusão
- `remoteStep`, `remoteCompletedSteps`, `pipelineStage` atualizados corretamente

---

### 3. **Deduplicação de Eventos Duplicados** (`TEST 3`)
**Arquivo:** `pipeline-resilience.spec.ts:it('should deduplicate duplicate events...')`

**Simula:**
1. Backend envia evento SSE com `lastEventId="X"` duas vezes (bug ou retry HTTP)
2. Frontend detecta duplicata via `processedIds` Set
3. Segundo evento ignorado

**Valida:**
- `processedIds` Set detecta `frameId` já visto
- Handler `onEvent()` não executado na segunda recepção
- Logs, contadores, e estado não duplicados
- Cap de 1000 entradas no Set para prevenir memory leak

---

### 4. **Monotonia de IDs e Sequências** (`TEST 4`)
**Arquivo:** `pipeline-resilience.spec.ts:it('should maintain monotonic event IDs...')`

**Simula:**
1. Pipeline completa executando todos os steps (PLANNING → WRITING → VALIDATION)
2. Monitora `lastEventId` e `lastSeq` durante toda execução

**Valida:**
- `lastSeq` sempre incrementa (nunca decrementa)
- Sem reuso de IDs (Set detectaria)
- Gaps permitidos <= 5 (devido a paralelismo entre eventos bridge/agent)
- Sequência monotonicamente crescente garante ordem de processamento

---

### 5. **Replay via Last-Event-ID** (`TEST 5`)
**Arquivo:** `pipeline-resilience.spec.ts:it('should replay only missed events...')`

**Simula:**
1. SSE conectado, recebe eventos 1-5
2. Desconexão abrupta (network error)
3. Durante desconexão, backend emite eventos 6-10
4. Reconexão SSE com `Last-Event-ID: 5` (header HTTP automático do EventSource)
5. Backend retorna apenas eventos 6-10

**Valida:**
- Backend filtra eventos <= lastEventId
- Frontend não duplica processamento
- Buffer SSE em memória funciona corretamente (TTL ~5min)
- Fallback para API REST se buffer expirou

---

## Arquitetura dos Testes

### Helpers

#### `test-server.ts`
- Inicializa servidor Express isolado na porta 3001
- Limpa banco de dados antes de cada suite
- Fornece instância Prisma para validações diretas
- Métodos: `start()`, `stop()`, `getPrisma()`

#### `test-client.ts`
- Cliente HTTP para requests REST (`post()`, `get()`)
- Cliente SSE com suporte a deduplicação (`connectSSE()`)
- Utilitários: `waitForEvent()`, `pollUntil()`, `wait()`
- Gerencia conexões abertas e cleanup automático

### Fluxo de Teste

```
beforeAll → Inicia servidor + cria workspace/project de teste
  ↓
beforeEach → Limpa AgentOutputs entre testes
  ↓
Test Case → Executa cenário específico
  ↓
afterEach → Fecha todas as conexões SSE
  ↓
afterAll → Cleanup DB + para servidor
```

---

## Executando os Testes

### Pré-requisitos
```bash
# Instalar dependências (se ainda não instalou)
npm install

# Gerar Prisma Client
npm run db:generate --workspace=gatekeeper-api
```

### Comandos

```bash
# Todos os testes E2E de resiliência
npm run test:e2e:resilience --workspace=gatekeeper-api

# Modo watch (útil durante desenvolvimento)
npx vitest test/e2e/pipeline-resilience.spec.ts --watch

# Com verbose output
VITEST_LOG_LEVEL=debug npm run test:e2e:resilience --workspace=gatekeeper-api

# Executar apenas um teste específico
npx vitest -t "should restore state after tab discard"
```

### Timeouts

Os testes possuem timeouts generosos para permitir execução completa de pipelines:

- **TESTE 1** (Tab Discard): 90s
- **TESTE 2** (Divergência): 50s
- **TESTE 3** (Deduplicação): 30s
- **TESTE 4** (Monotonia): 60s
- **TESTE 5** (Replay): 40s

Se os testes falharem por timeout, verifique:
1. Servidor backend rodando corretamente
2. Providers LLM configurados (Claude, OpenAI, Mistral)
3. Sem rate limiting nas APIs externas
4. Hardware suficiente para execução simultânea

---

## Estrutura de Dados Testada

### LocalStorage Session
```typescript
{
  outputId: string
  step: number
  completedSteps: number[]
  lastEventId: number
  lastSeq: number
  pipelineStatus: 'running' | 'completed' | 'failed'
  pipelineStage: 'planning' | 'spec' | 'fix' | 'execute' | 'complete'
  pipelineProgress: number
}
```

### SSE Event Frame
```typescript
{
  lastEventId: string  // e.g., "42"
  data: string         // JSON stringified event
}
```

### Reconciliation Result
```typescript
{
  remoteStep: number | null
  remoteCompletedSteps: number[] | null
  missedEvents: Array<{
    id: number
    eventType: string
    payload: string | null
    stage: string
  }>
  lastEventId: number
  isTerminal: boolean
  pipelineStatus: string | null
  pipelineStage: string | null
  error: string | null
}
```

---

## Debugging

### Logs Detalhados

Os testes incluem logging extensivo:

```
[TEST 1] Starting tab discard test...
[TEST 1] Pipeline started: abc123
[TEST 1] Event received: bridge_init (id: 1)
[TEST 1] PLANNING completed. Collected 15 events
[TEST 1] Tab discarded (SSE closed)
[TEST 1] Restored status: spec, lastEventId: 18
[TEST 1] Backfilled 3 missed events
```

### Checklist de Troubleshooting

- [ ] Servidor backend rodando na porta 3001?
- [ ] Prisma Client gerado (`npm run db:generate`)?
- [ ] Database migrations aplicadas?
- [ ] `.env` configurado com credenciais de providers?
- [ ] EventSource suportado no ambiente de teste (Node.js >=18)?

### Ferramentas Úteis

```bash
# Ver logs do Prisma
export DEBUG="prisma:*"

# Ver requests HTTP
export DEBUG="http"

# Logs detalhados do Vitest
npx vitest --reporter=verbose
```

---

## Cobertura de Edge Cases

| Edge Case | Coberto? | Como é testado |
|-----------|----------|----------------|
| Tab fecha no meio de PLANNING | ✅ | TEST 1 - desconexão programática |
| Network glitch temporário | ✅ | TEST 5 - desconecta/reconecta |
| Cache local desatualizado (> 10min offline) | ✅ | TEST 2 - simula cache stale |
| Backend envia evento duplicado | ✅ | TEST 3 - mock manual de duplicata |
| IDs não monotônicos (bug backend) | ✅ | TEST 4 - assertion explode se decrementar |
| Buffer SSE expirou (> 5min offline) | ⚠️ | Implícito no TEST 2 (backfill via REST) |
| Multi-aba concorrente | ⏳ | Futuro - requer BroadcastChannel mock |
| Race condition local/remote | ✅ | TEST 2 - reconciliation sempre sobrescreve |

**Legenda:**
- ✅ Totalmente coberto
- ⚠️ Parcialmente coberto ou implícito
- ⏳ Planejado para futuro

---

## Contribuindo

Ao adicionar novos testes de resiliência:

1. **Nomeie claramente**: `it('should {comportamento esperado} when {cenário}')`
2. **Documente o fluxo**: Use comentários `// 1. Setup`, `// 2. Action`, `// 3. Assert`
3. **Logs abundantes**: `console.log('[TEST X] ...')` para debugging
4. **Timeouts generosos**: Pipelines reais demoram (30-90s típico)
5. **Cleanup garantido**: Use `afterEach` para fechar SSE e limpar DB
6. **Asserções específicas**: Valide dados concretos, não apenas `toBeTruthy()`

---

## Referências

- **Implementação Frontend**: `src/hooks/usePipelineReconciliation.ts`
- **Implementação SSE Hook**: `src/hooks/useOrchestratorEvents.ts`
- **Backend SSE Endpoint**: `packages/gatekeeper-api/src/api/controllers/BridgeController.ts:streamEvents()`
- **Arquitetura**: `CLAUDE.md` - seção "Fluxo SSE de Erros (Agent Pipeline)"

---

**Última atualização:** 2026-02-06
**Autor:** Gatekeeper Team
**Versão:** 1.0.0
