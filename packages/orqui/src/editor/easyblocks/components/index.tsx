// ============================================================================
// Orqui × Easyblocks — React Component Implementations
//
// All 43 Orqui components, registered as Easyblocks NoCode Components.
//
// CRITICAL PATTERN:
//   Easyblocks passes styled slots as ReactElement (not ComponentType).
//   buildBoxes() creates: React.createElement(Box, boxProps)
//   So each slot (Root, TabBar, etc.) is a ReactElement with .type and .props.
//
//   ✅ Correct:  React.createElement(Root.type, Root.props, children)
//   ❌ Wrong:    <Root>{children}</Root>
//
// Helpers:
//   S(el, ...children)  — render styled slot with children
//   S0(el)              — render styled slot with no children (self-closing)
//   SK(el, key, ...ch)  — render styled slot clone with explicit key
// ============================================================================

import React, { type ReactElement, type ReactNode, type ComponentType } from "react";

// ============================================================================
// Helpers
// ============================================================================

/** Render a styled slot (ReactElement) with children */
function S(el: ReactElement, ...children: ReactNode[]): ReactElement {
  return React.createElement(el.type, el.props, ...children);
}

/** Render a styled slot with no children (self-closing) */
function S0(el: ReactElement): ReactElement {
  return React.createElement(el.type, el.props);
}

/** Clone a styled slot with an explicit key (for lists/maps) */
function SK(el: ReactElement, key: string | number, ...children: ReactNode[]): ReactElement {
  return React.createElement(el.type, { ...el.props, key }, ...children);
}

/** Safe JSON parse with fallback */
function safeJSON<T>(json: string | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

// ============================================================================
// Layout Components (6)
// ============================================================================

/** OrquiStack — vertical flex container */
function OrquiStack({ Root, Children }: { Root: ReactElement; Children: ReactElement[] }) {
  return S(Root, ...Children);
}

/** OrquiRow — horizontal flex container */
function OrquiRow({ Root, Children }: { Root: ReactElement; Children: ReactElement[] }) {
  return S(Root, ...Children);
}

/** OrquiGrid — CSS grid container */
function OrquiGrid({ Root, Children }: { Root: ReactElement; Children: ReactElement[] }) {
  return S(Root, ...Children);
}

/** OrquiContainer — padded/colored wrapper */
function OrquiContainer({ Root, Children }: { Root: ReactElement; Children: ReactElement[] }) {
  return S(Root, ...Children);
}

/** OrquiAccordion — collapsible sections */
function OrquiAccordion({
  Root, itemsJson, variant,
}: {
  Root: ReactElement;
  itemsJson: string;
  allowMultiple: boolean;
  variant: string;
}) {
  const items = safeJSON<{ title: string; content: string }[]>(itemsJson, []);
  const isBordered = variant === "bordered";
  const isSeparated = variant === "separated";

  return S(Root,
    ...items.map((item, i) => (
      <div
        key={i}
        style={{
          borderBottom: isSeparated ? "none" : "1px solid var(--orqui-border, #2a2a33)",
          border: isSeparated ? "1px solid var(--orqui-border, #2a2a33)" : undefined,
          borderRadius: isSeparated ? "8px" : undefined,
          marginBottom: isSeparated ? "8px" : undefined,
          padding: isBordered && i === 0 ? undefined : undefined,
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            fontWeight: 600,
            fontSize: "13px",
            cursor: "pointer",
            color: "var(--orqui-text, #e4e4e7)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {item.title}
          <span style={{ fontSize: "11px", color: "var(--orqui-text-dim, #5b5b66)" }}>▼</span>
        </div>
        <div
          style={{
            padding: "0 16px 12px",
            fontSize: "13px",
            color: "var(--orqui-text-muted, #8b8b96)",
            lineHeight: 1.5,
          }}
        >
          {item.content}
        </div>
      </div>
    ))
  );
}

/** OrquiSidebar — side navigation panel */
function OrquiSidebar({ Root, Children }: { Root: ReactElement; Children: ReactElement[] }) {
  return S(Root, ...Children);
}

// ============================================================================
// Content Components (8)
// ============================================================================

/** OrquiHeading — semantic heading (h1–h6) */
function OrquiHeading({ Root, content }: { Root: ReactElement; content: string }) {
  return S(Root, content);
}

/** OrquiText — paragraph text */
function OrquiText({ Root, content }: { Root: ReactElement; content: string }) {
  return S(Root, content);
}

/** OrquiButton — clickable button */
function OrquiButton({
  Root, label, icon,
}: {
  Root: ReactElement;
  label: string;
  icon: string;
  variant: string;
  route: string;
}) {
  return S(Root,
    icon && <span key="icon" style={{ fontSize: "14px" }}>{icon}</span>,
    label,
  );
}

/** OrquiBadge — status badge */
function OrquiBadge({ Root, content }: { Root: ReactElement; content: string }) {
  return S(Root, content);
}

/** OrquiIcon — Phosphor icon placeholder */
function OrquiIcon({ Root, name }: { Root: ReactElement; name: string }) {
  return S(Root,
    <span style={{ fontSize: "inherit", fontFamily: "monospace" }}>
      {name || "★"}
    </span>
  );
}

/** OrquiImage — image with alt text */
function OrquiImage({
  Root, src, alt,
}: {
  Root: ReactElement;
  src: string;
  alt: string;
  rounded: boolean;
}) {
  if (src) {
    return S(Root,
      <img
        src={src}
        alt={alt}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    );
  }
  // Placeholder
  return S(Root,
    <div
      style={{
        width: "100%", height: "100%",
        background: "var(--orqui-surface-3, #2a2a33)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--orqui-text-dim, #5b5b66)", fontSize: "11px",
      }}
    >
      {alt || "img"}
    </div>
  );
}

/** OrquiDivider — horizontal rule */
function OrquiDivider({ Root }: { Root: ReactElement }) {
  return S0(Root);
}

/** OrquiSpacer — empty vertical space */
function OrquiSpacer({ Root }: { Root: ReactElement }) {
  return S0(Root);
}

// ============================================================================
// Data Components (5)
// ============================================================================

/** OrquiStatCard — metric card with trend */
function OrquiStatCard({
  Root, label, value, icon, trend, trendDirection,
}: {
  Root: ReactElement;
  label: string;
  value: string;
  icon: string;
  trend: string;
  trendDirection: string;
}) {
  const trendColor: Record<string, string> = {
    up: "#4ade80", down: "#f87171", neutral: "#8b8b96",
  };
  const trendArrow: Record<string, string> = {
    up: "↑", down: "↓", neutral: "→",
  };

  return S(Root,
    <div key="header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <span style={{ fontSize: "12px", color: "var(--orqui-text-muted, #8b8b96)", fontWeight: 500 }}>
        {label}
      </span>
      {icon && (
        <span style={{ fontSize: "16px", color: "var(--orqui-text-dim, #5b5b66)" }}>{icon}</span>
      )}
    </div>,
    <div key="value" style={{ fontSize: "24px", fontWeight: 700, color: "var(--orqui-text, #e4e4e7)", marginTop: "8px" }}>
      {value}
    </div>,
    trend && (
      <div key="trend" style={{ fontSize: "12px", color: trendColor[trendDirection] || "#8b8b96", marginTop: "4px" }}>
        {trendArrow[trendDirection] || ""} {trend}
      </div>
    ),
  );
}

/** OrquiCard — content card with title */
function OrquiCard({
  Root, title, Children,
}: {
  Root: ReactElement;
  title: string;
  Children: ReactElement[];
}) {
  return S(Root,
    title && (
      <div key="title" style={{
        fontSize: "14px", fontWeight: 600,
        color: "var(--orqui-text, #e4e4e7)",
        marginBottom: "12px",
      }}>
        {title}
      </div>
    ),
    ...Children,
  );
}

/** OrquiTable — data table */
function OrquiTable({
  Root, columnsJson, striped, compact,
}: {
  Root: ReactElement;
  dataSource: string;
  columnsJson: string;
  striped: boolean;
  compact: boolean;
}) {
  const columns = safeJSON<{ key: string; label: string; width?: string }[]>(columnsJson, []);
  const pad = compact ? "6px 10px" : "10px 14px";

  return S(Root,
    <table key="table" style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ background: "var(--orqui-surface-2, #1c1c21)" }}>
          {columns.map((col) => (
            <th
              key={col.key}
              style={{
                padding: pad,
                textAlign: "left",
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--orqui-text-muted, #8b8b96)",
                borderBottom: "1px solid var(--orqui-border, #2a2a33)",
                width: col.width,
                textTransform: "uppercase" as const,
                letterSpacing: "0.05em",
              }}
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[0, 1, 2].map((row) => (
          <tr
            key={row}
            style={{
              background: striped && row % 2 === 1
                ? "rgba(255,255,255,0.02)"
                : "transparent",
            }}
          >
            {columns.map((col) => (
              <td
                key={col.key}
                style={{
                  padding: pad,
                  fontSize: "13px",
                  color: "var(--orqui-text, #e4e4e7)",
                  borderBottom: "1px solid var(--orqui-border, #2a2a33)",
                }}
              >
                —
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** OrquiList — data list */
function OrquiList({
  Root, maxItems,
}: {
  Root: ReactElement;
  dataSource: string;
  maxItems: string;
}) {
  const count = Math.min(parseInt(maxItems) || 3, 5);
  return S(Root,
    ...Array.from({ length: count }, (_, i) => (
      <div
        key={i}
        style={{
          padding: "10px 14px",
          fontSize: "13px",
          color: "var(--orqui-text, #e4e4e7)",
          background: "var(--orqui-surface-1, #141417)",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <span style={{ color: "var(--orqui-text-dim, #5b5b66)" }}>#{i + 1}</span>
        <span>Item {i + 1}</span>
      </div>
    ))
  );
}

/** OrquiKeyValue — key/value pair list */
function OrquiKeyValue({
  Root, layout, itemsJson,
}: {
  Root: ReactElement;
  layout: string;
  itemsJson: string;
}) {
  const items = safeJSON<{ label: string; value: string }[]>(itemsJson, []);
  const isHorizontal = layout === "horizontal";

  return S(Root,
    ...items.map((item, i) => (
      <div
        key={i}
        style={{
          display: "flex",
          flexDirection: isHorizontal ? "row" : "column" as any,
          gap: isHorizontal ? "16px" : "2px",
          padding: "4px 0",
        }}
      >
        <span style={{
          fontSize: "12px",
          color: "var(--orqui-text-muted, #8b8b96)",
          fontWeight: 500,
          minWidth: isHorizontal ? "120px" : undefined,
        }}>
          {item.label}
        </span>
        <span style={{ fontSize: "13px", color: "var(--orqui-text, #e4e4e7)" }}>
          {item.value}
        </span>
      </div>
    ))
  );
}

// ============================================================================
// Navigation & Misc Components (5 + 4)
// ============================================================================

/** OrquiTabs — tabbed content */
function OrquiTabs({
  Root, TabBar, Tab, TabActive, Content, tabsJson, defaultTab,
}: {
  Root: ReactElement;
  TabBar: ReactElement;
  Tab: ReactElement;
  TabActive: ReactElement;
  Content: ReactElement;
  tabsJson: string;
  defaultTab: string;
}) {
  const tabs = safeJSON<{ id: string; label: string }[]>(tabsJson, []);

  return S(Root,
    S(TabBar,
      ...tabs.map((tab) => {
        const isActive = tab.id === defaultTab;
        const slot = isActive ? TabActive : Tab;
        // Clone with merged styles for active tab
        return React.createElement(
          slot.type,
          {
            ...slot.props,
            key: tab.id,
            style: isActive
              ? { ...Tab.props?.style, ...TabActive.props?.style }
              : Tab.props?.style,
          },
          tab.label,
        );
      })
    ),
    S(Content,
      <span style={{ color: "var(--orqui-text-muted, #8b8b96)", fontSize: "13px" }}>
        Conteúdo da tab "{defaultTab}"
      </span>
    ),
  );
}

/** OrquiSearch — search input field */
function OrquiSearch({
  Root, Icon, Input, placeholder,
}: {
  Root: ReactElement;
  Icon: ReactElement;
  Input: ReactElement;
  placeholder: string;
}) {
  return S(Root,
    S(Icon,
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="7" cy="7" r="4.5" />
        <line x1="10.5" y1="10.5" x2="14" y2="14" />
      </svg>
    ),
    React.createElement(Input.type, {
      ...Input.props,
      children: <span style={{ color: "var(--orqui-text-dim, #5b5b66)" }}>{placeholder}</span>,
    }),
  );
}

/** OrquiSelect — dropdown select */
function OrquiSelect({
  Root, placeholder,
}: {
  Root: ReactElement;
  placeholder: string;
  optionsJson: string;
}) {
  return S(Root,
    <span style={{ opacity: 0.5 }}>{placeholder}</span>,
    <span style={{ marginLeft: "auto", fontSize: "10px", color: "var(--orqui-text-dim, #5b5b66)" }}>▼</span>,
  );
}

/** OrquiSlot — named slot placeholder */
function OrquiSlot({ Root, name }: { Root: ReactElement; name: string }) {
  return S(Root, `⟨ ${name} ⟩`);
}

/** OrquiBreadcrumb — navigation breadcrumb */
function OrquiBreadcrumb({
  Root, itemsJson, separator,
}: {
  Root: ReactElement;
  itemsJson: string;
  separator: string;
}) {
  const items = safeJSON<{ label: string; href?: string }[]>(itemsJson, []);
  const sep = separator || "/";

  return S(Root,
    ...items.flatMap((item, i) => {
      const parts: ReactNode[] = [];
      if (i > 0) {
        parts.push(
          <span key={`sep-${i}`} style={{ margin: "0 2px", opacity: 0.5 }}>{sep}</span>
        );
      }
      const isLast = i === items.length - 1;
      parts.push(
        <span
          key={`item-${i}`}
          style={{
            color: isLast ? "var(--orqui-text, #e4e4e7)" : undefined,
            fontWeight: isLast ? 500 : undefined,
            cursor: item.href ? "pointer" : undefined,
            textDecoration: item.href && !isLast ? "underline" : undefined,
          }}
        >
          {item.label}
        </span>
      );
      return parts;
    })
  );
}

/** OrquiPagination — page navigation */
function OrquiPagination({
  Root, totalPages, currentPage, size,
}: {
  Root: ReactElement;
  totalPages: string;
  currentPage: string;
  size: string;
}) {
  const total = parseInt(totalPages) || 5;
  const current = parseInt(currentPage) || 1;
  const sizeMap: Record<string, { pad: string; font: string }> = {
    sm: { pad: "4px 8px", font: "11px" },
    md: { pad: "6px 10px", font: "13px" },
    lg: { pad: "8px 14px", font: "14px" },
  };
  const s = sizeMap[size] || sizeMap.md;
  const pageCount = Math.min(total, 7);

  return S(Root,
    ...Array.from({ length: pageCount }, (_, i) => {
      const page = i + 1;
      const isActive = page === current;
      return (
        <span
          key={page}
          style={{
            padding: s.pad,
            fontSize: s.font,
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: isActive ? 600 : 400,
            background: isActive ? "var(--orqui-accent, #6d9cff)" : "transparent",
            color: isActive ? "#fff" : "var(--orqui-text-muted, #8b8b96)",
          }}
        >
          {page}
        </span>
      );
    })
  );
}

/** OrquiMenu — navigation menu */
function OrquiMenu({
  Root, itemsJson,
}: {
  Root: ReactElement;
  itemsJson: string;
  direction: string;
}) {
  const items = safeJSON<{ label: string; href?: string; icon?: string }[]>(itemsJson, []);

  return S(Root,
    ...items.map((item, i) => (
      <div
        key={i}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 12px",
          borderRadius: "6px",
          fontSize: "13px",
          color: "var(--orqui-text, #e4e4e7)",
          cursor: "pointer",
        }}
      >
        {item.icon && (
          <span style={{ fontSize: "14px", color: "var(--orqui-text-dim, #5b5b66)" }}>
            {item.icon}
          </span>
        )}
        {item.label}
      </div>
    ))
  );
}

/** OrquiLink — hyperlink */
function OrquiLink({
  Root, label,
}: {
  Root: ReactElement;
  label: string;
  href: string;
  target: string;
  variant: string;
}) {
  return S(Root, label);
}

// ============================================================================
// Form Components (5)
// ============================================================================

const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: "6px",
  border: "1px solid var(--orqui-input-border, #2a2a33)",
  background: "var(--orqui-input-bg, #1c1c21)",
  color: "var(--orqui-text, #e4e4e7)",
  fontSize: "13px",
  width: "100%",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 500,
  color: "var(--orqui-text-muted, #8b8b96)",
};

/** OrquiInput — text input field */
function OrquiInput({
  Root, label, placeholder, disabled,
}: {
  Root: ReactElement;
  label: string;
  placeholder: string;
  inputType: string;
  required: boolean;
  disabled: boolean;
}) {
  return S(Root,
    <span key="label" style={labelStyle}>{label}</span>,
    <div
      key="input"
      style={{
        ...inputStyle,
        opacity: disabled ? 0.5 : 1,
        color: placeholder ? "var(--orqui-text-dim, #5b5b66)" : undefined,
      }}
    >
      {placeholder || "\u00A0"}
    </div>
  );
}

/** OrquiTextarea — multi-line text input */
function OrquiTextarea({
  Root, label, placeholder, rows, disabled,
}: {
  Root: ReactElement;
  label: string;
  placeholder: string;
  rows: string;
  required: boolean;
  disabled: boolean;
}) {
  const rowCount = parseInt(rows) || 4;
  return S(Root,
    <span key="label" style={labelStyle}>{label}</span>,
    <div
      key="textarea"
      style={{
        ...inputStyle,
        minHeight: `${rowCount * 20 + 16}px`,
        opacity: disabled ? 0.5 : 1,
        color: "var(--orqui-text-dim, #5b5b66)",
      }}
    >
      {placeholder || "\u00A0"}
    </div>
  );
}

/** OrquiCheckbox — checkbox with label */
function OrquiCheckbox({
  Root, label, checked, disabled,
}: {
  Root: ReactElement;
  label: string;
  checked: boolean;
  disabled: boolean;
}) {
  return S(Root,
    <div
      key="box"
      style={{
        width: "16px", height: "16px",
        borderRadius: "3px",
        border: `1.5px solid ${checked ? "var(--orqui-accent, #6d9cff)" : "var(--orqui-input-border, #2a2a33)"}`,
        background: checked ? "var(--orqui-accent, #6d9cff)" : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {checked && <span style={{ color: "#fff", fontSize: "11px", lineHeight: 1 }}>✓</span>}
    </div>,
    <span key="label" style={{ fontSize: "13px", color: "var(--orqui-text, #e4e4e7)", opacity: disabled ? 0.5 : 1 }}>
      {label}
    </span>
  );
}

/** OrquiSwitch — toggle switch with label */
function OrquiSwitch({
  Root, label, checked, disabled,
}: {
  Root: ReactElement;
  label: string;
  checked: boolean;
  disabled: boolean;
}) {
  return S(Root,
    <div
      key="track"
      style={{
        width: "36px", height: "20px",
        borderRadius: "10px",
        background: checked ? "var(--orqui-accent, #6d9cff)" : "var(--orqui-surface-3, #2a2a33)",
        position: "relative" as const,
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
        transition: "background 0.15s",
      }}
    >
      <div
        style={{
          width: "16px", height: "16px",
          borderRadius: "50%",
          background: "#fff",
          position: "absolute" as const,
          top: "2px",
          left: checked ? "18px" : "2px",
          transition: "left 0.15s",
        }}
      />
    </div>,
    <span key="label" style={{ fontSize: "13px", color: "var(--orqui-text, #e4e4e7)", opacity: disabled ? 0.5 : 1 }}>
      {label}
    </span>
  );
}

/** OrquiRadio — radio button group */
function OrquiRadio({
  Root, optionsJson, disabled,
}: {
  Root: ReactElement;
  name: string;
  optionsJson: string;
  disabled: boolean;
}) {
  const options = safeJSON<{ value: string; label: string }[]>(optionsJson, []);

  return S(Root,
    ...options.map((opt, i) => (
      <div
        key={opt.value}
        style={{
          display: "flex", alignItems: "center", gap: "8px",
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? "default" : "pointer",
        }}
      >
        <div
          style={{
            width: "16px", height: "16px",
            borderRadius: "50%",
            border: `1.5px solid ${i === 0 ? "var(--orqui-accent, #6d9cff)" : "var(--orqui-input-border, #2a2a33)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {i === 0 && (
            <div style={{
              width: "8px", height: "8px",
              borderRadius: "50%",
              background: "var(--orqui-accent, #6d9cff)",
            }} />
          )}
        </div>
        <span style={{ fontSize: "13px", color: "var(--orqui-text, #e4e4e7)" }}>{opt.label}</span>
      </div>
    ))
  );
}

// ============================================================================
// Feedback Components (4)
// ============================================================================

/** OrquiAlert — alert banner */
function OrquiAlert({
  Root, title, message, dismissible,
}: {
  Root: ReactElement;
  variant: string;
  title: string;
  message: string;
  dismissible: boolean;
}) {
  return S(Root,
    <div key="header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontWeight: 600, fontSize: "13px" }}>{title}</span>
      {dismissible && (
        <span style={{ cursor: "pointer", opacity: 0.6, fontSize: "16px" }}>×</span>
      )}
    </div>,
    <div key="msg" style={{ fontSize: "13px", marginTop: "4px", opacity: 0.85, lineHeight: 1.5 }}>
      {message}
    </div>
  );
}

/** OrquiProgress — progress bar */
function OrquiProgress({
  Root, value, variant, size, showLabel,
}: {
  Root: ReactElement;
  value: string;
  variant: string;
  size: string;
  showLabel: boolean;
}) {
  const pct = parseInt(value) || 0;
  const colorMap: Record<string, string> = {
    default: "var(--orqui-accent, #6d9cff)",
    success: "#4ade80",
    warning: "#facc15",
    error: "#f87171",
  };
  const heightMap: Record<string, string> = { sm: "4px", md: "8px", lg: "12px" };
  const barColor = colorMap[variant] || colorMap.default;
  const barHeight = heightMap[size] || "8px";

  return S(Root,
    showLabel && (
      <div key="label" style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--orqui-text-muted, #8b8b96)" }}>
        <span>Progresso</span>
        <span>{pct}%</span>
      </div>
    ),
    <div
      key="track"
      style={{
        width: "100%",
        height: barHeight,
        background: "var(--orqui-surface-3, #2a2a33)",
        borderRadius: "9999px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: barColor,
          borderRadius: "9999px",
          transition: "width 0.3s",
        }}
      />
    </div>
  );
}

/** OrquiSpinner — loading spinner */
function OrquiSpinner({
  Root, size, color,
}: {
  Root: ReactElement;
  size: string;
  color: string;
}) {
  const sizeMap: Record<string, number> = { sm: 16, md: 24, lg: 40, xl: 56 };
  const sz = sizeMap[size] || 24;
  const c = color || "var(--orqui-accent, #6d9cff)";

  return S(Root,
    <div
      key="spinner"
      style={{
        width: `${sz}px`,
        height: `${sz}px`,
        border: `${Math.max(2, sz / 10)}px solid var(--orqui-surface-3, #2a2a33)`,
        borderTopColor: c,
        borderRadius: "50%",
        animation: "orqui-spin 0.8s linear infinite",
      }}
    />,
    <style key="css">{`@keyframes orqui-spin { to { transform: rotate(360deg); } }`}</style>
  );
}

/** OrquiSkeleton — loading placeholder */
function OrquiSkeleton({
  Root, variant, width, height,
}: {
  Root: ReactElement;
  variant: string;
  width: string;
  height: string;
}) {
  const isCircular = variant === "circular";
  const w = width || "100%";
  const h = height || "16px";

  return S(Root,
    <div
      key="skel"
      style={{
        width: isCircular ? h : w,
        height: h,
        borderRadius: isCircular ? "50%" : variant === "text" ? "4px" : "8px",
        background: "linear-gradient(90deg, var(--orqui-surface-3, #2a2a33) 25%, var(--orqui-surface-2, #1c1c21) 50%, var(--orqui-surface-3, #2a2a33) 75%)",
        backgroundSize: "200% 100%",
        animation: "orqui-shimmer 1.5s infinite",
      }}
    />,
    <style key="css">{`@keyframes orqui-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
  );
}

// ============================================================================
// Overlay Components (3)
// ============================================================================

/** OrquiModal — dialog modal */
function OrquiModal({
  Root, title, showClose, Children,
}: {
  Root: ReactElement;
  title: string;
  size: string;
  showClose: boolean;
  Children: ReactElement[];
}) {
  return S(Root,
    <div key="header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
      <span style={{ fontSize: "16px", fontWeight: 600, color: "var(--orqui-text, #e4e4e7)" }}>{title}</span>
      {showClose && (
        <span style={{ fontSize: "18px", cursor: "pointer", color: "var(--orqui-text-dim, #5b5b66)" }}>✕</span>
      )}
    </div>,
    ...Children,
  );
}

/** OrquiDrawer — side panel */
function OrquiDrawer({
  Root, title, Children,
}: {
  Root: ReactElement;
  title: string;
  position: string;
  width: string;
  Children: ReactElement[];
}) {
  return S(Root,
    <div key="header" style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      paddingBottom: "12px",
      borderBottom: "1px solid var(--orqui-border, #2a2a33)",
    }}>
      <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--orqui-text, #e4e4e7)" }}>{title}</span>
      <span style={{ fontSize: "18px", cursor: "pointer", color: "var(--orqui-text-dim, #5b5b66)" }}>✕</span>
    </div>,
    ...Children,
  );
}

/** OrquiTooltip — hover tooltip */
function OrquiTooltip({
  Root, content, Children,
}: {
  Root: ReactElement;
  content: string;
  position: string;
  Children: ReactElement[];
}) {
  return S(Root,
    ...Children,
    <div
      key="tooltip"
      style={{
        position: "absolute" as const,
        bottom: "calc(100% + 6px)",
        left: "50%",
        transform: "translateX(-50%)",
        background: "var(--orqui-surface-3, #2a2a33)",
        color: "var(--orqui-text, #e4e4e7)",
        padding: "4px 10px",
        borderRadius: "4px",
        fontSize: "12px",
        whiteSpace: "nowrap" as const,
        pointerEvents: "none" as const,
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
      }}
    >
      {content}
    </div>
  );
}

// ============================================================================
// Media Components (3)
// ============================================================================

/** OrquiAvatar — user avatar */
function OrquiAvatar({
  Root, src, alt, fallback,
}: {
  Root: ReactElement;
  src: string;
  alt: string;
  fallback: string;
  size: string;
  shape: string;
}) {
  if (src) {
    return S(Root,
      <img
        src={src}
        alt={alt}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    );
  }
  return S(Root, fallback || "?");
}

/** OrquiVideo — video player */
function OrquiVideo({
  Root, src, poster,
}: {
  Root: ReactElement;
  src: string;
  poster: string;
  autoplay: boolean;
  controls: boolean;
  loop: boolean;
  muted: boolean;
  aspectRatio: string;
}) {
  if (src) {
    return S(Root,
      <video
        src={src}
        poster={poster}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    );
  }
  return S(Root,
    <div
      style={{
        width: "100%", height: "100%",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--orqui-text-dim, #5b5b66)", fontSize: "14px",
      }}
    >
      ▶ Vídeo
    </div>
  );
}

/** OrquiCarousel — image/content carousel */
function OrquiCarousel({
  Root, showDots, showArrows, Children,
}: {
  Root: ReactElement;
  autoplay: boolean;
  interval: string;
  showDots: boolean;
  showArrows: boolean;
  Children: ReactElement[];
}) {
  return S(Root,
    <div
      key="track"
      style={{
        display: "flex",
        width: "100%",
        overflow: "hidden",
      }}
    >
      {Children.length > 0 ? Children[0] : (
        <div style={{
          width: "100%", height: "120px",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--orqui-text-dim, #5b5b66)", fontSize: "13px",
        }}>
          Adicionar slides
        </div>
      )}
    </div>,
    showArrows && (
      <div key="arrows" style={{ display: "flex", justifyContent: "space-between", position: "absolute" as const, top: "50%", left: 0, right: 0, transform: "translateY(-50%)", padding: "0 8px", pointerEvents: "none" as const }}>
        <span style={{ background: "rgba(0,0,0,0.5)", color: "#fff", borderRadius: "50%", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", pointerEvents: "auto" as const, cursor: "pointer" }}>‹</span>
        <span style={{ background: "rgba(0,0,0,0.5)", color: "#fff", borderRadius: "50%", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", pointerEvents: "auto" as const, cursor: "pointer" }}>›</span>
      </div>
    ),
    showDots && Children.length > 1 && (
      <div key="dots" style={{ display: "flex", gap: "6px", justifyContent: "center", padding: "8px 0" }}>
        {Children.map((_, i) => (
          <div
            key={i}
            style={{
              width: "6px", height: "6px", borderRadius: "50%",
              background: i === 0 ? "var(--orqui-accent, #6d9cff)" : "var(--orqui-text-dim, #5b5b66)",
            }}
          />
        ))}
      </div>
    ),
  );
}

// ============================================================================
// ORQUI_COMPONENTS — Component registry for EasyblocksEditor
//
// Maps component definition ID → React component implementation.
// Passed to <EasyblocksEditor components={ORQUI_COMPONENTS} />.
// ============================================================================

export const ORQUI_COMPONENTS: Record<string, ComponentType<any>> = {
  // Layout (6)
  OrquiStack,
  OrquiRow,
  OrquiGrid,
  OrquiContainer,
  OrquiAccordion,
  OrquiSidebar,
  // Content (8)
  OrquiHeading,
  OrquiText,
  OrquiButton,
  OrquiBadge,
  OrquiIcon,
  OrquiImage,
  OrquiDivider,
  OrquiSpacer,
  // Data (5)
  OrquiStatCard,
  OrquiCard,
  OrquiTable,
  OrquiList,
  OrquiKeyValue,
  // Navigation (5)
  OrquiTabs,
  OrquiBreadcrumb,
  OrquiPagination,
  OrquiMenu,
  OrquiLink,
  // Input / Forms (7)
  OrquiSearch,
  OrquiSelect,
  OrquiInput,
  OrquiTextarea,
  OrquiCheckbox,
  OrquiSwitch,
  OrquiRadio,
  // Special (1)
  OrquiSlot,
  // Feedback (4)
  OrquiAlert,
  OrquiProgress,
  OrquiSpinner,
  OrquiSkeleton,
  // Overlay (3)
  OrquiModal,
  OrquiDrawer,
  OrquiTooltip,
  // Media (3)
  OrquiAvatar,
  OrquiVideo,
  OrquiCarousel,
};
