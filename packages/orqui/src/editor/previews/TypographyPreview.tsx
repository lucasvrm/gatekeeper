import React from "react";
import { COLORS, s } from "../lib/constants";
import { EmptyState } from "../components/shared";
import { resolveTextStyleCSS } from "../lib/utils";

// ============================================================================
// Typography Preview
// ============================================================================
export function TypographyPreview({ layout }) {
  const tokens = layout.tokens;
  const textStyles = layout.textStyles || {};

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, margin: 0, marginBottom: 4 }}>Typography Preview</h3>
        <p style={{ fontSize: 12, color: COLORS.textDim, margin: 0 }}>Todos os text styles renderizados com tokens reais</p>
      </div>

      {/* Type scale overview */}
      <div style={{ ...s.card, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Escala tipográfica</div>
        {Object.entries(tokens.fontSizes || {}).sort((a, b) => a[1].value - b[1].value).map(([key, tok]) => {
          const fam = tokens.fontFamilies?.primary;
          const famStr = fam ? `'${fam.family}', ${fam.fallbacks.join(", ")}` : "sans-serif";
          return (
            <div key={key} style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${COLORS.border}` }}>
              <span style={{ fontSize: 11, color: COLORS.accent, fontFamily: "'JetBrains Mono', monospace", minWidth: 40, textAlign: "right" }}>{key}</span>
              <span style={{ fontSize: 11, color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace", minWidth: 50 }}>{tok.value}{tok.unit}</span>
              <span style={{ fontSize: `${tok.value}${tok.unit}`, fontFamily: famStr, color: COLORS.text, lineHeight: 1.3 }}>The quick brown fox</span>
            </div>
          );
        })}
      </div>

      {/* Text styles rendered */}
      <div style={{ ...s.card, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16 }}>Text Styles</div>
        {Object.entries(textStyles).map(([key, style]) => {
          const css = resolveTextStyleCSS(style, tokens);
          return (
            <div key={key} style={{ marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${COLORS.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.accent, fontFamily: "'JetBrains Mono', monospace" }}>{key}</span>
                {style.description && <span style={{ fontSize: 11, color: COLORS.textDim }}>— {style.description}</span>}
              </div>
              <div style={{ ...css, color: COLORS.text, marginBottom: 8 }}>
                The quick brown fox jumps over the lazy dog. 0123456789
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {style.fontFamily && <span style={s.tag}>{style.fontFamily.split(".").pop()}</span>}
                {style.fontSize && <span style={s.tag}>{style.fontSize.split(".").pop()}</span>}
                {style.fontWeight && <span style={s.tag}>{style.fontWeight.split(".").pop()}</span>}
                {style.lineHeight && <span style={s.tag}>lh: {style.lineHeight.split(".").pop()}</span>}
                {style.letterSpacing && <span style={s.tag}>ls: {style.letterSpacing.split(".").pop()}</span>}
              </div>
            </div>
          );
        })}
        {Object.keys(textStyles).length === 0 && <EmptyState message="Nenhum text style definido" />}
      </div>

      {/* Simulated page */}
      <div style={{ ...s.card }}>
        <div style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16 }}>Simulação de página</div>
        <div style={{ background: COLORS.surface2, borderRadius: 8, padding: 24 }}>
          {textStyles["heading-1"] && (
            <div style={{ ...resolveTextStyleCSS(textStyles["heading-1"], tokens), color: COLORS.text, marginBottom: 8 }}>Dashboard Overview</div>
          )}
          {textStyles["heading-2"] && (
            <div style={{ ...resolveTextStyleCSS(textStyles["heading-2"], tokens), color: COLORS.text, marginBottom: 12 }}>Métricas do sistema</div>
          )}
          {textStyles.body && (
            <div style={{ ...resolveTextStyleCSS(textStyles.body, tokens), color: COLORS.textMuted, marginBottom: 16 }}>
              Este painel mostra as métricas principais do sistema de validação. Todos os dados são atualizados em tempo real e refletem o estado atual dos validators ativos.
            </div>
          )}
          {textStyles["heading-3"] && (
            <div style={{ ...resolveTextStyleCSS(textStyles["heading-3"], tokens), color: COLORS.text, marginBottom: 8 }}>Validators ativos</div>
          )}
          {textStyles["body-sm"] && (
            <div style={{ ...resolveTextStyleCSS(textStyles["body-sm"], tokens), color: COLORS.textMuted, marginBottom: 12 }}>
              24 validators em 6 gates • Última execução: há 2 minutos
            </div>
          )}
          {textStyles.caption && (
            <div style={{ ...resolveTextStyleCSS(textStyles.caption, tokens), color: COLORS.textDim, marginBottom: 8, textTransform: "uppercase" }}>
              Status: operacional
            </div>
          )}
          {textStyles.code && (
            <div style={{ ...resolveTextStyleCSS(textStyles.code, tokens), color: COLORS.accent, background: COLORS.surface, padding: 12, borderRadius: 6 }}>
              TestFailsBeforeImplementation: PASSED (120ms)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
