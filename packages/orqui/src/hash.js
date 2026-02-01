import { createHash } from "node:crypto";

export function sortKeysRecursively(obj) {
  if (Array.isArray(obj)) return obj.map(sortKeysRecursively);
  if (obj !== null && typeof obj === "object") {
    const sorted = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = sortKeysRecursively(obj[key]);
    }
    return sorted;
  }
  return obj;
}

export function computeHash(data) {
  const sorted = sortKeysRecursively(data);
  const canonical = JSON.stringify(sorted);
  return "sha256:" + createHash("sha256").update(canonical).digest("hex");
}

export function verifyHash(contract) {
  const { $orqui, ...data } = contract;
  const expected = $orqui?.hash;
  if (!expected) return { valid: false, reason: "missing $orqui.hash" };
  const actual = computeHash(data);
  return { valid: actual === expected, expected, actual };
}
