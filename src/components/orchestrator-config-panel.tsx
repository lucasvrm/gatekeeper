import { useState, useEffect, useCallback } from "react"
import { api } from "@/lib/api"
import type { OrchestratorContent, OrchestratorContentKind } from "@/lib/types"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = [
  { value: 0, label: "0 — Tarefa" },
  { value: 1, label: "1 — Plano" },
  { value: 2, label: "2 — Testes" },
  { value: 3, label: "3 — Fix" },
  { value: 4, label: "4 — Execução" },
] as const

const KINDS: { value: OrchestratorContentKind; label: string; description: string }[] = [
  {
    value: "instruction",
    label: "Instruções",
    description: "O que o LLM deve fazer e produzir nesta etapa",
  },
  {
    value: "doc",
    label: "Docs",
    description: "Material de referência sobre o projeto (arquitetura, convenções, validators)",
  },
  {
    value: "prompt",
    label: "Prompts",
    description: "Diretrizes comportamentais (tom, idioma, formato)",
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Item row
// ─────────────────────────────────────────────────────────────────────────────

function ContentItemRow({
  item,
  onEdit,
  onToggle,
  onDelete,
}: {
  item: OrchestratorContent
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  const preview = item.content.length > 120 ? item.content.slice(0, 120) + "…" : item.content

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
        item.isActive ? "border-border bg-card" : "border-border/50 bg-muted/30 opacity-60"
      }`}
    >
      <div className="flex flex-col items-center gap-1 pt-0.5">
        <span className="text-[10px] text-muted-foreground font-mono">#{item.order}</span>
        <Switch checked={item.isActive} onCheckedChange={onToggle} className="scale-75" />
      </div>

      <div className="flex-1 min-w-0 cursor-pointer" onClick={onEdit}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium truncate">{item.name}</span>
          <Badge variant="outline" className="text-[10px] shrink-0">
            step {item.step}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 font-mono">{preview}</p>
      </div>

      <Button variant="ghost" size="sm" onClick={onDelete} className="shrink-0 text-destructive hover:text-destructive">
        ✕
      </Button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit dialog
// ─────────────────────────────────────────────────────────────────────────────

interface EditDialogProps {
  open: boolean
  onClose: () => void
  onSave: (data: { step: number; name: string; content: string; order: number }) => void
  initial?: OrchestratorContent | null
  kind: OrchestratorContentKind
}

function EditDialog({ open, onClose, onSave, initial, kind }: EditDialogProps) {
  const [name, setName] = useState("")
  const [content, setContent] = useState("")
  const [step, setStep] = useState(1)
  const [order, setOrder] = useState(0)

  useEffect(() => {
    if (initial) {
      setName(initial.name)
      setContent(initial.content)
      setStep(initial.step)
      setOrder(initial.order)
    } else {
      setName("")
      setContent("")
      setStep(1)
      setOrder(0)
    }
  }, [initial, open])

  const handleSave = () => {
    if (!name.trim() || content.trim() === "") {
      toast.error("Nome e conteúdo são obrigatórios")
      return
    }
    onSave({ step, name: name.trim(), content, order })
  }

  const kindLabel = KINDS.find((k) => k.value === kind)?.label || kind

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
<DialogHeader>
  <DialogTitle>{initial ? `Editar ${kindLabel}` : `Nova ${kindLabel}`}</DialogTitle>
  <DialogDescription>Conteúdo injetado no prompt do LLM na etapa selecionada.</DialogDescription>
</DialogHeader>

        <div className="space-y-4 flex-1 overflow-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Etapa</Label>
              <Select value={String(step)} onValueChange={(v) => setStep(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STEPS.map((s) => (
                    <SelectItem key={s.value} value={String(s.value)}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ordem</Label>
              <input
                type="number"
                value={order}
                onChange={(e) => setOrder(Number(e.target.value))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Nome</Label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Formato do plan.json"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Conteúdo</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={14}
              className="font-mono text-xs"
              placeholder="Conteúdo que será injetado no prompt do LLM..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>{initial ? "Salvar" : "Criar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main panel
// ─────────────────────────────────────────────────────────────────────────────

export function OrchestratorConfigPanel() {
  const [activeKind, setActiveKind] = useState<OrchestratorContentKind>("instruction")
  const [stepFilter, setStepFilter] = useState<number | "all">("all")
  const [items, setItems] = useState<OrchestratorContent[]>([])
  const [loading, setLoading] = useState(false)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<OrchestratorContent | null>(null)

  // ── Load items ─────────────────────────────────────────────────────────
  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const step = stepFilter === "all" ? undefined : stepFilter
      const data = await api.orchestratorContent.list(activeKind, step)
      setItems(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar")
    } finally {
      setLoading(false)
    }
  }, [activeKind, stepFilter])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  // ── CRUD handlers ──────────────────────────────────────────────────────
  const handleCreate = () => {
    setEditingItem(null)
    setDialogOpen(true)
  }

  const handleEdit = (item: OrchestratorContent) => {
    setEditingItem(item)
    setDialogOpen(true)
  }

  const handleSave = async (data: { step: number; name: string; content: string; order: number }) => {
    try {
      if (editingItem) {
        await api.orchestratorContent.update(activeKind, editingItem.id, data)
        toast.success("Atualizado")
      } else {
        await api.orchestratorContent.create(activeKind, data)
        toast.success("Criado")
      }
      setDialogOpen(false)
      loadItems()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar")
    }
  }

  const handleToggle = async (item: OrchestratorContent) => {
    try {
      await api.orchestratorContent.update(activeKind, item.id, { isActive: !item.isActive })
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, isActive: !i.isActive } : i))
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao alternar")
    }
  }

  const handleDelete = async (item: OrchestratorContent) => {
    if (!confirm(`Deletar "${item.name}"?`)) return
    try {
      await api.orchestratorContent.delete(activeKind, item.id)
      toast.success("Deletado")
      loadItems()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao deletar")
    }
  }

  // ── Group by step ──────────────────────────────────────────────────────
  const grouped = items.reduce<Record<number, OrchestratorContent[]>>((acc, item) => {
    ;(acc[item.step] ??= []).push(item)
    return acc
  }, {})

  const kindInfo = KINDS.find((k) => k.value === activeKind)!

  return (
    <div className="space-y-4">
      {/* Kind tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        {KINDS.map((k) => (
          <button
            key={k.value}
            onClick={() => setActiveKind(k.value)}
            className={`px-3 py-1.5 rounded text-sm transition-colors ${
              activeKind === k.value
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{kindInfo.label}</CardTitle>
              <CardDescription>{kindInfo.description}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={String(stepFilter)}
                onValueChange={(v) => setStepFilter(v === "all" ? "all" : Number(v))}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filtrar step" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas etapas</SelectItem>
                  {STEPS.map((s) => (
                    <SelectItem key={s.value} value={String(s.value)}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={handleCreate}>
                + Novo
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
          ) : items.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <p className="text-sm text-muted-foreground">
                Nenhum(a) {kindInfo.label.toLowerCase()} cadastrado(a).
              </p>
              <Button variant="outline" size="sm" onClick={handleCreate}>
                Criar primeiro
              </Button>
            </div>
          ) : stepFilter === "all" ? (
            // Grouped by step
            <div className="space-y-6">
              {STEPS.filter((s) => grouped[s.value]?.length).map((s) => (
                <div key={s.value}>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    {s.label} ({grouped[s.value].length})
                  </h4>
                  <div className="space-y-2">
                    {grouped[s.value].map((item) => (
                      <ContentItemRow
                        key={item.id}
                        item={item}
                        onEdit={() => handleEdit(item)}
                        onToggle={() => handleToggle(item)}
                        onDelete={() => handleDelete(item)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Flat list for single step
            <div className="space-y-2">
              {items.map((item) => (
                <ContentItemRow
                  key={item.id}
                  item={item}
                  onEdit={() => handleEdit(item)}
                  onToggle={() => handleToggle(item)}
                  onDelete={() => handleDelete(item)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <EditDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        initial={editingItem}
        kind={activeKind}
      />
    </div>
  )
}
