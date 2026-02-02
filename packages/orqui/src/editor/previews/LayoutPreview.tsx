import React, { useState, useMemo } from "react";
import { COLORS, s } from "../lib/constants";
import { resolveToken, resolveTokenNum } from "../lib/utils";
import { MiniPhosphorIcon, HEADER_ICON_PHOSPHOR } from "../editors/HeaderElementsEditor";

// ============================================================================
// Layout Preview — zone-aware
// ============================================================================
export function LayoutPreview({ layout }) {
  const { regions } = layout.structure;
  const tokens = layout.tokens;

  const sidebarW = resolveTokenNum(regions.sidebar?.dimensions?.width, tokens);
  const sidebarCollapsed = resolveTokenNum(regions.sidebar?.dimensions?.minWidth, tokens) || 52;
  const headerH = resolveTokenNum(regions.header?.dimensions?.height, tokens);
  const sidebarPad = resolveTokenNum(tokens?.sizing?.["sidebar-pad"]?.value ? `$tokens.sizing.sidebar-pad` : null, tokens) || (tokens?.sizing?.["sidebar-pad"]?.value ?? 16);
  const mainPad = resolveTokenNum(tokens?.sizing?.["main-pad"]?.value ? `$tokens.sizing.main-pad` : null, tokens) || (tokens?.sizing?.["main-pad"]?.value ?? 28);

  const PREVIEW_H = 500;
  const SCALE = PREVIEW_H / 800;

  const [collapsed, setCollapsed] = useState(false);
  const [debugLines, setDebugLines] = useState(false);

  const currentSidebarW = collapsed ? sidebarCollapsed : sidebarW;

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
        {vals[0] > 0 && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: Math.max(vals[0] * SCALE, 2), background: regionColors[name]?.border || "#fff2", opacity: 0.3 }} />}
        {vals[2] > 0 && <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: Math.max(vals[2] * SCALE, 2), background: regionColors[name]?.border || "#fff2", opacity: 0.3 }} />}
        {vals[3] > 0 && <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: Math.max(vals[3] * SCALE, 2), background: regionColors[name]?.border || "#fff2", opacity: 0.3 }} />}
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

  // Zone-based header rendering
  const hasZones = regions.header?.zones;
  const scaledSidebarW = Math.max(currentSidebarW * SCALE, collapsed ? 40 : 120);
  const scaledSidebarPad = Math.max(sidebarPad * SCALE, 6);
  const scaledMainPad = Math.max(mainPad * SCALE, 8);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, margin: 0, marginBottom: 4 }}>Layout Preview</h3>
        <p style={{ fontSize: 12, color: COLORS.textDim, margin: 0 }}>
          Estrutura do AppShell renderizada a partir do Layout Contract
          {hasZones && <span style={{ marginLeft: 6, fontSize: 10, color: COLORS.accent, padding: "1px 6px", background: COLORS.accent + "15", borderRadius: 4 }}>zone-based</span>}
        </p>
      </div>

      {/* Dev controls */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {regions.sidebar?.behavior?.collapsible && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{ ...s.btnSmall, background: collapsed ? COLORS.accent + "20" : COLORS.surface3, color: collapsed ? COLORS.accent : COLORS.textMuted }}
          >
            {collapsed ? "▸ Expand" : "◂ Collapse"}
          </button>
        )}
        {hasZones && (
          <button
            onClick={() => setDebugLines(!debugLines)}
            style={{ ...s.btnSmall, background: debugLines ? "#fbbf2420" : COLORS.surface3, color: debugLines ? "#fbbf24" : COLORS.textMuted }}
          >
            {debugLines ? "⊞ Debug ON" : "⊞ Debug Lines"}
          </button>
        )}
      </div>

      {/* AppShell preview */}
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
            width: scaledSidebarW,
            background: regionColors.sidebar.bg,
            borderRight: `1px solid ${regionColors.sidebar.border}`,
            paddingLeft: scaledSidebarPad,
            paddingRight: collapsed ? 0 : scaledSidebarPad,
            paddingTop: 8,
            position: "relative",
            overflow: "auto",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            order: regions.sidebar.position === "right" ? 2 : 0,
            transition: "width 0.2s ease",
            ...(debugLines ? { outline: `1px solid #e89c2880` } : {}),
            ...(regions.sidebar.position === "right" ? { borderRight: "none", borderLeft: `1px solid ${regionColors.sidebar.border}` } : {}),
          }}>
            {/* Debug: sidebar-pad guide */}
            {debugLines && (
              <div style={{ position: "absolute", top: 0, left: scaledSidebarPad, bottom: 0, width: 1, background: "#e89c28", opacity: 0.6, zIndex: 10 }} />
            )}

            {/* Logo in sidebar */}
            {layout.structure?.logo?.position === "sidebar" && (
              <div style={{
                marginBottom: 8, paddingBottom: 6,
                borderBottom: `1px solid ${regionColors.sidebar.border}`,
                textAlign: collapsed ? "center" : (layout.structure.logo.sidebarAlign === "center" ? "center" : layout.structure.logo.sidebarAlign === "right" ? "right" : "left"),
                minHeight: layout.structure.logo.alignWithHeader && regions.header?.enabled ? Math.max((headerH * SCALE || 40) - 16, 24) : undefined,
                display: "flex", alignItems: "center",
                justifyContent: collapsed ? "center" : (layout.structure.logo.sidebarAlign === "center" ? "center" : layout.structure.logo.sidebarAlign === "right" ? "flex-end" : "flex-start"),
              }}>
                <span style={{ fontSize: collapsed ? 12 : 10, fontWeight: 700, color: regionColors.sidebar.text, fontFamily: "'JetBrains Mono', monospace" }}>
                  {collapsed
                    ? (layout.structure.logo.text || "A").charAt(0)
                    : layout.structure.logo.type === "icon-text"
                      ? `${layout.structure.logo.icon || "⬡"} ${layout.structure.logo.text || "App"}`
                      : layout.structure.logo.text || "App"}
                </span>
              </div>
            )}

            {!collapsed && renderRegionLabel("sidebar", regions.sidebar)}

            <div style={{ flex: 1, overflow: "auto" }}>
              {(regions.sidebar.containers || [])
                .sort((a, b) => a.order - b.order)
                .map(c => {
                  if (collapsed) {
                    // Collapsed: show letter-only for nav items
                    return (
                      <div key={c.name} style={{
                        padding: "4px 0",
                        display: "flex",
                        justifyContent: "center",
                        fontSize: 9,
                        color: regionColors.sidebar.text,
                        opacity: 0.7,
                        fontFamily: "'JetBrains Mono', monospace",
                      }}>
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                    );
                  }
                  return renderContainer(c, regionColors.sidebar.text);
                })}
            </div>
          </div>
        )}

        {/* Right column: header + main + footer */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, order: 1 }}>
          {/* Header — zone-based or flat */}
          {regions.header?.enabled && (
            <div style={{
              height: headerH * SCALE || 40,
              minHeight: 36,
              background: regionColors.header.bg,
              borderBottom: `1px solid ${regionColors.header.border}`,
              position: "relative",
              flexShrink: 0,
              display: "flex",
              alignItems: "stretch",
              ...(debugLines ? { outline: `1px solid #4ade8080` } : {}),
            }}>
              {hasZones ? (
                <>
                  {/* Sidebar Zone — matches sidebar width */}
                  <div style={{
                    width: scaledSidebarW,
                    flexShrink: 0,
                    paddingLeft: collapsed ? 0 : scaledSidebarPad,
                    borderRight: regions.header.zones.sidebar?.borderRight?.enabled ? `1px solid ${COLORS.border}` : "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: collapsed ? "center" : "flex-start",
                    transition: "width 0.2s ease",
                    ...(debugLines ? { outline: `1px dashed #e89c2860`, outlineOffset: -1 } : {}),
                  }}>
                    {/* Logo in header sidebar-zone */}
                    {layout.structure?.logo?.position === "header" && (
                      <span style={{ fontSize: collapsed ? 12 : 10, fontWeight: 700, color: regionColors.header.text, fontFamily: "'JetBrains Mono', monospace" }}>
                        {collapsed
                          ? (layout.structure.logo.text || "A").charAt(0)
                          : layout.structure.logo.type === "icon-text"
                            ? `${layout.structure.logo.icon || "⬡"} ${layout.structure.logo.text || "App"}`
                            : layout.structure.logo.text || "App"}
                      </span>
                    )}
                    {/* Debug: zone label */}
                    {debugLines && (
                      <span style={{ position: "absolute", top: 2, left: 2, fontSize: 7, color: "#e89c28", fontFamily: "monospace", opacity: 0.8 }}>sidebar-zone</span>
                    )}
                  </div>

                  {/* Content Zone — flex:1 */}
                  <div style={{
                    flex: 1,
                    paddingLeft: scaledMainPad,
                    paddingRight: scaledMainPad,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    minWidth: 0,
                    ...(debugLines ? { outline: `1px dashed #4ade8060`, outlineOffset: -1 } : {}),
                  }}>
                    {/* Debug: zone label */}
                    {debugLines && (
                      <span style={{ position: "absolute", top: 2, fontSize: 7, color: "#4ade80", fontFamily: "monospace", opacity: 0.8 }}>content-zone</span>
                    )}
                    {/* Debug: main-pad guide */}
                    {debugLines && (
                      <div style={{ position: "absolute", top: 0, left: scaledMainPad, bottom: 0, width: 1, background: "#4ade80", opacity: 0.5, zIndex: 10 }} />
                    )}

                    {/* Breadcrumbs */}
                    {layout.structure?.breadcrumbs?.enabled && layout.structure.breadcrumbs.position === "header" && (
                      <div style={{ fontSize: 9, color: regionColors.header.text, opacity: 0.7, fontFamily: "'JetBrains Mono', monospace" }}>
                        {layout.structure.breadcrumbs.showHome !== false ? (layout.structure.breadcrumbs.homeLabel || "Home") : ""}
                        {layout.structure.breadcrumbs.showHome !== false ? ` ${layout.structure.breadcrumbs.separator || "/"} ` : ""}
                        Page
                      </div>
                    )}

                    <div style={{ flex: 1 }} />

                    {/* Header elements */}
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
                </>
              ) : (
                /* Flat header — legacy mode */
                <>
                  {renderPadding(regions.header, "header")}
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, padding: 8 }}>
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
                    {layout.structure?.breadcrumbs?.enabled && layout.structure.breadcrumbs.position === "header" && (
                      <div style={{ fontSize: 9, color: regionColors.header.text, opacity: 0.7, fontFamily: "'JetBrains Mono', monospace" }}>
                        {layout.structure.breadcrumbs.showHome !== false ? (layout.structure.breadcrumbs.homeLabel || "Home") : ""}
                        {layout.structure.breadcrumbs.showHome !== false ? ` ${layout.structure.breadcrumbs.separator || "/"} ` : ""}
                        Page
                      </div>
                    )}
                    <div style={{ flex: 1 }} />
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
                </>
              )}
            </div>
          )}

          {/* Main */}
          {regions.main?.enabled && (
            <div style={{
              flex: 1,
              background: regionColors.main.bg,
              padding: 8,
              paddingLeft: hasZones ? scaledMainPad : 8,
              paddingRight: hasZones ? scaledMainPad : 8,
              position: "relative",
              overflow: "auto",
              ...(debugLines ? { outline: `1px solid #fbbf2460` } : {}),
            }}>
              {/* Debug: main-pad guide */}
              {debugLines && hasZones && (
                <div style={{ position: "absolute", top: 0, left: scaledMainPad, bottom: 0, width: 1, background: "#4ade80", opacity: 0.4, zIndex: 10 }} />
              )}
              {!hasZones && renderPadding(regions.main, "main")}
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
              paddingLeft: hasZones ? scaledMainPad : 8,
              paddingRight: hasZones ? scaledMainPad : 8,
              position: "relative",
              flexShrink: 0,
            }}>
              {!hasZones && renderPadding(regions.footer, "footer")}
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

      {/* Alignment info */}
      {hasZones && (
        <div style={{ marginTop: 10, display: "flex", gap: 12, fontSize: 10, color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace" }}>
          <span><span style={{ color: "#e89c28" }}>■</span> sidebar-pad: {tokens?.sizing?.["sidebar-pad"]?.value ?? "?"}px</span>
          <span><span style={{ color: "#4ade80" }}>■</span> main-pad: {tokens?.sizing?.["main-pad"]?.value ?? "?"}px</span>
          <span><span style={{ color: regionColors.sidebar.text }}>■</span> sidebar-w: {currentSidebarW}px{collapsed ? " (collapsed)" : ""}</span>
        </div>
      )}

      {/* Token summary */}
      <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {Object.entries(layout.tokens.spacing || {}).map(([key, tok]: [string, any]) => (
          <div key={`sp-${key}`} style={{ ...s.tag, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>
            <span style={{ color: COLORS.accent }}>spacing.</span>{key}: {tok.value}{tok.unit}
          </div>
        ))}
        {Object.entries(layout.tokens.sizing || {}).map(([key, tok]: [string, any]) => (
          <div key={`sz-${key}`} style={{ ...s.tag, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>
            <span style={{ color: COLORS.success }}>sizing.</span>{key}: {tok.value}{tok.unit}
          </div>
        ))}
      </div>
    </div>
  );
}
