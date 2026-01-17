# Árvore de Perguntas: AUTH

## Quando Usar
Detectar quando a tarefa menciona:
- Acesso: login, logout, entrar, sair
- Conta: cadastro, registro, criar conta, usuário
- Credenciais: senha, password, email de login
- Segurança: autenticação, permissão, acesso, bloqueio
- Sessão: sessão, token, manter logado, lembrar-me

---

## Perguntas Organizadas por Tema

### 1. TIPO DE FLUXO (sempre perguntar)

```
1.1 Qual fluxo de autenticação você precisa?
    A) Login (usuário já tem conta)
    B) Cadastro (criar nova conta)
    C) Logout (sair do sistema)
    D) Recuperar senha (esqueceu a senha)
    E) Trocar senha (está logado e quer mudar)
    F) Verificar email (confirmar conta)
    G) Login social (Google, Facebook, etc)
    H) Autenticação em dois fatores (2FA)
    I) Múltiplos → Perguntar: "Quais?"
```

---

### 2. CREDENCIAIS / CAMPOS

#### Para LOGIN:
```
2.1 Como o usuário se identifica?
    A) Email
    B) Nome de usuário (username)
    C) CPF/CNPJ
    D) Telefone
    E) Pode ser mais de um (ex: email OU username)
    F) Não sei / tanto faz → Default: email

2.2 Tem opção "Lembrar-me" / "Manter conectado"?
    A) Sim
    B) Não
    C) Não sei / tanto faz → Default: sim
```

#### Para CADASTRO:
```
2.3 Quais informações pedir no cadastro?
    (múltipla escolha)
    
    [ ] Nome completo
    [ ] Email
    [ ] Senha
    [ ] Confirmar senha
    [ ] Telefone
    [ ] CPF/CNPJ
    [ ] Data de nascimento
    [ ] Endereço
    [ ] Foto
    [ ] Outro → Perguntar: "Qual?"
    
    → Se não souber: nome + email + senha + confirmar senha

2.4 Quais campos são obrigatórios?
    A) Todos os selecionados
    B) Apenas alguns → Perguntar: "Quais?"
    C) Não sei / tanto faz → Default: nome, email, senha

2.5 Tem termos de uso para aceitar?
    A) Sim, obrigatório
    B) Sim, opcional
    C) Não
    D) Não sei / tanto faz → Default: sim, obrigatório
```

#### Para RECUPERAR SENHA:
```
2.6 Como identificar o usuário?
    A) Por email
    B) Por telefone (SMS)
    C) Pode escolher
    D) Não sei / tanto faz → Default: email

2.7 Como é a recuperação?
    A) Envia link por email para criar nova senha
    B) Envia código temporário
    C) Pergunta de segurança
    D) Não sei / tanto faz → Default: link por email
```

---

### 3. REGRAS DE SENHA

```
3.1 Qual a força mínima da senha?
    A) Básica (mínimo 6 caracteres)
    B) Média (mínimo 8, com número)
    C) Forte (mínimo 8, número + caractere especial)
    D) Muito forte (mínimo 12, maiúscula + minúscula + número + especial)
    E) Não sei / tanto faz → Default: média

3.2 Mostrar indicador de força da senha?
    A) Sim, com barra colorida
    B) Sim, só texto (fraca/média/forte)
    C) Não
    D) Não sei / tanto faz → Default: sim, barra colorida

3.3 Opção de mostrar/esconder senha?
    A) Sim, ícone de olho
    B) Não
    C) Não sei / tanto faz → Default: sim
```

---

### 4. SEGURANÇA

```
4.1 O que fazer após várias tentativas erradas de login?
    A) Bloquear temporariamente → Perguntar: "Por quanto tempo?"
    B) Mostrar CAPTCHA
    C) Exigir verificação adicional
    D) Nada, só mostrar erro
    E) Não sei / tanto faz → Default: bloquear 15 min após 5 tentativas

4.2 [Se cadastro] Precisa verificar email antes de usar?
    A) Sim, não pode fazer nada sem verificar
    B) Sim, mas pode usar com recursos limitados
    C) Não, pode usar direto
    D) Não sei / tanto faz → Default: sim, uso limitado até verificar

4.3 [Se login social] Quais provedores?
    (múltipla escolha)
    
    [ ] Google
    [ ] Facebook
    [ ] Apple
    [ ] Microsoft
    [ ] GitHub
    [ ] LinkedIn
    [ ] Outro → Perguntar: "Qual?"
    
    → Se não souber: Google

4.4 Tem autenticação em dois fatores (2FA)?
    A) Sim, obrigatório
    B) Sim, opcional (usuário escolhe ativar)
    C) Não
    D) Não sei / tanto faz → Default: não (ou opcional se sistema sensível)
```

---

### 5. SESSÃO

```
5.1 Quanto tempo a sessão dura?
    A) Até fechar o navegador
    B) Algumas horas → Perguntar: "Quantas?"
    C) Alguns dias → Perguntar: "Quantos?"
    D) Não expira (até fazer logout)
    E) Não sei / tanto faz → Default: 24 horas, ou 30 dias se "lembrar-me"

5.2 Pode estar logado em vários dispositivos?
    A) Sim, sem limite
    B) Sim, com limite → Perguntar: "Quantos?"
    C) Não, novo login desconecta o anterior
    D) Não sei / tanto faz → Default: sim, sem limite

5.3 O que acontece quando a sessão expira?
    A) Redireciona para login
    B) Mostra mensagem e pede para logar novamente
    C) Renova automaticamente (se possível)
    D) Não sei / tanto faz → Default: mostra mensagem + redireciona
```

---

### 6. FEEDBACK E MENSAGENS

```
6.1 Mensagem de erro de login:
    A) Genérica: "Email ou senha incorretos" (mais seguro)
    B) Específica: "Email não encontrado" / "Senha incorreta"
    C) Não sei / tanto faz → Default: genérica (segurança)

6.2 [Se cadastro] Mensagem de sucesso:
    A) Simples: "Cadastro realizado!"
    B) Com próximo passo: "Verifique seu email"
    C) Já redireciona para app
    D) Não sei / tanto faz → Default: depende se requer verificação

6.3 [Se recuperar senha] Mensagens:
    A) Confirmar que email foi enviado (mesmo se não existir - segurança)
    B) Avisar se email não existe
    C) Não sei / tanto faz → Default: sempre confirmar (segurança)
```

---

### 7. REDIRECIONAMENTO

```
7.1 [Se login] Para onde vai após logar?
    A) Página inicial / Dashboard
    B) Última página que estava
    C) Página específica → Perguntar: "Qual?"
    D) Não sei / tanto faz → Default: dashboard ou página inicial

7.2 [Se logout] Para onde vai após sair?
    A) Página de login
    B) Página inicial pública
    C) Não sei / tanto faz → Default: página de login

7.3 [Se cadastro] Para onde vai após cadastrar?
    A) Página de login (precisa logar)
    B) Já loga automaticamente e vai para dashboard
    C) Página de verificação de email
    D) Não sei / tanto faz → Default: depende se requer verificação
```

---

## Fluxo de Perguntas Recomendado

```
Rodada 1 (Tipo e básico):
├── 1.1 Qual fluxo
├── 2.1 ou 2.3 (credenciais/campos)
├── 3.1 Força da senha (se aplicável)
└── 4.1 Tentativas erradas

Rodada 2 (Detalhes):
├── 5.1 Duração da sessão
├── 6.1 Mensagens de erro
├── 7.x Redirecionamentos
└── 4.2/4.3 (verificação/social se aplicável)

Rodada 3 (Refinamento):
├── 3.2/3.3 UX de senha
├── 5.2/5.3 Multi-dispositivo
└── 4.4 2FA
```

---

## Mapeamento Pergunta → Seção do taskPrompt

| Pergunta | Seção no taskPrompt |
|----------|---------------------|
| 1.x | TIPO |
| 2.x | CREDENCIAIS / CAMPOS |
| 3.x | REGRAS DE SENHA |
| 4.x | SEGURANÇA |
| 5.x | SESSÃO |
| 6.x | MENSAGENS |
| 7.x | REDIRECIONAMENTO |

---

## Templates de Fluxo por Tipo

### LOGIN
```
1. Usuário acessa página de login
2. Preenche [credencial] e senha
3. [Opcional] Marca "Lembrar-me"
4. Clica em "Entrar"
5. Sistema valida credenciais
   - Se válido: cria sessão, redireciona para [destino]
   - Se inválido: mostra erro, incrementa contador
   - Se bloqueado: mostra mensagem de bloqueio
```

### CADASTRO
```
1. Usuário acessa página de cadastro
2. Preenche [campos]
3. [Opcional] Aceita termos
4. Clica em "Cadastrar"
5. Sistema valida dados
   - Se válido: cria conta, [envia verificação], [redireciona]
   - Se inválido: mostra erros nos campos
   - Se duplicado: mostra erro "Email já cadastrado"
```

### RECUPERAR SENHA
```
1. Usuário clica em "Esqueci a senha"
2. Informa [email/telefone]
3. Clica em "Recuperar"
4. Sistema [envia link/código]
5. Mostra mensagem de confirmação
6. Usuário acessa link/informa código
7. Define nova senha
8. Sistema atualiza e redireciona para login
```

### LOGOUT
```
1. Usuário clica em "Sair"
2. Sistema invalida sessão
3. Limpa dados locais
4. Redireciona para [destino]
```

---

## Perguntas Condicionais por Contexto

### Se for aplicação FINANCEIRA/SENSÍVEL
- Adicionar: "Precisa de 2FA obrigatório?"
- Adicionar: "Notificar por email novos logins?"
- Adicionar: "Histórico de sessões ativas?"
- Adicionar: "Opção de deslogar de todos os dispositivos?"

### Se for aplicação MOBILE
- Adicionar: "Tem login por biometria (digital/face)?"
- Adicionar: "Pode usar PIN ao invés de senha completa?"
- Adicionar: "Notificações push para verificação?"

### Se for aplicação CORPORATIVA
- Adicionar: "Tem login por SSO (Single Sign-On)?"
- Adicionar: "Integra com Active Directory/LDAP?"
- Adicionar: "Tem níveis de permissão/papéis?"

### Se mencionou LOGIN SOCIAL
- Adicionar: "Pode criar conta só com social (sem senha)?"
- Adicionar: "Pode vincular conta existente ao social?"
- Adicionar: "Quais dados buscar do perfil social?"
