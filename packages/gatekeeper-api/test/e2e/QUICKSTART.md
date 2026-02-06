# Quickstart - Testes E2E de Resiliência

Guia rápido para executar os testes de integração end-to-end do sistema de reconciliação SSE.

## 🚀 Execução Rápida

```bash
# Na raiz do projeto
npm run test:e2e:resilience --workspace=gatekeeper-api
```

Ou dentro do workspace:

```bash
cd packages/gatekeeper-api
npm run test:e2e:resilience
```

## ⚙️ Pré-requisitos

### 1. Dependências instaladas
```bash
npm install
```

### 2. Prisma Client gerado
```bash
npm run db:generate --workspace=gatekeeper-api
```

### 3. Variáveis de ambiente configuradas

Crie `.env` em `packages/gatekeeper-api/`:

```env
DATABASE_URL="file:./prisma/dev.db"
PORT=3000
NODE_ENV=development

# Pelo menos um provider deve estar configurado
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
MISTRAL_API_KEY=...
```

**Nota:** Os testes E2E usam um DB de teste separado (`test.db`), então não há risco de corromper dados de desenvolvimento.

## 📊 Output Esperado

```
✓ test/e2e/pipeline-resilience.e2e.spec.ts (5 tests) 180s
  ✓ Pipeline Resilience & Deduplication E2E (5 tests) 180s
    ✓ should restore state after tab discard and continue without duplicates 65s
    ✓ should reconcile divergent local/remote state (backend wins) 35s
    ✓ should deduplicate duplicate events from SSE 18s
    ✓ should maintain monotonic event IDs and sequences 45s
    ✓ should replay only missed events via Last-Event-ID 28s

Test Files  1 passed (1)
     Tests  5 passed (5)
  Start at  14:30:15
  Duration  180.42s
```

## 🔍 Executar Teste Específico

```bash
# Apenas teste de tab discard
npx vitest -t "should restore state after tab discard"

# Apenas teste de deduplicação
npx vitest -t "should deduplicate"

# Modo watch (útil durante desenvolvimento)
npx vitest test/e2e/pipeline-resilience.e2e.spec.ts --watch
```

## 🐛 Troubleshooting

### Teste falha com timeout

**Sintoma:**
```
Error: waitForEvent timeout after 30000ms
```

**Soluções:**
1. Aumentar timeout no teste (já configurado para 60-90s)
2. Verificar se providers LLM estão configurados
3. Verificar rate limiting das APIs externas
4. Rodar em modo watch com log verbose:

```bash
VITEST_LOG_LEVEL=debug npx vitest test/e2e/pipeline-resilience.e2e.spec.ts --watch
```

### Erro de conexão SSE

**Sintoma:**
```
Error: SSE connection error
```

**Soluções:**
1. Verificar se servidor backend está acessível na porta 3001
2. Verificar firewall/antivírus bloqueando conexões locais
3. Verificar se EventSource está disponível (Node.js >= 18)

### Erro de banco de dados

**Sintoma:**
```
PrismaClientInitializationError: Can't reach database server
```

**Soluções:**
```bash
# Regerar Prisma Client
npm run db:generate --workspace=gatekeeper-api

# Aplicar migrations
npm run db:migrate --workspace=gatekeeper-api
```

### Pipeline não completa

**Sintoma:**
Teste fica stuck aguardando `bridge_complete`

**Soluções:**
1. Verificar logs do teste para ver último evento recebido
2. Verificar se provider LLM está funcionando
3. Aumentar timeout ou usar `client.pollUntil()` para verificar status

## 📈 Tempo de Execução

| Teste | Tempo Médio | Timeout |
|-------|-------------|---------|
| Tab Discard | 60-65s | 90s |
| Divergência | 30-35s | 50s |
| Deduplicação | 15-18s | 30s |
| Monotonia | 40-45s | 60s |
| Replay | 25-28s | 40s |
| **TOTAL** | **~3 min** | **4.5 min** |

**Nota:** Tempo varia dependendo de:
- Latência das APIs LLM (Claude, OpenAI, Mistral)
- Hardware (CPU, RAM)
- Network (rate limiting)

## 🧪 Executar em CI/CD

Exemplo para GitHub Actions:

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e-resilience:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - run: npm install

      - run: npm run db:generate --workspace=gatekeeper-api

      - run: npm run test:e2e:resilience --workspace=gatekeeper-api
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

## 📚 Mais Informações

- **Documentação completa:** `test/e2e/README.md`
- **Template para novos testes:** `test/e2e/example-test.template.ts`
- **Arquitetura do sistema:** `CLAUDE.md` (raiz do projeto)
- **Implementação hooks:**
  - `src/hooks/usePipelineReconciliation.ts`
  - `src/hooks/useOrchestratorEvents.ts`

## 🎯 Cobertura de Testes

- ✅ Reconexão após tab discard
- ✅ Divergência local/remote (backend wins)
- ✅ Deduplicação de eventos SSE
- ✅ Monotonia de IDs
- ✅ Replay via Last-Event-ID
- ⏳ Multi-aba (futuro)

## 🤝 Contribuindo

Para adicionar novos testes:

1. Copie `example-test.template.ts`
2. Renomeie para `{nome}.e2e.spec.ts`
3. Implemente casos de teste
4. Execute: `npx vitest test/e2e/{nome}.e2e.spec.ts`
5. Documente no README.md

---

**Dúvidas?** Veja `README.md` nesta pasta ou abra uma issue.
