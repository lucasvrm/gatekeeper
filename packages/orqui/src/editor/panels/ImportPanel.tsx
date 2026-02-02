import React, { useState } from "react";
import { COLORS, s } from "../lib/constants";
import { Section } from "../components/shared";

// ============================================================================
// Layout Contract Migration — upgrades old presets to zone-based architecture
// ============================================================================
function migrateToZoneLayout(layout: any): { layout: any; migrated: string[] } {
  const migrated: string[] = [];
  const data = JSON.parse(JSON.stringify(layout)); // deep clone

  // 1. Add sidebar-pad and main-pad tokens if missing
  if (data.tokens?.sizing && !data.tokens.sizing["sidebar-pad"]) {
    data.tokens.sizing["sidebar-pad"] = { value: 16, unit: "px" };
    migrated.push("Added sidebar-pad token (16px)");
  }
  if (data.tokens?.sizing && !data.tokens.sizing["main-pad"]) {
    data.tokens.sizing["main-pad"] = { value: 28, unit: "px" };
    migrated.push("Added main-pad token (28px)");
  }
  if (data.tokens?.sizing && !data.tokens.sizing["sidebar-collapsed"]) {
    data.tokens.sizing["sidebar-collapsed"] = { value: 52, unit: "px" };
    migrated.push("Added sidebar-collapsed token (52px)");
  }

  // 2. Migrate header to zone-based if missing zones
  const header = data.structure?.regions?.header;
  if (header?.enabled && !header.zones) {
    header.zones = {
      sidebar: {
        description: "Left zone — matches sidebar width. Contains logo.",
        width: "$tokens.sizing.sidebar-width",
        collapsedWidth: "$tokens.sizing.sidebar-collapsed",
        paddingLeft: "$tokens.sizing.sidebar-pad",
        borderRight: { enabled: true, color: "$tokens.colors.border", width: "$tokens.borderWidth.thin" },
        contains: ["brand"],
      },
      content: {
        description: "Right zone — flex:1, matches main content padding.",
        paddingLeft: "$tokens.sizing.main-pad",
        paddingRight: "$tokens.sizing.main-pad",
        contains: (header.containers || []).filter((c: any) => c.name !== "brand").map((c: any) => c.name),
      },
    };
    // Add zone field to containers
    if (header.containers) {
      header.containers.forEach((c: any) => {
        if (!c.zone) {
          c.zone = c.name === "brand" ? "sidebar" : "content";
        }
      });
    }
    // Zero out header padding (zones handle it now)
    header.padding = { top: "0", right: "0", bottom: "0", left: "0" };
    migrated.push("Header migrated to zone-based layout");
  }

  // 3. Add sidebar alignmentPad and collapsedTooltip if missing
  const sidebar = data.structure?.regions?.sidebar;
  if (sidebar?.enabled) {
    if (!sidebar.alignmentPad) {
      sidebar.alignmentPad = "$tokens.sizing.sidebar-pad";
      migrated.push("Added sidebar alignmentPad reference");
    }
    if (!sidebar.collapsedTooltip) {
      sidebar.collapsedTooltip = {
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
      migrated.push("Added mandatory collapsed tooltip");
    }
    // Migrate collapsedDisplay from icon-only to letter-only if it was the old default
    if (sidebar.behavior?.collapsedDisplay === "icon-only") {
      sidebar.behavior.collapsedDisplay = "letter-only";
      migrated.push("Changed collapsedDisplay: icon-only → letter-only");
    }
  }

  // 4. Update main/footer padding to use main-pad if using old spacing tokens for left/right
  const main = data.structure?.regions?.main;
  if (main?.enabled && main.padding) {
    const lr = ["left", "right"];
    lr.forEach(side => {
      if (main.padding[side] && main.padding[side].startsWith("$tokens.spacing.")) {
        main.padding[side] = "$tokens.sizing.main-pad";
      }
    });
    migrated.push("Main region now uses main-pad for left/right padding");
  }
  const footer = data.structure?.regions?.footer;
  if (footer?.padding) {
    if (!footer.padding.left || footer.padding.left.startsWith("$tokens.spacing.")) {
      footer.padding.left = "$tokens.sizing.main-pad";
      footer.padding.right = "$tokens.sizing.main-pad";
    }
  }

  // 5. Add alignmentGrid doc if missing
  if (!data.structure?.alignmentGrid) {
    data.structure.alignmentGrid = {
      _doc: "Two master tokens control ALL horizontal alignment",
      sidebarPad: { token: "$tokens.sizing.sidebar-pad", controls: ["header sidebar-zone", "sidebar containers", "logo"] },
      mainPad: { token: "$tokens.sizing.main-pad", controls: ["header content-zone", "breadcrumbs", "main content", "footer"] },
    };
    migrated.push("Added alignmentGrid documentation");
  }

  return { layout: data, migrated };
}


// ============================================================================
// Import Panel
// ============================================================================
export function ImportPanel({ onImportLayout, onImportRegistry }) {
  const [json, setJson] = useState("");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [migrationLog, setMigrationLog] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const processImport = (text: string) => {
    setError(null);
    setSuccess(null);
    setMigrationLog([]);
    try {
      const data = JSON.parse(text);
      if (data.$orqui?.schema === "layout-contract") {
        const { $orqui, ...rest } = data;
        // Run migration
        const { layout: migrated, migrated: log } = migrateToZoneLayout(rest);
        onImportLayout(migrated);
        setMigrationLog(log);
        setSuccess(log.length > 0
          ? `Layout Contract importado e migrado! (${log.length} alterações)`
          : "Layout Contract importado!"
        );
        setJson(text);
      } else if (data.$orqui?.schema === "ui-registry-contract") {
        const { $orqui, ...rest } = data;
        onImportRegistry(rest);
        setSuccess("UI Registry Contract importado!");
        setJson(text);
      } else {
        setError("JSON não é um contrato Orqui válido (campo $orqui.schema não encontrado)");
      }
    } catch (e) {
      setError("JSON inválido: " + e.message);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);

    // Try files first
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        setJson(text);
        processImport(text);
      };
      reader.readAsText(file);
      return;
    }

    // Then try text data
    const text = e.dataTransfer?.getData("text/plain");
    if (text) {
      setJson(text);
      processImport(text);
    }
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      setJson(text);
      processImport(text);
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ marginTop: 24 }}>
      <Section title="Import Contract" defaultOpen={true}>
        {/* Drag-and-drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
          onDrop={handleDrop}
          onClick={() => document.getElementById("orqui-import-file")?.click()}
          style={{
            border: `2px dashed ${dragOver ? COLORS.accent : COLORS.border}`,
            borderRadius: 10,
            padding: 32,
            textAlign: "center",
            background: dragOver ? COLORS.accent + "08" : COLORS.surface2,
            cursor: "pointer",
            transition: "all 0.2s ease",
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.6 }}>{dragOver ? "⬇" : "📄"}</div>
          <div style={{ fontSize: 13, color: dragOver ? COLORS.accent : COLORS.text, fontWeight: 500, marginBottom: 4 }}>
            {dragOver ? "Solte o arquivo aqui" : "Arraste um contrato JSON aqui"}
          </div>
          <div style={{ fontSize: 11, color: COLORS.textDim }}>
            ou clique para selecionar arquivo · contratos legados são migrados automaticamente
          </div>
          <input id="orqui-import-file" type="file" accept=".json,application/json" onChange={handleFileInput} style={{ display: "none" }} />
        </div>

        <p style={{ fontSize: 12, color: COLORS.textDim, marginTop: 0, marginBottom: 8 }}>Ou cole o JSON diretamente:</p>
        <textarea value={json} onChange={(e) => setJson(e.target.value)} placeholder="Cole o JSON do contrato aqui..." style={{ ...s.input, height: 120, resize: "vertical", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }} />
        <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => processImport(json)} style={s.btn} disabled={!json.trim()}>Import</button>
          {json && <button onClick={() => { setJson(""); setError(null); setSuccess(null); setMigrationLog([]); }} style={s.btnGhost}>Limpar</button>}
          {error && <span style={{ fontSize: 12, color: COLORS.danger }}>{error}</span>}
          {success && <span style={{ fontSize: 12, color: COLORS.success }}>{success}</span>}
        </div>

        {/* Migration log */}
        {migrationLog.length > 0 && (
          <div style={{ marginTop: 12, padding: 12, background: COLORS.surface2, borderRadius: 8, border: `1px solid ${COLORS.accent}30` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.accent, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
              ⚡ Migration Log
            </div>
            {migrationLog.map((entry, i) => (
              <div key={i} style={{ fontSize: 11, color: COLORS.textMuted, padding: "2px 0", display: "flex", gap: 6 }}>
                <span style={{ color: COLORS.success }}>✓</span>
                {entry}
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
