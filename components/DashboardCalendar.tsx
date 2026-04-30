// ============================================================================
// DashboardCalendar — Widget de calendario para el dashboard
// Combina documentos (expirationDateRaw) + asignaciones (dueDate)
// en un mapa de pendientes por fecha. Muestra popup al hacer click en un día
// con pendientes, y permite agregar/ver notas rápidas (hot notes) en cualquier día.
// ============================================================================

import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  Table,
  X,
  ArrowRight,
  Calendar,
  StickyNote,
  Send,
  Trash2,
} from "lucide-react";
import { Document } from "../types";
import { ApiDocumentAssignment, ApiCalendarNote, calendarNotesApi } from "../lib/api";
import { getDocumentRoute } from "../lib/routes";
import { MiniCalendar, type PendingCalendarItem } from "./MiniCalendar";
import { useAuth } from "../contexts/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardCalendarProps {
  documents: Document[];
  assignments: ApiDocumentAssignment[];
}

interface DayPopupState {
  dateKey: string; // "YYYY-MM-DD"
  items: PendingCalendarItem[];
  anchorRect: DOMRect;
  view: "items" | "note"; // qué tab está activo
}

const isAssignmentPending = (status: string) =>
  status !== "completado" && status !== "activo" && status !== "revocado";

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

/** Formatea una fecha ISO a tiempo relativo en español */
function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return "hace un momento";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `hace ${days} día${days !== 1 ? "s" : ""}`;
  const weeks = Math.floor(days / 7);
  return `hace ${weeks} semana${weeks !== 1 ? "s" : ""}`;
}

/** Primer y último día del mes actual para el fetch de notas */
function monthRange(year: number, month: number): { from: string; to: string } {
  const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function DashboardCalendar({
  documents,
  assignments,
}: DashboardCalendarProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [popup, setPopup] = useState<DayPopupState | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Estado de notas ───────────────────────────────────────────────────────
  const [noteText, setNoteText] = useState("");
  const [existingNote, setExistingNote] = useState<ApiCalendarNote | null>(null);
  const [notesByDate, setNotesByDate] = useState<Map<string, ApiCalendarNote>>(new Map());
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);

  // ── Mes/año visible (sincronizado con MiniCalendar interno via lifting) ───
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // ── Fetch de notas al cambiar mes ────────────────────────────────────────
  const fetchNotes = useCallback(async (year: number, month: number) => {
    const { from, to } = monthRange(year, month);
    try {
      const notes = await calendarNotesApi.list(from, to);
      setNotesByDate((prev) => {
        const next = new Map(prev);
        for (const note of notes) {
          const key = note.dateKey.slice(0, 10);
          next.set(key, note);
        }
        return next;
      });
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    fetchNotes(viewYear, viewMonth);
  }, [viewYear, viewMonth, fetchNotes]);

  // ── Set de días con nota (para MiniCalendar) ──────────────────────────────
  const notesDaySet = useMemo(() => {
    const s = new Set<string>();
    for (const key of notesByDate.keys()) s.add(key);
    return s;
  }, [notesByDate]);

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

    // 2. Asignaciones recibidas con dueDate
    for (const a of assignments) {
      if (!a.dueDate) continue;
      if (!isAssignmentPending(a.status)) continue;
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
    // Buscar la celda del día para posicionar el popup
    const container = containerRef.current;
    const btn = container?.querySelector(`[data-date-key="${dateKey}"]`);
    const rect = btn?.getBoundingClientRect() ?? container?.getBoundingClientRect();

    const note = notesByDate.get(dateKey) ?? null;
    setExistingNote(note);
    setNoteText(note?.content ?? "");
    // Si hay nota existente → mostrar nota (no editar); si no hay → entrar directo en edición
    setIsEditingNote(!note);

    // Si el día tiene pendientes, mostrar primero la lista; si solo tiene nota, ir directo a note
    setPopup({
      dateKey,
      items,
      anchorRect: rect as DOMRect,
      view: items.length > 0 ? "items" : "note",
    });
  };

  // ── Navegar al documento ──────────────────────────────────────────────────

  const handleItemClick = (item: PendingCalendarItem) => {
    if (!item.documentId) return;
    setPopup(null);
    navigate(getDocumentRoute(item.documentId, item.docType ?? "DOCX"));
  };

  // ── Guardar nota ──────────────────────────────────────────────────────────

  const handleSaveNote = async () => {
    if (!popup || !noteText.trim()) return;
    setIsSavingNote(true);
    try {
      const saved = await calendarNotesApi.upsert(popup.dateKey, noteText.trim());
      setExistingNote(saved);
      setIsEditingNote(false); // colapsar al modo visualización
      setNotesByDate((prev) => {
        const next = new Map(prev);
        next.set(popup.dateKey, saved);
        return next;
      });
    } catch {
      // ignoro — podría mostrar toast
    } finally {
      setIsSavingNote(false);
    }
  };

  // ── Eliminar nota ─────────────────────────────────────────────────────────

  const handleDeleteNote = async () => {
    if (!popup) return;
    setIsSavingNote(true);
    try {
      await calendarNotesApi.delete(popup.dateKey);
      setExistingNote(null);
      setNoteText("");
      setIsEditingNote(true); // tras borrar, entrar en edición para escribir una nueva
      setNotesByDate((prev) => {
        const next = new Map(prev);
        next.delete(popup.dateKey);
        return next;
      });
    } catch {
      // ignoro
    } finally {
      setIsSavingNote(false);
    }
  };

  // ── Total pendientes ──────────────────────────────────────────────────────

  const totalPending = useMemo(() => {
    let count = 0;
    for (const items of pendingByDate.values()) {
      count += items.length;
    }
    return count;
  }, [pendingByDate]);

  // Focus textarea al activar edición
  useEffect(() => {
    if (isEditingNote && popup?.view === "note") {
      setTimeout(() => textareaRef.current?.focus(), 60);
    }
  }, [isEditingNote, popup?.view]);

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
        notesByDate={notesDaySet}
        onDayClick={handleDayClick}
        onMonthChange={(year, month) => {
          setViewYear(year);
          setViewMonth(month);
        }}
      />

      {/* ── Day Popup ── */}
      {popup && (
        <>
          {/* Backdrop sutil */}
          <div className="fixed inset-0 z-40" aria-hidden="true" />

          <div
            ref={popupRef}
            className="fixed z-50 w-80 calendar-day-popup"
            style={{
              top: Math.min(
                popup.anchorRect.bottom + 8,
                window.innerHeight - 380,
              ),
              left: Math.min(
                popup.anchorRect.left,
                window.innerWidth - 328,
              ),
            }}
          >
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-600/60 overflow-hidden">
              {/* Popup Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700/60">
                <div>
                  <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide flex items-center gap-1">
                    {popup.view === "note" && (
                      <StickyNote size={11} className="text-violet-500 dark:text-violet-400" />
                    )}
                    {popup.items.length > 0 && popup.view === "items"
                      ? "Pendientes"
                      : "Nota del día"}
                  </p>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mt-0.5">
                    {formatDateKeyLabel(popup.dateKey)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {/* Tab: nota (solo si hay items, para poder alternar) */}
                  {popup.items.length > 0 && (
                    <>
                      <button
                        onClick={() =>
                          setPopup((p) => p && { ...p, view: "note" })
                        }
                        title="Nota del día"
                        className={`p-1.5 rounded-lg transition-colors ${
                          popup.view === "note"
                            ? "text-violet-600 dark:text-violet-400"
                            : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"
                        }`}
                      >
                        <StickyNote size={13} />
                      </button>
                      <button
                        onClick={() =>
                          setPopup((p) => p && { ...p, view: "items" })
                        }
                        title="Pendientes del día"
                        className={`p-1.5 rounded-lg transition-colors ${
                          popup.view === "items"
                            ? "text-amber-600 dark:text-amber-400"
                            : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"
                        }`}
                      >
                        <Calendar size={13} />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setPopup(null)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 transition-colors"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>

              {/* ── Vista: Pendientes ─────────────────────────────────── */}
              {popup.view === "items" && (
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
              )}

              {/* ── Vista: Nota del día ───────────────────────────────── */}
              {popup.view === "note" && (
                <div className="p-4 space-y-3">
                  {/* Nota existente — clic para editar inline */}
                  {existingNote && !isEditingNote && (() => {
                    const isOwner = existingNote.user?.id === user?.id;
                    return (
                      <div
                        onClick={() => {
                          if (!isOwner) return; // solo el autor puede editar
                          setNoteText(existingNote.content);
                          setIsEditingNote(true);
                        }}
                        className={`group bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800/40 rounded-xl px-3 py-2.5 transition-colors ${
                          isOwner
                            ? "cursor-text hover:border-violet-300 dark:hover:border-violet-600"
                            : "cursor-default"
                        }`}
                        title={isOwner ? "Clic para editar" : undefined}
                      >
                        <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                          {existingNote.content}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">
                            <span className="font-medium text-violet-600 dark:text-violet-400">
                              {existingNote.user?.name ?? "Tú"}
                            </span>{" "}
                            · {timeAgo(existingNote.updatedAt)}
                          </p>
                          {isOwner && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteNote(); }}
                              disabled={isSavingNote}
                              className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-300 hover:text-red-400 transition-colors"
                              title="Eliminar nota"
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}


                  {/* Campo de edición inline — solo visible cuando isEditingNote */}
                  {isEditingNote && (
                    <div className="relative">
                      <textarea
                        ref={textareaRef}
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault();
                            handleSaveNote();
                          }
                          if (e.key === "Escape") {
                            setIsEditingNote(false);
                          }
                        }}
                        placeholder="Escribe una nota para este día…"
                        rows={3}
                        className="w-full resize-none text-xs bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600/60 rounded-xl px-3 py-2.5 text-slate-700 dark:text-slate-200 placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:outline-none focus:border-violet-400 dark:focus:border-violet-500 focus:ring-1 focus:ring-violet-200 dark:focus:ring-violet-800/40 transition-all"
                      />
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">
                          ⌘+Enter · Esc para cancelar
                        </p>
                        <button
                          onClick={handleSaveNote}
                          disabled={isSavingNote || !noteText.trim()}
                          className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <Send size={10} />
                          {isSavingNote ? "Guardando…" : "Guardar"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Estado vacío — sin nota y no editando */}
                  {!existingNote && !isEditingNote && (
                    <button
                      onClick={() => setIsEditingNote(true)}
                      className="w-full text-[11px] text-slate-400 dark:text-slate-500 hover:text-violet-500 dark:hover:text-violet-400 py-3 border border-dashed border-slate-200 dark:border-slate-600/60 hover:border-violet-300 dark:hover:border-violet-600 rounded-xl transition-colors"
                    >
                      + Añadir nota para este día
                    </button>
                  )}
                </div>
              )}

              {/* Más items indicator */}
              {popup.view === "items" && popup.items.length > 5 && (
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
