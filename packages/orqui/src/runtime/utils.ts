// ============================================================================
// Orqui Runtime — Utilities
// ============================================================================
import type { LayoutContract, RegionConfig } from "./types.js";

export function deepMerge(base: any, override: any): any {
  if (override === undefined) return base;
  if (override === null) return null;
  if (Array.isArray(override)) return override;
  if (typeof override !== "object") return override;
  if (typeof base !== "object" || base === null || Array.isArray(base)) {
    return { ...override };
  }
  const result = { ...base };
  for (const key of Object.keys(override)) {
    result[key] = deepMerge(base[key], override[key]);
  }
  return result;
}

export function resolvePageKey(layout: LayoutContract, page?: string): string | undefined {
  if (!page) return undefined;
  const pages = layout.structure.pages;
  if (!pages) return undefined;
  if (pages[page]) return page;

  const cleanPage = page.split(/[?#]/)[0];
  const trimmed = cleanPage.replace(/\/+$/, "");
  const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const candidates = new Set<string>([cleanPage, trimmed, normalized]);

  const segments = trimmed.split("/").filter(Boolean);
  if (segments.length > 1) {
    candidates.add(`/${segments[0]}`);
  }

  for (const [key, cfg] of Object.entries(pages)) {
    const route = cfg?.route;
    if (!route) continue;
    const routeClean = route.split(/[?#]/)[0].replace(/\/+$/, "");
    if (candidates.has(route) || candidates.has(routeClean)) {
      return key;
    }
  }

  return undefined;
}

export function resolvePageLayout(layout: LayoutContract, page?: string): LayoutContract {
  const pageKey = resolvePageKey(layout, page);
  if (!pageKey || !layout.structure.pages?.[pageKey]) return layout;
  const pageConfig = layout.structure.pages[pageKey];
  const overrides = pageConfig.overrides || {};
  const hasOverride = (key: string) => Object.prototype.hasOwnProperty.call(overrides, key);
  const mergedRegions: Record<string, RegionConfig> = { ...layout.structure.regions };
  for (const regionName of ["sidebar", "header", "main", "footer"]) {
    if (hasOverride(regionName)) {
      const override = (overrides as any)[regionName];
      mergedRegions[regionName] = deepMerge((layout.structure.regions as any)[regionName], override);
    }
  }
  const mergedHeaderElements = hasOverride("headerElements")
    ? deepMerge(layout.structure.headerElements || {}, (overrides as any).headerElements)
    : layout.structure.headerElements;
  const mergedContentLayout = hasOverride("contentLayout")
    ? deepMerge(layout.structure.contentLayout || {}, (overrides as any).contentLayout)
    : layout.structure.contentLayout;
  const mergedPageHeader = hasOverride("pageHeader")
    ? deepMerge(layout.structure.pageHeader || {}, (overrides as any).pageHeader)
    : layout.structure.pageHeader;
  return {
    ...layout,
    structure: {
      ...layout.structure,
      regions: mergedRegions,
      headerElements: mergedHeaderElements,
      contentLayout: mergedContentLayout,
      pageHeader: mergedPageHeader,
    },
  };
}
