// ============================================================================
// StructureTree — hierarchical tree view of the current page's node tree
// ============================================================================

import React, { useState, useCallback, type CSSProperties } from "react";
import { usePageEditor } from "./PageEditorProvider";
import type { NodeDef } from "./nodeDefaults";
import { getNodeMeta, isContainerType } from "./nodeDefaults";
import { C, MONO } from "./styles";

export function StructureTree() {
  const { currentContent, currentPage, state } = usePageEditor();

  if (!currentPage || !currentContent) {
    return (
      <div style={emptyStyle}>
        <span style={{ fontSize: 16, opacity: 0.2 }}>🌲</span>
        <span style={{ fontSize: 12 }}>Nenhuma página</span>
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <span style={{ fontWeight: 600, fontSize: 13, color: C.text }}>Estrutura</span>
        <span style={{ fontSize: 11, color: C.textDim }}>{currentPage.label}</span>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "4px 0" }}>
        <TreeNode node={currentContent} depth={0} />
      </div>
    </div>
  );
}

// ============================================================================
// TreeNode — recursive node in the tree
// ============================================================================

function TreeNode({ node, depth }: { node: NodeDef; depth: number }) {
  const {
    state, selectNode, startDragFromCanvas, endDrag,
    setDropTarget, drop, removeNode,
  } = usePageEditor();

  const [collapsed, setCollapsed] = useState(false);
  const isSelected = state.selectedNodeId === node.id;
  const hasChildren = node.children && node.children.length > 0;
  const isContainer = isContainerType(node.type);
  const meta = getNodeMeta(node.type);
  const isDragging = state.drag.active;
  const isRoot = depth === 0;

  // Drop target state for this specific tree row
  const isDropTarget =
    state.drag.dropTarget?.parentId === node.id &&
    state.drag.dropTarget?.index === (node.children?.length || 0);

  // Summary text for the node
  const summary = getSummary(node);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    selectNode(node.id);
  }, [node.id]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsed(prev => !prev);
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (isRoot) { e.preventDefault(); return; }
    e.stopPropagation();
    e.dataTransfer.setData("application/orqui-node-id", node.id);
    e.dataTransfer.effectAllowed = "move";
    startDragFromCanvas(node.id);
  }, [node.id, isRoot]);

  // Drop: accept into this container at the end
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!isContainer) return;
    e.preventDefault();
    e.stopPropagation();
    setDropTarget({ parentId: node.id, index: node.children?.length || 0 });
  }, [node.id, isContainer, node.children?.length]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    if (!isContainer) return;
    e.preventDefault();
    e.stopPropagation();
    setDropTarget({ parentId: node.id, index: node.children?.length || 0 });
    drop();
  }, [node.id, isContainer, node.children?.length]);

  return (
    <div>
      {/* Row */}
      <div
        onClick={handleClick}
        draggable={!isRoot}
        onDragStart={handleDragStart}
        onDragEnd={endDrag}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "3px 8px 3px",
          paddingLeft: 8 + depth * 16,
          cursor: "pointer",
          background: isSelected
            ? C.accent + "18"
            : isDropTarget
              ? C.accent + "0c"
              : "transparent",
          borderLeft: isSelected ? `2px solid ${C.accent}` : "2px solid transparent",
          transition: "background 0.1s",
          minHeight: 26,
        }}
        onMouseEnter={e => {
          if (!isSelected) (e.currentTarget as HTMLElement).style.background = C.surface2;
        }}
        onMouseLeave={e => {
          if (!isSelected && !isDropTarget) (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      >
        {/* Expand/collapse toggle */}
        {isContainer ? (
          <button onClick={handleToggle} style={toggleBtnStyle}>
            <span style={{
              fontSize: 8, display: "inline-block",
              transform: collapsed ? "rotate(-90deg)" : "rotate(0)",
              transition: "transform 0.12s",
              opacity: hasChildren ? 0.6 : 0.2,
            }}>▼</span>
          </button>
        ) : (
          <span style={{ width: 16, flexShrink: 0 }} />
        )}

        {/* Icon */}
        <span style={{ fontSize: 12, width: 16, textAlign: "center", flexShrink: 0 }}>
          {meta?.icon || "?"}
        </span>

        {/* Type */}
        <span style={{
          fontSize: 11,
          fontFamily: MONO,
          fontWeight: isSelected ? 600 : 400,
          color: isSelected ? C.accent : C.text,
          flexShrink: 0,
        }}>
          {node.type}
        </span>

        {/* Summary */}
        {summary && (
          <span style={{
            fontSize: 10,
            color: C.textDim,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            minWidth: 0,
          }}>
            {summary}
          </span>
        )}

        {/* Child count for containers */}
        {isContainer && hasChildren && (
          <span style={{
            fontSize: 9,
            color: C.textDim,
            background: C.surface2,
            padding: "0 4px",
            borderRadius: 3,
            flexShrink: 0,
          }}>
            {node.children!.length}
          </span>
        )}
      </div>

      {/* Children */}
      {isContainer && hasChildren && !collapsed && (
        <div>
          {node.children!.map(child => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getSummary(node: NodeDef): string {
  const p = node.props || {};
  switch (node.type) {
    case "heading": return p.content ? `"${truncate(p.content, 20)}"` : "";
    case "text": return p.content ? `"${truncate(p.content, 20)}"` : "";
    case "button": return p.label || "";
    case "badge": return p.content || "";
    case "stat-card": return p.label || "";
    case "table": return `${(p.columns || []).length} cols`;
    case "card": return p.title || "";
    case "grid": return `${p.columns || 2} cols`;
    case "stack": return p.gap || "";
    case "row": return p.gap || "";
    case "tabs": return `${(p.items || []).length} tabs`;
    case "slot": return p.name || "";
    case "key-value": return `${(p.items || []).length} items`;
    case "list": return p.dataSource || "";
    case "search": return p.placeholder || "";
    case "select": return `${(p.options || []).length} opts`;
    case "spacer": return p.size || "";
    case "icon": return p.name || "";
    case "image": return p.alt || "";
    default: return "";
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

// ============================================================================
// Styles
// ============================================================================

const panelStyle: CSSProperties = {
  width: "100%", height: "100%",
  display: "flex", flexDirection: "column",
  background: C.surface,
  fontFamily: "'Inter', -apple-system, sans-serif",
};

const headerStyle: CSSProperties = {
  padding: "12px 12px 8px",
  display: "flex", alignItems: "center", justifyContent: "space-between",
};

const emptyStyle: CSSProperties = {
  flex: 1, display: "flex", flexDirection: "column",
  alignItems: "center", justifyContent: "center", gap: 6,
  color: C.textDim,
};

const toggleBtnStyle: CSSProperties = {
  width: 16, height: 16, flexShrink: 0,
  display: "flex", alignItems: "center", justifyContent: "center",
  background: "none", border: "none", cursor: "pointer",
  padding: 0,
  color: C.textMuted,
};
