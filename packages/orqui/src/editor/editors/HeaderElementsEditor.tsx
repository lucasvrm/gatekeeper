import React, { useState } from "react";
import { COLORS, s } from "../lib/constants";
import { Field, Row, Section } from "../components/shared";
import { LucideIconSelect, LucideSvg } from "../components/LucideIcons";

export const HEADER_ICON_OPTIONS = ["bell", "settings", "user", "mail", "help", "moon", "sun", "menu", "search", "grid", "download", "share", "server"];
export const HEADER_ICON_LUCIDE: Record<string, string> = {
  bell: "Bell",
  settings: "Settings",
  user: "User",
  mail: "Mail",
  help: "HelpCircle",
  moon: "Moon",
  sun: "Sun",
  menu: "Menu",
  search: "Search",
  grid: "LayoutGrid",
  download: "Download",
  share: "Share2",
  server: "Server",
};
export const HEADER_ICON_MAP = {
  bell: "🔔", settings: "⚙️", user: "👤", mail: "✉️", help: "❓", moon: "🌙",
  sun: "☀️", menu: "☰", search: "🔍", grid: "⊞", download: "⬇", share: "↗", server: "🖥",
};

// ============================================================================
// Header Elements Editor
// ============================================================================
export function HeaderElementsEditor({ elements, onChange, textStyles }) {
  const cfg = elements || {
    search: { enabled: false, placeholder: "Buscar...", showIcon: true, icon: "lucide:search" },
    cta: { enabled: false, label: "Novo", variant: "default" },
    ctas: [],
    icons: { enabled: true, items: [{ id: "bell", route: "/notifications" }, { id: "settings", route: "/settings" }] },
    order: ["search", "icons", "ctas"],
  };
  const update = (key, field, val) => onChange({ ...cfg, [key]: { ...cfg[key], [field]: val } });
  const updateRoot = (field, val) => onChange({ ...cfg, [field]: val });
  const updateTypography = (field, val) => {
    const typo = { ...(cfg.typography || {}) };
    if (!val) delete typo[field];
    else typo[field] = val;
    updateRoot("typography", typo);
  };
  const textStyleNames = textStyles ? Object.keys(textStyles) : [];

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
      // Extract icon name from lucide: or ph: prefix (backwards compat)
      const iconValue = cfg.search?.icon || "lucide:search";
      const searchIcon = iconValue.replace(/^(lucide:|ph:)/, "") || "Search";
      return (
        <div key="search" style={{ display: "flex", alignItems: "center", gap: 6, background: COLORS.surface3, borderRadius: 6, padding: "4px 10px", border: `1px solid ${COLORS.border}` }}>
          {(cfg.search.showIcon !== false) && <LucideSvg name={searchIcon} size={12} color={COLORS.textDim} />}
          <span style={{ fontSize: 12, color: COLORS.textDim }}>{cfg.search.placeholder || "Buscar..."}</span>
        </div>
      );
    }
    if (key === "icons" && cfg.icons?.enabled) {
      return iconItems.map(ic => (
        <span key={ic.id} style={{ display: "inline-flex", opacity: 0.7 }} title={ic.route || ic.id}>
          <LucideSvg name={HEADER_ICON_LUCIDE[ic.id] || ic.id} size={16} color={COLORS.textMuted} />
        </span>
      ));
    }
    if (key.startsWith("cta:")) {
      const ctaId = key.slice(4);
      const cta = ctas.find(c => c.id === ctaId);
      if (!cta) return null;
      const vs = CTA_VARIANT_STYLES[cta.variant || "default"] || CTA_VARIANT_STYLES.default;
      // Extract icon name from lucide: or ph: prefix (backwards compat)
      const ctaIcon = cta.icon ? cta.icon.replace(/^(lucide:|ph:)/, "") : undefined;
      return (
        <button key={cta.id} style={{
          fontSize: 11, padding: "5px 14px", borderRadius: 6, cursor: "default", fontWeight: 500,
          background: vs.bg, color: vs.color, border: vs.border || "none",
          display: "inline-flex", alignItems: "center", gap: 4,
        }}>
          {ctaIcon && <LucideSvg name={ctaIcon} size={12} />}
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

      {/* Typography */}
      {textStyleNames.length > 0 && (
        <Section title="🅰 Tipografia" defaultOpen={false} id="header-typography">
          <Field label="Text Style">
            <select
              value={cfg.typography?.textStyle || ""}
              onChange={(e) => updateTypography("textStyle", e.target.value)}
              style={s.select}
            >
              <option value="">— Nenhum (usar inline) —</option>
              {textStyleNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </Field>
        </Section>
      )}

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
                <LucideIconSelect
                  value={cfg.search?.icon || "lucide:search"}
                  onChange={(val) => update("search", "icon", val || "lucide:search")}
                  placeholder="search"
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
            <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 8 }}>Clique para adicionar/remover ícones (Lucide):</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
              {HEADER_ICON_OPTIONS.map(icId => {
                const active = iconItems.some(i => i.id === icId);
                const iconName = HEADER_ICON_LUCIDE[icId] || icId;
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
                    <LucideSvg name={iconName} size={14} color={active ? COLORS.accent : COLORS.textMuted} />
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
                  <LucideSvg name={HEADER_ICON_LUCIDE[ic.id] || ic.id} size={16} color={COLORS.textMuted} />
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
            <LucideSvg name="plus" size={12} /> Adicionar CTA
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
                  <LucideIconSelect
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
                  {cta.icon && <LucideSvg name={cta.icon.replace(/^(lucide:|ph:)/, "")} size={12} />}
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

