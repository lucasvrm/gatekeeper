import { createRoot } from 'react-dom/client'
import "./main.css"
import "./styles/theme.css"
import "./index.css"

const root = document.getElementById('root')!

// ============================================================================
// Easyblocks Canvas Iframe Detection
//
// Easyblocks creates an iframe that loads the SAME URL as the parent.
// If we let it go through App.tsx, the BrowserRouter has no /__orqui route
// and the catch-all redirects to "/" — rendering the full Gatekeeper
// dashboard inside the canvas iframe.
//
// We MUST intercept HERE, before App/Router/AppShell load.
// ============================================================================
const isEasyblocksCanvasIframe =
  window.self !== window.parent &&
  window.location.pathname.includes('__orqui')

if (isEasyblocksCanvasIframe) {
  // ── CANVAS MODE ──────────────────────────────────────────────────────
  // Dynamic import: only load the canvas renderer (no App, no router)
  import('../packages/orqui/src/editor/easyblocks/CanvasEntry').then(
    ({ EasyblocksCanvasEntry }) => {
      createRoot(root).render(<EasyblocksCanvasEntry />)
    }
  )
} else {
  // ── NORMAL MODE ──────────────────────────────────────────────────────
  // Full Gatekeeper app with router, AppShell, everything
  Promise.all([
    import('./App'),
    import('react-error-boundary'),
    import('./ErrorFallback'),
  ]).then(([{ default: App }, { ErrorBoundary }, { ErrorFallback }]) => {
    createRoot(root).render(
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <App />
      </ErrorBoundary>
    )
  })
}
