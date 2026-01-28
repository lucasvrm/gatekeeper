const STYLE_ID = 'uild-theme'

export class ThemeInjector {
  static inject(cssVariables: string): void {
    let styleElement = document.getElementById(STYLE_ID) as HTMLStyleElement | null

    if (!styleElement) {
      styleElement = document.createElement('style')
      styleElement.id = STYLE_ID
      document.head.appendChild(styleElement)
    }

    styleElement.textContent = cssVariables
  }

  static remove(): void {
    const styleElement = document.getElementById(STYLE_ID)
    if (styleElement) {
      styleElement.remove()
    }
  }

  static update(cssVariables: string): void {
    this.inject(cssVariables)
  }
}
