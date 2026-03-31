import React, { createContext, useContext, useState, useCallback, useRef } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  action?: () => void;
  actionLabel?: string;
  duration?: number; // ms, default 5000
}

interface ToastContextValue {
  addToast: (opts: Omit<Toast, "id">) => string;
  removeToast: (id: string) => void;
  toasts: Toast[];
}

// ─── Context ───────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

// ─── Provider ──────────────────────────────────────────────────────────────

const MAX_VISIBLE_TOASTS = 3;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timers.current.has(id)) {
      clearTimeout(timers.current.get(id)!);
      timers.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (opts: Omit<Toast, "id">): string => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const duration = opts.duration ?? 5000;

      setToasts((prev) => {
        const next = [...prev, { ...opts, id }];
        // Limitar a MAX_VISIBLE_TOASTS; remover el más antiguo si se supera
        if (next.length > MAX_VISIBLE_TOASTS) {
          const removed = next.splice(0, next.length - MAX_VISIBLE_TOASTS);
          removed.forEach((t) => {
            if (timers.current.has(t.id)) {
              clearTimeout(timers.current.get(t.id)!);
              timers.current.delete(t.id);
            }
          });
        }
        return next;
      });

      // Auto-dismiss
      const timer = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        timers.current.delete(id);
      }, duration);
      timers.current.set(id, timer);

      return id;
    },
    []
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
};
