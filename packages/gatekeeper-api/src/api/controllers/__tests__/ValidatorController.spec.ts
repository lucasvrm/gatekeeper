import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ValidatorController } from '../ValidatorController.js'

/**
 * Contract: validator-metadata-consistency
 * 
 * Objetivo: Garantir que /api/validators e /api/gates/{n}/validators
 * retornem metadados idênticos, usando GATES_CONFIG como fonte única de verdade.
 * 
 * IMPORTANTE: Este teste valida que ValidatorController.listValidators
 * usa GATES_CONFIG diretamente ao invés de prisma.validatorMetadata.
 */

// Tipos inline para Request/Response (evita dependência de @types/express)
interface Request {
  params?: Record<string, string>
  body?: any
  query?: any
}

interface Response {
  json: (data: any) => void
  status: (code: number) => Response
}

// Mock do prisma client
const mockPrisma = vi.hoisted(() => ({
  validationConfig: {
    findMany: vi.fn(),
  },
  validatorMetadata: {
    findMany: vi.fn(),
  },
}))

// Mock do GATES_CONFIG inline para evitar dependências externas durante validação
const mockGatesConfig = vi.hoisted(() => [
  {
    number: 0,
    name: 'SANITIZATION',
    emoji: '🧹',
    description: 'Validação de entrada e escopo',
    validators: [
      {
        code: 'TOKEN_BUDGET_FIT',
        name: 'Token Budget Fit',
        description: 'Verifica se o contexto cabe na janela da LLM com folga',
        gate: 0,
        order: 1,
        isHardBlock: true,
      },
      {
        code: 'TASK_SCOPE_SIZE',
        name: 'Task Scope Size',
        description: 'Valida que o escopo da task está dentro de limites razoáveis',
        gate: 0,
        order: 2,
        isHardBlock: true,
      },
    ],
  },
  {
    number: 1,
    name: 'CONTRACT',
    emoji: '📜',
    description: 'Validação de contrato e testes',
    validators: [
      {
        code: 'TEST_SYNTAX_VALID',
        name: 'Test Syntax Valid',
        description: 'Verifica se os testes têm sintaxe TypeScript válida',
        gate: 1,
        order: 1,
        isHardBlock: true,
      },
    ],
  },
  {
    number: 2,
    name: 'EXECUTION',
    emoji: '⚙️',
    description: 'Validação de execução e compilação',
    validators: [
      {
        code: 'TASK_TEST_PASSES',
        name: 'Task Test Passes',
        description: 'Executa os testes da task e verifica aprovação',
        gate: 2,
        order: 1,
        isHardBlock: true,
      },
    ],
  },
  {
    number: 3,
    name: 'INTEGRITY',
    emoji: '🏗️',
    description: 'Validação de integridade final',
    validators: [
      {
        code: 'FULL_REGRESSION_PASS',
        name: 'Full Regression Pass',
        description: 'Executa suite completa de testes de regressão',
        gate: 3,
        order: 1,
        isHardBlock: true,
      },
    ],
  },
])

// Mock dos módulos antes de importar o controller
vi.mock('../../../db/client.js', () => ({
  prisma: mockPrisma,
}))

vi.mock('../../../config/gates.config.js', () => ({
  GATES_CONFIG: mockGatesConfig,
}))

describe('ValidatorController - Metadata Consistency', () => {
  let controller: ValidatorController
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let jsonSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    controller = new ValidatorController()
    mockReq = {}
    jsonSpy = vi.fn()
    mockRes = {
      json: jsonSpy,
      status: vi.fn().mockReturnThis(),
    }

    // Reset mocks
    vi.clearAllMocks()

    // Setup default mock behavior - validators ativos no banco
    mockPrisma.validationConfig.findMany.mockResolvedValue([
      {
        key: 'TOKEN_BUDGET_FIT',
        category: 'VALIDATOR',
        value: 'true',
        failMode: 'HARD',
      },
      {
        key: 'TASK_SCOPE_SIZE',
        category: 'VALIDATOR',
        value: 'true',
        failMode: null,
      },
      {
        key: 'TEST_SYNTAX_VALID',
        category: 'VALIDATOR',
        value: 'false',
        failMode: 'WARNING',
      },
      {
        key: 'TASK_TEST_PASSES',
        category: 'VALIDATOR',
        value: 'true',
        failMode: null,
      },
      {
        key: 'FULL_REGRESSION_PASS',
        category: 'VALIDATOR',
        value: 'true',
        failMode: 'HARD',
      },
    ])

    // Setup empty validatorMetadata - simula tabela vazia/não sincronizada
    mockPrisma.validatorMetadata.findMany.mockResolvedValue([])
  })

  describe('Metadata Source Consistency', () => {
    // @clause CL-VAL-CONS-001
    it('succeeds when displayName comes from GATES_CONFIG name field', async () => {
      await controller.listValidators(mockReq as Request, mockRes as Response)

      const response = jsonSpy.mock.calls[0][0]
      const tokenBudget = response.find((v: any) => v.key === 'TOKEN_BUDGET_FIT')
      
      expect(tokenBudget).toBeDefined()
      expect(tokenBudget.displayName).toBe('Token Budget Fit')
      
      // Verifica que não está usando fallback para key técnica
      expect(tokenBudget.displayName).not.toBe('TOKEN_BUDGET_FIT')
    })

    // @clause CL-VAL-CONS-002
    it('succeeds when description comes from GATES_CONFIG and is non-empty', async () => {
      await controller.listValidators(mockReq as Request, mockRes as Response)

      const response = jsonSpy.mock.calls[0][0]
      
      // Verifica que todas as descriptions estão presentes e não vazias
      response.forEach((validator: any) => {
        expect(validator.description).toBeTruthy()
        expect(validator.description.length).toBeGreaterThan(0)
      })

      // Verifica conteúdo específico para TOKEN_BUDGET_FIT
      const tokenBudget = response.find((v: any) => v.key === 'TOKEN_BUDGET_FIT')
      expect(tokenBudget.description).toContain('contexto')
      expect(tokenBudget.description).toContain('janela')
    })

    // @clause CL-VAL-CONS-003
    it('succeeds when structural metadata (gate, order, isHardBlock) are present with correct types', async () => {
      await controller.listValidators(mockReq as Request, mockRes as Response)

      const response = jsonSpy.mock.calls[0][0]
      
      response.forEach((validator: any) => {
        // gate deve ser número entre 0-3
        expect(typeof validator.gate).toBe('number')
        expect(validator.gate).toBeGreaterThanOrEqual(0)
        expect(validator.gate).toBeLessThanOrEqual(3)

        // order deve ser número >= 1
        expect(typeof validator.order).toBe('number')
        expect(validator.order).toBeGreaterThanOrEqual(1)

        // isHardBlock deve ser boolean
        expect(typeof validator.isHardBlock).toBe('boolean')
      })
    })

    // @clause CL-VAL-CONS-004
    it('succeeds when validator metadata matches between endpoints', async () => {
      await controller.listValidators(mockReq as Request, mockRes as Response)

      const response = jsonSpy.mock.calls[0][0]
      
      // Simula resposta do endpoint /api/gates/0/validators
      const gate0FromGatesEndpoint = mockGatesConfig[0].validators.map(v => ({
        code: v.code,
        name: v.name,
        description: v.description,
        order: v.order,
        isHardBlock: v.isHardBlock,
      }))

      // Filtra validators do gate 0 da resposta de /api/validators
      const gate0FromValidatorsEndpoint = response
        .filter((v: any) => v.gate === 0)
        .map((v: any) => ({
          code: v.key,
          name: v.displayName,
          description: v.description,
          order: v.order,
          isHardBlock: v.isHardBlock,
        }))

      // Verifica que os metadados são idênticos
      expect(gate0FromValidatorsEndpoint).toHaveLength(gate0FromGatesEndpoint.length)
      
      gate0FromGatesEndpoint.forEach(gateValidator => {
        const matchingValidator = gate0FromValidatorsEndpoint.find(
          (v: any) => v.code === gateValidator.code
        )
        
        expect(matchingValidator).toBeDefined()
        expect(matchingValidator.name).toBe(gateValidator.name)
        expect(matchingValidator.description).toBe(gateValidator.description)
        expect(matchingValidator.order).toBe(gateValidator.order)
        expect(matchingValidator.isHardBlock).toBe(gateValidator.isHardBlock)
      })
    })

    // @clause CL-VAL-CONS-005
    it('succeeds when ValidatorMetadata table is empty and still returns correct metadata', async () => {
      // ValidatorMetadata já está vazio no beforeEach
      await controller.listValidators(mockReq as Request, mockRes as Response)

      const response = jsonSpy.mock.calls[0][0]
      
      // Verifica que todos os campos estão preenchidos corretamente
      response.forEach((validator: any) => {
        expect(validator.displayName).toBeTruthy()
        expect(validator.description).toBeTruthy()
        expect(validator.gate).not.toBeNull()
        expect(validator.order).not.toBeNull()
        expect(typeof validator.isHardBlock).toBe('boolean')
      })

      // Verifica especificamente que não usou fallback para key técnica
      const tokenBudget = response.find((v: any) => v.key === 'TOKEN_BUDGET_FIT')
      expect(tokenBudget.displayName).toBe('Token Budget Fit')
      expect(tokenBudget.displayName).not.toBe(tokenBudget.key)
    })
  })

  describe('Database Fields Preservation', () => {
    // @clause CL-VAL-CONS-006
    it('succeeds when maintaining database configuration fields (value, failMode, key)', async () => {
      await controller.listValidators(mockReq as Request, mockRes as Response)

      const response = jsonSpy.mock.calls[0][0]
      
      // Verifica TOKEN_BUDGET_FIT
      const tokenBudget = response.find((v: any) => v.key === 'TOKEN_BUDGET_FIT')
      expect(tokenBudget.key).toBe('TOKEN_BUDGET_FIT')
      expect(tokenBudget.value).toBe('true')
      expect(tokenBudget.failMode).toBe('HARD')

      // Verifica TEST_SYNTAX_VALID (inativo)
      const testSyntax = response.find((v: any) => v.key === 'TEST_SYNTAX_VALID')
      expect(testSyntax.key).toBe('TEST_SYNTAX_VALID')
      expect(testSyntax.value).toBe('false')
      expect(testSyntax.failMode).toBe('WARNING')

      // Verifica TASK_SCOPE_SIZE (sem failMode)
      const taskScope = response.find((v: any) => v.key === 'TASK_SCOPE_SIZE')
      expect(taskScope.key).toBe('TASK_SCOPE_SIZE')
      expect(taskScope.value).toBe('true')
      expect(taskScope.failMode).toBeNull()
    })
  })

  describe('Gate Category Mapping', () => {
    // @clause CL-VAL-CONS-007
    it('succeeds when gateCategory reflects readable gate names', async () => {
      await controller.listValidators(mockReq as Request, mockRes as Response)

      const response = jsonSpy.mock.calls[0][0]
      
      const gateCategoryMapping = {
        0: 'Sanitização',
        1: 'Contratos/Testes',
        2: 'Execução',
        3: 'Integridade',
      }

      // Verifica cada gate
      Object.entries(gateCategoryMapping).forEach(([gateNum, expectedCategory]) => {
        const validatorsInGate = response.filter((v: any) => v.gate === parseInt(gateNum))
        
        validatorsInGate.forEach((validator: any) => {
          expect(validator.gateCategory).toBe(expectedCategory)
        })
      })

      // Verifica casos específicos
      const tokenBudget = response.find((v: any) => v.key === 'TOKEN_BUDGET_FIT')
      expect(tokenBudget.gateCategory).toBe('Sanitização')

      const testSyntax = response.find((v: any) => v.key === 'TEST_SYNTAX_VALID')
      expect(testSyntax.gateCategory).toBe('Contratos/Testes')

      const taskTest = response.find((v: any) => v.key === 'TASK_TEST_PASSES')
      expect(taskTest.gateCategory).toBe('Execução')

      const regression = response.find((v: any) => v.key === 'FULL_REGRESSION_PASS')
      expect(regression.gateCategory).toBe('Integridade')
    })
  })

  describe('Integration Scenarios', () => {
    // @clause CL-VAL-CONS-004
    it('succeeds when handling validators across all gates consistently', async () => {
      await controller.listValidators(mockReq as Request, mockRes as Response)

      const response = jsonSpy.mock.calls[0][0]
      
      // Verifica que todos os validators de GATES_CONFIG estão presentes
      const expectedValidatorCodes = mockGatesConfig.flatMap(gate => 
        gate.validators.map(v => v.code)
      )
      
      const returnedValidatorCodes = response.map((v: any) => v.key)
      
      expectedValidatorCodes.forEach(expectedCode => {
        expect(returnedValidatorCodes).toContain(expectedCode)
      })

      // Verifica integridade estrutural de cada validator
      response.forEach((validator: any) => {
        // Campos do banco
        expect(validator.key).toBeTruthy()
        expect(['true', 'false']).toContain(validator.value)
        expect([null, 'HARD', 'WARNING']).toContain(validator.failMode)

        // Campos de GATES_CONFIG
        expect(validator.displayName).toBeTruthy()
        expect(validator.description).toBeTruthy()
        expect(typeof validator.gate).toBe('number')
        expect(typeof validator.order).toBe('number')
        expect(typeof validator.isHardBlock).toBe('boolean')
        expect(validator.gateCategory).toBeTruthy()

        // Validações de consistência
        expect(validator.displayName).not.toBe(validator.key) // Sem fallback
        expect(validator.description.length).toBeGreaterThan(10) // Descrição substancial
      })
    })
  })
})
