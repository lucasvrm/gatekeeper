import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { resolve } from 'path'

import { orquiVitePlugin } from "@orqui/cli/vite"

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    orquiVitePlugin(),
  ],
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src'),
      "@orqui/runtime": resolve(projectRoot, "packages/orqui/src/runtime.tsx"),
    }
  },
});
