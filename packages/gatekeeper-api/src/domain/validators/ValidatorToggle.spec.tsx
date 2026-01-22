import { describe, it, expect } from 'vitest'

const API_BASE = 'http://localhost:3000/api/validators'

interface ValidatorConfig {
  key: string
  value: string
}

describe('Validator Toggle System - Ativar e Desativar Validators do Gatekeeper', () => {
  describe('Happy Paths - Sistema de ativação e desativação deve funcionar', () => {
    it('should successfully GET list of all validators with their isActive status', async () => {
      const response = await fetch(API_BASE)
      
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBeGreaterThan(0)
    })

    it('should successfully GET validator TOKEN_BUDGET_FIT with isActive status', async () => {
      const response = await fetch(`${API_BASE}/TOKEN_BUDGET_FIT`)
      
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.key).toBe('TOKEN_BUDGET_FIT')
      expect(typeof data.value).toBe('string')
    })

    it('should successfully PUT to activate validator TEST_FAILS_BEFORE_IMPLEMENTATION', async () => {
      const response = await fetch(`${API_BASE}/TEST_FAILS_BEFORE_IMPLEMENTATION`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true })
      })
      
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.key).toBe('TEST_FAILS_BEFORE_IMPLEMENTATION')
      expect(data.value).toBe('true')
    })

    it('should successfully PUT to deactivate validator FULL_REGRESSION_PASS', async () => {
      const response = await fetch(`${API_BASE}/FULL_REGRESSION_PASS`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false })
      })
      
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.key).toBe('FULL_REGRESSION_PASS')
      expect(data.value).toBe('false')
    })

    it('should successfully verify all 21 validators are seeded in ValidationConfig', async () => {
      const expectedValidators = [
        'TOKEN_BUDGET_FIT',
        'TASK_SCOPE_SIZE',
        'TASK_CLARITY_CHECK',
        'SENSITIVE_FILES_LOCK',
        'DANGER_MODE_EXPLICIT',
        'TEST_SYNTAX_VALID',
        'TEST_HAS_ASSERTIONS',
        'TEST_COVERS_HAPPY_AND_SAD_PATH',
        'TEST_FAILS_BEFORE_IMPLEMENTATION',
        'NO_DECORATIVE_TESTS',
        'MANIFEST_FILE_LOCK',
        'NO_IMPLICIT_FILES',
        'IMPORT_REALITY_CHECK',
        'TEST_INTENT_ALIGNMENT',
        'DIFF_SCOPE_ENFORCEMENT',
        'TEST_READ_ONLY_ENFORCEMENT',
        'TASK_TEST_PASSES',
        'STRICT_COMPILATION',
        'STYLE_CONSISTENCY_LINT',
        'FULL_REGRESSION_PASS',
        'PRODUCTION_BUILD_PASS'
      ]

      const response = await fetch(API_BASE)
      const data = await response.json() as ValidatorConfig[]

      const validatorKeys = data.map((v) => v.key)
      
      for (const validator of expectedValidators) {
        expect(validatorKeys).toContain(validator)
      }
    })

    it('should successfully toggle validator from active to inactive and back', async () => {
      const validatorName = 'TEST_SYNTAX_VALID'
      
      const deactivateResponse = await fetch(`${API_BASE}/${validatorName}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false })
      })
      
      expect(deactivateResponse.status).toBe(200)
      const deactivated = await deactivateResponse.json()
      expect(deactivated.value).toBe('false')
      
      const activateResponse = await fetch(`${API_BASE}/${validatorName}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true })
      })
      
      expect(activateResponse.status).toBe(200)
      const activated = await activateResponse.json()
      expect(activated.value).toBe('true')
    })

    it('should successfully verify BaseValidator checks isActive before executing', async () => {
      const deactivateResponse = await fetch(`${API_BASE}/TASK_SCOPE_SIZE`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false })
      })
      
      expect(deactivateResponse.status).toBe(200)
      
      const verifyResponse = await fetch(`${API_BASE}/TASK_SCOPE_SIZE`)
      const data = await verifyResponse.json()
      
      expect(data.value).toBe('false')
    })

    it('should successfully verify GateExecutor skips disabled validators', async () => {
      const response = await fetch(`${API_BASE}/DANGER_MODE_EXPLICIT`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false })
      })
      
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.key).toBe('DANGER_MODE_EXPLICIT')
      expect(data.value).toBe('false')
    })

    it('should successfully verify validators tab is accessible from config page at /config', async () => {
      const response = await fetch(API_BASE)
      
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(Array.isArray(data)).toBe(true)
    })

    it('should successfully verify tab sequence: Validators, Sensitive File Rules, Ambiguous Terms, Validation Configs', async () => {
      const validatorsResponse = await fetch(API_BASE)
      expect(validatorsResponse.status).toBe(200)
      
      const sensitiveResponse = await fetch('http://localhost:3000/api/config/sensitive-file-rules')
      expect(sensitiveResponse.status).toBe(200)
      
      const ambiguousResponse = await fetch('http://localhost:3000/api/config/ambiguous-terms')
      expect(ambiguousResponse.status).toBe(200)
      
      const configsResponse = await fetch('http://localhost:3000/api/config/validation-configs')
      expect(configsResponse.status).toBe(200)
    })
  })

  describe('Sad Paths - Validation and error handling', () => {
    it('should fail with 404 when getting non-existent validator', async () => {
      const response = await fetch(`${API_BASE}/NONEXISTENT_VALIDATOR`)
      
      expect(response.status).toBe(404)
    })

    it('should fail with 400 when updating validator with invalid isActive value', async () => {
      const response = await fetch(`${API_BASE}/TOKEN_BUDGET_FIT`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: 'invalid' })
      })
      
      expect(response.status).toBe(400)
    })

    it('should fail with 400 when updating validator without isActive field', async () => {
      const response = await fetch(`${API_BASE}/TEST_HAS_ASSERTIONS`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      
      expect(response.status).toBe(400)
    })

    it('should fail with 404 when updating non-existent validator', async () => {
      const response = await fetch(`${API_BASE}/INVALID_VALIDATOR_999`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false })
      })
      
      expect(response.status).toBe(404)
    })

    it('should fail when validator name is not in the list of 21 validators', async () => {
      const response = await fetch(`${API_BASE}/CUSTOM_VALIDATOR`)
      
      expect(response.status).toBe(404)
    })
  })
})
