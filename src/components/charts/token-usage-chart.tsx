import { useMemo } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { AgentRunSummary } from "@/lib/api"
import { aggregateTokensByDate, formatDateForChart, type Granularity } from "@/lib/analytics-utils"

const chartConfig = {
  inputTokens: {
    label: "Input Tokens",
    color: "hsl(221.2 83.2% 53.3%)", // blue-600
  },
  outputTokens: {
    label: "Output Tokens",
    color: "hsl(142.1 76.2% 36.3%)", // green-600
  },
} satisfies ChartConfig

interface TokenUsageChartProps {
  runs: AgentRunSummary[]
  granularity: Granularity
}

export function TokenUsageChart({ runs, granularity }: TokenUsageChartProps) {
  const data = useMemo(() => {
    const aggregated = aggregateTokensByDate(runs, granularity)
    return aggregated.map((point) => ({
      ...point,
      dateFormatted: formatDateForChart(point.date, granularity),
      totalTokens: point.inputTokens + point.outputTokens,
    }))
  }, [runs, granularity])

  const formatTokens = (value: number): string => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
    return value.toString()
  }

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
          <YAxis
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatTokens}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  if (!payload || payload.length === 0) return ""
                  const item = payload[0].payload
                  return `${item.dateFormatted} • Total: ${formatTokens(item.totalTokens)} tokens`
                }}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Line
            type="monotone"
            dataKey="inputTokens"
            stroke="var(--color-inputTokens)"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            name="Input Tokens"
          />
          <Line
            type="monotone"
            dataKey="outputTokens"
            stroke="var(--color-outputTokens)"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            name="Output Tokens"
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
