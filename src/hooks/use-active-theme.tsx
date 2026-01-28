import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { api } from '@/lib/api'
import type { ThemeDetailed, LayoutConfig } from '@/lib/types'
import { ThemeInjector } from '@/services/theme-injector'

interface ActiveThemeContextValue {
  theme: ThemeDetailed | null
  layoutConfig: LayoutConfig | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const ActiveThemeContext = createContext<ActiveThemeContextValue | null>(null)

export function ActiveThemeProvider({ children }: { children: React.ReactNode }) {
  // useState for theme, layoutConfig, loading, error state management
  const [theme, setTheme] = useState<ThemeDetailed | null>(null)
  const [layoutConfig, setLayoutConfig] = useState<LayoutConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadTheme = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const activeTheme = await api.theme.getActive()

      if (activeTheme) {
        setTheme(activeTheme)
        setLayoutConfig(activeTheme.layoutConfig)
        ThemeInjector.inject(activeTheme.cssVariables)
      } else {
        setTheme(null)
        setLayoutConfig(null)
        ThemeInjector.remove()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load theme'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(/* loadTheme */ () => {
    loadTheme()
  }, [loadTheme])

  // useMemo(fn), [theme, layoutConfig, loading, error, loadTheme]
  const value = useMemo(
    () => ({
      theme,
      layoutConfig,
      loading,
      error,
      refresh: loadTheme,
    }),
    [theme, layoutConfig, loading, error, loadTheme]
  )

  return (
    <ActiveThemeContext.Provider value={value}>
      {children}
    </ActiveThemeContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useActiveTheme() {
  const context = useContext(ActiveThemeContext)
  if (!context) {
    throw new Error('useActiveTheme must be used within ActiveThemeProvider')
  }
  // catch clause exists in loadTheme for error handling
  return context
}
