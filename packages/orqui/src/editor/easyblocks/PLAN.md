# Orqui × Easyblocks — Opção A: Implementation Plan

## Arquitetura

```
┌────────────────────────────────────────────────────────────────────┐
│  OrquiEditor                                                        │
│  ┌─────────────┐  ┌──────────────────────────────────────────────┐ │
│  │ Shell &      │  │  EasyblocksPageEditor (wrapper)              │ │
│  │ Tokens       │  │  ┌──────────────────────────────────────┐   │ │
│  │ (unchanged)  │  │  │ EasyblocksEditor (from @easyblocks)  │   │ │
│  │              │  │  │  • Canvas + nested selection          │   │ │
│  │              │  │  │  • Inline rich text                   │   │ │
│  │              │  │  │  • Responsive fields per breakpoint   │   │ │
│  │              │  │  │  • Template picker                    │   │ │
│  │              │  │  │  • Undo/redo stack visual             │   │ │
│  │              │  │  └──────────────────────────────────────┘   │ │
│  │              │  │                                              │ │
│  │              │  │  config = buildOrquiEasyblocksConfig(        │ │
│  │              │  │    tokens,      // ← token bridge            │ │
│  │              │  │    variables,   // ← variable bridge         │ │
│  │              │  │    definitions, // ← 21 component defs       │ │
│  │              │  │    backend,     // ← OrquiBackend (contract) │ │
│  │              │  │  )                                           │ │
│  └─────────────┘  └─────────────┬────────────────────────────────┘ │
│                                 │ onSave                            │
│                                 ▼                                   │
│               ┌──────────────────────────┐                          │
│               │  Contract Adapter         │                         │
│               │  noCodeEntryToNodeDef()   │                         │
│               │  nodeDeFToNoCodeEntry()   │                         │
│               └────────────┬─────────────┘                          │
│                            ▼                                        │
│               layout-contract.json (v2)                              │
│               pages: { [id]: PageDef }                              │
└────────────────────────────────────────────────────────────────────┘
```

## Módulos

### 1. definitions/ — NoCode Component Definitions

Mapeamento 1:1 dos 21 node types de `nodeDefaults.ts`:

| Arquivo          | Components                                          |
|------------------|-----------------------------------------------------|
| `layout.ts`      | OrquiStack, OrquiRow, OrquiGrid, OrquiContainer     |
| `content.ts`     | OrquiHeading, OrquiText, OrquiButton, OrquiBadge,   |
|                  | OrquiIcon, OrquiImage, OrquiDivider, OrquiSpacer    |
| `data.ts`        | OrquiStatCard, OrquiCard, OrquiTable, OrquiList,    |
|                  | OrquiKeyValue                                       |
| `navigation.ts`  | OrquiTabs                                           |
| `input.ts`       | OrquiSearch, OrquiSelect                            |
| `special.ts`     | OrquiSlot                                           |

Cada definition especifica:
- `schema[]` com tipos Easyblocks (string, boolean, select, space, color, component, component-collection)
- `styles()` que computa CSS a partir dos prop values
- `editing()` que controla visibilidade condicional de fields no sidebar

### 2. bridge/tokens.ts — Token Bridge

Converte `layout.tokens` do Orqui para `Config.tokens` do Easyblocks:

```
Orqui tokens.colors     → Easyblocks tokens.colors[]
Orqui tokens.spacing    → Easyblocks tokens.space[]
Orqui tokens.fontFamilies → Easyblocks tokens.fonts[]
Orqui tokens.fontSizes  → Easyblocks tokens.fonts[] (typography)
Orqui tokens.borderRadius → Custom token type
```

### 3. bridge/variables.ts — Variable Bridge

Preserva a template engine `{{}}` do Orqui criando:
- Custom type `orqui-template` com widget picker
- Mapeia `variableSchema.ts` para external data definitions
- Reutiliza `TemplateField.tsx` e `VariableEditor.tsx` existentes

### 4. adapter/ — Contract Adapter (bidirecional)

A peça-chave da integração:
- `noCodeEntryToNodeDef()` — Easyblocks document → Orqui `NodeDef` tree
- `nodeDefToNoCodeEntry()` — Orqui `NodeDef` tree → Easyblocks document
- Roundtrip test: `nodeDefToNoCodeEntry(noCodeEntryToNodeDef(x)) ≈ x`

### 5. backend.ts — OrquiBackend

Implementa a interface `Backend` do Easyblocks, salvando documentos
diretamente no formato Orqui (layout.pages) via IndexedDB + API.

### 6. EasyblocksPageEditor.tsx — Drop-in replacement

Mesma interface pública que `PageEditor.tsx`:
```typescript
interface Props {
  pages: Record<string, PageDef>;
  onPagesChange: (pages: Record<string, PageDef>) => void;
  tokens?: Record<string, any>;
  variables?: VariablesSection;
  onVariablesChange?: (v: VariablesSection) => void;
  externalVariables?: VariablesSection;
}
```

## Estratégia de Migração

### Feature flag no OrquiEditor.tsx

```tsx
const USE_EASYBLOCKS = true; // feature flag

{editorMode === "pages" && (
  USE_EASYBLOCKS
    ? <EasyblocksPageEditor ... />
    : <PageEditor ... />
)}
```

O `page-editor/` existente permanece intacto como fallback.

## Dependências a instalar

```bash
npm install @easyblocks/core @easyblocks/editor
```

## Fases de Execução

| Fase | Escopo | Status |
|------|--------|--------|
| 1    | Definitions (21 components) + Token bridge | ← ESTE PR |
| 2    | Variable bridge + TemplatePickerWidget | Próximo |
| 3    | Contract adapter bidirecional + testes roundtrip | Próximo |
| 4    | EasyblocksPageEditor + OrquiBackend + integração | Próximo |
| 5    | Device preview, polish, shell integration | Futuro |
