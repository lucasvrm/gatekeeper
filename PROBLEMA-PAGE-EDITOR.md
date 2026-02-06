# 🔴 Problema: PageEditor Continua Abrindo Embedado

## 📊 Análise Completa do Problema

### ❌ Root Cause Identificado

O PageEditor fica embedado porque **a rota `/page-editor` está DENTRO do `<AppShellWrapper>`** no App.tsx.

**Estrutura atual (App.tsx, linhas 162-192):**

```tsx
function ProtectedApp() {
  return (
    <ProtectedRoute>
      <AppShellWrapper>                        ← Wrapper com AppShell
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/config" element={<ConfigPage />} />
          <Route path="/page-editor" element={<PageEditorPage />} />  ← PROBLEMA!
          {/* ... outras rotas ... */}
        </Routes>
      </AppShellWrapper>
    </ProtectedRoute>
  )
}
```

### 🔍 Hierarquia de Componentes

Quando navegamos para `/page-editor`, a hierarquia renderizada é:

```
<AppShell>
  <div style={{ height: "100vh", overflow: "hidden" }}>     ← Layout AppShell
    <Sidebar width="260px" />
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <Header height="56px" />
      <main style={{ flex: 1, overflow: "auto" }}>          ← Área de conteúdo
        {children}                                           ← PageEditorPage vai AQUI
          <div style={{ width: "100vw", height: "100vh" }}> ← Wrapper do PageEditorPage
            <PageEditor />
          </div>
      </main>
    </div>
  </div>
</AppShell>
```

**Problema:** O `<main>` tem `flex: 1` e `overflow: auto`, então:
- O `100vh` do PageEditorPage é constrangido pelo espaço disponível
- Espaço disponível = `100vh - HeaderHeight - Padding`
- PageEditor fica **embedado** dentro da área de conteúdo

### ✅ Por Que o Edit Mode Funciona

**AppShell.tsx (linhas 638-653):**

```tsx
if (editMode) {
  return (                                    ← EARLY RETURN
    <PageEditor
      pages={baseLayout.structure.pages || {}}
      onPagesChange={(pages) => {
        updateContract({ structure: { ...baseLayout.structure, pages } });
      }}
      tokens={baseLayout.tokens}
      variables={(baseLayout as any).variables}
      onVariablesChange={(vars) => {
        console.log("Variables updated:", vars);
      }}
      onExitEditor={() => setEditMode(false)}
    />
  );
}

// ← O layout normal só renderiza se editMode === false
return (
  <div style={{ height: "100vh" }}>
    <Sidebar />
    <Header />
    <main>{children}</main>
  </div>
);
```

Quando `editMode=true`:
- AppShell faz **early return** ANTES de renderizar o layout
- PageEditor é retornado **diretamente** (sem wrappers)
- Ocupa toda a viewport (`100vh`)
- ✅ Funciona perfeitamente!

Quando `editMode=false`:
- AppShell renderiza o layout completo
- `{children}` vai dentro do `<main>`
- PageEditor fica constrangido
- ❌ Fica embedado

### 📝 Todas as Tentativas Frustradas

#### Tentativa 1: Renderizar Inline no OrquiTab ❌

**Código:**
```tsx
// orqui-tab.tsx
const [showPageEditor, setShowPageEditor] = useState(false);

if (showPageEditor) {
  return <PageEditor ... />;
}

return (
  <TabsContent>
    <Button onClick={() => setShowPageEditor(true)}>Abrir</Button>
  </TabsContent>
);
```

**Por que falhou:**
- `TabsContent` não tem altura definida
- Parent (`Tabs`) não define `height`
- PageEditor espera parent com `100vh`
- Resultado: Fica embedado no TabsContent

#### Tentativa 2: Usar Navigate('/page-editor') ❌

**Código:**
```tsx
// orqui-tab.tsx
const navigate = useNavigate();

<Button onClick={() => navigate('/page-editor')}>
  Abrir Page Editor
</Button>
```

**Por que falhou:**
- Rota `/page-editor` está DENTRO do `<AppShellWrapper>`
- AppShellWrapper renderiza `<AppShell>{children}</AppShell>`
- PageEditorPage vai como `{children}` dentro do `<main>`
- Resultado: Ainda fica embedado no layout do AppShell

#### Tentativa 3: Wrapper com 100vw x 100vh ❌

**Código:**
```tsx
// page-editor-page.tsx
export function PageEditorPage() {
  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
      <PageEditor ... />
    </div>
  );
}
```

**Por que falhou:**
- O wrapper tem `100vh` mas está DENTRO do `<main>` do AppShell
- `<main>` tem `flex: 1` e altura limitada a `100vh - headerHeight`
- `100vh` do wrapper é constrangido pelo parent
- Resultado: Fica embedado (não ocupa realmente 100vh)

### 🎯 Comparação: Login vs Page Editor

**Login funciona porque está FORA do AppShell:**

```tsx
// App.tsx
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rotas públicas SEM AppShell */}
        <Route path="/login" element={<LoginPage />} />        ← SEM wrapper
        <Route path="/register" element={<RegisterPage />} />  ← SEM wrapper

        {/* Rotas protegidas COM AppShell */}
        <Route path="/*" element={<ProtectedApp />} />         ← COM AppShellWrapper
      </Routes>
    </BrowserRouter>
  )
}
```

**Page Editor NÃO funciona porque está DENTRO:**

```tsx
function ProtectedApp() {
  return (
    <AppShellWrapper>                     ← Wrapper problemático
      <Routes>
        <Route path="/page-editor" element={<PageEditorPage />} />  ← Embedado!
      </Routes>
    </AppShellWrapper>
  )
}
```

## 🔧 Soluções Possíveis

### ✅ Solução 1: Mover Rota para Fora do AppShellWrapper (RECOMENDADA)

**Vantagens:**
- Simples e elegante
- Segue o padrão existente (login/register)
- Zero overhead de performance
- Código limpo

**Desvantagens:**
- PageEditor perde acesso à navegação (sidebar)
- Precisa botão "Voltar" próprio (já tem!)

**Implementação:**

```tsx
// App.tsx
function App() {
  return (
    <ContractProvider layout={layoutContract} registry={registryContract}>
      <BrowserRouter>
        <AuthProvider>
          <PageShellProvider>
            <Routes>
              {/* Rotas públicas */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Rota fullscreen (nova) */}
              <Route path="/page-editor" element={<PageEditorPage />} />

              {/* Rotas protegidas com AppShell */}
              <Route path="/*" element={<ProtectedApp />} />
            </Routes>
          </PageShellProvider>
        </AuthProvider>
      </BrowserRouter>
    </ContractProvider>
  )
}

function ProtectedApp() {
  return (
    <ProtectedRoute>
      <AppShellWrapper>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/config" element={<ConfigPage />} />
          {/* /page-editor REMOVIDO daqui */}
          {/* ... outras rotas ... */}
        </Routes>
      </AppShellWrapper>
    </ProtectedRoute>
  )
}
```

### ⚠️ Solução 2: Usar createPortal

**Vantagens:**
- Mantém rota dentro do AppShell
- Pode preservar contexto

**Desvantagens:**
- Complexo
- Requer gerenciamento de portal root
- Pode ter race conditions
- Overhead de performance

**Implementação:**

```tsx
// page-editor-page.tsx
import { createPortal } from "react-dom";

export function PageEditorPage() {
  const portalRoot = document.body;

  return createPortal(
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 9999,
      background: "var(--background)"
    }}>
      <PageEditor ... />
    </div>,
    portalRoot
  );
}
```

### ⚠️ Solução 3: Dialog Overlay

**Vantagens:**
- Componente Radix UI pronto
- Acessibilidade built-in

**Desvantagens:**
- Overkill para um editor fullscreen
- Comportamento de modal (ESC fecha)
- Overlay escurece o fundo

**Implementação:**

```tsx
// orqui-tab.tsx
import { Dialog, DialogContent } from "@/components/ui/dialog";

<Dialog open={showPageEditor} onOpenChange={setShowPageEditor}>
  <DialogContent className="max-w-full h-screen p-0">
    <PageEditor ... />
  </DialogContent>
</Dialog>
```

## 🏆 Recomendação Final

**Use Solução 1: Mover rota para fora do AppShellWrapper**

Motivos:
1. ✅ **Simples** - Apenas mover uma linha de código
2. ✅ **Consistente** - Mesmo padrão de login/register
3. ✅ **Performático** - Zero overhead
4. ✅ **Limpo** - Sem hacks ou workarounds
5. ✅ **Funciona** - Garantido!

A única "desvantagem" (perder sidebar) não é relevante porque:
- PageEditor já tem botão "Voltar" próprio
- É um editor fullscreen (não precisa de navegação)
- Usuários querem foco total no editor

## 🎯 Resumo Executivo

**Problema:**
- `/page-editor` está DENTRO do `<AppShellWrapper>`
- AppShell renderiza layout com sidebar + header
- PageEditor fica embedado na área de conteúdo (`<main>`)

**Tentativas que falharam:**
1. Renderizar inline no OrquiTab → Embedado no TabsContent
2. Navigate para /page-editor → Embedado no AppShell main
3. Wrapper 100vh → Constrangido pelo parent flex

**Solução:**
- Mover `/page-editor` para fora do AppShellWrapper
- Mesma abordagem que `/login` e `/register`
- Renderiza diretamente sem layout wrapper
- ✅ Fullscreen garantido!

---

**Última atualização:** 2026-02-06
