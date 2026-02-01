# Orqui — UI Layout & Component Contract System

Sistema de contratos visuais para aplicações React. O Orqui define e aplica layouts, tokens de design, tipografia, componentes e comportamentos de UI via contratos JSON, com editor visual integrado.

## Instalação

```bash
# No seu projeto
npm install @orqui/cli
# ou
yarn add @orqui/cli

# Inicializar contratos
npx orqui init
```

Isso cria:
- `contracts/layout-contract.json` — layout, tokens, tipografia
- `contracts/ui-registry-contract.json` — registro de componentes

## Configuração do Vite

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { orquiPlugin } from "@orqui/cli/vite-plugin";

export default defineConfig({
  plugins: [
    react(),
    orquiPlugin(), // Habilita o editor em /__orqui e API de save
  ],
});
```

O plugin:
- Serve o editor visual em `http://localhost:5173/__orqui`
- Expõe API REST para salvar contratos no filesystem (`POST /__orqui/api/save`)
- Carrega contratos existentes via `GET /__orqui/api/contracts`

## Configuração do Vitest

O Orqui não interfere nos testes, mas se precisar mockar os contratos:

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // Excluir editor do coverage
    coverage: {
      exclude: [
        "node_modules/@orqui/cli/src/editor/**",
        "contracts/**",
      ],
    },
  },
});
```

```ts
// src/test/setup.ts (opcional — mock do ContractProvider)
import { vi } from "vitest";

// Se precisar mockar o provider em testes unitários:
vi.mock("@orqui/cli/runtime", async () => {
  const actual = await vi.importActual("@orqui/cli/runtime");
  return {
    ...actual,
    useContract: () => ({
      layout: { structure: { regions: {} }, tokens: {}, textStyles: {} },
      registry: { components: {} },
      resolveToken: () => null,
      getTextStyle: () => ({}),
      getTokenValue: () => "",
      color: () => "",
      tokens: {},
    }),
  };
});
```

## package.json

```json
{
  "dependencies": {
    "@orqui/cli": "^1.0.0",
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0"
  },
  "devDependencies": {
    "vite": "^5.0.0 || ^6.0.0",
    "@vitejs/plugin-react": "^4.0.0"
  },
  "scripts": {
    "dev": "vite",
    "orqui:status": "npx orqui status",
    "orqui:verify": "npx orqui verify"
  }
}
```

## Uso Básico

### 1. ContractProvider + AppShell

```tsx
// src/App.tsx
import { ContractProvider, AppShell } from "@orqui/cli/runtime";
import layoutContract from "../contracts/layout-contract.json";
import registryContract from "../contracts/ui-registry-contract.json";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";

function App() {
  return (
    <ContractProvider layout={layoutContract} registry={registryContract}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ContractProvider>
  );
}

function AppRoutes() {
  const navigate = useNavigate();

  return (
    <Routes>
      <Route path="/" element={<DashboardPage navigate={navigate} />} />
      <Route path="/leads" element={<LeadsPage navigate={navigate} />} />
      <Route path="/settings" element={<SettingsPage navigate={navigate} />} />
    </Routes>
  );
}
```

### 2. Páginas com AppShell

```tsx
function DashboardPage({ navigate }) {
  return (
    <AppShell
      page="dashboard"           // ← chave da página no contrato
      navigate={navigate}         // ← para breadcrumbs e header icons navegarem
      sidebarNav={<SidebarNav />}
      onSearch={(q) => console.log("busca:", q)}
      onCTA={() => navigate("/new")}
      onIconClick={(id, route) => {
        console.log(`Icon ${id} clicked, route: ${route}`);
        if (route) navigate(route);
      }}
    >
      <h1>Dashboard</h1>
    </AppShell>
  );
}

function LeadsPage({ navigate }) {
  return (
    <AppShell
      page="leads"              // ← overrides CTA "Novo Lead" habilitado
      navigate={navigate}
      sidebarNav={<SidebarNav />}
      onCTA={() => navigate("/leads/new")}
    >
      <h1>Leads</h1>
    </AppShell>
  );
}
```

### 3. Props do AppShell

| Prop | Tipo | Descrição |
|------|------|-----------|
| `page` | `string` | Chave da página — aplica overrides do contrato |
| `navigate` | `(route: string) => void` | Função de navegação (react-router `useNavigate()`) |
| `sidebarHeader` | `ReactNode` | Conteúdo custom no header da sidebar (substituído pela logo se configurada) |
| `sidebarNav` | `ReactNode` | Links de navegação da sidebar |
| `sidebarFooter` | `ReactNode` | Footer da sidebar (perfil, logout, etc) |
| `headerLeft` | `ReactNode` | Conteúdo à esquerda do header |
| `headerCenter` | `ReactNode` | Conteúdo no centro do header |
| `headerRight` | `ReactNode` | Conteúdo à direita do header |
| `onSearch` | `(query: string) => void` | Callback do campo de busca |
| `onCTA` | `() => void` | Callback do botão CTA |
| `onIconClick` | `(id: string, route?: string) => void` | Callback dos ícones do header |
| `children` | `ReactNode` | Conteúdo principal |

## Breadcrumbs

### Configuração no Editor

1. Abrir `http://localhost:5173/__orqui`
2. Tab **Layout** → sub-tab **Breadcrumbs**
3. Configurar:
   - **Enabled**: liga/desliga
   - **Position**: `header` (no header) ou `sidebar-top`/`sidebar-bottom`
   - **Alignment**: esquerda, centro, direita (quando position = header)
   - **Separator**: `/`, `>`, `|`, `→`, `·`
   - **Clickable**: itens anteriores são links clicáveis
   - **Mostrar Home**: exibe "Home" como primeiro item
   - **Label Home**: texto do item Home (padrão: "Home")
   - **Rota Home**: rota de redirecionamento (padrão: "/")

### Como funciona

Os breadcrumbs são **automáticos**. O `AppShell` usa a prop `page` para:
1. Buscar o `label` da página em `structure.pages`
2. Montar o trail: `Home / {pageLabel}`
3. Cada item anterior é clicável e usa `navigate()` para redirecionar

### Pré-requisito: Pages configuradas

Para breadcrumbs funcionarem, configure páginas no editor (tab **Pages**):

```json
// No contrato (structure.pages)
{
  "dashboard": { "label": "Dashboard", "route": "/dashboard" },
  "leads": { "label": "Leads", "route": "/leads" },
  "settings": { "label": "Configurações", "route": "/settings" }
}
```

Depois passe `page="dashboard"` no `AppShell` e `navigate={useNavigate()}`.

### Contrato gerado

```json
{
  "breadcrumbs": {
    "enabled": true,
    "position": "header",
    "alignment": "left",
    "separator": "/",
    "clickable": true,
    "showHome": true,
    "homeLabel": "Home",
    "homeRoute": "/"
  }
}
```

## Header Elements

### Ícones com rotas

Cada ícone do header pode ter uma rota de navegação:

```json
{
  "headerElements": {
    "icons": {
      "enabled": true,
      "items": [
        { "id": "bell", "route": "/notifications" },
        { "id": "settings", "route": "/settings" },
        { "id": "user", "route": "/profile" }
      ]
    },
    "cta": {
      "enabled": true,
      "label": "Nova Validação",
      "variant": "default",
      "route": "/validations/new"
    },
    "search": {
      "enabled": true,
      "placeholder": "Buscar..."
    }
  }
}
```

Quando o usuário clica num ícone ou no CTA:
1. Se `navigate` prop está definida e o item tem `route` → navega automaticamente
2. Se `onIconClick`/`onCTA` está definido → chama o callback
3. Ambos podem coexistir

### Variantes do CTA

| Variante | Estilo |
|----------|--------|
| `default` | Fundo primary, texto branco |
| `destructive` | Fundo vermelho |
| `outline` | Transparente com borda |
| `secondary` | Fundo cinza secundário |
| `ghost` | Transparente sem borda |

## Logo

### Tipos

- **Texto**: apenas nome da aplicação
- **Ícone + Texto**: emoji/imagem + nome
- **Imagem**: logo completo (upload ou URL)

### Configurações disponíveis

- **Tipografia**: fonte (48 Google Fonts), tamanho, peso (300-900), cor, letter-spacing
- **Ícone**: emoji preset, input manual, ou upload de imagem (drag-and-drop)
- **Tamanho do ícone**: slider 12-48px
- **Gap ícone↔texto**: slider 0-24px
- **Padding do container**: top/right/bottom/left em px
- **Posição**: sidebar ou header (com slot left/center/right)
- **Alinhamento na sidebar**: esquerda, centro, direita
- **Alinhamento variável**: quando ativo, o container da logo na sidebar tem a mesma altura que o header

## Favicon

### Configuração

Tab **Favicon** no editor:
- **Nenhum**: sem favicon custom
- **Emoji**: converte emoji para SVG e injeta como favicon
- **Imagem**: upload de .ico/.png/.svg via drag-and-drop ou URL

O favicon é injetado automaticamente no `<head>` pelo `AppShell`.

## Sidebar

### Largura expandida e colapsada

Tab **Regions** → **Sidebar** → **Dimensions**:
- **Width**: largura expandida (ex: `$tokens.sizing.sidebar-width` → 240px)
- **Min Width (collapsed)**: largura colapsada (ex: 64px)

### Comportamento colapsado

Tab **Regions** → **Sidebar** → **Collapsed Display**:
- **Icon only**: mostra apenas ícones dos itens de nav
- **First letter only**: mostra apenas a primeira letra de cada item
- **Icon + first letter**: mostra ambos

### Botão de colapso

4 posições:
- **Header (end)**: ao lado da logo na sidebar
- **Center**: entre nav e footer na sidebar
- **Bottom**: no footer da sidebar
- **Borda fixa (centro vertical)**: botão fixo na borda da sidebar, centralizado verticalmente no espaço abaixo do header. Posição: `top = headerHeight + (viewport - headerHeight) / 2`. Sempre visível, independente de scroll.

### Separadores

Tab **Regions** → **Sidebar** → **Separators**:
- **Header separator**: linha entre logo e nav
- **Footer separator**: linha entre nav e footer
- **Nav group separators**: linha entre grupos de navegação

Cada separador tem: **Visible** (toggle), **Color** (token), **Width** (token), **Style** (solid/dashed/dotted/none).

## Multi-page

### Configuração de páginas

Tab **Pages** no editor — CRUD de páginas com:
- **Nome** (chave): usado na prop `page="dashboard"`
- **Label**: nome exibido em breadcrumbs e nav
- **Route**: rota da página (ex: `/dashboard`)
- **Overrides**: cada página pode sobrescrever regions, headerElements, etc

### Overrides por página

```json
{
  "pages": {
    "leads": {
      "label": "Leads",
      "route": "/leads",
      "overrides": {
        "headerElements": {
          "cta": { "enabled": true, "label": "Novo Lead", "route": "/leads/new" }
        }
      }
    },
    "settings": {
      "label": "Settings",
      "route": "/settings",
      "overrides": {
        "sidebar": { "enabled": false }
      }
    }
  }
}
```

O `AppShell` faz deep-merge automático: `base layout + page overrides`.

## Botão Desfazer

O editor mantém um snapshot do estado no momento do último **Save to Project**. Se você fez alterações que não quer manter, clique em **↩ Desfazer** no header do editor para restaurar o estado ao último save.

O botão só aparece quando há alterações não salvas.

## Tokens de Design

### Categorias

| Categoria | Exemplos | Uso |
|-----------|----------|-----|
| `colors` | bg, text, primary, accent | CSS variables `--background`, `--foreground`, etc |
| `spacing` | 2xs (2px), xs (4px), sm (8px), md (16px) | Paddings, gaps, margins |
| `sizing` | sidebar-width, header-height, icon-md | Dimensões fixas |
| `fontFamilies` | sans, serif, mono | Font stacks |
| `fontSizes` | xs (11px) a 2xl (24px) | Tamanhos de texto |
| `fontWeights` | regular (400) a bold (700) | Pesos |
| `borderRadius` | sm (4px) a full (9999px) | Cantos arredondados |
| `borderWidth` | thin (1px) a thick (3px) | Bordas |

### Referência via token

Campos de dimensão/cor no contrato usam referências:
```
$tokens.sizing.sidebar-width  →  resolve para 240px
$tokens.colors.border          →  resolve para #2a2a33
$tokens.spacing.md             →  resolve para 16px
```

## Text Styles

```tsx
import { Text } from "@orqui/cli/runtime";

<Text style_name="heading-1">Título Principal</Text>
<Text style_name="body-md">Texto normal</Text>
<Text style_name="caption" as="span">Legenda</Text>
```

## Hooks disponíveis

```tsx
import {
  useContract,      // Acesso completo ao contrato
  useToken,         // Resolve um token específico
  useTextStyle,     // Retorna CSSProperties de um textStyle
  useTokens,        // Todos os tokens
  useColor,         // Resolve uma cor pelo nome
  useComponentDef,  // Definição de componente do registry
  cssVar,           // Gera nome da CSS variable
} from "@orqui/cli/runtime";

// Exemplo
const bg = useColor("bg");           // "#0a0a0b"
const gap = useToken("spacing", "md"); // "16px"
const style = useTextStyle("body-md"); // { fontSize: "14px", ... }
```

## CLI

```bash
npx orqui init      # Cria contratos iniciais
npx orqui status    # Mostra estado dos contratos
npx orqui verify    # Verifica integridade dos hashes
```

## Drag-and-Drop

O editor aceita drag-and-drop em vários lugares:
- **Import**: arraste um `.json` (layout ou registry contract)
- **Logo imagem**: arraste PNG/JPG/SVG
- **Logo ícone**: arraste uma imagem para o ícone
- **Favicon**: arraste .ico/.png/.svg

## Estrutura de Arquivos

```
projeto/
├── contracts/
│   ├── layout-contract.json       # Layout, tokens, tipografia
│   └── ui-registry-contract.json  # Registro de componentes
├── node_modules/@orqui/cli/
│   ├── src/
│   │   ├── runtime.tsx            # ContractProvider, AppShell, hooks
│   │   ├── editor/
│   │   │   ├── OrquiEditor.tsx    # Editor visual completo
│   │   │   └── entry.tsx          # Entry point do editor
│   │   └── vite-plugin.js         # Plugin Vite
│   └── package.json
├── vite.config.ts
└── src/
    └── App.tsx
```
