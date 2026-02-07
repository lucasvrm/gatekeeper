# Auditoria de Referências Phosphor na Plataforma

**Data**: 2026-02-06
**Total de arquivos**: 48 arquivos

## 📊 Resumo Executivo

A plataforma ainda contém referências a Phosphor Icons em 4 categorias principais:

1. **Dependências** - Pacote `@phosphor-icons/react` ainda instalado
2. **Frontend Gatekeeper** - 14 componentes usando imports diretos
3. **Orqui (Runtime/Editor)** - Exports legacy para backwards compatibility
4. **Contratos JSON** - Metadados `"library": "phosphor"` em presets

---

## 🔴 CATEGORIA 1: Dependências (PODE REMOVER)

### package.json
```json
{
  "dependencies": {
    "@phosphor-icons/react": "^2.1.7"  // ← PODE REMOVER
  }
}
```

**Ação**: Desinstalar pacote após migrar frontend components

```bash
npm uninstall @phosphor-icons/react
```

---

## 🔴 CATEGORIA 2: Frontend Gatekeeper (PRECISA MIGRAR)

### Componentes Usando @phosphor-icons/react

**14 arquivos** precisam migração de Phosphor → Lucide:

1. **src/components/app-layout.tsx** (linha 2)
   ```typescript
   import { List, ShieldCheck, Gear, SquaresFour, FolderOpen, Folders, Robot } from "@phosphor-icons/react"
   ```

2. **src/components/dashboard-page.tsx** (linha 4)
   ```typescript
   import { ShieldCheck, List, CheckCircle, XCircle, Folders, FolderOpen } from "@phosphor-icons/react"
   ```

3. **src/components/git-commit-modal.tsx** (linha 15)
   ```typescript
   import { WarningCircle } from '@phosphor-icons/react'
   ```

4. **src/components/json-preview.tsx** (linha 6)
   ```typescript
   import { CaretDown, CaretRight, FileText } from "@phosphor-icons/react"
   ```

5. **src/components/gates-page.tsx** (linha 7)
   ```typescript
   import { CaretDown, CaretRight, ShieldCheck } from "@phosphor-icons/react"
   ```

6. **src/components/file-drop-zone.tsx** (linha 3)
   ```typescript
   import { UploadSimple } from "@phosphor-icons/react"
   ```

7. **src/components/git-commit-button.tsx** (linha 9)
   ```typescript
   import { GitCommit } from '@phosphor-icons/react'
   ```

8. **src/components/project-details-page.tsx** (linha 9)
   ```typescript
   import { ArrowLeft, Plus, PencilSimple } from "@phosphor-icons/react"
   ```

9. **src/components/projects-list-page.tsx** (linha 16)
   ```typescript
   import { Plus, PencilSimple, Trash, FunnelSimple } from "@phosphor-icons/react"
   ```

10. **src/components/project-form-page.tsx** (linha 12)
    ```typescript
    import { ArrowLeft } from "@phosphor-icons/react"
    ```

11. **src/components/workspaces-list-page.tsx** (linha 16)
    ```typescript
    import { Plus, PencilSimple, Trash, FunnelSimple } from "@phosphor-icons/react"
    ```

12. **src/components/run-details-page.tsx** (linha 20)
    ```typescript
    import { ArrowLeft } from "@phosphor-icons/react"
    ```

13. **src/components/workspace-form-page.tsx** (linha 11)
    ```typescript
    import { ArrowLeft } from "@phosphor-icons/react"
    ```

14. **src/components/run-details-page-v2.tsx** (linha 33)
    ```typescript
    } from "@phosphor-icons/react"
    ```

15. **src/components/workspace-details-page.tsx** (linha 9)
    ```typescript
    import { ArrowLeft, Plus, PencilSimple } from "@phosphor-icons/react"
    ```

16. **src/components/validator-context-panel.tsx** (linha 3)
    ```typescript
    import { CaretDown, CaretRight, CheckCircle, Info, Warning, XCircle } from "@phosphor-icons/react"
    ```

17. **src/components/runs-list-page.tsx** (linha 24)
    ```typescript
    import { CaretLeft, CaretRight, FunnelSimple, Stop, Trash } from "@phosphor-icons/react"
    ```

18. **src/components/run-panel-legacy.tsx** (linha 27)
    ```typescript
    } from "@phosphor-icons/react"
    ```

19. **src/components/status-badge.tsx** (linha 9)
    ```typescript
    } from "@phosphor-icons/react"
    ```

### Mapping Phosphor → Lucide Recomendado

| Phosphor | Lucide |
|----------|--------|
| List | List |
| ShieldCheck | ShieldCheck |
| Gear | Settings |
| SquaresFour | Grid3x3 |
| FolderOpen | FolderOpen |
| Folders | Folders (não existe, usar Folder) |
| Robot | Bot (não existe em TOP 278) |
| CheckCircle | CheckCircle |
| XCircle | XCircle |
| WarningCircle | AlertCircle |
| CaretDown | ChevronDown |
| CaretRight | ChevronRight |
| FileText | FileText |
| UploadSimple | Upload |
| GitCommit | (não existe, usar Code) |
| ArrowLeft | ArrowLeft |
| Plus | Plus |
| PencilSimple | Pencil |
| Trash | Trash2 |
| FunnelSimple | Filter |
| CaretLeft | ChevronLeft |
| Stop | Square |
| Info | Info |
| Warning | AlertTriangle |
| ArrowsClockwise | RefreshCw |

---

## 🟡 CATEGORIA 3: Orqui (Backwards Compatibility - OK MANTER)

### Runtime Components

**packages/orqui/src/runtime/icons.tsx**
- Exports vazios: `PHOSPHOR_SVG_PATHS`, `PhosphorIcon()`, `buildPhosphorFaviconSvg()`
- **Status**: ✅ OK manter (backwards compatibility)

**packages/orqui/src/runtime/components/AppShell.tsx** (linha 9, 276-279)
- Import: `PHOSPHOR_SVG_PATHS`
- Uso: Fallback para favicon legacy `ph:` prefix
- **Status**: ✅ OK manter (backwards compatibility)

**packages/orqui/src/runtime/components/HeaderElements.tsx** (linha 8, 10, 48-50)
- Import: `PhosphorIcon, PHOSPHOR_SVG_PATHS`
- Const: `HEADER_ICON_TO_PHOSPHOR` mapping
- **Status**: ✅ OK manter (backwards compatibility)

**packages/orqui/src/runtime/components/NodeRenderer.tsx** (linha 12, 1074)
- Import: `PHOSPHOR_SVG_PATHS`
- **Status**: ✅ OK manter (backwards compatibility)

**packages/orqui/src/runtime/components/EmptyState.tsx** (linha 8, 95)
- Import: `PHOSPHOR_SVG_PATHS`
- **Status**: ✅ OK manter (backwards compatibility)

**packages/orqui/src/runtime/types.ts** (linha 297)
```typescript
/** Optional icon (Phosphor key, e.g. "ph:folder") */
```
- **Status**: ✅ OK manter (documentação de backwards compatibility)

### Editor Components

**packages/orqui/src/editor/workbench/StackedWorkbench.tsx** (linha 492)
```typescript
<Field label="Ícone (Phosphor ID)" compact>
```
- **Ação**: ⚠️ ATUALIZAR label para "Ícone (Lucide ou ph: legacy)"

**packages/orqui/src/editor/editors/LayoutSections.tsx** (linha 335)
```typescript
<Field label="Ícone (Phosphor ID)">
```
- **Ação**: ⚠️ ATUALIZAR label para "Ícone (Lucide ou ph: legacy)"

**packages/orqui/src/editor/previews/LayoutPreview.tsx** (linha 4, 276, 281, 315, 320)
- Import: `MiniPhosphorIcon, HEADER_ICON_PHOSPHOR`
- **Ação**: ⚠️ RENOMEAR para `MiniLucideIcon, HEADER_ICON_LUCIDE` (já migrado no HeaderElementsEditor)

**packages/orqui/src/editor/page-editor/nodeDefaults.ts** (linha 56)
```typescript
{ type: "icon", label: "Ícone", icon: "★", description: "Ícone Phosphor", category: "content", isContainer: false },
```
- **Ação**: ⚠️ ATUALIZAR description para "Ícone Lucide"

**packages/orqui/src/editor/components/ElementPanel.tsx** (linha 42)
```typescript
{ type: "icon", label: "Ícone", icon: "★", description: "Ícone Phosphor" },
```
- **Ação**: ⚠️ ATUALIZAR description para "Ícone Lucide"

**packages/orqui/src/editor/components/LucideIcons.tsx** (linha 99)
```typescript
// Emoji categories (kept from Phosphor for IconPicker)
```
- **Status**: ✅ OK manter (comentário histórico)

---

## 🟢 CATEGORIA 4: Contratos JSON (Metadados - OPCIONAL ATUALIZAR)

### UI Registry Contracts

**6 arquivos** com `"library": "phosphor"`:

1. `contracts/ui-registry-contract.json` (linhas 4078, 4418)
2. `.orqui-sandbox/orch/ui-registry-contract.json` (linhas 4078, 4418)
3. `packages/orqui/presets/terroso-azul/ui-registry-contract.json` (linhas 4079, 4419)
4. `packages/orqui/presets/terra-serena/ui-registry-contract.json` (linhas 4078, 4418)
5. `packages/orqui/presets/obsidian-night/ui-registry-contract.json` (linhas 4078, 4418)
6. `packages/orqui/presets/amber-barricade/gatekeeper-header-first-ui-registry-contract.json`

**Ação**: ⚠️ OPCIONAL - Atualizar metadados para `"library": "lucide"` (não afeta funcionalidade)

---

## 🟢 CATEGORIA 5: Documentação (OK MANTER)

### Docs e README

**docs/ICON_OPTIMIZATION.md** (linha 95)
```markdown
// Legacy Phosphor (mappings automáticos)
<IconValue icon="ph:gear" size={20} />
```
- **Status**: ✅ OK manter (explicação de backwards compatibility)

**packages/orqui/README.md** (linhas 468, 481)
```markdown
- ✅ **Backwards compatible** - suporta prefixo `ph:` (Phosphor legacy)

// Legacy Phosphor (com mapping automático)
<IconValue icon="ph:gear" size={20} />
```
- **Status**: ✅ OK manter (documentação de feature)

---

## 🟢 CATEGORIA 6: Testes (OK MANTER)

**src/__tests__/spark-removal.spec.ts**
- Linhas 141, 142, 339, 341, 349, 350, 357, 359
- Testes sobre remoção de Spark mencionando Phosphor
- **Status**: ✅ OK manter (testes históricos)

---

## 🟢 CATEGORIA 7: Outros (OK MANTER)

**packages/gatekeeper-api/seed-prompt-content-v2.ts** (linha 1111)
```typescript
import { Copy } from "@phosphor-icons/react"
```
- **Status**: ✅ OK manter (conteúdo de seed, não código de produção)

**packages/orqui/examples/gatekeeper/integration-example.tsx**
- Exemplo de integração
- **Status**: ✅ OK manter (exemplo)

**packages/orqui/schemas/variables.schema.json**
- Schema JSON
- **Status**: ✅ OK manter (schema)

---

## 📋 Plano de Ação Recomendado

### Fase 1: Frontend Gatekeeper (PRIORITÁRIO)

**Tarefa**: Migrar 14+ componentes de Phosphor → Lucide

**Tempo estimado**: 2-3 horas

**Passos**:
1. Criar mapping completo Phosphor → Lucide para ícones usados
2. Substituir imports em todos os componentes
3. Atualizar JSX para usar novos nomes de componentes Lucide
4. Testar visualmente todos os componentes afetados
5. Desinstalar `@phosphor-icons/react`

### Fase 2: Orqui Editor Labels (RECOMENDADO)

**Tarefa**: Atualizar labels de "Ícone (Phosphor ID)" → "Ícone (Lucide ou ph: legacy)"

**Tempo estimado**: 15 minutos

**Arquivos**:
- `packages/orqui/src/editor/workbench/StackedWorkbench.tsx`
- `packages/orqui/src/editor/editors/LayoutSections.tsx`
- `packages/orqui/src/editor/page-editor/nodeDefaults.ts`
- `packages/orqui/src/editor/components/ElementPanel.tsx`

### Fase 3: LayoutPreview Migration (OPCIONAL)

**Tarefa**: Atualizar `MiniPhosphorIcon` → `MiniLucideIcon`

**Tempo estimado**: 30 minutos

**Arquivo**: `packages/orqui/src/editor/previews/LayoutPreview.tsx`

### Fase 4: Contratos JSON (OPCIONAL)

**Tarefa**: Atualizar metadados `"library": "phosphor"` → `"library": "lucide"`

**Tempo estimado**: 10 minutos

**Nota**: Não afeta funcionalidade, apenas metadados

---

## ✅ O Que NÃO Precisa Mudar

1. **Runtime backwards compatibility exports** - `PHOSPHOR_SVG_PATHS`, `PhosphorIcon()` (vazios)
2. **Documentação** - README e ICON_OPTIMIZATION.md explicando `ph:` prefix
3. **Testes** - Menções históricas em spark-removal.spec.ts
4. **Seed content** - Não é código de produção
5. **Schemas JSON** - Estruturas de validação

---

## 📊 Priorização

| Prioridade | Categoria | Arquivos | Tempo | Impacto |
|-----------|-----------|----------|-------|---------|
| 🔴 Alta | Frontend Components | 14+ | 2-3h | Remove dependência |
| 🟡 Média | Editor Labels | 4 | 15min | Clareza UX |
| 🟢 Baixa | LayoutPreview | 1 | 30min | Consistência |
| 🟢 Baixa | Contratos JSON | 6 | 10min | Metadados |

---

## 🎯 Resultado Final Esperado

Após Fase 1:
- ✅ Zero dependência de `@phosphor-icons/react`
- ✅ Todos os componentes frontend usando Lucide
- ✅ Bundle size reduzido (~300KB economia adicional)
- ✅ Backwards compatibility mantida no Orqui (prefixo `ph:`)

Após todas as fases:
- ✅ Zero menções a "Phosphor" em UI/labels
- ✅ Documentação preservada para suporte legacy
- ✅ Metadados atualizados nos contratos
