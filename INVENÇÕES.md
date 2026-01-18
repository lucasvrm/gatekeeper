# INVENCOES

Este arquivo lista o que foi inventado por falta de especificacao direta na fase 5,
com o motivo e o local no codigo.

## Plan.json - geracao de test file

1) Regra para definir o slug do test file
- Motivo: plannerGuide define `{slug}.spec.tsx`, mas nao define como calcular o slug.
- Local: `packages/gatekeeper-api/src/elicitor/generators/PlanJsonGenerator.ts`
- Detalhes: usa `state.name` quando existe, senao `state.entity`, senao `outputId`.

## ElicitorEngine - regras de execucao

2) Geracao de outputId
- Motivo: nao ha regra especifica para o formato do outputId na camada do Elicitor.
- Local: `packages/gatekeeper-api/src/elicitor/ElicitorEngine.ts`
- Detalhes: usa `nanoid(12)`.

3) Desempate de tipo detectado
- Motivo: SYSTEM.md define palavras-chave, mas nao define prioridade para empates.
- Local: `packages/gatekeeper-api/src/elicitor/ElicitorEngine.ts`
- Detalhes: usa ordem fixa: UI_COMPONENT, API_ENDPOINT, FEATURE, AUTH, DATA, INTEGRATION.

4) Conversao simples de respostas em lista
- Motivo: nao ha regra de parse para respostas em campos array.
- Local: `packages/gatekeeper-api/src/elicitor/ElicitorEngine.ts`
- Detalhes: se o path termina com `[]`, divide por virgula.
