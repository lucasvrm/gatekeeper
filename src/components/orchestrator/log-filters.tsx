import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { X } from "lucide-react"
import type { LogFilterOptions } from "@/lib/types"

interface LogFiltersProps {
  filters: LogFilterOptions
  onFiltersChange: (filters: LogFilterOptions) => void
}

export function LogFilters({ filters, onFiltersChange }: LogFiltersProps) {
  const handleLevelChange = (value: string) => {
    onFiltersChange({
      ...filters,
      level: value === "all" ? undefined : (value as "error" | "warn" | "info" | "debug"),
    })
  }

  const handleStageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      stage: e.target.value || undefined,
    })
  }

  const handleTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      type: e.target.value || undefined,
    })
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      search: e.target.value || undefined,
    })
  }

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      startDate: e.target.value || undefined,
    })
  }

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      endDate: e.target.value || undefined,
    })
  }

  const handleReset = () => {
    onFiltersChange({})
  }

  const hasActiveFilters = Boolean(
    filters.level || filters.stage || filters.type || filters.search || filters.startDate || filters.endDate
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Filtros</h3>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-8 px-2 text-xs"
            aria-label="Limpar todos os filtros"
          >
            <X className="size-3.5 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Level Filter */}
        <div className="space-y-2">
          <Label htmlFor="filter-level">Nível</Label>
          <Select
            value={filters.level || "all"}
            onValueChange={handleLevelChange}
          >
            <SelectTrigger id="filter-level" className="w-full" aria-label="Filtrar por nível de log">
              <SelectValue placeholder="Todos os níveis" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os níveis</SelectItem>
              <SelectItem value="error">
                <span className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-red-500" />
                  Error
                </span>
              </SelectItem>
              <SelectItem value="warn">
                <span className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-yellow-500" />
                  Warning
                </span>
              </SelectItem>
              <SelectItem value="info">
                <span className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-blue-500" />
                  Info
                </span>
              </SelectItem>
              <SelectItem value="debug">
                <span className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-gray-500" />
                  Debug
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Search Filter */}
        <div className="space-y-2">
          <Label htmlFor="filter-search">Buscar</Label>
          <Input
            id="filter-search"
            type="text"
            placeholder="Buscar na mensagem..."
            value={filters.search || ""}
            onChange={handleSearchChange}
            aria-label="Buscar texto nos logs"
          />
        </div>

        {/* Stage Filter */}
        <div className="space-y-2">
          <Label htmlFor="filter-stage">Estágio</Label>
          <Input
            id="filter-stage"
            type="text"
            placeholder="Ex: planning, writing..."
            value={filters.stage || ""}
            onChange={handleStageChange}
            aria-label="Filtrar por estágio da pipeline"
          />
        </div>

        {/* Type Filter */}
        <div className="space-y-2">
          <Label htmlFor="filter-type">Tipo de Evento</Label>
          <Input
            id="filter-type"
            type="text"
            placeholder="Ex: agent:tool_call"
            value={filters.type || ""}
            onChange={handleTypeChange}
            aria-label="Filtrar por tipo de evento"
          />
        </div>

        {/* Start Date Filter */}
        <div className="space-y-2">
          <Label htmlFor="filter-start-date">Data Inicial</Label>
          <Input
            id="filter-start-date"
            type="datetime-local"
            value={
              filters.startDate
                ? new Date(filters.startDate).toISOString().slice(0, 16)
                : ""
            }
            onChange={handleStartDateChange}
            aria-label="Filtrar por data inicial"
          />
        </div>

        {/* End Date Filter */}
        <div className="space-y-2">
          <Label htmlFor="filter-end-date">Data Final</Label>
          <Input
            id="filter-end-date"
            type="datetime-local"
            value={
              filters.endDate
                ? new Date(filters.endDate).toISOString().slice(0, 16)
                : ""
            }
            onChange={handleEndDateChange}
            aria-label="Filtrar por data final"
          />
        </div>
      </div>

      {/* Active Filters Indicator */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium">Filtros ativos:</span>
          <div className="flex flex-wrap gap-1">
            {filters.level && (
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5">
                Nível: {filters.level}
              </span>
            )}
            {filters.stage && (
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5">
                Estágio: {filters.stage}
              </span>
            )}
            {filters.type && (
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5">
                Tipo: {filters.type}
              </span>
            )}
            {filters.search && (
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5">
                Busca: "{filters.search}"
              </span>
            )}
            {(filters.startDate || filters.endDate) && (
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5">
                Período
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
