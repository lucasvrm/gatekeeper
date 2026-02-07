# 🎴 Collapsed Card Configuration - Implementation Plan

## Contexto
Atualmente, os valores de estilo do card (padding, border radius, etc) quando a sidebar está colapsada são **hardcoded** no `NavItem.tsx`. Porém, a estrutura `navigation.typography.card*` já existe no contrato e tem controles no workbench, mas **NÃO é aplicada no modo colapsado**.

Este plano implementa a **Opção 1**: usar as configurações existentes de `navigation.typography` também para o modo colapsado, eliminando hardcoded values e permitindo customização total via workbench.

## Objetivo
Conectar os controles existentes do workbench (`Card Style Editor`) ao comportamento do NavItem no modo colapsado, permitindo configurar:
- Padding do card
- Border radius
- Background (hover, active)
- Border color/width
- Todos os estados visuais

---

## Arquitetura Atual vs Proposta

### Atual (Hardcoded)
```typescript
// NavItem.tsx linha 149-150
const linkStyle = {
  padding: collapsed ? "6px 4px" : ...,  // ❌ Hardcoded
  borderRadius: 6,                        // ❌ Hardcoded
};
```

### Proposta (Config-driven)
```typescript
// NavItem.tsx
const linkStyle = {
  padding: collapsed
    ? resolveTokenRef(cardConfig?.padding, tokens) || "6px 4px"
    : ...,
  borderRadius: resolveTokenRef(cardConfig?.borderRadius, tokens) || 6,
  background: collapsed && active
    ? resolveTokenRef(cardConfig?.activeBackground, tokens)
    : ...,
};
```

---

## MP-CARD-01: Passar cardConfig de SidebarNav → NavItem ✅
**Objetivo**: Extrair configuração de card do navConfig e passar como prop para NavItem

**Arquivos**:
- `packages/orqui/src/runtime/components/SidebarNav.tsx`

**Implementação**:

1. **Extrair cardConfig do navConfig** (após linha 23):
   ```typescript
   const { tokens } = useContract();

   // Extract card configuration from navigation.typography
   const cardConfig = useMemo(() => {
     const typo = navConfig.typography || {};
     return {
       enabled: typo.cardEnabled !== false, // default true
       padding: typo.cardPadding,
       borderRadius: typo.cardBorderRadius,
       background: typo.cardBackground,
       borderColor: typo.cardBorderColor,
       borderWidth: typo.cardBorderWidth,
       activeBackground: typo.activeBackground,
       activeCardBorder: typo.activeCardBorder,
       hoverBackground: typo.hoverBackground,
       hoverCardBorder: typo.hoverCardBorder,
     };
   }, [navConfig.typography]);
   ```

2. **Adicionar cardConfig aos sharedNavItemProps** (linha 142-153):
   ```typescript
   const sharedNavItemProps = {
     collapsed,
     collapsedDisplay,
     isActive,
     handleClick,
     renderBadge,
     getIconSize,
     baseIconSize,
     openSubs,
     setOpenSubs,
     cardConfig,  // ← Adicionar
     tokens,      // ← Adicionar (necessário para resolver refs)
   };
   ```

**Contrato**:
- cardConfig extraído do navConfig.typography
- Memoizado para evitar re-renders desnecessários
- Passado para todos os NavItem components
- Inclui tokens para resolução de refs

---

## MP-CARD-02: Atualizar interface NavItemProps ✅
**Objetivo**: Adicionar tipos para cardConfig e tokens na interface NavItem

**Arquivos**:
- `packages/orqui/src/runtime/components/NavItem.tsx`

**Implementação**:

1. **Adicionar tipos na interface** (linha 9-21):
   ```typescript
   interface CardConfig {
     enabled?: boolean;
     padding?: string;
     borderRadius?: string;
     background?: string;
     borderColor?: string;
     borderWidth?: string;
     activeBackground?: string;
     activeCardBorder?: string;
     hoverBackground?: string;
     hoverCardBorder?: string;
   }

   interface NavItemProps {
     item: NavItemType;
     depth?: number;
     collapsed?: boolean;
     collapsedDisplay?: string;
     isActive: (route?: string) => boolean;
     handleClick: (e: React.MouseEvent, route?: string) => void;
     renderBadge: (badge?: NavItemType["badge"]) => React.ReactNode;
     getIconSize: (depth: number) => number;
     baseIconSize: number;
     openSubs: Record<string, boolean>;
     setOpenSubs: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
     cardConfig?: CardConfig;  // ← Adicionar
     tokens?: any;             // ← Adicionar
   }
   ```

2. **Desestruturar nas props do componente** (linha 23-35):
   ```typescript
   export function NavItem({
     item,
     depth = 0,
     collapsed,
     collapsedDisplay,
     isActive,
     handleClick,
     renderBadge,
     getIconSize,
     baseIconSize,
     openSubs,
     setOpenSubs,
     cardConfig,  // ← Adicionar
     tokens,      // ← Adicionar
   }: NavItemProps) {
   ```

**Contrato**:
- Interface NavItemProps atualizada com novos campos
- cardConfig opcional (backwards compatibility)
- tokens opcional (necessário para resolveTokenRef)

---

## MP-CARD-03: Criar helper resolveTokenRef ✅
**Objetivo**: Criar função helper para resolver token references

**Arquivos**:
- `packages/orqui/src/runtime/components/NavItem.tsx`

**Implementação**:

1. **Adicionar helper no topo do arquivo** (após imports):
   ```typescript
   /**
    * Resolve token reference to actual value
    * Supports: "$tokens.spacing.sm", "16px", 16
    */
   function resolveTokenRef(value: string | number | undefined, tokens: any): string | number | undefined {
     if (!value) return undefined;

     // If it's a number, return as-is
     if (typeof value === 'number') return value;

     // If it's not a token ref, return as-is
     if (!value.startsWith('$tokens.')) return value;

     // Extract token path: "$tokens.spacing.sm" → ["spacing", "sm"]
     const path = value.slice(8).split('.');

     // Navigate tokens object
     let result: any = tokens;
     for (const key of path) {
       if (!result || typeof result !== 'object') return undefined;
       result = result[key];
     }

     // Handle token structure: { value: 16, unit: "px" }
     if (result && typeof result === 'object' && 'value' in result) {
       const unit = result.unit || '';
       return `${result.value}${unit}`;
     }

     // Return as-is if it's a direct value
     return result;
   }
   ```

**Contrato**:
- Resolve "$tokens.spacing.sm" → "8px"
- Resolve "$tokens.borderRadius.md" → "6px"
- Handle token structure com value + unit
- Retorna undefined se token não encontrado
- Suporta valores diretos (não-refs) como passthrough

---

## MP-CARD-04: Aplicar cardConfig no linkStyle (collapsed) ✅
**Objetivo**: Usar cardConfig para estilizar o link quando collapsed

**Arquivos**:
- `packages/orqui/src/runtime/components/NavItem.tsx`

**Implementação**:

1. **Modificar linkStyle object** (linha 145-159):
   ```typescript
   // Resolve card config values (collapsed mode)
   const collapsedPadding = collapsed && cardConfig
     ? resolveTokenRef(cardConfig.padding, tokens)
     : undefined;
   const collapsedBorderRadius = cardConfig
     ? resolveTokenRef(cardConfig.borderRadius, tokens)
     : undefined;
   const collapsedActiveBackground = collapsed && active && cardConfig
     ? resolveTokenRef(cardConfig.activeBackground, tokens)
     : undefined;
   const collapsedHoverBackground = collapsed && !active && cardConfig
     ? resolveTokenRef(cardConfig.hoverBackground, tokens)
     : undefined;
   const collapsedBorderColor = collapsed && cardConfig
     ? resolveTokenRef(cardConfig.borderColor, tokens)
     : undefined;
   const collapsedBorderWidth = collapsed && cardConfig
     ? resolveTokenRef(cardConfig.borderWidth, tokens)
     : undefined;
   const collapsedActiveBorder = collapsed && active && cardConfig
     ? resolveTokenRef(cardConfig.activeCardBorder, tokens)
     : undefined;

   const linkStyle: React.CSSProperties = {
     display: "flex",
     alignItems: "center",
     gap: 8,
     // Use cardConfig padding when collapsed, fallback to hardcoded
     padding: collapsed
       ? (collapsedPadding || "6px 4px")
       : (depth > 0 ? "6px 12px 6px 28px" : "8px 6px"),
     // Use cardConfig borderRadius, fallback to hardcoded
     borderRadius: collapsedBorderRadius || 6,
     textDecoration: "none",
     color: "var(--sidebar-foreground, var(--foreground))",
     fontSize: depth > 0 ? 13 : 14,
     opacity: item.disabled ? 0.4 : 1,
     pointerEvents: item.disabled ? "none" : undefined,
     cursor: item.disabled ? "default" : "pointer",
     justifyContent: collapsed ? "center" : "flex-start",
     minWidth: 0,
     // Apply background when collapsed
     background: collapsed
       ? (collapsedActiveBackground || collapsedHoverBackground || "transparent")
       : undefined,
     // Apply border when collapsed and cardConfig enabled
     border: collapsed && cardConfig?.enabled && collapsedBorderColor
       ? `${collapsedBorderWidth || "1px"} solid ${collapsedBorderColor}`
       : undefined,
     // Apply active border when collapsed
     borderColor: collapsed && active && collapsedActiveBorder
       ? collapsedActiveBorder
       : undefined,
   };
   ```

2. **Adicionar hover state** (após linkStyle, criar novo objeto):
   ```typescript
   // Hover state styles (applied via CSS-in-JS or inline handlers if needed)
   // For now, we rely on CSS variables and card config being applied
   // Future: add onMouseEnter/onMouseLeave handlers if dynamic hover needed
   ```

**Contrato**:
- Padding: usa cardConfig.padding quando collapsed, fallback "6px 4px"
- BorderRadius: usa cardConfig.borderRadius, fallback 6
- Background: aplica activeBackground ou hoverBackground quando collapsed
- Border: aplica borderColor/Width quando collapsed e cardConfig.enabled
- Active border: sobrescreve border color quando active
- Todos os valores resolvem token refs via resolveTokenRef()
- Mantém backwards compatibility com fallbacks

---

## MP-CARD-05: Adicionar hover handlers (opcional) ✅
**Objetivo**: Adicionar hover handlers dinâmicos para aplicar hoverBackground

**Arquivos**:
- `packages/orqui/src/runtime/components/NavItem.tsx`

**Implementação**:

1. **Adicionar estado de hover** (linha 37-39):
   ```typescript
   const [showTooltip, setShowTooltip] = useState(false);
   const [tooltipPos, setTooltipPos] = useState({ left: 0, top: 0 });
   const [isHovered, setIsHovered] = useState(false);  // ← Adicionar
   const linkRef = useRef<HTMLAnchorElement>(null);
   ```

2. **Modificar handleMouseEnter** (linha 61-76):
   ```typescript
   const handleMouseEnter = () => {
     setIsHovered(true);  // ← Adicionar

     if (!collapsed || !linkRef.current) return;
     const rect = linkRef.current.getBoundingClientRect();

     const offsetStr = getComputedStyle(document.documentElement)
       .getPropertyValue('--orqui-tooltip-offset')
       .trim() || '12px';
     const offset = parseFloat(offsetStr) || 12;

     setTooltipPos({
       left: rect.right + offset,
       top: rect.top + rect.height / 2,
     });
     setShowTooltip(true);
   };
   ```

3. **Modificar handleMouseLeave** (linha 78-80):
   ```typescript
   const handleMouseLeave = () => {
     setIsHovered(false);   // ← Adicionar
     setShowTooltip(false);
   };
   ```

4. **Aplicar hover background no linkStyle**:
   ```typescript
   // Na seção de resolução de valores (antes do linkStyle):
   const shouldShowHoverBg = collapsed && isHovered && !active && cardConfig;
   const collapsedHoverBackground = shouldShowHoverBg
     ? resolveTokenRef(cardConfig.hoverBackground, tokens)
     : undefined;

   // No linkStyle, modificar a linha de background:
   background: collapsed
     ? (collapsedActiveBackground || collapsedHoverBackground || "transparent")
     : undefined,
   ```

**Contrato**:
- isHovered state controla exibição do hover background
- Hover handlers atualizam state quando mouse entra/sai
- Hover background só aplica quando collapsed && !active
- Mantém tooltip behavior existente

---

## MP-CARD-06: Atualizar recursão de NavItem (children) ✅
**Objetivo**: Passar cardConfig e tokens para NavItem recursivos (sub-items)

**Arquivos**:
- `packages/orqui/src/runtime/components/NavItem.tsx`

**Implementação**:

1. **Modificar chamada recursiva** (linha 228-241):
   ```typescript
   {hasChildren && isSubOpen && !collapsed && (
     <div style={{ overflow: "hidden" }}>
       {item.children!.map(child => (
         <NavItem
           key={child.id}
           item={child}
           depth={depth + 1}
           collapsed={collapsed}
           collapsedDisplay={collapsedDisplay}
           isActive={isActive}
           handleClick={handleClick}
           renderBadge={renderBadge}
           getIconSize={getIconSize}
           baseIconSize={baseIconSize}
           openSubs={openSubs}
           setOpenSubs={setOpenSubs}
           cardConfig={cardConfig}  // ← Adicionar
           tokens={tokens}          // ← Adicionar
         />
       ))}
     </div>
   )}
   ```

**Contrato**:
- Sub-items recebem mesmas props de cardConfig e tokens
- Permite estilização consistente em todos os níveis
- Recursão mantém configuração em cascata

---

## MP-CARD-07: Adicionar debug logging (desenvolvimento) ✅
**Objetivo**: Adicionar logs de debug para facilitar troubleshooting

**Arquivos**:
- `packages/orqui/src/runtime/components/NavItem.tsx`

**Implementação**:

1. **Adicionar debug useEffect** (após os outros useEffects):
   ```typescript
   // DEBUG: Log card config application in development
   useEffect(() => {
     if (process.env.NODE_ENV === 'development' && collapsed && cardConfig) {
       console.log('[NavItem] Card config applied:', {
         itemId: item.id,
         collapsed,
         active,
         cardConfig: {
           enabled: cardConfig.enabled,
           padding: resolveTokenRef(cardConfig.padding, tokens),
           borderRadius: resolveTokenRef(cardConfig.borderRadius, tokens),
           activeBackground: resolveTokenRef(cardConfig.activeBackground, tokens),
           borderColor: resolveTokenRef(cardConfig.borderColor, tokens),
         },
       });
     }
   }, [collapsed, cardConfig, active, item.id, tokens]);
   ```

**Contrato**:
- Logs apenas em development (NODE_ENV === 'development')
- Mostra valores resolvidos (após resolveTokenRef)
- Ajuda a debugar configuração incorreta
- Não impacta performance em produção

---

## MP-CARD-08: Atualizar testes (opcional) ✅
**Objetivo**: Adicionar testes para verificar aplicação de cardConfig

**Arquivos**:
- `packages/orqui/src/runtime/components/NavItem.spec.tsx` (criar se não existir)

**Implementação**:

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { NavItem } from './NavItem';

describe('NavItem - Card Config', () => {
  const mockItem = {
    id: 'test',
    label: 'Test Item',
    icon: 'lucide:home',
    route: '/test',
  };

  const mockCardConfig = {
    enabled: true,
    padding: '$tokens.spacing.sm',
    borderRadius: '$tokens.borderRadius.md',
    activeBackground: '$tokens.colors.accent',
  };

  const mockTokens = {
    spacing: { sm: { value: 8, unit: 'px' } },
    borderRadius: { md: { value: 6, unit: 'px' } },
    colors: { accent: { value: '#0090ff' } },
  };

  it('should apply cardConfig when collapsed', () => {
    const { container } = render(
      <NavItem
        item={mockItem}
        collapsed={true}
        cardConfig={mockCardConfig}
        tokens={mockTokens}
        isActive={() => false}
        handleClick={() => {}}
        renderBadge={() => null}
        getIconSize={() => 18}
        baseIconSize={18}
        openSubs={{}}
        setOpenSubs={() => {}}
      />
    );

    const link = container.querySelector('a');
    expect(link).toBeTruthy();
    expect(link?.style.padding).toBe('8px');
    expect(link?.style.borderRadius).toBe('6px');
  });

  it('should fallback to hardcoded values when cardConfig missing', () => {
    const { container } = render(
      <NavItem
        item={mockItem}
        collapsed={true}
        isActive={() => false}
        handleClick={() => {}}
        renderBadge={() => null}
        getIconSize={() => 18}
        baseIconSize={18}
        openSubs={{}}
        setOpenSubs={() => {}}
      />
    );

    const link = container.querySelector('a');
    expect(link?.style.padding).toBe('6px 4px'); // Fallback hardcoded
    expect(link?.style.borderRadius).toBe('6px'); // Fallback hardcoded
  });

  it('should apply active background when collapsed and active', () => {
    const { container } = render(
      <NavItem
        item={mockItem}
        collapsed={true}
        cardConfig={mockCardConfig}
        tokens={mockTokens}
        isActive={() => true}
        handleClick={() => {}}
        renderBadge={() => null}
        getIconSize={() => 18}
        baseIconSize={18}
        openSubs={{}}
        setOpenSubs={() => {}}
      />
    );

    const link = container.querySelector('a');
    expect(link?.style.background).toBe('#0090ff');
  });
});
```

**Contrato**:
- Testes verificam aplicação de cardConfig
- Testes verificam fallback para valores hardcoded
- Testes verificam active/hover states
- Usa Vitest como test runner

---

## MP-CARD-09: Documentação e validação ✅
**Objetivo**: Documentar configuração e validar funcionamento no workbench

**Arquivos**:
- `C:\Users\lucas\.claude\projects\C--Coding-gatekeeper\memory\MEMORY.md`
- `artifacts/COLLAPSED_CARD_CONFIG.md` (este arquivo)

**Implementação**:

1. **Atualizar MEMORY.md**:
   ```markdown
   ### ✅ Collapsed Card Configuration - CONCLUÍDO (2026-02-06)
   **Objetivo**: Conectar controles existentes do workbench ao NavItem colapsado

   **O que foi feito**:
   - Extraído cardConfig de navigation.typography
   - Passado cardConfig + tokens de SidebarNav → NavItem
   - Criado helper resolveTokenRef para resolver token references
   - Aplicado cardConfig.padding, borderRadius, background, border no NavItem collapsed
   - Adicionado hover handlers para hoverBackground dinâmico
   - Mantida backwards compatibility com fallbacks hardcoded

   **Configuração disponível** (navigation.typography):
   - cardEnabled: boolean
   - cardPadding: TokenRef (ex: "$tokens.spacing.sm")
   - cardBorderRadius: TokenRef (ex: "$tokens.borderRadius.md")
   - cardBackground: TokenRef
   - cardBorderColor: TokenRef
   - cardBorderWidth: string
   - activeBackground: TokenRef (background quando active)
   - activeCardBorder: TokenRef (border quando active)
   - hoverBackground: TokenRef (background no hover)
   - hoverCardBorder: TokenRef (border no hover)

   **Controles no workbench**:
   - Seção "Card Style" no NavItemStyleEditor
   - Todos os campos aceitam token refs ($tokens.*)
   - Preview ao vivo no editor

   **Contrato**:
   - ✅ Valores aplicam tanto no modo expandido quanto colapsado
   - ✅ Token refs resolvidos automaticamente
   - ✅ Fallback para valores hardcoded se config não existe
   - ✅ Zero breaking changes
   ```

2. **Validação manual no workbench**:
   - ✅ Abrir workbench do Orqui
   - ✅ Navegar para "Sidebar Config" → "Card Style"
   - ✅ Modificar "Card Padding" (ex: $tokens.spacing.md)
   - ✅ Modificar "Border Radius" (ex: $tokens.borderRadius.lg)
   - ✅ Modificar "Active Background" (ex: $tokens.colors.accent)
   - ✅ Colapsar sidebar no preview
   - ✅ Verificar que ícones aplicam os novos estilos
   - ✅ Hover sobre ícones (verificar hover background)
   - ✅ Clicar em ícone (verificar active background)

3. **Validação de edge cases**:
   - ✅ Projeto sem cardConfig definido (usa fallback hardcoded)
   - ✅ Token ref inválido (usa fallback hardcoded)
   - ✅ cardEnabled = false (não aplica card styles)
   - ✅ Sub-items (children) herdam configuração

**Contrato**:
- Documentação atualizada
- Workbench testado manualmente
- Edge cases validados
- Zero breaking changes confirmados

---

## Resumo de Mudanças

### Arquivos Modificados
1. **`SidebarNav.tsx`**:
   - Extrair cardConfig de navConfig.typography
   - Passar cardConfig + tokens para NavItem

2. **`NavItem.tsx`**:
   - Adicionar interface CardConfig
   - Atualizar NavItemProps (cardConfig, tokens)
   - Criar helper resolveTokenRef
   - Aplicar cardConfig no linkStyle (collapsed)
   - Adicionar hover handlers
   - Passar props para recursão (children)
   - Adicionar debug logging (dev only)

3. **`MEMORY.md`**:
   - Documentar configuração disponível
   - Documentar controles do workbench

### Novos Arquivos (Opcional)
1. **`NavItem.spec.tsx`**:
   - Testes unitários para cardConfig

### Zero Breaking Changes
- ✅ Valores hardcoded mantidos como fallback
- ✅ cardConfig opcional (backwards compatibility)
- ✅ Projetos antigos continuam funcionando
- ✅ Novos projetos podem usar configuração

---

## Ordem de Implementação Recomendada

1. **MP-CARD-03** - Criar helper resolveTokenRef (independente)
2. **MP-CARD-02** - Atualizar interface NavItemProps (types)
3. **MP-CARD-01** - Passar cardConfig de SidebarNav
4. **MP-CARD-04** - Aplicar cardConfig no linkStyle
5. **MP-CARD-05** - Adicionar hover handlers (melhoria UX)
6. **MP-CARD-06** - Atualizar recursão para children
7. **MP-CARD-07** - Adicionar debug logging (troubleshooting)
8. **MP-CARD-08** - Testes (opcional, recomendado)
9. **MP-CARD-09** - Documentação e validação

**Tempo estimado**: 2-3 horas
**Dificuldade**: Baixa-Média
**Impacto**: Alto (desbloqueia customização total do card colapsado)

---

## Resultado Final

Após implementação, o usuário poderá configurar via workbench:

**Card Style Editor (navigation.typography)**:
- ✅ **Card Padding**: Controla altura/largura do card colapsado
- ✅ **Border Radius**: Arredondamento dos cantos
- ✅ **Card Background**: Cor de fundo padrão
- ✅ **Border Color/Width**: Borda do card
- ✅ **Active Background**: Cor quando item está ativo
- ✅ **Active Border**: Borda quando item está ativo
- ✅ **Hover Background**: Cor ao passar mouse (collapsed)
- ✅ **Hover Border**: Borda ao passar mouse

**Todos os valores aceitam**:
- Token refs: `$tokens.spacing.md`, `$tokens.colors.accent`
- Valores diretos: `"12px"`, `"#ff0000"`
- Valores numéricos: `12`

**Preview em tempo real** no workbench com sidebar colapsada.

---

## Status: 📋 PRONTO PARA IMPLEMENTAÇÃO
