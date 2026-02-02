import React, { useState } from "react";
import { COLORS, s } from "../lib/constants";
import { Field, Row, EmptyState } from "../components/shared";
import { usePersistentTab } from "../hooks/usePersistentState";

// ============================================================================
// Pages Editor
// ============================================================================
export function PagesEditor({ layout, onChange }) {
  const pages = layout.structure?.pages || {};
  const pageKeys = Object.keys(pages);
  const [selected, setSelected] = usePersistentTab("pages-selected", pageKeys[0] || "");
  const [newPageKey, setNewPageKey] = useState("");

  const addPage = () => {
    if (!newPageKey.trim()) return;
    const key = newPageKey.trim().toLowerCase().replace(/\s+/g, "-");
    if (pages[key]) return;
    const updated = {
      ...pages,
      [key]: {
        label: newPageKey.trim(),
        route: `/${key}`,
        description: "",
        overrides: {},
      },
    };
    onChange({ ...layout, structure: { ...layout.structure, pages: updated } });
    setSelected(key);
    setNewPageKey("");
  };

  const removePage = (key) => {
    const updated = { ...pages };
    delete updated[key];
    onChange({ ...layout, structure: { ...layout.structure, pages: updated } });
    if (selected === key) setSelected(Object.keys(updated)[0] || "");
  };

  const updatePage = (key, field, val) => {
    const updated = { ...pages, [key]: { ...pages[key], [field]: val } };
    onChange({ ...layout, structure: { ...layout.structure, pages: updated } });
  };

  const updateOverride = (pageKey, regionName, field, val) => {
    const page = pages[pageKey];
    const overrides = { ...page.overrides };
    if (!overrides[regionName]) overrides[regionName] = {};
    overrides[regionName] = { ...overrides[regionName], [field]: val };
    updatePage(pageKey, "overrides", overrides);
  };

  const removeOverride = (pageKey, regionName, field) => {
    const page = pages[pageKey];
    const overrides = { ...page.overrides };
    if (overrides[regionName]) {
      const region = { ...overrides[regionName] };
      delete region[field];
      if (Object.keys(region).length === 0) delete overrides[regionName];
      else overrides[regionName] = region;
    }
    updatePage(pageKey, "overrides", overrides);
  };

  const selectedPage = selected ? pages[selected] : null;
  const regionNames = ["sidebar", "header", "main", "footer"];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, margin: 0, marginBottom: 4 }}>Pages</h3>
        <p style={{ fontSize: 12, color: COLORS.textDim, margin: 0 }}>
          Cada página herda o layout base e pode sobrescrever regiões, header elements, etc.
          Use <span style={{ fontFamily: "monospace", color: COLORS.accent }}>&lt;AppShell page="dashboard"&gt;</span> no runtime.
        </p>
      </div>

      {/* Page list + add */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input value={newPageKey} onChange={(e) => setNewPageKey(e.target.value)} placeholder="nome-da-pagina" style={{ ...s.input, flex: 1 }} onKeyDown={(e) => e.key === "Enter" && addPage()} />
        <button onClick={addPage} style={s.btn}>+ Página</button>
      </div>

      {pageKeys.length === 0 ? (
        <EmptyState message="Nenhuma página configurada. Todas as rotas usarão o layout base." action={
          <div style={{ fontSize: 11, color: COLORS.textDim }}>Adicione páginas para customizar o layout por rota</div>
        } />
      ) : (
        <div style={{ display: "flex", gap: 16 }}>
          {/* Page tabs */}
          <div style={{ width: 160, flexShrink: 0 }}>
            {pageKeys.map(key => (
              <div key={key} onClick={() => setSelected(key)} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 10px", marginBottom: 2, borderRadius: 6, cursor: "pointer",
                background: selected === key ? COLORS.surface3 : "transparent",
                border: selected === key ? `1px solid ${COLORS.border2}` : "1px solid transparent",
              }}>
                <div>
                  <div style={{ fontSize: 13, color: selected === key ? COLORS.text : COLORS.textMuted, fontWeight: selected === key ? 600 : 400 }}>{pages[key].label || key}</div>
                  <div style={{ fontSize: 10, color: COLORS.textDim, fontFamily: "monospace" }}>{pages[key].route}</div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); removePage(key); }} style={{ background: "none", border: "none", color: COLORS.textDim, cursor: "pointer", fontSize: 11 }}>✕</button>
              </div>
            ))}
          </div>

          {/* Page editor */}
          {selectedPage && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...s.card, marginBottom: 12 }}>
                <Row gap={8}>
                  <Field label="Label" style={{ flex: 1 }}>
                    <input value={selectedPage.label || ""} onChange={(e) => updatePage(selected, "label", e.target.value)} style={s.input} />
                  </Field>
                  <Field label="Route" style={{ flex: 1 }}>
                    <input value={selectedPage.route || ""} onChange={(e) => updatePage(selected, "route", e.target.value)} style={{ ...s.input, fontFamily: "monospace" }} />
                  </Field>
                </Row>
                <Field label="Descrição">
                  <input value={selectedPage.description || ""} onChange={(e) => updatePage(selected, "description", e.target.value)} style={s.input} placeholder="Breve descrição da página" />
                </Field>
                <Field label="Título do Navegador">
                  <input value={selectedPage.browserTitle || ""} onChange={(e) => updatePage(selected, "browserTitle", e.target.value)} style={s.input} placeholder={`${selectedPage.label || selected} — uso: document.title`} />
                </Field>
              </div>

              <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, marginBottom: 8 }}>Region Overrides</div>
              <p style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 12, marginTop: 0 }}>
                Apenas campos marcados serão sobrescritos. Campos não marcados usam o layout base.
              </p>

              {regionNames.map(rName => {
                const baseRegion = layout.structure.regions[rName];
                const override = selectedPage.overrides?.[rName] || {};
                const hasOverride = Object.keys(override).length > 0;

                return (
                  <div key={rName} style={{ ...s.card, marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: hasOverride ? 10 : 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, textTransform: "capitalize" }}>
                        {rName} <span style={{ ...s.tag, marginLeft: 6 }}>{baseRegion?.enabled ? "base: ativo" : "base: inativo"}</span>
                        {hasOverride && <span style={{ ...s.tag, marginLeft: 4, background: COLORS.accent + "20", color: COLORS.accent, border: `1px solid ${COLORS.accent}40` }}>override</span>}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      {/* Enable/disable override */}
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.textMuted, cursor: "pointer" }}>
                        <input type="checkbox"
                          checked={override.enabled !== undefined}
                          onChange={(e) => {
                            if (e.target.checked) updateOverride(selected, rName, "enabled", !baseRegion?.enabled);
                            else removeOverride(selected, rName, "enabled");
                          }}
                        />
                        Override enabled ({override.enabled !== undefined ? (override.enabled ? "ativo" : "inativo") : "herdar"})
                      </label>

                      {override.enabled !== undefined && (
                        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.accent, cursor: "pointer" }}>
                          <input type="checkbox" checked={override.enabled} onChange={(e) => updateOverride(selected, rName, "enabled", e.target.checked)} />
                          Ativo nesta página
                        </label>
                      )}
                    </div>

                    {/* Behavior overrides */}
                    {baseRegion?.behavior && (
                      <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
                        {["fixed", "collapsible", "scrollable"].map(b => (
                          <label key={b} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: COLORS.textDim, cursor: "pointer" }}>
                            <input type="checkbox"
                              checked={override.behavior?.[b] !== undefined}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  const beh = { ...(override.behavior || {}), [b]: !baseRegion.behavior?.[b] };
                                  updateOverride(selected, rName, "behavior", beh);
                                } else {
                                  const beh = { ...(override.behavior || {}) };
                                  delete beh[b];
                                  if (Object.keys(beh).length === 0) removeOverride(selected, rName, "behavior");
                                  else updateOverride(selected, rName, "behavior", beh);
                                }
                              }}
                            />
                            override {b}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Header elements override */}
              <div style={{ ...s.card, marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 8 }}>Header Elements Override</div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {["search", "cta", "icons"].map(el => {
                    const baseEnabled = layout.structure.headerElements?.[el]?.enabled ?? false;
                    const overrideVal = selectedPage.overrides?.headerElements?.[el];
                    return (
                      <label key={el} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.textMuted, cursor: "pointer" }}>
                        <input type="checkbox"
                          checked={overrideVal !== undefined}
                          onChange={(e) => {
                            const he = { ...(selectedPage.overrides?.headerElements || {}) };
                            if (e.target.checked) he[el] = { enabled: !baseEnabled };
                            else delete he[el];
                            if (Object.keys(he).length === 0) {
                              const ov = { ...selectedPage.overrides };
                              delete ov.headerElements;
                              updatePage(selected, "overrides", ov);
                            } else {
                              updatePage(selected, "overrides", { ...selectedPage.overrides, headerElements: he });
                            }
                          }}
                        />
                        {el} {overrideVal !== undefined
                          ? <span style={{ fontSize: 10, color: COLORS.accent }}>(override: {overrideVal.enabled ? "on" : "off"})</span>
                          : <span style={{ fontSize: 10, color: COLORS.textDim }}>(base: {baseEnabled ? "on" : "off"})</span>}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Content Layout override */}
              <div style={{ ...s.card, marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 8 }}>Content Layout Override</div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {["maxWidth", "grid"].map(field => {
                    const overrideVal = selectedPage.overrides?.contentLayout?.[field];
                    return (
                      <label key={field} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.textMuted, cursor: "pointer" }}>
                        <input type="checkbox"
                          checked={overrideVal !== undefined}
                          onChange={(e) => {
                            const cl = { ...(selectedPage.overrides?.contentLayout || {}) };
                            if (e.target.checked) {
                              if (field === "maxWidth") cl.maxWidth = "1200px";
                              else cl.grid = { enabled: true, columns: 2, gap: "$tokens.spacing.md" };
                            } else delete cl[field];
                            if (Object.keys(cl).length === 0) {
                              const ov = { ...selectedPage.overrides };
                              delete ov.contentLayout;
                              updatePage(selected, "overrides", ov);
                            } else {
                              updatePage(selected, "overrides", { ...selectedPage.overrides, contentLayout: cl });
                            }
                          }}
                        />
                        {field} {overrideVal !== undefined
                          ? <span style={{ fontSize: 10, color: COLORS.accent }}>(override)</span>
                          : <span style={{ fontSize: 10, color: COLORS.textDim }}>(herdar)</span>}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Page Header override */}
              <div style={{ ...s.card, marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 8 }}>Page Header Override</div>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.textMuted, cursor: "pointer" }}>
                  <input type="checkbox"
                    checked={selectedPage.overrides?.pageHeader !== undefined}
                    onChange={(e) => {
                      const ov = { ...selectedPage.overrides };
                      if (e.target.checked) {
                        ov.pageHeader = { enabled: !(layout.structure.pageHeader?.enabled ?? false) };
                      } else delete ov.pageHeader;
                      updatePage(selected, "overrides", ov);
                    }}
                  />
                  Override pageHeader {selectedPage.overrides?.pageHeader !== undefined
                    ? <span style={{ fontSize: 10, color: COLORS.accent }}>(override: {selectedPage.overrides.pageHeader.enabled ? "on" : "off"})</span>
                    : <span style={{ fontSize: 10, color: COLORS.textDim }}>(herdar base)</span>}
                </label>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

