/**
 * AgentPromptAssembler — Unit Tests
 *
 * Tests the assembleForSubstep method that filters prompts by step + name prefix.
 * This enables substep-level prompt assembly (e.g., discovery vs planner within step 1).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ─── Mocks ─────────────────────────────────────────────────────────────────

const mockFindMany = vi.fn()

vi.mock('../../src/db/client.js', () => ({
  prisma: {
    promptInstruction: {
      findMany: mockFindMany,
    },
  },
}))

import { AgentPromptAssembler } from '../../src/services/AgentPromptAssembler.js'

// ─── Helpers ───────────────────────────────────────────────────────────────

function createAssembler() {
  const fakePrisma = {
    promptInstruction: {
      findMany: mockFindMany,
    },
  }
  return new AgentPromptAssembler(fakePrisma as any)
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('AgentPromptAssembler', () => {
  let assembler: AgentPromptAssembler

  beforeEach(() => {
    assembler = createAssembler()
    vi.clearAllMocks()
  })

  // ── assembleForSubstep ───────────────────────────────────────────────

  describe('assembleForSubstep', () => {
    it('should filter prompts by step=1 and name.startsWith("discovery-")', async () => {
      mockFindMany.mockResolvedValueOnce([
        { name: 'discovery-core', content: 'Discovery system prompt', order: 0 },
        { name: 'discovery-tools', content: 'Tool instructions', order: 1 },
      ])

      const result = await assembler.assembleForSubstep(1, 'discovery-')

      expect(mockFindMany).toHaveBeenCalledWith({
        where: {
          step: 1,
          role: 'system',
          isActive: true,
          name: { startsWith: 'discovery-' },
        },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
      })

      expect(result).toBe('Discovery system prompt\n\nTool instructions')
    })

    it('should filter prompts by step=1 and name.startsWith("planner-")', async () => {
      mockFindMany.mockResolvedValueOnce([
        { name: 'planner-core', content: 'Planner system prompt', order: 0 },
        { name: 'planner-guidance', content: 'Planning guidance', order: 1 },
      ])

      const result = await assembler.assembleForSubstep(1, 'planner-')

      expect(mockFindMany).toHaveBeenCalledWith({
        where: {
          step: 1,
          role: 'system',
          isActive: true,
          name: { startsWith: 'planner-' },
        },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
      })

      expect(result).toBe('Planner system prompt\n\nPlanning guidance')
    })

    it('should throw error if no prompts found for step+prefix', async () => {
      mockFindMany.mockResolvedValueOnce([])

      await expect(
        assembler.assembleForSubstep(1, 'nonexistent-')
      ).rejects.toThrow(/No prompt content configured for step 1 with prefix "nonexistent-"/)
    })

    it('should maintain ordering by order asc, then name asc', async () => {
      // Mock returns items already sorted by Prisma (order asc, then name asc)
      mockFindMany.mockResolvedValueOnce([
        { name: 'discovery-core', content: 'Core', order: 0 },
        { name: 'discovery-alpha', content: 'Alpha', order: 1 },
        { name: 'discovery-beta', content: 'Beta', order: 1 },
      ])

      const result = await assembler.assembleForSubstep(1, 'discovery-')

      // order=0 first, then order=1 (sorted by name: alpha, beta)
      expect(result).toBe('Core\n\nAlpha\n\nBeta')
    })

    it('should throw error if prompts exist but assembled to empty string', async () => {
      mockFindMany.mockResolvedValueOnce([
        { name: 'discovery-empty', content: '', order: 0 },
      ])

      await expect(
        assembler.assembleForSubstep(1, 'discovery-')
      ).rejects.toThrow(/assembled to empty string/)
    })

    it('should only select active prompts', async () => {
      mockFindMany.mockResolvedValueOnce([
        { name: 'discovery-active', content: 'Active prompt', order: 0 },
      ])

      await assembler.assembleForSubstep(1, 'discovery-')

      expect(mockFindMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          isActive: true,
        }),
        orderBy: expect.any(Array),
      })
    })

    it('should only select role=system prompts', async () => {
      mockFindMany.mockResolvedValueOnce([
        { name: 'discovery-core', content: 'System prompt', order: 0 },
      ])

      await assembler.assembleForSubstep(1, 'discovery-')

      expect(mockFindMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          role: 'system',
        }),
        orderBy: expect.any(Array),
      })
    })
  })
})
