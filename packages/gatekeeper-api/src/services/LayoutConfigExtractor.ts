import type { ThemePreset, LayoutConfig } from '../types/theme.types.js'

export class LayoutConfigExtractor {
  extract(preset: ThemePreset): LayoutConfig {
    const defaults: LayoutConfig = {
      sidebar: { width: '280px', collapsedWidth: '64px' },
      header: { height: '64px' },
      content: { padding: '24px' },
    }

    if (!preset.layout) {
      return defaults
    }

    return {
      sidebar: {
        width: preset.layout.sidebar?.width || defaults.sidebar.width,
        collapsedWidth: preset.layout.sidebar?.collapsedWidth || defaults.sidebar.collapsedWidth,
      },
      header: {
        height: preset.layout.header?.height || defaults.header.height,
      },
      content: {
        padding: preset.layout.content?.padding || defaults.content.padding,
      },
    }
  }
}
