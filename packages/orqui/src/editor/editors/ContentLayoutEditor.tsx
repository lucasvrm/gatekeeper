import React, { useState } from "react";
import { COLORS, s } from "../lib/constants";
import { Field, Row, Section, WBSub, ColorInput } from "../components/shared";
import { TokenRefSelect } from "./ColorTokenEditor";

// ============================================================================
// Separator Editor
// ============================================================================
export function SeparatorEditor({ separator, tokens, onChange }) {
  const update = (field, val) => onChange({ ...separator, [field]: val });
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", padding: 8, background: COLORS.surface2, borderRadius: 6, flexWrap: "wrap" }}>
      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: COLORS.textMuted, cursor: "pointer", minWidth: 60 }}>
        <input type="checkbox" checked={separator?.enabled ?? false} onChange={(e) => update("enabled", e.target.checked)} /> Visible
      </label>
      {separator?.enabled && (
        <>
          <Field label="Color" style={{ flex: 1 }}>
            <TokenRefSelect value={separator.color} tokens={tokens} category="colors" onChange={(v) => update("color", v)} />
          </Field>
          <Field label="Width" style={{ width: 110 }}>
            <TokenRefSelect value={separator.width} tokens={tokens} category="borderWidth" onChange={(v) => update("width", v)} />
          </Field>
          <Field label="Style" style={{ width: 80 }}>
            <select value={separator.style || "solid"} onChange={(e) => update("style", e.target.value)} style={{ ...s.select, fontSize: 11, padding: "3px 6px" }}>
              {["solid", "dashed", "dotted", "none"].map(v => <option key={v}>{v}</option>)}
            </select>
          </Field>
          <Field label="Extensão" style={{ width: 100 }}>
            <select value={separator.extend || "full"} onChange={(e) => update("extend", e.target.value)} style={{ ...s.select, fontSize: 11, padding: "3px 6px" }}>
              <option value="full">Total</option>
              <option value="inset">Com margem</option>
              <option value="none">Nenhuma</option>
            </select>
          </Field>
        </>
      )}
    </div>
  );
}


// ============================================================================
// Breadcrumb Editor
// ============================================================================
export function BreadcrumbEditor({ breadcrumbs, tokens, onChange }) {
  const bc = breadcrumbs || { enabled: false, position: "header", alignment: "left", separator: "/", clickable: true, showHome: true, homeLabel: "Home", homeRoute: "/" };
  const update = (field, val) => onChange({ ...bc, [field]: val });

  const SEPARATORS = [
    { value: "/", label: "/ (slash)" },
    { value: ">", label: "> (chevron)" },
    { value: "|", label: "| (pipe)" },
    { value: "→", label: "→ (arrow)" },
    { value: "·", label: "· (dot)" },
  ];

  // Preview items
  const items = ["Home", "Editor", "Preview"];

  return (
    <div style={{ ...s.card, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>
          Breadcrumbs <span style={{ ...s.tag, marginLeft: 6 }}>{bc.enabled ? "ativo" : "inativo"}</span>
        </span>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: COLORS.textMuted, cursor: "pointer" }}>
          <input type="checkbox" checked={bc.enabled} onChange={(e) => update("enabled", e.target.checked)} /> Enabled
        </label>
      </div>

      {bc.enabled && (
        <div>
          {/* Live preview */}
          <div style={{ background: COLORS.surface2, borderRadius: 6, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: bc.alignment === "right" ? "flex-end" : bc.alignment === "center" ? "center" : "flex-start" }}>
            {items.map((item, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center" }}>
                <span style={{
                  fontSize: 13,
                  color: i < items.length - 1 ? (bc.clickable ? COLORS.accent : COLORS.textMuted) : COLORS.text,
                  cursor: i < items.length - 1 && bc.clickable ? "pointer" : "default",
                  fontWeight: i === items.length - 1 ? 500 : 400,
                  textDecoration: i < items.length - 1 && bc.clickable ? "underline" : "none",
                  textDecorationColor: i < items.length - 1 && bc.clickable ? COLORS.accent + "40" : undefined,
                }}>
                  {item}
                </span>
                {i < items.length - 1 && (
                  <span style={{ color: COLORS.textDim, margin: "0 6px", fontSize: 12 }}>{bc.separator}</span>
                )}
              </span>
            ))}
          </div>

          <Row gap={12}>
            <Field label="Position" style={{ flex: 1 }}>
              <select value={bc.position} onChange={(e) => update("position", e.target.value)} style={s.select}>
                <option value="header">Header</option>
                <option value="sidebar-top">Sidebar (topo)</option>
                <option value="sidebar-bottom">Sidebar (bottom)</option>
              </select>
            </Field>
            {bc.position === "header" && (
              <Field label="Alignment" style={{ flex: 1 }}>
                <select value={bc.alignment || "left"} onChange={(e) => update("alignment", e.target.value)} style={s.select}>
                  <option value="left">Esquerda</option>
                  <option value="center">Centralizado</option>
                  <option value="right">Direita</option>
                </select>
              </Field>
            )}
          </Row>

          <Row gap={12}>
            <Field label="Separator" style={{ flex: 1 }}>
              <select value={bc.separator} onChange={(e) => update("separator", e.target.value)} style={s.select}>
                {SEPARATORS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Clickable" style={{ flex: 1 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: COLORS.textMuted, cursor: "pointer", paddingTop: 4 }}>
                <input type="checkbox" checked={bc.clickable ?? true} onChange={(e) => update("clickable", e.target.checked)} />
                Itens anteriores redirecionam
              </label>
            </Field>
          </Row>

          <Row gap={12}>
            <Field label="Mostrar Home" style={{ flex: 0 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: COLORS.textMuted, cursor: "pointer", paddingTop: 4 }}>
                <input type="checkbox" checked={bc.showHome !== false} onChange={(e) => update("showHome", e.target.checked)} />
                Exibir
              </label>
            </Field>
            {bc.showHome !== false && (
              <>
                <Field label="Label Home" style={{ flex: 1 }}>
                  <input value={bc.homeLabel || "Home"} onChange={(e) => update("homeLabel", e.target.value)} style={s.input} />
                </Field>
                <Field label="Rota Home" style={{ flex: 1 }}>
                  <input value={bc.homeRoute || "/"} onChange={(e) => update("homeRoute", e.target.value)} style={{ ...s.input, fontFamily: "monospace" }} />
                </Field>
              </>
            )}
          </Row>

          {/* Typography */}
          <div style={{ marginTop: 12, marginBottom: 4, fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Tipografia</div>
          <Row gap={12}>
            <Field label="Font Size" style={{ flex: 1 }}>
              <TokenRefSelect tokens={tokens} value={bc.typography?.fontSize} category="fontSizes" onChange={(v) => onChange({ ...bc, typography: { ...bc.typography, fontSize: v } })} />
            </Field>
            <Field label="Font Weight" style={{ flex: 1 }}>
              <TokenRefSelect tokens={tokens} value={bc.typography?.fontWeight} category="fontWeights" onChange={(v) => onChange({ ...bc, typography: { ...bc.typography, fontWeight: v } })} />
            </Field>
            <Field label="Font Family" style={{ flex: 1 }}>
              <TokenRefSelect tokens={tokens} value={bc.typography?.fontFamily} category="fontFamilies" onChange={(v) => onChange({ ...bc, typography: { ...bc.typography, fontFamily: v } })} />
            </Field>
          </Row>
          <Row gap={12}>
            <Field label="Color (links)" style={{ flex: 1 }}>
              <TokenRefSelect tokens={tokens} value={bc.typography?.color} category="colors" onChange={(v) => onChange({ ...bc, typography: { ...bc.typography, color: v } })} />
            </Field>
            <Field label="Color (ativo)" style={{ flex: 1 }}>
              <TokenRefSelect tokens={tokens} value={bc.typography?.activeColor} category="colors" onChange={(v) => onChange({ ...bc, typography: { ...bc.typography, activeColor: v } })} />
            </Field>
            <Field label="Weight (ativo)" style={{ flex: 1 }}>
              <TokenRefSelect tokens={tokens} value={bc.typography?.activeFontWeight} category="fontWeights" onChange={(v) => onChange({ ...bc, typography: { ...bc.typography, activeFontWeight: v } })} />
            </Field>
          </Row>
          <Row gap={12}>
            <Field label="Cor separador" style={{ flex: 1 }}>
              <TokenRefSelect tokens={tokens} value={bc.typography?.separatorColor} category="colors" onChange={(v) => onChange({ ...bc, typography: { ...bc.typography, separatorColor: v } })} />
            </Field>
          </Row>

          {/* Padding */}
          <div style={{ marginTop: 12, marginBottom: 4, fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Padding</div>

          {/* Alignment Grid warning */}
          {bc.position === "header" && (!bc.padding?.left || bc.padding.left === "0") && (
            <div style={{ padding: "8px 10px", background: COLORS.surface2, borderRadius: 6, fontSize: 11, color: COLORS.textDim, lineHeight: 1.5, borderLeft: `3px solid ${COLORS.accent}40`, marginBottom: 10 }}>
              <strong style={{ color: COLORS.text }}>⚡ Alignment Grid:</strong> O alinhamento horizontal dos breadcrumbs é controlado pelo token{" "}
              <code style={{ color: COLORS.accent }}>main-pad</code> via header content-zone.
              Padding left = 0 aqui é intencional — não precisa de padding independente.
            </div>
          )}

          <Row gap={12}>
            <Field label="Top" style={{ flex: 1 }}>
              <TokenRefSelect tokens={tokens} value={bc.padding?.top} category="spacing" onChange={(v) => onChange({ ...bc, padding: { ...bc.padding, top: v } })} />
            </Field>
            <Field label="Right" style={{ flex: 1 }}>
              <TokenRefSelect tokens={tokens} value={bc.padding?.right} category="spacing" onChange={(v) => onChange({ ...bc, padding: { ...bc.padding, right: v } })} />
            </Field>
            <Field label="Bottom" style={{ flex: 1 }}>
              <TokenRefSelect tokens={tokens} value={bc.padding?.bottom} category="spacing" onChange={(v) => onChange({ ...bc, padding: { ...bc.padding, bottom: v } })} />
            </Field>
            <Field label="Left" style={{ flex: 1 }}>
              <TokenRefSelect tokens={tokens} value={bc.padding?.left} category="spacing" onChange={(v) => onChange({ ...bc, padding: { ...bc.padding, left: v } })} />
            </Field>
          </Row>

          <div style={{ marginTop: 8, padding: 8, background: COLORS.surface2, borderRadius: 4, fontSize: 11, color: COLORS.textDim }}>
            {bc.position === "header" && `Breadcrumbs renderizados no header, alinhados à ${bc.alignment === "right" ? "direita" : bc.alignment === "center" ? "centro" : "esquerda"}.`}
            {bc.position === "sidebar-top" && "Breadcrumbs renderizados no topo da sidebar, acima da logo."}
            {bc.position === "sidebar-bottom" && "Breadcrumbs renderizados no final da sidebar."}
            {bc.clickable ? " Itens anteriores são clicáveis e redirecionam." : " Itens não são clicáveis (apenas visual)."}
          </div>
        </div>
      )}
    </div>
  );
}


// ============================================================================
// Table Separator Editor
// ============================================================================
export function TableSeparatorEditor({ config, tokens, onChange }) {
  const cfg = config || { color: "$tokens.colors.border", width: "1px", style: "solid", headerColor: "", headerWidth: "2px", headerStyle: "solid" };
  const update = (field, val) => onChange({ ...cfg, [field]: val });

  const colorKeys = Object.keys(tokens?.colors || {});

  // Preview table
  const resolveColor = (ref) => {
    if (!ref) return COLORS.border;
    const m = ref.match(/^\$tokens\.colors\.(.+)$/);
    if (m && tokens?.colors?.[m[1]]) return tokens.colors[m[1]].value;
    return ref;
  };

  const sepColor = resolveColor(cfg.color);
  const hdrColor = resolveColor(cfg.headerColor) || sepColor;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, margin: 0, marginBottom: 4 }}>Table Separator</h3>
        <p style={{ fontSize: 12, color: COLORS.textDim, margin: 0 }}>Configuração das linhas separadoras em tabelas</p>
      </div>

      {/* Preview */}
      <div style={{ background: COLORS.surface2, borderRadius: 8, padding: 12, marginBottom: 16, border: `1px solid ${COLORS.border}` }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: `${cfg.headerWidth || cfg.width || "1px"} ${cfg.headerStyle || cfg.style || "solid"} ${hdrColor}` }}>
              <th style={{ textAlign: "left", padding: "6px 8px", color: COLORS.textMuted, fontWeight: 600 }}>ID</th>
              <th style={{ textAlign: "left", padding: "6px 8px", color: COLORS.textMuted, fontWeight: 600 }}>Status</th>
              <th style={{ textAlign: "right", padding: "6px 8px", color: COLORS.textMuted, fontWeight: 600 }}>Valor</th>
            </tr>
          </thead>
          <tbody>
            {[["RUN-001", "Passed", "Gate 3"], ["RUN-002", "Failed", "Gate 1"], ["RUN-003", "Passed", "Gate 3"]].map(([id, st, gate], i) => (
              <tr key={i} style={{ borderBottom: `${cfg.width || "1px"} ${cfg.style || "solid"} ${sepColor}` }}>
                <td style={{ padding: "6px 8px", color: COLORS.text, fontFamily: "monospace", fontSize: 10 }}>{id}</td>
                <td style={{ padding: "6px 8px" }}>
                  <span style={{ padding: "1px 6px", borderRadius: 8, fontSize: 9, background: st === "Passed" ? "#22c55e20" : "#ef444420", color: st === "Passed" ? "#22c55e" : "#ef4444" }}>{st}</span>
                </td>
                <td style={{ padding: "6px 8px", color: COLORS.text, textAlign: "right", fontSize: 10 }}>{gate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Section title="Row Separator" defaultOpen={true} id="table-row-sep">
        <Field label="Cor">
          <Row gap={6}>
            <select value={cfg.color?.startsWith("$tokens.colors.") ? cfg.color : "__custom"} onChange={(e) => update("color", e.target.value === "__custom" ? (sepColor || COLORS.border) : e.target.value)} style={{ ...s.select, flex: 1 }}>
              <option value="__custom">Custom</option>
              {colorKeys.map(k => <option key={k} value={`$tokens.colors.${k}`}>{k}</option>)}
            </select>
            {!cfg.color?.startsWith("$tokens.colors.") && (
              <input type="color" value={cfg.color || COLORS.border} onChange={(e) => update("color", e.target.value)} style={{ width: 32, height: 28, border: "none", background: "none", cursor: "pointer" }} />
            )}
          </Row>
        </Field>
        <Row gap={8}>
          <Field label="Espessura" style={{ flex: 1 }}>
            <select value={cfg.width || "1px"} onChange={(e) => update("width", e.target.value)} style={s.select}>
              {["0px", "1px", "2px", "3px"].map(v => <option key={v}>{v}</option>)}
            </select>
          </Field>
          <Field label="Estilo" style={{ flex: 1 }}>
            <select value={cfg.style || "solid"} onChange={(e) => update("style", e.target.value)} style={s.select}>
              {["solid", "dashed", "dotted", "none"].map(v => <option key={v}>{v}</option>)}
            </select>
          </Field>
        </Row>
      </Section>

      <Section title="Header Separator" defaultOpen={false} id="table-header-sep">
        <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 8 }}>Separador entre header e body (se vazio, usa o mesmo das rows)</div>
        <Field label="Cor do Header">
          <Row gap={6}>
            <select value={cfg.headerColor?.startsWith("$tokens.colors.") ? cfg.headerColor : (cfg.headerColor ? "__custom" : "")} onChange={(e) => update("headerColor", e.target.value === "__custom" ? (hdrColor || COLORS.border) : e.target.value)} style={{ ...s.select, flex: 1 }}>
              <option value="">Mesma das rows</option>
              <option value="__custom">Custom</option>
              {colorKeys.map(k => <option key={k} value={`$tokens.colors.${k}`}>{k}</option>)}
            </select>
            {cfg.headerColor && !cfg.headerColor.startsWith("$tokens.colors.") && (
              <input type="color" value={cfg.headerColor || COLORS.border} onChange={(e) => update("headerColor", e.target.value)} style={{ width: 32, height: 28, border: "none", background: "none", cursor: "pointer" }} />
            )}
          </Row>
        </Field>
        <Row gap={8}>
          <Field label="Espessura" style={{ flex: 1 }}>
            <select value={cfg.headerWidth || "2px"} onChange={(e) => update("headerWidth", e.target.value)} style={s.select}>
              {["1px", "2px", "3px", "4px"].map(v => <option key={v}>{v}</option>)}
            </select>
          </Field>
          <Field label="Estilo" style={{ flex: 1 }}>
            <select value={cfg.headerStyle || "solid"} onChange={(e) => update("headerStyle", e.target.value)} style={s.select}>
              {["solid", "dashed", "dotted", "double"].map(v => <option key={v}>{v}</option>)}
            </select>
          </Field>
        </Row>
      </Section>
    </div>
  );
}


// ============================================================================
// Content Layout Editor
// ============================================================================
export function ContentLayoutEditor({ config, onChange }: { config: any; onChange: (c: any) => void }) {
  const cl = config || { maxWidth: "", centering: true, grid: { enabled: false, columns: 1, minColumnWidth: "280px", gap: "$tokens.spacing.md" } };
  const update = (field: string, val: any) => onChange({ ...cl, [field]: val });
  const updateGrid = (field: string, val: any) => onChange({ ...cl, grid: { ...(cl.grid || {}), [field]: val } });

  return (
    <div>
      <p style={{ fontSize: 12, color: COLORS.textDim, margin: "0 0 12px" }}>
        Controla o layout da área de conteúdo dentro do <code style={{ color: COLORS.accent }}>&lt;main&gt;</code>: largura máxima, centralização e grid CSS.
      </p>

      <Row gap={8}>
        <Field label="Max Width" style={{ flex: 1 }}>
          <input value={cl.maxWidth || ""} onChange={(e) => update("maxWidth", e.target.value)} style={s.input} placeholder="ex: 1200px ou vazio = 100%" />
        </Field>
        <Field label="Centering" style={{ flex: 0 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.textMuted, cursor: "pointer", marginTop: 4 }}>
            <input type="checkbox" checked={cl.centering !== false} onChange={(e) => update("centering", e.target.checked)} />
            Auto center
          </label>
        </Field>
      </Row>

      <WBSub title="CSS Grid">
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.textMuted, cursor: "pointer", marginBottom: 10 }}>
          <input type="checkbox" checked={cl.grid?.enabled || false} onChange={(e) => updateGrid("enabled", e.target.checked)} />
          Ativar grid no conteúdo
        </label>

        {cl.grid?.enabled && (
          <>
            <Row gap={8}>
              <Field label="Columns" style={{ flex: 1 }}>
                <input value={cl.grid?.columns ?? 1} onChange={(e) => {
                  const v = e.target.value;
                  updateGrid("columns", v === "auto-fit" || v === "auto-fill" ? v : (parseInt(v) || 1));
                }} style={s.input} placeholder="1, 2, 3, auto-fit" />
              </Field>
              <Field label="Min Column Width" style={{ flex: 1 }}>
                <input value={cl.grid?.minColumnWidth || ""} onChange={(e) => updateGrid("minColumnWidth", e.target.value)} style={s.input} placeholder="280px" />
              </Field>
            </Row>
            <Row gap={8}>
              <Field label="Gap" style={{ flex: 1 }}>
                <input value={cl.grid?.gap || ""} onChange={(e) => updateGrid("gap", e.target.value)} style={s.input} placeholder="$tokens.spacing.md" />
              </Field>
              <Field label="Row Gap (override)" style={{ flex: 1 }}>
                <input value={cl.grid?.rowGap || ""} onChange={(e) => updateGrid("rowGap", e.target.value)} style={s.input} placeholder="opcional" />
              </Field>
              <Field label="Column Gap (override)" style={{ flex: 1 }}>
                <input value={cl.grid?.columnGap || ""} onChange={(e) => updateGrid("columnGap", e.target.value)} style={s.input} placeholder="opcional" />
              </Field>
            </Row>
          </>
        )}
      </WBSub>
    </div>
  );
}


// ============================================================================
// Page Header Editor
// ============================================================================
export function PageHeaderEditor({ config, onChange }: { config: any; onChange: (c: any) => void }) {
  const ph = config || { enabled: false, showTitle: true, showSubtitle: true, showDivider: false, padding: {}, typography: {} };
  const update = (field: string, val: any) => onChange({ ...ph, [field]: val });
  const updateTypo = (group: string, field: string, val: string) => {
    const typo = { ...(ph.typography || {}) };
    typo[group] = { ...(typo[group] || {}), [field]: val };
    update("typography", typo);
  };
  const updatePad = (side: string, val: string) => {
    update("padding", { ...(ph.padding || {}), [side]: val });
  };

  return (
    <div>
      <p style={{ fontSize: 12, color: COLORS.textDim, margin: "0 0 12px" }}>
        Renderiza automaticamente título e subtítulo da página a partir do <code style={{ color: COLORS.accent }}>pages[pageKey]</code> do contrato.
      </p>

      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.textMuted, cursor: "pointer", marginBottom: 12 }}>
        <input type="checkbox" checked={ph.enabled || false} onChange={(e) => update("enabled", e.target.checked)} />
        Ativar Page Header
      </label>

      {ph.enabled && (
        <>
          <Row gap={8}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.textMuted, cursor: "pointer" }}>
              <input type="checkbox" checked={ph.showTitle !== false} onChange={(e) => update("showTitle", e.target.checked)} />
              Título
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.textMuted, cursor: "pointer" }}>
              <input type="checkbox" checked={ph.showSubtitle !== false} onChange={(e) => update("showSubtitle", e.target.checked)} />
              Subtítulo
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.textMuted, cursor: "pointer" }}>
              <input type="checkbox" checked={ph.showDivider || false} onChange={(e) => update("showDivider", e.target.checked)} />
              Divider
            </label>
          </Row>

          <WBSub title="Typography — Título">
            <Row gap={8}>
              <Field label="Font Size" style={{ flex: 1 }}>
                <input value={ph.typography?.title?.fontSize || ""} onChange={(e) => updateTypo("title", "fontSize", e.target.value)} style={s.input} placeholder="$tokens.fontSizes.3xl" />
              </Field>
              <Field label="Font Weight" style={{ flex: 1 }}>
                <input value={ph.typography?.title?.fontWeight || ""} onChange={(e) => updateTypo("title", "fontWeight", e.target.value)} style={s.input} placeholder="$tokens.fontWeights.bold" />
              </Field>
              <Field label="Color" style={{ flex: 1 }}>
                <ColorInput value={ph.typography?.title?.color || ""} onChange={(v) => updateTypo("title", "color", v)} placeholder="var(--foreground)" />
              </Field>
            </Row>
          </WBSub>

          <WBSub title="Typography — Subtítulo">
            <Row gap={8}>
              <Field label="Font Size" style={{ flex: 1 }}>
                <input value={ph.typography?.subtitle?.fontSize || ""} onChange={(e) => updateTypo("subtitle", "fontSize", e.target.value)} style={s.input} placeholder="$tokens.fontSizes.sm" />
              </Field>
              <Field label="Color" style={{ flex: 1 }}>
                <ColorInput value={ph.typography?.subtitle?.color || ""} onChange={(v) => updateTypo("subtitle", "color", v)} placeholder="$tokens.colors.text-muted" />
              </Field>
            </Row>
          </WBSub>

          <WBSub title="Padding">
            <Row gap={8}>
              {["top", "right", "bottom", "left"].map(side => (
                <Field key={side} label={side} style={{ flex: 1 }}>
                  <input value={ph.padding?.[side] || ""} onChange={(e) => updatePad(side, e.target.value)} style={s.input} placeholder="$tokens.spacing.md" />
                </Field>
              ))}
            </Row>
          </WBSub>

          <Field label="Background">
            <ColorInput value={ph.background || ""} onChange={(v) => update("background", v)} placeholder="var(--background) ou token ref" />
          </Field>
        </>
      )}
    </div>
  );
}

