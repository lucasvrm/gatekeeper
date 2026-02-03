// ============================================================================
// Orqui React Components for Easyblocks Canvas
//
// Each NoCode Component Definition needs a corresponding React component.
// In Easyblocks, the styles function creates styled components (Root, etc.)
// which are passed as props to the React component.
//
// These components are used ONLY in the Easyblocks editor canvas.
// The production runtime continues to use NodeRenderer from runtime/.
//
// Convention: Each component receives:
//   - Styled components from styles() as props (Root, Wrapper, etc.)
//   - Schema prop values as props
//   - Subcomponent slots as props (Children, etc.)
// ============================================================================

import React, { type ReactNode, type ComponentType } from "react";

// ============================================================================
// Utility types
// ============================================================================

type StyledComponent = ComponentType<{ children?: ReactNode; [key: string]: any }>;

// ============================================================================
// Layout Components
// ============================================================================

export function OrquiStack({ Root, Children }: { Root: StyledComponent; Children: ReactNode }) {
  return <Root>{Children}</Root>;
}

export function OrquiRow({ Root, Children }: { Root: StyledComponent; Children: ReactNode }) {
  return <Root>{Children}</Root>;
}

export function OrquiGrid({ Root, Children }: { Root: StyledComponent; Children: ReactNode }) {
  return <Root>{Children}</Root>;
}

export function OrquiContainer({ Root, Children }: { Root: StyledComponent; Children: ReactNode }) {
  return <Root>{Children}</Root>;
}

// ============================================================================
// Content Components
// ============================================================================

export function OrquiHeading({ Root, content, as: Tag = "h2" }: {
  Root: StyledComponent; content: string; as?: string;
}) {
  const Element = Tag as any;
  return <Root><Element style={{ margin: 0, fontSize: "inherit", fontWeight: "inherit" }}>{content}</Element></Root>;
}

export function OrquiText({ Root, content }: { Root: StyledComponent; content: string }) {
  return <Root><p style={{ margin: 0 }}>{content}</p></Root>;
}

export function OrquiButton({ Root, label, icon }: {
  Root: StyledComponent; label: string; icon?: string;
}) {
  return (
    <Root>
      {icon && <span style={{ fontSize: "1em" }}>{icon}</span>}
      <span>{label}</span>
    </Root>
  );
}

export function OrquiBadge({ Root, content }: { Root: StyledComponent; content: string }) {
  return <Root>{content}</Root>;
}

export function OrquiIcon({ Root, name, size }: {
  Root: StyledComponent; name: string; size: string;
}) {
  // In the editor, show the icon name as placeholder
  // In Phase 2, use @phosphor-icons/react for actual rendering
  return (
    <Root>
      <span style={{
        fontSize: `${Math.max(parseInt(size) * 0.5, 10)}px`,
        opacity: 0.5,
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        {name}
      </span>
    </Root>
  );
}

export function OrquiImage({ Root, src, alt, size, rounded }: {
  Root: StyledComponent; src: string; alt: string; size: string; rounded: boolean;
}) {
  if (!src) {
    return (
      <Root>
        <div style={{
          width: `${size}px`, height: `${size}px`,
          background: "#1c1c21", border: "1px dashed #3a3a45",
          borderRadius: rounded ? "9999px" : "4px",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, color: "#5b5b66",
        }}>
          IMG
        </div>
      </Root>
    );
  }
  return (
    <Root>
      <img src={src} alt={alt} style={{
        width: `${size}px`, height: `${size}px`,
        objectFit: "cover",
        borderRadius: rounded ? "9999px" : "4px",
      }} />
    </Root>
  );
}

export function OrquiDivider({ Root }: { Root: StyledComponent }) {
  return <Root />;
}

export function OrquiSpacer({ Root }: { Root: StyledComponent }) {
  return <Root />;
}

// ============================================================================
// Data Components
// ============================================================================

export function OrquiStatCard({ Root, Label, Value, IconWrapper, label, value, icon }: {
  Root: StyledComponent; Label: StyledComponent; Value: StyledComponent; IconWrapper: StyledComponent;
  label: string; value: string; icon: string;
}) {
  return (
    <Root>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <Label>{label}</Label>
          <Value>{value}</Value>
        </div>
        <IconWrapper>
          <span style={{ fontSize: 16 }}>{icon}</span>
        </IconWrapper>
      </div>
    </Root>
  );
}

export function OrquiCard({ Root, Header, Body, title, Children }: {
  Root: StyledComponent; Header: StyledComponent; Body: StyledComponent;
  title: string; Children: ReactNode;
}) {
  return (
    <Root>
      {title && <Header>{title}</Header>}
      <Body>{Children}</Body>
    </Root>
  );
}

export function OrquiTable({ Root, HeaderCell, Cell, dataSource, columnsJson }: {
  Root: StyledComponent; HeaderCell: StyledComponent; Cell: StyledComponent;
  dataSource: string; columnsJson: string;
}) {
  let columns: Array<{ key: string; label: string; width?: string }> = [];
  try { columns = JSON.parse(columnsJson); } catch { /* ignore */ }

  return (
    <Root>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {columns.map(col => (
              <HeaderCell key={col.key} as="th" style={{ width: col.width }}>
                {col.label}
              </HeaderCell>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Mock rows in editor */}
          {[1, 2, 3].map(row => (
            <tr key={row}>
              {columns.map(col => (
                <Cell key={col.key} as="td">
                  <span style={{ opacity: 0.4 }}>{`{${dataSource}[${row}].${col.key}}`}</span>
                </Cell>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Root>
  );
}

export function OrquiList({ Root, Item, dataSource, maxItems }: {
  Root: StyledComponent; Item: StyledComponent;
  dataSource: string; maxItems: string;
}) {
  const count = Math.min(parseInt(maxItems) || 3, 5);
  return (
    <Root>
      {Array.from({ length: count }, (_, i) => (
        <Item key={i}>
          <span style={{ opacity: 0.4 }}>{`{${dataSource}[${i}]}`}</span>
        </Item>
      ))}
    </Root>
  );
}

export function OrquiKeyValue({ Root, Pair, Label, Value, layout, itemsJson }: {
  Root: StyledComponent; Pair: StyledComponent; Label: StyledComponent; Value: StyledComponent;
  layout: string; itemsJson: string;
}) {
  let items: Array<{ label: string; value: string }> = [];
  try { items = JSON.parse(itemsJson); } catch { /* ignore */ }

  return (
    <Root>
      {items.map((item, i) => (
        <Pair key={i}>
          <Label>{item.label}</Label>
          <Value>{item.value}</Value>
        </Pair>
      ))}
    </Root>
  );
}

// ============================================================================
// Navigation, Input & Special Components
// ============================================================================

export function OrquiTabs({ Root, TabBar, Tab, TabActive, Content, tabsJson, defaultTab }: {
  Root: StyledComponent; TabBar: StyledComponent; Tab: StyledComponent;
  TabActive: StyledComponent; Content: StyledComponent;
  tabsJson: string; defaultTab: string;
}) {
  let tabs: Array<{ id: string; label: string }> = [];
  try { tabs = JSON.parse(tabsJson); } catch { /* ignore */ }

  return (
    <Root>
      <TabBar>
        {tabs.map(tab => {
          const isActive = tab.id === defaultTab;
          const Comp = isActive ? TabActive : Tab;
          return <Comp key={tab.id}>{tab.label}</Comp>;
        })}
      </TabBar>
      <Content>
        <span style={{ fontSize: 12, color: "#5b5b66" }}>
          Conteúdo da tab: {defaultTab}
        </span>
      </Content>
    </Root>
  );
}

export function OrquiSearch({ Root, Icon, Input, placeholder }: {
  Root: StyledComponent; Icon: StyledComponent; Input: StyledComponent;
  placeholder: string;
}) {
  return (
    <Root>
      <Icon>🔍</Icon>
      <Input as="input" readOnly placeholder={placeholder} />
    </Root>
  );
}

export function OrquiSelect({ Root, placeholder, optionsJson }: {
  Root: StyledComponent; placeholder: string; optionsJson: string;
}) {
  let options: Array<{ value: string; label: string }> = [];
  try { options = JSON.parse(optionsJson); } catch { /* ignore */ }

  return (
    <Root as="select" disabled>
      <option value="">{placeholder}</option>
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </Root>
  );
}

export function OrquiSlot({ Root, name }: { Root: StyledComponent; name: string }) {
  return (
    <Root>
      <span>⧉ Slot: {name}</span>
    </Root>
  );
}

// ============================================================================
// Component Map — keyed by definition ID for Easyblocks
// ============================================================================

export const ORQUI_COMPONENTS: Record<string, ComponentType<any>> = {
  OrquiStack,
  OrquiRow,
  OrquiGrid,
  OrquiContainer,
  OrquiHeading,
  OrquiText,
  OrquiButton,
  OrquiBadge,
  OrquiIcon,
  OrquiImage,
  OrquiDivider,
  OrquiSpacer,
  OrquiStatCard,
  OrquiCard,
  OrquiTable,
  OrquiList,
  OrquiKeyValue,
  OrquiTabs,
  OrquiSearch,
  OrquiSelect,
  OrquiSlot,
};
