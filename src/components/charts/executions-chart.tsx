import { useMemo } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { AgentRunSummary } from "@/lib/api"
import { groupRunsByDate, formatDateForChart, formatDuration, type Granularity } from "@/lib/analytics-utils"

const chartConfig = {
  successCount: {
    label: "Sucessos",
    color: "hsl(142.1 76.2% 36.3%)", // green-600
  },
  errorCount: {
    label: "Erros",
    color: "hsl(0 84.2% 60.2%)", // red-500
  },
} satisfies ChartConfig

interface ExecutionsChartProps {
  runs: AgentRunSummary[]
  granularity: Granularity
}

export function ExecutionsChart({ runs, granularity }: ExecutionsChartProps) {
  const data = useMemo(() => {
    const grouped = groupRunsByDate(runs, granularity)
    return grouped.map((point) => ({
      ...point,
      dateFormatted: formatDateForChart(point.date, granularity),
    }))
  }, [runs, granularity])

  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="dateFormatted"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  if (!payload || payload.length === 0) return ""
                  const item = payload[0].payload
                  return `${item.dateFormatted} • ${item.count} execuções • Média: ${formatDuration(item.avgDuration)}`
                }}
              />
            }
          />
          <Line
            type="monotone"
            dataKey="successCount"
            stroke="var(--color-successCount)"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="errorCount"
            stroke="var(--color-errorCount)"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
