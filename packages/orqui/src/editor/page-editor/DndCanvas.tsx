// ============================================================================
// DndCanvas — visual canvas for page content editing
// ============================================================================

import React, { useCallback, useRef, useMemo, type CSSProperties } from "react";
import { usePageEditor, type DropTarget } from "./PageEditorProvider";
import type { NodeDef } from "./nodeDefaults";
import { isContainerType, getNodeMeta } from "./nodeDefaults";
import { C, MONO } from "./styles";
import { hasTemplateExpr, resolveTemplate } from "./templateEngine";
import { useVariables } from "./VariablesContext";

/** Hook that provides template resolution against current variable mock data */
function useTemplateResolver() {
  const { mockData } = useVariables();
  return {
    /** Resolve a prop value: if it contains {{}} templates, show the resolved mock value */
    r(value: string | undefined, fallback: string = ""): string {
      if (!value) return fallback;
      if (hasTemplateExpr(value)) return resolveTemplate(value, mockData);
      return value;
    },
    /** Check if a value is a template and return a style hint */
    templateHint(value: string | undefined): CSSProperties | undefined {
      if (value && hasTemplateExpr(value)) {
        return { fontStyle: "italic" as const };
      }
      return undefined;
    },
  };
}

// ============================================================================
// Canvas (root)
// ============================================================================

export function DndCanvas() {
  const { currentContent, currentPage, selectNode, state } = usePageEditor();
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).dataset?.canvasBg) {
      selectNode(null);
    }
  };

  if (!currentPage) {
    return (
      <div style={emptyStyle}>
        <span style={{ fontSize: 40, opacity: 0.2 }}>📄</span>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Nenhuma página selecionada</span>
        <span style={{ fontSize: 12, color: "#5b5b66" }}>
          Crie uma nova página ou selecione uma existente
        </span>
      </div>
    );
  }

  if (!currentContent) {
    return (
      <div style={emptyStyle}>
        <span style={{ fontSize: 40, opacity: 0.2 }}>📦</span>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Página vazia</span>
        <span style={{ fontSize: 12, color: "#5b5b66" }}>
          Arraste elementos da paleta para começar
        </span>
      </div>
    );
  }

  return (
    <div ref={canvasRef} style={canvasStyle} onClick={handleCanvasClick}>
      {/* Grid background */}
      <div data-canvas-bg style={gridBg} onClick={handleCanvasClick} />

      {/* Page label */}
      <div style={pageLabelStyle}>
        <span style={{ color: C.accent, fontFamily: MONO, fontWeight: 700, fontSize: 11 }}>
          {currentPage.label}
        </span>
        <span style={{ color: C.textDim, fontSize: 11 }}>{currentPage.route}</span>
      </div>

      {/* Content tree */}
      <div style={{ position: "relative", zIndex: 1, padding: "8px 0" }}>
        <CanvasNode node={currentContent} depth={0} isRoot />
      </div>
    </div>
  );
}

// ============================================================================
// CanvasNode — recursive node renderer with DnD overlays
// ============================================================================

function CanvasNode({ node, depth, isRoot }: { node: NodeDef; depth: number; isRoot?: boolean }) {
  const {
    state, selectNode, startDragFromCanvas, endDrag,
    setDropTarget, drop, removeNode,
  } = usePageEditor();

  const isSelected = state.selectedNodeId === node.id;
  const isDragging = state.drag.active;
  const isDragSource = state.drag.source?.type === "canvas" && state.drag.source?.nodeId === node.id;
  const isContainer = isContainerType(node.type);
  const meta = getNodeMeta(node.type);

  // ---- Handlers ----

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    selectNode(node.id);
  }, [node.id]);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (isRoot) { e.preventDefault(); return; }
    e.stopPropagation();
    e.dataTransfer.setData("application/orqui-node-id", node.id);
    e.dataTransfer.effectAllowed = "move";
    startDragFromCanvas(node.id);
  }, [node.id, isRoot]);

  // ---- Visual ----

  const borderColor = isSelected ? C.accent
    : isDragSource ? C.warning + "60"
    : "transparent";

  return (
    <div
      data-node-id={node.id}
      tabIndex={0}
      onClick={handleClick}
      draggable={!isRoot}
      onDragStart={handleDragStart}
      onDragEnd={endDrag}
      style={{
        position: "relative",
        outline: `2px solid ${borderColor}`,
        outlineOffset: -1,
        borderRadius: 4,
        opacity: isDragSource ? 0.4 : 1,
        transition: "outline-color 0.1s",
        cursor: isRoot ? "default" : "pointer",
      }}
    >
      {/* Type label */}
      {(isSelected || depth === 0) && (
        <div style={typeLabelStyle(isSelected, depth === 0)}>
          <span>{meta?.icon || "?"}</span>
          <span>{node.type}</span>
          {node.props?.title && <span style={{ opacity: 0.6 }}>: {node.props.title}</span>}
          {node.props?.content && typeof node.props.content === "string" && node.type !== "heading" && (
            <span style={{ opacity: 0.5, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              — {node.props.content}
            </span>
          )}
        </div>
      )}

      {/* Node visual content */}
      {isContainer ? (
        <ContainerContent node={node} depth={depth} />
      ) : (
        <LeafContent node={node} />
      )}
    </div>
  );
}

// ============================================================================
// Container content — renders children with drop zones between them
// ============================================================================

function ContainerContent({ node, depth }: { node: NodeDef; depth: number }) {
  const children = node.children || [];
  const { state } = usePageEditor();
  const isDragging = state.drag.active;

  const isGrid = node.type === "grid";
  const cols = node.props?.columns || 2;

  const containerStyle: CSSProperties = isGrid
    ? { display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 4, padding: 6, minHeight: 40 }
    : node.type === "row"
      ? { display: "flex", flexDirection: "row", gap: 4, padding: 6, minHeight: 36, alignItems: node.props?.align || "stretch", flexWrap: "wrap" as const }
      : { display: "flex", flexDirection: "column", gap: 0, padding: 6, minHeight: 40 };

  if (children.length === 0) {
    return (
      <div style={containerStyle}>
        <EmptyDropZone parentId={node.id} index={0} isActive={isDragging} />
      </div>
    );
  }

  // For grid and row: children side by side, drop zones at the end
  if (isGrid || node.type === "row") {
    return (
      <div style={containerStyle}>
        {children.map((child, i) => (
          <div key={child.id} style={isGrid && child.props?.span ? { gridColumn: `span ${child.props.span}` } : { flex: node.type === "row" ? "1 1 0" : undefined }}>
            <CanvasNode node={child} depth={depth + 1} />
          </div>
        ))}
        {isDragging && <SmallDropZone parentId={node.id} index={children.length} />}
      </div>
    );
  }

  // For stack/container/card: vertical with drop zones between
  return (
    <div style={containerStyle}>
      {isDragging && <DropZoneLine parentId={node.id} index={0} />}
      {children.map((child, i) => (
        <React.Fragment key={child.id}>
          <CanvasNode node={child} depth={depth + 1} />
          {isDragging && <DropZoneLine parentId={node.id} index={i + 1} />}
        </React.Fragment>
      ))}
    </div>
  );
}

// ============================================================================
// Leaf node content — simplified visual for each node type
// ============================================================================

function LeafContent({ node }: { node: NodeDef }) {
  const { r, templateHint } = useTemplateResolver();
  const p = node.props || {};

  switch (node.type) {
    case "heading":
      return (
        <div style={{ padding: "6px 10px", fontSize: levelSize(p.level || 2), fontWeight: 700, color: C.text, ...templateHint(p.content) }}>
          {r(p.content, "Título")}
        </div>
      );

    case "text":
      return (
        <div style={{ padding: "4px 10px", fontSize: 13, color: C.textMuted, lineHeight: 1.5, ...templateHint(p.content) }}>
          {r(p.content, "Texto")}
        </div>
      );

    case "button":
      return (
        <div style={{ padding: "6px 10px" }}>
          <span style={{
            display: "inline-flex", padding: "5px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
            background: p.variant === "outline" || p.variant === "ghost" ? "transparent" : C.accent,
            color: p.variant === "outline" || p.variant === "ghost" ? C.accent : "#fff",
            border: p.variant === "outline" ? `1px solid ${C.accent}` : "1px solid transparent",
            ...templateHint(p.label),
          }}>
            {r(p.label, "Botão")}
          </span>
        </div>
      );

    case "badge":
      return (
        <div style={{ padding: "6px 10px" }}>
          <span style={{
            display: "inline-flex", padding: "2px 10px", borderRadius: 999,
            fontSize: 11, fontWeight: 600,
            background: C.accent + "20", color: C.accent,
            ...templateHint(p.content),
          }}>
            {r(p.content, "Badge")}
          </span>
        </div>
      );

    case "icon":
      return (
        <div style={{ padding: "6px 10px", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 16 }}>★</span>
          <span style={{ fontSize: 11, color: C.textDim, fontFamily: MONO, ...templateHint(p.name) }}>{r(p.name, "Star")}</span>
        </div>
      );

    case "image":
      return (
        <div style={{ padding: "6px 10px", display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{
            width: Math.min(p.size || 48, 48), height: Math.min(p.size || 48, 48),
            borderRadius: p.rounded ? "50%" : 4,
            background: C.surface3, border: `1px dashed ${C.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, color: C.textDim,
          }}>◻</div>
          <span style={{ fontSize: 11, color: C.textDim, ...templateHint(p.alt) }}>{r(p.alt, "imagem")}</span>
        </div>
      );

    case "divider":
      return (
        <div style={{ padding: "8px 10px" }}>
          <div style={{ height: 1, background: p.color || C.border }} />
        </div>
      );

    case "spacer":
      return (
        <div style={{
          height: parseInt(p.size) || 24, margin: "2px 10px",
          border: `1px dashed ${C.border}30`, borderRadius: 3,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 9, color: C.textDim }}>↕ {p.size || "24px"}</span>
        </div>
      );

    case "stat-card":
      return (
        <div style={{
          margin: "4px 6px", padding: "10px 14px",
          background: C.surface2, borderRadius: 8, border: `1px solid ${C.border}`,
        }}>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4, ...templateHint(p.label) }}>{r(p.label, "Métrica")}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text, ...templateHint(p.value) }}>{r(p.value, "0")}</div>
        </div>
      );

    case "table": {
      const cols = p.columns || [];
      return (
        <div style={{ margin: "4px 6px", border: `1px solid ${C.border}`, borderRadius: 6, overflow: "hidden" }}>
          <div style={{ display: "flex", background: C.surface2, borderBottom: `1px solid ${C.border}` }}>
            {cols.length > 0 ? cols.map((col: any, i: number) => (
              <div key={i} style={{ flex: 1, padding: "6px 10px", fontSize: 11, fontWeight: 600, color: C.textMuted, ...templateHint(col.label) }}>
                {r(col.label)}
              </div>
            )) : (
              <div style={{ padding: "6px 10px", fontSize: 11, color: C.textDim }}>Tabela vazia</div>
            )}
          </div>
          {[0, 1, 2].map(row => (
            <div key={row} style={{ display: "flex", borderBottom: row < 2 ? `1px solid ${C.border}30` : "none" }}>
              {(cols.length > 0 ? cols : [{ label: "" }]).map((_: any, i: number) => (
                <div key={i} style={{ flex: 1, padding: "5px 10px" }}>
                  <div style={{ height: 8, width: `${50 + ((row * 7 + i * 13) % 40)}%`, background: C.surface3, borderRadius: 3 }} />
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    }

    case "card":
      return (
        <div style={{
          margin: "4px 6px", padding: 12,
          background: C.surface2, borderRadius: 8, border: `1px solid ${C.border}`,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4, ...templateHint(p.title) }}>{r(p.title, "Card")}</div>
          <div style={{ height: 6, width: "60%", background: C.surface3, borderRadius: 3 }} />
        </div>
      );

    case "list":
      return (
        <div style={{ margin: "4px 6px", borderRadius: 6, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 12px",
              borderBottom: i < 2 ? `1px solid ${C.border}30` : "none",
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent + "40" }} />
              <div style={{ height: 8, flex: 1, background: C.surface3, borderRadius: 3 }} />
            </div>
          ))}
        </div>
      );

    case "key-value": {
      const items = p.items || [{ label: "Chave", value: "Valor" }];
      return (
        <div style={{ margin: "4px 6px", padding: 10 }}>
          {items.map((item: any, i: number) => (
            <div key={i} style={{
              display: "flex", gap: 12, padding: "3px 0", fontSize: 12,
              flexDirection: p.layout === "vertical" ? "column" : "row",
            }}>
              <span style={{ color: C.textMuted, fontWeight: 600, minWidth: 80, ...templateHint(item.label) }}>{r(item.label)}</span>
              <span style={{ color: C.text, ...templateHint(item.value) }}>{r(item.value)}</span>
            </div>
          ))}
        </div>
      );
    }

    case "tabs": {
      const items = p.items || [];
      return (
        <div style={{ margin: "4px 6px" }}>
          <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.border}` }}>
            {items.map((tab: any, i: number) => (
              <div key={i} style={{
                padding: "6px 14px", fontSize: 12, fontWeight: i === 0 ? 600 : 400,
                color: i === 0 ? C.accent : C.textDim,
                borderBottom: i === 0 ? `2px solid ${C.accent}` : "2px solid transparent",
                ...templateHint(tab.label),
              }}>
                {r(tab.label)}
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "search":
      return (
        <div style={{ padding: "6px 10px" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 10px", borderRadius: 6,
            background: C.surface2, border: `1px solid ${C.border}`,
            fontSize: 12, color: C.textDim,
          }}>
            🔍 {r(p.placeholder, "Buscar...")}
          </div>
        </div>
      );

    case "select":
      return (
        <div style={{ padding: "6px 10px" }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "6px 10px", borderRadius: 6,
            background: C.surface2, border: `1px solid ${C.border}`,
            fontSize: 12, color: C.textDim,
          }}>
            <span>{r(p.placeholder, "Selecionar...")}</span>
            <span>▾</span>
          </div>
        </div>
      );

    case "slot":
      return (
        <div style={{
          margin: "4px 6px", padding: "12px 14px",
          border: `2px dashed ${C.accent}30`, borderRadius: 6,
          display: "flex", alignItems: "center", gap: 8,
          background: C.accent + "05",
        }}>
          <span style={{ fontSize: 14 }}>⧉</span>
          <span style={{ fontSize: 12, color: C.accent, fontFamily: MONO, ...templateHint(p.name) }}>{r(p.name, "slot")}</span>
        </div>
      );

    default:
      return (
        <div style={{ padding: "6px 10px", fontSize: 12, color: C.textDim }}>
          [{node.type}]
        </div>
      );
  }
}

// ============================================================================
// Drop zones
// ============================================================================

/** Horizontal line drop zone between vertical siblings */
function DropZoneLine({ parentId, index }: { parentId: string; index: number }) {
  const { state, setDropTarget, drop } = usePageEditor();
  const isActive = state.drag.dropTarget?.parentId === parentId && state.drag.dropTarget?.index === index;

  return (
    <div
      onDragOver={e => {
        e.preventDefault();
        e.stopPropagation();
        setDropTarget({ parentId, index });
      }}
      onDragLeave={e => {
        e.stopPropagation();
        if (isActive) setDropTarget(null);
      }}
      onDrop={e => {
        e.preventDefault();
        e.stopPropagation();
        setDropTarget({ parentId, index });
        drop();
      }}
      style={{
        height: isActive ? 28 : 6,
        margin: isActive ? "2px 0" : "0",
        borderRadius: 4,
        background: isActive ? C.accent + "15" : "transparent",
        border: isActive ? `2px dashed ${C.accent}` : "2px dashed transparent",
        transition: "all 0.12s ease",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {isActive && (
        <span style={{ fontSize: 10, color: C.accent, fontWeight: 600 }}>Soltar aqui</span>
      )}
    </div>
  );
}

/** Bigger drop zone for empty containers */
function EmptyDropZone({ parentId, index, isActive: isDragging }: { parentId: string; index: number; isActive: boolean }) {
  const { state, setDropTarget, drop } = usePageEditor();
  const isHovered = state.drag.dropTarget?.parentId === parentId && state.drag.dropTarget?.index === index;

  return (
    <div
      onDragOver={e => {
        e.preventDefault();
        e.stopPropagation();
        setDropTarget({ parentId, index });
      }}
      onDragLeave={() => setDropTarget(null)}
      onDrop={e => {
        e.preventDefault();
        e.stopPropagation();
        setDropTarget({ parentId, index });
        drop();
      }}
      style={{
        minHeight: isDragging ? 56 : 36,
        borderRadius: 6,
        border: `2px dashed ${isHovered ? C.accent : C.border}40`,
        background: isHovered ? C.accent + "10" : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.15s",
        color: isHovered ? C.accent : C.textDim,
        fontSize: 12,
      }}
    >
      {isDragging
        ? (isHovered ? "Soltar aqui" : "Arraste um elemento")
        : <span style={{ opacity: 0.4 }}>Vazio — arraste elementos da paleta</span>
      }
    </div>
  );
}

/** Small inline drop zone for grid/row (end slot) */
function SmallDropZone({ parentId, index }: { parentId: string; index: number }) {
  const { state, setDropTarget, drop } = usePageEditor();
  const isHovered = state.drag.dropTarget?.parentId === parentId && state.drag.dropTarget?.index === index;

  return (
    <div
      onDragOver={e => {
        e.preventDefault();
        e.stopPropagation();
        setDropTarget({ parentId, index });
      }}
      onDragLeave={() => setDropTarget(null)}
      onDrop={e => {
        e.preventDefault();
        e.stopPropagation();
        setDropTarget({ parentId, index });
        drop();
      }}
      style={{
        flex: "1 1 0", minWidth: 48, minHeight: 36,
        borderRadius: 6,
        border: `2px dashed ${isHovered ? C.accent : C.border}40`,
        background: isHovered ? C.accent + "10" : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.15s",
        fontSize: 16, color: isHovered ? C.accent : C.textDim + "60",
      }}
    >
      +
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function levelSize(level: number): number {
  return { 1: 26, 2: 22, 3: 18, 4: 16, 5: 14, 6: 13 }[level] || 18;
}

function typeLabelStyle(selected: boolean, isRoot: boolean): CSSProperties {
  return {
    position: "absolute" as const,
    top: -1, left: 8,
    transform: "translateY(-100%)",
    padding: "1px 6px",
    borderRadius: "3px 3px 0 0",
    fontSize: 10,
    fontWeight: 600,
    fontFamily: MONO,
    background: selected ? C.accent : C.surface3,
    color: selected ? "#fff" : C.textMuted,
    display: "flex", gap: 4, alignItems: "center",
    whiteSpace: "nowrap" as const,
    zIndex: 5,
    lineHeight: "16px",
  };
}

// ============================================================================
// Canvas styles
// ============================================================================

const canvasStyle: CSSProperties = {
  flex: 1, overflow: "auto",
  position: "relative",
  padding: "40px 32px 32px",
};

const gridBg: CSSProperties = {
  position: "absolute" as const, inset: 0,
  backgroundImage: `radial-gradient(${C.border}40 1px, transparent 1px)`,
  backgroundSize: "20px 20px",
  pointerEvents: "none" as const,
};

const pageLabelStyle: CSSProperties = {
  position: "relative" as const, zIndex: 1,
  display: "flex", alignItems: "center", gap: 8,
  marginBottom: 16,
};

const emptyStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  gap: 12,
  color: "#8b8b96",
  padding: 40,
  fontFamily: "'Inter', sans-serif",
};
