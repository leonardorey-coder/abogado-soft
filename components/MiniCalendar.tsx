// ============================================================================
// MiniCalendar — Componente de calendario minimalista reutilizable
// mode="display": muestra indicadores de pendientes + popup al click
// mode="select": selector de fecha para deadline de asignaciones
// ============================================================================

import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PendingCalendarItem {
  id: string;
  name: string;
  type: "document" | "assignment";
  docType?: string; // "DOCX" | "PDF" | "XLSX"
  status?: string;
  documentId?: string; // para navegar al documento
}

interface MiniCalendarProps {
  /** Mapa de "YYYY-MM-DD" → items pendientes. Solo en mode="display" */
  pendingByDate?: Map<string, PendingCalendarItem[]>;
  /** Modo del calendario */
  mode?: "display" | "select";
  /** Fecha seleccionada en formato "YYYY-MM-DD". Solo en mode="select" */
  selectedDate?: string | null;
  /** Callback cuando el usuario selecciona un día. Solo en mode="select" */
  onSelectDate?: (isoDate: string) => void;
  /** Callback cuando el usuario hace click en un día con pendientes. Solo en mode="display" */
  onDayClick?: (isoDate: string, items: PendingCalendarItem[]) => void;
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const WEEKDAYS = ["D", "L", "M", "M", "J", "V", "S"];
const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toLocalDateKey(date: Date): string {
  // Devuelve "YYYY-MM-DD" en hora local (evita timezone shift)
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getCalendarDays(year: number, month: number): (Date | null)[] {
  // Primer día del mes
  const firstDay = new Date(year, month, 1);
  // Último día del mes
  const lastDay = new Date(year, month + 1, 0);

  const days: (Date | null)[] = [];

  // Padding inicial (domingo = 0)
  for (let i = 0; i < firstDay.getDay(); i++) {
    days.push(null);
  }

  // Días del mes
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }

  // Padding final para completar la última fila (múltiplo de 7)
  while (days.length % 7 !== 0) {
    days.push(null);
  }

  return days;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function MiniCalendar({
  pendingByDate,
  mode = "display",
  selectedDate,
  onSelectDate,
  onDayClick,
}: MiniCalendarProps) {
  const today = new Date();
  const todayKey = toLocalDateKey(today);

  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());

  const calendarDays = useMemo(
    () => getCalendarDays(currentYear, currentMonth),
    [currentYear, currentMonth],
  );

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleDayClick = (date: Date) => {
    const key = toLocalDateKey(date);
    if (mode === "select") {
      onSelectDate?.(key);
    } else {
      const items = pendingByDate?.get(key) ?? [];
      if (items.length > 0) {
        onDayClick?.(key, items);
      }
    }
  };

  return (
    <div className="select-none">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={handlePrevMonth}
          className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
          aria-label="Mes anterior"
        >
          <ChevronLeft size={16} />
        </button>

        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {MONTHS_ES[currentMonth]} {currentYear}
        </span>

        <button
          onClick={handleNextMonth}
          className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
          aria-label="Mes siguiente"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* ── Weekday labels ── */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((day, i) => (
          <div
            key={i}
            className="text-center text-[10px] font-semibold text-slate-400 dark:text-slate-500 py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* ── Calendar grid ── */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {calendarDays.map((date, idx) => {
          if (!date) {
            return <div key={`empty-${idx}`} />;
          }

          const key = toLocalDateKey(date);
          const isToday = key === todayKey;
          const isSelected = mode === "select" && key === selectedDate;
          const pendingItems = pendingByDate?.get(key) ?? [];
          const hasPending = pendingItems.length > 0;
          const isPast = mode === "select" && date < new Date(today.setHours(0, 0, 0, 0));

          let dayClass =
            "relative flex flex-col items-center justify-center h-8 w-full rounded-lg text-xs font-medium transition-all duration-150 ";

          if (isSelected) {
            dayClass +=
              "bg-blue-600 text-white shadow-sm shadow-blue-200 dark:shadow-blue-900/40";
          } else if (isToday) {
            dayClass +=
              "bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 font-bold";
          } else if (isPast && mode === "select") {
            dayClass += "text-slate-300 dark:text-slate-600 cursor-not-allowed";
          } else if (hasPending && mode === "display") {
            dayClass +=
              "text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 cursor-pointer font-semibold";
          } else {
            dayClass +=
              "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 cursor-pointer";
          }

          return (
            <button
              key={key}
              onClick={() => !isPast && handleDayClick(date)}
              disabled={isPast && mode === "select"}
              className={dayClass}
              title={
                hasPending && mode === "display"
                  ? `${pendingItems.length} pendiente${pendingItems.length > 1 ? "s" : ""}`
                  : undefined
              }
            >
              <span>{date.getDate()}</span>

              {/* Dot indicator para días con pendientes */}
              {hasPending && mode === "display" && !isToday && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-[2px]">
                  {pendingItems.slice(0, 3).map((item, i) => (
                    <span
                      key={i}
                      className={`block w-1 h-1 rounded-full ${
                        item.type === "assignment"
                          ? "bg-blue-500 dark:bg-blue-400"
                          : "bg-amber-500 dark:bg-amber-400"
                      }`}
                    />
                  ))}
                </span>
              )}

              {/* Dot indicator cuando también es hoy */}
              {hasPending && mode === "display" && isToday && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Legend (solo mode=display) ── */}
      {mode === "display" && (
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50">
          <span className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400 inline-block" />
            Documentos
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400 inline-block" />
            Asignaciones
          </span>
        </div>
      )}
    </div>
  );
}
