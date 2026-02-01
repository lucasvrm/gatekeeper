import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { computeHash, verifyHash } from "./hash.js";
import { readLock, updateLockEntry } from "./lock.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EDITOR_ENTRY = join(__dirname, "editor", "entry.tsx");

/**
 * Orqui Vite Plugin
 *
 * Serves the Orqui editor at /__orqui using the host's Vite pipeline.
 * No build step — Vite compiles the TSX on-the-fly.
 *
 * Usage:
 *   import { orquiVitePlugin } from "@orqui/cli/vite"
 *   export default defineConfig({ plugins: [orquiVitePlugin()] })
 */
export function orquiVitePlugin(options = {}) {
  const contractsPath = options.contractsDir || "contracts";

  return {
    name: "orqui",
    apply: "serve",

    configureServer(server) {
      const resolveContracts = () => join(server.config.root, contractsPath);

      // ── API routes ──────────────────────────────────────────

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/__orqui")) return next();

        const contractsDir = resolveContracts();
        if (!existsSync(contractsDir)) mkdirSync(contractsDir, { recursive: true });

        // ── Serve editor HTML ──
        if (req.url === "/__orqui" || req.url === "/__orqui/") {
          const rawHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Orqui — Contract Editor</title>
  <style>* { margin: 0; padding: 0; box-sizing: border-box; }</style>
</head>
<body>
  <div id="orqui-root"></div>
  <script type="module" src="/@fs/${EDITOR_ENTRY}"></script>
</body>
</html>`;
          const html = await server.transformIndexHtml(req.url, rawHtml);
          res.setHeader("Content-Type", "text/html");
          res.end(html);
          return;
        }

        // ── API ──
        if (!req.url.startsWith("/__orqui/api")) return next();
        const apiPath = req.url.replace("/__orqui/api", "");
        res.setHeader("Content-Type", "application/json");

        // GET /contracts
        if (apiPath === "/contracts" && req.method === "GET") {
          const files = readdirSync(contractsDir).filter(f => f.endsWith(".json") && f !== "orqui.lock.json");
          const contracts = {};
          for (const file of files) {
            try {
              const data = JSON.parse(readFileSync(join(contractsDir, file), "utf-8"));
              if (data.$orqui?.schema) contracts[data.$orqui.schema] = data;
            } catch {}
          }
          res.end(JSON.stringify({ contracts }));
          return;
        }

        // GET /contract/:type
        const getMatch = apiPath.match(/^\/contract\/([\w-]+)$/);
        if (getMatch && req.method === "GET") {
          const fp = join(contractsDir, `${getMatch[1]}.json`);
          if (existsSync(fp)) { res.end(readFileSync(fp, "utf-8")); }
          else { res.statusCode = 404; res.end(JSON.stringify({ error: "not found" })); }
          return;
        }

        // POST /contract/:type
        const postMatch = apiPath.match(/^\/contract\/([\w-]+)$/);
        if (postMatch && req.method === "POST") {
          let body = "";
          req.on("data", chunk => body += chunk);
          req.on("end", () => {
            try {
              const { contract, data, version } = JSON.parse(body);
              let c;
              if (contract) {
                c = contract;
              } else if (data) {
                const hash = computeHash(data);
                c = { $orqui: { schema: postMatch[1], version: version || "1.0.0", hash, generatedAt: new Date().toISOString() }, ...data };
              } else {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "provide { contract } or { data, version }" }));
                return;
              }

              // Recompute hash for safety
              const { $orqui, ...rest } = c;
              c.$orqui.hash = computeHash(rest);

              writeFileSync(join(contractsDir, `${postMatch[1]}.json`), JSON.stringify(c, null, 2) + "\n");
              updateLockEntry(contractsDir, postMatch[1], c);

              res.end(JSON.stringify({ ok: true, version: c.$orqui.version, hash: c.$orqui.hash }));
            } catch (e) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
          return;
        }

        // GET /verify
        if (apiPath === "/verify" && req.method === "GET") {
          const files = readdirSync(contractsDir).filter(f => f.endsWith(".json") && f !== "orqui.lock.json");
          const lock = readLock(contractsDir);
          const results = files.map(file => {
            try {
              const c = JSON.parse(readFileSync(join(contractsDir, file), "utf-8"));
              if (!c.$orqui) return null;
              const h = verifyHash(c);
              const le = lock.contracts?.[c.$orqui.schema];
              return { file, type: c.$orqui.schema, version: c.$orqui.version, hashValid: h.valid, lockMatch: le?.hash === c.$orqui.hash };
            } catch (e) { return { file, error: e.message }; }
          }).filter(Boolean);
          res.end(JSON.stringify({ results }));
          return;
        }

        next();
      });
    },
  };
}
