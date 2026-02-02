import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ConfigModal, type ConfigModalField } from "@/components/config-modal"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

// Helper to detect pattern list configs
const isPatternListConfig = (key: string): boolean =>
  key.endsWith('_EXCLUSIONS') || key.endsWith('_PATTERNS')

// PatternListEditor component for editing comma-separated pattern lists
interface PatternListEditorProps {
  value: string
  onChange: (csv: string) => void
}

export function PatternListEditor({ value, onChange }: PatternListEditorProps) {
  const [inputValue, setInputValue] = useState("")

  const patterns = useMemo(() =>
    value.split(',').map(p => p.trim()).filter(Boolean),
    [value]
  )

  const handleAdd = () => {
    const trimmed = inputValue.trim()
    if (!trimmed) return
    if (patterns.includes(trimmed)) {
      setInputValue("")
      return
    }
    const newPatterns = [...patterns, trimmed]
    onChange(newPatterns.join(','))
    setInputValue("")
  }

  const handleRemove = (index: number) => {
    const newPatterns = patterns.filter((_, i) => i !== index)
    onChange(newPatterns.join(','))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <div data-testid="pattern-list-editor" className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {patterns.map((pattern, index) => (
          <Badge
            key={index}
            variant="secondary"
            data-testid={`pattern-badge-${index}`}
            className="text-xs font-mono flex items-center gap-1"
          >
            {pattern}
            <button
              type="button"
              data-testid={`pattern-remove-${index}`}
              onClick={() => handleRemove(index)}
              className="ml-1 hover:text-destructive"
            >
              ×
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          data-testid="pattern-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Adicionar pattern..."
          className="flex-1"
        />
        <Button
          type="button"
          data-testid="pattern-add-btn"
          variant="outline"
          size="sm"
          onClick={handleAdd}
        >
          Adicionar
        </Button>
      </div>
    </div>
  )
}

type ValidationConfigItem = {
  id: string
  key: string
  value: string
  type: string
  category: string
  description?: string | null
}

interface ValidationConfigsTabProps {
  items: ValidationConfigItem[]
  onCreate?: (values: Record<string, string | boolean>) => Promise<boolean>
  onUpdate: (id: string, values: Record<string, string | boolean>) => Promise<boolean>
  onDelete?: (id: string) => Promise<boolean>
}

const validationFields: ConfigModalField[] = [
  { name: "key", label: "Chave", type: "text", required: true },
  { name: "value", label: "Valor", type: "text", required: true },
  { name: "type", label: "Tipo", type: "text", required: true },
  { name: "category", label: "Categoria", type: "text", required: true },
  { name: "description", label: "Descrição", type: "textarea" },
]

const validationDefaults = {
  key: "",
  value: "",
  type: "",
  category: "",
  description: "",
}

export function ValidationConfigsTab({
  items,
  onCreate,
  onUpdate,
  onDelete,
}: ValidationConfigsTabProps) {
  const [keyFilter, setKeyFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState("ALL")
  const [categoryFilter, setCategoryFilter] = useState("ALL")
  const [createOpen, setCreateOpen] = useState(false)
  const [editItem, setEditItem] = useState<ValidationConfigItem | null>(null)
  const [patternEditItem, setPatternEditItem] = useState<ValidationConfigItem | null>(null)
  const [patternEditValue, setPatternEditValue] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)

  const uniqueTypes = useMemo(() => {
    return Array.from(new Set(items.map((item) => item.type))).sort()
  }, [items])

  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(items.map((item) => item.category))).sort()
  }, [items])

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (keyFilter && !item.key.toLowerCase().includes(keyFilter.toLowerCase())) {
        return false
      }
      if (typeFilter !== "ALL" && item.type !== typeFilter) {
        return false
      }
      if (categoryFilter !== "ALL" && item.category !== categoryFilter) {
        return false
      }
      return true
    })
  }, [items, keyFilter, typeFilter, categoryFilter])

  const handleCreate = async (values: Record<string, string | boolean>) => {
    if (!onCreate) return false
    setSubmitting(true)
    const ok = await onCreate(values)
    setSubmitting(false)
    return ok
  }

  const handleEdit = async (values: Record<string, string | boolean>) => {
    if (!editItem) return false
    setSubmitting(true)
    const ok = await onUpdate(editItem.id, values)
    setSubmitting(false)
    if (ok) setEditItem(null)
    return ok
  }

  const handleDelete = async (id: string) => {
    if (!onDelete) return false
    setActionId(id)
    const ok = await onDelete(id)
    setActionId(null)
    return ok
  }

  return (
    <Card className="p-6 bg-card border-border space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Validation Configs</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Valores de config utilizados nas verificações de validation.
          </p>
        </div>
        {onCreate && (
          <Button onClick={() => setCreateOpen(true)}>Adicionar</Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          data-testid="key-filter"
          placeholder="Filtrar por chave..."
          className="h-9 w-64 rounded-md border border-input bg-background px-3 text-sm"
          value={keyFilter}
          onChange={(event) => setKeyFilter(event.target.value)}
        />
        <select
          data-testid="type-filter"
          className="h-9 w-44 rounded-md border border-input bg-background px-3 text-sm"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
        >
          <option value="ALL">Todos tipos</option>
          {uniqueTypes.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        <select
          data-testid="category-filter"
          className="h-9 w-52 rounded-md border border-input bg-background px-3 text-sm"
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
        >
          <option value="ALL">Todas categorias</option>
          {uniqueCategories.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
      </div>

      {filteredItems.length === 0 ? (
        <div className="text-sm text-muted-foreground">Nenhum registro encontrado.</div>
      ) : (
        <Table data-testid="validation-configs-table">
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs uppercase tracking-wide">Chave</TableHead>
              <TableHead className="text-xs uppercase tracking-wide">Valor</TableHead>
              <TableHead className="text-xs uppercase tracking-wide">Tipo</TableHead>
              <TableHead className="text-xs uppercase tracking-wide">Categoria</TableHead>
              <TableHead className="text-xs uppercase tracking-wide">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.map((item) => (
              <TableRow key={item.id} data-testid={`config-row-${item.id}`}>
                <TableCell data-testid={`config-key-${item.id}`}>{item.key}</TableCell>
                <TableCell>
                  {isPatternListConfig(item.key) && !patternEditItem ? (
                    <div className="flex flex-wrap gap-1">
                      {item.value.split(',').map((p, i) => (
                        <Badge key={i} variant="outline" className="text-xs font-mono">{p.trim()}</Badge>
                      ))}
                    </div>
                  ) : isPatternListConfig(item.key) ? (
                    <span className="text-muted-foreground text-xs">Editando...</span>
                  ) : (
                    item.value
                  )}
                </TableCell>
                <TableCell data-testid={`config-type-${item.id}`}>{item.type}</TableCell>
                <TableCell data-testid={`config-category-${item.id}`}>{item.category}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (isPatternListConfig(item.key)) {
                          setPatternEditItem(item)
                          setPatternEditValue(item.value)
                        } else {
                          setEditItem(item)
                        }
                      }}
                    >
                      Editar
                    </Button>
                    {onDelete && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(item.id)}
                        disabled={actionId === item.id}
                      >
                        Excluir
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {onCreate && (
        <ConfigModal
          open={createOpen}
          title="Adicionar Validation Config"
          description="Criar um novo registro de validation config."
          fields={validationFields}
          initialValues={validationDefaults}
          submitLabel="Criar"
          onClose={() => setCreateOpen(false)}
          onSubmit={handleCreate}
          submitting={submitting}
        />
      )}

      {editItem && !isPatternListConfig(editItem.key) && (
        <ConfigModal
          open={Boolean(editItem)}
          title="Editar Validation Config"
          description="Atualizar o registro de validation config selecionado."
          fields={validationFields}
          initialValues={{
            key: editItem.key,
            value: editItem.value,
            type: editItem.type,
            category: editItem.category,
            description: editItem.description ?? "",
          }}
          submitLabel="Salvar"
          onClose={() => setEditItem(null)}
          onSubmit={handleEdit}
          submitting={submitting}
        />
      )}

      {patternEditItem && (
        <Dialog open={Boolean(patternEditItem)} onOpenChange={(open) => !open && setPatternEditItem(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Editar Validation Config</DialogTitle>
              <DialogDescription>
                Editar patterns de exclusão para {patternEditItem.key}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Chave</Label>
                <Input value={patternEditItem.key} disabled />
              </div>
              <div className="space-y-2">
                <Label>Valor</Label>
                <PatternListEditor
                  value={patternEditValue}
                  onChange={setPatternEditValue}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Input value={patternEditItem.type} disabled />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Input value={patternEditItem.category} disabled />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPatternEditItem(null)}>
                Cancelar
              </Button>
              <Button
                disabled={submitting}
                onClick={async () => {
                  setSubmitting(true)
                  const ok = await onUpdate(patternEditItem.id, {
                    key: patternEditItem.key,
                    value: patternEditValue,
                    type: patternEditItem.type,
                    category: patternEditItem.category,
                    description: patternEditItem.description ?? "",
                  })
                  setSubmitting(false)
                  if (ok) setPatternEditItem(null)
                }}
              >
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  )
}
