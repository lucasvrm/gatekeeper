// ============================================================================
// Orqui EditorProvider
// Central state management for the visual editor
// ============================================================================

import React, { createContext, useContext, useReducer, useCallback, useMemo, type ReactNode } from "react";
import type { LayoutContractV2, NodeDef, NavItem, HeaderElement, PageDefinition } from "../runtime/context/ContractProvider.js";
import type { VisibilityRule } from "../engine/visibility.js";

// ============================================================================
// Types
// ============================================================================

export type EditorMode = "design" | "preview" | "json";
export type DragItemType = "new-node" | "reorder-node" | "nav-item" | "header-element";

export interface DragItem {
  type: DragItemType;
  /** For new-node: the node type to create */
  nodeType?: string;
  /** For reorder: the node being moved */
  nodeId?: string;
  /** For nav-item: the nav item id */
  navItemId?: string;
  /** For header-element: the element id and source zone */
  headerElementId?: string;
  sourceZone?: "left" | "center" | "right";
}

export interface DropTarget {
  /** Parent node ID */
  parentId: string;
  /** Insert index within parent's children */
  index: number;
  /** For header zones */
  zone?: "left" | "center" | "right";
}

export interface EditorSelection {
  type: "node" | "nav-item" | "header-element" | "page" | "shell";
  id: string;
  /** For header elements, which zone */
  zone?: string;
}

interface EditorState {
  contract: LayoutContractV2;
  variables: Record<string, any>;
  mode: EditorMode;
  currentPage: string;
  selection: EditorSelection | null;
  dragItem: DragItem | null;
  dropTarget: DropTarget | null;
  hoveredNodeId: string | null;
  expandedPanels: Set<string>;
  undoStack: LayoutContractV2[];
  redoStack: LayoutContractV2[];
  isDirty: boolean;
  variablePickerOpen: boolean;
  variablePickerTarget: { nodeId: string; propKey: string } | null;
}

// ============================================================================
// Actions
// ============================================================================

type EditorAction =
  | { type: "SET_MODE"; mode: EditorMode }
  | { type: "SET_PAGE"; pageId: string }
  | { type: "SELECT"; selection: EditorSelection | null }
  | { type: "HOVER"; nodeId: string | null }
  | { type: "DRAG_START"; item: DragItem }
  | { type: "DRAG_OVER"; target: DropTarget | null }
  | { type: "DRAG_END" }
  | { type: "DROP" }
  | { type: "TOGGLE_PANEL"; panelId: string }
  // Contract mutations
  | { type: "UPDATE_CONTRACT"; contract: LayoutContractV2 }
  | { type: "UPDATE_NODE"; pageId: string; nodeId: string; updates: Partial<NodeDef> }
  | { type: "UPDATE_NODE_PROPS"; pageId: string; nodeId: string; props: Record<string, any> }
  | { type: "UPDATE_NODE_STYLE"; pageId: string; nodeId: string; style: Record<string, string> }
  | { type: "ADD_NODE"; pageId: string; parentId: string; index: number; node: NodeDef }
  | { type: "REMOVE_NODE"; pageId: string; nodeId: string }
  | { type: "MOVE_NODE"; pageId: string; nodeId: string; newParentId: string; newIndex: number }
  | { type: "UPDATE_NAV_ORDER"; navigation: NavItem[] }
  | { type: "UPDATE_NAV_ITEM"; navItemId: string; updates: Partial<NavItem> }
  | { type: "ADD_NAV_ITEM"; item: NavItem }
  | { type: "REMOVE_NAV_ITEM"; navItemId: string }
  | { type: "MOVE_HEADER_ELEMENT"; elementId: string; fromZone: string; toZone: string; index: number }
  | { type: "UPDATE_HEADER_ELEMENT"; elementId: string; zone: string; updates: Partial<HeaderElement> }
  | { type: "UPDATE_PAGE_HEADER"; pageId: string; overrides: PageDefinition["header"] }
  | { type: "UPDATE_VISIBILITY"; target: { type: string; id: string; pageId?: string }; rule: VisibilityRule | undefined }
  | { type: "UPDATE_GRID"; pageId: string; nodeId: string; columns: number; gap?: string }
  | { type: "UPDATE_SHELL"; updates: Partial<LayoutContractV2["shell"]> }
  | { type: "OPEN_VARIABLE_PICKER"; nodeId: string; propKey: string }
  | { type: "CLOSE_VARIABLE_PICKER" }
  // Grid Canvas actions
  | { type: "SELECT_GRID_ITEM"; payload: { itemId: string | null } }
  | { type: "UPDATE_GRID_ITEM_POSITION"; payload: { itemId: string; colStart: number; rowStart: number } }
  | { type: "UPDATE_GRID_ITEM_SIZE"; payload: { itemId: string; colSpan: number; rowSpan: number } }
  // History
  | { type: "UNDO" }
  | { type: "REDO" };

// ============================================================================
// Reducer
// ============================================================================

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "SET_MODE":
      return { ...state, mode: action.mode };

    case "SET_PAGE":
      return { ...state, currentPage: action.pageId, selection: null };

    case "SELECT":
      return { ...state, selection: action.selection };

    case "HOVER":
      return { ...state, hoveredNodeId: action.nodeId };

    case "DRAG_START":
      return { ...state, dragItem: action.item };

    case "DRAG_OVER":
      return { ...state, dropTarget: action.target };

    case "DRAG_END":
      return { ...state, dragItem: null, dropTarget: null };

    case "DROP":
      return handleDrop(state);

    case "TOGGLE_PANEL":
      const panels = new Set(state.expandedPanels);
      panels.has(action.panelId) ? panels.delete(action.panelId) : panels.add(action.panelId);
      return { ...state, expandedPanels: panels };

    // ---- Contract Mutations (all push to undo stack) ----

    case "UPDATE_CONTRACT":
      return pushUndo(state, action.contract);

    case "UPDATE_NODE":
      return pushUndo(state, updateNodeInContract(state.contract, action.pageId, action.nodeId, action.updates));

    case "UPDATE_NODE_PROPS":
      return pushUndo(state, updateNodeInContract(state.contract, action.pageId, action.nodeId, {
        props: { ...getNodeFromContract(state.contract, action.pageId, action.nodeId)?.props, ...action.props },
      }));

    case "UPDATE_NODE_STYLE":
      return pushUndo(state, updateNodeInContract(state.contract, action.pageId, action.nodeId, {
        style: { ...getNodeFromContract(state.contract, action.pageId, action.nodeId)?.style, ...action.style },
      }));

    case "ADD_NODE":
      return pushUndo(state, addNodeToContract(state.contract, action.pageId, action.parentId, action.index, action.node));

    case "REMOVE_NODE":
      return pushUndo(state, removeNodeFromContract(state.contract, action.pageId, action.nodeId));

    case "MOVE_NODE":
      return pushUndo(state, moveNodeInContract(state.contract, action.pageId, action.nodeId, action.newParentId, action.newIndex));

    case "UPDATE_NAV_ORDER":
      return pushUndo(state, { ...state.contract, navigation: action.navigation });

    case "UPDATE_NAV_ITEM": {
      const nav = state.contract.navigation.map((item) =>
        item.id === action.navItemId ? { ...item, ...action.updates } : item
      );
      return pushUndo(state, { ...state.contract, navigation: nav });
    }

    case "ADD_NAV_ITEM":
      return pushUndo(state, { ...state.contract, navigation: [...state.contract.navigation, action.item] });

    case "REMOVE_NAV_ITEM":
      return pushUndo(state, { ...state.contract, navigation: state.contract.navigation.filter((n) => n.id !== action.navItemId) });

    case "MOVE_HEADER_ELEMENT": {
      const shell = { ...state.contract.shell };
      const header = { ...shell.header! };
      const from = [...(header[action.fromZone as "left" | "center" | "right"] || [])];
      const to = action.fromZone === action.toZone ? from : [...(header[action.toZone as "left" | "center" | "right"] || [])];
      const elIdx = from.findIndex((e) => e.id === action.elementId);
      if (elIdx === -1) return state;
      const [element] = from.splice(elIdx, 1);
      if (action.fromZone === action.toZone) {
        from.splice(action.index, 0, element);
        (header as any)[action.fromZone] = from;
      } else {
        to.splice(action.index, 0, element);
        (header as any)[action.fromZone] = from;
        (header as any)[action.toZone] = to;
      }
      shell.header = header;
      return pushUndo(state, { ...state.contract, shell });
    }

    case "UPDATE_HEADER_ELEMENT": {
      const shell = { ...state.contract.shell };
      const header = { ...shell.header! };
      const zone = action.zone as "left" | "center" | "right";
      header[zone] = (header[zone] || []).map((el) =>
        el.id === action.elementId ? { ...el, ...action.updates } : el
      );
      shell.header = header;
      return pushUndo(state, { ...state.contract, shell });
    }

    case "UPDATE_PAGE_HEADER": {
      const pages = { ...state.contract.pages };
      pages[action.pageId] = { ...pages[action.pageId], header: action.overrides };
      return pushUndo(state, { ...state.contract, pages });
    }

    case "UPDATE_VISIBILITY": {
      if (action.target.type === "node" && action.target.pageId) {
        return pushUndo(state, updateNodeInContract(state.contract, action.target.pageId, action.target.id, { visibility: action.rule }));
      }
      if (action.target.type === "nav-item") {
        const nav = state.contract.navigation.map((item) =>
          item.id === action.target.id ? { ...item, visibility: action.rule } : item
        );
        return pushUndo(state, { ...state.contract, navigation: nav });
      }
      return state;
    }

    case "UPDATE_GRID":
      return pushUndo(state, updateNodeInContract(state.contract, action.pageId, action.nodeId, {
        props: {
          ...getNodeFromContract(state.contract, action.pageId, action.nodeId)?.props,
          columns: action.columns,
          ...(action.gap ? { gap: action.gap } : {}),
        },
      }));

    case "UPDATE_SHELL":
      return pushUndo(state, { ...state.contract, shell: { ...state.contract.shell, ...action.updates } });

    case "OPEN_VARIABLE_PICKER":
      return { ...state, variablePickerOpen: true, variablePickerTarget: { nodeId: action.nodeId, propKey: action.propKey } };

    case "CLOSE_VARIABLE_PICKER":
      return { ...state, variablePickerOpen: false, variablePickerTarget: null };

    case "UNDO":
      if (state.undoStack.length === 0) return state;
      const prevContract = state.undoStack[state.undoStack.length - 1];
      return {
        ...state,
        contract: prevContract,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, state.contract],
        isDirty: true,
      };

    case "REDO":
      if (state.redoStack.length === 0) return state;
      const nextContract = state.redoStack[state.redoStack.length - 1];
      return {
        ...state,
        contract: nextContract,
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [...state.undoStack, state.contract],
        isDirty: true,
      };

    default:
      return state;
  }
}

// ============================================================================
// Contract Mutation Helpers
// ============================================================================

function pushUndo(state: EditorState, newContract: LayoutContractV2): EditorState {
  return {
    ...state,
    contract: newContract,
    undoStack: [...state.undoStack.slice(-49), state.contract],
    redoStack: [],
    isDirty: true,
  };
}

function getNodeFromContract(contract: LayoutContractV2, pageId: string, nodeId: string): NodeDef | undefined {
  const page = contract.pages[pageId];
  if (!page) return undefined;
  return findNodeById(page.content, nodeId);
}

function findNodeById(node: NodeDef, id: string): NodeDef | undefined {
  if (node.id === id) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findNodeById(child, id);
      if (found) return found;
    }
  }
  return undefined;
}

function updateNodeInContract(contract: LayoutContractV2, pageId: string, nodeId: string, updates: Partial<NodeDef>): LayoutContractV2 {
  const pages = { ...contract.pages };
  const page = { ...pages[pageId] };
  page.content = updateNodeInTree(page.content, nodeId, updates);
  pages[pageId] = page;
  return { ...contract, pages };
}

function updateNodeInTree(node: NodeDef, targetId: string, updates: Partial<NodeDef>): NodeDef {
  if (node.id === targetId) {
    return { ...node, ...updates };
  }
  if (node.children) {
    return {
      ...node,
      children: node.children.map((child) => updateNodeInTree(child, targetId, updates)),
    };
  }
  return node;
}

function addNodeToContract(contract: LayoutContractV2, pageId: string, parentId: string, index: number, newNode: NodeDef): LayoutContractV2 {
  const pages = { ...contract.pages };
  const page = { ...pages[pageId] };
  page.content = addNodeToTree(page.content, parentId, index, newNode);
  pages[pageId] = page;
  return { ...contract, pages };
}

function addNodeToTree(node: NodeDef, parentId: string, index: number, newNode: NodeDef): NodeDef {
  if (node.id === parentId) {
    const children = [...(node.children || [])];
    children.splice(index, 0, newNode);
    return { ...node, children };
  }
  if (node.children) {
    return { ...node, children: node.children.map((c) => addNodeToTree(c, parentId, index, newNode)) };
  }
  return node;
}

function removeNodeFromContract(contract: LayoutContractV2, pageId: string, nodeId: string): LayoutContractV2 {
  const pages = { ...contract.pages };
  const page = { ...pages[pageId] };
  page.content = removeNodeFromTree(page.content, nodeId);
  pages[pageId] = page;
  return { ...contract, pages };
}

function removeNodeFromTree(node: NodeDef, targetId: string): NodeDef {
  if (node.children) {
    return {
      ...node,
      children: node.children
        .filter((c) => c.id !== targetId)
        .map((c) => removeNodeFromTree(c, targetId)),
    };
  }
  return node;
}

function moveNodeInContract(contract: LayoutContractV2, pageId: string, nodeId: string, newParentId: string, newIndex: number): LayoutContractV2 {
  const page = contract.pages[pageId];
  if (!page) return contract;
  const node = findNodeById(page.content, nodeId);
  if (!node) return contract;
  // Remove from old position
  let updated = removeNodeFromContract(contract, pageId, nodeId);
  // Add to new position
  updated = addNodeToContract(updated, pageId, newParentId, newIndex, node);
  return updated;
}

function handleDrop(state: EditorState): EditorState {
  const { dragItem, dropTarget } = state;
  if (!dragItem || !dropTarget) return { ...state, dragItem: null, dropTarget: null };

  let newState = state;

  if (dragItem.type === "new-node" && dragItem.nodeType) {
    const newNode = createDefaultNode(dragItem.nodeType);
    newState = editorReducer(state, {
      type: "ADD_NODE",
      pageId: state.currentPage,
      parentId: dropTarget.parentId,
      index: dropTarget.index,
      node: newNode,
    });
  }

  if (dragItem.type === "reorder-node" && dragItem.nodeId) {
    newState = editorReducer(state, {
      type: "MOVE_NODE",
      pageId: state.currentPage,
      nodeId: dragItem.nodeId,
      newParentId: dropTarget.parentId,
      newIndex: dropTarget.index,
    });
  }

  return { ...newState, dragItem: null, dropTarget: null };
}

// ============================================================================
// Default node factory
// ============================================================================

let nodeCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${(++nodeCounter).toString(36)}`;
}

export function createDefaultNode(type: string): NodeDef {
  const id = nextId(type);

  const defaults: Record<string, () => NodeDef> = {
    grid: () => ({ id, type: "grid", props: { columns: 2, gap: "$tokens.spacing.md" }, children: [] }),
    stack: () => ({ id, type: "stack", props: { gap: "$tokens.spacing.md" }, children: [] }),
    row: () => ({ id, type: "row", props: { gap: "$tokens.spacing.sm", align: "center" }, children: [] }),
    container: () => ({ id, type: "container", props: { padding: "$tokens.spacing.md" }, children: [] }),
    text: () => ({ id, type: "text", props: { content: "Texto aqui", textStyle: "body" } }),
    heading: () => ({ id, type: "heading", props: { content: "Título", level: 2, textStyle: "heading-2" } }),
    badge: () => ({ id, type: "badge", props: { content: "status" } }),
    button: () => ({ id, type: "button", props: { label: "Botão", variant: "primary" } }),
    icon: () => ({ id, type: "icon", props: { name: "Star", size: 20 } }),
    image: () => ({ id, type: "image", props: { src: "", size: 64 } }),
    divider: () => ({ id, type: "divider", props: { color: "$tokens.colors.border" } }),
    spacer: () => ({ id, type: "spacer", props: { size: "$tokens.spacing.lg" } }),
    "stat-card": () => ({ id, type: "stat-card", props: { label: "Métrica", value: "0", icon: "ChartLineUp" } }),
    card: () => ({ id, type: "card", props: { title: "Card" }, children: [] }),
    "key-value": () => ({ id, type: "key-value", props: { layout: "vertical", items: [{ label: "Chave", value: "Valor" }] } }),
    table: () => ({
      id, type: "table", props: {
        dataSource: "items", emptyMessage: "Sem dados", rowHeight: 48,
        columns: [
          { key: "col1", label: "Coluna 1", width: "50%", content: "{{item.name}}" },
          { key: "col2", label: "Coluna 2", width: "50%", content: "{{item.value}}" },
        ],
      },
    }),
    list: () => ({ id, type: "list", props: { dataSource: "items", maxItems: 10 } }),
    tabs: () => ({
      id, type: "tabs", props: {
        defaultTab: "tab1",
        items: [{ id: "tab1", label: "Tab 1" }, { id: "tab2", label: "Tab 2" }],
      },
      children: [],
    }),
    search: () => ({ id, type: "search", props: { placeholder: "Buscar..." } }),
    select: () => ({ id, type: "select", props: { placeholder: "Selecionar..." } }),
    slot: () => ({ id, type: "slot", props: { name: `slot-${id}` } }),
  };

  return (defaults[type] || (() => ({ id, type, props: {} })))();
}

// ============================================================================
// Context
// ============================================================================

export interface EditorContextValue {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  // Convenience
  select: (sel: EditorSelection | null) => void;
  setPage: (pageId: string) => void;
  setMode: (mode: EditorMode) => void;
  updateNodeProps: (nodeId: string, props: Record<string, any>) => void;
  updateNodeStyle: (nodeId: string, style: Record<string, string>) => void;
  addNode: (parentId: string, index: number, type: string) => void;
  removeNode: (nodeId: string) => void;
  moveNode: (nodeId: string, newParentId: string, newIndex: number) => void;
  updateGrid: (nodeId: string, columns: number, gap?: string) => void;
  openVariablePicker: (nodeId: string, propKey: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  selectedNode: NodeDef | undefined;
  currentPageDef: PageDefinition | undefined;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export function EditorProvider({
  contract,
  variables,
  children,
}: {
  contract: LayoutContractV2;
  variables: Record<string, any>;
  children: ReactNode;
}) {
  const initialPage = Object.keys(contract.pages)[0] || "dashboard";

  const [state, dispatch] = useReducer(editorReducer, {
    contract,
    variables,
    mode: "design",
    currentPage: initialPage,
    selection: null,
    dragItem: null,
    dropTarget: null,
    hoveredNodeId: null,
    expandedPanels: new Set(["elements", "props"]),
    undoStack: [],
    redoStack: [],
    isDirty: false,
    variablePickerOpen: false,
    variablePickerTarget: null,
  });

  const select = useCallback((sel: EditorSelection | null) => dispatch({ type: "SELECT", selection: sel }), []);
  const setPage = useCallback((pageId: string) => dispatch({ type: "SET_PAGE", pageId }), []);
  const setMode = useCallback((mode: EditorMode) => dispatch({ type: "SET_MODE", mode }), []);
  const updateNodeProps = useCallback((nodeId: string, props: Record<string, any>) => dispatch({ type: "UPDATE_NODE_PROPS", pageId: state.currentPage, nodeId, props }), [state.currentPage]);
  const updateNodeStyle = useCallback((nodeId: string, style: Record<string, string>) => dispatch({ type: "UPDATE_NODE_STYLE", pageId: state.currentPage, nodeId, style }), [state.currentPage]);
  const addNode = useCallback((parentId: string, index: number, type: string) => {
    const node = createDefaultNode(type);
    dispatch({ type: "ADD_NODE", pageId: state.currentPage, parentId, index, node });
    select({ type: "node", id: node.id });
  }, [state.currentPage]);
  const removeNode = useCallback((nodeId: string) => {
    dispatch({ type: "REMOVE_NODE", pageId: state.currentPage, nodeId });
    select(null);
  }, [state.currentPage]);
  const moveNode = useCallback((nodeId: string, newParentId: string, newIndex: number) => dispatch({ type: "MOVE_NODE", pageId: state.currentPage, nodeId, newParentId, newIndex }), [state.currentPage]);
  const updateGrid = useCallback((nodeId: string, columns: number, gap?: string) => dispatch({ type: "UPDATE_GRID", pageId: state.currentPage, nodeId, columns, gap }), [state.currentPage]);
  const openVariablePicker = useCallback((nodeId: string, propKey: string) => dispatch({ type: "OPEN_VARIABLE_PICKER", nodeId, propKey }), []);
  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);
  const redo = useCallback(() => dispatch({ type: "REDO" }), []);

  const selectedNode = useMemo(() => {
    if (!state.selection || state.selection.type !== "node") return undefined;
    const page = state.contract.pages[state.currentPage];
    if (!page) return undefined;
    return findNodeById(page.content, state.selection.id);
  }, [state.selection, state.contract, state.currentPage]);

  const currentPageDef = state.contract.pages[state.currentPage];

  const value: EditorContextValue = useMemo(() => ({
    state,
    dispatch,
    select,
    setPage,
    setMode,
    updateNodeProps,
    updateNodeStyle,
    addNode,
    removeNode,
    moveNode,
    updateGrid,
    openVariablePicker,
    undo,
    redo,
    canUndo: state.undoStack.length > 0,
    canRedo: state.redoStack.length > 0,
    selectedNode,
    currentPageDef,
  }), [state, selectedNode, currentPageDef]);

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor must be used within <EditorProvider>");
  return ctx;
}

// Export helpers
export { findNodeById };
