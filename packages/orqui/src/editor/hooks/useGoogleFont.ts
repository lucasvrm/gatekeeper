import { useEffect } from "react";

export const _loadedFonts = new Set<string>();
export function loadGoogleFont(family: string) {
  if (!family || _loadedFonts.has(family)) return;
  _loadedFonts.add(family);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@300;400;500;600;700&display=swap`;
  document.head.appendChild(link);
}

// Load a font on demand when referenced
export function useGoogleFont(family: string | undefined) {
  useEffect(() => {
    if (family) loadGoogleFont(family);
  }, [family]);
}
