import { useMCPStatus } from "@/hooks/use-mcp-status"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export function StatusTab() {
  const { status, loading, reload } = useMCPStatus()

  if (loading) {
    return (
      <div data-testid="status-tab" className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-48" />
      </div>
    )
  }

  if (!status) {
    return (
      <div data-testid="status-tab">
        <div className="text-destructive">Falha ao carregar status</div>
      </div>
    )
  }

  const getBadgeColor = (value: string) => {
    if (value === "online" || value === "connected" || value === "accessible") {
      return "bg-green-500"
    }
    if (value === "not-configured") {
      return "bg-yellow-500"
    }
    return "bg-red-500"
  }

  return (
    <div data-testid="status-tab" className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="font-medium min-w-[140px]">Gatekeeper API:</span>
        <span
          data-testid="status-api-badge"
          className={cn(
            "px-3 py-1 rounded-full text-white text-sm font-medium",
            getBadgeColor(status.gatekeeperApi)
          )}
        >
          {status.gatekeeperApi}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="font-medium min-w-[140px]">Database:</span>
        <span
          data-testid="status-db-badge"
          className={cn(
            "px-3 py-1 rounded-full text-white text-sm font-medium",
            getBadgeColor(status.database)
          )}
        >
          {status.database}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="font-medium min-w-[140px]">Docs (DOCS_DIR):</span>
        <span
          data-testid="status-docs-badge"
          className={cn(
            "px-3 py-1 rounded-full text-white text-sm font-medium",
            getBadgeColor(status.docsDir)
          )}
        >
          {status.docsDir}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="font-medium min-w-[140px]">Git Branch:</span>
        <span
          data-testid="status-git-badge"
          className="px-3 py-1 rounded-full bg-muted text-muted-foreground text-sm font-medium"
        >
          {status.git}
        </span>
      </div>

      <button
        onClick={() => reload()}
        data-testid="refresh-status-button"
        className="mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors underline"
      >
        Atualizar status
      </button>
    </div>
  )
}
