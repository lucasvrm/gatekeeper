/**
 * Agent Pipeline — Prompt Content Constants
 *
 * These constants contain the full text of all playbooks, questionnaires,
 * and templates used by the 4-step TDD pipeline.
 *
 * Source: prompts-instructions-templates.zip (uploaded 2026-02-03)
 * Segments: create_plan/ generate_spec/ implement_code/
 */

// ─── Step 0: Discovery (Substep interno do Step 1) ──────────────────────────

export const DISCOVERY_PLAYBOOK_CONTENT = `# DISCOVERY_PLAYBOOK.md (v1 — Codebase Explorer)

> Função: mapear o codebase gerando discovery_report.md com evidências reais,
> que será injetado no Planner para produzir microplans mais precisos.

---

## Objetivo

Explorar o codebase e gerar um relatório estruturado com:
- Arquivos relevantes para a tarefa (com snippets de evidência)
- Dependências e imports
- Padrões e convenções do projeto
- Estado atual vs. desejado
- Riscos e trade-offs
- Arquivos/abordagens descartadas (com justificativa)

---

## Ferramentas disponíveis

- \`read_file(path)\`: Ler conteúdo completo de um arquivo
- \`glob_pattern(pattern)\`: Buscar arquivos por padrão glob (ex: "src/**/*.ts")
- \`grep_pattern(pattern, path?)\`: Buscar texto em arquivos

---

## Regras de execução

1. **Máximo 30 iterações** — seja eficiente nas buscas
2. **Cada afirmação precisa de evidência** — snippet real de código (5-10 linhas)
3. **Não inventar** — se não encontrou, documente explicitamente
4. **Exploração focada** — começar por arquivos mencionados na task
5. **Priorizar código sobre configs** — entender comportamento antes de build

---

## Formato de output: discovery_report.md

\`\`\`markdown
# Discovery Report

**Task**: [descrição da tarefa]
**Generated**: [timestamp]

---

## 1. Resumo Executivo

[1-3 parágrafos sumarizando o que foi encontrado]

---

## 2. Arquivos Relevantes

### 2.1 [Arquivo 1]
**Path**: \`path/to/file.ts\`
**Relevância**: [por que é importante para a task]
**Evidência**:
\`\`\`typescript
// linhas X-Y
[snippet real de 5-10 linhas]
\`\`\`

### 2.2 [Arquivo 2]
[mesma estrutura]

---

## 3. Dependências e Imports

**Bibliotecas externas**:
- \`react\` (v18.2.0) — usado em componentes UI
- \`express\` (v4.18.0) — servidor HTTP backend

**Alias de import**:
- \`@/\` → \`src/\` (configurado em tsconfig.json)

**Padrões de estrutura**:
- Services em \`src/services/\`
- Controllers em \`src/api/controllers/\`

---

## 4. Padrões e Convenções

**Naming**:
- Componentes: PascalCase (\`Button.tsx\`)
- Services: PascalCase (\`AgentRunner.ts\`)
- Utils: camelCase (\`formatDate.ts\`)

**Testes**:
- Unitários: \`test/unit/*.spec.ts\`
- Integração: \`test/integration/*.spec.ts\`
- Framework: Vitest

**Error handling**:
- Backend: erro com \`{ error: string, code?: string }\`
- Frontend: throw Error com mensagem descritiva

---

## 5. Estado Atual vs. Desejado

**Atual**:
- [descrever comportamento/estrutura atual com evidência]

**Desejado** (conforme task):
- [descrever mudança necessária]

**Gap**:
- [o que precisa ser criado/modificado/deletado]

---

## 6. Riscos e Trade-offs

**Riscos identificados**:
- [risco 1: ex.: "Breaking change em API pública"]
- [risco 2: ex.: "Alteração em schema de DB sem migration"]

**Trade-offs**:
- [trade-off 1: ex.: "Adicionar campo vs. criar nova tabela"]

---

## 7. Descartados

**Abordagens/arquivos considerados mas descartados**:
- \`src/legacy/old-service.ts\`: deprecated, não usar (comentário na linha 1 confirma)
- Padrão X: descartado porque [motivo com evidência]

---

## 8. Recomendações para o Planner

[1-3 bullets de orientações para o Planner gerar microplans]
- ex.: "Começar por criar tipos em \`types.ts\`, depois implementar service"
- ex.: "Evitar tocar em \`config/\` (fora do escopo da task)"

---

## Metadata

- **Arquivos lidos**: [N]
- **Arquivos relevantes**: [M]
- **Iterações usadas**: [X/30]
\`\`\`

---

## Checklist final

- [ ] Cada afirmação tem snippet de evidência
- [ ] Riscos identificados (se houver)
- [ ] Abordagens descartadas documentadas
- [ ] Recomendações concretas para o Planner
- [ ] Relatório salvo como \`discovery_report.md\`
`

// ─── Step 1: Planner ─────────────────────────────────────────────────────────

export const PLANNER_PLAYBOOK_CONTENT = `# PLANNER_PLAYBOOK.md (v2 — CreateRun payload)

> Função (LLM-A / Planner): gerar **somente** o que o Gatekeeper aceita no \`POST /runs\`:
> - \`plan.json\` (payload do CreateRunSchema)
> - \`contract.md\` (conteúdo do campo \`contract\` dentro do plan)
> Além disso, preparar a lista de arquivos que serão **enviados por upload** (ex.: spec/test file), mas **sem embutir conteúdo do spec no plan.json**.

---

## Entradas
- Descrição da tarefa (texto curto)
- Código real do repo (fonte de verdade)
- \`LLM_CONTRACT_QUESTIONNAIRES.v3.md\` (LLM-first)
- \`plan.template.v3.json\`

## Saídas
1) \`plan.json\` (CreateRun payload)
2) \`contract.md\` (espelho do objeto \`contract\` dentro do plan)
3) Checklist de uploads do run (nomes dos arquivos que serão enviados via endpoint de upload)
   - ex.: \`manifest.testFile\` (spec)

---

## Regras duras (anti-alucinação)
- **Regra de DELETE (Cascata)**: Se \`action: "DELETE"\`, é OBRIGATÓRIO incluir no manifest todos os arquivos que importam o arquivo deletado (com \`action: "MODIFY"\` para remover o import ou \`DELETE\` se também for removido).
- **Não inventar.** Tudo que for padrão deve ser inferido do repo com evidência.
- **Manifest mínimo**:
  - apenas arquivos realmente necessários
  - sem globs
  - sem arquivos "talvez"
- \`manifest.files[].action\` **somente**:
  - \`CREATE\` | \`MODIFY\` | \`DELETE\`
  - (NUNCA \`ADD\`)
- \`manifest.testFile\`:
  - deve terminar com \`.spec.ts\` ou \`.spec.tsx\`
  - deve estar listado também em \`manifest.files\` como \`CREATE\`/\`MODIFY\`
- **Dependências novas**: proibido por padrão.
- **UI/layout**: permitido (se você optar), mas deve ter contrato testável (selectors estáveis + case matrix).
- **UI Contract**: Se manifest afeta componentes UI, o plan DEVE cobrir todas as variantes definidas no UI Contract (violet-dream-preset.json).

---

## Processo fixo (7 passos)
1) Classificar tipo (A/B/F/G/H/I/J/K/L/M/D/E ou UI via \`UI_QUESTIONNAIRE.md\`).
2) Coletar evidências do repo:
   - padrões de layout/componentes
   - alias de import (ex.: \`@/\`)
   - estratégia de testes existente (RTL/e2e)
3) Executar o questionário v3:
   - responder via repo
   - gerar **Missing Data** (A/B/C) só quando inevitável
4) Escrever \`task_spec.md\` (obrigatório):
   - objetivo + non-goals
   - exemplos (happy + sad)
   - case matrix Given/When/Then
   - seletores estáveis (testid/role/label)
5) Gerar \`contract\` (e salvar também como \`contract.md\`):
   - clauses MUST testáveis
   - \`testMapping.tagPattern = "// @clause"\`
   - \`assertionSurface\` (principalmente \`ui\` para UI)
   - Se UI afetada → verificar variantes no UI Contract e gerar cláusulas \`CL-UI-<Component>-<variant>\` para cada variante obrigatória
6) Gerar \`plan.json\` usando \`plan.template.v3.json\`
7) Definir uploads do run:
   - o spec em \`manifest.testFile\` será enviado por upload (arquivo real)
   - (opcional) anexar também \`task_spec.md\` como artifact, se seu pipeline suportar

---

## UI Contract Compliance

O validador **UI_PLAN_COVERAGE** (Gate 1, Order 11) é um **hard block** que:
- Extrai componentes afetados do manifest (arquivos em \`/components/\` ou \`.tsx/.jsx\`)
- Consulta o UI Contract (violet-dream-preset.json) para obter variantes obrigatórias
- Gera cláusulas \`CL-UI-<Component>-<variant>\` para cada variante
- **BLOQUEIA** a execução se o plan/contract não cobrir 100% das variantes

Se o plan não mencionar todas as variantes, o Gatekeeper retornará:
\`\`\`
FAILED ✗
Message: "Missing coverage for N required UI clauses"
Gaps: ["CL-UI-Button-ghost", "CL-UI-Button-link", ...]
Coverage: X% (Y/Z clauses)
\`\`\`

---

## Template \`plan.json\` (lembrar)
- \`outputId\` (não vazio)
- \`taskPrompt\` (>=10 chars)
- \`manifest.testFile\` + \`manifest.files[]\`
- \`contract\` (com clauses + testMapping + assertionSurface)
- \`baseRef\`, \`targetRef\`, \`dangerMode\`, \`runType\`

---

## Missing Data (formato obrigatório)
- M1: ...
  - A) ...
  - B) ...
  - C) ...
  - Recomendação: ...`


export const CONTRACT_QUESTIONNAIRES_CONTENT = `# LLM_CONTRACT_QUESTIONNAIRES.md (v3 — LLM-first)

> Objetivo: o **Planner LLM** usa este questionário para reduzir alucinações e produzir artefatos testáveis.
> Regra: **responder via código sempre que possível**. Só perguntar ao usuário quando faltar dado que não existe no repo.

---

## Modo de uso (obrigatório)
### 1) Responder via código primeiro
Para cada pergunta:
- Se der para inferir do repo com evidência, responda e **cite**:
  - arquivo(s) + trecho/linha aproximada + exemplo real.
- Se não der para inferir com segurança, marque como **Missing Data**.

### 2) Missing Data (perguntar pouco e com escolhas)
- Agrupar no máximo **3–5 itens** por rodada.
- Para cada item, oferecer **A/B/C opções** (curtas e concretas) + **recomendação** baseada em padrões do repo.

**Formato obrigatório (para perguntar ao usuário):**
- \`M1:\` Pergunta curta
  - A) ...
  - B) ...
  - C) ...
  - Recomendação: B (motivo)
- \`M2:\` ...

O usuário responde: \`M1=B, M2=A, ...\`.

### 3) Saídas obrigatórias do Planner
- \`task_spec.md\` (texto rico e completo; sem depender do usuário preencher tudo)
- \`contract.md\` (cláusulas testáveis)
- \`plan.json\` (manifest mínimo + testFile)

### 4) Regra de testabilidade
Nenhuma regra vira cláusula se não houver:
- **observável** (o que o teste valida) e
- **caso** (Given/When/Then) que exercita a regra.

---

## Type selection guide (escolha 1 tipo primário)
- **A** Novo endpoint HTTP
- **B** Mudança em endpoint HTTP existente
- **F** Regra de negócio/domínio (sem endpoint novo)
- **G** Persistência/modelo de dados (schema/migração/queries)
- **H** Integração externa/efeitos (APIs externas, fila, email, storage)
- **I** Bugfix comportamental (reprodução obrigatória)
- **J** Config/build/env (aliases, env vars, feature flags)
- **K** Segurança/auth/permissões
- **L** Performance/confiabilidade
- **M** Tooling/workflow (scripts/CLI)
- **D** Novo validator/regra Gatekeeper
- **E** Refactor (sem mudança de comportamento)
- **UI**: usar \`UI_QUESTIONNAIRE.md\` (inclui enforcement via UI_PLAN_COVERAGE)

Se houver secundários, listar em **Scope controls / Non-goals**.

---

## Cross-cutting (aplica a todos os tipos)

### C0) Evidências do repo (obrigatório)
1) Quais arquivos/módulos atuais são referência? (paths)
2) Quais padrões já existem e devem ser seguidos?
   - response envelope (se houver)
   - error envelope (se houver)
   - \`error.code\` (se houver)
   - aliases de import (ex.: \`@/\` → \`src/\`)

**Resposta LLM-first:** sempre incluir 1 exemplo real do repo.

### C1) Restrições de escopo (anti-alucinação)
6) **Integridade de Remoção**: Se houver exclusão de arquivos, identificar e listar todos os consumidores (imports) que precisarão de refatoração.
3) Non-goals explícitos (o que NÃO fazer).
4) Dependências novas são permitidas? (padrão: NÃO)
5) Arquivos/pastas proibidas (padrão: configs sensíveis, CI, etc. — a menos que o tipo exija)

### C2) Contrato de teste (testes = contrato)
6) Assertion surface (o que o teste PODE assertar):
   - status codes / headers (se HTTP)
   - payload paths (dot-path)
   - \`error.code\` (lista fechada)
   - efeitos (eventos/db) — somente se permitido
7) Assertions proibidas (padrão):
   - string exata de message (salvo contrato)
   - snapshots (salvo contrato)
   - weak-only (\`toBeDefined/toBeTruthy/toBeFalsy\`) como única verificação
8) Determinismo:
   - proibido \`Date.now/Math.random\` sem controle
   - proibido rede real para integrações (mock obrigatório, salvo exceção explícita)
9) Para tarefas UI, além do \`// @clause\`, usar também \`// @ui-clause\` para rastreabilidade de variantes

### C3) Templates obrigatórios
#### C3.1) Exemplos (obrigatório)
- 1 exemplo **happy**
- 1 exemplo **sad** (ou "reprodução" no bugfix)
- Cada exemplo deve conter inputs e outputs completos (shape).

#### C3.2) Case matrix (obrigatório)
| Case ID | Given (pré-condições) | When (ação/input) | Then (observáveis estáveis) | Must test? |
|---|---|---|---|---|
| X-HP-001 |  |  |  | MUST |
| X-ER-001 |  |  |  | MUST |

---

# Tipos

## Type A — Novo endpoint HTTP
### A1) Identity: 1) Method+path 2) Versionamento 3) Auth 4) Permissões 5) Feature flag
### A2) Input: 6) Content-Type 7) Campos 8) Validações 9) Campo desconhecido 10) Exemplo request
### A3) Output: 11) Status sucesso 12) Shape response 13) Headers 14) Exemplo response
### A4) Errors: 15) Shape erro 16) Lista error.code 17) Exemplo 2 erros
### A5) Effects: 18) Efeitos e observação 19) Consistência
### A6) Case matrix: 20) Mín. 1 happy + 1 sad

## Type B — Mudança em endpoint existente
### B1) Baseline com evidência — B2) Mudança proposta — B3) Invariantes — B4) Case matrix

## Type F — Regra de negócio/domínio
### F1) Superfície do contrato — F2) Erros e invariantes — F3) Exemplos + case matrix

## Type G — Persistência/modelo de dados
### G1-G4) Modelo, migração, observabilidade, case matrix

## Type H — Integração externa/efeitos
### H1-H3) Contrato externo, testabilidade, case matrix

## Type I — Bugfix (comportamental)
### I1) Reprodução obrigatória — I2) Restrições — I3) Case matrix (reproducer MUST falhar no baseRef)

## Type J — Config/build/env
### J1-J3) Mudança, observáveis, case matrix

## Type K — Segurança/auth/permissões
### K1-K3) Política (matriz), negativos obrigatórios, case matrix

## Type L — Performance/confiabilidade
### L1-L3) Métrica determinística, correção, case matrix

## Type M — Tooling/workflow
### M1-M2) Contrato do comando, case matrix

## Type D — Novo validator/regra Gatekeeper
### D1-D2) Detecção determinística, operabilidade

## Type E — Refactor (sem mudança de comportamento)
### E1-E3) Invariantes, segurança, case matrix

---

## Final confirmation (antes de gerar \`contract.md\` e \`plan.json\`)
Repetir como bullets:
- tipo selecionado
- contract surface (HTTP/serviço/DB/integração)
- non-goals e restrições de deps
- exemplos completos presentes (happy + sad/reprodução)
- case matrix presente
- assertion surface (permitido) + proibidos
- convenção de mapeamento \`// @clause <ID>\``


export const UI_QUESTIONNAIRE_CONTENT = `# UI_QUESTIONNAIRE.md (LLM-first)

> Objetivo: orientar a LLM a especificar e planejar tarefas de UI **sem alucinação**.
> Este questionário é **LLM-first**: responder via repo com evidência; perguntar ao usuário apenas *Missing Data* com A/B/C.

---

## Modo de uso (obrigatório)
### 1) Responder via repo primeiro
Para cada item: se inferível do código, responder com arquivos/componentes de referência (paths), padrão existente, exemplo real. Se não, marcar como **Missing Data**.

### 2) Missing Data (perguntar pouco)
Agrupar no máximo **3–5** por rodada. Para cada item: **A/B/C opções** + recomendação.

---

## Type selection (UI)
- **U1 — New page/route** — **U2 — Change existing page/route** — **U3 — New component**
- **U4 — Change existing component** — **U5 — Global layout/navigation change**
- **U6 — UI bugfix** — **U7 — UI state/flow change** — **U8 — Styling/theme/system**

---

## Cross-cutting (aplica a todos os tipos)

### C0) Evidências e padrões do repo (obrigatório)
1) Framework/stack: React? Vite? Router (qual)? State (qual)? Form lib (qual)?
2) Padrões existentes: layout base (AppLayout, shell), componentes padrão, design system/tokens
3) Convenções: pastas, naming de componentes, import alias
4) Acessibilidade: padrão de aria-*, role, focus management

### C1) Escopo e segurança (anti-alucinação)
5) Non-goals explícitos (o que NÃO fazer)
6) Arquivos/pastas proibidas (por padrão): configs de build, dependências novas
7) Dependências: novas deps permitidas? (padrão: NÃO)
8) Critério "mínimo de mudança": evitar refactor amplo, reutilizar componentes

### C2) Requisitos de testabilidade (padrão)
9) Validação: unit/component test (RTL), e2e (se existir), visual regression (se existir)
10) Seletores estáveis: preferir data-testid/roles/labels estáveis
11) Strings: texto de UI contratual? (geralmente NÃO)
12) Validadores UI do Gatekeeper:
   - **UI_PLAN_COVERAGE** (Order 11, Hard Block): bloqueia se plan não cobrir todas as variantes
   - **UI_TEST_COVERAGE** (Order 12, Soft Block): warning se testes não tiverem tags @ui-clause

### C3) UI Contract Enforcement (obrigatório para componentes)
13) Componentes afetados extraídos do manifest: arquivos em /components/ ou .tsx/.jsx
14) Variantes obrigatórias vêm do UI Contract (preset JSON)
15) O plan DEVE mencionar TODAS as variantes ou será bloqueado: cobertura 100%

---

## U1 — New page/route
### U1.1 Rota e navegação
1) Qual rota/path novo? 2) Como chega nessa página? 3) Guardas: auth? role? comportamento quando negado?
### U1.2 Layout e estrutura
4) Layout global? (qual) 5) Estrutura principal 6) Responsividade
### U1.3 Conteúdo e componentes
7) Componentes reutilizados? 8) Componentes novos? 9) Dados: fonte, loading/error/empty states
### U1.4 Interações
10) Ações do usuário 11) Validações
### U1.5 Observáveis + exemplos
12) Fluxo happy 13) Fluxo sad
### U1.6 Case matrix

## U2 — Change existing page/route
1) Qual página? 2) Baseline 3) Mudança 4) Invariantes 5) Casos + matrix

## U3 — New component
### U3.1 Contrato: nome, props, variações, acessibilidade, variantes UI Contract
### U3.2 Integração — U3.3 Testabilidade — U3.4 Case matrix

## U4 — Change existing component
1-6) Componente, baseline, mudança, invariantes, regressão, variantes

## U5 — Global layout/navigation change
1-6) Mudança, layout atual, invariantes, rollout, observáveis, case matrix

## U6 — UI bugfix
1-5) Comportamento errado, repro, esperado, código, reproducer + regressão

## U7 — UI state/flow change
1-4) Fluxo atual, fluxo novo, estados, observáveis + matrix

## U8 — Styling/theme/system
1-5) O que muda, tokens, escopo, invariantes, testabilidade

---

## Final confirmation
- tipo UI selecionado
- referências do repo
- non-goals e restrições
- rotas afetadas
- componentes afetados (existentes/novos)
- estados definidos
- acessibilidade definida
- case matrix presente
- estratégia de teste e seletores estáveis definidos
- UI clauses geradas para todas as variantes afetadas`


export const CONTRACT_TEMPLATE_CONTENT = `# contract_<slug>.md (Template — v1.0)

> Objetivo: este arquivo descreve o contrato humano (normativo) que será convertido para testes.
> Use IDs de cláusula estáveis. Cada cláusula **MUST** deve ser testável por observáveis.

---

## Identidade
- **schemaVersion**: 1.0
- **slug**: <preencher em kebab-case> (ex.: \`documents-upload-endpoint\`)
- **title**: <título curto e específico>
- **mode**: STRICT | CREATIVE
- **changeType**: new | modify | bugfix | refactor
- **criticality**: low | medium | high

---

## Escopo
### O que está incluído (1–5 bullets)
- <bullet 1>
- <bullet 2>

### Não-objetivos (1–5 bullets)
- <bullet 1>
- <bullet 2>

---

## Cláusulas (clause = test)

### Convenções
- Formato do ID: \`CL-<DOMINIO>-<NNN>\` (ex.: \`CL-ENDPOINT-001\`)
- Formato do ID para UI: \`CL-UI-<Component>-<variant>\` (ex.: \`CL-UI-Button-destructive\`)
- \`kind\`: behavior | error | security | invariant | constraint | ui
- \`normativity\`: MUST | SHOULD | MAY
- \`spec\`: sempre em termos observáveis (evitar detalhes internos)

### Lista de cláusulas (exemplo)
1) **[CL-ENDPOINT-001] (behavior, MUST)** — <título>
   - **spec**: Quando <condição>, então <resultado observável>.
   - Observáveis esperados:
     - <observável 1>
     - <observável 2>

2) **[CL-ERROR-001] (error, MUST)** — <título>
   - **spec**: Quando <condição>, então retorna erro com <status/code/shape>.
   - **negativeCases** (obrigatório para error/security MUST):
     - <caso negativo 1>
     - <caso negativo 2>

3) **[CL-UI-Button-destructive] (ui, MUST)** — Button destructive variant
   - **spec**: Quando renderizado com variant="destructive", então aplica estilos destrutivos.
   - Observáveis esperados:
     - classe \`bg-destructive\` presente
     - classe \`text-destructive-foreground\` presente

> Dica: se uma cláusula não é testável por observável, ela não deve ser MUST.

---

## Assertion Surface (o que os testes podem assertar)

### HTTP (se aplicável)
- Endpoints permitidos: <METHOD> <PATH>
- Status codes permitidos: <200>, <400>
- Headers permitidos: <content-type>, <location>

### Payload paths permitidos (dot-path)
- \`body.<campo>\`
- \`body.error.code\`

### Error codes permitidos
- <ERROR_CODE_1>
- <ERROR_CODE_2>

### UI selectors permitidos (se aplicável)
- \`data-testid:<id>\`
- \`role:<role>:name=<n>\`

### Effects permitidos (se aplicável)
- \`event:<EventName>\`
- \`db:<table>.<action>\`
- \`call:<service>.<method>\`

### Matchers policy
- Snapshots: proibidos por padrão
- Weak matchers (\`toBeDefined\`, etc.): proibidos por padrão

---

## Test Mapping (rastreabilidade)
### Regra padrão (recomendada)
Cada \`it/test\` deve ter um comentário imediatamente acima:

\`\`\`ts
// @clause CL-ENDPOINT-001
it("...", () => { ... })
\`\`\`

- allowMultiple: um teste pode listar múltiplas cláusulas (recomendado)
- allowUntagged: em STRICT, deve ser **false**

### Regra para UI Clauses
Para cláusulas de componentes UI, usar \`@ui-clause\`:

\`\`\`ts
// @ui-clause CL-UI-Button-destructive
it("renders destructive variant", () => {
  render(<Button variant="destructive">Delete</Button>)
  expect(screen.getByRole('button')).toHaveClass('bg-destructive')
})
\`\`\`

---

## Checklist final
- [ ] Se houver DELETE, garantida a integridade dos importadores (sem imports órfãos)
- [ ] Todas as cláusulas têm \`id\` único
- [ ] Todas as cláusulas MUST são testáveis por observáveis
- [ ] error/security MUST contém \`negativeCases\` (>= 1)
- [ ] Assertion Surface lista tudo que os testes irão assertar
- [ ] Todo \`it/test\` tem \`// @clause ...\` (em STRICT)
- [ ] Cláusulas UI (\`CL-UI-*\`) têm \`// @ui-clause\` correspondente`


export const PLAN_TEMPLATE_JSON_CONTENT = `## plan.json Template (CreateRun payload)

Use this exact structure when generating plan.json:

\`\`\`json
{
  "outputId": "YYYY_MM_DD_NNN_slug",
  "taskPrompt": "Descreva a tarefa de forma curta e objetiva.",
  "manifest": {
    "testFile": "src/path/to/Task.spec.tsx",
    "files": [
      {
        "path": "src/path/to/Task.spec.tsx",
        "action": "CREATE"
      }
    ]
  },
  "contract": {
    "schemaVersion": "1.0",
    "slug": "slug_sem_espacos",
    "title": "Título do contrato",
    "mode": "STRICT",
    "changeType": "CHANGE_TYPE_STRING",
    "criticality": "HIGH",
    "clauses": [
      {
        "id": "CLAUSE_001",
        "kind": "behavior",
        "normativity": "MUST",
        "when": "Condição observável",
        "then": "Resultado observável"
      }
    ],
    "assertionSurface": {
      "ui": {
        "routes": [],
        "testIds": [],
        "roles": [],
        "ariaLabels": []
      }
    },
    "testMapping": {
      "tagPattern": "// @clause"
    }
  },
  "baseRef": "origin/main",
  "targetRef": "HEAD",
  "dangerMode": false,
  "runType": "CONTRACT"
}
\`\`\`

### Rules:
- \`outputId\` must not be empty
- \`taskPrompt\` must have >= 10 chars
- \`manifest.testFile\` must end with \`.spec.ts\` or \`.spec.tsx\`
- \`manifest.testFile\` must also appear in \`manifest.files[]\`
- \`manifest.files[].action\` must be: CREATE | MODIFY | DELETE (never ADD)
- \`contract.clauses[]\` must have at least 1 MUST clause
- \`baseRef\` and \`targetRef\` are git refs`


// ─── Step 2: Spec Writer ─────────────────────────────────────────────────────

export const SPEC_WRITER_PLAYBOOK_CONTENT = `# SPEC_WRITER_PLAYBOOK.md (v2 — spec via upload)

> Função (LLM-B / Spec Writer): produzir o **conteúdo do arquivo** \`manifest.testFile\`
> para ser materializado no workspace e/ou enviado via endpoint de upload do run.
> O spec deve derivar do \`contract\` (clauses) e respeitar os seletores/observáveis definidos.

---

## Entradas
- \`plan.json\` (para \`manifest.testFile\`)
- \`contract.md\` (ou \`plan.json.contract\`)
- Código real do repo (helpers existentes, alias \`@/\`, padrões de teste)

## Saída
- Conteúdo completo do arquivo \`manifest.testFile\` (ex.: \`src/.../*.spec.tsx\`)

---

## Regras duras
- **Imports no teste**:
  - evitar \`../\` e \`./\` quando isso quebrar por path de execução
  - preferir alias real do projeto (ex.: \`@/\`)
- **Cada clause MUST ter pelo menos 1 teste** com \`// @clause <ID>\`
- **Para componentes UI, cada variante DEVE ter tag \`// @ui-clause CL-UI-<Component>-<variant>\`**
- **Proibido**:
  - snapshots (salvo cláusula explícita)
  - message exata (salvo cláusula explícita)
  - asserts fracos como única verificação (\`toBeDefined/toBeTruthy/toBeFalsy\`)
- Determinismo:
  - sem rede real (mock)
  - sem relógio aleatório sem controle

---

## Padrão obrigatório para Happy/Sad Path

O validador detecta happy/sad paths pelos **nomes dos \`it()\`**, não pelos \`describe()\`.
Happy path: \`it\\s*\\(\\s*['"].*?(success|should|when.*valid|passes)\`
Sad path: \`it\\s*\\(\\s*['"].*?(error|fail|throws|invalid|when.*not)\`

### Formato correto:
\`\`\`ts
it('succeeds when <condição positiva>', () => { ... })  // ✅ happy path
it('fails when <condição negativa>', () => { ... })     // ✅ sad path
\`\`\`

### Formatos que NÃO funcionam:
\`\`\`ts
it('happy path: should do X', ...)           // ❌
it('should do X [happy path]', ...)          // ❌
it('should do X (success scenario)', ...)    // ❌
describe('Happy Path - Success Scenarios')   // ❌ validador ignora describe
\`\`\`

### Regra mnemônica:
- **Happy** → \`succeeds when\`
- **Sad** → \`fails when\`

---

## Padrão obrigatório para UI Clauses

Para componentes UI, além de \`// @clause\`, usar \`// @ui-clause\` para rastreabilidade:

\`\`\`ts
// @ui-clause CL-UI-Button-destructive
it('renders destructive variant correctly', () => {
  render(<Button variant="destructive">Delete</Button>)
  expect(screen.getByRole('button')).toHaveClass('bg-destructive')
})
\`\`\`

---

## Processo fixo
1) Ler \`contract\` e listar \`clauses[]\` + \`assertionSurface\`.
2) Para cada clause:
   - escolher um caso (Given/When/Then) coerente
   - escrever 1+ testes cobrindo a regra
3) Usar seletores estáveis:
   - \`data-testid\`/roles/labels (preferir patterns do repo)
4) Assertions fortes:
   - presença/ordem de elementos (quando contratual)
   - estados (closed/open) com observáveis claros
5) Checklist final: todas as clauses cobertas + imports válidos

---

## Checklist final
- [ ] 1+ teste por clause com \`// @clause <ID>\`
- [ ] Componentes UI têm \`// @ui-clause\` para cada variante testada
- [ ] Imports coerentes com alias do repo
- [ ] Sem asserts fracos como única prova
- [ ] Sem snapshots/messages exatas (salvo contrato)
- [ ] Testes determinísticos
- [ ] Sem dependências não existentes em package.json`


// ─── Step 3: Fix ─────────────────────────────────────────────────────────────

export const FIX_PLAYBOOK_CONTENT = `# FIX_PLAYBOOK.md (v1 — Artifact Correction)

> Função (LLM-Fix): corrigir artefatos (plan/spec) rejeitados pelo pipeline de validação do Gatekeeper.
> O Fix recebe o relatório de rejeição com validators falhados e deve produzir versões corrigidas.

---

## Entradas
- Artefatos atuais (plan.json, contract.md, task.spec.md, e/ou arquivo de teste)
- Relatório de rejeição (validators falhados + mensagens + details)
- Código real do repo

## Saída
- Versões corrigidas dos artefatos rejeitados (via save_artifact)

---

## Regras duras
- **Foco cirúrgico**: corrigir APENAS os problemas reportados pelos validators.
- **Preservar o correto**: não reescrever do zero — manter partes que já passaram.
- **Re-verificar**: após correção, garantir que:
  - Todas as clauses MUST ainda mapeiam para testes (\`// @clause\`)
  - manifest.testFile ainda está listado em manifest.files
  - Assertions seguem o contrato (assertion surface)
- **Não inventar**: mesmas regras anti-alucinação do Planner.

---

## Processo fixo
1) Ler o relatório de rejeição e identificar cada validator falhado.
2) Para cada falha:
   - Entender a causa raiz (ler a mensagem + details)
   - Identificar o artefato afetado (plan.json, contract.md, ou spec)
   - Aplicar a correção mínima
3) Explorar o repo se necessário (padrões, imports, convenções).
4) Salvar artefatos corrigidos via save_artifact.
5) Listar as correções feitas como bullets no response.

---

## Validators comuns e como corrigir

### Gate 0 (Sanitization)
- **TASK_CLARITY_CHECK**: Reescrever taskPrompt sem termos ambíguos
- **SENSITIVE_FILES_LOCK**: Remover arquivos sensíveis do manifest
- **PATH_CONVENTION**: Ajustar path do testFile para convenção correta
- **DELETE_DEPENDENCY_CHECK**: Adicionar importadores ao manifest

### Gate 1 (Contract)
- **TEST_SYNTAX_VALID**: Corrigir syntax errors no spec
- **TEST_HAS_ASSERTIONS**: Adicionar assertions reais
- **TEST_COVERS_HAPPY_AND_SAD_PATH**: Adicionar it() com keywords corretas (succeeds when / fails when)
- **NO_DECORATIVE_TESTS**: Substituir asserts vazios por verificações reais
- **TEST_RESILIENCE_CHECK**: Substituir seletores frágeis por data-testid/roles
- **TEST_CLAUSE_MAPPING_VALID**: Adicionar \`// @clause\` tags faltantes
- **IMPORT_REALITY_CHECK**: Corrigir imports inexistentes

### Gate 2 (Execution)
- **DIFF_SCOPE_ENFORCEMENT**: Remover arquivos fora do manifest do diff
- **TEST_READ_ONLY_ENFORCEMENT**: Não modificar arquivo de teste na execução

---

## Checklist final
- [ ] Todas as falhas reportadas foram endereçadas
- [ ] Artefatos corrigidos mantêm consistência interna
- [ ] Nenhuma regressão introduzida (partes corretas preservadas)
- [ ] Correções listadas como bullets no response`


// ─── Step 4: Executor / Coder ────────────────────────────────────────────────

export const EXECUTOR_PLAYBOOK_CONTENT = `# EXECUTOR_PLAYBOOK.md (LLM-C — Executor)

> Função: implementar a mudança para passar no spec/teste, com **escopo estritamente limitado** ao manifest.

---

## Entradas
- \`plan.json\`
- \`contract.md\`
- arquivo de teste (\`manifest.testFile\`)
- código real do repo

## Saída
- Alterações no repo (diff) somente dentro do manifest

---

## Regras duras (anti-alucinação)
- Só pode editar/criar/deletar arquivos listados em \`manifest.files\`.
- Proibido:
  - tocar em arquivos fora do manifest
  - adicionar dependências (\`package.json\`/lockfiles) sem estar no manifest com reason
  - criar novos arquivos "auxiliares" fora do manifest
- Implementar o **mínimo** para satisfazer o teste e as clauses.
- Componentes UI devem implementar TODAS as variantes listadas nas cláusulas \`CL-UI-*\` do contrato.

---

## Processo fixo
1) Listar arquivos permitidos (manifest).
2) Implementar mudanças para satisfazer cada clause (o teste é a prova).
3) Se UI → verificar se todas as variantes do UI Contract estão implementadas.
4) Rodar compilação e o teste da tarefa.
5) Garantir diff mínimo (sem arquivos extras).

---

## Checklist final
- [ ] Diff ⊆ manifest
- [ ] Compila
- [ ] Teste da tarefa passa
- [ ] Sem dependências novas
- [ ] Sem arquivos extras
- [ ] Todas as variantes UI do contrato implementadas`
