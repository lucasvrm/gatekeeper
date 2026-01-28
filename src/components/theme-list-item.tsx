import { Trash, Power } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import type { Theme } from '@/lib/types'

interface ThemeListItemProps {
  theme: Theme
  onActivate: (themeId: string) => void
  onDelete: (themeId: string) => void
}

export function ThemeListItem({ theme, onActivate, onDelete }: ThemeListItemProps) {
  const createdDate = new Date(theme.createdAt).toLocaleDateString()

  return (
    <div data-testid="theme-list-item" className="flex items-center justify-between p-4 border border-border rounded-lg">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{theme.name}</h3>
          {theme.isActive && (
            <span
              data-testid="active-theme-badge"
              className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
            >
              Active
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
          <span>Version: {theme.version}</span>
          <span>Created: {createdDate}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {!theme.isActive && (
          <Button
            data-testid="theme-activate-btn"
            variant="outline"
            size="sm"
            onClick={() => onActivate(theme.id)}
          >
            <Power className="w-4 h-4 mr-1" />
            Activate
          </Button>
        )}

        <Button
          data-testid="theme-delete-btn"
          variant="outline"
          size="sm"
          disabled={theme.isActive}
          onClick={() => onDelete(theme.id)}
        >
          <Trash className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
