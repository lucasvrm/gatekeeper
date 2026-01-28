import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { Theme, ThemePreset, ThemePreviewResponse, Project } from '@/lib/types'
import { ThemeUploadZone } from './theme-upload-zone'
import { ThemePreviewPanel } from './theme-preview-panel'
import { ThemeListItem } from './theme-list-item'

export function ThemeSettingsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [loadingProjects, setLoadingProjects] = useState(true)

  const [themes, setThemes] = useState<Theme[]>([])
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<ThemePreviewResponse | null>(null)
  const [currentPreset, setCurrentPreset] = useState<ThemePreset | null>(null)

  useEffect(() => {
    const loadProjects = async () => {
      try {
        setLoadingProjects(true)
        const result = await api.projects.list(1, 100)
        setProjects(result.data)
        if (result.data.length > 0) {
          setSelectedProjectId(result.data[0].id)
        }
      } catch (error) {
        toast.error('Failed to load projects')
      } finally {
        setLoadingProjects(false)
      }
    }
    loadProjects()
  }, [])

  const loadThemes = async () => {
    if (!selectedProjectId) return
    try {
      setLoading(true)
      const result = await api.theme.list(selectedProjectId)
      setThemes(result.themes)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load themes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedProjectId) {
      loadThemes()
      setPreview(null)
      setCurrentPreset(null)
    }
  }, [selectedProjectId])

  const handlePreview = async (preset: ThemePreset) => {
    try {
      const result = await api.theme.preview(preset)
      setPreview(result)
      setCurrentPreset(preset)
    } catch (error) {
      toast.error('Failed to preview theme')
    }
  }

  const handleApply = async () => {
    if (!currentPreset || !selectedProjectId) return

    try {
      await api.theme.create(selectedProjectId, currentPreset)
      toast.success('Theme created successfully')
      setPreview(null)
      setCurrentPreset(null)
      await loadThemes()
    } catch (error: any) {
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
    if (!selectedProjectId) return
    try {
      await api.theme.activate(selectedProjectId, themeId)
      toast.success('Theme activated')
      await loadThemes()
    } catch (error) {
      toast.error('Failed to activate theme')
    }
  }

  const handleDelete = async (themeId: string) => {
    if (!selectedProjectId) return
    try {
      await api.theme.delete(selectedProjectId, themeId)
      toast.success('Theme deleted')
      await loadThemes()
    } catch (error: any) {
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
        <p className="text-muted-foreground mt-2">Upload and manage themes for your projects</p>
      </div>

      <div>
        <label htmlFor="project-selector" className="block text-sm font-medium mb-2">
          Select Project
        </label>
        {loadingProjects ? (
          <div className="text-muted-foreground">Loading projects...</div>
        ) : projects.length === 0 ? (
          <div className="text-muted-foreground">No projects found. Create a project first.</div>
        ) : (
          <select
            id="project-selector"
            value={selectedProjectId || ''}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full max-w-md px-3 py-2 border border-border rounded-lg bg-background text-foreground"
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name} {project.workspace?.name ? `(${project.workspace.name})` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {selectedProjectId && (
        <>
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
        </>
      )}
    </div>
  )
}
