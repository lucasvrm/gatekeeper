import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
}

export function ValidatorsTab({
  validators,
  actionId,
  activeCount,
  inactiveCount,
  onToggle,
  onFailModeChange,
}: ValidatorsTabProps) {
  const [categoryFilter, setCategoryFilter] = useState("ALL")
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL")

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
      return true
    })
  }, [categoryFilter, enrichedValidators, statusFilter])

  return (
    <Card className="p-6 bg-card border-border space-y-4">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Validators</h2>
          <div className="flex flex-wrap items-center gap-3 justify-end">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Categoria</span>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas categorias</SelectItem>
                  {availableCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Status</span>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "ALL" | "ACTIVE" | "INACTIVE")}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos status</SelectItem>
                  <SelectItem value="ACTIVE">Ativo</SelectItem>
                  <SelectItem value="INACTIVE">Inativo</SelectItem>
                </SelectContent>
              </Select>
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

      {filteredValidators.length === 0 ? (
        <div className="text-sm text-muted-foreground">No validators found.</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
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
              const description = validator.description || 'Sem descrição disponível'
              return (
                <TableRow key={validator.key} data-testid={`validator-row-${validator.key}`}>
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
