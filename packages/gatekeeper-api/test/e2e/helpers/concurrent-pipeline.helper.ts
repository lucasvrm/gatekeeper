import { TestClient } from '../setup/test-client'

// ─── Types ────────────────────────────────────────────────────────────

export interface PipelineMetrics {
  successCount: number
  failureCount: number
  avgDuration: number
  maxDuration: number
  minDuration: number
  totalDuration: number
}

export interface SpawnResult {
  outputId: string
  startTime: number
}

export interface MemorySnapshot {
  heap: number
  rss: number
  external: number
  timestamp: number
}

// ─── MemoryMonitor ────────────────────────────────────────────────────

export class MemoryMonitor {
  private snapshots: MemorySnapshot[] = []

  takeSnapshot(): NodeJS.MemoryUsage {
    const usage = process.memoryUsage()
    this.snapshots.push({
      heap: usage.heapUsed,
      rss: usage.rss,
      external: usage.external,
      timestamp: Date.now(),
    })
    return usage
  }

  detectLeak(tolerance = 1.5): boolean {
    if (this.snapshots.length < 2) return false
    const initial = this.snapshots[0].heap
    const final = this.snapshots[this.snapshots.length - 1].heap
    return final > initial * tolerance
  }

  getReport() {
    if (this.snapshots.length === 0) {
      return {
        initialHeap: '0MB',
        finalHeap: '0MB',
        growth: '0%',
        snapshots: 0,
      }
    }

    const initial = this.snapshots[0]
    const final = this.snapshots[this.snapshots.length - 1]
    const growth = ((final.heap / initial.heap) * 100 - 100).toFixed(1)

    return {
      initialHeap: (initial.heap / 1024 / 1024).toFixed(2) + 'MB',
      finalHeap: (final.heap / 1024 / 1024).toFixed(2) + 'MB',
      initialRss: (initial.rss / 1024 / 1024).toFixed(2) + 'MB',
      finalRss: (final.rss / 1024 / 1024).toFixed(2) + 'MB',
      growth: growth + '%',
      snapshots: this.snapshots.length,
      duration: final.timestamp - initial.timestamp,
    }
  }

  reset() {
    this.snapshots = []
  }
}

// ─── ConcurrentPipelineHelper ─────────────────────────────────────────

export class ConcurrentPipelineHelper {
  constructor(private client: TestClient) {}

  /**
   * Spawns multiple pipelines in parallel
   */
  async spawnPipelines(
    count: number,
    config: {
      projectId: string
      task: string
      phases: string[]
    }
  ): Promise<SpawnResult[]> {
    const startTime = Date.now()

    const promises = Array.from({ length: count }, async (_, i) => {
      const response = await this.client.post('/api/orchestrator/run', {
        projectId: config.projectId,
        task: `${config.task} ${i + 1}`,
        phases: config.phases,
      })
      return {
        outputId: response.outputId as string,
        startTime: Date.now(),
      }
    })

    return Promise.all(promises)
  }

  /**
   * Collects metrics from multiple pipelines
   */
  async collectMetrics(outputIds: string[], timeout = 60000): Promise<PipelineMetrics> {
    const startTime = Date.now()
    const durations: number[] = []

    const results = await Promise.allSettled(
      outputIds.map(async (id) => {
        const pipelineStart = Date.now()
        try {
          await this.client.pollUntil(
            () => this.client.get(`/api/orchestrator/${id}/status`),
            (s) => s.status === 'completed' || s.status === 'failed',
            timeout,
            1000
          )
          const duration = Date.now() - pipelineStart
          durations.push(duration)
          return { success: true, duration }
        } catch (error) {
          return { success: false, duration: Date.now() - pipelineStart }
        }
      })
    )

    const successCount = results.filter(
      (r) => r.status === 'fulfilled' && (r.value as any).success
    ).length
    const failureCount = outputIds.length - successCount

    const validDurations = durations.filter((d) => d > 0)
    const avgDuration = validDurations.length > 0
      ? validDurations.reduce((a, b) => a + b, 0) / validDurations.length
      : 0
    const maxDuration = validDurations.length > 0 ? Math.max(...validDurations) : 0
    const minDuration = validDurations.length > 0 ? Math.min(...validDurations) : 0
    const totalDuration = Date.now() - startTime

    return {
      successCount,
      failureCount,
      avgDuration,
      maxDuration,
      minDuration,
      totalDuration,
    }
  }

  /**
   * Waits for a specific duration
   */
  async wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
