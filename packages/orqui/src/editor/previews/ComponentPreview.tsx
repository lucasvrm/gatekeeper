import React, { useState, useMemo, useEffect } from "react";
import { COLORS, s } from "../lib/constants";
import { EmptyState } from "../components/shared";

export const MOCK_COMPONENT_STYLES = {
  Button: (props) => ({
    base: {
      padding: props.size === "sm" ? "4px 10px" : props.size === "lg" ? "10px 20px" : props.size === "icon" ? "8px" : "6px 14px",
      borderRadius: 6, fontSize: props.size === "sm" ? 12 : props.size === "lg" ? 15 : 13, fontWeight: 500,
      cursor: props.disabled ? "not-allowed" : "pointer", opacity: props.disabled || props.loading ? 0.5 : 1,
      display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "'Inter', sans-serif", border: "none", transition: "all 0.15s",
      ...(props.variant === "destructive" ? { background: COLORS.danger, color: "#fff" }
        : props.variant === "outline" ? { background: "transparent", color: COLORS.text, border: `1px solid ${COLORS.border2}` }
        : props.variant === "secondary" ? { background: COLORS.surface3, color: COLORS.text }
        : props.variant === "ghost" ? { background: "transparent", color: COLORS.textMuted }
        : props.variant === "link" ? { background: "transparent", color: COLORS.accent, textDecoration: "underline", padding: 0 }
        : { background: COLORS.accent, color: "#fff" }),
    },
  }),
  Badge: (props) => ({
    base: {
      display: "inline-flex", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 500, fontFamily: "'Inter', sans-serif",
      ...(props.variant === "destructive" ? { background: "#dc262620", color: COLORS.danger, border: "1px solid #dc262640" }
        : props.variant === "secondary" ? { background: COLORS.surface3, color: COLORS.textMuted, border: `1px solid ${COLORS.border}` }
        : props.variant === "outline" ? { background: "transparent", color: COLORS.textMuted, border: `1px solid ${COLORS.border2}` }
        : { background: `${COLORS.accent}20`, color: COLORS.accent, border: `1px solid ${COLORS.accent}30` }),
    },
  }),
  Card: () => ({ base: { background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 16, minWidth: 200 } }),
  DataTable: () => ({ base: { width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "'Inter', sans-serif" } }),
};

// ============================================================================
// Mock Component
// ============================================================================
export function MockComponent({ comp, propValues, slotContent, compName }: { comp: any; propValues: any; slotContent: any; compName?: string }) {
  const name = compName || comp.name || "Unknown";
  const styleFn = MOCK_COMPONENT_STYLES[name];

  // --- DataTable ---
  if (name === "DataTable") {
    const cols = propValues.columns || [{ key: "col1", label: "Column 1" }, { key: "col2", label: "Column 2" }];
    const data = propValues.data || [{ col1: "value 1", col2: "value 2" }, { col1: "value 3", col2: "value 4" }];
    return (
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "'Inter', sans-serif" }}>
        <thead><tr>{cols.map((c, i) => <th key={i} style={{ textAlign: "left", padding: "8px 10px", borderBottom: `1px solid ${COLORS.border2}`, color: COLORS.textMuted, fontWeight: 600, fontSize: 11 }}>{c.label}</th>)}</tr></thead>
        <tbody>{data.map((row, ri) => <tr key={ri}>{cols.map((c, ci) => <td key={ci} style={{ padding: "6px 10px", borderBottom: `1px solid ${COLORS.border}`, color: COLORS.text, fontSize: 12 }}>{String(row[c.key] ?? "")}</td>)}</tr>)}</tbody>
      </table>
    );
  }

  // --- Card ---
  if (name === "Card") {
    return (
      <div style={styleFn?.()?.base || {}}>
        {slotContent?.header && <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, color: COLORS.text }}>{slotContent.header}</div>}
        <div style={{ fontSize: 13, color: COLORS.textMuted }}>{slotContent?.content || "Card content"}</div>
        {slotContent?.footer && <div style={{ marginTop: 12, paddingTop: 8, borderTop: `1px solid ${COLORS.border}`, fontSize: 12, color: COLORS.textDim }}>{slotContent.footer}</div>}
      </div>
    );
  }

  // --- Dialog / AlertDialog ---
  if (name === "Dialog" || name === "AlertDialog") {
    return (
      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 24, minWidth: 280, maxWidth: 360, boxShadow: "0 16px 48px rgba(0,0,0,0.4)" }}>
        <div style={{ fontWeight: 600, fontSize: 16, color: COLORS.text, marginBottom: 8 }}>{propValues.title || "Dialog Title"}</div>
        <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 20 }}>{propValues.description || "Are you sure you want to continue? This action cannot be undone."}</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button style={{ padding: "6px 14px", borderRadius: 6, background: COLORS.surface3, color: COLORS.textMuted, border: `1px solid ${COLORS.border}`, fontSize: 13, cursor: "pointer" }}>Cancel</button>
          <button style={{ padding: "6px 14px", borderRadius: 6, background: name === "AlertDialog" ? COLORS.danger : COLORS.accent, color: "#fff", border: "none", fontSize: 13, cursor: "pointer" }}>Confirm</button>
        </div>
      </div>
    );
  }

  // --- Sheet ---
  if (name === "Sheet") {
    return (
      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: "12px 0 0 12px", padding: 20, minWidth: 260, minHeight: 200, boxShadow: "-4px 0 24px rgba(0,0,0,0.3)" }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: COLORS.text, marginBottom: 4 }}>{propValues.title || "Sheet Title"}</div>
        <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 16 }}>Sheet description</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 500 }}>Name</label>
            <input value="John Doe" readOnly style={{ padding: "6px 10px", borderRadius: 6, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, color: COLORS.text, fontSize: 13 }} />
          </div>
          <button style={{ padding: "6px 14px", borderRadius: 6, background: COLORS.accent, color: "#fff", border: "none", fontSize: 13 }}>Save changes</button>
        </div>
      </div>
    );
  }

  // --- Accordion ---
  if (name === "Accordion") {
    const items = ["Is it accessible?", "Is it styled?", "Is it animated?"];
    return (
      <div style={{ width: "100%", minWidth: 260 }}>
        {items.map((item, i) => (
          <div key={i} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", cursor: "pointer" }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: COLORS.text }}>{item}</span>
              <span style={{ color: COLORS.textMuted, fontSize: 14 }}>{i === 0 ? "▾" : "▸"}</span>
            </div>
            {i === 0 && <div style={{ paddingBottom: 12, fontSize: 12, color: COLORS.textMuted }}>Yes. It adheres to the WAI-ARIA design pattern.</div>}
          </div>
        ))}
      </div>
    );
  }

  // --- Tabs ---
  if (name === "Tabs") {
    return (
      <div style={{ minWidth: 280 }}>
        <div style={{ display: "flex", borderBottom: `1px solid ${COLORS.border}`, marginBottom: 12 }}>
          {["Account", "Password", "Settings"].map((t, i) => (
            <div key={t} style={{ padding: "8px 16px", fontSize: 13, fontWeight: i === 0 ? 600 : 400, color: i === 0 ? COLORS.text : COLORS.textMuted, borderBottom: i === 0 ? `2px solid ${COLORS.accent}` : "2px solid transparent", cursor: "pointer" }}>{t}</div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: COLORS.textMuted }}>Make changes to your account here.</div>
      </div>
    );
  }

  // --- Input ---
  if (name === "Input") {
    return (
      <input
        placeholder={propValues.placeholder || "Type here..."}
        disabled={propValues.disabled}
        style={{ padding: "8px 12px", borderRadius: 6, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, color: COLORS.text, fontSize: 13, width: 240, outline: "none", fontFamily: "'Inter', sans-serif", opacity: propValues.disabled ? 0.5 : 1 }}
      />
    );
  }

  // --- Textarea ---
  if (name === "Textarea") {
    return (
      <textarea
        placeholder={propValues.placeholder || "Type your message..."}
        rows={3}
        style={{ padding: "8px 12px", borderRadius: 6, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, color: COLORS.text, fontSize: 13, width: 260, resize: "vertical", outline: "none", fontFamily: "'Inter', sans-serif" }}
      />
    );
  }

  // --- Select ---
  if (name === "Select") {
    return (
      <div style={{ padding: "8px 12px", borderRadius: 6, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, color: COLORS.text, fontSize: 13, width: 200, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
        <span style={{ color: COLORS.textMuted }}>{propValues.placeholder || "Select option..."}</span>
        <span style={{ color: COLORS.textDim }}>▾</span>
      </div>
    );
  }

  // --- Checkbox ---
  if (name === "Checkbox") {
    return (
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COLORS.text, cursor: "pointer" }}>
        <div style={{ width: 16, height: 16, borderRadius: 3, border: `2px solid ${propValues.checked ? COLORS.accent : COLORS.border2}`, background: propValues.checked ? COLORS.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {propValues.checked && <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>✓</span>}
        </div>
        {propValues.label || "Accept terms"}
      </label>
    );
  }

  // --- Switch ---
  if (name === "Switch") {
    const on = propValues.checked ?? true;
    return (
      <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: COLORS.text, cursor: "pointer" }}>
        <div style={{ width: 40, height: 22, borderRadius: 11, background: on ? COLORS.accent : COLORS.surface3, padding: 2, transition: "all 0.2s", position: "relative" }}>
          <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "all 0.2s", transform: on ? "translateX(18px)" : "translateX(0)" }} />
        </div>
        {propValues.label || "Airplane Mode"}
      </label>
    );
  }

  // --- RadioGroup ---
  if (name === "RadioGroup") {
    const options = ["Default", "Comfortable", "Compact"];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {options.map((opt, i) => (
          <label key={opt} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COLORS.text, cursor: "pointer" }}>
            <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${i === 0 ? COLORS.accent : COLORS.border2}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {i === 0 && <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.accent }} />}
            </div>
            {opt}
          </label>
        ))}
      </div>
    );
  }

  // --- Slider ---
  if (name === "Slider") {
    const pct = propValues.value ?? 50;
    return (
      <div style={{ width: 240 }}>
        <div style={{ height: 6, borderRadius: 3, background: COLORS.surface3, position: "relative" }}>
          <div style={{ height: "100%", borderRadius: 3, background: COLORS.accent, width: `${pct}%` }} />
          <div style={{ position: "absolute", top: -5, left: `${pct}%`, transform: "translateX(-50%)", width: 16, height: 16, borderRadius: "50%", background: COLORS.accent, border: "2px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }} />
        </div>
      </div>
    );
  }

  // --- Progress ---
  if (name === "Progress") {
    const pct = propValues.value ?? 60;
    return (
      <div style={{ width: 240 }}>
        <div style={{ height: 8, borderRadius: 4, background: COLORS.surface3, overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 4, background: COLORS.accent, width: `${pct}%`, transition: "width 0.5s" }} />
        </div>
      </div>
    );
  }

  // --- Toast / Sonner ---
  if (name === "Toast" || name === "Sonner") {
    return (
      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "12px 16px", minWidth: 280, boxShadow: "0 4px 12px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 16 }}>✓</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{propValues.title || "Event created"}</div>
          <div style={{ fontSize: 12, color: COLORS.textMuted }}>{propValues.description || "Sunday, December 03, 2023 at 9:00 AM"}</div>
        </div>
      </div>
    );
  }

  // --- Tooltip ---
  if (name === "Tooltip") {
    return (
      <div style={{ position: "relative", display: "inline-block" }}>
        <button style={{ padding: "6px 14px", borderRadius: 6, background: COLORS.surface3, color: COLORS.text, border: `1px solid ${COLORS.border}`, fontSize: 13 }}>Hover me</button>
        <div style={{ position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)", background: COLORS.text, color: COLORS.bg, padding: "4px 8px", borderRadius: 4, fontSize: 12, whiteSpace: "nowrap" }}>
          {propValues.content || "Tooltip content"}
        </div>
      </div>
    );
  }

  // --- Popover ---
  if (name === "Popover") {
    return (
      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 16, minWidth: 220, boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>Dimensions</div>
        <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 12 }}>Set the dimensions for the layer.</div>
        <div style={{ display: "grid", gridTemplateColumns: "60px 1fr", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: COLORS.textMuted }}>Width</span>
          <input value="100%" readOnly style={{ padding: "4px 8px", borderRadius: 4, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, color: COLORS.text, fontSize: 12 }} />
          <span style={{ fontSize: 12, color: COLORS.textMuted }}>Height</span>
          <input value="25px" readOnly style={{ padding: "4px 8px", borderRadius: 4, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, color: COLORS.text, fontSize: 12 }} />
        </div>
      </div>
    );
  }

  // --- DropdownMenu / ContextMenu ---
  if (name === "DropdownMenu" || name === "ContextMenu") {
    const items = ["Profile", "Settings", "Keyboard shortcuts", "—", "Log out"];
    return (
      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "4px 0", minWidth: 180, boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
        {items.map((item, i) => item === "—"
          ? <div key={i} style={{ height: 1, background: COLORS.border, margin: "4px 0" }} />
          : <div key={i} style={{ padding: "6px 12px", fontSize: 13, color: item === "Log out" ? COLORS.danger : COLORS.text, cursor: "pointer" }}>{item}</div>
        )}
      </div>
    );
  }

  // --- NavigationMenu ---
  if (name === "NavigationMenu") {
    return (
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        {["Getting Started", "Components", "Docs"].map((item, i) => (
          <div key={item} style={{ padding: "6px 12px", fontSize: 13, borderRadius: 6, color: i === 0 ? COLORS.text : COLORS.textMuted, background: i === 0 ? COLORS.surface3 : "transparent", fontWeight: i === 0 ? 500 : 400, cursor: "pointer" }}>{item}</div>
        ))}
      </div>
    );
  }

  // --- Breadcrumb ---
  if (name === "Breadcrumb") {
    const parts = ["Home", "Components", "Breadcrumb"];
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {parts.map((p, i) => (
          <span key={p}>
            <span style={{ fontSize: 13, color: i < parts.length - 1 ? COLORS.accent : COLORS.text, cursor: i < parts.length - 1 ? "pointer" : "default", fontWeight: i === parts.length - 1 ? 500 : 400 }}>{p}</span>
            {i < parts.length - 1 && <span style={{ color: COLORS.textDim, margin: "0 2px" }}>/</span>}
          </span>
        ))}
      </div>
    );
  }

  // --- Pagination ---
  if (name === "Pagination") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button style={{ padding: "4px 8px", borderRadius: 6, background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.textMuted, fontSize: 12, cursor: "pointer" }}>← Prev</button>
        {[1, 2, 3, "...", 10].map((p, i) => (
          <button key={i} style={{ padding: "4px 10px", borderRadius: 6, background: p === 2 ? COLORS.accent : "transparent", border: p === 2 ? "none" : `1px solid ${COLORS.border}`, color: p === 2 ? "#fff" : COLORS.textMuted, fontSize: 12, cursor: "pointer", minWidth: 32 }}>{p}</button>
        ))}
        <button style={{ padding: "4px 8px", borderRadius: 6, background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.textMuted, fontSize: 12, cursor: "pointer" }}>Next →</button>
      </div>
    );
  }

  // --- Avatar ---
  if (name === "Avatar") {
    const size = propValues.size === "sm" ? 24 : propValues.size === "lg" ? 48 : 36;
    return (
      <div style={{ width: size, height: size, borderRadius: "50%", background: `${COLORS.accent}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.4, fontWeight: 600, color: COLORS.accent }}>
        {propValues.fallback || "CN"}
      </div>
    );
  }

  // --- Separator ---
  if (name === "Separator") {
    return (
      <div style={{ width: 240 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>Radix Primitives</div>
        <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 12 }}>An open-source UI component library.</div>
        <div style={{ height: 1, background: COLORS.border, marginBottom: 12 }} />
        <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 12, color: COLORS.textMuted }}>
          <span>Blog</span>
          <div style={{ width: 1, height: 16, background: COLORS.border }} />
          <span>Docs</span>
          <div style={{ width: 1, height: 16, background: COLORS.border }} />
          <span>Source</span>
        </div>
      </div>
    );
  }

  // --- Skeleton ---
  if (name === "Skeleton") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: COLORS.surface3 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ width: 180, height: 14, borderRadius: 4, background: COLORS.surface3 }} />
          <div style={{ width: 120, height: 12, borderRadius: 4, background: COLORS.surface2 }} />
        </div>
      </div>
    );
  }

  // --- Alert ---
  if (name === "Alert") {
    return (
      <div style={{ padding: "12px 16px", borderRadius: 8, border: `1px solid ${propValues.variant === "destructive" ? COLORS.danger + "40" : COLORS.border}`, background: propValues.variant === "destructive" ? COLORS.danger + "10" : COLORS.surface, minWidth: 280 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: propValues.variant === "destructive" ? COLORS.danger : COLORS.text, marginBottom: 4 }}>⚠ {propValues.title || "Heads up!"}</div>
        <div style={{ fontSize: 12, color: COLORS.textMuted }}>{propValues.description || "You can add components to your app using the CLI."}</div>
      </div>
    );
  }

  // --- ScrollArea ---
  if (name === "ScrollArea") {
    return (
      <div style={{ width: 200, height: 150, border: `1px solid ${COLORS.border}`, borderRadius: 8, overflow: "hidden", position: "relative" }}>
        <div style={{ padding: 12, fontSize: 12, color: COLORS.textMuted, lineHeight: 1.6 }}>
          {Array.from({ length: 10 }, (_, i) => `Item ${i + 1}`).map((t, i) => <div key={i} style={{ padding: "4px 0", borderBottom: `1px solid ${COLORS.border}` }}>{t}</div>)}
        </div>
        <div style={{ position: "absolute", right: 2, top: 8, width: 6, height: 60, borderRadius: 3, background: COLORS.surface3 }} />
      </div>
    );
  }

  // --- Collapsible ---
  if (name === "Collapsible") {
    return (
      <div style={{ width: 260, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>@peduarte starred 3 repositories</span>
          <span style={{ color: COLORS.textMuted, cursor: "pointer" }}>▾</span>
        </div>
        {["@radix-ui/primitives", "@radix-ui/colors", "@stitches/react"].map(r => (
          <div key={r} style={{ padding: "6px 10px", background: COLORS.surface2, borderRadius: 6, marginBottom: 4, fontSize: 12, color: COLORS.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>{r}</div>
        ))}
      </div>
    );
  }

  // --- Command ---
  if (name === "Command") {
    return (
      <div style={{ width: 280, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
        <div style={{ padding: "10px 12px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: COLORS.textDim }}>🔍</span>
          <span style={{ color: COLORS.textMuted, fontSize: 13 }}>Type a command...</span>
        </div>
        <div style={{ padding: "6px 0" }}>
          <div style={{ padding: "4px 12px", fontSize: 10, color: COLORS.textDim, fontWeight: 600, textTransform: "uppercase" }}>Suggestions</div>
          {["Calendar", "Search Emoji", "Calculator"].map(item => (
            <div key={item} style={{ padding: "6px 12px", fontSize: 13, color: COLORS.text, cursor: "pointer" }}>{item}</div>
          ))}
        </div>
      </div>
    );
  }

  // --- Calendar ---
  if (name === "Calendar") {
    const days = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    return (
      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 12, width: 260 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ color: COLORS.textMuted, cursor: "pointer" }}>◂</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>January 2026</span>
          <span style={{ color: COLORS.textMuted, cursor: "pointer" }}>▸</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, textAlign: "center" }}>
          {days.map(d => <div key={d} style={{ fontSize: 10, color: COLORS.textDim, padding: 4, fontWeight: 600 }}>{d}</div>)}
          {Array.from({ length: 31 }, (_, i) => (
            <div key={i} style={{ fontSize: 12, padding: 4, borderRadius: 4, color: i === 14 ? "#fff" : COLORS.text, background: i === 14 ? COLORS.accent : "transparent", cursor: "pointer" }}>{i + 1}</div>
          ))}
        </div>
      </div>
    );
  }

  // --- Table ---
  if (name === "Table") {
    return (
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 280 }}>
        <thead><tr>
          {["Invoice", "Status", "Amount"].map(h => <th key={h} style={{ textAlign: "left", padding: "8px 12px", borderBottom: `1px solid ${COLORS.border2}`, color: COLORS.textMuted, fontWeight: 600, fontSize: 11 }}>{h}</th>)}
        </tr></thead>
        <tbody>
          {[["INV001", "Paid", "$250.00"], ["INV002", "Pending", "$150.00"], ["INV003", "Unpaid", "$350.00"]].map(([inv, st, amt], i) => (
            <tr key={i}><td style={{ padding: "8px 12px", borderBottom: `1px solid ${COLORS.border}`, color: COLORS.text, fontFamily: "'JetBrains Mono', monospace" }}>{inv}</td>
            <td style={{ padding: "8px 12px", borderBottom: `1px solid ${COLORS.border}` }}><span style={{ padding: "2px 6px", borderRadius: 10, fontSize: 10, background: st === "Paid" ? `${COLORS.success}20` : st === "Pending" ? `${COLORS.warning}20` : `${COLORS.danger}20`, color: st === "Paid" ? COLORS.success : st === "Pending" ? COLORS.warning : COLORS.danger }}>{st}</span></td>
            <td style={{ padding: "8px 12px", borderBottom: `1px solid ${COLORS.border}`, color: COLORS.text, textAlign: "right" }}>{amt}</td></tr>
          ))}
        </tbody>
      </table>
    );
  }

  // --- HoverCard ---
  if (name === "HoverCard") {
    return (
      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 16, minWidth: 240, boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${COLORS.accent}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600, color: COLORS.accent, flexShrink: 0 }}>@</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>@nextjs</div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 4 }}>The React Framework — created and maintained by @vercel.</div>
            <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 6 }}>Joined December 2021</div>
          </div>
        </div>
      </div>
    );
  }

  // --- Fallback for all other components ---
  const styles = styleFn ? styleFn(propValues) : { base: { padding: "6px 14px", borderRadius: 6, background: COLORS.surface3, color: COLORS.text, fontSize: 13, fontFamily: "'Inter', sans-serif", display: "inline-flex" } };
  const content = slotContent?.children || comp.name;
  return (
    <div style={styles.base}>
      {propValues.loading && <span style={{ marginRight: 4 }}>⏳</span>}
      {content}
    </div>
  );
}


export const SUPPORTED_PREVIEW_COMPONENTS = new Set([
  "Accordion", "Alert", "AlertDialog", "Avatar", "Badge", "Breadcrumb", "Button",
  "Calendar", "Card", "Checkbox", "Collapsible", "Command", "ContextMenu", "DataTable",
  "Dialog", "DropdownMenu", "HoverCard", "Input", "NavigationMenu", "Pagination",
  "Popover", "Progress", "RadioGroup", "ScrollArea", "Select", "Separator", "Sheet",
  "Skeleton", "Slider", "Sonner", "Switch", "Table", "Tabs", "Textarea", "Toast", "Tooltip",
]);

// ============================================================================
// Component Preview
// ============================================================================
export function ComponentPreview({ registry }) {
  const [selectedComp, setSelectedComp] = useState(null);
  const [activeVariant, setActiveVariant] = useState(null);
  const [customProps, setCustomProps] = useState({});

  const componentNames = Object.keys(registry.components || {});

  useEffect(() => {
    if (!selectedComp && componentNames.length > 0) {
      const first = componentNames.find(n => SUPPORTED_PREVIEW_COMPONENTS.has(n)) || componentNames[0];
      setSelectedComp(first);
    }
  }, [componentNames]);

  useEffect(() => {
    setActiveVariant(null);
    setCustomProps({});
  }, [selectedComp]);

  const comp = selectedComp ? registry.components[selectedComp] : null;
  const isSupported = selectedComp ? SUPPORTED_PREVIEW_COMPONENTS.has(selectedComp) : false;

  const resolvedProps = useMemo(() => {
    if (!comp) return {};
    const base = {};
    Object.entries(comp.props || {}).forEach(([key, def]) => {
      if (def.default !== undefined) base[key] = def.default;
    });
    if (activeVariant !== null && comp.variants?.[activeVariant]) {
      Object.assign(base, comp.variants[activeVariant].props);
    }
    Object.assign(base, customProps);
    return base;
  }, [comp, activeVariant, customProps]);

  const resolvedSlots = useMemo(() => {
    if (!comp) return {};
    const ex = comp.examples?.[0];
    return ex?.slots || {};
  }, [comp]);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, margin: 0, marginBottom: 4 }}>Component Preview</h3>
        <p style={{ fontSize: 12, color: COLORS.textDim, margin: 0 }}>Renderização dos componentes do UI Registry</p>
      </div>

      {componentNames.length === 0 ? (
        <EmptyState message="Nenhum componente no registry" />
      ) : (
        <div style={{ display: "flex", gap: 16 }}>
          {/* Component list */}
          <div style={{ width: 160, flexShrink: 0 }}>
            {componentNames.map(name => {
              const supported = SUPPORTED_PREVIEW_COMPONENTS.has(name);
              return (
                <div key={name}
                  onClick={supported ? () => setSelectedComp(name) : undefined}
                  style={{
                    padding: "8px 10px", marginBottom: 2, borderRadius: 6,
                    cursor: supported ? "pointer" : "not-allowed",
                    opacity: supported ? 1 : 0.4,
                    background: selectedComp === name ? COLORS.surface3 : "transparent",
                    border: selectedComp === name ? `1px solid ${COLORS.border2}` : "1px solid transparent",
                  }}
                >
                  <span style={{ fontSize: 13, color: selectedComp === name ? COLORS.text : supported ? COLORS.textMuted : COLORS.textDim, fontWeight: selectedComp === name ? 600 : 400 }}>{name}</span>
                  <div style={{ fontSize: 10, color: COLORS.textDim }}>{registry.components[name].category}{!supported ? " · sem preview" : ""}</div>
                </div>
              );
            })}
          </div>

          {/* Preview area */}
          {comp && isSupported && (
            <div style={{ flex: 1 }}>
              {/* Render preview */}
              <div style={{
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 8,
                padding: 32,
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 100,
              }}>
                <MockComponent comp={comp} compName={selectedComp} propValues={resolvedProps} slotContent={resolvedSlots} />
              </div>

              {/* Variants */}
              {comp.variants && comp.variants.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Variants</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    <button onClick={() => setActiveVariant(null)} style={{ ...s.btnSmall, background: activeVariant === null ? COLORS.accent : COLORS.surface3, color: activeVariant === null ? "#fff" : COLORS.textMuted }}>default</button>
                    {comp.variants.map((v, i) => (
                      <button key={i} onClick={() => setActiveVariant(i)} style={{ ...s.btnSmall, background: activeVariant === i ? COLORS.accent : COLORS.surface3, color: activeVariant === i ? "#fff" : COLORS.textMuted }}>
                        {v.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* All variants grid */}
              {comp.variants && comp.variants.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Todas as variantes</div>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(150, 1fr))",
                    gap: 8,
                  }}>
                    {comp.variants.map((v, i) => {
                      const vProps = { ...Object.fromEntries(Object.entries(comp.props || {}).filter(([, d]) => d.default !== undefined).map(([k, d]) => [k, d.default])), ...v.props };
                      return (
                        <div key={i} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: 12, textAlign: "center" }}>
                          <div style={{ marginBottom: 8 }}>
                            <MockComponent comp={comp} compName={selectedComp} propValues={vProps} slotContent={resolvedSlots} />
                          </div>
                          <div style={{ fontSize: 10, color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace" }}>{v.name}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Prop playground */}
              <div>
                <div style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Playground</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {Object.entries(comp.props || {}).map(([key, def]) => {
                    if (def.type === "function" || def.type === "ReactNode") return null;
                    const val = customProps[key] ?? resolvedProps[key] ?? "";
                    return (
                      <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <label style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: "'JetBrains Mono', monospace", minWidth: 80 }}>{key}</label>
                        {def.type === "boolean" ? (
                          <input type="checkbox" checked={!!val} onChange={(e) => setCustomProps(p => ({ ...p, [key]: e.target.checked }))} />
                        ) : def.type === "enum" ? (
                          <select value={val} onChange={(e) => setCustomProps(p => ({ ...p, [key]: e.target.value }))} style={{ ...s.select, fontSize: 11, padding: "3px 6px" }}>
                            {(def.enumValues || []).map(v => <option key={v} value={v}>{v}</option>)}
                          </select>
                        ) : (
                          <input value={val} onChange={(e) => setCustomProps(p => ({ ...p, [key]: def.type === "number" ? Number(e.target.value) : e.target.value }))} style={{ ...s.input, fontSize: 11, padding: "3px 6px" }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Examples */}
              {comp.examples && comp.examples.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Examples</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {comp.examples.map((ex, i) => {
                      const exProps = { ...Object.fromEntries(Object.entries(comp.props || {}).filter(([, d]) => d.default !== undefined).map(([k, d]) => [k, d.default])), ...ex.props };
                      return (
                        <div key={i} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: 12, textAlign: "center" }}>
                          <div style={{ marginBottom: 6 }}>
                            <MockComponent comp={comp} compName={selectedComp} propValues={exProps} slotContent={ex.slots || {}} />
                          </div>
                          <div style={{ fontSize: 10, color: COLORS.textDim }}>{ex.name}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

