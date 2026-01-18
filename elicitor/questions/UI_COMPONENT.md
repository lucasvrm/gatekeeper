# Árvore de Perguntas: UI_COMPONENT

## Quando Usar
Detectar quando a tarefa menciona:
- Elementos visuais: botão, campo, input, formulário, modal, popup
- Exibição de dados: lista, card, badge, tabela, grid
- Interação: tooltip, dropdown, select, checkbox, toggle, tab
- Estrutura: menu, sidebar, header, footer
- Mídia: ícone, imagem, avatar

---

## Perguntas Organizadas por Tema

### 1. IDENTIFICAÇÃO (sempre perguntar)

```
1.1 Como você chamaria esse elemento em uma conversa?
    (resposta livre - usado para nomear o componente)
    
    Exemplo: "botão de copiar", "card de lead", "modal de confirmação"
```

---

### 2. APARÊNCIA

```
2.1 O componente tem variações visuais diferentes?
    (ex: botão primário vs secundário, card grande vs pequeno)
    
    A) Sim → Perguntar: "Quais variações?"
    B) Não, sempre igual
    C) Não sei / tanto faz → Default: sem variações

2.2 O componente mostra algum texto?
    A) Sim, texto fixo → Perguntar: "Qual texto?"
    B) Sim, texto dinâmico (vem de dados)
    C) Não, só ícone/imagem
    D) Não sei / tanto faz → Default: conforme contexto

2.3 O componente tem ícone?
    A) Sim, sempre o mesmo → Perguntar: "Qual ícone? (descreva)"
    B) Sim, muda conforme estado
    C) Não
    D) Não sei / tanto faz → Default: sem ícone
```

---

### 3. ESTADOS VISUAIS

```
3.1 Quando passar o mouse por cima, deve mudar algo?
    A) Sim, fica destacado/diferente
    B) Sim, mostra tooltip/dica → Perguntar: "Qual texto da dica?"
    C) Não muda nada
    D) Não sei / tanto faz → Default: destaque sutil no hover

3.2 O componente pode ficar desabilitado (não clicável)?
    A) Sim → Perguntar: "Em qual situação?"
    B) Não, sempre ativo
    C) Não sei / tanto faz → Default: sim, quando sem dados necessários

3.3 O componente tem estado de "carregando"?
    A) Sim, a ação demora um pouco
    B) Não, é instantâneo
    C) Não sei / tanto faz → Default: depende se há chamada ao servidor

3.4 O componente pode mostrar erro?
    A) Sim, erro inline (no próprio componente)
    B) Sim, erro em mensagem separada (toast/alert)
    C) Não precisa mostrar erro
    D) Não sei / tanto faz → Default: erro em mensagem separada

3.5 O componente pode mostrar sucesso?
    A) Sim, muda visualmente (cor, ícone)
    B) Sim, mostra mensagem
    C) Os dois (visual + mensagem)
    D) Não precisa
    E) Não sei / tanto faz → Default: feedback visual sutil
```

---

### 4. COMPORTAMENTO / INTERAÇÃO

```
4.1 O que acontece quando clica?
    A) Executa uma ação → Perguntar: "Qual ação?"
    B) Abre algo (modal, menu, etc) → Perguntar: "O que abre?"
    C) Navega para outra página → Perguntar: "Para onde?"
    D) Seleciona/marca algo
    E) Não é clicável
    F) Não sei / tanto faz → Perguntar: "Qual é o objetivo do componente?"

4.2 Pode clicar várias vezes seguidas?
    A) Sim, cada clique faz a ação
    B) Não, deve esperar terminar
    C) Não sei / tanto faz → Default: aguardar terminar (debounce)

4.3 Precisa de confirmação antes de executar?
    (ex: "Tem certeza que deseja excluir?")
    
    A) Sim → Perguntar: "Qual a pergunta de confirmação?"
    B) Não, executa direto
    C) Não sei / tanto faz → Default: sem confirmação (exceto ações destrutivas)
```

---

### 5. DADOS / PROPS

```
5.1 Quais informações o componente precisa receber?
    (resposta livre - ex: "o nome do lead", "o ID", "se está ativo")
    
    → Se não souber: assumir baseado no contexto da tarefa

5.2 O componente precisa avisar quando algo acontece?
    (ex: avisar a página pai que foi clicado)
    
    A) Sim → Perguntar: "Avisar sobre o quê?"
    B) Não, só faz ação interna
    C) Não sei / tanto faz → Default: sim, eventos principais
```

---

### 6. FEEDBACK

```
6.1 Quando a ação funcionar, como o usuário sabe?
    A) Mensagem aparece (tipo "Salvo!")
    B) Algo visual muda (cor, ícone)
    C) Os dois
    D) Vai para outra página/tela
    E) Nada, só funciona silenciosamente
    F) Não sei / tanto faz → Default: mensagem de sucesso

6.2 Quando der erro, como mostrar?
    A) Mensagem de erro com explicação
    B) Só destaque vermelho
    C) Os dois
    D) Não sei / tanto faz → Default: mensagem de erro clara

6.3 [Se tiver loading] O que mostrar enquanto carrega?
    A) Spinner/animação de loading
    B) Texto "Carregando..."
    C) Desabilita e mostra que está processando
    D) Não sei / tanto faz → Default: spinner
```

---

### 7. ACESSIBILIDADE

```
7.1 O componente precisa funcionar só com teclado?
    (importante para pessoas que não usam mouse)
    
    A) Sim
    B) Não é necessário
    C) Não sei / tanto faz → Default: SIM (sempre assumir)

7.2 Precisa de descrição para leitores de tela?
    (usado por pessoas com deficiência visual)
    
    A) Sim → Perguntar: "Como descreveria a função em uma frase?"
    B) O texto visível já é suficiente
    C) Não sei / tanto faz → Default: sim, gerar descrição automática
```

---

### 8. EDGE CASES

```
8.1 O que fazer se não tiver dados para mostrar?
    A) Esconde o componente
    B) Mostra desabilitado
    C) Mostra mensagem tipo "Nenhum dado"
    D) Não sei / tanto faz → Default: desabilitar ou esconder

8.2 O que fazer se o texto for muito longo?
    A) Corta com "..."
    B) Quebra em várias linhas
    C) Deixa estourar (não limita)
    D) Não sei / tanto faz → Default: corta com "..."

8.3 Tem alguma situação especial que preciso saber?
    (resposta livre - captura edge cases específicos do domínio)
```

---

## Fluxo de Perguntas Recomendado

```
Rodada 1 (Essenciais):
├── 1.1 Nome/identificação
├── 4.1 O que acontece ao clicar
├── 6.1 Feedback de sucesso
├── 6.2 Feedback de erro
└── 3.2 Pode ficar desabilitado

Rodada 2 (Se necessário):
├── 3.1 Comportamento no hover
├── 3.3 Estado de loading
├── 5.1 Dados necessários
└── 2.1 Variações visuais

Rodada 3 (Refinamento):
├── 7.1 Acessibilidade teclado
├── 8.1 Sem dados
└── 8.3 Casos especiais
```

---

## Mapeamento Pergunta → Seção do taskPrompt

| Pergunta | Seção no taskPrompt |
|----------|---------------------|
| 1.1 | NOME |
| 2.x | ESTADOS (visual) |
| 3.x | ESTADOS |
| 4.x | COMPORTAMENTO |
| 5.x | PROPS |
| 6.x | COMPORTAMENTO (feedback) |
| 7.x | ACESSIBILIDADE |
| 8.x | EDGE CASES |

---

## Perguntas Condicionais

### Se for BOTÃO
- Adicionar: "O botão tem texto, ícone ou os dois?"
- Adicionar: "É a ação principal da tela?"

### Se for INPUT/CAMPO
- Adicionar: "Qual tipo de dado? (texto, número, data, email...)"
- Adicionar: "É obrigatório?"
- Adicionar: "Tem máscara? (ex: telefone, CPF)"
- Adicionar: "Quando validar? (ao digitar, ao sair do campo, ao enviar)"

### Se for MODAL
- Adicionar: "Pode fechar clicando fora?"
- Adicionar: "Pode fechar com tecla Esc?"
- Adicionar: "Tem botões de ação? Quais?"

### Se for LISTA/TABELA
- Adicionar: "Pode ordenar?"
- Adicionar: "Pode filtrar?"
- Adicionar: "Tem paginação?"
- Adicionar: "O que acontece ao clicar em um item?"

### Se for FORMULÁRIO
- Adicionar: "Quais campos tem?"
- Adicionar: "Quais são obrigatórios?"
- Adicionar: "O que acontece ao enviar?"
- Adicionar: "Pode cancelar?"
