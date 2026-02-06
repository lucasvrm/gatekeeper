// ============================================================================
// Orqui Runtime — Breadcrumb Renderer
// ============================================================================
import React, { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import type { BreadcrumbsConfig, BreadcrumbItem, PageConfig, Tokens } from "../types.js";
import { resolveTokenRef } from "../tokens.js";
import { IconValue } from "../icons.js";

export function BreadcrumbRenderer({ config, pages, currentPage, navigate, resolveToken, items: itemsOverride }: {
  config?: BreadcrumbsConfig;
  pages?: Record<string, PageConfig>;
  currentPage?: string;
  navigate?: (route: string) => void;
  resolveToken?: (ref: string) => string | number | null;
  getTextStyle?: (name: string) => CSSProperties;
  /** Explicit breadcrumb trail — when provided, overrides auto-generated crumbs.
   *  Home is auto-prepended unless showHome is false. */
  items?: BreadcrumbItem[];
}) {
  if (!config?.enabled) return null;

  // Track pathname reactively — covers pushState, replaceState, and popstate
  const [pathname, setPathname] = useState(() =>
    typeof window !== "undefined" ? window.location.pathname : "/"
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => setPathname(window.location.pathname);

    // Listen for back/forward
    window.addEventListener("popstate", sync);

    // Monkey-patch pushState/replaceState to detect SPA navigation
    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);
    history.pushState = (...args: Parameters<typeof origPush>) => { origPush(...args); sync(); };
    history.replaceState = (...args: Parameters<typeof origReplace>) => { origReplace(...args); sync(); };

    return () => {
      window.removeEventListener("popstate", sync);
      history.pushState = origPush;
      history.replaceState = origReplace;
    };
  }, []);

  const resolve = (ref?: string) => ref ? (resolveToken?.(ref) ?? ref) : undefined;

  // ── Build items: explicit override OR auto-generated from URL ──────────

  let items: { label: string; route?: string; icon?: string }[];

  if (itemsOverride && itemsOverride.length > 0) {
    // Consumer provided explicit breadcrumbs — use them directly
    items = [];
    if (config.showHome !== false) {
      items.push({ label: config.homeLabel || "Home", route: config.homeRoute || "/" });
    }
    items.push(...itemsOverride);
  } else {
    // Auto-generate from URL path segments (existing behavior)
    const pathSegments = pathname.split("/").filter(Boolean);
    const derivedPage = currentPage || pathSegments[0] || "";
    if (!derivedPage) return null;

    items = [];
    if (config.showHome !== false) {
      items.push({ label: config.homeLabel || "Home", route: config.homeRoute || "/" });
    }

    const segments = currentPage ? [currentPage] : pathSegments;
    segments.forEach((seg, i) => {
      const pageConfig = pages?.[seg];
      const label = pageConfig?.label || seg.charAt(0).toUpperCase() + seg.slice(1).replace(/[-_]/g, " ");
      const isLast = i === segments.length - 1;
      const route = isLast ? undefined : "/" + segments.slice(0, i + 1).join("/");
      items.push({ label, route });
    });
  }

  const alignment = config.alignment || "left";
  const justifyMap: Record<string, string> = { left: "flex-start", center: "center", right: "flex-end" };

  // autoHide: skip rendering if only 1 segment (home counts as segment)
  if (config.autoHide && items.length <= 1) return null;

  // Resolve separator display — arrows override takes priority
  const sepChar = config.arrows ? "›"
    : config.separator === ">" || config.separator === "chevron" ? "›"
    : config.separator === "/" ? "/"
    : config.separator === "→" || config.separator === "arrow" ? "→"
    : config.separator || "/";

  // Get text style from contract if defined
  const textStyleName = config.typography?.textStyle;
  const textStyleCSS = textStyleName && getTextStyle ? getTextStyle(textStyleName) : {};

  // Typography config - Priority: inline override > textStyle > hardcoded default
  const typo = config.typography;
  const baseFontSize = resolve(typo?.fontSize) ?? textStyleCSS.fontSize ?? 13;
  const baseFontWeight = resolve(typo?.fontWeight) ?? textStyleCSS.fontWeight ?? 400;
  const baseFontFamily = resolve(typo?.fontFamily) ?? textStyleCSS.fontFamily as string | undefined;
  const baseColor = resolve(typo?.color) ?? textStyleCSS.color ?? "var(--muted-foreground)";
  const activeColor = resolve(typo?.activeColor) ?? textStyleCSS.color ?? "var(--foreground)";
  const activeWeight = resolve(typo?.activeFontWeight) ?? textStyleCSS.fontWeight ?? 600;
  const sepColor = resolve(typo?.separatorColor) ?? textStyleCSS.color ?? "var(--muted-foreground)";

  // Padding config
  const pad = config.padding;
  const padStyle = pad ? {
    paddingTop: resolve(pad.top) ?? undefined,
    paddingRight: resolve(pad.right) ?? undefined,
    paddingBottom: resolve(pad.bottom) ?? undefined,
    paddingLeft: resolve(pad.left) ?? undefined,
  } : {};

  return (
    <div data-orqui-breadcrumbs="" style={{
      display: "flex",
      alignItems: "center",
      justifyContent: justifyMap[alignment] || "flex-start",
      fontFamily: baseFontFamily as string | undefined,
      ...padStyle,
    }}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        const isClickable = !isLast && config.clickable && !!item.route;
        return (
          <span key={i} style={{ display: "inline-flex", alignItems: "center" }}>
            <span
              onClick={() => {
                if (isClickable) {
                  if (navigate) navigate(item.route!);
                  else window.location.href = item.route!;
                }
              }}
              style={{
                ...textStyleCSS,
                ...(baseFontSize != null ? { fontSize: baseFontSize as string | number } : {}),
                ...(baseFontWeight != null ? { fontWeight: baseFontWeight as string | number } : {}),
                ...(baseFontFamily ? { fontFamily: baseFontFamily as string } : {}),
                ...(isLast && activeWeight != null ? { fontWeight: activeWeight as string | number } : {}),
                ...(baseColor ? { color: baseColor as string } : {}),
                ...(isLast && activeColor ? { color: activeColor as string } : {}),
                cursor: isClickable ? "pointer" : "default",
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => {
                if (isClickable && activeColor) (e.target as HTMLElement).style.color = String(activeColor);
              }}
              onMouseLeave={(e) => {
                if (isClickable && !isLast && baseColor) (e.target as HTMLElement).style.color = String(baseColor);
              }}
            >
              {item.label}
            </span>
            {!isLast && (
              <span style={{
                ...(sepColor ? { color: sepColor as string } : {}),
                margin: "0 6px",
                fontSize: typeof baseFontSize === "number"
                  ? baseFontSize * 0.9
                  : (baseFontSize || textStyleCSS.fontSize || 12),
                opacity: 0.6,
              }}>
                {sepChar}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
