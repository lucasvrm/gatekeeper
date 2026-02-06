import { useState } from "react"
import { api } from "@/lib/api"
import type { Provider } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, X, Check, GripVertical } from "lucide-react"

interface ProviderManagerProps {
  providers: Provider[]
  onChanged: () => void
}

export function ProviderManager({ providers, onChanged }: ProviderManagerProps) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<Provider>>({})

  const startAdd = () => {
    setAdding(true)
    setEditingId(null)
    setForm({ name: '', label: '', authType: 'api_key', envVarName: '', isActive: true, order: (providers.length + 1) * 10 })
  }

  const startEdit = (p: Provider) => {
    setEditingId(p.id)
    setAdding(false)
    setForm({ name: p.name, label: p.label, authType: p.authType, envVarName: p.envVarName, isActive: p.isActive, order: p.order, note: p.note })
  }

  const cancel = () => {
    setAdding(false)
    setEditingId(null)
    setForm({})
  }

  const handleSave = async () => {
    if (!form.name?.trim() || !form.label?.trim()) {
      toast.error("Name e Label são obrigatórios")
      return
    }
    setSaving(true)
    try {
      if (adding) {
        await api.mcp.providers.create({
          name: form.name!.trim(),
          label: form.label!.trim(),
          authType: form.authType || 'api_key',
          envVarName: form.envVarName?.trim() || null,
          isActive: form.isActive ?? true,
          order: form.order ?? 0,
          note: form.note?.trim() || null,
        })
        toast.success("Provider criado")
      } else if (editingId) {
        await api.mcp.providers.update(editingId, {
          name: form.name!.trim(),
          label: form.label!.trim(),
          authType: form.authType || 'api_key',
          envVarName: form.envVarName?.trim() || null,
          isActive: form.isActive ?? true,
          order: form.order ?? 0,
          note: form.note?.trim() || null,
        })
        toast.success("Provider atualizado")
      }
      cancel()
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar provider")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (p: Provider) => {
    setDeleting(p.id)
    try {
      await api.mcp.providers.delete(p.id)
      toast.success(`Provider "${p.label}" removido`)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao remover provider")
    } finally {
      setDeleting(null)
    }
  }

  const handleToggle = async (p: Provider) => {
    try {
      await api.mcp.providers.update(p.id, { isActive: !p.isActive })
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao alternar provider")
    }
  }

  const renderForm = () => (
    <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-muted-foreground block mb-0.5">Name (slug)</label>
          <Input
            value={form.name || ''}
            onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="my-provider"
            className="h-7 text-xs"
            autoFocus
          />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground block mb-0.5">Label</label>
          <Input
            value={form.label || ''}
            onChange={(e) => setForm(prev => ({ ...prev, label: e.target.value }))}
            placeholder="My Provider"
            className="h-7 text-xs"
          />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground block mb-0.5">Auth Type</label>
          <select
            value={form.authType || 'api_key'}
            onChange={(e) => setForm(prev => ({ ...prev, authType: e.target.value }))}
            className="w-full h-7 text-xs border rounded px-2 bg-background"
          >
            <option value="api_key">API Key</option>
            <option value="cli">CLI</option>
            <option value="none">None</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground block mb-0.5">Env Var</label>
          <Input
            value={form.envVarName || ''}
            onChange={(e) => setForm(prev => ({ ...prev, envVarName: e.target.value }))}
            placeholder="MY_API_KEY"
            className="h-7 text-xs font-mono"
          />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground block mb-0.5">Order</label>
          <Input
            type="number"
            value={form.order ?? 0}
            onChange={(e) => setForm(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
            className="h-7 text-xs"
            min={0}
          />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground block mb-0.5">Note</label>
          <Input
            value={form.note || ''}
            onChange={(e) => setForm(prev => ({ ...prev, note: e.target.value }))}
            placeholder="Optional note"
            className="h-7 text-xs"
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-1.5 pt-1">
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={cancel} disabled={saving}>
          <X className="h-3 w-3 mr-1" /> Cancelar
        </Button>
        <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={saving}>
          <Check className="h-3 w-3 mr-1" /> {saving ? '...' : 'Salvar'}
        </Button>
      </div>
    </div>
  )

  return (
    <div className="space-y-2">
      {providers.sort((a, b) => a.order - b.order).map(p => {
        if (editingId === p.id) return <div key={p.id}>{renderForm()}</div>

        return (
          <div key={p.id} className="border rounded-lg px-3 py-2 flex items-center gap-2 group">
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">{p.label}</span>
                <code className="text-[10px] text-muted-foreground font-mono">{p.name}</code>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{p.authType}</Badge>
              </div>
              {p.envVarName && (
                <span className="text-[10px] text-muted-foreground font-mono">{p.envVarName}</span>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => startEdit(p)}
                className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                title="Editar"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => handleDelete(p)}
                disabled={deleting === p.id}
                className="text-muted-foreground hover:text-destructive transition-colors p-0.5"
                title="Remover"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            <Switch
              checked={p.isActive}
              onCheckedChange={() => handleToggle(p)}
              className="shrink-0"
            />
          </div>
        )
      })}

      {adding && renderForm()}

      {!adding && !editingId && (
        <button
          onClick={startAdd}
          className="w-full border border-dashed rounded-lg py-2 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors flex items-center justify-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" /> Add Provider
        </button>
      )}
    </div>
  )
}
