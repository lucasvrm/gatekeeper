import { useMemo } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { AgentRunSummary } from "@/lib/api"
import { groupRunsByDate, formatDateForChart, type Granularity } from "@/lib/analytics-utils"

const chartConfig = {
  errorRate: {
    label: "Taxa de Erro",
    color: "hsl(0 84.2% 60.2%)", // red-500
  },
} satisfies ChartConfig

interface ErrorRateChartProps {
  runs: AgentRunSummary[]
  granularity: Granularity
}

/**
 * Retorna cor condicional baseada na taxa de erro:
 * - Verde: < 10%
 * - Amarelo: 10-30%
 * - Vermelho: > 30%
 */
function getBarColor(errorRate: number): string {
  if (errorRate < 10) return "hsl(142.1 76.2% 36.3%)" // green-600
  if (errorRate < 30) return "hsl(47.9 95.8% 53.1%)" // yellow-500
  return "hsl(0 84.2% 60.2%)" // red-500
}

export function ErrorRateChart({ runs, granularity }: ErrorRateChartProps) {
  const data = useMemo(() => {
    const grouped = groupRunsByDate(runs, granularity)
    return grouped.map((point) => {
      const errorRate = point.count > 0 ? (point.errorCount / point.count) * 100 : 0
      return {
        ...point,
        dateFormatted: formatDateForChart(point.date, granularity),
        errorRate: parseFloat(errorRate.toFixed(1)),
      }
    })
  }, [runs, granularity])

  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="dateFormatted"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}%`}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  if (!payload || payload.length === 0) return ""
                  const item = payload[0].payload
                  return `${item.dateFormatted} • ${item.errorRate}% de erro • ${item.errorCount}/${item.count} execuções`
                }}
              />
            }
          />
          <ChartLegend
            content={
              <ChartLegendContent
                payload={[
                  {
                    value: "Total de Execuções",
                    type: "square",
                    color: "hsl(var(--muted-foreground))",
                  },
                  {
                    value: "Erros",
                    type: "square",
                    color: "hsl(0 84.2% 60.2%)",
                  },
                ]}
              />
            }
          />
          <Bar dataKey="errorRate" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.errorRate)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
