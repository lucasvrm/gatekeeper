import React, { useState, useMemo } from "react";
import { COLORS, s, GOOGLE_FONTS } from "../lib/constants";
import { Field, Row } from "../components/shared";
import { IconPicker } from "../components/PhosphorIcons";
import { loadGoogleFont } from "../hooks/useGoogleFont";

// ============================================================================
// Favicon Editor
// ============================================================================
export function FaviconEditor({ favicon, onChange }) {
  const cfg = favicon || { type: "none", url: "", emoji: "⬡" };
  const update = (field, val) => onChange({ ...cfg, [field]: val });
  const [dragOver, setDragOver] = useState(false);

  const handleFileDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange({ ...cfg, url: reader.result, type: "image" });
    reader.readAsDataURL(file);
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange({ ...cfg, url: reader.result, type: "image" });
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, margin: 0, marginBottom: 4 }}>Favicon</h3>
        <p style={{ fontSize: 12, color: COLORS.textDim, margin: 0 }}>Ícone exibido na aba do navegador</p>
      </div>

      {/* Preview */}
      <div style={{
        background: COLORS.surface2, borderRadius: 8, padding: "12px 16px", marginBottom: 16,
        display: "flex", alignItems: "center", gap: 12, border: `1px solid ${COLORS.border}`,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 4, background: COLORS.surface3,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: `1px solid ${COLORS.border}`,
        }}>
          {cfg.type === "image" && cfg.url ? (
            <img src={cfg.url} alt="Favicon" style={{ width: 16, height: 16, objectFit: "contain" }} />
          ) : cfg.type === "emoji" ? (
            <span style={{ fontSize: 16 }}>{cfg.emoji || "⬡"}</span>
          ) : (
            <span style={{ fontSize: 10, color: COLORS.textDim }}>—</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: COLORS.surface3, borderRadius: 4, padding: "4px 12px" }}>
          {cfg.type === "image" && cfg.url ? (
            <img src={cfg.url} alt="" style={{ width: 12, height: 12 }} />
          ) : cfg.type === "emoji" ? (
            <span style={{ fontSize: 12 }}>{cfg.emoji}</span>
          ) : null}
          <span style={{ fontSize: 12, color: COLORS.textMuted }}>Minha Aplicação</span>
          <span style={{ fontSize: 10, color: COLORS.textDim, marginLeft: 8 }}>✕</span>
        </div>
        <span style={{ fontSize: 11, color: COLORS.textDim }}>← preview da tab</span>
      </div>

      <Field label="Tipo">
        <div style={{ display: "flex", gap: 4 }}>
          {[
            { id: "none", label: "Nenhum" },
            { id: "emoji", label: "Emoji" },
            { id: "image", label: "Imagem" },
          ].map(opt => (
            <button key={opt.id} onClick={() => update("type", opt.id)} style={{
              ...s.btnSmall,
              background: cfg.type === opt.id ? COLORS.accent : COLORS.surface3,
              color: cfg.type === opt.id ? "#fff" : COLORS.textMuted,
              padding: "6px 14px",
            }}>{opt.label}</button>
          ))}
        </div>
      </Field>

      {cfg.type === "emoji" && (
        <Field label="Emoji">
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
            <input value={cfg.emoji || ""} onChange={(e) => update("emoji", e.target.value)} style={{ ...s.input, width: 60, textAlign: "center", fontSize: 18 }} />
            <IconPicker value={cfg.emoji || ""} onSelect={(ic) => update("emoji", ic)} />
          </div>
        </Field>
      )}

      {cfg.type === "emoji" && cfg.emoji?.startsWith("ph:") && (
        <Field label="Cor do ícone">
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="color" value={cfg.color || "#ffffff"} onChange={(e) => update("color", e.target.value)} style={{ width: 32, height: 28, border: "none", background: "none", cursor: "pointer", padding: 0 }} />
            <input value={cfg.color || "white"} onChange={(e) => update("color", e.target.value)} style={{ ...s.input, flex: 1, fontSize: 11 }} placeholder="white, #6d9cff, etc." />
            {cfg.color && cfg.color !== "white" && (
              <button onClick={() => update("color", "white")} style={{ ...s.btnSmall, fontSize: 10 }}>Reset</button>
            )}
          </div>
        </Field>
      )}

      {cfg.type === "image" && (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
            onClick={() => document.getElementById("orqui-favicon-upload")?.click()}
            style={{
              border: `2px dashed ${dragOver ? COLORS.accent : COLORS.border}`,
              borderRadius: 8, padding: 24, textAlign: "center", marginTop: 8,
              background: dragOver ? COLORS.accent + "08" : COLORS.surface2,
              cursor: "pointer", transition: "all 0.15s",
            }}
          >
            {cfg.url ? (
              <div>
                <img src={cfg.url} alt="Favicon" style={{ width: 32, height: 32, objectFit: "contain", marginBottom: 8 }} />
                <div style={{ fontSize: 11, color: COLORS.textDim }}>Clique ou arraste para trocar</div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: COLORS.textMuted }}>
                Arraste .ico, .png ou .svg aqui
              </div>
            )}
            <input id="orqui-favicon-upload" type="file" accept=".ico,.png,.svg,image/x-icon,image/png,image/svg+xml" onChange={handleFileInput} style={{ display: "none" }} />
          </div>
          <Field label="Ou cole URL" style={{ marginTop: 8 }}>
            <input value={cfg.url || ""} onChange={(e) => update("url", e.target.value)} style={{ ...s.input, fontSize: 11 }} placeholder="https://example.com/favicon.ico" />
          </Field>
        </>
      )}
    </div>
  );
}


// ============================================================================
// Logo Config Editor
// ============================================================================
export function LogoConfigEditor({ logo, onChange }) {
  const cfg = logo || {
    type: "text", text: "App", icon: "⬡", iconUrl: "", imageUrl: "",
    position: "sidebar", headerSlot: "left", sidebarAlign: "left", alignWithHeader: true,
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    iconGap: 8,
    typography: { fontFamily: "", fontSize: 16, fontWeight: 700, color: "", letterSpacing: 0 },
  };
  const update = (field, val) => onChange({ ...cfg, [field]: val });
  const updateTypo = (field, val) => onChange({ ...cfg, typography: { ...cfg.typography, [field]: val } });
  const updatePadding = (side, val) => onChange({ ...cfg, padding: { ...cfg.padding, [side]: Number(val) || 0 } });

  const [dragOver, setDragOver] = useState(false);
  const [iconDragOver, setIconDragOver] = useState(false);

  const handleImageFile = (file, field) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => update(field, reader.result);
    reader.readAsDataURL(file);
  };

  const handleImageDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    handleImageFile(e.dataTransfer?.files?.[0], "imageUrl");
    if (e.dataTransfer?.files?.[0]) update("type", "image");
  };

  const handleIconDrop = (e) => {
    e.preventDefault(); setIconDragOver(false);
    handleImageFile(e.dataTransfer?.files?.[0], "iconUrl");
  };

  const pad = cfg.padding || { top: 0, right: 0, bottom: 0, left: 0 };
  const typo = cfg.typography || { fontFamily: "", fontSize: 16, fontWeight: 700, color: "", letterSpacing: 0 };

  // Preview
  const renderPreview = () => {
    const align = cfg.position === "sidebar" ? cfg.sidebarAlign : cfg.headerSlot;
    const justifyMap = { left: "flex-start", center: "center", right: "flex-end" };
    return (
      <div style={{
        background: COLORS.surface2, borderRadius: 8, marginBottom: 16,
        padding: `${pad.top}px ${pad.right}px ${pad.bottom}px ${pad.left}px`,
        display: "flex", justifyContent: justifyMap[align] || "flex-start", alignItems: "center",
        border: `1px solid ${COLORS.border}`, minHeight: 48,
      }}>
        {cfg.type === "image" && cfg.imageUrl ? (
          <img src={cfg.imageUrl} alt="Logo" style={{ height: 32, maxWidth: 160, objectFit: "contain" }} />
        ) : cfg.type === "icon-text" ? (
          <div style={{ display: "flex", alignItems: "center", gap: cfg.iconGap || 8 }}>
            {cfg.iconUrl ? (
              <img src={cfg.iconUrl} alt="" style={{ height: typo.fontSize || 20, objectFit: "contain" }} />
            ) : (
              <span style={{ fontSize: typo.fontSize || 20 }}>{cfg.icon || "⬡"}</span>
            )}
            <span style={{
              fontSize: typo.fontSize || 15, fontWeight: typo.fontWeight || 700, color: typo.color || COLORS.text,
              fontFamily: typo.fontFamily || "inherit", letterSpacing: typo.letterSpacing ? `${typo.letterSpacing}px` : undefined,
            }}>{cfg.text || "App"}</span>
          </div>
        ) : (
          <span style={{
            fontSize: typo.fontSize || 15, fontWeight: typo.fontWeight || 700, color: typo.color || COLORS.text,
            fontFamily: typo.fontFamily || "inherit", letterSpacing: typo.letterSpacing ? `${typo.letterSpacing}px` : undefined,
          }}>{cfg.text || "App"}</span>
        )}
      </div>
    );
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, margin: 0, marginBottom: 4 }}>Logo Configuration</h3>
        <p style={{ fontSize: 12, color: COLORS.textDim, margin: 0 }}>Configure a identidade visual do aplicativo</p>
      </div>

      {renderPreview()}

      <Field label="Tipo de Logo">
        <div style={{ display: "flex", gap: 4 }}>
          {[
            { id: "text", label: "Texto" },
            { id: "icon-text", label: "Ícone + Texto" },
            { id: "image", label: "Imagem" },
          ].map(opt => (
            <button key={opt.id} onClick={() => update("type", opt.id)} style={{
              ...s.btnSmall,
              background: cfg.type === opt.id ? COLORS.accent : COLORS.surface3,
              color: cfg.type === opt.id ? "#fff" : COLORS.textMuted,
              fontWeight: cfg.type === opt.id ? 600 : 400,
              padding: "6px 14px",
            }}>{opt.label}</button>
          ))}
        </div>
      </Field>

      {(cfg.type === "text" || cfg.type === "icon-text") && (
        <Field label="Texto">
          <input value={cfg.text || ""} onChange={(e) => update("text", e.target.value)} style={s.input} placeholder="Nome do app" />
        </Field>
      )}

      {cfg.type === "icon-text" && (
        <>
          <Field label="Ícone (emoji ou upload)">
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
              <input value={cfg.icon || ""} onChange={(e) => update("icon", e.target.value)} style={{ ...s.input, width: 60, textAlign: "center", fontSize: 18 }} />
              <IconPicker value={(!cfg.iconUrl && cfg.icon) || ""} onSelect={(ic) => onChange({ ...cfg, icon: ic, iconUrl: "" })} />
            </div>
          </Field>
          <Field label="Ou upload de ícone (imagem)">
            <div
              onDragOver={(e) => { e.preventDefault(); setIconDragOver(true); }}
              onDragLeave={() => setIconDragOver(false)}
              onDrop={handleIconDrop}
              onClick={() => document.getElementById("orqui-icon-upload")?.click()}
              style={{
                border: `2px dashed ${iconDragOver ? COLORS.accent : COLORS.border}`,
                borderRadius: 8, padding: 12, textAlign: "center",
                background: iconDragOver ? COLORS.accent + "08" : COLORS.surface2,
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              {cfg.iconUrl ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                  <img src={cfg.iconUrl} alt="Icon" style={{ height: 24, objectFit: "contain" }} />
                  <span style={{ fontSize: 11, color: COLORS.textDim }}>Clique ou arraste para trocar</span>
                  <button onClick={(e) => { e.stopPropagation(); update("iconUrl", ""); }} style={{ ...s.btnSmall, fontSize: 10, padding: "2px 6px" }}>✕</button>
                </div>
              ) : (
                <span style={{ fontSize: 11, color: COLORS.textMuted }}>Arraste imagem do ícone aqui</span>
              )}
              <input id="orqui-icon-upload" type="file" accept="image/*" onChange={(e) => handleImageFile(e.target.files?.[0], "iconUrl")} style={{ display: "none" }} />
            </div>
          </Field>
          <Field label="Tamanho do ícone">
            <Row gap={8}>
              <input type="range" min={12} max={48} value={cfg.iconSize || 20} onChange={(e) => update("iconSize", Number(e.target.value))} style={{ flex: 1 }} />
              <span style={{ fontSize: 12, color: COLORS.textMuted, width: 40, textAlign: "right" }}>{cfg.iconSize || 20}px</span>
            </Row>
          </Field>
          <Field label="Espaço entre ícone e texto (gap)">
            <Row gap={8}>
              <input type="range" min={0} max={24} value={cfg.iconGap || 8} onChange={(e) => update("iconGap", Number(e.target.value))} style={{ flex: 1 }} />
              <span style={{ fontSize: 12, color: COLORS.textMuted, width: 40, textAlign: "right" }}>{cfg.iconGap || 8}px</span>
            </Row>
          </Field>
        </>
      )}

      {cfg.type === "image" && (
        <Field label="Imagem">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleImageDrop}
            style={{
              border: `2px dashed ${dragOver ? COLORS.accent : COLORS.border}`,
              borderRadius: 8, padding: 20, textAlign: "center",
              background: dragOver ? COLORS.accent + "08" : COLORS.surface2,
              cursor: "pointer", transition: "all 0.15s",
            }}
            onClick={() => document.getElementById("orqui-logo-upload")?.click()}
          >
            {cfg.imageUrl ? (
              <div>
                <img src={cfg.imageUrl} alt="Logo" style={{ height: 40, maxWidth: 200, objectFit: "contain", marginBottom: 8 }} />
                <div style={{ fontSize: 11, color: COLORS.textDim }}>Clique ou arraste para trocar</div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: COLORS.textMuted }}>
                Arraste uma imagem aqui ou clique para upload
              </div>
            )}
            <input id="orqui-logo-upload" type="file" accept="image/*" onChange={(e) => handleImageFile(e.target.files?.[0], "imageUrl")} style={{ display: "none" }} />
          </div>
          <div style={{ marginTop: 6 }}>
            <Field label="Ou cole URL">
              <input value={cfg.imageUrl || ""} onChange={(e) => update("imageUrl", e.target.value)} style={{ ...s.input, fontSize: 11 }} placeholder="https://..." />
            </Field>
          </div>
        </Field>
      )}

      {/* Typography */}
      {(cfg.type === "text" || cfg.type === "icon-text") && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 10 }}>Tipografia do Logo</div>
          <Row gap={8}>
            <Field label="Fonte" style={{ flex: 1 }}>
              <select value={typo.fontFamily || ""} onChange={(e) => updateTypo("fontFamily", e.target.value)} style={s.select}>
                <option value="">Sistema (inherit)</option>
                {GOOGLE_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </Field>
            <Field label="Tamanho" style={{ width: 80 }}>
              <input type="number" value={typo.fontSize || 16} onChange={(e) => updateTypo("fontSize", Number(e.target.value))} style={s.input} min={8} max={48} />
            </Field>
          </Row>
          <Row gap={8}>
            <Field label="Peso" style={{ flex: 1 }}>
              <select value={typo.fontWeight || 700} onChange={(e) => updateTypo("fontWeight", Number(e.target.value))} style={s.select}>
                {[300, 400, 500, 600, 700, 800, 900].map(w => <option key={w} value={w}>{w}{w === 400 ? " (normal)" : w === 700 ? " (bold)" : ""}</option>)}
              </select>
            </Field>
            <Field label="Cor" style={{ width: 120 }}>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <input type="color" value={typo.color || "#e4e4e7"} onChange={(e) => updateTypo("color", e.target.value)} style={{ width: 32, height: 28, border: "none", padding: 0, cursor: "pointer" }} />
                <input value={typo.color || ""} onChange={(e) => updateTypo("color", e.target.value)} style={{ ...s.input, flex: 1, fontSize: 11 }} placeholder="var(--foreground)" />
              </div>
            </Field>
          </Row>
          <Field label="Letter Spacing">
            <Row gap={8}>
              <input type="range" min={-2} max={8} step={0.1} value={typo.letterSpacing || 0} onChange={(e) => updateTypo("letterSpacing", Number(e.target.value))} style={{ flex: 1 }} />
              <span style={{ fontSize: 12, color: COLORS.textMuted, width: 50, textAlign: "right" }}>{typo.letterSpacing || 0}px</span>
            </Row>
          </Field>
        </div>
      )}

      {/* Padding */}
      <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${COLORS.border}` }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 10 }}>Padding do Container</div>

        {/* Alignment Grid warning */}
        {cfg.alignWithHeader && (
          <div style={{ padding: "8px 10px", background: COLORS.surface2, borderRadius: 6, fontSize: 11, color: COLORS.textDim, lineHeight: 1.5, borderLeft: `3px solid ${COLORS.accent}40`, marginBottom: 10 }}>
            <strong style={{ color: COLORS.text }}>⚡ Alignment Grid:</strong> O padding horizontal do logo é controlado pelo token{" "}
            <code style={{ color: COLORS.accent }}>sidebar-pad</code> via header sidebar-zone.
            Padding left/right = 0 é intencional — ajuste apenas offset vertical se necessário.
          </div>
        )}

        <Row gap={8}>
          {(["top", "right", "bottom", "left"] as const).map(side => (
            <Field key={side} label={side} style={{ flex: 1 }}>
              <input type="number" value={pad[side] || 0} onChange={(e) => updatePadding(side, e.target.value)} style={s.input} min={0} max={64} />
            </Field>
          ))}
        </Row>
      </div>

      {/* Position */}
      <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${COLORS.border}` }}>
        <Field label="Posição do Logo">
          <div style={{ display: "flex", gap: 4 }}>
            {[
              { id: "sidebar", label: "Sidebar" },
              { id: "header", label: "Header" },
            ].map(opt => (
              <button key={opt.id} onClick={() => update("position", opt.id)} style={{
                ...s.btnSmall,
                background: cfg.position === opt.id ? COLORS.accent : COLORS.surface3,
                color: cfg.position === opt.id ? "#fff" : COLORS.textMuted,
                padding: "6px 14px",
              }}>{opt.label}</button>
            ))}
          </div>
        </Field>

        {cfg.position === "header" && (
          <Field label="Slot no Header">
            <div style={{ display: "flex", gap: 4 }}>
              {["left", "center", "right"].map(pos => (
                <button key={pos} onClick={() => update("headerSlot", pos)} style={{
                  ...s.btnSmall,
                  background: cfg.headerSlot === pos ? COLORS.accent : COLORS.surface3,
                  color: cfg.headerSlot === pos ? "#fff" : COLORS.textMuted,
                  padding: "6px 14px", textTransform: "capitalize",
                }}>{pos === "left" ? "Esquerda" : pos === "center" ? "Centro" : "Direita"}</button>
              ))}
            </div>
          </Field>
        )}

        {cfg.position === "sidebar" && (
          <>
            <Field label="Alinhamento na Sidebar">
              <div style={{ display: "flex", gap: 4 }}>
                {["left", "center", "right"].map(pos => (
                  <button key={pos} onClick={() => update("sidebarAlign", pos)} style={{
                    ...s.btnSmall,
                    background: cfg.sidebarAlign === pos ? COLORS.accent : COLORS.surface3,
                    color: cfg.sidebarAlign === pos ? "#fff" : COLORS.textMuted,
                    padding: "6px 14px", textTransform: "capitalize",
                  }}>{pos === "left" ? "Esquerda" : pos === "center" ? "Centro" : "Direita"}</button>
                ))}
              </div>
            </Field>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: COLORS.textMuted, cursor: "pointer", marginTop: 8 }}>
              <input type="checkbox" checked={cfg.alignWithHeader ?? true} onChange={(e) => update("alignWithHeader", e.target.checked)} />
              Usar Alignment Grid (padding controlado por sidebar-pad)
            </label>
            {cfg.alignWithHeader && (
              <div style={{ marginTop: 6, fontSize: 11, color: COLORS.textDim, lineHeight: 1.5 }}>
                Logo herda o padding da <strong style={{ color: COLORS.accent }}>header sidebar-zone</strong>. Altere{" "}
                <code style={{ color: COLORS.accent }}>sidebar-pad</code> em Tokens → Sizing para ajustar.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

