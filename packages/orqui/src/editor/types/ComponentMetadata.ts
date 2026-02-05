// ============================================================================
// ComponentMetadata Types — Metadata system for component palette
// ============================================================================

export type ComponentCategory =
  | "Entrada"
  | "Seleção"
  | "Feedback"
  | "Layouts"
  | "Dados"
  | "Especializados"
  | "Utilitários";

export type PropFieldType =
  | "text"
  | "number"
  | "select"
  | "boolean"
  | "color"
  | "icon";

export interface PropField {
  name: string;
  label: string;
  type: PropFieldType;
  defaultValue?: any;
  options?: Array<{
    value: string;
    label: string;
  }>;
  supportsTemplates?: boolean;
}

export interface ComponentMetadata {
  componentType: string;
  category: ComponentCategory;
  icon: string;
  defaultColSpan: number;
  defaultRowSpan: number;
  propFields: PropField[];
}
