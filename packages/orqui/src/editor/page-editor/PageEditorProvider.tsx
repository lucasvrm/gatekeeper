// ============================================================================
// PageEditorProvider — state management for the DnD page builder
// With undo/redo history, clipboard, keyboard actions
// ============================================================================

import React, { createContext, useContext, useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import type { NodeDef, PageDef } from "./nodeDefaults";
import { createDefaultNode, createDefaultPage, isContainerType, generateId } from "./nodeDefaults";
import { findNode, findParent, insertChild, removeChild, moveNode, updateNode, cloneSubtree, isDescendant } from "./treeUtils";

// ============================================================================
// Types
// ============================================================================

export interface DragSource {
  type: "palette" | "canvas";
  nodeType?: string;
  nodeId?: string;
}

export interface DropTarget {
  parentId: string;
  index: number;
}

interface PEState {
  pages: Record<string, PageDef>;
  currentPageId: string | null;
  selectedNodeId: string | null;
  drag: {
    active: boolean;
    source: DragSource | null;
    dropTarget: DropTarget | null;
  };
  clipboard: NodeDef | null;
}

// ============================================================================
// Helpers
// ============================================================================

function getCurrentContent(state: PEState): NodeDef | null {
  if (!state.currentPageId) return null;
  return state.pages[state.currentPageId]?.content ?? null;
}

function updateCurrentContent(state: PEState, updater: (content: NodeDef) => NodeDef): PEState {
  if (!state.currentPageId) return state;
  const page = state.pages[state.currentPageId];
  if (!page) return state;
  return {
    ...state,
    pages: {
      ...state.pages,
      [state.currentPageId]: { ...page, content: updater(page.content) },
    },
  };
}

// ============================================================================
// Actions that modify the tree (undoable)
// ============================================================================

function applyAction(state: PEState, action: UndoableAction): PEState | null {
  switch (action.type) {
    case "ADD_PAGE":
      return {
        ...state,
        pages: { ...state.pages, [action.page.id]: action.page },
        currentPageId: action.page.id,
        selectedNodeId: null,
      };

    case "REMOVE_PAGE": {
      if (!state.pages[action.pageId]) return null;
      const { [action.pageId]: _, ...rest } = state.pages;
      const ids = Object.keys(rest);
      return {
        ...state,
        pages: rest,
        currentPageId: state.currentPageId === action.pageId ? (ids[0] || null) : state.currentPageId,
        selectedNodeId: state.currentPageId === action.pageId ? null : state.selectedNodeId,
      };
    }

    case "UPDATE_PAGE_META": {
      const page = state.pages[action.pageId];
      if (!page) return null;
      return {
        ...state,
        pages: {
          ...state.pages,
          [action.pageId]: {
            ...page,
            label: action.label ?? page.label,
            route: action.route ?? page.route,
            browserTitle: action.browserTitle ?? page.browserTitle,
          },
        },
      };
    }

    case "ADD_NODE":
      return updateCurrentContent(state, content =>
        insertChild(content, action.parentId, action.index, action.node)
      );

    case "REMOVE_NODE": {
      const newState = updateCurrentContent(state, content =>
        removeChild(content, action.nodeId)
      );
      return {
        ...newState,
        selectedNodeId: state.selectedNodeId === action.nodeId ? null : state.selectedNodeId,
      };
    }

    case "MOVE_NODE": {
      const content = getCurrentContent(state);
      if (!content) return null;
      if (isDescendant(content, action.newParentId, action.nodeId)) return null;
      return updateCurrentContent(state, c =>
        moveNode(c, action.nodeId, action.newParentId, action.newIndex)
      );
    }

    case "UPDATE_NODE_PROPS":
      return updateCurrentContent(state, content =>
        updateNode(content, action.nodeId, node => ({
          ...node,
          props: { ...(node.props || {}), ...action.props },
        }))
      );

    case "UPDATE_NODE_STYLE":
      return updateCurrentContent(state, content =>
        updateNode(content, action.nodeId, node => ({
          ...node,
          style: { ...(node.style || {}), ...action.style },
        }))
      );

    case "DUPLICATE_NODE": {
      const content = getCurrentContent(state);
      if (!content) return null;
      const parent = findParent(content, action.nodeId);
      const node = findNode(content, action.nodeId);
      if (!parent || !node) return null;
      const clone = cloneSubtree(node);
      const newState = updateCurrentContent(state, c =>
        insertChild(c, parent.parent.id, parent.index + 1, clone)
      );
      return { ...newState, selectedNodeId: clone.id };
    }

    case "WRAP_IN_CONTAINER": {
      const content = getCurrentContent(state);
      if (!content) return null;
      const parent = findParent(content, action.nodeId);
      const node = findNode(content, action.nodeId);
      if (!parent || !node) return null;
      const wrapper: NodeDef = {
        id: generateId(action.containerType),
        type: action.containerType,
        props: action.containerType === "grid" ? { columns: 2, gap: "16px" } : { gap: "16px" },
        children: [node],
      };
      let tree = removeChild(content, action.nodeId);
      tree = insertChild(tree, parent.parent.id, parent.index, wrapper);
      return { ...updateCurrentContent(state, () => tree), selectedNodeId: wrapper.id };
    }

    case "DROP": {
      const { source, dropTarget } = state.drag;
      if (!source || !dropTarget) return null;

      let newState = state;

      if (source.type === "palette" && source.nodeType) {
        const newNode = createDefaultNode(source.nodeType);
        newState = updateCurrentContent(newState, content =>
          insertChild(content, dropTarget.parentId, dropTarget.index, newNode)
        );
        newState = { ...newState, selectedNodeId: newNode.id };
      }

      if (source.type === "canvas" && source.nodeId) {
        const content = getCurrentContent(newState);
        if (content && !isDescendant(content, dropTarget.parentId, source.nodeId)) {
          newState = updateCurrentContent(newState, content =>
            moveNode(content, source.nodeId!, dropTarget.parentId, dropTarget.index)
          );
        }
      }

      return { ...newState, drag: { active: false, source: null, dropTarget: null } };
    }

    case "PASTE_NODE": {
      if (!state.clipboard) return null;
      const clone = cloneSubtree(state.clipboard);
      const newState = updateCurrentContent(state, content =>
        insertChild(content, action.parentId, action.index, clone)
      );
      return { ...newState, selectedNodeId: clone.id };
    }

    case "SET_PAGES":
      return {
        ...state,
        pages: action.pages,
        currentPageId: state.currentPageId && action.pages[state.currentPageId]
          ? state.currentPageId
          : Object.keys(action.pages)[0] || null,
        selectedNodeId: null,
      };

    default:
      return null;
  }
}

// Undoable actions (modify tree structure/content)
type UndoableAction =
  | { type: "ADD_PAGE"; page: PageDef }
  | { type: "REMOVE_PAGE"; pageId: string }
  | { type: "UPDATE_PAGE_META"; pageId: string; label?: string; route?: string; browserTitle?: string }
  | { type: "ADD_NODE"; parentId: string; index: number; node: NodeDef }
  | { type: "REMOVE_NODE"; nodeId: string }
  | { type: "MOVE_NODE"; nodeId: string; newParentId: string; newIndex: number }
  | { type: "UPDATE_NODE_PROPS"; nodeId: string; props: Record<string, any> }
  | { type: "UPDATE_NODE_STYLE"; nodeId: string; style: Record<string, string> }
  | { type: "DUPLICATE_NODE"; nodeId: string }
  | { type: "WRAP_IN_CONTAINER"; nodeId: string; containerType: string }
  | { type: "DROP" }
  | { type: "PASTE_NODE"; parentId: string; index: number }
  | { type: "SET_PAGES"; pages: Record<string, PageDef> };

// Non-undoable actions (UI-only: selection, drag state, clipboard)
type TransientAction =
  | { type: "SELECT_PAGE"; pageId: string }
  | { type: "SELECT_NODE"; nodeId: string | null }
  | { type: "DRAG_START"; source: DragSource }
  | { type: "DRAG_OVER"; target: DropTarget | null }
  | { type: "DRAG_END" }
  | { type: "COPY_NODE"; nodeId: string };

type PEAction = UndoableAction | TransientAction;

function applyTransient(state: PEState, action: TransientAction): PEState {
  switch (action.type) {
    case "SELECT_PAGE":
      return { ...state, currentPageId: action.pageId, selectedNodeId: null };
    case "SELECT_NODE":
      return { ...state, selectedNodeId: action.nodeId };
    case "DRAG_START":
      return { ...state, drag: { active: true, source: action.source, dropTarget: null } };
    case "DRAG_OVER":
      return { ...state, drag: { ...state.drag, dropTarget: action.target } };
    case "DRAG_END":
      return { ...state, drag: { active: false, source: null, dropTarget: null } };
    case "COPY_NODE": {
      const content = getCurrentContent(state);
      if (!content) return state;
      const node = findNode(content, action.nodeId);
      if (!node) return state;
      return { ...state, clipboard: cloneSubtree(node) };
    }
    default:
      return state;
  }
}

const TRANSIENT_TYPES = new Set(["SELECT_PAGE", "SELECT_NODE", "DRAG_START", "DRAG_OVER", "DRAG_END", "COPY_NODE"]);

// Actions that get batched (rapid typing in prop fields)
const BATCHABLE_TYPES = new Set(["UPDATE_NODE_PROPS", "UPDATE_NODE_STYLE"]);

// ============================================================================
// History
// ============================================================================

const MAX_HISTORY = 80;

interface HistoryEntry {
  state: PEState;
  label: string;
}

// ============================================================================
// Context
// ============================================================================

interface PEContextValue {
  state: PEState;
  dispatch: (action: PEAction) => void;
  // Convenience getters
  currentPage: PageDef | null;
  currentContent: NodeDef | null;
  selectedNode: NodeDef | null;
  // Undo / Redo
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  historySize: number;
  // Convenience actions
  selectNode: (id: string | null) => void;
  addNode: (parentId: string, index: number, type: string) => void;
  removeNode: (id: string) => void;
  duplicateNode: (id: string) => void;
  copyNode: (id: string) => void;
  pasteNode: (parentId: string, index: number) => void;
  updateProps: (id: string, props: Record<string, any>) => void;
  updateStyle: (id: string, style: Record<string, string>) => void;
  startDragFromPalette: (nodeType: string) => void;
  startDragFromCanvas: (nodeId: string) => void;
  setDropTarget: (target: DropTarget | null) => void;
  endDrag: () => void;
  drop: () => void;
}

const PEContext = createContext<PEContextValue | null>(null);

export function usePageEditor(): PEContextValue {
  const ctx = useContext(PEContext);
  if (!ctx) throw new Error("usePageEditor must be inside PageEditorProvider");
  return ctx;
}

// ============================================================================
// Provider
// ============================================================================

interface ProviderProps {
  initialPages: Record<string, PageDef>;
  children: ReactNode;
}

export function PageEditorProvider({ initialPages, children }: ProviderProps) {
  const firstPageId = Object.keys(initialPages)[0] || null;

  const initialState: PEState = {
    pages: initialPages,
    currentPageId: firstPageId,
    selectedNodeId: null,
    drag: { active: false, source: null, dropTarget: null },
    clipboard: null,
  };

  const [state, setState] = useState<PEState>(initialState);

  // Undo/redo stacks (refs — don't trigger renders on their own)
  const undoStack = useRef<HistoryEntry[]>([]);
  const redoStack = useRef<HistoryEntry[]>([]);
  // Batch tracker for rapid prop/style edits
  const batchRef = useRef<{ actionType: string; nodeId: string; time: number } | null>(null);
  // Version counter to trigger re-render when canUndo/canRedo changes
  const [historyVersion, setHistoryVersion] = useState(0);
  const bumpHistory = useCallback(() => setHistoryVersion(v => v + 1), []);

  // ---- Dispatch with history ----
  const dispatch = useCallback((action: PEAction) => {
    setState(prev => {
      // Transient: no history
      if (TRANSIENT_TYPES.has(action.type)) {
        return applyTransient(prev, action as TransientAction);
      }

      // Undoable
      const next = applyAction(prev, action as UndoableAction);
      if (!next || next === prev) return prev;

      // Batch detection: rapid edits on same node within 800ms
      const isBatchable = BATCHABLE_TYPES.has(action.type);
      const now = Date.now();
      const batchNodeId = (action as any).nodeId;
      const shouldBatch = isBatchable
        && batchRef.current
        && batchRef.current.actionType === action.type
        && batchRef.current.nodeId === batchNodeId
        && (now - batchRef.current.time) < 800;

      if (shouldBatch) {
        // Update batch timestamp only — the undo entry already points to the pre-batch state
        batchRef.current = { actionType: action.type, nodeId: batchNodeId, time: now };
      } else {
        // Push current state to undo
        undoStack.current.push({ state: prev, label: action.type });
        if (undoStack.current.length > MAX_HISTORY) {
          undoStack.current.shift();
        }
        batchRef.current = isBatchable
          ? { actionType: action.type, nodeId: batchNodeId, time: now }
          : null;
      }

      // Clear redo on any new action
      redoStack.current = [];
      setTimeout(bumpHistory, 0);
      return next;
    });
  }, [bumpHistory]);

  // ---- Undo ----
  const undo = useCallback(() => {
    setState(prev => {
      const entry = undoStack.current.pop();
      if (!entry) return prev;
      redoStack.current.push({ state: prev, label: entry.label });
      batchRef.current = null;
      setTimeout(bumpHistory, 0);
      return entry.state;
    });
  }, [bumpHistory]);

  // ---- Redo ----
  const redo = useCallback(() => {
    setState(prev => {
      const entry = redoStack.current.pop();
      if (!entry) return prev;
      undoStack.current.push({ state: prev, label: entry.label });
      batchRef.current = null;
      setTimeout(bumpHistory, 0);
      return entry.state;
    });
  }, [bumpHistory]);

  // ---- Derived ----
  const currentPage = state.currentPageId ? state.pages[state.currentPageId] ?? null : null;
  const currentContent = currentPage?.content ?? null;
  const selectedNode = useMemo(() => {
    if (!state.selectedNodeId || !currentContent) return null;
    return findNode(currentContent, state.selectedNodeId);
  }, [state.selectedNodeId, currentContent]);

  const canUndo = undoStack.current.length > 0;
  const canRedo = redoStack.current.length > 0;

  // ---- Convenience actions ----
  const selectNode = useCallback((id: string | null) => dispatch({ type: "SELECT_NODE", nodeId: id }), [dispatch]);
  const addNode = useCallback((parentId: string, index: number, type: string) => {
    const node = createDefaultNode(type);
    dispatch({ type: "ADD_NODE", parentId, index, node });
    dispatch({ type: "SELECT_NODE", nodeId: node.id });
  }, [dispatch]);
  const removeNode = useCallback((id: string) => dispatch({ type: "REMOVE_NODE", nodeId: id }), [dispatch]);
  const duplicateNode = useCallback((id: string) => dispatch({ type: "DUPLICATE_NODE", nodeId: id }), [dispatch]);
  const copyNode = useCallback((id: string) => dispatch({ type: "COPY_NODE", nodeId: id }), [dispatch]);
  const pasteNode = useCallback((parentId: string, index: number) => dispatch({ type: "PASTE_NODE", parentId, index }), [dispatch]);
  const updateProps = useCallback((id: string, props: Record<string, any>) => dispatch({ type: "UPDATE_NODE_PROPS", nodeId: id, props }), [dispatch]);
  const updateStyle = useCallback((id: string, style: Record<string, string>) => dispatch({ type: "UPDATE_NODE_STYLE", nodeId: id, style }), [dispatch]);
  const startDragFromPalette = useCallback((nodeType: string) => dispatch({ type: "DRAG_START", source: { type: "palette", nodeType } }), [dispatch]);
  const startDragFromCanvas = useCallback((nodeId: string) => dispatch({ type: "DRAG_START", source: { type: "canvas", nodeId } }), [dispatch]);
  const setDropTarget = useCallback((target: DropTarget | null) => dispatch({ type: "DRAG_OVER", target }), [dispatch]);
  const endDrag = useCallback(() => dispatch({ type: "DRAG_END" }), [dispatch]);
  const drop = useCallback(() => dispatch({ type: "DROP" }), [dispatch]);

  const value = useMemo<PEContextValue>(() => ({
    state, dispatch,
    currentPage, currentContent, selectedNode,
    undo, redo, canUndo, canRedo,
    historySize: undoStack.current.length,
    selectNode, addNode, removeNode, duplicateNode, copyNode, pasteNode,
    updateProps, updateStyle,
    startDragFromPalette, startDragFromCanvas, setDropTarget, endDrag, drop,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [state, currentPage, currentContent, selectedNode, canUndo, canRedo, historyVersion]);

  return <PEContext.Provider value={value}>{children}</PEContext.Provider>;
}
