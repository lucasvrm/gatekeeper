# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Gatekeeper** é um sistema de validação em cascata para gerenciar mudanças em projetos de software. Funciona como um "gatekeeper" que controla o que pode ser deployado através de múltiplas fases de validação sequenciais.

Este é um **monorepo com npm workspaces** contendo:
- **Frontend React** (raiz do projeto)
- **Backend API** (`packages/gatekeeper-api`)

## Build & Development Commands

### Frontend (raiz do projeto)
```bash
npm run dev              # Inicia Vite dev server (porta 5173)
npm run build            # Build de produção (TypeScript + Vite)
npm run typecheck        # TypeScript check (apenas frontend)
npm run typecheck:all    # TypeScript check (frontend + backend)
npm run lint             # ESLint
npm test                 # Vitest (testes E2E)
npm run preview          # Preview do build de produção
```

### Backend API (packages/gatekeeper-api)
```bash
npm run dev --workspace=gatekeeper-api           # Dev server com tsx watch
npm run build --workspace=gatekeeper-api         # Compila TypeScript
npm run typecheck --workspace=gatekeeper-api     # TypeScript check

# Database (Prisma)
npm run db:generate --workspace=gatekeeper-api   # Gera Prisma Client
npm run db:migrate --workspace=gatekeeper-api    # Cria/aplica migrations
npm run db:push --workspace=gatekeeper-api       # Push schema sem migration
npm run db:seed --workspace=gatekeeper-api       # Popula DB com dados iniciais
npm run db:studio --workspace=gatekeeper-api     # Abre Prisma Studio

# Testing
npm run test --workspace=gatekeeper-api          # Todos os testes
npm run test:watch --workspace=gatekeeper-api    # Watch mode
npm run test:unit --workspace=gatekeeper-api     # Testes unitários
npm run test:integration --workspace=gatekeeper-api  # Testes de integração
npm run test:e2e --workspace=gatekeeper-api      # Testes E2E
```

### Workspace Commands
```bash
npm install              # Instala dependências de todos os workspaces
npm run dev              # Inicia frontend (backend deve ser iniciado separadamente)
```

## Architecture Overview

### Core Concepts

#### 1. Validação em Fases (Gates)
O sistema divide a validação em **4 fases sequenciais**:

- **Gate 0: SANITIZATION (🧹)** - Validação de entrada e escopo
- **Gate 1: CONTRACT (📜)** - Validação de contrato e testes
- **Gate 2: EXECUTION (⚙️)** - Validação de execução/compilação
- **Gate 3: INTEGRITY (🏗️)** - Validação de integridade final

**Características importantes:**
- Gates executam em ordem sequencial
- Falha em um gate bloqueia os subsequentes
- Gates 0-1 são "contract runs" (antes da implementação)
- Gates 2-3 são "execution runs" (após implementação)
- Dentro de cada gate, validadores executam em paralelo

#### 2. Validadores
Unidade atômica de validação. Cada validador:
- Pertence a um gate específico
- Tem ordem de execução dentro do gate
- Pode ser "hard block" (falha bloqueia tudo) ou "soft block"
- Retorna contexto detalhado: inputs, findings, reasoning

Exemplos:
- `TOKEN_BUDGET_FIT` (Gate 0) - Verifica budget de tokens
- `TEST_SYNTAX_VALID` (Gate 1) - Valida compilação do teste
- `TASK_TEST_PASSES` (Gate 2) - Executa o teste
- `PRODUCTION_BUILD_PASS` (Gate 3) - Verifica build de produção

#### 3. Manifest
Define quais arquivos serão modificados e por quê:
```typescript
{
  files: [
    { path: "src/components/Button.tsx", action: "MODIFY", reason: "..." },
    { path: "src/utils/new.ts", action: "CREATE", reason: "..." }
  ],
  testFile: "src/components/Button.spec.tsx"
}
```

#### 4. ValidationContext
Objeto passado para cada validador contendo:
- `runId`, `projectPath`, `baseRef`, `targetRef`
- `manifest`, `contract`, `testFilePath`
- `services`: git, ast, testRunner, compiler, lint, build, tokenCounter, log
- `config`: configurações do workspace
- `bypassedValidators`: validadores contornados

### Backend Architecture

**Camadas:**
```
API Layer (Controllers + Routes)
    ↓
Service Layer (Orquestração + Domínio)
    ↓
Repository Layer (Acesso a dados)
    ↓
Database Layer (Prisma Client)
```

**Estrutura de pastas:**
```
packages/gatekeeper-api/src/
├── api/
│   ├── controllers/      # Handlers HTTP
│   ├── routes/          # Definição de endpoints
│   ├── middlewares/     # CORS, auth, error handling
│   └── schemas/         # Zod validation schemas
├── services/            # Lógica de negócio
├── domain/validators/   # Implementações de validadores por gate
│   ├── gate0/
│   ├── gate1/
│   ├── gate2/
│   └── gate3/
├── repositories/        # Data access layer
├── config/             # Configurações (gates.config.ts, etc)
├── types/              # TypeScript type definitions
├── db/                 # Prisma client
├── server.ts           # Express app setup
└── index.ts            # Entry point
```

**Controllers principais:**
- `ValidationController` - CRUD de validation runs
- `ProjectController` - Gerenciamento de projetos
- `WorkspaceController` - Gerenciamento de workspaces

**Services principais:**
- `ValidationOrchestrator` - Orquestra execução de gates
- `GitService/GitOperationsService` - Operações Git
- `TestRunnerService` - Execução de testes
- `CompilerService` - Compilação TypeScript
- `LintService` - Linting
- `BuildService` - Build de produção

### Frontend Architecture

**Stack:** React 19 + React Router 7 + Radix UI + Tailwind CSS 4

**Estrutura:**
```
src/
├── components/          # Componentes React
│   ├── run-panel.tsx           # Painel principal de run
│   ├── run-details-page.tsx    # Página de detalhes
│   ├── new-validation-page.tsx # Criar validação
│   ├── gates-page.tsx          # Visualizar gates
│   └── ui/                     # Componentes Radix UI
├── hooks/              # Custom React hooks
│   ├── use-customization.tsx   # Context de customização
│   └── useRunEvents.ts         # SSE para updates em tempo real
├── lib/
│   ├── api.ts          # HTTP client (fetch-based)
│   └── types.ts        # Type definitions
├── App.tsx             # Router principal
└── main.tsx            # Entry point
```

**Rotas principais:**
- `/` - Dashboard
- `/runs` - Lista de runs
- `/runs/new` - Criar nova validação
- `/runs/:id` - Detalhes da run
- `/gates` - Visualizar gates/validadores
- `/projects` - Gerenciar projetos

**Comunicação em tempo real:**
- SSE (Server-Sent Events) via `/api/runs/{runId}/events`
- Hook `useRunEvents(runId, callback)` para atualizar UI automaticamente

### Database (Prisma + SQLite)

**Tabelas principais:**
- `Workspace` - Workspace com projetos
- `Project` - Projeto de validação
- `ValidationRun` - Execução de validação
- `GateResult` - Resultado de um gate
- `ValidatorResult` - Resultado de um validador
- `ValidationLog` - Logs detalhados
- `ManifestFile` - Snapshot do manifest

**Fluxo de dados:**
```
ValidationRun (CREATE)
  ↓
Gates executam sequencialmente (0→1→2→3)
  ↓
Para cada Gate:
  ├─ Create GateResult
  └─ Validadores executam em paralelo
     ├─ Create ValidatorResult
     ├─ Execute validator.execute(ctx)
     └─ Update ValidatorResult
```

**Arquivo de DB:** `packages/gatekeeper-api/prisma/dev.db` (SQLite)

## Code Patterns & Best Practices

### Backend

1. **Injeção de Dependências via Context**
   - Validadores recebem serviços via `ValidationContext`
   - Evite imports diretos de serviços nos validadores
   - Facilita testing e isolamento

2. **Repository Pattern**
   - Todo acesso a dados passa por repositories
   - Facilita mudar persistência sem afetar services

3. **Validador Output com Contexto**
   - Sempre retorne `context` com `inputs`, `findings`, `reasoning`
   - Isso permite UI mostrar detalhes da validação

4. **Error Handling**
   - Use try-catch em funções async
   - Middleware de erro global em `src/api/middlewares/errorHandler.ts`

5. **Type Safety**
   - TypeScript strict mode
   - Zod para validação de runtime
   - Prisma para tipos de DB

### Frontend

1. **API Client Namespace**
   - Use `api.runs.list()`, `api.gates.list()`, etc.
   - Não fazer fetch diretamente

2. **Custom Hooks para Dados**
   - `useRunEvents` para SSE
   - `useGitOperations` para Git ops
   - Mantém lógica de dados separada

3. **Radix UI + Tailwind**
   - Componentes headless (Radix) + utility CSS (Tailwind)
   - Separação entre comportamento e estilo

4. **Path Alias**
   - Use `@/` para imports: `import { Button } from '@/components/ui/button'`

### General

1. **Async/Await**
   - Sempre use async/await, nunca promises em cascata
   - Use Promise.all para operações paralelas

2. **Logging**
   - Backend: use Pino via `ctx.services.log`
   - Frontend: use `console.log/error`

3. **Git Operations**
   - Sempre use `GitService` via context
   - Nunca execute comandos git diretamente

## Key Files & Configuration

### Configuration Files
- `vite.config.ts` - Vite configuration (frontend)
- `packages/gatekeeper-api/tsconfig.json` - TypeScript config (backend)
- `packages/gatekeeper-api/prisma/schema.prisma` - Database schema
- `packages/gatekeeper-api/src/config/gates.config.ts` - Gates & validators registry

### Environment Variables
Backend usa `.env` file em `packages/gatekeeper-api/`:
```
DATABASE_URL="file:./prisma/dev.db"
PORT=3000
NODE_ENV=development
```

### Important Paths
- **Database:** `packages/gatekeeper-api/prisma/dev.db`
- **Artifacts:** Configurável por workspace (default: `artifacts/`)
- **Frontend Build:** `dist/`
- **Backend Build:** `packages/gatekeeper-api/dist/`

## Testing

### Backend Tests
```bash
# Todos os testes
npm run test --workspace=gatekeeper-api

# Watch mode
npm run test:watch --workspace=gatekeeper-api

# Apenas unitários
npm run test:unit --workspace=gatekeeper-api

# Apenas integração
npm run test:integration --workspace=gatekeeper-api

# Apenas E2E
npm run test:e2e --workspace=gatekeeper-api
```

Testes localizam-se em `packages/gatekeeper-api/test/`.

### Frontend Tests
```bash
npm test  # Vitest E2E tests
```

## Common Workflows

### Adicionar Novo Validador

1. Defina o validador em `packages/gatekeeper-api/src/config/gates.config.ts`
2. Implemente em `packages/gatekeeper-api/src/domain/validators/gate{N}/`
3. Função deve retornar `ValidatorOutput` com contexto detalhado
4. Use `ValidationContext` para acessar serviços

### Modificar Database Schema

1. Edite `packages/gatekeeper-api/prisma/schema.prisma`
2. Crie migration: `npm run db:migrate --workspace=gatekeeper-api`
3. Gere client: `npm run db:generate --workspace=gatekeeper-api`
4. Atualize seed se necessário: `packages/gatekeeper-api/prisma/seed.ts`

### Adicionar Novo Endpoint API

1. Crie/edite controller em `src/api/controllers/`
2. Adicione schema Zod em `src/api/schemas/`
3. Registre rota em `src/api/routes/`
4. Atualize frontend API client em `src/lib/api.ts`

### Adicionar Nova Página Frontend

1. Crie componente em `src/components/{nome}-page.tsx`
2. Adicione rota em `src/App.tsx`
3. Use `api.*` para chamadas HTTP
4. Use `useRunEvents` se precisar de updates em tempo real

## Important Notes

- **Gates são sequenciais:** Falha em um gate para tudo
- **Validadores são paralelos:** Dentro de um gate, executam simultaneamente
- **Context é rei:** Validadores sempre recebem `ValidationContext`
- **UI Context é crucial:** Retorne `inputs`, `findings`, `reasoning` para UI exibir
- **Git operations:** Sempre via `GitService`, nunca comandos diretos
- **Type safety:** Use Zod para validação de runtime, TypeScript para compile-time
- **SSE para updates:** Frontend usa SSE para receber updates em tempo real de runs
- **Bypass com cuidado:** Validadores podem ser bypassed mas apenas em último recurso
- **Hard vs Soft blocks:** Validadores `isHardBlock=true` bloqueiam tudo ao falhar

## Technology Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React | 19 |
| Routing | React Router | 7 |
| UI Components | Radix UI | Latest |
| Styling | Tailwind CSS | 4 |
| State | React Context + useState | Built-in |
| Forms | React Hook Form + Zod | Latest |
| Backend | Express + TypeScript | 5 / 5.7 |
| Database | Prisma + SQLite | 6 |
| Testing | Vitest | Latest |
| Build | Vite | 7 |
| Runtime | tsx (dev) / Node (prod) | Latest |

## Path Aliases

Both frontend and backend use path aliases:
- `@/` maps to `src/` (configured in `vite.config.ts` and `tsconfig.json`)

Exemplo:
```typescript
import { Button } from '@/components/ui/button'
import { ValidationOrchestrator } from '@/services/ValidationOrchestrator'
```
