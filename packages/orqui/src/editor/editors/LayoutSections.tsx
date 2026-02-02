import React, { useState } from "react";
import { COLORS, s } from "../lib/constants";
import { resolveTextStyleCSS } from "../lib/utils";
import { Field, Row, Section, WBSection, WBSub, SectionGroup, TabBar, ColorInput } from "../components/shared";
import { usePersistentTab } from "../hooks/usePersistentState";
import { ColorTokenEditor, TokenEditor } from "./ColorTokenEditor";
import { TypoRefSelect, FontFamilyEditor, FontSizeEditor, FontWeightEditor, LineHeightEditor, LetterSpacingEditor, TextStyleAddButton } from "./TypographyEditors";
import { RegionEditor } from "./RegionEditors";
import { LogoConfigEditor, FaviconEditor } from "./LogoConfigEditor";
import { BreadcrumbEditor, SeparatorEditor, ContentLayoutEditor, PageHeaderEditor, TableSeparatorEditor } from "./ContentLayoutEditor";
import { HeaderElementsEditor } from "./HeaderElementsEditor";
import { PagesEditor } from "./PagesEditor";
import { ExportPanel } from "../panels/ExportPanel";
import { ImportPanel } from "../panels/ImportPanel";

export function LayoutSections({ layout, registry, setLayout, setRegistry }: { layout: any; registry: any; setLayout: (l: any) => void; setRegistry: (r: any) => void }) {
  const onChange = setLayout;
  const [activeTextStyle, setActiveTextStyle] = usePersistentTab("layout-textstyle", "");

  const updateRegion = (name: string, region: any) => {
    onChange({ ...layout, structure: { ...layout.structure, regions: { ...layout.structure.regions, [name]: region } } });
  };
  const updateTokenCat = (cat: string, val: any) => {
    onChange({ ...layout, tokens: { ...layout.tokens, [cat]: val } });
  };

  const textStyleKeys = Object.keys(layout.textStyles || {});
  const safeActiveTS = textStyleKeys.includes(activeTextStyle) ? activeTextStyle : (textStyleKeys[0] || "");

  const DOT = { brand: "#f59e0b", layout: "#3b82f6", header: "#22c55e", tokens: "#a855f7", typo: "#a1a1aa", pages: "#ef4444", io: "#6d9cff", ui: "#8b5cf6" };

  return (
    <div>

      {/* ================================================================ */}
      {/* IDENTIDADE                                                      */}
      {/* ================================================================ */}
      <SectionGroup icon="🟡" label="Identidade" color={DOT.brand}>

        <WBSection title="Logo & Favicon" dotColor={DOT.brand} tag="logo + favicon + título" id="sec-brand" defaultOpen={true}>
          <LogoConfigEditor
            logo={layout.structure?.logo}
            onChange={(logo) => onChange({ ...layout, structure: { ...layout.structure, logo } })}
          />
          <WBSub title="App Title (navegador)">
            <Field label="Título padrão do app (fallback para pages sem browserTitle)">
              <input value={layout.structure?.appTitle || ""} onChange={(e) => onChange({ ...layout, structure: { ...layout.structure, appTitle: e.target.value } })} style={s.input} placeholder="Ex: Gatekeeper" />
            </Field>
            <p style={{ fontSize: 11, color: COLORS.textDim, marginTop: 6, lineHeight: 1.5, margin: "6px 0 0" }}>
              Cada página pode definir seu <strong style={{ color: COLORS.text }}>browserTitle</strong> em Páginas.
              Se não definido, usa: <code style={{ color: COLORS.accent }}>label — appTitle</code>.
            </p>
          </WBSub>
          <WBSub title="Favicon">
            <FaviconEditor
              favicon={layout.structure?.favicon}
              onChange={(fav) => onChange({ ...layout, structure: { ...layout.structure, favicon: fav } })}
            />
          </WBSub>
        </WBSection>

        <WBSection title="Tipografia & Text Styles" dotColor={DOT.typo} id="sec-typo" defaultOpen={false}>
          <Section title={`Font Families (${Object.keys(layout.tokens.fontFamilies || {}).length})`} defaultOpen={false} id="wb-font-families">
            <FontFamilyEditor families={layout.tokens.fontFamilies || {}} onChange={(v) => updateTokenCat("fontFamilies", v)} />
          </Section>
          <Section title={`Font Sizes (${Object.keys(layout.tokens.fontSizes || {}).length})`} defaultOpen={false} id="wb-font-sizes">
            <FontSizeEditor sizes={layout.tokens.fontSizes || {}} onChange={(v) => updateTokenCat("fontSizes", v)} />
          </Section>
          <Section title={`Font Weights (${Object.keys(layout.tokens.fontWeights || {}).length})`} defaultOpen={false} id="wb-font-weights">
            <FontWeightEditor weights={layout.tokens.fontWeights || {}} onChange={(v) => updateTokenCat("fontWeights", v)} />
          </Section>
          <Section title={`Line Heights (${Object.keys(layout.tokens.lineHeights || {}).length})`} defaultOpen={false} id="wb-line-heights">
            <LineHeightEditor lineHeights={layout.tokens.lineHeights || {}} onChange={(v) => updateTokenCat("lineHeights", v)} />
          </Section>
          <Section title={`Letter Spacings (${Object.keys(layout.tokens.letterSpacings || {}).length})`} defaultOpen={false} id="wb-letter-spacings">
            <LetterSpacingEditor spacings={layout.tokens.letterSpacings || {}} onChange={(v) => updateTokenCat("letterSpacings", v)} />
          </Section>

          <WBSub title="Text Styles">
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 12, color: COLORS.textDim, margin: 0 }}>Composições tipográficas nomeadas. Cada text style combina referências a tokens de tipografia.</p>
            </div>

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
                <div style={{ ...s.card }}>
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

            <TextStyleAddButton textStyles={layout.textStyles || {}} tokens={layout.tokens} onChange={(ts) => {
              onChange({ ...layout, textStyles: ts });
              const keys = Object.keys(ts);
              setActiveTextStyle(keys[keys.length - 1] || "");
            }} />
          </WBSub>
        </WBSection>

      </SectionGroup>

      {/* ================================================================ */}
      {/* ESTRUTURA                                                       */}
      {/* ================================================================ */}
      <SectionGroup icon="🔵" label="Estrutura" color={DOT.layout}>

        <WBSection title="Regiões" dotColor={DOT.layout} tag="sidebar · header · main · footer" id="sec-layout" defaultOpen={true}>
          {(["sidebar", "header", "main", "footer"] as const).map(name => (
            <Section
              key={name}
              title={<span>{name.charAt(0).toUpperCase() + name.slice(1)} <span style={{ color: layout.structure.regions[name]?.enabled ? COLORS.success : COLORS.textDim }}>{layout.structure.regions[name]?.enabled ? "●" : "○"}</span></span>}
              defaultOpen={name === "sidebar"}
              id={`wb-region-${name}`}
            >
              <RegionEditor
                name={name}
                region={layout.structure.regions[name]}
                tokens={layout.tokens}
                onChange={(r) => updateRegion(name, r)}
              />
            </Section>
          ))}
        </WBSection>

        <WBSection title="Layout Mode" dotColor={DOT.layout} tag="sidebar-first · header-first" id="sec-layout-mode" defaultOpen={false}>
          <Row>
            <Field label="Modo">
              <select
                value={layout.structure?.layoutMode || "sidebar-first"}
                onChange={(e) => onChange({ ...layout, structure: { ...layout.structure, layoutMode: e.target.value } })}
                style={{ width: "100%", background: COLORS.surface2, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 12 }}
              >
                <option value="sidebar-first">Sidebar Full Height</option>
                <option value="header-first">Header Full Width</option>
              </select>
            </Field>
          </Row>
          <p style={{ fontSize: 11, color: COLORS.textDim, marginTop: 8, lineHeight: 1.5 }}>
            <strong style={{ color: COLORS.text }}>sidebar-first:</strong> Sidebar ocupa altura total, header fica na coluna principal.<br/>
            <strong style={{ color: COLORS.text }}>header-first:</strong> Header ocupa largura total no topo, sidebar começa abaixo dele.
          </p>
        </WBSection>

        <WBSection title="Content Layout" dotColor={DOT.layout} tag="grid · maxWidth · centering" id="sec-content-layout" defaultOpen={false}>
          <ContentLayoutEditor
            config={layout.structure?.contentLayout}
            onChange={(cl) => onChange({ ...layout, structure: { ...layout.structure, contentLayout: cl } })}
          />
        </WBSection>

        <WBSection title="Breadcrumbs" dotColor={DOT.layout} tag={layout.structure.breadcrumbs?.enabled ? "ativo" : "inativo"} id="sec-breadcrumbs" defaultOpen={false}>
          <BreadcrumbEditor
            breadcrumbs={layout.structure.breadcrumbs}
            tokens={layout.tokens}
            onChange={(bc) => onChange({ ...layout, structure: { ...layout.structure, breadcrumbs: bc } })}
          />
        </WBSection>

      </SectionGroup>

      {/* ================================================================ */}
      {/* NAVEGAÇÃO & HEADER                                              */}
      {/* ================================================================ */}
      <SectionGroup icon="🟢" label="Navegação & Header" color={DOT.header}>

        <WBSection title="Header Elements" dotColor={DOT.header} tag="busca · cta · ícones · ordem" id="sec-header" defaultOpen={false}>
          <HeaderElementsEditor
            elements={layout.structure?.headerElements}
            onChange={(he) => onChange({ ...layout, structure: { ...layout.structure, headerElements: he } })}
          />
        </WBSection>

        <WBSection title="Page Header" dotColor={DOT.header} tag="título · subtítulo · divider" id="sec-page-header" defaultOpen={false}>
          <PageHeaderEditor
            config={layout.structure?.pageHeader}
            onChange={(ph) => onChange({ ...layout, structure: { ...layout.structure, pageHeader: ph } })}
          />
        </WBSection>

      </SectionGroup>

      {/* ================================================================ */}
      {/* DESIGN TOKENS                                                   */}
      {/* ================================================================ */}
      <SectionGroup icon="🟣" label="Design Tokens" color={DOT.tokens}>

        <WBSection title="Cores" dotColor={DOT.tokens} tag={`${Object.keys(layout.tokens.colors || {}).length} tokens`} id="sec-colors" defaultOpen={false}>
          <ColorTokenEditor colors={layout.tokens.colors || {}} onChange={(v) => updateTokenCat("colors", v)} />
        </WBSection>

        <WBSection title="Spacing & Sizing" dotColor={DOT.tokens} tag="spacing · sizing · radius · border" id="sec-spacing" defaultOpen={false}>
          <TokenEditor tokens={layout.tokens} onChange={(t) => onChange({ ...layout, tokens: t })} />
        </WBSection>

      </SectionGroup>

      {/* ================================================================ */}
      {/* COMPONENTES UI                                                  */}
      {/* ================================================================ */}
      <SectionGroup icon="⚪" label="Componentes UI" color={DOT.ui}>

        <WBSection title="Table Separator" dotColor={DOT.ui} tag="linhas · cor · espessura" id="sec-table-sep" defaultOpen={false}>
          <TableSeparatorEditor
            config={layout.structure?.tableSeparator}
            tokens={layout.tokens}
            onChange={(ts) => onChange({ ...layout, structure: { ...layout.structure, tableSeparator: ts } })}
          />
        </WBSection>

        <WBSection title="Scrollbar" dotColor={DOT.ui} tag="width · thumb · track" id="sec-scrollbar" defaultOpen={false}>
          {(() => {
            const sb = layout.structure?.scrollbar || {};
            const updateSb = (patch: any) => onChange({ ...layout, structure: { ...layout.structure, scrollbar: { ...sb, ...patch } } });
            return (
              <>
                <Row>
                  <Field label="Width">
                    <input type="text" value={sb.width || "6px"} onChange={(e) => updateSb({ width: e.target.value })}
                      style={{ width: "100%", background: COLORS.surface2, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 12 }} />
                  </Field>
                  <Field label="Border Radius">
                    <input type="text" value={sb.borderRadius || "3px"} onChange={(e) => updateSb({ borderRadius: e.target.value })}
                      style={{ width: "100%", background: COLORS.surface2, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 12 }} />
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
          })()}
        </WBSection>

        <WBSection title="Toast / Notificações" dotColor={DOT.ui} tag="posição · duração · limite" id="sec-toast" defaultOpen={false}>
          {(() => {
            const tc = layout.structure?.toast || {};
            const updateTc = (patch: any) => onChange({ ...layout, structure: { ...layout.structure, toast: { ...tc, ...patch } } });
            return (
              <>
                <Row>
                  <Field label="Position">
                    <select value={tc.position || "bottom-right"} onChange={(e) => updateTc({ position: e.target.value })}
                      style={{ width: "100%", background: COLORS.surface2, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 12 }}>
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
                    <input type="number" min={1} max={10} value={tc.maxVisible || 3} onChange={(e) => updateTc({ maxVisible: parseInt(e.target.value) || 3 })}
                      style={{ width: "100%", background: COLORS.surface2, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 12 }} />
                  </Field>
                  <Field label="Duration (ms)">
                    <input type="number" min={1000} max={30000} step={500} value={tc.duration || 4000} onChange={(e) => updateTc({ duration: parseInt(e.target.value) || 4000 })}
                      style={{ width: "100%", background: COLORS.surface2, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 12 }} />
                  </Field>
                </Row>
              </>
            );
          })()}
        </WBSection>

        <WBSection title="Empty State" dotColor={DOT.ui} tag="ícone · título · ação" id="sec-empty-state" defaultOpen={false}>
          {(() => {
            const es = layout.structure?.emptyState || {};
            const updateEs = (patch: any) => onChange({ ...layout, structure: { ...layout.structure, emptyState: { ...es, ...patch } } });
            return (
              <>
                <Row>
                  <Field label="Ícone (Phosphor ID)">
                    <input type="text" value={es.icon || "ph:magnifying-glass"} onChange={(e) => updateEs({ icon: e.target.value })}
                      style={{ width: "100%", background: COLORS.surface2, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 12 }} />
                  </Field>
                </Row>
                <Row>
                  <Field label="Título">
                    <input type="text" value={es.title || "Nenhum item encontrado"} onChange={(e) => updateEs({ title: e.target.value })}
                      style={{ width: "100%", background: COLORS.surface2, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 12 }} />
                  </Field>
                </Row>
                <Row>
                  <Field label="Descrição">
                    <input type="text" value={es.description || ""} onChange={(e) => updateEs({ description: e.target.value })}
                      style={{ width: "100%", background: COLORS.surface2, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 12 }} />
                  </Field>
                </Row>
                <Row>
                  <Field label="Mostrar Ação">
                    <input type="checkbox" checked={es.showAction !== false} onChange={(e) => updateEs({ showAction: e.target.checked })} />
                  </Field>
                  <Field label="Label do Botão">
                    <input type="text" value={es.actionLabel || "Criar Novo"} onChange={(e) => updateEs({ actionLabel: e.target.value })}
                      style={{ width: "100%", background: COLORS.surface2, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 12 }} />
                  </Field>
                </Row>
              </>
            );
          })()}
        </WBSection>

        <WBSection title="Loading Skeleton" dotColor={DOT.ui} tag="animação · cores · duração" id="sec-skeleton" defaultOpen={false}>
          {(() => {
            const sk = layout.structure?.skeleton || {};
            const updateSk = (patch: any) => onChange({ ...layout, structure: { ...layout.structure, skeleton: { ...sk, ...patch } } });
            return (
              <>
                <Row>
                  <Field label="Animação">
                    <select value={sk.animation || "pulse"} onChange={(e) => updateSk({ animation: e.target.value })}
                      style={{ width: "100%", background: COLORS.surface2, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 12 }}>
                      <option value="pulse">Pulse</option>
                      <option value="shimmer">Shimmer</option>
                      <option value="none">None</option>
                    </select>
                  </Field>
                  <Field label="Duração">
                    <input type="text" value={sk.duration || "1.5s"} onChange={(e) => updateSk({ duration: e.target.value })}
                      style={{ width: "100%", background: COLORS.surface2, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 12 }} />
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
                    <input type="text" value={sk.borderRadius || "6px"} onChange={(e) => updateSk({ borderRadius: e.target.value })}
                      style={{ width: "100%", background: COLORS.surface2, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 12 }} />
                  </Field>
                </Row>
                {/* Live preview */}
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  <span style={{ fontSize: 10, color: COLORS.textDim, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>Preview</span>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div data-orqui-skeleton="" style={{ width: 40, height: 40, borderRadius: sk.borderRadius || "6px", background: sk.baseColor || "rgba(255,255,255,0.05)" }} />
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                      <div data-orqui-skeleton="" style={{ height: 12, borderRadius: sk.borderRadius || "6px", background: sk.baseColor || "rgba(255,255,255,0.05)", width: "80%" }} />
                      <div data-orqui-skeleton="" style={{ height: 10, borderRadius: sk.borderRadius || "6px", background: sk.baseColor || "rgba(255,255,255,0.05)", width: "60%" }} />
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </WBSection>

      </SectionGroup>

      {/* ================================================================ */}
      {/* PÁGINAS                                                         */}
      {/* ================================================================ */}
      <SectionGroup icon="🔴" label="Páginas" color={DOT.pages}>
        <WBSection title="Páginas" dotColor={DOT.pages} tag={`${Object.keys(layout.structure?.pages || {}).length} pages`} id="sec-pages" defaultOpen={false}>
          <PagesEditor layout={layout} onChange={onChange} />
        </WBSection>
      </SectionGroup>

      {/* ================================================================ */}
      {/* IMPORT / EXPORT                                                 */}
      {/* ================================================================ */}
      <SectionGroup icon="⚙️" label="Import / Export" color={DOT.io}>
        <WBSection title="Import / Export" dotColor={DOT.io} tag="JSON" id="sec-io" defaultOpen={false}>
          <ImportPanel onImportLayout={setLayout} onImportRegistry={setRegistry} />
          <WBSub title="Export">
            <ExportPanel layout={layout} registry={registry} />
          </WBSub>
        </WBSection>
      </SectionGroup>

    </div>
  );
}
