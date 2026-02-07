/**
 * Tests for MicroplanExecutor - Execution Flow
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { MicroplanExecutor } from '../src/microplan-executor.js'
import type { MicroplansDocument } from '../src/types.js'

describe('MicroplanExecutor - Execution Flow', () => {
  let executor: MicroplanExecutor

  beforeEach(() => {
    executor = new MicroplanExecutor()
  })

  describe('Event emission', () => {
    it('should emit start and complete events for successful execution', async () => {
      const events: string[] = []

      executor.on('microplan:start', ({ microplanId }) => {
        events.push(`start:${microplanId}`)
      })

      executor.on('microplan:complete', ({ microplanId }) => {
        events.push(`complete:${microplanId}`)
      })

      const doc: MicroplansDocument = {
        task: 'Test task',
        microplans: [
          {
            id: 'MP-1',
            goal: 'First',
            depends_on: [],
            files: [],
            verify: 'test',
          },
        ],
      }

      await executor.execute(doc)

      expect(events).toEqual(['start:MP-1', 'complete:MP-1'])
    })

    it('should emit skipped event when dependency fails', async () => {
      const events: string[] = []

      executor.on('microplan:start', ({ microplanId }) => {
        events.push(`start:${microplanId}`)
      })

      executor.on('microplan:error', ({ microplanId }) => {
        events.push(`error:${microplanId}`)
      })

      executor.on('microplan:skipped', ({ microplanId, reason }) => {
        events.push(`skipped:${microplanId}:${reason}`)
      })

      // Override executeMicroplan to simulate failure
      const originalExecute = (executor as any).executeMicroplan.bind(executor)
      ;(executor as any).executeMicroplan = async function (mp: any) {
        if (mp.id === 'MP-1') {
          this.emit('microplan:start', { microplanId: mp.id })
          throw new Error('Simulated failure')
        }
        return originalExecute(mp)
      }

      const doc: MicroplansDocument = {
        task: 'Test task',
        microplans: [
          {
            id: 'MP-1',
            goal: 'First',
            depends_on: [],
            files: [],
            verify: 'test',
          },
          {
            id: 'MP-2',
            goal: 'Second',
            depends_on: ['MP-1'],
            files: [],
            verify: 'test',
          },
        ],
      }

      await executor.execute(doc)

      expect(events).toContain('start:MP-1')
      expect(events).toContain('error:MP-1')
      expect(events).toContain('skipped:MP-2:dependency failed')
    })
  })

  describe('Parallel batch execution', () => {
    it('should execute microplans in same batch in parallel', async () => {
      const executionOrder: string[] = []
      const startTimes: Record<string, number> = {}
      const endTimes: Record<string, number> = {}

      executor.on('microplan:start', ({ microplanId }) => {
        startTimes[microplanId] = Date.now()
        executionOrder.push(`start:${microplanId}`)
      })

      executor.on('microplan:complete', ({ microplanId }) => {
        endTimes[microplanId] = Date.now()
        executionOrder.push(`complete:${microplanId}`)
      })

      const doc: MicroplansDocument = {
        task: 'Test task',
        microplans: [
          {
            id: 'MP-1',
            goal: 'Root',
            depends_on: [],
            files: [],
            verify: 'test',
          },
          {
            id: 'MP-2',
            goal: 'Branch A',
            depends_on: ['MP-1'],
            files: [],
            verify: 'test',
          },
          {
            id: 'MP-3',
            goal: 'Branch B',
            depends_on: ['MP-1'],
            files: [],
            verify: 'test',
          },
        ],
      }

      await executor.execute(doc)

      // MP-1 should complete before MP-2 and MP-3 start
      expect(endTimes['MP-1']).toBeLessThanOrEqual(startTimes['MP-2']!)
      expect(endTimes['MP-1']).toBeLessThanOrEqual(startTimes['MP-3']!)

      // MP-2 and MP-3 should start around the same time (parallel)
      const timeDiff = Math.abs(startTimes['MP-2']! - startTimes['MP-3']!)
      expect(timeDiff).toBeLessThan(50) // Allow 50ms tolerance
    })
  })

  describe('Stop on error', () => {
    it('should skip all dependents when a microplan fails', async () => {
      const events: string[] = []

      executor.on('microplan:start', ({ microplanId }) => {
        events.push(`start:${microplanId}`)
      })

      executor.on('microplan:complete', ({ microplanId }) => {
        events.push(`complete:${microplanId}`)
      })

      executor.on('microplan:error', ({ microplanId }) => {
        events.push(`error:${microplanId}`)
      })

      executor.on('microplan:skipped', ({ microplanId }) => {
        events.push(`skipped:${microplanId}`)
      })

      // Override executeMicroplan to simulate failure on MP-1
      const originalExecute = (executor as any).executeMicroplan.bind(executor)
      ;(executor as any).executeMicroplan = async function (mp: any) {
        if (mp.id === 'MP-1') {
          this.emit('microplan:start', { microplanId: mp.id })
          throw new Error('Simulated failure')
        }
        return originalExecute(mp)
      }

      const doc: MicroplansDocument = {
        task: 'Test task',
        microplans: [
          {
            id: 'MP-1',
            goal: 'First',
            depends_on: [],
            files: [],
            verify: 'test',
          },
          {
            id: 'MP-2',
            goal: 'Second',
            depends_on: ['MP-1'],
            files: [],
            verify: 'test',
          },
          {
            id: 'MP-3',
            goal: 'Third',
            depends_on: ['MP-2'],
            files: [],
            verify: 'test',
          },
        ],
      }

      await executor.execute(doc)

      // MP-1 should fail
      expect(events).toContain('start:MP-1')
      expect(events).toContain('error:MP-1')

      // MP-2 should be skipped (depends on MP-1)
      expect(events).toContain('skipped:MP-2')

      // MP-3 should be skipped (depends on MP-2)
      expect(events).toContain('skipped:MP-3')

      // MP-2 and MP-3 should NOT complete
      expect(events).not.toContain('complete:MP-2')
      expect(events).not.toContain('complete:MP-3')
    })

    it('should continue execution of independent branches when one fails', async () => {
      const events: string[] = []

      executor.on('microplan:start', ({ microplanId }) => {
        events.push(`start:${microplanId}`)
      })

      executor.on('microplan:complete', ({ microplanId }) => {
        events.push(`complete:${microplanId}`)
      })

      executor.on('microplan:error', ({ microplanId }) => {
        events.push(`error:${microplanId}`)
      })

      executor.on('microplan:skipped', ({ microplanId }) => {
        events.push(`skipped:${microplanId}`)
      })

      // Override executeMicroplan to simulate failure on MP-2
      const originalExecute = (executor as any).executeMicroplan.bind(executor)
      ;(executor as any).executeMicroplan = async function (mp: any) {
        if (mp.id === 'MP-2') {
          this.emit('microplan:start', { microplanId: mp.id })
          throw new Error('Simulated failure')
        }
        return originalExecute(mp)
      }

      const doc: MicroplansDocument = {
        task: 'Test task',
        microplans: [
          {
            id: 'MP-1',
            goal: 'Root',
            depends_on: [],
            files: [],
            verify: 'test',
          },
          {
            id: 'MP-2',
            goal: 'Branch A',
            depends_on: ['MP-1'],
            files: [],
            verify: 'test',
          },
          {
            id: 'MP-3',
            goal: 'Branch B',
            depends_on: ['MP-1'],
            files: [],
            verify: 'test',
          },
        ],
      }

      await executor.execute(doc)

      // MP-1 should complete
      expect(events).toContain('start:MP-1')
      expect(events).toContain('complete:MP-1')

      // MP-2 should fail
      expect(events).toContain('start:MP-2')
      expect(events).toContain('error:MP-2')

      // MP-3 should complete (independent of MP-2)
      expect(events).toContain('start:MP-3')
      expect(events).toContain('complete:MP-3')
    })
  })

  describe('Edge cases', () => {
    it('should handle empty microplans array', async () => {
      const doc: MicroplansDocument = {
        task: 'Empty task',
        microplans: [],
      }

      await expect(executor.execute(doc)).resolves.toBeUndefined()
    })
  })
})
