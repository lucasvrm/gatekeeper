# Orqui v2 — Contract Specification

## 1. Visão Geral

O contrato Orqui v2 é um documento JSON que descreve **completamente** a interface de uma aplicação: layout, navegação, conteúdo, dados, e regras de visibilidade. É a fonte da verdade que:

1. **O editor visual** produz (via drag-and-drop)
2. **O runtime** consome (renderiza páginas)
3. **LLMs** leem (geram código correto)

### Mudanças em relação ao v1

| Aspecto | v1 | v2 |
|---------|----|----|
| Layout | Regiões fixas (sidebar, header, main, footer) | **Node tree** flexível por página |
| Conteúdo | Estático (labels, placeholders) | **Templates `{{}}`** com variáveis dinâmicas |
| Navegação | Hardcoded no runtime | **Array declarativo**, drag-and-drop |
| Header | Zonas fixas | **Elementos posicionáveis** (left/center/right) |
| Tabelas | Não existia | **Table builder** com colunas configuráveis |
| Visibilidade | Overrides por página | **Regras condicionais** por elemento |
| Grid | Não existia | **Grid flexível** por página (colunas, spans) |
| Variáveis | Não existia | **Schema externo** por projeto |

---

## 2. Arquitetura de Arquivos

```
projeto/
├── contracts/
│   ├── layout-contract.json          ← Contrato de layout (output do editor)
│   └── ui-registry-contract.json     ← Registry de componentes (preservado do v1)
├── orqui.variables.json              ← Schema de variáveis (escrito pelo projeto)
└── vite.config.ts                    ← Plugin Orqui v2
```

### Persistência

| Camada | Storage | Escopo |
|--------|---------|--------|
| Contrato final | Filesystem (JSON) | Versionado no git |
| Drafts do editor | IndexedDB | Browser local, temporário |
| Variable schema | Filesystem (JSON) | Escrito pelo desenvolvedor |

Sem banco de dados. Sem Prisma. Sem backend dedicado.

---

## 3. Estrutura do Contrato

```json
{
  "$orqui": { },          // Metadados (schema, version, hash)
  "app": { },             // Identidade do app (nome, logo, favicon)
  "tokens": { },          // Design tokens (preservado do v1)
  "textStyles": { },      // Tipografia (preservado do v1)
  "shell": { },           // Layout global (sidebar, header)
  "navigation": [ ],      // Itens de navegação (array ordenável)
  "pages": { }            // Definição de cada página
}
```

---

## 4. Seção `$orqui` — Metadados

```json
{
  "$orqui": {
    "schema": "layout-contract",
    "version": "2.0.0",
    "hash": "sha256:...",
    "generatedAt": "2026-02-02T..."
  }
}
```

Idêntico ao v1. Hash SHA-256 do conteúdo (excluindo `$orqui`).

---

## 5. Seção `app` — Identidade

```json
{
  "app": {
    "name": "Gatekeeper",
    "favicon": {
      "type": "emoji",
      "value": "🛡️"
    },
    "logo": {
      "type": "icon-text",
      "text": "Gatekeeper",
      "icon": "Shield",
      "font": { "family": "Inter", "size": 18, "weight": 700 }
    }
  }
}
```

---

## 6. Seções `tokens` e `textStyles`

**Preservadas integralmente do v1.** Mesma estrutura de tokens (spacing, sizing, colors, borderRadius, etc.) e textStyles (heading-1, body, caption, etc.).

---

## 7. Seção `shell` — Layout Global

O shell define o "frame" que envolve todas as páginas. É estruturado (não é free-form) porque 90% das apps seguem o padrão sidebar + header + content.

```json
{
  "shell": {
    "layout": "sidebar-left",
    "sidebar": {
      "width": 260,
      "collapsedWidth": 64,
      "collapsible": true,
      "background": "$tokens.colors.sidebar-bg",
      "sections": [
        { "id": "logo", "type": "logo" },
        { "id": "nav", "type": "navigation" },
        { "id": "footer", "type": "slot", "props": { "name": "sidebar-footer" } }
      ],
      "separators": {
        "afterLogo": { "enabled": true, "color": "$tokens.colors.border" },
        "beforeFooter": { "enabled": true, "color": "$tokens.colors.border" }
      }
    },
    "header": {
      "height": 56,
      "background": "$tokens.colors.header-bg",
      "left": [
        { "id": "breadcrumbs", "type": "breadcrumbs", "props": { "separator": "/" } }
      ],
      "center": [],
      "right": [
        { "id": "search", "type": "search", "props": { "placeholder": "Buscar..." } },
        { "id": "icon-bell", "type": "icon-button", "props": { "icon": "Bell", "route": "/notifications" } },
        { "id": "cta-main", "type": "button", "props": { "label": "Nova Validação", "variant": "primary", "route": "/runs/new" } }
      ]
    },
    "footer": {
      "enabled": false,
      "height": 40
    }
  }
}
```

### Shell layouts disponíveis

| Layout | Descrição |
|--------|-----------|
| `sidebar-left` | Sidebar à esquerda (mais comum) |
| `sidebar-right` | Sidebar à direita |
| `topbar` | Sem sidebar, apenas header |
| `minimal` | Sem sidebar nem header |

### Sidebar sections

Cada `section` na sidebar é um slot ordenável:

| Type | Descrição |
|------|-----------|
| `logo` | Logo do app |
| `navigation` | Referência ao array `navigation` |
| `search` | Campo de busca |
| `slot` | Slot genérico para conteúdo custom |

### Header zones

O header tem 3 zonas: `left`, `center`, `right`. Cada zona é um array de **elementos** que podem ser arrastados entre zonas no editor.

Tipos de elementos no header:

| Type | Props | Descrição |
|------|-------|-----------|
| `breadcrumbs` | `separator` | Trail de navegação |
| `search` | `placeholder` | Campo de busca |
| `button` | `label`, `variant`, `route` | Botão CTA |
| `icon-button` | `icon`, `route`, `badge` | Ícone clicável |
| `text` | `content` | Texto livre com `{{}}` |
| `slot` | `name` | Slot para conteúdo custom |

---

## 8. Seção `navigation` — Menu

Array ordenável de itens de navegação. O editor permite drag-and-drop para reordenar.

```json
{
  "navigation": [
    {
      "id": "dashboard",
      "label": "Dashboard",
      "icon": "House",
      "route": "/",
      "order": 0
    },
    {
      "id": "runs",
      "label": "Runs",
      "icon": "Play",
      "route": "/runs",
      "order": 1,
      "badge": "{{stats.pending_runs}}"
    },
    {
      "id": "mcp",
      "label": "MCP",
      "icon": "Terminal",
      "route": "/mcp",
      "order": 5,
      "visibility": {
        "condition": "{{feature.mcp_enabled}}"
      }
    },
    {
      "id": "divider-1",
      "type": "divider",
      "order": 4
    },
    {
      "id": "config",
      "label": "Config",
      "icon": "Gear",
      "route": "/config",
      "order": 6,
      "position": "bottom"
    }
  ]
}
```

### Campos de um nav item

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | string | Identificador único |
| `label` | string | Texto exibido |
| `icon` | string | Nome do ícone Phosphor |
| `route` | string | Rota de navegação |
| `order` | number | Posição (definida por drag-and-drop) |
| `badge` | string | Badge com `{{}}` (ex: contagem) |
| `position` | `"top"` \| `"bottom"` | Posição na sidebar (default: top) |
| `type` | `"item"` \| `"divider"` \| `"group"` | Tipo do item |
| `visibility` | VisibilityRule | Regra de visibilidade |
| `children` | NavItem[] | Sub-itens (para menus aninhados) |

---

## 9. Seção `pages` — Definição de Páginas

Cada página define seu próprio layout como uma **árvore de nodes**. Isso é o coração do Orqui v2.

```json
{
  "pages": {
    "dashboard": {
      "id": "dashboard",
      "label": "Dashboard",
      "route": "/",
      "browserTitle": "Dashboard — {{$app.name}}",
      "header": {
        "cta": { "enabled": true, "label": "Nova Validação", "route": "/runs/new" }
      },
      "content": { }
    }
  }
}
```

### Page header overrides

Cada página pode sobrescrever elementos do header:

```json
{
  "header": {
    "cta": {
      "enabled": true,
      "label": "Novo Lead",
      "route": "/leads/new",
      "variant": "primary"
    },
    "hideElements": ["search"],
    "addElements": {
      "right": [
        { "id": "filter", "type": "button", "props": { "label": "Filtros", "variant": "outline", "icon": "Funnel" } }
      ]
    }
  }
}
```

### Page content — Node Tree

O `content` de uma página é uma árvore de **nodes**. Cada node tem:

```typescript
interface Node {
  id: string;                      // Identificador único
  type: NodeType;                  // Tipo do node
  props?: Record<string, any>;     // Propriedades específicas do tipo
  children?: Node[];               // Filhos (para layouts e containers)
  style?: StyleOverrides;          // Estilo customizado
  visibility?: VisibilityRule;     // Regra de visibilidade
}
```

---

## 10. Tipos de Node

### Layout Nodes

**`grid`** — CSS Grid

```json
{
  "id": "main-grid",
  "type": "grid",
  "props": {
    "columns": 3,
    "gap": "$tokens.spacing.lg",
    "columnGap": "$tokens.spacing.lg",
    "rowGap": "$tokens.spacing.md"
  },
  "children": [
    { "id": "col1", "type": "...", "props": { "span": 2 } },
    { "id": "col2", "type": "...", "props": { "span": 1 } }
  ]
}
```

| Prop | Tipo | Descrição |
|------|------|-----------|
| `columns` | number | Número de colunas |
| `gap` | token ref | Gap entre itens |
| `columnGap` | token ref | Gap horizontal |
| `rowGap` | token ref | Gap vertical |

Filhos de um grid podem ter `props.span` para definir quantas colunas ocupam.

**`stack`** — Vertical stack (flexbox column)

```json
{
  "id": "page-stack",
  "type": "stack",
  "props": { "gap": "$tokens.spacing.lg" },
  "children": [ ]
}
```

**`row`** — Horizontal row (flexbox row)

```json
{
  "id": "filter-row",
  "type": "row",
  "props": {
    "gap": "$tokens.spacing.sm",
    "align": "center",
    "justify": "space-between"
  },
  "children": [ ]
}
```

**`container`** — Generic wrapper

```json
{
  "id": "wrapper",
  "type": "container",
  "props": { "padding": "$tokens.spacing.lg", "background": "$tokens.colors.surface" },
  "children": [ ]
}
```

### Content Nodes

**`text`** — Texto com templates

```json
{ "id": "desc", "type": "text", "props": { "content": "Total de {{stats.count}} validações", "textStyle": "body" } }
```

**`heading`** — Título

```json
{ "id": "title", "type": "heading", "props": { "content": "{{$page.label}}", "level": 1, "textStyle": "heading-1" } }
```

**`stat-card`** — Card de métrica

```json
{
  "id": "total-runs",
  "type": "stat-card",
  "props": {
    "label": "Total Runs",
    "value": "{{stats.total_runs}}",
    "icon": "Play",
    "trend": "{{stats.total_trend}}",
    "trendDirection": "up"
  }
}
```

**`card`** — Card genérico

```json
{
  "id": "activity-card",
  "type": "card",
  "props": { "title": "Atividade Recente", "padding": "$tokens.spacing.md" },
  "children": [ ]
}
```

**`button`** — Botão

```json
{ "id": "new-btn", "type": "button", "props": { "label": "Criar", "variant": "primary", "icon": "Plus", "route": "/new" } }
```

**`badge`** — Badge/tag

```json
{ "id": "status", "type": "badge", "props": { "content": "{{run.status}}", "colorMap": { "passed": "success", "failed": "danger", "running": "warning" } } }
```

**`image`** — Imagem

```json
{ "id": "avatar", "type": "image", "props": { "src": "{{user.avatar_url}}", "size": 32, "rounded": true } }
```

**`icon`** — Ícone

```json
{ "id": "check", "type": "icon", "props": { "name": "CheckCircle", "size": 16, "color": "$tokens.colors.success" } }
```

**`divider`** — Separador

```json
{ "id": "sep", "type": "divider", "props": { "color": "$tokens.colors.border" } }
```

**`spacer`** — Espaço

```json
{ "id": "sp", "type": "spacer", "props": { "size": "$tokens.spacing.xl" } }
```

### Data Nodes

**`table`** — Tabela de dados

```json
{
  "id": "runs-table",
  "type": "table",
  "props": {
    "dataSource": "runs",
    "emptyMessage": "Nenhuma run encontrada",
    "rowHeight": 48,
    "sortable": true,
    "pagination": { "enabled": true, "pageSize": 20 },
    "columns": [
      {
        "key": "id",
        "label": "Run ID",
        "width": "12%",
        "content": "{{run.id | truncate:8}}",
        "link": "/runs/{{run.id}}"
      },
      {
        "key": "status",
        "label": "Status",
        "width": "10%",
        "content": "{{run.status | badge}}"
      },
      {
        "key": "project",
        "label": "Projeto",
        "width": "20%",
        "content": "{{run.project.name}}"
      },
      {
        "key": "created",
        "label": "Criado",
        "width": "15%",
        "content": "{{run.created_at | date:relative}}",
        "sortField": "created_at"
      },
      {
        "key": "actions",
        "label": "",
        "width": "10%",
        "content": "{{$actions: view, rerun, delete}}",
        "align": "right"
      }
    ]
  }
}
```

**Colunas de tabela:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `key` | string | Identificador da coluna |
| `label` | string | Header da coluna |
| `width` | string | Largura (%, px, fr) |
| `content` | string | Template `{{}}` do conteúdo da célula |
| `link` | string | Template de rota (torna célula clicável) |
| `align` | string | Alinhamento (left, center, right) |
| `sortField` | string | Campo para ordenação |
| `visibility` | VisibilityRule | Visibilidade da coluna |

**`list`** — Lista/feed

```json
{
  "id": "activity-list",
  "type": "list",
  "props": {
    "dataSource": "recent_activity",
    "maxItems": 10,
    "template": {
      "type": "row",
      "props": { "gap": "$tokens.spacing.sm", "align": "center" },
      "children": [
        { "type": "icon", "props": { "name": "{{activity.icon}}", "size": 16 } },
        { "type": "text", "props": { "content": "{{activity.user}} {{activity.action}}", "textStyle": "body-sm" } },
        { "type": "text", "props": { "content": "{{activity.time | date:relative}}", "textStyle": "caption" } }
      ]
    }
  }
}
```

**`key-value`** — Pares chave-valor

```json
{
  "id": "run-details",
  "type": "key-value",
  "props": {
    "layout": "horizontal",
    "items": [
      { "label": "ID", "value": "{{run.id}}" },
      { "label": "Status", "value": "{{run.status | badge}}" },
      { "label": "Projeto", "value": "{{run.project.name}}" },
      { "label": "Duração", "value": "{{run.duration | duration}}" }
    ]
  }
}
```

### Navigation Nodes

**`tabs`** — Abas

```json
{
  "id": "detail-tabs",
  "type": "tabs",
  "props": {
    "items": [
      { "id": "overview", "label": "Visão Geral" },
      { "id": "validators", "label": "Validadores" },
      { "id": "logs", "label": "Logs" }
    ],
    "defaultTab": "overview"
  }
}
```

### Input Nodes

**`search`** — Campo de busca

```json
{ "id": "search", "type": "search", "props": { "placeholder": "Buscar runs...", "debounce": 300 } }
```

**`select`** — Dropdown

```json
{ "id": "status-filter", "type": "select", "props": { "placeholder": "Status", "options": "{{$enum.run.status}}" } }
```

### Special Nodes

**`slot`** — Slot nomeado para injeção runtime

```json
{ "id": "custom-area", "type": "slot", "props": { "name": "run-actions" } }
```

O runtime mapeia slots para componentes React reais:

```tsx
<PageRenderer page="run-details" data={data} slots={{
  "run-actions": <RunActionsToolbar run={currentRun} />
}} />
```

**`component`** — Referência ao registry

```json
{ "id": "alert-1", "type": "component", "props": { "name": "Alert", "variant": "destructive", "children": "{{run.error_message}}" } }
```

---

## 11. Style Overrides

Qualquer node pode ter `style` para customizações pontuais:

```json
{
  "id": "hero",
  "type": "container",
  "style": {
    "background": "$tokens.colors.surface-2",
    "borderRadius": "$tokens.borderRadius.lg",
    "padding": "$tokens.spacing.xl",
    "border": "1px solid $tokens.colors.border"
  }
}
```

Os valores podem ser:
- Token references: `"$tokens.colors.border"`
- Valores diretos: `"16px"`, `"#ff0000"`, `"1px solid red"`

---

## 12. Template Syntax `{{}}`

### Sintaxe básica

```
{{entity.field}}                     Variável simples
{{entity.field | formatter}}         Com formatter
{{entity.field | formatter:arg}}     Com argumento
{{entity.nested.field}}              Acesso aninhado
{{$app.name}}                        Variável global do app
{{$page.label}}                      Metadado da página
{{$enum.entity.field}}               Valores enum de um campo
{{$actions: view, edit, delete}}     Ações disponíveis
```

### Prefixos especiais

| Prefixo | Descrição | Exemplo |
|---------|-----------|---------|
| (nenhum) | Variável de entidade | `{{run.status}}` |
| `$app.` | Dados do app | `{{$app.name}}` |
| `$page.` | Metadados da página | `{{$page.label}}` |
| `$enum.` | Valores de enum | `{{$enum.run.status}}` |
| `$actions:` | Ações de linha | `{{$actions: view, delete}}` |
| `$nav.` | Dados de navegação | `{{$nav.items}}` |

### Formatters built-in

| Formatter | Argumento | Exemplo | Output |
|-----------|-----------|---------|--------|
| `badge` | colorMap (opcional) | `{{status \| badge}}` | Badge colorido |
| `date` | format | `{{created \| date:relative}}` | "2h atrás" |
| `date:short` | — | `{{created \| date:short}}` | "15 Jan" |
| `date:full` | — | `{{created \| date:full}}` | "15 de Janeiro de 2026" |
| `date:iso` | — | `{{created \| date:iso}}` | "2026-01-15" |
| `currency` | code | `{{value \| currency:BRL}}` | "R$ 1.234,56" |
| `number` | — | `{{count \| number}}` | "1,234" |
| `number:compact` | — | `{{count \| number:compact}}` | "1.2K" |
| `percent` | — | `{{ratio \| percent}}` | "85%" |
| `truncate` | length | `{{id \| truncate:8}}` | "abc123..." |
| `uppercase` | — | `{{name \| uppercase}}` | "LUCAS" |
| `lowercase` | — | `{{name \| lowercase}}` | "lucas" |
| `capitalize` | — | `{{name \| capitalize}}` | "Lucas" |
| `duration` | — | `{{ms \| duration}}` | "2m 34s" |
| `boolean` | trueVal/falseVal | `{{active \| boolean:Sim/Não}}` | "Sim" |
| `boolean:icon` | — | `{{active \| boolean:icon}}` | ✓ / ✕ |
| `icon` | — | `{{status_icon \| icon}}` | Ícone renderizado |
| `link` | route template | `{{name \| link:/users/{{id}}}}` | Link clicável |
| `color` | — | `{{hex \| color}}` | Swatch de cor |
| `default` | fallback | `{{name \| default:N/A}}` | "N/A" se vazio |

### Composição de formatters

Formatters podem ser encadeados:

```
{{run.id | truncate:8 | uppercase}}
{{run.created_at | date:relative | default:Pendente}}
```

---

## 13. Regras de Visibilidade

Qualquer node, nav item, ou coluna de tabela pode ter uma regra de visibilidade:

```json
{
  "visibility": {
    "pages": ["leads", "dashboard"],
    "condition": "{{user.role}} === 'admin'",
    "breakpoints": { "hidden": ["mobile"] }
  }
}
```

### Campos

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `pages` | string[] | Páginas onde o elemento aparece. `["*"]` = todas. |
| `condition` | string | Expressão condicional com `{{}}` |
| `breakpoints` | object | Regras responsivas |

### Operadores suportados em conditions

```
{{user.role}} === 'admin'
{{stats.count}} > 0
{{feature.mcp_enabled}} === true
{{run.status}} !== 'pending'
{{items.length}} >= 5
```

### Shorthand

Para o caso mais comum (visibilidade por página), pode-se usar a forma curta:

```json
{ "visibility": { "pages": ["leads", "dashboard"] } }
```

---

## 14. Variable Schema (`orqui.variables.json`)

Cada projeto declara suas variáveis num arquivo separado. O Orqui lê esse arquivo para:
1. Oferecer autocomplete no editor
2. Validar templates no contrato
3. Gerar dados mock para preview

```json
{
  "$orqui": {
    "schema": "variables",
    "version": "1.0.0"
  },
  "entities": {
    "run": {
      "label": "Validation Run",
      "fields": {
        "id": { "type": "string", "label": "Run ID", "example": "run_abc123" },
        "status": {
          "type": "enum",
          "label": "Status",
          "values": ["pending", "running", "passed", "failed"],
          "colorMap": {
            "pending": "warning",
            "running": "accent",
            "passed": "success",
            "failed": "danger"
          },
          "example": "passed"
        },
        "project": {
          "type": "ref",
          "label": "Projeto",
          "entity": "project"
        },
        "created_at": { "type": "date", "label": "Criado em", "example": "2026-02-01T10:30:00Z" },
        "duration": { "type": "number", "label": "Duração (ms)", "example": 154000 }
      }
    }
  },
  "globals": {
    "feature": {
      "mcp_enabled": { "type": "boolean", "label": "MCP Habilitado", "example": true }
    },
    "stats": {
      "total_runs": { "type": "number", "label": "Total de Runs", "example": 142 }
    }
  },
  "actions": {
    "view": { "label": "Ver", "icon": "Eye" },
    "edit": { "label": "Editar", "icon": "PencilSimple" },
    "delete": { "label": "Excluir", "icon": "Trash", "variant": "danger", "confirm": true },
    "rerun": { "label": "Re-executar", "icon": "ArrowClockwise" }
  }
}
```

### Entity fields types

| Type | Descrição | Props extras |
|------|-----------|-------------|
| `string` | Texto livre | `maxLength`, `pattern` |
| `number` | Número | `min`, `max`, `unit` |
| `boolean` | Verdadeiro/falso | — |
| `date` | Data/hora | `format` |
| `enum` | Valor de um conjunto | `values`, `colorMap` |
| `ref` | Referência a outra entidade | `entity` |
| `array` | Lista de valores | `items` |
| `object` | Objeto aninhado | `fields` |

### Campo `example`

Todo field deve ter um `example`. O editor usa esses valores para:
1. Preview de tabelas com dados realistas
2. Preview de cards e layouts
3. Validação visual do template

### Campo `colorMap`

Para enums que precisam de cores (status, prioridade, etc.), o `colorMap` mapeia valores para tokens de cor:

```json
{
  "colorMap": {
    "passed": "success",
    "failed": "danger",
    "running": "accent",
    "pending": "warning"
  }
}
```

O formatter `badge` usa automaticamente o colorMap.

### Campo `actions`

Define ações disponíveis para rows de tabela e listas. O template `{{$actions: view, edit, delete}}` renderiza os ícones/botões correspondentes.

---

## 15. Data Flow

```
┌─────────────────────┐     ┌──────────────────────┐
│  orqui.variables    │     │  layout-contract.json │
│  (schema)           │     │  (template)           │
└────────┬────────────┘     └──────────┬────────────┘
         │                             │
         │  ┌──────────────────────┐   │
         └──│     Orqui Editor     │───┘
            │  (drag-and-drop)     │
            └──────────┬───────────┘
                       │ produz
                       ▼
            ┌──────────────────────┐
            │ layout-contract.json │  ← Contrato atualizado
            └──────────┬───────────┘
                       │ lido por
                       ▼
            ┌──────────────────────┐     ┌──────────────────┐
            │    Orqui Runtime     │◄────│   Data Context    │
            │  (PageRenderer)      │     │ { run: {...}, ... }│
            └──────────┬───────────┘     └──────────────────┘
                       │ renderiza
                       ▼
            ┌──────────────────────┐
            │     UI Final         │
            │  (React components)  │
            └──────────────────────┘
```

---

## 16. Integração no App Consumidor

```tsx
// App.tsx (Gatekeeper)
import { ContractProvider, PageRenderer } from "@orqui/runtime";
import contract from "../contracts/layout-contract.json";
import registry from "../contracts/ui-registry-contract.json";
import variables from "../orqui.variables.json";

function App() {
  return (
    <ContractProvider
      layout={contract}
      registry={registry}
      variables={variables}
    >
      <Router>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/runs" element={<RunsListPage />} />
        </Routes>
      </Router>
    </ContractProvider>
  );
}

function RunsListPage() {
  const { runs } = useRunsData();

  return (
    <PageRenderer
      page="runs-list"
      data={{ runs }}
      slots={{
        "custom-filters": <AdvancedFilters />
      }}
      onAction={(action, item) => {
        if (action === "view") navigate(`/runs/${item.id}`);
        if (action === "delete") handleDelete(item.id);
      }}
    />
  );
}
```

### PageRenderer props

| Prop | Tipo | Descrição |
|------|------|-----------|
| `page` | string | Chave da página no contrato |
| `data` | object | Dados reais para resolver `{{}}` |
| `slots` | Record<string, ReactNode> | Conteúdo custom para slots nomeados |
| `onAction` | (action, item) => void | Handler de ações (tabela, lista) |
| `navigate` | (route) => void | Função de navegação |

---

## 17. Resumo dos Tipos (TypeScript)

```typescript
// Contrato raiz
interface LayoutContractV2 {
  $orqui: OrquiMeta;
  app: AppConfig;
  tokens: Tokens;
  textStyles: TextStyles;
  shell: ShellConfig;
  navigation: NavItem[];
  pages: Record<string, PageDefinition>;
}

// Página
interface PageDefinition {
  id: string;
  label: string;
  route: string;
  browserTitle?: string;
  header?: PageHeaderOverrides;
  content: Node;
}

// Node (unidade fundamental)
interface Node {
  id: string;
  type: NodeType;
  props?: Record<string, any>;
  children?: Node[];
  style?: Record<string, string>;
  visibility?: VisibilityRule;
}

// Visibilidade
interface VisibilityRule {
  pages?: string[];
  condition?: string;
  breakpoints?: { hidden?: string[] };
}

// Item de navegação
interface NavItem {
  id: string;
  label?: string;
  icon?: string;
  route?: string;
  order: number;
  type?: "item" | "divider" | "group";
  badge?: string;
  position?: "top" | "bottom";
  visibility?: VisibilityRule;
  children?: NavItem[];
}
```
