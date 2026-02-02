import type { Tokens, TextStyle } from "../types/contracts";

export function sortKeysRecursively(obj: any): any {
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

export async function computeHash(data: any) {
  const sorted = sortKeysRecursively(data);
  const canonical = JSON.stringify(sorted);
  const encoded = new TextEncoder().encode(canonical);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return "sha256:" + hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function resolveToken(ref: string | undefined, tokens: Tokens) {
  if (!ref || !ref.startsWith("$tokens.")) return undefined;
  const parts = ref.replace("$tokens.", "").split(".");
  const cat = parts[0];
  const key = parts.slice(1).join(".");
  const tok = tokens?.[cat]?.[key];
  if (!tok) return undefined;
  return `${tok.value}${tok.unit}`;
}

export function resolveTokenNum(ref: string | undefined, tokens: Tokens) {
  if (!ref || !ref.startsWith("$tokens.")) return 0;
  const parts = ref.replace("$tokens.", "").split(".");
  const cat = parts[0];
  const key = parts.slice(1).join(".");
  return tokens?.[cat]?.[key]?.value || 0;
}

export function resolveTextStyleCSS(style: TextStyle, tokens: Tokens) {
  const result = {};
  if (style.fontFamily) {
    const ref = style.fontFamily.replace("$tokens.fontFamilies.", "");
    const fam = tokens.fontFamilies?.[ref];
    if (fam) result.fontFamily = `'${fam.family}', ${fam.fallbacks.join(", ")}`;
  }
  if (style.fontSize) {
    const ref = style.fontSize.replace("$tokens.fontSizes.", "");
    const tok = tokens.fontSizes?.[ref];
    if (tok) result.fontSize = `${tok.value}${tok.unit}`;
  }
  if (style.fontWeight) {
    const ref = style.fontWeight.replace("$tokens.fontWeights.", "");
    const tok = tokens.fontWeights?.[ref];
    if (tok) result.fontWeight = tok.value;
  }
  if (style.lineHeight) {
    const ref = style.lineHeight.replace("$tokens.lineHeights.", "");
    const tok = tokens.lineHeights?.[ref];
    if (tok) result.lineHeight = tok.value;
  }
  if (style.letterSpacing) {
    const ref = style.letterSpacing.replace("$tokens.letterSpacings.", "");
    const tok = tokens.letterSpacings?.[ref];
    if (tok) result.letterSpacing = `${tok.value}${tok.unit}`;
  }
  return result;
}
