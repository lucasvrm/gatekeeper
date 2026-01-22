# Gatekeeper API - Scripts Auxiliares

Scripts utilitários para desenvolvimento e debugging do Gatekeeper.

## 📁 Scripts Disponíveis

### `check-conventions.mjs`

Verifica as convenções de path configuradas no banco de dados.

**Uso:**
```bash
npx tsx scripts/check-conventions.mjs
```

**Output:** JSON com todas as `TestPathConvention` configuradas, incluindo:
- `workspaceId`: Workspace associado (ou `__global__`)
- `testType`: Tipo de teste (component, hook, lib, etc.)
- `pathPattern`: Pattern do path (ex: `src/components/__tests__/{name}.spec.tsx`)
- `isActive`: Se a convenção está ativa

**Exemplo de output:**
```json
[
  {
    "id": "...",
    "workspaceId": "__global__",
    "testType": "component",
    "pathPattern": "src/components/__tests__/{name}.spec.tsx",
    "description": "Default component test convention",
    "isActive": true,
    "createdAt": "...",
    "updatedAt": "..."
  },
  {
    "id": "...",
    "workspaceId": "workspace-1",
    "testType": "hook",
    "pathPattern": "src/hooks/__tests__/{name}.test.ts",
    "description": "Workspace-specific hook convention",
    "isActive": true,
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```

## ➕ Adicionando Novos Scripts

Ao criar novos scripts auxiliares:

1. Coloque o arquivo em `scripts/`
2. Use extensão `.mjs` para ESM modules
3. Documente aqui no README com:
   - Nome do script
   - O que ele faz
   - Como usar
   - Exemplo de output

## 🔧 Boas Práticas

- Scripts devem ser idempotentes quando possível
- Sempre use `await prisma.$disconnect()` ao final
- Adicione tratamento de erros adequado
- Prefira output estruturado (JSON) para fácil parsing
