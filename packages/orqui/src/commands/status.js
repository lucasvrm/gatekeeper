import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { readLock } from "../lock.js";

export function status() {
  const contractsDir = join(process.cwd(), "contracts");

  console.log("\n  ⬡ Orqui — Status\n");

  if (!existsSync(contractsDir)) {
    console.log("  Not initialized. Run 'npx orqui init'.\n");
    process.exit(1);
  }

  const lock = readLock(contractsDir);
  const files = readdirSync(contractsDir).filter(f => f.endsWith(".json") && f !== "orqui.lock.json");

  for (const file of files) {
    let c;
    try { c = JSON.parse(readFileSync(join(contractsDir, file), "utf-8")); } catch { console.log(`  ${file}  ✕ invalid`); continue; }
    if (!c.$orqui) continue;

    const le = lock.contracts?.[c.$orqui.schema];
    const ok = le?.hash === c.$orqui.hash ? "✓" : "⚠";
    const regions = c.structure?.regions ? Object.values(c.structure.regions).filter(r => r.enabled).length : null;
    const components = c.components ? Object.keys(c.components).length : null;
    const textStyles = c.textStyles ? Object.keys(c.textStyles).length : null;
    const stats = [regions !== null && `${regions} regions`, components !== null && `${components} components`, textStyles !== null && `${textStyles} text styles`].filter(Boolean).join(", ");

    console.log(`  ${file.padEnd(30)} v${c.$orqui.version}  ${ok}  ${stats ? `(${stats})` : ""}`);
  }
  console.log("");
}
