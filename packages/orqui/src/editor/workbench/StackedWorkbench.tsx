import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { COLORS, s } from "../lib/constants";
import { resolveTextStyleCSS } from "../lib/utils";
import { Field, Row, Section, ColorInput, TabBar } from "../components/shared";
import { usePersistentTab } from "../hooks/usePersistentState";
import { ColorTokenEditor, TokenEditor } from "../editors/ColorTokenEditor";
import {
  TypoRefSelect, FontFamilyEditor, FontSizeEditor, FontWeightEditor,
  LineHeightEditor, LetterSpacingEditor, TextStyleAddButton,
} from "../editors/TypographyEditors";
import { RegionEditor, NavItemStyleEditor, CollapsedTooltipEditor } from "../editors/RegionEditors";
import { LogoConfigEditor, FaviconEditor } from "../editors/LogoConfigEditor";
import {
  BreadcrumbEditor, ContentLayoutEditor, PageHeaderEditor, TableSeparatorEditor,
} from "../editors/ContentLayoutEditor";
import { LoginPageEditor } from "../editors/LoginPageEditor";
import { HeaderElementsEditor } from "../editors/HeaderElementsEditor";
import { PagesEditor } from "../editors/PagesEditor";
import { UIRegistryEditor } from "../editors/ComponentEditors";
import { ExportPanel } from "../panels/ExportPanel";
import { ImportPanel } from "../panels/ImportPanel";


// ============================================================================
// STACKED WORKBENCH — IDE-like Shell & Tokens editor
// ============================================================================

// ---------- Activity / Section definitions ----------

interface SectionDef {
  id: string;
  label: string;
  icon: string;
  desc: string;
}

interface ActivityDef {
  id: string;
  icon: string;
  label: string;
  color: string;
  sections: SectionDef[];
}

const ACTIVITIES: ActivityDef[] = [
  {
    id: "tokens", icon: "◆", label: "Tokens", color: "#fbbf24",
    sections: [
      { id: "colors", label: "Cores", icon: "◆", desc: "backgrounds, texto, bordas, accent, status" },
      { id: "font-tokens", label: "Fontes", icon: "Ff", desc: "families, sizes, weights, heights, spacings" },
      { id: "spacing-tokens", label: "Spacing", icon: "⊞", desc: "tokens de espaçamento" },
      { id: "sizing-tokens", label: "Sizing", icon: "↔", desc: "tokens de dimensionamento" },
      { id: "border-tokens", label: "Borders", icon: "◻", desc: "border-radius e border-width" },
      { id: "text-styles", label: "Text Styles", icon: "Ts", desc: "composições tipográficas nomeadas" },
    ],
  },
  {
    id: "brand", icon: "★", label: "Brand", color: "#f97316",
    sections: [
      { id: "logo", label: "Logo", icon: "⬡", desc: "tipo, texto, ícone, imagem, posição, alinhamento" },
      { id: "favicon", label: "Favicon", icon: "★", desc: "emoji, URL, cor de fundo" },
      { id: "app-title", label: "App Title", icon: "T", desc: "título padrão do app (fallback browser tab)" },
    ],
  },
  {
    id: "shell", icon: "□", label: "Shell", color: "#3b82f6",
    sections: [
      { id: "layout-mode", label: "Layout Mode", icon: "⊞", desc: "sidebar-first | header-first" },
      { id: "sidebar", label: "Sidebar", icon: "◧", desc: "dimensões, padding, comportamento, navegação" },
      { id: "header", label: "Header", icon: "▬", desc: "dimensões, zonas, separador" },
      { id: "main", label: "Main", icon: "◻", desc: "padding, content layout, CSS Grid" },
      { id: "footer", label: "Footer", icon: "▭", desc: "dimensões, padding, separador" },
      { id: "header-elements", label: "Header Elements", icon: "▤", desc: "search, icons, CTAs, ordem" },
    ],
  },
  {
    id: "components", icon: "◎", label: "Componentes", color: "#8b5cf6",
    sections: [
      { id: "nav-style", label: "Nav Item", icon: "◧", desc: "tipografia, cores, estados active/hover, card mode" },
      { id: "breadcrumbs", label: "Breadcrumbs", icon: "»", desc: "separador, home, tipografia, padding" },
      { id: "page-header", label: "Page Header", icon: "H", desc: "título, subtítulo, divider, text style" },
      { id: "toast", label: "Toast", icon: "◻", desc: "posição, máximo visível, duração" },
      { id: "skeleton", label: "Loading Skeleton", icon: "▤", desc: "animação, duração, cores, raio" },
      { id: "empty-state", label: "Empty State", icon: "◇", desc: "ícone, título, descrição, ação" },
      { id: "scrollbar", label: "Scrollbar", icon: "▐", desc: "largura, raio, cores do thumb e track" },
      { id: "table-sep", label: "Table", icon: "≡", desc: "separadores de linhas e header" },
      { id: "sidebar-tooltip", label: "Tooltip", icon: "◬", desc: "aparência do tooltip ao colapsar sidebar" },
    ],
  },
  {
    id: "pages", icon: "⊡", label: "Páginas", color: "#22c55e",
    sections: [
      { id: "login-page", label: "Login", icon: "🔐", desc: "logo, background, card, inputs, botão" },
      { id: "pages-editor", label: "Registro", icon: "⊡", desc: "CRUD, label, route, browserTitle, overrides" },
    ],
  },
  {
    id: "data", icon: "⧉", label: "Dados", color: "#ef4444",
    sections: [
      { id: "ui-registry", label: "UI Registry", icon: "⧉", desc: "name, category, props, slots, variants" },
    ],
  },
];

function getActivityForSection(sectionId: string): ActivityDef | undefined {
  return ACTIVITIES.find(a => a.sections.some(sec => sec.id === sectionId));
}

function getSectionDef(sectionId: string): SectionDef | undefined {
  return ACTIVITIES.flatMap(a => a.sections).find(sec => sec.id === sectionId);
}

// ---------- Tab type ----------

interface Tab {
  id: string;
  label: string;
  icon: string;
}

// ============================================================================
// Section Editor Content — routes section ID to real editors
// ============================================================================

function SectionEditorContent({
  sectionId, layout, registry, setLayout, setRegistry,
}: {
  sectionId: string;
  layout: any;
  registry: any;
  setLayout: (l: any) => void;
  setRegistry: (r: any) => void;
}) {
  // ⚠️ HOOKS PRIMEIRO - antes de qualquer condicional (Rules of Hooks)
  const [activeTextStyle, setActiveTextStyle] = usePersistentTab("sw-textstyle", "");
  const [fontTab, setFontTab] = usePersistentTab("sw-font-tab", "families");

  // Depois das chamadas de hooks, podemos verificar condições
  const section = getSectionDef(sectionId);
  const activity = getActivityForSection(sectionId);

  if (!section || !activity) return null;

  const onChange = setLayout;
  const updateRegion = (name: string, region: any) => {
    onChange({ ...layout, structure: { ...layout.structure, regions: { ...layout.structure.regions, [name]: region } } });
  };
  const updateTokenCat = (cat: string, val: any) => {
    onChange({ ...layout, tokens: { ...layout.tokens, [cat]: val } });
  };

  // Route to real editor by section ID
  const renderEditor = () => {
    switch (sectionId) {
      // ── Marca ───────────────────────────────────────────────
      case "logo":
        return (
          <LogoConfigEditor
            logo={layout.structure?.logo}
            onChange={(logo) => onChange({ ...layout, structure: { ...layout.structure, logo } })}
          />
        );

      case "app-title":
        return (
          <>
            <Field label="App Title" compact>
              <input
                value={layout.structure?.appTitle || ""}
                onChange={(e) => onChange({ ...layout, structure: { ...layout.structure, appTitle: e.target.value } })}
                style={{ ...s.input, maxWidth: 300 }}
                placeholder="Ex: Gatekeeper"
              />
            </Field>
            <div style={{ ...s.infoBox, marginTop: 6, fontSize: 10 }}>
              Fallback para pages sem <code style={{ color: COLORS.accent }}>browserTitle</code>.
              Formato: <code style={{ color: COLORS.textMuted }}>label — appTitle</code>.
            </div>
          </>
        );

      case "favicon":
        return (
          <FaviconEditor
            favicon={layout.structure?.favicon}
            onChange={(fav) => onChange({ ...layout, structure: { ...layout.structure, favicon: fav } })}
          />
        );

      // ── Tipografia ────────────────────────────────────────────
      case "font-tokens": {
        const fontTabs = [
          { id: "families", label: "Families" },
          { id: "sizes", label: "Sizes" },
          { id: "weights", label: "Weights" },
          { id: "lineHeights", label: "Line H." },
          { id: "letterSpacings", label: "Letter Sp." },
        ];
        return (
          <>
            <TabBar tabs={fontTabs} active={fontTab} onChange={setFontTab} />
            {fontTab === "families" && (
              <FontFamilyEditor families={layout.tokens.fontFamilies || {}} onChange={(v) => updateTokenCat("fontFamilies", v)} />
            )}
            {fontTab === "sizes" && (
              <FontSizeEditor sizes={layout.tokens.fontSizes || {}} onChange={(v) => updateTokenCat("fontSizes", v)} />
            )}
            {fontTab === "weights" && (
              <FontWeightEditor weights={layout.tokens.fontWeights || {}} onChange={(v) => updateTokenCat("fontWeights", v)} />
            )}
            {fontTab === "lineHeights" && (
              <LineHeightEditor lineHeights={layout.tokens.lineHeights || {}} onChange={(v) => updateTokenCat("lineHeights", v)} />
            )}
            {fontTab === "letterSpacings" && (
              <LetterSpacingEditor spacings={layout.tokens.letterSpacings || {}} onChange={(v) => updateTokenCat("letterSpacings", v)} />
            )}
          </>
        );
      };

      case "text-styles": {
        const textStyleKeys = Object.keys(layout.textStyles || {});
        const safeActiveTS = textStyleKeys.includes(activeTextStyle) ? activeTextStyle : (textStyleKeys[0] || "");
        return (
          <>
            <p style={{ fontSize: 12, color: COLORS.textDim, margin: "0 0 12px" }}>
              Composições tipográficas nomeadas. Cada text style combina referências a tokens de tipografia.
            </p>

            {textStyleKeys.length > 0 && (
              <TabBar
                tabs={textStyleKeys.map(k => ({ id: k, label: k }))}
                active={safeActiveTS}
                onChange={setActiveTextStyle}
              />
            )}

            {safeActiveTS && layout.textStyles?.[safeActiveTS] && (() => {
              const key = safeActiveTS;
              const style = layout.textStyles[key];
              const css = resolveTextStyleCSS(style, layout.tokens);
              const update = (field: string, val: any) => {
                onChange({ ...layout, textStyles: { ...layout.textStyles, [key]: { ...layout.textStyles[key], [field]: val } } });
              };
              const remove = () => {
                const u = { ...layout.textStyles };
                delete u[key];
                onChange({ ...layout, textStyles: u });
                setActiveTextStyle(Object.keys(u)[0] || "");
              };
              return (
                <div style={s.card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.accent, fontFamily: "'JetBrains Mono', monospace" }}>{key}</span>
                      <input value={style.description || ""} onChange={(e) => update("description", e.target.value)} placeholder="descrição" style={{ ...s.input, fontSize: 10, width: 200 }} />
                    </div>
                    <button onClick={remove} style={s.btnDanger}>✕</button>
                  </div>
                  <div style={s.grid3}>
                    <Field label="Font Family" compact>
                      <TypoRefSelect value={style.fontFamily} tokens={layout.tokens} category="fontFamilies" onChange={(v) => update("fontFamily", v)} />
                    </Field>
                    <Field label="Font Size" compact>
                      <TypoRefSelect value={style.fontSize} tokens={layout.tokens} category="fontSizes" onChange={(v) => update("fontSize", v)} />
                    </Field>
                    <Field label="Font Weight" compact>
                      <TypoRefSelect value={style.fontWeight} tokens={layout.tokens} category="fontWeights" onChange={(v) => update("fontWeight", v)} />
                    </Field>
                    <Field label="Line Height" compact>
                      <TypoRefSelect value={style.lineHeight} tokens={layout.tokens} category="lineHeights" onChange={(v) => update("lineHeight", v)} />
                    </Field>
                    <Field label="Letter Spacing" compact>
                      <TypoRefSelect value={style.letterSpacing} tokens={layout.tokens} category="letterSpacings" onChange={(v) => update("letterSpacing", v)} />
                    </Field>
                  </div>
                  {/* Live preview */}
                  <div style={{
                    background: COLORS.surface2, borderRadius: 5, padding: 10, marginTop: 8,
                    border: `1px solid ${COLORS.border}`, ...css, color: COLORS.text,
                  }}>
                    The quick brown fox jumps over the lazy dog. 0123456789
                  </div>
                </div>
              );
            })()}

            <TextStyleAddButton
              textStyles={layout.textStyles || {}}
              tokens={layout.tokens}
              onChange={(ts) => {
                onChange({ ...layout, textStyles: ts });
                const keys = Object.keys(ts);
                setActiveTextStyle(keys[keys.length - 1] || "");
              }}
            />
          </>
        );
      }

      // ── Layout ────────────────────────────────────────────────
      case "sidebar":
      case "header":
      case "footer":
        return (
          <RegionEditor
            name={sectionId}
            region={layout.structure.regions[sectionId]}
            tokens={layout.tokens}
            onChange={(r) => updateRegion(sectionId, r)}
          />
        );

      case "main":
        return (
          <>
            <RegionEditor
              name="main"
              region={layout.structure.regions.main}
              tokens={layout.tokens}
              onChange={(r) => updateRegion("main", r)}
            />
            <div style={{ marginTop: 16, borderTop: `1px solid ${COLORS.border}`, paddingTop: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: COLORS.text, fontWeight: 600 }}>Content Layout</span>
                <span style={{ ...s.tag }}>main region</span>
              </div>
              <ContentLayoutEditor
                config={layout.structure?.contentLayout}
                onChange={(cl) => onChange({ ...layout, structure: { ...layout.structure, contentLayout: cl } })}
              />
            </div>
          </>
        );

      case "layout-mode":
        return (
          <>
            <Field label="Modo de Layout" compact>
              <select
                value={layout.structure?.layoutMode || "sidebar-first"}
                onChange={(e) => onChange({ ...layout, structure: { ...layout.structure, layoutMode: e.target.value } })}
                style={{ ...s.select, maxWidth: 260 }}
              >
                <option value="sidebar-first">Sidebar Full Height</option>
                <option value="header-first">Header Full Width</option>
              </select>
            </Field>
            <div style={{ ...s.infoBox, marginTop: 8, fontSize: 10 }}>
              <strong style={{ color: COLORS.text }}>sidebar-first</strong> — Sidebar ocupa altura total, header na coluna principal.
              <br />
              <strong style={{ color: COLORS.text }}>header-first</strong> — Header largura total no topo, sidebar abaixo.
            </div>
          </>
        );

      // ── Navegação ──────────────────────────────────────────────
      case "header-elements":
        return (
          <HeaderElementsEditor
            elements={layout.structure?.headerElements}
            textStyles={layout.textStyles}
            onChange={(he) => onChange({ ...layout, structure: { ...layout.structure, headerElements: he } })}
          />
        );

      case "breadcrumbs":
        return (
          <BreadcrumbEditor
            breadcrumbs={layout.structure.breadcrumbs}
            tokens={layout.tokens}
            textStyles={layout.textStyles}
            onChange={(bc) => onChange({ ...layout, structure: { ...layout.structure, breadcrumbs: bc } })}
          />
        );

      case "page-header":
        return (
          <PageHeaderEditor
            config={layout.structure?.pageHeader}
            textStyles={layout.textStyles}
            tokens={layout.tokens}
            onChange={(ph) => onChange({ ...layout, structure: { ...layout.structure, pageHeader: ph } })}
          />
        );

      // ── Cores & Dimensões ────────────────────────────────────
      case "login-page":
        return (
          <LoginPageEditor
            config={layout.structure?.loginPage || {}}
            onChange={(c) => onChange({ ...layout, structure: { ...layout.structure, loginPage: c } })}
            globalLogo={layout.structure?.logo || {}}
            tokens={layout.tokens}
          />
        );

      case "colors":
        return <ColorTokenEditor colors={layout.tokens.colors || {}} onChange={(v) => updateTokenCat("colors", v)} />;

      case "spacing-tokens":
        return <TokenEditor tokens={layout.tokens} onChange={(t) => onChange({ ...layout, tokens: t })} categories={["spacing"]} />;

      case "sizing-tokens":
        return <TokenEditor tokens={layout.tokens} onChange={(t) => onChange({ ...layout, tokens: t })} categories={["sizing"]} />;

      case "border-tokens":
        return <TokenEditor tokens={layout.tokens} onChange={(t) => onChange({ ...layout, tokens: t })} categories={["borderRadius", "borderWidth"]} />;

      // ── Componentes ─────────────────────────────────────────────
      case "nav-style":
        return (
          <NavItemStyleEditor
            region={layout.structure.regions.sidebar || {}}
            tokens={layout.tokens}
            onChange={(r) => updateRegion("sidebar", r)}
          />
        );

      case "sidebar-tooltip":
        return (
          <CollapsedTooltipEditor
            tooltip={layout.structure.regions.sidebar?.collapsedTooltip}
            tokens={layout.tokens}
            onChange={(tt) => updateRegion("sidebar", { ...layout.structure.regions.sidebar, collapsedTooltip: tt })}
          />
        );

      // ── Aparência ─────────────────────────────────────────────
      case "table-sep":
        return (
          <TableSeparatorEditor
            config={layout.structure?.tableSeparator}
            tokens={layout.tokens}
            onChange={(ts) => onChange({ ...layout, structure: { ...layout.structure, tableSeparator: ts } })}
          />
        );

      case "scrollbar": {
        const sb = layout.structure?.scrollbar || {};
        const updateSb = (patch: any) => onChange({ ...layout, structure: { ...layout.structure, scrollbar: { ...sb, ...patch } } });
        return (
          <div style={s.grid2}>
            <Field label="Width" compact>
              <input type="text" value={sb.width || "6px"} onChange={(e) => updateSb({ width: e.target.value })} style={s.input} />
            </Field>
            <Field label="Border Radius" compact>
              <input type="text" value={sb.borderRadius || "3px"} onChange={(e) => updateSb({ borderRadius: e.target.value })} style={s.input} />
            </Field>
            <Field label="Thumb Color" compact>
              <ColorInput value={sb.thumbColor || "rgba(255,255,255,0.08)"} onChange={(v) => updateSb({ thumbColor: v })} />
            </Field>
            <Field label="Thumb Hover" compact>
              <ColorInput value={sb.thumbHoverColor || "rgba(255,255,255,0.15)"} onChange={(v) => updateSb({ thumbHoverColor: v })} />
            </Field>
            <Field label="Track Color" compact>
              <ColorInput value={sb.trackColor || "transparent"} onChange={(v) => updateSb({ trackColor: v })} />
            </Field>
          </div>
        );
      }

      case "toast": {
        const tc = layout.structure?.toast || {};
        const updateTc = (patch: any) => onChange({ ...layout, structure: { ...layout.structure, toast: { ...tc, ...patch } } });
        return (
          <div style={s.grid3}>
            <Field label="Position" compact>
              <select value={tc.position || "bottom-right"} onChange={(e) => updateTc({ position: e.target.value })} style={s.select}>
                <option value="top-left">Top Left</option>
                <option value="top-center">Top Center</option>
                <option value="top-right">Top Right</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="bottom-center">Bottom Center</option>
                <option value="bottom-right">Bottom Right</option>
              </select>
            </Field>
            <Field label="Max Visible" compact>
              <input type="number" min={1} max={10} value={tc.maxVisible || 3} onChange={(e) => updateTc({ maxVisible: parseInt(e.target.value) || 3 })} style={s.input} />
            </Field>
            <Field label="Duration (ms)" compact>
              <input type="number" min={1000} max={30000} step={500} value={tc.duration || 4000} onChange={(e) => updateTc({ duration: parseInt(e.target.value) || 4000 })} style={s.input} />
            </Field>
          </div>
        );
      }

      case "empty-state": {
        const es = layout.structure?.emptyState || {};
        const updateEs = (patch: any) => onChange({ ...layout, structure: { ...layout.structure, emptyState: { ...es, ...patch } } });
        return (
          <>
            <div style={s.grid2}>
              <Field label="Ícone (Lucide ID)" compact>
                <input type="text" value={es.icon || "ph:magnifying-glass"} onChange={(e) => updateEs({ icon: e.target.value })} style={s.input} />
              </Field>
              <Field label="Título" compact>
                <input type="text" value={es.title || "Nenhum item encontrado"} onChange={(e) => updateEs({ title: e.target.value })} style={s.input} />
              </Field>
            </div>
            <Field label="Descrição" compact>
              <input type="text" value={es.description || ""} onChange={(e) => updateEs({ description: e.target.value })} style={s.input} />
            </Field>
            <div style={{ ...s.grid2, marginTop: 4 }}>
              <Field label="Mostrar Ação" compact>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                  <input type="checkbox" checked={es.showAction !== false} onChange={(e) => updateEs({ showAction: e.target.checked })} />
                  <span style={{ fontSize: 11, color: COLORS.textMuted }}>{es.showAction !== false ? "Sim" : "Não"}</span>
                </label>
              </Field>
              <Field label="Label do Botão" compact>
                <input type="text" value={es.actionLabel || "Criar Novo"} onChange={(e) => updateEs({ actionLabel: e.target.value })} style={s.input} />
              </Field>
            </div>
          </>
        );
      }

      case "skeleton": {
        const sk = layout.structure?.skeleton || {};
        const updateSk = (patch: any) => onChange({ ...layout, structure: { ...layout.structure, skeleton: { ...sk, ...patch } } });
        return (
          <>
            <div style={s.grid3}>
              <Field label="Animação" compact>
                <select value={sk.animation || "pulse"} onChange={(e) => updateSk({ animation: e.target.value })} style={s.select}>
                  <option value="pulse">Pulse</option>
                  <option value="shimmer">Shimmer</option>
                  <option value="none">None</option>
                </select>
              </Field>
              <Field label="Duração" compact>
                <input type="text" value={sk.duration || "1.5s"} onChange={(e) => updateSk({ duration: e.target.value })} style={s.input} />
              </Field>
              <Field label="Border Radius" compact>
                <input type="text" value={sk.borderRadius || "6px"} onChange={(e) => updateSk({ borderRadius: e.target.value })} style={s.input} />
              </Field>
            </div>
            <div style={s.grid2}>
              <Field label="Base Color" compact>
                <ColorInput value={sk.baseColor || "rgba(255,255,255,0.05)"} onChange={(v) => updateSk({ baseColor: v })} />
              </Field>
              <Field label="Highlight Color" compact>
                <ColorInput value={sk.highlightColor || "rgba(255,255,255,0.10)"} onChange={(v) => updateSk({ highlightColor: v })} />
              </Field>
            </div>
            {/* Live preview */}
            <div style={{
              marginTop: 10, padding: 10, background: COLORS.surface2, borderRadius: 6,
              border: `1px solid ${COLORS.border}`,
            }}>
              <span style={{ fontSize: 9, color: COLORS.textDim, textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 6, display: "block" }}>Preview</span>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ width: 32, height: 32, borderRadius: sk.borderRadius || "6px", background: sk.baseColor || "rgba(255,255,255,0.05)" }} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
                  <div style={{ height: 10, borderRadius: sk.borderRadius || "6px", background: sk.baseColor || "rgba(255,255,255,0.05)", width: "75%" }} />
                  <div style={{ height: 8, borderRadius: sk.borderRadius || "6px", background: sk.baseColor || "rgba(255,255,255,0.05)", width: "55%" }} />
                </div>
              </div>
            </div>
          </>
        );
      }

      // ── Registros ─────────────────────────────────────────────
      case "pages-editor":
        return <PagesEditor layout={layout} onChange={onChange} />;

      case "ui-registry":
        return <UIRegistryEditor registry={registry} onChange={setRegistry} />;

      default:
        return <div style={{ padding: 20, color: COLORS.textDim }}>Editor not found for section: {sectionId}</div>;
    }
  };

  return (
    <div style={{ padding: "14px 18px", overflow: "auto", height: "100%" }}>
      {/* Breadcrumb */}
      <div style={{
        display: "flex", alignItems: "center", gap: 5, marginBottom: 12,
        fontSize: 10, color: COLORS.textDim, fontFamily: "'Inter', sans-serif",
      }}>
        <span style={{ color: activity.color, fontWeight: 600 }}>{activity.icon} {activity.label}</span>
        <span style={{ opacity: 0.4 }}>/</span>
        <span style={{ color: COLORS.textMuted, fontWeight: 500 }}>{section.label}</span>
      </div>

      {/* Section header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 16, color: activity.color, opacity: 0.8 }}>{section.icon}</span>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: COLORS.text, letterSpacing: "-0.01em" }}>{section.label}</h2>
        </div>
        <p style={{ margin: 0, fontSize: 11, color: COLORS.textDim, lineHeight: 1.4 }}>{section.desc}</p>
      </div>

      {/* Actual editor content */}
      {renderEditor()}
    </div>
  );
}


// ============================================================================
// Sub-components
// ============================================================================

function ActivityBarButton({ activity, isActive, onClick }: { activity: ActivityDef; isActive: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={`${activity.label} (${activity.sections.length})`}
      aria-label={activity.label}
      aria-pressed={isActive}
      style={{
        width: 34, height: 34, borderRadius: 6, border: "none",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: isActive ? activity.color + "14" : hovered ? COLORS.surface2 : "transparent",
        color: isActive ? activity.color : hovered ? COLORS.textMuted : COLORS.textDim,
        cursor: "pointer", fontSize: 15,
        transition: "all 0.15s",
        borderLeft: isActive ? `2px solid ${activity.color}` : "2px solid transparent",
        outline: "none",
        position: "relative" as const,
      }}
    >
      {activity.icon}
    </button>
  );
}

function ExplorerSection({ section, isActive, onClick, color }: { section: SectionDef; isActive: boolean; onClick: () => void; color: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      title={section.desc}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 7,
        padding: "6px 12px", cursor: "pointer",
        background: isActive ? COLORS.accent + "10" : hovered ? COLORS.surface2 + "60" : "transparent",
        borderLeft: isActive ? `2px solid ${COLORS.accent}` : "2px solid transparent",
        transition: "all 0.1s",
        outline: "none",
      }}
    >
      <span style={{
        width: 16, textAlign: "center" as const, fontSize: 10,
        color: isActive ? COLORS.accent : hovered ? color : COLORS.textDim,
        fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, flexShrink: 0,
        transition: "color 0.1s",
      }}>{section.icon}</span>
      <span style={{
        fontSize: 11, color: isActive ? COLORS.text : hovered ? COLORS.textMuted : COLORS.textDim,
        fontWeight: isActive ? 600 : 400, flex: 1,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const,
        transition: "color 0.1s",
      }}>{section.label}</span>
    </div>
  );
}

function EditorTabButton({ tab, isActive, onClose, onClick }: { tab: Tab; isActive: boolean; onClose: () => void; onClick: () => void }) {
  const activity = getActivityForSection(tab.id);
  const color = activity?.color || COLORS.accent;
  const [hovered, setHovered] = useState(false);
  const [closeHovered, setCloseHovered] = useState(false);

  return (
    <div
      role="tab"
      aria-selected={isActive}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "0 10px", height: 32, cursor: "pointer", fontSize: 11,
        background: isActive ? COLORS.bg : hovered ? COLORS.surface2 : "transparent",
        color: isActive ? COLORS.text : COLORS.textDim,
        borderBottom: isActive ? `2px solid ${color}` : "2px solid transparent",
        borderRight: `1px solid ${COLORS.border}`,
        fontWeight: isActive ? 600 : 400,
        whiteSpace: "nowrap" as const,
        transition: "all 0.1s",
        flexShrink: 0,
        outline: "none",
      }}
    >
      <span style={{ fontSize: 9, color, opacity: isActive ? 1 : 0.6 }}>{tab.icon}</span>
      {tab.label}
      <span
        role="button"
        aria-label={`Fechar ${tab.label}`}
        tabIndex={0}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onClose(); } }}
        onMouseEnter={() => setCloseHovered(true)}
        onMouseLeave={() => setCloseHovered(false)}
        style={{
          fontSize: 9, marginLeft: 2, padding: "1px 3px", borderRadius: 3,
          color: closeHovered ? COLORS.text : COLORS.textDim,
          background: closeHovered ? COLORS.surface3 : "transparent",
          cursor: "pointer", transition: "all 0.1s",
          opacity: isActive || hovered ? 1 : 0,
        }}
      >✕</span>
    </div>
  );
}




// ============================================================================
// STACKED WORKBENCH — Main Component
// ============================================================================

interface StackedWorkbenchProps {
  layout: any;
  registry: any;
  setLayout: (l: any) => void;
  setRegistry: (r: any) => void;
}

export function StackedWorkbench({ layout, registry, setLayout, setRegistry }: StackedWorkbenchProps) {
  // ── State ──
  const [activeActivity, setActiveActivity] = useState("brand");
  const [openTabs, setOpenTabs] = useState<Tab[]>([
    { id: "logo", label: "Logo", icon: "⬡" },
  ]);
  const [activeTab, setActiveTab] = useState<string | null>("logo");
  const [bottomPanelOpen, setBottomPanelOpen] = useState(false);
  const [bottomPanelTab, setBottomPanelTab] = useState("import");

  const activity = useMemo(
    () => ACTIVITIES.find(a => a.id === activeActivity),
    [activeActivity]
  );

  const totalSections = useMemo(
    () => ACTIVITIES.reduce((sum, a) => sum + a.sections.length, 0),
    []
  );

  // ── Tab management ──
  const openSection = useCallback((section: SectionDef) => {
    setOpenTabs(prev => {
      if (prev.find(t => t.id === section.id)) return prev;
      return [...prev, { id: section.id, label: section.label, icon: section.icon }];
    });
    setActiveTab(section.id);
  }, []);

  const closeTab = useCallback((id: string) => {
    setOpenTabs(prev => {
      const next = prev.filter(t => t.id !== id);
      if (activeTab === id) {
        setActiveTab(next.length > 0 ? next[next.length - 1].id : null);
      }
      return next;
    });
  }, [activeTab]);

  // When switching activity, auto-focus the first section if no tab from that activity is open
  const handleActivityClick = useCallback((actId: string) => {
    setActiveActivity(actId);
    const act = ACTIVITIES.find(a => a.id === actId);
    if (!act) return;
    // If there's already a tab from this activity, focus it
    const existingTab = openTabs.find(t => act.sections.some(sec => sec.id === t.id));
    if (existingTab) {
      setActiveTab(existingTab.id);
    }
  }, [openTabs]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl/Cmd+W: close current tab
      if ((e.metaKey || e.ctrlKey) && e.key === "w") {
        e.preventDefault();
        if (activeTab) closeTab(activeTab);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeTab, closeTab]);

  // Tab bar scroll ref
  const tabBarRef = useRef<HTMLDivElement>(null);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ============================================================ */}
      {/* MAIN AREA                                                     */}
      {/* ============================================================ */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── Activity Bar (left, 44px) ── */}
        <div style={{
          width: 44, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center",
          background: COLORS.surface, borderRight: `1px solid ${COLORS.border}`,
          paddingTop: 4, gap: 1,
        }}>
          {ACTIVITIES.map(act => (
            <ActivityBarButton
              key={act.id}
              activity={act}
              isActive={activeActivity === act.id}
              onClick={() => handleActivityClick(act.id)}
            />
          ))}

          <div style={{ flex: 1 }} />

          {/* Toggle bottom panel */}
          <ToggleButton
            active={bottomPanelOpen}
            onClick={() => setBottomPanelOpen(p => !p)}
            icon="↔"
            title="Toggle I/O Panel"
            style={{ marginBottom: 4 }}
          />
        </div>

        {/* ── Explorer Sidebar (200px) ── */}
        <div style={{
          width: 200, flexShrink: 0, display: "flex", flexDirection: "column",
          borderRight: `1px solid ${COLORS.border}`, background: COLORS.bg,
        }}>
          {/* Explorer header */}
          <div style={{
            padding: "8px 12px", fontSize: 9, fontWeight: 700,
            color: activity?.color,
            textTransform: "uppercase" as const, letterSpacing: "0.08em",
            borderBottom: `1px solid ${COLORS.border}`,
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <span style={{ fontSize: 11 }}>{activity?.icon}</span>
            {activity?.label}
            <span style={{
              marginLeft: "auto", fontSize: 9, fontWeight: 500,
              color: COLORS.textDim, background: COLORS.surface2,
              padding: "1px 5px", borderRadius: 3,
            }}>
              {activity?.sections.length}
            </span>
          </div>

          {/* Section list */}
          <div style={{ flex: 1, overflow: "auto", paddingTop: 2 }}>
            {activity?.sections.map(section => (
              <ExplorerSection
                key={section.id}
                section={section}
                isActive={activeTab === section.id}
                onClick={() => openSection(section)}
                color={activity.color}
              />
            ))}
          </div>
        </div>

        {/* ── Center + Right ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

            {/* ── Editor Center ── */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Tab bar */}
              <div
                ref={tabBarRef}
                role="tablist"
                style={{
                  display: "flex", flexShrink: 0, overflowX: "auto", overflowY: "hidden",
                  background: COLORS.surface, borderBottom: `1px solid ${COLORS.border}`,
                  minHeight: 33,
                }}
              >
                {openTabs.map(tab => (
                  <EditorTabButton
                    key={tab.id}
                    tab={tab}
                    isActive={activeTab === tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    onClose={() => closeTab(tab.id)}
                  />
                ))}
                <div style={{ flex: 1 }} />
              </div>

              {/* Editor content */}
              <div style={{ flex: 1, overflow: "auto" }}>
                {activeTab ? (
                  <SectionEditorContent
                    sectionId={activeTab}
                    layout={layout}
                    registry={registry}
                    setLayout={setLayout}
                    setRegistry={setRegistry}
                  />
                ) : (
                  <EmptyEditor />
                )}
              </div>
            </div>


          </div>

          {/* ── Bottom Panel (I/O) ── */}
          {bottomPanelOpen && (
            <div style={{
              height: 180, flexShrink: 0, borderTop: `1px solid ${COLORS.border}`,
              background: COLORS.surface, display: "flex", flexDirection: "column",
            }}>
              <div style={{ display: "flex", borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0, alignItems: "center" }}>
                {[
                  { id: "import", label: "Import" },
                  { id: "export", label: "Export" },
                ].map(t => (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={bottomPanelTab === t.id}
                    onClick={() => setBottomPanelTab(t.id)}
                    style={{
                      padding: "5px 12px", border: "none", fontSize: 10, fontWeight: 500,
                      background: "transparent", cursor: "pointer",
                      fontFamily: "'Inter', sans-serif",
                      color: bottomPanelTab === t.id ? COLORS.text : COLORS.textDim,
                      borderBottom: bottomPanelTab === t.id ? `2px solid ${COLORS.accent}` : "2px solid transparent",
                      transition: "all 0.1s",
                      outline: "none",
                    }}
                  >{t.label}</button>
                ))}
                <div style={{ flex: 1 }} />
                <button
                  onClick={() => setBottomPanelOpen(false)}
                  aria-label="Fechar painel"
                  style={{
                    background: "none", border: "none", color: COLORS.textDim,
                    fontSize: 10, cursor: "pointer", padding: "0 10px",
                    outline: "none",
                  }}
                >✕</button>
              </div>
              <div style={{ flex: 1, overflow: "auto", padding: 10 }}>
                {bottomPanelTab === "import" && (
                  <ImportPanel onImportLayout={setLayout} onImportRegistry={setRegistry} />
                )}
                {bottomPanelTab === "export" && (
                  <ExportPanel layout={layout} registry={registry} />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* STATUS BAR                                                    */}
      {/* ============================================================ */}
      <div style={{
        height: 22, flexShrink: 0, display: "flex", alignItems: "center", padding: "0 10px", gap: 10,
        background: COLORS.surface, fontSize: 9, color: COLORS.textDim,
        borderTop: `1px solid ${COLORS.border}`,
        fontFamily: "'Inter', sans-serif",
      }}>
        <span style={{ color: COLORS.accent, fontWeight: 600, letterSpacing: "0.02em" }}>Orqui</span>
        <span style={{ color: COLORS.border }}>|</span>
        {activeTab && (() => {
          const sec = getSectionDef(activeTab);
          const act = getActivityForSection(activeTab);
          return sec && act ? (
            <span style={{ color: act.color, fontWeight: 500 }}>{act.label} / {sec.label}</span>
          ) : null;
        })()}
        <div style={{ flex: 1 }} />
        <span>{openTabs.length} tab{openTabs.length !== 1 ? "s" : ""}</span>
        <span style={{ color: COLORS.border }}>|</span>
        <span>{totalSections} seções</span>
      </div>
    </div>
  );
}


// ============================================================================
// Small helper components
// ============================================================================

function ToggleButton({ active, onClick, icon, title, style: st }: {
  active: boolean; onClick: () => void; icon: string; title: string; style?: React.CSSProperties;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={title}
      aria-pressed={active}
      style={{
        width: 32, height: 32, borderRadius: 5, border: "none",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: active ? COLORS.accent + "14" : hovered ? COLORS.surface2 : "transparent",
        color: active ? COLORS.accent : hovered ? COLORS.textMuted : COLORS.textDim,
        cursor: "pointer", fontSize: 13,
        transition: "all 0.15s",
        outline: "none",
        ...st,
      }}
    >{icon}</button>
  );
}

function EmptyEditor() {
  return (
    <div style={{
      height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", gap: 8,
    }}>
      <div style={{ fontSize: 36, opacity: 0.08, color: COLORS.textDim }}>⧉</div>
      <div style={{ fontSize: 12, color: COLORS.textDim, fontWeight: 500 }}>Selecione uma seção no explorer</div>
      <div style={{
        fontSize: 10, color: COLORS.textDim + "60",
        display: "flex", alignItems: "center", gap: 4,
      }}>
        <kbd style={{
          background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 3,
          padding: "1px 5px", fontSize: 9, fontFamily: "'JetBrains Mono', monospace",
        }}>Ctrl+W</kbd>
        fecha a tab ativa
      </div>
    </div>
  );
}
