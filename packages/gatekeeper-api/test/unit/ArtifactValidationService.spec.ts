import { describe, it, expect } from 'vitest'
import { ArtifactValidationService } from '../../src/services/ArtifactValidationService.js'

describe('ArtifactValidationService', () => {
  const validator = new ArtifactValidationService()

  describe('validatePlanJson', () => {
    it('should reject non-parseable JSON', () => {
      const result = validator.validatePlanJson('{ invalid json }')
      expect(result.valid).toBe(false)
      expect(result.severity).toBe('error')
      expect(result.message).toContain('JSON não parseável')
    })

    it('should reject plan without manifest', () => {
      const result = validator.validatePlanJson('{}')
      expect(result.valid).toBe(false)
      expect(result.details.issues).toContainEqual(
        expect.objectContaining({ field: 'manifest', severity: 'error' })
      )
    })

    it('should reject plan without manifest.testFile', () => {
      const result = validator.validatePlanJson('{"manifest":{}}')
      expect(result.valid).toBe(false)
      expect(result.details.issues).toContainEqual(
        expect.objectContaining({ field: 'manifest.testFile', severity: 'error' })
      )
    })

    it('should warn if manifest.files is empty', () => {
      const result = validator.validatePlanJson(
        '{"manifest":{"testFile":"test.ts","files":[]}}'
      )
      expect(result.valid).toBe(true)
      expect(result.severity).toBe('warning')
      expect(result.details.issues).toContainEqual(
        expect.objectContaining({ field: 'manifest.files', severity: 'warning' })
      )
    })

    it('should pass valid plan.json', () => {
      const result = validator.validatePlanJson(
        '{"manifest":{"testFile":"test.ts","files":[{"path":"file.ts","action":"CREATE"}]}}'
      )
      expect(result.valid).toBe(true)
      expect(result.severity).toBe('success')
    })

    it('should reject plan with empty testFile', () => {
      const result = validator.validatePlanJson(
        '{"manifest":{"testFile":"","files":[]}}'
      )
      expect(result.valid).toBe(false)
      expect(result.details.issues).toContainEqual(
        expect.objectContaining({ field: 'manifest.testFile', severity: 'error' })
      )
    })

    it('should reject plan with whitespace-only testFile', () => {
      const result = validator.validatePlanJson(
        '{"manifest":{"testFile":"   ","files":[]}}'
      )
      expect(result.valid).toBe(false)
    })
  })

  describe('validateContractMd', () => {
    it('should reject empty content', () => {
      const result = validator.validateContractMd('')
      expect(result.valid).toBe(false)
      expect(result.severity).toBe('error')
    })

    it('should reject very short content', () => {
      const result = validator.validateContractMd('short')
      expect(result.valid).toBe(false)
      expect(result.message).toContain('vazio ou muito curto')
    })

    it('should warn if no Markdown header', () => {
      const result = validator.validateContractMd('This is a long contract but without headers')
      expect(result.valid).toBe(true)
      expect(result.severity).toBe('warning')
      expect(result.details.issues).toContainEqual(
        expect.objectContaining({ field: 'content', severity: 'warning' })
      )
    })

    it('should pass valid contract.md with header', () => {
      const result = validator.validateContractMd('# Contract\n\nThis is a valid contract.')
      expect(result.valid).toBe(true)
      expect(result.severity).toBe('success')
    })

    it('should pass contract with ## header', () => {
      const result = validator.validateContractMd('## Contract Details\n\nContent here.')
      expect(result.valid).toBe(true)
      expect(result.severity).toBe('success')
    })
  })

  describe('validateTaskSpecMd', () => {
    it('should reject empty content', () => {
      const result = validator.validateTaskSpecMd('')
      expect(result.valid).toBe(false)
      expect(result.severity).toBe('error')
    })

    it('should reject short content', () => {
      const result = validator.validateTaskSpecMd('abc')
      expect(result.valid).toBe(false)
    })

    it('should warn if no Markdown header', () => {
      const result = validator.validateTaskSpecMd('Long task spec without headers')
      expect(result.valid).toBe(true)
      expect(result.severity).toBe('warning')
    })

    it('should pass valid task.spec.md', () => {
      const result = validator.validateTaskSpecMd('# Task Spec\n\nDetails here.', 'task.spec.md')
      expect(result.valid).toBe(true)
      expect(result.severity).toBe('success')
      expect(result.details.filename).toBe('task.spec.md')
    })

    it('should pass valid task_spec.md (backward compatibility)', () => {
      const result = validator.validateTaskSpecMd('# Task Spec\n\nDetails here.', 'task_spec.md')
      expect(result.valid).toBe(true)
      expect(result.details.filename).toBe('task_spec.md')
    })
  })

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

  describe('validateStepArtifacts', () => {
    describe('Step 1 (Plan)', () => {
      it('should reject if plan.json missing', () => {
        const artifacts = new Map([
          ['contract.md', '# Contract'],
          ['task.spec.md', '# Spec'],
        ])
        const result = validator.validateStepArtifacts(1, artifacts)
        expect(result.valid).toBe(false)
        expect(result.results).toContainEqual(
          expect.objectContaining({
            valid: false,
            details: expect.objectContaining({ filename: 'plan.json' })
          })
        )
      })

      it('should reject if contract.md missing', () => {
        const artifacts = new Map([
          ['plan.json', '{"manifest":{"testFile":"test.ts","files":[]}}'],
          ['task.spec.md', '# Spec'],
        ])
        const result = validator.validateStepArtifacts(1, artifacts)
        expect(result.valid).toBe(false)
        expect(result.results).toContainEqual(
          expect.objectContaining({
            valid: false,
            details: expect.objectContaining({ filename: 'contract.md' })
          })
        )
      })

      it('should reject if task.spec.md and task_spec.md both missing', () => {
        const artifacts = new Map([
          ['plan.json', '{"manifest":{"testFile":"test.ts","files":[]}}'],
          ['contract.md', '# Contract'],
        ])
        const result = validator.validateStepArtifacts(1, artifacts)
        expect(result.valid).toBe(false)
        expect(result.results).toContainEqual(
          expect.objectContaining({
            valid: false,
            message: expect.stringContaining('task.spec.md ou task_spec.md')
          })
        )
      })

      it('should accept task.spec.md', () => {
        const artifacts = new Map([
          ['plan.json', '{"manifest":{"testFile":"test.ts","files":[{"path":"f.ts","action":"CREATE"}]}}'],
          ['contract.md', '# Contract\n\nDetails here.'],
          ['task.spec.md', '# Task Spec\n\nDetails here.'],
        ])
        const result = validator.validateStepArtifacts(1, artifacts)
        expect(result.valid).toBe(true)
      })

      it('should accept task_spec.md (backward compatibility)', () => {
        const artifacts = new Map([
          ['plan.json', '{"manifest":{"testFile":"test.ts","files":[{"path":"f.ts","action":"CREATE"}]}}'],
          ['contract.md', '# Contract\n\nDetails here.'],
          ['task_spec.md', '# Task Spec\n\nDetails here.'],
        ])
        const result = validator.validateStepArtifacts(1, artifacts)
        expect(result.valid).toBe(true)
      })

      it('should reject if plan.json is invalid', () => {
        const artifacts = new Map([
          ['plan.json', '{"manifest":{}}'], // missing testFile
          ['contract.md', '# Contract\n\nDetails here.'],
          ['task.spec.md', '# Task Spec\n\nDetails here.'],
        ])
        const result = validator.validateStepArtifacts(1, artifacts)
        expect(result.valid).toBe(false)
        expect(result.results).toContainEqual(
          expect.objectContaining({
            valid: false,
            details: expect.objectContaining({ filename: 'plan.json' })
          })
        )
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
})
