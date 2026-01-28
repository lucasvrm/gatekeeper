import { useState, useCallback } from 'react'
import { Upload } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import type { ThemePreset } from '@/lib/types'
import { toast } from 'sonner'

interface ThemeUploadZoneProps {
  onPreview: (preset: ThemePreset) => void
}

export function ThemeUploadZone({ onPreview }: ThemeUploadZoneProps) {
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback(
    (file: File) => {
      setError(null)

      if (!file.name.endsWith('.json') && file.type !== 'application/json') {
        const errorMsg = 'Only JSON files are accepted'
        setError(errorMsg)
        toast.error(errorMsg)
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string
          const preset = JSON.parse(content) as ThemePreset

          if (!preset.version || !preset.metadata || !preset.components) {
            throw new Error('Invalid preset format')
          }

          onPreview(preset)
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Failed to parse JSON file'
          setError(errorMsg)
          toast.error(errorMsg)
        }
      }

      reader.onerror = () => {
        const errorMsg = 'Failed to read file'
        setError(errorMsg)
        toast.error(errorMsg)
      }

      reader.readAsText(file)
    },
    [onPreview]
  )

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFile(e.dataTransfer.files[0])
      }
    },
    [handleFile]
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        handleFile(e.target.files[0])
      }
    },
    [handleFile]
  )

  return (
    <div
      data-testid="theme-upload-zone"
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      className={cn(
        'relative border-2 border-dashed rounded-lg p-12 transition-colors',
        dragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
        error && 'border-destructive'
      )}
    >
      <input
        type="file"
        accept=".json,application/json"
        onChange={handleChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />

      <div className="flex flex-col items-center justify-center text-center">
        <Upload className="w-12 h-12 mb-4 text-muted-foreground" />
        <p className="text-lg font-medium">Drop theme preset here</p>
        <p className="mt-1 text-sm text-muted-foreground">or click to browse</p>
        <p className="mt-2 text-xs text-muted-foreground">JSON files only</p>

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      </div>
    </div>
  )
}
