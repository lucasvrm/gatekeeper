// ============================================================================
// Orqui Template Formatters
// Built-in formatters for {{value | formatter:arg}} syntax
// ============================================================================

/**
 * A formatter function receives a resolved value and optional arguments,
 * and returns the formatted string (or a FormattedValue for rich output).
 */
export type FormatterFn = (value: unknown, args: string[], ctx: FormatterContext) => FormattedValue;

/**
 * Context passed to formatters for resolving tokens and entity metadata.
 */
export interface FormatterContext {
  /** Design tokens from the contract */
  tokens?: Record<string, any>;
  /** Variable schema (for colorMap, iconMap lookups) */
  variables?: Record<string, any>;
  /** Current entity name (e.g., "run") for colorMap resolution */
  entityName?: string;
  /** Current field name (e.g., "status") */
  fieldName?: string;
  /** Locale for number/date formatting */
  locale?: string;
  /** Timezone */
  timezone?: string;
}

/**
 * Output of a formatter. Can be a simple string or a rich value
 * that the renderer interprets (e.g., badge with color).
 */
export interface RichFormattedValue {
  type: "badge" | "icon" | "color" | "link" | "boolean-icon";
  text: string;
  color?: string;
  icon?: string;
  href?: string;
}

export type FormattedValue = string | RichFormattedValue;

/**
 * Check if a formatted value is rich (not a plain string).
 */
export function isRichValue(v: FormattedValue): v is RichFormattedValue {
  return typeof v === "object" && v !== null && "type" in v;
}

// ============================================================================
// Built-in Formatters
// ============================================================================

const formatters: Record<string, FormatterFn> = {};

/**
 * Register a custom formatter.
 */
export function registerFormatter(name: string, fn: FormatterFn): void {
  formatters[name] = fn;
}

/**
 * Get a formatter by name.
 */
export function getFormatter(name: string): FormatterFn | undefined {
  return formatters[name];
}

/**
 * Get all registered formatter names.
 */
export function getFormatterNames(): string[] {
  return Object.keys(formatters);
}

// ---- badge ----
// Renders as a colored badge. Uses colorMap from variable schema.
registerFormatter("badge", (value, _args, ctx) => {
  const str = String(value ?? "");
  const color = resolveColorMap(str, ctx);
  return { type: "badge", text: str, color };
});

// ---- date ----
// Formats dates. Args: "relative", "short", "full", "iso"
registerFormatter("date", (value, args, ctx) => {
  if (value == null || value === "") return "";
  const date = toDate(value);
  if (!date) return String(value);

  const format = args[0] || "short";
  const locale = ctx.locale || "pt-BR";

  switch (format) {
    case "relative":
      return formatRelativeDate(date);
    case "short":
      return date.toLocaleDateString(locale, { day: "numeric", month: "short" });
    case "full":
      return date.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
    case "iso":
      return date.toISOString().slice(0, 10);
    case "datetime":
      return date.toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    case "time":
      return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    default:
      return date.toLocaleDateString(locale);
  }
});

// ---- currency ----
// Formats as currency. Args: currency code (default: BRL)
registerFormatter("currency", (value, args, ctx) => {
  const num = toNumber(value);
  if (num === null) return String(value ?? "");
  const code = args[0] || "BRL";
  const locale = ctx.locale || "pt-BR";
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: code }).format(num);
  } catch {
    return `${code} ${num.toFixed(2)}`;
  }
});

// ---- number ----
// Formats numbers. Args: "compact"
registerFormatter("number", (value, args, ctx) => {
  const num = toNumber(value);
  if (num === null) return String(value ?? "");
  const locale = ctx.locale || "pt-BR";

  if (args[0] === "compact") {
    return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(num);
  }
  return new Intl.NumberFormat(locale).format(num);
});

// ---- percent ----
// Formats as percentage.
registerFormatter("percent", (value, args) => {
  const num = toNumber(value);
  if (num === null) return String(value ?? "");
  const decimals = args[0] ? parseInt(args[0]) : 1;
  return `${num.toFixed(decimals)}%`;
});

// ---- truncate ----
// Truncates to N characters.
registerFormatter("truncate", (value, args) => {
  const str = String(value ?? "");
  const max = parseInt(args[0]) || 20;
  if (str.length <= max) return str;
  return str.slice(0, max) + "…";
});

// ---- uppercase ----
registerFormatter("uppercase", (value) => String(value ?? "").toUpperCase());

// ---- lowercase ----
registerFormatter("lowercase", (value) => String(value ?? "").toLowerCase());

// ---- capitalize ----
registerFormatter("capitalize", (value) => {
  const str = String(value ?? "");
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
});

// ---- duration ----
// Formats milliseconds to human readable duration.
registerFormatter("duration", (value) => {
  const ms = toNumber(value);
  if (ms === null) return String(value ?? "");
  return formatDuration(ms);
});

// ---- boolean ----
// Formats boolean values. Args: "trueVal/falseVal" or "icon"
registerFormatter("boolean", (value, args) => {
  const bool = toBool(value);

  if (args[0] === "icon") {
    return { type: "boolean-icon", text: bool ? "✓" : "✕", color: bool ? "success" : "danger" };
  }

  // Handle "Sim/Não" format in a single arg
  if (args.length === 1 && args[0].includes("/")) {
    const [trueVal, falseVal] = args[0].split("/");
    return bool ? trueVal : falseVal;
  }

  if (args.length >= 2) {
    return bool ? args[0] : args[1];
  }

  return bool ? "Sim" : "Não";
});

// ---- icon ----
// Returns a rich icon value.
registerFormatter("icon", (value, _args, ctx) => {
  const str = String(value ?? "");
  // Try iconMap from variable schema
  const icon = resolveIconMap(str, ctx) || str;
  return { type: "icon", text: "", icon };
});

// ---- link ----
// Makes value a clickable link.
registerFormatter("link", (value, args) => {
  const text = String(value ?? "");
  const href = args[0] || "#";
  return { type: "link", text, href };
});

// ---- color ----
// Renders a color swatch.
registerFormatter("color", (value) => {
  const hex = String(value ?? "");
  return { type: "color", text: hex, color: hex };
});

// ---- default ----
// Provides fallback value if original is empty/null/undefined.
registerFormatter("default", (value, args) => {
  if (value == null || value === "" || value === undefined) {
    return args[0] || "—";
  }
  return String(value);
});

// ---- json ----
// Renders as JSON string (useful for debugging).
registerFormatter("json", (value) => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? "");
  }
});

// ---- count ----
// Returns length of arrays.
registerFormatter("count", (value) => {
  if (Array.isArray(value)) return String(value.length);
  return String(value ?? "0");
});

// ---- join ----
// Joins arrays with separator. Args: separator (default: ", ")
registerFormatter("join", (value, args) => {
  if (!Array.isArray(value)) return String(value ?? "");
  const sep = args[0] || ", ";
  return value.join(sep);
});

// ---- first ----
// Returns first element of array.
registerFormatter("first", (value) => {
  if (Array.isArray(value)) return String(value[0] ?? "");
  return String(value ?? "");
});

// ---- last ----
// Returns last element of array.
registerFormatter("last", (value) => {
  if (Array.isArray(value)) return String(value[value.length - 1] ?? "");
  return String(value ?? "");
});

// ============================================================================
// Helpers
// ============================================================================

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = parseFloat(value);
    return isNaN(n) ? null : n;
  }
  return null;
}

function toBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true" || value === "1" || value === "yes";
  if (typeof value === "number") return value !== 0;
  return !!value;
}

function formatRelativeDate(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (seconds < 10) return "agora";
  if (seconds < 60) return `${seconds}s atrás`;
  if (minutes < 60) return `${minutes}m atrás`;
  if (hours < 24) return `${hours}h atrás`;
  if (days < 7) return `${days}d atrás`;
  if (weeks < 5) return `${weeks}sem atrás`;
  if (months < 12) return `${months}mo atrás`;
  return date.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remSeconds = seconds % 60;
  if (minutes < 60) return remSeconds > 0 ? `${minutes}m ${remSeconds}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return remMinutes > 0 ? `${hours}h ${remMinutes}m` : `${hours}h`;
}

/**
 * Resolve color from variable schema colorMap for a given value.
 */
function resolveColorMap(value: string, ctx: FormatterContext): string | undefined {
  if (!ctx.variables || !ctx.entityName || !ctx.fieldName) return undefined;
  const entity = ctx.variables.entities?.[ctx.entityName];
  if (!entity) return undefined;
  const field = entity.fields?.[ctx.fieldName];
  if (!field?.colorMap) return undefined;
  return field.colorMap[value];
}

/**
 * Resolve icon from variable schema iconMap for a given value.
 */
function resolveIconMap(value: string, ctx: FormatterContext): string | undefined {
  if (!ctx.variables || !ctx.entityName || !ctx.fieldName) return undefined;
  const entity = ctx.variables.entities?.[ctx.entityName];
  if (!entity) return undefined;
  const field = entity.fields?.[ctx.fieldName];
  if (!field?.iconMap) return undefined;
  return field.iconMap[value];
}

// ---- Export ----
export { formatters as builtinFormatters };
