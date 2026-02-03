// ============================================================================
// Orqui EditorCanvas
// Visual canvas that renders the contract node tree with interactive overlays
// for selection, hover, drag-and-drop, and inline editing
// ============================================================================

import React, { useRef, useCallback, type CSSProperties, type ReactNode } from "react";
import { useEditor, findNodeById } from "../EditorProvider.js";
import type { NodeDef } from "../../runtime/context/ContractProvider.js";
import type { DragItem, DropTarget } from "../EditorProvider.js";
import { resolveTokenToCSS } from "../../runtime/hooks/useTokens.js";

// ============================================================================
// Canvas Container
// ============================================================================

export function EditorCanvas() {
  const { state, dispatch, select } = useEditor();
  const canvasRef = useRef<HTMLDivElement>(null);
  const page = state.contract.pages[state.currentPage];

  if (!page) {
    return (
      <div style={emptyCanvasStyle}>
        <span style={{ fontSize: "16px", opacity: 0.3 }}>📄</span>
        <span>Selecione uma página para editar</span>
      </div>
    );
  }

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      select(null);
    }
  };

  return (
    <div ref={canvasRef} style={canvasStyle} onClick={handleCanvasClick}>
      {/* Grid background */}
      <div style={gridBgStyle} />

      {/* Page content */}
      <div style={pageWrapperStyle}>
        <CanvasNode
          node={page.content}
          depth={0}
        />
      </div>
    </div>
  );
}

// ============================================================================
// CanvasNode — Recursive node renderer with editor overlays
// ============================================================================

function CanvasNode({ node, depth }: { node: NodeDef; depth: number }) {
  const { state, dispatch, select } = useEditor();
  const nodeRef = useRef<HTMLDivElement>(null);

  const isSelected = state.selection?.type === "node" && state.selection.id === node.id;
  const isHovered = state.hoveredNodeId === node.id;
  const isDragOver = state.dropTarget?.parentId === node.id;
  const isContainer = hasChildren(node.type);

  // ---- Event handlers ----

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    select({ type: "node", id: node.id });
  }, [node.id]);

  const handleMouseEnter = useCallback(() => {
    dispatch({ type: "HOVER", nodeId: node.id });
  }, [node.id]);

  const handleMouseLeave = useCallback(() => {
    dispatch({ type: "HOVER", nodeId: null });
  }, []);

  // ---- Drag: this node can be dragged to reorder ----
  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.stopPropagation();
    const item: DragItem = { type: "reorder-node", nodeId: node.id };
    e.dataTransfer.setData("application/orqui-drag", JSON.stringify(item));
    e.dataTransfer.effectAllowed = "move";
    dispatch({ type: "DRAG_START", item });
  }, [node.id]);

  // ---- Drop: this node can accept drops (if it's a container) ----
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!isContainer) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = state.dragItem?.type === "new-node" ? "copy" : "move";

    const childCount = node.children?.length || 0;
    const target: DropTarget = { parentId: node.id, index: childCount };
    dispatch({ type: "DRAG_OVER", target });
  }, [isContainer, node.id, node.children?.length, state.dragItem]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dispatch({ type: "DROP" });
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.stopPropagation();
    if (state.dropTarget?.parentId === node.id) {
      dispatch({ type: "DRAG_OVER", target: null });
    }
  }, [node.id, state.dropTarget]);

  // ---- Render node content ----
  const nodeContent = renderNodeContent(node, depth);

  // ---- Overlay styles ----
  const overlayBorder = isSelected
    ? "2px solid var(--orqui-colors-accent, #6d9cff)"
    : isHovered
      ? "1px solid rgba(109, 156, 255, 0.4)"
      : isDragOver
        ? "2px dashed var(--orqui-colors-accent, #6d9cff)"
        : "1px solid transparent";

  return (
    <div
      ref={nodeRef}
      data-orqui-editor-node={node.id}
      data-orqui-type={node.type}
      data-selected={isSelected || undefined}
      data-hovered={isHovered || undefined}
      draggable
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onDragStart={handleDragStart}
      onDragEnd={() => dispatch({ type: "DRAG_END" })}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragLeave={handleDragLeave}
      style={{
        position: "relative",
        outline: overlayBorder,
        outlineOffset: "-1px",
        borderRadius: "4px",
        transition: "outline 0.1s",
        cursor: "pointer",
        minHeight: isContainer && (!node.children || node.children.length === 0) ? "48px" : undefined,
      }}
    >
      {/* Node type label */}
      {(isSelected || isHovered) && (
        <div style={nodeLabelStyle(isSelected)}>
          {node.type}
          {node.props?.title ? `: ${node.props.title}` : ""}
        </div>
      )}

      {/* Drop indicator for containers */}
      {isDragOver && isContainer && (
        <div style={dropIndicatorStyle}>
          Soltar aqui
        </div>
      )}

      {/* Actual content */}
      {nodeContent}
    </div>
  );
}

// ============================================================================
// Node content renderers (simplified visual representations)
// ============================================================================

function renderNodeContent(node: NodeDef, depth: number): ReactNode {
  const p = node.props || {};

  switch (node.type) {
    case "grid":
      return (
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${p.columns || 2}, 1fr)`,
          gap: "8px",
          padding: "8px",
          minHeight: "48px",
        }}>
          {(node.children || []).map((child) => {
            const span = child.props?.span;
            return (
              <div key={child.id} style={span ? { gridColumn: `span ${span}` } : undefined}>
                <CanvasNode node={child} depth={depth + 1} />
              </div>
            );
          })}
          {(!node.children || node.children.length === 0) && <EmptySlot type="grid" />}
        </div>
      );

    case "stack":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "6px", minHeight: "40px" }}>
          {(node.children || []).map((child) => (
            <CanvasNode key={child.id} node={child} depth={depth + 1} />
          ))}
          {(!node.children || node.children.length === 0) && <EmptySlot type="stack" />}
        </div>
      );

    case "row":
      return (
        <div style={{ display: "flex", gap: "6px", alignItems: p.align || "center", padding: "6px", minHeight: "36px" }}>
          {(node.children || []).map((child) => (
            <CanvasNode key={child.id} node={child} depth={depth + 1} />
          ))}
          {(!node.children || node.children.length === 0) && <EmptySlot type="row" />}
        </div>
      );

    case "container":
      return (
        <div style={{ padding: "8px", minHeight: "40px" }}>
          {(node.children || []).map((child) => (
            <CanvasNode key={child.id} node={child} depth={depth + 1} />
          ))}
          {(!node.children || node.children.length === 0) && <EmptySlot type="container" />}
        </div>
      );

    case "heading":
      return (
        <div style={{ padding: "4px 8px", fontSize: levelToSize(p.level || 1), fontWeight: 700 }}>
          {p.content || "Título"}
        </div>
      );

    case "text":
      return (
        <div style={{ padding: "4px 8px", fontSize: "14px", color: "var(--orqui-colors-text-muted, #8b8b96)" }}>
          {p.content || "Texto"}
        </div>
      );

    case "badge":
      return (
        <span style={{
          display: "inline-flex", padding: "2px 10px", borderRadius: "9999px",
          fontSize: "12px", fontWeight: 500,
          background: "rgba(109, 156, 255, 0.15)", color: "var(--orqui-colors-accent, #6d9cff)",
          margin: "4px 8px",
        }}>
          {p.content || "badge"}
        </span>
      );

    case "button":
      return (
        <div style={{ padding: "4px 8px" }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: "4px",
            padding: "6px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: 500,
            background: p.variant === "primary" ? "var(--orqui-colors-accent, #6d9cff)" : "var(--orqui-colors-surface-2, #1c1c21)",
            color: p.variant === "primary" ? "#fff" : "var(--orqui-colors-text, #e4e4e7)",
          }}>
            {p.label || "Botão"}
          </span>
        </div>
      );

    case "stat-card":
      return (
        <div style={{
          padding: "16px",
          background: "var(--orqui-colors-surface, #141417)",
          border: "1px solid var(--orqui-colors-border, #2a2a33)",
          borderRadius: "8px",
        }}>
          <div style={{ fontSize: "12px", color: "var(--orqui-colors-text-muted, #8b8b96)", marginBottom: "4px" }}>{p.label || "Métrica"}</div>
          <div style={{ fontSize: "24px", fontWeight: 700 }}>{p.value || "0"}</div>
        </div>
      );

    case "card":
      return (
        <div style={{
          background: "var(--orqui-colors-surface, #141417)",
          border: "1px solid var(--orqui-colors-border, #2a2a33)",
          borderRadius: "8px", overflow: "hidden",
        }}>
          {p.title && (
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--orqui-colors-border, #2a2a33)", fontWeight: 600, fontSize: "14px" }}>
              {p.title}
            </div>
          )}
          <div style={{ padding: "12px 16px", minHeight: "40px" }}>
            {(node.children || []).map((child) => (
              <CanvasNode key={child.id} node={child} depth={depth + 1} />
            ))}
            {(!node.children || node.children.length === 0) && <EmptySlot type="card" />}
          </div>
        </div>
      );

    case "table":
      return <TablePreview node={node} />;

    case "key-value":
      return <KVPreview node={node} />;

    case "tabs":
      return <TabsPreview node={node} depth={depth} />;

    case "divider":
      return <hr style={{ border: "none", borderTop: "1px solid var(--orqui-colors-border, #2a2a33)", margin: "8px" }} />;

    case "spacer":
      return <div style={{ height: "24px", background: "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(109,156,255,0.05) 4px, rgba(109,156,255,0.05) 8px)", borderRadius: "4px", margin: "4px 8px" }} />;

    case "slot":
      return (
        <div style={{
          padding: "16px", border: "2px dashed var(--orqui-colors-border, #2a2a33)", borderRadius: "6px",
          textAlign: "center", fontSize: "12px", color: "var(--orqui-colors-text-dim, #5b5b66)",
          margin: "4px 8px",
        }}>
          ⧉ Slot: {p.name || node.id}
        </div>
      );

    case "search":
      return (
        <div style={{ padding: "4px 8px" }}>
          <input disabled placeholder={p.placeholder || "Buscar..."} style={{
            background: "var(--orqui-colors-surface-2, #1c1c21)", border: "1px solid var(--orqui-colors-border, #2a2a33)",
            borderRadius: "4px", padding: "5px 8px", fontSize: "12px", color: "var(--orqui-colors-text-muted, #8b8b96)", width: "100%",
          }} />
        </div>
      );

    case "select":
      return (
        <div style={{ padding: "4px 8px" }}>
          <select disabled style={{
            background: "var(--orqui-colors-surface-2, #1c1c21)", border: "1px solid var(--orqui-colors-border, #2a2a33)",
            borderRadius: "4px", padding: "5px 8px", fontSize: "12px", color: "var(--orqui-colors-text-muted, #8b8b96)",
          }}>
            <option>{p.placeholder || "Selecionar..."}</option>
          </select>
        </div>
      );

    default:
      return (
        <div style={{ padding: "8px", fontSize: "12px", color: "var(--orqui-colors-text-dim, #5b5b66)" }}>
          [{node.type}] {node.id}
        </div>
      );
  }
}

// ============================================================================
// Sub-components
// ============================================================================

function EmptySlot({ type }: { type: string }) {
  return (
    <div style={{
      padding: "12px", border: "1px dashed var(--orqui-colors-border, #2a2a33)", borderRadius: "4px",
      textAlign: "center", fontSize: "11px", color: "var(--orqui-colors-text-dim, #5b5b66)",
      minWidth: "80px",
    }}>
      Arraste um elemento aqui
    </div>
  );
}

function TablePreview({ node }: { node: NodeDef }) {
  const p = node.props || {};
  const columns = p.columns || [];

  return (
    <div style={{ overflow: "auto", margin: "4px 8px" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
        <thead>
          <tr>
            {columns.map((col: any) => (
              <th key={col.key} style={{
                padding: "6px 10px", textAlign: "left",
                borderBottom: "1px solid var(--orqui-colors-border, #2a2a33)",
                color: "var(--orqui-colors-text-muted, #8b8b96)", fontWeight: 500, fontSize: "11px",
              }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3].map((row) => (
            <tr key={row}>
              {columns.map((col: any) => (
                <td key={col.key} style={{
                  padding: "6px 10px",
                  borderBottom: "1px solid var(--orqui-colors-border, #2a2a33)",
                  color: "var(--orqui-colors-text-dim, #5b5b66)",
                }}>
                  {col.content || "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ padding: "4px 0", fontSize: "11px", color: "var(--orqui-colors-text-dim, #5b5b66)" }}>
        dataSource: {p.dataSource || "?"}
      </div>
    </div>
  );
}

function KVPreview({ node }: { node: NodeDef }) {
  const p = node.props || {};
  const items = p.items || [];
  return (
    <div style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
      {items.map((item: any, i: number) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
          <span style={{ color: "var(--orqui-colors-text-muted, #8b8b96)" }}>{item.label}</span>
          <span>{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function TabsPreview({ node, depth }: { node: NodeDef; depth: number }) {
  const p = node.props || {};
  const tabs = p.items || [];
  return (
    <div>
      <div style={{ display: "flex", gap: "0", borderBottom: "1px solid var(--orqui-colors-border, #2a2a33)", padding: "0 8px" }}>
        {tabs.map((tab: any, i: number) => (
          <div key={tab.id} style={{
            padding: "6px 12px", fontSize: "12px", fontWeight: i === 0 ? 600 : 400,
            color: i === 0 ? "var(--orqui-colors-accent, #6d9cff)" : "var(--orqui-colors-text-dim, #5b5b66)",
            borderBottom: i === 0 ? "2px solid var(--orqui-colors-accent, #6d9cff)" : "none",
          }}>
            {tab.label}
          </div>
        ))}
      </div>
      <div style={{ padding: "8px", minHeight: "40px" }}>
        {(node.children || []).map((child) => (
          <CanvasNode key={child.id} node={child} depth={depth + 1} />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function hasChildren(type: string): boolean {
  return ["grid", "stack", "row", "container", "card", "tabs", "list"].includes(type);
}

function levelToSize(level: number): string {
  const sizes: Record<number, string> = { 1: "28px", 2: "22px", 3: "18px", 4: "16px", 5: "14px", 6: "12px" };
  return sizes[level] || "18px";
}

// ============================================================================
// Styles
// ============================================================================

const canvasStyle: CSSProperties = {
  flex: 1,
  overflow: "auto",
  position: "relative",
  background: "var(--orqui-colors-bg, #0a0a0b)",
};

const gridBgStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  backgroundImage: "radial-gradient(circle, rgba(109,156,255,0.04) 1px, transparent 1px)",
  backgroundSize: "24px 24px",
  pointerEvents: "none",
};

const pageWrapperStyle: CSSProperties = {
  position: "relative",
  maxWidth: "1200px",
  margin: "24px auto",
  padding: "24px",
  minHeight: "calc(100vh - 120px)",
};

const emptyCanvasStyle: CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  color: "var(--orqui-colors-text-dim, #5b5b66)",
  fontSize: "14px",
};

function nodeLabelStyle(isSelected: boolean): CSSProperties {
  return {
    position: "absolute",
    top: -18,
    left: 0,
    fontSize: "10px",
    fontWeight: 500,
    padding: "1px 6px",
    borderRadius: "3px 3px 0 0",
    background: isSelected ? "var(--orqui-colors-accent, #6d9cff)" : "rgba(109,156,255,0.3)",
    color: isSelected ? "#fff" : "var(--orqui-colors-accent, #6d9cff)",
    zIndex: 10,
    whiteSpace: "nowrap",
    pointerEvents: "none",
  };
}

const dropIndicatorStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(109,156,255,0.08)",
  borderRadius: "4px",
  fontSize: "12px",
  color: "var(--orqui-colors-accent, #6d9cff)",
  fontWeight: 500,
  zIndex: 5,
  pointerEvents: "none",
};
