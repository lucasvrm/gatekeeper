# Agent Pipeline — Roadmap

## Status Legend
- ✅ Done
- 🔄 In Progress
- ⬜ Planned

---

## 🔴 Prioritário (custo/estabilidade)

1. ✅ **Prompt caching** — Cache breakpoints no AnthropicProvider (~70% savings)
2. ✅ **Token budget por run** — `maxInputTokensBudget` no PhaseConfig (guardrail de custo)
3. ⬜ **Bash tool safety** — Allowlist/blocklist de comandos destrutivos (git add, rm -rf, etc.)
4. ⬜ **tsx watch incompatibility** — Server crasha quando agent escreve em `src/`. Ignorar `src/` no watcher ou rodar sem watch.

## 🟡 Funcionalidade (completar pipeline)

5. ⬜ **Fix mode (step 3)** — Testar com rejeição real do Gatekeeper (FIX_PLAYBOOK já no seed)
6. ✅ **System prompts reais** — Todos os playbooks/questionnaires/templates seedados no DB via PromptInstruction
7. ⬜ **Run persistence** — Salvar runs + resultados no DB (modelo Run já existe)
8. ⬜ **Workspace resolution** — Resolver `artifactsDir` do DB em vez de subir o filesystem

## 🟢 Frontend / UX

9. ⬜ **Frontend UI** — Interface web pra disparar pipeline, ver progresso (SSE já pronto)
10. ⬜ **Artifact viewer** — Diff view, versionamento, antes/depois de fix
11. ⬜ **Cost dashboard** — Mostrar custo por run, por step, cache savings

## 🔵 Expansão

12. ⬜ **Multi-provider testing** — Testar mesmo pipeline com OpenAI/Mistral
13. ⬜ **Prompt optimization** — Planner gasta 15-20 iterações explorando antes de salvar. Instruções melhores reduzem pra ~8-10.
14. ⬜ **Checkpoint/resume** — Se pipeline crashar no step 3, retomar sem refazer steps 1-2
15. ⬜ **ClaudeCodeProvider** — Provider que usa Claude Code SDK (headless mode) via `claude -p`, permitindo rodar o pipeline sem API key usando subscription (Max plan). Spawn `claude -p "prompt" --system-prompt "..." --output-format stream-json` e parsear output. Custo: R$0 extra (incluso no plano).

---

## Completed This Session

### Schema Changes
- Added `AgentPhaseConfig` model (step, provider, model, maxTokens, maxIterations, maxInputTokensBudget)
- Extended `PromptInstruction` with `kind`, `step`, `order` fields + index

### Seed Data
- 8 PromptInstruction rows (all real playbooks/questionnaires/templates)
  - Step 1 (Planner): PLANNER_PLAYBOOK, CONTRACT_QUESTIONNAIRES, UI_QUESTIONNAIRE, CONTRACT_TEMPLATE, PLAN_TEMPLATE_JSON
  - Step 2 (Spec Writer): SPEC_WRITER_PLAYBOOK
  - Step 3 (Fix): FIX_PLAYBOOK
  - Step 4 (Executor): EXECUTOR_PLAYBOOK
- 2 SessionProfiles: "TDD Pipeline", "Bugfix Pipeline" (linked to all prompts)
- 4 AgentPhaseConfigs: steps 1-4 with token budgets (500K/300K/200K/800K)

### Code Changes
- Rewrote `AgentPromptAssembler` to query PromptInstruction by step+kind from DB
- Assembly order: playbook → questionnaire → template → instruction
- Graceful fallback to hardcoded defaults if DB empty
