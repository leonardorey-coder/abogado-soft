import React, { useState, useCallback } from "react";
import { Calendar, X } from "lucide-react";

interface DateRangeFilterProps {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}

// ─── Quick presets ─────────────────────────────────────────────────────────

function toISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function getPreset(preset: "today" | "week" | "month"): { from: string; to: string } {
  const now = new Date();
  const to = toISODate(now);

  if (preset === "today") {
    return { from: to, to };
  }
  if (preset === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    return { from: toISODate(start), to };
  }
  // month
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: toISODate(start), to };
}

const PRESETS: { key: "today" | "week" | "month"; label: string }[] = [
  { key: "today", label: "Hoy" },
  { key: "week", label: "7 días" },
  { key: "month", label: "Este mes" },
];

// ─── Component ─────────────────────────────────────────────────────────────

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({ from, to, onChange }) => {
  const [open, setOpen] = useState(false);
  const hasFilter = Boolean(from || to);

  const handlePreset = useCallback(
    (preset: "today" | "week" | "month") => {
      const { from: f, to: t } = getPreset(preset);
      onChange(f, t);
      setOpen(false);
    },
    [onChange]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange("", "");
      setOpen(false);
    },
    [onChange]
  );

  const handleApply = useCallback(() => {
    setOpen(false);
  }, []);

  // Format display label
  const label = (() => {
    if (!from && !to) return "Fecha";
    if (from && to) {
      const f = new Date(from + "T00:00:00").toLocaleDateString("es-MX", { month: "short", day: "numeric" });
      const t = new Date(to + "T00:00:00").toLocaleDateString("es-MX", { month: "short", day: "numeric" });
      return f === t ? f : `${f} – ${t}`;
    }
    if (from) return `Desde ${new Date(from + "T00:00:00").toLocaleDateString("es-MX", { month: "short", day: "numeric" })}`;
    return `Hasta ${new Date(to + "T00:00:00").toLocaleDateString("es-MX", { month: "short", day: "numeric" })}`;
  })();

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`
          flex items-center gap-2 rounded-full px-4 py-2 font-bold text-sm shadow-sm transition-all shrink-0
          ${hasFilter
            ? "bg-primary text-white"
            : "bg-white dark:bg-[#1a212f] border-2 border-[#dbdfe6] dark:border-[#2d3748] text-[#111318] dark:text-white hover:border-primary"}
        `}
      >
        <Calendar className="w-4 h-4" />
        <span>{label}</span>
        {hasFilter && (
          <span
            role="button"
            tabIndex={0}
            onClick={handleClear}
            onKeyDown={(e) => { if (e.key === "Enter") handleClear(e as any); }}
            className="ml-1 w-4 h-4 rounded-full bg-white/30 hover:bg-white/50 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Limpiar filtro de fecha"
          >
            <X className="w-2.5 h-2.5 text-white" />
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div className="absolute top-full mt-2 right-0 z-[200] w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-4 flex flex-col gap-4">
            {/* Presets */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                Acceso rápido
              </p>
              <div className="flex gap-2 flex-wrap">
                {PRESETS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => handlePreset(p.key)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-primary/10 hover:text-primary dark:hover:bg-primary/20 transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date inputs */}
            <div className="flex flex-col gap-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Rango personalizado
              </p>
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Desde</label>
                  <input
                    type="date"
                    value={from}
                    max={to || undefined}
                    onChange={(e) => onChange(e.target.value, to)}
                    className="w-full h-9 px-3 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Hasta</label>
                  <input
                    type="date"
                    value={to}
                    min={from || undefined}
                    onChange={(e) => onChange(from, e.target.value)}
                    className="w-full h-9 px-3 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleClear}
                className="flex-1 py-2 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="flex-1 py-2 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-blue-700 transition-colors"
              >
                Aplicar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
