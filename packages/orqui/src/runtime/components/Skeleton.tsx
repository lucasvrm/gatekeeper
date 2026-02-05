// ============================================================================
// Orqui Runtime — Skeleton Component
// Uses CSS vars from layout.structure.skeleton configuration
// ============================================================================
import React from "react";
import type { CSSProperties, ReactNode } from "react";

export interface SkeletonProps {
  /** Width of the skeleton (default: 100%) */
  width?: string | number;
  /** Height of the skeleton (default: 1rem) */
  height?: string | number;
  /** Border radius override (uses --orqui-skeleton-radius by default) */
  borderRadius?: string;
  /** Custom className */
  className?: string;
  /** Custom inline styles */
  style?: CSSProperties;
  /** Number of skeleton lines to render */
  count?: number;
  /** If true, renders as a circle */
  circle?: boolean;
  /** Children to wrap (skeleton shows while loading) */
  children?: ReactNode;
  /** If true, shows skeleton; if false, shows children */
  loading?: boolean;
}

/**
 * Skeleton component that respects Orqui contract configuration.
 * 
 * The animation, colors, and border-radius are controlled by CSS vars:
 * - --orqui-skeleton-base
 * - --orqui-skeleton-highlight
 * - --orqui-skeleton-radius
 * - --orqui-skeleton-duration
 * 
 * These are set by the layout.structure.skeleton config in the contract.
 * 
 * Usage:
 * ```tsx
 * // Single skeleton
 * <Skeleton width={200} height={20} />
 * 
 * // Multiple lines
 * <Skeleton count={3} />
 * 
 * // Circle (avatar)
 * <Skeleton circle width={40} height={40} />
 * 
 * // Conditional loading
 * <Skeleton loading={isLoading}>
 *   <ActualContent />
 * </Skeleton>
 * ```
 */
export function Skeleton({
  width = "100%",
  height = "1rem",
  borderRadius,
  className = "",
  style = {},
  count = 1,
  circle = false,
  children,
  loading = true,
}: SkeletonProps) {
  // If not loading and has children, render children
  if (!loading && children) {
    return <>{children}</>;
  }

  const baseStyle: CSSProperties = {
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
    borderRadius: circle ? "50%" : borderRadius,
    display: "block",
    ...style,
  };

  if (count === 1) {
    return (
      <span
        data-orqui-skeleton
        className={className}
        style={baseStyle}
        aria-hidden="true"
      />
    );
  }

  // Multiple skeletons
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          data-orqui-skeleton
          className={className}
          style={{
            ...baseStyle,
            // Last item is typically shorter (looks more natural)
            width: i === count - 1 && typeof width === "string" && width === "100%" ? "75%" : baseStyle.width,
          }}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

/**
 * SkeletonText — renders skeleton lines mimicking text paragraphs
 */
export function SkeletonText({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {Array.from({ length: lines }).map((_, i) => (
        <span
          key={i}
          data-orqui-skeleton
          style={{
            height: "0.875rem",
            width: i === lines - 1 ? "60%" : "100%",
            display: "block",
          }}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

/**
 * SkeletonCard — renders a card-shaped skeleton
 */
export function SkeletonCard({
  width = "100%",
  height = 200,
  className = "",
}: {
  width?: string | number;
  height?: string | number;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        padding: "1rem",
        borderRadius: "var(--orqui-borderRadius-lg, 8px)",
        border: "1px solid var(--orqui-colors-border, #2e3135)",
        background: "var(--orqui-colors-surface, #18191b)",
      }}
    >
      {/* Header area */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
        <Skeleton circle width={40} height={40} />
        <div style={{ flex: 1 }}>
          <Skeleton width="60%" height={14} style={{ marginBottom: "0.5rem" }} />
          <Skeleton width="40%" height={10} />
        </div>
      </div>
      {/* Content area */}
      <SkeletonText lines={3} />
    </div>
  );
}
