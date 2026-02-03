// ============================================================================
// Orqui Editor — Entry Point
//
// FIX: Detects if we're running inside the Easyblocks canvas iframe
// BEFORE mounting the full OrquiEditor. This is critical because
// Easyblocks requires "a blank canvas with EasyblocksEditor being
// a single component rendered" — no headers, footers, or navigation.
//
// When the iframe loads /__orqui, we skip the entire OrquiEditor shell
// and render only the EasyblocksEditor in child mode (which becomes
// the canvas renderer).
// ============================================================================

import { createRoot } from "react-dom/client";

/**
 * Detect if we're inside the Easyblocks canvas iframe.
 *
 * Easyblocks sets `window.isShopstoryEditor = true` on the parent window
 * before creating the iframe. By the time the iframe's JS executes,
 * this flag is guaranteed to be set (the parent's useEffect runs and
 * the iframe is created in a subsequent render cycle).
 */
function isEasyblocksCanvasIframe(): boolean {
  try {
    return (
      window.self !== window.parent &&
      !!(window.parent as any).isShopstoryEditor
    );
  } catch {
    // Cross-origin iframe — we're not the Easyblocks canvas
    return false;
  }
}

const root = document.getElementById("orqui-root");
if (root) {
  if (isEasyblocksCanvasIframe()) {
    // ── IFRAME MODE ──────────────────────────────────────────────────
    // Render ONLY the Easyblocks canvas entry — no OrquiEditor shell.
    // Dynamic import keeps the main bundle clean.
    import("./easyblocks/CanvasEntry").then(({ EasyblocksCanvasEntry }) => {
      createRoot(root).render(<EasyblocksCanvasEntry />);
    });
  } else {
    // ── NORMAL MODE ──────────────────────────────────────────────────
    // Full OrquiEditor with topbar, mode switcher, Shell & Tokens, etc.
    import("./OrquiEditor").then(({ OrquiEditor }) => {
      createRoot(root).render(<OrquiEditor />);
    });
  }
}
