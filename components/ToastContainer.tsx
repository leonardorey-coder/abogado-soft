import React, { useEffect, useRef, useState } from "react";
import { useToast, type Toast } from "../contexts/ToastContext";
import { CheckCircle, AlertCircle, Info, AlertTriangle, X, Undo2 } from "lucide-react";

// ─── Single Toast item ─────────────────────────────────────────────────────

const ICON_MAP: Record<Toast["type"], React.ReactNode> = {
  success: <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />,
  error: <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />,
  info: <Info className="w-4 h-4 text-blue-500 shrink-0" />,
};

const BG_MAP: Record<Toast["type"], string> = {
  success: "border-l-emerald-500",
  error: "border-l-red-500",
  warning: "border-l-amber-500",
  info: "border-l-blue-500",
};

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onRemove }) => {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const startTime = useRef(Date.now());
  const duration = toast.duration ?? 5000;

  // Animate slide-in
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // Progress bar
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime.current;
      const pct = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(pct);
      if (pct <= 0) clearInterval(interval);
    }, 50);
    return () => clearInterval(interval);
  }, [duration]);

  const handleAction = () => {
    if (toast.action) {
      toast.action();
      // Small delay to let the action register before dismissing
      setTimeout(() => onRemove(toast.id), 100);
    }
  };

  return (
    <div
      className={`
        relative flex flex-col gap-1 w-full max-w-sm
        bg-white dark:bg-slate-800 rounded-xl shadow-lg
        border border-slate-200 dark:border-slate-700
        border-l-4 ${BG_MAP[toast.type]}
        transition-all duration-300 ease-out overflow-hidden
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
      `}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3 px-4 pt-3.5 pb-2.5">
        {ICON_MAP[toast.type]}
        <p className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-100 leading-snug">
          {toast.message}
        </p>
        <button
          type="button"
          onClick={() => onRemove(toast.id)}
          className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shrink-0 -mr-1 -mt-0.5"
          aria-label="Cerrar notificación"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {toast.action && toast.actionLabel && (
        <div className="px-4 pb-2.5 pt-0">
          <button
            type="button"
            onClick={handleAction}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-100 transition-colors"
          >
            <Undo2 className="w-3 h-3" />
            {toast.actionLabel}
          </button>
        </div>
      )}

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-100 dark:bg-slate-700">
        <div
          className="h-full bg-slate-400 dark:bg-slate-500 transition-all ease-linear"
          style={{ width: `${progress}%`, transitionDuration: "50ms" }}
        />
      </div>
    </div>
  );
};

// ─── Container ─────────────────────────────────────────────────────────────

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  return (
    <div
      className="fixed bottom-6 right-4 z-[9999] flex flex-col-reverse gap-2 items-end pointer-events-none"
      aria-label="Notificaciones"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onRemove={removeToast} />
        </div>
      ))}
    </div>
  );
};
