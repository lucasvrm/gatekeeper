import { Button } from '@/components/ui/button'
import type { ThemePreviewResponse } from '@/lib/types'

interface ThemePreviewPanelProps {
  preview: ThemePreviewResponse
  onApply: () => void
  onCancel: () => void
}

export function ThemePreviewPanel({ preview, onApply, onCancel }: ThemePreviewPanelProps) {
  const componentCount = Object.keys(preview.layoutConfig).length
  const primaryColors = preview.cssVariables
    .split('\n')
    .filter((line) => line.includes('backgroundColor') || line.includes('color'))
    .slice(0, 5)

  return (
    <div data-testid="theme-preview-panel" className="border border-border rounded-lg p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-4">Theme Preview</h3>

        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Primary Colors</h4>
            <div className="space-y-1 text-sm text-muted-foreground font-mono">
              {primaryColors.map((line, i) => (
                <div key={i}>{line.trim()}</div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">Layout Configuration</h4>
            <div className="space-y-1 text-sm">
              <div>Sidebar Width: {preview.layoutConfig.sidebar.width}</div>
              <div>Header Height: {preview.layoutConfig.header.height}</div>
              <div>Content Padding: {preview.layoutConfig.content.padding}</div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">Components</h4>
            <p className="text-sm text-muted-foreground">{componentCount} layout components configured</p>
          </div>

          {preview.validation && !preview.validation.valid && (
            <div className="p-3 bg-destructive/10 border border-destructive rounded">
              <h4 className="text-sm font-medium text-destructive mb-2">Validation Errors</h4>
              <ul className="space-y-1 text-xs text-destructive">
                {preview.validation.errors.map((err, i) => (
                  <li key={i}>
                    {err.path}: {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 pt-4 border-t">
        <Button data-testid="theme-cancel-btn" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button
          data-testid="theme-apply-btn"
          onClick={onApply}
          className="flex-1"
          disabled={!preview.validation.valid}
        >
          Apply Theme
        </Button>
      </div>
    </div>
  )
}
