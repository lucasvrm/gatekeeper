import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronRight } from "lucide-react"
import type { OrchestratorEvent } from "@/hooks/useOrchestratorEvents"

interface LogItemProps {
  event: OrchestratorEvent
  expanded?: boolean
  onToggle?: () => void
  searchTerm?: string
}

const LEVEL_COLORS = {
  error: "bg-red-500",
  warn: "bg-yellow-500",
  info: "bg-blue-500",
  debug: "bg-gray-500",
} as const

const STAGE_COLORS = {
  planning: "bg-purple-500/10 text-purple-700 border-purple-500/20",
  writing: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  validating: "bg-green-500/10 text-green-700 border-green-500/20",
  complete: "bg-gray-500/10 text-gray-700 border-gray-500/20",
} as const

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  })
}

function getLevelColor(level?: string): string {
  if (!level) return "bg-gray-500"
  return LEVEL_COLORS[level as keyof typeof LEVEL_COLORS] || "bg-gray-500"
}

function getStageColor(stage?: string): string {
  if (!stage) return "bg-gray-500/10 text-gray-700 border-gray-500/20"
  return STAGE_COLORS[stage as keyof typeof STAGE_COLORS] || "bg-gray-500/10 text-gray-700 border-gray-500/20"
}

function highlightSearchTerm(text: string, searchTerm?: string): React.ReactNode {
  if (!searchTerm || !text) return text

  const regex = new RegExp(`(${searchTerm})`, "gi")
  const parts = text.split(regex)

  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5">
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

export function LogItem({ event, expanded = false, onToggle, searchTerm }: LogItemProps) {
  const [isExpanded, setIsExpanded] = useState(expanded)

  const handleToggle = () => {
    const newState = !isExpanded
    setIsExpanded(newState)
    onToggle?.()
  }

  const level = (event.level as string) || "info"
  const stage = event.stage as string | undefined
  const timestamp = (event.timestamp as number) || Date.now()
  const message = (event.message as string) || event.type || "No message"
  const metadata = { ...event }
  delete metadata.type
  delete metadata.level
  delete metadata.stage
  delete metadata.timestamp
  delete metadata.message
  delete metadata.id
  delete metadata.seq

  const hasMetadata = Object.keys(metadata).length > 0

  return (
    <div
      className="group relative flex flex-col gap-2 rounded-lg border border-border/40 bg-card/50 p-3 transition-all hover:border-border hover:bg-card/80 hover:shadow-sm"
      data-log-level={level}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        {/* Level badge */}
        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          <span className={`size-2 rounded-full ${getLevelColor(level)}`} title={level} />
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1 space-y-1.5">
          {/* Timestamp + type + stage badges */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <time className="font-mono tabular-nums">{formatTimestamp(timestamp)}</time>
            <Badge variant="outline" className="rounded-sm px-1.5 py-0 text-[10px] font-mono">
              {event.type}
            </Badge>
            {stage && (
              <Badge variant="outline" className={`rounded-sm px-1.5 py-0 text-[10px] ${getStageColor(stage)}`}>
                {stage}
              </Badge>
            )}
          </div>

          {/* Message */}
          <div className="text-sm leading-relaxed text-foreground">
            {highlightSearchTerm(message, searchTerm)}
          </div>
        </div>

        {/* Expand/collapse button */}
        {hasMetadata && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggle}
            className="shrink-0 size-6 p-0 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
            aria-label={isExpanded ? "Collapse metadata" : "Expand metadata"}
            aria-expanded={isExpanded}
          >
            {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </Button>
        )}
      </div>

      {/* Metadata (collapsible) */}
      {hasMetadata && isExpanded && (
        <div className="ml-5 overflow-hidden rounded-md border border-border/40 bg-muted/50">
          <pre className="overflow-x-auto p-3 text-xs font-mono leading-relaxed">
            {JSON.stringify(metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
