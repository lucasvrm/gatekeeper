// ============================================================================
// Variable Schema — types, utilities, merge logic
// No hardcoded data — variables come from user (contract) + consumer (props)
// ============================================================================

// ---- Types ----

export interface VariableInfo {
  path: string;           // "run.status", "$app.name"
  label: string;          // Human-readable name
  type: "string" | "number" | "boolean" | "date" | "array" | "object";
  category: string;       // Grouping key (e.g. "run", "user", "stats")
  description?: string;
  mockValue: any;         // Used for preview in the editor
  source?: "user" | "external"; // Injected at merge time
}

export interface VariableCategory {
  id: string;
  label: string;
  icon: string;
  description?: string;
  source?: "user" | "external";
}

/** What's stored in the contract under layout.variables */
export interface VariablesSection {
  categories: VariableCategory[];
  items: VariableInfo[];
}

// ---- Empty defaults ----

export const EMPTY_VARIABLES: VariablesSection = {
  categories: [],
  items: [],
};

// ---- Merge user + external ----

export interface MergedVariables {
  categories: VariableCategory[];
  items: VariableInfo[];
}

/**
 * Merge user-defined variables (from contract) with external variables
 * (from consumer props). External are tagged source="external" (read-only in UI).
 * User-defined are tagged source="user".
 * On path collision, user wins (allows overriding mockValue).
 */
export function mergeVariables(
  userVars: VariablesSection | undefined,
  externalVars: VariablesSection | undefined,
): MergedVariables {
  const user = userVars || EMPTY_VARIABLES;
  const ext = externalVars || EMPTY_VARIABLES;

  // Tag sources
  const userItems: VariableInfo[] = user.items.map(v => ({ ...v, source: "user" as const }));
  const extItems: VariableInfo[] = ext.items.map(v => ({ ...v, source: "external" as const }));

  // Merge items: user wins on collision
  const pathSet = new Set(userItems.map(v => v.path));
  const merged = [...userItems, ...extItems.filter(v => !pathSet.has(v.path))];

  // Merge categories: user wins on collision
  const userCats: VariableCategory[] = user.categories.map(c => ({ ...c, source: "user" as const }));
  const extCats: VariableCategory[] = ext.categories.map(c => ({ ...c, source: "external" as const }));
  const catIdSet = new Set(userCats.map(c => c.id));
  const mergedCats = [...userCats, ...extCats.filter(c => !catIdSet.has(c.id))];

  // Auto-create categories for items whose category doesn't exist
  const allCatIds = new Set(mergedCats.map(c => c.id));
  const orphanCats = new Set<string>();
  for (const item of merged) {
    if (!allCatIds.has(item.category)) orphanCats.add(item.category);
  }
  for (const catId of orphanCats) {
    mergedCats.push({ id: catId, label: catId, icon: "📦" });
  }

  return { categories: mergedCats, items: merged };
}

// ---- Build mock data object from variable list ----

export function buildMockData(variables: VariableInfo[]): Record<string, any> {
  const data: Record<string, any> = {};
  for (const v of variables) {
    setNestedValue(data, v.path, v.mockValue);
  }
  return data;
}

function setNestedValue(obj: Record<string, any>, path: string, value: any) {
  const parts = path.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!current[key] || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key];
  }
  current[parts[parts.length - 1]] = value;
}

// ---- Search / filter helpers ----

export function searchVariables(query: string, variables: VariableInfo[]): VariableInfo[] {
  if (!query.trim()) return variables;
  const q = query.toLowerCase();
  return variables.filter(v =>
    v.path.toLowerCase().includes(q) ||
    v.label.toLowerCase().includes(q) ||
    (v.description || "").toLowerCase().includes(q) ||
    v.category.toLowerCase().includes(q)
  );
}

export function getVariableInfo(path: string, variables: VariableInfo[]): VariableInfo | undefined {
  return variables.find(v => v.path === path);
}

export function groupByCategory(variables: VariableInfo[]): Record<string, VariableInfo[]> {
  const groups: Record<string, VariableInfo[]> = {};
  for (const v of variables) {
    if (!groups[v.category]) groups[v.category] = [];
    groups[v.category].push(v);
  }
  return groups;
}

export function typeIcon(type: VariableInfo["type"]): string {
  switch (type) {
    case "string": return "Aa";
    case "number": return "#";
    case "boolean": return "◯";
    case "date": return "📅";
    case "array": return "[]";
    case "object": return "{}";
    default: return "?";
  }
}

/** Mock value display for picker UI */
export function formatMock(val: any): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "string") return val.length > 16 ? val.slice(0, 16) + "…" : val;
  if (typeof val === "number") return String(val);
  if (typeof val === "boolean") return val ? "true" : "false";
  if (Array.isArray(val)) return `[${val.length}]`;
  return "{…}";
}

// ---- Default mock for a type ----

export function defaultMockValue(type: VariableInfo["type"]): any {
  switch (type) {
    case "string": return "exemplo";
    case "number": return 42;
    case "boolean": return true;
    case "date": return new Date().toISOString();
    case "array": return [];
    case "object": return {};
    default: return "";
  }
}
