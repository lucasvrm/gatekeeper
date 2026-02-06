// ============================================================================
// Orqui Runtime — Toast Component
// Queue-based minimal toast notifications with auto-dismiss and maxVisible
// ============================================================================
import React from "react";
import type { CSSProperties, ReactNode } from "react";
import { useToastConfig } from "../context.js";

export type ToastVariant = "default" | "success" | "warning" | "error";

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
  icon?: ReactNode;
}

export interface ToastOptions {
  id?: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
  icon?: ReactNode;
}

type ToastListener = (items: ToastItem[]) => void;

let toastQueue: ToastItem[] = [];
const listeners = new Set<ToastListener>();
let toastCounter = 0;

function notify() {
  listeners.forEach((listener) => listener(toastQueue));
}

function enqueueToast(item: ToastItem) {
  toastQueue = [...toastQueue, item];
  notify();
}

function removeToast(id: string) {
  toastQueue = toastQueue.filter((toast) => toast.id !== id);
  notify();
}

function clearToasts() {
  toastQueue = [];
  notify();
}

function subscribe(listener: ToastListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getDefaultDuration(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function useToast() {
  const config = useToastConfig();
  const defaultDuration = getDefaultDuration(config.duration, 4000);

  const toast = React.useCallback(
    (input: string | ToastOptions, options?: Partial<ToastOptions>) => {
      const base = typeof input === "string"
        ? { title: input, ...(options || {}) }
        : input;
      const id = base.id ?? `orqui-toast-${Date.now().toString(36)}-${++toastCounter}`;
      const item: ToastItem = {
        id,
        title: base.title || "Notification",
        description: base.description,
        variant: base.variant,
        duration: base.duration ?? defaultDuration,
        icon: base.icon,
      };
      enqueueToast(item);
      return id;
    },
    [defaultDuration]
  );

  const dismiss = React.useCallback((id?: string) => {
    if (id) removeToast(id);
    else clearToasts();
  }, []);

  return { toast, dismiss, clear: clearToasts };
}

export interface ToastProps {
  className?: string;
  style?: CSSProperties;
}

export function Toast({ className = "", style = {} }: ToastProps) {
  const config = useToastConfig();
  const maxVisible = typeof config.maxVisible === "number" ? config.maxVisible : 3;
  const defaultDuration = getDefaultDuration(config.duration, 4000);
  const [items, setItems] = React.useState<ToastItem[]>(() => toastQueue);
  const timersRef = React.useRef<Map<string, number>>(new Map());

  const posMap: Record<string, { top?: string; bottom?: string; left?: string; right?: string; transform?: string; align?: string }> = {
    "top-right": { top: "16px", right: "16px", align: "flex-end" },
    "top-left": { top: "16px", left: "16px", align: "flex-start" },
    "bottom-right": { bottom: "16px", right: "16px", align: "flex-end" },
    "bottom-left": { bottom: "16px", left: "16px", align: "flex-start" },
    "top-center": { top: "16px", left: "50%", transform: "translateX(-50%)", align: "center" },
    "bottom-center": { bottom: "16px", left: "50%", transform: "translateX(-50%)", align: "center" },
  };
  const position = posMap[config.position || "bottom-right"] || posMap["bottom-right"];

  React.useEffect(() => subscribe(setItems), []);

  React.useEffect(() => {
    const knownIds = new Set(items.map((item) => item.id));
    for (const [id, timer] of timersRef.current.entries()) {
      if (!knownIds.has(id)) {
        clearTimeout(timer);
        timersRef.current.delete(id);
      }
    }
  }, [items]);

  const visible = maxVisible > 0 ? items.slice(0, maxVisible) : [];

  React.useEffect(() => {
    visible.forEach((item) => {
      if (timersRef.current.has(item.id)) return;
      const duration = item.duration ?? defaultDuration;
      if (!Number.isFinite(duration) || duration <= 0) return;
      const timer = window.setTimeout(() => {
        removeToast(item.id);
      }, duration);
      timersRef.current.set(item.id, timer);
    });
  }, [visible, defaultDuration]);

  React.useEffect(() => () => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
  }, []);

  if (visible.length === 0) return null;

  const baseToastStyle: CSSProperties = {
    background: "var(--orqui-colors-surface, #18191b)",
    border: "1px solid var(--orqui-colors-border, #2e3135)",
    color: "var(--orqui-colors-text, #edeef0)",
    borderRadius: 8,
    padding: "10px 14px",
    minWidth: 240,
    maxWidth: 360,
    boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    pointerEvents: "auto",
  };

  const variantStyles: Record<ToastVariant, CSSProperties> = {
    default: {},
    success: { borderColor: "var(--orqui-colors-success, #30a46c)" },
    warning: { borderColor: "var(--orqui-colors-warning, #f5d90a)" },
    error: { borderColor: "var(--orqui-colors-danger, #e5484d)" },
  };

  return (
    <div
      data-orqui-toast-viewport=""
      className={className}
      style={{
        position: "fixed",
        top: `var(--orqui-toast-top, ${position.top || "auto"})`,
        bottom: `var(--orqui-toast-bottom, ${position.bottom || "auto"})`,
        left: `var(--orqui-toast-left, ${position.left || "auto"})`,
        right: `var(--orqui-toast-right, ${position.right || "auto"})`,
        transform: `var(--orqui-toast-transform, ${position.transform || "none"})`,
        display: "flex",
        flexDirection: "column",
        alignItems: `var(--orqui-toast-align, ${position.align || "flex-end"})`,
        gap: 10,
        zIndex: 9999,
        pointerEvents: "none",
        ...style,
      }}
      role="status"
      aria-live="polite"
    >
      {visible.map((toast) => (
        <div
          key={toast.id}
          data-orqui-toast=""
          style={{ ...baseToastStyle, ...(variantStyles[toast.variant || "default"] || {}) }}
        >
          {toast.icon && (
            <div style={{ marginTop: 2, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {toast.icon}
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: toast.description ? 2 : 0 }}>
              {toast.title}
            </div>
            {toast.description && (
              <div style={{ fontSize: 12, color: "var(--orqui-colors-text-muted, #b0b4ba)" }}>
                {toast.description}
              </div>
            )}
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            aria-label="Fechar"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--orqui-colors-text-muted, #b0b4ba)",
              cursor: "pointer",
              fontSize: 16,
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
