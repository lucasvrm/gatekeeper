// ============================================================================
// Persistence: API for filesystem save
// ============================================================================
export async function apiLoadContracts() {
  try {
    const res = await fetch("/__orqui/api/contracts");
    if (!res.ok) return null;
    const data = await res.json();
    return data.contracts || null;
  } catch { return null; }
}

export async function apiSaveContract(contract: any) {
  const type = contract.$orqui?.schema;
  if (!type) return { ok: false, error: "missing $orqui.schema" };
  try {
    const res = await fetch(`/__orqui/api/contract/${type}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contract }),
    });
    return await res.json();
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
