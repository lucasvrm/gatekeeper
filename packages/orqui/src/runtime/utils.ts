// ============================================================================
// Orqui Runtime — Utilities
// ============================================================================
import type { LayoutContract, RegionConfig } from "./types.js";

export function deepMerge(base: any, override: any): any {
  if (override === undefined) return base;
  if (override === null || typeof override !== "object" || typeof base !== "object") return override;
  if (Array.isArray(override)) return override;
  const result = { ...base };
  for (const key of Object.keys(override)) {
    result[key] = deepMerge(base[key], override[key]);
  }
  return result;
}

export function resolvePageLayout(layout: LayoutContract, page?: string): LayoutContract {
  if (!page || !layout.structure.pages?.[page]) return layout;
  const pageConfig = layout.structure.pages[page];
  const overrides = pageConfig.overrides || {};
  const mergedRegions: Record<string, RegionConfig> = {};
  for (const [name, region] of Object.entries(layout.structure.regions)) {
    mergedRegions[name] = (overrides as any)[name] ? deepMerge(region, (overrides as any)[name]) : region;
  }
  const mergedHeaderElements = overrides.headerElements
    ? deepMerge(layout.structure.headerElements || {}, overrides.headerElements)
    : layout.structure.headerElements;
  const mergedContentLayout = overrides.contentLayout
    ? deepMerge(layout.structure.contentLayout || {}, overrides.contentLayout)
    : layout.structure.contentLayout;
  const mergedPageHeader = overrides.pageHeader
    ? deepMerge(layout.structure.pageHeader || {}, overrides.pageHeader)
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
