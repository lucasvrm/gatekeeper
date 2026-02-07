import { useRef, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { LogEntry } from "./types"

interface LogPanelProps {
  logs: LogEntry[]
  debugMode: boolean
  onToggleDebug: () => void
}

export function LogPanel({ logs, debugMode, onToggleDebug }: LogPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs.length])

  if (logs.length === 0) return null

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between py-2">
        <CardTitle className="text-sm">Log</CardTitle>
        <button
          onClick={onToggleDebug}
          className={`text-[10px] font-mono px-2 py-0.5 rounded border ${debugMode ? "bg-violet-500/20 border-violet-500/50 text-violet-700 dark:text-violet-300" : "border-muted text-muted-foreground hover:text-foreground"}`}
        >
          {debugMode ? "🐛 DEBUG ON" : "DEBUG"}
        </button>
      </CardHeader>
      <CardContent>
        <div ref={scrollRef} className={`${debugMode ? "max-h-96" : "max-h-48"} overflow-auto space-y-1`}>
          {logs.map((log, i) => (
            <div key={i} className={`flex gap-2 text-xs font-mono ${log.type === "debug" ? "opacity-75" : ""}`}>
              <span className="text-muted-foreground shrink-0">{log.time}</span>
              <Badge variant="outline" className={`text-[10px] shrink-0 ${log.type === "debug" ? "border-violet-500/40 text-violet-700 dark:text-violet-300" : ""}`}>{log.type}</Badge>
              <span className={`${log.type === "debug" ? "text-violet-700 dark:text-violet-300" : "text-foreground"} break-all`}>{log.text}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
