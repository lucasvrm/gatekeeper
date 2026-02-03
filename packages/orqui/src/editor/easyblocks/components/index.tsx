// ============================================================================
// Orqui React Components for Easyblocks Canvas
//
// FIX: Easyblocks passes styled components as ReactElement, NOT ComponentType.
// The correct pattern is: <Root.type {...Root.props}>{children}</Root.type>
//
// Sub-component slots (Children from component-collection) are ReactElement[].
// Single-component slots (component) are ReactElement.
//
// Ref: https://docs.easyblocks.io/essentials/no-code-components/styles-function
// ============================================================================

import React, { type ReactElement, type ComponentType } from "react";

// ============================================================================
// Layout Components
// ============================================================================

export function OrquiStack({ Root, Children }: { Root: ReactElement; Children: ReactElement[] }) {
  return (
    <Root.type {...Root.props}>
      {Children}
    </Root.type>
  );
}

export function OrquiRow({ Root, Children }: { Root: ReactElement; Children: ReactElement[] }) {
  return (
    <Root.type {...Root.props}>
      {Children}
    </Root.type>
  );
}

export function OrquiGrid({ Root, Children }: { Root: ReactElement; Children: ReactElement[] }) {
  return (
    <Root.type {...Root.props}>
      {Children}
    </Root.type>
  );
}

export function OrquiContainer({ Root, Children }: { Root: ReactElement; Children: ReactElement[] }) {
  return (
    <Root.type {...Root.props}>
      {Children}
    </Root.type>
  );
}

// ============================================================================
// Content Components
// ============================================================================

export function OrquiHeading({ Root, content, as: Tag = "h2" }: {
  Root: ReactElement; content: string; as?: string;
}) {
  const Element = Tag as any;
  return (
    <Root.type {...Root.props}>
      <Element style={{ margin: 0, fontSize: "inherit", fontWeight: "inherit", color: "inherit" }}>
        {content || "Título"}
      </Element>
    </Root.type>
  );
}

export function OrquiText({ Root, content }: { Root: ReactElement; content: string }) {
  return (
    <Root.type {...Root.props}>
      <p style={{ margin: 0 }}>{content || "Texto"}</p>
    </Root.type>
  );
}

export function OrquiButton({ Root, label, icon }: {
  Root: ReactElement; label: string; icon?: string;
}) {
  return (
    <Root.type {...Root.props}>
      {icon && <span style={{ fontSize: "1em" }}>{icon}</span>}
      <span>{label || "Botão"}</span>
    </Root.type>
  );
}

export function OrquiBadge({ Root, content }: { Root: ReactElement; content: string }) {
  return (
    <Root.type {...Root.props}>
      {content || "Badge"}
    </Root.type>
  );
}

export function OrquiIcon({ Root, name, size }: {
  Root: ReactElement; name: string; size: string;
}) {
  return (
    <Root.type {...Root.props}>
      <span style={{
        fontSize: `${Math.max(parseInt(size) * 0.5, 10)}px`,
        opacity: 0.5,
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        {name || "icon"}
      </span>
    </Root.type>
  );
}

export function OrquiImage({ Root, src, alt, size, rounded }: {
  Root: ReactElement; src: string; alt: string; size: string; rounded: boolean;
}) {
  if (!src) {
    return (
      <Root.type {...Root.props}>
        <div style={{
          width: `${size}px`, height: `${size}px`,
          background: "#1c1c21", border: "1px dashed #3a3a45",
          borderRadius: rounded ? "9999px" : "4px",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, color: "#5b5b66",
        }}>
          IMG
        </div>
      </Root.type>
    );
  }
  return (
    <Root.type {...Root.props}>
      <img src={src} alt={alt} style={{
        width: `${size}px`, height: `${size}px`,
        objectFit: "cover",
        borderRadius: rounded ? "9999px" : "4px",
      }} />
    </Root.type>
  );
}

export function OrquiDivider({ Root }: { Root: ReactElement }) {
  return <Root.type {...Root.props} />;
}

export function OrquiSpacer({ Root }: { Root: ReactElement }) {
  return <Root.type {...Root.props} />;
}

// ============================================================================
// Data Components
// ============================================================================

export function OrquiStatCard({ Root, label, value, icon }: {
  Root: ReactElement; label: string; value: string; icon: string;
}) {
  return (
    <Root.type {...Root.props}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 12, color: "#8b8b96", marginBottom: 4 }}>{label || "Label"}</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{value || "0"}</div>
        </div>
        <span style={{ fontSize: 16, opacity: 0.6 }}>{icon || "📊"}</span>
      </div>
    </Root.type>
  );
}

export function OrquiCard({ Root, title, Children }: {
  Root: ReactElement; title: string; Children: ReactElement[];
}) {
  return (
    <Root.type {...Root.props}>
      {title && (
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid #2a2a33" }}>
          {title}
        </div>
      )}
      <div>{Children}</div>
    </Root.type>
  );
}

export function OrquiTable({ Root, dataSource, columnsJson }: {
  Root: ReactElement; dataSource: string; columnsJson: string;
}) {
  let columns: Array<{ key: string; label: string; width?: string }> = [];
  try { columns = JSON.parse(columnsJson || "[]"); } catch { /* ignore */ }

  return (
    <Root.type {...Root.props}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} style={{
                textAlign: "left", padding: "6px 10px", fontSize: 11,
                color: "#8b8b96", fontWeight: 600,
                borderBottom: "1px solid #2a2a33",
                width: col.width,
              }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3].map(row => (
            <tr key={row}>
              {columns.map(col => (
                <td key={col.key} style={{
                  padding: "6px 10px", fontSize: 12,
                  borderBottom: "1px solid #1a1a1f",
                }}>
                  <span style={{ opacity: 0.4 }}>{`{${dataSource}[${row}].${col.key}}`}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Root.type>
  );
}

export function OrquiList({ Root, dataSource, maxItems }: {
  Root: ReactElement; dataSource: string; maxItems: string;
}) {
  const count = Math.min(parseInt(maxItems) || 3, 5);
  return (
    <Root.type {...Root.props}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid #1a1a1f", fontSize: 12 }}>
          <span style={{ opacity: 0.4 }}>{`{${dataSource}[${i}]}`}</span>
        </div>
      ))}
    </Root.type>
  );
}

export function OrquiKeyValue({ Root, layout, itemsJson }: {
  Root: ReactElement; layout: string; itemsJson: string;
}) {
  let items: Array<{ label: string; value: string }> = [];
  try { items = JSON.parse(itemsJson || "[]"); } catch { /* ignore */ }

  return (
    <Root.type {...Root.props}>
      {items.map((item, i) => (
        <div key={i} style={{
          display: "flex",
          flexDirection: layout === "stacked" ? "column" : "row",
          gap: layout === "stacked" ? 2 : 8,
          padding: "4px 0",
        }}>
          <span style={{ fontSize: 11, color: "#8b8b96", minWidth: 80 }}>{item.label}</span>
          <span style={{ fontSize: 12 }}>{item.value}</span>
        </div>
      ))}
    </Root.type>
  );
}

// ============================================================================
// Navigation, Input & Special Components
// ============================================================================

export function OrquiTabs({ Root, tabsJson, defaultTab }: {
  Root: ReactElement; tabsJson: string; defaultTab: string;
}) {
  let tabs: Array<{ id: string; label: string }> = [];
  try { tabs = JSON.parse(tabsJson || "[]"); } catch { /* ignore */ }

  return (
    <Root.type {...Root.props}>
      <div style={{ display: "flex", gap: 2, borderBottom: "1px solid #2a2a33", marginBottom: 8 }}>
        {tabs.map(tab => (
          <div key={tab.id} style={{
            padding: "6px 12px", fontSize: 12, fontWeight: tab.id === defaultTab ? 600 : 400,
            color: tab.id === defaultTab ? "#6d9cff" : "#8b8b96",
            borderBottom: tab.id === defaultTab ? "2px solid #6d9cff" : "2px solid transparent",
          }}>
            {tab.label}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: "#5b5b66" }}>
        Conteúdo: {defaultTab}
      </div>
    </Root.type>
  );
}

export function OrquiSearch({ Root, placeholder }: {
  Root: ReactElement; placeholder: string;
}) {
  return (
    <Root.type {...Root.props}>
      <span style={{ marginRight: 6 }}>🔍</span>
      <span style={{ opacity: 0.4, fontSize: 13 }}>{placeholder || "Buscar..."}</span>
    </Root.type>
  );
}

export function OrquiSelect({ Root, placeholder, optionsJson }: {
  Root: ReactElement; placeholder: string; optionsJson: string;
}) {
  return (
    <Root.type {...Root.props}>
      <span style={{ opacity: 0.4, fontSize: 13 }}>{placeholder || "Selecionar..."}</span>
      <span style={{ marginLeft: "auto" }}>▾</span>
    </Root.type>
  );
}

export function OrquiSlot({ Root, name }: { Root: ReactElement; name: string }) {
  return (
    <Root.type {...Root.props}>
      <span>⧉ Slot: {name || "default"}</span>
    </Root.type>
  );
}

// ============================================================================
// Component Map — keyed by definition ID for Easyblocks
// ============================================================================

export const ORQUI_COMPONENTS: Record<string, ComponentType<any>> = {
  OrquiStack,
  OrquiRow,
  OrquiGrid,
  OrquiContainer,
  OrquiHeading,
  OrquiText,
  OrquiButton,
  OrquiBadge,
  OrquiIcon,
  OrquiImage,
  OrquiDivider,
  OrquiSpacer,
  OrquiStatCard,
  OrquiCard,
  OrquiTable,
  OrquiList,
  OrquiKeyValue,
  OrquiTabs,
  OrquiSearch,
  OrquiSelect,
  OrquiSlot,
};
