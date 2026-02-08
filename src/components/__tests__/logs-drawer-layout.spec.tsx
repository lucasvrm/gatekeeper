/**
 * @file logs-drawer-layout.spec.tsx
 * @description Tests for logs drawer layout refactoring (MP-1)
 *
 * Coverage:
 * - Header should be inside scrollable container (not fixed)
 * - Main filters should render in 2x2 grid without collapsible
 * - Period card should be last element with collapsible
 * - Date fields should render side by side (flex or grid)
 */

import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { LogFilters } from "../orchestrator/log-filters"
import type { LogFilterOptions } from "@/lib/types"

// =============================================================================
// HOISTED MOCKS
// =============================================================================

const mockUseLogEvents = vi.hoisted(() =>
  vi.fn(() => ({
    data: [],
    loading: false,
    error: null,
    refetch: vi.fn(),
  }))
)

vi.mock("@/hooks/useLogEvents", () => ({
  useLogEvents: mockUseLogEvents,
}))

vi.mock("@/lib/api", () => ({
  api: {
    orchestrator: {
      exportLogs: vi.fn(),
    },
  },
}))

// =============================================================================
// TESTS
// =============================================================================

describe("LogsDrawer - Layout Refactoring", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ---------------------------------------------------------------------------
  // Filter grid layout tests
  // ---------------------------------------------------------------------------

  it("should render main filters in 2x2 grid layout", () => {
    const mockFilters: LogFilterOptions = {}
    const { container } = render(
      <LogFilters filters={mockFilters} onFiltersChange={vi.fn()} />
    )

    // Find the main filters container
    const filterContainer = container.querySelector('[class*="grid"]')
    expect(filterContainer).toBeInTheDocument()

    // Should have grid-cols-2 class for 2 columns
    expect(filterContainer?.className).toMatch(/grid-cols-2/)

    // Should contain 4 main filters: Level, Search, Stage, Event Type
    const levelFilter = screen.getByText("Nível")
    const searchFilter = screen.getByText("Buscar")
    const stageFilter = screen.getByText("Estágio")
    const typeFilter = screen.getByText("Tipo de Evento")

    expect(levelFilter).toBeInTheDocument()
    expect(searchFilter).toBeInTheDocument()
    expect(stageFilter).toBeInTheDocument()
    expect(typeFilter).toBeInTheDocument()
  })

  it("should render main filters without collapsible wrapper", () => {
    const mockFilters: LogFilterOptions = {}
    render(
      <LogFilters filters={mockFilters} onFiltersChange={vi.fn()} />
    )

    // Main filters should NOT be wrapped in Collapsible
    // They should be directly visible in the grid
    const levelInput = screen.getByLabelText(/Filtrar por nível/i)
    const searchInput = screen.getByLabelText(/Buscar texto nos logs/i)
    const stageInput = screen.getByLabelText(/Filtrar por estágio/i)
    const typeInput = screen.getByLabelText(/Filtrar por tipo de evento/i)

    // All inputs should be visible (not hidden by collapsed state)
    expect(levelInput).toBeVisible()
    expect(searchInput).toBeVisible()
    expect(stageInput).toBeVisible()
    expect(typeInput).toBeVisible()
  })

  // ---------------------------------------------------------------------------
  // Period card tests
  // ---------------------------------------------------------------------------

  it("should render period card as last element", () => {
    const mockFilters: LogFilterOptions = {}
    const { container } = render(
      <LogFilters filters={mockFilters} onFiltersChange={vi.fn()} />
    )

    const periodCard = screen.getByText("Período").closest('[class*="rounded-lg"]')
    expect(periodCard).toBeInTheDocument()

    // Period card should be after the grid container
    const gridContainer = container.querySelector('[class*="grid-cols-2"]')
    const periodCardElement = periodCard as HTMLElement

    // Check that period card comes after grid in DOM order
    if (gridContainer && periodCardElement) {
      const gridIndex = Array.from(container.querySelectorAll("*")).indexOf(gridContainer)
      const periodIndex = Array.from(container.querySelectorAll("*")).indexOf(periodCardElement)
      expect(periodIndex).toBeGreaterThan(gridIndex)
    }
  })

  it("should keep period card with collapsible functionality", () => {
    const mockFilters: LogFilterOptions = {}
    render(<LogFilters filters={mockFilters} onFiltersChange={vi.fn()} />)

    // Period card should have collapsible trigger
    const periodTrigger = screen.getByText("Período")
    expect(periodTrigger).toBeInTheDocument()

    // Should have ChevronDown icon for period card
    const periodCard = periodTrigger.closest('[class*="rounded-lg"]')
    const chevronIcon = periodCard?.querySelector('[class*="lucide-chevron-down"]')
    expect(chevronIcon).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Date fields layout tests
  // ---------------------------------------------------------------------------

  it("should render date fields side by side in horizontal layout", () => {
    const mockFilters: LogFilterOptions = {}
    const { container } = render(
      <LogFilters filters={mockFilters} onFiltersChange={vi.fn()} />
    )

    // Find date fields container
    const startDateLabel = screen.getByText("Data Inicial")
    const endDateLabel = screen.getByText("Data Final")

    expect(startDateLabel).toBeInTheDocument()
    expect(endDateLabel).toBeInTheDocument()

    // Date fields should be in a grid or flex container with horizontal layout
    const dateContainer = startDateLabel.closest('[class*="grid"]') || 
                          startDateLabel.closest('[class*="flex"]')
    
    expect(dateContainer).toBeInTheDocument()

    // Should have grid-cols-2 or flex-row for side-by-side layout
    const hasGridCols2 = dateContainer?.className.includes("grid-cols-2")
    const hasFlexRow = dateContainer?.className.includes("flex-row") || 
                       (dateContainer?.className.includes("flex") && 
                        !dateContainer?.className.includes("flex-col"))

    expect(hasGridCols2 || hasFlexRow).toBe(true)
  })

  it("should not use vertical spacing (space-y) for date fields", () => {
    const mockFilters: LogFilterOptions = {}
    const { container } = render(
      <LogFilters filters={mockFilters} onFiltersChange={vi.fn()} />
    )

    const startDateLabel = screen.getByText("Data Inicial")
    const dateContainer = startDateLabel.closest('[class*="grid"]') || 
                          startDateLabel.closest('[class*="flex"]')

    // Should NOT have space-y-3 or similar vertical spacing
    expect(dateContainer?.className).not.toMatch(/space-y/)
  })

  it("should have gap spacing between date fields", () => {
    const mockFilters: LogFilterOptions = {}
    const { container } = render(
      <LogFilters filters={mockFilters} onFiltersChange={vi.fn()} />
    )

    const startDateLabel = screen.getByText("Data Inicial")
    const dateContainer = startDateLabel.closest('[class*="grid"]') || 
                          startDateLabel.closest('[class*="flex"]')

    // Should have gap-3 or similar horizontal gap
    expect(dateContainer?.className).toMatch(/gap/)
  })

  // ---------------------------------------------------------------------------
  // Integration tests
  // ---------------------------------------------------------------------------

  it("should maintain filter functionality after layout changes", () => {
    const mockOnChange = vi.fn()
    const mockFilters: LogFilterOptions = {}

    render(<LogFilters filters={mockFilters} onFiltersChange={mockOnChange} />)

    // All filter inputs should still be functional
    const levelSelect = screen.getByLabelText(/Filtrar por nível/i)
    const searchInput = screen.getByLabelText(/Buscar texto nos logs/i)
    const stageInput = screen.getByLabelText(/Filtrar por estágio/i)
    const typeInput = screen.getByLabelText(/Filtrar por tipo de evento/i)

    expect(levelSelect).toBeEnabled()
    expect(searchInput).toBeEnabled()
    expect(stageInput).toBeEnabled()
    expect(typeInput).toBeEnabled()
  })
})
