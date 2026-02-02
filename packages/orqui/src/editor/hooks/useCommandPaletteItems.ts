import { useMemo } from "react";
import type { CmdItem } from "../types/contracts";

export function useCommandPaletteItems(
  layout: any,
  registry: any,
  setActiveTab: (t: string) => void,
  scrollToSection: (id: string) => void,
  openAccordion: (id: string) => void,
): CmdItem[] {
  return useMemo(() => {
    const items: CmdItem[] = [];

    // ---- Seções ----
    const sections = [
      { id: "sec-brand", label: "Marca (Logo + Favicon)", icon: "🏷" },
      { id: "sec-layout", label: "Layout & Regiões", icon: "📐" },
      { id: "sec-content-layout", label: "Content Layout (grid · maxWidth)", icon: "⊞" },
      { id: "sec-page-header", label: "Page Header (título · subtítulo)", icon: "📄" },
      { id: "wb-breadcrumbs", label: "Breadcrumbs", icon: "🔗" },
      { id: "sec-header", label: "Header Elements", icon: "📌" },
      { id: "sec-table-sep", label: "Table Separator", icon: "📊" },
      { id: "sec-tokens", label: "Design Tokens", icon: "🎨" },
      { id: "wb-colors", label: "Cores (tokens)", icon: "🎨" },
      { id: "wb-spacing-sizing", label: "Spacing / Sizing / Border", icon: "📏" },
      { id: "sec-typo", label: "Tipografia & Text Styles", icon: "✏️" },
      { id: "wb-font-families", label: "Font Families", icon: "🔤" },
      { id: "wb-font-sizes", label: "Font Sizes", icon: "🔠" },
      { id: "wb-font-weights", label: "Font Weights", icon: "🅱" },
      { id: "wb-line-heights", label: "Line Heights", icon: "↕" },
      { id: "wb-letter-spacings", label: "Letter Spacings", icon: "↔" },
      { id: "sec-layout-mode", label: "Layout Mode (sidebar-first · header-first)", icon: "🔀" },
      { id: "sec-scrollbar", label: "Scrollbar Styling", icon: "📜" },
      { id: "sec-toast", label: "Toast / Notificações", icon: "🔔" },
      { id: "sec-empty-state", label: "Empty State", icon: "📭" },
      { id: "sec-skeleton", label: "Loading Skeleton", icon: "💀" },
      { id: "sec-pages", label: "Páginas", icon: "📄" },
      { id: "sec-io", label: "Import / Export", icon: "📦" },
    ];
    for (const sec of sections) {
      items.push({
        id: `nav:${sec.id}`, label: sec.label, category: "Seção", icon: sec.icon,
        action: () => {
          setActiveTab("layout");
          setTimeout(() => {
            openAccordion(sec.id);
            scrollToSection(sec.id);
          }, 60);
        },
      });
    }

    // ---- Property-level search: maps config properties to their editor sections ----
    const propNav = (sectionId: string, subsection?: string) => () => {
      setActiveTab("layout");
      setTimeout(() => {
        openAccordion(sectionId);
        if (subsection) openAccordion(subsection);
        scrollToSection(subsection || sectionId);
      }, 60);
    };

    const propertyMap: Array<{ keywords: string[]; label: string; section: string; sub?: string; hint?: string }> = [
      // Main region
      { keywords: ["padding", "main padding", "padding main", "espaçamento interno"], label: "Main: Padding", section: "sec-layout", hint: "main.padding — top, right, bottom, left" },
      { keywords: ["main background", "background main", "fundo principal"], label: "Main: Background", section: "sec-layout", hint: "main.background" },
      // Sidebar region
      { keywords: ["sidebar width", "largura sidebar", "sidebar largura"], label: "Sidebar: Width", section: "sec-layout", hint: "sidebar.dimensions.width" },
      { keywords: ["sidebar min width", "sidebar minWidth"], label: "Sidebar: Min Width", section: "sec-layout", hint: "sidebar.dimensions.minWidth" },
      { keywords: ["sidebar padding", "padding sidebar"], label: "Sidebar: Padding", section: "sec-layout", hint: "sidebar.padding — top, right, bottom, left" },
      { keywords: ["sidebar background", "background sidebar", "cor sidebar"], label: "Sidebar: Background", section: "sec-layout", hint: "sidebar.background" },
      { keywords: ["sidebar collapsible", "colapsar sidebar", "sidebar collapse"], label: "Sidebar: Collapsible", section: "sec-layout", hint: "sidebar.behavior.collapsible" },
      { keywords: ["sidebar scrollable", "sidebar scroll"], label: "Sidebar: Scrollable", section: "sec-layout", hint: "sidebar.behavior.scrollable" },
      { keywords: ["sidebar separator", "sidebar divider", "sidebar border"], label: "Sidebar: Separators", section: "sec-layout", hint: "sidebar.separators" },
      { keywords: ["sidebar navigation typography", "nav font", "nav tipografia"], label: "Sidebar: Nav Typography", section: "sec-layout", hint: "sidebar.navigation.typography" },
      // Header region
      { keywords: ["header height", "altura header", "header altura"], label: "Header: Height", section: "sec-layout", hint: "header.dimensions.height" },
      { keywords: ["header padding", "padding header"], label: "Header: Padding", section: "sec-layout", hint: "header.padding" },
      { keywords: ["header background", "background header"], label: "Header: Background", section: "sec-layout", hint: "header.background" },
      { keywords: ["header fixed", "header sticky", "header fixo"], label: "Header: Fixed", section: "sec-layout", hint: "header.behavior.fixed" },
      // Logo
      { keywords: ["logo", "logo type", "logo text", "logo image", "logo icon"], label: "Logo", section: "sec-brand", hint: "logo.type, position, text, icon" },
      { keywords: ["logo position", "logo sidebar", "logo header"], label: "Logo: Position", section: "sec-brand", hint: "sidebar | header" },
      { keywords: ["logo typography", "logo font", "logo cor"], label: "Logo: Typography", section: "sec-brand", hint: "logo.typography" },
      // Favicon
      { keywords: ["favicon", "favicon emoji", "favicon image", "ícone aba"], label: "Favicon", section: "sec-brand", hint: "favicon.type, emoji, url" },
      // Breadcrumbs
      { keywords: ["breadcrumbs", "migalhas", "breadcrumb separator", "breadcrumb position"], label: "Breadcrumbs", section: "sec-layout", sub: "wb-breadcrumbs", hint: "enabled, position, separator" },
      // Header elements
      { keywords: ["search", "busca", "command palette", "search icon"], label: "Header: Search", section: "sec-header", hint: "headerElements.search" },
      { keywords: ["cta", "call to action", "header button", "header botão"], label: "Header: CTA", section: "sec-header", hint: "headerElements.cta/ctas" },
      { keywords: ["header icons", "header ícones", "icon buttons"], label: "Header: Icons", section: "sec-header", hint: "headerElements.icons" },
      // Content layout
      { keywords: ["max width", "maxWidth", "largura máxima", "content width"], label: "Content: Max Width", section: "sec-content-layout", hint: "contentLayout.maxWidth" },
      { keywords: ["centering", "centralizar", "content center"], label: "Content: Centering", section: "sec-content-layout", hint: "contentLayout.centering" },
      { keywords: ["grid", "grid columns", "grid gap", "colunas"], label: "Content: Grid", section: "sec-content-layout", hint: "contentLayout.grid" },
      // Page header
      { keywords: ["page title", "título página", "page header title"], label: "Page Header: Title", section: "sec-page-header", hint: "pageHeader.showTitle, typography" },
      { keywords: ["page description", "descrição página", "subtítulo"], label: "Page Header: Description", section: "sec-page-header", hint: "pageHeader.showDescription" },
      { keywords: ["page header padding"], label: "Page Header: Padding", section: "sec-page-header", hint: "pageHeader.padding" },
      { keywords: ["page divider", "page separator", "divisor página"], label: "Page Header: Divider", section: "sec-page-header", hint: "pageHeader.showDivider" },
      // Table separator
      { keywords: ["table border", "table separator", "tabela borda", "tabela separador", "row border"], label: "Table Separator", section: "sec-table-sep", hint: "tableSeparator.color, width, style" },
      // Layout mode
      { keywords: ["layout mode", "sidebar first", "header first", "modo layout"], label: "Layout Mode", section: "sec-layout-mode", hint: "sidebar-first | header-first" },
      // Scrollbar
      { keywords: ["scrollbar", "scroll bar", "scrollbar width", "scrollbar thumb", "barra rolagem"], label: "Scrollbar", section: "sec-scrollbar", hint: "width, thumb color, track color" },
      // Toast
      { keywords: ["toast", "notificação", "notification", "toast position", "snackbar"], label: "Toast Position", section: "sec-toast", hint: "position, maxVisible, duration" },
      // Empty state
      { keywords: ["empty state", "estado vazio", "nenhum item", "empty page", "sem resultados"], label: "Empty State", section: "sec-empty-state", hint: "icon, title, description, action" },
      // Skeleton
      { keywords: ["skeleton", "loading", "carregando", "shimmer", "pulse", "loading animation"], label: "Loading Skeleton", section: "sec-skeleton", hint: "animation, baseColor, duration" },
      // Generic property terms
      { keywords: ["border radius", "arredondamento", "rounded", "border-radius"], label: "Token: Border Radius", section: "sec-tokens", sub: "wb-spacing-sizing", hint: "$tokens.borderRadius" },
      { keywords: ["border width", "espessura borda", "border-width"], label: "Token: Border Width", section: "sec-tokens", sub: "wb-spacing-sizing", hint: "$tokens.borderWidth" },
      { keywords: ["spacing", "espaçamento", "gap"], label: "Token: Spacing", section: "sec-tokens", sub: "wb-spacing-sizing", hint: "$tokens.spacing" },
      { keywords: ["color", "cor", "cores", "tema", "theme"], label: "Token: Colors", section: "sec-tokens", sub: "wb-colors", hint: "$tokens.colors" },
      { keywords: ["font family", "fonte", "tipografia fonte"], label: "Font Family", section: "sec-typo", sub: "wb-font-families", hint: "$tokens.fontFamilies" },
      { keywords: ["font size", "tamanho fonte"], label: "Font Size", section: "sec-typo", sub: "wb-font-sizes", hint: "$tokens.fontSizes" },
      { keywords: ["font weight", "peso fonte", "bold", "negrito"], label: "Font Weight", section: "sec-typo", sub: "wb-font-weights", hint: "$tokens.fontWeights" },
      { keywords: ["line height", "altura linha", "line-height"], label: "Line Height", section: "sec-typo", sub: "wb-line-heights", hint: "$tokens.lineHeights" },
      { keywords: ["letter spacing", "espaçamento letras"], label: "Letter Spacing", section: "sec-typo", sub: "wb-letter-spacings", hint: "$tokens.letterSpacings" },
    ];

    for (const prop of propertyMap) {
      items.push({
        id: `prop:${prop.label}`,
        label: prop.label,
        category: "Propriedade",
        icon: "⚙",
        hint: prop.hint,
        // Include all keywords as searchable metadata in the label alternative
        action: propNav(prop.section, prop.sub),
        // Extra searchable text: join all keywords for matching
        keywords: prop.keywords,
      });
    }

    // ---- Cores ----
    const colors = layout.tokens?.colors || {};
    for (const [key, tok] of Object.entries(colors)) {
      const val = (tok as any).value;
      items.push({
        id: `color:${key}`, label: key, category: "Cor", icon: "swatch", hint: val,
        action: () => {
          setActiveTab("layout");
          setTimeout(() => { openAccordion("wb-colors"); scrollToSection("wb-colors"); }, 60);
        },
      });
    }

    // ---- Tokens (spacing, sizing, radii, fontSizes, fontWeights) ----
    const tokenCats = [
      { cat: "spacing", label: "Spacing" },
      { cat: "sizing", label: "Sizing" },
      { cat: "borderRadius", label: "Border Radius" },
      { cat: "fontSizes", label: "Font Size" },
      { cat: "fontWeights", label: "Font Weight" },
      { cat: "lineHeights", label: "Line Height" },
      { cat: "letterSpacings", label: "Letter Spacing" },
    ];
    for (const tc of tokenCats) {
      const toks = layout.tokens?.[tc.cat] || {};
      for (const [key, tok] of Object.entries(toks)) {
        const v = tok as any;
        const display = v.value != null ? (v.unit ? `${v.value}${v.unit}` : `${v.value}`) : (v.family || "");
        items.push({
          id: `token:${tc.cat}.${key}`, label: `${tc.label}: ${key}`, category: "Token", icon: "◆", hint: display,
          action: () => {
            setActiveTab("layout");
            const sectionId = tc.cat === "spacing" || tc.cat === "sizing" || tc.cat === "borderRadius" || tc.cat === "borderWidth" ? "wb-spacing-sizing"
              : tc.cat === "fontSizes" ? "wb-font-sizes"
              : tc.cat === "fontWeights" ? "wb-font-weights"
              : tc.cat === "lineHeights" ? "wb-line-heights"
              : tc.cat === "letterSpacings" ? "wb-letter-spacings"
              : "sec-tokens";
            setTimeout(() => { openAccordion(sectionId); scrollToSection(sectionId); }, 60);
          },
        });
      }
    }

    // ---- Font Families ----
    const fontFamilies = layout.tokens?.fontFamilies || {};
    for (const [key, tok] of Object.entries(fontFamilies)) {
      const fam = (tok as any).family || key;
      items.push({
        id: `font:${key}`, label: `Font: ${fam}`, category: "Tipografia", icon: "🔤", hint: key,
        action: () => {
          setActiveTab("layout");
          setTimeout(() => { openAccordion("wb-font-families"); scrollToSection("wb-font-families"); }, 60);
        },
      });
    }

    // ---- Text Styles ----
    const textStyles = layout.textStyles || {};
    for (const key of Object.keys(textStyles)) {
      items.push({
        id: `ts:${key}`, label: `Text Style: ${key}`, category: "Tipografia", icon: "✏️",
        action: () => {
          setActiveTab("layout");
          setTimeout(() => { openAccordion("sec-typo"); scrollToSection("sec-typo"); }, 60);
        },
      });
    }

    // ---- Componentes ----
    const comps = registry.components || {};
    for (const [name, comp] of Object.entries(comps)) {
      const c = comp as any;
      items.push({
        id: `comp:${name}`, label: name, category: "Componente", icon: "◻",
        hint: c.category || "",
        action: () => {
          setActiveTab("components");
        },
      });
    }

    // ---- Páginas ----
    const pages = layout.structure?.pages || {};
    for (const [key, pg] of Object.entries(pages)) {
      const p = pg as any;
      items.push({
        id: `page:${key}`, label: `Página: ${p.label || key}`, category: "Página", icon: "📄",
        hint: key,
        action: () => {
          setActiveTab("layout");
          setTimeout(() => { openAccordion("sec-pages"); scrollToSection("sec-pages"); }, 60);
        },
      });
    }

    // ---- Ações ----
    items.push({
      id: "act:save", label: "Salvar no projeto", category: "Ação", icon: "💾",
      action: () => {
        document.querySelector<HTMLButtonElement>('button[class*="save"], button')?.click();
      },
    });
    items.push({
      id: "act:export-layout", label: "Export Layout JSON", category: "Ação", icon: "📦",
      action: () => {
        setActiveTab("layout");
        setTimeout(() => { openAccordion("sec-io"); scrollToSection("sec-io"); }, 60);
      },
    });
    items.push({
      id: "act:tab-layout", label: "Ir para Layout", category: "Ação", icon: "📐",
      action: () => setActiveTab("layout"),
    });
    items.push({
      id: "act:tab-components", label: "Ir para Componentes", category: "Ação", icon: "◻",
      action: () => setActiveTab("components"),
    });

    return items;
  }, [layout, registry, setActiveTab, scrollToSection, openAccordion]);
}
