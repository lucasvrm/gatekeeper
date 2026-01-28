import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { Theme, ThemePreset, ThemePreviewResponse } from '@/lib/types'
import { ThemeUploadZone } from './theme-upload-zone'
import { ThemePreviewPanel } from './theme-preview-panel'
import { ThemeListItem } from './theme-list-item'
import { useActiveTheme } from '@/hooks/use-active-theme'

export function ThemeSettingsPage() {
  const { refresh } = useActiveTheme()
  const [themes, setThemes] = useState<Theme[]>([])
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<ThemePreviewResponse | null>(null)
  const [currentPreset, setCurrentPreset] = useState<ThemePreset | null>(null)

  const loadThemes = async () => {
    try {
      setLoading(true)
      const result = await api.theme.list()
      setThemes(result.themes)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load themes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadThemes()
  }, [])

  const handlePreview = async (preset: ThemePreset) => {
    try {
      const result = await api.theme.preview(preset)
      setPreview(result)
      setCurrentPreset(preset)
    } catch {
      toast.error('Failed to preview theme')
    }
  }

  const handleApply = async () => {
    if (!currentPreset) return

    try {
      await api.theme.create(currentPreset)
      toast.success('Theme created successfully')
      setPreview(null)
      setCurrentPreset(null)
      await loadThemes()
      await refresh()
    } catch (err: unknown) {
      const error = err as { error?: { code?: string } }
      if (error?.error?.code === 'INVALID_PRESET') {
        toast.error('Invalid theme preset')
      } else {
        toast.error('Failed to create theme')
      }
    }
  }

  const handleCancel = () => {
    setPreview(null)
    setCurrentPreset(null)
  }

  const handleActivate = async (themeId: string) => {
    try {
      await api.theme.activate(themeId)
      toast.success('Theme activated')
      await loadThemes()
      await refresh()
    } catch {
      toast.error('Failed to activate theme')
    }
  }

  const handleDelete = async (themeId: string) => {
    try {
      await api.theme.delete(themeId)
      toast.success('Theme deleted')
      await loadThemes()
      await refresh()
    } catch (err: unknown) {
      const error = err as { error?: { code?: string } }
      if (error?.error?.code === 'CANNOT_DELETE_ACTIVE_THEME') {
        toast.error('Cannot delete active theme')
      } else {
        toast.error('Failed to delete theme')
      }
    }
  }

  return (
    <div data-testid="theme-settings-page" className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Theme Settings</h1>
        <p className="text-muted-foreground mt-2">Upload and manage global application themes</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">Upload Theme</h2>
          <ThemeUploadZone onPreview={handlePreview} />
        </div>

        {preview && <ThemePreviewPanel preview={preview} onApply={handleApply} onCancel={handleCancel} />}
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Installed Themes</h2>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading themes...</div>
        ) : themes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No themes installed yet</div>
        ) : (
          <div className="space-y-3">
            {themes.map((theme) => (
              <ThemeListItem key={theme.id} theme={theme} onActivate={handleActivate} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
