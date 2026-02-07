# Gatekeeper

Sistema de validação TDD com orquestrador de agentes LLM. Monorepo npm workspaces.

## Comportamento

- Seja direto, técnico, e questione decisões frágeis.
- SEMPRE entenda o objetivo do usuário antes de agir. Leia o código relevante com critério.
- NUNCA execute ou edite sem um plano aprovado.
- Planeje em **microplans atômicos**: max 3 arquivos tocados, max 4 tarefas cada.
- Se a tarefa exige mais, quebre em múltiplos microplans sequenciais. Apresente todos, execute um por vez, valide antes de avançar.
- NUNCA modifique arquivos fora do escopo do microplan aprovado.
- Siga padrões existentes no código — leia antes de inventar.
- Erros de validação do Gatekeeper são lei: corrija, não contorne.

## Comandos

```bash
# Frontend (raiz)
npm run dev                # Vite dev (porta 5173)
npm run build              # tsc -b + vite build
npm run typecheck          # tsc --noEmit (frontend)
npm run typecheck:all      # frontend + backend
npm run lint               # eslint
npm test                   # vitest (requer VITEST_RUN_E2E=true)

# Backend (workspace)
npm run dev -w gatekeeper-api          # tsx watch (porta 5000)
npm run build -w gatekeeper-api        # tsc
npm run typecheck -w gatekeeper-api    # tsc --noEmit
npm run test -w gatekeeper-api         # todos os testes
npm run test:unit -w gatekeeper-api    # unitários
npm run test:integration -w gatekeeper-api  # integração
npm run test:e2e -w gatekeeper-api     # e2e

# Database (Prisma)
npm run db:generate -w gatekeeper-api  # gera Prisma Client
npm run db:migrate -w gatekeeper-api   # cria/aplica migrations
npm run db:push -w gatekeeper-api      # push schema sem migration
npm run db:seed -w gatekeeper-api      # seed dados iniciais
npm run db:studio -w gatekeeper-api    # Prisma Studio
```

## Estrutura

```
src/                              → Frontend (React 19 + Vite 7 + Radix UI + Tailwind 4)
  components/                     → Páginas e componentes (orchestrator-page, run-details, etc.)
  components/ui/                  → Componentes Radix UI/shadcn
  hooks/                          → useRunEvents (SSE), use-customization
  lib/api.ts                      → HTTP client (fetch-based)
  lib/types.ts                    → Types frontend

packages/gatekeeper-api/          → Backend (Express + TypeScript strict + Prisma + SQLite)
  src/api/controllers/            → Controllers HTTP (Bridge, Runs, Config, MCP, Git)
  src/api/routes/                 → Definição de endpoints
  src/api/schemas/                → Zod validation schemas
  src/services/                   → Lógica de negócio (Orchestrator, AgentRunner, AgentBridge)
  src/services/providers/         → LLM providers (Anthropic, OpenAI, Mistral, ClaudeCode)
  src/domain/validators/gate{0-3}/ → Validadores por gate
  src/types/                      → Types (agent.types, gates.types)
  src/config/gates.config.ts      → Registry de gates e validadores
  prisma/schema.prisma            → Schema do banco
  test/                           → Testes (unit, integration, e2e)

packages/gatekeeper-mcp/          → MCP server (tools, prompts, client)
packages/gatekeeper-orchestrator/ → Pipeline de orquestração (LLM client, executor)
packages/orqui/                   → Design system visual (runtime, editor, presets, CLI)
```

## Imports

- NUNCA use extensão `.js` em imports TypeScript
- SEMPRE verifique que o arquivo existe antes de importar
- Verifique que pacotes estão no `package.json` do workspace correto
- Path alias: `@/` → `src/` (frontend e backend, configurado em tsconfig e vite)
- Backend usa `moduleResolution: "NodeNext"` — imports relativos entre packages requerem atenção
- Paths relativos em testes: `test/integration/` → `src/` = `../../src/`


