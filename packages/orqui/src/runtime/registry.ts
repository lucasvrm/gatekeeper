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
