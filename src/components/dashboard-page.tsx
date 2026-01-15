import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { ShieldCheck, List, CheckCircle, XCircle } from "@phosphor-icons/react"
import { api } from "@/lib/api"
import type { Run } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"

export function DashboardPage() {
  const [stats, setStats] = useState<{
    totalRuns: number
    passed: number
    failed: number
    running: number
  } | null>(null)
  const [recentRuns, setRecentRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await api.runs.list(1, 5)
        setRecentRuns(response.data)
        
        const allRuns = await api.runs.list(1, 100)
        const passed = allRuns.data.filter((r) => r.status === "PASSED").length
        const failed = allRuns.data.filter((r) => r.status === "FAILED").length
        const running = allRuns.data.filter((r) => r.status === "RUNNING").length
        
        setStats({
          totalRuns: allRuns.pagination.total,
          passed,
          failed,
          running,
        })
      } catch (error) {
        console.error("Failed to load dashboard:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overview of validation runs and system status
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6 bg-card border-border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <List className="w-6 h-6 text-primary" weight="bold" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">
                Total Runs
              </p>
              <p className="text-3xl font-bold mt-1">{stats?.totalRuns || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-card border-border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-status-passed/10 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-status-passed" weight="fill" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">
                Passed
              </p>
              <p className="text-3xl font-bold mt-1">{stats?.passed || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-card border-border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-status-failed/10 flex items-center justify-center">
              <XCircle className="w-6 h-6 text-status-failed" weight="fill" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">
                Failed
              </p>
              <p className="text-3xl font-bold mt-1">{stats?.failed || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-card border-border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-status-running/10 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-status-running" weight="fill" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">
                Running
              </p>
              <p className="text-3xl font-bold mt-1">{stats?.running || 0}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6 bg-card border-border">
        <h2 className="text-xl font-semibold mb-4">Recent Runs</h2>
        {recentRuns.length === 0 ? (
          <p className="text-muted-foreground text-sm">No recent runs found</p>
        ) : (
          <div className="space-y-3">
            {recentRuns.map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1">
                  <p className="font-mono text-sm text-muted-foreground">
                    {run.id.substring(0, 8)}
                  </p>
                  <p className="font-medium mt-1">{run.projectPath}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Gate {run.currentGate}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(run.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
