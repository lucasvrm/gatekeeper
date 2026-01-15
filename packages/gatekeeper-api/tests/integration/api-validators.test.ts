import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '../../../src/db/client'

describe('API Endpoints - Validators', () => {
  beforeAll(async () => {
    await prisma.$connect()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe('GET /api/gates', () => {
    it('should return all gates with validator counts', async () => {
      const GATES_CONFIG = (await import('../../../src/config/gates.config')).GATES_CONFIG
      
      expect(GATES_CONFIG).toHaveLength(4)
      
      const gate0 = GATES_CONFIG[0]
      expect(gate0.number).toBe(0)
      expect(gate0.name).toBe('SANITIZATION')
      expect(gate0.validators).toHaveLength(5)
      
      const gate1 = GATES_CONFIG[1]
      expect(gate1.number).toBe(1)
      expect(gate1.name).toBe('CONTRACT')
      expect(gate1.validators).toHaveLength(9)
      
      const gate2 = GATES_CONFIG[2]
      expect(gate2.number).toBe(2)
      expect(gate2.name).toBe('EXECUTION')
      expect(gate2.validators).toHaveLength(5)
      
      const gate3 = GATES_CONFIG[3]
      expect(gate3.number).toBe(3)
      expect(gate3.name).toBe('INTEGRITY')
      expect(gate3.validators).toHaveLength(2)
    })
  })

  describe('GET /api/gates/:number/validators', () => {
    it('should return all validators for gate 1', async () => {
      const GATES_CONFIG = (await import('../../../src/config/gates.config')).GATES_CONFIG
      const gate1 = GATES_CONFIG.find(g => g.number === 1)
      
      expect(gate1).toBeDefined()
      expect(gate1!.validators).toHaveLength(9)
      
      const validatorCodes = gate1!.validators.map(v => v.code)
      expect(validatorCodes).toContain('TEST_SYNTAX_VALID')
      expect(validatorCodes).toContain('TEST_HAS_ASSERTIONS')
      expect(validatorCodes).toContain('TEST_COVERS_HAPPY_AND_SAD_PATH')
      expect(validatorCodes).toContain('TEST_FAILS_BEFORE_IMPLEMENTATION')
      expect(validatorCodes).toContain('NO_DECORATIVE_TESTS')
      expect(validatorCodes).toContain('MANIFEST_FILE_LOCK')
      expect(validatorCodes).toContain('NO_IMPLICIT_FILES')
      expect(validatorCodes).toContain('IMPORT_REALITY_CHECK')
      expect(validatorCodes).toContain('TEST_INTENT_ALIGNMENT')
    })

    it('should return all validators for gate 2', async () => {
      const GATES_CONFIG = (await import('../../../src/config/gates.config')).GATES_CONFIG
      const gate2 = GATES_CONFIG.find(g => g.number === 2)
      
      expect(gate2).toBeDefined()
      expect(gate2!.validators).toHaveLength(5)
      
      const validatorCodes = gate2!.validators.map(v => v.code)
      expect(validatorCodes).toContain('DIFF_SCOPE_ENFORCEMENT')
      expect(validatorCodes).toContain('TEST_READ_ONLY_ENFORCEMENT')
      expect(validatorCodes).toContain('TASK_TEST_PASSES')
      expect(validatorCodes).toContain('STRICT_COMPILATION')
      expect(validatorCodes).toContain('STYLE_CONSISTENCY_LINT')
    })
  })

  describe('Validator Implementation Verification', () => {
    it('should have all 21 validators implemented', async () => {
      const GATES_CONFIG = (await import('../../../src/config/gates.config')).GATES_CONFIG
      
      const totalValidators = GATES_CONFIG.reduce((sum, gate) => sum + gate.validators.length, 0)
      expect(totalValidators).toBe(21)
    })

    it('should have all validators with execute function', async () => {
      const GATES_CONFIG = (await import('../../../src/config/gates.config')).GATES_CONFIG
      
      for (const gate of GATES_CONFIG) {
        for (const validator of gate.validators) {
          expect(validator.execute).toBeTypeOf('function')
          expect(validator.code).toBeTruthy()
          expect(validator.name).toBeTruthy()
          expect(validator.description).toBeTruthy()
          expect(validator.gate).toBeGreaterThanOrEqual(0)
          expect(validator.gate).toBeLessThanOrEqual(3)
          expect(validator.order).toBeGreaterThan(0)
          expect(typeof validator.isHardBlock).toBe('boolean')
        }
      }
    })

    it('should have validators in correct order within gates', async () => {
      const GATES_CONFIG = (await import('../../../src/config/gates.config')).GATES_CONFIG
      
      for (const gate of GATES_CONFIG) {
        const orders = gate.validators.map(v => v.order)
        const sortedOrders = [...orders].sort((a, b) => a - b)
        expect(orders).toEqual(sortedOrders)
      }
    })

    it('should have unique validator codes', async () => {
      const GATES_CONFIG = (await import('../../../src/config/gates.config')).GATES_CONFIG
      
      const allCodes: string[] = []
      for (const gate of GATES_CONFIG) {
        for (const validator of gate.validators) {
          expect(allCodes).not.toContain(validator.code)
          allCodes.push(validator.code)
        }
      }
      
      expect(allCodes).toHaveLength(21)
    })

    it('should have CLAUSULA_PETREA validator as hard block', async () => {
      const GATES_CONFIG = (await import('../../../src/config/gates.config')).GATES_CONFIG
      const gate1 = GATES_CONFIG.find(g => g.number === 1)
      
      const testFailsValidator = gate1!.validators.find(v => v.code === 'TEST_FAILS_BEFORE_IMPLEMENTATION')
      expect(testFailsValidator).toBeDefined()
      expect(testFailsValidator!.isHardBlock).toBe(true)
    })

    it('should have TestIntentAlignment as soft gate', async () => {
      const GATES_CONFIG = (await import('../../../src/config/gates.config')).GATES_CONFIG
      const gate1 = GATES_CONFIG.find(g => g.number === 1)
      
      const intentValidator = gate1!.validators.find(v => v.code === 'TEST_INTENT_ALIGNMENT')
      expect(intentValidator).toBeDefined()
      expect(intentValidator!.isHardBlock).toBe(false)
    })
  })
})
