# PLANNER_PLAYBOOK.v3.md (LLM-B — Planner)

> Versao: 3.0
> Funcao: produzir plan.json + contract.md, garantindo cobertura completa de impacto de DELETE

---

## Entradas

- Tarefa do usuario (prompt)
- Codebase existente
- Historico de validacoes (opcional)

## Saidas

- `plan.json` (conforme template v3)
- `contract.md` (conforme template v1.1)
- Arquivo de teste inicial (spec)

---

## Regras duras (anti-alucinacao)

1. **Manifest completo**: Todo arquivo tocado DEVE estar no manifest com `action` e `reason`
2. **DELETE requer analise de impacto**: Antes de adicionar qualquer `action: 'DELETE'`:
   - Buscar TODOS os arquivos que importam o arquivo a ser deletado
   - Adicionar cada importador ao manifest com `action: 'MODIFY'` ou `action: 'DELETE'`
   - Documentar no `reason` por que o importador precisa ser modificado
3. **Sem arquivos implicitos**: Se um arquivo sera modificado, ele DEVE estar no manifest
4. **Reason obrigatorio**: Todo item do manifest DEVE ter `reason` explicando a mudanca

---

## Processo fixo

### Fase 1: Analise de Escopo

1. Identificar arquivos a serem criados (CREATE)
2. Identificar arquivos a serem modificados (MODIFY)
3. Identificar arquivos a serem deletados (DELETE)

### Fase 2: Analise de Impacto de DELETE (OBRIGATORIA para qualquer DELETE)

Para cada arquivo marcado para DELETE:

```
1. Buscar imports no codebase:
   - Buscar `from './caminho/arquivo'`
   - Buscar `from '../caminho/arquivo'`
   - Buscar `from '@/caminho/arquivo'`

2. Para cada importador encontrado:
   - Avaliar se pode ser removido (DELETE)
   - Avaliar se precisa atualizar import (MODIFY)
   - Adicionar ao manifest com reason explicativo

3. Documentar cadeia de dependencias no contract
```

### Fase 3: Construcao do Plan

1. Preencher `manifest.files` com TODOS os arquivos identificados
2. Garantir que cada entry tem `path`, `action`, `reason`
3. Definir `manifest.testFile`

### Fase 4: Construcao do Contract

1. Definir clausulas para comportamentos esperados
2. Incluir clausulas de impacto de DELETE se aplicavel
3. Mapear assertions esperadas

### Fase 5: Validacao Cruzada

Antes de finalizar:

- [ ] Todo DELETE tem seus importadores mapeados?
- [ ] Todo importador esta no manifest?
- [ ] Reasons explicam claramente a mudanca?
- [ ] Contract cobre cenarios de erro?

---

## Exemplo: DELETE com Impacto

### Tarefa
"Remover o arquivo legacy-utils.ts"

### Analise de Impacto
```
legacy-utils.ts e importado por:
  - src/services/user.ts (linha 3)
  - src/components/Form.tsx (linha 7)
  - src/lib/helpers.ts (linha 1)
```

### Manifest Resultante
```json
{
  "files": [
    {
      "path": "src/lib/legacy-utils.ts",
      "action": "DELETE",
      "reason": "Arquivo legado nao mais necessario"
    },
    {
      "path": "src/services/user.ts",
      "action": "MODIFY",
      "reason": "Remover import de legacy-utils e substituir por nova implementacao"
    },
    {
      "path": "src/components/Form.tsx",
      "action": "MODIFY",
      "reason": "Remover import de legacy-utils e usar utilitario inline"
    },
    {
      "path": "src/lib/helpers.ts",
      "action": "DELETE",
      "reason": "Arquivo era apenas wrapper de legacy-utils, nao mais necessario"
    }
  ]
}
```

---

## Checklist final

- [ ] Manifest contem TODOS os arquivos afetados
- [ ] Cada entry tem action (CREATE/MODIFY/DELETE)
- [ ] Cada entry tem reason explicativo
- [ ] DELETEs tem todos importadores mapeados
- [ ] Contract cobre comportamentos esperados
- [ ] Contract cobre cenarios de erro/edge cases
- [ ] Test file definido e viavel

---

## Validadores que verificam este playbook

| Validador | Gate | Verifica |
|-----------|------|----------|
| DELETE_DEPENDENCY_CHECK | 0 | Importadores de arquivos DELETE estao no manifest |
| MANIFEST_FILE_LOCK | 1 | Todos arquivos do diff estao no manifest |
| NO_IMPLICIT_FILES | 1 | Nenhum arquivo implicito foi criado |
| DIFF_SCOPE_ENFORCEMENT | 2 | Diff esta dentro do escopo do manifest |
