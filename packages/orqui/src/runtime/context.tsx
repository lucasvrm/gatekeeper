// ============================================================================
// Orqui Runtime — Contract Context & Hooks
// ============================================================================
import React, { createContext, useContext, useMemo, useEffect } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { Tokens, LayoutContract, UIRegistryContract, ContractContextValue } from "./types.js";
import { resolveTokenRef, tokenToCSS, resolveTextStyleCSS } from "./tokens.js";
import { buildStyleSheet } from "./stylesheet.js";
import { resolvePageLayout } from "./utils.js";

// ============================================================================
// Context
// ============================================================================
const ContractContext = createContext<ContractContextValue | null>(null);

export function useContract(): ContractContextValue {
  const ctx = useContext(ContractContext);
  if (!ctx) throw new Error("useContract must be used within <ContractProvider>");
  return ctx;
}

// ============================================================================
// ContractProvider
// ============================================================================
interface ContractProviderProps {
  layout: LayoutContract;
  registry: UIRegistryContract;
  children: ReactNode;
  injectCSS?: boolean;
}

export function ContractProvider({ layout, registry, children, injectCSS = true }: ContractProviderProps) {
  const value = useMemo<ContractContextValue>(() => ({
    layout, registry, tokens: layout.tokens,
    resolveToken: (ref: string) => resolveTokenRef(ref, layout.tokens),
    getTextStyle: (name: string) => {
      const style = (layout.textStyles as any)?.[name];
      return style ? resolveTextStyleCSS(style, layout.tokens) : {};
    },
    getTokenValue: (category: string, key: string) => {
      const token = (layout.tokens as any)[category]?.[key];
      return token ? tokenToCSS(token) : "";
    },
    color: (name: string) => (layout.tokens.colors as any)?.[name]?.value ?? "",
  }), [layout, registry]);

  const styleSheet = useMemo(
    () => injectCSS ? buildStyleSheet(layout.tokens, layout) : "",
    [layout.tokens, injectCSS]
  );

  // Build component-specific CSS from registry styles
  const componentCSS = useMemo(() => {
    if (!injectCSS || !registry?.components) return "";
    const lines: string[] = [];
    const scrollArea = registry.components.ScrollArea ?? registry.components.scrollArea;
    if (scrollArea?.styles) {
      const st = scrollArea.styles;
      if (st.preset === "hidden") {
        lines.push(`/* ScrollArea: hidden */`);
        lines.push(`::-webkit-scrollbar { width: 0 !important; height: 0 !important; }`);
        lines.push(`* { scrollbar-width: none !important; }`);
      } else if (st.preset !== "default" && (st.thumbWidth != null || st.thumbColor)) {
        const tw = st.thumbWidth ?? 6;
        const tc = st.thumbColor ?? "rgba(255,255,255,0.2)";
        const trc = st.trackColor ?? "transparent";
        const tr = st.thumbRadius ?? 99;
        const htw = st.hoverThumbWidth ?? tw;
        const htc = st.hoverThumbColor ?? tc;
        lines.push(`/* ScrollArea: custom scrollbar */`);
        lines.push(`* { scrollbar-width: thin; scrollbar-color: ${tc} ${trc}; }`);
        lines.push(`::-webkit-scrollbar { width: ${tw}px; height: ${tw}px; }`);
        lines.push(`::-webkit-scrollbar-track { background: ${trc}; }`);
        lines.push(`::-webkit-scrollbar-thumb { background: ${tc}; border-radius: ${tr}px; }`);
        lines.push(`::-webkit-scrollbar-thumb:hover { background: ${htc}; }`);
        if (htw !== tw) {
          lines.push(`:hover::-webkit-scrollbar { width: ${htw}px; }`);
        }
        if (!st.showArrows) {
          lines.push(`::-webkit-scrollbar-button { display: none; }`);
        }
        if (st.autoHide) {
          lines.push(`::-webkit-scrollbar-thumb { transition: background 0.3s; }`);
        }
      }
    }
    return lines.join("\n");
  }, [registry, injectCSS]);

  // Dynamically load Google Fonts for all referenced font families
  useEffect(() => {
    const families = layout.tokens.fontFamilies ?? {};
    const toLoad = Object.values(families)
      .map((f: any) => f.family)
      .filter(Boolean);
    if (toLoad.length === 0) return;
    const existing = new Set(
      Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .map((l: HTMLLinkElement) => l.href)
    );
    toLoad.forEach((family: string) => {
      const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@300;400;500;600;700&display=swap`;
      if (!existing.has(url)) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = url;
        document.head.appendChild(link);
      }
    });
  }, [layout.tokens.fontFamilies]);

  return (
    <ContractContext.Provider value={value}>
      {injectCSS && <style dangerouslySetInnerHTML={{ __html: styleSheet + "\n" + componentCSS }} />}
      {children}
    </ContractContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================
export function useToken(category: string, key: string): string {
  const { getTokenValue } = useContract();
  return getTokenValue(category, key);
}

export function useTextStyle(name: string): CSSProperties {
  const { getTextStyle } = useContract();
  return useMemo(() => getTextStyle(name), [getTextStyle, name]);
}

export function useTokens(): Tokens { return useContract().tokens; }
export function useColor(name: string): string { return useContract().color(name); }

export function useEmptyState() {
  const { layout } = useContract();
  return layout.structure.emptyState ?? { icon: "ph:magnifying-glass", title: "Nenhum item encontrado", description: "", showAction: true, actionLabel: "Criar Novo" };
}

export function useSkeletonConfig() {
  const { layout } = useContract();
  return layout.structure.skeleton ?? { animation: "pulse", baseColor: "rgba(255,255,255,0.05)", highlightColor: "rgba(255,255,255,0.10)", borderRadius: "6px", duration: "1.5s" };
}

export function useToastConfig() {
  const { layout } = useContract();
  return layout.structure.toast ?? { position: "bottom-right" as const, maxVisible: 3, duration: 4000 };
}

export function useScrollbarConfig() {
  const { layout } = useContract();
  return layout.structure.scrollbar ?? { width: "6px", thumbColor: "rgba(255,255,255,0.08)", thumbHoverColor: "rgba(255,255,255,0.15)", trackColor: "transparent", borderRadius: "3px" };
}

export function useLayoutMode(): "sidebar-first" | "header-first" {
  const { layout } = useContract();
  return layout.structure.layoutMode || "sidebar-first";
}

export function useComponentDef(name: string) {
  const { registry } = useContract();
  return registry.components[name] ?? null;
}
