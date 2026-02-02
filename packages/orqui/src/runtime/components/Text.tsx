// ============================================================================
// Orqui Runtime — Text Component
// ============================================================================
import React from "react";
import type { CSSProperties, ReactNode } from "react";
import { useTextStyle } from "../context.js";

interface TextProps {
  style_name: string;
  as?: keyof JSX.IntrinsicElements;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function Text({ style_name: styleName, as: Tag = "span", children, className, style }: TextProps) {
  const css = useTextStyle(styleName);
  return <Tag className={className} style={{ ...css, ...style }} data-orqui-text={styleName}>{children}</Tag>;
}
