// ============================================================================
// Default data
// ============================================================================
export const DEFAULT_LAYOUT = {
  structure: {
    regions: {
      sidebar: {
        enabled: true,
        position: "left",
        dimensions: { width: "$tokens.sizing.sidebar-width", height: "$tokens.sizing.full-height", minWidth: "$tokens.sizing.sidebar-collapsed" },
        padding: { top: "$tokens.spacing.sm", right: "0", bottom: "0", left: "0" },
        alignmentPad: "$tokens.sizing.sidebar-pad",
        containers: [
          {
            name: "brand", description: "Nome do workspace ativo", order: 0,
            padding: { top: "$tokens.spacing.md", right: "$tokens.sizing.sidebar-pad", bottom: "$tokens.spacing.md", left: "$tokens.sizing.sidebar-pad" },
          },
          {
            name: "navigation", description: "Links de navegação principal", order: 1,
            padding: { top: "$tokens.spacing.sm", right: "calc($tokens.sizing.sidebar-pad - 6px)", bottom: "$tokens.spacing.xs", left: "calc($tokens.sizing.sidebar-pad - 6px)" },
            navItemInternalPad: "6px",
          },
          {
            name: "sidebarFooter", description: "Perfil do usuário e ações de conta", order: 2,
            padding: { top: "$tokens.spacing.xs", right: "calc($tokens.sizing.sidebar-pad - 6px)", bottom: "$tokens.spacing.xs", left: "calc($tokens.sizing.sidebar-pad - 6px)" },
          },
        ],
        behavior: { fixed: true, collapsible: false, scrollable: true, collapsedDisplay: "letter-only" },
        collapsedTooltip: {
          mandatory: true,
          background: "$tokens.colors.surface-3",
          color: "$tokens.colors.text",
          borderColor: "$tokens.colors.border",
          borderRadius: "$tokens.borderRadius.sm",
          fontSize: "$tokens.fontSizes.xs",
          fontFamily: "$tokens.fontFamilies.mono",
          fontWeight: "$tokens.fontWeights.medium",
          padding: "5px 10px",
          shadow: "0 4px 12px rgba(0,0,0,0.4)",
          offset: "12px",
          arrow: true,
        },
      },
      header: {
        enabled: true,
        position: "top",
        dimensions: { height: "$tokens.sizing.header-height" },
        padding: { top: "0", right: "0", bottom: "0", left: "0" },
        zones: {
          sidebar: {
            description: "Left zone — matches sidebar width. Contains logo.",
            width: "$tokens.sizing.sidebar-width",
            collapsedWidth: "$tokens.sizing.sidebar-collapsed",
            paddingLeft: "$tokens.sizing.sidebar-pad",
            borderRight: { enabled: true, color: "$tokens.colors.border", width: "$tokens.borderWidth.thin" },
            contains: ["brand"],
          },
          content: {
            description: "Right zone — flex:1, matches main content padding.",
            paddingLeft: "$tokens.sizing.main-pad",
            paddingRight: "$tokens.sizing.main-pad",
            contains: ["breadcrumb", "spacer", "actions", "userMenu"],
          },
        },
        containers: [
          { name: "brand", description: "Logo e identidade da aplicação", order: 0, zone: "sidebar" },
          { name: "breadcrumb", description: "Navegação hierárquica da página atual", order: 1, zone: "content" },
          { name: "actions", description: "Ações contextuais (busca, CTAs, ícones)", order: 2, zone: "content" },
          { name: "userMenu", description: "Avatar, notificações, menu do usuário", order: 3, zone: "content" },
        ],
        behavior: { fixed: true, collapsible: false, scrollable: false },
        separators: {
          bottom: { enabled: true, color: "$tokens.colors.border", width: "$tokens.borderWidth.thin", style: "solid" },
        },
      },
      main: {
        enabled: true,
        position: "center",
        padding: { top: "$tokens.spacing.lg", right: "$tokens.sizing.main-pad", bottom: "$tokens.spacing.xl", left: "$tokens.sizing.main-pad" },
        containers: [{ name: "contentBody", description: "Área principal de conteúdo", order: 0 }],
        behavior: { fixed: false, collapsible: false, scrollable: true },
      },
      footer: {
        enabled: false,
        padding: { top: "0", right: "$tokens.sizing.main-pad", bottom: "0", left: "$tokens.sizing.main-pad" },
      },
    },
    alignmentGrid: {
      _doc: "Two master tokens control ALL horizontal alignment across the entire layout",
      sidebarPad: {
        token: "$tokens.sizing.sidebar-pad",
        controls: [
          "header sidebar-zone paddingLeft",
          "sidebar workspace left/right padding",
          "sidebar nav left/right padding (via calc with navItemInternalPad)",
          "sidebar footer left/right padding",
          "logo left edge (via header sidebar-zone)",
        ],
      },
      mainPad: {
        token: "$tokens.sizing.main-pad",
        controls: [
          "header content-zone paddingLeft/Right",
          "breadcrumbs left edge",
          "header actions right edge",
          "main content paddingLeft/Right",
          "page title left edge",
          "cards/content left edge",
          "footer paddingLeft/Right",
        ],
      },
    },
    contentLayout: {
      maxWidth: "",
      centering: true,
      contentGap: "$tokens.spacing.md",
      contentPadding: "$tokens.spacing.xl",
      grid: { enabled: false, columns: 1, minColumnWidth: "280px", gap: "$tokens.spacing.md" },
    },
    pageHeader: {
      enabled: false,
      showTitle: true,
      showSubtitle: true,
      showDivider: false,
      padding: { top: "0", right: "0", bottom: "$tokens.spacing.lg", left: "0" },
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
      padding: { left: "0" },
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
    scrollbar: {
      width: "6px",
      borderRadius: "3px",
      thumbColor: "rgba(255,255,255,0.08)",
      thumbHoverColor: "rgba(255,255,255,0.15)",
      trackColor: "transparent",
    },
    toast: {
      position: "bottom-right" as const,
      maxVisible: 3,
      duration: 4000,
    },
    emptyState: {
      icon: "ph:magnifying-glass",
      title: "Nenhum item encontrado",
      description: "",
      showAction: true,
      actionLabel: "Criar Novo",
    },
    skeleton: {
      animation: "pulse" as const,
      duration: "1.5s",
      baseColor: "rgba(255,255,255,0.05)",
      highlightColor: "rgba(255,255,255,0.10)",
      borderRadius: "6px",
    },
    loginPage: {
      logo: { enabled: true, placement: "inside-card", align: "center", scale: 1, marginBottom: "16px" },
      background: { type: "solid", color: "", gradient: "linear-gradient(135deg, #111113, #1a1a2e)", imageUrl: "", overlay: "" },
      card: { position: "center", verticalAlign: "center", maxWidth: "420px", background: "", borderColor: "", borderRadius: "", shadow: "", padding: "" },
      title: { text: "Entrar", align: "center" },
      inputs: { background: "", borderColor: "", focusBorderColor: "" },
      button: { background: "", color: "", hoverBackground: "" },
      links: { color: "", hoverColor: "" },
      footer: { text: "" },
    },
    pages: {},
    variables: { categories: [], items: [] },
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
      "sidebar-collapsed": { value: 52, unit: "px" },
      "sidebar-pad": { value: 16, unit: "px" },
      "main-pad": { value: 28, unit: "px" },
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
      // Backgrounds (Slate dark scale)
      "bg": { value: "#111113" },           // slate-1
      "surface": { value: "#18191b" },      // slate-2
      "surface-2": { value: "#212225" },    // slate-3
      "surface-3": { value: "#272a2d" },    // slate-4
      
      // Borders (Slate dark scale)
      "border": { value: "#2e3135" },       // slate-5
      "border-2": { value: "#363a3f" },     // slate-6
      
      // Text (Slate dark scale)
      "text": { value: "#edeef0" },         // slate-12
      "text-muted": { value: "#b0b4ba" },   // slate-11
      "text-dim": { value: "#696e77" },     // slate-9
      
      // Accent (Blue dark scale)
      "accent": { value: "#0090ff" },       // blue-9
      "accent-hover": { value: "#3b9eff" }, // blue-10
      "accent-dim": { value: "#70b8ff" },   // blue-11
      "accent-fg": { value: "#ffffff" },
      
      // Status colors (Radix)
      "danger": { value: "#e5484d" },       // red-9
      "danger-dim": { value: "#f2555a" },   // red-10
      "success": { value: "#30a46c" },      // green-9
      "success-dim": { value: "#3cb179" },  // green-10
      "warning": { value: "#f5d90a" },      // yellow-9
      "warning-dim": { value: "#ffef5c" },  // yellow-10
      
      // Semantic aliases
      "sidebar-bg": { value: "#111113" },   // slate-1
      "header-bg": { value: "#111113" },    // slate-1
      "input-bg": { value: "#212225" },     // slate-3
      "input-border": { value: "#2e3135" }, // slate-5
      "card-bg": { value: "#18191b" },      // slate-2
      "card-border": { value: "#2e3135" },  // slate-5
      "ring": { value: "#0090ff44" },       // blue-9 with alpha
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
// ============================================================================
// Colors — Radix Slate/Blue (same as Gatekeeper)
// ============================================================================
export const COLORS = {
  // Backgrounds (Slate dark scale)
  bg: "#111113",           // slate-1
  surface: "#18191b",      // slate-2
  surface2: "#212225",     // slate-3
  surface3: "#272a2d",     // slate-4
  
  // Borders
  border: "#2e3135",       // slate-5
  border2: "#363a3f",      // slate-6
  
  // Text (Slate dark scale)
  text: "#edeef0",         // slate-12
  textMuted: "#b0b4ba",    // slate-11
  textDim: "#696e77",      // slate-9
  
  // Accent (Blue dark scale)
  accent: "#0090ff",       // blue-9
  accentHover: "#3b9eff",  // blue-10
  accentDim: "#70b8ff",    // blue-11
  
  // Status colors (Radix)
  danger: "#e5484d",       // red-9
  error: "#e5484d",        // red-9
  success: "#30a46c",      // green-9
  warning: "#f5d90a",      // yellow-9
};

export const s = {
  // Inputs & selects — compact with consistent sizing
  input: { background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "5px 8px", color: COLORS.text, fontSize: 12, outline: "none", width: "100%", fontFamily: "var(--font-monospace, 'JetBrains Mono', 'SF Mono', monospace)", lineHeight: "1.4", transition: "border-color 0.15s" } as any,
  select: { background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "5px 8px", color: COLORS.text, fontSize: 12, outline: "none", width: "100%", fontFamily: "var(--font-monospace, 'JetBrains Mono', 'SF Mono', monospace)", cursor: "pointer", lineHeight: "1.4", transition: "border-color 0.15s" } as any,

  // Buttons — primary, ghost, danger, small, icon-only
  btn: { background: COLORS.accent, border: "none", borderRadius: 6, padding: "6px 12px", color: "#fff", fontSize: 12, cursor: "pointer", fontWeight: 600, fontFamily: "var(--font-sans-serif, 'Inter', sans-serif)", transition: "opacity 0.15s", lineHeight: "1.4" } as any,
  btnGhost: { background: "transparent", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "5px 10px", color: COLORS.textMuted, fontSize: 11, cursor: "pointer", fontFamily: "var(--font-sans-serif, 'Inter', sans-serif)", transition: "all 0.15s" } as any,
  btnDanger: { background: "transparent", border: `1px solid ${COLORS.danger}33`, borderRadius: 5, padding: "4px 8px", color: COLORS.danger, fontSize: 11, cursor: "pointer", fontFamily: "var(--font-sans-serif, 'Inter', sans-serif)", transition: "all 0.15s" } as any,
  btnSmall: { background: COLORS.surface3, border: `1px solid ${COLORS.border}`, borderRadius: 4, padding: "3px 7px", color: COLORS.textMuted, fontSize: 10, cursor: "pointer", fontFamily: "var(--font-sans-serif, 'Inter', sans-serif)", transition: "all 0.15s" } as any,
  btnIcon: { background: "transparent", border: "none", borderRadius: 4, padding: 4, color: COLORS.textDim, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "color 0.15s" } as any,

  // Typography
  label: { fontSize: 10, color: COLORS.textDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3, display: "block", lineHeight: "1.3" } as any,

  // Containers
  card: { background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 14 } as any,
  cardFlush: { background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 0, overflow: "hidden" } as any,

  // Tags & badges
  tag: { background: COLORS.surface3, border: `1px solid ${COLORS.border}`, borderRadius: 4, padding: "1px 6px", fontSize: 10, color: COLORS.textMuted, display: "inline-block", lineHeight: "1.4" } as any,

  // Info box
  infoBox: { padding: "7px 10px", background: COLORS.surface2, borderRadius: 6, fontSize: 11, color: COLORS.textDim, lineHeight: 1.5, borderLeft: `3px solid ${COLORS.accent}30` } as any,

  // Grid utilities
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } as any,
  grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 } as any,
  grid4: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 } as any,
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
