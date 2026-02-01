import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const LOCK_FILE = "orqui.lock.json";

export function getLockPath(contractsDir) {
  return join(contractsDir, LOCK_FILE);
}

export function readLock(contractsDir) {
  const lockPath = getLockPath(contractsDir);
  if (!existsSync(lockPath)) return { contracts: {} };
  return JSON.parse(readFileSync(lockPath, "utf-8"));
}

export function writeLock(contractsDir, lock) {
  const lockPath = getLockPath(contractsDir);
  writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");
}

export function updateLockEntry(contractsDir, type, contract) {
  const lock = readLock(contractsDir);
  lock.contracts[type] = {
    version: contract.$orqui.version,
    hash: contract.$orqui.hash,
    updatedAt: new Date().toISOString(),
  };
  writeLock(contractsDir, lock);
}
