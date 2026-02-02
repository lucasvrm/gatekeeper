import React, { useState } from "react";
import { COLORS, s } from "../lib/constants";
import { usePersistentState } from "../hooks/usePersistentState";

export function Field({ label, children, style: st }) {
  return (
    <div style={{ marginBottom: 12, ...st }}>
      <label style={s.label}>{label}</label>
      {children}
    </div>
  );
}

export function Row({ children, gap = 8 }) {
  return <div style={{ display: "flex", gap, alignItems: "flex-end" }}>{children}</div>;
}

export function Section({ title, children, actions, defaultOpen = false, id }: { title: any; children: any; actions?: any; defaultOpen?: boolean; id?: string }) {
  const storageKey = id || (typeof title === "string" ? title : "section");
  const [open, setOpen] = usePersistentState(storageKey, defaultOpen);
  return (
    <div style={{ ...s.card, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: open ? 12 : 0, cursor: "pointer" }} onClick={() => setOpen(!open)}>
        <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{open ? "▾" : "▸"} {title}</span>
        <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>{actions}</div>
      </div>
      {open && children}
    </div>
  );
}

// ============================================================================
// Section Group — visual grouping header for related WBSections
// ============================================================================
export function SectionGroup({ icon, label, color, children }: { icon: string; label: string; color: string; children: any }) {
  return (
    <div style={{ marginBottom: 0 }}>
      <div style={{
        padding: "14px 24px 10px",
        display: "flex", alignItems: "center", gap: 10,
        borderBottom: `1px solid ${COLORS.border}`,
        background: color + "08",
      }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{
          fontSize: 11, fontWeight: 700, color: color,
          textTransform: "uppercase" as const, letterSpacing: "0.08em",
        }}>{label}</span>
        <div style={{ flex: 1, height: 1, background: color + "25", marginLeft: 4 }} />
      </div>
      {children}
    </div>
  );
}

// ============================================================================
// Wireframe B — Collapsible outer sections with colored dot and tag
// ============================================================================
export function WBSection({ title, dotColor, tag, children, defaultOpen = false, id }: { title: string; dotColor: string; tag?: string; children: any; defaultOpen?: boolean; id?: string }) {
  const [open, setOpen] = usePersistentState(`wb-${id || title}`, defaultOpen);
  return (
    <div id={id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          padding: "16px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer", userSelect: "none" as const,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{title}</span>
          {tag && (
            <span style={{
              padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600,
              fontFamily: "'JetBrains Mono', monospace",
              background: dotColor + "15", color: dotColor,
            }}>{tag}</span>
          )}
        </div>
        <span style={{
          fontSize: 16, color: COLORS.textDim, lineHeight: "1",
          transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none",
        }}>⌄</span>
      </div>
      {open && <div style={{ padding: "0 24px 20px" }}>{children}</div>}
    </div>
  );
}

// Wireframe B subsection divider
export function WBSub({ title, children }: { title: string; children: any }) {
  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${COLORS.border}` }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: COLORS.textMuted, marginBottom: 10,
        textTransform: "uppercase" as const, letterSpacing: "0.04em",
      }}>{title}</div>
      {children}
    </div>
  );
}

export function EmptyState({ message, action }) {
  return (
    <div style={{ padding: 24, textAlign: "center", color: COLORS.textDim, fontSize: 13 }}>
      <div style={{ marginBottom: 8 }}>{message}</div>
      {action}
    </div>
  );
}

/** Color input with swatch picker + text field. Supports hex, rgba, CSS vars, token refs. */
export function ColorInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  // Convert value to a valid hex for the color picker (best-effort)
  const toHex = (v: string): string => {
    if (!v) return "#888888";
    const s = v.trim();
    if (s.startsWith("#") && (s.length === 4 || s.length === 7)) return s;
    // Try to parse rgba
    const rgbaMatch = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgbaMatch) {
      const [, r, g, b] = rgbaMatch;
      return `#${[r, g, b].map(c => parseInt(c).toString(16).padStart(2, "0")).join("")}`;
    }
    if (s === "transparent") return "#000000";
    return "#888888";
  };
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", width: "100%" }}>
      <input
        type="color"
        value={toHex(value)}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: 32, height: 28, border: "none", borderRadius: 4, cursor: "pointer", background: "transparent", padding: 0, flexShrink: 0 }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ flex: 1, background: COLORS.surface2, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}
      />
    </div>
  );
}

export function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 2, background: COLORS.surface, borderRadius: 8, padding: 3, marginBottom: 16 }}>
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "none", background: active === t.id ? COLORS.surface3 : "transparent", color: active === t.id ? COLORS.text : COLORS.textMuted, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif", transition: "all 0.15s" }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
