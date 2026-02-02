// ============================================================================
// Orqui Runtime — Logo Renderer
// ============================================================================
import React from "react";
import type { LogoConfig } from "../types.js";
import { IconValue } from "../icons.js";

export function LogoRenderer({ config, collapsed }: { config?: LogoConfig; collapsed?: boolean }) {
  if (!config) return null;
  const typo = config.typography || {};
  const pad = config.padding || {};
  const textStyle: any = {
    fontSize: typo.fontSize || 16,
    fontWeight: typo.fontWeight || 700,
    color: typo.color || "var(--foreground)",
    fontFamily: typo.fontFamily || "inherit",
    letterSpacing: typo.letterSpacing ? `${typo.letterSpacing}px` : undefined,
    whiteSpace: "nowrap",
    lineHeight: 1,
  };
  const containerStyle: any = {
    padding: `${pad.top || 0}px ${pad.right || 0}px ${pad.bottom || 0}px ${pad.left || 0}px`,
  };

  const iconSz = config.iconSize || typo.fontSize || 20;
  const iconColor = typo.color || "var(--foreground)";

  if (collapsed) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 0 }}>
        {config.type === "icon-text" && config.iconUrl ? (
          <img src={config.iconUrl} alt="" style={{ height: iconSz, objectFit: "contain", display: "block" }} />
        ) : config.type === "icon-text" && config.icon ? (
          <IconValue icon={config.icon} size={iconSz} color={iconColor} />
        ) : config.type === "image" && config.imageUrl ? (
          <img src={config.imageUrl} alt="" style={{ height: 24, objectFit: "contain", display: "block" }} />
        ) : (
          <span style={{ ...textStyle, fontSize: Math.max((typo.fontSize || 16), 16) }}>
            {(config.text || "A").charAt(0)}
          </span>
        )}
      </div>
    );
  }

  if (config.type === "image" && config.imageUrl) {
    return (
      <div style={containerStyle}>
        <img src={config.imageUrl} alt={config.text || "Logo"} style={{ height: 28, maxWidth: 160, objectFit: "contain" }} />
      </div>
    );
  }
  if (config.type === "icon-text") {
    return (
      <div style={{ ...containerStyle, display: "flex", alignItems: "center", gap: config.iconGap || 8 }}>
        {config.iconUrl ? (
          <img src={config.iconUrl} alt="" style={{ height: iconSz, objectFit: "contain" }} />
        ) : config.icon ? (
          <IconValue icon={config.icon} size={iconSz} color={iconColor} />
        ) : null}
        <span style={textStyle}>{config.text || "App"}</span>
      </div>
    );
  }
  return <div style={containerStyle}><span style={textStyle}>{config.text || "App"}</span></div>;
}
