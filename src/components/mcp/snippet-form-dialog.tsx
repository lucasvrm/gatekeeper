import { useState } from "react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import type { Snippet } from "@/lib/types"

interface SnippetFormDialogProps {
  snippet: Snippet | null
  onClose: () => void
  onSave: () => void
}

export function SnippetFormDialog({ snippet, onClose, onSave }: SnippetFormDialogProps) {
  const [name, setName] = useState(snippet?.name || "")
  const [category, setCategory] = useState(snippet?.category || "HELPER")
  const [content, setContent] = useState(snippet?.content || "")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      if (snippet) {
        await api.mcp.snippets.update(snippet.id, { name, category, content })
        toast.success("Snippet atualizado com sucesso")
      } else {
        await api.mcp.snippets.create({ name, category, content })
        toast.success("Snippet criado com sucesso")
      }
      onSave()
      onClose()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro ao salvar snippet"
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      role="dialog"
      data-testid="snippet-form-dialog"
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
      <div className="bg-background border rounded-lg p-6 w-full max-w-md space-y-4 shadow-lg">
        <h2 className="text-xl font-bold">{snippet ? "Edit Snippet" : "New Snippet"}</h2>

        <div>
          <label className="block text-sm font-medium mb-2">Name</label>
          <input
            type="text"
            role="textbox"
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="snippet-name-input"
            className="border rounded px-3 py-2 w-full bg-background"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            data-testid="snippet-category-select"
            className="border rounded px-3 py-2 w-full bg-background"
          >
            <option value="HELPER">Helper</option>
            <option value="TEMPLATE">Template</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Content</label>
          <textarea
            role="textbox"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            data-testid="snippet-content-textarea"
            className="border rounded px-3 py-2 w-full bg-background font-mono text-sm"
            rows={6}
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
