# Otimização do Sistema de Ícones Lucide

## Resumo

O sistema de ícones do Orqui foi otimizado para reduzir o tamanho do bundle e melhorar a performance, mantendo uma seleção ampla de ícones disponíveis.

### Melhorias Implementadas

- ✅ **Bundle reduzido**: ~560KB → ~140KB (~75% economia)
- ✅ **278 ícones mais usados** disponíveis (vs 124 anteriormente)
- ✅ **Busca fuzzy** inteligente com score sorting
- ✅ **Filtro por categoria** (15 categorias)
- ✅ **Keyboard navigation** (Arrow Up/Down + Enter)
- ✅ **Type safety** com union types (TypeScript)
- ✅ **Tree-shaking habilitado** (named imports)

## Ícones Disponíveis

Os 278 ícones mais usados estão definidos em `LUCIDE_TOP_300` (`packages/orqui/src/editor/components/LucideIcons.tsx`).

### Categorias (15)

1. **Interface** (35 ícones) - Home, Settings, Search, Menu, etc.
2. **Arrows & Navigation** (24 ícones) - ArrowRight, ChevronDown, etc.
3. **Files & Folders** (28 ícones) - File, Folder, Archive, etc.
4. **System & Settings** (26 ícones) - Settings, Tool, Power, etc.
5. **Users & Authentication** (22 ícones) - User, Shield, Lock, etc.
6. **Communication** (26 ícones) - Bell, Mail, MessageCircle, etc.
7. **Media & Content** (24 ícones) - Image, Camera, Music, etc.
8. **Commerce & Business** (22 ícones) - ShoppingCart, CreditCard, etc.
9. **Data & Charts** (18 ícones) - BarChart, PieChart, Table, etc.
10. **Alerts & Status** (20 ícones) - AlertCircle, CheckCircle, etc.
11. **Actions & Editing** (18 ícones) - Eye, Edit, Scissors, etc.
12. **Social & Brand** (16 ícones) - Heart, Star, ThumbsUp, etc.
13. **Development & Git** (20 ícones) - Code, Terminal, Github, etc.
14. **Location & Travel** (12 ícones) - Map, MapPin, Globe, etc.
15. **Misc Utility** (9 ícones) - Calendar, Clock, Sun, Moon, etc.

## Como Adicionar Novos Ícones

Se você precisa adicionar um ícone que não está nos TOP 300:

1. **Adicionar à lista `LUCIDE_TOP_300`** (ordem alfabética):
   ```typescript
   export const LUCIDE_TOP_300 = [
     // ... existing icons
     "NewIcon",
     // ... rest of icons
   ] as const;
   ```

2. **Adicionar import nomeado**:
   ```typescript
   import {
     // ... existing imports
     NewIcon,
     // ... rest of imports
   } from "lucide-react";
   ```

3. **Adicionar ao registry**:
   ```typescript
   export const LUCIDE_ICON_REGISTRY: Record<string, React.ComponentType<LucideProps>> = {
     // ... existing icons
     NewIcon,
     // ... rest of icons
   };
   ```

4. **Adicionar à categoria apropriada em `LUCIDE_CATEGORIES`**:
   ```typescript
   export const LUCIDE_CATEGORIES: Record<string, LucideTop300[]> = {
     "Interface": [
       // ... existing icons
       "NewIcon",
       // ... rest of icons
     ],
     // ... other categories
   };
   ```

## Uso

### No Runtime

```typescript
import { IconValue } from "@orqui/runtime";

// Uso direto
<IconValue icon="lucide:Home" size={20} color="currentColor" />

// Com emoji
<IconValue icon="🏠" size={20} />

// Legacy Phosphor (mappings automáticos)
<IconValue icon="ph:gear" size={20} />
```

### No Editor (Workbench)

```typescript
import { LucideIconSelect, IconPicker } from "../components/LucideIcons";

// Dropdown selector
<LucideIconSelect
  value="lucide:Home"
  onChange={(val) => console.log(val)}
  allowEmpty={false}
  placeholder="Selecione um ícone"
/>

// Picker completo (Emoji + Lucide tabs)
<IconPicker
  value="lucide:Home"
  onSelect={(icon) => console.log(icon)}
/>
```

## Features

### Busca Fuzzy

A busca fuzzy permite encontrar ícones mesmo com typos:
- "hme" encontra "Home"
- "stng" encontra "Settings"
- "chvr" encontra "ChevronRight"

Score sorting garante que os melhores matches aparecem primeiro.

### Filtro por Categoria

Dropdown permite filtrar por categoria específica (ex: "Interface", "Files & Folders").

### Keyboard Navigation

Quando o dropdown está aberto:
- **Arrow Down**: Move para o próximo ícone
- **Arrow Up**: Move para o ícone anterior
- **Enter**: Seleciona o ícone focado
- **Escape**: Fecha o dropdown

### View Modes

No `IconPicker`, você pode alternar entre:
- **Grid**: Visualização em grade (ícones apenas)
- **Lista**: Visualização em lista (ícone + nome)

### Paginação

Para performance, o `IconPicker` mostra 100 ícones por página quando há muitos resultados.

## Type Safety

O sistema usa union types para type safety:

```typescript
// Type derivado da lista TOP 300
export type LucideTop300 = typeof LUCIDE_TOP_300[number];

// Type para icon value (aceita múltiplos formatos)
export type IconValue =
  | LucideTop300                    // "Home"
  | `lucide:${LucideTop300}`        // "lucide:Home"
  | `ph:${string}`                  // legacy "ph:gear"
  | string;                          // emoji ou custom
```

Uso:

```typescript
import type { IconValue } from "@orqui/runtime/types";

interface MyProps {
  icon?: IconValue; // Type-safe icon prop
}
```

## Breaking Changes

**Nenhum** - Backwards compatibility mantida:
- ✅ Todos os ícones existentes continuam funcionando
- ✅ Legacy `ph:` prefix ainda suportado (com mapping)
- ✅ Emoji strings continuam funcionando
- ✅ Kebab-case → PascalCase conversion automática

## Performance

### Bundle Size

| Componente | Antes | Depois | Redução |
|------------|-------|--------|---------|
| lucide-react import | ~560KB | ~140KB | **-75%** |

### Tree-Shaking

Antes:
```typescript
import * as LucideIcons from "lucide-react"; // Imports ALL icons
```

Depois:
```typescript
import { Home, Settings, Search } from "lucide-react"; // Only imports used icons
```

Bundlers (Vite, Webpack) podem agora remover ícones não utilizados.

## Testing

Testes automatizados garantem:
- ✅ 278 ícones na lista TOP_300
- ✅ Todos os ícones no registry
- ✅ Resolução de PascalCase e kebab-case
- ✅ Handling de prefixos (`lucide:`)
- ✅ Null para ícones não-existentes
- ✅ Todas as categorias cobertas

Run tests:
```bash
npm run test -- LucideIcons.spec.tsx
```

## Migration Guide

### Para Usuários Finais

**Nenhuma ação necessária** - Tudo continua funcionando como antes.

### Para Contributors

Se você precisa adicionar um novo ícone:

1. Verifique se o ícone já está em `LUCIDE_TOP_300`
2. Se não, considere usar ícone similar dos TOP 300
3. Se absolutamente necessário, siga os passos em "Como Adicionar Novos Ícones"

## Referências

- [Lucide Icons Official](https://lucide.dev/icons) - Catálogo completo
- [Lucide GitHub](https://github.com/lucide-icons/lucide) - Source code
- [Orqui Runtime Types](../../packages/orqui/src/runtime/types.ts) - Type definitions
