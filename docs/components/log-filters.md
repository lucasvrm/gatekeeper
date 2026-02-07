# LogFilters Component

Componente de filtros para logs do orquestrador com suporte a múltiplos critérios de filtragem.

## Importação

```typescript
import { LogFilters } from '@/components/orchestrator/log-filters'
import type { LogFilterOptions } from '@/lib/types'
```

## Props

| Prop | Tipo | Descrição |
|------|------|-----------|
| `filters` | `LogFilterOptions` | Objeto com os filtros atualmente aplicados (controlado) |
| `onFiltersChange` | `(filters: LogFilterOptions) => void` | Callback chamado quando os filtros mudam |

## LogFilterOptions

```typescript
interface LogFilterOptions {
  level?: 'error' | 'warn' | 'info' | 'debug'
  stage?: string
  type?: string
  search?: string
  startDate?: string  // ISO 8601 datetime string
  endDate?: string    // ISO 8601 datetime string
}
```

## Features

- ✅ **Componente controlado** - Estado gerenciado pelo componente pai
- ✅ **6 tipos de filtros**:
  - Level (Select com badges coloridos)
  - Search (busca textual)
  - Stage (input texto)
  - Type (input texto)
  - Start Date (datetime picker)
  - End Date (datetime picker)
- ✅ **Botão "Limpar"** - Remove todos os filtros de uma vez
- ✅ **Indicador visual** - Mostra filtros ativos como badges
- ✅ **Layout responsivo** - Grid de 2 colunas (desktop) / 1 coluna (mobile)
- ✅ **Acessibilidade completa** - Labels, aria-labels, keyboard navigation

## Exemplo Básico

```typescript
import { useState } from 'react'
import { LogFilters } from '@/components/orchestrator/log-filters'
import type { LogFilterOptions } from '@/lib/types'

function MyComponent() {
  const [filters, setFilters] = useState<LogFilterOptions>({})

  return (
    <div>
      <LogFilters
        filters={filters}
        onFiltersChange={setFilters}
      />

      <pre>{JSON.stringify(filters, null, 2)}</pre>
    </div>
  )
}
```

## Exemplo com Fetch de Logs

```typescript
import { useState, useEffect } from 'react'
import { LogFilters } from '@/components/orchestrator/log-filters'
import { api } from '@/lib/api'
import type { LogFilterOptions, FilteredLogsResponse } from '@/lib/types'

function LogViewer({ pipelineId }: { pipelineId: string }) {
  const [filters, setFilters] = useState<LogFilterOptions>({})
  const [logs, setLogs] = useState<FilteredLogsResponse | null>(null)
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
  }, [pipelineId, filters]) // Re-fetch quando filtros mudam

  return (
    <div className="space-y-4">
      <LogFilters
        filters={filters}
        onFiltersChange={setFilters}
      />

      {loading && <p>Carregando...</p>}

      {logs && (
        <div>
          <p className="text-sm text-muted-foreground">
            {logs.count} eventos encontrados
          </p>
          <ul className="space-y-2">
            {logs.events.map((event, i) => (
              <li key={i} className="border rounded p-2">
                <span className="font-mono text-xs">{event.type}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
```

## Exemplo com Debounce

Para evitar múltiplas requisições ao digitar, use debounce:

```typescript
import { useState, useEffect, useCallback } from 'react'
import { LogFilters } from '@/components/orchestrator/log-filters'
import { api } from '@/lib/api'
import type { LogFilterOptions } from '@/lib/types'

function LogViewerWithDebounce({ pipelineId }: { pipelineId: string }) {
  const [filters, setFilters] = useState<LogFilterOptions>({})
  const [debouncedFilters, setDebouncedFilters] = useState<LogFilterOptions>({})

  // Debounce de 500ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters(filters)
    }, 500)

    return () => clearTimeout(timer)
  }, [filters])

  // Fetch apenas quando debouncedFilters muda
  useEffect(() => {
    const fetchLogs = async () => {
      const data = await api.orchestrator.getFilteredLogs(pipelineId, debouncedFilters)
      console.log(data)
    }
    fetchLogs()
  }, [pipelineId, debouncedFilters])

  return (
    <LogFilters
      filters={filters}
      onFiltersChange={setFilters}
    />
  )
}
```

## Exemplo com Filtros Iniciais

```typescript
function LogViewerWithDefaults({ pipelineId }: { pipelineId: string }) {
  const [filters, setFilters] = useState<LogFilterOptions>({
    level: 'error',  // Mostrar apenas erros por padrão
    stage: 'planning'
  })

  return (
    <LogFilters
      filters={filters}
      onFiltersChange={setFilters}
    />
  )
}
```

## Estrutura Visual

```
┌─────────────────────────────────────────────┐
│ Filtros                       [X Limpar]    │
├─────────────────────────────────────────────┤
│ ┌─────────────┐  ┌─────────────────────┐   │
│ │ Nível       │  │ Buscar              │   │
│ │ [Select  ▼] │  │ [Input text...    ] │   │
│ └─────────────┘  └─────────────────────┘   │
│                                             │
│ ┌─────────────┐  ┌─────────────────────┐   │
│ │ Estágio     │  │ Tipo de Evento      │   │
│ │ [Input...  ]│  │ [Input...         ] │   │
│ └─────────────┘  └─────────────────────┘   │
│                                             │
│ ┌─────────────┐  ┌─────────────────────┐   │
│ │ Data Inicial│  │ Data Final          │   │
│ │ [datetime  ]│  │ [datetime         ] │   │
│ └─────────────┘  └─────────────────────┘   │
│                                             │
│ Filtros ativos: [Nível: error] [Busca: x]  │
└─────────────────────────────────────────────┘
```

## Acessibilidade

### Keyboard Navigation

- **Tab/Shift+Tab**: Navegar entre campos
- **Enter**: Abrir/fechar select dropdown
- **Arrow Up/Down**: Navegar opções do select
- **Escape**: Fechar dropdown

### Screen Readers

Todos os campos possuem:
- `<Label>` associado via `htmlFor`
- `aria-label` descritivo
- Estados de erro comunicados via `aria-invalid`

### Focus Management

- Indicador visual de foco via `focus-visible:ring`
- Ordem de tab lógica (left-to-right, top-to-bottom)

## Customização

### Alterar Layout

```typescript
// 3 colunas em desktop
<div className="grid gap-4 md:grid-cols-3">
  {/* ... */}
</div>

// 1 coluna sempre
<div className="space-y-4">
  {/* ... */}
</div>
```

### Adicionar Novo Filtro

1. Adicionar campo ao tipo `LogFilterOptions` em `types.ts`:
```typescript
export interface LogFilterOptions {
  // ... campos existentes
  newFilter?: string
}
```

2. Adicionar campo no componente:
```typescript
<div className="space-y-2">
  <Label htmlFor="filter-new">Novo Filtro</Label>
  <Input
    id="filter-new"
    value={filters.newFilter || ""}
    onChange={(e) => onFiltersChange({
      ...filters,
      newFilter: e.target.value || undefined
    })}
  />
</div>
```

3. Adicionar ao indicador de filtros ativos:
```typescript
{filters.newFilter && (
  <span className="...">
    Novo: {filters.newFilter}
  </span>
)}
```

## Testing

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { LogFilters } from './log-filters'

describe('LogFilters', () => {
  it('renders all filter fields', () => {
    const handleChange = vi.fn()
    render(<LogFilters filters={{}} onFiltersChange={handleChange} />)

    expect(screen.getByLabelText('Nível')).toBeInTheDocument()
    expect(screen.getByLabelText('Buscar texto nos logs')).toBeInTheDocument()
  })

  it('calls onFiltersChange when level changes', () => {
    const handleChange = vi.fn()
    render(<LogFilters filters={{}} onFiltersChange={handleChange} />)

    const levelSelect = screen.getByLabelText('Filtrar por nível de log')
    fireEvent.change(levelSelect, { target: { value: 'error' } })

    expect(handleChange).toHaveBeenCalledWith({ level: 'error' })
  })

  it('shows clear button when filters are active', () => {
    const handleChange = vi.fn()
    render(
      <LogFilters
        filters={{ level: 'error' }}
        onFiltersChange={handleChange}
      />
    )

    const clearButton = screen.getByLabelText('Limpar todos os filtros')
    expect(clearButton).toBeInTheDocument()

    fireEvent.click(clearButton)
    expect(handleChange).toHaveBeenCalledWith({})
  })
})
```

## Performance

- **Componente leve**: ~200 linhas, sem dependências pesadas
- **Re-renders otimizados**: Usa callbacks diretos, sem intermediários
- **Debounce recomendado**: Para inputs de texto (search, stage, type)
- **Controlled component**: Estado fica no pai, componente é puro

## Próximos Passos

Para integrar com a UI de logs:

1. ✅ Criar componente `LogFilters` (feito)
2. → Criar componente `LogList` (MP-LOGS-06)
3. → Criar componente `LogItem` (MP-LOGS-07)
4. → Integrar tudo no `LogsDrawer` (MP-LOGS-08)
