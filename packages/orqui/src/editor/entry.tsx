import { createRoot } from "react-dom/client";
import { OrquiEditor } from "./OrquiEditor";

const root = document.getElementById("orqui-root");
if (root) {
  createRoot(root).render(<OrquiEditor />);
}