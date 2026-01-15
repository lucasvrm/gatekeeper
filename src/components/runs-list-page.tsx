import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import type { Run, RunStatus } from "@/lib/types"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { CaretLeft, CaretRight, Plus, FunnelSimple } from "@phosphor-icons/react"

export function RunsListPage() {
  const navigate = useNavigate()
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState<RunStatus | "ALL">("ALL")
  const limit = 20

  useEffect(() => {
    const loadRuns = async () => {
      setLoading(true)
      try {
        const response = await api.runs.list(
          page,
          limit,
          statusFilter === "ALL" ? undefined : statusFilter
        )
        setRuns(response.data)
        setTotalPages(response.pagination.pages)
      } catch (error) {
        console.error("Failed to load runs:", error)
      } finally {
        setLoading(false)
      }
    }

    loadRuns()
  }, [page, statusFilter])

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString()
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Validation Runs</h1>
          <p className="text-muted-foreground mt-1">
            View and manage all validation runs
          </p>
        </div>
        <Button
          onClick={() => navigate("/runs/new")}
          className="bg-primary hover:bg-primary/90"
        >
          <Plus className="w-4 h-4 mr-2" weight="bold" />
          New Validation
        </Button>
      </div>

      <Card className="p-6 bg-card border-border">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <FunnelSimple className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filter by Status:</span>
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as RunStatus | "ALL")}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="RUNNING">Running</SelectItem>
              <SelectItem value="PASSED">Passed</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
              <SelectItem value="ABORTED">Aborted</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : runs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No runs found</p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">
                    Run ID
                  </TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">
                    Project Path
                  </TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">
                    Status
                  </TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">
                    Gate
                  </TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">
                    Created At
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow
                    key={run.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/runs/${run.id}`)}
                  >
                    <TableCell className="font-mono text-sm">
                      {run.id.substring(0, 8)}
                    </TableCell>
                    <TableCell className="font-medium">{run.projectPath}</TableCell>
                    <TableCell>
                      <StatusBadge status={run.status} />
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">Gate {run.currentGate}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {formatDate(run.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between mt-6 pt-6 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <CaretLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <CaretRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
