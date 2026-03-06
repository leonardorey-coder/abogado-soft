import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Document, DocumentPermissionLevel } from "../types";
import { permissionsApi, usersApi, ApiUser, ApiDocumentPermission, SetPermissionPayload } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

const PERMISSION_LABELS: Record<DocumentPermissionLevel, string> = {
  none: "Sin Acceso",
  download: "Puede Descargar",
  read: "Puede Ver",
  write: "Puede Editar",
  admin: "Administrador",
};

const PERMISSION_DESCRIPTIONS: Record<DocumentPermissionLevel, string> = {
  none: "No puede ver ni interactuar con este documento",
  download: "Solo puede descargar archivos adjuntos",
  read: "Puede leer el contenido del expediente",
  write: "Puede hacer modificaciones al contenido",
  admin: "Control total, incluyendo gestión de permisos",
};

const AVATAR_COLORS = [
  "bg-primary/10 text-primary",
  "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
  "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  "bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400",
  "bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400",
];

const LEVEL_ORDER: DocumentPermissionLevel[] = ["none", "download", "read", "write", "admin"];

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter((w) => w.length > 0)
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join("");
}

function getLevelBadgeClass(level: DocumentPermissionLevel): string {
  const base = "flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors border";
  if (level === "admin") return `${base} bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/40`;
  if (level === "write") return `${base} bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50 hover:bg-blue-100 dark:hover:bg-blue-900/40`;
  if (level === "read") return `${base} bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/40`;
  if (level === "download") return `${base} bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50 hover:bg-amber-100 dark:hover:bg-amber-900/40`;
  return `${base} bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800`;
}

interface MemberRow {
  id: string;       // userId
  name: string;
  email: string;
  avatarUrl: string | null;
  initials: string;
  level: DocumentPermissionLevel;
  colorClass: string;
  isOwner: boolean;
}

interface DocumentPermissionsModalProps {
  document: Document & { ownerId?: string; owner?: { id: string; name: string; email: string } | null };
  onClose: () => void;
  onSave?: () => void;
}

export const DocumentPermissionsModal: React.FC<DocumentPermissionsModalProps> = ({
  document,
  onClose,
  onSave,
}) => {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [search, setSearch] = useState("");
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; visible: boolean; type: "success" | "error" } | null>(null);
  const { user: authUser } = useAuth();
  const canManage = authUser?.role === 'admin';
  const [dirty, setDirty] = useState(false);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, visible: true, type });
    setTimeout(() => setToast(prev => prev ? { ...prev, visible: false } : null), 2500);
    setTimeout(() => setToast(null), 3000);
  };

  // Cargar usuarios del equipo y permisos existentes
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [usersRaw, permsRes] = await Promise.all([
        usersApi.list({ limit: 100 }),
        permissionsApi.list(document.id),
      ]);

      const users: ApiUser[] = Array.isArray(usersRaw) ? usersRaw : (usersRaw as any).data ?? [];
      const existingPerms = permsRes.permissions ?? [];
      const effectivePermission = permsRes.effectivePermission ?? "none";

      // Solo el abogado (admin) puede gestionar permisos
      // Se ignora effectivePermission para esta decisión
      // ya que es una restricción de ROL, no de documento

      // Crear mapa de permisos existentes por userId
      const permMap = new Map<string, DocumentPermissionLevel>();
      for (const p of existingPerms) {
        if (p.userId) {
          permMap.set(p.userId, p.permissionLevel as DocumentPermissionLevel);
        }
      }

      // Identificar al dueño del documento
      const ownerId = document.ownerId ?? (document as any).owner?.id ?? null;

      // Construir filas de miembros
      const rows: MemberRow[] = users.map((u, i) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        avatarUrl: u.avatarUrl,
        initials: getInitials(u.name),
        level: u.id === ownerId ? "admin" : (permMap.get(u.id) ?? "none"),
        colorClass: AVATAR_COLORS[i % AVATAR_COLORS.length],
        isOwner: u.id === ownerId,
      }));

      setMembers(rows);
    } catch (err: any) {
      console.error("Error cargando permisos:", err);
      setError(err.message || "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [document.id, document.ownerId]);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredMembers = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.trim().toLowerCase();
    return members.filter((m) =>
      m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  }, [members, search]);

  const setMemberLevel = (id: string, level: DocumentPermissionLevel) => {
    setMembers((prev) => prev.map((m) => (m.id === id && !m.isOwner ? { ...m, level } : m)));
    setOpenDropdownId(null);
    setDirty(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Construir payload: solo usuarios que no son el dueño
      const permissions: SetPermissionPayload[] = members
        .filter((m) => !m.isOwner && m.level !== "none")
        .map((m) => ({
          userId: m.id,
          permissionLevel: m.level,
        }));

      await permissionsApi.save(document.id, permissions);
      showToast("Permisos guardados correctamente", "success");
      setDirty(false);
      onSave?.();
    } catch (err: any) {
      console.error("Error guardando permisos:", err);
      showToast(err.message || "Error al guardar permisos", "error");
    } finally {
      setSaving(false);
    }
  };

  const activeMembers = filteredMembers.filter(m => m.level !== "none");
  const inactiveMembers = filteredMembers.filter(m => m.level === "none");

  return (
    <div
      className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white dark:bg-[#1a2130] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between shrink-0 bg-slate-50/50 dark:bg-transparent">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">folder_shared</span>
              Compartir Documento
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Administre quién tiene acceso y qué puede hacer en este expediente.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="relative flex items-center w-full">
            <span className="material-symbols-outlined absolute left-3 text-slate-400 text-xl pointer-events-none">search</span>
            <input
              type="text"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#101622] text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-slate-400"
              placeholder="Buscar por nombre o correo para asignar acceso..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <span className="material-symbols-outlined text-4xl text-primary animate-spin">progress_activity</span>
              <p className="text-sm text-slate-500 dark:text-slate-400">Cargando permisos...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <span className="material-symbols-outlined text-4xl text-red-400 mb-2">error</span>
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              <button onClick={loadData} className="mt-3 text-sm text-primary font-bold hover:underline">
                Reintentar
              </button>
            </div>
          ) : (
            <>
              {/* Seccion 1: Los que tienen acceso */}
              <div>
                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3 px-2">
                  Personas con Acceso ({activeMembers.length})
                </h3>
                {activeMembers.length === 0 ? (
                  <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                    <p className="text-sm text-slate-500 dark:text-slate-400">Nadie tiene acceso aún. El documento es privado.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {activeMembers.map((member) => (
                      <div key={member.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                        {member.avatarUrl ? (
                          <img
                            src={member.avatarUrl}
                            alt={member.name}
                            className="shrink-0 w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${member.colorClass}`}>
                            {member.initials}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate flex items-center gap-2">
                            {member.name}
                            {member.isOwner && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                                <span className="material-symbols-outlined text-[12px]">star</span>
                                Propietario
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {member.isOwner ? "Control total como propietario" : PERMISSION_DESCRIPTIONS[member.level]}
                          </p>
                        </div>

                        {/* Selector de nivel — deshabilitado para el propietario */}
                        {member.isOwner ? (
                          <span className={getLevelBadgeClass("admin") + " cursor-default opacity-70"}>
                            Propietario
                          </span>
                        ) : canManage ? (
                          <div className="shrink-0 relative">
                            <button
                              type="button"
                              className={getLevelBadgeClass(member.level)}
                              onClick={() => setOpenDropdownId(openDropdownId === member.id ? null : member.id)}
                            >
                              {PERMISSION_LABELS[member.level]}
                              <span className="material-symbols-outlined text-[18px]">expand_more</span>
                            </button>

                            {openDropdownId === member.id && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setOpenDropdownId(null)} />
                                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-20 py-2 overflow-hidden animate-in fade-in slide-in-from-top-2">
                                  {LEVEL_ORDER.filter(l => l !== "none").map((level) => (
                                    <button
                                      key={level}
                                      type="button"
                                      onClick={() => setMemberLevel(member.id, level)}
                                      className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${member.level === level ? "text-primary font-bold bg-primary/5" : "text-slate-700 dark:text-slate-300 font-medium"}`}
                                    >
                                      {PERMISSION_LABELS[level]}
                                      {member.level === level && <span className="material-symbols-outlined text-base">check</span>}
                                    </button>
                                  ))}
                                  <div className="h-px bg-slate-100 dark:bg-slate-700 my-1" />
                                  <button
                                    type="button"
                                    onClick={() => setMemberLevel(member.id, "none")}
                                    className="w-full px-4 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                  >
                                    Quitar acceso
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        ) : (
                          <span className={getLevelBadgeClass(member.level) + " cursor-default"}>
                            {PERMISSION_LABELS[member.level]}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Seccion 2: Los que NO tienen acceso */}
              {inactiveMembers.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3 px-2 flex items-center justify-between">
                    Resto del Equipo
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full normal-case font-medium">Sugerencias</span>
                  </h3>
                  <div className="space-y-1">
                    {inactiveMembers.map((member) => (
                      <div key={member.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                        {member.avatarUrl ? (
                          <img
                            src={member.avatarUrl}
                            alt={member.name}
                            className="shrink-0 w-10 h-10 rounded-full object-cover opacity-60 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all"
                          />
                        ) : (
                          <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm opacity-60 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all ${member.colorClass}`}>
                            {member.initials}
                          </div>
                        )}
                        <div className="flex-1 min-w-0 opacity-70 group-hover:opacity-100 transition-opacity">
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{member.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{member.email}</p>
                        </div>

                        {canManage && (
                          <button
                            type="button"
                            onClick={() => setMemberLevel(member.id, "read")}
                            className="shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-bold text-primary bg-primary/10 hover:bg-primary hover:text-white transition-colors border border-transparent hover:border-primary opacity-0 group-hover:opacity-100 sm:opacity-100 focus:opacity-100"
                          >
                            <span className="material-symbols-outlined text-[18px]">add</span>
                            Dar Acceso
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 shrink-0 bg-slate-50 dark:bg-[#141921]">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
          {canManage && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !dirty}
              className="px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-bold shadow-md shadow-primary/20 hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-[20px]">check_circle</span>
              )}
              {saving ? "Guardando..." : "Guardar Cambios"}
            </button>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border transition-all duration-500 ${toast.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            } ${toast.type === "success"
              ? "bg-green-50 dark:bg-green-900/80 border-green-200 dark:border-green-700 text-green-800 dark:text-green-200"
              : "bg-red-50 dark:bg-red-900/80 border-red-200 dark:border-red-700 text-red-800 dark:text-red-200"
            }`}
        >
          <span className="material-symbols-outlined text-2xl">
            {toast.type === "success" ? "check_circle" : "error"}
          </span>
          <span className="font-bold text-sm">{toast.message}</span>
        </div>
      )}
    </div>
  );
};
