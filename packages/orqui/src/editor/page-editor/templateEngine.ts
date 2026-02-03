// ============================================================================
// Template Engine — parse and resolve {{entity.field | pipe:arg}} expressions
// ============================================================================

// ---- Types ----

export interface TemplateToken {
  type: "text" | "expression";
  raw: string;
  // For expressions:
  path?: string;         // e.g. "run.status"
  pipes?: PipeDef[];     // e.g. [{ name: "badge" }, { name: "truncate", args: ["8"] }]
}

interface PipeDef {
  name: string;
  args: string[];
}

// ---- Regex ----

const EXPR_RE = /\{\{(.+?)\}\}/g;

// ---- Parse ----

/** Parse a string into a list of text and expression tokens */
export function parseTemplate(input: string): TemplateToken[] {
  if (!input || typeof input !== "string") return [{ type: "text", raw: input ?? "" }];

  const tokens: TemplateToken[] = [];
  let lastIndex = 0;

  for (const match of input.matchAll(EXPR_RE)) {
    // Text before this expression
    if (match.index! > lastIndex) {
      tokens.push({ type: "text", raw: input.slice(lastIndex, match.index!) });
    }

    const inner = match[1].trim();
    const parts = inner.split("|").map(s => s.trim());
    const path = parts[0];
    const pipes: PipeDef[] = parts.slice(1).map(parsePipe);

    tokens.push({
      type: "expression",
      raw: match[0],
      path,
      pipes,
    });

    lastIndex = match.index! + match[0].length;
  }

  // Trailing text
  if (lastIndex < input.length) {
    tokens.push({ type: "text", raw: input.slice(lastIndex) });
  }

  return tokens.length === 0 ? [{ type: "text", raw: input }] : tokens;
}

function parsePipe(raw: string): PipeDef {
  const colonIndex = raw.indexOf(":");
  if (colonIndex === -1) return { name: raw, args: [] };
  return {
    name: raw.slice(0, colonIndex).trim(),
    args: raw.slice(colonIndex + 1).split(",").map(s => s.trim()),
  };
}

/** Check if a string contains any template expressions */
export function hasTemplateExpr(input: string): boolean {
  return typeof input === "string" && EXPR_RE.test(input);
}

// ---- Resolve ----

/** Resolve a dotted path against a data object */
function resolvePath(data: Record<string, any>, path: string): any {
  // Special prefixes
  if (path.startsWith("$app.")) return resolvePath(data.$app || {}, path.slice(5));
  if (path.startsWith("$page.")) return resolvePath(data.$page || {}, path.slice(6));
  if (path.startsWith("$enum.")) return resolvePath(data.$enum || {}, path.slice(6));

  const parts = path.split(".");
  let current: any = data;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

/** Apply a pipe/formatter to a value */
function applyPipe(value: any, pipe: PipeDef): any {
  const str = String(value ?? "");
  switch (pipe.name) {
    // Text formatters
    case "uppercase": return str.toUpperCase();
    case "lowercase": return str.toLowerCase();
    case "capitalize": return str.charAt(0).toUpperCase() + str.slice(1);
    case "truncate": {
      const max = parseInt(pipe.args[0]) || 20;
      return str.length > max ? str.slice(0, max) + "…" : str;
    }
    case "trim": return str.trim();

    // Number formatters
    case "number": {
      const n = Number(value);
      if (isNaN(n)) return str;
      if (pipe.args[0] === "compact") {
        if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
        if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
        return String(n);
      }
      const decimals = parseInt(pipe.args[0]) || 0;
      return n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    }
    case "currency": {
      const n = Number(value);
      if (isNaN(n)) return str;
      const curr = pipe.args[0] || "BRL";
      return n.toLocaleString("pt-BR", { style: "currency", currency: curr });
    }
    case "percent": {
      const n = Number(value);
      if (isNaN(n)) return str;
      const decimals = parseInt(pipe.args[0]) || 1;
      return (n * 100).toFixed(decimals) + "%";
    }

    // Date formatters
    case "date": {
      const d = new Date(value);
      if (isNaN(d.getTime())) return str;
      const fmt = pipe.args[0] || "short";
      if (fmt === "short") return d.toLocaleDateString("pt-BR");
      if (fmt === "long") return d.toLocaleDateString("pt-BR", { year: "numeric", month: "long", day: "numeric" });
      if (fmt === "iso") return d.toISOString().slice(0, 10);
      if (fmt === "relative") return relativeTime(d);
      return d.toLocaleDateString("pt-BR");
    }
    case "time": {
      const d = new Date(value);
      if (isNaN(d.getTime())) return str;
      return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    }
    case "datetime": {
      const d = new Date(value);
      if (isNaN(d.getTime())) return str;
      return d.toLocaleString("pt-BR");
    }

    // Duration formatter (ms to human)
    case "duration": {
      const ms = Number(value);
      if (isNaN(ms)) return str;
      if (ms < 1000) return `${ms}ms`;
      if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
      if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
      return `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;
    }

    // Display formatters
    case "badge": return value; // badge is a display hint, resolved by renderer
    case "default": return value ?? (pipe.args[0] || "—");
    case "prefix": return (pipe.args[0] || "") + str;
    case "suffix": return str + (pipe.args[0] || "");
    case "json": return JSON.stringify(value, null, 2);

    // Fallback
    default: return value;
  }
}

function relativeTime(d: Date): string {
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d atrás`;
  return d.toLocaleDateString("pt-BR");
}

/** Resolve a full template string against data, returning the final string */
export function resolveTemplate(template: string, data: Record<string, any>): string {
  const tokens = parseTemplate(template);
  return tokens.map(token => {
    if (token.type === "text") return token.raw;
    // Expression
    let value = resolvePath(data, token.path!);
    if (token.pipes) {
      for (const pipe of token.pipes) {
        value = applyPipe(value, pipe);
      }
    }
    return value ?? "";
  }).join("");
}

/** Check if any pipe in the expression is a display hint (like badge) */
export function getDisplayHint(template: string): string | null {
  const tokens = parseTemplate(template);
  for (const token of tokens) {
    if (token.type === "expression" && token.pipes) {
      for (const pipe of token.pipes) {
        if (pipe.name === "badge") return "badge";
      }
    }
  }
  return null;
}

// ---- Formatter catalog (for UI) ----

export interface FormatterInfo {
  name: string;
  label: string;
  description: string;
  category: string;
  args?: string;
  example: string;
}

export const FORMATTERS: FormatterInfo[] = [
  // Text
  { name: "uppercase", label: "Maiúsculas", description: "Converte para maiúsculas", category: "texto", example: "{{name | uppercase}} → NOME" },
  { name: "lowercase", label: "Minúsculas", description: "Converte para minúsculas", category: "texto", example: "{{name | lowercase}} → nome" },
  { name: "capitalize", label: "Capitalizar", description: "Primeira letra maiúscula", category: "texto", example: "{{name | capitalize}} → Nome" },
  { name: "truncate", label: "Truncar", description: "Limita o tamanho do texto", category: "texto", args: "max", example: "{{desc | truncate:20}}" },
  { name: "trim", label: "Trim", description: "Remove espaços nas pontas", category: "texto", example: "{{text | trim}}" },
  // Numbers
  { name: "number", label: "Número", description: "Formata número", category: "número", args: "decimais|compact", example: "{{total | number:compact}} → 1.2K" },
  { name: "currency", label: "Moeda", description: "Formata como moeda", category: "número", args: "código", example: "{{price | currency:BRL}} → R$ 1.234,00" },
  { name: "percent", label: "Porcentagem", description: "Multiplica por 100 e adiciona %", category: "número", args: "decimais", example: "{{rate | percent:1}} → 94.2%" },
  // Date
  { name: "date", label: "Data", description: "Formata data", category: "data", args: "short|long|iso|relative", example: "{{created | date:relative}} → 3d atrás" },
  { name: "time", label: "Hora", description: "Formata hora", category: "data", example: "{{created | time}} → 14:30" },
  { name: "datetime", label: "Data e Hora", description: "Formata data completa", category: "data", example: "{{created | datetime}}" },
  { name: "duration", label: "Duração", description: "Converte ms para humano", category: "data", example: "{{elapsed | duration}} → 3m 12s" },
  // Display
  { name: "badge", label: "Badge", description: "Exibe como badge colorido", category: "display", example: "{{status | badge}}" },
  { name: "default", label: "Padrão", description: "Valor fallback se vazio", category: "display", args: "valor", example: "{{name | default:N/A}}" },
  { name: "prefix", label: "Prefixo", description: "Adiciona texto antes", category: "display", args: "texto", example: "{{id | prefix:#}}" },
  { name: "suffix", label: "Sufixo", description: "Adiciona texto depois", category: "display", args: "texto", example: "{{count | suffix: itens}}" },
];

export const FORMATTER_CATEGORIES = [
  { id: "texto", label: "Texto" },
  { id: "número", label: "Número" },
  { id: "data", label: "Data/Tempo" },
  { id: "display", label: "Display" },
];
