import type { ThemePreset, ValidationResult } from '../types/theme.types.js'

export class PresetParser {
  validate(preset: unknown): ValidationResult {
    const errors: Array<{ path: string; message: string }> = []

    if (!preset || typeof preset !== 'object') {
      errors.push({ path: 'preset', message: 'Preset must be an object' })
      return { valid: false, errors }
    }

    const p = preset as Partial<ThemePreset>

    if (!p.version) {
      errors.push({ path: 'version', message: 'Version is required' })
    }

    if (!p.metadata) {
      errors.push({ path: 'metadata', message: 'Metadata is required' })
    } else {
      if (!p.metadata.hash) {
        errors.push({ path: 'metadata.hash', message: 'Hash is required in metadata' })
      }
    }

    if (!p.components) {
      errors.push({ path: 'components', message: 'Components field is required' })
    }

    if (p.styles) {
      for (const key of Object.keys(p.styles)) {
        const parts = key.split('.')
        if (parts.length !== 5) {
          errors.push({
            path: `styles.${key}`,
            message: 'Style key must follow format: component.variant.part.state.property',
          })
        }
        if (key.includes('_')) {
          errors.push({
            path: `styles.${key}`,
            message: 'Style key must use dots as separators, not underscores',
          })
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  parse(preset: ThemePreset): ThemePreset {
    return preset
  }
}
