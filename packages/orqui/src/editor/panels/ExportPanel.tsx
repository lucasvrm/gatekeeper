import React, { useState } from "react";
import { COLORS, s } from "../lib/constants";
import { Field } from "../components/shared";
import { computeHash } from "../lib/utils";

// ============================================================================
// Export Panel
// ============================================================================
export function ExportPanel({ layout, registry }) {
  const [version, setVersion] = useState("1.0.0");
  const [exported, setExported] = useState(null);
  const [activeExport, setActiveExport] = useState("layout");

  const doExport = async (type) => {
    const data = type === "layout" ? { ...layout } : { ...registry };
    const hash = await computeHash(data);
    const contract = {
      $orqui: { schema: type === "layout" ? "layout-contract" : "ui-registry-contract", version, hash, generatedAt: new Date().toISOString() },
      ...data,
    };
    setExported({ type, contract, json: JSON.stringify(contract, null, 2) });
  };

  const download = () => {
    if (!exported) return;
    const blob = new Blob([exported.json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exported.type === "layout" ? "layout-contract" : "ui-registry-contract"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = () => {
    if (!exported) return;
    navigator.clipboard.writeText(exported.json);
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, margin: 0, marginBottom: 4 }}>Export Contracts</h2>
        <p style={{ fontSize: 12, color: COLORS.textDim, margin: 0 }}>Gere contratos versionados com hash canônico</p>
      </div>

      <Field label="Version (semver)">
        <input value={version} onChange={(e) => setVersion(e.target.value)} style={{ ...s.input, width: 150 }} placeholder="1.0.0" />
      </Field>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => { setActiveExport("layout"); doExport("layout"); }} style={{ ...s.btn, background: activeExport === "layout" ? COLORS.accent : COLORS.surface3 }}>Export Layout Contract</button>
        <button onClick={() => { setActiveExport("registry"); doExport("registry"); }} style={{ ...s.btn, background: activeExport === "registry" ? COLORS.accent : COLORS.surface3 }}>Export UI Registry Contract</button>
      </div>

      {exported && (
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <span style={s.tag}>{exported.contract.$orqui.schema}</span>
            <span style={s.tag}>v{exported.contract.$orqui.version}</span>
            <span style={{ ...s.tag, fontFamily: "monospace", fontSize: 10 }}>{exported.contract.$orqui.hash.slice(0, 28)}…</span>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button onClick={download} style={s.btn}>⬇ Download</button>
            <button onClick={copyToClipboard} style={s.btnGhost}>📋 Copiar JSON</button>
          </div>
          <pre style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 16, fontSize: 11, color: COLORS.textMuted, fontFamily: "'JetBrains Mono', monospace", overflow: "auto", maxHeight: 400, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {exported.json}
          </pre>
        </div>
      )}
    </div>
  );
}
