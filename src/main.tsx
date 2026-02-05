import { createRoot } from 'react-dom/client'
import "./main.css"
import "./styles/theme.css"
import "./index.css"

const root = document.getElementById('root')!

// Load Gatekeeper app with error boundary
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
