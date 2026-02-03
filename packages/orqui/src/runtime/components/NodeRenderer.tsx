// ============================================================================
// Orqui NodeRenderer
// Recursively renders a node tree from the contract
// ============================================================================

import React, { type ReactNode, type CSSProperties } from "react";
import { useOrqui } from "../context/ContractProvider.js";
import type { NodeDef } from "../context/ContractProvider.js";
import type { DataContext } from "../../engine/resolver.js";
import { resolveTokenToCSS, resolveStyleOverrides, textStyleToCSS } from "../hooks/useTokens.js";
import { isRichValue } from "../../engine/formatters.js";

// ============================================================================
// Props
// ============================================================================

export interface NodeRendererProps {
  /** The node definition from the contract */
  node: NodeDef;
  /** Data context for resolving {{}} templates */
  data?: DataContext;
  /** Named slots — maps slot names to React elements */
  slots?: Record<string, ReactNode>;
  /** Action handler for tables/lists */
  onAction?: (action: string, item: unknown) => void;
  /** Navigation handler */
  onNavigate?: (route: string) => void;
}

// ============================================================================
// Main Component
// ============================================================================

export function NodeRenderer({ node, data = {}, slots = {}, onAction, onNavigate }: NodeRendererProps) {
  const ctx = useOrqui();

  // Visibility check
  if (!ctx.isVisible(node.visibility, data)) {
    return null;
  }

  // Style overrides
  const styleOverrides = resolveStyleOverrides(node.style);

  // Render based on type
  const props = node.props || {};

  switch (node.type) {
    // ---- Layout Nodes ----
    case "grid":
      return <GridNode node={node} style={styleOverrides} data={data} slots={slots} onAction={onAction} onNavigate={onNavigate} />;
    case "stack":
      return <StackNode node={node} style={styleOverrides} data={data} slots={slots} onAction={onAction} onNavigate={onNavigate} />;
    case "row":
      return <RowNode node={node} style={styleOverrides} data={data} slots={slots} onAction={onAction} onNavigate={onNavigate} />;
    case "container":
      return <ContainerNode node={node} style={styleOverrides} data={data} slots={slots} onAction={onAction} onNavigate={onNavigate} />;

    // ---- Content Nodes ----
    case "text":
      return <TextNode node={node} style={styleOverrides} data={data} />;
    case "heading":
      return <HeadingNode node={node} style={styleOverrides} data={data} />;
    case "badge":
      return <BadgeNode node={node} style={styleOverrides} data={data} />;
    case "icon":
      return <IconNode node={node} style={styleOverrides} />;
    case "button":
      return <ButtonNode node={node} style={styleOverrides} data={data} onNavigate={onNavigate} />;
    case "image":
      return <ImageNode node={node} style={styleOverrides} data={data} />;
    case "divider":
      return <DividerNode node={node} style={styleOverrides} />;
    case "spacer":
      return <SpacerNode node={node} style={styleOverrides} />;

    // ---- Data Nodes ----
    case "stat-card":
      return <StatCardNode node={node} style={styleOverrides} data={data} />;
    case "card":
      return <CardNode node={node} style={styleOverrides} data={data} slots={slots} onAction={onAction} onNavigate={onNavigate} />;
    case "key-value":
      return <KeyValueNode node={node} style={styleOverrides} data={data} />;
    case "table":
      return <TableNode node={node} style={styleOverrides} data={data} onAction={onAction} onNavigate={onNavigate} />;
    case "list":
      return <ListNode node={node} style={styleOverrides} data={data} slots={slots} onAction={onAction} onNavigate={onNavigate} />;

    // ---- Navigation Nodes ----
    case "tabs":
      return <TabsNode node={node} style={styleOverrides} data={data} slots={slots} onAction={onAction} onNavigate={onNavigate} />;

    // ---- Input Nodes ----
    case "search":
      return <SearchNode node={node} style={styleOverrides} />;
    case "select":
      return <SelectNode node={node} style={styleOverrides} data={data} />;

    // ---- Special Nodes ----
    case "slot":
      return <SlotNode node={node} slots={slots} />;
    case "component":
      return <ComponentRefNode node={node} data={data} />;

    default:
      return <div data-orqui-node={node.id} data-orqui-unknown={node.type} style={styleOverrides}>{renderChildren(node, data, slots, onAction, onNavigate)}</div>;
  }
}

// ============================================================================
// Children helper
// ============================================================================

function renderChildren(
  node: NodeDef,
  data: DataContext,
  slots: Record<string, ReactNode>,
  onAction?: (action: string, item: unknown) => void,
  onNavigate?: (route: string) => void,
): ReactNode[] {
  if (!node.children) return [];
  return node.children.map((child) => (
    <NodeRenderer key={child.id} node={child} data={data} slots={slots} onAction={onAction} onNavigate={onNavigate} />
  ));
}

// ============================================================================
// Layout Nodes
// ============================================================================

function GridNode({ node, style, data, slots, onAction, onNavigate }: { node: NodeDef; style: CSSProperties; data: DataContext; slots: Record<string, ReactNode>; onAction?: any; onNavigate?: any }) {
  const ctx = useOrqui();
  const p = node.props || {};
  const gridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${p.columns || 1}, 1fr)`,
    gap: p.gap ? resolveTokenToCSS(p.gap) : undefined,
    columnGap: p.columnGap ? resolveTokenToCSS(p.columnGap) : undefined,
    rowGap: p.rowGap ? resolveTokenToCSS(p.rowGap) : undefined,
    ...style,
  };

  return (
    <div data-orqui-node={node.id} data-orqui-type="grid" style={gridStyle}>
      {(node.children || []).map((child) => {
        const span = child.props?.span;
        const childWrapper = span ? { gridColumn: `span ${span}` } : {};
        return (
          <div key={child.id} style={childWrapper}>
            <NodeRenderer node={child} data={data} slots={slots} onAction={onAction} onNavigate={onNavigate} />
          </div>
        );
      })}
    </div>
  );
}

function StackNode({ node, style, data, slots, onAction, onNavigate }: { node: NodeDef; style: CSSProperties; data: DataContext; slots: Record<string, ReactNode>; onAction?: any; onNavigate?: any }) {
  const p = node.props || {};
  const stackStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: p.gap ? resolveTokenToCSS(p.gap) : undefined,
    ...style,
  };
  return (
    <div data-orqui-node={node.id} data-orqui-type="stack" style={stackStyle}>
      {renderChildren(node, data, slots, onAction, onNavigate)}
    </div>
  );
}

function RowNode({ node, style, data, slots, onAction, onNavigate }: { node: NodeDef; style: CSSProperties; data: DataContext; slots: Record<string, ReactNode>; onAction?: any; onNavigate?: any }) {
  const p = node.props || {};
  const rowStyle: CSSProperties = {
    display: "flex",
    flexDirection: "row",
    gap: p.gap ? resolveTokenToCSS(p.gap) : undefined,
    alignItems: p.align || "stretch",
    justifyContent: p.justify || "flex-start",
    flexWrap: p.wrap ? "wrap" : "nowrap",
    ...style,
  };
  return (
    <div data-orqui-node={node.id} data-orqui-type="row" style={rowStyle}>
      {renderChildren(node, data, slots, onAction, onNavigate)}
    </div>
  );
}

function ContainerNode({ node, style, data, slots, onAction, onNavigate }: { node: NodeDef; style: CSSProperties; data: DataContext; slots: Record<string, ReactNode>; onAction?: any; onNavigate?: any }) {
  const p = node.props || {};
  const containerStyle: CSSProperties = {
    padding: p.padding ? resolveTokenToCSS(p.padding) : undefined,
    background: p.background ? resolveTokenToCSS(p.background) : undefined,
    ...style,
  };
  return (
    <div data-orqui-node={node.id} data-orqui-type="container" style={containerStyle}>
      {renderChildren(node, data, slots, onAction, onNavigate)}
    </div>
  );
}

// ============================================================================
// Content Nodes
// ============================================================================

function TextNode({ node, style, data }: { node: NodeDef; style: CSSProperties; data: DataContext }) {
  const ctx = useOrqui();
  const p = node.props || {};
  const textStyle = ctx.getTextStyle(p.textStyle);
  const resolved = ctx.resolveText(p.content || "", data);
  const color = p.color ? resolveTokenToCSS(p.color) : undefined;

  return (
    <span
      data-orqui-node={node.id}
      data-orqui-type="text"
      style={{ ...textStyleToCSS(textStyle), color, ...style }}
    >
      {resolved}
    </span>
  );
}

function HeadingNode({ node, style, data }: { node: NodeDef; style: CSSProperties; data: DataContext }) {
  const ctx = useOrqui();
  const p = node.props || {};
  const level = p.level || 1;
  const textStyle = ctx.getTextStyle(p.textStyle || `heading-${level}`);
  const resolved = ctx.resolveText(p.content || "", data);
  const Tag = `h${Math.min(level, 6)}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

  return React.createElement(
    Tag,
    { "data-orqui-node": node.id, "data-orqui-type": "heading", style: { margin: 0, ...textStyleToCSS(textStyle), ...style } },
    resolved,
  );
}

function BadgeNode({ node, style, data }: { node: NodeDef; style: CSSProperties; data: DataContext }) {
  const ctx = useOrqui();
  const p = node.props || {};
  const resolved = ctx.resolve(p.content || "", data);
  const part = resolved.parts.find((pt) => pt.type === "resolved");
  let text = resolved.text;
  let color: string | undefined;

  if (part && part.type === "resolved" && isRichValue(part.value)) {
    text = part.value.text;
    color = part.value.color;
  }

  const colorToken = color ? resolveTokenToCSS(`$tokens.colors.${color}`) : undefined;
  const badgeStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 8px",
    borderRadius: "9999px",
    fontSize: "12px",
    fontWeight: 500,
    background: colorToken ? `color-mix(in srgb, ${colorToken} 15%, transparent)` : "var(--orqui-colors-surface-2)",
    color: colorToken || "var(--orqui-colors-text-muted)",
    textTransform: "capitalize" as const,
    ...style,
  };

  return (
    <span data-orqui-node={node.id} data-orqui-type="badge" style={badgeStyle}>
      {text}
    </span>
  );
}

function IconNode({ node, style }: { node: NodeDef; style: CSSProperties }) {
  const p = node.props || {};
  const size = p.size || 16;
  const color = p.color ? resolveTokenToCSS(p.color) : undefined;
  // Renders a placeholder — actual icon rendering depends on the icon library
  return (
    <span
      data-orqui-node={node.id}
      data-orqui-type="icon"
      data-icon={p.name}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size, color, ...style }}
      role="img"
      aria-label={p.name}
    >
      {/* Icon component injection point — consumer provides icon resolver */}
    </span>
  );
}

function ButtonNode({ node, style, data, onNavigate }: { node: NodeDef; style: CSSProperties; data: DataContext; onNavigate?: (route: string) => void }) {
  const ctx = useOrqui();
  const p = node.props || {};
  const label = p.label ? ctx.resolveText(p.label, data) : "";
  const variant = p.variant || "default";
  const route = p.route ? ctx.resolveText(p.route, data) : undefined;

  const variantStyles: Record<string, CSSProperties> = {
    primary: { background: "var(--orqui-colors-accent)", color: "#fff", borderRadius: "6px", padding: "6px 14px", fontWeight: 500, fontSize: "13px" },
    outline: { background: "transparent", color: "var(--orqui-colors-text)", border: "1px solid var(--orqui-colors-border)", borderRadius: "6px", padding: "6px 14px", fontWeight: 500, fontSize: "13px" },
    danger: { background: "var(--orqui-colors-danger)", color: "#fff", borderRadius: "6px", padding: "6px 14px", fontWeight: 500, fontSize: "13px" },
    default: { background: "var(--orqui-colors-surface-2)", color: "var(--orqui-colors-text)", borderRadius: "6px", padding: "6px 14px", fontWeight: 500, fontSize: "13px" },
  };

  return (
    <button
      data-orqui-node={node.id}
      data-orqui-type="button"
      style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer", border: "none", ...variantStyles[variant], ...style }}
      onClick={() => route && onNavigate?.(route)}
    >
      {p.icon && <span data-icon={p.icon} style={{ width: 16, height: 16 }} />}
      {label}
    </button>
  );
}

function ImageNode({ node, style, data }: { node: NodeDef; style: CSSProperties; data: DataContext }) {
  const ctx = useOrqui();
  const p = node.props || {};
  const src = p.src ? ctx.resolveText(p.src, data) : "";
  const size = p.size || "auto";

  return (
    <img
      data-orqui-node={node.id}
      data-orqui-type="image"
      src={src}
      alt={p.alt || ""}
      style={{ width: size, height: size, borderRadius: p.rounded ? "50%" : undefined, objectFit: "cover", ...style }}
    />
  );
}

function DividerNode({ node, style }: { node: NodeDef; style: CSSProperties }) {
  const p = node.props || {};
  const color = p.color ? resolveTokenToCSS(p.color) : "var(--orqui-colors-border)";
  return (
    <hr
      data-orqui-node={node.id}
      data-orqui-type="divider"
      style={{ border: "none", borderTop: `1px solid ${color}`, width: "100%", ...style }}
    />
  );
}

function SpacerNode({ node, style }: { node: NodeDef; style: CSSProperties }) {
  const p = node.props || {};
  const size = p.size ? resolveTokenToCSS(p.size) : "16px";
  return <div data-orqui-node={node.id} data-orqui-type="spacer" style={{ height: size, flexShrink: 0, ...style }} />;
}

// ============================================================================
// Data Nodes
// ============================================================================

function StatCardNode({ node, style, data }: { node: NodeDef; style: CSSProperties; data: DataContext }) {
  const ctx = useOrqui();
  const p = node.props || {};
  const label = p.label || "";
  const value = p.value ? ctx.resolveText(p.value, data) : "";
  const colorToken = p.color ? `var(--orqui-colors-${p.color})` : "var(--orqui-colors-text)";

  const cardStyle: CSSProperties = {
    background: "var(--orqui-colors-surface)",
    border: "1px solid var(--orqui-colors-border)",
    borderRadius: "var(--orqui-borderRadius-lg)",
    padding: "var(--orqui-spacing-md)",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    ...style,
  };

  return (
    <div data-orqui-node={node.id} data-orqui-type="stat-card" style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "12px", color: "var(--orqui-colors-text-muted)", fontWeight: 500 }}>{label}</span>
        {p.icon && <span data-icon={p.icon} style={{ width: 16, height: 16, color: colorToken, opacity: 0.7 }} />}
      </div>
      <span style={{ fontSize: "24px", fontWeight: 700, color: colorToken }}>{value}</span>
    </div>
  );
}

function CardNode({ node, style, data, slots, onAction, onNavigate }: { node: NodeDef; style: CSSProperties; data: DataContext; slots: Record<string, ReactNode>; onAction?: any; onNavigate?: any }) {
  const ctx = useOrqui();
  const p = node.props || {};
  const title = p.title ? ctx.resolveText(p.title, data) : undefined;

  const cardStyle: CSSProperties = {
    background: "var(--orqui-colors-surface)",
    border: "1px solid var(--orqui-colors-border)",
    borderRadius: "var(--orqui-borderRadius-lg)",
    overflow: "hidden",
    ...style,
  };

  return (
    <div data-orqui-node={node.id} data-orqui-type="card" style={cardStyle}>
      {title && (
        <div style={{ padding: "var(--orqui-spacing-md)", borderBottom: "1px solid var(--orqui-colors-border)", fontWeight: 600, fontSize: "14px" }}>
          {title}
        </div>
      )}
      <div style={{ padding: p.padding ? resolveTokenToCSS(p.padding) : "var(--orqui-spacing-md)" }}>
        {renderChildren(node, data, slots, onAction, onNavigate)}
      </div>
    </div>
  );
}

function KeyValueNode({ node, style, data }: { node: NodeDef; style: CSSProperties; data: DataContext }) {
  const ctx = useOrqui();
  const p = node.props || {};
  const items = p.items || [];
  const layout = p.layout || "horizontal";
  const isVertical = layout === "vertical";

  return (
    <div
      data-orqui-node={node.id}
      data-orqui-type="key-value"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: isVertical ? "12px" : "8px",
        ...style,
      }}
    >
      {items.map((item: { label: string; value: string }, i: number) => (
        <div key={i} style={{ display: "flex", flexDirection: isVertical ? "column" : "row", gap: isVertical ? "2px" : "8px", justifyContent: isVertical ? "flex-start" : "space-between" }}>
          <span style={{ fontSize: "12px", color: "var(--orqui-colors-text-muted)", fontWeight: 500 }}>{item.label}</span>
          <TemplateContent template={item.value} data={data} style={{ fontSize: "14px", fontWeight: 500 }} />
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// P2.4 — TableRenderer
// ============================================================================

function TableNode({ node, style, data, onAction, onNavigate }: { node: NodeDef; style: CSSProperties; data: DataContext; onAction?: (action: string, item: unknown) => void; onNavigate?: (route: string) => void }) {
  const ctx = useOrqui();
  const p = node.props || {};
  const columns = p.columns || [];
  const dataSource = p.dataSource;
  const items: unknown[] = dataSource ? (data[dataSource] as unknown[] || []) : [];
  const rowHeight = p.rowHeight || 48;
  const compact = p.compact || false;
  const emptyMessage = p.emptyMessage || "Nenhum item encontrado";

  const tableStyle: CSSProperties = {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: compact ? "13px" : "14px",
    ...style,
  };

  if (items.length === 0) {
    return (
      <div data-orqui-node={node.id} data-orqui-type="table-empty" style={{ textAlign: "center", padding: "32px", color: "var(--orqui-colors-text-dim)", fontSize: "14px", ...style }}>
        {emptyMessage}
      </div>
    );
  }

  // Infer entity name from dataSource (plural → singular: "runs" → "run")
  const entityName = dataSource ? dataSource.replace(/s$/, "") : "item";

  return (
    <div data-orqui-node={node.id} data-orqui-type="table" style={{ overflowX: "auto" }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            {columns.map((col: any) => (
              <th
                key={col.key}
                style={{
                  width: col.width,
                  textAlign: (col.align as any) || "left",
                  padding: compact ? "8px 12px" : "10px 16px",
                  borderBottom: "1px solid var(--orqui-colors-border)",
                  color: "var(--orqui-colors-text-muted)",
                  fontSize: "12px",
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item: any, rowIdx: number) => {
            const rowData: DataContext = { ...data, [entityName]: item };
            return (
              <tr
                key={item?.id || rowIdx}
                style={{
                  height: rowHeight,
                  borderBottom: "1px solid var(--orqui-colors-border)",
                }}
              >
                {columns.map((col: any) => {
                  const content = col.content || "";
                  const link = col.link ? ctx.resolveText(col.link, rowData) : undefined;

                  return (
                    <td
                      key={col.key}
                      style={{
                        padding: compact ? "6px 12px" : "10px 16px",
                        textAlign: (col.align as any) || "left",
                        verticalAlign: "middle",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: 0,
                      }}
                    >
                      {link ? (
                        <a
                          onClick={(e) => { e.preventDefault(); onNavigate?.(link); }}
                          href={link}
                          style={{ color: "var(--orqui-colors-accent)", cursor: "pointer" }}
                        >
                          <TemplateContent template={content} data={rowData} />
                        </a>
                      ) : (
                        <TemplateContent template={content} data={rowData} onAction={onAction} actionItem={item} />
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ListNode({ node, style, data, onAction, onNavigate }: { node: NodeDef; style: CSSProperties; data: DataContext; slots: Record<string, ReactNode>; onAction?: any; onNavigate?: any }) {
  const ctx = useOrqui();
  const p = node.props || {};
  const dataSource = p.dataSource;
  const items: unknown[] = dataSource ? (data[dataSource] as unknown[] || []) : [];
  const maxItems = p.maxItems || items.length;
  const template = p.template as NodeDef | undefined;
  const entityName = dataSource ? dataSource.replace(/s$/, "") : "item";

  return (
    <div data-orqui-node={node.id} data-orqui-type="list" style={{ display: "flex", flexDirection: "column", ...style }}>
      {items.slice(0, maxItems).map((item: any, idx: number) => {
        const itemData: DataContext = { ...data, [entityName]: item };
        if (template) {
          return <NodeRenderer key={item?.id || idx} node={{ ...template, id: `${node.id}-item-${idx}` }} data={itemData} onAction={onAction} onNavigate={onNavigate} slots={{}} />;
        }
        return <div key={idx}>{JSON.stringify(item)}</div>;
      })}
    </div>
  );
}

// ============================================================================
// Navigation Nodes
// ============================================================================

function TabsNode({ node, style, data, slots, onAction, onNavigate }: { node: NodeDef; style: CSSProperties; data: DataContext; slots: Record<string, ReactNode>; onAction?: any; onNavigate?: any }) {
  const ctx = useOrqui();
  const p = node.props || {};
  const tabItems = p.items || [];
  const [activeTab, setActiveTab] = React.useState(p.defaultTab || tabItems[0]?.id);

  return (
    <div data-orqui-node={node.id} data-orqui-type="tabs" style={style}>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: "0px", borderBottom: "1px solid var(--orqui-colors-border)", marginBottom: "16px" }}>
        {tabItems.map((tab: { id: string; label: string }) => {
          const label = ctx.resolveText(tab.label, data);
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "var(--orqui-colors-accent)" : "var(--orqui-colors-text-muted)",
                borderBottom: isActive ? "2px solid var(--orqui-colors-accent)" : "2px solid transparent",
                background: "none",
                cursor: "pointer",
                transition: "color 0.15s, border-color 0.15s",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      {/* Tab content */}
      {(node.children || []).map((child) => {
        const tabId = child.props?.tab;
        if (tabId && tabId !== activeTab) return null;
        return <NodeRenderer key={child.id} node={child} data={data} slots={slots} onAction={onAction} onNavigate={onNavigate} />;
      })}
    </div>
  );
}

// ============================================================================
// Input Nodes
// ============================================================================

function SearchNode({ node, style }: { node: NodeDef; style: CSSProperties }) {
  const p = node.props || {};
  return (
    <input
      data-orqui-node={node.id}
      data-orqui-type="search"
      type="search"
      placeholder={p.placeholder || "Buscar..."}
      style={{
        background: "var(--orqui-colors-surface-2)",
        border: "1px solid var(--orqui-colors-border)",
        borderRadius: "6px",
        padding: "6px 12px",
        color: "var(--orqui-colors-text)",
        fontSize: "13px",
        outline: "none",
        width: p.fullWidth ? "100%" : "auto",
        minWidth: "180px",
        ...style,
      }}
    />
  );
}

function SelectNode({ node, style, data }: { node: NodeDef; style: CSSProperties; data: DataContext }) {
  const ctx = useOrqui();
  const p = node.props || {};
  let options: string[] = [];

  if (typeof p.options === "string") {
    const resolved = ctx.resolveText(p.options, data);
    try {
      options = JSON.parse(resolved);
    } catch {
      options = [];
    }
  } else if (Array.isArray(p.options)) {
    options = p.options;
  }

  return (
    <select
      data-orqui-node={node.id}
      data-orqui-type="select"
      style={{
        background: "var(--orqui-colors-surface-2)",
        border: "1px solid var(--orqui-colors-border)",
        borderRadius: "6px",
        padding: "6px 12px",
        color: "var(--orqui-colors-text)",
        fontSize: "13px",
        outline: "none",
        cursor: "pointer",
        ...style,
      }}
    >
      <option value="">{p.placeholder || "Selecionar..."}</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}

// ============================================================================
// Special Nodes
// ============================================================================

function SlotNode({ node, slots }: { node: NodeDef; slots: Record<string, ReactNode> }) {
  const name = node.props?.name || node.id;
  const content = slots[name];
  if (!content) {
    return <div data-orqui-node={node.id} data-orqui-type="slot" data-slot={name} />;
  }
  return <div data-orqui-node={node.id} data-orqui-type="slot" data-slot={name}>{content}</div>;
}

function ComponentRefNode({ node, data }: { node: NodeDef; data: DataContext }) {
  const ctx = useOrqui();
  const p = node.props || {};
  // Component references are resolved at the consumer level via registry
  return (
    <div data-orqui-node={node.id} data-orqui-type="component" data-component={p.name}>
      {/* Consumer should provide component mapping */}
    </div>
  );
}

// ============================================================================
// Template Content — renders a resolved template with rich values
// ============================================================================

function TemplateContent({ template, data, style, onAction, actionItem }: {
  template: string;
  data: DataContext;
  style?: CSSProperties;
  onAction?: (action: string, item: unknown) => void;
  actionItem?: unknown;
}) {
  const ctx = useOrqui();
  const resolved = ctx.resolve(template, data);

  if (!resolved.hasRichValues) {
    return <span style={style}>{resolved.text}</span>;
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", ...style }}>
      {resolved.parts.map((part, i) => {
        if (part.type === "literal") {
          return <span key={i}>{part.value}</span>;
        }

        if (!isRichValue(part.value)) {
          return <span key={i}>{String(part.value)}</span>;
        }

        const rv = part.value;

        switch (rv.type) {
          case "badge": {
            const colorToken = rv.color ? `var(--orqui-colors-${rv.color})` : undefined;
            return (
              <span
                key={i}
                style={{
                  display: "inline-flex",
                  padding: "1px 8px",
                  borderRadius: "9999px",
                  fontSize: "12px",
                  fontWeight: 500,
                  background: colorToken ? `color-mix(in srgb, ${colorToken} 15%, transparent)` : "var(--orqui-colors-surface-2)",
                  color: colorToken || "var(--orqui-colors-text-muted)",
                  textTransform: "capitalize",
                }}
              >
                {rv.text}
              </span>
            );
          }
          case "boolean-icon":
            return (
              <span key={i} style={{ color: rv.color ? `var(--orqui-colors-${rv.color})` : undefined }}>
                {rv.text}
              </span>
            );
          case "link":
            return (
              <a key={i} href={rv.href} style={{ color: "var(--orqui-colors-accent)", textDecoration: "none" }}>
                {rv.text}
              </a>
            );
          case "color":
            return (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <span style={{ width: 12, height: 12, borderRadius: 2, background: rv.color, display: "inline-block" }} />
                <span>{rv.text}</span>
              </span>
            );
          default:
            return <span key={i}>{rv.text}</span>;
        }
      })}
    </span>
  );
}
