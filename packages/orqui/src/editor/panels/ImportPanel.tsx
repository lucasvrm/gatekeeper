import React, { useState } from "react";
import { COLORS, s } from "../lib/constants";
import { Section } from "../components/shared";

// ============================================================================
// Import Panel
// ============================================================================
export function ImportPanel({ onImportLayout, onImportRegistry }) {
  const [json, setJson] = useState("");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const processImport = (text: string) => {
    setError(null);
    setSuccess(null);
    try {
      const data = JSON.parse(text);
      if (data.$orqui?.schema === "layout-contract") {
        const { $orqui, ...rest } = data;
        onImportLayout(rest);
        setSuccess("Layout Contract importado!");
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
            ou clique para selecionar arquivo
          </div>
          <input id="orqui-import-file" type="file" accept=".json,application/json" onChange={handleFileInput} style={{ display: "none" }} />
        </div>

        <p style={{ fontSize: 12, color: COLORS.textDim, marginTop: 0, marginBottom: 8 }}>Ou cole o JSON diretamente:</p>
        <textarea value={json} onChange={(e) => setJson(e.target.value)} placeholder="Cole o JSON do contrato aqui..." style={{ ...s.input, height: 120, resize: "vertical", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }} />
        <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => processImport(json)} style={s.btn} disabled={!json.trim()}>Import</button>
          {json && <button onClick={() => { setJson(""); setError(null); setSuccess(null); }} style={s.btnGhost}>Limpar</button>}
          {error && <span style={{ fontSize: 12, color: COLORS.danger }}>{error}</span>}
          {success && <span style={{ fontSize: 12, color: COLORS.success }}>{success}</span>}
        </div>
      </Section>
    </div>
  );
}
