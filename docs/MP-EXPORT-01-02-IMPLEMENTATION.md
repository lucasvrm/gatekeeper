# MP-EXPORT-01 & MP-EXPORT-02 - Implementação Completa

**Data**: 2026-02-06
**Status**: ✅ CONCLUÍDO
**Feature**: Export de Logs (Feature 3)

---

## 📦 Resumo da Implementação

Implementação completa dos microplans MP-EXPORT-01 (Backend Export Endpoint) e MP-EXPORT-02 (Frontend Export UI) para permitir exportação de logs em formato JSON ou CSV.

---

## MP-EXPORT-01: Backend Export Endpoint

### Arquivos Modificados

#### 1. `packages/gatekeeper-api/src/services/OrchestratorEventService.ts`

**Métodos adicionados**:

##### `formatEventsAsJSON(events): string`
Formata eventos como JSON pretty-printed (2 espaços de indentação).

```typescript
formatEventsAsJSON(
  events: Array<OrchestratorEventData & { id?: number; timestamp?: number; seq?: number }>
): string {
  return JSON.stringify(events, null, 2)
}
```

**Output**: String JSON formatada, pronta para download.

##### `formatEventsAsCSV(events): string`
Formata eventos como CSV com escape correto de caracteres especiais.

**Colunas**: `timestamp,level,stage,type,message,metadata`

**Features**:
- ✅ Header row com nomes das colunas
- ✅ Escape de vírgulas, aspas duplas e quebras de linha
- ✅ Metadata serializada como JSON string
- ✅ Timestamp em formato ISO 8601
- ✅ Inferência automática de level/stage quando não disponível

```typescript
formatEventsAsCSV(
  events: Array<OrchestratorEventData & { id?: number; timestamp?: number; seq?: number }>
): string {
  const header = 'timestamp,level,stage,type,message,metadata'
  const rows = events.map((event) => {
    // ... escape logic
  })
  return [header, ...rows].join('\n')
}
```

**Escape rules**:
- Valores com `,`, `"`, ou `\n` são wrapped em aspas duplas
- Aspas duplas são escapadas como `""`

---

#### 2. `packages/gatekeeper-api/src/api/controllers/OrchestratorController.ts`

**Método adicionado**:

##### `async exportLogs(req, res): Promise<void>`
Handler HTTP para exportar logs em JSON ou CSV.

**Endpoint**: `GET /api/orchestrator/:outputId/logs/export`

**Query params**:
- `format`: `"json"` | `"csv"` (default: `"json"`)
- Todos os filtros do `LogFilterSchema`: `level`, `stage`, `type`, `search`, `startDate`, `endDate`

**Headers de resposta**:
```typescript
Content-Type: application/json | text/csv
Content-Disposition: attachment; filename="logs-{outputId}.{ext}"
```

**Fluxo**:
1. Parse query params (validação via Zod)
2. Buscar eventos filtrados via `OrchestratorEventService.getEventsFiltered()`
3. Formatar com `formatEventsAsJSON()` ou `formatEventsAsCSV()`
4. Retornar arquivo para download com headers corretos

**Error handling**:
- Status 500 com JSON error response
- Log de erro com contexto (outputId, format, filters)

---

#### 3. `packages/gatekeeper-api/src/api/routes/orchestrator.routes.ts`

**Rota adicionada**:

```typescript
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

**Posição**: Logo após a rota `/:outputId/logs` (filtros)

**Importante**: A rota `/export` deve vir **antes** da rota SSE `/events/:outputId` para evitar conflito de paths.

---

#### 4. `packages/gatekeeper-api/src/api/schemas/orchestrator.schema.ts`

**Schema atualizado**:

```typescript
export const LogFilterSchema = z.object({
  level: z.enum(['error', 'warn', 'info', 'debug']).optional(),
  stage: z.string().max(MAX_TYPE_LENGTH).optional(),
  type: z.string().max(MAX_TYPE_LENGTH).optional(),
  search: z.string().max(MAX_TEXT_LENGTH).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  format: z.enum(['json', 'csv']).optional().default('json'), // ✅ NOVO
})
```

**Campo adicionado**: `format` com valores `"json"` | `"csv"` e default `"json"`.

---

### Contratos Cumpridos (MP-EXPORT-01)

- ✅ Endpoint retorna arquivo JSON/CSV para download
- ✅ Nome do arquivo inclui pipelineId: `logs-{outputId}.{ext}`
- ✅ Filtros reutilizados (DRY) - mesma lógica de `getFilteredLogs`
- ✅ Content-Type correto (`application/json` ou `text/csv`)
- ✅ Content-Disposition com `attachment` e filename

**Esforço**: 🟢 Baixo (~1h) ✅ **CONCLUÍDO**

---

## MP-EXPORT-02: Frontend Export UI

### Arquivos Modificados

#### 1. `src/lib/api.ts`

**Método adicionado**:

```typescript
exportLogs: async (
  outputId: string,
  filters: LogFilterOptions = {},
  format: "json" | "csv" = "json"
): Promise<Blob> => {
  const params = new URLSearchParams()
  params.append("format", format)

  // Add filter params
  if (filters.level) params.append("level", filters.level)
  if (filters.stage) params.append("stage", filters.stage)
  // ... outros filtros

  const url = `${API_BASE}/orchestrator/${outputId}/logs/export?${params.toString()}`
  const response = await fetchWithAuth(url)

  if (!response.ok) {
    throw new Error("Failed to export logs")
  }

  return response.blob()
}
```

**Features**:
- ✅ Serializa filtros como query params
- ✅ Serializa dates como ISO strings
- ✅ Retorna `Blob` para download client-side
- ✅ Error handling consistente com API client

---

#### 2. `src/components/orchestrator/logs-drawer.tsx`

**Mudanças**:

##### Imports adicionados:
```typescript
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Download, FileJson, FileSpreadsheet } from "lucide-react"
import { api } from "@/lib/api"
import { toast } from "sonner"
```

##### State adicionado:
```typescript
const [exporting, setExporting] = useState(false)
const [currentFilters, setCurrentFilters] = useState<LogFilterOptions>({})
```

##### Handler de export:
```typescript
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
    anchor.style.display = "none"
    document.body.appendChild(anchor)
    anchor.click()

    // Cleanup
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)

    toast.success(`Logs exportados com sucesso`, {
      description: `Arquivo: ${filename}`,
    })
  } catch (error) {
    toast.error("Erro ao exportar logs", {
      description: error instanceof Error ? error.message : "Erro desconhecido",
    })
  } finally {
    setExporting(false)
  }
}
```

**Features**:
- ✅ Download client-side com `URL.createObjectURL()`
- ✅ Filename com timestamp: `logs-{pipelineId}-{YYYY-MM-DDTHH-mm-ss}.{ext}`
- ✅ Cleanup de blob URL após download
- ✅ Toast de sucesso com nome do arquivo
- ✅ Toast de erro com mensagem detalhada
- ✅ Loading state durante fetch (`exporting`)

##### UI adicionada (Header):
```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline" size="sm" disabled={exporting} className="gap-2">
      <Download className="size-3.5" />
      {exporting ? "Exportando..." : "Exportar"}
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={() => handleExport("json")} className="gap-2">
      <FileJson className="size-4" />
      Exportar como JSON
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => handleExport("csv")} className="gap-2">
      <FileSpreadsheet className="size-4" />
      Exportar como CSV
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**Visual**:
- Botão "Exportar" no header do drawer
- DropdownMenu com 2 opções: JSON e CSV
- Ícones do `lucide-react`: `FileJson`, `FileSpreadsheet`
- Disabled durante export (loading state)

---

#### 3. `src/components/orchestrator/log-viewer.tsx`

**Mudanças**:

##### Props atualizada:
```typescript
interface LogViewerProps {
  pipelineId: string
  onFiltersChange?: (filters: LogFilterOptions) => void // ✅ NOVO
}
```

##### Callback de filtros:
```typescript
const handleFiltersChange = (newFilters: LogFilterOptions) => {
  setFilters(newFilters)
  setPage(1)
  setHasMore(true)
  setAllEvents([])
  onFiltersChange?.(newFilters) // ✅ Notifica pai
}
```

**Integração**:
```tsx
// LogsDrawer.tsx
<LogViewer pipelineId={pipelineId} onFiltersChange={setCurrentFilters} />
```

**Fluxo**:
1. LogViewer notifica LogsDrawer quando filtros mudam
2. LogsDrawer mantém filtros em state (`currentFilters`)
3. Export usa `currentFilters` para filtrar logs exportados

---

### Contratos Cumpridos (MP-EXPORT-02)

- ✅ Botão com icon de download (`Download` do lucide-react)
- ✅ DropdownMenu com opções JSON e CSV
- ✅ Loading state durante fetch ("Exportando...")
- ✅ Toast de sucesso com nome do arquivo
- ✅ Toast de erro com mensagem detalhada
- ✅ Filename: `logs-{pipelineId}-{timestamp}.{ext}`
- ✅ Download client-side funcional
- ✅ Cleanup de blob URL

**Esforço**: 🟡 Médio (~1.5h) ✅ **CONCLUÍDO**

---

## 🧪 Testando

### Backend (Manual)

```bash
# Terminal 1: Start backend
cd packages/gatekeeper-api
npm run dev

# Terminal 2: Test export
curl "http://localhost:3001/api/orchestrator/{outputId}/logs/export?format=json" -o logs.json
curl "http://localhost:3001/api/orchestrator/{outputId}/logs/export?format=csv" -o logs.csv

# Com filtros
curl "http://localhost:3001/api/orchestrator/{outputId}/logs/export?format=csv&level=error&search=timeout" -o logs-filtered.csv
```

### Frontend (Manual)

1. Iniciar pipeline no orquestrador
2. Abrir drawer de logs (botão "Logs" no header)
3. Aplicar alguns filtros (ex: level=error, search="planning")
4. Clicar no botão "Exportar"
5. Selecionar "Exportar como JSON" ou "Exportar como CSV"
6. Verificar download automático
7. Verificar toast de sucesso com nome do arquivo
8. Abrir arquivo baixado e validar conteúdo

---

## 📊 Formato dos Arquivos

### JSON
```json
[
  {
    "type": "agent:planning_start",
    "level": "info",
    "stage": "planning",
    "timestamp": 1704067200000,
    "message": "Starting planning phase",
    "id": 1,
    "seq": 1
  },
  {
    "type": "agent:error",
    "level": "error",
    "stage": "planning",
    "timestamp": 1704067201000,
    "message": "Planning timeout exceeded",
    "id": 2,
    "seq": 2,
    "metadata": {
      "timeout": 30000
    }
  }
]
```

### CSV
```csv
timestamp,level,stage,type,message,metadata
2026-01-01T00:00:00.000Z,info,planning,agent:planning_start,Starting planning phase,
2026-01-01T00:00:01.000Z,error,planning,agent:error,Planning timeout exceeded,"{""timeout"":30000}"
```

**Escape examples**:
- Aspas duplas: `"Hello ""world"""` → `Hello "world"`
- Vírgulas: `"error,warn"` (wrapped em aspas)
- Quebras de linha: `"line1\nline2"` (wrapped em aspas)

---

## 🚀 Próximos Passos

Com MP-EXPORT-01 e MP-EXPORT-02 concluídos, você pode agora implementar:

1. **MP-EXPORT-03**: CSV Format & Tests
   - Testes unitários de `formatEventsAsCSV`
   - Testes E2E do endpoint export
   - Validação de CSV com `papa-parse`

2. Ou continuar com os próximos MPs de outras features

---

## 📝 Notas Técnicas

### Blob Download Pattern
```typescript
// 1. Create blob URL
const url = URL.createObjectURL(blob)

// 2. Create anchor element
const anchor = document.createElement("a")
anchor.href = url
anchor.download = filename
anchor.style.display = "none"

// 3. Trigger download
document.body.appendChild(anchor)
anchor.click()

// 4. Cleanup
document.body.removeChild(anchor)
URL.revokeObjectURL(url)
```

### Timestamp Format
```typescript
new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
// "2026-02-06T15-30-45"
```

### CSV Escape Function
```typescript
const escape = (value: string): string => {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
```

---

## 🐛 Known Issues

Nenhum issue conhecido no momento. ✅

---

## 📚 Referências

- **Microplans originais**: `artifacts/devin/ui-refactor-microplans.md`
- **Backend Types**: `packages/gatekeeper-api/src/types/index.ts`
- **Frontend Types**: `src/lib/types.ts`
- **CSV RFC 4180**: https://www.rfc-editor.org/rfc/rfc4180

---

**Fim do documento**
✅ MP-EXPORT-01 e MP-EXPORT-02 implementados com sucesso!
