// ============================================================================
// Default data
// ============================================================================
export const DEFAULT_LAYOUT = {
  structure: {
    regions: {
      sidebar: {
        enabled: true,
        position: "left",
        dimensions: { width: "$tokens.sizing.sidebar-width", height: "$tokens.sizing.full-height" },
        padding: { top: "$tokens.spacing.md", right: "$tokens.spacing.sm", bottom: "$tokens.spacing.md", left: "$tokens.spacing.sm" },
        containers: [
          { name: "logo", description: "Logo ou título da aplicação", order: 0 },
          { name: "navLinks", description: "Links de navegação principal", order: 1 },
          { name: "sidebarFooter", description: "Conteúdo fixo no rodapé da sidebar", order: 2 },
        ],
        behavior: { fixed: true, collapsible: false, scrollable: true },
      },
      header: {
        enabled: true,
        position: "top",
        dimensions: { height: "$tokens.sizing.header-height" },
        padding: { top: "$tokens.spacing.sm", right: "$tokens.spacing.lg", bottom: "$tokens.spacing.sm", left: "$tokens.spacing.lg" },
        containers: [
          { name: "pageHeader", description: "Título da página atual e breadcrumbs", order: 0 },
          { name: "headerActions", description: "Ações contextuais do header", order: 1 },
        ],
        behavior: { fixed: true, collapsible: false, scrollable: false },
      },
      main: {
        enabled: true,
        position: "center",
        padding: { top: "$tokens.spacing.lg", right: "$tokens.spacing.lg", bottom: "$tokens.spacing.lg", left: "$tokens.spacing.lg" },
        containers: [{ name: "contentBody", description: "Área principal de conteúdo", order: 0 }],
        behavior: { fixed: false, collapsible: false, scrollable: true },
      },
      footer: { enabled: false },
    },
    contentLayout: {
      maxWidth: "",
      centering: true,
      grid: { enabled: false, columns: 1, minColumnWidth: "280px", gap: "$tokens.spacing.md" },
    },
    pageHeader: {
      enabled: false,
      showTitle: true,
      showSubtitle: true,
      showDivider: false,
      padding: { top: "$tokens.spacing.lg", right: "0", bottom: "$tokens.spacing.md", left: "0" },
      typography: {
        title: { fontSize: "$tokens.fontSizes.3xl", fontWeight: "$tokens.fontWeights.bold", letterSpacing: "-0.02em" },
        subtitle: { fontSize: "$tokens.fontSizes.sm", color: "$tokens.colors.text-muted" },
      },
    },
    breadcrumbs: {
      enabled: true,
      position: "header",
      alignment: "left",
      separator: "/",
      clickable: true,
      showHome: true,
      homeLabel: "Home",
      homeRoute: "/",
    },
    logo: {
      type: "text",
      text: "App",
      icon: "⬡",
      iconUrl: "",
      iconSize: 20,
      imageUrl: "",
      position: "sidebar",
      headerSlot: "left",
      sidebarAlign: "left",
      alignWithHeader: true,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      iconGap: 8,
      typography: { fontFamily: "", fontSize: 16, fontWeight: 700, color: "", letterSpacing: 0 },
    },
    favicon: {
      type: "none" as const,
      url: "",
      emoji: "⬡",
    },
    headerElements: {
      search: { enabled: false, placeholder: "Buscar...", showIcon: true, icon: "ph:magnifying-glass" },
      cta: { enabled: false, label: "Novo", variant: "default" },
      ctas: [],
      icons: { enabled: true, items: [{ id: "bell", route: "/notifications" }, { id: "settings", route: "/settings" }] },
      order: ["search", "icons", "ctas"],
    },
    tableSeparator: {
      color: "$tokens.colors.border",
      width: "1px",
      style: "solid",
      headerColor: "",
      headerWidth: "2px",
      headerStyle: "solid",
    },
    pages: {},
  },
  tokens: {
    spacing: {
      xs: { value: 4, unit: "px" },
      sm: { value: 8, unit: "px" },
      md: { value: 16, unit: "px" },
      lg: { value: 24, unit: "px" },
      xl: { value: 32, unit: "px" },
    },
    sizing: {
      "sidebar-width": { value: 240, unit: "px" },
      "header-height": { value: 56, unit: "px" },
      "full-height": { value: 100, unit: "vh" },
    },
    fontFamilies: {
      primary: { family: "Inter", fallbacks: ["-apple-system", "BlinkMacSystemFont", "sans-serif"] },
      mono: { family: "JetBrains Mono", fallbacks: ["SF Mono", "Fira Code", "monospace"] },
      display: { family: "Inter", fallbacks: ["-apple-system", "BlinkMacSystemFont", "sans-serif"] },
    },
    fontSizes: {
      xs: { value: 11, unit: "px" },
      sm: { value: 13, unit: "px" },
      md: { value: 14, unit: "px" },
      lg: { value: 16, unit: "px" },
      xl: { value: 18, unit: "px" },
      "2xl": { value: 22, unit: "px" },
      "3xl": { value: 28, unit: "px" },
      "4xl": { value: 36, unit: "px" },
    },
    fontWeights: {
      regular: { value: 400 },
      medium: { value: 500 },
      semibold: { value: 600 },
      bold: { value: 700 },
    },
    lineHeights: {
      tight: { value: 1.2 },
      normal: { value: 1.5 },
      relaxed: { value: 1.7 },
    },
    letterSpacings: {
      tight: { value: -0.02, unit: "em" },
      normal: { value: 0, unit: "em" },
      wide: { value: 0.05, unit: "em" },
    },
    colors: {
      "bg": { value: "#0a0a0b" },
      "surface": { value: "#141417" },
      "surface-2": { value: "#1c1c21" },
      "surface-3": { value: "#24242b" },
      "border": { value: "#2a2a33" },
      "border-2": { value: "#3a3a45" },
      "text": { value: "#e4e4e7" },
      "text-muted": { value: "#8b8b96" },
      "text-dim": { value: "#5b5b66" },
      "accent": { value: "#6d9cff" },
      "accent-dim": { value: "#4a7adf" },
      "accent-fg": { value: "#ffffff" },
      "danger": { value: "#ff6b6b" },
      "danger-dim": { value: "#cc5555" },
      "success": { value: "#4ade80" },
      "success-dim": { value: "#22c55e" },
      "warning": { value: "#fbbf24" },
      "warning-dim": { value: "#d4a017" },
      "sidebar-bg": { value: "#111114" },
      "header-bg": { value: "#0a0a0b" },
      "input-bg": { value: "#1c1c21" },
      "input-border": { value: "#2a2a33" },
      "card-bg": { value: "#141417" },
      "card-border": { value: "#2a2a33" },
      "ring": { value: "#6d9cff44" },
    },
    borderRadius: {
      none: { value: 0, unit: "px" },
      sm: { value: 4, unit: "px" },
      md: { value: 6, unit: "px" },
      lg: { value: 8, unit: "px" },
      xl: { value: 12, unit: "px" },
      full: { value: 9999, unit: "px" },
    },
    borderWidth: {
      thin: { value: 1, unit: "px" },
      medium: { value: 2, unit: "px" },
      thick: { value: 3, unit: "px" },
    },
  },
  textStyles: {
    "heading-1": { description: "Título principal", fontFamily: "$tokens.fontFamilies.display", fontSize: "$tokens.fontSizes.3xl", fontWeight: "$tokens.fontWeights.bold", lineHeight: "$tokens.lineHeights.tight", letterSpacing: "$tokens.letterSpacings.tight" },
    "heading-2": { description: "Subtítulo de seção", fontFamily: "$tokens.fontFamilies.display", fontSize: "$tokens.fontSizes.2xl", fontWeight: "$tokens.fontWeights.semibold", lineHeight: "$tokens.lineHeights.tight", letterSpacing: "$tokens.letterSpacings.tight" },
    "heading-3": { description: "Título de card", fontFamily: "$tokens.fontFamilies.display", fontSize: "$tokens.fontSizes.lg", fontWeight: "$tokens.fontWeights.semibold", lineHeight: "$tokens.lineHeights.tight" },
    body: { description: "Texto padrão", fontFamily: "$tokens.fontFamilies.primary", fontSize: "$tokens.fontSizes.md", fontWeight: "$tokens.fontWeights.regular", lineHeight: "$tokens.lineHeights.normal" },
    "body-sm": { description: "Texto secundário", fontFamily: "$tokens.fontFamilies.primary", fontSize: "$tokens.fontSizes.sm", fontWeight: "$tokens.fontWeights.regular", lineHeight: "$tokens.lineHeights.normal" },
    caption: { description: "Labels e metadados", fontFamily: "$tokens.fontFamilies.primary", fontSize: "$tokens.fontSizes.xs", fontWeight: "$tokens.fontWeights.medium", lineHeight: "$tokens.lineHeights.normal", letterSpacing: "$tokens.letterSpacings.wide" },
    code: { description: "Código e valores técnicos", fontFamily: "$tokens.fontFamilies.mono", fontSize: "$tokens.fontSizes.sm", fontWeight: "$tokens.fontWeights.regular", lineHeight: "$tokens.lineHeights.relaxed" },
  },
};

export const DEFAULT_UI_REGISTRY = {
  components: {
    Button: {
      name: "Button",
      category: "primitive",
      description: "Botão de ação. Suporta variantes visuais e estados de loading.",
      source: "shadcn-ui",
      props: {
        variant: { type: "enum", required: false, description: "Variante visual", default: "default", enumValues: ["default", "destructive", "outline", "secondary", "ghost", "link"] },
        size: { type: "enum", required: false, description: "Tamanho do botão", default: "default", enumValues: ["default", "sm", "lg", "icon"] },
        disabled: { type: "boolean", required: false, description: "Desabilita o botão", default: false },
        loading: { type: "boolean", required: false, description: "Exibe spinner", default: false },
      },
      slots: { children: { description: "Conteúdo do botão", required: true, acceptedComponents: [] } },
      variants: [{ name: "primary", props: { variant: "default" } }, { name: "danger", props: { variant: "destructive" } }],
      examples: [{ name: "Botão padrão", props: { variant: "default" }, slots: { children: "Salvar" } }],
      tags: ["action", "form"],
    },
  },
};


// ============================================================================
// Shared UI Constants
// ============================================================================
export const COLORS = {
  bg: "#0a0a0b",
  surface: "#141417",
  surface2: "#1c1c21",
  surface3: "#24242b",
  border: "#2a2a33",
  border2: "#3a3a45",
  text: "#e4e4e7",
  textMuted: "#8b8b96",
  textDim: "#5b5b66",
  accent: "#6d9cff",
  accentDim: "#4a7adf",
  danger: "#ff6b6b",
  success: "#4ade80",
  warning: "#fbbf24",
};

export const s = {
  input: { background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "6px 10px", color: COLORS.text, fontSize: 13, outline: "none", width: "100%", fontFamily: "'JetBrains Mono', 'SF Mono', monospace" },
  select: { background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "6px 10px", color: COLORS.text, fontSize: 13, outline: "none", width: "100%", fontFamily: "'JetBrains Mono', 'SF Mono', monospace", cursor: "pointer" },
  btn: { background: COLORS.accent, border: "none", borderRadius: 6, padding: "7px 14px", color: "#fff", fontSize: 13, cursor: "pointer", fontWeight: 600, fontFamily: "'Inter', sans-serif" },
  btnGhost: { background: "transparent", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "6px 12px", color: COLORS.textMuted, fontSize: 12, cursor: "pointer", fontFamily: "'Inter', sans-serif" },
  btnDanger: { background: "transparent", border: `1px solid ${COLORS.danger}33`, borderRadius: 6, padding: "5px 10px", color: COLORS.danger, fontSize: 12, cursor: "pointer", fontFamily: "'Inter', sans-serif" },
  btnSmall: { background: COLORS.surface3, border: `1px solid ${COLORS.border}`, borderRadius: 4, padding: "4px 8px", color: COLORS.textMuted, fontSize: 11, cursor: "pointer", fontFamily: "'Inter', sans-serif" },
  label: { fontSize: 11, color: COLORS.textMuted, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, display: "block" },
  card: { background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 16 },
  tag: { background: COLORS.surface3, border: `1px solid ${COLORS.border}`, borderRadius: 4, padding: "2px 8px", fontSize: 11, color: COLORS.textMuted, display: "inline-block" },
};


// ============================================================================
// Google Fonts list
// ============================================================================
export const GOOGLE_FONTS = [
  "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", "Raleway",
  "Nunito", "Source Sans 3", "Ubuntu", "Rubik", "Work Sans", "Noto Sans",
  "Fira Sans", "DM Sans", "Manrope", "Space Grotesk", "Plus Jakarta Sans",
  "Outfit", "Geist", "Sora", "Lexend", "Onest", "Figtree",
  // Serif
  "Playfair Display", "Merriweather", "Lora", "Source Serif 4", "Noto Serif",
  "Crimson Text", "Libre Baskerville", "EB Garamond", "Bitter", "DM Serif Display",
  // Mono
  "JetBrains Mono", "Fira Code", "Source Code Pro", "IBM Plex Mono", "Roboto Mono",
  "Ubuntu Mono", "Space Mono", "Inconsolata", "Cascadia Code", "Geist Mono",
];

export const SPACING_PRESETS = { "2xs": 2, xs: 4, sm: 8, md: 16, lg: 24, xl: 32, "2xl": 48, "3xl": 64 };
