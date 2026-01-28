export interface ThemePreset {
  version: string
  metadata: {
    name?: string
    projectName?: string
    hash: string
    exportedAt: string
  }
  components: Record<string, unknown>
  styles: Record<string, string>
  layout?: {
    sidebar?: { width?: string; collapsedWidth?: string }
    header?: { height?: string }
    content?: { padding?: string }
  }
}

export interface ValidationResult {
  valid: boolean
  errors: Array<{ path: string; message: string }>
}

export interface LayoutConfig {
  sidebar: { width: string; collapsedWidth?: string }
  header: { height: string }
  content: { padding: string }
}

export interface ThemeEngineOutput {
  cssVariables: string
  layoutConfig: LayoutConfig
  componentStyles: Record<string, unknown>
  validation: ValidationResult
}

export interface CreateThemeData {
  name: string
  version: string
  presetRaw: string
  cssVariables: string
  layoutConfig: string
  componentStyles: string
  metadata: string
}
