import { useState } from "react"
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { X, ChevronDown } from "lucide-react"
import type { LogFilterOptions } from "@/lib/types"

interface LogFiltersProps {
  filters: LogFilterOptions
  onFiltersChange: (filters: LogFilterOptions) => void
}

export function LogFilters({ filters, onFiltersChange }: LogFiltersProps) {
  const [openFilters, setOpenFilters] = useState<Record<string, boolean>>({
    level: true,
    search: false,
    stage: false,
    type: false,
    dates: false,
  })

  const toggleFilter = (key: string) => {
    setOpenFilters((prev) => ({ ...prev, [key]: !prev[key] }))
  }

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
    <div className="space-y-3">
      {hasActiveFilters && (
        <div className="flex justify-end">
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
        </div>
      )}

      <div className="space-y-2">
        {/* Level Filter */}
        <Collapsible open={openFilters.level} onOpenChange={() => toggleFilter("level")}>
          <div className="rounded-lg border border-border/40 bg-card/50">
            <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors">
              <span>Nível</span>
              <ChevronDown className={`size-4 transition-transform ${openFilters.level ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-3 pb-3 pt-1">
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
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Search Filter */}
        <Collapsible open={openFilters.search} onOpenChange={() => toggleFilter("search")}>
          <div className="rounded-lg border border-border/40 bg-card/50">
            <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors">
              <span>Buscar</span>
              <ChevronDown className={`size-4 transition-transform ${openFilters.search ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-3 pb-3 pt-1">
                <Input
                  id="filter-search"
                  type="text"
                  placeholder="Buscar na mensagem..."
                  value={filters.search || ""}
                  onChange={handleSearchChange}
                  aria-label="Buscar texto nos logs"
                />
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Stage Filter */}
        <Collapsible open={openFilters.stage} onOpenChange={() => toggleFilter("stage")}>
          <div className="rounded-lg border border-border/40 bg-card/50">
            <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors">
              <span>Estágio</span>
              <ChevronDown className={`size-4 transition-transform ${openFilters.stage ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-3 pb-3 pt-1">
                <Input
                  id="filter-stage"
                  type="text"
                  placeholder="Ex: planning, writing..."
                  value={filters.stage || ""}
                  onChange={handleStageChange}
                  aria-label="Filtrar por estágio da pipeline"
                />
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Type Filter */}
        <Collapsible open={openFilters.type} onOpenChange={() => toggleFilter("type")}>
          <div className="rounded-lg border border-border/40 bg-card/50">
            <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors">
              <span>Tipo de Evento</span>
              <ChevronDown className={`size-4 transition-transform ${openFilters.type ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-3 pb-3 pt-1">
                <Input
                  id="filter-type"
                  type="text"
                  placeholder="Ex: agent:tool_call"
                  value={filters.type || ""}
                  onChange={handleTypeChange}
                  aria-label="Filtrar por tipo de evento"
                />
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Date Filters */}
        <Collapsible open={openFilters.dates} onOpenChange={() => toggleFilter("dates")}>
          <div className="rounded-lg border border-border/40 bg-card/50">
            <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors">
              <span>Período</span>
              <ChevronDown className={`size-4 transition-transform ${openFilters.dates ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-3 pb-3 pt-1 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="filter-start-date" className="text-xs">Data Inicial</Label>
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
                <div className="space-y-2">
                  <Label htmlFor="filter-end-date" className="text-xs">Data Final</Label>
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
            </CollapsibleContent>
          </div>
        </Collapsible>
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
