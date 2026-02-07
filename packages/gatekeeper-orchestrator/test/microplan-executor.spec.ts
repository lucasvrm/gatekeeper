/**
 * Tests for MicroplanExecutor - Topological Sort
 */

import { describe, it, expect } from 'vitest'
import { MicroplanExecutor } from '../src/microplan-executor.js'
import type { Microplan } from '../src/types.js'

describe('MicroplanExecutor - Topological Sort', () => {
  const executor = new MicroplanExecutor()

  describe('Sequential execution', () => {
    it('should return single batch for independent microplans', () => {
      const microplans: Microplan[] = [
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
          depends_on: [],
          files: [],
          verify: 'test',
        },
      ]

      const batches = executor.topologicalSort(microplans)

      expect(batches).toHaveLength(1)
      expect(batches[0]).toHaveLength(2)
      expect(batches[0].map(mp => mp.id)).toContain('MP-1')
      expect(batches[0].map(mp => mp.id)).toContain('MP-2')
    })

    it('should return sequential batches for linear dependencies', () => {
      const microplans: Microplan[] = [
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
      ]

      const batches = executor.topologicalSort(microplans)

      expect(batches).toHaveLength(3)
      expect(batches[0]).toHaveLength(1)
      expect(batches[0][0].id).toBe('MP-1')
      expect(batches[1][0].id).toBe('MP-2')
      expect(batches[2][0].id).toBe('MP-3')
    })
  })

  describe('Parallel execution', () => {
    it('should batch microplans with same dependency level', () => {
      const microplans: Microplan[] = [
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
        {
          id: 'MP-4',
          goal: 'Merge',
          depends_on: ['MP-2', 'MP-3'],
          files: [],
          verify: 'test',
        },
      ]

      const batches = executor.topologicalSort(microplans)

      expect(batches).toHaveLength(3)
      expect(batches[0]).toHaveLength(1)
      expect(batches[0][0].id).toBe('MP-1')
      expect(batches[1]).toHaveLength(2)
      expect(batches[1].map(mp => mp.id)).toContain('MP-2')
      expect(batches[1].map(mp => mp.id)).toContain('MP-3')
      expect(batches[2]).toHaveLength(1)
      expect(batches[2][0].id).toBe('MP-4')
    })
  })

  describe('Cycle detection', () => {
    it('should throw error on direct circular dependency', () => {
      const microplans: Microplan[] = [
        {
          id: 'MP-1',
          goal: 'First',
          depends_on: ['MP-2'],
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
      ]

      expect(() => executor.topologicalSort(microplans)).toThrow(
        /Circular dependency detected/
      )
    })

    it('should throw error on indirect circular dependency', () => {
      const microplans: Microplan[] = [
        {
          id: 'MP-1',
          goal: 'First',
          depends_on: ['MP-3'],
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
      ]

      expect(() => executor.topologicalSort(microplans)).toThrow(
        /Circular dependency detected/
      )
    })

    it('should throw error on self-reference', () => {
      const microplans: Microplan[] = [
        {
          id: 'MP-1',
          goal: 'First',
          depends_on: ['MP-1'],
          files: [],
          verify: 'test',
        },
      ]

      expect(() => executor.topologicalSort(microplans)).toThrow(
        /Circular dependency detected/
      )
    })
  })

  describe('Missing dependency detection', () => {
    it('should throw error when dependency does not exist', () => {
      const microplans: Microplan[] = [
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
          depends_on: ['MP-999'],
          files: [],
          verify: 'test',
        },
      ]

      expect(() => executor.topologicalSort(microplans)).toThrow(
        'Microplan MP-2 depends on missing microplan MP-999'
      )
    })

    it('should throw error when multiple dependencies are missing', () => {
      const microplans: Microplan[] = [
        {
          id: 'MP-1',
          goal: 'First',
          depends_on: ['MP-999', 'MP-888'],
          files: [],
          verify: 'test',
        },
      ]

      expect(() => executor.topologicalSort(microplans)).toThrow(/missing microplan/)
    })
  })

  describe('Edge cases', () => {
    it('should handle empty microplans array', () => {
      const batches = executor.topologicalSort([])
      expect(batches).toEqual([])
    })

    it('should handle single microplan', () => {
      const microplans: Microplan[] = [
        {
          id: 'MP-1',
          goal: 'Single',
          depends_on: [],
          files: [],
          verify: 'test',
        },
      ]

      const batches = executor.topologicalSort(microplans)

      expect(batches).toHaveLength(1)
      expect(batches[0]).toHaveLength(1)
      expect(batches[0][0].id).toBe('MP-1')
    })
  })
})
