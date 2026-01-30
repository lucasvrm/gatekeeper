import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ConfigModal, type ConfigModalField } from "@/components/config-modal"

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
  { name: "key", label: "Key", type: "text", required: true },
  { name: "value", label: "Value", type: "text", required: true },
  { name: "type", label: "Type", type: "text", required: true },
  { name: "category", label: "Category", type: "text", required: true },
  { name: "description", label: "Description", type: "textarea" },
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
            Config values used by validation checks.
          </p>
        </div>
        {onCreate && (
          <Button onClick={() => setCreateOpen(true)}>Add</Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          data-testid="key-filter"
          placeholder="Filtrar por key..."
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
          <option value="ALL">Todos types</option>
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
        <div className="text-sm text-muted-foreground">No records found.</div>
      ) : (
        <Table data-testid="validation-configs-table">
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs uppercase tracking-wide">Key</TableHead>
              <TableHead className="text-xs uppercase tracking-wide">Value</TableHead>
              <TableHead className="text-xs uppercase tracking-wide">Type</TableHead>
              <TableHead className="text-xs uppercase tracking-wide">Category</TableHead>
              <TableHead className="text-xs uppercase tracking-wide">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.map((item) => (
              <TableRow key={item.id} data-testid={`config-row-${item.id}`}>
                <TableCell data-testid={`config-key-${item.id}`}>{item.key}</TableCell>
                <TableCell>{item.value}</TableCell>
                <TableCell data-testid={`config-type-${item.id}`}>{item.type}</TableCell>
                <TableCell data-testid={`config-category-${item.id}`}>{item.category}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditItem(item)}>
                      Edit
                    </Button>
                    {onDelete && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(item.id)}
                        disabled={actionId === item.id}
                      >
                        Delete
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
          title="Add Validation Config"
          description="Create a new validation config record."
          fields={validationFields}
          initialValues={validationDefaults}
          submitLabel="Create"
          onClose={() => setCreateOpen(false)}
          onSubmit={handleCreate}
          submitting={submitting}
        />
      )}

      {editItem && (
        <ConfigModal
          open={Boolean(editItem)}
          title="Edit Validation Config"
          description="Update the selected validation config record."
          fields={validationFields}
          initialValues={{
            key: editItem.key,
            value: editItem.value,
            type: editItem.type,
            category: editItem.category,
            description: editItem.description ?? "",
          }}
          submitLabel="Save"
          onClose={() => setEditItem(null)}
          onSubmit={handleEdit}
          submitting={submitting}
        />
      )}
    </Card>
  )
}
