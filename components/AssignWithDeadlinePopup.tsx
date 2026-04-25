// ============================================================================
// AssignWithDeadlinePopup — Modal post drag-and-drop
// Se abre al soltar un documento sobre un avatar de usuario.
// Permite seleccionar fecha límite (dueDate) y notas antes de crear la asignación.
// ============================================================================

import React, { useState } from "react";
import { X, FileText, Table, Calendar, Loader2, Check } from "lucide-react";
import { assignmentsApi, type ApiUser } from "../lib/api";
import { useToast } from "../contexts/ToastContext";
import { UserAvatar } from "./UserAvatar";
import { MiniCalendar } from "./MiniCalendar";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AssignDropPayload {
  documentId: string;
  documentName: string;
  documentType: string; // "DOCX" | "PDF" | "XLSX"
  assignToUser: ApiUser;
}

interface AssignWithDeadlinePopupProps {
  payload: AssignDropPayload;
  onClose: () => void;
  onSuccess?: () => void;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function getDocTypeVisual(type: string) {
  switch (type.toUpperCase()) {
    case "XLSX":
      return {
        icon: Table,
        bg: "bg-emerald-100 dark:bg-emerald-900/30",
        color: "text-emerald-600 dark:text-emerald-400",
      };
    case "PDF":
      return {
        icon: FileText,
        bg: "bg-red-100 dark:bg-red-900/30",
        color: "text-red-500 dark:text-red-400",
      };
    default:
      return {
        icon: FileText,
        bg: "bg-blue-100 dark:bg-blue-900/30",
        color: "text-blue-600 dark:text-blue-400",
      };
  }
}

function formatSelectedDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function AssignWithDeadlinePopup({
  payload,
  onClose,
  onSuccess,
}: AssignWithDeadlinePopupProps) {
  const { addToast } = useToast();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const docVisual = getDocTypeVisual(payload.documentType);
  const DocIcon = docVisual.icon;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // CRÍTICO: dueDate debe ser ISO datetime completo para pasar z.string().datetime()
      // Usamos T12:00:00.000Z (mediodía UTC) para evitar timezone shift a día anterior
      const dueDate = selectedDate
        ? new Date(`${selectedDate}T12:00:00.000Z`).toISOString()
        : undefined;

      await assignmentsApi.create({
        documentId: payload.documentId,
        assignedTo: payload.assignToUser.id,
        notes: notes.trim() || undefined,
        dueDate,
      });

      addToast({
        message: `"${payload.documentName}" asignado a ${payload.assignToUser.name}`,
        type: "success",
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      const msg =
        err?.message?.includes("duplicate") || err?.status === 409
          ? `${payload.assignToUser.name} ya tiene este documento asignado`
          : "Error al crear la asignación";
      addToast({ message: msg, type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-600/60 overflow-hidden animate-slide-up"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-slate-100 dark:border-slate-700/60">
          <div className="flex items-center gap-3">
            <span className={`flex items-center justify-center w-9 h-9 rounded-xl ${docVisual.bg}`}>
              <DocIcon size={18} className={docVisual.color} />
            </span>
            <div>
              <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                Asignar documento
              </p>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate max-w-[220px]">
                {payload.documentName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* ── Destinatario ── */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600/40">
            <UserAvatar
              name={payload.assignToUser.name}
              avatarUrl={payload.assignToUser.avatarUrl ?? undefined}
              className="w-10 h-10 rounded-full object-cover flex-shrink-0"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                {payload.assignToUser.name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {payload.assignToUser.position || payload.assignToUser.role === "admin"
                  ? payload.assignToUser.position || "Administrador"
                  : "Asistente"}
              </p>
            </div>
          </div>

          {/* ── Selector de fecha ── */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={13} className="text-slate-400" />
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Fecha límite
                <span className="ml-1 font-normal text-slate-400">(opcional)</span>
              </p>
            </div>

            {selectedDate && (
              <div className="flex items-center justify-between mb-2 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/40">
                <p className="text-xs text-blue-700 dark:text-blue-300 font-medium capitalize">
                  {formatSelectedDate(selectedDate)}
                </p>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="text-blue-400 hover:text-blue-600 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-600/60 bg-slate-50/50 dark:bg-slate-700/30">
              <MiniCalendar
                mode="select"
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />
            </div>
          </div>

          {/* ── Notas ── */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
              Notas
              <span className="ml-1 font-normal text-slate-400">(opcional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instrucciones o comentarios para el destinatario..."
              rows={2}
              maxLength={500}
              className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 dark:focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/50">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-xl shadow-sm transition-colors disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Check size={15} />
            )}
            {submitting ? "Asignando..." : "Asignar"}
          </button>
        </div>
      </div>
    </div>
  );
}
