import { useMemo, useRef, useEffect, useState } from "react"
import { FixedSizeList as List } from "react-window"
import { LogItem } from "./log-item"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import type { OrchestratorEvent } from "@/hooks/useOrchestratorEvents"

interface LogListProps {
  events: OrchestratorEvent[]
  loading?: boolean
  error?: Error | null
  onRetry?: () => void
  searchTerm?: string
  onLoadMore?: () => void
  hasMore?: boolean
  loadingMore?: boolean
}

// RF-03: Increased from 24px to 32px (30% increase) to prevent card overlap
const ITEM_HEIGHT = 32 // Base height for collapsed items
const CONTAINER_HEIGHT = 600 // Fixed height for virtualized list

export function LogList({
  events,
  loading,
  error,
  onRetry,
  searchTerm,
  onLoadMore,
  hasMore = false,
  loadingMore = false,
}: LogListProps) {
  const listRef = useRef<List>(null)
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())

  // Scroll to bottom when new events arrive
  useEffect(() => {
    if (listRef.current && events.length > 0) {
      listRef.current.scrollToItem(events.length - 1, "end")
    }
  }, [events.length])

  const toggleExpanded = (index: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  // Loading skeleton
  if (loading && events.length === 0) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border/40 bg-card/50 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="size-2 rounded-full" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border/40 bg-card/50 p-8 text-center">
        <div className="space-y-2">
          <p className="text-sm font-medium text-destructive">Erro ao carregar logs</p>
          <p className="text-xs text-muted-foreground">{error.message}</p>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
            <RefreshCw className="size-3.5" />
            Tentar novamente
          </Button>
        )}
      </div>
    )
  }

  // Empty state
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 bg-muted/20 p-8 text-center">
        <p className="text-sm font-medium text-muted-foreground">Nenhum log disponível</p>
        <p className="text-xs text-muted-foreground/80">
          {searchTerm ? "Tente ajustar os filtros de busca" : "Os logs aparecerão aqui quando a execução iniciar"}
        </p>
      </div>
    )
  }

  // Virtualized row renderer
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const event = events[index]
    const isExpanded = expandedItems.has(index)

    return (
      <div style={style} className="px-1">
        <LogItem
          event={event}
          expanded={isExpanded}
          onToggle={() => toggleExpanded(index)}
          searchTerm={searchTerm}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Virtualized list */}
      <List
        ref={listRef}
        height={CONTAINER_HEIGHT}
        itemCount={events.length}
        itemSize={ITEM_HEIGHT}
        width="100%"
        className="scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent"
      >
        {Row}
      </List>

      {/* Load more indicator */}
      {hasMore && (
        <div className="flex items-center justify-center py-4">
          {loadingMore ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <RefreshCw className="size-3.5 animate-spin" />
              Carregando mais logs...
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={onLoadMore} className="gap-2">
              Carregar mais
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
