export class ComponentStylesMapper {
  map(styles: Record<string, string>): Record<string, unknown> {
    const mapped: Record<string, any> = {}

    for (const [key, value] of Object.entries(styles)) {
      const parts = key.split('.')
      if (parts.length !== 5) continue

      const [component, variant, part, state, property] = parts

      if (!mapped[component]) mapped[component] = {}
      if (!mapped[component][variant]) mapped[component][variant] = {}
      if (!mapped[component][variant][part]) mapped[component][variant][part] = {}
      if (!mapped[component][variant][part][state]) mapped[component][variant][part][state] = {}

      mapped[component][variant][part][state][property] = value
    }

    return mapped
  }
}
