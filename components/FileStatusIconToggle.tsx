import React from "react";
import { CheckCircle2, Clock, CircleOff } from "lucide-react";
import type { FileStatus } from "../types";

const ORDER: FileStatus[] = ["ACTIVO", "PENDIENTE", "INACTIVO"];

const ICONS: Record<FileStatus, React.ElementType> = {
  ACTIVO: CheckCircle2,
  PENDIENTE: Clock,
  INACTIVO: CircleOff,
};

const LABELS: Record<FileStatus, string> = {
  ACTIVO: "Activo",
  PENDIENTE: "Pendiente",
  INACTIVO: "Inactivo",
};

function buttonClasses(active: boolean, status: FileStatus, enabled: boolean): string {
  const base =
    "inline-flex items-center justify-center rounded-full border transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-slate-900";
  const sizing = "h-7 w-7";

  if (!enabled) {
    return `${base} ${sizing} border-transparent text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-60`;
  }
  if (active) {
    if (status === "ACTIVO") {
      return `${base} ${sizing} border-green-400 bg-green-100 text-green-800 dark:border-green-600 dark:bg-green-900/50 dark:text-green-200`;
    }
    if (status === "PENDIENTE") {
      return `${base} ${sizing} border-amber-400 bg-amber-100 text-amber-800 dark:border-amber-600 dark:bg-amber-900/50 dark:text-amber-200`;
    }
    return `${base} ${sizing} border-slate-400 bg-slate-200 text-slate-700 dark:border-slate-500 dark:bg-slate-600 dark:text-slate-100`;
  }
  return `${base} ${sizing} border-transparent bg-transparent text-slate-500 hover:bg-white hover:border-slate-200 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:border-slate-600`;
}

export interface FileStatusIconToggleProps {
  value: FileStatus;
  onChange: (status: FileStatus) => void | Promise<void>;
  disabled?: boolean;
  className?: string;
}

export function FileStatusIconToggle({ value, onChange, disabled = false, className = "" }: FileStatusIconToggleProps) {
  return (
    <div
      className={`inline-flex items-center gap-0.5 rounded-full bg-slate-100 p-0.5 dark:bg-slate-800 ${className}`}
      onClick={(e) => e.stopPropagation()}
      role="group"
      aria-label="Estado del archivo"
    >
      {ORDER.map((status) => {
        const Icon = ICONS[status];
        const active = value === status;
        return (
          <button
            key={status}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            aria-label={LABELS[status]}
            title={disabled ? "No tienes permiso para cambiar el estado" : LABELS[status]}
            onClick={() => {
              if (disabled || status === value) return;
              void onChange(status);
            }}
            className={buttonClasses(active, status, !disabled)}
          >
            <Icon className="h-3.5 w-3.5 pointer-events-none" />
          </button>
        );
      })}
    </div>
  );
}
