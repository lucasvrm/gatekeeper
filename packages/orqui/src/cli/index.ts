// ============================================================================
// P6.1 — Export/Import contracts v2
// P6.2 — Page presets/templates
// P6.4 — CLI commands (orqui init v2, orqui verify v2)
// ============================================================================

import type { LayoutContractV2, NodeDef, PageDefinition } from "../runtime/context/ContractProvider.js";
import { verifyContract } from "../integration/index.js";

// ============================================================================
// P6.1 — Export / Import
// ============================================================================

export interface ExportOptions {
  /** Include tokens in export (default: true) */
  includeTokens?: boolean;
  /** Include text styles (default: true) */
  includeTextStyles?: boolean;
  /** Only export specific pages */
  pages?: string[];
  /** Minify output (default: false) */
  minify?: boolean;
}

/**
 * Export a contract to a JSON string with options.
 */
export function exportContract(contract: LayoutContractV2, options: ExportOptions = {}): string {
  const { includeTokens = true, includeTextStyles = true, pages, minify = false } = options;

  let exported: any = { ...contract };

  // Update metadata
  exported.$orqui = {
    ...exported.$orqui,
    hash: `export_${Date.now().toString(36)}`,
    generatedAt: new Date().toISOString(),
  };

  // Filter pages
  if (pages && pages.length > 0) {
    const filteredPages: Record<string, any> = {};
    for (const pageId of pages) {
      if (exported.pages[pageId]) {
        filteredPages[pageId] = exported.pages[pageId];
      }
    }
    exported.pages = filteredPages;

    // Filter navigation to only include routes for exported pages
    const exportedRoutes = new Set(Object.values(filteredPages).map((p: any) => p.route));
    exported.navigation = exported.navigation.filter(
      (nav: any) => nav.type === "divider" || !nav.route || exportedRoutes.has(nav.route)
    );
  }

  if (!includeTokens) delete exported.tokens;
  if (!includeTextStyles) delete exported.textStyles;

  return JSON.stringify(exported, null, minify ? 0 : 2);
}

/**
 * Import a contract from JSON string with validation.
 */
export function importContract(json: string): { contract: LayoutContractV2 | null; errors: string[] } {
  const errors: string[] = [];

  try {
    const parsed = JSON.parse(json);

    // Validate structure
    if (!parsed.$orqui) errors.push("Missing $orqui metadata");
    if (!parsed.app) errors.push("Missing app config");
    if (!parsed.shell) errors.push("Missing shell config");
    if (!parsed.navigation) errors.push("Missing navigation");
    if (!parsed.pages) errors.push("Missing pages");

    if (errors.length > 0) return { contract: null, errors };

    // Validate pages have content
    for (const [pageId, page] of Object.entries(parsed.pages) as [string, any][]) {
      if (!page.content) errors.push(`Page "${pageId}" is missing content node`);
      if (!page.route) errors.push(`Page "${pageId}" is missing route`);
    }

    if (errors.length > 0) return { contract: null, errors };

    return { contract: parsed as LayoutContractV2, errors: [] };
  } catch (err: any) {
    return { contract: null, errors: [`Invalid JSON: ${err.message}`] };
  }
}

/**
 * Merge an imported contract into an existing one.
 */
export function mergeContracts(
  base: LayoutContractV2,
  incoming: LayoutContractV2,
  strategy: "overwrite" | "merge-pages" | "append-pages" = "merge-pages"
): LayoutContractV2 {
  if (strategy === "overwrite") return incoming;

  const merged = { ...base };

  if (strategy === "merge-pages" || strategy === "append-pages") {
    merged.pages = { ...base.pages };
    for (const [pageId, page] of Object.entries(incoming.pages)) {
      if (strategy === "append-pages" && merged.pages[pageId]) {
        // Rename to avoid conflict
        const newId = `${pageId}_imported`;
        merged.pages[newId] = { ...page, id: newId };
      } else {
        merged.pages[pageId] = page;
      }
    }

    // Merge navigation (add new items)
    const existingNavIds = new Set(merged.navigation.map((n) => n.id));
    for (const nav of incoming.navigation) {
      if (!existingNavIds.has(nav.id)) {
        merged.navigation.push(nav);
      }
    }

    // Merge tokens (incoming wins on conflict)
    if (incoming.tokens) {
      merged.tokens = { ...base.tokens };
      for (const [category, values] of Object.entries(incoming.tokens)) {
        merged.tokens[category] = { ...(merged.tokens[category] || {}), ...values };
      }
    }
  }

  // Update metadata
  merged.$orqui = {
    ...merged.$orqui,
    hash: `merge_${Date.now().toString(36)}`,
    generatedAt: new Date().toISOString(),
  };

  return merged;
}

// ============================================================================
// P6.2 — Page Presets / Templates
// ============================================================================

export interface PagePreset {
  id: string;
  name: string;
  description: string;
  category: "dashboard" | "list" | "detail" | "form" | "settings" | "empty";
  thumbnail?: string;
  page: Omit<PageDefinition, "id" | "route">;
}

export const PAGE_PRESETS: PagePreset[] = [
  {
    id: "dashboard-stats",
    name: "Dashboard com Stats",
    description: "Dashboard com stat cards, tabela recente, e gráfico",
    category: "dashboard",
    page: {
      label: "Dashboard",
      browserTitle: "{{$app.name}} — Dashboard",
      content: {
        id: "preset-dash-root", type: "stack", props: { gap: "$tokens.spacing.lg" },
        children: [
          {
            id: "preset-dash-header", type: "row", props: { justify: "space-between", align: "center" },
            children: [
              { id: "preset-dash-title", type: "heading", props: { content: "Dashboard", level: 1, textStyle: "heading-1" } },
            ],
          },
          {
            id: "preset-dash-stats", type: "grid", props: { columns: 4, gap: "$tokens.spacing.md" },
            children: [
              { id: "preset-stat-1", type: "stat-card", props: { label: "Métrica 1", value: "{{stats.metric_1 | number}}", icon: "ChartLineUp", color: "accent" } },
              { id: "preset-stat-2", type: "stat-card", props: { label: "Métrica 2", value: "{{stats.metric_2 | number}}", icon: "CheckCircle", color: "success" } },
              { id: "preset-stat-3", type: "stat-card", props: { label: "Métrica 3", value: "{{stats.metric_3 | number}}", icon: "XCircle", color: "danger" } },
              { id: "preset-stat-4", type: "stat-card", props: { label: "Métrica 4", value: "{{stats.metric_4 | percent}}", icon: "TrendUp", color: "accent" } },
            ],
          },
          {
            id: "preset-dash-recent", type: "card", props: { title: "Itens Recentes" },
            children: [
              {
                id: "preset-dash-table", type: "table",
                props: {
                  dataSource: "items", rowHeight: 48, emptyMessage: "Nenhum item recente",
                  columns: [
                    { key: "id", label: "ID", width: "120px", content: "{{item.id | truncate:8}}" },
                    { key: "status", label: "Status", width: "100px", content: "{{item.status | badge}}" },
                    { key: "name", label: "Nome", content: "{{item.name}}" },
                    { key: "date", label: "Data", width: "100px", content: "{{item.created_at | date:relative}}", align: "right" },
                  ],
                },
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "list-standard",
    name: "Lista Padrão",
    description: "Página de listagem com filtros, busca, e tabela",
    category: "list",
    page: {
      label: "Listagem",
      browserTitle: "{{$app.name}} — Listagem",
      content: {
        id: "preset-list-root", type: "stack", props: { gap: "$tokens.spacing.lg" },
        children: [
          {
            id: "preset-list-header", type: "row", props: { justify: "space-between", align: "center" },
            children: [
              { id: "preset-list-title", type: "heading", props: { content: "Listagem", level: 1, textStyle: "heading-1" } },
              {
                id: "preset-list-filters", type: "row", props: { gap: "$tokens.spacing.sm" },
                children: [
                  { id: "preset-list-search", type: "search", props: { placeholder: "Buscar..." } },
                  { id: "preset-list-select", type: "select", props: { placeholder: "Filtrar por..." } },
                ],
              },
            ],
          },
          {
            id: "preset-list-card", type: "card",
            children: [
              {
                id: "preset-list-table", type: "table",
                props: {
                  dataSource: "items", rowHeight: 48, emptyMessage: "Nenhum resultado",
                  columns: [
                    { key: "id", label: "ID", width: "120px", content: "{{item.id}}", link: "/items/{{item.id}}" },
                    { key: "name", label: "Nome", content: "{{item.name}}" },
                    { key: "status", label: "Status", width: "100px", content: "{{item.status | badge}}" },
                    { key: "date", label: "Data", width: "120px", content: "{{item.created_at | date:relative}}", align: "right" },
                    { key: "actions", label: "", width: "80px", content: "{{$actions: view, edit, delete}}", align: "right" },
                  ],
                },
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "detail-tabs",
    name: "Detalhe com Tabs",
    description: "Página de detalhe com header, key-values, e tabs",
    category: "detail",
    page: {
      label: "Detalhe",
      browserTitle: "{{$app.name}} — Detalhe",
      content: {
        id: "preset-detail-root", type: "stack", props: { gap: "$tokens.spacing.lg" },
        children: [
          {
            id: "preset-detail-header", type: "row", props: { justify: "space-between", align: "center" },
            children: [
              {
                id: "preset-detail-title-group", type: "row", props: { gap: "$tokens.spacing.sm", align: "center" },
                children: [
                  { id: "preset-detail-title", type: "heading", props: { content: "{{item.name}}", level: 1, textStyle: "heading-1" } },
                  { id: "preset-detail-badge", type: "badge", props: { content: "{{item.status | badge}}" } },
                ],
              },
              { id: "preset-detail-btn", type: "button", props: { label: "Editar", variant: "outline", icon: "PencilSimple" } },
            ],
          },
          {
            id: "preset-detail-overview", type: "card", props: { title: "Visão Geral" },
            children: [
              {
                id: "preset-detail-kv", type: "key-value",
                props: {
                  layout: "horizontal",
                  items: [
                    { label: "ID", value: "{{item.id}}" },
                    { label: "Criado em", value: "{{item.created_at | date:full}}" },
                    { label: "Atualizado em", value: "{{item.updated_at | date:relative}}" },
                  ],
                },
              },
            ],
          },
          {
            id: "preset-detail-tabs", type: "tabs",
            props: { defaultTab: "info", items: [{ id: "info", label: "Informações" }, { id: "history", label: "Histórico" }] },
            children: [],
          },
        ],
      },
    },
  },
  {
    id: "settings-page",
    name: "Página de Settings",
    description: "Configurações com tabs e key-values",
    category: "settings",
    page: {
      label: "Configuração",
      browserTitle: "{{$app.name}} — Configuração",
      content: {
        id: "preset-settings-root", type: "stack", props: { gap: "$tokens.spacing.lg" },
        children: [
          { id: "preset-settings-title", type: "heading", props: { content: "Configuração", level: 1, textStyle: "heading-1" } },
          {
            id: "preset-settings-tabs", type: "tabs",
            props: { defaultTab: "general", items: [{ id: "general", label: "Geral" }, { id: "advanced", label: "Avançado" }] },
            children: [
              {
                id: "preset-settings-general", type: "card", props: { tab: "general", title: "Geral" },
                children: [
                  {
                    id: "preset-settings-kv", type: "key-value",
                    props: { layout: "vertical", items: [{ label: "Config 1", value: "Valor 1" }, { label: "Config 2", value: "Valor 2" }] },
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "empty-page",
    name: "Página Vazia",
    description: "Página em branco com título",
    category: "empty",
    page: {
      label: "Nova Página",
      browserTitle: "{{$app.name}} — Nova Página",
      content: {
        id: "preset-empty-root", type: "stack", props: { gap: "$tokens.spacing.lg" },
        children: [
          { id: "preset-empty-title", type: "heading", props: { content: "Nova Página", level: 1, textStyle: "heading-1" } },
        ],
      },
    },
  },
];

/**
 * Create a page from a preset, generating unique IDs.
 */
export function createPageFromPreset(presetId: string, pageId: string, route: string): PageDefinition | null {
  const preset = PAGE_PRESETS.find((p) => p.id === presetId);
  if (!preset) return null;

  const page: PageDefinition = {
    ...preset.page,
    id: pageId,
    route,
    content: rewriteIds(preset.page.content, pageId),
  };

  return page;
}

function rewriteIds(node: NodeDef, prefix: string): NodeDef {
  const newId = node.id.startsWith("preset-")
    ? node.id.replace("preset-", `${prefix}-`)
    : `${prefix}-${node.id}`;

  return {
    ...node,
    id: newId,
    children: node.children?.map((child) => rewriteIds(child, prefix)),
  };
}

// ============================================================================
// P6.3 — Variable Schema Documentation Generator
// ============================================================================

export function generateSchemaDocumentation(variables: Record<string, any>): string {
  const lines: string[] = [];
  lines.push("# Orqui Variable Schema\n");
  lines.push(`> Auto-generated documentation for the variable schema.\n`);

  // Entities
  const entities = variables.entities || {};
  lines.push("## Entities\n");

  for (const [name, entity] of Object.entries(entities) as [string, any][]) {
    lines.push(`### ${entity.label} (\`${name}\`)\n`);
    if (entity.description) lines.push(`${entity.description}\n`);
    lines.push("| Field | Type | Label | Example | Template |");
    lines.push("|-------|------|-------|---------|----------|");

    for (const [fieldName, field] of Object.entries(entity.fields || {}) as [string, any][]) {
      const example = field.example !== undefined ? `\`${JSON.stringify(field.example)}\`` : "—";
      const template = `\`{{${name}.${fieldName}}}\``;
      let typeStr = field.type;
      if (field.type === "enum") typeStr = `enum(${(field.enum || []).join(", ")})`;
      if (field.type === "ref") typeStr = `ref → ${field.entity}`;
      lines.push(`| ${fieldName} | ${typeStr} | ${field.label} | ${example} | ${template} |`);
    }
    lines.push("");
  }

  // Globals
  const globals = variables.globals || {};
  lines.push("## Globals\n");

  for (const [namespace, fields] of Object.entries(globals) as [string, any][]) {
    lines.push(`### ${namespace}\n`);
    lines.push("| Field | Type | Label | Example | Template |");
    lines.push("|-------|------|-------|---------|----------|");

    for (const [fieldName, field] of Object.entries(fields) as [string, any][]) {
      const example = field.example !== undefined ? `\`${JSON.stringify(field.example)}\`` : "—";
      lines.push(`| ${fieldName} | ${field.type} | ${field.label} | ${example} | \`{{${namespace}.${fieldName}}}\` |`);
    }
    lines.push("");
  }

  // Enums
  const enums = variables.enums || {};
  if (Object.keys(enums).length > 0) {
    lines.push("## Enums\n");
    for (const [name, enumDef] of Object.entries(enums) as [string, any][]) {
      lines.push(`### ${name}\n`);
      lines.push(`Values: ${(enumDef.values || []).map((v: string) => `\`${v}\``).join(", ")}\n`);
      if (enumDef.colorMap) {
        lines.push("| Value | Color |");
        lines.push("|-------|-------|");
        for (const [val, color] of Object.entries(enumDef.colorMap)) {
          lines.push(`| ${val} | ${color} |`);
        }
        lines.push("");
      }
    }
  }

  // Formatters reference
  lines.push("## Available Formatters\n");
  lines.push("| Formatter | Args | Description | Example |");
  lines.push("|-----------|------|-------------|---------|");
  lines.push("| `badge` | — | Colored badge from colorMap | `{{status \\| badge}}` |");
  lines.push("| `date:relative` | — | Relative time | `{{created_at \\| date:relative}}` → `5m atrás` |");
  lines.push("| `date:short` | — | Short date | `{{created_at \\| date:short}}` → `15 fev` |");
  lines.push("| `date:full` | — | Full date | `{{created_at \\| date:full}}` → `15 de fevereiro` |");
  lines.push("| `number` | — | Formatted number | `{{count \\| number}}` → `1.234` |");
  lines.push("| `number:compact` | — | Compact number | `{{count \\| number:compact}}` → `1.2K` |");
  lines.push("| `currency:BRL` | code | Currency | `{{price \\| currency:BRL}}` → `R$ 1.234,56` |");
  lines.push("| `percent` | — | Percentage | `{{rate \\| percent}}` → `83.1%` |");
  lines.push("| `duration` | — | Duration from ms | `{{duration \\| duration}}` → `2m 34s` |");
  lines.push("| `truncate:N` | length | Truncate text | `{{id \\| truncate:8}}` → `abc123…` |");
  lines.push("| `boolean:X/Y` | labels | Custom boolean | `{{active \\| boolean:Sim/Não}}` |");
  lines.push("| `boolean:icon` | — | Icon boolean | `{{active \\| boolean:icon}}` → ✓/✕ |");
  lines.push("| `count` | — | Array length | `{{items \\| count}}` → `5` |");
  lines.push("| `join:sep` | separator | Join array | `{{tags \\| join:, }}` |");
  lines.push("| `default:val` | fallback | Fallback value | `{{name \\| default:—}}` |");
  lines.push("");

  return lines.join("\n");
}

// ============================================================================
// P6.4 — CLI Commands (can be used with Node.js)
// ============================================================================

export interface CLIContext {
  cwd: string;
  readFile: (path: string) => string;
  writeFile: (path: string, content: string) => void;
  exists: (path: string) => boolean;
  log: (msg: string) => void;
  error: (msg: string) => void;
}

/**
 * `orqui init v2` — scaffold a new project with contract + variables
 */
export function cliInit(ctx: CLIContext, projectName: string) {
  ctx.log(`Initializing Orqui v2 project: ${projectName}\n`);

  // Create variable schema
  const variablesPath = `${ctx.cwd}/orqui.variables.json`;
  if (!ctx.exists(variablesPath)) {
    const schema = {
      $schema: "orqui-variables/v2",
      project: projectName,
      version: "1.0.0",
      entities: {
        item: {
          label: "Item",
          plural: "items",
          fields: {
            id: { type: "string", label: "ID", example: "item_001" },
            name: { type: "string", label: "Nome", example: "Meu Item" },
            status: {
              type: "enum", label: "Status",
              enum: ["active", "inactive"],
              colorMap: { active: "success", inactive: "text-dim" },
            },
            created_at: { type: "date", label: "Criado em", example: "2026-01-01T00:00:00Z" },
          },
        },
      },
      globals: {
        stats: { total_items: { type: "number", label: "Total Items", example: 0 } },
        user: { name: { type: "string", label: "Nome", example: "User" }, role: { type: "enum", label: "Role", enum: ["admin", "viewer"], example: "admin" } },
      },
    };
    ctx.writeFile(variablesPath, JSON.stringify(schema, null, 2));
    ctx.log(`  ✓ Created ${variablesPath}`);
  }

  // Create layout contract
  const contractDir = `${ctx.cwd}/contracts`;
  const contractPath = `${contractDir}/layout-contract.json`;
  if (!ctx.exists(contractPath)) {
    const preset = createPageFromPreset("dashboard-stats", "dashboard", "/");
    const contract = {
      $orqui: { schema: "layout-contract/v2", version: "2.0.0", hash: `init_${Date.now().toString(36)}`, generatedAt: new Date().toISOString() },
      app: { name: projectName, logo: { type: "text", text: projectName } },
      tokens: DEFAULT_TOKENS,
      textStyles: DEFAULT_TEXT_STYLES,
      shell: DEFAULT_SHELL,
      navigation: [
        { id: "dashboard", label: "Dashboard", icon: "House", route: "/", order: 0 },
      ],
      pages: { dashboard: preset },
    };
    ctx.writeFile(contractPath, JSON.stringify(contract, null, 2));
    ctx.log(`  ✓ Created ${contractPath}`);
  }

  ctx.log(`\n  Done! Run your app and visit /__orqui to open the editor.\n`);
}

/**
 * `orqui verify v2` — validate contract against variables
 */
export function cliVerify(ctx: CLIContext) {
  const contractPath = `${ctx.cwd}/contracts/layout-contract.json`;
  const variablesPath = `${ctx.cwd}/orqui.variables.json`;

  if (!ctx.exists(contractPath)) {
    ctx.error(`Contract not found: ${contractPath}`);
    return false;
  }
  if (!ctx.exists(variablesPath)) {
    ctx.error(`Variables not found: ${variablesPath}`);
    return false;
  }

  const contract = JSON.parse(ctx.readFile(contractPath));
  const variables = JSON.parse(ctx.readFile(variablesPath));
  const result = verifyContract(contract, variables);

  ctx.log(`\n  Orqui Contract Verification\n`);
  ctx.log(`  Pages: ${result.stats.pages} | Nodes: ${result.stats.nodes} | Templates: ${result.stats.templates} | Nav: ${result.stats.navItems}\n`);

  if (result.errors.length > 0) {
    ctx.error(`\n  ${result.errors.length} error(s):\n`);
    for (const err of result.errors) {
      ctx.error(`    ✕ [${err.type}] ${err.path}: ${err.message}`);
    }
  }

  if (result.warnings.length > 0) {
    ctx.log(`\n  ${result.warnings.length} warning(s):\n`);
    for (const warn of result.warnings) {
      ctx.log(`    ⚠ [${warn.type}] ${warn.path}: ${warn.message}`);
    }
  }

  if (result.valid) {
    ctx.log(`\n  ✓ Contract is valid!\n`);
  } else {
    ctx.error(`\n  ✕ Contract has errors.\n`);
  }

  return result.valid;
}

/**
 * `orqui docs` — generate schema documentation
 */
export function cliDocs(ctx: CLIContext) {
  const variablesPath = `${ctx.cwd}/orqui.variables.json`;

  if (!ctx.exists(variablesPath)) {
    ctx.error(`Variables not found: ${variablesPath}`);
    return;
  }

  const variables = JSON.parse(ctx.readFile(variablesPath));
  const docs = generateSchemaDocumentation(variables);
  const docsPath = `${ctx.cwd}/docs/variable-schema.md`;
  ctx.writeFile(docsPath, docs);
  ctx.log(`  ✓ Generated ${docsPath}`);
}

// ============================================================================
// Default scaffolding values
// ============================================================================

const DEFAULT_TOKENS = {
  colors: {
    bg: { value: "#0a0a0b" }, surface: { value: "#141417" },
    "surface-2": { value: "#1c1c21" }, "surface-3": { value: "#24242b" },
    border: { value: "#2a2a33" }, text: { value: "#e4e4e7" },
    "text-muted": { value: "#8b8b96" }, "text-dim": { value: "#5b5b66" },
    accent: { value: "#6d9cff" }, success: { value: "#4ade80" },
    danger: { value: "#ff6b6b" }, warning: { value: "#fbbf24" },
  },
  spacing: {
    xs: { value: 4, unit: "px" }, sm: { value: 8, unit: "px" },
    md: { value: 16, unit: "px" }, lg: { value: 24, unit: "px" },
    xl: { value: 32, unit: "px" },
  },
  borderRadius: {
    sm: { value: 4, unit: "px" }, md: { value: 6, unit: "px" },
    lg: { value: 8, unit: "px" },
  },
  fontFamilies: { primary: { value: "Inter, -apple-system, sans-serif" }, mono: { value: "JetBrains Mono, monospace" } },
  fontSizes: {
    xs: { value: 11, unit: "px" }, sm: { value: 12, unit: "px" },
    md: { value: 14, unit: "px" }, lg: { value: 16, unit: "px" },
    xl: { value: 20, unit: "px" }, "2xl": { value: 28, unit: "px" },
  },
};

const DEFAULT_TEXT_STYLES = {
  "heading-1": { fontSize: "$tokens.fontSizes.2xl", fontWeight: 700, lineHeight: 1.2 },
  "heading-2": { fontSize: "$tokens.fontSizes.xl", fontWeight: 600, lineHeight: 1.3 },
  "heading-3": { fontSize: "$tokens.fontSizes.lg", fontWeight: 600, lineHeight: 1.4 },
  body: { fontSize: "$tokens.fontSizes.md", fontWeight: 400, lineHeight: 1.5 },
  "body-sm": { fontSize: "$tokens.fontSizes.sm", fontWeight: 400, lineHeight: 1.5 },
  caption: { fontSize: "$tokens.fontSizes.xs", fontWeight: 500, lineHeight: 1.4 },
};

const DEFAULT_SHELL = {
  layout: "sidebar-left",
  sidebar: {
    width: 260, collapsedWidth: 64, collapsible: true,
    sections: [
      { id: "logo", type: "logo" },
      { id: "nav", type: "navigation" },
    ],
    separators: { afterLogo: { enabled: true } },
  },
  header: {
    height: 56,
    left: [{ id: "breadcrumbs", type: "breadcrumbs", props: { homeLabel: "Home" } }],
    center: [],
    right: [],
  },
};
