import { useState, useCallback, useEffect } from "react";

export function usePersistentState(key: string, defaultValue: any) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(`orqui-accordion-${key}`);
      return stored !== null ? JSON.parse(stored) : defaultValue;
    } catch { return defaultValue; }
  });
  const set = useCallback((v) => {
    setValue(v);
    try { localStorage.setItem(`orqui-accordion-${key}`, JSON.stringify(v)); } catch { /* localStorage unavailable */ }
  }, [key]);

  // Listen for force-open events from Command Palette
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      if (e.detail === key || e.detail === `wb-${key}`) {
        setValue(true);
        try { localStorage.setItem(`orqui-accordion-${key}`, "true"); } catch { /* localStorage unavailable */ }
      }
    };
    window.addEventListener("orqui:open-accordion" as any, handler);
    return () => window.removeEventListener("orqui:open-accordion" as any, handler);
  }, [key]);

  return [value, set] as const;
}

export function usePersistentTab(key: string, defaultValue: string) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(`orqui-tab-${key}`);
      return stored || defaultValue;
    } catch { return defaultValue; }
  });
  const set = useCallback((v: string) => {
    setValue(v);
    try { localStorage.setItem(`orqui-tab-${key}`, v); } catch { /* localStorage unavailable */ }
  }, [key]);
  return [value, set] as const;
}

