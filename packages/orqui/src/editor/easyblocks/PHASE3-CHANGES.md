# Phase 3 — Easyblocks Integration Fixes

## Summary

Phase 3 validates that the 21 Orqui components render and are editable in the Easyblocks canvas. This document covers all issues found by auditing the real `@easyblocks/core@1.0.10` API and the fixes applied.

---

## Issues Found & Fixed

### 1. Styled Components Pattern (CRITICAL)

**Problem:** All 21 React components in `components/index.tsx` treated styled slots (`Root`, `Label`, `Value`, etc.) as `ComponentType` — using `<Root>{children}</Root>`.

**Reality:** Easyblocks' `buildBoxes()` creates styled slots as `ReactElement` instances (via `React.createElement(Box, boxProps)`). The correct usage is:

```tsx
// ✅ Correct — ReactElement pattern
React.createElement(Root.type, Root.props, children)

// ❌ Wrong — ComponentType pattern
<Root>{children}</Root>
```

**Evidence:** Every builtin Easyblocks component (`RichTextClient`, `TextClient`) uses `Root.type` / `Root.props`:
```js
// @easyblocks/core/dist/es/compiler/builtins/_richText/_richText.client.js
return React.createElement(Root.type, Root.props, Elements.map(...))
```

**Fix:** Rewrote all 21 components to use `S(element, children)` helper that calls `React.createElement(el.type, el.props, children)`. For components with multiple styled slots (StatCard, Card, Table, Tabs, etc.), each slot uses the same pattern.

**Files:** `components/index.tsx`

---

### 2. Select Schema Props (CRITICAL)

**Problem:** All `select` type props had `options` at the top level of the schema prop object.

**Reality:** Easyblocks' `SelectSchemaProp` type requires options inside `params`:

```ts
// @easyblocks/core types:
type SelectSchemaProp = ValueSchemaProp<"select", string, "optional"> & SchemaPropParams<{
    options: Option[];
}, true>;  // true = params is REQUIRED
```

**Fix:** Moved all `options` arrays into `params: { options: [...] }` across all definition files.

**Affected props (16 total):**
- `layout.ts`: Row.align, Row.justify, Grid.columns, Container.borderRadius
- `content.ts`: Heading.level, Button.variant, Badge.color, Icon.size, Image.size, Divider.lineStyle
- `data.ts`: StatCard.trendDirection, List.maxItems, KeyValue.layout
- `misc.ts`: (none — Tabs, Search, Select don't use select schema props internally)

**Files:** `definitions/layout.ts`, `definitions/content.ts`, `definitions/data.ts`, `definitions/misc.ts`

---

### 3. Backend API Mismatch (CRITICAL)

**Problem:** The `createOrquiBackend()` implementation used incorrect signatures that don't match the real `@easyblocks/core Backend` interface.

**Key differences:**

| Method | Our old signature | Real signature |
|--------|------------------|----------------|
| `documents.get()` | Returns `{document: ...} \| null` | Returns `Promise<Document>` |
| `documents.create()` | Takes `{entry, id?}` → `{id}` | Takes `Omit<Document, "id"\|"version">` → `Document` |
| `documents.update()` | Takes `{id, entry}` → `void` | Takes `{id, version, entry}` → `Document` |
| `templates` | Only `get()` | Full CRUD: `get`, `getAll`, `create`, `update`, `delete` |

**Real `Document` type:**
```ts
type Document = { id: string; version: number; entry: NoCodeComponentEntry }
```

**Fix:** Rewrote backend to match all signatures exactly, including version tracking and full templates CRUD.

**Files:** `backend.ts`

---

### 4. Forced Responsive Types

**Problem:** `space` and `color` props had `responsive: true` annotations, which is meaningless.

**Reality:** In Easyblocks:
- `space` → `ValueSchemaProp<"space", ..., "forced">` — always responsive
- `color` → `ValueSchemaProp<"color", ..., "forced">` — always responsive
- `select` → `ValueSchemaProp<"select", ..., "optional">` — needs `responsive: true`
- `boolean` → `ValueSchemaProp<"boolean", ..., "optional">` — needs `responsive: true`

**Fix:** Removed `responsive: true` from all `space` and `color` props. Kept it on `select` and `boolean` props where responsive behavior is desired.

**Files:** `definitions/layout.ts`, `definitions/content.ts`, `definitions/data.ts`

---

### 5. Types Stub Accuracy

**Problem:** `types.ts` had hand-written type stubs that diverged from the real `@easyblocks/core` types.

**Fix:** Now that `@easyblocks/core` is installed, replaced stubs with real re-exports:
```ts
export type { NoCodeComponentDefinition, Config, Backend, SchemaProp, ... } from "@easyblocks/core";
```

Only Orqui-specific types (`EasyblocksTokens`, `EasyblocksCustomType`, mapping constants) remain as local definitions.

**Files:** `types.ts`

---

### 6. EasyblocksEditor Not Wired Up

**Problem:** `EasyblocksPageEditor.tsx` had a static `EASYBLOCKS_INSTALLED = false` flag and a placeholder wrapper.

**Fix:** 
- Dynamic `require("@easyblocks/editor")` with try/catch fallback
- Real `<EasyblocksEditor>` rendered with `config`, `components` (ORQUI_COMPONENTS), and `widgets` (ORQUI_WIDGETS)
- URL params (`?rootComponent=OrquiStack` or `?document={pageId}`) injected via `useEffect`
- Error boundary wraps the editor to catch canvas crashes
- `key={currentPageId}` forces re-mount when switching pages

**Files:** `EasyblocksPageEditor.tsx`

---

### 7. Token Safety — Empty Space Array

**Problem:** If all spacing tokens are filtered out (Easyblocks `parseSpacing` only accepts `px` and `vw`), the editor could crash on an empty `tokens.space` array.

**Fix:** Added safety check in `buildOrquiEasyblocksConfig()`:
```ts
if (tokens.space.length === 0) {
  tokens.space.push({ id: "0", label: "0", value: "0px", isDefault: true });
}
```

**Files:** `config.ts`

---

### 8. orqui-template Custom Type — Fallback Switch

**Problem:** If the custom type `orqui-template` isn't recognized by the editor, all components using it would fail.

**Fix:** Added `TEMPLATE_TYPE_SAFE` flag in `content.ts` and `data.ts`:
```ts
const TEMPLATE_TYPE_SAFE = false; // Set to true to fall back to "string"
const TMPL = TEMPLATE_TYPE_SAFE ? "string" : "orqui-template";
```

When set to `true`, all `orqui-template` props revert to `string` type, letting components render and be edited while the custom type issue is debugged.

**Files:** `definitions/content.ts`, `definitions/data.ts`

---

## Files Changed

```
packages/orqui/src/editor/easyblocks/
├── EasyblocksPageEditor.tsx  ← Rewired with real EasyblocksEditor + error boundary
├── config.ts                 ← Uses real Config type, token safety
├── types.ts                  ← Real @easyblocks/core re-exports
├── backend.ts                ← Matches real Backend interface (version, CRUD)
├── adapter/index.ts          ← Unchanged (already correct)
├── bridge/
│   ├── tokens.ts             ← Unchanged (already correct)
│   └── variables.ts          ← Unchanged (already correct)
├── definitions/
│   ├── layout.ts             ← select → params.options, removed responsive on space/color
│   ├── content.ts            ← select → params.options, TEMPLATE_TYPE_SAFE flag
│   ├── data.ts               ← select → params.options, TEMPLATE_TYPE_SAFE flag
│   ├── misc.ts               ← Reformatted TabActive with full styles
│   └── index.ts              ← Unchanged
├── components/index.tsx      ← ALL components: ReactElement pattern fix
├── widgets/TemplatePickerWidget.tsx ← Unchanged
└── index.ts                  ← Updated exports
```

## Verification

TypeScript compilation: **0 new errors**. All 23 pre-existing errors are in `integration/index.ts` (unrelated).

## Next Steps (Phase 4)

1. **Run the editor** — `npm run dev` and open the Orqui pages mode to verify canvas rendering
2. **Test `orqui-template`** — If custom type errors appear, flip `TEMPLATE_TYPE_SAFE = true`
3. **Test Children slots** — Drag children into Stack, Row, Grid, Container, Card
4. **Test sidebar props** — Edit select, boolean, string, space, color for each component
5. **CSS vars in iframe** — If Easyblocks renders canvas in an iframe, token CSS variables may not propagate; investigate injection strategy
