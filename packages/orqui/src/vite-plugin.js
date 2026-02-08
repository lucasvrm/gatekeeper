import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { computeHash, verifyHash } from "./hash.js";
import { readLock, updateLockEntry } from "./lock.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EDITOR_ENTRY = join(__dirname, "editor", "entry.tsx");

// ============================================================================
// Sandbox helpers
// ============================================================================

const SANDBOX_DIR_NAME = ".orqui-sandbox";

/** Validate sandbox name — alphanumeric, dashes, underscores only */
function isValidSandboxName(name) {
  return /^[\w-]{1,64}$/.test(name);
}

/** Resolve the sandbox directory for a given name */
function resolveSandboxDir(root, name) {
  return join(root, SANDBOX_DIR_NAME, name);
}

/**
 * Seed a sandbox directory from a source.
 *
 * @param {string} sandboxDir - Target sandbox directory
 * @param {string} source - "prod", "preset:{name}", or "empty"
 * @param {string} prodDir - Production contracts directory
 * @param {string} presetsDir - Presets base directory
 */
function seedSandbox(sandboxDir, source, prodDir, presetsDir) {
  mkdirSync(sandboxDir, { recursive: true });

  if (source === "empty") {
    const empty = {
      $orqui: { schema: "layout-contract", version: "2.0.0", hash: "", generatedAt: new Date().toISOString(), pageCount: 0 },
      structure: {},
      tokens: {},
      textStyles: {},
      pages: {},
    };
    writeFileSync(join(sandboxDir, "layout-contract.json"), JSON.stringify(empty, null, 2) + "\n");
    return;
  }

  let srcDir;
  if (source.startsWith("preset:")) {
    const presetName = source.slice("preset:".length);
    srcDir = join(presetsDir, presetName);
    if (!existsSync(srcDir)) {
      throw new Error(`Preset "${presetName}" not found at ${srcDir}`);
    }
  } else {
    srcDir = prodDir;
  }

  if (!existsSync(srcDir)) {
    throw new Error(`Source directory not found: ${srcDir}`);
  }

  const files = readdirSync(srcDir).filter(f => f.endsWith(".json") && f !== "orqui.lock.json");
  for (const file of files) {
    copyFileSync(join(srcDir, file), join(sandboxDir, file));
  }
}

/**
 * Orqui Vite Plugin
 *
 * Serves the Orqui editor at /__orqui using the host's Vite pipeline.
 * No build step — Vite compiles the TSX on-the-fly.
 *
 * SANDBOX MODE:
 *   /__orqui?sandbox=my-test          → isolated sandbox seeded from prod
 *   /__orqui?sandbox=crm&from=empty   → empty sandbox
 *   /__orqui?sandbox=x&from=preset:gatekeeper → seeded from preset
 *
 *   All API calls in sandbox mode operate on .orqui-sandbox/{name}/
 *   instead of contracts/. Production contracts are never touched.
 *
 *   API:
 *     GET  /__orqui/api/sandboxes              → list sandboxes
 *     DELETE /__orqui/api/sandbox/:name         → delete sandbox
 *     POST /__orqui/api/sandbox/:name/reset     → re-seed from source
 *     POST /__orqui/api/sandbox/:name/load      → load contract JSON into sandbox
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
      const resolvePresets = () => join(__dirname, "..", "presets");

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/__orqui")) return next();

        // ── Parse URL and query params ───────────────────────────────
        const urlObj = new URL(req.url, "http://localhost");
        const pathname = urlObj.pathname;
        const sandbox = urlObj.searchParams.get("sandbox");
        const seedFrom = urlObj.searchParams.get("from") || "prod";

        const prodDir = resolveContracts();
        if (!existsSync(prodDir)) mkdirSync(prodDir, { recursive: true });

        // ── Resolve working directory (sandbox or prod) ──────────────
        let contractsDir = prodDir;
        let isSandbox = false;

        if (sandbox) {
          if (!isValidSandboxName(sandbox)) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Invalid sandbox name. Use alphanumeric, dashes, underscores (max 64 chars)." }));
            return;
          }
          isSandbox = true;
          contractsDir = resolveSandboxDir(server.config.root, sandbox);

          // Auto-seed on first access
          if (!existsSync(contractsDir)) {
            try {
              seedSandbox(contractsDir, seedFrom, prodDir, resolvePresets());
              console.log(`[orqui] 🧪 Sandbox "${sandbox}" created (from: ${seedFrom})`);
            } catch (e) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: `Failed to seed sandbox: ${e.message}` }));
              return;
            }
          }
        }

        // ── Serve editor HTML ────────────────────────────────────────
        if (pathname === "/__orqui" || pathname === "/__orqui/") {
          const sandboxScript = isSandbox
            ? `<script>window.__ORQUI_SANDBOX__ = ${JSON.stringify({ name: sandbox, from: seedFrom })};</script>`
            : `<script>window.__ORQUI_SANDBOX__ = null;</script>`;

          const rawHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Orqui${isSandbox ? ` \u2014 \uD83E\uDDEA ${sandbox}` : ""} \u2014 Contract Editor</title>
  <style>* { margin: 0; padding: 0; box-sizing: border-box; }</style>
</head>
<body>
  ${sandboxScript}
  <div id="orqui-root"></div>
  <script type="module" src="/@fs/${EDITOR_ENTRY}"></script>
</body>
</html>`;
          const html = await server.transformIndexHtml(req.url, rawHtml);
          res.setHeader("Content-Type", "text/html");
          res.end(html);
          return;
        }

        // ── API ──────────────────────────────────────────────────────
        if (!pathname.startsWith("/__orqui/api")) return next();
        const apiPath = pathname.replace("/__orqui/api", "");
        res.setHeader("Content-Type", "application/json");

        // ── Sandbox management endpoints ─────────────────────────────

        // GET /sandboxes — list all sandboxes
        if (apiPath === "/sandboxes" && req.method === "GET") {
          const sbRoot = join(server.config.root, SANDBOX_DIR_NAME);
          const sandboxes = [];
          if (existsSync(sbRoot)) {
            for (const name of readdirSync(sbRoot)) {
              const sbDir = join(sbRoot, name);
              try {
                const files = readdirSync(sbDir).filter(f => f.endsWith(".json"));
                const hasLayout = files.includes("layout-contract.json");
                let pageCount = 0;
                if (hasLayout) {
                  try {
                    const lc = JSON.parse(readFileSync(join(sbDir, "layout-contract.json"), "utf-8"));
                    pageCount = Object.keys(lc.pages || {}).length;
                  } catch { /* JSON parse failed */ }
                }
                sandboxes.push({ name, files: files.length, pageCount });
              } catch { /* sandbox read failed */ }
            }
          }
          res.end(JSON.stringify({ sandboxes }));
          return;
        }

        // DELETE /sandbox/:name — delete a sandbox
        const deleteMatch = apiPath.match(/^\/sandbox\/([\w-]+)$/);
        if (deleteMatch && req.method === "DELETE") {
          const name = deleteMatch[1];
          const sbDir = resolveSandboxDir(server.config.root, name);
          if (existsSync(sbDir)) {
            rmSync(sbDir, { recursive: true, force: true });
            console.log(`[orqui] 🗑️  Sandbox "${name}" deleted`);
            res.end(JSON.stringify({ ok: true, deleted: name }));
          } else {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: `Sandbox "${name}" not found` }));
          }
          return;
        }

        // POST /sandbox/:name/reset — re-seed a sandbox
        const resetMatch = apiPath.match(/^\/sandbox\/([\w-]+)\/reset$/);
        if (resetMatch && req.method === "POST") {
          const name = resetMatch[1];
          const sbDir = resolveSandboxDir(server.config.root, name);
          if (existsSync(sbDir)) rmSync(sbDir, { recursive: true, force: true });
          try {
            seedSandbox(sbDir, seedFrom, prodDir, resolvePresets());
            console.log(`[orqui] 🔄 Sandbox "${name}" reset (from: ${seedFrom})`);
            res.end(JSON.stringify({ ok: true, reset: name, from: seedFrom }));
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
          return;
        }

        // POST /sandbox/:name/load — upload a contract into a sandbox
        const loadMatch = apiPath.match(/^\/sandbox\/([\w-]+)\/load$/);
        if (loadMatch && req.method === "POST") {
          const name = loadMatch[1];
          const sbDir = resolveSandboxDir(server.config.root, name);
          if (!existsSync(sbDir)) mkdirSync(sbDir, { recursive: true });

          let body = "";
          req.on("data", chunk => body += chunk);
          req.on("end", () => {
            try {
              const contract = JSON.parse(body);
              const schema = contract.$orqui?.schema;
              if (!schema) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Contract must have $orqui.schema" }));
                return;
              }
              writeFileSync(join(sbDir, `${schema}.json`), JSON.stringify(contract, null, 2) + "\n");
              console.log(`[orqui] 📦 Loaded ${schema} into sandbox "${name}"`);
              res.end(JSON.stringify({ ok: true, sandbox: name, schema }));
            } catch (e) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
          return;
        }

        // ── Standard contract CRUD (operates on contractsDir) ────────

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
          res.end(JSON.stringify({ contracts, sandbox: isSandbox ? sandbox : null }));
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

              const { $orqui, ...rest } = c;
              c.$orqui.hash = computeHash(rest);

              writeFileSync(join(contractsDir, `${postMatch[1]}.json`), JSON.stringify(c, null, 2) + "\n");

              // Only update lock for production (sandbox is ephemeral)
              if (!isSandbox) {
                updateLockEntry(contractsDir, postMatch[1], c);
              }

              res.end(JSON.stringify({ ok: true, version: c.$orqui.version, hash: c.$orqui.hash, sandbox: isSandbox ? sandbox : null }));
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
          res.end(JSON.stringify({ results, sandbox: isSandbox ? sandbox : null }));
          return;
        }

        next();
      });
    },
  };
}
