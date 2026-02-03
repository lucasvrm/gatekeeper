# Easyblocks Integration — Diagnóstico e Correções

## Resumo

O editor Easyblocks não funciona por **6 bugs independentes** que precisam ser corrigidos juntos. O outro agente ficou preso no Bug #1 (o iframe), mas mesmo que resolva isso, os bugs #2–#6 impediriam o funcionamento.

---

## Bug #1 — CRÍTICO: O iframe carrega a UI inteira do Orqui

### O que acontece
O Easyblocks cria um iframe com `src: window.location.href` para renderizar o canvas. Quando o iframe carrega `/__orqui`, ele renderiza o OrquiEditor **completo** — topbar, mode switcher, busca, sidebar — ao invés de renderizar APENAS o `<EasyblocksEditor>`.

### O que a documentação do Easyblocks diz
> "Please keep in mind that the editor page shouldn't render any extra headers, footers, popups etc. It must be blank canvas with EasyblocksEditor being a single component rendered."
> — https://docs.easyblocks.io/essentials/editor-page

### Por que a abordagem de portal não funciona
O outro agente tentou detectar o iframe dentro do `EasyblocksPageEditor` e usar `createPortal` para cobrir a UI. Isso é frágil porque:
- O OrquiEditor completo renderiza primeiro (data loading, topbar, event handlers)
- Só DEPOIS o EasyblocksPageEditor renderiza e tenta o portal
- Race conditions com `window.parent.isShopstoryEditor`
- CSS/event interference da shell do Orqui

### Correção
Interceptar no `entry.tsx` — **antes** de montar o React, detectar se estamos no iframe. Se sim, renderizar APENAS o EasyblocksEditor com os componentes.

**Arquivo:** `entry.tsx` (modificado) + `CanvasEntry.tsx` (novo)

---

## Bug #2 — CRÍTICO: Componentes React usam pattern errado

### O que acontece
Todos os 21 componentes usam:
```tsx
function OrquiStack({ Root, Children }: { Root: StyledComponent; Children: ReactNode }) {
  return <Root>{Children}</Root>;
}
```

### O que deveria ser
O Easyblocks passa styled components como **ReactElement**, não ComponentType. O pattern correto é:
```tsx
function OrquiStack({ Root, Children }: { Root: ReactElement; Children: ReactElement[] }) {
  return <Root.type {...Root.props}>{Children}</Root.type>;
}
```

Confirmado pela documentação: https://docs.easyblocks.io/essentials/no-code-components/styles-function

### Correção
**Arquivo:** `components/index.tsx` (reescrito)

---

## Bug #3 — CRÍTICO: `select` usa formato errado de options

### O que acontece
Todas as definitions com `type: "select"` usam:
```ts
{ prop: "align", type: "select", options: [...] }
```

### O que deveria ser
A API real do Easyblocks exige `params`:
```ts
{ prop: "align", type: "select", params: { options: [...] } }
```

Confirmado: https://docs.easyblocks.io/essentials/no-code-components/schema

São **14 ocorrências** nos arquivos de definitions.

### Correção
**Arquivos:** `definitions/layout.ts`, `definitions/content.ts`, `definitions/data.ts`, `definitions/misc.ts`

---

## Bug #4 — IMPORTANTE: Custom type `orqui-template` pode não funcionar

### O que acontece
8 props usam `type: "orqui-template"`, mas esse tipo custom pode não estar registrado corretamente no Easyblocks. Se o tipo não for reconhecido, o editor crasheia.

### Correção (temporária)
Trocar `type: "orqui-template"` por `type: "string"` em todas as definitions. Quando a integração básica funcionar, reimplementar o tipo custom na Fase 5.

**Arquivos:** `definitions/content.ts`, `definitions/data.ts`

---

## Bug #5 — IMPORTANTE: Backend interface não bate com a API real

### O que acontece
O backend atual retorna:
```ts
get() → { document: { _id, entry, meta } }  // ERRADO
create() → { id }                            // ERRADO  
update() → void                              // ERRADO
```

### O que deveria retornar
```ts
get() → { id, version, entry }    // Document
create() → { id, version, entry } // Document
update() → { id, version, entry } // Document
```

O tipo `Document = { id: string; version: number; entry: NoCodeComponentEntry }`.

### Correção
**Arquivo:** `backend.ts` (reescrito)

---

## Bug #6 — O flag `EASYBLOCKS_INSTALLED = false`

### O que acontece
O `EasyblocksPageEditor.tsx` no repo tem `const EASYBLOCKS_INSTALLED = false` e nunca importa `@easyblocks/editor`. Renderiza um placeholder.

### Correção
O `EasyblocksPageEditor.tsx` deve importar e renderizar o `<EasyblocksEditor>` real.

**Arquivo:** `EasyblocksPageEditor.tsx` (reescrito)

---

## Ordem de aplicação

1. Copiar TODOS os arquivos da pasta `fix/easyblocks/` para `packages/orqui/src/editor/easyblocks/`
2. Copiar `fix/entry.tsx` para `packages/orqui/src/editor/entry.tsx`
3. Garantir que `@easyblocks/core` e `@easyblocks/editor` estão instalados:
   ```bash
   cd packages/orqui && npm install @easyblocks/core@1.0.10 @easyblocks/editor@1.0.10 --legacy-peer-deps
   ```
4. Rodar o dev server e acessar `/__orqui`

## Como testar

1. Abrir `http://localhost:5173/__orqui`
2. Deve aparecer a topbar do Orqui com "📐 Páginas" ativo
3. O EasyblocksEditor deve carregar: sidebar de componentes à esquerda, canvas no centro, propriedades à direita
4. Arrastar um "Stack" para o canvas
5. Dentro do Stack, arrastar um "Título"
6. Clicar no título → sidebar mostra props "Conteúdo" e "Nível"
