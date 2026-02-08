import { describe, it, expect } from 'vitest'
import { ArtifactValidationService } from '../../src/services/ArtifactValidationService.js'

describe('ArtifactValidationService', () => {
  const validator = new ArtifactValidationService()

  describe('validateTestFile', () => {
    it('should reject invalid filename pattern', () => {
      const result = validator.validateTestFile('notATest.ts', 'test content')
      expect(result.valid).toBe(false)
      expect(result.details.issues).toContainEqual(
        expect.objectContaining({ field: 'filename', severity: 'error' })
      )
    })

    it('should reject empty content', () => {
      const result = validator.validateTestFile('test.spec.ts', '')
      expect(result.valid).toBe(false)
      expect(result.details.issues).toContainEqual(
        expect.objectContaining({ field: 'content', severity: 'error' })
      )
    })

    it('should reject very short content', () => {
      const result = validator.validateTestFile('test.spec.ts', 'short')
      expect(result.valid).toBe(false)
    })

    it('should warn if no test blocks', () => {
      const result = validator.validateTestFile(
        'test.spec.ts',
        'const foo = "bar"; // no test blocks'
      )
      expect(result.valid).toBe(true)
      expect(result.severity).toBe('warning')
      expect(result.details.issues).toContainEqual(
        expect.objectContaining({ field: 'content', severity: 'warning' })
      )
    })

    it('should warn if no expect calls', () => {
      const result = validator.validateTestFile(
        'test.spec.ts',
        'describe("test", () => { it("works", () => {}) })'
      )
      expect(result.valid).toBe(true)
      expect(result.severity).toBe('warning')
    })

    it('should pass valid test file with describe and expect', () => {
      const result = validator.validateTestFile(
        'test.spec.ts',
        'describe("test", () => { it("works", () => { expect(1).toBe(1) }) })'
      )
      expect(result.valid).toBe(true)
      expect(result.severity).toBe('success')
    })

    it('should accept .spec.ts extension', () => {
      const result = validator.validateTestFile('foo.spec.ts', 'describe("test", () => { expect(1).toBe(1) })')
      expect(result.valid).toBe(true)
    })

    it('should accept .test.ts extension', () => {
      const result = validator.validateTestFile('foo.test.ts', 'test("works", () => { expect(1).toBe(1) })')
      expect(result.valid).toBe(true)
    })

    it('should accept .spec.tsx extension', () => {
      const result = validator.validateTestFile('foo.spec.tsx', 'it("renders", () => { expect(true).toBe(true) })')
      expect(result.valid).toBe(true)
    })

    it('should accept .test.js extension', () => {
      const result = validator.validateTestFile('foo.test.js', 'test("works", () => { expect(1).toBe(1) })')
      expect(result.valid).toBe(true)
    })
  })

  describe('validateMicroplansJson', () => {
    it('should reject non-parseable JSON', () => {
      const result = validator.validateMicroplansJson('{ invalid json }')
      expect(result.valid).toBe(false)
      expect(result.severity).toBe('error')
      expect(result.message).toContain('JSON não parseável')
    })

    it('should reject without task field', () => {
      const result = validator.validateMicroplansJson('{"microplans":[]}')
      expect(result.valid).toBe(false)
      expect(result.details.issues).toContainEqual(
        expect.objectContaining({ field: 'task', severity: 'error' })
      )
    })

    it('should reject empty task', () => {
      const result = validator.validateMicroplansJson('{"task":"","microplans":[]}')
      expect(result.valid).toBe(false)
      expect(result.details.issues).toContainEqual(
        expect.objectContaining({ field: 'task', severity: 'error' })
      )
    })

    it('should reject without microplans field', () => {
      const result = validator.validateMicroplansJson('{"task":"Some task"}')
      expect(result.valid).toBe(false)
      expect(result.details.issues).toContainEqual(
        expect.objectContaining({ field: 'microplans', severity: 'error' })
      )
    })

    it('should reject empty microplans array', () => {
      const result = validator.validateMicroplansJson('{"task":"Some task","microplans":[]}')
      expect(result.valid).toBe(false)
      expect(result.details.issues).toContainEqual(
        expect.objectContaining({ field: 'microplans', severity: 'error' })
      )
    })

    it('should reject microplan without id', () => {
      const result = validator.validateMicroplansJson(
        '{"task":"Task","microplans":[{"goal":"Goal","files":[]}]}'
      )
      expect(result.valid).toBe(true)
      expect(result.severity).toBe('warning')
      expect(result.details.issues).toContainEqual(
        expect.objectContaining({ field: expect.stringContaining('id'), severity: 'warning' })
      )
    })

    it('should reject microplan without files array', () => {
      const result = validator.validateMicroplansJson(
        '{"task":"Task","microplans":[{"id":"MP-1","goal":"Goal"}]}'
      )
      expect(result.valid).toBe(true)
      expect(result.severity).toBe('warning')
      expect(result.details.issues).toContainEqual(
        expect.objectContaining({ field: expect.stringContaining('files'), severity: 'warning' })
      )
    })

    it('should accept valid microplans document', () => {
      const result = validator.validateMicroplansJson(
        '{"task":"Implement feature","microplans":[{"id":"MP-1","goal":"Create component","files":[{"path":"src/component.ts","action":"CREATE"}]}]}'
      )
      expect(result.valid).toBe(true)
      expect(result.severity).toBe('success')
    })
  })

  describe('validateStepArtifacts', () => {
    describe('Step 1 (Plan)', () => {
      it('should reject if microplans.json missing', () => {
        const artifacts = new Map([
          ['other-file.md', '# Some content'],
        ])
        const result = validator.validateStepArtifacts(1, artifacts)
        expect(result.valid).toBe(false)
        expect(result.results).toContainEqual(
          expect.objectContaining({
            valid: false,
            details: expect.objectContaining({ filename: 'microplans.json' })
          })
        )
      })

      it('should reject if microplans.json is invalid JSON', () => {
        const artifacts = new Map([
          ['microplans.json', '{ invalid json }'],
        ])
        const result = validator.validateStepArtifacts(1, artifacts)
        expect(result.valid).toBe(false)
        expect(result.results).toContainEqual(
          expect.objectContaining({
            valid: false,
            details: expect.objectContaining({ filename: 'microplans.json' })
          })
        )
      })

      it('should reject if microplans.json missing task field', () => {
        const artifacts = new Map([
          ['microplans.json', '{"microplans":[]}'],
        ])
        const result = validator.validateStepArtifacts(1, artifacts)
        expect(result.valid).toBe(false)
        expect(result.results).toContainEqual(
          expect.objectContaining({
            valid: false,
            details: expect.objectContaining({ filename: 'microplans.json' })
          })
        )
      })

      it('should reject if microplans.json missing microplans array', () => {
        const artifacts = new Map([
          ['microplans.json', '{"task":"Some task"}'],
        ])
        const result = validator.validateStepArtifacts(1, artifacts)
        expect(result.valid).toBe(false)
        expect(result.results).toContainEqual(
          expect.objectContaining({
            valid: false,
            details: expect.objectContaining({ filename: 'microplans.json' })
          })
        )
      })

      it('should reject if microplans.json has empty microplans array', () => {
        const artifacts = new Map([
          ['microplans.json', '{"task":"Some task","microplans":[]}'],
        ])
        const result = validator.validateStepArtifacts(1, artifacts)
        expect(result.valid).toBe(false)
        expect(result.results).toContainEqual(
          expect.objectContaining({
            valid: false,
            details: expect.objectContaining({ filename: 'microplans.json' })
          })
        )
      })

      it('should accept valid microplans.json', () => {
        const artifacts = new Map([
          ['microplans.json', '{"task":"Implement feature","microplans":[{"id":"MP-1","goal":"Create component","files":[{"path":"src/component.ts","action":"CREATE"}]}]}'],
        ])
        const result = validator.validateStepArtifacts(1, artifacts)
        expect(result.valid).toBe(true)
      })
    })

    describe('Step 2 (Spec)', () => {
      it('should reject if no test file', () => {
        const artifacts = new Map([
          ['some-other-file.md', 'content'],
        ])
        const result = validator.validateStepArtifacts(2, artifacts)
        expect(result.valid).toBe(false)
        expect(result.results).toContainEqual(
          expect.objectContaining({
            valid: false,
            message: expect.stringContaining('Nenhum arquivo de teste')
          })
        )
      })

      it('should accept valid test file', () => {
        const artifacts = new Map([
          ['test.spec.ts', 'describe("test", () => { it("works", () => { expect(1).toBe(1) }) })'],
        ])
        const result = validator.validateStepArtifacts(2, artifacts)
        expect(result.valid).toBe(true)
      })

      it('should accept multiple test files', () => {
        const artifacts = new Map([
          ['foo.spec.ts', 'describe("foo", () => { expect(1).toBe(1) })'],
          ['bar.test.ts', 'test("bar", () => { expect(2).toBe(2) })'],
        ])
        const result = validator.validateStepArtifacts(2, artifacts)
        expect(result.valid).toBe(true)
      })

      it('should reject if test file is invalid', () => {
        const artifacts = new Map([
          ['test.spec.ts', ''], // empty content
        ])
        const result = validator.validateStepArtifacts(2, artifacts)
        expect(result.valid).toBe(false)
      })
    })

    describe('Step 3 and 4 (Validation/Execution)', () => {
      it('should pass for step 3 (less strict)', () => {
        const artifacts = new Map()
        const result = validator.validateStepArtifacts(3, artifacts)
        expect(result.valid).toBe(true)
      })

      it('should pass for step 4 (less strict)', () => {
        const artifacts = new Map()
        const result = validator.validateStepArtifacts(4, artifacts)
        expect(result.valid).toBe(true)
      })
    })
  })

  describe('validateDiscoveryArtifacts', () => {
    it('should reject when discovery_report.md is missing', () => {
      const artifacts = new Map<string, string>()
      const result = validator.validateDiscoveryArtifacts(artifacts)
      expect(result.valid).toBe(false)
      expect(result.results).toContainEqual(
        expect.objectContaining({
          valid: false,
          details: expect.objectContaining({ filename: 'discovery_report.md' }),
        })
      )
    })

    it('should reject when discovery_report.md is too short', () => {
      const artifacts = new Map<string, string>([
        ['discovery_report.md', 'too short'],
      ])
      const result = validator.validateDiscoveryArtifacts(artifacts)
      expect(result.valid).toBe(false)
      expect(result.results[0].message).toContain('muito curto')
    })

    it('should accept discovery_report.md with sufficient content', () => {
      const longContent = 'A'.repeat(120)
      const artifacts = new Map<string, string>([
        ['discovery_report.md', longContent],
      ])
      const result = validator.validateDiscoveryArtifacts(artifacts)
      expect(result.valid).toBe(true)
      expect(result.results[0].severity).toBe('success')
    })
  })
})
