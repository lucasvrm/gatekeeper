# Microplans - Logs, Export e Métricas

> **Documentação de Microplans Atômicos**
> Sistema de validação Gatekeeper - Features de Observabilidade

---

## 📋 Índice

- [Visão Geral](#-visão-geral)
- [Feature 2: Filtros Avançados de Logs](#feature-2-filtros-avançados-de-logs)
- [Feature 3: Export de Logs](#feature-3-export-de-logs)
- [Feature 4: UI de Visualização de Logs](#feature-4-ui-de-visualização-de-logs)
- [Feature 5: Métricas/Agregações](#feature-5-métricasagregações)
- [Resumo de Esforços](#-resumo-de-esforços)
- [Ordem de Implementação](#-ordem-de-implementação)

---

## 🎯 Visão Geral

Este documento contém os microplans atômicos para implementação das features de observabilidade do sistema Gatekeeper:

| Feature | Prioridade | MPs | Esforço |
|---------|-----------|-----|---------|
| Filtros Avançados de Logs | ⚠️ IMPORTANTE | 6 | ~6h |
| Export de Logs | 💡 NICE TO HAVE | 3 | ~3.5h |
| UI de Visualização de Logs | 💡 NICE TO HAVE | 7 | ~13.5h |
| Métricas/Agregações | 💡 NICE TO HAVE | 7 | ~10h |
| **TOTAL** | - | **23** | **~33h** |

### 📏 Regras dos Microplans

- ✅ Cada MP toca no **máximo 3 arquivos**
- ✅ Cada MP tem no **máximo 4 tarefas**
- ✅ MPs são independentes quando possível
- ✅ Dependências explicitadas com "Depende de"

---

## Feature 2: Filtros Avançados de Logs

> **Prioridade**: ⚠️ IMPORTANTE
> **Objetivo**: Permitir filtragem avançada de logs por level, stage, type, search e date range

<br>

### MP-LOGS-01: Backend Types & Service

**Arquivos (3):**
```
packages/gatekeeper-api/src/types/orchestrator.types.ts       [MODIFY]
packages/gatekeeper-api/src/services/OrchestratorEventService.ts  [MODIFY]
packages/gatekeeper-api/src/api/schemas/orchestrator.schemas.ts   [MODIFY/CREATE]
```

**Tarefas (3):**

1. ✏️ **Adicionar tipos TypeScript para filtros**
   - Criar interface `LogFilterOptions` com: `level`, `stage`, `type`, `search`, `startDate`, `endDate`
   - Exportar em `orchestrator.types.ts`

2. ✏️ **Criar método `getEventsFiltered(pipelineId, filters)` no service**
   - Implementar filtragem in-memory dos eventos no buffer
   - Retornar array de eventos que passam todos os filtros

3. ✏️ **Criar schema Zod de validação**
   - Adicionar `logFilterSchema` em `orchestrator.schemas.ts`
   - Validar tipos de enum (level: info/warn/error, etc)

**Contrato:**
- ✅ `LogFilterOptions` tipado e exportado
- ✅ Método retorna `OrchestratorEvent[]`
- ✅ Schema Zod valida query params do endpoint

**Esforço:** 🟢 Baixo (~1h)

---

### MP-LOGS-02: Backend API Layer

**Arquivos (2):**
```
packages/gatekeeper-api/src/api/controllers/OrchestratorController.ts  [MODIFY]
packages/gatekeeper-api/src/api/routes/orchestrator.routes.ts          [MODIFY]
```

**Tarefas (2):**

1. ✏️ **Adicionar handler `getFilteredLogs(req, res)`**
   - Validar query params com schema do MP-LOGS-01
   - Chamar `eventService.getEventsFiltered()`
   - Retornar JSON com eventos filtrados

2. ✏️ **Registrar rota `GET /api/orchestrator/:pipelineId/logs`**
   - Query params: `level`, `stage`, `type`, `search`, `startDate`, `endDate`
   - Middleware de validação Zod

**Depende de:** MP-LOGS-01

**Contrato:**
- ✅ Endpoint `GET /api/orchestrator/:id/logs?level=error&stage=WRITING`
- ✅ Validação automática via Zod middleware
- ✅ Retorna 400 para query params inválidos

**Esforço:** 🟢 Baixo (~45min)

---

### MP-LOGS-03: Backend Tests

**Arquivos (2):**
```
packages/gatekeeper-api/test/unit/services/OrchestratorEventService.spec.ts  [CREATE]
packages/gatekeeper-api/test/integration/orchestrator.spec.ts                [MODIFY]
```

**Tarefas (2):**

1. ✅ **Criar testes unitários do `getEventsFiltered`**
   - Testar filtragem por level (info/warn/error)
   - Testar filtragem por stage (PLANNING/WRITING/etc)
   - Testar combinação de filtros
   - Testar search (case-insensitive)

2. ✅ **Adicionar testes de integração do endpoint**
   - Testar GET com query params
   - Testar validação de params inválidos (400)
   - Testar pipeline inexistente (404)

**Depende de:** MP-LOGS-02

**Contrato:**
- ✅ Cobertura > 80% do método `getEventsFiltered`
- ✅ Testes E2E do endpoint passam

**Esforço:** 🟢 Baixo (~1h)

---

### MP-LOGS-04: Frontend API Client

**Arquivos (1):**
```
src/lib/api.ts  [MODIFY]
```

**Tarefas (1):**

1. ✏️ **Adicionar método `api.orchestrator.getFilteredLogs(pipelineId, filters)`**
   - Aceitar `LogFilterOptions` (importar do backend types)
   - Serializar query params corretamente (dates como ISO strings)
   - Retornar `Promise<OrchestratorEvent[]>`

**Depende de:** MP-LOGS-02

**Contrato:**
- ✅ Método tipado com TypeScript
- ✅ Error handling consistente com API client existente
- ✅ Query params encodados corretamente

**Esforço:** 🟢 Baixo (~30min)

---

### MP-LOGS-05: Frontend Filters UI

**Arquivos (1):**
```
src/components/orchestrator/log-filters.tsx  [CREATE]
```

**Tarefas (2):**

1. ✏️ **Criar componente `LogFilters`**
   - Props: `filters`, `onFiltersChange`
   - Campos: level (select), stage (select), type (select), search (input), date range (inputs)

2. ✏️ **Estilizar com Radix UI + Tailwind**
   - Usar `Select` do Radix para dropdowns
   - Usar `Input` do shadcn/ui para search/dates
   - Layout: grid responsivo (2 colunas desktop, 1 mobile)

**Contrato:**
- ✅ Componente controlado (valores via props)
- ✅ onChange emite objeto `LogFilterOptions`
- ✅ Acessibilidade (labels, aria-*)

**Esforço:** 🟡 Médio (~1.5h)

---

### MP-LOGS-06: Frontend Integration

**Arquivos (1):**
```
src/components/orchestrator/logs-drawer.tsx  [MODIFY]
```

**Tarefas (1):**

1. ✏️ **Integrar `LogFilters` com `LogsDrawer`**
   - Adicionar state `filters` (useState)
   - Renderizar `<LogFilters />` acima da lista de logs
   - Chamar `api.orchestrator.getFilteredLogs()` quando filtros mudarem
   - Substituir eventos exibidos pelos filtrados

**Depende de:** MP-LOGS-04, MP-LOGS-05

**Contrato:**
- ✅ Filtros aplicados em tempo real
- ✅ Loading state durante fetch
- ✅ Mensagem "Nenhum log encontrado" quando vazio

**Esforço:** 🟢 Baixo (~1h)

---

## Feature 3: Export de Logs

> **Prioridade**: 💡 NICE TO HAVE
> **Objetivo**: Exportar logs para JSON/CSV para análise offline

<br>

### MP-EXPORT-01: Backend Export Endpoint

**Arquivos (3):**
```
packages/gatekeeper-api/src/services/OrchestratorEventService.ts      [MODIFY]
packages/gatekeeper-api/src/api/controllers/OrchestratorController.ts [MODIFY]
packages/gatekeeper-api/src/api/routes/orchestrator.routes.ts         [MODIFY]
```

**Tarefas (3):**

1. ✏️ **Adicionar método helper `formatEventsAsJSON(events)` no service**
   - Retornar string JSON formatado (pretty-print)

2. ✏️ **Criar handler `exportLogs(req, res)` no controller**
   - Buscar eventos (todos ou filtrados via query params)
   - Chamar `formatEventsAsJSON()`
   - Headers: `Content-Type: application/json`, `Content-Disposition: attachment; filename=logs-{pipelineId}.json`

3. ✏️ **Registrar rota `GET /api/orchestrator/:pipelineId/logs/export`**
   - Query params opcionais: mesmos de MP-LOGS-02 (reuso de filtros)

**Contrato:**
- ✅ Endpoint retorna arquivo JSON para download
- ✅ Nome do arquivo inclui pipelineId
- ✅ Filtros reutilizados (DRY)

**Esforço:** 🟢 Baixo (~1h)

---

### MP-EXPORT-02: Frontend Export UI

**Arquivos (2):**
```
src/lib/api.ts                                [MODIFY]
src/components/orchestrator/logs-drawer.tsx   [MODIFY]
```

**Tarefas (3):**

1. ✏️ **Adicionar método `api.orchestrator.exportLogs(pipelineId, filters, format)`**
   - `format`: 'json' | 'csv' (default: 'json')
   - Retornar `Promise<Blob>`

2. ✏️ **Adicionar botão "Export" no `LogsDrawer`**
   - DropdownMenu do Radix: "Export as JSON" / "Export as CSV"
   - Posição: ao lado do botão "Clear" no header

3. ✏️ **Implementar download client-side**
   - Criar blob URL com `URL.createObjectURL(blob)`
   - Criar anchor temporário com `download` attribute
   - Trigger click programático
   - Cleanup do blob URL

**Depende de:** MP-EXPORT-01

**Contrato:**
- ✅ Botão com icon de download (lucide-react)
- ✅ Loading state durante fetch
- ✅ Toast de sucesso/erro
- ✅ Filename: `logs-{pipelineId}-{timestamp}.{ext}`

**Esforço:** 🟡 Médio (~1.5h)

---

### MP-EXPORT-03: CSV Format & Tests

**Arquivos (2):**
```
packages/gatekeeper-api/src/services/OrchestratorEventService.ts  [MODIFY]
packages/gatekeeper-api/test/e2e/orchestrator-export.spec.ts      [CREATE]
```

**Tarefas (2):**

1. ✏️ **Adicionar método `formatEventsAsCSV(events)` no service**
   - Colunas: timestamp, level, stage, type, message, metadata (JSON stringified)
   - Escape de aspas e quebras de linha
   - Header row

2. ✅ **Criar testes E2E do export**
   - Testar export JSON
   - Testar export CSV
   - Validar Content-Type e Content-Disposition headers
   - Validar formato do arquivo baixado

**Depende de:** MP-EXPORT-01

**Contrato:**
- ✅ CSV válido (parse com papa-parse)
- ✅ Cobertura E2E > 80%

**Esforço:** 🟢 Baixo (~1h)

---

## Feature 4: UI de Visualização de Logs

> **Prioridade**: 💡 NICE TO HAVE
> **Objetivo**: Interface avançada com virtualização, infinite scroll e UX polida

<br>

### MP-VIEWER-01: LogItem Component

**Arquivos (1):**
```
src/components/orchestrator/log-item.tsx  [CREATE]
```

**Tarefas (2):**

1. ✏️ **Criar componente `LogItem`**
   - Props: `event: OrchestratorEvent`, `expanded?: boolean`, `onToggle?: () => void`
   - Renderizar: timestamp, level badge, stage badge, type, message
   - Metadata em JSON colapsável (botão expand/collapse)

2. ✏️ **Estilizar badges coloridos**
   - Level: error (red), warn (yellow), info (blue), debug (gray)
   - Stage: cores consistentes com UI existente
   - Hover effect + cursor pointer para expandir

**Contrato:**
- ✅ Componente puro (sem state interno)
- ✅ Acessibilidade (button para expand, aria-expanded)
- ✅ Animação suave de expand/collapse (CSS transition)

**Esforço:** 🟡 Médio (~2h)

---

### MP-VIEWER-02: LogList Component

**Arquivos (1):**
```
src/components/orchestrator/log-list.tsx  [CREATE]
```

**Tarefas (2):**

1. ✏️ **Criar componente `LogList`**
   - Props: `events: OrchestratorEvent[]`, `loading?: boolean`, `error?: Error`
   - Renderizar lista de `<LogItem />`
   - Empty state: "Nenhum log disponível"

2. ✏️ **Adicionar virtualização com `react-window`**
   - Instalar: `npm install react-window`
   - Usar `FixedSizeList` para performance
   - Item height: 60px (collapsed), dynamic (expanded)

**Depende de:** MP-VIEWER-01

**Contrato:**
- ✅ Performance: renderiza 1000+ logs sem lag
- ✅ Loading skeleton (shadcn/ui Skeleton)
- ✅ Error state com retry button

**Esforço:** 🟡 Médio (~2h)

---

### MP-VIEWER-03: LogFilters Component Enhancement

**Arquivos (1):**
```
src/components/orchestrator/log-filters.tsx  [MODIFY]
```

**Tarefas (2):**

1. ✏️ **Adicionar filtro de data range**
   - Usar `Popover` + `Calendar` do shadcn/ui
   - Formato: "Last 1h" / "Last 24h" / "Custom range"

2. ✏️ **Adicionar botão "Reset filters"**
   - Limpar todos os filtros de uma vez
   - Desabilitado quando nenhum filtro aplicado

**Contrato:**
- ✅ Calendar acessível (keyboard navigation)
- ✅ Preset ranges (1h, 24h, 7d, 30d, custom)
- ✅ Indicador visual de filtros ativos (badge count)

**Esforço:** 🟡 Médio (~1.5h)

---

### MP-VIEWER-04: useLogEvents Hook

**Arquivos (2):**
```
src/hooks/useLogEvents.ts  [CREATE]
src/lib/api.ts             [MODIFY]
```

**Tarefas (2):**

1. ✏️ **Criar hook `useLogEvents(pipelineId, filters)`**
   - State: `{ data, loading, error, refetch }`
   - Fetch automático quando `pipelineId` ou `filters` mudam
   - Debounce de 300ms para filtros

2. ✏️ **Adicionar cache in-memory (opcional)**
   - Usar `Map<cacheKey, { data, timestamp }>`
   - TTL: 60s
   - Cache key: `${pipelineId}-${JSON.stringify(filters)}`

**Depende de:** MP-LOGS-04

**Contrato:**
- ✅ Retorna `UseQueryResult`-like object
- ✅ Auto-refetch quando SSE emite novo evento (via custom event)
- ✅ Error handling com retry exponential backoff

**Esforço:** 🟡 Médio (~2h)

---

### MP-VIEWER-05: LogViewer Component

**Arquivos (2):**
```
src/components/orchestrator/log-viewer.tsx   [CREATE]
src/components/orchestrator/logs-drawer.tsx  [MODIFY]
```

**Tarefas (3):**

1. ✏️ **Criar componente `LogViewer`**
   - Usar hooks: `useLogEvents`, `useState` para filtros
   - Renderizar: `<LogFilters />` + `<LogList />`
   - Loading state: skeleton de 10 itens

2. ✏️ **Integrar com `LogsDrawer`**
   - Substituir lista simples por `<LogViewer />`
   - Manter botões existentes (Clear, Export)

3. ✏️ **Adicionar loading states**
   - Skeleton para lista vazia
   - Spinner inline para refetch
   - Disable filtros durante loading

**Depende de:** MP-VIEWER-02, MP-VIEWER-03, MP-VIEWER-04

**Contrato:**
- ✅ UX consistente com design system
- ✅ Loading states não bloqueantes
- ✅ Zero regression de features existentes

**Esforço:** 🟡 Médio (~2h)

---

### MP-VIEWER-06: Pagination & Error Handling

**Arquivos (1):**
```
src/components/orchestrator/log-viewer.tsx  [MODIFY]
```

**Tarefas (2):**

1. ✏️ **Adicionar infinite scroll**
   - Usar `IntersectionObserver` no último item
   - Fetch next page quando observer triggers
   - Indicador "Loading more..." no final da lista

2. ✏️ **Melhorar error handling**
   - Retry button com exponential backoff
   - Toast de erro com detalhes
   - Fallback para dados em cache (stale-while-revalidate)

**Depende de:** MP-VIEWER-05

**Contrato:**
- ✅ Infinite scroll funciona com virtualização
- ✅ Retry não refaz scroll para o topo
- ✅ Cache stale exibido durante refetch

**Esforço:** 🟡 Médio (~1.5h)

---

### MP-VIEWER-07: Tests & Polish

**Arquivos (2):**
```
test/components/orchestrator/log-viewer.spec.tsx  [CREATE]
src/components/orchestrator/log-viewer.tsx        [MODIFY]
```

**Tarefas (2):**

1. ✅ **Criar testes de componente**
   - Renderização de logs
   - Filtragem interativa
   - Expand/collapse de items
   - Loading/error states

2. 🎨 **Polimento UX**
   - Highlight de search terms na mensagem
   - Fade-in animation para novos logs
   - Scroll to top button quando scroll > 500px

**Depende de:** MP-VIEWER-06

**Contrato:**
- ✅ Cobertura > 80%
- ✅ Animações suaves (60fps)
- ✅ Zero layout shift

**Esforço:** 🟡 Médio (~2h)

---

## Feature 5: Métricas/Agregações

> **Prioridade**: 💡 NICE TO HAVE
> **Objetivo**: Dashboard de métricas com agregações por level, stage, type e duração

<br>

### MP-METRICS-01: Backend Types & Utils

**Arquivos (2):**
```
packages/gatekeeper-api/src/types/orchestrator.types.ts  [MODIFY]
packages/gatekeeper-api/src/utils/metrics.ts             [CREATE]
```

**Tarefas (2):**

1. ✏️ **Criar tipos TypeScript para métricas**
   - Interface `LogMetrics`: `totalCount`, `byLevel`, `byStage`, `byType`, `duration`, `firstEvent`, `lastEvent`
   - Exportar em `orchestrator.types.ts`

2. ✏️ **Criar helpers de agregação**
   - `countByField(events, field)`: retorna `Record<string, number>`
   - `calculateDuration(events)`: retorna milliseconds (lastEvent - firstEvent)
   - Funções puras, testáveis

**Contrato:**
- ✅ `LogMetrics` tipado e exportado
- ✅ Utils zero side-effects
- ✅ Edge cases tratados (empty array, single event)

**Esforço:** 🟢 Baixo (~1h)

---

### MP-METRICS-02: Backend Service

**Arquivos (1):**
```
packages/gatekeeper-api/src/services/OrchestratorEventService.ts  [MODIFY]
```

**Tarefas (3):**

1. ✏️ **Criar método `getMetrics(pipelineId)`**
   - Buscar eventos do buffer
   - Calcular totalCount

2. ✏️ **Implementar agregações**
   - Usar helpers de MP-METRICS-01
   - Gerar `byLevel`, `byStage`, `byType`

3. ✏️ **Calcular duração**
   - Timestamp do primeiro e último evento
   - Duração em ms e formatada (HH:mm:ss)

**Depende de:** MP-METRICS-01

**Contrato:**
- ✅ Retorna `LogMetrics` completo
- ✅ Performance: O(n) linear scan
- ✅ Retorna defaults para pipeline sem eventos

**Esforço:** 🟡 Médio (~1.5h)

---

### MP-METRICS-03: Backend Cache & API Layer

**Arquivos (3):**
```
packages/gatekeeper-api/src/services/OrchestratorEventService.ts      [MODIFY]
packages/gatekeeper-api/src/api/controllers/OrchestratorController.ts [MODIFY]
packages/gatekeeper-api/src/api/routes/orchestrator.routes.ts         [MODIFY]
```

**Tarefas (3):**

1. ✏️ **Adicionar cache em memória (opcional)**
   - Map: `pipelineId -> { metrics, expiresAt }`
   - TTL: 60s
   - Invalidar quando novo evento chega

2. ✏️ **Criar handler `getMetrics(req, res)` no controller**
   - Chamar `eventService.getMetrics()`
   - Retornar JSON

3. ✏️ **Registrar rota `GET /api/orchestrator/:pipelineId/metrics`**

**Depende de:** MP-METRICS-02

**Contrato:**
- ✅ Cache opcional (configurável via env)
- ✅ Cache invalidado corretamente
- ✅ Endpoint retorna 404 para pipeline inexistente

**Esforço:** 🟡 Médio (~1.5h)

---

### MP-METRICS-04: Frontend API Client

**Arquivos (1):**
```
src/lib/api.ts  [MODIFY]
```

**Tarefas (1):**

1. ✏️ **Adicionar método `api.orchestrator.getMetrics(pipelineId)`**
   - Retornar `Promise<LogMetrics>`
   - Error handling consistente

**Depende de:** MP-METRICS-03

**Contrato:**
- ✅ Método tipado com TypeScript
- ✅ Integração com error handling do client

**Esforço:** 🟢 Baixo (~20min)

---

### MP-METRICS-05: Frontend MetricsPanel

**Arquivos (1):**
```
src/components/orchestrator/metrics-panel.tsx  [CREATE]
```

**Tarefas (2):**

1. ✏️ **Criar componente `MetricsPanel`**
   - Props: `pipelineId: string`
   - Usar `useQuery` ou custom hook para fetch
   - Layout: 3 colunas de cards (Total, By Level, By Stage)

2. ✏️ **Estilizar cards com Radix UI**
   - `Card` do shadcn/ui
   - Ícones do lucide-react
   - Mini bar charts (opcional: recharts ou CSS-only)

**Depende de:** MP-METRICS-04

**Contrato:**
- ✅ Cards responsivos (stack em mobile)
- ✅ Loading skeleton
- ✅ Duração formatada (HH:mm:ss)

**Esforço:** 🟡 Médio (~2h)

---

### MP-METRICS-06: Frontend Integration

**Arquivos (1):**
```
src/components/orchestrator/logs-drawer.tsx  [MODIFY]
```

**Tarefas (1):**

1. ✏️ **Adicionar toggle "Logs" / "Metrics" no drawer**
   - Tabs do Radix UI no header
   - Renderizar `<LogViewer />` ou `<MetricsPanel />` condicionalmente
   - State persistido em sessionStorage (opcional)

**Depende de:** MP-METRICS-05

**Contrato:**
- ✅ Toggle acessível (keyboard navigation)
- ✅ Transição suave entre views
- ✅ Botões de ação (Export, Clear) contextualizados

**Esforço:** 🟢 Baixo (~1h)

---

### MP-METRICS-07: Tests

**Arquivos (2):**
```
packages/gatekeeper-api/test/unit/services/OrchestratorEventService.spec.ts  [MODIFY]
packages/gatekeeper-api/test/e2e/orchestrator-metrics.spec.ts                [CREATE]
```

**Tarefas (2):**

1. ✅ **Testes unitários do `getMetrics`**
   - Testar agregações corretas
   - Testar cálculo de duração
   - Testar cache (hit/miss)

2. ✅ **Testes E2E do endpoint**
   - Testar GET /metrics
   - Validar estrutura do JSON retornado
   - Testar pipeline inexistente (404)

**Depende de:** MP-METRICS-03

**Contrato:**
- ✅ Cobertura > 80%
- ✅ Testes E2E passam

**Esforço:** 🟡 Médio (~1.5h)

---

## 📊 Resumo de Esforços

### Por Feature

| Feature | MPs | Arquivos Totais | Tarefas Totais | Esforço Total |
|---------|-----|-----------------|----------------|---------------|
| **Filtros Avançados** | 6 | 10 | 12 | ~6h |
| **Export de Logs** | 3 | 7 | 8 | ~3.5h |
| **UI Visualização** | 7 | 9 | 15 | ~13.5h |
| **Métricas** | 7 | 11 | 13 | ~10h |
| **TOTAL** | **23** | **37** | **48** | **~33h** |

### Distribuição de Esforço

| Nível | Quantidade | % Total |
|-------|-----------|---------|
| 🟢 Baixo (<1.5h) | 10 MPs | 43% |
| 🟡 Médio (<3h) | 13 MPs | 57% |
| 🔴 Alto (>3h) | 0 MPs | 0% |

---

## 🚀 Ordem de Implementação

### Sprint 1: Fundação (Filtros + Export)

**Objetivo:** Funcionalidade básica de filtros e export funcionando
**Duração estimada:** ~10h

```
MP-LOGS-01 → MP-LOGS-02 → MP-LOGS-03     [Backend: filtros]
        ↓
MP-LOGS-04 → MP-LOGS-05 → MP-LOGS-06     [Frontend: filtros]
        ↓
MP-EXPORT-01 → MP-EXPORT-02 → MP-EXPORT-03   [Export completo]
```

**Entregáveis:**
- ✅ Filtros funcionais (level, stage, type, search, date range)
- ✅ Export JSON/CSV
- ✅ Testes cobrindo funcionalidades principais

---

### Sprint 2: UI Avançada (Viewer)

**Objetivo:** Interface polida com virtualização e infinite scroll
**Duração estimada:** ~13.5h

```
MP-VIEWER-01 → MP-VIEWER-02               [Componentes base]
        ↓
MP-VIEWER-03 → MP-VIEWER-04               [Filtros avançados + hook]
        ↓
MP-VIEWER-05 → MP-VIEWER-06 → MP-VIEWER-07   [Integração + polish]
```

**Entregáveis:**
- ✅ Lista virtualizada (1000+ logs sem lag)
- ✅ Infinite scroll
- ✅ UX polida (animações, highlights, loading states)
- ✅ Testes de componentes

---

### Sprint 3: Observabilidade (Métricas)

**Objetivo:** Dashboard de métricas e agregações
**Duração estimada:** ~10h

```
MP-METRICS-01 → MP-METRICS-02 → MP-METRICS-03   [Backend]
        ↓
MP-METRICS-04 → MP-METRICS-05 → MP-METRICS-06   [Frontend]
        ↓
MP-METRICS-07                                    [Testes finais]
```

**Entregáveis:**
- ✅ Dashboard de métricas (cards + charts)
- ✅ Agregações por level/stage/type
- ✅ Toggle Logs/Metrics no drawer
- ✅ Cache com TTL
- ✅ Testes unitários + E2E

---

## 📝 Notas Importantes

### Validações

- ✅ Todos os MPs respeitam limite de **3 arquivos**
- ✅ Todos os MPs respeitam limite de **4 tarefas**
- ✅ Dependências explicitadas (palavra-chave "Depende de")
- ✅ Contratos claros para cada MP
- ✅ Esforço estimado por MP (🟢 < 1.5h, 🟡 < 3h, 🔴 > 3h)
- ⚠️ Nenhum MP identificado como 🔴 (todos < 3h)

### Paralelização

MPs independentes podem ser executados em paralelo:
- **Sprint 1:** MP-LOGS-01/02/03 pode rodar em paralelo com MP-EXPORT-01
- **Sprint 2:** MP-VIEWER-01/02 independentes de MP-VIEWER-03
- **Sprint 3:** MP-METRICS-01 independente de frontend (até MP-METRICS-03)

### Cobertura de Testes

Cada feature tem MPs dedicados a testes:
- **Filtros:** MP-LOGS-03 (unitários + integração)
- **Export:** MP-EXPORT-03 (E2E)
- **Viewer:** MP-VIEWER-07 (componentes)
- **Métricas:** MP-METRICS-07 (unitários + E2E)

**Meta de cobertura:** > 80% para todos os MPs de teste

---

## 🔗 Próximos Passos

1. **Revisar e aprovar** este documento de microplans
2. **Criar issues/tickets** para cada MP no sistema de tracking
3. **Alocar MPs** aos sprints no backlog
4. **Começar implementação** pelo MP-LOGS-01 (Backend Types & Service)

---

**Documento criado em:** 2026-02-06
**Versão:** 1.0
**Autores:** Claude Code (via microplan atomization)
