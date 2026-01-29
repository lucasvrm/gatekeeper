# Contract Template v1.1

> Versao: 1.1
> Changelog: Adicionado guidelines para DELETE e manifest coverage

---

## Estrutura do Contract

```markdown
# contract_<slug>.md (v<version>)

> Objetivo: descrever o contrato normativo para <feature/fix/refactor>.
> Cada clausula MUST e testavel por observaveis.

---

## Identidade

- **schemaVersion**: <1.0>
- **slug**: `<slug>`
- **title**: <Titulo Descritivo>
- **mode**: <STRICT | RELAXED>
- **changeType**: <new | enhancement | bugfix | refactor>
- **criticality**: <low | medium | high | critical>

---

## Escopo

### O que esta incluido
- <item 1>
- <item 2>

### Nao-objetivos
- <item que NAO sera feito>

---

## Clausulas (clause = test)

### Convencoes
- Formato do ID: `CL-<PREFIX>-<NNN>`
- `kind`: behavior | error | invariant | constraint
- `normativity`: MUST | SHOULD | MAY
- `spec`: sempre em termos observaveis

### Lista de clausulas

1) **[CL-XXX-001] (kind, normativity)** — Titulo da clausula
   - **spec**: Quando <condicao>, entao <resultado>.
   - Observaveis esperados:
     - `output.propriedade === valor`
   - **negativeCases** (obrigatorio para error/security):
     - Caso que NAO deve falhar

---

## Assertion Surface

### Outputs permitidos
- `output.campo`: tipo

### Matchers policy
- Snapshots: proibidos
- Weak matchers (`toBeDefined`): proibidos como unica verificacao

---

## Test Mapping (rastreabilidade)

### Regra padrao
Cada `it/test` deve ter um comentario imediatamente acima:

\`\`\`ts
// @clause CL-XXX-001
it("should do something", async () => {
  // ...
})
\`\`\`

- allowMultiple: true
- allowUntagged: false (STRICT mode)

---

## Checklist final
- [ ] Todas as clausulas tem `id` unico
- [ ] Todas as clausulas MUST sao testaveis por observaveis
- [ ] error/security MUST contem `negativeCases`
- [ ] Assertion Surface lista tudo que os testes irao assertar
- [ ] Todo `it/test` deve ter `// @clause CL-XXX-XXX`
```

---

## Guidelines para DELETE

Quando o contract envolve operacoes DELETE, incluir:

### 1. Clausulas de Impacto

```markdown
**[CL-XXX-010] (behavior, MUST)** — Cobertura de importadores
- **spec**: Quando arquivo X e deletado, entao todos os arquivos que importam X devem estar no manifest com action MODIFY ou DELETE.
- Observaveis esperados:
  - Manifest contem todos importadores
  - Nenhum import orfao apos DELETE
```

### 2. Clausulas de Cadeia de DELETE

```markdown
**[CL-XXX-011] (behavior, MUST)** — Cadeia de DELETE
- **spec**: Quando arquivo A e deletado e arquivo B (que importa A) tambem e deletado, entao ambos devem estar no manifest.
- Observaveis esperados:
  - Ambos arquivos no manifest com action DELETE
```

### 3. No Escopo - Secao de DELETE

```markdown
### O que esta incluido
- DELETE de `src/lib/legacy.ts`
- MODIFY de `src/services/user.ts` (importa legacy.ts)
- MODIFY de `src/components/Form.tsx` (importa legacy.ts)
```

---

## Guidelines para Manifest

### Reason Best Practices

| Action | Exemplo de Reason BOM | Exemplo de Reason RUIM |
|--------|----------------------|------------------------|
| CREATE | "Novo validador para prevenir imports orfaos" | "Criar arquivo" |
| MODIFY | "Atualizar import de legacy-utils para modern-utils" | "Modificar" |
| DELETE | "Arquivo legado migrado para modern-utils.ts" | "Remover" |

### Reason Minimo

- Minimo 10 caracteres
- Deve explicar o **porque**, nao apenas o **o que**
- Deve ser especifico para o contexto

---

## Validadores Relacionados

| Validador | Gate | Verifica |
|-----------|------|----------|
| DELETE_DEPENDENCY_CHECK | 0 | Importadores de DELETEs estao no manifest |
| MANIFEST_FILE_LOCK | 1 | Arquivos do diff estao no manifest |
| NO_IMPLICIT_FILES | 1 | Nenhum arquivo implicito criado |
| DIFF_SCOPE_ENFORCEMENT | 2 | Diff dentro do escopo do manifest |
| TEST_CLAUSE_MAPPING_VALID | 1 | Cada test tem @clause mapping |

---

## Exemplo Completo: DELETE com Impacto

```markdown
# contract_remove-legacy-utils.md (v1.0)

> Objetivo: remover legacy-utils.ts e migrar para modern-utils.ts

## Identidade
- **schemaVersion**: 1.0
- **slug**: `remove-legacy-utils`
- **title**: Remocao de Legacy Utils
- **mode**: STRICT
- **changeType**: refactor
- **criticality**: medium

## Escopo

### O que esta incluido
- DELETE de `src/lib/legacy-utils.ts`
- MODIFY de `src/services/user.ts` (atualizar import)
- MODIFY de `src/components/Form.tsx` (atualizar import)

### Nao-objetivos
- Modificar API publica dos servicos
- Adicionar novas funcionalidades

## Clausulas

1) **[CL-RLU-001] (behavior, MUST)** — Remocao do arquivo legado
   - **spec**: Apos execucao, `src/lib/legacy-utils.ts` nao existe.

2) **[CL-RLU-002] (behavior, MUST)** — Atualizacao de imports
   - **spec**: Arquivos que importavam legacy-utils agora importam modern-utils.

3) **[CL-RLU-003] (invariant, MUST)** — Funcionalidade preservada
   - **spec**: Testes existentes continuam passando.
```
