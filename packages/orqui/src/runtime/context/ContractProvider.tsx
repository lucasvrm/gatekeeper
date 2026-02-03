// ============================================================================
// Orqui ContractProvider v2
// React context that holds the contract + variable schema + runtime state
// ============================================================================

import React, { createContext, useContext, useMemo, useEffect, type ReactNode } from "react";
import { generateTokenCSS } from "../hooks/useTokens.js";
import type { DataContext, AppContext } from "../../engine/resolver.js";
import {
  resolveTemplate,
  resolveTemplateText,
  resolveTemplateForList,
} from "../../engine/resolver.js";
import {
  evaluateVisibility,
  filterByVisibility,
} from "../../engine/visibility.js";
import type { VisibilityRule, ViewportContext } from "../../engine/visibility.js";
import type { ResolvedTemplate } from "../../engine/resolver.js";

// ============================================================================
// Types — Contract shape (mirrors the JSON spec)
// ============================================================================

export interface LayoutContractV2 {
  $orqui: { schema: string; version: string; hash: string; generatedAt: string };
  app: AppConfig;
  tokens: Record<string, Record<string, TokenValue>>;
  textStyles: Record<string, TextStyleDef>;
  shell: ShellConfig;
  navigation: NavItem[];
  pages: Record<string, PageDefinition>;
}

export interface AppConfig {
  name: string;
  favicon?: { type: string; value: string };
  logo?: LogoConfig;
}

export interface LogoConfig {
  type: "text" | "icon-text" | "image";
  text?: string;
  icon?: string;
  src?: string;
  font?: { family?: string; size?: number; weight?: number; color?: string };
}

export interface TokenValue {
  value: string | number;
  unit?: string;
}

export interface TextStyleDef {
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string | number;
  lineHeight?: string | number;
  letterSpacing?: string;
}

export interface ShellConfig {
  layout: "sidebar-left" | "sidebar-right" | "topbar" | "minimal";
  sidebar?: SidebarConfig;
  header?: HeaderConfig;
  footer?: { enabled: boolean; height?: number };
}

export interface SidebarConfig {
  width: number;
  collapsedWidth: number;
  collapsible: boolean;
  background?: string;
  sections: SidebarSection[];
  separators?: Record<string, { enabled: boolean; color?: string; style?: string }>;
  collapseButton?: { position: string; icon: string };
}

export interface SidebarSection {
  id: string;
  type: "logo" | "navigation" | "search" | "slot";
  props?: Record<string, unknown>;
}

export interface HeaderConfig {
  height: number;
  background?: string;
  border?: Record<string, unknown>;
  left: HeaderElement[];
  center: HeaderElement[];
  right: HeaderElement[];
}

export interface HeaderElement {
  id: string;
  type: "breadcrumbs" | "search" | "button" | "icon-button" | "text" | "slot";
  props?: Record<string, unknown>;
  visibility?: VisibilityRule;
}

export interface NavItem {
  id: string;
  label?: string;
  icon?: string;
  route?: string;
  order: number;
  type?: "item" | "divider" | "group";
  badge?: string;
  position?: "top" | "bottom";
  visibility?: VisibilityRule;
  children?: NavItem[];
}

export interface PageDefinition {
  id: string;
  label: string;
  route: string;
  browserTitle?: string;
  header?: PageHeaderOverrides;
  content: NodeDef;
  visibility?: VisibilityRule;
}

export interface PageHeaderOverrides {
  cta?: { enabled: boolean; label?: string; icon?: string; route?: string; variant?: string };
  hideElements?: string[];
  addElements?: {
    left?: HeaderElement[];
    center?: HeaderElement[];
    right?: HeaderElement[];
  };
}

export interface NodeDef {
  id: string;
  type: string;
  props?: Record<string, any>;
  children?: NodeDef[];
  style?: Record<string, string>;
  visibility?: VisibilityRule;
}

// ============================================================================
// Context
// ============================================================================

export interface OrquiContextValue {
  /** The full layout contract */
  contract: LayoutContractV2;
  /** Variable schema from the project */
  variables: Record<string, any>;
  /** UI registry contract (optional, for component lookups) */
  registry?: Record<string, any>;

  /** Current page ID */
  currentPage: string;
  /** Current viewport breakpoint */
  viewport: ViewportContext;
  /** Whether sidebar is collapsed */
  sidebarCollapsed: boolean;

  /** Resolve a template string against given data */
  resolve: (template: string, data?: DataContext) => ResolvedTemplate;
  /** Resolve a template to plain text */
  resolveText: (template: string, data?: DataContext) => string;
  /** Resolve templates for a list of items */
  resolveList: (template: string, entityName: string, items: unknown[]) => ResolvedTemplate[];
  /** Evaluate a visibility rule */
  isVisible: (rule?: VisibilityRule, data?: DataContext) => boolean;
  /** Filter items by visibility */
  filterVisible: <T extends { visibility?: VisibilityRule }>(items: T[], data?: DataContext) => T[];

  /** Resolve a token reference like "$tokens.colors.accent" */
  resolveToken: (ref: string) => string;
  /** Get a text style definition */
  getTextStyle: (name: string) => TextStyleDef | undefined;

  /** Get page definition */
  getPage: (pageId: string) => PageDefinition | undefined;
  /** Get visible navigation items */
  getNavItems: (data?: DataContext) => NavItem[];
  /** Get shell header elements for current page (with overrides applied) */
  getHeaderElements: (zone: "left" | "center" | "right", data?: DataContext) => HeaderElement[];

  /** Global data context (stats, user, features) */
  globalData: DataContext;
  /** Set global data */
  setGlobalData: (data: DataContext) => void;

  /** Toggle sidebar */
  toggleSidebar: () => void;
  /** Set current page */
  setCurrentPage: (pageId: string) => void;
}

const OrquiContext = createContext<OrquiContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

export interface ContractProviderProps {
  /** Layout contract JSON */
  layout: LayoutContractV2;
  /** Variable schema JSON */
  variables: Record<string, any>;
  /** UI registry (optional) */
  registry?: Record<string, any>;
  /** Initial page ID */
  initialPage?: string;
  /** Initial global data (stats, user, features) */
  initialData?: DataContext;
  /** Locale for formatting */
  locale?: string;
  /** Navigation handler */
  onNavigate?: (route: string) => void;
  children: ReactNode;
}

// Defensive defaults for incomplete contracts (e.g. v1 JSON or partial config)
const DEFAULT_APP: AppConfig = { name: "App" };
const DEFAULT_SHELL: ShellConfig = {
  layout: "sidebar-left",
  sidebar: { width: 260, collapsedWidth: 64, collapsible: true, sections: [{ id: "logo", type: "logo" }, { id: "nav", type: "navigation" }] },
  header: { height: 56, left: [], center: [], right: [] },
};

export function ContractProvider({
  layout: rawLayout,
  variables = {},
  registry,
  initialPage = "dashboard",
  initialData = {},
  locale = "pt-BR",
  onNavigate,
  children,
}: ContractProviderProps) {
  // Normalize layout with defensive defaults so v1 JSONs don't crash
  const layout: LayoutContractV2 = useMemo(() => ({
    $orqui: rawLayout?.$orqui ?? { schema: "layout-contract/v2", version: "2.0.0", hash: "", generatedAt: "" },
    app: rawLayout?.app ?? DEFAULT_APP,
    tokens: rawLayout?.tokens ?? {},
    textStyles: rawLayout?.textStyles ?? {},
    shell: rawLayout?.shell ?? DEFAULT_SHELL,
    navigation: rawLayout?.navigation ?? [],
    pages: rawLayout?.pages ?? {},
  }), [rawLayout]);

  const [currentPage, setCurrentPage] = React.useState(initialPage);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [globalData, setGlobalData] = React.useState<DataContext>(initialData);
  const [viewport, setViewport] = React.useState<ViewportContext>({
    breakpoint: "desktop",
  });

  // Responsive breakpoint detection
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const update = () => {
      const w = window.innerWidth;
      let bp: "mobile" | "tablet" | "desktop" = "desktop";
      if (w < 768) bp = "mobile";
      else if (w < 1024) bp = "tablet";
      setViewport({ breakpoint: bp, width: w });
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Build AppContext once (memoized)
  const appCtx: AppContext = useMemo(
    () => ({
      app: { name: layout.app?.name ?? "App", ...Object.fromEntries(Object.entries(layout.app ?? {}).filter(([k]) => k !== "name")) },
      page: layout.pages?.[currentPage]
        ? {
            id: layout.pages[currentPage].id ?? currentPage,
            label: layout.pages[currentPage].label ?? currentPage,
            route: layout.pages[currentPage].route ?? "/",
          }
        : { id: currentPage, label: currentPage, route: "/" },
      variables,
      tokens: layout.tokens ?? {},
      locale,
    }),
    [layout, variables, currentPage, locale]
  );

  // Token resolver
  const resolveToken = React.useCallback(
    (ref: string): string => {
      if (!ref.startsWith("$tokens.")) return ref;
      const path = ref.slice("$tokens.".length).split(".");
      let current: any = layout.tokens;
      for (const segment of path) {
        if (current == null) return ref;
        current = current[segment];
      }
      if (current && typeof current === "object" && "value" in current) {
        const token = current as TokenValue;
        return token.unit ? `${token.value}${token.unit}` : String(token.value);
      }
      return current != null ? String(current) : ref;
    },
    [layout.tokens]
  );

  // Template resolution
  const resolve = React.useCallback(
    (template: string, data?: DataContext) =>
      resolveTemplate(template, { ...globalData, ...data }, appCtx),
    [globalData, appCtx]
  );

  const resolveTextFn = React.useCallback(
    (template: string, data?: DataContext) =>
      resolveTemplateText(template, { ...globalData, ...data }, appCtx),
    [globalData, appCtx]
  );

  const resolveList = React.useCallback(
    (template: string, entityName: string, items: unknown[]) =>
      resolveTemplateForList(template, entityName, items, appCtx),
    [appCtx]
  );

  // Visibility
  const isVisible = React.useCallback(
    (rule?: VisibilityRule, data?: DataContext) =>
      evaluateVisibility(rule, currentPage, { ...globalData, ...data }, appCtx, viewport),
    [currentPage, globalData, appCtx, viewport]
  );

  const filterVisible = React.useCallback(
    <T extends { visibility?: VisibilityRule }>(items: T[], data?: DataContext) =>
      filterByVisibility(items, currentPage, { ...globalData, ...data }, appCtx, viewport),
    [currentPage, globalData, appCtx, viewport]
  );

  // Getters
  const getTextStyle = React.useCallback(
    (name: string) => layout.textStyles?.[name],
    [layout.textStyles]
  );

  const getPage = React.useCallback(
    (pageId: string) => layout.pages[pageId],
    [layout.pages]
  );

  const getNavItems = React.useCallback(
    (data?: DataContext) => {
      const mergedData = { ...globalData, ...data };
      const items = [...(layout.navigation ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      return filterByVisibility(items, currentPage, mergedData, appCtx, viewport);
    },
    [layout.navigation, currentPage, globalData, appCtx, viewport]
  );

  const getHeaderElements = React.useCallback(
    (zone: "left" | "center" | "right", data?: DataContext) => {
      const mergedData = { ...globalData, ...data };
      const shell = layout.shell?.header;
      if (!shell) return [];

      // Start with shell-level elements
      let elements = [...(shell[zone] || [])];

      // Apply page-level overrides
      const page = layout.pages[currentPage];
      if (page?.header) {
        const overrides = page.header;

        // Hide elements
        if (overrides.hideElements) {
          elements = elements.filter((el) => !overrides.hideElements!.includes(el.id));
        }

        // Add elements
        if (overrides.addElements?.[zone]) {
          elements = [...elements, ...overrides.addElements[zone]!];
        }

        // CTA override (applies to the element with id "cta-main" in right zone)
        if (overrides.cta && zone === "right") {
          if (!overrides.cta.enabled) {
            elements = elements.filter((el) => el.id !== "cta-main");
          } else if (overrides.cta.label) {
            elements = elements.map((el) => {
              if (el.id === "cta-main") {
                return {
                  ...el,
                  props: {
                    ...el.props,
                    label: overrides.cta!.label,
                    route: overrides.cta!.route || el.props?.route,
                    icon: overrides.cta!.icon || el.props?.icon,
                    variant: overrides.cta!.variant || el.props?.variant,
                  },
                };
              }
              return el;
            });
          }
        }
      }

      // Filter by visibility
      return filterByVisibility(elements, currentPage, mergedData, appCtx, viewport);
    },
    [layout.shell?.header, layout.pages, currentPage, globalData, appCtx, viewport]
  );

  const toggleSidebar = React.useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const value: OrquiContextValue = useMemo(
    () => ({
      contract: layout,
      variables,
      registry,
      currentPage,
      viewport,
      sidebarCollapsed,
      resolve,
      resolveText: resolveTextFn,
      resolveList,
      isVisible,
      filterVisible,
      resolveToken,
      getTextStyle,
      getPage,
      getNavItems,
      getHeaderElements,
      globalData,
      setGlobalData,
      toggleSidebar,
      setCurrentPage,
    }),
    [
      layout, variables, registry, currentPage, viewport, sidebarCollapsed,
      resolve, resolveTextFn, resolveList, isVisible, filterVisible,
      resolveToken, getTextStyle, getPage, getNavItems, getHeaderElements,
      globalData, toggleSidebar,
    ]
  );

  // ── Inject CSS variables into the DOM ──
  useEffect(() => {
    if (!layout.tokens || typeof document === "undefined") return;

    const styleId = "orqui-contract-tokens";
    let el = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = styleId;
      document.head.appendChild(el);
    }
    el.textContent = generateTokenCSS(layout.tokens);

    return () => {
      el?.remove();
    };
  }, [layout.tokens]);

  return (
    <OrquiContext.Provider value={value}>
      {children}
    </OrquiContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

export function useOrqui(): OrquiContextValue {
  const ctx = useContext(OrquiContext);
  if (!ctx) {
    throw new Error("useOrqui must be used within a <ContractProvider>");
  }
  return ctx;
}

export function useContract(): LayoutContractV2 {
  return useOrqui().contract;
}

export function useResolve() {
  const { resolve, resolveText, resolveList } = useOrqui();
  return { resolve, resolveText, resolveList };
}

export function useVisibility() {
  const { isVisible, filterVisible } = useOrqui();
  return { isVisible, filterVisible };
}

export function useTokens() {
  const { resolveToken, getTextStyle, contract } = useOrqui();
  return { resolveToken, getTextStyle, tokens: contract.tokens };
}

export function useNavigation() {
  const { getNavItems, currentPage, setCurrentPage } = useOrqui();
  return { navItems: getNavItems(), currentPage, setCurrentPage };
}

export function usePage(pageId?: string) {
  const { getPage, currentPage, resolve, resolveText, globalData } = useOrqui();
  const id = pageId || currentPage;
  const page = getPage(id);
  return { page, resolve, resolveText, globalData };
}
