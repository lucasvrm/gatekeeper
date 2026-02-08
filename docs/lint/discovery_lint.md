# Discovery Report: Lint Errors Analysis

> Relatório de análise dos 698 erros/warnings de ESLint no projeto Gatekeeper.
> Data: 2026-02-08

---

## Resumo

O projeto possui **698 problemas de lint** distribuídos em 9 categorias principais. Os mais graves são **14 erros de `react-hooks/rules-of-hooks`** que causam comportamento indefinido no React. A maioria dos problemas (618, ou 89%) são warnings de `no-explicit-any` e `no-unused-vars` que podem ser resolvidos em batch com soluções elegantes.

---

## Distribuição por Categoria

| Regra | Count | Severidade | Correção |
|-------|-------|------------|----------|
| `@typescript-eslint/no-explicit-any` | 439 | warning | Tipos específicos ou `unknown` |
| `@typescript-eslint/no-unused-vars` | 179 | warning | Remover ou prefixar com `_` |
| `react-hooks/exhaustive-deps` | 40 | warning | Adicionar deps ou usar `useCallback`/`useMemo` |
| `react-hooks/rules-of-hooks` | 14 | **error** | Refatorar - hooks antes de returns |
| `no-empty` | 9 | error | Adicionar comentário ou lógica |
| `@typescript-eslint/no-require-imports` | 7 | error | Converter para ES modules |
| `no-useless-escape` | 4 | error | Remover escapes desnecessários |
| `no-case-declarations` | 3 | error | Envolver case em bloco `{}` |
| `@typescript-eslint/no-unused-expressions` | 3 | error | Usar `void` ou remover |

---

## Arquivos Relevantes

### 1. `packages/orqui/src/editor/components/table/TableBuilder.tsx`

**Contexto:** Componente com 8 violações de `rules-of-hooks` - hooks chamados após early return.

**Evidência:**
```typescript
// linhas 25-37
export function TableBuilder({ nodeId }: TableBuilderProps) {
  const { state, updateNodeProps, openVariablePicker } = useEditor();
  const page = state.contract.pages[state.currentPage];
  if (!page) return null;  // ❌ Early return ANTES dos hooks

  const node = findNode(page.content, nodeId);
  if (!node || node.type !== "table") return null;  // ❌ Outro early return

  const p = node.props || {};
  const columns: TableColumn[] = p.columns || [];
  const [dragIdx, setDragIdx] = useState<number | null>(null);  // ❌ Hook após return
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [expandedCol, setExpandedCol] = useState<number | null>(null);
```

**Solução elegante:** Mover todos os hooks para ANTES dos early returns ou extrair lógica para sub-componentes.

---

### 2. `packages/orqui/src/editor/page-editor/PageEditor.tsx`

**Contexto:** Hook customizado chamado dentro de função regular (não React component/hook).

**Evidência:**
```typescript
// linha 523
const handleApply = () => {
  try {
    const parsed = JSON.parse(jsonText);
    // ...
    dispatch({
      type: "SET_PAGES",
      pages: { ...usePageEditor_hack_pages(), [parsed.id]: parsed },  // ❌ Hook dentro de função
    });
  }
};

// linhas 533-535 (tentativa de workaround que não funciona)
const pagesRef = useRef(usePageEditor().state.pages);
pagesRef.current = usePageEditor().state.pages;
const usePageEditor_hack_pages = () => pagesRef.current;
```

**Solução elegante:** Usar ref diretamente sem função wrapper com nome "use*".

---

### 3. `packages/orqui/src/editor/EditorProvider.tsx`

**Contexto:** Declarações léxicas em case blocks sem escopo (`no-case-declarations`).

**Evidência:**
```typescript
// linhas 138-139
case "TOGGLE_PANEL":
  const panels = new Set(state.expandedPanels);  // ❌ const em case sem bloco
  panels.has(action.panelId) ? panels.delete(action.panelId) : panels.add(action.panelId);
  return { ...state, expandedPanels: panels };
```

**Solução elegante:** Envolver case em bloco `{ }`:
```typescript
case "TOGGLE_PANEL": {
  const panels = new Set(state.expandedPanels);
  // ...
}
```

---

### 4. `packages/orqui/src/editor/hooks/usePersistentState.ts`

**Contexto:** Catch blocks vazios (`no-empty`).

**Evidência:**
```typescript
// linhas 12, 20, 39
try { localStorage.setItem(`orqui-accordion-${key}`, JSON.stringify(v)); } catch {}
//                                                                           ^^^^ vazio

try { localStorage.setItem(`orqui-tab-${key}`, v); } catch {}
```

**Solução elegante:** Adicionar comentário explícito ou usar try-catch silencioso:
```typescript
catch { /* localStorage indisponível - ignorar silenciosamente */ }
```

---

### 5. `packages/gatekeeper-api/src/api/controllers/BridgeController.ts`

**Contexto:** 6 usos de `any` em catch blocks e casts.

**Evidência:**
```typescript
// linhas 145, 215, 296, 414, 462, 548
} catch (err) {
  if (!(err as any)?._sseEmitted) {  // ❌ cast para any
    // ...
  }
}
```

**Solução elegante:** Criar interface para erros customizados:
```typescript
interface SseError extends Error {
  _sseEmitted?: boolean;
}
// uso: if (!(err as SseError)?._sseEmitted)
```

---

### 6. `packages/orqui/src/editor/components/PropsPanel.tsx`

**Contexto:** 17 variáveis destructured mas nunca usadas.

**Evidência:**
```typescript
// linha 12
const { state, selectedNode, select, removeNode, updateNodeProps, updateNodeStyle, updateGrid, openVariablePicker, dispatch } = useEditor();
//              ^^^^^^^^^^^^^ ^^^^^^ ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ nunca usados

// linha 47
const { updateNodeProps, updateNodeStyle, removeNode, updateGrid, openVariablePicker, dispatch, state } = useEditor();
//      ^^^^^^^^^^^^^^^  ^^^^^^^^^^^^^^^             ^^^^^^^^^^  ^^^^^^^^^^^^^^^^^^  ^^^^^^^^  ^^^^^ nunca usados
```

**Solução elegante:** Remover destructuring não usado ou prefixar com `_`:
```typescript
const { state, selectedNode } = useEditor();
// ou manter referência para futuro uso:
const { state, selectedNode, ..._ } = useEditor();
```

---

### 7. `packages/gatekeeper-api/src/domain/validators/gate1/ImportRealityCheck.ts`

**Contexto:** Escapes desnecessários em regex.

**Evidência:**
```typescript
// linha 156
const pattern = /\.\.\/\.\.\/\.\.\//;  // ❌ \/ desnecessário em regex literal
```

**Solução elegante:** Usar `/` diretamente:
```typescript
const pattern = /\.\.\/\.\.\/\.\.\//;  // → /\.\.\/\.\.\/\.\.\//  (manter como está, ou)
const pattern = /\.{2}\/\.{2}\/\.{2}\//;  // mais legível
```

---

### 8. `packages/orqui/src/editor/EditorProvider.tsx` (exhaustive-deps)

**Contexto:** 3 useCallback/useMemo com deps incompletas.

**Evidência:**
```typescript
// linha 571 - useMemo com 11 deps faltando
useMemo(() => {
  return {
    addNode, moveNode, openVariablePicker, redo, removeNode,
    select, setMode, setPage, undo, updateGrid, updateNodeProps, updateNodeStyle
  };
}, []);  // ❌ Array vazio mas usa 11 funções
```

**Solução elegante:** Quando intencional (funções estáveis), usar comentário:
```typescript
}, []);  // eslint-disable-next-line react-hooks/exhaustive-deps -- funções estáveis do reducer
```

---

### 9. `packages/orqui/src/editor/components/LucideIcons.tsx`

**Contexto:** 7 warnings de `react-refresh/only-export-components`.

**Evidência:**
```typescript
// linhas 52, 100, 112, 120, 175, 264, 308
export const LUCIDE_CATEGORIES = { ... };  // ❌ Constante exportada junto com componentes
export const getLucideIcon = (name: string) => { ... };  // ❌ Função exportada
export function LucideIconSelect() { ... }  // ✅ Componente
```

**Solução elegante:** Separar constantes/helpers em arquivo dedicado:
```
LucideIcons.tsx       → Apenas componentes React
lucide-constants.ts   → LUCIDE_CATEGORIES, getLucideIcon, etc.
```

---

### 10. `packages/gatekeeper-api/_tmp_count_prompts.js`

**Contexto:** Arquivo temporário com `require()`.

**Evidência:**
```javascript
// linha 1
const prompts = require('./seed-prompt-content-v2.ts');  // ❌ require em projeto ESM
```

**Solução elegante:** Deletar arquivo temporário ou converter para ESM:
```typescript
import prompts from './seed-prompt-content-v2.js';
```

---

## Estrutura de Dependências

```
EditorProvider.tsx
  ← importado por: OrquiEditor.tsx, PropsPanel.tsx, EditorCanvas.tsx, TableBuilder.tsx
  → importa de: ContractProvider.js, visibility.js

TableBuilder.tsx
  ← importado por: PropsPanel.tsx (via dynamic)
  → importa de: EditorProvider.js

BridgeController.ts
  ← importado por: agent.routes.ts
  → importa de: AgentOrchestratorBridge.ts, OrchestratorEventService.ts
```

---

## Padrões Identificados

- **Naming:** camelCase para funções, PascalCase para componentes/tipos
- **Imports:** Uso de `.js` extension em imports (ESM nodeNext)
- **Testes:** vitest, arquivos em `test/` ou `__tests__/`, naming `.spec.ts`
- **Estilo:** Tailwind + CSS-in-JS inline (orqui)

---

## Estado Atual vs Desejado

| Aspecto | Atual | Desejado |
|---------|-------|----------|
| Erros críticos (rules-of-hooks) | 14 | 0 |
| Warnings totais | 684 | < 100 |
| Cobertura de tipos (any) | 439 any | < 50 any |
| Catch blocks vazios | 9 | 0 |

---

## Riscos

1. **`rules-of-hooks` quebra React** — Comportamento indefinido em runtime
2. **439 `any` tipos** — Perda de type safety, bugs silenciosos
3. **Arquivos temporários no lint** — `_tmp_count_prompts.js`, `seed-prompt-content-v2.ts`
4. **exhaustive-deps** — Stale closures causando bugs sutis

---

## Soluções Elegantes Propostas

### Batch 1: Erros Críticos (14 fixes) — PRIORIDADE MÁXIMA

1. **TableBuilder.tsx** — Refatorar para mover hooks antes de early returns
2. **PageEditor.tsx** — Renomear `usePageEditor_hack_pages` para `getPages`
3. **EditorProvider.tsx** — Envolver cases em blocos `{ }`

### Batch 2: Arquivos Temporários (2 deletes)

1. Deletar `_tmp_count_prompts.js`
2. Corrigir ou ignorar `seed-prompt-content-v2.ts`

### Batch 3: Catch Blocks Vazios (9 fixes)

1. Adicionar comentário padrão: `/* storage unavailable */`

### Batch 4: Unused Vars (179 fixes)

1. **Script automatizado:** Prefixar com `_` ou remover
2. Regex: `'(\w+)' is defined but never used` → `_$1`

### Batch 5: Explicit Any (439 fixes)

1. **Prioridade 1:** Controllers e Services (tipagem crítica)
2. **Prioridade 2:** Editor components (usar `unknown` + type guards)
3. **Prioridade 3:** Helpers e utils (manter `any` com `// eslint-disable-line`)

---

## Arquivos NÃO Relevantes (descartados)

- `packages/gatekeeper-api/test/**` — Testes já estão ignorados no eslint.config.js
- `packages/orqui/examples/**` — Código de exemplo, não produção
- `**/artifacts/**` — Gerados automaticamente
- `**/dist/**` — Build output

---

## Configuração ESLint Atual

```javascript
// eslint.config.js (simplificado)
rules: {
  '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  '@typescript-eslint/no-explicit-any': 'warn',  // ← considerar 'error' após cleanup
}
```

**Recomendação:** Após resolver os 14 erros críticos, adicionar ignores:
```javascript
ignores: [
  '**/test/**',
  '**/examples/**',
  '**/_tmp_*',
]
```

---

## Próximos Passos

1. [ ] Corrigir 14 erros de `rules-of-hooks` (CRÍTICO)
2. [ ] Adicionar ignores para arquivos temporários
3. [ ] Script para prefixar unused vars com `_`
4. [ ] Criar tipos para erros customizados (`SseError`, etc.)
5. [ ] Separar constantes de componentes em `LucideIcons.tsx`
