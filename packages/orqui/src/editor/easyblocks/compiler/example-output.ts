// ============================================================================
// Gera exemplos concretos de output para visualização
// Run: npx tsx compiler/example-output.ts
// ============================================================================

import { compileContracts } from "./contractCompiler";
import { cssVarsToString, componentStylesToCSS } from "./styleCompiler";
import { BREAKPOINTS } from "./types";
import type { CompilerInput } from "./types";

const TOKENS = {
  colors: {
    accent: { value: "#6d9cff" },
    text: { value: "#e4e4e7" },
    "text-muted": { value: "#8b8b96" },
    "card-bg": { value: "#141417" },
    "card-border": { value: "#2a2a33" },
    border: { value: "#2a2a33" },
    background: { value: "#0a0a0c" },
    "surface-2": { value: "#1c1c21" },
    danger: { value: "#ff6b6b" },
  },
  spacing: {
    xs: { value: 4, unit: "px" },
    sm: { value: 8, unit: "px" },
    md: { value: 16, unit: "px" },
    lg: { value: 24, unit: "px" },
    xl: { value: 32, unit: "px" },
  },
  fontFamilies: {
    primary: { family: "Inter", fallbacks: ["-apple-system", "sans-serif"] },
    display: { family: "Inter", fallbacks: ["-apple-system", "sans-serif"] },
  },
  fontSizes: {
    sm: { value: 13, unit: "px" },
    md: { value: 14, unit: "px" },
    "2xl": { value: 22, unit: "px" },
    "3xl": { value: 28, unit: "px" },
  },
  fontWeights: { regular: { value: 400 }, semibold: { value: 600 }, bold: { value: 700 } },
  lineHeights: { tight: { value: 1.25 }, normal: { value: 1.5 } },
  letterSpacings: { tight: { value: "-0.02em" } },
  borderRadius: {
    sm: { value: 4, unit: "px" },
    md: { value: 6, unit: "px" },
    lg: { value: 8, unit: "px" },
  },
};

// Simula o que Easyblocks produz internamente
const EB_ENTRY = {
  _id: "page-root",
  _component: "OrquiStack",
  gap: {
    $res: true,
    xl: { tokenId: "lg", value: "24px" },
    md: { tokenId: "md", value: "16px" },
    xs: { tokenId: "sm", value: "8px" },
  },
  padding: { tokenId: "lg", value: "24px" },
  Children: [
    {
      _id: "title-1",
      _component: "OrquiHeading",
      content: "{{$page.title}}",
      level: { $res: true, xl: "1", md: "2", xs: "3" },
      color: { tokenId: "text", value: "#e4e4e7" },
      font: { tokenId: "display", value: { fontFamily: "'Inter', -apple-system, sans-serif" } },
    },
    {
      _id: "grid-cards",
      _component: "OrquiGrid",
      columns: { $res: true, xl: "3", md: "2", xs: "1" },
      gap: { tokenId: "md", value: "16px" },
      Children: [
        {
          _id: "card-revenue",
          _component: "OrquiStatCard",
          label: "{{stats.revenue.label}}",
          value: "{{stats.revenue.value | currency:BRL}}",
          icon: "CurrencyDollar",
          trendDirection: "up",
          padding: { tokenId: "md", value: "16px" },
          borderRadius: { tokenId: "lg", value: "8px" },
        },
      ],
    },
    {
      _id: "btn-export",
      _component: "OrquiButton",
      label: "Exportar relatório",
      variant: "primary",
      borderRadius: { tokenId: "md", value: "6px" },
      route: "/export",
    },
  ],
};

const input: CompilerInput = {
  layout: {
    structure: { regions: { sidebar: { enabled: true } } },
    tokens: TOKENS,
    textStyles: {
      "heading-1": {
        fontFamily: "$tokens.fontFamilies.display",
        fontSize: "$tokens.fontSizes.3xl",
        fontWeight: "$tokens.fontWeights.bold",
        lineHeight: "$tokens.lineHeights.tight",
      },
    },
    pages: {
      "dashboard": {
        id: "dashboard",
        label: "Dashboard",
        route: "/dashboard",
        content: { id: "page-root", type: "stack", children: [] },
      },
    },
  },
  ebEntryCache: new Map([["dashboard", EB_ENTRY]]),
};

const output = compileContracts(input);

// ============================================================================
// Print outputs
// ============================================================================

console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║  ANTES (NodeDef — o que a app recebe hoje)                  ║");
console.log("╚══════════════════════════════════════════════════════════════╝\n");

// Simulate what the current adapter produces (flattened, resolved)
const flatNodeDef = {
  id: "page-root",
  type: "stack",
  props: { gap: "24px" },     // ❌ Valor concreto, sem breakpoints
  children: [
    {
      id: "title-1",
      type: "heading",
      props: {
        content: "{{$page.title}}",
        level: 1,              // ❌ Só xl, sem md=2 ou xs=3
        color: "#e4e4e7",      // ❌ Valor concreto, não token ref
      },
    },
    {
      id: "grid-cards",
      type: "grid",
      props: {
        columns: 3,            // ❌ Só xl, sem md=2 ou xs=1
        gap: "16px",           // ❌ Valor concreto
      },
    },
  ],
};
console.log(JSON.stringify(flatNodeDef, null, 2));

console.log("\n╔══════════════════════════════════════════════════════════════╗");
console.log("║  DEPOIS (EnrichedNodeDef — layout-contract v3)              ║");
console.log("╚══════════════════════════════════════════════════════════════╝\n");

const page = output.layoutContract.pages["dashboard"];
console.log(JSON.stringify(page.content, null, 2));

console.log("\n╔══════════════════════════════════════════════════════════════╗");
console.log("║  STYLE CONTRACT (pre-computed CSS por breakpoint)           ║");
console.log("╚══════════════════════════════════════════════════════════════╝\n");

// Show subset
const styleSubset = {
  cssVariables: Object.fromEntries(
    Object.entries(output.styleContract.cssVariables).slice(0, 8)
  ),
  componentStyles: output.styleContract.componentStyles,
};
console.log(JSON.stringify(styleSubset, null, 2));

console.log("\n╔══════════════════════════════════════════════════════════════╗");
console.log("║  CSS GERADO (pronto para injetar na app)                   ║");
console.log("╚══════════════════════════════════════════════════════════════╝\n");

console.log("/* --- Token CSS Variables --- */");
console.log(cssVarsToString(output.styleContract.cssVariables));
console.log("\n/* --- Component Styles --- */");
console.log(componentStylesToCSS(output.styleContract.componentStyles, BREAKPOINTS));

console.log("\n╔══════════════════════════════════════════════════════════════╗");
console.log("║  REGISTRY CONTRACT (catálogo de componentes)               ║");
console.log("╚══════════════════════════════════════════════════════════════╝\n");

// Show subset
const catalogSubset = {
  OrquiHeading: output.registryContract.catalog["OrquiHeading"],
  OrquiStack: output.registryContract.catalog["OrquiStack"],
  OrquiGrid: output.registryContract.catalog["OrquiGrid"],
};
console.log(JSON.stringify(catalogSubset, null, 2));
