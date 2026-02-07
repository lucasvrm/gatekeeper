# RULES_EXECUTOR.md - Regras para Execução de Implementação (EXECUTION)

Este documento define as regras que a LLM executora deve seguir ao implementar mudanças validadas pelo Gatekeeper. Cada regra é derivada diretamente do código dos validators em `packages/gatekeeper-api/src/domain/validators/`.

---

## Overview

Gatekeeper é um **serviço de API** que valida um "run" através de uma sequência de **gates**.
Um run é criado enviando os inputs (task prompt + microplans) para a API.
Gatekeeper então executa **validators** que reforçam mudanças test-driven e scope-safe.

- A LLM produz os inputs (taskPrompt/microplans) e os arquivos de implementação.
- Gatekeeper avalia esses artefatos via seus **21 validators**.

**Nota**: A arquitetura antiga (manifest + contract) foi substituída por **microplans** - planos atômicos que contêm arquivos e critérios de verificação distribuídos.

---

## Run Types

Gatekeeper suporta dois tipos de run:

### `CONTRACT` (default)

Executa **Gate 0** e **Gate 1**:
- Gate 0: sanitização de input e adequação de escopo
- Gate 1: qualidade do contrato de teste e alinhamento

### `EXECUTION`

Executa **Gate 2** e **Gate 3**:
- Gate 2: disciplina de execução e condições de passagem local
- Gate 3: verificações de integridade completa

`EXECUTION` runs requerem `contractRunId` referenciando um run `CONTRACT` com status **PASSED**.

---

## Gate 2: EXECUTION

### 15. DIFF_SCOPE_ENFORCEMENT

**Fonte:** `gate2/DiffScopeEnforcement.ts`

| # | Regra |
|---|-------|
| 1 | Todos os arquivos no diff devem estar declarados no microplan |
| 2 | Diff é obtido via `ctx.services.git.getDiffFiles(baseRef, targetRef)` |
| 3 | Arquivos do microplan são extraídos como `Set(microplan.files.map(f => f.path))` |
| 4 | Violações são arquivos presentes no diff mas ausentes no microplan |
| 5 | Quando `microplan` é null, retorna `FAILED` |

---

### 16. TEST_READ_ONLY_ENFORCEMENT

**Fonte:** `gate2/TestReadOnlyEnforcement.ts`

| # | Regra |
|---|-------|
| 1 | Arquivos de teste existentes não podem ser modificados |
| 2 | Padrão de teste: `/\.spec\.tsx$/` |
| 3 | Exceção: o arquivo `ctx.testFilePath` (teste da tarefa atual) pode ser criado/modificado |
| 4 | Diff é obtido via `ctx.services.git.getDiffFiles(baseRef, targetRef)` |
| 5 | Testes modificados são listados em `details.modifiedTests` |

---

### 17. TASK_TEST_PASSES

**Fonte:** `gate2/TaskTestPasses.ts`

| # | Regra |
|---|-------|
| 1 | O teste da tarefa deve passar no `targetRef` |
| 2 | Execução via `ctx.services.testRunner.runSingleTest(testFilePath)` |
| 3 | Quando `testFilePath` é null, retorna `FAILED` |
| 4 | Resultado inclui `exitCode`, `duration` e `error` (se houver) |
| 5 | Este é o complemento da Cláusula Pétrea - teste falha no base, passa no target |

---

### 18. STRICT_COMPILATION

**Fonte:** `gate2/StrictCompilation.ts`

| # | Regra |
|---|-------|
| 1 | O projeto inteiro deve compilar sem erros |
| 2 | Compilação via `ctx.services.compiler.compile()` (sem path = projeto todo) |
| 3 | Erros são limitados a 10 na evidência, 20 nos details |
| 4 | Diferente de TEST_SYNTAX_VALID que compila apenas o arquivo de teste |
| 5 | Erros de compilação resultam em `FAILED` |

---

### 19. STYLE_CONSISTENCY_LINT

**Fonte:** `gate2/StyleConsistencyLint.ts`

| # | Regra |
|---|-------|
| 1 | Arquivos do microplan são verificados com ESLint |
| 2 | Quando `microplan` é null, retorna `SKIPPED` |
| 3 | Configs ESLint procurados: `eslint.config.js`, `eslint.config.mjs`, `eslint.config.cjs`, `.eslintrc.js`, `.eslintrc.json`, `.eslintrc` |
| 4 | Quando não há config ESLint, retorna `SKIPPED` |
| 5 | Apenas arquivos com extensão `.ts`, `.tsx`, `.js`, `.jsx` são lintados |
| 6 | Arquivos com `action: 'DELETE'` são excluídos do lint |
| 7 | Lint via `ctx.services.lint.lint(filePaths)` |
| 8 | Output é truncado em 2000 caracteres na evidência |

---

## Gate 3: INTEGRITY

### 20. FULL_REGRESSION_PASS

**Fonte:** `gate3/FullRegressionPass.ts`

| # | Regra |
|---|-------|
| 1 | Todos os testes do projeto devem passar |
| 2 | Execução via `ctx.services.testRunner.runAllTests()` |
| 3 | Equivale a executar `npm test` |
| 4 | Output é truncado aos últimos 2000 caracteres na evidência |
| 5 | Resultado inclui `exitCode` e `duration` |

---

### 21. PRODUCTION_BUILD_PASS

**Fonte:** `gate3/ProductionBuildPass.ts`

| # | Regra |
|---|-------|
| 1 | O build de produção deve completar com sucesso |
| 2 | Build via `ctx.services.build.build()` |
| 3 | Equivale a executar `npm run build` |
| 4 | Output é truncado aos últimos 2000 caracteres na evidência |
| 5 | Resultado inclui `exitCode` |

---

## Referência Rápida: Validators (Gate 2 + Gate 3)

| Gate | Validator | Hard Block |
|------|-----------|------------|
| 2 | DIFF_SCOPE_ENFORCEMENT | ✅ |
| 2 | TEST_READ_ONLY_ENFORCEMENT | ✅ |
| 2 | TASK_TEST_PASSES | ✅ |
| 2 | STRICT_COMPILATION | ✅ |
| 2 | STYLE_CONSISTENCY_LINT | ✅ |
| 3 | FULL_REGRESSION_PASS | ✅ |
| 3 | PRODUCTION_BUILD_PASS | ✅ |

---

## Glossário

| Termo | Definição |
|-------|-----------|
| **microplan** | Plano atômico contendo goal, arquivos (files[]), critérios de verificação (verify) e dependências |
| **microplans** | Array de microplans que substituem o manifest/contract monolítico - execution atômica e dependency-aware |
| **taskPrompt** | Definição da tarefa em linguagem natural, usada como referência para escopo e intenção |
| **CONTRACT run** | Verifica se a tarefa está bem formada e os testes são significativos e alinhados |
| **EXECUTION run** | Verifica se a implementação permanece dentro do escopo e passa nos gates de execução |
| **baseRef** | Referência Git base para comparação (default: `origin/main`) |
| **targetRef** | Referência Git alvo com as mudanças (default: `HEAD`) |
| **Hard Block** | Validator que bloqueia o pipeline quando falha |
| **Soft Gate** | Validator que emite WARNING mas permite o pipeline continuar |
| **Cláusula Pétrea** | Regra imutável que não pode ser desabilitada (TEST_FAILS_BEFORE_IMPLEMENTATION) |
| **manifest** | ⚠️ DEPRECATED - Use microplan.files[] ao invés |
| **contract** | ⚠️ DEPRECATED - Use microplan.verify ao invés |

---

*Documento gerado a partir do código em `packages/gatekeeper-api/src/domain/validators/`*
