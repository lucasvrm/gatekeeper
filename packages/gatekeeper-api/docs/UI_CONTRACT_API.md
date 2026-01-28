# UI Contract API

API para gerenciamento de contratos de UI exportados de ferramentas de design (Figma, etc.) e vinculados a projetos no Gatekeeper.

## Endpoints

### GET `/api/projects/:projectId/ui-contract`

Retorna o UI Contract associado a um projeto.

**Parâmetros:**
- `projectId` (path): ID do projeto

**Response 200 OK:**
```json
{
  "id": "uic_abc123",
  "projectId": "proj_xyz789",
  "version": "1.0.0",
  "hash": "abc123def456",
  "uploadedAt": "2026-01-27T22:00:00.000Z",
  "contract": {
    "version": "1.0.0",
    "metadata": {
      "projectName": "MyApp",
      "exportedFrom": "Figma",
      "exportedAt": "2026-01-27T21:00:00.000Z",
      "hash": "abc123def456"
    },
    "components": {
      "Button": {
        "variants": ["primary", "secondary", "outline"],
        "states": ["default", "hover", "pressed", "disabled"]
      }
    },
    "styles": {
      "Button.primary.root.default.backgroundColor": "#007bff",
      "Button.primary.root.hover.backgroundColor": "#0056b3"
    }
  }
}
```

**Response 404 Not Found:**
```json
{
  "error": {
    "code": "CONTRACT_NOT_FOUND",
    "message": "UI Contract not found for this project"
  }
}
```

---

### POST `/api/projects/:projectId/ui-contract`

Cria ou atualiza (upsert) o UI Contract de um projeto.

**Parâmetros:**
- `projectId` (path): ID do projeto

**Request Body:**
```json
{
  "version": "1.0.0",
  "metadata": {
    "projectName": "MyApp",
    "exportedFrom": "Figma",
    "exportedAt": "2026-01-27T21:00:00.000Z",
    "hash": "abc123def456"
  },
  "components": {
    "Button": {
      "variants": ["primary", "secondary"],
      "states": ["default", "hover", "pressed"]
    }
  },
  "styles": {
    "Button.primary.root.default.backgroundColor": "#007bff"
  }
}
```

**Response 201 Created (novo contrato):**
```json
{
  "success": true,
  "id": "uic_abc123",
  "hash": "abc123def456",
  "uploadedAt": "2026-01-27T22:00:00.000Z"
}
```

**Response 200 OK (contrato atualizado):**
```json
{
  "success": true,
  "id": "uic_abc123",
  "hash": "abc123def456",
  "uploadedAt": "2026-01-27T22:00:00.000Z"
}
```

**Response 400 Bad Request:**
```json
{
  "error": {
    "code": "INVALID_CONTRACT",
    "message": "Contract validation failed",
    "details": [
      {
        "path": "version",
        "message": "Required"
      },
      {
        "path": "metadata.hash",
        "message": "Required"
      }
    ]
  }
}
```

**Response 404 Not Found:**
```json
{
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "Project not found"
  }
}
```

---

### DELETE `/api/projects/:projectId/ui-contract`

Remove o UI Contract de um projeto.

**Parâmetros:**
- `projectId` (path): ID do projeto

**Response 204 No Content**

Sem body de resposta.

**Response 404 Not Found:**
```json
{
  "error": {
    "code": "CONTRACT_NOT_FOUND",
    "message": "UI Contract not found for this project"
  }
}
```

```json
{
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "Project not found"
  }
}
```

---

## Códigos de Erro

| Código | Status HTTP | Descrição |
|--------|-------------|-----------|
| `INVALID_CONTRACT` | 400 Bad Request | O schema do contrato é inválido (campos obrigatórios faltando, formato incorreto, etc.) |
| `VALIDATION_ERROR` | 400 Bad Request | Erro de validação genérico |
| `PROJECT_NOT_FOUND` | 404 Not Found | O projeto especificado não existe |
| `CONTRACT_NOT_FOUND` | 404 Not Found | Nenhum UI Contract encontrado para o projeto |

---

## Validação de Schema

O schema do UI Contract é validado pelo `UIContractValidatorService` no backend. Os seguintes campos são obrigatórios:

- `version` (string)
- `metadata` (object)
  - `metadata.projectName` (string)
  - `metadata.exportedFrom` (string)
  - `metadata.exportedAt` (string)
  - `metadata.hash` (string)
- `components` (object, deve ter pelo menos 1 componente)
- `styles` (object)

As chaves de `styles` devem seguir o padrão:
```
component.variant.part.state.property
```

Exemplo: `Button.primary.root.default.backgroundColor`

---

## Validators do Gate 1

O UI Contract é utilizado por dois validators no Gate 1:

### **UI_PLAN_COVERAGE** (order 11, hard block)
- Valida que o manifest/plan cobre todas as cláusulas UI necessárias
- Extrai componentes afetados pelo manifest
- Gera cláusulas requeridas baseadas no UIContract
- Compara cobertura: FAIL se houver gaps em cláusulas required

### **UI_TEST_COVERAGE** (order 12, soft block)
- Valida que os testes cobrem as cláusulas UI através de tags `@ui-clause`
- Extrai tags do arquivo de teste
- WARNING se não houver tags `@ui-clause`
- PASSED se encontrar tags

Para mais detalhes sobre o schema, veja [UI_CONTRACT_SCHEMA.md](./UI_CONTRACT_SCHEMA.md).
