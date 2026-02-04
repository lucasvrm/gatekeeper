// ============================================================================
// Persistence: API for filesystem save
//
// SANDBOX MODE:
// When the editor runs inside a sandbox (window.__ORQUI_SANDBOX__),
// all API calls include ?sandbox={name} so the Vite plugin routes
// reads/writes to .orqui-sandbox/{name}/ instead of contracts/.
// ============================================================================

declare global {
  interface Window {
    __ORQUI_SANDBOX__: { name: string; from: string } | null;
  }
}

/** Get the sandbox query string suffix, or empty string for production */
function sandboxQS(): string {
  const sb = typeof window !== "undefined" && window.__ORQUI_SANDBOX__;
  return sb ? `?sandbox=${encodeURIComponent(sb.name)}` : "";
}

/** Get the current sandbox info (or null if production) */
export function getSandboxInfo(): { name: string; from: string } | null {
  return (typeof window !== "undefined" && window.__ORQUI_SANDBOX__) || null;
}

export async function apiLoadContracts() {
  try {
    const res = await fetch(`/__orqui/api/contracts${sandboxQS()}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.contracts || null;
  } catch { return null; }
}

export async function apiSaveContract(contract: any) {
  const type = contract.$orqui?.schema;
  if (!type) return { ok: false, error: "missing $orqui.schema" };
  try {
    const res = await fetch(`/__orqui/api/contract/${type}${sandboxQS()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contract }),
    });
    return await res.json();
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ── Sandbox management ─────────────────────────────────────────────────────

export async function apiListSandboxes(): Promise<{ name: string; files: number; pageCount: number }[]> {
  try {
    const res = await fetch("/__orqui/api/sandboxes");
    if (!res.ok) return [];
    const data = await res.json();
    return data.sandboxes || [];
  } catch { return []; }
}

export async function apiDeleteSandbox(name: string) {
  try {
    const res = await fetch(`/__orqui/api/sandbox/${encodeURIComponent(name)}`, { method: "DELETE" });
    return await res.json();
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function apiResetSandbox(name: string, from = "prod") {
  try {
    const res = await fetch(`/__orqui/api/sandbox/${encodeURIComponent(name)}/reset?from=${encodeURIComponent(from)}`, { method: "POST" });
    return await res.json();
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function apiLoadContractIntoSandbox(name: string, contract: any) {
  try {
    const res = await fetch(`/__orqui/api/sandbox/${encodeURIComponent(name)}/load`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(contract),
    });
    return await res.json();
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
