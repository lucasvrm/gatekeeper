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
import { RegionEditor } from "../editors/RegionEditors";
import { LogoConfigEditor, FaviconEditor } from "../editors/LogoConfigEditor";
import {
  BreadcrumbEditor, ContentLayoutEditor, PageHeaderEditor, TableSeparatorEditor,
} from "../editors/ContentLayoutEditor";
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
    id: "identity", icon: "◆", label: "Identidade", color: "#fbbf24",
    sections: [
      { id: "logo", label: "Logo", icon: "⬡", desc: "tipo, texto, ícone, imagem, posição, alinhamento" },
      { id: "favicon", label: "Favicon", icon: "★", desc: "emoji, URL, cor de fundo" },
      { id: "app-title", label: "App Title", icon: "T", desc: "título padrão do app (fallback browser tab)" },
      { id: "colors", label: "Cores", icon: "◆", desc: "backgrounds, texto, bordas, accent, status" },
    ],
  },
  {
    id: "shell", icon: "□", label: "Shell", color: "#3b82f6",
    sections: [
      { id: "layout-mode", label: "Layout Mode", icon: "⊞", desc: "sidebar-first | header-first" },
      { id: "sidebar", label: "Sidebar", icon: "◧", desc: "dimensões, padding, comportamento, navegação" },
      { id: "header", label: "Header", icon: "▬", desc: "dimensões, zonas, separador" },
      { id: "main", label: "Main", icon: "◻", desc: "padding, comportamento, scroll" },
      { id: "footer", label: "Footer", icon: "▭", desc: "dimensões, padding, separador" },
      { id: "header-elements", label: "Header Elements", icon: "▤", desc: "search, icons, CTAs, ordem" },
    ],
  },
  {
    id: "typography", icon: "Aa", label: "Tipografia", color: "#f97316",
    sections: [
      { id: "font-tokens", label: "Fontes", icon: "Ff", desc: "families, sizes, weights, heights, spacings" },
      { id: "text-styles", label: "Text Styles", icon: "Ts", desc: "composições tipográficas nomeadas" },
    ],
  },
  {
    id: "content", icon: "⊡", label: "Conteúdo", color: "#22c55e",
    sections: [
      { id: "content-layout", label: "Content Layout", icon: "⊟", desc: "maxWidth, centralização, CSS Grid" },
      { id: "page-header", label: "Page Header", icon: "H", desc: "título, subtítulo, divider, text style" },
      { id: "breadcrumbs", label: "Breadcrumbs", icon: "»", desc: "separador, home, text style" },
      { id: "spacing-sizing", label: "Spacing & Sizing", icon: "⊞", desc: "spacing, sizing, border-radius, border-width" },
    ],
  },
  {
    id: "appearance", icon: "◎", label: "Aparência", color: "#8b5cf6",
    sections: [
      { id: "toast", label: "Toast", icon: "◻", desc: "posição, máximo visível, duração" },
      { id: "skeleton", label: "Loading Skeleton", icon: "▤", desc: "animação, duração, cores, raio" },
      { id: "empty-state", label: "Empty State", icon: "◇", desc: "ícone, título, descrição, ação" },
      { id: "scrollbar", label: "Scrollbar", icon: "▐", desc: "largura, raio, cores do thumb e track" },
      { id: "table-sep", label: "Table Separator", icon: "≡", desc: "cor, largura, estilo" },
    ],
  },
  {
    id: "data", icon: "⧉", label: "Dados", color: "#ef4444",
    sections: [
      { id: "pages-editor", label: "Páginas", icon: "⊡", desc: "CRUD, label, route, browserTitle, overrides" },
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
  const section = getSectionDef(sectionId);
  const activity = getActivityForSection(sectionId);
  const [activeTextStyle, setActiveTextStyle] = usePersistentTab("sw-textstyle", "");

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
            <Field label="Título padrão do app (fallback para pages sem browserTitle)">
              <input
                value={layout.structure?.appTitle || ""}
                onChange={(e) => onChange({ ...layout, structure: { ...layout.structure, appTitle: e.target.value } })}
                style={s.input}
                placeholder="Ex: Gatekeeper"
              />
            </Field>
            <div style={s.infoBox}>
              Cada página pode definir seu <strong style={{ color: COLORS.text }}>browserTitle</strong> em Páginas.
              Se não definido, usa: <code style={{ color: COLORS.accent }}>label — appTitle</code>.
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
        const [fontTab, setFontTab] = usePersistentTab("sw-font-tab", "families");
        const fontTabs = [
          { id: "families", label: "Families" },
          { id: "sizes", label: "Sizes" },
          { id: "weights", label: "Weights" },
          { id: "lineHeights", label: "Line Heights" },
          { id: "letterSpacings", label: "Letter Spacings" },
        ];
        return (
          <>
            <TabBar tabs={fontTabs} active={fontTab} onChange={setFontTab} />
            <div style={{ marginTop: 16 }}>
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
            </div>
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
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.accent, fontFamily: "'JetBrains Mono', monospace" }}>{key}</div>
                      <input value={style.description || ""} onChange={(e) => update("description", e.target.value)} placeholder="descrição" style={{ ...s.input, fontSize: 11, marginTop: 4, width: 250 }} />
                    </div>
                    <button onClick={remove} style={s.btnDanger}>✕</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                    <Field label="Font Family" style={{ marginBottom: 0 }}>
                      <TypoRefSelect value={style.fontFamily} tokens={layout.tokens} category="fontFamilies" onChange={(v) => update("fontFamily", v)} />
                    </Field>
                    <Field label="Font Size" style={{ marginBottom: 0 }}>
                      <TypoRefSelect value={style.fontSize} tokens={layout.tokens} category="fontSizes" onChange={(v) => update("fontSize", v)} />
                    </Field>
                    <Field label="Font Weight" style={{ marginBottom: 0 }}>
                      <TypoRefSelect value={style.fontWeight} tokens={layout.tokens} category="fontWeights" onChange={(v) => update("fontWeight", v)} />
                    </Field>
                    <Field label="Line Height" style={{ marginBottom: 0 }}>
                      <TypoRefSelect value={style.lineHeight} tokens={layout.tokens} category="lineHeights" onChange={(v) => update("lineHeight", v)} />
                    </Field>
                    <Field label="Letter Spacing" style={{ marginBottom: 0 }}>
                      <TypoRefSelect value={style.letterSpacing} tokens={layout.tokens} category="letterSpacings" onChange={(v) => update("letterSpacing", v)} />
                    </Field>
                  </div>
                  <div style={{ background: COLORS.surface2, borderRadius: 6, padding: 12, ...css, color: COLORS.text }}>
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
      case "main":
      case "footer":
        return (
          <RegionEditor
            name={sectionId}
            region={layout.structure.regions[sectionId]}
            tokens={layout.tokens}
            onChange={(r) => updateRegion(sectionId, r)}
          />
        );

      case "layout-mode":
        return (
          <>
            <Row>
              <Field label="Modo">
                <select
                  value={layout.structure?.layoutMode || "sidebar-first"}
                  onChange={(e) => onChange({ ...layout, structure: { ...layout.structure, layoutMode: e.target.value } })}
                  style={s.select}
                >
                  <option value="sidebar-first">Sidebar Full Height</option>
                  <option value="header-first">Header Full Width</option>
                </select>
              </Field>
            </Row>
            <div style={s.infoBox}>
              <strong style={{ color: COLORS.text }}>sidebar-first:</strong> Sidebar ocupa altura total, header fica na coluna principal.
              <br />
              <strong style={{ color: COLORS.text }}>header-first:</strong> Header ocupa largura total no topo, sidebar começa abaixo dele.
            </div>
          </>
        );

      case "content-layout":
        return (
          <ContentLayoutEditor
            config={layout.structure?.contentLayout}
            onChange={(cl) => onChange({ ...layout, structure: { ...layout.structure, contentLayout: cl } })}
          />
        );

      // ── Navegação ──────────────────────────────────────────────
      case "header-elements":
        return (
          <HeaderElementsEditor
            elements={layout.structure?.headerElements}
            onChange={(he) => onChange({ ...layout, structure: { ...layout.structure, headerElements: he } })}
          />
        );

      case "breadcrumbs":
        return (
          <BreadcrumbEditor
            breadcrumbs={layout.structure.breadcrumbs}
            tokens={layout.tokens}
            onChange={(bc) => onChange({ ...layout, structure: { ...layout.structure, breadcrumbs: bc } })}
          />
        );

      case "page-header":
        return (
          <PageHeaderEditor
            config={layout.structure?.pageHeader}
            textStyles={layout.textStyles}
            onChange={(ph) => onChange({ ...layout, structure: { ...layout.structure, pageHeader: ph } })}
          />
        );

      // ── Cores & Dimensões ────────────────────────────────────
      case "colors":
        return <ColorTokenEditor colors={layout.tokens.colors || {}} onChange={(v) => updateTokenCat("colors", v)} />;

      case "spacing-sizing":
        return <TokenEditor tokens={layout.tokens} onChange={(t) => onChange({ ...layout, tokens: t })} />;

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
          <>
            <Row>
              <Field label="Width">
                <input type="text" value={sb.width || "6px"} onChange={(e) => updateSb({ width: e.target.value })} style={s.input} />
              </Field>
              <Field label="Border Radius">
                <input type="text" value={sb.borderRadius || "3px"} onChange={(e) => updateSb({ borderRadius: e.target.value })} style={s.input} />
              </Field>
            </Row>
            <Row>
              <Field label="Thumb Color">
                <ColorInput value={sb.thumbColor || "rgba(255,255,255,0.08)"} onChange={(v) => updateSb({ thumbColor: v })} />
              </Field>
              <Field label="Thumb Hover">
                <ColorInput value={sb.thumbHoverColor || "rgba(255,255,255,0.15)"} onChange={(v) => updateSb({ thumbHoverColor: v })} />
              </Field>
            </Row>
            <Row>
              <Field label="Track Color">
                <ColorInput value={sb.trackColor || "transparent"} onChange={(v) => updateSb({ trackColor: v })} />
              </Field>
            </Row>
          </>
        );
      }

      case "toast": {
        const tc = layout.structure?.toast || {};
        const updateTc = (patch: any) => onChange({ ...layout, structure: { ...layout.structure, toast: { ...tc, ...patch } } });
        return (
          <>
            <Row>
              <Field label="Position">
                <select value={tc.position || "bottom-right"} onChange={(e) => updateTc({ position: e.target.value })} style={s.select}>
                  <option value="top-left">Top Left</option>
                  <option value="top-center">Top Center</option>
                  <option value="top-right">Top Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="bottom-center">Bottom Center</option>
                  <option value="bottom-right">Bottom Right</option>
                </select>
              </Field>
            </Row>
            <Row>
              <Field label="Max Visible">
                <input type="number" min={1} max={10} value={tc.maxVisible || 3} onChange={(e) => updateTc({ maxVisible: parseInt(e.target.value) || 3 })} style={s.input} />
              </Field>
              <Field label="Duration (ms)">
                <input type="number" min={1000} max={30000} step={500} value={tc.duration || 4000} onChange={(e) => updateTc({ duration: parseInt(e.target.value) || 4000 })} style={s.input} />
              </Field>
            </Row>
          </>
        );
      }

      case "empty-state": {
        const es = layout.structure?.emptyState || {};
        const updateEs = (patch: any) => onChange({ ...layout, structure: { ...layout.structure, emptyState: { ...es, ...patch } } });
        return (
          <>
            <Row>
              <Field label="Ícone (Phosphor ID)">
                <input type="text" value={es.icon || "ph:magnifying-glass"} onChange={(e) => updateEs({ icon: e.target.value })} style={s.input} />
              </Field>
            </Row>
            <Row>
              <Field label="Título">
                <input type="text" value={es.title || "Nenhum item encontrado"} onChange={(e) => updateEs({ title: e.target.value })} style={s.input} />
              </Field>
            </Row>
            <Row>
              <Field label="Descrição">
                <input type="text" value={es.description || ""} onChange={(e) => updateEs({ description: e.target.value })} style={s.input} />
              </Field>
            </Row>
            <Row>
              <Field label="Mostrar Ação">
                <input type="checkbox" checked={es.showAction !== false} onChange={(e) => updateEs({ showAction: e.target.checked })} />
              </Field>
              <Field label="Label do Botão">
                <input type="text" value={es.actionLabel || "Criar Novo"} onChange={(e) => updateEs({ actionLabel: e.target.value })} style={s.input} />
              </Field>
            </Row>
          </>
        );
      }

      case "skeleton": {
        const sk = layout.structure?.skeleton || {};
        const updateSk = (patch: any) => onChange({ ...layout, structure: { ...layout.structure, skeleton: { ...sk, ...patch } } });
        return (
          <>
            <Row>
              <Field label="Animação">
                <select value={sk.animation || "pulse"} onChange={(e) => updateSk({ animation: e.target.value })} style={s.select}>
                  <option value="pulse">Pulse</option>
                  <option value="shimmer">Shimmer</option>
                  <option value="none">None</option>
                </select>
              </Field>
              <Field label="Duração">
                <input type="text" value={sk.duration || "1.5s"} onChange={(e) => updateSk({ duration: e.target.value })} style={s.input} />
              </Field>
            </Row>
            <Row>
              <Field label="Base Color">
                <ColorInput value={sk.baseColor || "rgba(255,255,255,0.05)"} onChange={(v) => updateSk({ baseColor: v })} />
              </Field>
              <Field label="Highlight Color">
                <ColorInput value={sk.highlightColor || "rgba(255,255,255,0.10)"} onChange={(v) => updateSk({ highlightColor: v })} />
              </Field>
            </Row>
            <Row>
              <Field label="Border Radius">
                <input type="text" value={sk.borderRadius || "6px"} onChange={(e) => updateSk({ borderRadius: e.target.value })} style={s.input} />
              </Field>
            </Row>
            {/* Live preview */}
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 10, color: COLORS.textDim, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>Preview</span>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 40, height: 40, borderRadius: sk.borderRadius || "6px", background: sk.baseColor || "rgba(255,255,255,0.05)" }} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ height: 12, borderRadius: sk.borderRadius || "6px", background: sk.baseColor || "rgba(255,255,255,0.05)", width: "80%" }} />
                  <div style={{ height: 10, borderRadius: sk.borderRadius || "6px", background: sk.baseColor || "rgba(255,255,255,0.05)", width: "60%" }} />
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
    <div style={{ padding: 20, overflow: "auto", height: "100%" }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16, fontSize: 11, color: COLORS.textDim }}>
        <span style={{ color: activity.color, fontWeight: 600 }}>{activity.label}</span>
        <span>›</span>
        <span style={{ color: COLORS.text, fontWeight: 600 }}>{section.label}</span>
      </div>

      {/* Section header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 20, color: activity.color }}>{section.icon}</span>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: COLORS.text }}>{section.label}</h2>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: COLORS.textDim, lineHeight: 1.5 }}>{section.desc}</p>
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
      title={activity.label}
      style={{
        width: 36, height: 36, borderRadius: 6, border: "none",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: isActive ? COLORS.accent + "12" : hovered ? COLORS.surface2 : "transparent",
        color: isActive ? activity.color : hovered ? COLORS.text : COLORS.textDim,
        cursor: "pointer", fontSize: 16,
        transition: "all 0.15s",
        borderLeft: isActive ? `2px solid ${activity.color}` : "2px solid transparent",
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
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 12px", cursor: "pointer",
        background: isActive ? COLORS.accent + "12" : hovered ? COLORS.surface2 + "80" : "transparent",
        borderLeft: isActive ? `2px solid ${COLORS.accent}` : "2px solid transparent",
        transition: "all 0.1s",
      }}
    >
      <span style={{
        width: 18, textAlign: "center" as const, fontSize: 11,
        color: isActive ? COLORS.accent : color,
        fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, flexShrink: 0,
      }}>{section.icon}</span>
      <span style={{
        fontSize: 12, color: isActive ? COLORS.text : COLORS.textMuted,
        fontWeight: isActive ? 600 : 400, flex: 1,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const,
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
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "0 12px", height: 34, cursor: "pointer", fontSize: 12,
        background: isActive ? COLORS.bg : hovered ? COLORS.surface2 : "transparent",
        color: isActive ? COLORS.text : COLORS.textDim,
        borderBottom: isActive ? `2px solid ${color}` : "2px solid transparent",
        borderRight: `1px solid ${COLORS.border}`,
        fontWeight: isActive ? 600 : 400,
        whiteSpace: "nowrap" as const,
        transition: "all 0.1s",
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 10, color }}>{tab.icon}</span>
      {tab.label}
      <span
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        onMouseEnter={() => setCloseHovered(true)}
        onMouseLeave={() => setCloseHovered(false)}
        style={{
          fontSize: 10, marginLeft: 4, padding: "1px 3px", borderRadius: 3,
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

        {/* ── Activity Bar (left, 48px) ── */}
        <div style={{
          width: 48, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center",
          background: COLORS.surface, borderRight: `1px solid ${COLORS.border}`,
          paddingTop: 6, gap: 2,
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
            style={{ marginBottom: 6 }}
          />
        </div>

        {/* ── Explorer Sidebar (220px) ── */}
        <div style={{
          width: 220, flexShrink: 0, display: "flex", flexDirection: "column",
          borderRight: `1px solid ${COLORS.border}`, background: COLORS.bg,
        }}>
          {/* Explorer header */}
          <div style={{
            padding: "10px 12px", fontSize: 10, fontWeight: 700,
            color: activity?.color,
            textTransform: "uppercase" as const, letterSpacing: "0.08em",
            borderBottom: `1px solid ${COLORS.border}`,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ fontSize: 12 }}>{activity?.icon}</span>
            {activity?.label}
            <span style={{ marginLeft: "auto", fontSize: 9, color: COLORS.textDim, fontWeight: 400 }}>
              {activity?.sections.length}
            </span>
          </div>

          {/* Section list */}
          <div style={{ flex: 1, overflow: "auto", paddingTop: 4 }}>
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
                style={{
                  display: "flex", flexShrink: 0, overflowX: "auto", overflowY: "hidden",
                  background: COLORS.surface, borderBottom: `1px solid ${COLORS.border}`,
                  minHeight: 36,
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
              height: 200, flexShrink: 0, borderTop: `1px solid ${COLORS.border}`,
              background: COLORS.surface, display: "flex", flexDirection: "column",
            }}>
              <div style={{ display: "flex", borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0 }}>
                {[
                  { id: "import", label: "Import" },
                  { id: "export", label: "Export" },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setBottomPanelTab(t.id)}
                    style={{
                      padding: "7px 14px", border: "none", fontSize: 11, fontWeight: 500,
                      background: "transparent", cursor: "pointer",
                      fontFamily: "'Inter', sans-serif",
                      color: bottomPanelTab === t.id ? COLORS.text : COLORS.textDim,
                      borderBottom: bottomPanelTab === t.id ? `2px solid ${COLORS.accent}` : "2px solid transparent",
                      transition: "all 0.1s",
                    }}
                  >{t.label}</button>
                ))}
                <div style={{ flex: 1 }} />
                <button
                  onClick={() => setBottomPanelOpen(false)}
                  style={{
                    background: "none", border: "none", color: COLORS.textDim,
                    fontSize: 12, cursor: "pointer", padding: "0 12px",
                  }}
                >✕</button>
              </div>
              <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
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
        height: 24, flexShrink: 0, display: "flex", alignItems: "center", padding: "0 12px", gap: 12,
        background: COLORS.accent + "10", fontSize: 10, color: COLORS.textDim,
        borderTop: `1px solid ${COLORS.border}`,
      }}>
        <span style={{ color: COLORS.accent, fontWeight: 600 }}>◆ Stacked Workbench</span>
        <div style={{ flex: 1 }} />
        <span>{ACTIVITIES.length} atividades</span>
        <span style={{ color: COLORS.border }}>•</span>
        <span>{totalSections} seções</span>
        <span style={{ color: COLORS.border }}>•</span>
        <span>{openTabs.length} tab{openTabs.length !== 1 ? "s" : ""}</span>
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
      style={{
        width: 36, height: 36, borderRadius: 6, border: "none",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: active ? COLORS.accent + "12" : hovered ? COLORS.surface2 : "transparent",
        color: active ? COLORS.accent : hovered ? COLORS.text : COLORS.textDim,
        cursor: "pointer", fontSize: 14,
        transition: "all 0.15s",
        ...st,
      }}
    >{icon}</button>
  );
}

function EmptyEditor() {
  return (
    <div style={{
      height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", gap: 12,
    }}>
      <div style={{ fontSize: 48, opacity: 0.1, color: COLORS.textDim }}>⧉</div>
      <div style={{ fontSize: 13, color: COLORS.textDim }}>Selecione uma seção no explorer</div>
      <div style={{ fontSize: 11, color: COLORS.textDim + "80" }}>ou use ⌘K para buscar</div>
    </div>
  );
}
