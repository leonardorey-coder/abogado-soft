// ============================================================================
// TeamAvatarRow — Fila de avatares del equipo con soporte de drag & drop
// Cada avatar actúa como drop zone para documentos de la tabla del dashboard.
// Al soltar un documento, dispara onAssignDrop con el payload para abrir el popup.
// ============================================================================

import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Users } from "lucide-react";
import { usersApi, type ApiUser } from "../lib/api";
import { UserAvatar } from "./UserAvatar";
import type { AssignDropPayload } from "./AssignWithDeadlinePopup";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeamAvatarRowProps {
  onAssignDrop: (payload: AssignDropPayload) => void;
  /** Cuando es true oculta el header del card (para usar dentro del overlay flotante) */
  compact?: boolean;
}


// ─── Componente ───────────────────────────────────────────────────────────────

export function TeamAvatarRow({ onAssignDrop, compact = false }: TeamAvatarRowProps) {
  const navigate = useNavigate();
  const [teamUsers, setTeamUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragOverUserId, setDragOverUserId] = useState<string | null>(null);

  // ── Cargar usuarios activos del despacho ──────────────────────────────────
  useEffect(() => {
    setLoading(true);
    // Mismo patrón que AssignModal.tsx y DocumentPermissionsModal.tsx
    usersApi
      .list({ limit: 100 })
      .then((res) => {
        // res.data funciona aunque el type sea PaginatedResponse (flat pagination)
        const active = (res.data ?? []).filter((u) => u.isActive);
        setTeamUsers(active);
      })
      .catch((err) => {
        console.error("[TeamAvatarRow] Error loading users:", err);
        setTeamUsers([]);
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Drag & Drop handlers ──────────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    // Aceptamos cualquier drag que no sea de archivos del OS (esos tienen files.length > 0)
    // La validación del contenido se hace en onDrop
    e.preventDefault();
    e.dataTransfer.dropEffect = "link";
  }, []);

  const handleDragLeave = useCallback(
    (e: React.DragEvent, userId: string) => {
      // Solo limpiar si salimos del avatar actual
      if (dragOverUserId === userId) {
        // Verificar que no entramos en un hijo
        const related = e.relatedTarget as Node | null;
        if (!e.currentTarget.contains(related)) {
          setDragOverUserId(null);
        }
      }
    },
    [dragOverUserId],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, user: ApiUser) => {
      e.preventDefault();
      setDragOverUserId(null);

      const raw = e.dataTransfer.getData("text/plain");
      if (!raw) return;

      try {
        const parsed = JSON.parse(raw) as {
          __abogadosoft_doc?: boolean;
          documentId: string;
          documentName: string;
          documentType: string;
        };
        // Validar que es nuestro drag interno y no cualquier texto
        if (!parsed.__abogadosoft_doc || !parsed.documentId) return;
        onAssignDrop({
          documentId: parsed.documentId,
          documentName: parsed.documentName,
          documentType: parsed.documentType,
          assignToUser: user,
        });
      } catch (err) {
        console.error("[TeamAvatarRow] Error parsing drop data:", err);
      }
    },
    [onAssignDrop],
  );

  // ── Click en avatar → navega al perfil ────────────────────────────────────
  const handleAvatarClick = useCallback(
    (userId: string) => {
      navigate(`/equipo/usuario/${userId}`);
    },
    [navigate],
  );

  // ── Skeleton ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700">
            <Users size={15} className="text-slate-400" />
          </span>
          <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
        </div>
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2 flex-shrink-0">
              <div className="w-11 h-11 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
              <div className="h-2 w-12 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (teamUsers.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700">
            <Users size={15} className="text-slate-600 dark:text-slate-300" />
          </span>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Equipo del Despacho
          </h3>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          No hay miembros activos en el equipo.
        </p>
      </div>
    );
  }

  return (
    <div className={compact ? "" : "bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 p-4 shadow-sm"}>
      {/* ── Card Header (oculto en modo compact) ── */}
      {!compact && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700">
              <Users size={15} className="text-slate-600 dark:text-slate-300" />
            </span>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Equipo del Despacho
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            Arrastra un documento sobre un miembro
          </span>
        </div>
      )}

      {/* ── Avatar row ── */}
      <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
        {teamUsers.map((user) => {
          const isDropTarget = dragOverUserId === user.id;

          return (
            <div
              key={user.id}
              className="flex flex-col items-center gap-1.5 flex-shrink-0"
              onDragOver={(e) => { handleDragOver(e); setDragOverUserId(user.id); }}
              onDragLeave={(e) => handleDragLeave(e, user.id)}
              onDrop={(e) => handleDrop(e, user)}
            >
              {/* Avatar con drop target effect */}
              <button
                onClick={() => handleAvatarClick(user.id)}
                className={[
                  "relative rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-slate-800",
                  isDropTarget
                    ? "ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-800 scale-110 shadow-lg shadow-blue-200 dark:shadow-blue-900/40"
                    : "hover:scale-105 hover:shadow-md",
                ].join(" ")}
                title={`${user.name}${isDropTarget ? " — Soltar para asignar" : " — Click para ver perfil"}`}
              >
                <UserAvatar
                  name={user.name}
                  avatarUrl={user.avatarUrl ?? undefined}
                  className="w-11 h-11 rounded-full object-cover"
                />

                {/* Glow overlay cuando hay drag encima */}
                {isDropTarget && (
                  <span className="absolute inset-0 rounded-full bg-blue-400/20 dark:bg-blue-500/25 animate-pulse" />
                )}
              </button>

              {/* Nombre truncado */}
              <p
                className={[
                  "text-[11px] font-medium text-center max-w-[52px] truncate transition-colors",
                  isDropTarget
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-slate-500 dark:text-slate-400",
                ].join(" ")}
                title={user.name}
              >
                {user.name.split(" ")[0]}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Hint cuando hay drag activo en algún avatar ── */}
      {dragOverUserId && !compact && (
        <p className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/50 text-[11px] text-blue-600 dark:text-blue-400 text-center animate-pulse">
          Suelta para asignar el documento
        </p>
      )}
    </div>
  );
}
