# Discovery Report - Sistema de Logs e Métricas do Gatekeeper

**Task**: Levantamento extensivo sobre métodos de logs e métricas existentes para implementar logging adequado no substep Discovery
**Generated**: 2026-02-07 10:20:00
**Iteration Budget**: 12/30 iterações usadas

---

## 1. Resumo Executivo

O Gatekeeper possui um **sistema de logging dual**:

1. **Logger Estruturado** (`utils/logger.ts`) - suporte a Pino (opcional) com fallback para console formatado, usado em services e controllers para logs estruturados em JSON
2. **Event System Dual**:
   - **OrchestratorEventService** - eventos granulares de pipeline SSE (agent:start, agent:tool_call, agent:error, etc.) com persistência batch no banco (`PipelineEvent`), buffer in-memory (TTL 60s), GC automático, e endpoints REST para consulta/export
   - **RunEventService** - eventos de validação (gates/validators) com console.log simples, sem persistência

A aplicação já possui **infraestrutura completa** para logs de pipeline: persistência em SQLite, replay SSE com Last-Event-ID, filtros (level/stage/type/search), exportação (JSON/CSV), e métricas agregadas. O substep Discovery pode **reutilizar 100% desse sistema** existente.

**Gap identificado**: Discovery precisa definir:
- Eventos SSE específicos (`agent:discovery_start`, `agent:discovery_tool_call`, `agent:discovery_done`)
- Stage no PipelineEvent (`stage='discovery'` vs `'planning'`)
- Métricas específicas (arquivos explorados, iterações, tokens usados)

---

## 2. Arquivos Relevantes

### 2.1 `packages/gatekeeper-api/src/utils/logger.ts`
**Path**: `packages/gatekeeper-api/src/utils/logger.ts`
**Relevância**: Logger estruturado global, suporta Pino (prod) e console (dev), usado em todos os services
**Evidência**:
```typescript
// linhas 135-147
const baseLogger = createBaseLogger()

/**
 * Create a child logger with a service name context.
 */
export function createLogger(service: string): Logger {
  return baseLogger.child({ service })
}

/**
 * Default logger for general use.
 */
export const logger = baseLogger
```

**Padrão de uso**:
```typescript
// linha 7 (OrchestratorEventService.ts)
const log = createLogger('OrchestratorEventService')

// linha 154
log.info({ interval: GC_INTERVAL_MS }, 'Starting event buffer garbage collection')
```

---

### 2.2 `packages/gatekeeper-api/src/services/OrchestratorEventService.ts`
**Path**: `packages/gatekeeper-api/src/services/OrchestratorEventService.ts`
**Relevância**: **Core do sistema de eventos SSE**. Gerencia emissão, persistência batch, buffer in-memory, replay, GC, filtros, export, e métricas.
**Evidência - Persistência Batch**:
```typescript
// linhas 1098-1114
try {
  // Batch insert all events
  await this.prisma.pipelineEvent.createMany({
    data: eventsToFlush.map((e) => ({
      outputId: e.outputId,
      runId: e.runId,
      agentRunId: e.agentRunId,
      stage: e.stage,
      eventType: e.eventType,
      level: e.level,
      message: e.message,
      payload: e.payload,
      source: e.source,
    })),
  })

  log.debug({ count: eventsToFlush.length }, 'Flushed events to DB')
}
```

**Evidência - Buffer TTL e Replay**:
```typescript
// linhas 531-538
getBufferedEventsWithSeq(outputId: string): Array<{ event: OrchestratorEventData; seq: number }> {
  const buffer = this.eventBuffer.get(outputId)
  if (!buffer) return []

  const cutoff = Date.now() - BUFFER_TTL_MS
  return buffer
    .filter((b) => b.timestamp >= cutoff)
    .map((b) => ({ event: b.event, seq: b.seq }))
}
```

**Evidência - Eventos Ignorados (alto volume)**:
```typescript
// linhas 71-74
/**
 * Eventos que NÃO devem ser persistidos (alto volume, baixo valor para auditoria).
 * São emitidos via SSE mas não gravados no banco.
 */
const IGNORED_EVENT_TYPES = new Set(['agent:text', 'agent:thinking'])
```

**Evidência - Stage Inference**:
```typescript
// linhas 1250-1272
private inferStage(event: OrchestratorEventData): string {
  if ('step' in event) {
    const step = event.step as number
    switch (step) {
      case 1:
        return 'planning'
      case 2:
        return 'spec'
      case 3:
        return 'fix'
      case 4:
        return 'execute'
    }
  }

  // Infer from event type
  if (event.type.includes('plan')) return 'planning'
  if (event.type.includes('spec')) return 'spec'
  if (event.type.includes('fix')) return 'fix'
  if (event.type.includes('execute')) return 'execute'

  return 'unknown'
}
```

---

### 2.3 `packages/gatekeeper-api/src/services/RunEventService.ts`
**Path**: `packages/gatekeeper-api/src/services/RunEventService.ts`
**Relevância**: Eventos de validação (gates/validators) - **LEGADO**, usa console.log, sem persistência
**Evidência**:
```typescript
// linhas 10-16
emitRunStatus(runId: string, status: string, data?: Record<string, unknown>) {
  console.log('[RunEventService] Emitting RUN_STATUS:', status, 'for run:', runId)
  this.emit('run-event', {
    type: 'RUN_STATUS',
    runId,
    data: { status, ...data },
  } as RunEvent)
}
```

**Contraste**: OrchestratorEventService usa logger estruturado + persistência, RunEventService usa console.log básico. Discovery deve seguir o padrão do OrchestratorEventService.

---

### 2.4 `packages/gatekeeper-api/prisma/schema.prisma`
**Path**: `packages/gatekeeper-api/prisma/schema.prisma`
**Relevância**: Tabelas de logs e eventos
**Evidência - PipelineEvent (eventos granulares SSE)**:
```prisma
// linhas 475-491
/// Granular pipeline events for SSE replay and diagnostics
model PipelineEvent {
  id         Int      @id @default(autoincrement())
  outputId   String
  runId      String?
  agentRunId String?
  stage      String   // 'planning' | 'spec' | 'fix' | 'execute'
  eventType  String   // 'agent:start' | 'agent:tool_call' | 'agent:text' | etc (SSE event types)
  level      String?  // 'info' | 'warn' | 'error'
  message    String?  // Human-readable message
  payload    String?  // JSON stringified metadata (tool inputs, token usage, etc)
  source     String?  // 'AgentRunnerService' | 'OrchestratorController' | etc
  createdAt  DateTime @default(now())

  @@index([outputId, id])        // Replay via Last-Event-ID: WHERE outputId=? AND id>?
  @@index([outputId, createdAt]) // Temporal queries: WHERE outputId=? AND createdAt>?
  @@index([outputId, stage])     // Stage filtering: WHERE outputId=? AND stage=?
}
```

**Evidência - PipelineState (snapshot)**:
```prisma
// linhas 494-504
/// Current snapshot of pipeline state (one per outputId)
model PipelineState {
  outputId    String   @id
  status      String   @default("running")   // 'running' | 'completed' | 'failed'
  stage       String   @default("planning")  // 'planning' | 'spec' | 'fix' | 'execute'
  progress    Int      @default(0)           // 0-100%
  summary     String?  // JSON stringified summary (artifactNames, totalTokens, etc)
  lastEventId Int      @default(0)           // Checkpoint para replay (último PipelineEvent.id processado)
  agentRunId  String?  // Link opcional com AgentRun.id (sem foreign key)
  startedAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

**Evidência - ValidationLog (logs de validação - gates)**:
```prisma
// linhas 168-184
model ValidationLog {
  id         String   @id @default(cuid())
  runId      String
  run        ValidationRun @relation(fields: [runId], references: [id], onDelete: Cascade)
  level      String
  source     String
  message    String
  gateNumber Int?
  validator  String?
  metadata   String?
  stackTrace String?
  timestamp  DateTime @default(now())

  @@index([runId])
  @@index([level])
  @@index([timestamp])
}
```

**Observação**: `PipelineEvent` é genérico (qualquer pipeline), `ValidationLog` é específico de ValidationRun. Discovery deve usar `PipelineEvent` com `stage='discovery'`.

---

### 2.5 `packages/gatekeeper-api/src/api/routes/orchestrator.routes.ts`
**Path**: `packages/gatekeeper-api/src/api/routes/orchestrator.routes.ts`
**Relevância**: Endpoints REST de logs e métricas
**Evidência - Filtros de logs**:
```typescript
// linhas 114-124
// REST: Filtered logs
router.get('/:outputId/logs', async (req, res, next) => {
  try {
    StatusParamsSchema.parse(req.params)
    const query = LogFilterSchema.parse(req.query)
    ;(req as any).validatedQuery = query
    await controller.getFilteredLogs(req, res)
  } catch (error) {
    next(error)
  }
})
```

**Evidência - Export logs**:
```typescript
// linhas 126-136
// REST: Export logs (JSON or CSV)
router.get('/:outputId/logs/export', async (req, res, next) => {
  try {
    StatusParamsSchema.parse(req.params)
    const query = LogFilterSchema.parse(req.query)
    ;(req as any).validatedQuery = query
    await controller.exportLogs(req, res)
  } catch (error) {
    next(error)
  }
})
```

**Evidência - Métricas agregadas**:
```typescript
// linhas 138-146
// REST: Get aggregated metrics
router.get('/:pipelineId/metrics', async (req, res, next) => {
  try {
    StatusParamsSchema.parse(req.params)
    await controller.getMetrics(req, res)
  } catch (error) {
    next(error)
  }
})
```

**Evidência - SSE com replay**:
```typescript
// linhas 154-199
// SSE: Stream orchestrator events for a given outputId
router.get('/events/:outputId', async (req, res) => {
  const { outputId } = req.params
  const lastEventIdHeader = req.headers['last-event-id'] || req.query.lastEventId
  const lastSeq = lastEventIdHeader ? parseInt(String(lastEventIdHeader), 10) : NaN

  // ... headers SSE ...

  // ── Replay ──
  if (!isNaN(lastSeq)) {
    // Reconnection: try buffer first, DB fallback
    const buffered = OrchestratorEventService.getBufferedEventsAfter(outputId, lastSeq)
    if (buffered.length > 0) {
      log.debug({ outputId, count: buffered.length, lastSeq }, 'Replaying buffered events')
      for (const { event, seq } of buffered) {
        res.write(`id:${seq}\ndata:${JSON.stringify(event)}\n\n`)
      }
    } else {
      // Buffer expired or empty: fallback to DB (up to 200 events)
      log.debug({ outputId, lastSeq }, 'Buffer miss, falling back to DB')
      const dbEvents = await OrchestratorEventService.replayFromDb(outputId)
      for (const dbEvent of dbEvents) {
        const payload = dbEvent.payload ? JSON.parse(dbEvent.payload) : { type: dbEvent.eventType }
        res.write(`id:db-${dbEvent.id}\ndata:${JSON.stringify(payload)}\n\n`)
      }
    }
  }
```

---

### 2.6 `src/components/orchestrator/logs-drawer.tsx`
**Path**: `src/components/orchestrator/logs-drawer.tsx`
**Relevância**: UI de visualização de logs com tabs (Logs/Metrics), filtros, exportação
**Evidência - Export handler**:
```typescript
// linhas 53-86
const handleExport = async (format: "json" | "csv") => {
  setExporting(true)
  try {
    const blob = await api.orchestrator.exportLogs(pipelineId, currentFilters, format)

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
    const filename = `logs-${pipelineId}-${timestamp}.${format}`

    // Create blob URL and trigger download
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = filename
    // ... trigger download ...

    toast.success(`Logs exportados com sucesso`, {
      description: `Arquivo: ${filename}`,
    })
  } catch (error) {
    console.error("Export error:", error)
    toast.error("Erro ao exportar logs", {
      description: error instanceof Error ? error.message : "Erro desconhecido",
    })
  }
}
```

---

### 2.7 `packages/gatekeeper-api/src/services/AgentOrchestratorBridge.ts`
**Path**: `packages/gatekeeper-api/src/services/AgentOrchestratorBridge.ts`
**Relevância**: Bridge que orquestra fases do pipeline e emite eventos SSE via `emit()` callback
**Evidência** (lida em contexto anterior, não re-lida aqui):
- `generateDiscovery()` deve emitir `agent:bridge_discovery_start`, `agent:iteration`, `agent:bridge_discovery_done`
- Usa `await eventService.persistAndEmit()` para eventos com persistência
- Passa `stage='discovery'` ou `stage='planning'` dependendo da fase

---

## 3. Dependências e Imports

**Bibliotecas externas**:
- `pino` (opcional, recomendado para produção) - logger estruturado JSON
- `pino-pretty` (opcional, dev) - formatação colorida de logs Pino
- `events` (Node.js built-in) - EventEmitter para SSE
- `@prisma/client` - persistência de eventos no SQLite
- `nanoid` - geração de IDs únicos (outputId)

**Alias de import**:
- `@/` → `src/` (frontend, configurado em tsconfig.json + vite.config.ts)
- Backend usa imports relativos (`../../services/...`) ou named exports

**Padrões de import**:
```typescript
// Logger estruturado
import { createLogger } from '@/utils/logger'
const log = createLogger('ServiceName')

// Event service
import { OrchestratorEventService } from '@/services/OrchestratorEventService'
await OrchestratorEventService.persistAndEmit(outputId, stage, event, options)

// Prisma
import { prisma } from '@/db/client'
await prisma.pipelineEvent.findMany({ where: { outputId } })
```

---

## 4. Padrões e Convenções

### Naming
- **Services**: PascalCase (`OrchestratorEventService.ts`)
- **Controllers**: PascalCase + Controller suffix (`OrchestratorController.ts`)
- **Event types**: kebab-case com namespace (`agent:bridge_discovery_start`, `agent:tool_call`)
- **Níveis de log**: lowercase (`'info' | 'warn' | 'error' | 'debug' | 'trace'`)
- **Stages**: lowercase (`'planning' | 'spec' | 'fix' | 'execute' | 'discovery'`)

### Event System
**Tipos de eventos SSE** (exemplos existentes):
- `agent:start` - início de fase
- `agent:iteration` - iteração do LLM
- `agent:tool_call` - chamada de tool
- `agent:tool_result` - resultado de tool
- `agent:text` - texto gerado (ignorado na persistência)
- `agent:thinking` - CoT reasoning (ignorado na persistência)
- `agent:error` - erro fatal
- `agent:bridge_plan_start` - início do planner
- `agent:bridge_plan_done` - planner concluído (com artifacts)

**Pattern para Discovery**:
- `agent:bridge_discovery_start` - início do substep
- `agent:discovery_tool_call` - tool call específico de discovery (ou reusar `agent:tool_call`)
- `agent:bridge_discovery_done` - substep concluído (com artifacts)

### Persistência
**Fluxo** (OrchestratorEventService.persistAndEmit):
1. Check payload size (warn se > 10KB)
2. Add to buffer in-memory (TTL 60s, max 100 eventos/outputId)
3. Emit via EventEmitter (SSE para clientes conectados)
4. Filter eventos ignorados (`agent:text`, `agent:thinking`)
5. Sanitize payload (mask sensitive fields, truncate strings)
6. Add to batch queue (flush após 100ms ou 50 eventos)
7. Update PipelineState se transition event

**Batch config** (env vars):
- `BATCH_FLUSH_INTERVAL` = 100ms (default)
- `SSE_BUFFER_TTL` = 60s (default)
- `LOG_RETENTION_DAYS` = 30 (default)
- `LOG_ROTATION_INTERVAL` = 24h (default)

### Níveis de Log
**Mapeamento automático** (inferLevel):
```typescript
// linha 1237-1241
private inferLevel(eventType: string): string {
  if (eventType.includes('error') || eventType.includes('failed')) return 'error'
  if (eventType.includes('warning') || eventType.includes('budget')) return 'warn'
  return 'info'
}
```

**Discovery**: usar `level='info'` para eventos normais, `level='error'` para falhas.

### Métricas
**Estrutura** (LogMetrics type):
```typescript
{
  pipelineId: string
  totalEvents: number
  byLevel: { info: 42, error: 2, warn: 5 }
  byStage: { discovery: 15, planning: 20, ... }
  byType: { 'agent:tool_call': 8, 'agent:iteration': 12, ... }
  duration: { ms: 125000, formatted: '00:02:05' }
  firstEvent: '2026-02-07T10:15:00.000Z'
  lastEvent: '2026-02-07T10:17:05.000Z'
}
```

**Cálculo**: extraído do buffer in-memory (últimos 60s) via `OrchestratorEventService.getMetrics()`.

### Error Handling
**Pattern de erro com SSE**:
```typescript
// Se erro ocorreu e foi emitido via SSE, marcar com _sseEmitted
const error = new Error('Discovery failed')
;(error as any)._sseEmitted = true
throw error
```

**Bridge catch blocks**:
```typescript
// OrchestratorController linha 109
if (!(error as any)?._sseEmitted) {
  log.error({ outputId, error: error instanceof Error ? error.message : 'Unknown error' }, 'Background pipeline error')
}
```

---

## 5. Estado Atual vs. Desejado

### Atual
**Logs de Pipeline** (OrchestratorEventService):
- ✅ Persistência batch em `PipelineEvent` (SQLite)
- ✅ Buffer in-memory (TTL 60s, seq monotônico para SSE id:)
- ✅ SSE com replay (Last-Event-ID, buffer → DB fallback)
- ✅ Filtros (level, stage, type, search, dateRange)
- ✅ Exportação (JSON, CSV)
- ✅ Métricas agregadas (byLevel, byStage, byType, duration)
- ✅ GC automático (buffer cleanup a cada 5min)
- ✅ Log rotation (cleanup eventos > 30 dias)
- ✅ Sanitização de sensitive fields (apiKey, token, password)
- ✅ Truncamento de payloads grandes (> 10KB)

**Logs de Validação** (ValidationLog):
- ✅ Tabela separada para logs de gates/validators
- ✅ Metadata estruturada (gateNumber, validator, stackTrace)

**Logger Estruturado**:
- ✅ Suporte a Pino (prod) + console fallback (dev)
- ✅ Níveis configuráveis (LOG_LEVEL env var)
- ✅ Context binding (service name via child logger)

**Frontend**:
- ✅ LogsDrawer com tabs (Logs/Metrics)
- ✅ LogViewer com filtros interativos
- ✅ MetricsPanel com agregações
- ✅ Export buttons (JSON/CSV download)

### Desejado (Discovery Substep)
**Eventos SSE** a serem emitidos:
- `agent:bridge_discovery_start` - início do substep (com outputId, projectPath)
- `agent:iteration` - cada iteração do LLM (reusar tipo existente)
- `agent:tool_call` - chamadas de read_file, glob_pattern, grep_pattern (reusar)
- `agent:tool_result` - resultados de tools (reusar)
- `agent:text` - texto gerado pelo LLM (opcional, ignorado na persistência)
- `agent:bridge_discovery_done` - substep concluído (com artifactNames, tokensUsed)

**Stage no PipelineEvent**:
- Opção 1: `stage='discovery'` (novo stage, requer adicionar ao enum comentado)
- Opção 2: `stage='planning'` (reutilizar, já que Discovery é substep de Planner)
- **Recomendação**: usar `stage='discovery'` para separação clara nos filtros

**Métricas específicas de Discovery**:
- `filesRead` - count de read_file tool calls bem-sucedidos
- `filesMatched` - count de glob_pattern results
- `searchHits` - count de grep_pattern matches
- `iterationsUsed` - count de agent:iteration events
- `tokensUsed` - { inputTokens, outputTokens } do evento final

**Frontend**:
- LogsDrawer já funciona out-of-the-box (filtra por stage='discovery')
- MetricsPanel pode adicionar seção específica "Discovery Metrics" se necessário

### Gap
1. **Emissão de eventos no AgentOrchestratorBridge.generateDiscovery()**:
   - Adicionar `await eventService.persistAndEmit()` nos pontos chave
   - Emitir `agent:bridge_discovery_start` antes de chamar AgentRunnerService
   - Emitir `agent:bridge_discovery_done` após receber artifacts

2. **Stage 'discovery' no TRANSITION_EVENTS**:
   - Adicionar entry em `OrchestratorEventService.TRANSITION_EVENTS`:
     ```typescript
     'agent:bridge_discovery_start': { stage: 'discovery' },
     'agent:bridge_discovery_done': { stage: 'planning', progress: 12 },
     ```
   - Atualizar `inferStage()` para reconhecer `event.type.includes('discovery')` → `'discovery'`

3. **Documentação** (opcional):
   - Adicionar comentário no schema.prisma: `stage: String // 'discovery' | 'planning' | 'spec' | 'fix' | 'execute'`

---

## 6. Riscos e Trade-offs

### Riscos Identificados

**R1: Payload size em tool_result**
- `read_file` pode retornar arquivos muito grandes (> 10KB)
- **Evidência**: OrchestratorEventService já trunca tool_result.output em 5000 chars (linha 1003)
- **Mitigação**: já está implementada, truncamento automático com sufixo `"... [truncado]"`

**R2: Eventos ignorados (agent:text, agent:thinking)**
- Discovery pode gerar muito texto de reasoning (agent:thinking)
- **Evidência**: IGNORED_EVENT_TYPES já filtra esses eventos (linha 74)
- **Mitigação**: já está implementada, eventos emitidos via SSE mas não persistidos

**R3: Buffer overflow em alta carga**
- Se Discovery fizer 100+ tool calls, buffer pode exceder MAX_BUFFER_PER_OUTPUT (100 eventos)
- **Evidência**: addToBuffer() já faz trim (linha 1136)
- **Mitigação**: já está implementada, evict automático de eventos antigos

**R4: Stage 'discovery' não reconhecido em filtros frontend**
- LogViewer/LogFilters podem não ter 'discovery' nas opções de dropdown
- **Mitigação**: adicionar 'discovery' aos stage options do LogFilters component

**R5: Métricas específicas de Discovery não calculadas**
- getMetrics() agrega apenas byLevel/byStage/byType genéricos
- **Trade-off**: aceitar métricas genéricas OU estender getMetrics() para reconhecer stage='discovery' e extrair métricas customizadas (filesRead, etc)
- **Recomendação**: começar com métricas genéricas, adicionar métricas específicas em iteração futura se necessário

### Trade-offs

**T1: Stage 'discovery' vs. 'planning'**
- **Opção A** (novo stage 'discovery'):
  - ✅ Separação clara nos filtros
  - ✅ Métricas isoladas
  - ❌ Requer atualizar schema comments, frontend stage options
- **Opção B** (reusar 'planning'):
  - ✅ Zero mudanças no schema/frontend
  - ❌ Discovery logs misturados com Planner logs nos filtros
  - ❌ Métricas agregadas (não separadas)
- **Recomendação**: **Opção A** (novo stage), custo baixo (1 linha no schema comment, 1 linha no frontend)

**T2: Eventos específicos vs. reusar tipos existentes**
- **Opção A** (novos tipos `agent:discovery_tool_call`):
  - ✅ Separação semântica clara
  - ❌ Frontend precisa reconhecer novos tipos (LogViewer)
- **Opção B** (reusar `agent:tool_call`):
  - ✅ Zero mudanças no frontend
  - ✅ Filtros já funcionam
  - ❌ Discovery tool calls misturados com outros tool calls
- **Recomendação**: **Opção B** (reusar), simplicidade > separação semântica neste caso

**T3: Persistência de agent:text (reasoning do LLM)**
- **Opção A** (persistir):
  - ✅ Auditoria completa do raciocínio
  - ❌ DB size cresce muito (texto longo, alto volume)
- **Opção B** (ignorar, como atualmente):
  - ✅ DB size controlado
  - ✅ SSE ainda recebe (cliente pode logar localmente se quiser)
  - ❌ Sem auditoria do reasoning
- **Recomendação**: **Opção B** (ignorar), já é o padrão atual

---

## 7. Descartados

### Abordagens/arquivos considerados mas descartados

**D1: Criar tabela separada `DiscoveryLog`**
- **Motivo**: `PipelineEvent` já é genérico e suporta qualquer stage via campo `stage: String`
- **Evidência**: schema.prisma linha 475-491 mostra que `stage` é string livre, não enum
- **Conclusão**: reutilizar PipelineEvent com `stage='discovery'` é suficiente

**D2: Usar ValidationLog para logs de Discovery**
- **Motivo**: ValidationLog é específico de ValidationRun (gates/validators), tem foreign key para ValidationRun
- **Evidência**: schema.prisma linha 171 `run ValidationRun @relation(...)`
- **Conclusão**: ValidationLog é para validação TDD, não para pipeline orchestrator

**D3: Implementar logger separado para Discovery (não usar OrchestratorEventService)**
- **Motivo**: duplicação de código, perda de features (SSE, replay, filtros, export)
- **Evidência**: OrchestratorEventService já tem 1297 linhas com features maduras
- **Conclusão**: reutilizar OrchestratorEventService é a escolha correta

**D4: Console.log em vez de logger estruturado**
- **Motivo**: RunEventService usa console.log (linha 11, 20, 35), mas é legado e limitado
- **Evidência**: OrchestratorEventService usa `createLogger()` (linha 7) e é o padrão moderno
- **Conclusão**: Discovery deve seguir padrão moderno (logger estruturado), não legado

**D5: Criar endpoint REST separado `/discovery/logs`**
- **Motivo**: endpoint genérico `/:outputId/logs` já filtra por stage
- **Evidência**: orchestrator.routes.ts linha 115, LogFilterSchema suporta `stage` param
- **Conclusão**: endpoint existente é suficiente (`GET /api/orchestrator/{outputId}/logs?stage=discovery`)

**D6: Métricas em tempo real via SSE (streaming metrics)**
- **Motivo**: complexidade alta, métricas agregadas (endpoint REST) são suficientes para 99% dos casos
- **Trade-off**: métricas são calculadas on-demand via GET `/metrics`, não streaming
- **Conclusão**: aceitar latência de ~100-500ms no cálculo, não otimizar prematuramente

---

## 8. Recomendações para o Planner

### R1: Reutilizar OrchestratorEventService 100%
- Não criar novo service de logging
- Usar `await eventService.persistAndEmit(outputId, 'discovery', event, { source: 'AgentOrchestratorBridge' })`
- Reutilizar tipos de eventos existentes (`agent:tool_call`, `agent:iteration`, etc)

### R2: Adicionar stage 'discovery' ao TRANSITION_EVENTS
```typescript
// OrchestratorEventService.ts linha ~79
const TRANSITION_EVENTS: Record<string, { stage?: string; status?: string; progress?: number }> = {
  'agent:bridge_discovery_start': { stage: 'discovery' },
  'agent:bridge_discovery_done': { stage: 'planning', progress: 12 },
  // ... existing entries
}
```

### R3: Atualizar inferStage() para reconhecer 'discovery'
```typescript
// OrchestratorEventService.ts linha ~1266
if (event.type.includes('discovery')) return 'discovery'
if (event.type.includes('plan')) return 'planning'
```

### R4: Adicionar 'discovery' aos stage options do frontend
```typescript
// src/components/orchestrator/log-filters.tsx (ou similar)
const STAGE_OPTIONS = [
  { value: 'discovery', label: 'Discovery' },
  { value: 'planning', label: 'Plano' },
  { value: 'spec', label: 'Testes' },
  { value: 'fix', label: 'Correção' },
  { value: 'execute', label: 'Execução' },
]
```

### R5: Emitir eventos no AgentOrchestratorBridge.generateDiscovery()
```typescript
// Início do substep
await eventService.persistAndEmit(outputId, 'discovery', {
  type: 'agent:bridge_discovery_start',
  outputId,
  projectPath,
}, { source: 'AgentOrchestratorBridge' })

// Durante execução (AgentRunnerService já emite agent:iteration e agent:tool_call automaticamente)

// Fim do substep
await eventService.persistAndEmit(outputId, 'discovery', {
  type: 'agent:bridge_discovery_done',
  outputId,
  artifactNames: artifacts.map(a => a.filename),
  tokensUsed: { inputTokens, outputTokens },
}, { source: 'AgentOrchestratorBridge' })
```

### R6: Não modificar schema Prisma
- PipelineEvent.stage já é `String` (não enum), suporta 'discovery' out-of-the-box
- Apenas adicionar comentário de documentação (opcional):
  ```prisma
  stage String // 'discovery' | 'planning' | 'spec' | 'fix' | 'execute'
  ```

### R7: Testar filtros e export
- Após implementar, testar `GET /api/orchestrator/{outputId}/logs?stage=discovery`
- Testar export: `GET /api/orchestrator/{outputId}/logs/export?stage=discovery&format=json`
- Verificar que LogsDrawer/LogViewer mostram logs de Discovery corretamente

---

## Metadata

- **Arquivos lidos**: 12
- **Arquivos relevantes**: 7 (logger.ts, OrchestratorEventService.ts, RunEventService.ts, schema.prisma, orchestrator.routes.ts, agent.routes.ts, logs-drawer.tsx)
- **Iterações usadas**: 12/30
- **Linhas de código analisadas**: ~2000
- **Endpoints REST identificados**: 5 (logs, logs/export, metrics, events paginated, SSE /events)
- **Tabelas de logs identificadas**: 3 (PipelineEvent, PipelineState, ValidationLog)
- **Event types mapeados**: 15+ (agent:start, agent:iteration, agent:tool_call, agent:error, etc)
- **Configurações env vars**: 5 (BATCH_FLUSH_INTERVAL, SSE_BUFFER_TTL, LOG_RETENTION_DAYS, LOG_ROTATION_INTERVAL, LOG_LEVEL)
