// ============================================================================
// Orqui Variable Resolver
// Resolves parsed template expressions against a data context
// ============================================================================

import type { ParsedTemplate, TemplateExpression, TemplatePart } from "./parser.js";
import type { FormatterContext, FormattedValue } from "./formatters.js";
import { parseTemplate } from "./parser.js";
import { getFormatter, isRichValue } from "./formatters.js";

/**
 * Data context passed by the consuming app.
 * Structure: { entityName: data | data[], globals... }
 *
 * Example for a table row:
 *   { run: { id: "abc", status: "passed", project: { name: "Frontend" } } }
 *
 * Example for a page with global stats:
 *   { stats: { total_runs: 142 }, user: { name: "Lucas" } }
 */
export type DataContext = Record<string, unknown>;

/**
 * App-level context that provides $app, $page, and variable schema metadata.
 */
export interface AppContext {
  app?: { name: string; [key: string]: unknown };
  page?: { id: string; label: string; route: string; [key: string]: unknown };
  variables?: Record<string, any>;
  tokens?: Record<string, any>;
  locale?: string;
}

/**
 * Result of resolving a template. Contains both the string representation
 * and any rich formatted values (badges, icons, etc.).
 */
export interface ResolvedTemplate {
  /** Plain text representation (all rich values flattened to text) */
  text: string;
  /** Parts with rich values preserved (for React rendering) */
  parts: ResolvedPart[];
  /** Whether any expression resolved to a rich value */
  hasRichValues: boolean;
}

export interface ResolvedLiteral {
  type: "literal";
  value: string;
}

export interface ResolvedValue {
  type: "resolved";
  raw: string;
  value: FormattedValue;
}

export type ResolvedPart = ResolvedLiteral | ResolvedValue;

/**
 * Resolve a template string against a data context.
 *
 * @param template - The template string (e.g., "Status: {{run.status | badge}}")
 * @param data - Data context for resolving entity fields
 * @param appCtx - App-level context ($app, $page, variables schema)
 * @returns ResolvedTemplate with text and rich parts
 */
export function resolveTemplate(
  template: string,
  data: DataContext = {},
  appCtx: AppContext = {}
): ResolvedTemplate {
  const parsed = parseTemplate(template);
  return resolveTemplateParsed(parsed, data, appCtx);
}

/**
 * Resolve an already-parsed template (avoids re-parsing).
 */
export function resolveTemplateParsed(
  parsed: ParsedTemplate,
  data: DataContext = {},
  appCtx: AppContext = {}
): ResolvedTemplate {
  if (parsed.isStatic) {
    return {
      text: parsed.raw,
      parts: [{ type: "literal", value: parsed.raw }],
      hasRichValues: false,
    };
  }

  const parts: ResolvedPart[] = [];
  let hasRichValues = false;

  for (const part of parsed.parts) {
    if (part.type === "literal") {
      parts.push({ type: "literal", value: part.value });
    } else {
      const resolved = resolveExpression(part, data, appCtx);
      if (isRichValue(resolved)) hasRichValues = true;
      parts.push({ type: "resolved", raw: part.raw, value: resolved });
    }
  }

  // Build flat text
  const text = parts
    .map((p) => {
      if (p.type === "literal") return p.value;
      return isRichValue(p.value) ? p.value.text : String(p.value);
    })
    .join("");

  return { text, parts, hasRichValues };
}

/**
 * Quick resolve — returns just the text string.
 */
export function resolveTemplateText(
  template: string,
  data: DataContext = {},
  appCtx: AppContext = {}
): string {
  return resolveTemplate(template, data, appCtx).text;
}

/**
 * Resolve a single expression against the data context.
 */
function resolveExpression(
  expr: TemplateExpression,
  data: DataContext,
  appCtx: AppContext
): FormattedValue {
  // Special prefixes
  if (expr.prefix === "$actions") {
    // Actions are resolved at renderer level, not here
    return { type: "badge", text: `[${(expr.args || []).join(", ")}]` };
  }

  if (expr.prefix === "$enum") {
    // Return enum values from variable schema
    return resolveEnum(expr, appCtx);
  }

  // Resolve raw value from data
  let rawValue: unknown;

  if (expr.prefix === "$app") {
    rawValue = getNestedValue(appCtx.app || {}, expr.path);
  } else if (expr.prefix === "$page") {
    rawValue = getNestedValue(appCtx.page || {}, expr.path);
  } else if (expr.prefix === "$nav") {
    rawValue = getNestedValue(data, ["navigation", ...expr.path]);
  } else {
    // Regular entity field resolution
    rawValue = resolveEntityPath(expr.path, data);
  }

  // Apply formatters in chain
  if (expr.formatters.length === 0) {
    return rawValue == null ? "" : String(rawValue);
  }

  const fmtCtx = buildFormatterContext(expr, appCtx);
  let current: FormattedValue = rawValue as FormattedValue;

  for (const fmt of expr.formatters) {
    const fn = getFormatter(fmt.name);
    if (!fn) {
      // Unknown formatter — pass through
      continue;
    }
    // If previous value was rich, extract text for next formatter
    const input = isRichValue(current) ? current.text : current;
    current = fn(input, fmt.args, fmtCtx);
  }

  // If we still have a raw null/undefined, convert to empty string
  if (current == null) return "";

  return current;
}

/**
 * Resolve an entity path against the data context.
 * Handles nested entities via refs:
 *   ["run", "project", "name"] → data.run.project.name
 *
 * Also handles single entity (no prefix) for table rows:
 *   data = { run: { id: "abc" } }, path = ["run", "id"] → "abc"
 */
function resolveEntityPath(path: string[], data: DataContext): unknown {
  if (path.length === 0) return undefined;

  // Try direct path first
  const directResult = getNestedValue(data, path);
  if (directResult !== undefined) return directResult;

  // If first segment is an entity name and data has it as a single object,
  // the path might be entity.field where entity is flattened in data
  return undefined;
}

/**
 * Get a nested value from an object by path segments.
 */
export function getNestedValue(obj: unknown, path: string[]): unknown {
  let current: unknown = obj;

  for (const segment of path) {
    if (current == null) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

/**
 * Resolve $enum prefix — returns enum values from variable schema.
 */
function resolveEnum(expr: TemplateExpression, appCtx: AppContext): string {
  if (!appCtx.variables || expr.path.length < 2) return "[]";

  const [entityName, fieldName] = expr.path;
  const entity = appCtx.variables.entities?.[entityName];
  if (!entity) return "[]";

  const field = entity.fields?.[fieldName];
  if (!field?.values) return "[]";

  return JSON.stringify(field.values);
}

/**
 * Build formatter context from expression metadata.
 */
function buildFormatterContext(
  expr: TemplateExpression,
  appCtx: AppContext
): FormatterContext {
  // Infer entity and field name from path for colorMap/iconMap resolution
  let entityName: string | undefined;
  let fieldName: string | undefined;

  if (expr.path.length >= 2 && !expr.prefix) {
    entityName = expr.path[0];
    fieldName = expr.path[expr.path.length - 1];
  } else if (expr.path.length === 1 && !expr.prefix) {
    // Might be a direct field in a table row context
    fieldName = expr.path[0];
  }

  return {
    tokens: appCtx.tokens,
    variables: appCtx.variables,
    entityName,
    fieldName,
    locale: appCtx.locale || "pt-BR",
  };
}

// ============================================================================
// Batch resolution helpers
// ============================================================================

/**
 * Resolve all {{}} templates in a record of string values.
 * Useful for resolving all columns of a table row at once.
 */
export function resolveTemplateRecord(
  templates: Record<string, string>,
  data: DataContext,
  appCtx: AppContext = {}
): Record<string, ResolvedTemplate> {
  const result: Record<string, ResolvedTemplate> = {};
  for (const [key, template] of Object.entries(templates)) {
    result[key] = resolveTemplate(template, data, appCtx);
  }
  return result;
}

/**
 * Resolve a template for each item in a data array.
 * Used for table rows: each item becomes the data context for its row.
 */
export function resolveTemplateForList(
  template: string,
  entityName: string,
  items: unknown[],
  appCtx: AppContext = {}
): ResolvedTemplate[] {
  const parsed = parseTemplate(template);
  return items.map((item) => {
    const data: DataContext = { [entityName]: item };
    return resolveTemplateParsed(parsed, data, appCtx);
  });
}
