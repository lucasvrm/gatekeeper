export class CSSVariablesGenerator {
  generate(styles: Record<string, string>): string {
    const groupedByComponent: Record<string, string[]> = {}

    for (const [key, value] of Object.entries(styles)) {
      const component = key.split('.')[0]
      if (!groupedByComponent[component]) {
        groupedByComponent[component] = []
      }
      const cssVarName = `--${key.replace(/\./g, '-')}`
      groupedByComponent[component].push(`  ${cssVarName}: ${value};`)
    }

    const sections: string[] = []
    for (const [component, variables] of Object.entries(groupedByComponent)) {
      sections.push(`/* ===== ${component} ===== */`)
      sections.push(':root {')
      sections.push(...variables)
      sections.push('}')
    }

    return sections.join('\n')
  }
}
