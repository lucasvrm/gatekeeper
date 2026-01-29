# Gatekeeper API

Backend do Gatekeeper - Sistema de validação progressiva para desenvolvimento de software assistido por LLM.

## Visão Geral

O Gatekeeper API fornece:
- Sistema de gates de validação progressiva (Gates 0-3)
- Validadores especializados para qualidade de código
- Gerenciamento de contratos e testes
- API REST para integração com frontend

## Arquitetura

### Gates de Validação

O Gatekeeper utiliza um sistema de 4 gates sequenciais:

- **Gate 0 - SANITIZATION**: Validação de entrada e escopo
- **Gate 1 - CONTRACT**: Validação de contrato e testes
- **Gate 2 - EXECUTION**: Validação de execução e compilação
- **Gate 3 - INTEGRITY**: Validação de integridade final

Cada gate contém múltiplos validators que devem passar para avançar.

### Validators

Validators são unidades de validação que executam verificações específicas:
- Sintaxe e formato de testes
- Cobertura de cláusulas contratuais
- Compilação e lint
- Execução de testes
- Validação de diff e manifest

## Tecnologias

- **Node.js** + **TypeScript**
- **Express** - Framework web
- **Prisma** - ORM
- **SQLite** - Banco de dados
- **Vitest** - Framework de testes

## Setup

```bash
# Instalar dependências
npm install

# Gerar Prisma Client
npx prisma generate

# Executar migrações
npx prisma migrate dev

# Iniciar servidor de desenvolvimento
npm run dev
```

## Testes

```bash
# Executar todos os testes
npm test

# Executar testes específicos
npm test -- path/to/test.spec.ts
```

## API Endpoints

### Projects
- `GET /api/projects` - Listar projetos
- `GET /api/projects/:id` - Obter projeto
- `POST /api/projects` - Criar projeto
- `PUT /api/projects/:id` - Atualizar projeto
- `DELETE /api/projects/:id` - Deletar projeto

### Validation Runs
- `GET /api/runs` - Listar runs
- `GET /api/runs/:id` - Obter run
- `POST /api/runs` - Criar run
- `GET /api/runs/:id/results` - Obter resultados detalhados
- `POST /api/runs/:id/abort` - Abortar run
- `DELETE /api/runs/:id` - Deletar run

### Gates & Validators
- `GET /api/gates` - Listar gates
- `GET /api/gates/:number/validators` - Listar validators de um gate
- `GET /api/validators` - Listar todos os validators
- `PUT /api/validators/:code` - Atualizar validator

## Estrutura de Diretórios

```
src/
├── api/
│   ├── controllers/     # Controllers REST
│   └── routes/          # Definição de rotas
├── config/              # Configuração de gates
├── domain/
│   └── validators/      # Implementação dos validators
├── repositories/        # Acesso a dados
├── services/            # Lógica de negócio
├── types/               # Definições TypeScript
└── db/                  # Cliente Prisma
```

## Licença

MIT
