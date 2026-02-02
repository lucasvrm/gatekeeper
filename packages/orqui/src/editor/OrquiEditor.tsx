import React, { useState, useCallback, useEffect, useRef } from "react";
import { COLORS, s, DEFAULT_LAYOUT, DEFAULT_UI_REGISTRY } from "./lib/constants";
import { computeHash } from "./lib/utils";
import { idbGet, idbSet } from "./lib/indexeddb";
import { apiLoadContracts, apiSaveContract } from "./lib/api";
import { usePersistentState } from "./hooks/usePersistentState";
import { useCommandPaletteItems } from "./hooks/useCommandPaletteItems";
import { CommandPalette } from "./components/CommandPalette";
import { LayoutSections } from "./editors/LayoutSections";
import { UIRegistryEditor } from "./editors/ComponentEditors";
import { LayoutPreview } from "./previews/LayoutPreview";
import { TypographyPreview } from "./previews/TypographyPreview";
import { ComponentPreview } from "./previews/ComponentPreview";

// ============================================================================
export function OrquiEditor() {
  const [activeTab, setActiveTab] = useState("layout");
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  // Normalize registry: ensure every component has name field matching its key
  const normalizeRegistry = useCallback((reg: any) => {
    if (!reg?.components) return reg;
    const normalized = { ...reg, components: { ...reg.components } };
    Object.keys(normalized.components).forEach(key => {
      if (!normalized.components[key].name || normalized.components[key].name !== key) {
        normalized.components[key] = { ...normalized.components[key], name: key };
      }
    });
    return normalized;
  }, []);

  const [registry, setRegistryRaw] = useState(() => normalizeRegistry(DEFAULT_UI_REGISTRY));
  const setRegistry = useCallback((r: any) => setRegistryRaw(normalizeRegistry(r)), [normalizeRegistry]);
  const [hasApi, setHasApi] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // null | "saving" | "saved" | "error"
  const [previewTab, setPreviewTab] = useState("layout");

  // Snapshot for undo: stores state at last save
  const [savedSnapshot, setSavedSnapshot] = useState<{ layout: any; registry: any } | null>(null);
  const hasUnsavedChanges = savedSnapshot && (
    JSON.stringify(layout) !== JSON.stringify(savedSnapshot.layout) ||
    JSON.stringify(registry) !== JSON.stringify(savedSnapshot.registry)
  );

  const undoChanges = useCallback(() => {
    if (!savedSnapshot) return;
    setLayout(savedSnapshot.layout);
    setRegistry(savedSnapshot.registry);
  }, [savedSnapshot]);

  // Load: try API first (filesystem), then IndexedDB (draft), then defaults
  useEffect(() => {
    (async () => {
      const apiContracts = await apiLoadContracts();
      if (apiContracts) {
        setHasApi(true);
        let loadedLayout = null, loadedRegistry = null;
        if (apiContracts["layout-contract"]) {
          const { $orqui, ...data } = apiContracts["layout-contract"];
          setLayout(data);
          loadedLayout = data;
        }
        if (apiContracts["ui-registry-contract"]) {
          const { $orqui, ...data } = apiContracts["ui-registry-contract"];
          setRegistry(data);
          loadedRegistry = data;
        }
        setSavedSnapshot({ layout: loadedLayout || layout, registry: loadedRegistry || registry });
        return;
      }
      // Fallback to IndexedDB
      const l = await idbGet("orqui-layout");
      if (l) setLayout(l);
      const r = await idbGet("orqui-registry");
      if (r) setRegistry(r);
    })();
  }, []);

  // Auto-save to IndexedDB on every change (draft persistence)
  useEffect(() => { idbSet("orqui-layout", layout); }, [layout]);
  useEffect(() => { idbSet("orqui-registry", registry); }, [registry]);

  // Save to filesystem via API
  const saveToFilesystem = useCallback(async () => {
    if (!hasApi) return;
    setSaveStatus("saving");
    const layoutHash = await computeHash(layout);
    const layoutContract = {
      $orqui: { schema: "layout-contract", version: "1.0.0", hash: layoutHash, generatedAt: new Date().toISOString() },
      ...layout,
    };
    const registryHash = await computeHash(registry);
    const registryContract = {
      $orqui: { schema: "ui-registry-contract", version: "1.0.0", hash: registryHash, generatedAt: new Date().toISOString() },
      ...registry,
    };
    const r1 = await apiSaveContract(layoutContract);
    const r2 = await apiSaveContract(registryContract);
    if (r1.ok && r2.ok) {
      setSavedSnapshot({ layout: { ...layout }, registry: { ...registry } });
    }
    setSaveStatus(r1.ok && r2.ok ? "saved" : "error");
    setTimeout(() => setSaveStatus(null), 2000);
  }, [layout, registry, hasApi]);

  // Scroll spy for section indicator dots
  const configRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState("sec-brand");
  const sectionDots = [
    { id: "sec-brand", color: "#f59e0b", label: "Marca" },
    { id: "sec-layout", color: "#3b82f6", label: "Layout" },
    { id: "sec-content-layout", color: "#3b82f6", label: "Content Layout" },
    { id: "sec-page-header", color: "#3b82f6", label: "Page Header" },
    { id: "sec-header", color: "#22c55e", label: "Header" },
    { id: "sec-table-sep", color: "#22c55e", label: "Table Sep" },
    { id: "sec-tokens", color: "#a855f7", label: "Tokens" },
    { id: "sec-typo", color: "#a1a1aa", label: "Tipografia" },
    { id: "sec-layout-mode", color: "#3b82f6", label: "Layout Mode" },
    { id: "sec-scrollbar", color: "#64748b", label: "Scrollbar" },
    { id: "sec-toast", color: "#f97316", label: "Toast" },
    { id: "sec-empty-state", color: "#8b5cf6", label: "Empty State" },
    { id: "sec-skeleton", color: "#06b6d4", label: "Skeleton" },
    { id: "sec-pages", color: "#ef4444", label: "Páginas" },
    { id: "sec-io", color: "#6d9cff", label: "I/O" },
  ];

  useEffect(() => {
    const el = configRef.current;
    if (!el) return;
    const handleScroll = () => {
      const ids = sectionDots.map(d => d.id);
      let active = ids[0];
      ids.forEach(id => {
        const sec = document.getElementById(id);
        if (sec && sec.offsetTop - el.offsetTop - 120 <= el.scrollTop) active = id;
      });
      setActiveSection(active);
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [activeTab]);

  const scrollToSection = (id: string) => {
    const sec = document.getElementById(id);
    const el = configRef.current;
    if (sec && el) {
      el.scrollTo({ top: sec.offsetTop - el.offsetTop, behavior: "smooth" });
    }
  };

  // Command Palette
  const [cmdOpen, setCmdOpen] = useState(false);

  // Orqui favicon
  useEffect(() => {
    let link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
    if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="${COLORS.accent}"><path d="M245.66,74.34l-32-32a8,8,0,0,0-11.32,11.32L220.69,72H208c-49.33,0-61.05,28.12-71.38,52.92-9.38,22.51-16.92,40.59-49.48,42.84a40,40,0,1,0,.1,16c43.26-2.65,54.34-29.15,64.14-52.69C161.41,107,169.33,88,208,88h12.69l-18.35,18.34a8,8,0,0,0,11.32,11.32l32-32A8,8,0,0,0,245.66,74.34ZM48,200a24,24,0,1,1,24-24A24,24,0,0,1,48,200Z"/></svg>`;
    link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    link.type = "image/svg+xml";
    document.title = "orqui — contract editor";
  }, []);

  const openAccordion = useCallback((sectionId: string) => {
    // Dispatch custom event that usePersistentState hooks listen for
    window.dispatchEvent(new CustomEvent("orqui:open-accordion", { detail: sectionId }));
    window.dispatchEvent(new CustomEvent("orqui:open-accordion", { detail: `wb-${sectionId}` }));
  }, []);

  const cmdItems = useCommandPaletteItems(layout, registry, setActiveTab, scrollToSection, openAccordion);

  // Ctrl+K / Cmd+K handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const CONFIG_WIDTH = "65%";
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="orqui-editor-root" style={{
      background: COLORS.bg, height: "100vh", color: COLORS.text,
      fontFamily: "'Inter', -apple-system, sans-serif",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      {/* Google Fonts */}
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />

      {/* Orqui editor scrollbar — discrete, thin, no arrows */}
      <style>{`
        .orqui-editor-root { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.05) transparent; }
        .orqui-editor-root *::-webkit-scrollbar { width: 3px; height: 3px; }
        .orqui-editor-root *::-webkit-scrollbar-track { background: transparent; }
        .orqui-editor-root *::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 99px; }
        .orqui-editor-root *::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.12); }
        .orqui-editor-root *::-webkit-scrollbar-button { display: none; }
        .orqui-editor-root * { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.05) transparent; }
      `}</style>

      {/* ============================================================ */}
      {/* TOPBAR                                                        */}
      {/* ============================================================ */}
      <div style={{
        height: 52, flexShrink: 0, background: COLORS.surface,
        borderBottom: `1px solid ${COLORS.border}`,
        display: "flex", alignItems: "center", padding: "0 20px", gap: 12,
      }}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 256 256" fill={COLORS.accent}>
            <path d="M245.66,74.34l-32-32a8,8,0,0,0-11.32,11.32L220.69,72H208c-49.33,0-61.05,28.12-71.38,52.92-9.38,22.51-16.92,40.59-49.48,42.84a40,40,0,1,0,.1,16c43.26-2.65,54.34-29.15,64.14-52.69C161.41,107,169.33,88,208,88h12.69l-18.35,18.34a8,8,0,0,0,11.32,11.32l32-32A8,8,0,0,0,245.66,74.34ZM48,200a24,24,0,1,1,24-24A24,24,0,0,1,48,200Z" />
          </svg>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
            fontSize: 16, color: COLORS.accent, letterSpacing: "-0.5px",
          }}>orqui</span>
        </div>

        {/* Dot separator */}
        <div style={{ width: 4, height: 4, borderRadius: "50%", background: COLORS.border }} />

        {/* Tab pills */}
        <div style={{
          display: "flex", gap: 2, background: COLORS.surface2,
          padding: 3, borderRadius: 8,
        }}>
          {[
            { id: "layout", label: "Layout" },
            { id: "components", label: "Componentes" },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              padding: "6px 16px", borderRadius: 6, fontSize: 12, fontWeight: 500,
              border: "none", cursor: "pointer",
              fontFamily: "'Inter', sans-serif",
              background: activeTab === tab.id ? COLORS.surface3 : "transparent",
              color: activeTab === tab.id ? COLORS.text : COLORS.textDim,
              boxShadow: activeTab === tab.id ? "0 1px 3px #0003" : "none",
              transition: "all 0.15s",
            }}>{tab.label}</button>
          ))}
        </div>

        {/* Search trigger */}
        <button
          onClick={() => setCmdOpen(true)}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "6px 14px", borderRadius: 8, fontSize: 12,
            border: `1px solid ${COLORS.border}`, cursor: "pointer",
            fontFamily: "'Inter', sans-serif",
            background: COLORS.surface2, color: COLORS.textDim,
            transition: "all 0.15s", minWidth: 180,
          }}
        >
          <span style={{ fontSize: 13 }}>⌘</span>
          <span style={{ flex: 1, textAlign: "left" }}>Buscar…</span>
          <kbd style={{
            fontSize: 9, padding: "1px 5px", borderRadius: 3,
            background: COLORS.surface3, border: `1px solid ${COLORS.border}`,
            color: COLORS.textDim,
          }}>⌘K</kbd>
        </button>

        <div style={{ flex: 1 }} />

        {/* Status badges */}
        <span style={{
          ...s.tag, fontSize: 10,
          background: `${COLORS.success}15`, color: COLORS.success,
          border: `1px solid ${COLORS.success}30`,
        }}>
          {Object.values(layout.structure.regions).filter((r: any) => r.enabled).length} regions
        </span>
        <span style={{
          ...s.tag, fontSize: 10,
          background: `${COLORS.accent}15`, color: COLORS.accent,
          border: `1px solid ${COLORS.accent}30`,
        }}>
          {Object.keys(registry.components).length} components
        </span>
        <span style={{ ...s.tag, fontSize: 10 }}>IndexedDB ✓</span>

        {/* Undo */}
        {hasApi && hasUnsavedChanges && (
          <button onClick={undoChanges} style={{
            padding: "7px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600,
            border: `1px solid ${COLORS.danger}30`, cursor: "pointer",
            fontFamily: "'Inter', sans-serif",
            background: "transparent", color: COLORS.danger,
          }}>
            ↩ Desfazer
          </button>
        )}

        {/* Save */}
        {hasApi && (
          <button onClick={saveToFilesystem} disabled={saveStatus === "saving"} style={{
            padding: "7px 16px", borderRadius: 7, fontSize: 12, fontWeight: 600,
            border: "none", cursor: "pointer",
            fontFamily: "'Inter', sans-serif",
            background: saveStatus === "saved" ? COLORS.success : saveStatus === "error" ? COLORS.danger : COLORS.accent,
            color: "#fff",
            opacity: saveStatus === "saving" ? 0.6 : 1,
            transition: "all 0.15s",
          }}>
            {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "✓ Saved" : saveStatus === "error" ? "✕ Error" : "Save to Project"}
          </button>
        )}
      </div>

      {/* ============================================================ */}
      {/* MAIN LAYOUT: config scroll (left) + preview (right)           */}
      {/* ============================================================ */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>

        {/* LEFT — scrollable config panel (collapsible) */}
        <div
          ref={configRef}
          style={{
            width: sidebarCollapsed ? "auto" : CONFIG_WIDTH,
            minWidth: sidebarCollapsed ? undefined : undefined,
            flexShrink: 0,
            overflowY: "auto", overflowX: "hidden",
            borderRight: `1px solid ${COLORS.border}`,
            background: COLORS.surface,
            scrollBehavior: "smooth" as const,
            transition: "width 0.2s ease",
          }}
        >
          {sidebarCollapsed ? (
            /* Collapsed: show section names as clickable list */
            <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 2 }}>
              {[
                { id: "sec-brand", label: "Marca", color: "#f59e0b" },
                { id: "sec-layout", label: "Layout & Regiões", color: "#3b82f6" },
                { id: "sec-content-layout", label: "Content Layout", color: "#3b82f6" },
                { id: "sec-page-header", label: "Page Header", color: "#3b82f6" },
                { id: "sec-header", label: "Header Elements", color: "#22c55e" },
                { id: "sec-table-sep", label: "Table Separator", color: "#22c55e" },
                { id: "sec-tokens", label: "Design Tokens", color: "#a855f7" },
                { id: "sec-typo", label: "Tipografia", color: "#a1a1aa" },
                { id: "sec-layout-mode", label: "Layout Mode", color: "#3b82f6" },
                { id: "sec-scrollbar", label: "Scrollbar", color: "#64748b" },
                { id: "sec-toast", label: "Toast", color: "#f97316" },
                { id: "sec-empty-state", label: "Empty State", color: "#8b5cf6" },
                { id: "sec-skeleton", label: "Skeleton", color: "#06b6d4" },
                { id: "sec-pages", label: "Páginas", color: "#ef4444" },
                { id: "sec-io", label: "Import / Export", color: "#6d9cff" },
              ].map(s => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSidebarCollapsed(false);
                    setTimeout(() => {
                      document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }, 250);
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                    background: "transparent", color: COLORS.textDim,
                    fontSize: 12, fontWeight: 500, fontFamily: "'Inter', sans-serif",
                    textAlign: "left", whiteSpace: "nowrap",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.surface2; e.currentTarget.style.color = COLORS.text; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = COLORS.textDim; }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                  {s.label}
                </button>
              ))}
            </div>
          ) : (
            /* Expanded: full config panels */
            <>
              {activeTab === "layout" && (
                <LayoutSections
                  layout={layout}
                  registry={registry}
                  setLayout={setLayout}
                  setRegistry={setRegistry}
                />
              )}
              {activeTab === "components" && (
                <div style={{ padding: 20 }}>
                  <UIRegistryEditor registry={registry} onChange={setRegistry} />
                </div>
              )}
            </>
          )}
        </div>

        {/* Collapse/expand chevron — centered vertically on the config panel border */}
        <div style={{ position: "relative", flexShrink: 0, width: 0 }}>
          <button
            onClick={() => setSidebarCollapsed(prev => !prev)}
            style={{
              position: "absolute",
              left: -12,
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 20,
              width: 24, height: 24,
              borderRadius: "50%",
              border: `1px solid ${COLORS.border}`,
              background: COLORS.surface2,
              color: COLORS.textDim,
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12,
              transition: "all 0.2s",
              boxShadow: "0 1px 4px #0003",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = COLORS.text; e.currentTarget.style.borderColor = COLORS.accent; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = COLORS.textDim; e.currentTarget.style.borderColor = COLORS.border; }}
            title={sidebarCollapsed ? "Expandir painel" : "Colapsar painel"}
          >
            {sidebarCollapsed ? "›" : "‹"}
          </button>
        </div>

        {/* RIGHT — preview pane */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          background: COLORS.bg, position: "relative",
        }}>
          {/* Preview tab bar */}
          <div style={{
            padding: "0 24px", display: "flex", gap: 0,
            borderBottom: `1px solid ${COLORS.border}`,
            background: COLORS.surface,
            flexShrink: 0,
          }}>
            {[
              { id: "layout", label: "Layout" },
              { id: "typography", label: "Tipografia" },
              { id: "components", label: "Componentes" },
            ].map(tab => (
              <button key={tab.id} onClick={() => setPreviewTab(tab.id)} style={{
                padding: "16px 16px", fontSize: 13, fontWeight: 600,
                border: "none", cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
                borderBottom: previewTab === tab.id ? `2px solid ${COLORS.accent}` : "2px solid transparent",
                background: "transparent",
                color: previewTab === tab.id ? COLORS.text : COLORS.textDim,
                transition: "color 0.15s",
              }}>{tab.label}</button>
            ))}
          </div>

          {/* Preview content */}
          <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
            {previewTab === "layout" && <LayoutPreview layout={layout} />}
            {previewTab === "typography" && <TypographyPreview layout={layout} />}
            {previewTab === "components" && <ComponentPreview registry={registry} />}
          </div>

          {/* Scroll spy dots — only in layout tab */}
          {activeTab === "layout" && (
            <div style={{
              position: "absolute", right: 16, top: "50%",
              transform: "translateY(-50%)",
              display: "flex", flexDirection: "column", gap: 6,
              zIndex: 10,
            }}>
              {sectionDots.map(dot => (
                <div
                  key={dot.id}
                  onClick={() => scrollToSection(dot.id)}
                  title={dot.label}
                  style={{
                    width: activeSection === dot.id ? 10 : 7,
                    height: activeSection === dot.id ? 10 : 7,
                    borderRadius: "50%",
                    background: dot.color,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    opacity: activeSection === dot.id ? 1 : 0.4,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Command Palette overlay */}
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} items={cmdItems} />
    </div>
  );
}
