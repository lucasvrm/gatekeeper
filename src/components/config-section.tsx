import { useState, type ReactNode } from "react"
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

export interface ConfigSectionColumn<T> {
  key: string
  label: string
  render?: (item: T) => ReactNode
}

interface ConfigSectionProps<T extends { id: string }> {
  title: string
  description?: string
  items: T[]
  columns: Array<ConfigSectionColumn<T>>
  createFields?: ConfigModalField[]
  editFields: ConfigModalField[]
  createDefaults?: Record<string, string | boolean>
  getEditValues: (item: T) => Record<string, string | boolean>
  onCreate?: (values: Record<string, string | boolean>) => Promise<boolean>
  onUpdate: (id: string, values: Record<string, string | boolean>) => Promise<boolean>
  onDelete?: (id: string) => Promise<boolean>
  onToggle?: (id: string, isActive: boolean) => Promise<boolean>
  hideCreate?: boolean
}

export function ConfigSection<T extends { id: string; isActive?: boolean }>({
  title,
  description,
  items,
  columns,
  createFields,
  editFields,
  createDefaults,
  getEditValues,
  onCreate,
  onUpdate,
  onDelete,
  onToggle,
  hideCreate,
}: ConfigSectionProps<T>) {
  const [createOpen, setCreateOpen] = useState(false)
  const [editItem, setEditItem] = useState<T | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)

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

  const handleToggle = async (item: T) => {
    if (!onToggle || item.isActive === undefined) return
    setActionId(item.id)
    const ok = await onToggle(item.id, !item.isActive)
    setActionId(null)
    return ok
  }

  return (
    <Card className="p-6 bg-card border-border space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        </div>
        {!hideCreate && onCreate && (
          <Button onClick={() => setCreateOpen(true)}>Adicionar</Button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground">Nenhum registro encontrado.</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key} className="text-xs uppercase tracking-wide">
                  {column.label}
                </TableHead>
              ))}
              <TableHead className="text-xs uppercase tracking-wide">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                {columns.map((column) => (
                  <TableCell key={column.key}>
                    {column.render ? column.render(item) : String((item as Record<string, unknown>)[column.key] ?? "")}
                  </TableCell>
                ))}
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditItem(item)}>
                      Editar
                    </Button>
                    {onToggle && item.isActive !== undefined && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleToggle(item)}
                        disabled={actionId === item.id}
                      >
                        {item.isActive ? "Desativar" : "Ativar"}
                      </Button>
                    )}
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

      {createFields && createDefaults && (
        <ConfigModal
          open={createOpen}
          title={`Adicionar ${title}`}
          description={`Criar um novo registro de ${title.toLowerCase()}.`}
          fields={createFields}
          initialValues={createDefaults}
          submitLabel="Criar"
          onClose={() => setCreateOpen(false)}
          onSubmit={handleCreate}
          submitting={submitting}
        />
      )}

      {editItem && (
        <ConfigModal
          open={Boolean(editItem)}
          title={`Editar ${title}`}
          description={`Atualizar o registro de ${title.toLowerCase()} selecionado.`}
          fields={editFields}
          initialValues={getEditValues(editItem)}
          submitLabel="Salvar"
          onClose={() => setEditItem(null)}
          onSubmit={handleEdit}
          submitting={submitting}
        />
      )}
    </Card>
  )
}
