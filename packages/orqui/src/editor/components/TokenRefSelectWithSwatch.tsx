import React, { useState, useRef, useEffect, useMemo } from "react";
import type { Tokens } from "../../runtime/types.js";
import { COLORS } from "../lib/constants.js";

export interface TokenRefSelectWithSwatchProps {
  value?: string; // "$tokens.colors.accent"
  tokens: Tokens;
  category: string; // "colors" (suporta outras categorias depois)
  onChange: (value: string | undefined) => void;
  placeholder?: string; // Opcional, default: "— nenhum —"
  disabled?: boolean;
  showSearch?: boolean; // Auto-habilitado se 10+ opções
}

interface Option {
  value: string;
  label: string;
  color: string | null;
}

/**
 * Componente de seleção de token ref com thumbnails visuais de cor.
 * Substitui o TokenRefSelect nativo com melhor UX para seleção de cores.
 */
export function TokenRefSelectWithSwatch({
  value,
  tokens,
  category,
  onChange,
  placeholder = "— nenhum —",
  disabled = false,
  showSearch: showSearchProp,
}: TokenRefSelectWithSwatchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Build options from tokens[category]
  const allOptions = useMemo(() => {
    const refs: Option[] = [];
    const categoryData = (tokens as Record<string, any>)[category];

    if (categoryData && typeof categoryData === "object") {
      Object.keys(categoryData).forEach((key) => {
        refs.push({
          value: `$tokens.${category}.${key}`,
          label: key,
          color: category === "colors" ? categoryData[key]?.value : null,
        });
      });
    }

    return [{ value: "", label: placeholder, color: null }, ...refs];
  }, [tokens, category, placeholder]);

  // Auto-enable search for long lists
  const showSearch = showSearchProp ?? allOptions.length > 10;

  // Filter options by search query
  const options = useMemo(() => {
    if (!searchQuery.trim()) return allOptions;
    const query = searchQuery.toLowerCase();
    return allOptions.filter((opt) => opt.label.toLowerCase().includes(query));
  }, [allOptions, searchQuery]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, showSearch]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          setSearchQuery("");
          break;

        case "ArrowDown":
          e.preventDefault();
          setHoveredIndex((prev) => Math.min(prev + 1, options.length - 1));
          break;

        case "ArrowUp":
          e.preventDefault();
          setHoveredIndex((prev) => Math.max(prev - 1, 0));
          break;

        case "Enter":
          e.preventDefault();
          if (hoveredIndex >= 0 && hoveredIndex < options.length) {
            const selected = options[hoveredIndex];
            onChange(selected.value || undefined);
            setIsOpen(false);
            setSearchQuery("");
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, hoveredIndex, options, onChange]);

  const selectedOption = allOptions.find((o) => o.value === value) || allOptions[0];
  const isColorCategory = category === "colors";

  return (
    <div ref={dropdownRef} style={{ position: "relative", width: "100%" }}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        aria-label="Select color token"
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "4px 7px",
          background: disabled ? COLORS.surface1 : COLORS.surface2,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 5,
          fontSize: 11,
          color: disabled ? COLORS.textMuted : COLORS.text,
          cursor: disabled ? "not-allowed" : "pointer",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
          {isColorCategory && selectedOption.color && (
            <ColorSwatch color={selectedOption.color} />
          )}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {selectedOption.label}
          </span>
        </div>
        <span style={{ fontSize: 8, flexShrink: 0 }}>{isOpen ? "▲" : "▼"}</span>
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            maxHeight: 300,
            overflowY: "auto",
            background: COLORS.surface2,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 6,
            zIndex: 1000,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          {/* Search Input */}
          {showSearch && (
            <div style={{ padding: 8, borderBottom: `1px solid ${COLORS.border}` }}>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "4px 8px",
                  background: COLORS.surface1,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 4,
                  fontSize: 11,
                  color: COLORS.text,
                  outline: "none",
                }}
              />
            </div>
          )}

          {/* Options List */}
          {options.length === 0 ? (
            <div
              style={{
                padding: "12px 10px",
                fontSize: 11,
                color: COLORS.textMuted,
                textAlign: "center",
              }}
            >
              Nenhum resultado encontrado
            </div>
          ) : (
            options.map((opt, idx) => (
              <button
                key={opt.value || "empty"}
                type="button"
                onClick={() => {
                  onChange(opt.value || undefined);
                  setIsOpen(false);
                  setSearchQuery("");
                  setHoveredIndex(-1);
                }}
                onMouseEnter={() => setHoveredIndex(idx)}
                aria-label={
                  opt.color ? `${opt.label} (${opt.color})` : opt.label
                }
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  background: hoveredIndex === idx ? COLORS.surface3 : "transparent",
                  border: "none",
                  color: COLORS.text,
                  fontSize: 11,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {isColorCategory && opt.color && <ColorSwatch color={opt.color} />}
                {isColorCategory && !opt.color && opt.value && (
                  <span style={{ fontSize: 12, color: "#fbbf24", flexShrink: 0 }}>⚠️</span>
                )}
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {opt.label}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Componente de thumbnail de cor 16×16px
 */
function ColorSwatch({ color }: { color: string }) {
  const isUndefined = !color || color === "transparent";

  return (
    <div
      style={{
        width: 16,
        height: 16,
        borderRadius: 3,
        background: isUndefined ? "#888888" : color,
        border: isUndefined ? "1px dashed #666" : `1px solid ${COLORS.border}`,
        flexShrink: 0,
      }}
      aria-hidden="true"
    />
  );
}
