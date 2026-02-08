import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { ArrowUpDown, TrendingUp } from "lucide-react"
import type { AgentRunSummary } from "@/lib/api"
import { compareProviders, formatDuration } from "@/lib/analytics-utils"
import { cn } from "@/lib/utils"

interface ProviderComparisonTableProps {
  runs: AgentRunSummary[]
}

type SortField = "provider" | "avgCost" | "avgDuration" | "successRate" | "totalRuns"
type SortDirection = "asc" | "desc"

export function ProviderComparisonTable({ runs }: ProviderComparisonTableProps) {
  const [sortField, setSortField] = useState<SortField>("avgCost")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")

  const providerStats = useMemo(() => compareProviders(runs), [runs])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      // New field, default to ascending
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const sortedStats = useMemo(() => {
    const sorted = [...providerStats].sort((a, b) => {
      const aValue: number | string = a[sortField]
      const bValue: number | string = b[sortField]

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue
      }

      return 0
    })

    return sorted
  }, [providerStats, sortField, sortDirection])

  const bestSuccessRate = useMemo(() => {
    if (providerStats.length === 0) return 0
    return Math.max(...providerStats.map((p) => p.successRate))
  }, [providerStats])

  const SortIcon = ({ field }: { field: SortField }) => (
    <ArrowUpDown
      className={cn(
        "ml-1 inline-block size-3",
        sortField === field ? "text-primary" : "text-muted-foreground"
      )}
    />
  )

  if (providerStats.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Nenhum dado de provider disponível
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Desktop: Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="border-b">
            <tr className="text-left text-sm text-muted-foreground">
              <th
                className="pb-3 font-medium cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("provider")}
              >
                Provider <SortIcon field="provider" />
              </th>
              <th
                className="pb-3 font-medium cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("avgCost")}
              >
                Custo Médio <SortIcon field="avgCost" />
              </th>
              <th
                className="pb-3 font-medium cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("avgDuration")}
              >
                Duração Média <SortIcon field="avgDuration" />
              </th>
              <th
                className="pb-3 font-medium cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("successRate")}
              >
                Taxa de Sucesso <SortIcon field="successRate" />
              </th>
              <th
                className="pb-3 font-medium cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("totalRuns")}
              >
                Total de Runs <SortIcon field="totalRuns" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sortedStats.map((stat) => {
              const isTopPerformer = stat.successRate === bestSuccessRate && bestSuccessRate > 0

              return (
                <tr
                  key={stat.provider}
                  className="hover:bg-muted/50 transition-colors"
                >
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium">{stat.provider}</span>
                      {isTopPerformer && (
                        <Badge className="bg-green-500 hover:bg-green-600 text-white">
                          <TrendingUp className="size-3 mr-1" />
                          Top
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="py-3 font-mono text-sm">
                    ${stat.avgCost.toFixed(6)}
                  </td>
                  <td className="py-3 font-mono text-sm">
                    {formatDuration(stat.avgDuration)}
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">
                        {stat.successRate.toFixed(1)}%
                      </span>
                      <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full transition-all",
                            stat.successRate >= 80
                              ? "bg-green-500"
                              : stat.successRate >= 50
                              ? "bg-yellow-500"
                              : "bg-red-500"
                          )}
                          style={{ width: `${stat.successRate}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-3 font-mono text-sm">{stat.totalRuns}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: Cards */}
      <div className="md:hidden space-y-4">
        {sortedStats.map((stat) => {
          const isTopPerformer = stat.successRate === bestSuccessRate && bestSuccessRate > 0

          return (
            <div
              key={stat.provider}
              className="p-4 border rounded-lg space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-medium">{stat.provider}</span>
                {isTopPerformer && (
                  <Badge className="bg-green-500 hover:bg-green-600 text-white">
                    <TrendingUp className="size-3 mr-1" />
                    Top
                  </Badge>
                )}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Custo Médio:</span>
                  <span className="font-mono">${stat.avgCost.toFixed(6)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duração Média:</span>
                  <span className="font-mono">{formatDuration(stat.avgDuration)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Taxa de Sucesso:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{stat.successRate.toFixed(1)}%</span>
                    <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all",
                          stat.successRate >= 80
                            ? "bg-green-500"
                            : stat.successRate >= 50
                            ? "bg-yellow-500"
                            : "bg-red-500"
                        )}
                        style={{ width: `${stat.successRate}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total de Runs:</span>
                  <span className="font-mono">{stat.totalRuns}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Sorting info */}
      <div className="text-xs text-muted-foreground">
        Ordenado por:{" "}
        <span className="font-medium text-foreground">
          {sortField === "provider" && "Provider"}
          {sortField === "avgCost" && "Custo Médio"}
          {sortField === "avgDuration" && "Duração Média"}
          {sortField === "successRate" && "Taxa de Sucesso"}
          {sortField === "totalRuns" && "Total de Runs"}
        </span>{" "}
        ({sortDirection === "asc" ? "crescente" : "decrescente"})
      </div>
    </div>
  )
}
