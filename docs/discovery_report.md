# Discovery Report

**Task**: Remover título e subtítulo redundantes "Descreva a Tarefa / Descreva o que precisa ser implementado..." do card de tarefa na rota /orchestrator
**Generated**: 2026-02-07
**Output ID**: 2026_02_07_414_retirar-ttulo-e-subttulo-descreva-a-tare

---

## 1. Resumo Executivo

A tarefa é simples: remover o `CardHeader` redundante do card de descrição de tarefa no Step 0 do orquestrador. O card já possui uma `Label` com texto "Descrição da tarefa" que é suficiente para indicar o propósito do campo.

A remoção impacta **4 testes** que usam o texto "Descreva a Tarefa" como indicador de que a página carregou. Esses testes precisarão ser atualizados para usar outro elemento (ex: a Label "Descrição da tarefa").

---

## 2. Arquivos Relevantes

### 2.1 orchestrator-page.tsx (Principal)
**Path**: `src/components/orchestrator-page.tsx`
**Relevância**: Arquivo principal contendo o card com título/subtítulo redundantes
**Evidência**:
```tsx
// linhas 2187-2193
<Card>
  <CardHeader>
    <CardTitle>Descreva a Tarefa</CardTitle>
    <CardDescription>
      Descreva o que precisa ser implementado. O LLM vai gerar o plano, contrato e especificação.
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="task-description-textarea">Descrição da tarefa</Label>
      <Textarea
        id="task-description-textarea"
        value={taskDescription}
```

**Observação**: A Label "Descrição da tarefa" já explica o propósito do campo. O CardHeader é redundante.

### 2.2 orchestrator-page.spec.tsx (Testes)
**Path**: `src/components/orchestrator-page.spec.tsx`
**Relevância**: 4 testes usam "Descreva a Tarefa" como seletor
**Evidência**:
```tsx
// linhas 400-402 (padrão repetido em 4 lugares)
await waitFor(() => {
  expect(screen.getByText("Descreva a Tarefa")).toBeInTheDocument()
})
```

**Linhas afetadas**: 401, 426, 586, 775

---

## 3. Dependências e Imports

**Componentes UI usados** (de `@/components/ui`):
- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`
- `Label`
- `Textarea`

Após a remoção, os imports `CardHeader`, `CardTitle`, `CardDescription` continuarão sendo usados em outros lugares do arquivo, então não devem ser removidos do import.

---

## 4. Padrões e Convenções

**Estrutura de Cards no projeto**:
- Cards com formulários geralmente usam `Label` diretamente dentro de `CardContent`
- `CardHeader` é usado para seções que precisam de título destacado
- Neste caso específico, o Label já cumpre a função de identificar o campo

**Testes**:
- Usam `waitFor` + `getByText` para aguardar elementos aparecerem
- Podem usar `getByLabelText` para campos com Label associada

---

## 5. Estado Atual vs. Desejado

**Atual**:
```tsx
<Card>
  <CardHeader>
    <CardTitle>Descreva a Tarefa</CardTitle>
    <CardDescription>
      Descreva o que precisa ser implementado. O LLM vai gerar o plano, contrato e especificação.
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="task-description-textarea">Descrição da tarefa</Label>
      ...
```

**Desejado**:
```tsx
<Card>
  <CardContent className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="task-description-textarea">Descrição da tarefa</Label>
      ...
```

**Gap**:
1. Remover `<CardHeader>` com `<CardTitle>` e `<CardDescription>` (linhas 2188-2193)
2. Atualizar 4 testes para usar seletor alternativo

---

## 6. Riscos e Trade-offs

**Riscos identificados**:
- **Baixo**: Testes falharão até serem atualizados

**Trade-offs**:
- **Opção A**: Usar `getByLabelText("Descrição da tarefa")` nos testes - mais semântico
- **Opção B**: Usar `getByRole("textbox", { name: /descrição/i })` - mais robusto
- **Recomendação**: Opção A (mais simples e direta)

---

## 7. Descartados

**Abordagens consideradas mas descartadas**:
- Manter apenas `CardTitle` sem `CardDescription`: ainda redundante com Label
- Mudar texto da Label: alteraria acessibilidade sem necessidade

---

## 8. Recomendações para o Planner

1. **Microplan único** com 2 arquivos:
   - Remover CardHeader em `orchestrator-page.tsx` (linhas 2188-2193)
   - Atualizar 4 assertions em `orchestrator-page.spec.tsx` (linhas 401, 426, 586, 775)

2. **Seletor sugerido para testes**: `screen.getByLabelText("Descrição da tarefa")`

3. **Validar**: `npm run typecheck` + `npm test` após alterações

---

## Metadata

- **Arquivos lidos**: 2
- **Arquivos relevantes**: 2
- **Iterações usadas**: 6/30
