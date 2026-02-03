// ============================================================================
// P5.3 — MigrationBridge: drop-in replacement for AppShell v1
// Wraps the new v2 runtime to maintain backward compatibility
// ============================================================================

import React, { useEffect, useState, type ReactNode } from "react";
import {
  ContractProvider,
  AppShell,
  PageRenderer,
  generateBaseCSS,
} from "../runtime/index.js";
import type { LayoutContractV2 } from "../runtime/context/ContractProvider.js";
import type { DataContext } from "../engine/resolver.js";

export interface MigrationBridgeProps {
  /** Path to the layout contract JSON */
  contractPath?: string;
  /** Or pass the contract directly */
  contract?: LayoutContractV2;
  /** Path to variables JSON */
  variablesPath?: string;
  /** Or pass variables directly */
  variables?: Record<string, any>;
  /** Current route (from your router) */
  currentRoute: string;
  /** Route-to-page mapping */
  routeMap: Record<string, string>;
  /** Global data (stats, user, features) */
  globalData?: DataContext;
  /** Page-specific data by page ID */
  pageData?: Record<string, DataContext>;
  /** Named slots by page ID */
  slots?: Record<string, Record<string, ReactNode>>;
  /** Navigation handler */
  onNavigate: (route: string) => void;
  /** Row action handler */
  onAction?: (action: string, item: unknown) => void;
  /** Icon resolver */
  renderIcon?: (name: string, size?: number) => ReactNode;
  /** Locale */
  locale?: string;
  children?: ReactNode;
}

export function MigrationBridge({
  contractPath,
  contract: contractProp,
  variablesPath,
  variables: variablesProp,
  currentRoute,
  routeMap,
  globalData = {},
  pageData = {},
  slots = {},
  onNavigate,
  onAction,
  renderIcon,
  locale = "pt-BR",
  children,
}: MigrationBridgeProps) {
  const [contract, setContract] = useState<LayoutContractV2 | null>(contractProp || null);
  const [variables, setVariables] = useState<Record<string, any>>(variablesProp || {});
  const [loading, setLoading] = useState(!contractProp);

  // Load contract from path if not provided directly
  useEffect(() => {
    if (contractProp) {
      setContract(contractProp);
      return;
    }
    if (contractPath) {
      fetch(contractPath)
        .then((r) => r.json())
        .then((data) => {
          setContract(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error("[Orqui MigrationBridge] Failed to load contract:", err);
          setLoading(false);
        });
    }
  }, [contractPath, contractProp]);

  // Load variables from path if not provided directly
  useEffect(() => {
    if (variablesProp) {
      setVariables(variablesProp);
      return;
    }
    if (variablesPath) {
      fetch(variablesPath)
        .then((r) => r.json())
        .then(setVariables)
        .catch((err) => console.error("[Orqui MigrationBridge] Failed to load variables:", err));
    }
  }, [variablesPath, variablesProp]);

  // Inject CSS tokens
  useEffect(() => {
    if (!contract) return;
    const style = document.createElement("style");
    style.id = "orqui-tokens";
    style.textContent = generateBaseCSS(contract.tokens);
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById("orqui-tokens");
      if (el) document.head.removeChild(el);
    };
  }, [contract]);

  if (loading || !contract) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "#8b8b96" }}>
        Carregando layout...
      </div>
    );
  }

  const currentPage = routeMap[currentRoute] || Object.keys(contract.pages)[0] || "dashboard";
  const currentPageData = pageData[currentPage] || {};
  const currentSlots = slots[currentPage] || {};

  return (
    <ContractProvider
      layout={contract}
      variables={variables}
      initialPage={currentPage}
      initialData={globalData}
      locale={locale}
    >
      <AppShell
        data={globalData}
        onNavigate={onNavigate}
        renderIcon={renderIcon}
      >
        <PageRenderer
          page={currentPage}
          data={currentPageData}
          slots={currentSlots}
          onAction={onAction}
          onNavigate={onNavigate}
        />
        {children}
      </AppShell>
    </ContractProvider>
  );
}

// ============================================================================
// P5.4 — Vite Plugin: serves the Orqui editor in dev mode
// ============================================================================

export interface OrquiVitePluginOptions {
  /** Path to the layout contract JSON */
  contractPath?: string;
  /** Path to the variables JSON */
  variablesPath?: string;
  /** Route where the editor is served (default: /__orqui) */
  editorRoute?: string;
  /** Enable/disable the editor (default: true in dev) */
  enabled?: boolean;
}

/**
 * Vite plugin that serves the Orqui editor at a dev route.
 *
 * Usage in vite.config.ts:
 * ```ts
 * import { orquiVitePlugin } from "@orqui/core/integration";
 *
 * export default defineConfig({
 *   plugins: [
 *     orquiVitePlugin({
 *       contractPath: "./contracts/layout-contract.json",
 *       variablesPath: "./orqui.variables.json",
 *     }),
 *   ],
 * });
 * ```
 */
export function orquiVitePlugin(options: OrquiVitePluginOptions = {}) {
  const {
    contractPath = "./contracts/layout-contract.json",
    variablesPath = "./orqui.variables.json",
    editorRoute = "/__orqui",
    enabled = true,
  } = options;

  return {
    name: "orqui-editor",
    apply: "serve" as const,

    configureServer(server: any) {
      if (!enabled) return;

      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url === editorRoute || req.url === `${editorRoute}/`) {
          res.setHeader("Content-Type", "text/html");
          res.end(generateEditorHTML(contractPath, variablesPath, editorRoute));
          return;
        }

        // Serve contract/variables as API endpoints
        if (req.url === `${editorRoute}/api/contract`) {
          const fs = require("fs");
          const path = require("path");
          try {
            const filePath = path.resolve(process.cwd(), contractPath);
            const content = fs.readFileSync(filePath, "utf8");
            res.setHeader("Content-Type", "application/json");
            res.end(content);
          } catch (err) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: "Contract not found" }));
          }
          return;
        }

        if (req.url === `${editorRoute}/api/variables`) {
          const fs = require("fs");
          const path = require("path");
          try {
            const filePath = path.resolve(process.cwd(), variablesPath);
            const content = fs.readFileSync(filePath, "utf8");
            res.setHeader("Content-Type", "application/json");
            res.end(content);
          } catch (err) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: "Variables not found" }));
          }
          return;
        }

        // Save contract (POST)
        if (req.url === `${editorRoute}/api/save` && req.method === "POST") {
          const fs = require("fs");
          const path = require("path");
          let body = "";
          req.on("data", (chunk: string) => { body += chunk; });
          req.on("end", () => {
            try {
              const contract = JSON.parse(body);
              // Update hash and timestamp
              contract.$orqui.hash = `gk_${Date.now().toString(36)}`;
              contract.$orqui.generatedAt = new Date().toISOString();
              const filePath = path.resolve(process.cwd(), contractPath);
              fs.writeFileSync(filePath, JSON.stringify(contract, null, 2));
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: true, hash: contract.$orqui.hash }));
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        next();
      });

      // Log editor URL
      const { green, dim } = { green: (s: string) => `\x1b[32m${s}\x1b[0m`, dim: (s: string) => `\x1b[2m${s}\x1b[0m` };
      server.httpServer?.once("listening", () => {
        const addr = server.httpServer.address();
        const url = typeof addr === "string" ? addr : `http://localhost:${addr?.port}`;
        console.log(`\n  ${green("➜")}  ${dim("Orqui Editor:")}  ${url}${editorRoute}\n`);
      });
    },
  };
}

function generateEditorHTML(contractPath: string, variablesPath: string, editorRoute: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Orqui Editor</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #root { height: 100%; }
    body {
      font-family: Inter, -apple-system, sans-serif;
      background: #0a0a0b;
      color: #e4e4e7;
      -webkit-font-smoothing: antialiased;
    }
    #loading {
      display: flex; align-items: center; justify-content: center; height: 100vh;
      font-size: 14px; color: #5b5b66; gap: 8px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .spinner { width: 16px; height: 16px; border: 2px solid #2a2a33; border-top-color: #6d9cff; border-radius: 50%; animation: spin 0.6s linear infinite; }
  </style>
</head>
<body>
  <div id="root">
    <div id="loading"><div class="spinner"></div>Carregando editor...</div>
  </div>
  <script type="module">
    // The Orqui Editor is served via Vite's module system
    // In production, this would be a pre-built bundle
    import { OrquiEditor } from "@orqui/core/editor";
    import React from "react";
    import ReactDOM from "react-dom/client";

    async function init() {
      const [contractRes, variablesRes] = await Promise.all([
        fetch("${editorRoute}/api/contract"),
        fetch("${editorRoute}/api/variables"),
      ]);

      const contract = await contractRes.json();
      const variables = await variablesRes.json();

      const root = ReactDOM.createRoot(document.getElementById("root"));
      root.render(
        React.createElement(OrquiEditor, {
          contract,
          variables,
          onSave: async (updated) => {
            const res = await fetch("${editorRoute}/api/save", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(updated),
            });
            const result = await res.json();
            if (result.ok) console.log("[Orqui] Contract saved:", result.hash);
          },
          onExport: (contract) => {
            const blob = new Blob([JSON.stringify(contract, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = "layout-contract.json"; a.click();
            URL.revokeObjectURL(url);
          },
        })
      );
    }

    init().catch((err) => {
      document.getElementById("loading").innerHTML = "Erro: " + err.message;
    });
  </script>
</body>
</html>`;
}

// ============================================================================
// P5.5 — Contract Verifier: validates a contract against the variable schema
// ============================================================================

export interface VerificationResult {
  valid: boolean;
  errors: VerificationError[];
  warnings: VerificationWarning[];
  stats: { pages: number; nodes: number; templates: number; navItems: number };
}

export interface VerificationError {
  type: "missing-entity" | "missing-field" | "invalid-formatter" | "missing-page" | "broken-ref";
  path: string;
  message: string;
}

export interface VerificationWarning {
  type: "unused-variable" | "empty-content" | "missing-empty-message";
  path: string;
  message: string;
}

export function verifyContract(
  contract: LayoutContractV2,
  variables: Record<string, any>
): VerificationResult {
  const errors: VerificationError[] = [];
  const warnings: VerificationWarning[] = [];
  let nodeCount = 0;
  let templateCount = 0;

  const entities = variables.entities || {};
  const globals = variables.globals || {};
  const templateRegex = /\{\{([^}]+)\}\}/g;

  // Validate template expression
  function checkTemplate(template: string, context: string) {
    let match;
    while ((match = templateRegex.exec(template)) !== null) {
      templateCount++;
      const expr = match[1].trim();
      const pipeIdx = expr.indexOf("|");
      const path = (pipeIdx > -1 ? expr.slice(0, pipeIdx) : expr).trim();

      // Skip special prefixes
      if (path.startsWith("$")) continue;

      const parts = path.split(".");
      if (parts.length >= 2) {
        const [ns, field] = parts;
        // Check entities
        if (entities[ns]) {
          if (!entities[ns].fields?.[field]) {
            errors.push({
              type: "missing-field",
              path: context,
              message: `Campo "${field}" não existe na entidade "${ns}" (template: ${match[0]})`,
            });
          }
        }
        // Check globals
        else if (globals[ns]) {
          if (!globals[ns][field]) {
            errors.push({
              type: "missing-field",
              path: context,
              message: `Campo "${field}" não existe nos globals "${ns}" (template: ${match[0]})`,
            });
          }
        }
        // Not in schema — could be runtime data
      }
    }
  }

  // Walk node tree
  function walkNode(node: any, pagePath: string) {
    if (!node) return;
    nodeCount++;
    const ctx = `${pagePath} → ${node.type}#${node.id}`;

    // Check props for templates
    if (node.props) {
      for (const [key, value] of Object.entries(node.props)) {
        if (typeof value === "string" && value.includes("{{")) {
          checkTemplate(value, `${ctx}.props.${key}`);
        }
        if (key === "columns" && Array.isArray(value)) {
          for (const col of value as any[]) {
            if (col.content && col.content.includes("{{")) {
              checkTemplate(col.content, `${ctx}.columns[${col.key}].content`);
            }
            if (col.link && col.link.includes("{{")) {
              checkTemplate(col.link, `${ctx}.columns[${col.key}].link`);
            }
          }
        }
      }

      // Table with no empty message
      if (node.type === "table" && !node.props.emptyMessage) {
        warnings.push({
          type: "missing-empty-message",
          path: ctx,
          message: "Tabela sem emptyMessage definido",
        });
      }
    }

    // Check visibility conditions
    if (node.visibility?.condition) {
      checkTemplate(node.visibility.condition, `${ctx}.visibility`);
    }

    // Recurse
    if (node.children) {
      for (const child of node.children) {
        walkNode(child, pagePath);
      }
    }
  }

  // Walk all pages
  for (const [pageId, page] of Object.entries(contract.pages) as [string, any][]) {
    walkNode(page.content, `pages.${pageId}`);

    // Check page header templates
    if (page.header?.cta?.label && page.header.cta.label.includes("{{")) {
      checkTemplate(page.header.cta.label, `pages.${pageId}.header.cta.label`);
    }
  }

  // Walk navigation
  for (const nav of contract.navigation) {
    if (nav.badge && nav.badge.includes("{{")) {
      checkTemplate(nav.badge, `navigation.${nav.id}.badge`);
    }
    if (nav.visibility?.condition) {
      checkTemplate(nav.visibility.condition, `navigation.${nav.id}.visibility`);
    }
  }

  // Walk header elements
  const header = contract.shell.header;
  if (header) {
    for (const zone of ["left", "center", "right"] as const) {
      for (const el of header[zone] || []) {
        if (el.props) {
          for (const [key, value] of Object.entries(el.props)) {
            if (typeof value === "string" && value.includes("{{")) {
              checkTemplate(value, `shell.header.${zone}.${el.id}.props.${key}`);
            }
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      pages: Object.keys(contract.pages).length,
      nodes: nodeCount,
      templates: templateCount,
      navItems: contract.navigation.length,
    },
  };
}
