// ============================================================================
// DashboardCalendar — Widget de calendario para el dashboard
// Combina documentos (expirationDateRaw) + asignaciones (dueDate)
// en un mapa de pendientes por fecha. Muestra popup al hacer click en un día.
// ============================================================================

import React, { useMemo, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Table, X, ArrowRight, Calendar } from "lucide-react";
import { Document } from "../types";
import { ApiDocumentAssignment } from "../lib/api";
import { getDocumentRoute } from "../lib/routes";
import { MiniCalendar, type PendingCalendarItem } from "./MiniCalendar";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardCalendarProps {
  documents: Document[];
  assignments: ApiDocumentAssignment[];
}

interface DayPopupState {
  dateKey: string; // "YYYY-MM-DD"
  items: PendingCalendarItem[];
  anchorRect: DOMRect;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDocTypeIcon(type?: string) {
  switch ((type ?? "").toUpperCase()) {
    case "XLSX":
      return (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-emerald-100 dark:bg-emerald-900/30">
          <Table size={12} className="text-emerald-600 dark:text-emerald-400" />
        </span>
      );
    case "PDF":
      return (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-red-100 dark:bg-red-900/30">
          <FileText size={12} className="text-red-500 dark:text-red-400" />
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-blue-100 dark:bg-blue-900/30">
          <FileText size={12} className="text-blue-600 dark:text-blue-400" />
        </span>
      );
  }
}

function formatDateKeyLabel(dateKey: string): string {
  // "YYYY-MM-DD" → "25 de abril de 2026"
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function DashboardCalendar({
  documents,
  assignments,
}: DashboardCalendarProps) {
  const navigate = useNavigate();
  const [popup, setPopup] = useState<DayPopupState | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Construir mapa pendingByDate ──────────────────────────────────────────

  const pendingByDate = useMemo(() => {
    const map = new Map<string, PendingCalendarItem[]>();

    const addToMap = (key: string, item: PendingCalendarItem) => {
      const existing = map.get(key) ?? [];
      existing.push(item);
      map.set(key, existing);
    };

    // 1. Documentos con expirationDateRaw (PENDIENTE)
    for (const doc of documents) {
      if (!doc.expirationDateRaw) continue;
      if (doc.fileStatus !== "PENDIENTE") continue;
      // expirationDateRaw es ISO → "YYYY-MM-DD"
      const key = doc.expirationDateRaw.slice(0, 10);
      addToMap(key, {
        id: doc.id,
        name: doc.name,
        type: "document",
        docType: doc.type,
        status: doc.fileStatus,
        documentId: doc.id,
      });
    }

    // 2. Asignaciones recibidas con dueDate — misma lógica que "Pendientes":
    // isAssignmentOpen = s !== "completado" (incluye: pendiente, visto, editado, revisado, rechazado)
    for (const a of assignments) {
      if (!a.dueDate) continue;
      if (a.status === "completado") continue; // única exclusión — idéntico a isAssignmentOpen()
      if (!a.document) continue;
      const key = a.dueDate.slice(0, 10);
      addToMap(key, {
        id: a.id,
        name: a.document?.name ?? "Documento asignado",
        type: "assignment",
        docType: (a.document?.type ?? "").toUpperCase(),
        status: a.status,
        documentId: a.document?.id,
      });
    }

    return map;
  }, [documents, assignments]);

  // ── Cerrar popup al click externo ─────────────────────────────────────────

  useEffect(() => {
    if (!popup) return;
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setPopup(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [popup]);

  // ── Handler de click en día ───────────────────────────────────────────────

  const handleDayClick = (dateKey: string, items: PendingCalendarItem[]) => {
    if (items.length === 0) return;

    // Buscar la celda del día para posicionar el popup
    const container = containerRef.current;
    const btn = container?.querySelector(`[data-date-key="${dateKey}"]`);
    const rect = btn?.getBoundingClientRect() ?? container?.getBoundingClientRect();

    setPopup({
      dateKey,
      items,
      anchorRect: rect as DOMRect,
    });
  };

  // ── Navegar al documento ──────────────────────────────────────────────────

  const handleItemClick = (item: PendingCalendarItem) => {
    if (!item.documentId) return;
    setPopup(null);
    navigate(getDocumentRoute(item.documentId, item.docType ?? "DOCX"));
  };

  // ── Total pendientes ──────────────────────────────────────────────────────

  const totalPending = useMemo(() => {
    let count = 0;
    for (const items of pendingByDate.values()) {
      count += items.length;
    }
    return count;
  }, [pendingByDate]);

  return (
    <div
      ref={containerRef}
      className="relative bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 p-4 shadow-sm"
    >
      {/* ── Card Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700">
            <Calendar size={15} className="text-slate-600 dark:text-slate-300" />
          </span>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Calendario
          </h3>
        </div>
        {totalPending > 0 && (
          <span className="text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">
            {totalPending} pendiente{totalPending !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* ── Mini Calendar ── */}
      <MiniCalendar
        mode="display"
        pendingByDate={pendingByDate}
        onDayClick={handleDayClick}
      />

      {/* ── Day Popup ── */}
      {popup && (
        <>
          {/* Backdrop blur sutil */}
          <div className="fixed inset-0 z-40" aria-hidden="true" />

          <div
            ref={popupRef}
            className="fixed z-50 w-72 calendar-day-popup"
            style={{
              top: Math.min(
                popup.anchorRect.bottom + 8,
                window.innerHeight - 320,
              ),
              left: Math.min(
                popup.anchorRect.left,
                window.innerWidth - 296,
              ),
            }}
          >
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-600/60 overflow-hidden">
              {/* Popup Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700/60">
                <div>
                  <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                    Pendientes
                  </p>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mt-0.5">
                    {formatDateKeyLabel(popup.dateKey)}
                  </p>
                </div>
                <button
                  onClick={() => setPopup(null)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Popup Items */}
              <ul className="divide-y divide-slate-50 dark:divide-slate-700/50 max-h-60 overflow-y-auto">
                {popup.items.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => handleItemClick(item)}
                      disabled={!item.documentId}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"
                    >
                      {getDocTypeIcon(item.docType)}

                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {item.name}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                          {item.type === "assignment"
                            ? `Asignación · ${
                                item.status === "pendiente"
                                  ? "Pendiente"
                                  : item.status === "visto"
                                    ? "Visto"
                                    : item.status === "editado"
                                      ? "Editado"
                                      : item.status ?? ""
                              }`
                            : `Documento · ${item.docType ?? ""}`}
                        </p>
                      </div>

                      {item.documentId && (
                        <ArrowRight
                          size={13}
                          className="text-slate-300 dark:text-slate-600 group-hover:text-blue-500 flex-shrink-0 transition-colors"
                        />
                      )}
                    </button>
                  </li>
                ))}
              </ul>

              {/* Más items indicator */}
              {popup.items.length > 5 && (
                <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-700/50">
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center">
                    +{popup.items.length - 5} más
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
