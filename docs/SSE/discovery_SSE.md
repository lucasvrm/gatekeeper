# Discovery Report: SSE Connection Freeze (Sistêmico)

## Resumo

Sistema apresenta falha sistêmica de SSE (Server-Sent Events) em todos os pontos onde eventos são transmitidos do backend para frontend. Frontend para de receber eventos em determinado momento mesmo com agent/validação rodando, confirmado por export de logs mostrando eventos ausentes na UI. Problema afeta: (1) Orchestrator pipeline (steps 0-4), (2) Validation runs (step 3), (3) Logs drawer.

---

## Arquivos Relevantes

### 1. `src/hooks/useOrchestratorEvents.ts`
**Contexto:** Hook SSE para agent pipeline events (orchestrator + agent)
**Evidência:**
```typescript
eventSource.onerror = (error) => {
  console.error(`[SSE:${basePath}] Error:`, error)
  // On reconnection, browser auto-sends Last-Event-Id header
}

return () => {
  console.log(`[SSE:${basePath}] Closing for:`, id)
  eventSource.close()
}
```
**Observação:** **NÃO há reconnection lógica ativa**. Apenas confia no browser auto-reconnect nativo, que nem sempre funciona. Se conexão cair silenciosamente (sem evento de erro), frontend nunca detecta.

---

### 2. `src/hooks/useRunEvents.ts`
**Contexto:** Hook SSE para validation run events (Gates 0-3)
**Evidência:**
```typescript
eventSource.onerror = (error) => {
  console.error('[SSE] Connection error:', error)
}

return () => {
  console.log('[SSE] Closing connection for run:', runId)
  eventSource.close()
}
```
**Observação:** Idêntico ao useOrchestratorEvents — **zero lógica de reconnection**. Se SSE cair após validação iniciar, eventos são perdidos permanentemente.

---

### 3. `src/hooks/usePipelineReconciliation.ts`
**Contexto:** Backfill de eventos perdidos quando SSE reconecta
**Evidência:**
```typescript
const didReconcileRef = useRef(false)

useEffect(() => {
  if (!outputId || didReconcileRef.current) return
  didReconcileRef.current = true

  async function reconcile() {
    // 1. Fetch remote status
    const remote = await api.orchestrator.status(outputId!)

    // 3. Backfill missed events since last known eventId
    if (localLastEventId < remote.lastEventId) {
      let sinceId = localLastEventId
      let hasMore = true
      while (hasMore) {
        const page = await api.orchestrator.events(outputId!, sinceId, 200)
        missedEvents = missedEvents.concat(page.events.map(e => ({
          id: e.id,
          eventType: e.eventType,
          payload: e.payload,
          stage: e.stage,
        })))
```
**Observação:** Reconciliation **roda apenas UMA VEZ** no mount (`didReconcileRef.current` previne re-runs). Se SSE cair DURANTE execução, não há mecanismo para detectar e re-reconciliar.

---

### 4. `packages/gatekeeper-api/src/services/OrchestratorEventService.ts`
**Contexto:** Backend event buffer e TTL de eventos
**Evidência:**
```typescript
const MAX_BUFFER_PER_OUTPUT = 100 // Máximo de eventos no buffer por outputId
const BUFFER_TTL_MS = parseInt(process.env.SSE_BUFFER_TTL || '60000', 10) // TTL do buffer em ms (60s)

getBufferedEventsWithSeq(outputId: string): Array<{ event: OrchestratorEventData; seq: number }> {
  const buffer = this.eventBuffer.get(outputId)
  if (!buffer) return []

  const cutoff = Date.now() - BUFFER_TTL_MS
  return buffer
    .filter((b) => b.timestamp >= cutoff)
    .map((b) => ({ event: b.event, seq: b.seq }))
}
```
**Observação:** **Buffer expira em 60s**. Se SSE cair e reconectar após 1min, eventos antigos são perdidos. MAX_BUFFER_PER_OUTPUT=100 pode ser insuficiente para long-running agents.

---

### 5. `packages/gatekeeper-api/src/api/routes/orchestrator.routes.ts`
**Contexto:** Endpoint SSE do orchestrator com replay logic
**Evidência:**
```typescript
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
```
**Observação:** Backend **TEM** replay logic quando SSE reconecta (via Last-Event-ID header). Mas depende de: (1) browser enviar Last-Event-ID, (2) buffer não ter expirado, (3) DB ter eventos (limitado a 200). **Problema**: browser nem sempre reconecta automaticamente.

---

### 6. `packages/gatekeeper-api/src/api/routes/orchestrator.routes.ts` (Heartbeat)
**Contexto:** Keepalive SSE para evitar timeouts
**Evidência:**
```typescript
// ── Heartbeat ──
const heartbeatMs = parseInt(process.env.SSE_HEARTBEAT_INTERVAL || '15000', 10)
const heartbeatInterval = setInterval(() => {
  res.write(': heartbeat\n\n')
  flush(res)
}, heartbeatMs)

req.on('close', () => {
  clearInterval(heartbeatInterval)
  OrchestratorEventService.off('orchestrator-event', onEvent)
})
```
**Observação:** Backend envia heartbeat a cada 15s. **Problema**: Se conexão morrer silenciosamente (sem evento de close), backend continua enviando para void. Frontend não detecta.

---

### 7. `packages/gatekeeper-api/src/api/routes/runs.routes.ts`
**Contexto:** Endpoint SSE de validation runs (sem heartbeat!)
**Evidência:**
```typescript
router.get('/runs/:id/events', (req, res) => {
  const { id } = req.params
  console.log('[SSE] Client connected for run:', id)

  res.setHeader('Content-Type', 'text/event-stream')
  // ...
  res.write(': connected\n\n')

  const onEvent = (event: RunEvent) => {
    if (event.runId === id) {
      console.log('[SSE] Sending event to client:', event.type)
      const data = `data: ${JSON.stringify(event)}\n\n`
      res.write(data)
      // Force flush
      const resWithFlush = res as unknown as { flush?: () => void }
      if (typeof resWithFlush.flush === 'function') {
        resWithFlush.flush()
      }
    }
  }

  RunEventService.on('run-event', onEvent)

  req.on('close', () => {
    console.log('[SSE] Client disconnected for run:', id)
    RunEventService.off('run-event', onEvent)
  })
})
```
**Observação:** **NÃO TEM HEARTBEAT!** Validation SSE pode morrer silenciosamente por timeout de proxy/loadbalancer. Também **não tem replay logic** — se SSE cair, eventos perdidos permanentemente.

---

### 8. `packages/gatekeeper-api/src/services/ValidationOrchestrator.ts`
**Contexto:** Validação emite eventos mas não aguarda SSE connect
**Evidência:**
```typescript
await this.runRepository.update(runId, {
  status: 'RUNNING',
  startedAt: new Date(),
})
RunEventService.emitRunStatus(runId, 'RUNNING')

const ctx = await this.buildContext(updatedRun)

const allowedGates = run.runType === 'EXECUTION'
  ? EXECUTION_GATE_NUMBERS
  : CONTRACT_GATE_NUMBERS
const gatesToRun = GATES_CONFIG.filter(g => allowedGates.includes(g.number))

for (const gate of gatesToRun) {
  // ...
  RunEventService.emitValidatorComplete(runId, gate.number, validator.code, result.status, result.passed)
```
**Observação:** ValidationOrchestrator emite eventos **imediatamente** sem verificar se há listeners SSE conectados. Se validação rodar em <1s, frontend pode não ter conectado ainda.

---

### 9. `src/components/orchestrator-page.tsx` (SSE Handler)
**Contexto:** Callback SSE com stale closure risk
**Evidência:**
```typescript
const handleSSE = useCallback(
  (event: OrchestratorEvent) => {
    const debug = debugModeRef.current

    // ── Track execution progress during WRITING phase ──
    if (executionPhaseRef.current === "WRITING") {
      const now = Date.now()
      if (event.type === "agent:start") {
        const myNonce = executionNonceRef.current
        setExecutionProgress(prev => ({
          ...(prev || { iteration: 0, inputTokens: 0, outputTokens: 0, /*...*/ }),
          provider: String(event.provider ?? ""),
          // ...
        } as any))
      }
    }
    // ... 300+ linhas de event handling
  },
  [addLog] // eslint-disable-line react-hooks/exhaustive-deps
)

const { lastSeqRef: sseLastSeqRef } = useOrchestratorEvents(
  outputId,
  handleSSE,
  'orchestrator',
  processedIdsRef.current,
)
```
**Observação:** handleSSE **tem apenas [addLog] nas dependências** mas usa muitos outros states via refs (stepRef, executionPhaseRef, etc). Se useCallback não re-render, pode ter **stale closure** para states não-ref.

---

### 10. `src/components/orchestrator-page.tsx` (Reconciliation Hook)
**Contexto:** Reconciliation backfill roda ao mount mas só UMA vez
**Evidência:**
```typescript
const reconciliation = usePipelineReconciliation(
  resumeOutputId ?? saved?.outputId,
  saved ? {
    outputId: saved.outputId,
    step: saved.step,
    completedSteps: saved.completedSteps,
    lastEventId: saved.lastEventId ?? 0,
    lastSeq: saved.lastSeq ?? 0,
    pipelineStatus: saved.pipelineStatus ?? null,
    pipelineStage: saved.pipelineStage ?? null,
    pipelineProgress: saved.pipelineProgress ?? 0,
  } : null,
)

// Replay missed events through handleSSE to rebuild artifacts/logs
for (const evt of reconciliation.missedEvents) {
  if (evt.payload) {
    try {
      handleSSE(JSON.parse(evt.payload))
    } catch { /* skip unparseable */ }
  }
}
```
**Observação:** Reconciliation **só roda no mount**. Se SSE cair DURANTE execução (após mount), não há trigger para re-reconciliar. Frontend fica esperando eventos que nunca chegam.

---

### 11. `src/components/orchestrator-page.tsx` (Step 3 Validation)
**Contexto:** Validation SSE depende de runId setado APÓS API response
**Evidência:**
```typescript
const handleValidate = async () => {
  // ...
  setValidationStatus("RUNNING")
  setRunResults(null)
  validationResolvedRef.current = false

  const response = await api.runs.create({
    projectId: selectedProjectId,
    outputId,
    taskPrompt: taskDescription,
    manifest,
    contract,
    dangerMode: plan.dangerMode || false,
    runType: "CONTRACT",
  })

  setRunId(response.runId)
  // ...
  addLog("success", `Run ${response.runId} processando — aguardando resultado...`)
  // SSE via useRunEvents will pick up the run and update results inline
}

const shouldConnectRunEvents = validationStatus === "RUNNING" && !!runId
useRunEvents(shouldConnectRunEvents ? runId ?? undefined : undefined, handleRunEvent)
```
**Observação:** **Race condition**: SSE só conecta APÓS `setRunId()`. Mas ValidationController chama `orchestrator.addToQueue()` IMEDIATAMENTE ao criar run. Se validação completa em <1s, eventos são emitidos ANTES do SSE conectar.

---

### 12. `packages/gatekeeper-api/src/api/controllers/ValidationController.ts`
**Contexto:** Backend inicia validação imediatamente sem aguardar SSE
**Evidência:**
```typescript
const run = await prisma.validationRun.create({
  data: {
    projectId: resolvedProjectId,
    outputId: data.outputId,
    projectPath: projectPath,
    // ...
    status: 'PENDING',
    runType: data.runType,
    contractRunId: data.contractRunId,
  },
})

console.log('[createRun] Run created:', run.id)

// For runs with contractRunId, queue automatically (spec will be copied by orchestrator)
if (data.contractRunId) {
  console.log('[createRun] Queueing run automatically...')
  orchestrator.addToQueue(run.id).catch((error) => {
    console.error(`[createRun] Error queueing run ${run.id}:`, error)
  })
} else {
  // Run is in PENDING state, waiting for file upload to start execution
}

res.status(201).json({
  runId: run.id,
  outputId: run.outputId,
  status: run.status,
})
```
**Observação:** Backend **não aguarda SSE conectar** antes de iniciar validação. `orchestrator.addToQueue()` é fire-and-forget. Se run completa antes de frontend conectar SSE, eventos perdidos.

---

### 13. `packages/gatekeeper-api/src/services/ValidationOrchestrator.ts` (Queue)
**Contexto:** PQueue executa validação imediatamente ao receber runId
**Evidência:**
```typescript
export class ValidationOrchestrator {
  private queue: PQueue
  // ...

  constructor() {
    this.queue = new PQueue({ concurrency: 1 })
    // ...
  }

  addToQueue(runId: string): Promise<void> {
    return this.queue.add(() => this.executeRun(runId))
  }
}
```
**Observação:** PQueue com concurrency=1 executa task imediatamente se fila vazia. **Não há delay** para frontend conectar SSE. Validação rápida (<1s) perde todos os eventos.

---

### 14. `packages/gatekeeper-api/src/services/RunEventService.ts`
**Contexto:** RunEventService emite eventos via EventEmitter (in-process only)
**Evidência:**
```typescript
class RunEventServiceClass extends EventEmitter {
  emitRunStatus(runId: string, status: string, data?: Record<string, unknown>) {
    console.log('[RunEventService] Emitting RUN_STATUS:', status, 'for run:', runId)
    this.emit('run-event', {
      type: 'RUN_STATUS',
      runId,
      data: { status, ...data },
    } as RunEvent)
  }

  emitGateComplete(runId: string, gateNumber: number, passed: boolean, gateName: string) {
    console.log('[RunEventService] Emitting GATE_COMPLETE:', gateName, 'for run:', runId)
    this.emit('run-event', {
      type: 'GATE_COMPLETE',
      runId,
      data: { gateNumber, passed, gateName },
    } as RunEvent)
  }
}
```
**Observação:** RunEventService **NÃO persiste eventos** e **não tem buffer**. Se não há listener SSE conectado no momento do emit, evento perdido permanentemente. Diferente do OrchestratorEventService que tem buffer de 60s.

---

### 15. `src/hooks/useOrchestratorEvents.ts` (Deduplication)
**Contexto:** Deduplication de eventos com cap de 1000
**Evidência:**
```typescript
const processedRef = useRef<Set<string>>(processedIds ?? new Set())

eventSource.onmessage = (event) => {
  // Deduplication: skip events already processed via REST backfill
  const frameId = event.lastEventId
  if (frameId && processedRef.current.has(frameId)) {
    return
  }

  // Track this frame ID
  if (frameId) {
    processedRef.current.add(frameId)
    const numericSeq = parseInt(frameId, 10)
    if (!isNaN(numericSeq) && numericSeq > lastSeqRef.current) {
      lastSeqRef.current = numericSeq
    }
    // Cap dedup set to prevent unbounded growth
    if (processedRef.current.size > 1000) {
      const entries = Array.from(processedRef.current)
      processedRef.current = new Set(entries.slice(-500))
    }
  }
```
**Observação:** Dedup set limitado a 1000 eventos (trunca para 500 quando excede). Em long-running pipelines (>1000 eventos), pode causar **wrap-around** e reprocessar eventos antigos. Unlikely mas possível.

---

## Estrutura de Dependências

```
Frontend (React)
├── useOrchestratorEvents (agent pipeline SSE)
│   └── EventSource (browser native)
│       └── Auto-reconnect (browser dependent, não confiável)
├── useRunEvents (validation SSE)
│   └── EventSource (browser native)
│       └── Auto-reconnect (browser dependent, não confiável)
└── usePipelineReconciliation (backfill de eventos perdidos)
    └── api.orchestrator.events() (REST fetch)
        └── Roda apenas UMA VEZ no mount

Backend (Express)
├── /orchestrator/events/:outputId (agent pipeline SSE)
│   ├── Heartbeat: 15s
│   ├── Replay: buffer (60s TTL) + DB fallback (200 eventos)
│   └── EventListener: OrchestratorEventService.on('orchestrator-event')
├── /agent/events/:runId (agent bridge SSE)
│   ├── Heartbeat: 15s
│   ├── Replay: buffer (60s TTL) + DB fallback
│   └── EventListener: OrchestratorEventService.on('orchestrator-event')
└── /runs/:id/events (validation SSE)
    ├── Heartbeat: ❌ AUSENTE
    ├── Replay: ❌ AUSENTE
    └── EventListener: RunEventService.on('run-event')
        └── ❌ NÃO TEM BUFFER (eventos perdidos se sem listener)
```

---

## Padrões Identificados

### Pattern 1: "Fire-and-Forget Event Emission"
Backend emite eventos **sem verificar** se há listeners conectados:
- `ValidationOrchestrator.executeRun()` → emite eventos imediatamente
- `RunEventService.emit()` → EventEmitter in-process (sem buffer)
- Se SSE não conectado = evento perdido

### Pattern 2: "Lazy SSE Connection"
Frontend conecta SSE **DEPOIS** de receber ID via API:
- `handleValidate()` → `api.runs.create()` → `setRunId()` → `useRunEvents()` conecta
- Se backend roda task rápido (<1s), eventos emitidos antes do connect
- **Race condition garantida** em validações rápidas

### Pattern 3: "One-Shot Reconciliation"
Reconciliation backfill roda apenas no mount:
- `usePipelineReconciliation` → `didReconcileRef.current` previne re-runs
- Se SSE cair DURANTE execução, não há trigger para re-reconciliar
- Frontend fica "stuck" esperando eventos que nunca chegam

### Pattern 4: "Silent Connection Death"
Browser EventSource pode morrer silenciosamente:
- `eventSource.onerror` dispara, mas browser pode não reconectar
- Backend heartbeat continua enviando para void
- Frontend nunca detecta que perdeu conexão (sem polling/watchdog)

### Pattern 5: "Buffer Expiration Window"
OrchestratorEventService buffer expira em 60s:
- Long-running agents (>1min) perdem eventos antigos
- Se SSE reconectar após 60s, buffer vazio → fallback DB (limitado 200)
- Eventos além de 200 mais recentes = perdidos permanentemente

---

## Estado Atual vs Desejado

### Estado Atual

| Componente | Status | Problema |
|------------|--------|----------|
| **useOrchestratorEvents** | ⚠️ Parcial | Sem reconnection ativa, depende de browser |
| **useRunEvents** | ❌ Crítico | Sem reconnection, sem heartbeat, sem buffer |
| **usePipelineReconciliation** | ⚠️ Parcial | Só roda UMA vez, não re-reconcilia se SSE cair |
| **orchestrator.routes.ts** | ✅ OK | Heartbeat + replay funcionam (se browser reconectar) |
| **runs.routes.ts** | ❌ Crítico | Sem heartbeat, sem replay, sem buffer |
| **RunEventService** | ❌ Crítico | Sem buffer, eventos perdidos se sem listener |
| **ValidationOrchestrator** | ❌ Crítico | Inicia task antes de SSE conectar |

### Estado Desejado

| Componente | Fix Necessário |
|------------|----------------|
| **useOrchestratorEvents** | Implementar reconnection ativa + watchdog timer |
| **useRunEvents** | Implementar reconnection ativa + watchdog timer |
| **usePipelineReconciliation** | Tornar re-callable quando SSE reconectar |
| **runs.routes.ts** | Adicionar heartbeat + replay logic + buffer |
| **RunEventService** | Adicionar event buffer (60s TTL como Orchestrator) |
| **ValidationController** | Aguardar delay (1-2s) ou SSE handshake antes de queue |

---

## Riscos

### Risco 1: Data Loss em Validações Rápidas
**Severidade:** 🔴 CRÍTICO
**Cenário:** Validation run completa em <1s → todos os eventos perdidos → frontend stuck em loading eterno
**Affected:** Step 3 (Validation)
**Mitigation:** Polling fallback ou delay no backend antes de iniciar validação

### Risco 2: Silent SSE Death em Long-Running Agents
**Severidade:** 🟠 ALTO
**Cenário:** Agent pipeline rodando por >1h → conexão SSE cai silenciosamente → frontend para de receber eventos mas pensa que está conectado
**Affected:** Steps 0, 1, 2, 4 (Agent Pipeline)
**Mitigation:** Watchdog timer no frontend + reconnection ativa

### Risco 3: Buffer Expiration em Pipelines Lentos
**Severidade:** 🟠 ALTO
**Cenário:** Agent roda por >1min → buffer expira (60s TTL) → se SSE reconectar, eventos antigos perdidos
**Affected:** Todos os steps
**Mitigation:** Aumentar BUFFER_TTL_MS ou persistir eventos críticos no DB

### Risco 4: Reconciliation Não Re-Dispara
**Severidade:** 🟡 MÉDIO
**Cenário:** User restaura sessão → reconciliation roda → SSE conecta → SSE cai 30s depois → não há re-reconciliation → eventos perdidos
**Affected:** Session restoration flow
**Mitigation:** Tornar reconciliation re-callable ou adicionar polling watchdog

### Risco 5: Validation Events Sem Buffer
**Severidade:** 🔴 CRÍTICO
**Cenário:** RunEventService.emit() chamado antes de SSE conectar → evento perdido permanentemente (sem buffer)
**Affected:** Step 3 (Validation), todas as runs
**Mitigation:** Adicionar event buffer ao RunEventService (clone de OrchestratorEventService)

---

## Arquivos NÃO Relevantes (descartados)

- `src/components/GatekeeperMCP.spec.ts` — Mock de SSE para testes, não afeta produção
- `src/components/__tests__/*.spec.tsx` — Testes mockados, não usam SSE real
- `packages/gatekeeper-api/src/services/AgentRunnerService.ts` — Emite eventos via OrchestratorEventService (que TEM buffer), não é root cause
- `src/lib/api.ts` — HTTP client, não relacionado a SSE
- `src/components/orchestrator/logs-drawer.tsx` — Consome logs mas não gerencia SSE connection
- `packages/gatekeeper-api/src/repositories/ValidationRunRepository.ts` — CRUD de runs, não emite eventos
