import React, { useState, useMemo } from "react";
import { COLORS, s } from "../lib/constants";
import { resolveToken, resolveTokenNum } from "../lib/utils";
import { MiniPhosphorIcon, HEADER_ICON_PHOSPHOR } from "../editors/HeaderElementsEditor";

// ============================================================================
// Layout Preview
// ============================================================================
export function LayoutPreview({ layout }) {
  const { regions } = layout.structure;
  const tokens = layout.tokens;

  const sidebarW = resolveTokenNum(regions.sidebar?.dimensions?.width, tokens);
  const headerH = resolveTokenNum(regions.header?.dimensions?.height, tokens);

  const PREVIEW_H = 500;
  const SCALE = PREVIEW_H / 800;

  const regionColors = {
    sidebar: { bg: "#6d9cff12", border: "#6d9cff40", text: "#6d9cff" },
    header: { bg: "#4ade8012", border: "#4ade8040", text: "#4ade80" },
    main: { bg: "#fbbf2408", border: "#fbbf2430", text: "#fbbf24" },
    footer: { bg: "#ff6b6b12", border: "#ff6b6b40", text: "#ff6b6b" },
  };

  const renderContainer = (container, color, isVertical = true) => (
    <div key={container.name} style={{
      border: `1px dashed ${color}40`,
      borderRadius: 4,
      padding: "6px 8px",
      marginBottom: isVertical ? 4 : 0,
      marginRight: isVertical ? 0 : 4,
      flex: isVertical ? undefined : 1,
    }}>
      <div style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color, opacity: 0.8 }}>{container.name}</div>
      {container.description && <div style={{ fontSize: 8, color: COLORS.textDim, marginTop: 2 }}>{container.description}</div>}
    </div>
  );

  const renderPadding = (region, name) => {
    const pad = region.padding || {};
    const vals = ["top", "right", "bottom", "left"].map(side => resolveTokenNum(pad[side], tokens));
    if (vals.every(v => v === 0)) return null;
    return (
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {/* Top */}
        {vals[0] > 0 && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: Math.max(vals[0] * SCALE, 2), background: regionColors[name]?.border || "#fff2", opacity: 0.3 }} />}
        {/* Bottom */}
        {vals[2] > 0 && <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: Math.max(vals[2] * SCALE, 2), background: regionColors[name]?.border || "#fff2", opacity: 0.3 }} />}
        {/* Left */}
        {vals[3] > 0 && <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: Math.max(vals[3] * SCALE, 2), background: regionColors[name]?.border || "#fff2", opacity: 0.3 }} />}
        {/* Right */}
        {vals[1] > 0 && <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: Math.max(vals[1] * SCALE, 2), background: regionColors[name]?.border || "#fff2", opacity: 0.3 }} />}
      </div>
    );
  };

  const renderRegionLabel = (name, region) => {
    const c = regionColors[name];
    const dims = region.dimensions || {};
    const w = resolveToken(dims.width, tokens);
    const h = resolveToken(dims.height, tokens);
    const dimStr = [w && `W:${w}`, h && `H:${h}`].filter(Boolean).join(" ");
    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: c.text, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.05em" }}>{name}</span>
          {region.behavior?.scrollable && <span style={{ fontSize: 8, padding: "1px 4px", borderRadius: 3, background: `${c.text}15`, color: c.text, border: `1px solid ${c.text}25` }}>scroll</span>}
          {region.behavior?.fixed && <span style={{ fontSize: 8, padding: "1px 4px", borderRadius: 3, background: `${c.text}15`, color: c.text, border: `1px solid ${c.text}25` }}>fixed</span>}
        </div>
        {dimStr && <span style={{ fontSize: 9, color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace" }}>{dimStr}</span>}
      </div>
    );
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, margin: 0, marginBottom: 4 }}>Layout Preview</h3>
        <p style={{ fontSize: 12, color: COLORS.textDim, margin: 0 }}>Estrutura do AppShell renderizada a partir do Layout Contract</p>
      </div>

      {/* AppShell preview — matches real layout: sidebar full height, header+main on right */}
      <div style={{
        border: `1px solid ${COLORS.border2}`,
        borderRadius: 10,
        overflow: "hidden",
        background: COLORS.bg,
        height: PREVIEW_H,
        display: "flex",
        position: "relative",
      }}>
        {/* Sidebar — full height */}
        {regions.sidebar?.enabled && (
          <div style={{
            width: Math.max(sidebarW * SCALE, 120),
            background: regionColors.sidebar.bg,
            borderRight: `1px solid ${regionColors.sidebar.border}`,
            padding: 8,
            position: "relative",
            overflow: "auto",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            order: regions.sidebar.position === "right" ? 2 : 0,
            ...(regions.sidebar.position === "right" ? { borderRight: "none", borderLeft: `1px solid ${regionColors.sidebar.border}` } : {}),
          }}>
            {renderPadding(regions.sidebar, "sidebar")}
            {/* Logo in sidebar */}
            {layout.structure?.logo?.position === "sidebar" && (
              <div style={{
                marginBottom: 8, paddingBottom: 6,
                borderBottom: `1px solid ${regionColors.sidebar.border}`,
                textAlign: layout.structure.logo.sidebarAlign === "center" ? "center" : layout.structure.logo.sidebarAlign === "right" ? "right" : "left",
                minHeight: layout.structure.logo.alignWithHeader && regions.header?.enabled ? Math.max((headerH * SCALE || 40) - 16, 24) : undefined,
                display: "flex", alignItems: "center",
                justifyContent: layout.structure.logo.sidebarAlign === "center" ? "center" : layout.structure.logo.sidebarAlign === "right" ? "flex-end" : "flex-start",
              }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: regionColors.sidebar.text, fontFamily: "'JetBrains Mono', monospace" }}>
                  {layout.structure.logo.type === "icon-text"
                    ? `${layout.structure.logo.icon || "⬡"} ${layout.structure.logo.text || "App"}`
                    : layout.structure.logo.text || "App"}
                </span>
              </div>
            )}
            {renderRegionLabel("sidebar", regions.sidebar)}
            <div style={{ flex: 1, overflow: "auto" }}>
              {(regions.sidebar.containers || [])
                .sort((a, b) => a.order - b.order)
                .map(c => renderContainer(c, regionColors.sidebar.text))}
            </div>
          </div>
        )}

        {/* Right column: header + main + footer */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, order: 1 }}>
          {/* Header */}
          {regions.header?.enabled && (
            <div style={{
              height: headerH * SCALE || 40,
              minHeight: 36,
              background: regionColors.header.bg,
              borderBottom: `1px solid ${regionColors.header.border}`,
              padding: 8,
              position: "relative",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
            }}>
              {renderPadding(regions.header, "header")}
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
                {/* Logo in header */}
                {layout.structure?.logo?.position === "header" && (
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: regionColors.header.text,
                    fontFamily: "'JetBrains Mono', monospace",
                    order: layout.structure.logo.headerSlot === "right" ? 3 : layout.structure.logo.headerSlot === "center" ? 1 : 0,
                    flex: layout.structure.logo.headerSlot === "center" ? 1 : "0 0 auto",
                    textAlign: layout.structure.logo.headerSlot === "center" ? "center" : undefined,
                  }}>
                    {layout.structure.logo.type === "icon-text"
                      ? `${layout.structure.logo.icon || "⬡"} ${layout.structure.logo.text || "App"}`
                      : layout.structure.logo.text || "App"}
                  </div>
                )}
                {/* Breadcrumbs in header */}
                {layout.structure?.breadcrumbs?.enabled && layout.structure.breadcrumbs.position === "header" && (
                  <div style={{ fontSize: 9, color: regionColors.header.text, opacity: 0.7, fontFamily: "'JetBrains Mono', monospace" }}>
                    {layout.structure.breadcrumbs.showHome !== false ? (layout.structure.breadcrumbs.homeLabel || "Home") : ""}
                    {layout.structure.breadcrumbs.showHome !== false ? ` ${layout.structure.breadcrumbs.separator || "/"} ` : ""}
                    Page
                  </div>
                )}
                <div style={{ flex: 1 }} />
                {/* Header elements preview */}
                {layout.structure?.headerElements?.search?.enabled && (
                  <div style={{ fontSize: 8, padding: "2px 4px", borderRadius: 3, background: `${regionColors.header.text}15`, color: regionColors.header.text, border: `1px solid ${regionColors.header.text}25`, display: "inline-flex" }}><MiniPhosphorIcon name="magnifying-glass" size={8} /></div>
                )}
                {layout.structure?.headerElements?.icons?.enabled && (layout.structure.headerElements.icons.items || []).slice(0, 3).map((raw, i) => {
                  const ic = typeof raw === "string" ? raw : raw.id;
                  const phName = HEADER_ICON_PHOSPHOR[ic] || ic;
                  return <div key={i} style={{ display: "inline-flex", padding: "2px 3px", borderRadius: 3, background: `${regionColors.header.text}10`, color: regionColors.header.text }}><MiniPhosphorIcon name={phName} size={8} /></div>;
                })}
                {((layout.structure?.headerElements?.ctas?.length > 0) || layout.structure?.headerElements?.cta?.enabled) && (
                  <div style={{ fontSize: 8, padding: "2px 8px", borderRadius: 3, background: COLORS.accent, color: "#fff" }}>{layout.structure.headerElements.ctas?.[0]?.label || layout.structure.headerElements.cta?.label || "CTA"}</div>
                )}
              </div>
            </div>
          )}

          {/* Main */}
          {regions.main?.enabled && (
            <div style={{
              flex: 1,
              background: regionColors.main.bg,
              padding: 8,
              position: "relative",
              overflow: "auto",
            }}>
              {renderPadding(regions.main, "main")}
              {renderRegionLabel("main", regions.main)}
              {(regions.main.containers || [])
                .sort((a, b) => a.order - b.order)
                .map(c => renderContainer(c, regionColors.main.text))}
            </div>
          )}

          {/* Footer */}
          {regions.footer?.enabled && (
            <div style={{
              minHeight: 36,
              background: regionColors.footer.bg,
              borderTop: `1px solid ${regionColors.footer.border}`,
              padding: 8,
              position: "relative",
              flexShrink: 0,
            }}>
              {renderPadding(regions.footer, "footer")}
              {renderRegionLabel("footer", regions.footer)}
              <div style={{ display: "flex", gap: 4 }}>
                {(regions.footer.containers || [])
                  .sort((a, b) => a.order - b.order)
                  .map(c => renderContainer(c, regionColors.footer.text, false))}
              </div>
            </div>
          )}
        </div>

        {/* Empty state overlay */}
        {!Object.values(regions).some(r => r.enabled) && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 13, color: COLORS.textDim }}>Nenhuma região ativa</span>
          </div>
        )}
      </div>

      {/* Token summary */}
      <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {Object.entries(layout.tokens.spacing || {}).map(([key, tok]) => (
          <div key={`sp-${key}`} style={{ ...s.tag, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>
            <span style={{ color: COLORS.accent }}>spacing.</span>{key}: {tok.value}{tok.unit}
          </div>
        ))}
        {Object.entries(layout.tokens.sizing || {}).map(([key, tok]) => (
          <div key={`sz-${key}`} style={{ ...s.tag, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>
            <span style={{ color: COLORS.success }}>sizing.</span>{key}: {tok.value}{tok.unit}
          </div>
        ))}
      </div>
    </div>
  );
}

