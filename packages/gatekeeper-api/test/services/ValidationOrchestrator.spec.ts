import { describe, it, expect } from 'vitest'
import { ValidationOrchestrator } from '../src/services/ValidationOrchestrator.js'
import type { ValidationRun } from '@prisma/client'

describe('ValidationOrchestrator.buildContext', () => {
  it('includes parsed contract data when contractJson is stored', async () => {
    const orchestrator = new ValidationOrchestrator()
    const contract = {
      schemaVersion: '1.0.0',
      slug: 'example-contract',
      title: 'Example contract',
      mode: 'STRICT',
      changeType: 'new',
      targetArtifacts: ['service'],
      clauses: [
        {
          id: 'CL-EX-001',
          kind: 'behavior',
          normativity: 'MUST',
          title: 'Ensure example behavior',
          spec: 'When the example API is invoked, it should return 200',
          observables: ['http'],
        },
      ],
    }

    const run = {
      id: 'validation-with-contract',
      outputId: 'contract-run',
      projectPath: process.cwd(),
      baseRef: 'origin/main',
      targetRef: 'HEAD',
      taskPrompt: 'Validate contract flow',
      manifestJson: JSON.stringify({
        files: [{ path: 'src/main.ts', action: 'MODIFY' }],
        testFile: 'src/main.spec.ts',
      }),
      testFilePath: 'src/main.spec.ts',
      dangerMode: false,
      runType: 'CONTRACT',
      contractRunId: null,
      status: 'PENDING',
      currentGate: 0,
      passed: false,
      failedAt: null,
      failedValidatorCode: null,
      summary: null,
      startedAt: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      contractJson: JSON.stringify(contract),
    } as ValidationRun

    const context = await (orchestrator as unknown as { buildContext: (run: ValidationRun) => Promise<Record<string, unknown>> }).buildContext(run)

    expect(context.contract).toEqual(contract)
    expect(context.contractJson).toBe(run.contractJson)
    expect(context.contractParseError).toBeUndefined()
  })
})
