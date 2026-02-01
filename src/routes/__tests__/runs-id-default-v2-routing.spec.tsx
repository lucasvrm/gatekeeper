/**
 * @file runs-id-default-v2-routing.spec.tsx
 * @description Contract spec — default routing for /runs/:id → RunDetailsPageV2 with legacy preserved
 * @contract runs-id-default-v2-routing
 * @mode STRICT
 */

import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { App } from '@/App'

// =============================================================================
// Helper
// =============================================================================

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  )
}

// =============================================================================
// Tests — Contract clauses
// =============================================================================

describe('Routing contract — /runs/:id default V2 with legacy preserved', () => {
  // ---------------------------------------------------------------------------
  // CL-ROUTE-001
  // ---------------------------------------------------------------------------

  // @clause CL-ROUTE-001
  it('success when navigating to /runs/:id renders RunDetailsPageV2', async () => {
    renderAt('/runs/123')
    expect(await screen.findByTestId('run-details-page-v2')).toBeInTheDocument()
  })

  // @clause CL-ROUTE-001
  it('success when navigating to /runs/:id does not render legacy page', async () => {
    renderAt('/runs/456')
    expect(screen.queryByTestId('run-details-page-legacy')).not.toBeInTheDocument()
  })

  // @clause CL-ROUTE-001
  it('fails when navigating to /runs/:id still renders legacy RunDetailsPage', async () => {
    renderAt('/runs/789')
    expect(screen.queryByTestId('run-details-page-legacy')).not.toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // CL-ROUTE-002
  // ---------------------------------------------------------------------------

  // @clause CL-ROUTE-002
  it('success when navigating to /runs/:id/legacy renders legacy RunDetailsPage', async () => {
    renderAt('/runs/123/legacy')
    expect(await screen.findByTestId('run-details-page-legacy')).toBeInTheDocument()
  })

  // @clause CL-ROUTE-002
  it('success when navigating to /runs/:id/legacy does not render V2 page', async () => {
    renderAt('/runs/456/legacy')
    expect(screen.queryByTestId('run-details-page-v2')).not.toBeInTheDocument()
  })

  // @clause CL-ROUTE-002
  it('fails when navigating to /runs/:id/legacy renders RunDetailsPageV2 instead of legacy', async () => {
    renderAt('/runs/999/legacy')
    expect(screen.queryByTestId('run-details-page-v2')).not.toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // CL-ROUTE-003
  // ---------------------------------------------------------------------------

  // @clause CL-ROUTE-003
  it('success when internal run links point to /runs/:id', async () => {
    renderAt('/')

    const runLinks = screen
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'))
      .filter(Boolean)
      .filter((href) => href!.startsWith('/runs/'))

    expect(runLinks.length).toBeGreaterThan(0)

    for (const href of runLinks) {
      expect(href).toMatch(/^\/runs\/[^/]+$/)
    }
  })

  // @clause CL-ROUTE-003
  it('success when internal navigation resolves to V2 page', async () => {
    renderAt('/runs/321')
    expect(await screen.findByTestId('run-details-page-v2')).toBeInTheDocument()
  })

  // @clause CL-ROUTE-003
  it('fails when any internal run link points to /runs/:id/legacy', async () => {
    renderAt('/')

    const legacyLinks = screen
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'))
      .filter(Boolean)
      .filter((href) => href!.includes('/runs/') && href!.includes('/legacy'))

    expect(legacyLinks.length).toBe(0)
  })
})
