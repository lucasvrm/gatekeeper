import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './auth-provider'

/**
 * Wrapper that blocks unauthenticated users from accessing private routes.
 * Redirects to /login preserving the original URL in location state
 * so the user can be sent back after login.
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Verificando autenticacao...</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
