# UI Contract Schema

Schema TypeScript completo para contratos de UI exportados de ferramentas de design.

## Tipos TypeScript

```typescript
export type ComponentState = 'default' | 'hover' | 'pressed' | 'disabled' | 'focused' | 'active'

export interface UIContractMetadata {
  projectName: string
  exportedFrom: string
  exportedAt: string
  hash: string
}

export interface UIComponentPart {
  name: string
  type?: string
  optional?: boolean
}

export interface UIComponentDefinition {
  variants: string[]
  parts?: string[]
  states?: ComponentState[]
  description?: string
}

export interface UIStyleValue {
  value: string
  unit?: string
  type?: string
}

export interface UIContractSchema {
  version: string
  metadata: UIContractMetadata
  components: Record<string, UIComponentDefinition>
  styles: Record<string, string | UIStyleValue>
}
```

---

## Descrição dos Campos

### `version` (string, obrigatório)
Versão do schema do contrato. Usado para controle de compatibilidade.

**Exemplo:**
```json
{
  "version": "1.0.0"
}
```

### `metadata` (object, obrigatório)
Metadados sobre a origem e exportação do contrato.

**Campos:**
- `projectName` (string, obrigatório): Nome do projeto de design
- `exportedFrom` (string, obrigatório): Ferramenta de origem (ex: "Figma", "Sketch")
- `exportedAt` (string, obrigatório): Timestamp ISO 8601 da exportação
- `hash` (string, obrigatório): Hash único do contrato para versionamento

**Exemplo:**
```json
{
  "metadata": {
    "projectName": "Gatekeeper Design System",
    "exportedFrom": "Figma",
    "exportedAt": "2026-01-27T20:00:00.000Z",
    "hash": "a1b2c3d4e5f6"
  }
}
```

### `components` (object, obrigatório)
Mapeamento de componentes UI com suas variantes, partes e estados.

**Estrutura:**
```typescript
Record<string, UIComponentDefinition>
```

Cada `UIComponentDefinition` contém:
- `variants` (string[]): Lista de variantes do componente
- `parts` (string[], opcional): Lista de partes/sub-elementos
- `states` (ComponentState[], opcional): Estados possíveis
- `description` (string, opcional): Descrição do componente

**Exemplo:**
```json
{
  "components": {
    "Button": {
      "variants": ["primary", "secondary", "outline", "ghost"],
      "states": ["default", "hover", "pressed", "disabled"],
      "description": "Botão principal do design system"
    },
    "Input": {
      "variants": ["default", "error"],
      "parts": ["root", "label", "helper"],
      "states": ["default", "focused", "disabled"]
    }
  }
}
```

### `styles` (object, obrigatório)
Mapeamento de propriedades visuais em formato estruturado.

**Formato da chave:**
```
component.variant.part.state.property
```

**Partes da chave:**
1. `component`: Nome do componente (ex: "Button")
2. `variant`: Nome da variante (ex: "primary")
3. `part`: Nome da parte (ex: "root", "icon")
4. `state`: Estado (ex: "default", "hover")
5. `property`: Propriedade CSS (ex: "backgroundColor", "fontSize")

**Valor:**
- Pode ser uma string simples (ex: "#007bff")
- Ou um objeto `UIStyleValue` com `value`, `unit` e `type`

**Exemplo:**
```json
{
  "styles": {
    "Button.primary.root.default.backgroundColor": "#007bff",
    "Button.primary.root.default.color": "#ffffff",
    "Button.primary.root.default.fontSize": "14px",
    "Button.primary.root.hover.backgroundColor": "#0056b3",
    "Button.secondary.root.default.backgroundColor": "#6c757d",
    "Input.default.root.default.borderColor": "#dee2e6",
    "Input.error.root.default.borderColor": "#dc3545"
  }
}
```

---

## Exemplo Completo

```json
{
  "version": "1.0.0",
  "metadata": {
    "projectName": "Gatekeeper Design System",
    "exportedFrom": "Figma",
    "exportedAt": "2026-01-27T20:00:00.000Z",
    "hash": "a1b2c3d4e5f6789"
  },
  "components": {
    "Button": {
      "variants": ["primary", "secondary", "outline", "ghost"],
      "states": ["default", "hover", "pressed", "disabled"],
      "description": "Botão principal do design system"
    },
    "Input": {
      "variants": ["default", "error", "success"],
      "parts": ["root", "label", "helper", "icon"],
      "states": ["default", "focused", "disabled"],
      "description": "Campo de input de texto"
    },
    "Card": {
      "variants": ["default", "elevated", "outlined"],
      "parts": ["root", "header", "content", "footer"],
      "description": "Container card para agrupamento de conteúdo"
    }
  },
  "styles": {
    "Button.primary.root.default.backgroundColor": "#007bff",
    "Button.primary.root.default.color": "#ffffff",
    "Button.primary.root.default.fontSize": "14px",
    "Button.primary.root.default.fontWeight": "500",
    "Button.primary.root.default.padding": "8px 16px",
    "Button.primary.root.default.borderRadius": "4px",
    "Button.primary.root.hover.backgroundColor": "#0056b3",
    "Button.primary.root.pressed.backgroundColor": "#004085",
    "Button.primary.root.disabled.backgroundColor": "#6c757d",
    "Button.primary.root.disabled.opacity": "0.6",
    "Button.secondary.root.default.backgroundColor": "#6c757d",
    "Button.secondary.root.default.color": "#ffffff",
    "Button.outline.root.default.backgroundColor": "transparent",
    "Button.outline.root.default.borderColor": "#007bff",
    "Button.outline.root.default.color": "#007bff",
    "Input.default.root.default.borderColor": "#dee2e6",
    "Input.default.root.default.fontSize": "14px",
    "Input.default.root.default.padding": "8px 12px",
    "Input.default.root.focused.borderColor": "#007bff",
    "Input.error.root.default.borderColor": "#dc3545",
    "Input.error.label.default.color": "#dc3545",
    "Card.default.root.default.backgroundColor": "#ffffff",
    "Card.default.root.default.borderRadius": "8px",
    "Card.elevated.root.default.boxShadow": "0 4px 6px rgba(0,0,0,0.1)"
  }
}
```

---

## Validação

O schema é validado pelo `UIContractValidatorService` no backend antes de ser armazenado.

### Regras de validação:

1. **Campos obrigatórios:**
   - `version` deve estar presente
   - `metadata` deve estar presente com todos os subcampos
   - `components` deve ter pelo menos 1 componente
   - `styles` deve estar presente

2. **Formato de chaves de styles:**
   - Devem seguir o padrão: `component.variant.part.state.property`
   - Todas as 5 partes devem estar presentes
   - Somente caracteres alfanuméricos são permitidos em cada parte

3. **Tipos:**
   - `version`: string
   - `metadata.projectName`: string
   - `metadata.exportedFrom`: string
   - `metadata.exportedAt`: string (ISO 8601)
   - `metadata.hash`: string
   - `components`: object (não-vazio)
   - `styles`: object

---

## Uso no Gatekeeper

O UI Contract é carregado no `ValidationContext` e utilizado pelos validators:

### **UI_PLAN_COVERAGE**
- Extrai componentes afetados pelo manifest (ex: "Button", "Input")
- Gera cláusulas requeridas para cada variante: `CL-UI-Button-primary`, `CL-UI-Button-secondary`
- Valida que todas as cláusulas estão cobertas pelo plan

### **UI_TEST_COVERAGE**
- Procura tags `@ui-clause` nos testes
- Verifica traceability entre testes e cláusulas UI
- Emite WARNING se não houver tags

Para mais detalhes sobre a API, veja [UI_CONTRACT_API.md](./UI_CONTRACT_API.md).
