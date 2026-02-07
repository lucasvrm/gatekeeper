import { useState, useEffect, useRef, useCallback } from "react"
import { LogFilters } from "./log-filters"
import { LogList } from "./log-list"
import { useLogEvents } from "@/hooks/useLogEvents"
import { Button } from "@/components/ui/button"
import { ArrowUp, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import type { LogFilterOptions } from "@/lib/types"
import type { OrchestratorEvent } from "@/hooks/useOrchestratorEvents"

interface LogViewerProps {
  pipelineId: string
  onFiltersChange?: (filters: LogFilterOptions) => void
}

const RETRY_DELAYS = [1000, 2000, 4000, 8000] // Exponential backoff (1s, 2s, 4s, 8s)

export function LogViewer({ pipelineId, onFiltersChange }: LogViewerProps) {
  const [filters, setFilters] = useState<LogFilterOptions>({})
  const [allEvents, setAllEvents] = useState<OrchestratorEvent[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [showScrollTop, setShowScrollTop] = useState(false)

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null)

  // Fetch logs with current filters
  const { data, loading, error, refetch } = useLogEvents({
    pipelineId,
    filters,
    debounceMs: 300,
    enableCache: true,
  })

  // Update all events when data changes
  useEffect(() => {
    if (data && !loading) {
      if (page === 1) {
        setAllEvents(data)
      } else {
        setAllEvents((prev) => [...prev, ...data])
      }
      setLoadingMore(false)

      // Check if there are more results (rough heuristic)
      if (data.length < 50) {
        setHasMore(false)
      }
    }
  }, [data, loading, page])

  // Error handling with exponential backoff retry
  useEffect(() => {
    if (error) {
      toast.error("Erro ao carregar logs", {
        description: error.message,
        action: {
          label: "Tentar novamente",
          onClick: handleRetry,
        },
      })
    }
  }, [error])

  const handleRetry = useCallback(() => {
    const delay = RETRY_DELAYS[Math.min(retryCount, RETRY_DELAYS.length - 1)]

    toast.info("Tentando reconectar...", {
      description: `Aguardando ${delay / 1000}s`,
    })

    setTimeout(() => {
      refetch()
      setRetryCount((prev) => prev + 1)
    }, delay)
  }, [retryCount, refetch])

  // Reset retry count on successful fetch
  useEffect(() => {
    if (!loading && !error) {
      setRetryCount(0)
    }
  }, [loading, error])

  // Infinite scroll: Intersection Observer
  useEffect(() => {
    if (!loadMoreTriggerRef.current || !hasMore || loadingMore) return

    const options = {
      root: scrollContainerRef.current,
      rootMargin: "100px",
      threshold: 0.1,
    }

    const callback: IntersectionObserverCallback = (entries) => {
      const [entry] = entries
      if (entry.isIntersecting && hasMore && !loadingMore) {
        handleLoadMore()
      }
    }

    observerRef.current = new IntersectionObserver(callback, options)
    observerRef.current.observe(loadMoreTriggerRef.current)

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [hasMore, loadingMore])

  const handleLoadMore = () => {
    if (!hasMore || loadingMore) return
    setLoadingMore(true)
    setPage((prev) => prev + 1)
  }

  // Scroll to top button visibility
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = () => {
      setShowScrollTop(container.scrollTop > 500)
    }

    container.addEventListener("scroll", handleScroll)
    return () => container.removeEventListener("scroll", handleScroll)
  }, [])

  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleFiltersChange = (newFilters: LogFilterOptions) => {
    setFilters(newFilters)
    setPage(1)
    setHasMore(true)
    setAllEvents([])
    onFiltersChange?.(newFilters)
  }

  // If error and stale cache available, show cache with warning
  const displayEvents = error && allEvents.length > 0 ? allEvents : data || []
  const isStale = error && allEvents.length > 0

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Filters - RF-04: shrink-0 prevents this area from scrolling */}
      <div className="shrink-0" data-testid="filters-area">
        <LogFilters filters={filters} onFiltersChange={handleFiltersChange} />
      </div>

      {/* Stale cache warning */}
      {isStale && (
        <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-yellow-700">
              <RefreshCw className="size-4" />
              <span>Exibindo dados em cache. A conexão foi perdida.</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleRetry} className="shrink-0">
              Reconectar
            </Button>
          </div>
        </div>
      )}

      {/* Log List - RF-04: overflow-hidden instead of overflow-y-auto (scroll managed by react-window) */}
      <div ref={scrollContainerRef} data-testid="log-list-container" className="flex-1 overflow-hidden" style={{ overflow: 'hidden' }}>
        <LogList
          events={displayEvents}
          loading={loading && page === 1}
          error={!isStale ? error : null}
          onRetry={handleRetry}
          searchTerm={filters.search}
          onLoadMore={handleLoadMore}
          hasMore={hasMore}
          loadingMore={loadingMore}
        />

        {/* Infinite scroll trigger */}
        {hasMore && <div ref={loadMoreTriggerRef} className="h-px" />}
      </div>

      {/* Scroll to top button */}
      {showScrollTop && (
        <Button
          variant="outline"
          size="icon"
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 size-10 rounded-full shadow-lg z-50"
          aria-label="Scroll to top"
        >
          <ArrowUp className="size-4" />
        </Button>
      )}
    </div>
  )
}
