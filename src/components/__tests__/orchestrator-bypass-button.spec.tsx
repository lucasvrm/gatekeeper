/**
 * @file orchestrator-bypass-button.spec.tsx
 * @description TDD tests for Bypass button and dropdown in validation failed card
 *
 * Validates that:
 * - Bypass button renders when validationStatus is FAILED
 * - Dropdown opens when button is clicked
 * - Dropdown lists only validators that are FAILED + isHardBlock + !bypassed
 * - Clicking a validator calls api.runs.bypassValidator with correct runId and validatorCode
 *
 * TDD: These tests define expected behavior - implementation to follow
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { api } from '@/lib/api'

// ============================================================================
// MOCKS
// ============================================================================

// Mock API
vi.mock('@/lib/api', () => ({
  api: {
    runs: {
      bypassValidator: vi.fn(),
    },
  },
}))

// ============================================================================
// TEST COMPONENT (simplified version of orchestrator-page.tsx validation card)
// ============================================================================

interface ValidatorResult {
  validatorCode: string
  validatorName: string
  passed: boolean
  isHardBlock: boolean
  bypassed?: boolean
  message?: string
}

interface BypassButtonProps {
  runId: string
  validationStatus: 'PASSED' | 'FAILED' | 'PENDING'
  validatorResults: ValidatorResult[]
}

// Simplified component that represents the Bypass button behavior
function BypassButton({ runId, validationStatus, validatorResults }: BypassButtonProps) {
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false)

  // Only show button when validation has failed
  if (validationStatus !== 'FAILED') {
    return null
  }

  // Filter validators: FAILED (not passed) + isHardBlock + not already bypassed
  const bypassableValidators = validatorResults.filter(
    v => !v.passed && v.isHardBlock && !v.bypassed
  )

  // Hide button if no validators can be bypassed
  if (bypassableValidators.length === 0) {
    return null
  }

  const handleBypassClick = async (validatorCode: string) => {
    try {
      await api.runs.bypassValidator(runId, validatorCode)
      setIsDropdownOpen(false)
    } catch (error) {
      console.error('Failed to bypass validator:', error)
    }
  }

  return (
    <div data-testid="bypass-container">
      <button
        data-testid="bypass-button"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        aria-label="Bypass failed validators"
      >
        Bypass Validator
      </button>

      {isDropdownOpen && (
        <div data-testid="bypass-dropdown" role="menu">
          {bypassableValidators.map(validator => (
            <button
              key={validator.validatorCode}
              data-testid={`bypass-option-${validator.validatorCode}`}
              onClick={() => handleBypassClick(validator.validatorCode)}
              role="menuitem"
            >
              <span className="validator-code">{validator.validatorCode}</span>
              <span className="validator-name">{validator.validatorName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Import React for JSX
import * as React from 'react'

// ============================================================================
// TESTS
// ============================================================================

describe('Bypass Button - Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render when validationStatus is FAILED', () => {
    const mockValidators: ValidatorResult[] = [
      {
        validatorCode: 'TEST_COVERAGE',
        validatorName: 'Test Coverage',
        passed: false,
        isHardBlock: true,
        bypassed: false,
      },
    ]

    render(
      <BypassButton
        runId="run-123"
        validationStatus="FAILED"
        validatorResults={mockValidators}
      />
    )

    expect(screen.getByTestId('bypass-button')).toBeInTheDocument()
  })

  it('should NOT render when validationStatus is PASSED', () => {
    const mockValidators: ValidatorResult[] = [
      {
        validatorCode: 'TEST_COVERAGE',
        validatorName: 'Test Coverage',
        passed: true,
        isHardBlock: true,
      },
    ]

    render(
      <BypassButton
        runId="run-123"
        validationStatus="PASSED"
        validatorResults={mockValidators}
      />
    )

    expect(screen.queryByTestId('bypass-button')).not.toBeInTheDocument()
  })

  it('should NOT render when validationStatus is PENDING', () => {
    const mockValidators: ValidatorResult[] = [
      {
        validatorCode: 'TEST_COVERAGE',
        validatorName: 'Test Coverage',
        passed: false,
        isHardBlock: true,
      },
    ]

    render(
      <BypassButton
        runId="run-123"
        validationStatus="PENDING"
        validatorResults={mockValidators}
      />
    )

    expect(screen.queryByTestId('bypass-button')).not.toBeInTheDocument()
  })

  it('should NOT render when no bypassable validators exist', () => {
    // All validators either passed, not hard block, or already bypassed
    const mockValidators: ValidatorResult[] = [
      {
        validatorCode: 'TEST_COVERAGE',
        validatorName: 'Test Coverage',
        passed: true, // passed - not bypassable
        isHardBlock: true,
      },
      {
        validatorCode: 'LINT_PASS',
        validatorName: 'Lint Check',
        passed: false,
        isHardBlock: false, // not hard block - not bypassable
      },
      {
        validatorCode: 'TYPE_CHECK',
        validatorName: 'Type Check',
        passed: false,
        isHardBlock: true,
        bypassed: true, // already bypassed - not bypassable
      },
    ]

    render(
      <BypassButton
        runId="run-123"
        validationStatus="FAILED"
        validatorResults={mockValidators}
      />
    )

    expect(screen.queryByTestId('bypass-button')).not.toBeInTheDocument()
  })
})

describe('Bypass Button - Dropdown Interaction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should open dropdown when button is clicked', async () => {
    const mockValidators: ValidatorResult[] = [
      {
        validatorCode: 'TEST_COVERAGE',
        validatorName: 'Test Coverage',
        passed: false,
        isHardBlock: true,
      },
    ]

    render(
      <BypassButton
        runId="run-123"
        validationStatus="FAILED"
        validatorResults={mockValidators}
      />
    )

    const button = screen.getByTestId('bypass-button')

    // Dropdown should not be visible initially
    expect(screen.queryByTestId('bypass-dropdown')).not.toBeInTheDocument()

    // Click to open
    fireEvent.click(button)

    // Dropdown should now be visible
    await waitFor(() => {
      expect(screen.getByTestId('bypass-dropdown')).toBeInTheDocument()
    })
  })

  it('should close dropdown when button is clicked again', async () => {
    const mockValidators: ValidatorResult[] = [
      {
        validatorCode: 'TEST_COVERAGE',
        validatorName: 'Test Coverage',
        passed: false,
        isHardBlock: true,
      },
    ]

    render(
      <BypassButton
        runId="run-123"
        validationStatus="FAILED"
        validatorResults={mockValidators}
      />
    )

    const button = screen.getByTestId('bypass-button')

    // Open dropdown
    fireEvent.click(button)
    await waitFor(() => {
      expect(screen.getByTestId('bypass-dropdown')).toBeInTheDocument()
    })

    // Close dropdown
    fireEvent.click(button)
    await waitFor(() => {
      expect(screen.queryByTestId('bypass-dropdown')).not.toBeInTheDocument()
    })
  })
})

describe('Bypass Button - Validator Filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should list only validators that are FAILED + isHardBlock + !bypassed', async () => {
    const mockValidators: ValidatorResult[] = [
      // Should appear (failed + hard block + not bypassed)
      {
        validatorCode: 'TEST_COVERAGE',
        validatorName: 'Test Coverage',
        passed: false,
        isHardBlock: true,
        bypassed: false,
      },
      // Should NOT appear (passed)
      {
        validatorCode: 'LINT_PASS',
        validatorName: 'Lint Check',
        passed: true,
        isHardBlock: true,
        bypassed: false,
      },
      // Should NOT appear (not hard block)
      {
        validatorCode: 'STYLE_WARNING',
        validatorName: 'Style Warning',
        passed: false,
        isHardBlock: false,
        bypassed: false,
      },
      // Should NOT appear (already bypassed)
      {
        validatorCode: 'TYPE_CHECK',
        validatorName: 'Type Check',
        passed: false,
        isHardBlock: true,
        bypassed: true,
      },
      // Should appear (failed + hard block + not bypassed)
      {
        validatorCode: 'IMPORT_REALITY',
        validatorName: 'Import Reality Check',
        passed: false,
        isHardBlock: true,
        bypassed: false,
      },
    ]

    render(
      <BypassButton
        runId="run-123"
        validationStatus="FAILED"
        validatorResults={mockValidators}
      />
    )

    // Open dropdown
    fireEvent.click(screen.getByTestId('bypass-button'))

    await waitFor(() => {
      expect(screen.getByTestId('bypass-dropdown')).toBeInTheDocument()
    })

    // Should show only 2 validators (TEST_COVERAGE and IMPORT_REALITY)
    expect(screen.getByTestId('bypass-option-TEST_COVERAGE')).toBeInTheDocument()
    expect(screen.getByTestId('bypass-option-IMPORT_REALITY')).toBeInTheDocument()

    // Should NOT show the other validators
    expect(screen.queryByTestId('bypass-option-LINT_PASS')).not.toBeInTheDocument()
    expect(screen.queryByTestId('bypass-option-STYLE_WARNING')).not.toBeInTheDocument()
    expect(screen.queryByTestId('bypass-option-TYPE_CHECK')).not.toBeInTheDocument()
  })

  it('should display validator code and name for each option', async () => {
    const mockValidators: ValidatorResult[] = [
      {
        validatorCode: 'TEST_COVERAGE',
        validatorName: 'Test Coverage Validator',
        passed: false,
        isHardBlock: true,
      },
    ]

    render(
      <BypassButton
        runId="run-123"
        validationStatus="FAILED"
        validatorResults={mockValidators}
      />
    )

    // Open dropdown
    fireEvent.click(screen.getByTestId('bypass-button'))

    await waitFor(() => {
      const option = screen.getByTestId('bypass-option-TEST_COVERAGE')
      expect(option).toHaveTextContent('TEST_COVERAGE')
      expect(option).toHaveTextContent('Test Coverage Validator')
    })
  })
})

describe('Bypass Button - API Call', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should call api.runs.bypassValidator with correct runId and validatorCode when validator is clicked', async () => {
    const mockBypassValidator = vi.mocked(api.runs.bypassValidator)
    mockBypassValidator.mockResolvedValue({
      message: 'Validator bypassed successfully',
      runId: 'run-123',
    })

    const mockValidators: ValidatorResult[] = [
      {
        validatorCode: 'TEST_COVERAGE',
        validatorName: 'Test Coverage',
        passed: false,
        isHardBlock: true,
      },
    ]

    render(
      <BypassButton
        runId="run-123"
        validationStatus="FAILED"
        validatorResults={mockValidators}
      />
    )

    // Open dropdown
    fireEvent.click(screen.getByTestId('bypass-button'))

    await waitFor(() => {
      expect(screen.getByTestId('bypass-dropdown')).toBeInTheDocument()
    })

    // Click validator option
    const option = screen.getByTestId('bypass-option-TEST_COVERAGE')
    fireEvent.click(option)

    // Verify API was called with correct parameters
    await waitFor(() => {
      expect(mockBypassValidator).toHaveBeenCalledWith('run-123', 'TEST_COVERAGE')
      expect(mockBypassValidator).toHaveBeenCalledTimes(1)
    })
  })

  it('should call api.runs.bypassValidator with correct validatorCode for different validators', async () => {
    const mockBypassValidator = vi.mocked(api.runs.bypassValidator)
    mockBypassValidator.mockResolvedValue({
      message: 'Validator bypassed successfully',
      runId: 'run-456',
    })

    const mockValidators: ValidatorResult[] = [
      {
        validatorCode: 'TEST_COVERAGE',
        validatorName: 'Test Coverage',
        passed: false,
        isHardBlock: true,
      },
      {
        validatorCode: 'IMPORT_REALITY',
        validatorName: 'Import Reality Check',
        passed: false,
        isHardBlock: true,
      },
    ]

    render(
      <BypassButton
        runId="run-456"
        validationStatus="FAILED"
        validatorResults={mockValidators}
      />
    )

    // Open dropdown
    fireEvent.click(screen.getByTestId('bypass-button'))

    await waitFor(() => {
      expect(screen.getByTestId('bypass-dropdown')).toBeInTheDocument()
    })

    // Click second validator option
    const option = screen.getByTestId('bypass-option-IMPORT_REALITY')
    fireEvent.click(option)

    // Verify API was called with correct parameters
    await waitFor(() => {
      expect(mockBypassValidator).toHaveBeenCalledWith('run-456', 'IMPORT_REALITY')
      expect(mockBypassValidator).toHaveBeenCalledTimes(1)
    })
  })

  it('should close dropdown after successful bypass', async () => {
    const mockBypassValidator = vi.mocked(api.runs.bypassValidator)
    mockBypassValidator.mockResolvedValue({
      message: 'Validator bypassed successfully',
      runId: 'run-123',
    })

    const mockValidators: ValidatorResult[] = [
      {
        validatorCode: 'TEST_COVERAGE',
        validatorName: 'Test Coverage',
        passed: false,
        isHardBlock: true,
      },
    ]

    render(
      <BypassButton
        runId="run-123"
        validationStatus="FAILED"
        validatorResults={mockValidators}
      />
    )

    // Open dropdown
    fireEvent.click(screen.getByTestId('bypass-button'))
    await waitFor(() => {
      expect(screen.getByTestId('bypass-dropdown')).toBeInTheDocument()
    })

    // Click validator option
    const option = screen.getByTestId('bypass-option-TEST_COVERAGE')
    fireEvent.click(option)

    // Wait for API call to complete and dropdown to close
    await waitFor(() => {
      expect(mockBypassValidator).toHaveBeenCalled()
      expect(screen.queryByTestId('bypass-dropdown')).not.toBeInTheDocument()
    })
  })

  it('should handle API errors gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const mockBypassValidator = vi.mocked(api.runs.bypassValidator)
    mockBypassValidator.mockRejectedValue(new Error('API Error: Unauthorized'))

    const mockValidators: ValidatorResult[] = [
      {
        validatorCode: 'TEST_COVERAGE',
        validatorName: 'Test Coverage',
        passed: false,
        isHardBlock: true,
      },
    ]

    render(
      <BypassButton
        runId="run-123"
        validationStatus="FAILED"
        validatorResults={mockValidators}
      />
    )

    // Open dropdown
    fireEvent.click(screen.getByTestId('bypass-button'))
    await waitFor(() => {
      expect(screen.getByTestId('bypass-dropdown')).toBeInTheDocument()
    })

    // Click validator option
    const option = screen.getByTestId('bypass-option-TEST_COVERAGE')
    fireEvent.click(option)

    // Wait for API call to fail
    await waitFor(() => {
      expect(mockBypassValidator).toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to bypass validator:',
        expect.any(Error)
      )
    })

    consoleErrorSpy.mockRestore()
  })
})

describe('Bypass Button - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should handle empty validatorResults array', () => {
    render(
      <BypassButton
        runId="run-123"
        validationStatus="FAILED"
        validatorResults={[]}
      />
    )

    // Button should not render when no validators exist
    expect(screen.queryByTestId('bypass-button')).not.toBeInTheDocument()
  })

  it('should handle validators with bypassed=undefined (treat as not bypassed)', async () => {
    const mockValidators: ValidatorResult[] = [
      {
        validatorCode: 'TEST_COVERAGE',
        validatorName: 'Test Coverage',
        passed: false,
        isHardBlock: true,
        // bypassed is undefined (not explicitly set)
      },
    ]

    render(
      <BypassButton
        runId="run-123"
        validationStatus="FAILED"
        validatorResults={mockValidators}
      />
    )

    // Button should render (treat undefined as false)
    expect(screen.getByTestId('bypass-button')).toBeInTheDocument()

    // Open dropdown
    fireEvent.click(screen.getByTestId('bypass-button'))

    await waitFor(() => {
      expect(screen.getByTestId('bypass-option-TEST_COVERAGE')).toBeInTheDocument()
    })
  })

  it('should handle multiple failed validators correctly', async () => {
    const mockBypassValidator = vi.mocked(api.runs.bypassValidator)
    mockBypassValidator.mockResolvedValue({
      message: 'Validator bypassed successfully',
      runId: 'run-123',
    })

    const mockValidators: ValidatorResult[] = [
      {
        validatorCode: 'TEST_COVERAGE',
        validatorName: 'Test Coverage',
        passed: false,
        isHardBlock: true,
      },
      {
        validatorCode: 'LINT_CHECK',
        validatorName: 'Lint Check',
        passed: false,
        isHardBlock: true,
      },
      {
        validatorCode: 'TYPE_CHECK',
        validatorName: 'Type Check',
        passed: false,
        isHardBlock: true,
      },
    ]

    render(
      <BypassButton
        runId="run-123"
        validationStatus="FAILED"
        validatorResults={mockValidators}
      />
    )

    // Open dropdown
    fireEvent.click(screen.getByTestId('bypass-button'))

    await waitFor(() => {
      expect(screen.getByTestId('bypass-dropdown')).toBeInTheDocument()
    })

    // All three validators should be in dropdown
    expect(screen.getByTestId('bypass-option-TEST_COVERAGE')).toBeInTheDocument()
    expect(screen.getByTestId('bypass-option-LINT_CHECK')).toBeInTheDocument()
    expect(screen.getByTestId('bypass-option-TYPE_CHECK')).toBeInTheDocument()

    // Bypass one validator
    fireEvent.click(screen.getByTestId('bypass-option-LINT_CHECK'))

    await waitFor(() => {
      expect(mockBypassValidator).toHaveBeenCalledWith('run-123', 'LINT_CHECK')
    })
  })
})
