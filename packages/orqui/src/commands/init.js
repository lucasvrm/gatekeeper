import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { computeHash } from "../hash.js";

const EXAMPLE_LAYOUT = {
  structure: {
    regions: {
      sidebar: {
        enabled: true, position: "left",
        dimensions: { width: "$tokens.sizing.sidebar-width", height: "$tokens.sizing.full-height" },
        padding: { top: "$tokens.spacing.md", right: "$tokens.spacing.sm", bottom: "$tokens.spacing.md", left: "$tokens.spacing.sm" },
        containers: [
          { name: "logo", description: "Logo ou título da aplicação", order: 0 },
          { name: "navLinks", description: "Links de navegação principal", order: 1 },
        ],
        behavior: { fixed: true, collapsible: false, scrollable: true },
      },
      header: {
        enabled: true, position: "top",
        dimensions: { height: "$tokens.sizing.header-height" },
        padding: { top: "$tokens.spacing.sm", right: "$tokens.spacing.lg", bottom: "$tokens.spacing.sm", left: "$tokens.spacing.lg" },
        containers: [{ name: "pageHeader", description: "Título da página", order: 0 }],
        behavior: { fixed: true, collapsible: false, scrollable: false },
      },
      main: {
        enabled: true, position: "center",
        padding: { top: "$tokens.spacing.lg", right: "$tokens.spacing.lg", bottom: "$tokens.spacing.lg", left: "$tokens.spacing.lg" },
        containers: [{ name: "contentBody", description: "Área principal", order: 0 }],
        behavior: { fixed: false, collapsible: false, scrollable: true },
      },
      footer: { enabled: false },
    },
  },
  tokens: {
    spacing: { xs: { value: 4, unit: "px" }, sm: { value: 8, unit: "px" }, md: { value: 16, unit: "px" }, lg: { value: 24, unit: "px" }, xl: { value: 32, unit: "px" } },
    sizing: { "sidebar-width": { value: 240, unit: "px" }, "header-height": { value: 56, unit: "px" }, "full-height": { value: 100, unit: "vh" } },
    fontFamilies: {
      primary: { family: "Inter", fallbacks: ["-apple-system", "BlinkMacSystemFont", "sans-serif"] },
      mono: { family: "JetBrains Mono", fallbacks: ["SF Mono", "monospace"] },
      display: { family: "Inter", fallbacks: ["-apple-system", "sans-serif"] },
    },
    fontSizes: { xs: { value: 11, unit: "px" }, sm: { value: 13, unit: "px" }, md: { value: 14, unit: "px" }, lg: { value: 16, unit: "px" }, xl: { value: 18, unit: "px" }, "2xl": { value: 22, unit: "px" }, "3xl": { value: 28, unit: "px" }, "4xl": { value: 36, unit: "px" } },
    fontWeights: { regular: { value: 400 }, medium: { value: 500 }, semibold: { value: 600 }, bold: { value: 700 } },
    lineHeights: { tight: { value: 1.2 }, normal: { value: 1.5 }, relaxed: { value: 1.7 } },
    letterSpacings: { tight: { value: -0.02, unit: "em" }, normal: { value: 0, unit: "em" }, wide: { value: 0.05, unit: "em" } },
  },
  textStyles: {
    "heading-1": { description: "Título principal", fontFamily: "$tokens.fontFamilies.display", fontSize: "$tokens.fontSizes.3xl", fontWeight: "$tokens.fontWeights.bold", lineHeight: "$tokens.lineHeights.tight", letterSpacing: "$tokens.letterSpacings.tight" },
    "heading-2": { description: "Subtítulo", fontFamily: "$tokens.fontFamilies.display", fontSize: "$tokens.fontSizes.2xl", fontWeight: "$tokens.fontWeights.semibold", lineHeight: "$tokens.lineHeights.tight" },
    body: { description: "Texto padrão", fontFamily: "$tokens.fontFamilies.primary", fontSize: "$tokens.fontSizes.md", fontWeight: "$tokens.fontWeights.regular", lineHeight: "$tokens.lineHeights.normal" },
    caption: { description: "Labels e metadados", fontFamily: "$tokens.fontFamilies.primary", fontSize: "$tokens.fontSizes.xs", fontWeight: "$tokens.fontWeights.medium", lineHeight: "$tokens.lineHeights.normal", letterSpacing: "$tokens.letterSpacings.wide" },
    code: { description: "Código", fontFamily: "$tokens.fontFamilies.mono", fontSize: "$tokens.fontSizes.sm", fontWeight: "$tokens.fontWeights.regular", lineHeight: "$tokens.lineHeights.relaxed" },
  },
};

const EXAMPLE_REGISTRY = {
  components: {
    Button: {
      name: "Button", category: "primitive", description: "Botão de ação.", source: "shadcn-ui",
      props: {
        variant: { type: "enum", required: false, description: "Variante visual", default: "default", enumValues: ["default", "destructive", "outline", "secondary", "ghost", "link"] },
        size: { type: "enum", required: false, description: "Tamanho", default: "default", enumValues: ["default", "sm", "lg", "icon"] },
        disabled: { type: "boolean", required: false, description: "Desabilita o botão", default: false },
      },
      slots: { children: { description: "Conteúdo do botão", required: true, acceptedComponents: [] } },
      variants: [{ name: "primary", props: { variant: "default" } }, { name: "danger", props: { variant: "destructive" } }],
      examples: [{ name: "Default", props: { variant: "default" }, slots: { children: "Salvar" } }],
      tags: ["action", "form"],
    },
  },
};

function generateContract(type, data) {
  const hash = computeHash(data);
  return { $orqui: { schema: type, version: "1.0.0", hash, generatedAt: new Date().toISOString() }, ...data };
}

export function init() {
  const cwd = process.cwd();
  const contractsDir = join(cwd, "contracts");

  console.log("\n  ⬡ Orqui — Initializing\n");

  if (existsSync(join(contractsDir, "orqui.lock.json"))) {
    console.log("  ⚠  Already initialized. Run 'npx orqui status' to check.\n");
    return;
  }

  mkdirSync(contractsDir, { recursive: true });

  const lc = generateContract("layout-contract", EXAMPLE_LAYOUT);
  const rc = generateContract("ui-registry-contract", EXAMPLE_REGISTRY);

  writeFileSync(join(contractsDir, "layout-contract.json"), JSON.stringify(lc, null, 2) + "\n");
  writeFileSync(join(contractsDir, "ui-registry-contract.json"), JSON.stringify(rc, null, 2) + "\n");
  writeFileSync(join(contractsDir, "orqui.lock.json"), JSON.stringify({
    contracts: {
      "layout-contract": { version: lc.$orqui.version, hash: lc.$orqui.hash, updatedAt: lc.$orqui.generatedAt },
      "ui-registry-contract": { version: rc.$orqui.version, hash: rc.$orqui.hash, updatedAt: rc.$orqui.generatedAt },
    },
  }, null, 2) + "\n");

  console.log("  ✓  contracts/layout-contract.json");
  console.log("  ✓  contracts/ui-registry-contract.json");
  console.log("  ✓  contracts/orqui.lock.json");

  const hasVite = existsSync(join(cwd, "vite.config.ts")) || existsSync(join(cwd, "vite.config.js"));

  if (hasVite) {
    console.log(`
  Add to your vite.config.ts:

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  import { orquiVitePlugin } from "@orqui/cli/vite"     │
  │                                                      │
  │  export default defineConfig({                       │
  │    plugins: [                                        │
  │      orquiVitePlugin(),                               │
  │    ],                                                │
  │  })                                                  │
  │                                                      │
  └──────────────────────────────────────────────────────┘

  Then open: http://localhost:<port>/__orqui
`);
  } else {
    console.log("\n  ⚠  No vite.config found. Plugin requires Vite.\n");
  }
}
