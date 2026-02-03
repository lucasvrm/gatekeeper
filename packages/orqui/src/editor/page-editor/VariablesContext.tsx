// ============================================================================
// VariablesContext — provides merged variable catalog to all children
// ============================================================================

import React, { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  type VariableInfo, type VariableCategory, type MergedVariables,
  type VariablesSection, mergeVariables, buildMockData, EMPTY_VARIABLES,
} from "./variableSchema";

interface VariablesContextValue {
  /** Merged (user + external) variable catalog */
  merged: MergedVariables;
  /** Flat items list for convenience */
  items: VariableInfo[];
  /** Categories list */
  categories: VariableCategory[];
  /** Mock data built from all variables */
  mockData: Record<string, any>;
  /** User-owned section */
  userVariables: VariablesSection;
  /** Update user-owned section */
  onUserVariablesChange: (v: VariablesSection) => void;
}

const VarCtx = createContext<VariablesContextValue | null>(null);

export function useVariables(): VariablesContextValue {
  const ctx = useContext(VarCtx);
  if (!ctx) {
    // Fallback: return empty set (for safety if used outside provider)
    return {
      merged: { categories: [], items: [] },
      items: [],
      categories: [],
      mockData: {},
      userVariables: EMPTY_VARIABLES,
      onUserVariablesChange: () => {},
    };
  }
  return ctx;
}

interface VariablesProviderProps {
  userVariables: VariablesSection;
  externalVariables?: VariablesSection;
  onUserVariablesChange: (v: VariablesSection) => void;
  children: ReactNode;
}

export function VariablesProvider({
  userVariables,
  externalVariables,
  onUserVariablesChange,
  children,
}: VariablesProviderProps) {
  const merged = useMemo(
    () => mergeVariables(userVariables, externalVariables),
    [userVariables, externalVariables]
  );

  const mockData = useMemo(
    () => buildMockData(merged.items),
    [merged.items]
  );

  const value = useMemo<VariablesContextValue>(() => ({
    merged,
    items: merged.items,
    categories: merged.categories,
    mockData,
    userVariables,
    onUserVariablesChange,
  }), [merged, mockData, userVariables, onUserVariablesChange]);

  return <VarCtx.Provider value={value}>{children}</VarCtx.Provider>;
}
