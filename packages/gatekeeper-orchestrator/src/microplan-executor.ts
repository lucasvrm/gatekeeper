/**
 * Gatekeeper Orchestrator — Microplan Executor
 *
 * Executes microplans with topological sort and dependency tracking.
 */

import EventEmitter from 'events'
import type { Microplan, MicroplansDocument } from './types.js'

/**
 * Executes microplans in topologically sorted order with dependency tracking.
 *
 * Events emitted:
 * - microplan:start - { microplanId: string }
 * - microplan:complete - { microplanId: string }
 * - microplan:error - { microplanId: string, error: string }
 * - microplan:skipped - { microplanId: string, reason: string }
 */
export class MicroplanExecutor extends EventEmitter {
  /**
   * Topological sort with cycle detection.
   * Returns batches of microplans that can run in parallel.
   *
   * @throws Error if circular dependencies or missing dependencies detected
   */
  topologicalSort(microplans: Microplan[]): Microplan[][] {
    // Build dependency graph
    const graph = new Map<string, Set<string>>()
    const microplanMap = new Map<string, Microplan>()

    for (const mp of microplans) {
      microplanMap.set(mp.id, mp)
      graph.set(mp.id, new Set(mp.depends_on))
    }

    // Validate dependencies (detect missing deps)
    for (const [id, deps] of graph) {
      for (const depId of deps) {
        if (!microplanMap.has(depId)) {
          throw new Error(
            `Microplan ${id} depends on missing microplan ${depId}`
          )
        }
      }
    }

    // Detect cycles using DFS
    const visited = new Set<string>()
    const recStack = new Set<string>()

    const detectCycle = (nodeId: string, path: string[]): void => {
      visited.add(nodeId)
      recStack.add(nodeId)

      const deps = graph.get(nodeId) || new Set()
      for (const depId of deps) {
        if (!visited.has(depId)) {
          detectCycle(depId, [...path, nodeId])
        } else if (recStack.has(depId)) {
          const cyclePath = [...path, nodeId, depId].join(' → ')
          throw new Error(`Circular dependency detected: ${cyclePath}`)
        }
      }

      recStack.delete(nodeId)
    }

    for (const id of graph.keys()) {
      if (!visited.has(id)) {
        detectCycle(id, [])
      }
    }

    // Kahn's algorithm for topological sort (layer by layer)
    const batches: Microplan[][] = []
    const inDegree = new Map<string, number>()
    const remaining = new Set<string>()

    // Calculate in-degree for each node
    for (const [id, deps] of graph) {
      inDegree.set(id, deps.size)
      remaining.add(id)
    }

    // Process batches
    while (remaining.size > 0) {
      const batch: Microplan[] = []

      // Find all nodes with in-degree 0 (no pending dependencies)
      for (const id of remaining) {
        if (inDegree.get(id) === 0) {
          batch.push(microplanMap.get(id)!)
        }
      }

      if (batch.length === 0) {
        // No progress possible - should not happen if cycle detection worked
        throw new Error('Topological sort failed: possible circular dependency')
      }

      batches.push(batch)

      // Remove processed nodes and update in-degrees
      for (const mp of batch) {
        remaining.delete(mp.id)

        // Decrease in-degree of nodes that depend on this one
        for (const [otherId, deps] of graph) {
          if (deps.has(mp.id)) {
            inDegree.set(otherId, (inDegree.get(otherId) || 0) - 1)
          }
        }
      }
    }

    return batches
  }

  /**
   * Execute microplans in topological order.
   * Batches within the same level can run in parallel.
   * If a microplan fails, all its dependents are skipped.
   */
  async execute(microplansDoc: MicroplansDocument): Promise<void> {
    const { microplans } = microplansDoc

    if (microplans.length === 0) {
      return
    }

    // Sort microplans into executable batches
    const batches = this.topologicalSort(microplans)

    // Track failures to skip dependents
    const failed = new Set<string>()

    // Execute batches sequentially
    for (const batch of batches) {
      // Execute microplans in batch in parallel
      await Promise.all(
        batch.map(async mp => {
          // Skip if any dependency failed
          const hasFailedDep = mp.depends_on.some(depId => failed.has(depId))
          if (hasFailedDep) {
            this.emit('microplan:skipped', {
              microplanId: mp.id,
              reason: 'dependency failed',
            })
            failed.add(mp.id)
            return
          }

          // Execute microplan
          try {
            await this.executeMicroplan(mp)
          } catch (error) {
            failed.add(mp.id)
            this.emit('microplan:error', {
              microplanId: mp.id,
              error: (error as Error).message,
            })
          }
        })
      )
    }
  }

  /**
   * Execute a single microplan.
   * Emits microplan:start and microplan:complete events.
   *
   * @private
   */
  private async executeMicroplan(microplan: Microplan): Promise<void> {
    this.emit('microplan:start', { microplanId: microplan.id })

    // TODO: Actual execution logic (call LLM with microplan context)
    // For now, just simulate execution
    await new Promise(resolve => setTimeout(resolve, 10))

    this.emit('microplan:complete', { microplanId: microplan.id })
  }
}
