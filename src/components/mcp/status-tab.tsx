import { useMCPStatus } from "@/hooks/use-mcp-status"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export function StatusTab() {
  const { status, loading } = useMCPStatus()

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
    if (value === "connected" || value === "online" || value === "accessible") {
      return "bg-green-500"
    }
    return "bg-red-500"
  }

  return (
    <div data-testid="status-tab" className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="font-medium min-w-[140px]">MCP Server:</span>
        <span
          data-testid="status-mcp-badge"
          className={cn(
            "px-3 py-1 rounded-full text-white text-sm font-medium",
            getBadgeColor(status.mcpServer)
          )}
        >
          {status.mcpServer}
        </span>
      </div>

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
        <span className="font-medium min-w-[140px]">Git Branch:</span>
        <span
          data-testid="status-git-badge"
          className="px-3 py-1 rounded-full bg-muted text-muted-foreground text-sm font-medium"
        >
          {status.git}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="font-medium min-w-[140px]">Documentation:</span>
        <span
          data-testid="status-docs-badge"
          className={cn(
            "px-3 py-1 rounded-full text-white text-sm font-medium",
            getBadgeColor(status.docs)
          )}
        >
          {status.docs}
        </span>
      </div>
    </div>
  )
}
