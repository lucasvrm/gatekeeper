/**
 * @file test-test-resilience-check.spec.ts
 * @description Spec tests for TestResilienceCheck validator (Gate 1, order 6, hard block).
 *              Rejects fragile test patterns and requires resilient observable-based patterns.
 *
 * TDD Red Phase: TestResilienceCheckValidator does NOT exist yet.
 * All tests MUST fail on import until the validator is implemented.
 */

import { describe, it, expect, vi } from 'vitest'
import { TestResilienceCheckValidator } from '../../../src/domain/validators/gate1/TestResilienceCheck.ts'
import type { ValidationContext, ValidatorOutput } from '../../../src/types/index.ts'

// ─── Mock Factories ─────────────────────────────────────────────────────────

function createMockGitService(fileContentMap: Record<string, string> = {}) {
  return {
    readFile: vi.fn(async (filePath: string): Promise<string> => {
      for (const [key, content] of Object.entries(fileContentMap)) {
        if (filePath.includes(key)) return content
      }
      return ''
    }),
    diff: vi.fn().mockResolvedValue(''),
    checkout: vi.fn().mockResolvedValue(undefined),
    stash: vi.fn().mockResolvedValue(undefined),
    stashPop: vi.fn().mockResolvedValue(undefined),
    createWorktree: vi.fn().mockResolvedValue(undefined),
    removeWorktree: vi.fn().mockResolvedValue(undefined),
    getDiffFiles: vi.fn().mockResolvedValue([]),
    getDiffFilesWithWorkingTree: vi.fn().mockResolvedValue([]),
    getCurrentRef: vi.fn().mockResolvedValue('HEAD'),
  }
}

function createCtx(overrides: Partial<ValidationContext> = {}): ValidationContext {
  const defaultServices = {
    git: createMockGitService(),
    ast: { parseFile: vi.fn(), getImports: vi.fn(), getTestBlocksWithComments: vi.fn() },
    testRunner: { runSingleTest: vi.fn(), runAllTests: vi.fn() },
    compiler: { compile: vi.fn() },
    lint: { lint: vi.fn() },
    build: { build: vi.fn() },
    tokenCounter: { count: vi.fn().mockReturnValue(0) },
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  }

  const defaults: ValidationContext = {
    runId: 'run-test-001',
    projectPath: '/test/project',
    baseRef: 'origin/main',
    targetRef: 'HEAD',
    taskPrompt: 'Test task',
    manifest: null,
    contract: null,
    testFilePath: 'src/components/__tests__/Button.spec.tsx',
    dangerMode: false,
    services: defaultServices,
    config: new Map<string, string>(),
    sensitivePatterns: [],
    ambiguousTerms: [],
    bypassedValidators: new Set<string>(),
    uiContracts: null,
  }

  const merged = { ...defaults, ...overrides }

  if (overrides.services) {
    merged.services = { ...defaultServices, ...overrides.services } as ValidationContext['services']
  }

  return merged
}

// ─── Test Content Fixtures ──────────────────────────────────────────────────

const ONLY_RESILIENT_CONTENT = `
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button'

describe('Button', () => {
  it('renders button with correct text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button')).toBeVisible()
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })
  it('handles click event', async () => {
    const handler = vi.fn()
    render(<Button onClick={handler}>Click</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(handler).toHaveBeenCalledTimes(1)
  })
  it('has accessible name', () => {
    render(<Button aria-label="Submit form">Submit</Button>)
    expect(screen.getByRole('button')).toHaveAccessibleName('Submit form')
  })
})
`

const ONLY_FRAGILE_CONTENT = `
import { render } from '@testing-library/react'
import { Button } from './Button'

describe('Button', () => {
  it('renders correctly', () => {
    const { container } = render(<Button>Click</Button>)
    const btn = container.querySelector('.btn-primary')
    expect(btn.innerHTML).toContain('Click')
  })
  it('has correct class', () => {
    const { container } = render(<Button variant="danger" />)
    expect(container.firstChild.className).toContain('danger')
  })
})
`

const MIXED_FRAGILE_AND_RESILIENT_CONTENT = `
import { render, screen } from '@testing-library/react'
import { Button } from './Button'

describe('Button', () => {
  it('renders button', () => {
    render(<Button>Click</Button>)
    expect(screen.getByRole('button')).toBeVisible()
  })
  it('has correct class via querySelector', () => {
    const { container } = render(<Button variant="primary" />)
    const btn = container.querySelector('.btn-primary')
    expect(btn).not.toBeNull()
  })
})
`

const PURE_UNIT_TEST_CONTENT = `
import { add, multiply } from './math'

describe('Math utils', () => {
  it('adds numbers', () => {
    expect(add(1, 2)).toBe(3)
  })
  it('multiplies numbers', () => {
    expect(multiply(3, 4)).toBe(12)
  })
})
`

const SKIP_COMMENT_CONTENT = `
// @resilience-skip
import { render, screen } from '@testing-library/react'
import { Button } from './Button'

describe('Button', () => {
  it('renders', () => {
    const { container } = render(<Button />)
    expect(container.querySelector('.btn')).not.toBeNull()
  })
})
`

const SNAPSHOT_CONTENT = `
import { render, screen } from '@testing-library/react'
import { Card } from './Card'

describe('Card', () => {
  it('renders card', () => {
    render(<Card title="Hello" />)
    expect(screen.getByRole('article')).toBeVisible()
  })
  it('matches snapshot', () => {
    const { container } = render(<Card title="Hello" />)
    expect(container).toMatchSnapshot()
  })
})
`

const FIRST_CHILD_CONTENT = `
import { render } from '@testing-library/react'
import { Badge } from './Badge'

describe('Badge', () => {
  it('renders badge', () => {
    const { container } = render(<Badge>New</Badge>)
    expect(container.firstChild.textContent).toBe('New')
  })
})
`

const WRAPPER_FIND_WITH_RESILIENT_CONTENT = `
import { render, screen } from '@testing-library/react'
import { shallow } from 'enzyme'
import { Alert } from './Alert'

describe('Alert', () => {
  it('shows message via RTL', () => {
    render(<Alert message="Warning!" />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
  it('finds icon via enzyme', () => {
    const wrapper = shallow(<Alert message="Warning!" />)
    expect(wrapper.find('.alert-icon')).toHaveLength(1)
  })
})
`

const NON_UI_TEST_CONTENT_NO_INDICATORS = `
import { calculateTax } from './tax'

describe('Tax calculator', () => {
  it('calculates correct tax for standard rate', () => {
    expect(calculateTax(1000, 0.2)).toBe(200)
  })
})
`

const SKIP_COMMENT_WITH_FRAGILE_CONTENT = `
// @resilience-skip
import { render } from '@testing-library/react'
import { Modal } from './Modal'

describe('Modal', () => {
  it('opens correctly', () => {
    const { container } = render(<Modal open />)
    const overlay = container.querySelector('.modal-overlay')
    expect(overlay.innerHTML).toContain('modal')
  })
})
`

// ═══════════════════════════════════════════════════════════════════════════════
// CL-VALID-001: Rejects tests with only fragile patterns
// ═══════════════════════════════════════════════════════════════════════════════

describe('CL-VALID-001: Rejects tests with only fragile patterns', () => {
  // @clause CL-VALID-001
  it('fails when test file contains only querySelector and innerHTML patterns', async () => {
    const ctx = createCtx({
      services: {
        git: createMockGitService({ 'Button.spec.tsx': ONLY_FRAGILE_CONTENT }),
      } as Partial<ValidationContext['services']> as ValidationContext['services'],
    })

    const output: ValidatorOutput = await TestResilienceCheckValidator.execute(ctx)

    expect(output.passed).toBe(false)
    expect(output.status).toBe('FAILED')
    expect(output.metrics!.fragilePatternCount).toBeGreaterThan(0)
  })

  // @clause CL-VALID-001
  it('fails when test file contains getElementsByClassName', async () => {
    const fragileContent = `
import { render } from '@testing-library/react'
describe('List', () => {
  it('renders items', () => {
    const { container } = render(<List items={['a','b']} />)
    const items = container.getElementsByClassName('list-item')
    expect(items.length).toBe(2)
  })
})
`
    const ctx = createCtx({
      services: {
        git: createMockGitService({ 'List.spec.tsx': fragileContent }),
      } as Partial<ValidationContext['services']> as ValidationContext['services'],
      testFilePath: 'List.spec.tsx',
    })

    const output: ValidatorOutput = await TestResilienceCheckValidator.execute(ctx)

    expect(output.passed).toBe(false)
    expect(output.status).toBe('FAILED')
    expect(output.context!.findings.some((f) => f.type === 'fail')).toBe(true)
  })

  // @clause CL-VALID-001
  it('fails when evidence contains correction suggestions for fragile patterns', async () => {
    const ctx = createCtx({
      services: {
        git: createMockGitService({ 'Button.spec.tsx': ONLY_FRAGILE_CONTENT }),
      } as Partial<ValidationContext['services']> as ValidationContext['services'],
    })

    const output: ValidatorOutput = await TestResilienceCheckValidator.execute(ctx)

    expect(output.passed).toBe(false)
    expect(typeof output.evidence).toBe('string')
    expect(output.evidence!.length).toBeGreaterThan(0)
    expect(
      output.evidence!.includes('querySelector') || output.evidence!.includes('innerHTML')
    ).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// CL-VALID-002: Approves tests with only resilient patterns
// ═══════════════════════════════════════════════════════════════════════════════

describe('CL-VALID-002: Approves tests with only resilient patterns', () => {
  // @clause CL-VALID-002
  it('succeeds when test file contains only getByRole, screen, and userEvent patterns', async () => {
    const ctx = createCtx({
      services: {
        git: createMockGitService({ 'Button.spec.tsx': ONLY_RESILIENT_CONTENT }),
      } as Partial<ValidationContext['services']> as ValidationContext['services'],
    })

    const output: ValidatorOutput = await TestResilienceCheckValidator.execute(ctx)

    expect(output.passed).toBe(true)
    expect(output.status).toBe('PASSED')
    expect(output.metrics!.resilientPatternCount).toBeGreaterThan(0)
    expect(output.metrics!.fragilePatternCount).toBe(0)
  })

  // @clause CL-VALID-002
  it('succeeds when findings contain pass entries for resilient patterns', async () => {
    const ctx = createCtx({
      services: {
        git: createMockGitService({ 'Button.spec.tsx': ONLY_RESILIENT_CONTENT }),
      } as Partial<ValidationContext['services']> as ValidationContext['services'],
    })

    const output: ValidatorOutput = await TestResilienceCheckValidator.execute(ctx)

    expect(output.passed).toBe(true)
    expect(output.context!.findings.some((f) => f.type === 'pass')).toBe(true)
  })

  // @clause CL-VALID-002
  it('succeeds when test uses findByRole and toHaveTextContent patterns', async () => {
    const resilientVariant = `
import { render, screen } from '@testing-library/react'
describe('Label', () => {
  it('renders label text', async () => {
    render(<Label htmlFor="name">Name</Label>)
    const label = await screen.findByRole('generic')
    expect(label).toHaveTextContent('Name')
  })
})
`
    const ctx = createCtx({
      services: {
        git: createMockGitService({ 'Label.spec.tsx': resilientVariant }),
      } as Partial<ValidationContext['services']> as ValidationContext['services'],
      testFilePath: 'Label.spec.tsx',
    })

    const output: ValidatorOutput = await TestResilienceCheckValidator.execute(ctx)

    expect(output.passed).toBe(true)
    expect(output.status).toBe('PASSED')
    expect(output.metrics!.resilientPatternCount).toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// CL-VALID-003: Zero tolerance — fragile + resilient = FAILED
// ═══════════════════════════════════════════════════════════════════════════════

describe('CL-VALID-003: Zero tolerance — fragile + resilient = FAILED', () => {
  // @clause CL-VALID-003
  it('fails when test file contains both resilient and fragile patterns', async () => {
    const ctx = createCtx({
      services: {
        git: createMockGitService({ 'Button.spec.tsx': MIXED_FRAGILE_AND_RESILIENT_CONTENT }),
      } as Partial<ValidationContext['services']> as ValidationContext['services'],
    })

    const output: ValidatorOutput = await TestResilienceCheckValidator.execute(ctx)

    expect(output.passed).toBe(false)
    expect(output.status).toBe('FAILED')
  })

  // @clause CL-VALID-003
  it('fails when both fragile and resilient counts are greater than zero', async () => {
    const ctx = createCtx({
      services: {
        git: createMockGitService({ 'Button.spec.tsx': MIXED_FRAGILE_AND_RESILIENT_CONTENT }),
      } as Partial<ValidationContext['services']> as ValidationContext['services'],
    })

    const output: ValidatorOutput = await TestResilienceCheckValidator.execute(ctx)

    expect(output.metrics!.fragilePatternCount).toBeGreaterThan(0)
    expect(output.metrics!.resilientPatternCount).toBeGreaterThan(0)
    expect(output.passed).toBe(false)
  })

  // @clause CL-VALID-003
  it('fails when innerHTML is mixed with getByText', async () => {
    const mixedContent = `
import { render, screen } from '@testing-library/react'
describe('Tooltip', () => {
  it('shows tooltip text', () => {
    render(<Tooltip text="Help" />)
    expect(screen.getByText('Help')).toBeVisible()
  })
  it('has correct inner html', () => {
    const { container } = render(<Tooltip text="Help" />)
    expect(container.innerHTML).toContain('tooltip')
  })
})
`
    const ctx = createCtx({
      services: {
        git: createMockGitService({ 'Tooltip.spec.tsx': mixedContent }),
      } as Partial<ValidationContext['services']> as ValidationContext['services'],
      testFilePath: 'Tooltip.spec.tsx',
    })

    const output: ValidatorOutput = await TestResilienceCheckValidator.execute(ctx)

    expect(output.passed).toBe(false)
    expect(output.status).toBe('FAILED')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// CL-VALID-004: Warning for tests with no DOM patterns
// ═══════════════════════════════════════════════════════════════════════════════

describe('CL-VALID-004: Warning for tests with no DOM patterns (SKIP_NON_UI_TESTS=false)', () => {
  // @clause CL-VALID-004
  it('succeeds when pure unit test returns WARNING status with SKIP_NON_UI_TESTS=false', async () => {
    const config = new Map<string, string>([['SKIP_NON_UI_TESTS', 'false']])
    const ctx = createCtx({
      testFilePath: 'math.spec.ts',
      config,
      services: {
        git: createMockGitService({ 'math.spec.ts': PURE_UNIT_TEST_CONTENT }),
      } as Partial<ValidationContext['services']> as ValidationContext['services'],
    })

    const output: ValidatorOutput = await TestResilienceCheckValidator.execute(ctx)

    expect(output.passed).toBe(true)
    expect(output.status).toBe('WARNING')
  })

  // @clause CL-VALID-004
  it('succeeds when both fragile and resilient counts are zero', async () => {
    const config = new Map<string, string>([['SKIP_NON_UI_TESTS', 'false']])
    const ctx = createCtx({
      testFilePath: 'math.spec.ts',
      config,
      services: {
        git: createMockGitService({ 'math.spec.ts': PURE_UNIT_TEST_CONTENT }),
      } as Partial<ValidationContext['services']> as ValidationContext['services'],
    })

    const output: ValidatorOutput = await TestResilienceCheckValidator.execute(ctx)

    expect(output.metrics!.fragilePatternCount).toBe(0)
    expect(output.metrics!.resilientPatternCount).toBe(0)
  })

  // @clause CL-VALID-004
  it('succeeds when no DOM patterns detected in string-only test file', async () => {
    const stringTestContent = `
describe('StringUtils', () => {
  it('trims whitespace', () => {
    expect(trim('  hello  ')).toBe('hello')
  })
})
`
    const config = new Map<string, string>([['SKIP_NON_UI_TESTS', 'false']])
    const ctx = createCtx({
      testFilePath: 'string.spec.ts',
      config,
      services: {
        git: createMockGitService({ 'string.spec.ts': stringTestContent }),
      } as Partial<ValidationContext['services']> as ValidationContext['services'],
    })

    const output: ValidatorOutput = await TestResilienceCheckValidator.execute(ctx)

    expect(output.passed).toBe(true)
    expect(output.status).toBe('WARNING')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// CL-VALID-005: Skip via // @resilience-skip
// ═══════════════════════════════════════════════════════════════════════════════

describe('CL-VALID-005: Skip via // @resilience-skip comment', () => {
  // @clause CL-VALID-005
  it('succeeds when test file with @resilience-skip returns SKIPPED status', async () => {
    const ctx = createCtx({
      services: {
        git: createMockGitService({ 'Button.spec.tsx': SKIP_COMMENT_CONTENT }),
      } as Partial<ValidationContext['services']> as ValidationContext['services'],
    })

    const output: ValidatorOutput = await TestResilienceCheckValidator.execute(ctx)

    expect(output.status).toBe('SKIPPED')
  })

  // @clause CL-VALID-005
  it('succeeds when SKIPPED message mentions opt-out', async () => {
    const ctx = createCtx({
      services: {
        git: createMockGitService({ 'Button.spec.tsx': SKIP_COMMENT_CONTENT }),
      } as Partial<ValidationContext['services']> as ValidationContext['services'],
    })

    const output: ValidatorOutput = await TestResilienceCheckValidator.execute(ctx)

    expect(output.status).toBe('SKIPPED')
    expect(output.message.toLowerCase()).toMatch(/opt.?out|skip|resilience/)
  })

  // @clause CL-VALID-005
  it('succeeds when @resilience-skip overrides fragile patterns present in file', async () => {
    const ctx = createCtx({
      services: {
        git: createMockGitService({ 'Modal.spec.tsx': SKIP_COMMENT_WITH_FRAGILE_CONTENT }),
      } as Partial<ValidationContext['services']> as ValidationContext['services'],
      testFilePath: 'Modal.spec.tsx',
    })

    const output: ValidatorOutput = await TestResilienceCheckValidator.execute(ctx)

    expect(output.status).toBe('SKIPPED')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// CL-VALID-006: Fails when testFilePath is missing
// ═══════════════════════════════════════════════════════════════════════════════

describe('CL-VALID-006: Fails when testFilePath is null or undefined', () => {
  // @clause CL-VALID-006
  it('fails when testFilePath is null', async () => {
    const ctx = createCtx({ testFilePath: null })

    const output: ValidatorOutput = await TestResilienceCheckValidator.execute(ctx)

    expect(output.passed).toBe(false)
    expect(output.status).toBe('FAILED')
  })

  // @clause CL-VALID-006
  it('fails when testFilePath is undefined', async () => {
    const ctx = createCtx({ testFilePath: undefined as unknown as null })

    const output: ValidatorOutput = await TestResilienceCheckValidator.execute(ctx)

    expect(output.passed).toBe(false)
    expect(output.status).toBe('FAILED')
  })

  // @clause CL-VALID-006
  it('fails when message indicates absence of test file path', async () => {
    const ctx = createCtx({ testFilePath: null })

    const output: ValidatorOutput = await TestResilienceCheckValidator.execute(ctx)

    expect(output.passed).toBe(false)
    expect(output.message.toLowerCase()).toMatch(/test.?file|path|missing|not provided/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// CL-VALID-007: Detects toMatchSnapshot() as fragile
// ═══════════════════════════════════════════════════════════════════════════════

describe('CL-VALID-007: Detects toMatchSnapshot() as fragile', () => {
  // @clause CL-VALID-007
  it('fails when test file contains toMatchSnapshot()', async () => {
    const ctx = createCtx({
      services: {
        git: createMockGitService({ 'Card.spec.tsx': SNAPSHOT_CONTENT }),
      } as Partial<ValidationContext['services']> as ValidationContext['services'],
      testFilePath: 'Card.spec.tsx',
    })

    const output: ValidatorOutput = await TestResilienceCheckValidator.execute(ctx)

    expect(output.passed).toBe(false)
  })

  // @clause CL-VALID-007
  it('fails when findings include a fail entry for snapshot pattern', async () => {
    const ctx = createCtx({
      services: {
        git: createMockGitService({ 'Card.spec.tsx': SNAPSHOT_CONTENT }),
      } as Partial<ValidationContext['services']> as ValidationContext['services'],
      testFilePath: 'Card.spec.tsx',
    })

    const output: ValidatorOutput = await TestResilienceCheckValidator.execute(ctx)

    const snapshotFinding = output.context!.findings.find(
      (f) => f.type === 'fail' && f.message.toLowerCase().includes('snapshot')
    )
    expect(snapshotFinding).not.toBeUndefined()
  })

  // @clause CL-VALID-007
  it('fails when toMatchInlineSnapshot is also detected as fragile', async () => {
    const inlineSnapshotContent = `
import { render, screen } from '@testing-library/react'
describe('Avatar', () => {
  it('renders avatar', () => {
    render(<Avatar name="John" />)
    expect(screen.getByRole('img')).toBeVisible()
  })
  it('inline snapshot', () => {
    const { container } = render(<Avatar name="John" />)
    expect(container).toMatchInlineSnapshot()
  })
})
`
    const ctx = createCtx({
      services: {
        git: createMockGitService({ 'Avatar.spec.tsx': inlineSnapshotContent }),
      } as Partial<ValidationContext['services']> as ValidationContext['services'],
      testFilePath: 'Avatar.spec.tsx',
    })

    const output: ValidatorOutput = await TestResilienceCheckValidator.execute(ctx)

    expect(output.passed).toBe(false)
    expect(output.metrics!.fragilePatternCount).toBeGreaterThanOrEqual(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// CL-VALID-008: Detects container.firstChild as fragile
// ═══════════════════════════════════════════════════════════════════════════════

describe('CL-VALID-008: Detects container.firstChild as fragile', () => {
  // @clause CL-VALID-008
  it('fails when test file contains container.firstChild', async () => {
    const ctx = createCtx({
      services: {
        git: createMockGitService({ 'Badge.spec.tsx': FIRST_CHILD_CONTENT }),
      } as Partial<ValidationContext['services']> as ValidationContext['services'],
      testFilePath: 'Badge.spec.tsx',
    })

    const output: ValidatorOutput = await TestResilienceCheckValidator.execute(ctx)

    expect(output.passed).toBe(false)
  })

  // @clause CL-VALID-008
  it('fails when fragilePatternCount is at least 1 for container.firstChild', async () => {
    const ctx = createCtx({
      services: {
        git: createMockGitService({ 'Badge.spec.tsx': FIRST_CHILD_CONTENT }),
      } as Partial<ValidationContext['services']> as ValidationContext['services'],
      testFilePath: 'Badge.spec.tsx',
    })

    const output: ValidatorOutput = await TestResilienceCheckValidator.execute(ctx)

    expect(output.metrics!.fragilePatternCount).toBeGreaterThanOrEqual(1)
  })

  // @clause CL-VALID-008
  it('fails when container.children is also detected as fragile', async () => {
    const childrenContent = `
import { render } from '@testing-library/react'
describe('Nav', () => {
  it('renders nav items', () => {
    const { container } = render(<Nav items={['Home','About']} />)
    expect(container.children.length).toBe(2)
  })
})
`
    const ctx = createCtx({
      services: {
        git: createMockGitService({ 'Nav.spec.tsx': childrenContent }),
      } as Partial<ValidationContext['services']> as ValidationContext['services'],
      testFilePath: 'Nav.spec.tsx',
    })

    const output: ValidatorOutput = await TestResilienceCheckValidator.execute(ctx)

    expect(output.passed).toBe(false)
    expect(output.metrics!.fragilePatternCount).toBeGreaterThanOrEqual(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// CL-VALID-009: wrapper.find invalidates even with resilient present
// ═══════════════════════════════════════════════════════════════════════════════

describe('CL-VALID-009: wrapper.find invalidates even with resilient patterns', () => {
  // @clause CL-VALID-009
  it('fails when test file contains both screen.getByRole and wrapper.find', async () => {
    const ctx = createCtx({
      services: {
        git: createMockGitService({ 'Alert.spec.tsx': WRAPPER_FIND_WITH_RESILIENT_CONTENT }),
      } as Partial<ValidationContext['services']> as ValidationContext['services'],
      testFilePath: 'Alert.spec.tsx',
    })

    const output: ValidatorOutput = await TestResilienceCheckValidator.execute(ctx)

    expect(output.passed).toBe(false)
  })

  // @clause CL-VALID-009
  it('fails when fragilePatternCount >= 1 due to wrapper.find', async () => {
    const ctx = createCtx({
      services: {
        git: createMockGitService({ 'Alert.spec.tsx': WRAPPER_FIND_WITH_RESILIENT_CONTENT }),
      } as Partial<ValidationContext['services']> as ValidationContext['services'],
      testFilePath: 'Alert.spec.tsx',
    })

    const output: ValidatorOutput = await TestResilienceCheckValidator.execute(ctx)

    expect(output.metrics!.fragilePatternCount).toBeGreaterThanOrEqual(1)
  })

  // @clause CL-VALID-009
  it('fails when resilientPatternCount >= 1 but still FAILED due to zero tolerance', async () => {
    const ctx = createCtx({
      services: {
        git: createMockGitService({ 'Alert.spec.tsx': WRAPPER_FIND_WITH_RESILIENT_CONTENT }),
      } as Partial<ValidationContext['services']> as ValidationContext['services'],
      testFilePath: 'Alert.spec.tsx',
    })

    const output: ValidatorOutput = await TestResilienceCheckValidator.execute(ctx)

    expect(output.metrics!.resilientPatternCount).toBeGreaterThanOrEqual(1)
    expect(output.passed).toBe(false)
    expect(output.status).toBe('FAILED')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// CL-VALID-010: Respects custom pattern configuration
// ═══════════════════════════════════════════════════════════════════════════════

describe('CL-VALID-010: Respects custom FRAGILE_PATTERNS and RESILIENT_PATTERNS config', () => {
  // @clause CL-VALID-010
  it('fails when custom fragile pattern detects a non-default pattern', async () => {
    const customContent = `
import { render, screen } from '@testing-library/react'
describe('Widget', () => {
  it('renders widget', () => {
    render(<Widget />)
    expect(screen.getByRole('region')).toBeVisible()
  })
  it('checks via custom fragile', () => {
    const el = document.getCustomElement('.widget')
    expect(el).not.toBeNull()
  })
})
`
    const config = new Map<string, string>([
      ['FRAGILE_PATTERNS', 'getCustomElement('],
      ['RESILIENT_PATTERNS', 'getByRole(,toBeVisible()'],
    ])

    const ctx = createCtx({
      testFilePath: 'Widget.spec.tsx',
      config,
      services: {
        git: createMockGitService({ 'Widget.spec.tsx': customContent }),
      } as Partial<ValidationContext['services']> as ValidationContext['services'],
    })

    const output: ValidatorOutput = await TestResilienceCheckValidator.execute(ctx)

    expect(output.passed).toBe(false)
    expect(output.status).toBe('FAILED')
  })

  // @clause CL-VALID-010
  it('succeeds when default fragile pattern is not in custom config and is ignored', async () => {
    const contentWithQuerySelector = `
import { render, screen } from '@testing-library/react'
describe('Panel', () => {
  it('renders via resilient pattern', () => {
    render(<Panel />)
    expect(screen.getByRole('region')).toBeVisible()
  })
  it('uses querySelector which is not in custom fragile list', () => {
    const { container } = render(<Panel />)
    container.querySelector('.panel')
  })
})
`
    const config = new Map<string, string>([
      ['FRAGILE_PATTERNS', 'getCustomElement('],
      ['RESILIENT_PATTERNS', 'getByRole(,toBeVisible()'],
    ])

    const ctx = createCtx({
      testFilePath: 'Panel.spec.tsx',
      config,
      services: {
        git: createMockGitService({ 'Panel.spec.tsx': contentWithQuerySelector }),
      } as Partial<ValidationContext['services']> as ValidationContext['services'],
    })

    const output: ValidatorOutput = await TestResilienceCheckValidator.execute(ctx)

    // querySelector is NOT in the custom fragile list, so it should pass
    expect(output.passed).toBe(true)
    expect(output.status).toBe('PASSED')
  })

  // @clause CL-VALID-010
  it('succeeds when custom resilient patterns are correctly detected', async () => {
    const customResilientContent = `
describe('Data', () => {
  it('uses custom resilient pattern', () => {
    const el = myCustomQuery('data-item')
    expect(el).toHaveAttribute('data-active', 'true')
  })
})
`
    const config = new Map<string, string>([
      ['RESILIENT_PATTERNS', 'myCustomQuery(,toHaveAttribute('],
    ])

    const ctx = createCtx({
      testFilePath: 'Data.spec.tsx',
      config,
      services: {
        git: createMockGitService({ 'Data.spec.tsx': customResilientContent }),
      } as Partial<ValidationContext['services']> as ValidationContext['services'],
    })

    const output: ValidatorOutput = await TestResilienceCheckValidator.execute(ctx)

    expect(output.passed).toBe(true)
    expect(output.metrics!.resilientPatternCount).toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// CL-VALID-011: Skips non-UI tests when SKIP_NON_UI_TESTS is true
// ═══════════════════════════════════════════════════════════════════════════════

describe('CL-VALID-011: Skips non-UI tests when SKIP_NON_UI_TESTS is true (default)', () => {
  // @clause CL-VALID-011
  it('succeeds when non-UI test is SKIPPED with default config', async () => {
    const ctx = createCtx({
      testFilePath: 'math.spec.ts',
      services: {
        git: createMockGitService({ 'math.spec.ts': NON_UI_TEST_CONTENT_NO_INDICATORS }),
      } as Partial<ValidationContext['services']> as ValidationContext['services'],
    })

    const output: ValidatorOutput = await TestResilienceCheckValidator.execute(ctx)

    expect(output.status).toBe('SKIPPED')
  })

  // @clause CL-VALID-011
  it('succeeds when details.isUITest is false for non-UI test', async () => {
    const ctx = createCtx({
      testFilePath: 'math.spec.ts',
      services: {
        git: createMockGitService({ 'math.spec.ts': NON_UI_TEST_CONTENT_NO_INDICATORS }),
      } as Partial<ValidationContext['services']> as ValidationContext['services'],
    })

    const output: ValidatorOutput = await TestResilienceCheckValidator.execute(ctx)

    expect(output.details!.isUITest).toBe(false)
  })

  // @clause CL-VALID-011
  it('succeeds when SKIP_NON_UI_TESTS is explicitly true and file has no UI indicators', async () => {
    const config = new Map<string, string>([['SKIP_NON_UI_TESTS', 'true']])
    const ctx = createCtx({
      testFilePath: 'utils.spec.ts',
      config,
      services: {
        git: createMockGitService({
          'utils.spec.ts': `
describe('utils', () => {
  it('formats date', () => {
    expect(formatDate(new Date(2024,0,1))).toBe('2024-01-01')
  })
})
`,
        }),
      } as Partial<ValidationContext['services']> as ValidationContext['services'],
    })

    const output: ValidatorOutput = await TestResilienceCheckValidator.execute(ctx)

    expect(output.status).toBe('SKIPPED')
    expect(output.details!.isUITest).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// CL-VALID-012: Static properties of the validator
// ═══════════════════════════════════════════════════════════════════════════════

describe('CL-VALID-012: Static properties of the validator', () => {
  // @clause CL-VALID-012
  it('succeeds when validator code is TEST_RESILIENCE_CHECK', () => {
    expect(TestResilienceCheckValidator.code).toBe('TEST_RESILIENCE_CHECK')
  })

  // @clause CL-VALID-012
  it('succeeds when validator has correct gate, order, and isHardBlock', () => {
    expect(TestResilienceCheckValidator.gate).toBe(1)
    expect(TestResilienceCheckValidator.order).toBe(6)
    expect(TestResilienceCheckValidator.isHardBlock).toBe(true)
  })

  // @clause CL-VALID-012
  it('succeeds when validator name is Test Resilience Check', () => {
    expect(TestResilienceCheckValidator.name).toBe('Test Resilience Check')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// CL-VALID-013: Output structure follows ValidatorOutput
// ═══════════════════════════════════════════════════════════════════════════════

describe('CL-VALID-013: Output structure follows ValidatorOutput', () => {
  // @clause CL-VALID-013
  it('succeeds when PASSED output contains all required context fields', async () => {
    const ctx = createCtx({
      services: {
        git: createMockGitService({ 'Button.spec.tsx': ONLY_RESILIENT_CONTENT }),
      } as Partial<ValidationContext['services']> as ValidationContext['services'],
    })

    const output: ValidatorOutput = await TestResilienceCheckValidator.execute(ctx)

    expect(typeof output.passed).toBe('boolean')
    expect(typeof output.status).toBe('string')
    expect(typeof output.message).toBe('string')
    expect(Array.isArray(output.context!.inputs)).toBe(true)
    expect(Array.isArray(output.context!.analyzed)).toBe(true)
    expect(Array.isArray(output.context!.findings)).toBe(true)
    expect(typeof output.context!.reasoning).toBe('string')
    expect(output.context!.reasoning.length).toBeGreaterThan(0)
  })

  // @clause CL-VALID-013
  it('succeeds when FAILED output contains all required context fields', async () => {
    const ctx = createCtx({
      services: {
        git: createMockGitService({ 'Button.spec.tsx': ONLY_FRAGILE_CONTENT }),
      } as Partial<ValidationContext['services']> as ValidationContext['services'],
    })

    const output: ValidatorOutput = await TestResilienceCheckValidator.execute(ctx)

    expect(typeof output.passed).toBe('boolean')
    expect(typeof output.status).toBe('string')
    expect(typeof output.message).toBe('string')
    expect(Array.isArray(output.context!.inputs)).toBe(true)
    expect(Array.isArray(output.context!.analyzed)).toBe(true)
    expect(Array.isArray(output.context!.findings)).toBe(true)
    expect(typeof output.context!.reasoning).toBe('string')
    expect(output.context!.reasoning.length).toBeGreaterThan(0)
  })

  // @clause CL-VALID-013
  it('succeeds when error output (null testFilePath) also has full context structure', async () => {
    const ctx = createCtx({ testFilePath: null })

    const output: ValidatorOutput = await TestResilienceCheckValidator.execute(ctx)

    expect(typeof output.passed).toBe('boolean')
    expect(typeof output.status).toBe('string')
    expect(typeof output.message).toBe('string')
    expect(Array.isArray(output.context!.inputs)).toBe(true)
    expect(Array.isArray(output.context!.analyzed)).toBe(true)
    expect(Array.isArray(output.context!.findings)).toBe(true)
    expect(typeof output.context!.reasoning).toBe('string')
    expect(output.context!.reasoning.length).toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// CL-VALID-014: Metrics include resilienceRatio
// ═══════════════════════════════════════════════════════════════════════════════

describe('CL-VALID-014: Metrics include resilienceRatio', () => {
  // @clause CL-VALID-014
  it('succeeds when resilience ratio is 1.0 for only resilient patterns', async () => {
    const ctx = createCtx({
      services: {
        git: createMockGitService({ 'Button.spec.tsx': ONLY_RESILIENT_CONTENT }),
      } as Partial<ValidationContext['services']> as ValidationContext['services'],
    })

    const output: ValidatorOutput = await TestResilienceCheckValidator.execute(ctx)

    expect(output.metrics!.resilienceRatio).toBe(1.0)
    expect(output.metrics!.fragilePatternCount).toBe(0)
    expect(output.metrics!.resilientPatternCount).toBeGreaterThan(0)
  })

  // @clause CL-VALID-014
  it('fails when resilience ratio is 0.0 for only fragile patterns', async () => {
    const ctx = createCtx({
      services: {
        git: createMockGitService({ 'Button.spec.tsx': ONLY_FRAGILE_CONTENT }),
      } as Partial<ValidationContext['services']> as ValidationContext['services'],
    })

    const output: ValidatorOutput = await TestResilienceCheckValidator.execute(ctx)

    expect(output.metrics!.resilienceRatio).toBe(0.0)
    expect(output.metrics!.fragilePatternCount).toBeGreaterThan(0)
    expect(output.metrics!.resilientPatternCount).toBe(0)
  })

  // @clause CL-VALID-014
  it('fails when resilienceRatio is between 0 and 1 for mixed patterns', async () => {
    const ctx = createCtx({
      services: {
        git: createMockGitService({ 'Button.spec.tsx': MIXED_FRAGILE_AND_RESILIENT_CONTENT }),
      } as Partial<ValidationContext['services']> as ValidationContext['services'],
    })

    const output: ValidatorOutput = await TestResilienceCheckValidator.execute(ctx)

    expect(output.metrics!.resilienceRatio).toBeGreaterThan(0)
    expect(output.metrics!.resilienceRatio).toBeLessThan(1)
    expect(typeof output.metrics!.fragilePatternCount).toBe('number')
    expect(typeof output.metrics!.resilientPatternCount).toBe('number')
  })
})
