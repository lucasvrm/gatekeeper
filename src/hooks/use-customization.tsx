import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { api } from "@/lib/api"
import type { CustomizationSettings } from "@/lib/types"

const defaultCustomization: CustomizationSettings = {
  appName: "Gatekeeper",
  appSubtitle: "Dashboard de Validações",
  logoUrl: null,
  faviconUrl: null,
  fonts: {
    sans: "Inter",
    serif: "Merriweather",
    mono: "JetBrains Mono",
  },
  maxUploadMb: 2,
  colors: {
    accent: { background: null, text: null },
    primary: { background: null, text: null },
    secondary: { background: null, text: null },
    base: { background: null, text: null },
    background: { background: null, text: null },
    text: { background: null, text: null },
  },
}

type CustomizationContextValue = {
  customization: CustomizationSettings
  setCustomization: (value: CustomizationSettings) => void
  refreshCustomization: () => Promise<void>
}

const CustomizationContext = createContext<CustomizationContextValue | null>(null)

const toFontStack = (fontName: string, fallback: string) => {
  return fontName ? `"${fontName}", ${fallback}` : fallback
}

const buildFontFamilyParam = (fontName: string, weights: string) => {
  const encoded = encodeURIComponent(fontName).replace(/%20/g, "+")
  return `family=${encoded}:${weights}`
}

const loadFontFamilies = (fonts: Array<{ name: string; weights: string }>) => {
  const uniqueFonts = new Map<string, string>()
  fonts.forEach((font) => {
    if (font.name) {
      uniqueFonts.set(font.name, font.weights)
    }
  })

  if (uniqueFonts.size === 0) return

  const params = Array.from(uniqueFonts.entries()).map(([name, weights]) =>
    buildFontFamilyParam(name, weights)
  )
  const href = `https://fonts.googleapis.com/css2?${params.join("&")}&display=swap`

  const existing = document.getElementById("custom-fonts") as HTMLLinkElement | null
  if (existing) {
    if (existing.href !== href) {
      existing.href = href
    }
    return
  }

  const link = document.createElement("link")
  link.id = "custom-fonts"
  link.rel = "stylesheet"
  link.href = href
  document.head.appendChild(link)
}

const applyCustomization = (settings: CustomizationSettings) => {
  const root = document.documentElement
  const body = document.body

  const fontSans = toFontStack(settings.fonts.sans, "sans-serif")
  const fontSerif = toFontStack(settings.fonts.serif, "serif")
  const fontMono = toFontStack(settings.fonts.mono, "monospace")

  root.style.setProperty("--font-sans", fontSans)
  root.style.setProperty("--font-serif", fontSerif)
  root.style.setProperty("--font-mono", fontMono)
  body.style.fontFamily = fontSans

  loadFontFamilies([
    { name: settings.fonts.sans, weights: "wght@300;400;500;600;700" },
    { name: settings.fonts.serif, weights: "wght@300;400;500;600;700" },
    { name: settings.fonts.mono, weights: "wght@400;500;600" },
  ])

  const setColor = (variable: string, value: string | null) => {
    if (!value) return
    root.style.setProperty(variable, value)
  }

  setColor("--accent", settings.colors.accent.background)
  setColor("--accent-foreground", settings.colors.accent.text)
  setColor("--primary", settings.colors.primary.background)
  setColor("--primary-foreground", settings.colors.primary.text)
  setColor("--secondary", settings.colors.secondary.background)
  setColor("--secondary-foreground", settings.colors.secondary.text)
  setColor("--card", settings.colors.base.background)
  setColor("--card-foreground", settings.colors.base.text)
  setColor("--background", settings.colors.background.background)
  setColor("--foreground", settings.colors.background.text)
  setColor("--muted", settings.colors.text.background)
  setColor("--muted-foreground", settings.colors.text.text)

  if (settings.faviconUrl) {
    let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null
    if (!favicon) {
      favicon = document.createElement("link")
      favicon.rel = "icon"
      document.head.appendChild(favicon)
    }
    favicon.href = settings.faviconUrl
  }
}

export function CustomizationProvider({ children }: { children: React.ReactNode }) {
  const [customization, setCustomization] = useState<CustomizationSettings>(defaultCustomization)

  const refreshCustomization = async () => {
    try {
      const data = await api.configTables.customization.get()
      setCustomization(data)
    } catch (error) {
      console.error("Failed to load customization:", error)
    }
  }

  useEffect(() => {
    refreshCustomization()
  }, [])

  useEffect(() => {
    applyCustomization(customization)
  }, [customization])

  const value = useMemo(
    () => ({
      customization,
      setCustomization,
      refreshCustomization,
    }),
    [customization],
  )

  return (
    <CustomizationContext.Provider value={value}>
      {children}
    </CustomizationContext.Provider>
  )
}

export const useCustomization = () => {
  const context = useContext(CustomizationContext)
  if (!context) {
    throw new Error("useCustomization must be used within CustomizationProvider")
  }
  return context
}
