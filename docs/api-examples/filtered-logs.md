# Filtered Logs API - Exemplos de Uso

## Frontend API Client

O método `api.orchestrator.getFilteredLogs()` permite filtrar logs de uma pipeline por múltiplos critérios.

### Importação

```typescript
import { api } from '@/lib/api'
import type { LogFilterOptions } from '@/lib/types'
```

### Exemplos de Uso

#### 1. Buscar todos os logs (sem filtros)

```typescript
const response = await api.orchestrator.getFilteredLogs('pipeline-123')

console.log(response.count)      // Total de eventos
console.log(response.events)     // Array de eventos
```

#### 2. Filtrar por nível (level)

```typescript
// Apenas erros
const errors = await api.orchestrator.getFilteredLogs('pipeline-123', {
  level: 'error'
})

// Apenas warnings
const warnings = await api.orchestrator.getFilteredLogs('pipeline-123', {
  level: 'warn'
})
```

#### 3. Filtrar por estágio (stage)

```typescript
const planningLogs = await api.orchestrator.getFilteredLogs('pipeline-123', {
  stage: 'planning'
})

const executionLogs = await api.orchestrator.getFilteredLogs('pipeline-123', {
  stage: 'execute'
})
```

#### 4. Filtrar por tipo de evento (type)

```typescript
const toolCalls = await api.orchestrator.getFilteredLogs('pipeline-123', {
  type: 'agent:tool_call'
})

const startEvents = await api.orchestrator.getFilteredLogs('pipeline-123', {
  type: 'agent:start'
})
```

#### 5. Busca textual (search)

```typescript
// Case-insensitive
const timeoutErrors = await api.orchestrator.getFilteredLogs('pipeline-123', {
  search: 'timeout'
})

const fileNotFound = await api.orchestrator.getFilteredLogs('pipeline-123', {
  search: 'file not found'
})
```

#### 6. Filtrar por range de datas

```typescript
const now = new Date()
const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

const recentLogs = await api.orchestrator.getFilteredLogs('pipeline-123', {
  startDate: oneHourAgo.toISOString(),
  endDate: now.toISOString()
})
```

#### 7. Combinar múltiplos filtros

```typescript
const filters: LogFilterOptions = {
  level: 'error',
  stage: 'planning',
  search: 'timeout',
  startDate: '2026-02-06T00:00:00Z',
  endDate: '2026-02-06T23:59:59Z'
}

const filtered = await api.orchestrator.getFilteredLogs('pipeline-123', filters)
```

### Resposta (Response)

```typescript
interface FilteredLogsResponse {
  outputId: string           // ID da pipeline
  filters: LogFilterOptions  // Filtros aplicados
  count: number             // Quantidade de eventos retornados
  events: Array<{           // Array de eventos filtrados
    type: string            // Tipo do evento (ex: 'agent:error')
    id?: number            // ID do evento no DB
    timestamp?: number     // Timestamp em ms
    seq?: number          // Sequence number (SSE)
    // ... outros campos dinâmicos do evento
  }>
}
```

### Error Handling

```typescript
try {
  const logs = await api.orchestrator.getFilteredLogs('pipeline-123', {
    level: 'error'
  })
  console.log(`Found ${logs.count} errors`)
} catch (error) {
  console.error('Failed to fetch logs:', error.message)
  // Possíveis erros:
  // - "Failed to fetch filtered logs" (erro genérico)
  // - Validation error (400 - params inválidos via Zod)
}
```

### Validação de Filtros

Os filtros são validados pelo backend (Zod):

- `level`: deve ser um dos valores: `'error'`, `'warn'`, `'info'`, `'debug'`
- `startDate`/`endDate`: devem ser strings ISO 8601 válidas
- `search`: string com até 10KB
- `stage`, `type`: strings com até 100 caracteres

Exemplo de erro de validação:

```typescript
try {
  await api.orchestrator.getFilteredLogs('pipeline-123', {
    level: 'invalid' as any  // ❌ Tipo inválido
  })
} catch (error) {
  // Error: validation error (400)
}
```

### Uso em React Components

```typescript
import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import type { LogFilterOptions, FilteredLogsResponse } from '@/lib/types'

function LogViewer({ pipelineId }: { pipelineId: string }) {
  const [logs, setLogs] = useState<FilteredLogsResponse | null>(null)
  const [filters, setFilters] = useState<LogFilterOptions>({ level: 'error' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true)
      try {
        const data = await api.orchestrator.getFilteredLogs(pipelineId, filters)
        setLogs(data)
      } catch (error) {
        console.error('Failed to fetch logs:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchLogs()
  }, [pipelineId, filters])

  return (
    <div>
      {loading && <p>Loading...</p>}
      {logs && (
        <>
          <p>Found {logs.count} events</p>
          <ul>
            {logs.events.map((event, i) => (
              <li key={i}>{event.type}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
```

## Backend Endpoint

```
GET /api/orchestrator/:outputId/logs
```

**Query Params:**
- `level`: `'error' | 'warn' | 'info' | 'debug'`
- `stage`: string
- `type`: string (exact match)
- `search`: string (case-insensitive)
- `startDate`: ISO 8601 datetime
- `endDate`: ISO 8601 datetime

**Response:**
```json
{
  "outputId": "abc123",
  "filters": {
    "level": "error",
    "stage": "planning"
  },
  "count": 5,
  "events": [
    {
      "type": "agent:error",
      "error": "Connection timeout",
      "timestamp": 1707264000000,
      "seq": 123
    }
  ]
}
```

## Status Codes

- `200 OK`: Logs retornados com sucesso
- `400 Bad Request`: Parâmetros inválidos (validação Zod)
- `500 Internal Server Error`: Erro ao processar filtros
