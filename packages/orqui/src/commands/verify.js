import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { verifyHash } from "../hash.js";
import { readLock } from "../lock.js";

export function verify() {
  const contractsDir = join(process.cwd(), "contracts");

  console.log("\n  ⬡ Orqui — Verifying integrity\n");

  if (!existsSync(contractsDir)) {
    console.log("  ✕  contracts/ not found. Run 'npx orqui init'.\n");
    process.exit(1);
  }

  const lock = readLock(contractsDir);
  const files = readdirSync(contractsDir).filter(f => f.endsWith(".json") && f !== "orqui.lock.json");
  let allOk = true, count = 0;

  for (const file of files) {
    let contract;
    try { contract = JSON.parse(readFileSync(join(contractsDir, file), "utf-8")); } catch (e) {
      console.log(`  ✕  ${file} — invalid JSON`); allOk = false; continue;
    }
    if (!contract.$orqui) continue;
    count++;

    const h = verifyHash(contract);
    if (!h.valid) {
      console.log(`  ✕  ${file} — hash mismatch (tampered?)`);
      console.log(`     expected: ${h.expected}`);
      console.log(`     actual:   ${h.actual}`);
      allOk = false; continue;
    }

    const le = lock.contracts?.[contract.$orqui.schema];
    if (le && le.hash !== contract.$orqui.hash) {
      console.log(`  ✕  ${file} — doesn't match lock file`);
      allOk = false; continue;
    }

    console.log(`  ✓  ${file} — v${contract.$orqui.version} — OK`);
  }

  console.log(allOk && count > 0 ? `\n  All ${count} contract(s) OK.\n` : !allOk ? "\n  Issues found.\n" : "\n  No contracts.\n");
}
