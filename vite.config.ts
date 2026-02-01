import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, PluginOption } from "vite";

import sparkPlugin from "@github/spark/spark-vite-plugin";
import createIconImportProxy from "@github/spark/vitePhosphorIconProxyPlugin";
import { resolve } from 'path'

import { orquiVitePlugin } from "@orqui/cli/vite"

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    createIconImportProxy() as PluginOption,
    sparkPlugin() as PluginOption,
    orquiVitePlugin(),
  ],
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src'),
      "@orqui/runtime": resolve(projectRoot, "packages/orqui/src/runtime.tsx"),
    }
  },
});
