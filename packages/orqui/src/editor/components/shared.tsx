import React, { useState } from "react";
import { COLORS, s } from "../lib/constants";
import { usePersistentState } from "../hooks/usePersistentState";

export function Field({ label, children, style: st, inline, compact }: {
  label: string; children: any; style?: any; inline?: boolean; compact?: boolean;
}) {
  if (inline) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: compact ? 4 : 8, ...st }}>
        <label style={{ ...s.label, marginBottom: 0, minWidth: 70, flexShrink: 0 }}>{label}</label>
        <div style={{ flex: 1 }}>{children}</div>
      </div>
    );
  }
  return (
    <div style={{ marginBottom: compact ? 4 : 8, ...st }}>
      <label style={s.label}>{label}</label>
      {children}
    </div>
  );
}

export function Row({ children, gap = 8 }) {
  return <div style={{ display: "flex", gap, alignItems: "flex-end" }}>{children}</div>;
}

/** CSS Grid row — 2, 3, or 4 equal columns */
export function Grid({ children, cols = 2, gap = 8 }: { children: any; cols?: 2 | 3 | 4; gap?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap }}>
      {children}
    </div>
  );
}

export function Section({ title, children, actions, defaultOpen = false, id, accent }: {
  title: any; children: any; actions?: any; defaultOpen?: boolean; id?: string; accent?: string;
}) {
  const storageKey = id || (typeof title === "string" ? title : "section");
  const [open, setOpen] = usePersistentState(storageKey, defaultOpen);
  const accentColor = accent || COLORS.accent;
  return (
    <div style={{
      ...s.card,
      marginBottom: 10,
      borderLeft: `2px solid ${open ? accentColor + "50" : "transparent"}`,
      transition: "border-color 0.2s",
    }}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: open ? 10 : 0, cursor: "pointer", userSelect: "none" as const,
        }}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(!open); } }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            fontSize: 9, color: COLORS.textDim, transition: "transform 0.2s",
            transform: open ? "rotate(90deg)" : "none", display: "inline-block",
          }}>&#9654;</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.text }}>{title}</span>
        </div>
        <div style={{ display: "flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>{actions}</div>
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
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(!open); } }}
        style={{
          padding: "12px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer", userSelect: "none" as const,
          transition: "background 0.1s",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 7, height: 7, borderRadius: "50%", background: dotColor, flexShrink: 0,
            boxShadow: open ? `0 0 6px ${dotColor}40` : "none", transition: "box-shadow 0.2s",
          }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.text }}>{title}</span>
          {tag && (
            <span style={{
              padding: "1px 6px", borderRadius: 3, fontSize: 9, fontWeight: 600,
              fontFamily: "'JetBrains Mono', monospace",
              background: dotColor + "12", color: dotColor,
            }}>{tag}</span>
          )}
        </div>
        <span style={{
          fontSize: 9, color: COLORS.textDim,
          transition: "transform 0.2s", transform: open ? "rotate(90deg)" : "none",
          display: "inline-block",
        }}>&#9654;</span>
      </div>
      {open && <div style={{ padding: "0 20px 16px" }}>{children}</div>}
    </div>
  );
}

// Wireframe B subsection divider
export function WBSub({ title, children }: { title: string; children: any }) {
  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${COLORS.border}` }}>
      <div style={{
        fontSize: 10, fontWeight: 600, color: COLORS.textDim, marginBottom: 8,
        textTransform: "uppercase" as const, letterSpacing: "0.05em",
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
    const rgbaMatch = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgbaMatch) {
      const [, r, g, b] = rgbaMatch;
      return `#${[r, g, b].map(c => parseInt(c).toString(16).padStart(2, "0")).join("")}`;
    }
    if (s === "transparent") return "#000000";
    return "#888888";
  };
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", width: "100%" }}>
      <input
        type="color"
        value={toHex(value)}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Color picker"
        style={{ width: 26, height: 24, border: "none", borderRadius: 4, cursor: "pointer", background: "transparent", padding: 0, flexShrink: 0 }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ flex: 1, background: COLORS.surface2, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 5, padding: "4px 7px", fontSize: 11, fontFamily: "'JetBrains Mono', monospace", transition: "border-color 0.15s", outline: "none" }}
      />
    </div>
  );
}

export function TabBar({ tabs, active, onChange }: { tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div role="tablist" style={{
      display: "flex", gap: 1, background: COLORS.surface, borderRadius: 7, padding: 2, marginBottom: 12,
      border: `1px solid ${COLORS.border}`,
    }}>
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            style={{
              flex: 1, padding: "5px 10px", borderRadius: 5, border: "none",
              background: isActive ? COLORS.surface3 : "transparent",
              color: isActive ? COLORS.text : COLORS.textDim,
              fontSize: 11, fontWeight: isActive ? 600 : 400,
              cursor: "pointer", fontFamily: "'Inter', sans-serif",
              transition: "all 0.15s",
              outline: "none",
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
