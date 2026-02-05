// ============================================================================
// Orqui Editor — Entry Point
// ============================================================================

import { createRoot } from "react-dom/client";

const root = document.getElementById("orqui-root");
if (root) {
  import("./OrquiEditor").then(({ OrquiEditor }) => {
    createRoot(root).render(<OrquiEditor />);
  });
}
