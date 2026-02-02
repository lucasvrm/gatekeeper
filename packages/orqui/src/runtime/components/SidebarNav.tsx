// ============================================================================
// Orqui Runtime — Sidebar Navigation Renderer
// ============================================================================
import React, { useState, useEffect } from "react";
import type { NavigationConfig, NavItem, NavGroup } from "../types.js";
import { IconValue } from "../icons.js";

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

  const renderItem = (item: NavItem, depth = 0) => {
    const active = isActive(item.route);
    const hasChildren = item.children && item.children.length > 0;
    const isSubOpen = openSubs[item.id] ?? active; // Auto-open if child is active

    // Collapsed: show icon (icon-only) or first letter (letter-only)
    const renderCollapsedContent = () => {
      if (collapsedDisplay === "letter-only" || !item.icon) {
        const letter = (item.label || "?").charAt(0).toUpperCase();
        return (
          <span style={{
            width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: active ? 700 : 500,
            color: active ? "var(--accent, #e89c28)" : "var(--sidebar-foreground, var(--foreground))",
            background: active ? "var(--surface-2, rgba(232,156,40,0.08))" : "transparent",
            borderRadius: 6,
          }}>{letter}</span>
        );
      }
      return <IconValue icon={item.icon} size={18} color="currentColor" />;
    };

    return (
      <div key={item.id} style={{ position: "relative" }}>
        <a
          href={item.route || "#"}
          onClick={(e) => {
            if (hasChildren && !item.route) {
              e.preventDefault();
              setOpenSubs(prev => ({ ...prev, [item.id]: !isSubOpen }));
            } else {
              handleClick(e, item.route);
            }
          }}
          data-active={active ? "true" : undefined}
          className="orqui-nav-item"
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: collapsed
              ? "8px 0"
              : (depth > 0 ? "6px 12px 6px 28px" : "8px 6px"),
            borderRadius: 6,
            textDecoration: "none",
            color: "var(--sidebar-foreground, var(--foreground))",
            fontSize: depth > 0 ? 13 : 14,
            opacity: item.disabled ? 0.4 : 1,
            pointerEvents: item.disabled ? "none" as const : undefined,
            cursor: item.disabled ? "default" : "pointer",
            justifyContent: collapsed ? "center" : "flex-start",
          }}
        >
          {collapsed ? renderCollapsedContent() : (
            <>
              {item.icon && <IconValue icon={item.icon} size={depth > 0 ? 16 : 18} color="currentColor" />}
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
              {renderBadge(item.badge)}
              {hasChildren && (
                <span style={{ fontSize: 10, color: "var(--sidebar-foreground)", opacity: 0.4, transition: "transform 0.2s", transform: isSubOpen ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
              )}
            </>
          )}
        </a>
        {/* Collapsed tooltip — always mandatory */}
        {collapsed && (
          <span className="orqui-nav-tooltip" style={{
            position: "absolute",
            left: "calc(100% + 12px)",
            top: "50%",
            transform: "translateY(-50%)",
            background: "var(--surface-3, #1e1e28)",
            color: "var(--foreground, #e8e8ec)",
            border: "1px solid var(--border, #2a2a33)",
            borderRadius: 4,
            padding: "5px 10px",
            fontSize: 12,
            fontWeight: 500,
            fontFamily: "var(--font-mono, monospace)",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            opacity: 0,
            transition: "opacity 0.15s ease",
            zIndex: 1000,
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          }}>{item.label}</span>
        )}
        {/* Children (sub-items) */}
        {hasChildren && isSubOpen && !collapsed && (
          <div style={{ overflow: "hidden" }}>
            {item.children!.map(child => renderItem(child, depth + 1))}
          </div>
        )}
      </div>
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
            {!gCollapsed && sec.items.map(item => renderItem(item))}
          </div>
        );
      })}
    </>
  );
}
