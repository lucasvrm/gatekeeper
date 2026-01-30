import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
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
import { FailModePopover } from "@/components/fail-mode-popover"
import type { FailMode } from "@/lib/types"

type ValidatorItem = {
  key: string
  value: string
  failMode?: FailMode
  gateCategory?: string
  displayName?: string
  description?: string
  category?: string
}

interface ValidatorsTabProps {
  validators: ValidatorItem[]
  actionId: string | null
  activeCount: number
  inactiveCount: number
  onToggle: (name: string, isActive: boolean) => void | Promise<void>
  onFailModeChange: (validatorKey: string, mode: FailMode) => void | Promise<void>
  onBulkUpdate?: (payload: { keys: string[]; updates: { isActive?: boolean; failMode?: FailMode } }) => Promise<unknown>
}

export function ValidatorsTab({
  validators,
  actionId,
  activeCount,
  inactiveCount,
  onToggle,
  onFailModeChange,
  onBulkUpdate,
}: ValidatorsTabProps) {
  const [categoryFilter, setCategoryFilter] = useState("ALL")
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL")
  const [failModeFilter, setFailModeFilter] = useState<"ALL" | "HARD" | "WARNING" | "DEFAULT">("ALL")
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())

  const enrichedValidators = useMemo(() => {
    return validators.map((validator) => {
      return {
        ...validator,
        categoryKey: validator.category ?? "UNKNOWN",
        categoryLabel: validator.category ?? validator.gateCategory ?? "—",
        categoryDescription: validator.description ?? "",
      }
    })
  }, [validators])

  const availableCategories = useMemo(() => {
    const categories = new Set(
      validators
        .map((v) => v.category)
        .filter((c): c is string => Boolean(c))
    )
    return Array.from(categories).sort()
  }, [validators])

  const filteredValidators = useMemo(() => {
    return enrichedValidators.filter((validator) => {
      if (categoryFilter !== "ALL" && validator.categoryKey !== categoryFilter) {
        return false
      }
      if (statusFilter === "ACTIVE" && validator.value !== "true") {
        return false
      }
      if (statusFilter === "INACTIVE" && validator.value === "true") {
        return false
      }
      if (failModeFilter !== "ALL") {
        if (failModeFilter === "DEFAULT") {
          if (validator.failMode !== null && validator.failMode !== undefined) {
            return false
          }
        } else if (validator.failMode !== failModeFilter) {
          return false
        }
      }
      return true
    })
  }, [categoryFilter, enrichedValidators, failModeFilter, statusFilter])

  const visibleKeys = useMemo(() => filteredValidators.map((validator) => validator.key), [filteredValidators])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedKeys(new Set(visibleKeys))
    } else {
      setSelectedKeys(new Set())
    }
  }

  const handleSelectOne = (key: string, checked: boolean) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(key)
      } else {
        next.delete(key)
      }
      return next
    })
  }

  const handleBulkActivate = async () => {
    if (onBulkUpdate && selectedKeys.size > 0) {
      await onBulkUpdate({ keys: Array.from(selectedKeys), updates: { isActive: true } })
    }
  }

  const handleBulkDeactivate = async () => {
    if (onBulkUpdate && selectedKeys.size > 0) {
      await onBulkUpdate({ keys: Array.from(selectedKeys), updates: { isActive: false } })
    }
  }

  const handleBulkFailMode = async (mode: FailMode) => {
    if (onBulkUpdate && selectedKeys.size > 0) {
      await onBulkUpdate({ keys: Array.from(selectedKeys), updates: { failMode: mode } })
    }
  }

  const handleClearSelection = () => {
    setSelectedKeys(new Set())
  }

  const isAllSelected = visibleKeys.length > 0 && visibleKeys.every((key) => selectedKeys.has(key))

  return (
    <Card className="p-6 bg-card border-border space-y-4">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Validators</h2>
          <div className="flex flex-wrap items-center gap-3 justify-end">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Categoria</span>
              <select
                data-testid="category-filter"
                className="h-9 w-52 rounded-md border border-input bg-background px-3 text-sm"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value="ALL">Todas categorias</option>
                {availableCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Status</span>
              <select
                data-testid="status-filter"
                className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as "ALL" | "ACTIVE" | "INACTIVE")}
              >
                <option value="ALL">Todos status</option>
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
              </select>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Fail Mode</span>
              <select
                data-testid="fail-mode-filter"
                className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm"
                value={failModeFilter}
                onChange={(event) =>
                  setFailModeFilter(event.target.value as "ALL" | "HARD" | "WARNING" | "DEFAULT")
                }
              >
                <option value="ALL">Todos tipos</option>
                <option value="HARD">Hard</option>
                <option value="WARNING">Warning</option>
                <option value="DEFAULT">Default</option>
              </select>
            </div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Toggle validator enforcement for Gatekeeper checks.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Badge variant="default">Active {activeCount}</Badge>
          <Badge variant="secondary">Inactive {inactiveCount}</Badge>
        </div>
      </div>

      {selectedKeys.size > 0 && (
        <div data-testid="bulk-actions-bar" className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 p-3 text-sm">
          <span data-testid="selected-count">{selectedKeys.size} validators selecionados</span>
          <Button size="sm" variant="secondary" data-testid="bulk-activate-btn" onClick={handleBulkActivate}>
            Ativar Selecionados
          </Button>
          <Button size="sm" variant="secondary" data-testid="bulk-deactivate-btn" onClick={handleBulkDeactivate}>
            Desativar Selecionados
          </Button>
          <select
            data-testid="bulk-fail-mode-dropdown"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            defaultValue=""
            onChange={(event) => {
              const value = event.target.value
              const mode = value === "HARD" ? "HARD" : value === "WARNING" ? "WARNING" : null
              handleBulkFailMode(mode)
            }}
          >
            <option value="" disabled>Definir Fail Mode</option>
            <option value="HARD">Hard</option>
            <option value="WARNING">Warning</option>
          </select>
          <Button size="sm" variant="ghost" data-testid="clear-selection-btn" onClick={handleClearSelection}>
            Limpar Seleção
          </Button>
        </div>
      )}

      {filteredValidators.length === 0 ? (
        <div className="text-sm text-muted-foreground">No validators found.</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs uppercase tracking-wide">
                <input
                  type="checkbox"
                  data-testid="select-all-checkbox"
                  checked={isAllSelected}
                  onChange={(event) => handleSelectAll(event.target.checked)}
                />
              </TableHead>
              <TableHead className="text-xs uppercase tracking-wide">Validator</TableHead>
              <TableHead className="text-xs uppercase tracking-wide">Categoria</TableHead>
              <TableHead className="text-xs uppercase tracking-wide">Descrição</TableHead>
              <TableHead className="text-xs uppercase tracking-wide">Status</TableHead>
              <TableHead className="text-xs uppercase tracking-wide">Fail</TableHead>
              <TableHead className="text-xs uppercase tracking-wide">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredValidators.map((validator) => {
              const isActive = validator.value === "true"
              const displayName = validator.displayName ?? validator.key
              const description = validator.description || "Sem descrição disponível"
              return (
                <TableRow key={validator.key} data-testid={`validator-row-${validator.key}`}>
                  <TableCell>
                    <input
                      type="checkbox"
                      data-testid={`validator-checkbox-${validator.key}`}
                      checked={selectedKeys.has(validator.key)}
                      onChange={(event) => handleSelectOne(validator.key, event.target.checked)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{displayName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground" title={validator.categoryDescription}>
                    {validator.categoryLabel}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-md whitespace-normal break-words">
                    {description}
                  </TableCell>
                  <TableCell>
                    <Badge variant={isActive ? "default" : "secondary"}>
                      {isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <FailModePopover
                      currentMode={validator.failMode ?? null}
                      onModeChange={(mode) => onFailModeChange(validator.key, mode)}
                      disabled={actionId === validator.key}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant={isActive ? "secondary" : "outline"}
                      onClick={() => onToggle(validator.key, !isActive)}
                      disabled={actionId === validator.key}
                    >
                      {isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </Card>
  )
}
