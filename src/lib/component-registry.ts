import type { ComponentType } from "react"

/**
 * ComponentRegistry
 *
 * Registry central para mapear strings (keys) para React Components.
 * Usado pelo Grid Engine para resolver componentes dinamicamente.
 */
class ComponentRegistryClass {
  private registry = new Map<string, ComponentType<any>>()

  register(key: string, component: ComponentType<any>): void {
    this.registry.set(key, component)
  }

  get(key: string): ComponentType<any> | undefined {
    return this.registry.get(key)
  }

  has(key: string): boolean {
    return this.registry.has(key)
  }

  clear(): void {
    this.registry.clear()
  }
}

export const ComponentRegistry = new ComponentRegistryClass()
