// ============================================================================
// Orqui Runtime — Tooltip Portal
// ============================================================================
// Renders tooltips in a React Portal to escape overflow constraints
// and stacking contexts from parent containers.
import { type ReactNode } from "react";
import { createPortal } from "react-dom";

export function TooltipPortal({ children }: { children: ReactNode }) {
  // SSR safety: don't render during server-side rendering
  if (typeof document === "undefined") return null;

  // Render children directly into document.body
  return createPortal(children, document.body);
}
