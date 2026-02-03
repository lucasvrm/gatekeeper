// ============================================================================
// Orqui Visibility Evaluator
// Evaluates conditions like: {{user.role}} === 'admin'
// ============================================================================

import { parseTemplate } from "./parser.js";
import { resolveTemplateText } from "./resolver.js";
import type { DataContext, AppContext } from "./resolver.js";

/**
 * Visibility rule as defined in the contract.
 */
export interface VisibilityRule {
  /** Pages where the element is visible. ["*"] = all pages. */
  pages?: string[];
  /** Conditional expression: "{{user.role}} === 'admin'" */
  condition?: string;
  /** Responsive breakpoints */
  breakpoints?: {
    hidden?: ("mobile" | "tablet" | "desktop")[];
  };
}

/**
 * Current viewport context for breakpoint evaluation.
 */
export interface ViewportContext {
  breakpoint: "mobile" | "tablet" | "desktop";
  width?: number;
}

/**
 * Evaluate a visibility rule. Returns true if element should be shown.
 *
 * @param rule - The visibility rule from the contract
 * @param currentPage - Current page ID
 * @param data - Data context for resolving {{}} in conditions
 * @param appCtx - App context
 * @param viewport - Current viewport for responsive rules
 */
export function evaluateVisibility(
  rule: VisibilityRule | undefined,
  currentPage: string,
  data: DataContext = {},
  appCtx: AppContext = {},
  viewport?: ViewportContext
): boolean {
  // No rule = always visible
  if (!rule) return true;

  // Page filter
  if (rule.pages && rule.pages.length > 0) {
    if (!rule.pages.includes("*") && !rule.pages.includes(currentPage)) {
      return false;
    }
  }

  // Breakpoint filter
  if (rule.breakpoints?.hidden && viewport) {
    if (rule.breakpoints.hidden.includes(viewport.breakpoint)) {
      return false;
    }
  }

  // Condition evaluation
  if (rule.condition) {
    return evaluateCondition(rule.condition, data, appCtx);
  }

  return true;
}

/**
 * Evaluate a conditional expression.
 *
 * Supported formats:
 *   "{{user.role}} === 'admin'"
 *   "{{stats.count}} > 0"
 *   "{{feature.mcp_enabled}} === true"
 *   "{{feature.mcp_enabled}}"          (truthy check)
 *   "{{run.status}} !== 'pending'"
 *   "{{items.length}} >= 5"
 */
export function evaluateCondition(
  condition: string,
  data: DataContext = {},
  appCtx: AppContext = {}
): boolean {
  const trimmed = condition.trim();
  if (!trimmed) return true;

  // Try to parse as comparison expression
  const comparison = parseComparison(trimmed);

  if (comparison) {
    // Resolve left side (the {{}} part)
    const leftResolved = resolveTemplateText(comparison.left, data, appCtx);
    const rightValue = comparison.right;

    return compareValues(leftResolved, comparison.operator, rightValue);
  }

  // If no comparison operator found, treat as truthy check
  // e.g., "{{feature.mcp_enabled}}" → resolve and check truthiness
  const resolved = resolveTemplateText(trimmed, data, appCtx);
  return isTruthy(resolved);
}

/**
 * Parsed comparison expression.
 */
interface Comparison {
  left: string;
  operator: ComparisonOp;
  right: string;
}

type ComparisonOp = "===" | "!==" | "==" | "!=" | ">" | ">=" | "<" | "<=";

// Operator patterns ordered by length (longest first to match !== before !=)
const OPERATORS: ComparisonOp[] = ["!==", "===", ">=", "<=", "!=", "==", ">", "<"];

/**
 * Parse a condition string into a comparison.
 * "{{user.role}} === 'admin'" → { left: "{{user.role}}", operator: "===", right: "admin" }
 */
function parseComparison(condition: string): Comparison | null {
  for (const op of OPERATORS) {
    const idx = condition.indexOf(op);
    if (idx === -1) continue;

    // Make sure we're not inside a {{ }} block
    const beforeOp = condition.slice(0, idx);
    const openCount = (beforeOp.match(/\{\{/g) || []).length;
    const closeCount = (beforeOp.match(/\}\}/g) || []).length;
    if (openCount !== closeCount) continue;

    const left = condition.slice(0, idx).trim();
    const right = condition.slice(idx + op.length).trim();

    return {
      left,
      operator: op,
      right: stripQuotes(right),
    };
  }

  return null;
}

/**
 * Strip surrounding quotes from a string value.
 * "'admin'" → "admin"
 * '"admin"' → "admin"
 */
function stripQuotes(str: string): string {
  if (
    (str.startsWith("'") && str.endsWith("'")) ||
    (str.startsWith('"') && str.endsWith('"'))
  ) {
    return str.slice(1, -1);
  }
  return str;
}

/**
 * Compare two values with the given operator.
 */
function compareValues(left: string, op: ComparisonOp, right: string): boolean {
  // Try numeric comparison first
  const leftNum = parseFloat(left);
  const rightNum = parseFloat(right);
  const bothNumeric = !isNaN(leftNum) && !isNaN(rightNum);

  // Boolean literals
  if (right === "true") return op.includes("!") ? !isTruthy(left) : isTruthy(left);
  if (right === "false") return op.includes("!") ? isTruthy(left) : !isTruthy(left);

  switch (op) {
    case "===":
    case "==":
      return bothNumeric ? leftNum === rightNum : left === right;
    case "!==":
    case "!=":
      return bothNumeric ? leftNum !== rightNum : left !== right;
    case ">":
      return bothNumeric ? leftNum > rightNum : left > right;
    case ">=":
      return bothNumeric ? leftNum >= rightNum : left >= right;
    case "<":
      return bothNumeric ? leftNum < rightNum : left < right;
    case "<=":
      return bothNumeric ? leftNum <= rightNum : left <= right;
    default:
      return false;
  }
}

/**
 * Check if a resolved string value is "truthy" in Orqui's sense.
 * Empty string, "0", "false", "null", "undefined" → false
 * Everything else → true
 */
function isTruthy(value: string): boolean {
  if (!value) return false;
  const lower = value.toLowerCase().trim();
  return lower !== "" && lower !== "0" && lower !== "false" && lower !== "null" && lower !== "undefined";
}

/**
 * Batch evaluate visibility for multiple items.
 * Useful for filtering nav items or table columns.
 */
export function filterByVisibility<T extends { visibility?: VisibilityRule }>(
  items: T[],
  currentPage: string,
  data: DataContext = {},
  appCtx: AppContext = {},
  viewport?: ViewportContext
): T[] {
  return items.filter((item) =>
    evaluateVisibility(item.visibility, currentPage, data, appCtx, viewport)
  );
}
