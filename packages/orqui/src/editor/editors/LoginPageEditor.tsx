import React, { useState } from "react";
import { COLORS, s } from "../lib/constants";
import { Field, Row, Section, ColorInput } from "../components/shared";
import { LucideSvg } from "../components/LucideIcons";

// ============================================================================
// Gradient Editor — visual color stops + angle + raw CSS
// ============================================================================

function parseGradient(css: string): { type: string; angle: string; stops: string[] } {
  const m = css.match(/^(linear-gradient|radial-gradient)\(([^,]+),\s*(.+)\)$/i);
  if (!m) return { type: "linear-gradient", angle: "135deg", stops: ["#111113", "#1a1a2e"] };
  const rawStops = m[3].split(",").map(s => s.trim());
  return { type: m[1], angle: m[2].trim(), stops: rawStops };
}

function buildGradient(type: string, angle: string, stops: string[]): string {
  return `${type}(${angle}, ${stops.join(", ")})`;
}

function GradientEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parsed = parseGradient(value);
  const [showRaw, setShowRaw] = useState(false);

  const updateAngle = (angle: string) => onChange(buildGradient(parsed.type, angle, parsed.stops));
  const updateStop = (idx: number, color: string) => {
    const next = [...parsed.stops];
    next[idx] = color;
    onChange(buildGradient(parsed.type, parsed.angle, next));
  };
  const addStop = () => {
    const last = parsed.stops[parsed.stops.length - 1] || "#000000";
    onChange(buildGradient(parsed.type, parsed.angle, [...parsed.stops, last]));
  };
  const removeStop = (idx: number) => {
    if (parsed.stops.length <= 2) return;
    onChange(buildGradient(parsed.type, parsed.angle, parsed.stops.filter((_, i) => i !== idx)));
  };

  const angleDeg = parseInt(parsed.angle) || 135;

  return (
    <div>
      {/* Preview */}
      <div style={{
        height: 40, borderRadius: 6, marginBottom: 12,
        background: value, border: `1px solid ${COLORS.border}`,
      }} />

      {/* Type */}
      <Field label="Tipo">
        <div style={{ display: "flex", gap: 4 }}>
          {["linear-gradient", "radial-gradient"].map(t => (
            <button key={t} onClick={() => onChange(buildGradient(t, parsed.angle, parsed.stops))} style={{
              ...s.btnSmall, padding: "5px 12px",
              background: parsed.type === t ? COLORS.accent : COLORS.surface3,
              color: parsed.type === t ? "#fff" : COLORS.textMuted,
            }}>{t === "linear-gradient" ? "Linear" : "Radial"}</button>
          ))}
        </div>
      </Field>

      {/* Angle (linear only) */}
      {parsed.type === "linear-gradient" && (
        <Field label="Angulo">
          <Row>
            <input
              type="range" min={0} max={360} value={angleDeg}
              onChange={(e) => updateAngle(`${e.target.value}deg`)}
              style={{ flex: 1 }}
            />
            <input
              value={parsed.angle}
              onChange={(e) => updateAngle(e.target.value)}
              style={{ ...s.input, width: 80, textAlign: "center", fontSize: 12 }}
            />
          </Row>
        </Field>
      )}

      {/* Color Stops */}
      <Field label="Color Stops">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {parsed.stops.map((stop, i) => (
            <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="color"
                value={stop.split(" ")[0] || "#000000"}
                onChange={(e) => updateStop(i, e.target.value)}
                style={{ width: 32, height: 28, border: "none", padding: 0, cursor: "pointer", borderRadius: 4, background: "none" }}
              />
              <input
                value={stop}
                onChange={(e) => updateStop(i, e.target.value)}
                style={{ ...s.input, flex: 1, fontSize: 11 }}
                placeholder="#hex ou #hex 50%"
              />
              {parsed.stops.length > 2 && (
                <button onClick={() => removeStop(i)} style={{ ...s.btnSmall, fontSize: 10, padding: "3px 6px", color: COLORS.danger }}>✕</button>
              )}
            </div>
          ))}
          <button onClick={addStop} style={{ ...s.btnSmall, alignSelf: "flex-start", fontSize: 11 }}>+ Cor</button>
        </div>
      </Field>

      {/* Raw CSS toggle */}
      <div style={{ marginTop: 4 }}>
        <button onClick={() => setShowRaw(!showRaw)} style={{ ...s.btnSmall, fontSize: 10 }}>
          {showRaw ? "Fechar CSS" : "Editar CSS"}
        </button>
        {showRaw && (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{ ...s.input, minHeight: 50, resize: "vertical", fontFamily: "monospace", fontSize: 11, marginTop: 6 }}
            placeholder="linear-gradient(135deg, #1a1a2e, #16213e)"
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Logo Mini Preview — renders global logo at given scale
// ============================================================================

function LogoMiniPreview({ gLogo, scale = 1 }: { gLogo: any; scale?: number }) {
  const typo = gLogo.typography || {};
  const sz = (typo.fontSize || 16) * scale;
  const iconSz = (gLogo.iconSize || 20) * scale;
  const gap = (gLogo.iconGap || 8) * scale;

  if (gLogo.type === "image" && gLogo.imageUrl) {
    return <img src={gLogo.imageUrl} alt="Logo" style={{ height: 32 * scale, objectFit: "contain" as const }} />;
  }

  const textEl = (
    <span style={{
      fontSize: sz, fontWeight: typo.fontWeight || 700,
      color: typo.color || COLORS.text,
      fontFamily: typo.fontFamily || "inherit",
      letterSpacing: typo.letterSpacing ? `${typo.letterSpacing}px` : undefined,
    }}>{gLogo.text || "App"}</span>
  );

  if (gLogo.type === "icon-text") {
    const icon = gLogo.icon || gLogo.iconUrl || "";
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap }}>
        {gLogo.iconUrl ? (
          <img src={gLogo.iconUrl} alt="" style={{ height: iconSz, objectFit: "contain" as const }} />
        ) : (icon.startsWith("ph:") || icon.startsWith("lucide:")) ? (() => {
          const iconName = icon.replace(/^(lucide:|ph:)/, "");
          return <LucideSvg name={iconName} size={iconSz} color={typo.color || COLORS.text} />;
        })() : (
          <span style={{ fontSize: iconSz }}>{icon}</span>
        )}
        {textEl}
      </div>
    );
  }

  return textEl;
}

// ============================================================================
// Login Page Editor — CRUD completo para tela de login
// ============================================================================

interface LoginPageEditorProps {
  config: any;
  onChange: (config: any) => void;
  globalLogo?: any;
  tokens?: any;
}

export function LoginPageEditor({ config, onChange, globalLogo, tokens = {} }: LoginPageEditorProps) {
  const cfg = config || {};
  const update = (section: string, field: string, val: any) => {
    onChange({ ...cfg, [section]: { ...(cfg[section] || {}), [field]: val } });
  };

  const logo = cfg.logo || {};
  const bg = cfg.background || {};
  const card = cfg.card || {};
  const title = cfg.title || {};
  const inputs = cfg.inputs || {};
  const button = cfg.button || {};
  const links = cfg.links || {};
  const footer = cfg.footer || {};

  const gLogo = globalLogo || {};

  // Drag state for background image upload
  const [bgDragOver, setBgDragOver] = useState(false);

  const handleFileUpload = (section: string, field: string) => (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => update(section, field, reader.result as string);
    reader.readAsDataURL(file);
  };

  // ── Background resolution for preview ──
  const resolveBackground = () => {
    const t = bg.type || "solid";
    if (t === "gradient" && bg.gradient) return bg.gradient;
    if (t === "image" && bg.imageUrl) return `url(${bg.imageUrl})`;
    return bg.color || "#111113";
  };

  // ── Card position via flexbox ──
  const resolveCardAlign = () => {
    const h = card.position || "center";
    const v = card.verticalAlign || "center";
    const justifyMap: Record<string, string> = { left: "flex-start", center: "center", right: "flex-end" };
    const alignMap: Record<string, string> = { top: "flex-start", center: "center", bottom: "flex-end" };
    return { justifyContent: justifyMap[h] || "center", alignItems: alignMap[v] || "center" };
  };

  return (
    <div>
      {/* ── Preview ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Preview</div>
        <div style={{
          borderRadius: 8, border: `1px solid ${COLORS.border}`, overflow: "hidden",
          height: 280, position: "relative",
          background: resolveBackground(),
          backgroundSize: "cover", backgroundPosition: "center",
          display: "flex", ...resolveCardAlign(), padding: 24,
        }}>
          {/* Overlay */}
          {bg.overlay && (
            <div style={{ position: "absolute", inset: 0, background: bg.overlay }} />
          )}
          {/* Card */}
          <div style={{
            position: "relative", zIndex: 1,
            width: "100%", maxWidth: card.maxWidth ? parseInt(card.maxWidth) * 0.5 : 180,
            background: card.background || "rgba(24,25,27,0.95)",
            border: `1px solid ${card.borderColor || COLORS.border}`,
            borderRadius: card.borderRadius || "8px",
            boxShadow: card.shadow || "0 8px 32px rgba(0,0,0,0.4)",
            padding: card.padding || "16px",
            transform: "scale(0.55)", transformOrigin: "center center",
          }}>
            {/* Logo preview (uses global logo config) */}
            {logo.enabled !== false && (
              <div style={{ textAlign: logo.align || "center", marginBottom: 6 }}>
                <LogoMiniPreview gLogo={gLogo} scale={(logo.scale || 1) * 0.5} />
              </div>
            )}
            {/* Title */}
            <div style={{
              textAlign: (title.align as any) || "center", marginBottom: 8,
              fontSize: "16px", fontWeight: "600",
              color: COLORS.text,
            }}>{title.text || "Entrar"}</div>
            {/* Mock inputs */}
            {[1, 2].map(i => (
              <div key={i} style={{ marginBottom: 6 }}>
                <div style={{
                  fontSize: "9px", color: COLORS.textMuted,
                  fontWeight: "500", marginBottom: 2,
                }}>Label</div>
                <div style={{
                  height: 22, borderRadius: "4px",
                  background: inputs.background || COLORS.surface2,
                  border: `1px solid ${inputs.borderColor || COLORS.border}`,
                }} />
              </div>
            ))}
            {/* Mock button */}
            <div style={{
              height: 24, marginTop: 8,
              background: button.background || COLORS.accent,
              borderRadius: "6px",
            }} />
            {/* Mock link */}
            <div style={{
              textAlign: "center", marginTop: 6,
              fontSize: "8px", color: links.color || COLORS.accent,
            }}>Link de registro</div>
          </div>
        </div>
      </div>

      {/* ── Logo ─────────────────────────────────────────── */}
      <Section title="Logo" defaultOpen id="login-logo">
        <div style={s.infoBox}>
          A aparencia da logo e configurada em <strong style={{ color: COLORS.accent }}>Identidade &gt; Logo</strong>.
          Aqui voce controla apenas se ela aparece na tela de login e como e posicionada.
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: COLORS.textMuted, cursor: "pointer", marginTop: 12, marginBottom: 12 }}>
          <input type="checkbox" checked={logo.enabled !== false} onChange={(e) => update("logo", "enabled", e.target.checked)} />
          Exibir logo na tela de login
        </label>

        {logo.enabled !== false && (
          <>
            {/* Live preview of global logo */}
            <div style={{
              background: COLORS.surface2, borderRadius: 6, padding: 12, marginBottom: 12,
              border: `1px solid ${COLORS.border}`,
              display: "flex", justifyContent: logo.align || "center",
            }}>
              <LogoMiniPreview gLogo={gLogo} scale={logo.scale || 1} />
            </div>

            <Field label="Posicionamento">
              <div style={{ display: "flex", gap: 4 }}>
                {[
                  { id: "inside-card", label: "Dentro do Card" },
                  { id: "above-card", label: "Acima do Card" },
                ].map(opt => (
                  <button key={opt.id} onClick={() => update("logo", "placement", opt.id)} style={{
                    ...s.btnSmall, padding: "6px 14px",
                    background: (logo.placement || "inside-card") === opt.id ? COLORS.accent : COLORS.surface3,
                    color: (logo.placement || "inside-card") === opt.id ? "#fff" : COLORS.textMuted,
                  }}>{opt.label}</button>
                ))}
              </div>
            </Field>

            <Field label="Alinhamento">
              <div style={{ display: "flex", gap: 4 }}>
                {(["left", "center", "right"] as const).map(a => (
                  <button key={a} onClick={() => update("logo", "align", a)} style={{
                    ...s.btnSmall, padding: "6px 14px",
                    background: (logo.align || "center") === a ? COLORS.accent : COLORS.surface3,
                    color: (logo.align || "center") === a ? "#fff" : COLORS.textMuted,
                  }}>{a === "left" ? "Esquerda" : a === "center" ? "Centro" : "Direita"}</button>
                ))}
              </div>
            </Field>

            <Field label="Escala">
              <Row>
                <input type="range" min={0.5} max={2} step={0.1} value={logo.scale || 1} onChange={(e) => update("logo", "scale", Number(e.target.value))} style={{ flex: 1 }} />
                <span style={{ fontSize: 12, color: COLORS.textMuted, width: 40, textAlign: "right" }}>{logo.scale || 1}x</span>
              </Row>
            </Field>

            <Field label="Espaco abaixo">
              <input value={logo.marginBottom || "16px"} onChange={(e) => update("logo", "marginBottom", e.target.value)} style={s.input} placeholder="16px" />
            </Field>
          </>
        )}
      </Section>

      {/* ── Background ─────────────────────────────────────── */}
      <Section title="Background" defaultOpen id="login-background">
        <Field label="Tipo">
          <div style={{ display: "flex", gap: 4 }}>
            {[
              { id: "solid", label: "Cor Sólida" },
              { id: "gradient", label: "Gradiente" },
              { id: "image", label: "Imagem" },
            ].map(opt => (
              <button key={opt.id} onClick={() => update("background", "type", opt.id)} style={{
                ...s.btnSmall, padding: "6px 14px",
                background: (bg.type || "solid") === opt.id ? COLORS.accent : COLORS.surface3,
                color: (bg.type || "solid") === opt.id ? "#fff" : COLORS.textMuted,
              }}>{opt.label}</button>
            ))}
          </div>
        </Field>

        {(bg.type === "solid" || !bg.type) && (
          <Field label="Cor de Fundo">
            <ColorInput value={bg.color || "#111113"} onChange={(v) => update("background", "color", v)} tokens={tokens} />
          </Field>
        )}

        {bg.type === "gradient" && (
          <GradientEditor
            value={bg.gradient || "linear-gradient(135deg, #111113, #1a1a2e)"}
            onChange={(v) => update("background", "gradient", v)}
          />
        )}

        {bg.type === "image" && (
          <>
            <div
              onDragOver={(e) => { e.preventDefault(); setBgDragOver(true); }}
              onDragLeave={() => setBgDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setBgDragOver(false); handleFileUpload("background", "imageUrl")(e.dataTransfer?.files?.[0]); }}
              onClick={() => document.getElementById("orqui-login-bg-upload")?.click()}
              style={{
                border: `2px dashed ${bgDragOver ? COLORS.accent : COLORS.border}`,
                borderRadius: 8, padding: 20, textAlign: "center",
                background: bgDragOver ? COLORS.accent + "08" : COLORS.surface2,
                cursor: "pointer", transition: "all 0.15s", marginBottom: 12,
              }}
            >
              {bg.imageUrl ? (
                <div>
                  <div style={{ width: "100%", height: 60, backgroundImage: `url(${bg.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center", borderRadius: 4, marginBottom: 4 }} />
                  <div style={{ fontSize: 11, color: COLORS.textDim }}>Clique ou arraste para trocar</div>
                </div>
              ) : (
                <span style={{ fontSize: 12, color: COLORS.textMuted }}>Arraste imagem de fundo aqui</span>
              )}
              <input id="orqui-login-bg-upload" type="file" accept="image/*" onChange={(e) => handleFileUpload("background", "imageUrl")(e.target.files?.[0])} style={{ display: "none" }} />
            </div>
            <Field label="Ou cole URL">
              <input value={bg.imageUrl || ""} onChange={(e) => update("background", "imageUrl", e.target.value)} style={{ ...s.input, fontSize: 11 }} placeholder="https://..." />
            </Field>
          </>
        )}

        {bg.type === "image" && (
          <Field label="Overlay (rgba)">
            <ColorInput value={bg.overlay || ""} onChange={(v) => update("background", "overlay", v)} tokens={tokens} />
          </Field>
        )}
      </Section>

      {/* ── Card ────────────────────────────────────────── */}
      <Section title="Card" defaultOpen={false} id="login-card">
        <Field label="Posicao Horizontal">
          <div style={{ display: "flex", gap: 4 }}>
            {(["left", "center", "right"] as const).map(pos => (
              <button key={pos} onClick={() => update("card", "position", pos)} style={{
                ...s.btnSmall, padding: "6px 14px",
                background: (card.position || "center") === pos ? COLORS.accent : COLORS.surface3,
                color: (card.position || "center") === pos ? "#fff" : COLORS.textMuted,
              }}>{pos === "left" ? "Esquerda" : pos === "center" ? "Centro" : "Direita"}</button>
            ))}
          </div>
        </Field>
        <Field label="Alinhamento Vertical">
          <div style={{ display: "flex", gap: 4 }}>
            {(["top", "center", "bottom"] as const).map(pos => (
              <button key={pos} onClick={() => update("card", "verticalAlign", pos)} style={{
                ...s.btnSmall, padding: "6px 14px",
                background: (card.verticalAlign || "center") === pos ? COLORS.accent : COLORS.surface3,
                color: (card.verticalAlign || "center") === pos ? "#fff" : COLORS.textMuted,
              }}>{pos === "top" ? "Topo" : pos === "center" ? "Centro" : "Base"}</button>
            ))}
          </div>
        </Field>
        <Row>
          <Field label="Max Width" style={{ flex: 1 }}>
            <input value={card.maxWidth || "420px"} onChange={(e) => update("card", "maxWidth", e.target.value)} style={s.input} placeholder="420px" />
          </Field>
          <Field label="Padding" style={{ flex: 1 }}>
            <input value={card.padding || ""} onChange={(e) => update("card", "padding", e.target.value)} style={s.input} placeholder="24px" />
          </Field>
        </Row>
        <Row>
          <Field label="Background" style={{ flex: 1 }}>
            <ColorInput value={card.background || ""} onChange={(v) => update("card", "background", v)} tokens={tokens} />
          </Field>
          <Field label="Border Color" style={{ flex: 1 }}>
            <ColorInput value={card.borderColor || ""} onChange={(v) => update("card", "borderColor", v)} tokens={tokens} />
          </Field>
        </Row>
        <Row>
          <Field label="Border Radius" style={{ flex: 1 }}>
            <input value={card.borderRadius || ""} onChange={(e) => update("card", "borderRadius", e.target.value)} style={s.input} placeholder="8px" />
          </Field>
          <Field label="Shadow" style={{ flex: 1 }}>
            <input value={card.shadow || ""} onChange={(e) => update("card", "shadow", e.target.value)} style={s.input} placeholder="0 8px 32px rgba(0,0,0,0.4)" />
          </Field>
        </Row>
      </Section>

      {/* ── Titulo ──────────────────────────────────────── */}
      <Section title="Titulo" defaultOpen={false} id="login-title">
        <Field label="Texto">
          <input value={title.text || ""} onChange={(e) => update("title", "text", e.target.value)} style={s.input} placeholder="Entrar" />
        </Field>
        <Field label="Alinhamento">
          <div style={{ display: "flex", gap: 4 }}>
            {(["left", "center", "right"] as const).map(a => (
              <button key={a} onClick={() => update("title", "align", a)} style={{
                ...s.btnSmall, padding: "6px 14px",
                background: (title.align || "center") === a ? COLORS.accent : COLORS.surface3,
                color: (title.align || "center") === a ? "#fff" : COLORS.textMuted,
              }}>{a === "left" ? "Esquerda" : a === "center" ? "Centro" : "Direita"}</button>
            ))}
          </div>
        </Field>
        <div style={s.infoBox}>
          Tipografia, cores e tamanhos herdam dos <strong style={{ color: COLORS.accent }}>tokens globais</strong> e CSS variables do tema.
        </div>
      </Section>

      {/* ── Cores dos Inputs ─────────────────────────────── */}
      <Section title="Cores dos Inputs" defaultOpen={false} id="login-inputs">
        <Row>
          <Field label="Background" style={{ flex: 1 }}>
            <ColorInput value={inputs.background || ""} onChange={(v) => update("inputs", "background", v)} tokens={tokens} />
          </Field>
          <Field label="Border Color" style={{ flex: 1 }}>
            <ColorInput value={inputs.borderColor || ""} onChange={(v) => update("inputs", "borderColor", v)} tokens={tokens} />
          </Field>
        </Row>
        <Field label="Focus Border Color">
          <ColorInput value={inputs.focusBorderColor || ""} onChange={(v) => update("inputs", "focusBorderColor", v)} tokens={tokens} />
        </Field>
        <div style={s.infoBox}>
          Tipografia, padding, border-radius e placeholder herdam de <strong style={{ color: COLORS.accent }}>Cores &gt; input-bg / input-border</strong> e tokens globais.
        </div>
      </Section>

      {/* ── Cores do Botao ────────────────────────────────── */}
      <Section title="Cores do Botao" defaultOpen={false} id="login-button">
        <Row>
          <Field label="Background" style={{ flex: 1 }}>
            <ColorInput value={button.background || ""} onChange={(v) => update("button", "background", v)} tokens={tokens} />
          </Field>
          <Field label="Text Color" style={{ flex: 1 }}>
            <ColorInput value={button.color || ""} onChange={(v) => update("button", "color", v)} tokens={tokens} />
          </Field>
        </Row>
        <Field label="Hover Background">
          <ColorInput value={button.hoverBackground || ""} onChange={(v) => update("button", "hoverBackground", v)} tokens={tokens} />
        </Field>
        <div style={s.infoBox}>
          Tipografia e dimensoes herdam de <strong style={{ color: COLORS.accent }}>Cores &gt; accent</strong> e tokens globais.
        </div>
      </Section>

      {/* ── Cores dos Links ──────────────────────────────── */}
      <Section title="Cores dos Links" defaultOpen={false} id="login-links">
        <Row>
          <Field label="Cor" style={{ flex: 1 }}>
            <ColorInput value={links.color || ""} onChange={(v) => update("links", "color", v)} tokens={tokens} />
          </Field>
          <Field label="Hover Color" style={{ flex: 1 }}>
            <ColorInput value={links.hoverColor || ""} onChange={(v) => update("links", "hoverColor", v)} tokens={tokens} />
          </Field>
        </Row>
      </Section>

      {/* ── Footer ─────────────────────────────────────── */}
      <Section title="Footer" defaultOpen={false} id="login-footer">
        <Field label="Texto auxiliar">
          <input value={footer.text || ""} onChange={(e) => update("footer", "text", e.target.value)} style={s.input} placeholder="Powered by Gatekeeper" />
        </Field>
      </Section>
    </div>
  );
}
