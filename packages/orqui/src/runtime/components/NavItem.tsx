// ============================================================================
// Orqui Runtime — NavItem Component
// ============================================================================
import React, { useState, useRef } from "react";
import type { NavItem as NavItemType } from "../types.js";
import { IconValue } from "../icons.js";
import { TooltipPortal } from "./TooltipPortal.js";
import { resolveTokenRef } from "../tokens.js";

interface CardConfig {
  enabled?: boolean;
  padding?: string;
  borderRadius?: string;
  background?: string;
  borderColor?: string;
  borderWidth?: string;
  activeBackground?: string;
  activeCardBorder?: string;
  hoverBackground?: string;
  hoverCardBorder?: string;
}

interface NavItemProps {
  item: NavItemType;
  depth?: number;
  collapsed?: boolean;
  collapsedDisplay?: string;
  isActive: (route?: string) => boolean;
  handleClick: (e: React.MouseEvent, route?: string) => void;
  renderBadge: (badge?: NavItemType["badge"]) => React.ReactNode;
  getIconSize: (depth: number) => number;
  baseIconSize: number;
  openSubs: Record<string, boolean>;
  setOpenSubs: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  cardConfig?: CardConfig;
  tokens?: any;
}

export function NavItem({
  item,
  depth = 0,
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
}: NavItemProps) {
  // ✅ CORRETO: Hooks no top-level do componente React
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ left: 0, top: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const linkRef = useRef<HTMLAnchorElement>(null);

  const active = isActive(item.route);
  const hasChildren = item.children && item.children.length > 0;
  const isSubOpen = openSubs[item.id] ?? active;

  // Force overflow visible and proper sizing when collapsed (override any global CSS)
  React.useEffect(() => {
    if (collapsed && linkRef.current) {
      const link = linkRef.current;
      link.style.setProperty('overflow', 'visible', 'important');
      link.style.setProperty('min-width', '32px', 'important');
      link.style.setProperty('min-height', '32px', 'important');
      link.style.setProperty('width', 'auto', 'important');
      link.style.setProperty('height', 'auto', 'important');
      link.style.setProperty('max-width', 'none', 'important');
      link.style.setProperty('max-height', 'none', 'important');
      link.style.setProperty('flex-shrink', '0', 'important');

      // Force padding to override global CSS
      const resolvedPadding = cardConfig?.padding
        ? resolveTokenRef(cardConfig.padding, tokens)
        : null;
      const finalPadding = resolvedPadding || '8px 4px';
      link.style.setProperty('padding', String(finalPadding), 'important');
    }
  }, [collapsed, cardConfig, tokens]);

  // DEBUG: Log card config application in development
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development' && collapsed && cardConfig) {
      console.log('[NavItem] Card config applied:', {
        itemId: item.id,
        collapsed,
        active,
        cardConfig: {
          enabled: cardConfig.enabled,
          padding: resolveTokenRef(cardConfig.padding, tokens),
          borderRadius: resolveTokenRef(cardConfig.borderRadius, tokens),
          activeBackground: resolveTokenRef(cardConfig.activeBackground, tokens),
          hoverBackground: resolveTokenRef(cardConfig.hoverBackground, tokens),
          borderColor: resolveTokenRef(cardConfig.borderColor, tokens),
          borderWidth: resolveTokenRef(cardConfig.borderWidth, tokens),
          activeCardBorder: resolveTokenRef(cardConfig.activeCardBorder, tokens),
        },
      });
    }
  }, [collapsed, cardConfig, active, item.id, tokens]);

  // Calculate tooltip position when showing
  const handleMouseEnter = () => {
    setIsHovered(true);

    if (!collapsed || !linkRef.current) return;
    const rect = linkRef.current.getBoundingClientRect();

    // Read offset from CSS variable (set by layout contract)
    const offsetStr = getComputedStyle(document.documentElement)
      .getPropertyValue('--orqui-tooltip-offset')
      .trim() || '12px';
    const offset = parseFloat(offsetStr) || 12;

    setTooltipPos({
      left: rect.right + offset,
      top: rect.top + rect.height / 2,
    });
    setShowTooltip(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setShowTooltip(false);
  };

  // Collapsed: show icon (icon-only) or first letter (letter-only)
  const renderCollapsedContent = () => {
    // Always check if there's an icon first, unless explicitly set to letter-only
    if (collapsedDisplay === "letter-only") {
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

    // If no icon is available, fallback to letter
    if (!item.icon) {
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

    // Render icon
    const iconSize = getIconSize(depth);
    return <IconValue
      key={`icon-${item.id}`}
      icon={item.icon}
      size={iconSize}
      color="currentColor"
      enhanced={false}
      showDebug={process.env.NODE_ENV === 'development'}
    />;
  };

  const renderExpandedContent = () => {
    return (
      <>
        {item.icon && <IconValue
          key={`icon-${item.id}`}
          icon={item.icon}
          size={getIconSize(depth)}
          color="currentColor"
          enhanced={false}
          showDebug={process.env.NODE_ENV === 'development'}
        />}
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
        {renderBadge(item.badge)}
        {hasChildren && (
          <span style={{ fontSize: 10, color: "var(--sidebar-foreground)", opacity: 0.4, transition: "transform 0.2s", transform: isSubOpen ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
        )}
      </>
    );
  };

  // Resolve card config values (collapsed mode)
  const collapsedPadding = collapsed && cardConfig
    ? resolveTokenRef(cardConfig.padding, tokens)
    : undefined;
  const collapsedBorderRadius = cardConfig
    ? resolveTokenRef(cardConfig.borderRadius, tokens)
    : undefined;
  const collapsedActiveBackground = collapsed && active && cardConfig
    ? resolveTokenRef(cardConfig.activeBackground, tokens)
    : undefined;
  const shouldShowHoverBg = collapsed && isHovered && !active && cardConfig;
  const collapsedHoverBackground = shouldShowHoverBg
    ? resolveTokenRef(cardConfig.hoverBackground, tokens)
    : undefined;
  const collapsedBorderColor = collapsed && cardConfig
    ? resolveTokenRef(cardConfig.borderColor, tokens)
    : undefined;
  const collapsedBorderWidth = collapsed && cardConfig
    ? resolveTokenRef(cardConfig.borderWidth, tokens)
    : undefined;
  const collapsedActiveBorder = collapsed && active && cardConfig
    ? resolveTokenRef(cardConfig.activeCardBorder, tokens)
    : undefined;

  // Style object for the link - force explicit values when collapsed
  const linkStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    // Use cardConfig padding when collapsed, fallback to hardcoded
    padding: collapsed
      ? (collapsedPadding || "8px 4px")
      : (depth > 0 ? "6px 12px 6px 28px" : "8px 6px"),
    // Use cardConfig borderRadius, fallback to hardcoded
    borderRadius: collapsedBorderRadius || 6,
    textDecoration: "none",
    color: "var(--sidebar-foreground, var(--foreground))",
    fontSize: depth > 0 ? 13 : 14,
    opacity: item.disabled ? 0.4 : 1,
    pointerEvents: item.disabled ? "none" : undefined,
    cursor: item.disabled ? "default" : "pointer",
    justifyContent: collapsed ? "center" : "flex-start",
    minWidth: 0,
    // Apply background when collapsed
    background: collapsed
      ? (collapsedActiveBackground || collapsedHoverBackground || "transparent")
      : undefined,
    // Apply border when collapsed and cardConfig enabled
    border: collapsed && cardConfig?.enabled && collapsedBorderColor
      ? `${collapsedBorderWidth || "1px"} solid ${collapsedBorderColor}`
      : undefined,
    // Apply active border when collapsed
    borderColor: collapsed && active && collapsedActiveBorder
      ? collapsedActiveBorder
      : undefined,
  };

  // Force overflow visible and remove size constraints when collapsed
  if (collapsed) {
    linkStyle.overflow = "visible";
    linkStyle.width = "auto";
    linkStyle.height = "auto";
    linkStyle.maxWidth = "none";
    linkStyle.maxHeight = "none";
  } else {
    linkStyle.overflow = "visible";
  }

  return (
    <div key={item.id} style={{ position: "relative" }}>
      <a
        ref={linkRef}
        href={item.route || "#"}
        onClick={(e) => {
          if (hasChildren && !item.route) {
            e.preventDefault();
            setOpenSubs(prev => ({ ...prev, [item.id]: !isSubOpen }));
          } else {
            handleClick(e, item.route);
          }
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        data-active={active ? "true" : undefined}
        data-collapsed={collapsed ? "true" : undefined}
        className="orqui-nav-item"
        style={linkStyle}
      >
        {collapsed ? renderCollapsedContent() : renderExpandedContent()}
      </a>

      {/* Collapsed tooltip — rendered in Portal to escape overflow constraints */}
      {collapsed && showTooltip && (
        <TooltipPortal>
          <span
            className="orqui-nav-tooltip"
            style={{
              position: "fixed",
              left: `${tooltipPos.left}px`,
              top: `${tooltipPos.top}px`,
              transform: "translateY(-50%)",
              background: "var(--orqui-tooltip-bg, var(--surface-3, #1e1e28))",
              color: "var(--orqui-tooltip-color, var(--foreground, #e8e8ec))",
              border: `1px solid var(--orqui-tooltip-border, var(--border, #2a2a33))`,
              borderRadius: "var(--orqui-tooltip-radius, 4px)",
              padding: "var(--orqui-tooltip-padding, 5px 10px)",
              fontSize: "var(--orqui-tooltip-font-size, 12px)",
              fontWeight: "var(--orqui-tooltip-font-weight, 500)",
              fontFamily: "var(--orqui-tooltip-font-family, var(--font-mono, monospace))",
              whiteSpace: "nowrap",
              pointerEvents: "none",
              zIndex: 9999,
              boxShadow: "var(--orqui-tooltip-shadow, 0 4px 12px rgba(0,0,0,0.4))",
            }}
          >
            {item.label}
          </span>
        </TooltipPortal>
      )}

      {/* Children (sub-items) - recursão */}
      {hasChildren && isSubOpen && !collapsed && (
        <div style={{ overflow: "hidden" }}>
          {item.children!.map(child => (
            <NavItem
              key={child.id}
              item={child}
              depth={depth + 1}
              collapsed={collapsed}
              collapsedDisplay={collapsedDisplay}
              isActive={isActive}
              handleClick={handleClick}
              renderBadge={renderBadge}
              getIconSize={getIconSize}
              baseIconSize={baseIconSize}
              openSubs={openSubs}
              setOpenSubs={setOpenSubs}
              cardConfig={cardConfig}
              tokens={tokens}
            />
          ))}
        </div>
      )}
    </div>
  );
}
