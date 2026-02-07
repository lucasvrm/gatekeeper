// ============================================================================
// Orqui Runtime — Sidebar Navigation Renderer
// ============================================================================
import React, { useState, useEffect, useRef, useMemo } from "react";
import type { NavigationConfig, NavItem, NavGroup } from "../types.js";
import { IconValue } from "../icons.js";
import { TooltipPortal } from "./TooltipPortal.js";
import { NavItem as NavItemComponent } from "./NavItem.js";
import { useContract } from "../context.js";
import { resolveTokenRef } from "../tokens.js";

export function SidebarNavRenderer({ navConfig, page, navigate, collapsed, collapsedDisplay }: {
  navConfig: NavigationConfig;
  page?: string;
  navigate?: (route: string) => void;
  collapsed?: boolean;
  collapsedDisplay?: string;
}) {
  const items = navConfig.items || [];
  const groups = navConfig.groups || [];
  const [openSubs, setOpenSubs] = useState<Record<string, boolean>>({});
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const { tokens } = useContract();

  // Extract card configuration from navigation.typography
  const cardConfig = useMemo(() => {
    const typo = navConfig.typography || {};
    return {
      enabled: typo.cardEnabled !== false, // default true
      padding: typo.cardPadding,
      borderRadius: typo.cardBorderRadius,
      background: typo.cardBackground,
      borderColor: typo.cardBorderColor,
      borderWidth: typo.cardBorderWidth,
      activeBackground: typo.activeBackground,
      activeCardBorder: typo.activeCardBorder,
      hoverBackground: typo.hoverBackground,
      hoverCardBorder: typo.hoverCardBorder,
    };
  }, [navConfig.typography]);

  // Recalcula icon size quando navConfig.icons ou tokens mudam
  // Inclui objeto completo para detectar mudanças de referência
  const baseIconSize = useMemo(() => {
    // Try to resolve configured size from token
    const configuredSize = navConfig.icons?.size
      ? resolveTokenRef(navConfig.icons.size, tokens)
      : null;

    // Convert to number (handle "18px" → 18 or 18 → 18)
    let size = 18; // default fallback
    if (configuredSize !== null) {
      const numericSize = typeof configuredSize === 'number'
        ? configuredSize
        : parseInt(String(configuredSize), 10);
      if (!isNaN(numericSize) && numericSize > 0) {
        size = numericSize;
      }
    }

    return size;
  }, [navConfig.icons, tokens]);

  // DEBUG: Log icon rendering state in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && collapsed) {
      const iconItems = items.filter(item => item.icon);
      console.log('[SidebarNav] Collapsed mode:', {
        collapsedDisplay,
        iconCount: iconItems.length,
        icons: iconItems.map(i => ({ id: i.id, icon: i.icon })),
        baseIconSize,
      });
    }
  }, [collapsed, collapsedDisplay, items, baseIconSize]);

  // Resolve icon size with depth reduction
  const getIconSize = (depth: number = 0): number => {
    // Apply depth reduction: nested items get smaller icons (-2px per level)
    const depthReduction = depth > 0 ? Math.min(depth * 2, baseIconSize - 8) : 0;
    return Math.max(baseIconSize - depthReduction, 8); // minimum 8px for legibility
  };

  // Track current pathname for active state
  const [pathname, setPathname] = useState(() =>
    typeof window !== "undefined" ? window.location.pathname : "/"
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", sync);
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

  const isActive = (route?: string) => {
    if (!route) return false;
    if (page && route === `/${page}`) return true;
    return pathname === route || pathname.startsWith(route + "/");
  };

  const handleClick = (e: React.MouseEvent, route?: string) => {
    if (!route) return;
    e.preventDefault();
    if (navigate) navigate(route);
    else window.location.href = route;
  };

  const renderBadge = (badge?: NavItem["badge"]) => {
    if (!badge) return null;
    if (badge.dot) {
      return <span style={{ width: 6, height: 6, borderRadius: "50%", background: badge.color || "var(--destructive, #ef4444)", flexShrink: 0 }} />;
    }
    const text = badge.text || (badge.count != null ? String(badge.count) : null);
    if (!text) return null;
    return (
      <span style={{
        fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 10,
        background: badge.color || "var(--destructive, #ef4444)",
        color: "#fff", lineHeight: "16px", flexShrink: 0, minWidth: 18, textAlign: "center",
      }}>{text}</span>
    );
  };

  // Group items
  const groupMap = new Map<string, NavItem[]>();
  const ungrouped: NavItem[] = [];
  for (const item of items) {
    if (item.group) {
      if (!groupMap.has(item.group)) groupMap.set(item.group, []);
      groupMap.get(item.group)!.push(item);
    } else {
      ungrouped.push(item);
    }
  }

  // Build ordered list: ungrouped first, then each group
  const sections: Array<{ group?: NavGroup; items: NavItem[] }> = [];
  if (ungrouped.length) sections.push({ items: ungrouped });
  for (const g of groups) {
    const gItems = groupMap.get(g.id) || [];
    if (gItems.length) sections.push({ group: g, items: gItems });
  }
  // Any groups referenced by items but not in groups[] config
  for (const [gId, gItems] of groupMap) {
    if (!groups.find(g => g.id === gId)) {
      sections.push({ group: { id: gId, label: gId.charAt(0).toUpperCase() + gId.slice(1) }, items: gItems });
    }
  }

  // Shared props for NavItem components
  const sharedNavItemProps = {
    collapsed,
    collapsedDisplay,
    isActive,
    handleClick,
    renderBadge,
    getIconSize,
    baseIconSize,
    openSubs,
    setOpenSubs,
    cardConfig,
    tokens,
  };

  return (
    <>
      {sections.map((sec, si) => {
        const gCollapsed = sec.group?.collapsible && collapsedGroups[sec.group.id];
        return (
          <div key={sec.group?.id || `_ungrouped_${si}`}>
            {sec.group && !collapsed && (
              <div
                onClick={() => sec.group!.collapsible && setCollapsedGroups(prev => ({ ...prev, [sec.group!.id]: !gCollapsed }))}
                style={{
                  fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                  color: "var(--sidebar-foreground)", opacity: 0.4,
                  padding: "12px 12px 4px",
                  cursor: sec.group.collapsible ? "pointer" : "default",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  userSelect: "none",
                }}
              >
                <span>{sec.group.label}</span>
                {sec.group.collapsible && (
                  <span style={{ fontSize: 8, transition: "transform 0.2s", transform: gCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>▼</span>
                )}
              </div>
            )}
            {!gCollapsed && sec.items.map(item => (
              <NavItemComponent
                key={item.id}
                item={item}
                depth={0}
                {...sharedNavItemProps}
              />
            ))}
          </div>
        );
      })}
    </>
  );
}
