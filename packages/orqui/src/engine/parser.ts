// ============================================================================
// Orqui Template Parser
// Parses "{{entity.field | formatter:arg}}" into structured expressions
// ============================================================================

/**
 * A single parsed expression within a template string.
 * A template like "Total: {{count}} runs" produces:
 *   [{ type: "literal", value: "Total: " }, { type: "expression", ... }, { type: "literal", value: " runs" }]
 */
export interface TemplateLiteral {
  type: "literal";
  value: string;
}

export interface TemplateExpression {
  type: "expression";
  raw: string;               // Original text inside {{ }}
  path: string[];             // ["entity", "field", "subfield"]
  prefix?: string;            // "$app", "$page", "$enum", "$actions", "$nav"
  formatters: FormatterCall[];
  args?: string[];            // For $actions: ["view", "edit", "delete"]
}

export interface FormatterCall {
  name: string;
  args: string[];
}

export type TemplatePart = TemplateLiteral | TemplateExpression;

/**
 * A fully parsed template — the output of parseTemplate()
 */
export interface ParsedTemplate {
  raw: string;                // Original template string
  parts: TemplatePart[];
  isStatic: boolean;          // true if no {{ }} expressions
  expressions: TemplateExpression[]; // All expressions (convenience)
}

// Special prefixes that change resolution behavior
const SPECIAL_PREFIXES = ["$app", "$page", "$enum", "$actions", "$nav"] as const;
export type SpecialPrefix = typeof SPECIAL_PREFIXES[number];

/**
 * Parse a template string into structured parts.
 *
 * Supports:
 *   "Hello"                              → static literal
 *   "{{name}}"                           → single expression
 *   "Total: {{count}} items"             → mixed
 *   "{{date | date:relative}}"           → with formatter
 *   "{{id | truncate:8 | uppercase}}"    → chained formatters
 *   "{{$app.name}}"                      → special prefix
 *   "{{$actions: view, edit, delete}}"   → action list
 *   "{{$enum.run.status}}"               → enum values
 */
export function parseTemplate(template: string): ParsedTemplate {
  if (!template || typeof template !== "string") {
    return { raw: template ?? "", parts: [], isStatic: true, expressions: [] };
  }

  const parts: TemplatePart[] = [];
  const expressions: TemplateExpression[] = [];
  let cursor = 0;

  while (cursor < template.length) {
    const openIdx = template.indexOf("{{", cursor);

    if (openIdx === -1) {
      // No more expressions — rest is literal
      const rest = template.slice(cursor);
      if (rest) parts.push({ type: "literal", value: rest });
      break;
    }

    // Literal before the expression
    if (openIdx > cursor) {
      parts.push({ type: "literal", value: template.slice(cursor, openIdx) });
    }

    const closeIdx = template.indexOf("}}", openIdx + 2);
    if (closeIdx === -1) {
      // Unclosed {{ — treat rest as literal
      parts.push({ type: "literal", value: template.slice(openIdx) });
      break;
    }

    const rawExpr = template.slice(openIdx + 2, closeIdx).trim();
    const expr = parseExpression(rawExpr);
    parts.push(expr);
    expressions.push(expr);

    cursor = closeIdx + 2;
  }

  return {
    raw: template,
    parts,
    isStatic: expressions.length === 0,
    expressions,
  };
}

/**
 * Parse the content inside {{ }}.
 * Examples:
 *   "run.status"                    → path: ["run", "status"]
 *   "run.status | badge"            → path + formatter
 *   "run.id | truncate:8 | upper"   → path + chained formatters
 *   "$app.name"                     → prefix: "$app", path: ["name"]
 *   "$actions: view, edit, delete"  → prefix: "$actions", args: ["view", "edit", "delete"]
 *   "$enum.run.status"              → prefix: "$enum", path: ["run", "status"]
 */
function parseExpression(raw: string): TemplateExpression {
  const trimmed = raw.trim();

  // Check for $actions: special syntax
  const actionsMatch = trimmed.match(/^\$actions\s*:\s*(.+)$/);
  if (actionsMatch) {
    const args = actionsMatch[1].split(",").map((a) => a.trim()).filter(Boolean);
    return {
      type: "expression",
      raw: trimmed,
      path: [],
      prefix: "$actions",
      formatters: [],
      args,
    };
  }

  // Split by pipe for formatters: "path | fmt1:arg | fmt2"
  const pipeSegments = splitPipes(trimmed);
  const pathSegment = pipeSegments[0].trim();
  const formatterSegments = pipeSegments.slice(1);

  // Parse path and detect prefix
  let prefix: string | undefined;
  let pathStr = pathSegment;

  for (const p of SPECIAL_PREFIXES) {
    if (pathSegment.startsWith(p + ".")) {
      prefix = p;
      pathStr = pathSegment.slice(p.length + 1);
      break;
    }
    if (pathSegment === p) {
      prefix = p;
      pathStr = "";
      break;
    }
  }

  const path = pathStr ? pathStr.split(".").map((s) => s.trim()) : [];

  // Parse formatters
  const formatters = formatterSegments.map(parseFormatterCall);

  return {
    type: "expression",
    raw: trimmed,
    path,
    prefix,
    formatters,
  };
}

/**
 * Split by | but respect nested templates (e.g., in link formatter args).
 * Simple split works for our syntax since we don't allow | inside args.
 */
function splitPipes(str: string): string[] {
  const result: string[] = [];
  let current = "";
  let depth = 0;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === "{" && str[i + 1] === "{") {
      depth++;
      current += ch;
    } else if (ch === "}" && str[i + 1] === "}") {
      depth--;
      current += ch;
    } else if (ch === "|" && depth === 0) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current) result.push(current);
  return result;
}

/**
 * Parse a single formatter call: "date:relative" → { name: "date", args: ["relative"] }
 */
function parseFormatterCall(segment: string): FormatterCall {
  const trimmed = segment.trim();
  const colonIdx = trimmed.indexOf(":");

  if (colonIdx === -1) {
    return { name: trimmed, args: [] };
  }

  const name = trimmed.slice(0, colonIdx).trim();
  const argStr = trimmed.slice(colonIdx + 1).trim();

  // Keep argStr as a single argument. Specific formatters (like boolean)
  // handle their own internal splitting (e.g., "Sim/Não").
  return { name, args: [argStr.trim()] };
}

/**
 * Check if a string contains any template expressions.
 */
export function hasTemplateExpressions(str: string): boolean {
  if (!str || typeof str !== "string") return false;
  return str.includes("{{") && str.includes("}}");
}

/**
 * Extract all variable paths from a template (for dependency tracking).
 */
export function extractVariablePaths(template: string): string[] {
  const parsed = parseTemplate(template);
  return parsed.expressions
    .filter((e) => !e.prefix || e.prefix === "$app" || e.prefix === "$page")
    .map((e) => {
      const base = e.prefix ? `${e.prefix}.${e.path.join(".")}` : e.path.join(".");
      return base;
    });
}
