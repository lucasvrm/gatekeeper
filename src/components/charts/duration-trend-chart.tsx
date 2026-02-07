import { useMemo } from "react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { AgentRunSummary } from "@/lib/api"
import { calculateTimeSeriesMetrics, formatDateForChart, formatDuration, type Granularity } from "@/lib/analytics-utils"

const chartConfig = {
  avgDuration: {
    label: "Duração Média",
    color: "hsl(221.2 83.2% 53.3%)", // blue-600
  },
} satisfies ChartConfig

interface DurationTrendChartProps {
  runs: AgentRunSummary[]
  granularity: Granularity
}

export function DurationTrendChart({ runs, granularity }: DurationTrendChartProps) {
  const data = useMemo(() => {
    const metrics = calculateTimeSeriesMetrics(runs)
    return metrics.map((point) => ({
      ...point,
      dateFormatted: formatDateForChart(point.date, granularity),
    }))
  }, [runs, granularity])

  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id="colorDuration" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-avgDuration)" stopOpacity={0.8} />
              <stop offset="95%" stopColor="var(--color-avgDuration)" stopOpacity={0.1} />
            </linearGradient>
          </defs>
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
            tickFormatter={(value) => formatDuration(value)}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  if (!payload || payload.length === 0) return ""
                  const item = payload[0].payload
                  return `${item.dateFormatted} • Duração: ${formatDuration(item.avgDuration)}`
                }}
              />
            }
          />
          <Area
            type="monotone"
            dataKey="avgDuration"
            stroke="var(--color-avgDuration)"
            fill="url(#colorDuration)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
