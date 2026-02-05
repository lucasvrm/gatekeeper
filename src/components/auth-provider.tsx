import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { api, API_BASE } from '@/lib/api'

// ─── Types ───────────────────────────────────────────────────────────────────

interface User {
  id: string
  email: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
}

const TOKEN_KEY = 'token'
const PUBLIC_PATHS = ['/login', '/register']

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null)

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()
  const location = useLocation()

  // Validate token with backend on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem(TOKEN_KEY)

      if (!token) {
        setIsLoading(false)
        if (!PUBLIC_PATHS.includes(location.pathname)) {
          navigate('/login', { replace: true })
        }
        return
      }

      // Validate token by calling /api/auth/me
      try {
        const response = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!response.ok) {
          // Token invalid or expired — clear and redirect
          localStorage.removeItem(TOKEN_KEY)
          setUser(null)
          setIsLoading(false)
          if (!PUBLIC_PATHS.includes(location.pathname)) {
            navigate('/login', { replace: true })
          }
          return
        }

        const data = await response.json()
        setUser(data.user)
      } catch {
        // Network error — clear token
        localStorage.removeItem(TOKEN_KEY)
        setUser(null)
        if (!PUBLIC_PATHS.includes(location.pathname)) {
          navigate('/login', { replace: true })
        }
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
    // Only run on mount — location changes are handled by ProtectedRoute
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.auth.login(email, password)
    localStorage.setItem(TOKEN_KEY, data.token)
    setUser(data.user)
    navigate('/')
  }, [navigate])

  const register = useCallback(async (email: string, password: string) => {
    await api.auth.register(email, password)
    // Backend register doesn't return token — redirect to login
    navigate('/login')
  }, [navigate])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
    navigate('/login')
  }, [navigate])

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
