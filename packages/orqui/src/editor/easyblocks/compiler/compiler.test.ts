// ============================================================================
// Contract Compiler — Integration Test
//
// Validates that all 3 gaps are closed using synthetic EB entries:
//   Gap 1: Responsive values preserved (not flattened)
//   Gap 2: Token references preserved as $tokens.X.Y (not resolved)
//   Gap 3: Styles pre-computed per breakpoint
//
// Run: npx tsx compiler.test.ts  (or paste into node --loader tsx)
// ============================================================================

import { buildTokenIndex, enrichEntry, enrichNodeDef } from "./enricher";
import { compileStyles, generateCSSVariableMap, resolveTextStyles, buildReverseTokenIndex } from "./styleCompiler";
import { compileContracts, validateLayoutContract } from "./contractCompiler";
import type { CompilerInput } from "./types";

// ============================================================================
// Test tokens (subset of real layout-contract.json)
// ============================================================================

const TEST_TOKENS = {
  colors: {
    accent: { value: "#6d9cff" },
    text: { value: "#e4e4e7" },
    "text-muted": { value: "#8b8b96" },
    "surface-2": { value: "#1c1c21" },
    border: { value: "#2a2a33" },
    danger: { value: "#ff6b6b" },
    "card-bg": { value: "#141417" },
    "card-border": { value: "#2a2a33" },
  },
  spacing: {
    xs: { value: 4, unit: "px" },
    sm: { value: 8, unit: "px" },
    md: { value: 16, unit: "px" },
    lg: { value: 24, unit: "px" },
    xl: { value: 32, unit: "px" },
  },
  sizing: {
    "sidebar-width": { value: 240, unit: "px" },
    "header-height": { value: 48, unit: "px" },
  },
  fontFamilies: {
    primary: { family: "Inter", fallbacks: ["-apple-system", "sans-serif"] },
    mono: { family: "JetBrains Mono", fallbacks: ["monospace"] },
    display: { family: "Inter", fallbacks: ["-apple-system", "sans-serif"] },
  },
  fontSizes: {
    sm: { value: 13, unit: "px" },
    md: { value: 14, unit: "px" },
    lg: { value: 16, unit: "px" },
    "2xl": { value: 22, unit: "px" },
    "3xl": { value: 28, unit: "px" },
  },
  fontWeights: {
    regular: { value: 400 },
    medium: { value: 500 },
    semibold: { value: 600 },
    bold: { value: 700 },
  },
  lineHeights: {
    none: { value: 1 },
    tight: { value: 1.25 },
    snug: { value: 1.375 },
    normal: { value: 1.5 },
  },
  letterSpacings: {
    tighter: { value: "-0.04em" },
    tight: { value: "-0.02em" },
    normal: { value: "0em" },
    wide: { value: "0.02em" },
  },
  borderRadius: {
    none: { value: 0, unit: "px" },
    sm: { value: 4, unit: "px" },
    md: { value: 6, unit: "px" },
    lg: { value: 8, unit: "px" },
    xl: { value: 12, unit: "px" },
    full: { value: 9999, unit: "px" },
  },
};

const TEST_TEXT_STYLES = {
  "heading-1": {
    description: "Título principal",
    fontFamily: "$tokens.fontFamilies.display",
    fontSize: "$tokens.fontSizes.3xl",
    fontWeight: "$tokens.fontWeights.bold",
    lineHeight: "$tokens.lineHeights.tight",
    letterSpacing: "$tokens.letterSpacings.tight",
  },
  body: {
    description: "Texto padrão",
    fontFamily: "$tokens.fontFamilies.primary",
    fontSize: "$tokens.fontSizes.md",
    fontWeight: "$tokens.fontWeights.regular",
    lineHeight: "$tokens.lineHeights.normal",
  },
};

// ============================================================================
// Synthetic Easyblocks NoCodeEntry (simulates what EB produces internally)
// ============================================================================

const SYNTHETIC_EB_ENTRY = {
  _id: "stack-root",
  _component: "OrquiStack",
  // Gap — responsive with token ref
  gap: {
    $res: true,
    xl: { tokenId: "lg", value: "24px" },
    md: { tokenId: "md", value: "16px" },
    xs: { tokenId: "sm", value: "8px" },
  },
  // Padding — non-responsive, token ref
  padding: { tokenId: "md", value: "16px" },
  // Background — non-responsive, token ref
  background: { tokenId: "card-bg", value: "#141417" },
  Children: [
    {
      _id: "heading-1",
      _component: "OrquiHeading",
      // content — template expression (not responsive)
      content: "{{$page.title | capitalize}}",
      // level — responsive
      level: {
        $res: true,
        xl: "2",
        xs: "3",
      },
      // color — token ref
      color: { tokenId: "text", value: "#e4e4e7" },
      // font — token ref (font type)
      font: { tokenId: "primary", value: { fontFamily: "'Inter', -apple-system, sans-serif" } },
    },
    {
      _id: "row-stats",
      _component: "OrquiRow",
      gap: { tokenId: "md", value: "16px" },
      align: "center",
      justify: {
        $res: true,
        xl: "space-between",
        xs: "flex-start",
      },
      wrap: {
        $res: true,
        xl: false,
        xs: true,
      },
      Children: [
        {
          _id: "stat-1",
          _component: "OrquiStatCard",
          label: "{{stats.revenue | currency:BRL}}",
          value: "{{stats.total}}",
          icon: "TrendUp",
          trendDirection: "up",
          padding: { tokenId: "md", value: "16px" },
          background: { tokenId: "card-bg", value: "#141417" },
          borderRadius: { tokenId: "lg", value: "8px" },
        },
        {
          _id: "button-1",
          _component: "OrquiButton",
          label: "Ver detalhes",
          variant: "primary",
          borderRadius: { tokenId: "md", value: "6px" },
          route: "/details",
        },
      ],
    },
    {
      _id: "grid-1",
      _component: "OrquiGrid",
      columns: {
        $res: true,
        xl: "3",
        md: "2",
        xs: "1",
      },
      gap: { tokenId: "md", value: "16px" },
      Children: [],
    },
  ],
};

// ============================================================================
// Test runner
// ============================================================================

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string, detail?: any): void {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.log(`  ❌ ${message}`);
    if (detail !== undefined) {
      console.log(`     Got:`, JSON.stringify(detail, null, 2).substring(0, 200));
    }
  }
}

// ============================================================================
// Test: Token Index
// ============================================================================

console.log("\n🔧 Token Index");
const tokenIndex = buildTokenIndex(TEST_TOKENS);

assert(
  tokenIndex.idToGroup.get("accent") === "colors",
  "accent → colors group",
  tokenIndex.idToGroup.get("accent"),
);

assert(
  tokenIndex.idToGroup.get("md") === "spacing" || tokenIndex.idToGroup.get("md") === "borderRadius",
  "md resolves to a known group",
  tokenIndex.idToGroup.get("md"),
);

assert(
  tokenIndex.resolvedValues.get("colors.accent") === "#6d9cff",
  "colors.accent resolves to #6d9cff",
  tokenIndex.resolvedValues.get("colors.accent"),
);

assert(
  tokenIndex.resolvedValues.get("spacing.lg") === "24px",
  "spacing.lg resolves to 24px",
  tokenIndex.resolvedValues.get("spacing.lg"),
);

// ============================================================================
// Test: GAP 1 — Responsive Values Preserved
// ============================================================================

console.log("\n📱 Gap 1: Responsive Values");
const { tree } = enrichEntry(SYNTHETIC_EB_ENTRY, tokenIndex);

// Stack root should have responsive gap
assert(
  tree.responsive !== undefined && "gap" in tree.responsive,
  "Stack.responsive.gap exists",
  tree.responsive,
);

assert(
  tree.responsive?.gap?.xl !== undefined &&
  tree.responsive?.gap?.md !== undefined &&
  tree.responsive?.gap?.xs !== undefined,
  "Stack.responsive.gap has xl, md, xs breakpoints",
  tree.responsive?.gap,
);

// Heading level should be responsive (xl=2, xs=3)
const heading = tree.children?.[0];
assert(
  heading?.responsive?.level?.xl === "2" && heading?.responsive?.level?.xs === "3",
  "Heading.responsive.level = { xl: '2', xs: '3' }",
  heading?.responsive?.level,
);

// Grid columns should be responsive
const row = tree.children?.[1];
const grid = tree.children?.[2];
assert(
  grid?.responsive?.columns?.xl === "3" &&
  grid?.responsive?.columns?.md === "2" &&
  grid?.responsive?.columns?.xs === "1",
  "Grid.responsive.columns = { xl: '3', md: '2', xs: '1' }",
  grid?.responsive?.columns,
);

// Row justify should be responsive
assert(
  row?.responsive?.justify?.xl === "space-between" &&
  row?.responsive?.justify?.xs === "flex-start",
  "Row.responsive.justify = { xl: 'space-between', xs: 'flex-start' }",
  row?.responsive?.justify,
);

// Row wrap should be responsive
assert(
  row?.responsive?.wrap?.xl === false && row?.responsive?.wrap?.xs === true,
  "Row.responsive.wrap = { xl: false, xs: true }",
  row?.responsive?.wrap,
);

// ============================================================================
// Test: GAP 2 — Token References Preserved
// ============================================================================

console.log("\n🎨 Gap 2: Token References");

// Stack gap default should be a token ref
assert(
  typeof tree.props?.gap === "string" && tree.props.gap.startsWith("$tokens."),
  "Stack.props.gap is a $tokens ref",
  tree.props?.gap,
);

// Stack padding should be a token ref
assert(
  tree.props?.padding === "$tokens.spacing.md",
  "Stack.props.padding = $tokens.spacing.md",
  tree.props?.padding,
);

// Stack background should be a token ref
assert(
  tree.props?.background === "$tokens.colors.card-bg",
  "Stack.props.background = $tokens.colors.card-bg",
  tree.props?.background,
);

// Heading color should be a token ref
assert(
  heading?.props?.color === "$tokens.colors.text",
  "Heading.props.color = $tokens.colors.text",
  heading?.props?.color,
);

// Heading font should be a token ref
assert(
  heading?.props?.font === "$tokens.fontFamilies.primary",
  "Heading.props.font = $tokens.fontFamilies.primary",
  heading?.props?.font,
);

// StatCard borderRadius should be a token ref
const stat = row?.children?.[0];
assert(
  stat?.props?.borderRadius === "$tokens.borderRadius.lg",
  "StatCard.props.borderRadius = $tokens.borderRadius.lg",
  stat?.props?.borderRadius,
);

// Responsive values should also be token refs
assert(
  tree.responsive?.gap?.xl === "$tokens.spacing.lg" &&
  tree.responsive?.gap?.md === "$tokens.spacing.md" &&
  tree.responsive?.gap?.xs === "$tokens.spacing.sm",
  "Stack.responsive.gap values are $tokens refs",
  tree.responsive?.gap,
);

// ============================================================================
// Test: Template Bindings
// ============================================================================

console.log("\n📝 Template Bindings");

assert(
  heading?.bindings?.includes("content"),
  "Heading.bindings includes 'content'",
  heading?.bindings,
);

assert(
  heading?.props?.content === "{{$page.title | capitalize}}",
  "Heading.props.content preserves template expression",
  heading?.props?.content,
);

assert(
  stat?.bindings?.includes("label") && stat?.bindings?.includes("value"),
  "StatCard.bindings includes 'label' and 'value'",
  stat?.bindings,
);

// Button should NOT have bindings (no templates)
const button = row?.children?.[1];
assert(
  button?.bindings === undefined,
  "Button has no bindings (no template expressions)",
  button?.bindings,
);

// ============================================================================
// Test: GAP 3 — Styles Pre-computed
// ============================================================================

console.log("\n🎨 Gap 3: Pre-computed Styles");

const reverseIndex = buildReverseTokenIndex(TEST_TOKENS, tokenIndex);
const { componentStyles, componentProps } = compileStyles(tree, tokenIndex, reverseIndex);

// Stack root should have styles
assert(
  componentStyles["stack-root"] !== undefined,
  "Stack root has pre-computed styles",
  Object.keys(componentStyles),
);

// Stack root styles should have Root slot
assert(
  componentStyles["stack-root"]?.Root !== undefined,
  "Stack root styles have Root slot",
  Object.keys(componentStyles["stack-root"] || {}),
);

// Stack styles should have xl breakpoint with flexDirection
const stackXl = componentStyles["stack-root"]?.Root?.xl;
assert(
  stackXl?.display === "flex" && stackXl?.flexDirection === "column",
  "Stack xl: display=flex, flexDirection=column",
  stackXl,
);

// Stack styles should use var(--orqui-...) for tokenized values
assert(
  typeof stackXl?.gap === "string" && stackXl.gap.includes("var(--orqui"),
  "Stack xl gap uses CSS variable",
  stackXl?.gap,
);

// Heading should have styles
assert(
  componentStyles["heading-1"] !== undefined,
  "Heading has pre-computed styles",
  Object.keys(componentStyles),
);

// Heading xl should have fontSize, fontWeight
const headingXl = componentStyles["heading-1"]?.Root?.xl;
assert(
  headingXl !== undefined && "fontSize" in headingXl,
  "Heading xl has fontSize",
  headingXl,
);

// Grid should have responsive style diffs
const gridStyles = componentStyles["grid-1"];
assert(
  gridStyles?.Root !== undefined,
  "Grid has pre-computed styles",
  gridStyles,
);

// Grid xl should have gridTemplateColumns with 3
const gridXl = gridStyles?.Root?.xl;
assert(
  gridXl?.gridTemplateColumns?.includes("3"),
  "Grid xl: gridTemplateColumns includes repeat(3, ...)",
  gridXl?.gridTemplateColumns,
);

// Grid md should differ (2 columns) — only if there's responsive variation
if (gridStyles?.Root?.md) {
  assert(
    gridStyles.Root.md.gridTemplateColumns?.includes("2"),
    "Grid md: diff has gridTemplateColumns with 2",
    gridStyles.Root.md.gridTemplateColumns,
  );
}

// ============================================================================
// Test: CSS Variables
// ============================================================================

console.log("\n🖌️  CSS Variables");

const cssVars = generateCSSVariableMap(TEST_TOKENS);

assert(cssVars["--orqui-accent"] === "#6d9cff", "cssVars: --orqui-accent", cssVars["--orqui-accent"]);
assert(cssVars["--orqui-spacing-md"] === "16px", "cssVars: --orqui-spacing-md", cssVars["--orqui-spacing-md"]);
assert(cssVars["--orqui-font-primary"]?.includes("Inter"), "cssVars: --orqui-font-primary includes Inter", cssVars["--orqui-font-primary"]);
assert(cssVars["--orqui-radius-lg"] === "8px", "cssVars: --orqui-radius-lg", cssVars["--orqui-radius-lg"]);
assert(cssVars["--orqui-font-size-md"] === "14px", "cssVars: --orqui-font-size-md", cssVars["--orqui-font-size-md"]);
assert(cssVars["--orqui-font-weight-bold"] === "700", "cssVars: --orqui-font-weight-bold", cssVars["--orqui-font-weight-bold"]);

// ============================================================================
// Test: Resolved TextStyles
// ============================================================================

console.log("\n📖 Resolved TextStyles");

const resolved = resolveTextStyles(TEST_TEXT_STYLES, TEST_TOKENS, tokenIndex);

assert(
  resolved["heading-1"]?.fontFamily === "var(--orqui-font-display)",
  "heading-1.fontFamily = var(--orqui-font-display)",
  resolved["heading-1"]?.fontFamily,
);

assert(
  resolved["heading-1"]?.fontSize === "var(--orqui-font-size-3xl)",
  "heading-1.fontSize = var(--orqui-font-size-3xl)",
  resolved["heading-1"]?.fontSize,
);

assert(
  resolved["body"]?.fontWeight === "var(--orqui-font-weight-regular)",
  "body.fontWeight = var(--orqui-font-weight-regular)",
  resolved["body"]?.fontWeight,
);

assert(
  resolved["body"]?.lineHeight === "var(--orqui-line-height-normal)",
  "body.lineHeight = var(--orqui-line-height-normal)",
  resolved["body"]?.lineHeight,
);

// description should be excluded
assert(
  resolved["heading-1"] && !("description" in resolved["heading-1"]),
  "TextStyle description field excluded",
);

// ============================================================================
// Test: Full Compilation
// ============================================================================

console.log("\n🏗️  Full Compilation");

const compilerInput: CompilerInput = {
  layout: {
    structure: { regions: { sidebar: { enabled: true } } },
    tokens: TEST_TOKENS,
    textStyles: TEST_TEXT_STYLES,
    pages: {
      "page-1": {
        id: "page-1",
        label: "Dashboard",
        route: "/dashboard",
        browserTitle: "Dashboard — App",
        content: { id: "stack-root", type: "stack", children: [] },
      },
    },
    variables: { categories: [], items: [] },
  },
  ebEntryCache: new Map([["page-1", SYNTHETIC_EB_ENTRY]]),
};

const output = compileContracts(compilerInput);

// Layout contract
assert(
  output.layoutContract.$orqui.version === "3.0.0",
  "layoutContract version = 3.0.0",
);
assert(
  output.layoutContract.$orqui.pageCount === 1,
  "layoutContract pageCount = 1",
);
assert(
  output.layoutContract.pages["page-1"]?.content?.type === "stack",
  "layoutContract page-1 content type = stack",
);
assert(
  output.layoutContract.pages["page-1"]?.content?.responsive?.gap !== undefined,
  "layoutContract page-1 has responsive gap",
);

// Style contract
assert(
  output.styleContract.$orqui.version === "1.0.0",
  "styleContract version = 1.0.0",
);
assert(
  Object.keys(output.styleContract.cssVariables).length > 10,
  `styleContract has ${Object.keys(output.styleContract.cssVariables).length} CSS variables`,
);
assert(
  Object.keys(output.styleContract.componentStyles).length > 0,
  `styleContract has ${Object.keys(output.styleContract.componentStyles).length} styled components`,
);
assert(
  Object.keys(output.styleContract.resolvedTextStyles).length === 2,
  "styleContract has 2 resolved text styles",
);

// Registry contract
assert(
  output.registryContract.$orqui.version === "2.0.0",
  "registryContract version = 2.0.0",
);
assert(
  Object.keys(output.registryContract.catalog).length === 42,
  `registryContract catalog has ${Object.keys(output.registryContract.catalog).length} components`,
  Object.keys(output.registryContract.catalog).length,
);

// Catalog entry details
const headingCatalog = output.registryContract.catalog["OrquiHeading"];
assert(
  headingCatalog?.type === "heading",
  "Catalog OrquiHeading type = heading",
);
assert(
  headingCatalog?.props?.content?.type === "orqui-template",
  "Catalog OrquiHeading.content type = orqui-template",
);
assert(
  headingCatalog?.props?.level?.options?.length === 6,
  "Catalog OrquiHeading.level has 6 options",
);

// Stack catalog should have Children slot
const stackCatalog = output.registryContract.catalog["OrquiStack"];
assert(
  stackCatalog?.slots?.Children !== undefined,
  "Catalog OrquiStack has Children slot",
);

// ============================================================================
// Test: Validation
// ============================================================================

console.log("\n🔍 Contract Validation");

const validation = validateLayoutContract(output.layoutContract);
assert(
  validation.valid === true,
  `Contract is valid (${validation.errors.length} errors, ${validation.warnings.length} warnings)`,
  { errors: validation.errors, warnings: validation.warnings },
);

// ============================================================================
// Test: Fallback (no EB entry)
// ============================================================================

console.log("\n⚡ Fallback (no EB entry)");

const fallbackInput: CompilerInput = {
  layout: {
    ...compilerInput.layout,
    pages: {
      "page-no-eb": {
        id: "page-no-eb",
        label: "Legacy Page",
        route: "/legacy",
        content: {
          id: "legacy-root",
          type: "stack",
          props: { gap: "16px" },
          children: [
            {
              id: "legacy-heading",
              type: "heading",
              props: { content: "{{title}}", level: 2 },
            },
          ],
        },
      },
    },
  },
  ebEntryCache: new Map(), // empty — no EB entries
};

const fallbackOutput = compileContracts(fallbackInput);

assert(
  fallbackOutput.layoutContract.pages["page-no-eb"]?.content?.type === "stack",
  "Fallback: page content preserved",
);

assert(
  fallbackOutput.layoutContract.pages["page-no-eb"]?.content?.children?.[0]?.bindings?.includes("content"),
  "Fallback: template bindings still detected",
);

// ============================================================================
// Summary
// ============================================================================

console.log(`\n${"═".repeat(60)}`);
console.log(`  Total: ${passed + failed} tests | ✅ ${passed} passed | ❌ ${failed} failed`);
console.log(`${"═".repeat(60)}\n`);

if (failed > 0) {
  process.exit(1);
}
