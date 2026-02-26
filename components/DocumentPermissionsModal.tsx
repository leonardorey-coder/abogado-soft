import React, { useState, useMemo } from "react";
import { Document, DocumentPermissionLevel, DocumentPermissionEntry } from "../types";

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
  "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400",
];

const LEVEL_ORDER: DocumentPermissionLevel[] = ["none", "download", "read", "write", "admin"];

const DEFAULT_MEMBERS = [
  { id: "m1", name: "Lic. María González", initials: "MG" },
  { id: "m2", name: "Lic. Carlos Ruiz", initials: "CR" },
  { id: "m3", name: "Dra. Elena Vázquez", initials: "EV" },
  { id: "m4", name: "Lic. Roberto Sosa", initials: "RS" },
];

function getLevelBadgeClass(level: DocumentPermissionLevel): string {
  const base = "flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors border";
  if (level === "admin") return `${base} bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/40`;
  if (level === "write") return `${base} bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50 hover:bg-blue-100 dark:hover:bg-blue-900/40`;
  return `${base} bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800`;
}

interface MemberRow {
  id: string;
  name: string;
  initials: string;
  level: DocumentPermissionLevel;
  colorClass: string;
}

interface DocumentPermissionsModalProps {
  document: Document;
  onClose: () => void;
  onSave?: (permissions: DocumentPermissionEntry[]) => void;
}

export const DocumentPermissionsModal: React.FC<DocumentPermissionsModalProps> = ({
  document,
  onClose,
  onSave,
}) => {
  const initialLevels = useMemo(() => {
    const map = new Map<string, DocumentPermissionLevel>();
    document.documentPermissions?.forEach((p) => {
      const key = p.userName.trim().toLowerCase();
      map.set(key, p.level);
    });
    return map;
  }, [document.documentPermissions]);

  const [members, setMembers] = useState<MemberRow[]>(() =>
    DEFAULT_MEMBERS.map((m, i) => ({
      ...m,
      level: initialLevels.get(m.name.trim().toLowerCase()) ?? "none",
      colorClass: AVATAR_COLORS[i % AVATAR_COLORS.length],
    }))
  );

  const [search, setSearch] = useState("");
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const filteredMembers = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.trim().toLowerCase();
    return members.filter((m) => m.name.toLowerCase().includes(q));
  }, [members, search]);

  const setMemberLevel = (id: string, level: DocumentPermissionLevel) => {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, level } : m)));
    setOpenDropdownId(null);
  };

  const handleSave = () => {
    const permissions: DocumentPermissionEntry[] = members
      .filter((m) => m.level !== "none")
      .map((m) => ({ userName: m.name, level: m.level }));
    onSave?.(permissions);
    onClose();
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
        {/* Header Compacto */}
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

        {/* Search Bar - Seamless */}
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

        {/* Scrollable Members Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">

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
                    <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${member.colorClass}`}>
                      {member.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{member.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{PERMISSION_DESCRIPTIONS[member.level]}</p>
                    </div>

                    {/* Control de nivel con Menú Dropdown */}
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
                                className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${member.level === level ? "text-primary font-bold bg-primary/5 target" : "text-slate-700 dark:text-slate-300 font-medium"}`}
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
                    <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm opacity-60 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all ${member.colorClass}`}>
                      {member.initials}
                    </div>
                    <div className="flex-1 min-w-0 opacity-70 group-hover:opacity-100 transition-opacity">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{member.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">No tiene acceso</p>
                    </div>

                    {/* Boton rápido "Agregar" => otorga 'read' con un solo click */}
                    <button
                      type="button"
                      onClick={() => setMemberLevel(member.id, "read")}
                      className="shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-bold text-primary bg-primary/10 hover:bg-primary hover:text-white transition-colors border border-transparent hover:border-primary opacity-0 group-hover:opacity-100 sm:opacity-100 focus:opacity-100"
                    >
                      <span className="material-symbols-outlined text-[18px]">add</span>
                      Dar Acceso
                    </button>
                  </div>
                ))}
              </div>
            </div>
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
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-bold shadow-md shadow-primary/20 hover:bg-blue-700 transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px]">check_circle</span>
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
};
