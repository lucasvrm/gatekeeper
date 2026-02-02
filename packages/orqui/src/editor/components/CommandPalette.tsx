import React, { useState, useRef, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import { COLORS } from "../lib/constants";
import type { CmdItem } from "../types/contracts";

export type { CmdItem };

export function CommandPalette({ open, onClose, items }: { open: boolean; onClose: () => void; items: CmdItem[] }) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const scrollOnNav = useRef(false); // only scroll into view on keyboard nav

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Filter items
  const filtered = useMemo(() => {
    if (!query.trim()) return items.slice(0, 30);
    const q = query.toLowerCase().trim();
    const terms = q.split(/\s+/);
    return items
      .map((item) => {
        const keywordsStr = item.keywords ? item.keywords.join(" ") : "";
        const haystack = `${item.label} ${item.category} ${item.hint || ""} ${keywordsStr}`.toLowerCase();
        let score = 0;
        for (const t of terms) {
          if (!haystack.includes(t)) return null;
          // Boost exact prefix match on label
          if (item.label.toLowerCase().startsWith(t)) score += 10;
          else if (item.label.toLowerCase().includes(t)) score += 5;
          // Boost keyword matches (user is searching for the property name)
          else if (keywordsStr.toLowerCase().includes(t)) score += 7;
          else score += 1;
        }
        return { item, score };
      })
      .filter(Boolean)
      .sort((a, b) => b!.score - a!.score)
      .slice(0, 20)
      .map((r) => r!.item);
  }, [items, query]);

  // Clamp active index
  useEffect(() => {
    if (activeIdx >= filtered.length) setActiveIdx(Math.max(0, filtered.length - 1));
  }, [filtered.length]);

  // Scroll active into view — only on keyboard nav
  useEffect(() => {
    if (!scrollOnNav.current) return;
    scrollOnNav.current = false;
    const items = listRef.current?.querySelectorAll("[data-cmd-item]");
    const el = items?.[activeIdx] as HTMLElement;
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const execute = (item: CmdItem) => {
    onClose();
    // Small delay so the palette closes before action (e.g. scroll)
    setTimeout(() => item.action(), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      scrollOnNav.current = true;
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      scrollOnNav.current = true;
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[activeIdx]) {
      e.preventDefault();
      execute(filtered[activeIdx]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!open) return null;

  // Group by category
  const groups: { cat: string; items: CmdItem[] }[] = [];
  const seen = new Set<string>();
  for (const item of filtered) {
    if (!seen.has(item.category)) {
      seen.add(item.category);
      groups.push({ cat: item.category, items: [] });
    }
    groups.find((g) => g.cat === item.category)!.items.push(item);
  }

  const CAT_COLORS: Record<string, string> = {
    "Seção": "#6d9cff",
    "Token": "#f0a040",
    "Cor": "#e06090",
    "Componente": "#50d080",
    "Ação": "#c080ff",
    "Tipografia": "#60c0e0",
    "Página": "#e0c040",
  };

  let globalIdx = 0;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
        display: "flex", justifyContent: "center", paddingTop: "12vh",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 560, maxHeight: "60vh",
          background: COLORS.surface, border: `1px solid ${COLORS.border}`,
          borderRadius: 14, boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        {/* Input */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "14px 18px", borderBottom: `1px solid ${COLORS.border}`,
        }}>
          <span style={{ fontSize: 16, color: COLORS.textDim, flexShrink: 0 }}>⌘</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Buscar seções, tokens, cores, componentes, ações…"
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              color: COLORS.text, fontSize: 15, fontFamily: "'Inter', sans-serif",
            }}
          />
          <kbd style={{
            fontSize: 10, color: COLORS.textDim, background: COLORS.surface2,
            padding: "2px 6px", borderRadius: 4, border: `1px solid ${COLORS.border}`,
          }}>ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ flex: 1, overflow: "auto", padding: "6px 0" }}>
          {filtered.length === 0 && (
            <div style={{ padding: "24px 18px", textAlign: "center", color: COLORS.textDim, fontSize: 13 }}>
              Nenhum resultado para "{query}"
            </div>
          )}
          {groups.map((group) => (
            <div key={group.cat}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: COLORS.textDim,
                textTransform: "uppercase", letterSpacing: "0.8px",
                padding: "8px 18px 4px",
              }}>{group.cat}</div>
              {group.items.map((item) => {
                const idx = globalIdx++;
                const isActive = idx === activeIdx;
                return (
                  <div
                    key={item.id}
                    data-cmd-item=""
                    onClick={() => execute(item)}
                    onMouseEnter={() => setActiveIdx(idx)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 18px", cursor: "pointer",
                      background: isActive ? COLORS.surface3 : "transparent",
                      transition: "background 0.08s",
                    }}
                  >
                    {/* Color swatch for color tokens */}
                    {item.icon === "swatch" && item.hint ? (
                      <div style={{
                        width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                        background: item.hint, border: `1px solid ${COLORS.border}`,
                      }} />
                    ) : (
                      <span style={{ fontSize: 13, width: 18, textAlign: "center", flexShrink: 0, color: COLORS.textDim }}>
                        {item.icon || "→"}
                      </span>
                    )}
                    <span style={{ flex: 1, fontSize: 13, color: isActive ? COLORS.text : COLORS.textMuted }}>
                      {item.label}
                    </span>
                    {item.hint && item.icon !== "swatch" && (
                      <span style={{
                        fontSize: 11, color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace",
                        maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>{item.hint}</span>
                    )}
                    <span style={{
                      fontSize: 9, padding: "1px 6px", borderRadius: 3,
                      background: (CAT_COLORS[item.category] || COLORS.textDim) + "18",
                      color: CAT_COLORS[item.category] || COLORS.textDim,
                      fontWeight: 600, flexShrink: 0,
                    }}>{item.category}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div style={{
          padding: "8px 18px", borderTop: `1px solid ${COLORS.border}`,
          display: "flex", gap: 16, fontSize: 10, color: COLORS.textDim,
        }}>
          <span>↑↓ navegar</span>
          <span>↵ selecionar</span>
          <span>esc fechar</span>
        </div>
      </div>
    </div>
  );
}

