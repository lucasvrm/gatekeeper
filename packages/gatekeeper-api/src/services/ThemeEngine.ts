import type { ThemePreset, ThemeEngineOutput } from '../types/theme.types.js'
import { PresetParser } from './PresetParser.js'
import { CSSVariablesGenerator } from './CSSVariablesGenerator.js'
import { LayoutConfigExtractor } from './LayoutConfigExtractor.js'
import { ComponentStylesMapper } from './ComponentStylesMapper.js'

export class ThemeEngine {
  private readonly presetParser: PresetParser
  private readonly cssGenerator: CSSVariablesGenerator
  private readonly layoutExtractor: LayoutConfigExtractor
  private readonly stylesMapper: ComponentStylesMapper

  constructor() {
    this.presetParser = new PresetParser()
    this.cssGenerator = new CSSVariablesGenerator()
    this.layoutExtractor = new LayoutConfigExtractor()
    this.stylesMapper = new ComponentStylesMapper()
  }

  process(preset: ThemePreset): ThemeEngineOutput {
    const validation = this.presetParser.validate(preset)

    if (!validation.valid) {
      return {
        cssVariables: '',
        layoutConfig: {
          sidebar: { width: '280px', collapsedWidth: '64px' },
          header: { height: '64px' },
          content: { padding: '24px' },
        },
        componentStyles: {},
        validation,
      }
    }

    const cssVariables = this.cssGenerator.generate(preset.styles)
    const layoutConfig = this.layoutExtractor.extract(preset)
    const componentStyles = this.stylesMapper.map(preset.styles)

    return {
      cssVariables,
      layoutConfig,
      componentStyles,
      validation: { valid: true, errors: [] },
    }
  }
}
