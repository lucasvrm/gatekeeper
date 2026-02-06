// ============================================================================
// Grid Converter — bidirectional tree ↔ grid conversion
// ============================================================================

import type { NodeDef } from "./nodeDefaults";
import type { GridLayoutConfig, GridItem } from "../../runtime/types";
import { flattenTree } from "./treeUtils";

/**
 * Converts a tree structure to a grid layout.
 * Flattens the tree and assigns grid positions based on column count.
 */
export function treeToGrid(node: NodeDef, columns: number): GridLayoutConfig {
  // Flatten tree (skip root, take only children)
  const flat = flattenTree(node);
  const items: GridItem[] = [];

  // Skip the root node (index 0), start from children
  for (let i = 1; i < flat.length; i++) {
    const { node: child } = flat[i];
    const idx = i - 1; // 0-based index for grid positioning

    const colStart = (idx % columns) + 1;
    const rowStart = Math.floor(idx / columns) + 1;

    items.push({
      component: child.id,
      colStart,
      rowStart,
      colSpan: 1,
      rowSpan: 1,
      props: child.props,
    });
  }

  return {
    columns,
    rowHeight: "80px",
    gap: node.props?.gap || "16px",
    items,
  };
}

/**
 * Converts a grid layout back to a tree structure.
 * Orders items by position (top-left → bottom-right) and rebuilds as a flat stack.
 */
export function gridToTree(
  grid: GridLayoutConfig,
  nodeMap: Map<string, NodeDef>
): NodeDef {
  // Sort items by position: row first, then column
  const sortedItems = [...grid.items].sort((a, b) => {
    if (a.rowStart !== b.rowStart) return a.rowStart - b.rowStart;
    return a.colStart - b.colStart;
  });

  // Rebuild children array from sorted items
  const children: NodeDef[] = [];
  for (const item of sortedItems) {
    const node = nodeMap.get(item.component);
    if (node) {
      // Update props if grid item has overrides
      const updatedNode = item.props
        ? { ...node, props: { ...node.props, ...item.props } }
        : node;
      children.push(updatedNode);
    }
  }

  // Return a stack root with children in order
  return {
    id: "root",
    type: "stack",
    props: { gap: grid.gap },
    children,
  };
}
