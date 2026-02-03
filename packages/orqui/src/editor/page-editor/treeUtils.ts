// ============================================================================
// Tree utilities — immutable operations on node trees
// ============================================================================

import type { NodeDef } from "./nodeDefaults";
import { generateId } from "./nodeDefaults";

/** Find a node by ID in a tree (DFS) */
export function findNode(root: NodeDef, id: string): NodeDef | null {
  if (root.id === id) return root;
  if (root.children) {
    for (const child of root.children) {
      const found = findNode(child, id);
      if (found) return found;
    }
  }
  return null;
}

/** Find the parent of a node and its index within parent.children */
export function findParent(root: NodeDef, id: string): { parent: NodeDef; index: number } | null {
  if (root.children) {
    for (let i = 0; i < root.children.length; i++) {
      if (root.children[i].id === id) {
        return { parent: root, index: i };
      }
      const found = findParent(root.children[i], id);
      if (found) return found;
    }
  }
  return null;
}

/** Insert a child into a parent's children at a given index (immutable) */
export function insertChild(root: NodeDef, parentId: string, index: number, child: NodeDef): NodeDef {
  if (root.id === parentId) {
    const children = [...(root.children || [])];
    children.splice(index, 0, child);
    return { ...root, children };
  }
  if (root.children) {
    return {
      ...root,
      children: root.children.map(c => insertChild(c, parentId, index, child)),
    };
  }
  return root;
}

/** Remove a node from the tree by ID (immutable) */
export function removeChild(root: NodeDef, nodeId: string): NodeDef {
  if (root.children) {
    const filtered = root.children.filter(c => c.id !== nodeId);
    if (filtered.length !== root.children.length) {
      return { ...root, children: filtered };
    }
    return {
      ...root,
      children: root.children.map(c => removeChild(c, nodeId)),
    };
  }
  return root;
}

/** Move a node to a new parent at a given index (immutable) */
export function moveNode(root: NodeDef, nodeId: string, newParentId: string, newIndex: number): NodeDef {
  const node = findNode(root, nodeId);
  if (!node) return root;

  // Remove from old position
  let tree = removeChild(root, nodeId);

  // Adjust index if moving within the same parent (the removal shifted indices)
  const parentInfo = findParent(root, nodeId);
  let adjustedIndex = newIndex;
  if (parentInfo && parentInfo.parent.id === newParentId && parentInfo.index < newIndex) {
    adjustedIndex = newIndex - 1;
  }

  // Insert at new position
  tree = insertChild(tree, newParentId, adjustedIndex, node);
  return tree;
}

/** Update a node's properties (immutable) */
export function updateNode(root: NodeDef, nodeId: string, updater: (node: NodeDef) => NodeDef): NodeDef {
  if (root.id === nodeId) {
    return updater(root);
  }
  if (root.children) {
    return {
      ...root,
      children: root.children.map(c => updateNode(c, nodeId, updater)),
    };
  }
  return root;
}

/** Deep clone a subtree, generating new IDs for all nodes */
export function cloneSubtree(node: NodeDef): NodeDef {
  const clone: NodeDef = {
    ...node,
    id: generateId(node.type),
    props: node.props ? { ...node.props } : undefined,
    style: node.style ? { ...node.style } : undefined,
  };
  if (node.children) {
    clone.children = node.children.map(c => cloneSubtree(c));
  }
  return clone;
}

/** Collect all node IDs in a subtree */
export function collectIds(node: NodeDef): string[] {
  const ids = [node.id];
  if (node.children) {
    for (const child of node.children) {
      ids.push(...collectIds(child));
    }
  }
  return ids;
}

/** Check if nodeId is a descendant of ancestorId */
export function isDescendant(root: NodeDef, nodeId: string, ancestorId: string): boolean {
  const ancestor = findNode(root, ancestorId);
  if (!ancestor) return false;
  if (ancestor.id === nodeId) return false; // not a descendant of itself
  return findNode(ancestor, nodeId) !== null;
}

/** Flatten a tree into a list of { node, depth, parentId } */
export function flattenTree(
  node: NodeDef,
  depth: number = 0,
  parentId: string | null = null
): Array<{ node: NodeDef; depth: number; parentId: string | null }> {
  const result: Array<{ node: NodeDef; depth: number; parentId: string | null }> = [];
  result.push({ node, depth, parentId });
  if (node.children) {
    for (const child of node.children) {
      result.push(...flattenTree(child, depth + 1, node.id));
    }
  }
  return result;
}
