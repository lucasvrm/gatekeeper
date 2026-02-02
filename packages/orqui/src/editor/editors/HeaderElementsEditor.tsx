import React, { useState } from "react";
import { COLORS, s } from "../lib/constants";
import { Field, Row, Section } from "../components/shared";
import { PhosphorIconSelect, getPhosphorPath } from "../components/PhosphorIcons";

export const HEADER_ICON_OPTIONS = ["bell", "settings", "user", "mail", "help", "moon", "sun", "menu", "search", "grid", "download", "share", "server"];
export const HEADER_ICON_PHOSPHOR: Record<string, string> = {
  bell: "bell", settings: "gear", user: "user", mail: "envelope", help: "question", moon: "moon",
  sun: "sun", menu: "list", search: "magnifying-glass", grid: "squares-four", download: "arrow-square-down", share: "share-network", server: "hard-drives",
};
export const HEADER_ICON_MAP = {
  bell: "🔔", settings: "⚙️", user: "👤", mail: "✉️", help: "❓", moon: "🌙",
  sun: "☀️", menu: "☰", search: "🔍", grid: "⊞", download: "⬇", share: "↗", server: "🖥",
};


export function MiniPhosphorIcon({ name, size = 16, color = "currentColor" }: { name: string; size?: number; color?: string }) {
  const PATHS: Record<string, string> = {
    "bell": "M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216ZM48,184c7.7-13.24,16-43.92,16-80a64,64,0,1,1,128,0c0,36.05,8.28,66.73,16,80Z",
    "gear": "M128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Zm88-29.84q.06-2.16,0-4.32l14.92-18.64a8,8,0,0,0,1.48-7.06,107.21,107.21,0,0,0-10.88-26.25,8,8,0,0,0-6-3.93l-23.72-2.64q-1.48-1.56-3-3L186,40.54a8,8,0,0,0-3.94-6,107.71,107.71,0,0,0-26.25-10.87,8,8,0,0,0-7.06,1.49L130.16,40Q128,40,125.84,40L107.2,25.11a8,8,0,0,0-7.06-1.48A107.6,107.6,0,0,0,73.89,34.51a8,8,0,0,0-3.93,6L67.32,64.27q-1.56,1.49-3,3L40.54,70a8,8,0,0,0-6,3.94,107.71,107.71,0,0,0-10.87,26.25,8,8,0,0,0,1.49,7.06L40,125.84Q40,128,40,130.16L25.11,148.8a8,8,0,0,0-1.48,7.06,107.21,107.21,0,0,0,10.88,26.25,8,8,0,0,0,6,3.93l23.72,2.64q1.49,1.56,3,3L70,215.46a8,8,0,0,0,3.94,6,107.71,107.71,0,0,0,26.25,10.87,8,8,0,0,0,7.06-1.49L125.84,216q2.16.06,4.32,0l18.64,14.92a8,8,0,0,0,7.06,1.48,107.21,107.21,0,0,0,26.25-10.88,8,8,0,0,0,3.93-6l2.64-23.72q1.56-1.48,3-3L215.46,186a8,8,0,0,0,6-3.94,107.71,107.71,0,0,0,10.87-26.25,8,8,0,0,0-1.49-7.06ZM199.87,123.66Z",
    "user": "M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,1,0,13.85,8c18.84-32.56,52.14-52,89.07-52s70.23,19.44,89.07,52a8,8,0,1,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z",
    "envelope": "M224,48H32a8,8,0,0,0-8,8V192a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A8,8,0,0,0,224,48Zm-96,85.15L52.57,64H203.43ZM98.71,128,40,181.81V74.19Zm11.84,10.85,12,11.05a8,8,0,0,0,10.82,0l12-11.05,58,53.15H52.57ZM157.29,128,216,74.18V181.82Z",
    "question": "M140,180a12,12,0,1,1-12-12A12,12,0,0,1,140,180ZM128,72c-22.06,0-40,16.15-40,36v4a8,8,0,0,0,16,0v-4c0-11,10.77-20,24-20s24,9,24,20-10.77,20-24,20a8,8,0,0,0-8,8v8a8,8,0,0,0,16,0v-.72c18.24-3.35,32-17.9,32-35.28C168,88.15,150.06,72,128,72Zm104,56A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z",
    "moon": "M233.54,142.23a8,8,0,0,0-8-2,88.08,88.08,0,0,1-109.8-109.8,8,8,0,0,0-10-10,104.84,104.84,0,0,0-52.91,37A104,104,0,0,0,136,224a103.09,103.09,0,0,0,62.52-20.88,104.84,104.84,0,0,0,37-52.91A8,8,0,0,0,233.54,142.23Z",
    "sun": "M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm72,88a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,128Zm-16,0a48,48,0,1,0-48,48A48.05,48.05,0,0,0,176,128Z",
    "list": "M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM40,72H216a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16ZM216,184H40a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Z",
    "magnifying-glass": "M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z",
    "squares-four": "M104,40H56A16,16,0,0,0,40,56v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,104,40Zm0,64H56V56h48Z",
    "arrow-square-down": "M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32Zm0,176H48V48H208V208Z",
    "share-network": "M176,160a39.89,39.89,0,0,0-28.62,12.09l-46.1-29.63a39.8,39.8,0,0,0,0-28.92l46.1-29.63a40,40,0,1,0-8.66-13.45l-46.1,29.63a40,40,0,1,0,0,55.82l46.1,29.63A40,40,0,1,0,176,160Z",
    "plus": "M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z",
    "hard-drives": "M208,136H48a16,16,0,0,0-16,16v40a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V152A16,16,0,0,0,208,136Zm0,56H48V152H208v40Zm0-160H48A16,16,0,0,0,32,48V88a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32Zm0,56H48V48H208V88ZM188,172a12,12,0,1,1-12-12A12,12,0,0,1,188,172Zm-40,0a12,12,0,1,1-12-12A12,12,0,0,1,148,172ZM188,68a12,12,0,1,1-12-12A12,12,0,0,1,188,68Zm-40,0a12,12,0,1,1-12-12A12,12,0,0,1,148,68Z",
  };
  const d = PATHS[name];
  if (!d) return <span style={{ fontSize: size }}>?</span>;
  return (<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 256 256" fill={color}><path d={d} /></svg>);
}


// ============================================================================
// Header Elements Editor
// ============================================================================
export function HeaderElementsEditor({ elements, onChange }) {
  const cfg = elements || {
    search: { enabled: false, placeholder: "Buscar...", showIcon: true, icon: "ph:magnifying-glass" },
    cta: { enabled: false, label: "Novo", variant: "default" },
    ctas: [],
    icons: { enabled: true, items: [{ id: "bell", route: "/notifications" }, { id: "settings", route: "/settings" }] },
    order: ["search", "icons", "ctas"],
  };
  const update = (key, field, val) => onChange({ ...cfg, [key]: { ...cfg[key], [field]: val } });
  const updateRoot = (field, val) => onChange({ ...cfg, [field]: val });

  // Normalize icons
  const normalizeIcons = (items) => {
    if (!items) return [];
    return items.map(it => typeof it === "string" ? { id: it, route: "" } : it);
  };
  const iconItems = normalizeIcons(cfg.icons?.items);
  const updateIconItems = (newItems) => update("icons", "items", newItems);

  // Multi-CTA helpers
  const ctas = cfg.ctas || [];
  const addCta = () => {
    const newCta = { id: `cta-${Date.now()}`, label: "Ação", variant: "default", route: "" };
    const newCtas = [...ctas, newCta];
    // Add individual CTA entry to order
    const curOrder = cfg.order || ["search", "icons"];
    const newOrder = [...curOrder, `cta:${newCta.id}`];
    onChange({ ...cfg, ctas: newCtas, order: newOrder });
  };
  const removeCta = (id) => {
    const newCtas = ctas.filter(c => c.id !== id);
    // Remove from order
    const curOrder = cfg.order || ["search", "icons"];
    const newOrder = curOrder.filter(k => k !== `cta:${id}`);
    onChange({ ...cfg, ctas: newCtas, order: newOrder });
  };
  const updateCta = (id, field, val) => updateRoot("ctas", ctas.map(c => c.id === id ? { ...c, [field]: val } : c));

  // Order — expand legacy "ctas" group into individual cta: entries
  const expandOrder = (rawOrder: string[]): string[] => {
    const result: string[] = [];
    for (const key of rawOrder) {
      if (key === "ctas") {
        // Legacy grouped → expand to individual
        for (const c of ctas) result.push(`cta:${c.id}`);
      } else {
        result.push(key);
      }
    }
    // Ensure any CTA not in order gets appended
    for (const c of ctas) {
      if (!result.includes(`cta:${c.id}`)) result.push(`cta:${c.id}`);
    }
    return result;
  };
  const order = expandOrder(cfg.order || ["search", "icons", "ctas"]);
  const moveOrder = (idx, dir) => {
    const newOrder = [...order];
    const target = idx + dir;
    if (target < 0 || target >= newOrder.length) return;
    [newOrder[idx], newOrder[target]] = [newOrder[target], newOrder[idx]];
    updateRoot("order", newOrder);
  };

  const getOrderLabel = (key: string) => {
    if (key === "search") return "🔍 Pesquisa";
    if (key === "icons") return "🔔 Ícones";
    if (key.startsWith("cta:")) {
      const ctaId = key.slice(4);
      const cta = ctas.find(c => c.id === ctaId);
      return `🎯 CTA: ${cta?.label || ctaId}`;
    }
    return key;
  };

  // CTA variant style map for preview
  const CTA_VARIANT_STYLES = {
    default: { bg: COLORS.accent, color: "#fff", border: "none" },
    destructive: { bg: "#ef4444", color: "#fff", border: "none" },
    outline: { bg: "transparent", color: COLORS.text, border: `1px solid ${COLORS.border}` },
    secondary: { bg: COLORS.surface3, color: COLORS.text, border: "none" },
    ghost: { bg: "transparent", color: COLORS.textMuted, border: "none" },
  };

  // Preview
  const renderPreviewElement = (key) => {
    if (key === "search" && cfg.search?.enabled) {
      const searchPhosphor = HEADER_ICON_PHOSPHOR[cfg.search?.icon?.replace("ph:", "")] || cfg.search?.icon?.replace("ph:", "") || "magnifying-glass";
      return (
        <div key="search" style={{ display: "flex", alignItems: "center", gap: 6, background: COLORS.surface3, borderRadius: 6, padding: "4px 10px", border: `1px solid ${COLORS.border}` }}>
          {(cfg.search.showIcon !== false) && <MiniPhosphorIcon name={searchPhosphor} size={12} color={COLORS.textDim} />}
          <span style={{ fontSize: 12, color: COLORS.textDim }}>{cfg.search.placeholder || "Buscar..."}</span>
        </div>
      );
    }
    if (key === "icons" && cfg.icons?.enabled) {
      return iconItems.map(ic => (
        <span key={ic.id} style={{ display: "inline-flex", opacity: 0.7 }} title={ic.route || ic.id}>
          <MiniPhosphorIcon name={HEADER_ICON_PHOSPHOR[ic.id] || ic.id} size={16} color={COLORS.textMuted} />
        </span>
      ));
    }
    if (key.startsWith("cta:")) {
      const ctaId = key.slice(4);
      const cta = ctas.find(c => c.id === ctaId);
      if (!cta) return null;
      const vs = CTA_VARIANT_STYLES[cta.variant || "default"] || CTA_VARIANT_STYLES.default;
      const phIcon = cta.icon?.startsWith("ph:") ? cta.icon.slice(3) : undefined;
      return (
        <button key={cta.id} style={{
          fontSize: 11, padding: "5px 14px", borderRadius: 6, cursor: "default", fontWeight: 500,
          background: vs.bg, color: vs.color, border: vs.border || "none",
          display: "inline-flex", alignItems: "center", gap: 4,
        }}>
          {phIcon && <MiniPhosphorIcon name={phIcon} size={12} />}
          {cta.label}
        </button>
      );
    }
    return null;
  };

  const renderPreview = () => (
    <div style={{
      background: COLORS.surface2, borderRadius: 8, padding: "10px 16px", marginBottom: 16,
      display: "flex", alignItems: "center", gap: 12, border: `1px solid ${COLORS.border}`,
      minHeight: 44,
    }}>
      <span style={{ fontSize: 12, color: COLORS.textDim, flex: "0 0 auto" }}>Header →</span>
      <div style={{ flex: 1 }} />
      {order.map(key => <React.Fragment key={key}>{renderPreviewElement(key)}</React.Fragment>)}
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, margin: 0, marginBottom: 4 }}>Header Elements</h3>
        <p style={{ fontSize: 12, color: COLORS.textDim, margin: 0 }}>Configure quais elementos aparecem no header e sua ordem</p>
      </div>

      {renderPreview()}

      {/* Order */}
      <Section title="📐 Ordem dos Elementos" defaultOpen={true} id="header-order">
        <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 8 }}>Reordene os elementos do header individualmente:</div>
        {order.map((key, idx) => {
          const isCta = key.startsWith("cta:");
          const ctaObj = isCta ? ctas.find(c => c.id === key.slice(4)) : null;
          return (
            <div key={key} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
              background: isCta ? `${COLORS.accent}11` : COLORS.surface3, borderRadius: 6, marginBottom: 4,
              border: `1px solid ${isCta ? COLORS.accent + "33" : COLORS.border}`,
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <button onClick={() => moveOrder(idx, -1)} disabled={idx === 0} style={{ ...s.btnSmall, padding: "1px 4px", fontSize: 10, opacity: idx === 0 ? 0.3 : 1 }}>▲</button>
                <button onClick={() => moveOrder(idx, 1)} disabled={idx === order.length - 1} style={{ ...s.btnSmall, padding: "1px 4px", fontSize: 10, opacity: idx === order.length - 1 ? 0.3 : 1 }}>▼</button>
              </div>
              <span style={{ fontSize: 12, color: COLORS.text, fontWeight: 500, flex: 1 }}>{getOrderLabel(key)}</span>
              {ctaObj && (
                <span style={{ fontSize: 10, color: COLORS.textDim, background: COLORS.surface3, padding: "1px 6px", borderRadius: 3 }}>{ctaObj.variant || "default"}</span>
              )}
              <span style={{ fontSize: 10, color: COLORS.textDim, fontFamily: "monospace" }}>{key}</span>
            </div>
          );
        })}
        {ctas.length === 0 && (
          <div style={{ fontSize: 11, color: COLORS.textDim, padding: 8, textAlign: "center" }}>
            Adicione CTAs na seção abaixo — cada um aparecerá aqui individualmente.
          </div>
        )}
      </Section>

      {/* Search */}
      <Section title="🔍 Pesquisa" defaultOpen={cfg.search?.enabled} id="header-search">
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: COLORS.textMuted, cursor: "pointer", marginBottom: 10 }}>
          <input type="checkbox" checked={cfg.search?.enabled ?? false} onChange={(e) => update("search", "enabled", e.target.checked)} />
          Habilitar campo de pesquisa
        </label>
        {cfg.search?.enabled && (
          <>
            <Field label="Placeholder">
              <input value={cfg.search?.placeholder || ""} onChange={(e) => update("search", "placeholder", e.target.value)} style={s.input} />
            </Field>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: COLORS.textMuted, cursor: "pointer", marginBottom: 10 }}>
              <input type="checkbox" checked={cfg.search?.showIcon !== false} onChange={(e) => update("search", "showIcon", e.target.checked)} />
              Mostrar ícone na caixa de pesquisa
            </label>
            {(cfg.search?.showIcon !== false) && (
              <Field label="Ícone da pesquisa">
                <PhosphorIconSelect
                  value={cfg.search?.icon || "ph:magnifying-glass"}
                  onChange={(val) => update("search", "icon", val || "ph:magnifying-glass")}
                  placeholder="magnifying-glass"
                />
              </Field>
            )}
          </>
        )}
      </Section>

      {/* Icons */}
      <Section title="🔔 Ícones de Ação" defaultOpen={cfg.icons?.enabled} id="header-icons">
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: COLORS.textMuted, cursor: "pointer", marginBottom: 10 }}>
          <input type="checkbox" checked={cfg.icons?.enabled ?? false} onChange={(e) => update("icons", "enabled", e.target.checked)} />
          Habilitar ícones no header
        </label>
        {cfg.icons?.enabled && (
          <div>
            <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 8 }}>Clique para adicionar/remover ícones (Phosphor):</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
              {HEADER_ICON_OPTIONS.map(icId => {
                const active = iconItems.some(i => i.id === icId);
                const phName = HEADER_ICON_PHOSPHOR[icId] || icId;
                return (
                  <button key={icId} onClick={() => {
                    if (active) updateIconItems(iconItems.filter(i => i.id !== icId));
                    else updateIconItems([...iconItems, { id: icId, route: `/${icId}` }]);
                  }} style={{
                    ...s.btnSmall, padding: "6px 8px", display: "inline-flex", alignItems: "center", gap: 4,
                    background: active ? COLORS.accent + "20" : COLORS.surface3,
                    border: active ? `1px solid ${COLORS.accent}50` : `1px solid ${COLORS.border}`,
                    opacity: active ? 1 : 0.5,
                  }} title={icId}>
                    <MiniPhosphorIcon name={phName} size={14} color={active ? COLORS.accent : COLORS.textMuted} />
                    <span style={{ fontSize: 10, color: COLORS.textDim }}>{icId}</span>
                  </button>
                );
              })}
            </div>
            {/* Routes for each icon */}
            {iconItems.length > 0 && (
              <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, marginBottom: 8 }}>Rotas dos ícones</div>
            )}
            {iconItems.map((ic, idx) => (
              <Row key={ic.id} gap={8} style={{ marginBottom: 4 }}>
                <span style={{ display: "inline-flex", width: 24, justifyContent: "center" }}>
                  <MiniPhosphorIcon name={HEADER_ICON_PHOSPHOR[ic.id] || ic.id} size={16} color={COLORS.textMuted} />
                </span>
                <span style={{ fontSize: 12, color: COLORS.textMuted, width: 70 }}>{ic.id}</span>
                <input
                  value={ic.route || ""}
                  onChange={(e) => {
                    const updated = [...iconItems];
                    updated[idx] = { ...ic, route: e.target.value };
                    updateIconItems(updated);
                  }}
                  style={{ ...s.input, flex: 1, fontFamily: "monospace", fontSize: 12 }}
                  placeholder={`/${ic.id}`}
                />
              </Row>
            ))}
          </div>
        )}
      </Section>

      {/* CTAs (Multi) */}
      <Section title="🎯 CTAs (Call to Action)" defaultOpen={cfg.cta?.enabled || ctas.length > 0} id="header-cta">
        {/* Legacy single CTA migration hint */}
        {cfg.cta?.enabled && ctas.length === 0 && (
          <div style={{ padding: 8, background: COLORS.surface3, borderRadius: 6, marginBottom: 10, fontSize: 11, color: COLORS.textDim }}>
            CTA legado detectado. <button onClick={() => {
              const legacy = { id: `cta-${Date.now()}`, label: cfg.cta?.label || "Novo", variant: cfg.cta?.variant || "default", route: cfg.cta?.route || "" };
              onChange({ ...cfg, ctas: [legacy], cta: { ...cfg.cta, enabled: false } });
            }} style={{ ...s.btnSmall, fontSize: 11, color: COLORS.accent }}>Migrar para multi-CTA →</button>
          </div>
        )}

        <div style={{ marginBottom: 10 }}>
          <button onClick={addCta} style={{ ...s.btnSmall, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <MiniPhosphorIcon name="plus" size={12} /> Adicionar CTA
          </button>
        </div>

        {ctas.map((cta, idx) => {
          const vs = CTA_VARIANT_STYLES[cta.variant || "default"] || CTA_VARIANT_STYLES.default;
          return (
            <div key={cta.id} style={{ padding: 10, background: COLORS.surface2, borderRadius: 6, marginBottom: 8, border: `1px solid ${COLORS.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.text }}>CTA #{idx + 1}</span>
                <button onClick={() => removeCta(cta.id)} style={{ ...s.btnSmall, fontSize: 10, color: COLORS.danger }}>✕ Remover</button>
              </div>
              <Row gap={8}>
                <Field label="Label" style={{ flex: 1 }}>
                  <input value={cta.label || ""} onChange={(e) => updateCta(cta.id, "label", e.target.value)} style={s.input} />
                </Field>
                <Field label="Variant" style={{ width: 120 }}>
                  <select value={cta.variant || "default"} onChange={(e) => updateCta(cta.id, "variant", e.target.value)} style={s.select}>
                    {["default", "destructive", "outline", "secondary", "ghost"].map(v => <option key={v}>{v}</option>)}
                  </select>
                </Field>
              </Row>
              <Row gap={8}>
                <Field label="Rota (link)" style={{ flex: 1 }}>
                  <input value={cta.route || ""} onChange={(e) => updateCta(cta.id, "route", e.target.value)} style={{ ...s.input, fontFamily: "monospace" }} placeholder="/nova-acao" />
                </Field>
                <Field label="Ícone" style={{ width: 150 }}>
                  <PhosphorIconSelect
                    value={cta.icon || ""}
                    allowEmpty
                    placeholder="Nenhum"
                    onChange={(val) => updateCta(cta.id, "icon", val)}
                  />
                </Field>
              </Row>
              {/* Preview */}
              <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                <span style={{ fontSize: 11, color: COLORS.textDim }}>Preview:</span>
                <button style={{
                  fontSize: 11, padding: "4px 12px", borderRadius: 6, cursor: "default", fontWeight: 500,
                  background: vs.bg, color: vs.color, border: vs.border || "none",
                  display: "inline-flex", alignItems: "center", gap: 4,
                }}>
                  {cta.icon?.startsWith("ph:") && <MiniPhosphorIcon name={cta.icon.slice(3)} size={12} />}
                  {cta.label || "CTA"}
                </button>
              </div>
            </div>
          );
        })}

        {/* Legacy single CTA (backward compat) */}
        {cfg.cta?.enabled && ctas.length === 0 && (
          <>
            <Row gap={8}>
              <Field label="Label" style={{ flex: 1 }}>
                <input value={cfg.cta?.label || ""} onChange={(e) => update("cta", "label", e.target.value)} style={s.input} />
              </Field>
              <Field label="Variant" style={{ width: 140 }}>
                <select value={cfg.cta?.variant || "default"} onChange={(e) => update("cta", "variant", e.target.value)} style={s.select}>
                  {["default", "destructive", "outline", "secondary", "ghost"].map(v => <option key={v}>{v}</option>)}
                </select>
              </Field>
            </Row>
            <Field label="Rota (link)">
              <input value={cfg.cta?.route || ""} onChange={(e) => update("cta", "route", e.target.value)} style={{ ...s.input, fontFamily: "monospace" }} placeholder="/nova-validacao" />
            </Field>
          </>
        )}
      </Section>
    </div>
  );
}

