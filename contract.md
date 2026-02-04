# contract_artifact-viewer-buttons-provider-defaults.md (v1.0)

---

## Identidade
- **schemaVersion**: 1.0
- **slug**: artifact-viewer-buttons-provider-defaults
- **title**: Botões Copy/Save/Save All no ArtifactViewer + Provider Default + Labels
- **mode**: STRICT
- **changeType**: modify
- **criticality**: medium

---

## Escopo
### O que está incluído
- Adicionar 3 botões (Copy 📋, Save 💾, Save All 📦) na barra de tabs do `ArtifactViewer`
- Implementar handlers para copiar conteúdo, baixar arquivo individual e baixar ZIP de todos artefatos
- Alterar default do `ProviderEnum` no backend de `'anthropic'` para `'claude-code'`
- Atualizar labels de providers CLI na UI: "Claude Code CLI" e "Codex CLI"
- Adicionar dependência `jszip` ao package.json

### Não-objetivos
- Não modificar comportamento de seleção de tabs existente
- Não adicionar outras dependências além de jszip
- Não refatorar estrutura do componente ou extrair para arquivo separado
- Não alterar schema backend além do campo `.default()`
- Não modificar validação ou lógica de criação de runs

---

## Cláusulas (clause = test)

### Convenções
- Formato do ID: `CL-<DOMINIO>-<NNN>`
- `kind`: behavior | error | invariant | ui
- `normativity`: MUST | SHOULD
- `spec`: sempre em termos observáveis (evitar detalhes internos)

### Lista de cláusulas

1) **[CL-UI-001] (behavior, MUST)** — Copy button copies artifact content to clipboard
   - **spec**: Quando usuário clica no botão Copy (📋), então `navigator.clipboard.writeText()` é chamado com o conteúdo do artefato atualmente selecionado e toast de sucesso "Copiado!" é exibido.
   - Observáveis esperados:
     - `navigator.clipboard.writeText(artifacts[selected].content)` chamado exatamente 1 vez
     - `toast.success("Copiado!")` chamado exatamente 1 vez
     - UI permanece inalterada (sem refresh ou re-render de conteúdo)

2) **[CL-UI-002] (behavior, MUST)** — Save button downloads artifact as file
   - **spec**: Quando usuário clica no botão Save (💾), então um Blob é criado com o conteúdo do artefato selecionado, um link de download é criado com o filename correto, o download é iniciado e recursos são limpos (link removido, URL revogado).
   - Observáveis esperados:
     - `new Blob([artifacts[selected].content], { type: "text/plain;charset=utf-8" })` criado
     - `URL.createObjectURL(blob)` retorna URL temporário
     - `<a>` element criado com `href=<blob-url>`, `download=<filename>`
     - Link é adicionado ao DOM, clicado e removido
     - `URL.revokeObjectURL(<blob-url>)` chamado para cleanup

3) **[CL-UI-003] (behavior, MUST)** — Save All button downloads all artifacts as ZIP
   - **spec**: Quando usuário clica no botão Save All (📦), então JSZip é importado dinamicamente, um arquivo ZIP é criado contendo todos os artefatos, o download é iniciado com filename `artifacts-{timestamp}.zip` e toast de sucesso mostra quantidade de arquivos baixados.
   - Observáveis esperados:
     - `import("jszip")` é chamado (dynamic import)
     - `zip.file(artifact.filename, artifact.content)` chamado para cada artefato
     - `zip.generateAsync({ type: "blob" })` retorna blob do ZIP
     - Link de download criado com `download="artifacts-{timestamp}.zip"`
     - `toast.success("{N} arquivo(s) baixado(s)")` onde N = quantidade de artefatos

4) **[CL-UI-004] (error, MUST)** — Copy button shows error toast when clipboard fails
   - **spec**: Quando usuário clica no botão Copy e `navigator.clipboard.writeText()` rejeita com erro (ex.: permissão negada, API não disponível), então toast de erro "Falha ao copiar" é exibido e toast de sucesso NÃO é exibido.
   - Observáveis esperados:
     - `navigator.clipboard.writeText()` rejeita (Promise reject)
     - `toast.error("Falha ao copiar")` chamado exatamente 1 vez
     - `toast.success()` não chamado
     - Sem crash ou estado inconsistente
   - **negativeCases**:
     - Clipboard permission negada pelo browser
     - Clipboard API não disponível (ex.: HTTP context)
     - Erro genérico ao escrever no clipboard

5) **[CL-UI-005] (error, SHOULD)** — Save All button shows error toast when ZIP generation fails
   - **spec**: Quando usuário clica no botão Save All e JSZip falha ao gerar o arquivo ZIP (ex.: erro de memória, conteúdo inválido), então toast de erro "Falha ao criar ZIP" é exibido.
   - Observáveis esperados:
     - `zip.generateAsync()` rejeita ou JSZip import falha
     - `toast.error("Falha ao criar ZIP")` chamado
     - `toast.success()` não chamado
     - Sem crash

6) **[CL-UI-006] (behavior, MUST)** — Copy/Save buttons use currently selected tab
   - **spec**: Quando usuário seleciona uma tab diferente e depois clica em Copy ou Save, então a operação deve agir sobre o artefato da tab atualmente selecionada (índice `selected`), não sobre um índice fixo.
   - Observáveis esperados:
     - Após trocar para tab índice `i`, `handleCopy` copia `artifacts[i].content`
     - Após trocar para tab índice `i`, `handleSave` baixa arquivo com `artifacts[i].filename`
     - Múltiplas trocas de tab seguidas pela ação refletem sempre a última seleção

7) **[CL-BACKEND-001] (behavior, MUST)** — ProviderEnum default is claude-code
   - **spec**: Quando backend valida um request para `CreatePhaseConfigSchema` sem campo `provider` explícito, então o schema Zod aplica default `"claude-code"` (ao invés de `"anthropic"`).
   - Observáveis esperados:
     - Input sem `provider`: `{ step: 1, model: "sonnet", ... }` → Output validado: `{ step: 1, provider: "claude-code", model: "sonnet", ... }`
     - Input com `provider` explícito não é sobrescrito pelo default

8) **[CL-UI-007] (behavior, MUST)** — Provider labels updated to CLI terminology
   - **spec**: Quando usuário visualiza o dropdown de seleção de provider no step 0 do Orchestrator, então os labels exibidos para `claude-code` e `codex-cli` devem ser "Claude Code CLI" e "Codex CLI" (sem menção a "Max/Pro" ou "OpenAI").
   - Observáveis esperados:
     - `PROVIDER_MODELS["claude-code"].label === "Claude Code CLI"`
     - `PROVIDER_MODELS["codex-cli"].label === "Codex CLI"`
     - Dropdown renderiza labels corretos

9) **[CL-INV-001] (invariant, MUST)** — ArtifactViewer returns null when no artifacts
   - **spec**: Quando `ArtifactViewer` recebe `artifacts.length === 0`, então componente retorna `null` e não renderiza nenhum botão ou tab.
   - Observáveis esperados:
     - `container.firstChild === null`
     - `screen.queryByTestId("artifact-copy-btn")` não está no documento
     - `screen.queryByTestId("artifact-save-btn")` não está no documento
     - `screen.queryByTestId("artifact-save-all-btn")` não está no documento

10) **[CL-INV-002] (invariant, MUST)** — Tab selection behavior unchanged
   - **spec**: Quando usuário clica em uma tab, então comportamento de seleção (CSS classes, conteúdo exibido) permanece idêntico ao comportamento anterior — apenas botões foram adicionados, não houve mudança na lógica de tabs.
   - Observáveis esperados:
     - Tab selecionada tem classes `bg-card`, `text-foreground`, `border-b-2`, `border-primary`
     - Tab não-selecionada tem classe `text-muted-foreground` e NÃO tem `bg-card`
     - `<pre>` exibe `artifacts[selected].content`
     - Trocar tab atualiza conteúdo exibido no `<pre>`

11) **[CL-INV-003] (invariant, MUST)** — Backend schema exports unchanged
   - **spec**: Quando módulo `agent.schema.ts` é importado, então exports (`CreatePhaseConfigInput`, `ProviderEnum`, etc.) permanecem idênticos em tipo e estrutura — apenas valor default interno de `ProviderEnum.default()` mudou.
   - Observáveis esperados:
     - TypeScript types de exports não mudam
     - Consumers do schema continuam compilando sem erros

12) **[CL-INV-004] (invariant, MUST)** — JSZip dependency added
   - **spec**: Quando `package.json` é lido, então deve existir entrada `"jszip": "^3.10.1"` em `dependencies`.
   - Observáveis esperados:
     - `dependencies["jszip"]` definido
     - `npm install` ou `npm ci` instala jszip sem erros

---

## Assertion Surface (o que os testes podem assertar)

### Browser APIs permitidos
- `navigator.clipboard.writeText(content)` - para Copy
- `URL.createObjectURL(blob)` - para Save/Save All
- `URL.revokeObjectURL(url)` - cleanup
- `document.body.appendChild(node)` - para adicionar link temporário
- `document.body.removeChild(node)` - para remover link temporário
- `element.click()` - para disparar download

### Toast calls permitidos
- `toast.success("Copiado!")`
- `toast.error("Falha ao copiar")`
- `toast.success("{N} arquivo(s) baixado(s)")`
- `toast.error("Falha ao criar ZIP")`

### JSZip API permitido
- `import("jszip")` - dynamic import
- `new JSZip()`
- `zip.file(filename, content)`
- `zip.generateAsync({ type: "blob" })`

### DOM assertions permitidos
- `screen.getByTestId("artifact-copy-btn")`
- `screen.getByTestId("artifact-save-btn")`
- `screen.getByTestId("artifact-save-all-btn")`
- `screen.getByTestId("artifact-tab-{i}")`
- `element.toHaveClass("bg-card")`, `element.toHaveClass("border-primary")`, etc.
- `screen.getByText(artifacts[i].content)` - verificar conteúdo exibido

### Schema validation (backend)
- Input para `CreatePhaseConfigSchema.parse()` com/sem campo `provider`
- Output validado contém `provider: "claude-code"` quando omitido

### Matchers policy
- Snapshots: proibidos (sem necessidade neste caso)
- Weak matchers (`toBeDefined`, etc.): proibidos como única verificação
- Strings exatas de mensagens toast: permitidas (são parte do contrato de UI)

---

## Assertion Surface (estruturado)

```json
{
  "ui": {
    "routes": [],
    "testIds": [
      "artifact-copy-btn",
      "artifact-save-btn",
      "artifact-save-all-btn",
      "artifact-tab-0",
      "artifact-tab-1",
      "artifact-tab-2"
    ],
    "roles": [],
    "ariaLabels": []
  },
  "api": {
    "endpoints": [],
    "statusCodes": [],
    "errorCodes": []
  },
  "effects": [
    "navigator.clipboard.writeText",
    "URL.createObjectURL",
    "URL.revokeObjectURL",
    "document.body.appendChild",
    "document.body.removeChild",
    "element.click",
    "toast.success('Copiado!')",
    "toast.error('Falha ao copiar')",
    "toast.success('{N} arquivo(s) baixado(s)')",
    "toast.error('Falha ao criar ZIP')",
    "import('jszip')",
    "new JSZip()",
    "zip.file(filename, content)",
    "zip.generateAsync({ type: 'blob' })"
  ]
}
```

---

## Test Mapping (rastreabilidade)

### Regra padrão
Cada `it/test` deve ter um comentário imediatamente acima:

```ts
// @clause CL-UI-001
it("succeeds when user clicks copy button with valid artifact", () => { ... })
```

- allowMultiple: um teste pode listar múltiplas cláusulas
- allowUntagged: em STRICT, deve ser **false** — todos os testes devem ter tag

### Exemplo de estrutura de teste

```ts
describe("CL-UI-001: Copy button copies artifact content to clipboard", () => {
  // @clause CL-UI-001
  it("CL-UI-001: succeeds when user clicks copy button with valid artifact", async () => {
    // ... test implementation
  })

  // @clause CL-UI-001
  it("CL-UI-001: succeeds when copy button is clicked multiple times", async () => {
    // ... test implementation
  })

  // @clause CL-UI-001
  it("CL-UI-001: succeeds when copying artifact with special characters", async () => {
    // ... test implementation
  })
})
```

---

## Checklist final
- [x] Todas as cláusulas têm `id` único (CL-UI-001 a CL-UI-007, CL-BACKEND-001, CL-INV-001 a CL-INV-004)
- [x] Todas as cláusulas MUST são testáveis por observáveis
- [x] error MUST (CL-UI-004) contém `negativeCases` (>= 1)
- [x] Assertion Surface lista tudo que os testes irão assertar (browser APIs, toast, JSZip, DOM, schema)
- [x] Test Mapping define padrão `// @clause ...` obrigatório (STRICT mode)
- [x] Sem DELETE de arquivos — integridade de importadores não aplicável
- [x] Invariantes cobrem: null component, tab behavior, backend exports, jszip dep
