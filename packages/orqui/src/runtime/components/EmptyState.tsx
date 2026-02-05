// ============================================================================
// Orqui Runtime — EmptyState Component
// Uses CSS vars from layout.structure.emptyState configuration
// ============================================================================
import React from "react";
import type { CSSProperties, ReactNode } from "react";
import { useContract } from "../context.js";
import { PHOSPHOR_SVG_PATHS } from "../icons.js";

export interface EmptyStateProps {
  /** Override icon (uses contract default if not provided) */
  icon?: string | ReactNode;
  /** Override title (uses contract default if not provided) */
  title?: string;
  /** Override description (uses contract default if not provided) */
  description?: string;
  /** Override action button label (uses contract default if not provided) */
  actionLabel?: string;
  /** Show action button (uses contract default if not provided) */
  showAction?: boolean;
  /** Action button click handler */
  onAction?: () => void;
  /** Action button variant */
  actionVariant?: "default" | "outline" | "ghost";
  /** Custom className */
  className?: string;
  /** Custom inline styles */
  style?: CSSProperties;
  /** Size variant */
  size?: "sm" | "md" | "lg";
}

/**
 * EmptyState component that respects Orqui contract configuration.
 * 
 * Default values come from layout.structure.emptyState in the contract:
 * - icon
 * - title
 * - description
 * - showAction
 * - actionLabel
 * 
 * Usage:
 * ```tsx
 * // Use contract defaults
 * <EmptyState onAction={() => createNew()} />
 * 
 * // Override specific props
 * <EmptyState
 *   title="No projects found"
 *   description="Create your first project to get started"
 *   actionLabel="New Project"
 *   onAction={() => navigate('/projects/new')}
 * />
 * ```
 */
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  showAction,
  onAction,
  actionVariant = "default",
  className = "",
  style = {},
  size = "md",
}: EmptyStateProps) {
  const { layout } = useContract();
  const config = layout.structure?.emptyState || {};

  // Resolve values: prop > config > fallback
  const resolvedIcon = icon ?? config.icon ?? "ph:magnifying-glass";
  const resolvedTitle = title ?? config.title ?? "Nenhum item encontrado";
  const resolvedDescription = description ?? config.description ?? "";
  const resolvedShowAction = showAction ?? config.showAction ?? true;
  const resolvedActionLabel = actionLabel ?? config.actionLabel ?? "Criar Novo";

  // Size mappings
  const sizeMap = {
    sm: { icon: 32, title: "0.875rem", desc: "0.75rem", gap: "0.75rem", padding: "1.5rem" },
    md: { icon: 48, title: "1rem", desc: "0.875rem", gap: "1rem", padding: "2rem" },
    lg: { icon: 64, title: "1.25rem", desc: "1rem", gap: "1.25rem", padding: "3rem" },
  };
  const sz = sizeMap[size];

  // Render icon
  const renderIcon = () => {
    if (React.isValidElement(resolvedIcon)) {
      return resolvedIcon;
    }

    // Try to resolve as Phosphor icon
    const iconName = String(resolvedIcon).replace("ph:", "");
    const path = PHOSPHOR_SVG_PATHS[iconName as keyof typeof PHOSPHOR_SVG_PATHS];

    if (path) {
      return (
        <svg
          width={sz.icon}
          height={sz.icon}
          viewBox="0 0 256 256"
          fill="currentColor"
          style={{ opacity: 0.4 }}
        >
          <path d={path} />
        </svg>
      );
    }

    // Fallback: render as emoji or text
    return (
      <span style={{ fontSize: sz.icon, opacity: 0.4 }}>
        {resolvedIcon}
      </span>
    );
  };

  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: sz.padding,
        gap: sz.gap,
        color: "var(--orqui-colors-text-muted, #b0b4ba)",
        ...style,
      }}
    >
      {/* Icon */}
      <div style={{ color: "var(--orqui-colors-text-dim, #696e77)" }}>
        {renderIcon()}
      </div>

      {/* Title */}
      {resolvedTitle && (
        <h3
          style={{
            fontSize: sz.title,
            fontWeight: 600,
            color: "var(--orqui-colors-text, #edeef0)",
            margin: 0,
          }}
        >
          {resolvedTitle}
        </h3>
      )}

      {/* Description */}
      {resolvedDescription && (
        <p
          style={{
            fontSize: sz.desc,
            color: "var(--orqui-colors-text-muted, #b0b4ba)",
            margin: 0,
            maxWidth: "24rem",
            lineHeight: 1.5,
          }}
        >
          {resolvedDescription}
        </p>
      )}

      {/* Action button */}
      {resolvedShowAction && onAction && (
        <button
          onClick={onAction}
          style={{
            marginTop: "0.5rem",
            padding: "0.5rem 1rem",
            fontSize: sz.desc,
            fontWeight: 500,
            borderRadius: "var(--orqui-borderRadius-md, 6px)",
            cursor: "pointer",
            transition: "all 0.15s",
            ...(actionVariant === "default"
              ? {
                  background: "var(--orqui-colors-accent, #0090ff)",
                  color: "#fff",
                  border: "none",
                }
              : actionVariant === "outline"
              ? {
                  background: "transparent",
                  color: "var(--orqui-colors-accent, #0090ff)",
                  border: "1px solid var(--orqui-colors-accent, #0090ff)",
                }
              : {
                  background: "transparent",
                  color: "var(--orqui-colors-text-muted, #b0b4ba)",
                  border: "none",
                }),
          }}
        >
          {resolvedActionLabel}
        </button>
      )}
    </div>
  );
}

/**
 * EmptyState for tables/lists — more compact variant
 */
export function EmptyTableState({
  icon,
  title,
  description,
  colSpan = 1,
  onAction,
  actionLabel,
}: Omit<EmptyStateProps, "size" | "className" | "style"> & { colSpan?: number }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ padding: 0 }}>
        <EmptyState
          icon={icon}
          title={title}
          description={description}
          onAction={onAction}
          actionLabel={actionLabel}
          size="sm"
          style={{ padding: "2rem 1rem" }}
        />
      </td>
    </tr>
  );
}
