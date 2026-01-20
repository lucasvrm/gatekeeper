import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'

vi.mock('@/lib/api', () => ({
  api: {
    runs: {
      create: vi.fn(),
      uploadFiles: vi.fn(),
      bypassValidator: vi.fn(),
    },
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { RunPanel } from '@/components/run-panel'

const renderWithRouter = (component: React.ReactNode) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  )
}

const mockRunWithResults = {
  id: 'test-run-123',
  outputId: 'output-123',
  status: 'PASSED' as const,
  passed: true,
  runType: 'CONTRACT' as const,
  currentGate: 1,
  failedAt: null,
  taskPrompt: 'Test task prompt',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  gateResults: [
    {
      id: 'gate-0',
      gateNumber: 0,
      gateName: 'SANITIZATION',
      status: 'PASSED' as const,
      passed: true,
      passedCount: 4,
      failedCount: 0,
      warningCount: 1,
      skippedCount: 0,
      completedAt: new Date().toISOString(),
    },
    {
      id: 'gate-1',
      gateNumber: 1,
      gateName: 'CONTRACT',
      status: 'PASSED' as const,
      passed: true,
      passedCount: 8,
      failedCount: 2,
      warningCount: 0,
      skippedCount: 1,
      completedAt: new Date().toISOString(),
    },
  ],
  validatorResults: [],
}

describe('Debug RunPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should debug the rendered content', () => {
    const { container } = renderWithRouter(
      <RunPanel
        run={mockRunWithResults}
        onUploadSuccess={() => {}}
      />
    )
    console.log(container.innerHTML)
    const allText = container.textContent
    console.log('All text:', allText)
    console.log('Has "4 Passed":', allText?.includes('4 Passed'))
    console.log('Has "8 Passed":', allText?.includes('8 Passed'))
    console.log('Has "0 Failed":', allText?.includes('0 Failed'))
    console.log('Has "2 Failed":', allText?.includes('2 Failed'))
  })
})
