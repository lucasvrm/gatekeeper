import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { AgentOrchestratorBridge } from '../../src/services/AgentOrchestratorBridge.js'

describe('AgentOrchestratorBridge - Artifact Validation Integration', () => {
  let prisma: PrismaClient
  let bridge: AgentOrchestratorBridge
  const gatekeeperApiUrl = 'http://localhost:5000'

  beforeEach(() => {
    prisma = new PrismaClient()
    bridge = new AgentOrchestratorBridge(prisma, gatekeeperApiUrl)
  })

  afterEach(async () => {
    await prisma.$disconnect()
  })

  describe('Validator instance', () => {
    it('should have validator instance available', () => {
      expect((bridge as any).validator).toBeDefined()
      expect((bridge as any).validator.validatePlanJson).toBeDefined()
      expect((bridge as any).validator.validateStepArtifacts).toBeDefined()
    })
  })

  describe('Step 1 artifact validation', () => {
    it('should validate valid plan artifacts', () => {
      const artifacts = new Map([
        ['plan.json', '{"manifest":{"testFile":"test.ts","files":[{"path":"f.ts","action":"CREATE"}]}}'],
        ['contract.md', '# Contract\n\nContract details here.'],
        ['task.spec.md', '# Task Spec\n\nSpecification details.'],
      ])

      const result = (bridge as any).validator.validateStepArtifacts(1, artifacts)
      expect(result.valid).toBe(true)
      expect(result.results).toHaveLength(3)
    })

    it('should reject plan artifacts with missing files', () => {
      const artifacts = new Map([
        ['plan.json', '{"manifest":{"testFile":"test.ts","files":[]}}'],
        // Missing contract.md and task.spec.md
      ])

      const result = (bridge as any).validator.validateStepArtifacts(1, artifacts)
      expect(result.valid).toBe(false)
      expect(result.results.some((r: any) => !r.valid && r.details.filename === 'contract.md')).toBe(true)
    })

    it('should reject plan.json without testFile', () => {
      const artifacts = new Map([
        ['plan.json', '{"manifest":{}}'], // missing testFile
        ['contract.md', '# Contract\n\nDetails'],
        ['task.spec.md', '# Spec\n\nDetails'],
      ])

      const result = (bridge as any).validator.validateStepArtifacts(1, artifacts)
      expect(result.valid).toBe(false)
      expect(result.results.some((r: any) =>
        !r.valid && r.details.filename === 'plan.json'
      )).toBe(true)
    })

    it('should accept task_spec.md (backward compatibility)', () => {
      const artifacts = new Map([
        ['plan.json', '{"manifest":{"testFile":"test.ts","files":[{"path":"f.ts","action":"CREATE"}]}}'],
        ['contract.md', '# Contract\n\nDetails'],
        ['task_spec.md', '# Spec\n\nDetails'], // underscore version
      ])

      const result = (bridge as any).validator.validateStepArtifacts(1, artifacts)
      expect(result.valid).toBe(true)
    })

    it('should generate warnings for empty manifest.files', () => {
      const artifacts = new Map([
        ['plan.json', '{"manifest":{"testFile":"test.ts","files":[]}}'], // empty files array
        ['contract.md', '# Contract\n\nDetails'],
        ['task.spec.md', '# Spec\n\nDetails'],
      ])

      const result = (bridge as any).validator.validateStepArtifacts(1, artifacts)
      expect(result.valid).toBe(true) // Valid but with warnings
      expect(result.results.some((r: any) => r.severity === 'warning')).toBe(true)
    })
  })

  describe('Step 2 artifact validation', () => {
    it('should validate valid spec artifacts', () => {
      const artifacts = new Map([
        ['test.spec.ts', 'describe("test", () => { it("works", () => { expect(1).toBe(1) }) })'],
      ])

      const result = (bridge as any).validator.validateStepArtifacts(2, artifacts)
      expect(result.valid).toBe(true)
    })

    it('should reject artifacts without test files', () => {
      const artifacts = new Map([
        ['not-a-test.ts', 'const foo = "bar"'],
      ])

      const result = (bridge as any).validator.validateStepArtifacts(2, artifacts)
      expect(result.valid).toBe(false)
    })

    it('should accept .test.ts extension', () => {
      const artifacts = new Map([
        ['foo.test.ts', 'test("works", () => { expect(1).toBe(1) })'],
      ])

      const result = (bridge as any).validator.validateStepArtifacts(2, artifacts)
      expect(result.valid).toBe(true)
    })

    it('should accept .spec.tsx and .test.jsx extensions', () => {
      const artifacts = new Map([
        ['component.spec.tsx', 'it("renders", () => { expect(true).toBe(true) })'],
        ['utils.test.jsx', 'test("works", () => { expect(1).toBe(1) })'],
      ])

      const result = (bridge as any).validator.validateStepArtifacts(2, artifacts)
      expect(result.valid).toBe(true)
    })

    it('should warn if test file lacks assertions', () => {
      const artifacts = new Map([
        ['test.spec.ts', 'describe("test", () => { it("works", () => {}) })'], // no expect()
      ])

      const result = (bridge as any).validator.validateStepArtifacts(2, artifacts)
      expect(result.valid).toBe(true)
      expect(result.results.some((r: any) => r.severity === 'warning')).toBe(true)
    })
  })

  describe('Steps 3 and 4 validation', () => {
    it('should pass for step 3 (less strict)', () => {
      const artifacts = new Map()
      const result = (bridge as any).validator.validateStepArtifacts(3, artifacts)
      expect(result.valid).toBe(true)
    })

    it('should pass for step 4 (less strict)', () => {
      const artifacts = new Map()
      const result = (bridge as any).validator.validateStepArtifacts(4, artifacts)
      expect(result.valid).toBe(true)
    })
  })
})
