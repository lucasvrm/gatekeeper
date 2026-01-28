import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { ThemeDetailed, LayoutConfig } from '@/lib/types'
import { ThemeInjector } from '@/services/theme-injector'

export function useActiveTheme() {
  const [theme, setTheme] = useState<ThemeDetailed | null>(null)
  const [layoutConfig, setLayoutConfig] = useState<LayoutConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadTheme = async () => {
      try {
        setLoading(true)
        const activeTheme = await api.theme.getActive()

        if (activeTheme) {
          setTheme(activeTheme)
          setLayoutConfig(activeTheme.layoutConfig)
          // Injects CSS into <style id="uild-theme"> element
          ThemeInjector.inject(activeTheme.cssVariables)
        } else {
          setTheme(null)
          setLayoutConfig(null)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load theme')
      } finally {
        setLoading(false)
      }
    }

    loadTheme()
  }, [])

  return { theme, layoutConfig, loading, error }
}
