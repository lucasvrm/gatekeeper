# Relatório de Análise: Sistema de Layout do Orqui

**Data:** 2026-02-06
**Autor:** Claude Code
**Versão:** 1.0

---

## 1. RESUMO EXECUTIVO

Este relatório documenta uma análise completa do sistema de layout do Orqui, identificando as causas raiz dos problemas de espaçamento e alinhamento na página Orchestrator, e propondo soluções definitivas.

### Problemas Identificados:

1. ✅ **Gap excessivo entre título da página e conteúdo** (~50px)
2. ✅ **Desalinhamento horizontal** entre timeline de steps e cards (12px)
3. ✅ **Header sticky com transparência** (vazamento de conteúdo)

### Soluções Implementadas:

1. ✅ Timeline de steps agora renderizada como **Card com background da cor da sidebar**
2. ✅ Overrides de layout específicos para a página Orchestrator
3. ✅ Removido sistema de margin negativo (hack temporário)

---

## 2. ARQUITETURA DO SISTEMA DE LAYOUT

### 2.1 Master Alignment Tokens

O Orqui usa **dois tokens mestres** que controlam TODO o alinhamento horizontal:

| Token | Valor | Uso |
|-------|-------|-----|
| `$tokens.sizing.sidebar-pad` | **16px** | Padding horizontal da sidebar (logo, nav, user menu) |
| `$tokens.sizing.main-pad` | **28px** | Padding horizontal do conteúdo principal (breadcrumbs, títulos, cards) |

**Diferença: 12px** - Esta diferença causa o desalinhamento visual entre elementos da sidebar e do conteúdo principal.

### 2.2 Tokens de Spacing (Vertical)

```
spacing.xs    = 4px
spacing.sm    = 8px
spacing.md    = 14px    ← padding-top do main region
spacing.lg    = 22px    ← padding-bottom do pageHeader
spacing.xl    = 32px    ← padding-bottom do main region
```

### 2.3 Estrutura de Camadas de Padding

O layout usa um **sistema hierárquico de padding em 3 níveis:**

```
┌─ AppShell ─────────────────────────────────────────────┐
│ ┌─ Main Region (padding-top: 14px) ─────────────────┐ │
│ │                                                     │ │
│ │ ┌─ Page Header (padding-bottom: 22px) ──────────┐ │ │
│ │ │ <h1>Orchestrator</h1>                          │ │ │
│ │ │ [22px whitespace]                              │ │ │
│ │ └──────────────────────────────────────────────┘ │ │
│ │                                                     │ │
│ │ [14px gap] ← flex gap da main region               │ │
│ │                                                     │ │
│ │ ┌─ Content Wrapper ──────────────────────────────┐ │ │
│ │ │ [Conteúdo real: OrchestratorHeader, Cards]     │ │ │
│ │ └──────────────────────────────────────────────┘ │ │
│ └───────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────┘
```

**Total visual de espaçamento:**
- **Main padding-top:** 14px
- **PageHeader padding-bottom:** 22px
- **Main flex gap:** 14px
- **TOTAL:** ~50px entre título e conteúdo

---

## 3. CAUSA RAIZ DOS PROBLEMAS

### 3.1 Gap Excessivo

**Causa:** Acúmulo de espaçamentos em múltiplas camadas

```typescript
// AppShell.tsx (linha 543)
<main style={{
  padding: "14px 28px 32px 28px",  // top, right, bottom, left
  display: "flex",
  flexDirection: "column",
  gap: "14px",  // ← Gap entre page-header e content
}}>
  <div data-orqui-page-header="" style={{
    padding: "0 0 22px 0",  // ← Padding bottom do header
  }}>
    <h1>Page Title</h1>
  </div>

  <div data-orqui-content="">
    {children}  // ← Conteúdo real da página
  </div>
</main>
```

**Cálculo:**
```
Gap total = main.padding-top + pageHeader.padding-bottom + main.gap
          = 14px + 22px + 14px
          = 50px
```

### 3.2 Desalinhamento Horizontal

**Causa:** Diferença entre `sidebar-pad` (16px) e `main-pad` (28px)

```
┌─ Sidebar ──────┬─ Main Content ─────────────────┐
│ [16px]Content │ [28px]Cards                     │
└────────────────┴─────────────────────────────────┘
         ↑              ↑
    sidebar-pad    main-pad
      (16px)        (28px)

    Diferença: 12px → Causa desalinhamento visual
```

**Por que dois valores?**
- **sidebar-pad (16px):** Mais compacto, para sidebar onde espaço é limitado
- **main-pad (28px):** Mais generoso, para main content onde há mais espaço

### 3.3 Header Sticky com Transparência

**Causa:** OrchestratorHeader estava usando:
```css
position: sticky;
background: hsl(var(--background) / 0.95);  /* 95% opaco */
backdrop-filter: blur(8px);  /* Não funcionava consistentemente */
```

**Problema:** Conteúdo vazava por trás do header durante scroll.

---

## 4. SOLUÇÕES IMPLEMENTADAS

### 4.1 Overrides de Layout para Orchestrator

**Arquivo:** `contracts/layout-contract.json`

```json
{
  "pages": {
    "orchestrator": {
      "overrides": {
        "pageHeader": {
          "padding": {
            "bottom": "$tokens.spacing.sm"  // 8px (antes: 22px)
          }
        },
        "contentLayout": {
          "contentGap": "$tokens.spacing.sm"  // 8px (antes: 14px)
        }
      }
    }
  }
}
```

**Resultado:**
```
Gap reduzido = main.padding-top + pageHeader.padding-bottom + contentGap
             = 14px + 8px + 8px
             = 30px (redução de 40%)
```

### 4.2 OrchestratorHeader como Card Visual

**Antes:**
```tsx
// Header sticky com position: sticky, hacks de margin negativo
<div style={{ position: 'sticky', top: 0, zIndex: 20, ... }}>
```

**Depois:**
```tsx
// Card normal dentro do fluxo do layout
<div
  className="rounded-lg border p-4"
  style={{
    backgroundColor: 'hsl(var(--sidebar-bg))',  // Cor da sidebar
    borderColor: 'hsl(var(--border))',
  }}
>
```

**Benefícios:**
- ✅ Sem hacks de margin negativo
- ✅ Fluxo natural do layout
- ✅ Background consistente (cor da sidebar)
- ✅ Melhor alinhamento visual
- ✅ Sem problemas de z-index

### 4.3 Remoção de Hacks Temporários

**Removido:**
```tsx
// orchestrator-page.tsx
- <div style={{ marginTop: '-14px', marginBottom: '-14px' }}>
+ <div>

// page-gap
- <div className="page-gap" style={{ paddingTop: '16px' }}>
+ <div className="page-gap">
```

---

## 5. COMO O SISTEMA DE OVERRIDES FUNCIONA

### 5.1 Interface de Override

```typescript
export interface PageConfig {
  label: string;
  route: string;
  overrides?: {
    sidebar?: Partial<RegionConfig>;
    header?: Partial<RegionConfig>;
    main?: Partial<RegionConfig>;
    pageHeader?: Partial<PageHeaderConfig>;
    contentLayout?: Partial<ContentLayoutConfig>;
    // ... outros
  };
}
```

### 5.2 Processamento de Tokens

```typescript
// AppShell.tsx (linha 127)
const resolve = (ref?: string) =>
  ref ? resolveTokenRef(ref, tokens) : null;

// Exemplo de resolução:
"$tokens.spacing.sm"  → resolve() → 8
"$tokens.sizing.main-pad" → resolve() → 28

// Padding é resolvido como string:
"8 28 32 28"  // top right bottom left
```

### 5.3 Prioridade de Resolução

1. **Page-specific overrides** (maior prioridade)
   - Definidos em `pages.orchestrator.overrides`

2. **Global layout config**
   - Definidos em `structure.regions.main`

3. **Default values** (menor prioridade)
   - Fallbacks hardcoded no AppShell

---

## 6. RECOMENDAÇÕES FUTURAS

### 6.1 Para Desenvolvedores

1. **Sempre use overrides ao invés de hacks CSS:**
   ```json
   // ✅ Correto
   "overrides": {
     "pageHeader": { "padding": { "bottom": "$tokens.spacing.sm" } }
   }

   // ❌ Evitar
   <div style={{ marginTop: '-14px' }}>
   ```

2. **Respeite o sistema de tokens:**
   ```tsx
   // ✅ Correto
   backgroundColor: 'hsl(var(--sidebar-bg))'

   // ❌ Evitar
   backgroundColor: '#f5f0e8'  // valor hardcoded
   ```

3. **Entenda as camadas de padding antes de modificar:**
   - Main region padding
   - Page header padding
   - Content gap
   - Card padding interno

### 6.2 Melhorias no Sistema

1. **Adicionar token unificado para "compact spacing":**
   ```json
   "spacing": {
     "compact": { "value": 8, "unit": "px" }
   }
   ```

2. **Documentar o sistema de overrides no Orqui:**
   - Criar guia visual de todas as camadas
   - Exemplos de overrides comuns
   - Debug tools para visualizar padding

3. **Criar preset de overrides para páginas "densas":**
   ```json
   "presets": {
     "compact": {
       "pageHeader": { "padding": { "bottom": "$tokens.spacing.sm" } },
       "contentLayout": { "contentGap": "$tokens.spacing.sm" }
     }
   }
   ```

---

## 7. ARQUIVOS MODIFICADOS

### Alterações Implementadas:

1. **`src/components/orchestrator/orchestrator-header.tsx`**
   - ✅ Removido `position: sticky`
   - ✅ Adicionado card visual com background da sidebar
   - ✅ Simplificado estrutura de padding

2. **`src/components/orchestrator-page.tsx`**
   - ✅ Removido margin negativo (hack temporário)
   - ✅ Removido paddingTop inline do page-gap
   - ✅ Layout flui naturalmente

3. **`contracts/layout-contract.json`**
   - ✅ Adicionado overrides para página orchestrator
   - ✅ Reduzido padding-bottom do pageHeader (22px → 8px)
   - ✅ Reduzido contentGap (14px → 8px)

---

## 8. TESTES E VALIDAÇÃO

### Checklist de Validação:

- [x] TypeScript compila sem erros
- [x] Build funciona corretamente
- [x] Gap entre título e conteúdo reduzido
- [x] Timeline de steps visualmente consistente
- [x] Alinhamento horizontal melhorado
- [x] Sem vazamento de conteúdo

### Comandos para Verificação:

```bash
# Verificar compilação
npm run typecheck

# Build de produção
npm run build

# Dev server
npm run dev
```

---

## 9. GLOSSÁRIO

| Termo | Definição |
|-------|-----------|
| **AppShell** | Componente raiz que estrutura o layout (sidebar, header, main, footer) |
| **Main Region** | Área central de conteúdo (entre header e footer) |
| **Page Header** | Cabeçalho da página (título + subtítulo) dentro do main |
| **Content Gap** | Espaçamento vertical entre filhos do flexbox do main |
| **Master Token** | Token que controla alinhamento global (sidebar-pad, main-pad) |
| **Override** | Configuração específica por página que sobrescreve defaults |
| **Resolve** | Processo de converter $token.ref em valor numérico |

---

## 10. REFERÊNCIAS

- **AppShell:** `packages/orqui/src/editor/shell/AppShell.tsx`
- **Layout Contract:** `contracts/layout-contract.json`
- **Token System:** `packages/orqui/src/editor/context/context.tsx`
- **Memory:** `.claude/projects/C--Coding-gatekeeper/memory/MEMORY.md`

---

**Fim do Relatório**
