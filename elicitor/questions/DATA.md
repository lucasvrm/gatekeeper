# Árvore de Perguntas: DATA

## Quando Usar
Detectar quando a tarefa menciona:
- Operações: criar, cadastrar, adicionar, novo
- Modificação: editar, atualizar, modificar, alterar
- Remoção: excluir, deletar, remover, apagar
- CRUD: CRUD, gerenciar, manter
- Entidades: registro, item, dados, entidade

---

## Perguntas Organizadas por Tema

### 1. IDENTIFICAÇÃO (sempre perguntar)

```
1.1 Qual é a "coisa" que você quer criar/editar/excluir?
    (o nome da entidade)
    
    Exemplos: "lead", "tarefa", "produto", "cliente", "pedido"

1.2 Essa coisa já existe no sistema ou é nova?
    A) Já existe, quero modificar como funciona
    B) É nova, precisa criar do zero
    C) Não sei → Assumir que precisa verificar
```

---

### 2. OPERAÇÃO

```
2.1 O que você quer fazer com [entidade]?
    A) Criar novos registros
    B) Editar registros existentes
    C) Excluir registros
    D) Visualizar detalhes (só leitura)
    E) Listar/buscar vários
    F) Múltiplas operações → Perguntar: "Quais?"

2.2 [Se múltiplas] Qual é a principal agora?
    → Focar na operação principal, outras viram tarefas separadas
```

---

### 3. CAMPOS / ESTRUTURA

```
3.1 Quais informações esse [entidade] tem?
    (liste os campos)
    
    Exemplo para Lead:
    - nome, email, telefone, empresa, cargo, origem, status
    
    → Se não souber: perguntar "Me conta um pouco sobre o que é um [entidade] no seu contexto"

3.2 Quais campos são obrigatórios?
    A) Todos os que listou
    B) Apenas alguns → Perguntar: "Quais?"
    C) Nenhum (todos opcionais)
    D) Não sei / tanto faz → Default: campos principais

3.3 Algum campo tem opções fixas?
    (campos tipo "selecionar uma opção")
    
    Exemplos:
    - Status: Novo, Em contato, Qualificado, Descartado
    - Prioridade: Baixa, Média, Alta
    
    → Se não souber: assumir sem, pode adicionar depois

3.4 Algum campo tem valor padrão?
    (valor que já vem preenchido)
    
    Exemplos:
    - Status padrão: "Novo"
    - Data de criação: data atual
    
    → Se não souber: assumir sem valor padrão

3.5 Algum campo é único? (não pode repetir)
    (ex: não pode ter dois leads com mesmo email)
    
    A) Sim → Perguntar: "Qual campo?"
    B) Não, pode ter duplicados
    C) Não sei / tanto faz → Default: email geralmente é único
```

---

### 4. VALIDAÇÕES

```
4.1 Tem alguma regra de validação especial?
    (resposta livre)
    
    Exemplos:
    - "Email precisa ser válido"
    - "Telefone só números, 10 ou 11 dígitos"
    - "Data não pode ser no passado"
    - "Valor mínimo R$ 100"
    
    → Se não souber: assumir validações básicas por tipo de campo

4.2 Precisa validar algo em sistema externo?
    (ex: validar CPF na Receita, CEP nos Correios)
    
    A) Sim → Perguntar: "O quê e onde?"
    B) Não
    C) Não sei / tanto faz → Default: não
```

---

### 5. RELACIONAMENTOS

```
5.1 Esse [entidade] pertence a algo?
    (ex: tarefa pertence a um lead, item pertence a um pedido)
    
    A) Sim → Perguntar: "Pertence a quê?"
    B) Não, é independente
    C) Não sei / tanto faz → Assumir independente

5.2 [Se pertence] O que acontece se o "pai" for excluído?
    A) Exclui junto (cascata)
    B) Não deixa excluir enquanto tiver filhos
    C) Fica órfão (mantém sem vínculo)
    D) Não sei / tanto faz → Default: não deixa excluir

5.3 Esse [entidade] tem "filhos"?
    (ex: lead tem tarefas, pedido tem itens)
    
    A) Sim → Perguntar: "Quais?"
    B) Não
    C) Não sei / tanto faz → Assumir não
```

---

### 6. PERMISSÕES

```
6.1 Quem pode criar [entidade]?
    A) Qualquer usuário logado
    B) Apenas administradores
    C) Depende de permissão específica
    D) Não sei / tanto faz → Default: usuários logados

6.2 Quem pode editar [entidade]?
    A) Quem criou
    B) Qualquer usuário logado
    C) Apenas administradores
    D) Quem criou + administradores
    E) Não sei / tanto faz → Default: quem criou + admins

6.3 Quem pode excluir [entidade]?
    A) Quem criou
    B) Apenas administradores
    C) Quem criou + administradores
    D) Ninguém (não pode excluir)
    E) Não sei / tanto faz → Default: apenas admins
```

---

### 7. DELEÇÃO

```
7.1 [Se excluir] A exclusão é permanente?
    A) Sim, remove de verdade
    B) Não, vai para lixeira (pode recuperar)
    C) Não, só marca como inativo
    D) Não sei / tanto faz → Default: soft delete (lixeira)

7.2 [Se lixeira] Por quanto tempo fica na lixeira?
    A) Para sempre (até limpar manualmente)
    B) Tempo limitado → Perguntar: "Quanto tempo?"
    C) Não sei / tanto faz → Default: 30 dias
```

---

### 8. HISTÓRICO / AUDITORIA

```
8.1 Precisa guardar histórico de alterações?
    (quem mudou o quê e quando)
    
    A) Sim, completo (todas as mudanças)
    B) Sim, básico (só última alteração)
    C) Não precisa
    D) Não sei / tanto faz → Default: básico (última alteração)

8.2 [Se histórico] Quais campos rastrear?
    A) Todos
    B) Apenas alguns importantes → Perguntar: "Quais?"
    C) Não sei → Default: todos
```

---

### 9. EFEITOS COLATERAIS

```
9.1 [Se criar] Acontece mais alguma coisa quando cria?
    (ex: enviar email, criar tarefa automática, notificar alguém)
    
    A) Sim → Perguntar: "O quê?"
    B) Não, só cria
    C) Não sei / tanto faz → Default: não

9.2 [Se editar] Acontece mais alguma coisa quando edita?
    A) Sim → Perguntar: "O quê?"
    B) Não, só salva
    C) Não sei / tanto faz → Default: não

9.3 [Se excluir] Acontece mais alguma coisa quando exclui?
    A) Sim → Perguntar: "O quê?"
    B) Não, só exclui
    C) Não sei / tanto faz → Default: não
```

---

## Fluxo de Perguntas Recomendado

```
Rodada 1 (Essencial):
├── 1.1 Nome da entidade
├── 2.1 Operação desejada
├── 3.1 Campos/informações
└── 3.2 Campos obrigatórios

Rodada 2 (Regras):
├── 3.5 Campo único
├── 4.1 Validações especiais
├── 6.x Permissões
└── 5.1 Relacionamentos

Rodada 3 (Refinamento):
├── 7.x Deleção (se aplicável)
├── 8.1 Histórico
└── 9.x Efeitos colaterais
```

---

## Mapeamento Pergunta → Seção do taskPrompt

| Pergunta | Seção no taskPrompt |
|----------|---------------------|
| 1.x | ENTIDADE |
| 2.x | OPERAÇÃO |
| 3.x | CAMPOS |
| 4.x | VALIDAÇÕES |
| 5.x | RELACIONAMENTOS |
| 6.x | PERMISSÕES |
| 7.x | DELEÇÃO |
| 8.x | AUDITORIA |
| 9.x | EFEITOS |

---

## Template de Campos por Tipo

### Campos Comuns a Toda Entidade
```
- id: identificador único (gerado automaticamente)
- createdAt: data de criação (automático)
- updatedAt: data de última alteração (automático)
- createdBy: quem criou (automático se tiver auth)
```

### Tipos de Campo e Validações Padrão

| Tipo | Validação Padrão |
|------|------------------|
| texto | Não vazio se obrigatório |
| email | Formato válido + não vazio |
| telefone | Só números, 10-11 dígitos |
| cpf | 11 dígitos + dígito verificador |
| cnpj | 14 dígitos + dígito verificador |
| data | Formato válido |
| número | Numérico |
| dinheiro | Numérico, >= 0 |
| url | Formato válido |
| enum/seleção | Valor dentro das opções |
| boolean | true/false |

---

## Templates de Operação

### CRIAR
```
OPERAÇÃO: CREATE
ENTIDADE: {nome}

CAMPOS:
| Campo | Tipo | Obrigatório | Validação |
|-------|------|-------------|-----------|
| ... | ... | ... | ... |

PRÉ-CONDIÇÕES:
- Usuário autenticado
- [Outras]

PÓS-AÇÕES:
- [Efeitos colaterais]

ERROS POSSÍVEIS:
- Validação falhou
- Duplicado (campo único)
- Sem permissão
```

### EDITAR
```
OPERAÇÃO: UPDATE
ENTIDADE: {nome}
IDENTIFICADOR: {campo} (geralmente id)

CAMPOS EDITÁVEIS:
| Campo | Validação |
|-------|-----------|
| ... | ... |

CAMPOS IMUTÁVEIS:
- [campos que não podem mudar]

PRÉ-CONDIÇÕES:
- Registro existe
- Usuário tem permissão

ERROS POSSÍVEIS:
- Não encontrado
- Sem permissão
- Validação falhou
```

### EXCLUIR
```
OPERAÇÃO: DELETE
ENTIDADE: {nome}
IDENTIFICADOR: {campo}

TIPO: {hard/soft delete}

PRÉ-CONDIÇÕES:
- Registro existe
- Usuário tem permissão
- [Sem dependências, se aplicável]

CASCATA:
- [O que acontece com relacionamentos]

ERROS POSSÍVEIS:
- Não encontrado
- Sem permissão
- Tem dependências
```

---

## Perguntas Condicionais por Contexto

### Se for entidade FINANCEIRA (pagamento, transação)
- Adicionar: "Precisa de idempotência? (evitar duplicar)"
- Adicionar: "Tem estorno/cancelamento?"
- Adicionar: "Gera comprovante?"

### Se for entidade com ARQUIVO (documento, imagem)
- Adicionar: "Quais tipos de arquivo aceita?"
- Adicionar: "Tem limite de tamanho?"
- Adicionar: "Pode ter múltiplos arquivos?"

### Se for entidade com STATUS/WORKFLOW
- Adicionar: "Quais são os status possíveis?"
- Adicionar: "Quais transições são permitidas?"
- Adicionar: "Quem pode mudar de status?"

### Se for entidade HIERÁRQUICA (categorias, pastas)
- Adicionar: "Pode ter sub-itens?"
- Adicionar: "Quantos níveis de profundidade?"
- Adicionar: "Pode mover entre níveis?"

### Se mencionou IMPORTAÇÃO em massa
- Adicionar: "De onde importa? (Excel, CSV)"
- Adicionar: "O que fazer se linha tiver erro?"
- Adicionar: "Atualiza existentes ou só cria novos?"
