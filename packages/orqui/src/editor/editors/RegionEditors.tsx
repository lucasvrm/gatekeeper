import React, { useState } from "react";
import { COLORS, s, SPACING_PRESETS } from "../lib/constants";
import { resolveToken, resolveTokenNum } from "../lib/utils";
import { Field, Row, Section, WBSub, EmptyState, ColorInput } from "../components/shared";
import { TokenRefSelect } from "./ColorTokenEditor";
import { PhosphorIconSelect } from "../components/PhosphorIcons";
import { SeparatorEditor } from "./ContentLayoutEditor";

// ============================================================================
// Container Editor
// ============================================================================
export function ContainerEditor({ containers, onChange, isHeader = false }) {
  const add = () => {
    onChange([...containers, { name: `container${containers.length}`, description: "", order: containers.length, padding: { top: "$tokens.spacing.xs", right: "$tokens.spacing.xs", bottom: "$tokens.spacing.xs", left: "$tokens.spacing.xs" }, ...(isHeader ? { zone: "content" } : {}) }]);
  };
  const update = (i, field, val) => {
    const updated = [...containers];
    updated[i] = { ...updated[i], [field]: field === "order" ? Number(val) : val };
    onChange(updated);
  };
  const updatePad = (i, side, val) => {
    const updated = [...containers];
    updated[i] = { ...updated[i], padding: { ...(updated[i].padding || {}), [side]: val } };
    onChange(updated);
  };
  const remove = (i) => onChange(containers.filter((_, idx) => idx !== i));
  const [expandedPadding, setExpandedPadding] = useState<number | null>(null);

  return (
    <div>
      {containers.map((c, i) => (
        <div key={i} style={{ marginBottom: 8, padding: 8, background: COLORS.surface2, borderRadius: 6 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input value={c.name} onChange={(e) => update(i, "name", e.target.value)} style={{ ...s.input, width: 120, fontWeight: 600 }} placeholder="name" />
            <input value={c.description} onChange={(e) => update(i, "description", e.target.value)} style={{ ...s.input, flex: 1 }} placeholder="descrição" />
            <input type="number" value={c.order} onChange={(e) => update(i, "order", e.target.value)} style={{ ...s.input, width: 50 }} />
            {isHeader && (
              <select value={c.zone || "content"} onChange={(e) => update(i, "zone", e.target.value)} style={{ ...s.select, width: 100, fontSize: 11 }} title="Header zone">
                <option value="sidebar">Sidebar Zone</option>
                <option value="content">Content Zone</option>
              </select>
            )}
            <button onClick={() => setExpandedPadding(expandedPadding === i ? null : i)} style={{ ...s.btnSmall, fontSize: 10 }} title="Padding">⊞</button>
            <button onClick={() => remove(i)} style={s.btnDanger}>✕</button>
          </div>
          {expandedPadding === i && (
            <div style={{ marginTop: 8, display: "flex", gap: 6, paddingLeft: 4 }}>
              {["top", "right", "bottom", "left"].map(side => (
                <div key={side} style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: COLORS.textDim, textTransform: "uppercase", marginBottom: 2 }}>{side}</div>
                  <select value={c.padding?.[side] || ""} onChange={(e) => updatePad(i, side, e.target.value)} style={{ ...s.select, fontSize: 10, padding: "2px 4px" }}>
                    <option value="">—</option>
                    {Object.keys(SPACING_PRESETS).map(k => <option key={k} value={`$tokens.spacing.${k}`}>{k}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      <button onClick={add} style={s.btnSmall}>+ Container</button>
    </div>
  );
}


// ============================================================================
// Header Zone Editor — manages the two-zone alignment system
// ============================================================================
export function HeaderZoneEditor({ zones, tokens, onChange }) {
  const z = zones || {
    sidebar: {
      width: "$tokens.sizing.sidebar-width",
      collapsedWidth: "$tokens.sizing.sidebar-collapsed",
      paddingLeft: "$tokens.sizing.sidebar-pad",
      borderRight: { enabled: true, color: "$tokens.colors.border", width: "$tokens.borderWidth.thin" },
      contains: ["brand"],
    },
    content: {
      paddingLeft: "$tokens.sizing.main-pad",
      paddingRight: "$tokens.sizing.main-pad",
      contains: ["breadcrumb", "spacer", "actions", "userMenu"],
    },
  };

  const updateSidebar = (field, val) => onChange({ ...z, sidebar: { ...z.sidebar, [field]: val } });
  const updateContent = (field, val) => onChange({ ...z, content: { ...z.content, [field]: val } });
  const updateBorderRight = (field, val) => {
    onChange({ ...z, sidebar: { ...z.sidebar, borderRight: { ...(z.sidebar.borderRight || {}), [field]: val } } });
  };

  return (
    <div>
      <div style={s.infoBox}>
        <strong style={{ color: COLORS.text }}>Alignment Grid:</strong> O header é dividido em duas zonas rígidas.
        A <strong style={{ color: COLORS.accent }}>Sidebar Zone</strong> alinha com a sidebar (usando <code style={{ color: COLORS.accent }}>sidebar-pad</code>).
        A <strong style={{ color: COLORS.accent }}>Content Zone</strong> alinha com o conteúdo principal (usando <code style={{ color: COLORS.accent }}>main-pad</code>).
      </div>

      {/* Sidebar Zone */}
      <div style={{ marginTop: 16, marginBottom: 8, fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Sidebar Zone (logo)</div>
      <div style={{ padding: 12, background: COLORS.surface2, borderRadius: 6, marginBottom: 12 }}>
        <Row gap={8}>
          <Field label="Width" style={{ flex: 1 }}>
            <TokenRefSelect value={z.sidebar?.width} tokens={tokens} category="sizing" onChange={(v) => updateSidebar("width", v)} />
          </Field>
          <Field label="Collapsed Width" style={{ flex: 1 }}>
            <TokenRefSelect value={z.sidebar?.collapsedWidth} tokens={tokens} category="sizing" onChange={(v) => updateSidebar("collapsedWidth", v)} />
          </Field>
          <Field label="Padding Left" style={{ flex: 1 }}>
            <TokenRefSelect value={z.sidebar?.paddingLeft} tokens={tokens} category="sizing" onChange={(v) => updateSidebar("paddingLeft", v)} />
          </Field>
        </Row>
        <Row gap={8}>
          <Field label="Border Right" style={{ flex: 0, minWidth: 80 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.textMuted, cursor: "pointer", paddingTop: 4 }}>
              <input type="checkbox" checked={z.sidebar?.borderRight?.enabled ?? true} onChange={(e) => updateBorderRight("enabled", e.target.checked)} />
              Ativo
            </label>
          </Field>
          {z.sidebar?.borderRight?.enabled && (
            <Field label="Border Color" style={{ flex: 1 }}>
              <TokenRefSelect value={z.sidebar?.borderRight?.color} tokens={tokens} category="colors" onChange={(v) => updateBorderRight("color", v)} />
            </Field>
          )}
        </Row>
      </div>

      {/* Content Zone */}
      <div style={{ marginBottom: 8, fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Content Zone (breadcrumbs + actions)</div>
      <div style={{ padding: 12, background: COLORS.surface2, borderRadius: 6, marginBottom: 12 }}>
        <Row gap={8}>
          <Field label="Padding Left" style={{ flex: 1 }}>
            <TokenRefSelect value={z.content?.paddingLeft} tokens={tokens} category="sizing" onChange={(v) => updateContent("paddingLeft", v)} />
          </Field>
          <Field label="Padding Right" style={{ flex: 1 }}>
            <TokenRefSelect value={z.content?.paddingRight} tokens={tokens} category="sizing" onChange={(v) => updateContent("paddingRight", v)} />
          </Field>
        </Row>
      </div>
    </div>
  );
}


// ============================================================================
// Collapsed Tooltip Editor — mandatory tooltip config for collapsed sidebar
// ============================================================================
export function CollapsedTooltipEditor({ tooltip, tokens, onChange }) {
  const tt = tooltip || {
    mandatory: true,
    background: "$tokens.colors.surface-3",
    color: "$tokens.colors.text",
    borderColor: "$tokens.colors.border",
    borderRadius: "$tokens.borderRadius.sm",
    fontSize: "$tokens.fontSizes.xs",
    fontFamily: "$tokens.fontFamilies.mono",
    fontWeight: "$tokens.fontWeights.medium",
    padding: "5px 10px",
    shadow: "0 4px 12px rgba(0,0,0,0.4)",
    offset: "12px",
    arrow: true,
  };
  const update = (field, val) => onChange({ ...tt, [field]: val });

  return (
    <div>
      <div style={s.infoBox}>
        <strong style={{ color: COLORS.text }}>Obrigatório:</strong> Tooltip aparece automaticamente no hover
        dos itens quando a sidebar está colapsada. Não pode ser desativado — é essencial para UX.
        Customize apenas a aparência visual abaixo.
      </div>

      <Row gap={8}>
        <Field label="Background" style={{ flex: 1 }}>
          <TokenRefSelect value={tt.background} tokens={tokens} category="colors" onChange={(v) => update("background", v)} />
        </Field>
        <Field label="Text Color" style={{ flex: 1 }}>
          <TokenRefSelect value={tt.color} tokens={tokens} category="colors" onChange={(v) => update("color", v)} />
        </Field>
        <Field label="Border Color" style={{ flex: 1 }}>
          <TokenRefSelect value={tt.borderColor} tokens={tokens} category="colors" onChange={(v) => update("borderColor", v)} />
        </Field>
      </Row>
      <Row gap={8}>
        <Field label="Font Size" style={{ flex: 1 }}>
          <TokenRefSelect value={tt.fontSize} tokens={tokens} category="fontSizes" onChange={(v) => update("fontSize", v)} />
        </Field>
        <Field label="Font Family" style={{ flex: 1 }}>
          <TokenRefSelect value={tt.fontFamily} tokens={tokens} category="fontFamilies" onChange={(v) => update("fontFamily", v)} />
        </Field>
        <Field label="Font Weight" style={{ flex: 1 }}>
          <TokenRefSelect value={tt.fontWeight} tokens={tokens} category="fontWeights" onChange={(v) => update("fontWeight", v)} />
        </Field>
      </Row>
      <Row gap={8}>
        <Field label="Border Radius" style={{ flex: 1 }}>
          <TokenRefSelect value={tt.borderRadius} tokens={tokens} category="borderRadius" onChange={(v) => update("borderRadius", v)} />
        </Field>
        <Field label="Padding" style={{ flex: 1 }}>
          <input value={tt.padding || ""} onChange={(e) => update("padding", e.target.value)} style={s.input} placeholder="5px 10px" />
        </Field>
        <Field label="Offset" style={{ flex: 1 }}>
          <input value={tt.offset || ""} onChange={(e) => update("offset", e.target.value)} style={s.input} placeholder="12px" />
        </Field>
      </Row>
      <Row gap={8}>
        <Field label="Shadow" style={{ flex: 1 }}>
          <input value={tt.shadow || ""} onChange={(e) => update("shadow", e.target.value)} style={s.input} placeholder="0 4px 12px rgba(0,0,0,0.4)" />
        </Field>
        <Field label="Arrow" style={{ flex: 0, minWidth: 80 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.textMuted, cursor: "pointer", paddingTop: 4 }}>
            <input type="checkbox" checked={tt.arrow !== false} onChange={(e) => update("arrow", e.target.checked)} />
            Seta
          </label>
        </Field>
      </Row>
    </div>
  );
}


// ============================================================================
// Sidebar Config Editor
// ============================================================================
export function SidebarConfigEditor({ region, tokens, onChange }) {
  const nav = region.navigation || { icons: { enabled: true, size: "$tokens.sizing.icon-md", gap: "$tokens.spacing.sm" } };
  const navTypo = nav.typography || {};
  const behavior = region.behavior || {};
  const cb = region.collapseButton || { icon: "chevron", position: "header-end" };
  const seps = region.separators || {};
  const navItemsRaw = nav.items || [];
  // Ensure every item has an id (legacy migration)
  const navItems = navItemsRaw.map((item, i) => item.id ? item : { ...item, id: `nav-legacy-${i}` });
  if (navItemsRaw.some((item, i) => !item.id)) {
    // Auto-persist ids once
    setTimeout(() => updateNavItems(navItems), 0);
  }
  const navGroups = nav.groups || [];

  const updateNav = (field, val) => onChange({ ...region, navigation: { ...nav, icons: { ...nav.icons, [field]: val } } });
  const updateNavTypo = (field, val) => onChange({ ...region, navigation: { ...nav, typography: { ...navTypo, [field]: val } } });
  const updateNavItems = (items) => onChange({ ...region, navigation: { ...nav, items } });
  const updateNavGroups = (groups) => onChange({ ...region, navigation: { ...nav, groups } });
  const updateBehavior = (field, val) => onChange({ ...region, behavior: { ...behavior, [field]: val } });
  const updateCB = (field, val) => onChange({ ...region, collapseButton: { ...cb, [field]: val } });
  const updateSep = (name, val) => onChange({ ...region, separators: { ...seps, [name]: val } });

  // Nav item CRUD
  const addNavItem = () => {
    const id = `nav-${Date.now()}`;
    updateNavItems([...navItems, { id, icon: "ph:house", label: "Novo item", route: "/" }]);
  };
  const removeNavItem = (id) => updateNavItems(navItems.filter(i => i.id !== id));
  const updateNavItem = (id, field, val) => updateNavItems(navItems.map(i => i.id === id ? { ...i, [field]: val } : i));
  const moveNavItem = (idx, dir) => {
    const arr = [...navItems];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    updateNavItems(arr);
  };
  // Sub-items
  const addSubItem = (parentId) => {
    const subId = `sub-${Date.now()}`;
    updateNavItems(navItems.map(i => i.id === parentId ? { ...i, children: [...(i.children || []), { id: subId, label: "Sub-item", route: "" }] } : i));
  };
  const removeSubItem = (parentId, subId) => {
    updateNavItems(navItems.map(i => i.id === parentId ? { ...i, children: (i.children || []).filter(c => c.id !== subId) } : i));
  };
  const updateSubItem = (parentId, subId, field, val) => {
    updateNavItems(navItems.map(i => i.id === parentId ? {
      ...i, children: (i.children || []).map(c => c.id === subId ? { ...c, [field]: val } : c),
    } : i));
  };
  // Groups
  const addGroup = () => {
    const id = `grp-${Date.now()}`;
    updateNavGroups([...navGroups, { id, label: "Novo Grupo", collapsible: false }]);
  };
  const removeGroup = (id) => {
    updateNavGroups(navGroups.filter(g => g.id !== id));
    // Ungroup items that were in this group
    updateNavItems(navItems.map(i => i.group === id ? { ...i, group: undefined } : i));
  };
  const updateGroup = (id, field, val) => updateNavGroups(navGroups.map(g => g.id === id ? { ...g, [field]: val } : g));
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  return (
    <div>
      {/* Alignment Pad Info */}
      {region.alignmentPad && (
        <div style={{ ...s.infoBox, marginBottom: 16, marginTop: 8 }}>
          <strong style={{ color: COLORS.text }}>Alignment Pad:</strong> Todos os elementos da sidebar alinham pelo token{" "}
          <code style={{ color: COLORS.accent }}>{region.alignmentPad}</code>.
          A nav usa <code style={{ color: COLORS.accent }}>calc(sidebar-pad - 6px)</code> no container + <code style={{ color: COLORS.accent }}>6px</code> interno no item = mesmo alinhamento.
        </div>
      )}

      {/* Navigation Typography */}
      <div style={{ marginTop: 16, marginBottom: 8, fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Navigation Typography</div>
      <div style={{ padding: 12, background: COLORS.surface2, borderRadius: 6, marginBottom: 12 }}>
        <Row gap={8}>
          <Field label="Font Size" style={{ flex: 1 }}>
            <TokenRefSelect value={navTypo.fontSize || ""} tokens={tokens} category="fontSizes" onChange={(v) => updateNavTypo("fontSize", v)} />
          </Field>
          <Field label="Font Weight" style={{ flex: 1 }}>
            <TokenRefSelect value={navTypo.fontWeight || ""} tokens={tokens} category="fontWeights" onChange={(v) => updateNavTypo("fontWeight", v)} />
          </Field>
        </Row>
        <Row gap={8}>
          <Field label="Color" style={{ flex: 1 }}>
            <TokenRefSelect value={navTypo.color || ""} tokens={tokens} category="colors" onChange={(v) => updateNavTypo("color", v)} />
          </Field>
          <Field label="Font Family" style={{ flex: 1 }}>
            <TokenRefSelect value={navTypo.fontFamily || ""} tokens={tokens} category="fontFamilies" onChange={(v) => updateNavTypo("fontFamily", v)} />
          </Field>
        </Row>
        <Row gap={8}>
          <Field label="Letter Spacing" style={{ flex: 1 }}>
            <TokenRefSelect value={navTypo.letterSpacing || ""} tokens={tokens} category="letterSpacings" onChange={(v) => updateNavTypo("letterSpacing", v)} />
          </Field>
          <Field label="Line Height" style={{ flex: 1 }}>
            <TokenRefSelect value={navTypo.lineHeight || ""} tokens={tokens} category="lineHeights" onChange={(v) => updateNavTypo("lineHeight", v)} />
          </Field>
        </Row>
        <div style={{ marginTop: 8, borderTop: `1px solid ${COLORS.border}`, paddingTop: 8 }}>
          <div style={{ fontSize: 10, color: COLORS.textDim, marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>Nav Item Card</div>
          <Row gap={8}>
            <Field label="Card enabled" style={{ flex: 0, minWidth: 90 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.textMuted, cursor: "pointer", paddingTop: 4 }}>
                <input type="checkbox" checked={navTypo.cardEnabled ?? false} onChange={(e) => updateNavTypo("cardEnabled", e.target.checked)} />
                Ativo
              </label>
            </Field>
            <Field label="Border Radius" style={{ flex: 1 }}>
              <TokenRefSelect value={navTypo.cardBorderRadius || ""} tokens={tokens} category="borderRadius" onChange={(v) => updateNavTypo("cardBorderRadius", v)} />
            </Field>
            <Field label="Padding" style={{ flex: 1 }}>
              <TokenRefSelect value={navTypo.cardPadding || ""} tokens={tokens} category="spacing" onChange={(v) => updateNavTypo("cardPadding", v)} />
            </Field>
          </Row>
          {navTypo.cardEnabled && (
            <>
              <Row gap={8}>
                <Field label="Background" style={{ flex: 1 }}>
                  <TokenRefSelect value={navTypo.cardBackground || ""} tokens={tokens} category="colors" onChange={(v) => updateNavTypo("cardBackground", v)} />
                </Field>
                <Field label="Border" style={{ flex: 1 }}>
                  <TokenRefSelect value={navTypo.cardBorderColor || ""} tokens={tokens} category="colors" onChange={(v) => updateNavTypo("cardBorderColor", v)} />
                </Field>
                <Field label="Border Width" style={{ flex: 1 }}>
                  <select value={navTypo.cardBorderWidth || "0"} onChange={(e) => updateNavTypo("cardBorderWidth", e.target.value)} style={s.select}>
                    <option value="0">Nenhum</option>
                    <option value="1">1px</option>
                    <option value="2">2px</option>
                  </select>
                </Field>
              </Row>
            </>
          )}
        </div>
        <div style={{ marginTop: 8, borderTop: `1px solid ${COLORS.border}`, paddingTop: 8 }}>
          <div style={{ fontSize: 10, color: COLORS.textDim, marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>Active Item</div>
          <Row gap={8}>
            <Field label="Color" style={{ flex: 1 }}>
              <TokenRefSelect value={navTypo.activeColor || ""} tokens={tokens} category="colors" onChange={(v) => updateNavTypo("activeColor", v)} />
            </Field>
            <Field label="Weight" style={{ flex: 1 }}>
              <TokenRefSelect value={navTypo.activeFontWeight || ""} tokens={tokens} category="fontWeights" onChange={(v) => updateNavTypo("activeFontWeight", v)} />
            </Field>
            <Field label="Background" style={{ flex: 1 }}>
              <TokenRefSelect value={navTypo.activeBackground || ""} tokens={tokens} category="colors" onChange={(v) => updateNavTypo("activeBackground", v)} />
            </Field>
          </Row>
          {navTypo.cardEnabled && (
            <Row gap={8}>
              <Field label="Card Border (active)" style={{ flex: 1 }}>
                <TokenRefSelect value={navTypo.activeCardBorder || ""} tokens={tokens} category="colors" onChange={(v) => updateNavTypo("activeCardBorder", v)} />
              </Field>
            </Row>
          )}
        </div>
        <div style={{ marginTop: 8, borderTop: `1px solid ${COLORS.border}`, paddingTop: 8 }}>
          <div style={{ fontSize: 10, color: COLORS.textDim, marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>Hover</div>
          <Row gap={8}>
            <Field label="Color" style={{ flex: 1 }}>
              <TokenRefSelect value={navTypo.hoverColor || ""} tokens={tokens} category="colors" onChange={(v) => updateNavTypo("hoverColor", v)} />
            </Field>
            <Field label="Weight" style={{ flex: 1 }}>
              <TokenRefSelect value={navTypo.hoverFontWeight || ""} tokens={tokens} category="fontWeights" onChange={(v) => updateNavTypo("hoverFontWeight", v)} />
            </Field>
            <Field label="Background" style={{ flex: 1 }}>
              <TokenRefSelect value={navTypo.hoverBackground || ""} tokens={tokens} category="colors" onChange={(v) => updateNavTypo("hoverBackground", v)} />
            </Field>
          </Row>
          {navTypo.cardEnabled && (
            <Row gap={8}>
              <Field label="Card Border (hover)" style={{ flex: 1 }}>
                <TokenRefSelect value={navTypo.hoverCardBorder || ""} tokens={tokens} category="colors" onChange={(v) => updateNavTypo("hoverCardBorder", v)} />
              </Field>
            </Row>
          )}
        </div>
      </div>

      {/* Navigation Icons */}
      <div style={{ marginBottom: 8, fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Navigation Icons</div>
      <div style={{ padding: 12, background: COLORS.surface2, borderRadius: 6, marginBottom: 12 }}>
        <Row gap={16}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.textMuted, cursor: "pointer" }}>
            <input type="checkbox" checked={nav.icons?.enabled ?? true} onChange={(e) => updateNav("enabled", e.target.checked)} /> Icons enabled
          </label>
        </Row>
        {nav.icons?.enabled && (
          <Row gap={8}>
            <Field label="Icon Size" style={{ flex: 1 }}>
              <TokenRefSelect value={nav.icons.size} tokens={tokens} category="sizing" onChange={(v) => updateNav("size", v)} />
            </Field>
            <Field label="Gap" style={{ flex: 1 }}>
              <TokenRefSelect value={nav.icons.gap} tokens={tokens} category="spacing" onChange={(v) => updateNav("gap", v)} />
            </Field>
          </Row>
        )}
      </div>

      {/* Navigation Groups */}
      <div style={{ marginBottom: 8, fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Grupos de Navegação
      </div>
      <div style={{ padding: 12, background: COLORS.surface2, borderRadius: 6, marginBottom: 12 }}>
        {navGroups.length === 0 && (
          <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 6 }}>Sem grupos — todos os itens ficam no nível raiz.</div>
        )}
        {navGroups.map(g => (
          <div key={g.id} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
            <input value={g.label} onChange={(e) => updateGroup(g.id, "label", e.target.value)} style={{ ...s.input, flex: 1, fontSize: 12 }} placeholder="Nome do grupo" />
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: COLORS.textDim, whiteSpace: "nowrap" as const }}>
              <input type="checkbox" checked={g.collapsible ?? false} onChange={(e) => updateGroup(g.id, "collapsible", e.target.checked)} />
              Colapsável
            </label>
            <span style={{ fontSize: 9, color: COLORS.textDim, fontFamily: "monospace" }}>{g.id}</span>
            <button onClick={() => removeGroup(g.id)} style={{ ...s.btnSmall, padding: "2px 6px", fontSize: 10, color: COLORS.danger }}>✕</button>
          </div>
        ))}
        <button onClick={addGroup} style={{ ...s.btnSmall, width: "100%", padding: "5px 0", marginTop: 4, fontSize: 11, color: COLORS.accent }}>
          + Adicionar grupo
        </button>
      </div>

      {/* Navigation Items */}
      <div style={{ marginBottom: 8, fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Itens de Navegação
        <span style={{ fontSize: 10, color: COLORS.accent, fontWeight: 400, textTransform: "none" as const, marginLeft: 8 }}>
          fonte da verdade
        </span>
      </div>
      <div style={{ padding: 12, background: COLORS.surface2, borderRadius: 6, marginBottom: 12 }}>
        {navItems.map((item, idx) => {
          const isExpanded = expandedItem === item.id;
          const subItems = item.children || [];
          return (
            <div key={item.id || idx} style={{ marginBottom: 6, borderRadius: 6, border: `1px solid ${isExpanded ? COLORS.accent + "40" : COLORS.border}`, background: isExpanded ? COLORS.surface3 : "transparent" }}>
              {/* Main row */}
              <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "6px 8px" }}>
                {/* Reorder */}
                <div style={{ display: "flex", flexDirection: "column" as const, gap: 1, flexShrink: 0 }}>
                  <button onClick={() => moveNavItem(idx, -1)} disabled={idx === 0} style={{ ...s.btnSmall, padding: "0 3px", fontSize: 8, opacity: idx === 0 ? 0.2 : 0.7, lineHeight: "12px" }}>▲</button>
                  <button onClick={() => moveNavItem(idx, 1)} disabled={idx === navItems.length - 1} style={{ ...s.btnSmall, padding: "0 3px", fontSize: 8, opacity: idx === navItems.length - 1 ? 0.2 : 0.7, lineHeight: "12px" }}>▼</button>
                </div>
                {/* Icon */}
                <PhosphorIconSelect value={item.icon || ""} allowEmpty placeholder="—" onChange={(val) => updateNavItem(item.id, "icon", val)} />
                {/* Label */}
                <input value={item.label || ""} onChange={(e) => updateNavItem(item.id, "label", e.target.value)} style={{ ...s.input, flex: 1, fontSize: 12 }} placeholder="Label" />
                {/* Route */}
                <input value={item.route || ""} onChange={(e) => updateNavItem(item.id, "route", e.target.value)} style={{ ...s.input, width: 80, fontSize: 11, fontFamily: "monospace" }} placeholder="/rota" />
                {/* Expand toggle */}
                <button onClick={() => setExpandedItem(isExpanded ? null : item.id)} style={{ ...s.btnSmall, padding: "2px 6px", fontSize: 10, color: COLORS.textDim }} title="Mais opções">
                  {isExpanded ? "▲" : "⋯"}
                </button>
                {/* Remove */}
                <button onClick={() => removeNavItem(item.id)} style={{ ...s.btnSmall, padding: "2px 6px", fontSize: 10, color: COLORS.danger }} title="Remover">✕</button>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div style={{ padding: "4px 8px 8px 32px", borderTop: `1px solid ${COLORS.border}` }}>
                  <Row gap={8}>
                    <Field label="Grupo" style={{ flex: 1 }}>
                      <select value={item.group || ""} onChange={(e) => updateNavItem(item.id, "group", e.target.value || undefined)} style={s.select}>
                        <option value="">— Sem grupo —</option>
                        {navGroups.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Badge" style={{ width: 80 }}>
                      <input value={item.badge?.text || ""} onChange={(e) => updateNavItem(item.id, "badge", e.target.value ? { ...item.badge, text: e.target.value } : undefined)} style={{ ...s.input, fontSize: 11 }} placeholder="Ex: 3" />
                    </Field>
                    <Field label="" style={{ width: 60 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: COLORS.textDim, cursor: "pointer", marginTop: 4 }}>
                        <input type="checkbox" checked={item.badge?.dot ?? false} onChange={(e) => updateNavItem(item.id, "badge", e.target.checked ? { ...item.badge, dot: true } : item.badge?.text ? { text: item.badge.text } : undefined)} />
                        Dot
                      </label>
                    </Field>
                    <Field label="" style={{ width: 60 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: COLORS.textDim, cursor: "pointer", marginTop: 4 }}>
                        <input type="checkbox" checked={item.disabled ?? false} onChange={(e) => updateNavItem(item.id, "disabled", e.target.checked || undefined)} />
                        Off
                      </label>
                    </Field>
                  </Row>
                  {/* Sub-items */}
                  <div style={{ marginTop: 8, fontSize: 10, fontWeight: 600, color: COLORS.textDim, textTransform: "uppercase" as const, letterSpacing: "0.04em", marginBottom: 4 }}>Sub-itens</div>
                  {subItems.map((sub, si) => (
                    <div key={sub.id || si} style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 3, paddingLeft: 8 }}>
                      <span style={{ fontSize: 10, color: COLORS.textDim }}>↳</span>
                      <PhosphorIconSelect value={sub.icon || ""} allowEmpty placeholder="—" onChange={(val) => updateSubItem(item.id, sub.id, "icon", val)} />
                      <input value={sub.label || ""} onChange={(e) => updateSubItem(item.id, sub.id, "label", e.target.value)} style={{ ...s.input, flex: 1, fontSize: 11 }} placeholder="Sub-label" />
                      <input value={sub.route || ""} onChange={(e) => updateSubItem(item.id, sub.id, "route", e.target.value)} style={{ ...s.input, width: 80, fontSize: 10, fontFamily: "monospace" }} placeholder="/sub-rota" />
                      <button onClick={() => removeSubItem(item.id, sub.id)} style={{ ...s.btnSmall, padding: "1px 5px", fontSize: 9, color: COLORS.danger }}>✕</button>
                    </div>
                  ))}
                  <button onClick={() => addSubItem(item.id)} style={{ ...s.btnSmall, fontSize: 10, color: COLORS.accent, marginTop: 2, padding: "3px 8px" }}>
                    + Sub-item
                  </button>
                </div>
              )}
            </div>
          );
        })}
        <button onClick={addNavItem} style={{ ...s.btnSmall, width: "100%", padding: "6px 0", marginTop: 4, fontSize: 11, color: COLORS.accent }}>
          + Adicionar item
        </button>
        <div style={{ marginTop: 8, fontSize: 10, color: COLORS.textDim }}>
          O Orqui é a fonte da verdade para navegação. Se o app passar <code style={{ color: COLORS.accent }}>sidebarNav</code> como prop, ela terá prioridade.
        </div>
      </div>

      {/* Collapsed Display */}
      {behavior.collapsible && (
        <>
          <div style={{ marginBottom: 8, fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Collapsed Display</div>
          <div style={{ padding: 12, background: COLORS.surface2, borderRadius: 6, marginBottom: 12 }}>
            <Field label="Mode when collapsed">
              <select value={behavior.collapsedDisplay || "letter-only"} onChange={(e) => updateBehavior("collapsedDisplay", e.target.value)} style={s.select}>
                <option value="icon-only">Icon only</option>
                <option value="icon-letter">Icon + first letter</option>
                <option value="letter-only">First letter only</option>
              </select>
            </Field>
            <div style={{ marginTop: 8, fontSize: 11, color: COLORS.textDim }}>
              {behavior.collapsedDisplay === "icon-only" && "Mostra apenas o ícone de cada item de navegação"}
              {behavior.collapsedDisplay === "icon-letter" && "Mostra ícone + primeira letra do label"}
              {behavior.collapsedDisplay === "letter-only" && "Mostra apenas a primeira letra do label (como avatar)"}
              {!behavior.collapsedDisplay && "Mostra apenas a primeira letra do label (como avatar)"}
            </div>
          </div>

          {/* Collapsed Tooltip — mandatory */}
          <div style={{ marginBottom: 8, fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Tooltip (Collapsed)
            <span style={{ fontSize: 9, color: COLORS.accent, fontWeight: 400, textTransform: "none" as const, marginLeft: 8, padding: "1px 6px", background: COLORS.accent + "15", borderRadius: 4 }}>
              obrigatório
            </span>
          </div>
          <div style={{ padding: 12, background: COLORS.surface2, borderRadius: 6, marginBottom: 12 }}>
            <CollapsedTooltipEditor
              tooltip={region.collapsedTooltip}
              tokens={tokens}
              onChange={(tt) => onChange({ ...region, collapsedTooltip: tt })}
            />
          </div>

          {/* Collapse Button */}
          <div style={{ marginBottom: 8, fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Collapse Button</div>
          <div style={{ padding: 12, background: COLORS.surface2, borderRadius: 6, marginBottom: 12 }}>
            <Row gap={12}>
              <Field label="Icon" style={{ flex: 1 }}>
                <select value={cb.icon || "chevron"} onChange={(e) => updateCB("icon", e.target.value)} style={s.select}>
                  <option value="chevron">Chevron ◂ ▸</option>
                  <option value="arrow">Arrow ← →</option>
                  <option value="hamburger">Hamburger ✕ ☰</option>
                  <option value="dots">Dots ⋮ ⋯</option>
                </select>
              </Field>
              <Field label="Position" style={{ flex: 1 }}>
                <select value={cb.position || "header-end"} onChange={(e) => updateCB("position", e.target.value)} style={s.select}>
                  <option value="header-end">Header (end)</option>
                  <option value="center">Center (between nav and footer)</option>
                  <option value="bottom">Bottom (footer area)</option>
                  <option value="edge-center">Borda fixa (centro vertical da viewport)</option>
                </select>
              </Field>
            </Row>
            <div style={{ marginTop: 8, fontSize: 11, color: COLORS.textDim }}>
              {cb.position === "header-end" && "Botão posicionado ao lado do brand/header do sidebar"}
              {cb.position === "center" && "Botão centralizado entre a navegação e o footer"}
              {cb.position === "bottom" && "Botão posicionado na área do footer do sidebar"}
              {cb.position === "edge-center" && "Botão fixo na borda da sidebar, centralizado verticalmente abaixo do header. Sempre visível."}
            </div>
          </div>
        </>
      )}

      {/* Separators */}
      <div style={{ marginBottom: 8, fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Separators</div>
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
        <Field label="Header separator">
          <SeparatorEditor separator={seps.header || { enabled: true, color: "$tokens.colors.border", width: "$tokens.borderWidth.thin", style: "solid" }} tokens={tokens} onChange={(v) => updateSep("header", v)} />
        </Field>
        <Field label="Footer separator">
          <SeparatorEditor separator={seps.footer || { enabled: true, color: "$tokens.colors.border", width: "$tokens.borderWidth.thin", style: "solid" }} tokens={tokens} onChange={(v) => updateSep("footer", v)} />
        </Field>
        <Field label="Nav group separators">
          <SeparatorEditor separator={seps.navGroups || { enabled: false, color: "$tokens.colors.border", width: "$tokens.borderWidth.thin", style: "solid" }} tokens={tokens} onChange={(v) => updateSep("navGroups", v)} />
        </Field>
      </div>
    </div>
  );
}


// ============================================================================
// Region Editor
// ============================================================================
export function RegionEditor({ name, region, tokens, onChange }) {
  const update = (field, val) => onChange({ ...region, [field]: val });
  const updateDim = (field, val) => onChange({ ...region, dimensions: { ...region.dimensions, [field]: val } });
  const updatePad = (field, val) => onChange({ ...region, padding: { ...region.padding, [field]: val } });
  const updateBehavior = (field, val) => onChange({ ...region, behavior: { ...region.behavior, [field]: val } });

  const regionLabel = { sidebar: "Sidebar", header: "Header", main: "Main", footer: "Footer" }[name] || name;
  const isHeader = name === "header";
  const hasZones = isHeader && region.zones;

  return (
    <div style={{ ...s.card, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>
          {regionLabel} <span style={{ ...s.tag, marginLeft: 6 }}>{region.enabled ? "ativo" : "inativo"}</span>
          {hasZones && <span style={{ ...s.tag, marginLeft: 4, background: COLORS.accent + "15", color: COLORS.accent, border: `1px solid ${COLORS.accent}30` }}>zone-based</span>}
        </span>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: COLORS.textMuted, cursor: "pointer" }}>
          <input type="checkbox" checked={region.enabled} onChange={(e) => {
            if (e.target.checked) {
              onChange({ enabled: true, position: name === "sidebar" ? "left" : name === "header" ? "top" : name === "footer" ? "bottom" : "center", containers: [{ name: "content", description: "", order: 0 }], behavior: { fixed: true, collapsible: false, scrollable: false }, dimensions: {}, padding: {} });
            } else {
              onChange({ enabled: false });
            }
          }} /> Enabled
        </label>
      </div>
      {region.enabled && (
        <div>
          <Row gap={12}>
            <Field label="Position" style={{ flex: 1 }}>
              <select value={region.position} onChange={(e) => update("position", e.target.value)} style={s.select}>
                {["top", "left", "right", "bottom", "center"].map((p) => <option key={p}>{p}</option>)}
              </select>
            </Field>
          </Row>

          <div style={{ marginTop: 12, marginBottom: 8, fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Dimensions</div>
          <Row gap={8}>
            <Field label="Width" style={{ flex: 1 }}>
              <TokenRefSelect value={region.dimensions?.width} tokens={tokens} category="sizing" onChange={(v) => updateDim("width", v)} />
            </Field>
            <Field label="Height" style={{ flex: 1 }}>
              <TokenRefSelect value={region.dimensions?.height} tokens={tokens} category="sizing" onChange={(v) => updateDim("height", v)} />
            </Field>
            {name === "sidebar" && (
              <Field label="Min Width (collapsed)" style={{ flex: 1 }}>
                <TokenRefSelect value={region.dimensions?.minWidth} tokens={tokens} category="sizing" onChange={(v) => updateDim("minWidth", v)} />
              </Field>
            )}
          </Row>

          {/* Header Zones — replaces flat padding for header */}
          {hasZones && (
            <>
              <div style={{ marginTop: 16, marginBottom: 8, fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Header Zones (Alignment Grid)</div>
              <HeaderZoneEditor
                zones={region.zones}
                tokens={tokens}
                onChange={(z) => update("zones", z)}
              />
            </>
          )}

          {/* Flat padding — for non-header regions or header without zones */}
          {!hasZones && (
            <>
              <div style={{ marginTop: 12, marginBottom: 8, fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Padding</div>
              <Row gap={8}>
                {["top", "right", "bottom", "left"].map((side) => (
                  <Field key={side} label={side} style={{ flex: 1 }}>
                    <TokenRefSelect value={region.padding?.[side]} tokens={tokens} category="spacing" onChange={(v) => updatePad(side, v)} />
                  </Field>
                ))}
              </Row>
            </>
          )}

          <div style={{ marginTop: 12, marginBottom: 8, fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Behavior</div>
          <Row gap={16}>
            {["fixed", "collapsible", "scrollable"].map((b) => (
              <label key={b} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.textMuted, cursor: "pointer" }}>
                <input type="checkbox" checked={region.behavior?.[b] || false} onChange={(e) => updateBehavior(b, e.target.checked)} /> {b}
              </label>
            ))}
          </Row>

          <div style={{ marginTop: 16, marginBottom: 8, fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Containers</div>
          <ContainerEditor containers={region.containers || []} onChange={(c) => update("containers", c)} isHeader={isHeader} />

          {/* Sidebar-specific config */}
          {name === "sidebar" && (
            <SidebarConfigEditor region={region} tokens={tokens} onChange={onChange} />
          )}

          {/* Header/Footer separator config */}
          {(name === "header" || name === "footer") && (
            <>
              <div style={{ marginTop: 16, marginBottom: 8, fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Separators</div>
              {name === "header" && (
                <Field label="Bottom separator">
                  <SeparatorEditor
                    separator={region.separators?.bottom || { enabled: true, color: "$tokens.colors.border", width: "$tokens.borderWidth.thin", style: "solid" }}
                    tokens={tokens}
                    onChange={(v) => onChange({ ...region, separators: { ...region.separators, bottom: v } })}
                  />
                </Field>
              )}
              {name === "footer" && (
                <Field label="Top separator">
                  <SeparatorEditor
                    separator={region.separators?.top || { enabled: true, color: "$tokens.colors.border", width: "$tokens.borderWidth.thin", style: "solid" }}
                    tokens={tokens}
                    onChange={(v) => onChange({ ...region, separators: { ...region.separators, top: v } })}
                  />
                </Field>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

