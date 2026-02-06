// ============================================================================
// Orqui Runtime — UI Registry Helpers
// ============================================================================
import type { UIRegistryContract, ComponentRegistryEntry } from "./types.js";

export interface RegistryValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateRegistryContract(registry: unknown): RegistryValidationResult {
  const errors: string[] = [];

  if (!registry || typeof registry !== "object") {
    return { valid: false, errors: ["Registry must be an object."] };
  }

  const reg = registry as UIRegistryContract;
  if (!reg.components || typeof reg.components !== "object") {
    return { valid: false, errors: ["Registry.components must be an object."] };
  }

  for (const [key, value] of Object.entries(reg.components)) {
    if (!value || typeof value !== "object") {
      errors.push(`Component "${key}" must be an object.`);
      continue;
    }
    const comp = value as ComponentRegistryEntry;
    if (!comp.name || typeof comp.name !== "string") {
      errors.push(`Component "${key}" is missing a valid name.`);
    }
    if (comp.renderer && typeof comp.renderer !== "function") {
      errors.push(`Component "${key}" renderer must be a function.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function isRegistryContract(registry: unknown): registry is UIRegistryContract {
  return validateRegistryContract(registry).valid;
}

export function resolveRegistryComponentName(registry: unknown, name: string): string | null {
  if (!name || typeof name !== "string") return null;
  if (!registry || typeof registry !== "object") return null;
  const reg = registry as UIRegistryContract;
  const components = reg.components && typeof reg.components === "object"
    ? reg.components
    : (registry as Record<string, any>);
  if (!components || typeof components !== "object") return null;
  const target = name.toLowerCase();
  const match = Object.keys(components).find((key) => key.toLowerCase() === target);
  return match ?? null;
}
