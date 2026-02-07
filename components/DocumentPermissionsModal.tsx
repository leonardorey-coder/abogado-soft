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
  none: "Sin acceso asignado actualmente",
  download: "Habilitar descarga de archivos adjuntos",
  read: "Acceso de solo lectura para consulta",
  write: "Permitir edición completa del caso",
  admin: "Control total del documento y permisos",
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

function getLevelButtonClass(level: DocumentPermissionLevel): string {
  const base = "flex min-w-[120px] cursor-pointer items-center justify-between overflow-hidden rounded-lg h-9 px-4 text-sm font-medium leading-normal transition-colors";
  if (level === "none") {
    return `${base} border border-dashed border-gray-300 dark:border-gray-600 text-[#616f89] dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800`;
  }
  if (level === "write" || level === "admin") {
    return `${base} bg-primary text-white hover:bg-primary/90`;
  }
  return `${base} bg-[#f0f2f4] dark:bg-gray-800 text-[#111318] dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700`;
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white dark:bg-[#1a2130] w-full max-w-[700px] rounded-xl shadow-2xl overflow-hidden flex flex-col border border-gray-200 dark:border-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pt-8 px-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-[#111318] dark:text-white tracking-tight text-[28px] font-bold leading-tight">
              Configuración de Acceso al Documento
            </h1>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
              aria-label="Cerrar"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <h2 className="text-[#111318] dark:text-gray-300 text-lg font-medium leading-tight tracking-[-0.015em] pb-4">
            ¿Quién puede acceder a este documento?
          </h2>
        </div>

        <div className="px-8 pb-4">
          <div className="flex flex-1 flex-col items-start justify-between gap-4 rounded-lg border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-[#1a2130] p-4 min-[480px]:flex-row min-[480px]:items-center">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-lg text-primary">
                <span className="material-symbols-outlined">lock</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <p className="text-[#111318] dark:text-white text-base font-bold leading-tight">
                  Acceso Limitado
                </p>
                <p className="text-[#616f89] dark:text-gray-400 text-sm font-normal leading-normal">
                  Solo los miembros autorizados pueden ver este expediente legal.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-8 py-2">
          <label className="flex flex-col min-w-40 h-11 w-full">
            <div className="flex w-full flex-1 items-stretch rounded-lg h-full border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="text-[#616f89] flex bg-[#f0f2f4] dark:bg-gray-800 items-center justify-center pl-4">
                <span className="material-symbols-outlined">search</span>
              </div>
              <input
                type="text"
                className="flex w-full min-w-0 flex-1 resize-none overflow-hidden text-[#111318] dark:text-white focus:outline-0 focus:ring-0 border-none bg-[#f0f2f4] dark:bg-gray-800 placeholder:text-[#616f89] dark:placeholder:text-gray-500 px-4 pl-2 text-base font-normal leading-normal"
                placeholder="Buscar miembros de la firma..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </label>
        </div>

        <div className="flex-1 overflow-y-auto max-h-[400px] px-4 py-2">
          {filteredMembers.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-4 px-4 min-h-[72px] py-3 justify-between border-b border-gray-100 dark:border-gray-800 last:border-0"
            >
              <div className={`flex items-center gap-4 ${member.level === "none" ? "opacity-60" : ""}`}>
                <div
                  className={`aspect-square rounded-full h-12 w-12 border border-gray-100 dark:border-gray-700 flex items-center justify-center font-bold ${member.colorClass}`}
                  aria-hidden
                >
                  {member.initials}
                </div>
                <div className="flex flex-col justify-center">
                  <p className="text-[#111318] dark:text-white text-base font-semibold leading-normal line-clamp-1">
                    {member.name}
                  </p>
                  <p className="text-[#616f89] dark:text-gray-400 text-xs font-normal leading-normal">
                    {PERMISSION_DESCRIPTIONS[member.level]}
                  </p>
                </div>
              </div>
              <div className="shrink-0 relative">
                <button
                  type="button"
                  className={getLevelButtonClass(member.level)}
                  onClick={() => setOpenDropdownId(openDropdownId === member.id ? null : member.id)}
                  aria-expanded={openDropdownId === member.id}
                  aria-haspopup="listbox"
                >
                  <span className="truncate">{PERMISSION_LABELS[member.level]}</span>
                  <span className="material-symbols-outlined !text-[18px]">expand_more</span>
                </button>
                {openDropdownId === member.id && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      aria-hidden
                      onClick={() => setOpenDropdownId(null)}
                    />
                    <ul
                      className="absolute right-0 top-full mt-1 z-20 min-w-[160px] py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-lg"
                      role="listbox"
                    >
                      {LEVEL_ORDER.map((level) => (
                        <li key={level} role="option" aria-selected={member.level === level}>
                          <button
                            type="button"
                            onClick={() => setMemberLevel(member.id, level)}
                            className={`w-full px-4 py-2.5 text-left text-sm font-medium flex items-center gap-2 rounded-lg mx-1 ${
                              member.level === level
                                ? "bg-primary/10 text-primary dark:text-primary"
                                : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                            }`}
                          >
                            {PERMISSION_LABELS[level]}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="px-8 py-6 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50 dark:bg-[#151b28]">
          <p className="text-xs text-[#616f89] dark:text-gray-400 italic">
            Los cambios se aplicarán inmediatamente a este expediente.
          </p>
          <div className="flex gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none min-w-[100px] h-10 px-4 rounded-lg text-[#111318] dark:text-gray-200 text-sm font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 sm:flex-none min-w-[160px] h-10 px-6 rounded-lg bg-primary text-white text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined !text-[18px]">save</span>
              Guardar Cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
