/**
 * UI Contract Types
 *
 * Tipos para definição de contratos de interface de usuário exportados
 * de ferramentas de design (Figma, etc.) para validação no Gatekeeper.
 */

export type ComponentState = 'default' | 'hover' | 'pressed' | 'disabled' | 'focused' | 'active'

export interface UIContractMetadata {
  projectName: string
  exportedFrom: string
  exportedAt: string
  hash: string
}

export interface UIComponentPart {
  name: string
  type?: string
  optional?: boolean
}

export interface UIComponentDefinition {
  variants: string[]
  parts?: string[]
  states?: ComponentState[]
  description?: string
}

export interface UIStyleValue {
  value: string
  unit?: string
  type?: string
}

export interface UIContractSchema {
  version: string
  metadata: UIContractMetadata
  components: Record<string, UIComponentDefinition>
  styles: Record<string, string | UIStyleValue>
}
