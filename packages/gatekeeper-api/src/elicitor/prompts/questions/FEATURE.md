# Árvore de Perguntas: FEATURE

## Quando Usar
Detectar quando a tarefa menciona:
- Fluxo completo: funcionalidade, feature, permitir que, o usuário pode
- Processo: jornada, etapas, workflow, processo
- Ação composta: cadastrar e enviar, buscar e filtrar
- User story: como usuário, eu quero, para que

---

## Perguntas Organizadas por Tema

### 1. OBJETIVO (sempre perguntar)

```
1.1 Quem vai usar essa funcionalidade?
    (o tipo de usuário)
    
    Exemplos: "visitante", "usuário logado", "administrador", "vendedor"

1.2 O que essa pessoa quer conseguir fazer?
    (o objetivo final)
    
    Exemplo: "cadastrar um novo lead", "acompanhar o status do pedido"

1.3 Por que isso é importante?
    (o benefício/valor)
    
    Exemplo: "para não perder oportunidades de venda", "para saber quando vai receber"
```

---

### 2. FLUXO PRINCIPAL (Happy Path)

```
2.1 Descreva passo a passo o que acontece quando tudo dá certo:
    (resposta livre - guiada)
    
    Formato sugerido:
    1. Usuário faz [ação]
    2. Sistema [resposta]
    3. Usuário faz [próxima ação]
    ...
    
    Exemplo:
    1. Usuário clica em "Novo Lead"
    2. Abre formulário de cadastro
    3. Usuário preenche nome, email, telefone
    4. Usuário clica em "Salvar"
    5. Sistema salva e mostra mensagem de sucesso
    6. Volta para lista de leads

2.2 [Se resposta curta] Preciso de mais detalhes. Entre o passo [X] e [Y], o que acontece?
    → Iterar até ter fluxo completo

2.3 Onde o usuário começa? (ponto de entrada)
    A) Em uma página específica → Perguntar: "Qual página?"
    B) Clicando em um botão/link → Perguntar: "Onde fica esse botão?"
    C) Recebendo uma notificação/email
    D) Não sei / tanto faz → Default: página principal do contexto

2.4 Onde o usuário termina? (ponto de saída)
    A) Na mesma página que começou
    B) Em outra página → Perguntar: "Qual?"
    C) Modal fecha e atualiza a página
    D) Não sei / tanto faz → Default: volta ao ponto de origem
```

---

### 3. FLUXOS ALTERNATIVOS (O que pode dar errado)

```
3.1 O que pode impedir o usuário de completar?
    (múltipla escolha)
    
    [ ] Dados inválidos (preencheu errado)
    [ ] Falta informação obrigatória
    [ ] Sem permissão para fazer isso
    [ ] Sistema fora do ar / erro técnico
    [ ] Já existe (duplicado)
    [ ] Prazo expirado / muito tarde
    [ ] Outro → Perguntar: "O quê?"
    
    → Se não souber: incluir os 4 primeiros

3.2 Para cada erro selecionado: O que deve acontecer?
    (resposta livre ou opções)
    
    A) Mostra mensagem e deixa tentar de novo
    B) Bloqueia e explica o motivo
    C) Sugere alternativa
    D) Não sei → Default: mensagem + permite tentar novamente

3.3 O usuário pode cancelar no meio do processo?
    A) Sim → Perguntar: "O que acontece com o que já preencheu?"
    B) Não, precisa completar
    C) Não sei / tanto faz → Default: pode cancelar, perde dados não salvos

3.4 O usuário pode voltar para passos anteriores?
    A) Sim, livremente
    B) Sim, mas perde o progresso do passo atual
    C) Não, só para frente
    D) Não sei / tanto faz → Default: pode voltar sem perder dados
```

---

### 4. REGRAS DE NEGÓCIO

```
4.1 Tem alguma condição que precisa ser verdadeira?
    (pré-condições)
    
    Exemplos:
    - "Só pode criar lead se tiver menos de 100 ativos"
    - "Só pode aprovar se for gerente"
    - "Só pode editar se criou há menos de 24h"
    
    → Se não souber: assumir sem pré-condições especiais

4.2 Tem algum limite ou restrição?
    (limites de negócio)
    
    Exemplos:
    - "Máximo 5 por dia"
    - "Mínimo R$ 100"
    - "Só até dia 15 do mês"
    
    → Se não souber: assumir sem limites

4.3 Tem alguma validação específica do negócio?
    (além das validações técnicas)
    
    Exemplos:
    - "CNPJ precisa ser válido na Receita"
    - "Não pode agendar no passado"
    - "Precisa ter pelo menos 1 produto"
    
    → Se não souber: assumir validações básicas
```

---

### 5. COMPONENTES ENVOLVIDOS

```
5.1 Quais telas/páginas fazem parte desse fluxo?
    (resposta livre)
    
    → Se não souber: derivar do fluxo descrito

5.2 Essa funcionalidade usa algo que já existe no sistema?
    A) Sim → Perguntar: "O quê?"
    B) Não, tudo novo
    C) Não sei → Assumir componentes novos

5.3 Precisa de alguma integração externa?
    (ex: enviar email, processar pagamento, consultar API externa)
    
    A) Sim → Perguntar: "Qual?"
    B) Não
    C) Não sei / tanto faz → Default: sem integração
```

---

### 6. RESULTADO FINAL

```
6.1 Como o usuário sabe que completou com sucesso?
    A) Mensagem de confirmação
    B) Email de confirmação
    C) Mudança visual na tela (ex: status atualizado)
    D) Redirecionado para nova página
    E) Combinação → Perguntar: "Quais?"
    F) Não sei / tanto faz → Default: mensagem + atualização visual

6.2 O que muda no sistema após completar?
    (o que fica diferente)
    
    Exemplos:
    - "Novo lead aparece na lista"
    - "Status muda para 'Em andamento'"
    - "Contador atualiza"
    
    → Se não souber: derivar do objetivo
```

---

## Fluxo de Perguntas Recomendado

```
Rodada 1 (Contexto):
├── 1.1 Quem usa
├── 1.2 O que quer fazer
├── 1.3 Por que é importante
└── 2.1 Fluxo passo a passo

Rodada 2 (Detalhamento):
├── 2.3 Onde começa
├── 2.4 Onde termina
├── 3.1 O que pode dar errado
└── 6.1 Como sabe que completou

Rodada 3 (Refinamento):
├── 3.3 Pode cancelar
├── 3.4 Pode voltar
├── 4.x Regras de negócio
└── 5.3 Integrações
```

---

## Mapeamento Pergunta → Seção do taskPrompt

| Pergunta | Seção no taskPrompt |
|----------|---------------------|
| 1.x | OBJETIVO (user story) |
| 2.x | FLUXO PRINCIPAL |
| 3.x | FLUXOS ALTERNATIVOS |
| 4.x | REGRAS DE NEGÓCIO |
| 5.x | COMPONENTES |
| 6.x | RESULTADO |

---

## Template de User Story

Com base nas respostas, gerar:

```
Como [1.1 - quem],
Eu quero [1.2 - o quê],
Para que [1.3 - por quê].
```

---

## Diagrama de Fluxo (para contract.md)

Gerar diagrama ASCII baseado nas respostas:

```
[Início: {2.3}]
      │
      ▼
┌─────────────┐
│  Passo 1    │
└──────┬──────┘
       │
   ┌───┴───┐
   │ OK?   │
   └───┬───┘
      / \
    Sim  Não
    │     │
    ▼     ▼
[Passo 2] [Erro: {3.2}]
    │
   ...
    │
    ▼
[Fim: {2.4}]
   + {6.1}
```

---

## Perguntas Condicionais por Contexto

### Se for fluxo de COMPRA/PEDIDO
- Adicionar: "Tem carrinho ou é compra direta?"
- Adicionar: "Quais formas de pagamento?"
- Adicionar: "Precisa calcular frete?"
- Adicionar: "Gera nota fiscal?"

### Se for fluxo de CADASTRO
- Adicionar: "Precisa confirmar email?"
- Adicionar: "Tem termos de uso para aceitar?"
- Adicionar: "Pode usar conta de rede social?"

### Se for fluxo de APROVAÇÃO
- Adicionar: "Quem aprova?"
- Adicionar: "Tem níveis de aprovação?"
- Adicionar: "Pode rejeitar? O que acontece?"
- Adicionar: "Tem prazo para aprovar?"

### Se for fluxo de BUSCA/FILTRO
- Adicionar: "Quais filtros disponíveis?"
- Adicionar: "Pode salvar filtro favorito?"
- Adicionar: "Tem busca por texto?"
- Adicionar: "Como mostrar resultados? (lista, cards, mapa)"

### Se for fluxo de RELATÓRIO
- Adicionar: "Quais dados mostrar?"
- Adicionar: "Pode exportar? (PDF, Excel)"
- Adicionar: "Tem gráficos?"
- Adicionar: "Pode filtrar período?"
