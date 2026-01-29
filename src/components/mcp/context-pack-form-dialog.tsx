import { useState } from "react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import type { ContextPack } from "@/lib/types"

interface ContextPackFormDialogProps {
  pack: ContextPack | null
  onClose: () => void
  onSave: () => void
}

export function ContextPackFormDialog({ pack, onClose, onSave }: ContextPackFormDialogProps) {
  const [name, setName] = useState(pack?.name || "")
  const [description, setDescription] = useState(pack?.description || "")
  const [filesText, setFilesText] = useState(pack?.files.join("\n") || "")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const files = filesText.split("\n").map(f => f.trim()).filter(f => f.length > 0)

      if (pack) {
        await api.mcp.contextPacks.update(pack.id, { name, description, files })
        toast.success("Context pack atualizado com sucesso")
      } else {
        await api.mcp.contextPacks.create({ name, description, files })
        toast.success("Context pack criado com sucesso")
      }
      onSave()
      onClose()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro ao salvar context pack"
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      role="dialog"
      data-testid="context-pack-form-dialog"
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
      <div className="bg-background border rounded-lg p-6 w-full max-w-md space-y-4 shadow-lg">
        <h2 className="text-xl font-bold">{pack ? "Edit Context Pack" : "New Context Pack"}</h2>

        <div>
          <label className="block text-sm font-medium mb-2">Name</label>
          <input
            type="text"
            role="textbox"
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="context-pack-name-input"
            className="border rounded px-3 py-2 w-full bg-background"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Description</label>
          <textarea
            role="textbox"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            data-testid="context-pack-description-textarea"
            className="border rounded px-3 py-2 w-full bg-background"
            rows={3}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Files (one per line)</label>
          <textarea
            role="textbox"
            value={filesText}
            onChange={(e) => setFilesText(e.target.value)}
            data-testid="context-pack-files-textarea"
            className="border rounded px-3 py-2 w-full bg-background font-mono text-sm"
            rows={4}
            placeholder="src/components/Button.tsx&#10;src/lib/utils.ts"
          />
        </div>

        <div className="flex gap-2 justify-end pt-4">
          <button
            role="button"
            onClick={onClose}
            data-testid="cancel-button"
            className="px-4 py-2 border rounded hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            role="button"
            onClick={handleSave}
            disabled={saving}
            data-testid="save-button"
            className="bg-primary text-primary-foreground px-4 py-2 rounded disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  )
}
