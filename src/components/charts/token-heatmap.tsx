import { useMemo, useState } from "react"
import type { AgentRunSummary } from "@/lib/api"
import { calculateTokensHeatmap, TOKEN_RANGES } from "@/lib/analytics-utils"
import { cn } from "@/lib/utils"

interface TokenHeatmapProps {
  runs: AgentRunSummary[]
}

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
const HOURS = Array.from({ length: 24 }, (_, i) => i)

export function TokenHeatmap({ runs }: TokenHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<{ day: number; hour: number } | null>(null)

  const heatmapData = useMemo(() => calculateTokensHeatmap(runs), [runs])

  const getColorForTokens = (tokens: number): string => {
    const range = TOKEN_RANGES.find((r) => tokens >= r.min && tokens < r.max)
    return range?.color || TOKEN_RANGES[TOKEN_RANGES.length - 1].color
  }

  const getOpacity = (tokens: number): number => {
    if (tokens === 0) return 0.1
    const maxTokens = Math.max(
      ...heatmapData.flat().map((cell) => cell.tokens),
      1
    )
    return Math.min(0.3 + (tokens / maxTokens) * 0.7, 1)
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs">
        <span className="text-muted-foreground">Intensidade:</span>
        {TOKEN_RANGES.map((range) => (
          <div key={range.label} className="flex items-center gap-1.5">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: range.color }}
            />
            <span className="text-muted-foreground">{range.label}</span>
          </div>
        ))}
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          <div className="grid gap-1" style={{ gridTemplateColumns: "auto repeat(24, 1fr)" }}>
            {/* Header row (hours) */}
            <div className="w-12" /> {/* Empty corner */}
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="text-xs text-center text-muted-foreground font-mono"
                style={{ minWidth: "24px" }}
              >
                {hour}
              </div>
            ))}

            {/* Data rows */}
            {DAYS.map((day, dayIndex) => (
              <>
                {/* Day label */}
                <div
                  key={`label-${dayIndex}`}
                  className="text-xs text-muted-foreground flex items-center justify-end pr-2"
                >
                  {day}
                </div>

                {/* Hour cells */}
                {HOURS.map((hour) => {
                  const cellData = heatmapData[dayIndex][hour]
                  const isHovered =
                    hoveredCell?.day === dayIndex && hoveredCell?.hour === hour

                  return (
                    <div
                      key={`${dayIndex}-${hour}`}
                      className={cn(
                        "relative rounded transition-all cursor-pointer",
                        "hover:ring-2 hover:ring-primary hover:z-10",
                        isHovered && "ring-2 ring-primary z-10"
                      )}
                      style={{
                        minWidth: "24px",
                        minHeight: "24px",
                        backgroundColor: getColorForTokens(cellData.tokens),
                        opacity: getOpacity(cellData.tokens),
                      }}
                      onMouseEnter={() => setHoveredCell({ day: dayIndex, hour })}
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      {/* Tooltip */}
                      {isHovered && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 whitespace-nowrap">
                          <div className="bg-popover text-popover-foreground border border-border rounded-lg shadow-lg px-3 py-2 text-xs">
                            <div className="font-medium mb-1">
                              {day} às {hour}:00
                            </div>
                            <div className="text-muted-foreground space-y-0.5">
                              <div>Execuções: {cellData.count}</div>
                              <div>
                                Tokens:{" "}
                                {cellData.tokens >= 1000
                                  ? `${(cellData.tokens / 1000).toFixed(1)}K`
                                  : cellData.tokens}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </>
            ))}
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="flex items-center gap-6 text-xs text-muted-foreground pt-2 border-t">
        <div>
          Total de células: {7 * 24}
        </div>
        <div>
          Células ativas:{" "}
          {heatmapData.flat().filter((cell) => cell.count > 0).length}
        </div>
        <div>
          Horário mais ativo:{" "}
          {(() => {
            const maxCell = heatmapData
              .flatMap((row, dayIndex) =>
                row.map((cell, hour) => ({ ...cell, day: dayIndex, hour }))
              )
              .reduce((max, cell) =>
                cell.count > max.count ? cell : max
              )
            return maxCell.count > 0
              ? `${DAYS[maxCell.day]} ${maxCell.hour}:00`
              : "N/A"
          })()}
        </div>
      </div>
    </div>
  )
}
