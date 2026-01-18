# Árvore de Perguntas: API_ENDPOINT

## Quando Usar
Detectar quando a tarefa menciona:
- Comunicação: API, endpoint, rota, serviço
- Operações: buscar dados, salvar, enviar, receber, atualizar, deletar
- Técnico: backend, servidor, requisição, resposta
- Verbos HTTP: GET, POST, PUT, PATCH, DELETE

---

## Perguntas Organizadas por Tema

### 1. IDENTIFICAÇÃO (sempre perguntar)

```
1.1 O que essa API faz em uma frase simples?
    (resposta livre)
    
    Exemplo: "busca os dados de um lead", "salva um novo contato", "deleta uma tarefa"

1.2 Qual é o "recurso" principal?
    (o "objeto" que a API manipula)
    
    Exemplo: lead, usuário, tarefa, pedido, produto
```

---

### 2. OPERAÇÃO

```
2.1 Qual tipo de operação?
    A) Buscar/consultar dados (não muda nada)
    B) Criar algo novo
    C) Atualizar algo existente
    D) Remover/deletar algo
    E) Executar uma ação (ex: enviar email, processar pagamento)
    F) Não sei / tanto faz → Perguntar: "O que a API deve fazer?"

2.2 [Se buscar] Busca um item específico ou uma lista?
    A) Um item específico (por ID, por exemplo)
    B) Uma lista (vários itens)
    C) Não sei → Default: depende do contexto

2.3 [Se lista] A lista pode ser grande?
    A) Sim, precisa de paginação
    B) Não, sempre poucos itens
    C) Não sei / tanto faz → Default: com paginação se > 20 itens típicos
```

---

### 3. DADOS DE ENTRADA

```
3.1 [Se criar/atualizar] Quais informações precisam ser enviadas?
    (resposta livre - liste os campos)
    
    Exemplo: "nome, email, telefone"

3.2 [Se criar/atualizar] Quais campos são obrigatórios?
    A) Todos os que listei
    B) Apenas alguns → Perguntar: "Quais?"
    C) Nenhum
    D) Não sei / tanto faz → Default: campos principais são obrigatórios

3.3 [Se buscar/atualizar/deletar] Como identificar o item?
    A) Por ID
    B) Por outro campo → Perguntar: "Qual campo?"
    C) Por combinação de campos
    D) Não sei / tanto faz → Default: por ID

3.4 [Se lista] Precisa de filtros?
    A) Sim → Perguntar: "Filtrar por quê? (ex: status, data, nome)"
    B) Não
    C) Não sei / tanto faz → Default: sem filtros
```

---

### 4. DADOS DE SAÍDA

```
4.1 [Se buscar] Quais informações devem vir na resposta?
    A) Todas do recurso
    B) Apenas algumas → Perguntar: "Quais?"
    C) Não sei / tanto faz → Default: campos principais

4.2 [Se criar/atualizar] O que deve vir na resposta?
    A) O item criado/atualizado completo
    B) Só confirmação de sucesso
    C) Só o ID do item
    D) Não sei / tanto faz → Default: item completo

4.3 [Se deletar] O que deve vir na resposta?
    A) Confirmação de sucesso
    B) Os dados do item deletado
    C) Nada (só status de sucesso)
    D) Não sei / tanto faz → Default: confirmação simples
```

---

### 5. QUEM PODE USAR (AUTENTICAÇÃO)

```
5.1 Quem pode usar essa API?
    A) Qualquer pessoa (público)
    B) Apenas usuários logados
    C) Apenas administradores
    D) Apenas o próprio usuário (seus dados)
    E) Depende de permissões específicas → Perguntar: "Quais?"
    F) Não sei / tanto faz → Default: usuários logados

5.2 [Se "próprio usuário" ou permissões] Precisa verificar se o usuário tem acesso a esse recurso específico?
    (ex: usuário só pode ver seus próprios leads)
    
    A) Sim
    B) Não, se está logado pode acessar qualquer um
    C) Não sei / tanto faz → Default: sim, verificar ownership
```

---

### 6. ERROS

```
6.1 O que pode dar errado?
    (múltipla escolha - marque todos que aplicam)
    
    [ ] Dados inválidos (ex: email mal formatado)
    [ ] Campo obrigatório faltando
    [ ] Recurso não encontrado (ID não existe)
    [ ] Sem permissão para acessar
    [ ] Já existe (duplicado)
    [ ] Limite excedido (rate limit)
    [ ] Outro → Perguntar: "Qual?"
    
    → Se não souber: incluir os 4 primeiros como padrão

6.2 As mensagens de erro devem ser em qual idioma?
    A) Português
    B) Inglês
    C) Não sei / tanto faz → Default: português
```

---

### 7. VALIDAÇÕES

```
7.1 [Se tiver campos] Tem alguma validação específica?
    (resposta livre)
    
    Exemplos:
    - "email deve ser válido"
    - "telefone deve ter 11 dígitos"
    - "data não pode ser no passado"
    - "valor deve ser positivo"
    
    → Se não souber: assumir validações padrão por tipo de campo

7.2 [Se criar] Pode criar duplicado?
    (ex: dois leads com mesmo email)
    
    A) Não, deve ser único → Perguntar: "Único por qual campo?"
    B) Sim, pode duplicar
    C) Não sei / tanto faz → Default: depende do recurso
```

---

### 8. EFEITOS COLATERAIS

```
8.1 [Se criar/atualizar/deletar] Acontece mais alguma coisa além de salvar?
    (ex: enviar email, notificação, atualizar outro sistema)

    A) Sim → Perguntar: "O quê?"
    B) Não, só salva
    C) Não sei / tanto faz → Default: sem efeitos colaterais

8.2 [Se deletar] É deleção permanente ou vai para lixeira?
    A) Permanente (remove de verdade)
    B) Soft delete (marca como deletado, pode recuperar)
    C) Não sei / tanto faz → Default: soft delete
```

---

### 9. SUPERFÍCIE DE TESTES (T180-T183)

**IMPORTANTE**: Para contratos em modo STRICT, estas perguntas são OBRIGATÓRIAS.

```
9.1 Quais códigos de STATUS você espera que a API retorne?
    (Marque todos que se aplicam)

    Sucesso:
    [ ] 200 (OK - retorna dados)
    [ ] 201 (Criado - novo item)
    [ ] 204 (Sem conteúdo - apenas sucesso)

    Erro:
    [ ] 400 (Dados inválidos)
    [ ] 401 (Não autenticado)
    [ ] 403 (Sem permissão)
    [ ] 404 (Não encontrado)
    [ ] 409 (Conflito/duplicado)
    [ ] 422 (Validação falhou)
    [ ] 500 (Erro do servidor)
    [ ] Outro → Qual?

    → Se não souber: incluir 200/201, 400, 401, 404, 500 como padrão

9.2 [T181] A API usa códigos de erro estruturados?
    (ex: "AUTH_INVALID", "VALIDATION_ERROR" em vez de apenas mensagens)

    A) Sim → Perguntar: "Quais códigos podem aparecer?"
       Exemplos: AUTH_INVALID_CREDENTIALS, AUTH_ACCOUNT_LOCKED, VALIDATION_ERROR, NOT_FOUND
    B) Não, só mensagens de erro em texto
    C) Não sei / tanto faz → Default: sem códigos estruturados

9.3 [T183] Quais campos IMPORTANTES da resposta os testes devem verificar?
    (resposta livre - liste os campos principais usando ponto para aninhados)

    Exemplos:
    - Para login: "token", "user.id", "user.email", "expiresIn"
    - Para buscar lead: "id", "name", "email", "status", "createdAt"
    - Para lista: "items", "total", "page"

    **IMPORTANTE**: Prefira IDs estáveis (id, uuid, slug) em vez de nomes ou textos variáveis

    → Se não souber: incluir campos mencionados na resposta de sucesso

9.4 [T182] Cenários de ERRO - O que exatamente deve acontecer em cada caso?
    (Para cada erro que marcou em 6.1, especifique o comportamento)

    Exemplos:
    - "Senha incorreta → retorna 401 com código AUTH_INVALID_CREDENTIALS"
    - "Email já existe → retorna 409 com código USER_ALREADY_EXISTS"
    - "Campo obrigatório faltando → retorna 400 com details.field"

    → Se não souber: usar padrões REST (400 para validação, 401 para auth, 404 para não encontrado)
```

---

## Fluxo de Perguntas Recomendado

```
Rodada 1 (Essenciais):
├── 1.1 O que faz
├── 1.2 Recurso principal
├── 2.1 Tipo de operação
├── 5.1 Quem pode usar
└── 6.1 O que pode dar errado

Rodada 2 (Detalhamento):
├── 3.x Dados de entrada (se aplicável)
├── 4.x Dados de saída
├── 7.1 Validações específicas
└── 2.3 Paginação (se lista)

Rodada 3 (Superfície de Testes - T180-T183):
├── 9.1 Status codes esperados
├── 9.2 Códigos de erro estruturados (T181)
├── 9.3 Campos importantes da resposta (T183)
└── 9.4 Cenários de erro detalhados (T182)

Rodada 4 (Refinamento):
├── 5.2 Verificar ownership
├── 8.1 Efeitos colaterais
└── 8.2 Tipo de deleção (se deletar)
```

---

## Mapeamento Pergunta → Seção do taskPrompt

| Pergunta | Seção no taskPrompt |
|----------|---------------------|
| 1.x | Cabeçalho (NOME, descrição) |
| 2.x | METHOD, PATH |
| 3.x | REQUEST (body, params, query) |
| 4.x | RESPONSE (success) |
| 5.x | AUTENTICAÇÃO |
| 6.x | ERROS |
| 7.x | VALIDAÇÕES |
| 8.x | EFEITOS |

---

## Templates de Resposta por Operação

### BUSCAR UM (GET /:id)
```
- Método: GET
- Rota: /api/{recurso}/{id}
- Sucesso: 200 + dados
- Erros: 404 (não encontrado), 401 (não autenticado), 403 (sem permissão)
```

### BUSCAR LISTA (GET /)
```
- Método: GET
- Rota: /api/{recurso}
- Query params: page, limit, filtros
- Sucesso: 200 + array + paginação
- Erros: 401 (não autenticado)
```

### CRIAR (POST /)
```
- Método: POST
- Rota: /api/{recurso}
- Body: campos do recurso
- Sucesso: 201 + item criado
- Erros: 400 (validação), 401, 403, 409 (duplicado)
```

### ATUALIZAR (PUT ou PATCH /:id)
```
- Método: PUT (completo) ou PATCH (parcial)
- Rota: /api/{recurso}/{id}
- Body: campos a atualizar
- Sucesso: 200 + item atualizado
- Erros: 400, 401, 403, 404
```

### DELETAR (DELETE /:id)
```
- Método: DELETE
- Rota: /api/{recurso}/{id}
- Sucesso: 204 (sem corpo) ou 200 + confirmação
- Erros: 401, 403, 404
```

---

## Perguntas Condicionais por Contexto

### Se mencionou "buscar" ou "listar"
- Adicionar: "Precisa ordenar? Por qual campo?"
- Adicionar: "Precisa de busca por texto?"

### Se mencionou "criar" ou "cadastrar"
- Adicionar: "Tem campos com valor padrão?"
- Adicionar: "Algum campo é gerado automaticamente? (ex: data de criação)"

### Se mencionou "atualizar"
- Adicionar: "Pode atualizar todos os campos ou só alguns?"
- Adicionar: "Precisa validar se algo mudou antes de salvar?"

### Se mencionou "deletar"
- Adicionar: "Precisa de confirmação?"
- Adicionar: "Deleta em cascata? (ex: deletar lead deleta suas tarefas)"

### Se mencionou "arquivo" ou "upload"
- Adicionar: "Quais tipos de arquivo aceita?"
- Adicionar: "Qual o tamanho máximo?"
- Adicionar: "Onde armazena? (servidor local, S3, etc)"
