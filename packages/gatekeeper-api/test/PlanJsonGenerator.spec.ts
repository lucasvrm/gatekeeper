import { describe, it, expect } from 'vitest'
import type { GeneratorContext } from '../src/elicitor/generators/IGenerator.js'
import type { ElicitationState } from '../src/elicitor/types/elicitor.types.js'
import { TaskType } from '../src/elicitor/types/elicitor.types.js'
import { PlanJsonGenerator } from '../src/elicitor/generators/PlanJsonGenerator.js'

describe('PlanJsonGenerator', () => {
  const generator = new PlanJsonGenerator()

  it('generates plan.json structure with manifest files', () => {
    const state = {
      type: TaskType.UI_COMPONENT,
      name: 'PrimaryButton',
      manifestFiles: [{ path: 'src/components/PrimaryButton.tsx', action: 'CREATE' }],
    } as unknown as ElicitationState

    const context: GeneratorContext = {
      outputId: '20260101-test',
      projectPath: 'C:/repo',
      outputDir: 'artifacts',
      taskType: TaskType.UI_COMPONENT,
      state,
    }

    const plan = generator.generateWithContext(context)

    expect(plan.outputId).toBe('20260101-test')
    expect(plan.projectPath).toBe('C:/repo')
    expect(plan.manifest.files.length).toBe(1)
    expect(plan.manifest.testFile).toContain('20260101-test')
    expect(plan.testFilePath).toContain('primary-button.spec.tsx')
  })

  it('flags danger mode for sensitive files', () => {
    const state = {
      type: TaskType.UI_COMPONENT,
      name: 'PrimaryButton',
      manifestFiles: [{ path: '.env', action: 'MODIFY' }],
    } as unknown as ElicitationState

    const context: GeneratorContext = {
      outputId: '20260101-test',
      projectPath: 'C:/repo',
      outputDir: 'artifacts',
      taskType: TaskType.UI_COMPONENT,
      state,
    }

    const plan = generator.generateWithContext(context)
    expect(plan.dangerMode).toBe(true)
  })

  it('throws when manifestFiles is missing', () => {
    const state = { type: TaskType.UI_COMPONENT, name: 'PrimaryButton' } as unknown as ElicitationState

    const context: GeneratorContext = {
      outputId: '20260101-test',
      projectPath: 'C:/repo',
      outputDir: 'artifacts',
      taskType: TaskType.UI_COMPONENT,
      state,
    }

    expect(() => generator.generateWithContext(context)).toThrow('manifestFiles is required')
  })
})
