# 📏 Stroke Width Configuration - Implementation Plan

## Contexto
Lucide Icons suporta `strokeWidth` para controlar a grossura das linhas dos ícones. Atualmente, o valor é hardcoded (`enhanced ? 2.5 : 2`). Este plano adiciona controle no workbench para configurar esse valor dinamicamente.

## Objetivo
Permitir configurar `strokeWidth` dos ícones via workbench em `navigation.icons.strokeWidth`, com valores típicos de 1 (fino) a 3 (grosso).

---

## MP-STROKE-01: Adicionar controle no workbench ✅
**Objetivo**: Criar input no workbench para configurar strokeWidth

**Arquivos**:
- `packages/orqui/src/editor/editors/RegionEditors.tsx`

**Tarefas**:

1. **Adicionar campo strokeWidth no editor** (após linha ~420, dentro da seção de ícones):
   ```typescript
   {nav.icons?.enabled && (
     <>
       <Row gap={8}>
         <Field label="Icon Size" style={{ flex: 1 }}>
           <TokenRefSelect value={nav.icons.size} tokens={tokens} category="sizing" onChange={(v) => updateNav("size", v)} />
         </Field>
         <Field label="Gap" style={{ flex: 1 }}>
           <TokenRefSelect value={nav.icons.gap} tokens={tokens} category="spacing" onChange={(v) => updateNav("gap", v)} />
         </Field>
       </Row>

       {/* ADICIONAR AQUI: Stroke Width Control */}
       <Row gap={8}>
         <Field label="Stroke Width" style={{ flex: 1 }}>
           <input
             type="number"
             min="1"
             max="4"
             step="0.5"
             value={nav.icons.strokeWidth ?? 2}
             onChange={(e) => updateNav("strokeWidth", parseFloat(e.target.value))}
             style={{ ...s.input, width: "100%" }}
           />
         </Field>
         <div style={{ flex: 1, fontSize: 11, color: COLORS.textDim, alignSelf: "center" }}>
           Grossura da linha: 1 (fino) a 3 (grosso). Padrão: 2
         </div>
       </Row>

       {/* Preview ao vivo */}
       <div style={{ ... }}>
   ```

2. **Atualizar preview ao vivo** (linha ~446, dentro do preview de ícones):
   ```typescript
   const iconSize = (() => {
     const sizeRef = nav.icons?.size;
     if (!sizeRef) return 18;
     const resolved = resolveTokenNum(sizeRef, tokens);
     return resolved ?? 18;
   })();

   // ADICIONAR: Resolver strokeWidth
   const strokeWidth = nav.icons?.strokeWidth ?? 2;

   return (
     <div key={item.id} style={{ textAlign: 'center' }}>
       <IconValue
         icon={item.icon}
         size={iconSize}
         enhanced={false}
         strokeWidth={strokeWidth}  // ← ADICIONAR prop
       />
       <div style={{ fontSize: 9, color: COLORS.textDim, marginTop: 4 }}>{item.label}</div>
     </div>
   );
   ```

3. **Garantir que updateNav salva strokeWidth**:
   ```typescript
   const updateNav = (field, val) => {
     onChange({ ...region, navigation: { ...nav, icons: { ...nav.icons, [field]: val } } });
   };
   ```

**Contrato**:
- Input numérico com range 1-4, step 0.5
- Valor default: 2
- Preview atualiza em tempo real
- Valor salvo em `navigation.icons.strokeWidth`

---

## MP-STROKE-02: Passar strokeWidth para IconValue no SidebarNav ✅
**Objetivo**: Extrair strokeWidth do navConfig e passar para IconValue

**Arquivos**:
- `packages/orqui/src/runtime/components/SidebarNav.tsx`

**Tarefas**:

1. **Extrair strokeWidth do navConfig** (após linha 45, junto com baseIconSize):
   ```typescript
   const baseIconSize = useMemo(() => {
     // ... código existente
     return size;
   }, [navConfig.icons, tokens]);

   // ADICIONAR: Extrair strokeWidth
   const iconStrokeWidth = useMemo(() => {
     const configured = navConfig.icons?.strokeWidth;
     if (configured !== undefined && configured !== null) {
       return Number(configured);
     }
     return 2; // default
   }, [navConfig.icons?.strokeWidth]);
   ```

2. **Adicionar strokeWidth aos sharedNavItemProps** (linha ~150):
   ```typescript
   const sharedNavItemProps = {
     collapsed,
     collapsedDisplay,
     isActive,
     handleClick,
     renderBadge,
     getIconSize,
     baseIconSize,
     iconStrokeWidth,  // ← ADICIONAR
     openSubs,
     setOpenSubs,
   };
   ```

3. **Atualizar DEBUG log** (se existir, linha ~50):
   ```typescript
   useEffect(() => {
     if (process.env.NODE_ENV === 'development' && collapsed) {
       const iconItems = items.filter(item => item.icon);
       console.log('[SidebarNav] Collapsed mode:', {
         collapsedDisplay,
         iconCount: iconItems.length,
         icons: iconItems.map(i => ({ id: i.id, icon: i.icon })),
         baseIconSize,
         iconStrokeWidth,  // ← ADICIONAR
       });
     }
   }, [collapsed, collapsedDisplay, items, baseIconSize, iconStrokeWidth]);
   ```

**Contrato**:
- strokeWidth extraído do navConfig.icons.strokeWidth
- Memoizado para performance
- Default: 2 (se não configurado)
- Passado como prop para todos os NavItem

---

## MP-STROKE-03: Aplicar strokeWidth no NavItem e IconValue ✅
**Objetivo**: Receber strokeWidth via props e passar para IconValue

**Arquivos**:
- `packages/orqui/src/runtime/components/NavItem.tsx`
- `packages/orqui/src/runtime/icons.tsx`

**Tarefas**:

1. **Atualizar interface NavItemProps** (NavItem.tsx, linha ~9):
   ```typescript
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
     iconStrokeWidth?: number;  // ← ADICIONAR
     openSubs: Record<string, boolean>;
     setOpenSubs: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
   }
   ```

2. **Desestruturar iconStrokeWidth** (NavItem.tsx, linha ~23):
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
     iconStrokeWidth = 2,  // ← ADICIONAR com default
     openSubs,
     setOpenSubs,
   }: NavItemProps) {
   ```

3. **Passar strokeWidth para IconValue** (NavItem.tsx, linha ~114 e ~127):
   ```typescript
   // Collapsed content
   const iconSize = getIconSize(depth);
   return <IconValue
     key={`icon-${item.id}`}
     icon={item.icon}
     size={iconSize}
     color="currentColor"
     enhanced={true}
     strokeWidth={iconStrokeWidth}  // ← ADICIONAR
     showDebug={process.env.NODE_ENV === 'development'}
   />;

   // Expanded content
   {item.icon && <IconValue
     key={`icon-${item.id}`}
     icon={item.icon}
     size={getIconSize(depth)}
     color="currentColor"
     enhanced={false}
     strokeWidth={iconStrokeWidth}  // ← ADICIONAR
     showDebug={process.env.NODE_ENV === 'development'}
   />}
   ```

4. **Atualizar recursão para children** (NavItem.tsx, linha ~228):
   ```typescript
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
     iconStrokeWidth={iconStrokeWidth}  // ← ADICIONAR
     openSubs={openSubs}
     setOpenSubs={setOpenSubs}
   />
   ```

5. **Atualizar interface IconValue** (icons.tsx, linha ~74):
   ```typescript
   export function IconValue({
     icon,
     size = 20,
     color = "currentColor",
     enhanced = false,
     strokeWidth,  // ← ADICIONAR (opcional)
     showDebug = false,
   }: {
     icon?: string;
     size?: number;
     color?: string;
     enhanced?: boolean;
     strokeWidth?: number;  // ← ADICIONAR
     showDebug?: boolean;
   }) {
   ```

6. **Aplicar strokeWidth no render** (icons.tsx, linha ~153):
   ```typescript
   <IconComponent
     size={size}
     color={color}
     strokeWidth={strokeWidth ?? (enhanced ? 2.5 : 2)}  // ← MODIFICAR
     style={{
       minWidth: size,
       minHeight: size,
       flexShrink: 0,
     }}
   />
   ```

**Contrato**:
- NavItem recebe iconStrokeWidth via props
- Passa strokeWidth para todos os IconValue (collapsed e expanded)
- IconValue usa strokeWidth se fornecido, senão fallback para enhanced logic
- Recursão mantém strokeWidth para children
- Backwards compatibility: se strokeWidth não fornecido, usa lógica antiga

---

## MP-STROKE-04: Adicionar default no constants.ts ✅
**Objetivo**: Definir valor default no contrato do layout

**Arquivos**:
- `packages/orqui/src/editor/lib/constants.ts`

**Tarefas**:

1. **Adicionar strokeWidth no DEFAULT_LAYOUT** (linha ~67-72):
   ```typescript
   "navigation": {
     "icons": {
       "enabled": true,
       "size": "$tokens.sizing.icon-md",
       "gap": "$tokens.spacing.sm",
       "strokeWidth": 2  // ← ADICIONAR
     },
     "typography": {
       // ... resto da config
     },
   ```

2. **Atualizar comentário de documentação** (se existir):
   ```typescript
   // navigation.icons configuration
   // - enabled: boolean (show/hide icons)
   // - size: TokenRef (icon size)
   // - gap: TokenRef (spacing between icon and text)
   // - strokeWidth: number (1-4, line thickness, default: 2)
   ```

**Contrato**:
- Default strokeWidth: 2 (padrão Lucide)
- Valor aplicado em novos projetos
- Projetos existentes sem strokeWidth usam fallback (2)

---

## Ordem de Implementação

1. **MP-STROKE-04** - Adicionar default (independente)
2. **MP-STROKE-03** - Atualizar IconValue interface (base)
3. **MP-STROKE-02** - Passar props no SidebarNav (pipeline)
4. **MP-STROKE-01** - Adicionar controle workbench (UI final)

**Tempo estimado**: 1 hora
**Dificuldade**: Baixa
**Impacto**: Médio (customização adicional de ícones)

---

## Resultado Final

Após implementação, o usuário poderá:

**No Workbench (Sidebar Config):**
- ✅ Ajustar "Stroke Width" via input numérico (1-4)
- ✅ Ver preview em tempo real
- ✅ Tooltips explicativos

**Valores comuns:**
- `1.0` - Extra fino (minimalista)
- `1.5` - Fino
- `2.0` - Padrão (Lucide default)
- `2.5` - Grosso
- `3.0` - Extra grosso (bold)

**Compatibilidade:**
- ✅ Projetos novos: strokeWidth = 2 (default)
- ✅ Projetos antigos: strokeWidth = 2 (fallback)
- ✅ Zero breaking changes

---

## Status: 📋 PRONTO PARA IMPLEMENTAÇÃO

4 microplans, cada um tocando no máximo 2 arquivos, com 3-6 tarefas bem definidas.
