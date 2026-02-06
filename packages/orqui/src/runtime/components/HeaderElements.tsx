// ============================================================================
// Orqui Runtime — Header Elements Renderer
// ============================================================================
import React, { useState } from "react";
import type { CSSProperties } from "react";
import type { HeaderElementsConfig, Tokens } from "../types.js";
import { resolveTokenRef } from "../tokens.js";
import { IconValue, PhosphorIcon, PHOSPHOR_SVG_PATHS } from "../icons.js";

export const HEADER_ICON_TO_PHOSPHOR: Record<string, string> = {
  bell: "bell", settings: "gear", user: "user", mail: "envelope", help: "question",
  moon: "moon", sun: "sun", menu: "list", search: "magnifying-glass", grid: "squares-four",
  download: "arrow-square-down", share: "share-network", server: "hard-drives",
};

export const CTA_VARIANT_CSS: Record<string, any> = {
  default:     { background: "var(--primary, #6d9cff)", color: "var(--primary-foreground, #fff)", border: "none" },
  destructive: { background: "var(--destructive, #ef4444)", color: "var(--destructive-foreground, #fff)", border: "none" },
  outline:     { background: "transparent", color: "var(--foreground)", border: "1px solid var(--border)" },
  secondary:   { background: "var(--secondary, #27272a)", color: "var(--secondary-foreground, #fafafa)", border: "none" },
  ghost:       { background: "transparent", color: "var(--foreground)", border: "none" },
};

export function HeaderElementsRenderer({ config, onSearch, onCTA, onIconClick, navigate, getTextStyle }: {
  config?: HeaderElementsConfig;
  onSearch?: (query: string) => void;
  onCTA?: () => void;
  onIconClick?: (iconId: string, route?: string) => void;
  navigate?: (route: string) => void;
  getTextStyle?: (name: string) => CSSProperties;
}) {
  if (!config) return null;
  const textStyleName = config.typography?.textStyle;
  const textStyleCSS = textStyleName && getTextStyle ? getTextStyle(textStyleName) : {};
  const textStyleColor = (textStyleCSS as CSSProperties).color;

  const handleNavigation = (route?: string, callback?: () => void) => {
    if (route) {
      if (navigate) navigate(route);
      else window.location.href = route;
    } else if (callback) callback();
  };

  const normalizeIcon = (item: string | { id: string; route?: string; icon?: string }) =>
    typeof item === "string" ? { id: item, route: "", icon: undefined } : item;

  // Resolve the Phosphor icon name for a header action icon
  const resolvePhosphorIcon = (iconId: string, customIcon?: string): string => {
    if (customIcon?.startsWith("ph:")) return customIcon.slice(3);
    return HEADER_ICON_TO_PHOSPHOR[iconId] || iconId;
  };

  const renderSearch = () => {
    if (!config.search?.enabled) return null;
    const searchIcon = config.search.icon?.startsWith("ph:") ? config.search.icon.slice(3) : "magnifying-glass";
    const searchIconColor = textStyleColor || "var(--muted-foreground, #888)";
    return (
      <div key="search" style={{
        display: "flex", alignItems: "center", gap: 6,
        background: "var(--muted, #1c1c21)", borderRadius: 6,
        padding: "4px 10px", border: "1px solid var(--border)",
      }}>
        {(config.search.showIcon !== false) && (
          <PhosphorIcon name={searchIcon} size={14} color={searchIconColor} />
        )}
        <input
          type="text"
          placeholder={config.search.placeholder || "Buscar..."}
          onChange={(e) => onSearch?.(e.target.value)}
          style={{
            fontSize: 13,
            background: "transparent", border: "none", outline: "none",
            color: "var(--foreground)", width: 160,
            ...textStyleCSS,
          }}
        />
      </div>
    );
  };

  const renderIcons = () => {
    if (!config.icons?.enabled) return null;
    return (config.icons.items || []).map(raw => {
      const ic = normalizeIcon(raw);
      const phName = resolvePhosphorIcon(ic.id, ic.icon);
      return (
        <button key={`icon-${ic.id}`} onClick={() => {
          if (onIconClick) onIconClick(ic.id, ic.route);
          else handleNavigation(ic.route);
        }} style={{
          background: "transparent", border: "none", cursor: "pointer",
          padding: 4, opacity: 0.7, color: "var(--foreground)", display: "flex", alignItems: "center",
          ...textStyleCSS,
        }} title={ic.route || ic.id}>
          <PhosphorIcon name={phName} size={18} />
        </button>
      );
    });
  };

  // Render individual CTA by id
  const renderSingleCta = (ctaId: string) => {
    const allItems: Array<{ id: string; label: string; variant?: string; route?: string; icon?: string }> = [];
    if (config.ctas?.length) allItems.push(...config.ctas);
    else if (config.cta?.enabled) allItems.push({ id: "cta-0", label: config.cta.label || "Action", variant: config.cta.variant, route: config.cta.route, icon: config.cta.icon });
    const cta = allItems.find(c => c.id === ctaId);
    if (!cta) return null;
    const style = CTA_VARIANT_CSS[cta.variant || "default"] || CTA_VARIANT_CSS.default;
    const phIcon = cta.icon?.startsWith("ph:") ? cta.icon.slice(3) : undefined;
    return (
      <button key={cta.id} onClick={() => handleNavigation(cta.route, onCTA)} style={{
        padding: "6px 14px", borderRadius: 6, cursor: "pointer",
        fontSize: 13, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 6,
        ...textStyleCSS,
        ...style,
      }}>
        {phIcon && <PhosphorIcon name={phIcon} size={14} />}
        {cta.label}
      </button>
    );
  };

  const renderCtas = () => {
    const items: Array<{ id: string; label: string; variant?: string; route?: string; icon?: string }> = [];
    if (config.ctas?.length) items.push(...config.ctas);
    else if (config.cta?.enabled) items.push({ id: "cta-0", label: config.cta.label || "Action", variant: config.cta.variant, route: config.cta.route, icon: config.cta.icon });
    if (!items.length) return null;
    return items.map((cta) => {
      const style = CTA_VARIANT_CSS[cta.variant || "default"] || CTA_VARIANT_CSS.default;
      const phIcon = cta.icon?.startsWith("ph:") ? cta.icon.slice(3) : undefined;
      return (
        <button key={cta.id} onClick={() => handleNavigation(cta.route, onCTA)} style={{
          padding: "6px 14px", borderRadius: 6, cursor: "pointer",
          fontSize: 13, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 6,
          ...textStyleCSS,
          ...style,
        }}>
          {phIcon && <PhosphorIcon name={phIcon} size={14} />}
          {cta.label}
        </button>
      );
    });
  };

  // Render in configured order — supports "search", "icons", "ctas" (legacy grouped), "cta:<id>" (individual)
  const order = config.order || ["search", "icons", "ctas"];
  const renderers: Record<string, () => React.ReactNode> = {
    search: renderSearch,
    icons: renderIcons,
    ctas: renderCtas,
  };

  return (
    <>
      {order.map(key => {
        if (key.startsWith("cta:")) {
          return <React.Fragment key={key}>{renderSingleCta(key.slice(4))}</React.Fragment>;
        }
        const fn = renderers[key];
        return fn ? <React.Fragment key={key}>{fn()}</React.Fragment> : null;
      })}
    </>
  );
}
